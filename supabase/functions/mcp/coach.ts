// deno-lint-ignore-file no-explicit-any
import type { McpServer } from 'npm:@modelcontextprotocol/sdk@1.30.1/server/mcp.js'
import { z } from 'npm:zod@^4.1.13'
import { APP_URL } from './config.ts'
import { llamarFuncion, type Quien } from './sesion.ts'
import {
  Aviso, buscarPersona, diaDesdeTexto, fechaDelAtleta, fechaLarga, mismoNombre, mismoTexto, NOMBRE_DIA, nombreCorto, nombreDe, palabrasDe,
  respuesta, rolDeOficio, seguro, sinAcentos, type Dia, type Persona,
  sinConfirmarBorrado, TEXTO_CONFIRMADO_BORRAR,
} from './util.ts'
import {
  buscarFase, buscarSemana, cambiarRecuadros, cienciaDeFase, cienciaDelPlan, conEquipo, cuantosRecuadros, describirDia, describirSemana, diaDesdeEntrada,
  elegirPrograma, equipoDe, faseNueva, recuadrosDeLaIA,
  fasesDe, firmasDeGrupos, guardarFases, idDeSesion, miProgramaCon, nombreDelDia, nombresDeEjercicios, planesActivos, programaQueEdito, planQueEdito,
  repertorioVisible, resumenDelPlan, semanaNueva, siguienteNumFase, siguienteNumSemana, tipoDePlan, normalizar, claveDeRegistro,
  type Miembro, type Plan, type Programa, type SesionEntrada,
} from './plan.ts'
import { anotarDia, equiposMasUsados, exigirRespuestas, nuevaRevision, preguntaDeDatos, type Revision } from './preguntas.ts'
import { cursorDe, estadoDe, registrosDe, ubicarDia, ubicarEnTodos } from './atleta.ts'
import { repertorioConFicha } from './comunes.ts'
import { cursorAlDia, defaultCursor, dondeVa, estaEnPausa, historialDePeso, isValidCursor, moverPlanA, pausarPlan, reanudarPlan } from './app/training-utils.js'
import { gruposConPropios } from './app/muscles.js'
import { desdeKilos } from './app/unidades.js'
import { CAT_COLORS, COLORES_TIPO } from './app/theme.js'
import { cargaCatalogo, sugiereIcono } from './app/iconosDeTipo.js'
import { claseDe } from './app/clases.js'

export const SOLO_LEER = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const
export const ESCRIBE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const
export const BORRA = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false } as const

/* ------------------------------------------------------------------ */
/* Esquemas que repiten varias herramientas                            */
/* ------------------------------------------------------------------ */

export const ATLETA = z.string().describe('El atleta: su usuario (@juan), su nombre o su id.')
export const SIN_FICHA_OK = z.array(z.string()).optional()
  .describe('Solo después de preguntar: nombres de ejercicios que la persona confirmó que van TAL CUAL, sin ficha del catálogo (o que ya vienen de un plan que existe). Sin esto, un ejercicio que no está en el catálogo con su nombre exacto no se guarda: la herramienta te dice qué preguntar.')
export const SIN_CANTIDAD_OK = z.array(z.string()).optional()
  .describe('Solo después de preguntar: nombres de ejercicios que la persona dijo que van SIN repeticiones ni tiempo. Sin esto, un ejercicio sin "cantidad" no se guarda: la herramienta te dice qué preguntar.')
export const ESTRUCTURA_OK = z.boolean().optional()
  .describe('true cuando la persona ya confirmó cómo armaste las biseries, triseries o circuitos (o ya los había pedido explícitamente). Sin esto, la primera vez la herramienta te devuelve la rutina armada para que se la enseñes y no guarda.')
export const FASE = z.coerce.string().optional()
  .describe('La fase: su número (1, 2…) o su nombre. En una rutina que se repite no hace falta.')

/* La «Ciencia» de un plan: el porqué de cómo está armado, en recuadros que el atleta lee en Home (ver `lib/ciencia.js`). */
const RECUADRO = z.object({
  titulo: z.string().describe('Título corto del recuadro (hasta 120 caracteres).'),
  texto: z.string().describe('El texto (hasta 8000 caracteres). Una línea en blanco separa párrafos; "- " al inicio de línea hace una viñeta; "## " un subtítulo; "nombre | valor | nota" una fila de tabla.'),
})
export const CIENCIA = z.array(RECUADRO).optional()
  .describe('Opcional: la «Ciencia» (el porqué del plan), en recuadros de título y texto. Solo si la persona la pidió o te la dio; no la inventes. Sin esto, el plan simplemente no lleva ciencia.')

/* El formato de un Set con reloj: lo que corre son los PASOS (una lista de tramos que se repite); el id
   solo le pone nombre. Ver `src/lib/formatos.js`. */
const FORMATO = z.object({
  id: z.string().optional().describe('amrap, emom, tabata, intervalos, fartlek, portiempo o custom (uno propio).'),
  nombre: z.string().optional().describe('Solo con id "custom": el nombre que ve el atleta (ej.: "Pirámide").'),
  pasos: z.array(z.object({
    tipo: z.enum(['trabajo', 'descanso']),
    seg: z.coerce.number().nullable().describe('Segundos del tramo. null = hasta que el atleta toque «Listo».'),
    etiqueta: z.string().optional().describe('Lo que ve el atleta en el reloj (ej.: "Fuerte", "Suave").'),
  })).describe('La lista de tramos que se repite. AMRAP 12 min: [{tipo:"trabajo",seg:720}]. EMOM: [{tipo:"trabajo",seg:60}]. Tabata: [{tipo:"trabajo",seg:20},{tipo:"descanso",seg:10}]. 8 × 400 m con 90 s: [{tipo:"trabajo",seg:null},{tipo:"descanso",seg:90}].'),
  vueltas: z.coerce.number().optional().describe('Cuántas veces se repite la lista de pasos. AMRAP: 1. EMOM de 10 min: 10. Tabata: 8.'),
  tope: z.coerce.number().nullable().optional().describe('Segundos tras los que se corta todo, aunque falte (opcional).'),
  turnan: z.boolean().optional().describe('true: en cada tramo de trabajo toca un ejercicio distinto del grupo, por turnos (circuitos, EMOM alternado).'),
  anota: z.enum(['rondas', 'tiempo', 'reps', 'km', 'm', 'cal', 'cumplido', 'nada']).optional().describe('Qué anota el atleta al terminar. AMRAP: rondas. EMOM: cumplido. Por tiempo: tiempo.'),
})

const EJERCICIO = z.object({
  nombre: z.string().optional().describe('Nombre del ejercicio. Si es del repertorio, escríbelo EXACTO para que se ligue a su ficha y su video.'),
  nota: z.string().optional().describe('En vez de un ejercicio, una nota o separador (ej.: "Calentamiento"). Sin nombre.'),
  series: z.union([z.number(), z.string()]).optional().describe('Series; si va en grupo, las vueltas del grupo. 3 si no se dice.'),
  cantidad: z.union([z.number(), z.string()]).optional().describe('Cuánto por serie: "8-10", 12, 30… La unidad va aparte. Si la persona no la dijo, NO la inventes ni la dejes vacía en silencio: pregúntala (la herramienta te la pide y no guarda sin ella).'),
  unidad: z.enum(['reps', 'seg', 'min', 'm', 'km', 'yd', 'cal', 'cluster']).optional().describe('reps si no se dice. "cluster" es para reps en bloques con una pausa corta entre ellos: la cantidad se escribe "2+2+2" y la pausa va en "entre_bloques".'),
  entre_bloques: z.string().optional().describe('Solo con unidad "cluster": los segundos de pausa entre los bloques, "15" o un rango "15-30". La pausa entre las series sigue siendo "descanso".'),
  intensidad: z.string().optional().describe('La carga, escrita EXACTO así para que el editor la reconozca. Fuerza: "75%" (porcentaje del 1RM; la app lo pasa a kilos), "20 kg". Esfuerzo: "85% intensidad" (porcentaje de esfuerzo SIN 1RM: nunca se pasa a kilos; úsalo cuando la persona dice "al 85% de intensidad" en cardio o en un ejercicio sin 1RM), "RPE 8", "RIR 2". Cardio: "4:34-5:00 min/km" (ritmo de carrera, un tiempo o un rango), "Zona 4" (zona de frecuencia cardiaca, 1 a 5), "250 W" (vatios), "1:45 /100 m" (ritmo de nado). Una carga sola por ejercicio; si la persona dio dos ("75% / RPE 8") se guarda como texto tal cual.'),
  descanso: z.string().optional().describe('SOLO el tiempo: "90 s", "2 min", "60-90 s". Nunca una frase como "30 segundos antes del siguiente ejercicio": el atleta solo tiene cuenta regresiva si es un tiempo.'),
  descanso_set: z.string().optional().describe('Lo que se descansa al TERMINAR el Set entero, antes de empezar el siguiente, SOLO el tiempo: "2 min", "90 s" (nunca una frase). Es distinto de "descanso", que es el de entre las series de este ejercicio. En un grupo (superserie, circuito) vale para todo el Set. No lo mandes si no hay descanso entre Sets. Si el día ya lo traía (ver_plan_de_atleta), mándalo igual o se pierde.'),
  notas: z.string().optional(),
  indicaciones: z.string().optional().describe('Claves técnicas para el atleta.'),
  lleva_peso: z.boolean().optional().describe('Si el atleta anota peso aquí. Si no se dice, la app lo deduce del nombre.'),
  grupo: z.coerce.number().optional().describe('Ejercicios SEGUIDOS con el mismo número van en superserie o circuito. Si la persona separó la lista en bloques (línea en blanco, viñetas, A1/A2, «+»), cada bloque de 2 o más ejercicios es una biserie, triserie o circuito: mismo número para todos los del bloque (1, 2, 3…); los que van solos, sin grupo. No lo preguntes: así lo escribió; la primera vez la herramienta te devuelve la rutina armada para que se la enseñes.'),
  por_lado: z.boolean().optional().describe('true si la cantidad es por cada lado (cada pierna, cada brazo): la app lo enseña como "10 reps por lado". false si es en total. En un ejercicio a una pierna o un brazo (pistol squat, step ups, búlgara, zancadas, remo a una mano) la persona tiene que decirlo: si no lo dijo, la herramienta te lo pide y no guarda.'),
  por_vuelta: z.array(z.object({
    cantidad: z.union([z.number(), z.string()]).optional().describe('Cuánto en ESA vuelta: 10, "8-10"… En la misma unidad del ejercicio.'),
    intensidad: z.string().optional().describe('La carga de ESA vuelta, con las mismas formas que "intensidad": "60%", "85% intensidad", "RPE 8", "RIR 2", "20 kg", "Zona 3"…'),
  })).optional().describe('Solo si las reps o la carga CAMBIAN de una vuelta a otra (pirámides, series de aproximación): una entrada por cada vez que se repite ("series"), en orden. Si todas las vueltas son iguales, no lo mandes. Si el día ya lo traía (ver_plan_de_atleta), mándalo igual o se pierde. No se combina con "formato".'),
  lapsos: z.array(z.object({
    cantidad: z.union([z.number(), z.string()]).optional().describe('Cuánto en ESE lapso: 800, "8-10", 2… Si la persona no lo dijo, pregúntalo.'),
    unidad: z.enum(['reps', 'seg', 'min', 'm', 'km', 'yd', 'cal']).optional().describe('La unidad de ESE lapso (puede cambiar de uno a otro: 1 km, luego 500 m, luego 4 min). Si falta, la del ejercicio.'),
    intensidad: z.string().optional().describe('La carga de ESE lapso, con las mismas formas que "intensidad": "4:34-5:00 min/km", "Zona 4", "85% intensidad", "250 W", "20 kg"…'),
    descanso: z.string().optional().describe('Lo que descansa al terminar ESE lapso, SOLO el tiempo: "1 min", "90 s" (nunca una frase). Sin descanso, no lo mandes.'),
  })).optional().describe('Un ejercicio con VARIOS TRAMOS SEGUIDOS, cada uno con su cantidad, su carga y su descanso: correr 800 m a 4:34-5:00 y luego 2 min a 6:39-7:00; remar 500 m y luego 1 min suave. Es UN ejercicio con varios lapsos, NO varios ejercicios repetidos ni un "formato". En un grupo (superserie o circuito), si UN ejercicio trae lapsos, el Set entero se arma en lapsos y los demás quedan con uno solo. Las "series" dicen cuántas veces se repite el Set. No se combina con "por_vuelta" ni con "formato". Si el día ya los traía (ver_plan_de_atleta), mándalos igual o se pierden.'),
  formato: FORMATO.optional().describe('Formato con reloj de ESTE grupo (o del ejercicio si va solo): AMRAP, EMOM, Tabata, intervalos, fartlek… Basta ponerlo en UN ejercicio del grupo y vale para todos. Sustituye a "series". Si el día ya lo traía (ver_plan_de_atleta), mándalo igual o se pierde.'),
})

export const SESION = {
  nombre: z.string().optional().describe('Nombre de la sesión, ej.: "Tren inferior — fuerza".'),
  tipo: z.string().optional().describe('gym, neural, recovery, cancha, tests, equipo, correr, bici, natación, yoga, movilidad, terapia, clase, off (descanso), o uno propio.'),
  ejercicios: z.array(EJERCICIO).optional(),
  quitar_clase: z.boolean().optional().describe('Solo en editar_dia, y solo si la sesión traía una clase en video (clase_en_video al leer el día) y la persona pidió quitarla. Si no lo mandas, la clase se queda.'),
}
export const SESION_CON_DIA = z.object({ dia: z.string().describe('lunes … domingo'), ...SESION })

export const FASES = z.array(z.object({
  nombre: z.string(),
  subtitulo: z.string().optional(),
  enfoque: z.string().optional().describe('El enfoque en una línea.'),
  objetivo: z.string().optional(),
  color: z.string().optional().describe('Color en hex, ej. #3DD9A0.'),
  ciencia: CIENCIA,
  semanas: z.array(z.object({
    nombre: z.string().optional(),
    carga: z.string().optional().describe('Ej.: "4×10 al 65% · RIR 3".'),
    sesiones: z.array(SESION_CON_DIA),
  })).min(1),
})).optional().describe('Solo para "fases".')

/* ------------------------------------------------------------------ */
/* Ayudas                                                              */
/* ------------------------------------------------------------------ */

/**
 * El plan de un atleta que ESTA persona cambia: el suyo (ver `planQueEdito`).
 * `programa` viene solo si es el de un profesional del equipo: así el master,
 * que puede elegir con `de`, ve en la respuesta cuál cambió.
 */
export async function planDe(quien: Quien, ref: string, de?: string | null): Promise<{ persona: Persona; plan: Plan; programa: { programa?: string } }> {
  const persona = await buscarPersona(quien, ref)
  const r = await planQueEdito(quien, persona, de)
  if (!r.plan) {
    // La frase fija se traduce; el nombre y el profesional, no.
    const de_quien = r.profesionalId === null ? '' : r.profesionalId === quien.id ? ' tuyo' : ` de ${r.de}`
    throw new Aviso(`${nombreDe(persona)} ${palabrasDe(quien)('todavía no tiene plan')}${de_quien}. Puedes crearle uno con crear_plan.`)
  }
  return { persona, plan: r.plan, programa: r.profesionalId ? { programa: r.de } : {} }
}

/** Los programas de un atleta que esta persona ve y su estado. Con `de`, solo el de ese profesional. */
async function programasDeAtleta(quien: Quien, persona: Persona, de?: string | null) {
  const miembros = await equipoDe(quien, persona.id)
  const [programas, estado] = await Promise.all([planesActivos(quien, persona.id, miembros), estadoDe(quien, persona.id)])
  const elegidos = de && String(de).trim() ? [elegirPrograma(programas, de)] : programas
  /* Cada cosa dice de quién es si hay más de un programa, o si el que se ve no es
     el de esta persona (un fisio que lee el plan del coach de su paciente). */
  const rotular = conEquipo(programas) || programas.some((x) => x.profesionalId !== miProgramaCon(quien, persona))
  return { miembros, programas, elegidos, estado, rotular }
}

/**
 * Para leer el DETALLE de un plan (no el resumen): el de esta persona, o el que
 * diga `de`. Sin nada y con varios, se pregunta: un detalle mezclado de dos
 * programas no le sirve a nadie.
 */
function programaParaLeer(quien: Quien, persona: Persona, programas: Programa[], de?: string | null): Programa {
  if (de && String(de).trim()) return elegirPrograma(programas, de)
  const propio = programas.find((x) => x.profesionalId === miProgramaCon(quien, persona))
  if (propio) return propio
  if (programas.length === 1) return programas[0]
  throw new Aviso(`${nombreDe(persona)} tiene programas de ${programas.map((x) => x.de).join(' y ')}: di de cuál (argumento "de").`)
}

/** Programas sin plan ni profesional, para leer los registros de quien aún no tiene ninguno. */
const SIN_PROGRAMA = { plan: null, profesionalId: null, de: '', rol: 'coach', nombre: '', usuario: '', esPrincipal: true, altaEn: null } as unknown as Programa

/** Arma los días de una semana a partir de sesiones con su día; lo que falta preguntar queda anotado en `rev`. */
export function diasDesde(sesiones: any[], repertorio: any[], rev: Revision, donde = '') {
  return (sesiones ?? []).map((s) => {
    const clave = diaDesdeTexto(s.dia)
    const armado = diaDesdeEntrada(clave, s as SesionEntrada, repertorio)
    anotarDia(rev, `${donde}${NOMBRE_DIA[clave]}${s.nombre ? ` · ${s.nombre}` : ''}`, armado)
    return armado.dia
  })
}

/** De qué día del plan es una llave de registro ("f1-w2-d0", "wk-2026-W39-d3"). */
function diaDeLlave(plan: Plan | null, llave: string) {
  const fases = fasesDe(plan)
  const semanal = /^wk-(\d{4}-W\d{2})-d(\d+)$/.exec(llave)
  if (semanal) {
    const dia = fases[0]?.weekData?.[0]?.days?.[Number(semanal[2])]
    return dia ? { semana_del_calendario: semanal[1], dia: dia.day, sesion: nombreDelDia(dia) } : { llave }
  }
  const m = /^(.+)-w(\d+)-d(\d+)$/.exec(llave)
  if (!m) return { llave }
  const fase = fases.find((f) => f.id === m[1])
  const semana = fase?.weekData?.find((w: any) => w.num === Number(m[2]))
  const dia = semana?.days?.[Number(m[3])]
  return dia ? { fase: fase.name, semana: semana.num, dia: dia.day, sesion: nombreDelDia(dia) } : { llave }
}

const avisoSinFicha = (sinFicha: Set<string>) => (sinFicha.size
  ? { sin_ficha: [...sinFicha], nota_sin_ficha: 'Estos ejercicios se guardaron tal cual, sin ficha ni video, como la persona confirmó.' }
  : {})

/** Lo que se guardó sin ficha o sin cantidad porque la persona lo confirmó: se le dice. */
export const avisosDeRespuestas = (r: { sinFicha: string[]; sinCantidad: string[] }) => ({
  ...avisoSinFicha(new Set(r.sinFicha)),
  ...(r.sinCantidad.length ? { sin_cantidad: r.sinCantidad, nota_sin_cantidad: 'Estos ejercicios se guardaron sin repeticiones ni tiempo, como la persona dijo.' } : {}),
})

/** Para LEER: solo el programa de un profesional del equipo del atleta. */
const DE_LEER = z.string().optional()
  .describe('Si el atleta tiene un equipo (su coach y otros profesionales, como un fisio), cada uno con su programa: de cuál, con su nombre, "coach" o "fisio". Sin esto, todos juntos.')

/**
 * Arma las fases que manda la IA: "rutina" (una semana que se repite) o "fases" (cada una con sus semanas). Lo que falta preguntar queda anotado en `rev`.
 * Lo usan `crear_plan` (el plan de un atleta) y `guardar_en_mis_planes` (lo que se guarda sin atleta).
 */
export function armarFasesDeLaIA(
  entrada: { tipo: 'rutina' | 'fases'; sesiones?: any[]; fases?: any[]; ciencia?: any[] },
  repertorio: any[],
  rev: Revision,
) {
  // La ciencia se valida ANTES de armar nada: un recuadro vacío o demasiado largo es un aviso para la IA.
  const cienciaNueva = recuadrosDeLaIA(entrada.ciencia, 'todo el plan')
  let nuevas: any[]
  if (entrada.tipo === 'rutina') {
    if (!entrada.sesiones?.length) throw new Aviso('Para una rutina manda "sesiones", cada una con su día.')
    const base = faseNueva(1, { nombre: 'Rutina semanal' })
    base.weekData = [{ ...semanaNueva(1), days: diasDesde(entrada.sesiones, repertorio, rev) }]
    nuevas = [base]
  } else {
    if (!entrada.fases?.length) throw new Aviso('Para un programa por fases manda "fases", cada una con sus semanas.')
    nuevas = entrada.fases.map((f: any, i: number) => {
      const fase: any = faseNueva(i + 1, f)
      fase.weekData = f.semanas.map((w: any, j: number) => ({ ...semanaNueva(j + 1, w), days: diasDesde(w.sesiones, repertorio, rev, `${f.nombre} · semana ${j + 1} · `) }))
      const deLaFase = recuadrosDeLaIA(f.ciencia, `la fase ${f.nombre}`)
      if (deLaFase.length) fase.ciencia = deLaFase
      return fase
    })
  }
  return { nuevas, cienciaNueva }
}

export function herramientasDelCoach(server: McpServer, quien: Quien) {
  const esMaster = quien.rol === 'master'
  const p = palabrasDe(quien)
  /* Para ESCRIBIR, cada quien cambia solo SU programa. El master es el único que
     elige (con `de`); para los demás el argumento ni existe, así no hay a quién
     pedirle "cambia el de mi fisio". */
  const PARAM_DE = esMaster
    ? { de: z.string().optional().describe('De qué profesional es el programa que se cambia: su nombre, "coach" o "fisio". Sin esto, el del coach principal.') }
    : {}

  /* ================================================================ */
  /* LEER                                                               */
  /* ================================================================ */

  server.registerTool('listar_atletas', {
    title: 'Listar mis atletas',
    description: esMaster
      ? 'Todos los atletas de Training Lab, con su coach (y su equipo, si tiene), su plan, en qué va cada uno, cuándo abrió la app por última vez y cuántas sesiones hizo en los últimos 7 días. Marca los que aún no activan su cuenta.'
      : 'Tus atletas —los que atiendes como coach principal y los que te sumaron a su equipo—, con SU plan (el tuyo), en qué va cada uno, con quién más va (coach, fisio…), cuándo abrió la app por última vez y cuántas sesiones hizo en los últimos 7 días. Marca los que aún no activan su cuenta, los que ya diste de alta y las invitaciones a un equipo que esperan respuesta.',
    inputSchema: { incluir_desactivados: z.boolean().optional().describe('También los desactivados. No, si no se dice.') },
    annotations: SOLO_LEER,
  }, seguro(async ({ incluir_desactivados }: any) => {
    const db = quien.db
    const [perfiles, planes, estados, invitaciones, coaches, equipos, misFilas] = await Promise.all([
      db.from('profiles').select('id, username, full_name, coach_id, is_active, created_at, alta_en').eq('role', 'user').order('full_name'),
      db.from('plans').select('user_id, title, data, profesional_id').eq('status', 'active'),
      db.from('user_app_state').select('user_id, updated_at, data'),
      db.from('invitaciones').select('atleta_id').is('usada_en', null).not('atleta_id', 'is', null),
      esMaster ? db.from('profiles').select('id, username, full_name').eq('role', 'admin') : Promise.resolve({ data: [] }),
      db.rpc('equipos_de_mis_atletas'),
      db.from('equipo').select('atleta_id, estado, alta_en, nombre_atleta').eq('profesional_id', quien.id),
    ])
    if (perfiles.error) throw new Error(perfiles.error.message)
    if (equipos.error) throw new Error(equipos.error.message)
    // Un atleta puede tener un plan por profesional: cada quien ve el SUYO (el del principal, si es su coach o es el master).
    const planDeId = new Map((planes.data ?? []).map((pl: any) => [`${pl.user_id}|${pl.profesional_id ?? ''}`, pl]))
    const estadoDeId = new Map((estados.data ?? []).map((s: any) => [s.user_id, s]))
    const pendientes = new Set((invitaciones.data ?? []).map((i: any) => i.atleta_id))
    const coachDeId = new Map((coaches.data ?? []).map((c: any) => [c.id, c.full_name || c.username]))
    const hoy = fechaDelAtleta()
    const hace7 = Date.now() - 7 * 86400000
    const filasDe = (id: string) => (equipos.data ?? []).filter((e: any) => e.atleta_id === id)
    const miFilaDe = (id: string) => (misFilas.data ?? []).find((e: any) => e.atleta_id === id && e.estado === 'activo')

    const atletas = (perfiles.data ?? [])
      .filter((a: any) => incluir_desactivados || a.is_active)
      .map((a: any) => {
        const miPrograma = miProgramaCon(quien, a)
        const plan = planDeId.get(`${a.id}|${miPrograma ?? ''}`) as Plan | undefined
        const estado = (estadoDeId.get(a.id) as any)?.data ?? {}
        let vaEn = null
        if (plan) {
          const aqui = dondeVa(fasesDe(plan), tipoDePlan(plan), estado[claveDeRegistro('wr:cursor', miPrograma)], hoy.date)
          const fase = fasesDe(plan).find((f) => f.id === aqui?.faseId)
          vaEn = aqui ? `${fase?.name ?? ''} · semana ${aqui.semana}` : null
        }
        const hechas7 = Object.values(estado[claveDeRegistro('wr:sessions', miPrograma)] ?? {})
          .filter((s: any) => s?.completed && s.completedAt && Date.parse(s.completedAt) >= hace7).length
        // Con quién más va: «fisio · Juan», «coach · Beto» (y si aún no acepta, se dice).
        const con = filasDe(a.id).map((e: any) =>
          `${rolDeOficio(e.otro_oficio)} · ${nombreCorto(e.otro_nombre) || e.otro_usuario}${e.estado === 'pendiente' ? ' (invitado; aún no acepta)' : ''}`)
        const alta = miPrograma === null ? a.alta_en : miFilaDe(a.id)?.alta_en
        return {
          nombre: a.full_name || a.username,
          usuario: a.username,
          estado: !a.is_active ? 'desactivado' : pendientes.has(a.id) ? 'aún no activa su cuenta' : 'activo',
          ...(alta ? { dado_de_alta_el: fechaLarga(alta) } : {}),
          ...(esMaster ? { coach: coachDeId.get(a.coach_id) ?? 'sin coach' } : {}),
          ...(con.length ? { va_tambien_con: con } : {}),
          plan: plan ? plan.title : null,
          ...(vaEn ? { va_en: vaEn } : {}),
          ultima_vez_en_la_app: (estadoDeId.get(a.id) as any)?.updated_at ?? null,
          sesiones_ultimos_7_dias: hechas7,
        }
      })
    // Los que aún no aceptan no se ven (no hay permiso todavía): solo el aviso de que se les invitó.
    const suyos = new Map((perfiles.data ?? []).filter((a: any) => a.coach_id === quien.id).map((a: any) => [a.id, a.full_name || a.username]))
    const esperando = [
      ...(misFilas.data ?? []).filter((e: any) => e.estado === 'pendiente')
        .map((e: any) => `${e.nombre_atleta || 'Alguien'}: te invitó a su equipo; espera a que acepte.`),
      // Solo las que hizo ÉL como coach principal (no las de otro coach en un equipo compartido).
      ...(equipos.data ?? []).filter((e: any) => e.estado === 'pendiente' && suyos.has(e.atleta_id))
        .map((e: any) => `Invitaste a ${e.otro_nombre || e.otro_usuario} al equipo de ${suyos.get(e.atleta_id)}; espera a que acepte.`),
    ]
    return respuesta({ total: atletas.length, atletas, ...(esperando.length ? { esperando_que_acepten: esperando } : {}) })
  }))

  server.registerTool('ver_atleta', {
    title: 'Ver un atleta',
    description: 'Todo de un atleta: su plan y en qué va, la sesión de HOY completa (ejercicio por ejercicio, con lo que ya anotó), sus últimas sesiones hechas con lo que anotó, su bienestar de los últimos días, sus 1RM y, si aún no activa su cuenta, su link de invitación. Si el atleta tiene un equipo (su coach y otros profesionales, como un fisio), da los programas de todos juntos, cada uno con de quién es, y quién está en su equipo; con "de", solo el de uno. Nunca trae notas de consulta.',
    inputSchema: { atleta: ATLETA, de: DE_LEER },
    annotations: SOLO_LEER,
  }, seguro(async ({ atleta, de }: any) => {
    const persona = await buscarPersona(quien, atleta)
    const [{ miembros, elegidos, estado, rotular }, invitacion] = await Promise.all([
      programasDeAtleta(quien, persona, de),
      quien.db.from('invitaciones').select('token').eq('atleta_id', persona.id).is('usada_en', null).maybeSingle(),
    ])
    const hoy = fechaDelAtleta()
    const ultimasDe = (pr: Programa) => Object.entries(registrosDe(estado, pr))
      .filter(([, s]: any) => s?.completed)
      .sort(([, a]: any, [, b]: any) => String(b.completedAt ?? '').localeCompare(String(a.completedAt ?? '')))
      .slice(0, 5)
      .map(([llave, s]: any) => ({ ...diaDeLlave(pr.plan, llave), hecha_el: s.completedAt ?? null, ...(s.notes ? { notas: s.notes } : {}) }))
    const resumenDe = (pr: Programa) => (pr.plan ? resumenDelPlan(pr.plan, cursorDe(estado, pr), hoy.date) : null)
    /* La sesión de HOY completa (la misma cuenta que ver_dia_de_atleta sin argumentos), para no tener que
       pedirla aparte: ejercicio por ejercicio y con lo que ya anotó. Sin sesión hoy, lo dice. */
    const hoyDe = (pr: Programa) => {
      if (!pr.plan) return null
      try {
        const u = ubicarDia(pr.plan, cursorDe(estado, pr), {})
        if (!u.entradas.length) return { dia: NOMBRE_DIA[u.dia], mensaje: 'Hoy no le toca sesión.' }
        const registros = registrosDe(estado, pr)
        return u.entradas.map((i) => describirDia(u.fase, u.semana, i, registros[idDeSesion(pr.plan, u.fase, u.semana, i, u.fecha.date)]))
      } catch (e) {
        if (e instanceof Aviso) return null
        throw e
      }
    }
    const base = {
      nombre: nombreDe(persona),
      usuario: persona.username,
      cuenta: !persona.is_active ? 'desactivada' : invitacion.data ? 'aún no la activa' : 'activa',
      ...(invitacion.data ? { link_de_invitacion: `${APP_URL}/?invitacion=${encodeURIComponent(invitacion.data.token)}` } : {}),
      unidad_de_peso: persona.unidad_peso === 'lb' ? 'lb' : 'kg',
    }
    const compartido = {
      bienestar_reciente: Object.entries(estado['wr:wellness'] ?? {}).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 7)
        .map(([fecha, v]: any) => ({ fecha, ...v })),
      un_rm_kg: estado['wr:onerm'] ?? {},
    }
    if (!rotular && elegidos.length <= 1) {
      // Sin equipo, exactamente como siempre.
      const pr = elegidos[0] ?? SIN_PROGRAMA
      return respuesta({ ...base, plan: resumenDe(pr), hoy: hoyDe(pr), ultimas_sesiones_hechas: ultimasDe(pr), ...compartido })
    }
    return respuesta({
      ...base,
      equipo: miembros.map((m: Miembro) => ({
        nombre: m.nombre,
        rol: m.rol,
        ...(m.esPrincipal ? { es: 'coach principal' } : {}),
        ...(m.estado === 'pendiente' ? { estado: 'invitado; aún no acepta' } : {}),
        ...(m.altaEn ? { dado_de_alta_el: fechaLarga(m.altaEn) } : {}),
      })),
      programas: elegidos.map((pr) => ({
        de: pr.de,
        ...(pr.altaEn ? { dado_de_alta_el: fechaLarga(pr.altaEn) } : {}),
        plan: resumenDe(pr),
        hoy: hoyDe(pr),
        ultimas_sesiones_hechas: ultimasDe(pr),
      })),
      ...compartido,
    })
  }))

  server.registerTool('ver_plan_de_atleta', {
    title: 'Ver el plan de un atleta',
    description: 'El plan de un atleta. Sin fase: el resumen (fases, semanas, qué sesión hay cada día y dónde va). Con fase y semana: el detalle completo de esa semana, ejercicio por ejercicio, listo para editarlo. Úsala SIEMPRE antes de cambiar un plan. Si el atleta tiene un equipo (su coach y otros profesionales, como un fisio), el resumen trae el programa de cada uno, con de quién es; el detalle es de UN programa: el tuyo, o el que pidas con "de".',
    inputSchema: {
      atleta: ATLETA,
      fase: FASE,
      semana: z.coerce.number().optional().describe('Número de semana. Si hay fase y no semana, la primera.'),
      de: DE_LEER,
    },
    annotations: SOLO_LEER,
  }, seguro(async ({ atleta, fase, semana, de }: any) => {
    const persona = await buscarPersona(quien, atleta)
    const { programas, elegidos, estado, rotular } = await programasDeAtleta(quien, persona, de)
    if (!programas.length) throw new Aviso(`${nombreDe(persona)} ${p('todavía no tiene plan')}. Puedes crearle uno con crear_plan.`)
    const hoy = fechaDelAtleta()
    const resumenCompleto = (pr: Programa) => ({
      ...(rotular ? { de: pr.de } : {}),
      ...resumenDelPlan(pr.plan, cursorDe(estado, pr), hoy.date),
      semanas_por_fase: fasesDe(pr.plan).map((f) => ({
        fase: f.name,
        semanas: (f.weekData ?? []).map((w: any) => ({
          semana: w.num,
          ...(w.label ? { nombre: w.label } : {}),
          ...(w.load ? { carga: w.load } : {}),
          dias: describirSemana(w).map((d: any) => `${d.dia} ${d.sesion}`),
        })),
      })),
    })
    if (fase == null && semana == null && (elegidos.length > 1 || tipoDePlan(elegidos[0].plan) !== 'weekly')) {
      if (elegidos.length === 1) return respuesta({ atleta: nombreDe(persona), ...resumenCompleto(elegidos[0]) })
      return respuesta({ atleta: nombreDe(persona), programas: elegidos.map(resumenCompleto) })
    }
    // El detalle es de UN programa.
    const pr = programaParaLeer(quien, persona, programas, de)
    const fases = fasesDe(pr.plan)
    const fIdx = buscarFase(pr.plan, fase)
    const f = fases[fIdx]
    const sIdx = semana != null ? buscarSemana(f, semana) : 0
    const w = f.weekData[sIdx]
    return respuesta({
      atleta: nombreDe(persona),
      ...(rotular ? { de: pr.de } : {}),
      plan: pr.plan.title,
      fase: { n: fIdx + 1, nombre: f.name, subtitulo: f.fullName || undefined, enfoque: f.focus || undefined, objetivo: f.objective || undefined, color: f.color },
      semana: { num: w.num, nombre: w.label || undefined, carga: w.load || undefined },
      semanas_de_la_fase: f.weekData.map((x: any) => x.num),
      dias: (w.days ?? []).map((_: any, i: number) => describirDia(f, w, i)),
    })
  }))

  server.registerTool('ver_ciencia_del_plan', {
    title: 'Ver la ciencia de un plan',
    description: 'La «Ciencia» de un plan, con el texto completo de cada recuadro: el porqué de cómo está armado, que el atleta lee en Home. Salen los recuadros de TODO el plan y los de cada fase. Úsala antes de cambiarla con editar_ciencia. Si el plan no tiene, lo dice.',
    inputSchema: { atleta: ATLETA, de: DE_LEER },
    annotations: SOLO_LEER,
  }, seguro(async ({ atleta, de }: any) => {
    const persona = await buscarPersona(quien, atleta)
    const { programas, elegidos, rotular } = await programasDeAtleta(quien, persona, de)
    if (!programas.length) throw new Aviso(`${nombreDe(persona)} ${p('todavía no tiene plan')}. Puedes crearle uno con crear_plan.`)
    const completo = (pr: Programa) => ({
      ...(rotular ? { de: pr.de } : {}),
      plan: pr.plan.title,
      ...(cuantosRecuadros(pr.plan) ? {} : { ciencia: 'Este plan no tiene ciencia.' }),
      del_plan: cienciaDelPlan(pr.plan).map(({ titulo, texto }) => ({ titulo, texto })),
      por_fase: fasesDe(pr.plan)
        .map((f) => ({ fase: f.name, recuadros: cienciaDeFase(f).map(({ titulo, texto }) => ({ titulo, texto })) }))
        .filter((x) => x.recuadros.length),
    })
    if (elegidos.length === 1) return respuesta({ atleta: nombreDe(persona), ...completo(elegidos[0]) })
    return respuesta({ atleta: nombreDe(persona), programas: elegidos.map(completo) })
  }))

  server.registerTool('ver_dia_de_atleta', {
    title: 'Ver el día de un atleta',
    description: 'La sesión de un atleta en un día, con lo que anotó (pesos y lo que hizo) y si la marcó como hecha. Sin fecha ni día, la de HOY con la misma cuenta que su app. Si el atleta tiene un equipo (su coach y otros profesionales, como un fisio), trae las sesiones de todos, cada una con de quién es; con "de", solo las de uno.',
    inputSchema: {
      atleta: ATLETA,
      fecha: z.string().optional().describe('AAAA-MM-DD'),
      fase: FASE,
      semana: z.coerce.number().optional(),
      dia: z.string().optional().describe('lunes … domingo'),
      de: DE_LEER,
    },
    annotations: SOLO_LEER,
  }, seguro(async ({ atleta, de, ...args }: any) => {
    const persona = await buscarPersona(quien, atleta)
    const { programas, elegidos, estado, rotular } = await programasDeAtleta(quien, persona, de)
    if (!programas.length) throw new Aviso(`${nombreDe(persona)} ${p('todavía no tiene plan')}. Puedes crearle uno con crear_plan.`)
    const ubicados = ubicarEnTodos(elegidos, estado, args)
    const conSesion = ubicados.filter((x) => x.u.entradas.length)
    const { u: primero } = ubicados[0]
    if (!conSesion.length) {
      return respuesta({ atleta: nombreDe(persona), fecha: primero.fecha.texto, mensaje: `Ese día (${NOMBRE_DIA[primero.dia]}) no tiene sesión.` })
    }
    return respuesta({
      atleta: nombreDe(persona),
      fecha: primero.fecha.texto,
      sesiones: conSesion.flatMap(({ pr, u, registros }) => u.entradas.map((i) => {
        const d = describirDia(u.fase, u.semana, i, registros[idDeSesion(pr.plan, u.fase, u.semana, i, u.fecha.date)])
        return rotular ? { de: pr.de, ...d } : d
      })),
    })
  }))

  server.registerTool('ver_registros_de_atleta', {
    title: 'Ver los registros de un atleta',
    description: 'Lo que un atleta ha anotado. Con "ejercicio": todos sus pesos en ese ejercicio, en orden, para ver su progreso. Sin "ejercicio": sus últimas sesiones hechas con lo anotado en cada ejercicio. Si el atleta tiene un equipo (su coach y otros profesionales, como un fisio), junta lo de todos los programas, con de quién es cada cosa; con "de", solo un programa.',
    inputSchema: {
      atleta: ATLETA,
      ejercicio: z.string().optional().describe('Nombre del ejercicio tal como está en su plan.'),
      ultimas: z.coerce.number().min(1).max(40).optional().describe('Cuántas sesiones. 10 si no se dice.'),
      de: DE_LEER,
    },
    annotations: SOLO_LEER,
  }, seguro(async ({ atleta, ejercicio, ultimas, de }: any) => {
    const persona = await buscarPersona(quien, atleta)
    const { elegidos, estado, rotular } = await programasDeAtleta(quien, persona, de)
    // Quien aún no tiene plan puede tener registros: se leen en las claves de siempre.
    const lista = elegidos.length ? elegidos : [SIN_PROGRAMA]
    const u = quien.unidad
    const rotula = (pr: Programa) => (rotular ? { de: pr.de } : {})
    if (ejercicio) {
      const encontrados = lista
        .map((pr) => ({ pr, hist: historialDePeso(fasesDe(pr.plan), registrosDe(estado, pr), ejercicio, tipoDePlan(pr.plan)) as any[] }))
        .filter((x) => x.hist.length)
      if (!encontrados.length) throw new Aviso(`${nombreDe(persona)} no tiene pesos anotados en "${ejercicio}".`)
      const detalle = ({ pr, hist }: (typeof encontrados)[number]) => ({
        ...rotula(pr),
        registros: hist.map((h: any) => ({ peso: desdeKilos(h.kilos, u), cuando: h.cuando, donde: h.donde })),
      })
      if (encontrados.length === 1) return respuesta({ atleta: nombreDe(persona), ejercicio, unidad: u, ...detalle(encontrados[0]) })
      return respuesta({ atleta: nombreDe(persona), ejercicio, unidad: u, por_programa: encontrados.map(detalle) })
    }
    const sesiones = lista
      .flatMap((pr) => Object.entries(registrosDe(estado, pr)).map(([llave, s]: any) => ({ pr, llave, s })))
      .filter(({ s }) => s?.completed || Object.keys(s?.exercises ?? {}).length)
      .sort((a, b) => String(b.s.completedAt ?? '').localeCompare(String(a.s.completedAt ?? '')))
      .slice(0, ultimas ?? 10)
      .map(({ pr, llave, s }) => {
        const plan = pr.plan
        const donde = diaDeLlave(plan, llave) as any
        const dia = (() => {
          const m = /^(.+)-w(\d+)-d(\d+)$/.exec(llave) ?? /^wk-.+-d(\d+)$/.exec(llave)
          if (!m || !plan) return null
          const fases = fasesDe(plan)
          if (llave.startsWith('wk-')) return { semana: fases[0]?.weekData?.[0], idx: Number(m[1]) }
          const f = fases.find((x) => x.id === m[1])
          return { semana: f?.weekData?.find((w: any) => w.num === Number(m[2])), idx: Number(m[3]) }
        })()
        const nombres: Record<string, string> = {}
        if (dia?.semana?.days?.[dia.idx]) {
          const d = dia.semana.days[dia.idx]
          ;(d.exercises ?? []).forEach((e: any, i: number) => { nombres[`${i}`] = e.name })
        }
        return {
          ...rotula(pr),
          ...donde,
          hecha: !!s.completed,
          ...(s.completedAt ? { hecha_el: s.completedAt } : {}),
          anotado: Object.entries(s.exercises ?? {}).map(([k, v]: any) => ({
            ejercicio: nombres[k] ?? `#${k}`,
            ...(v.weight ? { peso: `${desdeKilos(Number(v.weight), u)} ${u}` } : {}),
            ...(v.repsHechas ? { hecho: v.repsHechas } : {}),
          })),
          ...(s.notes ? { notas: s.notes } : {}),
        }
      })
    return respuesta({ atleta: nombreDe(persona), sesiones })
  }))

  server.registerTool('ver_catalogos', {
    title: 'Ver categorías, tipos de sesión y plantillas',
    description: 'Tus catálogos: las categorías de ejercicio, los grupos musculares, el equipo que más se usa, tus tipos de sesión propios y tus plantillas de día y de semana.',
    inputSchema: {},
    annotations: SOLO_LEER,
  }, seguro(async () => {
    const { data: masterId } = await quien.db.rpc('master_id')
    const [cats, tipos, plantillas, grupos, repertorio, estadoCoach] = await Promise.all([
      quien.db.from('exercise_categories').select('id, name, created_by').order('sort_order'),
      quien.db.from('session_types').select('nombre, color').eq('coach_id', quien.id).order('nombre'),
      quien.db.from('routine_templates').select('id, name, kind, updated_at').eq('created_by', quien.id).order('updated_at', { ascending: false }),
      gruposMusculares(),
      repertorioVisible(quien),
      estadoDe(quien, quien.id),
    ])
    // Quien ve las categorías de todos (el dueño) necesita saber de quién es cada una (p80).
    const ajenas = [...new Set((cats.data ?? []).map((c: any) => c.created_by).filter((id: string | null) => id && id !== quien.id && id !== masterId))] as string[]
    const nombresDe = new Map<string, string>()
    if (esMaster && ajenas.length) {
      const { data: perfiles } = await quien.db.from('profiles').select('id, full_name, username').in('id', ajenas)
      for (const x of perfiles ?? []) nombresDe.set(x.id, x.full_name || x.username)
    }
    return respuesta({
      categorias: (cats.data ?? [])
        .filter((c: any) => esMaster || !c.created_by || c.created_by === masterId || c.created_by === quien.id)
        .map((c: any) => ({ nombre: c.name, propia: c.created_by === quien.id, ...(esMaster && nombresDe.has(c.created_by) ? { de: nombresDe.get(c.created_by) } : {}) })),
      grupos_musculares: grupos,
      equipos_mas_usados: equiposMasUsados(repertorio),
      tipos_de_sesion_propios: tipos.data ?? [],
      // Los que el coach quitó en la app (`ui:tipos-quitados`) ya no se ofrecen; «OFF» no se quita nunca (p81).
      tipos_de_sesion_de_la_app: Object.entries(CAT_COLORS as Record<string, { label: string }>)
        .filter(([slug]) => slug === 'off' || !(Array.isArray(estadoCoach['ui:tipos-quitados']) ? estadoCoach['ui:tipos-quitados'] : []).includes(slug))
        .map(([, v]) => v.label),
      plantillas: (plantillas.data ?? []).map((p: any) => ({ id: p.id, nombre: p.name, tipo: p.kind === 'week' ? 'semana' : 'dia' })),
    })
  }))

  server.registerTool('ver_invitaciones_pendientes', {
    title: 'Ver invitaciones pendientes',
    description: 'Los atletas que agregaste y todavía no activan su cuenta, con su link de invitación para volver a mandárselo.',
    inputSchema: {},
    annotations: SOLO_LEER,
  }, seguro(async () => {
    const { data, error } = await quien.db
      .from('invitaciones').select('token, atleta_id, creada_en, nombre, apellido')
      .is('usada_en', null).not('atleta_id', 'is', null).order('creada_en', { ascending: false })
    if (error) throw new Error(error.message)
    return respuesta({
      pendientes: (data ?? []).map((i: any) => ({
        nombre: [i.nombre, i.apellido].filter(Boolean).join(' '),
        creada_el: i.creada_en,
        link: `${APP_URL}/?invitacion=${encodeURIComponent(i.token)}`,
      })),
    })
  }))

  server.registerTool('ver_historial_del_plan', {
    title: 'Ver el historial de cambios de un plan',
    description: 'Las versiones anteriores del plan de un atleta (el tuyo, si tiene un equipo con más profesionales): cuándo cambió, quién lo cambió y si fue desde una IA. Cada una se puede recuperar con deshacer_cambio_del_plan.',
    inputSchema: { atleta: ATLETA, ...PARAM_DE },
    annotations: SOLO_LEER,
  }, seguro(async ({ atleta, de }: any) => {
    const persona = await buscarPersona(quien, atleta)
    const { profesionalId } = await programaQueEdito(quien, persona, de)
    const versiones = quien.db
      .from('plan_versiones').select('id, title, creada_en, cambiada_por, cliente_ia, motivo')
      .eq('user_id', persona.id)
    const { data, error } = await (profesionalId ? versiones.eq('profesional_id', profesionalId) : versiones.is('profesional_id', null))
      .order('creada_en', { ascending: false }).limit(20)
    if (error) throw new Error(error.message)
    const ids = [...new Set((data ?? []).map((v: any) => v.cambiada_por).filter(Boolean))]
    const { data: gente } = ids.length ? await quien.db.from('profiles').select('id, full_name, username').in('id', ids) : { data: [] }
    const nombreDeId = new Map((gente ?? []).map((g: any) => [g.id, g.full_name || g.username]))
    return respuesta({
      atleta: nombreDe(persona),
      versiones: (data ?? []).map((v: any) => ({
        version: v.id,
        es_como_estaba_antes_de: v.motivo === 'borrado' ? 'que se borrara el plan' : v.motivo === 'restauracion' ? 'regresar a una versión anterior' : 'un cambio',
        cuando: v.creada_en,
        cambio_hecho_por: nombreDeId.get(v.cambiada_por) ?? 'desconocido',
        ...(v.cliente_ia ? { desde_la_ia: v.cliente_ia } : {}),
        titulo: v.title,
      })),
    })
  }))

  /* ================================================================ */
  /* ESCRIBIR PLANES                                                    */
  /* ================================================================ */

  server.registerTool('crear_plan', {
    title: 'Crear el plan de un atleta',
    description: 'Crea el plan de un atleta. Dos tipos: "rutina" (una semana que se repite siempre; manda "sesiones") o "fases" (manda "fases", cada una con sus semanas y cada semana con sus sesiones). Cada sesión lleva su día. Opcional: "ciencia" (y "ciencia" dentro de cada fase) lleva el porqué del plan, solo si la persona la pidió o te la dio. Para no repetir semanas iguales: crea la primera y luego usa agregar_semanas con copiar_de. Si el atleta ya tiene plan, falla, salvo con reemplazar: true (el plan anterior queda en el historial y se puede recuperar). Cada ejercicio va con su nombre EXACTO del catálogo (búscalo antes con buscar_ejercicios). Antes de guardar, la herramienta revisa que no falte nada; si falta (un ejercicio que no está en el catálogo, la cantidad, si un ejercicio a una pierna o brazo cuenta por lado, o confirmar las biseries que armaste) NO guarda y te devuelve las preguntas para que se las hagas a la persona TODAS JUNTAS, en un solo mensaje.',
    inputSchema: {
      atleta: ATLETA,
      titulo: z.string().describe('Título del plan.'),
      tipo: z.enum(['rutina', 'fases']),
      sesiones: z.array(SESION_CON_DIA).optional().describe('Solo para "rutina": las sesiones de la semana que se repite.'),
      ciencia: CIENCIA,
      fases: FASES,
      reemplazar: z.boolean().optional().describe('true para reemplazar el plan que ya tiene.'),
      sin_ficha_ok: SIN_FICHA_OK,
      sin_cantidad_ok: SIN_CANTIDAD_OK,
      estructura_ok: ESTRUCTURA_OK,
      ...PARAM_DE,
    },
    annotations: { ...ESCRIBE, destructiveHint: true },
  }, seguro(async ({ atleta, titulo, tipo, sesiones, ciencia, fases, reemplazar, sin_ficha_ok, sin_cantidad_ok, estructura_ok, de }: any) => {
    const persona = await buscarPersona(quien, atleta)
    const repertorio = await repertorioVisible(quien)
    const rev = nuevaRevision()
    const { nuevas, cienciaNueva } = armarFasesDeLaIA({ tipo, sesiones, fases, ciencia }, repertorio, rev)
    const kind = tipo === 'rutina' ? 'weekly' : 'periodized'
    // El programa de ESTA persona con este atleta: su coach principal, el principal; un profesional del equipo, el suyo.
    const { plan: existente, profesionalId, de: deProfesional } = await planQueEdito(quien, persona, de)
    if (existente && !reemplazar) {
      throw new Aviso(`${nombreDe(persona)} ya tiene ${profesionalId ? (profesionalId === quien.id ? 'un programa tuyo' : `un programa de ${deProfesional}`) : p('el plan')} "${existente.title}". Para reemplazarlo manda reemplazar: true (el anterior queda en el historial). Para cambiar partes, usa editar_dia, agregar_semanas, etc.`)
    }
    // Lo que falta no se guarda en silencio: se le pregunta a la persona, todo junto (ver `preguntas.ts`). Al reemplazar, lo que ya tenía el plan anterior no se vuelve a discutir.
    const aceptado = exigirRespuestas({
      revision: rev,
      catalogo: repertorio,
      plan: existente ? { nombres: nombresDeEjercicios(existente), firmas: firmasDeGrupos(existente) } : null,
      respuestas: { sin_ficha_ok, sin_cantidad_ok, estructura_ok },
    })
    if (existente) {
      const { data, error } = await quien.db.from('plans')
        .update({
          title: titulo,
          /* Reemplazar el plan cambia lo que se entrena, no la foto que el coach le puso: esa se queda. La ciencia es del plan
             viejo (explicaba ESE plan): la nueva es la que mandes, o ninguna; la anterior queda en el historial. */
          data: {
            kind, phases: normalizar(nuevas),
            ...(existente.data?.foto ? { foto: existente.data.foto } : {}),
            ...(cienciaNueva.length ? { ciencia: cienciaNueva } : {}),
          },
          updated_at: new Date().toISOString(),
        })
        .eq('id', existente.id).select('id').maybeSingle()
      if (error) throw new Error(error.message)
      if (!data) throw new Aviso('No tienes permiso para cambiar el plan de esta persona.')
    } else {
      const { error } = await quien.db.from('plans').insert({
        user_id: persona.id,
        // null = el del coach principal; si no, el programa de este profesional del equipo.
        profesional_id: profesionalId,
        title: titulo,
        status: 'active',
        data: { kind, phases: normalizar(nuevas), ...(cienciaNueva.length ? { ciencia: cienciaNueva } : {}) },
        created_by: quien.id,
      })
      if (error) {
        if (/row-level security|permission/i.test(error.message)) throw new Aviso(`No puedes crearle ${p('plan')} a ${nombreDe(persona)}: ${p('no es tu atleta')}.`)
        throw new Error(error.message)
      }
    }
    const semanas = nuevas.reduce((s, f) => s + f.weekData.length, 0)
    return respuesta({
      listo: true,
      atleta: nombreDe(persona),
      ...(profesionalId ? { programa: deProfesional } : {}),
      plan: titulo,
      tipo: tipo === 'rutina' ? 'rutina que se repite' : `${nuevas.length} fase(s), ${semanas} semana(s)`,
      ...(existente ? { reemplazo: `El plan anterior "${existente.title}" quedó en el historial.` } : {}),
      ...(cienciaNueva.length || nuevas.some((f) => f.ciencia?.length)
        ? { ciencia: `Lleva ciencia: ${cienciaNueva.length + nuevas.reduce((n, f) => n + (f.ciencia?.length ?? 0), 0)} recuadro(s).` }
        : {}),
      ...(existente && cuantosRecuadros(existente) && !cienciaNueva.length && !nuevas.some((f) => f.ciencia?.length)
        ? { aviso_ciencia: 'El plan anterior tenía ciencia (recuadros del porqué del plan) y el nuevo no la lleva; la anterior quedó en el historial. Si la quiere de vuelta o una nueva, se agrega con editar_ciencia.' }
        : {}),
      ...avisosDeRespuestas(aceptado),
      mensaje: `Ya lo ve ${nombreDe(persona)} en su app.`,
    })
  }))

  server.registerTool('editar_dia', {
    title: 'Cambiar las sesiones de un día',
    description: 'Reemplaza TODAS las sesiones de un día de la semana, en una semana de una fase, por las que mandes. Para cambiar un solo ejercicio: lee el día con ver_plan_de_atleta, cámbialo y manda la sesión completa. "sesiones": [] deja el día sin sesión. En una rutina que se repite no hace falta fase ni semana. Cada ejercicio NUEVO va con su nombre EXACTO del catálogo (búscalo antes con buscar_ejercicios). Antes de guardar, la herramienta revisa que no falte nada; si falta (un ejercicio que no está en el catálogo, la cantidad, si un ejercicio a una pierna o brazo cuenta por lado, o confirmar las biseries que armaste) NO guarda y te devuelve las preguntas para que se las hagas a la persona TODAS JUNTAS, en un solo mensaje. Lo que ya estaba en el día no se vuelve a preguntar.',
    inputSchema: {
      atleta: ATLETA,
      fase: FASE,
      semana: z.coerce.number().optional().describe('Número de semana. En una rutina no hace falta.'),
      dia: z.string().describe('lunes … domingo'),
      sesiones: z.array(z.object(SESION)).describe('Las sesiones de ese día. Normalmente una; dos si entrena mañana y tarde.'),
      sin_ficha_ok: SIN_FICHA_OK,
      sin_cantidad_ok: SIN_CANTIDAD_OK,
      estructura_ok: ESTRUCTURA_OK,
      ...PARAM_DE,
    },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, fase, semana, dia, sesiones, sin_ficha_ok, sin_cantidad_ok, estructura_ok, de }: any) => {
    const { persona, plan, programa } = await planDe(quien, atleta, de)
    const fases = structuredClone(fasesDe(plan))
    const fIdx = buscarFase(plan, fase)
    const sIdx = buscarSemana(fases[fIdx], tipoDePlan(plan) === 'weekly' ? (semana ?? fases[fIdx].weekData[0]?.num) : semana)
    const clave: Dia = diaDesdeTexto(dia)
    const repertorio = await repertorioVisible(quien)
    const rev = nuevaRevision()
    // La clase en video de una sesión no viaja en lo que manda la IA: se toma de la sesión que ya estaba (la del mismo nombre, o la que ocupaba ese lugar).
    const antes = (fases[fIdx].weekData[sIdx]?.days ?? []).filter((d: any) => d.day === clave)
    const nuevos = sesiones.map((s: any, i: number) => {
      const armado = diaDesdeEntrada(clave, s, repertorio)
      anotarDia(rev, `${NOMBRE_DIA[clave]}${s.nombre ? ` · ${s.nombre}` : ''}`, armado)
      const previa = antes.find((d: any) => s.nombre && d.name && mismoTexto(d.name, s.nombre)) ?? antes[i]
      if (claseDe(previa) && s.quitar_clase !== true) (armado.dia as any).clase = structuredClone(previa.clase)
      return armado.dia
    })
    // Leer un día y reescribirlo no debe volver a discutir lo que el plan ya tenía; lo nuevo que falte, sí se pregunta, todo junto.
    const aceptado = exigirRespuestas({
      revision: rev,
      catalogo: repertorio,
      plan: { nombres: nombresDeEjercicios(plan), firmas: firmasDeGrupos(plan) },
      respuestas: { sin_ficha_ok, sin_cantidad_ok, estructura_ok },
    })
    const w = fases[fIdx].weekData[sIdx]
    const primero = w.days.findIndex((d: any) => d.day === clave)
    const resto = w.days.filter((d: any) => d.day !== clave)
    const donde = primero < 0 ? resto.length : w.days.slice(0, primero).filter((d: any) => d.day !== clave).length
    w.days = [...resto.slice(0, donde), ...nuevos, ...resto.slice(donde)]
    await guardarFases(quien, plan, fases)
    return respuesta({
      listo: true,
      atleta: nombreDe(persona),
      ...programa,
      cambio: `${fases[fIdx].name} · semana ${w.num} · ${NOMBRE_DIA[clave]}`,
      ahora: nuevos.length ? nuevos.map((d: any) => `${d.name} (${claseDe(d) ? 'clase en video + ' : ''}${d.exercises.filter((e: any) => !e.isNote).length} ejercicios)`) : 'sin sesión',
      ...avisosDeRespuestas(aceptado),
      deshacer: 'Si no quedó bien: deshacer_cambio_del_plan.',
    })
  }))

  server.registerTool('copiar_semana', {
    title: 'Copiar una semana a otras',
    description: 'Copia todas las sesiones de una semana a otras semanas de la MISMA fase (las reemplaza). Útil para armar la semana 1 y repetirla.',
    inputSchema: {
      atleta: ATLETA,
      fase: FASE,
      de_semana: z.coerce.number().describe('La semana que se copia.'),
      a_semanas: z.union([z.array(z.coerce.number()), z.literal('todas')]).describe('Las semanas destino, o "todas" las demás de la fase.'),
      ...PARAM_DE,
    },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, fase, de_semana, a_semanas, de }: any) => {
    const { persona, plan, programa } = await planDe(quien, atleta, de)
    const fases = structuredClone(fasesDe(plan))
    const f = fases[buscarFase(plan, fase)]
    const origen = f.weekData[buscarSemana(f, de_semana)]
    const destinos = a_semanas === 'todas'
      ? f.weekData.filter((w: any) => w.num !== origen.num)
      : a_semanas.map((n: number) => f.weekData[buscarSemana(f, n)])
    destinos.forEach((w: any) => { w.days = structuredClone(origen.days) })
    await guardarFases(quien, plan, fases)
    return respuesta({ listo: true, atleta: nombreDe(persona), ...programa, fase: f.name, copiada: origen.num, a: destinos.map((w: any) => w.num) })
  }))

  server.registerTool('agregar_semanas', {
    title: 'Agregar semanas a una fase',
    description: 'Agrega semanas al final de una fase: vacías, o copiando una que ya existe.',
    inputSchema: {
      atleta: ATLETA,
      fase: FASE,
      cuantas: z.coerce.number().min(1).max(20).optional().describe('1 si no se dice.'),
      copiar_de: z.coerce.number().optional().describe('Número de la semana que se copia en cada una.'),
      nombre: z.string().optional(),
      carga: z.string().optional(),
      ...PARAM_DE,
    },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, fase, cuantas, copiar_de, nombre, carga, de }: any) => {
    const { persona, plan, programa } = await planDe(quien, atleta, de)
    if (tipoDePlan(plan) === 'weekly') throw new Aviso('Una rutina que se repite tiene una sola semana. Para tener varias hay que pasarla a programa por fases en la app.')
    const fases = structuredClone(fasesDe(plan))
    const f = fases[buscarFase(plan, fase)]
    const molde = copiar_de != null ? f.weekData[buscarSemana(f, copiar_de)] : null
    const nuevas: number[] = []
    for (let i = 0; i < (cuantas ?? 1); i++) {
      const num = siguienteNumSemana(f)
      f.weekData.push({
        ...semanaNueva(num, { nombre, carga }),
        ...(molde && !nombre ? { label: molde.label } : {}),
        ...(molde && !carga ? { load: molde.load } : {}),
        days: molde ? structuredClone(molde.days) : [],
      })
      nuevas.push(num)
    }
    await guardarFases(quien, plan, fases)
    return respuesta({ listo: true, atleta: nombreDe(persona), ...programa, fase: f.name, semanas_nuevas: nuevas, ...(molde ? { copia_de: molde.num } : {}) })
  }))

  server.registerTool('editar_semana', {
    title: 'Nombre y carga de una semana',
    description: 'Cambia el nombre (título) y la carga de una semana. No toca sus sesiones.',
    inputSchema: {
      atleta: ATLETA,
      fase: FASE,
      semana: z.coerce.number(),
      nombre: z.string().optional().describe('Título de la semana. "" lo quita.'),
      carga: z.string().optional().describe('Ej.: "4×10 al 65% · RIR 3". "" la quita.'),
      ...PARAM_DE,
    },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, fase, semana, nombre, carga, de }: any) => {
    const { persona, plan, programa } = await planDe(quien, atleta, de)
    const fases = structuredClone(fasesDe(plan))
    const f = fases[buscarFase(plan, fase)]
    const w = f.weekData[buscarSemana(f, semana)]
    if (nombre !== undefined) w.label = nombre
    if (carga !== undefined) w.load = carga
    await guardarFases(quien, plan, fases)
    return respuesta({ listo: true, atleta: nombreDe(persona), ...programa, fase: f.name, semana: w.num, nombre: w.label, carga: w.load })
  }))

  server.registerTool('agregar_fase', {
    title: 'Agregar una fase',
    description: 'Agrega una fase al programa: al final o después de otra. Con semanas vacías, o copiando las semanas de otra fase.',
    inputSchema: {
      atleta: ATLETA,
      nombre: z.string(),
      subtitulo: z.string().optional(),
      enfoque: z.string().optional(),
      objetivo: z.string().optional(),
      color: z.string().optional().describe('Hex, ej. #FFA047. Si no, el siguiente de la paleta.'),
      semanas: z.coerce.number().min(1).max(30).optional().describe('Cuántas semanas vacías. 1 si no se dice.'),
      copiar_semanas_de: z.coerce.string().optional().describe('Fase de la que se copian todas las semanas.'),
      despues_de: z.coerce.string().optional().describe('Fase después de la cual va. Al final si no se dice.'),
      ...PARAM_DE,
    },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, nombre, subtitulo, enfoque, objetivo, color, semanas, copiar_semanas_de, despues_de, de }: any) => {
    const { persona, plan, programa } = await planDe(quien, atleta, de)
    if (tipoDePlan(plan) === 'weekly') throw new Aviso('Una rutina que se repite no tiene fases. Para tenerlas hay que pasarla a programa por fases en la app.')
    const fases = structuredClone(fasesDe(plan))
    const nueva = faseNueva(siguienteNumFase(fases), { nombre, subtitulo, enfoque, objetivo, color })
    if (copiar_semanas_de != null) {
      nueva.weekData = structuredClone(fases[buscarFase(plan, copiar_semanas_de)].weekData)
    } else {
      nueva.weekData = Array.from({ length: semanas ?? 1 }, (_, i) => semanaNueva(i + 1))
    }
    const pos = despues_de != null ? buscarFase(plan, despues_de) + 1 : fases.length
    fases.splice(pos, 0, nueva)
    await guardarFases(quien, plan, fases)
    return respuesta({ listo: true, atleta: nombreDe(persona), ...programa, fase_nueva: nueva.name, posicion: pos + 1, semanas: nueva.weekData.length })
  }))

  server.registerTool('editar_fase', {
    title: 'Cambiar una fase',
    description: 'Cambia el nombre, subtítulo, enfoque, objetivo o color de una fase, o la mueve de lugar. No toca sus semanas.',
    inputSchema: {
      atleta: ATLETA,
      fase: z.coerce.string(),
      nombre: z.string().optional(),
      subtitulo: z.string().optional(),
      enfoque: z.string().optional(),
      objetivo: z.string().optional(),
      color: z.string().optional(),
      mover_a_posicion: z.coerce.number().min(1).optional().describe('Nueva posición: 1 = primera.'),
      ...PARAM_DE,
    },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, fase, nombre, subtitulo, enfoque, objetivo, color, mover_a_posicion, de }: any) => {
    const { persona, plan, programa } = await planDe(quien, atleta, de)
    const fases = structuredClone(fasesDe(plan))
    const i = buscarFase(plan, fase)
    const f = fases[i]
    if (nombre !== undefined) f.name = nombre
    if (subtitulo !== undefined) f.fullName = subtitulo
    if (enfoque !== undefined) f.focus = enfoque
    if (objetivo !== undefined) f.objective = objetivo
    if (color !== undefined) f.color = color
    if (mover_a_posicion != null) {
      fases.splice(i, 1)
      fases.splice(Math.min(mover_a_posicion - 1, fases.length), 0, f)
    }
    await guardarFases(quien, plan, fases)
    return respuesta({ listo: true, atleta: nombreDe(persona), ...programa, fase: f.name, posicion: fases.indexOf(f) + 1 })
  }))

  server.registerTool('editar_ciencia', {
    title: 'Cambiar la ciencia de un plan',
    description: 'Agrega, cambia o quita recuadros de la «Ciencia» de un plan: el porqué de cómo está armado, que el atleta lee en Home. Sin "fase" los recuadros son de TODO el plan; con "fase", de esa fase. Modo "agregar" (el de siempre): cada recuadro se suma al final y, si ya hay uno con ese título, se le cambia el texto. Modo "reemplazar": la lista de ese sitio queda exactamente como la mandes; si con eso se pierden recuadros que ya había, NO guarda y te dice qué preguntarle a la persona (repite con reemplazo_ok: true solo después de que lo confirme). "quitar": títulos de recuadros que se sacan. Léela antes con ver_ciencia_del_plan. No inventes ciencia: solo la que la persona te pidió o te dio. Texto: una línea en blanco separa párrafos; "- " al inicio de línea hace viñetas; "## " un subtítulo; "nombre | valor | nota" una fila de tabla. Se puede deshacer (deshacer_cambio_del_plan).',
    inputSchema: {
      atleta: ATLETA,
      fase: FASE,
      recuadros: z.array(RECUADRO).optional().describe('Los recuadros a agregar (o a poner, con modo "reemplazar").'),
      modo: z.enum(['agregar', 'reemplazar']).optional().describe('"agregar" (por defecto) o "reemplazar" toda la lista de ese sitio.'),
      quitar: z.array(z.string()).optional().describe('Títulos de los recuadros que se quitan.'),
      reemplazo_ok: z.boolean().optional().describe('true solo después de preguntar y que la persona confirme que se pierden los recuadros que ya había.'),
      ...PARAM_DE,
    },
    annotations: { ...ESCRIBE, destructiveHint: true },
  }, seguro(async ({ atleta, fase, recuadros, modo, quitar, reemplazo_ok, de }: any) => {
    const { persona, plan, programa } = await planDe(quien, atleta, de)
    const enFase = fase != null && String(fase).trim() !== ''
    const nuevos = recuadrosDeLaIA(recuadros, enFase ? `la fase ${fase}` : 'todo el plan')
    if (!nuevos.length && !quitar?.length) throw new Aviso('No mandaste nada que cambiar: manda "recuadros" o "quitar".')
    const fases = structuredClone(fasesDe(plan))
    const f = enFase ? fases[buscarFase(plan, fase)] : null
    const donde = enFase ? `la fase ${f.name}` : 'todo el plan'
    const actual = enFase ? cienciaDeFase(f) : cienciaDelPlan(plan)
    const modoFinal = modo ?? 'agregar'
    const hecho = cambiarRecuadros(actual, nuevos, modoFinal, quitar ?? [])
    if (hecho.noEncontrados.length) {
      throw new Aviso(`En ${donde} no hay un recuadro llamado ${hecho.noEncontrados.map((t) => `"${t}"`).join(', ')}. Los que hay: ${actual.map((r) => `"${r.titulo}"`).join(', ') || 'ninguno'}. No cambié nada.`)
    }
    // «reemplazar» que se lleva recuadros que ya estaban es lo único que se pregunta primero: el resto suma o se pide por título.
    if (modoFinal === 'reemplazar' && !reemplazo_ok) {
      const seVan = actual.filter((r) => !hecho.lista.some((x) => mismoTexto(x.titulo, r.titulo))).map((r) => r.titulo)
      if (seVan.length) {
        throw new Aviso(`Con "reemplazar" se perderían ${seVan.length} recuadro(s) de ${donde}: ${seVan.map((t) => `"${t}"`).join(', ')}. No cambié nada. Pregúntale a la persona si quiere reemplazarlos (o usa el modo "agregar"); si sí, repite con reemplazo_ok: true.`)
      }
    }
    if (enFase) {
      if (hecho.lista.length) f.ciencia = hecho.lista
      else delete f.ciencia
      await guardarFases(quien, plan, fases)
    } else {
      await guardarFases(quien, plan, fases, undefined, { ciencia: hecho.lista })
    }
    return respuesta({
      listo: true,
      atleta: nombreDe(persona),
      ...programa,
      plan: plan.title,
      donde,
      agregados: hecho.agregados,
      cambiados: hecho.actualizados,
      quitados: hecho.quitados,
      recuadros_ahora: hecho.lista.map((r) => r.titulo),
    })
  }))

  server.registerTool('cambiar_titulo_del_plan', {
    title: 'Cambiar el título del plan',
    description: 'Cambia el título del plan de un atleta.',
    inputSchema: { atleta: ATLETA, titulo: z.string(), ...PARAM_DE },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, titulo, de }: any) => {
    const { persona, plan, programa } = await planDe(quien, atleta, de)
    await guardarFases(quien, plan, structuredClone(fasesDe(plan)), titulo)
    return respuesta({ listo: true, atleta: nombreDe(persona), ...programa, titulo })
  }))

  server.registerTool('deshacer_cambio_del_plan', {
    title: 'Deshacer un cambio del plan',
    description: 'Regresa el plan de un atleta a como estaba antes del último cambio, o a una versión del historial (ver_historial_del_plan). También recupera un plan borrado. Deshacer también queda en el historial: se puede rehacer.',
    inputSchema: {
      atleta: ATLETA,
      version: z.string().optional().describe('El id de una versión del historial. Si no se da, la más reciente.'),
      ...PARAM_DE,
    },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, version, de }: any) => {
    const persona = await buscarPersona(quien, atleta)
    // Solo versiones del programa de ESTA persona (el suyo; el master, el del principal o el que diga).
    const { profesionalId, de: deProfesional } = await programaQueEdito(quien, persona, de)
    let id = version
    if (!id) {
      const ultima = quien.db.from('plan_versiones').select('id').eq('user_id', persona.id)
      const { data } = await (profesionalId ? ultima.eq('profesional_id', profesionalId) : ultima.is('profesional_id', null))
        .order('creada_en', { ascending: false }).limit(1).maybeSingle()
      if (!data) throw new Aviso(`${p('El plan')} de ${nombreDe(persona)} no tiene cambios anteriores guardados.`)
      id = data.id
    }
    const { data: v } = await quien.db.from('plan_versiones').select('title, creada_en, user_id, profesional_id').eq('id', id).maybeSingle()
    if (!v || v.user_id !== persona.id) throw new Aviso(`Esa versión no es de ${p('este atleta')}.`)
    if ((v.profesional_id ?? null) !== profesionalId) throw new Aviso(`Esa versión es de otro programa de ${nombreDe(persona)}, no del tuyo.`)
    const { error } = await quien.db.rpc('regresar_plan_a_version', { p_version: id })
    if (error) throw new Aviso(error.message)
    return respuesta({ listo: true, atleta: nombreDe(persona), ...(profesionalId ? { programa: deProfesional } : {}), plan: v.title, regreso_a: `como estaba antes del cambio del ${v.creada_en}` })
  }))

  server.registerTool('quitar_semana', {
    title: 'Quitar una semana',
    description: 'Quita una semana de una fase, con todas sus sesiones. Se puede recuperar con deshacer_cambio_del_plan.',
    inputSchema: { atleta: ATLETA, fase: FASE, semana: z.coerce.number(), ...PARAM_DE },
    annotations: BORRA,
  }, seguro(async ({ atleta, fase, semana, de }: any) => {
    const { persona, plan, programa } = await planDe(quien, atleta, de)
    const fases = structuredClone(fasesDe(plan))
    const f = fases[buscarFase(plan, fase)]
    if (f.weekData.length <= 1) throw new Aviso('Es la única semana de la fase. Para quitar la fase entera usa quitar_fase.')
    const i = buscarSemana(f, semana)
    f.weekData.splice(i, 1)
    await guardarFases(quien, plan, fases)
    return respuesta({ listo: true, atleta: nombreDe(persona), ...programa, fase: f.name, semana_quitada: semana, deshacer: 'deshacer_cambio_del_plan la regresa.' })
  }))

  server.registerTool('quitar_fase', {
    title: 'Quitar una fase',
    description: 'Quita una fase entera del plan, con todas sus semanas y sesiones. Se puede recuperar con deshacer_cambio_del_plan.',
    inputSchema: { atleta: ATLETA, fase: z.coerce.string(), ...PARAM_DE },
    annotations: BORRA,
  }, seguro(async ({ atleta, fase, de }: any) => {
    const { persona, plan, programa } = await planDe(quien, atleta, de)
    const fases = structuredClone(fasesDe(plan))
    if (fases.length <= 1) throw new Aviso('Es la única fase del plan. Para quitar todo usa borrar_plan.')
    const i = buscarFase(plan, fase)
    const [quitada] = fases.splice(i, 1)
    await guardarFases(quien, plan, fases)
    return respuesta({ listo: true, atleta: nombreDe(persona), ...programa, fase_quitada: quitada.name, deshacer: 'deshacer_cambio_del_plan la regresa.' })
  }))

  server.registerTool('borrar_plan', {
    title: 'Borrar el plan de un atleta',
    description: 'Borra el plan activo de un atleta. Sus registros (pesos, sesiones hechas) no se borran. El plan queda en el historial y se puede recuperar con deshacer_cambio_del_plan.',
    inputSchema: { atleta: ATLETA, ...PARAM_DE, confirmado: z.boolean().optional().describe(TEXTO_CONFIRMADO_BORRAR), },
    annotations: BORRA,
  }, seguro(async ({ atleta, de, confirmado }: any) => {
    const { persona, plan, programa } = await planDe(quien, atleta, de)
    const antes = sinConfirmarBorrado(confirmado, `Se borrará el plan "${plan.title}" de ${nombreDe(persona)}. Sus registros (pesos, sesiones hechas) no se borran y el plan queda en el historial (deshacer_cambio_del_plan lo recupera).`)
    if (antes) return antes
    const { data, error } = await quien.db.from('plans').delete().eq('id', plan.id).select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) throw new Aviso(`No tienes permiso para borrar ${p('este plan')}.`)
    return respuesta({ listo: true, atleta: nombreDe(persona), ...programa, plan_borrado: plan.title, recuperar: 'deshacer_cambio_del_plan lo recupera.' })
  }))

  /* ================================================================ */
  /* PLANTILLAS                                                         */
  /* ================================================================ */

  server.registerTool('guardar_plantilla', {
    title: 'Guardar un día o una semana como plantilla',
    description: 'Atajo para guardar como plantilla la sesión de un día (tipo "dia") o una semana entera (tipo "semana") del plan de un atleta. Para guardar un programa por fases, elegir carpeta o armar algo sin atleta, usa guardar_en_mis_planes (Mis planes).',
    inputSchema: {
      nombre: z.string().describe('Nombre de la plantilla.'),
      tipo: z.enum(['dia', 'semana']),
      atleta: ATLETA,
      fase: FASE,
      semana: z.coerce.number().optional(),
      dia: z.string().optional().describe('Para tipo "dia": lunes … domingo. Si ese día tiene dos sesiones, se guarda la primera.'),
      ...PARAM_DE,
    },
    annotations: ESCRIBE,
  }, seguro(async ({ nombre, tipo, atleta, fase, semana, dia, de }: any) => {
    const { plan } = await planDe(quien, atleta, de)
    const fases = fasesDe(plan)
    const f = fases[buscarFase(plan, fase)]
    const w = f.weekData[buscarSemana(f, semana ?? (f.weekData.length === 1 ? f.weekData[0].num : undefined))]
    let data: any
    if (tipo === 'semana') {
      data = { days: structuredClone(w.days) }
    } else {
      if (!dia) throw new Aviso('Para guardar un día, di cuál.')
      const d = w.days.find((x: any) => x.day === diaDesdeTexto(dia))
      if (!d) throw new Aviso(`Ese día no tiene sesión en la semana ${w.num}.`)
      data = {
        name: d.name, cat: d.cat, catNombre: d.catNombre ?? null, catColor: d.catColor ?? null, catIcono: d.catIcono ?? null, exercises: structuredClone(d.exercises ?? []),
        ...(claseDe(d) ? { clase: structuredClone(d.clase) } : {}),
      }
    }
    // Un día con clase en video se guarda como «Clase» en Mis planes: la lista lo sabe por el resumen, igual que cuando la guarda la app (`resumenDe` en src/lib/misPlanesDatos.js).
    const clase = tipo === 'semana' ? null : claseDe(data)
    const resumen = clase
      ? { sesiones: 1, ejercicios: (data.exercises ?? []).filter((e: any) => !e?.isNote).length, clase: true, ...(clase.duracion ? { duracion: clase.duracion } : {}) }
      : undefined
    const { error } = await quien.db.from('routine_templates').insert({ name: nombre, kind: tipo === 'semana' ? 'week' : 'day', data, created_by: quien.id, ...(resumen ? { resumen } : {}) })
    if (error) throw new Error(error.message)
    return respuesta({ listo: true, plantilla: nombre, tipo })
  }))

  server.registerTool('aplicar_plantilla', {
    title: 'Aplicar una plantilla',
    description: 'Pone una plantilla en el plan de un atleta. Una de semana reemplaza todas las sesiones de esa semana. Una de día reemplaza las sesiones de ese día (o se agrega, con agregar: true).',
    inputSchema: {
      plantilla: z.string().describe('Nombre o id de la plantilla (ver_catalogos).'),
      atleta: ATLETA,
      fase: FASE,
      semana: z.coerce.number().optional(),
      dia: z.string().optional().describe('Para plantillas de día.'),
      agregar: z.boolean().optional().describe('Para plantillas de día: agregar como otra sesión en vez de reemplazar.'),
      ...PARAM_DE,
    },
    annotations: ESCRIBE,
  }, seguro(async ({ plantilla, atleta, fase, semana, dia, agregar, de }: any) => {
    const { data: todas } = await quien.db.from('routine_templates').select('id, name, kind, data').eq('created_by', quien.id)
    const t = (todas ?? []).find((x: any) => x.id === plantilla) ?? (todas ?? []).find((x: any) => mismoTexto(x.name, plantilla))
    if (!t) throw new Aviso(`No encontré la plantilla "${plantilla}". Mira tus plantillas con ver_catalogos.`)
    const { persona, plan, programa } = await planDe(quien, atleta, de)
    const fases = structuredClone(fasesDe(plan))
    const f = fases[buscarFase(plan, fase)]
    const w = f.weekData[buscarSemana(f, semana ?? (f.weekData.length === 1 ? f.weekData[0].num : undefined))]
    if (t.kind === 'week') {
      w.days = structuredClone(t.data?.days ?? [])
    } else {
      if (!dia) throw new Aviso('Es una plantilla de día: di en qué día va.')
      const clave = diaDesdeTexto(dia)
      const nuevo = {
        day: clave, name: t.data?.name || t.name, cat: t.data?.cat || 'gym', catNombre: t.data?.catNombre ?? null, catColor: t.data?.catColor ?? null, catIcono: t.data?.catIcono ?? null,
        exercises: structuredClone(t.data?.exercises ?? []),
        ...(claseDe(t.data) ? { clase: structuredClone(t.data.clase) } : {}),
      }
      w.days = agregar ? [...w.days, nuevo] : [...w.days.filter((d: any) => d.day !== clave), nuevo]
    }
    await guardarFases(quien, plan, fases)
    return respuesta({ listo: true, atleta: nombreDe(persona), ...programa, plantilla: t.name, en: `${f.name} · semana ${w.num}${dia ? ` · ${dia}` : ''}` })
  }))

  server.registerTool('borrar_plantilla', {
    title: 'Borrar una plantilla',
    description: 'Borra una de tus plantillas. Los planes donde ya se usó no cambian.',
    inputSchema: { plantilla: z.string().describe('Nombre o id.'), confirmado: z.boolean().optional().describe(TEXTO_CONFIRMADO_BORRAR), },
    annotations: BORRA,
  }, seguro(async ({ plantilla, confirmado }: any) => {
    const { data: todas } = await quien.db.from('routine_templates').select('id, name').eq('created_by', quien.id)
    const t = (todas ?? []).find((x: any) => x.id === plantilla) ?? (todas ?? []).find((x: any) => mismoTexto(x.name, plantilla))
    if (!t) throw new Aviso(`No encontré la plantilla "${plantilla}".`)
    const antes = sinConfirmarBorrado(confirmado, `Se borrará la plantilla "${t.name}". Los planes donde ya se usó no cambian.`)
    if (antes) return antes
    const { error } = await quien.db.from('routine_templates').delete().eq('id', t.id)
    if (error) throw new Error(error.message)
    return respuesta({ listo: true, plantilla_borrada: t.name })
  }))

  /* ================================================================ */
  /* ATLETAS                                                            */
  /* ================================================================ */

  server.registerTool('agregar_atleta', {
    title: 'Agregar un atleta',
    description: 'Agrega un atleta con su nombre y apellido (sin correo) y devuelve su link de invitación. Desde ya aparece en tu lista y se le puede armar el plan; él o ella elige su usuario y contraseña al abrir el link. El link no caduca. Cada profesional puede agregar 5 atletas gratis a mano (quien compra un plan no cuenta); al llegar al tope devuelve `sin_lugares` y hay que explicarle las dos salidas.',
    inputSchema: { nombre: z.string(), apellido: z.string() },
    annotations: ESCRIBE,
  }, seguro(async ({ nombre, apellido }: any) => {
    let r: any
    try {
      r = await llamarFuncion(quien, 'invitar-atleta', { nombre, apellido })
    } catch (e: any) {
      // Cada profesional nuevo puede agregar 5 atletas gratis a mano; después hay dos caminos. Se le explican a la persona, no se reintenta.
      if (e?.codigo === 'LIMITE_DE_ATLETAS') {
        return respuesta({
          listo: false,
          sin_lugares: true,
          mensaje: 'Ya agregaste todos tus atletas gratis. Para agregar más hay dos caminos: (1) que compren un programa tuyo (quien compra no cuenta entre tus atletas), o (2) pagar derechos para tener más lugares, desde la app en «Mis atletas» → «Agregar atleta». Cuéntaselo así a la persona; no hay otra forma de agregarlo.',
        })
      }
      throw e
    }
    return respuesta({
      listo: true,
      atleta: r.full_name ?? `${nombre} ${apellido}`,
      link_de_invitacion: `${APP_URL}/?invitacion=${encodeURIComponent(r.token)}`,
      mensaje: 'Mándale este link. Ya puedes armarle su plan aunque todavía no lo abra.',
    })
  }))

  if (!esMaster) {
    server.registerTool('quitar_atleta_de_mi_lista', {
      title: 'Quitar un atleta de mi lista',
      description: 'Deja de ser coach de este atleta. Su cuenta, su plan y sus registros NO se borran: el administrador lo sigue viendo y puede asignarlo a otro coach.',
      inputSchema: { atleta: ATLETA },
      annotations: BORRA,
    }, seguro(async ({ atleta }: any) => {
      const persona = await buscarPersona(quien, atleta)
      const { error } = await quien.db.rpc('quitar_atleta_de_mi_lista', { atleta: persona.id })
      if (error) throw new Aviso(error.message)
      return respuesta({ listo: true, atleta: nombreDe(persona), mensaje: 'Ya no está en tu lista. Su cuenta y su historial siguen intactos.' })
    }))
  }

  /* ================================================================ */
  /* PAUSAR, REANUDAR Y MOVER EL PLAN (p79, 26 oct 2026)                  */
  /* ================================================================ */

  const CONFIRMA_EQUIPO = z.boolean().optional().describe('Solo después de enseñarle a la persona lo que va a pasar y que diga que sí. Sin esto no hace nada y te devuelve lo que pasaría.')

  /** El puntero del atleta en el programa que ESTA persona cambia, puesto al día igual que la app (`MoverElPlan`). */
  async function punteroDelAtleta(atleta: string, de?: string | null) {
    const persona = await buscarPersona(quien, atleta)
    const r = await planQueEdito(quien, persona, de)
    if (!r.plan) throw new Aviso(`${nombreDe(persona)} todavía no tiene plan${r.profesionalId === null ? '' : r.profesionalId === quien.id ? ' tuyo' : ` de ${r.de}`}.`)
    const fases = fasesDe(r.plan)
    if (tipoDePlan(r.plan) === 'weekly') throw new Aviso('Es una rutina que se repite cada semana: no tiene fases ni semanas donde moverla o pausarla.')
    const estado = await estadoDe(quien, persona.id)
    const clave = claveDeRegistro('wr:cursor', r.profesionalId)
    const guardado = estado[clave]
    const base = isValidCursor(fases, guardado) ? guardado : defaultCursor(fases)
    const actual = cursorAlDia(fases, base)
    const dondeEsta = (c: any) => {
      const f = fases.find((x: any) => x.id === c.phaseId)
      return `${f?.name ?? 'su fase'}, semana ${c.weekNum}`
    }
    return { persona, r, fases, clave, actual, dondeEsta }
  }

  const ROL_DE_QUIEN_MUEVE = () => `Tu ${quien.salud ? 'fisio' : 'coach'}`

  async function guardaPuntero(persona: Persona, clave: string, cursor: any, texto: string, detalle: string) {
    const el = new Date().toISOString()
    const conAviso = { ...cursor, aviso: { id: el, texto, detalle, de: quien.nombre || null, el } }
    const { error } = await quien.db.rpc('mover_plan_de_atleta', { p_atleta: persona.id, p_clave: clave, p_cursor: conAviso })
    if (error) throw new Aviso(error.message)
  }

  const DE_PROGRAMA = z.string().optional().describe('Solo si el atleta tiene programas de varios profesionales: de cuál (nombre, "coach" o "fisio"). Sin esto, el tuyo.')

  server.registerTool('pausar_plan_de_atleta', {
    title: 'Pausar el plan de un atleta',
    description: 'Pausa el plan de un atleta: se queda en la semana donde va hasta que lo reanudes (no se salta ninguna). El atleta ve «Tu coach pausó tu plan» con un botón Entendido. Sin "confirmado": true no hace nada y te devuelve lo que pasaría.',
    inputSchema: { atleta: ATLETA, de: DE_PROGRAMA, confirmado: CONFIRMA_EQUIPO },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, de, confirmado }: any) => {
    const { persona, clave, actual, dondeEsta } = await punteroDelAtleta(atleta, de)
    if (estaEnPausa(actual)) throw new Aviso(`El plan de ${nombreDe(persona)} ya está en pausa (desde el ${actual.pausa}).`)
    if (confirmado !== true) {
      return respuesta({ hecho: false, motivo: 'falta_confirmacion', va_a_pasar: `Se pausará el plan de ${nombreDe(persona)}: se queda en ${dondeEsta(actual)} hasta que lo reanudes. Verá un aviso «${ROL_DE_QUIEN_MUEVE()} pausó tu plan».`, pista: 'Enséñale esto a la persona. Si dice que sí, vuelve a llamar con confirmado: true.' })
    }
    await guardaPuntero(persona, clave, pausarPlan(actual), `${ROL_DE_QUIEN_MUEVE()} pausó tu plan`, `Se queda en ${dondeEsta(actual)} hasta que lo reanude.`)
    return respuesta({ listo: true, atleta: nombreDe(persona), en_pausa: true, se_queda_en: dondeEsta(actual) })
  }))

  server.registerTool('reanudar_plan_de_atleta', {
    title: 'Reanudar el plan de un atleta',
    description: 'Reanuda el plan pausado de un atleta: sigue desde la misma semana, sin saltarse ninguna. El atleta ve «Tu coach reanudó tu plan». Sin "confirmado": true no hace nada y te devuelve lo que pasaría.',
    inputSchema: { atleta: ATLETA, de: DE_PROGRAMA, confirmado: CONFIRMA_EQUIPO },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, de, confirmado }: any) => {
    const { persona, clave, actual, dondeEsta } = await punteroDelAtleta(atleta, de)
    if (!estaEnPausa(actual)) throw new Aviso(`El plan de ${nombreDe(persona)} no está en pausa.`)
    if (confirmado !== true) {
      return respuesta({ hecho: false, motivo: 'falta_confirmacion', va_a_pasar: `Se reanudará el plan de ${nombreDe(persona)}: sigue en ${dondeEsta(actual)}. Verá un aviso «${ROL_DE_QUIEN_MUEVE()} reanudó tu plan».`, pista: 'Enséñale esto a la persona. Si dice que sí, vuelve a llamar con confirmado: true.' })
    }
    await guardaPuntero(persona, clave, reanudarPlan(actual), `${ROL_DE_QUIEN_MUEVE()} reanudó tu plan`, `Sigues en ${dondeEsta(actual)}.`)
    return respuesta({ listo: true, atleta: nombreDe(persona), en_pausa: false, sigue_en: dondeEsta(actual) })
  }))

  server.registerTool('mover_plan_de_atleta_a', {
    title: 'Mover a un atleta a otra fase y semana de su plan',
    description: 'Cambia DÓNDE VA un atleta en su plan (por ejemplo «se lastimó, regresa una semana»). No cambia lo que hace cada día; el día sale del calendario. Conserva la pausa si la tenía. El atleta ve «Tu coach movió tu plan». Sin "confirmado": true no hace nada y te devuelve lo que pasaría.',
    inputSchema: { atleta: ATLETA, fase: FASE, semana: z.coerce.number().optional().describe('Número de la semana dentro de esa fase.'), de: DE_PROGRAMA, confirmado: CONFIRMA_EQUIPO },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, fase, semana, de, confirmado }: any) => {
    const { persona, r, fases, clave, actual, dondeEsta } = await punteroDelAtleta(atleta, de)
    const f = fases[buscarFase(r.plan!, fase)]
    const w = f.weekData[buscarSemana(f, semana)]
    if (w.bloqueada) throw new Aviso('Esa semana todavía no se abre (es de un plan comprado y la ventana aún no llega).')
    const destino = `${f.name}, semana ${w.num}`
    if (f.id === actual.phaseId && w.num === actual.weekNum) throw new Aviso(`${nombreDe(persona)} ya va en ${destino}.`)
    if (confirmado !== true) {
      return respuesta({ hecho: false, motivo: 'falta_confirmacion', va_a_pasar: `Se moverá a ${nombreDe(persona)} de ${dondeEsta(actual)} a ${destino}. Verá un aviso «${ROL_DE_QUIEN_MUEVE()} movió tu plan».`, pista: 'Enséñale esto a la persona. Si dice que sí, vuelve a llamar con confirmado: true.' })
    }
    await guardaPuntero(persona, clave, moverPlanA(fases, actual, f.id, w.num), `${ROL_DE_QUIEN_MUEVE()} movió tu plan`, `Ahora vas en ${destino}.`)
    return respuesta({ listo: true, atleta: nombreDe(persona), va_en: destino })
  }))

  /* ================================================================ */
  /* EQUIPO Y ALTA (p82, 26 oct 2026)                                    */
  /* ================================================================ */

  server.registerTool('invitar_al_equipo_de_un_atleta', {
    title: 'Invitar a un profesional al equipo de un atleta',
    description: 'Invita a otro profesional (un fisio, un nutriólogo, otro coach…) al equipo de un atleta TUYO. Queda PENDIENTE hasta que el profesional acepta; el atleta lo ve en su equipo. Sin "confirmado": true no invita a nadie y te devuelve lo que pasaría: enséñaselo a la persona y pregúntale.',
    inputSchema: { atleta: ATLETA, profesional: z.string().describe('Su usuario (@beto) o su código de invitación.'), confirmado: CONFIRMA_EQUIPO },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, profesional, confirmado }: any) => {
    const persona = await buscarPersona(quien, atleta)
    const ref = String(profesional ?? '').trim()
    if (!ref) throw new Aviso('Di a quién invitas: su usuario o su código.')
    if (confirmado !== true) {
      return respuesta({
        invitado: false, motivo: 'falta_confirmacion',
        va_a_pasar: `Se invitará a "${ref}" al equipo de ${nombreDe(persona)}. Queda pendiente hasta que acepte; entonces verá a ${nombreDe(persona)} en su lista.`,
        pista: 'Enséñale esto a la persona. Si dice que sí, vuelve a llamar con confirmado: true.',
      })
    }
    const { data, error } = await quien.db.rpc('invitar_al_equipo', { p_atleta: persona.id, p_ref: ref })
    if (error) throw new Aviso(error.message)
    return respuesta({ listo: true, atleta: nombreDe(persona), invitado: ref, estado: 'pendiente: falta que acepte', ...(data && typeof data === 'object' ? { detalle: data } : {}) })
  }))

  server.registerTool('dar_de_alta', {
    title: 'Dar de alta (o reabrir) a un atleta o paciente',
    description: 'Da de ALTA a un atleta o paciente que ya terminó con tu atención: tu programa deja de mandarle sesiones (queda para consultar) y nada se borra. Con alta=false lo REABRES. Sirve para tu atleta o para alguien de quien eres parte del equipo. Sin "confirmado": true no hace nada y te devuelve lo que pasaría.',
    inputSchema: { atleta: ATLETA, alta: z.boolean().optional().describe('true (por defecto) para dar de alta; false para reabrir.'), confirmado: CONFIRMA_EQUIPO },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, alta, confirmado }: any) => {
    const persona = await buscarPersona(quien, atleta)
    const dar = alta !== false
    if (confirmado !== true) {
      return respuesta({
        hecho: false, motivo: 'falta_confirmacion',
        va_a_pasar: dar
          ? `Se dará de ALTA a ${nombreDe(persona)}: tu programa dejará de mandarle sesiones (queda solo para consultar). No se borra nada y lo puedes reabrir.`
          : `Se REABRIRÁ a ${nombreDe(persona)}: tu programa vuelve a mandarle sesiones.`,
        pista: 'Enséñale esto a la persona. Si dice que sí, vuelve a llamar con confirmado: true.',
      })
    }
    // El coach principal usa `cambiar_alta`; un profesional del equipo, `cambiar_alta_de_equipo` (la base solo deja a quien de verdad lo atiende).
    const miembros = await equipoDe(quien, persona.id)
    const yo = miembros.find((m) => m.profesionalId === quien.id)
    const funcion = yo && !yo.esPrincipal ? 'cambiar_alta_de_equipo' : 'cambiar_alta'
    const { data, error } = await quien.db.rpc(funcion, { p_atleta: persona.id, p_alta: dar })
    if (error) throw new Aviso(error.message)
    // `cambiar_alta` devuelve la fila del perfil (con `alta_en`); `cambiar_alta_de_equipo`, la fecha.
    const cuando = typeof data === 'string' ? data : (data as any)?.alta_en ?? null
    return respuesta({ listo: true, atleta: nombreDe(persona), alta: dar, ...(dar && cuando ? { dada_de_alta_el: String(cuando).slice(0, 10) } : {}), mensaje: dar ? 'Listo: tu programa ya no le manda sesiones, pero lo puedes consultar.' : 'Listo: lo reabriste.' })
  }))

  /* ================================================================ */
  /* REPERTORIO                                                         */
  /* ================================================================ */

  /** Las categorías de ejercicio que esta persona ve: las de la app y las suyas. */
  async function categoriasVisibles() {
    const { data } = await quien.db.from('exercise_categories').select('id, name, slug, created_by').order('sort_order')
    const { data: masterId } = await quien.db.rpc('master_id')
    return (data ?? []).filter((c: any) => esMaster || !c.created_by || c.created_by === masterId || c.created_by === quien.id) as { id: string; name: string; slug: string; created_by?: string | null }[]
  }

  async function categoriaPorNombre(nombre?: string) {
    if (!nombre) return null
    const visibles = await categoriasVisibles()
    // Si hay varias con ese nombre (el dueño ve las de todos), la PROPIA primero, luego la de la app, y solo al final cualquiera (p80).
    const iguales = visibles.filter((x) => mismoTexto(x.name, nombre) || mismoTexto(x.slug, nombre)) as any[]
    const c = iguales.find((x) => x.created_by === quien.id) ?? iguales.find((x) => !x.created_by) ?? iguales[0]
    if (!c) throw new Aviso(`No existe la categoría "${nombre}". Las que hay: ${[...new Set(visibles.map((x) => x.name))].join(', ')}. Puedes crear una con crear_categoria.`)
    return c.id
  }

  /** Varias categorías por nombre → sus ids, sin repetir y sin la principal (no tiene sentido que sea secundaria de sí misma). */
  async function categoriasPorNombres(nombres: string[], principal?: string | null) {
    const ids = new Set<string>()
    for (const n of nombres) {
      const id = await categoriaPorNombre(n)
      if (id && id !== principal) ids.add(id)
    }
    return [...ids]
  }

  /** Los grupos musculares que se ofrecen: los de siempre y los que agregó cada coach (como en la app). */
  async function gruposMusculares() {
    const { data } = await quien.db.from('grupos_musculares').select('id, name')
    return (gruposConPropios(data ?? []) as { label: string }[]).map((g) => g.label)
  }

  const CAMPOS_EJERCICIO = {
    descripcion: z.string().optional().describe('La nota o descripción del ejercicio.'),
    categoria: z.string().optional().describe('Nombre de la categoría (ver_catalogos).'),
    categorias_secundarias: z.array(z.string()).optional().describe('Otras categorías a las que también pertenece (por nombre). En editar, [] las quita.'),
    equipo: z.string().optional().describe('Ej.: barra, mancuernas, banda, peso corporal.'),
    musculos_principales: z.array(z.string()).optional().describe('Grupos o músculos que trabaja (ver_catalogos: grupos_musculares), ej.: Piernas, Glúteo.'),
    musculos_secundarios: z.array(z.string()).optional(),
    video: z.string().url().optional().describe('Liga de YouTube, TikTok, Instagram o Vimeo. Los videos grabados se suben en la app.'),
  }

  server.registerTool('crear_ejercicio', {
    title: 'Crear un ejercicio',
    description: 'Agrega un ejercicio a tu repertorio: nombre, categoría, equipo, grupo muscular, nota y, si quieres, una liga de video (YouTube, TikTok…). Grabar o subir un video se hace en la app. Si solo traes el nombre NO lo guarda: te devuelve la pregunta que debes hacerle a la persona (una sola, con todo lo opcional), salvo que ya haya dicho que lo dejes solo con el nombre (sin_datos: true).',
    inputSchema: {
      nombre: z.string(),
      ...CAMPOS_EJERCICIO,
      sin_datos: z.boolean().optional().describe('true SOLO si la persona ya dijo que lo dejes solo con el nombre, sin datos.'),
    },
    annotations: ESCRIBE,
  }, seguro(async (a: any) => {
    const repertorio = await repertorioVisible(quien)
    const ya = repertorio.find((r) => mismoNombre(r.name, a.nombre))
    if (ya) throw new Aviso(`Ya existe "${ya.name}" en el repertorio. Úsalo, o ponle otro nombre al nuevo.`)
    const traeDatos = [a.descripcion, a.categoria, a.equipo, a.video].some((v) => typeof v === 'string' && v.trim())
      || [a.musculos_principales, a.musculos_secundarios, a.categorias_secundarias].some((l) => Array.isArray(l) && l.length)
    if (!traeDatos && !a.sin_datos) {
      // Una sola pregunta con todo lo opcional (ver `preguntas.ts`); «así» = solo el nombre.
      const [categorias, grupos] = await Promise.all([categoriasVisibles(), gruposMusculares()])
      preguntaDeDatos(a.nombre.trim(), { categorias: [...new Set(categorias.map((c) => c.name))], grupos, equipos: equiposMasUsados(repertorio) })
    }
    const categoriaId = await categoriaPorNombre(a.categoria)
    const { data, error } = await quien.db.from('exercises').insert({
      name: a.nombre.trim(),
      category_id: categoriaId,
      categorias_secundarias: await categoriasPorNombres(a.categorias_secundarias ?? [], categoriaId),
      description: a.descripcion ?? null,
      equipment: a.equipo ?? null,
      muscle_primary: a.musculos_principales ?? null,
      muscle_secondary: a.musculos_secundarios ?? null,
      video_link: a.video ?? null,
      created_by: quien.id,
    }).select('id, name').single()
    if (error) throw new Error(error.message)
    return respuesta({ listo: true, ejercicio: data.name, id: data.id })
  }))

  server.registerTool('editar_ejercicio', {
    title: 'Cambiar un ejercicio',
    description: esMaster
      ? 'Cambia un ejercicio del repertorio. Los de la app los ven todos los coaches.'
      : 'Cambia un ejercicio. Si es tuyo, se cambia. Si es de la app, se guarda TU versión (solo la ven tú y tus atletas), igual que "Mi versión" en la app.',
    inputSchema: { ejercicio: z.string().describe('Nombre exacto o id.'), nombre: z.string().optional(), ...CAMPOS_EJERCICIO },
    annotations: ESCRIBE,
  }, seguro(async (a: any) => {
    const { filas } = await repertorioConFicha(quien)
    const e = filas.find((f) => f.id === a.ejercicio) ?? filas.find((f) => mismoTexto(f.name, a.ejercicio))
    if (!e) throw new Aviso(`No encontré "${a.ejercicio}" en tu repertorio.`)
    const cambios: Record<string, unknown> = {}
    if (a.nombre !== undefined) cambios.name = a.nombre
    if (a.descripcion !== undefined) cambios.description = a.descripcion
    if (a.categoria !== undefined) cambios.category_id = await categoriaPorNombre(a.categoria)
    if (a.categorias_secundarias !== undefined) {
      const principal = (cambios.category_id as string | null | undefined) ?? e.category_id ?? null
      cambios.categorias_secundarias = await categoriasPorNombres(a.categorias_secundarias, principal)
    }
    if (a.equipo !== undefined) cambios.equipment = a.equipo
    if (a.musculos_principales !== undefined) cambios.muscle_primary = a.musculos_principales
    if (a.musculos_secundarios !== undefined) cambios.muscle_secondary = a.musculos_secundarios
    if (a.video !== undefined) cambios.video_link = a.video
    if (!Object.keys(cambios).length) throw new Aviso('No hay nada que cambiar.')

    if (e.created_by === quien.id || esMaster) {
      const { error } = await quien.db.from('exercises').update({ ...cambios, updated_at: new Date().toISOString() }).eq('id', e.id)
      if (error) throw new Error(error.message)
      return respuesta({ listo: true, ejercicio: cambios.name ?? e.name })
    }
    // De la app: la versión del coach, con la ficha COMPLETA (igual que la app).
    const campos = ['name', 'description', 'category_id', 'categorias_secundarias', 'cover_image_url', 'video_url', 'video_link', 'muscle_primary', 'muscle_secondary', 'equipment']
    const ficha: Record<string, unknown> = {}
    campos.forEach((k) => { if (e[k] !== undefined) ficha[k] = e[k] })
    Object.assign(ficha, cambios)
    const { error } = await quien.db.from('exercise_overrides').upsert(
      { coach_id: quien.id, exercise_id: e.id, data: ficha, updated_at: new Date().toISOString() },
      { onConflict: 'coach_id,exercise_id' },
    )
    if (error) throw new Error(error.message)
    return respuesta({ listo: true, ejercicio: ficha.name, nota: 'Es un ejercicio de la app: se guardó tu versión. El original no cambia.' })
  }))

  server.registerTool('borrar_ejercicio', {
    title: 'Borrar un ejercicio',
    description: esMaster ? 'Borra un ejercicio del repertorio.' : 'Borra un ejercicio tuyo. Los de la app no se pueden borrar.',
    inputSchema: { ejercicio: z.string().describe('Nombre exacto o id.'), confirmado: z.boolean().optional().describe(TEXTO_CONFIRMADO_BORRAR), },
    annotations: BORRA,
  }, seguro(async ({ ejercicio, confirmado }: any) => {
    const { filas } = await repertorioConFicha(quien)
    const e = filas.find((f) => f.id === ejercicio) ?? filas.find((f) => mismoTexto(f.name, ejercicio))
    if (!e) throw new Aviso(`No encontré "${ejercicio}".`)
    if (e.created_by !== quien.id && !esMaster) throw new Aviso(`"${e.name}" es de la app: no se puede borrar.`)
    const antes = sinConfirmarBorrado(confirmado, `Se borrará el ejercicio "${e.name}" (y sus videos). No se puede deshacer.`)
    if (antes) return antes
    const { data, error } = await quien.db.from('exercises').delete().eq('id', e.id).select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) throw new Aviso('No tienes permiso para borrar ese ejercicio.')
    return respuesta({ listo: true, ejercicio_borrado: e.name })
  }))

  server.registerTool('crear_categoria', {
    title: 'Crear una categoría de ejercicios',
    description: 'Crea una categoría propia para tus ejercicios.',
    inputSchema: { nombre: z.string() },
    annotations: ESCRIBE,
  }, seguro(async ({ nombre }: any) => {
    const limpio = nombre.trim()
    const base = sinAcentos(limpio).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'categoria'
    const { count } = await quien.db.from('exercise_categories').select('id', { count: 'exact', head: true }).eq('created_by', quien.id)
    const colores = ['#FFA047', '#3DD9A0', '#5DA0FF', '#FF80B8', '#E8B400', '#00B8D9', '#9B6BFF', '#6C7A8A']
    const { error } = await quien.db.from('exercise_categories').insert({
      name: limpio,
      slug: `${base}-${Math.random().toString(36).slice(2, 6)}`,
      color: colores[(count ?? 0) % colores.length],
      sort_order: 100 + (count ?? 0),
      created_by: quien.id,
    })
    if (error) {
      if (error.code === '23505') throw new Aviso('Ya tienes una categoría con ese nombre.')
      throw new Error(error.message)
    }
    return respuesta({ listo: true, categoria: limpio })
  }))

  server.registerTool('borrar_categoria', {
    title: 'Borrar una categoría',
    description: 'Borra una categoría tuya. Sus ejercicios NO se borran: se quedan sin categoría.',
    inputSchema: { nombre: z.string(), confirmado: z.boolean().optional().describe(TEXTO_CONFIRMADO_BORRAR), },
    annotations: BORRA,
  }, seguro(async ({ nombre, confirmado }: any) => {
    const { data } = await quien.db.from('exercise_categories').select('id, name, created_by')
    const c = (data ?? []).find((x: any) => mismoTexto(x.name, nombre) && (x.created_by === quien.id || esMaster))
    if (!c) throw new Aviso(`No tienes una categoría "${nombre}" que se pueda borrar.`)
    const antes = sinConfirmarBorrado(confirmado, `Se borrará la categoría "${c.name}". Sus ejercicios no se borran: se quedan sin categoría.`)
    if (antes) return antes
    const { error } = await quien.db.from('exercise_categories').delete().eq('id', c.id)
    if (error) throw new Error(error.message)
    return respuesta({ listo: true, categoria_borrada: c.name })
  }))

  server.registerTool('crear_tipo_de_sesion', {
    title: 'Crear un tipo de sesión',
    description: 'Crea un tipo de sesión propio (ej.: "Vinyasa", "Fisio"), con su color, para usarlo en tus planes.',
    inputSchema: { nombre: z.string(), color: z.string().optional().describe('Hex. Si no, uno de la paleta.') },
    annotations: ESCRIBE,
  }, seguro(async ({ nombre, color }: any) => {
    const { count } = await quien.db.from('session_types').select('id', { count: 'exact', head: true }).eq('coach_id', quien.id)
    // Con ícono, igual que en la app: el que mejor le va al nombre («Boxeo» → boxeo); si nada se parece, la etiqueta neutra (null).
    const catalogo = await cargaCatalogo().catch(() => null)
    const icono = catalogo ? sugiereIcono(catalogo, nombre) : null
    const { error } = await quien.db.from('session_types').insert({
      nombre: nombre.trim(),
      color: color || COLORES_TIPO[(count ?? 0) % COLORES_TIPO.length],
      icono,
      coach_id: quien.id,
    })
    if (error) throw new Error(error.message)
    return respuesta({ listo: true, tipo_de_sesion: nombre.trim() })
  }))

  server.registerTool('borrar_tipo_de_sesion', {
    title: 'Borrar un tipo de sesión',
    description: 'Borra un tipo de sesión propio. Las sesiones que ya lo usan no cambian.',
    inputSchema: { nombre: z.string(), confirmado: z.boolean().optional().describe(TEXTO_CONFIRMADO_BORRAR), },
    annotations: BORRA,
  }, seguro(async ({ nombre, confirmado }: any) => {
    const { data } = await quien.db.from('session_types').select('id, nombre').eq('coach_id', quien.id)
    const t = (data ?? []).find((x: any) => mismoTexto(x.nombre, nombre))
    if (!t) throw new Aviso(`No tienes un tipo de sesión "${nombre}".`)
    const antes = sinConfirmarBorrado(confirmado, `Se borrará el tipo de sesión "${t.nombre}". Las sesiones que ya lo usan no cambian.`)
    if (antes) return antes
    const { error } = await quien.db.from('session_types').delete().eq('id', t.id)
    if (error) throw new Error(error.message)
    return respuesta({ listo: true, tipo_borrado: t.nombre })
  }))
}

