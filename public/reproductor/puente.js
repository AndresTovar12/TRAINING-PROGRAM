/**
 * EL PUENTE DE LOS VIDEOS DE REDES (24 nov 2026). Andrés: los videos con link (YouTube, TikTok, Instagram…) te mandaban fuera de la app.
 *
 * Por qué hace falta: la app del iPhone vive en `capacitor://localhost`, que no es una dirección de internet. Desde 2025 YouTube exige saber
 * desde qué sitio se reproduce un video («Error 153» si no). Esta página vive en `app.traininglabapp.com`: la app la pone en su marco, y ella
 * pone el reproductor OFICIAL de cada red. Así el video se ve dentro de la app, con el link tal cual (nada se descarga).
 *
 * Qué recibe: `?de=<red>&e=<dirección del reproductor oficial>` (la arma `ligaExterna` en `src/lib/ligas.js`).
 * Qué devuelve a la app (postMessage): `{ tlVideo: 'fin' }` cuando el video termina y `{ tlVideo: 'error' }` si la red lo bloquea; solo de
 * YouTube, Vimeo y Dropbox (las demás no lo dicen). Solo acepta reproductores de las redes de la lista: no es una puerta para poner cualquier
 * página dentro de nuestro dominio.
 *
 * Las cabeceras de esta carpeta (`public/_headers` y `vercel.json`) dejan que se ponga en un marco; el resto de la app sigue sin dejarlo.
 */

/** Los reproductores oficiales que se aceptan, por red (el host y el principio de la ruta). */
export const PERMITIDOS = {
  YouTube: [['www.youtube.com', '/embed/'], ['www.youtube-nocookie.com', '/embed/']],
  Vimeo: [['player.vimeo.com', '/video/']],
  TikTok: [['www.tiktok.com', '/embed/']],
  Instagram: [['www.instagram.com', '/']],
  Facebook: [['www.facebook.com', '/plugins/video.php']],
  'Google Drive': [['drive.google.com', '/file/d/']],
  Dropbox: [['www.dropbox.com', '/'], ['dl.dropboxusercontent.com', '/']],
};

/** La dirección final del reproductor, o `null` si no es de una red permitida. `origen`: el de esta página (lo pide YouTube). */
export function reproductorDe(de, e, origen, { arranca = false } = {}) {
  let u;
  try { u = new URL(e); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const ok = (PERMITIDOS[de] ?? []).some(([host, ruta]) => u.hostname === host && u.pathname.startsWith(ruta));
  if (!ok) return null;
  if (de === 'Instagram' && !/\/embed\/?$/.test(u.pathname)) return null;
  if (de === 'YouTube') { u.searchParams.set('enablejsapi', '1'); u.searchParams.set('playsinline', '1'); u.searchParams.set('rel', '0'); u.searchParams.set('origin', origen); }
  if (de === 'Vimeo') { u.searchParams.set('playsinline', '1'); u.searchParams.set('api', '1'); }
  // `auto=1`: la app ya recibió el toque de la persona; el video arranca sin otro (un solo toque, 24 nov 2026).
  if (arranca && (de === 'YouTube' || de === 'Vimeo')) u.searchParams.set('autoplay', '1');
  return u.toString();
}

/* ---- La página (solo en el navegador) ---- */
if (typeof document !== 'undefined') {
  const p = new URLSearchParams(location.search);
  const de = p.get('de') ?? '';
  const arranca = p.get('auto') === '1';
  const src = reproductorDe(de, p.get('e') ?? '', location.origin, { arranca });
  const avisa = (tlVideo) => { try { parent.postMessage({ tlVideo }, '*'); } catch { /* sin marco: nada que avisar */ } };
  let avisado = false;
  const fin = () => { if (!avisado) { avisado = true; avisa('fin'); } };

  if (!src) {
    document.body.textContent = 'Este video no se puede mostrar aquí.';
    document.body.className = 'aviso';
    avisa('error');
  } else if (de === 'Dropbox') {
    // La liga es el archivo mismo: un <video> como los nuestros, que sí dice cuándo termina.
    const v = document.createElement('video');
    Object.assign(v, { src, controls: true, playsInline: true, preload: 'metadata', autoplay: arranca });
    v.setAttribute('playsinline', '');
    v.addEventListener('ended', fin);
    v.addEventListener('error', () => avisa('error'));
    document.body.appendChild(v);
  } else {
    const f = document.createElement('iframe');
    f.src = src;
    f.title = `Video en ${de}`;
    f.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
    f.allowFullscreen = true;
    // YouTube y Vimeo dicen por mensajes cuándo termina el video: se les pide al cargar.
    f.addEventListener('load', () => {
      try {
        if (de === 'YouTube') f.contentWindow.postMessage(JSON.stringify({ event: 'listening', id: 'tl', channel: 'widget' }), '*');
        if (de === 'Vimeo') ['ended', 'error'].forEach((value) => f.contentWindow.postMessage(JSON.stringify({ method: 'addEventListener', value }), '*'));
      } catch { /* el marco no deja: la app conserva su botón de abrir fuera */ }
    });
    document.body.appendChild(f);
    window.addEventListener('message', (e) => {
      if (e.source !== f.contentWindow) return;
      let d = e.data;
      if (typeof d === 'string') { try { d = JSON.parse(d); } catch { return; } }
      if (!d || typeof d !== 'object') return;
      const terminoYt = (d.event === 'onStateChange' && d.info === 0) || (d.event === 'infoDelivery' && d.info?.playerState === 0);
      if (terminoYt || d.event === 'ended') fin();
      if (d.event === 'onError' || d.event === 'error') avisa('error');
    });
  }
}
