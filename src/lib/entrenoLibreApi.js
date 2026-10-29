import { supabase } from '@/lib/supabase';
import { construyeActividad, preparaEntreno } from '@/lib/metricas/construye';
import { umbralesDe } from '@/lib/metricasApi';
import { entrenoLibre } from '@/lib/entrenoLibre';
import { sinNumerosDeLaRuta } from '@/lib/rutaSilenciosa';

/* El ENTRENO LIBRE contra la base (ver `lib/entrenoLibre.js`): una fila de `actividades` con origen `manual`. El atleta guarda lo suyo (la base lo permite) y su coach, si tiene,
   lo ve en Métricas como cualquier otro entreno. */

const nuevoId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/**
 * Guarda un entreno libre y devuelve su fila. La carga se estima por deporte y duración («≈»): sin pulso no hay otra forma. Si el mismo entreno ya estaba (mismo inicio y duración:
 * un doble toque en «Guardar»), devuelve el que ya existía en vez de fallar.
 */
export async function guardaEntrenoLibre({ atletaId, deporte, inicioMs, duracionS, distanciaM = null, muestras = null, titulo = null, llevaDistancia = null, rutaSilenciosa = false }) {
  // Con ruta del GPS (ver `lib/ubicacion.js`), las muestras pasan por el mismo motor que lee los relojes: distancia, ritmo, kilómetros y la ruta para el mapa.
  // Con la ruta EN SILENCIO de un entreno sin mapa (`rutaSilenciosa`, sección 8b) solo se guarda la línea: nunca distancia, ritmo, kilómetros ni desnivel.
  const conRuta = Array.isArray(muestras) && muestras.length >= 2;
  const base = entrenoLibre({ deporte, inicioMs, duracionS, distanciaM, titulo, llevaDistancia });
  const preparado = conRuta ? preparaEntreno({ ...base, muestras }) : base;
  const prep = conRuta && rutaSilenciosa ? sinNumerosDeLaRuta(preparado) : preparado;
  const { umbrales, genero } = await umbralesDe(atletaId);
  const { fila, series } = construyeActividad(prep, { umbrales, genero, desfaseMin: -new Date(inicioMs).getTimezoneOffset(), conSeries: conRuta, origen: 'manual' });
  const { data, error } = await supabase.from('actividades').insert({ ...fila, id: nuevoId(), atleta_id: atletaId, subido_por: atletaId }).select('*').single();
  if (!error) {
    // La ruta es un extra: si no se guarda, el entreno ya quedó (con su distancia y sus kilómetros).
    if (series) await supabase.from('actividad_series').insert({ actividad_id: data.id, atleta_id: atletaId, series }).then(() => {}, () => {});
    return data;
  }
  if (error.code === '23505') {
    const { data: ya, error: e2 } = await supabase.from('actividades').select('*').eq('atleta_id', atletaId).eq('origen_clave', fila.origen_clave).maybeSingle();
    if (!e2 && ya) return ya;
  }
  throw error;
}

/** Los últimos `n` entrenos de quien entró, del más nuevo al más viejo (los suyos de cualquier origen: libres, del reloj o importados). */
const COLUMNAS_DE_LA_LISTA = 'id,atleta_id,origen,deporte,titulo,inicio,fin,desfase_min,duracion_s,movimiento_s,distancia_m,fc_media,fc_max,kcal_activas,kcal_totales,desnivel_pos_m,cadencia_media,potencia_media,carga,carga_metodo,metricas,vueltas';

export async function entrenosRecientes(atletaId, n = 6) {
  const { data, error } = await supabase.from('actividades')
    .select(COLUMNAS_DE_LA_LISTA)
    .eq('atleta_id', atletaId).order('inicio', { ascending: false }).limit(n);
  if (error) throw error;
  return data ?? [];
}

/** Sus entrenos de un deporte de ANTES de una hora (para saber si uno viejo fue récord al abrirlo: `recordDe`). Los últimos 500, del más nuevo al más viejo. */
export async function entrenosAnteriores(atletaId, deporte, antesDe) {
  const { data, error } = await supabase.from('actividades')
    .select('id,deporte,titulo,inicio,desfase_min,duracion_s,distancia_m,metricas')
    .eq('atleta_id', atletaId).eq('deporte', deporte).lt('inicio', antesDe).order('inicio', { ascending: false }).limit(500);
  if (error) throw error;
  return data ?? [];
}

/** Cuántos entrenos tiene en `actividades` y la hora del más viejo (milisegundos): el «11 entrenos · desde septiembre» de «Ver todos». `{ total, primero }`. */
export async function cuentaDeEntrenos(atletaId) {
  const [cuenta, viejo] = await Promise.all([
    supabase.from('actividades').select('id', { count: 'exact', head: true }).eq('atleta_id', atletaId),
    supabase.from('actividades').select('inicio').eq('atleta_id', atletaId).order('inicio', { ascending: true }).limit(1),
  ]);
  if (cuenta.error) throw cuenta.error;
  const inicio = viejo.data?.[0]?.inicio;
  return { total: cuenta.count ?? 0, primero: inicio ? Date.parse(inicio) : null };
}

/** Una página del historial completo («Ver todos»): `n` entrenos a partir del número `desde` (0 = el más nuevo). */
export async function paginaDeEntrenos(atletaId, desde = 0, n = 50) {
  const { data, error } = await supabase.from('actividades')
    .select(COLUMNAS_DE_LA_LISTA)
    .eq('atleta_id', atletaId).order('inicio', { ascending: false }).range(desde, desde + n - 1);
  if (error) throw error;
  return data ?? [];
}
