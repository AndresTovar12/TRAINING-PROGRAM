/* EL CANDADO DE LA TARJETA «HOY TE TOCA» (24 oct 2026).
   Andrés, con la captura de su iPhone donde «Velocidad» salía «Velocida / d»: «no importa qué tan largo sea el nombre del workout y no importa cuántos workouts haya.
   Nunca puede salir mal el nombre. Nunca puede salir mal esa card.»

   Qué hace: levanta Vite, dibuja las tarjetas REALES de Home (`HoyTeToca`, `HoyTeTocaEquipo`, `HoyDescansas`, `HoyEnPausa` y los cuadros de `Cuadros.jsx`) en el WebKit de
   Playwright con perfil de iPhone (Safari: Chromium da falsos verdes en bugs de Safari) y las MIDE en el DOM, con una matriz de
   nombres (cortos, de 40, 80 y 120 caracteres, una palabra gigante, con paréntesis, emojis, mayúsculas y ñ) × cantidad de workouts (1, 2, 3, 6) × anchos de pantalla
   (320, 360, 375, 390, 430 y ≈246 px, que es un 320 con el texto del sistema al 130 %). Falla (exit 1) si encuentra:
     · una palabra partida a media letra aunque cupiera en su columna con la letra mínima;
     · cualquier cosa que se salga de la tarjeta o de la pantalla;
     · el nombre con menos del 60 % del ancho de la tarjeta;
     · un botón fuera de la tarjeta, muy chico o encimado al nombre;
     · un renglón con una sola letra (un «)» solo), o que empiece con «·», o el punto de color solo.
   También prueba que «+N más» despliega y que cada botón sigue abriendo SU sesión.

   Uso:   npm run prueba:tarjeta-hoy
          npm run prueba:tarjeta-hoy -- --capturas=/ruta/carpeta [--prefijo=despues]   (además guarda capturas del caso original y del peor)
          npm run prueba:tarjeta-hoy -- --solo-capturas --capturas=/ruta                (sin medir: solo las capturas, p. ej. para comparar antes/después)
   No entra a `npm run check` (tarda más de un minuto: levanta un servidor y un navegador). Sin cuenta ni red a Supabase; las letras Inter vienen de Google Fonts
   (sin red se usa la del sistema y la medición sigue valiendo). */
import { createServer } from 'vite';
import { webkit, devices } from 'playwright';
import { mkdirSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const PUERTO = 5199;
const args = process.argv.slice(2);
const valor = (k) => (args.find((a) => a.startsWith(`--${k}=`)) ?? '').slice(k.length + 3);
const carpetaCapturas = valor('capturas');
const prefijo = valor('prefijo') || 'despues';
const soloCapturas = args.includes('--solo-capturas');

const PAGINA = `<!doctype html><html lang="es"><head><meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" />
</head><body><div id="app"></div><script type="module" src="/scripts/prueba-tarjeta-hoy-pagina.jsx"></script></body></html>`;

const servidor = await createServer({
  root: RAIZ, logLevel: 'error', clearScreen: false,
  server: { port: PUERTO, strictPort: true, host: '127.0.0.1', hmr: false, watch: null },
  plugins: [{
    name: 'pagina-de-la-prueba-de-la-tarjeta',
    configureServer(s) {
      s.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/qa-tarjeta-hoy')) return next();
        res.setHeader('Content-Type', 'text/html');
        res.end(await s.transformIndexHtml('/qa-tarjeta-hoy.html', PAGINA));
      });
    },
  }],
});
await servidor.listen();

const navegador = await webkit.launch();
const contexto = await navegador.newContext({ ...devices['iPhone 13'], deviceScaleFactor: 2, locale: 'es-MX' });
const pagina = await contexto.newPage();
const erroresDePagina = [];
pagina.on('pageerror', (e) => erroresDePagina.push(String(e)));
pagina.on('console', (m) => { if (m.type() === 'error' && !/fonts\.g|Failed to load resource|net::/.test(m.text())) erroresDePagina.push(m.text()); });

let terminado = false;
async function cierra(codigo) {
  if (terminado) return;
  terminado = true;
  await navegador.close().catch(() => {});
  await servidor.close().catch(() => {});
  process.exit(codigo);
}
process.on('SIGINT', () => cierra(130));

try {
  await pagina.goto(`http://127.0.0.1:${PUERTO}/qa-tarjeta-hoy`, { waitUntil: 'load' });
  await pagina.waitForFunction(() => typeof window.montar === 'function' && typeof window.mide === 'function', null, { timeout: 120000 });
} catch (e) {
  console.error('✗ La página de la prueba no cargó:', e.message, erroresDePagina.slice(0, 3));
  await cierra(1);
}

const NOMBRES = {
  corto: 'Gym',
  velocidad: 'Velocidad',
  variacion: 'Upper Strength (variación)',
  de40: 'Fuerza máxima y potencia del tren inferior',
  de80: 'Programa de hipertrofia para atletas avanzados con énfasis en espalda y hombros altos',
  de120: 'Bloque de fuerza máxima con progresión lineal, trabajo de velocidad, movilidad de cadera y hombros, y core antirrotación (variación B)',
  palabra25: 'Electroencefalografistas',
  gigante: 'Supercalifragilisticoespialidosoextraordinario',
  parentesis: '(Variación) Sprint (30 m) (técnica avanzada)',
  emojis: '🏋️ Piernas 💪 Día de fuerza 🔥',
  mayusculas: 'FUERZA MÁXIMA – TREN INFERIOR (VARIACIÓN)',
  enie: 'Año nuevo, niño pequeño: pañales y señales',
  guiones: 'Hipertrofia-Avanzada-Mixta-Superior',
};
const VARIANTES = [
  { tipo: 'programa', nombre: 'programa (un botón)' },
  { tipo: 'cada', nombre: 'programa (un botón por sesión)' },
  { tipo: 'equipo', nombre: 'equipo' },
  { tipo: 'descanso', nombre: 'descanso' },
  { tipo: 'pausa', nombre: 'pausa' },
  { tipo: 'cuadros', nombre: 'cuadros' },
];
const CUANTAS = [1, 2, 3, 6];
const ANCHOS = [320, 360, 375, 390, 430, 246];

/** Algunas combinaciones no tienen sentido (un descanso no tiene «6 workouts»): solo se prueba con 1. Los cuadros van de dos en dos: a ≈246 px quedarían de 50 px y no es una pantalla real. */
const aplica = (v, n, ancho = 320) => (v.tipo === 'cuadros' ? n === 1 && ancho >= 300 : ['descanso', 'pausa'].includes(v.tipo) ? n === 1 : v.tipo === 'cada' ? n > 1 : true);

const fallas = [];
let casos = 0;
async function prueba(v, etiqueta) {
  await pagina.setViewportSize({ width: v.ancho, height: 900 });
  await pagina.evaluate((x) => window.montar(x), v);
  const lista = Array.isArray(v.nombres) ? v.nombres : [v.nombres];
  const problemas = await pagina.evaluate((o) => window.mide(o), {
    raizId: 'home',
    // Los textos que deben verse (la pausa dice «Nombre: en pausa»); el nombre se busca por su texto, no por su clase.
    esperados: v.tipo === 'pausa' ? [`${lista[0]}: en pausa`] : lista.slice(0, v.tipo === 'cuadros' ? 3 : Number(v.cuantas)),
    // En el 320 con letra grande (≈246 px) el nombre es lo que cabe; ahí solo se exige lo demás.
    minNombre: v.ancho < 300 || v.tipo === 'cuadros' ? 0 : 0.6,
  });
  casos += 1;
  for (const p of problemas) fallas.push(`${etiqueta} @${v.ancho}: ${p}`);
}

async function captura(v, nombre) {
  mkdirSync(carpetaCapturas, { recursive: true });
  await pagina.setViewportSize({ width: v.ancho, height: 900 });
  await pagina.evaluate((x) => window.montar(x), v);
  const archivo = path.join(carpetaCapturas, `${prefijo}-${nombre}.png`);
  await pagina.locator('#home').screenshot({ path: archivo });
  console.log(`captura: ${archivo}`);
}

if (!soloCapturas) {
  for (const variante of VARIANTES) {
    for (const n of CUANTAS) {
      if (!aplica(variante, n)) continue;
      for (const [clave, nombre] of Object.entries(NOMBRES)) {
        for (const ancho of ANCHOS) {
          if (!aplica(variante, n, ancho)) continue;
          await prueba({ tipo: variante.tipo, cuantas: n, ancho, nombres: nombre }, `${variante.nombre} · ${n} · ${clave}`);
        }
      }
    }
  }
  // Mezclados (lo real: cada sesión con su nombre) y el caso de la captura de Andrés.
  const mezcla = [NOMBRES.velocidad, NOMBRES.variacion, NOMBRES.de80, NOMBRES.gigante, NOMBRES.emojis, NOMBRES.de120];
  for (const variante of VARIANTES) {
    for (const n of [2, 3, 6]) {
      if (!aplica(variante, n)) continue;
      for (const ancho of ANCHOS.filter((a) => aplica(variante, n, a))) await prueba({ tipo: variante.tipo, cuantas: n, ancho, nombres: mezcla }, `${variante.nombre} · ${n} mezclados`);
    }
  }
  for (const ancho of ANCHOS) await prueba({ tipo: 'cada', cuantas: 2, ancho, nombres: [NOMBRES.velocidad, NOMBRES.variacion] }, 'la captura de Andrés');
  // Sin el nombre del profesional en el equipo y con «El miércoles 23 te tocan tres» arriba.
  for (const ancho of ANCHOS) {
    await prueba({ tipo: 'equipo', cuantas: 3, ancho, nombres: NOMBRES.variacion, conAutor: false }, 'equipo sin autor');
    await prueba({ tipo: 'cada', cuantas: 3, ancho, nombres: NOMBRES.variacion, cuando: { hoy: false, fecha: new Date(2026, 9, 28) } }, 'otro día');
  }

  try {
    // «+N más» despliega y cada botón abre SU sesión.
    await pagina.setViewportSize({ width: 390, height: 900 });
    await pagina.evaluate((x) => window.montar(x), { tipo: 'cada', cuantas: 6, ancho: 390, nombres: NOMBRES.variacion });
    const cuentaBotones = () => pagina.locator('#home article button').count();
    if ((await cuentaBotones()) !== 4) fallas.push(`con 6 sesiones deben verse 3 botones de sesión y «+3 más» (hay ${await cuentaBotones()} botones)`);
    await pagina.getByRole('button', { name: /\+3 más/ }).click({ timeout: 4000 });
    if ((await cuentaBotones()) !== 7) fallas.push(`al desplegar deben verse 6 botones de sesión y «Ver menos» (hay ${await cuentaBotones()} botones)`);
    await pagina.evaluate(() => { window.__clics.length = 0; });
    const botonesDeSesion = pagina.locator('#home article button[title]');
    for (let i = 0; i < 6; i++) await botonesDeSesion.nth(i).click({ timeout: 4000 });
    const clics = await pagina.evaluate(() => window.__clics);
    if (JSON.stringify(clics) !== '[0,1,2,3,4,5]') fallas.push(`cada botón debe abrir su sesión (se abrieron ${JSON.stringify(clics)})`);
    const problemasAbierta = await pagina.evaluate((o) => window.mide(o), { raizId: 'home', altoMaximo: 2200, esperados: [NOMBRES.variacion] });
    for (const p of problemasAbierta) fallas.push(`desplegada: ${p}`);
    await pagina.getByRole('button', { name: /Ver menos/ }).click({ timeout: 4000 });
    if ((await cuentaBotones()) !== 4) fallas.push('«Ver menos» debe volver a 3 sesiones');
  } catch (e) {
    fallas.push(`«+N más» o los botones de sesión no respondieron: ${String(e.message).split('\n')[0]}`);
  }
  if (erroresDePagina.length) fallas.push(`errores en la consola de la página: ${erroresDePagina.slice(0, 3).join(' | ')}`);
}

if (carpetaCapturas) {
  const original = { tipo: 'cada', cuantas: 2, nombres: [NOMBRES.velocidad, NOMBRES.variacion] };
  const peor = { tipo: 'cada', cuantas: 6, nombres: [NOMBRES.de120, NOMBRES.gigante, NOMBRES.emojis, NOMBRES.de80, NOMBRES.parentesis, NOMBRES.variacion] };
  await captura({ ...original, ancho: 390 }, 'original-390');
  await captura({ ...original, ancho: 320 }, 'original-320');
  await captura({ ...peor, ancho: 390 }, 'peor-390');
  await captura({ ...peor, ancho: 320 }, 'peor-320');
  await captura({ ...peor, tipo: 'equipo', ancho: 390 }, 'peor-equipo-390');
  await captura({ ...peor, tipo: 'equipo', ancho: 320 }, 'peor-equipo-320');
  await captura({ tipo: 'cuadros', cuantas: 1, nombres: [NOMBRES.de40, NOMBRES.de80, 'Recuperado'], ancho: 320 }, 'cuadros-320');
  await captura({ tipo: 'cuadros', cuantas: 1, nombres: [NOMBRES.de40, NOMBRES.de80, 'Recuperado'], ancho: 390 }, 'cuadros-390');
}

if (soloCapturas) await cierra(0);
if (fallas.length) {
  const unicas = [...new Set(fallas)];
  console.error(`✗ La tarjeta «Hoy te toca» falló con ${unicas.length} problema(s) en ${casos} combinaciones:`);
  for (const f of unicas.slice(0, 40)) console.error(`  · ${f}`);
  if (unicas.length > 40) console.error(`  … y ${unicas.length - 40} más`);
  await cierra(1);
}
console.log(`prueba-tarjeta-hoy: todo bien (${casos} combinaciones medidas en WebKit con perfil de iPhone)`);
await cierra(0);
