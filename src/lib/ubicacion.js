/* LA RUTA del entreno libre con GPS (reestructura visual, 15 oct 2026). Andrés: «dejarlo listo para cuando la app descargable esté».

   Dos piezas, separadas a propósito:
     1. LA FUENTE: de dónde salen los puntos. Hoy, el GPS del navegador (solo mientras la pantalla está encendida: el navegador no mide en segundo plano).
        En la app de la tienda se cambia por la del teléfono (o la del Apple Watch) con `usaFuenteDeUbicacion(...)`, y nada más de la app se entera.
        Una fuente es `{ nombre, segundoPlano, disponible(), sigue(alPunto, alError) → parar }`; cada punto es `{ lat, lon, alt?, precision, fc? }`.
     2. LO PURO: juntar los puntos en MUESTRAS con el mismo formato que las del reloj (`{ t, lat, lon, alt?, fc? }`, ver `lib/metricas/calculos.js`).
        Así la distancia, el ritmo y los kilómetros los saca el mismo motor que ya lee los relojes, y al guardar se vuelve un entreno con ruta como cualquier otro.

   Se prueba con `scripts/prueba-ruta.mjs`. */

import { completaMuestras, vueltasPorKm } from './metricas/calculos.js';

/** Los deportes que miden distancia con el GPS. Nadar no (el GPS no sirve en una alberca) ni los de gimnasio. */
const CON_GPS = ['correr', 'caminar', 'bici', 'senderismo'];
export const usaGps = (deporte) => CON_GPS.includes(deporte);

/** Un punto con más error que esto (en metros) no se usa: al arrancar, el GPS da puntos a 100 m o más mientras «encuentra» la señal. */
export const PRECISION_MAXIMA = 30;
/** Ya con un punto bueno, los siguientes deben ser más precisos (auditoría del GPS, 27 oct 2026): uno de 25-30 m a media carrera suma metros falsos. */
export const PRECISION_CON_SENAL = 20;
/** Por debajo de esta velocidad (m/s) se está parado: el punto solo cuenta si se alejó más que su propio error (el temblor del GPS no suma metros). */
export const VELOCIDAD_PARADO = 0.5;
/** Cada cuánto (segundos) se guarda un punto: uno por segundo, cada uno que da el GPS. Con uno cada 2 s la cámara del mapa avanzaba a saltos. */
const CADA = 1;
/** El ritmo de AHORA: la mediana de la velocidad que da el GPS en estos últimos segundos (la velocidad del teléfono es mucho más estable que distancia/tiempo). */
const SEGUNDOS_RITMO = 10;

const fuenteDelNavegador = {
  nombre: 'navegador',
  segundoPlano: false,
  disponible: () => typeof navigator !== 'undefined' && !!navigator.geolocation,
  sigue(alPunto, alError) {
    const id = navigator.geolocation.watchPosition(
      (p) => alPunto({
        lat: p.coords.latitude, lon: p.coords.longitude, precision: p.coords.accuracy,
        ...(typeof p.coords.altitude === 'number' ? { alt: p.coords.altitude } : {}),
        ...(typeof p.coords.speed === 'number' && p.coords.speed >= 0 ? { vel: p.coords.speed } : {}),
        ...(typeof p.coords.heading === 'number' && p.coords.heading >= 0 ? { rumbo: p.coords.heading } : {}),
      }),
      (e) => alError?.(e?.code === 1 ? 'negado' : 'sin_senal'),
      // `maximumAge`: un punto de hace unos segundos sirve para arrancar (con 0, el navegador espera uno nuevo y el primero tarda).
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 30000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  },
};

let fuenteActual = null;
/** La app instalable pone aquí la fuente nativa (con segundo plano); `null` regresa a la del navegador. */
export function usaFuenteDeUbicacion(fuente) { fuenteActual = fuente; }
export const fuenteDeUbicacion = () => fuenteActual ?? fuenteDelNavegador;

const seis = (v) => Math.round(v * 1e6) / 1e6;

/** Metros entre dos puntos `{lat, lon}` (en línea recta; para unos cuantos metros sobra). */
export function metrosEntrePuntos(a, b) {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
}

/**
 * Suma un punto a las muestras, en el segundo `t` del entreno (sin contar pausas). Devuelve las MISMAS muestras si el punto no sirve y unas nuevas si sí.
 * No sirve: impreciso (más de `PRECISION_MAXIMA` m para el primero, de `PRECISION_CON_SENAL` m después) o llegó antes de `CADA` s del anterior.
 * El temblor de alguien parado (va a menos de `VELOCIDAD_PARADO` y no se alejó más que su propio error) entra en el MISMO lugar que la muestra anterior:
 * no suma metros. `vel` es la velocidad que da el GPS (m/s); si no la da (algunos navegadores), se calcula con la distancia y el tiempo.
 */
export function agregaPunto(muestras, punto, t) {
  if (!punto || typeof punto.lat !== 'number' || typeof punto.lon !== 'number') return muestras;
  const ultima = muestras[muestras.length - 1];
  if (!(punto.precision <= (ultima ? PRECISION_CON_SENAL : PRECISION_MAXIMA))) return muestras;
  if (ultima && t - ultima.t < CADA) return muestras;
  const velGps = typeof punto.vel === 'number' && punto.vel >= 0 ? punto.vel : null;
  let quieto = false;
  if (ultima) {
    const d = metrosEntrePuntos(ultima, punto);
    const vel = velGps ?? d / Math.max(1, t - ultima.t);
    quieto = vel < VELOCIDAD_PARADO && d < punto.precision;
  }
  // Parado: la muestra se queda en el MISMO lugar que la anterior (cero metros), pero entra: así el tiempo sigue corriendo y el ritmo dice «parado».
  const m = quieto
    ? { t: Math.round(t), lat: ultima.lat, lon: ultima.lon, ...(typeof ultima.alt === 'number' ? { alt: ultima.alt } : {}) }
    : { t: Math.round(t), lat: seis(punto.lat), lon: seis(punto.lon) };
  if (!quieto && typeof punto.alt === 'number') m.alt = Math.round(punto.alt * 10) / 10;
  if (typeof punto.fc === 'number') m.fc = Math.round(punto.fc);
  if (velGps != null) m.vel = Math.round(velGps * 100) / 100;
  return [...muestras, m];
}

const mediana = (xs) => {
  const o = [...xs].sort((a, b) => a - b);
  const k = Math.floor(o.length / 2);
  return o.length % 2 ? o[k] : (o[k - 1] + o[k]) / 2;
};

/**
 * Lo que se ve mientras corre: `{ distanciaM, ritmoSKm, kms }`.
 *  - `ritmoSKm`: el ritmo de AHORA (segundos por km), `null` si todavía no hay para medirlo o si está parado. Con la velocidad del GPS (el teléfono), la mediana
 *    de los últimos `SEGUNDOS_RITMO` s; sin ella (la web), la distancia de los últimos ~30 s.
 *  - `kms`: los kilómetros completos `[{ n, dur }]` (el del motor, sin el trozo final).
 */
export function enVivo(muestras) {
  const m = completaMuestras(muestras).filter((x) => typeof x.dist === 'number');
  if (m.length < 2) return { distanciaM: 0, ritmoSKm: null, kms: [] };
  const ultima = m[m.length - 1];
  const velocidades = (muestras ?? []).filter((x) => typeof x.vel === 'number' && ultima.t - x.t <= SEGUNDOS_RITMO).map((x) => x.vel);
  let ritmoSKm;
  if (velocidades.length >= 3) {
    const v = mediana(velocidades);
    ritmoSKm = v >= VELOCIDAD_PARADO ? Math.round(1000 / v) : null;
  } else {
    const desde = [...m].reverse().find((x) => ultima.t - x.t >= 30) ?? m[0];
    const dd = ultima.dist - desde.dist;
    const dt = ultima.t - desde.t;
    ritmoSKm = dd >= 20 && dt > 0 ? Math.round((dt / dd) * 1000) : null;
  }
  const kms = vueltasPorKm(muestras).filter((v) => v.dist >= 990).map((v) => ({ n: v.n, dur: v.dur }));
  return { distanciaM: Math.round(ultima.dist), ritmoSKm, kms };
}

/**
 * La ruta dibujada en un cuadro de `ancho × alto` (con `margen`): el trazo SVG (`d`), y dónde empezó y dónde va. `null` con menos de dos puntos.
 * Sin mapa de calles a propósito: el dibujo de la ruta sola no necesita un proveedor de mapas (eso se decide con la app instalable).
 */
export function trazoDeRuta(muestras, { ancho = 300, alto = 200, margen = 16 } = {}) {
  const pts = muestras.filter((x) => typeof x.lat === 'number' && typeof x.lon === 'number');
  if (pts.length < 2) return null;
  const lat0 = pts[0].lat * (Math.PI / 180);
  const xy = pts.map((p) => [p.lon * Math.cos(lat0), -p.lat]);
  const xs = xy.map((p) => p[0]); const ys = xy.map((p) => p[1]);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const escala = Math.min((ancho - 2 * margen) / Math.max(x1 - x0, 1e-9), (alto - 2 * margen) / Math.max(y1 - y0, 1e-9));
  // Centrada en el cuadro.
  const dx = (ancho - (x1 - x0) * escala) / 2; const dy = (alto - (y1 - y0) * escala) / 2;
  const enCuadro = xy.map(([x, y]) => [Math.round(((x - x0) * escala + dx) * 10) / 10, Math.round(((y - y0) * escala + dy) * 10) / 10]);
  return {
    d: enCuadro.map(([x, y], i) => `${i ? 'L' : 'M'}${x} ${y}`).join(' '),
    inicio: enCuadro[0],
    fin: enCuadro[enCuadro.length - 1],
  };
}

/** «5:32» de segundos por km. */
export function textoDeRitmo(sKm) {
  if (!(sKm > 0) || sKm >= 3600) return '—';
  return `${Math.floor(sKm / 60)}:${String(Math.round(sKm % 60)).padStart(2, '0')}`;
}
