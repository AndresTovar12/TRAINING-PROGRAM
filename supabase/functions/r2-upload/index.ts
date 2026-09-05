/**
 * Autoriza una subida a Cloudflare R2.
 *
 * POR QUE EXISTE ESTA FUNCION:
 * El archivo NO pasa por aqui. Esta funcion solo firma un permiso temporal, y
 * el telefono sube el video DIRECTO a Cloudflare. Eso importa por dos razones:
 *   1. El archivo nunca cruza Supabase, asi que no aplica ningun limite suyo.
 *   2. El navegador puede reportar el avance real de la subida.
 *
 * La contraseña de R2 vive solo aqui, en el servidor. Nunca llega al navegador.
 *
 * SEGURIDAD: solo cuentas de coach o master pueden pedir permiso de subida. Un
 * atleta autenticado NO puede: se verifica su rol contra la base antes de
 * firmar nada.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { AwsClient } from 'npm:aws4fetch@1.0.20'

// La direccion publica NO es secreta: es justamente la que abren los atletas
// para ver los videos. Por eso vive en el codigo y no en los secretos.
const PUBLICA = 'https://pub-4a3ae85521d744b5abf16550ea171189.r2.dev'

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
]

function corsHeaders(origin: string | null): Record<string, string> {
  let allow = DEFAULT_ORIGINS[0]
  if (origin) {
    try {
      if (DEFAULT_ORIGINS.includes(origin) || /\.vercel\.app$/.test(new URL(origin).hostname)) {
        allow = origin
      }
    } catch { /* origin malformado */ }
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
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

// Tipos permitidos. Se valida aqui y no solo en el navegador, porque cualquiera
// puede llamar a esta funcion sin pasar por la app.
const TIPOS_OK = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif',
  'video/mp4', 'video/quicktime', 'video/webm',
])

const CARPETAS_OK = new Set(['covers', 'videos', 'media'])

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origin)

  // --- Quien pide ---------------------------------------------------------
  const auth = req.headers.get('Authorization') ?? ''
  const token = auth.replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Falta tu sesión. Vuelve a entrar.' }, 401, origin)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: usuario, error: errAuth } = await admin.auth.getUser(token)
  if (errAuth || !usuario?.user) {
    return json({ error: 'Tu sesión expiró. Vuelve a entrar e inténtalo otra vez.' }, 401, origin)
  }

  // Solo coaches y master suben al repertorio. Un atleta no.
  const { data: perfil } = await admin
    .from('profiles')
    .select('role')
    .eq('id', usuario.user.id)
    .maybeSingle()
  if (!perfil || perfil.role !== 'admin') {
    return json({ error: 'Tu cuenta no tiene permiso para subir al repertorio.' }, 403, origin)
  }

  // --- Que quiere subir ---------------------------------------------------
  let p: { tipo?: string; extension?: string; carpeta?: string }
  try { p = await req.json() } catch { return json({ error: 'JSON inválido' }, 400, origin) }

  const tipo = (p.tipo ?? '').trim().toLowerCase()
  if (!TIPOS_OK.has(tipo)) {
    return json({ error: `Tipo de archivo no permitido (${tipo || 'desconocido'}).` }, 400, origin)
  }

  const carpeta = CARPETAS_OK.has((p.carpeta ?? '').trim()) ? p.carpeta!.trim() : 'media'
  const ext = (p.extension ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin'
  const id = crypto.randomUUID()
  const ruta = `${carpeta}/${id}.${ext}`

  // --- Firmar el permiso --------------------------------------------------
  const accountId = (Deno.env.get('R2_ACCOUNT_ID') ?? '').trim()
  const bucket = (Deno.env.get('R2_BUCKET') ?? '').trim()
  const aws = new AwsClient({
    accessKeyId: (Deno.env.get('R2_ACCESS_KEY_ID') ?? '').trim(),
    // .trim() a proposito: un espacio pegado al copiar rompe la firma sin dar
    // ninguna pista util. Ya paso una vez durante la instalacion.
    secretAccessKey: (Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '').trim(),
    service: 's3',
    region: 'auto',
  })

  const destino = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${ruta}`
  const firmada = await aws.sign(
    new Request(destino, { method: 'PUT' }),
    { aws: { signQuery: true, allHeaders: false }, headers: {} },
  )

  return json({
    subir_a: firmada.url,               // donde el navegador manda el archivo
    url_publica: `${PUBLICA}/${ruta}`,  // lo que se guarda en la base
    ruta,
  }, 200, origin)
})
