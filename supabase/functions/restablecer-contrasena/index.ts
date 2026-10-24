/**
 * El dueño le pone una contraseña NUEVA a una cuenta y la ve una sola vez.
 *
 * POR QUÉ EXISTE (Andrés, 14 oct 2026): «necesito hacer cuentas de prueba, las borro, me olvido de la contraseña… quiero ver las contraseñas de cada cuenta».
 * Las contraseñas REALES no se pueden leer (la base las guarda con un cifrado de un solo sentido) y no debe cambiar. Lo que sí se puede es PONER UNA NUEVA: quien se
 * olvidó recibe una conocida, y la vieja deja de servir. Si la cuenta es de PRUEBA (su usuario empieza con `zz_`), la nueva además se guarda en `cuentas_de_prueba`, que
 * solo el dueño puede leer: así nunca más se olvida.
 *
 * SEGURIDAD, tres candados (los mismos de `admin-delete-user`):
 *   1. Solo el dueño (`is_owner`) puede llamar.
 *   2. No sirve para la cuenta del propio dueño ni para la de otro dueño (para esas está «Cambiar contraseña» de Mi perfil).
 *   3. La contraseña nueva se genera aquí, en el servidor, con aleatoriedad criptográfica; nadie la escoge ni viaja por otro lado.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'

const DEFAULT_ORIGINS = ['http://localhost:5173', 'capacitor://localhost' /* app de iPhone (Capacitor) */, 'http://localhost:4173', 'http://127.0.0.1:5173', 'https://app.traininglabapp.com'] // + dominio propio (15 oct 2026)

function corsHeaders(origin: string | null): Record<string, string> {
  let allow = DEFAULT_ORIGINS[0]
  if (origin) {
    try {
      if (DEFAULT_ORIGINS.includes(origin) || /\.vercel\.app$/.test(new URL(origin).hostname)) allow = origin
    } catch { /* origin malformado */ }
  }
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(origin) } })
}

// Sin letras que se confunden (I, l, O, 0): se lee y se copia a mano sin errores. Algo como «kReM-4829ab».
const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'
const DIGITOS = '23456789'
const sorteo = (alfabeto: string, n: number) => {
  const bytes = crypto.getRandomValues(new Uint32Array(n))
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('')
}
const generaContrasena = () => `${sorteo(LETRAS, 4)}-${sorteo(DIGITOS, 4)}${sorteo(LETRAS, 2)}`

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origin)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Falta tu sesión. Vuelve a entrar.' }, 401, origin)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: sesion, error: errAuth } = await admin.auth.getUser(token)
  if (errAuth || !sesion?.user) return json({ error: 'El servidor no reconoció tu sesión. Vuelve a entrar e inténtalo otra vez.' }, 401, origin)
  const quienPide = sesion.user.id

  // Candado 1: solo el dueño.
  const { data: yo } = await admin.from('profiles').select('is_owner').eq('id', quienPide).maybeSingle()
  if (!yo?.is_owner) return json({ error: 'Solo el administrador puede restablecer contraseñas.' }, 403, origin)

  let p: { user_id?: string }
  try { p = await req.json() } catch { return json({ error: 'JSON inválido' }, 400, origin) }
  const objetivo = (p.user_id ?? '').trim()
  if (!objetivo) return json({ error: 'Falta decir a quién.' }, 400, origin)

  // Candado 2: ni la propia ni la de otro dueño.
  if (objetivo === quienPide) return json({ error: 'Para tu propia contraseña usa «Cambiar contraseña» en Mi perfil.' }, 400, origin)
  const { data: perfil } = await admin.from('profiles').select('id, username, full_name, role, profesion, is_owner').eq('id', objetivo).maybeSingle()
  if (!perfil) return json({ error: 'Esa cuenta ya no existe.' }, 404, origin)
  if (perfil.is_owner) return json({ error: 'No se puede restablecer la contraseña de otro administrador desde aquí.' }, 403, origin)

  // Candado 3: la contraseña nueva la genera el servidor.
  const contrasena = generaContrasena()
  const { error: errPon } = await admin.auth.admin.updateUserById(objetivo, { password: contrasena })
  if (errPon) {
    console.error('updateUserById falló:', errPon.message)
    return json({ error: `No se pudo poner la contraseña nueva: ${errPon.message}` }, 400, origin)
  }

  // Una cuenta de prueba (usuario zz_…) guarda la nueva a la vista del dueño; una real, NUNCA.
  const esDePrueba = /^zz_/i.test(perfil.username ?? '')
  let guardada = false
  if (esDePrueba) {
    const tipo = perfil.role === 'admin' ? (/fisio/i.test(perfil.profesion ?? '') ? 'fisio' : 'coach') : 'atleta'
    const { error: errGuarda } = await admin.from('cuentas_de_prueba').upsert({ user_id: objetivo, contrasena, tipo }, { onConflict: 'user_id' })
    guardada = !errGuarda
    if (errGuarda) console.error('cuentas_de_prueba falló:', errGuarda.message)
  }

  return json({ ok: true, usuario: perfil.username, nombre: perfil.full_name, contrasena, guardada }, 200, origin)
})
