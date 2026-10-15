/* RUTAS DE LA TIENDA PÚBLICA (puro: sin imports, para poder probarlo en node).

   Las direcciones de la tienda llevan arroba: `/@usuario/plan`. Cloudflare (donde vive la app desde el 15 oct 2026) la reescribe como `/%40usuario/plan` con una redirección, y
   el navegador entrega esa ruta CODIFICADA en `location.pathname`. Vercel la dejaba tal cual. Por eso toda ruta se decodifica ANTES de compararla: si no, las ligas públicas que
   la gente comparte (`…/@coach/plan`) caían en la pantalla de entrar. */

/** La ruta como la escribió quien la comparte: `%40` → `@`. Si trae algo mal codificado, se deja igual. */
export function rutaDecodificada(pathname) {
  const texto = String(pathname ?? '');
  try { return decodeURIComponent(texto); } catch { return texto; }
}

/**
 * Las direcciones que son de la tienda: `/@usuario`, `/@usuario/plan` y las dos de regreso del pago. Cualquier otra, null (la app de siempre).
 * El usuario puede llevar letras, números y guion bajo; el plan, letras, números y guiones.
 */
export function rutaDeTienda(pathname) {
  const ruta = rutaDecodificada(pathname);
  const m = ruta.match(/^\/@([a-z0-9_]+)(?:\/([a-z0-9-]+))?\/?$/i);
  if (m) return m[2] ? { tipo: 'plan', usuario: m[1].toLowerCase(), slug: m[2].toLowerCase() } : { tipo: 'coach', usuario: m[1].toLowerCase(), slug: null };
  if (ruta === '/compra/lista') return { tipo: 'lista' };
  if (ruta === '/compra/cancelada') return { tipo: 'cancelada' };
  return null;
}
