/* APPLE SALUD Y APPLE WATCH, leídos desde la app de iPhone (HealthKit). 24 oct 2026; fase 3 de los stickers, 28 oct 2026.

   Lo que el Watch (o el iPhone) mide ya vive en Apple Salud: entrenos con su pulso, pulso en reposo, variabilidad (HRV), sueño y pasos. Aquí se LEE todo eso con el permiso de la
   persona, se arma EXACTAMENTE lo mismo que sale de importar el export de Apple Salud (`lib/metricas/leeAppleSalud.js`: entrenos preparados + recuperación diaria) y se guarda con el
   mismo camino (`guardaImportacion`): así las métricas del atleta y las de su coach no se enteran de si vinieron de un archivo o del teléfono. Los entrenos que ya estaban no se repiten.

   CADA ENTRENO DEL RELOJ (HKWorkout) entra como una fila de `actividades` con `origen = 'healthkit'`: su tipo, inicio, fin y duración; su RUTA (HKWorkoutRoute,
   con un método que se le agregó al plugin: `patches/@capgo+capacitor-health+*.patch`); la distancia y la energía activa (las del entreno o, si no las trae, la
   suma de sus muestras); el pulso (media, máxima y, con los umbrales del atleta, las zonas) y el desnivel (HKMetadataKeyElevationAscended). Desde ahí, la ficha
   de los stickers es la misma de cualquier entreno. El reloj entra directo: nada de archivos FIT.

   El permiso se pide SOLO cuando la persona toca «Conectar Apple Watch» (Mi perfil → Dispositivos), después de decirle para qué es.

   Solo funciona dentro de la app de iPhone (en la web no hay HealthKit): `saludDisponible()` lo dice. */

import { Capacitor } from '@capacitor/core';
import { preparaEntreno } from './metricas/construye.js';
import { entrenoDelReloj } from './metricas/leeHealthKit.js';
import { deporteDeApple } from './metricas/deportes.js';

export const saludDisponible = () => Capacitor.isNativePlatform();

const LEER = ['heartRate', 'restingHeartRate', 'heartRateVariability', 'sleep', 'steps', 'calories', 'distance', 'distanceCycling', 'vo2Max', 'oxygenSaturation', 'respiratoryRate', 'weight', 'workouts'];

/** Lo que se le dice a la persona ANTES de pedir el permiso (Mi perfil → Dispositivos → «Conectar Apple Watch»). */
export const PARA_QUE_ES = 'Training Lab va a leer de Apple Salud los entrenos de tu Apple Watch: el tipo, la hora, cuánto duró, la distancia, las calorías, tu pulso (medio, máximo y por zonas), la ruta y el desnivel. Con eso salen tus métricas, las que ve tu coach y tus stickers. También tu pulso en reposo, tu variabilidad y tu sueño, para tu recuperación. Después el iPhone te pregunta dato por dato; puedes quitarlo cuando quieras en Ajustes → Salud.';


const plugin = async () => (await import('@capgo/capacitor-health')).Health;

/** Pide el permiso de Apple Salud (sale la hoja del sistema, dato por dato). Devuelve `true` si dio al menos uno. */
export async function conectaSalud() {
  const Health = await plugin();
  const estado = await Health.requestAuthorization({ read: LEER });
  return (estado?.readAuthorized?.length ?? 0) > 0 || true; // iOS no dice qué se negó (por privacidad): si no hay datos, simplemente vendrá vacío.
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

/**
 * Lee los últimos `dias` días de Apple Salud. Devuelve lo mismo que `leeArchivos`: `{ entrenos, recuperacion, perfil, ignorados }`.
 * `alAvance(texto)` para ir diciendo qué se lee.
 */
export async function leeSalud({ dias = 30, alAvance = () => {} } = {}) {
  const Health = await plugin();
  const fin = new Date();
  const ini = new Date(fin.getTime() - dias * 86400000);
  const rango = { startDate: ini.toISOString(), endDate: fin.toISOString() };
  const desfase = -new Date().getTimezoneOffset();

  alAvance('Leyendo tus entrenos…');
  const workouts = await Health.queryWorkouts({ ...rango, limit: 500, ascending: true }).then((r) => r?.workouts ?? [], () => []);

  const entrenos = [];
  const lee = async (dataType, desde, hasta, limit = 3000) => {
    try { return (await Health.readSamples({ dataType, startDate: desde, endDate: hasta, limit, ascending: true }))?.samples ?? []; } catch { return []; }
  };
  const suma = (muestras) => muestras.reduce((t, x) => t + (Number(x.value) || 0), 0);
  for (let i = 0; i < workouts.length; i += 1) {
    const w = workouts[i];
    alAvance(`Leyendo tus entrenos del reloj (${i + 1} de ${workouts.length})…`);
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
  }

  // Lo de cada día: pulso en reposo, HRV, sueño y pasos.
  alAvance('Leyendo tu recuperación…');
  const delRango = (dataType, limit = 3000) => lee(dataType, rango.startDate, rango.endDate, limit);
  const [reposo, hrv, sueno, pasos] = await Promise.all([delRango('restingHeartRate'), delRango('heartRateVariability'), delRango('sleep', 6000), delRango('steps', 20000)]);
  const dias_ = new Map();
  const dia = (k) => { if (!dias_.has(k)) dias_.set(k, { reposo: [], hrv: [], sueno: 0, profundo: 0, rem: 0, despierto: 0, tieneSueno: false, tieneProfundo: false, tieneRem: false, tieneDespierto: false, pasos: 0 }); return dias_.get(k); };
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
  const recuperacion = [...dias_.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([k, d]) => ({
    dia: k,
    fc_reposo: d.reposo.length ? Math.round(mediana(d.reposo)) : null,
    hrv_ms: d.hrv.length ? Math.round(mediana(d.hrv) * 10) / 10 : null, hrv_tipo: d.hrv.length ? 'sdnn' : null,
    sueno_s: d.tieneSueno ? Math.round(d.sueno) : null,
    sueno_profundo_s: d.tieneProfundo ? Math.round(d.profundo) : null, sueno_rem_s: d.tieneRem ? Math.round(d.rem) : null, sueno_despierto_s: d.tieneDespierto ? Math.round(d.despierto) : null,
    pasos: d.pasos > 0 ? Math.round(d.pasos) : null, kcal_activas: null, kcal_basales: null, vo2max: null, spo2: null, frec_respiratoria: null, peso_kg: null,
    origen: 'apple_salud',
  })).filter((f) => Object.entries(f).some(([k, v]) => !['dia', 'origen', 'hrv_tipo'].includes(k) && v !== null));

  return { entrenos, recuperacion, perfil: null, ignorados: [] };
}

const LLAVE = 'salud:ultima-sincronizacion';
export const ultimaSincronizacion = () => { try { return Number(window.localStorage.getItem(LLAVE)) || null; } catch { return null; } };
export const marcaSincronizada = (ms = Date.now()) => { try { window.localStorage.setItem(LLAVE, String(ms)); } catch { /* sin memoria */ } };
export const olvidaSalud = () => { try { window.localStorage.removeItem(LLAVE); } catch { /* igual */ } };
