// Inventa 14 semanas de un corredor y las escribe como las entregaría el reloj, para probar la pantalla de métricas SIN tocar datos de nadie.
//
//   node scripts/genera-demo-metricas.mjs <carpeta de salida>
//
// Escribe en la carpeta:
//   export.zip        un export de Apple Salud (export.xml + rutas .gpx): ~65 entrenos con su pulso cada 5 s, y cada día reposo, HRV, sueño por etapas, pasos…
//   garmin-bici.fit   una salida en bici de un Garmin, de un día SIN entreno en el export (entra como nueva)
//   rodaje-repetido.gpx   el mismo rodaje de calidad del martes 6 de octubre que ya trae el export (debe salir «ya estaba»)
//   spinning.tcx      una clase en interiores de un domingo sin entreno en el export (entra como nueva)
//
// La historia que cuenta (para que las gráficas tengan algo que decir): 14 semanas que suben con una semana de descanso cada cuarta, una gripe en la
// semana 7 (tres días sin entrenar y el pulso en reposo arriba), un bloque fuerte al final con dos sesiones de calidad por semana, y los últimos 5 días con el
// pulso en reposo subiendo hasta 6 latidos, la HRV bajando y menos sueño: «entrena fuerte y su cuerpo ya lo está resintiendo».
// Todo sale de un generador con semilla fija: el mismo comando da siempre los mismos archivos.
import fs from 'node:fs';
import path from 'node:path';
import { zipSync, strToU8 } from 'fflate';
import { FitBaseType, FitEncoder } from 'fit-file-parser/encoder';

const salida = process.argv[2];
if (!salida) { console.error('Uso: node scripts/genera-demo-metricas.mjs <carpeta de salida>'); process.exit(1); }
fs.mkdirSync(salida, { recursive: true });

/* ---- números repetibles ---- */
function semilla(n) { let a = n >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
const azar = semilla(1013);
const entre = (a, b) => a + (b - a) * azar();
const redondea = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d;

/* ---- fechas: todo en hora local con desfase −05:00 ---- */
const DESFASE = '-0500';
const MIN_DESFASE = -300;
const dia = (d0, n) => new Date(Date.UTC(+d0.slice(0, 4), +d0.slice(5, 7) - 1, +d0.slice(8, 10) + n)).toISOString().slice(0, 10);
const diaSemana = (d) => new Date(`${d}T12:00:00Z`).getUTCDay();   // 0 domingo … 6 sábado
const p2 = (n) => String(n).padStart(2, '0');
/** «2026-10-06 07:30:15 -0500» desde un día y los segundos del día local. */
const fecha = (d, s) => { const x = Math.round(s); return `${d} ${p2(Math.floor(x / 3600) % 24)}:${p2(Math.floor((x % 3600) / 60))}:${p2(x % 60)} ${DESFASE}`; };
const aUtcMs = (d, s) => Date.parse(`${d}T00:00:00Z`) + s * 1000 - MIN_DESFASE * 60000;
const isoUtc = (d, s) => new Date(aUtcMs(d, s)).toISOString().replace('.000Z', 'Z');
const hora = (h, m = 0) => h * 3600 + m * 60;

const INICIO = '2026-07-06';          // lunes, semana 1
const FIN = '2026-10-09';              // viernes de la semana 14: el último día completo
const HOY = '2026-10-10';              // sábado: la noche de ayer ya está medida
const semanas = 14;
const FACTOR = [0.8, 0.9, 1.0, 0.7, 1.0, 1.1, 1.0, 0.8, 1.2, 1.3, 1.4, 0.8, 1.45, 1.55];   // cuánto entrena cada semana
const GRIPE = new Set(['2026-08-18', '2026-08-19', '2026-08-20']);                             // semana 7: martes a jueves
// Qué tan cansado va el cuerpo cada uno de los últimos días (0 a 1): el pulso en reposo sube, la HRV y el sueño bajan.
const CANSANCIO = { '2026-10-05': 0.15, '2026-10-06': 0.35, '2026-10-07': 0.6, '2026-10-08': 0.8, '2026-10-09': 1, [HOY]: 1 };

/* ---- el pulso de un entreno ---- */
const PERFIL = { fcMax: 188, reposo: 52 };
/** Devuelve la función `fc(t)` (t en segundos) de un tipo de entreno. Un paseo aleatorio suave le da naturalidad. */
function curvaDePulso(tipo, dur) {
  let ruido = 0;
  const paso = () => { ruido = ruido * 0.9 + (azar() - 0.5) * 3.2; return ruido; };
  const base = {
    facil: (t) => { const sube = Math.min(1, t / 300); return 100 + (140 - 100) * sube + (t / dur) * 8; },
    calidad: (t) => {
      if (t < 600) return 100 + 40 * Math.min(1, t / 300);               // calentamiento
      const q = t - 600;
      if (q < 4 * 480) return q % 480 < 360 ? 150 + 20 * Math.min(1, (q % 480) / 60) : 140;   // 4 × (6 min fuertes, 2 de trote)
      return 130 - 20 * Math.min(1, (q - 4 * 480) / 400);               // enfriamiento
    },
    largo: (t) => 100 + 42 * Math.min(1, t / 420) + (t / dur) * 14,
    bici: (t) => 105 + 28 * Math.min(1, t / 300) + 6 * Math.sin(t / 240),
    fuerza: (t) => 98 + 12 * Math.sin(t / 95) + 8 * Math.sin(t / 31) + (t / dur) * 6,
    caminar: (t) => 92 + 10 * Math.min(1, t / 240),
  }[tipo];
  return (t) => Math.max(60, Math.min(PERFIL.fcMax, Math.round(base(t) + paso())));
}

/* ---- la ruta: una vuelta por un parque, recorrida por LONGITUD de arco (así la velocidad que se ve en el mapa es la verdadera) ---- */
const CENTRO = { lat: 19.4203, lon: -99.1925 };
const LAZO = (() => {
  const N = 4000;
  const pts = [];
  let largo = 0;
  for (let i = 0; i <= N; i += 1) {
    const a = (i / N) * 2 * Math.PI;
    const rx = 430 + 25 * Math.sin(3 * a);
    const ry = 260 + 20 * Math.cos(2 * a);
    const p = { x: rx * Math.cos(a), y: ry * Math.sin(a), alt: 2240 + 9 * Math.sin(a * 2) + 4 * Math.sin(a * 5) };
    if (i) largo += Math.hypot(p.x - pts[i - 1].x, p.y - pts[i - 1].y);
    pts.push({ ...p, s: largo });
  }
  return { pts, largo };
})();
function puntoDeRuta(metros) {
  const s = metros % LAZO.largo;
  let lo = 0;
  let hi = LAZO.pts.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (LAZO.pts[mid].s <= s) lo = mid; else hi = mid; }
  const p = LAZO.pts[lo];
  const q = LAZO.pts[hi];
  const f = (s - p.s) / (q.s - p.s || 1);
  const x = p.x + (q.x - p.x) * f + entre(-1.2, 1.2);   // un poco de «ruido» del GPS
  const y = p.y + (q.y - p.y) * f + entre(-1.2, 1.2);
  return { lat: CENTRO.lat + y / 111195, lon: CENTRO.lon + x / (111195 * Math.cos((CENTRO.lat * Math.PI) / 180)), alt: p.alt + (q.alt - p.alt) * f };
}
/** La velocidad de cada instante (m/s) de una carrera: más rápida cuando el pulso sube. Se escala para que la distancia total sea justo la del resumen. */
function velocidades(serie, km) {
  const perfil = serie.map((hr) => 0.78 + 0.34 * Math.min(1.1, Math.max(0, (hr - 110) / 62)));
  const suma = perfil.reduce((acc, v) => acc + v, 0) * 5;
  const escala = (km * 1000) / suma;
  return perfil.map((v) => v * escala);
}

/* ---- los entrenos de cada día ---- */
const entrenos = [];   // { dia, sIni, dur, tipo, apple, fuerzaConPulso, km, ruta }
function planDeLaSemana(w) {
  const f = FACTOR[w];
  const m = (min) => Math.round((min * f) / 5) * 5 * 60;
  // día de la semana → entreno
  const largoMin = 62 + 4 * w;
  return {
    1: { tipo: 'fuerza', dur: Math.round((50 * Math.min(f, 1.2)) / 5) * 5 * 60, apple: 'TraditionalStrengthTraining', salida: hora(18, 30), fuerzaConPulso: w % 3 !== 1 },
    2: { tipo: 'calidad', dur: 50 * 60, apple: 'Running', salida: hora(6, 30), km: 9.8, ritmo: 4.9, ruta: true },
    3: w % 2 === 0 || w >= 12
      ? { tipo: 'facil', dur: m(46), apple: 'Running', salida: hora(6, 45), ritmo: 6.0, ruta: true }
      : { tipo: 'bici', dur: m(65), apple: 'Cycling', salida: hora(6, 30), ritmo: 2.4, ruta: false },
    // En el bloque fuerte de las dos últimas semanas el jueves es otra sesión de calidad.
    4: w >= 12
      ? { tipo: 'calidad', dur: 46 * 60, apple: 'Running', salida: hora(6, 30), km: 8.2, ruta: true }
      : { tipo: 'fuerza', dur: m(42), apple: 'FunctionalStrengthTraining', salida: hora(18, 45), fuerzaConPulso: w % 2 === 0 },
    5: w >= 8
      ? { tipo: 'facil', dur: Math.round((40 * Math.min(f, 1.2)) / 5) * 5 * 60, apple: 'Running', salida: hora(17, 45), ritmo: 5.9, ruta: true }
      : w % 3 === 0 ? { tipo: 'caminar', dur: 35 * 60, apple: 'Walking', salida: hora(13, 0), ritmo: 11, ruta: false } : null,
    6: { tipo: 'largo', dur: Math.round((largoMin * Math.min(1.15, 0.85 + f * 0.18)) / 5) * 5 * 60, apple: 'Running', salida: hora(6, 15), ritmo: 6.1, ruta: true },
    0: w % 2 === 0 ? { tipo: 'bici', dur: m(80), apple: 'Cycling', salida: hora(8, 0), ritmo: 2.3, ruta: false } : { tipo: 'caminar', dur: 60 * 60, apple: 'Hiking', salida: hora(9, 0), ritmo: 12, ruta: false },
  };
}
for (let w = 0; w < semanas; w += 1) {
  const plan = planDeLaSemana(w);
  for (let i = 0; i < 7; i += 1) {
    const d = dia(INICIO, w * 7 + i);
    if (d > FIN) continue;
    if (GRIPE.has(d)) continue;
    const e = plan[diaSemana(d)];
    if (!e) continue;
    if (w < 12 && azar() < 0.05) continue;            // un día que se saltó (menos en el bloque final, para que la historia no dependa del azar)
    const dur = Math.round(e.dur * entre(0.96, 1.04));
    const ritmo = e.ritmo ?? 0;
    const km = e.km ?? (ritmo ? (e.tipo === 'bici' ? (dur / 3600) * 27 * (e.ritmo / 2.4) : dur / 60 / (ritmo * (e.tipo === 'largo' ? 1 : 1))) : null);
    entrenos.push({ ...e, dia: d, dur, sIni: e.salida + Math.round(entre(-300, 300)), km: km ? redondea(km * entre(0.97, 1.03), 2) : null });
  }
}

/* ---- el export.xml ---- */
const lineas = [];
const Q = 'HKQuantityTypeIdentifier';
const rec = (tipo, fuente, unidad, d, s0, s1, valor) =>
  ` <Record type="${tipo}" sourceName="${fuente}" sourceVersion="10.6" unit="${unidad}" creationDate="${fecha(d, s1)}" startDate="${fecha(d, s0)}" endDate="${fecha(d, s1)}" value="${valor}"/>`;
const FUENTE = 'Apple Watch de Daniel';
lineas.push('<?xml version="1.0" encoding="UTF-8"?>');
lineas.push('<!DOCTYPE HealthData [\n<!ELEMENT HealthData (ExportDate,Me,(Record|Correlation|Workout|ActivitySummary)*)>\n<!ATTLIST HealthData locale CDATA #REQUIRED>\n]>');
lineas.push('<HealthData locale="es_MX">');
lineas.push(` <ExportDate value="${fecha(HOY, hora(8))}"/>`);
lineas.push(' <Me HKCharacteristicTypeIdentifierDateOfBirth="1995-06-01" HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexMale" HKCharacteristicTypeIdentifierBloodType="HKBloodTypeNotSet"/>');

const rutas = {};                                    // nombre de archivo → texto GPX
const nombreDeRuta = (d, s) => `route_${d}_${Math.floor(s / 3600) % 12 || 12}.${p2(Math.floor((s % 3600) / 60))}${Math.floor(s / 3600) < 12 ? 'am' : 'pm'}.gpx`;
const gpxDe = (e, nombre, serie) => {
  const pts = [];
  const vel = velocidades(serie, e.km);
  let metros = 0;
  for (let t = 0; t <= e.dur; t += 5) {
    const i = Math.min(vel.length - 1, t / 5);
    const p = puntoDeRuta(metros);
    pts.push(`<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><ele>${p.alt.toFixed(1)}</ele><time>${isoUtc(e.dia, e.sIni + t)}</time><extensions><speed>${vel[i].toFixed(2)}</speed></extensions></trkpt>`);
    metros += vel[i] * 5;
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<gpx version="1.1" creator="Apple Health Export" xmlns="http://www.topografix.com/GPX/1/1"><metadata><time>${isoUtc(e.dia, e.sIni)}</time></metadata><trk><name>${nombre}</name><trkseg>${pts.join('')}</trkseg></trk></gpx>`;
};

const pulsosGuardados = new Map();                   // para repetir el rodaje en el .gpx suelto
for (const e of entrenos) {
  const fc = curvaDePulso(e.tipo, e.dur);
  const conPulso = e.tipo !== 'fuerza' || e.fuerzaConPulso;
  const serie = [];
  if (conPulso) {
    for (let t = 0; t <= e.dur; t += 5) {
      const v = fc(t);
      serie.push(v);
      lineas.push(rec(`${Q}HeartRate`, FUENTE, 'count/min', e.dia, e.sIni + t, e.sIni + t, v));
    }
  }
  pulsosGuardados.set(e, serie);
  const fcs = serie.length ? { media: Math.round(serie.reduce((s, x) => s + x, 0) / serie.length), max: Math.max(...serie), min: Math.min(...serie) } : null;
  const kcal = redondea((e.dur / 60) * ({ calidad: 12.5, facil: 10.5, largo: 11, bici: 9, fuerza: 6.5, caminar: 5 }[e.tipo] ?? 8) * entre(0.92, 1.08));
  const ruta = e.ruta ? nombreDeRuta(e.dia, e.sIni) : null;
  if (ruta) rutas[ruta] = gpxDe(e, `Ruta ${e.dia}`, serie);
  const dist = e.km ? ` totalDistance="${e.km}" totalDistanceUnit="km"` : '';
  lineas.push(` <Workout workoutActivityType="HKWorkoutActivityType${e.apple}" duration="${(e.dur / 60).toFixed(4)}" durationUnit="min"${dist} totalEnergyBurned="${kcal}" totalEnergyBurnedUnit="kcal" sourceName="${FUENTE}" sourceVersion="10.6" device="&lt;&lt;HKDevice: 0x3&gt;, name:Apple Watch, manufacturer:Apple Inc., model:Watch, hardware:Watch6,2, software:10.6&gt;" creationDate="${fecha(e.dia, e.sIni + e.dur + 5)}" startDate="${fecha(e.dia, e.sIni)}" endDate="${fecha(e.dia, e.sIni + e.dur)}">`);
  lineas.push(`  <MetadataEntry key="HKIndoorWorkout" value="${e.ruta || e.tipo === 'caminar' ? 0 : 1}"/>`);
  if (fcs) lineas.push(`  <WorkoutStatistics type="${Q}HeartRate" startDate="${fecha(e.dia, e.sIni)}" endDate="${fecha(e.dia, e.sIni + e.dur)}" average="${fcs.media}" minimum="${fcs.min}" maximum="${fcs.max}" unit="count/min"/>`);
  if (e.km) lineas.push(`  <WorkoutStatistics type="${Q}Distance${e.tipo === 'bici' ? 'Cycling' : 'WalkingRunning'}" startDate="${fecha(e.dia, e.sIni)}" endDate="${fecha(e.dia, e.sIni + e.dur)}" sum="${e.km}" unit="km"/>`);
  if (ruta) {
    lineas.push(`  <WorkoutRoute sourceName="${FUENTE}" sourceVersion="10.6" creationDate="${fecha(e.dia, e.sIni + e.dur + 5)}" startDate="${fecha(e.dia, e.sIni)}" endDate="${fecha(e.dia, e.sIni + e.dur)}">`);
    lineas.push(`   <FileReference path="/workout-routes/${ruta}"/>`);
    lineas.push('  </WorkoutRoute>');
  }
  lineas.push(' </Workout>');
  e.ruta_nombre = ruta;
}

/* ---- cada día: reposo, HRV, pasos, calorías, VO₂, oxígeno, respiración, peso y el sueño de la noche ---- */
const dias = [];
for (let n = 0; ; n += 1) { const d = dia(INICIO, n); if (d > HOY) break; dias.push(d); }
dias.forEach((d, n) => {
  const progreso = n / dias.length;
  const gripe = GRIPE.has(d) || GRIPE.has(dia(d, -1));
  const k = CANSANCIO[d] ?? 0;
  const reposo = Math.round(54 - 3 * progreso + (gripe ? 7 : 0) + 6 * k + entre(-1.0, 1.0));
  const hrv = Math.round((60 + 6 * progreso) * (gripe ? 0.72 : 1 - 0.14 * k) + entre(-3.5, 3.5));
  lineas.push(rec(`${Q}RestingHeartRate`, FUENTE, 'count/min', d, hora(0), hora(23, 59), reposo));
  [3, 4, 5].forEach((h) => lineas.push(rec(`${Q}HeartRateVariabilitySDNN`, FUENTE, 'ms', d, hora(h), hora(h, 1), Math.max(18, hrv + Math.round(entre(-5, 5))))));
  const entrenoHoy = entrenos.find((e) => e.dia === d);
  const pasos = Math.round((entrenoHoy?.tipo === 'caminar' ? 13000 : entrenoHoy ? 9500 : 6200) * entre(0.8, 1.15));
  lineas.push(rec(`${Q}StepCount`, FUENTE, 'count', d, hora(9), hora(12), Math.round(pasos * 0.55)));
  lineas.push(rec(`${Q}StepCount`, FUENTE, 'count', d, hora(15), hora(19), Math.round(pasos * 0.45)));
  lineas.push(rec(`${Q}StepCount`, 'iPhone de Daniel', 'count', d, hora(9), hora(12), Math.round(pasos * 0.5)));
  lineas.push(rec(`${Q}ActiveEnergyBurned`, FUENTE, 'Cal', d, hora(8), hora(20), Math.round((entrenoHoy ? 620 : 330) * entre(0.85, 1.15))));
  if (n % 6 === 0) lineas.push(rec(`${Q}VO2Max`, FUENTE, 'mL/min·kg', d, hora(7), hora(7, 40), redondea(44 + 2.8 * progreso + entre(-0.3, 0.3), 1)));
  lineas.push(rec(`${Q}OxygenSaturation`, FUENTE, '%', d, hora(3), hora(3, 1), redondea(0.97 + entre(-0.012, 0.012), 3)));
  lineas.push(rec(`${Q}RespiratoryRate`, FUENTE, 'count/min', d, hora(3), hora(3, 1), redondea(14.8 + (gripe ? 1.6 : 0) + entre(-0.6, 0.6), 1)));
  if (n % 7 === 0) lineas.push(rec(`${Q}BodyMass`, 'Báscula', 'kg', d, hora(7), hora(7, 1), redondea(71.4 - 0.8 * progreso + entre(-0.2, 0.2), 1)));

  // El sueño de la noche que termina esta mañana (cuenta para el día d).
  const horas = 7.4 - 1.0 * k + entre(-0.55, 0.65) + (gripe ? 0.8 : 0);
  const total = Math.round(horas * 3600);
  const acuesta = hora(23, 10) + Math.round(entre(-1800, 1800)) - 86400;        // anoche
  const dAnt = dia(d, -1);
  // Los segundos negativos son «anoche»: se cuentan hacia atrás desde la medianoche de la mañana en que despierta.
  const fechaDeSueno = (s) => (s < 0 ? fecha(dAnt, s + 86400) : fecha(d, s));
  const suenoAbs = (valor, fuente, s0, s1) => ` <Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="${fuente}" sourceVersion="10.6" creationDate="${fechaDeSueno(s1)}" startDate="${fechaDeSueno(s0)}" endDate="${fechaDeSueno(s1)}" value="HKCategoryValueSleepAnalysis${valor}"/>`;
  lineas.push(suenoAbs('InBed', 'iPhone de Daniel', acuesta - 600, acuesta + total + 900));
  let t = acuesta;
  const fin = acuesta + total;
  let ciclo = 0;
  while (t < fin - 600) {
    const profundo = Math.round((ciclo < 2 ? 2400 : 1200) * entre(0.7, 1.2));
    const rem = Math.round((600 + ciclo * 500) * entre(0.7, 1.2));
    const ligero1 = Math.round(2400 * entre(0.7, 1.2));
    const ligero2 = Math.round(1200 * entre(0.7, 1.2));
    const despierto = azar() < 0.4 ? Math.round(entre(180, 600)) : 0;
    for (const [valor, dur] of [['AsleepCore', ligero1], ['AsleepDeep', profundo], ['AsleepCore', ligero2], ['AsleepREM', rem], ['Awake', despierto]]) {
      if (!dur) continue;
      const hasta = Math.min(fin, t + dur);
      if (hasta - t < 60) break;
      lineas.push(suenoAbs(valor, FUENTE, t, hasta));
      t = hasta;
    }
    ciclo += 1;
  }
});
lineas.push('</HealthData>');
const xml = lineas.join('\n');

/* ---- el ZIP, como lo entrega la app Salud ---- */
const contenido = { 'apple_health_export/export.xml': strToU8(xml) };
Object.entries(rutas).forEach(([n, t]) => { contenido[`apple_health_export/workout-routes/${n}`] = strToU8(t); });
fs.writeFileSync(path.join(salida, 'export.zip'), zipSync(contenido, { level: 6 }));

/* ---- el rodaje del martes 6 de octubre otra vez, como lo bajaría de Strava (para probar que no se duplica) ---- */
const rodaje = entrenos.find((e) => e.dia === '2026-10-06' && e.apple === 'Running');
if (rodaje) {
  const serie = pulsosGuardados.get(rodaje);
  const vel = velocidades(serie, rodaje.km);
  let metros = 0;
  const pts = [];
  for (let t = 0; t <= rodaje.dur; t += 5) {
    const i = Math.min(vel.length - 1, t / 5);
    const p = puntoDeRuta(metros);
    pts.push(`<trkpt lat="${p.lat.toFixed(6)}" lon="${p.lon.toFixed(6)}"><ele>${p.alt.toFixed(1)}</ele><time>${isoUtc(rodaje.dia, rodaje.sIni + t)}</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${serie[i]}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`);
    metros += vel[i] * 5;
  }
  fs.writeFileSync(path.join(salida, 'rodaje-repetido.gpx'), `<?xml version="1.0" encoding="UTF-8"?>\n<gpx creator="Strava" version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1"><metadata><time>${isoUtc(rodaje.dia, rodaje.sIni)}</time></metadata><trk><name>Calidad: 4 x 6 min</name><type>running</type><trkseg>${pts.join('')}</trkseg></trk></gpx>`);
}

/* ---- una salida en bici de un Garmin (.fit) un viernes sin entreno en el export ---- */
{
  const T = FitBaseType;
  const TAM = { [T.Enum]: 1, [T.Uint8]: 1, [T.Uint16]: 2, [T.Uint32]: 4, [T.Sint32]: 4 };
  const campo = (number, baseType, value) => ({ number, baseType, value, size: TAM[baseType] });
  const semicirculos = (g) => Math.round(g * (2 ** 31 / 180));
  const d = '2026-10-02';                            // viernes
  const sIni = hora(7, 10);
  const dur = 62 * 60;
  const enc = new FitEncoder();
  const ts = (s) => FitEncoder.toFitTimestamp(new Date(aUtcMs(d, sIni + s)));
  enc.writeMessage(0, [campo(0, T.Enum, 4), campo(1, T.Uint16, 1), campo(4, T.Uint32, ts(0))]);
  const fc = curvaDePulso('bici', dur);
  let metros = 0;
  for (let t = 0; t <= dur; t += 2) {
    const v = 7.4 + 2.2 * Math.sin(t / 300) + entre(-0.4, 0.4);   // m/s
    metros += v * 2;
    const p = puntoDeRuta(metros * 0.55);
    enc.writeMessage(20, [
      campo(253, T.Uint32, ts(t)), campo(3, T.Uint8, fc(t)),
      campo(0, T.Sint32, semicirculos(p.lat)), campo(1, T.Sint32, semicirculos(p.lon)), campo(2, T.Uint16, Math.round((p.alt + 500) * 5)),
      campo(4, T.Uint8, Math.round(84 + 6 * Math.sin(t / 130))), campo(5, T.Uint32, Math.round(metros * 100)), campo(6, T.Uint16, Math.round(v * 1000)), campo(7, T.Uint16, Math.round(185 + 45 * Math.sin(t / 300))),
    ]);
  }
  enc.writeMessage(18, [
    campo(253, T.Uint32, ts(dur)), campo(2, T.Uint32, ts(0)), campo(5, T.Enum, 2), campo(6, T.Enum, 0),
    campo(7, T.Uint32, dur * 1000), campo(8, T.Uint32, (dur - 20) * 1000), campo(9, T.Uint32, Math.round(metros * 100)), campo(11, T.Uint16, 640),
    campo(16, T.Uint8, 139), campo(17, T.Uint8, 168),
  ]);
  enc.writeMessage(34, [campo(253, T.Uint32, ts(dur)), campo(0, T.Uint32, dur * 1000), campo(1, T.Uint16, 1), campo(2, T.Enum, 0), campo(5, T.Uint32, ts(dur) + MIN_DESFASE * 60)]);
  fs.writeFileSync(path.join(salida, 'garmin-bici.fit'), enc.close());
}

/* ---- una clase en interiores (.tcx) un domingo sin entreno en el export ---- */
{
  const d = '2026-09-27';                            // domingo
  const sIni = hora(8, 30);
  const dur = 45 * 60;
  const fc = curvaDePulso('bici', dur);
  const tps = [];
  let metros = 0;
  for (let t = 0; t <= dur; t += 5) {
    metros += 7.8 * 5;
    tps.push(`<Trackpoint><Time>${isoUtc(d, sIni + t)}</Time><DistanceMeters>${Math.round(metros)}</DistanceMeters><HeartRateBpm><Value>${fc(t) + 12}</Value></HeartRateBpm><Cadence>${Math.round(88 + 8 * Math.sin(t / 60))}</Cadence><Extensions><ns3:TPX><ns3:Watts>${Math.round(170 + 60 * Math.sin(t / 200))}</ns3:Watts></ns3:TPX></Extensions></Trackpoint>`);
  }
  fs.writeFileSync(path.join(salida, 'spinning.tcx'), `<?xml version="1.0" encoding="UTF-8"?>\n<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Biking"><Id>${isoUtc(d, sIni)}</Id><Lap StartTime="${isoUtc(d, sIni)}"><TotalTimeSeconds>${dur}</TotalTimeSeconds><DistanceMeters>${Math.round(metros)}</DistanceMeters><Calories>480</Calories><AverageHeartRateBpm><Value>148</Value></AverageHeartRateBpm><MaximumHeartRateBpm><Value>176</Value></MaximumHeartRateBpm><Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod><Track>${tps.join('')}</Track></Lap></Activity></Activities><Author><Name>Wahoo KICKR</Name></Author></TrainingCenterDatabase>`);
}

const kb = (f) => `${Math.round(fs.statSync(path.join(salida, f)).size / 1024)} KB`;
console.log(`entrenos en el export: ${entrenos.length} (${entrenos.filter((e) => e.ruta_nombre).length} con ruta)`);
console.log(`dias con recuperación: ${dias.length}`);
for (const f of ['export.zip', 'garmin-bici.fit', 'rodaje-repetido.gpx', 'spinning.tcx']) console.log(`${f}: ${kb(f)}`);
console.log(`export.xml sin comprimir: ${Math.round(xml.length / 1024 / 1024 * 10) / 10} MB`);
