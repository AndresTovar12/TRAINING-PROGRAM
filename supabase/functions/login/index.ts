import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Entrar con NOMBRE DE USUARIO, sin enseñarle el correo a nadie.
 *
 * Antes lo resolvía el navegador: pedía `rpc/email_for_login` con el usuario y
 * la base le devolvía el correo. Esa llamada no necesita sesión, así que
 * cualquiera que supiera un nombre de usuario —y el de un coach se comparte
 * para registrarse— obtenía el correo de esa persona.
 *
 * Ahora el usuario se resuelve AQUÍ, con permisos de servicio, y el correo no
 * sale de esta función: solo viaja de vuelta la sesión que abre Supabase Auth.
 * La contraseña sigue validándola Supabase Auth, no nosotros.
 */

/** Lo que manda el navegador. */
type Peticion = {
  identificador?: string
  password?: string
}

/** Lo que contesta esta función: o la sesión, o el motivo. */
type Respuesta =
  | { access_token: string; refresh_token: string }
  | { error: string }

/** Lo que contesta Supabase Auth al validar la contraseña. */
type RespuestaDeAuth = {
  access_token?: string
  refresh_token?: string
  error_description?: string
  msg?: string
  error?: string
}

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

function corsHeaders(origin: string | null) {
  const permitido = origin !== null
    && (ALLOWED.has(origin) || new URL(origin).hostname.endsWith('.vercel.app'))

  return {
    'Access-Control-Allow-Origin': permitido ? origin : DEFAULT_ORIGINS[0],
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: Respuesta, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

// Un solo texto para "no existe ese usuario" y "la contraseña no es": decir
// cuál de las dos falló es decirle a un desconocido qué usuarios existen.
const INCORRECTO = 'Usuario o contraseña incorrectos'

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })

  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origin)

  let peticion: Peticion

  try {
    peticion = await req.json()
  } catch {
    return json({ error: 'No se entendió la petición' }, 400, origin)
  }

  const identificador = (peticion.identificador ?? '').trim()
  const password = peticion.password ?? ''

  if (!identificador || !password) return json({ error: 'Completa usuario y contraseña' }, 400, origin)

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

  if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    console.error('faltan variables de entorno en la función login')

    return json({ error: 'Configuración incompleta. Avísale al administrador.' }, 500, origin)
  }

  // 1. Usuario → correo. Con permisos de servicio, y el correo se queda aquí.
  let email = identificador

  if (!identificador.includes('@')) {
    const admin = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
    const { data, error } = await admin.rpc('email_for_login', { identifier: identificador })

    if (error) {
      console.error('no se pudo resolver el usuario:', error.message)

      return json({ error: 'No se pudo entrar. Inténtalo de nuevo.' }, 500, origin)
    }

    if (!data) return json({ error: INCORRECTO }, 400, origin)

    email = String(data)
  }

  // 2. La contraseña la valida Supabase Auth. Se le pasa la IP de quien entra
  //    para que su límite de intentos cuente por persona y no por esta función.
  const cabeceras = new Headers({ apikey: ANON_KEY, 'Content-Type': 'application/json' })
  const ipDeQuienEntra = req.headers.get('x-forwarded-for')

  if (ipDeQuienEntra) cabeceras.set('x-forwarded-for', ipDeQuienEntra)

  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: cabeceras,
    body: JSON.stringify({ email, password }),
  }).catch(() => null)

  if (!r) return json({ error: 'No se pudo contactar al servidor. Revisa tu conexión.' }, 502, origin)

  const vacio: RespuestaDeAuth = {}
  const cuerpo: RespuestaDeAuth = await r.json().catch(() => vacio)

  if (!r.ok) {
    const crudo = cuerpo.error_description ?? cuerpo.msg ?? cuerpo.error ?? ''
    const texto = !crudo || /invalid login credentials/i.test(crudo) ? INCORRECTO : crudo

    return json({ error: texto }, r.status, origin)
  }

  if (!cuerpo.access_token || !cuerpo.refresh_token) {
    console.error('Supabase Auth respondió sin sesión')

    return json({ error: 'No se pudo entrar. Inténtalo de nuevo.' }, 502, origin)
  }

  // Solo la sesión. Ni el correo, ni el perfil, ni nada más.
  return json({ access_token: cuerpo.access_token, refresh_token: cuerpo.refresh_token }, 200, origin)
})
