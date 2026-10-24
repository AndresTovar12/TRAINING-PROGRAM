/* LAS ACTIVIDADES QUE SE PUEDEN REGISTRAR (23 oct 2026, Activity Tracker: `docs/superpowers/specs/2026-10-22-tracker-y-activity-cards-handoff.md`).

   Lo que la persona elige al tocar el punto ● de la barra para registrar algo por su cuenta: una lista por grupos con buscador, y si lo suyo no está (waterpolo),
   CREA la suya con nombre y emoji; queda guardada en su configuración. Una sola pregunta al crearla: «¿te mueves de un lugar a otro?» (lleva mapa y distancia o no).

   Cada actividad dice cómo se muestra (`nombre`, `emoji`), si lleva mapa (`gps`) y a qué DEPORTE de las métricas pertenece (`deporte`, uno de `lib/metricas/deportes.js`):
   el pádel se guarda como «raqueta» para que la carga y las métricas del coach sepan qué es, pero se llama «Pádel» (el `titulo` del entreno).

   Es puro (sin pantalla ni red) para probarse: `scripts/prueba-actividades.mjs`. Sin `@/`: lo cargan las pruebas de Node. */

import { DEPORTES } from './metricas/deportes.js';

const a = (id, nombre, emoji, gps, deporte) => Object.freeze({ id, nombre, emoji, gps, deporte });

export const GRUPOS_DE_ACTIVIDADES = Object.freeze([
  { grupo: 'A pie', actividades: [a('correr', 'Correr', '🏃', true, 'correr'), a('caminar', 'Caminar', '🚶', true, 'caminar'), a('senderismo', 'Senderismo', '🥾', true, 'senderismo'), a('trail', 'Trail', '⛰️', true, 'correr')] },
  { grupo: 'Sobre ruedas', actividades: [a('bici', 'Bici', '🚴', true, 'bici'), a('spinning', 'Spinning', '🚲', false, 'bici'), a('patines', 'Patines', '🛼', true, 'otro')] },
  { grupo: 'En el agua', actividades: [a('natacion', 'Nadar', '🏊', false, 'natacion'), a('surf', 'Surf', '🏄', true, 'otro'), a('remo', 'Remo', '🚣', true, 'remo'), a('kayak', 'Kayak', '🛶', true, 'remo')] },
  { grupo: 'Fuerza y gimnasio', actividades: [a('fuerza', 'Gimnasio', '🏋️', false, 'fuerza'), a('crossfit', 'Crossfit', '🤸', false, 'funcional'), a('hyrox', 'Hyrox', '🔥', false, 'funcional'), a('hiit', 'HIIT', '⚡', false, 'hiit'), a('eliptica', 'Elíptica', '🏃‍♀️', false, 'eliptica')] },
  { grupo: 'Raqueta', actividades: [a('padel', 'Pádel', '🎾', false, 'raqueta'), a('tenis', 'Tenis', '🎾', false, 'raqueta'), a('pickleball', 'Pickleball', '🏓', false, 'raqueta')] },
  { grupo: 'En equipo', actividades: [a('futbol', 'Fútbol', '⚽', false, 'futbol'), a('basquet', 'Básquet', '🏀', false, 'otro'), a('voleibol', 'Voleibol', '🏐', false, 'otro')] },
  { grupo: 'Mente y cuerpo', actividades: [a('yoga', 'Yoga', '🧘', false, 'yoga'), a('pilates', 'Pilates', '🤸‍♀️', false, 'yoga'), a('movilidad', 'Movilidad', '🧎', false, 'movilidad')] },
  { grupo: 'Combate', actividades: [a('box', 'Box', '🥊', false, 'otro'), a('jiujitsu', 'Jiu-jitsu', '🥋', false, 'otro')] },
]);

export const CATALOGO = Object.freeze(GRUPOS_DE_ACTIVIDADES.flatMap((g) => g.actividades));

/** Los emojis que se ofrecen al crear una actividad propia (el primero es el que sale de entrada). */
export const EMOJIS_PARA_CREAR = Object.freeze(['🤽', '🏊', '⚽', '🏐', '🤾', '🏇', '⛷️', '🏂', '🧗', '🤺', '🏌️', '🛹', '🪂', '🏸', '🥏', '🏒', '💃', '🧜', '🚣', '🏓']);

export const MAX_NOMBRE = 18;
export const MAX_PROPIAS = 30;

const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const conMayuscula = (s) => s.replace(/^./, (c) => c.toUpperCase());

/** Una actividad propia válida (lo que viene de la configuración guardada se revisa: nunca rompe la pantalla), o `null`. */
export function limpiaPropia(p) {
  if (!p || typeof p !== 'object') return null;
  const nombre = String(p.nombre ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE);
  if (!nombre || typeof p.id !== 'string' || !p.id.startsWith('p-')) return null;
  const emoji = typeof p.emoji === 'string' && p.emoji.trim() ? p.emoji.trim().slice(0, 8) : EMOJIS_PARA_CREAR[0];
  const gps = !!p.gps;
  return Object.freeze({ id: p.id, nombre, emoji, gps, deporte: 'otro', propia: true });
}

/** Las propias guardadas, limpias y sin repetidas. */
export const propiasDe = (lista) => (Array.isArray(lista) ? lista : []).map(limpiaPropia).filter(Boolean).filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);

/**
 * La actividad nueva que crea la persona, lista para guardarse, o `null` si el nombre está vacío. Si ya existe una con ese nombre (del catálogo o suya), se devuelve
 * ESA en lugar de crear otra igual (`yaExistia: true`).
 */
export function creaActividad({ nombre, emoji, gps }, propias = [], ahora = Date.now()) {
  const n = conMayuscula(String(nombre ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE));
  if (!n) return null;
  const igual = [...propiasDe(propias), ...CATALOGO].find((x) => sinAcentos(x.nombre) === sinAcentos(n));
  if (igual) return { actividad: igual, yaExistia: true };
  const actividad = limpiaPropia({ id: `p-${ahora.toString(36)}`, nombre: n, emoji, gps });
  return { actividad, yaExistia: false };
}

/** La actividad con ese id (del catálogo o propia), o `null`. */
export const actividadPorId = (id, propias = []) => propiasDe(propias).find((x) => x.id === id) ?? CATALOGO.find((x) => x.id === id) ?? null;

/** La del catálogo para un deporte de las métricas (lo que se guarda de un entreno viejo): la primera de ese deporte, o una genérica con su nombre. */
export function actividadDeDeporte(deporte) {
  const d = DEPORTES[deporte] ? deporte : 'otro';
  return CATALOGO.find((x) => x.deporte === d && x.id === d) ?? CATALOGO.find((x) => x.deporte === d) ?? a('otro', DEPORTES.otro.nombre, '✨', false, 'otro');
}

/** La actividad de un entreno ya guardado (`{ deporte, titulo }`): por su nombre si es del catálogo o propia; si no, por su deporte. */
export function actividadDeEntreno(fila, propias = []) {
  if (!fila) return null;
  const t = sinAcentos(fila.titulo);
  const porNombre = t ? [...propiasDe(propias), ...CATALOGO].find((x) => sinAcentos(x.nombre) === t) : null;
  return porNombre ?? actividadDeDeporte(fila.deporte);
}

/** Lo que encuentra el buscador: por nombre, sin importar acentos ni mayúsculas. Las propias primero. */
export function buscaActividades(texto, propias = []) {
  const q = sinAcentos(texto);
  if (!q) return [];
  return [...propiasDe(propias), ...CATALOGO].filter((x) => sinAcentos(x.nombre).includes(q));
}

/** ¿Hay una con ese nombre exacto? (si no, el buscador ofrece «Crear "…"»). */
export const hayConNombre = (texto, propias = []) => [...propiasDe(propias), ...CATALOGO].some((x) => sinAcentos(x.nombre) === sinAcentos(texto));

/**
 * «Tus actividades», arriba de la lista: las que hizo últimamente (de sus entrenos, del más nuevo al más viejo) y las que creó, sin repetir, hasta `max`.
 * Quien todavía no ha hecho nada ve Correr, Bici y Nadar.
 */
export function tusActividades(filas = [], propias = [], max = 6) {
  const lista = [];
  const mete = (x) => { if (x && !lista.some((y) => y.id === x.id)) lista.push(x); };
  (filas ?? []).forEach((f) => mete(actividadDeEntreno(f, propias)));
  propiasDe(propias).forEach(mete);
  if (!lista.length) ['correr', 'bici', 'natacion'].forEach((id) => mete(actividadPorId(id)));
  return lista.slice(0, max);
}
