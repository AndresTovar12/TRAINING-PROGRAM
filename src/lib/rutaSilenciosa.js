/* LA RUTA EN SILENCIO (sección 8b de los stickers, 28 oct 2026): la app sigue la ubicación en CUALQUIER entreno, guiado o libre, no solo en cardio. Si se movió
   lo suficiente, la línea aparece en sus stickers (`rutaDe` en `lib/stickers/ficha.js` decide: más de 300 m recorridos o más de 150 m del inicio).

   La batería: en un entreno que no es cardio el GPS va en precisión BAJA (wifi y antenas, unos 100 m de error) y solo sirve para notar si se mueve de verdad.
   En cuanto se mueve (se alejó del primer punto más que el error, o va a paso de caminata), sube a ALTA y se graba la ruta; si se queda quieto 3 minutos, vuelve a baja.
   Los puntos de precisión baja nunca entran a la ruta (`agregaPunto` exige ≤ 30 m). En cardio va en alta desde el principio, como siempre.

   La ruta NUNCA se vuelve distancia ni ritmo: un fútbol tiene línea en los stickers de ruta y sigue sin «Distance» (ver `guardaEntrenoLibre`).

   Puro, para probarse: `scripts/prueba-ruta.mjs`. */
import { metrosEntrePuntos } from './ubicacion.js';

export const SILENCIO = {
  /** Alejarse del primer punto más que esto (o que 1.5 veces el error del punto, si es mayor) es moverse de verdad. */
  ALEJARSE_M: 80,
  /** A esta velocidad (m/s, la que da el teléfono) o más, ya va caminando. */
  VELOCIDAD_MOVIMIENTO: 1.2,
  /** Con precisión alta, alejarse esto del último lugar donde se movió cuenta como seguir moviéndose. */
  SIGUE_M: 20,
  /** Quieto este tiempo (ms), el GPS vuelve a precisión baja. */
  QUIETO_MS: 3 * 60 * 1000,
};

/** El estado de arranque: precisión baja, sin ancla. */
export const silencioNuevo = () => ({ nivel: 'baja', ancla: null, movidoEn: null });

/**
 * Con cada punto del GPS (`{ lat, lon, precision, vel? }`) decide la precisión. `ahoraMs`: la hora del punto.
 * Devuelve el estado nuevo `{ nivel: 'baja' | 'alta', ancla, movidoEn }` (el mismo objeto si nada cambió).
 */
export function decidePrecision(estado, punto, ahoraMs) {
  if (!punto || typeof punto.lat !== 'number' || typeof punto.lon !== 'number') return estado;
  const lugar = { lat: punto.lat, lon: punto.lon };
  const vel = typeof punto.vel === 'number' && punto.vel >= 0 ? punto.vel : null;
  if (estado.nivel === 'baja') {
    if (!estado.ancla) return { ...estado, ancla: lugar };
    const lejos = metrosEntrePuntos(estado.ancla, lugar) > Math.max(SILENCIO.ALEJARSE_M, (punto.precision ?? 0) * 1.5);
    if (lejos || (vel !== null && vel >= SILENCIO.VELOCIDAD_MOVIMIENTO)) return { nivel: 'alta', ancla: lugar, movidoEn: ahoraMs };
    return estado;
  }
  // En alta: sigue moviéndose si va a paso de caminata o se alejó del último lugar donde se movió.
  const sigue = (vel !== null && vel >= SILENCIO.VELOCIDAD_MOVIMIENTO) || (estado.ancla && metrosEntrePuntos(estado.ancla, lugar) > SILENCIO.SIGUE_M);
  if (sigue) return { nivel: 'alta', ancla: lugar, movidoEn: ahoraMs };
  if (ahoraMs - (estado.movidoEn ?? ahoraMs) >= SILENCIO.QUIETO_MS) return { nivel: 'baja', ancla: lugar, movidoEn: null };
  return estado;
}

/**
 * Un entreno ya preparado (`preparaEntreno`) con su ruta en silencio, SIN lo que la ruta calcularía: ni distancia, ni ritmo, ni kilómetros, ni desnivel.
 * La línea se queda (las series guardan `ruta`) para los stickers de ruta; los números son los del deporte (un fútbol sigue sin «Distance»).
 */
export function sinNumerosDeLaRuta(prep) {
  const c = prep.calculado ?? {};
  return {
    ...prep,
    km: [],
    calculado: { ...c, distancia_m: null, movimiento_s: null, velocidad_max_ms: null, desnivel_pos_m: null, desnivel_neg_m: null },
  };
}
