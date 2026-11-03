/* EL SENSOR DE MOVIMIENTO DEL IPHONE, EL PUENTE (2 nov 2026). Solo en la app de iPhone; en la web no hace nada y la carrera sigue con las reglas del GPS.

   `MovimientoPlugin.swift` enciende `CMMotionActivityManager` (quieto, caminando, corriendo, en bici) y `CMPedometer` (los pasos, la cadencia y el ritmo) y
   avisa cada cambio; desde el 3 nov 2026 también el REBOTE (`CMMotionManager`, un aviso `rebote` por segundo), que no pide permiso. Aquí se
   junta todo en un objeto (`lib/sensorDeMovimiento.js`), y `useCronometroLibre` lo lee con cada punto del GPS. La primera vez, iOS pregunta el permiso de
   movimiento («Para saber cuándo te detienes y no sumar metros de más», `NSMotionUsageDescription`): pasa en la primera carrera, al encender el sensor.
   Si el plugin no contesta en 3 s o falla (un build viejo, sin permiso), nunca llega nada y mandan las reglas del GPS. Ninguna promesa se resuelve con el plugin
   (ver la trampa de `.then` en `lib/tiempoLimite.js`): solo con lo que contesta. */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { conTiempoLimite } from './tiempoLimite.js';
import { conActividad, conInicio, conPasos, conPermiso, conRebote, sensorNuevo, sinPasos } from './sensorDeMovimiento.js';

const Movimiento = registerPlugin('Movimiento');
const TOPE_MS = 3000;

/**
 * Enciende el sensor y llama `alCambio(sensor, aviso)` con cada novedad (`aviso`: `{ tipo, datos }` tal como llegó, para la traza del GPS). Devuelve cómo
 * apagarlo.
 */
export function sigueMovimiento(alCambio) {
  if (!Capacitor.isNativePlatform()) return () => {};
  let vivo = true;
  let s = sensorNuevo(Date.now());
  const manejadores = [];
  const cambia = (tipo, datos, f) => { if (!vivo) return; s = f(s); alCambio(s, { tipo, datos }); };
  const escucha = (evento, f) => {
    Movimiento.addListener(evento, (e) => cambia(evento, e ?? {}, (x) => f(x, e ?? {}, Date.now())))
      .then((h) => { if (vivo) manejadores.push(h); else h?.remove?.(); })
      .catch(() => {});
  };
  alCambio(s, { tipo: 'enciende', datos: {} });
  escucha('movimiento', conActividad);
  escucha('pasos', conPasos);
  escucha('rebote', conRebote);
  escucha('permiso', conPermiso);
  escucha('falla', (x, e) => (e?.cual === 'pasos' ? sinPasos(x) : x));
  conTiempoLimite(Movimiento.inicia(), TOPE_MS, 'el sensor no contestó')
    .then((r) => cambia('inicio', { actividad: !!r?.actividad, pasos: !!r?.pasos, hayRebote: !!r?.hayRebote, permiso: r?.permiso ?? null }, (x) => conInicio(x, r)))
    .catch(() => {});
  return () => {
    if (vivo) alCambio(null, { tipo: 'apaga', datos: {} });
    vivo = false;
    manejadores.forEach((h) => h?.remove?.());
    conTiempoLimite(Movimiento.detiene(), TOPE_MS).catch(() => {});
  };
}
