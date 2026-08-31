import { useEffect, useState } from 'react';

/**
 * Tamaño de pantalla, reactivo. Un solo lugar para decidir "compu vs teléfono"
 * en toda la app, en vez de leer window.innerWidth suelto (que no reacciona al
 * girar el teléfono ni al cambiar el tamaño de la ventana).
 *
 * Se basa en el ANCHO, no en el aparato: una laptop con la ventana angosta debe
 * comportarse como pantalla chica. Para decisiones de "cómo se toca" existe
 * `useCoarsePointer` (dedo vs mouse), que es otra pregunta distinta.
 */
export function useMedia(query) {
  const get = () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false);
  const [matches, setMatches] = useState(get);

  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = (e) => setMatches(e.matches);
    setMatches(mq.matches);

    // Safari anterior a la version 14 (iOS 13 y abajo) no acepta
    // addEventListener aqui: solo tiene el addListener viejo. Si se llama el
    // nuevo a secas, revienta con TypeError, y como esto corre dentro de un
    // hook que usa media app, el usuario ve pantalla en blanco. Se prueba el
    // moderno y se cae al antiguo.
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', onChange);
      return () => mq.removeEventListener('change', onChange);
    }
    mq.addListener(onChange);
    return () => mq.removeListener(onChange);
  }, [query]);

  return matches;
}

// Escritorio: hay ancho para menú lateral + tablas (≥ 1024px)
export const useIsDesktop = () => useMedia('(min-width: 1024px)');

// Tablet o más: dos columnas caben (≥ 768px)
export const useIsWide = () => useMedia('(min-width: 768px)');

// Se toca con el dedo (sin mouse fino): botones más grandes, sin hover
export const useCoarsePointer = () => useMedia('(pointer: coarse)');
