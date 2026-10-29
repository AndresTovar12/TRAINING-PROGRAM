/* LOS WORKOUTS DEL PLAN EN «TUS ENTRENOS» (fase 6 de los stickers, 29 oct 2026; prototipo de caminos https://claude.ai/artifact/BFogHsa2GUJGS1Fr332YgD).

   Un solo historial con todo: los entrenos de `actividades` (libres, del reloj, importados) y las sesiones guiadas del plan que se terminaron. Nada nuevo se guarda:
   un workout del plan sigue viviendo en `wr:sessions` (o `wr:sessions@<clave>` si es de otro programa) y aquí solo se lee.

   · Una sesión que el reloj también trajo como actividad (`uneConActividades`) sale UNA vez: manda la actividad, con el nombre y el tipo de la sesión.
   · Cada sesión se ubica en su plan por su llave (`f1-w2-d3`, o `wk-2026-W44-d1` en una rutina semanal; `#2` al final = una vez anterior que se hizo):
     de ahí salen el día (sus ejercicios, su tipo) y a dónde lleva «Ver en mi plan». Si su plan ya no está (se cambió el plan), sale igual, sin día.

   Este archivo no importa nada de la app (ni `@/`): lo cargan tal cual las pruebas de Node (`scripts/prueba-entrenos-del-plan.mjs`). */
import { sesionesGuiadas, uneConActividades } from './metricas/porSerie.js';
import { sesionQueRepite } from './training-utils.js';

const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);

/** Dónde vive una sesión por su llave: `{ phaseId, weekNum, dayIdx }`, `{ semanal: true, dayIdx }` o `null`. */
export function lugarDeSesion(id) {
  const llave = String(id ?? '').split('#')[0];
  const semanal = /^wk-.+-d(\d+)$/.exec(llave);
  if (semanal) return { semanal: true, dayIdx: Number(semanal[1]) };
  const m = /^(.+)-w(\d+)-d(\d+)$/.exec(llave);
  return m ? { phaseId: m[1], weekNum: Number(m[2]), dayIdx: Number(m[3]) } : null;
}

/** El programa de un almacén (`wr:sessions` = el que no tiene clave; `wr:sessions@x` = el de clave `x`), o `null`. */
export function programaDelAlmacen(programas, almacen) {
  const clave = String(almacen ?? '').startsWith('wr:sessions@') ? almacen.slice('wr:sessions@'.length) : null;
  return (programas ?? []).find((p) => (p?.clave ?? null) === clave) ?? null;
}

/**
 * El día del plan de una sesión: `{ fase, semana, dayIdx, dia }` o `null`. `dia` lleva los ejercicios que se hicieron: los del día que repite si dice
 * «repite el martes» (como en la pantalla del día). `programa`: el de `PlanContext` (sus fases ya vienen con los microciclos expandidos).
 */
export function diaDeLaSesion(programa, id) {
  const lugar = lugarDeSesion(id);
  const fases = programa?.phases ?? [];
  if (!lugar || !fases.length) return null;
  const fase = lugar.semanal ? fases[0] : fases.find((f) => f.id === lugar.phaseId);
  const semana = lugar.semanal ? fase?.weekData?.[0] : fase?.weekData?.find((w) => w.num === lugar.weekNum);
  const dia = semana?.days?.[lugar.dayIdx];
  if (!dia) return null;
  const repite = sesionQueRepite(semana, lugar.dayIdx);
  return { fase, semana, dayIdx: lugar.dayIdx, dia: repite ? { ...dia, exercises: repite.day.exercises } : dia };
}

/** ¿Se terminó? Las que solo se abrieron o se dejaron a medias no van a «Tus entrenos». */
const terminada = (registro) => esObjeto(registro) && !!registro.completedAt;

/**
 * Las sesiones guiadas TERMINADAS del atleta (`estado`: `user_app_state.data`), cada una con su programa y su día:
 * `[{ s, programa, lugar }]` (`s`: la de `sesionesGuiadas`; `lugar`: lo de `diaDeLaSesion`, o `null`).
 */
export function sesionesDelPlan(estado, programas = []) {
  return sesionesGuiadas(estado)
    .filter((s) => terminada(s.registro))
    .map((s) => {
      const programa = programaDelAlmacen(programas, s.almacen);
      return { s, programa, lugar: programa ? diaDeLaSesion(programa, s.id) : null };
    });
}

const inicioDe = (a) => Date.parse(a?.inicio);

/**
 * TODO JUNTO, lo más nuevo primero. `actividades`: filas de `actividades` (de la más nueva a la más vieja). `delPlan`: lo de `sesionesDelPlan`.
 * `hasta`: si quedan actividades más viejas sin leer (se cargan por páginas), las sesiones más viejas que la última actividad leída todavía no van
 * (si no, se colarían antes de tiempo y luego, al llegar su página, cambiaría el orden).
 * Cada uno: `{ clave, ms, actividad?, plan? }` (`plan` = `{ s, programa, lugar }`; con los dos, es un workout del plan que el reloj también trajo).
 */
export function mezclaEntrenos(actividades = [], delPlan = [], { hasta = null } = {}) {
  const lista = actividades ?? [];
  const { porActividad } = uneConActividades(delPlan.map((x) => x.s), lista);
  const deSesion = new Map(delPlan.map((x) => [x.s, x]));
  const usadas = new Set(porActividad.values());
  const salida = lista.map((a) => {
    const s = porActividad.get(a.id);
    return { clave: `a:${a.id}`, ms: inicioDe(a), actividad: a, ...(s ? { plan: deSesion.get(s) } : null) };
  });
  delPlan.forEach((x) => {
    if (usadas.has(x.s)) return;
    if (hasta !== null && x.s.inicio < hasta) return;
    salida.push({ clave: `s:${x.s.almacen}:${x.s.id}`, ms: x.s.inicio, plan: x });
  });
  return salida.sort((a, b) => (b.ms || 0) - (a.ms || 0));
}

/** Cuántas series y lapsos hizo una sesión, de lo que contó el entreno guiado (`resumen` de `filasPorSerie`). */
export const seriesHechas = (resumen) => (resumen?.series ?? 0) + (resumen?.lapsos ?? 0);

const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/** «Octubre 2026» de una hora (milisegundos), en la hora de este teléfono. */
export const nombreDelMes = (ms) => { const d = new Date(ms); return `${MESES[d.getMonth()]} ${d.getFullYear()}`; };

/** La lista agrupada por mes, en el mismo orden: `[{ mes: 'Octubre 2026', entrenos: [...] }]`. */
export function porMes(entrenos = []) {
  const grupos = [];
  entrenos.forEach((e) => {
    const mes = Number.isFinite(e.ms) ? nombreDelMes(e.ms) : 'Sin fecha';
    const ultimo = grupos[grupos.length - 1];
    if (ultimo?.mes === mes) ultimo.entrenos.push(e); else grupos.push({ mes, entrenos: [e] });
  });
  return grupos;
}
