/**
 * Las fotos de los videos: dónde se guardan, cómo se leen sin esperar y cómo
 * se completan solas. Cómo se SACA cada foto, en `fotogramas`.
 *
 * DÓNDE VIVEN. En la tabla `video_posters`, una fila por DIRECCIÓN de video.
 * La foto pertenece a un archivo, no a un ejercicio: si el video se cambia por
 * otro, el otro tiene otra dirección y la foto vieja deja de aplicar sola, sin
 * columnas ni disparadores que mantener. Las imágenes grandes y chicas están en
 * Cloudflare, igual que el video; la vista previa borrosa viaja dentro de la fila.
 *
 * CÓMO SE LEEN SIN ESPERAR. Toda la tabla es chica (un renglón por video), así
 * que se trae completa UNA vez por sesión y se guarda también en el teléfono
 * (`localStorage`): la segunda vez que alguien abre la app, las fotos ya están
 * antes de pedir nada. `usePoster(url)` contesta:
 *   - la fila  → hay foto: se pinta ya
 *   - undefined → todavía no se sabe (primera vez, mientras llega la tabla)
 *   - null      → ya se sabe que ese video no tiene foto: se usa el de siempre
 * Distinguir «no sé» de «no hay» importa: sin eso, cada recuadro arrancaría a
 * bajar su video «por si acaso» y se perdería justo lo que se ganó.
 */
import { useEffect, useSyncExternalStore } from 'react';
import { supabase } from '@/lib/supabase';
import { uploadExerciseMedia } from '@/lib/api';
import { fotoDeUrl, segundos } from '@/lib/fotogramas';

const CLAVE = 'tl.posters.v1';
// `desde` y `hasta`: el recorte con el que se sacó la foto (ver `completaPortadas`).
const CAMPOS = 'video_url, poster_url, mini_url, lqip, ancho, alto, desde, hasta';

let mapa = new Map();     // dirección del video → fila
let fresco = false;       // ¿ya se trajo la tabla de verdad en esta sesión?
let cargando = null;
let version = 0;
const oyentes = new Set();

try {
  const guardado = JSON.parse(localStorage.getItem(CLAVE) || 'null');
  if (Array.isArray(guardado)) mapa = new Map(guardado.map((f) => [f.video_url, f]));
} catch { /* sin memoria del teléfono: se trae de la base */ }

function avisa() {
  version += 1;
  oyentes.forEach((f) => f());
}

function recuerda() {
  try { localStorage.setItem(CLAVE, JSON.stringify([...mapa.values()])); } catch { /* lleno o bloqueado: no pasa nada */ }
}

const suscribe = (f) => { oyentes.add(f); return () => oyentes.delete(f); };
const instantanea = () => version;

/** Trae la tabla de fotos (una sola vez por sesión, aunque se llame desde cien recuadros). */
export function cargaPosters() {
  if (cargando) return cargando;
  cargando = supabase.from('video_posters').select(CAMPOS).then(({ data, error }) => {
    if (!error && Array.isArray(data)) {
      mapa = new Map(data.map((f) => [f.video_url, f]));
      recuerda();
    }
    // Con error se sigue con lo que hubiera guardado: «no sé» para siempre dejaría los recuadros vacíos.
    fresco = true;
    avisa();
  }, () => { fresco = true; avisa(); });
  return cargando;
}

/** La foto de este video: la fila, `undefined` si todavía no se sabe, `null` si no tiene. */
export function usePoster(url) {
  useSyncExternalStore(suscribe, instantanea);
  useEffect(() => { if (url) cargaPosters(); }, [url]);
  if (!url) return null;
  const fila = mapa.get(url);
  if (fila) return fila;
  return fresco ? null : undefined;
}

export const posterDe = (url) => mapa.get(url) ?? null;

/** Guarda la fila de la foto de un video y la deja a la vista sin recargar. */
export async function guardaPoster(video, datos) {
  // `getSession` lee la sesión del propio aparato; `getUser` hace un viaje a la red, y este paso corre justo después de subir el video.
  const { data: sesion } = await supabase.auth.getSession();
  const fila = { video_url: video, ...datos, created_by: sesion?.session?.user?.id ?? null };
  const { error } = await supabase.from('video_posters').upsert(fila, { onConflict: 'video_url' });
  if (error) throw error;
  mapa.set(video, { video_url: video, ...datos });
  recuerda();
  avisa();
}

const comoArchivo = (blob, nombre) => new File([blob], nombre, { type: 'image/jpeg' });

/**
 * Sube las dos fotos (grande y chica) a Cloudflare. `fotogramas` es lo que
 * devuelve `captura`. Devuelve los datos para guardar la fila, o `null` si
 * algo falla: nunca lanza, y ese video se queda sin foto y se ve como siempre.
 * Va aparte de `guardaPoster` porque la fila necesita la dirección del VIDEO,
 * que no se sabe hasta que termina de subir, y las fotos pueden subirse antes.
 */
export async function subeFotos(fotogramas) {
  try {
    if (!fotogramas) return null;
    const [poster_url, mini_url] = await Promise.all([
      uploadExerciseMedia(comoArchivo(fotogramas.grande, 'portada.jpg'), 'covers'),
      uploadExerciseMedia(comoArchivo(fotogramas.mini, 'mini.jpg'), 'covers'),
    ]);
    return {
      poster_url, mini_url, lqip: fotogramas.lqip, ancho: fotogramas.ancho, alto: fotogramas.alto,
    };
  } catch {
    return null;
  }
}

/**
 * Las dos cosas juntas, para quien ya tiene la dirección del video. Nunca
 * lanza. `tramo` es el recorte con el que se sacó la foto ({ desde, hasta },
 * en segundos o null): se guarda para saber cuándo la foto quedó vieja.
 */
export async function subePoster(video, fotogramas, tramo = {}) {
  const datos = await subeFotos(fotogramas);
  if (!datos) return false;
  try {
    await guardaPoster(video, { ...datos, desde: segundos(tramo.desde), hasta: segundos(tramo.hasta) });
    return true;
  } catch {
    return false;
  }
}

// ¿Son el mismo segundo? Las fracciones de segundo que viajan como texto o con decimales de más no cuentan.
const mismoSegundo = (a, b) => {
  const x = segundos(a);
  const y = segundos(b);
  return x === null || y === null ? x === y : Math.abs(x - y) < 0.05;
};
const mismoTramo = (fila, t) => mismoSegundo(fila.desde, t.desde) && mismoSegundo(fila.hasta, t.hasta);

// Donde viven nuestros videos (la dirección pública que abren los atletas; no es un secreto).
const CARPETA_DE_VIDEOS = 'https://pub-4a3ae85521d744b5abf16550ea171189.r2.dev/videos/';

/* Los videos a los que este aparato no les pudo sacar foto (por ejemplo un .mov en HEVC en un
   navegador que no lo decodifica): se anotan, y no se reintentan en un día. Sin esto, dos videos así
   al principio de la fila harían que la corrida se rindiera siempre antes de llegar a los demás.
   Otro aparato (un iPhone sí lo abre) los completa. */
const CLAVE_FALLIDAS = 'tl.posters.fallidas.v1';
const REINTENTO_MS = 24 * 3600 * 1000;
const leeFallidas = () => {
  try { return JSON.parse(localStorage.getItem(CLAVE_FALLIDAS) || '{}') || {}; } catch { return {}; }
};
const anotaFallida = (url) => {
  try { localStorage.setItem(CLAVE_FALLIDAS, JSON.stringify({ ...leeFallidas(), [url]: Date.now() })); } catch { /* sin memoria: se reintenta la próxima vez */ }
};

/**
 * COMPLETA, SOLA, LAS FOTOS QUE FALTEN O QUEDARON VIEJAS. La corre un coach o
 * el master en segundo plano al abrir «Ejercicios» y cada vez que la lista
 * cambia (por ejemplo, al guardar un recorte nuevo): busca los videos de
 * nuestro Cloudflare sin foto, les saca el fotograma de la mitad de su recorte
 * y lo guarda. Nadie pone nada a mano, y quien la dispara no la espera.
 *
 * UNA FOTO QUEDA VIEJA cuando el coach vuelve a recortar el video: la foto
 * guardada es de la mitad del recorte de antes (`desde`/`hasta` de su fila) y
 * ya no es la mitad de lo que se ve. Se rehace sola, y mientras tanto se sigue
 * viendo la anterior.
 *
 * ES EDUCADA: de uno en uno y sin prisa, no con datos moviles ni con el modo
 * de ahorro de datos, no con la pestaña escondida, y se rinde tras tres
 * fallos seguidos (por ejemplo CORS en una dirección que el bucket no autoriza).
 *
 * @param max    cuántas completar como máximo en esta llamada
 * @param parar  función que devuelve true cuando hay que dejarlo (la pantalla se cerró)
 * @returns cuántas fotos quedaron hechas o rehechas
 */
export async function completaPortadas({ max = 12, parar = () => false } = {}) {
  await cargaPosters();
  const [propios, extras] = await Promise.all([
    supabase.from('exercises').select('video_url, recorte_inicio, recorte_fin')
      .like('video_url', `${CARPETA_DE_VIDEOS}%`),
    supabase.from('exercise_media').select('url, recorte_inicio, recorte_fin')
      .eq('tipo', 'video').like('url', `${CARPETA_DE_VIDEOS}%`),
  ]);
  // Cada video con TODOS los recortes con que algún ejercicio lo usa: un mismo video puede estar en varios (un ejercicio copiado) y cada uno pudo recortarlo distinto.
  const cola = new Map();
  const anota = (url, desde, hasta) => {
    cola.set(url, [...(cola.get(url) ?? []), { desde: segundos(desde), hasta: segundos(hasta) }]);
  };
  (propios.data ?? []).forEach((e) => anota(e.video_url, e.recorte_inicio, e.recorte_fin));
  (extras.data ?? []).forEach((m) => anota(m.url, m.recorte_inicio, m.recorte_fin));

  const fallidas = leeFallidas();
  let hechas = 0;
  let seguidosSinExito = 0;
  for (const [url, tramos] of cola) {
    if (hechas >= max || parar() || seguidosSinExito >= 3) break;
    // Con foto hecha con el recorte de alguno de los que hoy lo usan: está al día. Basta con que coincida uno; si no, con un video compartido por dos recortes cada coach la rehacería al abrir y se pisarían para siempre.
    const fila = mapa.get(url);
    if (fila && tramos.some((t) => mismoTramo(fila, t))) continue;
    if (Date.now() - (fallidas[url] ?? 0) < REINTENTO_MS) continue;
    if (typeof document !== 'undefined' && document.hidden) break;
    const conexion = typeof navigator !== 'undefined' ? navigator.connection : null;
    if (conexion?.saveData || conexion?.type === 'cellular') break;
    const [t] = tramos;
    const fotos = await fotoDeUrl(url, t);
    const guardada = fotos ? await subePoster(url, fotos, t) : false;
    if (guardada) {
      hechas += 1;
      seguidosSinExito = 0;
    } else {
      anotaFallida(url);
      seguidosSinExito += 1;
    }
  }
  return hechas;
}
