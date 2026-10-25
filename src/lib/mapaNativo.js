/* LO PURO DEL MAPA NATIVO DE APPLE (25 oct 2026). Aquí no hay plugin ni pantalla: solo las cuentas y las decisiones, para poder probarlas con datos falsos
   (`scripts/prueba-mapa-nativo.mjs`). Lo que sí toca el teléfono vive en `features/libre/MapaNativo.jsx`.

   El mapa nativo SOLO existe dentro de la app de iPhone. En la web y si algo falla se queda el mapa de siempre (MapLibre), porque Andrés quiere la app nativa
   pero la web no puede quedarse sin mapa. */

import { Capacitor } from '@capacitor/core';

export const COLOR_RUTA = '#FF5A5F';
export const GROSOR_RUTA = 5;
export const ZOOM_INICIAL = 16;
/** Al seguir al corredor el mapa se acerca más y se inclina en 3D (como Aura); en el resumen se ve plano y encuadrado. */
export const ZOOM_SIGUE = 17.5;
export const ANGULO_3D = 45;
/** Sin ninguna ubicación conocida: todo México, no una calle al azar del Zócalo. */
export const CENTRO_SIN_DATOS = { lat: 23.6, lng: -102.5 };
export const ZOOM_SIN_DATOS = 5;
/** Si el mapa nativo no avisa que está listo en este tiempo, se usa el de siempre. */
export const ESPERA_MAXIMA_MS = 4000;
/** La ruta se vuelve a mandar al mapa como mucho una vez por segundo. */
export const INTERVALO_RUTA_MS = 1000;
/** Una carrera larga junta miles de puntos; al mapa le basta con unos cientos para dibujar la misma línea. */
export const MAX_PUNTOS_RUTA = 700;
/** Lo más pequeño que puede ser el encuadre del resumen (en grados, ≈ 650 m): una salida corta no se acerca hasta ver un solo edificio. */
export const MINIMO_ENCUADRE_GRADOS = 0.006;

/** ¿Estamos dentro de la app de iPhone? (el mapa de Apple solo existe ahí) */
export const usaMapaNativo = () => {
  try { return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'ios'; } catch { return false; }
};

const esNumero = (n) => typeof n === 'number' && Number.isFinite(n);

/** Las muestras de la carrera (`{lat, lon}`, ver `lib/ubicacion.js`) como puntos del mapa (`{lat, lng}`). Lo que no sea una coordenada válida se descarta. */
export const puntosDeMuestras = (muestras) => (muestras ?? [])
  .filter((m) => m && esNumero(m.lat) && esNumero(m.lon) && Math.abs(m.lat) <= 90 && Math.abs(m.lon) <= 180)
  .map((m) => ({ lat: m.lat, lng: m.lon }));

/** Deja a lo mucho `max` puntos repartidos parejo, siempre con el primero y el último (el final de la ruta no se pierde). */
export function adelgazaRuta(puntos, max = MAX_PUNTOS_RUTA) {
  if (puntos.length <= max || max < 3) return puntos;
  const salida = [];
  const paso = (puntos.length - 1) / (max - 1);
  for (let i = 0; i < max - 1; i += 1) salida.push(puntos[Math.round(i * paso)]);
  salida.push(puntos[puntos.length - 1]);
  return salida;
}

/** La última ubicación guardada (`useUbicacionActual` la deja en localStorage) como `{lat, lng}`, o null. Recibe el texto tal cual. */
export function ubicacionGuardada(texto) {
  try {
    const g = JSON.parse(texto ?? 'null');
    return g && esNumero(g.lat) && esNumero(g.lon) ? { lat: g.lat, lng: g.lon } : null;
  } catch { return null; }
}

/** Dónde abre el mapa: la última muestra de la ruta, si no la última ubicación conocida, y solo si no hay nada, todo México (con `conocido: false`). */
export function inicioDelMapa(puntos, guardada, zoom = ZOOM_INICIAL) {
  const centro = puntos.at(-1) ?? guardada ?? null;
  if (centro) return { centro, zoom, conocido: true };
  return { centro: CENTRO_SIN_DATOS, zoom: ZOOM_SIN_DATOS, conocido: false };
}

/** Cómo encuadrar la ruta entera (resumen): un punto → centrar; varios → la caja que los contiene, nunca más chica que `minimo` grados. */
export function encuadre(puntos, minimo = MINIMO_ENCUADRE_GRADOS) {
  if (!puntos.length) return null;
  let sur = Infinity; let norte = -Infinity; let oeste = Infinity; let este = -Infinity;
  for (const p of puntos) {
    if (p.lat < sur) sur = p.lat;
    if (p.lat > norte) norte = p.lat;
    if (p.lng < oeste) oeste = p.lng;
    if (p.lng > este) este = p.lng;
  }
  const centro = { lat: (sur + norte) / 2, lng: (oeste + este) / 2 };
  if (puntos.length === 1) return { tipo: 'punto', centro };
  const mitadLat = Math.max((norte - sur) / 2, minimo / 2);
  const mitadLng = Math.max((este - oeste) / 2, minimo / 2);
  return {
    tipo: 'caja', centro,
    southwest: { lat: centro.lat - mitadLat, lng: centro.lng - mitadLng },
    northeast: { lat: centro.lat + mitadLat, lng: centro.lng + mitadLng },
  };
}

/** Mueve el centro del mapa hacia el sur para que el corredor quede en la parte que NO tapa el panel de abajo.
    `gradosVisibles` = cuántos grados de latitud muestra la pantalla de arriba a abajo; `alturaPt` = su alto en puntos; `reservaPt` = lo que tapa el panel.
    El corredor debe verse en medio de lo que queda libre: eso es `reserva / 2` por encima del centro del mapa. */
export function centroConReserva(centro, { gradosVisibles, alturaPt, reservaPt }) {
  if (!centro || !esNumero(gradosVisibles) || !esNumero(alturaPt) || !esNumero(reservaPt)) return centro;
  if (gradosVisibles <= 0 || alturaPt <= 0 || reservaPt <= 0) return centro;
  const reserva = Math.min(reservaPt, alturaPt * 0.8); // nunca más del 80 %: un panel enorme no manda al corredor fuera del mapa
  return { lat: centro.lat - (reserva / 2) * (gradosVisibles / alturaPt), lng: centro.lng };
}

/** ¿Hay que mandar la ruta al mapa ahora, esperar o nada? `clave` resume lo que se dibuja (cuántos puntos, el último y si sigue al corredor): si no cambió, no hay nada que mandar. */
export function planDeEnvio({ ahora, ultimoEnvioMs, claveActual, claveEnviada, intervaloMs = INTERVALO_RUTA_MS }) {
  if (claveActual === claveEnviada) return { accion: 'nada', esperaMs: 0 };
  const falta = (ultimoEnvioMs ?? 0) + intervaloMs - ahora;
  return falta <= 0 ? { accion: 'ahora', esperaMs: 0 } : { accion: 'esperar', esperaMs: falta };
}

export const claveDeRuta = (puntos, sigue) => {
  const u = puntos.at(-1);
  return `${puntos.length}|${u ? `${u.lat},${u.lng}` : '-'}|${sigue ? 1 : 0}`;
};

/** Una promesa con tiempo límite: si no responde a tiempo, falla con `mensaje`. La original sigue su camino (quien la creó decide qué hacer con lo que llegue tarde). */
export function conTiempoLimite(promesa, ms, mensaje = 'tiempo agotado') {
  let reloj;
  const limite = new Promise((_, rechaza) => { reloj = setTimeout(() => rechaza(new Error(mensaje)), ms); });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(reloj));
}

/** Pone en fila las operaciones del mapa nativo (crear y destruir) para que nunca haya dos a la vez: React, en desarrollo, monta y desmonta rápido. Una que falle no detiene la fila. */
export function creaFila() {
  let cola = Promise.resolve();
  return (tarea) => {
    const mia = cola.then(() => tarea());
    cola = mia.catch(() => {});
    return mia;
  };
}
