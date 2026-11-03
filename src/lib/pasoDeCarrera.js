/* UN PUNTO DEL GPS EN LA CARRERA (2 nov 2026). Lo que hace la carrera libre con cada punto que llega, sin pantalla ni red: primero la pausa automática
   (`decidePausaAutomatica`) y, si no está en pausa, sumarlo a la ruta (`agregaPunto`). Las dos escuchan lo mismo: `decideMarcha`, por familia (a pie con el
   rebote del cuerpo, sobre ruedas con el GPS; 3 nov 2026). Con cada aviso de rebote (uno por segundo) también se decide, sin punto: así la pausa no espera al GPS.

   Vive aparte para que la pantalla (`useCronometroLibre`) y la prueba que reproduce una traza grabada en el iPhone (`scripts/prueba-ruta.mjs`, `lib/trazaGps.js`)
   hagan EXACTAMENTE lo mismo. */

import { agregaPunto, metrosEntrePuntos } from './ubicacion.js';
import { decideMarcha, decidePausaAutomatica, familiaDelDeporte, pausa, reanuda, segundosDe } from './entrenoLibre.js';
import { senales } from './sensorDeMovimiento.js';

/** Cuánto (s) se recuerdan las lecturas del GPS para la pausa automática (el «GPS bueno» mira 10 s). */
const RECUERDA_S = 15;

/** La familia del cronómetro ('pie' | 'ruedas' | null): la de su actividad; uno guardado antes del 3 nov 2026, la de su deporte. */
export const familiaDe = (c) => c?.desplazamiento ?? familiaDelDeporte(c?.deporte);

/**
 * El estado con el que arranca una carrera: `{ cronometro, muestras, lecturas, metros, arranque, reanudadoEn, pausadoEn }`. `arranque` (ms): cuándo arrancó o se
 * reanudó por última vez (la pausa nunca cuenta desde antes). `reanudadoEn`/`pausadoEn` (ms): cuándo fue la última reanudación y la última pausa automática.
 */
export const carreraNueva = (cronometro, muestras = []) => ({ cronometro, muestras, lecturas: [], metros: 0, arranque: cronometro?.inicio ?? 0, reanudadoEn: null, pausadoEn: null });

/**
 * Un punto `{ lat, lon, precision, vel?, ... }` que llegó a la hora `ahoraMs`, o `null` (un aviso del sensor: solo se decide la pausa). `sensor`: lo que se sabe
 * del sensor de movimiento (`sensorDeMovimiento.js`) o `null` (la web). `pausaAutomatica`: el ajuste. Devuelve el estado nuevo (los mismos objetos si nada
 * cambió) con `accion` ('pausa' | 'reanuda' | null), `marcha` (el cambio de marcha, `{ a: 'quieto' | 'en-marcha', motivo }`, para la traza) y `v` (lo que dijo
 * `decideMarcha` para los metros).
 */
export function pasoDeCarrera(e, punto, ahoraMs, { sensor = null, pausaAutomatica = true } = {}) {
  let { cronometro: c, muestras, lecturas, metros, arranque, reanudadoEn = null, pausadoEn = null } = e;
  const base = { lecturas, metros, arranque, reanudadoEn, pausadoEn };
  if (!c) return { ...e, ...base, accion: null, marcha: null, v: null };
  const ahoraS = ahoraMs / 1000;
  if (punto && typeof punto.lat === 'number') {
    lecturas = [...lecturas.filter((x) => ahoraS - x.t <= RECUERDA_S), { t: ahoraS, vel: punto.vel, pre: punto.precision, lat: punto.lat, lon: punto.lon }];
  }
  const familia = familiaDe(c);
  // «Pausa automática» apagada: nada de esto corre (ni la pausa ni «sin rebote no suma»); la ruta, con las reglas del GPS.
  const m = familia && pausaAutomatica ? decideMarcha(familia, sensor ? senales(sensor, ahoraMs) : null, lecturas, ahoraS) : null;
  const v = m?.metros ? { v: m.metros } : null;
  let accion = null;
  let marcha = null;
  if (m) {
    const estado = c.pausadoEn == null ? 'corriendo' : (c.automatica ? 'pausa' : null);
    const d = estado ? decidePausaAutomatica(estado, m, ahoraS, { reanudadoEnS: reanudadoEn != null ? reanudadoEn / 1000 : null, pausadoEnS: pausadoEn != null ? pausadoEn / 1000 : null }) : null;
    if (d?.accion === 'pausa') {
      // La pausa cuenta desde que se detuvo (nunca antes de que arrancara o se reanudara). Lo anotado en esos segundos se quita: el tiempo de la ruta no va
      // hacia atrás.
      const desde = Math.min(ahoraMs, Math.max(Math.round(d.desde * 1000), arranque ?? 0, c.inicio));
      c = pausa(c, desde, { automatica: true });
      const tope = segundosDe(c, ahoraMs);
      const quedan = muestras.filter((x) => x.t <= tope);
      return {
        cronometro: c, muestras: quedan.length === muestras.length ? muestras : quedan, lecturas, metros, arranque, reanudadoEn, pausadoEn: ahoraMs,
        accion: 'pausa', marcha: { a: 'quieto', motivo: d.motivo }, v,
      };
    }
    if (d?.accion === 'reanuda') {
      c = reanuda(c, Math.min(ahoraMs, Math.max(Math.round(d.desde * 1000), c.pausadoEn)));
      arranque = ahoraMs;
      reanudadoEn = ahoraMs;
      accion = 'reanuda';
      marcha = { a: 'en-marcha', motivo: d.motivo };
    }
  }
  const sigue = { cronometro: c, lecturas, metros, arranque, reanudadoEn, pausadoEn, accion, marcha, v };
  if (c.pausadoEn != null || !punto) return { ...sigue, muestras }; // en pausa (o sin punto) no se mide
  // A la ruta: 'quieto' (sin rebote no suma) o 'mueve'; sin decir nada, las reglas del GPS.
  const nuevas = agregaPunto(muestras, punto, segundosDe(c, ahoraMs), v?.v ?? null);
  if (nuevas !== muestras && muestras.length) metros += metrosEntrePuntos(muestras[muestras.length - 1], nuevas[nuevas.length - 1]);
  return { ...sigue, muestras: nuevas, metros };
}
