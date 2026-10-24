/* global HTMLRewriter */
/* El único código que corre en Cloudflare para la app (`app.traininglabapp.com`).

   La app en sí (pantallas, imágenes, código) son archivos estáticos: Cloudflare los sirve gratis y sin límite, sin pasar por aquí. Este programa SOLO se usa para el conector de IA:
   lo que llega a `/mcp` y a las direcciones `/.well-known/oauth-*` se reenvía a la función `mcp` de Supabase, que es donde vive el conector. Es lo que hace `vercel.json` en Vercel
   (sus reglas `rewrites`). Solo corre para esas direcciones (ver `run_worker_first` en `wrangler.jsonc`), así que el tope gratis de 100,000 usos al día cuenta únicamente las peticiones de IA.

   LA TARJETITA AL COMPARTIR UNA LIGA (auditoría p5, 24 oct 2026). Al pegar `app.traininglabapp.com/@coach/plan` en Instagram, WhatsApp o Facebook, sus robots leen la página SIN ejecutar la app, y en
   `index.html` no hay nada del plan: salía solo «Training Lab». Por eso las direcciones `/@usuario` y `/@usuario/plan` también pasan por aquí: se lee el plan público (la misma función de la base
   que usa la página: `plan_publico` / `perfil_publico`) y se le ponen a `index.html` el título, la descripción, la foto y el precio. Si la base no contesta en 2 s o no existe, se sirve la página de siempre. */

const MCP = 'https://ozwqqzrkgunrgxxwxmop.supabase.co/functions/v1/mcp';
const API = 'https://ozwqqzrkgunrgxxwxmop.supabase.co/rest/v1/rpc';
// La llave PÚBLICA de Supabase (la misma que lleva la app en el navegador): solo deja leer lo que ya es público.
const LLAVE_PUBLICA = 'sb_publishable_ApSlA6PxKg9WVuGYSVRk4Q_11D379x_';
const SITIO = 'https://app.traininglabapp.com';

/** A dónde se manda cada dirección, o `null` si no es del conector. */
export function destinoDe(ruta) {
  if (ruta === '/mcp' || ruta.startsWith('/mcp/')) return MCP + ruta.slice('/mcp'.length);
  if (ruta === '/.well-known/oauth-protected-resource' || ruta.startsWith('/.well-known/oauth-protected-resource/')) return `${MCP}/.well-known/oauth-protected-resource`;
  if (ruta === '/.well-known/oauth-authorization-server' || ruta.startsWith('/.well-known/oauth-authorization-server/')) return `${MCP}/.well-known/oauth-authorization-server`;
  return null;
}

/** `/@usuario` o `/@usuario/plan` → `{ usuario, slug }` (`slug` nulo en la página del coach), o `null`. */
export function tiendaDe(ruta) {
  let r;
  try { r = decodeURIComponent(ruta); } catch { /* una dirección rota no es de la tienda */ return null; }
  const m = r.match(/^\/@([a-z0-9_]+)(?:\/([a-z0-9-]+))?\/?$/i);
  return m ? { usuario: m[1].toLowerCase(), slug: m[2] ? m[2].toLowerCase() : null } : null;
}

const recorta = (t, n) => { const x = String(t ?? '').replace(/\s+/g, ' ').trim(); return x.length > n ? `${x.slice(0, n - 1).trimEnd()}…` : x; };
const pesos = (n) => `$${Number(n).toLocaleString('es-MX')} MXN`;

/**
 * Lo que se le dice a Instagram/WhatsApp/Facebook de una liga: título, descripción, foto y dirección, o `null` si no hay nada que decir.
 * `datos`: lo que contesta `plan_publico` (con `titulo`, `precio`, `tipo`, `foto`, `coach`…) o `perfil_publico` (con `nombre`, `bio`, `foto`…).
 */
export function vistaPreviaDe(datos, { usuario, slug }) {
  if (!datos || typeof datos !== 'object') return null;
  const url = `${SITIO}/@${usuario}${slug ? `/${slug}` : ''}`;
  if (slug) {
    if (!datos.titulo) return null;
    const precio = Number(datos.precio) > 0 ? `${pesos(datos.precio)}${datos.tipo === 'membresia' ? ' al mes' : ''}` : 'Gratis';
    const quien = datos.coach?.nombre ? `por ${datos.coach.nombre}` : '';
    return {
      titulo: recorta(`${datos.titulo}${quien ? ` · ${quien}` : ''}`, 90),
      descripcion: recorta([precio, datos.descripcion || datos.objetivo].filter(Boolean).join(' · '), 200),
      imagen: datos.foto || datos.coach?.foto || null,
      url,
    };
  }
  const nombre = datos.nombre ?? datos.coach?.nombre;
  if (!nombre) return null;
  return {
    titulo: recorta(`${nombre} en Training Lab`, 90),
    descripcion: recorta(datos.bio || datos.profesion || 'Mira sus planes y entrena con él o ella.', 200),
    imagen: datos.foto ?? datos.coach?.foto ?? null,
    url,
  };
}

const escapa = (t) => String(t).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');

/** Las etiquetas `<meta>` que se agregan a `index.html` (y el título de la pestaña). */
export function etiquetasDe(v) {
  const m = [
    ['og:type', 'website'], ['og:site_name', 'Training Lab'], ['og:title', v.titulo], ['og:description', v.descripcion], ['og:url', v.url],
    ['twitter:card', v.imagen ? 'summary_large_image' : 'summary'], ['twitter:title', v.titulo], ['twitter:description', v.descripcion],
    ...(v.imagen ? [['og:image', v.imagen], ['twitter:image', v.imagen]] : [['og:image', `${SITIO}/icon-512.png`]]),
  ];
  return m.map(([k, c]) => `<meta ${k.startsWith('og:') ? 'property' : 'name'}="${k}" content="${escapa(c)}">`).join('');
}

async function leeTienda(tienda) {
  const cuerpo = tienda.slug ? { p_usuario: tienda.usuario, p_slug: tienda.slug } : { p_usuario: tienda.usuario };
  const r = await fetch(`${API}/${tienda.slug ? 'plan_publico' : 'perfil_publico'}`, {
    method: 'POST', headers: { 'content-type': 'application/json', apikey: LLAVE_PUBLICA, authorization: `Bearer ${LLAVE_PUBLICA}` },
    body: JSON.stringify(cuerpo), signal: AbortSignal.timeout(2000),
  });
  return r.ok ? r.json() : null;
}

async function conVistaPrevia(peticion, env, tienda) {
  // Se pide `/` y no `/index.html`: pedir `/index.html` hace que Cloudflare conteste con una REDIRECCIÓN a `/` (y las ligas compartidas caían en el inicio).
  // Si por lo que sea no llega una página buena, se sirve lo de siempre (la página de la liga tal cual, como antes de este programa).
  const delSitio = () => env.ASSETS.fetch(peticion);
  try {
    const pagina = await env.ASSETS.fetch(new Request(`${new URL(peticion.url).origin}/`, { method: 'GET', headers: peticion.headers }));
    if (!pagina.ok || pagina.redirected) return delSitio();
    const v = vistaPreviaDe(await leeTienda(tienda), tienda);
    if (!v) return pagina;
    return new HTMLRewriter()
      .on('title', { element(e) { e.setInnerContent(v.titulo); } })
      .on('head', { element(e) { e.append(etiquetasDe(v), { html: true }); } })
      .transform(pagina);
  } catch {
    return delSitio(); // sin base o sin red: la página de siempre
  }
}

export default {
  async fetch(peticion, env) {
    const url = new URL(peticion.url);
    const destino = destinoDe(url.pathname);
    if (!destino) {
      const tienda = peticion.method === 'GET' ? tiendaDe(url.pathname) : null;
      if (tienda && env?.ASSETS) return conVistaPrevia(peticion, env, tienda);
      return env?.ASSETS ? env.ASSETS.fetch(peticion) : new Response('No encontrado', { status: 404 });
    }
    // `redirect: 'manual'`: si la función contesta con una redirección (el inicio de sesión de la IA), se le pasa tal cual a quien preguntó.
    return fetch(new Request(destino + url.search, peticion), { redirect: 'manual' });
  },
};
