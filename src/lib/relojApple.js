/* EL APPLE WATCH (solo en la app de iPhone; en la web no hace nada).

   El iPhone le manda al reloj lo que toca ahora (el nombre, cuánto falta, qué sigue) y el reloj le devuelve dos cosas: el PULSO en vivo (lo mide él, con una sesión de
   entreno que además guarda el entreno en Apple Salud) y lo que se toca en su pantalla («Listo», «Siguiente»). El puente nativo es `EntrenoWatchPlugin.swift`;
   la app del reloj está en `ios/App/TrainingLabWatch`. Si no hay reloj emparejado o la app del reloj no está instalada, todo sigue como si nada. */

import { Capacitor, registerPlugin } from '@capacitor/core';

const EntrenoWatch = registerPlugin('EntrenoWatch');
const enLaApp = () => Capacitor.isNativePlatform();

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
  try { return await EntrenoWatch.estado(); } catch { return { emparejado: false, instalada: false }; }
}
