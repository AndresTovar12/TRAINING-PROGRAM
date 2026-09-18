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

/**
 * El `try` no es decorativo: los navegadores mandan `Origin: null` de verdad
 * (un iframe con sandbox, un archivo abierto desde el disco), y `new URL('null')`
 * revienta. Sin esto, la función entera respondía 500 SIN cabeceras CORS y el
 * navegador enseñaba un error de CORS en vez del real.
 */
function origenQueSePermite(origin: string | null) {
  if (!origin) return DEFAULT_ORIGINS[0]

  if (ALLOWED.has(origin)) return origin

  try {
    return new URL(origin).hostname.endsWith('.vercel.app') ? origin : DEFAULT_ORIGINS[0]
  } catch {
    return DEFAULT_ORIGINS[0]
  }
}

function corsHeaders(origin: string | null) {
  return {
    'Access-Control-Allow-Origin': origenQueSePermite(origin),
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
// cuál de las dos falló es decirle a un desconocido qué usuarios existen. Por
// lo mismo, NUNCA se reenvía el texto que devuelve Supabase Auth: "Email not
// confirmed" o "Request rate limit reached" solo le salen a quien existe.
const INCORRECTO = 'Usuario o contraseña incorrectos'
const DEMASIADOS = 'Demasiados intentos. Espera un momento y vuelve a intentarlo.'
const SERVIDOR = 'No se pudo entrar. Inténtalo de nuevo en un momento.'

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

  // Un cuerpo válido de JSON puede ser `null`, un número o un texto. Con la
  // interrogación y el String() eso no revienta: se queda en vacío y se
  // contesta "completa usuario y contraseña".
  const identificador = String(peticion?.identificador ?? '').trim()
  const password = String(peticion?.password ?? '')

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

      return json({ error: SERVIDOR }, 500, origin)
    }

    if (!data) return json({ error: INCORRECTO }, 400, origin)

    email = String(data)
  }

  /* 2. La contraseña la valida Supabase Auth.
     NO se reenvía la cabecera `x-forwarded-for` de quien llama. Se probó y es
     un tiro en el pie: esa cabecera la escribe el cliente, y Supabase Auth la
     usa para contar los intentos fallidos. Reenviándola, cualquiera cambia de
     "IP" en cada intento y prueba contraseñas sin límite. Sin reenviarla, los
     intentos por nombre de usuario cuentan todos contra esta función: alguien
     insistiendo puede agotar ese cupo y dejar sin entrar por usuario un rato
     (entrar con correo sigue funcionando). Se prefiere eso a regalar intentos
     infinitos. */
  const r = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
    // Sin esto, un Auth colgado deja al atleta con el botón girando sin decir nada.
    signal: AbortSignal.timeout(10_000),
  }).catch(() => null)

  if (!r) return json({ error: SERVIDOR }, 502, origin)

  if (!r.ok) {
    // 429 merece su propio texto: "contraseña incorrecta" haría que la persona
    // siga intentando y se hunda más. Todo lo demás se cuenta igual, para no
    // delatar qué usuarios existen.
    if (r.status === 429) return json({ error: DEMASIADOS }, 429, origin)

    if (r.status >= 500) return json({ error: SERVIDOR }, 502, origin)

    return json({ error: INCORRECTO }, 400, origin)
  }

  const vacio: RespuestaDeAuth = {}
  const cuerpo: RespuestaDeAuth = await r.json().catch(() => vacio)

  // Un 200 sin sesión (Auth raro, o un cuerpo ilegible) NO es "contraseña mala".
  if (!cuerpo.access_token || !cuerpo.refresh_token) {
    console.error('Supabase Auth respondió 200 sin sesión')

    return json({ error: SERVIDOR }, 502, origin)
  }

  // Solo la sesión. Ni el correo, ni el perfil, ni nada más.
  return json({ access_token: cuerpo.access_token, refresh_token: cuerpo.refresh_token }, 200, origin)
})
