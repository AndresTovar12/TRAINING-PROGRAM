// Prueba de la fase 7 (29 oct 2026): cómo se leen los números de un entreno (el número protagonista, la frase, los secundarios, el tiempo sin ceros de más,
// «Hoy, 9:39 a. m.»), la página de un workout del plan («16 de 16», «Lo que hiciste») y los filtros y totales de «Ver todos».
//
//   node scripts/prueba-pagina-del-entreno.mjs
import assert from 'node:assert/strict';
import {
  cuandoCorto, cuandoFue, lineaDeActividad, ejerciciosDeLaSesion, filaDelRecord, filaDelRecordDelPlan, filtroDe, filtrosDe, fraseDeActividad, heroeDeActividad,
  numerosDeSesion, secundariosDeActividad, subtituloDelHistorial, tiempoCorto, tiempoGrande, tiempoTotal, tituloDelMes, totalDelMes, zonasSimples,
} from '../src/lib/paginaDelEntreno.js';
import { recordDelPlan } from '../src/lib/stickers/plan.js';
import { sesionesDelPlan } from '../src/lib/entrenosDelPlan.js';

const MX = -360; // México: UTC-6
// Una hora local de México como ISO.
const mx = (texto) => new Date(Date.parse(`${texto}Z`) - MX * 60000).toISOString();
const AHORA = Date.parse(mx('2026-10-29T10:00:00')); // jueves 29 de octubre de 2026, 10 a. m.

/* ---- El tiempo, sin ceros de más ---- */
{
  assert.equal(tiempoCorto(48 * 60 + 5), '48:05');
  assert.equal(tiempoCorto(3600 + 2 * 60 + 13), '1:02:13');
  assert.equal(tiempoCorto(7), '0:07');
  assert.deepEqual(tiempoGrande(70 * 60 + 4), ['1 h 10', 'min'], 'pádel: «1 h 10 min»');
  assert.deepEqual(tiempoGrande(38 * 60), ['38', 'min']);
  assert.deepEqual(tiempoGrande(7200), ['2', 'h']);
  assert.equal(tiempoTotal(5 * 3600 + 9 * 60), '5 h 9 min');
  assert.equal(tiempoTotal(42 * 60), '42 min');
}

/* ---- Cuándo fue ---- */
{
  assert.equal(cuandoFue(mx('2026-10-29T09:39:00'), MX, AHORA), 'Hoy, 9:39 a. m.');
  assert.equal(cuandoFue(mx('2026-10-28T18:40:00'), MX, AHORA), 'Ayer, 6:40 p. m.');
  assert.equal(cuandoFue(mx('2026-10-26T18:05:00'), MX, AHORA), 'Lunes 26, 6:05 p. m.');
  assert.equal(cuandoFue(mx('2026-09-28T08:00:00'), MX, AHORA), 'Lunes 28 de sep., 8:00 a. m.');
  assert.equal(cuandoFue(mx('2025-12-01T12:30:00'), MX, AHORA), 'Lunes 1 de dic. de 2025, 12:30 p. m.');
  assert.equal(cuandoCorto(mx('2026-10-26T18:05:00'), MX, AHORA), 'hace 3 días');
  assert.equal(cuandoCorto(mx('2026-10-19T07:02:00'), MX, AHORA), '19 oct');
}

/* ---- Un entreno libre: el número protagonista y los secundarios ---- */
const carrera = (id, dia, km, seg, extra = {}) => ({ id, deporte: 'correr', titulo: null, inicio: mx(dia), desfase_min: MX, distancia_m: km * 1000, duracion_s: seg, metricas: { ritmo_medio_s_km: seg / km }, ...extra });
{
  const c = carrera('c1', '2026-10-28T07:12:00', 5, 27 * 60 + 15);
  assert.deepEqual(heroeDeActividad(c), { valor: '5.00', unidad: 'km', etiqueta: 'Distancia' });
  assert.deepEqual(secundariosDeActividad(c).map((s) => `${s.valor}${s.unidad}`), ['27:15', '5:27/km']);
  const nado = { deporte: 'natacion', distancia_m: 1500, duracion_s: 30 * 60 + 45 };
  assert.deepEqual(heroeDeActividad(nado), { valor: '1,500', unidad: 'm', etiqueta: 'Distancia' });
  assert.deepEqual(secundariosDeActividad(nado).map((s) => `${s.valor}${s.unidad}`), ['30:45', '2:03/100 m']);
  const padel = { deporte: 'raqueta', titulo: 'Pádel', duracion_s: 70 * 60 + 4, kcal_activas: 610, fc_media: 138 };
  assert.deepEqual(heroeDeActividad(padel), { valor: '1 h 10', unidad: 'min', etiqueta: 'Tiempo' });
  assert.deepEqual(secundariosDeActividad(padel).map((s) => s.etiqueta), ['Calorías', 'Pulso medio']);
  assert.equal(secundariosDeActividad(padel)[1].pulso, true, 'el pulso va en rojo');
  const bici = { deporte: 'bici', distancia_m: 22400, duracion_s: 3733, desnivel_pos_m: 180, metricas: { velocidad_media_kmh: 21.6 }, fc_media: 141 };
  assert.equal(lineaDeActividad(c), '5.00 km · 5:27 /km');
  assert.equal(lineaDeActividad(nado), '1,500 m · 2:03 /100 m');
  assert.equal(lineaDeActividad(padel), '1 h 10 min · 610 kcal');
  assert.equal(lineaDeActividad(bici), '22.40 km · 21.6 km/h');
  assert.deepEqual(secundariosDeActividad(bici).map((s) => s.etiqueta), ['Tiempo', 'Velocidad', 'Subida'], 'tres como mucho: el pulso queda en «Tu pulso»');
}

/* ---- La frase: qué significa ---- */
{
  const semana = [
    carrera('c1', '2026-10-28T07:12:00', 5, 27 * 60 + 15), // miércoles, la más rápida
    carrera('c2', '2026-10-27T07:00:00', 5, 29 * 60),
    carrera('c3', '2026-10-26T07:00:00', 4, 24 * 60),
    carrera('c4', '2026-10-19T07:02:00', 8.2, 46 * 60 + 21), // la más larga de octubre
    carrera('c5', '2026-09-06T08:20:00', 5, 28 * 60 + 8), // la primera
  ];
  assert.equal(fraseDeActividad(semana[0], { otras: semana }), 'Tu tercera carrera de la semana, y la más rápida.');
  assert.equal(fraseDeActividad(semana[1], { otras: semana }), 'Tu segunda carrera de la semana.');
  assert.equal(fraseDeActividad(semana[3], { otras: semana }), 'Tu carrera más larga de octubre.');
  assert.equal(fraseDeActividad(semana[4], { otras: semana }), 'Tu primera carrera en Training Lab.');
  assert.equal(fraseDeActividad(semana[4], { otras: semana, desde: Date.parse(semana[3].inicio) }), 'Una carrera de 28 minutos.', 'sin saber qué hizo antes, una neutra');
  const caminata = { id: 'k1', deporte: 'caminar', inicio: mx('2026-10-16T19:40:00'), desfase_min: MX, distancia_m: 3100, duracion_s: 37 * 60 + 40 };
  const otra = { ...caminata, id: 'k0', inicio: mx('2026-09-14T19:10:00'), distancia_m: 4200 };
  assert.equal(fraseDeActividad(caminata, { otras: [otra] }), 'Una caminata de 38 minutos.');
  assert.equal(fraseDeActividad({ id: 'n', deporte: 'natacion', titulo: null, inicio: mx('2026-10-12T06:30:00'), desfase_min: MX, distancia_m: 1500, duracion_s: 1845 }, { otras: [] }), 'Tu primer nado en Training Lab.');
}

/* ---- El récord en su fila, con contra qué se compara ---- */
{
  const r = { tipo: 'ritmo', texto: 'Tu ritmo más rápido', valor: '5:27 /km', diferencia: '11 s/km más rápido', antesInicio: mx('2026-10-07T07:15:00'), antesDesfase: MX };
  assert.deepEqual(filaDelRecord(r), { titulo: 'Tu ritmo más rápido: 5:27 /km', sub: '11 s/km más rápido que tu mejor, del 7 de octubre.' });
  assert.equal(filaDelRecord({ tipo: 'primera', texto: 'Tu primer registro de Correr' }), null, 'la primera vez ya la dice la frase');
}

/* ---- Un workout del plan ---- */
{
  const day = { name: 'Lower A', exercises: [{ name: 'Back squat', sets: '4', reps: '5', intensity: '100 kg' }, { name: 'Plank', sets: '3', reps: '45 seg' }] };
  const marcas = Object.fromEntries([
    ...Array.from({ length: 4 }, (_, i) => [`0.${i + 1}.0`, { t: 1000 * (i + 1), n: 'Back squat' }]),
    ...Array.from({ length: 2 }, (_, i) => [`1.${i + 1}.0`, { t: 9000 + 1000 * i, n: 'Plank' }]),
  ]);
  const registro = { entreno: { inicio: 0, hechos: marcas }, exercises: { 0: { weight: '100', repsHechas: '5' } } };
  const ejercicios = ejerciciosDeLaSesion(day, registro);
  assert.deepEqual(ejercicios, [
    { nombre: 'Back squat', programado: '4 × 5 · 100 kg', hechas: 4, programadas: 4 },
    { nombre: 'Plank', programado: '3 × 45 s', hechas: 2, programadas: 3 },
  ]);
  const faltan = numerosDeSesion({ hechas: 6, programadas: 7, segundos: 49 * 60 + 20, volumen: 3960, coach: 'Andrés', ejercicios });
  assert.deepEqual(faltan.heroe, { valor: '6', unidad: 'de 7', etiqueta: 'Series del plan' });
  assert.equal(faltan.frase, 'Series hechas: te faltó una de plank.');
  assert.deepEqual(faltan.secundarios.map((s) => `${s.valor}${s.unidad}`), ['49:20', '3,960kg']);
  const todas = numerosDeSesion({ hechas: 16, programadas: 16, segundos: 48 * 60 + 5, volumen: 4280, coach: 'Andrés', fc: 128 });
  assert.equal(todas.frase, 'Todas las series que programó Andrés.');
  assert.deepEqual(todas.secundarios.map((s) => s.etiqueta), ['Tiempo', 'Volumen', 'Pulso medio']);
  const mano = numerosDeSesion({ manual: true, ejercicios });
  assert.equal(mano.heroe.valor, '2');
  assert.equal(mano.frase, 'Lo marcaste como hecho, sin el entreno guiado.');
  assert.deepEqual(mano.secundarios, [], 'sin tiempo');

  const r = recordDelPlan({ day, registro, mejorAntes: () => 95 });
  assert.deepEqual(filaDelRecordDelPlan(r), { titulo: 'Récord en Back squat: 100 kg × 5', sub: 'Justo lo programado: 4 × 5 con 100 kg. Antes levantabas 95 kg.' });
}

/* ---- El pulso en tres ---- */
{
  assert.deepEqual(zonasSimples([600, 1200, 1500, 600, 100]), [45, 38, 17], 'suman 100');
  assert.equal(zonasSimples([0, 0, 0, 0, 0]), null);
}

/* ---- Las marcadas a mano también son entrenos ---- */
{
  const estado = { 'wr:sessions': { 'f1-w1-d0': { completed: true, completedAt: mx('2026-10-27T20:00:00') }, 'f1-w1-d1': { completed: false } } };
  const lista = sesionesDelPlan(estado, []);
  assert.equal(lista.length, 1);
  assert.equal(lista[0].s.manual, true);
  assert.equal(lista[0].s.inicio, Date.parse(mx('2026-10-27T20:00:00')), 'con la hora en que la marcó');
}

/* ---- «Ver todos»: filtros y totales ---- */
{
  const a = (titulo, deporte, seg) => ({ actividad: { titulo, deporte, duracion_s: seg } });
  const plan = { plan: { s: { inicio: 0, fin: 46 * 60 * 1000 } } };
  const lista = [a(null, 'caminar', 2260), plan, a('Pádel', 'raqueta', 4204), a(null, 'correr', 1635), a(null, 'natacion', 1845), a(null, 'bici', 3733)];
  assert.deepEqual(filtrosDe(lista).map((f) => f.nombre), ['Correr', 'Bici', 'Fuerza', 'Pádel', 'Caminar', 'Nadar']);
  assert.equal(filtroDe(plan).id, 'fuerza', 'un workout del plan cuenta como Fuerza');
  assert.equal(totalDelMes(lista.slice(0, 3)), '3 entrenos · 2 h 34 min');
  assert.equal(totalDelMes([a('Pádel', 'raqueta', 4204)]), '1 entreno · 1 h 10 min');
  assert.equal(tituloDelMes('Octubre 2026', AHORA), 'Octubre');
  assert.equal(tituloDelMes('Octubre 2025', AHORA), 'Octubre 2025');
  assert.equal(subtituloDelHistorial(11, Date.parse(mx('2026-09-06T08:20:00')), AHORA), '11 entrenos · desde septiembre');
}

console.log('prueba-pagina-del-entreno: todo bien');
