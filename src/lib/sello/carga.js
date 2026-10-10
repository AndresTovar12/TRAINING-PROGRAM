/* Arma los sellos de UNA sesión guiada (la del final del entreno y la del día en el plan): primero busca si el reloj del atleta ya trajo ese entreno (el mismo emparejamiento
   que usa «Por serie», `uneConActividades`) y, si sí, el sello sale con los datos del reloj: distancia, ritmo, ruta, pulso, calorías. Si no, sale con lo que midió la app sola:
   tiempo, series y kilos totales (ver `datos.js`).

   El reloj es un extra: si pedirle los entrenos a la base falla (sin internet, por ejemplo), el sello sale igual con lo guiado. */
import { getActividad, getSeries, listActividades } from '@/lib/metricasApi';
import { tramoDeLaSesion, uneConActividades } from '@/lib/metricas/porSerie';
import { sellosDeActividad, sellosDeSesionGuiada } from '@/lib/sello/datos';

const DIA_MS = 24 * 3600 * 1000;
const dia = (ms) => new Date(ms).toISOString().slice(0, 10);

/**
 * `registro`: lo guardado de la sesión (`sessionsData[id]`). `atletaId`: de quién son los entrenos del reloj.
 * Devuelve `{ sellos }` (vacío si en la sesión no se hizo nada que contar).
 */
export async function cargaSellosDeSesion({ atletaId, registro, sesionId, nombre, unidadPeso }) {
  const tramo = tramoDeLaSesion(registro);
  if (!tramo) return { sellos: [] };
  const sesion = { id: sesionId, almacen: '', nombre: nombre || null, registro, ...tramo };
  try {
    const actividades = await listActividades(atletaId, { desdeDia: dia(tramo.inicio - DIA_MS), hastaDia: dia(tramo.fin + DIA_MS) });
    const unidas = uneConActividades([sesion], actividades).porActividad;
    const id = [...unidas.entries()].find(([, s]) => s === sesion)?.[0];
    if (id) {
      const [fila, series] = await Promise.all([getActividad(id), getSeries(id).catch(() => null)]);
      const delReloj = sellosDeActividad({ fila, series, sesion, unidadPeso });
      if (delReloj.sellos.length) return delReloj;
    }
  } catch { /* sin el reloj: con lo guiado */ }
  return sellosDeSesionGuiada({ registro, inicio: tramo.inicio, fin: tramo.fin, unidadPeso });
}
