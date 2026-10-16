/* La semana del atleta vista por el coach (ficha): `node scripts/prueba-semana-del-atleta.mjs`. */
import assert from 'node:assert/strict';
import { semanaDelAtleta, sessionIdFor, isoWeekKey } from '../src/lib/training-utils.js';

const dia = (d, name, cat = 'gym') => ({ day: d, name, cat });
const plan = [{
  id: 'f1', name: 'Base',
  weekData: [1, 2].map((num) => ({ num, days: [dia('Lun', 'Upper A'), dia('Mar', 'Lower A'), dia('Mié', 'Descanso', 'off'), dia('Jue', 'Upper B'), dia('Vie', 'Lower B'), dia('Vie', 'Core')] })),
}];
const hoy = new Date(2026, 9, 16, 10); // viernes 16 oct 2026
const puntero = { phaseId: 'f1', weekNum: 2, dayIdx: 0, fijadoEn: isoWeekKey(hoy) };
const id = (dayIdx) => sessionIdFor('periodized', 'f1', 2, dayIdx);
const sesiones = { [id(0)]: { completed: true }, [id(3)]: { completed: true }, [id(4)]: { completed: true } };

const r = semanaDelAtleta(plan, 'periodized', puntero, sesiones, hoy);
assert.equal(r.semana.num, 2);
assert.deepEqual(r.dias.map((d) => d.estado), ['hecha', 'saltada', 'descanso', 'hecha', 'hoy', 'nada', 'nada']);
assert.equal(r.dias[4].nombre, 'Lower B + Core');
assert.equal(r.dias[4].sesiones, 2);
assert.equal(r.hechas, 3);
assert.equal(r.tocan, 5);
assert.equal(r.saltadas, 1);
// Hoy con las dos marcadas: «hecha».
const r2 = semanaDelAtleta(plan, 'periodized', puntero, { ...sesiones, [id(5)]: { completed: true } }, hoy);
assert.equal(r2.dias[4].estado, 'hecha');
// Sin plan: nada.
assert.equal(semanaDelAtleta([], 'periodized', null, {}, hoy), null);
console.log('prueba-semana-del-atleta: todo bien');
