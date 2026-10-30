import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * El otro lado del link de invitación: lo que pasa cuando el atleta lo abre.
 *
 * Tiene tres modos porque son tres momentos distintos:
 *   ver      -> antes de llenar nada, para saludarlo por su nombre y decirle
 *               quién es su coach. Si no, el link sería una pantalla en blanco
 *               pidiendo datos, y nadie sabe si es de fiar.
 *   activar  -> ya con su usuario y su contraseña.
 *   reclamar -> entró con Apple o Google (inicio nuevo, 30 oct 2026). Esa
 *               entrada crea una cuenta NUEVA (`handle_new_user`), distinta de
 *               la que el coach dejó lista. Aquí la cuenta nueva se queda con
 *               el lugar de la de relleno (ver abajo, en su modo).
 *
 * Quien abre el link NO tiene sesión todavía, así que todo pasa por aquí con
 * la llave de servicio. Por eso se devuelve lo mínimo: el nombre que puso el
 * coach y el del coach. Nunca el correo ni nada más de esa cuenta.
 *
 * El link no vence por tiempo (decisión de Andrés, 24 sep 2026). Deja de
 * servir por tres caminos, todos en manos del coach o del propio uso:
 *   - ya se usó
 *   - el coach desactivó al atleta
 *   - el coach eliminó al atleta (la invitación se borra en cascada)
 */

const DEFAULT_ORIGINS = [
  'http://localhost:5173', 'capacitor://localhost', /* app de iPhone (Capacitor) */
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'https://app.traininglabapp.com',  // dominio propio (15 oct 2026)
  'https://training-program-kappa.vercel.app', // despliegue anterior en Vercel (mismo dueño); ya NO vale cualquier *.vercel.app
]
const envOrigins = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean)
const ALLOWED = new Set([...DEFAULT_ORIGINS, ...envOrigins])

function corsHeaders(origin: string | null): Record<string, string> {
  const allow =
    origin && ALLOWED.has(origin)
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

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/
// En un patrón de LIKE el «_» vale «cualquier letra» y el «%» «cualquier cosa»: para buscar un usuario EXACTO se escapan (p142). Igual que `src/lib/escapaLike.js`.
const escapaLike = (t: string) => t.replace(/[\\%_]/g, '\\$&')
const CADUCO = 'Este link ya no sirve. Pídele uno nuevo a tu entrenador.'

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')

  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origin)

  let p: {
    token?: string; modo?: string; username?: string
    password?: string; email?: string; genero?: string
    nombre?: string; apellido?: string
  }
  try {
    p = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400, origin)
  }

  const token = (p.token ?? '').trim()
  const modo = (p.modo ?? 'ver').trim()
  if (!token) return json({ error: 'Falta el link' }, 400, origin)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: inv } = await admin
    .from('invitaciones')
    .select('token, coach_id, atleta_id, tipo, usada_en, nombre, apellido')
    .eq('token', token)
    .maybeSingle()

  if (!inv || inv.usada_en) return json({ error: CADUCO }, 404, origin)
  if (!inv.atleta_id) return json({ error: CADUCO }, 404, origin)

  const { data: atleta } = await admin
    .from('profiles')
    .select('id, full_name, username, is_active, perfil_completo')
    .eq('id', inv.atleta_id)
    .maybeSingle()

  // Desactivado por el coach, o ya activado por el propio atleta.
  if (!atleta || atleta.perfil_completo === true) return json({ error: CADUCO }, 404, origin)
  // Reclamar decide solo lo de la cuenta de relleno desactivada: si la desactivó un reclamo que se quedó a medias, se deja terminar.
  if (modo === 'reclamar') return reclamar(admin, req, inv, atleta, origin)
  if (atleta.is_active === false) return json({ error: CADUCO }, 404, origin)

  const { data: coach } = await admin
    .from('profiles')
    .select('full_name, username, profesion')
    .eq('id', inv.coach_id)
    .maybeSingle()

  const coachNombre = coach?.full_name || coach?.username || 'tu entrenador'

  if (modo === 'ver') {
    /* Se manda el nombre y el apellido por separado, para enseñárselos ya
       puestos y que los pueda corregir.

       NO se manda ningún usuario sugerido, a propósito. Andrés, 24 sep 2026:
       "eliges por el cliente su usuario, justo eso es lo que le tienes que
       dejar a él que elija". Lo que se llena por él es su nombre, que el coach
       ya sabe; el usuario es cosa suya. */
    /* Respaldo para las invitaciones hechas antes de guardar las dos columnas:
       se parte el nombre completo por el primer espacio. Es una apuesta —de
       "Ana María Pérez" saldría nombre "Ana"— pero el atleta tiene los dos
       campos delante y los puede corregir, que era justamente el punto. Solo
       aplica a las invitaciones viejas; las nuevas traen el dato exacto. */
    let nombre = inv.nombre
    let apellido = inv.apellido
    if (!nombre) {
      const partes = (atleta.full_name || '').trim().split(/\s+/)
      nombre = partes.shift() || ''
      apellido = partes.join(' ')
    }

    return json({
      ok: true,
      nombre: nombre || '',
      apellido: apellido || '',
      coach: coachNombre,
      // La pastilla de la puerta: «Carlos Vega te invitó · Entrenador personal».
      coach_oficio: coach?.profesion || '',
    }, 200, origin)
  }

  if (modo !== 'activar') return json({ error: 'Modo desconocido' }, 400, origin)

  const username = (p.username ?? '').trim()
  const password = p.password ?? ''
  const email = (p.email ?? '').trim().toLowerCase()
  // El atleta puede corregir lo que puso el coach. Si lo deja tal cual llega
  // igual, así que no hay que distinguir un caso del otro.
  const nombre = (p.nombre ?? '').trim().slice(0, 60)
  const apellido = (p.apellido ?? '').trim().slice(0, 60)
  const nombreFinal = [nombre, apellido].filter(Boolean).join(' ') || atleta.full_name
  const generoCrudo = (p.genero ?? '').trim().toLowerCase()
  const genero = generoCrudo === 'h' || generoCrudo === 'm' ? generoCrudo : null

  if (!USERNAME_RE.test(username)) {
    return json({ error: 'El usuario debe tener 3-30 caracteres (letras, números, _ o .)' }, 400, origin)
  }
  if (password.length < 8) {
    return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400, origin)
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'Correo inválido' }, 400, origin)
  }

  // Usuario libre. Se excluye el suyo propio: el coach ya le reservó uno al
  // darlo de alta, y si lo deja tal cual no debe chocar consigo mismo.
  const { data: tomado } = await admin
    .from('profiles')
    .select('id')
    .ilike('username', escapaLike(username))
    .neq('id', atleta.id)
    .maybeSingle()
  if (tomado) return json({ error: 'Ese nombre de usuario ya está en uso' }, 409, origin)

  // La cuenta nace SIEMPRE con su correo interno, igual que en `signup` (lote 1 de seguridad, 25 oct 2026): el correo que escribió
  // no se da por bueno hasta que teclee el código de 6 números. Viaja de vuelta como `correo_pendiente` y la app manda el código
  // enseguida (inicio nuevo, 30 oct 2026: «Escribe el código», en la misma pantalla del correo). Antes se guardaba ya confirmado.
  const correoFinal = `${username.toLowerCase()}@sin-correo.traininglabapp.com`
  const correoPendiente = email && !/@(sin-correo\.)?traininglab(app\.com|\.app)$/i.test(email) ? email : null

  const { error: errAuth } = await admin.auth.admin.updateUserById(atleta.id, {
    email: correoFinal,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: nombreFinal, role: 'user' },
  })
  if (errAuth) {
    const crudo = textoDeError(errAuth)
    console.error('updateUserById falló:', crudo)
    const msg = /already|exists|duplicate/i.test(crudo)
      ? 'Ese correo ya está registrado. Usa otro, o déjalo vacío.'
      : `No se pudo activar la cuenta: ${crudo}`
    return json({ error: msg }, 400, origin)
  }

  const { error: errPerfil } = await admin
    .from('profiles')
    // `inicio_paso`: lo que falta por contestar sigue en la app, pantalla por pantalla
    // («Sobre ti», el paso de Salud y la bienvenida). Ver `features/inicio`.
    .update({ username, email: correoFinal, genero, full_name: nombreFinal, perfil_completo: true, inicio_paso: 'sobre' })
    .eq('id', atleta.id)
  if (errPerfil) {
    return json({ error: `No se pudo guardar el perfil: ${textoDeError(errPerfil)}` }, 400, origin)
  }

  await admin.from('invitaciones').update({ usada_en: new Date().toISOString() }).eq('token', token)

  return json({ ok: true, email: correoFinal, username, correo_pendiente: correoPendiente }, 200, origin)
})

/* RECLAMAR LA INVITACIÓN CON APPLE O GOOGLE (inicio nuevo, 30 oct 2026). «Entra con Apple o Google y ya quedas con Carlos. Nada que llenar.»

   El coach ya dio de alta al atleta (`invitar-atleta`): una cuenta de RELLENO, con correo inventado, a la que pudo empezar a armarle el plan y
   mandarle mensajes. Apple y Google no entran a esa cuenta: crean una nueva. Así que aquí la nueva se queda con el lugar de la de relleno:
     1. La de relleno sale de la lista del coach (sin coach y desactivada). Va ANTES de poner el coach en la nueva: el tope de atletas
        (`cuida_limite_de_atletas`) cuenta a la de relleno, y con las dos a la vez un coach con su lista llena no podría recibirla. No se borra:
        borrar cuentas con planes choca con `plan_versiones` y no hace falta.
     2. La nueva queda con su coach, su nombre (si Apple no lo dio, el que puso el coach), `perfil_completo` y `inicio_paso = 'sobre'`. Si falla,
        la de relleno regresa a su lugar.
     3. Lo que el coach ya le hizo pasa a la cuenta nueva: planes y sus versiones, rutinas, equipo, notas de consulta, mensajes, umbrales y
        videos para él. Si no, el plan que le estaba armando se quedaría en una cuenta que nadie usa.
     4. La invitación queda usada.
   Solo una cuenta recién creada (`perfil_completo = false`, sin coach) puede reclamar: así nadie se cuelga de un link ajeno con una cuenta ya armada.
   Si un reclamo se quedó a medias (falló el paso 3), la misma cuenta lo repite: los pasos 1 y 2 ya están y el 3 se puede hacer dos veces. */
// deno-lint-ignore no-explicit-any
async function reclamar(admin: any, req: Request, inv: any, relleno: any, origin: string | null) {
  const portador = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  const { data: quien } = portador ? await admin.auth.getUser(portador) : { data: null }
  const nuevo = quien?.user
  if (!nuevo) return json({ error: 'Tu sesión expiró. Vuelve a entrar con Apple o Google.' }, 401, origin)
  if (nuevo.id === relleno.id) return json({ error: CADUCO }, 404, origin)

  const { data: perfil } = await admin.from('profiles').select('id, full_name, coach_id, perfil_completo, is_active').eq('id', nuevo.id).maybeSingle()
  if (!perfil || perfil.is_active === false) return json({ error: 'No encontramos tu cuenta. Vuelve a entrar.' }, 404, origin)
  // Ya es suya: un reclamo anterior de esta misma cuenta se quedó a medias.
  const aMedias = perfil.coach_id === inv.coach_id && relleno.is_active === false
  if (!aMedias && relleno.is_active === false) return json({ error: CADUCO }, 404, origin)
  if (!aMedias && (perfil.perfil_completo === true || perfil.coach_id)) {
    return json({ error: 'Esta cuenta ya estaba lista. Para usar la invitación, sal y entra con otra cuenta, o pídele a tu entrenador su código.', codigo: 'CUENTA_LISTA' }, 409, origin)
  }

  if (!aMedias) {
    // 1. La de relleno sale de la lista del coach.
    const { error: errRelleno } = await admin.from('profiles').update({ coach_id: null, is_active: false }).eq('id', relleno.id)
    if (errRelleno) return json({ error: `No se pudo usar la invitación: ${textoDeError(errRelleno)}` }, 500, origin)

    // 2. La nueva, con su coach.
    const nombreDelCoach = [inv.nombre, inv.apellido].filter(Boolean).join(' ').trim() || (relleno.full_name || '').trim()
    const cambios: Record<string, unknown> = { coach_id: inv.coach_id, role: 'user', perfil_completo: true, inicio_paso: 'sobre' }
    if (!(perfil.full_name || '').trim() && nombreDelCoach) cambios.full_name = nombreDelCoach.slice(0, 120)
    const { error: errNuevo } = await admin.from('profiles').update(cambios).eq('id', nuevo.id)
    if (errNuevo) {
      // Se regresa la de relleno a su lugar: el coach no pierde a su atleta por un fallo a medias.
      await admin.from('profiles').update({ coach_id: inv.coach_id, is_active: true }).eq('id', relleno.id)
      const crudo = textoDeError(errNuevo)
      const msg = /LIMITE_DE_ATLETAS/.test(crudo) ? 'Tu entrenador ya no puede recibir más atletas por ahora. Avísale.' : `No se pudo usar la invitación: ${crudo}`
      return json({ error: msg }, 400, origin)
    }
  }

  // 3. Lo de la cuenta de relleno, a la nueva. Cada tabla por separado: si una falla, se dice y no se marca la invitación (se puede repetir).
  const mover: [string, string][] = [
    ['plans', 'user_id'], ['plan_versiones', 'user_id'], ['user_routines', 'user_id'], ['equipo', 'atleta_id'],
    ['notas_consulta', 'atleta_id'], ['mensajes', 'atleta_id'], ['umbrales_atleta', 'atleta_id'], ['exercise_media', 'para_atleta'],
  ]
  for (const [tabla, col] of mover) {
    const { error } = await admin.from(tabla).update({ [col]: nuevo.id }).eq(col, relleno.id)
    if (error) {
      console.error(`reclamar: mover ${tabla}:`, textoDeError(error))
      return json({ error: 'No se pudo pasar a tu cuenta lo que tu entrenador ya te preparó. Inténtalo de nuevo.' }, 500, origin)
    }
  }

  // 4. La invitación, usada.
  await admin.from('invitaciones').update({ usada_en: new Date().toISOString() }).eq('token', inv.token)
  return json({ ok: true }, 200, origin)
}
