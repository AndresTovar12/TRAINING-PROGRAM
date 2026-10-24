/* «EMPEZAR» DESDE HOME ABRE EL ENTRENO (23 oct 2026, PDF «Botones de interacción en el entreno»: «el botón de empezar no empieza el entreno, te lleva a ver lo que tienes en el día»).
   Home navega al día y, ya ahí, el botón de la sesión (`BotonDelEntreno`) tiene que abrirse solo. Es un aviso de un solo uso entre las dos pantallas: Home dice QUÉ sesión
   (`pideAbrirEntreno`) y el botón de esa sesión lo recoge al aparecer (`recogeEntrenoPendiente`). Caduca a los 8 segundos: si la sesión nunca aparece (otro programa, otra
   semana), no se abre nada por sorpresa más tarde. */
const VIGENCIA_MS = 8000; // con un teléfono lento o la pantalla del plan aún cargando, 4 s no alcanzaban
let pendiente = null;

export function pideAbrirEntreno(sesionId) {
  pendiente = sesionId ? { sesionId, hasta: Date.now() + VIGENCIA_MS } : null;
}

/** ¿Hay un aviso vigente para esta sesión? (sin consumirlo): una tarjeta cerrada lo usa para abrirse y dejar que su botón lo recoja. */
export function hayEntrenoPendiente(sesionId) {
  return !!pendiente && pendiente.sesionId === sesionId && Date.now() <= pendiente.hasta;
}

/** ¿Home pidió abrir el entreno de ESTA sesión? Si sí, lo consume (solo una vez). */
export function recogeEntrenoPendiente(sesionId) {
  if (!pendiente || pendiente.sesionId !== sesionId || Date.now() > pendiente.hasta) return false;
  pendiente = null;
  return true;
}
