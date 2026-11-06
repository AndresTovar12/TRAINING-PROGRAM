/* LAS ACTIVIDADES QUE SE PUEDEN REGISTRAR (23 oct 2026, Activity Tracker: `docs/superpowers/specs/2026-10-22-tracker-y-activity-cards-handoff.md`).

   Lo que la persona elige al tocar el punto ● de la barra para registrar algo por su cuenta: una lista por grupos con buscador, y si lo suyo no está (waterpolo),
   CREA la suya con nombre, ícono y color; queda guardada en su configuración. Al crearla se pregunta «¿te mueves de un lugar a otro?» (lleva mapa y distancia o no)
   y, si sí, «¿Cómo te mueves?»: a pie o sobre ruedas o en el agua (3 nov 2026, para la pausa automática: `desplazamientoDe`).

   Cada actividad dice cómo se muestra (`nombre`; `icono`, un id del catálogo de íconos de la app —`lib/iconosDeTipo.datos.js`, el mismo de los tipos de sesión—, y
   `color`), si lleva mapa (`gps`) y a qué DEPORTE de las métricas pertenece (`deporte`, uno de `lib/metricas/deportes.js`):
   el pádel se guarda como «raqueta» para que la carga y las métricas del coach sepan qué es, pero se llama «Pádel» (el `titulo` del entreno).

   SIN EMOJIS (Andrés, 23 oct 2026: «no me gustan los emojis, no tienen personalidad»): un símbolo del catálogo. Desde el 6 nov 2026 va SIN cuadro y siempre en el azul
   de la marca (`IconoDeActividad`): el `color` de cada una ya no se pinta en las listas; se conserva en los datos (lo guardan los entrenos y la pantalla de crear lo ofrece).
   «En equipo» se llama «Deportes» (la clave del color, `equipo`, se queda) y trae Fútbol americano y Flag football (6 nov 2026).

   Es puro (sin pantalla ni red) para probarse: `scripts/prueba-actividades.mjs`. Sin `@/`: lo cargan las pruebas de Node. */

import { DEPORTES } from './metricas/deportes.js';

// Un color por grupo (de la paleta de los tipos de sesión): se distingue de un vistazo qué es a pie, en el agua o de raqueta.
const COLOR = { pie: '#F2555A', ruedas: '#00B3C7', agua: '#3AA0F5', fuerza: '#A480FF', raqueta: '#F0A81F', equipo: '#FF7A52', mente: '#C084FC', combate: '#9090A0' };
// `desplazamiento` (solo las que llevan mapa): 'pie' o 'ruedas' (ver abajo, `desplazamientoDe`).
const a = (id, nombre, icono, color, gps, deporte, desplazamiento) => Object.freeze({ id, nombre, icono, color, gps, deporte, ...(gps ? { desplazamiento } : {}) });

export const GRUPOS_DE_ACTIVIDADES = Object.freeze([
  { grupo: 'A pie', actividades: [a('correr', 'Correr', 'tenis-correr', COLOR.pie, true, 'correr', 'pie'), a('caminar', 'Caminar', 'huellas-pies', COLOR.pie, true, 'caminar', 'pie'), a('senderismo', 'Senderismo', 'bota', COLOR.pie, true, 'senderismo', 'pie'), a('trail', 'Trail', 'bota', COLOR.pie, true, 'correr', 'pie')] },
  { grupo: 'Sobre ruedas', actividades: [a('bici', 'Bici', 'bicicleta', COLOR.ruedas, true, 'bici', 'ruedas'), a('spinning', 'Spinning', 'bici-fija', COLOR.ruedas, false, 'bici'), a('patines', 'Patines', 'patines', COLOR.ruedas, true, 'otro', 'ruedas')] },
  { grupo: 'En el agua', actividades: [a('natacion', 'Nadar', 'nadar', COLOR.agua, true, 'natacion', 'ruedas'), a('surf', 'Surf', 'tabla-surf', COLOR.agua, true, 'otro', 'ruedas'), a('remo', 'Remo', 'kayak', COLOR.agua, true, 'remo', 'ruedas'), a('kayak', 'Kayak', 'barco', COLOR.agua, true, 'remo', 'ruedas')] },
  { grupo: 'Fuerza y gimnasio', actividades: [a('fuerza', 'Gimnasio', 'pesa', COLOR.fuerza, false, 'fuerza'), a('crossfit', 'Crossfit', 'pesa-rusa', COLOR.fuerza, false, 'funcional'), a('hyrox', 'Hyrox', 'hyrox', COLOR.fuerza, false, 'funcional'), a('hiit', 'HIIT', 'rayo', COLOR.fuerza, false, 'hiit'), a('eliptica', 'Elíptica', 'caminadora', COLOR.fuerza, false, 'eliptica')] },
  { grupo: 'Raqueta', actividades: [a('padel', 'Pádel', 'pala-padel', COLOR.raqueta, false, 'raqueta'), a('tenis', 'Tenis', 'tenis', COLOR.raqueta, false, 'raqueta'), a('pickleball', 'Pickleball', 'pingpong', COLOR.raqueta, false, 'raqueta')] },
  { grupo: 'Deportes', actividades: [a('futbol', 'Fútbol', 'balon-futbol', COLOR.equipo, false, 'futbol'), a('americano', 'Fútbol americano', 'balon-americano', COLOR.equipo, false, 'otro'), a('flag', 'Flag football', 'cinturon-banderas', COLOR.equipo, false, 'otro'), a('basquet', 'Básquet', 'balon-basquet', COLOR.equipo, false, 'otro'), a('voleibol', 'Voleibol', 'voleibol', COLOR.equipo, false, 'otro')] },
  { grupo: 'Mente y cuerpo', actividades: [a('yoga', 'Yoga', 'loto', COLOR.mente, false, 'yoga'), a('pilates', 'Pilates', 'estirar', COLOR.mente, false, 'yoga'), a('movilidad', 'Movilidad', 'estirar-2', COLOR.mente, false, 'movilidad')] },
  { grupo: 'Combate', actividades: [a('box', 'Box', 'guante', COLOR.combate, false, 'otro'), a('jiujitsu', 'Jiu-jitsu', 'mano-palma', COLOR.combate, false, 'otro')] },
]);

export const CATALOGO = Object.freeze(GRUPOS_DE_ACTIVIDADES.flatMap((g) => g.actividades));

/** Los colores que se ofrecen al crear una actividad propia: los de los tipos de sesión (el primero sale de entrada). */
export const COLORES_PARA_CREAR = Object.freeze(['#5DA0FF', '#A480FF', '#FFA047', '#3DD9A0', '#F2555A', '#00B3C7', '#EC7FB0', '#22C08A', '#F0A81F', '#9090A0']);
/** El ícono de una propia que todavía no tiene uno (el neutro del catálogo). */
export const ICONO_PROPIO = 'etiqueta';
const ES_HEX = /^#[0-9a-f]{6}$/i;
/* CÓMO TE MUEVES (3 nov 2026, `docs/superpowers/specs/2026-11-03-pausa-automatica-rebote.md`). Las actividades con mapa son de una de dos familias, y la pausa
   automática decide distinto en cada una: A PIE ('pie': correr, caminar, senderismo, trail) el cuerpo rebota con cada paso; SOBRE RUEDAS O EN EL AGUA ('ruedas':
   bici, patines, surf, remo, kayak, nadar) no hay rebote y manda el GPS. Una propia con mapa que se creó antes de esto queda en `null` hasta que se le pregunte.
   NADAR lleva mapa en el iPhone desde el 6 nov 2026, como Strava (`docs/superpowers/specs/2026-11-06-nadar-en-el-reloj.md`), pero no se pausa solo (`sinPausaAutomatica`
   en `lib/entrenoLibre.js`). En el Apple Watch se pregunta dónde nada: en alberca no hay GPS ni mapa. */
export const DESPLAZAMIENTOS = Object.freeze(['pie', 'ruedas']);
const esDesplazamiento = (d) => DESPLAZAMIENTOS.includes(d);

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
  // Con mapa, cómo se mueve ('pie' | 'ruedas'), o `null` si todavía no se le preguntó. Sin mapa, el campo no va.
  const desplazamiento = gps ? (esDesplazamiento(p.desplazamiento) ? p.desplazamiento : null) : undefined;
  return Object.freeze({ id: p.id, nombre, icono, color, gps, deporte: 'otro', propia: true, ...(gps ? { desplazamiento } : {}) });
}

/** La familia de una actividad para la pausa automática: 'pie', 'ruedas' o `null` (sin mapa, o una propia que todavía no lo dice). */
export const desplazamientoDe = (actividad) => (actividad?.gps && esDesplazamiento(actividad.desplazamiento) ? actividad.desplazamiento : null);

/** Las propias guardadas, limpias y sin repetidas. */
export const propiasDe = (lista) => (Array.isArray(lista) ? lista : []).map(limpiaPropia).filter(Boolean).filter((p, i, arr) => arr.findIndex((x) => x.id === p.id) === i);

/**
 * La actividad nueva que crea la persona, lista para guardarse, o `null` si el nombre está vacío. Si ya existe una con ese nombre (del catálogo o suya), se devuelve
 * ESA en lugar de crear otra igual (`yaExistia: true`).
 */
export function creaActividad({ nombre, icono, color, gps, desplazamiento }, propias = [], ahora = Date.now()) {
  const n = conMayuscula(String(nombre ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE));
  if (!n) return null;
  const igual = [...propiasDe(propias), ...CATALOGO].find((x) => sinAcentos(x.nombre) === sinAcentos(n));
  if (igual) return { actividad: igual, yaExistia: true };
  const actividad = limpiaPropia({ id: `p-${ahora.toString(36)}`, nombre: n, icono, color, gps, desplazamiento });
  return { actividad, yaExistia: false };
}

/**
 * Una propia con cambios (al editarla en la lista de actividades): la misma, con su mismo id, lista para guardarse. `{ error }` si el nombre queda vacío o ya lo
 * tiene otra (del catálogo o suya).
 */
export function editaActividad(propia, cambios, propias = []) {
  const n = conMayuscula(String(cambios?.nombre ?? propia?.nombre ?? '').replace(/\s+/g, ' ').trim().slice(0, MAX_NOMBRE));
  if (!propia?.propia) return { error: 'Solo se editan las tuyas.' };
  if (!n) return { error: 'Escribe cómo se llama.' };
  const otra = [...propiasDe(propias), ...CATALOGO].find((x) => x.id !== propia.id && sinAcentos(x.nombre) === sinAcentos(n));
  if (otra) return { error: `Ya hay una que se llama «${otra.nombre}».` };
  return { actividad: limpiaPropia({ ...propia, ...cambios, id: propia.id, nombre: n }) };
}

/** Las propias con una cambiada (la misma, por su id). */
export const cambiaPropia = (lista, actividad) => propiasDe(lista).map((x) => (x.id === actividad.id ? actividad : x));

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
