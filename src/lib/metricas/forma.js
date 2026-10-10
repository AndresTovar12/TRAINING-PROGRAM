/* La FORMA del atleta a lo largo del tiempo: lo que el coach mira para saber si lo está cargando bien.

   Andrés (10 oct 2026): para quitarle usuarios a TrainingPeaks y Strava el coach tiene que ver todas las métricas. De TrainingPeaks lo que más se usa es la
   gráfica de rendimiento (condición, fatiga y forma). Aquí se llaman por su nombre en español, con la sigla chica por si el coach ya la conoce:
     Condición (CTL)  el promedio de la carga de las últimas ~6 semanas: lo que el cuerpo ya aguanta
     Fatiga (ATL)     el promedio de la última semana: lo que trae encima ahora
     Forma (TSB)      condición de ayer menos fatiga de ayer: positiva = llega con energía, negativa = trae carga encima

   Todo es puro: recibe filas ya leídas de la base (`actividades`, `recuperacion_diaria`) y devuelve números y textos. Los días son texto `AAAA-MM-DD` en
   la hora LOCAL del entreno (`inicio` + `desfase_min`): un entreno de las 11 de la noche en México cuenta ese día, no el siguiente.

   Este archivo no importa nada de la app (ni `@/`). */

/* ------------------------------------------------------------------ */
/* Días                                                                */
/* ------------------------------------------------------------------ */

const DIA_MS = 86400000;

/** El día local de un entreno: `inicio` (texto ISO o milisegundos) más su desfase en minutos respecto a UTC (el de la hora local del reloj). */
export function diaLocal(inicio, desfaseMin = 0) {
  const ms = typeof inicio === 'number' ? inicio : Date.parse(inicio);
  if (!Number.isFinite(ms)) return null;
  return new Date(ms + (Number(desfaseMin) || 0) * 60000).toISOString().slice(0, 10);
}

const aMs = (dia) => Date.parse(`${dia}T00:00:00Z`);
const aDia = (ms) => new Date(ms).toISOString().slice(0, 10);
/** Un día más (o menos) otros `n`. */
export const sumaDias = (dia, n) => aDia(aMs(dia) + n * DIA_MS);
/** Cuántos días hay de `a` a `b` (positivo si `b` es después). */
export const diasEntre = (a, b) => Math.round((aMs(b) - aMs(a)) / DIA_MS);
/** El lunes de la semana de un día (la semana empieza el lunes, como en el resto de la app). */
export const lunesDe = (dia) => sumaDias(dia, -((new Date(aMs(dia)).getUTCDay() + 6) % 7));

/* ------------------------------------------------------------------ */
/* Condición, fatiga y forma                                           */
/* ------------------------------------------------------------------ */

/** La carga de cada día (suma de los entrenos del día): `Map { 'AAAA-MM-DD' → carga }`. Un entreno sin carga no cuenta. */
export function cargaPorDia(actividades) {
  const mapa = new Map();
  (actividades ?? []).forEach((a) => {
    if (!(a?.carga > 0)) return;
    const dia = diaLocal(a.inicio, a.desfase_min);
    if (dia) mapa.set(dia, (mapa.get(dia) ?? 0) + a.carga);
  });
  return mapa;
}

/**
 * La curva día por día: `[{ dia, carga, ctl, atl, tsb }]` desde `desde` hasta `hasta` (incluidos).
 *   ctl  condición: promedio móvil exponencial de la carga con constante de 42 días
 *   atl  fatiga: lo mismo con 7 días
 *   tsb  forma de ESE día = condición de ayer − fatiga de ayer (cómo llegó al día, antes de entrenar)
 * Empieza en cero el primer día de `desde`: pasa `desde` unas semanas ANTES del primer entreno que se quiera mirar, para que la condición ya haya subido.
 */
export function curvaDeForma(porDia, { desde, hasta, constanteCtl = 42, constanteAtl = 7 }) {
  const curva = [];
  let ctl = 0;
  let atl = 0;
  const total = diasEntre(desde, hasta);
  for (let i = 0; i <= total; i += 1) {
    const dia = sumaDias(desde, i);
    const carga = porDia.get(dia) ?? 0;
    const tsb = ctl - atl;
    ctl += (carga - ctl) / constanteCtl;
    atl += (carga - atl) / constanteAtl;
    curva.push({ dia, carga: Math.round(carga * 10) / 10, ctl: Math.round(ctl * 10) / 10, atl: Math.round(atl * 10) / 10, tsb: Math.round(tsb * 10) / 10 });
  }
  return curva;
}

/**
 * Qué dice la forma de hoy, en palabras para el coach: `{ clave, titulo, detalle, tono }`. `tono`: 'verde' | 'azul' | 'neutro' | 'ambar' | 'rojo'.
 * Con una condición casi en cero todavía no hay base para opinar.
 */
export function estadoDeForma(tsb, ctl) {
  if (!(ctl >= 8)) return { clave: 'sin-base', titulo: 'Poco historial', detalle: 'Todavía no hay suficientes entrenos para saber cuánto carga normalmente.', tono: 'neutro' };
  if (tsb > 25) return { clave: 'descansado', titulo: 'Mucho descanso', detalle: 'Lleva días con poca carga: puede estar perdiendo condición.', tono: 'azul' };
  if (tsb > 5) return { clave: 'fresco', titulo: 'En plena forma', detalle: 'Llega con energía: buen momento para un entreno duro o una prueba.', tono: 'verde' };
  if (tsb >= -10) return { clave: 'equilibrio', titulo: 'En equilibrio', detalle: 'Lo que entrena y lo que descansa van parejos.', tono: 'neutro' };
  if (tsb >= -30) return { clave: 'productivo', titulo: 'Entrenando fuerte', detalle: 'Trae mucha carga encima, pero dentro de lo que suele dar progreso.', tono: 'ambar' };
  return { clave: 'riesgo', titulo: 'Sobrecarga', detalle: 'La fatiga es mucho más alta que su condición: riesgo de sobreentrenamiento. Conviene descansar.', tono: 'rojo' };
}

/** Cuánto subió (o bajó) la condición en los últimos 7 días de la curva, en puntos por semana. `null` con menos de una semana de curva. */
export function rampaDeCondicion(curva) {
  if (!curva || curva.length < 8) return null;
  return Math.round((curva[curva.length - 1].ctl - curva[curva.length - 8].ctl) * 10) / 10;
}

/* ------------------------------------------------------------------ */
/* Semanas                                                             */
/* ------------------------------------------------------------------ */

/**
 * Lo de cada semana (de lunes a domingo), de la más vieja a la más nueva, con la semana de `hoy` al final aunque vaya a medias:
 * `[{ lunes, sesiones, duracion_s, distancia_m, carga, fc_media, zonas_s, kcal }]`. `fc_media` pesa por duración (una hora a 150 pesa más que 10 min a 170).
 */
export function porSemana(actividades, { semanas = 12, hoy } = {}) {
  const ultimo = lunesDe(hoy);
  const lunes = Array.from({ length: semanas }, (_, i) => sumaDias(ultimo, -7 * (semanas - 1 - i)));
  const cubos = new Map(lunes.map((l) => [l, { lunes: l, sesiones: 0, duracion_s: 0, distancia_m: 0, carga: 0, kcal: 0, zonas_s: [0, 0, 0, 0, 0], _fc: 0, _pesoFc: 0 }]));
  (actividades ?? []).forEach((a) => {
    const dia = diaLocal(a.inicio, a.desfase_min);
    if (!dia) return;
    const c = cubos.get(lunesDe(dia));
    if (!c) return;
    c.sesiones += 1;
    c.duracion_s += a.duracion_s ?? 0;
    c.distancia_m += a.distancia_m ?? 0;
    c.carga += a.carga ?? 0;
    c.kcal += a.kcal_activas ?? 0;
    if (Array.isArray(a.zonas_s)) a.zonas_s.forEach((s, i) => { c.zonas_s[i] += s ?? 0; });
    if (a.fc_media > 0 && a.duracion_s > 0) { c._fc += a.fc_media * a.duracion_s; c._pesoFc += a.duracion_s; }
  });
  return lunes.map((l) => {
    const c = cubos.get(l);
    return {
      lunes: l, sesiones: c.sesiones, duracion_s: c.duracion_s, distancia_m: Math.round(c.distancia_m), carga: Math.round(c.carga),
      fc_media: c._pesoFc > 0 ? Math.round(c._fc / c._pesoFc) : null, zonas_s: c.zonas_s, kcal: Math.round(c.kcal),
    };
  });
}

/**
 * Los totales de los entrenos de `lunes` hasta `hasta` (incluido): `{ sesiones, duracion_s, carga }`. Sirve para comparar la semana en curso con la pasada A ESTA
 * ALTURA (de lunes a jueves contra lunes a jueves): comparar una semana a medias con una completa siempre diría «bajó».
 */
export function totalesHasta(actividades, { lunes, hasta }) {
  let sesiones = 0; let duracion = 0; let carga = 0;
  (actividades ?? []).forEach((a) => {
    const dia = diaLocal(a.inicio, a.desfase_min);
    if (!dia || dia < lunes || dia > hasta) return;
    sesiones += 1; duracion += a.duracion_s ?? 0; carga += a.carga ?? 0;
  });
  return { sesiones, duracion_s: duracion, carga: Math.round(carga) };
}

/** Cuánto cambió `ahora` respecto a `antes`, en por ciento entero (+12, −8). `null` si no hay con qué comparar. */
export const cambioEnPorCiento = (ahora, antes) => (antes > 0 && ahora >= 0 ? Math.round(((ahora - antes) / antes) * 100) : null);

/* ------------------------------------------------------------------ */
/* El pulso más alto visto                                             */
/* ------------------------------------------------------------------ */

/**
 * El pulso máximo que se le ha visto en los últimos `dias` días: un pulso máximo CREÍBLE, no el pico más alto de todos (un sensor que se vuelve loco
 * da 240 una vez y arruinaría las zonas). Con 5 o más entrenos se toma el que deja a un 10 % de entrenos por arriba; con menos, el más alto sin pasar de 210.
 */
export function pulsoMaximoVisto(actividades, { dias = 180, hoy } = {}) {
  const desde = sumaDias(hoy, -dias);
  const valores = (actividades ?? [])
    .filter((a) => a.fc_max >= 100 && a.fc_max <= 240 && (diaLocal(a.inicio, a.desfase_min) ?? '') >= desde)
    .map((a) => a.fc_max)
    .sort((x, y) => y - x);
  if (valores.length === 0) return null;
  if (valores.length >= 5) return valores[Math.floor(valores.length * 0.1)];
  return Math.min(valores[0], 210);
}

/* ------------------------------------------------------------------ */
/* Recuperación                                                        */
/* ------------------------------------------------------------------ */

const media = (v) => (v.length ? v.reduce((s, x) => s + x, 0) / v.length : null);
const mediana = (v) => {
  if (!v.length) return null;
  const o = [...v].sort((a, b) => a - b);
  const m = Math.floor(o.length / 2);
  return o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2;
};
const redondea = (v, dec = 0) => (v === null || v === undefined ? null : Math.round(v * 10 ** dec) / 10 ** dec);

/** Lo que dice cada día en una ventana de `dias` terminada en `hoy`: los valores (sin vacíos) de un campo. */
function ventana(filas, campo, hoy, dias, saltar = 0) {
  const hasta = sumaDias(hoy, -saltar);
  const desde = sumaDias(hasta, -(dias - 1));
  return (filas ?? []).filter((f) => f.dia >= desde && f.dia <= hasta && typeof f[campo] === 'number' && f[campo] > 0).map((f) => f[campo]);
}

/** La mediana del pulso en reposo de los últimos `dias` días: sirve de base para las zonas y la carga. `null` si no hay datos. */
export const pulsoEnReposoMediano = (filas, { hoy, dias = 30 }) => redondea(mediana(ventana(filas, 'fc_reposo', hoy, dias)), 1);

/**
 * La recuperación de hoy contra lo normal de ese atleta. Para cada medida (pulso en reposo, HRV, sueño): el último valor, el promedio de 7 días y la base
 * de los 30 días anteriores a esa semana, con `estado` ('bien' | 'atencion' | 'sin-base' | 'sin-datos'). Y un veredicto en conjunto.
 *
 * Lo que se considera «atención»: el pulso en reposo 3 o más latidos por encima de su base; la HRV 10 % o más por debajo de su base; el sueño promedio
 * de menos de 6.5 horas. No es un diagnóstico: es una señal para preguntarle al atleta cómo está.
 */
export function resumenDeRecuperacion(filas, { hoy }) {
  const medida = (campo, { mejor = 'alto', umbral, texto, unidad, dec = 0, factor = 1, absoluto = false }) => {
    const ultimas = (filas ?? []).filter((f) => typeof f[campo] === 'number' && f[campo] > 0 && f.dia <= hoy).sort((a, b) => (a.dia < b.dia ? 1 : -1));
    const ultimo = ultimas.length ? ultimas[0] : null;
    const sieteV = ventana(filas, campo, hoy, 7).map((v) => v * factor);
    const baseV = ventana(filas, campo, hoy, 30, 7).map((v) => v * factor);
    const siete = media(sieteV);
    const base = mediana(baseV);
    let estado = 'sin-datos';
    let diferencia = null;
    if (siete !== null) {
      if (absoluto) estado = umbral(siete, base) ? 'atencion' : 'bien';
      else if (base !== null && baseV.length >= 5) {
        diferencia = mejor === 'alto' ? (siete - base) / base : siete - base;
        estado = umbral(siete, base) ? 'atencion' : 'bien';
      } else estado = 'sin-base'; // hay datos de la semana, pero todavía no hay con qué compararlos
    }
    return {
      campo, texto, unidad, ultimo: ultimo ? { dia: ultimo.dia, valor: redondea(ultimo[campo] * factor, dec) } : null,
      siete: redondea(siete, dec), base: redondea(base, dec), diferencia: diferencia === null ? null : redondea(diferencia, mejor === 'alto' ? 3 : 1), estado,
    };
  };
  const reposo = medida('fc_reposo', { mejor: 'bajo', texto: 'Pulso en reposo', unidad: 'lpm', umbral: (s, b) => s - b >= 3 });
  const hrv = medida('hrv_ms', { mejor: 'alto', texto: 'Variabilidad (HRV)', unidad: 'ms', umbral: (s, b) => (s - b) / b <= -0.1 });
  const sueno = medida('sueno_s', { mejor: 'alto', texto: 'Sueño', unidad: 'h', dec: 1, factor: 1 / 3600, absoluto: true, umbral: (s) => s < 6.5 });
  const medidas = [reposo, hrv, sueno];
  const conDatos = medidas.filter((m) => m.estado === 'bien' || m.estado === 'atencion');
  const alertas = conDatos.filter((m) => m.estado === 'atencion').length;
  const veredicto = conDatos.length === 0
    ? { clave: 'sin-datos', titulo: 'Sin datos de recuperación', detalle: 'Faltan el pulso en reposo, la HRV o el sueño de los últimos días.', tono: 'neutro' }
    : alertas === 0
      ? { clave: 'bien', titulo: 'Recuperando bien', detalle: 'Su pulso en reposo, su HRV y su sueño van dentro de lo normal en su caso.', tono: 'verde' }
      : alertas === 1
        ? { clave: 'atencion', titulo: 'Atención', detalle: `Una señal fuera de lo normal: ${conDatos.find((m) => m.estado === 'atencion').texto.toLowerCase()}. Conviene preguntarle cómo se siente.`, tono: 'ambar' }
        : { clave: 'cargado', titulo: 'Cuerpo cargado', detalle: 'Varias señales fuera de lo normal a la vez: conviene aligerar la carga y preguntarle cómo está.', tono: 'rojo' };
  return { reposo, hrv, sueno, veredicto };
}
