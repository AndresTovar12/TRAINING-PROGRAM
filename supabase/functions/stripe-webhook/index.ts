/**
 * Atiende los avisos de Stripe: es quien ACTIVA una compra cuando el pago de verdad se hizo, y quien reparte el dinero.
 *
 * Seguridad: solo se atiende lo que viene firmado por Stripe con el secreto de ESTE webhook (`STRIPE_WEBHOOK_SECRET`); lo demás se rechaza. Por eso no lleva JWT. Cada evento se atiende
 * UNA vez (tabla `stripe_eventos`): si Stripe lo repite, se ignora. Si algo falla a medias, se anota el error en los registros y se contesta 500: Stripe vuelve a mandarlo hasta ~3 días.
 * Un aviso queda `pendiente` mientras se atiende; si la función se cae a medias (sin llegar al 500), el siguiente intento de Stripe lo retoma (lote 1 de seguridad, 25 oct 2026).
 *
 * Qué hace con cada aviso (ver docs/superpowers/specs/2026-10-10-monetizacion-design.md, secciones 3 y 8):
 *   checkout.session.completed → la compra pasa a «activa» (arranca ese día y la base crea el vínculo con el coach) y, si fue pago único, se anota el cobro.
 *                                Si quien compró NO tenía cuenta (compró con solo su correo), AQUÍ se le crea, ya con el pago confirmado, y la compra queda a su nombre.
 *   invoice.paid               → cada cobro mensual: se anota en `pagos`, se reparte (el coach recibe lo suyo) y se alarga el periodo; también activa una compra que aún estuviera «pendiente».
 *   invoice.payment_failed     → «gracia» por 3 días.
 *   customer.subscription.updated / deleted → marca que canceló / la compra pasa a «vencida».
 *   charge.refunded            → «reembolsada» y se le quita al coach lo que se le había mandado.
 *   charge.dispute.created     → «vencida» y se le quita al coach lo que se le había mandado (el contracargo).
 * El reparto: 20 % la app y 80 % el coach (el dueño vende al 0 %). Un depósito por venta lo dispara la cuenta del coach (etapa 2).
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  MONEDA, aFecha, cobroDeFactura, compraIdDeFactura, compraIdDeSesion, finDePeriodoDeFactura, finDePeriodoDeSuscripcion, idDe, llamaStripe,
  repartoDeUnCobro, suscripcionDeFactura, tasaDeComision, verificaFirma,
} from './stripe.js'

const DIAS_DE_GRACIA = 3
const ahora = () => new Date()
// «Hoy» de la compra: la fecha del servidor 12 horas atrás, la misma que usa la ventana del plan (no se adelanta a ningún huso horario).
const hoy = () => new Date(Date.now() - 12 * 3600 * 1000).toISOString().slice(0, 10)
const responde = (texto: string, estado = 200) => new Response(texto, { status: estado })

// deno-lint-ignore no-explicit-any
type Bd = any
// deno-lint-ignore no-explicit-any
type Obj = any

const bd: Bd = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
const clave = () => (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim()

async function buscaCompra({ compraId, suscripcion }: { compraId?: string | null; suscripcion?: string | null }) {
  if (compraId) {
    const { data, error } = await bd.from('compras').select('*').eq('id', compraId).maybeSingle()
    if (error) throw error // un fallo de la base NO es «no existe»: se contesta 500 para que Stripe reintente
    if (data) return data
  }
  if (suscripcion) {
    const { data, error } = await bd.from('compras').select('*').eq('stripe_subscription_id', suscripcion).maybeSingle()
    if (error) throw error
    if (data) return data
  }
  return null
}

const contrasenaAlAzar = () => Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join('')

/**
 * La cuenta de quien compró sin tener una: la que ya tenga ese correo o, si no hay, una nueva. Solo se llama con el pago confirmado, nunca antes (nadie crea cuentas ajenas escribiendo un correo).
 * La cuenta nueva nace con una contraseña al azar que nadie conoce; quien pagó pone la suya en la página «Listo» (función `compra-lista`). Nace con el perfil armado y le falta el
 * inicio de siempre (sexo, unidad, nacimiento), que la app le hace al abrir. Devuelve `nueva: true` solo si la creó esta llamada.
 */
async function aseguraCuenta(c: Obj, nombre: string | null): Promise<{ id: string; nueva: boolean }> {
  const correo = String(c.correo_comprador ?? '').trim().toLowerCase()
  if (!correo) throw new Error(`La compra ${c.id} no tiene atleta ni correo.`)
  const buscar = async () => {
    const { data, error } = await bd.rpc('usuario_por_correo', { p_correo: correo })
    if (error) throw error
    return Array.isArray(data) ? data[0] : data
  }
  const revisa = (u: Obj) => {
    if (u.role !== 'user' || u.is_active === false) throw new Error(`El correo de la compra ${c.id} es de una cuenta que no puede comprar como atleta.`)
    return { id: u.id as string, nueva: false }
  }
  const ya = await buscar()
  if (ya) return revisa(ya)
  const nombreLimpio = (nombre ?? '').trim().slice(0, 80)
  const { data, error } = await bd.auth.admin.createUser({
    email: correo, password: contrasenaAlAzar(), email_confirm: true, user_metadata: { full_name: nombreLimpio, role: 'user' },
  })
  if (error || !data?.user) {
    // Otro aviso del mismo pago pudo crearla un instante antes: se toma la que quedó.
    const otra = await buscar()
    if (otra) return revisa(otra)
    throw error ?? new Error('No se pudo crear la cuenta del comprador.')
  }
  const { error: errPerfil } = await bd.from('profiles').update({
    role: 'user', is_owner: false, perfil_completo: true, inicio_paso: nombreLimpio ? 'sexo' : 'nombre',
  }).eq('id', data.user.id)
  if (errPerfil) throw errPerfil
  return { id: data.user.id, nueva: true }
}

/** La compra queda activa. El vínculo con el coach (la fila de `equipo` con origen «compra») lo crea la base sola: disparador `compras_vinculo`, ver docs/sql/2026-10-11-monetizacion.sql. */
async function activa(c: Obj, cambios: Obj = {}, nombreDelComprador: string | null = null) {
  const cuenta: Obj = {}
  if (!c.atleta_id) {
    const a = await aseguraCuenta(c, nombreDelComprador)
    cuenta.atleta_id = a.id
    if (a.nueva) cuenta.cuenta_nueva = true // solo se escribe cuando es verdad: otro aviso del mismo pago no debe borrarlo
    c.atleta_id = a.id
  }
  const { error } = await bd.from('compras').update({
    estado: c.estado === 'reembolsada' ? c.estado : 'activa', inicio: c.inicio ?? hoy(), gracia_hasta: null, actualizada_en: ahora().toISOString(), ...cuenta, ...cambios,
  }).eq('id', c.id)
  if (error) throw error
}

/** Anota UN cobro en el libro de pagos y le manda al coach su parte. Un mismo cobro o factura se atiende una sola vez. */
async function registraPago(c: Obj, { bruto, cobro, factura }: { bruto: number; cobro: string | null; factura: string | null }) {
  const busca = cobro ? bd.from('pagos').select('id').eq('stripe_charge_id', cobro) : factura ? bd.from('pagos').select('id').eq('stripe_invoice_id', factura) : null
  if (busca) { const { data: ya, error: errYa } = await busca.maybeSingle(); if (errYa) throw errYa; if (ya) return }
  // El coach borró su cuenta (26 oct 2026): sus compradores siguen con su plan y se les cobra hasta el final del plan; ese dinero se queda en la plataforma (no hay a quién depositarle).
  if (!c.coach_id) {
    const { error: errSin } = await bd.from('pagos').insert({
      compra_id: c.id, coach_id: null, stripe_charge_id: cobro, stripe_invoice_id: factura, bruto: Number(bruto), tasa: 1,
      comision_app: Number(bruto), parte_coach: 0, transfer_coach_id: null, estado: 'cobrado',
    })
    if (errSin && errSin.code !== '23505') throw errSin
    return
  }
  const { data: coach, error: errCoach } = await bd.from('profiles').select('is_owner, comision_especial').eq('id', c.coach_id).maybeSingle()
  if (errCoach) throw errCoach
  const esDueno = !!coach?.is_owner
  const r = repartoDeUnCobro({ bruto, tasa: tasaDeComision({ esDueno, comisionEspecial: coach?.comision_especial }) })
  let transferencia: string | null = null
  if (!esDueno && r.parte_coach_centavos > 0 && cobro) {
    const { data: cuenta, error: errCuenta } = await bd.from('cuentas_stripe').select('acct_id').eq('coach_id', c.coach_id).maybeSingle()
    if (errCuenta) throw errCuenta
    if (cuenta?.acct_id) {
      // `source_transaction`: la transferencia sale de ESTE cobro y puede hacerse de inmediato aunque el dinero aún no esté disponible (en México tarda unos 3 días).
      const t = await llamaStripe(clave(), 'POST', '/v1/transfers', {
        amount: r.parte_coach_centavos, currency: MONEDA, destination: cuenta.acct_id, source_transaction: cobro, transfer_group: `compra_${c.id}`, metadata: { compra_id: c.id },
      }, { idempotencia: `tr_${cobro}` })
      transferencia = t.id
    }
  }
  const { error } = await bd.from('pagos').insert({
    compra_id: c.id, coach_id: c.coach_id, stripe_charge_id: cobro, stripe_invoice_id: factura, bruto: r.bruto, tasa: r.tasa,
    comision_app: r.comision_app, parte_coach: r.parte_coach, transfer_coach_id: transferencia, estado: 'cobrado',
  })
  if (error && error.code !== '23505') throw error
}

/** Le quita al coach lo que se le había mandado de un cobro (reembolso o contracargo). */
async function reviertePago(cobro: string, estado: 'reembolsado' | 'contracargo') {
  const { data: pago, error: errPago } = await bd.from('pagos').select('id, compra_id, transfer_coach_id, parte_coach').eq('stripe_charge_id', cobro).maybeSingle()
  if (errPago) throw errPago
  if (!pago) { console.error(`stripe-webhook: no hay pago anotado para el cobro ${cobro} (${estado}); no hay nada que revertir.`); return null }
  if (pago.transfer_coach_id) {
    try {
      await llamaStripe(clave(), 'POST', `/v1/transfers/${pago.transfer_coach_id}/reversals`, { amount: Math.round(Number(pago.parte_coach) * 100) }, { idempotencia: `rev_${cobro}` })
    } catch (e) {
      // Si ya se había revertido, no es un error. Cualquier otra cosa se avisa a Stripe para que reintente.
      if (!/already been (fully )?reversed/i.test(String((e as Error).message))) throw e
    }
  }
  const { error: errEstado } = await bd.from('pagos').update({ estado }).eq('id', pago.id)
  if (errEstado) throw errEstado
  return pago
}

/** Cambia una compra y NO se traga el error: si la base falla, el aviso se reintenta. */
async function actualizaCompra(id: string, cambios: Obj) {
  const { error } = await bd.from('compras').update(cambios).eq('id', id)
  if (error) throw error
}

/** Una compra ANÓNIMA (la persona borró su cuenta; solo se conserva por sus pagos) únicamente puede estar «cancelada»: la base no admite otro estado sin atleta. Con atleta, se cambia el estado. */
async function cierraSiHayAtleta(compraId: string, estado: string) {
  const { data: c, error } = await bd.from('compras').select('atleta_id').eq('id', compraId).maybeSingle()
  if (error) throw error
  if (!c?.atleta_id) return
  await actualizaCompra(compraId, { estado, actualizada_en: ahora().toISOString() })
}

/* CORREOS DE COMPRAS (A de Andrés, 26 oct 2026): cobro fallido y recibo de cada pago. Salen por Resend, igual que el código de 6 dígitos (`correo-de-la-cuenta`). Respetan «Avisos» de Mi perfil:
   solo se mandan si «Compras y membresías» y «Por correo» están encendidos (sin fila guardada, los de fábrica: encendidos). UN CORREO QUE FALLA NUNCA TUMBA EL AVISO DE STRIPE: se anota y sigue. */
const DOMINIOS_SIN_BUZON = ['sin-correo.traininglabapp.com', 'traininglab.app']
const sinBuzon = (correo: string) => DOMINIOS_SIN_BUZON.some((d) => correo.toLowerCase().endsWith(`@${d}`) || correo.toLowerCase().endsWith(`.${d}`))
const pesos = (n: number) => `$${Number(n).toLocaleString('es-MX', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} MXN`
const fechaLarga = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'America/Mexico_City' }) : '')
const escapa = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

function correoConMarca({ titulo, parrafos }: { titulo: string; parrafos: string[] }) {
  const cuerpo = parrafos.map((x) => `<p style="font-size:15px;line-height:1.5;color:#3d4250;margin:0 0 12px">${escapa(x)}</p>`).join('')
  return `<!doctype html><html><body style="margin:0;background:#f4f5f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111318">
  <div style="max-width:460px;margin:0 auto;padding:32px 20px">
    <div style="background:#ffffff;border-radius:20px;padding:32px 28px;border:1px solid #e6e8ee">
      <div style="font-size:22px;font-weight:800;letter-spacing:-0.4px">Training <span style="color:#1E40E0">Lab</span></div>
      <p style="font-size:18px;font-weight:800;margin:22px 0 12px">${escapa(titulo)}</p>
      ${cuerpo}
      <p style="font-size:13px;line-height:1.5;color:#6b7080;margin:18px 0 0">Puedes apagar estos correos en Mi perfil → Avisos.</p>
    </div>
  </div></body></html>`
}

async function mandaCorreoDeCompra(c: Obj, { asunto, titulo, parrafos }: { asunto: string; titulo: string; parrafos: string[] }) {
  try {
    if (!c.atleta_id) return
    const llave = (Deno.env.get('RESEND_API_KEY') ?? Deno.env.get('SMTP_PASSWORD') ?? '').trim()
    if (!llave) return
    const { data: u } = await bd.auth.admin.getUserById(c.atleta_id)
    const correo = String(u?.user?.email ?? '').trim()
    if (!correo || sinBuzon(correo)) return
    const { data: prefs } = await bd.from('preferencias_de_avisos').select('compras, por_correo').eq('user_id', c.atleta_id).maybeSingle()
    if (prefs && (prefs.compras === false || prefs.por_correo === false)) return
    const remitente = (Deno.env.get('CORREO_REMITENTE') ?? 'Training Lab <no-reply@traininglabapp.com>').trim()
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: remitente, to: [correo], subject: asunto, html: correoConMarca({ titulo, parrafos }), text: `${titulo}\n\n${parrafos.join('\n\n')}\n\nPuedes apagar estos correos en Mi perfil → Avisos.` }),
      signal: AbortSignal.timeout(10_000),
    })
    if (!r.ok) console.error('stripe-webhook: el correo de compra no salió', r.status, (await r.text()).slice(0, 160))
  } catch (e) {
    console.error('stripe-webhook: el correo de compra falló:', e instanceof Error ? e.message : e)
  }
}

const tituloDelPlan = async (c: Obj) => {
  const { data } = await bd.from('vitrina_planes').select('titulo').eq('id', c.vitrina_plan_id).maybeSingle()
  return data?.titulo ?? 'tu plan'
}

async function atiende(evento: Obj) {
  const o: Obj = evento.data?.object ?? {}
  switch (evento.type) {
    case 'checkout.session.completed': {
      const c = await buscaCompra({ compraId: compraIdDeSesion(o) })
      // Entró dinero y no hay compra: puede ser que la base aún no la muestre. Se pide reintento en vez de perder el pago en silencio.
      if (!c) {
        if (!compraIdDeSesion(o)) { console.error(`stripe-webhook: checkout.session.completed ${evento.id} sin id de compra (no es de la app); se ignora`); return }
        throw new Error(`checkout.session.completed ${evento.id}: no se encontró la compra ${compraIdDeSesion(o)}`)
      }
      if (o.payment_status && o.payment_status !== 'paid' && o.payment_status !== 'no_payment_required') return // pago aplazado: se espera al aviso del cobro
      const suscripcion = idDe(o.subscription)
      let periodoHasta: string | null = null
      if (suscripcion && clave()) {
        const s = await llamaStripe(clave(), 'GET', `/v1/subscriptions/${suscripcion}`)
        periodoHasta = aFecha(finDePeriodoDeSuscripcion(s))
      }
      await activa(c, { stripe_customer_id: idDe(o.customer) ?? c.stripe_customer_id, stripe_subscription_id: suscripcion, stripe_payment_intent_id: idDe(o.payment_intent), periodo_hasta: periodoHasta }, o.customer_details?.name ?? null)
      // Pago único: el cobro se anota aquí (en una membresía lo anota `invoice.paid`).
      if (!suscripcion && o.payment_intent && clave()) {
        const pi = await llamaStripe(clave(), 'GET', `/v1/payment_intents/${idDe(o.payment_intent)}`)
        await registraPago(c, { bruto: (o.amount_total ?? 0) / 100, cobro: idDe(pi.latest_charge), factura: null })
        // También su recibo (un pago único no pasa por `invoice.paid`).
        const plan = await tituloDelPlan(c)
        await mandaCorreoDeCompra(c, {
          asunto: `Recibo de ${plan}`, titulo: 'Recibimos tu pago',
          parrafos: [`Recibimos tu pago de «${plan}»: ${pesos((o.amount_total ?? 0) / 100)}.`, 'Este correo es tu recibo.'],
        })
      }
      return
    }
    case 'invoice.paid': {
      const suscripcion = suscripcionDeFactura(o)
      const c = await buscaCompra({ compraId: compraIdDeFactura(o), suscripcion })
      // La factura puede llegar antes que el aviso de la compra: se reintenta (Stripe espera cada vez más) en vez de perder el cobro.
      if (!c) throw new Error(`invoice.paid ${evento.id}: todavía no se encuentra la compra (suscripción ${suscripcion ?? 'sin id'})`)
      await activa(c, { stripe_customer_id: idDe(o.customer) ?? c.stripe_customer_id, stripe_subscription_id: suscripcion ?? c.stripe_subscription_id, periodo_hasta: aFecha(finDePeriodoDeFactura(o)) }, o.customer_name ?? null)
      if ((o.amount_paid ?? 0) > 0) {
        // El webhook entrega la factura con la versión de API de la cuenta (2026+), que ya no trae `charge`. Sin el cobro no hay reembolso de 7 días ni reparto al coach:
        // si falta, se pide la factura con la versión fija de `stripe.js` (2024-06-20), que sí lo trae.
        let cobro = cobroDeFactura(o)
        if (!cobro && o.id && clave()) cobro = cobroDeFactura(await llamaStripe(clave(), 'GET', `/v1/invoices/${o.id}`))
        await registraPago(c, { bruto: o.amount_paid / 100, cobro, factura: o.id })
        // El recibo: cada pago que entra, con su monto y hasta cuándo queda pagado. La primera vez dice «compra»; las siguientes, «renovación».
        const plan = await tituloDelPlan(c)
        const renovacion = o.billing_reason === 'subscription_cycle'
        const hasta = aFecha(finDePeriodoDeFactura(o))
        await mandaCorreoDeCompra(c, {
          asunto: `${renovacion ? 'Renovamos' : 'Recibo de'} ${plan}`,
          titulo: renovacion ? 'Renovamos tu membresía' : 'Recibimos tu pago',
          parrafos: [
            `${renovacion ? 'Renovamos' : 'Recibimos tu pago de'} «${plan}»: ${pesos(o.amount_paid / 100)}.`,
            ...(hasta ? [`Queda pagado hasta el ${fechaLarga(hasta)}.`] : []),
            'Este correo es tu recibo.',
          ],
        })
      }
      return
    }
    case 'invoice.payment_failed': {
      const c = await buscaCompra({ compraId: compraIdDeFactura(o), suscripcion: suscripcionDeFactura(o) })
      if (!c) { console.error(`stripe-webhook: ${evento.type} ${evento.id} sin compra conocida`); return }
      if (!['activa', 'gracia'].includes(c.estado)) return
      const limite = new Date(Date.now() + DIAS_DE_GRACIA * 24 * 3600 * 1000).toISOString()
      const primerFallo = c.estado === 'activa' // Stripe reintenta el cobro varias veces: el correo sale una sola vez, al primer fallo
      await actualizaCompra(c.id, { estado: 'gracia', gracia_hasta: c.gracia_hasta ?? limite, actualizada_en: ahora().toISOString() })
      if (primerFallo) {
        const plan = await tituloDelPlan(c)
        await mandaCorreoDeCompra(c, {
          asunto: `No pudimos cobrar tu renovación de ${plan}`,
          titulo: 'No pudimos cobrar tu renovación',
          parrafos: [
            `Intentamos cobrar la renovación de «${plan}» y el banco no lo aceptó.`,
            `Revisa que tu tarjeta tenga fondos y esté vigente. Stripe volverá a intentarlo en los próximos días; si el pago no pasa, tu membresía vence el ${fechaLarga(c.gracia_hasta ?? limite)} y dejas de ver el plan. Lo que ya anotaste se queda.`,
            'Puedes revisar el estado en la app: Mi perfil → Compras.',
          ],
        })
      }
      return
    }
    case 'customer.subscription.updated': {
      const c = await buscaCompra({ compraId: o.metadata?.compra_id, suscripcion: o.id })
      if (!c) { console.error(`stripe-webhook: ${evento.type} ${evento.id} sin compra conocida`); return }
      await actualizaCompra(c.id, {
        cancelada_en: o.cancel_at_period_end ? (c.cancelada_en ?? ahora().toISOString()) : null,
        periodo_hasta: aFecha(finDePeriodoDeSuscripcion(o)) ?? c.periodo_hasta, actualizada_en: ahora().toISOString(),
      })
      return
    }
    case 'customer.subscription.deleted': {
      const c = await buscaCompra({ compraId: o.metadata?.compra_id, suscripcion: o.id })
      if (!c) { console.error(`stripe-webhook: ${evento.type} ${evento.id} sin compra conocida`); return }
      if (c.estado === 'reembolsada' || !c.atleta_id) return // anónima: ya quedó cancelada al borrarse la cuenta
      await actualizaCompra(c.id, { estado: 'vencida', cancelada_en: c.cancelada_en ?? ahora().toISOString(), actualizada_en: ahora().toISOString() })
      return
    }
    case 'charge.refunded': {
      const pago = await reviertePago(o.id, 'reembolsado')
      // Un reembolso completo cierra la compra; uno parcial deja el plan como estaba.
      if (pago && o.refunded === true) await cierraSiHayAtleta(pago.compra_id, 'reembolsada')
      return
    }
    case 'charge.dispute.created': {
      const pago = await reviertePago(idDe(o.charge)!, 'contracargo')
      if (pago) await cierraSiHayAtleta(pago.compra_id, 'vencida')
      return
    }
    default:
      return // lo demás no nos toca
  }
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return responde('Método no permitido', 405)
  const cuerpo = await req.text()
  const firmado = await verificaFirma(cuerpo, req.headers.get('stripe-signature'), (Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '').trim())
  if (!firmado) return responde('Firma inválida', 400)

  let evento: Obj
  try { evento = JSON.parse(cuerpo) } catch { return responde('JSON inválido', 400) }

  if (!evento?.id || !evento?.type) return responde('Aviso sin id', 400)

  /* Cada evento se atiende una sola vez. Se anota como `pendiente` ANTES de atenderlo y se suelta al terminar:
       · ya atendido (pendiente = false)  → Stripe lo repitió: se contesta 200 sin hacer nada (nunca se duplica una compra ni un pago).
       · pendiente y reciente (< 5 min)   → otra entrega del mismo aviso lo está atendiendo ahora: 503, Stripe reintenta más tarde.
       · pendiente y viejo                → la función se cayó a medias: se retoma. Lo que hace es seguro de repetir (cada cobro y cada transferencia llevan su llave única). */
  const { error: errEvento } = await bd.from('stripe_eventos').insert({ id: evento.id, tipo: evento.type, pendiente: true })
  if (errEvento) {
    if (errEvento.code !== '23505') {
      console.error('stripe-webhook: no se pudo anotar el evento', evento.id, errEvento.message)
      return responde('No se pudo anotar el evento', 500)
    }
    const { data: previo, error: errPrevio } = await bd.from('stripe_eventos').select('pendiente, recibido_en').eq('id', evento.id).maybeSingle()
    if (errPrevio) {
      console.error('stripe-webhook: no se pudo leer el evento anotado', evento.id, errPrevio.message)
      return responde('No se pudo revisar el evento', 500)
    }
    if (!previo || previo.pendiente !== true) return responde('Ya atendido')
    if (Date.now() - new Date(previo.recibido_en).getTime() < 5 * 60_000) return responde('Se está atendiendo', 503)
    // Se retoma: se renueva la hora para que ninguna otra entrega lo tome a la vez.
    const { error: errRetoma } = await bd.from('stripe_eventos').update({ recibido_en: new Date().toISOString() }).eq('id', evento.id).eq('pendiente', true).eq('recibido_en', previo.recibido_en)
    if (errRetoma) { console.error('stripe-webhook: no se pudo retomar', evento.id, errRetoma.message); return responde('No se pudo retomar el evento', 500) }
  }

  try {
    await atiende(evento)
    const { error: errFin } = await bd.from('stripe_eventos').update({ pendiente: false }).eq('id', evento.id)
    // Si esto falla el aviso ya se atendió; se deja pendiente y, al repetirse, se retoma sin duplicar nada. Se avisa en el registro.
    if (errFin) console.error('stripe-webhook: atendido pero no se pudo soltar el aviso', evento.id, errFin.message)
    return responde('ok')
  } catch (e) {
    const mensaje = e instanceof Error ? e.message : (typeof e === 'object' && e && 'message' in e ? String((e as { message: unknown }).message) : String(e))
    console.error(`stripe-webhook: falló ${evento.type} ${evento.id}:`, mensaje)
    // Se suelta la anotación para que cuando Stripe lo reintente se atienda completo.
    const { error: errBorra } = await bd.from('stripe_eventos').delete().eq('id', evento.id)
    if (errBorra) console.error('stripe-webhook: tampoco se pudo borrar la anotación', evento.id, errBorra.message) // queda pendiente: se retoma en 5 min
    return responde(mensaje, 500)
  }
})
