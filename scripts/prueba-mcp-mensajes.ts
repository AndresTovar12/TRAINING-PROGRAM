// deno-lint-ignore-file no-explicit-any
// Pruebas de los MENSAJES en el conector de IA (supabase/functions/mcp/mensajes.ts), con una base en memoria.
// Corre desde supabase/functions/mcp:  deno run -A --config deno.json ../../../scripts/prueba-mcp-mensajes.ts
import { herramientasDeMensajes } from '../supabase/functions/mcp/mensajes.ts'
import { baseEnMemoria, cierto, igual } from './mcp-prueba-comun.ts'

let n = 0
const ok = (nombre: string) => { n += 1; console.log(`OK    ${nombre}`) }

const ATLETA = (k: number, usuario: string, nombre: string) => ({ id: `atleta-${k}`, username: usuario, full_name: nombre, role: 'user', is_owner: false, coach_id: 'master-1', is_active: true, unidad_peso: 'kg', genero: null, email: null, created_at: '2026-01-01', perfil_completo: true, alta_en: null })
const PERFILES = [ATLETA(1, 'zz_atleta', 'Atleta Prueba'), ATLETA(2, 'zz_dos', 'Dos Prueba')]

const m = (id: string, atleta: string, autor: string, min: number, extra: any = {}) => ({
  id, atleta_id: atleta, profesional_id: 'master-1', autor_id: autor, tipo: 'texto', texto: null, adjunto: null, adjunto_borrado: false, tecnica_id: null, marca_s: null,
  creado_en: `2026-10-14T10:${String(min).padStart(2, '0')}:00Z`, visto_en: null, eliminado_en: null, ...extra,
})
const MENSAJES = () => [
  m('m1', 'atleta-1', 'atleta-1', 1, { texto: 'Hola coach, ¿puedo cambiar el miércoles?', visto_en: '2026-10-14T10:05:00Z' }),
  m('m2', 'atleta-1', 'master-1', 2, { texto: 'Claro, pásalo al jueves', visto_en: '2026-10-14T10:06:00Z' }),
  m('m3', 'atleta-1', 'atleta-1', 3, { tipo: 'foto', adjunto: { ruta: 'a/b/c.jpg', mime: 'image/jpeg' } }),
  m('m4', 'atleta-1', 'atleta-1', 4, { tipo: 'voz', adjunto: { ruta: 'a/b/d.m4a', segundos: 12 } }),
  m('m5', 'atleta-1', 'atleta-1', 5, { tipo: 'tecnica', tecnica_id: 'tec-1' }),
  m('m6', 'atleta-1', 'atleta-1', 6, { texto: 'esto lo borré', eliminado_en: '2026-10-14T10:07:00Z' }),
  m('m7', 'atleta-1', 'atleta-1', 7, { texto: 'Gracias, entonces el jueves' }),
]
const TECNICAS = () => [
  { id: 'tec-1', atleta_id: 'atleta-1', profesional_id: 'master-1', ejercicio: 'Back Squat', detalle: '3×5 a 100 kg', estado: 'por_revisar', segundos: 18, video_borrado: false, creada_en: '2026-10-14T10:05:00Z', intento_de: null },
  { id: 'tec-2', atleta_id: 'atleta-2', profesional_id: 'master-1', ejercicio: 'Peso muerto', detalle: null, estado: 'correcta', segundos: 20, video_borrado: false, creada_en: '2026-10-13T10:05:00Z', intento_de: null },
  { id: 'tec-3', atleta_id: 'atleta-2', profesional_id: 'master-1', ejercicio: 'Dominadas', detalle: null, estado: 'por_revisar', segundos: 9, video_borrado: true, creada_en: '2026-10-13T11:05:00Z', intento_de: null },
  { id: 'tec-4', atleta_id: 'atleta-2', profesional_id: 'otro-coach', ejercicio: 'De otro', detalle: null, estado: 'por_revisar', segundos: 9, video_borrado: false, creada_en: '2026-10-13T12:05:00Z', intento_de: null },
  { id: 'tec-5', atleta_id: 'atleta-2', profesional_id: 'master-1', ejercicio: 'Press banca', detalle: null, estado: 'por_revisar', segundos: 14, video_borrado: false, creada_en: '2026-10-12T09:00:00Z', intento_de: 'tec-x' },
]
const BANDEJA = [
  { atleta_id: 'atleta-1', profesional_id: 'master-1', otro_id: 'atleta-1', otro_nombre: 'Atleta Prueba', otro_usuario: 'zz_atleta', soy_atleta: false, activa: true, ultimo_tipo: 'texto', ultimo_texto: 'Gracias, entonces el jueves', ultimo_en: '2026-10-14T10:07:00Z', ultimo_autor: 'atleta-1', ultimo_borrado: false, sin_leer: 4, por_revisar: 1 },
  { atleta_id: 'atleta-2', profesional_id: 'master-1', otro_id: 'atleta-2', otro_nombre: 'Dos Prueba', otro_usuario: 'zz_dos', soy_atleta: false, activa: false, ultimo_tipo: 'foto', ultimo_texto: null, ultimo_en: '2026-10-13T09:00:00Z', ultimo_autor: 'master-1', ultimo_borrado: false, sin_leer: 0, por_revisar: 0 },
  { atleta_id: 'master-1', profesional_id: 'otro-pro', otro_id: 'otro-pro', otro_nombre: 'Mi propio coach', otro_usuario: 'su_coach', soy_atleta: true, activa: true, ultimo_tipo: 'texto', ultimo_texto: 'Hola', ultimo_en: '2026-10-12T09:00:00Z', ultimo_autor: 'otro-pro', ultimo_borrado: false, sin_leer: 1, por_revisar: 0 },
]

function armar(tablas: Record<string, any[]> = {}) {
  const llamadas: any[] = []
  const { db, datos } = baseEnMemoria({ profiles: PERFILES, mensajes: MENSAJES(), tecnicas: TECNICAS(), ...tablas }, {
    memoria: ['mensajes', 'tecnicas'],
    rpcs: {
      bandeja: () => BANDEJA,
      puede_escribir: ({ a }) => a !== 'atleta-2',
      responder_tecnica: (args, d) => {
        llamadas.push(args)
        const t = d.tecnicas.find((x: any) => x.id === args.p_tecnica)
        if (!t) throw new Error('Esa técnica no es tuya.')
        t.estado = args.p_veredicto === 'correcta' ? 'correcta' : 'corregida'
        d.mensajes.push({ id: 'm-corr', atleta_id: t.atleta_id, profesional_id: 'master-1', autor_id: 'master-1', tipo: 'correccion', tecnica_id: t.id, texto: args.p_texto ?? 'Técnica correcta', creado_en: '2026-10-14T11:00:00Z' })
        return 'm-corr'
      },
    },
  })
  const quien: any = { id: 'master-1', usuario: 'andres', nombre: 'Andrés', rol: 'master', salud: false, unidad: 'kg', db }
  const tools: Record<string, (a: any) => Promise<any>> = {}
  const server: any = { registerTool: (nombre: string, _def: unknown, fn: (a: any) => Promise<any>) => { tools[nombre] = fn } }
  herramientasDeMensajes(server, quien)
  return { tools, datos, llamadas }
}
const sc = (r: any) => r.structuredContent
const falla = async (p: Promise<any>) => { const r = await p; cierto(r.isError || sc(r)?.error || /vacío|largo|no puedes|no encontr|escribe la|ya está|ya se borró/i.test(JSON.stringify(r.content ?? r)), 'se esperaba un aviso'); return JSON.stringify(r.content ?? r) }

/* ======================= Bandeja ======================= */
{
  const { tools } = armar()
  const b = sc(await tools.ver_bandeja_de_mensajes({}))
  igual([b.conversaciones, b.sin_leer_en_total, b.tecnicas_por_revisar_en_total], [2, 4, 1], 'solo las conversaciones donde yo soy el profesional (no la de mi propio coach)')
  igual(b.bandeja[0].atleta, 'Atleta Prueba', 'la más reciente primero')
  igual([b.bandeja[0].ultimo.de, b.bandeja[0].ultimo.texto, b.bandeja[0].sin_leer, b.bandeja[0].tecnicas_por_revisar], ['Atleta Prueba', 'Gracias, entonces el jueves', 4, 1], 'lo último, lo sin leer y las técnicas por revisar')
  igual([b.bandeja[1].ultimo.de, b.bandeja[1].ultimo.tipo, b.bandeja[1].se_puede_escribir], ['yo', 'foto', false], 'si lo último fue una foto lo dice, y avisa si la conversación está cerrada')
  igual(sc(await tools.ver_bandeja_de_mensajes({ solo_sin_leer: true })).conversaciones, 1, 'solo_sin_leer')
  ok('ver_bandeja_de_mensajes: solo mis conversaciones, lo último, lo sin leer, cerradas')
}

/* ======================= Leer una conversación ======================= */
{
  const { tools, datos } = armar()
  const antes = JSON.stringify(datos.mensajes)
  const c = sc(await tools.leer_conversacion({ atleta: 'zz_atleta' }))
  igual(c.mensajes.map((x: any) => x.id), ['m1', 'm2', 'm3', 'm4', 'm5', 'm6', 'm7'], 'de los más viejos a los más nuevos')
  igual([c.mensajes[0].de, c.mensajes[1].de], ['Atleta Prueba', 'yo'], 'quién lo dijo')
  igual([c.mensajes[1].texto, c.mensajes[1].visto_por_el_atleta, c.mensajes[0].visto_por_el_atleta], ['Claro, pásalo al jueves', true, undefined], 'lo mío dice si ya lo vio el atleta')
  igual([c.mensajes[2].archivo, c.mensajes[2].texto, JSON.stringify(c.mensajes[2]).includes('c.jpg')], ['foto', undefined, false], 'una foto solo se menciona: ni su dirección')
  igual([c.mensajes[3].archivo, c.mensajes[3].segundos], ['nota de voz', 12], 'una nota de voz dice cuánto dura')
  igual(c.mensajes[4].tecnica, { id: 'tec-1', ejercicio: 'Back Squat', detalle: '3×5 a 100 kg', estado: 'por_revisar', segundos: 18 }, 'una técnica trae su ejercicio y su estado')
  igual([c.mensajes[5].borrado, c.mensajes[5].texto], [true, undefined], 'lo borrado no enseña su texto')
  igual(c.sin_ver_del_atleta, 4, 'cuenta lo que del atleta no se ha visto (sin lo borrado)')
  igual(JSON.stringify(datos.mensajes), antes, 'leer NO marca nada como visto: la base quedó igual')
  cierto(!('anterior' in c), 'con menos mensajes que el límite no ofrece «anterior»')
  const p1 = sc(await tools.leer_conversacion({ atleta: 'zz_atleta', limite: 3 }))
  igual([p1.mensajes.map((x: any) => x.id), p1.anterior], [['m5', 'm6', 'm7'], '2026-10-14T10:05:00Z'], 'con límite trae los últimos y dice desde dónde seguir')
  const p2 = sc(await tools.leer_conversacion({ atleta: 'zz_atleta', limite: 3, antes: p1.anterior }))
  igual(p2.mensajes.map((x: any) => x.id), ['m2', 'm3', 'm4'], 'con «antes» trae los anteriores')
  const vacia = sc(await tools.leer_conversacion({ atleta: 'zz_dos' }))
  igual([vacia.mensajes.length, vacia.se_puede_escribir], [0, false], 'una conversación vacía y cerrada lo dice')
  cierto(/No encontré a/.test(await falla(tools.leer_conversacion({ atleta: 'zz_nadie' }))), 'un atleta que no existe: avisa')
  ok('leer_conversacion: orden, archivos solo mencionados, técnicas, borrados, no marca «visto», paginación')
}

/* ======================= Mandar un mensaje ======================= */
{
  const { tools, datos } = armar()
  const cuantos = datos.mensajes.length
  const vista = sc(await tools.enviar_mensaje({ atleta: 'zz_atleta', texto: '  Mañana descansas  ' }))
  igual([vista.enviado, vista.motivo, vista.mensaje], [false, 'falta_confirmacion', 'Mañana descansas'], 'sin confirmado: no manda y enseña el mensaje exacto')
  cierto(/Atleta Prueba/.test(vista.va_a_pasar), 'y a quién')
  igual(datos.mensajes.length, cuantos, 'no escribió nada')
  const env = sc(await tools.enviar_mensaje({ atleta: 'zz_atleta', texto: 'Mañana descansas', confirmado: true }))
  igual([env.listo, env.enviado, env.a, datos.mensajes.length], [true, true, 'Atleta Prueba', cuantos + 1], 'con confirmado, lo manda')
  const nuevo = datos.mensajes.at(-1)
  igual([nuevo.atleta_id, nuevo.profesional_id, nuevo.autor_id, nuevo.tipo, nuevo.texto], ['atleta-1', 'master-1', 'master-1', 'texto', 'Mañana descansas'], 'del profesional al atleta, como texto')
  cierto(/vacío/.test(await falla(tools.enviar_mensaje({ atleta: 'zz_atleta', texto: '   ', confirmado: true }))), 'un mensaje vacío: avisa')
  cierto(/demasiado largo/.test(await falla(tools.enviar_mensaje({ atleta: 'zz_atleta', texto: 'a'.repeat(4001), confirmado: true }))), 'uno de más de 4000: avisa')
  cierto(/conversación está cerrada/.test(await falla(tools.enviar_mensaje({ atleta: 'zz_dos', texto: 'Hola', confirmado: true }))), 'si la conversación está cerrada: avisa, aunque venga confirmado')
  cierto(/conversación está cerrada/.test(await falla(tools.enviar_mensaje({ atleta: 'zz_dos', texto: 'Hola' }))), 'y también al enseñar la vista previa (no se confirma algo imposible)')
  igual(datos.mensajes.length, cuantos + 1, 'nada más se escribió')
  ok('enviar_mensaje: nada sin confirmado, el mensaje exacto, de quién a quién, vacío, largo y cerrada')
}

/* ======================= Técnicas ======================= */
{
  const { tools, datos, llamadas } = armar()
  const l = sc(await tools.ver_tecnicas_por_revisar({}))
  igual(l.tecnicas.map((t: any) => t.id), ['tec-5', 'tec-1'], 'solo las mías, por revisar y con video; las más viejas primero')
  igual([l.tecnicas[1].atleta, l.tecnicas[1].ejercicio, l.tecnicas[1].detalle, l.tecnicas[0].es_otro_intento], ['Atleta Prueba', 'Back Squat', '3×5 a 100 kg', true], 'de quién, qué ejercicio y si es otro intento')
  cierto(/no ve los videos/.test(l.nota), 'y dice que la IA no ve el video')
  igual(sc(await tools.ver_tecnicas_por_revisar({ atleta: 'zz_atleta' })).tecnicas.map((t: any) => t.id), ['tec-1'], 'filtra por atleta')

  const vista = sc(await tools.responder_tecnica({ tecnica: 'tec-1', veredicto: 'correcta' }))
  igual([vista.enviado, vista.motivo], [false, 'falta_confirmacion'], 'sin confirmado no contesta')
  cierto(/Técnica correcta/.test(vista.va_a_pasar) && /Back Squat/.test(vista.va_a_pasar), 'y dice qué le llegaría')
  igual([llamadas.length, datos.tecnicas[0].estado], [0, 'por_revisar'], 'no tocó nada')
  const cor = sc(await tools.responder_tecnica({ tecnica: 'tec-1', veredicto: 'corregir', texto: 'Baja un poco más' }))
  igual([cor.correccion, cor.enviado], ['Baja un poco más', false], 'corregir: enseña la corrección tal cual')
  cierto(/Escribe la corrección/i.test(await falla(tools.responder_tecnica({ tecnica: 'tec-1', veredicto: 'corregir', confirmado: true }))), 'corregir sin texto: avisa')
  const hecho = sc(await tools.responder_tecnica({ tecnica: 'tec-1', veredicto: 'corregir', texto: 'Baja un poco más', confirmado: true }))
  igual([hecho.listo, hecho.veredicto, llamadas[0].p_texto, llamadas[0].p_veredicto, datos.tecnicas[0].estado], [true, 'corregir', 'Baja un poco más', 'corregir', 'corregida'], 'con confirmado, contesta por la función de la base')
  cierto(/ya está respondida/.test(await falla(tools.responder_tecnica({ tecnica: 'tec-1', veredicto: 'correcta', confirmado: true }))), 'una ya respondida: avisa')
  cierto(/No encontré esa técnica/.test(await falla(tools.responder_tecnica({ tecnica: 'tec-4', veredicto: 'correcta', confirmado: true }))), 'la de otro profesional: no es mía')
  cierto(/ya se borró/.test(await falla(tools.responder_tecnica({ tecnica: 'tec-3', veredicto: 'correcta', confirmado: true }))), 'si el video ya se borró: avisa')
  igual(llamadas.length, 1, 'y solo se contestó una vez')
  ok('técnicas: lista las mías por revisar; contestar pide confirmación, enseña lo que mandaría y avisa de lo imposible')
}

console.log(`\nTodo bien: ${n} grupos de pruebas de mensajes`)
