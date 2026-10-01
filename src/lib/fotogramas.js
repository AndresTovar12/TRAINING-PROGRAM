/**
 * La FOTO de un video, sacada por la propia app en milisegundos.
 *
 * POR QUÉ EXISTE. Andrés, 1 oct 2026: la portada de un ejercicio «ya tendría
 * que estar ahí inmediatamente», y no un cuadro negro mientras el video
 * carga. Y pidió que fuera «el código de la app, automáticamente y siempre,
 * sin que retrase nada», no una foto puesta a mano.
 *
 * Hasta hoy la portada de un ejercicio sin foto era el propio video abierto
 * en chiquito y congelado a la mitad del recorte (ver `Portada`). Eso obliga a
 * pedirle a Cloudflare el índice del video, saltar a la mitad y bajar varios
 * MB, por CADA ejercicio de la lista: 2-5 s en el mejor caso (12-18 s antes de
 * ponerles índice), y negro mientras tanto. Una foto de 30 KB sale al instante.
 *
 * QUÉ HACE ESTO: dado un <video> que ya está listo, saca el fotograma de la
 * mitad del recorte y lo deja en tres tamaños:
 *   - `grande`  la ficha del ejercicio y el reproductor
 *   - `mini`    listas y tarjetas
 *   - `lqip`    una vista previa de 24 px, borrosa, tan chica que viaja DENTRO de
 *               los datos del ejercicio: se ve al instante, antes de que llegue
 *               ninguna imagen, y la foto nítida entra encima.
 * Es el fotograma COMPLETO, sin el encuadre: el encuadre se aplica al mostrar,
 * igual que con el video, y así editarlo después no deja la foto desfasada.
 *
 * DOS SITIOS LA USAN:
 *   1. Al subir un video (`EditorVideo`): se saca del video que el coach ya
 *      está viendo en pantalla, a la vez que se sube, y no agrega espera.
 *   2. Para los videos que ya estaban sin foto (`completaPortadas`): se abre el
 *      video de Cloudflare, escondido, y se le saca. Funciona porque el bucket
 *      ya autoriza a la app a leerlo (CORS), con `crossOrigin="anonymous"`.
 *
 * NUNCA ROMPE NADA: ante cualquier fallo devuelve `null` y el ejercicio se ve
 * como siempre. Y nunca guarda una foto negra: si el fotograma no se pintó,
 * es mejor no tener foto que tener una negra.
 */

// Segundos de un recorte, o null si no hay. La base los manda como número o
// como texto según la columna, y null o vacío es «sin recorte».
export const segundos = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
};

// El punto medio de lo que se ve: del recorte si lo hay, del video si no.
export function mitadDe(duracion, desde, hasta) {
  const total = Number.isFinite(duracion) && duracion > 0 ? duracion : null;
  const ini = desde ?? 0;
  const fin = Math.min(hasta ?? Infinity, total ?? Infinity);
  if (!Number.isFinite(fin) || fin <= ini) return total ? total / 2 : 0.1;
  return ini + (fin - ini) / 2;
}

const ANCHO_GRANDE = 900;
const ANCHO_MINI = 420;
const ANCHO_VISTA_PREVIA = 24;

const esperar = (ms) => new Promise((ok) => { setTimeout(ok, ms); });

function esperaEvento(el, evento, ms) {
  return new Promise((ok, mal) => {
    const alLlegar = () => { clearTimeout(t); ok(); };
    const t = setTimeout(() => { el.removeEventListener(evento, alLlegar); mal(new Error(`no llegó «${evento}»`)); }, ms);
    el.addEventListener(evento, alLlegar, { once: true });
  });
}

// Espera a que el video sepa sus medidas, o falla en cuanto el navegador dice que no puede abrirlo
// (un códec que ese navegador no decodifica avisa en milisegundos: no hay por qué esperar el tope).
function esperaMetadatos(video, ms) {
  return new Promise((ok, mal) => {
    const limpia = () => {
      clearTimeout(t);
      video.removeEventListener('loadedmetadata', alLlegar);
      video.removeEventListener('error', alFallar);
    };
    const alLlegar = () => { limpia(); ok(); };
    const alFallar = () => { limpia(); mal(new Error('el navegador no puede abrir este video')); };
    const t = setTimeout(() => { limpia(); mal(new Error('no llegaron las medidas del video')); }, ms);
    video.addEventListener('loadedmetadata', alLlegar);
    video.addEventListener('error', alFallar);
  });
}

/**
 * Lleva el video a `t` y espera a que ese fotograma esté PINTADO. `seeked`
 * avisa que se llegó, no que se dibujó: leer el lienzo en ese instante da a
 * veces un cuadro viejo, o negro. Con `requestVideoFrameCallback` se espera al
 * pintado de verdad; donde no existe, un respiro corto.
 */
export async function saltaA(video, t, ms = 6000) {
  const espera = esperaEvento(video, 'seeked', ms);
  video.currentTime = t;
  await espera;
  if (typeof video.requestVideoFrameCallback === 'function') {
    await Promise.race([new Promise((ok) => { video.requestVideoFrameCallback(() => ok()); }), esperar(300)]);
  } else {
    await esperar(80);
  }
}

const aLienzo = (video, ancho) => {
  const w = video.videoWidth;
  const h = video.videoHeight;
  const k = Math.min(1, ancho / w);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * k));
  c.height = Math.max(1, Math.round(h * k));
  c.getContext('2d').drawImage(video, 0, 0, c.width, c.height);
  return c;
};

const aBlob = (lienzo, calidad) => new Promise((ok, mal) => {
  lienzo.toBlob((b) => (b ? ok(b) : mal(new Error('la imagen salió vacía'))), 'image/jpeg', calidad);
});

// ¿Es todo negro? Un fotograma sin pintar sale así, y no debe guardarse.
function esNegro(lienzo) {
  const { data } = lienzo.getContext('2d').getImageData(0, 0, lienzo.width, lienzo.height);
  let suma = 0;
  for (let i = 0; i < data.length; i += 4) suma += data[i] + data[i + 1] + data[i + 2];
  return suma / (data.length / 4) / 3 < 6;
}

/**
 * Saca la foto del fotograma que el video tiene AHORA. Devuelve
 * `{ grande, mini, lqip, ancho, alto }` (los dos primeros son Blobs JPEG), o
 * lanza si el fotograma no sirve. `ancho` y `alto` son las medidas del
 * fotograma tal como se ve, para reservar el hueco antes de que llegue.
 */
export async function captura(video) {
  if (!video.videoWidth || !video.videoHeight) throw new Error('el video no tiene medidas');
  const previa = aLienzo(video, ANCHO_VISTA_PREVIA);
  if (esNegro(previa)) throw new Error('el fotograma salió negro');
  const [grande, mini] = await Promise.all([
    aBlob(aLienzo(video, ANCHO_GRANDE), 0.8),
    aBlob(aLienzo(video, ANCHO_MINI), 0.78),
  ]);
  return {
    grande, mini, lqip: previa.toDataURL('image/jpeg', 0.5), ancho: video.videoWidth, alto: video.videoHeight,
  };
}

/**
 * LA FOTO DEL VIDEO QUE EL COACH TIENE EN PANTALLA (el editor). Lleva ese
 * mismo <video> a la mitad del recorte y la saca. Devuelve una promesa que
 * NUNCA falla: o trae la foto o trae `null`. El que llama no la espera: la
 * deja corriendo mientras sube el video.
 */
export async function capturaDeLaMitad(video, { duracion, inicio, fin }) {
  try {
    if (!video) return null;
    await saltaA(video, mitadDe(duracion, segundos(inicio), segundos(fin)));
    return await captura(video);
  } catch {
    return null;
  }
}

/**
 * LA FOTO DE UN VIDEO QUE VIVE EN CLOUDFLARE. Abre el video escondido, le saca
 * el fotograma de la mitad de su recorte y lo cierra. Tarda 1-3 s (hay que
 * bajar lo justo para llegar a ese segundo), por eso solo se usa para los que
 * ya estaban sin foto y siempre en segundo plano. `null` si algo falla.
 */
export async function fotoDeUrl(url, { desde, hasta } = {}) {
  let video = null;
  try {
    video = document.createElement('video');
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.setAttribute('aria-hidden', 'true');
    // En el documento y con tamaño: algunos navegadores no pintan un video que no está.
    Object.assign(video.style, {
      position: 'fixed', left: '-9999px', top: '0', width: '320px', height: '180px', opacity: '0', pointerEvents: 'none',
    });
    document.body.appendChild(video);
    const meta = esperaMetadatos(video, 15000);
    video.src = url;
    await meta;
    await saltaA(video, mitadDe(video.duration, segundos(desde), segundos(hasta)), 15000);
    return await captura(video);
  } catch {
    return null;
  } finally {
    if (video) {
      video.pause();
      video.removeAttribute('src');
      video.load(); // corta lo que siguiera bajando
      video.remove();
    }
  }
}
