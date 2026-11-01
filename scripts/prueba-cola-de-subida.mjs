/* Pruebas de la COLA QUE NO SE PIERDE (sin conexión, parte 2.2; ver `src/lib/colaDeSubida.js` y `docs/sin-conexion.md`): `node scripts/prueba-cola-de-subida.mjs`.
   Sin red ni base de datos: un almacén falso que sobrevive entre «aperturas» de la app (como Preferences), un servidor falso que guarda por id (como el upsert de
   `actividades`) y un reloj falso (las esperas de 4, 10, 30 y 60 s se comprueban sin esperarlas). */
import assert from 'node:assert/strict';
import { ESPERAS_DE_REINTENTO_MS, claveDeLaCola, creaCola, esperaDeReintento } from '../src/lib/colaDeSubida.js';
import { TodaviaNo, esFaltaDeSenal } from '../src/lib/senal.js';

let n = 0;
const pruebas = [];
const prueba = (nombre, f) => pruebas.push([nombre, f]);
const seccion = (titulo) => pruebas.push([null, titulo]);
const vuelta = () => new Promise((r) => { setImmediate(r); });

/** El almacén del teléfono, falso: guarda TEXTO (como Preferences), así que lo que no sea JSON no pasa. Sobrevive a «cerrar la app» (se pasa a la cola nueva). */
function almacenFalso() {
  const datos = new Map();
  return {
    datos,
    lee: async (clave) => (datos.has(clave) ? JSON.parse(datos.get(clave)) : null),
    guarda: async (clave, valor) => { datos.set(clave, JSON.stringify(valor)); return true; },
  };
}

/** El servidor, falso: guarda por id (el upsert de la base: subir dos veces la misma no hace otra). `modo`: 'bien' | 'sin-senal' | 'pierde-respuesta'. */
function servidorFalso() {
  const s = {
    filas: new Map(), llegadas: [], modo: 'bien', rechaza: new Set(), sinSenalUnaVez: new Set(),
    sube: async (cosa) => {
      await vuelta();
      if (s.modo === 'sin-senal' || s.sinSenalUnaVez.has(cosa.id)) {
        s.sinSenalUnaVez.delete(cosa.id);
        throw Object.assign(new TypeError('Load failed'), { status: 0 });
      }
      if (s.rechaza.has(cosa.id)) throw Object.assign(new Error('new row violates row-level security policy'), { status: 403, code: '42501' });
      s.llegadas.push(cosa.id);
      s.filas.set(cosa.id, { ...cosa.datos, id: cosa.id, atleta_id: cosa.usuario });
      if (s.modo === 'pierde-respuesta') { s.modo = 'bien'; throw Object.assign(new TypeError('The network connection was lost.'), { status: 0 }); }
      return s.filas.get(cosa.id);
    },
  };
  return s;
}

/** El reloj falso: anota cada espera que la cola pide y deja dispararlas a mano. */
function relojFalso() {
  const r = { pedidas: [], vivas: new Map(), sig: 1 };
  r.pon = (fn, ms) => { const id = r.sig++; r.pedidas.push(ms); r.vivas.set(id, { fn, ms }); return id; };
  r.quita = (id) => { r.vivas.delete(id); };
  /** Dispara la espera más próxima (como si pasara ese tiempo) y espera a que termine lo que hace. Devuelve sus ms, o null si no había. */
  r.dispara = async () => {
    const [id, t] = [...r.vivas.entries()].sort((a, b) => a[1].ms - b[1].ms)[0] ?? [];
    if (!t) return null;
    r.vivas.delete(id);
    await t.fn();
    await vuelta();
    return t.ms;
  };
  r.esperasVivas = () => [...r.vivas.values()].map((t) => t.ms).filter((ms) => ms > 0 && ms < 600000);
  return r;
}

function arma({ almacen = almacenFalso(), servidor = servidorFalso(), reloj = relojFalso(), sesion = 'ana' } = {}) {
  const ctx = { almacen, servidor, reloj, sesion, rechazos: [], subidas: [] };
  ctx.cola = creaCola({
    almacen, temporizador: reloj, ahora: () => 1_000_000,
    sesion: async () => (ctx.sesion ? { usuario: ctx.sesion } : null),
    alRechazo: (c) => ctx.rechazos.push(c.id), alSubir: (c) => ctx.subidas.push(c.id),
  });
  ctx.cola.registraTipo('entreno-libre', { sube: (c) => servidor.sube(c) });
  return ctx;
}
const cosa = (id, usuario = 'ana', datos = { titulo: id }) => ({ id, tipo: 'entreno-libre', usuario, datos });
const guardadas = (ctx, usuario = 'ana') => (JSON.parse(ctx.almacen.datos.get(claveDeLaCola(usuario)) ?? '{"cosas":[]}').cosas ?? []).map((c) => c.id);
// La cola vacía en cuanto le dan permiso (programa(0)): aquí se vacía a mano y se espera a que termine.
const vaciaYa = async (ctx) => { await vuelta(); await ctx.cola.vacia(); await vuelta(); };

seccion('Falta de señal o rechazo');
prueba('sin señal, servidor caído o sesión que no se pudo renovar: se reintenta', () => {
  assert.equal(esFaltaDeSenal({ message: 'TypeError: Load failed' }, 0), true);
  assert.equal(esFaltaDeSenal(new TypeError('Failed to fetch')), true);
  assert.equal(esFaltaDeSenal({ message: 'FetchError: The Internet connection appears to be offline.' }), true);
  assert.equal(esFaltaDeSenal({ message: 'algo' }, 503), true);
  assert.equal(esFaltaDeSenal({ message: 'algo' }, 429), true);
  assert.equal(esFaltaDeSenal({ message: 'JWT expired', code: 'PGRST301' }, 401), true);
  assert.equal(esFaltaDeSenal({ message: 'Sin sesión', code: 'P0001' }, 400), true, 'mezclar_mi_estado sin sesión: la llave no se pudo renovar');
  assert.equal(esFaltaDeSenal({ name: 'AuthRetryableFetchError', message: 'x' }), true);
  assert.equal(esFaltaDeSenal(new TodaviaNo()), true);
});
prueba('el servidor dijo que no (o un error de programación): es un rechazo, no se reintenta solo', () => {
  assert.equal(esFaltaDeSenal({ message: 'new row violates row-level security policy', code: '42501' }, 403), false);
  assert.equal(esFaltaDeSenal({ message: 'duplicate key', code: '23505' }, 409), false);
  assert.equal(esFaltaDeSenal({ message: 'Cambios inválidos', code: 'P0001' }, 400), false);
  assert.equal(esFaltaDeSenal({ message: 'Payload Too Large' }, 413), false);
  assert.equal(esFaltaDeSenal(new TypeError("Cannot read properties of undefined (reading 'x')")), false, 'un TypeError cualquiera NO es de señal');
  assert.equal(esFaltaDeSenal(null), false);
});
prueba('las esperas son las de siempre: 4, 10, 30 y luego cada 60 s', () => {
  assert.deepEqual([...ESPERAS_DE_REINTENTO_MS], [4000, 10000, 30000, 60000]);
  assert.deepEqual([1, 2, 3, 4, 5, 9].map(esperaDeReintento), [4000, 10000, 30000, 60000, 60000, 60000]);
});

seccion('En orden');
prueba('sube de la más vieja a la más nueva y deja la cola vacía (también en el teléfono)', async () => {
  const ctx = arma();
  await ctx.cola.usa('ana');
  for (const id of ['a', 'b', 'c']) assert.equal(await ctx.cola.agrega(cosa(id)), true);
  await vaciaYa(ctx);
  assert.deepEqual(ctx.servidor.llegadas, ['a', 'b', 'c']);
  assert.deepEqual(ctx.cola.foto().cosas, []);
  assert.deepEqual(guardadas(ctx), []);
});
prueba('si la primera no sube por falta de señal, las de atrás esperan su turno (no se adelantan)', async () => {
  const ctx = arma();
  await ctx.cola.usa('ana');
  ctx.servidor.sinSenalUnaVez.add('a');
  await ctx.cola.agrega(cosa('a'));
  await ctx.cola.agrega(cosa('b'));
  await vaciaYa(ctx);
  assert.deepEqual(ctx.servidor.llegadas, [], 'b no sube antes que a');
  assert.deepEqual(guardadas(ctx), ['a', 'b']);
  await vaciaYa(ctx);
  assert.deepEqual(ctx.servidor.llegadas, ['a', 'b']);
});

seccion('Reintento');
prueba('sin señal se queda guardada y se reintenta a los 4, 10, 30 y luego cada 60 s; al volver la señal sube', async () => {
  const ctx = arma();
  await ctx.cola.usa('ana');
  ctx.servidor.modo = 'sin-senal';
  await ctx.cola.agrega(cosa('a'));
  await vaciaYa(ctx);
  const esperas = [];
  for (let i = 0; i < 5; i += 1) {
    assert.equal(ctx.reloj.esperasVivas().length, 1, 'siempre UNA espera viva, no se amontonan');
    esperas.push(await ctx.reloj.dispara());
  }
  assert.deepEqual(esperas, [4000, 10000, 30000, 60000, 60000]);
  assert.deepEqual(guardadas(ctx), ['a'], 'mientras, sigue en el teléfono');
  assert.deepEqual(ctx.servidor.llegadas, []);
  ctx.servidor.modo = 'bien';
  assert.equal(await ctx.reloj.dispara(), 60000);
  assert.deepEqual(ctx.servidor.llegadas, ['a']);
  assert.deepEqual(ctx.reloj.esperasVivas(), [], 'ya no queda nada por reintentar');
});
prueba('al volver la señal no se espera al siguiente reintento: se sube de una vez', async () => {
  const ctx = arma();
  await ctx.cola.usa('ana');
  ctx.servidor.modo = 'sin-senal';
  await ctx.cola.agrega(cosa('a'));
  await vaciaYa(ctx);
  assert.deepEqual(ctx.reloj.esperasVivas(), [4000]);
  ctx.servidor.modo = 'bien';
  await vaciaYa(ctx); // lo que hace `alVolverLaSenal` en la app
  assert.deepEqual(ctx.servidor.llegadas, ['a']);
  assert.deepEqual(ctx.reloj.esperasVivas(), [], 'el reintento que estaba programado se quitó');
});
prueba('sin una sesión válida de esa cuenta no se sube nada (se espera, con las mismas esperas)', async () => {
  const ctx = arma({ sesion: null });
  await ctx.cola.usa('ana');
  await ctx.cola.agrega(cosa('a'));
  await vaciaYa(ctx);
  assert.deepEqual(ctx.servidor.llegadas, []);
  assert.deepEqual(ctx.reloj.esperasVivas(), [4000]);
  ctx.sesion = 'ana';
  await ctx.reloj.dispara();
  assert.deepEqual(ctx.servidor.llegadas, ['a']);
});

seccion('Que no se duplique');
prueba('agregar dos veces la misma (mismo id) no la duplica', async () => {
  const ctx = arma({ sesion: null });
  await ctx.cola.usa('ana');
  assert.equal(await ctx.cola.agrega(cosa('a')), true);
  assert.equal(await ctx.cola.agrega(cosa('a', 'ana', { titulo: 'otra vez' })), true);
  assert.deepEqual(guardadas(ctx), ['a']);
});
prueba('si el servidor la guardó pero la respuesta se perdió, el reintento no hace otra (upsert por id)', async () => {
  const ctx = arma();
  await ctx.cola.usa('ana');
  ctx.servidor.modo = 'pierde-respuesta';
  await ctx.cola.agrega(cosa('a'));
  await vaciaYa(ctx);
  assert.deepEqual(guardadas(ctx), ['a'], 'la cola no sabe que llegó: la conserva');
  await vaciaYa(ctx);
  assert.equal(ctx.servidor.filas.size, 1, 'una sola fila en el servidor');
  assert.deepEqual(ctx.servidor.llegadas, ['a', 'a'], 'llegó dos veces, pero es la misma fila');
  assert.deepEqual(guardadas(ctx), []);
});
prueba('pedir vaciar varias veces a la vez no sube nada dos veces', async () => {
  const ctx = arma();
  await ctx.cola.usa('ana');
  await ctx.cola.agrega(cosa('a'));
  await ctx.cola.agrega(cosa('b'));
  await Promise.all([ctx.cola.vacia(), ctx.cola.vacia(), ctx.cola.vacia()]);
  await vaciaYa(ctx);
  assert.deepEqual(ctx.servidor.llegadas, ['a', 'b']);
});

seccion('Un rechazo no tapa la fila');
prueba('la rechazada se marca y avisa; las demás suben; no se reintenta sola en cada espera', async () => {
  const ctx = arma();
  await ctx.cola.usa('ana');
  ctx.servidor.rechaza.add('a');
  for (const id of ['a', 'b', 'c']) await ctx.cola.agrega(cosa(id));
  await vaciaYa(ctx);
  assert.deepEqual(ctx.servidor.llegadas, ['b', 'c']);
  assert.deepEqual(ctx.rechazos, ['a']);
  const [a] = ctx.cola.foto().cosas;
  assert.equal(a.id, 'a');
  assert.match(a.rechazo.mensaje, /row-level security/);
  assert.deepEqual(guardadas(ctx), ['a'], 'NO se tira: sigue guardada');
  assert.deepEqual(ctx.reloj.esperasVivas(), [], 'un rechazo no programa reintentos');
  await vaciaYa(ctx);
  assert.deepEqual(ctx.rechazos, ['a'], 'otra vuelta normal no la vuelve a intentar');
});
prueba('«Reintentar» sí la vuelve a intentar (y si ya la acepta, sube)', async () => {
  const ctx = arma();
  await ctx.cola.usa('ana');
  ctx.servidor.rechaza.add('a');
  await ctx.cola.agrega(cosa('a'));
  await vaciaYa(ctx);
  ctx.servidor.rechaza.delete('a');
  await ctx.cola.reintenta();
  await vuelta();
  assert.deepEqual(ctx.servidor.llegadas, ['a']);
  assert.deepEqual(guardadas(ctx), []);
});
prueba('al abrir la app, la rechazada se intenta UNA vez más (por si el servidor ya se arregló)', async () => {
  const almacen = almacenFalso();
  const primero = arma({ almacen });
  await primero.cola.usa('ana');
  primero.servidor.rechaza.add('a');
  await primero.cola.agrega(cosa('a'));
  await vaciaYa(primero);
  const otra = arma({ almacen });
  otra.servidor.rechaza.add('a');
  await otra.cola.usa('ana');
  await vaciaYa(otra);
  assert.deepEqual(otra.rechazos, ['a'], 'se intentó al abrir');
  await vaciaYa(otra);
  assert.deepEqual(otra.rechazos, ['a'], 'y no más');
});

seccion('Sobrevive a cerrar la app');
prueba('lo que quedó en la cola sin señal se sube al volver a abrir, en el mismo orden', async () => {
  const almacen = almacenFalso();
  const antes = arma({ almacen });
  await antes.cola.usa('ana');
  antes.servidor.modo = 'sin-senal';
  for (const id of ['a', 'b']) await antes.cola.agrega(cosa(id));
  await vaciaYa(antes);
  antes.cola.detiene(); // «se cerró la app»
  const despues = arma({ almacen });
  await despues.cola.usa('ana');
  await vaciaYa(despues);
  assert.deepEqual(despues.servidor.llegadas, ['a', 'b']);
  assert.deepEqual(guardadas(despues), []);
});
prueba('lo que no se entiende en el teléfono no se pisa: se guarda aparte', async () => {
  const almacen = almacenFalso();
  almacen.datos.set(claveDeLaCola('ana'), JSON.stringify({ v: 99, otra: 'cosa' }));
  const ctx = arma({ almacen });
  await ctx.cola.usa('ana');
  const respaldo = [...almacen.datos.keys()].find((k) => k.startsWith(`${claveDeLaCola('ana')}:respaldo:`));
  assert.ok(respaldo, 'hay respaldo');
  assert.deepEqual(JSON.parse(almacen.datos.get(respaldo)), { v: 99, otra: 'cosa' });
});

seccion('Cada cuenta la suya');
prueba('al cambiar de cuenta, lo de la anterior ni se ve ni se sube con la nueva; vuelve a subir con la suya', async () => {
  const ctx = arma({ sesion: null });
  await ctx.cola.usa('ana');
  await ctx.cola.agrega(cosa('a1', 'ana'));
  // Entra otra persona en el mismo teléfono.
  ctx.sesion = 'beto';
  await ctx.cola.usa('beto');
  assert.deepEqual(ctx.cola.foto().cosas, [], 'beto no ve lo de ana');
  await ctx.cola.agrega(cosa('b1', 'beto'));
  await vaciaYa(ctx);
  assert.deepEqual(ctx.servidor.llegadas, ['b1']);
  assert.equal(ctx.servidor.filas.get('b1').atleta_id, 'beto');
  assert.deepEqual(guardadas(ctx, 'ana'), ['a1'], 'lo de ana sigue en SU llave');
  // Ana vuelve.
  ctx.sesion = 'ana';
  await ctx.cola.usa('ana');
  await vaciaYa(ctx);
  assert.deepEqual(ctx.servidor.llegadas, ['b1', 'a1']);
  assert.equal(ctx.servidor.filas.get('a1').atleta_id, 'ana');
});
prueba('con la sesión de otra cuenta no se sube lo de esta (aunque la cola sea de esta)', async () => {
  const ctx = arma({ sesion: 'beto' });
  await ctx.cola.usa('ana');
  await ctx.cola.agrega(cosa('a1', 'ana'));
  await vaciaYa(ctx);
  assert.deepEqual(ctx.servidor.llegadas, []);
});
prueba('algo de otra cuenta (p. ej. lo que llega del reloj de quien salió) va a SU llave, no a la de quien está', async () => {
  const ctx = arma({ sesion: 'beto' });
  await ctx.cola.usa('beto');
  assert.equal(await ctx.cola.agrega(cosa('a9', 'ana')), true);
  assert.deepEqual(ctx.cola.foto().cosas, []);
  assert.deepEqual(guardadas(ctx, 'ana'), ['a9']);
  await vaciaYa(ctx);
  assert.deepEqual(ctx.servidor.llegadas, []);
});

seccion('Lo que la persona cambia antes de que suba');
prueba('cambiar o quitar una que no ha subido lo hace en la cola', async () => {
  const ctx = arma({ sesion: null });
  await ctx.cola.usa('ana');
  await ctx.cola.agrega(cosa('a', 'ana', { titulo: 'Correr' }));
  await ctx.cola.agrega(cosa('b'));
  assert.equal(await ctx.cola.cambia('a', (d) => ({ ...d, titulo: 'Trote' })), true);
  assert.equal(await ctx.cola.quita('b'), true);
  ctx.sesion = 'ana';
  await vaciaYa(ctx);
  assert.deepEqual(ctx.servidor.llegadas, ['a']);
  assert.equal(ctx.servidor.filas.get('a').titulo, 'Trote');
  assert.equal(await ctx.cola.quita('a'), false, 'ya subió: se borra en el servidor');
});
prueba('cómo le fue: «subida» con lo que devolvió el servidor, o «sin-senal»', async () => {
  const ctx = arma();
  await ctx.cola.usa('ana');
  const r1 = ctx.cola.resultadoDe('a', 5000);
  await ctx.cola.agrega(cosa('a'));
  await vaciaYa(ctx);
  assert.deepEqual(await r1, { estado: 'subida', resultado: { titulo: 'a', id: 'a', atleta_id: 'ana' } });
  ctx.servidor.modo = 'sin-senal';
  const r2 = ctx.cola.resultadoDe('b', 5000);
  await ctx.cola.agrega(cosa('b'));
  await vaciaYa(ctx);
  assert.deepEqual(await r2, { estado: 'sin-senal' });
});

for (const [nombre, f] of pruebas) {
  if (nombre === null) { console.log(f); continue; }
  await f();
  n += 1;
  console.log(`  ✓ ${nombre}`);
}
console.log(`\n✓ ${n} pruebas de la cola`);
