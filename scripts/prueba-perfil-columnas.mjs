/* Pruebas del grupo 1 de la etapa 2 (lo puro): `node scripts/prueba-perfil-columnas.mjs`. Sin red ni base de datos.
   1. La lista de columnas de `profiles` que la app puede leer NO lleva el correo (p140).
   2. Ninguna consulta a `profiles` hecha con la sesión de la persona (la app y el conector de IA) pide `*` ni `email`.
   3. El escape de LIKE deja un usuario como texto exacto (p142). */
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { COLUMNAS_PERFIL } from '../src/lib/perfilColumnas.js';
import { escapaLike } from '../src/lib/escapaLike.js';

/* ---- La lista ---- */
const cols = COLUMNAS_PERFIL.split(',').map((c) => c.trim());
assert.ok(!cols.includes('email'), 'la lista no lleva email');
assert.equal(new Set(cols).size, cols.length, 'sin columnas repetidas');
for (const c of ['id', 'username', 'full_name', 'role', 'coach_id', 'is_owner', 'is_active', 'codigo_coach', 'alta_en']) assert.ok(cols.includes(c), `lleva ${c}`);

/* ---- Nadie pide `*` ni `email` a profiles con la sesión de la persona ---- */
const raiz = new URL('..', import.meta.url).pathname;
const archivos = [];
const recorre = (dir, ext) => {
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) { if (nombre !== 'node_modules') recorre(ruta, ext); } else if (ext.some((e) => nombre.endsWith(e))) archivos.push(ruta);
  }
};
recorre(join(raiz, 'src'), ['.js', '.jsx']);
// El conector de IA llama con el token de la persona (su carpeta `app/` son copias de src/lib; las funciones de edge con llave de servicio sí pueden leer todo).
recorre(join(raiz, 'supabase/functions/mcp'), ['.ts']);

const culpables = [];
for (const ruta of archivos) {
  if (ruta.endsWith('perfilColumnas.js')) continue;
  const texto = readFileSync(ruta, 'utf8');
  for (const m of texto.matchAll(/from\((['"])profiles\1\)([^;]*?);/gs)) {
    const cadena = m[2];
    if (/\.select\(\s*(['"`])\s*\*\s*\1/.test(cadena)) culpables.push(`${ruta}: select('*') sobre profiles`);
    for (const s of cadena.matchAll(/\.select\(\s*(['"`])([^'"`]*)\1/g)) if (/\bemail\b/.test(s[2])) culpables.push(`${ruta}: pide email a profiles`);
  }
  if (/profiles\(\s*\*\s*\)/.test(texto)) culpables.push(`${ruta}: profiles(*) dentro de otra consulta`);
  if (/CAMPOS_PERSONA\s*=\s*['"`][^'"`]*\bemail\b/.test(texto)) culpables.push(`${ruta}: CAMPOS_PERSONA pide email`);
}
assert.deepEqual(culpables, [], `consultas que fallarían sin el permiso de leer email:\n${culpables.join('\n')}`);

/* ---- El escape de LIKE ---- */
assert.equal(escapaLike('ana_perez'), 'ana\\_perez');
assert.equal(escapaLike('100%'), '100\\%');
assert.equal(escapaLike('a\\b'), 'a\\\\b');
assert.equal(escapaLike('ana.perez'), 'ana.perez', 'el punto no es comodín');
assert.equal(escapaLike(null), '');

console.log('prueba-perfil-columnas: OK');
