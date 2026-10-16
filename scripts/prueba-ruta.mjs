/* Pruebas de la ruta con GPS del entreno libre (lo puro): `node scripts/prueba-ruta.mjs`. */
import assert from 'node:assert/strict';
import { agregaPunto, enVivo, trazoDeRuta, textoDeRitmo, usaGps } from '../src/lib/ubicacion.js';
import { preparaEntreno, construyeActividad } from '../src/lib/metricas/construye.js';
import { entrenoLibre } from '../src/lib/entrenoLibre.js';

// Una carrera inventada hacia el norte: 1.25 km a 5:00/km (3.333 m/s), un punto por segundo.
const metrosPorGradoLat = 111195;
const puntos = Array.from({ length: 376 }, (_, s) => ({ lat: 19.4 + (s * (1000 / 300)) / metrosPorGradoLat, lon: -99.1, precision: 8 }));

let m = [];
puntos.forEach((p, s) => { m = agregaPunto(m, p, s); });
assert.equal(m.length, 188, 'un punto cada 2 s');

// Un punto impreciso no entra; uno muy pegado al anterior tampoco.
assert.equal(agregaPunto(m, { lat: 19.5, lon: -99.1, precision: 120 }, 400), m);
assert.equal(agregaPunto(m, { lat: 19.5, lon: -99.1, precision: 5 }, m[m.length - 1].t + 1), m);

const v = enVivo(m);
assert.ok(Math.abs(v.distanciaM - 1243) < 15, `distancia ${v.distanciaM}`);
assert.ok(Math.abs(v.ritmoSKm - 300) <= 3, `ritmo ${v.ritmoSKm}`);
assert.equal(v.kms.length, 1);
assert.ok(Math.abs(v.kms[0].dur - 300) <= 3, `km 1 en ${v.kms[0].dur}`);
assert.deepEqual(enVivo([]), { distanciaM: 0, ritmoSKm: null, kms: [] });

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
