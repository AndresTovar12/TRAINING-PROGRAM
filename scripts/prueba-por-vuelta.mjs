// Prueba de la lógica pura de «por vuelta» (src/lib/porVuelta.js), «por lado» y el descanso como lista
// (src/lib/medidas.js): cuándo un ejercicio cambia de una vuelta a otra, cómo se guarda y se normaliza,
// lo que anota el atleta vuelta por vuelta y cómo se leen «10/lado» y «90 seg».
//
//   node scripts/prueba-por-vuelta.mjs
import assert from 'node:assert/strict';
import {
  rondasDe, varian, vueltasDe, filasParaEditar, parcheDeVueltas, ejercicioDeVuelta, normalizaVueltas,
  anotadoEnVuelta, resumenDeVueltas, conVueltaAnotada, vueltasAnotadas,
} from '../src/lib/porVuelta.js';
import {
  leeCantidad, textoMeta, metaEnSegundos, leeDescanso, componeDescanso, cantidadDeDescanso,
  unidadDeDescansoAlEscribir, tipoDeCargaAlEscribir, DESCANSOS,
} from '../src/lib/medidas.js';
import { diferencia, aplicarParche } from '../src/lib/estadoPorPartes.js';

/* ---- Cuántas vueltas da un Set ---- */
assert.equal(rondasDe('4'), 4);
assert.equal(rondasDe(3), 3);
assert.equal(rondasDe(' 2 '), 2);
for (const no of ['1', '0', '', '—', '3-4', 'x', null, undefined, '31', '2.5']) {
  assert.equal(rondasDe(no), null, `«${no}» no da para vueltas distintas`);
}

/* ---- Las vueltas de un ejercicio ---- */
const piramide = [{ reps: '10', intensity: '60%' }, { reps: '8', intensity: '70%' }, { reps: '6', intensity: '80%' }, { reps: '4', intensity: '85%' }];
const squat = { name: 'Back Squat', sets: '4', reps: '10', intensity: '60%', porVuelta: piramide };
assert.deepEqual(vueltasDe(squat), piramide);
assert.deepEqual(varian(piramide), { reps: true, intensity: true, alguno: true });
assert.deepEqual(varian([{ reps: '5', intensity: '60%' }, { reps: '5', intensity: '70%' }]), { reps: false, intensity: true, alguno: true });
assert.equal(vueltasDe({ ...squat, porVuelta: undefined }), null, 'un ejercicio normal no tiene vueltas');
assert.equal(vueltasDe({ ...squat, porVuelta: [] }), null);
assert.equal(vueltasDe({ ...squat, porVuelta: 'x' }), null);
assert.equal(vueltasDe({ ...squat, sets: '1' }), null, 'con una sola vuelta no hay nada que cambiar');
assert.equal(vueltasDe({ ...squat, sets: '3-4' }), null);
assert.equal(vueltasDe({ ...squat, formato: { id: 'amrap' } }), null, 'con un formato de reloj las vueltas son del reloj');
assert.equal(vueltasDe({ ...squat, isNote: true }), null);
assert.equal(vueltasDe(null), null);
// Si el Set se repite más veces, las que faltan copian la última; si menos, sobran.
assert.deepEqual(vueltasDe({ ...squat, sets: '5' }).map((f) => f.intensity), ['60%', '70%', '80%', '85%', '85%']);
assert.deepEqual(vueltasDe({ ...squat, sets: '2' }), piramide.slice(0, 2));
// Todas iguales = normal, aunque la lista exista (p. ej. recortada a las que coinciden).
assert.equal(vueltasDe({ sets: '2', porVuelta: [{ reps: '5', intensity: '60%' }, { reps: '5', intensity: '60%' }, { reps: '3', intensity: '90%' }] }), null);
// Lo que llega raro se limpia a texto.
assert.deepEqual(vueltasDe({ sets: '2', porVuelta: [{ reps: 10 }, { intensity: 70 }] }), [{ reps: '10', intensity: '' }, { reps: '', intensity: '70' }]);

/* ---- Desplegar un ejercicio normal: tantas filas iguales como vueltas ---- */
const normal = { name: 'Remo', sets: '3', reps: '8', intensity: 'RPE 7' };
assert.deepEqual(filasParaEditar(normal, 3), [{ reps: '8', intensity: 'RPE 7' }, { reps: '8', intensity: 'RPE 7' }, { reps: '8', intensity: 'RPE 7' }]);
assert.deepEqual(filasParaEditar(squat, 4), piramide);
assert.deepEqual(filasParaEditar({ sets: '2' }, 2), [{ reps: '', intensity: '' }, { reps: '', intensity: '' }]);

/* ---- Guardar: la primera vuelta va en los campos de siempre; iguales = sin `porVuelta` ---- */
assert.deepEqual(parcheDeVueltas(piramide), { reps: '10', intensity: '60%', porVuelta: piramide });
assert.notEqual(parcheDeVueltas(piramide).porVuelta, piramide, 'guarda una copia');
const iguales = parcheDeVueltas([{ reps: '8', intensity: 'RPE 7' }, { reps: '8', intensity: 'RPE 7' }]);
assert.deepEqual(iguales, { reps: '8', intensity: 'RPE 7', porVuelta: undefined });
assert.ok('porVuelta' in iguales, 'la llave va en `undefined` para que un parche la borre del ejercicio');
// Desplegar y cerrar sin tocar nada no deja rastro.
assert.deepEqual({ ...normal, ...parcheDeVueltas(filasParaEditar(normal, 3)) }, { ...normal, porVuelta: undefined });
assert.deepEqual(ejercicioDeVuelta(squat, piramide[2]), { ...squat, reps: '6', intensity: '80%' });

/* ---- Normalizar al guardar el Set ---- */
assert.equal(normalizaVueltas(normal, '3'), normal, 'un ejercicio sin vueltas ni se toca');
assert.deepEqual(normalizaVueltas(squat, '4'), squat);
const recortado = normalizaVueltas(squat, '2');
assert.deepEqual(recortado.porVuelta, piramide.slice(0, 2), 'al bajar de 4 a 2 vueltas se quedan las dos primeras');
const crecido = normalizaVueltas(squat, '5');
assert.equal(crecido.porVuelta.length, 5);
assert.deepEqual(crecido.porVuelta[4], piramide[3]);
assert.ok(!('porVuelta' in normalizaVueltas(squat, '1')), 'con una vuelta se quita');
assert.ok(!('porVuelta' in normalizaVueltas({ ...squat, formato: { id: 'emom' } }, '4')), 'con formato de reloj se quita');
assert.ok(!('porVuelta' in normalizaVueltas({ ...normal, porVuelta: undefined }, '3')), 'una llave vacía no se queda');
const espejo = normalizaVueltas({ ...squat, reps: '99', intensity: 'x' }, '4');
assert.deepEqual([espejo.reps, espejo.intensity], ['10', '60%'], 'los campos de siempre vuelven a ser la primera vuelta');

/* ---- Lo que anota el atleta, vuelta por vuelta ---- */
let reg = {};
reg = conVueltaAnotada(reg, 0, { repsHechas: '10', weight: '85' });
assert.deepEqual(reg, { vueltas: { 0: { repsHechas: '10', weight: '85' } }, weight: '85', repsHechas: '10' });
reg = conVueltaAnotada(reg, 3, { repsHechas: '4', weight: '120' });
reg = conVueltaAnotada(reg, 1, { repsHechas: '8', weight: '97.5' });
assert.deepEqual([reg.weight, reg.repsHechas], ['120', '4'], 'el resumen es la vuelta más pesada, con sus reps');
assert.equal(vueltasAnotadas(reg, 4), 3);
assert.deepEqual(anotadoEnVuelta(reg, 1), { repsHechas: '8', weight: '97.5' });
assert.deepEqual(anotadoEnVuelta(reg, 2), {});
assert.deepEqual(anotadoEnVuelta(null, 0), {});
reg = conVueltaAnotada(reg, 3, { weight: '' });
assert.deepEqual([reg.weight, reg.repsHechas], ['97.5', '8'], 'al borrar la más pesada, manda la siguiente');
assert.equal(vueltasAnotadas(reg, 4), 3, 'la vuelta 4 sigue teniendo sus reps');
reg = conVueltaAnotada(reg, 3, { repsHechas: '' });
assert.equal(vueltasAnotadas(reg, 4), 2);
// Sin peso (peso corporal): la mejor cantidad.
assert.deepEqual(resumenDeVueltas({ 0: { repsHechas: '12' }, 1: { repsHechas: '15' }, 2: { repsHechas: '9' } }), { weight: '', repsHechas: '15' });
assert.deepEqual(resumenDeVueltas({}), { weight: '', repsHechas: '' });
assert.deepEqual(resumenDeVueltas(null), { weight: '', repsHechas: '' });
assert.deepEqual(resumenDeVueltas({ 0: { weight: '80', repsHechas: '5' }, 1: { weight: '80', repsHechas: '3' } }), { weight: '80', repsHechas: '5' }, 'con el mismo peso, la primera');
// Lo demás del registro no se toca.
assert.equal(conVueltaAnotada({ nota: 'x', vueltas: { 0: { weight: '50' } } }, 1, { weight: '60' }).nota, 'x');
// Y se guarda por partes: anotar la vuelta 2 no reenvía la 1 (la base mezcla llave por llave).
const antes = conVueltaAnotada({}, 0, { weight: '85', repsHechas: '10' });
const despues = conVueltaAnotada(antes, 1, { weight: '97.5', repsHechas: '8' });
const parche = diferencia({ ex: antes }, { ex: despues });
assert.deepEqual(parche, { ex: { vueltas: { 1: { weight: '97.5', repsHechas: '8' } }, weight: '97.5', repsHechas: '8' } });
assert.deepEqual(aplicarParche({ ex: antes }, parche), { ex: despues });

/* ---- «Por lado» ---- */
const lee = (reps, extra = {}) => leeCantidad({ reps, ...extra });
for (const texto of ['10/lado', '10 / lado', '10 por lado', '10 por cada lado', '10 c/lado', '10 cada lado', '10 x lado', '10 each side', '10/side', '10 per side', '10/lado.']) {
  assert.deepEqual(lee(texto), { cantidad: '10', unidad: 'reps', libre: false, porLado: true }, `«${texto}» son 10 por lado`);
}
assert.deepEqual(lee('8-10/lado'), { cantidad: '8-10', unidad: 'reps', libre: false, porLado: true });
assert.deepEqual(lee('30 seg/lado'), { cantidad: '30', unidad: 'seg', libre: false, porLado: true });
assert.deepEqual(lee('10/lado', { unidad: 'reps' }), { cantidad: '10', unidad: 'reps', libre: false, porLado: true }, 'también con la unidad ya puesta');
assert.deepEqual(lee('10', { porLado: true }), { cantidad: '10', unidad: 'reps', libre: false, porLado: true }, 'la casilla marcada');
assert.deepEqual(lee('10'), { cantidad: '10', unidad: 'reps', libre: false, porLado: false });
assert.deepEqual(lee('', { porLado: true }), { cantidad: '', unidad: 'reps', libre: false, porLado: true });
// Lo que no se entiende no se adivina…
assert.deepEqual(lee('máximas/lado'), { cantidad: 'máximas/lado', unidad: 'reps', libre: true, porLado: false });
assert.deepEqual(lee('10 por brazo'), { cantidad: '10 por brazo', unidad: 'reps', libre: true, porLado: false });
assert.deepEqual(lee('lado'), { cantidad: 'lado', unidad: 'reps', libre: true, porLado: false });
// …salvo que el coach lo haya marcado; y si lo desmarcó, el texto se queda tal cual.
assert.deepEqual(lee('máximas/lado', { porLado: true }), { cantidad: 'máximas', unidad: 'reps', libre: true, porLado: true });
assert.deepEqual(lee('10/lado', { porLado: false }), { cantidad: '10/lado', unidad: 'reps', libre: true, porLado: false });
assert.equal(textoMeta({ reps: '10/lado' }), '10 reps por lado');
assert.equal(textoMeta({ reps: '1', porLado: true }), '1 rep por lado');
assert.equal(textoMeta({ reps: '8-10', porLado: true }), '8-10 reps por lado');
assert.equal(textoMeta({ reps: '30', unidad: 'seg', porLado: true }), '30 seg por lado');
assert.equal(textoMeta({ reps: 'máximas', porLado: true }), 'máximas por lado');
assert.equal(textoMeta({ reps: '10' }), '10 reps', 'sin lado, igual que siempre');
assert.equal(textoMeta({ reps: '', porLado: true }), null);
assert.equal(metaEnSegundos({ reps: '30 seg/lado' }), 30, 'el cronómetro sigue sabiendo cuánto dura');

/* ---- El descanso como lista: segundos o minutos ---- */
assert.deepEqual(DESCANSOS.map((d) => d.id), ['seg', 'min']);
const descanso = (d) => leeDescanso({ descanso: d });
assert.deepEqual(descanso('2 min'), { unidad: 'min', cantidad: '2' });
assert.deepEqual(descanso('2min'), { unidad: 'min', cantidad: '2' });
assert.deepEqual(descanso('3 minutos'), { unidad: 'min', cantidad: '3' });
assert.deepEqual(descanso('1,5 min'), { unidad: 'min', cantidad: '1,5' });
assert.deepEqual(descanso("2'"), { unidad: 'min', cantidad: '2' });
assert.deepEqual(descanso('90 s'), { unidad: 'seg', cantidad: '90' });
assert.deepEqual(descanso('90 seg'), { unidad: 'seg', cantidad: '90' });
assert.deepEqual(descanso('60-90 s'), { unidad: 'seg', cantidad: '60-90' });
assert.deepEqual(descanso('60–90 segundos'), { unidad: 'seg', cantidad: '60-90' });
assert.deepEqual(descanso(''), { unidad: null, cantidad: '' });
assert.deepEqual(leeDescanso(null), { unidad: null, cantidad: '' });
for (const libre of ['3-4 min (completa)', 'Recuperación total', 'Recuperación completa', '90', '2 m', 'Completa · 2-3 min']) {
  assert.deepEqual(descanso(libre), { unidad: null, cantidad: libre }, `«${libre}» se queda como texto`);
}
assert.equal(componeDescanso('seg', '90'), '90 seg');
assert.equal(componeDescanso('min', '2'), '2 min');
assert.equal(componeDescanso('seg', '60-90'), '60-90 seg');
assert.equal(componeDescanso('min', ''), '');
assert.equal(componeDescanso(null, 'Recuperación total'), 'Recuperación total');
for (const [unidad, cantidad] of [['seg', '90'], ['seg', '60-90'], ['min', '2'], ['min', '1,5']]) {
  assert.deepEqual(descanso(componeDescanso(unidad, cantidad)), { unidad, cantidad }, `${cantidad} ${unidad}: ida y vuelta`);
}
// A medio escribir un rango, ni la unidad ni lo tecleado desaparecen.
assert.equal(unidadDeDescansoAlEscribir('60- seg'), 'seg');
assert.equal(cantidadDeDescanso('seg', '60- seg'), '60-');
assert.equal(unidadDeDescansoAlEscribir('2 min'), 'min');
assert.equal(cantidadDeDescanso('min', '2 min'), '2');
assert.equal(cantidadDeDescanso('seg', '90 s'), '90');
assert.equal(unidadDeDescansoAlEscribir('Recuperación total'), null);
assert.equal(unidadDeDescansoAlEscribir(''), null);
assert.equal(cantidadDeDescanso(null, 'Recuperación total'), 'Recuperación total');

/* ---- La carga a medio escribir conserva su tipo ---- */
assert.equal(tipoDeCargaAlEscribir('RPE 7-'), 'rpe');
assert.equal(tipoDeCargaAlEscribir('70-%'), 'pct');
assert.equal(tipoDeCargaAlEscribir('RIR 2'), 'rir');
assert.equal(tipoDeCargaAlEscribir('20 kg'), 'kg');
assert.equal(tipoDeCargaAlEscribir('RPE 8 / RIR 2'), null, 'un texto de verdad libre no se confunde');
assert.equal(tipoDeCargaAlEscribir('BW'), null);
assert.equal(tipoDeCargaAlEscribir(''), null);

console.log('prueba-por-vuelta: todo bien');
