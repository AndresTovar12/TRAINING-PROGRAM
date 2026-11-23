/**
 * QUÉ EDITOR ARMA UNA SESIÓN (19 nov 2026, decisión de Andrés: «cambiar de Disciplina es empezar la sesión de cero»).
 *
 * La Disciplina manda. Cada Disciplina se arma con un editor, y cada editor guarda en un lugar del día:
 *   'sets'    → `day.exercises`     (Gym, Libre, Movilidad, Clase, Deporte… por ahora)
 *   'carrera' → `day.tramos`        (Running, `EditorDeCorrer`)
 *   'rodada'  → `day.tramos`        (Cycling, el mismo `EditorDeCorrer` con las palabras y medidas de la bici; 20 nov 2026)
 *   'nado'    → `day.tramos`        (Swimming, el mismo `EditorDeCorrer` con las de nado; 20 nov 2026)
 *   'tri'     → `day.tramos`        (Triatlón, el mismo `EditorDeCorrer`: cada parte es Nado, Bici o Carrera, con transiciones; 20 nov 2026)
 *   'cadena'  → `day.hibrido.sets`  (Híbrido, `EditorHibrido`)
 *   'deporte' → `day.deporte.items` (Deporte, `EditorDeDeporte`: una lista de ejercicios con video, cuántas veces y si es por lado; 20 nov 2026)
 * Carrera, rodada y nado guardan en el mismo lugar, pero son editores distintos: pasar de Running a Cycling también empieza de cero (una
 * «Carrera continua» no es una rodada). Cuando un formato nuevo tenga su editor, solo se agrega aquí su renglón: la regla del cambio no se toca.
 *
 * Al cambiar a una Disciplina de OTRO editor: si la sesión está vacía, cambia directo; si ya tiene algo, se pregunta antes y lo armado se borra
 * (el editor tiene deshacer). Entre Disciplinas del MISMO editor (Gym ↔ Libre) no se borra nada: no hay nada que no quepa.
 * Nunca queda contenido guardado y escondido.
 */
const EDITOR_DE_FAMILIA = { correr: 'carrera', bici: 'rodada', nadar: 'nado', triatlon: 'tri', hyrox: 'cadena', deporte: 'deporte' };
// Dónde guarda cada editor (ver `contenidoDeLaSesion`).
const LUGAR = { sets: 'sets', carrera: 'lista', rodada: 'lista', nado: 'lista', tri: 'lista', cadena: 'cadena', deporte: 'deporte' };
// Lo guardado en la lista sin una Disciplina que la use (datos de antes) se ve en la de carrera, que es donde nació.
const EDITOR_DEL_LUGAR = { sets: 'sets', lista: 'carrera', cadena: 'cadena', deporte: 'deporte' };
/** El deporte con que se pinta `EditorDeCorrer`. */
export const DEPORTE_DEL_EDITOR = { carrera: 'correr', rodada: 'bici', nado: 'nado', tri: 'tri' };
export const esDeLista = (editor) => LUGAR[editor] === 'lista';

export function editorDeFamilia(familia) {
  return EDITOR_DE_FAMILIA[familia] ?? 'sets';
}

/** Cuánto tiene la sesión en cada lugar. */
export function contenidoDeLaSesion(day = {}) {
  const ex = Array.isArray(day.exercises) ? day.exercises : [];
  return {
    sets: ex.length,
    lista: Array.isArray(day.tramos) ? day.tramos.length : 0,
    cadena: (day.hibrido?.sets ?? []).reduce((n, s) => n + (s.items?.length || 1), 0),
    deporte: (day.deporte?.items ?? []).length,
  };
}

/**
 * El editor que se ve. Es el de la Disciplina. Única excepción: datos viejos (de antes de esta regla) que tienen contenido solo en otro
 * editor; esos se siguen enseñando donde están para no esconder nada.
 */
export function editorQueSeVe(day, familia) {
  const propio = editorDeFamilia(familia);
  const c = contenidoDeLaSesion(day);
  if (c[LUGAR[propio]] > 0) return propio;
  const otro = ['sets', 'lista', 'cadena', 'deporte'].find((l) => l !== LUGAR[propio] && c[l] > 0);
  return otro ? EDITOR_DEL_LUGAR[otro] : propio;
}

/**
 * Qué pasa al cambiar de la Disciplina `de` a la `a`.
 * → { borra: false } si no hay que borrar nada, o { borra: true, cuanto: 'Los 7 ejercicios' } si hay que preguntar.
 */
export function cambioDeDisciplina(day, de, a) {
  const actual = editorQueSeVe(day, de);
  const nuevo = editorDeFamilia(a);
  if (actual === nuevo) return { borra: false };
  const lugar = LUGAR[actual];
  if (!contenidoDeLaSesion(day)[lugar]) return { borra: false };
  // Cuánto se borra, contado como lo ve el coach: tramos en la lista, ejercicios en los demás (las notas sueltas no son ejercicios).
  const n = lugar === 'sets' ? day.exercises.filter((e) => !e?.isNote).length : contenidoDeLaSesion(day)[lugar];
  const cosa = lugar === 'lista' ? ['El tramo', 'tramos'] : ['El ejercicio', 'ejercicios'];
  const cuanto = n === 0 ? 'Lo que armaste' : n === 1 ? cosa[0] : `Los ${n} ${cosa[1]}`;
  return { borra: true, cuanto };
}

/** Lo que se guarda al cambiar: la Disciplina nueva y, si toca empezar de cero, los tres lugares vacíos. La clase y las notas no se tocan. */
export function parcheDelCambio(day, de, a) {
  const disciplina = a === 'libre' ? undefined : a;
  if (!cambioDeDisciplina(day, de, a).borra) return { disciplina };
  return { disciplina, exercises: [], tramos: undefined, hibrido: undefined, deporte: undefined, calentamiento: undefined };
}
