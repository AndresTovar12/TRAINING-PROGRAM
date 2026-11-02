/* EL MARCADOR AL ABRIR LA APP (2 nov 2026): `node scripts/prueba-marcador-al-abrir.mjs`.

   QUÉ PASÓ. Al atleta Andrés la app de iPhone (build 75/76) le guardó «Fase 1 · Semana 1» con motivo 'nuevo' encima de «Fase 4 · Semana 6», al abrir y otra vez al
   volver a la app. La carrera, medida en WebKit con la app de verdad y un Supabase falso (1 de cada 3 aperturas con la copia del teléfono):
     1. La app abre. El plan llega (de la red o de la copia del teléfono) ANTES que el estado (`user_app_state`): para leerlo, primero se lee la copia del
        teléfono y luego la base.
     2. React dibuja con el plan listo y el estado sin cargar: `useStorage('wr:cursor')` da su valor por defecto (null). Y `confirmado` era verdadero (solo
        decía «no es la copia»), así que el efecto del marcador sacó «no hay marcador → el primero del plan» ('nuevo').
     3. Ese efecto corre DESPUÉS de dibujar. Si en medio llega la base (`setStore(fresco)` cambia el almacén en el acto), el efecto escribe su 'nuevo', sacado
        de la pantalla vieja, ENCIMA del estado recién leído. Ya cargado, la diferencia contra la base es ese marcador, y se sube.
   Antes del 1 nov el estado vivía en `useState` y la escritura del efecto se perdía igual al cargar; con el almacén que cambia en el acto (`AppStateContext`,
   «SIEMPRE JUNTOS») y la copia del plan (el plan llega antes), la ventana quedó abierta.

   CÓMO SE PRUEBA. Con el `AppStateContext` y el `useMarcadorAlDia` DE VERDAD (cargados con Vite, como en la app), React de verdad sobre un DOM mínimo, y una base
   falsa que contesta cuando la prueba dice. Así se fuerza el orden exacto: el plan se dibuja, y la base contesta antes de que corran los efectos. */
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
let pasos = 0;
const paso = (t) => { pasos += 1; console.log(`  ✓ ${t}`); };
const turno = () => new Promise((r) => { setImmediate(r); });
const espera = (ms) => new Promise((r) => { setTimeout(r, ms); });

/* ---------------- Un DOM mínimo: los componentes de la prueba no dibujan nada, solo usan el estado ---------------- */
const almacen = new Map();
const nadaQueEscuchar = { addEventListener() {}, removeEventListener() {} };
const pon = (nombre, valor) => Object.defineProperty(globalThis, nombre, { value: valor, configurable: true, writable: true });
pon('window', globalThis);
pon('__tlPruebaSinConexion', true); // la copia del teléfono en «localStorage» (la puerta de prueba de `almacenDelTelefono`; solo con Vite en desarrollo)
pon('localStorage', {
  getItem: (k) => (almacen.has(k) ? almacen.get(k) : null),
  setItem: (k, v) => { almacen.set(k, String(v)); },
  removeItem: (k) => { almacen.delete(k); },
  key: (i) => [...almacen.keys()][i] ?? null,
  get length() { return almacen.size; },
});
pon('addEventListener', () => {});
pon('removeEventListener', () => {});
pon('dispatchEvent', () => true);
pon('HTMLIFrameElement', class HTMLIFrameElement {}); // React lo pregunta al guardar la selección
const documento = Object.assign(new EventTarget(), { visibilityState: 'visible', hidden: false, activeElement: null, body: null });
pon('document', documento);
/** Irse de la app y volver (lo que hace el iPhone al cambiar de app): `visibilitychange` con `hidden` y luego con `visible`. */
const vuelveALaApp = () => {
  for (const v of ['hidden', 'visible']) { documento.visibilityState = v; documento.hidden = v === 'hidden'; documento.dispatchEvent(new Event('visibilitychange')); }
};
const contenedor = { nodeType: 1, nodeName: 'DIV', tagName: 'DIV', namespaceURI: 'http://www.w3.org/1999/xhtml', ownerDocument: globalThis.document, textContent: '', ...nadaQueEscuchar, removeChild() {}, appendChild() {} };

/* ---------------- La base falsa: cada lectura espera a que la prueba la suelte ---------------- */
const ANA = '00000000-0000-4000-8000-0000000000a1';
const base = { estado: {}, subidas: [], lecturas: [] };
globalThis.__cuentaFalsa = ANA;
globalThis.__baseFalsa = {
  lee(tabla) {
    if (tabla !== 'user_app_state') return Promise.resolve({ data: null, error: null, status: 200 });
    return new Promise((listo) => { base.lecturas.push(() => listo({ data: { data: structuredClone(base.estado) }, error: null, status: 200 })); });
  },
  async rpc(fn, args) {
    if (fn !== 'mezclar_mi_estado') return { data: null, error: null, status: 200 };
    base.subidas.push(structuredClone(args.p_cambios));
    base.estado = aplicarParche(base.estado, args.p_cambios);
    return { data: null, error: null, status: 204 };
  },
};
const sueltaTodas = () => { while (base.lecturas.length) base.lecturas.shift()(); };
/** Espera `ms` contestando cada lectura que la app pida (la primera de cada apertura la suelta la prueba a mano, cuando quiere). */
const esperaContestando = async (ms) => { const fin = Date.now() + ms; while (Date.now() < fin) { await espera(20); sueltaTodas(); } };
const sueltaLectura = () => { const f = base.lecturas.shift(); assert.ok(f, 'había una lectura de la base esperando'); f(); };

/* ---------------- La app (los módulos de verdad, con Vite) ---------------- */
const vite = await createServer({
  configFile: false, root: RAIZ, logLevel: 'error', appType: 'custom',
  server: { middlewareMode: true, hmr: false, watch: null },
  optimizeDeps: { noDiscovery: true, include: [] },
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: [
      { find: '@/lib/supabase', replacement: path.join(RAIZ, 'scripts/falsos/app-supabase.js') },
      { find: '@/contexts/VistaContext', replacement: path.join(RAIZ, 'scripts/falsos/app-vista.js') },
      { find: '@', replacement: path.join(RAIZ, 'src') },
    ],
  },
});
const React = await import('react');
const { createRoot } = await import('react-dom/client');
const { aplicarParche } = await vite.ssrLoadModule('/src/lib/estadoPorPartes.js');
const { AppStateProvider, useAppState } = await vite.ssrLoadModule('/src/contexts/AppStateContext.jsx');
const { useMarcadorAlDia } = await vite.ssrLoadModule('/src/features/training/useMarcadorAlDia.js');
const { isoWeekKey } = await vite.ssrLoadModule('/src/lib/training-utils.js');
const { claveDelEstado } = await vite.ssrLoadModule('/src/lib/copiaDelEstado.js');
const h = React.createElement;

/* El plan del atleta (4 fases de 6 semanas) y su marcador en «Fase 3 · Semana 4», sellado esta semana (el calendario no lo mueve). */
const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const PLAN = ['f1', 'f2', 'f3', 'f4'].map((id, i) => ({
  id, name: `Fase ${i + 1}`,
  weekData: [1, 2, 3, 4, 5, 6].map((num) => ({ num, days: DIAS.map((day) => ({ day, name: `Fuerza ${id}`, cat: 'gym', exercises: [{ name: 'Sentadilla', sets: '3', reps: '5' }] })) })),
}));
const HOY = new Date();
const MARCADOR = { phaseId: 'f3', weekNum: 4, dayIdx: 0, fijadoEn: isoWeekKey(HOY), planFases: ['f1', 'f2', 'f3', 'f4'], pos: 15, motivo: 'calendario' };

/* Lo que la pantalla tiene del plan: vacío y «cargando» hasta que la prueba lo suelta (como `PlanProvider`). */
let ponPlan = () => {};
let alDibujarElPlan = null;
let vivo = null; // el estado de la app ({ store, setStore }), para escribir como lo haría una pantalla
function Marcador() {
  vivo = useAppState();
  const [plan, setPlan] = React.useState({ PLAN: [], planLoading: true });
  ponPlan = setPlan;
  // Lo que la prueba quiera hacer justo al DIBUJAR el plan (antes de que corran los efectos de ese dibujo): ahí llega la base en la carrera.
  React.useLayoutEffect(() => {
    if (!plan.PLAN.length || !alDibujarElPlan) return;
    const f = alDibujarElPlan;
    alDibujarElPlan = null;
    f();
  }, [plan]);
  useMarcadorAlDia({ PLAN: plan.PLAN, planLoading: plan.planLoading, kind: 'periodized', clave: 'wr:cursor', hoy: HOY, soloLectura: false });
  return null;
}

/** Abre la app. `conCopia`: con la copia del teléfono de la vez pasada (la base de entonces y `pendiente` encima). `enLaBase`: lo que la base tiene AHORA (si
    otro aparato la cambió desde esa copia). */
async function abre({ conCopia, pendiente = null, enLaBase = null, copiaCreia = null }) {
  const deEntonces = copiaCreia ?? { 'wr:cursor': structuredClone(MARCADOR), 'wr:onerm': { sentadilla: 100 } };
  base.estado = structuredClone(enLaBase ?? deEntonces);
  base.subidas = [];
  base.lecturas = [];
  almacen.clear();
  // La copia del teléfono de la vez pasada (así se abre la app de iPhone con señal).
  if (conCopia) almacen.set(`tl-prueba:${claveDelEstado(ANA)}`, JSON.stringify({ v: 1, enLaBase: deEntonces, pendiente, en: Date.now() }));
  const raiz = createRoot(contenedor, { onUncaughtError: (e) => { console.log('Error de React:', e?.stack ?? e); process.exit(1); } });
  raiz.render(h(AppStateProvider, null, h(Marcador)));
  for (let i = 0; i < 30 && !base.lecturas.length; i += 1) await turno(); // la copia del teléfono se lee primero; luego se pide la base
  assert.equal(base.lecturas.length, 1, 'la app pidió su estado a la base');
  return raiz;
}
const marcadoresSubidos = () => base.subidas.filter((s) => s['wr:cursor']).map((s) => s['wr:cursor']);

try {
  for (const conCopia of [true, false]) {
    const donde = conCopia ? 'app de iPhone (con copia)' : 'web (sin copia)';

    /* 1 · LA CARRERA: el plan se dibuja y, antes de que corran los efectos de ese dibujo, llega la base. */
    let raiz = await abre({ conCopia });
    alDibujarElPlan = sueltaLectura; // la base contesta en el dibujo del plan: antes de que React corra sus efectos
    ponPlan({ PLAN, planLoading: false });
    await esperaContestando(1500); // el guardado espera 600 ms
    assert.deepEqual(marcadoresSubidos().map((c) => `${c.phaseId}/${c.weekNum} ${c.motivo}`), [], `${donde}: no se sube ningún marcador`);
    assert.equal(base.estado['wr:cursor'].phaseId, 'f3', `${donde}: la base sigue en la fase 3`);
    assert.equal(base.estado['wr:cursor'].weekNum, 4, `${donde}: y en la semana 4`);
    raiz.unmount();
    await turno();
    paso(`${donde}: el plan llega antes que el estado y la base contesta en medio → el marcador no se pisa con «Fase 1 · Semana 1»`);

    /* 2 · El orden de siempre: el plan llega y sus efectos corren antes que la base. */
    raiz = await abre({ conCopia });
    ponPlan({ PLAN, planLoading: false });
    for (let i = 0; i < 10; i += 1) await turno();
    sueltaLectura();
    await esperaContestando(1500);
    assert.deepEqual(marcadoresSubidos(), [], `${donde}: tampoco con el orden de siempre`);
    raiz.unmount();
    await turno();
    paso(`${donde}: con el plan antes y la base después (sin carrera), tampoco`);

    /* 3 · La base llega primero y luego el plan: el marcador de la base se usa tal cual. */
    raiz = await abre({ conCopia });
    sueltaLectura();
    await espera(50);
    ponPlan({ PLAN, planLoading: false });
    await esperaContestando(1500);
    assert.deepEqual(marcadoresSubidos(), [], `${donde}: con la base antes que el plan, nada que subir`);
    raiz.unmount();
    await turno();
    paso(`${donde}: con la base antes que el plan, el marcador se queda`);
  }

  /* 4 · Una cuenta nueva (sin marcador en la base) sí recibe su primer marcador: el arreglo no lo frena. */
  let raiz = await abre({ conCopia: true });
  base.estado = {};
  alDibujarElPlan = sueltaLectura;
  ponPlan({ PLAN, planLoading: false });
  await esperaContestando(1500);
  assert.deepEqual(marcadoresSubidos().map((c) => `${c.phaseId}/${c.weekNum} ${c.motivo}`), ['f1/1 nuevo'], 'sin marcador en la base, se guarda el primero del plan (una vez)');
  raiz.unmount();
  await turno();
  paso('una cuenta sin marcador recibe «Fase 1 · Semana 1» (motivo «nuevo»), una sola vez');

  /* 5 · La copia del teléfono traía un marcador que la app adelantó sola (y no se subió), pero su coach lo movió en la base mientras tanto: gana la base. */
  const DEL_COACH = { ...MARCADOR, phaseId: 'f2', weekNum: 2, pos: 7, motivo: 'coach' };
  const conCoach = { 'wr:cursor': DEL_COACH, 'wr:onerm': { sentadilla: 100 } };
  raiz = await abre({ conCopia: true, pendiente: { 'wr:cursor': { ...MARCADOR, weekNum: 5, pos: 16, motivo: 'calendario' } }, enLaBase: conCoach });
  ponPlan({ PLAN, planLoading: false });
  await turno();
  sueltaLectura();
  await esperaContestando(1500);
  assert.deepEqual(marcadoresSubidos(), [], 'el marcador viejo del teléfono no se sube');
  assert.deepEqual(base.estado['wr:cursor'], DEL_COACH, 'el de su coach se queda en la base');
  assert.deepEqual(vivo.store['wr:cursor'], DEL_COACH, 'y es el que se ve');
  raiz.unmount();
  await turno();
  paso('al abrir, lo que la app adelantó sola en el teléfono no pisa el marcador que su coach movió en la base');

  /* 5b · Lo que la PERSONA movió a mano en el teléfono sí se sube (gana el último que llega, como todo lo suyo). */
  const AMANO = { ...MARCADOR, phaseId: 'f4', weekNum: 1, pos: 18, motivo: 'atleta' };
  raiz = await abre({ conCopia: true, pendiente: { 'wr:cursor': AMANO } });
  ponPlan({ PLAN, planLoading: false });
  await turno();
  sueltaLectura();
  await esperaContestando(1500);
  assert.deepEqual(marcadoresSubidos().map((c) => `${c.phaseId}/${c.weekNum} ${c.motivo}`), ['f4/1 atleta'], 'lo que movió a mano se sube');
  raiz.unmount();
  await turno();
  paso('lo que la persona movió a mano en el teléfono sí se sube');

  /* 6 · Con la app abierta: la app adelanta el marcador sola, su coach lo mueve en la base y la persona vuelve a la app antes de que se suba. Gana la base. */
  raiz = await abre({ conCopia: true });
  ponPlan({ PLAN, planLoading: false });
  await turno();
  sueltaLectura();
  await esperaContestando(1500);
  base.estado = aplicarParche(base.estado, { 'wr:cursor': DEL_COACH });
  vivo.setStore((prev) => ({ ...prev, 'wr:cursor': { ...MARCADOR, weekNum: 5, pos: 16, motivo: 'calendario' } }));
  vuelveALaApp();
  for (let i = 0; i < 60; i += 1) { await turno(); sueltaTodas(); }
  await esperaContestando(1500);
  sueltaTodas();
  assert.deepEqual(marcadoresSubidos(), [], 'el marcador que se movió solo no se sube encima del de su coach');
  assert.deepEqual(base.estado['wr:cursor'], DEL_COACH, 'la base se queda con el de su coach');
  assert.deepEqual(vivo.store['wr:cursor'], DEL_COACH, 'y la pantalla también');
  raiz.unmount();
  await turno();
  paso('al volver a la app, el marcador que la app movió sola no se reimpone sobre el de la base');

  /* 7 · La misma regla que la base (`marcador_nuevo_no_pisa`): un marcador 'nuevo' nunca se sube encima de uno con fase, venga de donde venga. */
  raiz = await abre({ conCopia: false });
  ponPlan({ PLAN, planLoading: false });
  await turno();
  sueltaLectura();
  await esperaContestando(1500);
  vivo.setStore((prev) => ({ ...prev, 'wr:cursor': { phaseId: 'f1', weekNum: 1, dayIdx: 0, fijadoEn: isoWeekKey(HOY), planFases: ['f1', 'f2', 'f3', 'f4'], pos: 0, motivo: 'nuevo' } }));
  await esperaContestando(1500);
  assert.deepEqual(marcadoresSubidos(), [], "un 'nuevo' no se sube encima de un marcador con fase");
  assert.equal(vivo.store['wr:cursor'].phaseId, 'f3', 'la pantalla vuelve al marcador de la base');
  assert.equal(base.estado['wr:cursor'].weekNum, 4);
  raiz.unmount();
  await turno();
  paso("un marcador 'nuevo' nunca se sube encima de uno con fase: la pantalla vuelve al de la base");

  /* 8 · SANAR UN TELÉFONO QUE YA TIENE LA COPIA MALA (lo de Andrés el 2 nov 2026). La app vieja subió su 'nuevo'; la base lo rechazó (`marcador_nuevo_no_pisa`)
     pero el teléfono no se enteró: su copia cree que la base tiene «Fase 1 · Semana 1» (y a veces lo tiene además como pendiente). Al abrir con la app nueva,
     y aunque se repita la carrera del arranque, gana la base sin que la persona haga nada. */
  const MALO = { phaseId: 'f1', weekNum: 1, dayIdx: 0, fijadoEn: isoWeekKey(HOY), planFases: ['f1', 'f2', 'f3', 'f4'], pos: 0, motivo: 'nuevo' };
  const conElMalo = { 'wr:cursor': MALO, 'wr:onerm': { sentadilla: 100 } };
  const deVerdad = { 'wr:cursor': structuredClone(MARCADOR), 'wr:onerm': { sentadilla: 100 } };
  for (const [que, pendiente] of [['sin pendiente', null], ["con el 'nuevo' como pendiente", { 'wr:cursor': MALO }]]) {
    raiz = await abre({ conCopia: true, copiaCreia: conElMalo, pendiente, enLaBase: deVerdad });
    alDibujarElPlan = sueltaLectura;
    ponPlan({ PLAN, planLoading: false });
    await esperaContestando(1500);
    sueltaTodas();
    await espera(200);
    assert.deepEqual(marcadoresSubidos(), [], `copia mala ${que}: no se sube ningún marcador`);
    assert.deepEqual(vivo.store['wr:cursor'], MARCADOR, `copia mala ${que}: se ve el marcador de la base`);
    const copia = JSON.parse(almacen.get(`tl-prueba:${claveDelEstado(ANA)}`));
    assert.deepEqual(copia.enLaBase['wr:cursor'], MARCADOR, `copia mala ${que}: la copia del teléfono queda sana`);
    assert.equal(copia.pendiente, null, `copia mala ${que}: sin nada pendiente`);
    raiz.unmount();
    await turno();
    paso(`un teléfono con la copia mala (${que}) sana solo al abrir: se ve y se guarda el marcador de la base`);
  }

  console.log(`\n✓ ${pasos} pruebas del marcador al abrir la app`);
} finally {
  await vite.close();
}
process.exit(0);
