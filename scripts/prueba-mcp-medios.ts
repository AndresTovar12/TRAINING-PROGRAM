/**
 * AGENTES CON ARCHIVOS (conector v2, 23 nov 2026): `pedir_subida` y `poner_medio_a_ejercicio`.
 * Desde `supabase/functions/mcp`: deno run -A --config deno.json ../../../scripts/prueba-mcp-medios.ts
 * La función `r2-upload` no se llama de verdad: `fetch` contesta como ella (permiso firmado, o su error).
 */
import { herramientasDeMedios, deDondeEs, HOSTS_PROPIOS } from '../supabase/functions/mcp/medios.ts'
import { baseEnMemoria, cierto, igual } from './mcp-prueba-comun.ts'

const ok = (t: string) => console.log(`OK    ${t}`)
const EJERCICIOS = [
  { id: 'e-propio', name: 'Sentadilla búlgara', created_by: 'coach-1', cover_image_url: null },
  { id: 'e-app', name: 'Back Squat', created_by: 'master-1', cover_image_url: 'https://videos.traininglabapp.com/covers/vieja.jpg' },
]

function armar() {
  const { db, datos } = baseEnMemoria({ exercises: EJERCICIOS, exercise_categories: [], exercise_media: [], exercise_overrides: [] }, { memoria: ['exercises', 'exercise_media', 'exercise_overrides'] })
  const quien: any = { id: 'coach-1', usuario: 'coach', nombre: 'Coach', rol: 'coach', salud: false, unidad: 'kg', db, token: 't' }
  const tools: Record<string, (a: any) => Promise<any>> = {}
  herramientasDeMedios({ registerTool: (n: string, _d: unknown, fn: any) => { tools[n] = fn } } as any, quien)
  return { tools, datos }
}
const sc = (r: any) => r.structuredContent

// `r2-upload` de mentira: firma lo que pidan y cuenta las llamadas; un archivo «sin-espacio» contesta como cuando no cabe.
const llamadas: any[] = []
globalThis.fetch = (async (url: string, init: any) => {
  if (String(url).includes('/functions/v1/r2-upload')) {
    const p = JSON.parse(init.body)
    llamadas.push(p)
    if (p.extension === 'sinespacio') return new Response(JSON.stringify({ error: 'No te alcanza el espacio para este video.' }), { status: 400 })
    const ruta = `${p.carpeta}/id-${llamadas.length}.${p.extension}`
    return new Response(JSON.stringify({ subir_a: `https://r2.firmada/${ruta}?X-Amz-Expires=21600`, url_publica: `https://videos.traininglabapp.com/${ruta}`, ruta, espacio: null }), { status: 200 })
  }
  throw new Error(`fetch inesperado: ${url}`)
}) as any

/* ---- Las direcciones propias son las mismas que acepta r2-upload ---- */
{
  const fuente = await Deno.readTextFile(new URL('../supabase/functions/r2-upload/index.ts', import.meta.url))
  for (const h of HOSTS_PROPIOS) cierto(fuente.includes(`'${h}'`), `r2-upload también acepta ${h}`)
  igual(deDondeEs('https://videos.traininglabapp.com/media/abc-123.mp4'), 'subida', 'una subida propia')
  igual(deDondeEs('https://youtu.be/abcdef12'), 'YouTube', 'una liga de YouTube')
  igual(deDondeEs('https://www.tiktok.com/@a/video/12345'), 'TikTok', 'TikTok')
  igual(deDondeEs('https://otro-sitio.com/video.mp4'), null, 'un sitio cualquiera no')
  igual(deDondeEs('https://videos.traininglabapp.com/../secreto'), null, 'ni una ruta rara en nuestro host')
  igual(deDondeEs('https://midrive.com/archivo'), null, 'ni una liga de Drive')
  ok('las direcciones aceptadas son las de r2-upload y las de la app')
}

/* ---- pedir_subida: el permiso de la misma función de la app; el tope; el lote sigue si uno falla ---- */
{
  const { tools } = armar()
  llamadas.length = 0
  const r = sc(await tools.pedir_subida({ archivos: [
    { ejercicio: 'Sentadilla búlgara', tipo: 'video', nombre_archivo: 'bulgara.mp4', bytes: 12_000_000, tipo_de_contenido: 'video/mp4' },
    { ejercicio: 'Back Squat', tipo: 'video', nombre_archivo: 'enorme.mp4', bytes: 6_000_000_000, tipo_de_contenido: 'video/mp4' },
    { ejercicio: 'No existe', tipo: 'video', nombre_archivo: 'x.mp4', bytes: 1000, tipo_de_contenido: 'video/mp4' },
    { ejercicio: 'Back Squat', tipo: 'foto', nombre_archivo: 'portada.jpg', bytes: 80_000, tipo_de_contenido: 'image/jpeg', para_portada: true },
    { ejercicio: 'Back Squat', tipo: 'video', nombre_archivo: 'raro.avi', bytes: 1000, tipo_de_contenido: 'video/x-msvideo' },
    { ejercicio: 'Back Squat', tipo: 'video', nombre_archivo: 'otro.sinespacio', bytes: 1000, tipo_de_contenido: 'video/mp4' },
  ] }))
  igual(r.resultados.map((x: any) => x.ok), [true, false, false, true, false, false], 'cada archivo con su resultado; los buenos siguen')
  cierto(/máximo por archivo/.test(r.resultados[1].error), 'el que pasa el tope se rechaza con el aviso de la app')
  cierto(/No encontré/.test(r.resultados[2].error), 'un ejercicio que no existe')
  cierto(/puede ser/.test(r.resultados[4].error), 'un tipo que r2-upload no acepta, antes de llamarla')
  cierto(/espacio/.test(r.resultados[5].error), 'el error de r2-upload (sin espacio) llega tal cual')
  igual(llamadas.map((p) => [p.carpeta, p.tipo, p.bytes]), [['media', 'video/mp4', 12000000], ['covers', 'image/jpeg', 80000], ['media', 'video/mp4', 1000]], 'solo llamó a r2-upload por los válidos, con su carpeta y tamaño')
  cierto(r.resultados[0].subir_a.startsWith('https://r2.firmada/') && r.resultados[0].url.startsWith('https://videos.traininglabapp.com/'), 'devuelve dónde subir y la url pública')
  igual(r.resultados[0].cabeceras['Cache-Control'], 'public, max-age=31536000, immutable', 'con la misma etiqueta de caché que la app')
  ok('pedir_subida: misma ruta que la app, tope, tipos y lote que sigue')
}

/* ---- poner_medio_a_ejercicio: lote con confirmación, url válida, agrega, portada, reemplazar ---- */
{
  const { tools, datos } = armar()
  const lote = [
    { ejercicio: 'Sentadilla búlgara', url: 'https://videos.traininglabapp.com/media/id-1.mp4', rol: 'ejemplo' },
    { ejercicio: 'Back Squat', url: 'https://youtu.be/abcdef12', rol: 'explicacion' },
    { ejercicio: 'Back Squat', url: 'https://otro-sitio.com/v.mp4', rol: 'ejemplo' },
    { ejercicio: 'Fantasma', url: 'https://videos.traininglabapp.com/media/id-9.mp4', rol: 'ejemplo' },
  ]
  const sin = sc(await tools.poner_medio_a_ejercicio({ medios: lote }))
  igual([sin.guardado, sin.motivo, datos.exercise_media.length], [false, 'falta_confirmacion', 0], 'un lote sin confirmar no escribe nada')
  igual(sin.va_a_pasar.length, 4, 'y enseña la lista «archivo → ejercicio»')
  cierto(sin.va_a_pasar[2].startsWith('✗') && sin.va_a_pasar[3].startsWith('✗'), 'marcando los que no se van a poner')

  const si = sc(await tools.poner_medio_a_ejercicio({ medios: lote, confirmado: true }))
  igual(si.resultados.map((x: any) => x.ok), [true, true, false, false], 'confirmado: cada uno con su resultado, los buenos se ponen')
  cierto(/no viene de pedir_subida/.test(si.resultados[2].error), 'rechaza la url que no es de la subida ni de las plataformas')
  igual(datos.exercise_media.map((m: any) => [m.exercise_id, m.proposito, m.tipo, m.created_by]), [['e-propio', 'ejemplo', 'video', 'coach-1'], ['e-app', 'explicacion', 'video', 'coach-1']], 'agrega como addExerciseMedia (propósito y autor)')

  // Uno solo, nuevo: va directo.
  const uno = sc(await tools.poner_medio_a_ejercicio({ medios: [{ ejercicio: 'Sentadilla búlgara', url: 'https://vimeo.com/123', rol: 'ejemplo' }] }))
  igual([uno.listo, datos.exercise_media.length], [true, 3], 'uno solo y nuevo: se pone sin pedir confirmación')

  // Portada: en lo propio, en el ejercicio; en uno de la app, en TU versión. Reemplazar una que ya había pide confirmación.
  const portadaPropia = sc(await tools.poner_medio_a_ejercicio({ medios: [{ ejercicio: 'Sentadilla búlgara', url: 'https://videos.traininglabapp.com/covers/id-2.jpg', rol: 'portada' }] }))
  igual([portadaPropia.listo, datos.exercises.find((e: any) => e.id === 'e-propio').cover_image_url], [true, 'https://videos.traininglabapp.com/covers/id-2.jpg'], 'la portada de lo propio va en el ejercicio')
  const pisa = sc(await tools.poner_medio_a_ejercicio({ medios: [{ ejercicio: 'Back Squat', url: 'https://videos.traininglabapp.com/covers/id-3.jpg', rol: 'portada' }] }))
  igual(pisa.motivo, 'falta_confirmacion', 'cambiar una portada que ya había pide confirmación')
  await tools.poner_medio_a_ejercicio({ medios: [{ ejercicio: 'Back Squat', url: 'https://videos.traininglabapp.com/covers/id-3.jpg', rol: 'portada' }], confirmado: true })
  igual([datos.exercises.find((e: any) => e.id === 'e-app').cover_image_url, datos.exercise_overrides[0]?.data?.cover_image_url], ['https://videos.traininglabapp.com/covers/vieja.jpg', 'https://videos.traininglabapp.com/covers/id-3.jpg'], 'en un ejercicio de la app va en tu versión; el original no cambia')
  const ligaDePortada = sc(await tools.poner_medio_a_ejercicio({ medios: [{ ejercicio: 'Sentadilla búlgara', url: 'https://youtu.be/abcdef12', rol: 'portada' }] }))
  cierto(ligaDePortada.resultados[0].ok === false, 'una portada no puede ser una liga de YouTube')

  // Reemplazar los ejemplos que ya tenía: con confirmación, quita los suyos de ese propósito y deja el nuevo.
  const pide = sc(await tools.poner_medio_a_ejercicio({ medios: [{ ejercicio: 'Sentadilla búlgara', url: 'https://videos.traininglabapp.com/media/id-5.mp4', rol: 'ejemplo', reemplazar: true }] }))
  igual(pide.motivo, 'falta_confirmacion', 'reemplazar pide confirmación')
  await tools.poner_medio_a_ejercicio({ medios: [{ ejercicio: 'Sentadilla búlgara', url: 'https://videos.traininglabapp.com/media/id-5.mp4', rol: 'ejemplo', reemplazar: true }], confirmado: true })
  igual(datos.exercise_media.filter((m: any) => m.exercise_id === 'e-propio').map((m: any) => m.url), ['https://videos.traininglabapp.com/media/id-5.mp4'], 'quedó solo el nuevo')
  ok('poner_medio_a_ejercicio: lote con confirmación, urls válidas, agrega, portada, reemplazar')
}

console.log('\nTodo bien: medios.')
