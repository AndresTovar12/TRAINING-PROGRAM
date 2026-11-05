import { useLayoutEffect, useRef } from 'react';
import { FAMILIAS_NUEVAS, lienzoDe, TEMAS_TARJETA } from '@/lib/stickers/catalogo';
import Contenido from './Contenido';
import Nuevos from './Nuevos';
import './stickers.css';

/* UN STICKER, dibujado con su ficha (28 oct 2026; ver docs/stickers.md y el prototipo de Andrés). HTML + CSS con Bricolage: así se ve en la hoja y así se
   exporta (`exporta.js`). `item`: lo que dio `catalogo(f)` (id, forma y lo resuelto en `r`). `color`: uno de `COLORES` (tinta y acento). `forma`: la del
   sticker, o «historia» en «Con foto». Los números bajan de tamaño hasta caber en su columna (`ajustaSticker`): nunca se cortan ni se envuelven.
   `foto` («Con foto»): `{ ejemplo: 'atardecer' | 'pista' | 'gym' }` o `{ url }` (la del carrete; nunca sale del teléfono). `anima`: el Eco que cae (pestaña Video). */

/** Que nada choque: baja el tamaño de cada valor marcado `k-fit` hasta que quepa en su columna (o en lo que le deja su etiqueta en un renglón; nunca de 10 px
    para abajo). Los ecos y la firma comparten tamaño. */
function ajustaSticker(raiz) {
  if (!raiz) return;
  raiz.querySelectorAll('.k-fit').forEach((v) => {
    if (!v.dataset.fs) v.dataset.fs = v.style.fontSize;
    v.style.fontSize = v.dataset.fs;
    const padre = v.parentElement;
    let caja = padre?.getBoundingClientRect().width ?? 0;
    if (!caja) return;
    // En un renglón («8.00km ..... Distance») el número cabe en lo que le dejan su etiqueta y el hueco entre los dos.
    if (padre.classList.contains('k-fr')) {
      const otros = [...padre.children].filter((x) => x !== v);
      caja -= otros.reduce((t, x) => t + x.getBoundingClientRect().width, 0) + otros.length * (parseFloat(getComputedStyle(padre).columnGap) || 10);
    }
    let s = parseFloat(v.style.fontSize) || 16;
    v.style.display = 'inline-block';
    let vueltas = 0;
    while (v.getBoundingClientRect().width > caja - 1 && s > 10 && vueltas < 90) { s -= 1; v.style.fontSize = `${s}px`; vueltas += 1; }
    v.style.display = '';
  });
  // Los 19 nuevos: un valor con `data-n-max` baja hasta caber en ese ancho; un grupo (una fila o una rejilla) baja todos sus valores juntos.
  raiz.querySelectorAll('[data-n-max]').forEach((c) => {
    const max = parseFloat(c.dataset.nMax);
    const vs = c.classList.contains('n-v') ? [c] : [...c.querySelectorAll('.n-v')];
    vs.forEach((v) => { if (!v.dataset.fs) v.dataset.fs = v.style.fontSize; v.style.fontSize = v.dataset.fs; });
    let k = 1;
    while (c.offsetWidth > max + 0.5 && k > 0.45) { k -= 0.03; vs.forEach((v) => { v.style.fontSize = `${(parseFloat(v.dataset.fs) * k).toFixed(1)}px`; }); }
  });
  const iguala = (sel, hijos) => raiz.querySelectorAll(sel).forEach((b) => {
    const ls = [...b.querySelectorAll(hijos)];
    const s = Math.min(...ls.map((l) => parseFloat(l.style.fontSize)));
    ls.forEach((l) => { l.style.fontSize = `${s}px`; });
  });
  iguala('.k-ecos', '.k-ec');
  iguala('.k-firma', '.k-fl');
}

/** La foto de fondo de «Con foto»: una de las de ejemplo (dibujadas) o la del carrete, con un velo abajo para que el sticker se lea. */
const Foto = ({ foto }) => (
  <div className={`stk-foto${foto.ejemplo ? ` ${foto.ejemplo}` : ''}`} aria-hidden="true">
    {foto.url && <img src={foto.url} alt="" />}
    <div className="stk-vela" />
  </div>
);

/** El sticker a su tamaño real (300 de ancho; alto según la forma). Se ajusta al dibujarse y otra vez cuando la fuente termina de cargar. */
export default function Sticker({ item, f, color, forma = item.forma, foto = null, anima = false, cara = 0, alListo }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    let vivo = true;
    ajustaSticker(ref.current);
    const fuente = document.fonts?.load ? document.fonts.load('800 96px "Bricolage Grotesque"') : Promise.resolve();
    const imagen = ref.current?.querySelector('.stk-foto img');
    const lista = imagen && !imagen.complete ? new Promise((ok) => { imagen.onload = ok; imagen.onerror = ok; }) : null;
    Promise.all([fuente, lista]).then(() => {
      if (!vivo) return;
      ajustaSticker(ref.current);
      alListo?.(ref.current);
    }).catch(() => { if (vivo) alListo?.(ref.current); });
    return () => { vivo = false; };
  }, [item, f, color, forma, foto, cara, alListo]);
  const nuevo = FAMILIAS_NUEVAS.includes(item.familia);
  // La tarjeta lleva su propio fondo y sus colores por tema; los otros nuevos, la tinta y el acento de siempre.
  const tema = item.familia === 'tarjeta' ? Object.fromEntries(Object.entries(TEMAS_TARJETA[color.id] ?? TEMAS_TARJETA.blanco).map(([k, v]) => [`--tj-${k}`, v])) : null;
  return (
    <div
      ref={ref} className={`stk ${forma} k-${item.id}${color.sombra && item.familia !== 'tarjeta' ? ' sombra' : ''}${anima ? ' anima' : ''}`}
      style={{ '--stk-tinta': color.tinta, '--stk-acento': color.acento, ...tema, height: lienzoDe(item, forma).h }}
    >
      {foto && <Foto foto={foto} />}
      {nuevo ? <Nuevos item={item} f={f} color={color} cara={cara} /> : <div className="stk-in"><Contenido item={item} f={f} color={color} /></div>}
    </div>
  );
}
