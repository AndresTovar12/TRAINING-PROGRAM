import { createClient } from 'jsr:@supabase/supabase-js@2'
import { llamaStripe } from './stripe.js'
import { finDelPlan, hoyDelServidor } from './ventana.js'

/**
 * Lo que cada persona puede hacer con SU cuenta desde la app (15 oct 2026): ver qué se llevaría borrarla, descargar sus datos y eliminarla.
 *
 * POR QUÉ EXISTE. Apple exige que quien puede crear una cuenta pueda iniciar su eliminación desde la propia app, sin escribirle a nadie. Y la ley de datos
 * personales (México, LFPDPPP) da derecho a acceder a los propios datos y a cancelarlos. Antes solo el administrador podía borrar cuentas (`admin-delete-user`).
 *
 *   { accion: 'resumen' }                                → qué pasaría: cuántos atletas, compras activas, si tiene contraseña.
 *   { accion: 'exportar' }                               → todos sus datos en un JSON para descargar.
 *   { accion: 'eliminar', confirmacion: 'ELIMINAR', contrasena? } → borra la cuenta DEFINITIVAMENTE.
 *
 * LO ÚNICO QUE IMPIDE BORRAR: ser el dueño. A nadie se le niega borrar su cuenta (Andrés, 26 oct 2026). Se pide la contraseña (si la cuenta tiene una) Y escribir ELIMINAR:
 * una sesión olvidada abierta no basta.
 *
 * SUS COMPRAS COMO COMPRADOR: la suscripción en Stripe se cancela al momento (sin reembolso) y las compras se van con la cuenta.
 * SUS COMPRADORES SI ES COACH: NADIE PIERDE LO QUE COMPRÓ. El plan en venta se queda (retirado: ya no se vende) con el nombre y la foto del coach guardados; las compras siguen;
 * y a cada membresía con cobro automático se le pone en Stripe `cancel_at` = el final de la última semana de SU plan (el cobro se cierra ahí; sin reembolsos). Ver
 * docs/superpowers/specs/2026-10-26-borrar-cuenta-con-compradores.md. Antes de tocar nada se cierran los cobros en Stripe: si Stripe falla, no se borra nada.
 *
 * QUÉ SE LLEVA: la persona, sus planes, sus sesiones marcadas, sus mensajes y sus compras como comprador. Si es profesional: sus ejercicios y plantillas, y sus atletas se quedan SIN coach
 * (sus cuentas y sus planes siguen intactos). Ver el mismo trato en `admin-delete-user`.
 * TRAMPA CONOCIDA (docs en la memoria del proyecto): borrar una cuenta con planes falla si los planes caen en cascada (el historial intenta guardar la versión de una persona
 * que ya no existe); por eso los planes se borran ANTES, con la cuenta todavía viva.
 */

const DEFAULT_ORIGINS = ['http://localhost:5173', 'capacitor://localhost' /* app de iPhone (Capacitor) */, 'http://localhost:4173', 'http://127.0.0.1:5173', 'https://app.traininglabapp.com']

// Lista cerrada de sitios propios (lote 1 de seguridad, oct 2026): YA NO vale cualquier *.vercel.app.
// Se suman, si existen, los secretos SITIO_URL, ALLOWED_ORIGINS y ORIGENES_EXTRA (separados por coma).
const ORIGENES_PROPIOS = new Set<string>([
  'http://localhost:5173', 'capacitor://localhost' /* app de iPhone (Capacitor) */, 'http://localhost:4173', 'http://127.0.0.1:5173',
  'https://app.traininglabapp.com',
  'https://training-program-kappa.vercel.app', // despliegue anterior en Vercel (mismo dueño); quitar cuando se apague
  ...[Deno.env.get('SITIO_URL'), ...(Deno.env.get('ALLOWED_ORIGINS') ?? '').split(','), ...(Deno.env.get('ORIGENES_EXTRA') ?? '').split(',')]
    .map((o) => (o ?? '').trim().replace(/\/+$/, ''))
    .filter(Boolean),
])

function corsHeaders(origin: string | null): Record<string, string> {
  let allow = DEFAULT_ORIGINS[0]
  if (origin) {
    try {
      if (ORIGENES_PROPIOS.has(origin)) allow = origin
    } catch { /* origen malformado */ }
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

const VIVAS = ['activa', 'gracia']
// Para cerrar cobros se miran también las vencidas y por armar: Stripe puede seguir reintentando una suscripción cuya compra ya marcó «vencida» (el aviso llegó tarde).
const CON_COBRO = ['activa', 'gracia', 'vencida', 'por_armar']

/* Comprobar la contraseña con /auth/v1/token ABRE una sesión de verdad que nadie cerraba (auditoría p134: 384 sesiones acumuladas).
   Se cierra enseguida, SOLO esa (`scope=local`: no toca las demás sesiones de la persona). Si no se puede cerrar, no es motivo para fallar. */
async function cierraLaSesionDeLaPrueba(urlSb: string, prueba: Response) {
  try {
    const t = (await prueba.clone().json())?.access_token
    if (typeof t !== 'string' || !t) return
    await fetch(`${urlSb}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '', Authorization: `Bearer ${t}` },
      signal: AbortSignal.timeout(5_000),
    })
  } catch { /* se queda como estaba */ }
}

/** Una suscripción que Stripe ya no tiene (o ya cerró) no es un fallo: lo que se quería ya está hecho. */
// deno-lint-ignore no-explicit-any
const yaTerminada = (e: any) => e?.estado === 404 || e?.stripe?.code === 'resource_missing' || /cancell?ed/i.test(String(e?.message ?? ''))

/** Cancela una suscripción ya, sin reembolso. */
async function cancelaYa(clave: string, suscripcion: string) {
  try { await llamaStripe(clave, 'DELETE', `/v1/subscriptions/${suscripcion}`) } catch (e) { if (!yaTerminada(e)) throw e }
}

/** Cierra el cobro de una suscripción: en `fin` (segundos) si hay una fecha futura; si no, al terminar el periodo ya pagado. Sin prorrateos ni reembolsos. */
async function cierraElCobro(clave: string, suscripcion: string, fin: number | null) {
  const datos = fin && fin > Math.floor(Date.now() / 1000) + 3600 ? { cancel_at: fin, proration_behavior: 'none' } : { cancel_at_period_end: true }
  try { await llamaStripe(clave, 'POST', `/v1/subscriptions/${suscripcion}`, datos) } catch (e) { if (!yaTerminada(e)) throw e }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origin)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Falta tu sesión. Vuelve a entrar.' }, 401, origin)

  const URL_SB = Deno.env.get('SUPABASE_URL')!
  const bd = createClient(URL_SB, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: sesion, error: errSesion } = await bd.auth.getUser(token)
  const usuario = sesion?.user
  if (errSesion || !usuario) return json({ error: 'Tu sesión expiró. Vuelve a entrar.' }, 401, origin)
  const yo = usuario.id

  let p: { accion?: string; confirmacion?: string; contrasena?: string }
  try { p = await req.json() } catch { return json({ error: 'JSON inválido' }, 400, origin) }

  const { data: perfil } = await bd.from('profiles').select('*').eq('id', yo).maybeSingle()
  if (!perfil) return json({ error: 'No encontramos tu perfil.' }, 404, origin)
  const esCoach = perfil.role === 'admin'
  const tieneContrasena = ((usuario.app_metadata?.providers as string[] | undefined) ?? ['email']).includes('email')

  const cuenta = async (tabla: string, col: string, vivas = true) => {
    let q = bd.from(tabla).select('id', { count: 'exact', head: true }).eq(col, yo)
    if (vivas) q = q.in('estado', VIVAS)
    const { count } = await q
    return count ?? 0
  }

  if (p.accion === 'resumen') {
    return json({
      es_coach: esCoach,
      es_dueno: !!perfil.is_owner,
      tiene_contrasena: tieneContrasena,
      atletas: esCoach ? await cuenta('profiles', 'coach_id', false) : 0,
      membresias_activas: await cuenta('compras', 'atleta_id'),
      compradores_activos: esCoach ? await cuenta('compras', 'coach_id') : 0,
    }, 200, origin)
  }

  if (p.accion === 'exportar') {
    const errores: string[] = []
    const leer = async (nombre: string, tabla: string, filtro: (q: any) => any, columnas = '*') => {
      const { data, error } = await filtro(bd.from(tabla).select(columnas)).limit(5000)
      if (error) { errores.push(`${nombre}: ${error.message}`); return [] }
      return data ?? []
    }
    // El perfil sin las marcas internas de permisos.
    const { is_owner: _a, limite_atletas: _b, comision_especial: _c, vitrina_suspendida: _d, ...perfilPublico } = perfil
    const datos = {
      generado_en: new Date().toISOString(),
      nota: 'Estos son los datos que Training Lab guarda de tu cuenta.',
      cuenta: { id: yo, correo: usuario.email ?? null, creada_en: usuario.created_at, ultimo_acceso: usuario.last_sign_in_at ?? null, proveedores: usuario.app_metadata?.providers ?? [] },
      perfil: perfilPublico,
      estado_de_la_app: await leer('estado', 'user_app_state', (q) => q.eq('user_id', yo)),
      planes: await leer('planes', 'plans', (q) => q.eq('user_id', yo)),
      rutinas: await leer('rutinas', 'user_routines', (q) => q.eq('user_id', yo)),
      equipo: await leer('equipo', 'equipo', (q) => q.or(`atleta_id.eq.${yo},profesional_id.eq.${yo}`)),
      compras: await leer('compras', 'compras', (q) => q.or(`atleta_id.eq.${yo},coach_id.eq.${yo}`)),
      mensajes: await leer('mensajes', 'mensajes', (q) => q.or(`atleta_id.eq.${yo},profesional_id.eq.${yo}`)),
      tecnicas: await leer('técnicas', 'tecnicas', (q) => q.or(`atleta_id.eq.${yo},profesional_id.eq.${yo}`)),
      ejercicios_propios: esCoach ? await leer('ejercicios', 'exercises', (q) => q.eq('created_by', yo)) : [],
      plantillas: esCoach ? await leer('plantillas', 'routine_templates', (q) => q.eq('created_by', yo)) : [],
      programas_guardados: esCoach ? await leer('programas', 'programas_guardados', (q) => q.eq('created_by', yo)) : [],
      vitrina: esCoach ? await leer('vitrina', 'vitrina_planes', (q) => q.eq('coach_id', yo)) : [],
      // Lo que antes faltaba aunque se prometía «todos tus datos» (p88, 26 oct 2026): entrenos con y sin reloj, recuperación, notas de consulta, invitaciones, umbrales, y lo propio del profesional.
      actividades: await leer('actividades', 'actividades', (q) => q.eq('atleta_id', yo)),
      actividad_series: await leer('series de actividades', 'actividad_series', (q) => q.eq('atleta_id', yo)),
      recuperacion_diaria: await leer('recuperación', 'recuperacion_diaria', (q) => q.eq('atleta_id', yo)),
      notas_de_consulta: await leer('notas de consulta', 'notas_consulta', (q) => q.or(`atleta_id.eq.${yo},autor_id.eq.${yo}`)),
      invitaciones: await leer('invitaciones', 'invitaciones', (q) => q.or(`atleta_id.eq.${yo},coach_id.eq.${yo}`)),
      umbrales: await leer('umbrales', 'umbrales_atleta', (q) => q.eq('atleta_id', yo)),
      carpetas_de_planes: await leer('carpetas', 'carpetas_planes', (q) => q.eq('owner_id', yo)),
      tipos_de_sesion: esCoach ? await leer('tipos de sesión', 'session_types', (q) => q.eq('coach_id', yo)) : [],
      categorias_de_ejercicios: esCoach ? await leer('categorías', 'exercise_categories', (q) => q.eq('created_by', yo)) : [],
      grupos_musculares: esCoach ? await leer('grupos musculares', 'grupos_musculares', (q) => q.eq('created_by', yo)) : [],
      ajustes_de_ejercicios: esCoach ? await leer('ajustes de ejercicios', 'exercise_overrides', (q) => q.eq('coach_id', yo)) : [],
      videos_de_ejercicios: esCoach ? await leer('videos de ejercicios', 'exercise_media', (q) => q.eq('created_by', yo)) : [],
      pagos_recibidos: esCoach ? await leer('pagos', 'pagos', (q) => q.eq('coach_id', yo)) : [],
      ...(errores.length ? { no_se_pudo_leer: errores } : {}),
    }
    return json(datos, 200, origin)
  }

  if (p.accion === 'eliminar') {
    if (perfil.is_owner) return json({ error: 'La cuenta del administrador no se elimina desde aquí.' }, 403, origin)
    if (String(p.confirmacion ?? '').trim().toUpperCase() !== 'ELIMINAR') return json({ error: 'Escribe ELIMINAR para confirmar.', codigo: 'FALTA_CONFIRMACION' }, 400, origin)

    if (tieneContrasena) {
      const contrasena = String(p.contrasena ?? '')
      if (!contrasena) return json({ error: 'Escribe tu contraseña.', codigo: 'FALTA_CONTRASENA' }, 400, origin)
      const prueba = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, {
        method: 'POST',
        headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: String(usuario.email ?? '').toLowerCase(), password: contrasena }),
        signal: AbortSignal.timeout(10_000),
      }).catch(() => null)
      if (!prueba) return json({ error: 'No se pudo comprobar tu contraseña. Inténtalo de nuevo.' }, 502, origin)
      if (prueba.status === 429) return json({ error: 'Demasiados intentos. Espera un momento.' }, 429, origin)
      if (!prueba.ok) return json({ error: 'La contraseña no es correcta.', codigo: 'CONTRASENA_MAL' }, 400, origin)
      await cierraLaSesionDeLaPrueba(URL_SB, prueba)
    }

    // 1) LOS COBROS PRIMERO. Si Stripe no contesta, no se borra nada: la persona puede reintentar y no queda una suscripción cobrando a una cuenta que ya no existe.
    const clave = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim()
    const suscripcionesDeCompras = async (columna: 'atleta_id' | 'coach_id') => {
      const { data, error } = await bd.from('compras')
        .select('id, vitrina_plan_id, tipo, inicio, fase_de_entrada, semana_de_entrada, version_n, stripe_subscription_id')
        .eq(columna, yo).in('estado', CON_COBRO).not('stripe_subscription_id', 'is', null)
      if (error) throw error
      return data ?? []
    }
    try {
      // Como comprador: se cancela ya y no se reembolsa (la cuenta se va, el acceso también).
      const mias = await suscripcionesDeCompras('atleta_id')
      if (mias.length && !clave) throw new Error('SIN_STRIPE')
      for (const c of mias) await cancelaYa(clave, c.stripe_subscription_id)

      // Como coach: cada comprador sigue con su plan y se le cobra hasta el final de SU plan.
      if (esCoach) {
        const vendidas = await suscripcionesDeCompras('coach_id')
        if (vendidas.length && !clave) throw new Error('SIN_STRIPE')
        const hoy = hoyDelServidor()
        for (const c of vendidas) {
          let fin: number | null = null
          if (c.tipo === 'membresia') {
            const { data: version } = await bd.from('vitrina_versiones').select('data').eq('vitrina_plan_id', c.vitrina_plan_id).eq('n', c.version_n).maybeSingle()
            fin = finDelPlan({ data: version?.data, inicio: c.inicio, faseDeEntrada: c.fase_de_entrada, semanaDeEntrada: c.semana_de_entrada, hoy })
          }
          await cierraElCobro(clave, c.stripe_subscription_id, fin)
        }
      }
    } catch (e) {
      console.error('mi-cuenta: cerrar los cobros falló:', e instanceof Error ? e.message : e)
      return json({ error: 'No se pudieron cerrar tus cobros en Stripe, así que no se borró nada. Inténtalo de nuevo en un momento; si sigue igual escríbenos a contacto@traininglabapp.com.', codigo: 'COBROS_NO_CERRADOS' }, 502, origin)
    }

    // 1b) Quien ya PAGÓ algo: el registro de sus pagos se conserva (contabilidad; p101) pero sin sus datos. `pagos.compra_id` impide borrar la compra con la cuenta, así que esa compra queda
    // cerrada y ANÓNIMA (sin atleta ni correo) en vez de borrarse; las compras sin pagos se van con la cuenta como siempre.
    {
      const { data: suyas, error: errSuyas } = await bd.from('compras').select('id').eq('atleta_id', yo)
      if (errSuyas) return json({ error: 'No se pudo eliminar tu cuenta. Inténtalo de nuevo o escríbenos a contacto@traininglabapp.com.' }, 500, origin)
      const idsSuyas = (suyas ?? []).map((c) => c.id)
      if (idsSuyas.length) {
        const { data: conPagos } = await bd.from('pagos').select('compra_id').in('compra_id', idsSuyas)
        const conservar = [...new Set((conPagos ?? []).map((x) => x.compra_id))]
        if (conservar.length) {
          const ahoraIso = new Date().toISOString()
          const { error: errAnon } = await bd.from('compras').update({ estado: 'cancelada', atleta_id: null, correo_comprador: null, cancelada_en: ahoraIso, actualizada_en: ahoraIso }).in('id', conservar)
          if (errAnon) {
            console.error('mi-cuenta: anonimizar compras pagadas falló:', errAnon.message)
            return json({ error: 'No se pudo eliminar tu cuenta. Inténtalo de nuevo o escríbenos a contacto@traininglabapp.com.' }, 500, origin)
          }
        }
      }
    }

    // 2) Un profesional: sus planes en venta con compradores se quedan (retirados, con su nombre y foto guardados), sus atletas se quedan sin coach y lo suyo se va con él.
    if (esCoach) {
      const { data: misPlanes, error: errMisPlanes } = await bd.from('vitrina_planes').select('id, contenido').eq('coach_id', yo)
      if (errMisPlanes) return json({ error: 'No se pudo eliminar tu cuenta. Inténtalo de nuevo o escríbenos a contacto@traininglabapp.com.' }, 500, origin)
      const ids = (misPlanes ?? []).map((v) => v.id)
      if (ids.length) {
        // Una compra pendiente (pago sin terminar) ya no tiene a quién pagarle.
        await bd.from('compras').update({ estado: 'cancelada', actualizada_en: new Date().toISOString() }).eq('coach_id', yo).eq('estado', 'pendiente')
        const { data: conCompras } = await bd.from('compras').select('vitrina_plan_id').in('vitrina_plan_id', ids)
        const quedan = new Set((conCompras ?? []).map((c) => c.vitrina_plan_id))
        for (const plan of (misPlanes ?? []).filter((v) => quedan.has(v.id))) {
          let congelada = null
          if (plan.contenido === 'biblioteca') {
            const { data: clases } = await bd.from('routine_templates').select('id, name, descripcion, data').eq('created_by', yo).eq('kind', 'day').filter('resumen->>clase', 'eq', 'true').order('name')
            congelada = (clases ?? []).filter((f) => f.data?.clase?.url).map((f) => ({ id: f.id, nombre: f.name, descripcion: f.descripcion ?? '', clase: f.data.clase }))
          }
          const { error: errPlan } = await bd.from('vitrina_planes').update({
            coach_nombre: perfil.full_name || perfil.username || null, coach_foto: perfil.avatar_url ?? null, estado: 'retirado', biblioteca_congelada: congelada,
          }).eq('id', plan.id)
          if (errPlan) {
            console.error('mi-cuenta: guardar el plan en venta falló:', errPlan.message)
            return json({ error: 'No se pudo eliminar tu cuenta. Inténtalo de nuevo o escríbenos a contacto@traininglabapp.com.' }, 500, origin)
          }
        }
        // Los planes en venta que nadie compró no tienen razón de quedarse.
        const sinCompras = ids.filter((i) => !quedan.has(i))
        if (sinCompras.length) await bd.from('vitrina_planes').delete().in('id', sinCompras)
      }
      await bd.from('profiles').update({ coach_id: null }).eq('coach_id', yo)
      await bd.from('exercise_media').delete().eq('created_by', yo)
      await bd.from('exercises').delete().eq('created_by', yo)
    }
    // Los planes ANTES que la cuenta (ver la trampa arriba).
    const { error: errPlanes } = await bd.from('plans').delete().eq('user_id', yo)
    if (errPlanes) {
      console.error('mi-cuenta: borrar planes falló:', errPlanes.message)
      return json({ error: 'No se pudo eliminar tu cuenta. Inténtalo de nuevo o escríbenos a contacto@traininglabapp.com.' }, 500, origin)
    }
    const { error: errAuth } = await bd.auth.admin.deleteUser(yo)
    if (errAuth) {
      console.error('mi-cuenta: deleteUser falló:', errAuth.message)
      return json({ error: 'No se pudo eliminar tu cuenta. Inténtalo de nuevo o escríbenos a contacto@traininglabapp.com.' }, 500, origin)
    }
    return json({ ok: true }, 200, origin)
  }

  return json({ error: 'Acción desconocida' }, 400, origin)
})
