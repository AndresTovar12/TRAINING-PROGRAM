/* Pruebas de lo que cruza en memoria al nacer la cuenta (`features/inicio/cuentaNueva.js`): `node scripts/prueba-cuenta-nueva.mjs`. Sin red. */
import assert from 'node:assert/strict';
import {
  anotaEnvio, contrasenaNueva, correoPorConfirmarDe, envioDelCodigo, marcaCorreoConfirmado, olvidaCuentaNueva, oyeEnvio, recuerdaContrasena,
} from '../src/features/inicio/cuentaNueva.js';
import { correoSinConfirmar } from '../src/lib/correos.js';

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

// EL CÓDIGO LO EXIGE EL SERVIDOR (31 oct 2026): sin memoria de la pestaña, la cuenta nueva sigue con su correo por confirmar.
const nueva = { id: 'u1', email: 'prueba1@sin-correo.traininglabapp.com', user_metadata: { correo_pendiente: ' Ad.Tr12@Hotmail.com ' } };
assert.equal(correoSinConfirmar(nueva), 'ad.tr12@hotmail.com', 'cuenta nueva con el correo inventado: el pendiente sale del servidor');
assert.equal(correoPorConfirmarDe(nueva), 'ad.tr12@hotmail.com');
// Ya confirmó: el correo de la cuenta es de verdad (aunque la metadata siga ahí) → nada pendiente.
assert.equal(correoSinConfirmar({ ...nueva, email: 'ad.tr12@hotmail.com' }), '');
// Cuentas viejas: sin `correo_pendiente`, o con correo real, o sin nada → no se les pide nada (siguen como estaban).
assert.equal(correoSinConfirmar({ id: 'v1', email: 'viejo@sin-correo.traininglabapp.com', user_metadata: {} }), '');
assert.equal(correoSinConfirmar({ id: 'v2', email: 'a@b.com' }), '');
assert.equal(correoSinConfirmar(null), '');
assert.equal(correoSinConfirmar(undefined), '');
// El dominio de antes también cuenta como inventado.
assert.equal(correoSinConfirmar({ email: 'x@traininglab.app', user_metadata: { correo_pendiente: 'a@b.com' } }), 'a@b.com');

// LA PUERTA SE ABRE al confirmar aquí, aunque la sesión tarde en traer el correo nuevo, pero solo para ESA cuenta.
marcaCorreoConfirmado('u1');
assert.equal(correoPorConfirmarDe(nueva), '', 'quien acaba de confirmar no se queda atrapado');
assert.equal(correoPorConfirmarDe({ ...nueva, id: 'u2' }), 'ad.tr12@hotmail.com', 'otra cuenta en la misma pestaña no hereda el permiso');
