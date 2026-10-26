/**
 * La página «Listo» de una compra: le dice a quien acaba de pagar cómo va su compra y, si compró SIN cuenta, le deja poner su contraseña.
 *
 * POR QUÉ EXISTE. Quien compra sin cuenta paga con solo su correo; su cuenta la crea `stripe-webhook` cuando el pago se confirma, con una contraseña al azar que nadie conoce. Esta función
 * es el único camino para cambiarla por la suya, y solo se abre con la «llave» de ese pago: el id de la sesión de Stripe que viene en la liga a la que Stripe lo regresa (`/compra/lista?c=cs_…`).
 * Ese id no se puede adivinar (son decenas de caracteres al azar) y solo lo tiene quien pagó.
 *
 * Reglas para poner la contraseña (todas juntas; si falta una, no se puede):
 *   · la compra la creó sin cuenta (`cuenta_nueva`) y ya está pagada (activa o en gracia),
 *   · esa persona todavía no puso la suya (`acceso_listo_en` vacío) y la cuenta nunca ha entrado (`last_sign_in_at` vacío),
 *   · pasaron menos de 48 horas desde la compra.
 * Se puede una sola vez. Con una cuenta que ya existía (alguien que compró con su cuenta, o cuyo correo ya la tenía) esta función NUNCA toca su contraseña ni le abre sesión: solo informa.
 *
 * Contesta `{ estado, titulo, coach, correo, puede_poner_contrasena, cuenta_existente }`. Sin la llave de ningún pago no dice nada de nadie.
 */
import { createClient } from 'jsr:@supabase/supabase-js@2'

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
const SESION_RE = /^cs_(test|live)_[A-Za-z0-9]{8,200}$/
const VENTANA_MS = 48 * 3600 * 1000

const permitido = (origen: string | null) => {
  if (!origen) return SITIO
  return ORIGENES_PROPIOS.has(origen) ? origen : SITIO
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

/** Lo que hace falta para aceptar una contraseña (la app dice lo mismo, con más detalle, en `lib/contrasena.js`). */
function problemaDeContrasena(c: string, correo: string): string | null {
  if (c.length < 8) return 'Usa al menos 8 caracteres.'
  if (c.length > 72) return 'Usa un máximo de 72 caracteres.'
  if (/^\d+$/.test(c)) return 'No puede ser solo números.'
  if (/^(.)\1+$/.test(c)) return 'No puede ser el mismo carácter repetido.'
  if (correo && c.toLowerCase() === correo.toLowerCase()) return 'No uses tu correo como contraseña.'
  return null
}

Deno.serve(async (req) => {
  const origen = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cabeceras(origen) })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origen)

  let p: { sesion?: string; contrasena?: string }
  try { p = await req.json() } catch { return json({ error: 'Datos inválidos.' }, 400, origen) }
  const sesion = String(p.sesion ?? '').trim()
  if (!SESION_RE.test(sesion)) return json({ estado: 'desconocida' }, 404, origen)

  const bd = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
  try {
    const { data: c } = await bd.from('compras')
      .select('id, estado, atleta_id, coach_id, vitrina_plan_id, correo_comprador, cuenta_nueva, acceso_listo_en, creada_en')
      .eq('stripe_checkout_session_id', sesion).maybeSingle()
    if (!c) return json({ estado: 'desconocida' }, 404, origen)

    const [{ data: plan }, { data: coach }] = await Promise.all([
      bd.from('vitrina_planes').select('titulo').eq('id', c.vitrina_plan_id).maybeSingle(),
      c.coach_id ? bd.from('profiles').select('username, full_name').eq('id', c.coach_id).maybeSingle() : Promise.resolve({ data: null }),
    ])
    let correo: string | null = c.correo_comprador ?? null
    let ultimaEntrada: string | null = null
    if (c.atleta_id) {
      const { data: u } = await bd.auth.admin.getUserById(c.atleta_id)
      correo = u?.user?.email ?? correo
      ultimaEntrada = u?.user?.last_sign_in_at ?? null
    }

    const pagada = c.estado === 'activa' || c.estado === 'gracia'
    const dentroDeLaVentana = Date.now() - new Date(c.creada_en).getTime() < VENTANA_MS
    const puede = !!c.atleta_id && c.cuenta_nueva === true && !c.acceso_listo_en && pagada && dentroDeLaVentana && !ultimaEntrada

    if (p.contrasena !== undefined) {
      if (!puede) return json({ error: 'Esta liga ya se usó o venció. Entra con tu correo y tu contraseña.', codigo: 'ya_usada' }, 403, origen)
      const problema = problemaDeContrasena(String(p.contrasena), correo ?? '')
      if (problema) return json({ error: problema, codigo: 'contrasena_floja' }, 400, origen)
      // Primero se marca (una sola vez, aunque lleguen dos intentos a la vez), después se cambia la contraseña.
      const { data: marcada } = await bd.from('compras').update({ acceso_listo_en: new Date().toISOString() }).eq('id', c.id).is('acceso_listo_en', null).select('id')
      if (!marcada?.length) return json({ error: 'Esta liga ya se usó. Entra con tu correo y tu contraseña.', codigo: 'ya_usada' }, 403, origen)
      const { error } = await bd.auth.admin.updateUserById(c.atleta_id!, { password: String(p.contrasena) })
      if (error) {
        await bd.from('compras').update({ acceso_listo_en: null }).eq('id', c.id) // no se pudo: que vuelva a intentarlo
        return json({ error: 'No se pudo guardar tu contraseña. Inténtalo otra vez.' }, 500, origen)
      }
      return json({ ok: true, correo }, 200, origen)
    }

    return json({
      estado: c.estado,
      titulo: plan?.titulo ?? 'Tu plan',
      coach: coach ? { usuario: coach.username, nombre: coach.full_name } : null,
      correo,
      puede_poner_contrasena: puede,
      cuenta_existente: !!c.atleta_id && !c.cuenta_nueva,
    }, 200, origen)
  } catch (e) {
    return json({ error: e instanceof Error ? e.message : 'No se pudo leer tu compra.' }, 500, origen)
  }
})
