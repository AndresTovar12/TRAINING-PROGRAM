import { leeCantidad, leeDescanso, textoMeta } from './medidas.js';
import { vueltasDe } from './porVuelta.js';

/**
 * Los lapsos de un ejercicio: «Correr: 800 m a 4:34-5:00, luego 2 min a 6:39-7:00».
 *
 * POR QUÉ EXISTEN. Andrés, 8 oct 2026, sobre el cardio y el Hyrox: un intervalo de correr es UN ejercicio con
 * varios tramos seguidos, y el coach no tiene por qué «partirlo» en un ejercicio por tramo ni ponerlo todo en
 * segundos. Cada lapso dice lo mismo que una línea de ejercicio: cuánto (reps, seg, min, m, km, cal: da igual),
 * con qué carga y cuánto descansa después.
 *
 * LA REGLA DE FONDO: UN SOLO LUGAR PARA CADA DATO. El tiempo, el ritmo y el descanso viven en la LÍNEA del
 * ejercicio y en sus lapsos; el Set solo dice cuántas veces se repite. Por eso un Set en «Lapsos personalizados»
 * no lleva reloj de formato (`formato`) y sus ejercicios no llevan «Por vuelta» (`porVuelta`): serían el mismo dato
 * escrito en dos sitios.
 *
 * DÓNDE SE GUARDA. En cada ejercicio del Set: `lapsos: [{ reps, unidad, intensity, descanso }, …]`, uno o más.
 * Un Set está «en lapsos personalizados» cuando sus ejercicios los traen (igual que `formato` y `sets`, es del Set
 * entero y vive repetido en cada miembro). Sin migración: los campos de siempre NO desaparecen, llevan el espejo:
 *   · `reps`, `unidad` e `intensity` del ejercicio = los del PRIMER lapso;
 *   · `descanso` del ejercicio = el del ÚLTIMO lapso (lo que sigue al ejercicio);
 * para que lo que solo conoce esos campos —la IA, las listas viejas, el progreso— lea algo con sentido.
 *
 * Y NO SE COMBINA con `porVuelta` ni con un formato de reloj. Al entrar a lapsos, el ejercicio pasa a tener UN lapso
 * (el de su línea); al salir, se queda con su primero.
 */

export const MAX_LAPSOS = 30;
// Tope de tramos del reloj de un Set de lapsos: el mismo de los formatos con nombre.
const MAX_TRAMOS = 2000;
const MAX_RONDAS = 60;

const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

/** Un lapso limpio: todo texto, la unidad siempre una de la lista (o vacía si no se sabe). */
const limpio = (l) => ({
  reps: String(l?.reps ?? ''),
  unidad: typeof l?.unidad === 'string' ? l.unidad : '',
  intensity: String(l?.intensity ?? ''),
  descanso: String(l?.descanso ?? ''),
});

/** ¿Este ejercicio trae lapsos? */
export const traeLapsos = (ex) => !!ex && !ex.isNote && Array.isArray(ex.lapsos) && ex.lapsos.length > 0;

/** Los lapsos de un ejercicio, limpios; `null` si no trae. */
export function lapsosDe(ex) {
  if (!traeLapsos(ex)) return null;
  return ex.lapsos.filter(esObjeto).slice(0, MAX_LAPSOS).map(limpio);
}

/** ¿Algún ejercicio de la lista trae lapsos? (= el Set está en «Lapsos personalizados») */
export const hayLapsos = (miembros) => (miembros ?? []).some(traeLapsos);

/** El lapso que dice la línea de un ejercicio de siempre: lo que será su primer lapso. */
export function lapsoDeLinea(ex) {
  const leida = leeCantidad(ex);
  return limpio({
    reps: leida.libre ? String(ex?.reps ?? '') : leida.cantidad,
    unidad: leida.libre ? (ex?.unidad ?? '') : leida.unidad,
    intensity: ex?.intensity,
    descanso: ex?.descanso,
  });
}

/**
 * Lo que hay que guardar en el ejercicio para que sus lapsos sean `lapsos` (con el espejo de arriba).
 * Sin lapsos, quita todo rastro (`lapsos: undefined`).
 */
export function parcheDeLapsos(lapsos) {
  const filas = (lapsos ?? []).slice(0, MAX_LAPSOS).map(limpio);
  if (!filas.length) return { lapsos: undefined };
  const primero = filas[0];
  const ultimo = filas[filas.length - 1];
  return {
    reps: primero.reps,
    unidad: primero.unidad || undefined,
    intensity: primero.intensity,
    descanso: ultimo.descanso,
    lapsos: filas,
    // Los lapsos y las vueltas distintas son el mismo dato en dos sitios: manda el lapso.
    porVuelta: undefined,
  };
}

/**
 * ¿La línea sigue tal como nace un ejercicio nuevo en el editor (8-10 reps, o 10 si lo escribió el coach, y nada más)?
 * Entonces nadie ha puesto nada ahí y se puede estrenar con otra medida sin borrarle nada a nadie.
 */
export function esLineaSinEstrenar(ex) {
  const reps = String(ex?.reps ?? '').trim();
  const unidad = ex?.unidad;
  return (reps === '8-10' || reps === '10')
    && (!unidad || unidad === 'reps')
    && !String(ex?.intensity ?? '').trim()
    && !String(ex?.descanso ?? '').trim()
    && ex?.porLado !== true
    && !(Array.isArray(ex?.porVuelta) && ex.porVuelta.length);
}

/**
 * El ejercicio ya en lapsos: con UN lapso (el de su línea) si todavía no traía.
 *
 * `deCardio` (solo el editor): Andrés, 8 oct 2026: «cuando escoge lapsos personalizados, que automáticamente se ponga Km y en
 * carga, ritmo». Si la línea está SIN ESTRENAR, su primer lapso arranca en kilómetros y vacío (la casilla de carga, en Ritmo:
 * ver `LapsosDelEjercicio`). Una línea que ya tiene algo (10 reps con 40 kg) se queda como estaba: ahí no se adivina.
 */
export function aLapsos(ex, { deCardio = false } = {}) {
  if (!ex || ex.isNote) return ex;
  const base = traeLapsos(ex)
    ? lapsosDe(ex)
    : [deCardio && esLineaSinEstrenar(ex) ? limpio({ reps: '', unidad: 'km', intensity: '', descanso: '' }) : lapsoDeLinea(ex)];
  return quitaVacios({ ...ex, ...parcheDeLapsos(base) });
}

/** El ejercicio de vuelta a «Normal»: se queda con su primer lapso, y su descanso es el de ese lapso. */
export function aNormal(ex) {
  if (!traeLapsos(ex)) return ex;
  const primero = lapsosDe(ex)[0];
  const { lapsos: _quitados, ...resto } = ex;
  return quitaVacios({
    ...resto,
    reps: primero.reps,
    unidad: primero.unidad || undefined,
    intensity: primero.intensity,
    descanso: primero.descanso,
  });
}

// Una clave en `undefined` se va al guardar, pero ensucia las comparaciones: se quita de una vez.
function quitaVacios(ex) {
  const salida = { ...ex };
  Object.keys(salida).forEach((k) => { if (salida[k] === undefined) delete salida[k]; });
  return salida;
}

/**
 * Los ejercicios de un Set tal como deben guardarse: todos con lapsos si el Set está en lapsos personalizados, ninguno
 * si no. Lo que ya estaba bien no se toca (ni se reescribe, ni cambia de identidad).
 */
export function conLapsosSegun(miembros, activo, opciones = {}) {
  return miembros.map((m) => {
    if (m.isNote) return m;
    if (activo) {
      if (traeLapsos(m) && !m.porVuelta && !m.formato) return m;
      // Los lapsos mandan: el reloj de formato y las vueltas distintas se quitan (serían el mismo dato en dos sitios).
      const { formato: _reloj, ...sinReloj } = m;
      return aLapsos(sinReloj, opciones);
    }
    return traeLapsos(m) ? aNormal(m) : m;
  });
}

/** ¿Salir de lapsos le quitaría algo a alguien? (algún ejercicio con más de un lapso) */
export const perderiaLapsos = (miembros) => (miembros ?? []).some((m) => (lapsosDe(m)?.length ?? 0) > 1);

/** ¿Entrar a lapsos le quitaría algo a alguien? (algún ejercicio con reps o carga distintas en cada vuelta) */
export const perderiaVueltas = (miembros) => (miembros ?? []).some((m) => !!vueltasDe(m));

/** El lapso como si fuera un ejercicio, para leerlo con las mismas piezas (`textoMeta`, `leeCarga`…). */
export const comoEjercicio = (ex, lapso) => ({ ...ex, reps: lapso.reps, unidad: lapso.unidad || undefined, intensity: lapso.intensity, descanso: lapso.descanso });

/** Cuánto dice el lapso: «800 m», «2 min», «10 reps». `null` si no dice. */
export const cuantoDeLapso = (ex, lapso) => textoMeta(comoEjercicio(ex, lapso));

/* ------------------------------------------------------------------ */
/* El reloj de un Set en lapsos                                        */
/* ------------------------------------------------------------------ */

const numeroPrimero = (texto) => {
  const m = String(texto ?? '').replace(',', '.').match(/\d+(?:\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
};

/**
 * Cuántos segundos dura el trabajo de un lapso, o `null` si no es un tiempo claro (metros, reps, un rango):
 * ese lapso no tiene cuenta regresiva, corre hacia adelante y termina cuando el atleta toca «Listo».
 */
export function segundosDeLapso(ex, lapso) {
  const l = leeCantidad(comoEjercicio(ex, lapso));
  if (l.libre || (l.unidad !== 'seg' && l.unidad !== 'min')) return null;
  if (!/^\d+(?:[.,]\d+)?$/.test(l.cantidad)) return null;
  const n = parseFloat(l.cantidad.replace(',', '.'));
  const seg = Math.round(l.unidad === 'min' ? n * 60 : n);
  return seg > 0 ? seg : null;
}

/** Cuántos segundos descansa tras un lapso (de un rango, el primer número); `null` si no dice o no es un tiempo. */
export function descansoDeLapsoEnSegundos(lapso) {
  const d = leeDescanso({ descanso: lapso?.descanso });
  if (d.unidad !== 'seg' && d.unidad !== 'min') return null;
  const n = numeroPrimero(d.cantidad);
  if (n === null) return null;
  const seg = Math.round(d.unidad === 'min' ? n * 60 : n);
  return seg > 0 ? seg : null;
}

/** Cuántas veces se repite el Set, para el reloj: un número claro, o una vez. */
const rondasDelReloj = (rondas) => {
  const t = String(rondas ?? '').trim();
  const n = /^\d+$/.test(t) ? parseInt(t, 10) : 1;
  return Math.min(MAX_RONDAS, Math.max(1, n));
};

/**
 * Todos los tramos que corre el reloj de un Set en lapsos, en orden y sin repeticiones: cada ronda recorre a los
 * ejercicios en su orden y cada ejercicio, sus lapsos; tras un lapso con descanso, un tramo de descanso. Misma forma
 * que los de `expande` (`{ n, tipo, seg, etiqueta, vuelta, ejercicio }`) más lo que dice cada uno (`lapso`, `texto`).
 *
 *   · Un lapso en segundos o minutos corre solo (cuenta regresiva). Uno en metros, reps o calorías no tiene tiempo:
 *     corre hacia adelante y espera «Listo» (`seg: null`); ahí el reloj mide cuánto tardó.
 *   · El descanso tras el ÚLTIMO lapso de todo no se cuenta: ya no hay nada después.
 *
 * `miembros`: los ejercicios del Set. `rondas`: lo que dice `sets`.
 */
export function tramosDeLapsos(miembros, rondas) {
  const ejercicios = (miembros ?? []).filter((m) => m && !m.isNote);
  const vueltas = rondasDelReloj(rondas);
  const salida = [];
  for (let v = 1; v <= vueltas; v += 1) {
    ejercicios.forEach((ex, e) => {
      const laps = lapsosDe(ex) ?? [lapsoDeLinea(ex)];
      laps.forEach((l, k) => {
        if (salida.length >= MAX_TRAMOS) return;
        salida.push({
          n: salida.length, tipo: 'trabajo', seg: segundosDeLapso(ex, l), etiqueta: ex.name ?? '', vuelta: v,
          ejercicio: e, lapso: k, de: laps.length, texto: cuantoDeLapso(ex, l) ?? '', carga: l.intensity,
        });
        const d = descansoDeLapsoEnSegundos(l);
        if (d !== null && salida.length < MAX_TRAMOS) {
          salida.push({ n: salida.length, tipo: 'descanso', seg: d, etiqueta: '', vuelta: v, ejercicio: e, lapso: k, de: laps.length, texto: '' });
        }
      });
    });
  }
  // Nada de descansar al final: sobra el último tramo si es un descanso.
  while (salida.length && salida[salida.length - 1].tipo === 'descanso') salida.pop();
  return salida;
}

/** ¿Se puede correr un reloj de este Set? (al menos un tramo de trabajo) */
export const hayRelojDeLapsos = (miembros, rondas) => tramosDeLapsos(miembros, rondas).length > 0;
