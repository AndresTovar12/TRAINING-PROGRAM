// deno-lint-ignore-file no-explicit-any
import type { McpServer } from 'npm:@modelcontextprotocol/sdk@1.30.1/server/mcp.js'
import { z } from 'npm:zod@^4.1.13'
import type { Quien } from './sesion.ts'
import { Aviso, buscarPersona, nombreDe, respuesta, seguro } from './util.ts'
import { SOLO_LEER } from './coach.ts'

/**
 * LOS MENSAJES EN EL CONECTOR DE IA (14 oct 2026, tanda 4).
 *
 * Lo que hace la pestaña «Mensajes» de la app (`src/lib/mensajesApi.js`, `docs/sql/2026-10-10-mensajes.sql`): una conversación es el PAR (atleta, profesional); aquí quien llama
 * es siempre el profesional. Se pueden ver la bandeja y los mensajes, mandar un texto y contestar la técnica (el video de una serie) de un atleta.
 *
 * MANDAR ALGO A UNA PERSONA PIDE CONFIRMACIÓN, de verdad y no solo en el texto: `enviar_mensaje` y `responder_tecnica` no hacen nada sin `confirmado: true`; sin él devuelven lo que
 * se mandaría, para que la IA se lo enseñe a la persona. Leer NO marca los mensajes como «vistos»: el atleta no tiene por qué creer que su coach los leyó. La IA no ve fotos, videos ni
 * notas de voz (solo dice que existen), ni sube archivos: lo suyo es el texto.
 * Quién puede escribirle a quién lo decide la base (RLS y `puede_escribir`), igual que en la app.
 */

const ENVIA = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true } as const
const CONFIRMADO = z.boolean().optional().describe('Solo después de enseñarle a la persona EXACTAMENTE lo que se va a mandar y que diga que sí. Sin esto, no manda nada y te devuelve lo que mandaría.')
const MAX_TEXTO = 4000

/** «mié 14 oct · 9:05», en la hora de México. */
function cuando(iso: string | null | undefined) {
  const d = new Date(String(iso ?? ''))
  if (!Number.isFinite(d.getTime())) return null
  const partes = new Intl.DateTimeFormat('es-MX', { timeZone: 'America/Mexico_City', weekday: 'short', day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', hour12: false }).formatToParts(d)
  const v = (t: string) => (partes.find((p) => p.type === t)?.value ?? '').replace('.', '')
  return `${v('weekday')} ${v('day')} ${v('month')} · ${v('hour')}:${v('minute')}`
}
const corto = (t: string | null | undefined, n = 140) => { const s = String(t ?? '').replace(/\s+/g, ' ').trim(); return s.length > n ? `${s.slice(0, n - 1)}…` : s }
const DE_ARCHIVO: Record<string, string> = { foto: 'foto', video: 'video', voz: 'nota de voz', tecnica: 'técnica (video de una serie)', correccion: 'respuesta a una técnica' }

export function herramientasDeMensajes(server: McpServer, quien: Quien) {
  /** Lo que se dice de un mensaje, sin los archivos (la IA no los ve). */
  const mensajeEn = (m: any, persona: any, tecnicas: Map<string, any>) => {
    const mio = m.autor_id === quien.id
    const t = m.tecnica_id ? tecnicas.get(m.tecnica_id) : null
    return {
      id: m.id,
      de: mio ? 'yo' : nombreDe(persona),
      cuando: cuando(m.creado_en),
      tipo: m.tipo,
      ...(m.eliminado_en ? { borrado: true } : (m.texto ? { texto: m.texto } : {})),
      ...(!m.eliminado_en && DE_ARCHIVO[m.tipo] ? { archivo: DE_ARCHIVO[m.tipo], ...(m.adjunto?.segundos ? { segundos: m.adjunto.segundos } : {}), ...(m.adjunto_borrado ? { archivo_ya_borrado: true } : {}) } : {}),
      ...(t ? { tecnica: { id: t.id, ejercicio: t.ejercicio, ...(t.detalle ? { detalle: t.detalle } : {}), estado: t.estado, ...(t.segundos ? { segundos: t.segundos } : {}), ...(t.video_borrado ? { video_ya_borrado: true } : {}) } } : {}),
      ...(m.marca_s != null ? { marca_en_el_video_s: m.marca_s } : {}),
      ...(mio ? { visto_por_el_atleta: !!m.visto_en } : {}),
    }
  }
  const puedeEscribir = async (atletaId: string) => {
    const { data, error } = await quien.db.rpc('puede_escribir', { a: atletaId, p: quien.id })
    return error ? true : data !== false // si la pregunta falla, que decida la base al insertar
  }

  server.registerTool('ver_bandeja_de_mensajes', {
    title: 'Ver mi bandeja de mensajes',
    description: 'Tus conversaciones con tus atletas, como la pestaña Mensajes: con cada uno, lo último que se dijo, cuántos mensajes suyos no has visto y cuántas técnicas (videos de una serie) esperan tu respuesta. Las más recientes primero. Leerlo no marca nada como visto.',
    inputSchema: { solo_sin_leer: z.boolean().optional().describe('Solo las conversaciones con mensajes sin ver o técnicas por revisar.') },
    annotations: SOLO_LEER,
  }, seguro(async ({ solo_sin_leer }: any) => {
    const { data, error } = await quien.db.rpc('bandeja')
    if (error) throw new Error(error.message)
    const mias = ((data ?? []) as any[]).filter((r) => !r.soy_atleta && (!solo_sin_leer || r.sin_leer > 0 || r.por_revisar > 0))
    return respuesta({
      conversaciones: mias.length,
      sin_leer_en_total: mias.reduce((n, r) => n + (r.sin_leer ?? 0), 0),
      tecnicas_por_revisar_en_total: mias.reduce((n, r) => n + (r.por_revisar ?? 0), 0),
      bandeja: mias.map((r) => ({
        atleta: r.otro_nombre,
        usuario: r.otro_usuario,
        ...(r.ultimo_en ? {
          ultimo: {
            de: r.ultimo_autor === quien.id ? 'yo' : r.otro_nombre,
            cuando: cuando(r.ultimo_en),
            ...(r.ultimo_borrado ? { borrado: true } : (r.ultimo_texto ? { texto: corto(r.ultimo_texto) } : { tipo: DE_ARCHIVO[r.ultimo_tipo] ?? r.ultimo_tipo })),
          },
        } : { ultimo: 'todavía no se han escrito' }),
        sin_leer: r.sin_leer ?? 0,
        ...(r.por_revisar ? { tecnicas_por_revisar: r.por_revisar } : {}),
        ...(r.activa === false ? { se_puede_escribir: false } : {}),
      })),
    })
  }))

  server.registerTool('leer_conversacion', {
    title: 'Leer mi conversación con un atleta',
    description: 'Los mensajes entre tú y un atleta, de los más viejos a los más nuevos (los últimos 30 si no dices; hasta 100). Para ver más atrás, manda "antes" con el valor de "anterior". Las fotos, videos y notas de voz solo se mencionan (la IA no los ve); las técnicas traen su ejercicio y su estado. Leer NO marca los mensajes como «vistos» para el atleta.',
    inputSchema: {
      atleta: z.string().describe('El atleta: su usuario (@juan), su nombre o su id.'),
      limite: z.coerce.number().optional().describe('Cuántos mensajes (30 si no se dice; máximo 100).'),
      antes: z.string().optional().describe('Para ver los anteriores: el valor de "anterior" de la respuesta pasada.'),
    },
    annotations: SOLO_LEER,
  }, seguro(async ({ atleta, limite, antes }: any) => {
    const persona = await buscarPersona(quien, atleta)
    const n = Math.min(100, Math.max(1, Math.round(Number(limite) || 30)))
    let q = quien.db.from('mensajes').select('*').eq('atleta_id', persona.id).eq('profesional_id', quien.id).order('creado_en', { ascending: false }).limit(n)
    if (antes) q = q.lt('creado_en', String(antes))
    const { data, error } = await q
    if (error) throw new Error(error.message)
    const filas = [...(data ?? [])].sort((a: any, b: any) => (a.creado_en < b.creado_en ? -1 : 1))
    const ids = [...new Set(filas.map((m: any) => m.tecnica_id).filter(Boolean))]
    const tecnicas = new Map<string, any>()
    if (ids.length) for (const t of (await quien.db.from('tecnicas').select('*').in('id', ids)).data ?? []) tecnicas.set(t.id, t)
    return respuesta({
      atleta: nombreDe(persona),
      mensajes: filas.map((m: any) => mensajeEn(m, persona, tecnicas)),
      sin_ver_del_atleta: filas.filter((m: any) => m.autor_id !== quien.id && !m.visto_en && !m.eliminado_en).length,
      ...(filas.length >= n ? { anterior: filas[0].creado_en, nota: 'Puede haber más atrás: manda "antes" con el valor de "anterior".' } : {}),
      ...(filas.length === 0 ? { nota: 'Todavía no hay mensajes en esta conversación.' } : {}),
      ...(!(await puedeEscribir(persona.id)) ? { se_puede_escribir: false } : {}),
    })
  }))

  server.registerTool('enviar_mensaje', {
    title: 'Mandarle un mensaje a un atleta',
    description: 'Le manda un mensaje de TEXTO a un atleta: lo verá en su app como un mensaje tuyo (y se le avisa). Lo mandado solo se puede borrar desde la app. Sin "confirmado": true NO manda nada y te devuelve el mensaje exacto que mandaría: enséñaselo a la persona y pregúntale si lo manda; si pide cambios, vuelve a mostrárselo. Con confirmado: true lo manda. Hasta 4000 caracteres; no manda archivos.',
    inputSchema: {
      atleta: z.string().describe('El atleta: su usuario (@juan), su nombre o su id.'),
      texto: z.string().describe('El mensaje, tal cual se va a mandar.'),
      confirmado: CONFIRMADO,
    },
    annotations: ENVIA,
  }, seguro(async ({ atleta, texto, confirmado }: any) => {
    const t = String(texto ?? '').trim()
    if (!t) throw new Aviso('El mensaje está vacío.')
    if (t.length > MAX_TEXTO) throw new Aviso(`El mensaje es demasiado largo (${t.length} caracteres; máximo ${MAX_TEXTO}).`)
    const persona = await buscarPersona(quien, atleta)
    if (!(await puedeEscribir(persona.id))) throw new Aviso(`No puedes escribirle a ${nombreDe(persona)} ahora: la conversación está cerrada (su cuenta o la tuya está desactivada, o ya no hay un vínculo con él o ella).`)
    if (!confirmado) {
      return respuesta({
        enviado: false,
        motivo: 'falta_confirmacion',
        va_a_pasar: `Se le mandará a ${nombreDe(persona)} este mensaje, que verá en su app como tuyo.`,
        mensaje: t,
        pista: 'Enséñale esto a la persona, tal cual. Si dice que sí, vuelve a llamar con confirmado: true.',
      })
    }
    const { data, error } = await quien.db.from('mensajes').insert({ atleta_id: persona.id, profesional_id: quien.id, autor_id: quien.id, tipo: 'texto', texto: t }).select('id, creado_en').single()
    if (error) {
      if (/row-level security|permission/i.test(error.message)) throw new Aviso(`No puedes escribirle a ${nombreDe(persona)}: no es tu atleta o la conversación está cerrada.`)
      throw new Error(error.message)
    }
    return respuesta({ listo: true, enviado: true, a: nombreDe(persona), id: data?.id, cuando: cuando(data?.creado_en) })
  }))

  server.registerTool('ver_tecnicas_por_revisar', {
    title: 'Ver las técnicas que esperan mi respuesta',
    description: 'Los videos de una serie («técnica») que tus atletas te mandaron y que todavía no contestas: de qué ejercicio, de quién, cuánto dura y cuándo lo mandó. Los más viejos primero. La IA NO ve el video: lo mira la persona en la app (Mensajes). Para contestar: responder_tecnica.',
    inputSchema: { atleta: z.string().optional().describe('Solo las de este atleta.') },
    annotations: SOLO_LEER,
  }, seguro(async ({ atleta }: any) => {
    const persona = atleta ? await buscarPersona(quien, atleta) : null
    let q = quien.db.from('tecnicas').select('*').eq('profesional_id', quien.id).eq('estado', 'por_revisar').eq('video_borrado', false).order('creada_en', { ascending: true })
    if (persona) q = q.eq('atleta_id', persona.id)
    const { data, error } = await q
    if (error) throw new Error(error.message)
    const lista = data ?? []
    const nombres = new Map<string, string>()
    const ids = [...new Set(lista.map((t: any) => t.atleta_id))]
    if (ids.length) for (const p of (await quien.db.from('profiles').select('id, full_name, username').in('id', ids)).data ?? []) nombres.set(p.id, nombreDe(p))
    return respuesta({
      por_revisar: lista.length,
      tecnicas: lista.map((t: any) => ({
        id: t.id,
        atleta: nombres.get(t.atleta_id) ?? persona?.full_name ?? '',
        ejercicio: t.ejercicio,
        ...(t.detalle ? { detalle: t.detalle } : {}),
        ...(t.segundos ? { segundos: t.segundos } : {}),
        mandada: cuando(t.creada_en),
        ...(t.intento_de ? { es_otro_intento: true } : {}),
      })),
      ...(lista.length === 0 ? { nota: 'No tienes técnicas por revisar.' } : { nota: 'La IA no ve los videos: los mira la persona en la app.' }),
    })
  }))

  server.registerTool('responder_tecnica', {
    title: 'Contestar la técnica de un atleta',
    description: 'Contesta el video de una serie que mandó un atleta: "correcta" (le llega «Técnica correcta») o "corregir" con tu texto (le llega como corrección, y puede mandar otro intento). SOLO si la persona YA VIO el video y decidió qué contestar: la IA no lo ve y nunca debe decidir el veredicto sola. Sin "confirmado": true NO manda nada y te devuelve lo que mandaría: enséñaselo a la persona.',
    inputSchema: {
      tecnica: z.string().describe('El id de la técnica (ver_tecnicas_por_revisar).'),
      veredicto: z.enum(['correcta', 'corregir']),
      texto: z.string().optional().describe('Solo con "corregir": la corrección, tal cual se va a mandar.'),
      confirmado: CONFIRMADO,
    },
    annotations: ENVIA,
  }, seguro(async ({ tecnica, veredicto, texto, confirmado }: any) => {
    const t = String(texto ?? '').trim()
    if (veredicto === 'corregir' && !t) throw new Aviso('Para corregir escribe la corrección ("texto").')
    if (t.length > MAX_TEXTO) throw new Aviso(`La corrección es demasiado larga (máximo ${MAX_TEXTO} caracteres).`)
    const { data: tec, error } = await quien.db.from('tecnicas').select('*').eq('id', String(tecnica).trim()).eq('profesional_id', quien.id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!tec) throw new Aviso('No encontré esa técnica entre las tuyas. Míralas con ver_tecnicas_por_revisar.')
    if (tec.estado !== 'por_revisar') throw new Aviso(`Esa técnica ya está respondida (${tec.estado}).`)
    if (tec.video_borrado) throw new Aviso('El video de esa técnica ya se borró.')
    const { data: p } = await quien.db.from('profiles').select('id, full_name, username').eq('id', tec.atleta_id).maybeSingle()
    const quienEs = p ? nombreDe(p as any) : 'el atleta'
    if (!confirmado) {
      return respuesta({
        enviado: false,
        motivo: 'falta_confirmacion',
        va_a_pasar: veredicto === 'correcta'
          ? `A ${quienEs} le llegará «Técnica correcta» sobre su video de ${tec.ejercicio}.`
          : `A ${quienEs} le llegará esta corrección sobre su video de ${tec.ejercicio}.`,
        ...(veredicto === 'corregir' ? { correccion: t } : {}),
        pista: 'Enséñale esto a la persona. Si dice que sí, vuelve a llamar con confirmado: true. Recuerda: solo si ella ya vio el video.',
      })
    }
    const { data: id, error: e2 } = await quien.db.rpc('responder_tecnica', { p_tecnica: tec.id, p_veredicto: veredicto, p_texto: veredicto === 'corregir' ? t : null, p_adjunto: null, p_marca: null })
    if (e2) throw new Aviso(e2.message)
    return respuesta({ listo: true, enviado: true, a: quienEs, ejercicio: tec.ejercicio, veredicto, mensaje_id: id })
  }))
}
