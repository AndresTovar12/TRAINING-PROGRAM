/* AYUDAS DE STRIPE para las Edge Functions (`comprar`, `stripe-webhook`, `reembolsar`). Sin SDK: basta `fetch`, y así lo que corre en Deno se puede probar tal cual en node
   (`scripts/prueba-stripe.mjs`). Este archivo no importa nada. Las tres funciones llevan una copia IDÉNTICA (`scripts/compartir-con-mcp.mjs --revisar` lo vigila).

   VERSIÓN DE LA API. Se fija en cada llamada (`Stripe-Version`) porque Stripe cambia de nombre y de lugar algunos campos entre versiones (por ejemplo, dónde vive `current_period_end` o
   `invoice.subscription`). Con la versión fija, lo que se lee aquí no se mueve solo. El endpoint del webhook se crea con esta misma versión (ver docs/stripe.md). */

export const VERSION_DE_API = '2024-06-20';
export const MONEDA = 'mxn';

/** La comisión de la app (Andrés, 11 oct 2026): 20 % base. El dueño vende al 0 %. Los escalones por volumen entran en la etapa 4. */
export const tasaDeComision = ({ esDueno }) => (esDueno ? 0 : 0.2);

/** Cómo se reparte UN cobro. Todo en centavos enteros para que no se pierda ni se invente un centavo: la comisión se redondea y lo demás es del coach. */
export function repartoDeUnCobro({ bruto, tasa }) {
  const centavos = Math.round(Number(bruto) * 100);
  const comision = Math.round(centavos * Number(tasa));
  return { bruto: centavos / 100, tasa: Number(tasa), comision_app: comision / 100, parte_coach: (centavos - comision) / 100, parte_coach_centavos: centavos - comision };
}

/** Los datos como los pide Stripe: formulario con llaves anidadas (`line_items[0][price_data][currency]=mxn`). Lo `undefined` y lo `null` se omiten. */
export function cuerpoDeFormulario(datos) {
  const pares = [];
  const agrega = (clave, valor) => {
    if (valor === undefined || valor === null) return;
    if (Array.isArray(valor)) valor.forEach((v, i) => agrega(`${clave}[${i}]`, v));
    else if (typeof valor === 'object') Object.entries(valor).forEach(([k, v]) => agrega(`${clave}[${k}]`, v));
    else pares.push(`${encodeURIComponent(clave)}=${encodeURIComponent(String(valor))}`);
  };
  Object.entries(datos ?? {}).forEach(([k, v]) => agrega(k, v));
  return pares.join('&');
}

/**
 * Una llamada a la API de Stripe. `cuenta`: para actuar como una cuenta conectada. `idempotencia`: llave para que repetir la llamada no cobre ni cree dos veces. Si falla, lanza un Error con el mensaje de Stripe.
 * @param {string} clave @param {'GET' | 'POST' | 'DELETE'} metodo @param {string} ruta
 * @param {Record<string, any> | null} [datos]
 * @param {{ cuenta?: string | null, idempotencia?: string | null }} [opciones]
 * @returns {Promise<any>}
 */
export async function llamaStripe(clave, metodo, ruta, datos = null, { cuenta = null, idempotencia = null } = {}) {
  const cabeceras = { Authorization: `Bearer ${clave}`, 'Stripe-Version': VERSION_DE_API };
  if (cuenta) cabeceras['Stripe-Account'] = cuenta;
  if (idempotencia) cabeceras['Idempotency-Key'] = idempotencia;
  let url = `https://api.stripe.com${ruta}`;
  let cuerpo;
  if (metodo === 'GET') {
    const consulta = cuerpoDeFormulario(datos);
    if (consulta) url += `?${consulta}`;
  } else {
    cabeceras['Content-Type'] = 'application/x-www-form-urlencoded';
    cuerpo = cuerpoDeFormulario(datos);
  }
  const respuesta = await fetch(url, { method: metodo, headers: cabeceras, body: cuerpo });
  const json = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(json?.error?.message ?? `Stripe respondió ${respuesta.status}`);
    error.stripe = json?.error ?? null;
    error.estado = respuesta.status;
    throw error;
  }
  return json;
}

const aHex = (buffer) => [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, '0')).join('');
const igualesSinPrisa = (a, b) => {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i += 1) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
};

/**
 * ¿Este aviso viene de Stripe de verdad? Stripe firma el texto EXACTO del aviso con el secreto del webhook (`Stripe-Signature: t=…,v1=…`). Se rechaza lo firmado con otro secreto,
 * lo alterado y lo viejo (más de 5 minutos: alguien repitiendo un aviso ya usado). `cuerpo` es el texto crudo, antes de convertirlo a JSON.
 */
export async function verificaFirma(cuerpo, cabecera, secreto, { tolerancia = 300, ahora = Date.now() } = {}) {
  if (!cabecera || !secreto) return false;
  let marca = null;
  const firmas = [];
  for (const parte of String(cabecera).split(',')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    const k = parte.slice(0, i).trim();
    const v = parte.slice(i + 1).trim();
    if (k === 't') marca = v; else if (k === 'v1') firmas.push(v);
  }
  if (!marca || !firmas.length || !Number.isFinite(Number(marca))) return false;
  if (Math.abs(ahora / 1000 - Number(marca)) > tolerancia) return false;
  const llave = await crypto.subtle.importKey('raw', new TextEncoder().encode(secreto), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const esperada = aHex(await crypto.subtle.sign('HMAC', llave, new TextEncoder().encode(`${marca}.${cuerpo}`)));
  return firmas.some((f) => igualesSinPrisa(f, esperada));
}

/* Dónde está cada dato en los objetos de Stripe (con la versión de la API fijada arriba, y con el lugar nuevo como respaldo). */
const id = (x) => (typeof x === 'string' ? x : x?.id ?? null);
export const compraIdDeSesion = (sesion) => sesion?.client_reference_id ?? sesion?.metadata?.compra_id ?? null;
export const compraIdDeFactura = (f) => f?.subscription_details?.metadata?.compra_id
  ?? f?.parent?.subscription_details?.metadata?.compra_id
  ?? f?.lines?.data?.find((l) => l?.metadata?.compra_id)?.metadata?.compra_id ?? null;
export const suscripcionDeFactura = (f) => id(f?.subscription) ?? f?.parent?.subscription_details?.subscription ?? null;
export const cobroDeFactura = (f) => id(f?.charge);
export const finDePeriodoDeFactura = (f) => f?.lines?.data?.[0]?.period?.end ?? f?.period_end ?? null;
export const finDePeriodoDeSuscripcion = (s) => s?.current_period_end ?? s?.items?.data?.[0]?.current_period_end ?? null;
export const idDe = id;

/** Segundos de Stripe → fecha de Postgres (o null). */
export const aFecha = (segundos) => (Number.isFinite(Number(segundos)) && segundos ? new Date(Number(segundos) * 1000).toISOString() : null);
