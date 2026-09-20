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
 *
 * BORRAR UN COACH, ademas, decide a donde va lo suyo antes de borrarlo: sus
 * atletas pasan al coach que se diga (o se quedan sin coach) y sus ejercicios
 * pasan al master o se borran con el. Ver el bloque de mas abajo.
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
    // Texto DISTINTO al del navegador a propósito. Los dos decían lo mismo, y
    // cuando falló (18 sep 2026) no se podía saber de qué lado venía sin
    // reproducirlo a mano.
    return json({ error: 'El servidor no reconoció tu sesión. Vuelve a entrar e inténtalo otra vez.' }, 401, origin)
  }
  const quienPide = usuario.user.id

  // Candado 1: solo el master.
  const { data: yo } = await admin
    .from('profiles').select('is_owner').eq('id', quienPide).maybeSingle()
  if (!yo?.is_owner) {
    return json({ error: 'Solo el administrador puede eliminar cuentas.' }, 403, origin)
  }

  let p: { id?: string; atletasA?: string | null; ejerciciosA?: 'master' | 'borrar' }
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

  /* ANTES DE BORRAR: COLOCAR LO QUE DEJA ATRÁS.
   *
   * Esto vale sobre todo al borrar un COACH, y es la razón por la que borrar
   * coaches no existía hasta ahora. Las llaves foráneas dicen:
   *
   *   sus atletas (profiles.coach_id)      SET NULL  → se quedan sin coach
   *   sus ejercicios (exercises.created_by) SET NULL  → se quedan SIN DUEÑO
   *   sus medios (exercise_media)           SET NULL  → igual
   *   sus categorías, tipos y versiones     CASCADE   → se borran con él
   *
   * El problema está en "sin dueño": la app lee un ejercicio sin `created_by`
   * como uno DE LA APP, o sea base para todos. Borrar un coach publicaría en
   * silencio su repertorio privado a todos los demás coaches. Por eso el que
   * borra tiene que decir a dónde va cada cosa, y por eso se hace aquí y no en
   * el navegador: son varias escrituras y a medias dejan un desastre.
   */
  const { count: cuantosAtletas } = await admin
    .from('profiles').select('id', { count: 'exact', head: true }).eq('coach_id', objetivo)

  if (cuantosAtletas) {
    const destino = (p.atletasA ?? '').trim() || null
    if (destino) {
      // El destino tiene que ser alguien que pueda entrenar: si no, los
      // atletas acabarían colgando de otro atleta.
      const { data: d } = await admin
        .from('profiles').select('id, role, is_owner').eq('id', destino).maybeSingle()
      if (!d || (d.role !== 'admin' && !d.is_owner)) {
        return json({ error: 'A quien quieres pasarle los atletas no es un coach.' }, 400, origin)
      }
    }
    const { error: eAtletas } = await admin
      .from('profiles').update({ coach_id: destino }).eq('coach_id', objetivo)
    if (eAtletas) {
      return json({ error: `No se pudieron mover sus atletas: ${eAtletas.message}` }, 500, origin)
    }
  }

  /* Por defecto los ejercicios pasan a quien borra (el master), NO se quedan
     sin dueño: entre las dos, quedarse sin dueño es la que nadie eligió. */
  if (p.ejerciciosA === 'borrar') {
    // Los medios de esos ejercicios caen solos (exercise_id es CASCADE); los
    // que subió a ejercicios de otros hay que quitarlos aparte.
    await admin.from('exercises').delete().eq('created_by', objetivo)
    await admin.from('exercise_media').delete().eq('created_by', objetivo)
  } else {
    await admin.from('exercises').update({ created_by: quienPide }).eq('created_by', objetivo)
    await admin.from('exercise_media').update({ created_by: quienPide }).eq('created_by', objetivo)
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
    atletasMovidos: cuantosAtletas ?? 0,
  }, 200, origin)
})
