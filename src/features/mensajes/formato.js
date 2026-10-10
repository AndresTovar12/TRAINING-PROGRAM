/* Cómo se DICEN las cosas en los mensajes: las horas (siempre en la hora de quien mira), los días que separan una conversación y la línea de vista previa de la lista.
   Este archivo no importa nada de la app (ni `@/`). */

const dos = (n) => String(n).padStart(2, '0');
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const inicioDelDia = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** «14:32» (en la hora de quien mira). */
export function horaTexto(iso) {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : `${dos(d.getHours())}:${dos(d.getMinutes())}`;
}

/** «Hoy», «Ayer», «lun» (esta semana) o «6 oct». Para separar los días de una conversación. */
export function diaTexto(iso, ahora = new Date()) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dias = Math.round((inicioDelDia(ahora) - inicioDelDia(d)) / 86400000);
  if (dias <= 0) return 'Hoy';
  if (dias === 1) return 'Ayer';
  if (dias < 7) return DIAS[d.getDay()];
  return `${d.getDate()} ${MESES[d.getMonth()]}${d.getFullYear() !== ahora.getFullYear() ? ` ${d.getFullYear()}` : ''}`;
}

/** Lo que va a la derecha de una conversación en la lista: la hora si fue hoy, si no el día. */
export function cuandoTexto(iso, ahora = new Date()) {
  if (!iso) return '';
  const dia = diaTexto(iso, ahora);
  return dia === 'Hoy' ? horaTexto(iso) : dia;
}

const NOMBRE_DEL_TIPO = { foto: 'Foto', video: 'Video', voz: 'Nota de voz', tecnica: 'Técnica', correccion: 'Corrección' };

/** La línea de vista previa de la lista: el texto, o qué clase de mensaje fue. `yo`: lo último lo escribió quien mira. */
export function vistaPrevia(fila, yo) {
  if (!fila.ultimo_en) return '';
  const base = fila.ultimo_borrado ? 'Mensaje eliminado' : (fila.ultimo_tipo === 'texto' || fila.ultimo_texto ? (fila.ultimo_texto ?? '') : (NOMBRE_DEL_TIPO[fila.ultimo_tipo] ?? ''));
  return yo ? `Tú: ${base}` : base;
}

/** La llave de una conversación: el par (atleta, profesional). */
export const llaveDe = (f) => `${f.atleta_id}:${f.profesional_id}`;
