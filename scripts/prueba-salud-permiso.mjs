/* ¿Quedó conectada Apple Salud? (`src/lib/saludPermiso.js`, 26 nov 2026: «No pudimos leer nada» con todo encendido). Plugin falso: cada caso dice qué
   contesta `checkAuthorization` y qué trae cada lectura. */
import assert from 'node:assert/strict';
import { filaDeDiagnostico, revisaPermisoCon, versionDeIos } from '../src/lib/saludPermiso.js';

/** `escribir`: 'si' | 'no' | 'falla'. `trae`: { steps: n, heartRate: n, … } (cuántas muestras); `fallan`: tipos que lanzan error. */
function pluginFalso({ escribir = 'si', trae = {}, fallan = [] } = {}) {
  const pedidos = [];
  const lee = (tipo) => {
    pedidos.push(tipo);
    if (fallan.includes(tipo)) return Promise.reject(new Error(`${tipo} roto`));
    const n = trae[tipo] ?? 0;
    return Promise.resolve(Array.from({ length: n }, (_, i) => ({ i })));
  };
  return {
    pedidos,
    checkAuthorization: () => (escribir === 'falla' ? Promise.reject(new Error('HealthKit no disponible'))
      : Promise.resolve({ writeAuthorized: escribir === 'si' ? ['workouts'] : [], writeDenied: escribir === 'si' ? [] : ['workouts'] })),
    readSamples: ({ dataType }) => lee(dataType).then((samples) => ({ samples })),
    queryWorkouts: () => lee('workouts').then((workouts) => ({ workouts })),
  };
}

// Escribe, sin pasos pero con pulso: se conecta y dice que lo primero que leyó fue el pulso (ya no se queda en los pasos).
{
  const h = pluginFalso({ trae: { heartRate: 3 } });
  const r = await revisaPermisoCon(h, { ahora: Date.parse('2026-11-26T12:00:00Z') });
  assert.equal(r.ok, true, 'escribe + pulso → conectado');
  assert.equal(r.lee, true);
  assert.equal(r.primero, 'heartRate');
  assert.equal(r.sinDatos, false);
  assert.deepEqual(h.pedidos, ['steps', 'heartRate'], 'para en el primero que trae algo');
}

// Escribe y no hay NADA: se conecta igual («sin datos»), probó los cuatro.
{
  const h = pluginFalso();
  const r = await revisaPermisoCon(h);
  assert.equal(r.ok, true, 'escribe sin datos → conectado');
  assert.equal(r.sinDatos, true);
  assert.equal(r.primero, null);
  assert.deepEqual(h.pedidos, ['steps', 'heartRate', 'sleep', 'workouts']);
}

// Negó escribir: no se conecta (aquí sí «No pudimos leer nada»), aunque haya pasos.
{
  const r = await revisaPermisoCon(pluginFalso({ escribir: 'no', trae: { steps: 5 } }));
  assert.equal(r.ok, false, 'sin permiso de escribir → no');
  assert.equal(r.noSePudoRevisar, false, 'negó: no es un error');
}

// checkAuthorization falla con error: «No se pudo revisar», no «sin permiso»; el error queda escrito.
{
  const r = await revisaPermisoCon(pluginFalso({ escribir: 'falla', trae: { steps: 1 } }));
  assert.equal(r.ok, false);
  assert.equal(r.noSePudoRevisar, true, 'error al revisar → no se pudo revisar');
  assert.match(r.errores[0], /checkAuthorization: HealthKit no disponible/);
}

// Una lectura que falla no tumba la revisión: sigue con la siguiente y el error se anota.
{
  const r = await revisaPermisoCon(pluginFalso({ trae: { sleep: 2 }, fallan: ['steps'] }));
  assert.equal(r.ok, true);
  assert.equal(r.primero, 'sleep');
  assert.deepEqual(r.errores, ['steps: steps roto']);
}

// Solo entrenos (un reloj nuevo que aún no suma pasos ni sueño): cuenta.
{
  const r = await revisaPermisoCon(pluginFalso({ trae: { workouts: 1 } }));
  assert.equal(r.primero, 'workouts');
}

// El diagnóstico de cada intento.
{
  assert.equal(versionDeIos('Mozilla/5.0 (iPhone; CPU iPhone OS 18_1_1 like Mac OS X) AppleWebKit/605.1.15'), '18.1.1');
  assert.equal(versionDeIos('Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X)'), '17.5');
  assert.equal(versionDeIos('Mozilla/5.0 (Macintosh)'), null);
  const r = await revisaPermisoCon(pluginFalso({ trae: { heartRate: 1 }, fallan: ['steps'] }));
  const f = filaDeDiagnostico(r, { usuarioId: 'u1', donde: 'inicio', ios: '18.1', reloj: { emparejado: true, instalada: true } });
  assert.deepEqual({ ...f, detalle: null }, { usuario_id: 'u1', donde: 'inicio', ios: '18.1', reloj_emparejado: true, escribe: 'dado', primero: 'pulso', errores: 'steps: steps roto', detalle: null });
  const g = filaDeDiagnostico(await revisaPermisoCon(pluginFalso({ escribir: 'falla' })), { usuarioId: 'u1', reloj: { emparejado: false, sinRespuesta: true } });
  assert.equal(g.escribe, 'no_se_pudo_revisar');
  assert.equal(g.primero, 'ninguno');
  assert.equal(g.reloj_emparejado, null, 'si el reloj no contestó, no se sabe');
}

console.log('prueba-salud-permiso: todo bien');
