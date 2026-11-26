/**
 * Lo del DINERO que cada persona maneja desde Mi perfil (15 oct 2026).
 *
 *   ATLETA   { accion: 'cancelar', compra_id }  → cancela la renovación de su membresía: el plan sigue hasta el fin del periodo ya pagado (Andrés, 11 oct 2026). Si fue dentro de los 7 días
 *                                                  de la primera compra puede pedir reembolso (`reembolsar`).
 *   PROFESIONAL { accion: 'estado' }             → vuelve a leer en Stripe cómo va su cuenta de cobro y lo deja en `cuentas_stripe`.
 *               { accion: 'conectar' }           → crea su cuenta de cobro en Stripe (Express) si no la tiene y devuelve el enlace para llenar sus datos y su cuenta de banco.
 *               { accion: 'panel' }              → enlace a su panel de Stripe (depósitos, estados de cuenta).
 *               { accion: 'ganancias' }          → «Mis ganancias» (26 nov 2026): su libro, sus retiros, su cuenta de banco y su CLABE.
 *               { accion: 'retirar', monto? }    → retira lo listo (todo, o «otra cantidad»): ventas completas, las más viejas primero. Lo de la web sale por Stripe (depósito
 *                                                  manual de su cuenta conectada) y lo de iPhone por SPEI (`spei.js`, en modo de prueba mientras no haya proveedor). Mínimo $200.
 *               { accion: 'clabe', clabe, titular } → la CLABE para lo de iPhone (Stripe no deja leer la de su cuenta).
 *   DUEÑO      { accion: 'apple_pago', mes, recibido } → Apple pagó ese mes fiscal: se reparte entre las ventas de iPhone de ese mes y pasan a «listo».
 *
 * Todo está escrito para el día en que se enciendan las llaves de Stripe. Sin `STRIPE_SECRET_KEY` lo que necesita a Stripe contesta 503 con `codigo: 'NO_DISPONIBLE'` y la pantalla
 * dice «Pronto». NO se ha probado contra Stripe de verdad (todavía no hay cuenta de pruebas conectada): al encenderlo, probar con tarjeta de prueba y una cuenta Express de prueba.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { MONEDA, llamaStripe } from './stripe.js'
import { MINIMO_RETIRO, asignaRetiro, bancoDeClabe, clabeValida, destinoCorto, estaListo, estadoDeRetiro, repartePagoDeApple } from './dinero.js'
import { enviaSpei, revisaEnvioSpei } from './spei.js'

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

  let p: { accion?: string; compra_id?: string; clabe?: string; titular?: string; monto?: number | null; mes?: string; recibido?: number }
  try { p = await req.json() } catch { return json({ error: 'Datos inválidos.' }, 400, origen) }
  const clave = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim()
  const sitio = sitioDeRegreso(origen)

  try {
    /* ---------- ATLETA: cancelar la renovación ---------- */
    if (p.accion === 'cancelar') {
      if (!p.compra_id) return json({ error: 'Falta la compra.' }, 400, origen)
      const { data: compra } = await bd.from('compras').select('id, estado, tipo, canal, stripe_subscription_id, cancelada_en, periodo_hasta').eq('id', p.compra_id).eq('atleta_id', usuario.id).maybeSingle()
      if (!compra) return json({ error: 'No encuentro esa compra.' }, 404, origen)
      if (compra.canal === 'apple') return json({ error: 'Esta membresía se cancela en Ajustes del iPhone, en tu Apple Account → Suscripciones.' }, 400, origen)
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
    if (p.accion === 'ganancias') return json(await ganancias(bd, usuario.id), 200, origen)
    if (p.accion === 'clabe') {
      const clabe = String(p.clabe ?? '').replace(/\s+/g, '')
      if (!clabeValida(clabe)) return json({ error: 'Revisa tu CLABE: son 18 números.' }, 400, origen)
      const titular = String(p.titular ?? '').trim().slice(0, 120) || null
      const { error } = await bd.from('cuentas_spei').upsert({ coach_id: usuario.id, clabe, banco: bancoDeClabe(clabe), titular, actualizada_en: new Date().toISOString() })
      if (error) throw error
      return json({ ok: true, destino: destinoCorto(bancoDeClabe(clabe), clabe) }, 200, origen)
    }
    if (p.accion === 'retirar') return await retirar(bd, usuario.id, p.monto ?? null, clave, origen)
    if (p.accion === 'apple_pago') {
      if (!perfil?.is_owner) return json({ error: 'Solo el dueño marca los pagos de Apple.' }, 403, origen)
      return await marcaPagoDeApple(bd, usuario.id, String(p.mes ?? ''), Number(p.recibido), origen)
    }
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
    let acct = await llamaStripe(clave, 'GET', `/v1/accounts/${cuenta.acct_id}`)
    // El coach retira cuando quiere: su cuenta pasa a depósitos MANUALES (26 nov 2026). Así Stripe no deposita solo y «Retirar» crea el depósito.
    if (acct.settings?.payouts?.schedule?.interval !== 'manual') {
      try {
        acct = await llamaStripe(clave, 'POST', `/v1/accounts/${cuenta.acct_id}`, { settings: { payouts: { schedule: { interval: 'manual' } } } })
      } catch (e) { console.error('mi-dinero: no se pudo pasar la cuenta a depósitos manuales', e instanceof Error ? e.message : e) }
    }
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

/* ================= «Mis ganancias» (26 nov 2026) ================= */
// deno-lint-ignore no-explicit-any
type Bd = any
const hoyEnMexico = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Mexico_City' }).format(new Date())
const modoSpei = () => ((Deno.env.get('SPEI_MODO') ?? 'prueba').trim() === 'real' ? 'real' : 'prueba')

async function interruptor(bd: Bd, clave: string) {
  const { data } = await bd.from('ajustes_publicos').select('valor').eq('clave', clave).maybeSingle()
  return data?.valor === true
}

/** Los envíos por SPEI que siguen «enviados»: se revisan (en prueba, se simula el resultado). Si uno no llegó, sus ventas regresan a «listo». */
async function revisaSpeiPendientes(bd: Bd, coachId: string) {
  const { data: pendientes } = await bd.from('retiro_envios').select('id, retiro_id, llega_estimado, retiros!inner(coach_id)').eq('via', 'spei').eq('estado', 'enviado').eq('retiros.coach_id', coachId)
  if (!pendientes?.length) return
  const { data: cuenta } = await bd.from('cuentas_spei').select('clabe').eq('coach_id', coachId).maybeSingle()
  for (const e of pendientes) {
    const r = revisaEnvioSpei({ clabe: cuenta?.clabe, llega_estimado: e.llega_estimado }, { modo: modoSpei() })
    if (r.estado === 'enviado') continue
    await bd.from('retiro_envios').update(r.estado === 'llego' ? { estado: 'llego', llego_en: new Date().toISOString() } : { estado: 'fallo', motivo: r.motivo ?? null }).eq('id', e.id)
    if (r.estado === 'fallo') await bd.from('libro_coach').update({ estado: 'listo', retiro_id: null }).eq('retiro_id', e.retiro_id).eq('canal', 'apple')
    const { data: todos } = await bd.from('retiro_envios').select('estado').eq('retiro_id', e.retiro_id)
    const estado = estadoDeRetiro(todos ?? [])
    await bd.from('retiros').update({ estado, ...(estado === 'llego' ? { llego_en: new Date().toISOString() } : {}) }).eq('id', e.retiro_id)
  }
}

async function ganancias(bd: Bd, coachId: string) {
  const hoy = hoyEnMexico()
  await revisaSpeiPendientes(bd, coachId)
  // Lo de la web que Stripe ya liberó pasa a «listo» (la fecha es la de Stripe; aquí solo se deja anotado).
  await bd.from('libro_coach').update({ estado: 'listo', listo_en: new Date().toISOString() }).eq('coach_id', coachId).eq('canal', 'web').eq('estado', 'en_camino').lte('listo_estimado', hoy)
  const [{ data: libro }, { data: retiros }, { data: cuenta }, { data: spei }, enviosSpei] = await Promise.all([
    bd.from('libro_coach').select('id, compra_id, canal, tipo, bruto, monto, aproximado, estado, listo_estimado, listo_en, apple_mes, retiro_id, creado_en, compras(atleta_id, vitrina_plan_id, tipo, vitrina_planes(titulo), profiles!compras_atleta_id_fkey(full_name, username, avatar_url))')
      .eq('coach_id', coachId).order('creado_en', { ascending: false }).limit(500),
    bd.from('retiros').select('id, monto, estado, destino, llega_estimado, llego_en, creado_en, retiro_envios(via, monto, estado, llega_estimado, llego_en, motivo)').eq('coach_id', coachId).order('creado_en', { ascending: false }).limit(60),
    bd.from('cuentas_stripe').select('onboarding_completo, cobros_ok, depositos_ok, depositos').eq('coach_id', coachId).maybeSingle(),
    bd.from('cuentas_spei').select('clabe, banco').eq('coach_id', coachId).maybeSingle(),
    interruptor(bd, 'envios_spei'),
  ])
  // deno-lint-ignore no-explicit-any
  const renglones = (libro ?? []).map((x: any) => ({
    id: x.id, compra_id: x.compra_id, canal: x.canal, tipo: x.tipo, bruto: Number(x.bruto), monto: Number(x.monto), aproximado: x.aproximado, estado: x.estado,
    listo_estimado: x.listo_estimado, listo_en: x.listo_en, apple_mes: x.apple_mes, retiro_id: x.retiro_id, creado_en: x.creado_en,
    atleta: x.compras?.profiles ? { nombre: x.compras.profiles.full_name || x.compras.profiles.username, foto: x.compras.profiles.avatar_url } : null,
    plan: x.compras?.vitrina_planes?.titulo ?? null, plan_id: x.compras?.vitrina_plan_id ?? null, compra_tipo: x.compras?.tipo ?? null,
  }))
  const yaRetiroPorStripe = (retiros ?? []).some((r: { retiro_envios?: { via: string; estado: string }[] }) => (r.retiro_envios ?? []).some((e) => e.via === 'stripe' && e.estado === 'llego'))
  return {
    hoy, libro: renglones, retiros: retiros ?? [],
    banco: cuenta?.depositos_ok ? { destino: cuenta.depositos ?? 'Tu banco' } : null,
    cuenta_stripe: cuenta ? { conectada: !!cuenta.onboarding_completo, depositos_ok: !!cuenta.depositos_ok } : null,
    spei: spei ? { destino: destinoCorto(spei.banco, spei.clabe) } : null,
    envios_spei: enviosSpei, primer_retiro: !yaRetiroPorStripe, minimo: MINIMO_RETIRO,
  }
}

// deno-lint-ignore no-explicit-any
async function retirar(bd: Bd, coachId: string, monto: number | null, clave: string, origen: string | null): Promise<Response> {
  const hoy = hoyEnMexico()
  const responde = (cuerpo: unknown, estado: number) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': origen ?? '*', Vary: 'Origin' } })
  // No dos retiros a la vez: si hay uno de hace menos de un minuto, se espera.
  const { data: reciente } = await bd.from('retiros').select('id').eq('coach_id', coachId).gte('creado_en', new Date(Date.now() - 60_000).toISOString()).limit(1)
  if (reciente?.length) return responde({ error: 'Ya mandaste un retiro. Espera un momento.' }, 429)
  const [{ data: libro }, { data: cuenta }, { data: spei }, conSpei] = await Promise.all([
    bd.from('libro_coach').select('id, canal, monto, estado, listo_estimado, creado_en').eq('coach_id', coachId).in('estado', ['listo', 'en_camino']),
    bd.from('cuentas_stripe').select('acct_id, depositos_ok, depositos').eq('coach_id', coachId).maybeSingle(),
    bd.from('cuentas_spei').select('clabe, banco').eq('coach_id', coachId).maybeSingle(),
    interruptor(bd, 'envios_spei'),
  ])
  const puedeWeb = !!(clave && cuenta?.acct_id && cuenta?.depositos_ok)
  const puedeApple = !!(conSpei && spei?.clabe)
  // deno-lint-ignore no-explicit-any
  const listos = (libro ?? []).filter((r: any) => estaListo(r, hoy) && ((r.canal === 'web' && puedeWeb) || (r.canal === 'apple' && puedeApple)))
  const pide = monto === null || monto === undefined || String(monto) === '' ? null : Number(monto)
  if (pide !== null && !(pide >= MINIMO_RETIRO)) return responde({ error: `El mínimo es $${MINIMO_RETIRO}.`, codigo: 'minimo' }, 400)
  const a = asignaRetiro(listos, pide)
  if (a.total < MINIMO_RETIRO) return responde({ error: `El mínimo es $${MINIMO_RETIRO}.`, codigo: 'minimo' }, 400)

  const destino = a.stripe > 0 ? (cuenta?.depositos ?? 'Tu banco') : destinoCorto(spei?.banco, spei?.clabe)
  const { data: retiro, error: errRetiro } = await bd.from('retiros').insert({ coach_id: coachId, monto: a.total, estado: 'enviado', destino }).select('id').single()
  if (errRetiro) throw errRetiro
  const fechas: string[] = []
  // deno-lint-ignore no-explicit-any
  const ids = new Set(a.ids)
  // deno-lint-ignore no-explicit-any
  const idsDe = (canal: string) => listos.filter((r: any) => ids.has(r.id) && r.canal === canal).map((r: any) => r.id)
  try {
    if (a.stripe > 0) {
      const dep = await llamaStripe(clave, 'POST', '/v1/payouts', { amount: Math.round(a.stripe * 100), currency: MONEDA, metadata: { retiro_id: retiro.id } }, { cuenta: cuenta!.acct_id, idempotencia: `retiro_${retiro.id}` })
      const llega = dep.arrival_date ? new Date(Number(dep.arrival_date) * 1000).toISOString().slice(0, 10) : null
      if (llega) fechas.push(llega)
      await bd.from('retiro_envios').insert({ retiro_id: retiro.id, via: 'stripe', monto: a.stripe, estado: 'enviado', stripe_payout: dep.id, llega_estimado: llega })
      await bd.from('libro_coach').update({ estado: 'retirado', retiro_id: retiro.id }).in('id', idsDe('web'))
    }
  } catch (e) {
    await bd.from('retiros').update({ estado: 'no_llego' }).eq('id', retiro.id)
    console.error('mi-dinero: Stripe no aceptó el retiro', e instanceof Error ? e.message : e)
    return responde({ error: 'No se pudo mandar tu retiro. Inténtalo otra vez en un rato.' }, 502)
  }
  if (a.spei > 0) {
    try {
      const envio = await enviaSpei({ clabe: spei!.clabe, monto: a.spei, referencia: retiro.id.replace(/-/g, '').slice(0, 30) }, { modo: modoSpei() })
      fechas.push(envio.llega_estimado)
      await bd.from('retiro_envios').insert({ retiro_id: retiro.id, via: 'spei', monto: a.spei, estado: 'enviado', spei_referencia: envio.id, llega_estimado: envio.llega_estimado })
      await bd.from('libro_coach').update({ estado: 'retirado', retiro_id: retiro.id }).in('id', idsDe('apple'))
    } catch (e) {
      console.error('mi-dinero: el SPEI no salió', e instanceof Error ? e.message : e)
      if (a.stripe <= 0) { await bd.from('retiros').update({ estado: 'no_llego' }).eq('id', retiro.id); return responde({ error: 'No se pudo mandar tu retiro. Inténtalo otra vez en un rato.' }, 502) }
      await bd.from('retiros').update({ monto: a.stripe }).eq('id', retiro.id) // salió solo lo de la web; lo de iPhone se queda listo
    }
  }
  const llega = fechas.sort().at(-1) ?? null
  await bd.from('retiros').update({ llega_estimado: llega }).eq('id', retiro.id)
  return responde({ ok: true, retiro_id: retiro.id, monto: a.total, llega_estimado: llega, destino }, 200)
}

async function marcaPagoDeApple(bd: Bd, quien: string, mes: string, recibido: number, origen: string | null): Promise<Response> {
  const responde = (cuerpo: unknown, estado: number) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'Access-Control-Allow-Origin': origen ?? '*', Vary: 'Origin' } })
  if (!/^\d{4}-\d{2}-\d{2}$/.test(mes) || !(recibido >= 0)) return responde({ error: 'Falta el mes o lo que pagó Apple.' }, 400)
  const { data: ya } = await bd.from('apple_pagos').select('mes').eq('mes', mes).maybeSingle()
  if (ya) return responde({ error: 'Ese mes ya está marcado.' }, 409)
  const { data: ventas, error } = await bd.from('libro_coach').select('id, bruto').eq('canal', 'apple').eq('apple_mes', mes).eq('estado', 'en_camino').in('tipo', ['venta', 'renovacion'])
  if (error) throw error
  const reparto = repartePagoDeApple(ventas ?? [], recibido)
  for (const r of reparto) {
    const { error: e } = await bd.from('libro_coach').update({ monto: r.monto, aproximado: false, estado: 'listo', listo_en: new Date().toISOString() }).eq('id', r.id)
    if (e) throw e
  }
  // deno-lint-ignore no-explicit-any
  const brutas = (ventas ?? []).reduce((s: number, v: any) => s + Number(v.bruto), 0)
  const { error: e2 } = await bd.from('apple_pagos').insert({ mes, recibido, ventas_brutas: brutas, marcado_por: quien })
  if (e2) throw e2
  return responde({ ok: true, ventas: reparto.length }, 200)
}
