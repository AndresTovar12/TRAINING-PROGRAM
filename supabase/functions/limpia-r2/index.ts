/**
 * Borra de Cloudflare R2 los videos y fotos que YA NO SE USAN EN NINGÚN LADO.
 *
 * Andrés, 11 oct 2026: «obviamente sí quiero eliminar los videos de ejercicios que ya no están» y «que se borre cada vez que el ejercicio se borre». Borrar un ejercicio
 * (o cambiarle el video, o la foto) quitaba la fila pero dejaba el archivo en R2, y ese espacio se paga cada mes para siempre.
 *
 * DOS FORMAS DE LLAMARLA:
 *   1. AL INSTANTE (`{ "rutas": ["videos/…mp4"] }`): la manda la base de datos (disparadores de `exercises` y `exercise_media`, ver docs/sql/2026-10-11-videos-sin-usar.sql)
 *      cada vez que se borra un ejercicio o se cambia su video o su foto. Por cada ruta pregunta «¿todavía aparece en algún lado?» y, si no, borra el archivo (y, si era un
 *      video, su portada y su miniatura automáticas). Una ruta que sí aparece se deja: un ejercicio duplicado comparte el video, y los planes guardan la dirección del video
 *      dentro de su JSON.
 *   2. BARRIDO (sin cuerpo, o `{ "barrido": true }`): recorre todo R2 y borra lo que no aparece en la base y tiene más de 30 días. Es la red de seguridad por si algo se
 *      escapó (un archivo reemplazado en el editor, una cuenta borrada).
 *
 * QUÉ SIGNIFICA «APARECE EN ALGÚN LADO»: `rutas_r2_en_uso()` busca en ejercicios, videos extra, fichas propias, planes, versiones, respaldos, «Mis planes», plantillas,
 * portadas y el estado de la app.
 *
 * TOPES DE SEGURIDAD:
 *   · si `rutas_r2_en_uso()` falla o viene vacía, no borra nada;
 *   · al instante solo toca archivos de más de 1 día (lo recién subido puede ser un borrador abierto en el editor que todavía no se guarda);
 *   · el barrido no borra si lo «sin usar» es más de la mitad de lo que hay, y borra como mucho 50 por vuelta;
 *   · `{ "probar": true }` solo cuenta y enseña la lista, sin borrar.
 *
 * Sin contraseña (verify_jwt apagado), como `limpia-mensajes`: solo quita lo que no aparece en ningún lado, así que llamarla de más no puede dañar nada.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { AwsClient } from 'npm:aws4fetch@1.0.20'

const DIAS_DE_GRACIA = 30            // el barrido
const EDAD_MINIMA_INSTANTE_MS = 24 * 3600 * 1000 // al instante
const MAX_RUTAS_INSTANTE = 20
const MAX_POR_VUELTA = 50
const DIA_MS = 24 * 3600 * 1000
const RUTA = /((?:videos|covers|media)\/[A-Za-z0-9._-]+)/

type Objeto = { ruta: string; bytes: number; modificado: string }

function clienteR2() {
  return new AwsClient({
    accessKeyId: (Deno.env.get('R2_ACCESS_KEY_ID') ?? '').trim(),
    secretAccessKey: (Deno.env.get('R2_SECRET_ACCESS_KEY') ?? '').trim(),
    service: 's3',
    region: 'auto',
  })
}

const xml = (s: string) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")

/** Todo lo que hay en el bucket (de 1,000 en 1,000). */
async function listaDeR2(aws: AwsClient, base: string): Promise<Objeto[]> {
  const todos: Objeto[] = []
  let token: string | null = null
  for (let vuelta = 0; vuelta < 200; vuelta++) {
    const q = new URLSearchParams({ 'list-type': '2', 'max-keys': '1000' })
    if (token) q.set('continuation-token', token)
    const r = await aws.fetch(`${base}?${q}`)
    if (!r.ok) throw new Error(`R2 no dio la lista (${r.status})`)
    const cuerpo = await r.text()
    for (const m of cuerpo.matchAll(/<Contents>([\s\S]*?)<\/Contents>/g)) {
      const c = m[1]
      const ruta = xml(c.match(/<Key>([\s\S]*?)<\/Key>/)?.[1] ?? '')
      if (!ruta) continue
      todos.push({ ruta, bytes: Number(c.match(/<Size>(\d+)<\/Size>/)?.[1] ?? 0), modificado: c.match(/<LastModified>([^<]+)<\/LastModified>/)?.[1] ?? '' })
    }
    const sigue = /<IsTruncated>true<\/IsTruncated>/.test(cuerpo)
    token = sigue ? xml(cuerpo.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ?? '') : null
    if (!token) break
  }
  return todos
}

async function bytesYEdad(aws: AwsClient, base: string, ruta: string): Promise<{ existe: boolean; bytes: number; modificado: number }> {
  const r = await aws.fetch(`${base}/${ruta.split('/').map(encodeURIComponent).join('/')}`, { method: 'HEAD' })
  if (!r.ok) return { existe: false, bytes: 0, modificado: 0 }
  return { existe: true, bytes: Number(r.headers.get('content-length') ?? 0), modificado: Date.parse(r.headers.get('last-modified') ?? '') || 0 }
}

async function borraDeR2(aws: AwsClient, base: string, ruta: string) {
  return aws.fetch(`${base}/${ruta.split('/').map(encodeURIComponent).join('/')}`, { method: 'DELETE' })
}

const mb = (b: number) => Math.round((b / 1048576) * 10) / 10
const responde = (cuerpo: unknown, estado = 200) => new Response(JSON.stringify(cuerpo, null, 1), { status: estado, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST' && req.method !== 'GET') return new Response('Método no permitido', { status: 405 })
  let probar = new URL(req.url).searchParams.get('probar') === '1'
  let rutasPedidas: string[] = []
  if (req.method === 'POST') {
    try {
      const b = await req.json()
      if (b?.probar) probar = true
      if (Array.isArray(b?.rutas)) rutasPedidas = [...new Set(b.rutas.map((r: unknown) => String(r).match(RUTA)?.[1]).filter(Boolean) as string[])].slice(0, MAX_RUTAS_INSTANTE)
    } catch { /* sin cuerpo */ }
  }

  const bd = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })
  const accountId = (Deno.env.get('R2_ACCOUNT_ID') ?? '').trim()
  const bucket = (Deno.env.get('R2_BUCKET') ?? '').trim()
  const base = `https://${accountId}.r2.cloudflarestorage.com/${bucket}`
  const aws = clienteR2()

  try {
    // 1) Lo que se usa (si la base no contesta bien, aquí se detiene todo).
    const { data, error } = await bd.rpc('rutas_r2_en_uso')
    if (error) throw new Error(`la base no dio las rutas en uso: ${error.message}`)
    const enUso = new Set((data ?? []).map((f: { ruta: string }) => f.ruta))
    if (enUso.size === 0) return responde({ borrados: 0, aviso: 'La base no reportó nada en uso: por seguridad no se borra nada.' }, 500)

    // 1b) Al instante: solo las rutas que mandó la base.
    if (rutasPedidas.length) {
      const resultado: { ruta: string; estado: string }[] = []
      const borradas: string[] = []
      for (const ruta of rutasPedidas) {
        if (enUso.has(ruta)) { resultado.push({ ruta, estado: 'se queda: todavía aparece en la base' }); continue }
        const o = await bytesYEdad(aws, base, ruta)
        if (!o.existe) { resultado.push({ ruta, estado: 'ya no estaba en R2' }); continue }
        if (Date.now() - o.modificado < EDAD_MINIMA_INSTANTE_MS) { resultado.push({ ruta, estado: 'se queda: tiene menos de 1 día (lo recoge el barrido)' }); continue }
        if (probar) { resultado.push({ ruta, estado: `se borraría (${mb(o.bytes)} MB)` }); continue }
        const r = await borraDeR2(aws, base, ruta)
        resultado.push({ ruta, estado: r.ok ? `borrado (${mb(o.bytes)} MB)` : `error ${r.status}` })
        if (r.ok) borradas.push(ruta)
      }
      // La portada y la miniatura automáticas de un video borrado también sobran (solo cuentan mientras su video exista).
      const videos = borradas.filter((r) => r.startsWith('videos/'))
      if (videos.length) {
        const { data: portadas } = await bd.from('video_posters').select('video_url, poster_url, mini_url')
        for (const p of (portadas ?? []).filter((f: { video_url: string }) => videos.includes(f.video_url.match(RUTA)?.[1] ?? ''))) {
          for (const u of [p.poster_url, p.mini_url]) {
            const rp = String(u ?? '').match(RUTA)?.[1]
            if (rp && !enUso.has(rp)) { const r = await borraDeR2(aws, base, rp); resultado.push({ ruta: rp, estado: r.ok ? 'portada borrada' : `error ${r.status}` }) }
          }
          await bd.from('video_posters').delete().eq('video_url', p.video_url)
        }
      }
      return responde({ modo: 'instante', prueba: probar, resultado })
    }

    // 2) Barrido: lo que hay en R2, y lo que no se usa.
    const hay = await listaDeR2(aws, base)
    const limite = Date.now() - DIAS_DE_GRACIA * DIA_MS
    const sinUsar = hay.filter((o) => !enUso.has(o.ruta.match(RUTA)?.[1] ?? o.ruta))
    const borrables = sinUsar.filter((o) => o.modificado && Date.parse(o.modificado) < limite)
    const recientes = sinUsar.length - borrables.length

    const resumen = {
      en_r2: hay.length,
      mb_en_r2: mb(hay.reduce((s, o) => s + o.bytes, 0)),
      en_uso: hay.length - sinUsar.length,
      sin_usar: sinUsar.length,
      mb_sin_usar: mb(sinUsar.reduce((s, o) => s + o.bytes, 0)),
      sin_usar_recientes: recientes,
      borrables: borrables.length,
      mb_borrables: mb(borrables.reduce((s, o) => s + o.bytes, 0)),
    }

    if (hay.length > 0 && sinUsar.length > hay.length / 2) {
      return responde({ ...resumen, borrados: 0, aviso: 'Más de la mitad parece sin usar: algo no cuadra. Por seguridad no se borra nada.' }, 409)
    }
    if (probar) {
      return responde({ ...resumen, prueba: true, lista: borrables.map((o) => ({ ruta: o.ruta, mb: mb(o.bytes), desde: o.modificado.slice(0, 10) })) })
    }

    // 3) Borrar (con tope por vuelta) y quitar las portadas automáticas de los videos borrados.
    const lote = borrables.slice(0, MAX_POR_VUELTA)
    const borrados: string[] = []
    const errores: string[] = []
    for (const o of lote) {
      const r = await aws.fetch(`${base}/${o.ruta.split('/').map(encodeURIComponent).join('/')}`, { method: 'DELETE' })
      if (r.ok || r.status === 404) borrados.push(o.ruta)
      else errores.push(`${o.ruta}: ${r.status}`)
    }
    const videos = borrados.filter((r) => r.startsWith('videos/'))
    if (videos.length) {
      const { data: portadas } = await bd.from('video_posters').select('video_url')
      const quitar = (portadas ?? []).map((p: { video_url: string }) => p.video_url).filter((u: string) => videos.includes(u.match(RUTA)?.[1] ?? ''))
      if (quitar.length) {
        const { error: e } = await bd.from('video_posters').delete().in('video_url', quitar)
        if (e) errores.push(`video_posters: ${e.message}`)
      }
    }
    return responde({ ...resumen, borrados: borrados.length, mb_borrados: mb(lote.filter((o) => borrados.includes(o.ruta)).reduce((s, o) => s + o.bytes, 0)), quedan: borrables.length - borrados.length, errores })
  } catch (e) {
    return responde({ borrados: 0, error: e instanceof Error ? e.message : String(e) }, 500)
  }
})
