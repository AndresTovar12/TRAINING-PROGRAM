// deno-lint-ignore-file no-explicit-any
import type { Quien } from './sesion.ts'
import { Aviso, type Dia, NOMBRE_DIA, mismoTexto, sinAcentos } from './util.ts'
import {
  dondeVa, ejerciciosDelBloque, esDescanso, isLoadedExercise, nombreDeSesion, sessionIdFor,
  enOrdenDeSemana,
} from './app/training-utils.js'
import { textoMeta, MEDIDAS } from './app/medidas.js'
import { CAT_COLORS, tipoDeSesion } from './app/theme.js'

/**
 * Leer y escribir planes con la MISMA forma que usa la app.
 *
 * Un plan es: fases → semanas → días → ejercicios. Un día es una entrada con
 * su día de la semana ('Lun'…'Dom', con acento); dos sesiones el mismo lunes
 * son dos entradas con 'Lun'. Los ejercicios van en una lista plana: los que
 * comparten `set` seguidos forman una superserie o circuito, y una nota es
 * `{ isNote, text }`. Todo lo que se escriba aquí tiene que verse igual que si
 * el coach lo hubiera armado a mano en el editor.
 */

export const PALETA = ['#1E40E0', '#3DD9A0', '#FFA047', '#FF7A52', '#A480FF', '#5DA0FF', '#E052A0', '#9090A0']

export interface Plan {
  id: string
  user_id: string
  title: string
  status: string
  data: { kind?: string; phases?: any[] }
  updated_at: string
}

export const tipoDePlan = (plan: Plan | null) => (plan?.data?.kind === 'weekly' ? 'weekly' : 'periodized')
export const fasesDe = (plan: Plan | null): any[] => plan?.data?.phases ?? []

export async function planActivo(quien: Quien, userId: string): Promise<Plan | null> {
  const { data, error } = await quien.db
    .from('plans')
    .select('id, user_id, title, status, data, updated_at')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Plan) ?? null
}

/* ------------------------------------------------------------------ */
/* Encontrar fases, semanas y días                                     */
/* ------------------------------------------------------------------ */

/** "2", "Fuerza", "fase 3" o el id → índice de la fase. */
export function buscarFase(plan: Plan, ref?: string | number | null): number {
  const fases = fasesDe(plan)
  if (!fases.length) throw new Aviso('El plan no tiene fases todavía.')
  if (tipoDePlan(plan) === 'weekly') return 0
  if (ref === undefined || ref === null || String(ref).trim() === '') {
    if (fases.length === 1) return 0
    throw new Aviso(`Di de qué fase: ${fases.map((f, i) => `${i + 1}. ${f.name}`).join(', ')}.`)
  }
  const texto = String(ref).trim()
  const numero = /^(?:fase\s*)?(\d+)$/i.exec(texto)
  if (numero) {
    const i = Number(numero[1]) - 1
    if (fases[i]) return i
  }
  const porId = fases.findIndex((f) => f.id === texto)
  if (porId >= 0) return porId
  const exacta = fases.findIndex((f) => mismoTexto(f.name ?? '', texto))
  if (exacta >= 0) return exacta
  const parecidas = fases.map((f, i) => ({ f, i })).filter(({ f }) => sinAcentos(f.name ?? '').includes(sinAcentos(texto)))
  if (parecidas.length === 1) return parecidas[0].i
  throw new Aviso(`No encontré la fase "${texto}". Las fases son: ${fases.map((f, i) => `${i + 1}. ${f.name}`).join(', ')}.`)
}

export function buscarSemana(fase: any, num?: number | null): number {
  const semanas = fase?.weekData ?? []
  if (!semanas.length) throw new Aviso(`La fase "${fase?.name}" no tiene semanas.`)
  if (num === undefined || num === null) {
    if (semanas.length === 1) return 0
    throw new Aviso(`Di qué semana de "${fase.name}": ${semanas.map((w: any) => w.num).join(', ')}.`)
  }
  const i = semanas.findIndex((w: any) => Number(w.num) === Number(num))
  if (i < 0) throw new Aviso(`"${fase.name}" no tiene semana ${num}. Tiene: ${semanas.map((w: any) => w.num).join(', ')}.`)
  return i
}

/* ------------------------------------------------------------------ */
/* Describir, para que la IA lo lea                                    */
/* ------------------------------------------------------------------ */

/** Los ejercicios de un día con la llave con la que se anotan ("3", "1-2"). */
export function ejerciciosConLlave(semana: any, diaIdx: number) {
  const dia = semana.days[diaIdx]
  const todos: { ex: any; llave: string }[] = []
  ;(dia.exercises ?? []).forEach((ex: any, i: number) => todos.push({ ex, llave: `${i}` }))
  ;(dia.blocks ?? []).forEach((blk: any, bi: number) => {
    ejerciciosDelBloque(semana, diaIdx, blk).forEach((ex: any, i: number) => todos.push({ ex, llave: `${bi}-${i}` }))
  })
  return todos
}

export function describirEjercicio(ex: any) {
  if (ex.isNote) return { nota: ex.text ?? '' }
  const d: Record<string, unknown> = { nombre: ex.name }
  if (ex.sets) d.series = ex.sets
  const meta = textoMeta(ex)
  if (meta) d.cantidad = meta
  if (ex.intensity) d.intensidad = ex.intensity
  if (ex.descanso) d.descanso = ex.descanso
  if (ex.notes) d.notas = ex.notes
  if (ex.cue) d.indicaciones = ex.cue
  d.lleva_peso = isLoadedExercise(ex)
  if (ex.set != null) d.grupo = ex.set
  if (ex.exercise_id) d.ejercicio_id = ex.exercise_id
  return d
}

/** Un día del plan, completo. `registro` es lo que el atleta anotó ahí. */
export function describirDia(fase: any, semana: any, diaIdx: number, registro?: any) {
  const dia = semana.days[diaIdx]
  const ejercicios = ejerciciosConLlave(semana, diaIdx).map(({ ex, llave }) => {
    const d: Record<string, unknown> = { n: llave, ...describirEjercicio(ex) }
    const anotado = registro?.exercises?.[llave]
    if (anotado && (anotado.weight || anotado.repsHechas)) {
      d.anotado = {
        ...(anotado.weight ? { peso_kg: Number(anotado.weight) } : {}),
        ...(anotado.repsHechas ? { hecho: anotado.repsHechas } : {}),
      }
    }
    return d
  })
  return {
    fase: fase.name,
    semana: semana.num,
    dia: dia.day,
    dia_nombre: NOMBRE_DIA[dia.day as Dia] ?? dia.day,
    sesion: nombreDelDia(dia),
    tipo: tipoDeSesion(dia).label,
    descanso: esDescanso(dia),
    ejercicios,
    ...(registro ? {
      hecha: !!registro.completed,
      ...(registro.completedAt ? { hecha_el: registro.completedAt } : {}),
      ...(registro.notes ? { notas_del_atleta: registro.notes } : {}),
    } : { hecha: false }),
  }
}

export function nombreDelDia(dia: any): string {
  return dia.name
    || (dia.blocks ?? []).map((b: any) => nombreDeSesion(b.tag)).filter(Boolean).join(' + ')
    || (esDescanso(dia) ? 'Descanso' : tipoDeSesion(dia).label)
}

/** La semana en una línea por día: "Lun · Lower (hecha)". */
export function describirSemana(semana: any, idDe?: (diaIdx: number) => string, registros?: any) {
  return enOrdenDeSemana(semana.days ?? []).map(({ day, idx }: any) => {
    const id = idDe?.(idx)
    return {
      dia: day.day,
      sesion: nombreDelDia(day),
      tipo: tipoDeSesion(day).label,
      ...(id && registros ? { hecha: !!registros[id]?.completed } : {}),
    }
  })
}

/** El plan entero en pocas líneas: fases, semanas y dónde va el atleta. */
export function resumenDelPlan(plan: Plan, cursor: any, fecha: Date) {
  const kind = tipoDePlan(plan)
  const fases = fasesDe(plan)
  const aqui = dondeVa(fases, kind, cursor, fecha)
  let vaEn: Record<string, unknown> | null = null
  if (aqui) {
    const fase = fases.find((f) => f.id === aqui.faseId)
    const semana = fase?.weekData?.find((w: any) => w.num === aqui.semana)
    const dia = aqui.dia != null ? semana?.days?.[aqui.dia] : null
    vaEn = {
      fase: fase?.name,
      semana: aqui.semana,
      ...(dia ? { dia: dia.day, sesion: nombreDelDia(dia) } : { dia: null, nota: 'Hoy no le toca sesión.' }),
    }
  }
  return {
    titulo: plan.title,
    tipo: kind === 'weekly' ? 'rutina que se repite cada semana' : 'programa por fases',
    fases: fases.map((f, i) => ({
      n: i + 1,
      nombre: f.name,
      ...(f.fullName ? { subtitulo: f.fullName } : {}),
      ...(f.focus ? { enfoque: f.focus } : {}),
      semanas: (f.weekData ?? []).map((w: any) => w.num),
    })),
    va_en: vaEn,
  }
}

/** La llave con la que se anota un día: la misma que usa la app. */
export const idDeSesion = (plan: Plan, fase: any, semana: any, diaIdx: number, fecha: Date) =>
  sessionIdFor(tipoDePlan(plan), fase.id, semana.num, diaIdx, fecha)

/* ------------------------------------------------------------------ */
/* Escribir                                                            */
/* ------------------------------------------------------------------ */

export interface EjercicioEntrada {
  nombre?: string
  nota?: string
  series?: number | string
  cantidad?: number | string
  unidad?: string
  intensidad?: string
  descanso?: string
  notas?: string
  indicaciones?: string
  lleva_peso?: boolean
  grupo?: number
}

export interface SesionEntrada {
  nombre?: string
  tipo?: string
  ejercicios?: EjercicioEntrada[]
}

/**
 * El repertorio que esta persona puede poner en un plan, para ligar cada
 * ejercicio con su ficha (video, fotos). El de la app (del master) más el
 * propio; un atleta, el de su coach. Igual que el selector del editor.
 */
export async function repertorioVisible(quien: Quien, coachDe?: string | null) {
  const { data: masterId } = await quien.db.rpc('master_id')
  let q = quien.db.from('exercises').select('id, name, created_by')
  if (quien.rol !== 'master') {
    const duenos = [masterId, coachDe ?? (quien.rol === 'atleta' ? quien.coachId : quien.id)].filter(Boolean)
    q = q.in('created_by', duenos as string[])
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as { id: string; name: string; created_by: string | null }[]
}

const UNIDADES_VALIDAS = new Set(MEDIDAS.map((m: any) => m.id))

/** Un tipo de sesión escrito como sea ("gym", "Recovery", "Yoga") → los campos del día. */
function tipoDesdeTexto(texto?: string) {
  if (!texto) return { cat: 'gym' }
  const buscado = sinAcentos(texto)
  for (const [slug, info] of Object.entries(CAT_COLORS) as [string, any][]) {
    if (buscado === slug || buscado === sinAcentos(info.label)) return { cat: slug }
  }
  if (buscado === 'descanso') return { cat: 'off' }
  // Uno propio del coach: viaja dentro del día, igual que en el editor.
  return { cat: 'otro', catNombre: texto.trim(), catColor: '#6B7280' }
}

/**
 * Arma un día del plan a partir de lo que manda la IA. Devuelve también los
 * ejercicios que no encontró en el repertorio: se guardan igual, solo sin
 * ficha, y la IA se lo avisa al coach.
 */
export function diaDesdeEntrada(
  diaSemana: Dia,
  sesion: SesionEntrada,
  repertorio: { id: string; name: string }[],
) {
  const sinFicha: string[] = []
  const grupos = new Map<number, string>()
  const exercises = (sesion.ejercicios ?? []).map((e) => {
    if (e.nota && !e.nombre) return { isNote: true, text: e.nota }
    if (!e.nombre) throw new Aviso('Cada ejercicio necesita "nombre" (o "nota" si es una nota).')
    const ficha = repertorio.find((r) => mismoTexto(r.name, e.nombre!))
    if (!ficha) sinFicha.push(e.nombre)
    const ex: Record<string, unknown> = {
      ...(ficha ? { exercise_id: ficha.id } : {}),
      name: ficha ? ficha.name : e.nombre.trim(),
      sets: String(e.series ?? 3),
      reps: e.cantidad != null ? String(e.cantidad) : '',
      intensity: e.intensidad ?? '',
      notes: e.notas ?? '',
    }
    if (e.unidad) {
      if (!UNIDADES_VALIDAS.has(e.unidad)) {
        throw new Aviso(`La unidad "${e.unidad}" no existe. Usa: ${[...UNIDADES_VALIDAS].join(', ')}.`)
      }
      if (e.unidad !== 'reps') ex.unidad = e.unidad
    }
    if (e.descanso) ex.descanso = e.descanso
    if (e.indicaciones) ex.cue = e.indicaciones
    if (e.lleva_peso !== undefined) ex.carga = e.lleva_peso
    if (e.grupo != null) {
      // En una superserie todos dan las mismas vueltas: las del primero.
      if (!grupos.has(e.grupo)) grupos.set(e.grupo, String(ex.sets))
      ex.set = e.grupo
      ex.sets = grupos.get(e.grupo)
    }
    return ex
  })
  const tipo = tipoDesdeTexto(sesion.tipo)
  const dia = {
    day: diaSemana,
    name: sesion.nombre?.trim() || 'Sesión',
    ...tipo,
    exercises,
  }
  return { dia, sinFicha }
}

/** Lo que el editor hace antes de guardar: semanas y duración al día. */
export function normalizar(fases: any[]) {
  return fases.map((f) => ({
    ...f,
    weeks: f.weekData.length,
    duration: `${f.weekData.length} semana${f.weekData.length !== 1 ? 's' : ''}`,
  }))
}

/**
 * Guarda el plan. Con el token de la persona: si no puede editar a este
 * atleta, la base no lo deja. La versión anterior la guarda sola la base
 * (disparador `plans_guardar_version`), así que siempre se puede deshacer.
 */
export async function guardarFases(quien: Quien, plan: Plan, fases: any[], titulo?: string) {
  const { data, error } = await quien.db
    .from('plans')
    .update({
      ...(titulo ? { title: titulo } : {}),
      data: { ...plan.data, kind: tipoDePlan(plan), phases: normalizar(fases) },
      updated_at: new Date().toISOString(),
    })
    .eq('id', plan.id)
    .select('id, updated_at')
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (!data) throw new Aviso('No tienes permiso para cambiar el plan de esta persona.')
  return data
}

export const idAlAzar = () => crypto.randomUUID().slice(0, 8)

export function faseNueva(num: number, datos: { nombre?: string; subtitulo?: string; enfoque?: string; objetivo?: string; color?: string }) {
  return {
    id: `p-${idAlAzar()}`,
    num,
    name: datos.nombre?.trim() || `Fase ${num}`,
    fullName: datos.subtitulo ?? '',
    color: datos.color || PALETA[(num - 1) % PALETA.length],
    focus: datos.enfoque ?? '',
    objective: datos.objetivo ?? '',
    weekData: [] as any[],
  }
}

export const semanaNueva = (num: number, datos: { nombre?: string; carga?: string } = {}) =>
  ({ num, label: datos.nombre ?? '', load: datos.carga ?? '', days: [] as any[] })

export const siguienteNumSemana = (fase: any) => Math.max(0, ...(fase.weekData ?? []).map((w: any) => w.num || 0)) + 1
export const siguienteNumFase = (fases: any[]) => Math.max(0, ...fases.map((f) => f.num || 0)) + 1
