import { createClient } from 'jsr:@supabase/supabase-js@2'

// Orígenes permitidos (CORS). Se puede sobreescribir con ALLOWED_ORIGINS (coma-separado).
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

/**
 * Convierte cualquier error en texto legible.
 *
 * Existe por un bug real: al registrarse salia literalmente "{}" en pantalla.
 * Causa: JSON.stringify() sobre un Error de JavaScript SIEMPRE devuelve "{}",
 * porque las propiedades de Error no son enumerables. El mensaje verdadero se
 * perdia y la persona no tenia forma de saber que hacer.
 */
function textoDeError(e: unknown): string {
  if (!e) return 'Error desconocido'
  if (typeof e === 'string') return e
  const any = e as Record<string, unknown>
  for (const campo of ['message', 'msg', 'error_description', 'error', 'details', 'hint']) {
    const v = any[campo]
    if (typeof v === 'string' && v.trim() && v.trim() !== '{}') return v
  }
  try {
    const s = JSON.stringify(e)
    if (s && s !== '{}') return s
  } catch { /* no serializable */ }
  return String(e)
}

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/

// En un patrón de LIKE el «_» vale «cualquier letra» y el «%» «cualquier cosa»: para buscar un usuario EXACTO se escapan (p142). Igual que `src/lib/escapaLike.js`.
const escapaLike = (t: string) => t.replace(/[\\%_]/g, '\\$&')

// Los correos que la app inventa para quien se registra sin correo (nadie los recibe). Igual que `src/lib/correos.js`.
const DOMINIOS_SIN_BUZON = ['sin-correo.traininglabapp.com', 'traininglab.app']
const esCorreoInterno = (c: string) => {
  const d = c.slice(c.lastIndexOf('@') + 1).toLowerCase()
  return DOMINIOS_SIN_BUZON.some((x) => d === x || d.endsWith(`.${x}`))
}

/**
 * ¿Ese profesional ya llenó los atletas que puede agregar? Se revisa ANTES de
 * crear la cuenta para no dejar un atleta a medias. La base también lo impide
 * con un disparador (`cuida_limite_de_atletas`).
 */
async function profesionalLleno(
  admin: ReturnType<typeof createClient>,
  profesional: string,
): Promise<boolean> {
  const { data: limite } = await admin.rpc('limite_de_atletas', { p: profesional })
  if (typeof limite !== 'number' || limite < 0) return false
  const { data: usados } = await admin.rpc('atletas_a_mano', { p: profesional })
  return (typeof usados === 'number' ? usados : 0) >= limite
}

const AVISO_LLENO =
  'Este entrenador ya no puede recibir más atletas por ahora. Avísale, o crea tu cuenta sin entrenador y únete después.'

/* FRENOS (lote 1 de seguridad, 25 oct 2026). Antes habia UN tope global (300 por hora) que cualquiera podia agotar para dejar sin comprar a todos.
   Ahora se cuenta por IP y por identificador (correo o cuenta) en `frenos_de_uso`, y cada quien se topa solo con lo suyo.
   La IP sale de `cf-connecting-ip`: la pone Cloudflare (delante de Supabase) y el cliente no la puede cambiar (probado: mandarla falsa da 403, y
   `x-forwarded-for` se reescribe). Si el libro falla, NO se bloquea a nadie (mejor dejar pasar que dejar sin entrar al atleta legitimo). */
function ipDe(req: Request): string {
  const cf = (req.headers.get('cf-connecting-ip') ?? '').trim()
  if (cf) return cf
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sin-ip'
}

// deno-lint-ignore no-explicit-any
async function pasaElFreno(bd: any, ambito: string, clave: string, limite: number, segundos = 3600): Promise<boolean> {
  try {
    const desde = new Date(Date.now() - segundos * 1000).toISOString()
    const { count, error } = await bd.from('frenos_de_uso').select('id', { count: 'exact', head: true }).eq('ambito', ambito).eq('clave', clave).gte('creado_en', desde)
    if (error) { console.error('frenos_de_uso (contar):', error.message); return true }
    if ((count ?? 0) >= limite) return false
    const { error: errInsert } = await bd.from('frenos_de_uso').insert({ ambito, clave })
    if (errInsert) console.error('frenos_de_uso (anotar):', errInsert.message)
    // De vez en cuando se tiran las filas de hace mas de un dia, para que el libro no crezca sin fin.
    if (Math.random() < 0.02) await bd.from('frenos_de_uso').delete().lt('creado_en', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    return true
  } catch (e) {
    console.error('frenos_de_uso:', e instanceof Error ? e.message : e)
    return true
  }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders(origin) })
  }
  if (req.method !== 'POST') {
    return json({ error: 'Método no permitido' }, 405, origin)
  }

  let payload: {
    username?: string; email?: string; password?: string; full_name?: string
    account_type?: string; coach_username?: string; genero?: string
    profesion?: string; inicio_paso?: string
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'JSON inválido' }, 400, origin)
  }

  const username = (payload.username ?? '').trim()
  const fullName = (payload.full_name ?? '').trim()
  const password = payload.password ?? ''
  let email = (payload.email ?? '').trim().toLowerCase()
  const accountType = (payload.account_type ?? 'athlete').trim().toLowerCase()
  // Puede venir el CÓDIGO del coach o su usuario: la base resuelve los dos.
  const coachRef = (payload.coach_username ?? '').trim()

  // Genero: 'h', 'm', o nada. Se pregunta al darse de alta porque ahi es donde
  // la gente si contesta. Estaba solo en "Mi perfil", escondido, y el resultado
  // fue que 11 de 11 personas lo tenian vacio — asi que los videos por genero
  // que grabaran los coaches no se los iba a ver nadie.
  //
  // Es opcional a proposito. Si no contesta, se le muestra el video general:
  // adivinarle el genero y enseñarle el equivocado es peor que no saberlo.
  const generoCrudo = (payload.genero ?? '').trim().toLowerCase()
  const genero = generoCrudo === 'h' || generoCrudo === 'm' ? generoCrudo : null

  // A qué se dedica quien entrena a otros. Es una etiqueta, no un permiso: el
  // rol lo sigue decidiendo `account_type`. Se corta a 40 para que un cliente
  // que mande basura no llene la columna.
  const profesion = (payload.profesion ?? '').trim().slice(0, 40) || null

  // El inicio nuevo (8 oct 2026) crea la cuenta con lo mínimo y pregunta lo demás
  // DESPUÉS, pantalla por pantalla. Aquí se deja apuntado cuál es la siguiente para
  // que, si la persona cierra a la mitad, al volver retome donde iba. Lista cerrada:
  // un cliente no puede mandar a la app a una pantalla que no existe.
  const PASOS = new Set(['nombre', 'oficio', 'entrena', 'equipo', 'repertorio', 'codigo', 'sexo', 'unidad', 'nacimiento', 'listo'])
  const inicioPaso = PASOS.has(payload.inicio_paso ?? '') ? payload.inicio_paso! : null

  if (!USERNAME_RE.test(username)) {
    return json(
      { error: 'El usuario debe tener 3-30 caracteres (letras, números, _ o .)' },
      400,
      origin,
    )
  }
  if (password.length < 8) {
    return json({ error: 'La contraseña debe tener al menos 8 caracteres' }, 400, origin)
  }
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
    return json({ error: 'Correo inválido' }, 400, origin)
  }
  const isCoach = accountType === 'coach'

  // OJO: el rol que guarda la base es 'admin' o 'user'. NO 'athlete'.
  // La tabla profiles tiene CHECK (role IN ('admin','user')), asi que mandar
  // 'athlete' hacia fallar TODO registro de atleta con un error 500 de
  // Postgres que ademas llegaba en blanco al usuario. "athlete" es como se
  // llama el tipo de cuenta en la interfaz; 'user' es como se llama el rol en
  // la base. Son dos vocabularios distintos y hay que traducir aqui.
  const role = isCoach ? 'admin' : 'user'

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  /* EL CORREO QUE ESCRIBE QUIEN SE REGISTRA NO SE DA POR BUENO (lote 1 de seguridad, 25 oct 2026).

     Antes se creaba la cuenta con ese correo YA CONFIRMADO. Cualquiera podia registrarse con el correo de otra
     persona: la dejaba sin poder usar su propio correo y, si esa persona entraba despues con Google o Apple,
     el sistema juntaba las dos cuentas y quien se registro primero conservaba la contraseña (secuestro previo).

     Ahora el correo escrito NO se usa como correo de la cuenta hasta probar que es de quien se registra: la cuenta
     nace con su correo interno `usuario@sin-correo.traininglabapp.com` (se entra con el usuario, igual que
     quien se registra sin correo) y el correo escrito viaja de vuelta como `correo_pendiente`. La app manda
     enseguida el codigo de 6 numeros (funcion `correo-de-la-cuenta`) y, con el codigo, queda puesto y confirmado de verdad.
     Excepcion: si quien llama es el DUEÑO con su sesion (el panel "crear coach"), el correo se acepta tal cual. */
  let confiable = false
  const portador = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (portador && portador !== (Deno.env.get('SUPABASE_ANON_KEY') ?? '')) {
    const { data: quien } = await admin.auth.getUser(portador)
    if (quien?.user) {
      const { data: pf } = await admin.from('profiles').select('is_owner, is_active').eq('id', quien.user.id).maybeSingle()
      confiable = pf?.is_owner === true && pf?.is_active !== false
    }
  }
  /* «zz_…» es el prefijo de las cuentas de prueba del dueño (aparecen en su panel con la contraseña a la vista). Antes solo la app lo
     negaba: llamando directo a esta función cualquiera podía registrar un «zz_…» (ETAPA 2, p124). Ahora solo el dueño, con su sesión. */
  if (/^zz_/i.test(username) && !confiable) {
    return json({ error: 'Ese nombre de usuario no está disponible' }, 400, origin)
  }
  const correoInterno = `${username.toLowerCase()}@sin-correo.traininglabapp.com`
  let correoPendiente: string | null = null
  if (!email || (!confiable && esCorreoInterno(email))) {
    // Sin correo, o uno de los internos escrito a mano (no se deja: reservaria el correo interno de otro usuario).
    email = correoInterno
  } else if (!confiable) {
    correoPendiente = email
    email = correoInterno
  }

  // Freno por conexión (IP): 30 cuentas nuevas por hora. Alcanza para un gimnasio entero con un solo wifi y frena a quien crea cuentas en masa.
  // El dueño creando coaches con su sesión no cuenta.
  if (!confiable && !(await pasaElFreno(admin, 'signup_ip', ipDe(req), 30))) {
    return json({ error: 'Se crearon muchas cuentas desde esta conexión. Espera un rato e inténtalo de nuevo.', codigo: 'MUCHOS_INTENTOS' }, 429, origin)
  }

  // Username único
  const { data: taken } = await admin
    .from('profiles')
    .select('id')
    .ilike('username', escapaLike(username))
    .maybeSingle()
  if (taken) {
    return json({ error: 'Ese nombre de usuario ya está en uso' }, 409, origin)
  }

  /* Si el atleta dijo con quién entrena, resolverlo.

     La búsqueda vive en la base (`coach_por_referencia`) y no aquí, porque hay
     DOS caminos para enlazarse con un coach: este formulario y la pantalla de
     bienvenida de quien entra con Google. Antes cada uno traía su propia copia
     de la búsqueda, y dos copias es como se acaba arreglando una sola. */
  let coachId: string | null = null
  if (!isCoach && coachRef) {
    const { data: encontrado } = await admin.rpc('coach_por_referencia', { p_ref: coachRef })
    if (!encontrado) {
      return json({ error: `No encontramos ningún entrenador con "${coachRef}"` }, 400, origin)
    }
    coachId = encontrado as string
    if (await profesionalLleno(admin, coachId)) {
      return json({ error: AVISO_LLENO, codigo: 'PROFESIONAL_LLENO' }, 409, origin)
    }
  }

  // Crear usuario (su correo de la cuenta ya es de verdad suyo o es el interno; ver arriba).
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { username, full_name: fullName, role, ...(correoPendiente ? { correo_pendiente: correoPendiente } : {}) },
  })

  if (error) {
    const crudo = textoDeError(error)
    // Queda en los registros del servidor para poder diagnosticar despues. SIN el correo (dato personal): el usuario y el tipo bastan (p136).
    console.error('createUser falló:', crudo, JSON.stringify({ username, role }))

    let msg = crudo
    if (/already been registered|exists|duplicate/i.test(crudo)) {
      msg = 'Ese correo ya está registrado. Intenta entrar, o usa otro correo.'
    } else if (/profiles_role_check|check constraint/i.test(crudo)) {
      msg = 'Error de configuración de la cuenta. Avísale al administrador.'
    } else if (/unexpected_failure|500/i.test(crudo)) {
      msg = `No se pudo crear la cuenta (${crudo}). Inténtalo de nuevo en un minuto.`
    }
    return json({ error: msg }, 400, origin)
  }

  const userId = data.user?.id

  // El trigger handle_new_user crea SIEMPRE el profile como 'user' (25 oct 2026, p131: ya no toma el rol del metadato que manda el cliente).
  // Aquí, con la llave de servicio, se sube a 'admin' si es coach y se fija coach_id (y is_owner=false; el master se marca a mano en DB).
  if (userId) {
    const { error: errPerfil } = await admin
      .from('profiles')
      // `perfil_completo: true` porque este formulario SÍ pregunta todo. La
      // columna nace en false para que las cuentas que crea Google —que solo
      // trae correo y nombre— pasen por la pantalla de bienvenida.
      .update({
        role, coach_id: coachId, is_owner: false, genero,
        profesion: isCoach ? profesion : null, perfil_completo: true,
        inicio_paso: inicioPaso,
      })
      .eq('id', userId)
    if (errPerfil) {
      console.error('update profiles falló:', textoDeError(errPerfil))
      if (/LIMITE_DE_ATLETAS/.test(textoDeError(errPerfil))) {
        // Otro atleta llenó el último lugar justo ahora: se deshace el alta.
        await admin.auth.admin.deleteUser(userId).catch(() => {})
        return json({ error: AVISO_LLENO, codigo: 'PROFESIONAL_LLENO' }, 409, origin)
      }
      return json({ error: `Se creó la cuenta pero falló su perfil: ${textoDeError(errPerfil)}` }, 400, origin)
    }
  }

  return json({ ok: true, user_id: userId, email, role, coach_id: coachId, correo_pendiente: correoPendiente }, 200, origin)
})
