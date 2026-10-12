import { ArrowUpRight } from 'lucide-react';
import './widgets.css';

/* UN WIDGET de Home (12 oct 2026): una casilla con degradado, su ícono (chico arriba y grande a medio tapar de marca de agua), el nombre y una línea. `tono`: tinta | violeta | menta | coral |
   azul | claro. Va en una cuadrícula de dos (`.tl-w-grid`); el último, si queda solo, ocupa el ancho entero. `decoracion`: algo que asoma dentro (la mini activity card). */
export default function Widget({ tono = 'azul', Icono, titulo, sub, alTocar, decoracion = null, etiqueta, flecha = true }) {
  return (
    <button type="button" className="tl-w" data-tono={tono} onClick={alTocar} aria-label={etiqueta ?? [titulo, sub].filter(Boolean).join('. ')}>
      <span className="tl-w-cab">
        <span className="tl-w-ic" aria-hidden="true"><Icono /></span>
        {flecha && <ArrowUpRight className="tl-w-flecha" aria-hidden="true" />}
      </span>
      {decoracion}
      <Icono className="tl-w-marca" aria-hidden="true" />
      <span>
        <span className="tl-w-tit" style={{ display: 'block' }}>{titulo}</span>
        {sub && <span className="tl-w-sub" style={{ display: 'block' }}>{sub}</span>}
      </span>
    </button>
  );
}
