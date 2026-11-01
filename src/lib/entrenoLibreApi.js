import { supabase } from '@/lib/supabase';
import { construyeActividad, preparaEntreno } from '@/lib/metricas/construye';
import { estimaUmbrales } from '@/lib/metricas/calculos';
import { borraActividad, cambiaActividad, umbralesDe } from '@/lib/metricasApi';
import { entrenoLibre } from '@/lib/entrenoLibre';
import { sinNumerosDeLaRuta } from '@/lib/rutaSilenciosa';
import { agregaALaCola, cambiaEnLaCola, cuentaDeLaCola, quitaDeLaCola, resultadoDe } from '@/lib/colaDelTelefono';
import { TodaviaNo, esFaltaDeSenal, marcaConSenal } from '@/lib/senal';

/* El ENTRENO LIBRE contra la base (ver `lib/entrenoLibre.js`): una fila de `actividades` con origen `manual`. El atleta guarda lo suyo (la base lo permite) y su coach, si tiene,
   lo ve en Métricas como cualquier otro entreno.

   SIN CONEXIÓN (1 nov 2026, encargo «sin conexión», parte 2.2). En la app de iPhone el entreno va PRIMERO a la cola del teléfono (`lib/colaDelTelefono.js`) y luego se sube:
   si no hay señal, la pantalla sigue igual (la celebración, la página del entreno) con la fila armada en el teléfono (`pendiente: true`), y la cola lo sube sola después.
   Desde que entra a la cola ya no depende del cronómetro: aunque se cierre la app, se sube al volver. En la web se sube directo, como antes.
   Se guarda con UN id que nace en el teléfono y se sube con «upsert» por ese id: si el servidor lo guardó pero la respuesta se perdió, reintentarlo no hace otro. */

const nuevoId = () => (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(16).slice(2)}`);

/** El tipo de cosa de la cola (ver `lib/tiposDeLaCola.js`). */
export const TIPO_ENTRENO_LIBRE = 'entreno-libre';

/**
 * Lo que se guarda de un entreno libre ANTES de subirlo: ya preparado (la ruta reducida a unos cientos de puntos: lo que se guarda en el teléfono pesa poco) y con la hora
 * local de cuando se hizo (si luego viaja a otra zona horaria, su entreno no se mueve).
 */
export function preparaEntrenoLibre({ deporte, inicioMs, duracionS, distanciaM = null, muestras = null, titulo = null, llevaDistancia = null, rutaSilenciosa = false }) {
  // Con ruta del GPS (ver `lib/ubicacion.js`), las muestras pasan por el mismo motor que lee los relojes: distancia, ritmo, kilómetros y la ruta para el mapa.
  // Con la ruta EN SILENCIO de un entreno sin mapa (`rutaSilenciosa`, sección 8b) solo se guarda la línea: nunca distancia, ritmo, kilómetros ni desnivel.
  const conRuta = Array.isArray(muestras) && muestras.length >= 2;
  const base = entrenoLibre({ deporte, inicioMs, duracionS, distanciaM, titulo, llevaDistancia });
  const preparado = conRuta ? preparaEntreno({ ...base, muestras }) : base;
  const prep = conRuta && rutaSilenciosa ? sinNumerosDeLaRuta(preparado) : preparado;
  return { prep, conRuta, desfaseMin: -new Date(inicioMs).getTimezoneOffset() };
}

const armaFila = ({ prep, conRuta, desfaseMin }, { umbrales, genero }) => construyeActividad(prep, { umbrales, genero, desfaseMin, conSeries: !!conRuta, origen: 'manual' });

// Un error de Supabase con su código HTTP pegado: la cola lo necesita para saber si fue falta de señal o un rechazo.
const conStatus = (error, status) => Object.assign(error instanceof Error ? error : new Error(String(error?.message ?? error)), {
  code: error?.code, details: error?.details, status: error?.status ?? status,
});

/** Los umbrales de la persona al subir. Sin señal, la subida espera. Si fallan por otra cosa, los de siempre: sin pulso no cambian nada (ver `cargaDeActividad`) y el entreno se guarda igual. */
async function umbralesParaSubir(atletaId) {
  try {
    const { umbrales, genero } = await umbralesDe(atletaId);
    return { umbrales, genero };
  } catch (e) {
    if (esFaltaDeSenal(e)) throw e;
    return { umbrales: estimaUmbrales({}), genero: 'm' };
  }
}

/**
 * Sube UN entreno libre (lo llama la cola, o `guardaEntrenoLibre` directo en la web) y devuelve su fila. La carga se estima por deporte y duración («≈»): sin pulso no hay otra
 * forma. Upsert por su id: si ya estaba (se reintentó), no hace otro. Si ya había uno con la misma hora y duración y OTRO id (un doble toque en «Guardar»), devuelve ese.
 */
export async function subeEntrenoLibre(cosa, { desdeLaCola = true } = {}) {
  const atletaId = cosa.usuario;
  const { umbrales, genero } = await umbralesParaSubir(atletaId);
  const { fila, series } = armaFila(cosa.datos ?? {}, { umbrales, genero });
  if (desdeLaCola) {
    // Lo de una cuenta solo se sube con SU sesión: si mientras tanto entró otra persona en este teléfono, espera a que vuelva.
    const { data: s } = await supabase.auth.getSession();
    const quien = s?.session?.user?.id;
    if (quien && quien !== atletaId) throw new TodaviaNo('La sesión es de otra cuenta');
  }
  const { data, error, status } = await supabase.from('actividades')
    .upsert({ ...fila, id: cosa.id, atleta_id: atletaId, subido_por: atletaId }, { onConflict: 'id', ignoreDuplicates: true })
    .select('*');
  if (error) {
    if (error.code === '23505') {
      const { data: ya, error: e2, status: s2 } = await supabase.from('actividades').select('*').eq('atleta_id', atletaId).eq('origen_clave', fila.origen_clave).maybeSingle();
      if (!e2 && ya) return ya;
      if (e2) throw conStatus(e2, s2);
    }
    throw conStatus(error, status);
  }
  marcaConSenal();
  let guardada = data?.[0] ?? null;
  if (!guardada) {
    // Ya estaba con ese id: una subida anterior llegó aunque su respuesta no. Se lee la que quedó.
    const { data: ya, error: e3, status: s3 } = await supabase.from('actividades').select('*').eq('id', cosa.id).maybeSingle();
    if (e3) throw conStatus(e3, s3);
    if (!ya) throw conStatus(new Error('El servidor no devolvió el entreno'), 409);
    guardada = ya;
  }
  if (series) {
    // La ruta es un extra: si el servidor no la acepta, el entreno ya quedó (con su distancia y sus kilómetros). Si no subió por falta de señal, se reintenta la cosa entera
    // (el entreno ya no se repite: mismo id).
    const { error: e4, status: s4 } = await supabase.from('actividad_series')
      .upsert({ actividad_id: cosa.id, atleta_id: atletaId, series }, { onConflict: 'actividad_id', ignoreDuplicates: true });
    if (e4 && esFaltaDeSenal(e4, s4)) throw conStatus(e4, s4);
  }
  return guardada;
}

/** La fila de un entreno que todavía está en la cola del teléfono, para enseñarla igual que una guardada (`pendiente: true`; la ruta en `seriesLocales`). */
export function filaLocalDeEntreno(cosa) {
  const { fila, series } = armaFila(cosa.datos ?? {}, { umbrales: estimaUmbrales({}), genero: 'm' });
  return {
    ...fila, id: cosa.id, atleta_id: cosa.usuario, subido_por: cosa.usuario, creada_en: new Date(cosa.creadoEn ?? Date.now()).toISOString(),
    pendiente: true, seriesLocales: series ?? null,
  };
}

/**
 * Guarda un entreno libre y devuelve su fila. En la app: primero en el teléfono; si sube en unos segundos, la fila del servidor; si no (sin señal), la del teléfono, y la cola
 * lo sube sola. En la web: directo, y si falla lanza el error (el cronómetro se queda para reintentar).
 */
export async function guardaEntrenoLibre({ atletaId, ...entreno }) {
  const cosa = { id: nuevoId(), tipo: TIPO_ENTRENO_LIBRE, usuario: atletaId, creadoEn: Date.now(), datos: preparaEntrenoLibre(entreno) };
  // Solo lo de quien entró va a SU cola (en «Ver como», el coach no guarda en la cola de su atleta: va directo, como antes).
  if (atletaId && atletaId === cuentaDeLaCola()) {
    // Quien espera el resultado se apunta ANTES de que la cola empiece a subirla.
    const resultado = resultadoDe(cosa.id, 8000);
    if (await agregaALaCola(cosa)) {
      const r = await resultado;
      return r.estado === 'subida' && r.resultado ? r.resultado : filaLocalDeEntreno(cosa);
    }
  }
  return subeEntrenoLibre(cosa, { desdeLaCola: false });
}

/** Cambia el nombre o la actividad de un entreno. Si todavía está en la cola, se cambia ahí (sube ya cambiado); si no, en el servidor. Devuelve la fila cambiada. */
export async function cambiaEntreno(fila, { titulo, deporte } = {}) {
  if (fila?.pendiente) {
    const limpio = typeof titulo === 'string' && titulo.trim() ? titulo.replace(/\s+/g, ' ').trim().slice(0, 40) : null;
    const enLaCola = await cambiaEnLaCola(fila.id, (d) => ({ ...d, prep: { ...d.prep, ...(limpio ? { titulo: limpio } : {}), ...(deporte ? { deporte } : {}) } }));
    if (enLaCola) return { ...fila, ...(limpio ? { titulo: limpio } : {}), ...(deporte ? { deporte } : {}) };
  }
  return cambiaActividad(fila.id, { titulo, deporte });
}

/** Borra un entreno. Si todavía está en la cola, se quita de ahí (nunca llega al servidor); si no, del servidor. */
export async function borraEntreno(fila) {
  if (fila?.pendiente && await quitaDeLaCola(fila.id)) return;
  await borraActividad(fila.id);
}

/**
 * Los entrenos de la lista con los que todavía están en la cola del teléfono (los de `usuario`, que el servidor aún no tiene), del más nuevo al más viejo, hasta `n`.
 * Puro.
 */
export function conPendientes(filas, cosas, usuario, n = Infinity) {
  const ya = new Set((filas ?? []).map((f) => f.id));
  const locales = (cosas ?? []).filter((c) => c.tipo === TIPO_ENTRENO_LIBRE && c.usuario === usuario && !ya.has(c.id)).map(filaLocalDeEntreno);
  if (!locales.length) return filas;
  return [...locales, ...(filas ?? [])].sort((a, b) => Date.parse(b.inicio) - Date.parse(a.inicio)).slice(0, n);
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
