// deno-lint-ignore-file no-explicit-any
import type { Quien } from './sesion.ts'
import {
  Aviso, type Dia, NOMBRE_DIA, type Persona, mismoNombre, mismoTexto, nombreCorto, nombreDe, rolDeOficio, sinAcentos,
} from './util.ts'
import { esUnilateral, firmasDeDia, type ItemDeCatalogo, type Renglon } from './preguntas.ts'
import {
  dondeVa, esDescanso, isLoadedExercise, sesionQueRepite, sessionIdFor,
  enOrdenDeSemana,
} from './app/training-utils.js'
import { textoMeta, leeCantidad, MEDIDAS, esCluster } from './app/medidas.js'
import { vueltasDe, ejercicioDeVuelta, parcheDeVueltas, rondasDe } from './app/porVuelta.js'
import { lapsosDe, parcheDeLapsos, aLapsos, comoEjercicio, MAX_LAPSOS } from './app/lapsos.js'
import { limpiaFormato, resumenDeFormato, textoDeResultado } from './app/formatos.js'
import { CAT_COLORS, tipoDeSesion } from './app/theme.js'
import { MAX_TEXTO, MAX_TITULO, normalizaCiencia, nuevoRecuadro } from './app/ciencia.js'

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
  /** `foto` y `ciencia` son del PLAN (no de una fase): la foto de Home y los recuadros de «Ciencia». */
  data: { kind?: string; phases?: any[]; foto?: string; ciencia?: any[] }
  updated_at: string
  /** De quién es el programa: null = el coach principal; si no, un profesional del equipo del atleta. */
  profesional_id?: string | null
}

export const tipoDePlan = (plan: Plan | null) => (plan?.data?.kind === 'weekly' ? 'weekly' : 'periodized')
export const fasesDe = (plan: Plan | null): any[] => plan?.data?.phases ?? []

const CAMPOS_PLAN = 'id, user_id, title, status, data, updated_at, profesional_id'

/**
 * El plan del COACH PRINCIPAL de esta persona (`profesional_id` null): el de
 * siempre. Un atleta puede tener además un programa de cada profesional de su
 * equipo (ver `planesActivos`); con dos activos, un `.maybeSingle()` sin filtro
 * falla, por eso este filtra. Con `profesionalId`, el programa de ESE profesional.
 */
export async function planActivo(quien: Quien, userId: string, profesionalId: string | null = null): Promise<Plan | null> {
  const q = quien.db.from('plans').select(CAMPOS_PLAN).eq('user_id', userId).eq('status', 'active')
  const { data, error } = await (profesionalId ? q.eq('profesional_id', profesionalId) : q.is('profesional_id', null)).maybeSingle()
  if (error) throw new Error(error.message)
  return (data as Plan) ?? null
}

/* ------------------------------------------------------------------ */
/* El equipo de un atleta y el programa de cada quien                  */
/* ------------------------------------------------------------------ */

/**
 * Alguien que atiende a un atleta: su coach principal o un profesional de su
 * equipo. Los registros del atleta en el programa del principal viven en
 * `wr:sessions` y `wr:cursor`; en el de un profesional del equipo, en
 * `wr:sessions@<id>` y `wr:cursor@<id>` (ver `claveDeRegistro`).
 */
export interface Miembro {
  profesionalId: string
  nombre: string
  usuario: string
  oficio: string | null
  rol: 'coach' | 'fisio'
  esPrincipal: boolean
  /** 'activo', o 'pendiente' (lo invitaron y aún no acepta). El principal siempre es activo. */
  estado: string
  /** Cuándo le dio de alta un profesional del equipo. */
  altaEn: string | null
  /** «Beto (coach)», «Juan (fisio)»: así se dice de quién es cada cosa. */
  de: string
}

const etiquetaDe = (nombre: string, rol: string) => (nombreCorto(nombre) ? `${nombreCorto(nombre)} (${rol})` : rol)

/** Cómo se dice de quién es algo: «Beto (coach)». */
export const etiquetaDeProfesional = (nombre: string | null | undefined, oficio: string | null | undefined) =>
  etiquetaDe(nombre ?? '', rolDeOficio(oficio))

/**
 * El coach principal y el equipo (activo y pendiente) de un atleta. La base
 * solo lo contesta al atleta, a quien lo atiende y al master: para cualquier
 * otra persona, la lista viene vacía.
 */
export async function equipoDe(quien: Quien, atletaId: string): Promise<Miembro[]> {
  const { data, error } = await quien.db.rpc('nombres_del_equipo', { p_atleta: atletaId })
  if (error) throw new Error(error.message)
  const lista = ((data ?? []) as any[]).map((m): Miembro => {
    const nombre = m.full_name || m.username
    const rol = rolDeOficio(m.profesion)
    return {
      profesionalId: m.profesional_id, nombre, usuario: m.username, oficio: m.profesion ?? null, rol,
      esPrincipal: !!m.es_principal, estado: m.estado, altaEn: m.alta_en ?? null, de: etiquetaDe(nombre, rol),
    }
  })
  return lista.sort((a, b) => Number(b.esPrincipal) - Number(a.esPrincipal) || a.nombre.localeCompare(b.nombre))
}

/** Un plan activo de un atleta, con de quién es. */
export interface Programa {
  plan: Plan
  /** null = el del coach principal. */
  profesionalId: string | null
  de: string
  rol: 'coach' | 'fisio'
  nombre: string
  usuario: string
  esPrincipal: boolean
  /** Si el profesional lo dio de alta: ese programa ya no manda sesiones, solo se consulta. */
  altaEn: string | null
}

/**
 * TODOS los planes activos de un atleta que esta persona puede ver: el del
 * coach principal primero y luego el de cada profesional de su equipo. Un
 * programa se ve mientras su profesional siga en el equipo: si el atleta lo
 * quitó (o aún no acepta), no aparece, aunque el plan siga guardado.
 */
export async function planesActivos(quien: Quien, userId: string, equipo?: Miembro[]): Promise<Programa[]> {
  const [{ data, error }, miembros] = await Promise.all([
    quien.db.from('plans').select(CAMPOS_PLAN).eq('user_id', userId).eq('status', 'active'),
    equipo ?? equipoDe(quien, userId),
  ])
  if (error) throw new Error(error.message)
  const vigentes = new Map(miembros.filter((m) => !m.esPrincipal && m.estado === 'activo').map((m) => [m.profesionalId, m]))
  const principal = miembros.find((m) => m.esPrincipal)
  const lista: Programa[] = []
  for (const plan of (data ?? []) as Plan[]) {
    if (!plan.profesional_id) {
      lista.push({
        plan, profesionalId: null, de: principal?.de ?? 'coach', rol: principal?.rol ?? 'coach',
        nombre: principal?.nombre ?? '', usuario: principal?.usuario ?? '', esPrincipal: true, altaEn: null,
      })
      continue
    }
    const m = vigentes.get(plan.profesional_id)
    if (!m) continue
    lista.push({
      plan, profesionalId: m.profesionalId, de: m.de, rol: m.rol, nombre: m.nombre, usuario: m.usuario,
      esPrincipal: false, altaEn: m.altaEn,
    })
  }
  return lista.sort((a, b) => Number(b.esPrincipal) - Number(a.esPrincipal) || a.de.localeCompare(b.de))
}

/** ¿Tiene más de un programa, o el suyo es de un profesional del equipo? Entonces cada cosa dice de quién es. */
export const conEquipo = (programas: Programa[]) => programas.length > 1 || programas.some((p) => !p.esPrincipal)

/** `wr:sessions` → `wr:sessions@<profesional>` para el programa de un profesional del equipo. El principal no lleva sufijo. */
export const claveDeRegistro = (base: string, profesionalId: string | null | undefined) =>
  (profesionalId ? `${base}@${profesionalId}` : base)

interface Referible { de: string; rol: 'coach' | 'fisio'; esPrincipal: boolean; nombre: string; usuario: string }

/**
 * «Juan», «@juan», «fisio», «coach» o «principal» → de cuál de la lista se
 * habla. Si son varios, pide el nombre; si ninguno, dice cuáles hay.
 */
export function buscarPorReferencia<T extends Referible>(lista: T[], ref: string): T {
  const texto = sinAcentos(String(ref ?? '')).replace(/^@/, '').replace(/^(mi|el|la)\s+/, '').trim()
  const opciones = lista.map((x) => x.de).join(', ')
  if (!texto) throw new Aviso(`Di de quién: ${opciones}.`)
  const uno = (m: T[]): T | null => {
    if (m.length > 1) throw new Aviso(`"${ref}" puede ser más de uno: ${m.map((x) => x.de).join(', ')}. Di su nombre.`)
    return m[0] ?? null
  }
  const encontrado = uno(lista.filter((x) => x.usuario && sinAcentos(x.usuario) === texto))
    ?? (texto === 'principal' || texto === 'coach principal' ? uno(lista.filter((x) => x.esPrincipal)) : null)
    ?? (texto === 'coach' || texto === 'fisio' ? uno(lista.filter((x) => x.rol === texto)) : null)
    ?? uno(lista.filter((x) => sinAcentos(nombreCorto(x.nombre)) === texto || sinAcentos(x.nombre) === texto))
    ?? uno(lista.filter((x) => sinAcentos(x.nombre).includes(texto)))
  if (!encontrado) throw new Aviso(`No encontré a "${ref}" entre ${opciones}.`)
  return encontrado
}

/** De qué programa se habla: uno de los del atleta, por su profesional. */
export const elegirPrograma = (programas: Programa[], de: string) => buscarPorReferencia(programas, de)

/**
 * De quién es el programa de este atleta que ESTA persona lee o cambia por
 * defecto: el suyo. Su coach principal, el del principal; un profesional del
 * equipo, el suyo; el master, el del principal. (null = el del coach principal.)
 */
export const miProgramaCon = (quien: Quien, persona: Pick<Persona, 'coach_id'>): string | null =>
  (quien.rol === 'master' || persona.coach_id === quien.id ? null : quien.id)

export interface ProgramaQueEdito {
  /** null = el del coach principal. */
  profesionalId: string | null
  /** «Juan (fisio)»: el profesional dueño del programa. */
  de: string
}

/**
 * El programa que ESTA persona cambia en este atleta:
 *  - su coach principal, el del principal;
 *  - un profesional del equipo, el SUYO (la base tampoco le deja tocar otro);
 *  - el master, el del principal, o el del profesional que diga con `de`.
 * Cada quien cambia solo lo suyo: pedir el de otro es un aviso claro, no un
 * error de permisos.
 */
export async function programaQueEdito(quien: Quien, persona: Persona, de?: string | null): Promise<ProgramaQueEdito> {
  const esMaster = quien.rol === 'master'
  const miPrograma = persona.coach_id === quien.id ? null : quien.id
  let profesionalId: string | null = miProgramaCon(quien, persona)
  let etiqueta = etiquetaDe(quien.nombre, rolDeOficio(quien.profesion))
  if (de && String(de).trim()) {
    const miembros = (await equipoDe(quien, persona.id)).filter((m) => m.esPrincipal || m.estado === 'activo')
    const m = buscarPorReferencia(miembros, de)
    const id = m.esPrincipal ? null : m.profesionalId
    if (!esMaster && id !== miPrograma) {
      throw new Aviso(`El programa de ${m.de} lo cambia esa persona. De ${nombreDe(persona)} solo puedes cambiar el tuyo.`)
    }
    profesionalId = id
    etiqueta = m.de
  }
  return { profesionalId, de: etiqueta }
}

/** El plan que esta persona cambia en este atleta (o null si todavía no lo tiene). */
export async function planQueEdito(quien: Quien, persona: Persona, de?: string | null): Promise<ProgramaQueEdito & { plan: Plan | null }> {
  const r = await programaQueEdito(quien, persona, de)
  return { ...r, plan: await planActivo(quien, persona.id, r.profesionalId) }
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

/** Los ejercicios de una sesión con la llave con la que se anotan ("3"). Una sesión que solo dice «repite…» se anota sobre la lista de la que repite. */
export function ejerciciosConLlave(semana: any, diaIdx: number): { ex: any; llave: string }[] {
  const dia = semana.days[diaIdx]
  const lista: any[] = (sesionQueRepite(semana, diaIdx)?.day ?? dia).exercises ?? []
  return lista.map((ex, i) => ({ ex, llave: `${i}` }))
}

export function describirEjercicio(ex: any) {
  if (ex.isNote) return { nota: ex.text ?? '' }
  const d: Record<string, unknown> = { nombre: ex.name }
  if (ex.sets) d.series = ex.sets
  const meta = textoMeta(ex)
  if (meta) d.cantidad = meta
  // Un cluster se manda como «2+2+2» con su unidad y su pausa aparte: así vuelve igual al reescribir la sesión.
  if (leeCantidad(ex).unidad === 'cluster') {
    d.cantidad = leeCantidad(ex).cantidad
    d.unidad = 'cluster'
    if (ex.entreBloques) d.entre_bloques = String(ex.entreBloques)
  }
  if (leeCantidad(ex).porLado) d.por_lado = true
  if (ex.intensity) d.intensidad = ex.intensity
  /* Reps y carga distintas en cada vuelta. Igual que el formato: se enseña entero porque `editar_dia`
     reemplaza la sesión, y lo que la IA no ve, lo borra al reescribirla. Con esto, "cantidad" e
     "intensidad" de arriba son solo las de la primera vuelta. */
  const vueltas = vueltasDe(ex)
  if (vueltas) {
    d.por_vuelta = vueltas.map((f: any, i: number) => ({
      vuelta: i + 1,
      cantidad: textoMeta({ ...ejercicioDeVuelta(ex, f), porLado: false }) ?? '',
      intensidad: f.intensity,
    }))
  }
  /* Los lapsos de un ejercicio (Correr: 800 m a 4:34-5:00, luego 2 min a 6:39-7:00). Igual que el formato y las vueltas, se
     enseñan completos: `editar_dia` reemplaza la sesión, y lo que la IA no ve, lo borra al reescribirla. Con esto,
     "cantidad", "intensidad" y "descanso" de arriba son solo los del primer y el último lapso. */
  const lapsos = lapsosDe(ex)
  if (lapsos) {
    d.lapsos = lapsos.map((l: any, i: number) => ({
      lapso: i + 1,
      cantidad: textoMeta({ ...comoEjercicio(ex, l), porLado: false }) ?? '',
      intensidad: l.intensity,
      descanso: l.descanso,
    }))
  }
  if (ex.descanso) d.descanso = ex.descanso
  // Lo que se descansa al terminar el Set, antes del siguiente (vive en el último ejercicio del Set).
  if (ex.descansoSet) d.descanso_set = ex.descansoSet
  if (ex.notes) d.notas = ex.notes
  if (ex.cue) d.indicaciones = ex.cue
  d.lleva_peso = isLoadedExercise(ex)
  if (ex.set != null) d.grupo = ex.set
  if (ex.exercise_id) d.ejercicio_id = ex.exercise_id
  /* El formato con reloj (AMRAP, EMOM, Tabata…) del grupo. Se muestra COMPLETO porque `editar_dia`
     reemplaza la sesión entera: si la IA no lo ve, lo reescribe sin él y el coach lo pierde. */
  const formato = ex.formato ? limpiaFormato(ex.formato) : null
  if (formato) { d.formato = formato; d.formato_resumen = resumenDeFormato(formato) }
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
      // Si lo anotó vuelta por vuelta, cada una; arriba queda el resumen (la más pesada).
      const porVuelta = Object.entries(anotado.vueltas ?? {})
        .filter(([, v]: [string, any]) => v && (v.weight || v.repsHechas))
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([i, v]: [string, any]) => ({
          vuelta: Number(i) + 1,
          ...(v.weight ? { peso_kg: Number(v.weight) } : {}),
          ...(v.repsHechas ? { hecho: v.repsHechas } : {}),
        }))
      if (porVuelta.length) (d.anotado as any).por_vuelta = porVuelta
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
    ...(registro?.formatos && Object.keys(registro.formatos).length ? {
      // Lo que anotó el atleta de cada Set con formato; la llave es la `n` de su primer ejercicio.
      resultados_de_formatos: Object.entries(registro.formatos).map(([n, r]: [string, any]) => ({
        n, resultado: textoDeResultado(r), ...(r?.seg ? { duro_seg: r.seg } : {}),
      })),
    } : {}),
    ...(registro ? {
      hecha: !!registro.completed,
      ...(registro.completedAt ? { hecha_el: registro.completedAt } : {}),
      ...(registro.notes ? { notas_del_atleta: registro.notes } : {}),
    } : { hecha: false }),
  }
}

export function nombreDelDia(dia: any): string {
  return dia.name
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
    ...resumenDeCiencia(plan),
  }
}

/** La llave con la que se anota un día: la misma que usa la app. */
export const idDeSesion = (plan: Plan, fase: any, semana: any, diaIdx: number, fecha: Date) =>
  sessionIdFor(tipoDePlan(plan), fase.id, semana.num, diaIdx, fecha)

/* ------------------------------------------------------------------ */
/* Ciencia: el porqué del plan                                         */
/* ------------------------------------------------------------------ */

/**
 * La «Ciencia» de un plan son recuadros con título y texto que el atleta lee en Home (ver `lib/ciencia.js`, que es la
 * misma pieza que usa la app). Hay de dos clases: los de TODO el plan (`plan.data.ciencia`) y los de UNA fase
 * (`fase.ciencia`). Es opcional: un plan sin ninguno simplemente no enseña la tarjeta.
 */
export interface Recuadro { id: string; titulo: string; texto: string }
export type ModoCiencia = 'agregar' | 'reemplazar'

export const cienciaDelPlan = (plan: Plan | null): Recuadro[] => normalizaCiencia(plan?.data?.ciencia)
export const cienciaDeFase = (fase: any): Recuadro[] => normalizaCiencia(fase?.ciencia)

/** Cuántos recuadros tiene el plan en total (los de todo el plan y los de cada fase). */
export const cuantosRecuadros = (plan: Plan | null) =>
  cienciaDelPlan(plan).length + fasesDe(plan).reduce((n, f) => n + cienciaDeFase(f).length, 0)

/** Qué recuadros tiene el plan y dónde, sin los textos (para ver_plan_de_atleta). Vacío si no tiene ninguno. */
export function resumenDeCiencia(plan: Plan) {
  const delPlan = cienciaDelPlan(plan).map((r) => r.titulo)
  const porFase = fasesDe(plan)
    .map((f) => ({ fase: f.name, recuadros: cienciaDeFase(f).map((r) => r.titulo) }))
    .filter((x) => x.recuadros.length)
  if (!delPlan.length && !porFase.length) return {}
  return {
    ciencia: {
      ...(delPlan.length ? { del_plan: delPlan } : {}),
      ...(porFase.length ? { por_fase: porFase } : {}),
      nota: 'Son los recuadros de «Ciencia» que lee el atleta. El texto completo: ver_ciencia_del_plan.',
    },
  }
}

/**
 * Lo que manda la IA ([{ titulo, texto }]) → recuadros listos, con su id. No se acorta nada en silencio: un recuadro
 * demasiado largo o vacío es un aviso para que la IA lo arregle (partirlo, o ponerle título o texto).
 */
export function recuadrosDeLaIA(lista: any[] | undefined, donde: string): Recuadro[] {
  const salida: Recuadro[] = []
  ;(lista ?? []).forEach((r, i) => {
    const titulo = String(r?.titulo ?? '').trim()
    const texto = String(r?.texto ?? '').trim()
    if (titulo.length > MAX_TITULO) throw new Aviso(`El título del recuadro ${i + 1} (${donde}) mide ${titulo.length} caracteres y el máximo es ${MAX_TITULO}. Acórtalo.`)
    if (texto.length > MAX_TEXTO) throw new Aviso(`El recuadro "${titulo || i + 1}" (${donde}) mide ${texto.length} caracteres y el máximo es ${MAX_TEXTO}. Pártelo en dos recuadros.`)
    const nuevo = nuevoRecuadro({ titulo, texto }) as Recuadro | null
    if (!nuevo) throw new Aviso(`El recuadro ${i + 1} (${donde}) no tiene título ni texto.`)
    salida.push(nuevo)
  })
  return salida
}

/**
 * Lo que hace `editar_ciencia` con la lista de recuadros de UN sitio (el plan o una fase):
 *   «agregar»    cada recuadro se suma al final; si ya hay uno con ese título (sin importar mayúsculas ni acentos), se le
 *                cambia el texto y se queda donde estaba;
 *   «reemplazar» la lista queda exactamente como se manda.
 * `quitar` son títulos que se sacan después. Devuelve la lista nueva y cuánto cambió.
 */
export function cambiarRecuadros(actual: Recuadro[], nuevos: Recuadro[], modo: ModoCiencia, quitar: string[] = []) {
  let lista: Recuadro[] = actual.map((r) => ({ ...r }))
  let agregados = 0
  let actualizados = 0
  if (modo === 'reemplazar') {
    lista = nuevos.map((r) => ({ ...r }))
    agregados = nuevos.length
  } else {
    for (const r of nuevos) {
      const i = lista.findIndex((x) => mismoTexto(x.titulo, r.titulo))
      if (i >= 0) { lista[i] = { ...lista[i], titulo: r.titulo, texto: r.texto }; actualizados += 1 } else { lista.push({ ...r }); agregados += 1 }
    }
  }
  const noEncontrados = quitar.filter((t) => !lista.some((r) => mismoTexto(r.titulo, t)))
  const antes = lista.length
  lista = lista.filter((r) => !quitar.some((t) => mismoTexto(r.titulo, t)))
  return { lista, agregados, actualizados, quitados: antes - lista.length, noEncontrados }
}

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
  formato?: unknown
  por_lado?: boolean
  descanso_set?: string
  entre_bloques?: string
  por_vuelta?: { cantidad?: number | string; intensidad?: string }[]
  lapsos?: { cantidad?: number | string; unidad?: string; intensidad?: string; descanso?: string }[]
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
  // Con equipo, músculos y categoría: es lo que se enseña de cada «parecido» cuando falta preguntar (`preguntas.ts`).
  let q = quien.db.from('exercises').select('id, name, created_by, equipment, muscle_primary, category:exercise_categories(name)')
  if (quien.rol !== 'master') {
    const duenos = [masterId, coachDe ?? (quien.rol === 'atleta' ? quien.coachId : quien.id)].filter(Boolean)
    q = q.in('created_by', duenos as string[])
  }
  const { data, error } = await q
  if (error) throw new Error(error.message)
  return (data ?? []) as (ItemDeCatalogo & { created_by: string | null })[]
}

/** Las biseries, triseries y circuitos que ya tiene un plan (cada uno, por los nombres de sus ejercicios). */
export function firmasDeGrupos(plan: Plan | null): Set<string> {
  return new Set(fasesDe(plan).flatMap((f: any) => (f.weekData ?? []).flatMap((w: any) => (w.days ?? []).flatMap((d: any) => firmasDeDia(d.exercises ?? [])))))
}

/** Los nombres de ejercicio que ya tiene un plan, en cualquier fase, semana y día. */
export function nombresDeEjercicios(plan: Plan | null): string[] {
  return fasesDe(plan).flatMap((f: any) => (f.weekData ?? []).flatMap((w: any) => (w.days ?? []).flatMap((d: any) =>
    (d.exercises ?? []).filter((e: any) => !e.isNote && e.name).map((e: any) => String(e.name)))))
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
 * ejercicios que no encontró en el repertorio (`sinFicha`): quien llama decide
 * qué hacer con ellos (`exigirFichas` en `preguntas.ts`: preguntar antes de
 * guardar, salvo los que la persona ya confirmó que van sin ficha).
 */
export function diaDesdeEntrada(
  diaSemana: Dia,
  sesion: SesionEntrada,
  repertorio: { id: string; name: string }[],
) {
  const sinFicha: string[] = []
  // Lo que la persona no dijo y quien arma la rutina tendría que preguntar (ver `exigirRespuestas`).
  const sinCantidad: { nombre: string; grupo: number | null }[] = []
  const porLado: string[] = []
  const grupos = new Map<number, string>()
  // El formato de cada grupo: el del primer ejercicio que lo traiga, y vale para todos los del grupo.
  const formatosDeGrupo = new Map<number, any>()
  const vueltasPedidas = new Map<any, { cantidad?: number | string; intensidad?: string }[]>()
  // Los lapsos de cada ejercicio que los pidió: se arman al final, cuando ya se sabe qué ejercicios comparten Set.
  const lapsosPedidos = new Map<any, NonNullable<EjercicioEntrada['lapsos']>>()
  const exercises = (sesion.ejercicios ?? []).map((e) => {
    if (e.nota && !e.nombre) return { isNote: true, text: e.nota }
    if (!e.nombre) throw new Aviso('Cada ejercicio necesita "nombre" (o "nota" si es una nota).')
    // Igual en todo menos en espacios y guiones: «Lat Pulldown» y «Lat Pull-Down» son la misma ficha.
    const ficha = repertorio.find((r) => mismoTexto(r.name, e.nombre!)) ?? repertorio.find((r) => mismoNombre(r.name, e.nombre!))
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
    if (e.descanso_set && String(e.descanso_set).trim()) ex.descansoSet = String(e.descanso_set).trim()
    if (e.entre_bloques && String(e.entre_bloques).trim()) {
      if (ex.unidad !== 'cluster' && !esCluster(String(ex.reps ?? ''))) throw new Aviso(`"${ex.name}": "entre_bloques" solo va con un cluster (unidad "cluster" y cantidad como "2+2+2").`)
      ex.entreBloques = String(e.entre_bloques).trim()
    }
    if (e.indicaciones) ex.cue = e.indicaciones
    if (e.lleva_peso !== undefined) ex.carga = e.lleva_peso
    if (e.por_lado === true) ex.porLado = true
    const nombreFinal = String(ex.name)
    // Sin cantidad: ni reps ni tiempo, ni un reloj de formato, ni vueltas con su cantidad.
    const conLapsos = Array.isArray(e.lapsos) && e.lapsos.length > 0
    if ((e.cantidad == null || String(e.cantidad).trim() === '') && e.formato == null && !(Array.isArray(e.por_vuelta) && e.por_vuelta.length) && !conLapsos) {
      sinCantidad.push({ nombre: nombreFinal, grupo: e.grupo ?? null })
    }
    // Cada lapso dice cuánto: si falta en alguno, se pregunta igual que una cantidad que falta.
    if (conLapsos && e.lapsos!.some((l) => l?.cantidad == null || String(l.cantidad).trim() === '')) {
      sinCantidad.push({ nombre: nombreFinal, grupo: e.grupo ?? null })
    }
    if (conLapsos) {
      if (e.lapsos!.length > MAX_LAPSOS) throw new Aviso(`"${nombreFinal}": ${e.lapsos!.length} lapsos son demasiados (máximo ${MAX_LAPSOS}).`)
      if (e.por_vuelta?.length) throw new Aviso(`"${nombreFinal}": "lapsos" no se combina con "por_vuelta": cada lapso ya trae su cantidad y su carga. Usa uno de los dos.`)
      lapsosPedidos.set(ex, e.lapsos!)
    }
    if (e.por_lado === undefined && esUnilateral(nombreFinal)) porLado.push(nombreFinal)
    // Se colocan al final, cuando ya se sabe cuántas veces se repite el grupo.
    if (Array.isArray(e.por_vuelta) && e.por_vuelta.length) vueltasPedidas.set(ex, e.por_vuelta)
    if (e.grupo != null) {
      // En una superserie todos dan las mismas vueltas: las del primero.
      if (!grupos.has(e.grupo)) grupos.set(e.grupo, String(ex.sets))
      ex.set = e.grupo
      ex.sets = grupos.get(e.grupo)
    }
    if (e.formato != null) {
      const formato = limpiaFormato(e.formato)
      if (!formato) {
        throw new Aviso(`El formato de "${e.nombre}" no se entiende. Manda "pasos": una lista con al menos un tramo {tipo: "trabajo" | "descanso", seg: segundos o null}.`)
      }
      if (e.grupo != null) { if (!formatosDeGrupo.has(e.grupo)) formatosDeGrupo.set(e.grupo, formato) } else {
        ex.formato = formato
        ex.sets = String(formato.vueltas)
      }
    }
    return ex
  })
  // Con formato, las «series» del grupo son sus vueltas, y cada ejercicio guarda su copia (igual que el editor).
  exercises.forEach((ex: any) => {
    const formato = ex.set != null ? formatosDeGrupo.get(ex.set) : null
    if (!formato) return
    ex.formato = JSON.parse(JSON.stringify(formato))
    ex.sets = String(formato.vueltas)
  })
  /* Reps y carga distintas por vuelta: una entrada por cada vez que se repite el ejercicio (sus "series").
     Se revisa aquí y no arriba porque en un grupo las series son las del primero. */
  vueltasPedidas.forEach((pedidas, ex: any) => {
    if (ex.formato) throw new Aviso(`"${ex.name}": "por_vuelta" no se combina con un "formato" de reloj. Usa uno de los dos.`)
    const rondas = rondasDe(ex.sets)
    if (!rondas || pedidas.length !== rondas) {
      throw new Aviso(`"${ex.name}": "por_vuelta" trae ${pedidas.length} y el ejercicio se repite ${ex.sets} veces ("series"). Manda una entrada por cada vez (mínimo 2).`)
    }
    const filas = pedidas.map((v) => {
      const texto = String(v?.cantidad ?? '').trim()
      const leida = leeCantidad({ reps: texto, unidad: ex.unidad })
      return { reps: leida.libre ? texto : leida.cantidad, intensity: String(v?.intensidad ?? '').trim() }
    })
    Object.assign(ex, parcheDeVueltas(filas))
    if (ex.porVuelta === undefined) delete ex.porVuelta
  })
  /* Lapsos: cada uno es «cuánto · carga · descanso», en la unidad que diga (o la del ejercicio si solo trae un número).
     Un Set está en lapsos cuando sus ejercicios los traen: si UNO del grupo los pide, todos los del grupo quedan en lapsos
     (los que no los pidieron, con un lapso: el de su línea), igual que en el editor. */
  lapsosPedidos.forEach((pedidos, ex: any) => {
    if (ex.formato || (ex.set != null && formatosDeGrupo.has(ex.set))) {
      throw new Aviso(`"${ex.name}": "lapsos" no se combina con un "formato" de reloj. Usa uno de los dos.`)
    }
    const filas = pedidos.map((l) => {
      const texto = String(l?.cantidad ?? '').trim()
      if (l?.unidad && !UNIDADES_VALIDAS.has(l.unidad)) {
        throw new Aviso(`"${ex.name}": la unidad "${l.unidad}" de un lapso no existe. Usa: ${[...UNIDADES_VALIDAS].join(', ')}.`)
      }
      // Un número solo toma la unidad del ejercicio; si el texto ya dice «800 m», manda lo que dice.
      const unidad = l?.unidad ?? (/^[\d.,\s\-–]*$/.test(texto) ? (ex.unidad as string | undefined) : undefined)
      const leida = leeCantidad({ reps: texto, unidad })
      return { reps: leida.libre ? texto : leida.cantidad, unidad: leida.unidad, intensity: String(l?.intensidad ?? '').trim(), descanso: String(l?.descanso ?? '').trim() }
    })
    Object.assign(ex, parcheDeLapsos(filas))
    delete ex.porVuelta
  })
  if (lapsosPedidos.size) {
    const enLapsos = new Set<any>([...lapsosPedidos.keys()].map((ex: any) => ex.set ?? ex))
    exercises.forEach((ex: any, i: number) => {
      if (ex.isNote || ex.lapsos || !enLapsos.has(ex.set ?? ex)) return
      if (ex.formato) throw new Aviso(`"${ex.name}": va en un grupo con "lapsos" y no puede tener "formato" de reloj.`)
      exercises[i] = aLapsos(ex)
    })
  }
  /* El descanso entre Sets es del Set: si la IA lo puso en un ejercicio de un grupo (superserie, circuito) que no es el último,
     se muda al último, que es donde lo guarda el editor. */
  const rayas = new Map<number, string>()
  exercises.forEach((ex: any) => {
    if (ex.set == null || ex.descansoSet === undefined) return
    if (!rayas.has(ex.set)) rayas.set(ex.set, ex.descansoSet)
    delete ex.descansoSet
  })
  rayas.forEach((descanso, grupo) => {
    const miembros = exercises.filter((ex: any) => ex.set === grupo)
    if (miembros.length) (miembros[miembros.length - 1] as any).descansoSet = descanso
  })
  const tipo = tipoDesdeTexto(sesion.tipo)
  const dia = {
    day: diaSemana,
    name: sesion.nombre?.trim() || 'Sesión',
    ...tipo,
    exercises,
  }
  // Un grupo con reloj (AMRAP, EMOM…) ya dice cuánto dura: sus ejercicios no necesitan cantidad.
  const sinCantidadFinal = sinCantidad.filter((x) => !(x.grupo != null && formatosDeGrupo.has(x.grupo))).map((x) => x.nombre)
  const lista: Renglon[] = exercises.filter((ex: any) => !ex.isNote).map((ex: any) => ({
    nombre: String(ex.name), grupo: ex.set ?? null, series: String(ex.sets ?? ''), cantidad: String(ex.reps ?? ''), porLado: ex.porLado === true,
  }))
  return { dia, sinFicha, sinCantidad: sinCantidadFinal, porLado, lista }
}

/**
 * Lo que el editor hace antes de guardar: semanas y duración al día.
 * Menos en un microciclo: su `weekData` es UNA semana modelo que se repite y
 * `weeks` dice cuántas veces (Camp 4, Temporada 11 en el plan de Andrés).
 * Contarla la dejaría en "1 semana".
 */
export function normalizar(fases: any[]) {
  return fases.map((f) => (f.mode === 'microcycle' ? f : {
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
export async function guardarFases(quien: Quien, plan: Plan, fases: any[], titulo?: string, extra?: { ciencia?: Recuadro[] }) {
  // Todo lo demás de `plan.data` se conserva (la foto del plan, su ciencia): `data` se reescribe entero.
  const datos: Plan['data'] = { ...plan.data, kind: tipoDePlan(plan), phases: normalizar(fases) }
  if (extra && 'ciencia' in extra) {
    if (extra.ciencia?.length) datos.ciencia = extra.ciencia
    else delete datos.ciencia
  }
  const { data, error } = await quien.db
    .from('plans')
    .update({
      ...(titulo ? { title: titulo } : {}),
      data: datos,
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
