/* El DIBUJO del sello: lo que se ve en la vista previa y lo que sale en la imagen, con el mismo código (un lienzo de 360 × 640 unidades, el tamaño de una historia
   de Instagram dividido entre 3). La imagen final se pinta a 3× (1080 × 1920).

   El diseño es el que Andrés eligió de las maquetas del 10 oct 2026: solo tipografía (Archivo ancha, centrada), sin bordes ni placas, números blancos con una
   sombra suave y UN solo color, el azul, para la ruta y el punto de T•LAB. Cada sello se arma con cuatro piezas que el atleta puede mover por separado:
     linea   la ruta del GPS (176 × 140), si la hay
     icono   el ícono del tipo de sesión (100 × 100), cuando NO hay ruta
     datos   tres filas: etiqueta chica, número grande y unidad (236 de ancho, 74 por fila)
     logo    T•LAB: las tres piezas se miden y se centran juntas; el punto va a media altura de las mayúsculas

   Todo el texto va en inglés. La letra Archivo ancha viene de Google Fonts (ver index.html): hay que esperarla con `cargaFuentes()` antes de pintar.
   El lienzo no tiene `letterSpacing` en todos los navegadores, así que el espaciado de LAB se hace letra por letra.

   Este archivo no importa nada de la app (ni `@/`) salvo `./ruta.js`. */
import { ajustaRuta } from './ruta.js';

export const MARCO = { w: 360, h: 640 };
export const AZUL = '#3578FF';
const FAMILIA = 'Archivo, "Arial Black", Arial, sans-serif';
const fuente = (peso, px) => `${peso} ${px}px ${FAMILIA}`;

const ANCHO_DATOS = 236;
const PASO = 74;
const ANCHO_LOGO = 190;
const ALTO_LOGO = 46;
const CAJA_RUTA = { w: 176, h: 140 };
const GROSOR_RUTA = 4.6;
const SOMBRA = { color: 'rgba(0,0,0,0.4)', blur: 4.4, dy: 1.4 };

/** Espera a que estén cargadas las dos letras del sello (si Google Fonts no responde, se pinta con Arial y no se rompe nada). */
export async function cargaFuentes() {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  try {
    await Promise.all([document.fonts.load(fuente(800, 38)), document.fonts.load(fuente(700, 14)), document.fonts.load(fuente(600, 12))]);
  } catch { /* se pinta con la de respaldo */ }
}

/** Las piezas de un sello con su lugar de origen, de abajo hacia arriba (la última es la que queda encima). */
export function piezasDelSello(sello, conIcono) {
  const piezas = [];
  if (sello.ruta) piezas.push({ id: 'linea', x: 92, y: 112, w: CAJA_RUTA.w, h: CAJA_RUTA.h });
  else if (conIcono) piezas.push({ id: 'icono', x: 130, y: 140, w: 100, h: 100 });
  const n = sello.filas.length;
  // Con menos de tres filas el bloque se centra donde estaría el de tres.
  piezas.push({ id: 'datos', x: (MARCO.w - ANCHO_DATOS) / 2, y: 276 + (3 - n) * (PASO / 2), w: ANCHO_DATOS, h: n * PASO - 8 });
  piezas.push({ id: 'logo', x: (MARCO.w - ANCHO_LOGO) / 2, y: 506, w: ANCHO_LOGO, h: ALTO_LOGO });
  return piezas;
}

/** La pieza que está en (x, y) del marco (con 6 de tolerancia para el dedo), o `null`. Gana la de encima. */
export function piezaEn(piezas, acomodo, x, y) {
  for (let i = piezas.length - 1; i >= 0; i -= 1) {
    const p = piezas[i];
    const [dx, dy] = acomodo?.[p.id] ?? [0, 0];
    if (x >= p.x + dx - 6 && x <= p.x + dx + p.w + 6 && y >= p.y + dy - 6 && y <= p.y + dy + p.h + 6) return p;
  }
  return null;
}

/** El corrimiento de una pieza sin dejarla salir del marco más allá de lo razonable (siempre queda a la vista casi la mitad). */
export function limitaCorrimiento(pieza, dx, dy) {
  const x = Math.min(Math.max(pieza.x + dx, -pieza.w * 0.6), MARCO.w - pieza.w * 0.4);
  const y = Math.min(Math.max(pieza.y + dy, -pieza.h * 0.4), MARCO.h - pieza.h * 0.6);
  return [x - pieza.x, y - pieza.y];
}

/** El rectángulo que cubre todas las piezas (ya movidas), con un margen para la sombra. */
export function cajaDelSello(piezas, acomodo, margen = 14) {
  let x0 = Infinity; let y0 = Infinity; let x1 = -Infinity; let y1 = -Infinity;
  piezas.forEach((p) => {
    const [dx, dy] = acomodo?.[p.id] ?? [0, 0];
    x0 = Math.min(x0, p.x + dx); y0 = Math.min(y0, p.y + dy);
    x1 = Math.max(x1, p.x + dx + p.w); y1 = Math.max(y1, p.y + dy + p.h);
  });
  return { x: x0 - margen, y: y0 - margen, w: x1 - x0 + 2 * margen, h: y1 - y0 + 2 * margen };
}

/* ---------- las piezas, cada una en su propio (0, 0) ---------- */

function pintaLinea(ctx, sello) {
  const pts = ajustaRuta(sello.ruta.lat, sello.ruta.lon, CAJA_RUTA.w, CAJA_RUTA.h, GROSOR_RUTA);
  if (!pts) return;
  ctx.beginPath();
  pts.forEach(([x, y], i) => (i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)));
  ctx.strokeStyle = AZUL;
  ctx.lineWidth = GROSOR_RUTA;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function pintaIcono(ctx, icono) {
  if (icono) ctx.drawImage(icono, 10, 10, 80, 80);
}

function pintaDatos(ctx, sello) {
  ctx.textBaseline = 'alphabetic';
  sello.filas.forEach((f, i) => {
    const y = i * PASO;
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.95)';
    ctx.font = fuente(600, 12);
    ctx.fillText(f.label, ANCHO_DATOS / 2, y + 12);
    // El número y su unidad se centran JUNTOS (la unidad es más chica y va pegada).
    ctx.font = fuente(800, 38);
    const wv = ctx.measureText(f.valor).width;
    ctx.font = fuente(700, 14);
    const wu = f.unidad ? 4 + ctx.measureText(f.unidad).width : 0;
    const x = ANCHO_DATOS / 2 - (wv + wu) / 2;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#fff';
    ctx.font = fuente(800, 38);
    ctx.fillText(f.valor, x, y + 52);
    if (f.unidad) {
      ctx.font = fuente(700, 14);
      ctx.fillText(f.unidad, x + wv + 4, y + 52);
    }
  });
}

function pintaLogo(ctx) {
  const tam = 38; const base = 38; const sep = 2.4;
  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
  ctx.font = fuente(800, tam);
  const wT = ctx.measureText('T').width;
  const anchos = ['L', 'A', 'B'].map((c) => ctx.measureText(c).width);
  const wL = anchos.reduce((s, a) => s + a, 0) + sep * 2;
  const hueco = tam * 0.3; const r = tam * 0.17;
  const x0 = (ANCHO_LOGO - (wT + hueco + 2 * r + hueco + wL)) / 2;
  ctx.fillStyle = '#fff';
  ctx.fillText('T', x0, base);
  // El punto, a media altura de las mayúsculas (la altura de una mayúscula de Archivo es ~0.7 del tamaño).
  ctx.fillStyle = AZUL;
  ctx.beginPath();
  ctx.arc(x0 + wT + hueco + r, base - tam * 0.35, r, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  let x = x0 + wT + 2 * hueco + 2 * r;
  ['L', 'A', 'B'].forEach((c, i) => { ctx.fillText(c, x, base); x += anchos[i] + sep; });
}

function cubre(ctx, img, w, h) {
  const iw = img.width || img.naturalWidth; const ih = img.height || img.naturalHeight;
  if (!iw || !ih) return;
  const r = Math.max(w / iw, h / ih);
  ctx.drawImage(img, (w - iw * r) / 2, (h - ih * r) / 2, iw * r, ih * r);
}

/**
 * Pinta un sello en `ctx`. `k`: píxeles por unidad. `origen`: la esquina del marco que cae en el (0, 0) del lienzo (para recortar la imagen sin fondo).
 * `acomodo`: `{ [pieza]: [dx, dy] }`. `foto`: algo que `drawImage` entienda; se pinta cubriendo todo el marco.
 */
export function dibujaSello(ctx, { sello, icono = null, acomodo = null, k = 1, origen = { x: 0, y: 0 }, foto = null }) {
  ctx.save();
  ctx.setTransform(k, 0, 0, k, -origen.x * k, -origen.y * k);
  if (foto) cubre(ctx, foto, MARCO.w, MARCO.h);
  piezasDelSello(sello, !!icono).forEach((p) => {
    const [dx, dy] = acomodo?.[p.id] ?? [0, 0];
    ctx.save();
    ctx.translate(p.x + dx, p.y + dy);
    ctx.shadowColor = SOMBRA.color;
    ctx.shadowBlur = SOMBRA.blur * k;
    ctx.shadowOffsetY = SOMBRA.dy * k;
    if (p.id === 'linea') pintaLinea(ctx, sello);
    else if (p.id === 'icono') pintaIcono(ctx, icono);
    else if (p.id === 'datos') pintaDatos(ctx, sello);
    else pintaLogo(ctx);
    ctx.restore();
  });
  ctx.restore();
}

/** Pinta en un `<canvas>` de pantalla: lo deja del tamaño con que se ve (por la densidad de píxeles) y lo borra antes. Devuelve las unidades por píxel de CSS. */
export function dibujaEnPantalla(lienzo, opciones) {
  const caja = lienzo.getBoundingClientRect();
  if (!caja.width) return null;
  const dpr = Math.min(3, window.devicePixelRatio || 1);
  const ancho = Math.round(caja.width * dpr);
  const alto = Math.round((caja.width * MARCO.h / MARCO.w) * dpr);
  if (lienzo.width !== ancho || lienzo.height !== alto) { lienzo.width = ancho; lienzo.height = alto; }
  const ctx = lienzo.getContext('2d');
  ctx.clearRect(0, 0, ancho, alto);
  dibujaSello(ctx, { ...opciones, k: ancho / MARCO.w });
  return caja;
}

/**
 * La imagen final como PNG. Con `foto`: la historia entera (1080 × 1920) con la foto de fondo. Sin ella: solo el sello, recortado a sus piezas y con el fondo
 * transparente, para pegarlo encima de un video en Instagram o CapCut.
 */
export async function exportaSello({ sello, icono = null, acomodo = null, foto = null }) {
  const k = 3;
  const piezas = piezasDelSello(sello, !!icono);
  const caja = foto ? { x: 0, y: 0, w: MARCO.w, h: MARCO.h } : cajaDelSello(piezas, acomodo);
  const lienzo = document.createElement('canvas');
  lienzo.width = Math.ceil(caja.w * k);
  lienzo.height = Math.ceil(caja.h * k);
  dibujaSello(lienzo.getContext('2d'), { sello, icono, acomodo, k, origen: { x: caja.x, y: caja.y }, foto });
  const blob = await new Promise((resolve) => { lienzo.toBlob(resolve, 'image/png'); });
  if (!blob) throw new Error('No se pudo crear la imagen');
  return blob;
}
