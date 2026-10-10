/* El ÍCONO del sello como imagen: el mismo ícono del tipo de sesión que ve el atleta en el plan (pesa, correr, yoga… o el que eligió un coach de un catálogo de 252),
   en blanco, listo para pintarse en el lienzo del sello.

   Se saca del componente de la app (`Icono`) en vez de copiar trazos a mano: así cualquier ícono, también el de un tipo propio, sale igual que se ve en la pantalla.
   Se dibuja un instante en un nodo suelto (fuera de la pantalla) y se lee su `<svg>`. `react-dom/server` haría lo mismo, pero pesa ~190 kB que aquí sobran. */
import { createElement } from 'react';
import { flushSync } from 'react-dom';
import { createRoot } from 'react-dom/client';

async function svgDelIcono(Icono, tamano) {
  // `flushSync` no vale dentro de un efecto: quien nos llama lo hace desde uno, así que se espera un turno.
  await Promise.resolve();
  const caja = document.createElement('div');
  const raiz = createRoot(caja);
  try {
    flushSync(() => raiz.render(createElement(Icono, { size: tamano, color: '#ffffff', strokeWidth: 1.9 })));
    const svg = caja.querySelector('svg');
    if (!svg) throw new Error('El ícono no dibujó nada');
    if (!svg.getAttribute('xmlns')) svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    return svg.outerHTML;
  } finally {
    raiz.unmount();
  }
}

/** Un `<img>` del ícono en blanco a 192 px (se dibuja a ~80 px de pantalla; sobra para el 3× de la imagen final). */
export async function imagenDeIcono(Icono, { tamano = 192 } = {}) {
  const svg = await svgDelIcono(Icono, tamano);
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = () => reject(new Error('No se pudo dibujar el ícono'));
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
  });
  return img;
}
