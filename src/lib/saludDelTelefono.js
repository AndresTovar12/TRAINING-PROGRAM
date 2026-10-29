/* APPLE SALUD Y APPLE WATCH, leídos desde la app de iPhone (HealthKit). 24 oct 2026; fase 3 de los stickers, 28 oct 2026.

   Lo que el Watch (o el iPhone) mide ya vive en Apple Salud: entrenos con su pulso, pulso en reposo, variabilidad (HRV), sueño y pasos. Aquí se LEE todo eso con el permiso de la
   persona, se arma EXACTAMENTE lo mismo que sale de importar el export de Apple Salud (`lib/metricas/leeAppleSalud.js`: entrenos preparados + recuperación diaria) y se guarda con el
   mismo camino (`guardaImportacion`): así las métricas del atleta y las de su coach no se enteran de si vinieron de un archivo o del teléfono. Los entrenos que ya estaban no se repiten.

   CADA ENTRENO DEL RELOJ (HKWorkout) entra como una fila de `actividades` con `origen = 'healthkit'`: su tipo, inicio, fin y duración; su RUTA (HKWorkoutRoute,
   con un método que se le agregó al plugin: `patches/@capgo+capacitor-health+*.patch`); la distancia y la energía activa (las del entreno o, si no las trae, la
   suma de sus muestras); el pulso (media, máxima y, con los umbrales del atleta, las zonas) y el desnivel (HKMetadataKeyElevationAscended). Desde ahí, la ficha
   de los stickers es la misma de cualquier entreno. El reloj entra directo: nada de archivos FIT.

   EL PERMISO, TODO JUNTO (fase 5, 29 oct 2026): un solo «Conectar Apple Watch» pide de una vez LEER (lo de abajo y la ruta) y ESCRIBIR entrenos, pulso y
   energía activa, que es lo que necesita la app del reloj para medir: así el reloj ya no pregunta nada. Se pide SOLO cuando la persona toca «Conectar»;
   «Ahora no» no le pide nada al iPhone. iOS no dice si negó la LECTURA (por privacidad): se sabe así (`revisaPermiso`): si negó escribir entrenos, o si no
   se puede leer ni un paso de los últimos 60 días, «No pudimos leer nada». TODO CUENTA DESDE QUE CONECTA: `leeSalud` lee desde `conectado_en`; lo de antes
   (12 meses, solo resúmenes) va aparte y solo sirve para las cuentas (`leeLoDeAntes`).

   Solo funciona dentro de la app de iPhone (en la web no hay HealthKit): `saludDisponible()` lo dice. */

import { Capacitor } from '@capacitor/core';
import { preparaEntreno } from './metricas/construye.js';
import { entrenoDelReloj } from './metricas/leeHealthKit.js';
import { deporteDeApple } from './metricas/deportes.js';

export const saludDisponible = () => Capacitor.isNativePlatform();

const LEER = ['heartRate', 'restingHeartRate', 'heartRateVariability', 'sleep', 'steps', 'calories', 'distance', 'distanceCycling', 'vo2Max', 'oxygenSaturation', 'respiratoryRate', 'weight', 'workouts'];
// Lo que la app del reloj guarda en Salud al medir un entreno (`ModeloDelEntreno.swift`): el entreno, su pulso y su energía activa.
const ESCRIBIR = ['workouts', 'heartRate', 'calories'];

/* OJO: el plugin NO se devuelve directo de una función `async`. Al resolver la promesa, JavaScript le pregunta por `.then` y el «proxy» de Capacitor lo toma
   por un método nativo que no existe («Health.then() is not implemented»): conectar fallaba siempre. Se pasa dentro de un objeto. */
const conPlugin = async () => ({ Health: (await import('@capgo/capacitor-health')).Health });

/** Pide el permiso de Apple Salud, leer y escribir, todo junto (sale la hoja del sistema). Después, `revisaPermiso` dice si sirvió. */
export async function pideSalud() {
  const { Health } = await conPlugin();
  await Health.requestAuthorization({ read: LEER, write: ESCRIBIR });
}

/**
 * ¿Dio permiso? Dos revisiones, las únicas que iOS deja hacer: escribir entrenos (eso sí se sabe) y leer al menos un paso de los últimos 60 días (si la
 * lectura está apagada, Salud contesta vacío, como si no hubiera nada). `{ ok, escribe, lee }`.
 */
export async function revisaPermiso() {
  const { Health } = await conPlugin();
  const estado = await Health.checkAuthorization({ read: LEER, write: ESCRIBIR }).catch(() => null);
  const escribe = !!estado && !(estado.writeDenied ?? []).includes('workouts');
  const fin = new Date();
  const ini = new Date(fin.getTime() - 60 * 86400000);
  const pasos = await Health.readSamples({ dataType: 'steps', startDate: ini.toISOString(), endDate: fin.toISOString(), limit: 1 })
    .then((r) => r?.samples ?? [], () => []);
  const lee = pasos.length > 0;
  return { ok: escribe && lee, escribe, lee };
}

// «Running» → 'HKWorkoutActivityTypeRunning', el nombre que ya entiende `deporteDeApple`.
const tipoDeApple = (t) => `HKWorkoutActivityType${String(t ?? 'other').replace(/^./, (c) => c.toUpperCase())}`;

const mediana = (xs) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) >> 1] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : null;
};

/** El día (AAAA-MM-DD) en hora local de un instante. */
const diaLocal = (ms) => {
  const d = new Date(ms);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const iso = (ms) => new Date(ms).toISOString();
const masNuevo = (a, b) => (!a ? b : !b ? a : a > b ? a : b);

/** La recuperación de cada día (pulso en reposo, HRV, sueño, pasos) entre `desde` y `hasta` (ms). Cada muestra cuenta solo si cae en ese rato. */
async function leeRecuperacion(Health, desde, hasta, { origen = 'apple_salud' } = {}) {
  const lee = async (dataType, limit) => {
    try { return (await Health.readSamples({ dataType, startDate: iso(desde), endDate: iso(hasta), limit, ascending: true }))?.samples ?? []; } catch { return []; }
  };
  const largo = (hasta - desde) / 86400000;
  const [reposo, hrv, sueno, pasos] = await Promise.all([
    lee('restingHeartRate', Math.ceil(largo * 3) + 50), lee('heartRateVariability', Math.ceil(largo * 30) + 200),
    lee('sleep', Math.ceil(largo * 40) + 200), lee('steps', Math.ceil(largo * 150) + 500),
  ]);
  const dias = new Map();
  const dia = (k) => { if (!dias.has(k)) dias.set(k, { reposo: [], hrv: [], sueno: 0, profundo: 0, rem: 0, despierto: 0, tieneSueno: false, tieneProfundo: false, tieneRem: false, tieneDespierto: false, pasos: 0 }); return dias.get(k); };
  reposo.forEach((s) => dia(diaLocal(new Date(s.startDate).getTime())).reposo.push(s.value));
  hrv.forEach((s) => dia(diaLocal(new Date(s.startDate).getTime())).hrv.push(s.value));
  pasos.forEach((s) => { dia(diaLocal(new Date(s.startDate).getTime())).pasos += s.value; });
  sueno.forEach((s) => {
    // El sueño cuenta para el día en que TERMINA (la noche del lunes al martes es del martes).
    const d = dia(diaLocal(new Date(s.endDate).getTime()));
    const seg = Math.max(0, (new Date(s.endDate).getTime() - new Date(s.startDate).getTime()) / 1000);
    const estado = s.sleepState ?? 'asleep';
    if (estado === 'inBed') return;
    if (estado === 'awake') { d.despierto += seg; d.tieneDespierto = true; return; }
    d.sueno += seg; d.tieneSueno = true;
    if (estado === 'deep') { d.profundo += seg; d.tieneProfundo = true; }
    if (estado === 'rem') { d.rem += seg; d.tieneRem = true; }
  });
  return [...dias.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, d]) => ({
    dia: k,
    fc_reposo: d.reposo.length ? Math.round(mediana(d.reposo)) : null,
    hrv_ms: d.hrv.length ? Math.round(mediana(d.hrv) * 10) / 10 : null, hrv_tipo: d.hrv.length ? 'sdnn' : null,
    sueno_s: d.tieneSueno ? Math.round(d.sueno) : null,
    sueno_profundo_s: d.tieneProfundo ? Math.round(d.profundo) : null, sueno_rem_s: d.tieneRem ? Math.round(d.rem) : null, sueno_despierto_s: d.tieneDespierto ? Math.round(d.despierto) : null,
    pasos: d.pasos > 0 ? Math.round(d.pasos) : null, kcal_activas: null, kcal_basales: null, vo2max: null, spo2: null, frec_respiratoria: null, peso_kg: null,
    origen,
  })).filter((f) => Object.entries(f).some(([k, v]) => !['dia', 'origen', 'hrv_tipo'].includes(k) && v !== null));
}

/**
 * Lee de Apple Salud lo que pasó entre `desde` y `hasta` (ms; TODO CUENTA DESDE QUE CONECTA: `desde` nunca es antes de `conectado_en`). Devuelve lo mismo que
 * `leeArchivos` (`{ entrenos, recuperacion, perfil, ignorados }`) y `llego`: la hora más nueva de cada cosa que llegó (`entrenos`, `pulso`, `ruta`,
 * `recuperacion`, `sueno`), para «Lo que está llegando». `alAvance(texto)` para ir diciendo qué se lee.
 */
export async function leeSalud({ desde, hasta = Date.now(), alAvance = () => {} } = {}) {
  const { Health } = await conPlugin();
  const desfase = -new Date().getTimezoneOffset();

  alAvance('Leyendo tus entrenos…');
  const workouts = await Health.queryWorkouts({ startDate: iso(desde), endDate: iso(hasta), limit: 500, ascending: true }).then((r) => r?.workouts ?? [], () => []);
  // Un entreno que empezó antes de conectar no entra, aunque terminara después.
  const nuevos = workouts.filter((w) => new Date(w.startDate).getTime() >= desde);

  const entrenos = [];
  const llego = {};
  const lee = async (dataType, ini, fin, limit = 3000) => {
    try { return (await Health.readSamples({ dataType, startDate: ini, endDate: fin, limit, ascending: true }))?.samples ?? []; } catch { return []; }
  };
  const suma = (muestras) => muestras.reduce((t, x) => t + (Number(x.value) || 0), 0);
  for (let i = 0; i < nuevos.length; i += 1) {
    const w = nuevos[i];
    alAvance(`Leyendo tus entrenos del reloj (${i + 1} de ${nuevos.length})…`);
    const deporte = deporteDeApple(tipoDeApple(w.workoutType));
    const [pulso, ruta] = await Promise.all([
      lee('heartRate', w.startDate, w.endDate, 8000),
      w.platformId ? Health.queryWorkoutRoute({ workoutId: w.platformId }).then((r) => r?.locations ?? [], () => []) : [],
    ]);
    // La distancia y la energía activa: las que declaró el entreno; si no trae, la suma de sus muestras en ese rato.
    let distanciaSumada = null;
    if (!(w.totalDistance > 0) && ['bici', 'correr', 'caminar', 'senderismo'].includes(deporte)) {
      distanciaSumada = suma(await lee(deporte === 'bici' ? 'distanceCycling' : 'distance', w.startDate, w.endDate, 5000));
    }
    const kcalSumadas = w.totalEnergyBurned > 0 ? null : suma(await lee('calories', w.startDate, w.endDate, 5000));
    entrenos.push(preparaEntreno(entrenoDelReloj({ w, deporte, deporteOriginal: tipoDeApple(w.workoutType), pulso, ruta, distanciaSumada, kcalSumadas, desfase })));
    llego.entrenos = masNuevo(llego.entrenos, w.endDate);
    if (pulso.length) llego.pulso = masNuevo(llego.pulso, w.endDate);
    if (ruta.length) llego.ruta = masNuevo(llego.ruta, w.endDate);
  }

  alAvance('Leyendo tu recuperación…');
  const recuperacion = await leeRecuperacion(Health, desde, hasta);
  recuperacion.forEach((f) => {
    if (f.fc_reposo || f.hrv_ms) llego.recuperacion = masNuevo(llego.recuperacion, `${f.dia}T12:00:00`);
    if (f.sueno_s) llego.sueno = masNuevo(llego.sueno, `${f.dia}T08:00:00`);
  });

  return { entrenos, recuperacion, perfil: null, ignorados: [], llego };
}

/**
 * LO DE ANTES DE CONECTAR, SOLO PARA LAS CUENTAS (fase 5): hasta 12 meses antes de `hasta` (= `conectado_en`). De cada entreno, solo su resumen (tipo,
 * inicio, fin, duración, distancia, calorías, pulso medio y máximo, sin ruta ni series) y de cada día, pulso en reposo, variabilidad y sueño. Con eso la
 * condición, la fatiga y «lo normal» de la recuperación arrancan con su historia; ninguna pantalla lo enseña. Devuelve `{ entrenos, recuperacion }`.
 */
export async function leeLoDeAntes({ hasta, meses = 12 } = {}) {
  const { Health } = await conPlugin();
  const desfase = -new Date().getTimezoneOffset();
  const desde = hasta - meses * 30.44 * 86400000;
  const workouts = await Health.queryWorkouts({ startDate: iso(desde), endDate: iso(hasta), limit: 2000, ascending: true }).then((r) => r?.workouts ?? [], () => []);
  const entrenos = [];
  for (const w of workouts.filter((x) => new Date(x.startDate).getTime() < hasta)) {
    // El pulso medio y máximo del rato del entreno, de una sola consulta (HKStatistics), sin leer latido por latido.
    const stats = await Health.queryAggregated({ dataType: 'heartRate', startDate: w.startDate, endDate: w.endDate, bucket: 'day', aggregation: ['average', 'max'] })
      .then((r) => r?.samples ?? [], () => []);
    const conValor = stats.filter((b) => b.values?.average > 0);
    const media = conValor.length ? conValor.reduce((t, b) => t + b.values.average, 0) / conValor.length : null;
    const maxima = conValor.length ? Math.max(...conValor.map((b) => b.values.max ?? b.values.average)) : null;
    const crudo = entrenoDelReloj({ w, deporte: deporteDeApple(tipoDeApple(w.workoutType)), deporteOriginal: tipoDeApple(w.workoutType), desfase });
    const dur = crudo.duracion_s;
    // Para la carga basta el pulso medio durante todo el entreno: una muestra cada 30 s (el hueco más largo que cuenta la carga), todas con el pulso medio.
    if (media) {
      crudo.muestras = Array.from({ length: Math.max(10, Math.ceil(dur / 30) + 1) }, (_, i) => ({ t: Math.min(dur, i * 30), fc: Math.round(media) }));
      crudo.resumen = { ...crudo.resumen, fc_media: Math.round(media), fc_max: Math.round(maxima), fc_min: null };
    }
    const prep = preparaEntreno(crudo);
    prep.resumen = { ...prep.resumen, ...crudo.resumen };
    entrenos.push(prep);
  }
  const recuperacion = await leeRecuperacion(Health, desde, hasta);
  return { entrenos, recuperacion };
}

const LLAVE = 'salud:ultima-sincronizacion';
export const ultimaSincronizacion = () => { try { return Number(window.localStorage.getItem(LLAVE)) || null; } catch { return null; } };
export const marcaSincronizada = (ms = Date.now()) => { try { window.localStorage.setItem(LLAVE, String(ms)); } catch { /* sin memoria */ } };
export const olvidaSalud = () => { try { window.localStorage.removeItem(LLAVE); } catch { /* igual */ } };
