/* TRAZAS SINTÉTICAS del GPS y el sensor de movimiento (formato `traza-gps/2`, ver `src/lib/trazaGps.js`), para `scripts/prueba-ruta.mjs`.
   Cada una reproduce una falla que se vio en la calle. `node scripts/trazas-sinteticas.mjs` vuelve a escribir las de `scripts/trazas/` (las reales del iPhone van
   junto a ellas y no se tocan). Puro: solo arma objetos. */
import { writeFileSync } from 'node:fs';
import { FORMATO_DE_TRAZA } from '../src/lib/trazaGps.js';

const POR_GRADO_LAT = 111195;
const POR_GRADO_LON = POR_GRADO_LAT * Math.cos(19.4 * Math.PI / 180);
const INICIO_MS = Date.parse('2026-11-02T18:00:00Z');
const azar = (semilla) => () => { semilla = (semilla + 0x6D2B79F5) | 0; let x = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
const tres = (x) => Math.round(x * 1000) / 1000;

/**
 * Una traza: `segundos` puntos (uno por segundo, a los k + 0.4 s). `real(k)`: dónde va de verdad (metros al norte, `y`) y la velocidad que da el iPhone.
 * `calle`: la mala geometría entre edificios (error 15-20 m y el GPS «caminando» a ~0.9 m/s con la posición). `eventos`: lo que avisa el sensor.
 */
function traza({ nombre, nota, deporte, segundos, semilla = 1, calle = false, real, eventos, esperado }) {
  const r = azar(semilla);
  let dx = 0; let dy = 0; let dir = 0; let quedan = 0;
  const filas = [];
  for (let k = 0; k < segundos; k += 1) {
    const yo = real(k);
    let pre = 5 + r() * 2;
    let vel = yo.vel;
    // El temblor de un GPS bueno, ya filtrado por el iPhone: ±0.15 m de lado.
    let lado = (r() - 0.5) * 0.3;
    if (calle) {
      // Cada 10-25 s el GPS «camina» a 0.75-1.1 m/s hacia otro lado; lejos de verdad (más de 15 m), regresa de golpe.
      if (quedan <= 0) { if (Math.hypot(dx, dy) > 15) { dx *= 0.2; dy *= 0.2; } dir = r() * 2 * Math.PI; quedan = 10 + r() * 15; }
      const v = 0.75 + r() * 0.35;
      dx += Math.cos(dir) * v; dy += Math.sin(dir) * v; quedan -= 1;
      pre = 15.5 + r() * 4;
      vel = v + (r() - 0.5) * 0.1;
      lado = 0;
    }
    filas.push({ t: tres(k + 0.4), lat: tres((19.4 + (yo.y + dy) / POR_GRADO_LAT) * 1000) / 1000, lon: tres((-99.1 + (dx + lado) / POR_GRADO_LON) * 1000) / 1000, pre: Math.round(pre * 10) / 10, ...(vel != null ? { vel: Math.round(vel * 100) / 100 } : {}), v: null });
  }
  const todos = [{ t: 0, tipo: 'enciende' }, { t: 0.05, tipo: 'inicio', actividad: true, pasos: true, permiso: 'si' }, ...eventos].sort((a, b) => a.t - b.t);
  return { formato: FORMATO_DE_TRAZA, deporte, inicio: new Date(INICIO_MS).toISOString(), inicioMs: INICIO_MS, app: 'iphone', nota: `SINTÉTICA: ${nota}`, ...(esperado ? { esperado } : {}), nombre, filas, eventos: todos };
}

/** Avisos del podómetro cada `cada` s entre `desde` y `hasta`, de `porAviso` pasos cada uno; `cuenta` lleva el total (los pasos son desde que se encendió). */
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

/** 3 min quieto en la calle entre edificios (bug del 2 nov): el sensor dice «quieto» al segundo y medio. */
export const calle = (semilla = 104729) => traza({
  nombre: 'quieto-calle-sintetica.json', semilla, deporte: 'caminar', segundos: 180, calle: true,
  nota: '3 min quieto entre edificios, error 15-20 m, el iPhone da ~0.9 m/s y la posición se va con esa velocidad; el sensor dice «quieto» al segundo y medio.',
  real: () => ({ y: 0, vel: null }), eventos: [actividad(1.5, 'quieto', 1.5)],
});

/** 20 s quieto y 145 s caminando a 1.4 m/s: los pasos llegan cada 1.5 s (el podómetro se atrasa) y el sensor dice «caminando» a los 4 s. */
export function caminar() {
  const cuenta = { n: 0 };
  return traza({
    nombre: 'caminar', deporte: 'caminar', segundos: 165, semilla: 7, nota: 'caminar 200 m después de 20 s quieto',
    real: (k) => (k < 20 ? { y: 0, vel: 0 } : { y: (k - 20) * 1.4, vel: 1.4 }),
    eventos: [actividad(1.5, 'quieto', 0), ...podometro(cuenta, 21.5, 170, { cada: 1.5, porAviso: 3, cadencia: 2.0 }), actividad(24.5, 'caminando', 20.5)],
  });
}

/** Correr parejo `segundos` a `vel` m/s con el sensor en «corriendo»; `vistazos`: los segundos en que se gira el teléfono (6 s sin pasos cada vez). */
export function correr({ segundos = 376, vel = 1000 / 300, vistazos = [], nombre = 'correr', nota = 'correr parejo', esperado } = {}) {
  const cuenta = { n: 0 };
  const sinPasos = (t) => vistazos.some((v) => t >= v && t < v + 6);
  return traza({
    nombre, nota, esperado, deporte: 'correr', segundos, semilla: 11,
    real: (k) => ({ y: k * vel, vel }),
    eventos: [actividad(0.5, 'corriendo', 0), ...podometro(cuenta, 1, segundos + 1, { saltar: sinPasos })],
  });
}

/** FALLA 1 (3 nov): 3 min corriendo con el teléfono en la mano, y 5 veces lo gira para ver la hora: 6 s sin pasos, el sensor sigue en «corriendo». */
export const vistazos = () => correr({
  segundos: 180, vel: 3.3, vistazos: [30, 60, 90, 120, 150], nombre: 'corriendo-vistazos-sintetica.json', esperado: { sinPausas: true },
  nota: '3 min corriendo a 3.3 m/s; 5 veces gira el teléfono para ver la hora (6 s sin pasos cada vez); el sensor sigue en «corriendo» con confianza alta.',
});

/**
 * FALLA 2 (3 nov): corre 30 s y se detiene en seco. Al detenerse, dos pasos fantasma (a los 1.6 y 3.6 s, con cadencia 1.5) y el sensor cambia a «quieto» 12 s
 * tarde. Quieto hasta los 60 s y vuelve a correr.
 */
export function fantasma() {
  const cuenta = { n: 0 };
  const y = (k) => (k <= 30 ? k * 3.3 : (k < 60 ? 99 + 1.2 : 100.2 + (k - 60) * 3.3));
  const vel = (k) => (k < 30 ? 3.3 : k === 30 ? 1.2 : k === 31 ? 0.3 : k < 60 ? 0.1 : k === 60 ? 1.5 : 3.3);
  const ev = [actividad(0.5, 'corriendo', 0), ...podometro(cuenta, 1, 31)];
  cuenta.n += 1; ev.push({ t: 31.6, tipo: 'pasos', pasos: cuenta.n, en: 31.3, cadencia: 1.5 });
  cuenta.n += 1; ev.push({ t: 33.6, tipo: 'pasos', pasos: cuenta.n, en: 33.3, cadencia: 1.5 });
  ev.push(actividad(42, 'quieto', 42));
  ev.push(...podometro(cuenta, 61, 90));
  ev.push(actividad(64, 'corriendo', 60.5));
  return traza({
    nombre: 'detenerse-fantasma-sintetica.json', deporte: 'correr', segundos: 90, semilla: 13,
    nota: 'corre 30 s y se detiene en seco a los 30 s; dos pasos fantasma (31.6 y 33.6 s, cadencia 1.5); el sensor dice «quieto» 12 s tarde (42 s); a los 60 s vuelve a correr.',
    esperado: { pausaAntesDe: 36, sinReanudarAntesDe: 60, reanudaAntesDe: 64 },
    real: (k) => ({ y: y(k), vel: vel(k) }), eventos: ev,
  });
}

// `node scripts/trazas-sinteticas.mjs`: escribe las de `scripts/trazas/`.
if (import.meta.url === `file://${process.argv[1]}`) {
  for (const t of [calle(), vistazos(), fantasma()]) {
    const { nombre, ...resto } = t;
    writeFileSync(new URL(`./trazas/${nombre}`, import.meta.url), JSON.stringify(resto));
    console.log(`escrita scripts/trazas/${nombre}: ${t.filas.length} puntos, ${t.eventos.length} avisos del sensor`);
  }
}
