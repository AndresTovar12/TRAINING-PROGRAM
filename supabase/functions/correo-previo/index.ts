import { createClient } from 'jsr:@supabase/supabase-js@2'

/**
 * Comprobar un correo ANTES de que exista la cuenta (inicio nuevo, 31 oct 2026).
 *
 * POR QUÉ EXISTE. Antes la cuenta nacía al pulsar «Mandar código» y el código se comprobaba después, con la cuenta ya creada: de ahí salían las cuentas a
 * medias, la pantalla del código sin salida y la flecha de atrás que no podía regresar. Ahora no hay cuenta hasta que el código es bueno: esta función manda el
 * código y lo comprueba SIN sesión, y con el código bueno entrega una «ficha» de un solo uso. `signup` (o `activar-invitacion`) pide esa ficha para crear la
 * cuenta con ese correo YA confirmado.
 *
 *   { accion: 'pedir', correo, usuario? }  → comprueba que el usuario y el correo estén libres y manda el código (vale 15 minutos, 5 intentos).
 *   { accion: 'confirmar', correo, codigo } → si coincide, devuelve `{ ok: true, ficha }`. La ficha viaja solo de aquí a quien creará la cuenta.
 *
 * SEGURIDAD
 *   · No hay sesión (verify_jwt apagado, porque la persona todavía no tiene cuenta): cada llamada pasa por frenos (IP, correo y espera entre envíos).
 *   · Guarda solo HUELLAS (HMAC-SHA256 con la llave de servicio) del código y de la ficha, nunca el valor. La IP se guarda solo hecha huella.
 *   · La ficha va atada al correo y a quien la recibió: quien no la tiene no puede crear una cuenta con ese correo, aunque se adelante a la persona.
 *   · Un solo uso: `signup` la marca usada al crear la cuenta.
 *   · La tabla `codigos_previos` no la ve nadie desde la app (RLS sin políticas).
 *
 * El correo sale por el mismo lugar que el de `correo-de-la-cuenta`: cambiar de proveedor = cambiar `enviarCorreo` en las dos.
 */

const DEFAULT_ORIGINS = [
  'http://localhost:5173', 'capacitor://localhost' /* app de iPhone (Capacitor) */,
  'http://localhost:4173',
  'http://127.0.0.1:5173',
  'https://app.traininglabapp.com',
]

// Lista cerrada de sitios propios: igual que `correo-de-la-cuenta`.
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
  if (origin && ORIGENES_PROPIOS.has(origin)) allow = origin
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
const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/
// En un patrón de LIKE el «_» vale «cualquier letra» y el «%» «cualquier cosa»: para buscar un usuario EXACTO se escapan. Igual que `src/lib/escapaLike.js`.
const escapaLike = (t: string) => t.replace(/[\\%_]/g, '\\$&')
const VIGENCIA_MIN = 15
const MAX_INTENTOS = 5
const ESPERA_SEG = 60
const TOPE_POR_CORREO_AL_DIA = 8
const TOPE_PEDIR_POR_IP_A_LA_HORA = 20
const TOPE_CONFIRMAR_POR_IP_A_LA_HORA = 60
const MAX_CUERPO = 2048

const LLAVE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const aHex = (b: ArrayBuffer | Uint8Array) => Array.from(new Uint8Array(b), (x) => x.toString(16).padStart(2, '0')).join('')

/** Huella con la llave de servicio: sin ella no se puede calcular, ni siquiera sabiendo el código. */
async function hmac(texto: string): Promise<string> {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(LLAVE), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  return aHex(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(texto)))
}

// Comparación que no se detiene en la primera letra distinta.
function iguales(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let r = 0
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return r === 0
}

const codigoAlAzar = () => String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')

// La IP sale de `cf-connecting-ip`: la pone Cloudflare y el cliente no la puede cambiar (ver `signup`).
function ipDe(req: Request): string {
  const cf = (req.headers.get('cf-connecting-ip') ?? '').trim()
  if (cf) return cf
  return (req.headers.get('x-forwarded-for') ?? '').split(',')[0].trim() || 'sin-ip'
}

/** Un freno que, si el libro de frenos falla, NO deja pasar (a diferencia de `signup`): aquí cada paso manda un correo o prueba un código. */
// deno-lint-ignore no-explicit-any
async function pasaElFreno(bd: any, ambito: string, clave: string, limite: number, segundos: number): Promise<boolean> {
  try {
    const desde = new Date(Date.now() - segundos * 1000).toISOString()
    const { count, error } = await bd.from('frenos_de_uso').select('id', { count: 'exact', head: true }).eq('ambito', ambito).eq('clave', clave).gte('creado_en', desde)
    if (error) { console.error('frenos_de_uso (contar):', error.message); return false }
    if ((count ?? 0) >= limite) return false
    const { error: errInsert } = await bd.from('frenos_de_uso').insert({ ambito, clave })
    if (errInsert) { console.error('frenos_de_uso (anotar):', errInsert.message); return false }
    if (Math.random() < 0.02) await bd.from('frenos_de_uso').delete().lt('creado_en', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    return true
  } catch (e) {
    console.error('frenos_de_uso:', e instanceof Error ? e.message : e)
    return false
  }
}

/** El único lugar que sabe CÓMO sale un correo (el mismo que `correo-de-la-cuenta`). Cambiar de proveedor = cambiar esto. */
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

/* El asunto NO lleva el código y el cuerpo explica quién manda y por qué (ver `correo-de-la-cuenta`). Aquí todavía no hay cuenta: «estás creando tu cuenta». */
const SITIO = 'https://app.traininglabapp.com'
const correoDelCodigo = (codigo: string) => ({
  asunto: 'Confirma tu correo en Training Lab',
  texto: [
    'Hola:',
    '',
    'Estás creando tu cuenta de Training Lab. Para confirmar este correo, escribe este código en la app:',
    '',
    `    ${codigo}`,
    '',
    `El código vence en ${VIGENCIA_MIN} minutos.`,
    '',
    'Si no fuiste tú, ignora este correo: sin el código no se crea ninguna cuenta.',
    '',
    '—',
    `Training Lab · ${SITIO.replace('https://', '')}`,
  ].join('\n'),
  html: `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<style>@font-face{font-family:'Bricolage Grotesque';font-style:normal;font-weight:800;src:url('${SITIO}/fonts/bricolage-latin.woff2') format('woff2');}</style>
</head><body style="margin:0;background:#f4f5f8;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#111318">
  <div style="max-width:460px;margin:0 auto;padding:32px 20px">
    <div style="background:#ffffff;border-radius:20px;padding:32px 28px;border:1px solid #e6e8ee">
      <div style="font-family:'Bricolage Grotesque',-apple-system,Helvetica,Arial,sans-serif;font-size:24px;font-weight:800;letter-spacing:-0.4px">Training <span style="color:#1E40E0">Lab</span></div>
      <p style="font-size:15px;line-height:1.55;color:#3d4250;margin:22px 0 0">Hola:</p>
      <p style="font-size:15px;line-height:1.55;color:#3d4250;margin:10px 0 0">Estás creando tu cuenta de Training Lab. Para confirmar este correo, escribe este código en la app:</p>
      <div style="font-size:36px;font-weight:800;letter-spacing:8px;margin:18px 0 18px;color:#111318">${codigo}</div>
      <p style="font-size:14px;line-height:1.55;color:#3d4250;margin:0">El código vence en ${VIGENCIA_MIN} minutos.</p>
      <p style="font-size:14px;line-height:1.55;color:#6b7080;margin:12px 0 0">Si no fuiste tú, ignora este correo: sin el código no se crea ninguna cuenta.</p>
    </div>
    <p style="font-size:12.5px;line-height:1.5;color:#8a8f9c;text-align:center;margin:18px 0 0">
      Training Lab · <a href="${SITIO}" style="color:#8a8f9c">${SITIO.replace('https://', '')}</a>
    </p>
  </div></body></html>`,
})

Deno.serve(async (req) => {
  const origin = req.headers.get('Origin')
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders(origin) })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405, origin)
  if (!LLAVE) return json({ error: 'No se pudo completar. Inténtalo más tarde.' }, 500, origin)

  const crudo = await req.text().catch(() => '')
  if (crudo.length > MAX_CUERPO) return json({ error: 'Petición demasiado grande' }, 413, origin)
  let p: { accion?: string; correo?: string; usuario?: string; codigo?: string }
  try { p = JSON.parse(crudo) } catch { return json({ error: 'JSON inválido' }, 400, origin) }
  if (!p || typeof p !== 'object') return json({ error: 'JSON inválido' }, 400, origin)

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, LLAVE, { auth: { autoRefreshToken: false, persistSession: false } })
  const huellaIp = (await hmac(`ip:${ipDe(req)}`)).slice(0, 32)
  const correo = String(p.correo ?? '').trim().toLowerCase()

  if (p.accion === 'pedir') {
    if (!(await pasaElFreno(admin, 'previo_ip', huellaIp, TOPE_PEDIR_POR_IP_A_LA_HORA, 3600))) {
      return json({ error: 'Pediste muchos códigos desde esta conexión. Espera un rato e inténtalo de nuevo.', codigo: 'MUCHOS_INTENTOS' }, 429, origin)
    }
    if (correo.length > 120 || !CORREO_RE.test(correo)) return json({ error: 'Escribe tu correo completo, por ejemplo nombre@gmail.com.' }, 400, origin)
    if (esInventado(correo)) return json({ error: 'Ese correo no se puede usar. Escribe uno que sí revises.' }, 400, origin)

    // El usuario (solo cuando se crea una cuenta nueva; con una invitación ya viene reservado y lo revisa `activar-invitacion`).
    const usuario = String(p.usuario ?? '').trim()
    if (usuario) {
      if (!USERNAME_RE.test(usuario) || /^zz_/i.test(usuario)) return json({ error: 'Ese nombre de usuario no está disponible' }, 400, origin)
      const { data: tomado } = await admin.from('profiles').select('id').ilike('username', escapaLike(usuario)).maybeSingle()
      if (tomado) return json({ error: 'Ese usuario ya existe. Escoge otro.', codigo: 'USUARIO_OCUPADO' }, 409, origin)
    }

    // El correo ya es de otra cuenta: se dice AQUÍ, antes de mandar nada.
    const { data: ocupado } = await admin.rpc('usuario_por_correo', { p_correo: correo })
    if (Array.isArray(ocupado) && ocupado.length) {
      return json({ error: 'Ese correo ya lo usa otra cuenta. Escribe otro, o entra con esa cuenta.', codigo: 'CORREO_OCUPADO' }, 409, origin)
    }

    const { data: previo } = await admin.from('codigos_previos').select('creado_en').eq('correo', correo).maybeSingle()
    if (previo) {
      const pasaron = (Date.now() - new Date(previo.creado_en).getTime()) / 1000
      if (pasaron < ESPERA_SEG) {
        return json({ error: 'Ya te mandamos un código hace poco. Espera un minuto para pedir otro.', codigo: 'ESPERA', espera: Math.ceil(ESPERA_SEG - pasaron) }, 429, origin)
      }
    }
    if (!(await pasaElFreno(admin, 'previo_correo', (await hmac(`correo:${correo}`)).slice(0, 32), TOPE_POR_CORREO_AL_DIA, 86400))) {
      return json({ error: 'Ya pediste muchos códigos para este correo hoy. Inténtalo mañana.', codigo: 'MUCHOS_INTENTOS' }, 429, origin)
    }

    const codigo = codigoAlAzar()
    const { error: errGuarda } = await admin.from('codigos_previos').upsert({
      correo, codigo_hash: await hmac(`codigo:${correo}:${codigo}`), expira_en: new Date(Date.now() + VIGENCIA_MIN * 60_000).toISOString(),
      intentos: 0, creado_en: new Date().toISOString(), verificado_en: null, ficha_hash: null, usado_en: null,
    })
    if (errGuarda) { console.error('codigos_previos (guardar):', errGuarda.message); return json({ error: 'No se pudo preparar el código. Inténtalo de nuevo.' }, 500, origin) }

    try {
      await enviarCorreo({ para: correo, ...correoDelCodigo(codigo) })
    } catch (e) {
      await admin.from('codigos_previos').delete().eq('correo', correo)
      const msg = e instanceof Error ? e.message : String(e)
      console.error('enviarCorreo falló:', msg)
      if (msg === 'SIN_CONFIGURAR') return json({ error: 'El envío de correos todavía no está configurado. Avísale al administrador.' }, 503, origin)
      return json({ error: 'No se pudo mandar el correo. Revisa que esté bien escrito e inténtalo de nuevo.' }, 502, origin)
    }
    // De vez en cuando se tiran las filas viejas (más de un día), para que la tabla no crezca sin fin.
    if (Math.random() < 0.05) await admin.from('codigos_previos').delete().lt('creado_en', new Date(Date.now() - 24 * 3600 * 1000).toISOString())
    return json({ ok: true, espera: ESPERA_SEG }, 200, origin)
  }

  if (p.accion === 'confirmar') {
    if (!(await pasaElFreno(admin, 'previo_conf_ip', huellaIp, TOPE_CONFIRMAR_POR_IP_A_LA_HORA, 3600))) {
      return json({ error: 'Demasiados intentos desde esta conexión. Espera un rato e inténtalo de nuevo.', codigo: 'MUCHOS_INTENTOS' }, 429, origin)
    }
    if (correo.length > 120 || !CORREO_RE.test(correo)) return json({ error: 'Escribe tu correo completo.' }, 400, origin)
    const codigo = String(p.codigo ?? '').replace(/\D/g, '')
    if (codigo.length !== 6) return json({ error: 'El código tiene 6 números.' }, 400, origin)

    const { data: fila } = await admin.from('codigos_previos').select('*').eq('correo', correo).maybeSingle()
    if (!fila || fila.usado_en || new Date(fila.expira_en).getTime() < Date.now()) {
      if (fila && !fila.verificado_en) await admin.from('codigos_previos').delete().eq('correo', correo)
      return json({ error: 'El código ya venció. Pide otro.', codigo: 'VENCIDO' }, 400, origin)
    }
    if (fila.intentos >= MAX_INTENTOS) {
      await admin.from('codigos_previos').delete().eq('correo', correo)
      return json({ error: 'Demasiados intentos. Pide otro código.', codigo: 'VENCIDO' }, 400, origin)
    }
    if (!iguales(await hmac(`codigo:${correo}:${codigo}`), String(fila.codigo_hash))) {
      await admin.from('codigos_previos').update({ intentos: fila.intentos + 1 }).eq('correo', correo)
      const quedan = MAX_INTENTOS - fila.intentos - 1
      return json({ error: quedan > 0 ? `Código incorrecto. Te quedan ${quedan} intento${quedan === 1 ? '' : 's'}.` : 'Código incorrecto. Pide otro.' }, 400, origin)
    }

    // Código bueno: se entrega la ficha (solo se guarda su huella) y el código ya no sirve otra vez.
    const ficha = aHex(crypto.getRandomValues(new Uint8Array(32)))
    const { error: errFicha } = await admin.from('codigos_previos').update({
      verificado_en: new Date().toISOString(), ficha_hash: await hmac(`ficha:${correo}:${ficha}`), expira_en: new Date().toISOString(), intentos: 0,
    }).eq('correo', correo)
    if (errFicha) { console.error('codigos_previos (ficha):', errFicha.message); return json({ error: 'No se pudo confirmar. Inténtalo de nuevo.' }, 500, origin) }
    return json({ ok: true, ficha }, 200, origin)
  }

  return json({ error: 'Acción desconocida' }, 400, origin)
})
