// «Tus IAs conectadas»: solo las que están conectadas de verdad, una por IA (6 oct 2026).
// Corre con: node scripts/prueba-conexiones-ia.mjs
import { agrupaConexiones, familiaDe } from '../src/features/ia/conexiones.js'

let mal = 0
const ok = (nombre, condicion, extra = '') => {
  if (!condicion) mal++
  console.log(`${condicion ? 'OK   ' : 'FALLA'} ${nombre}${extra ? ` (${extra})` : ''}`)
}

// El caso real de Andrés: 9 permisos (de `listGrants`) y 5 sesiones vivas (de `mis_conexiones_ia`).
const permiso = (id, name, granted_at) => ({ client: { id, name }, granted_at })
const concedidos = [
  permiso('2fc3d01f', 'ChatGPT', '2026-10-06T22:53:45Z'),
  permiso('c1c8b369', 'Hermes Agent', '2026-09-28T20:24:40Z'),
  permiso('13a71df7', 'Hermes Agent', '2026-09-28T20:18:30Z'),
  permiso('ea537723', 'Hermes Agent', '2026-09-28T17:10:22Z'),
  permiso('02d80ff2', 'Claude', '2026-09-28T14:19:34Z'),
  permiso('e2705a85', 'ChatGPT', '2026-09-25T17:43:58Z'),
  permiso('9a9d8d35', 'Codex', '2026-09-25T15:27:19Z'),
  permiso('2bec4b87', 'Codex', '2026-09-25T14:05:21Z'),
  permiso('f72c4cfd', 'Claude', '2026-09-25T13:43:07Z'),
]
const vivas = [
  { cliente_id: 'e2705a85', nombre: 'ChatGPT', desde: '2026-09-27T21:46:00Z' },
  { cliente_id: '02d80ff2', nombre: 'Claude', desde: '2026-09-28T14:19:35Z' },
  { cliente_id: 'ea537723', nombre: 'Hermes Agent', desde: '2026-09-28T17:10:23Z' },
  { cliente_id: 'c1c8b369', nombre: 'Hermes Agent', desde: '2026-09-28T20:25:15Z' },
  { cliente_id: '2fc3d01f', nombre: 'ChatGPT', desde: '2026-10-06T22:53:52Z' },
]
const lista = agrupaConexiones(concedidos, vivas)
ok('9 permisos y 5 sesiones salen como 3 IAs', lista.length === 3, lista.map((g) => g.nombre).join(', '))
ok('de la más reciente a la más vieja: ChatGPT, Hermes, Claude', lista.map((g) => g.familia).join() === 'chatgpt,hermes,claude')
ok('ChatGPT dice desde su conexión nueva (6 oct), no desde la muerta del 27 sep', lista[0].desde === '2026-10-06T22:53:52Z')
ok('Hermes dice desde su sesión más reciente', lista[1].desde === '2026-09-28T20:25:15Z')
ok('Claude trae también su permiso viejo sin sesión, para desconectarlo junto', lista[2].clientes.includes('f72c4cfd') && !lista[2].vivos.includes('f72c4cfd'))
ok('ChatGPT desconecta sus dos clientes', lista[0].clientes.length === 2)
ok('los permisos de Codex (sin sesión) no salen', !lista.some((g) => g.familia === 'codex'))

ok('sin ninguna sesión viva no sale nada', agrupaConexiones(concedidos, []).length === 0)
ok('sin permisos ni sesiones, tampoco', agrupaConexiones([], []).length === 0)

// Si no se pudo preguntar por las sesiones: los permisos, pero sin repetir cada IA.
const respaldo = agrupaConexiones(concedidos, null)
ok('sin saber de sesiones, cada IA sale una sola vez', respaldo.map((g) => g.familia).sort().join() === 'chatgpt,claude,codex,hermes', respaldo.map((g) => g.familia).join())
ok('y con la fecha de su permiso más reciente', respaldo.find((g) => g.familia === 'chatgpt').desde === '2026-10-06T22:53:45Z')

// Una sesión viva cuyo permiso ya no está se muestra igual (es una conexión real)
const sola = agrupaConexiones([], [{ cliente_id: 'x1', nombre: 'Claude Code', desde: '2026-10-01T00:00:00Z' }])
ok('una sesión sin permiso listado también cuenta', sola.length === 1 && sola[0].nombre === 'Claude Code')

ok('«Codex» no es «Claude Code»', familiaDe('Codex') === 'codex' && familiaDe('Claude Code') === 'claude-code')
ok('«Hermes Agent» es Hermes y «ChatGPT» es ChatGPT', familiaDe('Hermes Agent') === 'hermes' && familiaDe('ChatGPT') === 'chatgpt')
ok('un nombre desconocido se cuenta aparte', familiaDe('Cursor').startsWith('otra:'))
ok('un nombre desconocido conserva su nombre', agrupaConexiones([], [{ cliente_id: 'y', nombre: 'Cursor', desde: '2026-10-01T00:00:00Z' }])[0].nombre === 'Cursor')

console.log(mal ? `\n${mal} fallaron` : '\nTodo bien')
process.exit(mal ? 1 : 0)
