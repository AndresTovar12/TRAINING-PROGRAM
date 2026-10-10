import { aImagenWeb, esImagen, optimizaImagen, pesoTexto } from '@/lib/imagen';
import { conIndice } from '@/lib/indiceDeVideo';

/* PREPARAR UN ARCHIVO ANTES DE MANDARLO: una foto se pasa a un formato que todos ven y se achica; un video se revisa (cuánto dura, cuánto pesa) y se le pone índice para
   que empiece a verse rápido; una nota de voz ya viene lista de la grabadora.

   Andrés, 10 oct 2026: «fotos, videos y notas de voz» en el chat; los videos hasta 60 s. El bucket tiene un tope de 50 MB por archivo. Todo lo que no se pueda mandar se
   rechaza con una frase que diga QUÉ hacer (no «error»). */

export const LIMITES = { videoSegundos: 60, videoMB: 50, vozSegundos: 180 };

const esVideo = (f) => /^video\//i.test(f.type || '') || /\.(mp4|mov|m4v|webm)$/i.test(f.name || '');

/** Cuánto dura y qué tamaño tiene un video, o `null` si el navegador no lo sabe leer (algunos formatos no se pueden mirar sin reproducirlos). */
export function leeVideo(archivo) {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(archivo);
    const v = document.createElement('video');
    const fin = (valor) => { clearTimeout(espera); URL.revokeObjectURL(url); v.removeAttribute('src'); v.load(); resolve(valor); };
    const espera = setTimeout(() => fin(null), 8000);
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => fin(Number.isFinite(v.duration) ? { segundos: Math.round(v.duration * 10) / 10, ancho: v.videoWidth || null, alto: v.videoHeight || null } : null);
    v.onerror = () => fin(null);
    v.src = url;
  });
}

async function medidasDeFoto(archivo) {
  try {
    const bmp = await createImageBitmap(archivo);
    const m = { ancho: bmp.width, alto: bmp.height };
    bmp.close?.();
    return m;
  } catch {
    return {};
  }
}

/**
 * Lo que se va a mandar a partir de lo que eligió la persona: `{ tipo: 'foto' | 'video', archivo, mime, meta }`.
 * Lanza un `Error` con la frase para enseñar tal cual si no se puede.
 */
export async function preparaArchivo(elegido) {
  if (esImagen(elegido)) {
    const { archivo } = await optimizaImagen(await aImagenWeb(elegido));
    if (archivo.size > 12 * 1048576) throw new Error(`La foto pesa ${pesoTexto(archivo.size)}. Elige una más ligera.`);
    return { tipo: 'foto', archivo, mime: archivo.type, meta: await medidasDeFoto(archivo) };
  }
  if (esVideo(elegido)) {
    if (elegido.size > LIMITES.videoMB * 1048576) {
      throw new Error(`El video pesa ${pesoTexto(elegido.size)} y el máximo es ${LIMITES.videoMB} MB (unos ${LIMITES.videoSegundos} segundos). Graba uno más corto.`);
    }
    const medidas = await leeVideo(elegido);
    if (medidas && medidas.segundos > LIMITES.videoSegundos + 0.5) {
      throw new Error(`El video dura ${Math.round(medidas.segundos)} segundos y el máximo es ${LIMITES.videoSegundos}. Elige uno más corto.`);
    }
    const { archivo } = await conIndice(elegido);
    return { tipo: 'video', archivo, mime: archivo.type || elegido.type || 'video/mp4', meta: medidas ?? {} };
  }
  throw new Error('Solo se pueden mandar fotos, videos y notas de voz.');
}
