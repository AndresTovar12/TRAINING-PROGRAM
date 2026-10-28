/* EL CATÁLOGO DE STICKERS Y EL MOTOR DE RANURAS (Andrés, 28 oct 2026). Ver docs/stickers.md.

   RANURAS CON SUPLENTES: cada sticker tiene ranuras; cada ranura trae una lista de datos en orden de preferencia y toma el PRIMERO que el entreno tenga.
   Un sticker solo desaparece si una ranura obligatoria se queda sin dato (los de ruta sin GPS). Un mismo dato no se repite dentro de un sticker (dos ranuras
   no pueden mostrar «Time» las dos). Así sirve para cualquier actividad, incluso las que invente el coach, y nunca sale un «N/A».

   Aquí solo están los datos de cada sticker (forma, familia, ranuras); cómo se dibuja vive en `features/stickers/Sticker.jsx`.
   Los 35 de la tabla de la especificación (fase 1: 6; fase 2: los otros 29), en su orden. El volumen solo entra en «Lista» y «Columna».

   Este archivo no importa nada de la app: lo cargan las pruebas de Node (`scripts/prueba-stickers.mjs`). */

// Preferencias compartidas.
export const PREF_GRANDE = ['dist', 'series', 'min', 'kcal'];
export const PREF = ['dist', 'series', 'tiempo', 'ritmo', 'vel', 'ejercicios', 'kcal', 'fc', 'elev', 'largos'];
export const PREF_CON_VOLUMEN = ['dist', 'series', 'tiempo', 'volumen', 'ritmo', 'vel', 'kcal', 'fc', 'elev', 'ejercicios'];

/** Los lienzos: ancho 300 × 200, alto 300 × 330, historia 300 × 533 (Con foto). Se exportan a 3×. */
export const LIENZOS = { ancho: { w: 300, h: 200 }, alto: { w: 300, h: 330 }, historia: { w: 300, h: 533 } };

/** Los cuatro colores de la hoja: la TINTA del sticker y su ACENTO (unidades, «Lab», el dato destacado). Fondo transparente siempre. */
export const COLORES = [
  { id: 'blanco', nombre: 'Blanco', tinta: '#FFFFFF', acento: '#3578FF', sombra: true, clara: false },
  { id: 'negro', nombre: 'Negro', tinta: '#0B0D12', acento: '#3578FF', sombra: false, clara: true },
  { id: 'azul', nombre: 'Azul', tinta: '#3578FF', acento: '#FFFFFF', sombra: false, clara: false },
  { id: 'coral', nombre: 'Coral', tinta: '#FF6B4A', acento: '#FFFFFF', sombra: false, clara: false },
];

/**
 * Cada sticker: `id`, `nombre`, `familia` (identidad, datos, tipo), `forma` (ancho | alto), `identidad` (también sale en «Con foto»),
 * `ranuras` ({ nombre: [claves] }), `elige` ([claves, n, mín.]) y `obliga(f)` (lo que no puede faltar). El orden es el de la tabla de la especificación.
 */
export const STICKERS = [
  // Identidad: la tipografía es la marca.
  { id: 'titular', nombre: 'Titular', familia: 'identidad', forma: 'alto', identidad: true,
    ranuras: { a: ['dist', 'series', 'min'], b: ['tiempo', 'kcal', 'ejercicios'], c: ['ritmo', 'vel', 'fc', 'kcal', 'ejercicios', 'largos'] } },
  { id: 'titular-pr', nombre: 'Titular · récord', familia: 'identidad', forma: 'alto', identidad: true, obliga: (f) => !!f.record,
    ranuras: { a: ['dist', 'series', 'min'], b: ['tiempo', 'kcal'] } },
  { id: 'firma', nombre: 'Firma', familia: 'identidad', forma: 'ancho', identidad: true, ranuras: { g: PREF_GRANDE } },
  { id: 'eco', nombre: 'Eco', familia: 'identidad', forma: 'alto', identidad: true, ranuras: { g: PREF_GRANDE } },
  // Datos: el formato de los datos, con criterio propio.
  { id: 'grande', nombre: 'Grande', familia: 'datos', forma: 'ancho', identidad: true, ranuras: { g: ['dist', 'tiempo', 'kcal'] } },
  { id: 'fila', nombre: 'Fila', familia: 'datos', forma: 'ancho', elige: [PREF, 3] },
  { id: 'columna', nombre: 'Columna', familia: 'datos', forma: 'alto', elige: [PREF_CON_VOLUMEN, 4, 3] },
  { id: 'escalera', nombre: 'Escalera', familia: 'datos', forma: 'alto', elige: [PREF, 3] },
  { id: 'frase', nombre: 'Frase', familia: 'datos', forma: 'alto', obliga: (f) => !!f.datos.min },
  { id: 'ruta-dato', nombre: 'Ruta y dato', familia: 'datos', forma: 'alto', obliga: (f) => !!f.ruta,
    ranuras: { g: ['dist', 'tiempo'] }, elige: [['tiempo', 'ritmo', 'vel', 'kcal', 'fc'], 2, 1] },
  { id: 'mejor-km', nombre: 'Tu mejor kilómetro', familia: 'datos', forma: 'alto', obliga: (f) => !!f.ruta && !!f.splits },
  { id: 'esquinas', nombre: 'Esquinas', familia: 'datos', forma: 'alto', obliga: (f) => !!f.ruta, elige: [PREF, 4] },
  { id: 'parciales', nombre: 'Parciales', familia: 'datos', forma: 'ancho', obliga: (f) => !!f.splits && f.splits.length <= 12, ranuras: { r: ['ritmo'] } },
  { id: 'seis', nombre: 'Seis', familia: 'datos', forma: 'alto', elige: [PREF, 6, 5] },
  { id: 'ruta-escrita', nombre: 'Ruta escrita', familia: 'datos', forma: 'alto', obliga: (f) => !!f.ruta, elige: [['dist', 'tiempo', 'ritmo', 'vel'], 3, 2] },
  { id: 'regla', nombre: 'Regla', familia: 'datos', forma: 'ancho', obliga: (f) => !!f.splits && f.splits.length <= 10, ranuras: { g: ['dist'], t: ['tiempo'] } },
  { id: 'hora', nombre: 'Hora', familia: 'datos', forma: 'ancho', elige: [['dist', 'series', 'tiempo', 'kcal'], 2, 1] },
  { id: 'zonas', nombre: 'Zonas', familia: 'datos', forma: 'ancho', obliga: (f) => !!f.zonas },
  { id: 'elevacion', nombre: 'Elevación', familia: 'datos', forma: 'ancho', ranuras: { g: ['elev'] } },
  { id: 'record', nombre: 'Récord', familia: 'datos', forma: 'ancho', obliga: (f) => !!f.record },
  { id: 'largos', nombre: 'Largos', familia: 'datos', forma: 'alto', obliga: (f) => !!f.datos.largos && Number(f.datos.largos.v) <= 100,
    ranuras: { g: ['dist'], l: ['largos'], p: ['ritmo', 'tiempo'] } },
  { id: 'partido', nombre: 'Partido', familia: 'datos', forma: 'ancho', obliga: (f) => f.sinDistancia && !!f.datos.min, elige: [['kcal', 'fc', 'tiempo'], 2, 0] },
  { id: 'lista', nombre: 'Lista', familia: 'datos', forma: 'alto', obliga: (f) => !!f.lista, ranuras: { g: ['volumen', 'series'], s: ['series', 'tiempo'] } },
  { id: 'semana', nombre: 'Semana', familia: 'datos', forma: 'ancho' },
  { id: 'mes', nombre: 'Mes', familia: 'datos', forma: 'ancho' },
  // Tipo: el ícono que eligió el coach (o el de la actividad, en un entreno libre).
  { id: 'icono-numero', nombre: 'Ícono y número', familia: 'tipo', forma: 'ancho', ranuras: { g: ['tiempo', 'dist', 'series'] } },
  { id: 'titular-icono', nombre: 'Titular con ícono', familia: 'tipo', forma: 'ancho', elige: [PREF, 3, 2] },
  { id: 'icono-gigante', nombre: 'Ícono gigante', familia: 'tipo', forma: 'alto', ranuras: { g: ['tiempo', 'dist', 'series'] } },
  { id: 'cada-serie', nombre: 'Cada serie, un ícono', familia: 'tipo', forma: 'alto', obliga: (f) => !!f.datos.series && Number(f.datos.series.v) <= 40,
    ranuras: { g: ['series'], s: ['tiempo', 'ejercicios'] } },
  { id: 'cada-km', nombre: 'Cada kilómetro, un ícono', familia: 'tipo', forma: 'alto',
    obliga: (f) => !!f.datos.dist && f.datos.dist.u === 'km' && Number(f.datos.dist.v) >= 1 && Number(f.datos.dist.v) <= 25, ranuras: { g: ['dist'] } },
  { id: 'sello', nombre: 'Sello', familia: 'tipo', forma: 'alto', ranuras: { g: ['dist', 'tiempo', 'series'] } },
  { id: 'hoy-toco', nombre: 'Lo que tocó hoy', familia: 'tipo', forma: 'alto', obliga: (f) => f.plan, ranuras: { g: ['series', 'tiempo'] } },
  { id: 'racha', nombre: 'Racha del tipo', familia: 'tipo', forma: 'ancho', obliga: (f) => f.racha >= 2 },
  { id: 'semana-iconos', nombre: 'Semana con íconos', familia: 'tipo', forma: 'ancho' },
  { id: 'mes-por-tipo', nombre: 'Mes por tipo', familia: 'tipo', forma: 'ancho' },
];

/** Ranuras: `{ nombre: [claves en orden] }`. Devuelve `null` si una ranura se queda vacía. Un mismo dato (por su nombre) no se repite dentro del sticker. */
export function resuelve(f, ranuras, usados = new Set()) {
  const r = {};
  for (const [n, claves] of Object.entries(ranuras)) {
    const k = claves.find((c) => f.datos[c] && !usados.has(f.datos[c].l));
    if (!k) return null;
    r[n] = f.datos[k];
    usados.add(f.datos[k].l);
  }
  return r;
}

/** Hasta `n` datos distintos en orden de preferencia; `null` si no llega a `min`. */
export function elige(f, claves, n, min = n, usados = new Set()) {
  const out = [];
  for (const c of claves) {
    const d = f.datos[c];
    if (d && !usados.has(d.l)) { out.push(d); usados.add(d.l); if (out.length === n) break; }
  }
  return out.length >= min ? out : null;
}

/**
 * El catálogo de UN entreno: los stickers que sí tienen sus datos, con sus ranuras ya resueltas, en el orden de la tabla.
 * Cada uno: `{ id, nombre, familia, forma, identidad, r }` (`r`: lo resuelto; con `elige` y `ranuras` a la vez, la lista va en `r.lista`).
 */
export function catalogo(f, lista = STICKERS) {
  const salida = [];
  for (const s of lista) {
    if (s.obliga && !s.obliga(f)) continue;
    const usados = new Set();
    let r = {};
    if (s.ranuras) { r = resuelve(f, s.ranuras, usados); if (!r) continue; }
    if (s.elige) {
      const [claves, n, min] = s.elige;
      const l = elige(f, claves, n, min ?? n, usados);
      if (!l) continue;
      if (s.ranuras) r.lista = l; else r = l;
    }
    salida.push({ id: s.id, nombre: s.nombre, familia: s.familia, forma: s.forma, identidad: !!s.identidad, r });
  }
  return salida;
}

/** La frase corta debajo del número grande: «27:14 at 5:27/km», «48:05 · 610 kcal», «48:05 · Fuerza». Nunca repite el número de arriba. */
export function fraseCorta(f, usado) {
  const d = f.datos;
  const resto = ['tiempo', 'ritmo', 'vel', 'series', 'kcal', 'fc'].map((k) => d[k]).filter((x) => x && x.l !== usado?.l);
  const t = resto.find((x) => x.l === 'Time');
  const p = resto.find((x) => x.l === 'Pace' || x.l === 'Speed');
  const o = resto.find((x) => x.l !== 'Time' && x.l !== 'Pace' && x.l !== 'Speed');
  if (t && p) return `${t.v} at ${p.v}${p.u}`;
  if (t && o) return `${t.v} · ${o.v} ${o.u}`.trim();
  if (t) return `${t.v} · ${f.nombre}`;
  if (p) return `${p.v}${p.u} · ${f.nombre}`;
  if (o) return `${o.v} ${o.u} · ${f.nombre}`.trim();
  return f.nombre;
}

/** El título de la hoja de stickers según lo que fue: «Comparte tu carrera» (correr, trail), «tu workout» (del plan) o «tu entreno». */
export const tituloDeLaHoja = ({ deporte, plan }) => {
  if (plan) return 'Comparte tu workout';
  if (deporte === 'correr' || deporte === 'trail') return 'Comparte tu carrera';
  return 'Comparte tu entreno';
};

/**
 * LA FRASE (sticker Frase): renglones de trozos `{ t, u?, co? }` (`u`: la unidad, en el acento; `co`: palabra de unión, al 50 %).
 * «5.00km / in 27:14 / at 5:27/km», fuerza «16sets / in 48:05 / · 5exercises», sin distancia «70min / of padel / · 610kcal».
 */
export function fraseLarga(f) {
  const d = f.datos;
  const v = (x) => ({ t: x.v, u: x.u || '' });
  const co = (t) => ({ t, co: true });
  const p = d.ritmo || d.vel;
  if (d.dist && d.tiempo && p) return [[v(d.dist)], [co('in'), v(d.tiempo)], [co('at'), v(p)]];
  if (d.series && d.tiempo) return [[v(d.series)], [co('in'), v(d.tiempo)], ...(d.ejercicios ? [[co('·'), { t: d.ejercicios.v, u: 'exercises' }]] : [])];
  if (d.dist && d.tiempo) return [[v(d.dist)], [co('in'), v(d.tiempo)]];
  return [[v(d.min)], [co('of'), { t: f.en.toLowerCase() }], ...(d.kcal ? [[co('·'), v(d.kcal)]] : [])];
}

/** «1st», «2nd», «11th», «23rd». */
export const ordinal = (n) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] ?? 'th'}`;
