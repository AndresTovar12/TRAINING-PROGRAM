/**
 * LAS LIGAS DE VIDEO QUE ACEPTA LA APP (YouTube, Vimeo, TikTok, Instagram), sacadas de `videos.js` el 23 nov 2026 SIN CAMBIOS para que el
 * conector de IA acepte exactamente las mismas (`supabase/functions/mcp/app/ligas.js`, copiado por `scripts/compartir-con-mcp.mjs`). Puro.
 */
export const LIGAS = [
  {
    de: 'YouTube',
    prueba: /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/i,
    embed: (id) => `https://www.youtube.com/embed/${id}`,
  },
  {
    de: 'Vimeo',
    prueba: /vimeo\.com\/(?:video\/)?(\d+)/i,
    embed: (id) => `https://player.vimeo.com/video/${id}`,
  },
  {
    de: 'TikTok',
    prueba: /tiktok\.com\/.*?\/video\/(\d+)/i,
    embed: (id) => `https://www.tiktok.com/embed/v2/${id}`,
  },
  {
    // Un reel de Instagram se incrusta con /embed al final de su dirección.
    de: 'Instagram',
    prueba: /instagram\.com\/(?:reel|reels|p|tv)\/([\w-]+)/i,
    embed: (id) => `https://www.instagram.com/reel/${id}/embed`,
  },
];

export function ligaExterna(url) {
  const texto = String(url ?? '').trim();
  if (!/^https?:\/\//i.test(texto)) return null;
  for (const l of LIGAS) {
    const m = l.prueba.exec(texto);
    if (m) return { de: l.de, embed: l.embed(m[1]), abrir: texto };
  }
  // Una dirección de internet que no reconocemos: no se incrusta (podría ser
  // cualquier cosa), pero sí se puede abrir fuera.
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(texto)) return null; // archivo de video suelto
  return { de: 'Enlace', embed: null, abrir: texto };
}

