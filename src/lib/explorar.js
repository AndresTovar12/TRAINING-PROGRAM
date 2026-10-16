/* EXPLORAR (12 oct 2026): donde quien no tiene plan encuentra coaches con planes a la venta. Lo puro: qué deporte se le ofrece primero, cómo se busca, cómo se filtra y los textos.
   Se prueba con `scripts/prueba-explorar.mjs`. Los datos vienen de la función de la base `explorar_publico` (ver `docs/sql/2026-10-12-explorar-publico.sql`):
   un coach = { usuario, nombre, foto, profesion, disciplinas[], deportes[], n_planes, desde, planes[] }. */

import { DISCIPLINAS } from './oficios.js';

/** De los deportes que registra un entreno (ids de `lib/metricas/deportes`) a las disciplinas con que los coaches describen lo que enseñan (ids de `oficios`). */
const DISCIPLINA_DEL_ENTRENO = {
  correr: 'running', caminar: 'running', senderismo: 'running',
  bici: 'ciclismo', natacion: 'natacion', remo: 'hibrido', eliptica: 'hibrido',
  fuerza: 'fuerza', hiit: 'hibrido', funcional: 'hibrido', yoga: 'yoga', movilidad: 'rehab', futbol: 'deportes', raqueta: 'deportes',
};

const ORDEN = new Map(DISCIPLINAS.map((d, i) => [d.id, i]));
export const nombreDeDeporte = (id) => DISCIPLINAS.find((d) => d.id === id)?.nombre ?? id;

/** La disciplina que más ha entrenado esta persona (por número de entrenos), o `null` si no tiene ninguno que cuente. `entrenos`: filas con `deporte`. */
export function deporteFavorito(entrenos) {
  const cuenta = new Map();
  for (const e of entrenos ?? []) {
    const d = DISCIPLINA_DEL_ENTRENO[e?.deporte];
    if (d) cuenta.set(d, (cuenta.get(d) ?? 0) + 1);
  }
  let mejor = null;
  for (const [d, n] of cuenta) if (!mejor || n > mejor[1] || (n === mejor[1] && (ORDEN.get(d) ?? 99) < (ORDEN.get(mejor[0]) ?? 99))) mejor = [d, n];
  return mejor?.[0] ?? null;
}

/** Los deportes con los que un coach se describe: lo que marcó en su perfil y lo de sus planes, sin repetir. */
export const deportesDelCoach = (c) => [...new Set([...(c?.disciplinas ?? []), ...(c?.deportes ?? [])])];

/** Las fichas de deporte que salen: SOLO los que algún coach tiene, con el favorito de la persona primero y el resto en el orden de siempre. */
export function deportesQueSalen(coaches, favorito = null) {
  const hay = new Set((coaches ?? []).flatMap(deportesDelCoach).filter((d) => ORDEN.has(d)));
  const lista = [...hay].sort((a, b) => ORDEN.get(a) - ORDEN.get(b));
  return favorito && hay.has(favorito) ? [favorito, ...lista.filter((d) => d !== favorito)] : lista;
}

const sinAcentos = (t) => String(t ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

/** ¿Este coach coincide con lo que se escribió? Busca en su nombre, su usuario, su oficio, los nombres de sus planes y los deportes que enseña. */
export function coincideConBusqueda(coach, texto) {
  const q = sinAcentos(texto).trim();
  if (!q) return true;
  const paja = [coach.nombre, coach.usuario, coach.profesion, ...(coach.planes ?? []).map((p) => p.titulo), ...deportesDelCoach(coach).map(nombreDeDeporte)].map(sinAcentos).join(' ');
  return q.split(/\s+/).every((palabra) => paja.includes(palabra));
}

/** Los coaches que quedan con la búsqueda y el deporte elegido (`deporte` null = todos), ordenados: primero los del deporte favorito, luego con más planes, luego por nombre. */
export function coachesParaMostrar(coaches, { texto = '', deporte = null, favorito = null } = {}) {
  const lista = (coaches ?? []).filter((c) => coincideConBusqueda(c, texto) && (!deporte || deportesDelCoach(c).includes(deporte)));
  const puntos = (c) => (favorito && deportesDelCoach(c).includes(favorito) ? 1 : 0);
  return [...lista].sort((a, b) => puntos(b) - puntos(a) || (b.n_planes ?? 0) - (a.n_planes ?? 0) || String(a.nombre ?? '').localeCompare(String(b.nombre ?? ''), 'es', { sensitivity: 'base' }));
}

/** Los planes de varios coaches en una sola tira (con quién los vende), los más baratos de cada coach primero no: se respeta el orden de los coaches y el de sus planes. */
export function planesDeLosCoaches(coaches, tope = 12) {
  return (coaches ?? []).flatMap((c) => (c.planes ?? []).map((p) => ({ ...p, coach: { usuario: c.usuario, nombre: c.nombre, foto: c.foto ?? null } }))).slice(0, tope);
}

/** «desde $500» (o «$500» si es un solo plan). */
export const desdeTexto = (c) => (c?.desde > 0 ? `${c.n_planes > 1 ? 'desde ' : ''}$${Number(c.desde).toLocaleString('es-MX')}` : '');

/** «3 planes», «1 plan». */
export const planesTexto = (n) => `${n} ${n === 1 ? 'plan' : 'planes'}`;
