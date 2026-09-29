// deno-lint-ignore-file no-explicit-any
import type { McpServer } from 'npm:@modelcontextprotocol/sdk@1.30.1/server/mcp.js'
import { z } from 'npm:zod@^4.1.13'
import { APP_URL } from './config.ts'
import { llamarFuncion, type Quien } from './sesion.ts'
import {
  Aviso, buscarPersona, diaDesdeTexto, fechaDelAtleta, fechaLarga, mismoTexto, NOMBRE_DIA, nombreCorto, nombreDe, palabrasDe,
  respuesta, rolDeOficio, seguro, sinAcentos, type Dia, type Persona,
} from './util.ts'
import {
  buscarFase, buscarSemana, conEquipo, describirDia, describirSemana, diaDesdeEntrada, elegirPrograma, equipoDe, faseNueva,
  fasesDe, guardarFases, idDeSesion, miProgramaCon, nombreDelDia, planesActivos, programaQueEdito, planQueEdito,
  repertorioVisible, resumenDelPlan, semanaNueva, siguienteNumFase, siguienteNumSemana, tipoDePlan, normalizar, claveDeRegistro,
  type Miembro, type Plan, type Programa, type SesionEntrada,
} from './plan.ts'
import { cursorDe, estadoDe, registrosDe, ubicarEnTodos } from './atleta.ts'
import { repertorioConFicha } from './comunes.ts'
import { dondeVa, historialDePeso } from './app/training-utils.js'
import { desdeKilos } from './app/unidades.js'
import { COLORES_TIPO } from './app/theme.js'

const SOLO_LEER = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const
const ESCRIBE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const
const BORRA = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false } as const

/* ------------------------------------------------------------------ */
/* Esquemas que repiten varias herramientas                            */
/* ------------------------------------------------------------------ */

const ATLETA = z.string().describe('El atleta: su usuario (@juan), su nombre o su id.')
const FASE = z.union([z.string(), z.number()]).optional()
  .describe('La fase: su número (1, 2…) o su nombre. En una rutina que se repite no hace falta.')

const EJERCICIO = z.object({
  nombre: z.string().optional().describe('Nombre del ejercicio. Si es del repertorio, escríbelo EXACTO para que se ligue a su ficha y su video.'),
  nota: z.string().optional().describe('En vez de un ejercicio, una nota o separador (ej.: "Calentamiento"). Sin nombre.'),
  series: z.union([z.number(), z.string()]).optional().describe('Series; si va en grupo, las vueltas del grupo. 3 si no se dice.'),
  cantidad: z.union([z.number(), z.string()]).optional().describe('Cuánto por serie: "8-10", 12, 30… La unidad va aparte.'),
  unidad: z.enum(['reps', 'seg', 'min', 'm', 'km', 'yd', 'cal']).optional().describe('reps si no se dice.'),
  intensidad: z.string().optional().describe('Ej.: "RIR 2", "75%", "RPE 8".'),
  descanso: z.string().optional().describe('Ej.: "90 s", "2 min".'),
  notas: z.string().optional(),
  indicaciones: z.string().optional().describe('Claves técnicas para el atleta.'),
  lleva_peso: z.boolean().optional().describe('Si el atleta anota peso aquí. Si no se dice, la app lo deduce del nombre.'),
  grupo: z.number().int().optional().describe('Ejercicios SEGUIDOS con el mismo número van en superserie o circuito.'),
})

const SESION = {
  nombre: z.string().optional().describe('Nombre de la sesión, ej.: "Tren inferior — fuerza".'),
  tipo: z.string().optional().describe('gym, neural, recovery, cancha, tests, equipo, correr, bici, natación, yoga, movilidad, terapia, clase, off (descanso), o uno propio.'),
  ejercicios: z.array(EJERCICIO).optional(),
}
const SESION_CON_DIA = z.object({ dia: z.string().describe('lunes … domingo'), ...SESION })

/* ------------------------------------------------------------------ */
/* Ayudas                                                              */
/* ------------------------------------------------------------------ */

/**
 * El plan de un atleta que ESTA persona cambia: el suyo (ver `planQueEdito`).
 * `programa` viene solo si es el de un profesional del equipo: así el master,
 * que puede elegir con `de`, ve en la respuesta cuál cambió.
 */
async function planDe(quien: Quien, ref: string, de?: string | null): Promise<{ persona: Persona; plan: Plan; programa: { programa?: string } }> {
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

/** Arma los días de una semana a partir de sesiones con su día. */
function diasDesde(sesiones: any[], repertorio: any[], sinFicha: Set<string>) {
  return (sesiones ?? []).map((s) => {
    const { dia, sinFicha: faltan } = diaDesdeEntrada(diaDesdeTexto(s.dia), s as SesionEntrada, repertorio)
    faltan.forEach((f) => sinFicha.add(f))
    return dia
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
  ? { sin_ficha: [...sinFicha], nota_sin_ficha: 'Estos ejercicios no están en el repertorio: se guardaron con su nombre, pero sin video. Si existen con otro nombre, búscalos con buscar_ejercicios y corrígelos.' }
  : {})

/** Para LEER: solo el programa de un profesional del equipo del atleta. */
const DE_LEER = z.string().optional()
  .describe('Si el atleta tiene un equipo (su coach y otros profesionales, como un fisio), cada uno con su programa: de cuál, con su nombre, "coach" o "fisio". Sin esto, todos juntos.')

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
    description: 'Todo de un atleta: su plan y en qué va, sus últimas sesiones hechas con lo que anotó, su bienestar de los últimos días, sus 1RM y, si aún no activa su cuenta, su link de invitación. Si el atleta tiene un equipo (su coach y otros profesionales, como un fisio), da los programas de todos juntos, cada uno con de quién es, y quién está en su equipo; con "de", solo el de uno. Nunca trae notas de consulta.',
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
      return respuesta({ ...base, plan: resumenDe(pr), ultimas_sesiones_hechas: ultimasDe(pr), ...compartido })
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
      semana: z.number().int().optional().describe('Número de semana. Si hay fase y no semana, la primera.'),
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

  server.registerTool('ver_dia_de_atleta', {
    title: 'Ver el día de un atleta',
    description: 'La sesión de un atleta en un día, con lo que anotó (pesos y lo que hizo) y si la marcó como hecha. Sin fecha ni día, la de HOY con la misma cuenta que su app. Si el atleta tiene un equipo (su coach y otros profesionales, como un fisio), trae las sesiones de todos, cada una con de quién es; con "de", solo las de uno.',
    inputSchema: {
      atleta: ATLETA,
      fecha: z.string().optional().describe('AAAA-MM-DD'),
      fase: FASE,
      semana: z.number().int().optional(),
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
      ultimas: z.number().int().min(1).max(40).optional().describe('Cuántas sesiones. 10 si no se dice.'),
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
    description: 'Tus catálogos: las categorías de ejercicio, tus tipos de sesión propios y tus plantillas de día y de semana.',
    inputSchema: {},
    annotations: SOLO_LEER,
  }, seguro(async () => {
    const { data: masterId } = await quien.db.rpc('master_id')
    const [cats, tipos, plantillas] = await Promise.all([
      quien.db.from('exercise_categories').select('id, name, created_by').order('sort_order'),
      quien.db.from('session_types').select('nombre, color').eq('coach_id', quien.id).order('nombre'),
      quien.db.from('routine_templates').select('id, name, kind, updated_at').eq('created_by', quien.id).order('updated_at', { ascending: false }),
    ])
    return respuesta({
      categorias: (cats.data ?? [])
        .filter((c: any) => esMaster || !c.created_by || c.created_by === masterId || c.created_by === quien.id)
        .map((c: any) => ({ nombre: c.name, propia: c.created_by === quien.id })),
      tipos_de_sesion_propios: tipos.data ?? [],
      tipos_de_sesion_de_la_app: ['Gym', 'Neural', 'Recovery', 'Cancha', 'Tests', 'Equipo', 'Correr', 'Bici', 'Natación', 'Yoga', 'Movilidad', 'Terapia', 'Clase', 'OFF'],
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
    description: 'Crea el plan de un atleta. Dos tipos: "rutina" (una semana que se repite siempre; manda "sesiones") o "fases" (manda "fases", cada una con sus semanas y cada semana con sus sesiones). Cada sesión lleva su día. Para no repetir semanas iguales: crea la primera y luego usa agregar_semanas con copiar_de. Si el atleta ya tiene plan, falla, salvo con reemplazar: true (el plan anterior queda en el historial y se puede recuperar).',
    inputSchema: {
      atleta: ATLETA,
      titulo: z.string().describe('Título del plan.'),
      tipo: z.enum(['rutina', 'fases']),
      sesiones: z.array(SESION_CON_DIA).optional().describe('Solo para "rutina": las sesiones de la semana que se repite.'),
      fases: z.array(z.object({
        nombre: z.string(),
        subtitulo: z.string().optional(),
        enfoque: z.string().optional().describe('El enfoque en una línea.'),
        objetivo: z.string().optional(),
        color: z.string().optional().describe('Color en hex, ej. #3DD9A0.'),
        semanas: z.array(z.object({
          nombre: z.string().optional(),
          carga: z.string().optional().describe('Ej.: "4×10 al 65% · RIR 3".'),
          sesiones: z.array(SESION_CON_DIA),
        })).min(1),
      })).optional().describe('Solo para "fases".'),
      reemplazar: z.boolean().optional().describe('true para reemplazar el plan que ya tiene.'),
      ...PARAM_DE,
    },
    annotations: { ...ESCRIBE, destructiveHint: true },
  }, seguro(async ({ atleta, titulo, tipo, sesiones, fases, reemplazar, de }: any) => {
    const persona = await buscarPersona(quien, atleta)
    const repertorio = await repertorioVisible(quien)
    const sinFicha = new Set<string>()
    let nuevas: any[]
    if (tipo === 'rutina') {
      if (!sesiones?.length) throw new Aviso('Para una rutina manda "sesiones", cada una con su día.')
      const base = faseNueva(1, { nombre: 'Rutina semanal' })
      base.weekData = [{ ...semanaNueva(1), days: diasDesde(sesiones, repertorio, sinFicha) }]
      nuevas = [base]
    } else {
      if (!fases?.length) throw new Aviso('Para un programa por fases manda "fases", cada una con sus semanas.')
      nuevas = fases.map((f: any, i: number) => {
        const fase = faseNueva(i + 1, f)
        fase.weekData = f.semanas.map((w: any, j: number) => ({ ...semanaNueva(j + 1, w), days: diasDesde(w.sesiones, repertorio, sinFicha) }))
        return fase
      })
    }
    const kind = tipo === 'rutina' ? 'weekly' : 'periodized'
    // El programa de ESTA persona con este atleta: su coach principal, el principal; un profesional del equipo, el suyo.
    const { plan: existente, profesionalId, de: deProfesional } = await planQueEdito(quien, persona, de)
    if (existente && !reemplazar) {
      throw new Aviso(`${nombreDe(persona)} ya tiene ${profesionalId ? (profesionalId === quien.id ? 'un programa tuyo' : `un programa de ${deProfesional}`) : p('el plan')} "${existente.title}". Para reemplazarlo manda reemplazar: true (el anterior queda en el historial). Para cambiar partes, usa editar_dia, agregar_semanas, etc.`)
    }
    if (existente) {
      const { data, error } = await quien.db.from('plans')
        .update({ title: titulo, data: { kind, phases: normalizar(nuevas) }, updated_at: new Date().toISOString() })
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
        data: { kind, phases: normalizar(nuevas) },
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
      ...avisoSinFicha(sinFicha),
      mensaje: `Ya lo ve ${nombreDe(persona)} en su app.`,
    })
  }))

  server.registerTool('editar_dia', {
    title: 'Cambiar las sesiones de un día',
    description: 'Reemplaza TODAS las sesiones de un día de la semana, en una semana de una fase, por las que mandes. Para cambiar un solo ejercicio: lee el día con ver_plan_de_atleta, cámbialo y manda la sesión completa. "sesiones": [] deja el día sin sesión. En una rutina que se repite no hace falta fase ni semana.',
    inputSchema: {
      atleta: ATLETA,
      fase: FASE,
      semana: z.number().int().optional().describe('Número de semana. En una rutina no hace falta.'),
      dia: z.string().describe('lunes … domingo'),
      sesiones: z.array(z.object(SESION)).describe('Las sesiones de ese día. Normalmente una; dos si entrena mañana y tarde.'),
      ...PARAM_DE,
    },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, fase, semana, dia, sesiones, de }: any) => {
    const { persona, plan, programa } = await planDe(quien, atleta, de)
    const fases = structuredClone(fasesDe(plan))
    const fIdx = buscarFase(plan, fase)
    const sIdx = buscarSemana(fases[fIdx], tipoDePlan(plan) === 'weekly' ? (semana ?? fases[fIdx].weekData[0]?.num) : semana)
    const clave: Dia = diaDesdeTexto(dia)
    const repertorio = await repertorioVisible(quien)
    const sinFicha = new Set<string>()
    const nuevos = sesiones.map((s: any) => {
      const { dia: d, sinFicha: faltan } = diaDesdeEntrada(clave, s, repertorio)
      faltan.forEach((f) => sinFicha.add(f))
      return d
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
      ahora: nuevos.length ? nuevos.map((d: any) => `${d.name} (${d.exercises.filter((e: any) => !e.isNote).length} ejercicios)`) : 'sin sesión',
      ...avisoSinFicha(sinFicha),
      deshacer: 'Si no quedó bien: deshacer_cambio_del_plan.',
    })
  }))

  server.registerTool('copiar_semana', {
    title: 'Copiar una semana a otras',
    description: 'Copia todas las sesiones de una semana a otras semanas de la MISMA fase (las reemplaza). Útil para armar la semana 1 y repetirla.',
    inputSchema: {
      atleta: ATLETA,
      fase: FASE,
      de_semana: z.number().int().describe('La semana que se copia.'),
      a_semanas: z.union([z.array(z.number().int()), z.literal('todas')]).describe('Las semanas destino, o "todas" las demás de la fase.'),
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
      cuantas: z.number().int().min(1).max(20).optional().describe('1 si no se dice.'),
      copiar_de: z.number().int().optional().describe('Número de la semana que se copia en cada una.'),
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
      semana: z.number().int(),
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
      semanas: z.number().int().min(1).max(30).optional().describe('Cuántas semanas vacías. 1 si no se dice.'),
      copiar_semanas_de: z.union([z.string(), z.number()]).optional().describe('Fase de la que se copian todas las semanas.'),
      despues_de: z.union([z.string(), z.number()]).optional().describe('Fase después de la cual va. Al final si no se dice.'),
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
      fase: z.union([z.string(), z.number()]),
      nombre: z.string().optional(),
      subtitulo: z.string().optional(),
      enfoque: z.string().optional(),
      objetivo: z.string().optional(),
      color: z.string().optional(),
      mover_a_posicion: z.number().int().min(1).optional().describe('Nueva posición: 1 = primera.'),
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
    inputSchema: { atleta: ATLETA, fase: FASE, semana: z.number().int(), ...PARAM_DE },
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
    inputSchema: { atleta: ATLETA, fase: z.union([z.string(), z.number()]), ...PARAM_DE },
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
    inputSchema: { atleta: ATLETA, ...PARAM_DE },
    annotations: BORRA,
  }, seguro(async ({ atleta, de }: any) => {
    const { persona, plan, programa } = await planDe(quien, atleta, de)
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
    description: 'Guarda como plantilla, para reusarla con otros atletas, la sesión de un día (tipo "dia") o una semana entera (tipo "semana") del plan de un atleta.',
    inputSchema: {
      nombre: z.string().describe('Nombre de la plantilla.'),
      tipo: z.enum(['dia', 'semana']),
      atleta: ATLETA,
      fase: FASE,
      semana: z.number().int().optional(),
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
      data = { name: d.name, cat: d.cat, catNombre: d.catNombre ?? null, catColor: d.catColor ?? null, exercises: structuredClone(d.exercises ?? []) }
    }
    const { error } = await quien.db.from('routine_templates').insert({ name: nombre, kind: tipo === 'semana' ? 'week' : 'day', data, created_by: quien.id })
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
      semana: z.number().int().optional(),
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
      const nuevo = { day: clave, name: t.data?.name || t.name, cat: t.data?.cat || 'gym', catNombre: t.data?.catNombre ?? null, catColor: t.data?.catColor ?? null, exercises: structuredClone(t.data?.exercises ?? []) }
      w.days = agregar ? [...w.days, nuevo] : [...w.days.filter((d: any) => d.day !== clave), nuevo]
    }
    await guardarFases(quien, plan, fases)
    return respuesta({ listo: true, atleta: nombreDe(persona), ...programa, plantilla: t.name, en: `${f.name} · semana ${w.num}${dia ? ` · ${dia}` : ''}` })
  }))

  server.registerTool('borrar_plantilla', {
    title: 'Borrar una plantilla',
    description: 'Borra una de tus plantillas. Los planes donde ya se usó no cambian.',
    inputSchema: { plantilla: z.string().describe('Nombre o id.') },
    annotations: BORRA,
  }, seguro(async ({ plantilla }: any) => {
    const { data: todas } = await quien.db.from('routine_templates').select('id, name').eq('created_by', quien.id)
    const t = (todas ?? []).find((x: any) => x.id === plantilla) ?? (todas ?? []).find((x: any) => mismoTexto(x.name, plantilla))
    if (!t) throw new Aviso(`No encontré la plantilla "${plantilla}".`)
    const { error } = await quien.db.from('routine_templates').delete().eq('id', t.id)
    if (error) throw new Error(error.message)
    return respuesta({ listo: true, plantilla_borrada: t.name })
  }))

  /* ================================================================ */
  /* ATLETAS                                                            */
  /* ================================================================ */

  server.registerTool('agregar_atleta', {
    title: 'Agregar un atleta',
    description: 'Agrega un atleta con su nombre y apellido (sin correo) y devuelve su link de invitación. Desde ya aparece en tu lista y se le puede armar el plan; él o ella elige su usuario y contraseña al abrir el link. El link no caduca.',
    inputSchema: { nombre: z.string(), apellido: z.string() },
    annotations: ESCRIBE,
  }, seguro(async ({ nombre, apellido }: any) => {
    const r = await llamarFuncion(quien, 'invitar-atleta', { nombre, apellido })
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
  /* REPERTORIO                                                         */
  /* ================================================================ */

  async function categoriaPorNombre(nombre?: string) {
    if (!nombre) return null
    const { data } = await quien.db.from('exercise_categories').select('id, name, slug, created_by')
    const { data: masterId } = await quien.db.rpc('master_id')
    const visibles = (data ?? []).filter((c: any) => esMaster || !c.created_by || c.created_by === masterId || c.created_by === quien.id)
    const c = visibles.find((x: any) => mismoTexto(x.name, nombre) || mismoTexto(x.slug, nombre))
    if (!c) throw new Aviso(`No existe la categoría "${nombre}". Las que hay: ${visibles.map((x: any) => x.name).join(', ')}. Puedes crear una con crear_categoria.`)
    return c.id as string
  }

  const CAMPOS_EJERCICIO = {
    descripcion: z.string().optional(),
    categoria: z.string().optional().describe('Nombre de la categoría (ver_catalogos).'),
    equipo: z.string().optional().describe('Ej.: barra, mancuernas, banda, peso corporal.'),
    musculos_principales: z.array(z.string()).optional(),
    musculos_secundarios: z.array(z.string()).optional(),
    video: z.string().url().optional().describe('Liga de YouTube, TikTok, Instagram o Vimeo. Los videos grabados se suben en la app.'),
  }

  server.registerTool('crear_ejercicio', {
    title: 'Crear un ejercicio',
    description: 'Agrega un ejercicio a tu repertorio: nombre, categoría, equipo, músculos, descripción y, si quieres, una liga de video (YouTube, TikTok…). Grabar o subir un video se hace en la app.',
    inputSchema: { nombre: z.string(), ...CAMPOS_EJERCICIO },
    annotations: ESCRIBE,
  }, seguro(async (a: any) => {
    const repertorio = await repertorioVisible(quien)
    const ya = repertorio.find((r) => mismoTexto(r.name, a.nombre))
    if (ya) throw new Aviso(`Ya existe "${ya.name}" en el repertorio. Úsalo, o ponle otro nombre al nuevo.`)
    const { data, error } = await quien.db.from('exercises').insert({
      name: a.nombre.trim(),
      category_id: await categoriaPorNombre(a.categoria),
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
    const campos = ['name', 'description', 'category_id', 'cover_image_url', 'video_url', 'video_link', 'muscle_primary', 'muscle_secondary', 'equipment']
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
    inputSchema: { ejercicio: z.string().describe('Nombre exacto o id.') },
    annotations: BORRA,
  }, seguro(async ({ ejercicio }: any) => {
    const { filas } = await repertorioConFicha(quien)
    const e = filas.find((f) => f.id === ejercicio) ?? filas.find((f) => mismoTexto(f.name, ejercicio))
    if (!e) throw new Aviso(`No encontré "${ejercicio}".`)
    if (e.created_by !== quien.id && !esMaster) throw new Aviso(`"${e.name}" es de la app: no se puede borrar.`)
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
    inputSchema: { nombre: z.string() },
    annotations: BORRA,
  }, seguro(async ({ nombre }: any) => {
    const { data } = await quien.db.from('exercise_categories').select('id, name, created_by')
    const c = (data ?? []).find((x: any) => mismoTexto(x.name, nombre) && (x.created_by === quien.id || esMaster))
    if (!c) throw new Aviso(`No tienes una categoría "${nombre}" que se pueda borrar.`)
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
    const { error } = await quien.db.from('session_types').insert({
      nombre: nombre.trim(),
      color: color || COLORES_TIPO[(count ?? 0) % COLORES_TIPO.length],
      coach_id: quien.id,
    })
    if (error) throw new Error(error.message)
    return respuesta({ listo: true, tipo_de_sesion: nombre.trim() })
  }))

  server.registerTool('borrar_tipo_de_sesion', {
    title: 'Borrar un tipo de sesión',
    description: 'Borra un tipo de sesión propio. Las sesiones que ya lo usan no cambian.',
    inputSchema: { nombre: z.string() },
    annotations: BORRA,
  }, seguro(async ({ nombre }: any) => {
    const { data } = await quien.db.from('session_types').select('id, nombre').eq('coach_id', quien.id)
    const t = (data ?? []).find((x: any) => mismoTexto(x.nombre, nombre))
    if (!t) throw new Aviso(`No tienes un tipo de sesión "${nombre}".`)
    const { error } = await quien.db.from('session_types').delete().eq('id', t.id)
    if (error) throw new Error(error.message)
    return respuesta({ listo: true, tipo_borrado: t.nombre })
  }))
}

