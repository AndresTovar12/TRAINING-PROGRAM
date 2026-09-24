import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * El otro lado del link de invitación: lo que pasa cuando el atleta lo abre.
 *
 * Tiene dos modos porque son dos momentos distintos:
 *   ver     -> antes de llenar nada, para saludarlo por su nombre y decirle
 *              quién es su coach. Si no, el link sería una pantalla en blanco
 *              pidiendo datos, y nadie sabe si es de fiar.
 *   activar -> ya con su usuario y su contraseña.
 *
 * Quien abre el link NO tiene sesión todavía, así que todo pasa por aquí con
 * la llave de servicio. Por eso se devuelve lo mínimo: el nombre que puso el
 * coach y el del coach. Nunca el correo ni nada más de esa cuenta.
 *
 * El link no vence por tiempo (decisión de Andrés, 24 sep 2026). Deja de
 * servir por tres caminos, todos en manos del coach o del propio uso:
 *   - ya se usó
 *   - el coach desactivó al atleta
 *   - el coach eliminó al atleta (la invitación se borra en cascada)
 */

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
]
const envOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const ALLOWED = new Set([...DEFAULT_ORIGINS, ...envOrigins])

function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    origin && (ALLOWED.has(origin) || /\.vercel\.app$/.test(new URL(origin).hostname))
      ? origin
      : DEFAULT_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

function textoDeError(e: unknown): string {
  if (!e) return 'Error desconocido'
  if (typeof e === 'string') return e
  const any = e as Record<string, unknown>
  for (const campo of ['message', 'msg', 'error_description', 'error', 'details', 'hint']) {
    const v = any[campo]
    if (typeof v === 'string' && v.trim() && v.trim() !== '{}') return v
  }
  return String(e)
}

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/
const CADUCO = 'Este link ya no sirve. Pídele uno nuevo a tu entrenador.'

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origin)

  let p: {
    token?: string; modo?: string; username?: string
    password?: string; email?: string; genero?: string
    nombre?: string; apellido?: string
  }
  try {
    p = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400, origin)
  }

  const token = (p.token ?? '').trim()
  const modo = (p.modo ?? 'ver').trim()
  if (!token) return json({ error: 'Falta el link' }, 400, origin)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: inv } = await admin
    .from('invitaciones')
    .select('token, coach_id, atleta_id, tipo, usada_en, nombre, apellido')
    .eq('token', token)
    .maybeSingle()

  if (!inv || inv.usada_en) return json({ error: CADUCO }, 404, origin)
  if (!inv.atleta_id) return json({ error: CADUCO }, 404, origin)

  const { data: atleta } = await admin
    .from('profiles')
    .select('id, full_name, username, is_active, perfil_completo')
    .eq('id', inv.atleta_id)
    .maybeSingle()

  // Desactivado por el coach, o ya activado por el propio atleta.
  if (!atleta || atleta.is_active === false) return json({ error: CADUCO }, 404, origin)
  if (atleta.perfil_completo === true) return json({ error: CADUCO }, 404, origin)

  const { data: coach } = await admin
    .from('profiles')
    .select('full_name, username')
    .eq('id', inv.coach_id)
    .maybeSingle()

  const coachNombre = coach?.full_name || coach?.username || 'tu entrenador'

  if (modo === 'ver') {
    /* Se manda el nombre y el apellido por separado, para enseñárselos ya
       puestos y que los pueda corregir.

       NO se manda ningún usuario sugerido, a propósito. Andrés, 24 sep 2026:
       "eliges por el cliente su usuario, justo eso es lo que le tienes que
       dejar a él que elija". Lo que se llena por él es su nombre, que el coach
       ya sabe; el usuario es cosa suya. */
    /* Respaldo para las invitaciones hechas antes de guardar las dos columnas:
       se parte el nombre completo por el primer espacio. Es una apuesta —de
       "Ana María Pérez" saldría nombre "Ana"— pero el atleta tiene los dos
       campos delante y los puede corregir, que era justamente el punto. Solo
       aplica a las invitaciones viejas; las nuevas traen el dato exacto. */
    let nombre = inv.nombre
    let apellido = inv.apellido
    if (!nombre) {
      const partes = (atleta.full_name || '').trim().split(/\s+/)
      nombre = partes.shift() || ''
      apellido = partes.join(' ')
    }

    return json({
      ok: true,
      nombre: nombre || '',
      apellido: apellido || '',
      coach: coachNombre,
    }, 200, origin)
  }

  if (modo !== 'activar') return json({ error: 'Modo desconocido' }, 400, origin)

  const username = (p.username ?? '').trim()
  const password = p.password ?? ''
  const email = (p.email ?? '').trim().toLowerCase()
  // El atleta puede corregir lo que puso el coach. Si lo deja tal cual llega
  // igual, así que no hay que distinguir un caso del otro.
  const nombre = (p.nombre ?? '').trim().slice(0, 60)
  const apellido = (p.apellido ?? '').trim().slice(0, 60)
  const nombreFinal = [nombre, apellido].filter(Boolean).join(' ') || atleta.full_name
  const generoCrudo = (p.genero ?? '').trim().toLowerCase()
  const genero = generoCrudo === 'h' || generoCrudo === 'm' ? generoCrudo : null

  if (!USERNAME_RE.test(username)) {
    return json({ error: 'El usuario debe tener 3-30 caracteres (letras, números, _ o .)' }, 400, origin)
  }
  if (password.length < 6) {
    return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400, origin)
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'Correo inválido' }, 400, origin)
  }

  // Usuario libre. Se excluye el suyo propio: el coach ya le reservó uno al
  // darlo de alta, y si lo deja tal cual no debe chocar consigo mismo.
  const { data: tomado } = await admin
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .neq('id', atleta.id)
    .maybeSingle()
  if (tomado) return json({ error: 'Ese nombre de usuario ya está en uso' }, 409, origin)

  // Sin correo propio se deja uno de relleno, igual que en `signup`. Sirve
  // para que la cuenta tenga la forma que espera el sistema de acceso; para
  // recuperar la contraseña no vale, y por eso la pantalla se lo advierte.
  const correoFinal = email || `${username.toLowerCase()}@traininglab.app`

  const { error: errAuth } = await admin.auth.admin.updateUserById(atleta.id, {
    email: correoFinal,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: nombreFinal, role: 'user' },
  })
  if (errAuth) {
    const crudo = textoDeError(errAuth)
    console.error('updateUserById falló:', crudo)
    const msg = /already|exists|duplicate/i.test(crudo)
      ? 'Ese correo ya está registrado. Usa otro, o déjalo vacío.'
      : `No se pudo activar la cuenta: ${crudo}`
    return json({ error: msg }, 400, origin)
  }

  const { error: errPerfil } = await admin
    .from('profiles')
    .update({ username, email: correoFinal, genero, full_name: nombreFinal, perfil_completo: true })
    .eq('id', atleta.id)
  if (errPerfil) {
    return json({ error: `No se pudo guardar el perfil: ${textoDeError(errPerfil)}` }, 400, origin)
  }

  await admin.from('invitaciones').update({ usada_en: new Date().toISOString() }).eq('token', token)

  return json({ ok: true, email: correoFinal, username }, 200, origin)
})
