/* Pruebas de «en qué semana entra quien compra»: `node scripts/prueba-entrada.mjs`. Un programa inventado, sin red. */
import assert from 'node:assert/strict';
import {
  totalDeSemanas, posicionDeCorrido, entradaDeCorrido, primeraEntrada, semanasDeMeses, semanasHastaFecha, semanaSugerida, resumenDeEntrada,
} from '../src/lib/entradaAlPlan.js';

const sem = (n) => Array.from({ length: n }, (_, i) => ({ num: i + 1 }));
// Tres fases: 4 + 6 + 2 semanas = 12.
const fases = [{ id: 'a', weekData: sem(4) }, { id: 'b', weekData: sem(6) }, { id: 'c', weekData: sem(2) }];

assert.equal(totalDeSemanas(fases), 12);
assert.equal(totalDeSemanas([]), 0);
assert.equal(totalDeSemanas(null), 0);

/* ---- De la fase y la semana al número de corrido, y de vuelta ---- */
assert.equal(posicionDeCorrido(fases, 'a', 1), 1);
assert.equal(posicionDeCorrido(fases, 'b', 1), 5, 'la primera de la fase 2 es la 5 de corrido');
assert.equal(posicionDeCorrido(fases, 'b', 3), 7, 'a la mitad de una fase');
assert.equal(posicionDeCorrido(fases, 'c', 2), 12);
assert.equal(posicionDeCorrido(fases, 'zzz', 1), 0, 'una fase que no existe');
assert.equal(posicionDeCorrido(fases, 'b', 99), 0, 'una semana que no existe');
for (let n = 1; n <= 12; n += 1) {
  const e = entradaDeCorrido(fases, n);
  assert.equal(posicionDeCorrido(fases, e.faseId, e.semana), n, `ida y vuelta de la semana ${n}`);
}
assert.deepEqual(entradaDeCorrido(fases, 7), { faseId: 'b', semana: 3 });
assert.deepEqual(entradaDeCorrido(fases, 0), { faseId: 'a', semana: 1 }, 'menos de 1 es la primera');
assert.deepEqual(entradaDeCorrido(fases, 99), { faseId: 'c', semana: 2 }, 'más del total es la última');
assert.equal(entradaDeCorrido([], 3), null);
assert.deepEqual(primeraEntrada(fases), { faseId: 'a', semana: 1 });

/* ---- Una fase cuyas semanas no empiezan en 1 (por ejemplo, un plan comprado ya recortado) ---- */
const recortadas = [{ id: 'x', weekData: [{ num: 5 }, { num: 6 }] }];
assert.deepEqual(entradaDeCorrido(recortadas, 2), { faseId: 'x', semana: 6 });
assert.equal(posicionDeCorrido(recortadas, 'x', 6), 2);

/* ---- Cuánto tiempo tiene ---- */
assert.equal(semanasDeMeses(6), 24);
assert.equal(semanasDeMeses('x'), 0);
assert.equal(semanasHastaFecha('2026-11-08', new Date('2026-10-11T15:00:00Z')), 4, '28 días = 4 semanas');
assert.equal(semanasHastaFecha('2026-11-09', new Date('2026-10-11T15:00:00Z')), 5, '29 días: la semana que falta cuenta');
assert.equal(semanasHastaFecha('2026-10-01', new Date('2026-10-11T15:00:00Z')), 0, 'una fecha pasada no da tiempo');
assert.equal(semanasHastaFecha('no es fecha', new Date()), 0);

/* ---- Dónde le conviene entrar: que el programa termine cuando se le acaba el tiempo ---- */
assert.equal(semanaSugerida(48, 24), 25, 'un programa de 12 meses y 6 meses de tiempo: entra a la mitad');
assert.equal(semanaSugerida(48, 4), 45, 'con un mes: las últimas 4 semanas');
assert.equal(semanaSugerida(48, 60), 1, 'si le sobra tiempo, desde el principio');
assert.equal(semanaSugerida(48, 48), 1);
assert.equal(semanaSugerida(48, 0), 1, 'sin tiempo dicho, desde el principio');
assert.equal(semanaSugerida(0, 10), 1);

/* ---- Lo que se le dice al elegir ---- */
assert.deepEqual(resumenDeEntrada(fases, 'b', 3), { semana: 7, total: 12, restantes: 6, mes: 2, meses: 3, desdeElPrincipio: false });
assert.deepEqual(resumenDeEntrada(fases, 'a', 1), { semana: 1, total: 12, restantes: 12, mes: 1, meses: 3, desdeElPrincipio: true });
const anual = [{ id: 'p', weekData: sem(48) }];
assert.deepEqual(resumenDeEntrada(anual, 'p', 25), { semana: 25, total: 48, restantes: 24, mes: 7, meses: 12, desdeElPrincipio: false }, '«mes 7 de 12»');
assert.equal(resumenDeEntrada(fases, 'zzz', 1), null);

console.log('✓ entrada al plan: todo bien');
