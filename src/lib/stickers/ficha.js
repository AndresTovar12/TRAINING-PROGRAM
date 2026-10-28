/* LA FICHA DE DATOS DE UN ENTRENO (stickers, Andrés, 28 oct 2026). Ver docs/stickers.md.

   Los stickers NO se guardan: se dibujan al momento con esta ficha. Lo que vive es el entreno. Una sola ficha para toda la app: la fila de «Tus entrenos»,
   la página del entreno, la celebración y los stickers leen lo mismo; un dato que sale en dos lugares es la misma variable.

   Cada dato es `{ k, v, u, l }`: clave, valor ya escrito, unidad y su nombre EN INGLÉS (los textos de los stickers van en inglés; la app, en español).
   Solo existen las claves que el entreno sí tiene: nunca sale «N/A» ni un hueco.

   Este archivo no importa nada de la app (ni `@/`): lo cargan tal cual las pruebas de Node (`scripts/prueba-stickers.mjs`). */
import { miles, relojTexto, ritmoTexto } from '../metricas/formato.js';
import { filasPorSerie } from '../metricas/porSerie.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const dos = (n) => String(n).padStart(2, '0');

const MESES_ING = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MESES_LARGOS_ING = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const DIA_MS = 86400000;

/* El día LOCAL de quien entrenó (`desfaseMin`: la diferencia con UTC que guardó su teléfono; sin ella, la del teléfono de quien mira).
   `n` es el número de día desde 1970: dos fechas con el mismo `n` son el mismo día; `sem` es 0 el lunes … 6 el domingo. */
function diaLocal(ms, desfaseMin) {
  if (num(ms) === null) return null;
  const x = num(desfaseMin) !== null ? new Date(ms + desfaseMin * 60000) : null;
  const [y, m, d, dow, h, mi] = x
    ? [x.getUTCFullYear(), x.getUTCMonth(), x.getUTCDate(), x.getUTCDay(), x.getUTCHours(), x.getUTCMinutes()]
    : (() => { const t = new Date(ms); return [t.getFullYear(), t.getMonth(), t.getDate(), t.getDay(), t.getHours(), t.getMinutes()]; })();
  return { y, m, d, h, mi, n: Math.round(Date.UTC(y, m, d) / DIA_MS), sem: (dow + 6) % 7 };
}

/** «Oct 9»: la fecha corta en inglés de un entreno anterior. */
const fechaEn = (ms, desfaseMin) => { const l = diaLocal(ms, desfaseMin); return l ? `${MESES_ING[l.m]} ${l.d}` : null; };

/** «1h 05» o «45 min»: cuánto, en inglés corto. */
const duracionEn = (seg) => { const m = Math.round(seg / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${dos(m % 60)}` : `${Math.max(1, m)} min`; };
/** El nombre en inglés de cada deporte, para el título del sticker («Morning run»). Una actividad propia («Pádel») va como la escribió la persona. */
const EN = {
  correr: 'Run', caminar: 'Walk', senderismo: 'Hike', trail: 'Trail', bici: 'Ride', natacion: 'Swim', remo: 'Row', eliptica: 'Elliptical',
  fuerza: 'Lift', gym: 'Lift', yoga: 'Yoga', hiit: 'HIIT',
};
/** Con ritmo por kilómetro (los demás de distancia van en velocidad o en ritmo por 100 m). */
const A_PIE = new Set(['correr', 'caminar', 'senderismo', 'trail']);
/** Un largo de alberca, si no se sabe otro. */
export const LARGO_DE_ALBERCA_M = 25;

/* ¿HAY RUTA? (sección 8b de la especificación). La línea sale solo si el recorrido suma más de 300 m o el punto más lejano queda a más de 150 m del inicio:
   un gym, un pádel o un yoga no dibujan un garabato. La ruta NO se vuelve dato: no da «Distance» ni «Pace» (esos salen de la distancia del entreno). */
export const RUTA_MINIMA_M = 300;
export const ALEJAMIENTO_MINIMO_M = 150;

function metros(a, b) {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
}

/** La ruta como `{ lat: [], lon: [] }` desde cualquiera de sus formas (la de las series del reloj, `[{lat, lon}]` del entreno libre). `null` si no alcanza. */
export function rutaDe(origen) {
  const lat = [];
  const lon = [];
  if (Array.isArray(origen)) {
    origen.forEach((p) => { if (num(p?.lat) !== null && num(p?.lon) !== null) { lat.push(p.lat); lon.push(p.lon); } });
  } else if (origen && Array.isArray(origen.lat) && Array.isArray(origen.lon)) {
    const n = Math.min(origen.lat.length, origen.lon.length);
    for (let i = 0; i < n; i += 1) if (num(origen.lat[i]) !== null && num(origen.lon[i]) !== null) { lat.push(origen.lat[i]); lon.push(origen.lon[i]); }
  }
  if (lat.length < 2) return null;
  let total = 0;
  let lejos = 0;
  const inicio = { lat: lat[0], lon: lon[0] };
  for (let i = 1; i < lat.length; i += 1) {
    const p = { lat: lat[i], lon: lon[i] };
    total += metros({ lat: lat[i - 1], lon: lon[i - 1] }, p);
    lejos = Math.max(lejos, metros(inicio, p));
  }
  if (total <= RUTA_MINIMA_M && lejos <= ALEJAMIENTO_MINIMO_M) return null;
  return { lat, lon };
}

/** Lo que el entreno guiado midió solo: series hechas, ejercicios, volumen (Σ series × reps × kg) y la lista de ejercicios. `null` si no hizo nada. */
export function guiadoDe(registro) {
  if (!registro) return null;
  const { filas } = filasPorSerie({ registro });
  const series = filas.filter((f) => f.tipo === 'serie' || f.tipo === 'lapso');
  if (!series.length) return null;
  let volumen = 0;
  const porEjercicio = new Map();
  series.forEach((f) => {
    const reps = parseFloat(String(f.reps ?? '').replace(',', '.'));
    if (f.tipo === 'serie' && num(f.kg) > 0 && reps > 0) volumen += f.kg * reps;
    const nombre = String(f.nombre ?? '').trim() || 'Exercise';
    const e = porEjercicio.get(nombre) ?? { n: nombre, s: 0, r: null, kg: null, seg: null };
    e.s += 1;
    if (reps > 0) e.r = reps;
    if (num(f.kg) > 0) e.kg = Math.max(e.kg ?? 0, f.kg);
    if (num(f.durS) > 0 && !(reps > 0)) e.seg = Math.round(f.durS);
    porEjercicio.set(nombre, e);
  });
  return { series: series.length, ejercicios: porEjercicio.size, volumen: Math.round(volumen), lista: [...porEjercicio.values()] };
}

/** «Morning» antes de las 12, «Afternoon» antes de las 18, «Evening» después. */
const momentoDe = (h) => (h < 12 ? 'Morning' : h < 18 ? 'Afternoon' : 'Evening');

/**
 * LA FICHA. `entreno`, ya normalizado (ver `entrenoDeActividad` y `entrenoDeSesion`):
 *   { deporte, inicioMs, desfaseMin, duracionS, distanciaM, fcMedia, kcal, desnivelM, ruta, splits, zonasS, guiado, tipo: { nombre, icono },
 *     nombre, nombreEn, coach, plan, record, racha, unidadPeso }
 * Devuelve `{ datos, hora, fecha, nombre, en, titulo, tipo, coach, plan, ruta, splits, lista, sinDistancia, zonas, record, racha }`.
 */
export function ficha(entreno) {
  const e = entreno ?? {};
  const datos = {};
  const d = (k, v, u, l) => { datos[k] = { k, v: String(v), u, l }; };
  const dep = e.deporte ?? 'otro';
  const dist = num(e.distanciaM);
  const dur = num(e.duracionS);
  const nado = dep === 'natacion';

  if (dist !== null && dist >= 100) d('dist', nado ? miles(dist) : (dist / 1000).toFixed(2), nado ? 'm' : 'km', 'Distance');
  if (dur !== null && dur >= 1) {
    d('tiempo', relojTexto(dur), '', 'Time');
    const m = Math.round(dur / 60);
    if (dur >= 3600) d('min', `${Math.floor(dur / 3600)}h ${dos(Math.round((dur % 3600) / 60))}`, '', 'Time');
    else d('min', String(Math.max(1, m)), 'min', 'Time');
  }
  if (dist !== null && dur > 0) {
    if (A_PIE.has(dep) && dist >= 1000) {
      const p = ritmoTexto(num(e.ritmoSKm) ?? (dur / dist) * 1000);
      if (p !== '—') d('ritmo', p, '/km', 'Pace');
    } else if (nado && dist >= 100) {
      d('ritmo', relojTexto((dur / dist) * 100), '/100m', 'Pace');
    } else if (dep === 'bici' && dist >= 100) {
      d('vel', ((dist / dur) * 3.6).toFixed(1), 'km/h', 'Speed');
    }
  }
  if (num(e.fcMedia) > 0) d('fc', Math.round(e.fcMedia), 'bpm', 'Heart rate');
  if (num(e.kcal) > 0) d('kcal', miles(e.kcal), 'kcal', 'Calories');
  if (num(e.desnivelM) > 0) d('elev', Math.round(e.desnivelM), 'm', 'Elevation');
  const g = e.guiado;
  if (g?.series > 0) d('series', g.series, 'sets', 'Sets');
  if (g?.ejercicios > 0) d('ejercicios', g.ejercicios, '', 'Exercises');
  if (g?.volumen > 0) d('volumen', miles(g.volumen), e.unidadPeso === 'lb' ? 'lb' : 'kg', 'Volume');
  if (nado && dist !== null && dist >= 100) d('largos', Math.round(dist / LARGO_DE_ALBERCA_M), '', 'Lengths');

  // La hora y la fecha LOCALES de quien entrenó (`desfaseMin`: la diferencia con UTC que guardó su teléfono; sin ella, la del teléfono de quien mira).
  const inicio = num(e.inicioMs) ?? Date.now();
  const local = num(e.desfaseMin) !== null ? new Date(inicio + e.desfaseMin * 60000) : null;
  const h = local ? local.getUTCHours() : new Date(inicio).getHours();
  const mi = local ? local.getUTCMinutes() : new Date(inicio).getMinutes();
  const [anio, mes, dia] = local ? [local.getUTCFullYear(), local.getUTCMonth(), local.getUTCDate()] : (() => { const x = new Date(inicio); return [x.getFullYear(), x.getMonth(), x.getDate()]; })();

  const nombre = String(e.nombre ?? '').trim() || 'Workout';
  const en = e.nombreEn || EN[dep] || nombre;
  const ruta = rutaDe(e.ruta);
  const tipo = e.tipo?.nombre ? { nombre: String(e.tipo.nombre), icono: e.tipo.icono ?? null } : { nombre, icono: null };
  const hist = historialDe(e, inicio, tipo);
  const perfil = (Array.isArray(e.perfil) ? e.perfil : []).filter((v) => num(v) !== null);
  return {
    datos,
    hora: { v: `${h % 12 || 12}:${dos(mi)}`, u: h < 12 ? 'am' : 'pm' },
    fecha: `${MESES_ING[mes]} ${dia}, ${anio}`,
    nombre,
    en,
    titulo: [momentoDe(h), en],
    tipo,
    coach: e.plan && e.coach ? e.coach : null,
    plan: !!e.plan,
    ruta,
    splits: Array.isArray(e.splits) && e.splits.length >= 2 ? e.splits : null,
    lista: g?.lista?.length ? g.lista : null,
    sinDistancia: !datos.dist && !datos.series,
    zonas: Array.isArray(e.zonasS) && e.zonasS.some((z) => z > 0) ? porcentajes(e.zonasS) : null,
    record: recordEn(e.record, datos, en),
    racha: hist.racha,
    semana: hist.semana,
    mes: hist.mes,
    perfil: perfil.length >= 10 ? perfil : null,
  };
}

/*
 * LA SEMANA, EL MES Y LA RACHA (stickers Semana, Mes, Racha del tipo, Semana con íconos y Mes por tipo). `e.historial`: los entrenos de la persona de este año
 * (`[{ id, inicioMs, desfaseMin, duracionS, distanciaM, tipo: { nombre, icono } }]`, ver `lib/stickers/carga.js`). Este entreno cuenta siempre, venga o no en la lista.
 *   · semana: la semana (lunes a domingo) de este entreno: `{ total, min, dias: [[tipos] × 7], hoy }` (`hoy`: el día de este entreno, 0 = lunes).
 *   · mes: el mes de este entreno: `{ nombre: 'October', total, min, distM, porTipo: [{ tipo, n }] }` (los 5 tipos con más entrenos).
 *   · racha: cuántas veces este año del mismo tipo, contando esta.
 */
function historialDe(e, inicio, tipo) {
  const yo = { id: e.id ?? null, inicioMs: inicio, desfaseMin: e.desfaseMin, duracionS: num(e.duracionS) ?? 0, distanciaM: num(e.distanciaM) ?? 0, tipo };
  const lista = (Array.isArray(e.historial) ? e.historial : []).filter((x) => num(x?.inicioMs) !== null);
  const todos = yo.id !== null && lista.some((x) => x.id === yo.id) ? lista.map((x) => (x.id === yo.id ? yo : x)) : [...lista, yo];
  const hoy = diaLocal(inicio, e.desfaseMin);
  const lunes = hoy.n - hoy.sem;
  const conDia = todos.map((x) => ({ ...x, dia: diaLocal(x.inicioMs, x.desfaseMin ?? e.desfaseMin) })).filter((x) => x.dia);
  const deLaSemana = conDia.filter((x) => x.dia.n >= lunes && x.dia.n < lunes + 7).sort((a, b) => a.inicioMs - b.inicioMs);
  const dias = Array.from({ length: 7 }, (_, i) => deLaSemana.filter((x) => x.dia.n === lunes + i).map((x) => x.tipo ?? null));
  const delMes = conDia.filter((x) => x.dia.y === hoy.y && x.dia.m === hoy.m);
  const porTipo = new Map();
  delMes.forEach((x) => {
    const k = x.tipo?.nombre ?? 'Workout';
    porTipo.set(k, { tipo: x.tipo ?? { nombre: k, icono: null }, n: (porTipo.get(k)?.n ?? 0) + 1 });
  });
  const suma = (l, k) => l.reduce((t, x) => t + (num(x[k]) ?? 0), 0);
  return {
    semana: { total: deLaSemana.length, min: Math.round(suma(deLaSemana, 'duracionS') / 60), dias, hoy: hoy.sem },
    mes: { nombre: MESES_LARGOS_ING[hoy.m], total: delMes.length, min: Math.round(suma(delMes, 'duracionS') / 60), distM: suma(delMes, 'distanciaM'), porTipo: [...porTipo.values()].sort((a, b) => b.n - a.n).slice(0, 5) },
    racha: conDia.filter((x) => x.dia.y === hoy.y && x.inicioMs <= inicio && (x.tipo?.nombre ?? '') === tipo.nombre).length,
  };
}

/*
 * EL RÉCORD EN INGLÉS para los stickers (Titular · récord y Récord), de lo que dio `recordDe` (`lib/resumenLibre.js`; solo sin plan, decisión 1.11).
 * `{ titulo: ['Run', 'PR'], en: 'Longest distance', grande: { v, u }, det: '1.10 km more than your best on Oct 9' }`. «La primera vez» no es récord: no hay contra qué.
 */
function recordEn(r, datos, en) {
  if (!r || !r.tipo || r.tipo === 'primera') return null;
  const cuando = r.antesInicio ? fechaEn(Date.parse(r.antesInicio), r.antesDesfase) : null;
  const contra = cuando ? ` than your best on ${cuando}` : '';
  const base = { titulo: [en, 'PR'] };
  if (r.tipo === 'distancia' && datos.dist) {
    const dif = num(r.difNum);
    const t = dif === null ? null : dif < 1000 ? `${Math.round(dif)} m` : `${(dif / 1000).toFixed(2)} km`;
    return { ...base, en: 'Longest distance', grande: datos.dist, det: t ? `${t} more${contra}` : '' };
  }
  if (r.tipo === 'ritmo' && datos.ritmo) {
    return { ...base, en: 'Fastest pace', grande: datos.ritmo, det: num(r.difNum) !== null ? `${Math.round(r.difNum)} s/km faster${contra}` : '' };
  }
  if (r.tipo === 'tiempo' && datos.tiempo) {
    return { ...base, en: 'Longest workout', grande: datos.tiempo, det: num(r.difNum) !== null ? `${duracionEn(r.difNum)} longer${contra}` : '' };
  }
  return null;
}

const porcentajes = (zonas) => {
  const total = zonas.reduce((s, z) => s + (num(z) ?? 0), 0);
  return total > 0 ? zonas.map((z) => Math.round(((num(z) ?? 0) / total) * 100)) : null;
};

/** Los segundos por km de cada kilómetro ENTERO (de `vueltas`, como las guarda el motor de métricas). */
export const splitsDe = (vueltas) => (vueltas ?? [])
  .filter((v) => v?.tipo === 'km' && v.dist >= 990 && v.dur > 0)
  .map((v) => num(v.ritmo) ?? Math.round((v.dur / v.dist) * 1000));

/**
 * Un entreno de la tabla `actividades` (libre, del reloj o importado). `fila`: la fila. `series`: sus series (la ruta, si se guardó). `muestras`: la ruta recién
 * medida (`[{lat, lon}]`). `sesion`: el registro de la sesión guiada que se hizo a la vez (series y kilos). `tipo`: `{ nombre, icono }`.
 */
export function entrenoDeActividad({ fila, series = null, muestras = null, registro = null, tipo = null, nombre = null, plan = false, coach = null, record = null, unidadPeso = 'kg', historial = null }) {
  if (!fila) return null;
  return {
    id: fila.id ?? null,
    historial,
    perfil: Array.isArray(series?.alt) ? series.alt : null,
    deporte: fila.deporte,
    inicioMs: Date.parse(fila.inicio),
    desfaseMin: num(fila.desfase_min),
    duracionS: num(fila.duracion_s),
    distanciaM: num(fila.distancia_m),
    ritmoSKm: num(fila.metricas?.ritmo_medio_s_km),
    fcMedia: num(fila.fc_media),
    kcal: num(fila.kcal_activas) > 0 ? fila.kcal_activas : num(fila.kcal_totales),
    desnivelM: num(fila.desnivel_pos_m),
    ruta: Array.isArray(muestras) && muestras.length >= 2 ? muestras : series?.ruta ?? null,
    splits: splitsDe(fila.vueltas),
    zonasS: fila.zonas_s ?? null,
    guiado: guiadoDe(registro),
    tipo,
    nombre: nombre ?? fila.titulo ?? null,
    plan,
    coach,
    record,
    unidadPeso,
  };
}

/** Una sesión GUIADA del plan sin reloj: lo que la app midió sola (tiempo de la sesión, series, ejercicios y kilos), más su recorrido si lo guardó. */
export function entrenoDeSesion({ registro, inicioMs, finMs, tipo = null, nombre = null, deporte = 'fuerza', plan = true, coach = null, unidadPeso = 'kg', id = null, historial = null }) {
  return {
    id,
    historial,
    deporte,
    inicioMs,
    desfaseMin: null,
    duracionS: num(inicioMs) !== null && num(finMs) !== null ? Math.round((finMs - inicioMs) / 1000) : null,
    distanciaM: null,
    ruta: registro?.ruta ?? null,
    guiado: guiadoDe(registro),
    tipo,
    nombre,
    nombreEn: deporte === 'fuerza' ? 'Lift' : null,
    plan,
    coach,
    record: null,
    unidadPeso,
  };
}
