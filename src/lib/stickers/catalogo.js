/* EL CATÁLOGO DE STICKERS Y EL MOTOR DE RANURAS (Andrés, 28 oct 2026). Ver docs/stickers.md.

   RANURAS CON SUPLENTES: cada sticker tiene ranuras; cada ranura trae una lista de datos en orden de preferencia y toma el PRIMERO que el entreno tenga.
   Un sticker solo desaparece si una ranura obligatoria se queda sin dato (los de ruta sin GPS). Un mismo dato no se repite dentro de un sticker (dos ranuras
   no pueden mostrar «Time» las dos). Así sirve para cualquier actividad, incluso las que invente el coach, y nunca sale un «N/A».

   Aquí solo están los datos de cada sticker (forma, familia, ranuras); cómo se dibuja vive en `features/stickers/Sticker.jsx`.
   Los 35 de la tabla de la especificación (fase 1: 6; fase 2: los otros 29), en su orden, detrás de los 31 nuevos del 5 nov 2026 (8 discretos, 6 runner, 5 tarjetas
   y 12 con personalidad). El volumen solo entra en «Lista» y «Columna». La pestaña «Totales» tiene su propio catálogo (más abajo), con la semana y el mes.

   Este archivo no importa nada de la app: lo cargan las pruebas de Node (`scripts/prueba-stickers.mjs`). */

// Preferencias compartidas.
export const PREF_GRANDE = ['dist', 'series', 'min', 'kcal'];
export const PREF = ['dist', 'series', 'tiempo', 'ritmo', 'vel', 'ejercicios', 'kcal', 'fc', 'elev', 'largos'];
export const PREF_CON_VOLUMEN = ['dist', 'series', 'tiempo', 'volumen', 'ritmo', 'vel', 'kcal', 'fc', 'elev', 'ejercicios'];

/** Los lienzos: ancho 300 × 200, alto 300 × 330, historia 300 × 533 (Con foto). Se exportan a 3×. */
export const LIENZOS = { ancho: { w: 300, h: 200 }, alto: { w: 300, h: 330 }, historia: { w: 300, h: 533 } };
/** El lienzo de UN sticker: el suyo (los nuevos de runner y tarjeta miden 380, 420 o 530 de alto), o el de su forma (o la «historia» de Con foto). */
export const lienzoDe = (item, forma = item.forma) => (forma === 'historia' ? LIENZOS.historia : item.lienzo ?? LIENZOS[forma] ?? LIENZOS.ancho);

/** Las familias de la tanda del 5 nov 2026 (los 31 que van al frente de la hoja y los 6 de Totales, ver docs/stickers.md): se dibujan centrados, en `Nuevos.jsx`. */
export const FAMILIAS_NUEVAS = ['discreto', 'runner', 'tarjeta', 'personalidad', 'totales'];
/** Un sticker nuevo lleva la pastilla «Nuevo» 30 días desde el build en que salió (`desde`, en el catálogo: no en la base). */
export const NUEVO_DIAS = 30;
export const esNuevo = (item, ahora = Date.now()) => {
  const t = item.desde ? Date.parse(item.desde) : NaN;
  return Number.isFinite(t) && ahora >= t && ahora - t < NUEVO_DIAS * 86400000;
};

/** Los cuatro colores de la hoja: la TINTA del sticker y su ACENTO (unidades, «Lab», el dato destacado). Fondo transparente siempre. */
export const COLORES = [
  { id: 'blanco', nombre: 'Blanco', tinta: '#FFFFFF', acento: '#3578FF', sombra: true, clara: false },
  { id: 'negro', nombre: 'Negro', tinta: '#0B0D12', acento: '#3578FF', sombra: false, clara: true },
  { id: 'azul', nombre: 'Azul', tinta: '#3578FF', acento: '#FFFFFF', sombra: false, clara: false },
  { id: 'coral', nombre: 'Coral', tinta: '#FF6B4A', acento: '#FFFFFF', sombra: false, clara: false },
];

/** Los cuatro temas de la TARJETA, uno por color de la hoja (fondo, borde, brillo, texto, etiqueta, acento, ruta, halo, núcleo, topo, línea, apagado). Del 5 nov 2026. */
export const TEMAS_TARJETA = {
  blanco: { fondo: 'radial-gradient(120% 80% at 50% 0%, rgba(10,33,66,.4) 0%, rgba(4,18,42,.4) 45%, rgba(2,10,24,.4) 100%)', borde: '#1E9BFF', brillo: 'rgba(30,155,255,.55)', brillo2: 'rgba(30,155,255,.18)', texto: '#FFFFFF', etiqueta: '#E9F0FF', acento: '#3578FF', ruta: '#22C8FF', halo: '#1FC2FF', nucleo: '#B9EEFF', topo: '#3E7BD6', linea: '#1E7BFF', apagado: '#1d3558' },
  negro: { fondo: 'radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.4) 0%, rgba(242,244,248,.4) 55%, rgba(230,234,241,.4) 100%)', borde: '#0B0D12', brillo: 'rgba(0,0,0,.16)', brillo2: 'rgba(0,0,0,.04)', texto: '#0B0D12', etiqueta: '#3B404D', acento: '#2F55F0', ruta: '#2F55F0', halo: 'rgba(47,85,240,.45)', nucleo: '#C9D5FF', topo: '#7D889E', linea: '#0B0D12', apagado: '#D3D8E2' },
  azul: { fondo: 'radial-gradient(120% 80% at 50% 0%, rgba(74,116,255,.4) 0%, rgba(36,72,230,.4) 50%, rgba(22,51,185,.4) 100%)', borde: '#FFFFFF', brillo: 'rgba(255,255,255,.45)', brillo2: 'rgba(255,255,255,.14)', texto: '#FFFFFF', etiqueta: '#E3EAFF', acento: '#A9C4FF', ruta: '#FFFFFF', halo: '#BFD0FF', nucleo: '#FFFFFF', topo: '#DCE6FF', linea: '#FFFFFF', apagado: 'rgba(255,255,255,.28)' },
  coral: { fondo: 'radial-gradient(120% 80% at 50% 0%, rgba(59,22,16,.4) 0%, rgba(32,10,7,.4) 50%, rgba(18,5,4,.4) 100%)', borde: '#FF6B4A', brillo: 'rgba(255,107,74,.55)', brillo2: 'rgba(255,107,74,.16)', texto: '#FFFFFF', etiqueta: '#FFE4DC', acento: '#FF6B4A', ruta: '#FF7A57', halo: '#FF6B4A', nucleo: '#FFD3C6', topo: '#D9573C', linea: '#FF6B4A', apagado: '#4A1C14' },
};

// Los de la tanda del 5 nov 2026 llevan esta fecha: durante 30 días muestran «Nuevo».
const NUEVO = '2026-11-05';
const L420 = { w: 300, h: 420 };
const lz = (h) => ({ w: 300, h });

/* LAS FRASES («✎ Personalizar», 5 nov 2026). English primero. La que sale de entrada es «pov: locked in»; la tuya, hasta 40 letras. */
export const FRASES = {
  en: ['pov: locked in', 'one more mile', 'built different', 'rain or shine', 'earned it', 'quiet miles', 'therapy session', 'no days off', 'slow but steady', 'main character run'],
  es: ['mente fuerte, piernas cansadas', 'otro día, otro kilómetro', 'hoy sí fui', 'terapia de los martes', 'lo hice por mí', 'sin excusas', 'mis piernas opinan distinto', 'modo bestia', 'poco a poco', 'ni la lluvia me paró'],
};
export const FRASE_INICIAL = FRASES.en[0];
export const FRASE_MAX = 40;

/**
 * El tamaño de la frase de «Frase grande» (serif itálica, 40 px, hasta 3 renglones en 260 px). Una frase larga baja de tamaño para caber en 3 renglones.
 * Cuenta con una letra promedio de 0.46 em (la itálica de Instrument Serif es angosta: medida en WebKit, ~0.40 em) y parte por palabras, como el navegador.
 * Al dibujarse, `Sticker.jsx` vuelve a medir y la baja más si hiciera falta (`data-n-alto`).
 */
export function tamDeFrase(frase, { px = 40, ancho = 260, renglones = 3, em = 0.46, min = 22 } = {}) {
  for (let t = px; t > min; t -= 1) if (renglonesDe(frase, ancho / (t * em)) <= renglones) return t;
  return min;
}
/** Cuántos renglones ocupa `frase` con `cabe` letras por renglón (parte por palabras; una palabra más larga que el renglón se parte). */
export function renglonesDe(frase, cabe) {
  const max = Math.max(1, Math.floor(cabe));
  let n = 1;
  let usado = 0;
  for (const p of String(frase).trim().split(/\s+/)) {
    const largo = p.length;
    if (usado === 0) { n += Math.floor(Math.max(0, largo - 1) / max); usado = largo % max || max; continue; }
    if (usado + 1 + largo <= max) { usado += 1 + largo; continue; }
    n += 1 + Math.floor(Math.max(0, largo - 1) / max);
    usado = largo % max || max;
  }
  return n;
}

/** El verbo de la Burbuja según el deporte: «Corrió 5.08 km», «Nadó 1,500 m», «Entrenó 18 series», «Entrenó 52 min». `null` si no hay qué decir. */
const VERBOS = { correr: 'Corrió', trail: 'Corrió', caminar: 'Caminó', senderismo: 'Caminó', bici: 'Pedaleó', natacion: 'Nadó', remo: 'Remó' };
export function pieDeBurbuja(f) {
  const d = f.datos;
  if (d.dist) return `${VERBOS[f.deporte] ?? 'Recorrió'} ${d.dist.v} ${d.dist.u}`;
  if (d.series) return `Entrenó ${d.series.v} series`;
  if (d.min) return `Entrenó ${d.min.v}${d.min.u ? ` ${d.min.u}` : ''}`;
  return null;
}
/** La frase del Resaltador: «5.08 kilómetros en 26:33», «18 series en 52 min», «60 min de entreno». `null` si no hay datos. */
const UNIDAD_LARGA = { km: 'kilómetros', m: 'metros' };
export function fraseResaltador(f) {
  const d = f.datos;
  const min = d.min ? `${d.min.v}${d.min.u ? ` ${d.min.u}` : ''}` : null;
  if (d.dist) return `${d.dist.v} ${UNIDAD_LARGA[d.dist.u] ?? d.dist.u}${d.tiempo ? ` en ${d.tiempo.v}` : ''}`;
  if (d.series) return `${d.series.v} series${min ? ` en ${min}` : ''}`;
  if (min) return `${min} de entreno`;
  return null;
}
/** Las claves cortas en inglés de la Máquina de escribir («DIST: 5.08 KM»). */
export const CLAVE_CORTA = { dist: 'DIST', ritmo: 'PACE', vel: 'SPD', tiempo: 'TIME', min: 'TIME', elev: 'ELEV', series: 'SETS', volumen: 'VOL', kcal: 'KCAL', fc: 'BPM', ejercicios: 'EXER', largos: 'LAPS' }; // estilo-ok: claves a máquina del sticker (maqueta)

/**
 * Cada sticker: `id`, `nombre`, `familia` (identidad, datos, tipo… y las nuevas: discreto, runner, tarjeta), `forma` (ancho | alto), `identidad` (también sale en «Con foto»),
 * `ranuras` ({ nombre: [claves] }), `elige` ([claves, n, mín.]) y `obliga(f)` (lo que no puede faltar). El orden es el de la tabla de la especificación.
 * Solo los nuevos: `lienzo` (su tamaño, si no es el de su forma), `desde` (cuándo salió: «Nuevo» 30 días), `variantes` (cada dato de `elige` es una cara, para el carrusel),
 * `caras` (cuántas variantes: un número o `(f, r) => n`), `perso` (lleva la frase), `fija` (no cambia con los colores) y `conFoto` (el Polaroid).
 */
export const STICKERS = [
  // Los 19 nuevos, al frente de la hoja (5 nov 2026): primero los 8 discretos, luego los 6 runner y las 5 tarjetas. Los de ruta no salen sin ruta.
  { id: 'd-un-dato', nombre: 'Un dato', familia: 'discreto', forma: 'ancho', desde: NUEVO, variantes: true, elige: [PREF, 3, 1] },
  { id: 'd-dos', nombre: 'Dos datos', familia: 'discreto', forma: 'ancho', desde: NUEVO, elige: [PREF, 2] },
  { id: 'd-dos-linea', nombre: 'Dos datos y la línea', familia: 'discreto', forma: 'ancho', desde: NUEVO, obliga: (f) => !!f.ruta, elige: [PREF, 2] },
  { id: 'd-tres', nombre: 'Tres en fila', familia: 'discreto', forma: 'ancho', desde: NUEVO, elige: [PREF, 3] },
  { id: 'd-cuatro', nombre: 'Cuatro', familia: 'discreto', forma: 'ancho', desde: NUEVO, elige: [PREF, 4] },
  { id: 'd-seis', nombre: 'Seis', familia: 'discreto', forma: 'ancho', desde: NUEVO, elige: [PREF, 6, 5] },
  { id: 'd-linea', nombre: 'La línea', familia: 'discreto', forma: 'alto', desde: NUEVO, obliga: (f) => !!f.ruta },
  { id: 'd-linea-dato', nombre: 'La línea y un dato', familia: 'discreto', forma: 'alto', desde: NUEVO, obliga: (f) => !!f.ruta, ranuras: { g: PREF } },
  { id: 'r-columna', nombre: 'Columna', familia: 'runner', forma: 'alto', desde: NUEVO, elige: [PREF, 3] },
  { id: 'r-columna-ruta', nombre: 'Columna con ruta', familia: 'runner', forma: 'alto', lienzo: L420, desde: NUEVO, obliga: (f) => !!f.ruta, elige: [PREF, 3] },
  { id: 'r-ruta-grande', nombre: 'Ruta grande', familia: 'runner', forma: 'alto', lienzo: L420, desde: NUEVO, obliga: (f) => !!f.ruta, elige: [PREF, 3] },
  { id: 'r-columna-larga', nombre: 'Columna larga', familia: 'runner', forma: 'alto', lienzo: L420, desde: NUEVO, elige: [PREF, 5, 3] },
  { id: 'r-marco', nombre: 'Marco', familia: 'runner', forma: 'alto', lienzo: L420, desde: NUEVO, obliga: (f) => !!f.ruta, elige: [PREF, 4, 2] },
  { id: 'r-boleto', nombre: 'Boleto', familia: 'runner', forma: 'alto', lienzo: L420, desde: NUEVO, obliga: (f) => Object.keys(f.datos).length > 0 },
  { id: 't-ruta', nombre: 'Tarjeta con ruta', familia: 'tarjeta', forma: 'alto', lienzo: { w: 300, h: 530 }, desde: NUEVO, obliga: (f) => !!f.ruta, elige: [PREF, 3] },
  { id: 't-ruta-fila', nombre: 'Tarjeta con ruta, datos en fila', familia: 'tarjeta', forma: 'alto', lienzo: { w: 300, h: 380 }, desde: NUEVO, obliga: (f) => !!f.ruta, elige: [PREF, 3] },
  { id: 't-sin-ruta', nombre: 'Tarjeta sin ruta', familia: 'tarjeta', forma: 'alto', lienzo: { w: 300, h: 530 }, desde: NUEVO, elige: [PREF, 3] },
  { id: 't-chica', nombre: 'Tarjeta chica', familia: 'tarjeta', forma: 'ancho', desde: NUEVO, elige: [PREF, 2] },
  { id: 't-record', nombre: 'Tarjeta de récord', familia: 'tarjeta', forma: 'alto', lienzo: { w: 300, h: 380 }, desde: NUEVO, obliga: (f) => !!f.record },
  // Los 12 con personalidad (5 nov 2026): después de las tarjetas y antes de los 35. `caras`: cuántas variantes (carrusel del mosaico); `perso`: lleva frase
  // («✎ Personalizar»); `fija`: no cambia con los cuatro colores; `conFoto`: lleva tu foto (el Polaroid).
  { id: 'p-italica', nombre: 'Itálica', familia: 'personalidad', forma: 'ancho', lienzo: lz(260), desde: NUEVO, caras: 2, elige: [PREF, 3, 1] },
  { id: 'p-maquina', nombre: 'Máquina de escribir', familia: 'personalidad', forma: 'ancho', lienzo: lz(260), desde: NUEVO, elige: [PREF, 4, 1] },
  { id: 'p-reloj', nombre: 'Reloj digital', familia: 'personalidad', forma: 'ancho', desde: NUEVO, caras: (f, r) => (r.length >= 3 ? 2 : 1), elige: [PREF, 3, 1] },
  { id: 'p-frase', nombre: 'Frase grande', familia: 'personalidad', forma: 'ancho', lienzo: lz(220), desde: NUEVO, perso: true, elige: [PREF, 2, 0] },
  { id: 'p-burbuja', nombre: 'Burbuja', familia: 'personalidad', forma: 'ancho', lienzo: lz(180), desde: NUEVO, perso: true, fija: true, caras: 2 },
  { id: 'p-barras', nombre: 'Código de barras', familia: 'personalidad', forma: 'ancho', desde: NUEVO, elige: [PREF, 3, 1] },
  { id: 'p-polaroid', nombre: 'Polaroid', familia: 'personalidad', forma: 'alto', desde: NUEVO, fija: true, conFoto: true, elige: [PREF, 2, 0] },
  { id: 'p-momento', nombre: 'Un momento', familia: 'personalidad', forma: 'ancho', desde: NUEVO, caras: 2 },
  { id: 'p-dia', nombre: 'Día gigante', familia: 'personalidad', forma: 'ancho', lienzo: lz(220), desde: NUEVO, caras: 2, ranuras: { g: PREF } },
  { id: 'p-resaltador', nombre: 'Resaltador', familia: 'personalidad', forma: 'ancho', lienzo: lz(180), desde: NUEVO, fija: true, obliga: (f) => !!fraseResaltador(f) },
  { id: 'p-corazon', nombre: 'Corazón', familia: 'personalidad', forma: 'ancho', lienzo: lz(160), desde: NUEVO, fija: true, caras: 2, ranuras: { g: PREF } },
  { id: 'p-sello', nombre: 'Sello redondo', familia: 'personalidad', forma: 'alto', lienzo: lz(300), desde: NUEVO, ranuras: { g: PREF } },
  // Los 35 de siempre.
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
 * Cada uno: `{ id, nombre, familia, forma, identidad, r }` (`r`: lo resuelto; con `elige` y `ranuras` a la vez, la lista va en `r.lista`), y en los nuevos `lienzo`, `desde` y `caras`.
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
    salida.push({
      id: s.id, nombre: s.nombre, familia: s.familia, forma: s.forma, identidad: !!s.identidad, r,
      // Solo los nuevos: su tamaño, desde cuándo son «Nuevo», cuántas caras tiene (una por dato, en `Un dato`) y lo de los 12 con personalidad.
      ...(s.lienzo ? { lienzo: s.lienzo } : null), ...(s.desde ? { desde: s.desde } : null), ...extras(s, f, r),
    });
  }
  return salida;
}

/** Lo que un sticker nuevo trae además: sus caras (si son más de una) y las marcas de personalidad. */
function extras(s, f, r) {
  const x = {};
  const caras = s.variantes && Array.isArray(r) ? r.length : typeof s.caras === 'function' ? s.caras(f, r) : s.caras;
  if (caras) x.caras = caras;
  if (s.perso) x.perso = true;
  if (s.fija) x.fija = true;
  if (s.conFoto) x.conFoto = true;
  return x;
}

/*
 * LOS 6 DE «TOTALES» (5 nov 2026): la semana y el mes de hoy, de todos los entrenos (`totales.js`). En este orden. Los de la semana no salen sin entrenos esta
 * semana; sin ninguno en el mes no sale nada (la pestaña lo dice). Sus caras dependen de lo que hay: sin kilómetros, «Esta semana» y «Mes gigante» enseñan solo
 * entrenos y tiempo (`r.vistas`). La tarjeta de la semana es de la familia tarjeta (los cuatro temas).
 */
export const TOTALES = [
  { id: 's-semana', nombre: 'Esta semana', familia: 'totales', forma: 'ancho', semana: true, vistas: (t) => (t.semana.distM > 0 ? ['km', 'entrenos'] : ['entrenos']) },
  { id: 's-barras', nombre: 'Semana en barras', familia: 'totales', forma: 'ancho', lienzo: lz(260), semana: true },
  { id: 's-puntos', nombre: 'Mes en puntos', familia: 'totales', forma: 'alto', lienzo: lz(300) },
  { id: 's-mes', nombre: 'Mes gigante', familia: 'totales', forma: 'ancho', lienzo: lz(240), vistas: (t) => (t.mes.distM > 0 ? ['km', 'entrenos'] : ['entrenos']) },
  { id: 's-maquina', nombre: 'Semana a máquina', familia: 'totales', forma: 'ancho', lienzo: lz(280), semana: true },
  { id: 's-tarjeta', nombre: 'Tarjeta de la semana', familia: 'tarjeta', forma: 'alto', lienzo: L420, semana: true, total: true },
];

/** El catálogo de Totales con los totales de hoy (`totalesDe`): `[]` si no hubo ningún entreno en el mes (ni en la semana, que a veces empieza en el mes de antes). Cada uno con `r: { vistas }`, `caras` y `total: true`. */
export function catalogoDeTotales(t) {
  if (!t || (t.mes.entrenos === 0 && t.semana.entrenos === 0)) return [];
  return TOTALES.filter((s) => (s.semana ? t.semana.entrenos > 0 : t.mes.entrenos > 0)).map((s) => {
    const vistas = s.vistas ? s.vistas(t) : ['una'];
    return { id: s.id, nombre: s.nombre, familia: s.familia, forma: s.forma, identidad: false, total: true, r: { vistas }, ...(s.lienzo ? { lienzo: s.lienzo } : null), desde: NUEVO, ...(vistas.length > 1 ? { caras: vistas.length } : null) };
  });
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
