import { createClient } from 'jsr:@supabase/supabase-js@2'

// Orígenes permitidos (CORS). Se puede sobreescribir con ALLOWED_ORIGINS (coma-separado).
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

/**
 * Convierte cualquier error en texto legible.
 *
 * Existe por un bug real: al registrarse salia literalmente "{}" en pantalla.
 * Causa: JSON.stringify() sobre un Error de JavaScript SIEMPRE devuelve "{}",
 * porque las propiedades de Error no son enumerables. El mensaje verdadero se
 * perdia y la persona no tenia forma de saber que hacer.
 */
function textoDeError(e: unknown): string {
  if (!e) return 'Error desconocido'
  if (typeof e === 'string') return e
  const any = e as Record<string, unknown>
  for (const campo of ['message', 'msg', 'error_description', 'error', 'details', 'hint']) {
    const v = any[campo]
    if (typeof v === 'string' && v.trim() && v.trim() !== '{}') return v
  }
  try {
    const s = JSON.stringify(e)
    if (s && s !== '{}') return s
  } catch { /* no serializable */ }
  return String(e)
}

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405, origin)
  }

  let payload: {
    username?: string; email?: string; password?: string; full_name?: string
    account_type?: string; coach_username?: string
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400, origin)
  }

  const username = (payload.username ?? '').trim()
  const fullName = (payload.full_name ?? '').trim()
  const password = payload.password ?? ''
  let email = (payload.email ?? '').trim().toLowerCase()
  const accountType = (payload.account_type ?? 'athlete').trim().toLowerCase()
  const coachUsername = (payload.coach_username ?? '').trim()

  if (!USERNAME_RE.test(username)) {
    return json(
      { error: 'El usuario debe tener 3-30 caracteres (letras, números, _ o .)' },
      400,
      origin,
    )
  }
  if (password.length < 6) {
    return json({ error: 'La contraseña debe tener al menos 6 caracteres' }, 400, origin)
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'Correo inválido' }, 400, origin)
  }
  if (!email) email = `${username.toLowerCase()}@traininglab.app`

  const isCoach = accountType === 'coach'

  // OJO: el rol que guarda la base es 'admin' o 'user'. NO 'athlete'.
  // La tabla profiles tiene CHECK (role IN ('admin','user')), asi que mandar
  // 'athlete' hacia fallar TODO registro de atleta con un error 500 de
  // Postgres que ademas llegaba en blanco al usuario. "athlete" es como se
  // llama el tipo de cuenta en la interfaz; 'user' es como se llama el rol en
  // la base. Son dos vocabularios distintos y hay que traducir aqui.
  const role = isCoach ? 'admin' : 'user'

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Username único
  const { data: taken } = await admin
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .maybeSingle()
  if (taken) {
    return json({ error: 'Ese nombre de usuario ya está en uso' }, 409, origin)
  }

  // Si el atleta indicó un coach, resolverlo. Debe existir y ser una cuenta de coach.
  let coachId: string | null = null
  if (!isCoach && coachUsername) {
    const { data: coach } = await admin
      .from('profiles')
      .select('id, role')
      .ilike('username', coachUsername)
      .maybeSingle()
    if (!coach || coach.role !== 'admin') {
      return json({ error: `No encontramos un coach con el usuario "${coachUsername}"` }, 400, origin)
    }
    coachId = coach.id
  }

  // Crear usuario confirmado (sin email de verificación)
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: fullName, role },
  })

  if (error) {
    const crudo = textoDeError(error)
    // Queda en los registros del servidor para poder diagnosticar despues.
    console.error('createUser falló:', crudo, JSON.stringify({ username, email, role }))

    let msg = crudo
    if (/already been registered|exists|duplicate/i.test(crudo)) {
      msg = 'Ese correo ya está registrado. Intenta entrar, o usa otro correo.'
    } else if (/profiles_role_check|check constraint/i.test(crudo)) {
      msg = 'Error de configuración de la cuenta. Avísale al administrador.'
    } else if (/unexpected_failure|500/i.test(crudo)) {
      msg = `No se pudo crear la cuenta (${crudo}). Inténtalo de nuevo en un minuto.`
    }
    return json({ error: msg }, 400, origin)
  }

  const userId = data.user?.id

  // El trigger handle_new_user ya creó el profile con el role del metadata.
  // Reafirmamos role + coach_id (y is_owner=false; el master se marca a mano en DB).
  if (userId) {
    const { error: errPerfil } = await admin
      .from('profiles')
      .update({ role, coach_id: coachId, is_owner: false })
      .eq('id', userId)
    if (errPerfil) {
      console.error('update profiles falló:', textoDeError(errPerfil))
      return json({ error: `Se creó la cuenta pero falló su perfil: ${textoDeError(errPerfil)}` }, 400, origin)
    }
  }

  return json({ ok: true, user_id: userId, email, role, coach_id: coachId }, 200, origin)
})
