import { Capacitor } from '@capacitor/core';
import { App as AppNativa } from '@capacitor/app';
import { supabase } from '@/lib/supabase';

export { anotaLoQueEscribi, instante, loEscribiYo, mismoInstante } from '@/lib/planesEscritos';

/* LOS CAMBIOS DEL PLAN LLEGAN SOLOS (5 nov 2026, punto 3 de `docs/superpowers/specs/2026-11-05-integraciones-y-estado.md`). Andrés: «hay que salir y cerrar
   sesión para ver los cambios, eso está horrible». Antes la app del atleta pedía los planes al entrar y al volver la señal, nada más, y el editor del coach no
   se enteraba si el plan cambió en otro lado (el conector, otro aparato).

   Tres piezas, las mismas para la app del atleta (`PlanContext`), el editor del coach (`PlanBuilder`) y el repertorio (`ExercisesPanel`):
   · `escuchaPlanes`: Supabase Realtime sobre `plans` (como los mensajes, `mensajesApi.js`). La base solo le manda a cada quien lo que su política de lectura
     deja ver (`docs/sql/2026-11-05-plans-en-vivo.sql`).
   · `alVolverALaApp`: al volver a la pestaña (`visibilitychange`) o a la app del iPhone (`appStateChange` activo), con cuánto tiempo se estuvo fuera.
   · Lo que ESTE aparato acaba de guardar no cuenta como «cambió en otro lado»: `updatePlan` y compañía anotan el `updated_at` que escribieron
     (`anotaLoQueEscribi`) y el aviso en vivo con ese mismo `updated_at` se ignora (`loEscribiYo`). */

/** Fuera de la app menos de esto, al volver no se pide nada (el aviso en vivo ya lo trajo). */
export const FUERA_MINIMO_MS = 20000;
/** Al llegar un cambio en vivo se espera esto antes de pedir, por si llegan varios juntos (el conector guarda un plan en varios pasos). */
export const ESPERA_EN_VIVO_MS = 1500;

let n = 0;
/**
 * Escucha en vivo los cambios de `plans` que pasan el filtro de Realtime (`user_id=eq.<id>` o `id=eq.<id>`). `alCambiar(payload)`: `payload.new` es la fila
 * nueva (en un borrado, `payload.old` trae solo el id). Devuelve cómo dejar de escuchar.
 */
export function escuchaPlanes(filtro, alCambiar) {
  n += 1;
  const canal = supabase.channel(`plans:${filtro}:${n}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'plans', filter: filtro }, (payload) => alCambiar(payload))
    .subscribe();
  return () => { supabase.removeChannel(canal); };
}

/**
 * `fn(msFuera)` al volver a la app: en la web, la pestaña vuelve a verse (`visibilitychange`); en el iPhone, además, la app vuelve a estar activa
 * (`appStateChange`). Una sola llamada por vuelta aunque lleguen los dos avisos. Devuelve cómo dejar de escuchar.
 */
export function alVolverALaApp(fn) {
  let fueraDesde = typeof document !== 'undefined' && document.visibilityState === 'hidden' ? Date.now() : null;
  const sale = () => { if (fueraDesde === null) fueraDesde = Date.now(); };
  const vuelve = () => {
    if (fueraDesde === null) return;
    const ms = Date.now() - fueraDesde;
    fueraDesde = null;
    fn(ms);
  };
  const alCambiarVista = () => (document.visibilityState === 'hidden' ? sale() : vuelve());
  document.addEventListener('visibilitychange', alCambiarVista);
  let oyente = null;
  if (Capacitor.isNativePlatform()) {
    try {
      oyente = AppNativa.addListener('appStateChange', ({ isActive }) => (isActive ? vuelve() : sale()));
    } catch { /* sin el plugin: basta con `visibilitychange` */ }
  }
  return () => {
    document.removeEventListener('visibilitychange', alCambiarVista);
    Promise.resolve(oyente).then((o) => o?.remove?.()).catch(() => {});
  };
}
