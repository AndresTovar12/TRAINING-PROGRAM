/**
 * Empieza una compra: crea la compra «pendiente» y la página de pago de Stripe (Checkout), y devuelve su dirección para mandar ahí al comprador.
 *
 * Quién compra: una cuenta de ATLETA con sesión, o alguien SIN cuenta que solo escribe su correo (Andrés, 12 oct 2026: «que llegue y quiera comprar y punto»). Al segundo no se le crea
 * nada todavía: la compra queda «pendiente» sin atleta, con su correo, y la cuenta la crea `stripe-webhook` cuando el pago de verdad se confirma (ver docs/sql/2026-10-12-comprar-sin-cuenta.sql).
 * Antes de mandarlo a pagar se revisa su correo: si ya tiene cuenta de atleta, que entre (así la compra queda en SU cuenta, sin sorpresas); si es de un coach, que use otro.
 * A quién: un coach que ya puede cobrar (en la etapa 1, solo el dueño; después, el que tenga su cuenta de Stripe lista).
 * Qué: un plan PUBLICADO de su vitrina, entrando por la fase y la semana que el comprador eligió en la hoja del programa (cualquiera del plan; por defecto la primera). El precio sale de la base, nunca de lo que mande el navegador.
 *
 * El dinero: Stripe cobra en la cuenta de Training Lab y el reparto lo hace `stripe-webhook` (ver docs/superpowers/specs/2026-10-10-monetizacion-design.md, sección 3).
 * Sin las llaves de Stripe (`STRIPE_SECRET_KEY`) contesta que la compra aún no está disponible: no falla de golpe.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { MONEDA, llamaStripe } from './stripe.js'

const CORREO_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
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
const SITIO = (Deno.env.get('SITIO_URL') ?? 'https://app.traininglabapp.com').replace(/\/+$/, '')

const permitido = (origen: string | null) => {
  if (!origen) return SITIO
  return ORIGENES_PROPIOS.has(origen) ? origen : SITIO
}
/** A dónde regresa Stripe: solo un sitio web propio de la lista cerrada (nunca el valor crudo del cliente; la app de iPhone vuelve al sitio principal). */
const sitioDeRegreso = (origen: string | null) => {
  const o = permitido(origen)
  return /^https?:\/\//.test(o) ? o : SITIO
}

const cabeceras = (origen: string | null): Record<string, string> => ({
  'Access-Control-Allow-Origin': permitido(origen),
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Max-Age': '86400',
  Vary: 'Origin',
})
const json = (cuerpo: unknown, estado: number, origen: string | null) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cabeceras(origen) } })

Deno.serve(async (req) => {
  const origen = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabeceras(origen) })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origen)

  const clave = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim()
  if (!clave) return json({ error: 'La compra todavía no está disponible.' }, 503, origen)

  // Con sesión de atleta, la compra es de su cuenta. Sin sesión (el navegador manda la llave pública en vez de un token de persona), es una compra de invitado: pide el correo.
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  const bd = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
  let uid: string | null = null
  if (token) {
    const { data: sesion } = await bd.auth.getUser(token)
    uid = sesion?.user?.id ?? null
  }

  let p: { usuario?: string; slug?: string; fase_de_entrada?: string | null; semana_de_entrada?: number | null; correo?: string }
  try { p = await req.json() } catch { return json({ error: 'Datos inválidos.' }, 400, origen) }
  const usuario = String(p.usuario ?? '').toLowerCase().trim()
  const slug = String(p.slug ?? '').toLowerCase().trim()
  if (!usuario || !slug) return json({ error: 'Falta el plan.' }, 400, origen)

  try {
    // Quien compra: su cuenta (con sesión) o el correo que escribió (sin sesión).
    let comprador: { role: string; is_active: boolean | null; email: string | null; full_name: string | null; username: string | null } | null = null
    let correo = ''
    if (uid) {
      const { data } = await bd.from('profiles').select('role, is_active, email, full_name, username').eq('id', uid).maybeSingle()
      comprador = data
      if (!comprador || comprador.is_active === false) return json({ error: 'Tu cuenta no puede comprar.' }, 403, origen)
      if (comprador.role !== 'user') return json({ error: 'Para comprar necesitas una cuenta de atleta.' }, 403, origen)
    } else {
      correo = String(p.correo ?? '').trim().toLowerCase()
      if (!CORREO_RE.test(correo) || correo.length > 254) return json({ error: 'Escribe un correo válido.', codigo: 'correo_invalido' }, 400, origen)
      const { data: cuenta } = await bd.rpc('usuario_por_correo', { p_correo: correo })
      const existente = Array.isArray(cuenta) ? cuenta[0] : cuenta
      if (existente) {
        if (existente.is_active === false) return json({ error: 'Esa cuenta no puede comprar.', codigo: 'cuenta_inactiva' }, 403, origen)
        if (existente.role !== 'user') return json({ error: 'Ese correo es de una cuenta de coach. Usa otro correo para comprar.', codigo: 'correo_de_coach' }, 409, origen)
        return json({ error: 'Ya tienes cuenta con este correo. Entra para comprar.', codigo: 'tiene_cuenta' }, 409, origen)
      }
      // Freno: nadie sin cuenta puede abrir compras sin fin (cada una es una fila y una página de pago de Stripe).
      const hace1h = new Date(Date.now() - 3600 * 1000).toISOString()
      const [{ count: delCorreo }, { count: deTodos }] = await Promise.all([
        bd.from('compras').select('id', { count: 'exact', head: true }).is('atleta_id', null).eq('correo_comprador', correo).gte('creada_en', hace1h),
        bd.from('compras').select('id', { count: 'exact', head: true }).is('atleta_id', null).gte('creada_en', hace1h),
      ])
      if ((delCorreo ?? 0) >= 5 || (deTodos ?? 0) >= 300) return json({ error: 'Demasiados intentos. Espera unos minutos y vuelve a probar.', codigo: 'muchos_intentos' }, 429, origen)
    }

    const { data: coach } = await bd.from('profiles').select('id, is_owner, is_active, vitrina_suspendida').eq('username', usuario).eq('role', 'admin').maybeSingle()
    // Vitrina suspendida por el dueño: no se vende (14 oct 2026).
    if (!coach || coach.is_active === false || coach.vitrina_suspendida) return json({ error: 'Este plan ya no está disponible.' }, 404, origen)
    const { data: plan } = await bd.from('vitrina_planes').select('id, coach_id, titulo, tipo, precio_mxn, version_n, estado').eq('coach_id', coach.id).eq('slug', slug).eq('estado', 'publicado').maybeSingle()
    if (!plan) return json({ error: 'Este plan ya no está disponible.' }, 404, origen)
    if (plan.tipo === 'personalizado') return json({ error: 'Los planes personalizados todavía no se pueden comprar.' }, 400, origen)

    // Quien vende tiene que poder cobrar: el dueño (la cuenta de Stripe es la de Training Lab) o un coach con su cuenta conectada lista.
    if (!coach.is_owner) {
      const { data: cuenta } = await bd.from('cuentas_stripe').select('cobros_ok, depositos_ok').eq('coach_id', coach.id).maybeSingle()
      if (!cuenta?.cobros_ok || !cuenta?.depositos_ok) return json({ error: 'Este coach todavía no puede cobrar.' }, 403, origen)
    }

    // Por dónde entra: la fase y la semana que eligió (cualquiera del plan, incluso a la mitad de una fase). Sin elegir, la primera. Un plan de una sola semana que se repite no tiene dónde elegir.
    const { data: version } = await bd.from('vitrina_versiones').select('data').eq('vitrina_plan_id', plan.id).eq('n', plan.version_n).maybeSingle()
    if (!version) return json({ error: 'Este plan ya no está disponible.' }, 404, origen)
    const fases: { id?: string; weekData?: { num?: number }[] }[] = Array.isArray(version.data?.phases) ? version.data.phases : []
    const semanal = version.data?.kind === 'weekly'
    let fase: string | null = null
    let semana: number | null = null
    if (!semanal && fases.length) {
      const destino = p.fase_de_entrada ? fases.find((f) => f.id === p.fase_de_entrada) : fases[0]
      if (!destino) return json({ error: 'Esa semana no existe en el plan.' }, 400, origen)
      const semanas = Array.isArray(destino.weekData) ? destino.weekData : []
      fase = destino.id ?? null
      if (p.semana_de_entrada != null) {
        if (!semanas.some((w) => w?.num === Number(p.semana_de_entrada))) return json({ error: 'Esa semana no existe en el plan.' }, 400, origen)
        semana = Number(p.semana_de_entrada)
      } else {
        semana = semanas[0]?.num ?? null
      }
    }

    // El cliente de Stripe: el de la compra anterior de este atleta (de cualquier plan), o uno nuevo. El invitado no tiene: Stripe lo crea al pagar, con el correo que escribió.
    let cliente: string | null = null
    if (uid && comprador) {
      const { data: previas } = await bd.from('compras').select('id, estado, stripe_customer_id').eq('atleta_id', uid).eq('vitrina_plan_id', plan.id)
      if ((previas ?? []).some((c) => ['activa', 'gracia', 'por_armar'].includes(c.estado))) return json({ error: 'Ya tienes este plan.' }, 409, origen)
      const { data: antes } = await bd.from('compras').select('stripe_customer_id').eq('atleta_id', uid).not('stripe_customer_id', 'is', null).order('creada_en', { ascending: false }).limit(1)
      cliente = antes?.[0]?.stripe_customer_id ?? null
      if (!cliente) {
        const c = await llamaStripe(clave, 'POST', '/v1/customers', { email: comprador.email, name: comprador.full_name || comprador.username, metadata: { atleta_id: uid } }, { idempotencia: `cliente_${uid}` })
        cliente = c.id
      }
    }

    const { data: compra, error: errCompra } = await bd.from('compras').insert({
      vitrina_plan_id: plan.id, atleta_id: uid, correo_comprador: uid ? null : correo, coach_id: coach.id, tipo: plan.tipo, estado: 'pendiente', precio_mxn: plan.precio_mxn,
      fase_de_entrada: fase, semana_de_entrada: semana, version_n: plan.version_n, stripe_customer_id: cliente,
    }).select('id').single()
    if (errCompra) throw errCompra

    const sitio = sitioDeRegreso(origen)
    const membresia = plan.tipo === 'membresia'
    const sesionStripe = await llamaStripe(clave, 'POST', '/v1/checkout/sessions', {
      mode: membresia ? 'subscription' : 'payment',
      ...(cliente ? { customer: cliente } : { customer_email: correo, ...(membresia ? null : { customer_creation: 'always' }) }),
      client_reference_id: compra.id,
      locale: 'es-419',
      'payment_method_types': ['card'],
      line_items: [{
        quantity: 1,
        price_data: {
          currency: MONEDA, unit_amount: plan.precio_mxn * 100, product_data: { name: plan.titulo },
          ...(membresia ? { recurring: { interval: 'month' } } : null),
        },
      }],
      metadata: { compra_id: compra.id },
      ...(membresia ? { subscription_data: { metadata: { compra_id: compra.id } } } : { payment_intent_data: { metadata: { compra_id: compra.id } } }),
      success_url: `${sitio}/compra/lista?c={CHECKOUT_SESSION_ID}`,
      // Si se arrepiente, regresa a la página del plan (no a la raíz).
      cancel_url: `${sitio}/@${encodeURIComponent(usuario)}/${encodeURIComponent(slug)}`,
    }, { idempotencia: `compra_${compra.id}` })

    await bd.from('compras').update({ stripe_checkout_session_id: sesionStripe.id }).eq('id', compra.id)
    return json({ url: sesionStripe.url }, 200, origen)
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'No se pudo empezar la compra.'
    return json({ error: mensaje }, 500, origen)
  }
})
