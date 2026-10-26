import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Poner o cambiar el correo de la propia cuenta, comprobándolo con un código de 6 dígitos (15 oct 2026).
 *
 * POR QUÉ EXISTE. 16 de 24 cuentas se crearon sin correo (tienen uno inventado que nadie recibe) y así no pueden
 * usar «¿Olvidaste tu contraseña?». La forma de fábrica de Supabase (`updateUser({ email })`) pide confirmar también
 * desde el correo VIEJO, y el inventado no lo recibe nadie: esas cuentas se quedarían atoradas. Aquí se confirma solo
 * el correo NUEVO, con un código, y se pide la contraseña actual (si la cuenta tiene una) para que una sesión robada
 * no baste para cambiarlo.
 *
 *   { accion: 'pedir', correo, contrasena? }  → manda el código al correo nuevo (vale 15 minutos, 5 intentos).
 *   { accion: 'confirmar', codigo }           → si coincide, el correo queda puesto.
 *
 * El código no se guarda: se guarda su huella (SHA-256), en `codigos_de_correo`, que solo ve esta función.
 *
 * CORREO SALIENTE: hoy por la API de Resend (la llave en el secreto `RESEND_API_KEY`, o `SMTP_PASSWORD`, que es la misma).
 * Para cambiar de proveedor (Amazon SES al crecer) se cambia SOLO `enviarCorreo`. Ver docs/correos.md.
 */

const DEFAULT_ORIGINS = [
  'http://localhost:5173', 'capacitor://localhost' /* app de iPhone (Capacitor) */,
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'https://app.traininglabapp.com',
]

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

function corsHeaders(origin: string | null): Record<string, string> {
  let allow = DEFAULT_ORIGINS[0]
  if (origin) {
    try {
      if (ORIGENES_PROPIOS.has(origin)) allow = origin
    } catch { /* origen malformado */ }
  }
  return {
    'Access-Control-Allow-Origin': allow,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...corsHeaders(origin) } })
}

// Los dominios de los correos inventados (sin buzón). Igual que `src/lib/correos.js`.
const DOMINIOS_SIN_BUZON = ['sin-correo.traininglabapp.com', 'traininglab.app']
const esInventado = (c: string) => {
  const d = c.slice(c.lastIndexOf('@') + 1).toLowerCase()
  return DOMINIOS_SIN_BUZON.some((x) => d === x || d.endsWith(`.${x}`))
}
const CORREO_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
const VIGENCIA_MIN = 15
const MAX_INTENTOS = 5
const ESPERA_SEG = 60

async function huella(texto: string): Promise<string> {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(texto))
  return Array.from(new Uint8Array(bytes), (b) => b.toString(16).padStart(2, '0')).join('')
}

function codigoAlAzar(): string {
  return String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
}

/** El único lugar que sabe CÓMO sale un correo. Cambiar de proveedor = cambiar esto. */
async function enviarCorreo({ para, asunto, html, texto }: { para: string; asunto: string; html: string; texto: string }) {
  const llave = (Deno.env.get('RESEND_API_KEY') ?? Deno.env.get('SMTP_PASSWORD') ?? '').trim()
  if (!llave) throw new Error('SIN_CONFIGURAR')
  const remitente = (Deno.env.get('CORREO_REMITENTE') ?? 'Training Lab <no-reply@traininglabapp.com>').trim()
  const r = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${llave}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: remitente, to: [para], subject: asunto, html, text: texto }),
    signal: AbortSignal.timeout(10_000),
  })
  if (!r.ok) throw new Error(`ENVIO_${r.status}: ${(await r.text()).slice(0, 200)}`)
}

const correoDelCodigo = (codigo: string) => ({
  asunto: `Tu código de Training Lab: ${codigo}`,
  texto: `Tu código para confirmar este correo en Training Lab es ${codigo}. Vence en ${VIGENCIA_MIN} minutos. Si no lo pediste, ignora este correo.`,
  html: `<!doctype html><html><body style="margin:0;background:#f4f5f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111318">
  <div style="max-width:440px;margin:0 auto;padding:32px 20px">
    <div style="background:#ffffff;border-radius:20px;padding:32px 28px;border:1px solid #e6e8ee">
      <div style="font-size:22px;font-weight:800;letter-spacing:-0.4px">Training <span style="color:#1E40E0">Lab</span></div>
      <p style="font-size:15px;line-height:1.5;color:#3d4250;margin:20px 0 8px">Tu código para confirmar este correo:</p>
      <div style="font-size:36px;font-weight:800;letter-spacing:8px;margin:6px 0 18px">${codigo}</div>
      <p style="font-size:13.5px;line-height:1.5;color:#6b7080;margin:0">Vence en ${VIGENCIA_MIN} minutos. Si no lo pediste, ignora este correo: nadie puede usarlo sin entrar a tu cuenta.</p>
    </div>
  </div></body></html>`,
})

/* Comprobar la contraseña con /auth/v1/token ABRE una sesión de verdad que nadie cerraba (auditoría p134: 384 sesiones acumuladas).
   Se cierra enseguida, SOLO esa (`scope=local`: no toca las demás sesiones de la persona). Si no se puede cerrar, no es motivo para fallar. */
async function cierraLaSesionDeLaPrueba(urlSb: string, prueba: Response) {
  try {
    const t = (await prueba.clone().json())?.access_token
    if (typeof t !== 'string' || !t) return
    await fetch(`${urlSb}/auth/v1/logout?scope=local`, {
      method: 'POST',
      headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '', Authorization: `Bearer ${t}` },
      signal: AbortSignal.timeout(5_000),
    })
  } catch { /* se queda como estaba */ }
}

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origin)

  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim()
  if (!token) return json({ error: 'Falta tu sesión. Vuelve a entrar.' }, 401, origin)

  const URL_SB = Deno.env.get('SUPABASE_URL')!
  const admin = createClient(URL_SB, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { autoRefreshToken: false, persistSession: false } })
  const { data: sesion, error: errSesion } = await admin.auth.getUser(token)
  const usuario = sesion?.user
  if (errSesion || !usuario) return json({ error: 'Tu sesión expiró. Vuelve a entrar.' }, 401, origin)

  let p: { accion?: string; correo?: string; contrasena?: string; codigo?: string }
  try { p = await req.json() } catch { return json({ error: 'JSON inválido' }, 400, origin) }

  const proveedores: string[] = (usuario.app_metadata?.providers as string[] | undefined) ?? ['email']
  const tieneContrasena = proveedores.includes('email')
  const actual = String(usuario.email ?? '').toLowerCase()

  if (p.accion === 'pedir') {
    if (!tieneContrasena) return json({ error: 'Tu correo es el de tu cuenta de Google. Para cambiarlo, cámbialo en Google.' }, 400, origin)
    const correo = String(p.correo ?? '').trim().toLowerCase()
    if (!CORREO_RE.test(correo)) return json({ error: 'Escribe tu correo completo, por ejemplo nombre@gmail.com.' }, 400, origin)
    if (esInventado(correo)) return json({ error: 'Ese correo no se puede usar. Escribe uno que sí revises.' }, 400, origin)
    if (correo === actual) return json({ error: 'Ese ya es el correo de tu cuenta.' }, 400, origin)

    // La contraseña actual: así una sesión olvidada abierta en otro teléfono no basta para quedarse con la cuenta.
    const contrasena = String(p.contrasena ?? '')
    if (!contrasena) return json({ error: 'Escribe tu contraseña actual.', codigo: 'FALTA_CONTRASENA' }, 400, origin)
    const prueba = await fetch(`${URL_SB}/auth/v1/token?grant_type=password`, {
      method: 'POST',
      headers: { apikey: Deno.env.get('SUPABASE_ANON_KEY') ?? '', 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: actual, password: contrasena }),
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null)
    if (!prueba) return json({ error: 'No se pudo comprobar tu contraseña. Inténtalo de nuevo.' }, 502, origin)
    if (prueba.status === 429) return json({ error: 'Demasiados intentos. Espera un momento.' }, 429, origin)
    if (!prueba.ok) return json({ error: 'La contraseña actual no es correcta.', codigo: 'CONTRASENA_MAL' }, 400, origin)
    await cierraLaSesionDeLaPrueba(URL_SB, prueba)

    const { data: ocupado } = await admin.rpc('usuario_por_correo', { p_correo: correo })
    if (Array.isArray(ocupado) && ocupado.length && ocupado[0].id !== usuario.id) {
      return json({ error: 'Ese correo ya lo usa otra cuenta.' }, 409, origin)
    }

    const { data: previo } = await admin.from('codigos_de_correo').select('creado_en').eq('user_id', usuario.id).maybeSingle()
    if (previo && Date.now() - new Date(previo.creado_en).getTime() < ESPERA_SEG * 1000) {
      return json({ error: 'Ya te mandamos un código hace poco. Espera un minuto para pedir otro.' }, 429, origin)
    }

    const codigo = codigoAlAzar()
    const { error: errGuarda } = await admin.from('codigos_de_correo').upsert({
      user_id: usuario.id, correo, codigo_hash: await huella(`${usuario.id}:${codigo}`),
      expira_en: new Date(Date.now() + VIGENCIA_MIN * 60_000).toISOString(), intentos: 0, creado_en: new Date().toISOString(),
    })
    if (errGuarda) return json({ error: 'No se pudo preparar el código. Inténtalo de nuevo.' }, 500, origin)

    try {
      await enviarCorreo({ para: correo, ...correoDelCodigo(codigo) })
    } catch (e) {
      await admin.from('codigos_de_correo').delete().eq('user_id', usuario.id)
      const msg = e instanceof Error ? e.message : String(e)
      console.error('enviarCorreo falló:', msg)
      if (msg === 'SIN_CONFIGURAR') return json({ error: 'El envío de correos todavía no está configurado. Avísale al administrador.' }, 503, origin)
      return json({ error: 'No se pudo mandar el correo. Revisa que esté bien escrito e inténtalo de nuevo.' }, 502, origin)
    }
    return json({ ok: true, correo }, 200, origin)
  }

  if (p.accion === 'confirmar') {
    const codigo = String(p.codigo ?? '').replace(/\D/g, '')
    if (codigo.length !== 6) return json({ error: 'El código tiene 6 números.' }, 400, origin)
    const { data: fila } = await admin.from('codigos_de_correo').select('*').eq('user_id', usuario.id).maybeSingle()
    if (!fila || new Date(fila.expira_en).getTime() < Date.now()) {
      if (fila) await admin.from('codigos_de_correo').delete().eq('user_id', usuario.id)
      return json({ error: 'El código ya venció. Pide otro.', codigo: 'VENCIDO' }, 400, origin)
    }
    if (fila.intentos >= MAX_INTENTOS) {
      await admin.from('codigos_de_correo').delete().eq('user_id', usuario.id)
      return json({ error: 'Demasiados intentos. Pide otro código.', codigo: 'VENCIDO' }, 400, origin)
    }
    if (await huella(`${usuario.id}:${codigo}`) !== fila.codigo_hash) {
      await admin.from('codigos_de_correo').update({ intentos: fila.intentos + 1 }).eq('user_id', usuario.id)
      const quedan = MAX_INTENTOS - fila.intentos - 1
      return json({ error: quedan > 0 ? `Código incorrecto. Te quedan ${quedan} intento${quedan === 1 ? '' : 's'}.` : 'Código incorrecto. Pide otro.' }, 400, origin)
    }

    // Por si otra cuenta lo tomó mientras tanto.
    const { data: ocupado } = await admin.rpc('usuario_por_correo', { p_correo: fila.correo })
    if (Array.isArray(ocupado) && ocupado.length && ocupado[0].id !== usuario.id) {
      await admin.from('codigos_de_correo').delete().eq('user_id', usuario.id)
      return json({ error: 'Ese correo ya lo usa otra cuenta.' }, 409, origin)
    }

    const { error: errAuth } = await admin.auth.admin.updateUserById(usuario.id, { email: fila.correo, email_confirm: true })
    if (errAuth) {
      console.error('updateUserById falló:', errAuth.message)
      return json({ error: 'No se pudo guardar el correo. Inténtalo de nuevo.' }, 500, origin)
    }
    await admin.from('profiles').update({ email: fila.correo }).eq('id', usuario.id)
    await admin.from('codigos_de_correo').delete().eq('user_id', usuario.id)
    return json({ ok: true, correo: fila.correo }, 200, origin)
  }

  return json({ error: 'Acción desconocida' }, 400, origin)
})
