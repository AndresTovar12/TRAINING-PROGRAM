// Prueba de los lectores de archivos de entrenos (src/lib/metricas/leeXml.js, leeFit.js, leeAppleSalud.js, leeArchivos.js) con archivos INVENTADOS:
// GPX, TCX, FIT (hecho con el codificador de la propia librería), el export de Apple Salud en trozos que cortan las etiquetas, ZIP y GZIP.
//
//   node scripts/prueba-metricas-lectura.mjs
import assert from 'node:assert/strict';
import { FitBaseType, FitEncoder } from 'fit-file-parser/encoder';
import { leeGpx, leeTcx, esExportDeAppleSalud } from '../src/lib/metricas/leeXml.js';
import { leeFit } from '../src/lib/metricas/leeFit.js';
import { creaLectorDeAppleSalud, leeAppleSalud, unePorRutas, fechaDeApple } from '../src/lib/metricas/leeAppleSalud.js';

const casi = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} esperaba ${b} ± ${tol}, salió ${a}`);
const mPorGradoLon = 111195 * Math.cos((19.4 * Math.PI) / 180);

/* ---- GPX ---- */
{
  const punto = (t, extra = '') => {
    const ms = Date.parse('2026-10-01T14:00:00Z') + t * 1000;
    const lon = -99.1 + (3 * t) / mPorGradoLon;
    return `<trkpt lat="19.4" lon="${lon.toFixed(6)}"><ele>${(2240 + t / 20).toFixed(1)}</ele><time>${new Date(ms).toISOString()}</time>${extra}</trkpt>`;
  };
  const conPulso = (t) => punto(t, `<extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${140 + Math.floor(t / 30)}</gpxtpx:hr><gpxtpx:cad>82</gpxtpx:cad></gpxtpx:TrackPointExtension></extensions>`);
  const envoltura = (trks) => `<?xml version="1.0" encoding="UTF-8"?>
<gpx creator="Garmin Connect" version="1.1" xmlns="http://www.topografix.com/GPX/1/1" xmlns:gpxtpx="http://www.garmin.com/xmlschemas/TrackPointExtension/v1">
<metadata><time>2026-10-01T14:00:00Z</time></metadata>${trks}</gpx>`;
  const trk = (nombre, tipo, puntos) => `<trk><name>${nombre}</name><type>${tipo}</type><trkseg>${puntos.join('\n')}</trkseg></trk>`;
  const r = leeGpx(envoltura(trk('Rodaje &amp; cuestas', 'running', Array.from({ length: 601 }, (_, t) => conPulso(t)))));
  assert.equal(r.length, 1);
  const a = r[0];
  assert.equal(a.formato, 'gpx');
  assert.equal(a.deporte, 'correr');
  assert.equal(a.deporte_original, 'running');
  assert.equal(a.titulo, 'Rodaje & cuestas', 'las entidades se decodifican');
  assert.equal(a.dispositivo, 'Garmin Connect');
  assert.equal(a.inicio, Date.parse('2026-10-01T14:00:00Z'));
  assert.equal(a.fin - a.inicio, 600000);
  assert.equal(a.duracion_s, 600);
  assert.equal(a.muestras.length, 601);
  assert.equal(a.muestras[0].t, 0);
  assert.equal(a.muestras[600].t, 600);
  assert.equal(a.muestras[0].fc, 140);
  assert.equal(a.muestras[600].fc, 160);
  assert.equal(a.muestras[0].cad, 82);
  assert.equal(a.muestras[0].lat, 19.4);
  casi(a.muestras[0].alt, 2240, 0.01);
  // Sin pulso: las muestras solo traen ruta y altura.
  const sinPulso = leeGpx(envoltura(trk('Paseo', 'walking', Array.from({ length: 50 }, (_, t) => punto(t))))) [0];
  assert.equal(sinPulso.deporte, 'caminar');
  assert.equal(sinPulso.muestras[0].fc, undefined);
  // Dos recorridos en un archivo = dos entrenos; uno sin hora o con un solo punto no es un entreno.
  assert.equal(leeGpx(envoltura(trk('A', 'running', [punto(0), punto(60)]) + trk('B', 'cycling', [punto(100), punto(160)]))).length, 2);
  assert.equal(leeGpx(envoltura(trk('Un punto', 'running', [punto(0)]))).length, 0);
  assert.equal(leeGpx(envoltura('<trk><trkseg><trkpt lat="1" lon="2"><ele>3</ele></trkpt><trkpt lat="1" lon="2"><ele>3</ele></trkpt></trkseg></trk>')).length, 0, 'sin hora no hay entreno');
  assert.equal(leeGpx('<gpx><rte><rtept lat="1" lon="2"/></rte></gpx>').length, 0);
  assert.equal(leeGpx('basura').length, 0);
  // Un punto que se cierra solo (`<trkpt .../>`) no rompe la lectura de los demás.
  const raro = leeGpx(envoltura(trk('Raro', 'running', [punto(0), '<trkpt lat="19.4" lon="-99.1"/>', punto(30), punto(60)])));
  assert.equal(raro[0].muestras.length, 3);
  // Los puntos desordenados se ordenan por hora.
  const desorden = leeGpx(envoltura(trk('Desorden', 'running', [punto(60), punto(0), punto(30)])))[0];
  assert.deepEqual(desorden.muestras.map((x) => x.t), [0, 30, 60]);
}

/* ---- TCX ---- */
{
  const tp = (t, d, fc) => `<Trackpoint><Time>${new Date(Date.parse('2026-10-02T13:00:00Z') + t * 1000).toISOString()}</Time><Position><LatitudeDegrees>19.4</LatitudeDegrees><LongitudeDegrees>-99.1</LongitudeDegrees></Position><AltitudeMeters>2240.0</AltitudeMeters><DistanceMeters>${d}</DistanceMeters><HeartRateBpm><Value>${fc}</Value></HeartRateBpm><Cadence>85</Cadence><Extensions><ns3:TPX><ns3:Speed>7.5</ns3:Speed><ns3:Watts>210</ns3:Watts></ns3:TPX></Extensions></Trackpoint>`;
  const lap = (inicio, seg, dist, cal, fc, fcmax, tps) => `<Lap StartTime="${inicio}"><TotalTimeSeconds>${seg}</TotalTimeSeconds><DistanceMeters>${dist}</DistanceMeters><Calories>${cal}</Calories><AverageHeartRateBpm><Value>${fc}</Value></AverageHeartRateBpm><MaximumHeartRateBpm><Value>${fcmax}</Value></MaximumHeartRateBpm><Intensity>Active</Intensity><TriggerMethod>Manual</TriggerMethod><Track>${tps.join('')}</Track></Lap>`;
  const tcx = `<?xml version="1.0" encoding="UTF-8"?>
<TrainingCenterDatabase xmlns="http://www.garmin.com/xmlschemas/TrainingCenterDatabase/v2"><Activities><Activity Sport="Biking"><Id>2026-10-02T13:00:00Z</Id>
${lap('2026-10-02T13:00:00Z', 300, 2200, 90, 140, 155, [tp(0, 0, 130), tp(150, 1100, 145), tp(300, 2200, 155)])}
${lap('2026-10-02T13:05:00Z', 300, 2300, 95, 150, 162, [tp(301, 2200, 150), tp(450, 3350, 152), tp(600, 4500, 162)])}
</Activity></Activities><Author><Name>Garmin Edge 530</Name></Author><Creator><Name>Garmin Edge 530</Name></Creator></TrainingCenterDatabase>`;
  const r = leeTcx(tcx);
  assert.equal(r.length, 1);
  const a = r[0];
  assert.equal(a.formato, 'tcx');
  assert.equal(a.deporte, 'bici');
  assert.equal(a.deporte_original, 'Biking');
  assert.equal(a.dispositivo, 'Garmin Edge 530');
  assert.equal(a.inicio, Date.parse('2026-10-02T13:00:00Z'));
  assert.equal(a.duracion_s, 600);
  assert.equal(a.movimiento_s, 600);
  assert.equal(a.distancia_m, 4500);
  assert.equal(a.kcal_totales, 185, 'las calorías de un TCX son las totales de las vueltas');
  assert.equal(a.vueltas.length, 2);
  assert.deepEqual(a.vueltas.map((v) => [v.n, v.t0, v.dur, v.dist, v.fc, v.fcmax]), [[1, 0, 300, 2200, 140, 155], [2, 300, 300, 2300, 150, 162]]);
  assert.equal(a.vueltas[0].ritmo, 136, 'segundos por km de la vuelta: 300 s en 2.2 km');
  assert.equal(a.muestras.length, 6);
  assert.equal(a.muestras[0].fc, 130);
  assert.equal(a.muestras[5].dist, 4500);
  assert.equal(a.muestras[0].cad, 85);
  assert.equal(a.muestras[0].vel, 7.5);
  assert.equal(a.muestras[0].pot, 210);
  // Un TCX de cinta (vueltas sin puntos) sigue siendo un entreno.
  const cinta = `<TrainingCenterDatabase><Activities><Activity Sport="Running"><Id>2026-10-03T13:00:00Z</Id><Lap StartTime="2026-10-03T13:00:00Z"><TotalTimeSeconds>1800</TotalTimeSeconds><DistanceMeters>5000</DistanceMeters><Calories>320</Calories><AverageHeartRateBpm><Value>150</Value></AverageHeartRateBpm></Lap></Activity></Activities></TrainingCenterDatabase>`;
  const c = leeTcx(cinta)[0];
  assert.equal(c.duracion_s, 1800);
  assert.equal(c.distancia_m, 5000);
  assert.equal(c.muestras.length, 0);
  assert.equal(c.inicio, Date.parse('2026-10-03T13:00:00Z'));
  assert.equal(leeTcx('<TrainingCenterDatabase></TrainingCenterDatabase>').length, 0);
  assert.equal(leeTcx('').length, 0);
  assert.equal(leeTcx(tcx.replace('Sport="Biking"', 'Sport="Other"'))[0].deporte, 'otro');
}

/* ---- FIT (fabricado con el codificador de la propia librería) ---- */
const T = FitBaseType;
const TAM = { [T.Enum]: 1, [T.Uint8]: 1, [T.Uint16]: 2, [T.Uint32]: 4, [T.Sint32]: 4 };
const campo = (number, baseType, value) => ({ number, baseType, value, size: TAM[baseType] });
const semicirculos = (grados) => Math.round(grados * (2 ** 31 / 180));
/** Un FIT inventado. `sesiones`: [{ desde, hasta, sport, sub, conRuta, fc }] en segundos desde las 13:00 UTC del 3 de octubre de 2026. */
function fabricaFit({ sesiones, localMenos = 6 * 3600, sinSesion = false }) {
  const enc = new FitEncoder();
  const t0 = Date.parse('2026-10-03T13:00:00Z');
  const ts = (s) => FitEncoder.toFitTimestamp(new Date(t0 + s * 1000));
  enc.writeMessage(0, [campo(0, T.Enum, 4), campo(1, T.Uint16, 1), campo(4, T.Uint32, ts(0))]);
  sesiones.forEach((s) => {
    for (let t = s.desde; t <= s.hasta; t += s.paso ?? 1) {
      const c = [campo(253, T.Uint32, ts(t)), campo(3, T.Uint8, s.fc(t))];
      if (s.conRuta) {
        c.push(campo(0, T.Sint32, semicirculos(19.4)), campo(1, T.Sint32, semicirculos(-99.1 + (t - s.desde) * 3e-5)), campo(2, T.Uint16, (2240 + 500) * 5),
          campo(4, T.Uint8, 85), campo(5, T.Uint32, (t - s.desde) * 300), campo(6, T.Uint16, 3000), campo(7, T.Uint16, 210));
      }
      enc.writeMessage(20, c);
    }
    if (sinSesion) return;
    const dur = s.hasta - s.desde;
    if (s.conRuta) enc.writeMessage(19, [campo(253, T.Uint32, ts(s.hasta)), campo(2, T.Uint32, ts(s.desde)), campo(7, T.Uint32, dur * 1000), campo(8, T.Uint32, (dur - 2) * 1000), campo(9, T.Uint32, dur * 300), campo(15, T.Uint8, 146), campo(16, T.Uint8, 152)]);
    enc.writeMessage(18, [
      campo(253, T.Uint32, ts(s.hasta)), campo(2, T.Uint32, ts(s.desde)), campo(5, T.Enum, s.sport), campo(6, T.Enum, s.sub ?? 0),
      campo(7, T.Uint32, dur * 1000), campo(8, T.Uint32, (dur - 2) * 1000), ...(s.conRuta ? [campo(9, T.Uint32, dur * 300)] : []), campo(11, T.Uint16, 20 + dur / 10),
      campo(16, T.Uint8, 146), campo(17, T.Uint8, 152), ...(s.conRuta ? [campo(22, T.Uint16, 12), campo(23, T.Uint16, 3)] : []),
    ]);
  });
  const fin = Math.max(...sesiones.map((s) => s.hasta));
  enc.writeMessage(34, [campo(253, T.Uint32, ts(fin)), campo(0, T.Uint32, fin * 1000), campo(1, T.Uint16, sesiones.length), campo(2, T.Enum, 0), campo(5, T.Uint32, ts(fin) - localMenos)]);
  return enc.close();
}

{
  // Un rodaje de 2 minutos (sport 1 = running).
  const bytes = fabricaFit({ sesiones: [{ desde: 0, hasta: 120, sport: 1, conRuta: true, fc: (t) => 140 + Math.floor(t / 10) }] });
  const r = await leeFit(bytes);
  assert.equal(r.length, 1);
  const a = r[0];
  assert.equal(a.formato, 'fit');
  assert.equal(a.deporte, 'correr');
  assert.equal(a.dispositivo, 'Garmin');
  assert.equal(a.inicio, Date.parse('2026-10-03T13:00:00Z'));
  assert.equal(a.duracion_s, 120);
  assert.equal(a.movimiento_s, 118);
  assert.equal(a.distancia_m, 36000 / 100);
  assert.equal(a.kcal_totales, 32);
  assert.equal(a.desfase_min, -360, 'la hora local menos la UTC: −6 h');
  assert.deepEqual([a.resumen.fc_media, a.resumen.fc_max, a.resumen.desnivel_pos_m, a.resumen.desnivel_neg_m], [146, 152, 12, 3]);
  assert.equal(a.muestras.length, 121);
  assert.equal(a.muestras[0].t, 0);
  assert.equal(a.muestras[0].fc, 140);
  assert.equal(a.muestras[120].fc, 152);
  casi(a.muestras[0].lat, 19.4, 1e-5);
  casi(a.muestras[60].lon, -99.1 + 60 * 3e-5, 1e-5);
  assert.equal(a.muestras[0].alt, 2240);
  assert.equal(a.muestras[0].cad, 170, 'correr: la cadencia de un pie ×2 = pasos por minuto');
  assert.equal(a.muestras[0].pot, 210);
  assert.equal(a.muestras[60].dist, 180);
  assert.equal(a.muestras[0].vel, 3);
  assert.equal(a.vueltas.length, 1);
  assert.deepEqual([a.vueltas[0].n, a.vueltas[0].t0, a.vueltas[0].dur, a.vueltas[0].dist, a.vueltas[0].fc, a.vueltas[0].fcmax], [1, 0, 118, 360, 146, 152]);
  assert.equal(a.vueltas[0].ritmo, 328);
  assert.equal(a.metricas, null);

  // Fuerza (sport 10 = training, sub 20 = strength_training): solo pulso, una muestra cada 5 s. Nada de distancia ni de ruta.
  const f = (await leeFit(fabricaFit({ sesiones: [{ desde: 0, hasta: 300, paso: 5, sport: 10, sub: 20, fc: (t) => 110 + Math.floor((t % 60) / 2) }] })))[0];
  assert.equal(f.deporte, 'fuerza');
  assert.equal(f.deporte_original, 'training/strength_training');
  assert.equal(f.muestras.length, 61);
  assert.equal(f.distancia_m, null);
  assert.equal(f.muestras[0].lat, undefined);
  assert.equal(f.vueltas.length, 0);

  // Dos sesiones en un archivo (un triatlón): cada una se queda con SUS muestras.
  const dos = await leeFit(fabricaFit({ sesiones: [
    { desde: 0, hasta: 60, sport: 5, fc: () => 130 },   // natación
    { desde: 120, hasta: 180, sport: 2, fc: () => 150 }, // bici
  ] }));
  assert.equal(dos.length, 2);
  assert.deepEqual(dos.map((x) => x.deporte), ['natacion', 'bici']);
  assert.deepEqual(dos.map((x) => x.muestras.length), [61, 61]);
  assert.equal(dos[1].inicio, Date.parse('2026-10-03T13:02:00Z'));
  assert.equal(dos[1].muestras[0].fc, 150);
  assert.equal(dos[1].muestras[0].t, 0, 'el tiempo de cada entreno empieza en su propio inicio');

  // Sin mensaje de sesión (un archivo recortado): se hace un entreno con las muestras.
  const sin = await leeFit(fabricaFit({ sinSesion: true, sesiones: [{ desde: 0, hasta: 90, sport: 1, fc: () => 120 }] }));
  assert.equal(sin.length, 1);
  assert.equal(sin[0].deporte, 'otro');
  assert.equal(sin[0].duracion_s, 90);

  // Basura: un error que se le puede enseñar a la persona.
  await assert.rejects(() => leeFit(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])), /Ese archivo \.fit no se pudo leer/);
  await assert.rejects(() => leeFit(new Uint8Array(0)), /Ese archivo \.fit no se pudo leer/);
}

/* ---- Apple Salud (export.xml), en trozos que cortan las etiquetas ---- */
{
  // Las fechas de Apple traen su desfase: «−0600» es México.
  const f = fechaDeApple('2026-10-03 07:00:05 -0600');
  assert.equal(f.ms, Date.parse('2026-10-03T13:00:05Z'));
  assert.equal(f.dia, '2026-10-03');
  assert.equal(f.desfase, -360);
  assert.equal(fechaDeApple('2026-10-03 07:00:05 +0530').desfase, 330);
  assert.equal(fechaDeApple('basura'), null);

  const fecha = (dia, h, m, s) => `${dia} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} -0600`;
  const rec = (tipo, fuente, unidad, ini, fin, valor) => `<Record type="${tipo}" sourceName="${fuente}" sourceVersion="10.0" unit="${unidad}" creationDate="${fin}" startDate="${ini}" endDate="${fin}" value="${valor}"/>`;
  const Q = 'HKQuantityTypeIdentifier';
  const lineas = [];
  lineas.push('<?xml version="1.0" encoding="UTF-8"?>');
  lineas.push('<!DOCTYPE HealthData [\n<!ELEMENT HealthData (ExportDate,Me,(Record|Correlation|Workout|ActivitySummary)*)>\n<!ATTLIST HealthData locale CDATA #REQUIRED>\n]>');
  lineas.push('<HealthData locale="es_MX">');
  lineas.push(' <ExportDate value="2026-10-10 08:00:00 -0600"/>');
  lineas.push(' <Me HKCharacteristicTypeIdentifierDateOfBirth="1995-06-01" HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexMale" HKCharacteristicTypeIdentifierBloodType="HKBloodTypeNotSet"/>');
  // Un entreno de 30 min: latidos cada 5 s (361), y UN latido absurdo (255) que no debe contar.
  for (let s = 0; s <= 1800; s += 5) lineas.push(' ' + rec(`${Q}HeartRate`, 'Apple Watch de Andrés &amp; co', 'count/min', fecha('2026-10-03', 7, Math.floor(s / 60), s % 60), fecha('2026-10-03', 7, Math.floor(s / 60), s % 60), s === 100 ? 255 : 140 + Math.floor(s / 100)).replace('7:30:00', '7:30:00'));
  // Un latido de un día fuera del rango que se va a pedir, y uno suelto de la noche (fuera de todo entreno).
  lineas.push(' ' + rec(`${Q}HeartRate`, 'Apple Watch', 'count/min', fecha('2026-09-01', 8, 0, 0), fecha('2026-09-01', 8, 0, 0), 90));
  lineas.push(' ' + rec(`${Q}HeartRate`, 'Apple Watch', 'count/min', fecha('2026-10-03', 23, 0, 0), fecha('2026-10-03', 23, 0, 0), 60));
  // Recuperación de tres días.
  ['2026-10-01', '2026-10-02', '2026-10-03'].forEach((d, i) => {
    lineas.push(' ' + rec(`${Q}RestingHeartRate`, 'Apple Watch', 'count/min', fecha(d, 0, 0, 0), fecha(d, 23, 59, 0), 50 + i));
    lineas.push(' ' + rec(`${Q}HeartRateVariabilitySDNN`, 'Apple Watch', 'ms', fecha(d, 3, 0, 0), fecha(d, 3, 1, 0), 60 + i));
    lineas.push(' ' + rec(`${Q}HeartRateVariabilitySDNN`, 'Apple Watch', 'ms', fecha(d, 4, 0, 0), fecha(d, 4, 1, 0), 70 + i));
    lineas.push(' ' + rec(`${Q}HeartRateVariabilitySDNN`, 'Apple Watch', 'ms', fecha(d, 5, 0, 0), fecha(d, 5, 1, 0), 80 + i));
    lineas.push(' ' + rec(`${Q}StepCount`, 'Apple Watch', 'count', fecha(d, 9, 0, 0), fecha(d, 9, 30, 0), 4000));
    lineas.push(' ' + rec(`${Q}StepCount`, 'Apple Watch', 'count', fecha(d, 12, 0, 0), fecha(d, 12, 30, 0), 1000));
    lineas.push(' ' + rec(`${Q}StepCount`, 'iPhone', 'count', fecha(d, 9, 0, 0), fecha(d, 9, 30, 0), 3500));
    lineas.push(' ' + rec(`${Q}StepCount`, 'iPhone', 'count', fecha(d, 12, 0, 0), fecha(d, 12, 30, 0), 3500));
    lineas.push(' ' + rec(`${Q}ActiveEnergyBurned`, 'Apple Watch', 'Cal', fecha(d, 9, 0, 0), fecha(d, 9, 30, 0), 300));
    lineas.push(' ' + rec(`${Q}VO2Max`, 'Apple Watch', 'mL/min·kg', fecha(d, 9, 0, 0), fecha(d, 9, 30, 0), 45.04 + i));
    lineas.push(' ' + rec(`${Q}OxygenSaturation`, 'Apple Watch', '%', fecha(d, 3, 0, 0), fecha(d, 3, 1, 0), 0.97));
  });
  // El sueño del 2 al 3 de octubre: el reloj mide por etapas, el teléfono «en cama» y una noche encimada.
  const sueno = (valor, fuente, ini, fin) => `<Record type="HKCategoryTypeIdentifierSleepAnalysis" sourceName="${fuente}" sourceVersion="10.0" creationDate="${fin}" startDate="${ini}" endDate="${fin}" value="HKCategoryValueSleepAnalysis${valor}"/>`;
  lineas.push(' ' + sueno('InBed', 'iPhone', fecha('2026-10-02', 22, 30, 0), fecha('2026-10-03', 6, 30, 0)));
  lineas.push(' ' + sueno('AsleepCore', 'Apple Watch', fecha('2026-10-02', 23, 0, 0), fecha('2026-10-03', 1, 0, 0)));   // 2 h
  lineas.push(' ' + sueno('AsleepDeep', 'Apple Watch', fecha('2026-10-03', 1, 0, 0), fecha('2026-10-03', 2, 0, 0)));   // 1 h
  lineas.push(' ' + sueno('AsleepREM', 'Apple Watch', fecha('2026-10-03', 2, 0, 0), fecha('2026-10-03', 3, 0, 0)));    // 1 h
  lineas.push(' ' + sueno('Awake', 'Apple Watch', fecha('2026-10-03', 3, 0, 0), fecha('2026-10-03', 3, 20, 0)));       // 20 min despierto
  lineas.push(' ' + sueno('AsleepCore', 'Apple Watch', fecha('2026-10-03', 3, 20, 0), fecha('2026-10-03', 6, 0, 0)));  // 2 h 40
  lineas.push(' ' + sueno('Asleep', 'iPhone', fecha('2026-10-02', 23, 30, 0), fecha('2026-10-03', 1, 30, 0)));         // encimado con el reloj: no suma
  // El entreno, con su resumen, su ruta y una etiqueta con hijos.
  lineas.push(' <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="30" durationUnit="min" totalDistance="5.2" totalDistanceUnit="km" totalEnergyBurned="320" totalEnergyBurnedUnit="kcal" sourceName="Apple Watch de Andrés" sourceVersion="10.0" device="&lt;&lt;HKDevice: 0x3&gt;, name:Apple Watch, manufacturer:Apple Inc., model:Watch, hardware:Watch6,2, software:10.0&gt;" creationDate="' + fecha('2026-10-03', 7, 30, 5) + '" startDate="' + fecha('2026-10-03', 7, 0, 0) + '" endDate="' + fecha('2026-10-03', 7, 30, 0) + '">');
  lineas.push('  <MetadataEntry key="HKIndoorWorkout" value="0"/>');
  lineas.push('  <WorkoutStatistics type="HKQuantityTypeIdentifierHeartRate" startDate="' + fecha('2026-10-03', 7, 0, 0) + '" endDate="' + fecha('2026-10-03', 7, 30, 0) + '" average="150.5" minimum="100" maximum="178" unit="count/min"/>');
  lineas.push('  <WorkoutStatistics type="HKQuantityTypeIdentifierDistanceWalkingRunning" startDate="' + fecha('2026-10-03', 7, 0, 0) + '" endDate="' + fecha('2026-10-03', 7, 30, 0) + '" sum="5.2" unit="km"/>');
  lineas.push('  <WorkoutRoute sourceName="Apple Watch de Andrés" sourceVersion="10.0" creationDate="' + fecha('2026-10-03', 7, 30, 5) + '" startDate="' + fecha('2026-10-03', 7, 0, 0) + '" endDate="' + fecha('2026-10-03', 7, 30, 0) + '">');
  lineas.push('   <FileReference path="/workout-routes/route_2026-10-03_7.00am.gpx"/>');
  lineas.push('  </WorkoutRoute>');
  lineas.push(' </Workout>');
  // Un entreno de fuerza sin ruta, y otro de otro mes (fuera del rango pedido).
  lineas.push(' <Workout workoutActivityType="HKWorkoutActivityTypeTraditionalStrengthTraining" duration="45" durationUnit="min" totalEnergyBurned="250" totalEnergyBurnedUnit="kcal" sourceName="Apple Watch de Andrés" creationDate="' + fecha('2026-10-04', 19, 0, 0) + '" startDate="' + fecha('2026-10-04', 18, 0, 0) + '" endDate="' + fecha('2026-10-04', 18, 45, 0) + '"/>');
  lineas.push(' <Workout workoutActivityType="HKWorkoutActivityTypeCycling" duration="60" durationUnit="min" sourceName="Apple Watch" creationDate="' + fecha('2026-09-01', 9, 0, 0) + '" startDate="' + fecha('2026-09-01', 8, 0, 0) + '" endDate="' + fecha('2026-09-01', 9, 0, 0) + '"/>');
  lineas.push('</HealthData>');
  const xml = lineas.join('\n');

  const todo = leeAppleSalud(xml, { desde: '2026-10-01' });
  assert.deepEqual(todo.perfil, { fecha_nacimiento: '1995-06-01', genero: 'm' });
  assert.equal(todo.entrenos.length, 2, 'el de septiembre queda fuera del rango');
  const e = todo.entrenos[0];
  assert.equal(e.formato, 'apple_salud');
  assert.equal(e.deporte, 'correr');
  assert.equal(e.deporte_original, 'HKWorkoutActivityTypeRunning');
  assert.equal(e.dispositivo, 'Apple Watch');
  assert.equal(e.inicio, Date.parse('2026-10-03T13:00:00Z'));
  assert.equal(e.desfase_min, -360);
  assert.equal(e.duracion_s, 1800);
  assert.equal(e.movimiento_s, 1800);
  assert.equal(e.distancia_m, 5200);
  assert.equal(e.kcal_activas, 320);
  assert.deepEqual([e.resumen.fc_media, e.resumen.fc_max, e.resumen.fc_min], [151, 178, 100]);
  assert.equal(e.ruta_ref, '/workout-routes/route_2026-10-03_7.00am.gpx');
  assert.equal(e.muestras.length, 360, '361 latidos menos el de 255 (sin señal)');
  assert.equal(e.muestras[0].t, 0);
  assert.equal(e.muestras[0].fc, 140);
  assert.ok(e.muestras.every((m) => m.fc >= 30 && m.fc <= 240));
  assert.ok(e.muestras.every((m) => m.t >= 0 && m.t <= 1800), 'solo los latidos DENTRO del entreno');
  const fuerza = todo.entrenos[1];
  assert.equal(fuerza.deporte, 'fuerza');
  assert.equal(fuerza.muestras.length, 0, 'sin latidos medidos en esa ventana');
  assert.equal(fuerza.distancia_m, null);
  assert.equal(fuerza.kcal_activas, 250);
  assert.equal(fuerza.dispositivo, 'Apple Watch');
  // La recuperación.
  assert.equal(todo.recuperacion.length, 3);
  const d3 = todo.recuperacion.find((x) => x.dia === '2026-10-03');
  assert.equal(d3.fc_reposo, 52);
  assert.equal(d3.hrv_ms, 72, 'la mediana de las tres medidas del día (62, 72, 82)');
  assert.equal(d3.hrv_tipo, 'sdnn');
  assert.equal(d3.pasos, 7000, 'el reloj y el teléfono cuentan los mismos pasos: gana el que más contó, no se suman');
  assert.equal(d3.kcal_activas, 300);
  assert.equal(d3.vo2max, 47);
  assert.equal(d3.spo2, 97);
  // El sueño de la noche del 2 al 3 cuenta el día 3: 2 h + 1 h + 1 h + 2 h 40 = 6 h 40 (lo encimado del teléfono no suma, ni el rato despierto).
  assert.equal(d3.sueno_s, 6 * 3600 + 40 * 60);
  assert.equal(d3.sueno_profundo_s, 3600);
  assert.equal(d3.sueno_rem_s, 3600);
  assert.equal(d3.sueno_despierto_s, 1200);
  assert.equal(todo.recuperacion.find((x) => x.dia === '2026-10-01').sueno_s, null);
  // El resumen cuenta lo leído.
  assert.equal(todo.resumen.entrenos, 2);
  assert.equal(todo.resumen.latidos, 361 - 1 + 1, 'el de 255 se descarta; el de la noche cuenta; el de septiembre queda fuera del rango');

  // CORTAR EL TEXTO EN CUALQUIER LUGAR NO CAMBIA NADA (un trozo puede terminar en medio de una etiqueta).
  const base = JSON.stringify(todo);
  for (const trozo of [1, 3, 17, 255, 4096]) {
    const lector = creaLectorDeAppleSalud({ desde: '2026-10-01' });
    for (let i = 0; i < xml.length; i += trozo) lector.alimenta(xml.slice(i, i + trozo));
    assert.equal(JSON.stringify(lector.termina()), base, `en trozos de ${trozo} caracteres sale lo mismo`);
  }

  // Sin rango se leen los dos entrenos más el de septiembre.
  assert.equal(leeAppleSalud(xml).entrenos.length, 3);
  assert.equal(leeAppleSalud(xml, { hasta: '2026-10-02' }).entrenos.length, 1);
  // Un texto vacío o que no es de Apple no revienta.
  assert.deepEqual(leeAppleSalud('').entrenos, []);
  assert.deepEqual(leeAppleSalud('<html><body>hola</body></html>').recuperacion, []);

  // La ruta de un .gpx se une a las muestras del entreno, con su tiempo relativo.
  const punto = (s) => `<trkpt lat="19.4" lon="${(-99.1 + s * 3e-5).toFixed(6)}"><ele>2240</ele><time>${new Date(Date.parse('2026-10-03T13:00:00Z') + s * 1000).toISOString()}</time></trkpt>`;
  const gpx = leeGpx(`<gpx creator="Apple Watch"><trk><name>Ruta</name><trkseg>${Array.from({ length: 31 }, (_, i) => punto(i * 60)).join('')}</trkseg></trk></gpx>`)[0];
  const rutas = new Map([['route_2026-10-03_7.00am.gpx', { inicio: gpx.inicio, muestras: gpx.muestras }]]);
  const unido = unePorRutas(todo.entrenos.map((x) => ({ ...x })), rutas)[0];
  assert.equal(unido.muestras.length, 360 + 31);
  assert.ok(unido.muestras.every((m, i) => i === 0 || m.t >= unido.muestras[i - 1].t), 'siguen en orden de tiempo');
  assert.ok(unido.muestras.some((m) => m.lat === 19.4) && unido.muestras.some((m) => m.fc === 140));
  // Sin la ruta en el ZIP, el entreno se queda con el pulso.
  assert.equal(unePorRutas(todo.entrenos.map((x) => ({ ...x })), new Map())[0].muestras.length, 360);
}

/* ---- ¿Es un export de Apple Salud? ---- */
{
  assert.equal(esExportDeAppleSalud('<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE HealthData [ ... ]><HealthData locale="es_MX">'), true);
  assert.equal(esExportDeAppleSalud('<gpx creator="x">'), false);
}

console.log('prueba-metricas-lectura: todo bien');
