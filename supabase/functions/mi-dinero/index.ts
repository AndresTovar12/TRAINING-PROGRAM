/**
 * Lo del DINERO que cada persona maneja desde Mi perfil (15 oct 2026).
 *
 *   ATLETA   { accion: 'cancelar', compra_id }  → cancela la renovación de su membresía: el plan sigue hasta el fin del periodo ya pagado (Andrés, 11 oct 2026). Si fue dentro de los 7 días
 *                                                  de la primera compra puede pedir reembolso (`reembolsar`).
 *   PROFESIONAL { accion: 'estado' }             → vuelve a leer en Stripe cómo va su cuenta de cobro y lo deja en `cuentas_stripe`.
 *               { accion: 'conectar' }           → crea su cuenta de cobro en Stripe (Express) si no la tiene y devuelve el enlace para llenar sus datos y su cuenta de banco.
 *               { accion: 'panel' }              → enlace a su panel de Stripe (depósitos, estados de cuenta).
 *
 * Todo está escrito para el día en que se enciendan las llaves de Stripe. Sin `STRIPE_SECRET_KEY` lo que necesita a Stripe contesta 503 con `codigo: 'NO_DISPONIBLE'` y la pantalla
 * dice «Pronto». NO se ha probado contra Stripe de verdad (todavía no hay cuenta de pruebas conectada): al encenderlo, probar con tarjeta de prueba y una cuenta Express de prueba.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { llamaStripe } from './stripe.js'

const ORIGENES = ['http://localhost:5173', 'capacitor://localhost' /* app de iPhone (Capacitor) */, 'http://localhost:4173', 'http://127.0.0.1:5173', 'https://app.traininglabapp.com']
const SITIO = (Deno.env.get('SITIO_URL') ?? 'https://app.traininglabapp.com').replace(/\/$/, '')
const permitido = (origen: string | null) => {
  if (!origen) return SITIO
  try {
    if (ORIGENES.includes(origen) || /\.vercel\.app$/.test(new URL(origen).hostname) || origen === SITIO) return origen
  } catch { /* origen malformado */ }
  return SITIO
}
const cabeceras = (origen: string | null): Record<string, string> => ({
  'Access-Control-Allow-Origin': permitido(origen), 'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Max-Age': '86400', Vary: 'Origin',
})
const json = (cuerpo: unknown, estado: number, origen: string | null) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cabeceras(origen) } })
const NO_DISPONIBLE = 'Los cobros todavía no están activos. Pronto.'

Deno.serve(async (req) => {
  const origen = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabeceras(origen) })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origen)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Falta tu sesión. Vuelve a entrar.' }, 401, origen)
  const bd = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: sesion, error: errSesion } = await bd.auth.getUser(token)
  const usuario = sesion?.user
  if (errSesion || !usuario) return json({ error: 'Tu sesión expiró. Vuelve a entrar.' }, 401, origen)

  let p: { accion?: string; compra_id?: string }
  try { p = await req.json() } catch { return json({ error: 'Datos inválidos.' }, 400, origen) }
  const clave = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim()
  const sitio = permitido(origen)

  try {
    /* ---------- ATLETA: cancelar la renovación ---------- */
    if (p.accion === 'cancelar') {
      if (!p.compra_id) return json({ error: 'Falta la compra.' }, 400, origen)
      const { data: compra } = await bd.from('compras').select('id, estado, tipo, stripe_subscription_id, cancelada_en, periodo_hasta').eq('id', p.compra_id).eq('atleta_id', usuario.id).maybeSingle()
      if (!compra) return json({ error: 'No encuentro esa compra.' }, 404, origen)
      if (!['activa', 'gracia'].includes(compra.estado)) return json({ error: 'Esa membresía ya no está activa.' }, 400, origen)
      if (compra.cancelada_en) return json({ error: 'Ya la cancelaste. Sigue hasta el fin de tu periodo.' }, 400, origen)
      if (compra.stripe_subscription_id) {
        if (!clave) return json({ error: NO_DISPONIBLE, codigo: 'NO_DISPONIBLE' }, 503, origen)
        await llamaStripe(clave, 'POST', `/v1/subscriptions/${compra.stripe_subscription_id}`, { cancel_at_period_end: true }, { idempotencia: `cancelar_${compra.id}` })
      } else if (compra.tipo !== 'membresia') {
        return json({ error: 'Esta compra no se renueva: no hay nada que cancelar.' }, 400, origen)
      }
      // Sin suscripción en Stripe (datos de prueba) solo se anota; con ella, Stripe también avisará por `customer.subscription.updated`.
      await bd.from('compras').update({ cancelada_en: new Date().toISOString(), actualizada_en: new Date().toISOString() }).eq('id', compra.id)
      return json({ ok: true, sigue_hasta: compra.periodo_hasta }, 200, origen)
    }

    /* ---------- PROFESIONAL: su cuenta de cobro ---------- */
    const { data: perfil } = await bd.from('profiles').select('role, is_owner, is_active').eq('id', usuario.id).maybeSingle()
    if (perfil?.role !== 'admin' || perfil?.is_active === false) return json({ error: 'Solo un profesional con la cuenta activa puede hacer esto.' }, 403, origen)
    if (p.accion !== 'estado' && p.accion !== 'conectar' && p.accion !== 'panel') return json({ error: 'Acción desconocida' }, 400, origen)
    if (!clave) return json({ error: NO_DISPONIBLE, codigo: 'NO_DISPONIBLE' }, 503, origen)

    let { data: cuenta } = await bd.from('cuentas_stripe').select('*').eq('coach_id', usuario.id).maybeSingle()

    if (p.accion === 'conectar' && !cuenta) {
      const correo = String(usuario.email ?? '')
      const real = correo && !/@(sin-correo\.traininglabapp\.com|traininglab\.app)$/i.test(correo)
      const creada = await llamaStripe(clave, 'POST', '/v1/accounts', {
        type: 'express', country: 'MX', ...(real ? { email: correo } : {}),
        capabilities: { card_payments: { requested: true }, transfers: { requested: true } },
        metadata: { coach_id: usuario.id },
      }, { idempotencia: `cuenta_${usuario.id}` })
      const { data: fila } = await bd.from('cuentas_stripe').insert({ coach_id: usuario.id, acct_id: creada.id }).select('*').single()
      cuenta = fila
    }
    if (!cuenta?.acct_id) return json({ error: 'Todavía no conectas tus cobros.', codigo: 'SIN_CUENTA' }, 404, origen)

    if (p.accion === 'panel') {
      const enlace = await llamaStripe(clave, 'POST', `/v1/accounts/${cuenta.acct_id}/login_links`)
      return json({ url: enlace.url }, 200, origen)
    }

    // Se vuelve a leer en Stripe y se deja anotado (también tras volver de llenar sus datos).
    const acct = await llamaStripe(clave, 'GET', `/v1/accounts/${cuenta.acct_id}`)
    const banco = acct.external_accounts?.data?.[0]
    const cambios = {
      onboarding_completo: !!acct.details_submitted, cobros_ok: !!acct.charges_enabled, depositos_ok: !!acct.payouts_enabled,
      depositos: banco ? `${banco.bank_name ?? 'Banco'} ···· ${banco.last4 ?? ''}`.trim() : null,
      requisitos_pendientes: acct.requirements?.currently_due ?? [], actualizada_en: new Date().toISOString(),
    }
    await bd.from('cuentas_stripe').update(cambios).eq('coach_id', usuario.id)
    const estado = { ...cuenta, ...cambios }

    if (p.accion === 'conectar' && !(estado.onboarding_completo && estado.cobros_ok && estado.depositos_ok)) {
      const enlace = await llamaStripe(clave, 'POST', '/v1/account_links', {
        account: cuenta.acct_id, type: 'account_onboarding',
        refresh_url: `${sitio}/?cobros=reintentar`, return_url: `${sitio}/?cobros=listo`,
      })
      return json({ estado, url: enlace.url }, 200, origen)
    }
    return json({ estado }, 200, origen)
  } catch (e) {
    console.error('mi-dinero falló:', e instanceof Error ? e.message : e)
    return json({ error: e instanceof Error ? e.message : 'No se pudo completar. Inténtalo de nuevo.' }, 500, origen)
  }
})
