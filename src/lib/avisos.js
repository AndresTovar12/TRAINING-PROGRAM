import { supabase } from '@/lib/supabase';

/* LOS AVISOS QUE RECIBE UNA PERSONA (15 oct 2026): pestaña «Avisos» de Mi perfil. Se guardan en `preferencias_de_avisos` (una fila por persona).
   Quien MANDA los avisos (correo y notificaciones del teléfono) lee esa fila antes de mandar. Hoy lo único que sale por correo es lo de la cuenta; el resto llega con las notificaciones. */

export const CATEGORIAS = [
  { id: 'mensajes', texto: 'Mensajes', detalle: 'Cuando tu coach, tu fisio o tus atletas te escriben.' },
  { id: 'recordatorios', texto: 'Recordatorio de tu entreno', detalle: 'Un aviso el día que te toca entrenar.' },
  { id: 'tecnica', texto: 'Técnica revisada', detalle: 'Cuando te contestan un video de técnica.' },
  { id: 'compras', texto: 'Compras y membresías', detalle: 'Renovaciones, pagos que fallan y recibos.' },
  { id: 'novedades', texto: 'Novedades de Training Lab', detalle: 'Funciones nuevas. Pocas veces al mes.' },
];
export const CANALES = [
  { id: 'por_correo', texto: 'Por correo' },
  { id: 'por_telefono', texto: 'En el teléfono' },
];
export const POR_DEFECTO = { mensajes: true, recordatorios: true, tecnica: true, compras: true, novedades: false, por_correo: true, por_telefono: true };

/** Sus preferencias; si nunca las guardó, las de fábrica. */
export async function leeMisAvisos() {
  const { data, error } = await supabase.from('preferencias_de_avisos').select('*').maybeSingle();
  if (error) throw error;
  return { ...POR_DEFECTO, ...(data ?? {}) };
}

/** Guarda UN cambio (`{ mensajes: false }`); crea la fila si no existía. */
export async function guardaMiAviso(cambio) {
  const { data: sesion } = await supabase.auth.getSession();
  const uid = sesion?.session?.user?.id;
  if (!uid) throw new Error('Vuelve a entrar.');
  const { error } = await supabase.from('preferencias_de_avisos').upsert({ user_id: uid, ...cambio, actualizado_en: new Date().toISOString() }, { onConflict: 'user_id' });
  if (error) throw error;
}
