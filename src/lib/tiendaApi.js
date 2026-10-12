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

/** Llama a una función del servidor y devuelve `{ status, datos }` también cuando contesta con error (las de aquí usan el código HTTP para decir qué pasó). Status 0 = sin conexión. */
async function llama(nombre, body) {
  const { data, error } = await supabase.functions.invoke(nombre, { body });
  if (!error) return { status: 200, datos: data };
  const r = error.context;
  let datos = null;
  if (typeof r?.json === 'function') { try { datos = await r.json(); } catch { /* sin cuerpo legible */ } }
  return { status: typeof r?.status === 'number' ? r.status : 0, datos };
}

/**
 * Empieza la compra: devuelve la dirección de la página de pago de Stripe, a donde hay que mandar al comprador.
 * Con sesión de atleta la compra es de su cuenta; sin sesión hay que pasar `correo` (compra de invitado). Si falla, el error trae `codigo` cuando el servidor lo dio:
 * `tiene_cuenta` (ese correo ya tiene cuenta: que entre), `correo_de_coach`, `correo_invalido`, `muchos_intentos`.
 */
export async function iniciaCompra({ usuario, slug, faseDeEntrada = null, semanaDeEntrada = null, correo = null }) {
  const { status, datos } = await llama('comprar', { usuario, slug, fase_de_entrada: faseDeEntrada, semana_de_entrada: semanaDeEntrada, correo });
  if (status !== 200 || !datos?.url) {
    const e = new Error(datos?.error || (status === 0 ? 'No hay conexión. Revisa tu internet e inténtalo otra vez.' : 'No se pudo empezar la compra. Inténtalo otra vez.'));
    e.codigo = datos?.codigo ?? null;
    throw e;
  }
  return datos.url;
}

/** Cómo va una compra, con la llave del pago (`?c=` de la liga a la que Stripe regresa). `{ estado: 'desconocida' }` si la llave no existe; `{ estado: 'sin_conexion' }` si no hubo respuesta. */
export async function leeCompraLista(sesion) {
  const { status, datos } = await llama('compra-lista', { sesion });
  if (status === 200) return datos;
  return status === 404 ? { estado: 'desconocida' } : { estado: 'sin_conexion' };
}

/** Quien compró sin cuenta pone su contraseña (una sola vez). Devuelve el correo con el que ya puede entrar; si no se pudo, lanza un error con el motivo. */
export async function ponContrasenaDeCompra(sesion, contrasena) {
  const { status, datos } = await llama('compra-lista', { sesion, contrasena });
  if (status !== 200 || !datos?.ok) throw new Error(datos?.error || 'No se pudo guardar tu contraseña. Inténtalo otra vez.');
  return datos.correo;
}
