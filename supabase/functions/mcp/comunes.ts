// deno-lint-ignore-file no-explicit-any
import type { McpServer } from 'npm:@modelcontextprotocol/sdk@1.30.1/server/mcp.js'
import { z } from 'npm:zod@^4.1.13'
import type { Quien } from './sesion.ts'
import { Aviso, fechaDelAtleta, NOMBRE_DIA, respuesta, seguro, sinAcentos } from './util.ts'
import { ZONA } from './config.ts'

const SOLO_LEER = { readOnlyHint: true, openWorldHint: false } as const

const ROL_TEXTO = { atleta: 'atleta', coach: 'coach', master: 'administrador de Training Lab' } as const

/**
 * El repertorio que esta persona usa en la app, con la versión de su coach
 * puesta encima (si el coach personalizó un ejercicio de la app, se ve el
 * suyo: es lo que el atleta ve en su pantalla).
 */
export async function repertorioConFicha(quien: Quien) {
  const { data: masterId } = await quien.db.rpc('master_id')
  const coachDeReferencia = quien.rol === 'atleta' ? quien.coachId : quien.id
  let q = quien.db
    .from('exercises')
    .select('id, name, description, equipment, muscle_primary, muscle_secondary, video_url, video_link, cover_image_url, created_by, category:exercise_categories(name, slug)')
    .order('name')
  // El master ve todo en la app; los demás, lo de la app más lo suyo (o lo de su coach).
  if (quien.rol !== 'master') q = q.in('created_by', [masterId, coachDeReferencia].filter(Boolean) as string[])
  const { data, error } = await q
  if (error) throw new Error(error.message)

  let filas = (data ?? []) as any[]
  if (coachDeReferencia) {
    const { data: versiones } = await quien.db
      .from('exercise_overrides')
      .select('exercise_id, data')
      .eq('coach_id', coachDeReferencia)
    const porId = new Map((versiones ?? []).map((v: any) => [v.exercise_id, v.data ?? {}]))
    filas = filas.map((e) => (porId.has(e.id) ? { ...e, ...porId.get(e.id) } : e))
  }
  return { filas, masterId: masterId as string | null }
}

export function fichaCorta(e: any) {
  const musculos = [...(e.muscle_primary ?? []), ...(e.muscle_secondary ?? [])]
  return {
    id: e.id,
    nombre: e.name,
    ...(e.category?.name ? { categoria: e.category.name } : {}),
    ...(e.equipment ? { equipo: e.equipment } : {}),
    ...(musculos.length ? { musculos } : {}),
    ...(e.video_link || e.video_url ? { video: e.video_link || e.video_url } : {}),
  }
}

export function herramientasComunes(server: McpServer, quien: Quien) {
  server.registerTool('quien_soy', {
    title: 'Quién soy en Training Lab',
    description: 'Dice con qué cuenta de Training Lab estás conectado: nombre, usuario, si eres atleta, coach o administrador, tu coach (si eres atleta), la unidad de peso que usas y qué día es hoy para la app. Úsala al empezar si no sabes con quién hablas.',
    inputSchema: {},
    annotations: SOLO_LEER,
  }, seguro(async () => {
    let coach = null
    if (quien.coachId) {
      const { data } = await quien.db.from('profiles').select('full_name, username').eq('id', quien.coachId).maybeSingle()
      if (data) coach = { nombre: data.full_name || data.username, usuario: data.username }
    }
    const hoy = fechaDelAtleta()
    return respuesta({
      nombre: quien.nombre,
      usuario: quien.usuario,
      rol: ROL_TEXTO[quien.rol],
      ...(coach ? { coach } : {}),
      unidad_de_peso: quien.unidad,
      hoy: { fecha: hoy.texto, dia: NOMBRE_DIA[hoy.dia], zona_horaria: ZONA },
    })
  }))

  server.registerTool('buscar_ejercicios', {
    title: 'Buscar ejercicios del repertorio',
    description: 'Busca en el repertorio de ejercicios de Training Lab (los de la app y los del coach). Sirve para encontrar un ejercicio por nombre, por categoría, por equipo o por músculo, y para proponer ALTERNATIVAS cuando falta un aparato: busca por el músculo o el patrón del original y quédate con los que usan otro equipo. Devuelve cada ejercicio con su video si tiene.',
    inputSchema: {
      texto: z.string().optional().describe('Palabras a buscar en el nombre, la descripción, el equipo o los músculos. Ej.: "sentadilla", "remo", "mancuerna".'),
      categoria: z.string().optional().describe('Categoría, ej.: Hipertrofia, Fuerza, Potencia, Pliometría, Atlético, Core, Movilidad, Acondicionamiento.'),
      equipo: z.string().optional().describe('Equipo, ej.: barra, mancuernas, banda, peso corporal.'),
      musculo: z.string().optional().describe('Músculo, ej.: cuádriceps, glúteo, dorsal.'),
      limite: z.number().int().min(1).max(60).optional().describe('Cuántos devolver como máximo. 25 si no se dice.'),
    },
    annotations: SOLO_LEER,
  }, seguro(async ({ texto, categoria, equipo, musculo, limite }: any) => {
    const { filas } = await repertorioConFicha(quien)
    const t = texto ? sinAcentos(texto) : null
    const palabras = t ? t.split(/\s+/).filter(Boolean) : []
    const encontrados = filas.filter((e) => {
      const todo = sinAcentos([e.name, e.description, e.equipment, ...(e.muscle_primary ?? []), ...(e.muscle_secondary ?? [])].join(' '))
      if (palabras.length && !palabras.every((p) => todo.includes(p))) return false
      if (categoria && !sinAcentos(`${e.category?.name ?? ''} ${e.category?.slug ?? ''}`).includes(sinAcentos(categoria))) return false
      if (equipo && !sinAcentos(e.equipment ?? '').includes(sinAcentos(equipo))) return false
      if (musculo && !sinAcentos([...(e.muscle_primary ?? []), ...(e.muscle_secondary ?? [])].join(' ')).includes(sinAcentos(musculo))) return false
      return true
    })
    const tope = limite ?? 25
    return respuesta({
      total: encontrados.length,
      ejercicios: encontrados.slice(0, tope).map(fichaCorta),
      ...(encontrados.length > tope ? { nota: `Hay ${encontrados.length}; se muestran ${tope}. Afina la búsqueda para ver otros.` } : {}),
    })
  }))

  server.registerTool('ver_ejercicio', {
    title: 'Ver un ejercicio',
    description: 'La ficha completa de un ejercicio del repertorio: descripción, equipo, músculos y todos sus videos y fotos (con para quién es cada uno).',
    inputSchema: {
      ejercicio: z.string().describe('El id del ejercicio o su nombre exacto.'),
    },
    annotations: SOLO_LEER,
  }, seguro(async ({ ejercicio }: any) => {
    const { filas } = await repertorioConFicha(quien)
    const e = filas.find((f) => f.id === ejercicio)
      ?? filas.find((f) => sinAcentos(f.name) === sinAcentos(ejercicio))
      ?? (() => {
        const parecidos = filas.filter((f) => sinAcentos(f.name).includes(sinAcentos(ejercicio)))
        if (parecidos.length === 1) return parecidos[0]
        if (parecidos.length > 1) {
          throw new Aviso(`Hay varios ejercicios parecidos a "${ejercicio}": ${parecidos.slice(0, 8).map((p) => p.name).join(', ')}.`)
        }
        return null
      })()
    if (!e) throw new Aviso(`No encontré el ejercicio "${ejercicio}" en el repertorio.`)

    const { data: medios } = await quien.db
      .from('exercise_media')
      .select('url, tipo, etiqueta, genero, para_atleta')
      .eq('exercise_id', e.id)
      .order('orden')
    // Un video grabado para un atleta en particular solo lo ve ese atleta.
    const visibles = (medios ?? []).filter((m: any) => !m.para_atleta || m.para_atleta === quien.id || quien.rol !== 'atleta')
    return respuesta({
      ...fichaCorta(e),
      ...(e.description ? { descripcion: e.description } : {}),
      ...(e.cover_image_url ? { foto: e.cover_image_url } : {}),
      otros_medios: visibles.map((m: any) => ({
        tipo: m.tipo,
        url: m.url,
        para: m.para_atleta ? 'un atleta en particular' : m.genero === 'h' ? 'hombres' : m.genero === 'm' ? 'mujeres' : 'todos',
        ...(m.etiqueta ? { etiqueta: m.etiqueta } : {}),
      })),
    })
  }))
}
