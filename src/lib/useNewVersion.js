import { useEffect, useState } from 'react';

/**
 * Detecta si el servidor ya tiene una versión más nueva de la app.
 *
 * Compara el bundle que esta pestaña tiene cargado contra el que declara el
 * index.html vivo. El HTML se sirve con `must-revalidate`, así que pedirlo con
 * `no-store` siempre trae el actual. No necesita service worker ni tocar el
 * build: el nombre del bundle ya cambia en cada deploy (hash por contenido).
 */
const BUNDLE_RE = /assets\/index-[A-Za-z0-9_-]+\.js/;
const EVERY_5_MIN = 5 * 60 * 1000;

export function useNewVersion() {
  const [stale, setStale] = useState(false);

  useEffect(() => {
    if (import.meta.env.DEV) return; // en desarrollo ya hay hot-reload

    const script = document.querySelector('script[src*="/assets/index-"]');
    const current = script?.getAttribute('src')?.match(BUNDLE_RE)?.[0];
    if (!current) return;

    let done = false;

    const check = async () => {
      if (done || document.hidden) return;
      try {
        const res = await fetch(`/?v=${Date.now()}`, { cache: 'no-store' });
        if (!res.ok) return;
        const live = (await res.text()).match(BUNDLE_RE)?.[0];
        if (live && live !== current) {
          done = true;
          setStale(true);
        }
      } catch {
        // sin red: reintenta en el próximo ciclo, nunca rompe la app
      }
    };

    const onVisible = () => { if (!document.hidden) check(); };

    check();
    const timer = setInterval(check, EVERY_5_MIN);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      done = true;
      clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, []);

  return stale;
}
