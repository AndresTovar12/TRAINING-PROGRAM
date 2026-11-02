/* EL SENSOR DE MOVIMIENTO DEL IPHONE, LO PURO (2 nov 2026, bug «parado en la calle sumó 50 m en 87 s con ritmo 18:13 /km y la pausa automática nunca entró»).

   Entre edificios (mala geometría) el iPhone daba ~0.9 m/s estando quieto, y la posición brincaba con esa velocidad: el GPS solo no distingue eso de caminar.
   El sensor de movimiento sí: `CMMotionActivityManager` (quieto, caminando, corriendo, en bici) y `CMPedometer` (los pasos). El puente nativo es
   `MovimientoPlugin.swift` y lo enciende `lib/movimientoNativo.js`; aquí solo se junta lo que llega y se decide.

   EL VEREDICTO (`veredicto`): 'quieto', 'mueve' o `null` (el sensor no sabe: mandan las reglas del GPS, como en la web).
     · Pasos recientes (los últimos 5 s) y más nuevos que el «quieto» del sensor → 'mueve' (el sensor tarda unos segundos en dejar de decir «quieto» al arrancar).
     · El sensor dice «quieto» 3 s seguidos (con confianza media o alta) → 'quieto'.
     · Correr, caminar o senderismo con podómetro: sin pasos en 5 s → 'quieto'.
     · El sensor dice caminando o corriendo (a pie), o en bici (bici) → 'mueve'.
     · En bici el podómetro no sirve: sin «en bici» ni «quieto», `null`.
   Con 'quieto', el punto entra como parado (`q: 1`) aunque el GPS diga otra cosa, y la pausa automática entra. Salir de parado necesita 'mueve': el GPS solo
   no basta (salvo con `null`). Se prueba con `scripts/prueba-ruta.mjs`. */

/** El sensor tiene que decir «quieto» este tiempo seguido (ms) para que cuente. */
export const QUIETO_MS = 3000;
/** Sin pasos este tiempo (ms), a pie, se está parado. */
export const SIN_PASOS_MS = 5000;
const A_PIE = ['correr', 'caminar', 'senderismo'];

/** Lo que se sabe al encender el sensor. `hayActividad`/`hayPasos`: si el iPhone los tiene; `permiso`: 'si' | 'negado' | 'restringido' | 'sin_preguntar'. */
export const sensorNuevo = (ahoraMs, { hayActividad = false, hayPasos = false, permiso = null } = {}) => ({
  desde: ahoraMs, hayActividad, hayPasos, permiso, vivo: permiso === 'si', actividad: null, pasos: 0, pasoEn: null,
});

/** Contestó `inicia`: qué tiene este iPhone y si hay permiso. */
export const conInicio = (s, r) => ({
  ...s, hayActividad: !!r?.actividad, hayPasos: !!r?.pasos, permiso: r?.permiso ?? s.permiso, vivo: s.vivo || r?.permiso === 'si',
});

/** Contestó la pregunta del permiso. Negado: el sensor no cuenta (mandan las reglas del GPS). */
export function conPermiso(s, { permiso }) {
  if (permiso === 'si') return { ...s, permiso, vivo: true };
  if (permiso === 'negado' || permiso === 'restringido') return { ...s, permiso, vivo: false };
  return { ...s, permiso };
}

/** Un cambio de actividad: `{ estado, confianza (0 baja, 1 media, 2 alta), en (ms: desde cuándo está así) }`. Si sigue igual, se queda el «desde» de antes. */
export function conActividad(s, { estado, confianza, en }, ahoraMs) {
  const igual = s.actividad?.estado === estado;
  const desde = Number.isFinite(Number(en)) && Number(en) > 0 ? Math.min(Number(en), ahoraMs) : ahoraMs;
  return { ...s, vivo: s.permiso === 'negado' || s.permiso === 'restringido' ? false : true, actividad: { estado, confianza: Number(confianza) || 0, en: igual ? s.actividad.en : desde } };
}

/** El podómetro falló (sin permiso, o el iPhone no pudo): sus pasos ya no cuentan, ni su «sin pasos en 5 s». */
export const sinPasos = (s) => ({ ...s, hayPasos: false });

/** Los pasos desde que se encendió: `{ pasos, en (ms del último conteo) }`. Solo cuando suben se anota la hora: esa es la de los últimos pasos. */
export function conPasos(s, { pasos, en }, ahoraMs) {
  const n = Number(pasos) || 0;
  if (n <= s.pasos) return s.vivo ? s : { ...s, vivo: true };
  const hora = Number.isFinite(Number(en)) && Number(en) > 0 ? Math.min(Number(en), ahoraMs) : ahoraMs;
  return { ...s, vivo: true, pasos: n, pasoEn: hora };
}

/**
 * ¿Qué dice el sensor ahora? `{ v: 'quieto' | 'mueve', desde (ms) }` o `null` si no sabe. `desde`: con 'quieto', desde cuándo está quieto (de ahí cuenta la
 * pausa automática); con 'mueve', la hora de lo último que dijo que se mueve (para reanudar solo si es más nuevo que la pausa).
 */
export function veredicto(s, deporte, ahoraMs) {
  if (!s?.vivo) return null;
  const a = s.actividad;
  const aPie = A_PIE.includes(deporte);
  const quietoDesde = a && a.estado === 'quieto' && a.confianza >= 1 ? a.en : null;
  const pasosRecientes = s.pasoEn != null && ahoraMs - s.pasoEn <= SIN_PASOS_MS;
  if (aPie && pasosRecientes && (quietoDesde == null || s.pasoEn > quietoDesde)) return { v: 'mueve', desde: s.pasoEn };
  if (quietoDesde != null && ahoraMs - quietoDesde >= QUIETO_MS) return { v: 'quieto', desde: quietoDesde };
  const aPaso = a && aPie && (a.estado === 'caminando' || a.estado === 'corriendo');
  if (aPie && s.hayPasos) {
    const ultimo = s.pasoEn ?? s.desde;
    // Si el sensor dice que empezaste a caminar DESPUÉS de los últimos pasos, el podómetro va atrasado (o no cuenta): manda el sensor.
    if (ahoraMs - ultimo > SIN_PASOS_MS && !(aPaso && a.en > ultimo)) return { v: 'quieto', desde: ultimo };
  }
  if (aPaso) return { v: 'mueve', desde: a.en };
  if (a && deporte === 'bici' && a.estado === 'bici') return { v: 'mueve', desde: a.en };
  return null;
}
