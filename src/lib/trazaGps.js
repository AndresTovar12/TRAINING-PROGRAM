/* LA TRAZA DEL GPS (2 nov 2026, bug «parado en la calle sumó 50 m»). Para probar con lo que pasó de verdad en la calle, y no con ruido inventado.

   Solo cuentas de prueba (y el dueño): en «Ajustes de la carrera», «Guardar traza del GPS». Con eso, cada punto que llega en una carrera con GPS se anota con
   lo que dijo el sensor de movimiento, y «Exportar la última traza» la entrega como archivo JSON (en el iPhone, el menú de compartir: Archivos, AirDrop…).
   `scripts/prueba-ruta.mjs` la reproduce con `reproduceTraza`, que pasa cada punto por `pasoDeCarrera`: lo mismo que hace la carrera.

   EL FORMATO (`traza-gps/1`): `{ formato, deporte, inicio (ISO), inicioMs, app ('iphone' | 'web'), filas }`. Cada fila, un punto:
     `{ t (s desde el inicio), lat, lon, pre (error, m), vel?, rumbo?, s?, v }`
     · `s`: el sensor en ese momento, en segundos desde el inicio: `{ vivo, hayPasos, act?, conf?, actEn?, pasos, pasoEn?, desde }` (sin sensor, no va).
     · `v`: lo que decidió ('quieto' | 'mueve' | null).
   Vive en el teléfono (`localStorage`, solo la última, hasta 3 horas) y nunca se sube. */

import { carreraNueva, pasoDeCarrera } from './pasoDeCarrera.js';
import { cronometroNuevo } from './entrenoLibre.js';
import { enVivo } from './ubicacion.js';

export const FORMATO_DE_TRAZA = 'traza-gps/1';
const LLAVE_ENCENDIDA = 'ajustes:traza-gps';
const LLAVE_TRAZA = 'tl:traza-gps';
const MAXIMO_DE_FILAS = 3 * 3600;
const GUARDA_CADA_MS = 10000;

const uno = (x) => Math.round(x * 10) / 10;
const seis = (x) => Math.round(x * 1e6) / 1e6;
const relativo = (ms, inicioMs) => (typeof ms === 'number' ? uno((ms - inicioMs) / 1000) : undefined);
const absoluto = (s, inicioMs) => (typeof s === 'number' ? inicioMs + s * 1000 : null);

/** Un punto como fila de la traza (puro). */
export function filaDeTraza(punto, sensor, v, ahoraMs, inicioMs) {
  const f = { t: relativo(ahoraMs, inicioMs), lat: seis(punto.lat), lon: seis(punto.lon), pre: uno(punto.precision) };
  if (typeof punto.vel === 'number') f.vel = Math.round(punto.vel * 100) / 100;
  if (typeof punto.rumbo === 'number') f.rumbo = Math.round(punto.rumbo);
  if (sensor) {
    f.s = { vivo: !!sensor.vivo, hayPasos: !!sensor.hayPasos, pasos: sensor.pasos ?? 0, desde: relativo(sensor.desde, inicioMs) };
    if (sensor.actividad) Object.assign(f.s, { act: sensor.actividad.estado, conf: sensor.actividad.confianza, actEn: relativo(sensor.actividad.en, inicioMs) });
    if (sensor.pasoEn != null) f.s.pasoEn = relativo(sensor.pasoEn, inicioMs);
  }
  f.v = v?.v ?? null;
  return f;
}

/** El sensor de una fila, otra vez como lo arma `sensorDeMovimiento.js` (puro). `null` si la fila no traía sensor (la web). */
export function sensorDeFila(f, inicioMs) {
  if (!f?.s) return null;
  const s = f.s;
  return {
    desde: absoluto(s.desde, inicioMs) ?? inicioMs, hayActividad: !!s.act, hayPasos: !!s.hayPasos, permiso: s.vivo ? 'si' : null, vivo: !!s.vivo,
    actividad: s.act ? { estado: s.act, confianza: s.conf ?? 0, en: absoluto(s.actEn, inicioMs) ?? inicioMs } : null,
    pasos: s.pasos ?? 0, pasoEn: absoluto(s.pasoEn, inicioMs),
  };
}

/**
 * Reproduce una traza como si fuera la carrera (puro): cada fila pasa por `pasoDeCarrera`. `sinSensor`: como si no hubiera sensor (las reglas del GPS solas).
 * Devuelve `{ distanciaM, pausas: [s desde el inicio], reanudas: [s], metros: [los contados después de cada fila], muestras }`.
 */
export function reproduceTraza(traza, { sinSensor = false, pausaAutomatica = true } = {}) {
  const inicioMs = traza.inicioMs ?? 0;
  let e = carreraNueva({ ...cronometroNuevo(traza.deporte ?? 'correr', inicioMs), gps: true });
  const pausas = [];
  const reanudas = [];
  const metros = [];
  for (const f of traza.filas ?? []) {
    const ahoraMs = inicioMs + f.t * 1000;
    const punto = { lat: f.lat, lon: f.lon, precision: f.pre, ...(typeof f.vel === 'number' ? { vel: f.vel } : {}), ...(typeof f.rumbo === 'number' ? { rumbo: f.rumbo } : {}) };
    e = pasoDeCarrera(e, punto, ahoraMs, { sensor: sinSensor ? null : sensorDeFila(f, inicioMs), pausaAutomatica });
    if (e.accion === 'pausa') pausas.push(f.t);
    if (e.accion === 'reanuda') reanudas.push(f.t);
    metros.push(e.metros);
  }
  return { distanciaM: enVivo(e.muestras).distanciaM, pausas, reanudas, metros, muestras: e.muestras };
}

/* ------------------------------ La grabación (en el teléfono) ------------------------------ */

let actual = null;
let reloj = null;

export function trazaEncendida() {
  try { return localStorage.getItem(LLAVE_ENCENDIDA) === '1'; } catch { return false; }
}
export function ponTrazaEncendida(si) {
  try { if (si) localStorage.setItem(LLAVE_ENCENDIDA, '1'); else localStorage.removeItem(LLAVE_ENCENDIDA); } catch { /* sin almacenamiento: no se graba */ }
}

function guarda() {
  clearTimeout(reloj);
  reloj = null;
  if (!actual) return;
  try { localStorage.setItem(LLAVE_TRAZA, JSON.stringify(actual)); } catch { /* lleno: se queda solo en memoria hasta cerrar la app */ }
}

/** La traza guardada en el teléfono (la que va, o la última), o `null`. */
export function ultimaTraza() {
  if (actual) return actual;
  try {
    const t = JSON.parse(localStorage.getItem(LLAVE_TRAZA) ?? 'null');
    return t?.formato === FORMATO_DE_TRAZA && Array.isArray(t.filas) ? t : null;
  } catch { return null; }
}

/** Empieza a grabar la carrera que arrancó en `inicioMs` (borra la anterior). Si ya había una de esa misma carrera (se recargó la página), sigue esa. */
export function empiezaTraza({ deporte, inicioMs, app }) {
  const previa = actual ?? ultimaTraza();
  actual = previa?.inicioMs === inicioMs ? previa : { formato: FORMATO_DE_TRAZA, deporte, inicio: new Date(inicioMs).toISOString(), inicioMs, app, filas: [] };
  guarda();
}

/** ¿Se está grabando la carrera que arrancó en `inicioMs`? */
export const grabaTraza = (inicioMs) => actual?.inicioMs === inicioMs;

/** Anota un punto (se guarda en el teléfono cada 10 s). */
export function anotaEnTraza(punto, sensor, v, ahoraMs) {
  if (!actual || actual.filas.length >= MAXIMO_DE_FILAS) return;
  actual.filas.push(filaDeTraza(punto, sensor, v, ahoraMs, actual.inicioMs));
  if (!reloj) reloj = setTimeout(guarda, GUARDA_CADA_MS);
}

/** La carrera terminó: se guarda lo que falte y se deja de grabar (la traza se queda para exportarla). */
export function cierraTraza() {
  guarda();
  actual = null;
}

/** «traza-gps-2026-11-02-1834.json» (la hora en que empezó, la del teléfono). */
export function nombreDeTraza(traza) {
  const d = new Date(traza?.inicioMs ?? Date.now());
  const dos = (n) => String(n).padStart(2, '0');
  return `traza-gps-${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}-${dos(d.getHours())}${dos(d.getMinutes())}.json`;
}
