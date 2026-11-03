/* UN PUNTO DEL GPS EN LA CARRERA (2 nov 2026). Lo que hace la carrera libre con cada punto que llega, sin pantalla ni red: primero la pausa automática
   (`decidePausaAutomatica`) y, si no está en pausa, sumarlo a la ruta (`agregaPunto`). Las dos escuchan lo mismo: el sensor de movimiento junto con el GPS
   (`decideMarcha`, 3 nov 2026).

   Vive aparte para que la pantalla (`useCronometroLibre`) y la prueba que reproduce una traza grabada en el iPhone (`scripts/prueba-ruta.mjs`, `lib/trazaGps.js`)
   hagan EXACTAMENTE lo mismo. */

import { agregaPunto, metrosEntrePuntos } from './ubicacion.js';
import { decideMarcha, decidePausaAutomatica, pausa, reanuda, segundosDe } from './entrenoLibre.js';
import { senales } from './sensorDeMovimiento.js';

/** Cuánto (s) se recuerdan las lecturas del GPS para la pausa automática. */
const RECUERDA_S = 15;

/** El estado con el que arranca una carrera: `{ cronometro, muestras, lecturas, metros, arranque }`. `arranque` (ms): cuándo arrancó o se reanudó por última vez. */
export const carreraNueva = (cronometro, muestras = []) => ({ cronometro, muestras, lecturas: [], metros: 0, arranque: cronometro?.inicio ?? 0 });

/**
 * Un punto `{ lat, lon, precision, vel?, ... }` que llegó a la hora `ahoraMs`. `sensor`: lo que se sabe del sensor de movimiento (`sensorDeMovimiento.js`) o
 * `null` (la web). `pausaAutomatica`: el ajuste. Devuelve el estado nuevo (los mismos objetos si nada cambió) con `accion` ('pausa' | 'reanuda' | null) y `v`
 * (lo que decidió `decideMarcha`, para la traza).
 */
export function pasoDeCarrera(e, punto, ahoraMs, { sensor = null, pausaAutomatica = true } = {}) {
  let { cronometro: c, muestras, lecturas, metros, arranque } = e;
  if (!c) return { ...e, accion: null, v: null };
  const ahoraS = ahoraMs / 1000;
  if (typeof punto.vel === 'number') {
    lecturas = [...lecturas.filter((x) => ahoraS - x.t <= RECUERDA_S), { t: ahoraS, vel: punto.vel, pre: punto.precision, d: metros, lat: punto.lat, lon: punto.lon }];
  }
  // El sensor y el GPS juntos (`decideMarcha`): lo mismo decide la pausa y si el punto suma metros. Sin sensor, `null`: el GPS solo.
  const v = sensor ? decideMarcha(senales(sensor, c.deporte, ahoraMs), lecturas, c.deporte, ahoraS) : null;
  let accion = null;
  if (pausaAutomatica) {
    const estado = c.pausadoEn == null ? 'corriendo' : (c.automatica ? 'pausa' : null);
    const d = estado ? decidePausaAutomatica(lecturas, estado, c.deporte, ahoraS, { marcha: v }) : null;
    if (d?.accion === 'pausa') {
      // La pausa cuenta desde que se detuvo (nunca antes de que arrancara o se reanudara). Lo anotado en esos segundos se quita: el tiempo de la ruta no va
      // hacia atrás.
      const desde = Math.min(ahoraMs, Math.max(Math.round(d.desde * 1000), arranque ?? 0, c.inicio));
      c = pausa(c, desde, { automatica: true });
      const tope = segundosDe(c, ahoraMs);
      const quedan = muestras.filter((x) => x.t <= tope);
      return { cronometro: c, muestras: quedan.length === muestras.length ? muestras : quedan, lecturas, metros, arranque, accion: 'pausa', v };
    }
    if (d?.accion === 'reanuda') {
      c = reanuda(c, Math.min(ahoraMs, Math.max(Math.round(d.desde * 1000), c.pausadoEn)));
      arranque = ahoraMs;
      accion = 'reanuda';
    }
  }
  if (c.pausadoEn != null) return { cronometro: c, muestras, lecturas, metros, arranque, accion, v }; // en pausa no se mide
  // A la ruta: 'quieto' o 'mueve'; con 'espera' (o sin sensor), las reglas del GPS.
  const nuevas = agregaPunto(muestras, punto, segundosDe(c, ahoraMs), v?.v === 'quieto' || v?.v === 'mueve' ? v.v : null);
  if (nuevas !== muestras && muestras.length) metros += metrosEntrePuntos(muestras[muestras.length - 1], nuevas[nuevas.length - 1]);
  return { cronometro: c, muestras: nuevas, lecturas, metros, arranque, accion, v };
}
