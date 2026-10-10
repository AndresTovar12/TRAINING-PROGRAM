import { supabase } from '@/lib/supabase';

/* LAS LLAMADAS A LA BASE de los mensajes (ver docs/mensajes.md y docs/sql/2026-10-10-mensajes.sql).

   Una conversación es el PAR (atleta, profesional). Los permisos los pone la base (RLS y funciones): aquí no se decide quién puede qué. Lo que no es un mensaje
   normal (marcar «visto», borrar, mandar o responder una técnica) pasa por funciones; la tabla no se actualiza a mano. */

export const POR_PAGINA = 40;
export const BUCKET = 'mensajes';

/** Una fila por conversación posible, con lo último que se dijo y lo que falta por leer (la función `bandeja`). */
export async function leeBandeja() {
  const { data, error } = await supabase.rpc('bandeja');
  if (error) throw error;
  return data ?? [];
}

/** Los mensajes de una conversación, de los más viejos a los más nuevos. Con `antes` (un `creado_en`) trae la página anterior. */
export async function leeMensajes(atletaId, profesionalId, { antes = null, limite = POR_PAGINA } = {}) {
  let q = supabase.from('mensajes').select('*').eq('atleta_id', atletaId).eq('profesional_id', profesionalId)
    .order('creado_en', { ascending: false }).limit(limite);
  if (antes) q = q.lt('creado_en', antes);
  const { data, error } = await q;
  if (error) throw error;
  return (data ?? []).reverse();
}

/** Cuántos mensajes del otro lado tiene sin ver quien llama (el número rojo). */
export async function cuentaSinLeer(uid) {
  const { count, error } = await supabase.from('mensajes').select('id', { count: 'exact', head: true })
    .neq('autor_id', uid).is('visto_en', null).is('eliminado_en', null);
  if (error) throw error;
  return count ?? 0;
}

/** Manda un texto. Devuelve el mensaje ya guardado. */
export async function mandaTexto({ atletaId, profesionalId, autorId, texto }) {
  const { data, error } = await supabase.from('mensajes')
    .insert({ atleta_id: atletaId, profesional_id: profesionalId, autor_id: autorId, tipo: 'texto', texto: texto.trim() })
    .select().single();
  if (error) throw error;
  return data;
}

/** «Visto»: marca como vistos los mensajes del otro lado. */
export async function marcaVistos(atletaId, profesionalId) {
  const { data, error } = await supabase.rpc('marcar_vistos', { a: atletaId, p: profesionalId });
  if (error) throw error;
  return data ?? 0;
}

/** Cada quien borra lo suyo, para los dos. Si el mensaje tenía un archivo, también se quita del bucket. */
export async function eliminaMensaje(id) {
  const { data: ruta, error } = await supabase.rpc('eliminar_mensaje', { mensaje: id });
  if (error) throw error;
  if (ruta) await supabase.storage.from(BUCKET).remove([ruta]).catch(() => {});
  return ruta ?? null;
}

/* ------------------------------------------------------------------ */
/* Archivos: foto, video y nota de voz                                 */
/* ------------------------------------------------------------------ */

const EXTENSION = {
  'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'video/mp4': 'mp4', 'video/quicktime': 'mov', 'video/webm': 'webm',
  'audio/mp4': 'm4a', 'audio/x-m4a': 'm4a', 'audio/aac': 'aac', 'audio/mpeg': 'mp3', 'audio/webm': 'webm', 'audio/ogg': 'ogg', 'audio/wav': 'wav',
};
/** «video/mp4;codecs=avc1» → «video/mp4»: lo que el bucket entiende. */
export const mimeBase = (mime) => String(mime || '').split(';')[0].trim().toLowerCase();
export const extensionDe = (mime) => EXTENSION[mimeBase(mime)] ?? 'bin';

/** Sube un archivo al bucket privado, a la carpeta de esta conversación. Devuelve su ruta (`<atleta>/<profesional>/<id>.<ext>`). */
export async function subeArchivo({ atletaId, profesionalId, archivo, mime = archivo.type }) {
  const tipo = mimeBase(mime);
  const ruta = `${atletaId}/${profesionalId}/${crypto.randomUUID()}.${extensionDe(tipo)}`;
  const { error } = await supabase.storage.from(BUCKET).upload(ruta, archivo, { contentType: tipo, upsert: false, cacheControl: '3600' });
  if (error) throw error;
  return ruta;
}

/**
 * Manda una foto, un video o una nota de voz: sube el archivo y guarda el mensaje. Si el mensaje no se guarda, el archivo se quita (no se queda huérfano).
 * `meta`: `{ segundos, ancho, alto }` de lo que se sepa del archivo.
 */
export async function mandaArchivo({ atletaId, profesionalId, autorId, tipo, archivo, mime = archivo.type, meta = {} }) {
  const ruta = await subeArchivo({ atletaId, profesionalId, archivo, mime });
  const adjunto = { ruta, mime: mimeBase(mime), bytes: archivo.size, ...meta };
  const { data, error } = await supabase.from('mensajes')
    .insert({ atleta_id: atletaId, profesional_id: profesionalId, autor_id: autorId, tipo, adjunto })
    .select().single();
  if (error) {
    await supabase.storage.from(BUCKET).remove([ruta]).catch(() => {});
    throw error;
  }
  return data;
}

// Las direcciones firmadas duran una hora; se guardan 55 minutos para no pedir la misma cada vez que se dibuja una burbuja.
const VIDA_DE_LA_URL = 55 * 60 * 1000;
const urls = new Map(); // ruta → { url, hasta }

/** Las direcciones para ver o escuchar esos archivos: `Map<ruta, url>` (lo que no se pudo firmar no está). */
export async function urlsFirmadas(rutas, { renueva = false } = {}) {
  const ahora = Date.now();
  const faltan = [...new Set(rutas)].filter((r) => r && (renueva || !urls.has(r) || urls.get(r).hasta < ahora));
  if (faltan.length) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(faltan, 3600);
    if (error) throw error;
    (data ?? []).forEach((d) => { if (d.signedUrl && !d.error) urls.set(d.path, { url: d.signedUrl, hasta: ahora + VIDA_DE_LA_URL }); });
  }
  return new Map(rutas.filter((r) => urls.has(r)).map((r) => [r, urls.get(r).url]));
}

/* ------------------------------------------------------------------ */
/* Técnica: el video de una serie, mandado a quien puso el ejercicio   */
/* ------------------------------------------------------------------ */

/**
 * El atleta le manda a un profesional el video de una serie: sube el archivo y crea la técnica con su tarjeta en la conversación (la función `mandar_tecnica`).
 * Devuelve el id de la técnica. Si no se pudo crear, el archivo se quita. `intentoDe`: la técnica anterior de la misma serie («Mandar otro intento»).
 */
export async function mandaTecnica({ atletaId, profesionalId, ejercicio, detalle = null, sesionId = null, clave = null, archivo, mime = archivo.type, segundos = null, intentoDe = null }) {
  const ruta = await subeArchivo({ atletaId, profesionalId, archivo, mime });
  const { data, error } = await supabase.rpc('mandar_tecnica', {
    p_profesional: profesionalId, p_ejercicio: ejercicio, p_detalle: detalle, p_sesion: sesionId, p_clave: clave,
    p_ruta: ruta, p_mime: mimeBase(mime), p_segundos: segundos === null ? null : Math.round(segundos), p_bytes: archivo.size, p_intento_de: intentoDe,
  });
  if (error) {
    await supabase.storage.from(BUCKET).remove([ruta]).catch(() => {});
    throw error;
  }
  return data;
}

/** Las técnicas con esos ids (la tarjeta de cada mensaje de técnica): `Map<id, fila>`. */
export async function leeTecnicas(ids) {
  const unicos = [...new Set(ids)].filter(Boolean);
  if (!unicos.length) return new Map();
  const { data, error } = await supabase.from('tecnicas').select('*').in('id', unicos);
  if (error) throw error;
  return new Map((data ?? []).map((t) => [t.id, t]));
}

/**
 * El profesional contesta una técnica. `veredicto`: 'correcta' (un toque) o 'corregir' (con `texto` y/o `adjunto` —`{ ruta, mime, bytes, segundos }` de un archivo ya subido—
 * y, si quiere, `marca`: el segundo del video donde está el detalle).
 */
export async function respondeTecnica({ tecnicaId, veredicto, texto = null, adjunto = null, marca = null }) {
  const { data, error } = await supabase.rpc('responder_tecnica', {
    p_tecnica: tecnicaId, p_veredicto: veredicto, p_texto: texto, p_adjunto: adjunto, p_marca: marca === null ? null : Math.max(0, Math.round(marca)),
  });
  if (error) throw error;
  return data;
}

/**
 * Avisa cuando algo cambia en los mensajes o las técnicas de `uid` (llegó uno, lo vieron, lo borraron). La base solo manda lo que esa persona puede leer.
 * Devuelve la función que corta la suscripción.
 */
export function suscribeMensajes(uid, alCambio) {
  const en = (tabla, filtro) => ({ event: '*', schema: 'public', table: tabla, filter: filtro });
  const canal = supabase.channel(`mensajes:${uid}`)
    .on('postgres_changes', en('mensajes', `atleta_id=eq.${uid}`), alCambio)
    .on('postgres_changes', en('mensajes', `profesional_id=eq.${uid}`), alCambio)
    .on('postgres_changes', en('tecnicas', `atleta_id=eq.${uid}`), alCambio)
    .on('postgres_changes', en('tecnicas', `profesional_id=eq.${uid}`), alCambio)
    .subscribe();
  return () => { supabase.removeChannel(canal); };
}
