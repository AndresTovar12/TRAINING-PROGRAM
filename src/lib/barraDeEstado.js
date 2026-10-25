import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/* LA BARRA DE ESTADO (hora, batería) CON LETRAS CLARAS, mientras una pantalla oscura a pantalla completa esté abierta (mapa de la carrera, 25 oct 2026).
   La app vive con letras oscuras (`nativo.js`, `Style.Light`): sobre el mapa oscuro la hora se veía negra sobre negro. En Capacitor `Style.Dark` significa
   «letras claras para un fondo oscuro». Varias pantallas pueden pedirla a la vez: se restaura cuando se va la última. En la web no hace nada. */

let pedidas = 0;
let fila = Promise.resolve();

const pon = (clara) => {
  if (!Capacitor.isNativePlatform()) return;
  // En fila: pedir y restaurar en seguidilla no se pisan.
  fila = fila.then(async () => {
    try {
      const { StatusBar, Style } = await import('@capacitor/status-bar');
      await StatusBar.setStyle({ style: clara ? Style.Dark : Style.Light });
    } catch (e) { console.warn('Barra de estado:', e); }
  });
};

export function useBarraDeEstadoClara(activa = true) {
  useEffect(() => {
    if (!activa) return undefined;
    pedidas += 1;
    if (pedidas === 1) pon(true);
    return () => { pedidas -= 1; if (pedidas === 0) pon(false); };
  }, [activa]);
}
