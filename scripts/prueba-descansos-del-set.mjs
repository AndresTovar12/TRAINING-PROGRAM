/* Los tres descansos de un Set (entre ejercicios, entre vueltas, después del Set) y lo que hace el modo entreno con ellos: `node scripts/prueba-descansos-del-set.mjs`.
   El editor los escribe en los campos de siempre (`descanso` y `descansoSet`); aquí se comprueba que ESO es lo que el atleta recibe. */
import assert from 'node:assert/strict';
import { pasosDeLaSesion } from '../src/lib/entreno.js';

// Las dos reglas del editor (un descanso común a varios ejercicios, y si el Set se repite), escritas aquí para fijarlas.
const texto = (x) => String(x ?? '').trim();
const descansoComun = (m) => { const d = m.map((x) => texto(x.descanso)); return d.every((v) => v === d[0]) ? (d[0] ?? '') : null; };
const seRepite = (r) => { const n = texto(r).match(/\d+/g); return !!n && Math.max(...n.map(Number)) > 1; };
assert.equal(descansoComun([{ descanso: '30 seg' }, { descanso: '30 seg' }]), '30 seg');
assert.equal(descansoComun([{ descanso: '30 seg' }, { descanso: '' }]), null);
assert.equal(descansoComun([]), '');
assert.equal(seRepite('3'), true); assert.equal(seRepite('4-6'), true); assert.equal(seRepite('1'), false); assert.equal(seRepite(null), false);

const ex = (name, extra) => ({ name, sets: '3', reps: '10', set: 1, ...extra });
const dia = {
  day: 'Lun', cat: 'gym', name: 'S',
  exercises: [
    ex('A', { descanso: '' }), ex('B', { descanso: '' }), ex('C', { descanso: '1 min', descansoSet: '2 min' }),
    { name: 'D', sets: '3', reps: '10', set: 2 },
  ],
};
const { pasos } = pasosDeLaSesion(dia);
const orden = pasos.map((p) => (p.tipo === 'descanso' ? `d${p.seg}` : p.nombre));
// Entre A y B y entre B y C no hay descanso; tras C de las vueltas 1 y 2, 60 s (entre vueltas); tras C de la vuelta 3, 120 s (después del Set).
assert.deepEqual(orden, ['A', 'B', 'C', 'd60', 'A', 'B', 'C', 'd60', 'A', 'B', 'C', 'd120', 'D', 'D', 'D'], orden.join(' '));
console.log('prueba-descansos-del-set: todo bien');
