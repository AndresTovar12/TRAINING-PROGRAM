/* EL IPHONE EN TU COMPUTADORA (23 oct 2026). `npm run iphone` abre una ventana con forma de iPhone que corre la app tal como la verá la app descargable,
   SIN publicar nada: lee tu código de esta carpeta y se actualiza sola cada vez que se guarda un cambio.

   Qué es: el motor de Safari (WebKit, el mismo que usa una app de iPhone por dentro) con las medidas, el toque y el navegador de un iPhone, y con
   `window.Capacitor` puesto como lo pone el envoltorio de la App Store: la app se cree «descargable» y prende lo que es solo de la app (`lib/funciones.js`).
   Qué NO es: un iPhone de verdad. No simula pantalla bloqueada, Apple Watch, Salud, vibración, el teclado de iOS ni la zona del notch (`env(safe-area-inset-*)` vale 0).
   Eso solo se ve en un iPhone de verdad, con TestFlight.

   Uso:   npm run iphone                (abre la ventana; la primera vez entras con tu cuenta y se queda guardada)
          npm run iphone -- --sin-gps   (sin ubicación)
          npm run iphone -- --pagina=/ruta
   Dentro de la terminal: escribe `c` + Enter para que la «persona» EMPIECE a correr (y otra vez `c` para que pare), `p` para que pare quieta. La ubicación avanza
   unos 4 m/s hacia el norte; sirve para probar los pasos con GPS (sprints, kilómetros) sin salir a la calle. */
import { spawn } from 'node:child_process';
import readline from 'node:readline';
import os from 'node:os';
import path from 'node:path';
import { webkit, devices } from 'playwright';

// 5173: el puerto que el servidor de la app (las funciones de Supabase, p. ej. «login») acepta desde la computadora. Con otro, «Entrar» falla.
const PUERTO = 5173;
const args = process.argv.slice(2);
const sinGps = args.includes('--sin-gps');
const pagina = (args.find((a) => a.startsWith('--pagina=')) ?? '--pagina=/').slice('--pagina='.length);
const sinVentana = args.includes('--sin-ventana'); // solo para pruebas automáticas
const duracionDePrueba = Number((args.find((a) => a.startsWith('--prueba=')) ?? '').slice(9)) || 0;

// Vite directo con node (no con `npx`): así `servidor.kill()` sí lo cierra y no deja el puerto ocupado.
const servidor = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PUERTO), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'], cwd: process.cwd() });
const listo = new Promise((resolve, reject) => {
  const alVer = (d) => { if (String(d).includes('Local:')) resolve(); };
  servidor.stdout.on('data', alVer);
  servidor.stderr.on('data', (d) => { if (String(d).includes('already in use')) reject(new Error(`El puerto ${PUERTO} ya está ocupado: cierra el otro «npm run iphone» o «npm run dev».`)); });
  servidor.on('exit', (c) => reject(new Error(`El servidor se cerró (${c}).`)));
});
const cierraTodo = () => { try { servidor.kill(); } catch { /* ya cerrado */ } };
process.on('exit', cierraTodo);
process.on('SIGINT', () => { cierraTodo(); process.exit(0); });

await listo;
const telefono = devices['iPhone 15'] ?? devices['iPhone 14'];
const contexto = await webkit.launchPersistentContext(path.join(os.homedir(), '.training-lab-iphone'), {
  ...telefono,
  headless: sinVentana,
  permissions: sinGps ? [] : ['geolocation'],
  geolocation: sinGps ? undefined : { latitude: 19.4326, longitude: -99.1332, accuracy: 5 },
  locale: 'es-MX',
  timezoneId: 'America/Mexico_City',
});
// Como lo pone el envoltorio de la App Store, antes de que cargue la página.
await contexto.addInitScript(() => {
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'ios', platform: 'ios', isPluginAvailable: () => false };
});
const ventana = contexto.pages()[0] ?? await contexto.newPage();
await ventana.goto(`http://localhost:${PUERTO}${pagina}`);

// La «persona» que corre: la ubicación avanza hacia el norte mientras esté prendida.
let lat = 19.4326;
let corriendo = false;
const MS = 2000; const METROS_POR_TIC = 8; // 4 m/s
setInterval(async () => {
  if (!corriendo || sinGps) return;
  lat += METROS_POR_TIC / 111320;
  await contexto.setGeolocation({ latitude: lat, longitude: -99.1332, accuracy: 5 }).catch(() => {});
}, MS);
console.log('\n📱 iPhone listo. Escribe  c  (Enter) para correr / parar,  q  para cerrar.\n');
readline.createInterface({ input: process.stdin }).on('line', (t) => {
  const x = t.trim().toLowerCase();
  if (x === 'c') { corriendo = !corriendo; console.log(corriendo ? '🏃 corriendo…' : '🧍 quieto'); }
  if (x === 'p') { corriendo = false; console.log('🧍 quieto'); }
  if (x === 'q') { contexto.close().then(() => process.exit(0)); }
});
contexto.on('close', () => process.exit(0));
if (duracionDePrueba) {
  await ventana.waitForTimeout(duracionDePrueba * 1000);
  console.log('capacitor:', await ventana.evaluate(() => window.Capacitor?.isNativePlatform?.()), '| UA:', await ventana.evaluate(() => navigator.userAgent.slice(0, 60)), '| ancho:', await ventana.evaluate(() => innerWidth), '| toque:', await ventana.evaluate(() => 'ontouchstart' in window));
  await ventana.screenshot({ path: '/tmp/iphone-prueba.png' });
  await contexto.close();
}
