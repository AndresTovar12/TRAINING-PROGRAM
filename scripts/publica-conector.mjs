/* Publica el código del conector de IA (función `mcp` de Supabase) en el sitio, en `public/conector/<versión>/`, para que Supabase lo baje de ahí.

   POR QUÉ. Antes la función `mcp` bajaba su código de `raw.githubusercontent.com/.../TRAINING-PROGRAM/<commit>/...`: eso exigía que el repositorio fuera PÚBLICO
   (10 oct 2026: Andrés quiere el repositorio privado por las contraseñas que estuvieron en su historial). Ahora el código se sirve desde el propio sitio
   (`https://training-program-kappa.vercel.app/conector/vNN/servidor.ts`), que sigue publicándose aunque el repositorio sea privado. Es solo el código del
   servidor MCP: no lleva claves (esas viven en las variables de entorno de la función).

   Cada versión va en su carpeta y NUNCA se reescribe: «vNN» es el equivalente del número de commit de antes (el que fija qué código corre). Se dejan las dos
   últimas para poder volver atrás.

   Uso:
     node scripts/publica-conector.mjs           copia a la versión siguiente (v21 si la última es v20) y enseña el archivo `index.ts` que hay que desplegar
     node scripts/publica-conector.mjs v25       copia a esa versión
     node scripts/publica-conector.mjs --revisar dice si la última versión publicada es igual a `supabase/functions/mcp` (como `compartir-con-mcp --revisar`)
   Después: subir a main (Vercel), comprobar que cada archivo da 200 y desplegar la función con el `index.ts` que se imprime. Ver supabase/functions/mcp/LEEME.md. */
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ORIGEN = join(RAIZ, 'supabase/functions/mcp');
const DESTINO = join(RAIZ, 'public/conector');
const SITIO = 'https://training-program-kappa.vercel.app';

// Lo que corre el servidor: los .ts (menos `index.ts`, que solo conecta a la red y vive en la función) y las copias de la app en `app/`.
function archivos() {
  const lista = readdirSync(ORIGEN).filter((f) => f.endsWith('.ts') && f !== 'index.ts');
  const app = readdirSync(join(ORIGEN, 'app')).filter((f) => f.endsWith('.js')).map((f) => `app/${f}`);
  return [...lista, ...app].sort();
}
const hash = (ruta) => createHash('sha256').update(readFileSync(ruta)).digest('hex');
const versiones = () => (existsSync(DESTINO) ? readdirSync(DESTINO).filter((d) => /^v\d+$/.test(d)).sort((a, b) => Number(a.slice(1)) - Number(b.slice(1))) : []);

const arg = process.argv[2];

if (arg === '--revisar') {
  const ultima = versiones().at(-1);
  if (!ultima) { console.error('✗ Todavía no hay ninguna versión en public/conector.'); process.exit(1); }
  const distintos = archivos().filter((f) => !existsSync(join(DESTINO, ultima, f)) || hash(join(ORIGEN, f)) !== hash(join(DESTINO, ultima, f)));
  if (distintos.length) {
    console.error(`✗ ${ultima} ya no es igual a supabase/functions/mcp: ${distintos.join(', ')}\n  Corre \`node scripts/publica-conector.mjs\` (crea la versión siguiente) y vuelve a desplegar la función \`mcp\`.`);
    process.exit(1);
  }
  console.log(`✓ El conector publicado (${ultima}) es igual a supabase/functions/mcp.`);
  process.exit(0);
}

const hechas = versiones();
const version = arg ?? `v${(hechas.length ? Number(hechas.at(-1).slice(1)) : 0) + 1}`;
if (!/^v\d+$/.test(version)) { console.error('La versión se escribe v20, v21…'); process.exit(1); }
if (existsSync(join(DESTINO, version))) { console.error(`✗ ${version} ya existe y no se reescribe (es lo que fija qué código corre). Usa la siguiente.`); process.exit(1); }

for (const f of archivos()) {
  mkdirSync(dirname(join(DESTINO, version, f)), { recursive: true });
  cpSync(join(ORIGEN, f), join(DESTINO, version, f));
}
// Se quedan las dos últimas versiones (la nueva y la anterior, por si hay que volver).
const todas = versiones();
todas.slice(0, Math.max(0, todas.length - 2)).forEach((v) => rmSync(join(DESTINO, v), { recursive: true, force: true }));

console.log(`✓ Copiados ${archivos().length} archivos a public/conector/${version}/\n`);
console.log('Siguientes pasos: commit + push a main, esperar el despliegue de Vercel, comprobar los archivos y desplegar la función `mcp` con este index.ts (verify_jwt: false):\n');
console.log(`import 'jsr:@supabase/functions-js/edge-runtime.d.ts'\n\n// El servidor MCP de Training Lab: su código se sirve desde el sitio, en una carpeta por versión que no se reescribe (public/conector/${version}).\n// verify_jwt va apagado a propósito: el servidor revisa el permiso él mismo, porque tiene que contestar 401 con la pista de dónde pedirlo y\n// dejar leer sus metadatos sin sesión.\nimport { manejar } from '${SITIO}/conector/${version}/servidor.ts'\n\nDeno.serve(manejar)`);
