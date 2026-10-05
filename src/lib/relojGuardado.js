import { reanuda, nuevoReloj } from './relojDeFormato.js';

/**
 * El reloj de un Set a medias, guardado en este dispositivo (`localStorage`), para que una
 * recarga o un cierre de la app a media serie no lo pierda. Como el reloj se calcula con
 * horas de arranque (ver `relojDeFormato.js`), al volver sigue donde iba.
 *
 * Es del dispositivo y no de la cuenta a propósito: un reloj en marcha es de ESTE teléfono, y
 * mandarlo a la base cada vez que cambia de tramo no tiene sentido. Lo que sí se guarda en la
 * cuenta es el resultado, cuando el atleta lo anota.
 *
 * `firma` es el formato y los ejercicios con los que se empezó: si el coach cambió el Set
 * mientras tanto, el reloj guardado ya no corresponde y se descarta.
 */
const PREFIJO = 'tl:reloj:';
const VIGENCIA_MS = 8 * 3600 * 1000;

export function leeRelojGuardado(clave, firma, plan) {
  try {
    const crudo = window.localStorage.getItem(PREFIJO + clave);
    if (!crudo) return nuevoReloj();
    const g = JSON.parse(crudo);
    if (g?.firma !== firma || !(Date.now() - g.en < VIGENCIA_MS)) return nuevoReloj();
    return reanuda(g.est, plan);
  } catch {
    return nuevoReloj();
  }
}

export function guardaReloj(clave, firma, est) {
  try {
    // Un reloj que ni empezó no vale la pena guardarlo.
    if (est.fase === 'listo') window.localStorage.removeItem(PREFIJO + clave);
    else window.localStorage.setItem(PREFIJO + clave, JSON.stringify({ firma, est, en: Date.now() }));
  } catch {
    // Sin almacenamiento (modo privado): el reloj corre igual, solo que una recarga lo pierde.
  }
}

export function borraReloj(clave) {
  try { window.localStorage.removeItem(PREFIJO + clave); } catch { /* nada que borrar */ }
}
