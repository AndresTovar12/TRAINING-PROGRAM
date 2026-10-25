/**
 * EL NOMBRE MANDA (24 oct 2026). Andrés, con la captura de su iPhone donde «Velocidad» salía «Velocida / d»: «no importa qué tan largo sea
 * el nombre del workout y no importa cuántos workouts haya. Nunca puede salir mal el nombre. Nunca puede salir mal esa card».
 *
 * Aquí vive la regla para TODA tarjeta de Home que muestre el nombre de un workout, un plan o una fase (`HoyTeToca`, `Cuadros`):
 *   1. El nombre tiene el ancho completo de su columna. Los botones de acción van DEBAJO (o arriba), nunca al lado.
 *   2. La letra se achica sola (dos pasos): por tramos según el largo del texto y la cantidad de sesiones (aquí), y después por el ancho real
 *      de la columna y su palabra más larga (en CSS, `cqw`; ver `.nombre-texto` en `index.css`). Así una palabra solo se parte a media letra
 *      cuando ni con la letra mínima cabe.
 *   3. Tope de líneas con «…»; el nombre completo queda en `title`.
 * Candado: `npm run prueba:tarjeta-hoy`.
 */

/** Los tamaños de la tarjeta de hoy, de más grande a más chico, y los largos (en caracteres) donde se pasa al siguiente. */
export const TAMANOS_DE_HOY = [28, 24, 21, 19, 17];
export const UMBRALES_DE_HOY = [20, 34, 52, 80];

const ANGOSTAS = /[ilj.,;:'!|()[\]¡¿"“”‘’]/;
const ANCHAS = /[mwMW@%]/;

/** Ancho aproximado de una palabra en «em» (Inter 800). Las mayúsculas y los dígitos pesan más; los emojis, más que nadie. Se redondea hacia arriba a propósito. */
export function anchoEnEm(palabra) {
  let em = 0;
  for (const c of palabra) {
    if (ANGOSTAS.test(c)) em += 0.38;
    else if (ANCHAS.test(c)) em += 0.95;
    else if (/\p{Extended_Pictographic}/u.test(c)) em += 1.25;
    else if (/[\p{Lu}\d]/u.test(c)) em += 0.74;
    else em += 0.62;
  }
  return em * 1.04;
}

/** La palabra más larga: el texto se parte en espacios y después de un guion (ahí el navegador sí puede cortar). */
export function palabraMasLarga(texto) {
  return String(texto ?? '').split(/\s+/).flatMap((p) => p.split(/(?<=[-–—/])/)).reduce((m, p) => Math.max(m, anchoEnEm(p)), 0);
}

/**
 * Las dos medidas que lee el CSS: `--fs` (tamaño máximo) y `--em` (ancho de la palabra más larga).
 * `desde`: cuántos tramos se baja de entrada (con varias sesiones la letra empieza más chica).
 */
export function medidasDelNombre(texto, { tamanos = TAMANOS_DE_HOY, umbrales = UMBRALES_DE_HOY, desde = 0 } = {}) {
  const largo = String(texto ?? '').length;
  const porLargo = umbrales.filter((u) => largo > u).length;
  const nivel = Math.min(porLargo + desde, tamanos.length - 1);
  return { '--fs': `${tamanos[nivel]}px`, '--em': Math.max(1, palabraMasLarga(texto)).toFixed(2) };
}

/** «Sigue: viernes · Lower Strength»: pega el « · » a la palabra de antes con un espacio duro, para que un renglón nunca empiece con «·». */
export const pegaSeparadores = (texto) => (typeof texto === 'string' ? texto.replace(/ ([·•|]) /g, '\u00A0$1 ') : texto);
