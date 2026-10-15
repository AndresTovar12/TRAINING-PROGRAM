/* El único código que corre en Cloudflare para la app (`app.traininglabapp.com`).

   La app en sí (pantallas, imágenes, código) son archivos estáticos: Cloudflare los sirve gratis y sin límite, sin pasar por aquí. Este programa SOLO se usa para el conector de IA:
   lo que llega a `/mcp` y a las direcciones `/.well-known/oauth-*` se reenvía a la función `mcp` de Supabase, que es donde vive el conector. Es lo que hace `vercel.json` en Vercel
   (sus reglas `rewrites`). Solo corre para esas direcciones (ver `run_worker_first` en `wrangler.jsonc`), así que el tope gratis de 100,000 usos al día cuenta únicamente las peticiones de IA. */

const MCP = 'https://ozwqqzrkgunrgxxwxmop.supabase.co/functions/v1/mcp';

/** A dónde se manda cada dirección, o `null` si no es del conector. */
export function destinoDe(ruta) {
  if (ruta === '/mcp' || ruta.startsWith('/mcp/')) return MCP + ruta.slice('/mcp'.length);
  if (ruta === '/.well-known/oauth-protected-resource' || ruta.startsWith('/.well-known/oauth-protected-resource/')) return `${MCP}/.well-known/oauth-protected-resource`;
  if (ruta === '/.well-known/oauth-authorization-server' || ruta.startsWith('/.well-known/oauth-authorization-server/')) return `${MCP}/.well-known/oauth-authorization-server`;
  return null;
}

export default {
  async fetch(peticion) {
    const url = new URL(peticion.url);
    const destino = destinoDe(url.pathname);
    if (!destino) return new Response('No encontrado', { status: 404 });
    // `redirect: 'manual'`: si la función contesta con una redirección (el inicio de sesión de la IA), se le pasa tal cual a quien preguntó.
    return fetch(new Request(destino + url.search, peticion), { redirect: 'manual' });
  },
};
