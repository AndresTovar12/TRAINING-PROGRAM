/* Arma el ENTRENO de una sesión guiada para su ficha de stickers (la del final del entreno y la del día en el plan). Primero busca si el reloj del atleta ya trajo
   ese entreno (el mismo emparejamiento que usa «Por serie», `uneConActividades`) y, si sí, la ficha sale con los datos del reloj (distancia, ritmo, ruta, pulso,
   calorías) más las series y los kilos de lo guiado. Si no, sale con lo que midió la app sola: tiempo, series, ejercicios y kilos (ver `ficha.js`).

   El reloj es un extra: si pedirle los entrenos a la base falla (sin internet, por ejemplo), la ficha sale igual con lo guiado. */
import { getActividad, getSeries, listActividades } from '@/lib/metricasApi';
import { tramoDeLaSesion, uneConActividades } from '@/lib/metricas/porSerie';
import { entrenoDeActividad, entrenoDeSesion } from '@/lib/stickers/ficha';

const DIA_MS = 24 * 3600 * 1000;
const dia = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * `registro`: lo guardado de la sesión (`sessionsData[id]`). `atletaId`: de quién son los entrenos del reloj. `tipo`: `{ nombre, icono }` del tipo de sesión.
 * Devuelve el entreno para `ficha()`, o `null` si en la sesión no se hizo nada que contar.
 */
export async function cargaEntrenoDeSesion({ atletaId, registro, sesionId, nombre, tipo = null, coach = null, unidadPeso = 'kg' }) {
  const tramo = tramoDeLaSesion(registro);
  if (!tramo) return null;
  const sesion = { id: sesionId, almacen: '', nombre: nombre || null, registro, ...tramo };
  try {
    const actividades = await listActividades(atletaId, { desdeDia: dia(tramo.inicio - DIA_MS), hastaDia: dia(tramo.fin + DIA_MS) });
    const unidas = uneConActividades([sesion], actividades).porActividad;
    const id = [...unidas.entries()].find(([, s]) => s === sesion)?.[0];
    if (id) {
      const [fila, series] = await Promise.all([getActividad(id), getSeries(id).catch(() => null)]);
      if (fila) return entrenoDeActividad({ fila, series, registro, tipo, nombre, plan: true, coach, unidadPeso });
    }
  } catch { /* sin el reloj: con lo guiado */ }
  return entrenoDeSesion({ registro, inicioMs: tramo.inicio, finMs: tramo.fin, tipo, nombre, plan: true, coach, unidadPeso });
}
