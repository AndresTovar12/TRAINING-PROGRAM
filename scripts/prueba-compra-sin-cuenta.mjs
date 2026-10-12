/* Prueba de la lógica pura de «comprar sin cuenta»: la página «Listo» (etapas, llave de la liga, correo) y la instalación de la app.
   Correr: node scripts/prueba-compra-sin-cuenta.mjs */
import assert from 'node:assert/strict';
import { MAX_INTENTOS_DE_ESPERA, correoValido, etapaDeCompra, hayQueSeguirEsperando, llaveDeLaLiga } from '../src/lib/compraLista.js';
import { plataformaDeInstalacion } from '../src/lib/instalarApp.js';

let n = 0;
const prueba = (nombre, f) => { f(); n += 1; console.log(`  ✓ ${nombre}`); };

console.log('Etapas de la página «Listo»');
prueba('sin respuesta o llave desconocida', () => {
  assert.equal(etapaDeCompra(null), 'desconocida');
  assert.equal(etapaDeCompra({ estado: 'desconocida' }), 'desconocida');
});
prueba('pendiente = esperando el aviso de Stripe', () => assert.equal(etapaDeCompra({ estado: 'pendiente' }), 'esperando'));
prueba('sin internet un momento = se sigue esperando, no «no existe»', () => assert.equal(etapaDeCompra({ estado: 'sin_conexion' }), 'esperando'));
prueba('pagada y sin contraseña puesta = pide la contraseña', () => {
  assert.equal(etapaDeCompra({ estado: 'activa', puede_poner_contrasena: true }), 'contrasena');
  assert.equal(etapaDeCompra({ estado: 'gracia', puede_poner_contrasena: true }), 'contrasena');
});
prueba('pagada sin nada que pedir = listo', () => {
  assert.equal(etapaDeCompra({ estado: 'activa', puede_poner_contrasena: false }), 'listo');
  assert.equal(etapaDeCompra({ estado: 'activa' }), 'listo');
});
prueba('cancelada, vencida y reembolsada no son «listo»', () => {
  assert.equal(etapaDeCompra({ estado: 'cancelada' }), 'cancelada');
  assert.equal(etapaDeCompra({ estado: 'vencida' }), 'cerrada');
  assert.equal(etapaDeCompra({ estado: 'reembolsada' }), 'cerrada');
});
prueba('solo se sigue preguntando mientras se espera y dentro del tope', () => {
  assert.equal(hayQueSeguirEsperando('esperando', 0), true);
  assert.equal(hayQueSeguirEsperando('esperando', MAX_INTENTOS_DE_ESPERA), false);
  assert.equal(hayQueSeguirEsperando('listo', 0), false);
  assert.equal(hayQueSeguirEsperando('contrasena', 0), false);
});

console.log('La llave del pago en la liga');
prueba('acepta una llave de Stripe y rechaza lo demás', () => {
  assert.equal(llaveDeLaLiga('?c=cs_test_a1B2c3D4e5F6g7H8'), 'cs_test_a1B2c3D4e5F6g7H8');
  assert.equal(llaveDeLaLiga('?c=cs_live_a1B2c3D4e5F6g7H8'), 'cs_live_a1B2c3D4e5F6g7H8');
  assert.equal(llaveDeLaLiga(''), null);
  assert.equal(llaveDeLaLiga('?c='), null);
  assert.equal(llaveDeLaLiga('?c=hola'), null);
  assert.equal(llaveDeLaLiga('?c=cs_test_<script>'), null);
  assert.equal(llaveDeLaLiga('?otra=cs_test_a1B2c3D4e5F6g7H8'), null);
});

console.log('Correo');
prueba('correos válidos e inválidos', () => {
  for (const ok of ['a@b.co', ' ana@correo.com ', 'ana.perez+gym@mail.mx']) assert.equal(correoValido(ok), true, ok);
  for (const mal of ['', 'ana', 'ana@', '@correo.com', 'ana@correo', 'ana perez@correo.com', null, undefined]) assert.equal(correoValido(mal), false, String(mal));
  assert.equal(correoValido(`${'a'.repeat(250)}@b.co`), false);
});

console.log('Instalar la app');
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1';
const IPHONE_INSTAGRAM = `${IPHONE} Instagram 330.0.0.20.110`;
const ANDROID = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36';
const ANDROID_INSTAGRAM = `${ANDROID} Instagram 330.0.0.20.110 Android`;
const MAC = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15';
prueba('iPhone en Safari', () => assert.deepEqual(plataformaDeInstalacion({ userAgent: IPHONE }), { plataforma: 'ios', navegadorInterno: false }));
prueba('iPhone dentro de Instagram: hay que salir a Safari', () => assert.deepEqual(plataformaDeInstalacion({ userAgent: IPHONE_INSTAGRAM }), { plataforma: 'ios', navegadorInterno: true }));
prueba('Android en Chrome y dentro de Instagram', () => {
  assert.deepEqual(plataformaDeInstalacion({ userAgent: ANDROID }), { plataforma: 'android', navegadorInterno: false });
  assert.deepEqual(plataformaDeInstalacion({ userAgent: ANDROID_INSTAGRAM }), { plataforma: 'android', navegadorInterno: true });
});
prueba('iPad que se presenta como Mac se reconoce por la pantalla táctil', () => {
  assert.equal(plataformaDeInstalacion({ userAgent: MAC, maxTouchPoints: 5 }).plataforma, 'ios');
  assert.equal(plataformaDeInstalacion({ userAgent: MAC, maxTouchPoints: 0 }).plataforma, 'escritorio');
});
prueba('ya instalada: no hay nada que instalar, ni aviso de navegador interno', () => {
  assert.deepEqual(plataformaDeInstalacion({ userAgent: IPHONE_INSTAGRAM, standalone: true }), { plataforma: 'instalada', navegadorInterno: false });
});
prueba('sin datos no truena', () => assert.equal(plataformaDeInstalacion().plataforma, 'escritorio'));

console.log(`\n${n} pruebas, todas bien.`);
