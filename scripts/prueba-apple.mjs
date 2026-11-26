/* Compra con Apple, lo puro (`supabase/functions/apple/aca.js`, 26 nov 2026): la petición firmada, el JWS, la transacción y los avisos. Sin red. */
import assert from 'node:assert/strict';
import { generateKeyPairSync, verify } from 'node:crypto';
import {
  peticionDeCompra, claimsDeCompra, claimsDelServidor, cabeceraJws, aFirmar, datosParaStoreKit, cargaDeJws, problemaDeTransaccion, pesosDeApple, mesFiscal, accionDeAviso, skuDe,
} from '../supabase/functions/apple/aca.js';

const unico = peticionDeCompra({ tipo: 'pago_unico', planId: '0b4c-11', titulo: 'Fuerza 12 semanas', coach: 'Carlos Ruiz', precio: 500, referencia: 'ref-1' });
assert.equal(unico.operation, 'CREATE_ONE_TIME_CHARGE');
assert.equal(unico.currency, 'MXN');
assert.equal(unico.storefront, 'MEX');
assert.equal(unico.item.price, 500000, 'Apple cuenta en milésimas: $500 = 500000 (el mismo precio que en la web)');
assert.equal(unico.item.displayName, 'Fuerza 12 semanas');
assert.equal(unico.item.SKU, skuDe('0b4c-11'));
assert.equal(unico.requestInfo.requestReferenceId, 'ref-1');
const mem = peticionDeCompra({ tipo: 'membresia', planId: 'x', titulo: 'Un nombre de plan larguísimo que no cabe', coach: 'C', precio: 650, referencia: 'r' });
assert.equal(mem.operation, 'CREATE_SUBSCRIPTION');
assert.equal(mem.items[0].period, 'P1M');
assert.ok(mem.items[0].displayName.length <= 30);

// El JWS: ES256 y verificable con la llave pública (así lo revisa Apple).
const claims = claimsDeCompra({ emisor: 'iss-1', bundle: 'com.traininglabapp.app', peticion: unico, nonce: 'n-1', ahora: 1764000000 });
assert.equal(claims.aud, 'advanced-commerce-api');
assert.equal(claims.exp, undefined, 'sin exp: Apple la rechaza');
assert.deepEqual(JSON.parse(Buffer.from(claims.request, 'base64').toString('utf8')), unico, '`request` es la petición en base64');
assert.equal(claimsDelServidor({ emisor: 'i', bundle: 'b', ahora: 10 }).exp, 1810);
const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'P-256' });
const texto = aFirmar(cabeceraJws('KID1'), claims);
const firma = (await import('node:crypto')).sign('sha256', Buffer.from(texto), { key: privateKey, dsaEncoding: 'ieee-p1363' });
const jws = `${texto}.${firma.toString('base64url')}`;
assert.ok(verify('sha256', Buffer.from(texto), { key: publicKey, dsaEncoding: 'ieee-p1363' }, firma));
assert.deepEqual(cargaDeJws(jws), claims);
assert.deepEqual(JSON.parse(datosParaStoreKit(jws)), { signatureInfo: { token: jws } });
assert.equal(cargaDeJws('basura'), null);

// La transacción (ya pedida a Apple) tiene que ser de esta app, esta cuenta y esta compra.
const tx = { bundleId: 'com.traininglabapp.app', appAccountToken: 'AAA-1', advancedCommerceInfo: { requestReferenceId: 'ref-1' }, price: 500000 };
assert.equal(problemaDeTransaccion(tx, { bundle: 'com.traininglabapp.app', atletaId: 'aaa-1', referencia: 'ref-1' }), null);
assert.equal(problemaDeTransaccion({ ...tx, bundleId: 'otra' }, { bundle: 'com.traininglabapp.app', atletaId: 'aaa-1', referencia: 'ref-1' }), 'otra_app');
assert.equal(problemaDeTransaccion(tx, { bundle: 'com.traininglabapp.app', atletaId: 'bbb', referencia: 'ref-1' }), 'otra_cuenta');
assert.equal(problemaDeTransaccion(tx, { bundle: 'com.traininglabapp.app', atletaId: 'aaa-1', referencia: 'ref-2' }), 'otra_compra');
assert.equal(problemaDeTransaccion({ ...tx, revocationDate: 1 }, { bundle: 'com.traininglabapp.app', atletaId: 'aaa-1', referencia: 'ref-1' }), 'revocada');
assert.equal(pesosDeApple(500000), 500);

// Mes fiscal y avisos.
const cal = [{ inicio: '2026-11-01', fin: '2026-11-28', pago_estimado: '2026-12-31' }, { inicio: '2026-11-29', fin: '2026-12-26', pago_estimado: '2027-01-28' }];
assert.equal(mesFiscal(cal, '2026-11-28T23:00:00Z').pago_estimado, '2026-12-31');
assert.equal(mesFiscal(cal, '2026-11-29T01:00:00Z').pago_estimado, '2027-01-28');
assert.equal(accionDeAviso('ONE_TIME_CHARGE'), 'activar');
assert.equal(accionDeAviso('SUBSCRIBED', 'INITIAL_BUY'), 'activar');
assert.equal(accionDeAviso('DID_RENEW'), 'renovar');
assert.equal(accionDeAviso('DID_CHANGE_RENEWAL_STATUS', 'AUTO_RENEW_DISABLED'), 'cancelo');
assert.equal(accionDeAviso('EXPIRED', 'VOLUNTARY'), 'vencer');
assert.equal(accionDeAviso('REFUND'), 'reembolsar');
assert.equal(accionDeAviso('TEST'), null);
console.log('✓ compra con Apple (lo puro): todo bien');
