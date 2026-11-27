/**
 * DESPUÉS DE PAGAR (encargo «Compra y dinero», 26 nov 2026). Una sola función para todo lo que pasa después del pago:
 *
 *   { sesion }  o  { llave }                  → cómo va la compra: «Compra confirmada · Fuerza 12 semanas · Carlos Ruiz», a qué correo se mandó el recibo, si ya tiene cuenta.
 *                                                `sesion`: la llave del pago (`cs_…`, en la liga a la que regresa Stripe). `llave`: la de la liga del correo «Crear mi cuenta».
 *   { sesion | llave, reclamar: true } + sesión → la cuenta con sesión se queda la compra. UNA sola vez y solo con una llave vigente (48 h). Ver `reclamo.js`.
 *   { sesion | llave, crear_cuenta: { usuario, contrasena } } → «Crear usuario y contraseña»: crea la cuenta de atleta con el correo DEL PAGO (no se pide otro) y le
 *                                                guarda la compra en el mismo paso. Si ese correo ya tiene cuenta: «Ese correo ya tiene cuenta. Entra con ella y tu compra se guarda ahí.»
 *   { sesion | llave, reenviar: true }         → «Mandarme otra liga»: liga nueva de 48 h, SOLO al correo del pago (nunca a uno que mande el navegador).
 *   { compra_id, datos_entrada: true } + sesión → lo que necesita «¿Cuándo empiezas?»: semanas del plan y las que el coach permite.
 *   { compra_id, entrada: { inicio, semana, fecha_meta } } + sesión → guarda cuándo empieza y desde qué semana (también «Volver a empezar»).
 *
 * Quien paga en la web ya no recibe una cuenta hecha con su correo: la compra queda apartada sin dueño hasta que la reclama una cuenta (Apple, Google o usuario y contraseña).
 * Sin una llave buena no dice nada de nadie.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { MENSAJES, VIGENCIA_MS, hashDeLlave, llaveNueva, puedeReclamar } from './reclamo.js'
import { entradaDeCorrido, posicionDeCorrido, semanasPermitidas, tieneEntrada, totalDeSemanas } from './entradaAlPlan.js'

// Lista cerrada de sitios propios (lote 1 de seguridad, oct 2026): YA NO vale cualquier *.vercel.app.
// Se suman, si existen, los secretos SITIO_URL, ALLOWED_ORIGINS y ORIGENES_EXTRA (separados por coma).
const ORIGENES_PROPIOS = new Set<string>([
  'http://localhost:5173', 'capacitor://localhost' /* app de iPhone (Capacitor) */, 'http://localhost:4173', 'http://127.0.0.1:5173',
  'https://app.traininglabapp.com',
  'https://training-program-kappa.vercel.app', // despliegue anterior en Vercel (mismo dueño); quitar cuando se apague
  ...[Deno.env.get('SITIO_URL'), ...(Deno.env.get('ALLOWED_ORIGINS') ?? '').split(','), ...(Deno.env.get('ORIGENES_EXTRA') ?? '').split(',')]
    .map((o) => (o ?? '').trim().replace(/\/+$/, ''))
    .filter(Boolean),
])
const SITIO = (Deno.env.get('SITIO_URL') ?? 'https://app.traininglabapp.com').replace(/\/+$/, '')
const SESION_RE = /^cs_(test|live)_[A-Za-z0-9]{8,200}$/
const LLAVE_RE = /^[0-9a-f]{64}$/
const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/

const permitido = (origen: string | null) => {
  if (!origen) return SITIO
  return ORIGENES_PROPIOS.has(origen) ? origen : SITIO
}
const cabeceras = (origen: string | null): Record<string, string> => ({
  'Access-Control-Allow-Origin': permitido(origen),
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
})
const json = (cuerpo: unknown, estado: number, origen: string | null) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cabeceras(origen) } })

// deno-lint-ignore no-explicit-any
type Obj = any
const bd = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
const CAMPOS = 'id, estado, tipo, canal, atleta_id, coach_id, vitrina_plan_id, version_n, correo_comprador, pagada_en, creada_en, llave_correo_vence, correo_crear_cuenta_en, periodo_hasta, inicio, fase_de_entrada, semana_de_entrada, fecha_meta, entrada_elegida_en'

/** La compra que abre esta llave (la del pago o la del correo), y por cuál vino. */
async function compraDeLlave(p: Obj): Promise<{ c: Obj | null; via: 'pago' | 'correo' | null }> {
  const sesion = String(p.sesion ?? '').trim()
  const llave = String(p.llave ?? '').trim().toLowerCase()
  if (SESION_RE.test(sesion)) {
    const { data, error } = await bd.from('compras').select(CAMPOS).eq('stripe_checkout_session_id', sesion).maybeSingle()
    if (error) throw error
    return { c: data, via: 'pago' }
  }
  if (LLAVE_RE.test(llave)) {
    const { data, error } = await bd.from('compras').select(CAMPOS).eq('llave_correo_hash', await hashDeLlave(llave)).maybeSingle()
    if (error) throw error
    return { c: data, via: 'correo' }
  }
  return { c: null, via: null }
}

async function quienEs(req: Request): Promise<{ id: string; rol: string } | null> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return null
  const { data } = await bd.auth.getUser(token)
  const id = data?.user?.id
  if (!id) return null
  const { data: perfil } = await bd.from('profiles').select('role, is_active').eq('id', id).maybeSingle()
  if (!perfil || perfil.is_active === false) return null
  return { id, rol: perfil.role }
}

/** «di•••@gmail.com»: a quien tiene la llave se le dice a dónde llegó su recibo, sin el correo completo (la liga puede reenviarse). */
const correoTapado = (correo: string | null) => {
  if (!correo) return null
  const [nombre, dominio] = correo.split('@')
  return dominio ? `${nombre.slice(0, 2)}•••@${dominio}` : null
}

async function laFicha(c: Obj) {
  const [{ data: plan }, { data: coach }] = await Promise.all([
    bd.from('vitrina_planes').select('titulo, foto_url, slug, contenido, chat, tecnica, entrada_modo, entrada_semanas').eq('id', c.vitrina_plan_id).maybeSingle(),
    c.coach_id ? bd.from('profiles').select('username, full_name, avatar_url').eq('id', c.coach_id).maybeSingle() : Promise.resolve({ data: null }),
  ])
  return { plan, coach }
}

/** La versión que compró (sus fases) y las reglas de entrada que puso el coach. */
async function entradaDeLaCompra(c: Obj) {
  const { plan } = await laFicha(c)
  const { data: ver } = await bd.from('vitrina_versiones').select('data').eq('vitrina_plan_id', c.vitrina_plan_id).eq('n', c.version_n).maybeSingle()
  const fases = Array.isArray(ver?.data?.phases) ? ver.data.phases : []
  const kind = ver?.data?.kind ?? 'periodized'
  const conEntrada = tieneEntrada({ contenido: plan?.contenido ?? 'programa', kind, fases })
  const permitidas = conEntrada ? semanasPermitidas(fases, { modo: plan?.entrada_modo ?? 'semana_1', semanas: plan?.entrada_semanas ?? [1] }) : [1]
  return { plan, fases, kind, conEntrada, permitidas, total: totalDeSemanas(fases) }
}

Deno.serve(async (req) => {
  const origen = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabeceras(origen) })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origen)

  let p: Obj
  try { p = await req.json() } catch { return json({ error: 'Datos inválidos.' }, 400, origen) }

  try {
    /* ---------- ¿Cuándo empiezas? (con sesión, sobre una compra suya) ---------- */
    if (p.compra_id && (p.datos_entrada || p.entrada)) {
      const yo = await quienEs(req)
      if (!yo) return json({ error: 'Vuelve a entrar a tu cuenta.' }, 401, origen)
      const { data: c, error } = await bd.from('compras').select(CAMPOS).eq('id', String(p.compra_id)).eq('atleta_id', yo.id).maybeSingle()
      if (error) throw error
      if (!c) return json({ error: MENSAJES.desconocida }, 404, origen)
      const e = await entradaDeLaCompra(c)
      if (p.datos_entrada) {
        const { coach } = await laFicha(c)
        return json({
          titulo: e.plan?.titulo ?? 'Tu plan', coach: coach ? { usuario: coach.username, nombre: coach.full_name } : null,
          tipo: c.tipo, canal: c.canal, total: e.total, con_entrada: e.conEntrada, permitidas: e.permitidas,
          inicio: c.inicio, semana: c.fase_de_entrada ? posicionDeCorrido(e.fases, c.fase_de_entrada, c.semana_de_entrada) || 1 : 1,
          fecha_meta: c.fecha_meta, elegida: !!c.entrada_elegida_en, comprada_en: c.pagada_en ?? c.creada_en,
        }, 200, origen)
      }
      if (!['activa', 'gracia'].includes(c.estado)) return json({ error: 'Este plan ya no está activo.' }, 400, origen)
      const inicio = String(p.entrada?.inicio ?? '')
      if (!FECHA_RE.test(inicio)) return json({ error: 'Falta el día en que empiezas.' }, 400, origen)
      // Hoy o el lunes que viene (con un día de margen por el huso horario de quien lo elige).
      const dias = Math.round((Date.parse(`${inicio}T00:00:00Z`) - Date.parse(`${new Date().toISOString().slice(0, 10)}T00:00:00Z`)) / 86400000)
      if (dias < -1 || dias > 8) return json({ error: 'Elige hoy o el lunes que viene.' }, 400, origen)
      const semana = e.conEntrada ? Math.floor(Number(p.entrada?.semana ?? 1)) : 1
      if (!e.permitidas.includes(semana)) return json({ error: 'Tu coach no deja empezar en esa semana.' }, 400, origen)
      const fechaMeta = e.conEntrada && p.entrada?.fecha_meta && FECHA_RE.test(String(p.entrada.fecha_meta)) ? String(p.entrada.fecha_meta) : null
      const donde = e.fases.length ? entradaDeCorrido(e.fases, semana) : null
      const { error: errGuarda } = await bd.from('compras').update({
        inicio, fase_de_entrada: donde?.faseId ?? null, semana_de_entrada: donde?.semana ?? null, fecha_meta: fechaMeta,
        entrada_elegida_en: new Date().toISOString(), actualizada_en: new Date().toISOString(),
      }).eq('id', c.id)
      if (errGuarda) throw errGuarda
      return json({ ok: true }, 200, origen)
    }

    /* ---------- Con la llave del pago o la del correo ---------- */
    const { c, via } = await compraDeLlave(p)
    if (!c || !via) return json({ estado: 'desconocida' }, 404, origen)
    const { plan, coach } = await laFicha(c)
    const yo = await quienEs(req)

    if (p.reenviar) {
      // Solo si nadie la ha reclamado. La liga va al correo del pago, no a uno que mande el navegador. Una cada 2 minutos.
      if (c.atleta_id) return json({ error: MENSAJES.ya_usada, codigo: 'ya_usada' }, 409, origen)
      if (!c.correo_comprador) return json({ error: 'Esta compra no tiene correo.' }, 400, origen)
      if (c.correo_crear_cuenta_en && Date.now() - new Date(c.correo_crear_cuenta_en).getTime() < 120_000) return json({ ok: true, correo: correoTapado(c.correo_comprador) }, 200, origen)
      const llave = llaveNueva()
      const { error } = await bd.from('compras').update({
        llave_correo_hash: await hashDeLlave(llave), llave_correo_vence: new Date(Date.now() + VIGENCIA_MS).toISOString(), correo_crear_cuenta_en: new Date().toISOString(),
      }).eq('id', c.id).is('atleta_id', null)
      if (error) throw error
      await mandaLiga(c.correo_comprador, plan?.titulo ?? 'tu plan', llave)
      return json({ ok: true, correo: correoTapado(c.correo_comprador) }, 200, origen)
    }

    if (p.crear_cuenta) {
      const r = puedeReclamar(c, { via })
      if (!r.ok) return json({ error: MENSAJES[r.motivo as keyof typeof MENSAJES], codigo: r.motivo }, 403, origen)
      const correo = String(c.correo_comprador ?? '').trim().toLowerCase()
      if (!correo) return json({ error: 'Esta compra no tiene correo. Entra con Apple o Google.' }, 400, origen)
      const usuario = String(p.crear_cuenta.usuario ?? '').trim().toLowerCase().replace(/^@/, '')
      const contrasena = String(p.crear_cuenta.contrasena ?? '')
      if (!/^[a-z0-9._]{3,30}$/.test(usuario)) return json({ error: 'Tu usuario lleva de 3 a 30 letras, números, punto o guion bajo.', codigo: 'usuario' }, 400, origen)
      const problema = problemaDeContrasena(contrasena, correo)
      if (problema) return json({ error: problema, codigo: 'contrasena' }, 400, origen)
      const { data: ocupado } = await bd.from('profiles').select('id').eq('username', usuario).maybeSingle()
      if (ocupado) return json({ error: 'Ese usuario ya existe. Prueba con otro.', codigo: 'usuario_ocupado' }, 409, origen)
      const { data: yaHay } = await bd.rpc('usuario_por_correo', { p_correo: correo })
      if (Array.isArray(yaHay) ? yaHay.length : yaHay) return json({ error: MENSAJES.correo_ocupado, codigo: 'correo_ocupado' }, 409, origen)
      const { data: nuevo, error: errNuevo } = await bd.auth.admin.createUser({ email: correo, password: contrasena, email_confirm: true, user_metadata: { username: usuario, role: 'user' } })
      if (errNuevo || !nuevo?.user) return json({ error: /registered|exists/i.test(errNuevo?.message ?? '') ? MENSAJES.correo_ocupado : 'No se pudo crear tu cuenta. Inténtalo otra vez.', codigo: 'no_se_creo' }, 409, origen)
      await bd.from('profiles').update({ role: 'user', username: usuario }).eq('id', nuevo.user.id)
      const { data: hecha } = await bd.from('compras').update({
        atleta_id: nuevo.user.id, reclamada_por: nuevo.user.id, reclamada_en: new Date().toISOString(), estado: 'activa',
        inicio: c.inicio ?? new Date(Date.now() - 12 * 3600 * 1000).toISOString().slice(0, 10), llave_correo_hash: null, actualizada_en: new Date().toISOString(),
      }).eq('id', c.id).is('atleta_id', null).select('id')
      if (!hecha?.length) return json({ error: MENSAJES.ya_usada, codigo: 'ya_usada' }, 403, origen)
      return json({ ok: true, compra_id: c.id, usuario }, 200, origen)
    }

    if (p.reclamar) {
      if (!yo) return json({ error: 'Entra o crea tu cuenta para guardar tu compra.' }, 401, origen)
      const r = puedeReclamar(c, { usuarioId: yo.id, rol: yo.rol, via })
      if (!r.ok) return json({ error: MENSAJES[r.motivo as keyof typeof MENSAJES], codigo: r.motivo }, r.motivo === 'no_pagada' ? 409 : 403, origen)
      if (r.yaEsTuya) return json({ ok: true, compra_id: c.id }, 200, origen)
      // Una membresía cuyo periodo ya pasó se reclama igual (es suya), pero vencida.
      const vencida = c.tipo === 'membresia' && c.periodo_hasta && new Date(c.periodo_hasta).getTime() < Date.now()
      const { data: hecha, error } = await bd.from('compras').update({
        atleta_id: yo.id, reclamada_por: yo.id, reclamada_en: new Date().toISOString(), estado: vencida ? 'vencida' : 'activa',
        inicio: c.inicio ?? new Date(Date.now() - 12 * 3600 * 1000).toISOString().slice(0, 10), llave_correo_hash: null, actualizada_en: new Date().toISOString(),
      }).eq('id', c.id).is('atleta_id', null).select('id')
      if (error) throw error
      if (!hecha?.length) return json({ error: MENSAJES.ya_usada, codigo: 'ya_usada' }, 403, origen) // otra cuenta ganó en el mismo instante
      return json({ ok: true, compra_id: c.id }, 200, origen)
    }

    const vence = via === 'correo' ? new Date(c.llave_correo_vence ?? 0).getTime() : (c.pagada_en ? new Date(c.pagada_en).getTime() + VIGENCIA_MS : Infinity)
    return json({
      estado: c.pagada_en || c.atleta_id ? (c.estado === 'pendiente' ? 'pagada' : c.estado) : 'confirmando',
      titulo: plan?.titulo ?? 'Tu plan', foto: plan?.foto_url ?? null, tipo: c.tipo,
      coach: coach ? { usuario: coach.username, nombre: coach.full_name, foto: coach.avatar_url } : null,
      correo: c.atleta_id ? null : correoTapado(c.correo_comprador),
      reclamada: !!c.atleta_id, es_tuya: !!yo && c.atleta_id === yo.id, vencida: !c.atleta_id && !(vence > Date.now()),
      compra_id: yo && c.atleta_id === yo.id ? c.id : null,
    }, 200, origen)
  } catch (e) {
    console.error('compra-lista falló:', e instanceof Error ? e.message : e)
    return json({ error: 'No se pudo leer tu compra. Inténtalo otra vez.' }, 500, origen)
  }
})

/** Lo que hace falta para aceptar una contraseña (la app dice lo mismo en `lib/contrasena.js`). */
function problemaDeContrasena(c: string, correo: string): string | null {
  if (c.length < 8) return 'Usa al menos 8 caracteres.'
  if (c.length > 72) return 'Usa un máximo de 72 caracteres.'
  if (/^\d+$/.test(c)) return 'No puede ser solo números.'
  if (/^(.)\1+$/.test(c)) return 'No puede ser el mismo carácter repetido.'
  if (correo && c.toLowerCase() === correo.toLowerCase()) return 'No uses tu correo como contraseña.'
  return null
}

/** «Mandarme otra liga»: el mismo correo que manda `stripe-webhook` al pagar, con la liga nueva. Si no sale, se anota y la persona puede volver a pedirla. */
async function mandaLiga(correo: string, plan: string, llave: string) {
  const llaveResend = (Deno.env.get('RESEND_API_KEY') ?? Deno.env.get('SMTP_PASSWORD') ?? '').trim()
  if (!llaveResend) { console.error('compra-lista: sin llave de Resend, no salió la liga'); return }
  const escapa = (x: string) => x.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const url = `${SITIO}/compra/lista?l=${llave}`
  const titulo = `Tu compra de ${plan} está lista`
  const html = `<!doctype html><html><body style="margin:0;background:#f4f5f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111318">
  <div style="max-width:460px;margin:0 auto;padding:32px 20px"><div style="background:#ffffff;border-radius:20px;padding:32px 28px;border:1px solid #e6e8ee">
  <div style="font-size:22px;font-weight:800;letter-spacing:-0.4px">Training <span style="color:#1E40E0">Lab</span></div>
  <p style="font-size:18px;font-weight:800;margin:22px 0 12px">${escapa(titulo)}</p>
  <p style="font-size:15px;line-height:1.5;color:#3d4250;margin:0 0 12px">Crea tu cuenta para entrar. La liga dura 48 horas.</p>
  <p style="margin:20px 0 8px"><a href="${escapa(url)}" style="display:inline-block;background:#1E40E0;color:#ffffff;text-decoration:none;font-weight:800;font-size:16px;padding:14px 22px;border-radius:14px">Crear mi cuenta</a></p>
  </div></div></body></html>`
  const remitente = (Deno.env.get('CORREO_REMITENTE') ?? 'Training Lab <no-reply@traininglabapp.com>').trim()
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${llaveResend}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: remitente, to: [correo], subject: titulo, html, text: `${titulo}\n\nCrea tu cuenta para entrar. La liga dura 48 horas.\n\nCrear mi cuenta: ${url}` }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!r.ok) console.error('compra-lista: la liga no salió', r.status, (await r.text()).slice(0, 160))
}
