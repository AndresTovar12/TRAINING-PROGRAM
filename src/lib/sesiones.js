/* Las sesiones de un día, una por una.

   Andrés, 29 sep 2026 (DOBLES SESIONES ERRORES.pdf): en varios sitios un día de
   doble sesión se titulaba «Velocidad + Lower Strength», y eso puede leerse como
   UNA sesión que junta velocidad y fuerza. Son dos: una de mañana y otra de
   tarde. Aquí se sacan por separado, cada una con su turno, para que cada
   pantalla le ponga su etiqueta a cada una en vez de unirlas con un «+».

   Nada de esto toca el plan. El nombre sigue guardado tal cual lo escribió el
   coach («Sesión 2 (PM): Lower + intro a potencia · ~65 min»): se lee, se parte
   y se enseña por partes.

   Tampoco toca lo que se guarda como hecho: las sesiones terminadas viven en el
   mismo registro del día (`wr:sessions`), con una llave más (`bloques`) que los
   registros de antes no tienen y que se entiende sin ella. */
import { nombreDeSesion } from '@/lib/training-utils';

/** «Sesión 2 (PM): Lower · ~65 min» → 'PM'. Sin turno en la etiqueta, null. */
export const turnoDeTag = (tag = '') => (tag.match(/\(([AP]M)\)/) || [])[1] || null;

/** La duración que trae escrita el nombre: «· ~65 min» → '65 min'. Sin ella, null. */
export const minutosDeTag = (tag = '') => {
  const m = /·\s*~\s*(\d[^·]*)$/.exec(tag);
  return m ? m[1].trim() : null;
};

/** El nombre sin «· ~65 min» al final, por si el coach lo escribió en el del día. */
export const sinDuracion = (texto = '') => texto.replace(/\s*·\s*~.*$/, '').trim();

/** ¿Trae más de una sesión adentro (mañana y tarde)? */
export const variasSesiones = (day) => (day?.blocks?.length ?? 0) > 1;

/**
 * Las sesiones que hay que nombrar en el título de un día, o de varios (el mismo
 * día de la semana con dos entradas). Una sola: se escribe su nombre. Dos o
 * más: cada una lleva su propia etiqueta.
 *
 * Un día al que el coach le puso NOMBRE se queda con ese nombre: lo escribió él
 * y no se le cambia. El nombre sale vacío si el día no trae ninguno; cada
 * pantalla pone entonces su respaldo.
 */
export function sesionesDelTitulo(dias) {
  const sesiones = [];
  (Array.isArray(dias) ? dias : [dias]).filter(Boolean).forEach((day) => {
    const propio = sinDuracion(day.name || '');
    const bloques = day.blocks || [];
    if (!propio && bloques.length > 1) {
      bloques.forEach((b, bi) => sesiones.push({
        turno: turnoDeTag(b.tag),
        nombre: nombreDeSesion(b.tag) || `Sesión ${bi + 1}`,
      }));
    } else {
      sesiones.push({
        // El turno de una sesión suelta lo pone el coach desde «Opciones» (AM o PM); sin él, ninguno.
        turno: day.turno === 'AM' || day.turno === 'PM' ? day.turno : null,
        nombre: propio || (bloques.length === 1 ? nombreDeSesion(bloques[0].tag) : ''),
      });
    }
  });
  return sesiones;
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

/* ---- Terminar cada sesión por su lado ----

   El registro de un día (`sessionsData[id]`) siempre tuvo UN `completed` para
   todo el día. Para un doble, ahora también guarda `bloques`:
       { 0: { completed, completedAt }, 1: { completed, completedAt } }
   y `completed` sigue diciendo «el día entero está hecho» —lo son todas—, así que
   todo lo que ya lo lee (la tira de días, el avance de la semana, el coach, la
   IA) sigue funcionando igual. */

/**
 * Qué sesiones del día están hechas: un booleano por sesión.
 *
 * Un registro sin `bloques` es de antes, o lo marcó entero la IA: el día manda.
 * Y si `bloques` y `completed` se contradicen, también manda el día: la app
 * siempre deja `completed` igual a «todas hechas», así que una diferencia solo
 * la puede haber escrito otro (la IA marcó o desmarcó el día completo).
 */
export function bloquesHechos(registro, total) {
  const dia = !!registro?.completed;
  const guardado = registro?.bloques;
  if (!guardado) return Array.from({ length: total }, () => dia);
  const porBloque = Array.from({ length: total }, (_, i) => !!guardado[i]?.completed);
  return porBloque.every(Boolean) === dia ? porBloque : Array.from({ length: total }, () => dia);
}

/**
 * El registro del día después de marcar o desmarcar UNA sesión. Devuelve el
 * registro entero (con sus ejercicios y notas intactos), listo para guardar.
 */
export function alternarBloque(registro, indice, total, ahora = new Date().toISOString()) {
  const antes = bloquesHechos(registro, total);
  const despues = antes.map((hecha, i) => (i === indice ? !hecha : hecha));
  const bloques = {};
  despues.forEach((hecha, i) => {
    // La hora en que se hizo se conserva mientras siga hecha; al deshacer se borra.
    const previa = registro?.bloques?.[i]?.completedAt ?? registro?.completedAt ?? null;
    bloques[i] = { completed: hecha, completedAt: hecha ? (antes[i] ? (previa ?? ahora) : ahora) : null };
  });
  const todas = despues.every(Boolean);
  return {
    ...registro,
    bloques,
    completed: todas,
    completedAt: todas ? (registro?.completed ? (registro.completedAt ?? ahora) : ahora) : null,
  };
}
