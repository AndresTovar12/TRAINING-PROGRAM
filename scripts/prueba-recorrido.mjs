/* El GPS dentro del entreno guiado: qué paso lleva mapa, la ruta que se guarda y el avance del paso. `node scripts/prueba-recorrido.mjs`. */
import assert from 'node:assert/strict';
import { pasosDeLaSesion } from '../src/lib/entreno.js';
import { esPasoConGps, metrosDelPaso, rutaParaGuardar, muestrasDeRuta, avanceDelPaso, sinSenal, MAX_PUNTOS } from '../src/lib/recorrido.js';

const ex = (name, extra) => ({ name, sets: '2', set: 1, ...extra });
const pasoDe = (e) => pasosDeLaSesion({ day: 'Lun', cat: 'gym', name: 'S', exercises: [e] }).pasos.find((p) => p.tipo === 'ejercicio');

// Qué paso lleva GPS: 200 m o más; un salto de 2 m, unas reps o un tiempo, no.
assert.equal(esPasoConGps(pasoDe(ex('Sprint', { reps: '400', unidad: 'm' }))), true, '400 m sí');
assert.equal(esPasoConGps(pasoDe(ex('Correr', { reps: '1', unidad: 'km' }))), true, '1 km sí');
assert.equal(esPasoConGps(pasoDe(ex('Sprint corto', { reps: '150', unidad: 'm' }))), false, '150 m no');
assert.equal(esPasoConGps(pasoDe(ex('Broad jump', { reps: '2', unidad: 'm' }))), false, 'saltos de 2 m no');
assert.equal(esPasoConGps(pasoDe(ex('Squat', { reps: '8-10' }))), false, 'reps no');
assert.equal(esPasoConGps(pasoDe(ex('Plancha', { reps: '45', unidad: 'seg' }))), false, 'tiempo no');
assert.equal(esPasoConGps(pasoDe(ex('Tempo', { reps: '400-600', unidad: 'm' }))), true, 'un rango desde 400 sí');
assert.equal(metrosDelPaso(pasoDe(ex('Tempo', { reps: '400-600', unidad: 'm' }))), 400, 'de un rango, el menor');
assert.equal(metrosDelPaso(pasoDe(ex('Correr', { reps: '1', unidad: 'km' }))), 1000, 'km en metros');
assert.equal(esPasoConGps(null), false);

// La ruta que se guarda: la forma de la activity card, con un tope de puntos y siempre el último.
assert.equal(rutaParaGuardar([]), null);
assert.equal(rutaParaGuardar([{ t: 0, lat: 19.4, lon: -99.1 }]), null, 'un punto no es línea');
const muchas = Array.from({ length: 1001 }, (_, i) => ({ t: i * 2, lat: 19.4 + i * 1e-5, lon: -99.1 - i * 1e-5 }));
const r = rutaParaGuardar(muchas);
assert.ok(r.lat.length <= MAX_PUNTOS + 1, `con muchos puntos se adelgaza (${r.lat.length})`);
assert.equal(r.lat.at(-1), Math.round(muchas.at(-1).lat * 1e5) / 1e5, 'termina donde terminó');
assert.equal(r.lat.length, r.lon.length);
assert.equal(muestrasDeRuta(r).length, r.lat.length, 'de vuelta a muestras');
assert.deepEqual(muestrasDeRuta(null), []);

// El avance del paso
assert.deepEqual(avanceDelPaso(212, 400), { faltan: 188, parte: 0.53, llego: false });
assert.deepEqual(avanceDelPaso(405, 400), { faltan: 0, parte: 1, llego: true });
assert.deepEqual(avanceDelPaso(0, 400), { faltan: 400, parte: 0, llego: false });

// La señal perdida: más de 5 s sin un punto bueno
assert.equal(sinSenal(1000, 5500), false);
assert.equal(sinSenal(1000, 6100), true);
assert.equal(sinSenal(NaN, 9e9), false, 'sin ningún punto todavía no es «se perdió»');

console.log('prueba-recorrido: todo bien');
