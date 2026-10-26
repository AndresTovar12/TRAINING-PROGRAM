// deno-lint-ignore-file no-explicit-any
import type { McpServer } from 'npm:@modelcontextprotocol/sdk@1.30.1/server/mcp.js'
import { z } from 'npm:zod@^4.1.13'
import type { Quien } from './sesion.ts'
import { Aviso, diaDesdeTexto, fechaDelAtleta, nombreDe, NOMBRE_DIA, respuesta, seguro, sinAcentos, mismoTexto, buscarPersona, sinConfirmarBorrado, TEXTO_CONFIRMADO_BORRAR } from './util.ts'
import {
  armarFasesDeLaIA, avisosDeRespuestas, BORRA, CIENCIA, ESCRIBE, ESTRUCTURA_OK, FASE, FASES, planDe, SESION_CON_DIA, SIN_CANTIDAD_OK, SIN_FICHA_OK, SOLO_LEER,
} from './coach.ts'
import {
  buscarFase, buscarSemana, describirDia, describirSemana, diaDesdeEntrada, fasesDe, guardarFases, normalizar, planQueEdito, repertorioVisible, tipoDePlan,
} from './plan.ts'
import { anotarDia, exigirRespuestas, nuevaRevision } from './preguntas.ts'
import { claseDe } from './app/clases.js'
import { dondeVa } from './app/training-utils.js'
import { cursorDe, estadoDe } from './atleta.ts'
import {
  cabeCarpetaEn, descendientesDe, diasDeWorkout, esDeUnDia, ETIQUETA_DE_TIPO, planDePrograma, planDeRutina, programaDePlan, puedeMoverCarpeta, resumenDe, rutinaDePlan, rutinaDeSemana,
  textoDeResumen, textoDeRuta, workoutDeSesiones,
} from './app/misPlanesDatos.js'

/**
 * MIS PLANES EN EL CONECTOR DE IA (13 oct 2026).
 *
 * Andrés, al ver a ChatGPT decir «el conector no puede guardar un plan progresivo en Mis planes»: la IA tiene que poder hacer lo que hace la app.
 * «Mis planes» es el catálogo de cada profesional: PROGRAMAS (por fases), RUTINAS semanales, WORKOUTS (un día) y CLASES (un workout con video),
 * ordenados en carpetas. Lo guardado es una COPIA: cambiarlo después no mueve lo que un atleta ya recibió, ni al revés.
 *
 * Dónde vive (las mismas tablas que la app; `src/lib/misPlanes.js` y `misPlanesDatos.js` son la fuente, esta última se copia a `app/`):
 *   programa → `programas_guardados` · rutina (kind 'week') y workout/clase (kind 'day') → `routine_templates` · carpetas → `carpetas_planes`.
 * Cada profesional ve y toca solo lo suyo: lo impone la base (RLS), igual que en la app.
 */

export type Tipo = 'programa' | 'rutina' | 'workout' | 'clase'
type Tabla = 'routine_templates' | 'programas_guardados'
export interface Item { id: string; tabla: Tabla; tipo: Tipo; nombre: string; descripcion: string; origen: string; carpetaId: string | null; resumen: any; demo: boolean; actualizado: string | null }

const TIPOS = ['programa', 'rutina', 'workout', 'clase'] as const
const TIPO = z.enum(TIPOS)
const KIND_DE: Record<string, string> = { rutina: 'week', workout: 'day', clase: 'day' }
const TABLA_DE: Record<Tipo, Tabla> = { programa: 'programas_guardados', rutina: 'routine_templates', workout: 'routine_templates', clase: 'routine_templates' }
const SIN_CARPETA = new Set(['', 'sin carpeta', 'ninguna', 'ninguno', 'arriba de todo', 'raiz', 'raíz'])

const tipoDeFila = (fila: any, tabla: Tabla): Tipo => {
  if (tabla === 'programas_guardados') return 'programa'
  if (fila.kind === 'week') return 'rutina'
  return fila.resumen?.clase ? 'clase' : 'workout'
}

const comoItem = (fila: any, tabla: Tabla): Item => ({
  id: fila.id,
  tabla,
  tipo: tipoDeFila(fila, tabla),
  nombre: fila.name,
  descripcion: fila.descripcion ?? '',
  origen: fila.origen ?? '',
  carpetaId: fila.carpeta_id ?? null,
  resumen: fila.resumen ?? null,
  demo: !!fila.demo,
  actualizado: fila.updated_at ?? null,
})

const COLUMNAS = 'id, name, descripcion, origen, carpeta_id, resumen, created_at, updated_at'

/** Todas las carpetas y todo lo guardado de quien llama (sin el contenido de cada cosa). */
export async function leerMisPlanes(quien: Quien) {
  const [car, pla, pro] = await Promise.all([
    quien.db.from('carpetas_planes').select('*').eq('owner_id', quien.id),
    quien.db.from('routine_templates').select(`${COLUMNAS}, kind, demo`).eq('created_by', quien.id),
    quien.db.from('programas_guardados').select(COLUMNAS).eq('created_by', quien.id),
  ])
  for (const r of [car, pla, pro]) if (r.error) throw new Error(r.error.message)
  const carpetas: any[] = car.data ?? []
  const items: Item[] = [
    ...(pla.data ?? []).map((f: any) => comoItem(f, 'routine_templates')),
    ...(pro.data ?? []).map((f: any) => comoItem(f, 'programas_guardados')),
  ]
  // Lo guardado antes de que existiera el resumen no lo trae: se calcula al vuelo (aquí no se escribe nada, leer no cambia datos).
  for (const tabla of ['routine_templates', 'programas_guardados'] as Tabla[]) {
    const sin = items.filter((i) => i.tabla === tabla && !i.resumen)
    if (!sin.length) continue
    const { data } = await quien.db.from(tabla).select('id, data').in('id', sin.map((i) => i.id))
    for (const fila of data ?? []) {
      const it = sin.find((i) => i.id === fila.id)
      if (!it) continue
      it.resumen = resumenDe(it.tipo, fila.data)
      if (it.resumen?.clase) it.tipo = 'clase'
    }
  }
  return { carpetas, items }
}

const rutaTexto = (carpetas: any[], id: string | null) => textoDeRuta(carpetas, id)
const comoLinea = (i: Item, carpetas: any[]) => ({
  id: i.id,
  tipo: i.tipo,
  nombre: i.nombre,
  ...(i.descripcion ? { descripcion: i.descripcion } : {}),
  carpeta: rutaTexto(carpetas, i.carpetaId),
  resumen: textoDeResumen(i.tipo, i.resumen),
  ...(i.demo ? { demo: true } : {}),
})

/** Una carpeta por su id, su nombre o su ruta («Fútbol › Fuerza»). Con `null`/vacío = sin carpeta (devuelve `null`). */
function buscarCarpeta(carpetas: any[], ref: string | null | undefined): any | null {
  const r = String(ref ?? '').trim()
  if (SIN_CARPETA.has(sinAcentos(r))) return null
  const porId = carpetas.find((c) => c.id === r)
  if (porId) return porId
  const partes = r.split(/\s*(?:›|>|\/)\s*/).map(sinAcentos).filter(Boolean)
  const nombres = (c: any) => sinAcentos(c.nombre)
  // Ruta completa desde arriba de todo.
  if (partes.length > 1) {
    let actual: any = null
    for (const parte of partes) {
      actual = carpetas.find((c) => (c.parent_id ?? null) === (actual?.id ?? null) && nombres(c) === parte)
      if (!actual) break
    }
    if (actual) return actual
  }
  const mismas = carpetas.filter((c) => nombres(c) === (partes[partes.length - 1] ?? ''))
  if (mismas.length === 1) return mismas[0]
  if (mismas.length > 1) throw new Aviso(`Hay ${mismas.length} carpetas llamadas "${r}": ${mismas.map((c) => `«${textoDeRuta(carpetas, c.id)}»`).join(', ')}. Dime la ruta completa (ej.: "${textoDeRuta(carpetas, mismas[0].id)}").`)
  const hay = carpetas.length ? ` Tus carpetas: ${carpetas.map((c) => `«${textoDeRuta(carpetas, c.id)}»`).join(', ')}.` : ' Todavía no tienes carpetas: crea una con crear_carpeta.'
  throw new Aviso(`No encontré la carpeta "${r}".${hay}`)
}

/** Una cosa guardada por su id o su nombre. Si hay varias con ese nombre, pide cuál. */
export function buscarItem(items: Item[], carpetas: any[], ref: string, tipo?: Tipo): Item {
  const r = String(ref ?? '').trim()
  const lista = tipo ? items.filter((i) => i.tipo === tipo) : items
  const porId = lista.find((i) => i.id === r)
  if (porId) return porId
  const iguales = lista.filter((i) => mismoTexto(i.nombre, r))
  if (iguales.length === 1) return iguales[0]
  const como = (i: Item) => `${ETIQUETA_DE_TIPO[i.tipo]} «${i.nombre}» en ${rutaTexto(carpetas, i.carpetaId)} (id ${i.id})`
  if (iguales.length > 1) throw new Aviso(`Hay ${iguales.length} con el nombre "${r}": ${iguales.map(como).join('; ')}. Dime cuál: por su id, o agrega el tipo.`)
  const parecidos = lista.filter((i) => sinAcentos(i.nombre).includes(sinAcentos(r)))
  if (parecidos.length === 1) return parecidos[0]
  if (parecidos.length > 1) throw new Aviso(`"${r}" se parece a varios: ${parecidos.slice(0, 8).map(como).join('; ')}. Dime cuál: por su id.`)
  throw new Aviso(`No encontré "${r}" en Mis planes. Míralo con ver_mis_planes.`)
}

/** ¿Esta sesión es de alguno de estos tipos? Se compara con el nombre del tipo («gym», «Correr», uno propio…). */
function esDeTipo(dia: any, tipos: string[]) {
  const nombres = [dia?.cat, dia?.catNombre].filter(Boolean).map((x: string) => sinAcentos(x))
  return tipos.some((t) => nombres.includes(sinAcentos(t)))
}

/** Aplica el filtro «solo estos tipos» / «sin estos tipos» a los días de una lista; devuelve los que quedan y cuántos se quitaron. */
function filtrarDias(dias: any[], solo?: string[], sin?: string[]) {
  const quedan = dias.filter((d) => (!solo?.length || esDeTipo(d, solo)) && !(sin?.length && esDeTipo(d, sin)))
  return { quedan, quitadas: dias.length - quedan.length }
}

const sesionesReales = (fases: any[]) => fases.reduce((n, f) => n + (f.weekData ?? []).reduce((m: number, w: any) => m + (w.days ?? []).length, 0), 0)

/** Quita de las fases (ya copiadas) las sesiones que el filtro no deja; devuelve cuántas quitó. */
function filtrarFases(fases: any[], solo?: string[], sin?: string[]) {
  let quitadas = 0
  for (const f of fases) {
    for (const w of f.weekData ?? []) {
      const r = filtrarDias(w.days ?? [], solo, sin)
      quitadas += r.quitadas
      w.days = r.quedan
    }
  }
  return quitadas
}

/** Un plan sin ninguna sesión (una rutina que se quedó vacía) cuenta como «sin plan»: se le puede dar uno sin preguntar (igual que la app, `esProgramaFantasma`). */
const sinSesiones = (plan: any) => !fasesDe(plan).some((f) => (f.weekData ?? []).some((w: any) => (w.days ?? []).some((d: any) => d.cat !== 'off')))
const esFantasma = (plan: any) => plan?.data?.kind === 'weekly' && sinSesiones(plan)

interface Copia { tipo: Tipo; data: any; origen: string; quitadas: number }
interface Filtros { fases_elegidas?: string[]; fase?: string; semana?: number; dia?: string; solo_tipos?: string[]; sin_tipos?: string[] }

/** Una copia de lo que hay en el plan de un atleta (todo, algunas fases, una semana o un día), con el filtro de tipos. No escribe nada. */
async function copiaDelPlanDeAtleta(quien: Quien, desde: string, f: Filtros, de?: string | null): Promise<Copia & { persona: any }> {
  const { persona, plan } = await planDe(quien, desde, de)
  const origen = `Del plan de ${nombreDe(persona)}`
  const todas = fasesDe(plan)
  if (!todas.length) throw new Aviso('Ese plan no tiene fases.')
  const semanaDe = (fase: any) => fase.weekData[buscarSemana(fase, f.semana ?? (fase.weekData.length === 1 ? fase.weekData[0].num : undefined))]
  if (f.dia) {
    const fase = todas[buscarFase(plan, f.fase)]
    const w = semanaDe(fase)
    const clave = diaDesdeTexto(f.dia)
    const delDia = structuredClone((w.days ?? []).filter((d: any) => d.day === clave))
    if (!delDia.length) throw new Aviso(`Ese día no tiene sesión en la semana ${w.num}.`)
    const r = filtrarDias(delDia, f.solo_tipos, f.sin_tipos)
    if (!r.quedan.length) throw new Aviso('Con ese filtro no queda ninguna sesión en ese día.')
    const data = workoutDeSesiones(r.quedan)
    return { persona, tipo: claseDe(data) ? 'clase' : 'workout', data, origen, quitadas: r.quitadas }
  }
  if (f.semana !== undefined) {
    const fase = todas[buscarFase(plan, f.fase)]
    const w = semanaDe(fase)
    const r = filtrarDias(structuredClone(w.days ?? []), f.solo_tipos, f.sin_tipos)
    return { persona, tipo: 'rutina', data: { ...rutinaDeSemana({ days: r.quedan }) }, origen, quitadas: r.quitadas }
  }
  if (tipoDePlan(plan) === 'weekly') {
    const r = filtrarDias(structuredClone(todas[0]?.weekData?.[0]?.days ?? []), f.solo_tipos, f.sin_tipos)
    return { persona, tipo: 'rutina', data: rutinaDePlan({ phases: [{ weekData: [{ days: r.quedan }] }], foto: plan.data?.foto, ciencia: plan.data?.ciencia }), origen, quitadas: r.quitadas }
  }
  const elegidas = f.fases_elegidas?.length
    ? [...new Set(f.fases_elegidas.map((x: string) => buscarFase(plan, x)))].sort((p: any, q: any) => p - q).map((i: any) => todas[i])
    : todas
  const copia = structuredClone(elegidas)
  const quitadas = filtrarFases(copia, f.solo_tipos, f.sin_tipos)
  if (!sesionesReales(copia)) throw new Aviso('Con ese filtro no queda ninguna sesión.')
  const delPlan: any = plan.data ?? {}
  const data = programaDePlan({ kind: delPlan.kind, estructura: delPlan.estructura, phases: copia, foto: delPlan.foto, ciencia: f.fases_elegidas?.length ? undefined : delPlan.ciencia })
  return { persona, tipo: 'programa', data, origen, quitadas }
}

/** Lo que dice un plan en palabras: «2 fase(s), 3 semana(s)». */
const tamanoDe = (fases: any[]) => `${fases.length} fase(s), ${fases.reduce((n, f) => n + (f.weekData ?? []).length, 0)} semana(s)`

/**
 * Le deja un plan armado (`plan` = lo que devuelven `planDePrograma` y `planDeRutina`, con ids de fase nuevos) a UN atleta: sobre el que ya tenía con este profesional, o como el primero.
 * Igual que `asignarPlan` de la app: la foto y la ciencia son del plan que se entrega. La versión anterior la guarda sola la base (se recupera con deshacer_cambio_del_plan).
 */
async function entregarPlan(quien: Quien, o: { persona: any; previo: any | null; profesionalId: string | null; titulo: string; plan: any }) {
  const data = { kind: o.plan.kind, estructura: o.plan.estructura, phases: normalizar(o.plan.phases), foto: o.plan.foto ?? '', ciencia: o.plan.ciencia ?? [] }
  if (o.previo) {
    const { data: fila, error } = await quien.db.from('plans').update({ title: o.titulo, data, updated_at: new Date().toISOString() }).eq('id', o.previo.id).select('id').maybeSingle()
    if (error) throw new Error(error.message)
    if (!fila) throw new Aviso('No tienes permiso para cambiar el plan de esta persona.')
    return
  }
  const { error } = await quien.db.from('plans').insert({ user_id: o.persona.id, profesional_id: o.profesionalId, title: o.titulo, status: 'active', data, created_by: quien.id })
  if (error) {
    if (/row-level security|permission/i.test(error.message)) throw new Aviso(`No puedes darle un plan a ${nombreDe(o.persona)}: no es tu atleta.`)
    throw new Error(error.message)
  }
}

/**
 * Pone un workout (o una clase) en un día del plan de un atleta. Sin fase ni semana, en la semana en que va HOY (con el puntero de su app).
 * `modo`: 'agregar' (otra sesión ese día) o 'reemplazar' (el lugar de la PRIMERA de ese día; las demás se quedan). Nunca mueve ni quita lo que ya tenía: lo que anota el atleta
 * se guarda por la posición de cada sesión (igual que `ponerWorkoutEnPlan` de la app).
 */
async function ponerWorkoutEnElPlan(quien: Quien, persona: any, plan: any, o: { data: any; nombre: string; dia: string; modo: string; fase?: string; semana?: number }) {
  const fases = structuredClone(fasesDe(plan))
  const kind = tipoDePlan(plan)
  let fIdx = 0
  let sIdx = 0
  if ((o.fase !== undefined && o.fase !== '') || o.semana !== undefined) {
    fIdx = buscarFase(plan, o.fase)
    sIdx = buscarSemana(fases[fIdx], o.semana ?? (fases[fIdx].weekData.length === 1 ? fases[fIdx].weekData[0].num : undefined))
  } else if (kind !== 'weekly') {
    const estado = await estadoDe(quien, persona.id)
    const aqui = dondeVa(fases, kind, cursorDe(estado, { profesionalId: plan.profesional_id ?? null }), fechaDelAtleta().date)
    if (aqui) {
      fIdx = Math.max(0, fases.findIndex((f: any) => f.id === aqui.faseId))
      sIdx = Math.max(0, (fases[fIdx].weekData ?? []).findIndex((w: any) => w.num === aqui.semana))
    }
  }
  const semana = fases[fIdx]?.weekData?.[sIdx]
  if (!semana) throw new Aviso('Ese plan no tiene esa semana.')
  const clave = diaDesdeTexto(o.dia)
  const nuevas = diasDeWorkout(o.data, clave, o.nombre)
  const dias = [...(semana.days ?? [])]
  const primera = dias.findIndex((d: any) => d.day === clave)
  const habia = dias.some((d: any) => d.day === clave && d.cat !== 'off')
  if (o.modo === 'reemplazar' && primera >= 0) {
    dias[primera] = nuevas[0]
    dias.push(...nuevas.slice(1))
  } else {
    dias.push(...nuevas)
  }
  semana.days = dias
  await guardarFases(quien, plan, fases)
  return { en: `${fases[fIdx].name} · semana ${semana.num} · ${NOMBRE_DIA[clave]}`, habia }
}

export function herramientasDeMisPlanes(server: McpServer, quien: Quien) {
  const esMaster = quien.rol === 'master'
  const PARAM_DE = esMaster
    ? { de: z.string().optional().describe('Solo al guardar algo del plan de un atleta: de qué profesional es el programa. Su nombre, "coach" o "fisio". Sin esto, el del coach principal.') }
    : {}
  const CARPETA = z.string().optional().describe('Una carpeta de Mis planes: su nombre o su ruta («Fútbol › Fuerza»). Tiene que existir (crear_carpeta). Sin esto, queda sin carpeta.')

  /* ================================================================ */
  /* VER                                                                */
  /* ================================================================ */

  server.registerTool('ver_mis_planes', {
    title: 'Ver Mis planes',
    description: 'Lo que tienes guardado en Mis planes, tu catálogo: programas (por fases), rutinas semanales, workouts (un día) y clases (un workout con video), con sus carpetas. Cada cosa trae su id, su tipo, su carpeta y un resumen. Filtra por tipo, por carpeta (incluye sus subcarpetas) o por texto en el nombre. Lo guardado es una COPIA: cambiarlo no mueve lo que un atleta ya recibió. Para ver lo de dentro: abrir_de_mis_planes.',
    inputSchema: {
      tipo: TIPO.optional().describe('Solo programas, rutinas, workouts o clases.'),
      carpeta: CARPETA.describe('Solo lo que está en esta carpeta y sus subcarpetas.'),
      texto: z.string().optional().describe('Solo lo que tenga este texto en el nombre.'),
    },
    annotations: SOLO_LEER,
  }, seguro(async ({ tipo, carpeta, texto }: any) => {
    const { carpetas, items } = await leerMisPlanes(quien)
    const c = carpeta !== undefined ? buscarCarpeta(carpetas, carpeta) : undefined
    const dentro = c ? new Set([c.id, ...descendientesDe(carpetas, c.id)]) : null
    const t = sinAcentos(texto ?? '')
    const lista = items
      .filter((i) => (!tipo || i.tipo === tipo) && (c === undefined || (c === null ? i.carpetaId === null : dentro!.has(i.carpetaId as string))) && (!t || sinAcentos(i.nombre).includes(t)))
      .sort((a, b) => rutaTexto(carpetas, a.carpetaId).localeCompare(rutaTexto(carpetas, b.carpetaId), 'es') || a.nombre.localeCompare(b.nombre, 'es'))
    return respuesta({
      total: lista.length,
      carpetas: carpetas.map((x) => textoDeRuta(carpetas, x.id)).sort((a, b) => a.localeCompare(b, 'es')),
      planes: lista.map((i) => comoLinea(i, carpetas)),
      ...(items.length === 0 ? { nota: 'Todavía no tienes nada guardado en Mis planes.' } : {}),
    })
  }))

  server.registerTool('abrir_de_mis_planes', {
    title: 'Abrir algo de Mis planes',
    description: 'Lee lo de dentro de algo guardado en Mis planes. Un workout o una clase: sus sesiones y ejercicios. Una rutina semanal: sus días (pide "dia" para ver los ejercicios de uno). Un programa: sus fases; pide "fase" para ver sus semanas, "semana" para ver sus días y "dia" para ver los ejercicios. Así no se trae todo de golpe.',
    inputSchema: {
      item: z.string().describe('El nombre o el id de lo guardado (ver_mis_planes).'),
      tipo: TIPO.optional().describe('Para distinguir dos cosas con el mismo nombre.'),
      fase: FASE.describe('Solo en un programa: la fase (número o nombre).'),
      semana: z.coerce.number().optional().describe('Solo en un programa: el número de semana.'),
      dia: z.string().optional().describe('El día (lunes … domingo) del que quieres ver los ejercicios.'),
    },
    annotations: SOLO_LEER,
  }, seguro(async ({ item, tipo, fase, semana, dia }: any) => {
    const { carpetas, items } = await leerMisPlanes(quien)
    const it = buscarItem(items, carpetas, item, tipo)
    const { data: fila, error } = await quien.db.from(it.tabla).select('data').eq('id', it.id).single()
    if (error) throw new Error(error.message)
    const data = fila?.data ?? {}
    const cabecera = { ...comoLinea(it, carpetas), ...(it.origen ? { origen: it.origen } : {}) }

    if (it.tipo === 'workout' || it.tipo === 'clase') {
      const dias = diasDeWorkout(data, 'Lun', it.nombre)
      const semanaFalsa = { num: 1, days: dias }
      return respuesta({ ...cabecera, sesiones: dias.map((_: any, i: number) => describirDia({ name: it.nombre }, semanaFalsa, i)) })
    }

    const fases: any[] = it.tipo === 'rutina' ? planDeRutina(data).phases : (Array.isArray(data.phases) ? data.phases : [])
    const plan: any = { data: { kind: it.tipo === 'rutina' ? 'weekly' : 'periodized', phases: fases } }
    const verDia = (f: any, w: any) => {
      const clave = diaDesdeTexto(dia)
      const idx = (w.days ?? []).map((d: any, i: number) => (d.day === clave ? i : -1)).filter((i: number) => i >= 0)
      if (!idx.length) throw new Aviso(`Ese día no tiene sesión${it.tipo === 'programa' ? ` en la semana ${w.num}` : ''}.`)
      return idx.map((i: number) => describirDia(f, w, i))
    }

    if (it.tipo === 'rutina') {
      const f = fases[0]
      const w = f.weekData[0]
      return respuesta({ ...cabecera, ...(dia ? { sesiones: verDia(f, w) } : { dias: describirSemana(w), pista: 'Pide un "dia" para ver sus ejercicios.' }) })
    }

    const ciencia = Array.isArray(data.ciencia) && data.ciencia.length ? { ciencia: `${data.ciencia.length} recuadro(s) del porqué del plan` } : {}
    if (fase === undefined || fase === '') {
      return respuesta({
        ...cabecera,
        ...ciencia,
        fases: fases.map((f: any, i: number) => ({ n: f.num ?? i + 1, nombre: f.name, semanas: (f.weekData ?? []).length, sesiones: (f.weekData ?? []).reduce((n: number, w: any) => n + (w.days ?? []).filter((d: any) => d.cat !== 'off').length, 0) })),
        pista: 'Pide una "fase" para ver sus semanas, y "semana" y "dia" para bajar al detalle.',
      })
    }
    const f = fases[buscarFase(plan, fase)]
    if (semana === undefined) {
      return respuesta({ ...cabecera, fase: f.name, semanas: (f.weekData ?? []).map((w: any) => ({ semana: w.num, ...(w.label ? { nombre: w.label } : {}), ...(w.load ? { carga: w.load } : {}), dias: describirSemana(w) })) })
    }
    const w = f.weekData[buscarSemana(f, semana)]
    if (!dia) return respuesta({ ...cabecera, fase: f.name, semana: w.num, dias: describirSemana(w), pista: 'Pide un "dia" para ver sus ejercicios.' })
    return respuesta({ ...cabecera, fase: f.name, semana: w.num, sesiones: verDia(f, w) })
  }))

  /* ================================================================ */
  /* GUARDAR                                                            */
  /* ================================================================ */

  server.registerTool('guardar_en_mis_planes', {
    title: 'Guardar en Mis planes',
    description: [
      'Guarda algo NUEVO en Mis planes (una copia: no cambia ningún plan de ningún atleta). Dos caminos:',
      '(1) Del plan de un atleta: manda "desde_atleta". Sin más, guarda su plan entero como PROGRAMA (o como rutina si es una rutina semanal); con "fases_elegidas", solo esas fases; con "fase" + "semana", UNA semana como rutina; con "fase" + "semana" + "dia", ese día como workout (o clase, si trae video). Con "solo_tipos" o "sin_tipos" (ej.: solo "gym", o sin "correr") se quedan o se quitan las sesiones de ese tipo en la copia.',
      '(2) Armarlo desde cero, sin atleta: manda "tipo" (programa, rutina o workout) y su contenido igual que en crear_plan ("fases" para un programa, "sesiones" para una rutina o un workout). Cada ejercicio va con su nombre EXACTO del catálogo (búscalo antes con buscar_ejercicios); si falta algo (un ejercicio que no está en el catálogo, la cantidad, el "por lado", confirmar las biseries) NO guarda y te devuelve las preguntas para que se las hagas a la persona TODAS JUNTAS.',
      'Una clase con video no se puede crear aquí (la IA no sube videos): solo se guarda una que ya viene en el día de un atleta. Para dárselo a uno o varios atletas: asignar_de_mis_planes.',
    ].join(' '),
    inputSchema: {
      nombre: z.string().describe('Cómo se llamará en Mis planes.'),
      descripcion: z.string().optional().describe('Una descripción corta (opcional).'),
      carpeta: CARPETA,
      desde_atleta: z.string().optional().describe('Camino 1: el atleta de cuyo plan sale (usuario, nombre o id).'),
      fases_elegidas: z.array(z.coerce.string()).optional().describe('Camino 1, programa: solo estas fases (números o nombres). Sin esto, todas.'),
      fase: FASE.describe('Camino 1, rutina o workout: la fase de donde se toma (número o nombre).'),
      semana: z.coerce.number().optional().describe('Camino 1: guarda esta semana como rutina semanal (o, con "dia", el día de esa semana).'),
      dia: z.string().optional().describe('Camino 1: guarda ese día (lunes … domingo) como workout.'),
      solo_tipos: z.array(z.string()).optional().describe('Camino 1: conserva solo las sesiones de estos tipos (ej.: ["gym"]).'),
      sin_tipos: z.array(z.string()).optional().describe('Camino 1: quita las sesiones de estos tipos (ej.: ["correr", "neural"]).'),
      tipo: z.enum(['programa', 'rutina', 'workout']).optional().describe('Camino 2: qué se arma.'),
      sesiones: z.array(SESION_CON_DIA).optional().describe('Camino 2, rutina o workout: las sesiones. En un workout "dia" no importa (se ignora); normalmente una sesión, dos si es mañana y tarde.'),
      fases: FASES,
      ciencia: CIENCIA,
      sin_ficha_ok: SIN_FICHA_OK,
      sin_cantidad_ok: SIN_CANTIDAD_OK,
      estructura_ok: ESTRUCTURA_OK,
      ...PARAM_DE,
    },
    annotations: ESCRIBE,
  }, seguro(async (a: any) => {
    const { nombre, descripcion, carpeta, desde_atleta, fases_elegidas, fase, semana, dia, solo_tipos, sin_tipos, tipo, sesiones, fases, ciencia, sin_ficha_ok, sin_cantidad_ok, estructura_ok, de } = a
    if (!String(nombre ?? '').trim()) throw new Aviso('Falta el nombre con el que se guarda.')
    const armando = !!(tipo || sesiones?.length || fases?.length)
    if (desde_atleta && armando) throw new Aviso('Elige UNO: o guardas algo del plan de un atleta ("desde_atleta"), o lo armas desde cero ("tipo" con "fases" o "sesiones"). No los dos a la vez.')
    if (!desde_atleta && !armando) throw new Aviso('¿Qué se guarda? Manda "desde_atleta" (algo del plan de un atleta) o arma uno desde cero con "tipo" y sus "fases" o "sesiones".')

    const { carpetas, items } = await leerMisPlanes(quien)
    const destino = carpeta !== undefined ? buscarCarpeta(carpetas, carpeta) : null

    let tipoFinal: Tipo
    let data: any
    let origen: string
    let quitadas = 0
    let aceptado: { sinFicha: string[]; sinCantidad: string[] } | null = null

    if (desde_atleta) {
      /* ---- Camino 1: del plan de un atleta ---- */
      const c = await copiaDelPlanDeAtleta(quien, desde_atleta, { fases_elegidas, fase, semana, dia, solo_tipos, sin_tipos }, de)
      tipoFinal = c.tipo
      data = c.data
      origen = c.origen
      quitadas = c.quitadas
    } else {
      /* ---- Camino 2: armarlo desde cero ---- */
      if (!tipo) throw new Aviso('Di qué armas: "tipo" programa, rutina o workout.')
      origen = 'Creado con la IA'
      const repertorio = await repertorioVisible(quien)
      const rev = nuevaRevision()
      if (tipo === 'workout') {
        if (!sesiones?.length) throw new Aviso('Para un workout manda "sesiones" (una, o dos si es mañana y tarde).')
        const dias = sesiones.map((s: any) => {
          const armado = diaDesdeEntrada('Lun', s, repertorio)
          anotarDia(rev, s.nombre ?? 'Workout', armado)
          return armado.dia
        })
        aceptado = exigirRespuestas({ revision: rev, catalogo: repertorio, plan: null, respuestas: { sin_ficha_ok, sin_cantidad_ok, estructura_ok } })
        data = workoutDeSesiones(dias)
        tipoFinal = 'workout'
      } else {
        const { nuevas, cienciaNueva } = armarFasesDeLaIA({ tipo: tipo === 'rutina' ? 'rutina' : 'fases', sesiones, fases, ciencia }, repertorio, rev)
        aceptado = exigirRespuestas({ revision: rev, catalogo: repertorio, plan: null, respuestas: { sin_ficha_ok, sin_cantidad_ok, estructura_ok } })
        const normales = normalizar(nuevas)
        if (tipo === 'rutina') {
          data = rutinaDePlan({ phases: normales, ciencia: cienciaNueva })
          tipoFinal = 'rutina'
        } else {
          data = programaDePlan({ kind: 'periodized', estructura: 'fases', phases: normales, foto: undefined, ciencia: cienciaNueva })
          tipoFinal = 'programa'
        }
      }
    }

    const resumen = resumenDe(tipoFinal, data)
    const tabla = TABLA_DE[tipoFinal]
    const fila = {
      name: String(nombre).trim(),
      descripcion: String(descripcion ?? '').trim() || null,
      origen,
      carpeta_id: destino?.id ?? null,
      resumen,
      data,
      created_by: quien.id,
      ...(tabla === 'routine_templates' ? { kind: KIND_DE[tipoFinal] } : {}),
    }
    const { data: creada, error } = await quien.db.from(tabla).insert(fila).select('id').single()
    if (error) throw new Error(error.message)
    const repetido = items.some((i) => i.tipo === tipoFinal && mismoTexto(i.nombre, fila.name))
    return respuesta({
      listo: true,
      guardado: { id: creada?.id, tipo: tipoFinal, nombre: fila.name, carpeta: rutaTexto(carpetas, destino?.id ?? null), resumen: textoDeResumen(tipoFinal, resumen), origen },
      ...(quitadas ? { sesiones_quitadas: `${quitadas} sesión(es) no entraron a la copia por el filtro de tipos.` } : {}),
      ...(repetido ? { aviso: `Ya tenías ${ETIQUETA_DE_TIPO[tipoFinal].toLowerCase()} con ese nombre: quedaron los dos. Si fue sin querer, bórralo con borrar_de_mis_planes (usa el id).` } : {}),
      ...(aceptado ? avisosDeRespuestas(aceptado) : {}),
    })
  }))

  /* ================================================================ */
  /* CAMBIAR, DUPLICAR, BORRAR                                          */
  /* ================================================================ */

  server.registerTool('cambiar_en_mis_planes', {
    title: 'Cambiar algo de Mis planes',
    description: 'Cambia el nombre, la descripción o la carpeta de algo guardado en Mis planes. Para cambiar la carpeta manda "carpeta" (su nombre o ruta); para sacarlo de su carpeta manda "carpeta": "sin carpeta". El contenido de lo guardado no se edita aquí: se vuelve a guardar con guardar_en_mis_planes.',
    inputSchema: {
      item: z.string().describe('El nombre o el id de lo guardado.'),
      tipo: TIPO.optional().describe('Para distinguir dos cosas con el mismo nombre.'),
      nombre: z.string().optional().describe('El nombre nuevo.'),
      descripcion: z.string().optional().describe('La descripción nueva ("" la quita).'),
      carpeta: CARPETA.describe('La carpeta a donde se muda ("sin carpeta" la saca de su carpeta). Sin esto, se queda donde está.'),
    },
    annotations: ESCRIBE,
  }, seguro(async ({ item, tipo, nombre, descripcion, carpeta }: any) => {
    if (nombre === undefined && descripcion === undefined && carpeta === undefined) throw new Aviso('¿Qué cambio? Manda "nombre", "descripcion" o "carpeta".')
    if (nombre !== undefined && !String(nombre).trim()) throw new Aviso('El nombre no puede quedar vacío.')
    const { carpetas, items } = await leerMisPlanes(quien)
    const it = buscarItem(items, carpetas, item, tipo)
    const cambios: Record<string, unknown> = {}
    if (nombre !== undefined) cambios.name = String(nombre).trim()
    if (descripcion !== undefined) cambios.descripcion = String(descripcion).trim() || null
    // Mover no es editar: la fecha de «cambiado» solo se toca si cambió el nombre o la descripción (igual que en la app).
    if (nombre !== undefined || descripcion !== undefined) cambios.updated_at = new Date().toISOString()
    let destino: any = null
    if (carpeta !== undefined) { destino = buscarCarpeta(carpetas, carpeta); cambios.carpeta_id = destino?.id ?? null }
    const { data, error } = await quien.db.from(it.tabla).update(cambios).eq('id', it.id).select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) throw new Aviso('No tienes permiso para cambiar esto.')
    return respuesta({
      listo: true,
      antes: it.nombre,
      ahora: { id: it.id, tipo: it.tipo, nombre: cambios.name ?? it.nombre, carpeta: carpeta !== undefined ? rutaTexto(carpetas, destino?.id ?? null) : rutaTexto(carpetas, it.carpetaId) },
    })
  }))

  server.registerTool('duplicar_en_mis_planes', {
    title: 'Duplicar algo de Mis planes',
    description: 'Hace una copia de algo guardado en Mis planes, con otro nombre ("(copia)" si no dices cuál). Queda en la misma carpeta, o en la que digas.',
    inputSchema: {
      item: z.string().describe('El nombre o el id de lo guardado.'),
      tipo: TIPO.optional().describe('Para distinguir dos cosas con el mismo nombre.'),
      nombre: z.string().optional().describe('El nombre de la copia.'),
      carpeta: CARPETA.describe('La carpeta de la copia. Sin esto, la misma de la original.'),
    },
    annotations: ESCRIBE,
  }, seguro(async ({ item, tipo, nombre, carpeta }: any) => {
    const { carpetas, items } = await leerMisPlanes(quien)
    const it = buscarItem(items, carpetas, item, tipo)
    const { data: orig, error: e1 } = await quien.db.from(it.tabla).select('data').eq('id', it.id).single()
    if (e1) throw new Error(e1.message)
    const destino = carpeta !== undefined ? buscarCarpeta(carpetas, carpeta) : (it.carpetaId ? carpetas.find((c) => c.id === it.carpetaId) ?? null : null)
    const nuevoNombre = String(nombre ?? '').trim() || `${it.nombre} (copia)`
    const fila = {
      name: nuevoNombre,
      descripcion: it.descripcion || null,
      origen: it.origen || null,
      carpeta_id: destino?.id ?? null,
      resumen: it.resumen ?? resumenDe(it.tipo, orig?.data),
      data: structuredClone(orig?.data ?? {}),
      created_by: quien.id,
      ...(it.tabla === 'routine_templates' ? { kind: KIND_DE[it.tipo] } : {}),
    }
    const { data: creada, error } = await quien.db.from(it.tabla).insert(fila).select('id').single()
    if (error) throw new Error(error.message)
    return respuesta({ listo: true, copia: { id: creada?.id, tipo: it.tipo, nombre: nuevoNombre, carpeta: rutaTexto(carpetas, destino?.id ?? null) }, de: it.nombre })
  }))

  server.registerTool('borrar_de_mis_planes', {
    title: 'Borrar algo de Mis planes',
    description: 'Borra algo guardado en Mis planes. Los planes de atletas donde ya se usó no cambian (eran una copia). Lo borrado NO se puede recuperar: antes de borrar, di qué se va a borrar.',
    inputSchema: {
      item: z.string().describe('El nombre o el id de lo guardado.'),
      tipo: TIPO.optional().describe('Para distinguir dos cosas con el mismo nombre.'),
      confirmado: z.boolean().optional().describe(TEXTO_CONFIRMADO_BORRAR),
    },
    annotations: BORRA,
  }, seguro(async ({ item, tipo, confirmado }: any) => {
    const { carpetas, items } = await leerMisPlanes(quien)
    const it = buscarItem(items, carpetas, item, tipo)
    const antes = sinConfirmarBorrado(confirmado, `Se borrará de Mis planes (${it.tipo}) "${it.nombre}" (${rutaTexto(carpetas, it.carpetaId)}). NO se puede recuperar; los planes de atletas donde ya se usó no cambian.`)
    if (antes) return antes
    const { data, error } = await quien.db.from(it.tabla).delete().eq('id', it.id).select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) throw new Aviso('No tienes permiso para borrar esto.')
    return respuesta({ listo: true, borrado: { tipo: it.tipo, nombre: it.nombre, carpeta: rutaTexto(carpetas, it.carpetaId) } })
  }))

  /* ================================================================ */
  /* DARLE A LOS ATLETAS (tanda 2)                                       */
  /* ================================================================ */

  server.registerTool('asignar_de_mis_planes', {
    title: 'Dar algo de Mis planes a uno o varios atletas',
    description: [
      'Le da una COPIA de algo guardado en Mis planes a uno o varios atletas (cambiar Mis planes después no mueve lo que ya recibieron, ni al revés). Confirma con la persona a quiénes se lo das antes de llamar.',
      'Un PROGRAMA o una RUTINA se vuelve el plan del atleta, empieza en su semana 1 y REEMPLAZA el que tuviera con este profesional: si alguno ya tiene plan y no mandas "reemplazar": true, NO se asigna a nadie y te devuelve quiénes ya tienen plan, para que se lo preguntes a la persona (el plan anterior queda en el historial y se recupera con deshacer_cambio_del_plan).',
      'Un WORKOUT o una CLASE se pone en un día de la semana de su plan ("dia" es obligatorio): por defecto en la semana en que va HOY cada atleta ("fase" y "semana" eligen una en concreto); si ese día ya tiene sesión, se AGREGA como otra, o con "si_hay_sesion": "reemplazar" ocupa el lugar de la primera. Quien no tiene plan se salta y se te dice.',
      'Cada atleta se procesa por separado: si a uno le falla, los demás siguen.',
    ].join(' '),
    inputSchema: {
      item: z.string().describe('El nombre o el id de lo guardado (ver_mis_planes).'),
      tipo: TIPO.optional().describe('Para distinguir dos cosas con el mismo nombre.'),
      atletas: z.array(z.string()).min(1).describe('Los atletas: su usuario (@juan), su nombre o su id. Uno o varios.'),
      titulo: z.string().optional().describe('Programa o rutina: cómo se llamará el plan del atleta. Sin esto, el nombre de lo guardado.'),
      reemplazar: z.boolean().optional().describe('Programa o rutina: true para reemplazar el plan que ya tengan (solo después de preguntarle a la persona).'),
      dia: z.string().optional().describe('Workout o clase: el día de la semana (lunes … domingo). Obligatorio para ellos.'),
      si_hay_sesion: z.enum(['agregar', 'reemplazar']).optional().describe('Workout o clase: qué hacer si ese día ya tiene sesión. "agregar" si no se dice.'),
      fase: FASE.describe('Workout o clase: la fase en que se pone. Sin esto, la semana en que va hoy cada atleta.'),
      semana: z.coerce.number().optional().describe('Workout o clase: el número de semana. Sin esto, la semana en que va hoy cada atleta.'),
      ...PARAM_DE,
    },
    annotations: { ...ESCRIBE, destructiveHint: true },
  }, seguro(async ({ item, tipo, atletas, titulo, reemplazar, dia, si_hay_sesion, fase, semana, de }: any) => {
    const { carpetas, items } = await leerMisPlanes(quien)
    const it = buscarItem(items, carpetas, item, tipo)
    const unDia = esDeUnDia(it.tipo)
    if (unDia && !dia) throw new Aviso('¿En qué día de la semana va? Manda "dia" (lunes … domingo).')
    if (unDia) diaDesdeTexto(dia)
    const { data: fila, error } = await quien.db.from(it.tabla).select('data').eq('id', it.id).single()
    if (error) throw new Error(error.message)
    const contenido = fila?.data ?? {}

    // Primero se encuentra a TODOS: si uno no existe o hay duda de quién es, no se toca a nadie.
    const personas: any[] = []
    for (const ref of [...new Set(atletas.map((x: string) => String(x).trim()).filter(Boolean))] as string[]) personas.push(await buscarPersona(quien, ref))
    const unicas = [...new Map(personas.map((x) => [x.id, x])).values()]
    const programas = await Promise.all(unicas.map(async (persona) => ({ persona, ...(await planQueEdito(quien, persona, de)) })))

    if (!unDia) {
      const ya = programas.filter((x) => x.plan && !esFantasma(x.plan))
      if (ya.length && !reemplazar) {
        return respuesta({
          asignado: false,
          motivo: 'ya_tienen_plan',
          ya_tienen_plan: ya.map((x) => `${nombreDe(x.persona)}: "${x.plan!.title}"`),
          sin_plan: programas.filter((x) => !ya.includes(x)).map((x) => nombreDe(x.persona)),
          pista: 'No se asignó a nadie. Pregúntale a la persona si quiere REEMPLAZAR el plan de quienes ya tienen uno (el anterior queda en el historial y se recupera). Si sí, vuelve a llamar con reemplazar: true; si no, quita a esos atletas de la lista.',
        })
      }
    }

    const nombrePlan = String(titulo ?? '').trim() || it.nombre
    const resultados: any[] = []
    for (const x of programas) {
      const quienEs = nombreDe(x.persona)
      try {
        if (unDia) {
          if (!x.plan || esFantasma(x.plan) || !fasesDe(x.plan).length) { resultados.push({ atleta: quienEs, estado: 'sin_plan', mensaje: 'No tiene plan todavía: créale uno (crear_plan o esta misma herramienta con un programa) y vuelve a ponerle el workout.' }); continue }
          const r = await ponerWorkoutEnElPlan(quien, x.persona, x.plan, { data: contenido, nombre: it.nombre, dia, modo: si_hay_sesion ?? 'agregar', fase, semana })
          resultados.push({ atleta: quienEs, estado: 'ok', en: r.en, ...(r.habia ? { nota: si_hay_sesion === 'reemplazar' ? 'Ocupó el lugar de la primera sesión de ese día.' : 'Ese día ya tenía sesión: quedó como otra.' } : {}) })
        } else {
          const plan = it.tipo === 'programa' ? planDePrograma(contenido) : planDeRutina(contenido)
          // Se mira ANTES de escribir qué había: después, el plan ya es el nuevo.
          const anterior = x.plan && !esFantasma(x.plan) ? x.plan.title : null
          await entregarPlan(quien, { persona: x.persona, previo: x.plan, profesionalId: x.profesionalId, titulo: nombrePlan, plan })
          resultados.push({ atleta: quienEs, estado: 'ok', ...(anterior ? { reemplazo: `Su plan anterior "${anterior}" quedó en el historial.` } : {}) })
        }
      } catch (e) {
        resultados.push({ atleta: quienEs, estado: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo' })
      }
    }
    const bien = resultados.filter((r) => r.estado === 'ok').length
    return respuesta({
      listo: bien === resultados.length,
      asignado: `${bien} de ${resultados.length}`,
      que: { tipo: it.tipo, nombre: it.nombre, ...(unDia ? { dia: NOMBRE_DIA[diaDesdeTexto(dia)] } : { como: nombrePlan }) },
      resultados,
      ...(bien ? { mensaje: 'Ya lo ven en su app.' } : {}),
    })
  }))

  server.registerTool('copiar_plan_a_atleta', {
    title: 'Crear el plan de un atleta copiando otro plan',
    description: [
      'Crea (o reemplaza) el plan de UN atleta copiando todo o parte de otro plan, en un solo paso y sin pasar por Mis planes. La fuente es el plan de otro atleta ("desde_atleta") o un programa o una rutina guardados ("desde_mis_planes").',
      'Con "fases_elegidas" copias solo esas fases; con "solo_tipos" o "sin_tipos" se quedan o se quitan las sesiones de ese tipo en la copia (ej.: "hazle uno igual a esa fase de fuerza, sin los workouts de velocidad" = fases_elegidas ["Fuerza"] y sin_tipos ["correr"], o solo_tipos ["gym"]).',
      'Si el atleta ya tiene plan y no mandas "reemplazar": true, no hace nada y te lo dice (el plan anterior queda en el historial). Es una copia: no cambia el plan de origen.',
    ].join(' '),
    inputSchema: {
      atleta: z.string().describe('El atleta que recibe el plan: su usuario (@juan), su nombre o su id.'),
      titulo: z.string().describe('Cómo se llamará el plan nuevo.'),
      desde_atleta: z.string().optional().describe('Copiar del plan de este atleta.'),
      desde_mis_planes: z.string().optional().describe('Copiar de un programa o una rutina guardados en Mis planes (nombre o id).'),
      fases_elegidas: z.array(z.coerce.string()).optional().describe('Solo estas fases (números o nombres). Sin esto, todas.'),
      solo_tipos: z.array(z.string()).optional().describe('Conserva solo las sesiones de estos tipos (ej.: ["gym"]).'),
      sin_tipos: z.array(z.string()).optional().describe('Quita las sesiones de estos tipos (ej.: ["correr", "neural"]).'),
      reemplazar: z.boolean().optional().describe('true para reemplazar el plan que ya tenga (solo después de preguntarle a la persona).'),
      ...(esMaster ? { de_origen: z.string().optional().describe('Solo con desde_atleta: de qué profesional es el programa que se copia. Sin esto, el del coach principal.') } : {}),
      ...PARAM_DE,
    },
    annotations: { ...ESCRIBE, destructiveHint: true },
  }, seguro(async ({ atleta, titulo, desde_atleta, desde_mis_planes, fases_elegidas, solo_tipos, sin_tipos, reemplazar, de_origen, de }: any) => {
    if (!String(titulo ?? '').trim()) throw new Aviso('Falta el título del plan nuevo.')
    if (!!desde_atleta === !!desde_mis_planes) throw new Aviso('Di de dónde se copia, UNO: "desde_atleta" (el plan de otro atleta) o "desde_mis_planes" (algo guardado).')
    const persona = await buscarPersona(quien, atleta)
    const programa = await planQueEdito(quien, persona, de)
    if (programa.plan && !esFantasma(programa.plan) && !reemplazar) {
      return respuesta({
        asignado: false,
        motivo: 'ya_tiene_plan',
        ya_tiene: `${nombreDe(persona)} ya tiene el plan "${programa.plan.title}".`,
        pista: 'No se copió nada. Pregúntale a la persona si quiere REEMPLAZARLO (el anterior queda en el historial y se recupera). Si sí, vuelve a llamar con reemplazar: true.',
      })
    }

    let plan: any
    let quitadas = 0
    let origen: string
    if (desde_atleta) {
      const c = await copiaDelPlanDeAtleta(quien, desde_atleta, { fases_elegidas, solo_tipos, sin_tipos }, de_origen)
      if (c.persona.id === persona.id && String(de_origen ?? '') === String(de ?? '')) {
        throw new Aviso('El origen y el destino son la misma persona: no hay nada que copiar.')
      }
      if (c.tipo === 'workout' || c.tipo === 'clase') throw new Aviso('De un atleta se copia un programa o una rutina; para un workout suelto usa guardar_en_mis_planes y luego asignar_de_mis_planes.')
      plan = c.tipo === 'programa' ? planDePrograma(c.data) : planDeRutina(c.data)
      quitadas = c.quitadas
      origen = c.origen
    } else {
      const { carpetas, items } = await leerMisPlanes(quien)
      const it = buscarItem(items, carpetas, desde_mis_planes)
      if (it.tipo !== 'programa' && it.tipo !== 'rutina') throw new Aviso(`"${it.nombre}" es ${ETIQUETA_DE_TIPO[it.tipo].toLowerCase()}: aquí se copia un programa o una rutina. Un workout o una clase se pone con asignar_de_mis_planes.`)
      const { data: fila, error } = await quien.db.from(it.tabla).select('data').eq('id', it.id).single()
      if (error) throw new Error(error.message)
      const data = structuredClone(fila?.data ?? {})
      if (it.tipo === 'rutina') {
        const r = filtrarDias(data.days ?? [], solo_tipos, sin_tipos)
        quitadas = r.quitadas
        plan = planDeRutina({ ...data, days: r.quedan })
      } else {
        const fases: any[] = Array.isArray(data.phases) ? data.phases : []
        const simulado: any = { data: { kind: data.kind ?? 'periodized', phases: fases } }
        const elegidas = fases_elegidas?.length
          ? [...new Set(fases_elegidas.map((x: string) => buscarFase(simulado, x)))].sort((p: any, q: any) => p - q).map((i: any) => fases[i])
          : fases
        quitadas = filtrarFases(elegidas, solo_tipos, sin_tipos)
        if (!sesionesReales(elegidas)) throw new Aviso('Con ese filtro no queda ninguna sesión.')
        plan = planDePrograma({ ...data, phases: elegidas, ciencia: fases_elegidas?.length ? undefined : data.ciencia })
      }
      origen = `De Mis planes: ${it.nombre}`
    }
    const anterior = programa.plan && !esFantasma(programa.plan) ? programa.plan.title : null
    await entregarPlan(quien, { persona, previo: programa.plan, profesionalId: programa.profesionalId, titulo: String(titulo).trim(), plan })
    return respuesta({
      listo: true,
      atleta: nombreDe(persona),
      ...(programa.profesionalId ? { programa: programa.de } : {}),
      plan: String(titulo).trim(),
      copiado_de: origen,
      tamano: plan.kind === 'weekly' ? 'rutina que se repite' : tamanoDe(plan.phases),
      ...(quitadas ? { sesiones_quitadas: `${quitadas} sesión(es) no entraron a la copia por el filtro de tipos.` } : {}),
      ...(anterior ? { reemplazo: `El plan anterior "${anterior}" quedó en el historial.` } : {}),
      mensaje: `Ya lo ve ${nombreDe(persona)} en su app.`,
    })
  }))

  /* ================================================================ */
  /* DEMO WORKOUTS (solo el dueño de la app)                              */
  /* ================================================================ */

  if (esMaster) {
    server.registerTool('marcar_demo_workout', {
      title: 'Marcar un workout como demostración',
      description: 'Marca (o desmarca) un WORKOUT tuyo de Mis planes como DEMOSTRACIÓN: cualquier persona con cuenta lo ve en «Demo workout», dentro de Entrenar, y puede hacerlo. Solo el dueño de la app puede, solo un workout (no una clase) y es PÚBLICO: sin "confirmado": true NO lo marca y te devuelve lo que pasaría; pregúntale antes a la persona. Los que ya están marcados salen en ver_mis_planes con demo: true.',
      inputSchema: {
        item: z.string().describe('El nombre o el id del workout (ver_mis_planes con tipo workout).'),
        demo: z.boolean().optional().describe('true para marcarlo (por defecto); false para quitarle la marca.'),
        confirmado: z.boolean().optional().describe('Solo después de preguntarle a la persona y que diga que sí.'),
      },
      annotations: { ...ESCRIBE, destructiveHint: true },
    }, seguro(async ({ item, demo, confirmado }: any) => {
      const { carpetas, items } = await leerMisPlanes(quien)
      const it = buscarItem(items, carpetas, item, 'workout')
      const marcar = demo !== false
      if (it.demo === marcar) return respuesta({ listo: true, sin_cambio: `«${it.nombre}» ya ${marcar ? 'está marcado' : 'no está marcado'} como demostración.` })
      if (!confirmado) {
        return respuesta({
          listo: false,
          motivo: 'falta_confirmacion',
          va_a_pasar: marcar
            ? `«${it.nombre}» quedará como DEMOSTRACIÓN: cualquier persona con cuenta de Training Lab lo verá en «Demo workout» (dentro de Entrenar) y podrá hacerlo.`
            : `«${it.nombre}» dejará de ser una demostración: ya no saldrá en «Demo workout» de nadie.`,
          pista: 'Pregúntale a la persona. Si dice que sí, vuelve a llamar con confirmado: true.',
        })
      }
      const { error } = await quien.db.rpc('marcar_demo', { p_id: it.id, p_demo: marcar })
      if (error) throw new Aviso(error.message)
      return respuesta({ listo: true, workout: it.nombre, demo: marcar })
    }))
  }

  /* ================================================================ */
  /* CARPETAS                                                           */
  /* ================================================================ */

  server.registerTool('crear_carpeta', {
    title: 'Crear una carpeta en Mis planes',
    description: 'Crea una carpeta en Mis planes, arriba de todo o dentro de otra ("dentro_de"). Hasta 5 niveles. Si ya existe una con ese nombre en ese lugar, no crea otra: te devuelve la que hay.',
    inputSchema: {
      nombre: z.string().describe('El nombre de la carpeta.'),
      dentro_de: CARPETA.describe('La carpeta de arriba (nombre o ruta). Sin esto, queda arriba de todo.'),
    },
    annotations: ESCRIBE,
  }, seguro(async ({ nombre, dentro_de }: any) => {
    const n = String(nombre ?? '').trim()
    if (!n) throw new Aviso('La carpeta necesita un nombre.')
    const { carpetas } = await leerMisPlanes(quien)
    const padre = dentro_de !== undefined ? buscarCarpeta(carpetas, dentro_de) : null
    const ya = carpetas.find((c) => (c.parent_id ?? null) === (padre?.id ?? null) && mismoTexto(c.nombre, n))
    if (ya) return respuesta({ listo: true, carpeta: { id: ya.id, ruta: textoDeRuta(carpetas, ya.id) }, nota: 'Ya existía; no se creó otra.' })
    if (!cabeCarpetaEn(carpetas, padre?.id ?? null)) throw new Aviso('Esa carpeta ya está en el nivel más profundo (5). Usa otra más arriba.')
    const { data, error } = await quien.db.from('carpetas_planes').insert({ nombre: n, parent_id: padre?.id ?? null, owner_id: quien.id }).select('id').single()
    if (error) throw new Error(error.message)
    return respuesta({ listo: true, carpeta: { id: data?.id, ruta: padre ? `${textoDeRuta(carpetas, padre.id)} › ${n}` : n } })
  }))

  server.registerTool('cambiar_carpeta', {
    title: 'Renombrar o mover una carpeta de Mis planes',
    description: 'Cambia el nombre de una carpeta de Mis planes, o la mueve dentro de otra ("dentro_de"; "sin carpeta" la deja arriba de todo). Lo que tiene adentro se va con ella.',
    inputSchema: {
      carpeta: z.string().describe('La carpeta: su nombre, su ruta o su id.'),
      nombre: z.string().optional().describe('El nombre nuevo.'),
      dentro_de: CARPETA.describe('A dónde se muda ("sin carpeta" = arriba de todo). Sin esto, se queda donde está.'),
    },
    annotations: ESCRIBE,
  }, seguro(async ({ carpeta, nombre, dentro_de }: any) => {
    if (nombre === undefined && dentro_de === undefined) throw new Aviso('¿Qué cambio? Manda "nombre" o "dentro_de".')
    const { carpetas } = await leerMisPlanes(quien)
    const c = buscarCarpeta(carpetas, carpeta)
    if (!c) throw new Aviso('Di cuál carpeta (no "sin carpeta").')
    const cambios: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (nombre !== undefined) {
      if (!String(nombre).trim()) throw new Aviso('El nombre no puede quedar vacío.')
      cambios.nombre = String(nombre).trim()
    }
    let padre: any = null
    if (dentro_de !== undefined) {
      padre = buscarCarpeta(carpetas, dentro_de)
      if (!puedeMoverCarpeta(carpetas, c.id, padre?.id ?? null)) throw new Aviso('Esa carpeta no puede ir ahí: ni dentro de sí misma ni de lo que cuelga de ella, y sin pasar de 5 niveles.')
      cambios.parent_id = padre?.id ?? null
    }
    const { data, error } = await quien.db.from('carpetas_planes').update(cambios).eq('id', c.id).select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) throw new Aviso('No tienes permiso para cambiar esta carpeta.')
    const ahora = dentro_de !== undefined ? (padre ? `${textoDeRuta(carpetas, padre.id)} › ${cambios.nombre ?? c.nombre}` : String(cambios.nombre ?? c.nombre)) : undefined
    return respuesta({ listo: true, antes: textoDeRuta(carpetas, c.id), ...(ahora ? { ahora } : { ahora: cambios.nombre }) })
  }))

  server.registerTool('borrar_carpeta', {
    title: 'Borrar una carpeta de Mis planes',
    description: 'Borra una carpeta de Mis planes. Lo que tenía adentro (subcarpetas y cosas guardadas) NO se borra: sube un nivel, a la carpeta de arriba o a «Sin carpeta». Antes de borrar, di qué carpeta se va.',
    inputSchema: { carpeta: z.string().describe('La carpeta: su nombre, su ruta o su id.'), confirmado: z.boolean().optional().describe(TEXTO_CONFIRMADO_BORRAR), },
    annotations: BORRA,
  }, seguro(async ({ carpeta, confirmado }: any) => {
    const { carpetas, items } = await leerMisPlanes(quien)
    const c = buscarCarpeta(carpetas, carpeta)
    if (!c) throw new Aviso('Di cuál carpeta (no "sin carpeta").')
    const antes = sinConfirmarBorrado(confirmado, `Se borrará la carpeta "${textoDeRuta(carpetas, c.id)}". Lo que tiene adentro NO se borra: sube un nivel.`)
    if (antes) return antes
    const arriba = c.parent_id ?? null
    // Primero sube todo y al final se borra la carpeta: si algo falla a medias, no se pierde nada.
    const subidas = await Promise.all([
      quien.db.from('carpetas_planes').update({ parent_id: arriba, updated_at: new Date().toISOString() }).eq('parent_id', c.id),
      quien.db.from('routine_templates').update({ carpeta_id: arriba }).eq('carpeta_id', c.id),
      quien.db.from('programas_guardados').update({ carpeta_id: arriba }).eq('carpeta_id', c.id),
    ])
    for (const r of subidas) if (r.error) throw new Error(r.error.message)
    const { data, error } = await quien.db.from('carpetas_planes').delete().eq('id', c.id).select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) throw new Aviso('No tienes permiso para borrar esta carpeta.')
    const subcarpetas = carpetas.filter((x) => x.parent_id === c.id).length
    const cosas = items.filter((i) => i.carpetaId === c.id).length
    return respuesta({
      listo: true,
      carpeta_borrada: textoDeRuta(carpetas, c.id),
      subio: `${subcarpetas} subcarpeta(s) y ${cosas} cosa(s) guardada(s) pasaron a ${rutaTexto(carpetas, arriba)}.`,
    })
  }))
}

