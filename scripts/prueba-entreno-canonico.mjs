// Prueba del entreno en el idioma de los relojes (src/lib/entrenoCanonico.js): lo que un adaptador de Apple Watch o de Garmin leería.
//
//   node scripts/prueba-entreno-canonico.mjs
import assert from 'node:assert/strict';
import { pasosDeLaSesion } from '../src/lib/entreno.js';
import { aEntrenoCanonico } from '../src/lib/entrenoCanonico.js';
import { ponFormato, formatoNuevo } from '../src/lib/formatos.js';
import { parcheDeLapsos } from '../src/lib/lapsos.js';

const ex = (name, o = {}) => ({ name, ...o });
const lower = {
  day: 'Lun', name: 'Lower Strength', cat: 'gym',
  exercises: [
    ex('Back Squat', { sets: '5', reps: '5', intensity: '78%', descanso: '150 seg', descansoSet: '3 min', notes: 'Baja controlado.' }),
    ex('Bulgarian Split Squat', { sets: '3', reps: '6', porLado: true, intensity: 'RIR 2', set: 3 }),
    ex('Hip Thrust', { sets: '3', reps: '8', intensity: 'RIR 2', descanso: '90 seg', set: 3 }),
  ],
};

/* ---- Una sesión de fuerza ---- */
{
  const plan = pasosDeLaSesion(lower);
  const c = aEntrenoCanonico(plan, { nombre: 'Lower Strength' });
  assert.equal(c.v, 1);
  assert.equal(c.nombre, 'Lower Strength');
  assert.equal(c.deporte, 'fuerza');
  assert.equal(c.pasos.length, plan.pasos.length, 'sin relojes: un paso por cada uno de la app');
  const [p0, p1] = c.pasos;
  assert.deepEqual(p0, {
    clave: '0.1.0', tipo: 'trabajo', nombre: 'Back Squat', termina: { por: 'reps', valor: 5 }, meta: { tipo: 'porcentaje1RM', min: 78, max: 78 },
    opcional: false, serie: 1, vuelta: 1, vueltas: 5,
  });
  assert.deepEqual(p1, { clave: 'd.0.1.0', tipo: 'recuperacion', nombre: 'Descanso', termina: { por: 'tiempo', valor: 150 }, meta: null, opcional: false });
  // Nada de pantalla se cuela: ni notas, ni textos, ni encabezados.
  const duro = JSON.stringify(c);
  for (const interno of ['Baja controlado', 'encabezado', 'texto":"5 reps', 'idx', 'miembros', 'serieTag']) assert.equal(duro.includes(interno), false, `«${interno}» es de pantalla`);
  // «Por lado» sí viaja (un reloj tiene que saber que son dos lados), y solo cuando es verdad.
  assert.equal(c.pasos.find((p) => p.nombre === 'Bulgarian Split Squat').porLado, true);
  assert.equal('porLado' in p0, false);
  // El orden de claves es el de la app (así un reloj devuelve «paso 12» y se marca el 12).
  assert.deepEqual(c.pasos.map((p) => p.clave), plan.pasos.map((p) => p.clave));
  // Las repeticiones, como pista para plegar: Back Squat ×5 (con su descanso entre vueltas) y la bi-serie ×3.
  assert.deepEqual(c.grupos, [
    { serie: 1, repeticiones: 5, opcionales: 0, desde: 0, hasta: 8 },
    { serie: 2, repeticiones: 3, opcionales: 0, desde: 10, hasta: 17 },
  ]);
  assert.equal(c.pasos[9].clave, 'd.0.5.0', 'el descanso de DESPUÉS del Set queda fuera del grupo');
  assert.equal(c.pasos[9].tipo, 'recuperacion');
  assert.deepEqual(JSON.parse(JSON.stringify(c)), c, 'JSON puro');
}

/* ---- Cardio: ritmo en seg/km, distancia en metros, lapsos ---- */
{
  const dia = {
    cat: 'correr',
    exercises: [ex('Correr', {
      sets: '4',
      ...parcheDeLapsos([
        { reps: '800', unidad: 'm', intensity: '4:34-5:00 min/km', descanso: '' },
        { reps: '2', unidad: 'min', intensity: 'Zona 3', descanso: '60 seg' },
      ]),
    }), ex('Rodaje', { reps: '5', unidad: 'km', intensity: '250 W' })],
  };
  const c = aEntrenoCanonico(pasosDeLaSesion(dia));
  assert.equal(c.deporte, 'correr');
  assert.deepEqual(c.pasos[0].termina, { por: 'distancia', valor: 800 });
  assert.deepEqual(c.pasos[0].meta, { tipo: 'ritmoPorKm', min: 274, max: 300 });
  assert.deepEqual([c.pasos[0].lapso, c.pasos[0].lapsos], [1, 2]);
  // Para el atleta es UN paso con reloj; para un reloj de pulsera, la sucesión de sus lapsos, cada uno con su clave bajo la del paso de la app.
  assert.equal(c.pasos[0].clave, 'r.0#0.1.0');
  assert.equal(c.pasos[0].desde, 'r.0', 'sale del paso con reloj de la app');
  assert.ok(c.pasos.slice(0, -1).every((p) => p.desde === 'r.0'), 'todos los pasos del Set en lapsos, descansos incluidos, salen de él');
  assert.equal(c.pasos[c.pasos.length - 1].desde, undefined, 'el rodaje es un paso de la app, sin `desde`');
  assert.deepEqual(c.pasos[1].termina, { por: 'tiempo', valor: 120 });
  assert.deepEqual(c.pasos[1].meta, { tipo: 'zonaFC', min: 3, max: 3 });
  const rodaje = c.pasos[c.pasos.length - 1];
  assert.deepEqual(rodaje.termina, { por: 'distancia', valor: 5000 });
  assert.deepEqual(rodaje.meta, { tipo: 'potencia', min: 250, max: 250 });
  assert.deepEqual(c.grupos, [{ serie: 1, repeticiones: 4, opcionales: 0, desde: 0, hasta: c.pasos.findIndex((p) => p.clave === 'r.0#0.4.1') }]);
}

/* ---- Un reloj de formato se vuelve sus tramos ---- */
{
  const amrap = ponFormato([ex('Burpees', { set: 1 })], { id: 'amrap', pasos: [{ tipo: 'trabajo', seg: 720 }], vueltas: 1, tope: null, turnan: false, anota: 'rondas' });
  const c1 = aEntrenoCanonico(pasosDeLaSesion({ cat: 'gym', exercises: amrap }));
  assert.equal(c1.pasos.length, 1);
  assert.deepEqual(c1.pasos[0], { clave: 'r.0#0', desde: 'r.0', tipo: 'trabajo', nombre: 'Trabajo', termina: { por: 'tiempo', valor: 720 }, meta: null, opcional: false });
  // Un Tabata con dos ejercicios que se turnan: 8 tramos de 20 s de trabajo y 10 s de descanso por ejercicio.
  const tabata = ponFormato([ex('Sentadilla', { set: 1 }), ex('Flexiones', { set: 1 })], { ...formatoNuevo('tabata'), vueltas: 2, turnan: true });
  const c2 = aEntrenoCanonico(pasosDeLaSesion({ cat: 'gym', exercises: tabata }));
  assert.equal(c2.pasos.length, 8, '2 vueltas × 2 ejercicios × (trabajo + descanso)');
  assert.deepEqual(c2.pasos.map((p) => p.tipo), ['trabajo', 'recuperacion', 'trabajo', 'recuperacion', 'trabajo', 'recuperacion', 'trabajo', 'recuperacion']);
  assert.match(c2.pasos[0].nombre, /Sentadilla/);
  assert.match(c2.pasos[2].nombre, /Flexiones/);
  assert.ok(c2.pasos.every((p) => p.desde === 'r.0'), 'todos vienen del mismo paso de la app');
  assert.deepEqual(c2.grupos, [], 'un reloj de formato no es un Set que se repita: sus tramos ya están expandidos');
  // Un tramo «hasta Listo» no tiene tiempo: termina con el botón.
  const abierto = ponFormato([ex('Remo', { set: 1 })], { id: 'custom', pasos: [{ tipo: 'trabajo', seg: null }, { tipo: 'descanso', seg: 60 }], vueltas: 2, anota: 'cumplido' });
  assert.deepEqual(aEntrenoCanonico(pasosDeLaSesion({ cat: 'gym', exercises: abierto })).pasos[0].termina, { por: 'boton' });
}

/* ---- Poca información, notas, opcionales ---- */
{
  const poca = aEntrenoCanonico(pasosDeLaSesion({ cat: 'gym', exercises: [ex('Sentadilla'), ex('Press')] }));
  assert.deepEqual(poca.pasos.map((p) => [p.nombre, p.termina.por, p.meta]), [['Sentadilla', 'boton', null], ['Press', 'boton', null]]);
  assert.deepEqual(poca.grupos, []);
  const notas = aEntrenoCanonico(pasosDeLaSesion({ cat: 'speed', exercises: [{ isNote: true, text: 'Sprint 6 x 30 yd' }] }));
  assert.deepEqual(notas.pasos[0], { clave: 'n.0', tipo: 'nota', nombre: 'Sprint 6 x 30 yd', termina: { por: 'boton' }, meta: null, opcional: false });
  assert.equal(notas.deporte, 'velocidad');
  const vel = aEntrenoCanonico(pasosDeLaSesion({ cat: 'speed', exercises: [ex('Sprint', { sets: '5-6', reps: '30', unidad: 'yd', descanso: '90 seg' })] }));
  assert.deepEqual(vel.grupos, [{ serie: 1, repeticiones: 5, opcionales: 1, desde: 0, hasta: 10 }]);
  assert.equal(vel.pasos.at(-1).opcional, true, 'la vuelta 6 viaja marcada como opcional');
  assert.deepEqual(vel.pasos[0].termina, { por: 'distancia', valor: 27.43 }, 'yardas ya en metros');
  // Un día sin nada, o de descanso, es un entreno vacío (no falla).
  assert.deepEqual(aEntrenoCanonico(pasosDeLaSesion({ cat: 'off', exercises: [] })).pasos, []);
  // Tipo propio: sin deporte; cargas de texto libre y clusters.
  const raro = aEntrenoCanonico(pasosDeLaSesion({
    cat: 'otro', exercises: [ex('Snatch', { reps: '2+2+2', unidad: 'cluster', entreBloques: '20', intensity: 'Pesado' })],
  }));
  assert.equal(raro.deporte, null);
  assert.deepEqual(raro.pasos[0].termina, { por: 'reps', valor: 6, bloques: [2, 2, 2], entreBloques: 20 });
  assert.deepEqual(raro.pasos[0].meta, { tipo: 'texto', texto: 'Pesado' });
}

console.log('prueba-entreno-canonico: todo bien');
