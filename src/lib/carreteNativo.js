/* EL CARRETE DEL IPHONE, EL PUENTE (24 nov 2026). Solo en la app de iPhone; en la web no hay carrete (queda el selector de archivos).

   `CarretePlugin.swift` lee las fotos más recientes y da sus miniaturas (archivos locales) para la rejilla de la hoja de compartir, el original de la que se
   toca (ya derecho, JPEG de 4 MP como mucho) y guarda en Fotos la imagen terminada. Ninguna promesa se resuelve con el plugin (la trampa de `.then`, ver
   `lib/tiempoLimite.js`): cada función contesta solo lo que devuelve, con tiempo límite, y nunca se queda colgada. */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { conTiempoLimite } from './tiempoLimite.js';

const Carrete = registerPlugin('Carrete');

export const hayCarrete = () => Capacitor.isNativePlatform();

const aBase64 = (blob) => new Promise((ok, falla) => {
  const lector = new FileReader();
  lector.onload = () => ok(String(lector.result).split(',')[1] ?? '');
  lector.onerror = () => falla(lector.error);
  lector.readAsDataURL(blob);
});

/** El permiso de Fotos: 'si' | 'limitado' | 'negado' | 'sin_preguntar' (o null si el puente no contestó: un build viejo). */
export async function permisoDeFotos() {
  try {
    const r = await conTiempoLimite(Carrete.permiso(), 3000);
    return r?.permiso ?? null;
  } catch {
    return null;
  }
}

/** Pide el permiso (la pregunta de iOS). Sin tope corto: espera a que la persona conteste. */
export async function pidePermisoDeFotos() {
  try {
    const r = await Carrete.pide();
    return r?.permiso ?? null;
  } catch {
    return null;
  }
}

/** Las más recientes: [{ id, tipo: 'foto' | 'video', duracion, src }] (`src`, la miniatura lista para un <img>). */
export async function fotosRecientes({ cuantos = 60, lado = 300 } = {}) {
  const r = await conTiempoLimite(Carrete.recientes({ cuantos, lado }), 20000);
  return (r?.fotos ?? []).map((x) => ({ id: x.id, tipo: x.tipo, duracion: Number(x.duracion) || 0, src: Capacitor.convertFileSrc(x.miniatura) }));
}

/** El original de una foto, como Blob JPEG (para `preparaFoto` y el editor). */
export async function originalDeFoto(id) {
  const r = await conTiempoLimite(Carrete.original({ id }), 60000);
  if (!r?.ruta) throw new Error('No se pudo leer la foto');
  const resp = await fetch(Capacitor.convertFileSrc(r.ruta));
  if (!resp.ok) throw new Error('No se pudo leer la foto');
  return resp.blob();
}

/* LOS VIDEOS (27 nov 2026, parte 2b). El video se copia tal cual a la carpeta temporal (sin volver a codificarlo) y el iPhone le pone los stickers encima
   (`ComponeVideo.swift`): así el color HDR se queda como en la galería. La página solo dibuja la capa de stickers (un PNG transparente de 1080 × 1920). */

/** Las más recientes, solo videos (para la pestaña «Videos»). Mismo formato que `fotosRecientes`. */
export async function videosRecientes({ cuantos = 60, lado = 300 } = {}) {
  const r = await conTiempoLimite(Carrete.recientes({ cuantos, lado, tipo: 'video' }), 20000);
  return (r?.fotos ?? []).map((x) => ({ id: x.id, tipo: x.tipo, duracion: Number(x.duracion) || 0, src: Capacitor.convertFileSrc(x.miniatura) }));
}

/** Un video del carrete, listo para el editor: `{ ruta, src, poster, duracion, hdr }` (`ruta`: el archivo, para el iPhone; `src` y `poster`: para la página). */
export async function videoDelCarrete(id) {
  const r = await conTiempoLimite(Carrete.video({ id }), 180000);
  if (!r?.ruta) throw new Error('No se pudo leer el video');
  return { ruta: r.ruta, src: Capacitor.convertFileSrc(r.ruta), poster: r.poster ? Capacitor.convertFileSrc(r.poster) : null, duracion: Number(r.duracion) || 0, hdr: !!r.hdr };
}

/** El video con la capa de stickers encima (`capa`: Blob PNG 1080 × 1920), solo de `inicio` a `fin` (segundos, lo elegido al recortar). `{ ruta, src, hdr }`. */
export async function armaVideo({ ruta, capa, inicio = 0, fin = null }) {
  const r = await conTiempoLimite(Carrete.armaVideo({ ruta, capa: await aBase64(capa), inicio, ...(fin != null ? { fin } : null) }), 300000);
  if (!r?.ruta) throw new Error('No se pudo armar el video');
  return { ruta: r.ruta, src: Capacitor.convertFileSrc(r.ruta), hdr: !!r.hdr };
}

/** Cuadros parejos del video para la tira de «Recortar»: [src]. */
export async function cuadrosDeVideo(ruta, { cuantos = 10, alto = 120 } = {}) {
  const r = await conTiempoLimite(Carrete.cuadros({ ruta, cuantos, alto }), 30000);
  return (r?.cuadros ?? []).map((c) => Capacitor.convertFileSrc(c));
}

/** Guarda en Fotos un video ya armado (`ruta` de `armaVideo`). */
export async function guardaVideoEnFotos(ruta) {
  await conTiempoLimite(Carrete.guardaVideo({ ruta }), 60000);
}

/** El menú de compartir del iPhone con el video ya armado. */
export async function compartirVideo(ruta) {
  const { Share } = await import('@capacitor/share');
  try {
    await Share.share({ files: [ruta], dialogTitle: 'Tu video' });
  } catch (e) {
    if (!/cancel/i.test(String(e?.message ?? e))) throw e;
  }
}

/** Abre Instagram con el video ya puesto como historia. */
export async function videoAHistoriaDeInstagram(ruta) {
  await conTiempoLimite(Carrete.historiaDeInstagram({ video: ruta, appId: META_APP_ID }), 30000);
}

/** Guarda una imagen (Blob) en Fotos. Lanza 'negado' si no hay permiso. */
export async function guardaEnFotos(blob) {
  await conTiempoLimite(Carrete.guarda({ datos: await aBase64(blob) }), 30000);
}

/** El App ID de Meta de «Training Lab» (developers.facebook.com, 24 nov 2026). No es secreto: Instagram lo pide para «compartir a historias». */
export const META_APP_ID = '1831471268061512';

/** Abre Instagram con la imagen ya puesta como historia. Lanza 'sin_instagram' si no está instalado (o un error si el build es viejo). */
export async function aHistoriaDeInstagram(blob) {
  await conTiempoLimite(Carrete.historiaDeInstagram({ datos: await aBase64(blob), appId: META_APP_ID }), 15000);
}

/** Con acceso limitado: el selector de iOS para sumar fotos. */
export async function eligeMasFotos() {
  try { await Carrete.eligeMas(); } catch { /* sin pantalla o build viejo */ }
}

/** Los ajustes de la app (para dar el permiso que se negó). */
export async function abreAjustes() {
  try { await Carrete.ajustes(); } catch { /* build viejo */ }
}
