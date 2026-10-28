import { useLayoutEffect, useRef } from 'react';
import { fraseCorta, LIENZOS } from '@/lib/stickers/catalogo';
import { ajustaRuta } from '@/lib/stickers/ruta';
import './stickers.css';

/* UN STICKER, dibujado con su ficha (28 oct 2026; ver docs/stickers.md y el prototipo de Andrés). HTML + CSS con Bricolage: así se ve en la hoja y así se
   exporta (`exporta.js`). `item`: lo que dio `catalogo(f)` (id, forma y lo resuelto en `r`). `color`: uno de `COLORES` (tinta y acento). `forma`: la del
   sticker, o «historia» en «Con foto». Los números bajan de tamaño hasta caber en su columna (`ajustaSticker`): nunca se cortan ni se envuelven. */

const Valor = ({ d, px, className = '' }) => (
  <div className={`k-v k-fit ${className}`} style={{ fontSize: px }}>
    {d.v}{d.u ? <span className="u">{d.u}</span> : null}
  </div>
);
const Etiqueta = ({ children, style }) => <div className="k-l" style={style}>{children}</div>;
const Marca = ({ px = 14, style }) => <div className="k-wm" style={{ fontSize: px, ...style }}>Training<span>Lab</span></div>;
const Rejilla = ({ datos, cols, px, style }) => (
  <div className="k-rej" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`, ...style }}>
    {datos.map((d) => <div key={d.k}><Valor d={d} px={px} /><Etiqueta>{d.l}</Etiqueta></div>)}
  </div>
);

/** La ruta: una línea de la tinta con puntas redondas y un punto del acento al final (`grosor` × 1.25 de radio). */
function Ruta({ ruta, ancho, alto, grosor = 5, color }) {
  const pts = ajustaRuta(ruta.lat, ruta.lon, ancho, alto, grosor * 2);
  if (!pts) return null;
  const fin = pts[pts.length - 1];
  return (
    <svg width={ancho} height={alto} viewBox={`0 0 ${ancho} ${alto}`} aria-hidden="true">
      <polyline points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')} fill="none" stroke={color.tinta} strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={fin[0].toFixed(1)} cy={fin[1].toFixed(1)} r={(grosor * 1.25).toFixed(1)} fill={color.acento} />
    </svg>
  );
}

function Contenido({ item, f, color }) {
  const { r } = item;
  switch (item.id) {
    case 'titular':
      return (
        <>
          <div className="k-ti k-fit">{f.titulo[0]}</div>
          <div className="k-ti k-fit">{f.titulo[1]}</div>
          <div className="k-tr">{[r.a, r.b, r.c].map((d) => <div key={d.k}><Valor d={d} px={20} /><Etiqueta>{d.l}</Etiqueta></div>)}</div>
          <Marca px={15} style={{ marginTop: 18, textTransform: 'uppercase', /* estilo-ok: el wordmark del Titular va en mayúsculas (diseño del sticker) */ letterSpacing: '.01em' }} />
        </>
      );
    case 'firma':
      return (
        <>
          <div className="k-firma">
            <Valor d={r.g} px={44} className="k-fl" />
            <div className="k-v k-fit k-fl k-wm" style={{ fontSize: 44 }}>Training<span>Lab</span></div>
          </div>
          <div className="k-cap">{fraseCorta(f, r.g)}</div>
        </>
      );
    case 'eco':
      return (
        <>
          <div className="k-ecos">
            <div className="k-v k-ec e1 k-fit" aria-hidden="true" style={{ fontSize: 80 }}>{r.g.v}</div>
            <div className="k-v k-ec e2 k-fit" aria-hidden="true" style={{ fontSize: 80 }}>{r.g.v}</div>
            <div className="k-v k-ec e3 k-fit" style={{ fontSize: 80 }}>{r.g.v}{r.g.u ? <span className="u">{r.g.u}</span> : null}</div>
          </div>
          <div className="k-cap">{fraseCorta(f, r.g)}</div>
          <Marca px={14} style={{ marginTop: 12 }} />
        </>
      );
    case 'grande':
      return (
        <>
          <Valor d={r.g} px={84} />
          <div className="k-fr" style={{ marginTop: 10 }}><Etiqueta>{r.g.l}</Etiqueta><Marca px={14} /></div>
        </>
      );
    case 'fila':
      return (
        <>
          <Rejilla datos={r} cols={3} px={36} />
          <Marca px={14} style={{ marginTop: 22 }} />
        </>
      );
    case 'ruta-dato':
      return (
        <>
          <Ruta ruta={f.ruta} ancho={248} alto={150} color={color} />
          <div style={{ marginTop: 16, width: '100%' }}><Valor d={r.g} px={56} /></div>
          <Rejilla datos={r.lista} cols={2} px={22} style={{ marginTop: 12 }} />
          <Marca px={14} style={{ marginTop: 18 }} />
        </>
      );
    default:
      return null;
  }
}

/** Que nada choque: baja el tamaño de cada valor marcado `k-fit` hasta que quepa en su columna (nunca de 10 px para abajo). Los ecos y la firma comparten tamaño. */
function ajustaSticker(raiz) {
  if (!raiz) return;
  raiz.querySelectorAll('.k-fit').forEach((v) => {
    if (!v.dataset.fs) v.dataset.fs = v.style.fontSize;
    v.style.fontSize = v.dataset.fs;
    const caja = v.parentElement?.getBoundingClientRect().width ?? 0;
    if (!caja) return;
    let s = parseFloat(v.style.fontSize) || 16;
    v.style.display = 'inline-block';
    let vueltas = 0;
    while (v.getBoundingClientRect().width > caja - 1 && s > 10 && vueltas < 90) { s -= 1; v.style.fontSize = `${s}px`; vueltas += 1; }
    v.style.display = '';
  });
  const iguala = (sel, hijos) => raiz.querySelectorAll(sel).forEach((b) => {
    const ls = [...b.querySelectorAll(hijos)];
    const s = Math.min(...ls.map((l) => parseFloat(l.style.fontSize)));
    ls.forEach((l) => { l.style.fontSize = `${s}px`; });
  });
  iguala('.k-ecos', '.k-ec');
  iguala('.k-firma', '.k-fl');
}

/** El sticker a su tamaño real (300 de ancho; alto según la forma). Se ajusta al dibujarse y otra vez cuando la fuente termina de cargar. */
export default function Sticker({ item, f, color, forma = item.forma, alListo }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    let vivo = true;
    ajustaSticker(ref.current);
    const fuente = document.fonts?.load ? document.fonts.load('800 96px "Bricolage Grotesque"') : Promise.resolve();
    fuente.then(() => {
      if (!vivo) return;
      ajustaSticker(ref.current);
      alListo?.(ref.current);
    }).catch(() => { if (vivo) alListo?.(ref.current); });
    return () => { vivo = false; };
  }, [item, f, color, forma, alListo]);
  return (
    <div
      ref={ref} className={`stk ${forma}${color.sombra ? ' sombra' : ''}`}
      style={{ '--stk-tinta': color.tinta, '--stk-acento': color.acento, height: LIENZOS[forma]?.h }}
    >
      <div className="stk-in"><Contenido item={item} f={f} color={color} /></div>
    </div>
  );
}
