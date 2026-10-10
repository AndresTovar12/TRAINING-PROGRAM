/* El catálogo de íconos de los tipos de sesión y su búsqueda (`lib/iconosDeTipo*.js`).
   Se corre con:  node scripts/prueba-iconos-de-tipo.mjs

   Dos cosas: (1) que el catálogo esté sano —un id nunca se repite ni cambia de forma, porque se guarda en la base y en cada día del plan— y
   (2) que «Boxeo» encuentre el guante, «Spinning» la bicicleta y «Terapia de hombro» NO encuentre «Destellos» (empieza con «de»). */
import assert from 'node:assert/strict';
import * as datos from '../src/lib/iconosDeTipo.datos.js';
import { armaCatalogo, buscaIconos, ICONO_NEUTRO, normaliza, sugiereIcono } from '../src/lib/iconosDeTipo.js';

const cat = armaCatalogo(datos);

/* ---------- El catálogo está sano ---------- */
assert.ok(cat.iconos.length >= 240, `hay pocos íconos (${cat.iconos.length})`);
assert.equal(new Set(cat.iconos.map((i) => i.id)).size, cat.iconos.length, 'hay ids repetidos');
for (const ic of cat.iconos) {
  assert.match(ic.id, /^[a-z0-9-]{1,40}$/, `id con forma rara: ${ic.id}`);
  assert.ok(ic.nombre.trim(), `${ic.id}: sin nombre`);
  assert.ok(ic.svg.includes('<'), `${ic.id}: sin dibujo`);
  assert.ok(!/<script|onload|onerror|javascript:/i.test(ic.svg), `${ic.id}: el dibujo trae algo que no es un trazo`);
  assert.ok(cat.categorias.some((c) => c.id === ic.cat), `${ic.id}: categoría que no existe (${ic.cat})`);
  assert.equal(ic.palabras, normaliza(ic.palabras), `${ic.id}: las palabras van sin acentos y en minúscula`);
  assert.match(ic.origen, /^[lt]:[a-z0-9-]+$/, `${ic.id}: origen raro (${ic.origen})`);
}
for (const c of cat.categorias) assert.ok(cat.iconos.some((i) => i.cat === c.id), `la categoría ${c.id} no tiene íconos`);
assert.ok(cat.porId.has(ICONO_NEUTRO), 'falta el ícono neutro');

// Los ids que ya viajan en planes y bases no se pueden perder jamás: si algún día se deja de ofrecer uno, se conserva en el catálogo.
const IDS_QUE_YA_EXISTEN = ['pesa', 'barra', 'correr', 'bici', 'nadar', 'yoga', 'boxeo', 'estetoscopio', 'luna', 'etiqueta', 'pingpong', 'karate', 'musica'];
for (const id of IDS_QUE_YA_EXISTEN) assert.ok(cat.porId.has(id), `se perdió el ícono «${id}»`);

/* ---------- Normalizar ---------- */
assert.equal(normaliza('Natación'), 'natacion');
assert.equal(normaliza('  PÁDEL '), 'padel');
assert.equal(normaliza(null), '');

/* ---------- Sugerir un ícono por el nombre ---------- */
// nombre → uno de estos (a veces dos dibujos le van igual de bien)
const ESPERADOS = {
  Boxeo: ['boxeo'], Spinning: ['bici'], 'Tenis de mesa': ['pingpong'], Natación: ['nadar'], 'Yoga restaurativo': ['yoga'], Kettlebell: ['pesa-rusa'],
  Fisioterapia: ['estetoscopio'], Estiramientos: ['estirar'], Zumba: ['musica'], Funcional: ['pesa-rusa'], Hockey: ['patines-hielo'], Triatlón: ['meta'],
  Core: ['cuerpo'], Powerlifting: ['barra'], Pierna: ['barra'], Fuerza: ['pesa'], Hipertrofia: ['pesa'], Cardio: ['pulso', 'corazon-pulso'],
  Caminata: ['caminar'], Senderismo: ['senderismo'], Golf: ['golf'], Padel: ['tenis'], Fútbol: ['futbol'], Karate: ['karate'], Judo: ['karate'],
  Meditación: ['yoga', 'vela'], Masaje: ['masaje'], Nutrición: ['manzana'], Consulta: ['estetoscopio'], Descanso: ['luna'], Sauna: ['calor'],
  Baile: ['musica'], Ballet: ['musica'], MTB: ['bici'], Waterpolo: ['polo-acuatico'], Surf: ['olas'], Remo: ['kayak'], Escalada: ['montana'],
  Portero: ['gol'], Rehabilitación: ['venda'], Recuperación: ['bateria-carga', 'cama'], Hombro: ['pesa', 'hueso'], Videollamada: ['camara'],
};
for (const [nombre, validos] of Object.entries(ESPERADOS)) {
  const id = sugiereIcono(cat, nombre);
  assert.ok(validos.includes(id), `«${nombre}» sugirió «${id}» y se esperaba ${validos.join(' o ')}`);
}
// Lo que no se parece a nada no inventa un dibujo.
for (const nombre of ['', '   ', 'zzzz', 'de la', 'xq']) assert.equal(sugiereIcono(cat, nombre), null, `«${nombre}» no debería sugerir nada`);
// El tropiezo de siempre: «de» es el principio de «Destellos».
assert.notEqual(sugiereIcono(cat, 'Terapia de hombro'), 'destellos');
assert.notEqual(sugiereIcono(cat, 'Terapia de hombro'), 'destello');
assert.equal(sugiereIcono(null, 'Boxeo'), null, 'sin catálogo todavía no hay qué sugerir');
// Mientras se escribe, ya sugiere: «Box» → boxeo.
assert.equal(sugiereIcono(cat, 'Box'), 'boxeo');

/* ---------- La rejilla: buscar y filtrar ---------- */
const ids = (lista) => lista.map((i) => i.id);
assert.equal(buscaIconos(cat).length, cat.iconos.length, 'sin búsqueda ni categoría salen todos');
assert.deepEqual(ids(buscaIconos(cat, '', 'agua')), cat.iconos.filter((i) => i.cat === 'agua').map((i) => i.id), 'una categoría sin búsqueda sale en el orden del catálogo');
assert.ok(buscaIconos(cat, '', 'agua').every((i) => i.cat === 'agua'));
assert.equal(ids(buscaIconos(cat, 'nadar'))[0], 'nadar', '«nadar» encuentra primero la natación');
assert.ok(ids(buscaIconos(cat, 'tenis mesa')).includes('pingpong'), 'varias palabras: deben estar todas');
assert.ok(!ids(buscaIconos(cat, 'tenis mesa')).includes('futbol'));
assert.ok(ids(buscaIconos(cat, 'nad')).includes('nadar'), 'a medias también encuentra');
assert.ok(ids(buscaIconos(cat, 'NATACIÓN')).includes('nadar'), 'sin importar acentos ni mayúsculas');
assert.deepEqual(buscaIconos(cat, 'qqqqzz'), []);
assert.ok(!ids(buscaIconos(cat, 'nadar', 'cardio')).includes('nadar'), 'la categoría recorta la búsqueda');
assert.deepEqual(buscaIconos(null, 'nadar'), []);

console.log(`prueba-iconos-de-tipo: todo bien (${cat.iconos.length} íconos, ${cat.categorias.length} categorías, ${Object.keys(ESPERADOS).length} nombres)`);
