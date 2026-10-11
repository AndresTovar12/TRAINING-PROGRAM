/**
 * Empieza una compra: crea la compra «pendiente» y la página de pago de Stripe (Checkout), y devuelve su dirección para mandar ahí al comprador.
 *
 * Quién compra: una cuenta de ATLETA con sesión. A quién: un coach que ya puede cobrar (en la etapa 1, solo el dueño; después, el que tenga su cuenta de Stripe lista).
 * Qué: un plan PUBLICADO de su vitrina, por una fase por la que el coach permitió entrar. El precio sale de la base, nunca de lo que mande el navegador.
 *
 * El dinero: Stripe cobra en la cuenta de Training Lab y el reparto lo hace `stripe-webhook` (ver docs/superpowers/specs/2026-10-10-monetizacion-design.md, sección 3).
 * Sin las llaves de Stripe (`STRIPE_SECRET_KEY`) contesta que la compra aún no está disponible: no falla de golpe.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { MONEDA, llamaStripe } from './stripe.js'

const ORIGENES = ['http://localhost:5173', 'http://localhost:4173', 'http://127.0.0.1:5173']
const SITIO = (Deno.env.get('SITIO_URL') ?? 'https://training-program-kappa.vercel.app').replace(/\/$/, '')

const permitido = (origen: string | null) => {
  if (!origen) return SITIO
  try {
    const h = new URL(origen).hostname
    if (ORIGENES.includes(origen) || /\.vercel\.app$/.test(h) || origen === SITIO) return origen
  } catch { /* origen malformado */ }
  return SITIO
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

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Entra a tu cuenta para comprar.' }, 401, origen)
  const bd = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: sesion, error: errSesion } = await bd.auth.getUser(token)
  if (errSesion || !sesion?.user) return json({ error: 'Tu sesión expiró. Vuelve a entrar.' }, 401, origen)
  const uid = sesion.user.id

  let p: { usuario?: string; slug?: string; fase_de_entrada?: string | null }
  try { p = await req.json() } catch { return json({ error: 'Datos inválidos.' }, 400, origen) }
  const usuario = String(p.usuario ?? '').toLowerCase().trim()
  const slug = String(p.slug ?? '').toLowerCase().trim()
  if (!usuario || !slug) return json({ error: 'Falta el plan.' }, 400, origen)

  try {
    const { data: comprador } = await bd.from('profiles').select('role, is_active, email, full_name, username').eq('id', uid).maybeSingle()
    if (!comprador || comprador.is_active === false) return json({ error: 'Tu cuenta no puede comprar.' }, 403, origen)
    if (comprador.role !== 'user') return json({ error: 'Para comprar necesitas una cuenta de atleta.' }, 403, origen)

    const { data: coach } = await bd.from('profiles').select('id, is_owner, is_active').eq('username', usuario).eq('role', 'admin').maybeSingle()
    if (!coach || coach.is_active === false) return json({ error: 'Este plan ya no está disponible.' }, 404, origen)
    const { data: plan } = await bd.from('vitrina_planes').select('id, coach_id, titulo, tipo, precio_mxn, fases_de_entrada, version_n, estado').eq('coach_id', coach.id).eq('slug', slug).eq('estado', 'publicado').maybeSingle()
    if (!plan) return json({ error: 'Este plan ya no está disponible.' }, 404, origen)
    if (plan.tipo === 'personalizado') return json({ error: 'Los planes personalizados todavía no se pueden comprar.' }, 400, origen)

    // Quien vende tiene que poder cobrar: el dueño (la cuenta de Stripe es la de Training Lab) o un coach con su cuenta conectada lista.
    if (!coach.is_owner) {
      const { data: cuenta } = await bd.from('cuentas_stripe').select('cobros_ok, depositos_ok').eq('coach_id', coach.id).maybeSingle()
      if (!cuenta?.cobros_ok || !cuenta?.depositos_ok) return json({ error: 'Este coach todavía no puede cobrar.' }, 403, origen)
    }

    // Por qué fase entra: una de las que el coach permitió (o ninguna si el plan es de una sola semana que se repite).
    const { data: version } = await bd.from('vitrina_versiones').select('data').eq('vitrina_plan_id', plan.id).eq('n', plan.version_n).maybeSingle()
    if (!version) return json({ error: 'Este plan ya no está disponible.' }, 404, origen)
    const fases: { id?: string }[] = Array.isArray(version.data?.phases) ? version.data.phases : []
    const semanal = version.data?.kind === 'weekly'
    const permitidas: string[] = Array.isArray(plan.fases_de_entrada) ? plan.fases_de_entrada : []
    let fase: string | null = null
    if (!semanal && fases.length) {
      fase = p.fase_de_entrada && permitidas.includes(p.fase_de_entrada) ? p.fase_de_entrada : (permitidas[0] ?? fases[0]?.id ?? null)
      if (p.fase_de_entrada && !permitidas.includes(p.fase_de_entrada)) return json({ error: 'Por esa fase no se puede entrar.' }, 400, origen)
    }

    const { data: previas } = await bd.from('compras').select('id, estado, stripe_customer_id').eq('atleta_id', uid).eq('vitrina_plan_id', plan.id)
    if ((previas ?? []).some((c) => ['activa', 'gracia', 'por_armar'].includes(c.estado))) return json({ error: 'Ya tienes este plan.' }, 409, origen)

    // El cliente de Stripe de este atleta: el de su compra anterior (de cualquier plan), o uno nuevo.
    const { data: antes } = await bd.from('compras').select('stripe_customer_id').eq('atleta_id', uid).not('stripe_customer_id', 'is', null).order('creada_en', { ascending: false }).limit(1)
    let cliente = antes?.[0]?.stripe_customer_id ?? null
    if (!cliente) {
      const c = await llamaStripe(clave, 'POST', '/v1/customers', { email: comprador.email, name: comprador.full_name || comprador.username, metadata: { atleta_id: uid } }, { idempotencia: `cliente_${uid}` })
      cliente = c.id
    }

    const { data: compra, error: errCompra } = await bd.from('compras').insert({
      vitrina_plan_id: plan.id, atleta_id: uid, coach_id: coach.id, tipo: plan.tipo, estado: 'pendiente', precio_mxn: plan.precio_mxn,
      fase_de_entrada: fase, version_n: plan.version_n, stripe_customer_id: cliente,
    }).select('id').single()
    if (errCompra) throw errCompra

    const sitio = permitido(origen)
    const membresia = plan.tipo === 'membresia'
    const sesionStripe = await llamaStripe(clave, 'POST', '/v1/checkout/sessions', {
      mode: membresia ? 'subscription' : 'payment',
      customer: cliente,
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
      cancel_url: `${sitio}/compra/cancelada`,
    }, { idempotencia: `compra_${compra.id}` })

    await bd.from('compras').update({ stripe_checkout_session_id: sesionStripe.id }).eq('id', compra.id)
    return json({ url: sesionStripe.url }, 200, origen)
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'No se pudo empezar la compra.'
    return json({ error: mensaje }, 500, origen)
  }
})
