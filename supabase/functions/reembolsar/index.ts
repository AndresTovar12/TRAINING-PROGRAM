/**
 * SIN REEMBOLSOS (Andrés, 26 oct 2026, como OnlyFans). Antes había una garantía de 7 días de la primera compra; se quitó porque dejaba ver el plan gratis
 * (comprar, reembolsar, recomprar entrando por otra semana). Al cancelar, el plan sigue hasta el fin del mes pagado. Un error real de cobro lo devuelve el dueño
 * desde Stripe: el aviso `charge.refunded` cierra la compra y le quita al coach lo suyo (`stripe-webhook`).
 *
 * La función se queda publicada solo para contestar eso a una app vieja que todavía la llame: ya no toca Stripe.
 */
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

Deno.serve((req) => {
  const origen = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabeceras(origen) })
  return json({
    error: 'Las compras no tienen reembolso. Si cancelas, sigues con tu plan hasta el fin del mes que pagaste. Si hubo un error en tu cobro, escríbenos a contacto@traininglabapp.com.',
    codigo: 'SIN_REEMBOLSOS',
  }, 410, origen)
})
