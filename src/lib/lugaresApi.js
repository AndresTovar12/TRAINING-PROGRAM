import { supabase } from '@/lib/supabase';

/* LUGARES PARA AGREGAR ATLETAS, contra la base (14 oct 2026; ver `lib/limiteDeAtletas.js`). */

/** Los lugares de quien pregunta: `{ limite, usados, libres, ilimitado }`. Con `profesionalId` solo contesta si quien pregunta es el dueño. */
export async function lugaresDe(profesionalId = null) {
  const { data, error } = await supabase.rpc('lugares_de', profesionalId ? { p: profesionalId } : {});
  if (error) throw error;
  return data;
}

/** Los paquetes de lugares que se pueden comprar (los activos, del más chico al más grande). */
export async function paquetesDeLugares() {
  const { data, error } = await supabase.from('paquetes_de_lugares').select('*').eq('activo', true).order('orden').order('atletas_total');
  if (error) throw error;
  return data ?? [];
}

/** Cuántos atletas gratis recibe cada profesional nuevo (ajuste del dueño). */
export async function atletasGratisDeFabrica() {
  const { data, error } = await supabase.from('ajustes_publicos').select('valor').eq('clave', 'atletas_gratis').maybeSingle();
  if (error) throw error;
  const n = Number(data?.valor);
  return Number.isFinite(n) && n >= 0 ? n : 5;
}

/* ---------- Solo el dueño (la base se lo exige a cada una) ---------- */

/** Todos los paquetes, también los apagados. */
export async function todosLosPaquetes() {
  const { data, error } = await supabase.from('paquetes_de_lugares').select('*').order('orden').order('atletas_total');
  if (error) throw error;
  return data ?? [];
}

/** Crea o cambia un paquete. Sin `id` crea uno nuevo. */
export async function guardaPaquete(paquete) {
  const fila = {
    nombre: String(paquete.nombre ?? '').trim(),
    atletas_total: Math.round(Number(paquete.atletas_total)),
    precio_mxn: Number(paquete.precio_mxn),
    activo: paquete.activo !== false,
    orden: Math.round(Number(paquete.orden ?? 0)),
  };
  if (!fila.nombre) throw new Error('Ponle un nombre al paquete.');
  if (!(fila.atletas_total > 0)) throw new Error('Los atletas del paquete tienen que ser más de cero.');
  if (!(fila.precio_mxn >= 0)) throw new Error('El precio no puede ser negativo.');
  const q = paquete.id
    ? supabase.from('paquetes_de_lugares').update(fila).eq('id', paquete.id)
    : supabase.from('paquetes_de_lugares').insert(fila);
  const { data, error } = await q.select('*').single();
  if (error) throw error;
  return data;
}

export async function borraPaquete(id) {
  const { error } = await supabase.from('paquetes_de_lugares').delete().eq('id', id);
  if (error) throw error;
}

/** Cambia un ajuste del dueño (`atletas_gratis`, `ventas_abiertas`). */
export async function guardaAjuste(clave, valor) {
  const { error } = await supabase.from('ajustes_publicos').upsert({ clave, valor, actualizado_en: new Date().toISOString() });
  if (error) throw error;
}

/** Los ajustes de dinero en una sola lectura: `{ atletas_gratis, ventas_abiertas }`. */
export async function ajustesDeMonetizacion() {
  const { data, error } = await supabase.from('ajustes_publicos').select('clave, valor').in('clave', ['atletas_gratis', 'ventas_abiertas']);
  if (error) throw error;
  const porClave = Object.fromEntries((data ?? []).map((f) => [f.clave, f.valor]));
  return { atletas_gratis: Number(porClave.atletas_gratis ?? 5), ventas_abiertas: porClave.ventas_abiertas === true };
}

/**
 * Los tres poderes que solo tiene el dueño sobre un profesional:
 *  - `limite_atletas`: `null` = el de fábrica, `-1` = sin tope, un número = ese tope.
 *  - `comision_especial`: `null` = la normal de la app, un número = ese porcentaje.
 *  - `vitrina_suspendida`: la tienda del profesional deja de verse y de vender.
 * Un profesional no puede cambiarse estos campos (los cuida `guardar_campos_de_poder`).
 */
export async function guardaPoderes(profesionalId, parche) {
  const permitido = {};
  for (const k of ['limite_atletas', 'comision_especial', 'vitrina_suspendida']) if (k in parche) permitido[k] = parche[k];
  const { data, error } = await supabase.from('profiles').update(permitido).eq('id', profesionalId).select('*').single();
  if (error) throw error;
  return data;
}
