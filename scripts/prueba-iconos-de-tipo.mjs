/* El catálogo de íconos de los tipos de sesión y su búsqueda (`lib/iconosDeTipo*.js`).
   Se corre con:  node scripts/prueba-iconos-de-tipo.mjs

   Dos cosas: (1) que el catálogo esté sano —un id nunca se repite ni cambia de forma, porque se guarda en la base y en cada día del plan— y
   (2) que «Boxeo» encuentre el guante, «Spinning» la bici fija y «Terapia de hombro» NO encuentre «Destellos» (empieza con «de»).
   6 nov 2026 («Registrar: hoja clara»): además, (3) NINGÚN id que ya existía desapareció (están todos escritos abajo), (4) cada `icono` de las actividades y de los tipos
   de sesión de la app existe en el catálogo, y (5) los símbolos nuevos (Phosphor, Hugeicons, dibujados y HYROX) traen lo que necesita `IconoSvg`.
   6 nov 2026 («Registrar: los símbolos que faltaban en 8 actividades»): (6) ninguna de las 29 actividades repite símbolo con otra.
   6 nov 2026 («Repertorio del coach…»): (7) 29 ocultos que siguen dibujándose por su id pero no se ofrecen, cada uno con su reemplazo a la vista (que se
   quedó con sus palabras), y 104 símbolos nuevos que pintan algo. */
import assert from 'node:assert/strict';
import * as datos from '../src/lib/iconosDeTipo.datos.js';
import { readFileSync } from 'node:fs';
import { armaCatalogo, buscaIconos, ICONO_NEUTRO, normaliza, sugiereIcono } from '../src/lib/iconosDeTipo.js';
import { CATALOGO, GRUPOS_DE_ACTIVIDADES, ICONO_PROPIO } from '../src/lib/actividades.js';

const cat = armaCatalogo(datos);

/* ---------- El catálogo está sano ---------- */
assert.ok(cat.iconos.length >= 267, `hay pocos íconos (${cat.iconos.length})`);
assert.equal(new Set(cat.iconos.map((i) => i.id)).size, cat.iconos.length, 'hay ids repetidos');
for (const ic of cat.iconos) {
  assert.match(ic.id, /^[a-z0-9-]{1,40}$/, `id con forma rara: ${ic.id}`);
  assert.ok(ic.nombre.trim(), `${ic.id}: sin nombre`);
  assert.ok(ic.svg.includes('<'), `${ic.id}: sin dibujo`);
  assert.ok(!/<script|onload|onerror|javascript:/i.test(ic.svg), `${ic.id}: el dibujo trae algo que no es un trazo`);
  assert.ok(cat.categorias.some((c) => c.id === ic.cat), `${ic.id}: categoría que no existe (${ic.cat})`);
  assert.equal(ic.palabras, normaliza(ic.palabras), `${ic.id}: las palabras van sin acentos y en minúscula`);
  assert.match(ic.origen, /^(l|t|p|h|ms|ll|hi|tl):[a-z0-9-]+$/, `${ic.id}: origen raro (${ic.origen})`);
}
for (const c of cat.categorias) assert.ok(cat.iconos.some((i) => i.cat === c.id), `la categoría ${c.id} no tiene íconos`);
assert.ok(cat.porId.has(ICONO_NEUTRO), 'falta el ícono neutro');

// Los ids que ya viajan en planes y bases no se pueden perder jamás: si algún día se deja de ofrecer uno, se conserva en el catálogo.
// Son los 252 del 6 nov 2026 (antes de los símbolos nuevos), TODOS. Un id nuevo no se escribe aquí: este es el piso. Y nunca se reutiliza con otro dibujo.
const IDS_QUE_YA_EXISTEN = `
  pesa barra pesa-rusa biceps yunque martillo hacha cuerda escaleras gimnasia agarre repetir capas rayo perno llama cohete flecha-arriba
  correr sprint caminar pasos caminadora bici moto pulso corazon-pulso cronometro temporizador reloj-arena velocimetro ruta meta liebre
  tortuga viento salto-pared nadar alberca olas kayak velero ancla buceo gota gotas pez salvavidas barco concha montana nieve-montana
  senderismo esqui patines-hielo patines skate tienda pino arboles brujula mapa mochila sol amanecer atardecer copo nube hoja caballo
  binoculares futbol gol basquet voleibol beisbol americano tenis rugby criquet golf pingpong billar boliche pelota trofeo medalla equipo
  bandera corona dardos karate boxeo espadas espada escudo arco arco-flecha mira ajedrez mano calavera yoga estirar estirar-2 flor brote
  cerebro cerebro-circuito corazon sonrisa infinito pluma destellos persona accesible respirar ojo oido estetoscopio venda hueso mano-corazon
  masaje jeringa pastilla termometro cruz botiquin hospital microscopio adn silla-ruedas bebe expediente latido ambulancia luna luna-estrella
  cama sofa hielo banera regadera cafe bateria-carga zzz calor bateria-llena manzana ensalada zanahoria huevo carne pollo trigo leche
  cubiertos olla sopa cereza platano uvas citrico vaso-agua bebida bascula musica notas disco-musica guitarra tambor microfono audifonos
  fiesta paleta teatro claqueta camara pizarron grupo persona-ronda birrete libro escuela lista calendario mensaje megafono apreton estrella
  foco rompecabezas prueba regla grafica-barras grafica-linea calculadora porcentaje checklist medidor escaneo circulo cuadrado triangulo
  hexagono rombo figuras marcador etiqueta gema regalo llave perro gato ave huella orbita rotar mover expandir maximizar casco calzado jersey
  jugador balonmano escalera-agilidad huellas cuerpo hombre mujer planta plantula polo-acuatico botella suplementos cruz-medica paz vela
  objetivo pesca monociclo escalera-piscina tienda-arbol snowboard arcoiris telescopio luna-nube corazon-manos muletas destello
`.split(/\s+/).filter(Boolean);
assert.equal(IDS_QUE_YA_EXISTEN.length, 252, 'la lista de ids que ya existían quedó mal copiada');
assert.equal(new Set(IDS_QUE_YA_EXISTEN).size, 252);
for (const id of IDS_QUE_YA_EXISTEN) assert.ok(cat.porId.has(id), `se perdió el ícono «${id}»`);
// Los dos que chocaron con un id nuevo conservan SU dibujo de siempre (Lucide «hand», Tabler «footsteps»); los nuevos llevan otro id.
assert.equal(cat.porId.get('mano').origen, 'l:hand');
assert.equal(cat.porId.get('huellas').origen, 't:footsteps');

/* ---------- Los símbolos nuevos (6 nov 2026) ---------- */
const NUEVOS = ['tenis-correr', 'huellas-pies', 'bota', 'bicicleta', 'loto', 'guante', 'balon-futbol', 'balon-basquet', 'mano-palma', 'balon-americano', 'bici-fija', 'tabla-surf', 'pala-padel', 'cinturon-banderas', 'hyrox',
  // «los símbolos que faltaban en 8 actividades»
  'montana-picos', 'tapete', 'pickleball', 'canoa', 'eliptica', 'reformer',
  // «Repertorio del coach: menos muñequitos, sin repetidos y 104 símbolos nuevos»
  'anillas', 'mancuernas', 'press-banca', 'discos', 'dominadas', 'rack', 'espalda', 'abdomen', 'banda', 'tenis-movimiento', 'caminadora-2',
  'cajon-salto', 'monitor-cardiaco', 'bandera-cuadros', 'maquina-cardio', 'carretera', 'calcetas', 'pista', 'goggles', 'visor-snorkel',
  'balon-waterpolo', 'gorra-natacion', 'windsurf', 'cana-pescar', 'toallas', 'ola', 'esquis', 'patineta', 'tabla-snowboard', 'cordillera', 'camper',
  'fogata', 'palmera', 'lentes-sol', 'globo', 'senal-sendero', 'cono', 'silbato', 'cancha', 'raqueta-tenis', 'badminton', 'hockey', 'frisbee',
  'aro-basquet', 'cancha-basquet', 'casco-americano', 'bat', 'casco-beisbol', 'gorra', 'palo-golf', 'pelota-golf', 'hoyo-golf', 'carrito-golf',
  'hockey-hielo', 'pinos', 'bat-criquet', 'mesa-billar', 'cono-chico', 'primer-lugar', 'marcador-partido', 'estadio', 'pelota-playa', 'hyrox-2',
  'costal', 'pera-box', 'casco-espartano', 'esgrima', 'careta-esgrima', 'caballo-ajedrez', 'dardo', 'columna', 'rodillo', 'pelota-yoga', 'cerebro-2',
  'aro-pilates', 'pelota-chica', 'corazon-sano', 'tulipan', 'frasco-medicina', 'frasco-pastillas', 'revision-corazon', 'curitas', 'alarma', 'te',
  'arroz', 'sandia', 'pasta', 'verduras', 'tazon', 'caldo', 'tetera', 'helado', 'pastelito', 'cinta-metrica', 'bascula-piso', 'rendimiento', 'electro',
  'peso-corporal', 'agenda-coach', 'gafete', 'fuegos-artificiales', 'globos', 'banderin', 'escudo-estrella'];
for (const id of NUEVOS) assert.ok(cat.porId.has(id), `falta el símbolo nuevo «${id}»`);
assert.equal(cat.iconos.length, IDS_QUE_YA_EXISTEN.length + NUEVOS.length, 'hay íconos que no son ni de los viejos ni de los nuevos de esta prueba');
for (const ic of cat.iconos) {
  if (ic.relleno && ic.origen.startsWith('hi:')) {
    assert.equal(ic.caja, undefined, `${ic.id}: el relleno de Healthicons va en la caja de 24`);
  } else if (ic.relleno && ic.origen.startsWith('ms:')) {
    assert.equal(ic.caja, '0 0 24 24', `${ic.id}: el relleno de Material Symbols va en una caja de 24`);
    assert.ok(/^<path d="[^"]+"\/>$/.test(ic.svg), `${ic.id}: un relleno de Material es un solo path`);
  } else if (ic.relleno) {
    assert.equal(ic.caja, '0 0 256 256', `${ic.id}: los rellenos de Phosphor van en una caja de 256`);
    assert.ok(/^<path d="[^"]+"\/>$/.test(ic.svg), `${ic.id}: un relleno de Phosphor es un solo path`);
    assert.match(ic.origen, /^p:/);
  } else assert.equal(ic.caja, undefined, `${ic.id}: solo los rellenos llevan caja`);
}
for (const id of ['huellas-pies', 'bota', 'bicicleta', 'loto', 'guante', 'balon-futbol', 'balon-basquet', 'mano-palma', 'balon-americano']) assert.equal(cat.porId.get(id).relleno, true, `${id} es relleno`);
for (const id of ['tenis-correr', 'bici-fija', 'tabla-surf', 'pala-padel', 'cinturon-banderas', 'hyrox', 'montana-picos', 'tapete', 'canoa', 'eliptica', 'reformer']) assert.ok(!cat.porId.get(id).relleno, `${id} es de línea`);
// HYROX: nuestra letra convertida a contornos (no un <text>: no puede depender de que la fuente esté cargada) dentro de un rectángulo redondeado.
assert.ok(!/<text/i.test(cat.porId.get('hyrox').svg) && cat.porId.get('hyrox').svg.includes('<rect') && cat.porId.get('hyrox').svg.includes('fill="currentColor"'));

/* ---------- Cada ícono que nombra una actividad o un tipo de sesión existe ---------- */
for (const x of CATALOGO) assert.ok(cat.porId.has(x.icono), `la actividad «${x.nombre}» pide el ícono «${x.icono}» y no existe`);
assert.ok(cat.porId.has(ICONO_PROPIO), 'falta el ícono de las propias');
// Los de los tipos de sesión de la app viven en `lib/aspectoDelTipo.js` (que usa `@/` y no se puede cargar aquí): se leen del texto.
const aspecto = readFileSync(new URL('../src/lib/aspectoDelTipo.js', import.meta.url), 'utf8');
const delTipo = [...aspecto.matchAll(/iconoPropio\('([a-z0-9-]+)'/g)].map((m) => m[1]);
const paraStickers = [...aspecto.slice(aspecto.indexOf('const ICONO_DEL_CATALOGO')).matchAll(/\b[a-z]+: '([a-z0-9-]+)'/g)].map((m) => m[1]);
assert.ok(delTipo.length >= 4 && paraStickers.length >= 14, `no se encontraron los íconos de aspectoDelTipo (${delTipo.length}, ${paraStickers.length})`);
for (const id of [...delTipo, ...paraStickers]) assert.ok(cat.porId.has(id), `aspectoDelTipo pide el ícono «${id}» y no existe`);

/* ---------- Las actividades (6 nov 2026) ---------- */
assert.deepEqual(GRUPOS_DE_ACTIVIDADES.map((g) => g.grupo), ['A pie', 'Sobre ruedas', 'En el agua', 'Fuerza y gimnasio', 'Raqueta', 'Deportes', 'Mente y cuerpo', 'Combate']);
const deportes = GRUPOS_DE_ACTIVIDADES.find((g) => g.grupo === 'Deportes').actividades.map((x) => x.id);
assert.deepEqual(deportes.slice(0, 3), ['futbol', 'americano', 'flag'], 'Fútbol americano y Flag football van justo después de Fútbol');
for (const id of ['americano', 'flag']) {
  const a = CATALOGO.find((x) => x.id === id);
  assert.equal(a.gps, false); assert.equal(a.deporte, 'otro');
}
assert.equal(CATALOGO.find((x) => x.id === 'americano').icono, 'balon-americano');
assert.equal(CATALOGO.find((x) => x.id === 'flag').icono, 'cinturon-banderas');
assert.deepEqual(Object.fromEntries(CATALOGO.map((x) => [x.id, x.icono])), {
  correr: 'tenis-correr', caminar: 'huellas-pies', senderismo: 'montana-picos', trail: 'bota', bici: 'bicicleta', spinning: 'bici-fija', patines: 'patines', natacion: 'nadar', surf: 'tabla-surf',
  remo: 'canoa', kayak: 'kayak', fuerza: 'pesa', crossfit: 'pesa-rusa', hyrox: 'hyrox', hiit: 'rayo', eliptica: 'eliptica', padel: 'pala-padel', tenis: 'tenis', pickleball: 'pickleball',
  futbol: 'balon-futbol', americano: 'balon-americano', flag: 'cinturon-banderas', basquet: 'balon-basquet', voleibol: 'voleibol', yoga: 'tapete', pilates: 'reformer', movilidad: 'estirar',
  box: 'guante', jiujitsu: 'mano-palma',
}, 'el dibujo de cada actividad');
assert.equal(CATALOGO.find((x) => x.id === 'natacion').gps, true, 'Nadar lleva mapa');
// Ninguna de las 29 repite símbolo con otra (6 nov 2026: Senderismo ya no repite la bota de Trail, Remo ya no es el kayak…).
assert.equal(CATALOGO.length, 29, 'son 29 actividades');
for (const x of CATALOGO) assert.equal(CATALOGO.filter((y) => y.icono === x.icono).length, 1, `«${x.nombre}» repite el símbolo «${x.icono}»`);

/* ---------- Normalizar ---------- */
assert.equal(normaliza('Natación'), 'natacion');
assert.equal(normaliza('  PÁDEL '), 'padel');
assert.equal(normaliza(null), '');

/* ---------- Sugerir un ícono por el nombre ---------- */
// nombre → uno de estos (a veces dos dibujos le van igual de bien)
const ESPERADOS = {
  Boxeo: ['guante'], Spinning: ['bici-fija'], 'Tenis de mesa': ['pingpong'], Natación: ['goggles'], 'Yoga restaurativo': ['loto', 'tapete'], Kettlebell: ['pesa-rusa'],
  Fisioterapia: ['estetoscopio'], Estiramientos: ['tapete'], Zumba: ['musica'], Funcional: ['pesa-rusa'], Hockey: ['hockey', 'hockey-hielo', 'patines-hielo'], Triatlón: ['meta'],
  Core: ['cuerpo'], Powerlifting: ['barra'], Pierna: ['barra'], Fuerza: ['pesa'], Hipertrofia: ['pesa'], Cardio: ['pulso', 'corazon-pulso'],
  Caminata: ['huellas-pies'], Senderismo: ['bota', 'senal-sendero'], Golf: ['golf'], Padel: ['pala-padel'], Pádel: ['pala-padel'], Fútbol: ['balon-futbol'], Karate: ['guante'], Judo: ['guante'],
  Meditación: ['yoga', 'vela'], Masaje: ['masaje'], Nutrición: ['manzana'], Consulta: ['estetoscopio'], Descanso: ['luna'], Sauna: ['calor'],
  Baile: ['musica'], Ballet: ['musica'], MTB: ['bicicleta'], Waterpolo: ['balon-waterpolo'], Surf: ['tabla-surf'], Remo: ['kayak'], Escalada: ['montana'],
  Portero: ['gol'], Correr: ['tenis-correr'], Hyrox: ['hyrox'], Americano: ['balon-americano'], Flag: ['cinturon-banderas'], 'Flag football': ['cinturon-banderas'],
  'Fútbol americano': ['balon-americano'], Yoga: ['loto', 'tapete'], 'Boxeo thai': ['guante'], Rehabilitación: ['venda'], Recuperación: ['bateria-carga', 'cama'], Hombro: ['pesa', 'hueso'], Videollamada: ['camara'],
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
// Los de las 8 actividades (6 nov 2026).
for (const [nombre, id] of [['canoa', 'canoa'], ['elíptica', 'eliptica'], ['pickleball', 'pickleball'], ['tapete', 'tapete'], ['reformer', 'reformer']]) assert.equal(sugiereIcono(cat, nombre), id, `«${nombre}» sugiere «${id}»`);
// Mientras se escribe, ya sugiere: «Box» → boxeo.
assert.equal(sugiereIcono(cat, 'Box'), 'guante');

/* ---------- La rejilla: buscar y filtrar ---------- */
const ids = (lista) => lista.map((i) => i.id);
assert.equal(buscaIconos(cat).length, cat.visibles.length, 'sin búsqueda ni categoría salen todos los que se ven');
assert.deepEqual(ids(buscaIconos(cat, '', 'agua')), cat.visibles.filter((i) => i.cat === 'agua').map((i) => i.id), 'una categoría sin búsqueda sale en el orden del catálogo');
assert.ok(buscaIconos(cat, '', 'agua').every((i) => i.cat === 'agua'));
assert.equal(ids(buscaIconos(cat, 'nadar'))[0], 'goggles', '«nadar» encuentra primero la natación');
assert.ok(ids(buscaIconos(cat, 'tenis mesa')).includes('pingpong'), 'varias palabras: deben estar todas');
assert.ok(!ids(buscaIconos(cat, 'tenis mesa')).includes('futbol'));
assert.ok(ids(buscaIconos(cat, 'nad')).includes('goggles'), 'a medias también encuentra');
assert.ok(ids(buscaIconos(cat, 'NATACIÓN')).includes('goggles'), 'sin importar acentos ni mayúsculas');
assert.deepEqual(buscaIconos(cat, 'qqqqzz'), []);
assert.ok(!ids(buscaIconos(cat, 'nadar', 'cardio')).includes('goggles'), 'la categoría recorta la búsqueda');
assert.deepEqual(buscaIconos(null, 'nadar'), []);

/* ---------- Repertorio del coach (6 nov 2026): 29 ocultos y 104 nuevos ---------- */
// Quién reemplaza a quién (spec «Ocultar 29»). El de la derecha existe, se ve y se quedó con las palabras del de la izquierda.
const OCULTOS = [
  ['gimnasia', 'anillas'], ['sprint', 'tenis-movimiento'], ['caminadora', 'caminadora-2'], ['salto-pared', 'cajon-salto'], ['nadar', 'goggles'],
  ['buceo', 'visor-snorkel'], ['polo-acuatico', 'balon-waterpolo'], ['esqui', 'esquis'], ['skate', 'patineta'], ['snowboard', 'tabla-snowboard'],
  ['estirar', 'tapete'], ['persona', 'columna'], ['accesible', 'rodillo'], ['correr', 'tenis-correr'], ['caminar', 'huellas-pies'],
  ['pasos', 'huellas-pies'], ['huellas', 'huellas-pies'], ['bici', 'bicicleta'], ['calzado', 'tenis-correr'], ['senderismo', 'bota'],
  ['futbol', 'balon-futbol'], ['basquet', 'balon-basquet'], ['americano', 'balon-americano'], ['jugador', 'equipo'], ['balonmano', 'pelota'],
  ['karate', 'guante'], ['mano', 'mano-palma'], ['yoga', 'tapete'], ['estirar-2', 'tapete']
];
assert.equal(OCULTOS.length, 29);
assert.deepEqual(cat.iconos.filter((i) => i.oculto).map((i) => i.id).sort(), OCULTOS.map(([o]) => o).sort(), 'los ocultos son exactamente los 29');
for (const [oculto, destino] of OCULTOS) {
  assert.ok(cat.porId.get(oculto)?.oculto, `«${oculto}» está oculto y se sigue dibujando por su id`);
  assert.ok(cat.porId.has(destino), `el reemplazo de «${oculto}» («${destino}») existe`);
  assert.ok(!cat.porId.get(destino).oculto, `el reemplazo de «${oculto}» («${destino}») no está oculto`);
  for (const w of cat.porId.get(oculto).claves) assert.ok(cat.porId.get(destino).claves.includes(w), `«${destino}» se quedó con la palabra «${w}» de «${oculto}»`);
}
for (const destino of new Set(OCULTOS.map(([, d]) => d))) assert.equal(new Set(cat.porId.get(destino).claves).size, cat.porId.get(destino).claves.length, `«${destino}» no repite palabras`);
assert.equal(cat.iconos.length, 377, 'son 377 en total');
assert.equal(buscaIconos(cat, '').length, 348, '348 a la vista');
for (const c of cat.categorias) assert.ok(buscaIconos(cat, '', c.id).every((i) => !i.oculto), `la categoría ${c.id} no enseña ocultos`);
assert.ok(buscaIconos(cat, '').every((i) => !i.oculto), 'ninguno oculto en la rejilla');
assert.ok(cat.porId.has('nadar') && cat.porId.has('estirar'), 'nadar y estirar se siguen dibujando');
for (const nombre of [...Object.keys(ESPERADOS), ...OCULTOS.map(([o]) => cat.porId.get(o).nombre), ...cat.iconos.flatMap((i) => i.claves)]) {
  const id = sugiereIcono(cat, nombre);
  assert.ok(id === null || !cat.porId.get(id).oculto, `«${nombre}» sugirió «${id}», que está oculto`);
}
for (const [nombre, id] of [['natación', 'goggles'], ['correr', 'tenis-correr'], ['esquí', 'esquis'], ['gimnasia', 'anillas'], ['cono', 'cono'], ['atletismo', 'pista']]) {
  assert.equal(sugiereIcono(cat, nombre), id, `«${nombre}» sugiere «${id}»`);
}
assert.equal(cat.categorias.find((c) => c.id === 'pelota').nombre, 'Deportes', 'la categoría pelota se llama Deportes');
assert.equal(cat.porId.get('hyrox-2').svg, cat.porId.get('hyrox').svg, 'hyrox-2 es el mismo dibujo que hyrox');
// Cada dibujo nuevo pinta algo: trae al menos una figura con medidas (un path con trazo, un rect/círculo/elipse con tamaño).
const pinta = (svg) => /<path[^>]* d="[^"]*\d[^"]*"/.test(svg) || /<(rect|circle|ellipse)[^>]*(width|r|rx)="[\d.]+"/.test(svg);
for (const id of NUEVOS) assert.ok(pinta(cat.porId.get(id).svg), `«${id}» no pinta nada`);
for (const id of NUEVOS) assert.ok(!/stroke-width/.test(cat.porId.get(id).svg) || ['tenis-correr'].includes(id), `«${id}» trae su propio stroke-width`);

/* ---------- «Favoritos» en «Tipo nuevo» (6 nov 2026) ---------- */
assert.equal(datos.FAVORITOS.length, 24, 'son 24 favoritos');
for (const id of datos.FAVORITOS) {
  assert.ok(cat.porId.has(id), `el favorito «${id}» no está en el catálogo`);
  assert.ok(!cat.porId.get(id).oculto, `el favorito «${id}» está oculto`);
}
assert.deepEqual(ids(buscaIconos(cat, '', 'favoritos')), datos.FAVORITOS, 'el chip «Favoritos» enseña los 24 en su orden');
assert.ok(!cat.categorias.some((c) => c.id === 'favoritos') && !cat.iconos.some((i) => i.cat === 'favoritos'), '«favoritos» no es una categoría de las entradas');
const balones = ids(buscaIconos(cat, 'balon', 'favoritos'));
assert.ok(balones.length > 0 && balones.every((id) => datos.FAVORITOS.includes(id)), 'con texto, filtra dentro de los favoritos');
assert.ok(balones.includes('balon-futbol') && !balones.includes('balon-waterpolo'), 'con texto, solo los favoritos que tienen la palabra');
assert.deepEqual(armaCatalogo({ CATEGORIAS: datos.CATEGORIAS, ICONOS: datos.ICONOS }).favoritos, [], 'sin FAVORITOS, el chip sale vacío (no truena)');

console.log(`prueba-iconos-de-tipo: todo bien (${cat.iconos.length} íconos, ${cat.categorias.length} categorías, ${Object.keys(ESPERADOS).length} nombres)`);
