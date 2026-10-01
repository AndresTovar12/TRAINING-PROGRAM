// Prueba de la lógica pura de las sesiones pegadas (src/lib/pegadas.js): reparto de
// «Repetir», alcance, saltar semanas, huérfanas y llaves estables de lo que anota el atleta.
//
//   node scripts/prueba-pegadas.mjs
import assert from 'node:assert/strict';
import {
  semanasDelPrograma, indicesDeLaRegla, fasesConPegadas, adaptadorDeRegistros, cuantoOcupa, esHuerfana,
  textoDeCuantoOcupa, nuevaRegla,
} from '../src/lib/pegadas.js';

const semana = (num) => ({ num, days: [{ day: 'Lun', name: 'Fuerza' }] });
const fases = [
  { id: 'f1', num: 1, name: 'Base', weekData: [semana(1), semana(2), semana(3)] },
  { id: 'f2', num: 2, name: 'Fuerza', weekData: [semana(1), semana(2)] },
];
const lista = semanasDelPrograma(fases);
assert.equal(lista.length, 5);

const sesion = { name: 'Estiramientos', cat: 'gym', exercises: [{ name: 'Estirar' }] };
const base = (alcance, extra = {}) => ({ id: 'r1', nombre: 'Estiramientos', sesion, dias: ['Vie', 'Lun', 'Mié'], alcance, omitir: [], ...extra });

// «todo» desde la semana 2 de la fase 1 hasta el final: 4 semanas
let r = base({ tipo: 'todo', desde: { faseId: 'f1', semana: 2, n: 1 } });
assert.deepEqual(indicesDeLaRegla(r, lista), [1, 2, 3, 4]);
assert.deepEqual(cuantoOcupa(r, fases), { semanas: 4, porSemana: 3, dias: 12 });
assert.equal(textoDeCuantoOcupa(r, fases), 'Se pondrá en 12 días (4 semanas × 3).');

// Si el coach ALARGA el programa, «todo» llega también a la semana nueva
const alargado = [fases[0], { ...fases[1], weekData: [...fases[1].weekData, semana(3)] }];
assert.deepEqual(indicesDeLaRegla(r, semanasDelPrograma(alargado)), [1, 2, 3, 4, 5]);

// «solo en estas fases»
r = base({ tipo: 'fases', fases: ['f2'] });
assert.deepEqual(indicesDeLaRegla(r, lista), [3, 4]);

// «hasta» (inclusive) y «solo este día»
r = base({ tipo: 'hasta', desde: { faseId: 'f1', semana: 1, n: 0 }, hasta: { faseId: 'f1', semana: 3, n: 2 } });
assert.deepEqual(indicesDeLaRegla(r, lista), [0, 1, 2]);
r = base({ tipo: 'dia', desde: { faseId: 'f2', semana: 1, n: 3 } });
assert.deepEqual(indicesDeLaRegla(r, lista), [3]);

// Saltar una semana
r = base({ tipo: 'todo', desde: { faseId: 'f1', semana: 1, n: 0 } }, { omitir: [{ faseId: 'f1', semana: 2 }] });
assert.deepEqual(indicesDeLaRegla(r, lista), [0, 2, 3, 4]);

// El coach borra la fase del ancla: se usa la posición de respaldo (n) y no se pierde
r = base({ tipo: 'todo', desde: { faseId: 'f9', semana: 1, n: 3 } });
assert.deepEqual(indicesDeLaRegla(r, lista), [3, 4]);
// «solo este día» sin su semana: queda huérfana
r = base({ tipo: 'dia', desde: { faseId: 'f9', semana: 1, n: 3 } });
assert.equal(esHuerfana(r, fases), true);

// Reparto en días: la semana trae los tres días, en orden de calendario, con su llave estable
r = base({ tipo: 'todo', desde: { faseId: 'f1', semana: 1, n: 0 } });
const virtual = fasesConPegadas([r], fases, { autorId: 'fisio' });
const dias1 = virtual[0].weekData[0].days;
assert.deepEqual(dias1.map((d) => d.day), ['Lun', 'Mié', 'Vie']);
assert.deepEqual(dias1.map((d) => d.sid), ['r1-Lun', 'r1-Mié', 'r1-Vie']);
assert.equal(dias1[0].name, 'Estiramientos');
assert.equal(virtual[1].weekData[1].days.length, 3);
assert.equal(virtual[0].weekData[0].label, '');           // sin los textos de semana del coach

// Llaves estables: lo que se escribe por posición se guarda por regla y se lee por posición
const { vista, llaveEstable } = adaptadorDeRegistros(virtual);
assert.equal(llaveEstable('f1-w1-d1'), 'f1-w1-r1-Mié');
assert.equal(llaveEstable('f1-w1-d9'), 'f1-w1-d9');       // lo que no es de una regla, igual
const guardado = { 'f1-w1-r1-Mié': { completed: true }, 'otra-cosa': { completed: true } };
assert.deepEqual(vista(guardado), { 'f1-w1-d1': { completed: true } });

// Si el fisio cambia los días de la regla (Lun y Jue), lo anotado del lunes se queda con el lunes
const r2 = { ...r, dias: ['Jue', 'Lun'] };
const virtual2 = fasesConPegadas([r2], fases);
const a2 = adaptadorDeRegistros(virtual2);
assert.deepEqual(a2.vista({ 'f1-w1-r1-Lun': { completed: true } }), { 'f1-w1-d0': { completed: true } });
assert.deepEqual(a2.vista({ 'f1-w1-r1-Mié': { completed: true } }), {});   // el miércoles ya no existe

// Rutina semanal: la llave lleva la semana del calendario
const semanal = fasesConPegadas([r], [{ id: 'p-1', num: 1, name: 'Rutina', weekData: [semana(1)] }], { semanal: true });
const aw = adaptadorDeRegistros(semanal, 'weekly');
assert.equal(aw.llaveEstable('wk-2026-W40-d1'), 'wk-2026-W40-r1-Mié');
assert.deepEqual(aw.vista({ 'wk-2026-W40-r1-Mié': { completed: true } }), { 'wk-2026-W40-d1': { completed: true } });

// Una regla nueva trae id y todo lo suyo
const nueva = nuevaRegla({ sesion, dias: ['Lun'], alcance: { tipo: 'dia', desde: { faseId: 'f1', semana: 1, n: 0 } } });
assert.ok(nueva.id.length === 8 && nueva.nombre === 'Estiramientos' && Array.isArray(nueva.omitir));

console.log('✓ sesiones pegadas: reparto, alcance, semanas saltadas y llaves estables');
