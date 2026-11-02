/* EL ARRANQUE DE LA APP DE IPHONE, EN EL MOTOR DEL IPHONE (2 nov 2026). El build 74 se quedaba en «Cargando tu perfil…» para siempre después de entrar.

   Corre la app de verdad (Vite en modo desarrollo) en WebKit con el perfil de un iPhone 13 y un puente nativo FALSO puesto como lo pone la app de la App Store
   (`window.webkit.messageHandlers.bridge` y `window.Capacitor` con sus `PluginHeaders`): `@capacitor/core` se cree en iPhone y Capacitor Preferences pasa por
   ese puente, igual que en el teléfono. SIN `__tlPruebaSinConexion`: la copia y la cola usan Preferences, no el `localStorage`. La «base» es un Supabase
   FALSO dentro de esta prueba (no toca la base real ni necesita contraseñas) y la sesión ya viene guardada, como después de entrar.

   Lo que recorre:
     1. Preferences contesta (como en el iPhone): entra sin esperar ningún tope, lee la copia del perfil en el teléfono y la deja escrita.
     2. Preferences no contesta nunca: a los 3 s se sigue sin copia y entra igual.
     3. Ni Preferences ni el servidor contestan: a los 15 s «Cargando tu perfil…» ofrece «Reintentar» y «Salir», y «Salir» saca de la cuenta.

   Uso: node scripts/prueba-arranque-iphone.mjs   (levanta Vite en el puerto 5197 y lo apaga al final; pesado: no correr con otra prueba a la vez) */
import { webkit, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const PUERTO = 5197;
const BASE = `http://localhost:${PUERTO}`;
const CAPTURAS = process.env.CAPTURAS || '/tmp/prueba-arranque-iphone';
mkdirSync(CAPTURAS, { recursive: true });
const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const SUPABASE = env.VITE_SUPABASE_URL;
const LLAVE_SESION = `sb-${new URL(SUPABASE).hostname.split('.')[0]}-auth-token`;

let pasos = 0;
const paso = (t) => { pasos += 1; console.log(`  ✓ ${t}`); };
const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });

/* ---------------- El Supabase falso ---------------- */
const ANA = '00000000-0000-4000-8000-0000000000a1';
const COACH = '00000000-0000-4000-8000-0000000000c3';
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const PLAN = {
  id: `plan-${ANA}`, user_id: ANA, profesional_id: null, status: 'active', title: 'Rutina de prueba', created_at: '2026-10-01T00:00:00Z', created_by: COACH,
  data: { kind: 'weekly', estructura: 'rutina', phases: [{ id: 'f1', name: 'Rutina', weekData: [{ num: 1, days: DIAS.map((day) => ({ day, name: 'Fuerza del arranque', cat: 'gym', exercises: [{ name: 'Sentadilla', sets: '3', reps: '5' }] })) }] }] },
};
const PERFIL = {
  id: ANA, username: 'ana', full_name: 'Ana', role: 'user', coach_id: COACH, is_active: true, perfil_completo: true, inicio_paso: null,
  unidad_peso: 'kg', genero: 'm', is_owner: false, avatar_url: null, created_at: '2026-10-01T00:00:00Z',
};
const USUARIO = { id: ANA, aud: 'authenticated', role: 'authenticated', email: 'ana@sin-correo.traininglabapp.com', app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' };
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const sesion = () => {
  const exp = Math.floor(Date.now() / 1000) + 3600;
  return { access_token: `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: ANA, role: 'authenticated', aud: 'authenticated', exp })}.firma`, token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: `refresco-${ANA}`, user: USUARIO };
};

const CORS = { 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range, content-profile, x-supabase-api-version' };
const responde = (route, status, cuerpo, extra = {}) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json', ...extra }, body: cuerpo === undefined ? '' : JSON.stringify(cuerpo) });
const quiereUno = (req) => (req.headers().accept ?? '').includes('vnd.pgrst.object');

/** `perfilCuelga`: la petición del perfil nunca contesta (sin respuesta, no «sin señal»: así se ve el tope de 15 s y no los 3 reintentos). */
function servidor({ perfilCuelga = false } = {}) {
  const s = { pedidosDelPerfil: [] };
  s.atiende = async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
    const ruta = url.pathname;
    if (ruta === '/auth/v1/token') return responde(route, 200, sesion());
    if (ruta === '/auth/v1/logout') return responde(route, 204);
    if (ruta === '/auth/v1/user') return responde(route, 200, USUARIO);
    if (ruta === '/rest/v1/profiles' && (url.searchParams.get('id') ?? '') === `eq.${ANA}`) {
      s.pedidosDelPerfil.push(Date.now());
      if (perfilCuelga) return undefined; // nunca contesta
      return responde(route, 200, quiereUno(req) ? PERFIL : [PERFIL]);
    }
    if (ruta === '/rest/v1/plans') return responde(route, 200, url.searchParams.get('status') === 'eq.active' ? [PLAN] : []);
    if (ruta === '/rest/v1/user_app_state') return responde(route, 200, quiereUno(req) ? { data: {} } : [{ data: {} }]);
    if (ruta === '/rest/v1/rpc/master_id') return responde(route, 200, COACH);
    if (ruta.startsWith('/rest/v1/')) {
      if (req.method() === 'HEAD') return responde(route, 200, undefined, { 'content-range': '*/0' });
      return responde(route, 200, quiereUno(req) ? null : []);
    }
    if (ruta.startsWith('/functions/v1/')) return responde(route, 200, {});
    return responde(route, 404, {});
  };
  return s;
}

/* ---------------- El puente nativo falso ---------------- */
/* Lo que pone el envoltorio de iOS: la plataforma (`messageHandlers.bridge`), los plugins con sus métodos (los de cada `*Plugin.swift`) y `nativePromise`.
   `preferencias`: 'contesta' (UserDefaults en memoria) o 'cuelga' (ninguna llamada a Preferences contesta nunca). `window.__nativo` anota cada llamada. */
const PUENTE = ({ preferencias, llave, s }) => {
  window.localStorage.setItem(llave, JSON.stringify(s));
  window.webkit = { messageHandlers: { bridge: { postMessage() {} } } };
  const metodos = (nombres) => [...nombres.map((name) => ({ name, rtype: 'promise' })), { name: 'addListener', rtype: 'callback' }, { name: 'removeListener', rtype: 'promise' }, { name: 'removeAllListeners', rtype: 'promise' }];
  const n = { llamadas: [], defaults: {} };
  window.__nativo = n;
  window.Capacitor = {
    PluginHeaders: [
      { name: 'Preferences', methods: metodos(['configure', 'get', 'set', 'remove', 'keys', 'clear', 'migrate', 'removeOld']) },
      { name: 'App', methods: metodos(['getState', 'getInfo', 'getLaunchUrl', 'exitApp', 'minimizeApp']) },
      { name: 'StatusBar', methods: metodos(['setStyle', 'setBackgroundColor', 'show', 'hide', 'getInfo', 'setOverlaysWebView']) },
      { name: 'Keyboard', methods: metodos(['show', 'hide', 'setAccessoryBarVisible', 'setScroll', 'setStyle', 'setResizeMode', 'getResizeMode']) },
      { name: 'SplashScreen', methods: metodos(['show', 'hide']) },
      { name: 'EntrenoWatch', methods: metodos(['estado', 'envia', 'termina', 'mandaPlan', 'pendientes', 'confirma', 'avisaSubido']) },
      { name: 'NativeMap', methods: metodos(['dispatchMapEvent']) }, // el código del mapa se baja al abrir y se pone a escuchar
    ],
    nativeCallback() { return Promise.resolve(`cb${n.llamadas.length}`); },
    nativePromise(plugin, metodo, o = {}) {
      n.llamadas.push({ q: `${plugin}.${metodo}`, clave: o?.key ?? null, valor: o?.value ?? null });
      if (plugin === 'Preferences') {
        console.log(`[puente] ${plugin}.${metodo} ${o?.key ?? ''}`);
        if (preferencias === 'cuelga') return new Promise(() => {});
        if (metodo === 'get') return Promise.resolve({ value: n.defaults[o.key] ?? null });
        if (metodo === 'set') { n.defaults[o.key] = o.value; return Promise.resolve({}); }
        if (metodo === 'remove') { delete n.defaults[o.key]; return Promise.resolve({}); }
        if (metodo === 'keys') return Promise.resolve({ keys: Object.keys(n.defaults) });
        return Promise.resolve({});
      }
      if (plugin === 'EntrenoWatch') {
        if (metodo === 'estado') return Promise.resolve({ emparejado: false, instalada: false, alcanzable: false });
        if (metodo === 'pendientes') return Promise.resolve({ resultados: [] });
        if (metodo === 'mandaPlan') return Promise.resolve({ enviado: false });
      }
      if (plugin === 'App' && metodo === 'getState') return Promise.resolve({ isActive: true });
      return Promise.resolve({});
    },
  };
};

/* ---------------- Vite y WebKit ---------------- */
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PUERTO), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
const cierraVite = () => { try { vite.kill(); } catch { /* ya */ } };
process.on('exit', cierraVite);
await new Promise((listo, falla) => {
  vite.stdout.on('data', (d) => { if (String(d).includes('Local:')) listo(); });
  vite.stderr.on('data', (d) => { if (String(d).includes('already in use')) falla(new Error(`El puerto ${PUERTO} está ocupado`)); });
  vite.on('exit', (c) => falla(new Error(`Vite se cerró (${c})`)));
});
const navegador = await webkit.launch();

/** Abre la app con la sesión ya guardada. Devuelve la página, el servidor falso y la línea de tiempo de la consola (ms desde que se abrió). */
async function abre({ preferencias, perfilCuelga = false }) {
  const srv = servidor({ perfilCuelga });
  const contexto = await navegador.newContext({ ...devices['iPhone 13'], locale: 'es-MX', timezoneId: 'America/Mexico_City', serviceWorkers: 'block' });
  await contexto.route(`${SUPABASE}/**`, srv.atiende);
  // Nada de afuera (fuentes, videos, el canal en vivo de Supabase): la prueba no depende de internet de verdad.
  await contexto.route(/^https?:\/\/(?!localhost)/, (r) => (r.request().url().startsWith(SUPABASE) ? r.fallback() : r.abort()));
  await contexto.routeWebSocket(/^wss?:\/\/(?!localhost)/, (ws) => ws.close());
  await contexto.addInitScript(PUENTE, { preferencias, llave: LLAVE_SESION, s: sesion() });
  const pagina = await contexto.newPage();
  const linea = [];
  const inicio = Date.now();
  pagina.on('console', (m) => linea.push({ t: Date.now() - inicio, texto: `${m.type()}: ${m.text().slice(0, 160)}` }));
  pagina.on('pageerror', (e) => linea.push({ t: Date.now() - inicio, texto: `pageerror: ${String(e?.message ?? e).slice(0, 160)}` }));
  await pagina.goto(BASE, { waitUntil: 'load' }).catch(() => {});
  return { contexto, pagina, srv, linea, inicio };
}
const texto = (pagina) => pagina.evaluate(() => document.body.innerText).catch(() => '');
let fallidas = 0;
async function esperaTexto(abierta, re, ms) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    if (re.test(await texto(abierta.pagina))) return Date.now() - abierta.inicio;
    await espera(200);
  }
  fallidas += 1;
  await abierta.pagina.screenshot({ path: `${CAPTURAS}/falla-${fallidas}.png` }).catch(() => {});
  console.log(`  (no salió ${re} en ${ms} ms; la pantalla decía: ${(await texto(abierta.pagina)).replace(/\s+/g, ' ').slice(0, 200)})`);
  console.log('  Lo que pasó en la consola (ms desde que se abrió):');
  for (const l of abierta.linea.filter((x) => !/\[vite\]|Download the React DevTools/.test(x.texto))) console.log(`    ${String(l.t).padStart(6)}  ${l.texto}`);
  return null;
}
const llamadas = (abierta) => abierta.pagina.evaluate(() => window.__nativo.llamadas);
// Cuándo pasó algo en la consola (ms desde que se abrió). Los tiempos se miden desde que la app le pide al teléfono la copia del perfil: antes de eso
// Vite todavía está armando la app (la primera vez tarda varios segundos) y eso no es del arranque.
const cuando = (abierta, re) => abierta.linea.find((l) => re.test(l.texto))?.t ?? null;
const LEE_LA_COPIA = /\[puente\] Preferences\.get tl:perfil:/;
const ENTRO = /Fuerza del arranque/;

let fallo = null;
try {
  console.log('1. Preferences contesta (como en el iPhone)');
  {
    const a = await abre({ preferencias: 'contesta' });
    const t = await esperaTexto(a, ENTRO, 30000);
    assert.ok(t != null, 'se quedó en «Cargando tu perfil…»: alguna promesa del arranque no contestó');
    const lee = cuando(a, LEE_LA_COPIA);
    assert.ok(lee != null, 'nunca le pidió al teléfono la copia del perfil (Preferences.get no llegó al nativo)');
    const pide = a.srv.pedidosDelPerfil[0] - a.inicio;
    assert.ok(pide - lee < 1500, `pidió el perfil ${pide - lee} ms después de leer la copia: esperó el tope de 3 s porque Preferences no contestó`);
    paso(`lee la copia del perfil en el teléfono y ${pide - lee} ms después pide el perfil, sin esperar ningún tope; entra ${t - lee} ms después`);
    await espera(800);
    const escrita = (await llamadas(a)).find((x) => x.q === 'Preferences.set' && x.clave === `tl:perfil:${ANA}`);
    assert.ok(escrita && JSON.parse(escrita.valor).id === ANA, 'la copia del perfil no quedó escrita en el teléfono');
    paso('deja la copia del perfil escrita en el teléfono (Preferences.set)');
    await a.contexto.close();
  }

  console.log('2. Preferences no contesta nunca');
  {
    const a = await abre({ preferencias: 'cuelga' });
    const t = await esperaTexto(a, ENTRO, 30000);
    assert.ok(t != null, 'con Preferences mudo se quedó en «Cargando tu perfil…»');
    const lee = cuando(a, LEE_LA_COPIA);
    const pide = a.srv.pedidosDelPerfil[0] - a.inicio;
    assert.ok(pide - lee >= 2800 && pide - lee < 4500, `pidió el perfil ${pide - lee} ms después de leer la copia (debía ser a los 3 s)`);
    paso(`a los ${pide - lee} ms se sigue sin la copia y se pide el perfil al servidor; entra ${t - lee} ms después`);
    await a.contexto.close();
  }

  console.log('3. Ni Preferences ni el servidor contestan');
  {
    const a = await abre({ preferencias: 'cuelga', perfilCuelga: true });
    const BOTONES = /Reintentar[\s\S]*Salir/;
    assert.ok(await esperaTexto(a, /Cargando tu perfil/, 30000) != null, 'no salió «Cargando tu perfil…»');
    const lee = cuando(a, LEE_LA_COPIA);
    assert.ok(lee != null, 'nunca le pidió al teléfono la copia del perfil');
    await espera(Math.max(0, a.inicio + lee + 13500 - Date.now()));
    assert.ok(!BOTONES.test(await texto(a.pagina)), 'los botones salieron antes de los 15 s');
    const t = await esperaTexto(a, BOTONES, 6000);
    assert.ok(t != null, 'a los 15 s no ofreció «Reintentar» ni «Salir»');
    assert.ok(t - lee >= 14500 && t - lee < 17500, `los botones salieron a los ${t - lee} ms (debía ser a los 15 s)`);
    paso(`a los ${t - lee} ms la pantalla de carga ofrece «Reintentar» y «Salir»`);
    await a.pagina.getByRole('button', { name: 'Salir' }).click();
    const fin = Date.now() + 8000;
    let fuera = false;
    while (Date.now() < fin && !fuera) {
      fuera = await a.pagina.evaluate((llave) => !window.localStorage.getItem(llave), LLAVE_SESION);
      if (!fuera) await espera(200);
    }
    assert.ok(fuera, '«Salir» no quitó la sesión del teléfono');
    assert.ok(!/Cargando tu perfil|Reintentar/.test(await texto(a.pagina)), '«Salir» dejó la pantalla de carga');
    paso('«Salir» saca de la cuenta aunque Preferences no conteste');
    await a.contexto.close();
  }
} catch (e) {
  fallo = e;
} finally {
  await navegador.close();
  cierraVite();
}
if (fallo) {
  console.error(`\n✗ ${fallo.message}`);
  process.exit(1);
}
console.log(`\n✓ ${pasos} pasos del arranque en el motor del iPhone`);
process.exit(0);
