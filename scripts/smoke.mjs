/**
 * Prueba de humo: abre la app de verdad, entra con cada tipo de cuenta y
 * recorre las pantallas principales en teléfono y en computadora.
 *
 * Falla (exit 1) si encuentra cualquiera de estas tres cosas, que son
 * exactamente los errores que se nos han escapado antes:
 *   1. Un error en la consola del navegador (así llegó la pantalla en blanco).
 *   2. Una pantalla vacía o casi vacía.
 *   3. Contenido que se desborda a lo ancho (lo "encimado" del celular).
 *
 * Uso:  node scripts/smoke.mjs            → contra el servidor local
 *       BASE_URL=https://... node ...     → contra producción
 */
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import net from 'node:net';

/**
 * ¿Hay alguien escuchando en ese puerto?
 *
 * Se usa una conexion TCP pelada a proposito, sin fetch. El fetch de Node en
 * macOS revienta a veces con `setTypeOfService EINVAL`, y lo hace desde dentro
 * de la libreria, fuera del try/catch: tumba el proceso entero y la prueba
 * "falla" sin que la app tenga nada que ver. Ademas, para saber si el servidor
 * ya esta arriba no hace falta una peticion HTTP completa; basta con que el
 * puerto acepte la conexion.
 */
function conecta(port, host, timeout) {
  return new Promise((listo) => {
    const s = net.connect({ port, host });
    const cierra = (v) => { s.destroy(); listo(v); };
    s.setTimeout(timeout);
    s.once('connect', () => cierra(true));
    s.once('error', () => cierra(false));
    s.once('timeout', () => cierra(false));
  });
}

/**
 * Se prueban IPv4 e IPv6 porque en macOS "localhost" puede resolver a
 * cualquiera de las dos, y un servidor que escucha en ::1 se ve como
 * "apagado" si solo preguntas por 127.0.0.1.
 */
async function puertoAbierto(port, timeout = 1200) {
  if (await conecta(port, '127.0.0.1', timeout)) return true;
  return conecta(port, '::1', timeout);
}

/** Espera a que el puerto abra. Devuelve true si abrio a tiempo. */
async function esperaPuerto(port, intentos = 40) {
  for (let i = 0; i < intentos; i++) {
    if (await puertoAbierto(port)) return true;
    await new Promise((r) => setTimeout(r, 500));
  }
  return false;
}

/**
 * Consigue contra qué servidor probar, en este orden:
 *   1. BASE_URL si la pusiste (produccion, staging, lo que sea).
 *   2. El servidor de desarrollo, si ya lo tienes abierto en :5173.
 *   3. Si no hay nada, levanta `vite preview` sobre dist/ y lo apaga al final.
 * La opcion 3 es la que corre en `npm run check`: prueba exactamente
 * el mismo dist/ que se va a subir, no el codigo sin compilar.
 */
async function consigueServidor() {
  if (process.env.BASE_URL) return { base: process.env.BASE_URL, apaga: () => {} };
  if (await puertoAbierto(5173)) {
    return { base: 'http://localhost:5173', apaga: () => {} };
  }
  console.log('  (levantando vite preview sobre dist/…)');
  const hijo = spawn('npx', ['vite', 'preview', '--port', '4173', '--strictPort'], {
    stdio: 'ignore',
    detached: false,
  });
  const vivo = await esperaPuerto(4173);
  if (!vivo) {
    hijo.kill();
    console.error('✗ No se pudo levantar el servidor. ¿Corriste `npm run build` antes?');
    process.exit(1);
  }
  return { base: 'http://localhost:4173', apaga: () => hijo.kill() };
}

let BASE = 'http://localhost:5173';
const PASSWORD = process.env.SMOKE_PASSWORD || 'Adtr.123';

const ACCOUNTS = [
  { user: 'andrestovar_admin', rol: 'master', esAdmin: true },
  { user: 'coach_prueba', rol: 'coach', esAdmin: true, password: 'Coach.123' },
  { user: 'andrestovar', rol: 'atleta', esAdmin: false },
];

const PANTALLAS = {
  // texto del botón/pestaña a tocar → nombre legible del destino
  admin: [['Atletas', 'lista de atletas'], ['Ejercicios', 'repertorio'], ['Coaches', 'coaches']],
  atleta: [['Plan', 'plan'], ['Bienestar', 'bienestar'], ['1RM', '1RM'], ['Ciencia', 'ciencia'], ['Hoy', 'inicio']],
};

/**
 * No basta con probar "un telefono" y "una compu". La app decide su forma con
 * tres umbrales distintos (720, 880 y 1024 px), y entre uno y otro quedan
 * anchos donde se mezclan las dos formas. Ahi es donde se rompe, no en los
 * extremos. Estos tamaños son aparatos reales que caen justo en esas zonas.
 */
const TAMAÑOS = [
  { nombre: 'celular', width: 390, height: 844 },
  { nombre: 'celular acostado', width: 844, height: 390 },
  { nombre: 'tablet', width: 768, height: 1024 },
  { nombre: 'laptop chica', width: 1023, height: 700 },
  { nombre: 'compu', width: 1440, height: 900 },
];

// Errores de consola que no son culpa nuestra (red, extensiones, favicon…)
const RUIDO = [
  /favicon/i, /net::ERR_/i, /Failed to load resource/i,
  /Download the React DevTools/i, /\[vite\]/i,
];

const fallos = [];
const anota = (ctx, msg) => fallos.push(`${ctx}: ${msg}`);

/**
 * Espera a que la pantalla TENGA contenido, en vez de esperar N segundos.
 *
 * Un cronometro fijo compite contra la red: si la consulta tarda una decima
 * mas que el numero que elegimos, la prueba grita y el codigo esta bien. Eso
 * es peor que no probar, porque enseña a ignorar la alarma. Aqui esperamos
 * la condicion real y con margen; si de verdad nunca carga, la revision de
 * "pantalla vacia" lo reporta igual.
 */
async function esperaContenido(page, timeout = 15000) {
  await page
    .waitForFunction(() => {
      const t = (document.body.innerText || '').trim();
      return t.length >= 40 && !/Cargando/i.test(t);
    }, { timeout })
    .catch(() => { /* si no llega, revisaPantalla lo reporta */ });
}

/**
 * Comprueba que la app ELIGIO LA FORMA CORRECTA para ese ancho.
 *
 * Las otras revisiones solo dicen "no truena". Esta dice "no se confundio de
 * aparato", que es distinto: una tabla de 6 columnas en un telefono no lanza
 * ningun error, se ve mal y ya. Sin esta comprobacion, la app podria dejar de
 * distinguir compu de telefono y el loop seguiria en verde.
 *
 * La regla es el umbral real del codigo: 1024 px (`useIsDesktop`).
 */
async function revisaForma(page, ctx, ancho) {
  const esperadoCompu = ancho >= 1024;
  const visto = await page.evaluate(() => ({
    sidebar: !!document.querySelector('aside'),
    tabla: !!document.querySelector('table'),
  }));

  if (visto.sidebar !== esperadoCompu) {
    anota(ctx, esperadoCompu
      ? 'a lo ancho de compu pero SIN menú lateral (se cree teléfono)'
      : 'a lo ancho de teléfono pero CON menú lateral (se cree compu)');
  }
  if (visto.tabla !== esperadoCompu) {
    anota(ctx, esperadoCompu
      ? 'a lo ancho de compu pero la lista de atletas NO es tabla'
      : 'a lo ancho de teléfono pero la lista de atletas SÍ es tabla');
  }
}

async function revisaPantalla(page, ctx, errores) {
  // 1. errores de consola
  const nuevos = errores.splice(0);
  nuevos.filter((e) => !RUIDO.some((r) => r.test(e))).forEach((e) => anota(ctx, `error en consola → ${e}`));

  // 2. pantalla vacía
  const texto = (await page.locator('body').innerText().catch(() => '')).trim();
  if (texto.length < 40) anota(ctx, `pantalla vacía o casi vacía (${texto.length} caracteres)`);

  // 3. desborde horizontal
  const desborde = await page.evaluate(() => {
    const w = window.innerWidth;
    if (document.documentElement.scrollWidth <= w + 2) return null;
    const culpables = [...document.querySelectorAll('body *')]
      .filter((el) => {
        if (!el.offsetParent && el.tagName !== 'BODY') return false;
        const r = el.getBoundingClientRect();
        return r.width > 0 && r.height > 0 && r.right > w + 2;
      })
      .slice(0, 3)
      .map((el) => `${el.tagName.toLowerCase()} "${(el.textContent || '').trim().slice(0, 30)}"`);
    return { ancho: document.documentElement.scrollWidth, ventana: w, culpables };
  });
  if (desborde) {
    anota(ctx, `se desborda a lo ancho (${desborde.ancho}px en ventana de ${desborde.ventana}px) → ${desborde.culpables.join(' | ')}`);
  }
}

async function tocaPorTexto(page, texto) {
  const hecho = await page.evaluate((t) => {
    const btn = [...document.querySelectorAll('button')]
      .find((b) => b.offsetParent && b.textContent.trim().includes(t));
    if (btn) { btn.click(); return true; }
    const hoja = [...document.querySelectorAll('*')]
      .find((e) => e.children.length === 0 && e.textContent.trim() === t && e.offsetParent);
    if (!hoja) return false;
    let n = hoja;
    for (let i = 0; i < 5 && n; i++) { try { n.click(); } catch { /* noop */ } n = n.parentElement; }
    return true;
  }, texto);
  if (hecho) await esperaContenido(page, 10000);
  return hecho;
}

async function recorre(browser, cuenta, tamaño) {
  const ctxBase = `${cuenta.rol}/${tamaño.nombre}`;
  const context = await browser.newContext({ viewport: { width: tamaño.width, height: tamaño.height } });
  const page = await context.newPage();
  const errores = [];
  page.on('console', (m) => { if (m.type() === 'error') errores.push(m.text()); });
  page.on('pageerror', (e) => errores.push(`excepción: ${e.message}`));

  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 30000 });

    // entrar
    await page.fill('input[placeholder="tu_usuario"]', cuenta.user);
    await page.fill('input[type="password"]', cuenta.password || PASSWORD);
    await page.click('button[type="submit"]');
    const entro = await page
      .waitForSelector('input[placeholder="tu_usuario"]', { state: 'detached', timeout: 20000 })
      .then(() => true)
      .catch(() => false);
    if (!entro) {
      const msg = await page.locator('[role="alert"]').innerText().catch(() => 'sin mensaje');
      anota(ctxBase, `no pudo entrar → ${msg}`);
      return;
    }
    await esperaContenido(page);
    await revisaPantalla(page, `${ctxBase}/inicio`, errores);
    // Solo las cuentas de admin tienen menú lateral y tabla de atletas.
    if (cuenta.esAdmin) await revisaForma(page, `${ctxBase}/forma`, tamaño.width);

    for (const [boton, nombre] of PANTALLAS[cuenta.esAdmin ? 'admin' : 'atleta']) {
      const ok = await tocaPorTexto(page, boton);
      if (!ok) continue; // p. ej. "Coaches" no existe para un coach: no es fallo
      await revisaPantalla(page, `${ctxBase}/${nombre}`, errores);
    }
  } catch (e) {
    anota(ctxBase, `se cayó el recorrido → ${e.message}`);
  } finally {
    await context.close();
  }
}

const servidor = await consigueServidor();
BASE = servidor.base;
const browser = await chromium.launch();
console.log(`Prueba de humo contra ${BASE}\n`);
for (const cuenta of ACCOUNTS) {
  for (const tamaño of TAMAÑOS) {
    process.stdout.write(`  ${cuenta.rol} en ${tamaño.nombre}… `);
    const antes = fallos.length;
    await recorre(browser, cuenta, tamaño);
    console.log(fallos.length === antes ? 'ok' : `${fallos.length - antes} problema(s)`);
  }
}
await browser.close();
servidor.apaga();

if (fallos.length) {
  console.log(`\n✗ ${fallos.length} problema(s):\n`);
  fallos.forEach((f) => console.log(`  • ${f}`));
  process.exit(1);
}
console.log('\n✓ Todo bien: sin errores, sin pantallas vacías, sin desbordes.');
