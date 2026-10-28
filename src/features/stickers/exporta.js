import { createElement } from 'react';
import { createRoot } from 'react-dom/client';
import { domToBlob } from 'modern-screenshot';
import { LIENZOS } from '@/lib/stickers/catalogo';
import Sticker from './Sticker';

/* SACAR UN STICKER COMO IMAGEN (28 oct 2026; ver docs/stickers.md). El sticker se dibuja otra vez, a su tamaño real y fuera de la pantalla (la galería lo enseña
   achicado), se espera a que Bricolage termine de cargar y se rasteriza con `modern-screenshot` a 3×: 900 × 600 (ancho), 900 × 990 (alto) o 900 × 1599 (Con foto),
   con el fondo transparente. La fuente va adentro del PNG: la toma de `public/fonts` (la misma app), así que funciona sin internet. */

export const ESCALA = 3;

/** El PNG de un sticker (`item` del catálogo, `f` la ficha, `color` uno de `COLORES`). Devuelve un Blob `image/png`. */
export async function pngDeSticker({ item, f, color, forma = item.forma }) {
  const caja = document.createElement('div');
  caja.setAttribute('aria-hidden', 'true');
  Object.assign(caja.style, { position: 'fixed', left: '-10000px', top: '0', pointerEvents: 'none', contain: 'layout paint' });
  document.body.appendChild(caja);
  const raiz = createRoot(caja);
  try {
    const nodo = await new Promise((listo) => {
      raiz.render(createElement(Sticker, { item, f, color, forma, alListo: listo }));
    });
    const { w, h } = LIENZOS[forma] ?? LIENZOS.ancho;
    const blob = await domToBlob(nodo, { width: w, height: h, scale: ESCALA, backgroundColor: null, type: 'image/png' });
    if (!blob) throw new Error('No se pudo dibujar el sticker');
    return blob;
  } finally {
    raiz.unmount();
    caja.remove();
  }
}

/** El nombre del archivo: «traininglab-firma.png». */
export const nombreDeArchivo = (item) => `traininglab-${item.id}.png`;
