/* DÓNDE VIVEN NUESTROS VIDEOS Y FOTOS (Cloudflare R2), en un solo lugar.

   Hoy se abren desde la dirección pública de R2 (`…r2.dev`), que Cloudflare limita y no recomienda para producción. Cuando se compre el dominio, los archivos nuevos saldrán de
   un subdominio propio (por ejemplo `https://videos.midominio.com`). Para ese día basta con poner `VITE_MEDIOS_URL` en Vercel y volver a publicar: esta lista reconoce la nueva
   dirección Y la anterior, así que nada se rompe mientras las direcciones viejas guardadas en la base se pasan a la nueva (ver docs/dominio.md y docs/sql/dominio-de-videos.sql).

   La función `r2-upload` hace lo mismo del lado del servidor con el secreto `R2_PUBLIC_URL`. */

const ANTERIOR = 'https://pub-4a3ae85521d744b5abf16550ea171189.r2.dev';
const CONFIGURADA = String(import.meta.env.VITE_MEDIOS_URL ?? '').trim().replace(/\/+$/, '');

/** Las direcciones desde donde se sirven nuestros archivos (la de ahora y la anterior). */
export const HOSTS_DE_MEDIOS = [...new Set([CONFIGURADA, ANTERIOR].filter(Boolean))];

/** ¿Este archivo vive en NUESTRO almacenamiento? (y no es una liga de TikTok o YouTube) */
export const esMedioNuestro = (url) => typeof url === 'string' && HOSTS_DE_MEDIOS.some((h) => url.startsWith(`${h}/`));

/** ¿Es un VIDEO nuestro (carpeta `videos/`)? */
export const esVideoNuestro = (url) => esMedioNuestro(url) && /\/videos\/[^/]+$/.test(url);
