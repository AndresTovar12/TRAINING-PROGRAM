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
/** Por debajo de esta velocidad (m/s) que da el iPhone se está parado (también lo usa el ritmo de ahora). */
export const VELOCIDAD_PARADO = 0.5;
/** Arriba de esta velocidad que da el iPhone ya se está moviendo: el punto cuenta de inmediato (correr no espera). */
export const VELOCIDAD_EN_MARCHA = 1;
/** Cuántos puntos buenos SEGUIDOS (uno por segundo) tienen que salirse del radio del ancla para que cuente como moverse. */
export const PUNTOS_PARA_MOVERSE = 3;
/** Sin la velocidad del iPhone, se mide con la distancia de estos últimos segundos (menos de `VELOCIDAD_EN_MARCHA` en la ventana es parado). */
const VENTANA_SIN_VELOCIDAD = 5;
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

/* El ANCLA de «parado» (30 oct 2026): el último lugar firme, la última muestra que NO es `q` (las `q` son puntos de alguien parado, guardados en el lugar del ancla). */
const anclaDe = (muestras) => {
  for (let i = muestras.length - 1; i >= 0; i -= 1) if (!muestras[i].q) return muestras[i];
  return muestras[0];
};
// Dónde estaba DE VERDAD una muestra: las `q` (guardadas en el lugar del ancla) llevan su lugar real en `r`.
const realDe = (x) => (x.r ? { lat: x.r[0], lon: x.r[1] } : x);
// El punto convertido en muestra firme (en su lugar real), con lo que traiga.
const firme = (punto, segundo) => {
  const m = { t: segundo, lat: seis(punto.lat), lon: seis(punto.lon) };
  if (typeof punto.alt === 'number') m.alt = Math.round(punto.alt * 10) / 10;
  return m;
};

/**
 * Suma un punto a las muestras, en el segundo `t` del entreno (sin contar pausas). Devuelve las MISMAS muestras si el punto no sirve y unas nuevas si sí.
 * No sirve: impreciso (más de `PRECISION_MAXIMA` m para el primero, de `PRECISION_CON_SENAL` m después) o llegó antes de `CADA` s del anterior.
 *
 * PARADO NO SUMA METROS (30 oct 2026). Bajo techo el GPS deriva despacio y salta varios metros al cambiar de satélite; antes un solo punto que se alejaba más que
 * su error sumaba el salto entero (simulado: 200 m en 10 minutos quieto en un cuarto). Ahora moverse se decide con una VENTANA, no con un punto:
 *   · El ANCLA es el último lugar firme. Parado, cada punto entra en el lugar del ancla (`q: 1`, cero metros; el tiempo sigue y el ritmo dice «parado»), con su
 *     lugar real en `r`.
 *   · SEÑALES DE MOVERSE: con la velocidad del iPhone, que la dé (≥ `VELOCIDAD_PARADO`) y que el punto de verdad se haya desplazado eso desde el anterior (la
 *     velocidad con ruido de alguien quieto no basta, ni un salto de un solo segundo). Sin ella, la distancia de los últimos `VENTANA_SIN_VELOCIDAD` s
 *     (≥ `VELOCIDAD_EN_MARCHA`) y ese mismo paso.
 *   · SALIENDO DE PARADO, un punto es candidato (`c: 1`) si hay señales de moverse y se alejó del ancla más que `max(su error, error del ancla)`, o el iPhone
 *     dice que va a más de `VELOCIDAD_EN_MARCHA`. Se acepta con `PUNTOS_PARA_MOVERSE` candidatos seguidos (3 s); con 2 si ya está fuera del radio y va a más
 *     de 1 m/s (correr no espera 3 s). Al aceptar, los candidatos vuelven a su lugar real (no se pierde el arranque) y el punto nuevo es el ancla.
 *   · YA EN MOVIMIENTO, cada punto con señales de moverse cuenta, segundo a segundo (la cámara y el punto del mapa no avanzan a saltos); el primero sin ellas
 *     lo deja parado.
 * `vel` es la velocidad que da el GPS (m/s). Se prueba con `scripts/prueba-ruta.mjs`.
 */
export function agregaPunto(muestras, punto, t) {
  if (!punto || typeof punto.lat !== 'number' || typeof punto.lon !== 'number') return muestras;
  const ultima = muestras[muestras.length - 1];
  if (!(punto.precision <= (ultima ? PRECISION_CON_SENAL : PRECISION_MAXIMA))) return muestras;
  // El segundo se guarda ENTERO y hacia abajo (`floor`), y se compara ya entero: con `round` y la resta con decimales, una carrera que arrancaba en la segunda
  // mitad del segundo perdía uno de cada dos puntos (revisión de Fable 5, 27 oct 2026).
  const segundo = Math.floor(t);
  if (ultima && segundo - ultima.t < CADA) return muestras;
  const velGps = typeof punto.vel === 'number' && punto.vel >= 0 ? punto.vel : null;

  let previas = muestras;
  let m;
  if (!ultima) {
    m = firme(punto, segundo);
  } else {
    // ¿Hay señales de MOVERSE? Con la velocidad del iPhone, que la dé (≥ `VELOCIDAD_PARADO`) Y que el punto de verdad se haya desplazado eso desde el anterior
    // (la velocidad con ruido de alguien parado no basta, ni un salto de un solo segundo). Sin ella, la distancia de los últimos 5 s (≥ 1 m/s) y también ese paso.
    const anterior = realDe(ultima);
    const paso = metrosEntrePuntos(anterior, punto) / Math.max(1, segundo - ultima.t);
    let enMarcha;
    if (velGps != null) {
      enMarcha = velGps >= VELOCIDAD_PARADO && paso >= VELOCIDAD_PARADO;
    } else {
      const desde = muestras.find((x) => segundo - x.t <= VENTANA_SIN_VELOCIDAD) ?? ultima;
      enMarcha = paso >= VELOCIDAD_PARADO && metrosEntrePuntos(realDe(desde), punto) / Math.max(1, segundo - desde.t) >= VELOCIDAD_EN_MARCHA;
    }
    let mueve;
    let candidato = false;
    if (!ultima.q) {
      // Ya iba en movimiento: cada punto con señales de moverse cuenta (la cámara y el punto avanzan segundo a segundo); el primero sin ellas lo deja parado.
      mueve = enMarcha;
    } else {
      // Estaba parado: moverse se confirma con una VENTANA. El punto es candidato si hay señales de moverse y se salió del radio del ancla (o el iPhone dice
      // que va a más de 1 m/s). Se acepta con 3 candidatos seguidos; con 2 si ya está fuera del radio y va a más de 1 m/s (correr no espera 3 s).
      const ancla = anclaDe(muestras);
      const radio = Math.max(punto.precision, typeof ancla.pre === 'number' ? ancla.pre : punto.precision);
      const fuera = metrosEntrePuntos(ancla, punto) > radio;
      const rapido = velGps != null && velGps > VELOCIDAD_EN_MARCHA;
      candidato = enMarcha && (fuera || rapido);
      let esperando = 0;
      for (let k = muestras.length - 1; k >= 0 && muestras[k].c; k -= 1) esperando += 1;
      mueve = candidato && (esperando + 1 >= PUNTOS_PARA_MOVERSE || (fuera && rapido && esperando >= 1));
      if (mueve && esperando) {
        // Los que esperaban vuelven a su lugar real: no se pierde el arranque.
        previas = muestras.map((x, k) => {
          if (k < muestras.length - esperando) return x;
          const { q: _q, c: _c, r, ...resto } = x;
          return { ...resto, lat: r[0], lon: r[1] };
        });
      }
    }
    if (mueve) m = firme(punto, segundo);
    else {
      // Parado (o todavía sin confirmar): en el lugar del ancla, cero metros, y el tiempo sigue. Guarda dónde estaba de verdad (`r`): el paso del siguiente
      // punto se mide desde ahí, y si era candidato (`c`) y se confirma el movimiento, vuelve a su lugar. La ruta que se guarda solo lleva `t`, `lat` y `lon`.
      const ancla = ultima.q ? anclaDe(muestras) : ultima;
      m = { t: segundo, lat: ancla.lat, lon: ancla.lon, ...(typeof ancla.alt === 'number' ? { alt: ancla.alt } : {}), q: 1, r: [seis(punto.lat), seis(punto.lon)] };
      if (candidato) m.c = 1;
    }
  }
  if (typeof punto.fc === 'number') m.fc = Math.round(punto.fc);
  if (velGps != null) m.vel = Math.round(velGps * 100) / 100;
  if (!m.q && typeof punto.rumbo === 'number' && punto.rumbo >= 0) m.rumbo = Math.round(punto.rumbo);
  // El error del GPS (m): el mapa del iPhone dibuja con él el círculo de precisión del punto, y el ancla lo usa para su radio.
  if (typeof punto.precision === 'number' && punto.precision >= 0) m.pre = Math.round(punto.precision);
  return [...previas, m];
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
