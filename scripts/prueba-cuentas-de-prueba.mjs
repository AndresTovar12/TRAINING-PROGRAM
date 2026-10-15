/* Pruebas de las cuentas de prueba (lo puro): `node scripts/prueba-cuentas-de-prueba.mjs`. Sin red ni base de datos. */
import assert from 'node:assert/strict';
import { TIPOS_DE_PRUEBA, esDePrueba, tipoDeCuenta, siguienteUsuario, nombreDePrueba, generaContrasena } from '../src/lib/cuentasDePrueba.js';
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
