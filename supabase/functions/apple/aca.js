/* APPLE ADVANCED COMMERCE, lo puro (26 nov 2026). Sin red: lo usa `index.ts` y lo prueba `scripts/prueba-apple.mjs`.

   Cómo compra la app (documentación de Apple, «Sending Advanced Commerce API requests from your app»):
     1. El servidor arma la petición (CREATE_ONE_TIME_CHARGE o CREATE_SUBSCRIPTION) con el nombre del plan y el precio que puso el coach, en pesos.
     2. La firma como JWS (ES256, llave «In-App Purchase» de App Store Connect, `aud: 'advanced-commerce-api'`, sin `exp`) con la petición en base64 en el claim `request`.
     3. La envuelve en `{"signatureInfo":{"token":"<JWS>"}}` y la app la pasa a StoreKit: `product.purchase(options: [.custom(key: "advancedCommerceData", value: datos)])`
        sobre el producto genérico (pago único = Consumable `<bundle>.aca.generic.consumable`; membresía = suscripción del grupo de Advanced Commerce).
   Los precios van en milésimas: $500 MXN = 500000. */

export const MONEDA_APPLE = 'MXN';
export const TIENDA_MX = 'MEX';
/** Código de impuesto de Apple. «App Store Software (Default)» mientras Andrés no elija otro de la lista de Apple (Choosing tax codes for your SKUs). */
export const CODIGO_DE_IMPUESTO = 'C003-00-1';

const b64url = (texto) => btoa(String.fromCharCode(...new TextEncoder().encode(texto))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const b64 = (texto) => btoa(String.fromCharCode(...new TextEncoder().encode(texto)));

/** El SKU de un plan: «TL_» + su id sin guiones (Apple lo muestra en el recibo; no cambia aunque cambie el nombre). */
export const skuDe = (planId) => `TL_${String(planId).replace(/-/g, '').toUpperCase()}`;

/**
 * La petición a Apple para comprar un plan. `tipo`: 'pago_unico' | 'membresia'. `precio`: pesos enteros (el mismo de la web).
 * `referencia`: un uuid nuestro; vuelve en la transacción firmada (`advancedCommerceInfo.requestReferenceId`) y así se sabe qué compra fue.
 */
export function peticionDeCompra({ tipo, planId, titulo, coach, precio, referencia }) {
  const item = {
    SKU: skuDe(planId),
    displayName: String(titulo ?? 'Plan').slice(0, 30),
    description: `${String(titulo ?? 'Plan')} · ${String(coach ?? '')}`.slice(0, 45),
    price: Math.round(Number(precio) * 1000),
  };
  const base = { version: '1', requestInfo: { requestReferenceId: referencia }, currency: MONEDA_APPLE, taxCode: CODIGO_DE_IMPUESTO, storefront: TIENDA_MX };
  if (tipo === 'membresia') return { operation: 'CREATE_SUBSCRIPTION', ...base, items: [{ ...item, period: 'P1M' }] };
  return { operation: 'CREATE_ONE_TIME_CHARGE', ...base, item };
}

/** Lo que va firmado: los claims base de Apple más `request` (la petición en base64). `ahora` en segundos. */
export const claimsDeCompra = ({ emisor, bundle, peticion, nonce, ahora = Math.floor(Date.now() / 1000) }) => ({
  iss: emisor, iat: ahora, aud: 'advanced-commerce-api', bid: bundle, nonce, request: b64(JSON.stringify(peticion)),
});

/** El token para hablar con la App Store Server API (vale 30 minutos). */
export const claimsDelServidor = ({ emisor, bundle, ahora = Math.floor(Date.now() / 1000) }) => ({ iss: emisor, iat: ahora, exp: ahora + 1800, aud: 'appstoreconnect-v1', bid: bundle });

export const cabeceraJws = (llaveId) => ({ alg: 'ES256', kid: llaveId, typ: 'JWT' });
/** Lo que se firma: `base64url(cabecera).base64url(claims)`. */
export const aFirmar = (cabecera, claims) => `${b64url(JSON.stringify(cabecera))}.${b64url(JSON.stringify(claims))}`;
/** Lo que recibe la app: el JWS envuelto. */
export const datosParaStoreKit = (jws) => JSON.stringify({ signatureInfo: { token: jws } });

/** Lee lo de en medio de un JWS de Apple (sin revisar la firma: lo de Apple se vuelve a pedir a su API, que llega por TLS). */
export function cargaDeJws(jws) {
  const partes = String(jws ?? '').split('.');
  if (partes.length !== 3) return null;
  try {
    const t = partes[1].replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(t + '='.repeat((4 - (t.length % 4)) % 4));
    return JSON.parse(new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0))));
  } catch { return null; }
}

/**
 * ¿Esta transacción (ya leída de la API de Apple) es la de ESTA compra? Mismo bundle, la cuenta del atleta (`appAccountToken`) y nuestra referencia.
 * Devuelve null si todo cuadra, o el motivo.
 */
export function problemaDeTransaccion(tx, { bundle, atletaId, referencia }) {
  if (!tx) return 'sin_transaccion';
  if (tx.bundleId !== bundle) return 'otra_app';
  if (atletaId && String(tx.appAccountToken ?? '').toLowerCase() !== String(atletaId).toLowerCase()) return 'otra_cuenta';
  if (referencia && tx.advancedCommerceInfo?.requestReferenceId !== referencia) return 'otra_compra';
  if (tx.revocationDate) return 'revocada';
  return null;
}

/** Lo que pagó el atleta, en pesos (Apple manda milésimas). */
export const pesosDeApple = (precio) => Math.round(Number(precio ?? 0)) / 1000;

/** El mes fiscal de Apple de una fecha (`calendario`: filas de `apple_calendario`). */
export function mesFiscal(calendario, fechaIso) {
  const dia = String(fechaIso).slice(0, 10);
  return (calendario ?? []).find((m) => m.inicio <= dia && dia <= m.fin) ?? null;
}

/** Qué hacer con cada aviso de Apple (App Store Server Notifications V2). */
export function accionDeAviso(tipo, subtipo) {
  if (tipo === 'ONE_TIME_CHARGE' || tipo === 'SUBSCRIBED') return 'activar';
  if (tipo === 'DID_RENEW') return 'renovar';
  if (tipo === 'DID_CHANGE_RENEWAL_STATUS') return subtipo === 'AUTO_RENEW_DISABLED' ? 'cancelo' : subtipo === 'AUTO_RENEW_ENABLED' ? 'reactivo' : null;
  if (tipo === 'DID_FAIL_TO_RENEW') return 'gracia';
  if (tipo === 'EXPIRED' || tipo === 'GRACE_PERIOD_EXPIRED') return 'vencer';
  if (tipo === 'REFUND' || tipo === 'REVOKE') return 'reembolsar';
  return null;
}
