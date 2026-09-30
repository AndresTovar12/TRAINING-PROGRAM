/**
 * Ponerle ÍNDICE a un video, sin recodificarlo.
 *
 * POR QUÉ EXISTE. Andrés, 30 sep 2026: los videos tardaban «un ratote» en
 * cargar, y la miniatura se quedaba en negro, aunque tuviera buen internet.
 *
 * La causa no era el internet. Los videos que graba la app salen del
 * navegador (`MediaRecorder`) «fragmentados»: pedazos sueltos de ~1 MB y SIN
 * índice, que es la tabla del principio del archivo que dice cuánto dura el
 * video y dónde está cada segundo. Sin ella, el teléfono no sabe dónde acaba
 * el archivo y lo busca a ciegas: pide 1 MB, lo revisa, pide el siguiente…
 * unos 36 pedidos UNO TRAS OTRO, y cada uno espera a Cloudflare ~0.17 s.
 * Medido con el Bench Press: 10-12 s en Chrome y 15-19 s en Safari antes de la
 * primera imagen, aunque en ese tiempo solo se bajen ~7 MB. Con el índice al
 * principio son 2 pedidos y ~2 s.
 *
 * QUÉ SE HACE: se cambia el CONTENEDOR, no la imagen. Los paquetes de video y
 * de audio se copian tal cual, y con eso el color, la calidad y el peso no se
 * mueven. Es lo mismo que `ffmpeg -c copy -movflags +faststart`. Comprobado
 * paquete por paquete contra el original (mismos tiempos, mismos tamaños,
 * mismos fotogramas clave, misma rotación): por eso los recortes que ya están
 * guardados —inicio y fin— siguen cayendo en el mismo cuadro.
 *
 * NUNCA SE RECODIFICA. Si el video no se puede pasar tal cual (un códec que el
 * MP4 no admite, por ejemplo), se deja como está: un video lento se ve; uno
 * con la imagen peor, Andrés no lo tolera.
 *
 * NUNCA BLOQUEA UNA SUBIDA. Cualquier fallo aquí devuelve el archivo original
 * y el motivo; quien sube decide. Un video sin índice es lento, pero existe.
 */

// Por encima de esto no se reempaqueta: el resultado se arma entero en
// memoria, y en un teléfono un archivo así tumba la pestaña. Una grabación de
// la app pesa ~1 MB por segundo, o sea que esto son más de tres minutos.
export const TOPE_MB = 200;

const TOPE_LECTURA_MOOV = 16 * 1048576;
const CABECERA = 16;

// Cajas con las que puede EMPEZAR un MP4 o un MOV de verdad. Cualquier otra
// cosa (un WebM, un archivo dañado) no se toca.
const PRIMERAS = new Set(['ftyp', 'moov', 'mdat', 'wide', 'free', 'skip', 'pnot', 'styp']);

const CODECS_DE_VIDEO = new Set(['avc', 'hevc']);
const CODECS_DE_AUDIO = new Set(['aac', 'mp3']);

const texto4 = (b, i) => String.fromCharCode(b[i], b[i + 1], b[i + 2], b[i + 3]);

/** Lector de un archivo que ya está en el teléfono o en la compu. */
export function lectorDeArchivo(archivo) {
  return async (inicio, largo) => new Uint8Array(
    await archivo.slice(inicio, Math.min(archivo.size, inicio + largo)).arrayBuffer(),
  );
}

/**
 * Lector de un archivo que vive en Cloudflare, pidiéndole solo lo necesario
 * con `Range`. Lee una ventana de 128 KB a la vez: revisar un video entero
 * cuesta uno o dos pedidos, no cuarenta.
 */
export function lectorRemoto(url) {
  let ventana = { desde: -1, datos: new Uint8Array(0) };
  return async (inicio, largo) => {
    const fin = inicio + largo;
    if (inicio >= ventana.desde && fin <= ventana.desde + ventana.datos.length) {
      return ventana.datos.subarray(inicio - ventana.desde, fin - ventana.desde);
    }
    const pide = Math.max(largo, 131072);
    const r = await fetch(url, { headers: { Range: `bytes=${inicio}-${inicio + pide - 1}` } });
    // Un 200 sería el archivo ENTERO (cientos de MB): se corta antes de bajarlo.
    if (r.status !== 206) {
      r.body?.cancel?.();
      throw new Error(r.status === 200 ? 'El servidor no acepta pedir por pedazos.' : `Cloudflare contestó ${r.status}`);
    }
    const datos = new Uint8Array(await r.arrayBuffer());
    ventana = { desde: inicio, datos };
    return datos.subarray(0, Math.min(largo, datos.length));
  };
}

async function leeCaja(leer, pos, total) {
  const b = await leer(pos, CABECERA);
  if (b.length < 8) return null;
  const dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
  let tam = dv.getUint32(0);
  const tipo = texto4(b, 4);
  let cabecera = 8;
  if (tam === 1) {
    if (b.length < 16) return null;
    tam = Number(dv.getBigUint64(8));
    cabecera = 16;
  } else if (tam === 0) {
    tam = total - pos; // «hasta el final del archivo»
  }
  if (!/^[\x20-\x7e]{4}$/.test(tipo) || tam < cabecera) return null;
  return { tipo, en: pos, tam, cabecera };
}

// ¿Dentro del `moov` hay un `mvex`? Es lo que delata a un video fragmentado:
// dice «lo demás viene en pedazos, y no sé cuánto dura».
async function moovTieneMvex(leer, caja) {
  if (caja.tam > TOPE_LECTURA_MOOV) return false; // uno tan grande trae sus tablas: es normal
  const cuerpo = await leer(caja.en + caja.cabecera, caja.tam - caja.cabecera);
  const dv = new DataView(cuerpo.buffer, cuerpo.byteOffset, cuerpo.byteLength);
  let p = 0;
  while (p + 8 <= cuerpo.length) {
    const tam = dv.getUint32(p);
    if (texto4(cuerpo, p + 4) === 'mvex') return true;
    if (tam < 8) break;
    p += tam;
  }
  return false;
}

/**
 * Cómo está armado un MP4/MOV:
 *   'bueno'         índice al principio y datos de corrido: arranca en 2 pedidos.
 *   'fragmentado'   pedazos sueltos y sin duración: lo que graba el navegador.
 *   'moov-al-final' el índice está DESPUÉS de los datos (lo típico de un video
 *                   del carrete): el teléfono tiene que ir a buscarlo al final.
 *   'otro'          no es un MP4/MOV, o no se pudo leer: no se toca.
 *
 * `leer(inicio, largo)` devuelve bytes; `total` es lo que pesa el archivo.
 */
export async function estructuraDe(leer, total) {
  const cajas = [];
  let pos = 0;
  let vioMdat = false;
  try {
    for (let i = 0; i < 24 && pos < total; i += 1) {
      const c = await leeCaja(leer, pos, total);
      if (!c) return { tipo: 'otro', cajas };
      if (i === 0 && !PRIMERAS.has(c.tipo)) return { tipo: 'otro', cajas };
      cajas.push(c.tipo);
      if (c.tipo === 'moof') return { tipo: 'fragmentado', cajas };
      if (c.tipo === 'mdat') vioMdat = true;
      if (c.tipo === 'moov') {
        // Un índice que dice ocupar más de lo que el archivo tiene está cortado:
        // no hay nada que reempaquetar, y con eso solo se generaría un video roto.
        if (c.en + c.tam > total) return { tipo: 'otro', cajas };
        if (vioMdat) return { tipo: 'moov-al-final', cajas };
        return { tipo: (await moovTieneMvex(leer, c)) ? 'fragmentado' : 'bueno', cajas };
      }
      pos = c.en + c.tam;
    }
  } catch {
    return { tipo: 'otro', cajas };
  }
  return { tipo: 'otro', cajas };
}

// El video se abre de verdad en un <video> y se comprueba que tiene imagen.
// Mismo criterio que la grabadora (`tieneImagen`): sin respuesta a tiempo no
// es un fallo, es un «no sé», y ante la duda pasa.
function sePuedeVer(archivo) {
  if (typeof document === 'undefined') return Promise.resolve(true);
  return new Promise((listo) => {
    const url = URL.createObjectURL(archivo);
    const v = document.createElement('video');
    let contestado = false;
    const responde = (vale) => {
      if (contestado) return;
      contestado = true;
      URL.revokeObjectURL(url);
      listo(vale);
    };
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => responde(v.videoWidth > 0 && v.videoHeight > 0 && Number.isFinite(v.duration));
    v.onerror = () => responde(false);
    // Corto a propósito: en Safari del iPhone un blob puede tardar en dar sus
    // metadatos, y esta espera se suma a la subida. Sin respuesta pasa igual.
    window.setTimeout(() => responde(true), 2500);
    v.src = url;
  });
}

const nombreMp4 = (nombre) => `${String(nombre || 'video').replace(/\.[^.]+$/, '') || 'video'}.mp4`;

/**
 * Devuelve el video con su índice puesto.
 *
 * @returns {{ archivo: File, cambio: boolean, estaba?: string, motivo?: string, detalle?: string }}
 *   `cambio: true` si `archivo` es uno nuevo, reempaquetado; si no, es el mismo
 *   que entró y `motivo` dice por qué se dejó igual: 'ya-tiene-indice',
 *   'formato', 'grande', 'codec' o 'error'.
 */
export async function conIndice(archivo, { alAvanzar } = {}) {
  const igual = (motivo, extra = {}) => ({ archivo, cambio: false, motivo, ...extra });
  try {
    const parece = /^video\/(mp4|quicktime)$/i.test(archivo.type || '') || /\.(mp4|mov|m4v)$/i.test(archivo.name || '');
    if (!parece) return igual('formato');
    if (archivo.size > TOPE_MB * 1048576) return igual('grande');

    const antes = await estructuraDe(lectorDeArchivo(archivo), archivo.size);
    if (antes.tipo === 'bueno') return igual('ya-tiene-indice');
    if (antes.tipo === 'otro') return igual('formato');

    // La librería solo se descarga cuando de verdad hace falta.
    const {
      Input, Output, Conversion, MP4, QTFF, BlobSource, Mp4OutputFormat, BufferTarget,
    } = await import('mediabunny');
    // Solo se leen MP4 y MOV (`.mov` del carrete): con `ALL_FORMATS` la librería
    // se llevaba todos los demás formatos y la descarga triplicaba su tamaño.
    const FORMATOS = [MP4, QTFF];

    const entrada = new Input({ formats: FORMATOS, source: new BlobSource(archivo) });
    const video = await entrada.getPrimaryVideoTrack();
    const audio = await entrada.getPrimaryAudioTrack();
    if (!video || !CODECS_DE_VIDEO.has(video.codec)) return igual('codec');
    if (audio && !CODECS_DE_AUDIO.has(audio.codec)) return igual('codec');

    const salida = new Output({ format: new Mp4OutputFormat({ fastStart: 'in-memory' }), target: new BufferTarget() });
    const conversion = await Conversion.init({ input: entrada, output: salida });
    // Si perdiera una pista de imagen o de sonido, mejor dejarlo como está.
    const perdio = conversion.discardedTracks.some((d) => d.track.type === 'video' || d.track.type === 'audio');
    if (!conversion.isValid || perdio) return igual('codec');
    if (alAvanzar) conversion.onProgress = alAvanzar;
    await conversion.execute();

    const nuevo = new File([salida.target.buffer], nombreMp4(archivo.name), { type: 'video/mp4' });

    // ── Comprobar el resultado ANTES de darlo por bueno ──────────────────────
    const despues = await estructuraDe(lectorDeArchivo(nuevo), nuevo.size);
    if (despues.tipo !== 'bueno') throw new Error('el resultado no quedó con el índice al principio');
    // Se cambia el contenedor, no el contenido: el peso casi no se mueve.
    if (Math.abs(nuevo.size - archivo.size) > Math.max(archivo.size * 0.03, 65536)) throw new Error('el peso del resultado no cuadra');
    const revisada = new Input({ formats: FORMATOS, source: new BlobSource(nuevo) });
    const [durAntes, durDespues, video2, audio2] = await Promise.all([
      entrada.computeDuration(), revisada.computeDuration(),
      revisada.getPrimaryVideoTrack(), revisada.getPrimaryAudioTrack(),
    ]);
    if (!video2 || (audio && !audio2)) throw new Error('al resultado le falta una pista');
    if (Math.abs(durAntes - durDespues) > 0.15) throw new Error('la duración no coincide');
    if (!(await sePuedeVer(nuevo))) throw new Error('el navegador no logra abrir el resultado');

    return { archivo: nuevo, cambio: true, estaba: antes.tipo };
  } catch (e) {
    return igual('error', { detalle: e?.message || String(e) });
  }
}
