import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Da de alta a un atleta por adelantado y devuelve su link de invitación.
 *
 * POR QUÉ EXISTE. Andrés, 24 sep 2026: "que el coach pueda agregar un atleta
 * por sí mismo... que la app le pida Nombre y Apellido (QUE NO LE PIDA
 * CORREO)... desde que el coach genera el link, el cliente se agrega a su
 * lista y puede ir trabajando en el atleta aunque el atleta aún no active su
 * cuenta".
 *
 * Esa última frase es la que manda el diseño. Para poder armarle el plan, el
 * atleta tiene que EXISTIR como perfil desde ya: los planes cuelgan de
 * `profiles`, y `profiles` cuelga de la tabla de cuentas. Así que aquí se crea
 * la cuenta entera, con un correo inventado y una contraseña que nadie sabe.
 * El atleta le pone las suyas al abrir el link.
 *
 * Inventar el correo no es un truco nuevo de aquí: `signup` ya lo hace cuando
 * alguien se registra sin dar correo.
 */

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
]
const envOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const ALLOWED = new Set([...DEFAULT_ORIGINS, ...envOrigins])

function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    origin && (ALLOWED.has(origin) || /\.vercel\.app$/.test(new URL(origin).hostname))
      ? origin
      : DEFAULT_ORIGINS[0]
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

/** JSON.stringify sobre un Error devuelve "{}". Ver el mismo apaño en `signup`. */
function textoDeError(e: unknown): string {
  if (!e) return 'Error desconocido'
  if (typeof e === 'string') return e
  const any = e as Record<string, unknown>
  for (const campo of ['message', 'msg', 'error_description', 'error', 'details', 'hint']) {
    const v = any[campo]
    if (typeof v === 'string' && v.trim() && v.trim() !== '{}') return v
  }
  return String(e)
}

/** Texto aleatorio para el token y para la contraseña de mientras. */
function alAzar(bytes: number): string {
  const b = new Uint8Array(bytes)
  crypto.getRandomValues(b)
  return btoa(String.fromCharCode(...b)).replace(/[+/=]/g, '').slice(0, bytes * 2)
}

/**
 * Propone un usuario a partir del nombre: "Juan Pérez" -> "juan.perez".
 *
 * Es solo una propuesta. El disparador `handle_new_user` le añade un número si
 * ya está tomado, y el atleta puede cambiarlo al activar su cuenta. Se quitan
 * los acentos porque el usuario solo admite letras, números, guion bajo y punto.
 */
function usuarioSugerido(nombre: string, apellido: string): string {
  const limpia = (s: string) =>
    s.normalize('NFD').replace(/[̀-ͯ]/g, '')
      .toLowerCase().replace(/[^a-z0-9]/g, '')
  const a = limpia(nombre)
  const b = limpia(apellido)
  const junto = [a, b].filter(Boolean).join('.')
  return junto.length >= 3 ? junto.slice(0, 24) : 'atleta'
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origin)

  let p: { nombre?: string; apellido?: string }
  try {
    p = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400, origin)
  }

  const nombre = (p.nombre ?? '').trim().slice(0, 60)
  const apellido = (p.apellido ?? '').trim().slice(0, 60)
  if (!nombre) return json({ error: 'Falta el nombre del cliente' }, 400, origin)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  // Quién pide. Se saca del token de la sesión, nunca del cuerpo: si viniera
  // en el cuerpo, cualquiera podría dar de alta atletas a nombre de otro coach.
  const auth = req.headers.get('Authorization') ?? ''
  const { data: quien } = await admin.auth.getUser(auth.replace('Bearer ', ''))
  const quienPide = quien?.user?.id
  if (!quienPide) return json({ error: 'Sesión no válida' }, 401, origin)

  const { data: yo } = await admin
    .from('profiles')
    .select('id, role, is_active')
    .eq('id', quienPide)
    .maybeSingle()
  if (!yo || yo.role !== 'admin' || yo.is_active === false) {
    return json({ error: 'Solo un coach con la cuenta activa puede agregar atletas' }, 403, origin)
  }

  const nombreCompleto = [nombre, apellido].filter(Boolean).join(' ')
  const usuario = usuarioSugerido(nombre, apellido)

  // Correo de relleno. `@traininglab.app` es el mismo dominio inventado que ya
  // usa `signup`, y el trozo al azar evita chocar con otro atleta del mismo
  // nombre. Se reemplaza por el de verdad si el atleta decide dar uno.
  const correoRelleno = `pendiente.${alAzar(8).toLowerCase()}@traininglab.app`

  const { data: creado, error: errCrear } = await admin.auth.admin.createUser({
    email: correoRelleno,
    // Nadie conoce esta contraseña, ni hace falta: el atleta pone la suya al
    // abrir el link, y sin activar no puede entrar de ninguna forma.
    password: alAzar(24),
    email_confirm: true,
    user_metadata: { username: usuario, full_name: nombreCompleto, role: 'user' },
  })
  if (errCrear) {
    console.error('createUser falló:', textoDeError(errCrear))
    return json({ error: `No se pudo crear el atleta: ${textoDeError(errCrear)}` }, 400, origin)
  }

  const atletaId = creado.user?.id
  if (!atletaId) return json({ error: 'No se pudo crear el atleta' }, 400, origin)

  // El disparador ya dejó el perfil con usuario y nombre. Aquí se le pone el
  // coach y se le marca el perfil como incompleto, que es lo que hace que la
  // app le pida el resto cuando por fin entre.
  const { error: errPerfil } = await admin
    .from('profiles')
    .update({ coach_id: quienPide, role: 'user', perfil_completo: false })
    .eq('id', atletaId)
  if (errPerfil) {
    // Sin perfil correcto, el atleta quedaría suelto y sin coach. Se deshace
    // el alta entera en vez de dejar basura a medias.
    await admin.auth.admin.deleteUser(atletaId).catch(() => {})
    return json({ error: `No se pudo enlazar el atleta: ${textoDeError(errPerfil)}` }, 400, origin)
  }

  const token = alAzar(24)
  const { error: errInv } = await admin
    .from('invitaciones')
    .insert({ token, coach_id: quienPide, atleta_id: atletaId, tipo: 'personal' })
  if (errInv) {
    await admin.auth.admin.deleteUser(atletaId).catch(() => {})
    return json({ error: `No se pudo crear la invitación: ${textoDeError(errInv)}` }, 400, origin)
  }

  return json({ ok: true, token, atleta_id: atletaId, usuario, full_name: nombreCompleto }, 200, origin)
})
