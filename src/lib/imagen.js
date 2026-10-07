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
 *
 * CUALQUIER FORMATO. Andrés, 7 oct 2026: «haz que se pueda subir cualquier
 * formato, jpg, HEIC, etc… me rechaza las HEIC». El servidor de subidas solo
 * recibe JPG, PNG, WebP y GIF, y se queda así: no se le abre la puerta a
 * cualquier archivo. Lo que cambia es que la foto SALE del navegador ya en uno
 * de esos formatos (`aImagenWeb`):
 *   · JPG, PNG, WebP y GIF pasan como siempre.
 *   · Lo que el propio navegador sabe leer (AVIF, BMP y, en Safari, el HEIC)
 *     se pasa a JPG con él, sin librerías.
 *   · El HEIC/HEIF —las fotos del iPhone sueltas o por AirDrop— Chrome y
 *     Firefox no lo leen: ahí entra la librería `heic-to`, en su versión «csp»
 *     (sin eval ni WebAssembly, que la política de seguridad de la app no
 *     permite). Pesa 3 MB, así que no viaja con la app: se baja la primera vez
 *     que alguien sube un HEIC (`import()` dinámico).
 *   · Lo demás (un TIFF fuera de Safari, un SVG, un archivo roto) da un aviso
 *     claro, en vez del «Tipo de archivo no permitido» del servidor.
 * El editor de recorte también necesita una foto que el navegador pueda
 * dibujar, por eso `MediaUpload` convierte ANTES de abrirlo.
 */

// Ancho máximo que se guarda. Un teléfono moderno pinta al doble de píxeles
// de los que mide en pantalla, así que 1600 cubre una foto a pantalla completa
// con nitidez de sobra. Más allá de eso solo se gasta espacio y datos.
const ANCHO_MAX = 1600;

// Debajo de esto la foto se ve borrosa en un teléfono. No se puede arreglar
// desde aquí: se avisa para que el coach suba otra.
const ANCHO_MINIMO_BUENO = 800;

const CALIDAD = 0.82;

// Lo que acepta el servidor de subidas (`TIPOS_OK` en supabase/functions/r2-upload).
// Todo lo demás tiene que salir de aquí ya convertido.
const SUBIBLES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

// El JPG intermedio (HEIC → JPG) todavía se recorta y se pasa a WebP: se guarda con
// calidad de sobra para que esas dos vueltas no sumen una pérdida que se vea.
const CALIDAD_INTERMEDIA = 0.92;

// El lienzo de iOS se rinde pasados los 16.7 millones de píxeles y se queda en blanco
// sin avisar. Una foto de 48 MP del iPhone Pro lo rebasa: se reduce al leerla. Las
// de 12 MP (4032 × 3024) caben enteras.
const PIXELES_MAX = 12.6e6;

// La librería de HEIC decodifica a mano, sin el chip del navegador: una foto de 12 MP tarda unos 7 a 12 segundos en la
// Mac de Andrés, y una de 48 MP más de dos minutos (y se come la memoria). Pasados 25 MP se avisa en vez de dejarlo
// esperando. Safari no pasa por aquí: él decodifica HEIC con el sistema, en segundos y sin tope.
const PIXELES_MAX_HEIC = 25e6;

const EXT_IMAGEN = /\.(jpe?g|png|gif|webp|avif|bmp|tiff?|heic|heif|hif)$/i;
const EXT_HEIC = /\.(heic|heif|hif)$/i;
const MIME_HEIC = /^image\/hei[cf]/i;
// Cómo se declara un HEIC/HEIF en sus primeros bytes: «ftyp» y luego una de estas marcas.
const MARCAS_HEIC = new Set(['heic', 'heix', 'hevc', 'hevx', 'heim', 'heis', 'hevm', 'hevs', 'mif1', 'msf1']);

const FORMATO_NO_LEIDO = 'Ese formato no se puede leer. Usa una foto JPG, PNG, HEIC o WebP.';
const HEIC_NO_LEIDO = 'No se pudo abrir esa foto. Prueba con otra o expórtala como JPG.';
const HEIC_MUY_GRANDE = 'Esa foto es demasiado grande para abrirla aquí. Pásala a JPG, o tómala con menos resolución.';

/**
 * ¿Es una foto, aunque el sistema no lo diga? Windows y Linux dejan vacío el tipo de un
 * HEIC (y a veces dicen «octet-stream»): ahí manda la extensión.
 */
export function esImagen(file) {
  if (!file) return false;
  const tipo = file.type || '';
  if (tipo.startsWith('image/')) return true;
  return (tipo === '' || tipo === 'application/octet-stream') && EXT_IMAGEN.test(file.name || '');
}

async function esHeic(file) {
  if (MIME_HEIC.test(file.type || '') || EXT_HEIC.test(file.name || '')) return true;
  // Sin tipo ni extensión que ayude (pasa al arrastrar desde algunas apps): se mira cómo empieza.
  if (file.type && file.type !== 'application/octet-stream') return false;
  try {
    const cabeza = new Uint8Array(await file.slice(0, 12).arrayBuffer());
    const texto = String.fromCharCode(...cabeza);
    return texto.slice(4, 8) === 'ftyp' && MARCAS_HEIC.has(texto.slice(8, 12));
  } catch {
    return false;
  }
}

/**
 * Los píxeles de un HEIC, leídos de su cabecera sin decodificar nada: la caja «ispe» (ancho y alto) más grande, que es
 * la foto; las demás son miniaturas. 0 si no la encuentra.
 */
async function pixelesDeHeic(file) {
  try {
    const bytes = new Uint8Array(await file.slice(0, 65536).arrayBuffer());
    const vista = new DataView(bytes.buffer);
    let mayor = 0;
    for (let i = 0; i + 16 <= bytes.length; i++) {
      // «ispe» en bytes, luego 4 de versión y después el ancho y el alto (32 bits cada uno).
      if (bytes[i] === 0x69 && bytes[i + 1] === 0x73 && bytes[i + 2] === 0x70 && bytes[i + 3] === 0x65) {
        mayor = Math.max(mayor, vista.getUint32(i + 8) * vista.getUint32(i + 12));
      }
    }
    return mayor;
  } catch {
    return 0;
  }
}

/** La foto de un `File` que el navegador sabe leer, como JPG; null si no la sabe leer. */
async function leerConElNavegador(file) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return null;
  }
  try {
    const escala = Math.min(1, Math.sqrt(PIXELES_MAX / (bitmap.width * bitmap.height)));
    const ancho = Math.round(bitmap.width * escala);
    const alto = Math.round(bitmap.height * escala);
    const lienzo = document.createElement('canvas');
    lienzo.width = ancho;
    lienzo.height = alto;
    const ctx = lienzo.getContext('2d');
    // Un JPG no tiene transparencia: sin fondo, lo transparente quedaría negro.
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, ancho, alto);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(bitmap, 0, 0, ancho, alto);
    const blob = await new Promise((r) => lienzo.toBlob(r, 'image/jpeg', CALIDAD_INTERMEDIA));
    return blob?.type === 'image/jpeg' ? blob : null;
  } catch {
    return null;
  } finally {
    bitmap.close?.();
  }
}

function comoJpg(origen, blob) {
  const base = (origen.name || 'foto').replace(/\.[^.]+$/, '') || 'foto';
  return new File([blob], `${base}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
}

/**
 * La misma foto en un formato que se pueda subir y que el navegador sepa dibujar.
 * Lo que ya es JPG, PNG, WebP o GIF vuelve intacto y al instante.
 * Si no se puede leer, lanza un `Error` con el aviso para enseñar tal cual.
 */
export async function aImagenWeb(file) {
  if (!file || SUBIBLES.has(file.type)) return file;

  const delNavegador = await leerConElNavegador(file);
  if (delNavegador) return comoJpg(file, delNavegador);

  if (!(await esHeic(file))) throw new Error(FORMATO_NO_LEIDO);
  if ((await pixelesDeHeic(file)) > PIXELES_MAX_HEIC) throw new Error(HEIC_MUY_GRANDE);
  try {
    const { heicTo } = await import('heic-to/csp');
    return comoJpg(file, await heicTo({ blob: file, type: 'image/jpeg', quality: CALIDAD_INTERMEDIA }));
  } catch {
    throw new Error(HEIC_NO_LEIDO);
  }
}

// Un navegador sin WebP (Safari viejo) no falla: contesta un PNG. Un blob de otro tipo que el pedido no sirve.
async function codifica(lienzo, tipo, calidad) {
  const blob = await new Promise((r) => lienzo.toBlob(r, tipo, calidad));
  return blob && blob.type === tipo ? blob : null;
}

/**
 * @returns {Promise<{archivo: File, aviso: string|null, detalle: string|null}>}
 * `archivo` siempre es utilizable: si algo falla al optimizar, es la foto intacta
 * (ya pasada a un formato que se pueda subir). Lo único que lanza un error es un
 * formato que no se puede leer: ver `aImagenWeb`.
 */
export async function optimizaImagen(entrada) {
  if (!esImagen(entrada)) return { archivo: entrada, aviso: null, detalle: null };
  const file = await aImagenWeb(entrada);
  const original = { archivo: file, aviso: null, detalle: null };
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
    blob = await codifica(lienzo, 'image/webp', CALIDAD);
    // Safari no sabe hacer WebP con el lienzo. Una foto (JPG) se achica igual y sale como JPG; un PNG se queda
    // como está, porque un JPG le pondría fondo negro a lo transparente.
    if (!blob && file.type === 'image/jpeg') blob = await codifica(lienzo, 'image/jpeg', CALIDAD);
  } catch {
    bitmap.close?.();
    return { ...original, aviso, detalle };
  }
  bitmap.close?.();

  // Si el "optimizado" pesa más que el original, el original ya estaba bien.
  // Pasa con fotos ya comprimidas a conciencia, y con imágenes planas (logos,
  // capturas) donde el PNG gana.
  if (!blob || blob.size >= file.size) return { ...original, aviso, detalle };

  const nombre = file.name.replace(/\.[^.]+$/, '') + (blob.type === 'image/webp' ? '.webp' : '.jpg');
  const archivo = new File([blob], nombre, { type: blob.type, lastModified: Date.now() });
  return { archivo, aviso, detalle };
}

/** "1.4 MB" / "303 KB" — para poder enseñar cuánto se ahorró. */
export function pesoTexto(bytes) {
  if (bytes >= 1048576) return `${Math.round((bytes / 1048576) * 10) / 10} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
