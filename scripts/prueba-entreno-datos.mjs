// Prueba de lo que las pantallas del modo entreno dicen de un paso (src/lib/entrenoDatos.js): el encabezado, las cifras, la barra de
// avance, «Cambiar» y lo que se anota en el registro de siempre al darle «Listo».
//
//   node scripts/prueba-entreno-datos.mjs
import assert from 'node:assert/strict';
import { pasosDeLaSesion, marcaListo, saltaPaso, vistaDelEntreno } from '../src/lib/entreno.js';
import {
  relojDe, lineaDeAvance, cifrasDelPaso, textoDeLoPlaneado, segmentosDeAvance, gruposDeLaLista, subtituloDeLaLista, cantidadPlaneada,
  camposDeCambiar, exDataTrasListo,
} from '../src/lib/entrenoDatos.js';
import { parcheDeLapsos } from '../src/lib/lapsos.js';
import { palabrasDelEntreno } from '../src/lib/entrenoPalabras.js';
import { parcheDeVueltas, vueltasAnotadas } from '../src/lib/porVuelta.js';

const ex = (name, o = {}) => ({ name, ...o });
const lower = {
  day: 'Lun', name: 'Lower Strength', cat: 'gym',
  exercises: [
    ex('Back Squat', { sets: '5', reps: '5', intensity: '78%', descanso: '150 seg', descansoSet: '3 min' }),
    ex('Bulgarian Split Squat', { sets: '3', reps: '6', porLado: true, intensity: 'RIR 2', set: 2 }),
    ex('Hip Thrust', { sets: '3', reps: '8', intensity: 'RIR 2', descanso: '90 seg', set: 2 }),
    ex('Plancha lateral', { sets: '2', reps: '30', unidad: 'seg', porLado: true }),
  ],
};

/* ---- El reloj ---- */
{
  assert.equal(relojDe(150), '2:30');
  assert.equal(relojDe(5), '0:05');
  assert.equal(relojDe(0), '0:00');
  assert.equal(relojDe(3900), '1:05:00');
  assert.equal(relojDe(-4), '0:00');
  assert.equal(relojDe(59.6), '1:00');
  assert.equal(relojDe('x'), '0:00');
}

/* ---- Dónde va ---- */
{
  const plan = pasosDeLaSesion(lower);
  assert.equal(lineaDeAvance(plan, plan.pasos[0]), 'Serie 1 de 3 · Vuelta 1 de 5');
  const bi = plan.pasos.find((p) => p.nombre === 'Hip Thrust');
  assert.equal(lineaDeAvance(plan, bi), 'Serie 2 de 3 · Vuelta 1 de 3');
  // Con un Set sin vueltas no se dice «vuelta 1 de 1».
  const solo = pasosDeLaSesion({ cat: 'gym', exercises: [ex('A', { sets: '1' }), ex('B', { sets: '2', set: 7 }), ex('C', { sets: '2', set: 7 })] });
  assert.equal(lineaDeAvance(solo, solo.pasos[0]), 'Serie 1 de 2');
  // Un día de puros nombres: «Ejercicio 2 de 4».
  const poca = pasosDeLaSesion({ cat: 'gym', exercises: [ex('A'), ex('B'), ex('C'), ex('D')] });
  assert.equal(lineaDeAvance(poca, poca.pasos[1]), 'Ejercicio 2 de 4');
  // Un rango de vueltas.
  const vel = pasosDeLaSesion({ cat: 'speed', exercises: [ex('Sprint', { sets: '5-6', reps: '30', unidad: 'yd' }), ex('Roller', { reps: '5', unidad: 'min' })] });
  assert.equal(lineaDeAvance(vel, vel.pasos[1]), 'Serie 1 de 2 · Vuelta 2 de 5-6');
  // Lapsos.
  const lap = pasosDeLaSesion({
    cat: 'correr', exercises: [ex('Correr', { sets: '4', ...parcheDeLapsos([{ reps: '800', unidad: 'm', intensity: '', descanso: '' }, { reps: '2', unidad: 'min', intensity: '', descanso: '' }]) })],
  });
  assert.equal(lineaDeAvance(lap, lap.pasos[1]), 'Serie 1 de 1 · Vuelta 1 de 4 · Lapso 2 de 2');
  // Notas.
  const notas = pasosDeLaSesion({ cat: 'speed', exercises: [{ isNote: true, text: 'Sprint 6 x 30 yd' }, { isNote: true, text: 'Foam roller' }] });
  assert.equal(lineaDeAvance(notas, notas.pasos[1]), 'Paso 2 de 2');
  assert.equal(lineaDeAvance(plan, null), '');
}

/* ---- Las cifras ---- */
{
  const plan = pasosDeLaSesion(lower);
  // Back Squat: 5 reps · 78% carga · ≈105 kg
  const kilos = { valor: 105, unidad: 'kg', aprox: true };
  assert.deepEqual(cifrasDelPaso(plan.pasos[0], kilos), [
    { valor: '5', etiqueta: 'reps' },
    { valor: '78%', etiqueta: 'carga' },
    { valor: '≈105', etiqueta: 'kg', destacado: true },
  ]);
  assert.equal(textoDeLoPlaneado(plan.pasos[0], kilos), '5 reps · 78% carga · ≈105 kg');
  // Sin 1RM no hay casilla de kilos y la línea sigue diciendo lo que sí se sabe.
  assert.equal(cifrasDelPaso(plan.pasos[0], null).length, 2);
  assert.equal(textoDeLoPlaneado(plan.pasos[0]), '5 reps · 78% carga');
  // «6 reps por lado» + RIR.
  const bulgaro = plan.pasos.find((p) => p.nombre === 'Bulgarian Split Squat');
  assert.deepEqual(cifrasDelPaso(bulgaro), [{ valor: '6', etiqueta: 'reps por lado' }, { valor: '2', etiqueta: 'RIR' }]);
  assert.equal(textoDeLoPlaneado(bulgaro), '6 reps por lado · RIR 2');
  // Tiempo por lado.
  const plancha = plan.pasos.find((p) => p.nombre === 'Plancha lateral');
  assert.deepEqual(cifrasDelPaso(plancha), [{ valor: '30', etiqueta: 'seg por lado' }]);
  // Solo el nombre: no hay cifras ni línea.
  const nombre = pasosDeLaSesion({ cat: 'gym', exercises: [ex('Sentadilla')] }).pasos[0];
  assert.deepEqual(cifrasDelPaso(nombre), []);
  assert.equal(textoDeLoPlaneado(nombre), '');
  // Rangos, ritmos, zonas, texto libre y un peso fijo.
  const varios = pasosDeLaSesion({
    cat: 'gym',
    exercises: [
      ex('Curl', { reps: '8-10', intensity: '20 kg' }),
      ex('Correr', { reps: '800', unidad: 'm', intensity: '4:34-5:00 min/km' }),
      ex('Rodaje', { reps: '5', unidad: 'km', intensity: 'Zona 2-3' }),
      ex('Sprint', { reps: '1', intensity: 'Máximo' }),
      ex('Remo', { reps: 'AMRAP', intensity: 'RPE 7-8' }),
      ex('Cluster', { reps: '2+2+2', unidad: 'cluster' }),
      ex('Press', { reps: '10', intensity: '85% intensidad' }),
    ],
  }).pasos;
  assert.deepEqual(cifrasDelPaso(varios[0], { valor: 20, unidad: 'kg', aprox: false }), [{ valor: '8–10', etiqueta: 'reps' }, { valor: '20', etiqueta: 'kg', destacado: true }], 'un peso fijo no repite su cifra de carga');
  assert.equal(textoDeLoPlaneado(varios[0], { valor: 20, unidad: 'kg', aprox: false }), '8-10 reps · 20 kg');
  assert.equal(textoDeLoPlaneado(varios[0]), '8-10 reps · 20 kg', 'sin kilos calculados, dice el peso del coach');
  assert.deepEqual(cifrasDelPaso(varios[1]), [{ valor: '800', etiqueta: 'm' }, { valor: '4:34–5:00', etiqueta: 'min/km' }]);
  assert.deepEqual(cifrasDelPaso(varios[2]), [{ valor: '5', etiqueta: 'km' }, { valor: 'Z2–3', etiqueta: 'zona' }]);
  assert.deepEqual(cifrasDelPaso(varios[3]), [{ valor: '1', etiqueta: 'reps' }, { valor: 'Máximo', etiqueta: 'carga', texto: true }]);
  assert.deepEqual(cifrasDelPaso(varios[4]), [{ valor: 'AMRAP', etiqueta: 'meta', texto: true }, { valor: '7–8', etiqueta: 'RPE' }]);
  assert.deepEqual(cifrasDelPaso(varios[5]), [{ valor: '2+2+2', etiqueta: 'reps' }]);
  assert.deepEqual(cifrasDelPaso(varios[6]), [{ valor: '10', etiqueta: 'reps' }, { valor: '85%', etiqueta: 'intensidad' }]);
  // Lo que no es un ejercicio no tiene cifras.
  const conDescanso = pasosDeLaSesion(lower);
  assert.deepEqual(cifrasDelPaso(conDescanso.pasos[1]), []);
  assert.deepEqual(cifrasDelPaso(null), []);
}

/* ---- La barra de avance ---- */
{
  const plan = pasosDeLaSesion(lower); // Serie 1: 5 vueltas · Serie 2: bi-serie × 3 (6 pasos) · Serie 3: 2
  let av;
  assert.deepEqual(segmentosDeAvance(plan, vistaDelEntreno(plan, av, 0).estados), [0, 0, 0]);
  for (let k = 0; k < 4; k += 1) av = marcaListo(plan, av, 1000 + k); // Back Squat 1, descanso, Back Squat 2, descanso
  assert.deepEqual(segmentosDeAvance(plan, vistaDelEntreno(plan, av, 2000).estados), [2 / 5, 0, 0]);
  av = saltaPaso(plan, av, 3000); // se salta la vuelta 3: cuenta como pasado
  assert.deepEqual(segmentosDeAvance(plan, vistaDelEntreno(plan, av, 3500).estados), [3 / 5, 0, 0]);
  // Lo opcional no cuenta para el total del Set.
  const vel = pasosDeLaSesion({ cat: 'speed', exercises: [ex('Sprint', { sets: '3-4', reps: '30', unidad: 'm' })] });
  assert.deepEqual(segmentosDeAvance(vel, vistaDelEntreno(vel, marcaListo(vel, undefined, 1), 2).estados), [1 / 3]);
  // Sin Sets (puras notas): una sola pieza.
  const notas = pasosDeLaSesion({ cat: 'speed', exercises: [{ isNote: true, text: 'A' }, { isNote: true, text: 'B' }] });
  assert.deepEqual(segmentosDeAvance(notas, vistaDelEntreno(notas, marcaListo(notas, undefined, 1), 2).estados), [0.5]);
}

/* ---- La lista «Tu entreno» ---- */
{
  const plan = pasosDeLaSesion(lower);
  const grupos = gruposDeLaLista(plan);
  assert.deepEqual(grupos.map((g) => [g.titulo, g.pasos.length]), [['Serie 1', 5], ['Serie 2', 6], ['Serie 3', 2]], 'sin los descansos');
  assert.equal(grupos[0].pasos[0].i, 0);
  assert.equal(grupos[0].pasos[1].i, 2, 'el lugar real en `plan.pasos` (el descanso de en medio ocupa el 1)');
  assert.equal(subtituloDeLaLista(plan.pasos[0], { valor: 105, unidad: 'kg', aprox: true }), 'Vuelta 1 · 5 reps · 78% carga · ≈105 kg');
  const vel = pasosDeLaSesion({ cat: 'speed', exercises: [ex('Sprint', { sets: '1-2', reps: '30', unidad: 'm' })] });
  assert.equal(subtituloDeLaLista(vel.pasos[1]), 'Vuelta 2 · 30 m · Opcional');
  const notas = pasosDeLaSesion({ cat: 'speed', exercises: [{ isNote: true, text: 'A' }] });
  assert.deepEqual(gruposDeLaLista(notas).map((g) => g.titulo), [null]);
}

/* ---- «Cambiar» ---- */
{
  const plan = pasosDeLaSesion(lower);
  assert.equal(cantidadPlaneada(plan.pasos[0]), '5');
  assert.deepEqual(camposDeCambiar(plan.pasos[0], { conPeso: true }), [
    { clave: 'reps', rotulo: 'Reps', unidad: 'reps', paso: 1, planeado: '5' },
    { clave: 'kg', rotulo: 'Kilos' },
  ]);
  const plancha = plan.pasos.find((p) => p.nombre === 'Plancha lateral');
  assert.deepEqual(camposDeCambiar(plancha), [{ clave: 'reps', rotulo: 'Segundos', unidad: 'seg', paso: 5, planeado: '30' }]);
  const raros = pasosDeLaSesion({
    cat: 'gym',
    exercises: [ex('Curl', { reps: '8-10' }), ex('Snatch', { reps: '2+2+2', unidad: 'cluster' }), ex('Correr', { reps: '5', unidad: 'km' }), ex('Remo', { reps: 'AMRAP' }), ex('Sentadilla')],
  }).pasos;
  assert.equal(cantidadPlaneada(raros[0]), '8', 'de un rango vale el primero');
  assert.equal(cantidadPlaneada(raros[1]), '6', 'un cluster son todas sus reps');
  assert.deepEqual(camposDeCambiar(raros[2])[0], { clave: 'reps', rotulo: 'Kilómetros', unidad: 'km', paso: 0.5, planeado: '5' });
  const sinPlan = { clave: 'reps', rotulo: 'Reps', unidad: 'reps', paso: 1, planeado: '' };
  assert.deepEqual(camposDeCambiar(raros[3]), [sinPlan], 'un texto libre no tiene número planeado: se puede anotar lo que se hizo');
  assert.deepEqual(camposDeCambiar(raros[4]), [sinPlan], 'un nombre solo, igual: anotar, no cambiar');
  assert.deepEqual(camposDeCambiar(raros[4], { conPeso: true }), [sinPlan, { clave: 'kg', rotulo: 'Kilos' }], 'y con peso, también el peso');
  assert.deepEqual(camposDeCambiar(plan.pasos[1]), [], 'un descanso no se cambia');
}

/* ---- Lo que se anota en el registro de siempre ---- */
{
  const plan = pasosDeLaSesion(lower);
  const squat = plan.pasos[0]; // vuelta 1 de 5
  // «Listo» sin tocar nada: lo planeado, en la vuelta y con su resumen.
  let d = exDataTrasListo({ paso: squat, exData: undefined, kgPlaneados: '105', conPeso: true });
  assert.deepEqual(d, { vueltas: { 0: { repsHechas: '5', weight: '105' } }, weight: '105', repsHechas: '5' });
  // Cambió lo que salió distinto: gana sobre lo planeado.
  d = exDataTrasListo({ paso: squat, exData: undefined, kgPlaneados: '105', conPeso: true, real: { reps: '4', kg: '100' } });
  assert.deepEqual(d.vueltas[0], { repsHechas: '4', weight: '100' });
  // Ya había algo anotado (en la ficha): «Listo» no lo pisa…
  const antes = { vueltas: { 0: { repsHechas: '6', weight: '110' } }, weight: '110', repsHechas: '6' };
  assert.deepEqual(exDataTrasListo({ paso: squat, exData: antes, kgPlaneados: '105', conPeso: true }), null, 'ya estaba todo anotado');
  // …pero si lo cambia a propósito, sí.
  assert.equal(exDataTrasListo({ paso: squat, exData: antes, kgPlaneados: '105', conPeso: true, real: { kg: '112.5' } }).vueltas[0].weight, '112.5');
  // Solo llena lo que falta.
  const sinPeso = { vueltas: { 0: { repsHechas: '6' } }, repsHechas: '6' };
  assert.deepEqual(exDataTrasListo({ paso: squat, exData: sinPeso, kgPlaneados: '105', conPeso: true }).vueltas[0], { repsHechas: '6', weight: '105' });
  // Cada vuelta en su lugar: la vuelta 2 no toca la 1, y el resumen es la más pesada.
  const v2 = plan.pasos.find((p) => p.clave === '0.2.0');
  const dos = exDataTrasListo({ paso: v2, exData: d, kgPlaneados: '105', conPeso: true, real: { kg: '107.5' } });
  assert.deepEqual([dos.vueltas[0].weight, dos.vueltas[1].weight, dos.weight], ['100', '107.5', '107.5']);
  // Sin peso en el ejercicio, solo reps.
  assert.deepEqual(exDataTrasListo({ paso: squat, exData: undefined, kgPlaneados: '105', conPeso: false }).vueltas[0], { repsHechas: '5' });
  // Un ejercicio de una sola vuelta se anota a secas, sin `vueltas`.
  const plancha = plan.pasos.find((p) => p.nombre === 'Plancha lateral');
  const unica = pasosDeLaSesion({ cat: 'gym', exercises: [ex('Plancha', { reps: '30', unidad: 'seg' })] }).pasos[0];
  assert.deepEqual(exDataTrasListo({ paso: unica, exData: { notaVieja: 1 } }), { notaVieja: 1, repsHechas: '30' });
  assert.equal(plancha.vueltas, 2);
  // Un nombre solo no anota nada (ni un registro vacío).
  const nombre = pasosDeLaSesion({ cat: 'gym', exercises: [ex('Sentadilla')] }).pasos[0];
  assert.equal(exDataTrasListo({ paso: nombre, exData: undefined, conPeso: false }), null);
  assert.deepEqual(exDataTrasListo({ paso: nombre, exData: undefined, conPeso: true, real: { kg: '60' } }), { weight: '60' });
  // Un lapso de cardio no anota «reps hechas»: lo suyo queda en el avance.
  const lap = pasosDeLaSesion({
    cat: 'correr', exercises: [ex('Correr', { sets: '2', ...parcheDeLapsos([{ reps: '800', unidad: 'm', intensity: '', descanso: '' }, { reps: '2', unidad: 'min', intensity: '', descanso: '' }]) })],
  });
  assert.equal(exDataTrasListo({ paso: lap.pasos[0], exData: undefined }), null);
  // Descansos, relojes y notas tampoco.
  assert.equal(exDataTrasListo({ paso: plan.pasos[1], exData: undefined }), null);
  assert.equal(exDataTrasListo({ paso: null, exData: undefined }), null);
  // Con vueltas distintas (10 al 60 %, 8 al 70 %): lo anotado cuenta como vuelta anotada para la ficha de siempre.
  const dia = { cat: 'gym', exercises: [ex('Press', { sets: '3', ...parcheDeVueltas([{ reps: '10', intensity: '60%' }, { reps: '8', intensity: '70%' }, { reps: '6', intensity: '80%' }]) })] };
  const pv = pasosDeLaSesion(dia).pasos;
  let reg;
  pv.forEach((p) => { reg = exDataTrasListo({ paso: p, exData: reg, kgPlaneados: null, conPeso: false }); });
  assert.equal(vueltasAnotadas(reg, 3), 3);
  assert.deepEqual([reg.vueltas[0].repsHechas, reg.vueltas[1].repsHechas, reg.vueltas[2].repsHechas], ['10', '8', '6']);
  // Todo es JSON puro.
  assert.deepEqual(JSON.parse(JSON.stringify(reg)), reg);
}

/* ---- Las palabras ---- */
{
  const normal = palabrasDelEntreno(false);
  const salud = palabrasDelEntreno(true);
  assert.deepEqual(Object.keys(salud).sort(), Object.keys(normal).sort(), 'un paciente tiene todos los mismos textos (ninguno se queda sin decir)');
  assert.equal(normal.iniciar, 'Iniciar entreno');
  assert.equal(salud.iniciar, 'Iniciar ejercicios');
  assert.match(normal.finTexto, /coach/);
  assert.match(salud.finTexto, /fisio/);
  assert.doesNotMatch(Object.values(salud).join(' '), /entren|coach/i, 'ni «entreno» ni «coach» le llegan a un paciente');
  assert.match(normal.tecnicaTitulo, /Grabar técnica para tu coach/);
  assert.match(salud.tecnicaTitulo, /fisio/);
}

console.log('prueba-entreno-datos: todo bien');
