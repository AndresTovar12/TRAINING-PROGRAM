// deno-lint-ignore-file no-explicit-any
import { McpServer } from 'npm:@modelcontextprotocol/sdk@1.30.1/server/mcp.js'
import { WebStandardStreamableHTTPServerTransport } from 'npm:@modelcontextprotocol/sdk@1.30.1/server/webStandardStreamableHttp.js'
import { APP_URL, SUPABASE_URL, metadatosDelRecurso } from './config.ts'
import { quienLlama, SinPermiso, TokenInvalido, type Quien } from './sesion.ts'
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

function instrucciones(quien: Quien) {
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
      p('«Mis planes» es tu catálogo, con carpetas: programas (por fases), rutinas semanales, workouts (un día) y clases (un workout con video). Se ve con ver_mis_planes y abrir_de_mis_planes; se guarda con guardar_en_mis_planes (del plan de un atleta, o armado desde cero); se ordena con cambiar_en_mis_planes, duplicar_en_mis_planes, borrar_de_mis_planes y las carpetas (crear_carpeta, cambiar_carpeta, borrar_carpeta). Para dárselo a uno o varios atletas: asignar_de_mis_planes; para hacerle a UN atleta un plan copiando otro (o parte de él, con filtro de tipos de sesión) en un solo paso: copiar_plan_a_atleta. Antes de asignar o reemplazar un plan, confirma con la persona a quién y qué. «Mi vitrina» es donde pones planes a la VENTA (ver_mi_vitrina, guardar_en_vitrina, publicar_en_vitrina, retirar_de_vitrina, borrar_borrador_de_vitrina): un borrador lo armas libremente, pero PUBLICAR, RETIRAR y cambiar un plan que ya está a la venta tocan dinero y lo que ve el público: antes enséñale a la persona qué va a pasar y espera su sí (las herramientas tampoco lo hacen sin confirmado: true). Nunca inventes un precio: pregúntalo. Los MENSAJES con tus atletas (ver_bandeja_de_mensajes, leer_conversacion, enviar_mensaje, ver_tecnicas_por_revisar, responder_tecnica): leer es libre y no marca nada como visto; MANDAR algo a una persona (un mensaje o contestar una técnica) pide que antes le enseñes a quien te habla el texto exacto y esperes su sí (las herramientas tampoco lo hacen sin confirmado: true); contestar una técnica solo si ella YA vio el video (tú no lo ves). Las MÉTRICAS DEL RELOJ de un atleta (ver_metricas_de_atleta, ver_entrenos_de_atleta, abrir_entreno_de_atleta, ver_recuperacion_de_atleta) son solo lectura: la forma, la carga, las zonas y la recuperación son una señal para preguntarle cómo está, no un diagnóstico. Lo guardado es una COPIA: no es el plan de ningún atleta y cambiarlo no mueve lo que alguien ya recibió.'),
      'Para ligar un ejercicio a su ficha con video, escribe su nombre exacto del repertorio (búscalo con buscar_ejercicios).',
      p('La «Ciencia» de un plan es opcional: el porqué de cómo está armado, en recuadros que el atleta lee en Home. Solo la escribes si te la piden o te la dan; no la inventes. Se lee con ver_ciencia_del_plan y se cambia con editar_ciencia (o con "ciencia" en crear_plan).'),
      p('Un atleta puede tener un equipo: su coach principal y otros profesionales (un fisio, por ejemplo), cada uno con SU programa. Los programas de todos se leen juntos (cada cosa dice "de" quién es; con "de" pides uno solo), pero cada quien cambia solo el suyo.')
        + (quien.rol === 'master' ? ' Como administrador eliges con "de" qué programa cambias; sin él, el del coach principal.' : ''),
      'Las notas de consulta de un fisio son suyas: no están aquí y no se piden ni se resumen.',
    ]
  /* CUÁNDO PREGUNTAR, arriba de todo (Andrés, 7 oct 2026): OpenAI pide lo importante en los primeros 512
     caracteres de estas instrucciones. Solo para quien arma planes y ejercicios. Es el consejo; lo que el
     conector puede revisar solo son los topes de `preguntas.ts`. */
  const preguntar = quien.rol === 'atleta' ? [] : [
    'Pregunta solo lo que tendrías que adivinar; lo que puedas deducir, hazlo y dilo. Lo que la persona ya dijo, no se pregunta. Todas las preguntas en UN solo mensaje, con opciones numeradas.',
    'Antes de guardar, busca cada ejercicio con buscar_ejercicios (el catálogo está casi todo en inglés) y usa su nombre exacto: si encaja uno solo o es un sinónimo claro, úsalo; si hay varios posibles, pregunta cuál; si ninguno, pregunta si lo creas.',
    'Pregunta también las reps que falten y si un ejercicio a una pierna o brazo va «por lado». No preguntes descanso, descripción ni notas, ni si son biserie o triserie: por cómo separaron la lista (mismo grupo). Si armaste biseries, enséñalas antes de guardar.',
  ].map((t) => p(t))
  return [...preguntar, ...comun, ...porRol].join('\n')
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
