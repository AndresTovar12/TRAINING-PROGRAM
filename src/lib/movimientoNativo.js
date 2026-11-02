/* EL SENSOR DE MOVIMIENTO DEL IPHONE, EL PUENTE (2 nov 2026). Solo en la app de iPhone; en la web no hace nada y la carrera sigue con las reglas del GPS.

   `MovimientoPlugin.swift` enciende `CMMotionActivityManager` (quieto, caminando, corriendo, en bici) y `CMPedometer` (los pasos) y avisa cada cambio. Aquí se
   junta todo en un objeto (`lib/sensorDeMovimiento.js`), y `useCronometroLibre` lo lee con cada punto del GPS. La primera vez, iOS pregunta el permiso de
   movimiento («Para saber cuándo te detienes y no sumar metros de más», `NSMotionUsageDescription`): pasa en la primera carrera, al encender el sensor.
   Si el plugin no contesta en 3 s o falla (un build viejo, sin permiso), nunca llega nada y mandan las reglas del GPS. Ninguna promesa se resuelve con el plugin
   (ver la trampa de `.then` en `lib/tiempoLimite.js`): solo con lo que contesta. */

import { Capacitor, registerPlugin } from '@capacitor/core';
import { conTiempoLimite } from './tiempoLimite.js';
import { conActividad, conInicio, conPasos, conPermiso, sensorNuevo, sinPasos } from './sensorDeMovimiento.js';

const Movimiento = registerPlugin('Movimiento');
const TOPE_MS = 3000;

/** Enciende el sensor y llama `alCambio(sensor)` con cada novedad. Devuelve cómo apagarlo. */
export function sigueMovimiento(alCambio) {
  if (!Capacitor.isNativePlatform()) return () => {};
  let vivo = true;
  let s = sensorNuevo(Date.now());
  const manejadores = [];
  const cambia = (f) => { if (!vivo) return; s = f(s); alCambio(s); };
  const escucha = (evento, f) => {
    Movimiento.addListener(evento, (e) => cambia((x) => f(x, e ?? {}, Date.now())))
      .then((h) => { if (vivo) manejadores.push(h); else h?.remove?.(); })
      .catch(() => {});
  };
  escucha('movimiento', conActividad);
  escucha('pasos', conPasos);
  escucha('permiso', conPermiso);
  escucha('falla', (x, e) => (e?.cual === 'pasos' ? sinPasos(x) : x));
  conTiempoLimite(Movimiento.inicia(), TOPE_MS, 'el sensor no contestó')
    .then((r) => cambia((x) => conInicio(x, r)))
    .catch(() => {});
  return () => {
    vivo = false;
    manejadores.forEach((h) => h?.remove?.());
    conTiempoLimite(Movimiento.detiene(), TOPE_MS).catch(() => {});
  };
}
