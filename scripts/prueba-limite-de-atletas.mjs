/* Pruebas del tope de atletas a mano (lo puro): `node scripts/prueba-limite-de-atletas.mjs`. Sin red ni base de datos. */
import assert from 'node:assert/strict';
import {
  ErrorDeLimite, AVISO_PARA_EL_ATLETA, datosDelLimite, comoErrorDeLimite, sinLugares, etiquetaDeLugares, tituloSinLugares,
  paquetesQueAmplian, pesos, modoDeLimite, limiteParaGuardar, comisionATexto, comisionParaGuardar, COMISION_BASE_PORCIENTO,
} from '../src/lib/limiteDeAtletas.js';

/* ---- Reconocer el texto fijo que suelta la base ---- */
assert.deepEqual(datosDelLimite({ message: 'LIMITE_DE_ATLETAS|5|5' }), { limite: 5, usados: 5 });
assert.deepEqual(datosDelLimite(new Error('Error: LIMITE_DE_ATLETAS|10|10 (contexto)')), { limite: 10, usados: 10 });
assert.equal(datosDelLimite({ message: 'otro error' }), null);
assert.equal(datosDelLimite(null), null);

const raro = { message: 'duplicate key' };
assert.equal(comoErrorDeLimite(raro), raro, 'lo que no es del tope pasa igual');
const e = comoErrorDeLimite({ message: 'LIMITE_DE_ATLETAS|5|5' });
assert.ok(e instanceof ErrorDeLimite);
assert.equal(e.message, AVISO_PARA_EL_ATLETA);
assert.deepEqual([e.limite, e.usados], [5, 5]);
assert.equal(comoErrorDeLimite({ message: 'LIMITE_DE_ATLETAS|5|5' }, 'otro texto').message, 'otro texto');

/* ---- Los lugares ---- */
const lleno = { limite: 5, usados: 5, libres: 0, ilimitado: false };
const libre = { limite: 5, usados: 3, libres: 2, ilimitado: false };
const sinTope = { limite: -1, usados: 40, libres: null, ilimitado: true };
assert.equal(sinLugares(lleno), true);
assert.equal(sinLugares(libre), false);
assert.equal(sinLugares(sinTope), false, 'sin tope nunca se llena');
assert.equal(sinLugares(null), false, 'si no se sabe, no se bloquea: decide el servidor');
assert.equal(etiquetaDeLugares(libre), '3 de 5');
assert.equal(etiquetaDeLugares(sinTope), null);
assert.equal(etiquetaDeLugares(null), null);
assert.equal(tituloSinLugares(lleno, 5), 'Solo puedes agregar 5 atletas gratis');
assert.equal(tituloSinLugares({ ...lleno, limite: 10 }, 5), 'Llegaste a tus 10 atletas', 'con paquete pagado ya no dice «gratis»');

/* ---- Paquetes que amplían ---- */
const paquetes = [
  { id: 'c', atletas_total: 50, precio_mxn: 1199, activo: true },
  { id: 'a', atletas_total: 10, precio_mxn: 349, activo: true },
  { id: 'x', atletas_total: 25, precio_mxn: 699, activo: false },
  { id: 'z', atletas_total: 5, precio_mxn: 100, activo: true },
];
assert.deepEqual(paquetesQueAmplian(paquetes, lleno).map((p) => p.id), ['a', 'c'], 'solo activos y que den más de los 5 que ya tiene, del más chico al más grande');
assert.deepEqual(paquetesQueAmplian(paquetes, { ...lleno, limite: 10 }).map((p) => p.id), ['c']);
assert.deepEqual(paquetesQueAmplian(null, lleno), []);
assert.equal(pesos(349), '$349');
assert.equal(pesos(1999), '$1,999');

/* ---- Lo que fija el dueño ---- */
assert.deepEqual(['fabrica', 'sin_tope', 'numero', 'numero'], [null, -1, 25, 0].map(modoDeLimite));
assert.deepEqual(limiteParaGuardar('fabrica', 'x'), { valor: null });
assert.deepEqual(limiteParaGuardar('sin_tope', ''), { valor: -1 });
assert.deepEqual(limiteParaGuardar('numero', ' 25 '), { valor: 25 });
assert.deepEqual(limiteParaGuardar('numero', '0'), { valor: 0 });
for (const malo of ['', 'abc', '-3', '2.5']) assert.ok(limiteParaGuardar('numero', malo).error, `«${malo}» no es un tope válido`);

assert.equal(COMISION_BASE_PORCIENTO, 20);
assert.equal(comisionATexto(null), '');
assert.equal(comisionATexto(0.15), '15');
assert.equal(comisionATexto(0.125), '12.5');
assert.deepEqual(comisionParaGuardar(''), { valor: null });
assert.deepEqual(comisionParaGuardar('15'), { valor: 0.15 });
assert.deepEqual(comisionParaGuardar('12,5'), { valor: 0.125 });
assert.deepEqual(comisionParaGuardar('0'), { valor: 0 });
assert.deepEqual(comisionParaGuardar('100'), { valor: 1 });
for (const mala of ['abc', '-1', '101']) assert.ok(comisionParaGuardar(mala).error, `«${mala}» no es una comisión válida`);

console.log('✓ limite de atletas: todo bien');
