/**
 * LAS LIGAS DE VIDEO QUE ACEPTA LA APP, sacadas de `videos.js` el 23 nov 2026 para que el conector de IA acepte exactamente las mismas
 * (`supabase/functions/mcp/app/ligas.js`, copiado por `scripts/compartir-con-mcp.mjs`). Puro.
 *
 * 24 nov 2026 (Andrés: «que se pueda utilizar el link» de cualquier red, dentro de la app): Facebook, Google Drive y Dropbox se suman a
 * YouTube, Vimeo, TikTok e Instagram. Todas se ven dentro de la app por el puente (`public/reproductor/`, ver `srcDelPuente` en `videos.js`).
 * `embed(id, texto)`: la dirección del reproductor oficial (Facebook la necesita entera). `archivo`: la liga es el video mismo (Dropbox), y el
 * puente lo pone en un <video>. `avisaFin`: de qué redes el puente sabe cuándo terminó el video (para el calentamiento guiado que pasa solo).
 * `vertical`: el video es de pie (un Short, un TikTok, un reel): el cuadro toma esa forma (Andrés, 24 nov: «que el cuadro esté amoldado al
 * tamaño que requiera el video»). `imagen`: su foto antes de tocar play (YouTube la da; las demás redes no sin pedirla a su servidor).
 */
export const LIGAS = [
  {
    de: 'YouTube',
    prueba: /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/i,
    embed: (id) => `https://www.youtube.com/embed/${id}`,
    // La foto del video, que YouTube da de cualquier video público (se ve antes de tocar play).
    imagen: (id) => `https://i.ytimg.com/vi/${id}/hqdefault.jpg`,
    vertical: (texto) => /youtube\.com\/shorts\//i.test(texto),
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
    vertical: () => true,
  },
  {
    // Un reel de Instagram se incrusta con /embed al final de su dirección.
    de: 'Instagram',
    prueba: /instagram\.com\/(?:reel|reels|p|tv)\/([\w-]+)/i,
    embed: (id) => `https://www.instagram.com/reel/${id}/embed`,
    vertical: () => true,
  },
  {
    // Videos públicos de Facebook (también los reels y las ligas cortas fb.watch), con su reproductor oficial.
    de: 'Facebook',
    prueba: /(?:facebook\.com\/(?:[^/?#]+\/videos\/|watch\/?\?v=|reel\/|share\/v\/)|fb\.watch\/)([\w.-]+)/i,
    embed: (_id, texto) => `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(texto)}&show_text=false`,
    vertical: (texto) => /\/(reel|share\/v)\//i.test(texto),
  },
  {
    // Un video de Google Drive compartido «cualquiera con el link»: su vista previa lo reproduce.
    de: 'Google Drive',
    prueba: /drive\.google\.com\/(?:file\/d\/|open\?id=)([\w-]{10,})/i,
    embed: (id) => `https://drive.google.com/file/d/${id}/preview`,
  },
  {
    // Una liga de Dropbox es el ARCHIVO mismo: con `raw=1` Dropbox entrega el video y se reproduce como uno nuestro.
    de: 'Dropbox',
    prueba: /(?:www\.)?dropbox\.com\/(?:s|scl\/fi)\/([^?#\s]+)/i,
    embed: (_id, texto) => { const u = new URL(texto); u.searchParams.delete('dl'); u.searchParams.set('raw', '1'); return u.toString(); },
    archivo: true,
  },
];

/** Las redes de las que el puente sabe cuándo terminó el video (y si falló). */
export const AVISAN_FIN = ['YouTube', 'Vimeo', 'Dropbox'];
export const avisaFin = (liga) => !!liga && AVISAN_FIN.includes(liga.de);

export function ligaExterna(url) {
  const texto = String(url ?? '').trim();
  if (!/^https?:\/\//i.test(texto)) return null;
  for (const l of LIGAS) {
    const m = l.prueba.exec(texto);
    if (m) {
      return {
        de: l.de, embed: l.embed(m[1], texto), abrir: texto, vertical: !!l.vertical?.(texto),
        ...(l.imagen ? { imagen: l.imagen(m[1]) } : null), ...(l.archivo ? { archivo: true } : null),
      };
    }
  }
  // Una dirección de internet que no reconocemos: no se incrusta (podría ser
  // cualquier cosa), pero sí se puede abrir fuera.
  if (/\.(mp4|webm|mov|m4v)(\?|$)/i.test(texto)) return null; // archivo de video suelto
  return { de: 'Enlace', embed: null, abrir: texto };
}

