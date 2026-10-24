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
// para ver los videos. Por eso puede vivir en el codigo.
//
// DOMINIO PROPIO (15 oct 2026): los archivos NUEVOS salen con `https://videos.traininglabapp.com`.
// El secreto `R2_PUBLIC_URL`, si existe, manda sobre esa (sirve para volver atras sin tocar el codigo).
// La anterior (`r2.dev`) sigue reconocida: `sellar` y la limpieza trabajan con la RUTA del archivo
// (`videos/<id>.mp4`), no con el host. Ver docs/dominio.md.
const PUBLICA_ANTERIOR = 'https://pub-4a3ae85521d744b5abf16550ea171189.r2.dev'
const PUBLICA_PROPIA = 'https://videos.traininglabapp.com'
const PUBLICA = (Deno.env.get('R2_PUBLIC_URL') ?? '').trim().replace(/\/+$/, '') || PUBLICA_PROPIA
const HOSTS_PROPIOS = [...new Set([PUBLICA, PUBLICA_PROPIA, PUBLICA_ANTERIOR])]
const RUTA_EN_URL = /((?:videos|covers|media)\/[A-Za-z0-9._-]+)$/

// Con dominio propio, la app deja de vivir solo en `*.vercel.app`: `https://app.traininglabapp.com` va en el codigo y,
// si hace falta otra, por secreto (`SITIO_URL` y, si hay mas de una, `ORIGENES_EXTRA` separadas por coma).
const ORIGENES_PROPIOS = ['https://app.traininglabapp.com', Deno.env.get('SITIO_URL'), ...(Deno.env.get('ORIGENES_EXTRA') ?? '').split(',')]
  .map((o) => (o ?? '').trim().replace(/\/+$/, ''))
  .filter(Boolean)

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
]

function corsHeaders(origin: string | null): Record<string, string> {
  let allow = DEFAULT_ORIGINS[0]
  if (origin) {
    try {
      if (DEFAULT_ORIGINS.includes(origin) || ORIGENES_PROPIOS.includes(origin) || /\.vercel\.app$/.test(new URL(origin).hostname)) {
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

// Lo mas que cabe en UNA subida: R2 acepta ~5 GB por archivo (4.995 GiB) sin trocear.
// Una clase de una hora en 1080p pesa ~3.5 GB; en 4K ~11 GB, y esa no cabe en un solo
// envio. El tope vive tambien en la app (`LIMITE_MEDIA_MB`) para avisar antes de subir.
const TOPE_POR_ARCHIVO_BYTES = 4800 * 1048576

const gb = (b: number) => `${(Math.round((b / 1e9) * 10) / 10).toLocaleString('es-MX')} GB`

// Un año, y sin volver a preguntar. Cada archivo se guarda con un nombre unico
// que no se reutiliza nunca —editar una foto crea otro archivo, no pisa el
// anterior— asi que no existe la version vieja que se pudiera quedar pegada.
const CACHE_ETERNO = 'public, max-age=31536000, immutable'

function clienteR2() {
  return new AwsClient({
    accessKeyId: (Deno.env.get('R2_ACCESS_KEY_ID') ?? '').trim(),
    // .trim() a proposito: un espacio pegado al copiar rompe la firma sin dar
    // ninguna pista util. Ya paso una vez durante la instalacion.
    secretAccessKey: (Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '').trim(),
    service: 's3',
    region: 'auto',
  })
}

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
    .select('role, is_active')
    .eq('id', usuario.user.id)
    .maybeSingle()
  if (!perfil || perfil.role !== 'admin') {
    return json({ error: 'Tu cuenta no tiene permiso para subir al repertorio.' }, 403, origin)
  }
  // Una cuenta que el dueño pausó no puede seguir ocupando espacio con la sesión que ya tenía abierta (auditoría p127).
  if (perfil.is_active === false) {
    return json({ error: 'Tu cuenta está pausada. Habla con el administrador.' }, 403, origin)
  }

  // --- Que quiere subir ---------------------------------------------------
  let p: { tipo?: string; extension?: string; carpeta?: string; accion?: string; bytes?: number }
  try { p = await req.json() } catch { return json({ error: 'JSON inválido' }, 400, origin) }

  const accountId = (Deno.env.get('R2_ACCOUNT_ID') ?? '').trim()
  const bucket = (Deno.env.get('R2_BUCKET') ?? '').trim()

  /* --- Mantenimiento: ponerle la etiqueta de cache a lo que YA esta subido ---
   *
   * Los archivos subidos antes del 10 sep 2026 no llevan `Cache-Control`. Sin
   * esa etiqueta el navegador no guarda su copia, y el atleta se baja el video
   * entero cada vez que abre el ejercicio, todas las semanas.
   *
   * Esto se la pone SIN cambiar la direccion publica: se copia el objeto sobre
   * si mismo pidiendole a R2 que reemplace los metadatos. El contenido no
   * viaja: la copia ocurre dentro de Cloudflare. Por eso no hay que tocar la
   * base de datos, y siguen sirviendo las direcciones que ya estan guardadas
   * dentro de los planes de cada atleta.
   *
   * QUE ARCHIVOS TOCA, y por que eso hace que no haga falta protegerlo mas:
   * las rutas NO vienen de quien llama. Se sacan de la propia base de datos —
   * lo que ya esta referenciado por un ejercicio o por un video extra. Nadie
   * puede pedirle que toque un archivo arbitrario, ni siquiera adivinando su
   * nombre, porque no acepta nombres. Y lo unico que cambia es una etiqueta de
   * cache: el contenido no se toca. Por eso basta con ser coach o master, que
   * es lo que ya exige esta funcion mas arriba.
   */
  if (p.accion === 'sellar') {
    const [ejercicios, extras] = await Promise.all([
      admin.from('exercises').select('video_url, cover_image_url'),
      admin.from('exercise_media').select('url'),
    ])

    const urls = new Set<string>()
    const anota = (u: unknown) => {
      if (typeof u !== 'string' || !HOSTS_PROPIOS.some((h) => u.startsWith(`${h}/`))) return
      const ruta = u.match(RUTA_EN_URL)?.[1]
      if (ruta) urls.add(ruta)
    }
    for (const f of ejercicios.data ?? []) { anota(f.video_url); anota(f.cover_image_url) }
    for (const f of extras.data ?? []) anota(f.url)

    const aws = clienteR2()
    const hechas: string[] = []
    const fallidas: { ruta: string; estado: number }[] = []

    for (const limpia of urls) {
      const destino = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${limpia}`

      // El tipo se relee y se vuelve a mandar: al reemplazar los metadatos, lo
      // que no se repita se pierde, y un video sin tipo deja de reproducirse.
      const previo = await fetch(`${PUBLICA}/${limpia}`, { method: 'HEAD' })
      const tipoPrevio = previo.headers.get('content-type') || 'application/octet-stream'

      const r = await aws.fetch(destino, {
        method: 'PUT',
        headers: {
          'x-amz-copy-source': `/${bucket}/${limpia}`,
          'x-amz-metadata-directive': 'REPLACE',
          'Cache-Control': CACHE_ETERNO,
          'Content-Type': tipoPrevio,
        },
      })
      if (r.ok) hechas.push(limpia)
      else fallidas.push({ ruta: limpia, estado: r.status })
    }

    return json({ selladas: hechas.length, fallidas }, 200, origin)
  }

  const tipo = (p.tipo ?? '').trim().toLowerCase()
  if (!TIPOS_OK.has(tipo)) {
    return json({ error: `Tipo de archivo no permitido (${tipo || 'desconocido'}).` }, 400, origin)
  }

  const carpeta = CARPETAS_OK.has((p.carpeta ?? '').trim()) ? p.carpeta!.trim() : 'media'
  const ext = (p.extension ?? '').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'bin'
  const id = crypto.randomUUID()
  const ruta = `${carpeta}/${id}.${ext}`

  /* --- Espacio del coach ---------------------------------------------------
   * Los videos se pagan por lo que pesan guardados. Cada coach tiene un espacio
   * (10 GB y 7 GB mas por cada cliente que le paga; el dueno, sin limite): la
   * regla vive en la base (`espacio_del_coach`, ver docs/sql/2026-10-11-espacio-de-videos.sql).
   * Aqui se mira ANTES de dar el permiso, para que nadie suba 3 GB y se entere
   * al final de que no cabian. Solo se frena un VIDEO: una foto pesa unos KB y
   * nunca debe quedarse sin subir por esto (ni las portadas automaticas).
   * `bytes` lo declara la app; si no llega (una app vieja) se anota 0 y se deja
   * pasar: esto cuida el costo, no es una puerta de seguridad. */
  const bytes = Number.isFinite(Number(p.bytes)) && Number(p.bytes) > 0 ? Math.floor(Number(p.bytes)) : 0
  if (bytes > TOPE_POR_ARCHIVO_BYTES) {
    return json({
      codigo: 'archivo_muy_grande',
      error: `Este archivo pesa ${gb(bytes)} y el máximo por archivo es ${gb(TOPE_POR_ARCHIVO_BYTES)} (una clase de ~80 minutos en 1080p). Grábala en 1080p o divídela en dos partes.`,
    }, 413, origin)
  }
  const { data: antes, error: errEspacio } = await admin.rpc('espacio_del_coach', { p_coach: usuario.user.id })
  if (errEspacio) console.error('espacio_del_coach:', errEspacio.message) // no se bloquea una subida por un fallo de la cuenta
  const espacio = antes as { usado: number; limite: number | null; clientes: number; ilimitado: boolean; base: number; por_cliente: number } | null
  if (tipo.startsWith('video/') && espacio && espacio.limite !== null && espacio.usado + bytes > espacio.limite) {
    return json({
      codigo: 'sin_espacio',
      error: `No te alcanza el espacio para este video: usaste ${gb(espacio.usado)} de ${gb(espacio.limite)} y este pesa ${gb(bytes)}. Borra videos que ya no uses; cada cliente que te pague te suma ${gb(espacio.por_cliente)}.`,
      espacio,
    }, 403, origin)
  }
  if (bytes > 0) {
    const { error: errPeso } = await admin.from('medios_peso').insert({ ruta, coach_id: usuario.user.id, bytes, tipo })
    if (errPeso) console.error('medios_peso:', errPeso.message)
  }

  // --- Firmar el permiso --------------------------------------------------
  const aws = clienteR2()

  const destino = `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${ruta}`
  const firmada = await aws.sign(
    new Request(destino, { method: 'PUT' }),
    { aws: { signQuery: true, allHeaders: false }, headers: {} },
  )

  return json({
    subir_a: firmada.url,               // donde el navegador manda el archivo
    url_publica: `${PUBLICA}/${ruta}`,  // lo que se guarda en la base
    ruta,
    espacio: espacio ? { ...espacio, usado: espacio.usado + bytes } : null, // para que la barra se actualice sin otra llamada
  }, 200, origin)
})
