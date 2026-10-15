/* Pruebas de las rutas de la tienda pública (lo puro): `node scripts/prueba-rutas.mjs`. Sin red ni base de datos. */
import assert from 'node:assert/strict';
import { rutaDecodificada, rutaDeTienda } from '../src/lib/rutas.js';

// Como las compartía Vercel…
assert.deepEqual(rutaDeTienda('/@zz_qa_fisio/zz-qa-clase-de-yoga'), { tipo: 'plan', usuario: 'zz_qa_fisio', slug: 'zz-qa-clase-de-yoga' });
assert.deepEqual(rutaDeTienda('/@Laura'), { tipo: 'coach', usuario: 'laura', slug: null });
assert.deepEqual(rutaDeTienda('/@laura/'), { tipo: 'coach', usuario: 'laura', slug: null });
// …y como las entrega Cloudflare, con la arroba codificada (esto era el fallo: caían en la pantalla de entrar).
assert.deepEqual(rutaDeTienda('/%40zz_qa_fisio/zz-qa-clase-de-yoga'), { tipo: 'plan', usuario: 'zz_qa_fisio', slug: 'zz-qa-clase-de-yoga' });
assert.deepEqual(rutaDeTienda('/%40laura'), { tipo: 'coach', usuario: 'laura', slug: null });
assert.deepEqual(rutaDeTienda('/%40LAURA/Plan-1/'), { tipo: 'plan', usuario: 'laura', slug: 'plan-1' });
// Regreso del pago
assert.deepEqual(rutaDeTienda('/compra/lista'), { tipo: 'lista' });
assert.deepEqual(rutaDeTienda('/compra/cancelada'), { tipo: 'cancelada' });
// Lo que NO es de la tienda
for (const r of ['/', '/entrenar', '/oauth/consent', '/@', '/@laura/a/b', '/@la ura', '/%40', '', null, undefined]) assert.equal(rutaDeTienda(r), null, `«${r}» no es de la tienda`);
// Algo mal codificado no revienta
assert.equal(rutaDecodificada('/%E0%A4%A'), '/%E0%A4%A');
assert.equal(rutaDeTienda('/%E0%A4%A'), null);
assert.equal(rutaDecodificada('/%40x'), '/@x');
console.log('✓ rutas: todo bien');
