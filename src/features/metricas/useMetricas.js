import { useCallback, useEffect, useMemo, useState } from 'react';
import { listActividades, listRecuperacion, umbralesDe } from '@/lib/metricasApi';
import { derivaDelAtleta } from '@/lib/metricas/derivados';
import { diaLocal, sumaDias } from '@/lib/metricas/forma';

/* Los datos de las métricas de UN atleta, listos para las pantallas.

   Se piden los últimos 15 meses de entrenos (12 que se ven más lo que la condición necesita para «calentar») y 12 de recuperación. Se vuelven a pedir al
   importar o al cambiar los umbrales (`recarga`). Mientras se vuelve a pedir, lo anterior se queda en pantalla. Pasa `key={atletaId}` al componente que lo usa:
   así, al cambiar de atleta, empieza de cero y no se mezcla lo de uno con lo de otro. */

/** El día de hoy (`AAAA-MM-DD`) en la hora de quien mira. */
export const hoyLocal = () => diaLocal(Date.now(), -new Date().getTimezoneOffset());

export function useMetricas(atletaId) {
  const [estado, setEstado] = useState({ cargando: true, error: null, actividades: [], recuperacion: [], umbrales: null, genero: 'm', escritos: null });
  const [version, setVersion] = useState(0);

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const hoy = hoyLocal();
        const [actividades, recuperacion, umbrales] = await Promise.all([
          listActividades(atletaId, { desdeDia: sumaDias(hoy, -456) }),
          listRecuperacion(atletaId, { desdeDia: sumaDias(hoy, -365) }),
          umbralesDe(atletaId),
        ]);
        if (!cancelado) setEstado({ cargando: false, error: null, actividades, recuperacion, umbrales: umbrales.umbrales, genero: umbrales.genero, escritos: umbrales.escritos });
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
  const d = useMemo(() => derivaDelAtleta({ actividades: estado.actividades, recuperacion: estado.recuperacion, hoy }), [estado.actividades, estado.recuperacion, hoy]);
  return { ...estado, d, hoy, recarga };
}
