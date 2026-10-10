/* Pruebas de las reglas de contraseña: `node scripts/prueba-contrasena.mjs`. */
import assert from 'node:assert/strict';
import { MIN_CONTRASENA, problemaDeContrasena } from '../src/lib/contrasena.js';

assert.equal(MIN_CONTRASENA, 8);
assert.equal(problemaDeContrasena('Corta7!'), 'Usa al menos 8 caracteres.', '7 caracteres no bastan');
assert.equal(problemaDeContrasena(''), 'Usa al menos 8 caracteres.');
assert.equal(problemaDeContrasena(undefined), 'Usa al menos 8 caracteres.');
assert.equal(problemaDeContrasena('Larga-pero-buena-2026'), null);
assert.equal(problemaDeContrasena('ocho.cha'), null, '8 justos con símbolo y letras sirven');
assert.equal(problemaDeContrasena('2026101020'), 'No puede ser solo números.');
assert.equal(problemaDeContrasena('aaaaaaaaaa'), 'No puede ser el mismo carácter repetido.');
assert.equal(problemaDeContrasena('Password1'), 'Esa contraseña es de las más usadas. Elige otra.', 'sin distinguir mayúsculas');
assert.equal(problemaDeContrasena('12345678'), 'No puede ser solo números.', 'las numéricas se atajan antes que la lista');
assert.equal(problemaDeContrasena('x'.repeat(73)), 'Usa un máximo de 72 caracteres.');
assert.equal(problemaDeContrasena('x'.repeat(72) + ''), 'No puede ser el mismo carácter repetido.');
assert.equal(problemaDeContrasena('Mi-andres-2026', { usuario: 'Andres' }), 'No uses tu nombre de usuario dentro de la contraseña.');
assert.equal(problemaDeContrasena('abcXYZ-9', { usuario: 'abc' }), null, 'un usuario de menos de 4 letras no cuenta (daría falsos avisos)');
assert.equal(problemaDeContrasena('yo@correo.com', { correo: 'Yo@Correo.com' }), 'No uses tu correo como contraseña.');
assert.equal(problemaDeContrasena('Vieja-clave-1', { actual: 'Vieja-clave-1' }), 'Elige una distinta a la actual.');
assert.equal(problemaDeContrasena('Nueva-clave-2', { actual: 'Vieja-clave-1' }), null);

console.log('prueba-contrasena: todo bien');
