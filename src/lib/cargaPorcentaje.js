import { desdeKilos, etiquetaUnidad } from './unidades.js';

/**
 * Cuántos kilos (o libras) son «75%».
 *
 * Cuando el plan dice «75%» el atleta quiere saber qué barra cargar. El porcentaje es de SU 1RM
 * (pestaña 1RM, `wr:onerm`, guardado siempre en kilos), y de ese ejercicio.
 *
 * ANTE LA DUDA, NO ADIVINA. La primera versión buscaba palabras en el nombre: todo lo que
 * llevara «squat» usaba el 1RM del Back Squat, todo lo que llevara «bench», el del Bench Press.
 * Pero un Goblet Squat, una sentadilla búlgara o un press de banca con mancuernas NO son el
 * levantamiento del 1RM: el número salía y era falso, sin avisar. Medido el 5 oct
 * 2026 contra los 114 ejercicios del repertorio: la regla vieja daba una cifra en 41 y solo 7
 * eran de verdad ese levantamiento. Calculaba el Overhead Press para un Pallof Press y el
 * Deadlift para unos saltos de valla («hurdle» contiene «rdl»). Ahora solo cuenta cuando el
 * ejercicio ES uno de los 9 levantamientos de la pestaña 1RM, por su nombre completo. Lo demás
 * no inventa nada: se queda en «75%», que es lo que dijo el coach.
 */

/** Los 9 levantamientos de la pestaña 1RM. Las llaves son las que ya guarda `wr:onerm`. */
export const LEVANTAMIENTOS = [
  { key: 'back_squat', nombre: 'Back Squat' },
  { key: 'front_squat', nombre: 'Front Squat' },
  { key: 'bench_press', nombre: 'Bench Press' },
  { key: 'incline_bench', nombre: 'Incline Bench Press' },
  { key: 'trap_bar_dl', nombre: 'Trap Bar Deadlift' },
  { key: 'deadlift', nombre: 'Deadlift / RDL' },
  { key: 'overhead_press', nombre: 'Overhead Press' },
  { key: 'row', nombre: 'Barbell Row' },
  { key: 'hang_clean', nombre: 'Hang Clean' },
];

/* Cómo se le llama a cada uno, completo y en limpio (minúsculas, sin acentos). Un nombre que
   solo lo CONTIENE no vale: «goblet squat» contiene «squat» y no es el Back Squat. */
const NOMBRES = {
  back_squat: ['back squat', 'barbell back squat', 'squat', 'sentadilla', 'sentadilla trasera', 'sentadilla con barra'],
  front_squat: ['front squat', 'sentadilla frontal'],
  bench_press: ['bench press', 'barbell bench press', 'bench', 'press de banca', 'press banca', 'press de banca plano'],
  incline_bench: ['incline bench press', 'incline bench', 'press inclinado', 'press de banca inclinado', 'press banca inclinado'],
  trap_bar_dl: ['trap bar deadlift', 'hex bar deadlift', 'hexbar deadlift', 'trap bar', 'peso muerto trap bar', 'peso muerto con barra hexagonal'],
  deadlift: ['deadlift', 'conventional deadlift', 'rdl', 'romanian deadlift', 'peso muerto', 'peso muerto convencional', 'peso muerto rumano'],
  overhead_press: ['overhead press', 'barbell shoulder press', 'barbell overhead press', 'military press', 'ohp', 'press militar', 'press de hombro con barra'],
  row: ['barbell row', 'bent over row', 'bent over barbell row', 'pendlay row', 'remo con barra'],
  hang_clean: ['hang clean', 'hang power clean', 'cargada colgada'],
};

const POR_NOMBRE = new Map(Object.entries(NOMBRES).flatMap(([key, nombres]) => nombres.map((n) => [n, key])));

const limpia = (texto) => String(texto ?? '')
  .toLowerCase()
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9 ]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

/** El levantamiento de la pestaña 1RM que ES este ejercicio, o `null` (una variante, o uno que no está). */
export function levantamientoDe(ex) {
  if (!ex || ex.isNote) return null;
  const key = POR_NOMBRE.get(limpia(ex.name));
  return key ? LEVANTAMIENTOS.find((l) => l.key === key) : null;
}

/**
 * El porcentaje que pide la intensidad, como `{ min, max }`: «75%» → 75 y 75; «70-75%» → 70 y
 * 75. Solo el primero que aparezca («70% / RPE 8»). `null` si no hay ninguno que se entienda.
 */
export function porcentajeDe(intensidad) {
  // «85% intensidad» es un esfuerzo, no un porcentaje del 1RM: no hay kilos que sacar de ahí.
  if (/%\s*intensidad/i.test(String(intensidad ?? ''))) return null;
  const t = String(intensidad ?? '').replace(',', '.');
  const num = '(\\d{1,3}(?:\\.\\d+)?)';
  const rango = t.match(new RegExp(`${num}\\s*(?:-|–|—|a)\\s*${num}\\s*%`, 'i'));
  const par = rango ? [parseFloat(rango[1]), parseFloat(rango[2])] : null;
  const solo = par ? null : t.match(new RegExp(`${num}\\s*%`));
  const [a, b] = par ?? (solo ? [parseFloat(solo[1]), parseFloat(solo[1])] : [null, null]);
  if (a === null || Math.min(a, b) <= 0 || Math.max(a, b) > 150) return null;
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

/**
 * El porcentaje de un 1RM, en la unidad del atleta y redondeado a lo que se puede cargar: de
 * 2.5 en 2.5 kilos o de 5 en 5 libras. `uno` viene en kilos, como se guarda.
 */
export function cargaDe(unoEnKilos, porcentaje, unidad) {
  const base = desdeKilos(unoEnKilos, unidad);
  const paso = unidad === 'lb' ? 5 : 2.5;
  return Math.round(((base * porcentaje) / 100) / paso) * paso;
}

/**
 * Todo lo que la pantalla necesita para un ejercicio con porcentaje, o `null` si no aplica.
 *
 *   { lift, porcentaje, falta: false, desde, hasta, texto }   — con 1RM guardado: «≈ 95–100 kg»
 *   { lift, porcentaje, falta: true }                          — es un levantamiento de la lista,
 *                                                                pero todavía no anotó su 1RM
 */
export function cargaPorPorcentaje(ex, oneRMs, unidad) {
  const porcentaje = porcentajeDe(ex?.intensity);
  if (!porcentaje) return null;
  const lift = levantamientoDe(ex);
  if (!lift) return null;
  const uno = Number(oneRMs?.[lift.key]);
  if (!Number.isFinite(uno) || uno <= 0) return { lift, porcentaje, falta: true };
  const desde = cargaDe(uno, porcentaje.min, unidad);
  const hasta = cargaDe(uno, porcentaje.max, unidad);
  const u = etiquetaUnidad(unidad);
  return {
    lift, porcentaje, falta: false, desde, hasta,
    texto: desde === hasta ? `≈ ${desde} ${u}` : `≈ ${desde}–${hasta} ${u}`,
  };
}
