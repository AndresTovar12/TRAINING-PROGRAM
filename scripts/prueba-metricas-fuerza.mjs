/* Pruebas de «Fuerza sin aparato»: `node scripts/prueba-metricas-fuerza.mjs`. Sesiones inventadas, sin base de datos ni red. */
import assert from 'node:assert/strict';
import { analisisDeFuerza, maximoEstimado } from '../src/lib/metricas/fuerza.js';
import { sesionesGuiadas } from '../src/lib/metricas/porSerie.js';

/* ---- El máximo estimado ---- */
assert.equal(maximoEstimado(100, 1), 100);
assert.equal(Math.round(maximoEstimado(100, 5) * 10) / 10, 116.7);
assert.equal(maximoEstimado(100, 13), null, 'de 13 reps para arriba no es confiable');
assert.equal(maximoEstimado(0, 5), null);
assert.equal(maximoEstimado(100, 0), null);

/* ---- Cuatro sesiones en dos semanas (hoy es sábado 10 oct 2026; todo en UTC) ---- */
const hora = (dia) => Date.parse(`${dia}T15:00:00Z`);
// Una sesión: `series` es `[nombre, kg, reps, escrito?]`; cada una se marca 60 s después de la anterior (sin descansos).
function sesion(dia, series, { saltadas = 0 } = {}) {
  const t0 = hora(dia);
  const hechos = {};
  const exercises = {};
  const nombres = [...new Set(series.map((s) => s[0]))];
  const vueltaDe = {};
  series.forEach(([nombre, kg, reps, escrito], i) => {
    const idx = nombres.indexOf(nombre);
    vueltaDe[nombre] = (vueltaDe[nombre] ?? 0) + 1;
    const clave = `${idx}.${vueltaDe[nombre]}.0`;
    hechos[clave] = { t: t0 + (i + 1) * 60000, n: nombre, ...(escrito ? { kg: String(kg), reps: String(reps) } : null) };
    if (!escrito) {
      exercises[idx] = { ...(exercises[idx] ?? {}), vueltas: { ...(exercises[idx]?.vueltas ?? {}), [vueltaDe[nombre] - 1]: { weight: String(kg), repsHechas: String(reps) } } };
    }
  });
  const saltados = {};
  for (let k = 0; k < saltadas; k += 1) saltados[`9.${k + 1}.0`] = { t: t0 + (series.length + k + 1) * 60000, n: 'Extra' };
  return { entreno: { nombre: `Sesión ${dia}`, inicio: t0, hechos, saltados }, exercises };
}
const estado = {
  'wr:sessions': {
    s1: sesion('2026-09-29', [['Back Squat', 100, 5], ['Back Squat', 100, 5], ['Press banca', 60, 8]]),            // semana pasada, martes: 500 + 500 + 480
    s2: sesion('2026-10-01', [['Back Squat', 105, 5, true]]),                                                          // semana pasada, jueves: 525 (escrito)
    s3: sesion('2026-10-06', [['back squat', 110, 3, true], ['Back Squat', 107.5, 5]], { saltadas: 1 }),              // esta semana, martes: 330 + 537.5
    s4: sesion('2026-10-09', [['Press banca', 62.5, 8], ['Dominadas', null, 10]]),                                   // esta semana, viernes: 500 (dominadas sin peso)
  },
};
const sesiones = sesionesGuiadas(estado);
assert.equal(sesiones.length, 4);

const a = analisisDeFuerza(sesiones, { hoy: '2026-10-10', desfaseMin: 0 });
assert.equal(a.hay, true);
// Esta semana: lunes 5 oct a sábado 10.
assert.equal(a.semana.lunes, '2026-10-05');
assert.equal(a.semana.kilos, 1368, 'kilos × reps de cada serie con peso, redondeado: 330 + 537.5 + 500 (las dominadas sin peso no suman)');
assert.equal(a.semana.series, 4, 'cuenta también la serie sin peso');
assert.deepEqual([a.semana.hechas, a.semana.saltadas, a.semana.sesiones], [4, 1, 2], 'series hechas contra saltadas');
// La semana pasada HASTA el mismo día (sábado 3 oct): las dos del martes + la del jueves.
assert.equal(a.semana.anterior.kilos, 500 + 500 + 480 + 525);
assert.equal(a.semana.cambio, Math.round(((1368 - 2005) / 2005) * 100));
// Las barras: 8 semanas, la última es esta.
assert.equal(a.semanas.length, 8);
assert.equal(a.semanas[7].lunes, '2026-10-05');
assert.equal(a.semanas[6].kilos, 500 + 500 + 480 + 525);
assert.equal(a.semanas[0].kilos, 0);

// Máximos por levantamiento (sin distinguir mayúsculas): el mejor de la sentadilla fue 110 × 3 (121 estimado) y superó los 105 × 5 (122.5)?
const squat = a.maximos.find((m) => m.nombre.toLowerCase() === 'back squat');
// 105 × 5 → 122.5; 110 × 3 → 121; 107.5 × 5 → 125.4: gana el de 107.5 × 5, que viene del plan.
assert.equal(squat.e1rm, 125.4);
assert.deepEqual([squat.kg, squat.reps, squat.dia, squat.fuente], [107.5, 5, '2026-10-06', 'plan']);
assert.equal(squat.record, true, 'superó a todo lo anterior');
assert.equal(squat.previo, 122.5);
const press = a.maximos.find((m) => m.nombre === 'Press banca');
assert.equal(press.e1rm, 79.2, '62.5 × 8 = 79.17');
assert.equal(press.dia, '2026-10-09');
assert.equal(press.previo, 76, '60 × 8 = 76');
assert.equal(a.maximos.find((m) => m.nombre === 'Dominadas'), undefined, 'sin peso no hay máximo estimado');
// Lo más reciente primero.
assert.deepEqual(a.maximos.map((m) => m.nombre), ['Press banca', 'Back Squat']);
// Récords: los dos se estrenaron esta semana.
assert.deepEqual(a.records.map((r) => r.nombre), ['Press banca', 'Back Squat']);
// Un récord viejo (más de 30 días) ya no cuenta como reciente.
assert.deepEqual(analisisDeFuerza(sesiones, { hoy: '2026-12-10', desfaseMin: 0 }).records, []);

/* ---- Sin nada de fuerza ---- */
assert.deepEqual(analisisDeFuerza([], { hoy: '2026-10-10', desfaseMin: 0 }), { hay: false, semana: null, semanas: [], maximos: [], records: [] });
const soloPeso = sesionesGuiadas({ 'wr:sessions': { x: sesion('2026-10-07', [['Dominadas', null, 10]]) } });
assert.equal(analisisDeFuerza(soloPeso, { hoy: '2026-10-10', desfaseMin: 0 }).hay, false);
// Sin semana pasada con qué comparar, no hay cambio.
const solo = analisisDeFuerza(sesionesGuiadas({ 'wr:sessions': { x: sesion('2026-10-07', [['Back Squat', 100, 5]]) } }), { hoy: '2026-10-10', desfaseMin: 0 });
assert.equal(solo.semana.cambio, null);
assert.equal(solo.maximos[0].record, false, 'la primera marca no es un récord: no hay con qué compararla');

console.log('prueba-metricas-fuerza: todo bien');
