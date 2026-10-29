// Prueba de la fase 5 (el Apple Watch): lo de ANTES de conectar solo cuenta para las cuentas.
//   · condición, fatiga y forma arrancan con esas semanas → nunca «Poco historial» ni «Sobrecarga» por falta de base;
//   · la gráfica (`curva`), la lista, los récords y lo último NO enseñan nada de antes;
//   · «lo normal» de la recuperación (la base de 30 días) sí lo usa; lo último y la semana, no.
//
//   node scripts/prueba-reloj.mjs
import assert from 'node:assert/strict';
import { conLoDeAntes, resumenDeRecuperacion, sumaDias } from '../src/lib/metricas/forma.js';
import { derivaDelAtleta } from '../src/lib/metricas/derivados.js';
import { entrenoDelReloj } from '../src/lib/metricas/leeHealthKit.js';

const hoy = '2026-10-29';
const conecto = '2026-10-29'; // conectó hoy
const entreno = (dia, carga, extra = {}) => ({ inicio: `${dia}T13:00:00Z`, desfase_min: -360, duracion_s: 3600, carga, fc_max: 170, ...extra });

/* ---- Quien ya entrenaba: 10 semanas de antes, nada desde que conectó ---- */
{
  const previas = [];
  for (let d = 70; d >= 1; d -= 1) if (d % 7 !== 0) previas.push(entreno(sumaDias(conecto, -d), 60)); // seis días a la semana, carga 60
  const sinAntes = derivaDelAtleta({ actividades: [], recuperacion: [], hoy });
  assert.equal(sinAntes.estado, null, 'sin nada: sin estado');
  const d = derivaDelAtleta({ actividades: [], recuperacion: [], hoy, previas: { actividades: previas, recuperacion: [], desdeDia: conecto } });
  assert.notEqual(d.estado?.clave, 'sin-base', 'con su historia, nunca «Poco historial»');
  assert.notEqual(d.estado?.clave, 'riesgo', 'ni «Sobrecarga» por falta de base');
  assert.ok(d.forma.ctl > 30, `la condición arranca con su historia (ctl ${d.forma.ctl})`);
  assert.ok(d.diasDeHistorial >= 42, 'no sale «Solo hay N días de historial»');
  assert.ok(d.curva.every((p) => p.dia >= conecto), 'la gráfica empieza el día en que conectó');
  assert.equal(d.lista.length, 0, 'ningún entreno de antes en la lista');
  assert.equal(d.ultimos.length, 0, 'ni en los últimos');
  assert.equal(d.estaSemana.entrenos ?? 0, 0, 'ni en la semana');
}

/* ---- Lo mismo, pero el primer entreno después de conectar es duro: con base, «Entrenando fuerte», no «Sobrecarga» ---- */
{
  const previas = [];
  for (let d = 70; d >= 1; d -= 1) if (d % 7 !== 0) previas.push(entreno(sumaDias(conecto, -d), 60));
  const ayer = sumaDias(hoy, -1);
  const d = derivaDelAtleta({ actividades: [entreno(ayer, 140)], recuperacion: [], hoy, previas: { actividades: previas, recuperacion: [], desdeDia: ayer } });
  const sola = derivaDelAtleta({ actividades: [entreno(ayer, 140)], recuperacion: [], hoy });
  assert.equal(sola.estado.clave, 'sin-base', 'sin su historia: «Poco historial» (lo de antes de la fase 5)');
  assert.notEqual(d.estado.clave, 'sin-base');
  assert.notEqual(d.estado.clave, 'riesgo');
  assert.equal(d.lista.length, 1, 'el entreno de después sí se ve');
  assert.equal(d.curva[0].dia, ayer, 'la gráfica arranca con el primero que se ve');
}

/* ---- Recuperación: «lo normal» con lo de antes; lo último y la semana, solo lo de después ---- */
{
  const previa = [];
  for (let d = 40; d >= 1; d -= 1) previa.push({ dia: sumaDias(conecto, -d), fc_reposo: 50, hrv_ms: 60, sueno_s: 7.5 * 3600 });
  const diaria = [{ dia: hoy, fc_reposo: 58, hrv_ms: 45, sueno_s: 7 * 3600 }];
  const sin = resumenDeRecuperacion(diaria, { hoy });
  assert.equal(sin.reposo.estado, 'sin-base', 'sin lo de antes: todavía no hay con qué comparar');
  const con = resumenDeRecuperacion(diaria, { hoy, previa });
  assert.equal(con.reposo.base, 50, 'la base sale de lo de antes');
  assert.equal(con.reposo.estado, 'atencion', '58 contra 50 de base: atención');
  assert.equal(con.hrv.estado, 'atencion', '45 contra 60: atención');
  assert.equal(con.reposo.ultimo.dia, hoy, 'lo último es de desde que conectó');
  assert.equal(con.reposo.siete, 58, 'la semana es solo lo de desde que conectó');
  const vacia = resumenDeRecuperacion([], { hoy, previa });
  assert.equal(vacia.veredicto.clave, 'sin-datos', 'con solo lo de antes no se enseña nada');
  assert.equal(vacia.reposo.ultimo, null);
}

/* ---- conLoDeAntes: por día manda lo de después; lo que le falte, de antes ---- */
{
  const u = conLoDeAntes([{ dia: '2026-10-29', fc_reposo: 55, sueno_s: null }], [{ dia: '2026-10-29', fc_reposo: 50, sueno_s: 25000 }, { dia: '2026-10-28', fc_reposo: 49 }]);
  assert.deepEqual(u.map((f) => f.dia), ['2026-10-28', '2026-10-29']);
  assert.equal(u[1].fc_reposo, 55);
  assert.equal(u[1].sueno_s, 25000, 'el día de conectar: el sueño de antes de conectar completa');
  assert.deepEqual(conLoDeAntes([{ dia: 'x' }], []), [{ dia: 'x' }]);
}

/* ---- Un resumen de antes (sin muestras): duración, distancia, calorías ---- */
{
  const w = { startDate: '2026-09-01T12:00:00Z', endDate: '2026-09-01T12:45:00Z', duration: 2700, totalDistance: 8000, totalEnergyBurned: 520, sourceName: 'Apple Watch de Mariana' };
  const crudo = entrenoDelReloj({ w, deporte: 'correr' });
  assert.equal(crudo.duracion_s, 2700);
  assert.equal(crudo.distancia_m, 8000);
  assert.equal(crudo.kcal_activas, 520);
  assert.equal(crudo.muestras.length, 0, 'sin ruta ni series');
}

console.log('prueba-reloj: todo bien');
