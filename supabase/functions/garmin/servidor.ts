/**
 * GARMIN (fase 4 de los stickers, 28 oct 2026): la conexión con Garmin Connect por su API, sin archivos FIT. Una sola función con cuatro trabajos:
 *
 *   1. CONECTAR (la app, con la sesión de la persona: `POST { accion: 'conectar' }`): arma la liga a la página de permiso de Garmin (OAuth 2.0 con PKCE) y
 *      guarda el `state` y el `code_verifier` en `garmin_pendientes`. La app abre esa liga.
 *   2. EL REGRESO (Garmin, `GET ?code=…&state=…`): cambia el código por las llaves, pregunta el id de la persona en Garmin, guarda las llaves en
 *      `garmin_conexiones` (solo el servidor la lee) y la conexión en `dispositivos_conectados`, y regresa a la app (`https://app.traininglabapp.com/?garmin=conectado`,
 *      que en el iPhone abre la app por su liga universal).
 *   3. LOS AVISOS (Garmin, `POST` con `activityDetails`, `activities`, `dailies`, `sleeps`, `hrv`, `deregistrations`…): cada entreno nuevo entra como una fila
 *      de `actividades` con `origen = 'garmin'` (el mismo camino que HealthKit: `lib/metricas/leeGarmin.js` → `preparaEntreno` → `construyeActividad`), y la
 *      recuperación diaria a `recuperacion_diaria`. Se contesta 200 enseguida (Garmin lo pide) y se procesa después.
 *   4. DESCONECTAR (la app: `POST { accion: 'desconectar' }`): le avisa a Garmin que ya no mande nada (`DELETE …/user/registration`) y borra la conexión.
 *   Y `POST { accion: 'estado' }`: si Garmin ya está listo (si hay llaves). Sin llaves, la app sigue diciendo «Pronto».
 *
 * Secretos (nunca en el repo): `GARMIN_CLIENT_ID` y `GARMIN_CLIENT_SECRET`, los de la app aprobada en el Garmin Connect Developer Program. Sin ellos todo contesta
 * «no disponible». Se despliega sin verificar JWT (Garmin no manda uno): la función revisa la sesión ella misma en `conectar`, `desconectar` y `estado`.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import * as leeGarmin from '../../../src/lib/metricas/leeGarmin.js'
import * as construye from '../../../src/lib/metricas/construye.js'
import * as calculos from '../../../src/lib/metricas/calculos.js'
import * as forma from '../../../src/lib/metricas/forma.js'

// Lo puro de la app (el mismo código que corre en el teléfono y en las pruebas). Es JavaScript: TypeScript adivina mal sus parámetros opcionales, así que va sin tipos.
// deno-lint-ignore no-explicit-any
const { entrenoDeGarmin, recuperacionDeGarmin } = leeGarmin as any
// deno-lint-ignore no-explicit-any
const { construyeActividad, preparaEntreno, separaRepetidos } = construye as any
// deno-lint-ignore no-explicit-any
const { estimaUmbrales } = calculos as any
// deno-lint-ignore no-explicit-any
const { pulsoEnReposoMediano, pulsoMaximoVisto } = forma as any

const AUTORIZA = 'https://connect.garmin.com/oauth2Confirm'
const TOKEN = 'https://connectapi.garmin.com/di-oauth2-service/oauth/token'
const API = 'https://apis.garmin.com/wellness-api/rest'
const APP = 'https://app.traininglabapp.com'
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

const json = (cuerpo: unknown, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { ...CORS, 'Content-Type': 'application/json' } })
const llaves = () => ({ id: Deno.env.get('GARMIN_CLIENT_ID') ?? '', secreto: Deno.env.get('GARMIN_CLIENT_SECRET') ?? '' })
const hayLlaves = () => { const k = llaves(); return !!(k.id && k.secreto) }
// La dirección a la que Garmin regresa: esta misma función. Se registra tal cual en el portal de Garmin.
const regreso = () => `${Deno.env.get('SUPABASE_URL')}/functions/v1/garmin`
// deno-lint-ignore no-explicit-any
const admin = (): any => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

const base64url = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const aleatorio = (n = 48) => base64url(crypto.getRandomValues(new Uint8Array(n)))
const reto = async (verificador: string) => base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificador))))

/** Quién llama desde la app (su sesión de Supabase), o `null`. */
async function quien(req: Request) {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data } = await admin().auth.getUser(token)
  return data?.user ?? null
}

/** Pide llaves a Garmin (`authorization_code` o `refresh_token`). */
async function pideLlaves(campos: Record<string, string>) {
  const k = llaves()
  const r = await fetch(TOKEN, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ ...campos, client_id: k.id, client_secret: k.secreto }) })
  if (!r.ok) throw new Error(`Garmin no dio las llaves (${r.status})`)
  return await r.json() as { access_token: string, refresh_token: string, expires_in: number, refresh_token_expires_in?: number }
}
const filaDeLlaves = (t: { access_token: string, refresh_token: string, expires_in: number, refresh_token_expires_in?: number }) => ({
  access_token: t.access_token, refresh_token: t.refresh_token,
  vence_en: new Date(Date.now() + (t.expires_in - 600) * 1000).toISOString(),
  refresh_vence_en: t.refresh_token_expires_in ? new Date(Date.now() + t.refresh_token_expires_in * 1000).toISOString() : null,
  actualizado_en: new Date().toISOString(),
})

/** Una llave vigente de esa persona (la renueva si ya venció). */
// deno-lint-ignore no-explicit-any
async function llaveVigente(db: any, conexion: any) {
  if (Date.parse(conexion.vence_en) > Date.now()) return conexion.access_token as string
  const t = await pideLlaves({ grant_type: 'refresh_token', refresh_token: conexion.refresh_token })
  await db.from('garmin_conexiones').update(filaDeLlaves(t)).eq('user_id', conexion.user_id)
  return t.access_token
}

/* ---------- 1. Conectar ---------- */
async function conectar(req: Request) {
  const usuario = await quien(req)
  if (!usuario) return json({ error: 'Inicia sesión otra vez.' }, 401)
  if (!hayLlaves()) return json({ codigo: 'NO_DISPONIBLE', error: 'Garmin todavía no está disponible. Pronto.' }, 503)
  const state = aleatorio(24)
  const verificador = aleatorio(48)
  const db = admin()
  // Los permisos a medias de más de una hora ya no sirven.
  await db.from('garmin_pendientes').delete().lt('creado_en', new Date(Date.now() - 3600000).toISOString())
  const { error } = await db.from('garmin_pendientes').insert({ state, user_id: usuario.id, code_verifier: verificador })
  if (error) return json({ error: 'No se pudo empezar la conexión.' }, 500)
  const url = new URL(AUTORIZA)
  url.search = new URLSearchParams({
    client_id: llaves().id, response_type: 'code', state, redirect_uri: regreso(), code_challenge: await reto(verificador), code_challenge_method: 'S256',
  }).toString()
  return json({ url: url.toString() })
}

/* ---------- 2. El regreso de Garmin ---------- */
async function alRegresar(params: URLSearchParams) {
  const vuelve = (estado: string) => Response.redirect(`${APP}/?garmin=${estado}`, 302)
  const code = params.get('code')
  const state = params.get('state')
  if (!code || !state || !hayLlaves()) return vuelve('error')
  const db = admin()
  const { data: pendiente } = await db.from('garmin_pendientes').select('*').eq('state', state).maybeSingle()
  if (!pendiente) return vuelve('error')
  await db.from('garmin_pendientes').delete().eq('state', state)
  try {
    const t = await pideLlaves({ grant_type: 'authorization_code', code, code_verifier: pendiente.code_verifier, redirect_uri: regreso() })
    const yo = await fetch(`${API}/user/id`, { headers: { Authorization: `Bearer ${t.access_token}` } }).then((r) => r.json())
    if (!yo?.userId) throw new Error('Garmin no dijo quién es')
    await db.from('garmin_conexiones').upsert({ user_id: pendiente.user_id, garmin_user_id: String(yo.userId), ...filaDeLlaves(t) }, { onConflict: 'user_id' })
    await db.from('dispositivos_conectados').upsert(
      { user_id: pendiente.user_id, proveedor: 'garmin', estado: 'conectado', conectado_en: new Date().toISOString(), detalle: { garmin_user_id: String(yo.userId) } },
      { onConflict: 'user_id,proveedor' },
    )
    return vuelve('conectado')
  } catch (e) {
    console.error('[garmin] regreso:', (e as Error).message)
    return vuelve('error')
  }
}

/* ---------- 3. Los avisos de Garmin ---------- */

/** Los umbrales del atleta para las zonas y la carga (lo mismo que `umbralesDe` en la app, sin lo que trae un archivo). */
// deno-lint-ignore no-explicit-any
async function umbralesDe(db: any, atletaId: string) {
  const hoy = new Date()
  const dia = (ms: number) => new Date(ms).toISOString().slice(0, 10)
  const [{ data: escritos }, { data: perfil }, { data: recientes }, { data: reposos }] = await Promise.all([
    db.from('umbrales_atleta').select('*').eq('atleta_id', atletaId).maybeSingle(),
    db.from('profiles').select('fecha_nacimiento,genero').eq('id', atletaId).maybeSingle(),
    db.from('actividades').select('inicio,desfase_min,fc_max').eq('atleta_id', atletaId).gte('inicio', `${dia(Date.now() - 180 * 86400000)}T00:00:00Z`).limit(1000),
    db.from('recuperacion_diaria').select('dia,fc_reposo').eq('atleta_id', atletaId).gte('dia', dia(Date.now() - 45 * 86400000)),
  ])
  const hoyDia = dia(Date.now())
  const umbrales = estimaUmbrales({
    configurados: escritos ?? {}, fechaNacimiento: perfil?.fecha_nacimiento ?? escritos?.fecha_nacimiento ?? null,
    observadoFcMax: pulsoMaximoVisto(recientes ?? [], { hoy: hoyDia }), reposoMediano: pulsoEnReposoMediano(reposos ?? [], { hoy: hoyDia }), hoy,
  })
  const genero = /^f/i.test(perfil?.genero ?? escritos?.genero ?? '') ? 'f' : 'm'
  return { umbrales, genero }
}

/** Los entrenos de un aviso, de UNA persona: los nuevos se guardan; los que ya estaban (por Garmin otra vez, o por Apple Salud) no se repiten. */
// deno-lint-ignore no-explicit-any
async function guardaEntrenos(db: any, atletaId: string, items: any[]) {
  const preparados = items.map((i) => entrenoDeGarmin(i)).filter(Boolean).map((c) => preparaEntreno(c))
  if (!preparados.length) return 0
  const desde = new Date(Math.min(...preparados.map((p) => p.inicio)) - 2 * 86400000).toISOString()
  const hasta = new Date(Math.max(...preparados.map((p) => p.inicio)) + 2 * 86400000).toISOString()
  const { data: existentes } = await db.from('actividades').select('id,inicio,duracion_s').eq('atleta_id', atletaId).gte('inicio', desde).lte('inicio', hasta)
  const { nuevos } = separaRepetidos(preparados, existentes ?? [])
  if (!nuevos.length) return 0
  const { umbrales, genero } = await umbralesDe(db, atletaId)
  let guardados = 0
  for (const p of nuevos) {
    const { fila, series } = construyeActividad(p, { umbrales, genero, desfaseMin: p.desfase_min ?? 0, origen: 'garmin' })
    const id = crypto.randomUUID()
    const { error } = await db.from('actividades').insert({ ...fila, id, atleta_id: atletaId, subido_por: atletaId })
    if (error) { if (error.code !== '23505') console.error('[garmin] entreno:', error.message); continue }
    if (series) await db.from('actividad_series').insert({ actividad_id: id, atleta_id: atletaId, series })
    guardados += 1
  }
  return guardados
}

// deno-lint-ignore no-explicit-any
async function atiendeAviso(cuerpo: any) {
  const db = admin()
  // Cada elemento trae el `userId` de Garmin: se busca de quién es. Lo de alguien que no está conectado se ignora.
  // deno-lint-ignore no-explicit-any
  const porPersona = new Map<string, Record<string, any[]>>()
  for (const tipo of ['activityDetails', 'activities', 'dailies', 'sleeps', 'hrv']) {
    for (const item of Array.isArray(cuerpo?.[tipo]) ? cuerpo[tipo] : []) {
      const uid = String(item?.userId ?? '')
      if (!uid) continue
      if (!porPersona.has(uid)) porPersona.set(uid, {})
      const de = porPersona.get(uid)!
      ;(de[tipo] ??= []).push(item)
    }
  }
  for (const [garminId, datos] of porPersona) {
    const { data: conexion } = await db.from('garmin_conexiones').select('user_id').eq('garmin_user_id', garminId).maybeSingle()
    if (!conexion) continue
    const atletaId = conexion.user_id
    // Si llegan el detalle y el resumen del mismo entreno, el detalle (con su ruta) gana: `separaRepetidos` se queda con el más rico.
    await guardaEntrenos(db, atletaId, [...(datos.activityDetails ?? []), ...(datos.activities ?? [])])
    for (const fila of recuperacionDeGarmin({ dailies: datos.dailies, sleeps: datos.sleeps, hrv: datos.hrv })) {
      const { error } = await db.from('recuperacion_diaria').upsert({ ...fila, atleta_id: atletaId, actualizada_en: new Date().toISOString() }, { onConflict: 'atleta_id,dia' })
      if (error) console.error('[garmin] recuperación:', error.message)
    }
    await db.from('dispositivos_conectados').update({ ultima_sincronizacion: new Date().toISOString(), estado: 'conectado' }).eq('user_id', atletaId).eq('proveedor', 'garmin')
  }
  // Quien quitó el permiso desde Garmin Connect: se borra su conexión.
  for (const d of Array.isArray(cuerpo?.deregistrations) ? cuerpo.deregistrations : []) {
    const { data: conexion } = await db.from('garmin_conexiones').select('user_id').eq('garmin_user_id', String(d?.userId ?? '')).maybeSingle()
    if (!conexion) continue
    await db.from('garmin_conexiones').delete().eq('user_id', conexion.user_id)
    await db.from('dispositivos_conectados').delete().eq('user_id', conexion.user_id).eq('proveedor', 'garmin')
  }
}

/* ---------- 4. Desconectar ---------- */
async function desconectar(req: Request) {
  const usuario = await quien(req)
  if (!usuario) return json({ error: 'Inicia sesión otra vez.' }, 401)
  const db = admin()
  const { data: conexion } = await db.from('garmin_conexiones').select('*').eq('user_id', usuario.id).maybeSingle()
  if (conexion && hayLlaves()) {
    try {
      // Le dice a Garmin que deje de mandar avisos de esta persona.
      const llave = await llaveVigente(db, conexion)
      const r = await fetch(`${API}/user/registration`, { method: 'DELETE', headers: { Authorization: `Bearer ${llave}` } })
      if (!r.ok && r.status !== 404) console.error('[garmin] baja:', r.status)
    } catch (e) {
      console.error('[garmin] baja:', (e as Error).message)
    }
  }
  await db.from('garmin_conexiones').delete().eq('user_id', usuario.id)
  await db.from('dispositivos_conectados').delete().eq('user_id', usuario.id).eq('proveedor', 'garmin')
  return json({ ok: true })
}

export async function manejar(req: Request): Promise<Response> {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  const url = new URL(req.url)
  if (req.method === 'GET') {
    if (url.searchParams.has('code') || url.searchParams.has('state') || url.searchParams.has('error')) return await alRegresar(url.searchParams)
    return json({ disponible: hayLlaves() })
  }
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  // deno-lint-ignore no-explicit-any
  let cuerpo: any = null
  try { cuerpo = await req.json() } catch { return json({ error: 'Cuerpo inválido' }, 400) }
  if (cuerpo?.accion === 'estado') return json({ disponible: hayLlaves() })
  if (cuerpo?.accion === 'conectar') return await conectar(req)
  if (cuerpo?.accion === 'desconectar') return await desconectar(req)
  // Un aviso de Garmin: se contesta 200 de inmediato y se procesa después (Garmin reintenta si tardamos).
  if (!hayLlaves()) return json({ ok: true })
  const trabajo = atiendeAviso(cuerpo).catch((e) => console.error('[garmin] aviso:', (e as Error).message))
  // deno-lint-ignore no-explicit-any
  const er = (globalThis as any).EdgeRuntime
  if (er?.waitUntil) er.waitUntil(trabajo)
  else await trabajo
  return json({ ok: true })
}
