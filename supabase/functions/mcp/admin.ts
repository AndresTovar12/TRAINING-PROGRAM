// deno-lint-ignore-file no-explicit-any
import type { McpServer } from 'npm:@modelcontextprotocol/sdk@1.30.1/server/mcp.js'
import { z } from 'npm:zod@^4.1.13'
import { ANON_KEY, SUPABASE_URL } from './config.ts'
import { llamarFuncion, type Quien } from './sesion.ts'
import { Aviso, buscarPersona, nombreDe, respuesta, seguro, sinAcentos, type Persona } from './util.ts'

/**
 * Lo que solo puede el administrador (el master, dueño de la app). Andrés,
 * 25 sep 2026: desde su IA, "todo lo de la app". Las mismas reglas que en la
 * app las pone la base: si algo de aquí lo intentara un coach, la base lo
 * rechazaría aunque la herramienta existiera.
 */

const SOLO_LEER = { readOnlyHint: true, destructiveHint: false, openWorldHint: false } as const
const ESCRIBE = { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } as const
const BORRA = { readOnlyHint: false, destructiveHint: true, idempotentHint: false, openWorldHint: false } as const

async function buscarCoach(quien: Quien, ref: string): Promise<Persona> {
  const p = await buscarPersona(quien, ref, false)
  if (p.role !== 'admin' || p.is_owner) throw new Aviso(`${nombreDe(p)} no es coach.`)
  return p
}

/** Una contraseña de arranque que se lee y se dicta sin confundir letras. */
function contrasenaDeArranque() {
  const letras = 'abcdefghjkmnpqrstuvwxyz23456789'
  const b = new Uint8Array(10)
  crypto.getRandomValues(b)
  return `TL-${[...b].map((x) => letras[x % letras.length]).join('')}`
}

export function herramientasDelAdmin(server: McpServer, quien: Quien) {
  server.registerTool('listar_coaches', {
    title: 'Listar coaches',
    description: 'Todos los coaches de Training Lab, con cuántos atletas tiene cada uno y su código para que los atletas lo encuentren.',
    inputSchema: {},
    annotations: SOLO_LEER,
  }, seguro(async () => {
    const [coaches, atletas, enEquipo, compras] = await Promise.all([
      quien.db.from('profiles').select('id, username, full_name, profesion, codigo_coach, is_active, created_at').eq('role', 'admin').eq('is_owner', false).order('full_name'),
      quien.db.from('profiles').select('id, coach_id').eq('role', 'user'),
      quien.db.from('equipo').select('atleta_id, profesional_id').eq('estado', 'activo'),
      quien.db.from('compras').select('atleta_id, coach_id').in('estado', ['activa', 'gracia', 'por_armar']),
    ])
    if (coaches.error) throw new Error(coaches.error.message)
    // Directos (su coach principal) + los que lo tienen en su equipo + los que le compraron: sin repetir. Antes solo contaba los directos y un fisio que atiende a dos personas decía «0 atletas» (auditoría p74).
    const cuenta = new Map<string, number>()
    const total = new Map<string, Set<string>>()
    const mete = (pro: string | null, atleta: string | null) => { if (pro && atleta) { if (!total.has(pro)) total.set(pro, new Set()); total.get(pro)!.add(atleta) } }
    ;(atletas.data ?? []).forEach((a: any) => { if (a.coach_id) { cuenta.set(a.coach_id, (cuenta.get(a.coach_id) ?? 0) + 1); mete(a.coach_id, a.id) } })
    ;(enEquipo.data ?? []).forEach((r: any) => mete(r.profesional_id, r.atleta_id))
    ;(compras.data ?? []).forEach((r: any) => mete(r.coach_id, r.atleta_id))
    return respuesta({
      coaches: (coaches.data ?? []).map((c: any) => ({
        nombre: c.full_name || c.username,
        usuario: c.username,
        ...(c.profesion ? { oficio: c.profesion } : {}),
        atletas: total.get(c.id)?.size ?? 0,
        atletas_directos: cuenta.get(c.id) ?? 0,
        ...(c.codigo_coach ? { codigo: c.codigo_coach } : {}),
        activo: c.is_active,
        desde: c.created_at,
      })),
      tus_atletas_directos: cuenta.get(quien.id) ?? 0,
    })
  }))

  server.registerTool('ver_coach', {
    title: 'Ver un coach',
    description: 'Un coach: sus atletas y lo que tiene creado (ejercicios, categorías, tipos de sesión, plantillas).',
    inputSchema: { coach: z.string().describe('Usuario, nombre o id del coach.') },
    annotations: SOLO_LEER,
  }, seguro(async ({ coach }: any) => {
    const c = await buscarCoach(quien, coach)
    const cuenta = async (tabla: string, columna: string) => {
      const { count } = await quien.db.from(tabla).select('id', { count: 'exact', head: true }).eq(columna, c.id)
      return count ?? 0
    }
    const [{ data: atletas }, ejercicios, categorias, tipos, plantillas, enEquipo, compras] = await Promise.all([
      quien.db.from('profiles').select('id, username, full_name, is_active').eq('coach_id', c.id).order('full_name'),
      cuenta('exercises', 'created_by'),
      cuenta('exercise_categories', 'created_by'),
      cuenta('session_types', 'coach_id'),
      cuenta('routine_templates', 'created_by'),
      quien.db.from('equipo').select('atleta_id').eq('profesional_id', c.id).eq('estado', 'activo'),
      quien.db.from('compras').select('atleta_id').eq('coach_id', c.id).in('estado', ['activa', 'gracia', 'por_armar']),
    ])
    // Además de sus atletas directos: quienes lo tienen en su equipo o le compraron un programa (auditoría p74).
    const directos = new Set((atletas ?? []).map((a: any) => a.id))
    const otros = [...new Set([...(enEquipo.data ?? []), ...(compras.data ?? [])].map((r: any) => r.atleta_id).filter((id: string) => id && !directos.has(id)))]
    const { data: gente } = otros.length
      ? await quien.db.from('profiles').select('username, full_name, is_active').in('id', otros)
      : { data: [] as any[] }
    return respuesta({
      nombre: nombreDe(c),
      usuario: c.username,
      activo: c.is_active,
      atletas: (atletas ?? []).map((a: any) => ({ nombre: a.full_name || a.username, usuario: a.username, activo: a.is_active })),
      ...(gente?.length ? { tambien_atiende_por_equipo_o_compra: gente.map((a: any) => ({ nombre: a.full_name || a.username, usuario: a.username, activo: a.is_active })) } : {}),
      creado: { ejercicios, categorias, tipos_de_sesion: tipos, plantillas },
    })
  }))

  server.registerTool('cambiar_coach_de_atleta', {
    title: 'Cambiar el coach de un atleta',
    description: 'Pasa a un atleta con otro coach, o lo deja sin coach. Su plan y sus registros se quedan como están.',
    inputSchema: {
      atleta: z.string().describe('Usuario, nombre o id del atleta.'),
      coach: z.string().describe('Usuario, nombre o id del nuevo coach; "yo" para ti; "ninguno" para dejarlo sin coach.'),
    },
    annotations: ESCRIBE,
  }, seguro(async ({ atleta, coach }: any) => {
    const a = await buscarPersona(quien, atleta)
    const ref = sinAcentos(coach)
    const nuevo = ref === 'ninguno' || ref === 'nadie' ? null : ref === 'yo' ? { id: quien.id, full_name: quien.nombre, username: quien.usuario } : await buscarCoach(quien, coach)
    const { data, error } = await quien.db.from('profiles').update({ coach_id: nuevo?.id ?? null }).eq('id', a.id).select('id').maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Aviso('No se pudo cambiar el coach.')
    return respuesta({ listo: true, atleta: nombreDe(a), coach: nuevo ? nombreDe(nuevo as any) : 'sin coach' })
  }))

  server.registerTool('activar_o_desactivar_cuenta', {
    title: 'Activar o desactivar una cuenta',
    description: 'Desactiva una cuenta (no puede entrar y desaparece de las listas, pero conserva todo) o la vuelve a activar. Es lo normal del día a día; borrar es otra cosa.',
    inputSchema: {
      persona: z.string().describe('Usuario, nombre o id.'),
      activa: z.boolean().describe('true para activar, false para desactivar.'),
    },
    annotations: ESCRIBE,
  }, seguro(async ({ persona, activa }: any) => {
    const p = await buscarPersona(quien, persona, false)
    if (p.is_owner) throw new Aviso('La cuenta del administrador no se desactiva.')
    const { data, error } = await quien.db.from('profiles').update({ is_active: activa }).eq('id', p.id).select('id').maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Aviso('No se pudo cambiar.')
    return respuesta({ listo: true, persona: nombreDe(p), cuenta: activa ? 'activa' : 'desactivada' })
  }))

  server.registerTool('eliminar_cuenta', {
    title: 'Eliminar una cuenta para siempre',
    description: 'BORRA para siempre la cuenta de un atleta o de un coach: su acceso, su perfil, su plan, sus sesiones, pesos y bienestar. NO se puede deshacer. Antes de usarla, dile a la persona exactamente qué se pierde y pide que lo confirme; lo normal es desactivar (activar_o_desactivar_cuenta). Para un coach hay que decir a dónde van sus atletas y qué pasa con sus ejercicios.',
    inputSchema: {
      persona: z.string().describe('Usuario, nombre o id.'),
      atletas_a: z.string().optional().describe('Solo coach: usuario del coach que recibe a sus atletas, "yo", o "ninguno".'),
      ejercicios_a: z.enum(['master', 'borrar']).optional().describe('Solo coach: "master" para quedarte con sus ejercicios, "borrar" para borrarlos.'),
    },
    annotations: BORRA,
  }, seguro(async ({ persona, atletas_a, ejercicios_a }: any) => {
    const p = await buscarPersona(quien, persona, false)
    if (p.is_owner) throw new Aviso('La cuenta del administrador no se puede eliminar.')
    const esCoach = p.role === 'admin'
    let opciones: Record<string, unknown> = {}
    if (esCoach) {
      if (!atletas_a || !ejercicios_a) throw new Aviso(`${nombreDe(p)} es coach: di a dónde van sus atletas (atletas_a) y qué pasa con sus ejercicios (ejercicios_a).`)
      const ref = sinAcentos(atletas_a)
      const destino = ref === 'ninguno' ? null : ref === 'yo' ? quien.id : (await buscarCoach(quien, atletas_a)).id
      opciones = { atletasA: destino, ejerciciosA: ejercicios_a }
    }
    if (esCoach) {
      // Un coach que ya vendió: sus compras son de personas que pagaron y borrarlo las borraría con él (y la base lo rechaza a medio camino). Se desactiva (auditoría p121).
      const { count } = await quien.db.from('compras').select('*', { count: 'exact', head: true }).eq('coach_id', p.id)
      if ((count ?? 0) > 0) throw new Aviso(`${nombreDe(p)} ya vendió: tiene ${count} compra(s) de personas que pagaron. Eliminarlo las borraría con él. Mejor desactívalo con activar_o_desactivar_cuenta.`)
    }
    try {
      await llamarFuncion(quien, 'admin-delete-user', { id: p.id, ...opciones })
    } catch (e: any) {
      // Una cuenta con planes falla en la base («Database error deleting user»: cada plan guarda una versión a nombre de una persona que ya no existe). Lo mismo que hace la app:
      // se borran sus planes con la cuenta todavía viva y se reintenta UNA vez (auditoría p75).
      if (!/^No se pudo eliminar:/.test(e?.message ?? '')) throw e
      const { error } = await quien.db.from('plans').delete().eq('user_id', p.id)
      if (error) throw e
      await llamarFuncion(quien, 'admin-delete-user', { id: p.id, ...opciones })
    }
    return respuesta({ listo: true, eliminada: nombreDe(p), tipo: esCoach ? 'coach' : 'atleta' })
  }))

  server.registerTool('crear_coach', {
    title: 'Crear una cuenta de coach',
    description: 'Crea una cuenta de coach con una contraseña de arranque, que se devuelve UNA vez para que se la pases; la puede cambiar al entrar. Si quien va a ser coach ya tiene cuenta de atleta, usa hacer_coach.',
    inputSchema: {
      usuario: z.string().describe('Usuario para entrar: minúsculas, números, punto o guion bajo.'),
      nombre: z.string().describe('Nombre y apellido.'),
      correo: z.string().email().optional(),
    },
    annotations: ESCRIBE,
  }, seguro(async ({ usuario, nombre, correo }: any) => {
    const password = contrasenaDeArranque()
    // El mismo camino que "Crear coach" en la app: la función de registro.
    const res = await fetch(`${SUPABASE_URL}/functions/v1/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
      body: JSON.stringify({ username: usuario, full_name: nombre, email: correo || undefined, password, account_type: 'coach' }),
    }).catch(() => null)
    if (!res) throw new Error('No se pudo contactar al servidor.')
    const cuerpo = await res.json().catch(() => ({}))
    if (!res.ok) throw new Aviso(cuerpo?.error || 'No se pudo crear el coach.')
    return respuesta({
      listo: true,
      coach: nombre,
      usuario,
      contrasena_de_arranque: password,
      mensaje: 'Pásale su usuario y esta contraseña. Puede cambiarla en su perfil.',
    })
  }))

  server.registerTool('hacer_coach', {
    title: 'Hacer coach a una persona',
    description: 'Convierte en coach a alguien que ya tiene cuenta de atleta. Deja de tener coach propio.',
    inputSchema: { persona: z.string().describe('Usuario, nombre o id.') },
    annotations: ESCRIBE,
  }, seguro(async ({ persona }: any) => {
    const p = await buscarPersona(quien, persona)
    const { data, error } = await quien.db.from('profiles').update({ role: 'admin', coach_id: null }).eq('id', p.id).select('id').maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) throw new Aviso('No se pudo cambiar.')
    return respuesta({ listo: true, persona: nombreDe(p), ahora_es: 'coach' })
  }))
}
