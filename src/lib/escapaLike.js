/* Para buscar un texto EXACTO (sin importar mayúsculas) con `.ilike(...)`: en un patrón de LIKE el guion bajo vale «cualquier letra» y el
   por ciento «cualquier cosa». Un usuario como «ana_perez» chocaba con «anaXperez» y decía «ya está en uso» sin estarlo (ETAPA 2, p142).
   Se escapan `\`, `%` y `_` con una diagonal inversa, que es el escape normal de Postgres. */
export const escapaLike = (texto) => String(texto ?? '').replace(/[\\%_]/g, '\\$&');
