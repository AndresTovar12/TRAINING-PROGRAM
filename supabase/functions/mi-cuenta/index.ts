import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Lo que cada persona puede hacer con SU cuenta desde la app (15 oct 2026): ver qué se llevaría borrarla, descargar sus datos y eliminarla.
 *
 * POR QUÉ EXISTE. Apple exige que quien puede crear una cuenta pueda iniciar su eliminación desde la propia app, sin escribirle a nadie. Y la ley de datos
 * personales (México, LFPDPPP) da derecho a acceder a los propios datos y a cancelarlos. Antes solo el administrador podía borrar cuentas (`admin-delete-user`).
 *
 *   { accion: 'resumen' }                                → qué pasaría: cuántos atletas, compras activas, si tiene contraseña.
 *   { accion: 'exportar' }                               → todos sus datos en un JSON para descargar.
 *   { accion: 'eliminar', confirmacion: 'ELIMINAR', contrasena? } → borra la cuenta DEFINITIVAMENTE.
 *
 * LO QUE IMPIDE BORRAR: ser el dueño; tener una membresía comprada que sigue activa (primero se cancela) y, siendo profesional, tener compradores con membresía activa.
 * Se pide la contraseña (si la cuenta tiene una) Y escribir ELIMINAR: una sesión olvidada abierta no basta.
 *
 * QUÉ SE LLEVA: la persona, sus planes, sus sesiones marcadas, sus mensajes y sus compras. Si es profesional: sus ejercicios y plantillas, y sus atletas se quedan SIN coach
 * (sus cuentas y sus planes siguen intactos). Ver el mismo trato en `admin-delete-user`.
 * TRAMPA CONOCIDA (docs en la memoria del proyecto): borrar una cuenta con planes falla si los planes caen en cascada (el historial intenta guardar la versión de una persona
 * que ya no existe); por eso los planes se borran ANTES, con la cuenta todavía viva.
 */

const DEFAULT_ORIGINS = ['http://localhost:5173', 'capacitor://localhost' /* app de iPhone (Capacitor) */, 'http://localhost:4173', 'http://127.0.0.1:5173', 'https://app.traininglabapp.com']

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

function corsHeaders(origin: string | null): Record<string, string> {
  let allow = DEFAULT_ORIGINS[0]
  if (origin) {
    try {
      if (ORIGENES_PROPIOS.has(origin)) allow = origin
    } catch { /* origen malformado */ }
  }
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(origin) } })
}

const VIVAS = ['activa', 'gracia']

/* Comprobar la contraseña con /auth/v1/token ABRE una sesión de verdad que nadie cerraba (auditoría p134: 384 sesiones acumuladas).
   Se cierra enseguida, SOLO esa (`scope=local`: no toca las demás sesiones de la persona). Si no se puede cerrar, no es motivo para fallar. */
async function cierraLaSesionDeLaPrueba(urlSb: string, prueba: Response) {
  try {
    const t = (await prueba.clone().json())?.access_token
    if (typeof t !== 'string' || !t) return
    await fetch(`${urlSb}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '', Authorization: `Bearer ${t}` },
      signal: AbortSignal.timeout(5_000),
    })
  } catch { /* se queda como estaba */ }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origin)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Falta tu sesión. Vuelve a entrar.' }, 401, origin)

  const URL_SB = Deno.env.get('SUPABASE_URL')!
  const bd = createClient(URL_SB, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: sesion, error: errSesion } = await bd.auth.getUser(token)
  const usuario = sesion?.user
  if (errSesion || !usuario) return json({ error: 'Tu sesión expiró. Vuelve a entrar.' }, 401, origin)
  const yo = usuario.id

  let p: { accion?: string; confirmacion?: string; contrasena?: string }
  try { p = await req.json() } catch { return json({ error: 'JSON inválido' }, 400, origin) }

  const { data: perfil } = await bd.from('profiles').select('*').eq('id', yo).maybeSingle()
  if (!perfil) return json({ error: 'No encontramos tu perfil.' }, 404, origin)
  const esCoach = perfil.role === 'admin'
  const tieneContrasena = ((usuario.app_metadata?.providers as string[] | undefined) ?? ['email']).includes('email')

  const cuenta = async (tabla: string, col: string, vivas = true) => {
    let q = bd.from(tabla).select('id', { count: 'exact', head: true }).eq(col, yo)
    if (vivas) q = q.in('estado', VIVAS)
    const { count } = await q
    return count ?? 0
  }

  if (p.accion === 'resumen') {
    return json({
      es_coach: esCoach,
      es_dueno: !!perfil.is_owner,
      tiene_contrasena: tieneContrasena,
      atletas: esCoach ? await cuenta('profiles', 'coach_id', false) : 0,
      membresias_activas: await cuenta('compras', 'atleta_id'),
      compradores_activos: esCoach ? await cuenta('compras', 'coach_id') : 0,
    }, 200, origin)
  }

  if (p.accion === 'exportar') {
    const errores: string[] = []
    const leer = async (nombre: string, tabla: string, filtro: (q: any) => any, columnas = '*') => {
      const { data, error } = await filtro(bd.from(tabla).select(columnas)).limit(5000)
      if (error) { errores.push(`${nombre}: ${error.message}`); return [] }
      return data ?? []
    }
    // El perfil sin las marcas internas de permisos.
    const { is_owner: _a, limite_atletas: _b, comision_especial: _c, vitrina_suspendida: _d, ...perfilPublico } = perfil
    const datos = {
      generado_en: new Date().toISOString(),
      nota: 'Estos son los datos que Training Lab guarda de tu cuenta.',
      cuenta: { id: yo, correo: usuario.email ?? null, creada_en: usuario.created_at, ultimo_acceso: usuario.last_sign_in_at ?? null, proveedores: usuario.app_metadata?.providers ?? [] },
      perfil: perfilPublico,
      estado_de_la_app: await leer('estado', 'user_app_state', (q) => q.eq('user_id', yo)),
      planes: await leer('planes', 'plans', (q) => q.eq('user_id', yo)),
      rutinas: await leer('rutinas', 'user_routines', (q) => q.eq('user_id', yo)),
      equipo: await leer('equipo', 'equipo', (q) => q.or(`atleta_id.eq.${yo},profesional_id.eq.${yo}`)),
      compras: await leer('compras', 'compras', (q) => q.or(`atleta_id.eq.${yo},coach_id.eq.${yo}`)),
      mensajes: await leer('mensajes', 'mensajes', (q) => q.or(`atleta_id.eq.${yo},profesional_id.eq.${yo}`)),
      tecnicas: await leer('técnicas', 'tecnicas', (q) => q.or(`atleta_id.eq.${yo},profesional_id.eq.${yo}`)),
      ejercicios_propios: esCoach ? await leer('ejercicios', 'exercises', (q) => q.eq('created_by', yo)) : [],
      plantillas: esCoach ? await leer('plantillas', 'routine_templates', (q) => q.eq('created_by', yo)) : [],
      programas_guardados: esCoach ? await leer('programas', 'programas_guardados', (q) => q.eq('created_by', yo)) : [],
      vitrina: esCoach ? await leer('vitrina', 'vitrina_planes', (q) => q.eq('coach_id', yo)) : [],
      ...(errores.length ? { no_se_pudo_leer: errores } : {}),
    }
    return json(datos, 200, origin)
  }

  if (p.accion === 'eliminar') {
    if (perfil.is_owner) return json({ error: 'La cuenta del administrador no se elimina desde aquí.' }, 403, origin)
    if (String(p.confirmacion ?? '').trim().toUpperCase() !== 'ELIMINAR') return json({ error: 'Escribe ELIMINAR para confirmar.', codigo: 'FALTA_CONFIRMACION' }, 400, origin)

    if (tieneContrasena) {
      const contrasena = String(p.contrasena ?? '')
      if (!contrasena) return json({ error: 'Escribe tu contraseña.', codigo: 'FALTA_CONTRASENA' }, 400, origin)
      const prueba = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: String(usuario.email ?? '').toLowerCase(), password: contrasena }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null)
      if (!prueba) return json({ error: 'No se pudo comprobar tu contraseña. Inténtalo de nuevo.' }, 502, origin)
      if (prueba.status === 429) return json({ error: 'Demasiados intentos. Espera un momento.' }, 429, origin)
      if (!prueba.ok) return json({ error: 'La contraseña no es correcta.', codigo: 'CONTRASENA_MAL' }, 400, origin)
      await cierraLaSesionDeLaPrueba(URL_SB, prueba)
    }

    if (await cuenta('compras', 'atleta_id') > 0) {
      return json({ error: 'Tienes una membresía activa. Cancélala antes de eliminar tu cuenta; si no sabes cómo, escríbenos a contacto@traininglabapp.com.', codigo: 'MEMBRESIA_ACTIVA' }, 409, origin)
    }
    if (esCoach && await cuenta('compras', 'coach_id') > 0) {
      return json({ error: 'Tienes compradores con una membresía activa. No se puede eliminar tu cuenta hasta que terminen o se cancelen; escríbenos a contacto@traininglabapp.com.', codigo: 'COMPRADORES_ACTIVOS' }, 409, origin)
    }

    // Un profesional: sus atletas se quedan sin coach (sus cuentas y planes siguen) y lo suyo se va con él.
    if (esCoach) {
      await bd.from('profiles').update({ coach_id: null }).eq('coach_id', yo)
      await bd.from('exercise_media').delete().eq('created_by', yo)
      await bd.from('exercises').delete().eq('created_by', yo)
    }
    // Los planes ANTES que la cuenta (ver la trampa arriba).
    const { error: errPlanes } = await bd.from('plans').delete().eq('user_id', yo)
    if (errPlanes) {
      console.error('mi-cuenta: borrar planes falló:', errPlanes.message)
      return json({ error: 'No se pudo eliminar tu cuenta. Inténtalo de nuevo o escríbenos a contacto@traininglabapp.com.' }, 500, origin)
    }
    const { error: errAuth } = await bd.auth.admin.deleteUser(yo)
    if (errAuth) {
      console.error('mi-cuenta: deleteUser falló:', errAuth.message)
      return json({ error: 'No se pudo eliminar tu cuenta. Inténtalo de nuevo o escríbenos a contacto@traininglabapp.com.' }, 500, origin)
    }
    return json({ ok: true }, 200, origin)
  }

  return json({ error: 'Acción desconocida' }, 400, origin)
})
