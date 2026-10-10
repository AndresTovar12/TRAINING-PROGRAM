/* LOS DATOS DEL SELLO: qué números lleva cada sello y de dónde salen.

   Andrés, 10 oct 2026 («sello» para Instagram, a la Strava). Reglas que él dijo:
     · Cardio: siempre «Distance, Pace, Time». Todo lo demás: «Time, Avg heart rate, Calories». Textos SIEMPRE en inglés.
     · Con GPS, el sello lleva la ruta; si no hay ruta (todo lo que no es cardio, o cardio sin GPS) lleva solo el ícono del tipo de sesión.
     · Un entreno mixto (Hyrox, un circuito con carrera) ofrece los DOS sellos y el atleta escoge el que se ve mejor.
   Decisiones mías, sin preguntarle (están en docs/sello.md): el ritmo es min/km al correr y caminar, km/h en bici y elíptica («Speed»), min/100 m en natación y
   min/500 m en remo; sin reloj no hay pulso ni calorías (los dos vienen del reloj), así que el sello lleva lo que la app sí sabe: tiempo, series y kilos totales.

   Este archivo no pinta nada y no importa nada de la app (ni `@/`): lo cargan tal cual las pruebas de Node. Devuelve:
     { sellos: [{ id: 'cardio' | 'general', titulo, filas: [{ label, valor, unidad }], ruta: { lat, lon } | null }] }
   con el sello de cardio primero cuando son dos. `sellos` puede venir vacío: no hay con qué armar ni siquiera el tiempo. */
import { miles, relojTexto, ritmoTexto } from '../metricas/formato.js';
import { filasPorSerie } from '../metricas/porSerie.js';

/** Los deportes que son cardio puro: su sello es el de cardio y nada más (si tienen distancia). */
export const DEPORTES_DE_CARDIO = new Set(['correr', 'caminar', 'senderismo', 'bici', 'natacion', 'remo', 'eliptica']);
/** Con menos metros que esto no hay «Distance» que enseñar. */
export const MINIMO_DE_CARDIO_M = 100;
/** Un entreno que NO es cardio puro ofrece también el sello de cardio si hizo al menos 1 km. */
export const MINIMO_DE_MIXTO_M = 1000;

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);

/** El tiempo de un sello: «43:48» + «min», o «1:12:30» sin unidad cuando pasa de la hora. */
export function tiempoDelSello(seg) {
  const s = num(seg);
  if (s === null || s < 1) return null;
  return { label: 'Time', valor: relojTexto(s), unidad: s >= 3600 ? '' : 'min' };
}

/** La ruta que guardó el reloj (`series.ruta`), o `null` si no hay al menos dos puntos. */
export function rutaDeSeries(series) {
  const r = series?.ruta;
  if (!r || !Array.isArray(r.lat) || !Array.isArray(r.lon)) return null;
  const n = Math.min(r.lat.length, r.lon.length);
  return n >= 2 ? { lat: r.lat.slice(0, n), lon: r.lon.slice(0, n) } : null;
}

/** Distance y Pace (o Speed) de un entreno del reloj. `null` si no hizo ni 100 m. */
function filasDeCardio(fila) {
  const d = num(fila.distancia_m);
  if (d === null || d < MINIMO_DE_CARDIO_M) return null;
  const seg = num(fila.movimiento_s) > 0 ? fila.movimiento_s : num(fila.duracion_s);
  const dep = fila.deporte;
  const filas = [];
  filas.push(dep === 'natacion'
    ? { label: 'Distance', valor: miles(d), unidad: 'm' }
    : { label: 'Distance', valor: (d / 1000).toFixed(2), unidad: 'km' });
  if (seg > 0) {
    if (dep === 'correr' || dep === 'caminar' || dep === 'senderismo') {
      const p = ritmoTexto(num(fila.metricas?.ritmo_medio_s_km) ?? (seg / d) * 1000);
      if (p !== '—') filas.push({ label: 'Pace', valor: p, unidad: '/km' });
    } else if (dep === 'natacion') {
      filas.push({ label: 'Pace', valor: relojTexto((seg / d) * 100), unidad: '/100 m' });
    } else if (dep === 'remo') {
      filas.push({ label: 'Pace', valor: relojTexto((seg / d) * 500), unidad: '/500 m' });
    } else {
      filas.push({ label: 'Speed', valor: ((d / seg) * 3.6).toFixed(1), unidad: 'km/h' });
    }
  }
  const t = tiempoDelSello(fila.duracion_s);
  if (t) filas.push(t);
  return filas;
}

/** Lo que la app sabe de una sesión GUIADA aunque no haya reloj: cuántas series y cuántos kilos movió en total. */
export function filasDeLoGuiado(registro, unidadPeso = 'kg') {
  if (!registro) return [];
  const { filas, resumen } = filasPorSerie({ registro });
  const hechas = (resumen?.series ?? 0) + (resumen?.lapsos ?? 0);
  let total = 0;
  filas.forEach((f) => {
    if (f.tipo !== 'serie') return;
    const reps = parseFloat(String(f.reps ?? '').replace(',', '.'));
    if (num(f.kg) > 0 && reps > 0) total += f.kg * reps;
  });
  const salida = [];
  if (hechas > 0) salida.push({ label: 'Sets', valor: String(hechas), unidad: '' });
  if (total > 0) salida.push({ label: 'Total volume', valor: miles(total), unidad: unidadPeso === 'lb' ? 'lb' : 'kg' });
  return salida;
}

/** Time, Avg heart rate y Calories de un entreno del reloj; lo que falte se completa con lo guiado hasta tener tres. */
function filasGenerales(fila, sesion, unidadPeso) {
  const filas = [];
  const t = tiempoDelSello(fila.duracion_s);
  if (t) filas.push(t);
  if (num(fila.fc_media) > 0) filas.push({ label: 'Avg heart rate', valor: String(Math.round(fila.fc_media)), unidad: 'bpm' });
  const kcal = num(fila.kcal_activas) > 0 ? fila.kcal_activas : num(fila.kcal_totales);
  if (kcal > 0) filas.push({ label: 'Calories', valor: String(Math.round(kcal)), unidad: 'kcal' });
  if (filas.length < 3 && sesion?.registro) filas.push(...filasDeLoGuiado(sesion.registro, unidadPeso));
  return filas.slice(0, 3);
}

/**
 * Los sellos de un entreno del reloj (`fila`: la fila de `actividades`; `series`: sus series, para la ruta; `sesion`: la sesión guiada que se hizo a la vez, si la hubo).
 */
export function sellosDeActividad({ fila, series = null, sesion = null, unidadPeso = 'kg' }) {
  if (!fila) return { sellos: [] };
  const sellos = [];
  const esCardio = DEPORTES_DE_CARDIO.has(fila.deporte);
  const cardio = filasDeCardio(fila);
  if (cardio && (esCardio || fila.distancia_m >= MINIMO_DE_MIXTO_M)) {
    sellos.push({ id: 'cardio', titulo: 'Cardio', filas: cardio, ruta: rutaDeSeries(series) });
  }
  if (!esCardio || !cardio) {
    const filas = filasGenerales(fila, sesion, unidadPeso);
    if (filas.length) sellos.push({ id: 'general', titulo: 'General', filas, ruta: null });
  }
  return { sellos };
}

/** El sello de una sesión guiada SIN reloj: tiempo, series y kilos totales (lo único que la app midió sola). `inicio` y `fin` en milisegundos. */
export function sellosDeSesionGuiada({ registro, inicio, fin, unidadPeso = 'kg' }) {
  const filas = [];
  const t = tiempoDelSello(Number.isFinite(inicio) && Number.isFinite(fin) ? (fin - inicio) / 1000 : null);
  if (t) filas.push(t);
  filas.push(...filasDeLoGuiado(registro, unidadPeso));
  return { sellos: filas.length ? [{ id: 'general', titulo: 'General', filas: filas.slice(0, 3), ruta: null }] : [] };
}
