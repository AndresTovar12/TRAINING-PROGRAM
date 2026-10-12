import { DISCIPLINAS, nombreDeDisciplina } from './oficios.js';

/* «PARA QUIÉN ES» UN PLAN EN VENTA, con opciones en vez de texto libre.

   Andrés, 12 oct 2026: «lo de para quién podrías desarrollarlo un poquito más, con opciones de edades o cosas así». Cuatro datos que el coach marca (el nivel y el objetivo van aparte):
     · deporte o disciplina — la misma lista que ya existe (`lib/oficios.js`): fuerza, running, pilates, fútbol americano…
     · edades — rangos; ninguno marcado quiere decir «todas las edades»
     · sexo — todos, mujeres u hombres
     · equipo que necesita — dónde se entrena

   Se guardan como ids en `vitrina_planes` (`deportes`, `edades`, `sexo`, `equipo`) y aquí se vuelven palabras, para la ficha del coach y para la página pública.
   Sin red ni React: se prueba en `scripts/prueba-vitrina.mjs`. */

export const DEPORTES = DISCIPLINAS.map((d) => ({ id: d.id, nombre: d.nombre }));

export const EDADES = [
  { id: '15-18', nombre: '15 a 18' },
  { id: '18-30', nombre: '18 a 30' },
  { id: '30-45', nombre: '30 a 45' },
  { id: '45+', nombre: '45 en adelante' },
];

export const SEXOS = [
  { id: 'todos', nombre: 'Hombres y mujeres' },
  { id: 'mujeres', nombre: 'Mujeres' },
  { id: 'hombres', nombre: 'Hombres' },
];

export const EQUIPOS = [
  { id: 'gym', nombre: 'Gym completo' },
  { id: 'casa', nombre: 'Mancuernas y ligas en casa' },
  { id: 'sin_equipo', nombre: 'Sin equipo' },
  { id: 'reformer', nombre: 'Reformer o máquinas de pilates' },
  { id: 'bici', nombre: 'Bici o rodillo' },
  { id: 'cancha', nombre: 'Cancha o pista' },
];

export const NIVELES = [
  { id: 'todos', nombre: 'Todos los niveles' },
  { id: 'principiante', nombre: 'Principiante' },
  { id: 'intermedio', nombre: 'Intermedio' },
  { id: 'avanzado', nombre: 'Avanzado' },
];

const nombreDe = (lista, id) => lista.find((x) => x.id === id)?.nombre ?? id;

/** Los ids marcados de una lista, sin repetir y sin los que ya no existen, en el orden de la lista. */
export const marcadosValidos = (lista, ids) => lista.filter((x) => (ids ?? []).includes(x.id)).map((x) => x.id);

/** «18 a 30 años», «15 a 18 y 30 a 45 años», «45 en adelante»: lo marcado de edades, en palabras. Nada marcado = cadena vacía (todas las edades). */
export function textoDeEdades(ids) {
  const nombres = marcadosValidos(EDADES, ids).map((id) => nombreDe(EDADES, id));
  if (!nombres.length) return '';
  const cuerpo = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
  return /en adelante$/.test(cuerpo) ? cuerpo : `${cuerpo} años`;
}

/**
 * Las frases cortas de «para quién», en orden y listas para chips: deportes · edades · sexo (solo si no es «todos») · equipo.
 * `plan`: lo que trae la ficha pública o la fila de `vitrina_planes`.
 */
export function chipsDeParaQuien(plan) {
  const chips = [];
  (plan?.deportes ?? []).forEach((id) => chips.push(nombreDeDisciplina(id)));
  const edades = textoDeEdades(plan?.edades);
  if (edades) chips.push(edades);
  if (plan?.sexo === 'mujeres' || plan?.sexo === 'hombres') chips.push(nombreDe(SEXOS, plan.sexo));
  marcadosValidos(EQUIPOS, plan?.equipo).forEach((id) => chips.push(nombreDe(EQUIPOS, id)));
  return chips;
}
