/* Pruebas de la ruta con GPS del entreno libre (lo puro): `node scripts/prueba-ruta.mjs`. */
import assert from 'node:assert/strict';
import { agregaPunto, enVivo, trazoDeRuta, textoDeRitmo, usaGps } from '../src/lib/ubicacion.js';
import { preparaEntreno, construyeActividad } from '../src/lib/metricas/construye.js';
import { entrenoLibre } from '../src/lib/entrenoLibre.js';

// Una carrera inventada hacia el norte: 1.25 km a 5:00/km (3.333 m/s), un punto por segundo.
const metrosPorGradoLat = 111195;
const puntos = Array.from({ length: 376 }, (_, s) => ({ lat: 19.4 + (s * (1000 / 300)) / metrosPorGradoLat, lon: -99.1, precision: 8, vel: 1000 / 300 }));

let m = [];
puntos.forEach((p, s) => { m = agregaPunto(m, p, s); });
assert.equal(m.length, 376, 'un punto por segundo (la cámara del mapa avanza con cada uno)');

// Un punto impreciso no entra; uno muy pegado al anterior tampoco.
assert.equal(agregaPunto(m, { lat: 19.5, lon: -99.1, precision: 120 }, 400), m);
assert.equal(agregaPunto(m, { lat: 19.5, lon: -99.1, precision: 5 }, m[m.length - 1].t + 0.5), m);
// Ya con señal, un punto de 25 m de error no entra (el primero sí podía).
assert.equal(agregaPunto(m, { lat: 19.5, lon: -99.1, precision: 25 }, 400), m);
assert.equal(agregaPunto([], { lat: 19.5, lon: -99.1, precision: 25 }, 0).length, 1);

const v = enVivo(m);
assert.ok(Math.abs(v.distanciaM - 1243) < 15, `distancia ${v.distanciaM}`);
assert.ok(Math.abs(v.ritmoSKm - 300) <= 3, `ritmo ${v.ritmoSKm}`);
assert.equal(v.kms.length, 1);
assert.ok(Math.abs(v.kms[0].dur - 300) <= 3, `km 1 en ${v.kms[0].dur}`);
assert.deepEqual(enVivo([]), { distanciaM: 0, ritmoSKm: null, kms: [] });

// Una carrera que arranca a media segundo (t = s + 0.6): entran TODOS los puntos, uno por segundo (antes entraba uno de cada dos).
let fase = [];
for (let s = 0; s < 60; s += 1) fase = agregaPunto(fase, { lat: 19.4 + (s * 3) / metrosPorGradoLat, lon: -99.1, precision: 6, vel: 3 }, s + 0.6);
assert.equal(fase.length, 60, `a media segundo entran ${fase.length} de 60`);

// Parado con el temblor normal del GPS (±3 m, velocidad ~0): 0 metros, y el ritmo dice «parado».
const seed = (i) => Math.sin(i * 12.9898) * 43758.5453 % 1;
let quieto = [];
for (let s = 0; s < 120; s += 1) quieto = agregaPunto(quieto, { lat: 19.4 + (seed(s) * 3) / metrosPorGradoLat, lon: -99.1 + (seed(s + 7) * 3) / metrosPorGradoLat, precision: 8, vel: 0.1 }, s);
assert.ok(enVivo(quieto).distanciaM <= 1, `parado suma ${enVivo(quieto).distanciaM} m`);
assert.equal(enVivo(quieto).ritmoSKm, null, 'parado no tiene ritmo');
assert.equal(quieto.length, 120, 'parado el tiempo sigue contando');

// 200 m en línea recta a 4 m/s, con ±1 m de temblor de lado (el del iPhone ya filtrado): 200 ± 5 m, y el ritmo de ahora es el de la velocidad (250 s/km).
let recta = [];
for (let s = 0; s <= 50; s += 1) recta = agregaPunto(recta, { lat: 19.4 + (s * 4) / metrosPorGradoLat, lon: -99.1 + seed(s) / metrosPorGradoLat, precision: 6, vel: 4 + seed(s + 3) * 0.2 }, s);
assert.ok(Math.abs(enVivo(recta).distanciaM - 200) <= 5, `200 m rectos dan ${enVivo(recta).distanciaM}`);
assert.ok(Math.abs(enVivo(recta).ritmoSKm - 250) <= 10, `ritmo ${enVivo(recta).ritmoSKm}`);

// Sin velocidad del GPS (algunos navegadores), el ritmo sale de la distancia como antes.
const sinVel = m.map(({ vel, ...x }) => x);
assert.ok(Math.abs(enVivo(sinVel).ritmoSKm - 300) <= 3, `ritmo sin velocidad ${enVivo(sinVel).ritmoSKm}`);

const t = trazoDeRuta(m, { ancho: 300, alto: 200, margen: 16 });
assert.ok(t.d.startsWith('M'));
assert.ok(t.inicio[1] > t.fin[1], 'hacia el norte = hacia arriba');
assert.equal(trazoDeRuta(m.slice(0, 1)), null);

assert.equal(textoDeRitmo(332), '5:32');
assert.equal(textoDeRitmo(null), '—');
assert.ok(usaGps('correr') && !usaGps('natacion'));

// Guardada como cualquier entreno con ruta: la distancia del GPS, los kilómetros y la ruta en las series.
const prep = preparaEntreno({ ...entrenoLibre({ deporte: 'correr', inicioMs: Date.parse('2026-10-15T12:00:00Z'), duracionS: 376 }), muestras: m });
const { fila, series } = construyeActividad(prep, { umbrales: { fc_max: 190, fc_reposo: 60, fc_umbral: 170, metodo: 'x' }, conSeries: true, origen: 'manual' });
assert.ok(Math.abs(fila.distancia_m - 1243) < 15, `fila ${fila.distancia_m}`);
assert.ok(fila.vueltas?.length >= 1, 'kilómetros guardados');
assert.ok(fila.metricas?.ritmo_medio_s_km > 290 && fila.metricas.ritmo_medio_s_km < 310, `ritmo medio ${fila.metricas?.ritmo_medio_s_km}`);
assert.ok(series && JSON.stringify(series).includes('19.4'), 'la ruta va en las series');

// Lo que la persona escribió gana sobre el GPS.
const prep2 = preparaEntreno({ ...entrenoLibre({ deporte: 'correr', inicioMs: Date.parse('2026-10-15T12:00:00Z'), duracionS: 376, distanciaM: 1500 }), muestras: m });
assert.equal(construyeActividad(prep2, { umbrales: { fc_max: 190 }, conSeries: true }).fila.distancia_m, 1500);

console.log('prueba-ruta: todo bien');
