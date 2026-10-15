/* Pruebas de los correos inventados (lo puro): `node scripts/prueba-correos.mjs`. */
import assert from 'node:assert/strict';
import { esCorreoInventado, correoValido, DOMINIOS_SIN_BUZON } from '../src/lib/correos.js';

assert.deepEqual(DOMINIOS_SIN_BUZON, ['sin-correo.traininglabapp.com', 'traininglab.app']);
// Inventados: el de ahora, el de antes y con mayúsculas o espacios.
for (const c of ['juan@sin-correo.traininglabapp.com', 'JUAN@Sin-Correo.TrainingLabApp.com', ' pendiente.abc@traininglab.app ', 'x@traininglab.app', 'a@b.sin-correo.traininglabapp.com'])
  assert.equal(esCorreoInventado(c), true, `${c} es inventado`);
// Reales (y parecidos que NO lo son).
for (const c of ['ad.tr1213@gmail.com', 'juan@traininglabapp.com', 'hola@traininglabapp.com', 'a@otrotraininglab.app', 'a@mitraininglab.app', 'sin-correo.traininglabapp.com', '', null, undefined, 'sinarroba'])
  assert.equal(esCorreoInventado(c), false, `${c} NO es inventado`);
// La forma de un correo.
for (const c of ['a@b.co', ' ad.tr1213@gmail.com ', 'x.y+z@dominio.mx']) assert.equal(correoValido(c), true, c);
for (const c of ['', 'a@b', '@b.co', 'a b@c.co', null, 'sin arroba']) assert.equal(correoValido(c), false, String(c));
console.log('✓ correos: todo bien');
