/* Pruebas del ARRANQUE DE LA APP DE IPHONE (2 nov 2026; el build 74 se quedaba en «Cargando tu perfil…» para siempre después de entrar):
   `node scripts/prueba-arranque.mjs`.

   Sin iPhone ni red: el `@capacitor/core` y el `@capacitor/preferences` DE VERDAD sobre un puente de iOS falso (lo que ponen `native-bridge.js` y
   `CapacitorBridge.swift`: la plataforma, los métodos de `PreferencesPlugin.swift` y `nativePromise`), el almacén del teléfono de verdad
   (`src/lib/almacenDelTelefono.js`) y la carga del perfil de verdad (`src/lib/cargaDelPerfil.js`, la que usa `AuthContext`). Con un reloj falso: los topes
   de 3 y 15 s se comprueban sin esperarlos.

   La causa del build 74: el almacén devolvía el plugin desnudo de una promesa y la promesa no contestaba nunca («"Preferences.then()" is not implemented
   on ios»). La primera prueba de la sección 1 es la que fallaba. */
import assert from 'node:assert/strict';

/* El reloj falso, ANTES de cargar nada: el almacén y la carga del perfil usan el `setTimeout` del sistema. */
const reloj = { ahora: 0, vivas: new Map(), sig: 1 };
globalThis.setTimeout = (fn, ms = 0, ...args) => {
  const id = reloj.sig++;
  reloj.vivas.set(id, { fn: () => fn(...args), en: reloj.ahora + Math.max(0, Number(ms) || 0) });
  return id;
};
globalThis.clearTimeout = (id) => { reloj.vivas.delete(id); };
const vueltas = async (n = 20) => { for (let i = 0; i < n; i += 1) await new Promise((r) => { setImmediate(r); }); };
/** Pasa `ms` del reloj falso: dispara en orden lo que vencía y deja correr lo que eso provoca. */
async function avanza(ms) {
  const fin = reloj.ahora + ms;
  for (;;) {
    await vueltas();
    const [id, t] = [...reloj.vivas.entries()].filter(([, x]) => x.en <= fin).sort((a, b) => a[1].en - b[1].en || a[0] - b[0])[0] ?? [];
    if (!t) break;
    reloj.vivas.delete(id);
    reloj.ahora = t.en;
    t.fn();
  }
  reloj.ahora = fin;
  await vueltas();
}

/* El iPhone, falso: lo que `native-bridge.js` y `CapacitorBridge.swift` ponen en la página. `UserDefaults` es un mapa de textos. `modo = 'cuelga'`: ninguna
   llamada a Preferences contesta nunca. */
const telefono = { datos: new Map(), llamadas: [], modo: 'contesta' };
globalThis.webkit = { messageHandlers: { bridge: { postMessage() {} } } };
globalThis.Capacitor = {
  PluginHeaders: [{ name: 'Preferences', methods: ['configure', 'get', 'set', 'remove', 'keys', 'clear', 'migrate', 'removeOld'].map((name) => ({ name, rtype: 'promise' })) }],
  nativePromise(plugin, metodo, o = {}) {
    telefono.llamadas.push({ q: `${plugin}.${metodo}`, clave: o?.key ?? null });
    if (telefono.modo === 'cuelga') return new Promise(() => {});
    if (metodo === 'get') return Promise.resolve({ value: telefono.datos.get(o.key) ?? null });
    if (metodo === 'set') { telefono.datos.set(o.key, o.value); return Promise.resolve({}); }
    if (metodo === 'remove') { telefono.datos.delete(o.key); return Promise.resolve({}); }
    if (metodo === 'keys') return Promise.resolve({ keys: [...telefono.datos.keys()] });
    return Promise.resolve({});
  },
  nativeCallback() { return Promise.resolve('cb1'); },
};
const rechazos = [];
process.on('unhandledRejection', (e) => { rechazos.push(String(e?.message ?? e)); });
// El almacén avisa en la consola cuando el teléfono no contesta: aquí eso es lo que se prueba, no hace falta verlo.
const errorDeConsola = console.error;
console.error = (...a) => { if (!String(a[0]).startsWith('almacén del teléfono')) errorDeConsola(...a); };

const { TOPE_DEL_TELEFONO_MS, borraDelTelefono, clavesDelTelefono, conCopiaEnElTelefono, guardaEnElTelefono, leeDelTelefono } = await import('../src/lib/almacenDelTelefono.js');
const { TOPE_DE_LA_CARGA_MS, cargaElPerfil } = await import('../src/lib/cargaDelPerfil.js');

let n = 0;
const pruebas = [];
const prueba = (nombre, f) => pruebas.push([nombre, f]);
const seccion = (titulo) => pruebas.push([null, titulo]);
/** Sigue una promesa sin esperarla: `listo` y `valor` dicen si ya contestó y qué. */
const sigue = (p) => { const s = { listo: false, valor: undefined }; p.then((v) => { s.listo = true; s.valor = v; }); return s; };
const modo = (m) => { telefono.modo = m; telefono.llamadas.length = 0; };
const llego = (q, clave) => telefono.llamadas.some((x) => x.q === q && x.clave === clave);
const id = (letra) => `00000000-0000-4000-8000-0000000000${letra}${letra}`;
const perfilDe = (uid) => ({ id: uid, username: 'ana', full_name: 'Ana', role: 'user' });

seccion('1. Preferences de verdad, sobre el puente de iOS');
prueba('la app se cree en el iPhone: hay copia en el teléfono', () => {
  assert.equal(conCopiaEnElTelefono(), true);
});
prueba('la copia del perfil llega del teléfono sin mover el reloj (la promesa del plugin contesta)', async () => {
  modo('contesta');
  const uid = id('a');
  telefono.datos.set(`tl:perfil:${uid}`, JSON.stringify(perfilDe(uid)));
  const lectura = sigue(leeDelTelefono(`tl:perfil:${uid}`));
  await vueltas();
  assert.ok(lectura.listo, 'la lectura no contestó: la promesa que trae el plugin se quedó esperando («Preferences.then()»)');
  assert.deepEqual(lectura.valor, perfilDe(uid));
  assert.ok(llego('Preferences.get', `tl:perfil:${uid}`), 'Preferences.get nunca llegó al iPhone');
  assert.deepEqual(rechazos.filter((t) => /\.then\(\)/.test(t)), [], 'Capacitor tomó `.then` por un método nativo');
});
prueba('guardar, ver las llaves y borrar también llegan al iPhone', async () => {
  modo('contesta');
  const clave = `tl:estado:${id('a')}`;
  const g = sigue(guardaEnElTelefono(clave, { v: 1 }));
  await vueltas();
  assert.equal(g.valor, true);
  assert.equal(telefono.datos.get(clave), '{"v":1}');
  const k = sigue(clavesDelTelefono());
  await vueltas();
  assert.ok(k.valor.includes(clave));
  const b = sigue(borraDelTelefono(clave));
  await vueltas();
  assert.equal(b.valor, true);
  assert.equal(telefono.datos.has(clave), false);
});

seccion('2. Preferences no contesta nunca');
prueba('la lectura de la copia espera 3 s y sigue sin copia', async () => {
  modo('cuelga');
  const lectura = sigue(leeDelTelefono(`tl:perfil:${id('b')}`));
  await avanza(TOPE_DEL_TELEFONO_MS - 1);
  assert.equal(lectura.listo, false, 'se rindió antes de los 3 s');
  await avanza(1);
  assert.equal(lectura.listo, true, 'a los 3 s seguía esperando');
  assert.equal(lectura.valor, null);
});
prueba('una llave que no se pudo leer no se pisa ni se borra, aunque el teléfono ya conteste', async () => {
  const clave = `tl:perfil:${id('b')}`; // la de la prueba anterior
  telefono.datos.set(clave, '"lo que había"');
  modo('contesta');
  const g = sigue(guardaEnElTelefono(clave, { nuevo: true }));
  const b = sigue(borraDelTelefono(clave));
  await vueltas();
  assert.equal(g.valor, false);
  assert.equal(b.valor, false);
  assert.equal(telefono.datos.get(clave), '"lo que había"');
  assert.ok(!llego('Preferences.set', clave) && !llego('Preferences.remove', clave), 'llegó al iPhone una escritura sobre lo que no se leyó');
});
prueba('guardar, borrar y ver las llaves tampoco esperan más de 3 s', async () => {
  modo('cuelga');
  const g = sigue(guardaEnElTelefono(`tl:plan:${id('c')}:programas`, { valor: 1 }));
  const b = sigue(borraDelTelefono(`tl:plan:${id('c')}:medios`));
  const k = sigue(clavesDelTelefono());
  await avanza(TOPE_DEL_TELEFONO_MS - 1);
  assert.equal(g.listo || b.listo || k.listo, false, 'se rindieron antes de los 3 s');
  await avanza(1);
  assert.equal(g.valor, false);
  assert.equal(b.valor, false);
  assert.deepEqual(k.valor, []);
});

seccion('3. La carga del perfil al entrar (la de AuthContext)');
/** Una carga con el almacén de verdad y un servidor falso. `servidor`: 'contesta' | 'cuelga' (nunca) | 'tarda' (cuando se suelte) | 'sin-senal'. */
function carga(uid, { servidor = 'contesta', haySenal = true } = {}) {
  const c = { pedidos: [], perfil: null, deLaCopia: null, fallas: [], suelta: null };
  c.cancela = cargaElPerfil({
    uid,
    leeCopia: () => leeDelTelefono(`tl:perfil:${uid}`),
    pide: () => {
      c.pedidos.push(reloj.ahora);
      if (servidor === 'cuelga') return new Promise(() => {});
      if (servidor === 'tarda') return new Promise((listo) => { c.suelta = () => listo({ data: perfilDe(uid), error: null, status: 200 }); });
      if (servidor === 'sin-senal') return Promise.resolve({ data: null, error: Object.assign(new TypeError('Load failed'), { status: 0 }), status: 0 });
      return Promise.resolve({ data: perfilDe(uid), error: null, status: 200 });
    },
    haySenal: () => haySenal,
    alPerfil: (perfil, { deLaCopia }) => { c.perfil = perfil; c.deLaCopia = deLaCopia; },
    alFalla: () => { c.fallas.push(reloj.ahora); },
  });
  return c;
}
prueba('Preferences contesta: entra con el perfil del servidor sin esperar ningún tope', async () => {
  modo('contesta');
  const uid = id('d');
  telefono.datos.set(`tl:perfil:${uid}`, JSON.stringify(perfilDe(uid)));
  const inicio = reloj.ahora;
  const c = carga(uid);
  await vueltas();
  assert.deepEqual(c.pedidos, [inicio]);
  assert.deepEqual(c.perfil, perfilDe(uid));
  assert.equal(c.deLaCopia, false);
  await avanza(TOPE_DE_LA_CARGA_MS * 2);
  assert.deepEqual(c.fallas, [], 'con el perfil puesto no debe avisar nada');
});
prueba('Preferences no contesta: a los 3 s se sigue sin copia y se pide el perfil al servidor', async () => {
  modo('cuelga');
  const uid = id('e');
  const inicio = reloj.ahora;
  const c = carga(uid);
  await avanza(TOPE_DEL_TELEFONO_MS - 1);
  assert.deepEqual(c.pedidos, [], 'pidió al servidor antes de los 3 s');
  await avanza(1);
  assert.deepEqual(c.pedidos, [inicio + TOPE_DEL_TELEFONO_MS]);
  assert.deepEqual(c.perfil, perfilDe(uid));
  await avanza(TOPE_DE_LA_CARGA_MS * 2);
  assert.deepEqual(c.fallas, []);
});
prueba('nada contesta: a los 15 s «Cargando tu perfil…» ofrece «Reintentar» y «Salir»', async () => {
  modo('cuelga');
  const inicio = reloj.ahora;
  const c = carga(id('f'), { servidor: 'cuelga' });
  await avanza(TOPE_DE_LA_CARGA_MS - 1);
  assert.deepEqual(c.fallas, [], 'avisó antes de los 15 s');
  await avanza(1);
  assert.deepEqual(c.fallas, [inicio + TOPE_DE_LA_CARGA_MS], 'a los 15 s seguía girando');
  assert.equal(c.perfil, null);
});
prueba('y si el perfil llega después de los 15 s, entra igual', async () => {
  modo('contesta');
  const c = carga(id('j'), { servidor: 'tarda' });
  await avanza(TOPE_DE_LA_CARGA_MS);
  assert.equal(c.fallas.length, 1);
  c.suelta();
  await vueltas();
  assert.deepEqual(c.perfil, perfilDe(id('j')));
  assert.equal(c.deLaCopia, false);
});
prueba('sin señal y con copia: la copia de una vez, sin preguntar al servidor', async () => {
  modo('contesta');
  const uid = id('g');
  telefono.datos.set(`tl:perfil:${uid}`, JSON.stringify(perfilDe(uid)));
  const c = carga(uid, { haySenal: false });
  await vueltas();
  assert.deepEqual(c.perfil, perfilDe(uid));
  assert.equal(c.deLaCopia, true);
  assert.deepEqual(c.pedidos, []);
});
prueba('sin copia y el servidor sin señal: 3 intentos (a los 0, 2 y 6 s) y avisa al acabar, antes de los 15 s', async () => {
  modo('contesta');
  const inicio = reloj.ahora;
  const c = carga(id('h'), { servidor: 'sin-senal' });
  await avanza(10000);
  assert.deepEqual(c.pedidos.map((t) => t - inicio), [0, 2000, 6000]);
  assert.deepEqual(c.fallas.map((t) => t - inicio), [6000]);
  await avanza(TOPE_DE_LA_CARGA_MS);
  assert.equal(c.fallas.length, 1, 'el tope de 15 s no debe avisar otra vez');
});
prueba('cancelar (cambió quien entró, o «Reintentar») ya no avisa nada', async () => {
  modo('cuelga');
  const c = carga(id('i'), { servidor: 'cuelga' });
  await avanza(1000);
  c.cancela();
  await avanza(TOPE_DE_LA_CARGA_MS * 2);
  assert.deepEqual(c.fallas, []);
  assert.equal(c.perfil, null);
});

for (const [nombre, f] of pruebas) {
  if (nombre === null) { console.log(f); continue; }
  await f();
  n += 1;
  console.log(`  ✓ ${nombre}`);
}
assert.deepEqual(rechazos, [], `promesas rechazadas sin atender: ${rechazos.join(' | ')}`);
console.log(`\n✓ ${n} pruebas del arranque`);
