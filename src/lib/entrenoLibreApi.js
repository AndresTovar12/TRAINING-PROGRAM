import { supabase } from '@/lib/supabase';
import { construyeActividad } from '@/lib/metricas/construye';
import { umbralesDe } from '@/lib/metricasApi';
import { entrenoLibre } from '@/lib/entrenoLibre';

/* El ENTRENO LIBRE contra la base (ver `lib/entrenoLibre.js`): una fila de `actividades` con origen `manual`. El atleta guarda lo suyo (la base lo permite) y su coach, si tiene,
   lo ve en Métricas como cualquier otro entreno. */

const nuevoId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/**
 * Guarda un entreno libre y devuelve su fila. La carga se estima por deporte y duración («≈»): sin pulso no hay otra forma. Si el mismo entreno ya estaba (mismo inicio y duración:
 * un doble toque en «Guardar»), devuelve el que ya existía en vez de fallar.
 */
export async function guardaEntrenoLibre({ atletaId, deporte, inicioMs, duracionS, distanciaM = null }) {
  const prep = entrenoLibre({ deporte, inicioMs, duracionS, distanciaM });
  const { umbrales, genero } = await umbralesDe(atletaId);
  const { fila } = construyeActividad(prep, { umbrales, genero, desfaseMin: -new Date(inicioMs).getTimezoneOffset(), conSeries: false, origen: 'manual' });
  const { data, error } = await supabase.from('actividades').insert({ ...fila, id: nuevoId(), atleta_id: atletaId, subido_por: atletaId }).select('*').single();
  if (!error) return data;
  if (error.code === '23505') {
    const { data: ya, error: e2 } = await supabase.from('actividades').select('*').eq('atleta_id', atletaId).eq('origen_clave', fila.origen_clave).maybeSingle();
    if (!e2 && ya) return ya;
  }
  throw error;
}

/** Los últimos `n` entrenos de quien entró, del más nuevo al más viejo (los suyos de cualquier origen: libres, del reloj o importados). */
export async function entrenosRecientes(atletaId, n = 6) {
  const { data, error } = await supabase.from('actividades')
    .select('id,atleta_id,origen,deporte,titulo,inicio,fin,desfase_min,duracion_s,movimiento_s,distancia_m,fc_media,fc_max,kcal_activas,kcal_totales,desnivel_pos_m,cadencia_media,potencia_media,carga,carga_metodo,metricas')
    .eq('atleta_id', atletaId).order('inicio', { ascending: false }).limit(n);
  if (error) throw error;
  return data ?? [];
}
