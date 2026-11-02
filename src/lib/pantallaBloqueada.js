/* EL ENTRENO EN LA PANTALLA BLOQUEADA Y EN LA ISLA DINÁMICA (Live Activity). Solo en la app de iPhone; en la web no hace nada.

   El dibujo vive en la extensión nativa `EntrenoWidget`; aquí solo se le dicen los datos. Los tiempos van como HORAS (fin de un descanso, inicio de un cronómetro) y
   el reloj del teléfono los cuenta solo: no hace falta mandar una actualización por segundo (el JavaScript duerme con la pantalla bloqueada). Se actualiza solo al CAMBIAR
   algo: de paso, de descanso, de kilómetro. Si algo falla (iOS viejo, actividades apagadas en Ajustes), todo sigue como si nada. */

import { Capacitor, registerPlugin } from '@capacitor/core';

const EntrenoLive = registerPlugin('EntrenoLive');
const enLaApp = () => Capacitor.isNativePlatform();

let viva = false;
let ultima = '';

/** `datos`: `{ nombre, titulo, detalle, tipo: 'trabajo'|'descanso'|'cardio'|'pausa', finMs?, inicioMs?, distancia?, ritmo?, pulso? }`. Empieza la actividad o la actualiza si ya había.
    Con `distancia`, la pantalla bloqueada dibuja la tarjeta de la carrera: además `simbolo` (el ícono, de SF Symbols), `etiquetaRitmo` y, en pausa, `transcurridoS`. */
export async function muestraEnPantallaBloqueada(datos) {
  if (!enLaApp()) return;
  const llave = JSON.stringify(datos);
  if (llave === ultima) return;
  ultima = llave;
  try {
    if (!viva) {
      const r = await EntrenoLive.empieza(datos);
      viva = !!r?.disponible;
    } else {
      const r = await EntrenoLive.actualiza(datos);
      viva = !!r?.disponible;
    }
  } catch { /* sin pantalla bloqueada: el entreno sigue igual */ }
}

/** El botón redondo de la tarjeta de la carrera (iOS 17 o más): `alAccion('pausa' | 'reanuda')`. Devuelve cómo dejar de escuchar. */
export function escuchaPantallaBloqueada(alAccion) {
  if (!enLaApp()) return () => {};
  let manejador = null;
  let vivo = true;
  EntrenoLive.addListener('accion', (e) => alAccion?.(e?.accion)).then((h) => { if (vivo) manejador = h; else h?.remove?.(); }).catch(() => {});
  return () => { vivo = false; manejador?.remove?.(); };
}

/** Quita la actividad (el entreno terminó o se cerró). */
export async function quitaDePantallaBloqueada() {
  if (!enLaApp() || (!viva && !ultima)) return;
  viva = false;
  ultima = '';
  try { await EntrenoLive.termina(); } catch { /* ya no estaba */ }
}
