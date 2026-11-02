/* LA PARTE DEL IPHONE DEL «APPLE WATCH SIN EL IPHONE», EN EL MOTOR DEL IPHONE (1 nov 2026, encargo «inicio, sin conexión y reloj», parte 3; ver
   `docs/entreno-y-reloj.md`, sección 10).

   No hay Apple Watch ni iPhone aquí: WebKit con el perfil de un iPhone 13 y un plugin FALSO del reloj (`window.Capacitor`, igual que `EntrenoWatchPlugin.swift`:
   `pendientes`, `confirma`, `mandaPlan`, `estado` y sus avisos). La cola y la copia usan el `localStorage` del navegador (`window.__tlPruebaSinConexion`, solo
   con `npm run dev`) y Supabase no contesta (sin señal). Lo que recorre:
     1. Lo que el reloj mandó con la app cerrada (una carrera libre y una sesión del plan) pasa a la cola, una vez cada uno, y el plugin lo borra SOLO después.
     2. El reloj lo manda otra vez: no se duplica.
     3. Sus UUID quedan anotados (para no traerlos de Salud).
     4. «Llegó de tu Apple Watch» en «Tus entrenos», con la carrera todavía en la cola (sin señal).
     5. «Entreno en curso en tu reloj» cuando el reloj lo publica, y se quita cuando termina.
     6. El plan que se le manda al reloj: un texto JSON con la forma de `PlanDelReloj.swift`.
     7. Lo que llega con la app abierta (el aviso «resultado» del plugin) también pasa a la cola.

   Uso: node scripts/prueba-reloj-webkit.mjs   (levanta Vite en el puerto 5198 y lo apaga al final; pesado: no correr con otra prueba a la vez) */
import { webkit, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const PUERTO = 5198;
const BASE = `http://localhost:${PUERTO}`;
const CAPTURAS = process.env.CAPTURAS || '/tmp/prueba-reloj-webkit';
mkdirSync(CAPTURAS, { recursive: true });

let pasos = 0;
const paso = (t) => { pasos += 1; console.log(`  ✓ ${t}`); };

const USUARIO = '00000000-0000-4000-8000-0000000000a1';
const UUID_LIBRE = 'C0FFEE00-0000-4000-8000-000000000001';
const UUID_SESION = 'C0FFEE00-0000-4000-8000-000000000002';
const UUID_TARDE = 'C0FFEE00-0000-4000-8000-000000000003';
const inicio = Date.now() - 2 * 3600 * 1000;
const carrera = (id, desplazo = 0) => ({
  v: 1, id, hk: id, usuario: USUARIO, modo: 'libre', inicio: inicio + desplazo, fin: inicio + desplazo + 27 * 60000, duracion: 1601, kcal: 330, distancia: 5020,
  pulso: Array.from({ length: 30 }, (_, i) => [i * 50, 140 + (i % 10)]),
  ruta: Array.from({ length: 60 }, (_, i) => [i * 26, 19.43 + i * 0.0007, -99.13 + i * 0.0003, 2240, 6]),
  actividad: { id: 'correr', nombre: 'Correr', deporte: 'correr', gps: true },
  bateria: { inicio: 0.9, fin: 0.84, ubicacion: 'gps' },
});
const sesion = {
  v: 1, id: UUID_SESION, hk: UUID_SESION, usuario: USUARIO, modo: 'sesion', deporte: 'fuerza', inicio: inicio + 3600000, fin: inicio + 3600000 + 1800000, duracion: 1700,
  pulso: [[0, 100], [60, 120]], ruta: [],
  sesion: {
    almacen: 'wr:sessions', llave: 'f1-w1-d6', nombre: 'Fuerza · tren inferior', de: 'Carlos', otraVez: false,
    entreno: { v: 1, inicio: inicio + 3600000, fin: inicio + 5400000, hechos: { '0.1.0': { t: inicio + 3660000, n: 'Sentadilla' } }, saltados: {}, extra: {} },
    pasos: [{ c: '0.1.0', t: 'e', n: 'Sentadilla', i: 0, v: 1, vs: 1, s: 1, tm: { por: 'reps', cantidad: '8', unidad: 'reps', valor: 8 }, reps: '8', u: 'reps', rv: 8 }],
  },
};

/* El plugin falso: lo que haría `EntrenoWatchPlugin.swift`. `window.__falso` guarda lo que tiene en disco y lo que le pidieron. */
const PUENTE = ({ pendientes, estado }) => {
  const oyentes = {};
  let n = 0;
  window.__tlPruebaSinConexion = true;
  window.webkit = { messageHandlers: { bridge: { postMessage() {} } } };
  window.__falso = { pendientes, confirmados: [], planes: [], estado, llamadas: [] };
  window.__emite = (plugin, evento, datos) => (oyentes[`${plugin}:${evento}`] || []).forEach((f) => f(datos));
  const metodos = (nombres) => [...nombres.map((name) => ({ name, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }];
  window.Capacitor = {
    PluginHeaders: [
      { name: 'EntrenoWatch', methods: metodos(['estado', 'envia', 'termina', 'mandaPlan', 'pendientes', 'confirma', 'avisaSubido']) },
      { name: 'App', methods: metodos(['getState', 'getInfo']) },
    ],
    nativeCallback(plugin, metodo, opciones, callback) {
      if (metodo === 'addListener') (oyentes[`${plugin}:${opciones.eventName}`] ||= []).push(callback);
      return Promise.resolve(`cb${++n}`);
    },
    nativePromise(plugin, metodo, o = {}) {
      const f = window.__falso;
      f.llamadas.push(`${plugin}.${metodo}`);
      if (plugin !== 'EntrenoWatch') return Promise.resolve({ isActive: true });
      if (metodo === 'estado') return Promise.resolve({ emparejado: true, instalada: true, alcanzable: true, ...(f.estado ? { enCurso: f.estado } : null) });
      if (metodo === 'pendientes') return Promise.resolve({ resultados: f.pendientes.filter((p) => !f.confirmados.includes(p.id)) });
      if (metodo === 'confirma') { f.confirmados.push(o.id); return Promise.resolve(); }
      if (metodo === 'mandaPlan') { f.planes.push(o.plan); return Promise.resolve({ enviado: true }); }
      return Promise.resolve();
    },
  };
};

/* ---------------- Vite y WebKit ---------------- */
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PUERTO), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
const cierraVite = () => { try { vite.kill(); } catch { /* ya */ } };
await new Promise((listo, falla) => {
  vite.stdout.on('data', (d) => { if (String(d).includes('Local:')) listo(); });
  vite.stderr.on('data', (d) => { if (String(d).includes('already in use')) falla(new Error(`El puerto ${PUERTO} está ocupado`)); });
  vite.on('exit', (c) => falla(new Error(`Vite se cerró (${c})`)));
});
const navegador = await webkit.launch();
try {
  const contexto = await navegador.newContext({ ...devices['iPhone 13'] });
  // Sin señal: Supabase no contesta.
  await contexto.route(/supabase\.co/, (r) => r.abort('internetdisconnected'));
  const estadoEnCurso = JSON.stringify({ en: Date.now(), enCurso: { id: 'X', titulo: 'Fuerza · tren inferior', modo: 'sesion', sesion: 'wr:sessions|f1-w1-d6', desde: Date.now() - 600000 } });
  await contexto.addInitScript(PUENTE, {
    pendientes: [
      { id: UUID_LIBRE, resultado: JSON.stringify(carrera(UUID_LIBRE)) },
      { id: UUID_SESION, resultado: JSON.stringify(sesion) },
      { id: 'no-se-entiende', resultado: '{roto' },
    ],
    estado: estadoEnCurso,
  });
  const page = await contexto.newPage();
  const errores = [];
  page.on('pageerror', (e) => errores.push(String(e?.message ?? e)));
  await page.goto(`${BASE}/scripts/qa/reloj-sin-iphone.html`);
  await page.waitForFunction(() => window.__listo === true, null, { timeout: 60000 });

  // 1. Lo que llegó con la app cerrada, a la cola.
  await page.evaluate(async (u) => { await window.__reloj.usaCuenta(u); await window.__reloj.recibeLoDelReloj(); }, USUARIO);
  const tras1 = await page.evaluate((u) => ({
    confirmados: window.__falso.confirmados,
    cola: JSON.parse(window.localStorage.getItem(`tl-prueba:tl:cola:${u}`) ?? '{"cosas":[]}').cosas.map((c) => ({ id: c.id, tipo: c.tipo, usuario: c.usuario })),
  }), USUARIO);
  assert.deepEqual(tras1.cola.map((c) => c.id), [UUID_LIBRE, UUID_SESION], 'las dos, en el orden en que llegaron');
  assert.deepEqual(tras1.cola.map((c) => c.tipo), ['entreno-libre', 'reloj-sesion']);
  assert.ok(tras1.cola.every((c) => c.usuario === USUARIO));
  assert.deepEqual(tras1.confirmados, [UUID_LIBRE, UUID_SESION], 'el plugin borra solo lo que ya quedó en la cola; lo que no se entiende se queda');
  paso('lo que el reloj mandó con la app cerrada pasa a la cola (con su id y su cuenta) y solo entonces se borra del plugin');

  // 2. El reloj lo vuelve a mandar (antes de que se confirmara, p. ej. la app se cerró en medio): no se duplica.
  await page.evaluate(async () => { window.__falso.confirmados = []; await window.__reloj.recibeLoDelReloj(); });
  const tras2 = await page.evaluate((u) => JSON.parse(window.localStorage.getItem(`tl-prueba:tl:cola:${u}`)).cosas.map((c) => c.id), USUARIO);
  assert.deepEqual(tras2, [UUID_LIBRE, UUID_SESION]);
  paso('si llega dos veces, sigue una sola vez en la cola');

  // 3. Los UUID quedan anotados para saltarlos al traer de Salud.
  const llegados = await page.evaluate(async () => [...(await window.__reloj.llegadosDelReloj())]);
  assert.ok(llegados.includes(UUID_LIBRE) && llegados.includes(UUID_SESION));
  paso('sus UUID quedan anotados (al traer de Salud se saltan)');

  // 4 y 5. Las pantallas.
  await page.evaluate(async (u) => { window.__reloj.escucha(); await window.__reloj.revisaEnCursoDelReloj(); window.__reloj.pinta(u); }, USUARIO);
  await page.getByText('Llegó de tu Apple Watch').first().waitFor({ timeout: 10000 });
  const fila = await page.getByRole('button', { name: /Correr, llegó de tu Apple Watch/ }).count();
  assert.equal(fila, 1, 'la carrera, todavía en la cola (sin señal), sale en «Tus entrenos» con su marca');
  paso('«Llegó de tu Apple Watch» en «Tus entrenos», aunque todavía no sube (sin señal)');
  await page.getByText('Entreno en curso en tu reloj').waitFor({ timeout: 10000 });
  assert.ok(await page.getByText(/Fuerza · tren inferior · desde las/).isVisible());
  await page.screenshot({ path: `${CAPTURAS}/1-en-curso-y-llego.png` });
  paso('«Entreno en curso en tu reloj» cuando el reloj lo publica');
  await page.evaluate(() => window.__emite('EntrenoWatch', 'enCurso', { enCurso: JSON.stringify({ en: Date.now() }) }));
  await page.getByText('Entreno en curso en tu reloj').waitFor({ state: 'detached', timeout: 10000 });
  paso('…y se quita en cuanto el reloj dice que terminó');

  // 6. El plan al reloj.
  await page.evaluate(async (u) => { await window.__reloj.mandaPlanAlReloj(window.__reloj.planDePrueba(u), { forzar: true }); }, USUARIO);
  const planes = await page.evaluate(() => window.__falso.planes);
  assert.equal(planes.length, 1);
  const plan = JSON.parse(planes[0]);
  assert.equal(plan.v, 1);
  assert.equal(plan.usuario, USUARIO);
  assert.equal(plan.dias.length, 3);
  assert.equal(plan.dias[0].sesiones[0].pasos[0].c, '0.1.0');
  assert.equal(plan.dias[0].sesiones[0].pasos[0].kg, '60');
  // Sin cambios, no se vuelve a mandar.
  await page.evaluate(async (u) => { await window.__reloj.mandaPlanAlReloj(window.__reloj.planDePrueba(u)); }, USUARIO);
  assert.equal((await page.evaluate(() => window.__falso.planes)).length, 1);
  paso('el plan llega al plugin como texto JSON (la forma de `PlanDelReloj.swift`), y solo otra vez si algo cambió');

  // 7. Con la app abierta: el plugin avisa «resultado» y eso pasa a la cola.
  await page.evaluate((r) => {
    window.__falso.pendientes.push({ id: r.id, resultado: JSON.stringify(r) });
    window.__emite('EntrenoWatch', 'resultado', { id: r.id });
  }, carrera(UUID_TARDE, 4 * 3600000));
  await page.waitForFunction((u) => JSON.parse(window.localStorage.getItem(`tl-prueba:tl:cola:${u}`)).cosas.length === 3, USUARIO, { timeout: 10000 });
  paso('lo que llega con la app abierta (el aviso del plugin) también entra a la cola');
  await page.screenshot({ path: `${CAPTURAS}/2-tus-entrenos.png` });

  assert.deepEqual(errores, [], `sin errores en la página: ${errores.join(' | ')}`);
  paso('sin errores en la página');
  await contexto.close();
} finally {
  await navegador.close();
  cierraVite();
}
console.log(`\nprueba-reloj-webkit: ${pasos} pasos, todo bien. Capturas en ${CAPTURAS}`);
