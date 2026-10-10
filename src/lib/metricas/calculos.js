/* Las CUENTAS de un entreno: de las muestras del reloj (pulso, velocidad, altura, ruta) a lo que ve el coach: zonas, carga, desnivel, kilómetros.

   Todo es puro (sin leer la base ni el navegador) para poder probarlo con Node con números inventados. Las muestras son
   `{ t, fc, vel, alt, cad, pot, dist, lat, lon }` con `t` en segundos desde que empezó el entreno; lo que el reloj no mide, no viene.

   LA CARGA. Andrés (10 oct 2026): quiere que el coach vea «la carga tipo TrainingPeaks». Aquí la carga se calcula del pulso con TRIMP de Banister (cada minuto
   pesa más cuanto más cerca del pulso máximo) y se lleva a una escala «TSS»: una hora justo en el umbral vale 100 puntos. Una hora fácil, unos 35; una
   hora al máximo, unos 150. Sin pulso se ESTIMA por el deporte y se dice (`metodo: 'estimada'`).

   Este archivo no importa de la app (ni `@/`): solo de `./deportes.js`. */
import { DEPORTES } from './deportes.js';

/* ------------------------------------------------------------------ */
/* Zonas de pulso                                                      */
/* ------------------------------------------------------------------ */

/** Las cinco zonas: hasta qué fracción del pulso máximo llega cada una (la quinta no tiene tope). */
export const ZONAS = Object.freeze([
  { z: 1, nombre: 'Recuperación', hasta: 0.6, para: 'Muy suave: caminar, calentar, recuperar' },
  { z: 2, nombre: 'Aeróbica', hasta: 0.7, para: 'Fácil y sostenible: la base del entrenamiento' },
  { z: 3, nombre: 'Tempo', hasta: 0.8, para: 'Firme: se puede hablar a frases cortas' },
  { z: 4, nombre: 'Umbral', hasta: 0.9, para: 'Duro: cerca del límite que se puede sostener' },
  { z: 5, nombre: 'Máximo', hasta: Infinity, para: 'Esfuerzo máximo: solo se aguanta un rato' },
]);

/** Los pulsos que separan las zonas: `[z1→z2, z2→z3, z3→z4, z4→z5]` en latidos por minuto, para un pulso máximo dado. */
export const limitesDeZonas = (fcMax) => ZONAS.slice(0, 4).map((z) => Math.round(fcMax * z.hasta));

/** La zona (1 a 5) de un pulso, o `null` si no es un pulso creíble. */
export function zonaDe(fc, fcMax) {
  if (!esPulso(fc) || !(fcMax > 0)) return null;
  const f = fc / fcMax;
  return f < 0.6 ? 1 : f < 0.7 ? 2 : f < 0.8 ? 3 : f < 0.9 ? 4 : 5;
}

/** Un pulso creíble: entre 30 y 240 latidos por minuto (un 0 o un 255 son el reloj sin señal). */
export const esPulso = (fc) => typeof fc === 'number' && Number.isFinite(fc) && fc >= 30 && fc <= 240;

/**
 * Los umbrales con los que se calculan las zonas y la carga. Lo que el atleta o el coach escribió manda; lo que falta se ESTIMA y se dice de dónde sale
 * (`metodo`), para que se pueda corregir:
 *   fc_max     escrito → el más alto que se ha visto, si pasa de lo que dice la edad → 208 − 0.7 × edad (Tanaka) → 190
 *   fc_reposo  escrito → la mediana de su pulso en reposo (si hay) → 60
 *   fc_umbral  escrito → el 89 % del máximo
 * `observadoFcMax`: el pulso más alto de sus entrenos recientes. `reposoMediano`: la mediana de su pulso en reposo reciente.
 */
export function estimaUmbrales({ configurados = {}, fechaNacimiento = null, observadoFcMax = null, reposoMediano = null, hoy = new Date() } = {}) {
  const metodo = {};
  const edad = fechaNacimiento ? (hoy.getTime() - Date.parse(fechaNacimiento)) / (365.25 * 86400000) : null;
  let fcMax = Number(configurados.fc_max) || null;
  if (fcMax) metodo.fc_max = 'escrito';
  else {
    const porEdad = edad && edad > 5 && edad < 100 ? Math.round(208 - 0.7 * edad) : null;
    const visto = esPulso(observadoFcMax) && observadoFcMax >= 150 ? Math.round(observadoFcMax) : null;
    if (visto && (!porEdad || visto > porEdad)) { fcMax = visto; metodo.fc_max = 'visto'; }
    else if (porEdad) { fcMax = porEdad; metodo.fc_max = 'edad'; }
    else { fcMax = visto ?? 190; metodo.fc_max = visto ? 'visto' : 'por defecto'; }
  }
  let fcReposo = Number(configurados.fc_reposo) || null;
  if (fcReposo) metodo.fc_reposo = 'escrito';
  else if (reposoMediano && reposoMediano >= 30 && reposoMediano <= 100) { fcReposo = Math.round(reposoMediano); metodo.fc_reposo = 'medido'; }
  else { fcReposo = 60; metodo.fc_reposo = 'por defecto'; }
  let fcUmbral = Number(configurados.fc_umbral) || null;
  if (fcUmbral) metodo.fc_umbral = 'escrito';
  else { fcUmbral = Math.round(fcMax * 0.89); metodo.fc_umbral = 'estimado'; }
  return { fc_max: fcMax, fc_reposo: Math.min(fcReposo, fcMax - 20), fc_umbral: Math.min(fcUmbral, fcMax - 1), metodo };
}

/* ------------------------------------------------------------------ */
/* Tiempo entre muestras                                               */
/* ------------------------------------------------------------------ */

/* Cuánto «vale» cada muestra: hasta la siguiente. Un hueco largo (el reloj sin señal, una pausa) no cuenta como si el pulso siguiera igual: tope de 30 s. */
const TOPE_DE_HUECO = 30;
function pesos(muestras) {
  const n = muestras.length;
  const w = new Array(n).fill(0);
  for (let i = 0; i < n - 1; i += 1) w[i] = Math.min(Math.max(muestras[i + 1].t - muestras[i].t, 0), TOPE_DE_HUECO);
  if (n > 1) {
    // La última muestra no tiene «siguiente»: vale lo típico (la mediana baja de los intervalos), no el último hueco, que puede ser enorme.
    const orden = w.slice(0, n - 1).sort((a, b) => a - b);
    w[n - 1] = orden[Math.floor((orden.length - 1) / 2)] || 1;
  } else if (n === 1) w[0] = 1;
  return w;
}

/** Segundos en cada zona (arreglo de 5 enteros), contando solo las muestras con pulso. */
export function tiempoEnZonas(muestras, fcMax) {
  const zonas = [0, 0, 0, 0, 0];
  const w = pesos(muestras);
  muestras.forEach((m, i) => {
    const z = zonaDe(m.fc, fcMax);
    if (z) zonas[z - 1] += w[i];
  });
  return zonas.map((s) => Math.round(s));
}

/* ------------------------------------------------------------------ */
/* La carga                                                            */
/* ------------------------------------------------------------------ */

// El peso de un minuto de esfuerzo a una fracción de la reserva de pulso (Banister): sube en curva, no en línea recta.
const pesoDeMinuto = (hrr, genero) => (genero === 'f' ? 0.86 * Math.exp(1.67 * hrr) : 0.64 * Math.exp(1.92 * hrr)) * hrr;

/**
 * La carga de un entreno a partir de su pulso. `{ carga, metodo: 'pulso' }`, o `null` si no hay pulso que contar.
 * Escala: una hora al pulso de umbral = 100 puntos.
 */
export function cargaDePulso(muestras, { fcMax, fcReposo, fcUmbral, genero = 'm' }) {
  const reserva = fcMax - fcReposo;
  if (!(reserva > 20)) return null;
  const w = pesos(muestras);
  let minutos = 0;
  let trimp = 0;
  muestras.forEach((m, i) => {
    if (!esPulso(m.fc)) return;
    const hrr = Math.min(1, Math.max(0, (m.fc - fcReposo) / reserva));
    trimp += (w[i] / 60) * pesoDeMinuto(hrr, genero);
    minutos += w[i] / 60;
  });
  if (minutos < 1) return null;
  const hrrUmbral = Math.min(1, Math.max(0.3, (fcUmbral - fcReposo) / reserva));
  const trimpDeUnaHoraEnElUmbral = 60 * pesoDeMinuto(hrrUmbral, genero);
  return { carga: Math.round((trimp / trimpDeUnaHoraEnElUmbral) * 100 * 10) / 10, metodo: 'pulso' };
}

/**
 * La carga de un entreno: del pulso si lo hay; si no, estimada por el deporte y la duración (una hora de correr ≈ 60, de caminar ≈ 25…).
 * `{ carga, metodo: 'pulso' | 'estimada' }`, o `null` si no hay ni pulso ni duración.
 */
export function cargaDeActividad({ muestras = [], deporte = 'otro', duracionS = 0, umbrales, genero = 'm' }) {
  const delPulso = umbrales ? cargaDePulso(muestras, { ...umbrales, fcMax: umbrales.fc_max, fcReposo: umbrales.fc_reposo, fcUmbral: umbrales.fc_umbral, genero }) : null;
  if (delPulso) return delPulso;
  if (!(duracionS >= 300)) return null;
  const porHora = (DEPORTES[deporte] ?? DEPORTES.otro).cargaPorHora;
  return { carga: Math.round((duracionS / 3600) * porHora * 10) / 10, metodo: 'estimada' };
}

/* ------------------------------------------------------------------ */
/* Distancia, velocidad y desnivel                                     */
/* ------------------------------------------------------------------ */

const RADIO_TIERRA = 6371008.8;
/** Metros entre dos puntos de la Tierra (haversine). */
export function distanciaEntre(lat1, lon1, lat2, lon2) {
  const r = Math.PI / 180;
  const dLat = (lat2 - lat1) * r;
  const dLon = (lon2 - lon1) * r;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLon / 2) ** 2;
  return 2 * RADIO_TIERRA * Math.asin(Math.min(1, Math.sqrt(a)));
}

const esCoordenada = (lat, lon) => typeof lat === 'number' && typeof lon === 'number' && Math.abs(lat) <= 90 && Math.abs(lon) <= 180 && !(lat === 0 && lon === 0);

/**
 * Completa lo que falta de las muestras: la distancia acumulada (de la ruta, si el reloj no la dio) y la velocidad (de la distancia, en una ventana de unos
 * 5 s para que no baile). Devuelve muestras NUEVAS; las de entrada no se tocan.
 */
export function completaMuestras(muestras) {
  const m = muestras.map((x) => ({ ...x }));
  const hayDist = m.some((x) => typeof x.dist === 'number');
  if (!hayDist) {
    let acumulada = 0;
    let previo = null;
    m.forEach((x) => {
      if (esCoordenada(x.lat, x.lon)) {
        if (previo) {
          const d = distanciaEntre(previo.lat, previo.lon, x.lat, x.lon);
          // Un salto de más de 100 m/s es una coordenada mala, no un atleta: no suma.
          const dt = Math.max(x.t - previo.t, 0.001);
          if (d / dt < 100) acumulada += d;
        }
        previo = x;
        // Solo las muestras que SON un punto de la ruta llevan distancia. Una de solo pulso (el Apple Watch las da aparte, a veces a la misma hora) con la
        // distancia «del último punto» tendría una distancia vieja, y la velocidad calculada contra ella saldría más lenta de lo real.
        x.dist = acumulada;
      }
    });
  }
  const conDist = m.filter((x) => typeof x.dist === 'number');
  if (conDist.length >= 2) {
    // Para cada muestra, los vecinos a ≥ 5 s a cada lado (dos punteros que solo avanzan: una pasada, no una por muestra).
    let lo = 0;
    let hi = 0;
    for (let i = 0; i < conDist.length; i += 1) {
      const x = conDist[i];
      while (lo < i && conDist[lo + 1].t <= x.t - 5) lo += 1;
      if (hi < i) hi = i;
      while (hi < conDist.length - 1 && conDist[hi].t < x.t + 5) hi += 1;
      if (typeof x.vel === 'number') continue;
      const a = conDist[lo];
      const b = conDist[hi];
      if (b.t > a.t) x.vel = Math.max(0, (b.dist - a.dist) / (b.t - a.t));
    }
  }
  return m;
}

/**
 * Cuánto subió y bajó, en metros. La altura del reloj tiembla: se promedia en ventanas de 5 muestras y un cambio solo cuenta si pasa de 1.5 m desde el
 * último punto firme (si no, un reloj parado «sube» cientos de metros de ruido).
 */
export function desnivelDe(alturas) {
  const a = alturas.filter((v) => typeof v === 'number' && Number.isFinite(v));
  if (a.length < 3) return { sube: 0, baja: 0 };
  const suave = a.map((_, i) => {
    const ventana = a.slice(Math.max(0, i - 2), i + 3);
    return ventana.reduce((s, v) => s + v, 0) / ventana.length;
  });
  let ref = suave[0];
  let sube = 0;
  let baja = 0;
  for (let i = 1; i < suave.length; i += 1) {
    const d = suave[i] - ref;
    if (d >= 1.5) { sube += d; ref = suave[i]; } else if (d <= -1.5) { baja -= d; ref = suave[i]; }
  }
  return { sube: Math.round(sube), baja: Math.round(baja) };
}

/** Una velocidad en m/s como ritmo de correr: segundos por kilómetro. Parado o lentísimo (menos de 0.5 m/s) no tiene ritmo. */
export const ritmoDe = (vel) => (typeof vel === 'number' && vel >= 0.5 ? 1000 / vel : null);

/**
 * Lo que dicen las muestras de un entreno: pulso, velocidad, distancia, desnivel, cadencia, potencia y el tiempo en movimiento.
 * `duracionS`: la duración total, si el archivo la dice (si no, la de las muestras).
 */
export function resumenDeMuestras(muestras, { duracionS = null, umbralDeMovimiento = 0.5 } = {}) {
  const m = completaMuestras(muestras);
  const w = pesos(m);
  const total = duracionS ?? (m.length > 1 ? m[m.length - 1].t - m[0].t : 0);

  let sumaFc = 0; let pesoFc = 0; let maxFc = null; let minFc = null;
  let sumaCad = 0; let pesoCad = 0; let sumaPot = 0; let pesoPot = 0; let maxPot = null; let maxVel = null;
  let movimiento = 0; let hayVelocidad = false;
  m.forEach((x, i) => {
    if (esPulso(x.fc)) {
      sumaFc += x.fc * w[i]; pesoFc += w[i];
      maxFc = maxFc === null ? x.fc : Math.max(maxFc, x.fc);
      minFc = minFc === null ? x.fc : Math.min(minFc, x.fc);
    }
    if (typeof x.cad === 'number' && x.cad > 0) { sumaCad += x.cad * w[i]; pesoCad += w[i]; }
    if (typeof x.pot === 'number' && x.pot > 0) {
      sumaPot += x.pot * w[i]; pesoPot += w[i];
      maxPot = maxPot === null ? x.pot : Math.max(maxPot, x.pot);
    }
    if (typeof x.vel === 'number') {
      hayVelocidad = true;
      if (x.vel > umbralDeMovimiento) movimiento += w[i];
      // Una velocidad máxima creíble: por encima de 25 m/s (90 km/h) es un error del GPS.
      if (x.vel < 25) maxVel = maxVel === null ? x.vel : Math.max(maxVel, x.vel);
    }
  });
  const ultimoConDist = [...m].reverse().find((x) => typeof x.dist === 'number');
  const { sube, baja } = desnivelDe(m.map((x) => x.alt));
  return {
    duracion_s: Math.round(total),
    movimiento_s: hayVelocidad && movimiento > 0 ? Math.round(Math.min(movimiento, total || movimiento)) : null,
    distancia_m: ultimoConDist ? Math.round(ultimoConDist.dist) : null,
    fc_media: pesoFc > 0 ? Math.round(sumaFc / pesoFc) : null,
    fc_max: maxFc,
    fc_min: minFc,
    cadencia_media: pesoCad > 0 ? Math.round((sumaCad / pesoCad) * 10) / 10 : null,
    potencia_media: pesoPot > 0 ? Math.round(sumaPot / pesoPot) : null,
    potencia_max: maxPot,
    velocidad_max_ms: maxVel === null ? null : Math.round(maxVel * 100) / 100,
    desnivel_pos_m: m.some((x) => typeof x.alt === 'number') ? sube : null,
    desnivel_neg_m: m.some((x) => typeof x.alt === 'number') ? baja : null,
  };
}

/* ------------------------------------------------------------------ */
/* Vueltas por kilómetro                                               */
/* ------------------------------------------------------------------ */

/**
 * Los kilómetros de un entreno con distancia: `[{ n, tipo: 'km', t0, dur, dist, fc, fcmax, ritmo, sube }]`. El último, si es un trozo, solo cuenta si pasa
 * de 200 m. Necesita muestras con `dist` (si no la traen, `completaMuestras` la saca de la ruta).
 */
export function vueltasPorKm(muestras, { largo = 1000 } = {}) {
  const todas = completaMuestras(muestras);
  const m = todas.filter((x) => typeof x.dist === 'number');
  if (m.length < 2) return [];
  // El pulso y la ruta casi nunca vienen en las mismas muestras (el Apple Watch da un latido cada 5 s y la ruta otro punto cada 5 s, desfasados): el pulso de
  // cada kilómetro se promedia con TODAS las muestras que lo traen, pesadas entre ellas, y no solo con las que además tienen distancia.
  const conPulso = todas.filter((x) => esPulso(x.fc));
  const wPulso = pesos(conPulso);
  // La hora (en segundos desde el inicio) a la que se llega a cierta distancia: interpolando entre las dos muestras que la rodean.
  const tiempoEn = (d) => {
    for (let i = 1; i < m.length; i += 1) {
      if (m[i].dist >= d) {
        const a = m[i - 1]; const b = m[i];
        return b.dist === a.dist ? b.t : a.t + ((d - a.dist) / (b.dist - a.dist)) * (b.t - a.t);
      }
    }
    return m[m.length - 1].t;
  };
  const total = m[m.length - 1].dist;
  const vueltas = [];
  for (let n = 0; n * largo < total; n += 1) {
    const d0 = n * largo;
    const d1 = Math.min((n + 1) * largo, total);
    if (d1 - d0 < 200) break;
    const t0 = tiempoEn(d0);
    const t1 = tiempoEn(d1);
    const dentro = m.filter((x) => x.t >= t0 && x.t < t1);
    let sumaFc = 0; let pesoFc = 0; let maxFc = null;
    conPulso.forEach((x, i) => {
      if (x.t >= t0 && x.t < t1) { sumaFc += x.fc * wPulso[i]; pesoFc += wPulso[i]; maxFc = maxFc === null ? x.fc : Math.max(maxFc, x.fc); }
    });
    const dur = t1 - t0;
    vueltas.push({
      n: n + 1, tipo: 'km', t0: Math.round(t0), dur: Math.round(dur), dist: Math.round(d1 - d0),
      fc: pesoFc > 0 ? Math.round(sumaFc / pesoFc) : null, fcmax: maxFc,
      ritmo: dur > 0 && d1 - d0 > 0 ? Math.round((dur / (d1 - d0)) * 1000) : null,
      sube: desnivelDe(dentro.map((x) => x.alt)).sube,
    });
  }
  return vueltas;
}

/* ------------------------------------------------------------------ */
/* Series reducidas para guardar y dibujar                             */
/* ------------------------------------------------------------------ */

const redondea = (v, dec) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10 ** dec) / 10 ** dec : null);

/**
 * Las series de un entreno reducidas a unos `max` puntos (promedio por tramos de igual duración), listas para guardar: pulso, velocidad, altura, cadencia,
 * potencia y distancia, todas con la misma lista de tiempos `t`; y la ruta aparte (hasta `maxRuta` puntos). Lo que el reloj no mide, no se guarda.
 * Con pocas muestras no se reduce nada.
 */
export function reduceSeries(muestras, { max = 600, maxRuta = 500 } = {}) {
  const m = completaMuestras(muestras);
  if (m.length === 0) return { v: 1, t: [] };
  const t0 = m[0].t;
  const total = m[m.length - 1].t - t0;
  // Cada punto cubre como mucho 25 s: de las series reducidas se vuelven a sacar las zonas y la carga (con huecos de más de 30 s no contarían).
  const nCubos = Math.min(Math.max(max, total > 0 ? Math.ceil(total / 25) : 1), m.length);
  const ancho = total > 0 ? total / nCubos : 1;
  const cubos = Array.from({ length: nCubos }, () => []);
  m.forEach((x) => {
    const i = total > 0 ? Math.min(nCubos - 1, Math.floor((x.t - t0) / ancho)) : 0;
    cubos[i].push(x);
  });
  const lleno = cubos.filter((c) => c.length > 0);
  const media = (c, campo, valido = (v) => typeof v === 'number' && Number.isFinite(v)) => {
    const vs = c.map((x) => x[campo]).filter(valido);
    return vs.length ? vs.reduce((s, v) => s + v, 0) / vs.length : null;
  };
  const series = { v: 1, t: lleno.map((c) => Math.round(c[0].t - t0)) };
  const campo = (nombre, origen, dec, valido) => {
    const arr = lleno.map((c) => redondea(media(c, origen, valido), dec));
    if (arr.some((v) => v !== null)) series[nombre] = arr;
  };
  campo('fc', 'fc', 0, esPulso);
  campo('vel', 'vel', 2);
  campo('alt', 'alt', 1);
  campo('cad', 'cad', 0, (v) => typeof v === 'number' && v > 0);
  campo('pot', 'pot', 0, (v) => typeof v === 'number' && v > 0);
  // La distancia no se promedia: es la del último punto del tramo.
  if (m.some((x) => typeof x.dist === 'number')) series.dist = lleno.map((c) => redondea([...c].reverse().find((x) => typeof x.dist === 'number')?.dist ?? null, 0));
  // La ruta: puntos con coordenada, repartidos parejo.
  const conRuta = m.filter((x) => esCoordenada(x.lat, x.lon));
  if (conRuta.length >= 2) {
    const paso = Math.max(1, Math.ceil(conRuta.length / maxRuta));
    const puntos = conRuta.filter((_, i) => i % paso === 0);
    if (puntos[puntos.length - 1] !== conRuta[conRuta.length - 1]) puntos.push(conRuta[conRuta.length - 1]);
    series.ruta = { t: puntos.map((x) => Math.round(x.t - t0)), lat: puntos.map((x) => redondea(x.lat, 5)), lon: puntos.map((x) => redondea(x.lon, 5)) };
  }
  return series;
}
