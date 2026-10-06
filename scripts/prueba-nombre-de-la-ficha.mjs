// Prueba de la regla «una línea ligada a una ficha se llama como su ficha» (src/lib/nombreDeLaFicha.js).
//
//   node scripts/prueba-nombre-de-la-ficha.mjs
import assert from 'node:assert/strict';
import { conNombreDeSuFicha, fichaDeLista } from '../src/lib/nombreDeLaFicha.js';

const fichas = [
  { id: 'f-hex', name: 'Hexbar deadlift' },
  { id: 'f-back', name: 'Back Squat' },
];
const fichaDe = fichaDeLista(fichas);

const plan = [{
  id: 'f1',
  weekData: [{
    num: 1,
    days: [
      { day: 'Lun', exercises: [
        { name: 'Trap bar deadlift', exercise_id: 'f-hex', sets: '3' },       // ligada, con otro nombre → se renombra
        { name: 'Back Squat', exercise_id: 'f-back' },                         // ya se llama igual → la misma línea
        { name: 'Calentamiento', sets: '1' },                                   // sin ficha → se queda
        { name: 'Algo', exercise_id: 'f-borrada' },                             // ficha que ya no existe → se queda
        { isNote: true, text: 'Nota', exercise_id: 'f-hex' },                   // una nota nunca se renombra
      ] },
      { day: 'Mar', exercises: [{ name: 'Back Squat', exercise_id: 'f-back' }] }, // nada cambia → el mismo día
      { day: 'Mié', notes: ['Descanso'] },                                       // un día sin lista de ejercicios no se rompe
    ],
  }],
}];
const copia = JSON.parse(JSON.stringify(plan));

const nuevo = conNombreDeSuFicha(plan, fichaDe);
const lun = nuevo[0].weekData[0].days[0].exercises;
assert.equal(lun[0].name, 'Hexbar deadlift', 'una línea ligada se llama como su ficha');
assert.equal(lun[0].sets, '3', 'lo demás de la línea no se toca');
assert.equal(lun[0].exercise_id, 'f-hex');
assert.equal(lun[1], plan[0].weekData[0].days[0].exercises[1], 'si ya se llama igual, es la misma línea (sin objeto nuevo)');
assert.equal(lun[2].name, 'Calentamiento', 'sin ficha, se queda como estaba');
assert.equal(lun[3].name, 'Algo', 'con una ficha que ya no existe, se queda como estaba');
assert.equal(lun[4].text, 'Nota');
assert.equal('name' in lun[4], false, 'una nota no recibe nombre');
assert.equal(nuevo[0].weekData[0].days[1], plan[0].weekData[0].days[1], 'un día sin cambios es el mismo objeto');
assert.equal(nuevo[0].weekData[0].days[2], plan[0].weekData[0].days[2], 'un día sin ejercicios no se rompe');
assert.deepEqual(plan, copia, 'no toca el plan que recibe');

// Nada que renombrar → devuelve el mismo plan, sin un solo objeto nuevo.
const igual = [{ id: 'f1', weekData: [{ num: 1, days: [{ day: 'Lun', exercises: [{ name: 'Back Squat', exercise_id: 'f-back' }] }] }] }];
assert.equal(conNombreDeSuFicha(igual, fichaDe), igual);

// Entradas raras.
assert.equal(conNombreDeSuFicha(null, fichaDe), null);
assert.equal(conNombreDeSuFicha(plan, null), plan, 'sin cómo buscar la ficha, no hace nada');
assert.equal(fichaDeLista(undefined)({ exercise_id: 'x' }), null);
assert.equal(fichaDe({ name: 'Back Squat' }), null, 'la ficha se busca por exercise_id, nunca por nombre');

console.log('✓ nombre de la ficha: renombra lo ligado, respeta lo demás y no toca el plan');
