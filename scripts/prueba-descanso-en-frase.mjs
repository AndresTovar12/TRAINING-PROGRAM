/* El descanso escrito como frase cuenta como tiempo: `node scripts/prueba-descanso-en-frase.mjs`. */
import assert from 'node:assert/strict';
import { descansoEnTiempo, leeDescanso } from '../src/lib/medidas.js';
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
console.log('prueba-descanso-en-frase: todo bien');
