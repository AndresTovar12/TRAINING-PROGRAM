/* Qué pantalla le toca a cada paso (`lib/caraDelPaso.js`). `node scripts/prueba-cara-del-paso.mjs`.
   Lo que cuida: que la app ya no ADIVINE la pantalla por la sesión. Una sentadilla dentro de una sesión con carrera (el Híbrido) va en la de Gym. */
import { caraDelPaso, esDeNumeros, pantallaDelPaso, CARAS_DE_PASO } from '../src/lib/caraDelPaso.js';
import { pasosDeLaSesion } from '../src/lib/entreno.js';
import { readFileSync } from 'node:fs';

let fallas = 0;
const ve = (ok, t) => { if (!ok) fallas += 1; console.log(`${ok ? '✓' : '✗'} ${t}`); };
// La semana de prueba de Ana, guardada aquí para no depender de la maqueta.
const dias = JSON.parse(readFileSync(new URL('./sesiones-de-prueba.json', import.meta.url), 'utf8')).dias;
const dia = (d) => dias.find((x) => x.day === d);
const trabajo = (plan) => plan.pasos.filter((p) => p.tipo !== 'descanso');

// 1. Gym no cambia: todo paso de Sets es de Gym y ninguno es negro.
const gym = pasosDeLaSesion(dia('Vie'));
ve(trabajo(gym).length > 0 && trabajo(gym).every((p) => caraDelPaso(p) === 'gym'), 'Gym (Fuerza pierna): todos sus pasos van en la pantalla de Gym');
ve(gym.pasos.every((p, i) => !pantallaDelPaso({ paso: p, siguiente: gym.pasos[i + 1], anterior: gym.pasos[i - 1] }).negra), 'Gym: nada sale en negro, tampoco los descansos');

// 2. La lista: cada paso DICE su cara, y es una de las que existen.
for (const d of ['Mar', 'Mié', 'Sáb', 'Dom']) {
  const plan = pasosDeLaSesion(dia(d));
  ve(trabajo(plan).every((p) => CARAS_DE_PASO.includes(p.cara)), `${dia(d).name}: cada paso dice su pantalla (${[...new Set(trabajo(plan).map((p) => p.cara))].join(', ')})`);
}
const sab = pasosDeLaSesion(dia('Sáb'));
const de = (n) => sab.pasos.find((p) => p.nombre === n);
ve(caraDelPaso(de('Skip A')) === 'lejos' && caraDelPaso(de('Switches')) === 'lejos', 'Velocidad en pista: Skip A y Switches van «de lejos» (clara)');
// Negra SOLO con números que cambian (Andrés, 23 nov 2026: «¿para qué cambia la pantalla a color negro? ¿cuál es la función?»).
ve(caraDelPaso(de('Sprint con trineo')) === 'lejos', 'Velocidad en pista: el sprint de 30 m va en la clara (no hay números que cambien)');
const iSprint = sab.pasos.findIndex((p) => p.nombre === 'Sprint con trineo');
const descansoEntreCortos = sab.pasos[iSprint + 1];
ve(descansoEntreCortos?.tipo === 'descanso' && !pantallaDelPaso({ paso: descansoEntreCortos, siguiente: sab.pasos[iSprint + 2], anterior: sab.pasos[iSprint] }).negra, 'El descanso entre dos sprints cortos es claro');
const largo = sab.pasos.find((p) => p.tipo === 'ejercicio' && p.termina?.por === 'distancia' && Number(p.termina.min) >= 400);
ve(esDeNumeros(largo), 'El sprint de 400 m sí va en la negra (el GPS mide metros y ritmo)');
const iLargo = sab.pasos.indexOf(largo);
ve(pantallaDelPaso({ paso: sab.pasos[iLargo + 1], siguiente: sab.pasos[iLargo + 2], anterior: largo }).negra, 'El descanso entre sprints de 400 m es negro');
const dom = pasosDeLaSesion(dia('Dom'));
ve(trabajo(dom).filter((p) => p.termina?.por === 'distancia').every((p) => caraDelPaso(p) === 'lejos'), 'Natación: lo que se nada por distancia va en la clara (sin GPS no hay números que cambien)');
const mar = pasosDeLaSesion(dia('Mar'));
ve(trabajo(mar).every((p) => caraDelPaso(p) === 'numeros'), 'Rodillo por tiempo: todo en la negra (la cuenta cambia)');

// 3. LA MEZCLA (lo que hará el Híbrido): carrera + sentadilla + reloj + técnica en una misma sesión.
const correr = { clave: 'a', tipo: 'ejercicio', nombre: 'Correr', cara: 'numeros' };
const squat = { clave: '0.1.0', tipo: 'ejercicio', nombre: 'Back squat', idx: 0 };
const amrap = { clave: 'r.1', tipo: 'reloj', nombre: 'AMRAP' };
const skip = { clave: 'b', tipo: 'ejercicio', nombre: 'Skip A', cara: 'lejos' };
const d = (k) => ({ clave: `d.${k}`, tipo: 'descanso' });
ve(pantallaDelPaso({ paso: squat }).pantalla === 'gym' && !pantallaDelPaso({ paso: squat }).negra, 'Una sentadilla en una sesión con carrera va en la pantalla de Gym, no en la negra');
ve(pantallaDelPaso({ paso: correr }).negra, 'La carrera de esa misma sesión sí va en la negra');
ve(pantallaDelPaso({ paso: amrap }).pantalla === 'reloj', 'Un Set con reloj va en la del reloj');
ve(pantallaDelPaso({ paso: skip }).pantalla === 'lejos', 'La técnica va «de lejos»');
ve(pantallaDelPaso({ paso: d('a'), siguiente: squat, anterior: correr }).pantalla === 'descanso', 'El descanso antes de la sentadilla es claro (toma el color de lo que sigue)');
ve(pantallaDelPaso({ paso: d('0'), siguiente: correr, anterior: squat }).pantalla === 'descansoNegro', 'El descanso antes de la carrera es negro');
ve(pantallaDelPaso({ paso: d('a'), siguiente: null, anterior: correr }).negra, 'Un descanso sin nada después toma el color de lo que acaba de hacer');

// 4. Los bordes.
ve(pantallaDelPaso({ antes: true, paso: correr }).pantalla === 'antes' && !pantallaDelPaso({ antes: true, paso: correr }).negra, '«Antes de empezar» nunca es negra');
ve(caraDelPaso({ tipo: 'ejercicio', cara: 'inventada' }) === 'gym', 'Una cara que no existe cae en la de Gym, no se rompe');
ve(caraDelPaso(null) === null && pantallaDelPaso({ paso: null }).pantalla === null, 'Sin paso no se dibuja nada');
const sinVideo = pasosDeLaSesion({ name: 'x', exercises: [], tramos: [{ id: 'c', k: 'tr', rol: 'cal', forma: 'video', q: '5', video: {} }] }).pasos[0];
const conVideo = pasosDeLaSesion({ name: 'x', exercises: [], tramos: [{ id: 'c', k: 'tr', rol: 'cal', forma: 'video', video: { url: '/v.mp4', duracion: 60 } }] }).pasos[0];
ve(caraDelPaso(conVideo) === 'guiado', 'Un calentamiento guiado con video va en la del video');
ve(caraDelPaso(sinVideo) === 'gym', 'Un «guiado» al que no le eligieron video no se queda sin pantalla');

console.log(fallas ? `\n${fallas} ✗` : '\nTodo bien: cada paso dice su pantalla.');
process.exit(fallas ? 1 : 0);
