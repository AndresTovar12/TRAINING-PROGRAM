/* De un entreno «crudo» (lo que leyó un archivo) a lo que se guarda: la FILA de `actividades` y sus series.

   Son DOS pasos, y la razón es la memoria. Un entreno de una hora trae miles de muestras, y una importación puede traer miles de entrenos (el historial de
   Strava): no caben todos a la vez.
     1. `preparaEntreno`  se hace apenas se lee el archivo, con las muestras en la mano: saca el resumen exacto (el pulso máximo de verdad, no el de un promedio),
                          los kilómetros y las series reducidas a unos cientos de puntos. Después las muestras se sueltan.
     2. `construyeActividad`  arma la fila con los umbrales del atleta. Las zonas y la carga salen de las series reducidas: así, si al final de la importación
                          resulta que su pulso máximo real era más alto de lo que se supuso, se pueden recalcular sin volver a leer los archivos.

   Regla: lo que el reloj declaró (el pulso medio de su sesión, la distancia total) manda sobre lo que se calcula de las muestras, porque es lo que el atleta ve en
   su reloj; lo que no dijo, se calcula.

   También decide cuáles entrenos de una tanda ya existen (el mismo entreno llega a veces por dos caminos: el reloj y Strava) y cuáles son nuevos.

   Todo es puro y no importa nada de la app (ni `@/`). */
import {
  cargaDeActividad, completaMuestras, reduceSeries, resumenDeMuestras, tiempoEnZonas, vueltasPorKm,
} from './calculos.js';
import { DEPORTES } from './deportes.js';

const redondea = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 10 ** d) / 10 ** d : null);
const primero = (...vs) => vs.find((v) => v !== null && v !== undefined) ?? null;

/** La clave con la que se reconoce el mismo entreno: la hora de inicio al segundo y su duración. */
export const claveDeEntreno = (e) => `t${Math.round(e.inicio / 1000)}-${Math.round(e.duracion_s ?? 0)}`;

/* ------------------------------------------------------------------ */
/* Paso 1: preparar (con las muestras en la mano)                      */
/* ------------------------------------------------------------------ */

/**
 * Del entreno crudo a uno «preparado»: sin muestras, con lo calculado de ellas. `{ ...crudo (sin muestras), calculado, km, series }`.
 * `calculado` es lo que dicen las muestras (ver `resumenDeMuestras`), `km` los kilómetros de la ruta y `series` las series reducidas para guardar.
 */
export function preparaEntreno(crudo) {
  const muestras = completaMuestras(crudo.muestras ?? []);
  const calculado = resumenDeMuestras(muestras, { duracionS: crudo.duracion_s ?? null });
  const distancia = primero(crudo.distancia_m, calculado.distancia_m) ?? 0;
  const km = DEPORTES[crudo.deporte]?.distancia && distancia >= 1000 ? vueltasPorKm(muestras) : [];
  const series = muestras.length >= 10 ? reduceSeries(muestras) : null;
  // `muestras` se suelta aquí: lo que sigue solo necesita el resumen y las series.
  const { muestras: _suelta, ...resto } = crudo;
  return { ...resto, calculado, km, series };
}

/* ------------------------------------------------------------------ */
/* Paso 2: construir la fila                                           */
/* ------------------------------------------------------------------ */

// Las series reducidas, otra vez como muestras `{ t, fc }`: bastan para contar zonas y carga.
const muestrasDeSeries = (series) => {
  if (!series?.t || !series.fc) return [];
  const m = [];
  series.t.forEach((t, i) => { if (series.fc[i] !== null && series.fc[i] !== undefined) m.push({ t, fc: series.fc[i] }); });
  return m;
};

/**
 * Arma lo que se guarda de un entreno preparado.
 *   contexto.umbrales   `{ fc_max, fc_reposo, fc_umbral, metodo }` (ver `estimaUmbrales`)
 *   contexto.genero     'm' | 'f' (para la curva de carga)
 *   contexto.desfaseMin cuando el archivo no dice la hora local (casi todos los GPX y TCX): el de la persona
 *   contexto.conSeries  si se guardan las series (pulso, ruta…) o solo el resumen (entrenos viejos de una importación grande)
 *   contexto.origen     'archivo' | 'apple_salud' | …
 * Devuelve `{ fila, series }`; `series` es `null` si no se guardan o si no había muestras que valgan.
 */
export function construyeActividad(prep, { umbrales, genero = 'm', desfaseMin = 0, conSeries = true, origen = 'archivo' } = {}) {
  const c = prep.calculado ?? {};
  const r = prep.resumen ?? {};
  const duracion = primero(prep.duracion_s, c.duracion_s);
  const deporte = prep.deporte && DEPORTES[prep.deporte] ? prep.deporte : 'otro';
  const mini = muestrasDeSeries(prep.series);
  const zonas = mini.length ? tiempoEnZonas(mini, umbrales.fc_max) : null;
  const carga = cargaDeActividad({ muestras: mini, deporte, duracionS: duracion ?? 0, umbrales, genero });

  // Las vueltas del reloj si traen al menos dos; si no, los kilómetros de la ruta. Los kilómetros también se guardan aparte cuando el reloj dio otras vueltas.
  const delReloj = (prep.vueltas ?? []).filter((v) => v.dur);
  const km = prep.km ?? [];
  const vueltas = delReloj.length >= 2 ? delReloj : km;
  const metricas = { ...(prep.metricas ?? {}) };
  if (delReloj.length >= 2 && km.length >= 2) metricas.km = km;
  const distancia = primero(prep.distancia_m, c.distancia_m);
  const movimiento = primero(prep.movimiento_s, c.movimiento_s);
  if (distancia >= 100 && movimiento > 0 && DEPORTES[deporte]?.ritmo) metricas.ritmo_medio_s_km = Math.round((movimiento / distancia) * 1000);
  if (distancia >= 100 && movimiento > 0 && deporte === 'bici') metricas.velocidad_media_kmh = redondea((distancia / movimiento) * 3.6, 1);

  const fila = {
    origen,
    origen_clave: claveDeEntreno(prep),
    formato: prep.formato ?? null,
    dispositivo: prep.dispositivo ?? null,
    deporte,
    deporte_original: prep.deporte_original ?? null,
    titulo: prep.titulo ?? null,
    inicio: new Date(prep.inicio).toISOString(),
    fin: prep.fin ? new Date(prep.fin).toISOString() : null,
    desfase_min: prep.desfase_min ?? desfaseMin,
    duracion_s: duracion !== null ? Math.round(duracion) : null,
    movimiento_s: movimiento,
    distancia_m: distancia,
    desnivel_pos_m: primero(r.desnivel_pos_m, c.desnivel_pos_m),
    desnivel_neg_m: primero(r.desnivel_neg_m, c.desnivel_neg_m),
    fc_media: primero(r.fc_media, c.fc_media),
    fc_max: primero(r.fc_max, c.fc_max),
    fc_min: primero(r.fc_min, c.fc_min),
    kcal_activas: primero(prep.kcal_activas),
    kcal_totales: primero(prep.kcal_totales),
    cadencia_media: primero(r.cadencia_media, c.cadencia_media),
    potencia_media: primero(r.potencia_media, c.potencia_media),
    potencia_max: primero(r.potencia_max, c.potencia_max),
    velocidad_max_ms: primero(r.velocidad_max_ms, c.velocidad_max_ms),
    zonas_s: zonas,
    umbrales: zonas || carga ? { fc_max: umbrales.fc_max, fc_reposo: umbrales.fc_reposo, fc_umbral: umbrales.fc_umbral, metodo: umbrales.metodo } : null,
    carga: carga?.carga ?? null,
    carga_metodo: carga?.metodo ?? null,
    vueltas: vueltas.length ? vueltas : null,
    metricas: Object.keys(metricas).length ? metricas : null,
  };
  return { fila, series: conSeries ? (prep.series ?? null) : null };
}

/**
 * Vuelve a contar las zonas y la carga de una fila YA guardada con otros umbrales (el pulso máximo cambió): se hace con sus series reducidas, sin releer
 * el archivo. Devuelve el trozo de la fila que cambia, o `null` si no hay series con pulso.
 */
export function recalculaConUmbrales(fila, series, umbrales, genero = 'm') {
  const mini = muestrasDeSeries(series);
  if (!mini.length) return null;
  const carga = cargaDeActividad({ muestras: mini, deporte: fila.deporte, duracionS: fila.duracion_s ?? 0, umbrales, genero });
  return {
    zonas_s: tiempoEnZonas(mini, umbrales.fc_max),
    umbrales: { fc_max: umbrales.fc_max, fc_reposo: umbrales.fc_reposo, fc_umbral: umbrales.fc_umbral, metodo: umbrales.metodo },
    carga: carga?.carga ?? null,
    carga_metodo: carga?.metodo ?? null,
  };
}

/* ------------------------------------------------------------------ */
/* Lo que ya estaba                                                    */
/* ------------------------------------------------------------------ */

const ventanaDe = (e) => {
  const ini = typeof e.inicio === 'number' ? e.inicio : Date.parse(e.inicio);
  const dur = (e.duracion_s ?? 60) * 1000;
  return [ini, ini + Math.max(dur, 60000)];
};

/**
 * ¿Son el mismo entreno? Sí si se encima el 70 % o más del más corto: el reloj y Strava lo guardan con segundos de diferencia en su inicio y en su
 * duración. `a` y `b` son filas (o preparados) con `inicio` y `duracion_s`.
 */
export function esElMismo(a, b) {
  const [a0, a1] = ventanaDe(a);
  const [b0, b1] = ventanaDe(b);
  const encima = Math.min(a1, b1) - Math.max(a0, b0);
  if (encima <= 0) return false;
  return encima / Math.min(a1 - a0, b1 - b0) >= 0.7;
}

/** Lo que un entreno repetido sabe y el otro no (el nombre que le puso en Strava, las calorías del reloj): se le agrega al que se queda. */
const COMPLEMENTOS = ['titulo', 'kcal_activas', 'kcal_totales', 'dispositivo'];
function completaCon(ganador, otro) {
  const g = ganador.fila ?? ganador;
  const o = otro.fila ?? otro;
  COMPLEMENTOS.forEach((campo) => { if (!g[campo] && o[campo]) g[campo] = o[campo]; });
}

/**
 * Separa los entrenos nuevos de los que ya estaban (en la base o repetidos dentro de la misma tanda).
 * Entre dos repetidos de la misma tanda se queda el que trae más datos (pulso, series, distancia y calorías del reloj) y se le agrega lo que el otro sabía y él
 * no (el nombre de Strava, por ejemplo). Devuelve `{ nuevos, repetidos }`.
 */
export function separaRepetidos(nuevos, existentes) {
  const riqueza = (x) => {
    const f = x.fila ?? x;
    return ((f.fc_media || x.resumen?.fc_media || x.calculado?.fc_media) ? 2 : 0) + ((x.series || x.muestras?.length) ? 1 : 0)
      + (f.distancia_m > 0 ? 1 : 0) + ((f.kcal_activas > 0 || f.kcal_totales > 0) ? 1 : 0);
  };
  const aceptados = [];
  const repetidos = [];
  nuevos.forEach((n) => {
    const base = n.fila ?? n;
    if (existentes.some((e) => esElMismo(e, base))) { repetidos.push(n); return; }
    const hermano = aceptados.findIndex((a) => esElMismo(a.fila ?? a, base));
    if (hermano < 0) { aceptados.push(n); return; }
    if (riqueza(n) > riqueza(aceptados[hermano])) { completaCon(n, aceptados[hermano]); repetidos.push(aceptados[hermano]); aceptados[hermano] = n; }
    else { completaCon(aceptados[hermano], n); repetidos.push(n); }
  });
  return { nuevos: aceptados, repetidos };
}
