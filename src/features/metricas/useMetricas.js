import { useCallback, useEffect, useMemo, useState } from 'react';
import { getAthleteState } from '@/lib/api';
import { listActividades, listPrevias, listRecuperacion, umbralesDe } from '@/lib/metricasApi';
import { derivaDelAtleta } from '@/lib/metricas/derivados';
import { hoyLocal, sumaDias } from '@/lib/metricas/forma';
import { sesionesGuiadas, uneConActividades } from '@/lib/metricas/porSerie';

/* Los datos de las métricas de UN atleta, listos para las pantallas.

   Se piden los últimos 15 meses de entrenos (12 que se ven más lo que la condición necesita para «calentar») y 12 de recuperación. Se vuelven a pedir al
   importar o al cambiar los umbrales (`recarga`). Mientras se vuelve a pedir, lo anterior se queda en pantalla. Pasa `key={atletaId}` al componente que lo usa:
   así, al cambiar de atleta, empieza de cero y no se mezcla lo de uno con lo de otro.

   Y lo de ANTES de conectar el reloj (`listPrevias`, fase 5): solo para la condición, la fatiga y «lo normal»; ninguna lista lo enseña.

   También se leen sus entrenos GUIADOS de la app (`user_app_state`): de cada serie y lapso se sabe a qué hora fue, y con eso el detalle de un entreno del reloj
   enseña «Por serie» (ver `lib/metricas/porSerie.js`). Si esa lectura falla, las métricas siguen: solo se quedan sin esa sección. */

export function useMetricas(atletaId) {
  const [estado, setEstado] = useState({ cargando: true, error: null, actividades: [], recuperacion: [], previas: null, umbrales: null, genero: 'm', escritos: null, guiadas: [] });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const hoy = hoyLocal();
        const [actividades, recuperacion, umbrales, guiadas, previas] = await Promise.all([
          listActividades(atletaId, { desdeDia: sumaDias(hoy, -456) }),
          listRecuperacion(atletaId, { desdeDia: sumaDias(hoy, -365) }),
          umbralesDe(atletaId),
          getAthleteState(atletaId).then((r) => sesionesGuiadas(r?.data)).catch(() => []),
          listPrevias(atletaId).catch(() => null),
        ]);
        if (!cancelado) setEstado({ cargando: false, error: null, actividades, recuperacion, previas, umbrales: umbrales.umbrales, genero: umbrales.genero, escritos: umbrales.escritos, guiadas });
      } catch (e) {
        if (!cancelado) setEstado((s) => ({ ...s, cargando: false, error: e?.message ?? 'No se pudieron cargar las métricas' }));
      }
    })();
    return () => { cancelado = true; };
  }, [atletaId, version]);

  const recarga = useCallback(() => {
    setEstado((s) => ({ ...s, cargando: true }));
    setVersion((v) => v + 1);
  }, []);

  const hoy = hoyLocal();
  // Lo de antes de conectar el reloj (`previas`) solo entra a las cuentas; las listas y los récords son de `actividades` (fase 5).
  const d = useMemo(() => derivaDelAtleta({ actividades: estado.actividades, recuperacion: estado.recuperacion, previas: estado.previas, hoy }), [estado.actividades, estado.recuperacion, estado.previas, hoy]);
  // Cada entreno del reloj con la sesión guiada que se hizo a la vez, y las sesiones guiadas que no tuvieron reloj (esas se enseñan solas en la lista).
  const enlaces = useMemo(() => uneConActividades(estado.guiadas, estado.actividades), [estado.guiadas, estado.actividades]);
  return { ...estado, d, hoy, recarga, sesionDe: enlaces.porActividad, sesionesSinReloj: enlaces.sueltas };
}
