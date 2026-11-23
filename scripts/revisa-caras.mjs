/**
 * LA REVISIÓN DE LAS CARAS DEL ATLETA (22 nov 2026). Andrés: «que lo que vea el atleta esté directamente correlacionado con cada pieza que tiene
 * el código en el editor». Cada pieza que ofrece «Agregar» en `EditorDeCorrer.jsx` (Running, Cycling, Swimming, Triatlón) tiene que tener su cara
 * del atleta en `src/lib/pasosDeLaLista.js` (`CARAS`). Si alguien agrega una pieza al editor y no le hace su cara, esto falla.
 * También pasa por el traductor las sesiones de prueba y una pieza vacía de cada tipo: ninguna puede quedarse sin pasos ni romperse.
 */
import { readFileSync } from 'node:fs';
import { CARAS, llaveDePieza, pasosDeLaLista } from '../src/lib/pasosDeLaLista.js';
import { pasosDeLaSesion } from '../src/lib/entreno.js';

import { DEPORTES } from '../src/lib/catalogoDeLaLista.js';

// Las piezas salen del catálogo del editor (`lib/catalogoDeLaLista.js`, 23 nov 2026): se arma de verdad cada opción de «Agregar» de cada
// deporte (su `crea()`), en vez de buscar texto dentro de `EditorDeCorrer.jsx`.
const piezas = new Set();
for (const dep of Object.values(DEPORTES)) for (const op of dep.opciones) piezas.add(llaveDePieza(op.crea()));

let fallas = 0;
const mal = (t) => { fallas += 1; console.log(`✗ ${t}`); };
const bien = (t) => console.log(`✓ ${t}`);

if (piezas.size < 8) mal(`Solo encontré ${piezas.size} piezas en el editor: la revisión ya no sabe leerlo (${[...piezas].join(', ')})`);
for (const p of piezas) (CARAS[p] ? bien : mal)(`La pieza «${p}» del editor ${CARAS[p] ? 'tiene' : 'NO tiene'} su cara del atleta`);
for (const c of Object.keys(CARAS)) if (!piezas.has(c)) console.log(`· La cara «${c}» ya no está en el editor (se queda para lo guardado antes)`);

// Una pieza de cada tipo, con lo mínimo: no se rompe y dice algo.
const minimas = {
  'tr:cal': { k: 'tr', rol: 'cal', q: '10', u: 'min', forma: 'trote' }, 'tr:calma': { k: 'tr', rol: 'calma', q: '5', u: 'min', forma: 'video', video: { url: 'https://x/v.mp4', duracion: 300 } },
  'tr:continua': { k: 'tr', rol: 'continua', q: '5', u: 'km', modo: 'ritmo', vals: { ritmo: { min: '5', seg: '30' } } },
  'tr:int': { k: 'tr', rol: 'int', q: '4', u: 'km', ints: { repite: true, modo: 'zona', lista: [{ q: '1', u: 'km', z: 4 }, { q: '1', u: 'km', z: 2 }] } },
  'int:sprint': { k: 'int', rol: 'sprint', modo: 'tope', filas: [{ q: '60', u: 'm', dq: '2', du: 'min' }, { q: '60', u: 'm', dq: '', du: 'rec' }] },
  'int:series': { k: 'int', rol: 'series', filas: [{ q: '100', u: 'm', dq: '20', du: 's' }] },
  tec: { k: 'tec', sets: [{ veces: 2, items: [{ name: 'Skip A', q: '30', u: 'm', du: 'camina' }, { name: 'Skip B', q: '30', u: 'm', du: 'camina' }] }] },
  desc: { k: 'desc', q: '3', u: 'min', tipo: 'parado' }, trans: { k: 'trans', q: '90', u: 's' },
};
for (const [llave, x] of Object.entries(minimas)) {
  try {
    const { pasos, sinCara } = pasosDeLaLista({ disciplina: 'correr', tramos: [{ id: 'p', ...x }] });
    if (sinCara.length || !pasos.length || llaveDePieza(x) !== llave) mal(`La pieza «${llave}» no armó pasos`);
    else bien(`La pieza «${llave}» arma ${pasos.length} paso(s)`);
  } catch (e) { mal(`La pieza «${llave}» se rompió: ${e.message}`); }
}

// Las sesiones de la maqueta: ninguna sesión de la lista sale sin pasos.
// La semana de prueba de Ana, guardada aquí para no depender de la maqueta (`scripts/sesiones-de-prueba.json`).
const dias = JSON.parse(readFileSync(new URL('./sesiones-de-prueba.json', import.meta.url), 'utf8')).dias.filter((d) => Array.isArray(d.tramos) && d.tramos.length);
for (const d of dias) {
  const p = pasosDeLaSesion(d);
  (p.pasos.length ? bien : mal)(`«${d.name}» (${d.disciplina}): ${p.pasos.length} pasos para el atleta`);
}

console.log(fallas ? `\n${fallas} falla(s)` : '\nTodas las piezas tienen su cara del atleta.');
process.exit(fallas ? 1 : 0);
