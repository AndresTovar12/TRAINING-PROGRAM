import { saltaA } from './fotogramas.js';

/**
 * Las miniaturas de la tira del tiempo del editor de video, con UN solo decodificador.
 *
 * Antes la tira eran diez `<video>` del mismo archivo, cada uno congelado en un punto distinto. En la compu pasa
 * desapercibido; en un iPhone son diez decodificadores a la vez sobre un video de 1080p, y se nota: la tira se pinta a
 * tirones, cuadro por cuadro, y todo el editor se vuelve pastoso (Andrés, 9 oct 2026: «está un poco glitchoso»).
 *
 * Aquí se abre UN video escondido, se lleva a cada punto, se copia el fotograma a un lienzo chico y se guarda como imagen.
 * La tira se pinta de una vez, con diez imágenes de unos pocos KB. Para un video ya subido se pide con permiso de otro
 * dominio (`crossOrigin`): el bucket lo autoriza (ver `fotogramas.js`). Si algo no se puede —un navegador que no deja leer
 * el lienzo—, lanza, y el editor vuelve a la tira de videos de antes.
 */
export async function miniaturasDeVideo(src, cuantas, { remoto = false, alto = 80 } = {}) {
  const v = document.createElement('video');
  v.muted = true;
  v.playsInline = true;
  v.preload = 'auto';
  if (remoto) v.crossOrigin = 'anonymous';
  const metadatos = new Promise((ok, mal) => {
    const t = setTimeout(() => mal(new Error('no llegaron las medidas del video')), 8000);
    v.addEventListener('loadedmetadata', () => { clearTimeout(t); ok(); }, { once: true });
    v.addEventListener('error', () => { clearTimeout(t); mal(new Error('el navegador no puede abrir este video')); }, { once: true });
  });
  v.src = src;
  try {
    await metadatos;
    const dur = v.duration;
    if (!Number.isFinite(dur) || dur <= 0 || !v.videoWidth || !v.videoHeight) throw new Error('video sin duración o sin medidas');
    const lienzo = document.createElement('canvas');
    const k = alto / v.videoHeight;
    lienzo.width = Math.max(1, Math.round(v.videoWidth * k));
    lienzo.height = alto;
    const ctx = lienzo.getContext('2d');
    const salida = [];
    for (let i = 0; i < cuantas; i += 1) {
      await saltaA(v, (dur / cuantas) * i + dur / (cuantas * 2), 4000);
      ctx.drawImage(v, 0, 0, lienzo.width, lienzo.height);
      // Lanza si el lienzo quedó «sucio» (un video de otro dominio sin permiso): entonces se usa la tira de videos.
      salida.push(lienzo.toDataURL('image/jpeg', 0.65));
    }
    return salida;
  } finally {
    v.removeAttribute('src');
    v.load();
  }
}
