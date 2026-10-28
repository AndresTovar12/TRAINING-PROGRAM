/* LO PROGRAMADO DE UNA SESIÓN DEL PLAN, para los stickers (28 oct 2026).

   · `seriesProgramadas(day)`: cuántas series manda el plan (las mismas que cuenta el entreno guiado, sin las opcionales): «Lo que tocó hoy» dice «12/16 sets».
     `null` si no se puede saber (un AMRAP o un EMOM, donde las series las decide quien entrena).
   · `recordDelPlan(...)`: decisión 1.11, «con plan manda lo programado». Se compara lo hecho contra lo programado, serie por serie (la clave de cada serie del
     entreno guiado es la misma que la de su paso: «ejercicio.vuelta.lapso»). Es récord si en un ejercicio IGUALÓ la carga programada en todas sus series
     y esa carga es su mejor marca (más que lo que había levantado antes en ese ejercicio). Si se pasó de lo programado (más kilos o más reps), no se
     celebra. Si la sesión no trae kilos programados (va en %, RPE o texto), no hay récord.

   Este archivo no importa nada de la app (ni `@/`): lo cargan tal cual las pruebas de Node (`scripts/prueba-stickers.mjs`). */
import { pasosDeLaSesion } from '../entreno.js';
import { filasPorSerie } from '../metricas/porSerie.js';

const CASI = 0.01;
const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
const kilosTexto = (kg) => (Number.isInteger(kg) ? String(kg) : kg.toFixed(1));

/** Los pasos de la sesión, sin romper la pantalla si el día viene raro. */
function pasosDe(day) {
  try { return pasosDeLaSesion(day).pasos; } catch { return []; }
}

/** Cuántas series programa la sesión, o `null` si no se puede saber. */
export function seriesProgramadas(day) {
  let n = 0;
  for (const p of pasosDe(day)) {
    if (p.tipo === 'ejercicio' && !p.opcional) n += 1;
    else if (p.tipo === 'reloj') {
      if (!Array.isArray(p.pasosInternos)) return null;
      n += p.pasosInternos.filter((q) => q.tipo === 'ejercicio' && !q.opcional).length;
    }
  }
  return n > 0 ? n : null;
}

/** Las reps que pide un paso: `{ min, max }` o `null` (por tiempo, por distancia, libre). */
const repsDe = (paso) => (paso.termina?.por === 'reps' ? { min: paso.termina.min, max: paso.termina.max } : null);

/**
 * El récord de un workout del plan, o `null`. `day`: el día con los ejercicios que se hicieron. `registro`: lo guardado de la sesión.
 * `mejorAntes(nombreDelEjercicio)`: los kilos más altos que había levantado ANTES de esta sesión en ese ejercicio (`null` si nunca).
 * Devuelve `{ tipo: 'programado', texto: 'Justo lo programado: 4 × 5 con 100 kg', ejercicio, kg, series, reps, difNum }`.
 */
export function recordDelPlan({ day, registro, mejorAntes = () => null }) {
  const pasos = pasosDe(day).filter((p) => p.tipo === 'ejercicio' && !p.opcional);
  if (!pasos.some((p) => p.meta?.tipo === 'kg')) return null;
  const hechas = new Map(filasPorSerie({ registro }).filas.filter((f) => f.tipo === 'serie').map((f) => [f.clave, f]));
  const porEjercicio = new Map();
  pasos.forEach((p) => { if (!porEjercicio.has(p.idx)) porEjercicio.set(p.idx, []); porEjercicio.get(p.idx).push(p); });

  let mejor = null;
  porEjercicio.forEach((suyos) => {
    // Solo un ejercicio con kilos fijos en TODAS sus series (no «100-105 kg», no %).
    if (!suyos.every((p) => p.meta?.tipo === 'kg' && num(p.meta.min) !== null && num(p.meta.min) === num(p.meta.max))) return;
    const nombre = suyos[0].nombre;
    // Lo que hizo en las series de este ejercicio (también las opcionales que haya hecho: si se pasó en una, se pasó).
    const delEjercicio = [...hechas.values()].filter((f) => f.clave.startsWith(`${suyos[0].idx}.`));
    const programaDe = new Map(suyos.map((p) => [p.clave, p]));
    const kgDelPlan = Math.max(...suyos.map((p) => num(p.meta.min)));
    const sePaso = delEjercicio.some((f) => {
      const p = programaDe.get(f.clave);
      const kgPlan = p ? num(p.meta.min) : kgDelPlan;
      const reps = num(f.reps);
      const r = p ? repsDe(p) : null;
      return (num(f.kg) !== null && num(f.kg) > kgPlan + CASI) || (r && reps !== null && reps > r.max);
    });
    if (sePaso) return;
    const igualo = suyos.every((p) => {
      const f = hechas.get(p.clave);
      if (!f || num(f.kg) === null || Math.abs(num(f.kg) - num(p.meta.min)) > CASI) return false;
      const r = repsDe(p);
      const reps = num(f.reps);
      return !r || (reps !== null && reps >= r.min && reps <= r.max);
    });
    if (!igualo) return;
    const antes = num(mejorAntes(nombre));
    if (antes === null || kgDelPlan <= antes + CASI) return;
    const top = suyos.filter((p) => Math.abs(num(p.meta.min) - kgDelPlan) <= CASI);
    // «4 × 5»: si todas esas series piden las mismas reps fijas; si no, solo cuántas series.
    const r0 = repsDe(top[0]);
    const reps = r0 && r0.min === r0.max && top.every((p) => { const r = repsDe(p); return r && r.min === r0.min && r.max === r0.max; }) ? r0.min : null;
    if (!mejor || kgDelPlan > mejor.kg) {
      mejor = {
        tipo: 'programado', ejercicio: nombre, kg: kgDelPlan, series: top.length, reps, difNum: Math.round((kgDelPlan - antes) * 10) / 10,
        texto: `Justo lo programado: ${reps !== null ? `${top.length} × ${reps}` : `${top.length} ${top.length === 1 ? 'serie' : 'series'}`} con ${kilosTexto(kgDelPlan)} kg`,
      };
    }
  });
  return mejor;
}
