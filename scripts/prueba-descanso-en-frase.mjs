/* El descanso escrito como frase cuenta como tiempo: `node scripts/prueba-descanso-en-frase.mjs`. */
import assert from 'node:assert/strict';
import { descansoEnTiempo, leeDescanso, esSinDescanso } from '../src/lib/medidas.js';
import { pasosDeLaSesion } from '../src/lib/entreno.js';

// Frases → solo el tiempo
assert.equal(descansoEnTiempo('30 segundos antes del siguiente ejercicio'), '30 seg');
assert.equal(descansoEnTiempo('Descansa 90 s entre series'), '90 seg');
assert.equal(descansoEnTiempo('2-3 minutos de pausa'), '2-3 min');
assert.equal(descansoEnTiempo('1 min'), '1 min');
assert.equal(descansoEnTiempo('Descanso de 45 seg.'), '45 seg');
// Lo que ya es un tiempo, o no trae uno claro, no se toca
for (const t of ['90 seg', '2 min', '3-4 min', '1:30', '60 s', 'Recuperación total', '', 'Entre series, sin prisa']) {
  assert.equal(descansoEnTiempo(t), t, `no debe tocar «${t}»`);
}
// Una cifra suelta de otra cosa no se confunde con un tiempo
assert.equal(descansoEnTiempo('3 series completas'), '3 series completas');
assert.equal(leeDescanso({ descanso: descansoEnTiempo('30 segundos antes del siguiente ejercicio') }).unidad, 'seg');

// El modo entreno cuenta hacia atrás un descanso que viene en frase (planes que ya se guardaron así)
const dia = { day: 'Mié', cat: 'gym', name: 'Sesión', exercises: [
  { name: 'Back Squat', sets: '3', reps: '10', descanso: '30 segundos antes del siguiente ejercicio', set: 1 },
  { name: 'Forward Lunges', sets: '3', reps: '10', descanso: '30 segundos antes del siguiente ejercicio', set: 2 },
] };
const plan = pasosDeLaSesion(dia);
const descansos = plan.pasos.filter((p) => p.tipo === 'descanso');
assert.ok(descansos.length > 0, 'debe haber pasos de descanso');
assert.ok(descansos.every((p) => p.seg === 30), `los descansos deben contar 30 s: ${descansos.map((p) => p.seg).join(',')}`);
// «Sin pausa» no es un descanso: no hay paso de descanso (antes se quedaba esperando «Seguir»)
for (const t of ['Sin pausa, pasa al siguiente ejercicio', 'Sin descanso', '0', '0 seg', 'Ninguno', 'no']) assert.equal(esSinDescanso(t), true, `«${t}» es sin descanso`);
for (const t of ['0:30', '90 seg', 'Recuperación total', 'Nordic', '3-4 min (completa)']) assert.equal(esSinDescanso(t), false, `«${t}» SÍ es descanso`);
const sinPausa = pasosDeLaSesion({ day: 'Lun', cat: 'gym', name: 'S', exercises: [
  { name: 'A', sets: '3', reps: '10', descanso: 'Sin pausa, pasa al siguiente ejercicio', set: 1 },
  { name: 'B', sets: '3', reps: '10', descanso: '3-4 min entre vueltas del bloque', set: 1 },
] });
const ds = sinPausa.pasos.filter((p) => p.tipo === 'descanso');
assert.ok(ds.length > 0 && ds.every((p) => p.seg === 180), `solo los descansos de B, de 3 min: ${ds.map((p) => p.seg).join(',')}`);
// Los valores reales del plan de Andrés (16 oct 2026): qué cuenta y qué espera «Seguir»
const reales = { '2 min': 120, '90 seg': 90, '3 min': 180, '2-3 min': 120, '3-5 min': 180, '3-4 min (completa)': 180, '60-90 seg entre series': 60, '3-4 min entre vueltas del bloque': 180 };
for (const [t, seg] of Object.entries(reales)) {
  const p = pasosDeLaSesion({ day: 'Lun', cat: 'gym', name: 'S', exercises: [{ name: 'A', sets: '2', reps: '5', descanso: t }] }).pasos.find((x) => x.tipo === 'descanso');
  assert.equal(p?.seg, seg, `«${t}» cuenta ${seg} s`);
}
console.log('prueba-descanso-en-frase: todo bien');

// Otras formas de escribir el tiempo (auditoría 23 oct 2026): comillas, minutos y segundos, horas, un número suelto
for (const [t, esperado] of Object.entries({ "45''": '45 seg', "1'30''": '90 seg', "1'30": '90 seg', '120': '120 seg', '3': '3 min', '1 h': '60 min' })) {
  assert.equal(descansoEnTiempo(t), esperado, `«${t}» debe leerse ${esperado}`);
}
for (const t of ['No descansar', 'Ninguna', 'N/A', 'n/a', '-', '—']) assert.equal(esSinDescanso(t), true, `«${t}» es sin descanso`);
for (const t of ["45''", '120', '1 h', 'No recuperar a medias']) assert.equal(esSinDescanso(t), false, `«${t}» SÍ es descanso`);
{
  const r = pasosDeLaSesion({ day: 'Lun', cat: 'gym', name: 'S', exercises: [
    { name: 'A', sets: '3', reps: '15.', descanso: "45''", set: 1 },
    { name: 'B', sets: '3', reps: '10', descanso: 'No descansar', set: 1 },
  ] });
  const dd = r.pasos.filter((p) => p.tipo === 'descanso');
  assert.ok(dd.length > 0 && dd.every((p) => p.seg === 45), `solo los descansos de A, de 45 s: ${dd.map((p) => p.seg).join(',')}`);
}
console.log('prueba-descanso-en-frase: también las otras formas');
