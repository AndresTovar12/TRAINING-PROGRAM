// Prueba de los botones de la sesión (29 oct 2026): cuál es el ÚLTIMO paso del entreno guiado (el que se termina manteniendo el botón), y lo que hacen «Terminar ahora»,
// «Marcar como hecha», «Empezar de nuevo» y «Marcar como no hecha» con el registro de la sesión.
//
//   node scripts/prueba-ultimo-paso.mjs
import assert from 'node:assert/strict';
import {
  archivaLoHecho, esElUltimoPaso, iniciaEntreno, marcaListo, pasosDeLaSesion, saltaPaso, sesionEnBlanco, terminaSesion, vistaDelEntreno, vuelveAtras,
} from '../src/lib/entreno.js';

const ex = (name, o = {}) => ({ name, ...o });
const dia = (exercises, name = 'Lower') => ({ day: 'Lun', name, cat: 'gym', exercises });

/* ---- Un ejercicio solo, con una serie: es el último desde el primer paso ---- */
{
  const plan = pasosDeLaSesion(dia([ex('Plancha', { sets: '1', reps: '45', unidad: 'seg' })]));
  assert.equal(plan.pasos.length, 1);
  assert.equal(esElUltimoPaso(plan, undefined, plan.pasos[0]), true, 'con un solo paso, el botón de mantener sale desde el primero');
  const av = marcaListo(plan, undefined, 1000);
  assert.equal(vistaDelEntreno(plan, av, 2000).completo, true, 'y al marcarlo, el entreno queda completo');
}

/* ---- Varias series: solo la última ---- */
{
  const plan = pasosDeLaSesion(dia([ex('Back Squat', { sets: '3', reps: '5' })]));
  assert.equal(plan.pasos.length, 3);
  let av;
  const quien = () => vistaDelEntreno(plan, av, 9000).actual;
  assert.deepEqual(plan.pasos.map((p) => esElUltimoPaso(plan, av, p)), [false, false, false]);
  av = marcaListo(plan, av, 1000);
  assert.equal(esElUltimoPaso(plan, av, quien()), false, 'la segunda serie todavía no');
  av = marcaListo(plan, av, 2000);
  assert.equal(esElUltimoPaso(plan, av, quien()), true, 'la tercera es la última');
  assert.equal(esElUltimoPaso(plan, av, plan.pasos[0]), false, 'una que ya se hizo no lo es');
  // «Anterior» regresa a la segunda: la última deja de serlo.
  av = vuelveAtras(plan, av);
  assert.equal(esElUltimoPaso(plan, av, quien()), false);
}

/* ---- Un paso que se tocó en «Ver todo»: solo es el último si es el único que falta ---- */
{
  const plan = pasosDeLaSesion(dia([ex('A', { sets: '1', reps: '5' }), ex('B', { sets: '1', reps: '5' }), ex('C', { sets: '1', reps: '5' })]));
  const [a, b, c] = plan.pasos;
  let av = marcaListo(plan, undefined, 1000);
  assert.equal(esElUltimoPaso(plan, av, c), false, 'C se enfocó desde la lista pero B todavía falta: sigue con «Listo»');
  av = marcaListo(plan, av, 2000, undefined, c.clave); // se marcó C por adelantado
  assert.equal(esElUltimoPaso(plan, av, b), true, 'ahora B es el único que falta');
  assert.equal(esElUltimoPaso(plan, av, a), false);
}

/* ---- Un descanso nunca lo es; los opcionales cuentan ---- */
{
  const plan = pasosDeLaSesion(dia([ex('Sprint', { sets: '5-6', reps: '1', descanso: '60 seg' })]));
  const descansos = plan.pasos.filter((p) => p.tipo === 'descanso');
  assert.ok(descansos.length > 0);
  descansos.forEach((d) => assert.equal(esElUltimoPaso(plan, undefined, d), false));
  const ejercicios = plan.pasos.filter((p) => p.tipo === 'ejercicio');
  assert.equal(ejercicios.length, 6, '5 de lo pedido y 1 opcional');
  // Hecho todo menos la sexta (opcional): la quinta ya NO es la última, la sexta sí.
  let av;
  plan.pasos.filter((p) => p.i < ejercicios[5].i).forEach((p) => { av = marcaListo(plan, av, 1000 + p.i); }); // todo lo de antes, con su descanso
  const v = vistaDelEntreno(plan, av, 9000);
  assert.equal(v.actual.clave, ejercicios[5].clave, 'queda la opcional');
  assert.equal(esElUltimoPaso(plan, av, ejercicios[5]), true, 'contando los opcionales, la sexta es la última');
  assert.equal(esElUltimoPaso(plan, av, ejercicios[4]), false);
  // Saltar la opcional deja el entreno completo (la pantalla termina sola).
  av = saltaPaso(plan, av, 5000);
  assert.equal(vistaDelEntreno(plan, av, 9000).completo, true);
}

/* ---- Sin plan o sin paso, no es el último ---- */
assert.equal(esElUltimoPaso(null, undefined, { clave: 'x', tipo: 'ejercicio' }), false);
assert.equal(esElUltimoPaso({ pasos: [] }, undefined, null), false);

/* ---- «Terminar ahora» y «Marcar como hecha» ---- */
{
  const plan = pasosDeLaSesion(dia([ex('A', { sets: '2', reps: '5' })]));
  const t0 = Date.parse('2026-10-29T14:55:00Z');
  const enCurso = { notes: 'duele', exercises: { 0: { weight: '100' } }, entreno: marcaListo(plan, iniciaEntreno(undefined, t0, plan), t0 + 60000) };
  const hecha = terminaSesion(enCurso, t0 + 600000);
  assert.equal(hecha.completed, true);
  assert.equal(hecha.completedAt, new Date(t0 + 600000).toISOString());
  assert.equal(hecha.entreno.fin, t0 + 600000, 'el entreno guiado se cierra');
  assert.equal(hecha.notes, 'duele', 'lo demás no se toca');
  assert.equal(vistaDelEntreno(plan, hecha.entreno, t0 + 900000).estado, 'fin');
  // Terminar otra vez no mueve la hora.
  assert.equal(terminaSesion(hecha, t0 + 999999).completedAt, hecha.completedAt);
  assert.equal(terminaSesion(hecha, t0 + 999999).entreno.fin, t0 + 600000);
  // A mano: sin entreno guiado, no se inventa uno.
  const aMano = terminaSesion({ notes: 'ok' }, t0);
  assert.equal(aMano.completed, true);
  assert.equal('entreno' in aMano, false);
  assert.equal(terminaSesion(undefined, t0).completed, true);
  // El recorrido, si lo hubo.
  assert.deepEqual(terminaSesion(enCurso, t0, { ruta: { lat: [1] } }).ruta, { lat: [1] });
}

/* ---- «Empezar de nuevo» (en curso) y «Marcar como no hecha» / «Hacerla otra vez» (hecha) ---- */
{
  const plan = pasosDeLaSesion(dia([ex('A', { sets: '2', reps: '5' })]));
  const t0 = 1000000;
  const enCurso = { notes: 'mi nota', exercises: { 0: { weight: '100' } }, formatos: { 0: { rondas: 3 } }, ruta: { lat: [1] }, entreno: marcaListo(plan, iniciaEntreno(undefined, t0, plan), t0 + 5) };
  // Una a medias nunca se terminó: no deja huella en `anteriores`.
  const nueva = sesionEnBlanco(enCurso, { archiva: false });
  assert.deepEqual(Object.keys(nueva).sort(), ['completed', 'completedAt', 'notes']);
  assert.equal(nueva.notes, 'mi nota', 'las notas se quedan');
  assert.equal(nueva.completed, false);
  assert.equal(nueva.anteriores, undefined);
  // Una hecha: lo que había pasa a `anteriores`.
  const hecha = terminaSesion(enCurso, t0 + 600000);
  const sinHacer = sesionEnBlanco(hecha);
  assert.equal(sinHacer.completed, false);
  assert.equal(sinHacer.completedAt, null);
  assert.equal(sinHacer.entreno, undefined);
  assert.equal(sinHacer.exercises, undefined);
  assert.equal(sinHacer.notes, 'mi nota');
  assert.equal(sinHacer.anteriores.length, 1);
  assert.equal(sinHacer.anteriores[0].completedAt, hecha.completedAt);
  assert.equal(sinHacer.anteriores[0].entreno.fin, t0 + 600000);
  assert.deepEqual(sinHacer.anteriores[0].exercises, { 0: { weight: '100' } });
  // Hacerla otra vez y terminarla otra vez: van dos.
  const otraVez = sesionEnBlanco(terminaSesion({ ...sinHacer, entreno: marcaListo(plan, iniciaEntreno(undefined, t0 + 7e6, plan), t0 + 7e6 + 5) }, t0 + 8e6));
  assert.equal(otraVez.anteriores.length, 2);
  // Lo mismo que daba «Deshacer» de antes.
  assert.deepEqual(sesionEnBlanco(hecha), { ...sesionEnBlanco(hecha, { archiva: true }) });
  assert.deepEqual(sesionEnBlanco(hecha).anteriores, archivaLoHecho(hecha).anteriores);
  // Una marcada a mano (sin entreno) también se archiva: lo hecho no se pierde.
  const aMano = terminaSesion({}, t0);
  assert.equal(sesionEnBlanco(aMano).anteriores.length, 1);
  assert.equal(sesionEnBlanco(undefined).completed, false);
}

console.log('prueba-ultimo-paso: todo bien');
