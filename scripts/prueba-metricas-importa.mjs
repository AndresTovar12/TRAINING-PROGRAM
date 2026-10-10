// Prueba de la importación completa (src/lib/metricas/importa.js, construye.js): archivos sueltos, ZIP de Strava con CSV y .gz, ZIP de Apple Salud con rutas,
// el rango de fechas, lo repetido, los archivos que no sirven y la cancelación. Todo con archivos INVENTADOS.
//
//   node scripts/prueba-metricas-importa.mjs
import assert from 'node:assert/strict';
import { gzipSync, zipSync, strToU8 } from 'fflate';
import { FitBaseType, FitEncoder } from 'fit-file-parser/encoder';
import { leeArchivos, leeCsv, leeActividadesDeStrava } from '../src/lib/metricas/importa.js';
import { preparaEntreno, construyeActividad, recalculaConUmbrales, esElMismo, separaRepetidos, claveDeEntreno } from '../src/lib/metricas/construye.js';
import { estimaUmbrales } from '../src/lib/metricas/calculos.js';

const casi = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} esperaba ${b} ± ${tol}, salió ${a}`);
const archivo = (nombre, contenido) => new File([typeof contenido === 'string' ? strToU8(contenido) : contenido], nombre);
const mPorGradoLon = 111195 * Math.cos((19.4 * Math.PI) / 180);

/* ---- Archivos de mentira ---- */
const gpx = (inicioIso, minutos, { tipo = 'running', nombre = 'Rodaje', fcBase = 140 } = {}) => {
  const t0 = Date.parse(inicioIso);
  const puntos = Array.from({ length: minutos * 60 + 1 }, (_, s) => `<trkpt lat="19.4" lon="${(-99.1 + (3 * s) / mPorGradoLon).toFixed(6)}"><ele>${(2240 + s / 30).toFixed(1)}</ele><time>${new Date(t0 + s * 1000).toISOString()}</time><extensions><gpxtpx:TrackPointExtension><gpxtpx:hr>${fcBase + Math.floor(s / 60)}</gpxtpx:hr></gpxtpx:TrackPointExtension></extensions></trkpt>`);
  return `<?xml version="1.0"?><gpx creator="StravaGPX" version="1.1" xmlns:gpxtpx="x"><trk><name>${nombre}</name><type>${tipo}</type><trkseg>${puntos.join('')}</trkseg></trk></gpx>`;
};
const T = FitBaseType;
const TAM = { [T.Enum]: 1, [T.Uint8]: 1, [T.Uint16]: 2, [T.Uint32]: 4 };
const campo = (number, baseType, value) => ({ number, baseType, value, size: TAM[baseType] });
const fit = (inicioIso, segundos, fc) => {
  const enc = new FitEncoder();
  const t0 = Date.parse(inicioIso);
  const ts = (s) => FitEncoder.toFitTimestamp(new Date(t0 + s * 1000));
  enc.writeMessage(0, [campo(0, T.Enum, 4), campo(4, T.Uint32, ts(0))]);
  for (let s = 0; s <= segundos; s += 1) enc.writeMessage(20, [campo(253, T.Uint32, ts(s)), campo(3, T.Uint8, fc(s))]);
  enc.writeMessage(18, [campo(253, T.Uint32, ts(segundos)), campo(2, T.Uint32, ts(0)), campo(5, T.Enum, 10), campo(6, T.Enum, 20), campo(7, T.Uint32, segundos * 1000), campo(8, T.Uint32, segundos * 1000), campo(16, T.Uint8, 130), campo(17, T.Uint8, 150)]);
  return enc.close();
};
const tcx = (inicioIso, minutos) => `<TrainingCenterDatabase><Activities><Activity Sport="Biking"><Id>${inicioIso}</Id><Lap StartTime="${inicioIso}"><TotalTimeSeconds>${minutos * 60}</TotalTimeSeconds><DistanceMeters>${minutos * 400}</DistanceMeters><Calories>${minutos * 8}</Calories><AverageHeartRateBpm><Value>138</Value></AverageHeartRateBpm><MaximumHeartRateBpm><Value>160</Value></MaximumHeartRateBpm></Lap></Activity></Activities></TrainingCenterDatabase>`;

/* ---- El CSV ---- */
{
  assert.deepEqual(leeCsv('a,b,c\n1,"dos, con coma","tres ""comillas"""\n'), [['a', 'b', 'c'], ['1', 'dos, con coma', 'tres "comillas"']]);
  assert.deepEqual(leeCsv('a,b\r\n1,"salto\nde línea"\r\n'), [['a', 'b'], ['1', 'salto\nde línea']]);
  assert.deepEqual(leeCsv(''), []);
  const csv = 'Activity ID,Activity Date,Activity Name,Activity Type,Filename\n101,"Oct 1, 2026","Rodaje del domingo",Run,activities/101.gpx\n102,"Oct 2, 2026",Pesas,Weight Training,activities/102.fit.gz\n';
  const m = leeActividadesDeStrava(csv);
  assert.deepEqual(m.get('activities/101.gpx'), { titulo: 'Rodaje del domingo', tipo: 'Run' });
  assert.deepEqual(m.get('activities/102.fit.gz'), { titulo: 'Pesas', tipo: 'Weight Training' });
  // En español.
  const es = leeActividadesDeStrava('ID de actividad,Fecha de la actividad,Nombre de la actividad,Tipo de actividad,Nombre del archivo\n1,x,Carrera,Carrera,activities/1.gpx\n');
  assert.deepEqual(es.get('activities/1.gpx'), { titulo: 'Carrera', tipo: 'Carrera' });
  assert.equal(leeActividadesDeStrava('a,b\n1,2').size, 0, 'sin columna de archivo no hay mapa');
}

/* ---- Archivos sueltos ---- */
{
  const r = await leeArchivos([
    archivo('rodaje.gpx', gpx('2026-10-01T14:00:00Z', 20)),
    archivo('pesas.fit', fit('2026-10-02T14:00:00Z', 1800, (s) => 110 + (s % 40))),
    archivo('bici.tcx', tcx('2026-10-03T14:00:00Z', 30)),
    archivo('notas.txt', 'hola'),
    archivo('basura.fit', new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15])),
    archivo('vacio.gpx', '<gpx><trk><trkseg></trkseg></trk></gpx>'),
  ]);
  assert.equal(r.entrenos.length, 3);
  assert.deepEqual(r.entrenos.map((e) => e.deporte), ['correr', 'fuerza', 'bici'], 'de los más viejos a los más nuevos');
  assert.equal(r.entrenos[0].titulo, 'Rodaje');
  assert.ok(r.entrenos[0].series.fc.length > 100, 'las series reducidas van con el entreno');
  assert.equal(r.entrenos[0].muestras, undefined, 'las muestras ya se soltaron');
  assert.equal(r.entrenos[0].calculado.fc_max, 160, '140 + 20 minutos: el máximo EXACTO, no el de un promedio');
  assert.equal(r.ignorados.length, 3);
  assert.ok(r.ignorados.some((i) => i.nombre === 'notas.txt' && /no se lee/.test(i.motivo)));
  assert.ok(r.ignorados.some((i) => i.nombre === 'basura.fit' && /no se pudo leer/.test(i.motivo)));
  assert.ok(r.ignorados.some((i) => i.nombre === 'vacio.gpx'));
  assert.deepEqual(r.recuperacion, []);
}

/* ---- El ZIP de Strava: .gpx, .fit.gz, .tcx.gz y su CSV (que viene DESPUÉS de las actividades) ---- */
{
  const zip = zipSync({
    'activities/101.gpx': strToU8(gpx('2026-10-01T14:00:00Z', 20, { tipo: '', nombre: '' })),
    'activities/102.fit.gz': gzipSync(fit('2026-10-02T14:00:00Z', 1800, () => 120)),
    'activities/103.tcx.gz': gzipSync(strToU8(tcx('2026-10-03T14:00:00Z', 30))),
    'media/foto.jpg': new Uint8Array([1, 2, 3]),
    'activities.csv': strToU8('Activity ID,Activity Date,Activity Name,Activity Type,Filename\n101,x,Rodaje del domingo,Run,activities/101.gpx\n102,x,Pesas con Lucas,Weight Training,activities/102.fit.gz\n103,x,Vuelta en bici,Ride,activities/103.tcx.gz\n'),
  });
  const avances = [];
  const r = await leeArchivos([archivo('export_123.zip', zip)], { alProgreso: (a) => avances.push(a) });
  assert.equal(r.entrenos.length, 3);
  assert.deepEqual(r.entrenos.map((e) => e.titulo), ['Rodaje del domingo', 'Pesas con Lucas', 'Vuelta en bici'], 'el nombre sale del CSV');
  assert.equal(r.entrenos[0].deporte, 'correr', 'un GPX sin tipo toma el tipo de Strava («Run»)');
  assert.equal(r.entrenos[1].deporte, 'fuerza');
  assert.equal(r.entrenos[2].deporte, 'bici');
  assert.equal(r.ignorados.length, 0, 'la foto del ZIP no es un error');
  assert.ok(avances.length >= 2 && avances[avances.length - 1].leidos === avances[avances.length - 1].total);
  assert.equal(avances[avances.length - 1].entrenos, 3);
}

/* ---- El ZIP de Apple Salud: export.xml + rutas ---- */
{
  const f = (d, h, m, s) => `${d} ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')} -0600`;
  const lineas = ['<?xml version="1.0"?>', '<HealthData locale="es_MX">', ' <Me HKCharacteristicTypeIdentifierDateOfBirth="1994-02-03" HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexFemale"/>'];
  for (let s = 0; s <= 600; s += 5) lineas.push(` <Record type="HKQuantityTypeIdentifierHeartRate" sourceName="Apple Watch" unit="count/min" startDate="${f('2026-10-03', 7, Math.floor(s / 60), s % 60)}" endDate="${f('2026-10-03', 7, Math.floor(s / 60), s % 60)}" value="${135 + Math.floor(s / 30)}"/>`);
  ['2026-10-01', '2026-10-02', '2026-10-03'].forEach((d, i) => lineas.push(` <Record type="HKQuantityTypeIdentifierRestingHeartRate" sourceName="Apple Watch" unit="count/min" startDate="${f(d, 0, 0, 0)}" endDate="${f(d, 23, 59, 0)}" value="${53 + i}"/>`));
  lineas.push(` <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="10" durationUnit="min" totalDistance="1.8" totalDistanceUnit="km" totalEnergyBurned="110" totalEnergyBurnedUnit="kcal" sourceName="Apple Watch" startDate="${f('2026-10-03', 7, 0, 0)}" endDate="${f('2026-10-03', 7, 10, 0)}">`);
  lineas.push(' <WorkoutRoute><FileReference path="/workout-routes/route_2026-10-03_7.00am.gpx"/></WorkoutRoute>', ' </Workout>', '</HealthData>');
  const ruta = `<gpx creator="Apple Watch"><trk><name>Ruta</name><trkseg>${Array.from({ length: 21 }, (_, i) => `<trkpt lat="19.4" lon="${(-99.1 + (3 * i * 30) / mPorGradoLon).toFixed(6)}"><ele>2240</ele><time>${new Date(Date.parse('2026-10-03T13:00:00Z') + i * 30000).toISOString()}</time></trkpt>`).join('')}</trkseg></trk></gpx>`;
  const zip = zipSync({
    'apple_health_export/export.xml': strToU8(lineas.join('\n')),
    'apple_health_export/export_cda.xml': strToU8('<ClinicalDocument/>'),
    'apple_health_export/workout-routes/route_2026-10-03_7.00am.gpx': strToU8(ruta),
  });
  const r = await leeArchivos([archivo('export.zip', zip)]);
  assert.equal(r.entrenos.length, 1);
  const e = r.entrenos[0];
  assert.equal(e.deporte, 'correr');
  assert.equal(e.dispositivo, 'Apple Watch');
  assert.equal(e.formato, 'apple_salud');
  assert.equal(e.distancia_m, 1800);
  assert.ok(e.series.ruta && e.series.ruta.lat.length === 21, 'la ruta del .gpx se unió');
  assert.ok(e.series.fc.length > 100, 'y los latidos también');
  assert.equal(r.recuperacion.length, 3);
  assert.equal(r.recuperacion[2].fc_reposo, 55);
  assert.deepEqual(r.perfil, { fecha_nacimiento: '1994-02-03', genero: 'f' });
  // El rango: solo el día 3.
  const recortado = await leeArchivos([archivo('export.zip', zip)], { desde: '2026-10-03' });
  assert.equal(recortado.recuperacion.length, 1);
  assert.equal(recortado.entrenos.length, 1);
  assert.equal((await leeArchivos([archivo('export.zip', zip)], { desde: '2026-10-04' })).entrenos.length, 0);
  // El mismo export, suelto como .xml.
  const suelto = await leeArchivos([archivo('export.xml', lineas.join('\n'))]);
  assert.equal(suelto.entrenos.length, 1);
  assert.equal(suelto.entrenos[0].series.ruta, undefined, 'sin el ZIP no hay rutas');
}

/* ---- Cancelar, y archivos que no son ZIP aunque lo parezcan ---- */
{
  let n = 0;
  await assert.rejects(() => leeArchivos([archivo('a.gpx', gpx('2026-10-01T14:00:00Z', 5)), archivo('b.gpx', gpx('2026-10-02T14:00:00Z', 5))], { cancelado: () => { n += 1; return n > 1; } }), /cancelada/);
  const r = await leeArchivos([archivo('roto.zip', new Uint8Array([80, 75, 3, 4, 1, 2, 3, 4, 5, 6, 7, 8, 9]))]);
  assert.equal(r.entrenos.length, 0);
  assert.ok(r.ignorados.length >= 1);
  const vacio = await leeArchivos([]);
  assert.deepEqual(vacio.entrenos, []);
}

/* ---- De un entreno preparado a la fila que se guarda ---- */
{
  const umbrales = estimaUmbrales({ configurados: { fc_max: 190, fc_reposo: 55, fc_umbral: 169 } });
  const r = await leeArchivos([archivo('rodaje.gpx', gpx('2026-10-01T14:00:00Z', 30))]);
  const { fila, series } = construyeActividad(r.entrenos[0], { umbrales, desfaseMin: -360 });
  assert.equal(fila.origen, 'archivo');
  assert.equal(fila.deporte, 'correr');
  assert.equal(fila.formato, 'gpx');
  assert.equal(fila.inicio, '2026-10-01T14:00:00.000Z');
  assert.equal(fila.desfase_min, -360, 'un GPX no dice la hora local: se usa la de la persona');
  assert.equal(fila.duracion_s, 1800);
  casi(fila.distancia_m, 5400, 30);
  assert.equal(fila.fc_max, 170);
  assert.ok(fila.fc_media >= 150 && fila.fc_media <= 156);
  assert.equal(fila.zonas_s.length, 5);
  casi(fila.zonas_s.reduce((s, v) => s + v, 0), 1800, 40, 'las zonas suman la duración');
  assert.equal(fila.carga_metodo, 'pulso');
  assert.ok(fila.carga > 30 && fila.carga < 45, `media hora a ~155 lpm (de 190 máx.): unos 36 puntos, salió ${fila.carga}`);
  assert.equal(fila.umbrales.fc_max, 190);
  assert.equal(fila.vueltas.length, 6, 'sin vueltas del reloj: los kilómetros de la ruta (5.4 km = 5 km + un trozo de 400 m)');
  assert.deepEqual(fila.vueltas.map((v) => v.tipo), ['km', 'km', 'km', 'km', 'km', 'km']);
  assert.ok(fila.metricas.ritmo_medio_s_km >= 330 && fila.metricas.ritmo_medio_s_km <= 336, '3 m/s ≈ 5:33 por km');
  assert.ok(series.fc.length > 100 && series.ruta.lat.length > 100);
  assert.equal(fila.origen_clave, claveDeEntreno(r.entrenos[0]));
  // Sin guardar series: solo el resumen.
  assert.equal(construyeActividad(r.entrenos[0], { umbrales, conSeries: false }).series, null);
  // Se puede volver a contar con otros umbrales, sin releer el archivo.
  const otros = estimaUmbrales({ configurados: { fc_max: 200, fc_reposo: 50, fc_umbral: 180 } });
  const nuevo = recalculaConUmbrales(fila, series, otros);
  assert.equal(nuevo.umbrales.fc_max, 200);
  assert.notDeepEqual(nuevo.zonas_s, fila.zonas_s);
  assert.equal(nuevo.carga_metodo, 'pulso');
  assert.equal(recalculaConUmbrales(fila, { t: [0, 1] }, otros), null, 'sin pulso en las series no hay qué recalcular');
  // Un entreno sin pulso (una caminata sin reloj): la carga se estima por el deporte y se dice.
  const sinPulso = await leeArchivos([archivo('paseo.gpx', gpx('2026-10-02T14:00:00Z', 30, { tipo: 'walking' }).replace(/<extensions>.*?<\/extensions>/g, ''))]);
  const paseo = construyeActividad(sinPulso.entrenos[0], { umbrales }).fila;
  assert.equal(paseo.deporte, 'caminar');
  assert.equal(paseo.fc_media, null);
  assert.equal(paseo.zonas_s, null);
  assert.deepEqual([paseo.carga, paseo.carga_metodo], [12.5, 'estimada']);
}

/* ---- Lo repetido ---- */
{
  const e = (inicio, dur, extra = {}) => ({ inicio: Date.parse(inicio), duracion_s: dur, ...extra });
  assert.equal(esElMismo(e('2026-10-01T14:00:00Z', 1800), e('2026-10-01T14:00:20Z', 1790)), true, 'segundos de diferencia: el mismo');
  assert.equal(esElMismo(e('2026-10-01T14:00:00Z', 1800), e('2026-10-01T16:00:00Z', 1800)), false);
  assert.equal(esElMismo(e('2026-10-01T14:00:00Z', 3600), e('2026-10-01T14:45:00Z', 3600)), false, 'solo se encima el 25 %');
  assert.equal(esElMismo(e('2026-10-01T14:00:00Z', 3600), e('2026-10-01T14:10:00Z', 1200)), true, 'uno contenido en otro (el corto está entero dentro)');
  const nuevos = [
    { fila: { inicio: '2026-10-01T14:00:00.000Z', duracion_s: 1800, fc_media: null } },
    { fila: { inicio: '2026-10-01T14:00:10.000Z', duracion_s: 1795, fc_media: 150 } },
    { fila: { inicio: '2026-10-05T14:00:00.000Z', duracion_s: 1800, fc_media: 140 } },
    { fila: { inicio: '2026-10-07T14:00:00.000Z', duracion_s: 1800, fc_media: 140 } },
  ];
  const existentes = [{ inicio: '2026-10-07T14:00:05.000Z', duracion_s: 1799 }];
  const { nuevos: ok, repetidos } = separaRepetidos(nuevos, existentes);
  assert.equal(ok.length, 2);
  assert.equal(repetidos.length, 2);
  assert.equal(ok[0].fila.fc_media, 150, 'entre dos iguales de la misma tanda se queda el que trae pulso');
  assert.equal(ok[1].fila.inicio, '2026-10-05T14:00:00.000Z');
  // El mismo rodaje del reloj (con distancia y calorías) y de Strava (con su nombre): se queda el del reloj y se le agrega el nombre.
  const reloj = { inicio: Date.parse('2026-10-06T11:33:00Z'), duracion_s: 3078, distancia_m: 9570, kcal_activas: 674, dispositivo: 'Apple Watch', titulo: null, resumen: { fc_media: 146 }, series: {} };
  const strava = { inicio: Date.parse('2026-10-06T11:33:00Z'), duracion_s: 3075, distancia_m: null, kcal_activas: null, dispositivo: 'Strava', titulo: 'Calidad: 4 x 6 min', calculado: { fc_media: 146 }, series: {} };
  for (const orden of [[strava, reloj], [reloj, strava]]) {
    const copia = orden.map((x) => ({ ...x }));
    const r = separaRepetidos(copia, []);
    assert.equal(r.nuevos.length, 1);
    assert.equal(r.repetidos.length, 1);
    assert.equal(r.nuevos[0].dispositivo, 'Apple Watch', 'gana el que trae distancia y calorías, entre en el orden que entre');
    assert.equal(r.nuevos[0].titulo, 'Calidad: 4 x 6 min', 'y se queda con el nombre del otro');
    assert.equal(r.nuevos[0].kcal_activas, 674);
  }
}

console.log('prueba-metricas-importa: todo bien');
