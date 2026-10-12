import { supabase } from '@/lib/supabase';

/* LA TIENDA PÚBLICA: las páginas de un coach y de cada plan que vende, que ve cualquiera, también sin cuenta.

   Todo lo público sale de DOS funciones de la base (`perfil_publico` y `plan_publico`, ver docs/sql/2026-10-11-monetizacion.sql y 2026-10-12-pagina-publica-y-entrada.sql) que solo
   devuelven lo que el coach quiso enseñar: la ficha y la HOJA del programa (fases, semanas y el nombre de la sesión de cada día). Nunca un ejercicio. Comprar lo hace la Edge Function
   `comprar` (Stripe Checkout). */

/**
 * Las direcciones que son de la tienda: `/@usuario`, `/@usuario/plan` y las dos de regreso del pago. Cualquier otra, null (la app de siempre).
 * El usuario puede llevar letras, números y guion bajo; el plan, letras, números y guiones.
 */
export function rutaDeTienda(pathname) {
  const m = String(pathname ?? '').match(/^\/@([a-z0-9_]+)(?:\/([a-z0-9-]+))?\/?$/i);
  if (m) return m[2] ? { tipo: 'plan', usuario: m[1].toLowerCase(), slug: m[2].toLowerCase() } : { tipo: 'coach', usuario: m[1].toLowerCase(), slug: null };
  if (pathname === '/compra/lista') return { tipo: 'lista' };
  if (pathname === '/compra/cancelada') return { tipo: 'cancelada' };
  return null;
}

/** Un coach y sus planes publicados; null si no existe o no vende nada. */
export async function leePerfilPublico(usuario) {
  const { data, error } = await supabase.rpc('perfil_publico', { p_usuario: usuario });
  if (error) throw error;
  return data ?? null;
}

/** La ficha de UN plan; null si no existe o ya no se vende. */
export async function leePlanPublico(usuario, slug) {
  const { data, error } = await supabase.rpc('plan_publico', { p_usuario: usuario, p_slug: slug });
  if (error) throw error;
  return data ?? null;
}

/** Empieza la compra: devuelve la dirección de la página de pago de Stripe, a donde hay que mandar al comprador. */
export async function iniciaCompra({ usuario, slug, faseDeEntrada = null, semanaDeEntrada = null }) {
  const { data, error } = await supabase.functions.invoke('comprar', { body: { usuario, slug, fase_de_entrada: faseDeEntrada, semana_de_entrada: semanaDeEntrada } });
  if (error) {
    let mensaje = 'No se pudo empezar la compra. Inténtalo otra vez.';
    try { const cuerpo = await error.context?.json?.(); if (cuerpo?.error) mensaje = cuerpo.error; } catch { /* sin cuerpo legible */ }
    throw new Error(mensaje);
  }
  if (!data?.url) throw new Error('No se pudo abrir la página de pago.');
  return data.url;
}
