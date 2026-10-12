import { diaLocal, diasEntre, hoyLocal, lunesDe, sumaDias } from './metricas/forma.js';
import { duracionTexto } from './metricas/formato.js';
import { esDeporteLibre } from './entrenoLibre.js';

/* LO QUE ENSEÑA EL CARTEL «ENTRENAR» de Home (12 oct 2026): cómo va la semana (qué días entrenó, cuántos entrenos, cuánto tiempo), cuál fue su último entreno y hace cuánto, y con qué deporte
   arranca el ícono. Todo sale de sus entrenos (filas de `actividades`), que ya están a la mano; nada se pide aparte. Lo puro: se prueba con `scripts/prueba-entreno-libre.mjs`. */

/**
 * La semana (lunes a domingo) de `hoy` (`AAAA-MM-DD`; por defecto, el de quien mira): `dias` = siete con su fecha, si hubo algún entreno y si es hoy; más cuántos entrenos, cuánto tiempo
 * y cuánta distancia suman. Un entreno cuenta en SU día local (el que traía su desfase), no en el de UTC.
 */
export function resumenDeLaSemana(filas, hoy = hoyLocal()) {
  const lunes = lunesDe(hoy);
  const dias = Array.from({ length: 7 }, (_, i) => { const dia = sumaDias(lunes, i); return { dia, entreno: false, esHoy: dia === hoy }; });
  let entrenos = 0;
  let duracion_s = 0;
  let distancia_m = 0;
  for (const f of filas ?? []) {
    const i = dias.findIndex((d) => d.dia === diaLocal(f.inicio, f.desfase_min));
    if (i < 0) continue;
    dias[i].entreno = true;
    entrenos += 1;
    duracion_s += Number(f.duracion_s) || 0;
    distancia_m += Number(f.distancia_m) || 0;
  }
  return { dias, entrenos, duracion_s, distancia_m };
}

/** «Sin entrenos esta semana» o «3 entrenos · 1 h 42 min». */
export function textoDeLaSemana(r) {
  if (!r?.entrenos) return 'Sin entrenos esta semana';
  const t = duracionTexto(r.duracion_s);
  return `${r.entrenos} ${r.entrenos === 1 ? 'entreno' : 'entrenos'}${t && t !== '—' ? ` · ${t}` : ''}`;
}

/** El deporte con que arranca el cartel: el de su último entreno si es de los que se hacen aquí; si no, correr. */
export const deporteDelCartel = (filas) => (esDeporteLibre(filas?.[0]?.deporte) ? filas[0].deporte : 'correr');

/** «hoy», «ayer», «hace 3 días», «hace 2 semanas»: de cuándo fue un entreno. */
export function haceCuanto(fila, hoy = hoyLocal()) {
  const dia = diaLocal(fila?.inicio, fila?.desfase_min);
  if (!dia) return '';
  const n = diasEntre(dia, hoy);
  if (n <= 0) return 'hoy';
  if (n === 1) return 'ayer';
  if (n < 7) return `hace ${n} días`;
  const s = Math.floor(n / 7);
  return s < 5 ? `hace ${s} ${s === 1 ? 'semana' : 'semanas'}` : 'hace más de un mes';
}
