/* Pruebas de lo que manda Garmin (fase 4 de los stickers): un entreno con su ruta y su pulso entra como fila 'garmin' y da los mismos stickers que uno de
   HealthKit; la recuperación diaria llega al mismo lugar que Apple Salud. `node scripts/prueba-garmin.mjs`. Avisos inventados con los campos de la API de Garmin. */
import assert from 'node:assert/strict';
import { deporteDeGarmin, entrenoDeGarmin, recuperacionDeGarmin } from '../src/lib/metricas/leeGarmin.js';
import { construyeActividad, preparaEntreno } from '../src/lib/metricas/construye.js';
import { ficha, entrenoDeActividad } from '../src/lib/stickers/ficha.js';
import { catalogo } from '../src/lib/stickers/catalogo.js';

assert.equal(deporteDeGarmin('TRAIL_RUNNING'), 'correr');
assert.equal(deporteDeGarmin('STRENGTH_TRAINING'), 'fuerza');
assert.equal(deporteDeGarmin('LAP_SWIMMING'), 'natacion');

// Un aviso `activityDetails`: 5 km en 30 min, con ruta, pulso, altura y la distancia que midió el reloj.
const inicioS = Date.parse('2026-10-28T13:00:00Z') / 1000;
const detalle = {
  userId: 'g-1', summaryId: 'x-detail', activityId: 9876,
  summary: {
    activityType: 'RUNNING', startTimeInSeconds: inicioS, startTimeOffsetInSeconds: -21600, durationInSeconds: 1800, distanceInMeters: 5000, activeKilocalories: 410,
    averageHeartRateInBeatsPerMinute: 152, maxHeartRateInBeatsPerMinute: 176, totalElevationGainInMeters: 37.4, deviceName: 'Forerunner 265',
  },
  samples: Array.from({ length: 1801 }, (_, i) => ({
    startTimeInSeconds: inicioS + i, latitudeInDegree: 19.4 + (i * 2.78) / 111195, longitudeInDegree: -99.1, elevationInMeters: 2240 + i * 0.02,
    heartRate: 140 + (i % 30), totalDistanceInMeters: i * 2.7778,
  })),
};
const crudo = entrenoDeGarmin(detalle);
assert.equal(crudo.formato, 'garmin');
assert.equal(crudo.deporte, 'correr');
assert.equal(crudo.desfase_min, -360);
assert.equal(crudo.resumen.desnivel_pos_m, 37);
const umbrales = { fc_max: 190, fc_reposo: 55, fc_umbral: 170, metodo: 'estimado' };
const { fila, series } = construyeActividad(preparaEntreno(crudo), { umbrales, origen: 'garmin' });
assert.equal(fila.origen, 'garmin');
assert.equal(fila.distancia_m, 5000);
assert.equal(fila.fc_media, 152, 'el pulso medio que dijo el reloj manda');
assert.equal(fila.kcal_activas, 410);
assert.equal(fila.desnivel_pos_m, 37);
assert.ok(fila.zonas_s?.some((z) => z > 0), 'las zonas salen del pulso');
assert.ok(fila.vueltas?.length >= 4, 'los kilómetros');
assert.ok(series?.ruta?.lat?.length > 100, 'la ruta');
const f = ficha(entrenoDeActividad({ fila: { ...fila, id: 'g' }, series }));
['ruta-dato', 'elevacion', 'zonas', 'parciales'].forEach((id) => assert.ok(catalogo(f).some((x) => x.id === id), id));

// Un aviso `activities` (solo el resumen, sin muestras): entra igual, sin ruta.
const solo = construyeActividad(preparaEntreno(entrenoDeGarmin(detalle.summary)), { umbrales, origen: 'garmin' });
assert.equal(solo.fila.distancia_m, 5000);
assert.equal(solo.series, null);

// La recuperación diaria: cada aviso trae lo suyo y se junta por día; un aviso de sueño no trae (ni borra) el pulso en reposo.
const r = recuperacionDeGarmin({
  dailies: [{ calendarDate: '2026-10-28', restingHeartRateInBeatsPerMinute: 51, steps: 9120, activeKilocalories: 640 }],
  sleeps: [{ calendarDate: '2026-10-28', durationInSeconds: 27000, deepSleepDurationInSeconds: 5400, lightSleepDurationInSeconds: 15000, remSleepInSeconds: 5400, awakeDurationInSeconds: 1200 }],
  hrv: [{ calendarDate: '2026-10-28', lastNightAvg: 61 }],
});
assert.deepEqual(r, [{ dia: '2026-10-28', origen: 'garmin', fc_reposo: 51, pasos: 9120, kcal_activas: 640, sueno_s: 25800, sueno_profundo_s: 5400, sueno_rem_s: 5400, sueno_despierto_s: 1200, hrv_ms: 61, hrv_tipo: 'rmssd' }]);
assert.deepEqual(Object.keys(recuperacionDeGarmin({ sleeps: [{ calendarDate: '2026-10-29', durationInSeconds: 25000 }] })[0]).sort(), ['dia', 'origen', 'sueno_s'], 'solo lo que trae');

console.log('prueba-garmin: todo bien');
