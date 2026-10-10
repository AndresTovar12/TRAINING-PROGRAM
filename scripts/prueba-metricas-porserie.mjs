/* Pruebas de «Por serie»: `node scripts/prueba-metricas-porserie.mjs`. Sin base de datos ni red: sesiones y series inventadas. */
import assert from 'node:assert/strict';
import {
  TEXTO_DE_FUENTE, filasPorSerie, pulsoEnVentana, sesionesGuiadas, tramoDeLaSesion, uneConActividades,
} from '../src/lib/metricas/porSerie.js';

const SEG = 1000;
const T0 = Date.parse('2026-10-10T15:00:00Z');
const en = (s) => T0 + s * SEG;

/* ---- Qué sesiones cuentan y cuándo fueron ---- */
{
  assert.equal(tramoDeLaSesion(null), null);
  assert.equal(tramoDeLaSesion({ exercises: { 0: { weight: '100' } } }), null, 'solo lo escrito a mano en Entrenar no es un entreno guiado');
  assert.equal(tramoDeLaSesion({ entreno: { v: 1, inicio: en(0), hechos: {}, saltados: {} } }), null, 'abrir el entreno y cerrarlo sin tocar un paso no es un entreno');
  const t = tramoDeLaSesion({ entreno: { inicio: en(0), hechos: { '0.1.0': { t: en(40), n: 'A' }, 'd.0.1.0': { t: en(100) } }, saltados: { '0.2.0': { t: en(110), n: 'A' } } } });
  assert.deepEqual(t, { inicio: en(0), fin: en(110) }, 'sin `fin` termina en la última marca');
  assert.deepEqual(tramoDeLaSesion({ entreno: { inicio: en(0), fin: en(500), hechos: { a: { t: en(40) } } } }), { inicio: en(0), fin: en(500) });
  // Un reloj de Set sin entreno guiado (la pantalla de Entrenar) también deja ventanas.
  assert.deepEqual(tramoDeLaSesion({ formatos: { 3: { ventanas: [[en(10), en(40)], [en(40), en(70)]] } } }), { inicio: en(10), fin: en(70) });

  const estado = {
    'wr:sessions': {
      'wk-2026-W41-d5': { entreno: { nombre: '  Lower Strength · ~75 min  ', inicio: en(0), hechos: { '0.1.0': { t: en(40), n: 'Squat' } } } },
      'wk-2026-W41-d6': { entreno: { inicio: en(0), hechos: {} } },
    },
    'wr:sessions@pro1': { 'p-w1-d1': { entreno: { inicio: en(5000), hechos: { '0.1.0': { t: en(5040), n: 'Remo' } } } } },
    'wr:wellness': { '2026-10-10': { soreness: 3 } },
    'wr:onerm': {},
  };
  const s = sesionesGuiadas(estado);
  assert.deepEqual(s.map((x) => [x.id, x.almacen, x.nombre]), [['wk-2026-W41-d5', 'wr:sessions', 'Lower Strength'], ['p-w1-d1', 'wr:sessions@pro1', null]]);
  assert.deepEqual(sesionesGuiadas(undefined), []);
}

/* ---- Unir un entreno del reloj con su sesión guiada ---- */
{
  const sesiones = [
    { id: 'a', inicio: en(0), fin: en(3000) },        // 50 min
    { id: 'b', inicio: en(86_400), fin: en(87_000) },  // al día siguiente
  ];
  const act = (id, ini, dur) => ({ id, inicio: new Date(en(ini)).toISOString(), duracion_s: dur });
  const { porActividad, sueltas } = uneConActividades(sesiones, [act('x', 120, 2900), act('y', 90_000, 600), act('z', 100_000, 600)]);
  assert.equal(porActividad.get('x').id, 'a');
  assert.equal(porActividad.has('y'), false, 'un entreno de otra hora no se une');
  assert.deepEqual(sueltas.map((s) => s.id), ['b']);
  // El traslape pequeño (5 de 50 minutos) no cuenta; el reloj que abarca la sesión entera sí.
  assert.equal(uneConActividades([{ id: 'c', inicio: en(0), fin: en(3000) }], [act('w', 2700, 3000)]).porActividad.size, 0);
  assert.equal(uneConActividades([{ id: 'c', inicio: en(600), fin: en(1200) }], [act('w', 0, 5000)]).porActividad.get('w').id, 'c');
  // Una sesión solo une con un entreno: gana el que más se traslape.
  const dos = uneConActividades([{ id: 'c', inicio: en(0), fin: en(3000) }], [act('p', 0, 1700), act('q', 0, 2900)]);
  assert.deepEqual([...dos.porActividad.keys()], ['q']);
}

/* ---- El pulso por ventana ---- */
{
  // Cada punto es el promedio de 5 s: 100 durante 30 s, 160 durante 30 s, 130 después.
  const t = Array.from({ length: 24 }, (_, i) => i * 5);
  const fc = t.map((x) => (x < 30 ? 100 : x < 60 ? 160 : 130));
  const s = { t, fc };
  assert.deepEqual(pulsoEnVentana(s, 30, 60), { media: 160, max: 160, n: 6 });
  assert.deepEqual(pulsoEnVentana(s, 20, 40), { media: 130, max: 160, n: 4 }, 'una ventana a medias toma los puntos que toca');
  assert.equal(pulsoEnVentana(s, 500, 600), null);
  assert.equal(pulsoEnVentana({ t, fc: t.map(() => null) }, 0, 60), null);
  assert.equal(pulsoEnVentana(s, 60, 60), null);
  assert.equal(pulsoEnVentana(null, 0, 10), null);
  assert.equal(pulsoEnVentana(s, 31, 32).media, 160, 'menos de un punto: el punto que la toca');
}

/* ---- Un entreno de fuerza, serie por serie ---- */
{
  // Sentadilla en 3 series con descanso de 150 s planeado. La 2.ª la cambió el atleta (4 reps a 102.5 kg); la 3.ª se saltó.
  const e = {
    nombre: 'Lower Strength', inicio: en(0),
    hechos: {
      '0.1.0': { t: en(60), n: 'Back Squat' },
      'd.0.1.0': { t: en(60 + 160), p: 150 },        // descansó 160 s
      '0.2.0': { t: en(60 + 160 + 35), n: 'Back Squat', reps: '4', kg: '102.5' },
      'd.0.2.0': { t: en(60 + 160 + 35 + 140), p: 150 },
    },
    saltados: { '0.3.0': { t: en(60 + 160 + 35 + 140 + 5), n: 'Back Squat' } },
  };
  const ejercicios = { 0: { vueltas: { 0: { weight: '100', repsHechas: '5' }, 1: { weight: '102.5', repsHechas: '4' } }, weight: '102.5', repsHechas: '4' } };
  const sesion = { id: 'x', registro: { entreno: e, exercises: ejercicios }, ...{ inicio: en(0), fin: en(405) } };
  const { filas, hayPulso, resumen } = filasPorSerie(sesion);
  assert.equal(hayPulso, false);
  assert.deepEqual(filas.map((f) => [f.tipo, f.vuelta]), [['serie', 1], ['serie', 2], ['saltada', 3]]);
  const [s1, s2, s3] = filas;
  assert.deepEqual([s1.kg, s1.reps, s1.fuente], [100, '5', 'plan'], 'tocó «Listo» sin cambiar nada: es lo del plan');
  assert.deepEqual([s2.kg, s2.reps, s2.fuente], [102.5, '4', 'escrito'], 'lo que cambió el atleta lo escribió a mano');
  assert.equal(s1.durS, null, 'la primera serie no tiene duración limpia: antes no hubo un descanso marcado');
  assert.equal(s2.durS, 35, 'después de un descanso sí: del fin del descanso a «Listo»');
  assert.deepEqual(s1.descanso, { realS: 160, planS: 150, bajoFc: null });
  assert.deepEqual(s2.descanso, { realS: 140, planS: 150, bajoFc: null });
  assert.equal(s3.nombre, 'Back Squat');
  assert.deepEqual(resumen, { series: 2, lapsos: 0, saltadas: 1, descansoMedioS: 150 });
  assert.equal(TEXTO_DE_FUENTE.plan, 'Dejó lo del plan');

  // Con el reloj de pulsera: el pulso de cada serie sale de SU ventana y lo que bajó, del pico de la serie al final de su descanso.
  // Series cada 5 s: el pulso sube a 150 en la serie 2 (de 220 a 255 s) y baja a 120 al terminar el descanso.
  const t = Array.from({ length: 90 }, (_, i) => i * 5);
  const fc = t.map((x) => (x < 60 ? 110 : x < 220 ? 125 : x < 255 ? 150 : x < 380 ? 125 : 120));
  const actividad = { id: 'act', inicio: new Date(en(-10)).toISOString(), duracion_s: 450 };
  // El pulso de la actividad se mide desde su inicio (10 s antes que el entreno guiado): las ventanas se desplazan 10 s.
  const desfasada = { t: t.map((x) => x), fc: t.map((x) => fc[Math.max(0, Math.round((x - 10) / 5))]) };
  const c = filasPorSerie(sesion, { actividad, series: desfasada });
  assert.equal(c.hayPulso, true);
  const cs2 = c.filas[1];
  assert.equal(cs2.fc.max, 150, 'el pulso de la serie 2 sale de su ventana');
  assert.equal(c.filas[0].fc, null, 'la serie sin ventana limpia no trae pulso');
  assert.equal(cs2.descanso.bajoFc, 30, 'pico de 150 menos los 120 al final del descanso');
}

/* ---- Sprints de 400 m con reloj de lapsos ---- */
{
  // Set en lapsos: 3 × (400 m + descanso de 90 s). El reloj anotó cuánto tardó cada uno y cuándo.
  const v = [[en(100), en(171)], [en(171), en(261)], [en(261), en(330)], [en(330), en(420)], [en(420), en(493)]];
  const lapsos = [
    { tipo: 'trabajo', plan: null, etiqueta: 'Sprint', texto: '400 m', vuelta: 1 }, { tipo: 'descanso', plan: 90, etiqueta: '', texto: '', vuelta: 1 },
    { tipo: 'trabajo', plan: null, etiqueta: 'Sprint', texto: '400 m', vuelta: 2 }, { tipo: 'descanso', plan: 90, etiqueta: '', texto: '', vuelta: 2 },
    { tipo: 'trabajo', plan: null, etiqueta: 'Sprint', texto: '400 m', vuelta: 3 },
  ];
  const f = { anota: 'cumplido', valor: 3, tramos: [71, 90, 69, 90, 73], ventanas: v, lapsos, de: 3, seg: 393 };
  const sesion = { registro: { entreno: { inicio: en(90), hechos: { 'r.5': { t: en(500), n: 'Sprint' } } }, formatos: { 5: f } }, inicio: en(90), fin: en(500) };
  // Pulso: sube durante cada sprint (150 → 185) y baja en el descanso.
  const t = Array.from({ length: 100 }, (_, i) => i * 5);
  const fc = t.map((x) => {
    const s = x + 0; // la actividad empieza en T0
    if (s >= 100 && s < 171) return 185; if (s >= 171 && s < 261) return 150;
    if (s >= 261 && s < 330) return 183; if (s >= 330 && s < 420) return 148; if (s >= 420 && s < 493) return 186; return 120;
  });
  const { filas, resumen, hayPulso } = filasPorSerie(sesion, { actividad: { inicio: new Date(T0).toISOString(), duracion_s: 500 }, series: { t, fc } });
  assert.deepEqual(filas.map((x) => [x.tipo, x.vuelta, x.texto, x.durS]), [['lapso', 1, '400 m', 71], ['lapso', 2, '400 m', 69], ['lapso', 3, '400 m', 73]]);
  assert.equal(filas[0].ritmoSKm, 178, '71 s por 400 m: 2:58 /km');
  assert.equal(filas[1].distM, 400);
  assert.equal(filas[0].fc.max, 185);
  assert.deepEqual(filas[0].descanso, { realS: 90, planS: 90, bajoFc: 35 }, 'de 185 bajó a 150 al final del descanso');
  assert.equal(filas[2].descanso, null, 'después del último lapso no hay descanso');
  assert.equal(hayPulso, true);
  assert.deepEqual(resumen, { series: 0, lapsos: 3, saltadas: 0, descansoMedioS: 90 });
  // Sin reloj de pulsera: la duración y el ritmo salen igual (del cronómetro de la app), el pulso no.
  const sin = filasPorSerie(sesion);
  assert.equal(sin.filas[0].fc, null);
  assert.equal(sin.filas[0].ritmoSKm, 178);
  assert.equal(sin.hayPulso, false);
}

/* ---- Sprints de 13 segundos (por tiempo) y un set de calorías ---- */
{
  const lapsos = [{ tipo: 'trabajo', plan: 13, etiqueta: 'Sprint', texto: '13 seg', vuelta: 1 }, { tipo: 'descanso', plan: 60, etiqueta: '', texto: '', vuelta: 1 }, { tipo: 'trabajo', plan: 13, etiqueta: 'Sprint', texto: '13 seg', vuelta: 2 }];
  const sesion = {
    registro: {
      entreno: { inicio: en(0), hechos: { 'r.2': { t: en(120), n: 'Sprint' }, 'r.7': { t: en(400), n: 'Remo' } } },
      formatos: {
        2: { anota: 'cumplido', valor: 2, tramos: [13, 60, 13], ventanas: [[en(10), en(23)], [en(23), en(83)], [en(83), en(96)]], lapsos, de: 2, seg: 86 },
        7: { anota: 'cal', valor: 32, seg: 280, tramos: [], de: 1 },
      },
    },
    inicio: en(0), fin: en(400),
  };
  const { filas } = filasPorSerie(sesion);
  assert.deepEqual(filas.map((f) => [f.tipo, f.nombre]), [['lapso', 'Sprint'], ['lapso', 'Sprint'], ['set', 'Remo']]);
  assert.equal(filas[0].ritmoSKm, null, 'un lapso por tiempo no tiene ritmo');
  assert.deepEqual(filas[0].descanso, { realS: 60, planS: 60, bajoFc: null });
  assert.equal(filas[2].valor, '32 cal');
  assert.equal(filas[2].fuente, 'escrito', 'las calorías de la máquina las tecleó el atleta');
  assert.equal(filas[2].durS, 280);
}

/* ---- Lo que llega roto no rompe ---- */
{
  assert.deepEqual(filasPorSerie(null).filas, []);
  assert.deepEqual(filasPorSerie({ registro: { entreno: { hechos: { '0.1.0': 'x', '0.2.0': { sin: 'hora' } }, saltados: [] }, formatos: 7, exercises: 'y' } }).filas, []);
  const raro = filasPorSerie({ registro: { entreno: { hechos: { 'r.1': { t: en(5), n: 'Set' } } }, formatos: { 1: { anota: 'cumplido', valor: 2, lapsos: [null, 4, { tipo: 'trabajo' }], tramos: 'x', ventanas: [[1], 'a'] } } } });
  assert.equal(raro.filas.length, 1, 'un lapso sin datos no inventa nada');
}

console.log('prueba-metricas-porserie: todo bien');
