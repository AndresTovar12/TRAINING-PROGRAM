/* Prueba de los correos de compras del webhook de Stripe (A de Andrés, 26 oct 2026), con base y Stripe/Resend falsos:
   `deno run --allow-all --import-map=scripts/prueba-mi-cuenta.importmap.json scripts/prueba-correos-de-compra.ts`.
   Cobro fallido: UN correo, al primer fallo. Cada pago: su recibo. Respeta «Avisos» y no manda a correos inventados. Un correo que falla no tumba el aviso de Stripe. */
// deno-lint-ignore-file no-explicit-any
import { strict as assert } from 'node:assert'

Deno.env.set('SUPABASE_URL', 'http://fake.supabase')
Deno.env.set('SUPABASE_SERVICE_ROLE_KEY', 'service')
Deno.env.set('STRIPE_SECRET_KEY', 'sk_test_falsa')
Deno.env.set('STRIPE_WEBHOOK_SECRET', 'whsec_falso')
Deno.env.set('RESEND_API_KEY', 're_falsa')

let manejador: (req: Request) => Promise<Response> = async () => new Response('x')
;(Deno as any).serve = (fn: any) => { manejador = fn; return {} }

const correos: any[] = []
let resendFalla = false
globalThis.fetch = (async (url: any, init: any = {}) => {
  const u = String(url)
  if (u.startsWith('https://api.resend.com')) {
    if (resendFalla) return new Response('boom', { status: 500 })
    correos.push(JSON.parse(String(init.body)))
    return new Response('{"id":"x"}', { status: 200 })
  }
  if (u.startsWith('https://api.stripe.com')) return new Response(JSON.stringify({ id: 'x', latest_charge: 'ch_1', charge: 'ch_1' }), { status: 200 })
  return new Response('{}', { status: 200 })
}) as any

await import('../supabase/functions/stripe-webhook/index.ts')

const hex = (b: ArrayBuffer) => [...new Uint8Array(b)].map((x) => x.toString(16).padStart(2, '0')).join('')
async function manda(evento: any) {
  const cuerpo = JSON.stringify(evento)
  const t = Math.floor(Date.now() / 1000)
  const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode('whsec_falso'), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const firma = hex(await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(`${t}.${cuerpo}`)))
  const r = await manejador(new Request('http://x/stripe-webhook', { method: 'POST', headers: { 'stripe-signature': `t=${t},v1=${firma}` }, body: cuerpo }))
  return r.status
}

let n = 0
function mundo(extra: Record<string, any> = {}, correo = 'ana@gmail.com') {
  ;(globalThis as any).__bd = {
    registro: [], usuarios: {}, correos: { a1: correo },
    tablas: {
      stripe_eventos: [],
      compras: [{ id: 'c1', atleta_id: 'a1', coach_id: 'coach1', vitrina_plan_id: 'vp1', estado: 'activa', stripe_subscription_id: 'sub_1', inicio: '2026-10-01' }],
      vitrina_planes: [{ id: 'vp1', titulo: 'Plan de fuerza' }],
      profiles: [{ id: 'coach1', is_owner: true }],
      pagos: [], cuentas_stripe: [], preferencias_de_avisos: [],
      ...extra,
    },
  }
  correos.length = 0
}
const fallo = (id: string) => ({ id, type: 'invoice.payment_failed', data: { object: { id: 'in_1', subscription: 'sub_1', subscription_details: { metadata: { compra_id: 'c1' } } } } })
const pagado = (id: string, motivo: string) => ({ id, type: 'invoice.paid', data: { object: { id: 'in_2', subscription: 'sub_1', customer: 'cus_1', charge: 'ch_1', amount_paid: 50000, billing_reason: motivo, subscription_details: { metadata: { compra_id: 'c1' } }, lines: { data: [{ period: { end: 1795000000 } }] } } } })

/* 1) Cobro fallido: un correo al primer fallo, ninguno en los reintentos. */
mundo()
assert.equal(await manda(fallo('evt_1')), 200)
assert.equal(correos.length, 1, 'un correo por el primer fallo')
assert.deepEqual(correos[0].to, ['ana@gmail.com'])
assert.match(correos[0].subject, /No pudimos cobrar tu renovación de Plan de fuerza/)
assert.match(correos[0].html, /Mi perfil → Avisos/, 'dice cómo apagarlos')
assert.equal((globalThis as any).__bd.tablas.compras[0].estado, 'gracia')
assert.equal(await manda(fallo('evt_2')), 200)
assert.equal(correos.length, 1, 'el reintento de Stripe NO manda otro correo')
n += 1; console.log('OK    cobro fallido: un solo correo, al primer fallo')

/* 2) Cada pago, su recibo (primera vez y renovación). */
mundo()
assert.equal(await manda(pagado('evt_3', 'subscription_create')), 200)
assert.equal(correos.length, 1); assert.match(correos[0].subject, /^Recibo de Plan de fuerza/); assert.match(correos[0].html, /\$500\.00 MXN/)
mundo()
assert.equal(await manda(pagado('evt_4', 'subscription_cycle')), 200)
assert.match(correos[0].subject, /^Renovamos Plan de fuerza/); assert.match(correos[0].html, /Queda pagado hasta/)
n += 1; console.log('OK    recibo de la compra y de cada renovación')

/* 3) Respeta «Avisos»: compras apagado, o por correo apagado, no manda. Sin fila guardada, sí. */
mundo({ preferencias_de_avisos: [{ user_id: 'a1', compras: false, por_correo: true }] })
await manda(fallo('evt_5')); assert.equal(correos.length, 0, 'compras apagado: nada')
mundo({ preferencias_de_avisos: [{ user_id: 'a1', compras: true, por_correo: false }] })
await manda(pagado('evt_6', 'subscription_cycle')); assert.equal(correos.length, 0, 'por correo apagado: nada')
mundo({ preferencias_de_avisos: [{ user_id: 'a1', compras: true, por_correo: true }] })
await manda(pagado('evt_7', 'subscription_cycle')); assert.equal(correos.length, 1, 'encendido: sí')
n += 1; console.log('OK    respeta los interruptores de Avisos')

/* 4) A un correo inventado no se manda; sin llave de Resend tampoco; si Resend falla, el aviso de Stripe sigue en 200. */
mundo({}, 'ana@sin-correo.traininglabapp.com')
await manda(fallo('evt_8')); assert.equal(correos.length, 0, 'correo inventado: nada')
mundo(); resendFalla = true
assert.equal(await manda(fallo('evt_9')), 200, 'si el correo falla, Stripe recibe 200 igual')
assert.equal((globalThis as any).__bd.tablas.compras[0].estado, 'gracia', 'y la compra se actualizó')
resendFalla = false
n += 1; console.log('OK    sin correo real o con Resend caído, nada se rompe')

console.log(`\n${n} pruebas bien.`)
