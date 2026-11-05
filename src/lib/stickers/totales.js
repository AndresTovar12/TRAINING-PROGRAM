/* LOS TOTALES DE LA PESTAÑA «TOTALES» (stickers, 5 nov 2026; ver docs/stickers.md y la maqueta aprobada). La semana (lunes a domingo) y el mes de HOY, con todos
   los entrenos de la persona: del plan y libres, de cualquier tipo. No cambian con el entreno que se está compartiendo.

   Sale del mismo historial del año que ya usan los stickers «Semana» y «Mes» (`cargaHistorial` en `carga.js`, que llega en `entreno.historial`): no hace otra
   consulta. Cada entreno cuenta en SU día local (`diaLocal`, el de la ficha). El entreno que se comparte cuenta siempre, venga o no en la lista.

   Este archivo no importa nada de la app: lo cargan las pruebas de Node (`scripts/prueba-stickers.mjs`). */
import { diaLocal, MESES_LARGOS_ES } from './ficha.js';
import { duracionTexto } from '../metricas/formato.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** Los días de la semana, cortos (barras) y a máquina. */
export const DIAS_LETRA = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
export const DIAS_MAQUINA = ['LUN', 'MAR', 'MIÉ', 'JUE', 'VIE', 'SÁB', 'DOM']; // estilo-ok: así se escriben en el sticker «Semana a máquina» (maqueta)

/** «27.6» (menos de 50 km, con un decimal) o «96» (de 50 para arriba). */
export const kmTexto = (m) => { const km = (num(m) ?? 0) / 1000; return km >= 50 ? String(Math.round(km)) : km.toFixed(1); };
/** «4 h 12 min», «45 min». */
export const tiempoTexto = (min) => duracionTexto(Math.max(0, Math.round(min)) * 60);

/**
 * `entreno`: el mismo que recibe `ficha()` (con `historial`). `ahora`: el momento de hoy (para saber qué semana y qué mes). Devuelve:
 *   · semana: `{ entrenos, min, distM, km: [7] (en km), minDia: [7], n: [7], hoy }` (`hoy`: 0 = lunes; `km` y `minDia` por día).
 *   · mes: `{ nombre: 'Noviembre', entrenos, min, distM, dias (cuántos tiene), hechos: [días del mes con algún entreno] }`.
 * El desfase de cada entreno es el suyo; sin él, el de este entreno (o el del teléfono). «Hoy» es el del teléfono.
 */
export function totalesDe(entreno, ahora = Date.now()) {
  const e = entreno ?? {};
  const lista = (Array.isArray(e.historial) ? e.historial : []).filter((x) => num(x?.inicioMs) !== null);
  const yo = num(e.inicioMs) !== null ? { id: e.id ?? null, inicioMs: e.inicioMs, desfaseMin: e.desfaseMin, duracionS: num(e.duracionS) ?? 0, distanciaM: num(e.distanciaM) ?? 0 } : null;
  const todos = !yo ? lista : (yo.id !== null && lista.some((x) => x.id === yo.id) ? lista : [...lista, yo]);
  // Hoy, en el teléfono de quien mira.
  const hoy = diaLocal(ahora, null);
  const lunes = hoy.n - hoy.sem;
  const conDia = todos.map((x) => ({ x, d: diaLocal(x.inicioMs, x.desfaseMin ?? e.desfaseMin) })).filter((x) => x.d);

  const km = Array(7).fill(0);
  const minDia = Array(7).fill(0);
  const n = Array(7).fill(0);
  conDia.filter(({ d }) => d.n >= lunes && d.n < lunes + 7).forEach(({ x, d }) => {
    const i = d.n - lunes;
    n[i] += 1;
    km[i] += (num(x.distanciaM) ?? 0) / 1000;
    minDia[i] += (num(x.duracionS) ?? 0) / 60;
  });
  const delMes = conDia.filter(({ d }) => d.y === hoy.y && d.m === hoy.m);
  const suma = (l, k) => l.reduce((t, { x }) => t + (num(x[k]) ?? 0), 0);
  const nombre = MESES_LARGOS_ES[hoy.m];
  return {
    semana: {
      entrenos: n.reduce((a, b) => a + b, 0),
      min: Math.round(minDia.reduce((a, b) => a + b, 0)),
      distM: Math.round(km.reduce((a, b) => a + b, 0) * 1000),
      km, minDia: minDia.map(Math.round), n, hoy: hoy.sem,
    },
    mes: {
      nombre: nombre[0].toUpperCase() + nombre.slice(1),
      entrenos: delMes.length,
      min: Math.round(suma(delMes, 'duracionS') / 60),
      distM: Math.round(suma(delMes, 'distanciaM')),
      dias: new Date(Date.UTC(hoy.y, hoy.m + 1, 0)).getUTCDate(),
      hechos: [...new Set(delMes.map(({ d }) => d.d))].sort((a, b) => a - b),
    },
  };
}
