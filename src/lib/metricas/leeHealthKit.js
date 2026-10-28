/* UN ENTRENO DEL APPLE WATCH (HKWorkout), leído directo de HealthKit en la app de iPhone, como lo entiende la app (fase 3 de los stickers, 28 oct 2026).

   De lo que devuelve el plugin (`queryWorkouts`, las muestras de pulso y la ruta de `queryWorkoutRoute`) sale el entreno «crudo» que ya saben preparar
   `preparaEntreno` y `construyeActividad` (los mismos de un archivo importado): con eso se guarda como una fila de `actividades` con `origen = 'healthkit'`
   y la ficha de los stickers es la de siempre. Lo que el reloj declaró (distancia, energía activa, desnivel) manda; lo que no, sale de las muestras.

   Este archivo no importa nada de la app (ni `@/`): lo cargan las pruebas de Node (`scripts/prueba-stickers.mjs`). */

/** Un punto de la ruta con más error que esto (metros) no se usa: dibuja picos que no corriste. */
export const PRECISION_MAXIMA_M = 50;

const positivo = (v) => (typeof v === 'number' && Number.isFinite(v) && v > 0 ? v : null);

/**
 * `w`: el entreno del plugin (`startDate`, `endDate`, `duration`, `totalDistance`, `totalEnergyBurned`, `sourceName`, `metadata.HKElevationAscended` en metros).
 * `pulso`: muestras `{ startDate, value }`. `ruta`: puntos `{ t (ms), lat, lon, alt, acc }`. `distanciaSumada` y `kcalSumadas`: la suma de las muestras de
 * ese rato, para cuando el entreno no las declaró. `desfase`: minutos contra UTC del teléfono.
 */
export function entrenoDelReloj({ w, deporte, deporteOriginal = null, pulso = [], ruta = [], distanciaSumada = null, kcalSumadas = null, desfase = 0 }) {
  const inicio = new Date(w.startDate).getTime();
  const fin = new Date(w.endDate).getTime();
  // El pulso y la ruta, juntos en el tiempo: con eso salen las zonas, la carga, los kilómetros y la línea de los stickers.
  const delPulso = pulso
    .map((s) => ({ t: (new Date(s.startDate).getTime() - inicio) / 1000, fc: Math.round(s.value) }))
    .filter((m) => m.t >= 0 && m.fc > 30 && m.fc < 240);
  const deLaRuta = ruta
    .filter((p) => Number.isFinite(p.lat) && Number.isFinite(p.lon) && !(p.acc > PRECISION_MAXIMA_M))
    .map((p) => ({ t: (p.t - inicio) / 1000, lat: p.lat, lon: p.lon, ...(Number.isFinite(p.alt) ? { alt: p.alt } : null) }))
    .filter((m) => m.t >= 0);
  const fcs = delPulso.map((m) => m.fc);
  const distancia = positivo(w.totalDistance) ?? positivo(distanciaSumada);
  const kcal = positivo(w.totalEnergyBurned) ?? positivo(kcalSumadas);
  const desnivel = positivo(Number(w.metadata?.HKElevationAscended));
  return {
    formato: 'healthkit', deporte, deporte_original: deporteOriginal, titulo: null, dispositivo: w.sourceName ?? null,
    inicio, fin, desfase_min: desfase, duracion_s: Math.round(positivo(w.duration) ?? (fin - inicio) / 1000), movimiento_s: null,
    distancia_m: distancia ? Math.round(distancia) : null,
    kcal_activas: kcal ? Math.round(kcal) : null,
    resumen: {
      fc_media: fcs.length ? Math.round(fcs.reduce((a, b) => a + b, 0) / fcs.length) : null,
      fc_max: fcs.length ? Math.max(...fcs) : null,
      fc_min: fcs.length ? Math.min(...fcs) : null,
      potencia_media: null,
      desnivel_pos_m: desnivel ? Math.round(desnivel) : null,
    },
    ruta_ref: null,
    muestras: [...delPulso, ...deLaRuta].sort((a, b) => a.t - b.t),
    archivo: 'Apple Watch',
  };
}
