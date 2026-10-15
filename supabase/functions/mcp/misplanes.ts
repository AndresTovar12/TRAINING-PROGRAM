// deno-lint-ignore-file no-explicit-any
import type { McpServer } from 'npm:@modelcontextprotocol/sdk@1.30.1/server/mcp.js'
import { z } from 'npm:zod@^4.1.13'
import type { Quien } from './sesion.ts'
import { Aviso, diaDesdeTexto, nombreDe, respuesta, seguro, sinAcentos, mismoTexto } from './util.ts'
import {
  armarFasesDeLaIA, avisosDeRespuestas, BORRA, CIENCIA, ESCRIBE, ESTRUCTURA_OK, FASE, FASES, planDe, SESION_CON_DIA, SIN_CANTIDAD_OK, SIN_FICHA_OK, SOLO_LEER,
} from './coach.ts'
import {
  buscarFase, buscarSemana, describirDia, describirSemana, diaDesdeEntrada, fasesDe, normalizar, repertorioVisible, tipoDePlan,
} from './plan.ts'
import { anotarDia, exigirRespuestas, nuevaRevision } from './preguntas.ts'
import { claseDe } from './app/clases.js'
import {
  cabeCarpetaEn, descendientesDe, diasDeWorkout, ETIQUETA_DE_TIPO, planDeRutina, programaDePlan, puedeMoverCarpeta, resumenDe, rutinaDePlan, rutinaDeSemana,
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

type Tipo = 'programa' | 'rutina' | 'workout' | 'clase'
type Tabla = 'routine_templates' | 'programas_guardados'
interface Item { id: string; tabla: Tabla; tipo: Tipo; nombre: string; descripcion: string; origen: string; carpetaId: string | null; resumen: any; demo: boolean; actualizado: string | null }

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
async function leerMisPlanes(quien: Quien) {
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
function buscarItem(items: Item[], carpetas: any[], ref: string, tipo?: Tipo): Item {
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
      'Una clase con video no se puede crear aquí (la IA no sube videos): solo se guarda una que ya viene en el día de un atleta. Para darle lo guardado a un atleta aún no hay herramienta aparte: usa crear_plan o aplicar_plantilla.',
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
      const { persona, plan } = await planDe(quien, desde_atleta, de)
      origen = `Del plan de ${nombreDe(persona)}`
      const todas = fasesDe(plan)
      if (!todas.length) throw new Aviso('Ese plan no tiene fases.')
      const semanaDe = (f: any) => f.weekData[buscarSemana(f, semana ?? (f.weekData.length === 1 ? f.weekData[0].num : undefined))]
      if (dia) {
        const f = todas[buscarFase(plan, fase)]
        const w = semanaDe(f)
        const clave = diaDesdeTexto(dia)
        const delDia = structuredClone((w.days ?? []).filter((d: any) => d.day === clave))
        if (!delDia.length) throw new Aviso(`Ese día no tiene sesión en la semana ${w.num}.`)
        const r = filtrarDias(delDia, solo_tipos, sin_tipos)
        quitadas = r.quitadas
        if (!r.quedan.length) throw new Aviso('Con ese filtro no queda ninguna sesión en ese día.')
        data = workoutDeSesiones(r.quedan)
        tipoFinal = claseDe(data) ? 'clase' : 'workout'
      } else if (semana !== undefined) {
        const f = todas[buscarFase(plan, fase)]
        const w = semanaDe(f)
        const r = filtrarDias(structuredClone(w.days ?? []), solo_tipos, sin_tipos)
        quitadas = r.quitadas
        data = { ...rutinaDeSemana({ days: r.quedan }) }
        tipoFinal = 'rutina'
      } else if (tipoDePlan(plan) === 'weekly') {
        const r = filtrarDias(structuredClone(todas[0]?.weekData?.[0]?.days ?? []), solo_tipos, sin_tipos)
        quitadas = r.quitadas
        data = rutinaDePlan({ phases: [{ weekData: [{ days: r.quedan }] }], foto: plan.data?.foto, ciencia: plan.data?.ciencia })
        tipoFinal = 'rutina'
      } else {
        const elegidas = fases_elegidas?.length
          ? [...new Set(fases_elegidas.map((x: string) => buscarFase(plan, x)))].sort((p: any, q: any) => p - q).map((i: any) => todas[i])
          : todas
        const copia = structuredClone(elegidas)
        for (const f of copia) {
          for (const w of f.weekData ?? []) {
            const r = filtrarDias(w.days ?? [], solo_tipos, sin_tipos)
            quitadas += r.quitadas
            w.days = r.quedan
          }
        }
        if (!sesionesReales(copia)) throw new Aviso('Con ese filtro no queda ninguna sesión.')
        const delPlan: any = plan.data ?? {}
        data = programaDePlan({ kind: delPlan.kind, estructura: delPlan.estructura, phases: copia, foto: delPlan.foto, ciencia: fases_elegidas?.length ? undefined : delPlan.ciencia })
        tipoFinal = 'programa'
      }
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
    },
    annotations: BORRA,
  }, seguro(async ({ item, tipo }: any) => {
    const { carpetas, items } = await leerMisPlanes(quien)
    const it = buscarItem(items, carpetas, item, tipo)
    const { data, error } = await quien.db.from(it.tabla).delete().eq('id', it.id).select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) throw new Aviso('No tienes permiso para borrar esto.')
    return respuesta({ listo: true, borrado: { tipo: it.tipo, nombre: it.nombre, carpeta: rutaTexto(carpetas, it.carpetaId) } })
  }))

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
    inputSchema: { carpeta: z.string().describe('La carpeta: su nombre, su ruta o su id.') },
    annotations: BORRA,
  }, seguro(async ({ carpeta }: any) => {
    const { carpetas, items } = await leerMisPlanes(quien)
    const c = buscarCarpeta(carpetas, carpeta)
    if (!c) throw new Aviso('Di cuál carpeta (no "sin carpeta").')
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

