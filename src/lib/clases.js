/* CLASES: un video largo que una instructora (yoga, pilates, spinning, functional) sube UNA vez y usa en las sesiones que quiera.

   Andrés, 11 oct 2026: «Clase» es un tipo más de lo que se guarda en Mis planes (workout, rutina, programa, clase), y la sesión que la usa
   la enseña arriba, con su reproductor.

   CÓMO VIVE EN LOS DATOS. No hay tabla nueva ni tipo nuevo en la base: una clase es una SESIÓN con un campo más, `clase`:

     { day: 'Lun', name: 'Vinyasa 45 min', cat: 'clase', exercises: [], clase: { url, duracion } }

   · `url`: el video (un archivo nuestro en Cloudflare o una liga de YouTube/Vimeo; ver `lib/videos.js`).
   · `duracion`: segundos de lo que se ve, si se sabe (un archivo recién subido la trae; una liga no).
   · `inicio` y `fin`: el recorte, si la instructora le quitó el principio o el final al subirlo (el archivo sube entero; el recorte se aplica al reproducir, como en los ejercicios).
   La sesión puede seguir llevando Sets debajo (un estiramiento, unos ejercicios), y se guarda, se copia y se asigna como cualquier sesión, así
   que Mis planes, «Usar workout», «Asignar» y los planes de los atletas la llevan sin tocar nada.

   Lo guardado en Mis planes que trae una sesión con `clase` se llama «Clase» (ver `lib/misPlanesDatos.js`). */

/** La clase de una sesión, o `null` si no trae (o no trae video). */
export const claseDe = (sesion) => (sesion?.clase && typeof sesion.clase.url === 'string' && sesion.clase.url.trim() ? sesion.clase : null);

/** ¿Esta sesión es (o trae) una clase? */
export const esClase = (sesion) => !!claseDe(sesion);

const positivo = (n) => (Number.isFinite(Number(n)) && Number(n) > 0 ? Number(n) : null);

/** Lo que se guarda en `sesion.clase`. La duración y el recorte, solo si son números que sirven. */
export function claseNueva({ url, duracion, inicio, fin } = {}) {
  const dir = String(url ?? '').trim();
  const seg = positivo(duracion);
  const desde = positivo(inicio);
  const hasta = positivo(fin);
  return {
    url: dir,
    ...(seg ? { duracion: Math.round(seg) } : null),
    ...(desde ? { inicio: desde } : null),
    ...(hasta && hasta > (desde ?? 0) ? { fin: hasta } : null),
  };
}

/** Cuánto dura lo que se ve de un video de `total` segundos recortado entre `inicio` y `fin`; `null` si no se sabe el total. */
export function duracionDelTramo({ total, inicio, fin } = {}) {
  const t = positivo(total);
  if (!t) return null;
  const desde = Math.min(positivo(inicio) ?? 0, t);
  const hasta = Math.min(positivo(fin) ?? t, t);
  return hasta > desde ? hasta - desde : t;
}

/** «45 min», «1 h 5 min», «30 s». Sin duración, cadena vacía (una liga no la trae). */
export function duracionTexto(segundos) {
  const s = Math.round(Number(segundos));
  if (!Number.isFinite(s) || s <= 0) return '';
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  const resto = min % 60;
  return resto ? `${h} h ${resto} min` : `${h} h`;
}

/** Una sesión vacía que arranca como clase (sin video todavía): del tipo «Clase» que ya existe entre los tipos de sesión, y con el nombre en blanco para que tome el de lo guardado. */
export const sesionDeClase = (nombre = '') => ({ day: 'Lun', name: nombre, cat: 'clase', exercises: [] });
