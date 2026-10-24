/* LO QUE SOLO EXISTE DENTRO DE LA APP DE IPHONE (Capacitor). En la web nada de esto corre: `iniciaNativo()` regresa de inmediato.

   Qué hace al abrir la app (una sola vez, desde `main.jsx`):
     1. Barra de estado (hora, batería) con letras oscuras sobre la app clara.
     2. Teclado: sin la barra gris de «anterior / siguiente» que tapa campos.
     3. Quita la pantalla de arranque en cuanto la web está lista.
     4. Cambia el GPS del navegador por el del teléfono, que SÍ sigue midiendo con la pantalla bloqueada (`usaFuenteDeUbicacion`).
     5. Los links de invitación y los QR (`https://app.traininglabapp.com/?invitacion=…`, `?unirse=…`) abren la app y la dejan en esa pantalla.
   Cada paso va en su propio `try`: si un plugin falla, la app sigue abriendo igual que la web. */

import { Capacitor } from '@capacitor/core';
import { usaFuenteDeUbicacion } from './ubicacion.js';

export const enLaApp = () => Capacitor.isNativePlatform();

/** El GPS del teléfono. A diferencia del del navegador, sigue mandando puntos con la pantalla apagada (necesita el permiso «Siempre» y el modo de fondo «location» del Info.plist). */
const fuenteDelTelefono = {
  nombre: 'telefono',
  segundoPlano: true,
  disponible: () => true,
  sigue(alPunto, alError) {
    let vivo = true;
    import('@capgo/background-geolocation').then(({ BackgroundGeolocation }) => {
      if (!vivo) return;
      BackgroundGeolocation.start(
        {
          backgroundTitle: 'Training Lab',
          backgroundMessage: 'Midiendo tu entreno',
          requestPermissions: true,
          stale: false,
          distanceFilter: 0,
        },
        (p, error) => {
          if (!vivo) return;
          if (error) { alError?.(error.code === 'NOT_AUTHORIZED' ? 'negado' : 'sin_senal'); return; }
          if (!p) return;
          alPunto({
            lat: p.latitude, lon: p.longitude, precision: p.accuracy,
            ...(typeof p.altitude === 'number' ? { alt: p.altitude } : {}),
          });
        },
      ).catch(() => { if (vivo) alError?.('sin_senal'); });
    }).catch(() => { if (vivo) alError?.('sin_senal'); });
    return () => {
      vivo = false;
      import('@capgo/background-geolocation').then(({ BackgroundGeolocation }) => BackgroundGeolocation.stop()).catch(() => {});
    };
  },
};

/** Un link de la web (`https://app.traininglabapp.com/ruta?x=1`) → la misma pantalla dentro de la app (que vive en `capacitor://localhost`). */
const alLink = (url) => {
  try {
    const u = new URL(url);
    if (u.hostname !== 'app.traininglabapp.com') return;
    window.location.assign(`${u.pathname}${u.search}${u.hash}` || '/');
  } catch { /* link raro: se ignora */ }
};

export async function iniciaNativo() {
  if (!enLaApp()) return;

  // La página llega hasta debajo de la hora y de la barra de inicio del iPhone (`contentInset: never` en capacitor.config.json); sin `viewport-fit=cover`
  // `env(safe-area-inset-*)` vale 0 y los encabezados quedan debajo del notch.
  document.querySelector('meta[name="viewport"]')?.setAttribute('content', 'width=device-width, initial-scale=1.0, viewport-fit=cover');
  document.documentElement.classList.add('en-app');

  // Antes de cualquier `await`: las pantallas de entreno leen la fuente al dibujarse.
  try { usaFuenteDeUbicacion(fuenteDelTelefono); } catch { /* se queda el GPS del navegador */ }

  try {
    const { StatusBar, Style } = await import('@capacitor/status-bar');
    await StatusBar.setStyle({ style: Style.Light });
  } catch { /* sin barra de estado propia: no pasa nada */ }

  try {
    const { Keyboard } = await import('@capacitor/keyboard');
    await Keyboard.setAccessoryBarVisible({ isVisible: false });
  } catch { /* igual */ }

  try {
    const { App } = await import('@capacitor/app');
    App.addListener('appUrlOpen', (e) => alLink(e?.url ?? ''));
  } catch { /* sin links que abran la app */ }

  try {
    const { SplashScreen } = await import('@capacitor/splash-screen');
    await SplashScreen.hide();
  } catch { /* igual */ }
}
