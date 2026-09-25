import { McpServer } from 'npm:@modelcontextprotocol/sdk@1.30.1/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from 'npm:@modelcontextprotocol/sdk@1.30.1/server/webStandardStreamableHttp.js'
import { APP_URL, SUPABASE_URL, metadatosDelRecurso } from './config.ts'
import { quienLlama, SinPermiso, TokenInvalido, type Quien } from './sesion.ts'
import { fechaDelAtleta, NOMBRE_DIA } from './util.ts'
import { herramientasComunes } from './comunes.ts'
import { herramientasDelAtleta } from './atleta.ts'
import { herramientasDelCoach } from './coach.ts'
import { herramientasDelAdmin } from './admin.ts'

/**
 * EL SERVIDOR MCP DE TRAINING LAB.
 *
 * Andrés, 25 sep 2026: "esto es de las cosas más importantes y quiero tenerla
 * lista antes de empezar mis pruebas piloto". Es lo que conecta Training Lab
 * con la IA de cada quien: Claude y ChatGPT (conectores), y Claude Code, Codex
 * y Hermes (MCP). Los cinco hablan el mismo protocolo y entran igual: pegan
 * la liga, inician sesión en Training Lab y aprueban el permiso.
 *
 * Cada persona ve SOLO sus herramientas: un atleta, las de atleta; un coach,
 * las de coach; el administrador, además, las de administrador. Y cada
 * herramienta trabaja con el token de la persona, así que la base aplica las
 * mismas reglas que en la app (ver `sesion.ts`).
 *
 * Sin estado entre llamadas: cada petición arma su servidor, contesta y se
 * olvida. Así corre bien en funciones que se apagan entre una y otra.
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, accept, mcp-session-id, mcp-protocol-version, last-event-id',
  'Access-Control-Expose-Headers': 'WWW-Authenticate, mcp-session-id, mcp-protocol-version',
  'Access-Control-Max-Age': '86400',
}

function json(cuerpo: unknown, status = 200, extra: Record<string, string> = {}) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS, ...extra },
  })
}

/**
 * 401 con la pista de dónde pedir permiso. Es lo que hace que Claude o
 * ChatGPT abran solos la pantalla de iniciar sesión: sin la cabecera
 * WWW-Authenticate no sabrían a quién preguntar.
 */
function noAutorizado(descripcion: string, tokenMalo = false) {
  const partes = [`resource_metadata="${APP_URL}/.well-known/oauth-protected-resource/mcp"`]
  if (tokenMalo) partes.push('error="invalid_token"', `error_description="${descripcion}"`)
  return json(
    { error: tokenMalo ? 'invalid_token' : 'unauthorized', error_description: descripcion },
    401,
    { 'WWW-Authenticate': `Bearer ${partes.join(', ')}` },
  )
}

function instrucciones(quien: Quien) {
  const hoy = fechaDelAtleta()
  const rol = quien.rol === 'atleta' ? 'atleta' : quien.rol === 'coach' ? 'coach' : 'administrador (dueño de la app)'
  const comun = [
    `Training Lab es una app de entrenamiento. Estás conectado como ${quien.nombre} (@${quien.usuario}), que es ${rol}.`,
    `Hoy es ${NOMBRE_DIA[hoy.dia].toLowerCase()} ${hoy.texto} en la hora de México; "hoy" en Training Lab es ese día.`,
    'Habla en español, claro y corto. Usa las unidades de la persona (kg o lb).',
    'Un plan tiene fases → semanas → días; un día tiene una o más sesiones, y cada sesión sus ejercicios (series, cantidad en reps, segundos o metros, intensidad, descanso, notas). Los ejercicios con el mismo "grupo" van en superserie o circuito.',
  ]
  const porRol = quien.rol === 'atleta'
    ? [
      'Antes de anotar, mira el día con ver_mi_dia para usar los nombres exactos de los ejercicios.',
      'Si le falta un aparato, busca alternativas con buscar_ejercicios (por músculo o patrón) y ofrécelas con su video. Tú no cambias su plan: eso lo hace su coach.',
    ]
    : [
      'Antes de cambiar un plan, léelo con ver_plan_de_atleta. Los cambios de plan se aplican al momento y siempre se pueden deshacer (ver_historial_del_plan, deshacer_cambio_del_plan).',
      'Al terminar un cambio, di en una o dos líneas qué cambió y a quién.',
      'Borrar pide confirmación: antes de borrar, di qué se va a borrar.',
      'Para ligar un ejercicio a su ficha con video, escribe su nombre exacto del repertorio (búscalo con buscar_ejercicios).',
    ]
  return [...comun, ...porRol].join('\n')
}

export async function manejar(req: Request): Promise<Response> {
  const url = new URL(req.url)

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

  // Para que Claude, ChatGPT o Codex encuentren solos a quién pedir permiso.
  if (url.pathname.includes('/.well-known/oauth-protected-resource')) {
    return json(metadatosDelRecurso())
  }
  // Compatibilidad con clientes MCP viejos, que buscan esto junto al servidor.
  if (url.pathname.includes('/.well-known/oauth-authorization-server')) {
    const res = await fetch(`${SUPABASE_URL}/.well-known/oauth-authorization-server/auth/v1`).catch(() => null)
    if (!res) return json({ error: 'No se pudo leer el servidor de permisos' }, 502)
    return json(await res.json().catch(() => ({})), res.status)
  }

  /* Sin estado: no hay flujo abierto por GET ni sesión que cerrar por DELETE.
     El protocolo permite contestar 405 y el cliente sigue solo por POST. */
  if (req.method !== 'POST') {
    return json({ error: 'Solo se aceptan peticiones POST' }, 405, { Allow: 'POST, OPTIONS' })
  }

  const auth = req.headers.get('Authorization') ?? ''
  const token = /^Bearer\s+(.+)$/i.exec(auth)?.[1]?.trim()
  if (!token) return noAutorizado('Hace falta iniciar sesión en Training Lab.')

  let quien: Quien
  try {
    quien = await quienLlama(token)
  } catch (e) {
    if (e instanceof TokenInvalido) return noAutorizado('La sesión caducó o se desconectó. Vuelve a conectar Training Lab.', true)
    if (e instanceof SinPermiso) return json({ error: 'forbidden', error_description: e.message }, 403)
    console.error('mcp: no se pudo identificar', e)
    return json({ error: 'server_error', error_description: 'No se pudo revisar tu cuenta. Intenta de nuevo.' }, 500)
  }

  const server = new McpServer(
    { name: 'training-lab', title: 'Training Lab', version: '1.0.0' },
    { instructions: instrucciones(quien) },
  )
  herramientasComunes(server, quien)
  if (quien.rol === 'atleta') {
    herramientasDelAtleta(server, quien)
  } else {
    herramientasDelCoach(server, quien)
    if (quien.rol === 'master') herramientasDelAdmin(server, quien)
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  await server.connect(transport)
  const res = await transport.handleRequest(req)
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v)
  return new Response(res.body, { status: res.status, headers })
}
