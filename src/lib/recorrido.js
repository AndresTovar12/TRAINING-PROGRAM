/* EL GPS DENTRO DEL ENTRENO GUIADO (23 oct 2026, maqueta aprobada: https://claude.ai/artifact/XKxchXFgxojtxHj8yk7RHY). Dos cosas distintas:
     1. EL PASO CON GPS: un paso que pide 200 m o más (un sprint, un 400, un 1 km) se hace con mapa, como la carrera del registro libre. Menos de eso (un broad
        jump de 2 m, un drill de conos) es un paso normal: el GPS del teléfono se equivoca de 5 a 10 m y ahí estorba más de lo que ayuda.
     2. EL RECORRIDO: si la persona dijo que sí (se pregunta UNA vez), todo el entreno guarda por dónde se movió, aunque nunca vea un mapa, para que la activity
        card pueda llevar la línea (Andrés: «nada más por mero morbo, mera curiosidad»). La línea va completa (él decidió no recortar el principio ni el final)
        y nada en pantalla avisa que se graba (él decidió quitar la pastilla «guardando tu recorrido»).
   Todo lo de aquí es puro (sin pantalla ni navegador) para poder probarse: `scripts/prueba-recorrido.mjs`. */

/** Desde cuántos metros un paso se hace con mapa y GPS. */
export const METROS_PARA_GPS = 200;

/** ¿Este paso del entreno se hace con GPS? Un ejercicio que termina por distancia y pide al menos `METROS_PARA_GPS` (de un rango, el menor). */
export function esPasoConGps(paso) {
  return !!paso && paso.tipo === 'ejercicio' && paso.termina?.por === 'distancia' && Number(paso.termina.min) >= METROS_PARA_GPS;
}

/** Los metros que pide el paso (de un rango, el menor: «400-600 m» se da por hecho a los 400). */
export const metrosDelPaso = (paso) => (esPasoConGps(paso) ? Number(paso.termina.min) : null);

/** Con más puntos que esto, la línea se adelgaza: para una tarjeta de Instagram sobran, y todo lo de la persona se guarda junto (cuidar el peso). */
export const MAX_PUNTOS = 300;
const cinco = (v) => Math.round(v * 1e5) / 1e5;

/**
 * La ruta lista para guardarse en el entreno (`entreno.ruta`), con la forma que ya usan los stickers (`{ lat: [], lon: [] }`), o `null` si no hay
 * al menos dos puntos. Si son muchos, se toma uno de cada N y SIEMPRE el último (la línea termina donde terminó).
 */
export function rutaParaGuardar(muestras, max = MAX_PUNTOS) {
  const pts = (muestras ?? []).filter((m) => typeof m?.lat === 'number' && typeof m?.lon === 'number');
  if (pts.length < 2) return null;
  const paso = Math.max(1, Math.ceil(pts.length / max));
  const elegidos = pts.filter((_, i) => i % paso === 0);
  if (elegidos[elegidos.length - 1] !== pts[pts.length - 1]) elegidos.push(pts[pts.length - 1]);
  return { lat: elegidos.map((p) => cinco(p.lat)), lon: elegidos.map((p) => cinco(p.lon)) };
}

/** La ruta guardada, en muestras otra vez (`[{ t, lat, lon }]`), para seguir sumándole puntos si el entreno se retoma. */
export function muestrasDeRuta(ruta) {
  if (!ruta || !Array.isArray(ruta.lat) || !Array.isArray(ruta.lon)) return [];
  const n = Math.min(ruta.lat.length, ruta.lon.length);
  return Array.from({ length: n }, (_, i) => ({ t: i * 2, lat: ruta.lat[i], lon: ruta.lon[i] }));
}

/**
 * Lo que se ve mientras corre el paso: cuántos metros faltan, la parte hecha (0 a 1) y si ya llegó.
 * `recorridos`: los metros que lleva (del GPS). `meta`: los metros que pide el paso.
 */
export function avanceDelPaso(recorridos, meta) {
  const hechos = Math.max(0, Math.round(Number(recorridos) || 0));
  const total = Math.max(1, Math.round(Number(meta) || 0));
  return { faltan: Math.max(0, total - hechos), parte: Math.min(1, hechos / total), llego: hechos >= total };
}

/** ¿Se perdió la señal? Pasaron más de `limiteS` segundos desde el último punto bueno mientras se corre. */
export const SEGUNDOS_SIN_SENAL = 5;
export const sinSenal = (ultimoPuntoMs, ahoraMs, limiteS = SEGUNDOS_SIN_SENAL) => Number.isFinite(ultimoPuntoMs) && ahoraMs - ultimoPuntoMs > limiteS * 1000;

const A_METROS = { m: 1, km: 1000, yd: 0.9144 };
/** Los metros medidos, dichos en la unidad del paso (1 km se anota «1.02», no «1020»), como texto para el registro. */
export function cantidadEnUnidad(metros, unidad = 'm') {
  const k = A_METROS[unidad] ?? 1;
  const v = (Number(metros) || 0) / k;
  return String(k === 1 ? Math.round(v) : Math.round(v * 100) / 100);
}

/**
 * El ritmo que pidió el coach, en segundos por kilómetro: «4:30 min/km» o un rango «4:25-4:35 min/km». `{ min, max }` (min = el más rápido), o `null` si lo que
 * pidió no es un ritmo («100% intensidad»). Un ritmo suelto se acepta con 5 segundos de margen a cada lado, como en el diseño del coach (4:30 → 4:25–4:35).
 */
const MARGEN_DE_RITMO = 5;
export function ritmoObjetivo(texto) {
  const m = /(\d{1,2}):(\d{2})(?:\s*[-–]\s*(\d{1,2}):(\d{2}))?\s*min\s*\/\s*km/i.exec(String(texto ?? ''));
  if (!m) return null;
  const a = Number(m[1]) * 60 + Number(m[2]);
  const b = m[3] !== undefined ? Number(m[3]) * 60 + Number(m[4]) : a;
  const min = Math.min(a, b); const max = Math.max(a, b);
  return min === max ? { min: min - MARGEN_DE_RITMO, max: max + MARGEN_DE_RITMO } : { min, max };
}

/**
 * Cómo va el ritmo de ahora contra lo que pidió el coach: `estado` ('bien' | 'rapido' | 'lento'), `pos` (0 = lento … 1 = rápido, para el marcador del medidor) y
 * `zona` (de dónde a dónde va lo bueno en ese mismo eje). `null` sin ritmo medido o sin objetivo.
 */
export function estadoDeRitmo(sKm, objetivo) {
  if (!(sKm > 0) || !objetivo) return null;
  const ancho = Math.max(objetivo.max - objetivo.min, 10);
  const lento = objetivo.max + ancho * 0.75;
  const rapido = objetivo.min - ancho * 0.75;
  const eje = lento - rapido;
  const en = (v) => Math.min(1, Math.max(0, (lento - v) / eje));
  return {
    estado: sKm < objetivo.min ? 'rapido' : (sKm > objetivo.max ? 'lento' : 'bien'),
    pos: en(sKm),
    zona: [en(objetivo.max), en(objetivo.min)],
  };
}

/** Lo que pide un paso en una línea, como la dice el coach: «400 m a 4:30 min/km» (un ritmo va con «a»; otra carga, con «·»). */
export function pedidoEnUnaLinea(cantidad, carga) {
  const c = String(carga ?? '').trim();
  if (!c) return String(cantidad ?? '');
  return `${cantidad} ${ritmoObjetivo(c) ? 'a' : '·'} ${c}`.trim();
}
