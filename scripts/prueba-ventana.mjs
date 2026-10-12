/* Pruebas de la ventana de un plan comprado: `node scripts/prueba-ventana.mjs`. Planes inventados, sin base de datos ni red.
   Lo que más importa: que de lo que NO se ve no salga ni un ejercicio (se busca la marca de cada ejercicio en el texto del resultado). */
import assert from 'node:assert/strict';
import { recortaPrograma, claveSemanaIso, semanasTranscurridas, hoyDelServidor } from '../src/lib/ventana.js';
import { isoWeekKey, cursorAlDia } from '../src/lib/training-utils.js';

/* Un plan inventado: fase f1 de 4 semanas y fase f2 de 6. Cada ejercicio lleva su marca: `X-<fase>-<semana>`. */
const semana = (f, n) => ({ num: n, label: `Semana ${n}`, days: [{ day: 'Lun', name: `Sesión ${f}${n}`, exercises: [{ name: `X-${f}-${n}` }] }, { day: 'Mié', exercises: [{ name: `Y-${f}-${n}` }] }] });
const plan = {
  kind: 'periodized', estructura: 'fases', foto: 'https://x/foto.jpg',
  phases: [
    { id: 'f1', name: 'Base', weekData: [1, 2, 3, 4].map((n) => semana('f1', n)) },
    { id: 'f2', name: 'Fuerza', weekData: [1, 2, 3, 4, 5, 6].map((n) => semana('f2', n)) },
  ],
};
const marcas = (fase, n) => [`X-${fase}-${n}"`, `Y-${fase}-${n}"`];
const sale = (resultado, fase, n) => marcas(fase, n).some((m) => JSON.stringify(resultado.data).includes(m));
/* Los hechos: que una semana esté o no esté, completa o cerrada. */
const semanasVisibles = (r) => r.data.phases.flatMap((f) => f.weekData.filter((w) => !w.bloqueada).map((w) => `${f.id}-${w.num}`));

/* ---- Las fechas ---- */
assert.equal(claveSemanaIso('2026-10-15'), isoWeekKey(new Date(2026, 9, 15)), 'misma semana ISO que la app');
for (const f of ['2026-01-01', '2026-12-31', '2027-01-03', '2026-10-12']) {
  const [a, m, d] = f.split('-').map(Number);
  assert.equal(claveSemanaIso(f), isoWeekKey(new Date(a, m - 1, d)), `semana ISO de ${f}`);
}
assert.equal(semanasTranscurridas('2026-10-15', '2026-10-15'), 0, 'el mismo día');
assert.equal(semanasTranscurridas('2026-10-15', '2026-10-18'), 0, 'compró jueves, hoy domingo: la misma semana');
assert.equal(semanasTranscurridas('2026-10-15', '2026-10-19'), 1, 'compró jueves, el lunes siguiente ya es la semana 2');
assert.equal(semanasTranscurridas('2026-10-15', '2026-10-10'), 0, 'un reloj hacia atrás no resta');
assert.equal(hoyDelServidor(new Date('2026-10-12T05:00:00Z')), '2026-10-11', 'lunes 00:00 en México (05:00 UTC) el servidor aún dice domingo');
assert.equal(hoyDelServidor(new Date('2026-10-12T12:00:00Z')), '2026-10-12', 'a las 12:00 UTC ya es lunes para el servidor');

/* ---- Compra de hoy, entra por la primera fase, ventana de 4 ---- */
let r = recortaPrograma({ data: plan, inicio: '2026-10-15', faseDeEntrada: 'f1', ventanaSemanas: 4, hoy: '2026-10-15' });
assert.deepEqual(semanasVisibles(r), ['f1-1', 'f1-2', 'f1-3', 'f1-4', 'f2-1'], 'la semana actual y 4 hacia adelante');
for (const [f, n] of [['f1', 1], ['f1', 4], ['f2', 1]]) assert.ok(sale(r, f, n), `se ve ${f} semana ${n}`);
for (const n of [2, 3, 4, 5, 6]) assert.ok(!sale(r, 'f2', n), `NO sale ni un ejercicio de f2 semana ${n}`);
assert.equal(r.resumen.semanaActual, 1);
assert.equal(r.resumen.semanasTotales, 10);
assert.deepEqual(r.cursorInicial, { phaseId: 'f1', weekNum: 1, dayIdx: 0, fijadoEn: '2026-W42' });
const cerrada = r.data.phases[1].weekData[1];
assert.deepEqual(Object.keys(cerrada).sort(), ['bloqueada', 'days', 'num'], 'una semana cerrada solo trae número, candado y días');
assert.deepEqual(cerrada.days, [{ day: 'Lun', bloqueada: true }, { day: 'Mié', bloqueada: true }], 'y de los días solo el nombre');
assert.equal(r.data.phases[1].name, 'Fuerza', 'el nombre de la fase sí se ve');
assert.equal(r.data.foto, 'https://x/foto.jpg', 'lo demás del plan (foto) no se toca');

/* ---- Entra a la mitad de una fase (12 oct 2026): la semana 3 de la fase 2 ---- */
r = recortaPrograma({ data: plan, inicio: '2026-10-15', faseDeEntrada: 'f2', semanaDeEntrada: 3, ventanaSemanas: 2, hoy: '2026-10-15' });
assert.deepEqual(r.data.phases.map((f) => f.id), ['f2'], 'la fase anterior no existe para él');
assert.deepEqual(r.data.phases[0].weekData.map((w) => w.num), [3, 4, 5, 6], 'las semanas 1 y 2 de esa fase tampoco');
assert.deepEqual(semanasVisibles(r), ['f2-3', 'f2-4', 'f2-5'], 'la semana en que entra y 2 hacia adelante');
for (const n of [1, 2]) assert.ok(!JSON.stringify(r.data).includes(`X-f2-${n}"`), 'ni una pista de lo que quedó antes de su entrada');
assert.ok(!sale(r, 'f2', 6), 'la 6 sigue cerrada');
assert.deepEqual(r.cursorInicial, { phaseId: 'f2', weekNum: 3, dayIdx: 0, fijadoEn: '2026-W42' }, 'el puntero arranca en su semana');
assert.equal(r.resumen.semanasTotales, 4);
r = recortaPrograma({ data: plan, inicio: '2026-10-15', faseDeEntrada: 'f2', semanaDeEntrada: 3, ventanaSemanas: 4, hoy: '2026-11-05' });
assert.equal(r.resumen.semanaActual, 4, 'tres semanas después va en la 4.ª desde que entró');
r = recortaPrograma({ data: plan, inicio: '2026-10-15', faseDeEntrada: 'f2', semanaDeEntrada: 1, ventanaSemanas: 4, hoy: '2026-10-15' });
assert.equal(r.data.phases[0].weekData.length, 6, 'entrar por la semana 1 es entrar por el principio de la fase');
r = recortaPrograma({ data: plan, inicio: '2026-10-15', faseDeEntrada: 'f2', semanaDeEntrada: 99, ventanaSemanas: 4, hoy: '2026-10-15' });
assert.equal(r.data.phases[0].weekData.length, 6, 'una semana que no existe se trata como el principio de la fase');
r = recortaPrograma({ data: plan, inicio: '2026-10-15', faseDeEntrada: 'f1', semanaDeEntrada: 4, ventanaSemanas: 4, hoy: '2026-10-15' });
assert.deepEqual(r.data.phases.map((f) => [f.id, f.weekData.length]), [['f1', 1], ['f2', 6]], 'entrar por la última semana de una fase deja esa y las fases que siguen');

/* ---- Pasaron 3 semanas: la ventana corre ---- */
r = recortaPrograma({ data: plan, inicio: '2026-10-15', faseDeEntrada: 'f1', ventanaSemanas: 4, hoy: '2026-11-05' });
assert.equal(r.resumen.semanaActual, 4);
assert.deepEqual(semanasVisibles(r), ['f1-1', 'f1-2', 'f1-3', 'f1-4', 'f2-1', 'f2-2', 'f2-3', 'f2-4'], 'lo pasado se queda y se abre un mes más');
assert.ok(!sale(r, 'f2', 5) && !sale(r, 'f2', 6));

/* ---- Entra por la segunda fase: la primera no existe para él ---- */
r = recortaPrograma({ data: plan, inicio: '2026-10-15', faseDeEntrada: 'f2', ventanaSemanas: 4, hoy: '2026-10-15' });
assert.deepEqual(r.data.phases.map((f) => f.id), ['f2']);
assert.deepEqual(semanasVisibles(r), ['f2-1', 'f2-2', 'f2-3', 'f2-4', 'f2-5']);
for (const n of [1, 2, 3, 4]) assert.ok(!JSON.stringify(r.data).includes(`X-f1-${n}"`), 'ni una pista de la fase de antes de su entrada');
assert.ok(!sale(r, 'f2', 6));
assert.deepEqual(r.cursorInicial, { phaseId: 'f2', weekNum: 1, dayIdx: 0, fijadoEn: '2026-W42' });

/* ---- Coherencia con la app: el puntero que calcula `cursorAlDia` cae dentro de lo visible ---- */
r = recortaPrograma({ data: plan, inicio: '2026-10-15', faseDeEntrada: 'f1', ventanaSemanas: 1, hoy: '2026-10-20' });
const cursor = cursorAlDia(r.data.phases, r.cursorInicial, new Date(2026, 9, 20)); // martes de la semana siguiente
assert.deepEqual([cursor.phaseId, cursor.weekNum], ['f1', 2], 'la app lo pone en la semana 2');
assert.ok(semanasVisibles(r).includes('f1-2'), 'y esa semana se ve completa');
const cursor2 = cursorAlDia(r.data.phases, r.cursorInicial, new Date(2026, 9, 26)); // lunes de la semana 3: al reloj del teléfono le falta nada
assert.deepEqual([cursor2.phaseId, cursor2.weekNum], ['f1', 3]);
assert.ok(semanasVisibles(r).includes('f1-3'), 'la ventana mínima de 1 semana cubre el desfase del huso horario');

/* ---- La ventana de 1 es el mínimo; sin ventana (null) se ve todo ---- */
r = recortaPrograma({ data: plan, inicio: '2026-10-15', faseDeEntrada: 'f1', ventanaSemanas: 0, hoy: '2026-10-15' });
assert.deepEqual(semanasVisibles(r), ['f1-1', 'f1-2'], 'una ventana de 0 se trata como 1: nunca se queda sin su semana de mañana');
r = recortaPrograma({ data: plan, inicio: '2026-10-15', faseDeEntrada: 'f1', ventanaSemanas: null, hoy: '2026-10-15' });
assert.equal(semanasVisibles(r).length, 10, 'sin ventana, todo');

/* ---- Plan terminado: todo se ve ---- */
r = recortaPrograma({ data: plan, inicio: '2026-10-15', faseDeEntrada: 'f1', ventanaSemanas: 4, hoy: '2027-03-01' });
assert.equal(semanasVisibles(r).length, 10);
assert.equal(r.resumen.semanaActual, 10);

/* ---- Compra vencida, cancelada, reembolsada o por armar: todo cerrado ---- */
for (const estado of ['vencida', 'cancelada', 'reembolsada', 'por_armar', 'pendiente']) {
  r = recortaPrograma({ data: plan, inicio: '2026-10-15', faseDeEntrada: 'f1', ventanaSemanas: 4, estado, hoy: '2026-10-15' });
  assert.equal(semanasVisibles(r).length, 0, `${estado}: nada se ve`);
  assert.ok(!/X-f\d-\d"|Y-f\d-\d"/.test(JSON.stringify(r.data)), `${estado}: ni un ejercicio sale`);
  assert.equal(r.resumen.cerrado, true);
}
for (const estado of ['activa', 'gracia']) {
  r = recortaPrograma({ data: plan, inicio: '2026-10-15', faseDeEntrada: 'f1', ventanaSemanas: 4, estado, hoy: '2026-10-15' });
  assert.ok(semanasVisibles(r).length > 0, `${estado}: se ve`);
}

/* ---- Plan semanal (una sola semana que se repite): no se recorta, salvo si la compra se cerró ---- */
const semanal = { kind: 'weekly', phases: [{ id: 'w', name: 'Semana', weekData: [semana('w', 1)] }] };
r = recortaPrograma({ data: semanal, inicio: '2026-10-15', hoy: '2027-01-01' });
assert.deepEqual(semanasVisibles(r), ['w-1']);
r = recortaPrograma({ data: semanal, inicio: '2026-10-15', estado: 'vencida', hoy: '2026-10-15' });
assert.deepEqual(semanasVisibles(r), []);
assert.ok(!sale(r, 'w', 1));

/* ---- Lo que no se debe romper ---- */
assert.deepEqual(plan.phases[1].weekData[1].days[0].exercises, [{ name: 'X-f2-2' }], 'el plan original no se modifica');
r = recortaPrograma({ data: { kind: 'periodized', phases: [] }, inicio: '2026-10-15', hoy: '2026-10-15' });
assert.deepEqual(r.data.phases, []);
assert.equal(r.cursorInicial, null);
r = recortaPrograma({ data: null, inicio: '2026-10-15', hoy: '2026-10-15' });
assert.deepEqual(r.data.phases, []);

console.log('✓ ventana: todo bien');
