/* Pruebas de los stickers (lo puro): la ficha de datos, las ranuras con suplentes y el catálogo de la fase 1. `node scripts/prueba-stickers.mjs`.
   Siguen las pruebas de aceptación de la especificación (docs/stickers.md). */
import assert from 'node:assert/strict';
import { ficha, entrenoDeActividad, rutaDe } from '../src/lib/stickers/ficha.js';
import { catalogo, catalogoDeTotales, esNuevo, fraseCorta, fraseLarga, fraseResaltador, FRASE_INICIAL, FRASE_MAX, FRASES, idiomaDeFrase, lienzoDe, mensajesDeCara, pieDeBurbuja, renglonesDe, tamDeFrase, tituloDeLaHoja, TEMAS_TARJETA, COLORES, NUEVO_DIAS } from '../src/lib/stickers/catalogo.js';
import { kmTexto, totalesDe } from '../src/lib/stickers/totales.js';
import { ajustaRuta } from '../src/lib/stickers/ruta.js';
import { recordDelPlan, seriesProgramadas } from '../src/lib/stickers/plan.js';
import { entrenoDelReloj } from '../src/lib/metricas/leeHealthKit.js';
import { construyeActividad, preparaEntreno } from '../src/lib/metricas/construye.js';

const ids = (f) => catalogo(f).map((s) => s.id);
const base = { inicio: '2026-10-28T13:02:00Z', desfase_min: -360 };

// Una ruta recta de `m` metros hacia el norte, un punto cada 10 m.
const rutaRecta = (m) => Array.from({ length: Math.round(m / 10) + 1 }, (_, i) => ({ lat: 19.4 + (i * 10) / 111195, lon: -99.1 }));

// 1) Un pádel sin distancia: Grande con el tiempo, Fila con tiempo · calorías · pulso, ningún sticker de ruta.
{
  const f = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'otro', titulo: 'Pádel', duracion_s: 4200, kcal_activas: 610, fc_media: 141 } }));
  const cat = catalogo(f);
  assert.equal(cat.find((s) => s.id === 'grande').r.g.l, 'Time');
  assert.deepEqual(cat.find((s) => s.id === 'fila').r.map((d) => d.l), ['Time', 'Calories', 'Heart rate']);
  ['ruta-dato', 'mejor-km', 'esquinas', 'ruta-escrita', 'parciales', 'regla'].forEach((id) => assert.ok(!ids(f).includes(id), id));
  assert.ok(!Object.values(f.datos).some((d) => /N\/A|undefined|NaN/.test(d.v)), 'nunca N/A');
}

// 2) Un workout del plan: «16 sets» en Firma y Eco; el volumen no es el número principal de ninguno de la fase 1.
{
  const registro = { entreno: { hechos: {} }, exercises: {} };
  const lista = [{ n: 'Back squat', s: 4, r: 5, kg: 100 }, { n: 'Plank', s: 3, r: null, seg: 45 }];
  const f = ficha({ deporte: 'fuerza', inicioMs: Date.parse('2026-10-28T14:00:00Z'), duracionS: 2885, guiado: { series: 16, ejercicios: 5, volumen: 8450, lista }, nombre: 'Lower A', plan: true, coach: '@beto', registro, tipo: { nombre: 'Gimnasio', icono: 'pesa' } });
  const cat = catalogo(f);
  const conVolumen = cat.filter((s) => [s.r].flat().concat(Object.values(s.r ?? {})).flat().some((d) => d?.k === 'volumen')).map((s) => s.id);
  assert.deepEqual(conVolumen.sort(), ['columna', 'lista', 'p-mensaje-datos'], 'el volumen solo en Lista y Columna, y en las caras de gym de Mensaje con datos (5 nov)');
  assert.equal(cat.find((s) => s.id === 'lista').r.g.k, 'volumen', 'en Lista es el número principal');
  assert.ok(cat.some((s) => s.id === 'hoy-toco'), 'Lo que tocó hoy: solo con plan');
  assert.deepEqual(f.tipo, { nombre: 'Gimnasio', icono: 'pesa' }, 'el tipo del coach llega a la ficha');
  assert.equal(cat.find((s) => s.id === 'firma').r.g.v, '16');
  assert.equal(cat.find((s) => s.id === 'firma').r.g.u, 'sets');
  assert.equal(cat.find((s) => s.id === 'eco').r.g.k, 'series');
  assert.equal(f.coach, '@beto');
}

// 3) Un yoga sin reloj (solo tiempo): de los nuevos, «Un dato», «Boleto» y los 12 con personalidad; luego Firma, Eco, Grande, Frase, Hora, Partido, Semana, Mes y los de ícono, y nada más.
{
  const f = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'otro', titulo: 'Yoga', duracion_s: 3600 } }));
  assert.deepEqual(ids(f), ['d-un-dato', 'r-boleto', 'p-italica', 'p-maquina', 'p-reloj', 'p-frase', 'p-burbuja', 'p-barras', 'p-polaroid', 'p-momento', 'p-dia', 'p-resaltador', 'p-corazon', 'p-sello', 'firma', 'eco', 'grande', 'frase', 'hora', 'partido', 'semana', 'mes', 'icono-numero', 'icono-gigante', 'sello', 'semana-iconos', 'mes-por-tipo']);
  assert.equal(f.datos.min.v, '1h 00');
}

// Un mismo dato no se repite dentro de un sticker: en Titular, «min» y «tiempo» se llaman igual (Time) y no salen juntos.
{
  const f = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'otro', titulo: 'Pádel', duracion_s: 4200, kcal_activas: 610, fc_media: 141 } }));
  const t = catalogo(f).find((s) => s.id === 'titular').r;
  assert.deepEqual([t.a.l, t.b.l, t.c.l], ['Time', 'Calories', 'Heart rate']);
}

// Una carrera de 5 km con GPS: Distance, Pace, Time; Ruta y dato aparece; las frases dicen «27:14 at 5:27/km».
{
  const f = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'correr', titulo: 'Correr', duracion_s: 1634, distancia_m: 5000, fc_media: 158 }, muestras: rutaRecta(5000) }));
  assert.deepEqual([f.datos.dist.v, f.datos.dist.u, f.datos.ritmo.v, f.datos.tiempo.v], ['5.00', 'km', '5:27', '27:14']);
  ['titular', 'firma', 'eco', 'grande', 'fila', 'ruta-dato', 'esquinas', 'ruta-escrita', 'cada-km'].forEach((id) => assert.ok(ids(f).includes(id), id));
  assert.ok(!ids(f).includes('mejor-km') && !ids(f).includes('parciales'), 'sin parciales (la lista no trae las vueltas)');
  assert.equal(fraseCorta(f, f.datos.dist), '27:14 at 5:27/km');
  assert.deepEqual(f.titulo, ['Morning', 'Run']);
  assert.equal(f.hora.v, '7:02');
  assert.equal(f.fecha, 'Oct 28, 2026');
  const rd = catalogo(f).find((s) => s.id === 'ruta-dato').r;
  assert.equal(rd.g.l, 'Distance');
  assert.deepEqual(rd.lista.map((d) => d.l), ['Time', 'Pace']);
}

// Bici: velocidad en km/h, sin ritmo. Natación: metros, ritmo por 100 m y largos.
{
  const bici = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'bici', duracion_s: 3600, distancia_m: 30000 } }));
  assert.deepEqual([bici.datos.vel.v, bici.datos.vel.u, bici.datos.ritmo], ['30.0', 'km/h', undefined]);
  const nado = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'natacion', duracion_s: 1800, distancia_m: 1500 } }));
  assert.deepEqual([nado.datos.dist.v, nado.datos.dist.u, nado.datos.ritmo.v, nado.datos.ritmo.u, nado.datos.largos.v], ['1,500', 'm', '2:00', '/100m', '60']);
  // Del reloj (6 nov 2026): en alberca, los largos que contó con su largo y sin ruta; en aguas abiertas o con ruta (iPhone con mapa), sin largos.
  const conNado = (natacion, extra = {}) => ficha(entrenoDeActividad({ fila: { ...base, deporte: 'natacion', duracion_s: 1800, distancia_m: 1500, metricas: { natacion } }, ...extra }));
  const de50 = conNado({ lugar: 'alberca', largo: 50, largos: 30 });
  assert.deepEqual([de50.datos.dist.v, de50.datos.largos.v, de50.ruta], ['1,500', '30', null], 'alberca de 50: 30 largos, no 60');
  assert.equal(conNado({ lugar: 'alberca', largo: 25, largos: 60 }).datos.largos.v, '60');
  const abierta = conNado({ lugar: 'aguas-abiertas' }, { muestras: rutaRecta(1500) });
  assert.equal(abierta.datos.largos, undefined, 'en aguas abiertas no hay largos');
  assert.ok(abierta.ruta, 'y sí hay ruta');
  assert.equal(ficha(entrenoDeActividad({ fila: { ...base, deporte: 'natacion', duracion_s: 1800, distancia_m: 1500 }, muestras: rutaRecta(1500) })).datos.largos, undefined, 'nadar en el iPhone con mapa: sin largos');
}

// La ruta: solo si recorrió más de 300 m o se alejó más de 150 m del inicio. Un pádel en una cancha no dibuja nada.
{
  assert.equal(rutaDe(rutaRecta(120)), null, 'menos de 300 m y cerca del inicio: sin ruta');
  assert.ok(rutaDe(rutaRecta(400)), 'más de 300 m: con ruta');
  // Ir y volver muchas veces dentro de una cancha (suma > 300 m pero nunca a más de 20 m) cuenta como recorrido: la regla dice «o».
  const cancha = Array.from({ length: 60 }, (_, i) => ({ lat: 19.4 + ((i % 2) * 18) / 111195, lon: -99.1 }));
  assert.ok(rutaDe(cancha), 'suma más de 300 m');
  const quieto = Array.from({ length: 60 }, (_, i) => ({ lat: 19.4 + ((i % 2) * 2) / 111195, lon: -99.1 }));
  assert.equal(rutaDe(quieto), null, '118 m en total y a 2 m del inicio: sin ruta');
  const f = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'otro', titulo: 'Fútbol', duracion_s: 5400, kcal_activas: 820, fc_media: 152 }, muestras: rutaRecta(2000) }));
  assert.equal(f.datos.dist, undefined, 'la ruta no se vuelve «Distance»');
  assert.ok(ids(f).includes('ruta-dato'), 'pero sí sale la línea');
}

// Maratón: 42.20 km y 3:58:41 se escriben completos.
{
  const f = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'correr', duracion_s: 14321, distancia_m: 42200 } }));
  assert.deepEqual([f.datos.dist.v, f.datos.tiempo.v, f.datos.min.v], ['42.20', '3:58:41', '3h 59']);
}

// La ruta cabe en su cuadro sin deformarse; un entreno que no se movió no tiene forma.
{
  const pts = ajustaRuta([19.4, 19.41, 19.42], [-99.1, -99.1, -99.09], 248, 150, 10);
  assert.ok(pts.every(([x, y]) => x >= 10 - 1e-6 && x <= 238 + 1e-6 && y >= 10 - 1e-6 && y <= 140 + 1e-6));
  assert.equal(ajustaRuta([19.4, 19.4], [-99.1, -99.1], 248, 150), null);
}

// El título de la hoja: carrera, workout (del plan) o entreno.
assert.equal(tituloDeLaHoja({ deporte: 'correr' }), 'Comparte tu carrera');
assert.equal(tituloDeLaHoja({ deporte: 'correr', plan: true }), 'Comparte tu workout');
assert.equal(tituloDeLaHoja({ deporte: 'raqueta' }), 'Comparte tu entreno');

// Con las vueltas del entreno completo (getActividad): Parciales, Regla y Tu mejor kilómetro.
{
  const vueltas = [300, 290, 310, 280, 305].map((dur, i) => ({ tipo: 'km', n: i + 1, dur, dist: 1000 }));
  const f = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'correr', duracion_s: 1485, distancia_m: 5000, vueltas }, muestras: rutaRecta(5000) }));
  assert.deepEqual(f.splits, [300, 290, 310, 280, 305]);
  ['parciales', 'regla', 'mejor-km'].forEach((id) => assert.ok(ids(f).includes(id), id));
}

// Récord (sin plan): Titular · récord y Récord, en inglés, con la diferencia y la fecha del mejor anterior. «La primera vez» no es récord.
{
  const record = { tipo: 'distancia', texto: 'Tu distancia más larga', difNum: 1100, antesInicio: '2026-10-09T13:00:00Z', antesDesfase: -360 };
  const f = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'correr', duracion_s: 1900, distancia_m: 6100 }, record }));
  assert.deepEqual(f.record, { titulo: ['Run', 'PR'], en: 'Longest distance', grande: f.datos.dist, det: '1.10 km more than your best on Oct 9' });
  assert.ok(ids(f).includes('titular-pr') && ids(f).includes('record'));
  const primera = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'correr', duracion_s: 1900, distancia_m: 6100 }, record: { tipo: 'primera', texto: 'x' } }));
  assert.equal(primera.record, null);
}

// La semana, el mes y la racha salen del historial (lunes a domingo; el mismo tipo este año, contando este).
{
  const correr = { nombre: 'Correr', icono: 'correr' };
  const historial = [
    { id: 'h1', inicioMs: Date.parse('2026-10-26T13:00:00Z'), desfaseMin: -360, duracionS: 1800, distanciaM: 5000, tipo: correr }, // lunes
    { id: 'h2', inicioMs: Date.parse('2026-10-27T13:00:00Z'), desfaseMin: -360, duracionS: 3600, distanciaM: 0, tipo: { nombre: 'Gimnasio', icono: 'pesa' } },
    { id: 'h3', inicioMs: Date.parse('2026-10-02T13:00:00Z'), desfaseMin: -360, duracionS: 1500, distanciaM: 4000, tipo: correr },
    { id: 'h4', inicioMs: Date.parse('2025-12-30T13:00:00Z'), desfaseMin: -360, duracionS: 1500, distanciaM: 4000, tipo: correr }, // otro año
  ];
  const f = ficha(entrenoDeActividad({ fila: { ...base, id: 'yo', deporte: 'correr', duracion_s: 1634, distancia_m: 5000 }, tipo: correr, historial }));
  assert.equal(f.semana.total, 3);
  assert.equal(f.semana.hoy, 2, 'miércoles');
  assert.deepEqual(f.semana.dias.map((d) => d.length), [1, 1, 1, 0, 0, 0, 0]);
  assert.equal(f.mes.nombre, 'October');
  assert.equal(f.mes.total, 4);
  assert.deepEqual(f.mes.porTipo.map((x) => [x.tipo.nombre, x.n]), [['Correr', 3], ['Gimnasio', 1]]);
  assert.equal(f.racha, 3, 'tres de Correr este año, contando este');
  assert.ok(ids(f).includes('racha'));
}

// La frase larga: con distancia, fuerza y sin distancia.
{
  const carrera = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'correr', duracion_s: 1634, distancia_m: 5000 } }));
  assert.deepEqual(fraseLarga(carrera).map((r) => r.map((x) => x.t + (x.u ?? '')).join(' ')), ['5.00km', 'in 27:14', 'at 5:27/km']);
  const padel = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'otro', titulo: 'Pádel', duracion_s: 4200, kcal_activas: 610 }, nombre: 'Pádel' }));
  assert.deepEqual(fraseLarga(padel).map((r) => r.map((x) => x.t + (x.u ?? '')).join(' ')), ['1h 10', 'of pádel', '· 610kcal']);
}

// «Lo que tocó hoy» y el récord del plan: lo hecho contra lo PROGRAMADO.
{
  const day = { name: 'Lower A', exercises: [{ name: 'Back squat', sets: '4', reps: '5', intensity: '100 kg' }, { name: 'Plank', sets: '3', reps: '45 seg', intensity: 'RPE 7' }] };
  assert.equal(seriesProgramadas(day), 7, '4 de sentadilla y 3 de plancha');
  const marcas = (n, kg) => Object.fromEntries(Array.from({ length: n }, (_, i) => [`0.${i + 1}.0`, { t: 1000 * (i + 1), n: 'Back squat', ...(kg ? { kg } : null) }]));
  const registro = (h) => ({ entreno: { inicio: 0, hechos: h }, exercises: { 0: { weight: '100', repsHechas: '5' } } });
  const r = recordDelPlan({ day, registro: registro(marcas(4)), mejorAntes: () => 95 });
  assert.equal(r.texto, 'Justo lo programado: 4 × 5 con 100 kg');
  assert.equal(recordDelPlan({ day, registro: registro(marcas(4)), mejorAntes: () => 100 }), null, 'no es su mejor marca');
  assert.equal(recordDelPlan({ day, registro: registro(marcas(4)), mejorAntes: () => null }), null, 'sin marca de antes no hay contra qué');
  assert.equal(recordDelPlan({ day, registro: registro(marcas(4, 105)), mejorAntes: () => 95 }), null, 'se pasó de lo programado: no se celebra');
  assert.equal(recordDelPlan({ day, registro: registro(marcas(3)), mejorAntes: () => 95 }), null, 'le faltó una serie: no igualó');
  assert.equal(recordDelPlan({ day: { exercises: [{ name: 'Squat', sets: '4', reps: '5', intensity: '80%' }] }, registro: registro(marcas(4)), mejorAntes: () => 95 }), null, 'en %: no hay récord');

  const base2 = { deporte: 'fuerza', inicioMs: Date.parse('2026-10-28T14:00:00Z'), duracionS: 2885, nombre: 'Lower A', plan: true, coach: '@beto' };
  const hoy = (f) => catalogo(f).find((x) => x.id === 'hoy-toco');
  const con = ficha({ ...base2, guiado: { series: 12, ejercicios: 2, volumen: 4800, lista: [] }, programadas: 16 });
  assert.equal(con.programadas, 16);
  assert.equal(hoy(con).r.g.v, '12');
  const sin = ficha({ ...base2, guiado: { series: 12, ejercicios: 2, volumen: 4800, lista: [] } });
  assert.equal(sin.programadas, null, 'sin las programadas: solo «12 sets»');
  const pr = ficha({ ...base2, guiado: { series: 4, ejercicios: 1, volumen: 2000, lista: [] }, record: r });
  assert.deepEqual([pr.record.titulo, pr.record.grande.v, pr.record.det], [['squat', 'PR'], '100', 'Back squat, 4 × 5 · 5 kg more than your best']);
  assert.ok(ids(pr).includes('titular-pr') && ids(pr).includes('record'));
}

// Un entreno del Apple Watch (HealthKit): con su ruta, su pulso y su desnivel entra como una fila 'healthkit' y da los mismos stickers.
{
  const t0 = Date.parse('2026-10-28T13:00:00Z');
  const w = { startDate: new Date(t0).toISOString(), endDate: new Date(t0 + 1800000).toISOString(), duration: 1800, totalDistance: 5000, totalEnergyBurned: 400, sourceName: 'Apple Watch de Andrés', metadata: { HKElevationAscended: '42.6' } };
  const ruta = Array.from({ length: 1801 }, (_, i) => ({ t: t0 + i * 1000, lat: 19.4 + (i * 2.78) / 111195, lon: -99.1, alt: 2240 + i * 0.01, acc: i === 900 ? 120 : 5 }));
  const pulso = Array.from({ length: 360 }, (_, i) => ({ startDate: new Date(t0 + i * 5000).toISOString(), value: 140 + (i % 20) }));
  const crudo = entrenoDelReloj({ w, deporte: 'correr', deporteOriginal: 'HKWorkoutActivityTypeRunning', pulso, ruta, desfase: -360 });
  assert.equal(crudo.formato, 'healthkit');
  assert.equal(crudo.resumen.desnivel_pos_m, 43, 'el desnivel del reloj');
  assert.equal(crudo.muestras.filter((m) => m.lat).length, 1800, 'el punto con 120 m de error no entra');
  const { fila, series } = construyeActividad(preparaEntreno(crudo), { umbrales: { fc_max: 190, fc_reposo: 55, fc_umbral: 170, metodo: 'estimado' }, origen: 'healthkit' });
  assert.equal(fila.origen, 'healthkit');
  assert.equal(fila.desnivel_pos_m, 43);
  assert.equal(fila.distancia_m, 5000);
  assert.ok(fila.zonas_s?.some((z) => z > 0), 'las zonas del pulso');
  assert.ok(series?.ruta?.lat?.length > 100, 'la ruta se guarda en las series');
  const f = ficha(entrenoDeActividad({ fila: { ...fila, id: 'hk' }, series }));
  ['ruta-dato', 'elevacion', 'zonas', 'parciales'].forEach((id) => assert.ok(ids(f).includes(id), id));
  assert.equal(f.datos.elev.v, '43');
  // Sin distancia declarada: la suma de las muestras de distancia de ese rato.
  assert.equal(entrenoDelReloj({ w: { ...w, totalDistance: undefined }, deporte: 'correr', distanciaSumada: 4980.4 }).distancia_m, 4980);
}

// LOS 19 NUEVOS (5 nov 2026): en su orden y antes de los 35, los de ruta no salen sin ruta, nunca un «N/A» y una ranura vacía desaparece.
{
  const NUEVOS = ['d-un-dato', 'd-dos', 'd-dos-linea', 'd-tres', 'd-cuatro', 'd-seis', 'd-linea', 'd-linea-dato',
    'r-columna', 'r-columna-ruta', 'r-ruta-grande', 'r-columna-larga', 'r-marco', 'r-boleto',
    't-ruta', 't-ruta-fila', 't-sin-ruta', 't-chica', 't-record'];
  const RUTA = ['d-dos-linea', 'd-linea', 'd-linea-dato', 'r-columna-ruta', 'r-ruta-grande', 'r-marco', 't-ruta', 't-ruta-fila'];
  const fila = { ...base, id: 'n1', deporte: 'correr', titulo: 'Correr', duracion_s: 1593, distancia_m: 5080, fc_media: 152, kcal_activas: 342, desnivel_pos_m: 11 };
  const record = { tipo: 'tiempo', texto: 'x', difNum: 95, antesInicio: '2026-10-09T13:00:00Z', antesDesfase: -360 };
  const carrera = ficha(entrenoDeActividad({ fila, muestras: rutaRecta(5000), record, tipo: { nombre: 'Carrera', icono: 'correr' } }));
  const cat = catalogo(carrera);
  // Los 19 van primero y en ese orden; luego los 13 con personalidad (parte 2) y los 35 de hoy en su orden de siempre (Titular es el primero).
  assert.deepEqual(cat.slice(0, 19).map((s) => s.id), NUEVOS);
  assert.equal(cat[19].familia, 'personalidad');
  assert.equal(cat[32].id, 'titular');
  assert.deepEqual(cat.slice(0, 19).map((s) => s.familia), [...Array(8).fill('discreto'), ...Array(6).fill('runner'), ...Array(5).fill('tarjeta')]);
  assert.ok(cat.slice(19).every((s) => !NUEVOS.includes(s.id)));
  // Sus tamaños: discretos 300 × 200 (los de línea, 330), runner 330 y 420, tarjetas 530, 380, 530, 200 y 380.
  assert.deepEqual(cat.slice(0, 19).map((s) => lienzoDe(s).h), [200, 200, 200, 200, 200, 200, 330, 330, 330, 420, 420, 420, 420, 420, 530, 380, 530, 200, 380]);
  // Las ranuras, con el motor de siempre (PREF: distancia, series, tiempo, ritmo, velocidad, ejercicios, calorías, pulso, desnivel, largos).
  const de = (id) => cat.find((s) => s.id === id);
  assert.deepEqual(de('d-un-dato').r.map((d) => d.l), ['Distance', 'Time', 'Pace'], 'las tres caras: el primer, el segundo y el tercer dato');
  assert.equal(de('d-un-dato').caras, 3);
  assert.deepEqual(de('d-dos').r.map((d) => d.l), ['Distance', 'Time']);
  assert.deepEqual(de('d-cuatro').r.map((d) => d.l), ['Distance', 'Time', 'Pace', 'Calories']);
  assert.deepEqual(de('d-seis').r.map((d) => d.l), ['Distance', 'Time', 'Pace', 'Calories', 'Heart rate', 'Elevation']);
  assert.equal(de('d-linea-dato').r.g.l, 'Distance');
  assert.equal(de('r-columna-larga').r.length, 5);
  assert.equal(de('t-record').r && carrera.record.grande.l, 'Time');
  // Sin ruta no salen los que la obligan; sin récord, no sale la tarjeta de récord.
  const sinRuta = catalogo(ficha(entrenoDeActividad({ fila: { ...fila, id: 'n2' }, tipo: { nombre: 'Carrera', icono: 'correr' } })));
  RUTA.forEach((id) => assert.ok(!sinRuta.some((s) => s.id === id), `${id} sin ruta`));
  assert.ok(sinRuta.some((s) => s.id === 'r-boleto'), 'el Boleto sí sale (con el ícono)');
  assert.ok(!sinRuta.some((s) => s.id === 't-record'), 'sin récord no hay tarjeta de récord');
  assert.ok(cat.some((s) => s.id === 't-record'));
  // Una ranura vacía desaparece: con un solo dato (el tiempo) solo quedan «Un dato» y el Boleto; sin ningún dato, ninguno de los 19.
  const yoga = catalogo(ficha(entrenoDeActividad({ fila: { ...base, deporte: 'otro', titulo: 'Yoga', duracion_s: 3600 } }))).map((s) => s.id).filter((id) => NUEVOS.includes(id));
  assert.deepEqual(yoga, ['d-un-dato', 'r-boleto']);
  const nada = catalogo(ficha(entrenoDeActividad({ fila: { ...base, deporte: 'otro', titulo: 'Nada' } })));
  assert.ok(!nada.some((s) => NUEVOS.includes(s.id)), 'sin datos no sale ninguno de los 19');
  // Un workout del plan sin ruta: «Un dato» empieza por las series; la tarjeta de récord toma el kilaje.
  const gym = ficha({ deporte: 'fuerza', inicioMs: Date.parse('2026-10-20T14:00:00Z'), desfaseMin: -360, duracionS: 3120, kcal: 410, fcMedia: 128, nombre: 'Pierna', plan: true,
    guiado: { series: 18, ejercicios: 7, volumen: 6240, lista: [] }, record: { tipo: 'programado', ejercicio: 'Sentadilla', series: 4, reps: 5, kg: 120, difNum: 5 }, tipo: { nombre: 'Gimnasio', icono: 'pesa' } });
  const cg = catalogo(gym);
  assert.deepEqual(cg.find((s) => s.id === 'd-un-dato').r.map((d) => d.l), ['Sets', 'Time', 'Exercises']);
  assert.equal(cg.find((s) => s.id === 'd-seis').r.length, 5, 'con cinco datos, «Seis» sale con cinco');
  assert.ok(!cg.some((s) => RUTA.includes(s.id)));
  assert.ok(cg.some((s) => s.id === 't-record'));
  // Nunca «N/A», «undefined», «NaN» ni vacío en lo que dibujan.
  [carrera, gym, ficha(entrenoDeActividad({ fila: { ...base, deporte: 'otro', titulo: 'Yoga', duracion_s: 3600 } }))].forEach((f) => {
    catalogo(f).slice(0, 19).forEach((s) => {
      const datos = [s.r].flat().flatMap((x) => (x && x.v !== undefined ? [x] : Object.values(x ?? {}).filter((d) => d && d.v !== undefined)));
      datos.forEach((d) => assert.ok(String(d.v).length > 0 && !/N\/A|undefined|NaN|null/.test(`${d.v}${d.u}${d.l}`), `${s.id}: ${JSON.stringify(d)}`));
    });
    assert.ok(!/N\/A|undefined|NaN/.test(`${f.dia} ${f.fechaCorta}`));
  });
  // El día y la fecha del Boleto y de la tarjeta de récord.
  assert.deepEqual([carrera.dia, carrera.fechaCorta], ['miércoles', '28 oct']);
  assert.deepEqual([gym.dia, gym.fechaCorta], ['martes', '20 oct']);
  // La marca «Nuevo»: 30 días desde que salió, la fecha vive en el catálogo.
  const un = cat[0];
  assert.equal(un.desde, '2026-11-05');
  assert.equal(esNuevo(un, Date.parse('2026-11-06T12:00:00Z')), true);
  assert.equal(esNuevo(un, Date.parse('2026-12-04T00:00:00Z')), true, 'el día 29');
  assert.equal(esNuevo(un, Date.parse('2026-12-06T00:00:00Z')), false, `${NUEVO_DIAS} días después ya no`);
  assert.equal(esNuevo(un, Date.parse('2026-11-04T00:00:00Z')), false, 'antes de salir tampoco');
  assert.equal(esNuevo(cat[32]), false, 'los 35 de hoy no llevan «Nuevo»');
  assert.ok(cat.slice(0, 19).every((s) => s.desde === '2026-11-05'));
  // Los cuatro temas de la tarjeta traen sus doce colores (más el brillo de adentro) y siguen a los cuatro colores de la hoja.
  const LLAVES = ['fondo', 'borde', 'brillo', 'texto', 'etiqueta', 'acento', 'ruta', 'halo', 'nucleo', 'topo', 'linea', 'apagado'];
  COLORES.forEach((c) => LLAVES.forEach((k) => assert.ok(TEMAS_TARJETA[c.id]?.[k], `${c.id}.${k}`)));
  assert.equal(TEMAS_TARJETA.blanco.borde, '#1E9BFF');
  assert.equal(TEMAS_TARJETA.negro.fondo, 'radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.4) 0%, rgba(242,244,248,.4) 55%, rgba(230,234,241,.4) 100%)');
  // El fondo de las 4 tarjetas va al 40 % y en rgba (no color-mix): así lo rasteriza modern-screenshot en el iPhone.
  COLORES.forEach((c) => { const f = TEMAS_TARJETA[c.id].fondo; assert.equal((f.match(/rgba\(\d+,\d+,\d+,\.4\)/g) ?? []).length, 3, `${c.id}.fondo: 3 paradas al 40 %`); assert.ok(!f.includes('#') && !f.includes('color-mix'), `${c.id}.fondo en rgba`); });
  assert.equal(TEMAS_TARJETA.azul.ruta, '#FFFFFF');
  assert.equal(TEMAS_TARJETA.coral.apagado, '#4A1C14');
  // «Con foto» solo muestra los de identidad: ninguno de los nuevos.
  assert.ok(cat.slice(0, 19).every((s) => !s.identidad));
}

// PARTE 2 (5 nov 2026): los 12 con personalidad, sus caras, las frases y los 6 de Totales.
{
  const fila = { ...base, id: 'p1', deporte: 'correr', titulo: 'Carrera de la mañana', duracion_s: 1593, distancia_m: 5080, fc_media: 152, kcal_activas: 342, desnivel_pos_m: 11 };
  const carrera = ficha(entrenoDeActividad({ fila, muestras: rutaRecta(5000), tipo: { nombre: 'Carrera', icono: 'correr' } }));
  const gym = ficha({ deporte: 'fuerza', inicioMs: Date.parse('2026-10-21T00:40:00Z'), desfaseMin: -360, duracionS: 3120, guiado: { series: 18, ejercicios: 7, volumen: 6240, lista: [] }, nombre: 'Pierna y glúteo', plan: true, tipo: { nombre: 'Gimnasio', icono: 'pesa' } });
  const PERSO = ['p-italica', 'p-maquina', 'p-reloj', 'p-frase', 'p-burbuja', 'p-mensaje-datos', 'p-barras', 'p-polaroid', 'p-momento', 'p-dia', 'p-resaltador', 'p-corazon', 'p-sello'];
  [carrera, gym].forEach((f) => {
    const cat = catalogo(f);
    // Después de las 5 tarjetas y antes de los 35 (son 13 con el Mensaje con datos), en su orden.
    const i = cat.findIndex((x) => x.familia === 'personalidad');
    assert.deepEqual(cat.slice(i, i + 13).map((x) => x.id), PERSO);
    assert.equal(cat[i - 1].familia, 'tarjeta');
    assert.equal(cat[i + 13].id, 'titular');
    assert.ok(cat.slice(i, i + 13).every((x) => x.desde === '2026-11-05' && !x.identidad), 'llevan «Nuevo» y no entran en «Con foto»');
  });
  const de = (f, id) => catalogo(f).find((x) => x.id === id);
  // Las caras: Itálica, Reloj (con tres datos), Burbuja, Un momento, Día gigante y Corazón traen dos; Un dato y Mensaje con datos, tres; los demás, una.
  const caras = Object.fromEntries(catalogo(carrera).filter((x) => x.familia === 'personalidad' || x.id === 'd-un-dato').map((x) => [x.id, x.caras ?? 1]));
  assert.deepEqual(caras, { 'd-un-dato': 3, 'p-italica': 2, 'p-maquina': 1, 'p-reloj': 2, 'p-frase': 1, 'p-burbuja': 2, 'p-mensaje-datos': 3, 'p-barras': 1, 'p-polaroid': 1, 'p-momento': 2, 'p-dia': 2, 'p-resaltador': 1, 'p-corazon': 2, 'p-sello': 1 });
  // Las ranuras, con PREF: la carrera da Distance, Time, Pace…; el gym, Sets, Time, Exercises…
  assert.deepEqual(de(carrera, 'p-italica').r.map((d) => d.l), ['Distance', 'Time', 'Pace']);
  assert.deepEqual(de(carrera, 'p-maquina').r.map((d) => d.k), ['dist', 'tiempo', 'ritmo', 'kcal']);
  assert.deepEqual(de(gym, 'p-maquina').r.map((d) => d.k), ['series', 'tiempo', 'ejercicios', 'kcal'].filter((k) => gym.datos[k]));
  assert.deepEqual(de(carrera, 'p-frase').r.map((d) => d.l), ['Distance', 'Time']);
  assert.deepEqual(de(gym, 'p-barras').r.map((d) => d.l), ['Sets', 'Time', 'Exercises']);
  assert.deepEqual(de(carrera, 'p-polaroid').r.map((d) => d.l), ['Distance', 'Time']);
  ['p-dia', 'p-corazon', 'p-sello'].forEach((id) => assert.equal(de(carrera, id).r.g.k, 'dist', id));
  assert.equal(de(gym, 'p-corazon').r.g.k, 'series');
  // Sin un tercer dato, el Reloj digital tiene una sola cara (un yoga con solo el tiempo).
  const yoga = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'otro', titulo: 'Yoga', duracion_s: 3600 } }));
  assert.equal(de(yoga, 'p-reloj').caras, 1);
  // Las marcas: personalizables (frase), fijos (no cambian con los colores) y el Polaroid con tu foto.
  assert.deepEqual(catalogo(carrera).filter((x) => x.perso).map((x) => x.id), ['p-frase', 'p-burbuja']);
  assert.deepEqual(catalogo(carrera).filter((x) => x.fija).map((x) => x.id), ['p-burbuja', 'p-mensaje-datos', 'p-polaroid', 'p-resaltador', 'p-corazon']);
  assert.deepEqual(catalogo(carrera).filter((x) => x.conFoto).map((x) => x.id), ['p-polaroid']);
  // Sus tamaños (maqueta).
  assert.deepEqual(PERSO.map((id) => lienzoDe(de(carrera, id)).h), [260, 260, 200, 220, 180, 220, 200, 330, 200, 220, 180, 160, 300]);
  // Los textos: «Corrió 5.08 km» / «Entrenó 18 series»; «5.08 kilómetros en 26:33» / «18 series en 52 min»; la fecha y la hora de quien entrenó.
  assert.equal(pieDeBurbuja(carrera), 'Corrió 5.08 km');
  assert.equal(pieDeBurbuja(gym), 'Entrenó 18 series');
  assert.equal(fraseResaltador(carrera), '5.08 kilómetros en 26:33');
  assert.equal(fraseResaltador(gym), '18 series en 52 min');
  assert.deepEqual([carrera.fechaNum, carrera.hora24, carrera.fechaLarga], ['28.10.26', '7:02', '28 de octubre']);
  assert.deepEqual([gym.dia, gym.fechaNum, gym.hora24], ['martes', '20.10.26', '18:40']);
  // Un entreno sin ningún dato no saca el Resaltador (no tiene qué decir) y nunca un «N/A».
  const nada = ficha({ deporte: 'otro', inicioMs: Date.parse('2026-10-20T13:00:00Z'), nombre: 'Nada' });
  assert.ok(!catalogo(nada).some((x) => ['p-resaltador', 'p-dia', 'p-corazon', 'p-sello', 'p-italica'].includes(x.id)));
  [carrera, gym, yoga].forEach((f) => catalogo(f).filter((x) => x.familia === 'personalidad').forEach((x) => {
    const datos = [x.r].flat().flatMap((y) => (y && y.v !== undefined ? [y] : Object.values(y ?? {}).filter((d) => d && d.v !== undefined)));
    datos.forEach((d) => assert.ok(!/N\/A|undefined|NaN|null/.test(`${d.v}${d.u}${d.l}`), x.id));
  }));
  // Sin ruta no salen los que la obligan (el gym no tiene GPS); el Día gigante sale igual, sin la línea.
  const RUTA = ['d-dos-linea', 'd-linea', 'd-linea-dato', 'r-columna-ruta', 'r-ruta-grande', 'r-marco', 't-ruta', 't-ruta-fila'];
  assert.ok(!catalogo(gym).some((x) => RUTA.includes(x.id)));
  assert.ok(catalogo(gym).some((x) => x.id === 'p-dia'));

  // Las frases: English primero, diez en cada idioma, la de entrada «pov: locked in», hasta 40 letras.
  assert.deepEqual(Object.keys(FRASES), ['en', 'es']);
  assert.equal(FRASES.en.length, 10);
  assert.equal(FRASES.es.length, 10);
  assert.equal(FRASE_INICIAL, 'pov: locked in');
  assert.equal(FRASE_MAX, 40);
  assert.ok([...FRASES.en, ...FRASES.es].every((t) => t.length <= FRASE_MAX));
  // Una frase de 40 letras cabe sin cortarse: en Frase grande, en 3 renglones de 260 px (con una letra promedio de medio em, más ancha que la itálica real);
  // en la Burbuja, en 3 renglones de 198 px a 19 px (con la letra del sistema, ~0.55 em).
  const cuarenta = ['mis piernas opinan distinto pero aquí voy', 'abcdefghijklmnopqrstuvwxyzabcdefghijklmn', 'a b c d e f g h i j k l m n o p q r s t'];
  cuarenta.forEach((t) => {
    const t40 = t.slice(0, 40);
    assert.equal(t40.length <= 40, true);
    const px = tamDeFrase(t40);
    assert.ok(px >= 26, `${t40}: ${px} px`);
    assert.ok(renglonesDe(t40, 260 / (px * 0.46)) <= 3, t40);
    assert.ok(renglonesDe(t40, 198 / (19 * 0.55)) <= 4, `${t40}: burbuja`);
  });
  assert.equal(tamDeFrase('pov: locked in'), 40, 'una frase corta va a 40 px');
  assert.equal(renglonesDe('mente fuerte, piernas cansadas', 14), 3);
  assert.equal(renglonesDe('abcdefghij', 4), 3, 'una palabra más larga que el renglón se parte');

  // MENSAJE CON DATOS: tus datos como conversación, en inglés y en español, con carrera y con gym; si falta un dato, esa cara no sale.
  {
    // «Ahora» = el mismo día local de quien entrenó (México, -360): la carrera a las 7:02 y el gym a las 18:40.
    const hoyC = ficha(entrenoDeActividad({ fila, muestras: rutaRecta(5000), tipo: { nombre: 'Carrera', icono: 'correr' } }), Date.parse('2026-10-28T20:00:00Z'));
    const hoyG = ficha({ deporte: 'fuerza', inicioMs: Date.parse('2026-10-21T00:40:00Z'), desfaseMin: -360, duracionS: 3120, guiado: { series: 18, ejercicios: 7, volumen: 6240, lista: [] }, nombre: 'Pierna y glúteo', plan: true, tipo: { nombre: 'Gimnasio', icono: 'pesa' } }, Date.parse('2026-10-21T03:00:00Z'));
    assert.equal(hoyC.hoy, true);
    assert.equal(hoyG.hoy, true);
    assert.equal(carrera.hoy, false, 'un entreno de otro día no es «hoy»');
    const cara = (f, n, idioma) => mensajesDeCara(f, de(f, 'p-mensaje-datos').r, n, idioma);
    const textos = (x) => [x.mensajes.map((m) => `${m.mio ? '>' : '<'}${m.t}`), x.pie];
    // Carrera, inglés y español.
    assert.deepEqual(textos(cara(hoyC, 0, 'en')), [['>5.08 km, 5:14 /km'], 'Ran today at 7:02']);
    assert.deepEqual(textos(cara(hoyC, 1, 'en')), [['>just ran 5.08 km', '>5:14 /km in 26:33'], 'Ran today at 7:02']);
    assert.deepEqual(textos(cara(hoyC, 2, 'en')), [['<how was the run?', '>5.08 km at 5:14 /km'], null]);
    assert.deepEqual(textos(cara(hoyC, 0, 'es')), [['>5.08 km a 5:14 /km'], 'Corrió hoy a las 7:02']);
    assert.deepEqual(textos(cara(hoyC, 1, 'es')), [['>acabo de correr 5.08 km', '>a 5:14 /km en 26:33'], 'Corrió hoy a las 7:02']);
    assert.deepEqual(textos(cara(hoyC, 2, 'es')), [['<¿cómo te fue?', '>5.08 km a 5:14 /km'], null]);
    // Gym, inglés y español.
    assert.deepEqual(textos(cara(hoyG, 0, 'en')), [['>18 sets, 52 min'], 'Trained today at 18:40']);
    assert.deepEqual(textos(cara(hoyG, 1, 'en')), [['>done: 18 sets', '>6,240 kg in 52 min'], 'Trained today at 18:40']);
    assert.deepEqual(textos(cara(hoyG, 2, 'en')), [['<how was the gym?', '>18 sets, 6,240 kg'], null]);
    assert.deepEqual(textos(cara(hoyG, 0, 'es')), [['>18 series, 52 min'], 'Entrenó hoy a las 18:40']);
    assert.deepEqual(textos(cara(hoyG, 1, 'es')), [['>terminé: 18 series', '>6,240 kg en 52 min'], 'Entrenó hoy a las 18:40']);
    assert.deepEqual(textos(cara(hoyG, 2, 'es')), [['<¿cómo te fue?', '>18 series, 6,240 kg'], null]);
    // De otro día no dice «hoy»: dice cuándo fue.
    assert.equal(cara(carrera, 0, 'en').pie, 'Ran on Oct 28 at 7:02');
    assert.equal(cara(carrera, 0, 'es').pie, 'Corrió el 28 de octubre a las 7:02');
    // Una bici dice «rode» y «Pedaleó»; la velocidad hace de ritmo.
    const bici = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'bici', titulo: 'Rodada', duracion_s: 3600, distancia_m: 25000 } }), Date.parse('2026-10-28T20:00:00Z'));
    assert.deepEqual(textos(cara(bici, 1, 'en')), [['>just rode 25.00 km', '>25.0 km/h in 1:00:00'], 'Rode today at 7:02']);
    assert.equal(cara(bici, 0, 'es').pie, 'Pedaleó hoy a las 7:02');
    // El idioma sigue al de la frase: la de entrada o una de English, inglés; una de Español o una escrita por la persona, español.
    assert.equal(idiomaDeFrase(FRASE_INICIAL), 'en');
    assert.equal(idiomaDeFrase(''), 'en');
    FRASES.en.forEach((t) => assert.equal(idiomaDeFrase(t), 'en', t));
    FRASES.es.forEach((t) => assert.equal(idiomaDeFrase(t), 'es', t));
    assert.equal(idiomaDeFrase('mi frase propia'), 'es');
    // Si falta un dato, esa cara no sale; si no queda ninguna, el sticker tampoco.
    const sinTiempo = ficha({ deporte: 'correr', inicioMs: Date.parse('2026-10-28T13:02:00Z'), desfaseMin: -360, distanciaM: 5000 });
    assert.equal(de(sinTiempo, 'p-mensaje-datos'), undefined, 'sin ritmo ni tiempo no hay mensaje');
    const gymSinVolumen = ficha({ deporte: 'fuerza', inicioMs: Date.parse('2026-10-21T00:40:00Z'), desfaseMin: -360, duracionS: 3120, guiado: { series: 18, ejercicios: 7, lista: [] }, nombre: 'Pierna', plan: true });
    assert.equal(de(gymSinVolumen, 'p-mensaje-datos').caras, 1, 'sin volumen solo sale la cara de un mensaje');
    assert.equal(mensajesDeCara(gymSinVolumen, de(gymSinVolumen, 'p-mensaje-datos').r, 2, 'en').mensajes.length, 1, 'una cara pedida de más cae en la última que hay');
    const gymSinTiempo = ficha({ deporte: 'fuerza', inicioMs: Date.parse('2026-10-21T00:40:00Z'), desfaseMin: -360, guiado: { series: 18, volumen: 6240, lista: [] }, nombre: 'Pierna', plan: true });
    assert.equal(de(gymSinTiempo, 'p-mensaje-datos').caras, 1, 'sin tiempo solo sale la pregunta con «series, kg»');
    assert.deepEqual(textos(mensajesDeCara(gymSinTiempo, de(gymSinTiempo, 'p-mensaje-datos').r, 0, 'es')), [['<¿cómo te fue?', '>18 series, 6,240 kg'], null]);
    const sinNada = ficha({ deporte: 'otro', inicioMs: Date.parse('2026-10-20T13:00:00Z'), duracionS: 3600, nombre: 'Yoga' });
    assert.equal(de(sinNada, 'p-mensaje-datos'), undefined);
    // Un volumen largo no se corta en el catálogo (el sticker lo baja de tamaño al dibujarse).
    const grande = ficha({ deporte: 'fuerza', inicioMs: Date.parse('2026-10-21T00:40:00Z'), desfaseMin: -360, duracionS: 3900, guiado: { series: 18, ejercicios: 7, volumen: 12480, lista: [] }, nombre: 'Pierna', plan: true });
    assert.deepEqual(cara(grande, 1, 'en').mensajes.map((m) => m.t), ['done: 18 sets', '12,480 kg in 1h 05']);
  }

  // TOTALES: la semana y el mes de HOY (jueves 5 nov 2026), de todos los entrenos (del plan y libres).
  const H = (dia, h, km, min, extra = {}) => ({ id: `h${dia}-${h}`, inicioMs: Date.parse(`2026-11-${String(dia).padStart(2, '0')}T${String(h).padStart(2, '0')}:00:00Z`), desfaseMin: -360, duracionS: min * 60, distanciaM: km * 1000, tipo: { nombre: 'x', icono: null }, ...extra });
  const AHORA = Date.parse('2026-11-05T20:00:00Z');
  const historial = [H(2, 14, 5.1, 30), H(4, 14, 8.4, 50), H(4, 23, 0, 45), H(1, 14, 10, 60), H(3, 14, 0, 40), { ...H(1, 2, 3, 20), id: 'oct31' }];
  // Hoy es jueves: la semana va del lunes 2 al domingo 8. El del 1 de nov (domingo) es de la semana pasada; el de la madrugada del 1 (UTC) es del 31 de octubre en México.
  const t = totalesDe({ historial, inicioMs: Date.parse('2026-11-05T13:00:00Z'), desfaseMin: -360, duracionS: 1800, distanciaM: 4200, id: 'hoy' }, AHORA);
  assert.deepEqual(t.semana.n, [1, 1, 2, 1, 0, 0, 0]);
  assert.deepEqual(t.semana.km.map((x) => Math.round(x * 10) / 10), [5.1, 0, 8.4, 4.2, 0, 0, 0]);
  assert.equal(t.semana.entrenos, 5);
  assert.equal(t.semana.min, 30 + 40 + 50 + 45 + 30);
  assert.equal(kmTexto(t.semana.distM), '17.7');
  assert.equal(t.mes.nombre, 'Noviembre');
  assert.equal(t.mes.dias, 30);
  assert.deepEqual(t.mes.hechos, [1, 2, 3, 4, 5]);
  assert.equal(t.mes.entrenos, 6);
  assert.equal(kmTexto(96000), '96');
  // Los 6, en su orden; cada uno con sus caras.
  const tot = catalogoDeTotales(t);
  assert.deepEqual(tot.map((x) => x.id), ['s-semana', 's-barras', 's-puntos', 's-mes', 's-maquina', 's-tarjeta']);
  assert.deepEqual(tot.map((x) => x.caras ?? 1), [2, 1, 1, 2, 1, 1]);
  assert.deepEqual(tot.map((x) => lienzoDe(x).h), [200, 260, 300, 240, 280, 420]);
  assert.equal(tot.find((x) => x.id === 's-tarjeta').familia, 'tarjeta', 'la tarjeta de la semana lleva los cuatro temas');
  assert.ok(tot.every((x) => x.total && !x.identidad));
  // El entreno que se comparte cuenta aunque no venga en la lista, y no cuenta dos veces si sí viene.
  const t2 = totalesDe({ historial: [...historial, { ...H(5, 13, 4.2, 30), id: 'hoy' }], inicioMs: Date.parse('2026-11-05T13:00:00Z'), desfaseMin: -360, duracionS: 1800, distanciaM: 4200, id: 'hoy' }, AHORA);
  assert.equal(t2.semana.entrenos, 5);
  // Solo gym (sin kilómetros): «Esta semana» y «Mes gigante» enseñan entrenos y tiempo, sin la cara de los km.
  const sinKm = totalesDe({ historial: [H(3, 14, 0, 40)] }, AHORA);
  assert.deepEqual(catalogoDeTotales(sinKm).map((x) => x.caras ?? 1), [1, 1, 1, 1, 1, 1]);
  assert.deepEqual(catalogoDeTotales(sinKm).find((x) => x.id === 's-semana').r.vistas, ['entrenos']);
  // Sin entrenos esta semana pero sí en el mes: solo los del mes. Sin ninguno en el mes: nada (la pestaña lo dice).
  const soloMes = totalesDe({ historial: [H(1, 14, 10, 60)] }, AHORA);
  assert.deepEqual(catalogoDeTotales(soloMes).map((x) => x.id), ['s-puntos', 's-mes']);
  assert.deepEqual(catalogoDeTotales(totalesDe({ historial: [] }, AHORA)), []);
  assert.deepEqual(catalogoDeTotales(totalesDe({ historial: [{ ...H(1, 14, 5, 30), inicioMs: Date.parse('2026-10-10T14:00:00Z') }] }, AHORA)), []);
}

console.log('prueba-stickers: todo bien');
