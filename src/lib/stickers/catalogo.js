/* EL CATÁLOGO DE STICKERS Y EL MOTOR DE RANURAS (Andrés, 28 oct 2026). Ver docs/stickers.md.

   RANURAS CON SUPLENTES: cada sticker tiene ranuras; cada ranura trae una lista de datos en orden de preferencia y toma el PRIMERO que el entreno tenga.
   Un sticker solo desaparece si una ranura obligatoria se queda sin dato (los de ruta sin GPS). Un mismo dato no se repite dentro de un sticker (dos ranuras
   no pueden mostrar «Time» las dos). Así sirve para cualquier actividad, incluso las que invente el coach, y nunca sale un «N/A».

   Aquí solo están los datos de cada sticker (forma, familia, ranuras); cómo se dibuja vive en `features/stickers/Sticker.jsx`.
   FASE 1: Titular, Firma, Eco, Grande, Fila y Ruta y dato. El resto (fase 2) entra en este mismo arreglo, en el orden de la tabla de la especificación.

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
 * Cada sticker: `id`, `nombre`, `familia` (identidad, firma, eco, datos, tipo), `forma` (ancho | alto), `identidad` (también sale en «Con foto»),
 * `ranuras` ({ nombre: [claves] }), `elige` ([claves, n, mín.]) y `obliga(f)` (lo que no puede faltar).
 */
export const STICKERS = [
  { id: 'titular', nombre: 'Titular', familia: 'identidad', forma: 'alto', identidad: true,
    ranuras: { a: ['dist', 'series', 'min'], b: ['tiempo', 'kcal', 'ejercicios'], c: ['ritmo', 'vel', 'fc', 'kcal', 'ejercicios', 'largos'] } },
  { id: 'firma', nombre: 'Firma', familia: 'identidad', forma: 'ancho', identidad: true, ranuras: { g: PREF_GRANDE } },
  { id: 'eco', nombre: 'Eco', familia: 'identidad', forma: 'alto', identidad: true, ranuras: { g: PREF_GRANDE } },
  { id: 'grande', nombre: 'Grande', familia: 'datos', forma: 'ancho', identidad: true, ranuras: { g: ['dist', 'tiempo', 'kcal'] } },
  { id: 'fila', nombre: 'Fila', familia: 'datos', forma: 'ancho', elige: [PREF, 3] },
  { id: 'ruta-dato', nombre: 'Ruta y dato', familia: 'datos', forma: 'alto', obliga: (f) => !!f.ruta,
    ranuras: { g: ['dist', 'tiempo'] }, elige: [['tiempo', 'ritmo', 'vel', 'kcal', 'fc'], 2, 1] },
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
