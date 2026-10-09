// Prueba de lo que las pantallas del modo entreno dicen de un paso (src/lib/entrenoDatos.js): el encabezado, las cifras, la barra de
// avance, «Cambiar» y lo que se anota en el registro de siempre al darle «Listo».
//
//   node scripts/prueba-entreno-datos.mjs
import assert from 'node:assert/strict';
import { pasosDeLaSesion, marcaListo, saltaPaso, vistaDelEntreno } from '../src/lib/entreno.js';
import {
  relojDe, tiempoTotal, cifrasDelPaso, textoDeCifra, pastillasDelPaso, textoDeLoPlaneado, segmentosDeAvance, puntosDeVueltas, serieALaVista,
  tarjetasDeLaLista, cantidadPlaneada, camposDeCambiar, exDataTrasListo,
} from '../src/lib/entrenoDatos.js';
import { parcheDeLapsos } from '../src/lib/lapsos.js';
import { ponFormato } from '../src/lib/formatos.js';
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

/* ---- El tiempo total, callado ---- */
{
  assert.equal(tiempoTotal(0), '0:00');
  assert.equal(tiempoTotal(75_000), '1:15');
  assert.equal(tiempoTotal(3_725_000), '1:02:05');
  assert.equal(tiempoTotal(null), null, 'sin iniciar no hay tiempo');
  assert.equal(tiempoTotal(undefined), null);
  assert.equal(tiempoTotal(-5), null);
  assert.equal(tiempoTotal(6 * 3600 * 1000), '6:00:00');
  assert.equal(tiempoTotal(6 * 3600 * 1000 + 1), null, 'retomado al día siguiente: nada, no «26:12:00»');
}

/* ---- Las vueltas, en puntos ---- */
{
  const plan = pasosDeLaSesion(lower);
  const estados = (av) => vistaDelEntreno(plan, av, 0).estados;
  const estadosDe = (puntos) => puntos.map((p) => p.estado);
  // Back Squat × 5: al empezar, la primera es la que va.
  assert.deepEqual(estadosDe(puntosDeVueltas(plan, estados(undefined), 1, '0.1.0')), ['actual', 'pendiente', 'pendiente', 'pendiente', 'pendiente']);
  // Hecha la vuelta 1 (y su descanso): la 2 es la que va.
  let av;
  for (let k = 0; k < 2; k += 1) av = marcaListo(plan, av, 1000 + k);
  assert.deepEqual(estadosDe(puntosDeVueltas(plan, estados(av), 1, '0.2.0')), ['hecha', 'actual', 'pendiente', 'pendiente', 'pendiente']);
  // Una vuelta saltada también queda atrás.
  av = saltaPaso(plan, av, 2000);
  assert.deepEqual(estadosDe(puntosDeVueltas(plan, estados(av), 1, '0.3.0')), ['hecha', 'hecha', 'actual', 'pendiente', 'pendiente']);
  // En una bi-serie la vuelta está hecha cuando están hechos LOS DOS ejercicios.
  const bi = puntosDeVueltas(plan, estados(undefined), 2, '1.1.0');
  assert.equal(bi.length, 3);
  av = marcaListo(plan, undefined, 3000, undefined, '1.1.0'); // solo el 1.º de la bi-serie
  assert.deepEqual(estadosDe(puntosDeVueltas(plan, estados(av), 2, '2.1.0')), ['actual', 'pendiente', 'pendiente'], 'a medias sigue siendo la que va');
  // Un Set que no se repite no lleva puntos.
  const solo = pasosDeLaSesion({ cat: 'gym', exercises: [ex('A', { sets: '1' }), ex('B', { sets: '2', set: 7 }), ex('C', { sets: '2', set: 7 })] });
  assert.deepEqual(puntosDeVueltas(solo, vistaDelEntreno(solo, undefined, 0).estados, 1, '0.1.0'), []);
  assert.equal(puntosDeVueltas(solo, vistaDelEntreno(solo, undefined, 0).estados, 2, '1.1.0').length, 2);
  // Un rango de vueltas: las de más son opcionales (punteadas).
  const vel = pasosDeLaSesion({ cat: 'speed', exercises: [ex('Sprint', { sets: '5-6', reps: '30', unidad: 'yd' })] });
  const pv = puntosDeVueltas(vel, vistaDelEntreno(vel, undefined, 0).estados, 1, '0.1.0');
  assert.equal(pv.length, 6);
  assert.deepEqual(pv.map((p) => p.opcional), [false, false, false, false, false, true]);
  // Un reloj no se cuenta en vueltas (no son pasos de ejercicio).
  const amrap = pasosDeLaSesion({ cat: 'gym', exercises: ponFormato([ex('Burpees', { set: 1 })], { id: 'amrap', pasos: [{ tipo: 'trabajo', seg: 720 }], vueltas: 1, tope: null, turnan: false, anota: 'rondas' }) });
  assert.deepEqual(puntosDeVueltas(amrap, vistaDelEntreno(amrap, undefined, 0).estados, 1, 'r.0'), []);
}

/* ---- La serie a la vista: bi-serie, tri-serie, circuito ---- */
{
  const plan = pasosDeLaSesion(lower);
  const hip = plan.pasos.find((p) => p.nombre === 'Hip Thrust');
  const antes = serieALaVista(plan, vistaDelEntreno(plan, undefined, 0).estados, hip);
  assert.deepEqual(antes, {
    nombre: 'Bi-serie',
    letras: [{ letra: 'A', nombre: 'Bulgarian Split Squat', estado: 'pendiente' }, { letra: 'B', nombre: 'Hip Thrust', estado: 'actual' }],
  });
  // Lunges hecho, toca Squat jumps: A con palomita, B es el que va.
  const av = marcaListo(plan, undefined, 1000, undefined, '1.1.0');
  const bulgaro = plan.pasos.find((p) => p.nombre === 'Bulgarian Split Squat');
  assert.deepEqual(serieALaVista(plan, vistaDelEntreno(plan, av, 0).estados, hip).letras.map((l) => [l.letra, l.estado]), [['A', 'hecho'], ['B', 'actual']]);
  assert.deepEqual(serieALaVista(plan, vistaDelEntreno(plan, av, 0).estados, bulgaro).letras.map((l) => l.estado), ['actual', 'pendiente'], 'se mira cada paso con sus ojos');
  // En la vuelta 2 los dos vuelven a quedar por hacer.
  const v2 = plan.pasos.find((p) => p.nombre === 'Hip Thrust' && p.vuelta === 2);
  assert.deepEqual(serieALaVista(plan, vistaDelEntreno(plan, av, 0).estados, v2).letras.map((l) => l.estado), ['pendiente', 'actual']);
  // Un Set de un ejercicio no tiene serie que enseñar; un descanso tampoco.
  assert.equal(serieALaVista(plan, vistaDelEntreno(plan, undefined, 0).estados, plan.pasos[0]), null);
  assert.equal(serieALaVista(plan, vistaDelEntreno(plan, undefined, 0).estados, plan.pasos[1]), null);
  assert.equal(serieALaVista(plan, vistaDelEntreno(plan, undefined, 0).estados, null), null);
  // Tri-serie y circuito se llaman como en el editor.
  const tres = pasosDeLaSesion({ cat: 'gym', exercises: [ex('A', { sets: '2', set: 1 }), ex('B', { set: 1 }), ex('C', { set: 1 })] });
  assert.equal(serieALaVista(tres, vistaDelEntreno(tres, undefined, 0).estados, tres.pasos[0]).nombre, 'Tri-serie');
  const cuatro = pasosDeLaSesion({ cat: 'gym', exercises: [ex('A', { set: 1 }), ex('B', { set: 1 }), ex('C', { set: 1 }), ex('D', { set: 1 })] });
  const circuito = serieALaVista(cuatro, vistaDelEntreno(cuatro, undefined, 0).estados, cuatro.pasos[2]);
  assert.equal(circuito.nombre, 'Circuito');
  assert.deepEqual(circuito.letras.map((l) => l.letra), ['A', 'B', 'C', 'D']);
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
  assert.equal(textoDeLoPlaneado(plan.pasos[0], kilos), '5 reps · 78% · ≈105 kg');
  // Sin 1RM no hay casilla de kilos y la línea sigue diciendo lo que sí se sabe.
  assert.equal(cifrasDelPaso(plan.pasos[0], null).length, 2);
  assert.equal(textoDeLoPlaneado(plan.pasos[0]), '5 reps · 78%');
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
  assert.equal(textoDeLoPlaneado(varios[0], { valor: 20, unidad: 'kg', aprox: false }), '8–10 reps · 20 kg');
  assert.equal(textoDeLoPlaneado(varios[0]), '8–10 reps · 20 kg', 'sin kilos calculados, dice el peso del coach');
  assert.deepEqual(cifrasDelPaso(varios[1]), [{ valor: '800', etiqueta: 'm' }, { valor: '4:34–5:00', etiqueta: 'min/km' }]);
  assert.deepEqual(cifrasDelPaso(varios[2]), [{ valor: '5', etiqueta: 'km' }, { valor: 'Z2–3', etiqueta: 'zona' }]);
  assert.deepEqual(cifrasDelPaso(varios[3]), [{ valor: '1', etiqueta: 'reps' }, { valor: 'Máximo', etiqueta: 'carga', texto: true }]);
  assert.deepEqual(cifrasDelPaso(varios[4]), [{ valor: 'AMRAP', etiqueta: 'meta', texto: true }, { valor: '7–8', etiqueta: 'RPE' }]);
  assert.deepEqual(cifrasDelPaso(varios[5]), [{ valor: '2+2+2', etiqueta: 'reps' }]);
  assert.deepEqual(cifrasDelPaso(varios[6]), [{ valor: '10', etiqueta: 'reps' }, { valor: '85%', etiqueta: 'intensidad' }]);
  // Las pastillas de las listas: el nombre de la carga sobra donde el «%» o la «Z» ya lo dicen; RIR y RPE sí van.
  assert.deepEqual(pastillasDelPaso(plan.pasos[0], kilos), [{ texto: '5 reps', fuerte: false }, { texto: '78%', fuerte: false }, { texto: '≈105 kg', fuerte: true }]);
  assert.deepEqual(pastillasDelPaso(bulgaro).map((x) => x.texto), ['6 reps por lado', 'RIR 2']);
  assert.deepEqual(pastillasDelPaso(varios[1]).map((x) => x.texto), ['800 m', '4:34–5:00 min/km']);
  assert.deepEqual(pastillasDelPaso(varios[2]).map((x) => x.texto), ['5 km', 'Z2–3']);
  assert.deepEqual(pastillasDelPaso(varios[3]).map((x) => x.texto), ['1 reps', 'Máximo']);
  assert.deepEqual(pastillasDelPaso(varios[4]).map((x) => x.texto), ['AMRAP', 'RPE 7–8']);
  assert.deepEqual(pastillasDelPaso(varios[6]).map((x) => x.texto), ['10 reps', '85%']);
  assert.deepEqual(pastillasDelPaso(nombre), []);
  assert.equal(textoDeCifra(null), '');
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

/* ---- «Ver todo»: una tarjeta por Set ---- */
{
  const plan = pasosDeLaSesion(lower);
  const estados = (av) => vistaDelEntreno(plan, av, 0).estados;
  const t0 = tarjetasDeLaLista(plan, estados(undefined), '0.1.0');
  assert.deepEqual(t0.map((t) => [t.titulo, t.etiqueta, t.filas.length, t.puntos.length]), [['Serie 1', null, 1, 5], ['Serie 2', 'Bi-serie', 2, 3], ['Serie 3', null, 1, 2]]);
  assert.deepEqual(t0.map((t) => t.esActual), [true, false, false]);
  assert.deepEqual(t0[0].filas[0], { idx: 0, nombre: 'Back Squat', estado: 'actual', clave: '0.1.0', pastillas: [{ texto: '5 reps', fuerte: false }, { texto: '78%', fuerte: false }] });
  assert.deepEqual(t0[1].filas.map((f) => [f.nombre, f.estado, f.clave]), [['Bulgarian Split Squat', 'pendiente', '1.1.0'], ['Hip Thrust', 'pendiente', '2.1.0']]);
  // Con los kilos del 1RM, la pastilla azul.
  const conKilos = tarjetasDeLaLista(plan, estados(undefined), '0.1.0', { kilosDe: (p) => (p.nombre === 'Back Squat' ? { valor: 105, unidad: 'kg', aprox: true } : null) });
  assert.deepEqual(conKilos[0].filas[0].pastillas.map((x) => [x.texto, x.fuerte]), [['5 reps', false], ['78%', false], ['≈105 kg', true]]);
  // Hechas las 5 vueltas de Back Squat: su fila queda hecha y ya no lleva a ningún lado; la bi-serie es la que va.
  let av;
  for (let k = 0; k < 10; k += 1) av = marcaListo(plan, av, 1000 + k);
  const t1 = tarjetasDeLaLista(plan, estados(av), '1.1.0');
  assert.deepEqual([t1[0].filas[0].estado, t1[0].filas[0].clave, t1[0].esActual], ['hecho', null, false]);
  assert.deepEqual(t1[0].puntos.map((p) => p.estado), ['hecha', 'hecha', 'hecha', 'hecha', 'hecha']);
  assert.deepEqual([t1[1].filas[0].estado, t1[1].esActual], ['actual', true]);
  // Una fila a medias lleva a su primera vuelta pendiente (no a la que ya hizo).
  av = marcaListo(plan, av, 2000); // Bulgarian 1
  av = marcaListo(plan, av, 2001); // Hip Thrust 1
  const t2 = tarjetasDeLaLista(plan, estados(av), '1.2.0');
  assert.equal(t2[1].filas[0].clave, '1.2.0');
  assert.equal(t2[1].filas[1].clave, '2.2.0');
  // Lo saltado: si no queda nada por hacer del ejercicio pero se saltó algo, se marca «saltado» y sigue llevando a él.
  const dos = pasosDeLaSesion({ cat: 'gym', exercises: [ex('A', { sets: '2', reps: '5' }), ex('B', { reps: '5' })] });
  let a2 = saltaPaso(dos, undefined, 1000);
  a2 = marcaListo(dos, a2, 1001);
  const ts = tarjetasDeLaLista(dos, vistaDelEntreno(dos, a2, 0).estados, '1.1.0');
  assert.deepEqual([ts[0].filas[0].estado, ts[0].filas[0].clave], ['saltado', '0.1.0']);
  // Un día de puros nombres: una tarjeta por ejercicio, sin título.
  const nombres = pasosDeLaSesion({ cat: 'gym', exercises: [ex('A'), ex('B')] });
  assert.deepEqual(tarjetasDeLaLista(nombres, vistaDelEntreno(nombres, undefined, 0).estados, '0.1.0').map((t) => [t.titulo, t.filas.map((f) => f.nombre)]), [['Serie 1', ['A']], ['Serie 2', ['B']]]);
  // Un día de puras notas: sin título de serie, una fila por nota.
  const notas = pasosDeLaSesion({ cat: 'speed', exercises: [{ isNote: true, text: 'A' }, { isNote: true, text: 'B' }] });
  const tn = tarjetasDeLaLista(notas, vistaDelEntreno(notas, undefined, 0).estados, 'n.0');
  assert.equal(tn.length, 1, 'todas las notas en una sola tarjeta');
  assert.deepEqual(tn[0].filas.map((f) => [tn[0].titulo, f.nombre, f.estado]), [[null, 'A', 'actual'], [null, 'B', 'pendiente']]);
  // Un AMRAP: una tarjeta con su formato por etiqueta y una fila por ejercicio; el resultado, si ya quedó anotado.
  const amrap = pasosDeLaSesion({
    cat: 'gym',
    exercises: ponFormato([ex('Burpees', { reps: '10', set: 3 }), ex('Swings', { reps: '15', intensity: '24 kg', set: 3 })], { id: 'amrap', pasos: [{ tipo: 'trabajo', seg: 720 }], vueltas: 1, tope: null, turnan: false, anota: 'rondas' }),
  });
  const ta = tarjetasDeLaLista(amrap, vistaDelEntreno(amrap, undefined, 0).estados, 'r.0', { resultadoDe: () => '8 rondas' });
  assert.deepEqual([ta[0].reloj, ta[0].etiqueta, ta[0].resultado, ta[0].puntos], [true, 'AMRAP · 12 min', '8 rondas', []]);
  assert.deepEqual(ta[0].filas.map((f) => [f.nombre, f.estado, f.clave, f.pastillas.map((x) => x.texto)]), [['Burpees', 'actual', 'r.0', ['10 reps']], ['Swings', 'actual', 'r.0', ['15 reps', '24 kg']]]);
  // Un Set en lapsos con reloj: «4 rondas» y lo que se corre en cada una, de lapso en lapso.
  const lap = pasosDeLaSesion({
    cat: 'correr', exercises: [ex('Correr', { sets: '4', ...parcheDeLapsos([{ reps: '800', unidad: 'm', intensity: '', descanso: '' }, { reps: '2', unidad: 'min', intensity: '', descanso: '' }]) })],
  });
  const tl = tarjetasDeLaLista(lap, vistaDelEntreno(lap, undefined, 0).estados, 'r.0');
  assert.deepEqual([tl[0].reloj, tl[0].etiqueta, tl[0].filas[0].pastillas.map((x) => x.texto)], [true, '4 rondas', ['800 m → 2 min']]);
  // Hecho el reloj, la fila ya no lleva a ningún lado.
  const hecho = marcaListo(lap, undefined, 1000);
  assert.deepEqual([tarjetasDeLaLista(lap, vistaDelEntreno(lap, hecho, 0).estados, null)[0].filas[0].estado, tarjetasDeLaLista(lap, vistaDelEntreno(lap, hecho, 0).estados, null)[0].filas[0].clave], ['hecho', null]);
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
  assert.match(normal.finNotas, /coach/);
  assert.match(salud.finNotas, /fisio/);
  assert.doesNotMatch(Object.values(salud).join(' '), /entren|coach/i, 'ni «entreno» ni «coach» le llegan a un paciente');
  assert.match(normal.tecnicaTitulo, /Grabar técnica para tu coach/);
  assert.match(salud.tecnicaTitulo, /fisio/);
}

console.log('prueba-entreno-datos: todo bien');
