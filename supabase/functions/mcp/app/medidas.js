/**
 * Qué mide un ejercicio: NO confundir con `unidades.js`, que son kilos y
 * libras del PESO levantado. Aquí se trata de qué mide la propia serie.
 *
 * Qué mide un ejercicio: repeticiones, tiempo, distancia o calorías.
 *
 * POR QUÉ EXISTE. Andrés, PDF 2.0 punto 5a: la app debe ENTENDER el número.
 * Hasta ahora el campo `reps` era texto libre y se trataba todo como
 * repeticiones. Ya se escribían "30 yd" y "15 min", pero solo se mostraban:
 * la app no sabía que eran 30 yardas ni 15 minutos, así que el progreso
 * comparaba cosas que no se comparan, el 1RM se rompía, y el atleta tenía que
 * registrar 30 metros picando una flecha de +1 treinta veces.
 *
 * NO SE TOCA NINGÚN PLAN YA ESCRITO. La unidad se guarda en el ejercicio
 * cuando el coach la elige, y mientras tanto se deduce del texto que ya hay.
 * Un plan de hace un mes sigue diciendo "30 yd" en la base y se lee igual de
 * bien; si el coach lo abre y lo guarda, queda explícito.
 *
 * ANTE LA DUDA, NO ADIVINA. "5/lado" o "AMRAP" no encajan en ninguna unidad, y
 * lo correcto es dejarlos como texto y enseñarlos tal cual, no forzarlos a
 * repeticiones y mentir en las cuentas.
 */

export const MEDIDAS = [
  { id: 'reps', etiqueta: 'Repeticiones', corta: 'reps', rotulo: 'Reps', familia: 'conteo' },
  { id: 'seg', etiqueta: 'Segundos', corta: 'seg', rotulo: 'Segundos', familia: 'tiempo' },
  { id: 'min', etiqueta: 'Minutos', corta: 'min', rotulo: 'Minutos', familia: 'tiempo' },
  { id: 'm', etiqueta: 'Metros', corta: 'm', rotulo: 'Metros', familia: 'distancia' },
  { id: 'km', etiqueta: 'Kilómetros', corta: 'km', rotulo: 'Kilómetros', familia: 'distancia' },
  { id: 'yd', etiqueta: 'Yardas', corta: 'yd', rotulo: 'Yardas', familia: 'distancia' },
  { id: 'cal', etiqueta: 'Calorías', corta: 'cal', rotulo: 'Calorías', familia: 'energia' },
];

const PORID = Object.fromEntries(MEDIDAS.map((u) => [u.id, u]));

export const medida = (id) => PORID[id] ?? PORID.reps;
export const esTiempo = (id) => medida(id).familia === 'tiempo';
export const esDistancia = (id) => medida(id).familia === 'distancia';
export const esConteo = (id) => medida(id).familia === 'conteo';

/* Cómo se escribe cada unidad en la vida real. El orden importa: se prueba de
   la más larga a la más corta, porque "min" empieza por "m" y sin ese orden
   "15 min" se leería como 15 metros seguido de basura. */
const ESCRITURAS = [
  ['cal', ['kcal', 'calorias', 'calorías', 'cals', 'cal']],
  ['min', ['minutos', 'mins', 'min']],
  ['seg', ['segundos', 'segs', 'seg', 's']],
  ['km', ['kilometros', 'kilómetros', 'kms', 'km']],
  ['yd', ['yardas', 'yards', 'yds', 'yd']],
  ['m', ['metros', 'mts', 'mt', 'm']],
];

// Un número entero o decimal, o un rango de dos: "10", "8-10", "2.5".
const NUMERO = '\\d+(?:[.,]\\d+)?';
const CANTIDAD = new RegExp(`^(${NUMERO}(?:\\s*-\\s*${NUMERO})?)\\s*(.*)$`);

/**
 * Lee un ejercicio y dice cuánto es y de qué.
 *
 * Devuelve `{ cantidad, unidad, libre }`:
 *   cantidad — el número o el rango, como texto ("30", "8-10")
 *   unidad   — el id de UNIDADES
 *   libre    — true cuando el texto no se pudo entender. Entonces `cantidad`
 *              trae el texto entero y hay que mostrarlo tal cual.
 */
export function leeCantidad(ex) {
  const crudo = String(ex?.reps ?? '').trim();
  if (!crudo || crudo === '—') return { cantidad: '', unidad: ex?.unidad || 'reps', libre: false };

  // Si el coach ya eligió la unidad, manda ella. El texto puede traer restos
  // de la unidad vieja ("30 yd" con unidad 'm'), y se limpian.
  if (ex?.unidad && PORID[ex.unidad]) {
    const m = crudo.match(CANTIDAD);
    return m
      ? { cantidad: m[1].replace(/\s/g, ''), unidad: ex.unidad, libre: false }
      : { cantidad: crudo, unidad: ex.unidad, libre: true };
  }

  const m = crudo.match(CANTIDAD);
  if (!m) return { cantidad: crudo, unidad: 'reps', libre: true };

  const [, numero, resto] = m;
  const cola = resto.trim().toLowerCase();

  // Un número solo son repeticiones: es lo que la app ha supuesto siempre.
  if (!cola) return { cantidad: numero.replace(/\s/g, ''), unidad: 'reps', libre: false };

  for (const [id, formas] of ESCRITURAS) {
    for (const forma of formas) {
      if (cola === forma || cola === `${forma}.`) {
        return { cantidad: numero.replace(/\s/g, ''), unidad: id, libre: false };
      }
    }
  }

  /* Hay cola y no es una unidad conocida: "5/lado", "10 por brazo", "3 rondas".
     Se deja entero y sin interpretar. Forzarlo a repeticiones perdería el
     "/lado", que es justo lo que le dice al atleta qué hacer. */
  return { cantidad: crudo, unidad: 'reps', libre: true };
}

/** Lo que se lee en pantalla: "30 m", "8-10 reps", "45 seg", "5/lado". */
export function textoMeta(ex) {
  const { cantidad, unidad: id, libre } = leeCantidad(ex);
  if (!cantidad) return null;
  if (libre) return cantidad;
  if (id === 'reps') return cantidad === '1' ? '1 rep' : `${cantidad} reps`;
  return `${cantidad} ${medida(id).corta}`;
}

/** El número solo, sin rango, para cuentas. `null` si no hay uno limpio. */
export function numeroDe(texto) {
  const t = String(texto ?? '').trim().replace(',', '.');
  return /^\d+(\.\d+)?$/.test(t) ? parseFloat(t) : null;
}

/**
 * Segundos que dura la meta, para arrancar el cronómetro.
 * `null` si el ejercicio no se mide en tiempo o el valor es un rango.
 */
export function metaEnSegundos(ex) {
  const { cantidad, unidad: id, libre } = leeCantidad(ex);
  if (libre || !esTiempo(id)) return null;
  const n = numeroDe(cantidad);
  if (n === null) return null;
  return id === 'min' ? Math.round(n * 60) : Math.round(n);
}

/** "01:30" a partir de segundos. Para el cronómetro y lo registrado. */
export function comoReloj(segundos) {
  const s = Math.max(0, Math.round(Number(segundos) || 0));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * ¿Se puede comparar el progreso de este ejercicio contra el de otro día?
 *
 * Solo si los dos miden lo mismo. Sumar 30 metros con 30 repeticiones da 60 de
 * nada, y ese era justo el error que hacía que el progreso mintiera.
 */
export const mismaMedida = (a, b) => leeCantidad(a).unidad === leeCantidad(b).unidad;
