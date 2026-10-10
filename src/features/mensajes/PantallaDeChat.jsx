import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { T, FONT } from '@/lib/theme';
import { useCuerpoQuieto } from '@/lib/useCuerpoQuieto';

/* La conversación a pantalla completa (teléfono) y centrada en una columna (computadora), por encima de la barra de abajo.

   Con el teclado abierto en iPhone, la página «visible» se encoge pero la que mide `100dvh` no: por eso se sigue la altura de `visualViewport` (y cuánto se corrió),
   y la caja de escribir se queda justo encima del teclado. Se cuelga del documento: un antepasado con `transform` u `overflow` la recortaría. */
function useZonaVisible() {
  const leer = () => {
    const vv = window.visualViewport;
    return { alto: vv?.height ?? window.innerHeight, arriba: vv?.offsetTop ?? 0 };
  };
  const [zona, setZona] = useState(leer);
  useEffect(() => {
    const vv = window.visualViewport;
    const alCambiar = () => setZona(leer());
    vv?.addEventListener('resize', alCambiar);
    vv?.addEventListener('scroll', alCambiar);
    window.addEventListener('resize', alCambiar);
    return () => { vv?.removeEventListener('resize', alCambiar); vv?.removeEventListener('scroll', alCambiar); window.removeEventListener('resize', alCambiar); };
  }, []);
  return zona;
}

export default function PantallaDeChat({ children }) {
  useCuerpoQuieto();
  const { alto, arriba } = useZonaVisible();
  return createPortal(
    <div style={{ position: 'fixed', top: arriba, left: 0, right: 0, height: alto, zIndex: 200, background: T.bg, fontFamily: FONT, display: 'flex', justifyContent: 'center' }}>
      <div style={{ width: '100%', maxWidth: 680, height: '100%', background: T.bg, boxShadow: '0 0 0 1px rgba(17,19,24,0.06)' }}>{children}</div>
    </div>,
    document.body,
  );
}
