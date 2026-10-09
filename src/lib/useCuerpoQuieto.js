import { useEffect } from 'react';

/**
 * Congela la página de atrás mientras una pantalla completa (la cámara, el editor de video, el encuadre) está abierta.
 *
 * En iOS, `overflow: hidden` NO basta: Safari sigue dejando arrastrar, y un dedo que resbala sobre la tira de tiempo o
 * sobre una esquina del encuadre mueve la página que hay debajo (y con ella, la pantalla de encima). Andrés lo vio en la
 * cámara: «aún así puedo escrollear, y no se debe poder». Lo que sí funciona es fijar el cuerpo con `position: fixed`
 * recordando dónde estaba, y devolverlo al cerrar. Es feo, y es la única forma fiable en iOS.
 *
 * Con el cuerpo quieto, las barras de Safari tampoco cambian de estado a mitad de un gesto, así que `100dvh` (la altura
 * que se ve AHORA) no se mueve: por eso estas pantallas miden `height: 100dvh` y no `inset: 0`.
 */
export function useCuerpoQuieto() {
  useEffect(() => {
    const y = window.scrollY;
    const b = document.body;
    const antes = {
      position: b.style.position, top: b.style.top, left: b.style.left,
      right: b.style.right, width: b.style.width, overflow: b.style.overflow,
    };
    b.style.position = 'fixed';
    b.style.top = `-${y}px`;
    b.style.left = '0';
    b.style.right = '0';
    b.style.width = '100%';
    b.style.overflow = 'hidden';
    return () => {
      Object.assign(b.style, antes);
      window.scrollTo(0, y);
    };
  }, []);
}
