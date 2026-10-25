import { medidasDelNombre } from '@/features/training/home/nombreDeSesion';

/**
 * El nombre. `en`: 'h3' (por defecto) o 'span' (dentro de un botón, donde un título no cabe). `lineas`: el tope antes del «…».
 * `estilo`: lo que le falte a quien lo usa (color, margen). Va dentro de su caja (`.nombre-caja`), que mide el ancho de la columna.
 */
export function NombreDeSesion({ texto, en = 'h3', lineas = 3, tamanos, umbrales, desde = 0, estilo }) {
  const Texto = en;
  const nombre = String(texto ?? '');
  return (
    <span className="nombre-caja">
      <Texto className="nombre-texto" title={nombre} style={{ ...medidasDelNombre(nombre, { tamanos, umbrales, desde }), '--lineas': lineas, ...estilo }}>{nombre}</Texto>
    </span>
  );
}

