/* Pruebas de «en qué semana entra quien compra»: `node scripts/prueba-entrada.mjs`. Un programa inventado, sin red. */
import assert from 'node:assert/strict';
import {
  totalDeSemanas, posicionDeCorrido, semanasPermitidas, limpiaSemanasElegidas, modosPosibles, tieneEntrada, opcionesDeInicio, diaCorto, diaLargo, finDelPlan, rangoDeFechaMeta, entradaParaFecha, entradaDeCorrido, primeraEntrada, semanasDeMeses, semanasHastaFecha, semanaSugerida, resumenDeEntrada,
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
// Se cuenta desde el día de inicio ELEGIDO (26 nov 2026), en semanas completas de lunes a domingo; la semana del inicio cuenta entera.
assert.equal(semanasHastaFecha('2027-02-21', '2026-11-30'), 12, 'del lunes 30 de nov al domingo 21 de feb: 12 semanas');
assert.equal(semanasHastaFecha('2027-02-20', '2026-11-30'), 11, 'un día antes del domingo: esa semana no cabe completa');
assert.equal(semanasHastaFecha('2027-02-21', '2026-11-24'), 13, 'empezar hoy martes 24 da una semana más que empezar el lunes 30');
assert.equal(semanasHastaFecha('2026-10-01', '2026-11-30'), 0, 'una fecha pasada no da tiempo');
assert.equal(semanasHastaFecha('no es fecha', '2026-11-30'), 0);

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

{
  const doce = [{ id: 'a', weekData: [{ num: 1 }, { num: 2 }, { num: 3 }, { num: 4 }] }, { id: 'b', weekData: [{ num: 1 }, { num: 2 }, { num: 3 }, { num: 4 }] }, { id: 'c', weekData: [{ num: 1 }, { num: 2 }, { num: 3 }, { num: 4 }] }];
  // Dónde puede empezar (lo elige el coach).
  assert.deepEqual(semanasPermitidas(doce, { modo: 'semana_1' }), [1]);
  assert.deepEqual(semanasPermitidas(doce, { modo: 'fases' }), [1, 5, 9], 'al inicio de cada fase');
  assert.equal(semanasPermitidas(doce, { modo: 'cualquiera' }).length, 12);
  assert.deepEqual(semanasPermitidas(doce, { modo: 'elegidas', semanas: [7, 3, 3, 40, 0, 'x'] }), [1, 3, 7], 'la 1 siempre; sin repetidas ni semanas que no existen');
  assert.deepEqual(limpiaSemanasElegidas([1, 5, 9, 11], 8), [1, 5], 'el coach quitó semanas: las que ya no existen se van solas');
  assert.deepEqual(modosPosibles([doce[0]]).map((m) => m.valor), ['semana_1', 'cualquiera', 'elegidas'], 'una sola fase: sin «al inicio de cada fase»');
  assert.equal(modosPosibles(doce).length, 4);
  // Cuándo NO hay entrada.
  assert.equal(tieneEntrada({ fases: doce }), true);
  assert.equal(tieneEntrada({ fases: [{ id: 'x', weekData: [{ num: 1 }] }] }), false, 'plan de 1 semana');
  assert.equal(tieneEntrada({ fases: doce, kind: 'weekly' }), false, 'rutina semanal que se repite');
  assert.equal(tieneEntrada({ fases: doce, contenido: 'clase' }), false);
  assert.equal(tieneEntrada({ fases: doce, contenido: 'workout' }), false);
  // ¿Cuándo empiezas?
  assert.deepEqual(opcionesDeInicio('2026-11-24').map((o) => [o.tipo, o.fecha, o.porDefecto]), [['hoy', '2026-11-24', false], ['lunes', '2026-11-30', true]], 'hoy martes 24 o el lunes 30 (marcado)');
  assert.deepEqual(opcionesDeInicio('2026-11-30').map((o) => o.tipo), ['hoy'], 'si hoy es lunes, solo hoy');
  assert.equal(diaCorto('2026-11-24'), 'martes 24');
  assert.equal(diaLargo('2026-11-30'), 'lunes 30 de noviembre');
  assert.equal(finDelPlan('2026-11-30', 12), '2027-02-21', 'Terminas el domingo 21 de febrero');
  assert.equal(finDelPlan('2026-11-24', 12), '2027-02-14', 'empezando hoy martes, la semana 1 es esta');
  assert.equal(finDelPlan('2026-11-30', 12, 6), '2027-01-17', 'entrando en la semana 6 son 7 semanas');
  assert.deepEqual(rangoDeFechaMeta('2026-11-30', 12), { desde: '2026-12-07', hasta: '2027-02-21' }, 'de una semana después del inicio al final normal');
  // Necesito terminar antes.
  const todas = semanasPermitidas(doce, { modo: 'cualquiera' });
  assert.deepEqual(entradaParaFecha({ total: 12, permitidas: todas, inicio: '2026-11-30', fecha: '2027-01-17' }), { semana: 6, saltadas: 5, total: 12, alcanza: true }, 'Entras en la semana 6 de 12');
  assert.equal(entradaParaFecha({ total: 12, permitidas: todas, inicio: '2026-11-24', fecha: '2027-01-17' }).semana, 5, 'cuenta desde el inicio elegido, no desde hoy');
  assert.equal(entradaParaFecha({ total: 12, permitidas: [1, 5, 9], inicio: '2026-11-30', fecha: '2027-01-17' }).semana, 9, 'solo semanas permitidas: la más temprana que alcanza');
  assert.deepEqual(entradaParaFecha({ total: 12, permitidas: [1, 5], inicio: '2026-11-30', fecha: '2026-12-13' }), { semana: 5, saltadas: 4, total: 12, alcanza: false }, 'ninguna alcanza: la permitida más cercana a su fecha');
  assert.equal(entradaParaFecha({ total: 12, permitidas: todas, inicio: '2026-11-30', fecha: '2027-02-21' }).semana, 1, 'su fecha es el final normal: semana 1');
}
console.log('✓ entrada al plan: todo bien');
