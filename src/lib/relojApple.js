/* EL APPLE WATCH (solo en la app de iPhone; en la web no hace nada).

   El iPhone le manda al reloj lo que toca ahora (el nombre, cuánto falta, qué sigue) y el reloj le devuelve dos cosas: el PULSO en vivo (lo mide él, con una sesión de
   entreno que además guarda el entreno en Apple Salud) y lo que se toca en su pantalla («Listo», «Siguiente»). El puente nativo es `EntrenoWatchPlugin.swift`;
   la app del reloj está en `ios/App/TrainingLabWatch`. Si no hay reloj emparejado o la app del reloj no está instalada, todo sigue como si nada.

   SIN EL IPHONE (1 nov 2026, parte 3, ver `lib/relojSinTelefono.js`): además el iPhone le manda su PLAN (`mandaPlanAlReloj`), el reloj entrena solo y lo que
   termina llega aquí aunque la app estuviera cerrada (`pendientesDelReloj` / `confirmaDelReloj`). Mientras el reloj tiene un entreno suyo en curso, lo
   avisa (`useRelojEnCurso`): el iPhone dice «Entreno en curso en tu reloj» y no deja empezar otro. */

import { useSyncExternalStore } from 'react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import { enCursoDelReloj, firmaDelPlan } from '@/lib/relojSinTelefono';

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

/* ---- Sin el iPhone (parte 3) ---- */

let firmaMandada = '';
/**
 * Le manda al reloj su plan (lo de `planParaElReloj`). Va por el contexto de WatchConnectivity: llega aunque el reloj esté dormido y el reloj lo guarda.
 * Solo si cambió algo (`firmaDelPlan`), salvo `forzar` (al abrir la app). `true` si se mandó.
 */
export async function mandaPlanAlReloj(plan, { forzar = false } = {}) {
  if (!enLaApp() || !plan) return false;
  const firma = firmaDelPlan(plan);
  if (!forzar && firma === firmaMandada) return false;
  try {
    const r = await EntrenoWatch.mandaPlan({ plan: JSON.stringify(plan) });
    if (r?.enviado === false) return false;
    firmaMandada = firma;
    return true;
  } catch { return false; }
}

/** Lo que el reloj mandó y el plugin guardó en disco (aunque la app estuviera cerrada): `[{ id, resultado }]` (`resultado` es el texto tal cual). */
export async function pendientesDelReloj() {
  if (!enLaApp()) return [];
  try {
    const r = await EntrenoWatch.pendientes();
    return Array.isArray(r?.resultados) ? r.resultados.filter((x) => typeof x?.id === 'string') : [];
  } catch { return []; }
}

/** Ya quedó en la cola del teléfono: el plugin ya lo puede borrar de su disco. */
export async function confirmaDelReloj(id) {
  if (!enLaApp() || !id) return;
  try { await EntrenoWatch.confirma({ id }); } catch { /* se queda y se confirma la próxima vez */ }
}

/** Ya subió al servidor: si el reloj está cerca, su pantalla final pasa a «{quien} ya lo ve». */
export async function avisaAlRelojQueSubio(id) {
  if (!enLaApp() || !id) return;
  try { await EntrenoWatch.avisaSubido({ id }); } catch { /* el reloj no está cerca: no pasa nada */ }
}

/* El entreno que hay en curso EN EL RELOJ (uno que se empezó ahí). El reloj lo publica en su contexto; el plugin lo guarda y avisa. */
let enCurso = null;
const oyentesEnCurso = new Set();
const ponEnCurso = (crudo) => {
  let estado = crudo;
  if (typeof crudo === 'string') { try { estado = JSON.parse(crudo); } catch { estado = null; } }
  const nuevo = enCursoDelReloj(estado);
  if (JSON.stringify(nuevo) === JSON.stringify(enCurso)) return;
  enCurso = nuevo;
  oyentesEnCurso.forEach((f) => { try { f(); } catch { /* una pantalla que ya se fue */ } });
};
const suscribeEnCurso = (f) => { oyentesEnCurso.add(f); return () => oyentesEnCurso.delete(f); };
const fotoEnCurso = () => enCurso;

/** `{ titulo, modo, sesion, desde }` mientras el reloj tiene un entreno suyo en curso; `null` si no (en la web, siempre `null`). */
export function useRelojEnCurso() {
  return useSyncExternalStore(suscribeEnCurso, fotoEnCurso, () => null);
}
/** Lo mismo, fuera de React. */
export const relojEnCursoAhora = () => enCurso;

/** Vuelve a preguntarle al plugin si el reloj tiene un entreno en curso (al abrir y al volver a la app). */
export async function revisaEnCursoDelReloj() {
  if (!enLaApp()) return;
  try { const r = await EntrenoWatch.estado(); ponEnCurso(r?.enCurso ?? null); } catch { /* sin reloj */ }
}

/**
 * Escucha lo que el reloj manda sin que nadie lo pida: `alResultado()` cuando el plugin guardó un entreno terminado (hay que pasarlo a la cola) y los
 * cambios de «en curso». Devuelve cómo dejar de escuchar.
 */
export function escuchaLoQueLlega({ alResultado }) {
  if (!enLaApp()) return () => {};
  const manejadores = [];
  EntrenoWatch.addListener('resultado', () => alResultado?.()).then((h) => manejadores.push(h)).catch(() => {});
  EntrenoWatch.addListener('enCurso', (e) => ponEnCurso(e?.enCurso ?? null)).then((h) => manejadores.push(h)).catch(() => {});
  return () => { manejadores.forEach((h) => h?.remove?.()); };
}
