import { useLayoutEffect, useRef, useState } from 'react';

/** Lo ancho de un elemento, al cambiar (para el tamaño de los mosaicos). */
export default function useAncho() {
  const ref = useRef(null);
  const [ancho, setAncho] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const mide = () => setAncho(el.clientWidth);
    mide();
    if (typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(mide);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho];
}
