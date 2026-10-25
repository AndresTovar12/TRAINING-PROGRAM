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
  'http://localhost:5173', 'capacitor://localhost', /* app de iPhone (Capacitor) */
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'https://app.traininglabapp.com',  // dominio propio (15 oct 2026)
  'https://training-program-kappa.vercel.app', // despliegue anterior en Vercel (mismo dueño); ya NO vale cualquier *.vercel.app
]

const envOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)

const ALLOWED = new Set([...DEFAULT_ORIGINS, ...envOrigins])

/** Lista cerrada: solo los sitios propios (y los de ALLOWED_ORIGINS). Cualquier otro origen recibe el principal. */
function origenQueSePermite(origin: string | null) {
  if (!origin) return DEFAULT_ORIGINS[0]
  return ALLOWED.has(origin) ? origin : DEFAULT_ORIGINS[0]
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
const BLOQUEADO = 'Demasiados intentos fallidos. Espera 15 minutos y vuelve a intentarlo, o usa «Olvidé mi contraseña».'
const SERVIDOR = 'No se pudo entrar. Inténtalo de nuevo en un momento.'

/* FRENO A LOS INTENTOS FALLIDOS (lote 1 de seguridad, 25 oct 2026).
   Supabase Auth cuenta los intentos por la IP de ESTA funcion, o sea, de todos a la vez: pocos intentos de alguien
   pueden dejar sin entrar a los demas. Aqui se cuenta por cuenta y por conexion, solo los intentos que FALLAN:
     · misma cuenta desde la misma conexion: 8 en 15 min  (quien olvido su clave se frena solo a si mismo),
     · misma conexion, cualquier cuenta:     60 en 15 min (quien prueba muchas cuentas),
     · misma cuenta, desde cualquier lado:   40 en 15 min (red de seguridad contra un ataque repartido; un atacante no puede
       dejar fuera a nadie con unos cuantos intentos).
   La IP sale de `cf-connecting-ip` (la pone Cloudflare; el cliente no la puede cambiar). Si el libro falla, no se bloquea a nadie. */
const VENTANA_FALLOS_S = 15 * 60
function ipDe(req: Request): string {
  const cf = (req.headers.get('cf-connecting-ip') ?? '').trim()
  if (cf) return cf
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sin-ip'
}
// deno-lint-ignore no-explicit-any
async function fallosEn(bd: any, ambito: string, clave: string): Promise<number> {
  const desde = new Date(Date.now() - VENTANA_FALLOS_S * 1000).toISOString()
  const { count, error } = await bd.from('frenos_de_uso').select('id', { count: 'exact', head: true }).eq('ambito', ambito).eq('clave', clave).gte('creado_en', desde)
  if (error) { console.error('frenos_de_uso (contar):', error.message); return 0 }
  return count ?? 0
}
// deno-lint-ignore no-explicit-any
async function anotaFallo(bd: any, claves: [string, string][]) {
  const { error } = await bd.from('frenos_de_uso').insert(claves.map(([ambito, clave]) => ({ ambito, clave })))
  if (error) console.error('frenos_de_uso (anotar):', error.message)
  if (Math.random() < 0.02) await bd.from('frenos_de_uso').delete().lt('creado_en', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
}

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

  // 0. Freno a los intentos fallidos (ver arriba). Se mira ANTES de gastar una llamada a Supabase Auth.
  const frenos = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
  const ip = ipDe(req)
  const idMin = identificador.toLowerCase().slice(0, 120)
  const [fIdIp, fIp, fId] = await Promise.all([fallosEn(frenos, 'login_id_ip', `${idMin}|${ip}`), fallosEn(frenos, 'login_ip', ip), fallosEn(frenos, 'login_id', idMin)])
  if (fIdIp >= 8 || fIp >= 60 || fId >= 40) return json({ error: BLOQUEADO }, 429, origin)

  // 1. Usuario → correo. Con permisos de servicio, y el correo se queda aquí.
  let email = identificador

  if (!identificador.includes('@')) {
    const admin = frenos
    const { data, error } = await admin.rpc('email_for_login', { identifier: identificador })

    if (error) {
      console.error('no se pudo resolver el usuario:', error.message)

      return json({ error: SERVIDOR }, 500, origin)
    }

    if (!data) {
      await anotaFallo(frenos, [['login_id_ip', `${idMin}|${ip}`], ['login_ip', ip], ['login_id', idMin]])
      return json({ error: INCORRECTO }, 400, origin)
    }

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

    await anotaFallo(frenos, [['login_id_ip', `${idMin}|${ip}`], ['login_ip', ip], ['login_id', idMin]])
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
