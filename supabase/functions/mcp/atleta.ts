// deno-lint-ignore-file no-explicit-any
import type { McpServer } from 'npm:@modelcontextprotocol/sdk@1.30.1/server/mcp.js'
import { z } from 'npm:zod@^4.1.13'
import type { Quien } from './sesion.ts'
import {
  Aviso, diaDesdeTexto, fechaDelAtleta, fechaLarga, NOMBRE_DIA, nombreCorto, palabrasDe, respuesta, seguro, sinAcentos,
  type Dia,
} from './util.ts'
import {
  buscarFase, buscarSemana, claveDeRegistro, conEquipo, describirDia, describirSemana, ejerciciosConLlave, elegirPrograma,
  fasesDe, idDeSesion, planesActivos, resumenDelPlan, tipoDePlan, type Plan, type Programa,
} from './plan.ts'
import {
  cursorAlDia, defaultCursor, findPreviousWeight, historialDePeso, isValidCursor, sessionForToday, today,
} from './app/training-utils.js'
import { aKilos, desdeKilos } from './app/unidades.js'

const SOLO_LEER = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const
const ESCRIBE = { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false } as const

/* ------------------------------------------------------------------ */
/* Lo que se reusa: el estado del atleta y ubicar un día               */
/* ------------------------------------------------------------------ */

export async function estadoDe(quien: Quien, userId: string): Promise<Record<string, any>> {
  const { data, error } = await quien.db.from('user_app_state').select('data').eq('user_id', userId).maybeSingle()
  if (error) throw new Error(error.message)
  return (data?.data && typeof data.data === 'object') ? data.data : {}
}

/** El puntero del atleta puesto al día con el calendario, igual que su app. */
export function cursorDeHoy(fases: any[], guardado: any, fecha: Date) {
  const base = isValidCursor(fases, guardado) ? guardado : defaultCursor(fases)
  return cursorAlDia(fases, base, fecha)
}

/**
 * Los registros del atleta en el programa de cada profesional viven aparte:
 * el del coach principal en `wr:sessions` y `wr:cursor` (como siempre), el de
 * un profesional del equipo en `wr:sessions@<su id>` y `wr:cursor@<su id>`. Así
 * lo que anota en un programa nunca se mezcla con el de otro.
 */
export const cursorDe = (estado: Record<string, any>, pr: Pick<Programa, 'profesionalId'>) =>
  estado[claveDeRegistro('wr:cursor', pr.profesionalId)]
export const registrosDe = (estado: Record<string, any>, pr: Pick<Programa, 'profesionalId'>) =>
  estado[claveDeRegistro('wr:sessions', pr.profesionalId)] ?? {}

export interface Ubicacion {
  fase: any
  semana: any
  entradas: number[]
  dia: Dia
  fecha: { date: Date; texto: string }
  esHoy: boolean
}

/**
 * Qué día del plan se quiere. Sin nada, el de HOY con la misma cuenta que el
 * teléfono del atleta (incluido el día que haya elegido cambiar hoy). Con
 * `dia` y sin fase ni semana, ese día de la semana en la que va.
 */
export function ubicarDia(plan: Plan, cursorGuardado: any, args: { fecha?: string; fase?: string | number; semana?: number; dia?: string }): Ubicacion {
  const fases = fasesDe(plan)
  const kind = tipoDePlan(plan)
  const f = fechaDelAtleta(args.fecha)
  const cursor = cursorDeHoy(fases, cursorGuardado, f.date)

  if (args.fase == null && args.semana == null && !args.dia) {
    const hoy = sessionForToday(fases, kind, cursor, f.date)
    if (hoy) {
      const entradas = hoy.week.days.map((d: any, i: number) => (d.day === hoy.day.day ? i : -1)).filter((i: number) => i >= 0)
      return { fase: hoy.phase, semana: hoy.week, entradas, dia: hoy.day.day, fecha: f, esHoy: true }
    }
  }

  // La fase y la semana donde va, como punto de partida.
  const faseDelCursor = Math.max(0, fases.findIndex((x) => x.id === cursor?.phaseId))
  const fIdx = args.fase != null ? buscarFase(plan, args.fase) : (kind === 'weekly' ? 0 : faseDelCursor)
  const fase = fases[fIdx]
  let sIdx: number
  if (args.semana != null) sIdx = buscarSemana(fase, args.semana)
  else if (kind !== 'weekly' && fase.id === cursor?.phaseId) sIdx = Math.max(0, fase.weekData.findIndex((w: any) => w.num === cursor.weekNum))
  else sIdx = 0
  const semana = fase.weekData[sIdx]
  const dia = args.dia ? diaDesdeTexto(args.dia) : f.dia
  const entradas = (semana?.days ?? []).map((d: any, i: number) => (d.day === dia ? i : -1)).filter((i: number) => i >= 0)
  return { fase, semana, entradas, dia, fecha: f, esHoy: false }
}

/* ------------------------------------------------------------------ */
/* Varios programas: el del coach y el de cada profesional del equipo  */
/* ------------------------------------------------------------------ */

/** Los programas del atleta y su estado, de una sola vez. */
async function programasDe(quien: Quien) {
  const [programas, estado] = await Promise.all([planesActivos(quien, quien.id), estadoDe(quien, quien.id)])
  return { programas, estado }
}

/**
 * Qué programas mandan hoy. Sin `de`: los que no tienen alta (quien ya te dio
 * de alta no te manda sesiones; su programa queda solo para consultar). Con
 * `de`: ese, aunque tenga alta.
 */
export function programasQueSeVen(programas: Programa[], de?: string) {
  if (de && String(de).trim()) return { elegidos: [elegirPrograma(programas, de)], dadosDeAlta: [] as Programa[] }
  const vigentes = programas.filter((p) => !p.altaEn)
  if (!vigentes.length) return { elegidos: programas, dadosDeAlta: [] as Programa[] }
  return { elegidos: vigentes, dadosDeAlta: programas.filter((p) => p.altaEn) }
}

const avisoDeAlta = (dados: Programa[]) => (dados.length
  ? {
    nota: dados.map((p) =>
      `${nombreCorto(p.nombre) || p.de} te dio de alta el ${fechaLarga(p.altaEn!)}: su programa ya no manda sesiones. Para consultarlo, pide "de: ${p.rol}".`,
    ).join(' '),
  }
  : {})

/**
 * Ubica el día en cada programa. Con varios, `fase` y `semana` valen solo para
 * el programa donde existen: en los demás simplemente no hay ese día.
 */
export function ubicarEnTodos(elegidos: Programa[], estado: Record<string, any>, args: any) {
  const resultados = elegidos.map((pr) => {
    try {
      return { pr, u: ubicarDia(pr.plan, cursorDe(estado, pr), args) as Ubicacion | null, registros: registrosDe(estado, pr), error: null as Error | null }
    } catch (e) {
      if (e instanceof Aviso) return { pr, u: null, registros: {} as any, error: e as Error }
      throw e
    }
  })
  const buenos = resultados.filter((r) => r.u)
  if (!buenos.length) throw resultados[0].error!
  return buenos as { pr: Programa; u: Ubicacion; registros: any; error: null }[]
}

type Candidato = { i: number; llave: string; ex: any }

/** Los ejercicios que se pueden anotar ese día, con su llave. */
const candidatosDelDia = (u: Ubicacion): Candidato[] =>
  u.entradas.flatMap((i) => ejerciciosConLlave(u.semana, i)
    .filter(({ ex }) => !ex.isNote && ex.name)
    .map(({ ex, llave }) => ({ i, llave, ex })))

/** Un ejercicio del día por su número "n" o su nombre. */
function encontrarEjercicio(candidatos: Candidato[], u: Ubicacion, ref: string): Candidato {
  const texto = String(ref).trim()
  if (/^\d+(-\d+)?$/.test(texto) && u.entradas.length === 1) {
    const c = candidatos.find((x) => x.llave === texto)
    if (c) return c
  }
  const exactos = candidatos.filter((c) => sinAcentos(c.ex.name) === sinAcentos(texto))
  if (exactos.length === 1) return exactos[0]
  const parecidos = exactos.length ? exactos : candidatos.filter((c) => sinAcentos(c.ex.name).includes(sinAcentos(texto)))
  if (parecidos.length === 1) return parecidos[0]
  const lista = candidatos.map((c) => c.ex.name).join(', ')
  if (parecidos.length > 1) throw new Aviso(`"${texto}" aparece varias veces en el día. Usa su número "n" de ver_mi_dia. Ejercicios: ${lista}.`)
  throw new Aviso(`"${texto}" no está en la sesión de ese día. Los ejercicios son: ${lista}.`)
}

/* ------------------------------------------------------------------ */
/* Herramientas                                                        */
/* ------------------------------------------------------------------ */

const DIA_ARGS = {
  fecha: z.string().optional().describe('Fecha AAAA-MM-DD. Si no se da, es hoy en la hora del atleta.'),
  fase: z.coerce.string().optional().describe('Fase: su número (1, 2…) o su nombre. Solo para ver un día que no es el de hoy.'),
  semana: z.coerce.number().optional().describe('Número de semana dentro de la fase.'),
  dia: z.string().optional().describe('Día de la semana: lunes, martes… Si no se da, el de la fecha.'),
}

const DE = z.string().optional().describe('Si tienes programas de varios profesionales (tu coach, tu fisio…): de cuál, con el nombre de quien lo armó, "coach" o "fisio". Sin esto, todos juntos.')

const SIN_PLAN = 'Todavía no tienes plan. Tu coach te lo arma en Training Lab.'

export function herramientasDelAtleta(server: McpServer, quien: Quien) {
  const p = palabrasDe(quien)

  server.registerTool('ver_mi_plan', {
    title: 'Ver mi plan',
    description: 'Tu plan de entrenamiento en resumen: título, fases con sus semanas, en qué fase, semana y día vas hoy, y cuántas sesiones llevas hechas. Para ver los ejercicios de un día usa ver_mi_dia. Si además del de tu coach tienes el programa de otros profesionales de tu equipo (por ejemplo tu fisio), los da todos juntos, cada uno con de quién es; con "de" pides solo uno.',
    inputSchema: { de: DE },
    annotations: SOLO_LEER,
  }, seguro(async ({ de }: any) => {
    const { programas, estado } = await programasDe(quien)
    if (!programas.length) return respuesta({ plan: null, mensaje: p(SIN_PLAN) })
    const hoy = fechaDelAtleta()
    const resumen = (pr: Programa) => ({
      ...resumenDelPlan(pr.plan, cursorDe(estado, pr), hoy.date),
      sesiones_hechas: Object.values(registrosDe(estado, pr)).filter((s: any) => s?.completed).length,
    })
    if (de || programas.length === 1) {
      const pr = de ? elegirPrograma(programas, de) : programas[0]
      return respuesta({ ...(conEquipo(programas) ? { de: pr.de } : {}), ...resumen(pr), hoy: hoy.texto })
    }
    return respuesta({
      hoy: hoy.texto,
      programas: programas.map((pr) => ({
        de: pr.de,
        ...(pr.altaEn ? { dado_de_alta_el: fechaLarga(pr.altaEn) } : {}),
        ...resumen(pr),
      })),
    })
  }))

  server.registerTool('ver_mi_dia', {
    title: 'Ver mi sesión del día',
    description: 'Los ejercicios de un día de tu plan: series, cantidad (reps, segundos, metros…), intensidad, descanso, notas del coach, si lleva peso, tu peso de la vez anterior y lo que ya anotaste. Sin datos, devuelve la sesión que te toca HOY, con la misma cuenta que tu app. Si tienes programas de varios profesionales, da las sesiones de todos, cada una con de quién es (no incluye a quien ya te dio de alta); con "de" pides solo un programa.',
    inputSchema: { ...DIA_ARGS, de: DE },
    annotations: SOLO_LEER,
  }, seguro(async ({ de, ...args }: any) => {
    const { programas, estado } = await programasDe(quien)
    if (!programas.length) throw new Aviso(p(SIN_PLAN))
    const rotular = conEquipo(programas)
    const { elegidos, dadosDeAlta } = programasQueSeVen(programas, de)
    const ubicados = ubicarEnTodos(elegidos, estado, args)
    const aviso = avisoDeAlta(dadosDeAlta)
    const conSesion = ubicados.filter((x) => x.u.entradas.length)
    if (!conSesion.length) {
      const { u } = ubicados[0]
      const cuando = u.esHoy ? 'Hoy' : `El ${NOMBRE_DIA[u.dia].toLowerCase()}`
      const semana = (x: (typeof ubicados)[number]) =>
        describirSemana(x.u.semana, (i) => idDeSesion(x.pr.plan, x.u.fase, x.u.semana, i, x.u.fecha.date), x.registros)
      if (ubicados.length === 1) {
        return respuesta({
          fecha: u.fecha.texto,
          dia: NOMBRE_DIA[u.dia],
          ...(rotular ? { de: ubicados[0].pr.de } : {}),
          mensaje: `${cuando} ${p('no hay sesión en tu plan.')}`,
          tu_semana: semana(ubicados[0]),
          ...aviso,
        })
      }
      return respuesta({
        fecha: u.fecha.texto,
        dia: NOMBRE_DIA[u.dia],
        mensaje: `${cuando} no hay sesión en ninguno de tus programas.`,
        tu_semana: ubicados.map((x) => ({ de: x.pr.de, dias: semana(x) })),
        ...aviso,
      })
    }
    const sesiones = conSesion.flatMap(({ pr, u, registros }) => {
      const kind = tipoDePlan(pr.plan)
      const fases = fasesDe(pr.plan)
      return u.entradas.map((i) => {
        const id = idDeSesion(pr.plan, u.fase, u.semana, i, u.fecha.date)
        const d = describirDia(u.fase, u.semana, i, registros[id])
        // El peso de la vez anterior, igual que "Antes: X kg" en la app.
        d.ejercicios = d.ejercicios.map((e: any) => {
          if (!e.nombre || !e.lleva_peso) return e
          const antes = findPreviousWeight(fases, registros, e.nombre, { kind, actual: id } as any)
          return antes ? { ...e, peso_anterior: `${desdeKilos(antes.weight, quien.unidad)} ${quien.unidad}` } : e
        })
        return rotular ? { de: pr.de, ...d } : d
      })
    })
    return respuesta({ fecha: conSesion[0].u.fecha.texto, unidad_de_peso: quien.unidad, sesiones, ...aviso })
  }))

  server.registerTool('ver_mi_semana', {
    title: 'Ver mi semana',
    description: 'Los días de la semana que vas haciendo, con el nombre de cada sesión y cuáles ya marcaste como hechas. Con programas de varios profesionales, la semana de cada uno, con de quién es; con "de" pides solo uno.',
    inputSchema: { fecha: DIA_ARGS.fecha, de: DE },
    annotations: SOLO_LEER,
  }, seguro(async ({ de, ...args }: any) => {
    const { programas, estado } = await programasDe(quien)
    if (!programas.length) throw new Aviso(p(SIN_PLAN))
    const rotular = conEquipo(programas)
    const { elegidos, dadosDeAlta } = programasQueSeVen(programas, de)
    const armar = ({ pr, u, registros }: { pr: Programa; u: Ubicacion; registros: any }) => {
      const idDe = (i: number) => idDeSesion(pr.plan, u.fase, u.semana, i, u.fecha.date)
      return {
        fase: u.fase.name,
        semana: u.semana.num,
        ...(u.semana.label ? { nombre_de_la_semana: u.semana.label } : {}),
        ...(u.semana.load ? { carga: u.semana.load } : {}),
        dias: describirSemana(u.semana, idDe, registros),
      }
    }
    const ubicados = ubicarEnTodos(elegidos, estado, { fecha: args.fecha, dia: fechaDelAtleta(args.fecha).dia })
    const aviso = avisoDeAlta(dadosDeAlta)
    if (ubicados.length === 1) return respuesta({ ...(rotular ? { de: ubicados[0].pr.de } : {}), ...armar(ubicados[0]), ...aviso })
    return respuesta({ programas: ubicados.map((x) => ({ de: x.pr.de, ...armar(x) })), ...aviso })
  }))

  server.registerTool('ver_mi_progreso', {
    title: 'Ver mi progreso',
    description: 'Tu progreso. Con "ejercicio": todos los pesos que has anotado en ese ejercicio, en orden, con el cambio del primero al último. Sin "ejercicio": sesiones hechas, tus récords por ejercicio, tus 1RM y tu bienestar de los últimos días. Con programas de varios profesionales suma todos y dice de quién es cada cosa; con "de" pides solo uno.',
    inputSchema: {
      ejercicio: z.string().optional().describe('Nombre del ejercicio, tal como sale en tu plan.'),
      de: DE,
    },
    annotations: SOLO_LEER,
  }, seguro(async ({ ejercicio, de }: any) => {
    const { programas, estado } = await programasDe(quien)
    const rotular = conEquipo(programas)
    const seleccion = de ? [elegirPrograma(programas, de)] : programas
    const u = quien.unidad
    // `desdeKilos` devuelve '' si no hay número; aquí siempre lo hay.
    const enUnidad = (kg: number) => Number(desdeKilos(kg, u))
    const rotula = (pr: Programa) => (rotular ? { de: pr.de } : {})

    if (ejercicio) {
      const encontrados = seleccion
        .map((pr) => ({ pr, hist: historialDePeso(fasesDe(pr.plan), registrosDe(estado, pr), ejercicio, tipoDePlan(pr.plan)) as any[] }))
        .filter((x) => x.hist.length)
      if (!encontrados.length) throw new Aviso(`No hay pesos anotados en "${ejercicio}". Revisa que el nombre sea el de tu plan.`)
      const detalle = ({ pr, hist }: (typeof encontrados)[number]) => {
        const valores = hist.map((h: any) => enUnidad(h.kilos))
        return {
          ...rotula(pr),
          registros: hist.map((h: any) => ({ peso: enUnidad(h.kilos), cuando: h.cuando, donde: h.donde })),
          primero: valores[0],
          ultimo: valores[valores.length - 1],
          mejor: Math.max(...valores),
          cambio: Math.round((valores[valores.length - 1] - valores[0]) * 10) / 10,
        }
      }
      if (encontrados.length === 1) return respuesta({ ejercicio, unidad: u, ...detalle(encontrados[0]) })
      return respuesta({ ejercicio, unidad: u, por_programa: encontrados.map(detalle) })
    }

    // Un récord por ejercicio de cada programa que tenga pesos anotados.
    const records = seleccion.flatMap((pr) => {
      const fases = fasesDe(pr.plan)
      const registros = registrosDe(estado, pr)
      const nombres = new Set<string>()
      fases.forEach((f) => (f.weekData ?? []).forEach((w: any) => (w.days ?? []).forEach((d: any) =>
        (d.exercises ?? []).forEach((e: any) => { if (e.name && !e.isNote) nombres.add(e.name) }))))
      return [...nombres].map((n) => {
        const hist = historialDePeso(fases, registros, n, tipoDePlan(pr.plan)) as any[]
        if (!hist.length) return null
        const v = hist.map((h) => enUnidad(h.kilos))
        return { ...rotula(pr), ejercicio: n, registros: v.length, primero: v[0], ultimo: v[v.length - 1], mejor: Math.max(...v) }
      }).filter(Boolean)
    })

    const hechasDe = (pr: Programa) => Object.values(registrosDe(estado, pr)).filter((s: any) => s?.completed).length
    // Sin ningún plan, lo que haya anotado quedó en las claves de siempre.
    const hechas = seleccion.length
      ? seleccion.reduce((n, pr) => n + hechasDe(pr), 0)
      : Object.values(estado['wr:sessions'] ?? {}).filter((s: any) => s?.completed).length
    const bienestar = Object.entries(estado['wr:wellness'] ?? {}).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 7)
    const unoRM = Object.entries(estado['wr:onerm'] ?? {}).filter(([, kg]) => kg != null)
      .map(([ejercicioRM, kg]: any) => ({ ejercicio: ejercicioRM, un_rm: enUnidad(Number(kg)) }))
    return respuesta({
      unidad: u,
      sesiones_hechas: hechas,
      ...(rotular && seleccion.length > 1 ? { sesiones_hechas_por_programa: seleccion.map((pr) => ({ de: pr.de, sesiones_hechas: hechasDe(pr) })) } : {}),
      records,
      ...(unoRM.length ? { un_rm: unoRM } : {}),
      bienestar_reciente: bienestar.map(([fecha, v]: any) => ({ fecha, ...v })),
    })
  }))

  server.registerTool('anotar_entrenamiento', {
    title: 'Anotar lo que entrené',
    description: 'Anota en Training Lab lo que hiciste en una sesión, igual que si lo escribieras en la app: el peso que usaste y lo que hiciste (reps, segundos, metros…) por ejercicio, notas, y si ya terminaste la sesión. Sin fecha ni día, es la sesión de HOY. Antes de anotar, si no sabes qué ejercicios tiene el día, usa ver_mi_dia. No borra lo que ya había: solo pone encima lo que mandas. Con programas de varios profesionales se anota en el que tenga esa sesión; si hay más de uno posible, di de cuál con "de".',
    inputSchema: {
      ...DIA_ARGS,
      de: DE,
      ejercicios: z.array(z.object({
        ejercicio: z.string().describe('El nombre del ejercicio tal como sale en el plan, o su número "n" de ver_mi_dia.'),
        peso: z.number().nonnegative().optional().describe('El peso que usó.'),
        unidad_peso: z.enum(['kg', 'lb']).optional().describe('kg o lb. Si no se dice, la unidad que el atleta usa en la app.'),
        hecho: z.union([z.number(), z.string()]).optional().describe('Lo que hizo, en la unidad del ejercicio: reps, segundos, metros… Ej.: 8, 45, "8,8,7".'),
      })).optional().describe('Lo que hizo en cada ejercicio.'),
      notas: z.string().optional().describe('Notas de la sesión. Se agregan a las que ya haya.'),
      terminada: z.boolean().optional().describe('true para marcar la sesión como hecha; false para desmarcarla.'),
    },
    annotations: ESCRIBE,
  }, seguro(async ({ de, ...args }: any) => {
    const { programas, estado } = await programasDe(quien)
    if (!programas.length) throw new Aviso(p('Todavía no tienes plan: no hay dónde anotar.'))
    const rotular = conEquipo(programas)

    // ¿En cuál de sus programas anota? El que diga `de`; si tiene uno solo, ese;
    // si no, el que tenga sesión ese día (y esos ejercicios). Nunca a ciegas:
    // un peso anotado en el programa equivocado no se nota hasta semanas después.
    let pr: Programa
    if (de && String(de).trim()) {
      pr = elegirPrograma(programas, de)
    } else if (programas.length === 1) {
      pr = programas[0]
    } else {
      const vigentes = programas.filter((x) => !x.altaEn)
      const conSesion = (vigentes.length ? vigentes : programas).flatMap((x) => {
        try {
          const ub = ubicarDia(x.plan, cursorDe(estado, x), args)
          return ub.entradas.length ? [{ pr: x, u: ub }] : []
        } catch (e) {
          if (e instanceof Aviso) return []
          throw e
        }
      })
      const quedan = conSesion.filter(({ u: ub }) => (args.ejercicios ?? []).every((item: any) => {
        try { encontrarEjercicio(candidatosDelDia(ub), ub, item.ejercicio); return true } catch { return false }
      }))
      if (quedan.length === 1) pr = quedan[0].pr
      else if (!conSesion.length) throw new Aviso('Ese día no hay sesión en ninguno de tus programas: no hay dónde anotar.')
      else throw new Aviso(`Puede ser de ${(quedan.length ? quedan : conSesion).map((x) => x.pr.de).join(' o ')}: di de cuál anotas (argumento "de").`)
    }

    const plan = pr.plan
    const claveSesiones = claveDeRegistro('wr:sessions', pr.profesionalId)
    const u = ubicarDia(plan, cursorDe(estado, pr), args)
    if (!u.entradas.length) throw new Aviso(`${u.esHoy ? 'Hoy' : `El ${NOMBRE_DIA[u.dia].toLowerCase()}`} ${p('no hay sesión en tu plan')}${rotular ? ` de ${pr.de}` : ''}: no hay dónde anotar.`)
    const registros = registrosDe(estado, pr)
    const candidatos = candidatosDelDia(u)

    const parche: Record<string, any> = {}
    const anotado: any[] = []
    for (const item of args.ejercicios ?? []) {
      const c = encontrarEjercicio(candidatos, u, item.ejercicio)
      const id = idDeSesion(plan, u.fase, u.semana, c.i, u.fecha.date)
      const dato: Record<string, string> = {}
      if (item.peso != null) dato.weight = String(aKilos(item.peso, item.unidad_peso ?? quien.unidad))
      if (item.hecho != null && String(item.hecho).trim() !== '') dato.repsHechas = String(item.hecho).trim()
      if (!Object.keys(dato).length) continue
      parche[id] ??= { exercises: {} }
      parche[id].exercises[c.llave] = dato
      anotado.push({
        ejercicio: c.ex.name,
        ...(item.peso != null ? { peso: `${item.peso} ${item.unidad_peso ?? quien.unidad}` } : {}),
        ...(dato.repsHechas ? { hecho: dato.repsHechas } : {}),
      })
    }

    // Las sesiones que se tocaron; si no se anotó ningún ejercicio, todas las del día.
    const ids = Object.keys(parche).length
      ? Object.keys(parche)
      : u.entradas.map((i) => idDeSesion(plan, u.fase, u.semana, i, u.fecha.date))
    if (args.notas) {
      for (const id of ids) {
        const previas = registros[id]?.notes
        parche[id] ??= {}
        parche[id].notes = previas ? `${previas}\n${args.notas}` : args.notas
      }
    }
    if (args.terminada != null) {
      for (const id of ids) {
        parche[id] ??= {}
        parche[id].completed = args.terminada
        parche[id].completedAt = args.terminada ? new Date().toISOString() : null
      }
    }
    if (!Object.keys(parche).length) throw new Aviso('No hay nada que anotar: manda al menos un peso, lo que hizo, notas o si terminó.')

    const { error } = await quien.db.rpc('mezclar_mi_estado', { p_usuario: quien.id, p_cambios: { [claveSesiones]: parche } })
    if (error) throw new Error(error.message)
    return respuesta({
      listo: true,
      fecha: u.fecha.texto,
      ...(rotular ? { programa: pr.de } : {}),
      sesion: u.entradas.map((i) => u.semana.days[i].name).join(' + '),
      anotado,
      ...(args.notas ? { notas: args.notas } : {}),
      ...(args.terminada != null ? { terminada: args.terminada } : {}),
      mensaje: 'Ya se ve en la app de Training Lab.',
    })
  }))

  server.registerTool('anotar_bienestar', {
    title: 'Anotar mi bienestar',
    description: 'Anota tu bienestar del día en Training Lab: sueño, fatiga, dolor o molestias y motivación, del 0 al 10 (sueño y motivación: 10 es lo mejor; fatiga y dolor: 10 es lo peor), y si quieres variabilidad cardiaca (ms) y pulso en reposo (bpm). Solo cambia lo que mandas.',
    inputSchema: {
      fecha: z.string().optional().describe('Fecha AAAA-MM-DD. Si no se da, hoy (el mismo día que usa la app).'),
      sueno: z.number().min(0).max(10).optional().describe('Qué tan bien durmió: 0 mal, 10 excelente.'),
      fatiga: z.number().min(0).max(10).optional().describe('0 sin fatiga, 10 exhausto.'),
      dolor: z.number().min(0).max(10).optional().describe('Dolor o molestias: 0 nada, 10 dolor importante.'),
      motivacion: z.number().min(0).max(10).optional().describe('0 ninguna, 10 listo para todo.'),
      variabilidad_cardiaca: z.number().positive().optional().describe('HRV en milisegundos.'),
      pulso_en_reposo: z.number().positive().optional().describe('Pulsaciones por minuto, en ayunas al despertar.'),
    },
    annotations: ESCRIBE,
  }, seguro(async (args: any) => {
    // La misma llave de fecha que usa la pantalla de bienestar de la app.
    const fecha = args.fecha ? fechaDelAtleta(args.fecha).texto : today()
    const valores: Record<string, number> = {}
    if (args.sueno != null) valores.sleep = args.sueno
    if (args.fatiga != null) valores.fatigue = args.fatiga
    if (args.dolor != null) valores.soreness = args.dolor
    if (args.motivacion != null) valores.motivation = args.motivacion
    if (args.variabilidad_cardiaca != null) valores.hrv = args.variabilidad_cardiaca
    if (args.pulso_en_reposo != null) valores.rhr = args.pulso_en_reposo
    if (!Object.keys(valores).length) throw new Aviso('No hay nada que anotar: manda al menos un valor.')
    // El bienestar es de la persona, no de un programa: una sola clave para todos.
    const { error } = await quien.db.rpc('mezclar_mi_estado', { p_usuario: quien.id, p_cambios: { 'wr:wellness': { [fecha]: valores } } })
    if (error) throw new Error(error.message)
    return respuesta({ listo: true, fecha, anotado: args, mensaje: 'Ya se ve en Salud, en la app de Training Lab.' })
  }))
}
