// Prueba del descanso entre Sets (src/lib/setsDeUnaSesion.js): vive en el ÚLTIMO ejercicio del Set (`descansoSet`), se lee
// como `descansoDespues` del Set y se muda con él cuando cambian sus ejercicios.
//
//   node scripts/prueba-descanso-entre-sets.mjs
import assert from 'node:assert/strict';
import { parseBlocks, serializeBlocks } from '../src/lib/setsDeUnaSesion.js';

const sesion = [
  { name: 'Back Squat', sets: '3', reps: '5', set: 1 },
  { name: 'Remo', sets: '3', reps: '8', set: 1, descansoSet: '2 min' },
  { name: 'Plancha', sets: '2', reps: '30', unidad: 'seg' },
];

/* ---- Leer: el descanso del Set es el de su último ejercicio ---- */
const bloques = parseBlocks(sesion);
assert.equal(bloques[0].descansoDespues, '2 min');
assert.equal(bloques[1].descansoDespues, '', 'un Set sin descanso lo trae vacío');

/* ---- Guardar sin tocar nada: idéntico ---- */
assert.deepEqual(serializeBlocks(parseBlocks(sesion)), sesion, 'leer y volver a guardar no cambia nada');

/* ---- Cambiarlo y quitarlo ---- */
{
  const bs = parseBlocks(sesion);
  bs[0].descansoDespues = '90 seg';
  const g = serializeBlocks(bs);
  assert.equal(g[1].descansoSet, '90 seg');
  assert.equal(g[0].descansoSet, undefined, 'solo el último ejercicio lo lleva');
  bs[0].descansoDespues = '';
  const sin = serializeBlocks(bs);
  assert.equal('descansoSet' in sin[1], false, 'vacío: no queda rastro');
  // Poner uno nuevo en un Set de un solo ejercicio.
  const bs2 = parseBlocks(sesion);
  bs2[1].descansoDespues = '1 min';
  assert.equal(serializeBlocks(bs2)[2].descansoSet, '1 min');
}

/* ---- Si el Set cambia de último ejercicio, el descanso se muda con él ---- */
{
  const bs = parseBlocks(sesion);
  bs[0].members.push({ name: 'Press', sets: '3', reps: '10' });
  const g = serializeBlocks(bs);
  assert.equal(g[2].name, 'Press');
  assert.equal(g[2].descansoSet, '2 min', 'el nuevo último ejercicio lo lleva');
  assert.equal('descansoSet' in g[1], false, 'el que ya no es el último lo suelta');
  // Quitar el último ejercicio: lo hereda el anterior.
  const bs2 = parseBlocks(sesion);
  bs2[0].members.pop();
  const h = serializeBlocks(bs2);
  assert.equal(h[0].descansoSet, '2 min');
}

/* ---- Un Set armado fuera del editor (sin la propiedad) conserva lo que ya traía ---- */
{
  const bs = parseBlocks(sesion);
  delete bs[0].descansoDespues;
  assert.equal(serializeBlocks(bs)[1].descansoSet, '2 min');
}

console.log('prueba-descanso-entre-sets: todo bien');
