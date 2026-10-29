/* EL APPLE WATCH (solo en la app de iPhone; en la web no hace nada).

   El iPhone le manda al reloj lo que toca ahora (el nombre, cuánto falta, qué sigue) y el reloj le devuelve dos cosas: el PULSO en vivo (lo mide él, con una sesión de
   entreno que además guarda el entreno en Apple Salud) y lo que se toca en su pantalla («Listo», «Siguiente»). El puente nativo es `EntrenoWatchPlugin.swift`;
   la app del reloj está en `ios/App/TrainingLabWatch`. Si no hay reloj emparejado o la app del reloj no está instalada, todo sigue como si nada. */

import { Capacitor, registerPlugin } from '@capacitor/core';

const EntrenoWatch = registerPlugin('EntrenoWatch');
const enLaApp = () => Capacitor.isNativePlatform();

/** Se avisa cuando un entreno con el reloj termina (fase 5): `SincronizaReloj` va por el pulso a Apple Salud. `detail.fin`: la hora. */
export const AVISO_RELOJ_TERMINO = 'tl:reloj-termino';
/** Se avisa cuando terminó de traer lo del reloj después de un entreno (`SincronizaReloj`): `detail` = lo de `guardaImportacion`, o `null` si no llegó nada. */
export const AVISO_RELOJ_TRAJO = 'tl:reloj-trajo';
/** Se avisa cuando cambia algo del reloj que la app debe volver a leer (el modo de prueba, conectar o desconectar). */
export const AVISO_RELOJ_CAMBIO = 'tl:reloj-cambio';

/* «PROBAR COMO SI TUVIERA APPLE WATCH» (fase 5, solo administradores): `estadoDelReloj` contesta emparejado e instalada en toda la app. Vale solo para la
   cuenta que lo prendió (`fijaUsuarioDelReloj`) y solo dentro de la app del iPhone: en la web nunca hay reloj. */
const LLAVE_PRUEBA = 'reloj:prueba';
let usuario = null;
export const fijaUsuarioDelReloj = (id) => { usuario = id ?? null; };
export function pruebaDelReloj() {
  try { return !!usuario && window.localStorage.getItem(LLAVE_PRUEBA) === usuario; } catch { return false; }
}
export function ponPruebaDelReloj(si) {
  try {
    if (si && usuario) window.localStorage.setItem(LLAVE_PRUEBA, usuario); else window.localStorage.removeItem(LLAVE_PRUEBA);
    // Al prenderlo se vuelven a ver todas las invitaciones, aunque antes se hubiera cerrado la de Home.
    if (si) window.localStorage.removeItem('reloj:invita-cerrada');
  } catch { /* sin memoria */ }
  window.dispatchEvent(new CustomEvent(AVISO_RELOJ_CAMBIO));
}

let ultima = '';

/** `datos`: `{ deporte, titulo, detalle, tipo, finMs?, inicioMs? }`. Solo se manda cuando algo cambia. */
export async function enviaAlReloj(datos) {
  if (!enLaApp()) return;
  const llave = JSON.stringify(datos);
  if (llave === ultima) return;
  ultima = llave;
  try { await EntrenoWatch.envia(datos); } catch { /* sin reloj */ }
}

/** El entreno terminó o se cerró: el reloj deja de medir y guarda el entreno en Apple Salud. */
export async function terminaEnReloj() {
  if (!enLaApp() || !ultima) return;
  ultima = '';
  try { await EntrenoWatch.termina(); } catch { /* ya no estaba */ }
  window.dispatchEvent(new CustomEvent(AVISO_RELOJ_TERMINO, { detail: { fin: Date.now() } }));
}

/** Escucha lo que llega del reloj: `alAccion('listo' | 'siguiente')` y `alPulso(latidos)`. Devuelve cómo dejar de escuchar. */
export function escuchaReloj({ alAccion, alPulso }) {
  if (!enLaApp()) return () => {};
  const manejadores = [];
  EntrenoWatch.addListener('accion', (e) => alAccion?.(e?.accion)).then((h) => manejadores.push(h)).catch(() => {});
  EntrenoWatch.addListener('pulso', (e) => alPulso?.(e?.bpm ?? null)).then((h) => manejadores.push(h)).catch(() => {});
  return () => { manejadores.forEach((h) => h?.remove?.()); };
}

/** ¿Hay reloj emparejado con la app instalada? `{ emparejado, instalada }` (en la web, todo falso). */
export async function estadoDelReloj() {
  if (!enLaApp()) return { emparejado: false, instalada: false };
  if (pruebaDelReloj()) return { emparejado: true, instalada: true, prueba: true };
  try { return await EntrenoWatch.estado(); } catch { return { emparejado: false, instalada: false }; }
}
