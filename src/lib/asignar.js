import {
  planDe, createPlan, updatePlan, getProgramas, getAthleteState,
} from '@/lib/api';
import {
  cursorAlDia, defaultCursor, isValidCursor, estructuraDelPlan,
} from '@/lib/training-utils';
import { esProgramaFantasma } from '@/lib/programas';
import { diasDeWorkout } from '@/lib/misPlanesDatos';

/* DARLE A UN ATLETA LO QUE SE GUARDÓ EN «MIS PLANES».

   Siempre es una COPIA (Andrés, 2 oct 2026): cambiar lo guardado después no mueve lo que el atleta ya
   recibió, ni al revés. Un programa o una rutina REEMPLAZAN el plan que el atleta ya tuviera con este
   profesional; la base guarda la versión anterior, así que se recupera en «Cambios del plan». Un
   workout se pone en un día de su plan. */

const clone = (o) => structuredClone(o);

/**
 * De quién es el programa que se le da a un atleta: `null` = el del coach principal; con id = el
 * de un profesional (un fisio, alguien del equipo). Es la misma cuenta que hace la ficha del atleta
 * (`miClave`): quien atiende desde el equipo, o un fisio frente a un plan que hizo otra persona,
 * trabaja en SU programa; los coaches y el master, en el del coach.
 */
export function clavePrograma({ atleta, yo, esMaster, salud, programas }) {
  if (esMaster) return null;
  const delCoach = (programas ?? []).find((p) => (p.profesional_id ?? null) === null) ?? null;
  const deEquipo = atleta.coach_id !== yo;
  const planAjeno = salud && !deEquipo && !!delCoach?.created_by && delCoach.created_by !== yo;
  return deEquipo || planAjeno ? yo : null;
}

/** Fase y semana (posiciones) en que va el atleta HOY dentro de su plan. */
export function semanaActual(plan, estadoData, hoy = new Date()) {
  const phases = plan?.data?.phases ?? [];
  if (plan?.data?.kind === 'weekly') return { faseIdx: 0, semanaIdx: 0 };
  const sufijo = plan?.profesional_id ? `@${plan.profesional_id}` : '';
  const guardado = estadoData?.[`wr:cursor${sufijo}`];
  const base = isValidCursor(phases, guardado) ? guardado : defaultCursor(phases);
  const cursor = base ? cursorAlDia(phases, base, hoy) : null;
  const faseIdx = Math.max(0, phases.findIndex((f) => f.id === cursor?.phaseId));
  const semanaIdx = Math.max(0, (phases[faseIdx]?.weekData ?? []).findIndex((w) => w.num === cursor?.weekNum));
  return { faseIdx, semanaIdx };
}

/**
 * Pone un programa o una rutina (`plan` = { kind, estructura, phases }, con ids de fase nuevos) como el
 * plan de un atleta: sobre el que ya tenía, o como el primero.
 */
export async function asignarPlan({ atletaId, profesionalId = null, creadorId, nombre, plan }) {
  const actual = await planDe(atletaId, profesionalId);
  const datos = { title: nombre, phases: plan.phases, kind: plan.kind, estructura: plan.estructura };
  if (actual) {
    const fila = await updatePlan(actual.id, datos);
    return { fila, reemplazo: !esProgramaFantasma(actual.data) };
  }
  const fila = await createPlan({ userId: atletaId, ...datos, createdBy: creadorId, profesionalId });
  return { fila, reemplazo: false };
}

/**
 * Pone un workout en un día de la semana de un plan que ya existe. `modo`:
 *   'agregar'    — como otra sesión de ese día (no toca nada de lo que hay);
 *   'reemplazar' — en el lugar de la PRIMERA sesión que ya tenga ese día (las demás se quedan).
 * Nunca se mueve ni se quita una sesión existente: lo que anotó el atleta se guarda por la posición de
 * cada sesión, y reordenarlas se lo cambiaría de día. Lo nuevo va al final o en el lugar de una vieja.
 */
export async function ponerWorkoutEnPlan({ plan, faseIdx, semanaIdx, dia, data, nombre, modo = 'agregar' }) {
  const phases = clone(plan.data.phases);
  const semana = phases[faseIdx]?.weekData?.[semanaIdx];
  if (!semana) throw new Error('Ese plan no tiene esa semana');
  const nuevas = diasDeWorkout(data, dia, nombre);
  const dias = [...(semana.days ?? [])];
  const primera = dias.findIndex((d) => d.day === dia);
  if (modo === 'reemplazar' && primera >= 0) {
    dias[primera] = nuevas[0];
    dias.push(...nuevas.slice(1));
  } else {
    dias.push(...nuevas);
  }
  semana.days = dias;
  return updatePlan(plan.id, { phases, kind: plan.data.kind, estructura: estructuraDelPlan(plan.data) });
}

/** ¿Ese día de esa semana ya tiene sesión? (para ofrecer reemplazar o agregar) */
export const diaTieneSesion = (plan, faseIdx, semanaIdx, dia) => (
  (plan?.data?.phases?.[faseIdx]?.weekData?.[semanaIdx]?.days ?? []).some((d) => d.day === dia && d.cat !== 'off')
);

/* ---------------------------- Varios a la vez --------------------------- */

const mensajeDe = (e) => e?.message || 'No se pudo';

/** El programa del profesional para ese atleta, ya buscado: `{ plan, clave, programas }`. */
export async function programaDe({ atleta, yo, esMaster, salud }) {
  const programas = await getProgramas(atleta.id);
  const clave = clavePrograma({ atleta, yo, esMaster, salud, programas });
  const plan = programas.find((p) => (p.profesional_id ?? null) === clave) ?? null;
  return { plan, clave, programas };
}

/**
 * Le da el mismo programa o rutina a varios atletas, uno por uno (si uno falla, los demás siguen).
 * `plan` es lo que devuelve `planDePrograma` o `planDeRutina`: cada atleta recibe fases con ids propios.
 * `alAvanzar(i, total)` deja enseñar el avance. Devuelve un resultado por atleta:
 * { atleta, estado: 'ok' | 'error', reemplazo, mensaje }.
 */
export async function asignarPlanAVarios({ atletas, yo, esMaster, salud, nombre, hacerPlan, alAvanzar }) {
  const resultados = [];
  for (let i = 0; i < atletas.length; i += 1) {
    const atleta = atletas[i];
    try {
      const { clave } = await programaDe({ atleta, yo, esMaster, salud });
      const { reemplazo } = await asignarPlan({ atletaId: atleta.id, profesionalId: clave, creadorId: yo, nombre, plan: hacerPlan() });
      resultados.push({ atleta, estado: 'ok', reemplazo });
    } catch (e) {
      resultados.push({ atleta, estado: 'error', mensaje: mensajeDe(e) });
    }
    alAvanzar?.(i + 1, atletas.length);
  }
  return resultados;
}

/**
 * Pone un workout en el día de la semana `dia` de la semana en que va HOY cada atleta. Quien no tiene
 * plan se salta ('sin-plan'). Devuelve un resultado por atleta: { atleta, estado, mensaje }.
 */
export async function asignarWorkoutAVarios({ atletas, yo, esMaster, salud, dia, data, nombre, modo, alAvanzar }) {
  const resultados = [];
  for (let i = 0; i < atletas.length; i += 1) {
    const atleta = atletas[i];
    try {
      const { plan } = await programaDe({ atleta, yo, esMaster, salud });
      if (!plan || esProgramaFantasma(plan.data) || !(plan.data?.phases ?? []).length) {
        resultados.push({ atleta, estado: 'sin-plan' });
      } else {
        const estado = await getAthleteState(atleta.id).catch(() => null);
        const { faseIdx, semanaIdx } = semanaActual(plan, estado?.data);
        await ponerWorkoutEnPlan({ plan, faseIdx, semanaIdx, dia, data, nombre, modo });
        resultados.push({ atleta, estado: 'ok' });
      }
    } catch (e) {
      resultados.push({ atleta, estado: 'error', mensaje: mensajeDe(e) });
    }
    alAvanzar?.(i + 1, atletas.length);
  }
  return resultados;
}
