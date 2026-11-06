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

/* PAUSA AUTOMÁTICA (27 oct 2026, como Strava; reglas nuevas el 3 nov 2026, `docs/superpowers/specs/2026-11-03-pausa-automatica-rebote.md`). Con GPS, la carrera
   libre se pausa sola cuando te detienes y se reanuda sola al volver a moverte. Las reglas van por FAMILIA (`desplazamientoDe` en `lib/actividades.js`), no por
   deporte: así las propias y patines, surf, remo y kayak también la tienen. Sin mapa no hay pausa automática.

   A PIE ('pie': correr, caminar, senderismo, trail), con acelerómetro: el REBOTE del cuerpo (`lib/sensorDeMovimiento.js`).
     · Pausar: 1.5 s seguidos sin rebote. El GPS no participa.
     · Reanudar: rebote al menos 1 s seguido Y avance real del GPS: la mediana de los pasos de cada segundo en los últimos 5 s ≥ 0.6 m/s (con o sin error;
       un brinco suelto del GPS no la mueve). Mover el teléfono con las manos da rebote pero no avance: no reanuda.
     · Sin GPS bueno (ningún punto con error ≤ 20 m en los últimos 10 s, un túnel): reanuda con rebote solo, 3 s seguidos. Perder la señal nunca pausa.
     · Los metros: sin rebote, el GPS no suma distancia aunque todavía no se haya pausado (`agregaPunto` con 'quieto').
   SOBRE RUEDAS O EN EL AGUA ('ruedas': bici, patines, surf, remo, kayak): el GPS, con la barra alta. Velocidad = desplazamiento de los últimos 5 s entre el
     tiempo (no la velocidad que da el iPhone, que parado inventa ~0.9 m/s). Pausar: < 1.0 m/s 3 s seguidos y el sensor no dice «en bici». Reanudar: > 2.0 m/s
     2 s seguidos. Sin lecturas en 5 s no decide nada. El rebote no se usa.
     BICI Y PATINES (5 nov 2026: así toda parada tardaba ~7 s): con una lectura buena (error ≤ 20 m) cuenta la velocidad que da el iPhone. Pausar: < 1.5 m/s
     (`VELOCIDAD_PARA_PAUSAR_SOBRE_RUEDAS`) 2 s seguidos y el sensor no dice «en bici»; parado, el iPhone inventa ~0.9 m/s y queda abajo. Reanudar: > 2.0 m/s
     2 s seguidos, con la velocidad del iPhone o con el desplazamiento de 5 s (el de siempre). Las lecturas de error > 20 m siguen con el desplazamiento de 5 s (y piden 3 s). Surf, remo, kayak y las propias sobre ruedas o en el agua se
     quedan con el desplazamiento: no se sabe a qué velocidad reman despacio.
     «N s SEGUIDOS» (`racha`): de la primera a la última lectura que cumplen, sin huecos de más de 2 s, pasan N s o más. Con una lectura por segundo, 2 s son
     TRES lecturas seguidas; dos lecturas seguidas (1 s) no bastan.
   SIN ACELERÓMETRO (la web, o el iPhone no lo tiene): a pie, las reglas de ruedas con las barras de siempre (pausa < 0.6, reanuda > 1.0). Más lento, sin falsos.
   PARA LAS DOS: después de reanudar, 8 s sin poder pausar; después de pausar, 3 s sin poder reanudar. El interruptor «Pausa automática» sigue mandando.
   NADAR no tiene pausa automática (6 nov 2026, `sinPausaAutomatica`): se nada a ~1 m/s, justo en la barra de pausar (< 1.0) y nunca a la de reanudar (> 2.0): se pausaría sola y no
   volvería. La pausa a mano sí. */
export const UMBRALES_DE_PAUSA = {
  pie: { pausa: 0.6, reanuda: 1.0 },
  ruedas: { pausa: 1.0, reanuda: 2.0 },
};
/** Bici y patines, con lectura buena: por debajo de esta velocidad del iPhone (m/s) se está parado. */
export const VELOCIDAD_PARA_PAUSAR_SOBRE_RUEDAS = 1.5;
/** Las actividades que pausan con la velocidad del iPhone (con lectura buena). Las demás sobre ruedas o en el agua, con el desplazamiento de 5 s. */
const CON_VELOCIDAD_DEL_IPHONE = ['bici', 'patines'];
/** ¿Esta carrera pausa con la velocidad del iPhone? La de su actividad; una sin actividad (de antes), si su deporte es bici. */
export const pausaConVelocidad = (c) => CON_VELOCIDAD_DEL_IPHONE.includes(c?.actividad?.id ?? (c?.deporte === 'bici' ? 'bici' : null));
/** Nadar: la carrera solo se pausa a mano. */
export const sinPausaAutomatica = (c) => c?.deporte === 'natacion';
/** La familia de un deporte, para un cronómetro guardado antes del 3 nov 2026 (sin `desplazamiento`). */
export const familiaDelDeporte = (deporte) => (['correr', 'caminar', 'senderismo'].includes(deporte) ? 'pie' : deporte === 'bici' ? 'ruedas' : null);
const SIN_REBOTE_PARA_PAUSAR_S = 1.5;
const REBOTE_PARA_REANUDAR_S = 1;
const REBOTE_SIN_GPS_S = 3;
const LENTO_PARA_PAUSAR_S = 3;
const LENTO_CON_VELOCIDAD_S = 2;
const RAPIDO_PARA_REANUDAR_S = 2;
const SIN_PAUSAR_DESPUES_DE_REANUDAR_S = 8;
const SIN_REANUDAR_DESPUES_DE_PAUSAR_S = 3;
const SIN_SENAL_S = 5;
const GPS_BUENO_S = 10;
const HUECO_MAXIMO_S = 2;
const VENTANA_S = 5;
/** Avance real a pie: la mediana de los pasos de cada segundo, en m/s. 0.6 desde el 5 nov 2026 (antes 1.2: caminar lento no se reanudaba nunca), igual para
    correr y caminar. El rebote sigue siendo obligatorio para reanudar. */
const AVANCE_A_PIE = 0.6;
/** El error (m) de una lectura que sí sirve: ≤ 20 para el avance a pie y el «GPS bueno»; ≤ 30 para el desplazamiento de 5 s (con mucho error, entre edificios,
    también cuenta: antes se descartaba y la pausa tardaba hasta 17 s). */
const ERROR_BUENO = 20;
const ERROR_QUE_SIRVE = 30;
const metros = (a, b) => {
  const rad = Math.PI / 180;
  const x = (b.lon - a.lon) * rad * Math.cos(((a.lat + b.lat) / 2) * rad);
  const y = (b.lat - a.lat) * rad;
  return Math.sqrt(x * x + y * y) * 6371000;
};
const conLugar = (x) => typeof x?.t === 'number' && typeof x.lat === 'number' && typeof x.lon === 'number' && typeof x.pre === 'number';

/** El desplazamiento de los últimos 5 s antes de `x`, entre el tiempo (m/s), con las lecturas `lista`; `null` si no hay una de hace 5-8 s. */
function velocidadDe5s(lista, i) {
  const x = lista[i];
  for (let k = i - 1; k >= 0; k -= 1) {
    const dt = x.t - lista[k].t;
    if (dt >= VENTANA_S) return dt <= VENTANA_S + 3 ? metros(lista[k], x) / dt : null;
  }
  return null;
}

/** Desde cuándo (s) las últimas lecturas cumplen `cumple(i)` sin huecos de señal; `null` si la última no cumple. */
function racha(lista, cumple) {
  let desde = null;
  for (let i = lista.length - 1; i >= 0; i -= 1) {
    if (!cumple(i)) break;
    if (desde !== null && desde - lista[i].t > HUECO_MAXIMO_S) break;
    desde = lista[i].t;
  }
  return desde;
}

/** ¿Avance real a pie? La mediana de los pasos de cada segundo de las lecturas buenas de los últimos 5 s (al menos 4 pasos) ≥ `AVANCE_A_PIE`. */
function avanzaAPie(lecturas, ahoraS) {
  const buenas = lecturas.filter((x) => conLugar(x) && x.pre <= ERROR_BUENO);
  const ultima = buenas.at(-1);
  if (!ultima || ahoraS - ultima.t > HUECO_MAXIMO_S) return false;
  const ventana = buenas.filter((z) => ultima.t - z.t < VENTANA_S);
  const pasos = ventana.slice(1).map((z, i) => metros(ventana[i], z) / Math.max(1, z.t - ventana[i].t)).sort((a, b) => a - b);
  return pasos.length >= VENTANA_S - 1 && pasos[Math.floor(pasos.length / 2)] >= AVANCE_A_PIE;
}

/**
 * ¿Quieto o en marcha? `familia`: 'pie' | 'ruedas'. `senal`: lo de `senales` (`lib/sensorDeMovimiento.js`) o `null` (la web). `lecturas`: las del GPS
 * `{ t (s), lat, lon, pre, vel? }`. Devuelve `{ quieto, mueve, metros }`: `quieto`/`mueve` son `{ desde (s), motivo }` o `null` (el motivo: 'sin-rebote',
 * 'rebote+avance', 'sin-gps', 'gps-lento', 'gps-rapido'); `metros`: 'quieto' (el punto no suma), 'mueve' o `null` (las reglas del GPS de `agregaPunto`).
 * `conVelocidad`: bici y patines (`pausaConVelocidad`): con lectura buena cuenta la velocidad del iPhone.
 */
export function decideMarcha(familia, senal, lecturas, ahoraS, { conVelocidad = false } = {}) {
  const u = UMBRALES_DE_PAUSA[familia];
  if (!u) return { quieto: null, mueve: null, metros: null };
  const s = (ms) => (ms == null ? null : ms / 1000);
  if (familia === 'pie' && senal?.reboteVivo) {
    const sin = senal.sinReboteDesde != null ? ahoraS - s(senal.sinReboteDesde) : 0;
    const con = senal.reboteDesde != null ? ahoraS - s(senal.reboteDesde) : 0;
    const quieto = sin >= SIN_REBOTE_PARA_PAUSAR_S ? { desde: s(senal.sinReboteDesde), motivo: 'sin-rebote' } : null;
    const gpsBueno = lecturas.some((x) => conLugar(x) && x.pre <= ERROR_BUENO && ahoraS - x.t <= GPS_BUENO_S);
    let mueve = null;
    if (senal.rebota && gpsBueno && con >= REBOTE_PARA_REANUDAR_S && avanzaAPie(lecturas, ahoraS)) mueve = { desde: s(senal.reboteDesde), motivo: 'rebote+avance' };
    if (senal.rebota && !gpsBueno && con >= REBOTE_SIN_GPS_S) mueve = { desde: s(senal.reboteDesde), motivo: 'sin-gps' };
    return { quieto, mueve, metros: !senal.rebota ? 'quieto' : (mueve ? 'mueve' : null) };
  }
  // Sobre ruedas (o a pie sin acelerómetro): el desplazamiento de 5 s.
  const lista = lecturas.filter((x) => conLugar(x) && x.pre <= ERROR_QUE_SIRVE);
  const ultima = lista.at(-1);
  if (!ultima || ahoraS - ultima.t > SIN_SENAL_S) return { quieto: null, mueve: null, metros: null };
  const v5 = lista.map((_, i) => velocidadDe5s(lista, i));
  // Bici y patines: con lectura buena, la velocidad del iPhone; con error de más de 20 m, el desplazamiento de 5 s.
  const conVel = (i) => conVelocidad && familia === 'ruedas' && lista[i].pre <= ERROR_BUENO && typeof lista[i].vel === 'number' && lista[i].vel >= 0;
  const lento = racha(lista, (i) => (conVel(i) ? lista[i].vel < VELOCIDAD_PARA_PAUSAR_SOBRE_RUEDAS : v5[i] != null && v5[i] < u.pausa));
  // Reanudar: > 2.0 m/s con la velocidad del iPhone (lectura buena de bici o patines) o, como siempre, con el desplazamiento de 5 s; cualquiera de las dos.
  const rapido = racha(lista, (i) => (conVel(i) && lista[i].vel > u.reanuda) || (v5[i] != null && v5[i] > u.reanuda));
  // 2 s si toda la racha lenta es de lecturas buenas con velocidad; si entra una con mucho error, los 3 s de siempre.
  const soloVel = lento != null && lista.every((x, i) => x.t < lento || conVel(i));
  const necesita = soloVel ? LENTO_CON_VELOCIDAD_S : LENTO_PARA_PAUSAR_S;
  const quieto = lento != null && ultima.t - lento >= necesita && !senal?.enBici ? { desde: lento, motivo: 'gps-lento' } : null;
  const mueve = rapido != null && ultima.t - rapido >= RAPIDO_PARA_REANUDAR_S ? { desde: rapido, motivo: 'gps-rapido' } : null;
  return { quieto, mueve, metros: null };
}

/**
 * ¿Hay que pausar o reanudar? `estado`: 'corriendo' o 'pausa' (una pausa AUTOMÁTICA: la manual no se reanuda sola). `marcha`: lo de `decideMarcha`.
 * `reanudadoEnS`: cuándo se reanudó por última vez (8 s sin poder pausar); `pausadoEnS`: cuándo se pausó (3 s sin poder reanudar). Devuelve
 * `{ accion: 'pausa' | 'reanuda', desde, motivo }` (desde: el segundo en que se detuvo o arrancó) o `null`.
 */
export function decidePausaAutomatica(estado, marcha, ahoraS, { reanudadoEnS = null, pausadoEnS = null } = {}) {
  if (!marcha) return null;
  if (estado === 'corriendo') {
    if (!marcha.quieto || (reanudadoEnS != null && ahoraS - reanudadoEnS < SIN_PAUSAR_DESPUES_DE_REANUDAR_S)) return null;
    return { accion: 'pausa', desde: marcha.quieto.desde, motivo: marcha.quieto.motivo };
  }
  if (estado === 'pausa') {
    if (!marcha.mueve || (pausadoEnS != null && ahoraS - pausadoEnS < SIN_REANUDAR_DESPUES_DE_PAUSAR_S)) return null;
    return { accion: 'reanuda', desde: marcha.mueve.desde, motivo: marcha.mueve.motivo };
  }
  return null;
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
