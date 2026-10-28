/* Lo que la ficha de stickers necesita y no viene con el entreno: busca el entreno del reloj de una sesión guiada, el historial del año (Semana, Mes, Racha)
   y el @usuario del coach («Programmed by»).

   Para una sesión guiada, primero busca si el reloj del atleta ya trajo ese entreno (el mismo emparejamiento que usa «Por serie», `uneConActividades`) y, si sí,
   la ficha sale con los datos del reloj (distancia, ritmo, ruta, pulso, calorías, las vueltas para los parciales) más las series y los kilos de lo guiado. Si no,
   sale con lo que midió la app sola: tiempo, series, ejercicios y kilos (ver `ficha.js`).

   Todo es un extra: si pedirle algo a la base falla (sin internet, por ejemplo), la ficha sale igual con lo que hay. */
import { supabase } from '@/lib/supabase';
import { getAthleteState } from '@/lib/api';
import { getActividad, getSeries, listActividades } from '@/lib/metricasApi';
import { sesionesGuiadas, tramoDeLaSesion, uneConActividades } from '@/lib/metricas/porSerie';
import { actividadDeEntreno } from '@/lib/actividades';
import { entrenoDeActividad, entrenoDeSesion } from '@/lib/stickers/ficha';

const DIA_MS = 24 * 3600 * 1000;
const dia = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * `registro`: lo guardado de la sesión (`sessionsData[id]`). `atletaId`: de quién son los entrenos del reloj. `tipo`: `{ nombre, icono }` del tipo de sesión
 * (el que eligió el coach). `coach`: «@usuario». `programadas` y `record`: lo de `lib/stickers/plan.js`. Devuelve el entreno para `ficha()`, o `null` si en la sesión no se hizo nada que contar.
 */
export async function cargaEntrenoDeSesion({ atletaId, registro, sesionId, nombre, tipo = null, coach = null, unidadPeso = 'kg', programadas = null, record = null }) {
  const tramo = tramoDeLaSesion(registro);
  if (!tramo) return null;
  const sesion = { id: sesionId, almacen: '', nombre: nombre || null, registro, ...tramo };
  try {
    const actividades = await listActividades(atletaId, { desdeDia: dia(tramo.inicio - DIA_MS), hastaDia: dia(tramo.fin + DIA_MS) });
    const unidas = uneConActividades([sesion], actividades).porActividad;
    const id = [...unidas.entries()].find(([, s]) => s === sesion)?.[0];
    if (id) {
      // El entreno COMPLETO (con sus vueltas: Parciales, Regla y Tu mejor kilómetro).
      const [fila, series] = await Promise.all([getActividad(id), getSeries(id).catch(() => null)]);
      if (fila) return entrenoDeActividad({ fila, series, registro, tipo, nombre, plan: true, coach, unidadPeso, programadas, record });
    }
  } catch { /* sin el reloj: con lo guiado */ }
  return entrenoDeSesion({ registro, inicioMs: tramo.inicio, finMs: tramo.fin, tipo, nombre, plan: true, coach, unidadPeso, id: sesionId, programadas, record });
}

/** El «@usuario» de un coach, o `null` (sin coach, sin permiso para leerlo o sin red). */
export async function coachDe(coachId) {
  if (!coachId) return null;
  try {
    const { data } = await supabase.from('profiles').select('username').eq('id', coachId).maybeSingle();
    return data?.username ? `@${data.username}` : null;
  } catch {
    return null;
  }
}

/**
 * EL HISTORIAL DEL AÑO de una persona (para Semana, Mes, Racha del tipo, Semana con íconos y Mes por tipo): sus entrenos de `actividades` (libres, del reloj o
 * importados) y sus sesiones guiadas que no tuvieron reloj. Cada uno: `{ id, inicioMs, desfaseMin, duracionS, distanciaM, tipo: { nombre, icono } }`.
 * El tipo: el de la actividad (`propias`: las que creó); si fue una sesión del plan, el que eligió el coach (`tipoDeSesion(id)`, ver `useTipoDeSesion`).
 * Desde el 1 de enero del año del entreno (o 8 días antes, para que la semana que cruza el año salga entera). `[]` si falla.
 */
export async function cargaHistorial({ atletaId, inicioMs = Date.now(), propias = [], tipoDeSesion = () => null }) {
  if (!atletaId) return [];
  const año = new Date(inicioMs).getUTCFullYear();
  const desde = Math.min(Date.UTC(año, 0, 1), inicioMs - 8 * DIA_MS);
  try {
    const [actividades, guiadas] = await Promise.all([
      listActividades(atletaId, { desdeDia: dia(desde) }),
      getAthleteState(atletaId).then((r) => sesionesGuiadas(r?.data)).catch(() => []),
    ]);
    const { porActividad, sueltas } = uneConActividades(guiadas.filter((s) => s.inicio >= desde), actividades);
    const deActividad = actividades.map((a) => {
      const sesion = porActividad.get(a.id);
      const act = actividadDeEntreno(a, propias);
      return {
        id: a.id, inicioMs: Date.parse(a.inicio), desfaseMin: a.desfase_min ?? null, duracionS: a.duracion_s ?? 0, distanciaM: a.distancia_m ?? 0,
        tipo: (sesion && tipoDeSesion(sesion.id)) || (act ? { nombre: act.nombre, icono: act.icono } : null),
      };
    });
    const deSesion = sueltas.map((s) => ({
      id: s.id, inicioMs: s.inicio, desfaseMin: null, duracionS: Math.round((s.fin - s.inicio) / 1000), distanciaM: 0,
      tipo: tipoDeSesion(s.id) || { nombre: s.nombre || 'Workout', icono: null },
    }));
    return [...deActividad, ...deSesion];
  } catch {
    return [];
  }
}
