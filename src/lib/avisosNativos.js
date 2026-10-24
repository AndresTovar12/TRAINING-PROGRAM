/* AVISOS DEL TELÉFONO (solo dentro de la app de iPhone; en la web no hacen nada).

   Con la pantalla bloqueada o la app en segundo plano, iOS congela el JavaScript: ni el reloj ni los pitidos corren. Lo único que sí suena es un AVISO LOCAL que
   se dejó programado de antemano en el teléfono. Por eso, al empezar un descanso (o un cronómetro con tiempo) se programa un aviso para la hora exacta en que
   termina, y se quita si el atleta avanza antes. Con la app abierta y a la vista, el aviso no se muestra: ya suena el pitido de siempre.

   También la vibración (Taptic Engine): `navigator.vibrate` no existe en iPhone. */

import { Capacitor } from '@capacitor/core';

const enLaApp = () => Capacitor.isNativePlatform();

/** Los números de aviso: uno por tipo de cosa que se espera, para poder cambiarlo o quitarlo sin tocar otros. */
export const AVISO_DE_DESCANSO = 41001;
export const AVISO_DE_CRONOMETRO = 41002;

let permiso = null;
async function conPermiso() {
  const { LocalNotifications } = await import('@capacitor/local-notifications');
  if (permiso === null) {
    const hoy = await LocalNotifications.checkPermissions();
    permiso = hoy.display === 'granted' ? true : (await LocalNotifications.requestPermissions()).display === 'granted';
  }
  return permiso ? LocalNotifications : null;
}

/** Deja un aviso para la hora `fin` (milisegundos). Si ya había uno con ese `id`, lo cambia. Silencioso si algo falla. */
export async function avisaCuandoTermine({ id, fin, titulo = 'Training Lab', cuerpo }) {
  if (!enLaApp() || !(fin > Date.now() + 1500)) return;
  try {
    const LN = await conPermiso();
    if (!LN) return;
    await LN.cancel({ notifications: [{ id }] });
    await LN.schedule({ notifications: [{ id, title: titulo, body: cuerpo, schedule: { at: new Date(fin), allowWhileIdle: true } }] });
  } catch { /* sin aviso: el reloj sigue funcionando con la app abierta */ }
}

/** Quita un aviso que ya no hace falta (el atleta avanzó antes de que terminara). */
export async function quitaAviso(id) {
  if (!enLaApp()) return;
  try {
    const { LocalNotifications } = await import('@capacitor/local-notifications');
    await LocalNotifications.cancel({ notifications: [{ id }] });
  } catch { /* nada que quitar */ }
}

/** Una vibración corta. `tipo`: 'toque' (cambio de paso), 'fin' (se acabó el descanso o el reloj), 'listo' (marcaste algo). En la web usa `navigator.vibrate` si existe. */
export async function vibra(tipo = 'toque') {
  try {
    if (enLaApp()) {
      const { Haptics, ImpactStyle, NotificationType } = await import('@capacitor/haptics');
      if (tipo === 'fin') await Haptics.notification({ type: NotificationType.Success });
      else await Haptics.impact({ style: tipo === 'listo' ? ImpactStyle.Medium : ImpactStyle.Light });
    } else if (typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(tipo === 'fin' ? [60, 40, 60] : 15);
    }
  } catch { /* sin vibración */ }
}
