/* ENTRENO LIBRE: correr, bici, nadar o caminar SIN tener un plan (12 oct 2026).

   Mucha gente entra a la app solo para sacar su «activity card» para Instagram. Para ellos no hay plan: eligen un deporte, corre un CRONÓMETRO ABIERTO (como un workout de plan), al
   terminar dicen la distancia (si quieren) y sale el resumen con el botón de la tarjeta. Lo que queda es una fila de `actividades` con origen `manual`: el coach la ve en Métricas
   igual que un entreno del reloj, y la tarjeta se arma con lo que ya sabe armar (`sellosDeActividad`). Sin GPS ni pulso: eso es de la app instalable y del reloj.

   Este archivo es lo PURO (sin red ni pantalla): qué deportes salen, el cronómetro (con pausas), cómo se entiende lo que escribe la persona y cómo se arma el entreno para guardarlo.
   Se prueba con `scripts/prueba-entreno-libre.mjs`. */

import { DEPORTES, esDeporte } from './metricas/deportes.js';

/** Los deportes que salen primero en la hoja «Entrenar» (en este orden) y los que van en «Más deportes». Todos son ids de `DEPORTES`. */
export const DEPORTES_RAPIDOS = ['correr', 'bici', 'natacion', 'caminar'];
export const DEPORTES_EXTRA = ['senderismo', 'remo', 'eliptica', 'otro'];
export const esDeporteLibre = (d) => DEPORTES_RAPIDOS.includes(d) || DEPORTES_EXTRA.includes(d);

/** Cómo se dice la distancia de cada deporte: la natación en metros, lo demás en kilómetros. `null` = ese deporte no lleva distancia. */
export function unidadDeDistancia(deporte) {
  if (!DEPORTES[deporte]?.distancia) return null;
  return deporte === 'natacion' ? 'm' : 'km';
}

/** Lo que escribió la persona («5», «5.2», «5,2 km», «800») → metros, o `null` si no puso nada que valga. Tope: 1,000 km (por si se le va un cero de más). */
export function distanciaEnMetros(texto, deporte) {
  const unidad = unidadDeDistancia(deporte);
  if (!unidad) return null;
  const limpio = String(texto ?? '').trim().replace(',', '.').match(/^\d+(\.\d+)?/);
  if (!limpio) return null;
  const n = Number(limpio[0]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const metros = unidad === 'km' ? n * 1000 : n;
  return metros > 1_000_000 ? null : Math.round(metros);
}

/* ------------------------------ El cronómetro ------------------------------
   Se guarda como un objeto simple (para que sobreviva a recargar la página): { deporte, inicio, pausadoEn, pausas }.
   `inicio` y `pausadoEn` en milisegundos; `pausas` = milisegundos que estuvo en pausa. Con la pantalla bloqueada el reloj del teléfono sigue: se cuenta con fechas, no con «ticks». */

export const cronometroNuevo = (deporte, ahora = Date.now()) => ({ deporte, inicio: ahora, pausadoEn: null, pausas: 0 });
export const estaPausado = (c) => c?.pausadoEn != null;
/** Pausa. `automatica`: la puso la app porque te detuviste (se ve «Pausa automática» y se quita sola al volver a moverte). */
export const pausa = (c, ahora = Date.now(), { automatica = false } = {}) => (estaPausado(c) ? c : { ...c, pausadoEn: ahora, ...(automatica ? { automatica: true } : {}) });
export const reanuda = (c, ahora = Date.now()) => {
  if (!estaPausado(c)) return c;
  const { automatica: _a, ...resto } = c;
  return { ...resto, pausadoEn: null, pausas: c.pausas + Math.max(0, ahora - c.pausadoEn) };
};

/* PAUSA AUTOMÁTICA (27 oct 2026, como Strava). Con GPS, la carrera libre se pausa sola cuando te detienes y se reanuda sola al volver a moverte.
   Cuenta la VELOCIDAD que da el GPS del teléfono, solo de lecturas buenas (error ≤ 20 m). Para pausar hay que ir lento N segundos SEGUIDOS; para reanudar,
   rápido M segundos seguidos: así un paso lento o una lectura rara no la disparan. Sin lecturas en los últimos 5 s no decide nada: perder la señal (un
   túnel, un puente) NO es estar parado. */
export const UMBRALES_DE_PAUSA = {
  correr: { pausa: 0.6, reanuda: 1.0 },
  caminar: { pausa: 0.6, reanuda: 1.0 },
  senderismo: { pausa: 0.6, reanuda: 1.0 },
  bici: { pausa: 1.0, reanuda: 2.0 },
};
const SEGUNDOS_PARA_PAUSAR = 3;
const SEGUNDOS_PARA_REANUDAR = 2;
const SIN_SENAL_S = 5;
const HUECO_MAXIMO_S = 2;

/**
 * ¿Hay que pausar o reanudar? `lecturas`: las últimas del GPS, `{ t, vel, pre }` (t en segundos de reloj). `estado`: 'corriendo' o 'pausa' (una pausa
 * AUTOMÁTICA: la manual no se reanuda sola). Devuelve `{ accion: 'pausa' | 'reanuda', desde }` (desde: el segundo en que empezó a ir lento o rápido) o `null`.
 */
export function decidePausaAutomatica(lecturas, estado, deporte, ahoraS = Date.now() / 1000) {
  const u = UMBRALES_DE_PAUSA[deporte];
  if (!u) return null;
  const buenas = (lecturas ?? []).filter((x) => typeof x?.vel === 'number' && typeof x.pre === 'number' && x.pre <= 20 && typeof x.t === 'number');
  const ultima = buenas.at(-1);
  if (!ultima || ahoraS - ultima.t > SIN_SENAL_S) return null;
  const pausando = estado === 'corriendo';
  const cumple = pausando ? (x) => x.vel < u.pausa : (x) => x.vel > u.reanuda;
  const necesita = pausando ? SEGUNDOS_PARA_PAUSAR : SEGUNDOS_PARA_REANUDAR;
  // De la última hacia atrás, mientras cumpla y sin huecos de señal: ¿cuánto tiempo seguido lleva así?
  let desde = null;
  for (let i = buenas.length - 1; i >= 0; i -= 1) {
    const x = buenas[i];
    if (!cumple(x)) break;
    if (desde !== null && desde - x.t > HUECO_MAXIMO_S) break;
    desde = x.t;
  }
  if (desde === null || ultima.t - desde < necesita) return null;
  return { accion: pausando ? 'pausa' : 'reanuda', desde };
}

/** Segundos que lleva corriendo (sin contar las pausas). */
export function segundosDe(c, ahora = Date.now()) {
  if (!c) return 0;
  const hasta = estaPausado(c) ? c.pausadoEn : ahora;
  return Math.max(0, Math.floor((hasta - c.inicio - c.pausas) / 1000));
}

/** «12:05», «1:02:09»: el tiempo grande del cronómetro. */
export function relojDeCronometro(segundos) {
  const s = Math.max(0, Math.floor(Number(segundos) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const dos = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dos(m)}:${dos(s % 60)}` : `${dos(m)}:${dos(s % 60)}`;
}

/** ¿Un cronómetro guardado todavía sirve? Uno de hace más de 24 horas se da por olvidado (alguien lo dejó corriendo y se fue). */
// Cualquier deporte de las métricas vale: desde el 23 oct 2026 se registra cualquier actividad (pádel = «raqueta», una propia = «otro»; ver `lib/actividades.js`).
export const cronometroVigente = (c, ahora = Date.now()) => !!c && Number.isFinite(c.inicio) && esDeporte(c.deporte) && ahora - c.inicio < 24 * 3600 * 1000;

/** Un entreno de menos de 30 segundos no vale la pena guardarlo (se tocó «Terminar» sin querer). */
export const MINIMO_DE_SEGUNDOS = 30;

/**
 * El entreno listo para `construyeActividad` (ver `lib/metricas/construye.js`): lo que midió la app sola, que es el tiempo y la distancia que la persona dijo.
 * `inicioMs`: cuándo arrancó. `duracionS`: tiempo sin pausas. El pulso y las calorías NO se inventan: sin reloj no hay.
 * `titulo`: el nombre de la actividad que eligió («Pádel», «Waterpolo»); sin él, el del deporte. `llevaDistancia`: la actividad se mueve de un lugar a otro (una propia
 * con mapa, como unos patines, aunque su deporte de métricas sea «otro»); sin él, lo dice el deporte.
 */
export function entrenoLibre({ deporte, inicioMs, duracionS, distanciaM = null, titulo = null, llevaDistancia = null }) {
  const d = esDeporte(deporte) ? deporte : 'otro';
  const duracion = Math.max(1, Math.round(duracionS));
  const conDistancia = (llevaDistancia ?? !!DEPORTES[d]?.distancia) && distanciaM > 0;
  return {
    inicio: inicioMs,
    fin: inicioMs + duracion * 1000,
    deporte: d,
    duracion_s: duracion,
    movimiento_s: conDistancia ? duracion : null,
    distancia_m: conDistancia ? Math.round(distanciaM) : null,
    titulo: String(titulo ?? '').trim().slice(0, 40) || DEPORTES[d].nombre,
    formato: 'app',
    dispositivo: null,
  };
}
