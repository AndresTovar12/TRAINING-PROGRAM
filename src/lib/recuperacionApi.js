import { supabase } from '@/lib/supabase';

/* La recuperación diaria que dejó el reloj (pulso en reposo, HRV, sueño…). Vive aparte de `metricasApi.js` porque la tarjeta de Salud del Home también la
   pide y no debe cargar con ella todo el motor de las métricas. Ver `docs/metricas-del-entrenamiento.md`. */
const PAGINA = 1000;

/** La recuperación de cada día (pulso en reposo, HRV, sueño…) desde `desdeDia`, del más viejo al más nuevo. */
export async function listRecuperacion(atletaId, { desdeDia = null } = {}) {
  const filas = [];
  for (let desde = 0; desde < 5000; desde += PAGINA) {
    let q = supabase.from('recuperacion_diaria').select('*').eq('atleta_id', atletaId).order('dia', { ascending: true }).range(desde, desde + PAGINA - 1);
    if (desdeDia) q = q.gte('dia', desdeDia);
    const { data, error } = await q;
    if (error) throw error;
    filas.push(...(data ?? []));
    if ((data ?? []).length < PAGINA) break;
  }
  return filas;
}
