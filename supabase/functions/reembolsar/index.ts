/**
 * El atleta pide que le devuelvan su dinero: la garantía de 7 días de la PRIMERA compra (Andrés, 11 oct 2026). Después de 7 días no hay reembolso: al cancelar, el plan sigue hasta
 * el fin del mes pagado.
 *
 * Devuelve el primer cobro de esa compra y cancela la suscripción; el aviso `charge.refunded` de Stripe cierra la compra y le quita al coach lo que se le había mandado
 * (`stripe-webhook`). Sin las llaves de Stripe contesta que aún no está disponible.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'
import { llamaStripe } from './stripe.js'

const DIAS_DE_GARANTIA = 7
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
const cabeceras = (origen: string | null): Record<string, string> => ({
  'Access-Control-Allow-Origin': permitido(origen), 'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Max-Age': '86400', Vary: 'Origin',
})
const json = (cuerpo: unknown, estado: number, origen: string | null) =>
  new Response(JSON.stringify(cuerpo), { status: estado, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...cabeceras(origen) } })

Deno.serve(async (req) => {
  const origen = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabeceras(origen) })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origen)

  const clave = (Deno.env.get('STRIPE_SECRET_KEY') ?? '').trim()
  if (!clave) return json({ error: 'Los reembolsos todavía no están disponibles.' }, 503, origen)
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Entra a tu cuenta.' }, 401, origen)
  const bd = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: sesion, error: errSesion } = await bd.auth.getUser(token)
  if (errSesion || !sesion?.user) return json({ error: 'Tu sesión expiró. Vuelve a entrar.' }, 401, origen)

  let p: { compra_id?: string }
  try { p = await req.json() } catch { return json({ error: 'Datos inválidos.' }, 400, origen) }
  if (!p.compra_id) return json({ error: 'Falta la compra.' }, 400, origen)

  try {
    const { data: compra } = await bd.from('compras').select('id, estado, stripe_subscription_id').eq('id', p.compra_id).eq('atleta_id', sesion.user.id).maybeSingle()
    if (!compra) return json({ error: 'No encuentro esa compra.' }, 404, origen)
    if (!['activa', 'gracia'].includes(compra.estado)) return json({ error: 'Esa compra ya no se puede reembolsar.' }, 400, origen)

    const { data: pagos } = await bd.from('pagos').select('id, stripe_charge_id, fecha, estado').eq('compra_id', compra.id).order('fecha', { ascending: true }).limit(1)
    const primero = pagos?.[0]
    if (!primero?.stripe_charge_id) return json({ error: 'Todavía no hay un cobro que devolver.' }, 400, origen)
    if (primero.estado !== 'cobrado') return json({ error: 'Ese cobro ya se devolvió.' }, 400, origen)
    const dias = (Date.now() - new Date(primero.fecha).getTime()) / (24 * 3600 * 1000)
    if (dias > DIAS_DE_GARANTIA) return json({ error: `La garantía es de ${DIAS_DE_GARANTIA} días y ya pasó. Puedes cancelar y el plan sigue hasta el fin del mes pagado.` }, 400, origen)

    await llamaStripe(clave, 'POST', '/v1/refunds', { charge: primero.stripe_charge_id, metadata: { compra_id: compra.id } }, { idempotencia: `reembolso_${compra.id}` })
    if (compra.stripe_subscription_id) {
      try { await llamaStripe(clave, 'DELETE', `/v1/subscriptions/${compra.stripe_subscription_id}`) } catch { /* ya estaba cancelada */ }
    }
    return json({ ok: true }, 200, origen)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'No se pudo hacer el reembolso.' }, 500, origen)
  }
})
