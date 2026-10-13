import { DISCIPLINAS, nombreDeDisciplina } from './oficios.js';

/* «PARA QUIÉN ES» UN PLAN EN VENTA, con opciones en vez de texto libre.

   Andrés, 12 oct 2026: «lo de para quién podrías desarrollarlo un poquito más, con opciones de edades o cosas así». Cuatro datos que el coach marca (el nivel y el objetivo van aparte):
     · deporte o disciplina — la misma lista que ya existe (`lib/oficios.js`): fuerza, running, pilates, fútbol americano…
     · edades — rangos: cuatro de uso común y los que el coach escriba (13 oct 2026: «tiene que ser más customizable»); ninguno marcado quiere decir «todas las edades»
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

/* ---- Edades: los cuatro rangos de siempre y los que el coach escriba ----
   Un rango es un id de texto: `18-30` (de 18 a 30) o `60+` (de 60 en adelante). Los cuatro de `EDADES` son los de uso común; cualquier otro con ese mismo formato vale igual,
   así que no hace falta tocar la base (`vitrina_planes.edades` es una lista de textos). */

export const EDAD_MINIMA = 5;
export const EDAD_MAXIMA = 99;

/** `{ min, max }` de un id de edad (`max` null = en adelante); null si no es un rango válido. */
export function rangoDeEdad(id) {
  const m = /^(\d{1,3})(?:-(\d{1,3})|(\+))$/.exec(String(id ?? ''));
  if (!m) return null;
  const min = Number(m[1]);
  const max = m[3] ? null : Number(m[2]);
  if (min < EDAD_MINIMA || min > EDAD_MAXIMA) return null;
  if (max !== null && (max <= min || max > EDAD_MAXIMA)) return null;
  return { min, max };
}

/** El id de un rango escrito a mano. `max` vacío = en adelante. Null si no vale (la edad de inicio es obligatoria y el tope tiene que ser mayor). */
export function idDeRango(min, max) {
  const a = Number(min);
  if (min === '' || min == null || !Number.isInteger(a)) return null;
  const sinTope = max === '' || max == null;
  const id = sinTope ? `${a}+` : `${a}-${Number(max)}`;
  return rangoDeEdad(id) ? id : null;
}

/** Por qué no vale lo escrito, para decírselo al coach; cadena vacía si vale. */
export function problemaDeRango(min, max) {
  if (min === '' || min == null) return 'Escribe desde qué edad.';
  const a = Number(min);
  if (!Number.isInteger(a) || a < EDAD_MINIMA || a > EDAD_MAXIMA) return `La primera edad va de ${EDAD_MINIMA} a ${EDAD_MAXIMA}.`;
  if (max === '' || max == null) return '';
  const b = Number(max);
  if (!Number.isInteger(b) || b > EDAD_MAXIMA) return `La segunda edad llega hasta ${EDAD_MAXIMA}.`;
  if (b <= a) return 'La segunda edad tiene que ser mayor que la primera.';
  return '';
}

/** Los rangos válidos de una lista de ids: sin repetir y ordenados de menor a mayor edad. Los cuatro de siempre y los propios. */
export function edadesValidas(ids) {
  const unicos = [...new Set((Array.isArray(ids) ? ids : []).filter((id) => rangoDeEdad(id)))];
  return unicos.sort((x, y) => {
    const a = rangoDeEdad(x);
    const b = rangoDeEdad(y);
    return a.min - b.min || (a.max ?? Infinity) - (b.max ?? Infinity);
  });
}

/** Un rango en palabras: «18 a 30», «60 en adelante». */
export function nombreDeEdad(id) {
  const r = rangoDeEdad(id);
  if (!r) return String(id ?? '');
  return r.max === null ? `${r.min} en adelante` : `${r.min} a ${r.max}`;
}

/** «18 a 30 años», «15 a 18 y 30 a 45 años», «18 en adelante»: lo marcado de edades, en palabras. Los que se tocan o se encimen se juntan (18 a 30 + 30 a 45 = 18 a 45).
 *  Nada marcado = cadena vacía (todas las edades). */
export function textoDeEdades(ids) {
  const juntos = [];
  for (const id of edadesValidas(ids)) {
    const r = rangoDeEdad(id);
    const ultimo = juntos[juntos.length - 1];
    if (ultimo && (ultimo.max === null || r.min <= ultimo.max)) ultimo.max = ultimo.max === null || r.max === null ? null : Math.max(ultimo.max, r.max);
    else juntos.push({ ...r });
  }
  const nombres = juntos.map((r) => (r.max === null ? `${r.min} en adelante` : `${r.min} a ${r.max}`));
  if (!nombres.length) return '';
  const cuerpo = nombres.length === 1 ? nombres[0] : `${nombres.slice(0, -1).join(', ')} y ${nombres[nombres.length - 1]}`;
  return /en adelante$/.test(cuerpo) ? cuerpo : `${cuerpo} años`;
}

/**
 * Las frases cortas de «para quién», en orden y listas para chips: deportes · edades · sexo (solo si no es «todos») · equipo.
 * `plan`: lo que trae la ficha pública o la fila de `vitrina_planes`. Con `siempreEdad`, si no marcó ninguna sale «Todas las edades» (la página del plan y la tarjeta del coach lo
 * dicen; las tarjetas chicas de la tienda callan lo que no limita).
 */
export function chipsDeParaQuien(plan, { siempreEdad = false } = {}) {
  const chips = [];
  (plan?.deportes ?? []).forEach((id) => chips.push(nombreDeDisciplina(id)));
  const edades = textoDeEdades(plan?.edades) || (siempreEdad ? 'Todas las edades' : '');
  if (edades) chips.push(edades);
  if (plan?.sexo === 'mujeres' || plan?.sexo === 'hombres') chips.push(nombreDe(SEXOS, plan.sexo));
  marcadosValidos(EQUIPOS, plan?.equipo).forEach((id) => chips.push(nombreDe(EQUIPOS, id)));
  return chips;
}
