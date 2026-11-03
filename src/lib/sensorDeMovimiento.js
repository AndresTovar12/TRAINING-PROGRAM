/* EL SENSOR DE MOVIMIENTO DEL IPHONE, LO PURO (2 nov 2026; desde el 3 nov, el REBOTE).

   El puente nativo es `MovimientoPlugin.swift` y lo enciende `lib/movimientoNativo.js`; aquí solo se junta lo que llega y se sacan las SEÑALES (`senales`).
   Quién decide con ellas es `decideMarcha` (`lib/entrenoLibre.js`), que las junta con el GPS.

   EL REBOTE (3 nov 2026, `docs/superpowers/specs/2026-11-03-pausa-automatica-rebote.md`). A pie el cuerpo rebota con cada paso y parado no: eso se lee en un
   segundo. Cada segundo el iPhone manda un aviso `rebote` con la desviación estándar de la magnitud de `userAcceleration` (g, sin la gravedad) de ese segundo.
     · `rebota`: el último aviso llegó hace menos de 2 s y su valor es ≥ `REBOTE_MINIMO`.
     · `sinRebote(s, ahora)`: cuántos segundos seguidos llevan los avisos por debajo del mínimo (cada aviso cuenta el segundo de antes de su hora).
   `REBOTE_MINIMO` (0.12 g) es un punto de partida, no un hecho: se ajusta con las trazas reales (`scripts/prueba-ruta.mjs` dice el rebote parado y en marcha).
   Antes (2-3 nov) decidían el podómetro y la actividad (quieto, caminando, corriendo); el podómetro avisa cuando quiere y daba pausas en falso. Hoy de ellos
   solo queda «en bici» (no pausar sobre ruedas mientras lo diga); los pasos y la cadencia se siguen anotando en la traza. Se prueba con `scripts/prueba-ruta.mjs`. */

/** El rebote mínimo (g) de alguien que camina o corre. Un solo lugar: se ajusta con las trazas reales. */
export const REBOTE_MINIMO = 0.12;
/** Un aviso de rebote vale este tiempo (ms): más viejo, ya no dice nada. */
const REBOTE_VIGENTE_MS = 2000;
/** Sin avisos de rebote este tiempo (ms), el acelerómetro no está midiendo: como si no hubiera (mandan las reglas del GPS). */
const REBOTE_VIVO_MS = 2500;
/** Cuánto (ms) se recuerdan los avisos de rebote. */
const RECUERDA_MS = 15000;

/** Lo que se sabe al encender el sensor. `hayActividad`/`hayPasos`/`hayRebote`: si el iPhone los tiene; `permiso`: 'si' | 'negado' | 'restringido' | 'sin_preguntar'. */
export const sensorNuevo = (ahoraMs, { hayActividad = false, hayPasos = false, hayRebote = false, permiso = null } = {}) => ({
  desde: ahoraMs, hayActividad, hayPasos, hayRebote, permiso, vivo: permiso === 'si', actividad: null, pasos: 0, rebotes: [],
});

/** Contestó `inicia`: qué tiene este iPhone y si hay permiso. */
export const conInicio = (s, r) => ({
  ...s, hayActividad: !!r?.actividad, hayPasos: !!r?.pasos, hayRebote: !!r?.hayRebote, permiso: r?.permiso ?? s.permiso, vivo: s.vivo || r?.permiso === 'si',
});

/** Contestó la pregunta del permiso. Negado: la actividad no cuenta (el rebote no pide permiso: sigue). */
export function conPermiso(s, { permiso }) {
  if (permiso === 'si') return { ...s, permiso, vivo: true };
  if (permiso === 'negado' || permiso === 'restringido') return { ...s, permiso, vivo: false };
  return { ...s, permiso };
}

/** El podómetro falló (sin permiso, o el iPhone no pudo). */
export const sinPasos = (s) => ({ ...s, hayPasos: false });

/** Un cambio de actividad: `{ estado, confianza (0 baja, 1 media, 2 alta), en (ms: desde cuándo está así) }`. Si sigue igual, se queda el «desde» de antes. */
export function conActividad(s, { estado, confianza, en }, ahoraMs) {
  const igual = s.actividad?.estado === estado;
  const desde = Number.isFinite(Number(en)) && Number(en) > 0 ? Math.min(Number(en), ahoraMs) : ahoraMs;
  return { ...s, vivo: !(s.permiso === 'negado' || s.permiso === 'restringido'), actividad: { estado, confianza: Number(confianza) || 0, en: igual ? s.actividad.en : desde } };
}

/** Un aviso del podómetro `{ pasos, en, cadencia?, ritmo? }`: ya no decide nada (3 nov 2026); se cuentan los pasos y el aviso va completo a la traza. */
export const conPasos = (s, { pasos }) => ({ ...s, pasos: Math.max(Number(pasos) || 0, s.pasos) });

/** Un aviso de rebote `{ en (ms), valor (g) }`. */
export function conRebote(s, { en, valor }, ahoraMs) {
  const hora = Number.isFinite(Number(en)) && Number(en) > 0 ? Math.min(Number(en), ahoraMs) : ahoraMs;
  const v = Number(valor);
  if (!Number.isFinite(v) || v < 0) return s;
  return { ...s, hayRebote: true, rebotes: [...s.rebotes.filter((x) => hora - x.en <= RECUERDA_MS), { en: hora, valor: v }] };
}

/** La racha de avisos del mismo lado del mínimo que el último: desde cuándo (ms; cada aviso cuenta el segundo de antes de su hora) y de qué lado. */
function rachaDeRebote(s, ahoraMs) {
  const ultimo = s?.rebotes?.at(-1);
  if (!ultimo || ahoraMs - ultimo.en > REBOTE_VIVO_MS) return null;
  const arriba = ultimo.valor >= REBOTE_MINIMO;
  let desde = ultimo.en;
  for (let i = s.rebotes.length - 1; i >= 0; i -= 1) {
    const x = s.rebotes[i];
    if ((x.valor >= REBOTE_MINIMO) !== arriba || desde - x.en > REBOTE_VIVO_MS) break;
    desde = x.en;
  }
  return { arriba, desde: desde - 1000, fresco: ahoraMs - ultimo.en < REBOTE_VIGENTE_MS };
}

/** Cuántos segundos seguidos llevan los avisos por debajo de `REBOTE_MINIMO` (0 si el último rebota; `null` si el acelerómetro no está midiendo). */
export function sinRebote(s, ahoraMs) {
  const r = rachaDeRebote(s, ahoraMs);
  if (!r) return null;
  return r.arriba ? 0 : (ahoraMs - r.desde) / 1000;
}

/**
 * Las señales del sensor ahora (ms), o `null` si no hay nada que sirva:
 *   `reboteVivo`: el acelerómetro está midiendo · `rebota`: el último aviso rebota y es reciente · `reboteDesde` (ms): desde cuándo rebota sin parar ·
 *   `sinReboteDesde` (ms): desde cuándo no rebota · `enBici`: el sensor de actividad dice «en bici».
 */
export function senales(s, ahoraMs) {
  if (!s) return null;
  const r = rachaDeRebote(s, ahoraMs);
  const enBici = !!s.vivo && s.actividad?.estado === 'bici' && s.actividad.confianza >= 1;
  if (!r && !s.vivo) return null;
  return {
    reboteVivo: !!r,
    rebota: !!r && r.arriba && r.fresco,
    reboteDesde: r?.arriba ? r.desde : null,
    sinReboteDesde: r && !r.arriba ? r.desde : null,
    enBici,
  };
}
