/* Las sesiones de un día, una por una.

   Andrés, 29 sep 2026 (DOBLES SESIONES ERRORES.pdf): en varios sitios un día de
   doble sesión se titulaba «Velocidad + Lower Strength», y eso puede leerse como
   UNA sesión que junta velocidad y fuerza. Son dos: una de mañana y otra de
   tarde. Cada sesión es una entrada del plan con su nombre y, si el coach quiere,
   su turno (`turno: 'AM' | 'PM'`, desde «Opciones»); aquí se sacan una por una
   para que cada pantalla le ponga su etiqueta a cada una en vez de unirlas con un «+».

   Desde el 6 oct 2026 todos los planes se guardan así: ya no existe el día con
   las sesiones adentro (`blocks`). */
import { esDescanso, sinDuracion, sesionQueRepite } from '@/lib/training-utils';

// Viven en `training-utils` porque el conector de IA usa las mismas reglas; aquí se reexportan para quien ya las pide de `sesiones`.
export { sinDuracion, sesionQueRepite };

/** La duración que trae escrita el nombre: «· ~65 min» → '65 min'. Sin ella, null. */
export const minutosDelNombre = (nombre = '') => {
  const m = /·\s*~\s*(\d[^·]*)$/.exec(nombre);
  return m ? m[1].trim() : null;
};

/**
 * Las sesiones que hay que nombrar en el título de un día, o de varios (el mismo
 * día de la semana con dos entradas). Una sola: se escribe su nombre. Dos o
 * más: cada una lleva su propia etiqueta. El nombre sale vacío si la entrada no
 * trae ninguno; cada pantalla pone entonces su respaldo.
 */
export function sesionesDelTitulo(dias) {
  return (Array.isArray(dias) ? dias : [dias]).filter(Boolean).map((day) => ({
    // El turno de una sesión lo pone el coach desde «Opciones» (AM o PM); sin él, ninguno.
    turno: day.turno === 'AM' || day.turno === 'PM' ? day.turno : null,
    nombre: sinDuracion(day.name || ''),
  }));
}

/* ---- Dos entradas el mismo día de la semana son UN día con dos sesiones ----

   La sesión de la tarde se agrega como una entrada más y queda al final de la semana (ver
   `enOrdenDeSemana`). Para quien entrena, el lunes sigue siendo UN día, con su sesión de
   mañana y su sesión de tarde: se juntan al enseñarlas, nunca en los datos, porque lo que
   anota el atleta se guarda por la posición de cada entrada. */

/**
 * Las entradas de la semana que caen el mismo día de la semana que la entrada `idx`, en el orden
 * en que están guardadas: [{ day, idx }]. Un descanso va solo. Con una sola, el día es una
 * sesión de siempre.
 */
export function hermanasDelDia(week, idx) {
  const dia = week?.days?.[idx];
  if (!dia) return [];
  if (esDescanso(dia)) return [{ day: dia, idx }];
  return week.days
    .map((day, i) => ({ day, idx: i }))
    .filter((e) => e.day.day === dia.day && !esDescanso(e.day));
}

/**
 * Los renglones de una semana en orden de calendario (`enOrdenDeSemana`) con las entradas del
 * mismo día de la semana juntas: [{ day, idx, hermanas }]. `day` e `idx` son los de la primera;
 * `hermanas` trae todas, ella incluida.
 */
export function juntaPorDia(filas) {
  const juntas = [];
  (filas || []).forEach((fila) => {
    const previa = juntas[juntas.length - 1];
    if (previa && !esDescanso(fila.day) && !esDescanso(previa.day) && previa.day.day === fila.day.day) previa.hermanas.push(fila);
    else juntas.push({ ...fila, hermanas: [fila] });
  });
  return juntas;
}

/**
 * Las mismas sesiones en una línea de texto, para las frases donde no caben
 * etiquetas. Con turnos: «AM Velocidad · PM Lower Strength». Sin ellos se dice
 * cuántas son, para que no se lea como una sola: «2 sesiones: Fuerza · Movilidad».
 */
export function textoDeSesiones(sesiones) {
  if (sesiones.length <= 1) return sesiones[0]?.nombre || '';
  if (sesiones.every((s) => s.turno)) {
    return sesiones.map((s) => `${s.turno} ${s.nombre}`).join(' · ');
  }
  return `${sesiones.length} sesiones: ${sesiones.map((s) => s.nombre).join(' · ')}`;
}
