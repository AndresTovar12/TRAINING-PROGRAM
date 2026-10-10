/* Cómo se DICEN los números de un entreno en pantalla: «1 h 05 min», «5:31 /km», «10.2 km», «jue 9 oct · 7:04».

   Un coach lee muchos entrenos seguidos: todo va corto, con la unidad pegada y en español. Las horas son siempre las LOCALES del entreno (`inicio` + `desfase_min`),
   no las del teléfono de quien mira: un entreno de las 7 de la mañana en México se ve a las 7 aunque el coach esté en España.

   Este archivo no importa nada de la app (ni `@/`). */

const dos = (n) => String(n).padStart(2, '0');

/** «1 h 05 min», «32 min», «45 s». Para cuánto duró algo. */
export function duracionTexto(seg) {
  if (!(seg >= 0)) return '—';
  const s = Math.round(seg);
  if (s < 60) return `${s} s`;
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return `${m} min`;
  return m === 0 ? `${h} h` : `${h} h ${dos(m)} min`;
}

/** «1:05:12» o «32:10»: un reloj (para tiempos de vueltas y para el eje de una gráfica). */
export function relojTexto(seg) {
  if (!(seg >= 0)) return '—';
  const s = Math.round(seg);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${dos(m)}:${dos(s % 60)}` : `${m}:${dos(s % 60)}`;
}

/** Un ritmo en segundos por kilómetro: «5:31». Sin unidad (la pone quien lo dibuja: «/km»). Fuera de lo creíble (más lento que 30:00 o más rápido que 1:30) es «—». */
export function ritmoTexto(segPorKm) {
  if (!(segPorKm >= 90 && segPorKm <= 1800)) return '—';
  const s = Math.round(segPorKm);
  return `${Math.floor(s / 60)}:${dos(s % 60)}`;
}

/** Metros a kilómetros con un decimal: «10.2 km»; menos de 1 km, en metros: «650 m». */
export function distanciaTexto(m) {
  if (!(m >= 0)) return '—';
  if (m < 1000) return `${Math.round(m)} m`;
  const km = m / 1000;
  return `${km >= 100 ? Math.round(km) : (Math.round(km * 10) / 10).toFixed(1)} km`;
}

/** Velocidad en m/s a km/h: «28.4». */
export const velocidadTexto = (ms) => (ms > 0 ? (Math.round(ms * 36) / 10).toFixed(1) : '—');

/** Un número con miles: «2,450». */
export const miles = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—');

const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
const DIAS_LARGOS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

/** La fecha y hora LOCAL de un entreno como partes: `{ dia, mes, año, diaSemana, h, m }`. */
export function partesLocales(inicio, desfaseMin = 0) {
  const ms = typeof inicio === 'number' ? inicio : Date.parse(inicio);
  if (!Number.isFinite(ms)) return null;
  const d = new Date(ms + (Number(desfaseMin) || 0) * 60000);
  return { dia: d.getUTCDate(), mes: d.getUTCMonth(), año: d.getUTCFullYear(), diaSemana: d.getUTCDay(), h: d.getUTCHours(), m: d.getUTCMinutes() };
}

/** «jue 9 oct». */
export function fechaCorta(inicio, desfaseMin = 0) {
  const p = partesLocales(inicio, desfaseMin);
  return p ? `${DIAS[p.diaSemana]} ${p.dia} ${MESES[p.mes]}` : '—';
}

/** «7:04» (24 horas, como se lee en un reloj de entrenamiento). */
export function horaTexto(inicio, desfaseMin = 0) {
  const p = partesLocales(inicio, desfaseMin);
  return p ? `${p.h}:${dos(p.m)}` : '—';
}

/** «jueves 9 de octubre». */
export function fechaLarga(inicio, desfaseMin = 0) {
  const p = partesLocales(inicio, desfaseMin);
  if (!p) return '—';
  const meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  return `${DIAS_LARGOS[p.diaSemana]} ${p.dia} de ${meses[p.mes]}`;
}

/** «5–11 oct» o «28 sep – 4 oct»: el rango de una semana que empieza en `lunes` (`AAAA-MM-DD`). */
export function rangoDeSemana(lunes) {
  const a = new Date(`${lunes}T00:00:00Z`);
  const b = new Date(a.getTime() + 6 * 86400000);
  const [da, ma, db, mb] = [a.getUTCDate(), a.getUTCMonth(), b.getUTCDate(), b.getUTCMonth()];
  return ma === mb ? `${da}–${db} ${MESES[ma]}` : `${da} ${MESES[ma]} – ${db} ${MESES[mb]}`;
}

/** «9 oct» de un día `AAAA-MM-DD`. */
export function diaCorto(dia) {
  const d = new Date(`${dia}T00:00:00Z`);
  return `${d.getUTCDate()} ${MESES[d.getUTCMonth()]}`;
}

/** Una variación en por ciento: «↑ 12 %» / «↓ 8 %» / «= igual». `null` si no hay con qué comparar. */
export function variacionTexto(pct) {
  if (pct === null || pct === undefined) return null;
  if (pct === 0) return '= igual';
  return `${pct > 0 ? '↑' : '↓'} ${Math.abs(pct)} %`;
}
