// Prueba de la fase 6 (29 oct 2026): los workouts del plan en «Tus entrenos», mezclados con los libres y los del reloj, y agrupados por mes en «Ver todos».
//
//   node scripts/prueba-entrenos-del-plan.mjs
import assert from 'node:assert/strict';
import { diaDeLaSesion, lugarDeSesion, mezclaEntrenos, nombreDelMes, porMes, programaDelAlmacen, sesionesDelPlan } from '../src/lib/entrenosDelPlan.js';

const H = 3600 * 1000;
const hoy = new Date('2026-10-29T08:00:00').getTime();
// Una sesión hecha con el entreno guiado: dos series marcadas a la hora `inicio` y 40 min después.
const hecha = (inicio, extra = {}) => ({
  completed: true, completedAt: new Date(inicio + 45 * 60000).toISOString(),
  entreno: { nombre: 'Fuerza · tren inferior · ~48 min', inicio, fin: inicio + 45 * 60000, hechos: { '0.1': { t: inicio + 5 * 60000 }, '0.2': { t: inicio + 40 * 60000 } } },
  ...extra,
});
const dia = (name, cat = 'gym') => ({ day: 'Mié', name, cat, exercises: [{ name: 'Back Squat', sets: '4', reps: '5' }] });
const principal = {
  id: 'p1', clave: null, esPrincipal: true, profesionalId: 'coach-1',
  phases: [{ id: 'fase-de-fuerza', weekData: [{ num: 3, days: [dia('Lower A'), dia('Upper A'), { day: 'Vie', name: 'Lower A', exercises: [{ isNote: true, text: 'Repite el miércoles' }] }] }] }],
};
const delFisio = { id: 'p2', clave: 'fisio-9', esPrincipal: false, phases: [{ id: 'r1', weekData: [{ num: 1, days: [dia('Rodilla', 'terapia')] }] }] };
const programas = [principal, delFisio];

/* ---- Dónde vive una sesión por su llave ---- */
{
  assert.deepEqual(lugarDeSesion('fase-de-fuerza-w3-d1'), { phaseId: 'fase-de-fuerza', weekNum: 3, dayIdx: 1 }, 'una fase con guiones en su id');
  assert.deepEqual(lugarDeSesion('fase-de-fuerza-w3-d1#2'), { phaseId: 'fase-de-fuerza', weekNum: 3, dayIdx: 1 }, 'una vez anterior vive en el mismo lugar');
  assert.deepEqual(lugarDeSesion('wk-2026-W44-d4'), { semanal: true, dayIdx: 4 });
  assert.equal(lugarDeSesion('cualquier-cosa'), null);
  assert.equal(programaDelAlmacen(programas, 'wr:sessions'), principal);
  assert.equal(programaDelAlmacen(programas, 'wr:sessions@fisio-9'), delFisio);
  assert.equal(programaDelAlmacen(programas, 'wr:sessions@otro'), null);
}

/* ---- El día del plan de una sesión (con sus ejercicios, también si dice «repite…») ---- */
{
  const l = diaDeLaSesion(principal, 'fase-de-fuerza-w3-d0');
  assert.equal(l.dia.name, 'Lower A');
  assert.equal(l.fase.id, 'fase-de-fuerza');
  assert.equal(l.semana.num, 3);
  const r = diaDeLaSesion(principal, 'fase-de-fuerza-w3-d2');
  assert.equal(r.dia.day, 'Vie', 'conserva su día');
  assert.equal(r.dia.exercises[0].name, 'Back Squat', 'y entrena los ejercicios del día que repite');
  assert.equal(diaDeLaSesion(principal, 'fase-vieja-w1-d0'), null, 'si el plan cambió, no hay día (pero la sesión sale igual)');
}

/* ---- Solo las terminadas, de todos los programas ---- */
const estado = {
  'wr:sessions': {
    'fase-de-fuerza-w3-d0': hecha(hoy - 2 * H), // hoy temprano, sin reloj
    'fase-de-fuerza-w3-d1': { ...hecha(hoy - 50 * H), completed: false, completedAt: null }, // a medias: no va
    'fase-vieja-w1-d0': hecha(hoy - 60 * 24 * H), // hace dos meses, de un plan que ya no está
  },
  'wr:sessions@fisio-9': { 'r1-w1-d0': hecha(hoy - 26 * H) }, // ayer, del fisio, con el reloj
  'wr:cursor': { phaseId: 'fase-de-fuerza', weekNum: 3 },
};
const delPlan = sesionesDelPlan(estado, programas);
{
  assert.equal(delPlan.length, 3, 'la que quedó a medias no cuenta');
  assert.ok(delPlan.every((x) => x.s.registro.completedAt));
  const fisio = delPlan.find((x) => x.s.almacen === 'wr:sessions@fisio-9');
  assert.equal(fisio.programa, delFisio);
  assert.equal(fisio.lugar.dia.name, 'Rodilla');
  assert.equal(delPlan.find((x) => x.s.id === 'fase-vieja-w1-d0').lugar, null);
}

/* ---- Todo junto, lo más nuevo primero; el del reloj una sola vez ---- */
const easyRun = { id: 'a-run', deporte: 'correr', titulo: 'Easy run', inicio: new Date(hoy + 1 * H).toISOString(), duracion_s: 1720 };
const delReloj = { id: 'a-reloj', deporte: 'fuerza', titulo: 'Fuerza tradicional', inicio: new Date(hoy - 26 * H - 2 * 60000).toISOString(), duracion_s: 47 * 60 };
const actividades = [easyRun, delReloj]; // de la más nueva a la más vieja, como la base
{
  const lista = mezclaEntrenos(actividades, delPlan);
  assert.deepEqual(lista.map((e) => e.clave), ['a:a-run', 's:wr:sessions:fase-de-fuerza-w3-d0', 'a:a-reloj', 's:wr:sessions:fase-vieja-w1-d0'], 'mismo día: el easy run (más tarde) arriba del workout de la mañana');
  const conReloj = lista.find((e) => e.clave === 'a:a-reloj');
  assert.equal(conReloj.plan.s.id, 'r1-w1-d0', 'el del reloj lleva su sesión del plan');
  assert.ok(!lista.some((e) => e.clave === 's:wr:sessions@fisio-9:r1-w1-d0'), 'y la sesión no sale otra vez');
  assert.equal(lista.find((e) => e.clave === 'a:a-run').plan, undefined, 'el easy run es libre');
}

/* ---- Con páginas: lo más viejo que la última actividad leída espera a su página ---- */
{
  const lista = mezclaEntrenos(actividades, delPlan, { hasta: Date.parse(delReloj.inicio) });
  assert.ok(!lista.some((e) => e.clave.includes('fase-vieja')), 'la de hace dos meses todavía no');
  assert.ok(lista.some((e) => e.clave.includes('w3-d0')));
  assert.equal(mezclaEntrenos([], delPlan, { hasta: Infinity }).length, 0, 'antes de la primera página, nada');
}

/* ---- «Ver todos»: por mes ---- */
{
  const grupos = porMes(mezclaEntrenos(actividades, delPlan));
  assert.deepEqual(grupos.map((g) => g.mes), ['Octubre 2026', nombreDelMes(hoy - 60 * 24 * H)]);
  assert.equal(grupos[1].mes, 'Agosto 2026', 'la de hace dos meses va en su mes');
  assert.equal(grupos[0].entrenos.length, 3);
}

console.log('prueba-entrenos-del-plan: todo bien');
