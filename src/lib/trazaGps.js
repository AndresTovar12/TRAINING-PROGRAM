/* LA TRAZA DEL GPS (2 nov 2026, bug «parado en la calle sumó 50 m»). Para probar con lo que pasó de verdad en la calle, y no con ruido inventado.

   Solo cuentas de prueba (y el dueño): en «Ajustes de la carrera», «Guardar traza del GPS». Con eso, en una carrera con GPS se anota cada punto y cada aviso
   del sensor de movimiento, y «Exportar la última traza» la entrega como archivo JSON (en el iPhone, el menú de compartir: Archivos, AirDrop…).
   `scripts/prueba-ruta.mjs` la reproduce con `reproduceTraza`: los avisos del sensor pasan por las mismas funciones que en el teléfono
   (`lib/sensorDeMovimiento.js`) y cada punto por `pasoDeCarrera`. Lo mismo que hace la carrera.

   EL FORMATO (`traza-gps/2`, 3 nov 2026): `{ formato, deporte, inicio (ISO), inicioMs, app ('iphone' | 'web'), filas, eventos }`. Tiempos en segundos desde el inicio.
     · Cada FILA, un punto del GPS: `{ t, lat, lon, pre (error, m), vel?, rumbo?, v }` (`v`: lo que decidió `decideMarcha`: 'mueve' | 'quieto' | 'espera' | null).
     · Cada EVENTO, un aviso del sensor tal como llegó: `{ t, tipo, ... }` con `tipo` 'enciende' | 'inicio' | 'movimiento' | 'pasos' | 'permiso' | 'falla' |
       'apaga' y sus datos (`en`, la hora que trae el aviso, también en segundos desde el inicio). Los de 'pasos' llevan `pasos`, `en`, `cadencia?` y `ritmo?`.
   La `traza-gps/1` (build 79) guardaba en cada fila un resumen del sensor (`s`) sin la cadencia; se sigue leyendo (`eventosDeV1`), con la cadencia de los pasos
   contados. Vive en el teléfono (`localStorage`, solo la última, hasta 3 horas) y nunca se sube. */

import { carreraNueva, pasoDeCarrera } from './pasoDeCarrera.js';
import { cronometroNuevo } from './entrenoLibre.js';
import { enVivo } from './ubicacion.js';
import { conActividad, conInicio, conPasos, conPermiso, sensorNuevo, sinPasos } from './sensorDeMovimiento.js';

export const FORMATO_DE_TRAZA = 'traza-gps/2';
const FORMATOS_QUE_SE_LEEN = ['traza-gps/1', FORMATO_DE_TRAZA];
const LLAVE_ENCENDIDA = 'ajustes:traza-gps';
const LLAVE_TRAZA = 'tl:traza-gps';
const MAXIMO_DE_FILAS = 3 * 3600;
const MAXIMO_DE_EVENTOS = 6 * 3600;
const GUARDA_CADA_MS = 10000;

const uno = (x) => Math.round(x * 10) / 10;
const seis = (x) => Math.round(x * 1e6) / 1e6;
const relativo = (ms, inicioMs) => (typeof ms === 'number' ? Math.round(ms - inicioMs) / 1000 : undefined);
const absoluto = (s, inicioMs) => (typeof s === 'number' ? inicioMs + s * 1000 : null);

/** Un punto como fila de la traza (puro). `v`: lo que decidió `decideMarcha`. */
export function filaDeTraza(punto, v, ahoraMs, inicioMs) {
  const f = { t: relativo(ahoraMs, inicioMs), lat: seis(punto.lat), lon: seis(punto.lon), pre: uno(punto.precision) };
  if (typeof punto.vel === 'number') f.vel = Math.round(punto.vel * 100) / 100;
  if (typeof punto.rumbo === 'number') f.rumbo = Math.round(punto.rumbo);
  f.v = v?.v ?? null;
  return f;
}

/** Un aviso del sensor `{ tipo, datos }` que llegó a la hora `ahoraMs`, como evento de la traza (puro). */
export function eventoDeTraza({ tipo, datos }, ahoraMs, inicioMs) {
  const e = { t: relativo(ahoraMs, inicioMs), tipo };
  for (const [k, x] of Object.entries(datos ?? {})) e[k] = k === 'en' ? relativo(Number(x), inicioMs) : x;
  return e;
}

/** Aplica un evento de la traza al sensor (puro): lo mismo que hace `lib/movimientoNativo.js` con cada aviso. */
function aplica(s, e, inicioMs) {
  const ahora = absoluto(e.t, inicioMs);
  const conHora = { ...e, en: absoluto(e.en, inicioMs) };
  switch (e.tipo) {
    case 'enciende': return sensorNuevo(ahora);
    case 'apaga': return null;
    case 'inicio': return s && conInicio(s, e);
    case 'movimiento': return s && conActividad(s, conHora, ahora);
    case 'pasos': return s && conPasos(s, conHora, ahora);
    case 'permiso': return s && conPermiso(s, e);
    case 'falla': return s && (e.cual === 'pasos' ? sinPasos(s) : s);
    default: return s;
  }
}

/** Los eventos de una traza `traza-gps/1` (build 79), sacados del resumen del sensor de cada fila (puro). Sin cadencia: sale de los pasos contados. */
export function eventosDeV1(filas) {
  const eventos = [];
  let antes = null;
  for (const f of filas ?? []) {
    const s = f.s;
    if (!s) continue;
    const t = Math.max(0, f.t - 0.01);
    if (!antes) eventos.push({ t: s.desde ?? 0, tipo: 'enciende' }, { t: s.desde ?? 0, tipo: 'inicio', actividad: true, pasos: !!s.hayPasos, permiso: s.vivo ? 'si' : null });
    if (s.act && (s.act !== antes?.act || s.actEn !== antes?.actEn)) eventos.push({ t, tipo: 'movimiento', estado: s.act, confianza: s.conf ?? 0, en: s.actEn });
    if ((s.pasos ?? 0) > (antes?.pasos ?? 0)) eventos.push({ t, tipo: 'pasos', pasos: s.pasos, en: s.pasoEn ?? t });
    antes = s;
  }
  return eventos;
}

/**
 * Reproduce una traza como si fuera la carrera (puro): los eventos del sensor y los puntos, en orden de llegada (en el mismo segundo, primero el sensor).
 * `sinSensor`: como si no hubiera sensor (las reglas del GPS solas). Devuelve `{ distanciaM, pausas: [s desde el inicio], reanudas: [s], metros: [los contados
 * después de cada fila], muestras }`.
 */
export function reproduceTraza(traza, { sinSensor = false, pausaAutomatica = true } = {}) {
  if (!FORMATOS_QUE_SE_LEEN.includes(traza?.formato)) throw new Error(`traza con formato ${traza?.formato}`);
  const inicioMs = traza.inicioMs ?? 0;
  const eventos = sinSensor ? [] : (traza.formato === 'traza-gps/1' ? eventosDeV1(traza.filas) : (traza.eventos ?? []));
  let e = carreraNueva({ ...cronometroNuevo(traza.deporte ?? 'correr', inicioMs), gps: true });
  let sensor = null;
  let k = 0;
  const pausas = [];
  const reanudas = [];
  const metros = [];
  for (const f of traza.filas ?? []) {
    while (k < eventos.length && eventos[k].t <= f.t) { sensor = aplica(sensor, eventos[k], inicioMs); k += 1; }
    const ahoraMs = inicioMs + f.t * 1000;
    const punto = { lat: f.lat, lon: f.lon, precision: f.pre, ...(typeof f.vel === 'number' ? { vel: f.vel } : {}), ...(typeof f.rumbo === 'number' ? { rumbo: f.rumbo } : {}) };
    e = pasoDeCarrera(e, punto, ahoraMs, { sensor, pausaAutomatica });
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
    return FORMATOS_QUE_SE_LEEN.includes(t?.formato) && Array.isArray(t.filas) ? t : null;
  } catch { return null; }
}

/** Empieza a grabar la carrera que arrancó en `inicioMs` (borra la anterior). Si ya había una de esa misma carrera (se recargó la página), sigue esa. */
export function empiezaTraza({ deporte, inicioMs, app }) {
  const previa = actual ?? ultimaTraza();
  actual = previa?.inicioMs === inicioMs && previa.formato === FORMATO_DE_TRAZA
    ? previa
    : { formato: FORMATO_DE_TRAZA, deporte, inicio: new Date(inicioMs).toISOString(), inicioMs, app, filas: [], eventos: [] };
  guarda();
}

/** ¿Se está grabando la carrera que arrancó en `inicioMs`? */
export const grabaTraza = (inicioMs) => actual?.inicioMs === inicioMs;

/** Anota un punto (se guarda en el teléfono cada 10 s). */
export function anotaEnTraza(punto, v, ahoraMs) {
  if (!actual || actual.filas.length >= MAXIMO_DE_FILAS) return;
  actual.filas.push(filaDeTraza(punto, v, ahoraMs, actual.inicioMs));
  if (!reloj) reloj = setTimeout(guarda, GUARDA_CADA_MS);
}

/** Anota un aviso del sensor `{ tipo, datos }` tal como llegó. */
export function anotaSensorEnTraza(aviso, ahoraMs) {
  if (!actual || actual.eventos.length >= MAXIMO_DE_EVENTOS) return;
  actual.eventos.push(eventoDeTraza(aviso, ahoraMs, actual.inicioMs));
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
