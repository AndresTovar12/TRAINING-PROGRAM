/* EL SENSOR DE MOVIMIENTO DEL IPHONE, LO PURO (2 nov 2026, bug «parado en la calle sumó 50 m en 87 s con ritmo 18:13 /km y la pausa automática nunca entró»).

   Entre edificios (mala geometría) el iPhone daba ~0.9 m/s estando quieto, y la posición brincaba con esa velocidad: el GPS solo no distingue eso de caminar.
   El sensor de movimiento sí: `CMMotionActivityManager` (quieto, caminando, corriendo, en bici) y `CMPedometer` (los pasos y la cadencia). El puente nativo es
   `MovimientoPlugin.swift` y lo enciende `lib/movimientoNativo.js`; aquí solo se junta lo que llega y se sacan las SEÑALES (`senales`). Quién decide con ellas
   es `decideMarcha` (`lib/entrenoLibre.js`), que las junta con el GPS.

   NINGÚN SENSOR SOLO DECIDE (3 nov 2026, bug de la versión anterior: se pausaba al girar el teléfono para ver la hora, porque el podómetro deja de contar unos
   segundos, y al detenerse tardaba hasta 20 s, porque un paso fantasma reiniciaba la cuenta). Por eso aquí ya no hay veredicto, solo señales:
     · CADENCIA, no «hay pasos». «En marcha» a pie = cadencia ≥ 1.2 pasos/s. La cadencia es `currentCadence` del iPhone; si no viene (nil, pasa al arrancar o
       con pocos pasos), los pasos contados entre dos avisos entre el tiempo entre ellos. Un aviso con 1 o 2 pasos sueltos (a menos de 1 paso/s) no cuenta:
       ni es moverse ni corta la cuenta de «cadencia baja».
     · CADENCIA BAJA desde: el último aviso con cadencia ≥ 0.5 (de ahí cuenta «3 s con cadencia baja»).
     · El sensor de actividad: «quieto» 3 s seguidos con confianza media o alta; «caminando/corriendo» con confianza ALTA; «en bici».
   `currentPace` (segundos por metro) llega y se guarda en la traza, pero no decide: sale de los mismos pasos que la cadencia. Se prueba con `scripts/prueba-ruta.mjs`. */

/** El sensor tiene que decir «quieto» este tiempo seguido (ms) para que cuente. */
export const QUIETO_MS = 3000;
/** Cadencia (pasos/s) de alguien que camina o corre. */
export const CADENCIA_EN_MARCHA = 1.2;
/** Por debajo de esta cadencia (pasos/s) no se está andando. */
export const CADENCIA_BAJA = 0.5;
/** Un aviso del podómetro vale este tiempo (ms): si no llega otro, ya no hay pasos. */
const AVISO_VIGENTE_MS = 3000;
/** Pasos sueltos: un aviso con estos pasos o menos, a menos de 1 paso/s. */
const PASOS_SUELTOS = 2;
/** Cuánto (ms) se recuerdan los avisos del podómetro. */
const RECUERDA_MS = 15000;
const A_PIE = ['correr', 'caminar', 'senderismo'];

/** Lo que se sabe al encender el sensor. `hayActividad`/`hayPasos`: si el iPhone los tiene; `permiso`: 'si' | 'negado' | 'restringido' | 'sin_preguntar'. */
export const sensorNuevo = (ahoraMs, { hayActividad = false, hayPasos = false, permiso = null } = {}) => ({
  desde: ahoraMs, hayActividad, hayPasos, permiso, vivo: permiso === 'si', actividad: null, pasos: 0, avisos: [], realEn: null,
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

/** El podómetro falló (sin permiso, o el iPhone no pudo): sus pasos ya no cuentan. */
export const sinPasos = (s) => ({ ...s, hayPasos: false });

/** Un cambio de actividad: `{ estado, confianza (0 baja, 1 media, 2 alta), en (ms: desde cuándo está así) }`. Si sigue igual, se queda el «desde» de antes. */
export function conActividad(s, { estado, confianza, en }, ahoraMs) {
  const igual = s.actividad?.estado === estado;
  const desde = Number.isFinite(Number(en)) && Number(en) > 0 ? Math.min(Number(en), ahoraMs) : ahoraMs;
  return { ...s, vivo: !(s.permiso === 'negado' || s.permiso === 'restringido'), actividad: { estado, confianza: Number(confianza) || 0, en: igual ? s.actividad.en : desde } };
}

/**
 * Un aviso del podómetro: `{ pasos (desde que se encendió), en (ms), cadencia? (pasos/s), ritmo? (s/m) }`. Se anota con su cadencia (la del iPhone o, si no
 * vino, la de los pasos contados) y si eran pasos sueltos.
 */
export function conPasos(s, { pasos, en, cadencia }, ahoraMs) {
  const n = Number(pasos) || 0;
  const hora = Number.isFinite(Number(en)) && Number(en) > 0 ? Math.min(Number(en), ahoraMs) : ahoraMs;
  const anterior = s.avisos.at(-1);
  const nuevos = Math.max(0, n - s.pasos);
  const segundos = Math.max(0.5, (hora - (anterior?.en ?? s.desde)) / 1000);
  const suelto = nuevos <= PASOS_SUELTOS && nuevos / segundos < 1;
  const cad = typeof cadencia === 'number' && cadencia >= 0 ? cadencia : nuevos / segundos;
  const aviso = { en: hora, nuevos, cad: suelto ? 0 : cad };
  return {
    ...s, vivo: !(s.permiso === 'negado' || s.permiso === 'restringido'), pasos: Math.max(n, s.pasos),
    avisos: [...s.avisos.filter((a) => hora - a.en <= RECUERDA_MS), aviso],
    realEn: aviso.cad >= CADENCIA_BAJA ? hora : s.realEn,
  };
}

/**
 * Las señales del sensor ahora (ms), o `null` si no sirve (sin permiso, la web). Todas con su «desde» en ms, `null` si no se cumplen:
 *   `quieto`: dice «quieto» 3 s seguidos (confianza media o alta) · `actividadEnMarcha`: «caminando/corriendo» con confianza alta (a pie) o «en bici» (bici)
 *   `cadenciaEnMarcha`: avisos seguidos con cadencia ≥ 1.2 (a pie) · `cadenciaBaja`: desde el último aviso con cadencia ≥ 0.5 (a pie, con podómetro)
 *   `enBici`: el sensor dice «en bici» ahora (bool).
 */
export function senales(s, deporte, ahoraMs) {
  if (!s?.vivo) return null;
  const a = s.actividad;
  const aPie = A_PIE.includes(deporte);
  const quieto = a && a.estado === 'quieto' && a.confianza >= 1 && ahoraMs - a.en >= QUIETO_MS ? a.en : null;
  let actividadEnMarcha = null;
  if (a && aPie && (a.estado === 'caminando' || a.estado === 'corriendo') && a.confianza >= 2) actividadEnMarcha = a.en;
  if (a && deporte === 'bici' && a.estado === 'bici' && a.confianza >= 1) actividadEnMarcha = a.en;
  let cadenciaEnMarcha = null;
  let cadenciaBaja = null;
  if (aPie && s.hayPasos) {
    const ultimo = s.avisos.at(-1);
    if (ultimo && ahoraMs - ultimo.en <= AVISO_VIGENTE_MS && ultimo.cad >= CADENCIA_EN_MARCHA) {
      cadenciaEnMarcha = ultimo.en;
      for (let i = s.avisos.length - 2; i >= 0; i -= 1) {
        const x = s.avisos[i];
        if (x.cad < CADENCIA_EN_MARCHA || cadenciaEnMarcha - x.en > AVISO_VIGENTE_MS) break;
        cadenciaEnMarcha = x.en;
      }
    }
    const ultimaReal = s.realEn ?? s.desde;
    if (!(ultimo && ultimo.cad >= CADENCIA_BAJA && ahoraMs - ultimo.en <= AVISO_VIGENTE_MS)) cadenciaBaja = ultimaReal;
  }
  return { quieto, actividadEnMarcha, cadenciaEnMarcha, cadenciaBaja, enBici: !!a && a.estado === 'bici', aPie };
}
