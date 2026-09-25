// deno-lint-ignore-file no-explicit-any
import type { McpServer } from 'npm:@modelcontextprotocol/sdk@1.30.1/server/mcp.js'
import { z } from 'npm:zod@^4.1.13'
import type { Quien } from './sesion.ts'
import { Aviso, diaDesdeTexto, fechaDelAtleta, NOMBRE_DIA, respuesta, seguro, sinAcentos, type Dia } from './util.ts'
import {
  buscarFase, buscarSemana, describirDia, describirSemana, ejerciciosConLlave, fasesDe, idDeSesion,
  planActivo, resumenDelPlan, tipoDePlan, type Plan,
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
/* Herramientas                                                        */
/* ------------------------------------------------------------------ */

const DIA_ARGS = {
  fecha: z.string().optional().describe('Fecha AAAA-MM-DD. Si no se da, es hoy en la hora del atleta.'),
  fase: z.union([z.string(), z.number()]).optional().describe('Fase: su número (1, 2…) o su nombre. Solo para ver un día que no es el de hoy.'),
  semana: z.number().int().optional().describe('Número de semana dentro de la fase.'),
  dia: z.string().optional().describe('Día de la semana: lunes, martes… Si no se da, el de la fecha.'),
}

export function herramientasDelAtleta(server: McpServer, quien: Quien) {
  server.registerTool('ver_mi_plan', {
    title: 'Ver mi plan',
    description: 'Tu plan de entrenamiento en resumen: título, fases con sus semanas, en qué fase, semana y día vas hoy, y cuántas sesiones llevas hechas. Para ver los ejercicios de un día usa ver_mi_dia.',
    inputSchema: {},
    annotations: SOLO_LEER,
  }, seguro(async () => {
    const plan = await planActivo(quien, quien.id)
    if (!plan) return respuesta({ plan: null, mensaje: 'Todavía no tienes plan. Tu coach te lo arma en Training Lab.' })
    const estado = await estadoDe(quien, quien.id)
    const hoy = fechaDelAtleta()
    const hechas = Object.values(estado['wr:sessions'] ?? {}).filter((s: any) => s?.completed).length
    return respuesta({ ...resumenDelPlan(plan, estado['wr:cursor'], hoy.date), sesiones_hechas: hechas, hoy: hoy.texto })
  }))

  server.registerTool('ver_mi_dia', {
    title: 'Ver mi sesión del día',
    description: 'Los ejercicios de un día de tu plan: series, cantidad (reps, segundos, metros…), intensidad, descanso, notas del coach, si lleva peso, tu peso de la vez anterior y lo que ya anotaste. Sin datos, devuelve la sesión que te toca HOY, con la misma cuenta que tu app.',
    inputSchema: DIA_ARGS,
    annotations: SOLO_LEER,
  }, seguro(async (args: any) => {
    const plan = await planActivo(quien, quien.id)
    if (!plan) throw new Aviso('Todavía no tienes plan. Tu coach te lo arma en Training Lab.')
    const estado = await estadoDe(quien, quien.id)
    const u = ubicarDia(plan, estado['wr:cursor'], args)
    const registros = estado['wr:sessions'] ?? {}
    const kind = tipoDePlan(plan)
    const fases = fasesDe(plan)
    if (!u.entradas.length) {
      const idDe = (i: number) => idDeSesion(plan, u.fase, u.semana, i, u.fecha.date)
      return respuesta({
        fecha: u.fecha.texto,
        dia: NOMBRE_DIA[u.dia],
        mensaje: `${u.esHoy ? 'Hoy' : `El ${NOMBRE_DIA[u.dia].toLowerCase()}`} no hay sesión en tu plan.`,
        tu_semana: describirSemana(u.semana, idDe, registros),
      })
    }
    const sesiones = u.entradas.map((i) => {
      const id = idDeSesion(plan, u.fase, u.semana, i, u.fecha.date)
      const d = describirDia(u.fase, u.semana, i, registros[id])
      // El peso de la vez anterior, igual que "Antes: X kg" en la app.
      d.ejercicios = d.ejercicios.map((e: any) => {
        if (!e.nombre || !e.lleva_peso) return e
        const antes = findPreviousWeight(fases, registros, e.nombre, { kind, actual: id } as any)
        return antes ? { ...e, peso_anterior: `${desdeKilos(antes.weight, quien.unidad)} ${quien.unidad}` } : e
      })
      return d
    })
    return respuesta({ fecha: u.fecha.texto, unidad_de_peso: quien.unidad, sesiones })
  }))

  server.registerTool('ver_mi_semana', {
    title: 'Ver mi semana',
    description: 'Los días de la semana que vas haciendo, con el nombre de cada sesión y cuáles ya marcaste como hechas.',
    inputSchema: { fecha: DIA_ARGS.fecha },
    annotations: SOLO_LEER,
  }, seguro(async (args: any) => {
    const plan = await planActivo(quien, quien.id)
    if (!plan) throw new Aviso('Todavía no tienes plan. Tu coach te lo arma en Training Lab.')
    const estado = await estadoDe(quien, quien.id)
    const u = ubicarDia(plan, estado['wr:cursor'], { fecha: args.fecha, dia: fechaDelAtleta(args.fecha).dia })
    const idDe = (i: number) => idDeSesion(plan, u.fase, u.semana, i, u.fecha.date)
    return respuesta({
      fase: u.fase.name,
      semana: u.semana.num,
      ...(u.semana.label ? { nombre_de_la_semana: u.semana.label } : {}),
      ...(u.semana.load ? { carga: u.semana.load } : {}),
      dias: describirSemana(u.semana, idDe, estado['wr:sessions'] ?? {}),
    })
  }))

  server.registerTool('ver_mi_progreso', {
    title: 'Ver mi progreso',
    description: 'Tu progreso. Con "ejercicio": todos los pesos que has anotado en ese ejercicio, en orden, con el cambio del primero al último. Sin "ejercicio": sesiones hechas, tus récords por ejercicio, tus 1RM y tu bienestar de los últimos días.',
    inputSchema: {
      ejercicio: z.string().optional().describe('Nombre del ejercicio, tal como sale en tu plan.'),
    },
    annotations: SOLO_LEER,
  }, seguro(async ({ ejercicio }: any) => {
    const plan = await planActivo(quien, quien.id)
    const estado = await estadoDe(quien, quien.id)
    const registros = estado['wr:sessions'] ?? {}
    const fases = fasesDe(plan)
    const kind = tipoDePlan(plan)
    const u = quien.unidad
    // `desdeKilos` devuelve '' si no hay número; aquí siempre lo hay.
    const enUnidad = (kg: number) => Number(desdeKilos(kg, u))

    if (ejercicio) {
      const hist = historialDePeso(fases, registros, ejercicio, kind)
      if (!hist.length) throw new Aviso(`No hay pesos anotados en "${ejercicio}". Revisa que el nombre sea el de tu plan.`)
      const valores = hist.map((h: any) => enUnidad(h.kilos))
      return respuesta({
        ejercicio,
        unidad: u,
        registros: hist.map((h: any) => ({ peso: enUnidad(h.kilos), cuando: h.cuando, donde: h.donde })),
        primero: valores[0],
        ultimo: valores[valores.length - 1],
        mejor: Math.max(...valores),
        cambio: Math.round((valores[valores.length - 1] - valores[0]) * 10) / 10,
      })
    }

    // Un récord por ejercicio del plan que tenga pesos anotados.
    const nombres = new Set<string>()
    fases.forEach((f) => (f.weekData ?? []).forEach((w: any) => (w.days ?? []).forEach((d: any) =>
      (d.exercises ?? []).forEach((e: any) => { if (e.name && !e.isNote) nombres.add(e.name) }))))
    const porEjercicio = [...nombres].map((n) => {
      const hist = historialDePeso(fases, registros, n, kind)
      if (!hist.length) return null
      const v = hist.map((h: any) => enUnidad(h.kilos))
      return { ejercicio: n, registros: v.length, primero: v[0], ultimo: v[v.length - 1], mejor: Math.max(...v) }
    }).filter(Boolean)

    const hechas = Object.entries(registros).filter(([, s]: any) => s?.completed)
    const bienestar = Object.entries(estado['wr:wellness'] ?? {}).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 7)
    const unoRM = Object.entries(estado['wr:onerm'] ?? {}).filter(([, kg]) => kg != null)
      .map(([ejercicioRM, kg]: any) => ({ ejercicio: ejercicioRM, un_rm: enUnidad(Number(kg)) }))
    return respuesta({
      unidad: u,
      sesiones_hechas: hechas.length,
      records: porEjercicio,
      ...(unoRM.length ? { un_rm: unoRM } : {}),
      bienestar_reciente: bienestar.map(([fecha, v]: any) => ({ fecha, ...v })),
    })
  }))

  server.registerTool('anotar_entrenamiento', {
    title: 'Anotar lo que entrené',
    description: 'Anota en Training Lab lo que hiciste en una sesión, igual que si lo escribieras en la app: el peso que usaste y lo que hiciste (reps, segundos, metros…) por ejercicio, notas, y si ya terminaste la sesión. Sin fecha ni día, es la sesión de HOY. Antes de anotar, si no sabes qué ejercicios tiene el día, usa ver_mi_dia. No borra lo que ya había: solo pone encima lo que mandas.',
    inputSchema: {
      ...DIA_ARGS,
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
  }, seguro(async (args: any) => {
    const plan = await planActivo(quien, quien.id)
    if (!plan) throw new Aviso('Todavía no tienes plan: no hay dónde anotar.')
    const estado = await estadoDe(quien, quien.id)
    const u = ubicarDia(plan, estado['wr:cursor'], args)
    if (!u.entradas.length) throw new Aviso(`${u.esHoy ? 'Hoy' : `El ${NOMBRE_DIA[u.dia].toLowerCase()}`} no hay sesión en tu plan: no hay dónde anotar.`)
    const registros = estado['wr:sessions'] ?? {}

    const candidatos = u.entradas.flatMap((i) => ejerciciosConLlave(u.semana, i)
      .filter(({ ex }) => !ex.isNote && ex.name)
      .map(({ ex, llave }) => ({ i, llave, ex })))

    const encontrar = (ref: string) => {
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

    const parche: Record<string, any> = {}
    const anotado: any[] = []
    for (const item of args.ejercicios ?? []) {
      const c = encontrar(item.ejercicio)
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

    const { error } = await quien.db.rpc('mezclar_mi_estado', { p_usuario: quien.id, p_cambios: { 'wr:sessions': parche } })
    if (error) throw new Error(error.message)
    return respuesta({
      listo: true,
      fecha: u.fecha.texto,
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
    const { error } = await quien.db.rpc('mezclar_mi_estado', { p_usuario: quien.id, p_cambios: { 'wr:wellness': { [fecha]: valores } } })
    if (error) throw new Error(error.message)
    return respuesta({ listo: true, fecha, anotado: args, mensaje: 'Ya se ve en Bienestar, en la app de Training Lab.' })
  }))
}
