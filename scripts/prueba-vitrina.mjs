/* Pruebas de la vitrina (lo puro): `node scripts/prueba-vitrina.mjs`. Sin red ni base de datos. */
import assert from 'node:assert/strict';
import { PRECIO_MINIMO, PRECIO_MINIMO_SUELTO, CONTENIDOS, esBiblioteca, esSuelto, precioMinimoDe, tipoDeCobroDe, textoDeContenido, VENTANAS, VENTANA_MAXIMA, slugDe, slugUnico, ligaPublica } from '../src/lib/vitrinaDatos.js';
import { EDADES, SEXOS, EQUIPOS, NIVELES, marcadosValidos, textoDeEdades, chipsDeParaQuien } from '../src/lib/paraQuien.js';

/* ---- Las listas traen lo que dijo Andrés ---- */
assert.deepEqual(EDADES.map((e) => e.id), ['15-18', '18-30', '30-45', '45+']);
assert.deepEqual(SEXOS.map((s) => s.id), ['todos', 'mujeres', 'hombres']);
assert.ok(EQUIPOS.some((e) => e.id === 'gym') && EQUIPOS.some((e) => e.id === 'sin_equipo'));
assert.deepEqual(NIVELES.map((n) => n.id), ['todos', 'principiante', 'intermedio', 'avanzado']);

/* ---- Marcados válidos: sin repetidos, sin ids viejos, en el orden de la lista ---- */
assert.deepEqual(marcadosValidos(EDADES, ['30-45', '15-18', '30-45', 'raro']), ['15-18', '30-45']);
assert.deepEqual(marcadosValidos(EDADES, null), []);

/* ---- Edades en palabras ---- */
assert.equal(textoDeEdades([]), '', 'ninguna marcada = todas las edades: no se dice nada');
assert.equal(textoDeEdades(['18-30']), '18 a 30 años');
assert.equal(textoDeEdades(['15-18', '30-45']), '15 a 18 y 30 a 45 años');
assert.equal(textoDeEdades(['18-30', '30-45', '45+']), '18 a 30, 30 a 45 y 45 en adelante', 'si termina en «en adelante» no se le pega «años»');
assert.equal(textoDeEdades(['45+']), '45 en adelante');

/* ---- Los chips de «para quién» ---- */
assert.deepEqual(chipsDeParaQuien({}), []);
assert.deepEqual(
  chipsDeParaQuien({ deportes: ['pilates'], edades: ['30-45'], sexo: 'mujeres', equipo: ['reformer', 'casa'] }),
  ['Pilates', '30 a 45 años', 'Mujeres', 'Mancuernas y ligas en casa', 'Reformer o máquinas de pilates'],
  'el equipo sale en el orden de la lista',
);
assert.deepEqual(chipsDeParaQuien({ sexo: 'todos', deportes: ['running'] }), ['Running'], '«todos» no es un dato que valga la pena enseñar');

/* ---- La ventana: un mes como mucho, y por defecto el mes completo ---- */
assert.equal(VENTANA_MAXIMA, 4);
assert.deepEqual(VENTANAS.map((v) => v.valor), [1, 2, 3, 4], 'se puede bajar, no subir');
assert.ok(VENTANAS.every((v) => v.valor !== null && v.valor <= VENTANA_MAXIMA), 'ya no hay «todo el plan»');
assert.equal(VENTANAS.at(-1).nombre, '1 mes');
assert.equal(PRECIO_MINIMO, 500);

/* ---- Qué se vende (12 oct): programas, rutinas, workouts y clases ---- */
assert.deepEqual(CONTENIDOS, ['programa', 'rutina', 'workout', 'clase', 'biblioteca']);
assert.equal(esSuelto('clase') && esSuelto('workout'), true);
assert.equal(esSuelto('programa') || esSuelto('rutina') || esSuelto(undefined), false);
assert.equal(precioMinimoDe('programa'), 500);
assert.equal(precioMinimoDe('rutina'), 500);
assert.equal(precioMinimoDe('workout'), PRECIO_MINIMO_SUELTO);
assert.equal(precioMinimoDe('clase'), 100);
assert.equal(tipoDeCobroDe('clase', 'membresia'), 'pago_unico', 'una clase suelta no se cobra por mes');
assert.equal(tipoDeCobroDe('workout', 'membresia'), 'pago_unico');
assert.equal(tipoDeCobroDe('rutina', 'membresia'), 'membresia');
assert.equal(tipoDeCobroDe('rutina', 'pago_unico'), 'pago_unico');
assert.equal(tipoDeCobroDe('programa', undefined), 'membresia');
assert.equal(textoDeContenido({ contenido: 'clase', duracion_clase: 2700 }), 'Clase · 45 min');
assert.equal(textoDeContenido({ contenido: 'clase' }), 'Clase', 'una clase con liga no trae duración');
assert.equal(textoDeContenido({ contenido: 'workout' }), 'Workout');
assert.equal(esBiblioteca('biblioteca') && !esBiblioteca('clase') && !esBiblioteca(undefined), true);
assert.equal(esSuelto('biblioteca'), false, 'una biblioteca no es «suelta»: es una membresía');
assert.equal(precioMinimoDe('biblioteca'), 100);
assert.equal(tipoDeCobroDe('biblioteca', 'pago_unico'), 'membresia', 'la biblioteca siempre es mensual');
assert.equal(textoDeContenido({ contenido: 'biblioteca', n_clases: 24 }), 'Biblioteca · 24 clases');
assert.equal(textoDeContenido({ contenido: 'biblioteca', n_clases: 1 }), 'Biblioteca · 1 clase');
assert.equal(textoDeContenido({ contenido: 'biblioteca' }), 'Biblioteca de clases');
assert.equal(textoDeContenido({ contenido: 'rutina', semanas: 1 }), 'Rutina semanal');
assert.equal(textoDeContenido({ contenido: 'programa', semanas: 12 }), '12 semanas');
assert.equal(textoDeContenido({ semanas: 1 }), '1 semana', 'sin contenido es un programa (los planes de antes)');
assert.equal(textoDeContenido({ contenido: 'programa' }), '');

/* ---- La liga se arma sola con el nombre del plan ---- */
assert.equal(slugDe('Fuerza y potencia 12 sem.'), 'fuerza-y-potencia-12-sem');
assert.equal(slugDe('Pretemporada · Receptores ¡Élite!'), 'pretemporada-receptores-elite');
assert.equal(slugUnico('Fuerza y potencia', []), 'fuerza-y-potencia');
assert.equal(slugUnico('Fuerza y potencia', ['fuerza-y-potencia']), 'fuerza-y-potencia-2', 'si ya hay una con ese nombre, lleva número');
assert.equal(slugUnico('Fuerza y potencia', ['fuerza-y-potencia', 'fuerza-y-potencia-2']), 'fuerza-y-potencia-3');
assert.equal(slugUnico('¡¡¡', []), 'plan', 'un nombre sin letras no deja la liga vacía');
assert.ok(slugUnico('x'.repeat(100), []).length <= 60);
assert.equal(ligaPublica('laura', 'fuerza', 'https://app.com'), 'https://app.com/@laura/fuerza');

console.log('✓ vitrina: todo bien');
