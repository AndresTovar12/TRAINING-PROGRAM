/**
 * Arreglar los videos que YA están guardados: ponerles el índice.
 *
 * Por qué hace falta y qué es el índice, en `indiceDeVideo.js`. Aquí está lo que
 * pasa con lo que ya subimos antes de que la subida se ocupara de esto.
 *
 * POR QUÉ LO HACE EL NAVEGADOR Y NO UN PROCESO EN EL SERVIDOR. Subir a
 * Cloudflare exige la sesión de un coach o del master (`r2-upload` firma solo
 * para ellos), y quien lo corre es quien toca el botón. Además es la MISMA pieza
 * que ya corre en cada subida nueva: una sola forma de hacerlo, probada en una
 * sola parte.
 *
 * CADA VIDEO, en orden y de uno en uno (así nunca hay dos archivos grandes en
 * memoria):
 *   1. Mira cómo está armado sin bajarlo entero (pide 128 KB). Si ya está bien,
 *      lo deja.
 *   2. Lo baja, le pone el índice (`conIndice`, sin recodificar) y comprueba el
 *      resultado.
 *   3. Sube el nuevo con OTRO nombre. Nunca pisa el archivo viejo: las
 *      direcciones llevan un año de caché (`immutable`) y pisar una dejaría a
 *      los atletas viendo la versión vieja.
 *   4. Comprueba que lo subido quedó bien EN Cloudflare (peso y estructura).
 *   5. Solo entonces cambia la dirección en la base, y solo si sigue siendo la
 *      de antes (así dos pantallas a la vez no se pisan).
 *
 * El archivo viejo NO se borra: si algo saliera mal, la dirección anterior
 * sigue funcionando y se puede volver a ella. Los recortes (inicio, fin,
 * encuadre, audio) no se tocan: viven en la fila, no en el archivo, y el
 * reempaquetado conserva cada fotograma en su mismo instante.
 */
import { supabase } from '@/lib/supabase';
import { uploadExerciseMedia } from '@/lib/api';
import { conIndice, estructuraDe, lectorRemoto, TOPE_MB } from '@/lib/indiceDeVideo';

// Donde viven nuestros videos. Es la dirección pública que abren los atletas,
// no un secreto (ver `r2-upload`). Una liga de TikTok o de YouTube no empieza
// así, y esas no se tocan.
const CARPETA_DE_VIDEOS = 'https://pub-4a3ae85521d744b5abf16550ea171189.r2.dev/videos/';

export const esNuestro = (url) => typeof url === 'string' && url.startsWith(CARPETA_DE_VIDEOS);

const nombreDe = (url) => decodeURIComponent(url.split('?')[0].split('/').pop() || 'video.mp4');
const tipoDe = (url) => (/\.mov(\?|$)/i.test(url) ? 'video/quicktime' : 'video/mp4');
// Por qué `conIndice` dejó un video como estaba, dicho para quien lo lee.
const MOTIVOS = {
  formato: () => 'no es un video MP4 o MOV',
  grande: () => `pesa más de ${TOPE_MB} MB, demasiado para hacerlo desde aquí`,
  codec: () => 'usa un formato que no se puede pasar sin recodificar, y recodificar le bajaría la calidad',
  error: (detalle) => `no se pudo reempaquetar (${detalle || 'error desconocido'})`,
};
const esperar = (ms) => new Promise((ok) => { setTimeout(ok, ms); });

/**
 * Los videos que esta cuenta puede arreglar, uno por dirección.
 *
 * El master puede editar lo de todos; un coach, lo suyo. Es lo mismo que
 * permite la base (`exercises_update_owner` y `exercise_media_write`), así que
 * aquí solo se evita bajar un video que luego no se podría guardar.
 * Una misma dirección puede estar en varias filas (una copia de un ejercicio
 * comparte el video): se arregla una vez y se cambian todas.
 */
export async function buscaVideos({ usuario, esMaster }) {
  const [propios, extras] = await Promise.all([
    supabase.from('exercises').select('id, name, video_url, created_by').like('video_url', `${CARPETA_DE_VIDEOS}%`),
    supabase.from('exercise_media')
      .select('id, url, created_by, exercise:exercises(name, created_by)')
      .eq('tipo', 'video').like('url', `${CARPETA_DE_VIDEOS}%`),
  ]);
  if (propios.error) throw propios.error;
  if (extras.error) throw extras.error;

  const porUrl = new Map();
  const anota = (url, nombre, fila) => {
    if (!esNuestro(url)) return;
    const actual = porUrl.get(url) ?? { url, nombres: [], filas: [] };
    if (nombre && !actual.nombres.includes(nombre)) actual.nombres.push(nombre);
    actual.filas.push(fila);
    porUrl.set(url, actual);
  };
  (propios.data ?? []).forEach((e) => {
    if (esMaster || e.created_by === usuario) anota(e.video_url, e.name, { tabla: 'exercises', campo: 'video_url', id: e.id });
  });
  (extras.data ?? []).forEach((m) => {
    if (esMaster || m.created_by === usuario || m.exercise?.created_by === usuario) {
      // «· extra» porque un ejercicio con su video de siempre y otro ángulo
      // saldría dos veces con el mismo nombre, y no se sabría cuál es cuál.
      anota(m.url, m.exercise?.name ? `${m.exercise.name} · extra` : 'Video extra', { tabla: 'exercise_media', campo: 'url', id: m.id });
    }
  });
  return [...porUrl.values()].map((v) => ({ ...v, nombre: v.nombres.join(' · ') || 'Video' }));
}

/** Cómo está armado un video que vive en Cloudflare, sin bajarlo entero. */
export async function revisaUno(url) {
  const cabecera = await fetch(url, { method: 'HEAD' });
  if (!cabecera.ok) throw new Error(`Cloudflare no lo encuentra (${cabecera.status})`);
  const total = Number(cabecera.headers.get('content-length')) || 0;
  const { tipo } = await estructuraDe(lectorRemoto(url), total);
  const porArreglar = tipo === 'fragmentado' || tipo === 'moov-al-final';
  // `grande` solo cuenta si de verdad hay algo que arreglar: un video grande
  // que ya está bien no es un problema.
  return { tipo, total, listo: porArreglar, grande: porArreglar && total > TOPE_MB * 1048576 };
}

async function baja(url, alAvanzar, senal) {
  const r = await fetch(url, { signal: senal });
  if (!r.ok) throw new Error(`no se pudo bajar (${r.status})`);
  const total = Number(r.headers.get('content-length')) || 0;
  const trozos = [];
  let bajado = 0;
  const lector = r.body.getReader();
  for (;;) {
    const { done, value } = await lector.read();
    if (done) break;
    trozos.push(value);
    bajado += value.length;
    if (total) alAvanzar(bajado / total);
  }
  if (total && bajado !== total) throw new Error('la bajada llegó incompleta');
  return new File(trozos, nombreDe(url), { type: tipoDe(url) });
}

// Lo subido tiene que quedar bien EN Cloudflare, no solo bien aquí. Se le da
// un margen porque una dirección recién creada puede tardar un instante en
// contestar.
async function compruebaSubido(url, archivo) {
  let ultimo = 'no responde';
  for (let intento = 0; intento < 4; intento += 1) {
    try {
      const { tipo, total } = await revisaUno(url);
      if (total === archivo.size && tipo === 'bueno') return;
      ultimo = total !== archivo.size ? `pesa ${total} y debía pesar ${archivo.size}` : `quedó ${tipo}`;
    } catch (e) {
      ultimo = e.message;
    }
    await esperar(1000 * (intento + 1));
  }
  throw new Error(`lo subido no quedó bien (${ultimo})`);
}

/**
 * Arregla UN video. `alAvanzar(fase, fraccion)` con fase: 'bajando',
 * 'reempaquetando', 'subiendo', 'comprobando' o 'guardando'.
 * Devuelve cuántas filas quedaron apuntando a la dirección nueva.
 */
export async function arreglaUno(item, { alAvanzar = () => {}, senal } = {}) {
  const alto = () => { if (senal?.aborted) throw new Error('detenido'); };

  alAvanzar('bajando', 0);
  const original = await baja(item.url, (f) => alAvanzar('bajando', f), senal);
  alto();

  alAvanzar('reempaquetando', 0);
  const r = await conIndice(original, { alAvanzar: (f) => alAvanzar('reempaquetando', f) });
  if (!r.cambio) {
    // Que ya tenga índice no es un fallo: alguien lo arregló entre la revisión
    // y ahora. Cualquier otro motivo sí se dice, para poder buscar la causa.
    if (r.motivo === 'ya-tiene-indice') return 0;
    throw new Error(MOTIVOS[r.motivo] ? MOTIVOS[r.motivo](r.detalle) : `no se puede arreglar (${r.motivo})`);
  }
  alto();

  alAvanzar('subiendo', 0);
  const nueva = await uploadExerciseMedia(r.archivo, 'videos', (p) => alAvanzar('subiendo', p / 100), { sinIndice: true });

  alAvanzar('comprobando', 0);
  await compruebaSubido(nueva, r.archivo);

  alAvanzar('guardando', 0);
  let guardadas = 0;
  for (const f of item.filas) {
    // Solo si la fila sigue con la dirección de antes: si otra pantalla la
    // cambió mientras tanto, no se le pasa por encima.
    const { data, error } = await supabase.from(f.tabla).update({ [f.campo]: nueva }).eq('id', f.id).eq(f.campo, item.url).select('id');
    if (error) throw error;
    guardadas += data?.length ?? 0;
  }
  if (!guardadas) throw new Error('no se pudo guardar el cambio (¿lo cambió otra persona?)');
  return guardadas;
}
