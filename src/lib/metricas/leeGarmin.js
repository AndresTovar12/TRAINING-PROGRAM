/* LO QUE MANDA GARMIN (API de Garmin Connect, fase 4 de los stickers, 28 oct 2026), como lo entiende la app. Nada de archivos FIT: Garmin AVISA a nuestro
   servidor (función `garmin`) cuando el reloj sincroniza, y cada aviso trae los datos completos.

   · `entrenoDeGarmin(item)`: un entreno de los avisos `activityDetails` (resumen + muestras: ruta, pulso, altura, distancia) o `activities` (solo resumen) → el entreno
     «crudo» que ya saben preparar `preparaEntreno` y `construyeActividad`, igual que uno de HealthKit (`leeHealthKit.js`). Se guarda con `origen = 'garmin'`:
     tipo, inicio, fin, duración, distancia, calorías, pulso (con zonas), desnivel y ruta. Desde ahí la ficha de los stickers es la misma.
   · `recuperacionDeGarmin({ dailies, sleeps, hrv })`: los avisos diarios → filas de `recuperacion_diaria`, al mismo lugar que Apple Salud (pulso en reposo, HRV y
     sueño; también pasos y calorías del día). Cada fila lleva SOLO lo que trae: un aviso de sueño no borra el pulso en reposo que llegó en otro.

   Los nombres de los campos son los de la documentación de la Activity API y la Health API de Garmin; verificar con el primer aviso real.
   Este archivo no importa nada de la app (ni `@/`): lo cargan las pruebas de Node (`scripts/prueba-garmin.mjs`) y la función del servidor. */
import { deporteDeTexto } from './deportes.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const positivo = (v) => (num(v) !== null && v > 0 ? v : null);

/** El tipo de Garmin (`RUNNING`, `TRAIL_RUNNING`, `STRENGTH_TRAINING`…) → el deporte de la app. Lo que no esté aquí se busca por su nombre. */
const DEPORTE = {
  RUNNING: 'correr', STREET_RUNNING: 'correr', TRACK_RUNNING: 'correr', TRAIL_RUNNING: 'correr', TREADMILL_RUNNING: 'correr', INDOOR_RUNNING: 'correr', VIRTUAL_RUN: 'correr',
  WALKING: 'caminar', CASUAL_WALKING: 'caminar', SPEED_WALKING: 'caminar', INDOOR_WALKING: 'caminar',
  HIKING: 'senderismo',
  CYCLING: 'bici', ROAD_BIKING: 'bici', MOUNTAIN_BIKING: 'bici', GRAVEL_CYCLING: 'bici', INDOOR_CYCLING: 'bici', VIRTUAL_RIDE: 'bici', CYCLOCROSS: 'bici',
  LAP_SWIMMING: 'natacion', OPEN_WATER_SWIMMING: 'natacion', SWIMMING: 'natacion',
  ROWING: 'remo', INDOOR_ROWING: 'remo',
  ELLIPTICAL: 'eliptica',
  STRENGTH_TRAINING: 'fuerza', HIIT: 'hiit', CARDIO_TRAINING: 'funcional', INDOOR_CARDIO: 'funcional',
  YOGA: 'yoga', PILATES: 'yoga', BREATHWORK: 'movilidad',
  SOCCER: 'futbol', TENNIS: 'raqueta', PADEL: 'raqueta', PICKLEBALL: 'raqueta', TABLE_TENNIS: 'raqueta', SQUASH: 'raqueta', BADMINTON: 'raqueta',
};
export const deporteDeGarmin = (tipo) => DEPORTE[String(tipo ?? '').toUpperCase()] ?? deporteDeTexto(String(tipo ?? '').toLowerCase().replace(/_/g, ' '));

/** Un entreno de Garmin → el entreno «crudo». `item`: un elemento de `activityDetails` (con `summary` y `samples`) o de `activities` (el resumen solo). */
export function entrenoDeGarmin(item) {
  const s = item?.summary ?? item ?? {};
  const inicioS = num(s.startTimeInSeconds);
  if (inicioS === null) return null;
  const inicio = inicioS * 1000;
  const duracion = positivo(s.durationInSeconds) ?? 0;
  // Las muestras: el segundo del entreno, y lo que traiga cada una (pulso, punto de la ruta, altura, distancia que midió el reloj).
  const muestras = (Array.isArray(item?.samples) ? item.samples : [])
    .map((m) => {
      const t = num(m.timerDurationInSeconds) ?? (num(m.startTimeInSeconds) !== null ? m.startTimeInSeconds - inicioS : null);
      if (t === null || t < 0) return null;
      const x = { t };
      if (num(m.heartRate) !== null && m.heartRate > 30 && m.heartRate < 240) x.fc = Math.round(m.heartRate);
      if (num(m.latitudeInDegree) !== null && num(m.longitudeInDegree) !== null) { x.lat = m.latitudeInDegree; x.lon = m.longitudeInDegree; }
      if (num(m.elevationInMeters) !== null) x.alt = m.elevationInMeters;
      if (num(m.totalDistanceInMeters) !== null) x.dist = m.totalDistanceInMeters;
      return Object.keys(x).length > 1 ? x : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.t - b.t);
  const kcal = positivo(s.activeKilocalories);
  return {
    formato: 'garmin', deporte: deporteDeGarmin(s.activityType), deporte_original: s.activityType ?? null, titulo: null, dispositivo: s.deviceName ?? 'Garmin',
    inicio, fin: inicio + duracion * 1000, desfase_min: Math.round((num(s.startTimeOffsetInSeconds) ?? 0) / 60), duracion_s: Math.round(duracion), movimiento_s: positivo(s.movingDurationInSeconds),
    distancia_m: positivo(s.distanceInMeters) ? Math.round(s.distanceInMeters) : null,
    kcal_activas: kcal ? Math.round(kcal) : null,
    resumen: {
      fc_media: positivo(s.averageHeartRateInBeatsPerMinute), fc_max: positivo(s.maxHeartRateInBeatsPerMinute), fc_min: null, potencia_media: positivo(s.averagePowerInWatts),
      desnivel_pos_m: positivo(s.totalElevationGainInMeters) ? Math.round(s.totalElevationGainInMeters) : null,
      desnivel_neg_m: positivo(s.totalElevationLossInMeters) ? Math.round(s.totalElevationLossInMeters) : null,
    },
    ruta_ref: null, muestras, archivo: 'Garmin',
  };
}

/** Los avisos diarios de Garmin → filas de `recuperacion_diaria` (`{ dia, ...solo lo que trae }`, sin `atleta_id`). */
export function recuperacionDeGarmin({ dailies = [], sleeps = [], hrv = [] } = {}) {
  const dias = new Map();
  const del = (dia) => { if (!dias.has(dia)) dias.set(dia, { dia, origen: 'garmin' }); return dias.get(dia); };
  const pon = (fila, campo, v) => { if (v !== null && v !== undefined) fila[campo] = v; };
  (dailies ?? []).forEach((d) => {
    if (!d?.calendarDate) return;
    const f = del(d.calendarDate);
    pon(f, 'fc_reposo', positivo(d.restingHeartRateInBeatsPerMinute) ? Math.round(d.restingHeartRateInBeatsPerMinute) : null);
    pon(f, 'pasos', positivo(d.steps) ? Math.round(d.steps) : null);
    pon(f, 'kcal_activas', positivo(d.activeKilocalories));
    pon(f, 'kcal_basales', positivo(d.bmrKilocalories));
  });
  (sleeps ?? []).forEach((s) => {
    if (!s?.calendarDate) return;
    const f = del(s.calendarDate);
    // El sueño de Garmin: lo dormido (sin lo despierto) y sus fases.
    const fases = ['deepSleepDurationInSeconds', 'lightSleepDurationInSeconds', 'remSleepInSeconds'].map((k) => positivo(s[k]) ?? 0);
    const dormido = fases.reduce((a, b) => a + b, 0) || positivo(s.durationInSeconds);
    pon(f, 'sueno_s', dormido ? Math.round(dormido) : null);
    pon(f, 'sueno_profundo_s', positivo(s.deepSleepDurationInSeconds));
    pon(f, 'sueno_rem_s', positivo(s.remSleepInSeconds));
    pon(f, 'sueno_despierto_s', num(s.awakeDurationInSeconds));
  });
  (hrv ?? []).forEach((h) => {
    if (!h?.calendarDate) return;
    const f = del(h.calendarDate);
    // La HRV de Garmin es la de la noche (RMSSD), no la SDNN de Apple: va con su tipo para no compararlas como si fueran lo mismo.
    const v = positivo(h.lastNightAvg);
    if (v) { f.hrv_ms = Math.round(v * 10) / 10; f.hrv_tipo = 'rmssd'; }
  });
  return [...dias.values()].filter((f) => Object.keys(f).length > 2);
}
