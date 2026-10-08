// Prueba de la carga de un ejercicio como lista desplegable (src/lib/medidas.js): cómo se lee «75%», «RPE 8»,
// «RIR 2» o «20 kg», cómo se escribe de vuelta, qué pasa con lo que no encaja y los pesos fijos para quien usa libras.
//
//   node scripts/prueba-carga.mjs
import assert from 'node:assert/strict';
import { CARGAS, GRUPOS_DE_CARGA, leeCarga, componeCarga, cantidadDeCarga, cargaEnSuUnidad, tipoDeCargaAlEscribir } from '../src/lib/medidas.js';
import { porcentajeDe } from '../src/lib/cargaPorcentaje.js';

const lee = (intensity) => leeCarga({ intensity });

/* ---- Los nueve tipos de la lista, en sus tres grupos y en su orden ---- */
assert.deepEqual(CARGAS.map((c) => c.id), ['pct', 'kg', 'int', 'rpe', 'rir', 'ritmo', 'zona', 'w', 'nado']);
assert.deepEqual(GRUPOS_DE_CARGA, ['Fuerza', 'Esfuerzo', 'Cardio']);
assert.deepEqual(GRUPOS_DE_CARGA.map((g) => CARGAS.filter((c) => c.grupo === g).map((c) => c.id)),
  [['pct', 'kg'], ['int', 'rpe', 'rir'], ['ritmo', 'zona', 'w', 'nado']]);

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

/* ---- Las cargas de cardio y la intensidad ---- */
assert.deepEqual(lee('85% intensidad'), { tipo: 'int', cantidad: '85' });
assert.deepEqual(lee('80-90% intensidad'), { tipo: 'int', cantidad: '80-90' });
assert.deepEqual(lee('4:34 min/km'), { tipo: 'ritmo', cantidad: '4:34' });
assert.deepEqual(lee('4:34-5:00 min/km'), { tipo: 'ritmo', cantidad: '4:34-5:00' });
assert.deepEqual(lee('Zona 4'), { tipo: 'zona', cantidad: '4' });
assert.deepEqual(lee('Zona 2-3'), { tipo: 'zona', cantidad: '2-3' });
assert.deepEqual(lee('Z3'), { tipo: 'zona', cantidad: '3' });
assert.deepEqual(lee('250 W'), { tipo: 'w', cantidad: '250' });
assert.deepEqual(lee('200-250 W'), { tipo: 'w', cantidad: '200-250' });
assert.deepEqual(lee('1:45 /100 m'), { tipo: 'nado', cantidad: '1:45' });
assert.deepEqual(lee('1:45-2:00 /100 m'), { tipo: 'nado', cantidad: '1:45-2:00' });
assert.equal(componeCarga('int', '85'), '85% intensidad');
assert.equal(componeCarga('ritmo', '4:34-5:00'), '4:34-5:00 min/km');
assert.equal(componeCarga('zona', '4'), 'Zona 4');
assert.equal(componeCarga('w', '250'), '250 W');
assert.equal(componeCarga('nado', '1:45'), '1:45 /100 m');
for (const [tipo, cantidad] of [['int', '85'], ['int', '80-90'], ['ritmo', '4:34'], ['ritmo', '4:34-5:00'], ['zona', '4'], ['zona', '2-3'], ['w', '250'], ['w', '200-250'], ['nado', '1:45']]) {
  assert.deepEqual(lee(componeCarga(tipo, cantidad)), { tipo, cantidad }, `${tipo} ${cantidad}: ida y vuelta`);
}
// A medio escribir no se pierde el tipo ni lo tecleado.
assert.equal(tipoDeCargaAlEscribir('85-% intensidad'), 'int');
assert.equal(tipoDeCargaAlEscribir('4:3 min/km'), 'ritmo');
assert.equal(tipoDeCargaAlEscribir('4:34-5 min/km'), 'ritmo');
assert.equal(tipoDeCargaAlEscribir('2- /100 m'), 'nado');
assert.equal(cantidadDeCarga('ritmo', '4:34-5 min/km'), '4:34-5');
assert.equal(cantidadDeCarga('zona', 'Zona 4'), '4');
assert.equal(cantidadDeCarga('w', '250 W'), '250');
assert.equal(cantidadDeCarga('nado', '1:45 /100 m'), '1:45');
assert.equal(cantidadDeCarga('int', '85% intensidad'), '85');
// «85% intensidad» NO es el 85% del 1RM: nunca se convierte a kilos.
assert.equal(porcentajeDe('85% intensidad'), null, 'una intensidad no se pasa a kilos');
assert.equal(porcentajeDe('80-90% intensidad'), null);
assert.deepEqual(porcentajeDe('85%'), { min: 85, max: 85 }, 'el % del 1RM de siempre sigue igual');

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
