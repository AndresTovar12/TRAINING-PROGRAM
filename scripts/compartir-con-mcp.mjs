/**
 * Copia a la función `mcp` las piezas de la app que tiene que usar tal cual.
 *
 * POR QUÉ. La IA tiene que contestar "¿qué me toca hoy?" igual que el teléfono
 * del atleta. Si el servidor llevara su propia versión de esa cuenta, un día
 * las dos darían respuestas distintas: ya pasó dentro de la app, cuando el
 * atleta y el coach calculaban "dónde va" cada uno por su lado.
 *
 * Así que no se reescribe nada: se copia el archivo exacto. Y como una copia
 * se puede quedar vieja, `--revisar` falla si alguna ya no es idéntica.
 * Corre dentro de `npm run check`.
 *
 * Un solo cambio, siempre el mismo: `training-utils.js` pide tres íconos de
 * `lucide-react` para el saludo de la pantalla del atleta, y en el servidor no
 * hay React. En la copia, esa línea apunta a `lucide-vacio.js`. Todo lo demás
 * es byte por byte el original.
 *
 *   node scripts/compartir-con-mcp.mjs            copia
 *   node scripts/compartir-con-mcp.mjs --revisar  solo compara
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ARCHIVOS = ['training-utils.js', 'medidas.js', 'theme.js', 'unidades.js', 'plural.js', 'palabras.js', 'formatos.js', 'porVuelta.js', 'lapsos.js', 'muscles.js', 'ciencia.js', 'clases.js', 'misPlanesDatos.js', 'vitrinaDatos.js', 'paraQuien.js', 'oficios.js'];
const destino = join(raiz, 'supabase/functions/mcp/app');
const soloRevisar = process.argv.includes('--revisar');

const paraElServidor = (texto) => texto.replace("from 'lucide-react';", "from './lucide-vacio.js';");

let malos = 0;
for (const nombre of ARCHIVOS) {
  const original = paraElServidor(readFileSync(join(raiz, 'src/lib', nombre), 'utf8'));
  const copia = join(destino, nombre);
  const igual = existsSync(copia) && readFileSync(copia, 'utf8') === original;
  if (igual) continue;
  if (soloRevisar) {
    console.error(`✗ supabase/functions/mcp/app/${nombre} ya no es igual a src/lib/${nombre}`);
    malos += 1;
  } else {
    writeFileSync(copia, original);
    console.log(`copiado ${nombre}`);
  }
}

/* La ventana de un plan comprado (`lib/ventana.js`) la usa también la Edge Function `programa-comprado`, que es la que recorta el plan ANTES de mandarlo. Copia exacta:
   si la app y el servidor recortaran distinto, el atleta vería menos (o más) de lo que el coach decidió. */
{
  const original = readFileSync(join(raiz, 'src/lib/ventana.js'), 'utf8');
  const copia = join(raiz, 'supabase/functions/programa-comprado/ventana.js');
  const igual = existsSync(copia) && readFileSync(copia, 'utf8') === original;
  if (!igual) {
    if (soloRevisar) {
      console.error('✗ supabase/functions/programa-comprado/ventana.js ya no es igual a src/lib/ventana.js');
      malos += 1;
    } else {
      writeFileSync(copia, original);
      console.log('copiado ventana.js (programa-comprado)');
    }
  }
}

/* Las ayudas de Stripe (`stripe.js`) viven en las tres funciones que hablan con Stripe, idénticas: `comprar` es la original y `stripe-webhook` y `reembolsar` llevan copia. */
{
  const original = readFileSync(join(raiz, 'supabase/functions/comprar/stripe.js'), 'utf8');
  for (const funcion of ['stripe-webhook', 'reembolsar']) {
    const copia = join(raiz, `supabase/functions/${funcion}/stripe.js`);
    const igual = existsSync(copia) && readFileSync(copia, 'utf8') === original;
    if (igual) continue;
    if (soloRevisar) {
      console.error(`✗ supabase/functions/${funcion}/stripe.js ya no es igual a supabase/functions/comprar/stripe.js`);
      malos += 1;
    } else {
      writeFileSync(copia, original);
      console.log(`copiado stripe.js (${funcion})`);
    }
  }
}

if (malos) {
  console.error('\nCorre `node scripts/compartir-con-mcp.mjs` y vuelve a desplegar las funciones que cambiaron.');
  process.exit(1);
}
if (soloRevisar) console.log('✓ Las funciones mcp, programa-comprado y las de Stripe usan las mismas piezas que la app.');
