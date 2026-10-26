// deno-lint-ignore-file no-explicit-any
// Prueba de los PLANES COMPRADOS en el conector de IA (auditoría p2, 26 oct 2026): quien compró un plan y le pregunta a su IA «¿qué me toca hoy?» ya no recibe «todavía no tienes plan»,
// y lo que anota va en la clave de ESA compra (`wr:sessions@compra:<id>`), igual que la app. Los planes vencidos o las bibliotecas de clases no cuentan.
// Corre desde supabase/functions/mcp:  deno run -A --config deno.json ../../../scripts/prueba-mcp-compras.ts
import { herramientasDelAtleta } from '../supabase/functions/mcp/atleta.ts'
import { baseEnMemoria, cierto, igual } from './mcp-prueba-comun.ts'

let n = 0
const ok = (nombre: string) => { n += 1; console.log(`OK    ${nombre}`) }

const semana = (num: number, ejercicios: any[]) => ({ num, days: [{ day: 'Lun', cat: 'gym', name: `Sesión ${num}`, exercises: ejercicios }] })
const PROGRAMA = {
  kind: 'periodized',
  phases: [{ id: 'f1', name: 'Base', weekData: [
    semana(1, [{ set: 1, name: 'Sentadilla de prueba', sets: '3', reps: '8', notes: '', intensity: '', exercise_id: 'ex-1' }]),
    { num: 2, bloqueada: true, days: [{ day: 'Lun', bloqueada: true }] }, // la semana que todavía no se ve llega cerrada
  ] }],
}
const compra = (extra: any = {}) => ({
  compra_id: 'c-1', vitrina_plan_id: 'vp-1', estado: 'activa', tipo: 'membresia', inicio: '2026-10-26', periodo_hasta: '2026-11-26T00:00:00Z', titulo: 'Plan de fuerza',
  vendedor: { id: 'coach-9', usuario: 'beto', nombre: 'Beto Ruiz', foto: null, profesion: 'Entrenador' },
  programa: { title: 'Plan de fuerza', data: PROGRAMA, cursorInicial: { phaseId: 'f1', weekNum: 1, dayIdx: 0, fijadoEn: '2026-W44' }, resumen: {} },
  biblioteca: null, ...extra,
})

const fetchOriginal = globalThis.fetch
function conCompras(lista: any[]) {
  globalThis.fetch = ((url: any) => {
    if (String(url).includes('/functions/v1/programa-comprado')) return Promise.resolve(new Response(JSON.stringify({ compras: lista }), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    return Promise.resolve(new Response('{}', { status: 404 }))
  }) as any
}

const escrituras: any[] = [] // lo que el conector manda a `mezclar_mi_estado` (así guarda lo anotado, igual que la app)
function armar() {
  escrituras.length = 0
  const { db, datos } = baseEnMemoria({ plans: [], user_app_state: [{ user_id: 'atleta-1', data: {} }] }, { rpcs: { nombres_del_equipo: () => [], mezclar_mi_estado: (args: any) => { escrituras.push(args); return null } } })
  const quien: any = { id: 'atleta-1', usuario: 'ana', nombre: 'Ana', rol: 'atleta', salud: false, unidad: 'kg', db, token: 'token-de-prueba' }
  const tools: Record<string, (a: any) => Promise<any>> = {}
  const server: any = { registerTool: (nombre: string, _def: unknown, fn: (a: any) => Promise<any>) => { tools[nombre] = fn } }
  herramientasDelAtleta(server, quien)
  return { tools, datos }
}

try {
  // 1) Un plan comprado se ve como un programa más.
  conCompras([compra()])
  let { tools, datos } = armar()
  const plan = (await tools.ver_mi_plan({})).structuredContent
  cierto(plan.plan !== null || plan.titulo || JSON.stringify(plan).includes('Plan de fuerza'), `ver_mi_plan debe mostrar el plan comprado: ${JSON.stringify(plan).slice(0, 200)}`)
  const dia = (await tools.ver_mi_dia({ dia: 'lunes', fase: 1, semana: 1 })).structuredContent
  cierto(JSON.stringify(dia).includes('Sentadilla de prueba'), `ver_mi_dia debe traer los ejercicios del plan comprado: ${JSON.stringify(dia).slice(0, 300)}`)
  ok('un plan comprado se ve en ver_mi_plan y ver_mi_dia (ya no «todavía no tienes plan»)')

  // 2) Lo que anota va en la clave de esa compra.
  const anota = (await tools.anotar_entrenamiento({ dia: 'lunes', fase: 1, semana: 1, ejercicios: [{ ejercicio: 'Sentadilla de prueba', peso: 60, hecho: '8,8,8' }], terminada: true })).structuredContent
  cierto(anota?.listo !== false, `anotar debe funcionar: ${JSON.stringify(anota).slice(0, 200)}`)
  cierto(datos && escrituras.length === 1, `anotar debe guardar una vez; guardó ${escrituras.length}`)
  const claves = Object.keys(escrituras[0].p_cambios)
  cierto(claves.includes('wr:sessions@compra:c-1'), `lo anotado va en wr:sessions@compra:c-1; claves: ${claves.join(', ')}`)
  cierto(!claves.includes('wr:sessions'), 'y NO en las claves del coach principal')
  ok('anotar_entrenamiento guarda en wr:sessions@compra:<id>')

  // 3) Vencida, por armar o biblioteca: no cuentan como programa.
  conCompras([compra({ estado: 'vencida' }), compra({ compra_id: 'c-2', estado: 'por_armar', programa: null }), compra({ compra_id: 'c-3', programa: null, biblioteca: { clases: [] } })])
  ;({ tools } = armar())
  const sinPlan = (await tools.ver_mi_plan({})).structuredContent
  igual(sinPlan.plan, null, 'sin planes vigentes sigue diciendo que no hay plan')
  ok('vencidas, por armar y bibliotecas de clases no se cuentan como plan')

  // 4) Si la función no contesta, no se rompe: simplemente no hay compras.
  globalThis.fetch = (() => Promise.reject(new Error('sin red'))) as any
  ;({ tools } = armar())
  igual((await tools.ver_mi_plan({})).structuredContent.plan, null, 'sin red, no truena')
  ok('si programa-comprado no contesta, no se rompe')
} finally {
  globalThis.fetch = fetchOriginal
}

console.log(`\n${n} pruebas bien.`)
