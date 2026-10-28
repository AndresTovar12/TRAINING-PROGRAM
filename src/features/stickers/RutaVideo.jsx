import { useLayoutEffect, useRef } from 'react';
import { ajustaRuta } from '@/lib/stickers/ruta';
import { LIENZOS } from '@/lib/stickers/catalogo';
import './stickers.css';

/* «RUTA DIBUJÁNDOSE» (pestaña Video): la ruta que se dibuja sola, con la distancia y el tiempo debajo y el wordmark. En la hoja se anima con CSS
   (`.stk-trazo`); el video lo arma `exporta.js` con este mismo dibujo (lee los puntos de `data-puntos`). Solo existe si hubo ruta (`f.ruta`). */

const ANCHO = 248;
const ALTO = 200;
const GROSOR = 6;

export default function RutaVideo({ f, color, anima = false, alListo }) {
  const ref = useRef(null);
  const pts = ajustaRuta(f.ruta.lat, f.ruta.lon, ANCHO, ALTO, GROSOR * 2) ?? [];
  const d = f.datos;
  useLayoutEffect(() => {
    let vivo = true;
    const fuente = document.fonts?.load ? document.fonts.load('800 96px "Bricolage Grotesque"') : Promise.resolve();
    fuente.catch(() => null).then(() => { if (vivo) alListo?.(ref.current); });
    return () => { vivo = false; };
  }, [alListo]);
  return (
    <div ref={ref} className={`stk alto${color.sombra ? ' sombra' : ''}`} style={{ '--stk-tinta': color.tinta, '--stk-acento': color.acento, height: LIENZOS.alto.h }}>
      <div className="stk-in" style={{ alignItems: 'center', textAlign: 'center' }}>
        <svg width={ANCHO} height={ALTO} viewBox={`0 0 ${ANCHO} ${ALTO}`} aria-hidden="true" data-puntos={JSON.stringify(pts)} data-grosor={GROSOR}>
          <polyline
            className={anima ? 'stk-trazo' : undefined} pathLength="1" points={pts.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ')}
            fill="none" stroke={color.tinta} strokeWidth={GROSOR} strokeLinecap="round" strokeLinejoin="round"
          />
        </svg>
        <div className="k-v" style={{ fontSize: 30, marginTop: 14 }}>
          {d.dist ? <>{d.dist.v}<span className="u">{d.dist.u}</span>{' · '}</> : null}{d.tiempo?.v}
        </div>
        <div className="k-wm" style={{ fontSize: 16, marginTop: 14 }}>Training<span>Lab</span></div>
      </div>
    </div>
  );
}
