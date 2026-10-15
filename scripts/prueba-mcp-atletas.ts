// deno-lint-ignore-file no-explicit-any
// Prueba de `agregar_atleta` en el conector (supabase/functions/mcp/coach.ts) con el TOPE de atletas a mano (14 oct 2026):
// si la función del servidor contesta que se llenaron los lugares, la IA recibe `sin_lugares` con las dos salidas, no un error.
// Corre desde supabase/functions/mcp:  deno run -A --config deno.json ../../../scripts/prueba-mcp-atletas.ts
import { herramientasDelCoach } from '../supabase/functions/mcp/coach.ts'
import { baseEnMemoria, cierto, igual } from './mcp-prueba-comun.ts'

let n = 0
const ok = (nombre: string) => { n += 1; console.log(`OK    ${nombre}`) }

function armar() {
  const { db } = baseEnMemoria({ profiles: [] }, {})
  const quien: any = { id: 'coach-1', usuario: 'laura', nombre: 'Laura', rol: 'coach', salud: false, unidad: 'kg', db, token: 'token-de-prueba' }
  const tools: Record<string, (a: any) => Promise<any>> = {}
  const server: any = { registerTool: (nombre: string, _def: unknown, fn: (a: any) => Promise<any>) => { tools[nombre] = fn } }
  herramientasDelCoach(server, quien)
  return tools
}

const fetchOriginal = globalThis.fetch
const respondeCon = (estado: number, cuerpo: unknown) => {
  globalThis.fetch = (() => Promise.resolve(new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json' } }))) as any
}

try {
  const tools = armar()

  respondeCon(200, { ok: true, token: 'abc123', atleta_id: 'a-1', usuario: 'juan.perez', full_name: 'Juan Pérez' })
  const bien = (await tools.agregar_atleta({ nombre: 'Juan', apellido: 'Pérez' })).structuredContent
  igual([bien.listo, bien.atleta, /invitacion=abc123/.test(bien.link_de_invitacion)], [true, 'Juan Pérez', true], 'con lugar libre se agrega y devuelve su link')
  ok('agregar_atleta: con lugar libre devuelve el link')

  respondeCon(409, { error: 'Ya agregaste todos tus atletas gratis.', codigo: 'LIMITE_DE_ATLETAS', limite: 5, usados: 5 })
  const lleno = await tools.agregar_atleta({ nombre: 'Ana', apellido: 'Ruiz' })
  igual([lleno.isError ?? false, lleno.structuredContent.listo, lleno.structuredContent.sin_lugares], [false, false, true], 'sin lugares NO es un error: es una respuesta con sin_lugares')
  cierto(/compren un programa/.test(lleno.structuredContent.mensaje) && /pagar derechos/.test(lleno.structuredContent.mensaje), 'el mensaje cuenta las dos salidas')
  ok('agregar_atleta: al llegar al tope contesta sin_lugares con las dos salidas')

  respondeCon(400, { error: 'Falta el nombre del cliente' })
  const mal = await tools.agregar_atleta({ nombre: '', apellido: '' })
  cierto(mal.isError && /Falta el nombre/.test(JSON.stringify(mal.content)), 'otros errores siguen siendo errores')
  ok('agregar_atleta: los demás errores no se confunden con el tope')
} finally {
  globalThis.fetch = fetchOriginal
}

console.log(`\n${n} pruebas bien.`)
