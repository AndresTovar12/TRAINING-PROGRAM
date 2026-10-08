// Prueba de los lapsos de un ejercicio (src/lib/lapsos.js): el espejo en los campos de siempre, entrar y salir de
// «Lapsos personalizados» sin perder nada que no se avise, cómo viajan por parseBlocks/serializeBlocks y los tramos del reloj.
//
//   node scripts/prueba-lapsos.mjs
import assert from 'node:assert/strict';
import {
  traeLapsos, lapsosDe, lapsoDeLinea, esLineaSinEstrenar, parcheDeLapsos, aLapsos, aNormal, conLapsosSegun, perderiaLapsos, perderiaVueltas,
  tramosDeLapsos, segundosDeLapso, descansoDeLapsoEnSegundos, cuantoDeLapso,
} from '../src/lib/lapsos.js';
import { parseBlocks, serializeBlocks } from '../src/lib/setsDeUnaSesion.js';

const correr = {
  name: 'Correr', sets: '4', reps: '800', unidad: 'm', intensity: '4:34-5:00 min/km', descanso: '',
};

/* ---- Entrar a lapsos: el ejercicio pasa a tener UN lapso, el de su línea ---- */
{
  const e = aLapsos(correr);
  assert.equal(traeLapsos(e), true);
  assert.deepEqual(lapsosDe(e), [{ reps: '800', unidad: 'm', intensity: '4:34-5:00 min/km', descanso: '' }]);
  assert.equal(e.reps, '800', 'el espejo: reps = las del primer lapso');
  assert.equal(e.intensity, '4:34-5:00 min/km');
  assert.equal('porVuelta' in e, false);
  assert.deepEqual(aNormal(e), { ...correr }, 'entrar y salir sin tocar nada es el mismo ejercicio');
}

/* ---- Varios lapsos: el espejo y el descanso del último ---- */
{
  const lapsos = [
    { reps: '800', unidad: 'm', intensity: '4:34-5:00 min/km', descanso: '30 seg' },
    { reps: '2', unidad: 'min', intensity: '6:39-7:00 min/km', descanso: '1 min' },
  ];
  const e = { ...correr, ...parcheDeLapsos(lapsos) };
  assert.equal(e.reps, '800', 'reps = las del primero');
  assert.equal(e.unidad, 'm');
  assert.equal(e.descanso, '1 min', 'descanso = el del último');
  assert.equal(lapsosDe(e).length, 2);
  // Volver a Normal se queda con el primero (y su descanso).
  const n = aNormal(e);
  assert.equal(traeLapsos(n), false);
  assert.deepEqual([n.reps, n.unidad, n.intensity, n.descanso], ['800', 'm', '4:34-5:00 min/km', '30 seg']);
  assert.equal(perderiaLapsos([e]), true, 'salir con 2 lapsos quita uno: se pregunta');
  assert.equal(perderiaLapsos([aLapsos(correr)]), false, 'salir con 1 lapso no quita nada');
  // Los lapsos mandan sobre las vueltas distintas.
  const conVueltas = { ...correr, porVuelta: [{ reps: '800', intensity: '' }, { reps: '600', intensity: '' }, { reps: '400', intensity: '' }, { reps: '200', intensity: '' }] };
  assert.equal(perderiaVueltas([conVueltas]), true, 'entrar a lapsos con vueltas distintas se pregunta');
  assert.equal(perderiaVueltas([correr]), false);
  assert.equal('porVuelta' in aLapsos(conVueltas), false);
}

/* ---- Cada lapso, en lo que sea: reps, segundos, metros… ---- */
{
  const thruster = aLapsos({ name: 'Thruster', sets: '4', reps: '10', intensity: '40 kg' });
  assert.deepEqual(lapsosDe(thruster), [{ reps: '10', unidad: 'reps', intensity: '40 kg', descanso: '' }]);
  assert.equal(cuantoDeLapso(thruster, lapsosDe(thruster)[0]), '10 reps');
  assert.equal(cuantoDeLapso(correr, { reps: '2', unidad: 'min', intensity: '', descanso: '' }), '2 min');
  // Un texto que no se entiende («Máximas») se respeta tal cual.
  assert.deepEqual(lapsoDeLinea({ reps: 'Máximas', unidad: 'reps' }), { reps: 'Máximas', unidad: 'reps', intensity: '', descanso: '' });
}

/* ---- Por los Sets de una sesión: todos los ejercicios del Set entran y salen juntos ---- */
{
  const sesion = [
    { name: 'Correr', sets: '4', reps: '800', unidad: 'm', intensity: '4:34 min/km', set: 1 },
    { name: 'Thruster', sets: '4', reps: '10', intensity: '40 kg', set: 1 },
    { name: 'Plancha', sets: '3', reps: '30', unidad: 'seg' },
  ];
  const bloques = parseBlocks(sesion);
  assert.equal(bloques[0].lapsos, false, 'sin lapsos no hay lapsos');
  bloques[0].lapsos = true;
  const guardada = serializeBlocks(bloques);
  assert.equal(guardada.length, 3);
  assert.equal(guardada[0].lapsos.length, 1);
  assert.equal(guardada[1].lapsos.length, 1, 'el segundo ejercicio del Set también entra');
  assert.equal(guardada[2].lapsos, undefined, 'un Set aparte no se toca');
  assert.equal(parseBlocks(guardada)[0].lapsos, true, 'al volver a leerse, el Set sigue en lapsos');
  // Con un formato de reloj encima, los lapsos se van (un solo lugar para cada dato).
  const reloj = parseBlocks(guardada);
  reloj[0].formato = { id: 'amrap', pasos: [{ tipo: 'trabajo', seg: 720 }], vueltas: 1, tope: null, turnan: false, anota: 'rondas' };
  const conReloj = serializeBlocks(reloj);
  assert.equal(conReloj[0].lapsos, undefined, 'un formato de reloj quita los lapsos');
  assert.ok(conReloj[0].formato);
  // Y de vuelta a Normal: nadie guarda lapsos.
  const normal = parseBlocks(guardada);
  normal[0].lapsos = false;
  const sinLapsos = serializeBlocks(normal);
  assert.equal(sinLapsos[0].lapsos, undefined);
  assert.equal(sinLapsos[1].lapsos, undefined);
  // Un ejercicio que llega a un Set de lapsos recibe uno.
  const nuevo = parseBlocks(guardada);
  nuevo[0].members.push({ name: 'Wall Ball', sets: '4', reps: '15', intensity: '6 kg' });
  assert.equal(serializeBlocks(nuevo)[2].lapsos.length, 1, 'el ejercicio agregado entra con su lapso');
}

/* ---- conLapsosSegun no toca lo que ya está bien ---- */
{
  const ya = aLapsos(correr);
  assert.equal(conLapsosSegun([ya], true)[0], ya, 'ya en lapsos: la misma cosa');
  assert.equal(conLapsosSegun([correr], false)[0], correr, 'ya normal: la misma cosa');
  const nota = { isNote: true, text: 'Hola' };
  assert.equal(conLapsosSegun([nota], true)[0], nota);
}

/* ---- El reloj: los tramos, en orden ---- */
{
  const miembros = [
    aLapsos({ name: 'Correr', reps: '', ...{} }),
  ];
  // Correr: 800 m (descansa 30 seg) y 2 min (descansa 1 min); Thruster: 10 reps; 2 rondas.
  const c = { name: 'Correr', sets: '2', ...parcheDeLapsos([
    { reps: '800', unidad: 'm', intensity: '4:34 min/km', descanso: '30 seg' },
    { reps: '2', unidad: 'min', intensity: '6:39 min/km', descanso: '1 min' },
  ]) };
  const t = { name: 'Thruster', sets: '2', ...parcheDeLapsos([{ reps: '10', unidad: 'reps', intensity: '40 kg', descanso: '' }]) };
  assert.ok(miembros.length === 1);
  const plan = tramosDeLapsos([c, t], '2');
  const resumen = plan.map((x) => `${x.vuelta}${x.tipo === 'trabajo' ? 'T' : 'D'}${x.seg === null ? '?' : x.seg}`);
  assert.deepEqual(resumen, [
    '1T?', '1D30', '1T120', '1D60', '1T?',          // ronda 1: 800 m (hasta «Listo»), 2 min, Thruster
    '2T?', '2D30', '2T120', '2D60', '2T?',          // ronda 2
  ]);
  assert.equal(plan[0].etiqueta, 'Correr');
  assert.equal(plan[0].texto, '800 m');
  assert.equal(plan[0].carga, '4:34 min/km');
  assert.equal(plan[2].texto, '2 min');
  assert.deepEqual(plan.map((x) => x.n), [...plan.keys()], 'numerados en orden');
  assert.equal(plan[4].ejercicio, 1, 'el Thruster es el ejercicio 1');
  assert.equal(plan[0].de, 2, 'Correr tiene 2 lapsos');
  // El descanso tras el último lapso de todo no se cuenta.
  const sola = tramosDeLapsos([{ name: 'Remo', ...parcheDeLapsos([{ reps: '500', unidad: 'm', intensity: '', descanso: '2 min' }]) }], '1');
  assert.deepEqual(sola.map((x) => x.tipo), ['trabajo'], 'sin descanso al final');
  // Sin series o con un rango, una ronda.
  assert.equal(tramosDeLapsos([c], null).filter((x) => x.tipo === 'trabajo').length, 2);
  assert.equal(tramosDeLapsos([c], '4-6').filter((x) => x.tipo === 'trabajo').length, 2);
  // Un ejercicio normal dentro de un Set de lapsos corre como un lapso.
  assert.equal(tramosDeLapsos([{ name: 'Salto', reps: '30', unidad: 'seg' }], '1')[0].seg, 30);
}

/* ---- Segundos de un lapso y de su descanso ---- */
{
  const e = { name: 'X' };
  assert.equal(segundosDeLapso(e, { reps: '45', unidad: 'seg' }), 45);
  assert.equal(segundosDeLapso(e, { reps: '2', unidad: 'min' }), 120);
  assert.equal(segundosDeLapso(e, { reps: '1.5', unidad: 'min' }), 90);
  assert.equal(segundosDeLapso(e, { reps: '800', unidad: 'm' }), null, 'metros: sin cuenta regresiva');
  assert.equal(segundosDeLapso(e, { reps: '20-30', unidad: 'seg' }), null, 'un rango no es un tiempo');
  assert.equal(segundosDeLapso(e, { reps: '', unidad: 'seg' }), null);
  assert.equal(descansoDeLapsoEnSegundos({ descanso: '90 seg' }), 90);
  assert.equal(descansoDeLapsoEnSegundos({ descanso: '2 min' }), 120);
  assert.equal(descansoDeLapsoEnSegundos({ descanso: '60-90 seg' }), 60, 'de un rango, el primero');
  assert.equal(descansoDeLapsoEnSegundos({ descanso: 'Recuperación total' }), null);
  assert.equal(descansoDeLapsoEnSegundos({ descanso: '' }), null);
}

/* ---- Al elegir «Lapsos personalizados», una línea sin estrenar arranca en Km ---- */
{
  const sesion = [
    { name: 'Correr', sets: '3', reps: '8-10', intensity: '', set: 1 },
    { name: 'Thruster', sets: '3', reps: '10', intensity: '40 kg', set: 1 },
    { name: 'Remo', sets: '3', reps: '500', unidad: 'm', set: 1 },
    { name: 'Burpee', sets: '3', reps: '10', unidad: 'reps', set: 1, porLado: true },
  ];
  const bs = parseBlocks(sesion);
  bs[0].lapsos = true;
  const g = serializeBlocks(bs);
  assert.deepEqual(lapsosDe(g[0]), [{ reps: '', unidad: 'km', intensity: '', descanso: '' }], 'sin estrenar: Km y vacío');
  assert.equal(g[0].unidad, 'km');
  assert.deepEqual(lapsosDe(g[1]), [{ reps: '10', unidad: 'reps', intensity: '40 kg', descanso: '' }], 'con carga puesta: no se toca');
  assert.deepEqual(lapsosDe(g[2]), [{ reps: '500', unidad: 'm', intensity: '', descanso: '' }], 'con su medida puesta: no se toca');
  assert.equal(lapsosDe(g[3])[0].unidad, 'reps', 'con «por lado» marcado: no se toca');
  // Desde la IA no se adivina: un ejercicio de 10 reps es de 10 reps.
  assert.deepEqual(lapsosDe(aLapsos({ name: 'Burpee', reps: '10' })), [{ reps: '10', unidad: 'reps', intensity: '', descanso: '' }]);
  assert.equal(esLineaSinEstrenar({ reps: '8-10' }), true);
  assert.equal(esLineaSinEstrenar({ reps: '8-10', intensity: '75%' }), false);
}

console.log('prueba-lapsos: todo bien');
