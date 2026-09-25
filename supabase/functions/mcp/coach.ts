// deno-lint-ignore-file no-explicit-any
import type { McpServer } from 'npm:@modelcontextprotocol/sdk@1.30.1/server/mcp.js'
import { z } from 'npm:zod@^4.1.13'
import { APP_URL } from './config.ts'
import { llamarFuncion, type Quien } from './sesion.ts'
import {
  Aviso, buscarPersona, diaDesdeTexto, fechaDelAtleta, mismoTexto, NOMBRE_DIA, nombreDe, respuesta, seguro, sinAcentos,
  type Dia, type Persona,
} from './util.ts'
import {
  buscarFase, buscarSemana, describirDia, describirSemana, diaDesdeEntrada, faseNueva, fasesDe, guardarFases,
  idDeSesion, nombreDelDia, planActivo, repertorioVisible, resumenDelPlan, semanaNueva, siguienteNumFase,
  siguienteNumSemana, tipoDePlan, normalizar, type Plan, type SesionEntrada,
} from './plan.ts'
import { estadoDe, ubicarDia } from './atleta.ts'
import { repertorioConFicha } from './comunes.ts'
import { dondeVa, historialDePeso } from './app/training-utils.js'
import { desdeKilos } from './app/unidades.js'
import { COLORES_TIPO } from './app/theme.js'

const SOLO_LEER = { readOnlyHint: true, openWorldHint: false } as const
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

async function planDe(quien: Quien, ref: string): Promise<{ persona: Persona; plan: Plan }> {
  const persona = await buscarPersona(quien, ref)
  const plan = await planActivo(quien, persona.id)
  if (!plan) throw new Aviso(`${nombreDe(persona)} todavía no tiene plan. Puedes crearle uno con crear_plan.`)
  return { persona, plan }
}

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

export function herramientasDelCoach(server: McpServer, quien: Quien) {
  const esMaster = quien.rol === 'master'

  /* ================================================================ */
  /* LEER                                                               */
  /* ================================================================ */

  server.registerTool('listar_atletas', {
    title: 'Listar mis atletas',
    description: esMaster
      ? 'Todos los atletas de Training Lab, con su coach, su plan, en qué va cada uno, cuándo abrió la app por última vez y cuántas sesiones hizo en los últimos 7 días. Marca los que aún no activan su cuenta.'
      : 'Tus atletas, con su plan, en qué va cada uno, cuándo abrió la app por última vez y cuántas sesiones hizo en los últimos 7 días. Marca los que aún no activan su cuenta.',
    inputSchema: { incluir_desactivados: z.boolean().optional().describe('También los desactivados. No, si no se dice.') },
    annotations: SOLO_LEER,
  }, seguro(async ({ incluir_desactivados }: any) => {
    const db = quien.db
    const [perfiles, planes, estados, invitaciones, coaches] = await Promise.all([
      db.from('profiles').select('id, username, full_name, coach_id, is_active, created_at').eq('role', 'user').order('full_name'),
      db.from('plans').select('user_id, title, data').eq('status', 'active'),
      db.from('user_app_state').select('user_id, updated_at, data'),
      db.from('invitaciones').select('atleta_id').is('usada_en', null).not('atleta_id', 'is', null),
      esMaster ? db.from('profiles').select('id, username, full_name').eq('role', 'admin') : Promise.resolve({ data: [] }),
    ])
    if (perfiles.error) throw new Error(perfiles.error.message)
    const planDeId = new Map((planes.data ?? []).map((p: any) => [p.user_id, p]))
    const estadoDeId = new Map((estados.data ?? []).map((s: any) => [s.user_id, s]))
    const pendientes = new Set((invitaciones.data ?? []).map((i: any) => i.atleta_id))
    const coachDeId = new Map((coaches.data ?? []).map((c: any) => [c.id, c.full_name || c.username]))
    const hoy = fechaDelAtleta()
    const hace7 = Date.now() - 7 * 86400000

    const atletas = (perfiles.data ?? [])
      .filter((p: any) => incluir_desactivados || p.is_active)
      .map((p: any) => {
        const plan = planDeId.get(p.id) as Plan | undefined
        const estado = (estadoDeId.get(p.id) as any)?.data ?? {}
        let vaEn = null
        if (plan) {
          const aqui = dondeVa(fasesDe(plan), tipoDePlan(plan), estado['wr:cursor'], hoy.date)
          const fase = fasesDe(plan).find((f) => f.id === aqui?.faseId)
          vaEn = aqui ? `${fase?.name ?? ''} · semana ${aqui.semana}` : null
        }
        const hechas7 = Object.values(estado['wr:sessions'] ?? {})
          .filter((s: any) => s?.completed && s.completedAt && Date.parse(s.completedAt) >= hace7).length
        return {
          nombre: p.full_name || p.username,
          usuario: p.username,
          estado: !p.is_active ? 'desactivado' : pendientes.has(p.id) ? 'aún no activa su cuenta' : 'activo',
          ...(esMaster ? { coach: coachDeId.get(p.coach_id) ?? 'sin coach' } : {}),
          plan: plan ? plan.title : null,
          ...(vaEn ? { va_en: vaEn } : {}),
          ultima_vez_en_la_app: (estadoDeId.get(p.id) as any)?.updated_at ?? null,
          sesiones_ultimos_7_dias: hechas7,
        }
      })
    return respuesta({ total: atletas.length, atletas })
  }))

  server.registerTool('ver_atleta', {
    title: 'Ver un atleta',
    description: 'Todo de un atleta: su plan y en qué va, sus últimas sesiones hechas con lo que anotó, su bienestar de los últimos días, sus 1RM y, si aún no activa su cuenta, su link de invitación.',
    inputSchema: { atleta: ATLETA },
    annotations: SOLO_LEER,
  }, seguro(async ({ atleta }: any) => {
    const persona = await buscarPersona(quien, atleta)
    const [plan, estado, invitacion] = await Promise.all([
      planActivo(quien, persona.id),
      estadoDe(quien, persona.id),
      quien.db.from('invitaciones').select('token').eq('atleta_id', persona.id).is('usada_en', null).maybeSingle(),
    ])
    const hoy = fechaDelAtleta()
    const registros = estado['wr:sessions'] ?? {}
    const ultimas = Object.entries(registros)
      .filter(([, s]: any) => s?.completed)
      .sort(([, a]: any, [, b]: any) => String(b.completedAt ?? '').localeCompare(String(a.completedAt ?? '')))
      .slice(0, 5)
      .map(([llave, s]: any) => ({ ...diaDeLlave(plan, llave), hecha_el: s.completedAt ?? null, ...(s.notes ? { notas: s.notes } : {}) }))
    return respuesta({
      nombre: nombreDe(persona),
      usuario: persona.username,
      cuenta: !persona.is_active ? 'desactivada' : invitacion.data ? 'aún no la activa' : 'activa',
      ...(invitacion.data ? { link_de_invitacion: `${APP_URL}/?invitacion=${encodeURIComponent(invitacion.data.token)}` } : {}),
      unidad_de_peso: persona.unidad_peso === 'lb' ? 'lb' : 'kg',
      plan: plan ? resumenDelPlan(plan, estado['wr:cursor'], hoy.date) : null,
      ultimas_sesiones_hechas: ultimas,
      bienestar_reciente: Object.entries(estado['wr:wellness'] ?? {}).sort(([a], [b]) => (a < b ? 1 : -1)).slice(0, 7)
        .map(([fecha, v]: any) => ({ fecha, ...v })),
      un_rm_kg: estado['wr:onerm'] ?? {},
    })
  }))

  server.registerTool('ver_plan_de_atleta', {
    title: 'Ver el plan de un atleta',
    description: 'El plan de un atleta. Sin fase: el resumen (fases, semanas, qué sesión hay cada día y dónde va). Con fase y semana: el detalle completo de esa semana, ejercicio por ejercicio, listo para editarlo. Úsala SIEMPRE antes de cambiar un plan.',
    inputSchema: {
      atleta: ATLETA,
      fase: FASE,
      semana: z.number().int().optional().describe('Número de semana. Si hay fase y no semana, la primera.'),
    },
    annotations: SOLO_LEER,
  }, seguro(async ({ atleta, fase, semana }: any) => {
    const { persona, plan } = await planDe(quien, atleta)
    const estado = await estadoDe(quien, persona.id)
    const fases = fasesDe(plan)
    if (fase == null && semana == null && tipoDePlan(plan) !== 'weekly') {
      const hoy = fechaDelAtleta()
      return respuesta({
        atleta: nombreDe(persona),
        ...resumenDelPlan(plan, estado['wr:cursor'], hoy.date),
        semanas_por_fase: fases.map((f) => ({
          fase: f.name,
          semanas: (f.weekData ?? []).map((w: any) => ({
            semana: w.num,
            ...(w.label ? { nombre: w.label } : {}),
            ...(w.load ? { carga: w.load } : {}),
            dias: describirSemana(w).map((d: any) => `${d.dia} ${d.sesion}`),
          })),
        })),
      })
    }
    const fIdx = buscarFase(plan, fase)
    const f = fases[fIdx]
    const sIdx = semana != null ? buscarSemana(f, semana) : 0
    const w = f.weekData[sIdx]
    return respuesta({
      atleta: nombreDe(persona),
      plan: plan.title,
      fase: { n: fIdx + 1, nombre: f.name, subtitulo: f.fullName || undefined, enfoque: f.focus || undefined, objetivo: f.objective || undefined, color: f.color },
      semana: { num: w.num, nombre: w.label || undefined, carga: w.load || undefined },
      semanas_de_la_fase: f.weekData.map((x: any) => x.num),
      dias: (w.days ?? []).map((_: any, i: number) => describirDia(f, w, i)),
    })
  }))

  server.registerTool('ver_dia_de_atleta', {
    title: 'Ver el día de un atleta',
    description: 'La sesión de un atleta en un día, con lo que anotó (pesos y lo que hizo) y si la marcó como hecha. Sin fecha ni día, la de HOY con la misma cuenta que su app.',
    inputSchema: {
      atleta: ATLETA,
      fecha: z.string().optional().describe('AAAA-MM-DD'),
      fase: FASE,
      semana: z.number().int().optional(),
      dia: z.string().optional().describe('lunes … domingo'),
    },
    annotations: SOLO_LEER,
  }, seguro(async ({ atleta, ...args }: any) => {
    const { persona, plan } = await planDe(quien, atleta)
    const estado = await estadoDe(quien, persona.id)
    const u = ubicarDia(plan, estado['wr:cursor'], args)
    const registros = estado['wr:sessions'] ?? {}
    if (!u.entradas.length) {
      return respuesta({ atleta: nombreDe(persona), fecha: u.fecha.texto, mensaje: `Ese día (${NOMBRE_DIA[u.dia]}) no tiene sesión.` })
    }
    return respuesta({
      atleta: nombreDe(persona),
      fecha: u.fecha.texto,
      sesiones: u.entradas.map((i) => describirDia(u.fase, u.semana, i, registros[idDeSesion(plan, u.fase, u.semana, i, u.fecha.date)])),
    })
  }))

  server.registerTool('ver_registros_de_atleta', {
    title: 'Ver los registros de un atleta',
    description: 'Lo que un atleta ha anotado. Con "ejercicio": todos sus pesos en ese ejercicio, en orden, para ver su progreso. Sin "ejercicio": sus últimas sesiones hechas con lo anotado en cada ejercicio.',
    inputSchema: {
      atleta: ATLETA,
      ejercicio: z.string().optional().describe('Nombre del ejercicio tal como está en su plan.'),
      ultimas: z.number().int().min(1).max(40).optional().describe('Cuántas sesiones. 10 si no se dice.'),
    },
    annotations: SOLO_LEER,
  }, seguro(async ({ atleta, ejercicio, ultimas }: any) => {
    const persona = await buscarPersona(quien, atleta)
    const [plan, estado] = await Promise.all([planActivo(quien, persona.id), estadoDe(quien, persona.id)])
    const registros = estado['wr:sessions'] ?? {}
    const u = quien.unidad
    if (ejercicio) {
      const hist = historialDePeso(fasesDe(plan), registros, ejercicio, tipoDePlan(plan))
      if (!hist.length) throw new Aviso(`${nombreDe(persona)} no tiene pesos anotados en "${ejercicio}".`)
      return respuesta({
        atleta: nombreDe(persona), ejercicio, unidad: u,
        registros: hist.map((h: any) => ({ peso: desdeKilos(h.kilos, u), cuando: h.cuando, donde: h.donde })),
      })
    }
    const sesiones = Object.entries(registros)
      .filter(([, s]: any) => s?.completed || Object.keys(s?.exercises ?? {}).length)
      .sort(([, a]: any, [, b]: any) => String(b.completedAt ?? '').localeCompare(String(a.completedAt ?? '')))
      .slice(0, ultimas ?? 10)
      .map(([llave, s]: any) => {
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
    description: 'Las versiones anteriores del plan de un atleta: cuándo cambió, quién lo cambió y si fue desde una IA. Cada una se puede recuperar con deshacer_cambio_del_plan.',
    inputSchema: { atleta: ATLETA },
    annotations: SOLO_LEER,
  }, seguro(async ({ atleta }: any) => {
    const persona = await buscarPersona(quien, atleta)
    const { data, error } = await quien.db
      .from('plan_versiones').select('id, title, creada_en, cambiada_por, cliente_ia, motivo')
      .eq('user_id', persona.id).order('creada_en', { ascending: false }).limit(20)
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
    },
    annotations: { ...ESCRIBE, destructiveHint: true },
  }, seguro(async ({ atleta, titulo, tipo, sesiones, fases, reemplazar }: any) => {
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
    const existente = await planActivo(quien, persona.id)
    if (existente && !reemplazar) {
      throw new Aviso(`${nombreDe(persona)} ya tiene el plan "${existente.title}". Para reemplazarlo manda reemplazar: true (el anterior queda en el historial). Para cambiar partes, usa editar_dia, agregar_semanas, etc.`)
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
        title: titulo,
        status: 'active',
        data: { kind, phases: normalizar(nuevas) },
        created_by: quien.id,
      })
      if (error) {
        if (/row-level security|permission/i.test(error.message)) throw new Aviso(`No puedes crearle plan a ${nombreDe(persona)}: no es tu atleta.`)
        throw new Error(error.message)
      }
    }
    const semanas = nuevas.reduce((s, f) => s + f.weekData.length, 0)
    return respuesta({
      listo: true,
      atleta: nombreDe(persona),
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
    },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, fase, semana, dia, sesiones }: any) => {
    const { persona, plan } = await planDe(quien, atleta)
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
    },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, fase, de_semana, a_semanas }: any) => {
    const { persona, plan } = await planDe(quien, atleta)
    const fases = structuredClone(fasesDe(plan))
    const f = fases[buscarFase(plan, fase)]
    const origen = f.weekData[buscarSemana(f, de_semana)]
    const destinos = a_semanas === 'todas'
      ? f.weekData.filter((w: any) => w.num !== origen.num)
      : a_semanas.map((n: number) => f.weekData[buscarSemana(f, n)])
    destinos.forEach((w: any) => { w.days = structuredClone(origen.days) })
    await guardarFases(quien, plan, fases)
    return respuesta({ listo: true, atleta: nombreDe(persona), fase: f.name, copiada: origen.num, a: destinos.map((w: any) => w.num) })
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
    },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, fase, cuantas, copiar_de, nombre, carga }: any) => {
    const { persona, plan } = await planDe(quien, atleta)
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
    return respuesta({ listo: true, atleta: nombreDe(persona), fase: f.name, semanas_nuevas: nuevas, ...(molde ? { copia_de: molde.num } : {}) })
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
    },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, fase, semana, nombre, carga }: any) => {
    const { persona, plan } = await planDe(quien, atleta)
    const fases = structuredClone(fasesDe(plan))
    const f = fases[buscarFase(plan, fase)]
    const w = f.weekData[buscarSemana(f, semana)]
    if (nombre !== undefined) w.label = nombre
    if (carga !== undefined) w.load = carga
    await guardarFases(quien, plan, fases)
    return respuesta({ listo: true, atleta: nombreDe(persona), fase: f.name, semana: w.num, nombre: w.label, carga: w.load })
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
    },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, nombre, subtitulo, enfoque, objetivo, color, semanas, copiar_semanas_de, despues_de }: any) => {
    const { persona, plan } = await planDe(quien, atleta)
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
    return respuesta({ listo: true, atleta: nombreDe(persona), fase_nueva: nueva.name, posicion: pos + 1, semanas: nueva.weekData.length })
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
    },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, fase, nombre, subtitulo, enfoque, objetivo, color, mover_a_posicion }: any) => {
    const { persona, plan } = await planDe(quien, atleta)
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
    return respuesta({ listo: true, atleta: nombreDe(persona), fase: f.name, posicion: fases.indexOf(f) + 1 })
  }))

  server.registerTool('cambiar_titulo_del_plan', {
    title: 'Cambiar el título del plan',
    description: 'Cambia el título del plan de un atleta.',
    inputSchema: { atleta: ATLETA, titulo: z.string() },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, titulo }: any) => {
    const { persona, plan } = await planDe(quien, atleta)
    await guardarFases(quien, plan, structuredClone(fasesDe(plan)), titulo)
    return respuesta({ listo: true, atleta: nombreDe(persona), titulo })
  }))

  server.registerTool('deshacer_cambio_del_plan', {
    title: 'Deshacer un cambio del plan',
    description: 'Regresa el plan de un atleta a como estaba antes del último cambio, o a una versión del historial (ver_historial_del_plan). También recupera un plan borrado. Deshacer también queda en el historial: se puede rehacer.',
    inputSchema: {
      atleta: ATLETA,
      version: z.string().optional().describe('El id de una versión del historial. Si no se da, la más reciente.'),
    },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, version }: any) => {
    const persona = await buscarPersona(quien, atleta)
    let id = version
    if (!id) {
      const { data } = await quien.db.from('plan_versiones').select('id').eq('user_id', persona.id)
        .order('creada_en', { ascending: false }).limit(1).maybeSingle()
      if (!data) throw new Aviso(`El plan de ${nombreDe(persona)} no tiene cambios anteriores guardados.`)
      id = data.id
    }
    const { data: v } = await quien.db.from('plan_versiones').select('title, creada_en, user_id').eq('id', id).maybeSingle()
    if (!v || v.user_id !== persona.id) throw new Aviso('Esa versión no es de este atleta.')
    const { error } = await quien.db.rpc('regresar_plan_a_version', { p_version: id })
    if (error) throw new Aviso(error.message)
    return respuesta({ listo: true, atleta: nombreDe(persona), plan: v.title, regreso_a: `como estaba antes del cambio del ${v.creada_en}` })
  }))

  server.registerTool('quitar_semana', {
    title: 'Quitar una semana',
    description: 'Quita una semana de una fase, con todas sus sesiones. Se puede recuperar con deshacer_cambio_del_plan.',
    inputSchema: { atleta: ATLETA, fase: FASE, semana: z.number().int() },
    annotations: BORRA,
  }, seguro(async ({ atleta, fase, semana }: any) => {
    const { persona, plan } = await planDe(quien, atleta)
    const fases = structuredClone(fasesDe(plan))
    const f = fases[buscarFase(plan, fase)]
    if (f.weekData.length <= 1) throw new Aviso('Es la única semana de la fase. Para quitar la fase entera usa quitar_fase.')
    const i = buscarSemana(f, semana)
    f.weekData.splice(i, 1)
    await guardarFases(quien, plan, fases)
    return respuesta({ listo: true, atleta: nombreDe(persona), fase: f.name, semana_quitada: semana, deshacer: 'deshacer_cambio_del_plan la regresa.' })
  }))

  server.registerTool('quitar_fase', {
    title: 'Quitar una fase',
    description: 'Quita una fase entera del plan, con todas sus semanas y sesiones. Se puede recuperar con deshacer_cambio_del_plan.',
    inputSchema: { atleta: ATLETA, fase: z.union([z.string(), z.number()]) },
    annotations: BORRA,
  }, seguro(async ({ atleta, fase }: any) => {
    const { persona, plan } = await planDe(quien, atleta)
    const fases = structuredClone(fasesDe(plan))
    if (fases.length <= 1) throw new Aviso('Es la única fase del plan. Para quitar todo usa borrar_plan.')
    const i = buscarFase(plan, fase)
    const [quitada] = fases.splice(i, 1)
    await guardarFases(quien, plan, fases)
    return respuesta({ listo: true, atleta: nombreDe(persona), fase_quitada: quitada.name, deshacer: 'deshacer_cambio_del_plan la regresa.' })
  }))

  server.registerTool('borrar_plan', {
    title: 'Borrar el plan de un atleta',
    description: 'Borra el plan activo de un atleta. Sus registros (pesos, sesiones hechas) no se borran. El plan queda en el historial y se puede recuperar con deshacer_cambio_del_plan.',
    inputSchema: { atleta: ATLETA },
    annotations: BORRA,
  }, seguro(async ({ atleta }: any) => {
    const { persona, plan } = await planDe(quien, atleta)
    const { data, error } = await quien.db.from('plans').delete().eq('id', plan.id).select('id')
    if (error) throw new Error(error.message)
    if (!data?.length) throw new Aviso('No tienes permiso para borrar este plan.')
    return respuesta({ listo: true, atleta: nombreDe(persona), plan_borrado: plan.title, recuperar: 'deshacer_cambio_del_plan lo recupera.' })
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
    },
    annotations: ESCRIBE,
  }, seguro(async ({ nombre, tipo, atleta, fase, semana, dia }: any) => {
    const { plan } = await planDe(quien, atleta)
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
    },
    annotations: ESCRIBE,
  }, seguro(async ({ plantilla, atleta, fase, semana, dia, agregar }: any) => {
    const { data: todas } = await quien.db.from('routine_templates').select('id, name, kind, data').eq('created_by', quien.id)
    const t = (todas ?? []).find((x: any) => x.id === plantilla) ?? (todas ?? []).find((x: any) => mismoTexto(x.name, plantilla))
    if (!t) throw new Aviso(`No encontré la plantilla "${plantilla}". Mira tus plantillas con ver_catalogos.`)
    const { persona, plan } = await planDe(quien, atleta)
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
    return respuesta({ listo: true, atleta: nombreDe(persona), plantilla: t.name, en: `${f.name} · semana ${w.num}${dia ? ` · ${dia}` : ''}` })
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

