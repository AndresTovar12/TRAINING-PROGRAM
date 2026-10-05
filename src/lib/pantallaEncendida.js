import { useEffect } from 'react';

/**
 * Que la pantalla no se apague mientras `activa` sea verdad (el reloj corriendo).
 *
 * Un reloj de entrenamiento que se oscurece a los 30 segundos obliga a tocar la pantalla con las
 * manos llenas de magnesio. Usa la Wake Lock API, que el navegador suelta solo cuando la pestaña
 * pasa a segundo plano; por eso se pide de nuevo al volver. Donde no existe (navegadores viejos),
 * no hace nada y el reloj sigue siendo exacto: se calcula con la hora, no con la pantalla.
 */
export function usePantallaEncendida(activa) {
  useEffect(() => {
    if (!activa || !('wakeLock' in navigator)) return undefined;
    let candado = null;
    let vigente = true;
    const pide = async () => {
      try {
        const nuevo = await navigator.wakeLock.request('screen');
        if (vigente) candado = nuevo; else nuevo.release();
      } catch {
        // El navegador lo puede negar (poca batería, pestaña oculta): no es un error de la app.
      }
    };
    pide();
    const alVolver = () => { if (document.visibilityState === 'visible') pide(); };
    document.addEventListener('visibilitychange', alVolver);
    return () => {
      vigente = false;
      document.removeEventListener('visibilitychange', alVolver);
      candado?.release().catch(() => {});
    };
  }, [activa]);
}
