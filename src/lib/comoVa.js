import {
  cursorAlDia, defaultCursor, isValidCursor, weekOverview,
} from '@/lib/training-utils';

/* «Cómo va» un paciente: el dolor que anota en «Bienestar» (0 a 10) y cuántas
   sesiones lleva esta semana. Todo puro (sin leer la base ni el reloj por su
   cuenta): la ficha, la lista del fisio y la portada del paciente lo usan
   igual, y así se puede probar sin abrir la app. */

const iso = (d) => d.toISOString().slice(0, 10);

/** El dolor anotado, del día más reciente al más viejo. Un 0 también cuenta. */
export function dolorDe(wellness) {
  return Object.entries(wellness ?? {})
    .filter(([, v]) => typeof v?.soreness === 'number')
    .map(([fecha, v]) => ({ fecha, valor: v.soreness }))
    .sort((a, b) => (a.fecha < b.fecha ? 1 : a.fecha > b.fecha ? -1 : 0));
}

/** Lo último que anotó, y con qué valor arrancó en los últimos 14 días (para decir «de 5 a 2»). */
export function resumenDeDolor(wellness, hoy = new Date()) {
  const lista = dolorDe(wellness);
  if (!lista.length) return null;
  const ultimo = lista[0];
  const limite = iso(new Date(hoy.getTime() - 14 * 86400000));
  const ventana = lista.filter((x) => x.fecha >= limite);
  const primero = ventana[ventana.length - 1];
  return { ultimo, desde: primero && primero.fecha !== ultimo.fecha ? primero : null };
}

export function textoDeDolor(resumen) {
  if (!resumen) return 'Sin dolor anotado';
  if (!resumen.desde || resumen.desde.valor === resumen.ultimo.valor) return `Dolor ${resumen.ultimo.valor}`;
  const dias = Math.round((Date.parse(resumen.ultimo.fecha) - Date.parse(resumen.desde.fecha)) / 86400000);
  return `De ${resumen.desde.valor} a ${resumen.ultimo.valor} en ${dias} días`;
}

/** El lunes (a las 00:00, hora local) de la semana de `hoy`. La semana empieza el lunes. */
export function lunesDeEstaSemana(hoy = new Date()) {
  const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate());
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d;
}

/** Cuántas de estas horas (texto ISO) caen en la semana de `hoy`. Lo que no es una fecha se ignora. */
export function hechasEstaSemana(fechas, hoy = new Date()) {
  const desde = lunesDeEstaSemana(hoy).getTime();
  return (fechas ?? []).filter((f) => {
    const t = Date.parse(f);
    return Number.isFinite(t) && t >= desde;
  }).length;
}

/**
 * Las sesiones que le tocan esta semana, según su plan y dónde va.
 * Se cuentan SESIONES y no días: una segunda sesión del mismo día se registra
 * aparte, y contando días saldría «2 de 1 esta semana».
 */
export function esperadasEstaSemana(fases, kind, puntero, hoy = new Date()) {
  if (!fases?.length) return 0;
  const base = isValidCursor(fases, puntero) ? puntero : defaultCursor(fases);
  const cursor = cursorAlDia(fases, base, hoy);
  return weekOverview(fases, kind, cursor, hoy).days.reduce((n, d) => n + d.sesiones, 0);
}

/**
 * La línea de la lista del fisio: «Dolor 3 · 1 de 4 esta semana».
 * `dolor` es el mapa { 'AAAA-MM-DD': valor } que devuelve `estado_resumido`.
 * En la lista solo va lo último («Dolor 2»); el «de 5 a 2» se queda para la ficha.
 */
export function lineaDeLista({ dolor, hechas, esperadas } = {}, hoy = new Date()) {
  const wellness = Object.fromEntries(Object.entries(dolor ?? {}).map(([f, v]) => [f, { soreness: v }]));
  const parteDolor = textoDeDolor(resumenDeDolor(wellness, hoy)).replace(/^De (\d+) a (\d+).*$/, 'Dolor $2');
  const parteSemana = esperadas > 0 ? ` · ${hechasEstaSemana(hechas, hoy)} de ${esperadas} esta semana` : '';
  return parteDolor + parteSemana;
}

/** El alta se anuncia 7 días al paciente: después la tarjeta ya no sale. */
export const altaReciente = (altaEn, ahora = Date.now()) => (
  !!altaEn && ahora - Date.parse(altaEn) <= 7 * 86400000
);
