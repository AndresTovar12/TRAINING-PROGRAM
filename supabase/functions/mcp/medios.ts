/**
 * AGENTES CON ARCHIVOS (conector v2, 23 nov 2026; spec `docs/superpowers/specs/2026-11-23-conector-v2.md`, parte 2C).
 *
 * Andrés: «entra a mi carpeta de Google Drive, saca estos videos y pónselos a estos ejercicios». Un agente (Claude Code, Codex, Hermes) junta
 * sus herramientas de Drive con las de Training Lab; aquí está la puerta para el archivo, por la MISMA ruta que usa la app:
 *   1. `pedir_subida` llama a la función `r2-upload` con la sesión del coach (los mismos topes, el mismo bucket, el mismo espacio de videos).
 *      Devuelve la dirección firmada para el PUT (vale 6 horas, como en la app) y la dirección pública que se guarda.
 *   2. El agente sube el archivo con PUT a esa dirección.
 *   3. `poner_medio_a_ejercicio` lo pone en el ejercicio como lo hace la app (`addExerciseMedia` → `exercise_media` con su propósito; la portada,
 *      en `cover_image_url`). También acepta ligas de YouTube, TikTok, Instagram y Vimeo (las mismas que la app: `app/ligas.js`).
 * Todo va en lote, con el resultado de cada uno: si uno falla, los demás siguen. Un lote, reemplazar o quitar lo que ya estaba piden
 * `confirmado: true` (antes, la herramienta devuelve la lista «archivo → ejercicio» para enseñársela a la persona).
 */
import type { McpServer } from 'npm:@modelcontextprotocol/sdk@1.30.1/server/mcp.js'
import { z } from 'npm:zod@^4.1.13'
import { llamarFuncion, type Quien } from './sesion.ts'
import { Aviso, mismoTexto, respuesta, seguro } from './util.ts'
import { repertorioConFicha } from './comunes.ts'
import { ESCRIBE } from './coach.ts'
import { LIGAS, ligaExterna } from './app/ligas.js'
import { avisoSiEsMuyGrande } from './app/espacio.js'

/* Las direcciones públicas de NUESTRAS subidas: las mismas tres que acepta `r2-upload` (su `HOSTS_PROPIOS`, líneas 26-29). No se importan
   de ahí porque esa función arranca un servidor al cargarse; `scripts/prueba-mcp-medios.ts` revisa que sigan iguales. */
export const HOSTS_PROPIOS = ['https://videos.traininglabapp.com', 'https://pub-4a3ae85521d744b5abf16550ea171189.r2.dev']
const RUTA_EN_URL = /^\/(?:videos|covers|media)\/[A-Za-z0-9._-]+$/
// Lo que acepta `r2-upload` (su `TIPOS_OK`): si se pide otro, la función lo rechaza igual; aquí se dice antes, sin gastar la llamada.
export const TIPOS_DE_ARCHIVO = { video: ['video/mp4', 'video/quicktime', 'video/webm'], foto: ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] } as const
// La etiqueta que la app le pone a cada archivo para que el teléfono guarde su copia (`CACHE_ETERNO` en `src/lib/api.js`).
const CACHE_ETERNO = 'public, max-age=31536000, immutable'
const PLATAFORMAS = LIGAS.map((l: any) => l.de as string)

/** ¿Es una dirección que se puede poner en un ejercicio? → 'subida' | la plataforma | null. */
export function deDondeEs(url: string): string | null {
  let u: URL
  try { u = new URL(String(url).trim()) } catch { return null }
  if (HOSTS_PROPIOS.includes(u.origin) && RUTA_EN_URL.test(u.pathname) && !u.search) return 'subida'
  const liga = ligaExterna(url)
  return liga && PLATAFORMAS.includes(liga.de) ? liga.de : null
}

const ROL = z.enum(['ejemplo', 'explicacion', 'portada'])

export function herramientasDeMedios(server: McpServer, quien: Quien) {
  const esMaster = quien.rol === 'master'

  /** El ejercicio de un renglón, por id o nombre exacto, entre los que esta persona puede ver. */
  async function fichas() {
    const { filas } = await repertorioConFicha(quien)
    return (ref: string) => filas.find((f: any) => f.id === ref) ?? filas.find((f: any) => mismoTexto(f.name, ref)) ?? null
  }

  server.registerTool('pedir_subida', {
    title: 'Pedir permiso para subir un archivo',
    description: 'SOLO para agentes que pueden subir archivos (Claude Code, Codex, Hermes); en un chat sin archivos usa ligas de YouTube, TikTok, Instagram o Vimeo con poner_medio_a_ejercicio. '
      + 'Por cada archivo devuelve "subir_a" (PUT, vale 6 horas) y "url". Sube así: curl -X PUT -H "Content-Type: <tipo_de_contenido>" -H "Cache-Control: '
      + `${CACHE_ETERNO}" --upload-file <archivo> "<subir_a>" (el tamaño debe ser EXACTO al declarado). Después ponlo con poner_medio_a_ejercicio y la "url". `
      + 'Si tienes ffmpeg, antes ponle el índice al video para que el primer cuadro salga al instante: ffmpeg -i entrada -c copy -movflags +faststart salida.mp4 (y declara el tamaño de salida). '
      + 'Antes de un lote, enséñale a la persona UNA vez la lista «archivo → ejercicio» y espera su sí; un archivo que no encaje con ningún ejercicio, pregúntalo en esa misma lista.',
    inputSchema: {
      archivos: z.array(z.object({
        ejercicio: z.string().describe('El ejercicio (nombre exacto del repertorio o su id).'),
        tipo: z.enum(['video', 'foto']),
        nombre_archivo: z.string(),
        bytes: z.number().positive().describe('El tamaño EXACTO en bytes (R2 rechaza la subida si no coincide).'),
        tipo_de_contenido: z.string().describe(`${TIPOS_DE_ARCHIVO.video.join(', ')} o ${TIPOS_DE_ARCHIVO.foto.join(', ')}.`),
        para_portada: z.boolean().optional().describe('true si la foto va de portada (se guarda en su carpeta de portadas).'),
      })).min(1).max(50),
    },
    annotations: { ...ESCRIBE, idempotentHint: false },
  }, seguro(async ({ archivos }: any) => {
    const ficha = await fichas()
    const resultados = []
    for (const a of archivos) {
      try {
        const e = ficha(a.ejercicio)
        if (!e) throw new Aviso(`No encontré «${a.ejercicio}» en el repertorio.`)
        const tipo = String(a.tipo_de_contenido).trim().toLowerCase()
        if (!(TIPOS_DE_ARCHIVO[a.tipo as 'video' | 'foto'] as readonly string[]).includes(tipo)) throw new Aviso(`«${a.nombre_archivo}»: un ${a.tipo} puede ser ${TIPOS_DE_ARCHIVO[a.tipo as 'video' | 'foto'].join(', ')} (llegó ${tipo}).`)
        const grande = avisoSiEsMuyGrande(a.bytes)
        if (grande) throw new Aviso(`«${a.nombre_archivo}»: ${grande}`)
        const extension = (String(a.nombre_archivo).split('.').pop() || (a.tipo === 'video' ? 'mp4' : 'jpg')).toLowerCase()
        const carpeta = a.tipo === 'foto' && a.para_portada ? 'covers' : 'media'
        // La MISMA función que usa la app (`uploadExerciseMedia`): ella revisa el permiso, los topes y el espacio, y firma.
        const permiso = await llamarFuncion(quien, 'r2-upload', { tipo, extension, carpeta, bytes: Math.round(a.bytes) })
        resultados.push({ archivo: a.nombre_archivo, ejercicio: e.name, ok: true, subir_a: permiso.subir_a, url: permiso.url_publica, cabeceras: { 'Content-Type': tipo, 'Cache-Control': CACHE_ETERNO } })
      } catch (err) {
        resultados.push({ archivo: a.nombre_archivo, ejercicio: a.ejercicio, ok: false, error: (err as Error).message })
      }
    }
    const malos = resultados.filter((r) => !r.ok).length
    return respuesta({
      listo: malos === 0, resultados,
      ...(malos ? { nota: `${malos} de ${resultados.length} no tienen permiso; los demás sí se pueden subir.` } : {}),
      siguiente: 'Sube cada archivo con PUT a "subir_a" (con esas cabeceras) y luego llama poner_medio_a_ejercicio con su "url".',
    })
  }))

  server.registerTool('poner_medio_a_ejercicio', {
    title: 'Poner un video o una foto en un ejercicio',
    description: 'Pone en un ejercicio un video o foto: la "url" de pedir_subida (después de subirlo) o una liga de YouTube, TikTok, Instagram o Vimeo. '
      + 'rol: ejemplo (cómo se hace), explicacion (el video que explica) o portada. Por defecto AGREGA. Va en lote, con el resultado de cada uno; si uno falla, los demás siguen. '
      + 'Más de uno a la vez, reemplazar (reemplazar: true) o quitar lo que ya estaba piden confirmado: true; sin él te devuelve la lista para enseñársela a la persona.',
    inputSchema: {
      medios: z.array(z.object({
        ejercicio: z.string(),
        url: z.string(),
        rol: ROL,
        tipo: z.enum(['video', 'foto']).optional().describe('Si no se dice: foto para la portada, video para lo demás.'),
        reemplazar: z.boolean().optional().describe('true para quitar los que ya tenía con ese rol (o la portada) y dejar este. Pide confirmado.'),
      })).min(1).max(50),
      confirmado: z.boolean().optional().describe('true solo después de enseñarle a la persona la lista «archivo → ejercicio» (o lo que se reemplaza) y que diga que sí.'),
    },
    annotations: ESCRIBE,
  }, seguro(async ({ medios, confirmado }: any) => {
    const ficha = await fichas()
    // Primero se revisa TODO (sin escribir): qué va a dónde y qué se reemplazaría.
    const plan = medios.map((m: any) => {
      const e = ficha(m.ejercicio)
      const origen = deDondeEs(m.url)
      const tipo = m.tipo ?? (m.rol === 'portada' ? 'foto' : 'video')
      const error = !e ? `No encontré «${m.ejercicio}» en el repertorio.`
        : !origen ? 'La url no viene de pedir_subida ni de YouTube, TikTok, Instagram o Vimeo.'
        : m.rol === 'portada' && origen !== 'subida' ? 'Una portada tiene que ser una foto subida con pedir_subida.'
        : m.rol === 'explicacion' && tipo !== 'video' ? 'La explicación es un video.'
        : null
      return { m, e, origen, tipo, error }
    })
    const reemplaza = plan.filter((p: any) => !p.error && (p.m.reemplazar || (p.m.rol === 'portada' && p.e.cover_image_url)))
    if (!confirmado && (medios.length > 1 || reemplaza.length)) {
      return respuesta({
        guardado: false, motivo: 'falta_confirmacion',
        va_a_pasar: plan.map((p: any) => p.error
          ? `✗ ${p.m.url} → «${p.m.ejercicio}»: ${p.error}`
          : `${p.m.url.split('/').pop()} → ${p.e.name} (${p.m.rol}${p.m.reemplazar || (p.m.rol === 'portada' && p.e.cover_image_url) ? ', REEMPLAZA lo que había' : ''})`),
        que_hacer: 'Enséñale esta lista a la persona y, si dice que sí, vuelve a llamar con confirmado: true. Los que traen ✗ no se van a poner.',
      })
    }
    const resultados = []
    for (const p of plan) {
      if (p.error) { resultados.push({ ejercicio: p.m.ejercicio, url: p.m.url, ok: false, error: p.error }); continue }
      try {
        const propio = p.e.created_by === quien.id || esMaster
        if (p.m.rol === 'portada') {
          if (propio) {
            const { error } = await quien.db.from('exercises').update({ cover_image_url: p.m.url, updated_at: new Date().toISOString() }).eq('id', p.e.id)
            if (error) throw new Error(error.message)
          } else {
            // Un ejercicio de la app: la portada va en TU versión, como «Mi versión» en la app (igual que editar_ejercicio).
            const { data: previa } = await quien.db.from('exercise_overrides').select('data').eq('coach_id', quien.id).eq('exercise_id', p.e.id).maybeSingle()
            const { error } = await quien.db.from('exercise_overrides').upsert(
              { coach_id: quien.id, exercise_id: p.e.id, data: { ...((previa as any)?.data ?? {}), cover_image_url: p.m.url }, updated_at: new Date().toISOString() },
              { onConflict: 'coach_id,exercise_id' },
            )
            if (error) throw new Error(error.message)
          }
        } else {
          const proposito = p.tipo === 'video' && p.m.rol === 'explicacion' ? 'explicacion' : 'ejemplo'
          if (p.m.reemplazar) {
            const { error } = await quien.db.from('exercise_media').delete().eq('exercise_id', p.e.id).eq('created_by', quien.id).eq('proposito', proposito).eq('tipo', p.tipo)
            if (error) throw new Error(error.message)
          }
          // Como `addExerciseMedia` de la app (src/lib/api.js).
          const { error } = await quien.db.from('exercise_media').insert({
            exercise_id: p.e.id, url: p.m.url, tipo: p.tipo, proposito, etiqueta: null, genero: null, para_atleta: null,
            recorte_inicio: null, recorte_fin: null, sin_audio: false, encuadre: null, created_by: quien.id,
          })
          if (error) throw new Error(error.message)
        }
        resultados.push({ ejercicio: p.e.name, url: p.m.url, rol: p.m.rol, ok: true, ...(p.origen !== 'subida' ? { plataforma: p.origen } : {}) })
      } catch (err) {
        resultados.push({ ejercicio: p.e.name, url: p.m.url, ok: false, error: (err as Error).message })
      }
    }
    const malos = resultados.filter((r: any) => !r.ok).length
    return respuesta({ listo: malos === 0, resultados, ...(malos ? { nota: `${resultados.length - malos} de ${resultados.length} quedaron puestos; los demás dicen por qué no.` } : {}) })
  }))
}
