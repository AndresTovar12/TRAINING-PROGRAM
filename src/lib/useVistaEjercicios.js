import { useCallback, useEffect, useState } from 'react';

/**
 * Cómo quiere ver Andrés el repertorio: en lista o en tarjetas.
 *
 * POR QUÉ EXISTE. Andrés, 24 sep 2026: "en cualquier pantalla donde salga la
 * lista de ejercicios, quiero poder verlo de la forma que yo elija, si como
 * lista o como las cards". Hasta ahora lo decidía la app sola, mirando el
 * ancho de la pantalla — y encima con criterios opuestos según la pantalla:
 * el repertorio ponía tarjetas en la compu y lista en el teléfono, y el
 * selector de ejercicios hacía exactamente lo contrario.
 *
 * `null` significa "no ha elegido": ahí cada pantalla se queda con lo que
 * hacía antes. En cuanto toca el interruptor, manda su elección en todas.
 * Así nadie ve un cambio que no pidió.
 *
 * SE GUARDA EN ESTE APARATO, NO EN LA CUENTA. Es una preferencia de cómo se
 * mira una pantalla, y eso depende del aparato que tengas en la mano: en el
 * teléfono puede querer lista y en la compu tarjetas. Guardarlo en la cuenta
 * le impondría una sola respuesta para los dos.
 */
const CLAVE = 'tl:vista-ejercicios';

const lee = () => {
  try {
    const v = localStorage.getItem(CLAVE);
    return v === 'lista' || v === 'tarjetas' ? v : null;
  } catch {
    // Safari en navegación privada tira al leer. Sin preferencia, cada
    // pantalla usa su valor de siempre: se pierde el recuerdo, no la app.
    return null;
  }
};

// Las dos pantallas que muestran ejercicios no están abiertas a la vez hoy,
// pero si algún día lo están, cambiar el interruptor en una tiene que mover
// la otra. Es más barato dejarlo resuelto que acordarse después.
const oyentes = new Set();

export function useVistaEjercicios() {
  const [vista, setVista] = useState(lee);

  useEffect(() => {
    const avisa = (v) => setVista(v);
    oyentes.add(avisa);
    return () => { oyentes.delete(avisa); };
  }, []);

  const elige = useCallback((v) => {
    try {
      localStorage.setItem(CLAVE, v);
    } catch {
      // Sin sitio donde guardar, la elección vale para esta sesión y ya.
    }
    for (const avisa of oyentes) avisa(v);
  }, []);

  return [vista, elige];
}
