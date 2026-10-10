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
