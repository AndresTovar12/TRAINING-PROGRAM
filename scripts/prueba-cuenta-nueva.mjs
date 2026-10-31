/* Pruebas de lo que cruza en memoria al nacer la cuenta (`features/inicio/cuentaNueva.js`): `node scripts/prueba-cuenta-nueva.mjs`. Sin red. */
import assert from 'node:assert/strict';
import {
  anotaEnvio, contrasenaNueva, envioDelCodigo, olvidaCuentaNueva, oyeEnvio, recuerdaContrasena,
} from '../src/features/inicio/cuentaNueva.js';

const espera = () => new Promise((r) => { setTimeout(r, 0); });

// Sin nada anotado: no hay envío (la pantalla lo da por mandado) ni contraseña.
assert.equal(envioDelCodigo(), null);
assert.equal(contrasenaNueva(), '');

// La contraseña vive en memoria y se olvida.
recuerdaContrasena('entrena2026');
assert.equal(contrasenaNueva(), 'entrena2026');

// Un envío que sale: «mandando» y luego «mandado», y quien oye se entera de los dos.
const vistos = [];
const deja = oyeEnvio((v) => vistos.push(v?.estado ?? null));
let sale;
anotaEnvio(new Promise((res) => { sale = res; }));
assert.equal(envioDelCodigo().estado, 'mandando');
sale({ ok: true });
await espera();
assert.equal(envioDelCodigo().estado, 'mandado');
assert.deepEqual(vistos, ['mandando', 'mandado']);

// Uno que falla trae el error del servidor (antes se mandaba a ciegas y la pantalla decía «Te mandamos el código»).
anotaEnvio(Promise.reject(new Error('Ese correo ya lo usa otra cuenta.')));
await espera();
assert.deepEqual(envioDelCodigo(), { estado: 'fallo', error: 'Ese correo ya lo usa otra cuenta.' });

// Un envío viejo que termina tarde no pisa al nuevo («Cambiar correo» mientras el primero seguía en camino).
let viejo;
anotaEnvio(new Promise((res) => { viejo = res; }));
anotaEnvio(Promise.reject(new Error('Escribe tu correo completo.')));
viejo({ ok: true });
await espera();
assert.equal(envioDelCodigo().estado, 'fallo', 'el viejo no pisa al nuevo');

// Al confirmar se olvida todo, y quien oye se entera.
olvidaCuentaNueva();
assert.equal(envioDelCodigo(), null);
assert.equal(contrasenaNueva(), '');
assert.equal(vistos.at(-1), null);
deja();
anotaEnvio(Promise.resolve());
await espera();
assert.equal(vistos.at(-1), null, 'quien dejó de oír ya no se entera');

console.log('✓ cuenta nueva: todo bien');
