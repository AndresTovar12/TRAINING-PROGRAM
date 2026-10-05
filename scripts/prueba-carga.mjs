// Prueba de la carga de un ejercicio como lista desplegable (src/lib/medidas.js): cómo se lee «75%», «RPE 8»,
// «RIR 2» o «20 kg», cómo se escribe de vuelta, qué pasa con lo que no encaja y los pesos fijos para quien usa libras.
//
//   node scripts/prueba-carga.mjs
import assert from 'node:assert/strict';
import { CARGAS, leeCarga, componeCarga, cantidadDeCarga, cargaEnSuUnidad } from '../src/lib/medidas.js';

const lee = (intensity) => leeCarga({ intensity });

/* ---- Los cuatro tipos de la lista, en su orden ---- */
assert.deepEqual(CARGAS.map((c) => c.id), ['pct', 'rpe', 'rir', 'kg']);

/* ---- Leer: el tipo sale del texto que ya hay, sin un campo nuevo ---- */
assert.deepEqual(lee('75%'), { tipo: 'pct', cantidad: '75' });
assert.deepEqual(lee('70-75%'), { tipo: 'pct', cantidad: '70-75' });
assert.deepEqual(lee('70–75 %'), { tipo: 'pct', cantidad: '70-75' }, 'la raya larga y los espacios se limpian');
assert.deepEqual(lee('82,5%'), { tipo: 'pct', cantidad: '82,5' });
assert.deepEqual(lee('75% 1RM'), { tipo: 'pct', cantidad: '75' });
assert.deepEqual(lee('75% del 1RM'), { tipo: 'pct', cantidad: '75' });
assert.deepEqual(lee('RPE 8'), { tipo: 'rpe', cantidad: '8' });
assert.deepEqual(lee('rpe8'), { tipo: 'rpe', cantidad: '8' });
assert.deepEqual(lee('RPE 7-8'), { tipo: 'rpe', cantidad: '7-8' });
assert.deepEqual(lee('RIR 2'), { tipo: 'rir', cantidad: '2' });
assert.deepEqual(lee('20 kg'), { tipo: 'kg', cantidad: '20' });
assert.deepEqual(lee('20kg'), { tipo: 'kg', cantidad: '20' });
assert.deepEqual(lee('82.5 kg'), { tipo: 'kg', cantidad: '82.5' });

/* ---- Lo que no encaja se queda como texto, entero y sin tocar ---- */
assert.deepEqual(lee(''), { tipo: null, cantidad: '' });
assert.deepEqual(lee(undefined), { tipo: null, cantidad: '' });
assert.deepEqual(leeCarga(null), { tipo: null, cantidad: '' });
for (const libre of ['70% / RPE 8', 'BW', 'Máximo', 'Bajo', '3x5 @ 80%', '75', 'RPE', 'RPE 8 / RIR 2', '20 lb', 'pesado']) {
  assert.deepEqual(lee(libre), { tipo: null, cantidad: libre }, `«${libre}» no se adivina`);
}

/* ---- Escribir: lo que se guarda vuelve a leerse igual ---- */
assert.equal(componeCarga('pct', '75'), '75%');
assert.equal(componeCarga('rpe', '8'), 'RPE 8');
assert.equal(componeCarga('rir', '2'), 'RIR 2');
assert.equal(componeCarga('kg', '20'), '20 kg');
assert.equal(componeCarga('pct', '70-75'), '70-75%');
assert.equal(componeCarga('rpe', ''), '', 'sin número no se guarda nada');
assert.equal(componeCarga('rpe', '  '), '');
assert.equal(componeCarga(null, 'pesado'), 'pesado', 'sin tipo, el texto tal cual');
for (const [tipo, cantidad] of [['pct', '75'], ['pct', '70-75'], ['rpe', '8'], ['rpe', '7-8'], ['rir', '2'], ['kg', '82.5']]) {
  assert.deepEqual(lee(componeCarga(tipo, cantidad)), { tipo, cantidad }, `${tipo} ${cantidad}: ida y vuelta`);
}

/* ---- Mientras se teclea un rango, el medio camino no desaparece ---- */
assert.equal(cantidadDeCarga('rpe', 'RPE 7-'), '7-');
assert.equal(cantidadDeCarga('pct', '70-%'), '70-');
assert.equal(cantidadDeCarga('pct', '70-'), '70-');
assert.equal(cantidadDeCarga('rir', 'RIR 2'), '2');
assert.equal(cantidadDeCarga('kg', '20 kg'), '20');
assert.equal(cantidadDeCarga('kg', '2'), '2');
assert.equal(cantidadDeCarga('pct', ''), '');
assert.equal(cantidadDeCarga('pct', '75%'), '75');

/* ---- Un peso fijo, para quien usa libras ---- */
assert.equal(cargaEnSuUnidad({ intensity: '20 kg' }, 'lb'), '45 lb', '20 kg = 44.1 lb → 45, lo que se puede cargar');
assert.equal(cargaEnSuUnidad({ intensity: '100 kg' }, 'lb'), '220 lb');
assert.equal(cargaEnSuUnidad({ intensity: '82,5 kg' }, 'lb'), '180 lb');
assert.equal(cargaEnSuUnidad({ intensity: '20 kg' }, 'kg'), null, 'quien usa kilos ve el texto de siempre');
assert.equal(cargaEnSuUnidad({ intensity: '20 kg' }, undefined), null);
assert.equal(cargaEnSuUnidad({ intensity: '75%' }, 'lb'), null, 'un porcentaje no es un peso');
assert.equal(cargaEnSuUnidad({ intensity: 'RPE 8' }, 'lb'), null);
assert.equal(cargaEnSuUnidad({ intensity: 'BW' }, 'lb'), null);
assert.equal(cargaEnSuUnidad({}, 'lb'), null);

console.log('prueba-carga: todo bien');
