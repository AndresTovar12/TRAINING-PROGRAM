/* ENTRENO LIBRE: correr, bici, nadar o caminar SIN tener un plan (12 oct 2026).

   Mucha gente entra a la app solo para sacar sus stickers para Instagram. Para ellos no hay plan: eligen un deporte, corre un CRONÓMETRO ABIERTO (como un workout de plan), al
   terminar dicen la distancia (si quieren) y sale el resumen con el botón de la tarjeta. Lo que queda es una fila de `actividades` con origen `manual`: el coach la ve en Métricas
   igual que un entreno del reloj, y sus stickers se arman con la misma ficha (`lib/stickers/ficha.js`). Sin GPS ni pulso: eso es de la app instalable y del reloj.

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
const SEGUNDOS_PARA_PAUSAR = 2;
const SEGUNDOS_PARA_REANUDAR = 2;
const SIN_SENAL_S = 5;
const HUECO_MAXIMO_S = 2;
/* MALA GEOMETRÍA (bug del 2 nov 2026: entre edificios el iPhone daba ~0.9 m/s quieto y la pausa nunca entraba). Con más error que `ERROR_GRANDE` m, una lectura
   también cuenta como «lento» si en los últimos `VENTANA_S` s la carrera avanzó menos de `AVANCE_MINIMO` m (`d`: los metros que ya contó la ruta). Con más de 12 m
   de error, la velocidad no cuenta para reanudar: hace falta avanzar de verdad, segundo a segundo, a `VELOCIDAD_CON_ERROR` m/s o más (o el umbral de la bici). */
const ERROR_GRANDE = 15;
const ERROR_PARA_VELOCIDAD = 12;
const VENTANA_S = 5;
const AVANCE_MINIMO = 3;
const VELOCIDAD_CON_ERROR = 1.2;
const metros = (a, b) => {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
};

/* Lo que dice el GPS (puro), de las lecturas buenas (error ≤ 20 m): `lento(x)` y `rapido(x)` de una lectura y `racha(cumple)`, desde cuándo (s) las últimas
   lecturas cumplen sin huecos de señal (`null` si la última no cumple o ya no hay señal). */
function gpsDe(lecturas, u, ahoraS) {
  const buenas = (lecturas ?? []).filter((x) => typeof x?.vel === 'number' && typeof x.pre === 'number' && x.pre <= 20 && typeof x.t === 'number');
  const ultima = buenas.at(-1);
  const conSenal = !!ultima && ahoraS - ultima.t <= SIN_SENAL_S;
  // La lectura de hace `VENTANA_S` s (o más) antes de `x`: contra ella se mide cuánto avanzó.
  const antesDe = (x, conQue) => { for (let i = buenas.length - 1; i >= 0; i -= 1) if (x.t - buenas[i].t >= VENTANA_S && conQue(buenas[i])) return buenas[i]; return null; };
  const lento = (x) => {
    if (x.vel < u.pausa) return true;
    if (!(x.pre > ERROR_GRANDE) || typeof x.d !== 'number') return false;
    const y = antesDe(x, (z) => typeof z.d === 'number');
    return !!y && x.d - y.d < AVANCE_MINIMO;
  };
  // Con mucho error: la MEDIANA de los pasos de cada segundo en los últimos 5 s (un brinco de un solo segundo, cuando el GPS regresa, no la mueve).
  const rapido = (x) => {
    if (x.pre <= ERROR_PARA_VELOCIDAD) return x.vel >= u.reanuda;
    const ventana = buenas.filter((z) => typeof z.lat === 'number' && z.t <= x.t && x.t - z.t <= VENTANA_S);
    const pasos = ventana.slice(1).map((z, i) => metros(ventana[i], z) / Math.max(1, z.t - ventana[i].t)).sort((a, b) => a - b);
    return pasos.length >= VENTANA_S - 1 && pasos[Math.floor(pasos.length / 2)] >= Math.max(VELOCIDAD_CON_ERROR, u.reanuda);
  };
  // De la última hacia atrás, mientras cumpla y sin huecos de señal: ¿desde cuándo lleva así?
  const racha = (cumple) => {
    if (!conSenal) return null;
    let desde = null;
    for (let i = buenas.length - 1; i >= 0; i -= 1) {
      const x = buenas[i];
      if (!cumple(x)) break;
      if (desde !== null && desde - x.t > HUECO_MAXIMO_S) break;
      desde = x.t;
    }
    return desde;
  };
  return { ultima, conSenal, lento, rapido, racha };
}

/* EN MARCHA O QUIETO: EL SENSOR Y EL GPS JUNTOS (3 nov 2026). Bug de la versión del 2 nov: el podómetro mandaba solo, en las dos direcciones. «Sin pasos en 5 s»
   pausaba aunque el sensor dijera «corriendo» (al girar el teléfono para ver la hora deja de contar unos segundos), y un paso fantasma al detenerse reiniciaba
   la cuenta (hasta 20 s para pausar). Ahora ningún sensor solo decide; se juntan tres señales (`senales` de `lib/sensorDeMovimiento.js`) y el GPS:
     A PIE (correr, caminar, senderismo)
       · EN MARCHA si: cadencia ≥ 1.2 pasos/s, o el sensor dice «caminando/corriendo» con confianza alta Y el GPS avanza (velocidad ≥ umbral de reanudar).
         Ninguna es un veto eterno: la cadencia cae al detenerte y el GPS deja de avanzar.
       · QUIETO (si no va en marcha) si: el sensor dice «quieto» 3 s seguidos, o la cadencia lleva 3 s baja (< 0.5) Y el GPS no avanza (velocidad < umbral de
         pausa o, con mucho error, menos de 3 m en 5 s). El podómetro solo no pausa.
     EN BICI (no hay cadencia): en marcha si el GPS avanza y el sensor no dice «quieto» (con «en bici», desde que lo dijo); quieto si el sensor dice «quieto» 3 s,
       o el GPS va lento 2 s y el sensor no dice «en bici».
   Devuelve `{ v: 'mueve' | 'quieto' | 'espera', desde (s) }` (`espera`: ni lo uno ni lo otro todavía; no se pausa ni se reanuda) o `null` sin sensor (la web,
   sin permiso): entonces mandan las reglas del GPS solas. `desde`: con 'mueve', desde cuándo va en marcha sin parar (reanudar pide 2 s); con 'quieto', desde
   cuándo se detuvo. */
export function decideMarcha(senal, lecturas, deporte, ahoraS) {
  const u = UMBRALES_DE_PAUSA[deporte];
  if (!u || !senal) return null;
  const s = (ms) => (ms == null ? null : ms / 1000);
  const gps = gpsDe(lecturas, u, ahoraS);
  const avanza = gps.racha(gps.rapido);
  const lento = gps.racha(gps.lento);
  const quietoSensor = s(senal.quieto);
  if (senal.aPie) {
    const enMarcha = [s(senal.cadenciaEnMarcha), senal.actividadEnMarcha != null && avanza != null ? Math.max(s(senal.actividadEnMarcha), avanza) : null].filter((x) => x != null);
    if (enMarcha.length) return { v: 'mueve', desde: Math.min(...enMarcha) };
    const baja = s(senal.cadenciaBaja);
    const quieto = [quietoSensor, baja != null && ahoraS - baja >= 3 && lento != null ? Math.max(baja, lento) : null].filter((x) => x != null);
    if (quieto.length) return { v: 'quieto', desde: Math.min(...quieto) };
    return { v: 'espera', desde: null };
  }
  if (deporte === 'bici') {
    if (avanza != null && quietoSensor == null) return { v: 'mueve', desde: senal.actividadEnMarcha != null ? Math.max(s(senal.actividadEnMarcha), avanza) : avanza };
    if (quietoSensor != null) return { v: 'quieto', desde: quietoSensor };
    if (lento != null && ahoraS - lento >= SEGUNDOS_PARA_PAUSAR && !senal.enBici) return { v: 'quieto', desde: lento };
    return { v: 'espera', desde: null };
  }
  return null;
}

/**
 * ¿Hay que pausar o reanudar? `lecturas`: las últimas del GPS, `{ t, vel, pre, d?, lat?, lon? }` (t en segundos de reloj; `d`: metros que llevaba contados la
 * ruta). `estado`: 'corriendo' o 'pausa' (una pausa AUTOMÁTICA: la manual no se reanuda sola). Devuelve `{ accion: 'pausa' | 'reanuda', desde }` (desde: el segundo
 * en que empezó a ir lento o rápido) o `null`.
 * CON SENSOR (`marcha`, de `decideMarcha`): 'quieto' pausa (desde que se detuvo); 'mueve' reanuda cuando lleva 2 s en marcha; 'espera' no hace nada. Sin
 * sensor (`marcha` null), el GPS solo: lento 2 s seguidos pausa, rápido 2 s seguidos reanuda.
 */
export function decidePausaAutomatica(lecturas, estado, deporte, ahoraS = Date.now() / 1000, { marcha = null } = {}) {
  const u = UMBRALES_DE_PAUSA[deporte];
  if (!u) return null;
  const pausando = estado === 'corriendo';
  if (marcha) {
    if (pausando) return marcha.v === 'quieto' ? { accion: 'pausa', desde: marcha.desde } : null;
    return marcha.v === 'mueve' && ahoraS - marcha.desde >= SEGUNDOS_PARA_REANUDAR ? { accion: 'reanuda', desde: marcha.desde } : null;
  }
  const gps = gpsDe(lecturas, u, ahoraS);
  if (!gps.conSenal) return null;
  const desde = gps.racha(pausando ? gps.lento : gps.rapido);
  if (desde === null || gps.ultima.t - desde < (pausando ? SEGUNDOS_PARA_PAUSAR : SEGUNDOS_PARA_REANUDAR)) return null;
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
