/* Pruebas de las cuentas de prueba (lo puro): `node scripts/prueba-cuentas-de-prueba.mjs`. Sin red ni base de datos. */
import assert from 'node:assert/strict';
import { TIPOS_DE_PRUEBA, esDePrueba, tipoDeCuenta, siguienteUsuario, nombreDePrueba, generaContrasena, usuarioEscrito, problemaDeContrasenaDePrueba } from '../src/lib/cuentasDePrueba.js';
import { problemaDeContrasena } from '../src/lib/contrasena.js';

/* ---- Qué es una cuenta de prueba ---- */
assert.deepEqual(TIPOS_DE_PRUEBA.map((t) => t.id), ['atleta', 'coach', 'fisio']);
for (const u of ['zz_qa_fisio', 'ZZ_prueba_atleta_1', 'zz_x']) assert.equal(esDePrueba(u), true, `${u} es de prueba`);
for (const u of ['andres', 'zzz', 'azz_x', 'zz', '', null, undefined]) assert.equal(esDePrueba(u), false, `«${u}» no es de prueba`);

/* ---- El tipo de una cuenta ---- */
assert.equal(tipoDeCuenta({ role: 'user' }), 'atleta');
assert.equal(tipoDeCuenta({ role: 'admin', profesion: 'Entrenador personal' }), 'coach');
assert.equal(tipoDeCuenta({ role: 'admin', profesion: 'Fisioterapeuta deportivo' }), 'fisio');
assert.equal(tipoDeCuenta({ role: 'admin' }), 'coach');
assert.equal(tipoDeCuenta(null), 'atleta');

/* ---- El usuario que sigue: uno más que el más alto de ese tipo ---- */
assert.equal(siguienteUsuario('atleta', []), 'zz_prueba_atleta_1');
assert.equal(siguienteUsuario('atleta', ['zz_prueba_atleta_1', 'zz_prueba_atleta_2']), 'zz_prueba_atleta_3');
assert.equal(siguienteUsuario('atleta', ['zz_prueba_atleta_5']), 'zz_prueba_atleta_6', 'si borró el 1 al 4, sigue el más alto + 1 (nunca repite uno que existe)');
assert.equal(siguienteUsuario('coach', ['zz_prueba_atleta_9', 'zz_qa_fisio', 'andres']), 'zz_prueba_coach_1', 'cada tipo lleva su propia cuenta');
assert.equal(siguienteUsuario('fisio', ['ZZ_PRUEBA_FISIO_2']), 'zz_prueba_fisio_3', 'sin importar mayúsculas');
assert.equal(siguienteUsuario('atleta', null), 'zz_prueba_atleta_1');

/* ---- El nombre ---- */
assert.equal(nombreDePrueba('zz_prueba_atleta_3'), 'Prueba Atleta 3');
assert.equal(nombreDePrueba('zz_prueba_fisio_12'), 'Prueba Fisio 12');
assert.equal(nombreDePrueba('zz_qa_fisio'), 'zz_qa_fisio', 'uno que no es de los de aquí queda con su usuario');
assert.equal(nombreDePrueba('zz_pac'), 'Prueba pac', 'uno que escogió él');
assert.equal(nombreDePrueba('zz_mi_atleta'), 'Prueba mi atleta');

/* ---- El usuario que escribe el dueño ---- */
assert.deepEqual(usuarioEscrito('pac'), { usuario: 'zz_pac' }, 'el zz_ se pone solo');
assert.deepEqual(usuarioEscrito('  zz_pac '), { usuario: 'zz_pac' }, 'si lo escribe, no se duplica');
assert.deepEqual(usuarioEscrito('ZZ_Pac2'), { usuario: 'zz_Pac2' });
assert.deepEqual(usuarioEscrito('a.b_c'), { usuario: 'zz_a.b_c' });
assert.match(usuarioEscrito('').error, /Escribe un usuario/);
assert.match(usuarioEscrito('zz_').error, /Escribe un usuario/);
assert.match(usuarioEscrito('mi usuario').error, /sin espacios/, 'con espacio no');
assert.match(usuarioEscrito('ñandú').error, /sin espacios/, 'sin acentos ni eñes (la regla de signup)');
assert.equal(usuarioEscrito('a'.repeat(28)).error?.includes('3 a 30'), true, 'zz_ + 28 pasa de 30');
assert.deepEqual(usuarioEscrito('a'.repeat(27)), { usuario: `zz_${'a'.repeat(27)}` });
assert.match(usuarioEscrito('pac', ['ZZ_PAC']).error, /ya existe/, 'repetido, sin importar mayúsculas');
assert.deepEqual(usuarioEscrito('pac', ['zz_otro', 'andres']), { usuario: 'zz_pac' });

/* ---- La contraseña que escribe el dueño: solo lo del servidor ---- */
assert.equal(problemaDeContrasenaDePrueba('prueba123'), null);
assert.equal(problemaDeContrasenaDePrueba('12345678'), null, 'una de juguete sirve: son cuentas de prueba');
assert.match(problemaDeContrasenaDePrueba('corta'), /al menos 8/);
assert.match(problemaDeContrasenaDePrueba('x'.repeat(73)), /máximo de 72/);

/* ---- La contraseña ---- */
const vistas = new Set();
for (let i = 0; i < 300; i += 1) {
  const c = generaContrasena();
  assert.match(c, /^[A-HJ-NP-Za-km-z]{4}-[2-9]{4}[A-HJ-NP-Za-km-z]{2}$/, `forma legible: ${c}`);
  assert.equal(problemaDeContrasena(c), null, `pasa las reglas de la app: ${c}`);
  vistas.add(c);
}
assert.ok(vistas.size > 295, 'salen distintas cada vez');
assert.equal(generaContrasena((n) => new Uint32Array(n)), 'AAAA-2222AA', 'con ceros siempre sale lo mismo (para probar)');
assert.equal(generaContrasena((n) => new Uint32Array(n).fill(1)), 'BBBB-3333BB', 'con unos, lo siguiente de cada lista');
assert.equal(generaContrasena().length, 11, '11 caracteres');

console.log('✓ cuentas de prueba: todo bien');
