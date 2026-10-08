// Prueba del cluster (src/lib/medidas.js): reps en bloques «2+2+2» con una pausa entre ellos, cómo se lee, cómo se dice y
// que los planes ya escritos con «2+2+2» se entienden sin que nadie los toque.
//
//   node scripts/prueba-cluster.mjs
import assert from 'node:assert/strict';
import { MEDIDAS, leeCantidad, textoMeta, esCluster, repsDeCluster, metaEnSegundos, mismaMedida } from '../src/lib/medidas.js';

/* ---- Está en la lista de lo que se mide, al final ---- */
assert.equal(MEDIDAS.at(-1).id, 'cluster');
assert.equal(MEDIDAS.find((m) => m.id === 'cluster').etiqueta, 'Cluster');
assert.deepEqual(MEDIDAS.slice(0, 7).map((m) => m.id), ['reps', 'seg', 'min', 'm', 'km', 'yd', 'cal'], 'las de siempre, en su orden');

/* ---- Leer ---- */
assert.deepEqual(leeCantidad({ reps: '2+2+2' }), { cantidad: '2+2+2', unidad: 'cluster', libre: false, porLado: false }, 'un plan viejo con «2+2+2» ya es cluster');
assert.deepEqual(leeCantidad({ reps: '3 + 2 + 1', unidad: 'cluster' }).cantidad, '3+2+1', 'los espacios se limpian');
assert.equal(leeCantidad({ reps: '2+2+2', unidad: 'seg' }).unidad, 'seg', 'si el coach eligió otra unidad, manda ella');
assert.equal(leeCantidad({ reps: '8-10' }).unidad, 'reps', 'un rango de siempre no se toca');
assert.equal(leeCantidad({ reps: '10', unidad: 'cluster' }).unidad, 'cluster', 'un solo bloque también es un cluster');

/* ---- Decirlo ---- */
assert.equal(textoMeta({ reps: '2+2+2', unidad: 'cluster' }), '2+2+2 reps');
assert.equal(textoMeta({ reps: '2+2+2', unidad: 'cluster', entreBloques: '15-30' }), '2+2+2 reps · 15-30 s entre bloques');
assert.equal(textoMeta({ reps: '2+2+2', unidad: 'cluster', porLado: true }), '2+2+2 reps por lado');
assert.equal(textoMeta({ reps: '8', unidad: 'reps', entreBloques: '15' }), '8 reps', 'la pausa solo cuenta en un cluster');

/* ---- Cuentas ---- */
assert.equal(repsDeCluster('2+2+2'), 6);
assert.equal(repsDeCluster('3 + 2 + 1'), 6);
assert.equal(repsDeCluster('10'), null);
assert.equal(repsDeCluster('2+x'), null);
assert.equal(esCluster('2+2+2'), true);
assert.equal(esCluster('8-10'), false);
assert.equal(esCluster(''), false);
assert.equal(metaEnSegundos({ reps: '2+2+2', unidad: 'cluster' }), null, 'un cluster no es un tiempo');
assert.equal(mismaMedida({ reps: '5' }, { reps: '2+2+2' }), false, 'un cluster no se compara con reps sueltas');

console.log('prueba-cluster: todo bien');
