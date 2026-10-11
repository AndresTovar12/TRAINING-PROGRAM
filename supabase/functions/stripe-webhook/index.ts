/**
 * Atiende los avisos de Stripe: es quien ACTIVA una compra cuando el pago de verdad se hizo, y quien reparte el dinero.
 *
 * Seguridad: solo se atiende lo que viene firmado por Stripe con el secreto de ESTE webhook (`STRIPE_WEBHOOK_SECRET`); lo demás se rechaza. Por eso no lleva JWT. Cada evento se atiende
 * UNA vez (tabla `stripe_eventos`): si Stripe lo repite, se ignora. Si algo falla a medias, se contesta 500 y Stripe vuelve a mandarlo.
 *
 * Qué hace con cada aviso (ver docs/superpowers/specs/2026-10-10-monetizacion-design.md, secciones 3 y 8):
 *   checkout.session.completed → la compra pasa a «activa» (arranca ese día, aparece el vínculo con el coach en su lista) y, si fue pago único, se anota el cobro.
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
    const { data } = await bd.from('compras').select('*').eq('id', compraId).maybeSingle()
    if (data) return data
  }
  if (suscripcion) {
    const { data } = await bd.from('compras').select('*').eq('stripe_subscription_id', suscripcion).maybeSingle()
    if (data) return data
  }
  return null
}

/** La compra queda activa y el comprador aparece como suscriptor en la lista del coach (fila de `equipo` con origen «compra»). */
async function activa(c: Obj, cambios: Obj = {}) {
  const { error } = await bd.from('compras').update({
    estado: c.estado === 'reembolsada' ? c.estado : 'activa', inicio: c.inicio ?? hoy(), gracia_hasta: null, actualizada_en: ahora().toISOString(), ...cambios,
  }).eq('id', c.id)
  if (error) throw error
  const { data: fila } = await bd.from('equipo').select('estado').eq('atleta_id', c.atleta_id).eq('profesional_id', c.coach_id).maybeSingle()
  if (!fila) {
    const { error: e } = await bd.from('equipo').insert({ atleta_id: c.atleta_id, profesional_id: c.coach_id, estado: 'activo', origen: 'compra', aceptado_en: ahora().toISOString() })
    if (e) throw e
  } else if (fila.estado !== 'activo') {
    const { error: e } = await bd.from('equipo').update({ estado: 'activo', origen: 'compra', aceptado_en: ahora().toISOString(), quitado_en: null }).eq('atleta_id', c.atleta_id).eq('profesional_id', c.coach_id)
    if (e) throw e
  }
}

/** Anota UN cobro en el libro de pagos y le manda al coach su parte. Un mismo cobro o factura se atiende una sola vez. */
async function registraPago(c: Obj, { bruto, cobro, factura }: { bruto: number; cobro: string | null; factura: string | null }) {
  const busca = cobro ? bd.from('pagos').select('id').eq('stripe_charge_id', cobro) : factura ? bd.from('pagos').select('id').eq('stripe_invoice_id', factura) : null
  if (busca) { const { data: ya } = await busca.maybeSingle(); if (ya) return }
  const { data: coach } = await bd.from('profiles').select('is_owner').eq('id', c.coach_id).maybeSingle()
  const esDueno = !!coach?.is_owner
  const r = repartoDeUnCobro({ bruto, tasa: tasaDeComision({ esDueno }) })
  let transferencia: string | null = null
  if (!esDueno && r.parte_coach_centavos > 0 && cobro) {
    const { data: cuenta } = await bd.from('cuentas_stripe').select('acct_id').eq('coach_id', c.coach_id).maybeSingle()
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
  const { data: pago } = await bd.from('pagos').select('id, compra_id, transfer_coach_id, parte_coach').eq('stripe_charge_id', cobro).maybeSingle()
  if (!pago) return null
  if (pago.transfer_coach_id) {
    try {
      await llamaStripe(clave(), 'POST', `/v1/transfers/${pago.transfer_coach_id}/reversals`, { amount: Math.round(Number(pago.parte_coach) * 100) }, { idempotencia: `rev_${cobro}` })
    } catch (e) {
      // Si ya se había revertido, no es un error. Cualquier otra cosa se avisa a Stripe para que reintente.
      if (!/already been (fully )?reversed/i.test(String((e as Error).message))) throw e
    }
  }
  await bd.from('pagos').update({ estado }).eq('id', pago.id)
  return pago
}

async function atiende(evento: Obj) {
  const o: Obj = evento.data?.object ?? {}
  switch (evento.type) {
    case 'checkout.session.completed': {
      const c = await buscaCompra({ compraId: compraIdDeSesion(o) })
      if (!c) return
      if (o.payment_status && o.payment_status !== 'paid' && o.payment_status !== 'no_payment_required') return // pago aplazado: se espera al aviso del cobro
      const suscripcion = idDe(o.subscription)
      let periodoHasta: string | null = null
      if (suscripcion && clave()) {
        const s = await llamaStripe(clave(), 'GET', `/v1/subscriptions/${suscripcion}`)
        periodoHasta = aFecha(finDePeriodoDeSuscripcion(s))
      }
      await activa(c, { stripe_customer_id: idDe(o.customer) ?? c.stripe_customer_id, stripe_subscription_id: suscripcion, stripe_payment_intent_id: idDe(o.payment_intent), periodo_hasta: periodoHasta })
      // Pago único: el cobro se anota aquí (en una membresía lo anota `invoice.paid`).
      if (!suscripcion && o.payment_intent && clave()) {
        const pi = await llamaStripe(clave(), 'GET', `/v1/payment_intents/${idDe(o.payment_intent)}`)
        await registraPago(c, { bruto: (o.amount_total ?? 0) / 100, cobro: idDe(pi.latest_charge), factura: null })
      }
      return
    }
    case 'invoice.paid': {
      const suscripcion = suscripcionDeFactura(o)
      const c = await buscaCompra({ compraId: compraIdDeFactura(o), suscripcion })
      if (!c) return
      await activa(c, { stripe_customer_id: idDe(o.customer) ?? c.stripe_customer_id, stripe_subscription_id: suscripcion ?? c.stripe_subscription_id, periodo_hasta: aFecha(finDePeriodoDeFactura(o)) })
      if ((o.amount_paid ?? 0) > 0) await registraPago(c, { bruto: o.amount_paid / 100, cobro: cobroDeFactura(o), factura: o.id })
      return
    }
    case 'invoice.payment_failed': {
      const c = await buscaCompra({ compraId: compraIdDeFactura(o), suscripcion: suscripcionDeFactura(o) })
      if (!c || !['activa', 'gracia'].includes(c.estado)) return
      const limite = new Date(Date.now() + DIAS_DE_GRACIA * 24 * 3600 * 1000).toISOString()
      await bd.from('compras').update({ estado: 'gracia', gracia_hasta: c.gracia_hasta ?? limite, actualizada_en: ahora().toISOString() }).eq('id', c.id)
      return
    }
    case 'customer.subscription.updated': {
      const c = await buscaCompra({ compraId: o.metadata?.compra_id, suscripcion: o.id })
      if (!c) return
      await bd.from('compras').update({
        cancelada_en: o.cancel_at_period_end ? (c.cancelada_en ?? ahora().toISOString()) : null,
        periodo_hasta: aFecha(finDePeriodoDeSuscripcion(o)) ?? c.periodo_hasta, actualizada_en: ahora().toISOString(),
      }).eq('id', c.id)
      return
    }
    case 'customer.subscription.deleted': {
      const c = await buscaCompra({ compraId: o.metadata?.compra_id, suscripcion: o.id })
      if (!c || c.estado === 'reembolsada') return
      await bd.from('compras').update({ estado: 'vencida', cancelada_en: c.cancelada_en ?? ahora().toISOString(), actualizada_en: ahora().toISOString() }).eq('id', c.id)
      return
    }
    case 'charge.refunded': {
      const pago = await reviertePago(o.id, 'reembolsado')
      // Un reembolso completo cierra la compra; uno parcial deja el plan como estaba.
      if (pago && o.refunded === true) await bd.from('compras').update({ estado: 'reembolsada', actualizada_en: ahora().toISOString() }).eq('id', pago.compra_id)
      return
    }
    case 'charge.dispute.created': {
      const pago = await reviertePago(idDe(o.charge)!, 'contracargo')
      if (pago) await bd.from('compras').update({ estado: 'vencida', actualizada_en: ahora().toISOString() }).eq('id', pago.compra_id)
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

  // Cada evento se atiende una sola vez: si ya está anotado, Stripe lo repitió.
  const { error: errEvento } = await bd.from('stripe_eventos').insert({ id: evento.id, tipo: evento.type })
  if (errEvento) return errEvento.code === '23505' ? responde('Ya atendido') : responde('No se pudo anotar el evento', 500)

  try {
    await atiende(evento)
    return responde('ok')
  } catch (e) {
    // Si falló a medias, se borra la anotación para que cuando Stripe lo reintente se atienda completo.
    await bd.from('stripe_eventos').delete().eq('id', evento.id)
    return responde(e instanceof Error ? e.message : 'Error', 500)
  }
})
