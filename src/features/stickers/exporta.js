import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { domToBlob, domToCanvas } from 'modern-screenshot';
import { cargaCatalogo } from '@/lib/iconosDeTipo';
import { LIENZOS } from '@/lib/stickers/catalogo';
import { tramoDe } from '@/lib/stickers/ruta';
import Sticker from './Sticker';
import RutaVideo from './RutaVideo';

/* SACAR UN STICKER COMO IMAGEN O COMO VIDEO (28 oct 2026; ver docs/stickers.md).

   IMAGEN. El sticker se dibuja otra vez, a su tamaño real y fuera de la pantalla (la galería lo enseña achicado), se espera a que Bricolage y el catálogo de
   íconos estén listos y se rasteriza con `modern-screenshot` a 3×: 900 × 600 (ancho), 900 × 990 (alto) o 900 × 1599 («Con foto», con la foto debajo).
   Fondo transparente. La fuente va adentro del PNG: la toma de `public/fonts` (la misma app), así que funciona sin internet.

   VIDEO (pestaña Video). Un video de 3 s del tamaño del sticker alto (900 × 990): el Eco que cae y se angosta, o la ruta que se dibuja. Se arman CAPAS con el
   mismo dibujo del sticker (cada parte rasterizada por separado), se animan en un lienzo y se codifican cuadro por cuadro en mp4 (ver `graba`). Un video no
   puede ser transparente: va sobre el fondo de la hoja (blanco si la tinta es negra). */

export const ESCALA = 3;
export const DURA_VIDEO_MS = 3000;

/** Dibuja `elemento` fuera de la pantalla y espera a que avise que está listo (`alListo`). Devuelve el nodo y cómo quitarlo. */
async function monta(componente, props) {
  await cargaCatalogo().catch(() => null);
  const caja = document.createElement('div');
  caja.setAttribute('aria-hidden', 'true');
  Object.assign(caja.style, { position: 'fixed', left: '-10000px', top: '0', pointerEvents: 'none', contain: 'layout paint' });
  document.body.appendChild(caja);
  const raiz = createRoot(caja);
  const nodo = await new Promise((listo) => { raiz.render(createElement(componente, { ...props, alListo: listo })); });
  return { nodo, quita: () => { raiz.unmount(); caja.remove(); } };
}

/** El PNG de un sticker (`item` del catálogo, `f` la ficha, `color` uno de `COLORES`; `forma: 'historia'` y `foto` para «Con foto»). Un Blob `image/png`. */
export async function pngDeSticker({ item, f, color, forma = item.forma, foto = null }) {
  const { nodo, quita } = await monta(Sticker, { item, f, color, forma, foto });
  try {
    const { w, h } = LIENZOS[forma] ?? LIENZOS.ancho;
    const blob = await domToBlob(nodo, { width: w, height: h, scale: ESCALA, backgroundColor: null, type: 'image/png' });
    if (!blob) throw new Error('No se pudo dibujar el sticker');
    return blob;
  } finally {
    quita();
  }
}

/** El nombre del archivo: «traininglab-firma.png», «traininglab-eco.mp4». */
export const nombreDeArchivo = (item, ext = 'png') => `traininglab-${item.id}.${ext}`;

/* ---------- Video ---------- */

/** Una curva como las de CSS (`cubic-bezier`): de 0..1 en el tiempo a 0..1 en el avance. */
function curva(x1, y1, x2, y2) {
  const B = (t, a, b) => 3 * a * t * (1 - t) ** 2 + 3 * b * t * t * (1 - t) + t ** 3;
  return (x) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    let lo = 0;
    let hi = 1;
    for (let i = 0; i < 24; i += 1) { const m = (lo + hi) / 2; if (B(m, x1, x2) < x) lo = m; else hi = m; }
    return B((lo + hi) / 2, y1, y2);
  };
}
const CAJON = curva(0.32, 0.72, 0, 1);
const SALE = curva(0.23, 1, 0.32, 1);
const SUAVE = curva(0.42, 0, 0.58, 1);
const tramo = (t, desde, dura) => Math.min(1, Math.max(0, (t - desde) / dura));

/** El formato de video que este navegador sabe grabar en tiempo real (el respaldo): mp4 primero, que es el que guarda el iPhone. */
function formatoDeVideo() {
  if (typeof MediaRecorder !== 'function') return null;
  return ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported?.(t)) ?? null;
}
export const puedeGrabarVideo = () => typeof VideoEncoder === 'function' || (!!formatoDeVideo() && typeof HTMLCanvasElement.prototype.captureStream === 'function');

/** Rasteriza el nodo tal como está ahora (para sacar una capa). */
const capa = (nodo, w, h) => domToCanvas(nodo, { width: w, height: h, scale: ESCALA, backgroundColor: null });

/** Esconde todo lo de `nodo` que no sea `deja` (con `visibility`, para que nada se mueva de lugar); devuelve cómo regresarlo. */
function soloDeja(nodo, partes, deja) {
  partes.forEach((p) => { if (!deja.includes(p)) p.style.visibility = 'hidden'; });
  return () => partes.forEach((p) => { p.style.visibility = ''; });
}

const CUADROS_POR_SEGUNDO = 30;

/**
 * Arma el video de `dibujaCuadro(ctx, t)` (t en ms, de 0 a `DURA_VIDEO_MS`) en un lienzo de `w` × `h`. Devuelve `{ blob, ext }`.
 * Primero, CUADRO POR CUADRO (`mediabunny` con el codificador del teléfono, H.264 en mp4): cada cuadro lleva su tiempo exacto, así que el video dura justo
 * 3 s aunque el teléfono vaya lento o la pantalla se apague. Si el teléfono no sabe codificar así, se graba en tiempo real con `MediaRecorder`.
 */
async function graba(w, h, dibujaCuadro) {
  const lienzo = document.createElement('canvas');
  lienzo.width = w;
  lienzo.height = h;
  Object.assign(lienzo.style, { position: 'fixed', left: '-10000px', top: '0', width: '10px', height: '10px', pointerEvents: 'none' });
  document.body.appendChild(lienzo);
  const ctx = lienzo.getContext('2d');
  try {
    const mb = await import('mediabunny');
    if (await mb.canEncodeVideo('avc', { width: w, height: h })) {
      const salida = new mb.Output({ format: new mb.Mp4OutputFormat({ fastStart: 'in-memory' }), target: new mb.BufferTarget() });
      const fuente = new mb.CanvasSource(lienzo, { codec: 'avc', quality: mb.QUALITY_HIGH });
      salida.addVideoTrack(fuente, { frameRate: CUADROS_POR_SEGUNDO });
      await salida.start();
      const total = Math.round((DURA_VIDEO_MS / 1000) * CUADROS_POR_SEGUNDO);
      for (let i = 0; i < total; i += 1) {
        dibujaCuadro(ctx, (i * 1000) / CUADROS_POR_SEGUNDO);
        await fuente.add(i / CUADROS_POR_SEGUNDO, 1 / CUADROS_POR_SEGUNDO);
      }
      await salida.finalize();
      return { blob: new Blob([salida.target.buffer], { type: 'video/mp4' }), ext: 'mp4' };
    }
    return await grabaEnVivo(lienzo, ctx, dibujaCuadro);
  } finally {
    lienzo.remove();
  }
}

/** El respaldo: grabar el lienzo en tiempo real con `MediaRecorder` (cada cuadro se manda a mano: si no, el navegador se salta los que no cambian). */
async function grabaEnVivo(lienzo, ctx, dibujaCuadro) {
  const tipo = formatoDeVideo();
  if (!tipo) throw new Error('Este navegador no puede grabar video');
  const flujo = lienzo.captureStream(0);
  const pista = flujo.getVideoTracks()[0];
  const dibuja = (t) => { dibujaCuadro(ctx, t); pista.requestFrame?.(); };
  const grabadora = new MediaRecorder(flujo, { mimeType: tipo, videoBitsPerSecond: 8000000 });
  const trozos = [];
  grabadora.ondataavailable = (e) => { if (e.data?.size) trozos.push(e.data); };
  const termino = new Promise((ok) => { grabadora.onstop = ok; });
  // La grabadora no avisa que arrancó hasta que le llega un cuadro: mientras, se le repite el primero (medio segundo, como mucho).
  let arranco = false;
  grabadora.onstart = () => { arranco = true; };
  grabadora.start(250);
  const espera0 = performance.now();
  while (!arranco && performance.now() - espera0 < 500) {
    dibuja(0);
    await new Promise((ok) => { setTimeout(ok, 33); });
  }
  const t0 = performance.now();
  await new Promise((ok) => {
    const paso = () => {
      const t = performance.now() - t0;
      dibuja(Math.min(t, DURA_VIDEO_MS));
      if (t >= DURA_VIDEO_MS + 150) ok();
      else setTimeout(paso, 33);
    };
    paso();
  });
  grabadora.stop();
  await termino;
  flujo.getTracks().forEach((p) => p.stop());
  const base = tipo.split(';')[0];
  return { blob: new Blob(trozos, { type: base }), ext: base === 'video/mp4' ? 'mp4' : 'webm' };
}

/** El fondo del video: el de la hoja, o blanco si la tinta es negra. */
const fondoDe = (color) => (color.clara ? '#FFFFFF' : '#0E1220');

/** El video del Eco: el número cae desde arriba y se angosta (900 ms); los ecos aparecen a los 20 y 160 ms; la frase y el wordmark suben a los 760 ms. */
async function videoDelEco({ item, f, color }) {
  const { nodo, quita } = await monta(Sticker, { item, f, color, forma: 'alto' });
  try {
    const { w, h } = LIENZOS.alto;
    const [e1, e2, e3] = ['.e1', '.e2', '.e3'].map((s) => nodo.querySelector(s));
    const resto = [nodo.querySelector('.k-cap'), nodo.querySelector('.k-wm')].filter(Boolean);
    const partes = [e1, e2, e3, ...resto];
    const fs = parseFloat(e3.style.fontSize) || 80;
    const capas = {};
    for (const [nombre, deja] of [['e1', [e1]], ['e2', [e2]], ['resto', resto]]) {
      const regresa = soloDeja(nodo, partes, deja);
      capas[nombre] = await capa(nodo, w, h);
      regresa();
    }
    // El número de abajo, de ancho (wdth 100) a angosto (75), en cinco pasos.
    const anchos = [100, 94, 88, 81, 75];
    capas.e3 = [];
    for (const a of anchos) {
      const regresa = soloDeja(nodo, partes, [e3]);
      e3.style.fontVariationSettings = `'opsz' 96, 'wdth' ${a}`;
      e3.style.fontStretch = `${a}%`;
      capas.e3.push(await capa(nodo, w, h));
      regresa();
    }
    return await graba(w * ESCALA, h * ESCALA, (ctx, t) => {
      ctx.globalAlpha = 1;
      ctx.fillStyle = fondoDe(color);
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.globalAlpha = SALE(tramo(t, 20, 420));
      ctx.drawImage(capas.e1, 0, 0);
      ctx.globalAlpha = SALE(tramo(t, 160, 420));
      ctx.drawImage(capas.e2, 0, 0);
      const p = CAJON(tramo(t, 0, 900));
      ctx.globalAlpha = 1;
      ctx.drawImage(capas.e3[Math.min(anchos.length - 1, Math.round(p * (anchos.length - 1)))], 0, -1.6 * fs * ESCALA * (1 - p));
      const q = SALE(tramo(t, 760, 420));
      ctx.globalAlpha = q;
      ctx.drawImage(capas.resto, 0, 8 * ESCALA * (1 - q));
    });
  } finally {
    quita();
  }
}

/** El video de la ruta: la línea se dibuja sola (2.4 s) y al final sale el punto del acento. */
async function videoDeLaRuta({ f, color }) {
  const { nodo, quita } = await monta(RutaVideo, { f, color });
  try {
    const { w, h } = LIENZOS.alto;
    const svg = nodo.querySelector('svg');
    const caja = nodo.getBoundingClientRect();
    const r = svg.getBoundingClientRect();
    const pts = JSON.parse(svg.dataset.puntos);
    const grosor = Number(svg.dataset.grosor);
    const regresa = soloDeja(nodo, [svg], []);
    const texto = await capa(nodo, w, h);
    regresa();
    const ox = (r.left - caja.left) * ESCALA;
    const oy = (r.top - caja.top) * ESCALA;
    return await graba(w * ESCALA, h * ESCALA, (ctx, t) => {
      ctx.fillStyle = fondoDe(color);
      ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(texto, 0, 0);
      const p = SUAVE(tramo(t, 0, 2400));
      const linea = p > 0 ? tramoDe(pts, 0, p) : [];
      if (linea.length >= 2) {
        ctx.strokeStyle = color.tinta;
        ctx.lineWidth = grosor * ESCALA;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.beginPath();
        linea.forEach(([x, y], i) => (i ? ctx.lineTo(ox + x * ESCALA, oy + y * ESCALA) : ctx.moveTo(ox + x * ESCALA, oy + y * ESCALA)));
        ctx.stroke();
      }
      if (p >= 1) {
        const [x, y] = pts[pts.length - 1];
        ctx.fillStyle = color.acento;
        ctx.beginPath();
        ctx.arc(ox + x * ESCALA, oy + y * ESCALA, grosor * 1.25 * ESCALA, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  } finally {
    quita();
  }
}

/** El video de un sticker de la pestaña Video: `clase` es «eco» (con su `item` del catálogo) o «ruta». Devuelve `{ blob, ext }`. */
export function videoDeSticker({ clase, item, f, color }) {
  if (!puedeGrabarVideo()) return Promise.reject(new Error('Este navegador no puede grabar video'));
  return clase === 'eco' ? videoDelEco({ item, f, color }) : videoDeLaRuta({ f, color });
}
