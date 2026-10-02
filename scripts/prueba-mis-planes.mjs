// Prueba de la lógica pura de «Mis planes» (src/lib/misPlanesDatos.js): cómo se guardan y se arman
// workouts, rutinas y programas, el resumen, quitar las notas, las carpetas y la búsqueda.
//
//   node scripts/prueba-mis-planes.mjs
import assert from 'node:assert/strict';
import {
  workoutDeSesiones, diasDeWorkout, sesionesDeWorkout, rutinaDePlan, rutinaDeSemana, planDeRutina,
  programaDePlan, planDePrograma, fasesConIdsNuevos, sinNotas, tieneNotas, resumenDe, textoDeResumen,
  hijasDe, rutaDeCarpeta, descendientesDe, puedeMoverCarpeta, cabeCarpetaEn, textoDeRuta, coincide,
  nombreDeCopia, NIVELES_DE_CARPETA, arbolDeCarpetas, planDeMovimiento, puedenMoverseCarpetas, carpetasQueSePuedenTraer,
  carpetasDeAbajoPrimero, claveDeItem, claveDeCarpeta, sesionTieneContenido, semanaTieneContenido, planTieneContenido,
} from '../src/lib/misPlanesDatos.js';
import { traduce } from '../src/lib/palabras.js';

const ej = (name, extra = {}) => ({ name, sets: '3', reps: '8', ...extra });
const sesion = (name, ejercicios, extra = {}) => ({ day: 'Lun', name, cat: 'gym', exercises: ejercicios, ...extra });

/* ---- Workouts: un día con UNA sesión conserva la forma de siempre ---- */
const una = sesion('Pierna', [ej('Sentadilla'), ej('Zancada'), { isNote: true, text: 'Calienta 10 min' }]);
const w1 = workoutDeSesiones([una]);
assert.equal(w1.day, undefined, 'el día de la semana no se guarda');
assert.equal(w1.otras, undefined);
assert.deepEqual(Object.keys(w1).sort(), ['cat', 'exercises', 'name']);
assert.deepEqual(resumenDe('workout', w1), { sesiones: 1, ejercicios: 2 }, 'las notas no cuentan como ejercicios');
assert.equal(textoDeResumen('workout', resumenDe('workout', w1)), '1 sesión · 2 ejercicios');

/* ---- Un día con DOS entradas (mañana y tarde): la primera en la raíz, la otra en `otras` ---- */
const tarde = sesion('Movilidad', [ej('Cadera')], { cat: 'recovery' });
const w2 = workoutDeSesiones([una, tarde]);
assert.equal(w2.name, 'Pierna', 'la raíz sigue siendo legible por quien solo conoce la forma vieja');
assert.equal(w2.otras.length, 1);
assert.equal(sesionesDeWorkout(w2).length, 2);
assert.deepEqual(resumenDe('workout', w2), { sesiones: 2, ejercicios: 3 });
const puestas = diasDeWorkout(w2, 'Mié');
assert.deepEqual(puestas.map((d) => [d.day, d.name, d.cat]), [['Mié', 'Pierna', 'gym'], ['Mié', 'Movilidad', 'recovery']]);
puestas[0].exercises.push(ej('Otro'));
assert.equal(w2.exercises.length, 3, 'asignar da una COPIA: no toca lo guardado');

/* ---- Un día doble de los que traen `blocks` también se guarda ---- */
const doble = { day: 'Jue', name: '', dual: true, cat: 'gym', blocks: [
  { type: 'lift', tag: 'Sesión 1 (AM): Velocidad', exercises: [ej('Sprint')] },
  { type: 'lift', tag: 'Sesión 2 (PM): Fuerza', exercises: [ej('Press'), ej('Remo'), { isNote: true, text: 'Pausa' }] },
] };
const wd = workoutDeSesiones([doble]);
assert.equal(wd.blocks.length, 2);
assert.deepEqual(resumenDe('workout', wd), { sesiones: 1, ejercicios: 3 });
const dd = diasDeWorkout(wd, 'Vie')[0];
assert.equal(dd.day, 'Vie');
assert.equal(dd.exercises, undefined, 'un doble no inventa una lista de ejercicios que no tenía');
assert.equal(diasDeWorkout({ name: '', exercises: undefined }, 'Lun', 'Mi workout')[0].name, 'Mi workout');

/* ---- Quitar las notas ---- */
const con = sesion('Con notas', [ej('A'), { isNote: true, text: 'nota' }], { notes: ['Toma agua'] });
assert.equal(tieneNotas('workout', workoutDeSesiones([con])), true);
assert.equal(tieneNotas('workout', w2.otras ? { ...w2, exercises: [ej('A')], otras: [] } : w2), false);
const limpio = sinNotas('workout', workoutDeSesiones([con]));
assert.equal(limpio.notes, undefined);
assert.deepEqual(limpio.exercises.map((e) => e.name), ['A']);
const limpioDoble = sinNotas('workout', wd);
assert.equal(limpioDoble.blocks[1].exercises.length, 2, 'las notas de dentro de un bloque también se van');
assert.equal(limpioDoble.blocks.length, 2, 'pero los bloques se quedan');
assert.equal(wd.blocks[1].exercises.length, 3, 'sin tocar lo original');

/* ---- Rutina semanal ---- */
const dias = [sesion('Lunes', [ej('A')]), { ...sesion('Miércoles', [ej('B'), ej('C')]), day: 'Mié' }, { day: 'Vie', name: 'OFF', cat: 'off', exercises: [] }];
const planRutina = { kind: 'weekly', phases: [{ id: 'p-1', weekData: [{ num: 1, days: dias }] }] };
const r = rutinaDePlan(planRutina);
assert.equal(r.days.length, 3);
assert.deepEqual(resumenDe('rutina', r), { dias: 2, sesiones: 2 }, 'el descanso no cuenta');
assert.equal(textoDeResumen('rutina', resumenDe('rutina', r)), '2 días · 2 sesiones');
assert.deepEqual(rutinaDeSemana({ num: 4, days: dias }).days.length, 3);
const vuelve = planDeRutina(r);
assert.equal(vuelve.kind, 'weekly');
assert.equal(vuelve.estructura, 'rutina');
assert.equal(vuelve.phases.length, 1);
assert.equal(vuelve.phases[0].weekData[0].days.length, 3);
assert.match(vuelve.phases[0].id, /^p-/);
assert.notEqual(planDeRutina(r).phases[0].id, planDeRutina(r).phases[0].id, 'cada entrega lleva ids nuevos');

/* ---- Programa por fases ---- */
const semana = (num, n = 3) => ({ num, days: Array.from({ length: n }, (_, i) => sesion(`S${i}`, [ej('X')])) });
const fases = [
  { id: 'p-a', num: 1, name: 'Base', weekData: [semana(1), semana(2)] },
  { id: 'p-b', num: 2, name: 'Fuerza', weekData: [semana(1)] },
  { id: 'p-c', num: 3, name: 'Micro', mode: 'microcycle', weeks: 4, weekData: [semana(1)] },
];
const prog = programaDePlan({ kind: 'periodized', estructura: 'fases', phases: fases });
assert.deepEqual(resumenDe('programa', prog), { forma: 'fases', fases: 3, semanas: 7, sesiones: 12 }, 'el microciclo cuenta sus repeticiones');
assert.equal(textoDeResumen('programa', resumenDe('programa', prog)), '3 fases · 7 semanas · 12 sesiones');
const prog2 = programaDePlan({ kind: 'periodized', estructura: 'semanas', phases: fases.slice(0, 1) });
assert.equal(textoDeResumen('programa', resumenDe('programa', prog2)), '2 semanas · 6 sesiones', '«varias semanas» no habla de fases');
const entregado = planDePrograma(prog);
assert.equal(entregado.phases.length, 3);
assert.ok(entregado.phases.every((f, i) => f.id !== fases[i].id && /^p-/.test(f.id)), 'ids nuevos');
assert.equal(new Set(entregado.phases.map((f) => f.id)).size, 3, 'y distintos entre sí');
assert.equal(entregado.phases[0].name, 'Base');
assert.equal(prog.phases[0].id, 'p-a', 'lo guardado no cambia');
assert.equal(fasesConIdsNuevos(fases)[1].weekData[0].num, 1);
const progSinNotas = sinNotas('programa', programaDePlan({ kind: 'periodized', estructura: 'fases', phases: [{ id: 'p-x', weekData: [{ num: 1, days: [con] }] }] }));
assert.equal(progSinNotas.phases[0].weekData[0].days[0].notes, undefined);
assert.equal(progSinNotas.estructura, 'fases');
assert.equal(tieneNotas('programa', prog), false);

/* ---- Carpetas con subcarpetas ---- */
const c = (id, nombre, parent_id = null) => ({ id, nombre, parent_id });
const carpetas = [c('f', 'Football'), c('a', 'Atletismo'), c('ff', 'Fuerza', 'f'), c('fv', 'Velocidad', 'f'), c('ff1', 'Fase 1', 'ff')];
assert.deepEqual(hijasDe(carpetas, null).map((x) => x.nombre), ['Atletismo', 'Football'], 'por nombre');
assert.deepEqual(hijasDe(carpetas, 'f').map((x) => x.nombre), ['Fuerza', 'Velocidad']);
assert.equal(textoDeRuta(carpetas, 'ff1'), 'Football › Fuerza › Fase 1');
assert.equal(textoDeRuta(carpetas, null), 'Sin carpeta');
assert.deepEqual([...descendientesDe(carpetas, 'f')].sort(), ['ff', 'ff1', 'fv']);
assert.equal(puedeMoverCarpeta(carpetas, 'f', 'ff1'), false, 'no dentro de lo que cuelga de ella');
assert.equal(puedeMoverCarpeta(carpetas, 'f', 'f'), false, 'ni dentro de sí misma');
assert.equal(puedeMoverCarpeta(carpetas, 'fv', 'a'), true);
assert.equal(puedeMoverCarpeta(carpetas, 'ff1', null), true, 'arriba de todo siempre se puede');
// El límite de niveles: una cadena de NIVELES_DE_CARPETA ya no admite una carpeta más debajo.
const cadena = Array.from({ length: NIVELES_DE_CARPETA }, (_, i) => c(`n${i}`, `N${i}`, i ? `n${i - 1}` : null));
assert.equal(cabeCarpetaEn(cadena, `n${NIVELES_DE_CARPETA - 2}`), true);
assert.equal(cabeCarpetaEn(cadena, `n${NIVELES_DE_CARPETA - 1}`), false);
assert.equal(cabeCarpetaEn(cadena, null), true);
assert.equal(puedeMoverCarpeta([...cadena, c('x', 'X')], 'x', `n${NIVELES_DE_CARPETA - 1}`), false, 'no pasa del límite');
// Una vuelta rara en los datos no cuelga la pantalla.
const rota = [c('p', 'P', 'q'), c('q', 'Q', 'p')];
assert.equal(rutaDeCarpeta(rota, 'p').length, 2);

/* ---- Mover: el árbol, el plan de movimiento y su «deshacer» ---- */
const arbol = arbolDeCarpetas(carpetas);
assert.deepEqual(arbol.map((x) => [x.carpeta.id, x.nivel]), [['a', 0], ['f', 0], ['ff', 1], ['ff1', 2], ['fv', 1]], 'por nombre, cada una seguida de lo suyo');
assert.equal(arbol.length, carpetas.length, 'el árbol trae todas las carpetas, una sola vez');
arbol.forEach(({ carpeta, nivel }) => {
  assert.equal(nivel, rutaDeCarpeta(carpetas, carpeta.id).length - 1, `el nivel de ${carpeta.id} es su profundidad`);
});
assert.equal(arbolDeCarpetas([c('p', 'P', 'q'), c('q', 'Q', 'p')]).length, 0, 'una vuelta rara no cuelga la pantalla');

const cosaA = { tabla: 'routine_templates', id: 'w1', carpetaId: null };
const cosaB = { tabla: 'programas_guardados', id: 'p1', carpetaId: 'f' };
const cosaC = { tabla: 'routine_templates', id: 'r1', carpetaId: 'fv' };
const plan = planDeMovimiento({ items: [cosaA, cosaB, cosaC] }, 'fv');
assert.deepEqual(plan.ir.map((m) => m.id), ['w1', 'p1'], 'lo que ya estaba ahí no se mueve');
assert.deepEqual(plan.volver, [
  { tabla: 'routine_templates', id: 'w1', a: null },
  { tabla: 'programas_guardados', id: 'p1', a: 'f' },
], 'deshacer lleva cada cosa a donde estaba');
assert.deepEqual(planDeMovimiento({ items: [cosaB] }, null).ir, [{ tabla: 'programas_guardados', id: 'p1', a: null }], 'null = arriba de todo');
assert.equal(planDeMovimiento({ items: [cosaA] }, null).ir.length, 0, 'sin carpeta a sin carpeta no hace nada');
const conCarpeta = planDeMovimiento({ carpetas: [carpetas.find((x) => x.id === 'ff1')] }, null);
assert.deepEqual(conCarpeta.ir, [{ tabla: 'carpetas_planes', id: 'ff1', a: null }]);
assert.deepEqual(conCarpeta.volver, [{ tabla: 'carpetas_planes', id: 'ff1', a: 'ff' }], 'una carpeta también vuelve a su lugar');

assert.equal(claveDeItem(cosaA), 'routine_templates:w1');
assert.equal(claveDeCarpeta({ id: 'f' }), 'carpetas_planes:f');
assert.equal(puedenMoverseCarpetas(carpetas, [carpetas.find((x) => x.id === 'f')], 'ff1'), false, 'una carpeta no entra en lo suyo');
assert.equal(puedenMoverseCarpetas(carpetas, [carpetas.find((x) => x.id === 'fv')], 'a'), true);

// «Traer» a una carpeta: no ella, no lo que ya vive en ella, no lo que cuelga de ella.
const traibles = carpetasQueSePuedenTraer(carpetas, 'f').map((x) => x.id);
assert.equal(traibles.includes('f'), false, 'ella misma no');
assert.equal(traibles.includes('ff'), false, 'lo que ya vive en ella no se trae');
assert.equal(traibles.includes('ff1'), true, 'pero una subcarpeta de más abajo sí se puede subir');
assert.equal(traibles.includes('a'), true);
assert.equal(carpetasQueSePuedenTraer(carpetas, 'ff1').map((x) => x.id).includes('f'), false, 'su carpeta de arriba no cabe dentro de ella');

// Borrar varias carpetas: las de abajo primero.
const orden = carpetasDeAbajoPrimero(carpetas, [carpetas.find((x) => x.id === 'f'), carpetas.find((x) => x.id === 'ff1')]).map((x) => x.id);
assert.deepEqual(orden, ['ff1', 'f'], 'la de adentro se borra antes que la que la tiene');

/* ---- Buscar y nombrar copias ---- */
assert.equal(coincide({ nombre: 'Rutina de Fuerza', descripcion: 'Pretemporada', origen: 'Del plan de Andrés' }, 'fuérza'), true, 'sin acentos');
assert.equal(coincide({ nombre: 'Rutina', descripcion: 'Pretemporada de football' }, 'FOOTBALL'), true, 'también en la descripción');
assert.equal(coincide({ nombre: 'Rutina', origen: 'Del plan de Andrés' }, 'andres'), true, 'y en de dónde salió');
assert.equal(coincide({ nombre: 'Rutina' }, 'yoga'), false);
assert.equal(coincide({ nombre: 'Rutina' }, ''), true);
assert.equal(nombreDeCopia('Pierna', ['Pierna']), 'Pierna (copia)');
assert.equal(nombreDeCopia('Pierna', ['Pierna', 'Pierna (copia)']), 'Pierna (copia 2)');
assert.equal(nombreDeCopia('Pierna (copia)', ['Pierna', 'Pierna (copia)']), 'Pierna (copia 2)', 'copiar una copia no apila «(copia) (copia)»');

/* ---- ¿Hay algo que guardar? Una sesión, una semana o un plan vacíos no ofrecen «Guardar» ---- */
assert.equal(sesionTieneContenido({ day: 'Lun', name: 'Sesión', exercises: [] }), false, 'sesión vacía');
assert.equal(sesionTieneContenido({ exercises: [{ isNote: true, text: 'Calienta' }] }), true, 'una nota suelta ya es contenido');
assert.equal(sesionTieneContenido({ exercises: [ej('Sentadilla')] }), true);
assert.equal(sesionTieneContenido({ blocks: [{ exercises: [] }, { exercises: [ej('Salto')] }] }), true, 'día doble con un bloque lleno');
assert.equal(sesionTieneContenido({ blocks: [{ exercises: [] }] }), false);
assert.equal(sesionTieneContenido(null), false);
assert.equal(semanaTieneContenido({ days: [{ exercises: [] }, { exercises: [ej('A')] }] }), true);
assert.equal(semanaTieneContenido({ days: [{ exercises: [] }] }), false);
assert.equal(semanaTieneContenido({}), false);
assert.equal(planTieneContenido([{ weekData: [{ days: [{ exercises: [] }] }, { days: [{ exercises: [ej('A')] }] }] }]), true);
assert.equal(planTieneContenido([{ weekData: [{ days: [{ exercises: [] }] }] }]), false);
assert.equal(planTieneContenido([]), false);

/* ---- Las palabras de cada oficio: «Mis planes» no cambia, lo demás sí ---- */
assert.equal(traduce('Guardar todo el plan en Mis planes', true), 'Guardar todo el programa en Mis planes', 'el nombre de la pestaña se queda');
assert.equal(traduce('Guardar todo el plan en Mis planes', false), 'Guardar todo el plan en Mis planes', 'quien no es de salud no cambia nada');
assert.equal(traduce('Asignar a 2 atletas', true), 'Asignar a 2 pacientes');
assert.equal(traduce('Reemplaza su plan: lo recuperas en «Cambios del plan»', true), 'Reemplaza su programa: lo recuperas en «Cambios del programa»');
assert.equal(traduce('Mis planes y Plan de Laura', true), 'Mis planes y Programa de Laura', 'lo protegido no frena lo demás');

console.log('✓ mis planes: workouts (incluye dobles), rutinas, programas con ids nuevos, notas, carpetas, búsqueda y palabras del oficio');
