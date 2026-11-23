// deno-lint-ignore-file no-explicit-any
import { McpServer } from 'npm:@modelcontextprotocol/sdk@1.30.1/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from 'npm:@modelcontextprotocol/sdk@1.30.1/server/webStandardStreamableHttp.js'
import { APP_URL, SUPABASE_URL, metadatosDelRecurso } from './config.ts'
import { estiloDe, quienLlama, SinPermiso, TokenInvalido, type Quien } from './sesion.ts'
import { fechaDelAtleta, NOMBRE_DIA, palabrasDe } from './util.ts'
import { traduce } from './app/palabras.js'
import { herramientasComunes } from './comunes.ts'
import { herramientasDelAtleta } from './atleta.ts'
import { herramientasDelCoach } from './coach.ts'
import { herramientasDeMisPlanes } from './misplanes.ts'
import { herramientasDeMiVitrina } from './misvitrina.ts'
import { herramientasDeMensajes } from './mensajes.ts'
import { herramientasDeMetricas } from './metricas.ts'
import { herramientasDelAdmin } from './admin.ts'
import { herramientasDeMedios } from './medios.ts'

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
  /* Sin acentos EN LA CABECERA. Una cabecera HTTP solo admite caracteres
     básicos: con "sesión" o "caducó", la cabecera entera se perdía en el
     camino (probado contra la función publicada) y la IA ya no sabía dónde
     volver a pedir permiso. El mensaje con acentos va en el cuerpo. */
  const ascii = descripcion.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\x20-\x7e]/g, '').replace(/"/g, "'")
  if (tokenMalo) partes.push('error="invalid_token"', `error_description="${ascii}"`)
  return json(
    { error: tokenMalo ? 'invalid_token' : 'unauthorized', error_description: descripcion },
    401,
    { 'WWW-Authenticate': `Bearer ${partes.join(', ')}` },
  )
}

/**
 * A un fisio (o al paciente de un fisio) las herramientas le hablan con SUS
 * palabras: «pacientes» y «programa», como la app. Solo los textos fijos de
 * los títulos y las descripciones; los nombres y lo que escribió cada quien no
 * se tocan. Para los demás no cambia nada.
 */
function conPalabras(server: McpServer, quien: Quien) {
  if (!quien.salud) return
  const registrar = server.registerTool.bind(server) as (...args: any[]) => unknown
  ;(server as any).registerTool =(nombre: string, def: any, fn: unknown) =>
    registrar(nombre, { ...def, title: traduce(def.title, true), description: traduce(def.description, true) }, fn)
}

export function instrucciones(quien: Quien) {
  const hoy = fechaDelAtleta()
  const p = palabrasDe(quien)
  const rol = quien.rol === 'atleta' ? 'atleta' : quien.rol === 'coach' ? 'coach' : 'administrador (dueño de la app)'
  const comun = [
    // El nombre y el usuario no se traducen: van como marcas y se pegan después.
    p(`Training Lab es una app de entrenamiento. Estás conectado como {NOMBRE} (@{USUARIO}), que es ${rol}.`)
      .replace('{NOMBRE}', quien.nombre).replace('{USUARIO}', quien.usuario),
    `Hoy es ${NOMBRE_DIA[hoy.dia].toLowerCase()} ${hoy.texto} en la hora de México; "hoy" en Training Lab es ese día.`,
    'Habla en español, claro y corto. Usa las unidades de la persona (kg o lb).',
    p('Un plan tiene fases → semanas → días; un día tiene una o más sesiones, y cada sesión sus ejercicios (series, cantidad en reps, segundos o metros, intensidad, descanso, notas). Los ejercicios con el mismo "grupo" van en superserie o circuito.'),
  ]
  const porRol = quien.rol === 'atleta'
    ? [
      'Antes de anotar, mira el día con ver_mi_dia para usar los nombres exactos de los ejercicios.',
      p('Si le falta un aparato, busca alternativas con buscar_ejercicios (por músculo o patrón) y ofrécelas con su video. Tú no cambias su plan: eso lo hace su coach.'),
      'Puedes tener más de un programa: el de tu coach y el de otros profesionales de tu equipo (por ejemplo, tu fisio). ver_mi_plan, ver_mi_dia y ver_mi_semana los dan todos juntos y cada uno dice de quién es ("de"); con el argumento "de" (el nombre, "coach" o "fisio") pides uno solo. Quien ya te dio de alta no te manda sesiones. Al anotar, se guarda en el programa correcto; si hay duda de cuál, pregunta.',
    ]
    : [
      p('Antes de cambiar un plan, léelo con ver_plan_de_atleta. Los cambios de plan se aplican al momento y siempre se pueden deshacer (ver_historial_del_plan, deshacer_cambio_del_plan).'),
      p('Al terminar un cambio, di en una o dos líneas qué cambió y a quién.'),
      'Borrar pide confirmación: antes de borrar, di qué se va a borrar.',
      p('«Mis planes» es tu catálogo con carpetas (programas, rutinas, workouts, clases): ver_mis_planes, abrir_de_mis_planes, guardar_en_mis_planes; para dárselo a atletas, asignar_de_mis_planes o copiar_plan_a_atleta (confirma antes a quién y qué). Lo guardado es una COPIA.'),
      '«Mi vitrina» son planes a la venta: un borrador se arma libre; PUBLICAR, RETIRAR o cambiar algo ya a la venta toca dinero: enseña qué pasará y espera el sí (sin confirmado: true no se hace). Nunca inventes un precio.',
      p('MENSAJES: leer es libre y no marca visto; MANDAR (un mensaje o contestar una técnica) pide enseñar el texto exacto y esperar el sí; contesta una técnica solo si la persona ya vio el video. Las MÉTRICAS del reloj son solo lectura: una señal para preguntar cómo está, no un diagnóstico.'),
      'SESIONES: Gym, Libre, Movilidad y Clase con "ejercicios"; Running, Cycling, Swimming y Triatlón con "disciplina" y "piezas"; Híbrido con "sets"; Deporte con "deporte". Los valores como los diría el coach («1 km», «4:20-4:30», «zona 2», «2 min»). Al guardar, enseña "asi_lo_vera_el_atleta".',
      'ARCHIVOS (solo agentes que pueden subir archivos): pedir_subida y poner_medio_a_ejercicio. Antes de un lote, enseña UNA vez la lista «archivo → ejercicio» y espera el sí. En un chat sin archivos, usa ligas.',
      'Para ligar un ejercicio a su ficha con video, escribe su nombre exacto del repertorio (búscalo con buscar_ejercicios).',
      p('Un atleta puede tener un equipo: su coach principal y otros profesionales (un fisio, por ejemplo), cada uno con SU programa. Los programas de todos se leen juntos (cada cosa dice "de" quién es; con "de" pides uno solo), pero cada quien cambia solo el suyo.')
        + (quien.rol === 'master' ? ' Como administrador eliges con "de" qué programa cambias; sin él, el del coach principal.' : ''),
      'Las notas de consulta de un fisio son suyas: no están aquí y no se piden ni se resumen.',
    ]
  /* CUÁNDO PREGUNTAR, arriba de todo (Andrés, 7 oct y 23 nov 2026: «un asistente que entiende a la primera»). OpenAI lee primero
     los 512 caracteres: van las reglas, cortas. Las tres clases de dato están también en `preguntas.ts`. El estilo del coach, si lo
     guardó (guardar_mi_estilo), va primero y gana sobre todo lo demás. */
  const estilo = quien.rol !== 'atleta' && quien.estilo?.reglas?.length
    ? [`Estilo de ${quien.nombre} (manda sobre las reglas de abajo): ${quien.estilo.reglas.join('; ')}.`] : []
  const preguntar = quien.rol === 'atleta' ? [] : [
    'PREGUNTA SOLO LO QUE BLOQUEA: a qué atleta o día (si no lo dijo), un ejercicio con varios parecidos, uno que no existe («¿lo creo?»), y confirmar borrar, reemplazar, asignar, mandar mensajes o lo que toca dinero. Todo en UN mensaje con opciones numeradas.',
    'Lo demás lo supones y lo dices al final en UNA línea que acabe en «¿Cambio algo?» (las herramientas te dan "supuestos"). Nunca preguntes al crear por video, foto, descripción o notas.',
    'Prisa: mensaje corto o con «rápido», «ya», «así nomás» = máximo UNA pregunta. Si da muchos detalles o pide ayuda para diseñar, puedes preguntar más, siempre en un mensaje.',
  ].map((t) => p(t))
  return [...estilo, ...preguntar, ...comun, ...porRol].join('\n')
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

  // El estilo de preguntar del coach va en las instrucciones (y lo usan las herramientas que arman planes).
  if (quien.rol !== 'atleta') quien.estilo = await estiloDe(quien).catch(() => null)

  const server = new McpServer(
    { name: 'training-lab', title: 'Training Lab', version: '1.0.0' },
    { instructions: instrucciones(quien) },
  )
  conPalabras(server, quien)
  herramientasComunes(server, quien)
  if (quien.rol === 'atleta') {
    herramientasDelAtleta(server, quien)
  } else {
    herramientasDelCoach(server, quien)
    herramientasDeMisPlanes(server, quien)
    herramientasDeMiVitrina(server, quien)
    herramientasDeMensajes(server, quien)
    herramientasDeMetricas(server, quien)
    herramientasDeMedios(server, quien)
    if (quien.rol === 'master') herramientasDelAdmin(server, quien)
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  })
  // Casi 1 de cada 10 llamadas de ChatGPT y Claude fallaba sin dejar rastro (p129, 26 oct 2026): ahora el transporte anota por qué en los registros del servidor.
  transport.onerror = (e: unknown) => console.error('mcp: error del transporte', e instanceof Error ? e.message : e)
  const inicio = Date.now()
  await server.connect(transport)
  let res: Response
  try {
    res = await transport.handleRequest(req)
  } catch (e) {
    console.error(`mcp: la llamada falló a los ${Date.now() - inicio} ms (${quien.rol})`, e instanceof Error ? e.stack ?? e.message : e)
    return json({ error: 'server_error', error_description: 'No se pudo atender la petición. Intenta de nuevo.' }, 500)
  }
  if (res.status >= 500) console.error(`mcp: respondió ${res.status} a los ${Date.now() - inicio} ms (${quien.rol})`)
  const headers = new Headers(res.headers)
  for (const [k, v] of Object.entries(CORS)) headers.set(k, v)
  return new Response(res.body, { status: res.status, headers })
}
