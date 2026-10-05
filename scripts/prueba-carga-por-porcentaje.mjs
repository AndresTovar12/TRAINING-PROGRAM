// Prueba de los kilos que son un porcentaje del 1RM (src/lib/cargaPorcentaje.js): a qué
// levantamiento corresponde un ejercicio, cómo se lee «70-75%» y cuántos kilos o libras son.
//
//   node scripts/prueba-carga-por-porcentaje.mjs
import assert from 'node:assert/strict';
import { LEVANTAMIENTOS, levantamientoDe, porcentajeDe, cargaDe, cargaPorPorcentaje } from '../src/lib/cargaPorcentaje.js';

/* ---- Cuáles son los 9 de la pestaña 1RM (las llaves que ya guarda `wr:onerm`) ---- */
assert.deepEqual(LEVANTAMIENTOS.map((l) => l.key), [
  'back_squat', 'front_squat', 'bench_press', 'incline_bench', 'trap_bar_dl', 'deadlift', 'overhead_press', 'row', 'hang_clean',
]);

/* ---- Un ejercicio ES el levantamiento, o no es nada: las variantes no se adivinan ---- */
const es = (name) => levantamientoDe({ name })?.key ?? null;
// Los del repertorio que de verdad son un levantamiento.
assert.equal(es('Back Squat'), 'back_squat');
assert.equal(es('Front Squat'), 'front_squat');
assert.equal(es('Bench Press'), 'bench_press');
assert.equal(es('Incline Bench Press'), 'incline_bench');
assert.equal(es('Hexbar deadlift'), 'trap_bar_dl', 'la barra hexagonal es la trap bar');
assert.equal(es('RDL'), 'deadlift');
assert.equal(es('Barbell Shoulder Press'), 'overhead_press');
assert.equal(es('Hang Clean'), 'hang_clean');
// En español, con acentos y mayúsculas de cualquier manera.
assert.equal(es('Sentadilla'), 'back_squat');
assert.equal(es('  SENTADILLA   frontal '), 'front_squat');
assert.equal(es('Press de banca'), 'bench_press');
assert.equal(es('Peso muerto'), 'deadlift');
assert.equal(es('Press militar'), 'overhead_press');
assert.equal(es('Remo con barra'), 'row');
assert.equal(es('Barbell Row'), 'row');
// Las variantes y lo que solo CONTIENE la palabra: nada. Con la regla vieja, todo esto daba una cifra.
for (const variante of [
  'Goblet Squat', 'Bulgarian Split Squat', 'Box Squat', 'Hack Squat', 'Sissy Squat', 'Assisted Pistol Squat', 'Hang Squat Clean',
  'Dumbbell Bench Press', 'Incline Dumbbell Bench Press', 'Close Grip Bench Press', 'Eccentric Bench Press 3-0-0',
  'Dumbbell Shoulder Press', 'Push Press', 'Power Clean', 'T-Bar Row', 'Inverted Row', 'One Arm Dumbbell Row', 'Gorilla Row',
  'Pallof Press', 'Press de Pecho en Máquina', 'Tricep Copa (Overhead Extension)', 'Seated Overhead Band Crunch',
  'Rotational Med Ball Throw', 'Single-Leg Hurdle Hops to Box', 'Back Squat (goblet)', 'Sentadilla búlgara', 'Sentadilla con mancuerna',
]) {
  assert.equal(es(variante), null, `${variante} no es un levantamiento del 1RM`);
}
assert.equal(levantamientoDe(null), null);
assert.equal(levantamientoDe({ isNote: true, name: 'Back Squat' }), null);
assert.equal(levantamientoDe({}), null);

/* ---- Leer el porcentaje de la intensidad ---- */
assert.deepEqual(porcentajeDe('75%'), { min: 75, max: 75 });
assert.deepEqual(porcentajeDe('75 %'), { min: 75, max: 75 });
assert.deepEqual(porcentajeDe('70-75%'), { min: 70, max: 75 });
assert.deepEqual(porcentajeDe('70–75 %'), { min: 70, max: 75 });
assert.deepEqual(porcentajeDe('70 a 75%'), { min: 70, max: 75 });
assert.deepEqual(porcentajeDe('75-70%'), { min: 70, max: 75 }, 'un rango al revés se acomoda');
assert.deepEqual(porcentajeDe('70% / RPE 8'), { min: 70, max: 70 }, 'el placeholder del editor');
assert.deepEqual(porcentajeDe('8-10 reps @ 75%'), { min: 75, max: 75 }, 'el rango de reps no es un porcentaje');
assert.deepEqual(porcentajeDe('82,5%'), { min: 82.5, max: 82.5 });
assert.deepEqual(porcentajeDe('80% 1RM'), { min: 80, max: 80 });
for (const nada of ['', 'RPE 8', 'BW', 'Máximo', '0%', '200%', '60-200%', '% del 1RM', null, undefined, 70]) {
  assert.equal(porcentajeDe(nada), null, `«${nada}» no trae un porcentaje que se entienda`);
}

/* ---- Cuánto es: en la unidad del atleta y a lo que se puede cargar ---- */
assert.equal(cargaDe(140, 75, 'kg'), 105);
assert.equal(cargaDe(143, 75, 'kg'), 107.5, 'de 2.5 en 2.5 kg');
assert.equal(cargaDe(142, 75, 'kg'), 107.5, '106.5 → 107.5, el disco más cercano');
assert.equal(cargaDe(140, 75, 'lb'), 230, '140 kg son 308.6 lb; 75% = 231.5 → de 5 en 5 lb');
assert.equal(cargaDe(100, 85, undefined), 85, 'sin unidad, kilos');

/* ---- Todo junto ---- */
const unos = { back_squat: 140, bench_press: 100 };
const a = cargaPorPorcentaje({ name: 'Back Squat', intensity: '75%' }, unos, 'kg');
assert.equal(a.falta, false);
assert.equal(a.texto, '≈ 105 kg');
assert.equal(a.lift.key, 'back_squat');
assert.equal(cargaPorPorcentaje({ name: 'Back Squat', intensity: '70-75%' }, unos, 'kg').texto, '≈ 97.5–105 kg');
assert.equal(cargaPorPorcentaje({ name: 'Bench Press', intensity: '80%' }, unos, 'lb').texto, '≈ 175 lb', '100 kg = 220.5 lb; 80% = 176.4 → 175 lb');
assert.equal(cargaPorPorcentaje({ name: 'Bench Press', intensity: '74-75%' }, unos, 'kg').texto, '≈ 75 kg', 'si el rango cae en el mismo disco, un solo número');
// Es un levantamiento pero no ha anotado su 1RM: se sabe cuál falta.
const falta = cargaPorPorcentaje({ name: 'Front Squat', intensity: '80%' }, unos, 'kg');
assert.equal(falta.falta, true);
assert.equal(falta.lift.nombre, 'Front Squat');
assert.equal(cargaPorPorcentaje({ name: 'Front Squat', intensity: '80%' }, { front_squat: 0 }, 'kg').falta, true, 'un 0 no es un 1RM');
assert.equal(cargaPorPorcentaje({ name: 'Front Squat', intensity: '80%' }, { front_squat: null }, 'kg').falta, true);
assert.equal(cargaPorPorcentaje({ name: 'Front Squat', intensity: '80%' }, undefined, 'kg').falta, true);
// Lo que no aplica no dice nada.
assert.equal(cargaPorPorcentaje({ name: 'Goblet Squat', intensity: '75%' }, unos, 'kg'), null, 'una variante no inventa kilos');
assert.equal(cargaPorPorcentaje({ name: 'Back Squat', intensity: 'RPE 8' }, unos, 'kg'), null);
assert.equal(cargaPorPorcentaje({ name: 'Back Squat' }, unos, 'kg'), null);
assert.equal(cargaPorPorcentaje(null, unos, 'kg'), null);

console.log('prueba-carga-por-porcentaje: todo bien');
