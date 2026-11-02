/* ESPERAR CON TIEMPO LÍMITE (2 nov 2026; antes vivía en `lib/mapaNativo.js`, que lo sigue exportando). Es la salida de emergencia de lo que depende de algo que
   podría no contestar nunca: un plugin del iPhone (Preferences, el reloj) o el mapa nativo. No es una espera normal: lo de adentro contesta en milisegundos.
   Puro: se prueba en Node (`scripts/prueba-mapa-nativo.mjs`, `scripts/prueba-arranque.mjs`). */

/** Una promesa con tiempo límite: si no responde a tiempo, falla con `mensaje`. La original sigue su camino (quien la creó decide qué hacer con lo que llegue tarde). */
export function conTiempoLimite(promesa, ms, mensaje = 'tiempo agotado') {
  let reloj;
  const limite = new Promise((_, rechaza) => { reloj = setTimeout(() => rechaza(new Error(mensaje)), ms); });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(reloj));
}
