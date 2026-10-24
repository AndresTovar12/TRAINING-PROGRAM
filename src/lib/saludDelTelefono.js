/* APPLE SALUD Y APPLE WATCH, leídos desde la app de iPhone (HealthKit). 24 oct 2026.

   Lo que el Watch (o el iPhone) mide ya vive en Apple Salud: entrenos con su pulso, pulso en reposo, variabilidad (HRV), sueño y pasos. Aquí se LEE todo eso con el permiso de la
   persona, se arma EXACTAMENTE lo mismo que sale de importar el export de Apple Salud (`lib/metricas/leeAppleSalud.js`: entrenos preparados + recuperación diaria) y se guarda con el
   mismo camino (`guardaImportacion`): así las métricas del atleta y las de su coach no se enteran de si vinieron de un archivo o del teléfono. Los entrenos que ya estaban no se repiten.

   Solo funciona dentro de la app de iPhone (en la web no hay HealthKit): `saludDisponible()` lo dice. */

import { Capacitor } from '@capacitor/core';
import { preparaEntreno } from './metricas/construye.js';
import { deporteDeApple } from './metricas/deportes.js';

export const saludDisponible = () => Capacitor.isNativePlatform();

const LEER = ['heartRate', 'restingHeartRate', 'heartRateVariability', 'sleep', 'steps', 'calories', 'distance', 'vo2Max', 'oxygenSaturation', 'respiratoryRate', 'weight', 'workouts'];

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
  for (let i = 0; i < workouts.length; i += 1) {
    const w = workouts[i];
    alAvance(`Leyendo el pulso de tus entrenos (${i + 1} de ${workouts.length})…`);
    const inicio = new Date(w.startDate).getTime();
    const finMs = new Date(w.endDate).getTime();
    const pulso = await Health.readSamples({ dataType: 'heartRate', startDate: w.startDate, endDate: w.endDate, limit: 8000, ascending: true }).then((r) => r?.samples ?? [], () => []);
    const muestras = pulso.map((s) => ({ t: (new Date(s.startDate).getTime() - inicio) / 1000, fc: Math.round(s.value) })).filter((m) => m.t >= 0 && m.fc > 30 && m.fc < 240);
    const fcs = muestras.map((m) => m.fc);
    const duracion = Math.round(w.duration > 0 ? w.duration : (finMs - inicio) / 1000);
    entrenos.push(preparaEntreno({
      formato: 'apple_salud', deporte: deporteDeApple(tipoDeApple(w.workoutType)), deporte_original: tipoDeApple(w.workoutType), titulo: null, dispositivo: w.sourceName ?? null,
      inicio, fin: finMs, desfase_min: desfase, duracion_s: duracion, movimiento_s: null,
      distancia_m: w.totalDistance > 0 ? Math.round(w.totalDistance) : null,
      kcal_activas: w.totalEnergyBurned > 0 ? Math.round(w.totalEnergyBurned) : null,
      resumen: {
        fc_media: fcs.length ? Math.round(fcs.reduce((a, b) => a + b, 0) / fcs.length) : null,
        fc_max: fcs.length ? Math.max(...fcs) : null, fc_min: fcs.length ? Math.min(...fcs) : null, potencia_media: null,
      },
      ruta_ref: null, muestras, archivo: 'Apple Salud',
    }));
  }

  // Lo de cada día: pulso en reposo, HRV, sueño y pasos.
  alAvance('Leyendo tu recuperación…');
  const lee = async (dataType, limit = 3000) => { try { return (await Health.readSamples({ dataType, ...rango, limit, ascending: true }))?.samples ?? []; } catch { return []; } };
  const [reposo, hrv, sueno, pasos] = await Promise.all([lee('restingHeartRate'), lee('heartRateVariability'), lee('sleep', 6000), lee('steps', 20000)]);
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
