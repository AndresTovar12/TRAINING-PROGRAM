/**
 * Empieza una compra EN LA WEB: crea la compra «pendiente» y la sesión de pago de Stripe (Checkout Sessions).
 *
 * Dos formas (26 nov 2026):
 *   · `modo: 'incrustado'` (la de ahora): el pago va DENTRO de nuestra página con los Elements de Stripe (`ui_mode: 'elements'`). Devuelve `{ client_secret, compra_id }`.
 *     El correo lo escribe quien paga en ese mismo formulario («Aquí te llega tu recibo»); no se pide antes.
 *   · sin modo (la vieja, para la app publicada antes de este cambio): devuelve `{ url }` de la página de Stripe.
 *
 * Quién compra: una cuenta de ATLETA con sesión («Compras como @usuario») o alguien sin sesión. A este último NO se le crea cuenta ni se revisa si su correo ya tiene una:
 * antes de pagar no se revela si un correo tiene cuenta. La compra pagada queda apartada, sin dueño, hasta que una cuenta la reclama (`compra-lista`).
 * Dentro de la app del iPhone no se paga aquí (regla de Apple): si la llamada viene de la app, se rechaza.
 * Con las ventas cerradas (`ventas_abiertas`, Panel → Monetización) no se abre ninguna compra.
 * La semana de entrada YA NO se elige aquí: se elige después de pagar («¿Cuándo empiezas?»).
 * Meses sin intereses: solo en pago único (Stripe no los da en suscripciones); salen si la tarjeta los acepta.
 *
 * El dinero: Stripe cobra en la cuenta de Training Lab y el reparto lo hace `stripe-webhook` (docs/superpowers/specs/2026-10-10-monetizacion-design.md, sección 3).
 * Sin las llaves de Stripe (`STRIPE_SECRET_KEY`) contesta que la compra aún no está disponible.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { MONEDA, VERSION_DE_ELEMENTS, llamaStripe } from './stripe.js'

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

  let p: { usuario?: string; slug?: string; correo?: string; modo?: string }
  try { p = await req.json() } catch { return json({ error: 'Datos inválidos.' }, 400, origen) }
  const usuario = String(p.usuario ?? '').toLowerCase().trim()
  const slug = String(p.slug ?? '').toLowerCase().trim()
  const incrustado = p.modo === 'incrustado'
  if (!usuario || !slug) return json({ error: 'Falta el plan.' }, 400, origen)
  // Regla de Apple: dentro de la app del iPhone nada lleva a pagar fuera.
  if (origen === 'capacitor://localhost') return json({ error: 'En la app, la compra es con Apple.', codigo: 'en_la_app' }, 403, origen)

  try {
    // El interruptor del dueño (Panel → Monetización): con las ventas cerradas no se abre ninguna compra, aunque la página siga a la vista (26 nov 2026).
    const { data: ajuste, error: errAjuste } = await bd.from('ajustes_publicos').select('valor').eq('clave', 'ventas_abiertas').maybeSingle()
    if (errAjuste) throw errAjuste
    if (ajuste?.valor !== true) return json({ error: 'La compra no está disponible.', codigo: 'ventas_cerradas' }, 503, origen)

    // Quien compra: su cuenta (con sesión) o nadie todavía (sin sesión). Sin sesión NO se revisa el correo: no se revela si tiene cuenta.
    let comprador: { role: string; is_active: boolean | null; email: string | null; full_name: string | null; username: string | null } | null = null
    let correo = ''
    if (uid) {
      const { data } = await bd.from('profiles').select('role, is_active, email, full_name, username').eq('id', uid).maybeSingle()
      comprador = data
      if (!comprador || comprador.is_active === false) return json({ error: 'Tu cuenta no puede comprar.' }, 403, origen)
      if (comprador.role !== 'user') return json({ error: 'Para comprar necesitas una cuenta de atleta.' }, 403, origen)
      // Con cuenta, el freno es por cuenta (40 por hora), no por conexión: un gimnasio con un solo wifi no se estorba entre sí.
      if (!(await pasaElFreno(bd, 'comprar_usuario', uid, 40))) return json({ error: 'Hiciste muchos intentos de compra seguidos. Espera una hora e inténtalo de nuevo.', codigo: 'muchos_intentos' }, 429, origen)
    } else {
      // La forma vieja (página de Stripe) todavía manda el correo; la nueva lo pide dentro del formulario de pago.
      correo = String(p.correo ?? '').trim().toLowerCase()
      if (!incrustado && (!CORREO_RE.test(correo) || correo.length > 254)) return json({ error: 'Escribe un correo válido.', codigo: 'correo_invalido' }, 400, origen)
      // Frenos: nadie sin cuenta abre compras sin fin (cada una es una fila y una sesión de Stripe): 30 por conexión por hora y un tope global alto.
      const hace1h = new Date(Date.now() - 3600 * 1000).toISOString()
      const { count: deTodos } = await bd.from('compras').select('id', { count: 'exact', head: true }).is('atleta_id', null).gte('creada_en', hace1h)
      if (!(await pasaElFreno(bd, 'comprar_ip', ipDe(req), 30))) return json({ error: 'Se hicieron muchos intentos de compra desde esta conexión. Espera una hora e inténtalo de nuevo.', codigo: 'muchos_intentos' }, 429, origen)
      if ((deTodos ?? 0) >= 1000) return json({ error: 'Hay muchas compras en este momento. Espera unos minutos y vuelve a probar.', codigo: 'muchos_intentos' }, 429, origen)
    }

    const { data: coach } = await bd.from('profiles').select('id, is_owner, is_active, vitrina_suspendida').eq('username', usuario).eq('role', 'admin').maybeSingle()
    // Vitrina suspendida por el dueño: no se vende (14 oct 2026).
    if (!coach || coach.is_active === false || coach.vitrina_suspendida) return json({ error: 'Este plan ya no está disponible.' }, 404, origen)
    const { data: plan } = await bd.from('vitrina_planes').select('id, coach_id, titulo, tipo, precio_mxn, version_n, estado').eq('coach_id', coach.id).eq('slug', slug).eq('estado', 'publicado').maybeSingle()
    if (!plan) return json({ error: 'Este plan ya no está disponible.' }, 404, origen)
    if (plan.tipo === 'personalizado') return json({ error: 'Los planes personalizados todavía no se pueden comprar.' }, 400, origen)

    // Quien ya tiene el plan lo oye primero (antes decía «este coach todavía no puede cobrar» a quien recompraba; p13).
    if (uid) {
      const { data: yaLoTiene } = await bd.from('compras').select('id').eq('atleta_id', uid).eq('vitrina_plan_id', plan.id).in('estado', ['activa', 'gracia', 'por_armar']).limit(1)
      if (yaLoTiene?.length) return json({ error: 'Ya tienes este plan.' }, 409, origen)
    }

    // Quien vende tiene que poder cobrar: el dueño (la cuenta de Stripe es la de Training Lab) o un coach con su cuenta conectada lista.
    if (!coach.is_owner) {
      const { data: cuenta } = await bd.from('cuentas_stripe').select('cobros_ok, depositos_ok').eq('coach_id', coach.id).maybeSingle()
      if (!cuenta?.cobros_ok || !cuenta?.depositos_ok) return json({ error: 'Este coach todavía no puede cobrar.' }, 403, origen)
    }

    const { data: version } = await bd.from('vitrina_versiones').select('n').eq('vitrina_plan_id', plan.id).eq('n', plan.version_n).maybeSingle()
    if (!version) return json({ error: 'Este plan ya no está disponible.' }, 404, origen)

    // La misma persona abrió esta misma compra hace poco (dos pestañas, un doble toque): se le da la MISMA página de pago en vez de abrir otra y cobrarle dos veces (p96).
    {
      const hace30min = new Date(Date.now() - 30 * 60 * 1000).toISOString()
      // Solo con cuenta: sin cuenta no hay forma de saber que es la misma persona.
      const { data: yaAbierta } = uid
        ? await bd.from('compras').select('id, stripe_checkout_session_id').eq('vitrina_plan_id', plan.id).eq('estado', 'pendiente').eq('atleta_id', uid)
          .not('stripe_checkout_session_id', 'is', null).gte('creada_en', hace30min).order('creada_en', { ascending: false }).limit(1)
        : { data: null }
      if (yaAbierta?.[0]) {
        try {
          const abierta = await llamaStripe(clave, 'GET', `/v1/checkout/sessions/${yaAbierta[0].stripe_checkout_session_id}`)
          if (abierta?.status === 'open') {
            if (incrustado && abierta.ui_mode === 'elements' && abierta.client_secret) return json({ client_secret: abierta.client_secret, compra_id: yaAbierta[0].id }, 200, origen)
            if (!incrustado && abierta.url) return json({ url: abierta.url }, 200, origen)
          }
        } catch { /* no se pudo leer la sesión anterior: se abre una compra nueva */ }
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
      vitrina_plan_id: plan.id, atleta_id: uid, correo_comprador: uid ? null : (correo || null), coach_id: coach.id, tipo: plan.tipo, estado: 'pendiente', precio_mxn: plan.precio_mxn,
      version_n: plan.version_n, stripe_customer_id: cliente, canal: 'web',
    }).select('id').single()
    if (errCompra) throw errCompra

    const sitio = sitioDeRegreso(origen)
    const membresia = plan.tipo === 'membresia'
    const comun = {
      mode: membresia ? 'subscription' : 'payment',
      ...(cliente ? { customer: cliente } : (correo ? { customer_email: correo } : {})),
      ...(!cliente && !membresia ? { customer_creation: 'always' } : {}),
      client_reference_id: compra.id,
      line_items: [{
        quantity: 1,
        price_data: {
          currency: MONEDA, unit_amount: plan.precio_mxn * 100, product_data: { name: plan.titulo },
          ...(membresia ? { recurring: { interval: 'month' } } : null),
        },
      }],
      metadata: { compra_id: compra.id },
      ...(membresia ? { subscription_data: { metadata: { compra_id: compra.id } } } : { payment_intent_data: { metadata: { compra_id: compra.id } } }),
    }
    const sesionStripe = incrustado
      ? await llamaStripe(clave, 'POST', '/v1/checkout/sessions', {
        ...comun,
        ui_mode: 'elements',
        // Tarjeta, Apple Pay y Google Pay (estos dos salen solos con la tarjeta si el navegador los tiene). Meses sin intereses solo en pago único.
        payment_method_types: ['card'],
        ...(membresia ? {} : { payment_method_options: { card: { installments: { enabled: true } } } }),
        return_url: `${sitio}/compra/lista?c={CHECKOUT_SESSION_ID}`,
      }, { idempotencia: `compra_${compra.id}`, version: VERSION_DE_ELEMENTS })
      : await llamaStripe(clave, 'POST', '/v1/checkout/sessions', {
        ...comun,
        locale: 'es-419',
        payment_method_types: ['card'],
        success_url: `${sitio}/compra/lista?c={CHECKOUT_SESSION_ID}`,
        cancel_url: `${sitio}/@${encodeURIComponent(usuario)}/${encodeURIComponent(slug)}`,
      }, { idempotencia: `compra_${compra.id}` })

    await bd.from('compras').update({ stripe_checkout_session_id: sesionStripe.id }).eq('id', compra.id)
    return incrustado
      ? json({ client_secret: sesionStripe.client_secret, compra_id: compra.id }, 200, origen)
      : json({ url: sesionStripe.url }, 200, origen)
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : 'No se pudo empezar la compra.'
    return json({ error: mensaje }, 500, origen)
  }
})
