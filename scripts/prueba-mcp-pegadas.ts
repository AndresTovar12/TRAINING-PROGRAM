// deno-lint-ignore-file no-explicit-any
// Prueba de las SESIONES PEGADAS en el conector de IA (auditoría p78, 26 oct 2026): lo que el fisio le pega al programa del coach se ve en «¿qué me toca hoy?»
// y lo que el atleta anota ahí se guarda con la llave estable (`<fase>-w<semana>-<regla>-<día>`) en `wr:sessions@<fisio>:sobre`, igual que la app.
// Corre desde supabase/functions/mcp:  deno run -A --config deno.json --node-modules-dir=none ../../../scripts/prueba-mcp-pegadas.ts
import { herramientasDelAtleta } from '../supabase/functions/mcp/atleta.ts'
import { baseEnMemoria, cierto, igual } from './mcp-prueba-comun.ts'

let n = 0
const ok = (nombre: string) => { n += 1; console.log(`OK    ${nombre}`) }

const COACH = 'coach-1'
const FISIO = 'fisio-1'
const dia = (day: string, name: string, ejercicios: any[]) => ({ day, cat: 'gym', name, exercises: ejercicios })
const ex = (name: string) => ({ set: 1, name, sets: '3', reps: '10', notes: '', intensity: '', exercise_id: `id-${name}` })

// El programa del coach: una fase de 2 semanas, con sentadilla los lunes.
const programaCoach = {
  id: 'plan-coach', user_id: 'atleta-1', title: 'Fuerza', status: 'active', profesional_id: null, updated_at: '2026-10-01',
  data: { kind: 'periodized', phases: [{ id: 'f1', num: 1, name: 'Base', weekData: [
    { num: 1, days: [dia('Lun', 'Piernas', [ex('Sentadilla')])] },
    { num: 2, days: [dia('Lun', 'Piernas', [ex('Sentadilla')])] },
  ] }] },
}
// Lo del fisio: estiramientos los lunes y miércoles en todo el programa.
const reglaEstira = { id: 'r1abcdef', nombre: 'Estiramientos', sesion: dia('Lun', 'Estiramientos', [ex('Estiramiento de cadera')]), dias: ['Lun', 'Mié'], alcance: { tipo: 'todo', desde: { faseId: 'f1', semana: 1, n: 0 } }, omitir: [], creada: '2026-10-02' }
const filaPegadas = { id: 'fila-1', user_id: 'atleta-1', profesional_id: FISIO, title: 'Sesiones pegadas', status: 'draft', updated_at: '2026-10-03', data: { tipo: 'pegadas', sesiones: [reglaEstira] } }

const equipo = [
  { profesional_id: COACH, full_name: 'Beto Ruiz', username: 'beto', profesion: 'Entrenador', es_principal: true, estado: 'activo', alta_en: null },
  { profesional_id: FISIO, full_name: 'Juan Pérez', username: 'juan', profesion: 'Fisioterapeuta', es_principal: false, estado: 'activo', alta_en: null },
]

const escrituras: any[] = []
function armar(filas: any[], estado: any = {}, miembros = equipo) {
  escrituras.length = 0
  const { db } = baseEnMemoria({ plans: filas, user_app_state: [{ user_id: 'atleta-1', data: estado }] }, { rpcs: { nombres_del_equipo: () => miembros, mezclar_mi_estado: (args: any) => { escrituras.push(args); return null } } })
  const quien: any = { id: 'atleta-1', usuario: 'ana', nombre: 'Ana', rol: 'atleta', salud: false, unidad: 'kg', db, token: 'token-de-prueba' }
  const tools: Record<string, (a: any) => Promise<any>> = {}
  const server: any = { registerTool: (nombre: string, _def: unknown, fn: (a: any) => Promise<any>) => { tools[nombre] = fn } }
  herramientasDelAtleta(server, quien)
  return tools
}

const fetchOriginal = globalThis.fetch
globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify({ compras: [] }), { status: 200 }))) as any
try {
  // 1) El lunes trae las dos sesiones: la del coach y la del fisio.
  let tools = armar([programaCoach, filaPegadas])
  const lunes = (await tools.ver_mi_dia({ dia: 'lunes', fase: 1, semana: 1 })).structuredContent
  const texto = JSON.stringify(lunes)
  cierto(texto.includes('Sentadilla') && texto.includes('Estiramiento de cadera'), `el lunes debe traer lo del coach y lo del fisio: ${texto.slice(0, 400)}`)
  cierto(texto.includes('sesiones sobre tu programa'), 'la sesión pegada dice de quién es')
  ok('ver_mi_dia trae la sesión del coach y la que el fisio pegó')

  // 2) El miércoles solo hay lo pegado (el coach no tiene sesión ese día).
  const miercoles = (await tools.ver_mi_dia({ dia: 'miércoles', fase: 1, semana: 2 })).structuredContent
  cierto(JSON.stringify(miercoles).includes('Estiramiento de cadera') && !JSON.stringify(miercoles).includes('Sentadilla'), 'el miércoles solo trae lo del fisio')
  ok('un día sin sesión del coach muestra lo pegado')

  // 3) ver_mi_plan lista ambos programas; «de: fisio» trae el del fisio pegado.
  const plan = (await tools.ver_mi_plan({})).structuredContent
  cierto(Array.isArray(plan.programas) && plan.programas.length === 2, `ver_mi_plan lista los dos: ${JSON.stringify(plan).slice(0, 300)}`)
  const delFisio = (await tools.ver_mi_plan({ de: 'fisio' })).structuredContent
  cierto(JSON.stringify(delFisio).includes('sesiones sobre tu programa'), 'de: fisio trae lo pegado')
  ok('ver_mi_plan lista lo pegado y «de: fisio» lo encuentra')

  // 4) Anotar lo pegado: la llave es estable y va en wr:sessions@<fisio>:sobre.
  const anota = (await tools.anotar_entrenamiento({ dia: 'lunes', fase: 1, semana: 1, de: 'fisio', ejercicios: [{ ejercicio: 'Estiramiento de cadera', hecho: '30' }], terminada: true })).structuredContent
  cierto(anota?.listo, `anotar debe funcionar: ${JSON.stringify(anota).slice(0, 300)}`)
  cierto(escrituras.length === 1, `guarda una vez; guardó ${escrituras.length}`)
  const cambios = escrituras[0].p_cambios
  igual(Object.keys(cambios), [`wr:sessions@${FISIO}:sobre`], 'va en la clave del fisio «sobre»')
  const llaves = Object.keys(cambios[`wr:sessions@${FISIO}:sobre`])
  igual(llaves, ['f1-w1-r1abcdef-Lun'], 'con la llave estable (fase, semana, regla y día), no la de posición')
  ok('anotar guarda en wr:sessions@<fisio>:sobre con llave estable')

  // 5) Sin «de», el ejercicio decide dónde anotar (el de la sentadilla es del coach).
  tools = armar([programaCoach, filaPegadas])
  await tools.anotar_entrenamiento({ dia: 'lunes', fase: 1, semana: 1, ejercicios: [{ ejercicio: 'Estiramiento de cadera', hecho: '30' }] })
  igual(Object.keys(escrituras[0].p_cambios), [`wr:sessions@${FISIO}:sobre`], 'sin «de», anota donde está ese ejercicio')
  tools = armar([programaCoach, filaPegadas])
  await tools.anotar_entrenamiento({ dia: 'lunes', fase: 1, semana: 1, ejercicios: [{ ejercicio: 'Sentadilla', hecho: '8' }] })
  igual(Object.keys(escrituras[0].p_cambios), ['wr:sessions'], 'la sentadilla va en la clave del coach')
  ok('sin «de», anota en el programa que tiene ese ejercicio')

  // 6) Lo anotado antes se lee de vuelta (la vista traduce la llave estable a posición).
  const estado = { [`wr:sessions@${FISIO}:sobre`]: { 'f1-w1-r1abcdef-Lun': { completed: true, exercises: { '0': { repsHechas: '30' } } } } }
  tools = armar([programaCoach, filaPegadas], estado)
  const hechas = (await tools.ver_mi_progreso({ de: 'fisio' })).structuredContent
  igual(hechas.sesiones_hechas, 1, 'la sesión pegada marcada como hecha cuenta')
  ok('lo anotado antes se lee de vuelta')

  // 7) Si el fisio ya no está en el equipo, o ya dio de alta, no manda sesiones.
  tools = armar([programaCoach, filaPegadas], {}, [equipo[0]])
  const sinFisio = JSON.stringify((await tools.ver_mi_dia({ dia: 'lunes', fase: 1, semana: 1 })).structuredContent)
  cierto(!sinFisio.includes('Estiramiento de cadera'), 'sin el fisio en el equipo no se ven sus sesiones')
  tools = armar([programaCoach, filaPegadas], {}, [equipo[0], { ...equipo[1], alta_en: '2026-10-20T00:00:00Z' }])
  const conAlta = JSON.stringify((await tools.ver_mi_dia({ dia: 'lunes', fase: 1, semana: 1 })).structuredContent)
  cierto(!conAlta.includes('Estiramiento de cadera'), 'con alta del fisio, sus sesiones no mandan')
  ok('un fisio fuera del equipo o con alta no manda sesiones')

  // 8) Sin programa del coach no hay sobre qué pegar, y nada se rompe.
  tools = armar([filaPegadas])
  igual((await tools.ver_mi_plan({})).structuredContent.plan, null, 'sin programa del coach, no hay plan')
  ok('sin programa del coach no se muestra lo pegado')
} finally {
  globalThis.fetch = fetchOriginal
}

console.log(`\n${n} pruebas bien.`)
