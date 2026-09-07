/**
 * Prepara una foto ANTES de subirla.
 *
 * POR QUE EXISTE:
 * La única foto del repertorio (Back Squat) mide 478 × 348 px y pesa 303 KB
 * siendo PNG. La app la pinta al doble de su tamaño y por eso se ve borrosa.
 * Andrés la subió así sin que nada se lo advirtiera, y solo se enteró al verla.
 *
 * Son dos fallas distintas, y esto resuelve las dos:
 *   (a) NO AVISABA. Se podía subir una foto de 400 px y nadie decía nada.
 *   (b) NO OPTIMIZABA. Subía el archivo tal cual, en el formato que fuera.
 *
 * Qué hace: encoge la foto si viene gigante, la reencoda a WebP —que para
 * fotos pesa del orden de diez veces menos que un PNG— y devuelve un aviso
 * si la original es tan chica que se va a ver borrosa igual. Encoger no
 * arregla una foto chica: eso solo lo arregla volver a subirla más grande,
 * y por eso lo único honesto ahí es avisar.
 *
 * Los videos NO pasan por aquí: recomprimirlos en el navegador es lento y
 * arruina la calidad, que es justo lo que Andrés dijo que más le importa.
 */

// Ancho máximo que se guarda. Un teléfono moderno pinta al doble de píxeles
// de los que mide en pantalla, así que 1600 cubre una foto a pantalla completa
// con nitidez de sobra. Más allá de eso solo se gasta espacio y datos.
const ANCHO_MAX = 1600;

// Debajo de esto la foto se ve borrosa en un teléfono. No se puede arreglar
// desde aquí: se avisa para que el coach suba otra.
const ANCHO_MINIMO_BUENO = 800;

const CALIDAD = 0.82;

/**
 * @returns {Promise<{archivo: File, aviso: string|null, detalle: string|null}>}
 * `archivo` siempre es utilizable: si algo falla, es el original intacto.
 */
export async function optimizaImagen(file) {
  const original = { archivo: file, aviso: null, detalle: null };
  if (!file?.type?.startsWith('image/')) return original;
  // Un GIF puede estar animado y el canvas se quedaría con un solo cuadro.
  if (file.type === 'image/gif') return original;

  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    // Navegador viejo o archivo raro. Se sube tal cual: mejor una foto sin
    // optimizar que ninguna.
    return original;
  }

  const { width: ancho, height: alto } = bitmap;
  const aviso = ancho < ANCHO_MINIMO_BUENO
    ? `Esta foto mide ${ancho} × ${alto} px y se va a ver borrosa en el teléfono.`
    : null;
  const detalle = aviso
    ? `Para que se vea nítida necesita al menos ${ANCHO_MINIMO_BUENO} px de ancho. Puedes subirla así, pero se notará.`
    : null;

  const escala = ancho > ANCHO_MAX ? ANCHO_MAX / ancho : 1;
  const nuevoAncho = Math.round(ancho * escala);
  const nuevoAlto = Math.round(alto * escala);

  let blob;
  try {
    const lienzo = document.createElement('canvas');
    lienzo.width = nuevoAncho;
    lienzo.height = nuevoAlto;
    const ctx = lienzo.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, nuevoAncho, nuevoAlto);
    blob = await new Promise((r) => lienzo.toBlob(r, 'image/webp', CALIDAD));
  } catch {
    bitmap.close?.();
    return { ...original, aviso, detalle };
  }
  bitmap.close?.();

  // Si el "optimizado" pesa más que el original, el original ya estaba bien.
  // Pasa con fotos ya comprimidas a conciencia, y con imágenes planas (logos,
  // capturas) donde el PNG gana.
  if (!blob || blob.size >= file.size) return { ...original, aviso, detalle };

  const nombre = file.name.replace(/\.[^.]+$/, '') + '.webp';
  const archivo = new File([blob], nombre, { type: 'image/webp', lastModified: Date.now() });
  return { archivo, aviso, detalle };
}

/** "1.4 MB" / "303 KB" — para poder enseñar cuánto se ahorró. */
export function pesoTexto(bytes) {
  if (bytes >= 1048576) return `${Math.round((bytes / 1048576) * 10) / 10} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
