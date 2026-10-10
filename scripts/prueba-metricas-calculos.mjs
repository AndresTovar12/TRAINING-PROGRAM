// Prueba de las cuentas de un entreno (src/lib/metricas/calculos.js y deportes.js) con números inventados: zonas, carga, desnivel, kilómetros, series.
//
//   node scripts/prueba-metricas-calculos.mjs
import assert from 'node:assert/strict';
import {
  ZONAS, limitesDeZonas, zonaDe, esPulso, estimaUmbrales, tiempoEnZonas, cargaDePulso, cargaDeActividad, distanciaEntre, completaMuestras, desnivelDe,
  ritmoDe, resumenDeMuestras, vueltasPorKm, reduceSeries,
} from '../src/lib/metricas/calculos.js';
import { deporteDeTexto, deporteDeApple, deporteDeFit, nombreDelDeporte } from '../src/lib/metricas/deportes.js';

const casi = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} esperaba ${b} ± ${tol}, salió ${a}`);

/* ---- Los deportes, venga de donde venga ---- */
{
  assert.equal(deporteDeApple('HKWorkoutActivityTypeRunning'), 'correr');
  assert.equal(deporteDeApple('HKWorkoutActivityTypeTraditionalStrengthTraining'), 'fuerza');
  assert.equal(deporteDeApple('HKWorkoutActivityTypeHighIntensityIntervalTraining'), 'hiit');
  assert.equal(deporteDeApple('HKWorkoutActivityTypeCycling'), 'bici');
  assert.equal(deporteDeApple('HKWorkoutActivityTypeWaterPolo'), 'otro');
  assert.equal(deporteDeFit('running', 'trail'), 'correr');
  assert.equal(deporteDeFit('training', 'strength_training'), 'fuerza');
  assert.equal(deporteDeFit('cycling', 'indoor_cycling'), 'bici');
  assert.equal(deporteDeFit('fitness_equipment', 'elliptical'), 'eliptica');
  assert.equal(deporteDeFit('training', null), 'funcional');
  assert.equal(deporteDeTexto('Weight Training'), 'fuerza');
  assert.equal(deporteDeTexto('Biking'), 'bici');
  assert.equal(deporteDeTexto('Trail Run'), 'correr');
  assert.equal(deporteDeTexto('brunch con amigos'), 'otro', '«run» solo cuenta al principio de una palabra');
  assert.equal(deporteDeTexto('Rowing'), 'remo');
  assert.equal(deporteDeTexto('brown'), 'otro');
  assert.equal(deporteDeTexto(''), 'otro');
  assert.equal(nombreDelDeporte('correr'), 'Correr');
  assert.equal(nombreDelDeporte('inventado'), 'Otro');
}

/* ---- Las zonas ---- */
{
  assert.equal(ZONAS.length, 5);
  assert.deepEqual(limitesDeZonas(190), [114, 133, 152, 171]);
  assert.equal(zonaDe(100, 190), 1);
  assert.equal(zonaDe(114, 190), 2, 'justo en el 60 % ya es zona 2');
  assert.equal(zonaDe(150, 190), 3);
  assert.equal(zonaDe(165, 190), 4);
  assert.equal(zonaDe(185, 190), 5);
  assert.equal(zonaDe(0, 190), null);
  assert.equal(zonaDe(255, 190), null);
  assert.equal(zonaDe(null, 190), null);
  assert.ok(esPulso(30) && esPulso(240) && !esPulso(29) && !esPulso(241) && !esPulso(NaN) && !esPulso('140'));
}

/* ---- Los umbrales: lo escrito manda, lo que falta se estima y se dice cómo ---- */
{
  const hoy = new Date('2026-10-10T12:00:00Z');
  const escrito = estimaUmbrales({ configurados: { fc_max: 192, fc_reposo: 48, fc_umbral: 172 }, hoy });
  assert.deepEqual([escrito.fc_max, escrito.fc_reposo, escrito.fc_umbral], [192, 48, 172]);
  assert.deepEqual(escrito.metodo, { fc_max: 'escrito', fc_reposo: 'escrito', fc_umbral: 'escrito' });
  // Por edad (Tanaka): 31 años → 208 − 0.7 × 31 ≈ 186.
  const porEdad = estimaUmbrales({ fechaNacimiento: '1995-06-01', hoy });
  assert.equal(porEdad.metodo.fc_max, 'edad');
  casi(porEdad.fc_max, 186, 1);
  assert.equal(porEdad.fc_reposo, 60);
  assert.equal(porEdad.metodo.fc_reposo, 'por defecto');
  assert.equal(porEdad.fc_umbral, Math.round(porEdad.fc_max * 0.89));
  // Si el atleta ya pasó lo que dice la edad, manda lo visto.
  const visto = estimaUmbrales({ fechaNacimiento: '1995-06-01', observadoFcMax: 196, hoy });
  assert.equal(visto.fc_max, 196);
  assert.equal(visto.metodo.fc_max, 'visto');
  // Sin edad ni nada: 190; con un pulso visto creíble, ese.
  assert.equal(estimaUmbrales({ hoy }).fc_max, 190);
  assert.equal(estimaUmbrales({ observadoFcMax: 182, hoy }).fc_max, 182);
  assert.equal(estimaUmbrales({ observadoFcMax: 120, hoy }).fc_max, 190, 'un máximo de 120 no es un máximo: es un entreno suave');
  // El reposo medido.
  const reposo = estimaUmbrales({ reposoMediano: 52.4, hoy });
  assert.equal(reposo.fc_reposo, 52);
  assert.equal(reposo.metodo.fc_reposo, 'medido');
  assert.equal(estimaUmbrales({ reposoMediano: 12, hoy }).fc_reposo, 60, 'un reposo de 12 no es creíble');
}

/* ---- El tiempo en cada zona ---- */
{
  const muestras = [];
  for (let t = 0; t < 60; t += 1) muestras.push({ t, fc: 100 });      // zona 1
  for (let t = 60; t < 180; t += 1) muestras.push({ t, fc: 150 });    // zona 3
  for (let t = 180; t <= 240; t += 1) muestras.push({ t, fc: 185 }); // zona 5
  const z = tiempoEnZonas(muestras, 190);
  assert.equal(z.length, 5);
  assert.deepEqual(z.map((s) => Math.round(s / 10) * 10), [60, 0, 120, 0, 60]);
  casi(z.reduce((s, v) => s + v, 0), 241, 2, 'la suma es la duración');
  // Un hueco de 10 minutos sin señal no cuenta como diez minutos de pulso.
  const conHueco = tiempoEnZonas([{ t: 0, fc: 150 }, { t: 1, fc: 150 }, { t: 601, fc: 150 }], 190);
  assert.ok(conHueco[2] <= 32, `el hueco topó en 30 s, salió ${conHueco[2]}`);
  assert.deepEqual(tiempoEnZonas([], 190), [0, 0, 0, 0, 0]);
  assert.deepEqual(tiempoEnZonas([{ t: 0 }, { t: 5, fc: 0 }], 190), [0, 0, 0, 0, 0]);
}

/* ---- La carga: una hora en el umbral vale 100 ---- */
{
  const umbrales = { fcMax: 190, fcReposo: 55, fcUmbral: 169 };
  const hora = (fc) => Array.from({ length: 3601 }, (_, t) => ({ t, fc }));
  const enElUmbral = cargaDePulso(hora(169), umbrales);
  casi(enElUmbral.carga, 100, 0.5, 'una hora en el umbral');
  assert.equal(enElUmbral.metodo, 'pulso');
  const facil = cargaDePulso(hora(130), umbrales);
  assert.ok(facil.carga > 30 && facil.carga < 45, `una hora fácil ≈ 38, salió ${facil.carga}`);
  const maxima = cargaDePulso(hora(188), umbrales);
  assert.ok(maxima.carga > 140 && maxima.carga < 165, `una hora al máximo ≈ 153, salió ${maxima.carga}`);
  assert.ok(facil.carga < enElUmbral.carga && enElUmbral.carga < maxima.carga, 'más pulso, más carga');
  // Media hora vale la mitad.
  casi(cargaDePulso(hora(169).slice(0, 1801), umbrales).carga, 50, 0.5, 'media hora');
  // Las mujeres tienen su propia curva (misma escala: una hora en el umbral = 100).
  casi(cargaDePulso(hora(169), { ...umbrales, genero: 'f' }).carga, 100, 0.5, 'una hora en el umbral, ella');
  // Sin pulso no hay carga de pulso; muy pocos minutos tampoco.
  assert.equal(cargaDePulso([{ t: 0 }, { t: 60 }], umbrales), null);
  assert.equal(cargaDePulso(hora(150).slice(0, 30), umbrales), null);
  assert.equal(cargaDePulso(hora(150), { fcMax: 100, fcReposo: 90, fcUmbral: 95 }), null, 'una reserva de pulso absurda no se calcula');
  // El conjunto: del pulso si lo hay; si no, estimada por el deporte.
  const u = { fc_max: 190, fc_reposo: 55, fc_umbral: 169 };
  assert.equal(cargaDeActividad({ muestras: hora(150), deporte: 'correr', duracionS: 3600, umbrales: u }).metodo, 'pulso');
  const sinPulso = cargaDeActividad({ muestras: [], deporte: 'correr', duracionS: 3600, umbrales: u });
  assert.deepEqual(sinPulso, { carga: 60, metodo: 'estimada' });
  assert.equal(cargaDeActividad({ muestras: [], deporte: 'yoga', duracionS: 1800, umbrales: u }).carga, 10);
  assert.equal(cargaDeActividad({ muestras: [], deporte: 'correr', duracionS: 120, umbrales: u }), null, 'dos minutos no son un entreno');
}

/* ---- Distancia y desnivel ---- */
{
  // Un grado de latitud ≈ 111.2 km.
  casi(distanciaEntre(0, 0, 1, 0), 111195, 100);
  assert.equal(distanciaEntre(19.4, -99.1, 19.4, -99.1), 0);
  // Ruido de ±0.4 m alrededor de 2240 m: no es desnivel.
  const ruido = Array.from({ length: 200 }, (_, i) => 2240 + (i % 2 ? 0.4 : -0.4));
  assert.deepEqual(desnivelDe(ruido), { sube: 0, baja: 0 });
  // Una rampa de 100 m: sube ~100; luego baja 100.
  const rampa = [...Array.from({ length: 101 }, (_, i) => 2240 + i), ...Array.from({ length: 101 }, (_, i) => 2340 - i)];
  const d = desnivelDe(rampa);
  casi(d.sube, 100, 6, 'sube');
  casi(d.baja, 100, 6, 'baja');
  assert.deepEqual(desnivelDe([5, 6]), { sube: 0, baja: 0 });
  assert.deepEqual(desnivelDe([null, undefined, NaN]), { sube: 0, baja: 0 });
  assert.equal(ritmoDe(4), 250);
  assert.equal(ritmoDe(0.2), null);
  assert.equal(ritmoDe(null), null);
}

/* ---- Completar las muestras: distancia de la ruta, velocidad de la distancia ---- */
{
  // 120 s corriendo hacia el este a 3 m/s en la latitud 20°: un grado de longitud ≈ 104.6 km.
  const mPorGrado = 111195 * Math.cos((20 * Math.PI) / 180);
  const ruta = Array.from({ length: 121 }, (_, t) => ({ t, lat: 20, lon: -99 + (3 * t) / mPorGrado }));
  const m = completaMuestras(ruta);
  casi(m[120].dist, 360, 1.5, 'distancia de la ruta');
  casi(m[60].vel, 3, 0.1, 'velocidad de la distancia');
  assert.equal(ruta[0].dist, undefined, 'las muestras de entrada no se tocan');
  // Una coordenada loca (un salto a otro continente) no suma kilómetros.
  const conSalto = [{ t: 0, lat: 20, lon: -99 }, { t: 1, lat: 20, lon: -99.00003 }, { t: 2, lat: 48, lon: 2 }, { t: 3, lat: 20, lon: -99.00006 }];
  assert.ok(completaMuestras(conSalto)[3].dist < 20, 'el salto no cuenta');
  // La velocidad del reloj manda sobre la calculada.
  assert.equal(completaMuestras([{ t: 0, dist: 0, vel: 9 }, { t: 5, dist: 5, vel: 9 }])[0].vel, 9);
}

/* ---- El resumen de un entreno ---- */
{
  // Un rodaje de 30 min a 3.3 m/s (≈ 5:03 /km), pulso de 140 a 160 y una subida.
  const m = Array.from({ length: 1801 }, (_, t) => ({ t, fc: 140 + Math.round((20 * t) / 1800), dist: 3.3 * t, alt: 2240 + (t < 900 ? t / 9 : (1800 - t) / 9) }));
  const r = resumenDeMuestras(m, { duracionS: 1800 });
  assert.equal(r.duracion_s, 1800);
  casi(r.distancia_m, 5940, 5);
  casi(r.fc_media, 150, 1);
  assert.equal(r.fc_max, 160);
  assert.equal(r.fc_min, 140);
  casi(r.movimiento_s, 1800, 5);
  casi(r.desnivel_pos_m, 100, 8);
  casi(r.desnivel_neg_m, 100, 8);
  casi(r.velocidad_max_ms, 3.3, 0.05);
  assert.equal(r.cadencia_media, null);
  assert.equal(r.potencia_media, null);
  // Un entreno de fuerza: solo pulso. Nada de inventar distancia ni desnivel.
  const fuerza = resumenDeMuestras(Array.from({ length: 601 }, (_, t) => ({ t, fc: 120 + (t % 30) })), { duracionS: 600 });
  assert.equal(fuerza.distancia_m, null);
  assert.equal(fuerza.desnivel_pos_m, null);
  assert.equal(fuerza.movimiento_s, null);
  assert.equal(fuerza.fc_max, 149);
  // Un pulso de 0 (sin señal) no baja el promedio.
  const conCeros = resumenDeMuestras([{ t: 0, fc: 150 }, { t: 1, fc: 0 }, { t: 2, fc: 150 }, { t: 3, fc: 150 }]);
  assert.equal(conCeros.fc_media, 150);
  assert.equal(conCeros.fc_min, 150);
  const potencia = resumenDeMuestras([{ t: 0, pot: 200, cad: 80 }, { t: 1, pot: 300, cad: 90 }, { t: 2, pot: 250, cad: 85 }, { t: 3, pot: 0, cad: 0 }]);
  assert.equal(potencia.potencia_max, 300);
  assert.ok(potencia.potencia_media >= 240 && potencia.potencia_media <= 260);
  assert.equal(resumenDeMuestras([]).fc_media, null);
}

/* ---- Los kilómetros ---- */
{
  // 3.5 km a 4 m/s: 250 s por km. Tres kilómetros y un trozo de 500 m.
  const m = Array.from({ length: 876 }, (_, t) => ({ t, dist: 4 * t, fc: 150 + Math.floor(t / 100), alt: 100 }));
  const v = vueltasPorKm(m);
  assert.equal(v.length, 4);
  assert.deepEqual(v.map((x) => x.n), [1, 2, 3, 4]);
  assert.deepEqual(v.map((x) => x.ritmo), [250, 250, 250, 250]);
  assert.deepEqual(v.map((x) => x.dist), [1000, 1000, 1000, 500]);
  assert.equal(v[0].t0, 0);
  assert.equal(v[1].t0, 250);
  assert.equal(v[0].dur, 250);
  assert.ok(v[0].fc >= 150 && v[0].fc <= 153 && v[3].fc > v[0].fc, 'el pulso sube con el entreno');
  assert.ok(v.every((x) => x.tipo === 'km' && x.sube === 0));
  // Un trozo de menos de 200 m al final no es un kilómetro.
  assert.equal(vueltasPorKm(Array.from({ length: 276 }, (_, t) => ({ t, dist: 4 * t }))).length, 1, '1100 m = un km (el resto no llega a 200 m)');
  // Sin distancia, nada.
  assert.deepEqual(vueltasPorKm([{ t: 0, fc: 100 }, { t: 5, fc: 100 }]), []);
  assert.deepEqual(vueltasPorKm([]), []);
  // Un tramo más rápido se nota: el segundo km a 5 m/s.
  const cambio = [];
  for (let t = 0; t <= 250; t += 1) cambio.push({ t, dist: 4 * t });
  for (let t = 251; t <= 450; t += 1) cambio.push({ t, dist: 1000 + 5 * (t - 250) });
  const vc = vueltasPorKm(cambio);
  assert.equal(vc[0].ritmo, 250);
  assert.equal(vc[1].ritmo, 200);
  // El Apple Watch da el pulso y la ruta en muestras DISTINTAS (cada una cada 5 s, desfasadas): el pulso de cada km sale igual que si vinieran juntos.
  const separadas = [];
  for (let t = 0; t <= 750; t += 5) separadas.push({ t, dist: 4 * t });
  for (let t = 2; t <= 750; t += 5) separadas.push({ t, fc: t < 250 ? 140 : 170 });
  const vs = vueltasPorKm(separadas);
  assert.equal(vs.length, 3, '3000 m = tres km');
  assert.deepEqual(vs.map((x) => x.fc), [140, 170, 170]);
  assert.deepEqual(vs.map((x) => x.fcmax), [140, 170, 170]);
  assert.deepEqual(vs.map((x) => x.ritmo), [250, 250, 250]);
}

/* ---- Las series reducidas ---- */
{
  const m = Array.from({ length: 3601 }, (_, t) => ({
    t, fc: 130 + (t % 40), vel: 3 + (t % 5) / 10, alt: 2240 + t / 30, cad: 170, dist: 3.2 * t, lat: 19.4 + t * 1e-5, lon: -99.1 + t * 1e-5,
  }));
  const s = reduceSeries(m, { max: 600, maxRuta: 500 });
  assert.equal(s.v, 1);
  assert.ok(s.t.length <= 600 && s.t.length >= 590, `~600 puntos, salieron ${s.t.length}`);
  for (const k of ['fc', 'vel', 'alt', 'cad', 'dist']) assert.equal(s[k].length, s.t.length, `${k} va alineada con el tiempo`);
  assert.equal(s.pot, undefined, 'lo que no se mide no se guarda');
  assert.ok(s.ruta.lat.length <= 501 && s.ruta.lat.length === s.ruta.lon.length && s.ruta.t.length === s.ruta.lat.length);
  assert.equal(s.t[0], 0);
  assert.ok(s.t.every((x, i) => i === 0 || x > s.t[i - 1]), 'el tiempo solo avanza');
  casi(s.dist[s.dist.length - 1], 3.2 * 3600, 8);
  // JSON puro y de buen tamaño (unos 20 KB por entreno de una hora).
  const texto = JSON.stringify(s);
  assert.deepEqual(JSON.parse(texto), s);
  assert.ok(texto.length < 60000, `pesa ${texto.length} caracteres`);
  // Con pocas muestras no se reduce nada; sin muestras, una serie vacía.
  assert.equal(reduceSeries(m.slice(0, 50)).t.length, 50);
  assert.deepEqual(reduceSeries([]), { v: 1, t: [] });
  // Sin ruta no hay `ruta`.
  assert.equal(reduceSeries([{ t: 0, fc: 100 }, { t: 1, fc: 101 }]).ruta, undefined);
}

console.log('prueba-metricas-calculos: todo bien');
