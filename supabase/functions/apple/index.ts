/**
 * COMPRAR CON APPLE dentro de la app del iPhone (Advanced Commerce API, encargo «Compra y dinero», 26 nov 2026). Detrás del interruptor `compra_apple` (apagado).
 *
 * Con la sesión del atleta:
 *   { accion: 'firmar', usuario, slug } → crea la compra «pendiente» (canal apple) y devuelve lo que la app le pasa a StoreKit: el producto genérico y la petición firmada
 *                                          con el nombre del plan y el MISMO precio de la web.
 *   { accion: 'restaurar', transacciones: [id] } → «Restaurar compras»: cada transacción se pide a Apple; las compras de ESTA cuenta se ponen al día (activa o vencida,
 *                                          hasta cuándo). Una compra de otra cuenta de Training Lab no se mueve.
 *   { accion: 'confirmar', compra_id, transaccion } → la app terminó de pagar: el servidor le pide esa transacción a la App Store Server API (nunca le cree al teléfono),
 *                                          revisa que sea de esta app, de esta cuenta y de esta compra, y la activa. Una sola vez.
 * Sin sesión, de Apple (App Store Server Notifications V2, `{ signedPayload }`): compra, renovación, cancelación, vencimiento y reembolso. Cada aviso se atiende una vez
 * (`apple_avisos`) y su transacción se vuelve a pedir a la API de Apple.
 *
 * El dinero: Apple cobra y le paga a Training Lab unos 33 días después de cerrar cada mes fiscal. Al coach le toca el 80 % de lo que Apple paga; mientras tanto se
 * anota aproximado en `libro_coach` («≈», `dinero.js`) con la fecha estimada de su mes (`apple_calendario`). Andrés marca lo que pagó Apple (`mi-dinero`, apple_pago).
 *
 * Secretos: APPLE_IAP_KEY (la llave .p8 «In-App Purchase», en PEM), APPLE_IAP_KEY_ID, APPLE_ISSUER_ID, APPLE_BUNDLE_ID (com.traininglabapp.app),
 * APPLE_PRODUCTO_UNICO y APPLE_PRODUCTO_MEMBRESIA (los productos genéricos de App Store Connect). Sin ellos contesta que no está disponible.
 * NO SE HA PROBADO contra Apple: el acceso a Advanced Commerce, sus productos genéricos y su sandbox llegan cuando Apple aprueba la solicitud.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import {
  accionDeAviso, aFirmar, cabeceraJws, cargaDeJws, claimsDeCompra, claimsDelServidor, datosParaStoreKit, mesFiscal, pesosDeApple, peticionDeCompra, problemaDeTransaccion,
} from './aca.js'
import { parteDelCoach } from './dinero.js'

// deno-lint-ignore no-explicit-any
type Obj = any
const bd = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
const BUNDLE = (Deno.env.get('APPLE_BUNDLE_ID') ?? 'com.traininglabapp.app').trim()
const LLAVE_ID = (Deno.env.get('APPLE_IAP_KEY_ID') ?? '').trim()
const EMISOR = (Deno.env.get('APPLE_ISSUER_ID') ?? '').trim()
const LLAVE_PEM = (Deno.env.get('APPLE_IAP_KEY') ?? '').trim()
const PRODUCTO = {
  pago_unico: (Deno.env.get('APPLE_PRODUCTO_UNICO') ?? `${BUNDLE}.aca.generic.consumable`).trim(),
  membresia: (Deno.env.get('APPLE_PRODUCTO_MEMBRESIA') ?? '').trim(),
}
const CORS = {
  'Access-Control-Allow-Origin': 'capacitor://localhost', 'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', Vary: 'Origin',
}
const json = (cuerpo: unknown, estado = 200) => new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...CORS } })
const ahora = () => new Date().toISOString()
const hoy = () => new Date(Date.now() - 12 * 3600 * 1000).toISOString().slice(0, 10)

/* ---------- Firmar (ES256) ---------- */
let llaveCache: CryptoKey | null = null
async function llave(): Promise<CryptoKey> {
  if (llaveCache) return llaveCache
  const der = Uint8Array.from(atob(LLAVE_PEM.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '')), (c) => c.charCodeAt(0))
  llaveCache = await crypto.subtle.importKey('pkcs8', der, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
  return llaveCache
}
async function firma(claims: Obj): Promise<string> {
  const texto = aFirmar(cabeceraJws(LLAVE_ID), claims)
  const f = new Uint8Array(await crypto.subtle.sign({ name: 'ECDSA', hash: 'SHA-256' }, await llave(), new TextEncoder().encode(texto)))
  return `${texto}.${btoa(String.fromCharCode(...f)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')}`
}

/** Una transacción, como la tiene Apple (primero producción; si no existe ahí, sandbox: TestFlight y pruebas). */
async function transaccionDeApple(id: string): Promise<Obj | null> {
  const token = await firma(claimsDelServidor({ emisor: EMISOR, bundle: BUNDLE }))
  for (const host of ['https://api.storekit.itunes.apple.com', 'https://api.storekit-sandbox.itunes.apple.com']) {
    const r = await fetch(`${host}/inApps/v1/transactions/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(15_000) })
    if (r.status === 404) continue
    if (!r.ok) throw new Error(`App Store Server API respondió ${r.status}`)
    const { signedTransactionInfo } = await r.json()
    return cargaDeJws(signedTransactionInfo)
  }
  return null
}

const listo = () => !!(LLAVE_PEM && LLAVE_ID && EMISOR && BUNDLE)
async function compraAppleAbierta() {
  const { data } = await bd.from('ajustes_publicos').select('clave, valor').in('clave', ['compra_apple', 'ventas_abiertas'])
  const v = Object.fromEntries((data ?? []).map((x: Obj) => [x.clave, x.valor]))
  return v.compra_apple === true && v.ventas_abiertas === true
}

/* ---------- El dinero de una transacción ---------- */
async function anotaPago(c: Obj, tx: Obj, tipo: 'venta' | 'renovacion') {
  const bruto = pesosDeApple(tx.price)
  const { data: coach } = await bd.from('profiles').select('is_owner').eq('id', c.coach_id).maybeSingle()
  const parte = parteDelCoach({ canal: 'apple', bruto })
  const { data: pago, error } = await bd.from('pagos').insert({
    compra_id: c.id, coach_id: c.coach_id, canal: 'apple', apple_transaccion: String(tx.transactionId), bruto, tasa: 0.2,
    comision_app: Math.max(0, bruto - parte.monto), parte_coach: coach?.is_owner ? 0 : parte.monto, estado: 'cobrado',
  }).select('id').single()
  if (error) { if (error.code === '23505') return; throw error }
  if (!c.coach_id || coach?.is_owner) return
  const { data: calendario } = await bd.from('apple_calendario').select('inicio, fin, pago_estimado')
  const mes = mesFiscal(calendario ?? [], new Date(Number(tx.purchaseDate ?? Date.now())).toISOString())
  const { error: e2 } = await bd.from('libro_coach').insert({
    coach_id: c.coach_id, compra_id: c.id, pago_id: pago.id, canal: 'apple', tipo, bruto, monto: parte.monto, aproximado: true, estado: 'en_camino',
    apple_mes: mes?.inicio ?? null, listo_estimado: mes?.pago_estimado ?? null,
  })
  if (e2 && e2.code !== '23505') throw e2
}

async function activa(c: Obj, tx: Obj) {
  const { error } = await bd.from('compras').update({
    estado: 'activa', pagada_en: c.pagada_en ?? ahora(), inicio: c.inicio ?? hoy(), apple_transaccion_original: String(tx.originalTransactionId ?? tx.transactionId),
    apple_transaccion: String(tx.transactionId), periodo_hasta: tx.expiresDate ? new Date(Number(tx.expiresDate)).toISOString() : null, gracia_hasta: null, actualizada_en: ahora(),
  }).eq('id', c.id)
  if (error) throw error
  await anotaPago(c, tx, 'venta')
}

/** Reembolso de Apple: se cierra la compra y se le quita al coach (si no lo había retirado, su renglón queda anulado; si sí, se descuenta del siguiente dinero). */
async function reembolsa(c: Obj, tx: Obj) {
  const { data: pago } = await bd.from('pagos').select('id').eq('apple_transaccion', String(tx.transactionId)).maybeSingle()
  if (pago) {
    await bd.from('pagos').update({ estado: 'reembolsado' }).eq('id', pago.id)
    const { data: r } = await bd.from('libro_coach').select('*').eq('pago_id', pago.id).in('tipo', ['venta', 'renovacion']).maybeSingle()
    if (r && r.estado !== 'anulado') {
      if (r.estado !== 'retirado') await bd.from('libro_coach').update({ estado: 'anulado' }).eq('id', r.id)
      else {
        const { error } = await bd.from('libro_coach').insert({ coach_id: r.coach_id, compra_id: r.compra_id, pago_id: pago.id, canal: 'apple', tipo: 'reembolso', bruto: 0, monto: -Number(r.monto), aproximado: r.aproximado, estado: 'listo', listo_en: ahora() })
        if (error && error.code !== '23505') throw error
      }
    }
  }
  if (c.atleta_id) await bd.from('compras').update({ estado: 'reembolsada', actualizada_en: ahora() }).eq('id', c.id)
}

async function compraDeTransaccion(tx: Obj): Promise<Obj | null> {
  const ref = tx?.advancedCommerceInfo?.requestReferenceId
  if (ref) {
    const { data } = await bd.from('compras').select('*').eq('apple_referencia', ref).maybeSingle()
    if (data) return data
  }
  const original = tx?.originalTransactionId ? String(tx.originalTransactionId) : null
  if (!original) return null
  const { data } = await bd.from('compras').select('*').eq('apple_transaccion_original', original).maybeSingle()
  return data ?? null
}

/* ---------- Avisos de Apple ---------- */
async function atiendeAviso(signedPayload: string): Promise<Response> {
  const aviso = cargaDeJws(signedPayload)
  if (!aviso?.notificationUUID || !aviso?.notificationType) return new Response('Aviso inválido', { status: 400 })
  if (aviso.data?.bundleId && aviso.data.bundleId !== BUNDLE) return new Response('ok')
  const { error: errAnota } = await bd.from('apple_avisos').insert({ id: aviso.notificationUUID, tipo: aviso.notificationType, subtipo: aviso.subtype ?? null })
  if (errAnota) {
    if (errAnota.code !== '23505') return new Response('No se pudo anotar', { status: 500 })
    const { data: previo } = await bd.from('apple_avisos').select('pendiente').eq('id', aviso.notificationUUID).maybeSingle()
    if (previo && !previo.pendiente) return new Response('Ya atendido')
  }
  try {
    const accion = accionDeAviso(aviso.notificationType, aviso.subtype)
    const firmada = cargaDeJws(aviso.data?.signedTransactionInfo)
    if (accion && firmada?.transactionId) {
      // Nunca se le cree al aviso tal cual: la transacción se vuelve a pedir a Apple.
      const tx = await transaccionDeApple(String(firmada.transactionId))
      const c = tx ? await compraDeTransaccion(tx) : null
      if (tx && c && !problemaDeTransaccion(tx, { bundle: BUNDLE, atletaId: c.atleta_id, referencia: null })) {
        if (accion === 'activar' && c.estado !== 'activa') await activa(c, tx)
        else if (accion === 'renovar') {
          await bd.from('compras').update({ estado: 'activa', periodo_hasta: tx.expiresDate ? new Date(Number(tx.expiresDate)).toISOString() : c.periodo_hasta, gracia_hasta: null, apple_transaccion: String(tx.transactionId), actualizada_en: ahora() }).eq('id', c.id)
          await anotaPago(c, tx, 'renovacion')
        } else if (accion === 'cancelo') await bd.from('compras').update({ cancelada_en: c.cancelada_en ?? ahora(), actualizada_en: ahora() }).eq('id', c.id)
        else if (accion === 'reactivo') await bd.from('compras').update({ cancelada_en: null, actualizada_en: ahora() }).eq('id', c.id)
        else if (accion === 'gracia' && ['activa', 'gracia'].includes(c.estado)) await bd.from('compras').update({ estado: 'gracia', gracia_hasta: c.gracia_hasta ?? new Date(Date.now() + 3 * 86400e3).toISOString(), actualizada_en: ahora() }).eq('id', c.id)
        else if (accion === 'vencer' && c.atleta_id && c.estado !== 'reembolsada') await bd.from('compras').update({ estado: 'vencida', actualizada_en: ahora() }).eq('id', c.id)
        else if (accion === 'reembolsar') await reembolsa(c, tx)
      } else console.error('apple: aviso sin compra conocida', aviso.notificationType, firmada.transactionId)
    }
    await bd.from('apple_avisos').update({ pendiente: false }).eq('id', aviso.notificationUUID)
    return new Response('ok')
  } catch (e) {
    console.error('apple: falló el aviso', aviso.notificationType, e instanceof Error ? e.message : e)
    await bd.from('apple_avisos').update({ pendiente: true }).eq('id', aviso.notificationUUID)
    return new Response('Error', { status: 500 }) // Apple reintenta
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  let p: Obj
  try { p = await req.json() } catch { return json({ error: 'Datos inválidos.' }, 400) }
  if (!listo()) return json({ error: 'La compra con Apple todavía no está disponible.', codigo: 'no_disponible' }, 503)
  if (typeof p?.signedPayload === 'string') return await atiendeAviso(p.signedPayload)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  const { data: sesion } = token ? await bd.auth.getUser(token) : { data: null }
  const uid = sesion?.user?.id
  if (!uid) return json({ error: 'Vuelve a entrar a tu cuenta.' }, 401)
  const { data: yo } = await bd.from('profiles').select('role, is_active, full_name').eq('id', uid).maybeSingle()
  if (!yo || yo.is_active === false) return json({ error: 'Tu cuenta no puede comprar.' }, 403)

  try {
    if (p.accion === 'firmar') {
      if (!(await compraAppleAbierta())) return json({ error: 'La compra no está disponible.', codigo: 'cerrada' }, 503)
      if (yo.role !== 'user') return json({ error: 'Para comprar necesitas una cuenta de atleta.' }, 403)
      const usuario = String(p.usuario ?? '').toLowerCase().trim()
      const slug = String(p.slug ?? '').toLowerCase().trim()
      const { data: coach } = await bd.from('profiles').select('id, full_name, is_active, vitrina_suspendida').eq('username', usuario).eq('role', 'admin').maybeSingle()
      if (!coach || coach.is_active === false || coach.vitrina_suspendida) return json({ error: 'Este plan ya no está disponible.' }, 404)
      const { data: plan } = await bd.from('vitrina_planes').select('id, titulo, tipo, precio_mxn, version_n').eq('coach_id', coach.id).eq('slug', slug).eq('estado', 'publicado').maybeSingle()
      if (!plan || plan.tipo === 'personalizado') return json({ error: 'Este plan ya no está disponible.' }, 404)
      const producto = PRODUCTO[plan.tipo as 'pago_unico' | 'membresia']
      if (!producto) return json({ error: 'La compra con Apple todavía no está disponible.', codigo: 'no_disponible' }, 503)
      const { data: ya } = await bd.from('compras').select('id').eq('atleta_id', uid).eq('vitrina_plan_id', plan.id).in('estado', ['activa', 'gracia', 'por_armar']).limit(1)
      if (ya?.length) return json({ error: 'Ya tienes este plan.' }, 409)
      const referencia = crypto.randomUUID()
      const { data: compra, error } = await bd.from('compras').insert({
        vitrina_plan_id: plan.id, atleta_id: uid, coach_id: coach.id, tipo: plan.tipo, estado: 'pendiente', precio_mxn: plan.precio_mxn, version_n: plan.version_n,
        canal: 'apple', apple_referencia: referencia,
      }).select('id').single()
      if (error) throw error
      const peticion = peticionDeCompra({ tipo: plan.tipo, planId: plan.id, titulo: plan.titulo, coach: coach.full_name, precio: plan.precio_mxn, referencia })
      const jws = await firma(claimsDeCompra({ emisor: EMISOR, bundle: BUNDLE, peticion, nonce: crypto.randomUUID() }))
      return json({ compra_id: compra.id, producto, datos: datosParaStoreKit(jws), cuenta: uid })
    }

    if (p.accion === 'restaurar') {
      const ids = (Array.isArray(p.transacciones) ? p.transacciones : []).map(String).filter((x: string) => /^\d{1,25}$/.test(x)).slice(0, 20)
      let restauradas = 0
      for (const id of ids) {
        const tx = await transaccionDeApple(id)
        const c = tx ? await compraDeTransaccion(tx) : null
        if (!tx || !c || c.atleta_id !== uid || problemaDeTransaccion(tx, { bundle: BUNDLE, atletaId: uid, referencia: null })) continue
        const vigente = !tx.expiresDate || Number(tx.expiresDate) > Date.now()
        if (c.estado === 'pendiente' && vigente) { await activa(c, tx); restauradas += 1; continue }
        if (c.estado === 'reembolsada') continue
        await bd.from('compras').update({
          estado: vigente ? (c.estado === 'gracia' ? 'gracia' : 'activa') : 'vencida', apple_transaccion: String(tx.transactionId),
          periodo_hasta: tx.expiresDate ? new Date(Number(tx.expiresDate)).toISOString() : c.periodo_hasta, actualizada_en: ahora(),
        }).eq('id', c.id)
        restauradas += 1
      }
      return json({ ok: true, restauradas })
    }

    if (p.accion === 'confirmar') {
      const { data: c } = await bd.from('compras').select('*').eq('id', String(p.compra_id ?? '')).eq('atleta_id', uid).eq('canal', 'apple').maybeSingle()
      if (!c) return json({ error: 'No encontramos esta compra.' }, 404)
      if (c.estado === 'activa') return json({ ok: true, compra_id: c.id })
      const tx = await transaccionDeApple(String(p.transaccion ?? ''))
      const problema = problemaDeTransaccion(tx, { bundle: BUNDLE, atletaId: uid, referencia: c.apple_referencia })
      if (problema) return json({ error: 'Apple no confirmó esta compra.', codigo: problema }, 400)
      await activa(c, tx)
      return json({ ok: true, compra_id: c.id })
    }
    return json({ error: 'Acción desconocida' }, 400)
  } catch (e) {
    console.error('apple falló:', e instanceof Error ? e.message : e)
    return json({ error: 'No se pudo completar la compra. Inténtalo otra vez.' }, 500)
  }
})
