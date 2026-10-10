import { useEffect, useMemo, useState } from 'react';
import { usePerfilDeLaVista } from '@/contexts/VistaContext';
import { listRecuperacion } from '@/lib/recuperacionApi';
import { hoyLocal, lecturaParaElAtleta, resumenDeRecuperacion, sumaDias } from '@/lib/metricas/forma';

/* Lo que el reloj dejó de la recuperación del atleta en los últimos 45 días: pulso en reposo, variabilidad cardiaca (HRV) y sueño.

   Andrés (10 oct 2026): con reloj esas medidas «se llenan solas»; sin reloj la app no las pide. Por eso la tarjeta y la hoja de Salud leen de aquí en vez de
   preguntarlas. La hoja de Salud del propio atleta y la del atleta que su coach mira usan la persona de la vista (`usePerfilDeLaVista`).

   Devuelve `{ listo, hayReloj, resumen, lectura, recientes }`:
     hayReloj   hay al menos una medida de los últimos 7 días
     lectura    el veredicto dicho al atleta (`lecturaParaElAtleta`) o `null` si todavía no hay con qué comparar
     recientes  `{ reposo, hrv, sueno }`: el último valor de cada una si es de los últimos 7 días, si no `null` */
const DIAS_DE_HISTORIAL = 45;
const DIAS_DE_FRESCURA = 6;

export function useRecuperacionReciente() {
  const { userId } = usePerfilDeLaVista();
  const [leido, setLeido] = useState({ de: null, filas: [] });

  useEffect(() => {
    if (!userId) return undefined;
    let cancelado = false;
    listRecuperacion(userId, { desdeDia: sumaDias(hoyLocal(), -DIAS_DE_HISTORIAL) })
      .then((filas) => { if (!cancelado) setLeido({ de: userId, filas }); })
      // Sin la lectura del reloj la pantalla sigue funcionando con lo que el atleta anota (el dolor): no es un error que se le enseñe.
      .catch(() => { if (!cancelado) setLeido({ de: userId, filas: [] }); });
    return () => { cancelado = true; };
  }, [userId]);

  const listo = leido.de === userId;
  return useMemo(() => {
    const hoy = hoyLocal();
    const resumen = resumenDeRecuperacion(listo ? leido.filas : [], { hoy });
    const desde = sumaDias(hoy, -DIAS_DE_FRESCURA);
    const fresco = (m) => (m.ultimo && m.ultimo.dia >= desde ? m.ultimo : null);
    const recientes = { reposo: fresco(resumen.reposo), hrv: fresco(resumen.hrv), sueno: fresco(resumen.sueno) };
    return { listo, hayReloj: Object.values(recientes).some(Boolean), resumen, lectura: lecturaParaElAtleta(resumen), recientes };
  }, [listo, leido.filas]);
}
