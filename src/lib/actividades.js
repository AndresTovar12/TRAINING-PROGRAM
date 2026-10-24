/* LAS ACTIVIDADES QUE SE PUEDEN REGISTRAR (23 oct 2026, Activity Tracker: `docs/superpowers/specs/2026-10-22-tracker-y-activity-cards-handoff.md`).

   Lo que la persona elige al tocar el punto ● de la barra para registrar algo por su cuenta: una lista por grupos con buscador, y si lo suyo no está (waterpolo),
   CREA la suya con nombre, ícono y color; queda guardada en su configuración. Una sola pregunta al crearla: «¿te mueves de un lugar a otro?» (lleva mapa y distancia o no).

   Cada actividad dice cómo se muestra (`nombre`; `icono`, un id del catálogo de íconos de la app —`lib/iconosDeTipo.datos.js`, el mismo de los tipos de sesión—, y
   `color`), si lleva mapa (`gps`) y a qué DEPORTE de las métricas pertenece (`deporte`, uno de `lib/metricas/deportes.js`):
   el pádel se guarda como «raqueta» para que la carga y las métricas del coach sepan qué es, pero se llama «Pádel» (el `titulo` del entreno).

   SIN EMOJIS (Andrés, 23 oct 2026: «no me gustan los emojis, no tienen personalidad»): íconos de línea en un cuadrito de color, como los deportes y los tipos de sesión.

   Es puro (sin pantalla ni red) para probarse: `scripts/prueba-actividades.mjs`. Sin `@/`: lo cargan las pruebas de Node. */

import { DEPORTES } from './metricas/deportes.js';

// Un color por grupo (de la paleta de los tipos de sesión): se distingue de un vistazo qué es a pie, en el agua o de raqueta.
const COLOR = { pie: '#F2555A', ruedas: '#00B3C7', agua: '#3AA0F5', fuerza: '#A480FF', raqueta: '#F0A81F', equipo: '#FF7A52', mente: '#C084FC', combate: '#9090A0' };
const a = (id, nombre, icono, color, gps, deporte) => Object.freeze({ id, nombre, icono, color, gps, deporte });

export const GRUPOS_DE_ACTIVIDADES = Object.freeze([
  { grupo: 'A pie', actividades: [a('correr', 'Correr', 'correr', COLOR.pie, true, 'correr'), a('caminar', 'Caminar', 'caminar', COLOR.pie, true, 'caminar'), a('senderismo', 'Senderismo', 'senderismo', COLOR.pie, true, 'senderismo'), a('trail', 'Trail', 'montana', COLOR.pie, true, 'correr')] },
  { grupo: 'Sobre ruedas', actividades: [a('bici', 'Bici', 'bici', COLOR.ruedas, true, 'bici'), a('spinning', 'Spinning', 'velocimetro', COLOR.ruedas, false, 'bici'), a('patines', 'Patines', 'patines', COLOR.ruedas, true, 'otro')] },
  { grupo: 'En el agua', actividades: [a('natacion', 'Nadar', 'nadar', COLOR.agua, false, 'natacion'), a('surf', 'Surf', 'olas', COLOR.agua, true, 'otro'), a('remo', 'Remo', 'kayak', COLOR.agua, true, 'remo'), a('kayak', 'Kayak', 'barco', COLOR.agua, true, 'remo')] },
  { grupo: 'Fuerza y gimnasio', actividades: [a('fuerza', 'Gimnasio', 'pesa', COLOR.fuerza, false, 'fuerza'), a('crossfit', 'Crossfit', 'pesa-rusa', COLOR.fuerza, false, 'funcional'), a('hyrox', 'Hyrox', 'llama', COLOR.fuerza, false, 'funcional'), a('hiit', 'HIIT', 'rayo', COLOR.fuerza, false, 'hiit'), a('eliptica', 'Elíptica', 'caminadora', COLOR.fuerza, false, 'eliptica')] },
  { grupo: 'Raqueta', actividades: [a('padel', 'Pádel', 'tenis', COLOR.raqueta, false, 'raqueta'), a('tenis', 'Tenis', 'tenis', COLOR.raqueta, false, 'raqueta'), a('pickleball', 'Pickleball', 'pingpong', COLOR.raqueta, false, 'raqueta')] },
  { grupo: 'En equipo', actividades: [a('futbol', 'Fútbol', 'futbol', COLOR.equipo, false, 'futbol'), a('basquet', 'Básquet', 'basquet', COLOR.equipo, false, 'otro'), a('voleibol', 'Voleibol', 'voleibol', COLOR.equipo, false, 'otro')] },
  { grupo: 'Mente y cuerpo', actividades: [a('yoga', 'Yoga', 'yoga', COLOR.mente, false, 'yoga'), a('pilates', 'Pilates', 'estirar', COLOR.mente, false, 'yoga'), a('movilidad', 'Movilidad', 'estirar-2', COLOR.mente, false, 'movilidad')] },
  { grupo: 'Combate', actividades: [a('box', 'Box', 'boxeo', COLOR.combate, false, 'otro'), a('jiujitsu', 'Jiu-jitsu', 'karate', COLOR.combate, false, 'otro')] },
]);

export const CATALOGO = Object.freeze(GRUPOS_DE_ACTIVIDADES.flatMap((g) => g.actividades));

/** Los colores que se ofrecen al crear una actividad propia: los de los tipos de sesión (el primero sale de entrada). */
export const COLORES_PARA_CREAR = Object.freeze(['#5DA0FF', '#A480FF', '#FFA047', '#3DD9A0', '#F2555A', '#00B3C7', '#EC7FB0', '#22C08A', '#F0A81F', '#9090A0']);
/** El ícono de una propia que todavía no tiene uno (el neutro del catálogo). */
export const ICONO_PROPIO = 'etiqueta';
const ES_HEX = /^#[0-9a-f]{6}$/i;

export const MAX_NOMBRE = 18;
export const MAX_PROPIAS = 30;

const sinAcentos = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const conMayuscula = (s) => s.replace(/^./, (c) => c.toUpperCase());

/** Una actividad propia válida (lo que viene de la configuración guardada se revisa: nunca rompe la pantalla), o `null`. */
export function limpiaPropia(p) {
  if (!p || typeof p !== 'object') return null;
  const nombre = String(p.nombre ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE);
  if (!nombre || typeof p.id !== 'string' || !p.id.startsWith('p-')) return null;
  const icono = typeof p.icono === 'string' && /^[a-z0-9-]{1,30}$/.test(p.icono) ? p.icono : ICONO_PROPIO;
  const color = ES_HEX.test(String(p.color ?? '')) ? p.color : COLORES_PARA_CREAR[0];
  const gps = !!p.gps;
  return Object.freeze({ id: p.id, nombre, icono, color, gps, deporte: 'otro', propia: true });
}

/** Las propias guardadas, limpias y sin repetidas. */
export const propiasDe = (lista) => (Array.isArray(lista) ? lista : []).map(limpiaPropia).filter(Boolean).filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);

/**
 * La actividad nueva que crea la persona, lista para guardarse, o `null` si el nombre está vacío. Si ya existe una con ese nombre (del catálogo o suya), se devuelve
 * ESA en lugar de crear otra igual (`yaExistia: true`).
 */
export function creaActividad({ nombre, icono, color, gps }, propias = [], ahora = Date.now()) {
  const n = conMayuscula(String(nombre ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE));
  if (!n) return null;
  const igual = [...propiasDe(propias), ...CATALOGO].find((x) => sinAcentos(x.nombre) === sinAcentos(n));
  if (igual) return { actividad: igual, yaExistia: true };
  const actividad = limpiaPropia({ id: `p-${ahora.toString(36)}`, nombre: n, icono, color, gps });
  return { actividad, yaExistia: false };
}

/** La actividad con ese id (del catálogo o propia), o `null`. */
export const actividadPorId = (id, propias = []) => propiasDe(propias).find((x) => x.id === id) ?? CATALOGO.find((x) => x.id === id) ?? null;

/** La del catálogo para un deporte de las métricas (lo que se guarda de un entreno viejo): la primera de ese deporte, o una genérica con su nombre. */
export function actividadDeDeporte(deporte) {
  const d = DEPORTES[deporte] ? deporte : 'otro';
  return CATALOGO.find((x) => x.deporte === d && x.id === d) ?? CATALOGO.find((x) => x.deporte === d) ?? a('otro', DEPORTES.otro.nombre, 'destellos', '#7A8191', false, 'otro');
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
