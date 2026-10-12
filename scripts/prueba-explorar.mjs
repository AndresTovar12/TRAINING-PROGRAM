/* Pruebas de lo puro de Explorar: `node scripts/prueba-explorar.mjs`. */
import assert from 'node:assert/strict';
import { coachesParaMostrar, coincideConBusqueda, deporteFavorito, deportesDelCoach, deportesQueSalen, desdeTexto, planesDeLosCoaches, planesTexto } from '../src/lib/explorar.js';

let n = 0;
const prueba = (nombre, f) => { f(); n += 1; console.log(`  ✓ ${nombre}`); };

const ana = { usuario: 'ana_pilates', nombre: 'Ana Pérez', profesion: 'instructora_pilates', disciplinas: ['pilates'], deportes: ['pilates', 'yoga'], n_planes: 3, desde: 300, planes: [{ slug: 'reformer', titulo: 'Reformer en casa', precio: 300 }, { slug: 'mat', titulo: 'Mat 30 días', precio: 500 }] };
const beto = { usuario: 'beto_run', nombre: 'Beto Ríos', profesion: 'entrenador', disciplinas: ['running'], deportes: [], n_planes: 1, desde: 600, planes: [{ slug: 'diez-k', titulo: 'Tus primeros 10 km', precio: 600 }] };
const caro = { usuario: 'caro_bici', nombre: 'Carolina', profesion: 'entrenador', disciplinas: [], deportes: ['ciclismo', 'triatlon'], n_planes: 2, desde: 450, planes: [] };
const todos = [ana, beto, caro];

console.log('Deporte favorito');
prueba('el que más ha entrenado, agrupando carrera, caminata y senderismo', () => {
  assert.equal(deporteFavorito([{ deporte: 'correr' }, { deporte: 'caminar' }, { deporte: 'bici' }]), 'running');
  assert.equal(deporteFavorito([{ deporte: 'bici' }, { deporte: 'bici' }, { deporte: 'correr' }]), 'ciclismo');
  assert.equal(deporteFavorito([{ deporte: 'natacion' }]), 'natacion');
});
prueba('sin entrenos o con deportes que no cuentan, ninguno', () => {
  assert.equal(deporteFavorito([]), null);
  assert.equal(deporteFavorito(null), null);
  assert.equal(deporteFavorito([{ deporte: 'otro' }]), null);
});
prueba('si empatan, gana el que va primero en la lista de siempre', () => {
  assert.equal(deporteFavorito([{ deporte: 'bici' }, { deporte: 'correr' }]), 'running');
});

console.log('Fichas de deporte');
prueba('solo salen los deportes que algún coach tiene (de su perfil o de sus planes)', () => {
  assert.deepEqual(deportesDelCoach(ana), ['pilates', 'yoga']);
  assert.deepEqual(deportesQueSalen(todos), ['running', 'ciclismo', 'triatlon', 'pilates', 'yoga']);
  assert.deepEqual(deportesQueSalen([]), []);
});
prueba('el favorito de la persona va primero, si hay quien lo enseñe', () => {
  assert.deepEqual(deportesQueSalen(todos, 'pilates').slice(0, 2), ['pilates', 'running']);
  assert.deepEqual(deportesQueSalen(todos, 'natacion'), ['running', 'ciclismo', 'triatlon', 'pilates', 'yoga'], 'nadie lo enseña: no aparece');
});

console.log('Búsqueda');
prueba('por nombre, oficio, plan o deporte; sin acentos ni mayúsculas', () => {
  assert.equal(coincideConBusqueda(ana, 'perez'), true);
  assert.equal(coincideConBusqueda(ana, 'REFORMER'), true);
  assert.equal(coincideConBusqueda(beto, '10 km'), true);
  assert.equal(coincideConBusqueda(caro, 'triatlón'), true);
  assert.equal(coincideConBusqueda(beto, 'pilates'), false);
  assert.equal(coincideConBusqueda(ana, ''), true);
  assert.equal(coincideConBusqueda(ana, 'ana pilates'), true, 'varias palabras: todas tienen que estar');
  assert.equal(coincideConBusqueda(ana, 'ana running'), false);
});

console.log('Qué coaches salen y en qué orden');
prueba('sin filtros salen todos: más planes primero', () => {
  assert.deepEqual(coachesParaMostrar(todos).map((c) => c.usuario), ['ana_pilates', 'caro_bici', 'beto_run']);
});
prueba('el deporte favorito pone primero a quien lo enseña', () => {
  assert.deepEqual(coachesParaMostrar(todos, { favorito: 'running' }).map((c) => c.usuario), ['beto_run', 'ana_pilates', 'caro_bici']);
});
prueba('filtrar por deporte deja solo a quien lo enseña', () => {
  assert.deepEqual(coachesParaMostrar(todos, { deporte: 'yoga' }).map((c) => c.usuario), ['ana_pilates']);
  assert.deepEqual(coachesParaMostrar(todos, { deporte: 'natacion' }), []);
});
prueba('búsqueda y deporte juntos', () => {
  assert.deepEqual(coachesParaMostrar(todos, { texto: 'car', deporte: 'ciclismo' }).map((c) => c.usuario), ['caro_bici']);
  assert.deepEqual(coachesParaMostrar(todos, { texto: 'car', deporte: 'pilates' }), []);
});
prueba('no se modifica la lista original', () => {
  const antes = todos.map((c) => c.usuario).join();
  coachesParaMostrar(todos, { favorito: 'running' });
  assert.equal(todos.map((c) => c.usuario).join(), antes);
});

console.log('Textos y tira de planes');
prueba('«desde $300» con varios planes y «$600» con uno', () => {
  assert.equal(desdeTexto(ana), 'desde $300');
  assert.equal(desdeTexto(beto), '$600');
  assert.equal(desdeTexto({ n_planes: 2, desde: 1500 }), 'desde $1,500');
  assert.equal(desdeTexto({}), '');
});
prueba('«1 plan» y «3 planes»', () => { assert.equal(planesTexto(1), '1 plan'); assert.equal(planesTexto(3), '3 planes'); });
prueba('la tira junta los planes con quién los vende y respeta el tope', () => {
  const tira = planesDeLosCoaches(todos);
  assert.deepEqual(tira.map((p) => p.slug), ['reformer', 'mat', 'diez-k']);
  assert.equal(tira[2].coach.usuario, 'beto_run');
  assert.equal(planesDeLosCoaches(todos, 1).length, 1);
});

console.log(`\n${n} pruebas, todas bien.`);
