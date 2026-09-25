import { createClient, type SupabaseClient } from 'jsr:@supabase/supabase-js@2'
import { ANON_KEY, SUPABASE_URL } from './config.ts'

/**
 * Quién está llamando, y con qué permisos.
 *
 * LA DECISIÓN DE FONDO (tomada antes de escribir una línea): la IA entra
 * HACIÉNDOSE PASAR POR LA PERSONA. Cada consulta a la base viaja con el token
 * de esa persona, así que las reglas de aislamiento (RLS) aplican solas: un
 * coach no ve atletas ajenos por la IA por la misma razón que no los ve en la
 * app. La otra forma —entrar como administrador y filtrar a mano— es donde se
 * cuelan las fugas, y una fuga de permisos no da ningún error: simplemente pasa.
 */

export type Rol = 'atleta' | 'coach' | 'master'

export interface Quien {
  id: string
  usuario: string
  nombre: string
  rol: Rol
  coachId: string | null
  unidad: 'kg' | 'lb'
  genero: string | null
  /** El cliente OAuth (Claude, ChatGPT…) si el token vino de uno. */
  clienteId: string | null
  token: string
  /** Cliente de la base con el token de la persona: RLS de la persona. */
  db: SupabaseClient
}

/** El token no sirve: la IA tiene que volver a pedir permiso. */
export class TokenInvalido extends Error {}

/** El token sirve, pero la cuenta no puede usar esto. */
export class SinPermiso extends Error {}

const opcionesSinSesion = { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } }

/** Lo de adentro de un JWT, sin verificarlo (ya lo verificó Supabase Auth). */
function reclamos(token: string): Record<string, unknown> {
  try {
    const cuerpo = token.split('.')[1]
    const json = atob(cuerpo.replace(/-/g, '+').replace(/_/g, '/'))
    return JSON.parse(json)
  } catch {
    return {}
  }
}

export async function quienLlama(token: string): Promise<Quien> {
  /* `getUser` y no solo revisar la firma: pregunta a Supabase Auth si la
     sesión sigue viva. Si la persona desconectó su IA desde la app, el token
     deja de servir en ese instante y no hasta que caduque. */
  const anon = createClient(SUPABASE_URL, ANON_KEY, opcionesSinSesion)
  const { data, error } = await anon.auth.getUser(token)
  if (error || !data?.user) throw new TokenInvalido('La sesión ya no es válida')

  const db = createClient(SUPABASE_URL, ANON_KEY, {
    ...opcionesSinSesion,
    global: { headers: { Authorization: `Bearer ${token}` } },
  })

  const { data: perfil, error: errPerfil } = await db
    .from('profiles')
    .select('id, username, full_name, role, is_owner, coach_id, is_active, unidad_peso, genero')
    .eq('id', data.user.id)
    .maybeSingle()
  if (errPerfil) throw new Error(errPerfil.message)
  if (!perfil) throw new SinPermiso('Tu cuenta no tiene perfil en Training Lab.')
  if (!perfil.is_active) throw new SinPermiso('Tu cuenta de Training Lab está desactivada. Habla con tu coach.')

  const rol: Rol = perfil.role === 'admin' ? (perfil.is_owner ? 'master' : 'coach') : 'atleta'
  const clienteId = reclamos(token).client_id

  return {
    id: perfil.id,
    usuario: perfil.username,
    nombre: perfil.full_name || perfil.username,
    rol,
    coachId: perfil.coach_id ?? null,
    unidad: perfil.unidad_peso === 'lb' ? 'lb' : 'kg',
    genero: perfil.genero ?? null,
    clienteId: typeof clienteId === 'string' ? clienteId : null,
    token,
    db,
  }
}

/**
 * Llama a otra función de la app COMO la persona. Algunas cosas —crear la
 * cuenta de un atleta invitado, borrar una cuenta— necesitan la llave maestra
 * y ya viven en su propia función, con su propia revisión de permisos. Aquí
 * se reusan tal cual en vez de copiar esa lógica: dos copias de una regla de
 * permisos es como una de las dos se queda vieja.
 */
export async function llamarFuncion(quien: Quien, nombre: string, cuerpo: unknown) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${nombre}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
      Authorization: `Bearer ${quien.token}`,
    },
    body: JSON.stringify(cuerpo),
  }).catch(() => null)
  if (!res) throw new Error('No se pudo contactar al servidor de Training Lab.')
  const datos = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(datos?.error || `La operación falló (error ${res.status}).`)
  return datos
}
