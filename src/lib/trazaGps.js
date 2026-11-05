/* LA TRAZA DEL GPS (2 nov 2026, bug «parado en la calle sumó 50 m»). Para probar con lo que pasó de verdad en la calle, y no con ruido inventado.

   Solo cuentas de prueba (y el dueño): en «Ajustes de la carrera», «Guardar traza del GPS». Con eso, en una carrera con GPS se anota cada punto y cada aviso
   del sensor de movimiento, y «Exportar la última traza» la entrega como archivo JSON (en el iPhone, el menú de compartir: Archivos, AirDrop…).
   `scripts/prueba-ruta.mjs` la reproduce con `reproduceTraza`: los avisos del sensor pasan por las mismas funciones que en el teléfono
   (`lib/sensorDeMovimiento.js`) y cada punto por `pasoDeCarrera`. Lo mismo que hace la carrera.

   EL FORMATO (`traza-gps/3`, 3 nov 2026): `{ formato, deporte, desplazamiento ('pie' | 'ruedas'), actividad (su id: bici y patines pausan con la velocidad del iPhone), inicio (ISO), inicioMs, app ('iphone' | 'web'), filas,
   eventos, paradas? }`. Tiempos en segundos desde el inicio.
     · Cada FILA, un punto del GPS: `{ t, lat, lon, pre (error, m), vel?, rumbo?, v }` (`v`: lo que dijo `decideMarcha` para los metros: 'quieto' | 'mueve' | null).
     · Cada EVENTO, un aviso del sensor tal como llegó: `{ t, tipo, ... }` con `tipo` 'enciende' | 'inicio' | 'movimiento' | 'pasos' | 'rebote' | 'permiso' |
       'falla' | 'apaga' y sus datos (`en`, la hora que trae el aviso, también en segundos desde el inicio). 'rebote' lleva `valor` (g); 'pasos', `pasos`,
       `cadencia?` y `ritmo?`. Además, cada cambio de marcha que decidió la carrera: 'marcha' `{ a: 'quieto' | 'en-marcha', motivo }` (solo para leerlo: la
       prueba lo vuelve a decidir).
     · `paradas` (opcional, se escribe a mano): `[[desde, hasta], …]`, las veces que de verdad se detuvo. Sin ellas, la prueba las estima con el GPS (`analizaTraza`).
   Las `traza-gps/1` y `/2` (builds 79 y 80) se siguen leyendo (sin rebote: mandan las reglas del GPS). Vive en el teléfono (`localStorage`, solo la última,
   hasta 3 horas) y nunca se sube. */

import { carreraNueva, pasoDeCarrera } from './pasoDeCarrera.js';
import { cronometroNuevo, familiaDelDeporte } from './entrenoLibre.js';
import { enVivo, metrosEntrePuntos } from './ubicacion.js';
import { conActividad, conInicio, conPasos, conPermiso, conRebote, sensorNuevo, sinPasos } from './sensorDeMovimiento.js';

export const FORMATO_DE_TRAZA = 'traza-gps/3';
const FORMATOS_QUE_SE_LEEN = ['traza-gps/1', 'traza-gps/2', FORMATO_DE_TRAZA];
const LLAVE_ENCENDIDA = 'ajustes:traza-gps';
const LLAVE_TRAZA = 'tl:traza-gps';
const MAXIMO_DE_FILAS = 3 * 3600;
const MAXIMO_DE_EVENTOS = 6 * 3600;
const GUARDA_CADA_MS = 10000;

const uno = (x) => Math.round(x * 10) / 10;
const seis = (x) => Math.round(x * 1e6) / 1e6;
const relativo = (ms, inicioMs) => (typeof ms === 'number' ? Math.round(ms - inicioMs) / 1000 : undefined);
const absoluto = (s, inicioMs) => (typeof s === 'number' ? inicioMs + s * 1000 : null);

/** Un punto como fila de la traza (puro). `v`: lo que dijo `decideMarcha` para los metros. */
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
    case 'rebote': return s && conRebote(s, conHora, ahora);
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
 * Reproduce una traza como si fuera la carrera (puro): los eventos del sensor y los puntos, en orden de llegada (en el mismo segundo, primero el sensor). Cada
 * aviso de rebote también decide la pausa, sin punto (como en el teléfono). `sinSensor`: como si no hubiera sensor (la web: las reglas del GPS solas).
 * Devuelve `{ distanciaM, pausas: [s desde el inicio], reanudas: [s], marchas: [{ t, a, motivo }], metros: [los contados después de cada fila], muestras }`.
 */
export function reproduceTraza(traza, { sinSensor = false, pausaAutomatica = true } = {}) {
  if (!FORMATOS_QUE_SE_LEEN.includes(traza?.formato)) throw new Error(`traza con formato ${traza?.formato}`);
  const inicioMs = traza.inicioMs ?? 0;
  const deporte = traza.deporte ?? 'correr';
  const eventos = sinSensor ? [] : (traza.formato === 'traza-gps/1' ? eventosDeV1(traza.filas) : (traza.eventos ?? []));
  let e = carreraNueva({
    ...cronometroNuevo(deporte, inicioMs), gps: true, desplazamiento: traza.desplazamiento ?? familiaDelDeporte(deporte),
    ...(traza.actividad ? { actividad: { id: traza.actividad } } : {}),
  });
  let sensor = null;
  let k = 0;
  const pausas = [];
  const reanudas = [];
  const marchas = [];
  const metros = [];
  const anota = (t) => {
    if (e.accion === 'pausa') pausas.push(t);
    if (e.accion === 'reanuda') reanudas.push(t);
    if (e.marcha) marchas.push({ t, ...e.marcha });
  };
  for (const f of traza.filas ?? []) {
    while (k < eventos.length && eventos[k].t <= f.t) {
      const ev = eventos[k];
      sensor = aplica(sensor, ev, inicioMs);
      k += 1;
      if (ev.tipo === 'rebote') { e = pasoDeCarrera(e, null, inicioMs + ev.t * 1000, { sensor, pausaAutomatica }); anota(ev.t); }
    }
    const punto = { lat: f.lat, lon: f.lon, precision: f.pre, ...(typeof f.vel === 'number' ? { vel: f.vel } : {}), ...(typeof f.rumbo === 'number' ? { rumbo: f.rumbo } : {}) };
    e = pasoDeCarrera(e, punto, inicioMs + f.t * 1000, { sensor, pausaAutomatica });
    anota(f.t);
    metros.push(e.metros);
  }
  return { distanciaM: enVivo(e.muestras).distanciaM, pausas, reanudas, marchas, metros, muestras: e.muestras };
}

const percentil = (xs, p) => { if (!xs.length) return null; const o = [...xs].sort((a, b) => a - b); return o[Math.min(o.length - 1, Math.floor(p * o.length))]; };

/**
 * Las paradas de verdad de una traza (s): las escritas a mano en `traza.paradas` o, sin ellas, las que se ven con el GPS mirando hacia atrás Y hacia adelante
 * (lo que la carrera no puede): menos de 0.5 m/s entre 3 s antes y 3 s después, 4 s o más seguidos, con lecturas de error ≤ 20 m.
 */
export function paradasDe(traza) {
  if (Array.isArray(traza?.paradas)) return traza.paradas.map(([desde, hasta]) => ({ desde, hasta, escritas: true }));
  const buenas = (traza?.filas ?? []).filter((f) => f.pre <= 20);
  const quieto = buenas.map((f, i) => {
    const antes = [...buenas.slice(0, i)].reverse().find((g) => f.t - g.t >= 3);
    const despues = buenas.slice(i + 1).find((g) => g.t - f.t >= 3);
    if (!antes || !despues) return false;
    return metrosEntrePuntos(antes, despues) / (despues.t - antes.t) < 0.5;
  });
  const paradas = [];
  let ini = null;
  let ult = null;
  const cierra = () => { if (ini != null && ult - ini >= 4) paradas.push({ desde: ini, hasta: ult, escritas: false }); ini = null; };
  buenas.forEach((f, i) => {
    if (quieto[i] && ini != null && f.t - ult <= 2) { ult = f.t; return; }
    cierra();
    if (quieto[i]) { ini = f.t; ult = f.t; }
  });
  cierra();
  return paradas;
}

/**
 * Lo que dio una traza, parada por parada (puro): `{ paradas: [{ desde, hasta, pausaS, reanudaS }], enFalso: [s], rebote: { parado, enMarcha } }`. `pausaS`:
 * segundos desde que se detuvo hasta la pausa (`null` si no pausó); `reanudaS`: desde que arrancó hasta que se reanudó. `enFalso`: pausas fuera de toda
 * parada. `rebote`: el rebote (g, percentiles 10/50/90) parado y en marcha, para ajustar `REBOTE_MINIMO`.
 */
export function analizaTraza(traza, r = reproduceTraza(traza)) {
  const paradas = paradasDe(traza);
  const dentro = (t, p, holgura = 1) => t >= p.desde - holgura && t <= p.hasta + holgura;
  const lista = paradas.map((p) => {
    const pausa = r.pausas.find((t) => dentro(t, p));
    const reanuda = r.reanudas.find((t) => t >= p.hasta && t <= p.hasta + 20);
    return { desde: p.desde, hasta: p.hasta, escritas: p.escritas, pausaS: pausa != null ? Math.round((pausa - p.desde) * 10) / 10 : null, reanudaS: reanuda != null ? Math.round((reanuda - p.hasta) * 10) / 10 : null };
  });
  const enFalso = r.pausas.filter((t) => !paradas.some((p) => dentro(t, p)));
  const rebotes = (traza.eventos ?? []).filter((x) => x.tipo === 'rebote');
  const parado = rebotes.filter((x) => paradas.some((p) => x.t - 1 >= p.desde && x.t <= p.hasta)).map((x) => x.valor);
  const enMarcha = rebotes.filter((x) => !paradas.some((p) => x.t >= p.desde - 2 && x.t - 1 <= p.hasta + 2)).map((x) => x.valor);
  const tres = (xs) => (xs.length ? [0.1, 0.5, 0.9].map((q) => Math.round(percentil(xs, q) * 1000) / 1000) : null);
  return { paradas: lista, enFalso, rebote: { parado: tres(parado), enMarcha: tres(enMarcha) } };
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
export function empiezaTraza({ deporte, desplazamiento = null, actividad = null, inicioMs, app }) {
  const previa = actual ?? ultimaTraza();
  actual = previa?.inicioMs === inicioMs && previa.formato === FORMATO_DE_TRAZA
    ? previa
    : { formato: FORMATO_DE_TRAZA, deporte, desplazamiento, actividad, inicio: new Date(inicioMs).toISOString(), inicioMs, app, filas: [], eventos: [] };
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
