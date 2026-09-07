/**
 * Borra una cuenta DEFINITIVAMENTE. Sin vuelta atras.
 *
 * POR QUE ES UNA FUNCION DE SERVIDOR Y NO UNA LLAMADA NORMAL:
 * borrar el perfil no basta. Hay que borrar tambien el usuario de acceso
 * (`auth.users`), y eso solo se puede con la llave de servicio, que jamas puede
 * viajar al navegador. Por eso vive aqui.
 *
 * QUE SE LLEVA POR DELANTE, verificado contra las llaves foraneas reales:
 *   auth.users  --CASCADE-->  profiles
 *   profiles    --CASCADE-->  plans, user_app_state, user_routines
 *   profiles    --SET NULL->  exercises.created_by, plans.created_by,
 *                             routine_templates.created_by, profiles.coach_id
 *
 * O sea: una sola llamada limpia a la persona, su plan, sus sesiones marcadas,
 * sus pesos y su bienestar; y NO destruye los ejercicios que haya creado ni
 * deja huerfanos a sus atletas si resulta ser un coach.
 *
 * SEGURIDAD, tres candados:
 *   1. Solo el master (is_owner) puede llamar.
 *   2. El master no puede borrarse a si mismo (se quedaria sin administrador).
 *   3. No se puede borrar a otro master.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'

const DEFAULT_ORIGINS = [
  'http://localhost:5173',
  'http://localhost:4173',
  'http://127.0.0.1:5173',
]

function corsHeaders(origin: string | null): Record<string, string> {
  let allow = DEFAULT_ORIGINS[0]
  if (origin) {
    try {
      if (DEFAULT_ORIGINS.includes(origin) || /\.vercel\.app$/.test(new URL(origin).hostname)) {
        allow = origin
      }
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
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(origin) },
  })
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origin)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Falta tu sesión. Vuelve a entrar.' }, 401, origin)

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: usuario, error: errAuth } = await admin.auth.getUser(token)
  if (errAuth || !usuario?.user) {
    return json({ error: 'Tu sesión expiró. Vuelve a entrar e inténtalo otra vez.' }, 401, origin)
  }
  const quienPide = usuario.user.id

  // Candado 1: solo el master.
  const { data: yo } = await admin
    .from('profiles').select('is_owner').eq('id', quienPide).maybeSingle()
  if (!yo?.is_owner) {
    return json({ error: 'Solo el administrador puede eliminar cuentas.' }, 403, origin)
  }

  let p: { id?: string }
  try { p = await req.json() } catch { return json({ error: 'JSON inválido' }, 400, origin) }
  const objetivo = (p.id ?? '').trim()
  if (!objetivo) return json({ error: 'Falta decir a quién eliminar.' }, 400, origin)

  // Candado 2: no borrarse a uno mismo.
  if (objetivo === quienPide) {
    return json({ error: 'No puedes eliminar tu propia cuenta desde aquí.' }, 400, origin)
  }

  // Candado 3: no borrar a otro master.
  const { data: victima } = await admin
    .from('profiles').select('is_owner, full_name, username').eq('id', objetivo).maybeSingle()
  if (!victima) return json({ error: 'Esa cuenta ya no existe.' }, 404, origin)
  if (victima.is_owner) {
    return json({ error: 'No se puede eliminar una cuenta de administrador.' }, 403, origin)
  }

  // Un solo borrado: auth.users arrastra el resto por CASCADE.
  const { error } = await admin.auth.admin.deleteUser(objetivo)
  if (error) {
    console.error('admin-delete-user falló:', error.message)
    return json({ error: `No se pudo eliminar: ${error.message}` }, 500, origin)
  }

  return json({
    ok: true,
    eliminado: victima.full_name || victima.username || objetivo,
  }, 200, origin)
})
