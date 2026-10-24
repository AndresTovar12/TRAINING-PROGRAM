import { useEffect } from 'react';
import { Capacitor } from '@capacitor/core';

/**
 * Pide que la pantalla no se apague y devuelve cómo soltarla. Dentro de la app de iPhone usa el plugin nativo (la Wake Lock del navegador no existe en
 * todas las versiones del WebView); en la web, la Wake Lock API, que el navegador suelta sola al pasar la pestaña a segundo plano.
 * `sigue()` regresa `false` si no se pudo pedir.
 */
export async function pideQueNoSeApague() {
  try {
    if (Capacitor.isNativePlatform()) {
      const { KeepAwake } = await import('@capacitor-community/keep-awake');
      await KeepAwake.keepAwake();
      return { suelta: () => { KeepAwake.allowSleep().catch(() => {}); }, nativo: true };
    }
    if (typeof navigator !== 'undefined' && 'wakeLock' in navigator) {
      const candado = await navigator.wakeLock.request('screen');
      return { suelta: () => { candado.release().catch(() => {}); }, nativo: false };
    }
  } catch {
    // Puede negarse (poca batería, pestaña oculta): no es un error de la app.
  }
  return null;
}

/**
 * Que la pantalla no se apague mientras `activa` sea verdad (el reloj corriendo).
 *
 * Un reloj de entrenamiento que se oscurece a los 30 segundos obliga a tocar la pantalla con las manos llenas de magnesio. En la web el navegador suelta el
 * candado al ocultar la pestaña, por eso se pide de nuevo al volver. Donde no existe, no hace nada y el reloj sigue siendo exacto: se calcula con la hora.
 */
export function usePantallaEncendida(activa) {
  useEffect(() => {
    if (!activa) return undefined;
    let candado = null;
    let vigente = true;
    const pide = async () => {
      const nuevo = await pideQueNoSeApague();
      if (vigente) { candado?.suelta(); candado = nuevo; } else nuevo?.suelta();
    };
    pide();
    const alVolver = () => { if (document.visibilityState === 'visible') pide(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vigente = false;
      document.removeEventListener('visibilitychange', alVolver);
      candado?.suelta();
    };
  }, [activa]);
}
