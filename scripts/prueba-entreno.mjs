// Prueba del motor del modo entreno (src/lib/entreno.js): la sesión en pasos —con su plan real de Lower Strength, un sprint de «5-6 veces»,
// un AMRAP, lapsos de cardio, un día de puros nombres, uno de puras notas y un descanso— y el avance del atleta con horas inventadas.
//
//   node scripts/prueba-entreno.mjs
import assert from 'node:assert/strict';
import {
  MAX_PASOS, FORMATO_DE_LAPSOS, rondasDelSet, deporteDelTipo, pasosDeLaSesion, leeAvance, iniciaEntreno, marcaListo, saltaPaso, vuelveAtras, masDescanso,
  terminaEntreno, reabreEntreno, ocultaEntreno, vistaDelEntreno, empiezaPaso, quitaCronometro, cuentaDe,
} from '../src/lib/entreno.js';
import { ponFormato } from '../src/lib/formatos.js';
import { parcheDeLapsos } from '../src/lib/lapsos.js';
import { parcheDeVueltas } from '../src/lib/porVuelta.js';
import { diferencia, aplicarParche, BORRAR } from '../src/lib/estadoPorPartes.js';

const ex = (name, o = {}) => ({ name, ...o });
const claves = (plan) => plan.pasos.map((p) => p.clave);
const tipos = (plan) => plan.pasos.map((p) => (p.tipo === 'descanso' ? `D${p.seg ?? '-'}` : p.tipo === 'ejercicio' ? 'E' : p.tipo[0].toUpperCase())).join(' ');

// Su Lower Strength (el plan real, tal como lo escribió: carga por %, descansos en seg y min, una bi-serie y una plancha por lado).
const lower = {
  day: 'Lun', name: 'Lower Strength · ~75 min', cat: 'gym',
  exercises: [
    ex('Back Squat', { sets: '5', reps: '5', intensity: '78%', descanso: '150 seg', descansoSet: '3 min' }),
    ex('Hexbar deadlift', { sets: '5', reps: '5', intensity: '78%', descanso: '2 min', descansoSet: '3 min' }),
    ex('Bulgarian Split Squat', { sets: '3', reps: '6', porLado: true, intensity: 'RIR 2', set: 3 }),
    ex('Hip Thrust', { sets: '3', reps: '8', intensity: 'RIR 2', descanso: '90 seg', descansoSet: '2 min', set: 3 }),
    ex('Plancha lateral', { sets: '2', reps: '30', unidad: 'seg', porLado: true, descanso: '45 seg' }),
  ],
};

/* ---- Las vueltas de un Set ---- */
{
  assert.deepEqual(rondasDelSet('5'), { min: 5, max: 5 });
  assert.deepEqual(rondasDelSet('4-6'), { min: 4, max: 6 });
  assert.deepEqual(rondasDelSet('6 – 4'), { min: 4, max: 6 }, 'rango con raya larga y al revés');
  for (const t of ['', undefined, null, '—', 'AMRAP', '0', 'tres']) assert.deepEqual(rondasDelSet(t), { min: 1, max: 1 }, `«${t}» es una vez`);
  assert.equal(rondasDelSet('999').max, 60, 'tope de sensatez');
}

/* ---- Su Lower Strength, paso por paso ---- */
{
  const plan = pasosDeLaSesion(lower);
  assert.equal(plan.deporte, 'fuerza');
  assert.equal(plan.series, 4);
  assert.equal(plan.simple, false);
  assert.equal(plan.truncado, false);
  assert.equal(plan.total, 18, '5 + 5 + (3 × 2) + 2 pasos que hacer; los descansos no cuentan');
  assert.equal(
    tipos(plan),
    // Back Squat ×5 · Hexbar ×5 · bi-serie ×3 · plancha ×2
    'E D150 E D150 E D150 E D150 E D180  E D120 E D120 E D120 E D120 E D180  E E D90 E E D90 E E D120  E D45 E'.replace(/ {2}/g, ' '),
  );
  const [primero] = plan.pasos;
  assert.equal(primero.clave, '0.1.0');
  assert.equal(primero.nombre, 'Back Squat');
  assert.deepEqual(primero.termina, { por: 'reps', min: 5, max: 5, valor: 5, cantidad: '5', unidad: 'reps' });
  assert.deepEqual(primero.meta, { tipo: 'pct', texto: '78%', min: 78, max: 78 });
  assert.equal(primero.texto, '5 reps');
  assert.deepEqual([primero.serie, primero.vuelta, primero.vueltas, primero.opcional, primero.intensidad], [1, 1, 5, false, 'trabajo']);
  assert.equal(plan.pasos[1].clave, 'd.0.1.0', 'el descanso cuelga del paso anterior');
  assert.deepEqual(plan.pasos[1].termina, { por: 'tiempo', min: 150, max: 150, valor: 150 });
  assert.equal(plan.pasos[1].entre, 'rondas');
  assert.equal(plan.pasos[1].intensidad, 'recuperar');
  // El último descanso del Set es el de ENTRE SETS (3 min), no el de entre vueltas.
  const finDelSet = plan.pasos[9];
  assert.equal(finDelSet.clave, 'd.0.5.0');
  assert.deepEqual([finDelSet.seg, finDelSet.entre], [180, 'sets']);
  // La bi-serie se alterna: Bulgarian, Hip Thrust, descanso, y otra vez.
  const bi = plan.pasos.filter((p) => p.serie === 3 && p.tipo === 'ejercicio');
  assert.deepEqual(bi.map((p) => p.nombre), ['Bulgarian Split Squat', 'Hip Thrust', 'Bulgarian Split Squat', 'Hip Thrust', 'Bulgarian Split Squat', 'Hip Thrust']);
  assert.equal(bi[0].serieTag, 'Bi-serie');
  assert.deepEqual([bi[0].ejercicioEnSerie, bi[0].ejerciciosEnSerie, bi[1].ejercicioEnSerie], [1, 2, 2]);
  assert.equal(bi[0].porLado, true);
  assert.equal(bi[0].texto, '6 reps por lado');
  assert.deepEqual(bi[0].meta, { tipo: 'rir', texto: 'RIR 2', min: 2, max: 2 });
  assert.deepEqual(bi.map((p) => p.clave), ['2.1.0', '3.1.0', '2.2.0', '3.2.0', '2.3.0', '3.3.0']);
  // Una plancha por lado de 30 seg: termina por tiempo y es la última del día (sin descanso al final).
  const plancha = plan.pasos[plan.pasos.length - 1];
  assert.deepEqual(plancha.termina, { por: 'tiempo', min: 30, max: 30, valor: 30, cantidad: '30', unidad: 'seg' });
  assert.equal(plancha.texto, '30 seg por lado');
  assert.equal(plancha.meta, null, 'sin carga escrita no hay meta');
  // Orden y numeración: `i` sigue la lista, `n` salta los descansos.
  plan.pasos.forEach((p, i) => assert.equal(p.i, i));
  assert.deepEqual(plan.pasos.filter((p) => p.tipo !== 'descanso').map((p) => p.n), Array.from({ length: 18 }, (_, k) => k + 1));
  assert.equal(new Set(claves(plan)).size, plan.pasos.length, 'las claves no se repiten');
}

/* ---- Con POCA información: solo nombres ---- */
{
  const poca = { day: 'Mar', name: 'Gym', cat: 'gym', exercises: [ex('Sentadilla'), ex('Press de banca'), ex('Remo con barra'), ex('Plancha')] };
  const plan = pasosDeLaSesion(poca);
  assert.equal(plan.pasos.length, 4, 'sin descansos inventados');
  assert.equal(plan.simple, true, 'ejercicio 2 de 4, no «serie»');
  assert.equal(plan.total, 4);
  plan.pasos.forEach((p) => {
    assert.deepEqual(p.termina, { por: 'boton' }, 'sin reps termina cuando el atleta dice');
    assert.equal(p.meta, null);
    assert.equal(p.texto, '');
    assert.equal(p.vueltas, 1);
  });
  // El flujo completo con un solo botón.
  let av;
  plan.pasos.forEach((_, k) => {
    assert.equal(vistaDelEntreno(plan, av, 1000 + k).actual.nombre, poca.exercises[k].name);
    av = marcaListo(plan, av, 1000 + k);
  });
  const v = vistaDelEntreno(plan, av, 2000);
  assert.equal(v.completo, true);
  assert.equal(v.actual, null);
  assert.deepEqual([v.hechos, v.total], [4, 4]);
}

/* ---- Un sprint de «5-6 veces»: la vuelta 6 es opcional ---- */
{
  const vel = {
    day: 'Mié', name: 'Velocidad', cat: 'speed',
    exercises: [
      ex('Sprint 30 m', { sets: '5-6', reps: '30', unidad: 'm', intensity: 'Máximo', descanso: '90 seg' }),
      ex('Foam roller', { reps: '10', unidad: 'min' }),
    ],
  };
  const plan = pasosDeLaSesion(vel);
  assert.equal(plan.deporte, 'velocidad');
  assert.equal(tipos(plan), 'E D90 E D90 E D90 E D90 E D90 E E');
  assert.equal(plan.total, 6, '5 sprints + el foam roller; la vuelta 6 no cuenta');
  const sprints = plan.pasos.filter((p) => p.nombre === 'Sprint 30 m');
  assert.deepEqual(sprints.map((p) => p.opcional), [false, false, false, false, false, true]);
  assert.deepEqual(sprints[0].termina, { por: 'distancia', min: 30, max: 30, valor: 30, cantidad: '30', unidad: 'm' });
  assert.deepEqual(sprints[0].meta, { tipo: 'texto', texto: 'Máximo' }, 'una carga que no encaja se enseña tal cual');
  assert.deepEqual([sprints[5].vuelta, sprints[5].vueltas, sprints[5].vueltasMin], [6, 6, 5]);
  const roller = plan.pasos[plan.pasos.length - 1];
  assert.deepEqual(roller.termina, { por: 'tiempo', min: 600, max: 600, valor: 600, cantidad: '10', unidad: 'min' });

  // Mientras falte algo que hacer (el foam roller viene DESPUÉS de la vuelta opcional), lo opcional no es «lo único que queda».
  let av;
  let t = 0;
  let v;
  for (let k = 0; k < 9; k += 1) av = marcaListo(plan, av, t += 1000); // 5 sprints y los 4 descansos entre ellos
  v = vistaDelEntreno(plan, av, t);
  assert.deepEqual([v.actual.tipo, v.soloLoOpcional], ['descanso', false]);
  av = marcaListo(plan, av, t += 1000);
  v = vistaDelEntreno(plan, av, t);
  assert.deepEqual([v.actual.opcional, v.soloLoOpcional], [true, false]);
  av = saltaPaso(plan, av, t += 1000); // se salta la vuelta opcional
  assert.equal(vistaDelEntreno(plan, av, t).actual.nombre, 'Foam roller');
  assert.equal(vistaDelEntreno(plan, av, t).hechos, 5, 'lo saltado y lo opcional no cuentan como hechos');
  // Con un día que acaba en la vuelta opcional sí queda «solo lo opcional».
  const soloSprint = pasosDeLaSesion({ cat: 'speed', exercises: [vel.exercises[0]] });
  av = undefined;
  t = 0;
  for (let k = 0; k < 9; k += 1) av = marcaListo(soloSprint, av, t += 1000); // 5 sprints + 4 descansos
  v = vistaDelEntreno(soloSprint, av, t);
  assert.equal(v.actual.tipo, 'descanso', 'el descanso antes de la vuelta opcional');
  assert.equal(v.soloLoOpcional, true);
  assert.equal(v.siguiente.opcional, true);
  assert.equal(v.completo, false);
  av = marcaListo(soloSprint, av, t += 1000); // seguir
  v = vistaDelEntreno(soloSprint, av, t);
  assert.equal(v.actual.opcional, true);
  assert.equal(v.soloLoOpcional, true);
  // Dar el entreno por terminado aquí es válido.
  av = terminaEntreno(av, t += 500);
  assert.equal(vistaDelEntreno(soloSprint, av, t + 99999).estado, 'fin');
}

/* ---- Un Set con formato es UN paso: lo corre el reloj de siempre ---- */
{
  const amrap = { id: 'amrap', pasos: [{ tipo: 'trabajo', seg: 720 }], vueltas: 1, tope: null, turnan: false, anota: 'rondas' };
  const miembros = ponFormato([ex('Thruster', { reps: '10', set: 1 }), ex('Pull-ups', { reps: '10', set: 1, descansoSet: '2 min' })], amrap);
  const dia = { day: 'Jue', name: 'Metcon', cat: 'gym', exercises: [...miembros, ex('Caminata', { reps: '5', unidad: 'min' })] };
  const plan = pasosDeLaSesion(dia);
  assert.equal(tipos(plan), 'R D120 E');
  const [reloj, descanso] = plan.pasos;
  assert.equal(reloj.clave, 'r.0');
  assert.equal(reloj.claveFormato, '0', 'la misma llave con la que se anota el resultado del Set (`formatos[clave]`)');
  assert.equal(reloj.nombre, 'AMRAP');
  assert.equal(reloj.resumen, 'AMRAP · 12 min');
  assert.deepEqual(reloj.termina, { por: 'tiempo', min: 720, max: 720, valor: 720 });
  assert.deepEqual(reloj.miembros.map((m) => m.nombre), ['Thruster', 'Pull-ups']);
  assert.deepEqual(reloj.miembros.map((m) => m.idx), [0, 1]);
  assert.equal(reloj.formato.id, 'amrap');
  assert.equal(descanso.seg, 120, 'el descanso entre Sets va tras el reloj');
  assert.equal(plan.total, 2);
  // Un reloj con un tramo «hasta Listo» no tiene duración total.
  const abierto = ponFormato([ex('Remo', { set: 1 })], { id: 'custom', pasos: [{ tipo: 'trabajo', seg: null }, { tipo: 'descanso', seg: 60 }], vueltas: 3, anota: 'cumplido' });
  assert.deepEqual(pasosDeLaSesion({ cat: 'gym', exercises: abierto }).pasos[0].termina, { por: 'boton' });
}

/* ---- Cardio por lapsos: un Set con varios tramos es UN paso con reloj; sus lapsos viven dentro, con su ritmo y su descanso ---- */
{
  const lapsos = [
    { reps: '800', unidad: 'm', intensity: '4:34-5:00 min/km', descanso: '' },
    { reps: '2', unidad: 'min', intensity: '6:39-7:00 min/km', descanso: '60 seg' },
  ];
  const dia = {
    day: 'Vie', name: 'Intervalos', cat: 'correr',
    exercises: [ex('Correr', { sets: '4', ...parcheDeLapsos(lapsos) }), ex('Caminata de enfriamiento', { reps: '5', unidad: 'min' })],
  };
  const plan = pasosDeLaSesion(dia);
  assert.equal(plan.deporte, 'correr');
  assert.equal(tipos(plan), 'R E', 'el Set en lapsos es un paso con reloj; la caminata, un ejercicio');
  assert.equal(plan.total, 2);
  const [reloj, caminata] = plan.pasos;
  assert.equal(reloj.clave, 'r.0');
  assert.equal(reloj.deLapsos, true);
  assert.deepEqual(reloj.formato, FORMATO_DE_LAPSOS);
  assert.equal(reloj.resumen, 'Correr');
  assert.equal(reloj.rondas, 4);
  assert.equal(reloj.claveFormato, '0');
  assert.equal(caminata.clave, '1.1.0');
  // El reloj de siempre corre estos tramos: 2 lapsos × 4 rondas, el descanso solo tras el 2.º lapso, y ninguno al final.
  assert.equal(reloj.tramos.filter((t) => t.tipo === 'trabajo').length, 8);
  assert.equal(reloj.tramos.filter((t) => t.tipo === 'descanso').length, 3);
  assert.equal(reloj.tramos[reloj.tramos.length - 1].tipo, 'trabajo');
  assert.deepEqual(reloj.miembros[0].lapsos.map((l) => l.texto), ['800 m', '2 min']);
  assert.deepEqual(reloj.miembros[0].lapsos.map((l) => l.descanso), ['', '60 seg']);
  assert.deepEqual(reloj.termina, { por: 'boton' }, 'con un lapso en metros no hay tiempo total');
  // Los pasos de cada lapso se guardan DENTRO (para el reloj de pulsera), con su ritmo y su descanso.
  const internos = reloj.pasosInternos;
  assert.equal(tipos({ pasos: internos }), 'E E D60 E E D60 E E D60 E E', 'sin el descanso de después del Set: ese es un paso de afuera');
  const [l1, l2, descanso] = internos;
  assert.deepEqual(l1.termina, { por: 'distancia', min: 800, max: 800, valor: 800, cantidad: '800', unidad: 'm' });
  assert.deepEqual(l1.meta, { tipo: 'ritmo', texto: '4:34-5:00 min/km', min: 274, max: 300 }, 'ritmo en segundos por km');
  assert.deepEqual([l1.lapso, l1.lapsos, l1.vuelta, l1.vueltas], [1, 2, 1, 4]);
  assert.deepEqual(l2.termina, { por: 'tiempo', min: 120, max: 120, valor: 120, cantidad: '2', unidad: 'min' });
  assert.deepEqual(l2.meta, { tipo: 'ritmo', texto: '6:39-7:00 min/km', min: 399, max: 420 });
  assert.equal(l2.clave, '0.1.1', 'el 2.º lapso de la vuelta 1');
  assert.equal(descanso.seg, 60);
  assert.equal(descanso.entre, 'rondas', 'tras el último lapso de la vuelta');
  assert.equal(descanso.clave, 'd.0.1.1');
  // Un solo lapso y una sola ronda NO necesita reloj: es un ejercicio más.
  const uno = pasosDeLaSesion({ cat: 'correr', exercises: [ex('Correr', { sets: '1', ...parcheDeLapsos([lapsos[0]]) })] });
  assert.equal(tipos(uno), 'E');
  assert.equal(uno.pasos[0].clave, '0.1.0');
  // Dos ejercicios con un lapso cada uno, una sola ronda: dos tramos de trabajo, así que reloj.
  const dos = pasosDeLaSesion({ cat: 'correr', exercises: [ex('Remo', { set: 1, ...parcheDeLapsos([lapsos[0]]) }), ex('Correr', { set: 1, ...parcheDeLapsos([lapsos[1]]) })] });
  assert.equal(tipos(dos), 'R');
  assert.equal(dos.pasos[0].resumen, 'Remo + Correr');
  // El descanso entre Sets va DESPUÉS del reloj, igual que con un AMRAP.
  const con = pasosDeLaSesion({ cat: 'correr', exercises: [ex('Correr', { sets: '2', descansoSet: '3 min', ...parcheDeLapsos(lapsos) }), ex('Caminata', { reps: '5', unidad: 'min' })] });
  assert.equal(tipos(con), 'R D180 E');
  assert.equal(con.pasos[1].clave, 'd.r.0');
  assert.equal(con.pasos[1].entre, 'sets');
  // Marcar el paso con reloj lo da por hecho, y el siguiente es el descanso.
  const hecho = marcaListo(con, iniciaEntreno(undefined, 1000), 2000);
  assert.equal(vistaDelEntreno(con, hecho, 2000).actual.clave, 'd.r.0');
  // Una distancia en km y en yardas se pasa a metros.
  const km = pasosDeLaSesion({ cat: 'correr', exercises: [ex('Rodaje', { reps: '5', unidad: 'km', intensity: 'Zona 2' }), ex('Sprint', { reps: '40', unidad: 'yd' })] });
  assert.deepEqual(km.pasos[0].termina, { por: 'distancia', min: 5000, max: 5000, valor: 5000, cantidad: '5', unidad: 'km' });
  assert.deepEqual(km.pasos[0].meta, { tipo: 'zona', texto: 'Zona 2', min: 2, max: 2 });
  assert.equal(km.pasos[1].termina.valor, 36.58);
  assert.deepEqual([km.pasos[1].termina.cantidad, km.pasos[1].termina.unidad], ['40', 'yd'], 'las pantallas dicen lo que escribió el coach: 40 yd, no 36.58 m');
}

/* ---- Cargas, vueltas distintas, clusters y rangos ---- */
{
  const dia = {
    cat: 'gym',
    exercises: [
      ex('Press', { sets: '3', ...parcheDeVueltas([{ reps: '10', intensity: '60%' }, { reps: '8', intensity: '70%' }, { reps: '6', intensity: '80%' }]) }),
      ex('Snatch', { sets: '2', reps: '2+2+2', unidad: 'cluster', entreBloques: '20' }),
      ex('Curl', { reps: '8-10', intensity: '20 kg' }),
      ex('Bici', { reps: '20', unidad: 'min', intensity: '250 W' }),
      ex('Nado', { reps: '400', unidad: 'm', intensity: '1:45-2:00 /100 m' }),
      ex('Peso muerto', { reps: 'AMRAP', intensity: 'RPE 7-8' }),
    ],
  };
  const p = pasosDeLaSesion(dia).pasos.filter((x) => x.tipo === 'ejercicio');
  assert.deepEqual(p.slice(0, 3).map((x) => [x.termina.valor, x.meta.min]), [[10, 60], [8, 70], [6, 80]], 'cada vuelta con sus reps y su carga');
  assert.deepEqual(p[3].termina, { por: 'reps', min: 6, max: 6, valor: 6, cantidad: '2+2+2', unidad: 'cluster', bloques: [2, 2, 2], entreBloques: 20 });
  assert.deepEqual(p[5].termina, { por: 'reps', min: 8, max: 10, valor: null, cantidad: '8-10', unidad: 'reps' }, 'un rango no tiene valor fijo');
  assert.deepEqual(p[5].meta, { tipo: 'kg', texto: '20 kg', min: 20, max: 20 });
  assert.deepEqual(p[6].meta, { tipo: 'w', texto: '250 W', min: 250, max: 250 });
  assert.deepEqual(p[7].meta, { tipo: 'nado', texto: '1:45-2:00 /100 m', min: 105, max: 120 });
  assert.deepEqual(p[8].termina, { por: 'boton', texto: 'AMRAP' }, 'texto libre: termina con el botón, guardando lo que escribió el coach');
  assert.deepEqual(p[8].meta, { tipo: 'rpe', texto: 'RPE 7-8', min: 7, max: 8 });
}

/* ---- Descansos escritos de formas distintas ---- */
{
  const descansos = (d) => pasosDeLaSesion({ cat: 'gym', exercises: [ex('A', { sets: '2', reps: '1', descanso: d })] }).pasos.filter((p) => p.tipo === 'descanso');
  assert.deepEqual(descansos('1:30').map((p) => p.seg), [90]);
  assert.deepEqual(descansos('2 min').map((p) => p.seg), [120]);
  assert.deepEqual(descansos('90s').map((p) => p.seg), [90]);
  assert.deepEqual(descansos('1.5 min').map((p) => p.seg), [90]);
  const rango = descansos('3-4 min')[0];
  assert.deepEqual([rango.seg, rango.segMax], [180, 240]);
  assert.deepEqual(rango.termina, { por: 'tiempo', min: 180, max: 240, valor: null });
  const libre = descansos('Recuperación total')[0];
  assert.equal(libre.seg, null, 'texto libre: sin cuenta');
  assert.equal(libre.texto, 'Recuperación total');
  assert.deepEqual(libre.termina, { por: 'boton' });
  assert.equal(descansos('0 seg').length, 0, 'cero no es un descanso');
  assert.equal(descansos('').length, 0);
  assert.equal(descansos(undefined).length, 0);
}

/* ---- Notas ---- */
{
  // Un día de puras notas: cada una es un paso.
  const notas = pasosDeLaSesion({ day: 'Sáb', cat: 'speed', exercises: [{ isNote: true, text: 'Sprint 6 x 30 yd' }, { isNote: true, text: 'Foam roller 10 min' }, { isNote: true, text: '  ' }] });
  assert.equal(notas.soloNotas, true);
  assert.deepEqual(notas.pasos.map((p) => [p.tipo, p.nombre, p.clave]), [['nota', 'Sprint 6 x 30 yd', 'n.0'], ['nota', 'Foam roller 10 min', 'n.1']]);
  assert.equal(notas.total, 2);
  // Notas entre ejercicios: encabezados del paso que sigue, no pasos.
  const mixto = pasosDeLaSesion({
    cat: 'gym',
    exercises: [{ isNote: true, text: 'CALENTAMIENTO' }, ex('Movilidad'), { isNote: true, text: 'FUERZA' }, ex('Sentadilla'), ex('Press')],
  });
  assert.deepEqual(mixto.pasos.map((p) => [p.nombre, p.encabezado]), [['Movilidad', 'CALENTAMIENTO'], ['Sentadilla', 'FUERZA'], ['Press', '']]);
  assert.equal(mixto.soloNotas, false);
  // Con varias vueltas, la nota encabeza solo la primera.
  const vueltas = pasosDeLaSesion({ cat: 'gym', exercises: [{ isNote: true, text: 'BLOQUE A' }, ex('Remo', { sets: '3', reps: '8' })] });
  assert.deepEqual(vueltas.pasos.map((p) => p.encabezado), ['BLOQUE A', '', ''], 'la nota de sección va en el primer paso del Set, no en cada vuelta');
}

/* ---- Lo que NO tiene pasos ---- */
{
  for (const dia of [
    undefined, null, {}, { exercises: [] }, { cat: 'off', exercises: [] },
    { cat: 'off', exercises: [{ isNote: true, text: 'Caminata Z1 30 min' }] }, // el descanso de su plan: lo enseña la tarjeta de descanso
    { cat: 'gym', exercises: [{ isNote: true, text: '' }] },
  ]) {
    const plan = pasosDeLaSesion(dia);
    assert.deepEqual(plan.pasos, []);
    assert.equal(plan.total, 0);
    const v = vistaDelEntreno(plan, undefined, 1);
    assert.deepEqual([v.estado, v.actual, v.completo, v.puedeAnterior], ['sin', null, false, false]);
  }
  // Un OFF con ejercicios de verdad sí tiene pasos.
  assert.equal(pasosDeLaSesion({ cat: 'off', exercises: [ex('Caminata', { reps: '30', unidad: 'min' })] }).pasos.length, 1);
}

/* ---- El deporte ---- */
{
  assert.equal(deporteDelTipo({ cat: 'gym' }), 'fuerza');
  assert.equal(deporteDelTipo({ cat: 'correr' }), 'correr');
  assert.equal(deporteDelTipo({ cat: 'bici' }), 'bici');
  assert.equal(deporteDelTipo({ cat: 'natacion' }), 'natacion');
  assert.equal(deporteDelTipo({ cat: 'otro', catNombre: 'Hyrox' }), null, 'un tipo propio no dice qué mide el reloj');
  assert.equal(deporteDelTipo({ cat: 'off' }), null);
  assert.equal(deporteDelTipo({}), 'fuerza');
  assert.equal(deporteDelTipo({ cat: 'inventado' }), 'fuerza', 'igual que `tipoDeSesion`: lo desconocido es gym');
  assert.equal(pasosDeLaSesion({ cat: 'otro', exercises: [ex('A')] }).deporte, null);
  assert.equal(pasosDeLaSesion({ cat: 'otro', exercises: [ex('A')] }, { deporte: 'correr' }).deporte, 'correr', 'el atleta o el coach lo puede decir');
}

/* ---- Un dato malformado no cuelga nada ---- */
{
  const enorme = { cat: 'gym', exercises: Array.from({ length: 40 }, (_, k) => ex(`E${k}`, { sets: '60', reps: '1', set: 1 })) };
  const plan = pasosDeLaSesion(enorme);
  assert.equal(plan.pasos.length, MAX_PASOS);
  assert.equal(plan.truncado, true);
  // Filas raras en la lista.
  const raro = pasosDeLaSesion({ cat: 'gym', exercises: [null, 'texto', 7, ex('Bueno')] });
  assert.deepEqual(raro.pasos.map((p) => p.nombre), ['Bueno']);
  assert.equal(pasosDeLaSesion({ cat: 'gym', exercises: [{ sets: '2' }] }).pasos[0].nombre, 'Ejercicio', 'sin nombre');
}

/* ---- El avance: horas inventadas ---- */
{
  const plan = pasosDeLaSesion(lower);
  const T0 = 1_000_000;
  let av;
  let v = vistaDelEntreno(plan, av, T0);
  assert.deepEqual([v.estado, v.indice, v.hechos, v.total, v.transcurrido, v.puedeAnterior], ['sin', 0, 0, 18, null, false]);
  assert.equal(v.actual.clave, '0.1.0');
  assert.equal(v.descansoDespues.clave, 'd.0.1.0', 'se sabe qué descanso sigue');
  assert.equal(v.siguiente.clave, '0.2.0');

  av = iniciaEntreno(av, T0);
  assert.equal(iniciaEntreno(av, T0 + 5000).inicio, T0, 'iniciar dos veces no mueve la hora');
  v = vistaDelEntreno(plan, av, T0 + 30_000);
  assert.deepEqual([v.estado, v.transcurrido], ['curso', 30_000]);

  // «Listo» en la vuelta 1: viene el descanso de 150 s, que cuenta desde AHORA.
  const tListo = T0 + 60_000;
  av = marcaListo(plan, av, tListo);
  assert.deepEqual(av.hechos['0.1.0'], { t: tListo, n: 'Back Squat' });
  v = vistaDelEntreno(plan, av, tListo + 30_000);
  assert.equal(v.actual.tipo, 'descanso');
  assert.deepEqual([v.hechos, v.puedeAnterior], [1, true]);
  assert.deepEqual([v.descanso.seg, v.descanso.restan, v.descanso.vencido, v.descanso.pasado], [150, 120, false, 0]);
  assert.equal(v.descanso.fin, tListo + 150_000);
  assert.equal(v.siguiente.clave, '0.2.0', '«Sigue: Back Squat»');
  assert.equal(v.descansoDespues, null);
  // Llega a cero: avisa, pero NO avanza solo; sigue contando hacia arriba.
  v = vistaDelEntreno(plan, av, tListo + 150_000);
  assert.deepEqual([v.descanso.restan, v.descanso.vencido, v.descanso.pasado], [0, true, 0]);
  v = vistaDelEntreno(plan, av, tListo + 160_000);
  assert.deepEqual([v.actual.tipo, v.descanso.restan, v.descanso.pasado], ['descanso', -10, 10]);
  // El teléfono estuvo apagado una hora: al volver todo se calcula igual.
  v = vistaDelEntreno(plan, av, tListo + 3_600_000);
  assert.equal(v.descanso.pasado, 3600 - 150);
  // «+30 s» alarga el descanso.
  av = masDescanso(plan, av, 30);
  v = vistaDelEntreno(plan, av, tListo + 150_000);
  assert.deepEqual([v.descanso.seg, v.descanso.extra, v.descanso.restan, v.descanso.vencido], [180, 30, 30, false]);
  assert.equal(masDescanso(plan, masDescanso(plan, av, 30), 30).extra['d.0.1.0'], 90);
  // «Seguir»: el descanso no cuenta como paso hecho.
  av = marcaListo(plan, av, tListo + 170_000);
  v = vistaDelEntreno(plan, av, tListo + 171_000);
  assert.equal(v.actual.clave, '0.2.0');
  assert.equal(v.hechos, 1);
  assert.equal(v.descanso, null);
  // El descanso siguiente cuenta desde el «Listo» de la vuelta 2, no desde el anterior.
  av = marcaListo(plan, av, tListo + 200_000, { reps: '4', kg: '100', seg: 31.4, otro: 'ignorado' });
  assert.deepEqual(av.hechos['0.2.0'], { t: tListo + 200_000, n: 'Back Squat', reps: '4', kg: '100', seg: 31 }, 'solo viaja lo que se cambió, y limpio');
  v = vistaDelEntreno(plan, av, tListo + 210_000);
  assert.deepEqual([v.descanso.desde, v.descanso.restan], [tListo + 200_000, 140]);
  // Un descanso que se salta cuenta como terminado.
  av = saltaPaso(plan, av, tListo + 211_000);
  assert.equal(vistaDelEntreno(plan, av, tListo + 212_000).actual.clave, '0.3.0');
  // Saltar un ejercicio: queda saltado y sigue el descanso que le toca.
  av = saltaPaso(plan, av, tListo + 220_000);
  v = vistaDelEntreno(plan, av, tListo + 221_000);
  assert.deepEqual([v.hechos, v.saltados, v.actual.clave], [2, 1, 'd.0.3.0']);
  assert.deepEqual(av.saltados['0.3.0'], { t: tListo + 220_000, n: 'Back Squat' });
  assert.equal(v.descanso.desde, tListo + 220_000, 'el descanso cuenta desde que se saltó');
  // «Anterior» regresa al ejercicio de antes y le quita la marca también a su descanso.
  av = vuelveAtras(plan, av);
  v = vistaDelEntreno(plan, av, tListo + 230_000);
  assert.equal(v.actual.clave, '0.3.0');
  assert.deepEqual([v.hechos, v.saltados], [2, 0]);
  assert.equal('0.3.0' in av.saltados, false);
  av = vuelveAtras(plan, av);
  assert.equal(vistaDelEntreno(plan, av, tListo + 240_000).actual.clave, '0.2.0', 'otra vez hacia atrás: la vuelta 2 (y su descanso)');
  assert.equal('d.0.2.0' in av.hechos, false, 'el descanso que le siguió también se desmarca');
  assert.equal('0.2.0' in av.hechos, false);
  assert.equal('d.0.1.0' in av.hechos, true, 'lo de antes se queda: se regresa a la vuelta 2, no al descanso previo');
  assert.equal('0.1.0' in av.hechos, true);
  // Sin nada atrás, «Anterior» no hace nada.
  const virgen = vuelveAtras(plan, iniciaEntreno(undefined, T0));
  assert.deepEqual(virgen.hechos, {});
  assert.equal(vistaDelEntreno(plan, virgen, T0).puedeAnterior, false);

  // Terminar antes de tiempo.
  const fin = terminaEntreno(av, tListo + 300_000);
  v = vistaDelEntreno(plan, fin, tListo + 9_999_999);
  assert.deepEqual([v.estado, v.transcurrido], ['fin', tListo + 300_000 - T0], 'el tiempo total se detiene al terminar');
  assert.equal(v.completo, false, 'faltaron pasos');
  assert.equal(terminaEntreno(fin, tListo + 400_000).fin, tListo + 300_000, 'terminar dos veces no mueve la hora');
  assert.equal(vistaDelEntreno(plan, reabreEntreno(fin), tListo + 301_000).estado, 'curso');
  assert.equal('fin' in vuelveAtras(plan, fin), false, 'regresar un paso reabre el entreno');

  // Terminarlo todo.
  let todo;
  let t = T0;
  for (let k = 0; k < plan.pasos.length; k += 1) todo = marcaListo(plan, todo, t += 1000);
  v = vistaDelEntreno(plan, todo, t);
  assert.deepEqual([v.completo, v.actual, v.hechos, v.total, v.estado], [true, null, 18, 18, 'curso']);
  assert.equal(Object.keys(todo.hechos).length, plan.pasos.length, 'los descansos también quedan marcados');
  assert.equal(marcaListo(plan, todo, t + 1).hechos['0.1.0'].t, T0 + 1000, 'sin pasos pendientes «Listo» no cambia nada');
}

/* ---- El plan cambia a la mitad del entreno ---- */
{
  const plan = pasosDeLaSesion(lower);
  let av;
  for (let k = 0; k < 3; k += 1) av = marcaListo(plan, av, 1000 * (k + 1)); // Back Squat vuelta 1, su descanso, vuelta 2
  assert.equal(vistaDelEntreno(plan, av, 5000).actual.clave, 'd.0.2.0');
  // El coach cambia el Back Squat por otro ejercicio: la marca vieja ya no cuenta.
  const cambiado = pasosDeLaSesion({ ...lower, exercises: [{ ...lower.exercises[0], name: 'Front Squat' }, ...lower.exercises.slice(1)] });
  assert.equal(vistaDelEntreno(cambiado, av, 5000).actual.clave, '0.1.0');
  assert.equal(vistaDelEntreno(cambiado, av, 5000).hechos, 0);
  // El coach agrega series (de 5 a 6): lo hecho se queda, y la vuelta nueva aparece al final del Set.
  const mas = pasosDeLaSesion({ ...lower, exercises: [{ ...lower.exercises[0], sets: '6' }, ...lower.exercises.slice(1)] });
  assert.equal(vistaDelEntreno(mas, av, 5000).actual.clave, 'd.0.2.0');
  assert.equal(mas.total, 19);
  // Un coach que quita todos los pasos: no hay actual, pero no falla.
  const vacio = vistaDelEntreno(pasosDeLaSesion({ cat: 'gym', exercises: [] }), av, 5000);
  assert.deepEqual([vacio.actual, vacio.hechos, vacio.total], [null, 0, 0]);
}

/* ---- Lo que llega de la base puede venir roto ---- */
{
  const vacio = { inicio: null, fin: null, oculto: false, hechos: {}, saltados: {}, extra: {}, empezados: {} };
  for (const basura of [undefined, null, 'x', 7, [], { hechos: [] }, { hechos: 'a', saltados: 5, inicio: 'ayer', extra: { a: -1, b: 'x', c: 0 } }]) {
    assert.deepEqual(leeAvance(basura), vacio);
  }
  const raro = leeAvance({ inicio: -5, fin: NaN, hechos: { a: { t: 5 }, b: { sin: 'hora' }, c: 'texto', d: { t: -1 } }, saltados: { e: { t: 9 } }, extra: { f: 30 } });
  assert.deepEqual(Object.keys(raro.hechos), ['a'], 'una marca sin hora o con hora imposible se descarta');
  assert.deepEqual([raro.inicio, raro.fin, Object.keys(raro.saltados), raro.extra], [null, null, ['e'], { f: 30 }]);
  // Las transiciones aguantan un avance roto y devuelven uno limpio.
  const plan = pasosDeLaSesion(lower);
  const limpio = marcaListo(plan, { hechos: 'roto', extra: 3 }, 100);
  assert.deepEqual(Object.keys(limpio.hechos), ['0.1.0']);
  assert.equal(limpio.v, 1);
}

/* ---- Quitar el entreno guiado de una sesión («Continuar entreno» ya no sale) ---- */
{
  const plan = pasosDeLaSesion(lower);
  const a = marcaListo(plan, iniciaEntreno(undefined, 100), 200);
  assert.equal(vistaDelEntreno(plan, a, 300).oculto, false, 'por defecto el entreno guiado está a la vista');
  const oculto = ocultaEntreno(a);
  assert.equal(vistaDelEntreno(plan, oculto, 300).oculto, true);
  assert.deepEqual(Object.keys(oculto.hechos), ['0.1.0'], 'quitarlo no borra lo que ya se hizo');
  assert.equal(oculto.oculto, true);
  assert.equal(a.oculto, undefined, 'sin quitarlo no se guarda la llave');
  // Sigue oculto aunque el atleta siga marcando pasos (o termine y deshaga).
  const sigue = marcaListo(plan, oculto, 400);
  assert.equal(vistaDelEntreno(plan, sigue, 500).oculto, true);
  assert.equal(vistaDelEntreno(plan, terminaEntreno(oculto, 600), 700).oculto, true);
  // Lo que llega roto no oculta nada.
  assert.equal(leeAvance({ oculto: 'sí' }).oculto, false);
  assert.equal(leeAvance({ oculto: 1 }).oculto, false);
  // Viaja por la base como una llave más.
  assert.deepEqual(diferencia(a, oculto), { oculto: true });
}

/* ---- Viaja bien por la base: se guarda por llaves y se mezcla sin pisar a otro dispositivo ---- */
{
  const plan = pasosDeLaSesion(lower);
  const a = iniciaEntreno(undefined, 100);
  const b = marcaListo(plan, a, 200);
  // Un «Listo» solo manda ESA llave: no el avance entero.
  assert.deepEqual(diferencia(a, b), { hechos: { '0.1.0': { t: 200, n: 'Back Squat' } } });
  assert.equal(diferencia(b, JSON.parse(JSON.stringify(b))), undefined, 'sin cambios no hay nada que mandar');
  // «Anterior» borra solo lo que quitó.
  const c = vuelveAtras(plan, marcaListo(plan, b, 300)); // se marca el descanso («Seguir») y se regresa: se borran la vuelta 1 y su descanso
  assert.deepEqual(diferencia(marcaListo(plan, b, 300), c), { hechos: { '0.1.0': BORRAR, 'd.0.1.0': BORRAR } });
  // Dos dispositivos marcan pasos DISTINTOS a la vez y la base los junta.
  const base = marcaListo(plan, a, 200); // el teléfono marcó la vuelta 1
  const reloj = { ...base, hechos: { ...base.hechos, 'd.0.1.0': { t: 250 } } }; // el reloj marcó el descanso
  const telefono = { ...base, hechos: { ...base.hechos, '0.2.0': { t: 400, n: 'Back Squat' } } }; // y el teléfono la vuelta 2
  const unido = aplicarParche(aplicarParche(base, diferencia(base, reloj)), diferencia(base, telefono));
  assert.deepEqual(Object.keys(unido.hechos).sort(), ['0.1.0', '0.2.0', 'd.0.1.0']);
  // Todo es JSON puro (sin `undefined`, sin fechas, sin funciones).
  assert.deepEqual(JSON.parse(JSON.stringify(unido)), unido);
}

/* ---- El hueco de «grabar técnica»: el id del video de esa vuelta se conserva en su marca ---- */
{
  const plan = pasosDeLaSesion(lower);
  const av = marcaListo(plan, undefined, 1000, { reps: '5', tecnica: '  9f3a-video  ', otro: 'x' });
  assert.deepEqual(av.hechos['0.1.0'], { t: 1000, n: 'Back Squat', reps: '5', tecnica: '9f3a-video' });
  assert.equal(marcaListo(plan, undefined, 1, { tecnica: 'x'.repeat(200) }).hechos['0.1.0'].tecnica.length, 64, 'con tope de largo');
  assert.equal('tecnica' in marcaListo(plan, undefined, 1, { tecnica: '   ' }).hechos['0.1.0'], false, 'vacío no se guarda');
  // Sobrevive a releerlo de la base y a otras marcas.
  const dos = marcaListo(plan, JSON.parse(JSON.stringify(av)), 2000);
  assert.equal(dos.hechos['0.1.0'].tecnica, '9f3a-video');
}

/* ---- Tocar un paso de la lista: uno de adelante, uno saltado ---- */
{
  const plan = pasosDeLaSesion(lower);
  let av;
  av = marcaListo(plan, av, 1000); // Back Squat, vuelta 1
  av = marcaListo(plan, av, 2000); // su descanso
  assert.equal(vistaDelEntreno(plan, av, 2500).actual.clave, '0.2.0');
  // El atleta toca «Hip Thrust» en la lista (más adelante, con un descanso detrás) y lo hace.
  const adelante = marcaListo(plan, av, 3000, { reps: '9' }, '3.1.0');
  assert.deepEqual(adelante.hechos['3.1.0'], { t: 3000, n: 'Hip Thrust', reps: '9' });
  assert.deepEqual(adelante.hechos['d.3.1.0'], { t: 3000 }, 'el descanso que le seguía ya no tiene sentido: queda hecho');
  let v = vistaDelEntreno(plan, adelante, 3500);
  assert.equal(v.actual.clave, '0.2.0', 'el paso actual no cambia: sigue siendo el primero sin marca');
  assert.equal(v.hechos, 2);
  const e = v.estados;
  assert.equal(e.length, plan.pasos.length);
  assert.equal(e[plan.pasos.findIndex((p) => p.clave === '3.1.0')], 'hecho');
  assert.equal(e[plan.pasos.findIndex((p) => p.clave === '0.2.0')], 'pendiente');
  // Uno de adelante que se salta: queda saltado y tampoco deja descanso suelto.
  const salto = saltaPaso(plan, av, 3000, '3.1.0');
  assert.deepEqual(salto.saltados['3.1.0'], { t: 3000, n: 'Hip Thrust' });
  assert.deepEqual(salto.hechos['d.3.1.0'], { t: 3000 });
  assert.equal(vistaDelEntreno(plan, salto, 3500).estados[plan.pasos.findIndex((p) => p.clave === '3.1.0')], 'saltado');
  // Lo saltado se puede hacer después: pasa a hecho y sale de saltados.
  const rehecho = marcaListo(plan, salto, 4000, undefined, '3.1.0');
  assert.deepEqual([rehecho.hechos['3.1.0'].t, '3.1.0' in rehecho.saltados], [4000, false]);
  // Lo hecho no se salta.
  assert.deepEqual(saltaPaso(plan, rehecho, 5000, '3.1.0').saltados, {});
  // Una clave que no existe no hace nada.
  assert.deepEqual(marcaListo(plan, av, 6000, undefined, 'no.existe').hechos, av.hechos);
  // Un paso que YA es el actual, con o sin clave, se marca igual.
  assert.deepEqual(marcaListo(plan, av, 7000, undefined, '0.2.0').hechos['0.2.0'], { t: 7000, n: 'Back Squat' });
  // Marcar un descanso por su clave es «Seguir».
  assert.deepEqual(Object.keys(marcaListo(plan, iniciaEntreno(undefined, 1), 9, undefined, 'd.0.1.0').hechos), ['d.0.1.0']);
}

/* ---- El cronómetro OPCIONAL de un paso con tiempo ---- */
{
  const plan = pasosDeLaSesion({ cat: 'gym', exercises: [ex('Plancha', { reps: '30', unidad: 'seg' }), ex('Dominadas', { reps: '8' })] });
  const T0 = 50_000;
  assert.equal(cuentaDe(plan.pasos[0], undefined, T0), null, 'sin arrancar no hay cuenta');
  let av = empiezaPaso(plan, undefined, T0);
  assert.deepEqual(av.empezados, { '0.1.0': T0 });
  assert.equal(av.inicio, T0, 'arrancar el cronómetro también inicia el entreno');
  assert.deepEqual(av.empezados, empiezaPaso(plan, av, T0 + 9000).empezados, 'arrancarlo otra vez no lo reinicia');
  let c = cuentaDe(plan.pasos[0], av, T0 + 10_000);
  assert.deepEqual([c.seg, c.restan, c.vencido, c.pasado, c.fin], [30, 20, false, 0, T0 + 30_000]);
  c = cuentaDe(plan.pasos[0], av, T0 + 30_000);
  assert.deepEqual([c.restan, c.vencido, c.pasado], [0, true, 0], 'llega a cero: avisa');
  c = cuentaDe(plan.pasos[0], av, T0 + 45_000);
  assert.deepEqual([c.restan, c.pasado], [-15, 15], 'y sigue contando hacia arriba, sin avanzar solo');
  assert.equal(vistaDelEntreno(plan, av, T0 + 45_000).actual.clave, '0.1.0');
  assert.equal(vistaDelEntreno(plan, av, T0 + 10_000).cuenta.restan, 20, 'la vista trae la cuenta del paso actual');
  // Un paso que no es de tiempo no tiene cronómetro, aunque se «arranque».
  assert.equal(cuentaDe(plan.pasos[1], empiezaPaso(plan, av, T0, '1.1.0'), T0), null);
  // Con rango de tiempo se cuenta el menor.
  const rango = pasosDeLaSesion({ cat: 'gym', exercises: [ex('Wall sit', { reps: '30-40', unidad: 'seg' })] });
  assert.equal(cuentaDe(rango.pasos[0], empiezaPaso(rango, undefined, 0), 0).seg, 30);
  // Detenerlo lo deja como si no se hubiera arrancado.
  assert.deepEqual(quitaCronometro(plan, av).empezados, {});
  // «Listo» limpia el cronómetro de ese paso, y «Anterior» el de los pasos que deshace.
  const hecho = marcaListo(plan, av, T0 + 31_000);
  assert.deepEqual(hecho.empezados, {});
  assert.equal(vistaDelEntreno(plan, hecho, T0 + 32_000).cuenta, null);
  const conOtro = empiezaPaso(plan, marcaListo(plan, undefined, T0), T0 + 1000);
  assert.deepEqual(Object.keys(conOtro.empezados), ['1.1.0']);
  assert.deepEqual(vuelveAtras(plan, conOtro).empezados, {}, 'al volver atrás se quitan los cronómetros de lo que se deshace');
  // Un cronómetro roto en la base se ignora.
  assert.deepEqual(leeAvance({ empezados: { a: 'x', b: -1, c: 5 } }).empezados, { c: 5 });
}

console.log('prueba-entreno: todo bien');
