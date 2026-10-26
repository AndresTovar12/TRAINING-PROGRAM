// deno-lint-ignore-file no-explicit-any
// Prueba de ver_catalogos y crear_tipo_de_sesion en el conector (auditoría p80 y p81, 26 oct 2026): los tipos de la app que el coach quitó ya no se ofrecen, un tipo nuevo nace con un
// ícono que le va al nombre, y el dueño ve de quién es cada categoría.
// Corre desde supabase/functions/mcp:  deno run -A --config deno.json ../../../scripts/prueba-mcp-catalogos.ts
import { herramientasDelCoach } from '../supabase/functions/mcp/coach.ts'
import { baseEnMemoria, cierto, igual } from './mcp-prueba-comun.ts'

let n = 0
const ok = (nombre: string) => { n += 1; console.log(`OK    ${nombre}`) }

function armar(esMaster: boolean) {
  const { db, datos } = baseEnMemoria({
    exercise_categories: [
      { id: 'c-1', name: 'Fuerza', created_by: null },
      { id: 'c-2', name: 'Piernas', created_by: 'otro-coach' },
      { id: 'c-3', name: 'Piernas', created_by: 'coach-1' },
    ],
    session_types: [], routine_templates: [], profiles: [{ id: 'otro-coach', full_name: 'Beto Ruiz', username: 'beto' }],
    user_app_state: [{ user_id: 'coach-1', data: { 'ui:tipos-quitados': ['football', 'tests'] } }],
    exercises: [],
  }, { memoria: ['session_types', 'user_app_state', 'exercises', 'routine_templates'], rpcs: { master_id: () => 'coach-1' } })
  const quien: any = { id: 'coach-1', usuario: 'laura', nombre: 'Laura', rol: esMaster ? 'master' : 'coach', salud: false, unidad: 'kg', db, token: 't' }
  const tools: Record<string, (a: any) => Promise<any>> = {}
  const server: any = { registerTool: (nombre: string, _def: unknown, fn: (a: any) => Promise<any>) => { tools[nombre] = fn } }
  herramientasDelCoach(server, quien)
  return { tools, datos }
}

// p81: lo que el coach quitó no se ofrece; OFF siempre.
let { tools, datos } = armar(false)
let c = (await tools.ver_catalogos({})).structuredContent
cierto(!c.tipos_de_sesion_de_la_app.includes('Cancha') && !c.tipos_de_sesion_de_la_app.includes('Tests'), `los quitados no se ofrecen: ${c.tipos_de_sesion_de_la_app.join(', ')}`)
cierto(c.tipos_de_sesion_de_la_app.includes('Gym') && c.tipos_de_sesion_de_la_app.includes('OFF'), 'los demás sí, y OFF siempre')
ok('ver_catalogos: no ofrece los tipos de la app que el coach quitó')

// p81: un tipo nuevo lleva el ícono que le va al nombre.
await tools.crear_tipo_de_sesion({ nombre: 'Boxeo' })
igual(datos.session_types[0].icono, 'boxeo', 'Boxeo → ícono boxeo')
await tools.crear_tipo_de_sesion({ nombre: 'Xyzzyq' })
igual(datos.session_types[1].icono, null, 'sin parecido, queda sin ícono (la etiqueta neutra)')
ok('crear_tipo_de_sesion: pone el ícono que le va al nombre')

// p80: el dueño ve de quién es cada categoría; el coach normal no ve las de otros.
c = (await tools.ver_catalogos({})).structuredContent
igual(c.categorias.map((x: any) => x.nombre).sort(), ['Fuerza', 'Piernas'], 'un coach ve las de la app y las suyas')
;({ tools, datos } = armar(true))
c = (await tools.ver_catalogos({})).structuredContent
const ajena = c.categorias.find((x: any) => x.de)
igual(ajena?.de, 'Beto Ruiz', 'el dueño ve de quién es la categoría ajena')
ok('ver_catalogos: el dueño ve de quién es cada categoría')

console.log(`\n${n} pruebas bien.`)
