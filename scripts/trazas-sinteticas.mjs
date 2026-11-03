/* TRAZAS SINTÉTICAS del GPS y el sensor de movimiento (formato `traza-gps/3`, ver `src/lib/trazaGps.js`), para `scripts/prueba-ruta.mjs`.
   Cada una reproduce una situación de la calle (las 8 de la sección B6 de `docs/superpowers/specs/2026-11-03-pausa-automatica-rebote.md`, y el «parado entre
   edificios» del 2 nov). Llevan los avisos de rebote (uno por segundo), los del podómetro y los de la actividad (así también se ve qué hacía el código de antes),
   y sus `paradas` de verdad. `node scripts/trazas-sinteticas.mjs` vuelve a escribir las de `scripts/trazas/` (las reales del iPhone van junto a ellas y no se
   tocan). Puro: solo arma objetos. */
import { writeFileSync } from 'node:fs';
import { FORMATO_DE_TRAZA } from '../src/lib/trazaGps.js';

const POR_GRADO_LAT = 111195;
const POR_GRADO_LON = POR_GRADO_LAT * Math.cos(19.4 * Math.PI / 180);
const INICIO_MS = Date.parse('2026-11-03T18:00:00Z');
const azar = (semilla) => () => { semilla = (semilla + 0x6D2B79F5) | 0; let x = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
const tres = (x) => Math.round(x * 1000) / 1000;
const seis = (x) => Math.round(x * 1e6) / 1e6;

/** Rebote típico (g): corriendo, caminando, con el teléfono en las manos y parado. */
export const REBOTE = { corriendo: 0.45, caminando: 0.25, manos: 0.25, parado: 0.02 };

/**
 * Una traza. Puntos del GPS a los k + 0.4 s. `real(t)`: dónde va de verdad (`y`, metros al norte), a qué velocidad (`vel`, la que da el iPhone) y cómo está el GPS
 * (`gps`: 'bueno' | 'calle' (error 15-20 m y el GPS «caminando» ~0.9 m/s con excursiones, 2 nov) | 'deriva' (error 25 m inventando 0.9 m/s) | 'tunel' (error
 * 45 m)). `rebote(k)`: el valor del aviso del segundo k (cubre de k − 1 a k). `eventos`: los del podómetro y la actividad.
 */
function traza({ nombre, nota, deporte, desplazamiento, segundos, semilla = 1, real, rebote, eventos = [], paradas = [], esperado }) {
  const r = azar(semilla);
  let dx = 0; let dy = 0; let dir = r() * 2 * Math.PI; let quedan = 0;
  const filas = [];
  for (let k = 0; k < segundos; k += 1) {
    const t = k + 0.4;
    const yo = real(t);
    let pre = 5 + r() * 2;
    let vel = yo.vel;
    let lado = (r() - 0.5) * 0.3; // el temblor de un GPS bueno, ya filtrado por el iPhone
    if (yo.gps === 'calle') {
      if (quedan <= 0) { if (Math.hypot(dx, dy) > 15) { dx *= 0.2; dy *= 0.2; } dir = r() * 2 * Math.PI; quedan = 10 + r() * 15; }
      const v = 0.75 + r() * 0.35;
      dx += Math.cos(dir) * v; dy += Math.sin(dir) * v; quedan -= 1;
      pre = 15.5 + r() * 4; vel = v + (r() - 0.5) * 0.1; lado = 0;
    } else if (yo.gps === 'deriva') {
      dx += Math.cos(dir) * 0.9; dy += Math.sin(dir) * 0.9;
      pre = 24 + r() * 2; vel = 0.85 + r() * 0.1; lado = 0;
    } else if (yo.gps === 'tunel') {
      pre = 40 + r() * 10; lado = (r() - 0.5) * 40;
    } else { dx = 0; dy = 0; }
    filas.push({ t: tres(t), lat: seis(19.4 + (yo.y + dy) / POR_GRADO_LAT), lon: seis(-99.1 + (dx + lado) / POR_GRADO_LON), pre: Math.round(pre * 10) / 10, ...(vel != null ? { vel: Math.round(vel * 100) / 100 } : {}), v: null });
  }
  const rebotes = [];
  for (let k = 1; k <= segundos; k += 1) {
    const v = rebote(k);
    if (v != null) rebotes.push({ t: k, tipo: 'rebote', en: k, valor: tres(v * (0.8 + r() * 0.4)) });
  }
  const todos = [{ t: 0, tipo: 'enciende' }, { t: 0.05, tipo: 'inicio', actividad: true, pasos: true, hayRebote: true, permiso: 'si' }, ...eventos, ...rebotes].sort((a, b) => a.t - b.t);
  return { formato: FORMATO_DE_TRAZA, deporte, desplazamiento, inicio: new Date(INICIO_MS).toISOString(), inicioMs: INICIO_MS, app: 'iphone', nota: `SINTÉTICA: ${nota}`, paradas, ...(esperado ? { esperado } : {}), nombre, filas, eventos: todos };
}

/** Avisos del podómetro cada `cada` s entre `desde` y `hasta`, de `porAviso` pasos cada uno; `cuenta` lleva el total. `saltar(t)`: los que no llegan. */
function podometro(cuenta, desde, hasta, { cada = 1, porAviso = 3, cadencia = 2.8, saltar = () => false } = {}) {
  const ev = [];
  for (let t = desde; t < hasta; t += cada) {
    if (saltar(t)) continue;
    cuenta.n += porAviso;
    ev.push({ t: tres(t), tipo: 'pasos', pasos: cuenta.n, en: tres(t - 0.3), ...(cadencia != null ? { cadencia } : {}) });
  }
  return ev;
}
const actividad = (t, estado, en, confianza = 2) => ({ t, tipo: 'movimiento', estado, confianza, en });
const corre = (v = 3.3, desde = 0, y0 = 0) => (t) => ({ y: y0 + (t - desde) * v, vel: v, gps: 'bueno' });

/** El 2 nov: 3 min quieto entre edificios (error 15-20 m, el iPhone da ~0.9 m/s y la posición se va con esa velocidad). Sin rebote. */
export const calle = (semilla = 104729) => traza({
  nombre: 'quieto-calle-sintetica.json', semilla, deporte: 'caminar', desplazamiento: 'pie', segundos: 180,
  nota: '3 min quieto entre edificios, error 15-20 m, el iPhone da ~0.9 m/s y la posición se va con esa velocidad; sin rebote.',
  real: () => ({ y: 0, vel: null, gps: 'calle' }), rebote: () => REBOTE.parado, eventos: [actividad(1.5, 'quieto', 1.5)], paradas: [[0, 180]],
  esperado: { maxMetros: 5, pausaAntesDe: 10 },
});

/** 20 s quieto y 145 s caminando a 1.4 m/s (rebote de caminar). */
export function caminar() {
  const cuenta = { n: 0 };
  return traza({
    nombre: 'caminar', deporte: 'caminar', desplazamiento: 'pie', segundos: 165, semilla: 7, nota: 'caminar 200 m después de 20 s quieto',
    real: (t) => (t < 20 ? { y: 0, vel: 0, gps: 'bueno' } : { y: (t - 20) * 1.4, vel: 1.4, gps: 'bueno' }),
    rebote: (k) => (k <= 20 ? REBOTE.parado : REBOTE.caminando),
    eventos: [actividad(1.5, 'quieto', 0), ...podometro(cuenta, 21.5, 170, { cada: 1.5, porAviso: 3, cadencia: 2.0 }), actividad(24.5, 'caminando', 20.5)],
    paradas: [[0, 20]],
  });
}

/** Correr parejo `segundos` a `vel` m/s, con rebote y pasos todo el tiempo. */
export function correr({ segundos = 376, vel = 1000 / 300 } = {}) {
  const cuenta = { n: 0 };
  return traza({
    nombre: 'correr', nota: 'correr parejo', deporte: 'correr', desplazamiento: 'pie', segundos, semilla: 11, real: corre(vel), rebote: () => REBOTE.corriendo,
    eventos: [actividad(0.5, 'corriendo', 0), ...podometro(cuenta, 1, segundos + 1)],
  });
}

/* LAS 8 DE B6 ---------------------------------------------------------------------------------------------------------------------------------------------- */

/** 1. Corriendo parejo; el podómetro se calla 9 s (40-49) y a la mitad una lectura del GPS sale a 0.3 m/s. No pausa. */
export function podometroCallado() {
  const cuenta = { n: 0 };
  const base = corre();
  return traza({
    nombre: 'corriendo-podometro-callado-sintetica.json', deporte: 'correr', desplazamiento: 'pie', segundos: 120, semilla: 21,
    nota: 'B6.1: corriendo a 3.3 m/s; el podómetro se calla 9 s (40-49 s) y la lectura de los 45.4 s sale a 0.3 m/s; el rebote sigue.',
    real: (t) => ({ ...base(t), ...(Math.abs(t - 45.4) < 0.01 ? { vel: 0.3 } : {}) }), rebote: () => REBOTE.corriendo,
    eventos: [actividad(0.5, 'corriendo', 0), ...podometro(cuenta, 1, 121, { saltar: (t) => t >= 40 && t < 49 })],
    esperado: { sinPausas: true },
  });
}

/** 2. Corriendo 3 min y 5 veces gira el teléfono para ver la hora: 6 s sin pasos, la actividad baja a confianza media; el rebote sigue (algo menor). No pausa. */
export function girarElTelefono() {
  const cuenta = { n: 0 };
  const vistazos = [30, 60, 90, 120, 150];
  const enVistazo = (t) => vistazos.some((v) => t >= v && t < v + 6);
  const ev = [actividad(0.5, 'corriendo', 0), ...podometro(cuenta, 1, 181, { saltar: enVistazo })];
  vistazos.forEach((v) => ev.push(actividad(v + 1, 'corriendo', 0, 1), actividad(v + 8, 'corriendo', 0, 2)));
  return traza({
    nombre: 'corriendo-girar-telefono-sintetica.json', deporte: 'correr', desplazamiento: 'pie', segundos: 180, semilla: 22,
    nota: 'B6.2: 3 min corriendo a 3.3 m/s; 5 veces gira el teléfono para ver la hora (6 s sin pasos; la actividad baja a confianza media); el rebote sigue, algo menor.',
    real: corre(), rebote: (k) => (enVistazo(k - 0.5) ? 0.3 : REBOTE.corriendo), eventos: ev, esperado: { sinPausas: true },
  });
}

/** 3. Corre 30 s y para de golpe: rebote a cero; el GPS con error 25 m inventa 0.9 m/s; la actividad dice «quieto» 12 s tarde. Pausa en ≤ 2 s. */
export function pararDeGolpe() {
  const cuenta = { n: 0 };
  return traza({
    nombre: 'detenerse-de-golpe-sintetica.json', deporte: 'correr', desplazamiento: 'pie', segundos: 60, semilla: 23,
    nota: 'B6.3: corre 30 s a 3.3 m/s y para de golpe a los 30 s; el rebote cae a cero; el GPS con error 25 m inventa 0.9 m/s; la actividad dice «quieto» 12 s tarde.',
    real: (t) => (t < 30 ? corre()(t) : { y: 99, vel: null, gps: 'deriva' }), rebote: (k) => (k <= 30 ? REBOTE.corriendo : REBOTE.parado),
    eventos: [actividad(0.5, 'corriendo', 0), ...podometro(cuenta, 1, 31), actividad(42, 'quieto', 42)],
    paradas: [[30, 60]], esperado: { pausaAntesDe: 32, maxMetros: 105 },
  });
}

/** 4. Parado; a los 20-30 s mueve el teléfono con las manos: rebote sí (y el podómetro cuenta pasos falsos), el GPS sin avance. Sigue en pausa. */
export function moverElTelefono() {
  const cuenta = { n: 0 };
  return traza({
    nombre: 'parado-moviendo-telefono-sintetica.json', deporte: 'correr', desplazamiento: 'pie', segundos: 60, semilla: 24,
    nota: 'B6.4: parado 60 s con buen GPS; de los 20 a los 30 s mueve el teléfono con las manos (rebote 0.25 g y el podómetro cuenta 2 pasos falsos por segundo).',
    real: () => ({ y: 0, vel: 0.1, gps: 'bueno' }), rebote: (k) => (k > 20 && k <= 30 ? REBOTE.manos : REBOTE.parado),
    eventos: [actividad(1, 'quieto', 0), ...podometro(cuenta, 21, 31, { porAviso: 2, cadencia: 1.6 }), actividad(22, 'caminando', 21, 1), actividad(33, 'quieto', 31)],
    paradas: [[0, 60]], esperado: { pausaAntesDe: 3, sinReanudarAntesDe: 60 },
  });
}

/** 5. Parado 40 s y vuelve a correr: rebote y avance. Reanuda en ≤ 2 s. */
export function volverACorrer() {
  const cuenta = { n: 0 };
  return traza({
    nombre: 'volver-a-correr-sintetica.json', deporte: 'correr', desplazamiento: 'pie', segundos: 80, semilla: 25,
    nota: 'B6.5: parado 40 s con buen GPS y a los 40 s vuelve a correr a 3.3 m/s (rebote desde ese segundo; el podómetro y la actividad, con su atraso de siempre).',
    real: (t) => (t < 40 ? { y: 0, vel: 0.1, gps: 'bueno' } : corre(3.3, 40)(t)), rebote: (k) => (k <= 40 ? REBOTE.parado : REBOTE.corriendo),
    eventos: [actividad(1, 'quieto', 0), ...podometro(cuenta, 41, 81), actividad(45, 'corriendo', 40.5)],
    paradas: [[0, 40]], esperado: { sinReanudarAntesDe: 40, reanudaAntesDe: 42 },
  });
}

/** 6. Corriendo, 15 s de túnel (40-55): ningún punto con error ≤ 20 m; el rebote sigue. No pausa. */
export function tunel() {
  const cuenta = { n: 0 };
  const base = corre();
  return traza({
    nombre: 'corriendo-tunel-sintetica.json', deporte: 'correr', desplazamiento: 'pie', segundos: 90, semilla: 26,
    nota: 'B6.6: corriendo a 3.3 m/s; de los 40 a los 55 s, un túnel: todos los puntos con error de 40-50 m; el rebote sigue.',
    real: (t) => ({ ...base(t), ...(t >= 40 && t < 55 ? { gps: 'tunel', vel: null } : {}) }), rebote: () => REBOTE.corriendo,
    eventos: [actividad(0.5, 'corriendo', 0), ...podometro(cuenta, 1, 91)], esperado: { sinPausas: true },
  });
}

/** 7. Bici: 40 s a 5 m/s, frena en 3 s al semáforo, 30 s parado entre edificios (error 25 m, el GPS inventa 0.9 m/s), sin «en bici»; vuelve a pedalear a 5 m/s. */
export function biciSemaforo() {
  const y = (t) => {
    if (t < 37) return t * 5;
    if (t < 40) { const d = t - 37; return 185 + 5 * d - (5 / 6) * d * d; }
    if (t < 70) return 192.5;
    if (t < 72) { const d = t - 70; return 192.5 + 1.25 * d * d; }
    return 197.5 + (t - 72) * 5;
  };
  const vel = (t) => (t < 37 ? 5 : t < 40 ? 5 - (5 / 3) * (t - 37) : t < 70 ? null : t < 72 ? 2.5 * (t - 70) : 5);
  return traza({
    nombre: 'bici-semaforo-sintetica.json', deporte: 'bici', desplazamiento: 'ruedas', segundos: 100, semilla: 27,
    nota: 'B6.7: bici a 5 m/s; frena en 3 s y para en el semáforo a los 40 s; 30 s parada entre edificios (error 25 m, el GPS inventa 0.9 m/s), sin «en bici»; a los 70 s pedalea otra vez (5 m/s en 2 s).',
    real: (t) => ({ y: y(t), vel: vel(t), gps: t >= 40 && t < 70 ? 'deriva' : 'bueno' }), rebote: () => 0.05,
    eventos: [actividad(1, 'desconocido', 0, 0)],
    // El contrato pide la pausa en ≤ 4 s. Con sus reglas (desplazamiento de 5 s < 1.0 m/s durante 3 s) no se puede: el promedio de 5 s baja de 1.0 m/s
    // hasta ~3 s después de frenar y luego faltan 3 s más. Queda marcado como pendiente: la prueba lo dice sin fallar, hasta que el dueño decida.
    paradas: [[40, 70]], esperado: { pausaAntesDe: 44, sinReanudarAntesDe: 70, reanudaAntesDe: 73, pendiente: ['pausaAntesDe'] },
  });
}

/** 8. Bici rodando a 3 m/s con una lectura mala (a los 60.4 s: 15 m atrás y 0.2 m/s). No pausa. */
export function biciLecturaMala() {
  return traza({
    nombre: 'bici-lectura-mala-sintetica.json', deporte: 'bici', desplazamiento: 'ruedas', segundos: 120, semilla: 28,
    nota: 'B6.8: bici a 3 m/s, 2 min; la lectura de los 60.4 s sale mala (15 m atrás, 0.2 m/s).',
    real: (t) => (Math.abs(t - 60.4) < 0.01 ? { y: t * 3 - 15, vel: 0.2, gps: 'bueno' } : { y: t * 3, vel: 3, gps: 'bueno' }), rebote: () => 0.05,
    eventos: [actividad(1, 'desconocido', 0, 0)], esperado: { sinPausas: true },
  });
}

/** Las que se escriben en `scripts/trazas/`. */
export const ESCRITAS = [calle, podometroCallado, girarElTelefono, pararDeGolpe, moverElTelefono, volverACorrer, tunel, biciSemaforo, biciLecturaMala];

// `node scripts/trazas-sinteticas.mjs`: escribe las de `scripts/trazas/`.
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const hace of ESCRITAS) {
    const { nombre, ...resto } = hace();
    writeFileSync(new URL(`./trazas/${nombre}`, import.meta.url), JSON.stringify(resto));
    console.log(`escrita scripts/trazas/${nombre}: ${resto.filas.length} puntos, ${resto.eventos.length} avisos del sensor`);
  }
}
