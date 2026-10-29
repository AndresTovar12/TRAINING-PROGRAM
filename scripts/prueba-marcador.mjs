// Prueba del marcador del plan (29 oct 2026): qué pasa cuando `wr:cursor` ya no cabe en el plan, el sello del plan y el guardado entero.
//
//   node scripts/prueba-marcador.mjs
import assert from 'node:assert/strict';
import { reparaCursor, selloDelPlan, tieneSelloDe, cursorAlDia } from '../src/lib/training-utils.js';
import { diferencia, aplicarParche, BORRAR } from '../src/lib/estadoPorPartes.js';

const semanas = (desde, hasta) => Array.from({ length: hasta - desde + 1 }, (_, i) => ({ num: desde + i, days: [{ day: 'Lun' }, { day: 'Mié' }] }));
// Como el plan de Andrés: Recuperación, Adaptación, Hipertrofia, Fuerza, Potencia.
const plan = [
  { id: 'f1', weekData: semanas(1, 2) }, { id: 'f2', weekData: semanas(1, 3) }, { id: 'f3', weekData: semanas(1, 8) },
  { id: 'f4', weekData: semanas(1, 8) }, { id: 'f5', weekData: semanas(1, 7) },
];
const enFuerza = selloDelPlan(plan, { phaseId: 'f4', weekNum: 5, dayIdx: 1, fijadoEn: '2026-W44' });

/* ---- El sello ---- */
{
  assert.deepEqual(enFuerza.planFases, ['f1', 'f2', 'f3', 'f4', 'f5']);
  assert.equal(enFuerza.pos, 2 + 3 + 8 + 4, 'Fuerza semana 5 es la semana 18 del plan (posición 17)');
  assert.ok(tieneSelloDe(plan, enFuerza));
  assert.ok(!tieneSelloDe(plan, { phaseId: 'f4', weekNum: 5 }), 'un marcador viejo no trae sello: se vuelve a guardar una vez');
}

/* ---- El marcador sirve: no se toca ---- */
{
  const r = reparaCursor(plan, enFuerza);
  assert.equal(r.motivo, null);
  assert.equal(r.cursor, enFuerza);
}

/* ---- No había marcador: el principio (o donde dejó la compra) ---- */
{
  assert.deepEqual(reparaCursor(plan, null), { cursor: { phaseId: 'f1', weekNum: 1, dayIdx: 0 }, motivo: 'nuevo' });
  const compra = { phaseId: 'f3', weekNum: 1, dayIdx: 0, fijadoEn: '2026-W40' };
  assert.equal(reparaCursor(plan, null, { base: compra }).cursor, compra);
  assert.deepEqual(reparaCursor([], enFuerza), { cursor: null, motivo: null }, 'sin plan cargado no se decide nada');
}

/* ---- Mismo plan, el coach borró las semanas 5 a 8 de Fuerza: la semana más cercana, no «Semana 1» ---- */
{
  const editado = plan.map((f) => (f.id === 'f4' ? { ...f, weekData: semanas(1, 4) } : f));
  const r = reparaCursor(editado, enFuerza);
  assert.equal(r.motivo, 'reparado');
  assert.equal(r.cursor.phaseId, 'f4');
  assert.equal(r.cursor.weekNum, 4);
  assert.equal(r.cursor.fijadoEn, '2026-W44', 'sigue avanzando desde el mismo sello');
  assert.equal(r.cursor.dayIdx, 1);
}

/* ---- Mismo plan, el coach borró la fase entera: la misma posición del plan ---- */
{
  const sinFuerza = plan.filter((f) => f.id !== 'f4');
  const r = reparaCursor(sinFuerza, enFuerza);
  assert.equal(r.motivo, 'reparado');
  assert.equal(r.cursor.phaseId, 'f5', 'la semana 18 del plan ahora cae en Potencia');
  assert.equal(r.cursor.weekNum, 5);
  // Y si el plan quedó más corto que donde iba: la última semana.
  const corto = [plan[0], plan[1], plan[2]];
  const r2 = reparaCursor(corto, enFuerza);
  assert.equal(r2.cursor.phaseId, 'f3');
  assert.equal(r2.cursor.weekNum, 8);
}

/* ---- Plan nuevo (el coach asignó otro: ids de fase nuevos): el principio, y se avisa ---- */
{
  const nuevo = [{ id: 'p-a1', weekData: semanas(1, 4) }, { id: 'p-b2', weekData: semanas(1, 4) }];
  const r = reparaCursor(nuevo, enFuerza);
  assert.equal(r.motivo, 'plan-nuevo');
  assert.deepEqual(r.cursor, { phaseId: 'p-a1', weekNum: 1, dayIdx: 0 });
}

/* ---- Marcador viejo, sin sello ---- */
{
  const viejo = { phaseId: 'f4', weekNum: 9, dayIdx: 0, fijadoEn: '2026-W44' };
  const r = reparaCursor(plan, viejo);
  assert.equal(r.motivo, 'reparado', 'su fase sigue: se queda en esa fase');
  assert.equal(r.cursor.weekNum, 8);
  const r2 = reparaCursor(plan, { phaseId: 'zz', weekNum: 1, dayIdx: 0 });
  assert.equal(r2.motivo, 'plan-nuevo', 'su fase ya no está y no se sabe de qué plan era: como antes, al principio');
}

/* ---- La pausa y el aviso del coach se quedan al reparar ---- */
{
  const conPausa = { ...enFuerza, pausa: '2026-10-20', aviso: { id: 'a', texto: 'Tu coach pausó tu plan' } };
  const editado = plan.map((f) => (f.id === 'f4' ? { ...f, weekData: semanas(1, 4) } : f));
  const r = reparaCursor(editado, conPausa);
  assert.equal(r.cursor.pausa, '2026-10-20');
  assert.equal(r.cursor.aviso.texto, 'Tu coach pausó tu plan');
  assert.equal(r.cursor.planFases, undefined, 'el sello viejo se quita: se vuelve a sellar con el plan de ahora');
}

/* ---- El calendario sigue avanzando con un marcador sellado ---- */
{
  const unaSemanaDespues = cursorAlDia(plan, enFuerza, new Date('2026-11-04T12:00:00'));
  assert.equal(unaSemanaDespues.phaseId, 'f4');
  assert.equal(unaSemanaDespues.weekNum, 6);
}

/* ---- El marcador se guarda ENTERO, nunca por pedazos ---- */
{
  const antes = { 'wr:cursor': { phaseId: 'f4', weekNum: 5, dayIdx: 1, fijadoEn: '2026-W44', pausa: '2026-10-20' }, 'wr:sessions': { a: { completed: true } } };
  const despues = { 'wr:cursor': { phaseId: 'f4', weekNum: 6, dayIdx: 1, fijadoEn: '2026-W45' }, 'wr:sessions': { a: { completed: true }, b: { completed: true } } };
  const p = diferencia(antes, despues);
  assert.deepEqual(p['wr:cursor'], { phaseId: 'f4', weekNum: 6, dayIdx: 1, fijadoEn: '2026-W45', pausa: BORRAR }, 'completo, y lo que dejó de tener va con BORRAR');
  assert.deepEqual(p['wr:sessions'], { b: { completed: true } }, 'lo demás sigue yendo por pedazos');
  // Aunque la base tenga otro marcador (otro aparato lo cambió), el resultado nunca es mitad y mitad.
  const enLaBase = { 'wr:cursor': { phaseId: 'f1', weekNum: 1, dayIdx: 0, fijadoEn: '2026-W44' } };
  const r = aplicarParche(enLaBase, p);
  assert.deepEqual(r['wr:cursor'], { phaseId: 'f4', weekNum: 6, dayIdx: 1, fijadoEn: '2026-W45' });
  // Y los marcadores de otros programas también van enteros.
  const q = diferencia({ 'wr:cursor@abc': { phaseId: 'p1', weekNum: 1 } }, { 'wr:cursor@abc': { phaseId: 'p1', weekNum: 2 } });
  assert.deepEqual(q, { 'wr:cursor@abc': { phaseId: 'p1', weekNum: 2 } });
  assert.equal(diferencia({ 'wr:cursor': { a: 1 } }, { 'wr:cursor': { a: 1 } }), undefined, 'sin cambio no se manda nada');
}

console.log('prueba-marcador: todo bien');
