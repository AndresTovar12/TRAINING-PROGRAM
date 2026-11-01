/* PRUEBA DE PUNTA A PUNTA DE «SIN CONEXIÓN» EN EL MOTOR DEL IPHONE (1 nov 2026, encargo «sin conexión», parte 2; ver `docs/sin-conexion.md`).

   Corre la app de verdad (Vite en modo desarrollo) en WebKit con el perfil de un iPhone y con la puerta de prueba `window.__tlPruebaSinConexion` (la copia y la cola
   usan el `localStorage` del navegador en lugar de Capacitor Preferences; solo existe con `npm run dev`). La «base» es un Supabase FALSO dentro de esta prueba: no
   toca la base real ni necesita contraseñas, y deja contar cuántas veces llega cada cosa. «Cerrar la app» = cerrar el contexto y abrir otro con el mismo
   almacenamiento (`storageState`).

   Lo que recorre (los pasos 2 y 3 del encargo, más los riesgos):
     1. Con señal: abre, ve el plan de hoy y deja la copia en el teléfono.
     2. Sin señal DESDE ANTES DE ABRIR (y con la llave de la sesión ya vencida): el plan de hoy se ve igual y sale el aviso «Sin conexión…».
        Ahí se anota un cambio del plan y se guarda un entreno libre (con ruta). Mi perfil dice «2 cosas por subir». Nada llega a la base.
     3. Mientras, «la compu» escribe otra cosa en la base.
     4. Se cierra la app y se abre con señal: todo llega UNA vez (aunque la primera respuesta del entreno se pierda) y lo de la compu sigue ahí.
     5. Cambiar de cuenta: salir con cosas por subir (avisa), entrar con otra cuenta (no ve ni sube nada de la primera) y volver.

   Uso: node scripts/prueba-sin-conexion-iphone.mjs   (levanta Vite en el puerto 5199 y lo apaga al final; pesado: no correr con otra prueba a la vez) */
import { webkit, devices } from 'playwright';
import { spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';
import { aplicarParche } from '../src/lib/estadoPorPartes.js';

const PUERTO = 5199;
const BASE = `http://localhost:${PUERTO}`;
const CAPTURAS = process.env.CAPTURAS || '/tmp/prueba-sin-conexion';
mkdirSync(CAPTURAS, { recursive: true });
const env = Object.fromEntries(readFileSync('.env', 'utf8').split('\n').filter((l) => l.includes('=')).map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1).trim()]));
const SUPABASE = env.VITE_SUPABASE_URL;
const LLAVE_SESION = `sb-${new URL(SUPABASE).hostname.split('.')[0]}-auth-token`;

let pasos = 0;
const paso = (t) => { pasos += 1; console.log(`  ✓ ${t}`); };
const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });

/* ---------------- El Supabase falso ---------------- */
const ANA = '00000000-0000-4000-8000-0000000000a1';
const BETO = '00000000-0000-4000-8000-0000000000b2';
const COACH = '00000000-0000-4000-8000-0000000000c3';
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const plan = (uid) => ({
  id: `plan-${uid}`, user_id: uid, profesional_id: null, status: 'active', title: 'Rutina de prueba', created_at: '2026-10-01T00:00:00Z', created_by: COACH,
  data: { kind: 'weekly', estructura: 'rutina', phases: [{ id: 'f1', name: 'Rutina', weekData: [{ num: 1, days: DIAS.map((day) => ({ day, name: 'Fuerza sin señal', cat: 'gym', exercises: [{ name: 'Sentadilla', sets: '3', reps: '5' }, { name: 'Remo', sets: '3', reps: '8' }] })) }] }] },
});
const perfilDe = (uid, nombre) => ({
  id: uid, username: nombre.toLowerCase(), full_name: nombre, role: 'user', coach_id: COACH, is_active: true, perfil_completo: true, inicio_paso: null,
  unidad_peso: 'kg', genero: 'm', is_owner: false, avatar_url: null, created_at: '2026-10-01T00:00:00Z',
});
const usuarioDe = (uid, nombre) => ({ id: uid, aud: 'authenticated', role: 'authenticated', email: `${nombre.toLowerCase()}@sin-correo.traininglabapp.com`, app_metadata: { provider: 'email' }, user_metadata: {}, created_at: '2026-10-01T00:00:00Z' });
const b64 = (o) => Buffer.from(JSON.stringify(o)).toString('base64url');
const jwt = (uid, exp) => `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: uid, role: 'authenticated', aud: 'authenticated', exp })}.firma`;
const sesionDe = (uid, nombre, { vencida = false } = {}) => {
  const exp = Math.floor(Date.now() / 1000) + (vencida ? -7200 : 3600);
  return { access_token: jwt(uid, exp), token_type: 'bearer', expires_in: 3600, expires_at: exp, refresh_token: `refresco-${uid}`, user: usuarioDe(uid, nombre) };
};

const servidor = {
  conRed: true,
  estados: { [ANA]: { 'wr:onerm': { sentadilla: 100 } }, [BETO]: {} },
  actividades: new Map(),
  series: new Map(),
  llegadas: [], // lo que llega a la base: { que, uid, cuerpo }
  pierdeLaRespuestaDe: null, // 'actividades': la primera subida se guarda pero su respuesta «se pierde»
  quienDelToken(req) {
    const t = (req.headers().authorization ?? '').replace(/^Bearer /, '');
    try { return JSON.parse(Buffer.from(t.split('.')[1], 'base64url').toString()).sub ?? null; } catch { return null; }
  },
};

const CORS = { 'access-control-allow-origin': BASE, 'access-control-allow-credentials': 'true', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*', 'access-control-expose-headers': 'content-range, content-profile, x-supabase-api-version' };
const responde = (route, status, cuerpo, extra = {}) => route.fulfill({ status, headers: { ...CORS, 'content-type': 'application/json', ...extra }, body: cuerpo === undefined ? '' : JSON.stringify(cuerpo) });
const quiereUno = (req) => (req.headers().accept ?? '').includes('vnd.pgrst.object');
const param = (url, k) => url.searchParams.get(k);
const eq = (url, k) => (param(url, k) ?? '').replace(/^eq\./, '');

async function atiende(route) {
  const req = route.request();
  const url = new URL(req.url());
  if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: CORS });
  if (!servidor.conRed) return route.abort('internetdisconnected');
  const ruta = url.pathname;
  const uid = servidor.quienDelToken(req);
  let cuerpo = null;
  try { cuerpo = req.postData() ? JSON.parse(req.postData()) : null; } catch { cuerpo = null; }

  if (ruta === '/auth/v1/token') {
    const quien = String(cuerpo?.refresh_token ?? '').replace('refresco-', '');
    if (![ANA, BETO].includes(quien)) return responde(route, 400, { error: 'invalid_grant' });
    return responde(route, 200, sesionDe(quien, quien === ANA ? 'Ana' : 'Beto'));
  }
  if (ruta === '/auth/v1/logout') return responde(route, 204);
  if (ruta === '/auth/v1/user') return uid ? responde(route, 200, usuarioDe(uid, uid === ANA ? 'Ana' : 'Beto')) : responde(route, 401, { msg: 'sin sesión' });
  if (ruta.startsWith('/rest/v1/rpc/')) {
    const fn = ruta.slice('/rest/v1/rpc/'.length);
    if (fn === 'mezclar_mi_estado') {
      if (!uid) return responde(route, 400, { code: 'P0001', message: 'Sin sesión' });
      if (cuerpo.p_usuario !== uid) return responde(route, 400, { code: 'P0001', message: 'La sesión cambió de cuenta: no se guardó' });
      servidor.estados[uid] = aplicarParche(servidor.estados[uid] ?? {}, cuerpo.p_cambios);
      servidor.llegadas.push({ que: 'estado', uid, cuerpo: cuerpo.p_cambios });
      return responde(route, 204);
    }
    if (fn === 'master_id') return responde(route, 200, COACH);
    return responde(route, 200, []);
  }
  if (ruta === '/rest/v1/profiles') {
    const id = eq(url, 'id');
    const fila = id === ANA ? perfilDe(ANA, 'Ana') : id === BETO ? perfilDe(BETO, 'Beto') : id === COACH ? { id: COACH, profesion: 'coach', full_name: 'Coach de prueba' } : null;
    return responde(route, 200, quiereUno(req) ? fila : (fila ? [fila] : []));
  }
  if (ruta === '/rest/v1/user_app_state') {
    const id = eq(url, 'user_id');
    if (id !== uid) return responde(route, 200, []);
    return responde(route, 200, [{ data: servidor.estados[id] ?? {}, updated_at: new Date().toISOString() }]);
  }
  if (ruta === '/rest/v1/plans') {
    const id = eq(url, 'user_id');
    if (param(url, 'status') === 'eq.active' && id === uid) return responde(route, 200, [plan(id)]);
    return responde(route, 200, []);
  }
  if (ruta === '/rest/v1/actividades') {
    if (req.method() === 'POST') {
      const filas = Array.isArray(cuerpo) ? cuerpo : [cuerpo];
      const nuevas = [];
      for (const f of filas) {
        if (f.atleta_id !== uid) return responde(route, 403, { code: '42501', message: 'new row violates row-level security policy' });
        servidor.llegadas.push({ que: 'actividad', uid, cuerpo: f });
        if (servidor.actividades.has(f.id)) continue; // ON CONFLICT (id) DO NOTHING
        const fila = { ...f, creada_en: new Date().toISOString() };
        servidor.actividades.set(f.id, fila);
        nuevas.push(fila);
      }
      if (servidor.pierdeLaRespuestaDe === 'actividades') { servidor.pierdeLaRespuestaDe = null; return route.abort('connectionreset'); }
      return responde(route, 201, nuevas);
    }
    const id = eq(url, 'id');
    const deEste = [...servidor.actividades.values()].filter((f) => f.atleta_id === uid && (!id || f.id === id)).sort((a, b) => Date.parse(b.inicio) - Date.parse(a.inicio));
    if (req.method() === 'HEAD') return responde(route, 200, undefined, { 'content-range': `0-0/${deEste.length}` });
    return responde(route, 200, quiereUno(req) ? deEste[0] ?? null : deEste);
  }
  if (ruta === '/rest/v1/actividad_series') {
    if (req.method() === 'POST') {
      servidor.llegadas.push({ que: 'ruta', uid, cuerpo });
      if (!servidor.series.has(cuerpo.actividad_id)) servidor.series.set(cuerpo.actividad_id, cuerpo);
      return responde(route, 201, []);
    }
    return responde(route, 200, []);
  }
  if (ruta.startsWith('/rest/v1/')) {
    if (req.method() === 'HEAD') return responde(route, 200, undefined, { 'content-range': '*/0' });
    return responde(route, 200, quiereUno(req) ? null : []);
  }
  if (ruta.startsWith('/functions/v1/')) return responde(route, 200, {});
  return responde(route, 404, {});
}

/* ---------------- La app ---------------- */
const vite = spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--port', String(PUERTO), '--strictPort'], { stdio: ['ignore', 'pipe', 'pipe'] });
const cierraVite = () => { try { vite.kill(); } catch { /* ya */ } };
process.on('exit', cierraVite);
await new Promise((listo, falla) => {
  vite.stdout.on('data', (d) => { if (String(d).includes('Local:')) listo(); });
  vite.stderr.on('data', (d) => { if (String(d).includes('already in use')) falla(new Error(`El puerto ${PUERTO} está ocupado`)); });
  vite.on('exit', (c) => falla(new Error(`Vite se cerró (${c})`)));
});

const navegador = await webkit.launch();
const telefono = devices['iPhone 13'];
const errores = [];
const consola = [];

async function abre(estadoGuardado, { sinRed = false, sesion = null } = {}) {
  const contexto = await navegador.newContext({ ...telefono, storageState: estadoGuardado ?? undefined, locale: 'es-MX', timezoneId: 'America/Mexico_City', serviceWorkers: 'block' });
  await contexto.route(`${SUPABASE}/**`, atiende);
  // Nada de afuera (fuentes, videos): la prueba no depende de internet de verdad.
  await contexto.route(/^https?:\/\/(?!localhost)/, (r) => (r.request().url().startsWith(SUPABASE) ? r.fallback() : r.abort()));
  /* «Sin señal» = las peticiones a Supabase no llegan (las corta `atiende`) y el teléfono dice que no tiene red (`navigator.onLine` falso). NO se usa
     `setOffline` del contexto: cortaría también la app misma, que en el iPhone viene dentro del paquete (no se baja), y aquí la sirve Vite. */
  await contexto.addInitScript(({ llave, s, red }) => {
    window.__tlPruebaSinConexion = true;
    window.__tlRed = red;
    Object.defineProperty(Navigator.prototype, 'onLine', { configurable: true, get: () => window.__tlRed });
    window.__tlPonRed = (v) => { window.__tlRed = v; window.dispatchEvent(new Event(v ? 'online' : 'offline')); };
    if (s) window.localStorage.setItem(llave, JSON.stringify(s));
  }, { llave: LLAVE_SESION, s: sesion, red: !sinRed });
  servidor.conRed = !sinRed;
  const pagina = await contexto.newPage();
  pagina.on('pageerror', (e) => errores.push(String(e?.message ?? e)));
  pagina.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') consola.push(`${m.type()}: ${m.text().slice(0, 200)}`); });
  await pagina.goto(BASE, { waitUntil: 'load' }).catch(() => {});
  return { contexto, pagina };
}
const texto = (pagina) => pagina.evaluate(() => document.body.innerText);
let fallidas = 0;
async function esperaTexto(pagina, re, ms = 30000, { debeSalir = true } = {}) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    if (re.test(await texto(pagina).catch(() => ''))) return true;
    await espera(400);
  }
  if (debeSalir) {
    // Para entender por qué no salió: la captura y lo que decía la pantalla.
    fallidas += 1;
    await pagina.screenshot({ path: `${CAPTURAS}/falla-${fallidas}.png` }).catch(() => {});
    console.log(`  (no salió ${re}; la pantalla decía: ${(await texto(pagina).catch(() => '')).replace(/\s+/g, ' ').slice(0, 400)})`);
    console.log(`  (consola: ${consola.slice(-12).join(' | ').slice(0, 1500)})`);
  }
  return false;
}
const llavesDelTelefono = (pagina) => pagina.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith('tl-prueba:')).map((k) => k.slice(10)).sort());
const delTelefono = (pagina, clave) => pagina.evaluate((k) => JSON.parse(localStorage.getItem(`tl-prueba:${k}`) ?? 'null'), clave);
async function abreMiPerfil(pagina) {
  // El botón de la cuenta se esconde al bajar (p33): primero arriba.
  await pagina.evaluate(() => window.scrollTo(0, 0));
  await espera(600);
  await pagina.getByRole('button', { name: 'Cuenta', exact: true }).first().click({ timeout: 8000 });
  await pagina.getByRole('button', { name: /^Mi perfil/ }).first().click({ timeout: 8000 });
}

try {
  console.log('1 · Con señal');
  let { contexto, pagina } = await abre(null, { sesion: sesionDe(ANA, 'Ana') });
  assert.ok(await esperaTexto(pagina, /Fuerza sin señal/), 'el plan de hoy se ve');
  await espera(2500); // la copia del teléfono se escribe poco después de cargar
  const llaves = await llavesDelTelefono(pagina);
  for (const k of [`tl:estado:${ANA}`, `tl:perfil:${ANA}`, `tl:plan:${ANA}:programas`]) assert.ok(llaves.includes(k), `falta la copia ${k}: ${llaves.join(', ')}`);
  paso('abre con señal, ve el plan de hoy y deja la copia en el teléfono (estado, perfil y plan)');
  console.log(`    (con señal llegó a la base: ${servidor.llegadas.map((l) => `${l.que} ${Object.keys(l.cuerpo ?? {}).join('+')}`).join(', ') || 'nada'})`);
  await pagina.screenshot({ path: `${CAPTURAS}/1-con-senal.png` });
  let guardado = await contexto.storageState();
  await contexto.close();

  console.log('2 · Sin señal desde antes de abrir');
  // Pasó más de una hora: la llave de la sesión ya venció y sin señal no se puede renovar.
  const vencida = sesionDe(ANA, 'Ana', { vencida: true });
  const llegadasAntes = servidor.llegadas.length; // con señal ya llegó algo (el marcador que el calendario puso al abrir)
  ({ contexto, pagina } = await abre(guardado, { sinRed: true, sesion: vencida }));
  assert.ok(await esperaTexto(pagina, /Fuerza sin señal/), 'sin señal, el plan de hoy se ve igual');
  assert.ok(await esperaTexto(pagina, /Sin conexión\. Lo que hagas se guarda en tu teléfono y se sube solo\./, 8000), 'sale el aviso fijo de arriba');
  paso('sin señal (y con la llave vencida) abre con la copia: el plan de hoy igual y el aviso «Sin conexión…»');
  await pagina.screenshot({ path: `${CAPTURAS}/2-sin-senal.png` });

  // Un cambio del plan: marcar la sesión de hoy (lo mismo que hace la pantalla del entreno, por la puerta del estado) y un entreno libre con ruta (lo que llama la pantalla).
  const hoy = await pagina.evaluate(async (ana) => {
    const { aplicaAlEstado } = await import('/src/lib/colaDelTelefono.js');
    const ok = await aplicaAlEstado(ana, (s) => ({ ...s, 'wr:sessions': { ...(s['wr:sessions'] ?? {}), 'prueba-sin-senal': { completed: true, exercises: { 0: { kg: 60 } } } } }));
    const { guardaEntrenoLibre } = await import('/src/lib/entrenoLibreApi.js');
    const inicio = Date.now() - 40 * 60000;
    const muestras = Array.from({ length: 120 }, (_, i) => ({ t: i * 20, lat: 19.43 + i * 0.0002, lon: -99.13, precision: 5 })); // `t` en segundos, como `agregaPunto`
    const fila = await guardaEntrenoLibre({ atletaId: ana, deporte: 'correr', inicioMs: inicio, duracionS: 2400, muestras, titulo: 'Correr sin señal' });
    return { ok, fila: { id: fila.id, pendiente: !!fila.pendiente, titulo: fila.titulo, distancia: fila.distancia_m } };
  }, ANA);
  assert.equal(hoy.ok, true, 'el cambio entró al estado y quedó en el teléfono');
  assert.equal(hoy.fila.pendiente, true, 'el entreno quedó en el teléfono (sin señal)');
  assert.ok(hoy.fila.distancia > 1000, 'y la pantalla tiene su fila con la distancia de la ruta');
  await espera(1500);
  const copia = await delTelefono(pagina, `tl:estado:${ANA}`);
  assert.equal(copia.pendiente['wr:sessions']['prueba-sin-senal'].completed, true, 'el cambio del plan está en la copia (pendiente)');
  const cola = await delTelefono(pagina, `tl:cola:${ANA}`);
  assert.deepEqual(cola.cosas.map((c) => c.id), [hoy.fila.id], 'el entreno está en la cola del teléfono');
  assert.equal(servidor.llegadas.length, llegadasAntes, 'nada llegó a la base');
  paso('sin señal: el cambio del plan y el entreno libre quedan en el teléfono; nada llega a la base');

  // El entreno que está en la cola sale en «Tus entrenos» como cualquier otro, y su página abre sin señal (con su ruta del teléfono).
  assert.ok(await esperaTexto(pagina, /Correr sin señal/, 10000), 'el entreno pendiente sale en «Tus entrenos»');
  await pagina.getByText('Correr sin señal').first().click();
  assert.ok(await esperaTexto(pagina, /km/, 10000), 'su página abre con la distancia');
  await pagina.screenshot({ path: `${CAPTURAS}/2b-entreno-pendiente.png` });
  await pagina.getByRole('button', { name: 'Volver', exact: true }).first().click({ timeout: 8000 });
  await espera(800);
  paso('el entreno que está en la cola sale en «Tus entrenos» y su página abre sin señal');

  await abreMiPerfil(pagina);
  assert.ok(await esperaTexto(pagina, /2 cosas por subir/, 10000), 'Mi perfil dice «2 cosas por subir»');
  paso('Mi perfil dice «2 cosas por subir»');
  await pagina.screenshot({ path: `${CAPTURAS}/3-mi-perfil.png` });
  guardado = await contexto.storageState();
  await contexto.close(); // «se cierra la app» sin señal

  console.log('3 · Mientras, la compu escribe en la base');
  servidor.estados[ANA] = aplicarParche(servidor.estados[ANA], { 'wr:onerm': { banca: 90 }, 'wr:sessions': { 'de-la-compu': { completed: true } } });

  console.log('4 · Vuelve la señal (se abre la app otra vez)');
  servidor.pierdeLaRespuestaDe = 'actividades'; // la primera respuesta del entreno se pierde: la cola lo reintenta
  ({ contexto, pagina } = await abre(guardado, { sinRed: false }));
  const finSubida = Date.now() + 40000;
  while (Date.now() < finSubida && !(servidor.actividades.size === 1 && servidor.series.size === 1 && servidor.estados[ANA]['wr:sessions']?.['prueba-sin-senal'] && !(await delTelefono(pagina, `tl:cola:${ANA}`))?.cosas?.length)) await espera(500);
  assert.equal(servidor.actividades.size, 1, 'el entreno está UNA vez en la base');
  assert.ok(servidor.llegadas.filter((l) => l.que === 'actividad').length >= 2, 'llegó dos veces (la primera respuesta se perdió) y sigue siendo uno');
  assert.equal(servidor.series.size, 1, 'su ruta, una vez');
  const enLaBase = servidor.estados[ANA];
  assert.equal(enLaBase['wr:sessions']['prueba-sin-senal'].completed, true, 'el cambio del plan llegó');
  assert.equal(enLaBase['wr:sessions']['de-la-compu'].completed, true, 'lo de la compu sigue ahí');
  assert.deepEqual(enLaBase['wr:onerm'], { sentadilla: 100, banca: 90 }, 'el 1RM de la compu no se pisó');
  assert.deepEqual((await delTelefono(pagina, `tl:cola:${ANA}`))?.cosas ?? [], [], 'la cola del teléfono quedó vacía');
  paso('con señal: todo llega UNA vez (también si la respuesta se pierde) y lo que escribió la compu no se pisa');
  await espera(1500);
  assert.equal(await esperaTexto(pagina, /Sin conexión\. Lo que hagas/, 1500, { debeSalir: false }), false, 'ya no sale el aviso');
  await abreMiPerfil(pagina);
  await espera(1500);
  assert.equal(/cosas? por subir/.test(await texto(pagina)), false, 'Mi perfil ya no dice «por subir»');
  paso('ya no sale el aviso ni «por subir»');
  guardado = await contexto.storageState();
  await contexto.close();

  console.log('5 · Cambiar de cuenta en el mismo teléfono');
  // Ana, sin señal, anota algo y sale con eso pendiente.
  ({ contexto, pagina } = await abre(guardado, { sinRed: true, sesion: vencida }));
  assert.ok(await esperaTexto(pagina, /Fuerza sin señal/));
  await pagina.evaluate(async (ana) => {
    const { aplicaAlEstado } = await import('/src/lib/colaDelTelefono.js');
    await aplicaAlEstado(ana, (s) => ({ ...s, 'wr:wellness': { ...(s['wr:wellness'] ?? {}), '2026-11-01': { sueno: 6 } } }));
  }, ANA);
  await espera(800);
  await abreMiPerfil(pagina);
  await pagina.getByText('Cerrar sesión', { exact: true }).last().click({ timeout: 8000 });
  assert.ok(await esperaTexto(pagina, /Tienes 1 cosa sin subir/, 8000), 'antes de salir, avisa');
  await pagina.screenshot({ path: `${CAPTURAS}/4-salir-con-pendientes.png` });
  await pagina.getByRole('button', { name: 'Cerrar sesión' }).last().click();
  await espera(2500);
  const despues = await llavesDelTelefono(pagina);
  assert.ok(!despues.some((k) => k.startsWith(`tl:plan:${ANA}`) || k === `tl:perfil:${ANA}`), `las copias de Ana se borraron: ${despues.join(', ')}`);
  const loDeAna = await delTelefono(pagina, `tl:estado:${ANA}`);
  assert.equal(loDeAna.enLaBase, null, 'de su estado solo queda lo pendiente');
  assert.equal(loDeAna.pendiente['wr:wellness']['2026-11-01'].sueno, 6);
  assert.equal(await pagina.evaluate((k) => localStorage.getItem(k), LLAVE_SESION), null, 'sin señal, la sesión también se quitó del teléfono');
  paso('salir sin señal con algo pendiente: avisa, quita la sesión y las copias, y deja SOLO lo pendiente de esa cuenta');
  guardado = await contexto.storageState();
  await contexto.close();

  // Entra Beto en el mismo teléfono, con señal.
  const antesDeBeto = servidor.llegadas.length;
  ({ contexto, pagina } = await abre(guardado, { sinRed: false, sesion: sesionDe(BETO, 'Beto') }));
  assert.ok(await esperaTexto(pagina, /Fuerza sin señal/));
  await espera(3000);
  assert.equal(servidor.llegadas.slice(antesDeBeto).some((l) => l.uid === ANA || JSON.stringify(l.cuerpo).includes('sueno')), false, 'nada de Ana se sube con la sesión de Beto');
  assert.equal(servidor.estados[BETO]['wr:wellness'], undefined, 'ni aparece en lo de Beto');
  await abreMiPerfil(pagina);
  await espera(1000);
  assert.equal(/por subir/.test(await texto(pagina)), false, 'Beto no ve «por subir»');
  paso('otra cuenta en el mismo teléfono: no ve ni sube nada de la anterior');
  await pagina.evaluate((k) => localStorage.removeItem(k), LLAVE_SESION);
  guardado = await contexto.storageState();
  await contexto.close();

  // Ana vuelve a entrar (con señal): lo suyo sube con SU sesión.
  ({ contexto, pagina } = await abre(guardado, { sinRed: false, sesion: sesionDe(ANA, 'Ana') }));
  const finAna = Date.now() + 20000;
  while (Date.now() < finAna && !servidor.estados[ANA]['wr:wellness']) await espera(500);
  assert.equal(servidor.estados[ANA]['wr:wellness']?.['2026-11-01']?.sueno, 6, 'al volver Ana, lo suyo sube a SU cuenta');
  paso('al volver la primera cuenta, lo que dejó pendiente sube a ella');
  await contexto.close();

  const malos = errores.filter((e) => !/Load failed|network|internet|fetch|ResizeObserver/i.test(e));
  assert.deepEqual(malos, [], `errores de la página: ${malos.join(' | ')}`);
  console.log(`\n✓ ${pasos} pasos de «sin conexión» en WebKit (iPhone 13). Capturas en ${CAPTURAS}`);
} finally {
  await navegador.close().catch(() => {});
  cierraVite();
}
