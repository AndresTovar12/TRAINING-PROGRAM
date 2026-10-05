/**
 * Un ejercicio que cambia de una vuelta a otra: 10 reps al 60 %, luego 8 al 70 %, 6 al 80 %…
 *
 * POR QUÉ EXISTE. Andrés, 5 oct 2026: «¿qué pasa si en un ejercicio que se repite 4 veces quiero que el
 * atleta haga una carga diferente en cada set?». Hasta hoy un ejercicio tenía UNAS reps y UNA carga para
 * todas las vueltas del Set, y la única salida era partirlo en cuatro Sets de una vuelta.
 *
 * DÓNDE SE GUARDA. En el propio ejercicio: `porVuelta: [{ reps, intensity }, …]`, una entrada por cada vez
 * que se repite el Set (`sets`). `reps` e `intensity` de siempre NO desaparecen: llevan lo de la PRIMERA
 * vuelta, para que todo lo que solo conoce esos dos campos siga leyendo algo con sentido.
 *
 * `porVuelta` SOLO EXISTE CUANDO ALGO CAMBIA. Si todas las vueltas quedan iguales, se quita: así un
 * ejercicio normal y uno «desplegado y vuelto a cerrar sin tocar nada» son el mismo dato, y nadie tiene que
 * preguntarse cuál de las dos formas manda.
 *
 * No se combina con un formato de reloj (AMRAP, EMOM…): ahí las vueltas son del reloj, no del ejercicio.
 *
 * En pantalla NUNCA se resume como «10-8-6-4» dentro de una casilla: así se escribe un drop set (Andrés,
 * 5 oct 2026: «podría parecer un drop set»). Cerrado, el campo dice «Varía»; los números van uno por fila.
 */

const MAX_VUELTAS = 30;

const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const fila = (v) => ({ reps: String(v?.reps ?? ''), intensity: String(v?.intensity ?? '') });

/** Cuántas vueltas da el Set, cuando es un número claro de 2 o más. Si no («—», «3-4», 1), `null`. */
export function rondasDe(sets) {
  const t = String(sets ?? '').trim();
  if (!/^\d+$/.test(t)) return null;
  const n = parseInt(t, 10);
  return n >= 2 && n <= MAX_VUELTAS ? n : null;
}

/** Qué cambia de una vuelta a otra: `{ reps, intensity, alguno }`. */
export function varian(filas) {
  const reps = filas.some((f) => f.reps !== filas[0].reps);
  const intensity = filas.some((f) => f.intensity !== filas[0].intensity);
  return { reps, intensity, alguno: reps || intensity };
}

/**
 * Las vueltas de un ejercicio que cambia, una por cada vez que se repite su Set; `null` si todas son
 * iguales (que es lo normal). Si el Set se repite más veces de las guardadas, las que faltan copian la
 * última; si se repite menos, sobran y no se cuentan.
 */
export function vueltasDe(ex, rondas = rondasDe(ex?.sets)) {
  if (!rondas || !ex || ex.isNote || ex.formato || !Array.isArray(ex.porVuelta) || !ex.porVuelta.length) return null;
  const filas = ex.porVuelta.slice(0, rondas).map(fila);
  while (filas.length < rondas) filas.push({ ...filas[filas.length - 1] });
  return varian(filas).alguno ? filas : null;
}

/** Las filas que se enseñan al desplegar: las que cambian, o tantas copias de la única como vueltas haya. */
export function filasParaEditar(ex, rondas) {
  return vueltasDe(ex, rondas) ?? Array.from({ length: rondas }, () => fila(ex));
}

/** Lo que hay que guardar en el ejercicio para que sus vueltas sean `filas` (todas iguales = sin `porVuelta`). */
export function parcheDeVueltas(filas) {
  const limpias = filas.map(fila);
  return {
    reps: limpias[0].reps,
    intensity: limpias[0].intensity,
    porVuelta: varian(limpias).alguno ? limpias : undefined,
  };
}

/** El ejercicio tal como es en UNA vuelta: el mismo, con las reps y la carga de esa vuelta. */
export function ejercicioDeVuelta(ex, f) {
  return { ...ex, reps: f.reps, intensity: f.intensity };
}

/**
 * El ejercicio como debe guardarse en un Set que se repite `sets` veces: las vueltas recortadas o
 * completadas a ese número, y sin `porVuelta` si ya no cambia nada o el Set ya no admite vueltas distintas.
 */
export function normalizaVueltas(ex, sets = ex?.sets) {
  if (!ex || !('porVuelta' in ex)) return ex;
  const { porVuelta, ...resto } = ex;
  const filas = vueltasDe({ ...resto, porVuelta, sets }, rondasDe(sets));
  if (!filas) return resto;
  return { ...resto, ...parcheDeVueltas(filas) };
}

/* ------------------------------------------------------------------ */
/* Lo que anota el atleta, vuelta por vuelta                           */
/* ------------------------------------------------------------------ */

/**
 * Lo anotado va en el registro del ejercicio como `vueltas: { '0': { repsHechas, weight }, '1': … }`.
 * Es un OBJETO con la vuelta por llave y no una lista, a propósito: el estado del atleta se guarda por
 * partes y la base mezcla los objetos llave por llave, pero las listas las reemplaza enteras (ver
 * `estadoPorPartes.js`). Con una lista, anotar la vuelta 2 desde la IA y la 3 desde el teléfono se pisarían.
 *
 * `weight` y `repsHechas` del ejercicio se mantienen al día con el RESUMEN: la vuelta más pesada (o, sin
 * peso, la mejor cantidad). Es lo que leen el progreso, los récords y la IA, que no saben de vueltas.
 */
export function anotadoEnVuelta(exData, i) {
  const v = exData?.vueltas?.[i];
  return esObjeto(v) ? v : {};
}

const numero = (t) => {
  const n = parseFloat(String(t ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/** El resumen de varias vueltas anotadas: `{ weight, repsHechas }` de la más pesada o de la mejor. */
export function resumenDeVueltas(vueltas) {
  const filas = Object.values(esObjeto(vueltas) ? vueltas : {}).filter(esObjeto);
  let pesada = null;
  for (const f of filas) {
    const kg = numero(f.weight);
    if (kg !== null && (pesada === null || kg > pesada.kg)) pesada = { kg, f };
  }
  if (pesada) return { weight: String(pesada.f.weight), repsHechas: String(pesada.f.repsHechas ?? '') };
  let mejor = null;
  for (const f of filas) {
    const n = numero(f.repsHechas);
    if (n !== null && (mejor === null || n > mejor)) mejor = n;
  }
  return { weight: '', repsHechas: mejor === null ? '' : String(mejor) };
}

/** El registro del ejercicio con lo anotado en la vuelta `i`, y su resumen al día. */
export function conVueltaAnotada(exData, i, dato) {
  const antes = esObjeto(exData?.vueltas) ? exData.vueltas : {};
  const vueltas = { ...antes, [i]: { ...anotadoEnVuelta(exData, i), ...dato } };
  return { ...exData, vueltas, ...resumenDeVueltas(vueltas) };
}

/** En cuántas de las `total` vueltas hay algo anotado. */
export function vueltasAnotadas(exData, total) {
  let n = 0;
  for (let i = 0; i < total; i += 1) {
    const v = anotadoEnVuelta(exData, i);
    if (String(v.weight ?? '').trim() || String(v.repsHechas ?? '').trim()) n += 1;
  }
  return n;
}
