/**
 * El «encuadre» de una foto: qué parte NO debe cortarse.
 *
 * Andrés, 7 oct 2026: la foto de una fase o de un plan se recortaba sola por el centro para llenar la tarjeta de Home
 * (en celular es angosta y alta) y a veces se cortaba lo importante. Ahora quien la pone elige un punto: la tarjeta se
 * recorta alrededor de él (`object-position`), sea cual sea su forma.
 *
 * El punto va PEGADO A LA DIRECCIÓN de la foto, como un fragmento: `https://…/abc.webp#foco=30,60` (x e y en %, de 0 a 100).
 * Un fragmento no cambia lo que se descarga ni el caché, y como la foto ya es solo un texto, el punto viaja solo adonde
 * viaje ella (el plan, «Mis planes», asignar, el historial) sin tocar la forma de los datos. Sin fragmento, el centro.
 */

const FRAGMENTO = /#foco=(\d{1,3}(?:\.\d+)?),(\d{1,3}(?:\.\d+)?)$/;
const entre = (n) => Math.min(100, Math.max(0, Math.round(n)));

/** La dirección sin el fragmento y el punto (50, 50 si no tiene). */
export function separaFoto(src) {
  const texto = typeof src === 'string' ? src : '';
  const m = FRAGMENTO.exec(texto);
  if (!m) return { url: texto, x: 50, y: 50 };
  return { url: texto.slice(0, m.index), x: entre(Number(m[1])), y: entre(Number(m[2])) };
}

/** La misma foto con otro punto. En el centro no lleva fragmento (queda como si nunca se hubiera encuadrado). */
export function conFoco(src, x, y) {
  const { url } = separaFoto(src);
  const px = entre(x);
  const py = entre(y);
  return px === 50 && py === 50 ? url : `${url}#foco=${px},${py}`;
}

/** Para `object-position` (con `object-fit: cover`). */
export function posicionDeFoto(src) {
  const { x, y } = separaFoto(src);
  return `${x}% ${y}%`;
}
