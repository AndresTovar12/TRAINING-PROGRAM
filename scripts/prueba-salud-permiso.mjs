/* ¿Quedó conectada Apple Salud? (`src/lib/saludPermiso.js`, 26 nov 2026: «No pudimos leer nada» con todo encendido). Plugin falso: cada caso dice qué
   contesta `checkAuthorization` y qué trae cada lectura. */
import assert from 'node:assert/strict';
import { conFallo, filaDeDiagnostico, revisaPermisoCon, versionDeIos } from '../src/lib/saludPermiso.js';

/** `escribir`: 'si' | 'no' | 'falla' | 'sinWorkouts' (listas sin 'workouts') | 'sinListas' (un objeto sin listas). `trae`: { steps: n, heartRate: n, … } (cuántas muestras); `fallan`: tipos que lanzan error. */
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
    checkAuthorization: () => {
      if (escribir === 'falla') return Promise.reject(new Error('HealthKit no disponible'));
      if (escribir === 'sinListas') return Promise.resolve({ readAuthorized: [] });
      if (escribir === 'sinWorkouts') return Promise.resolve({ writeAuthorized: ['heartRate'], writeDenied: ['calories'] });
      return Promise.resolve({ writeAuthorized: escribir === 'si' ? ['workouts'] : [], writeDenied: escribir === 'si' ? [] : ['workouts'] });
    },
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

// El permiso va en positivo: una respuesta sin 'workouts' en ninguna lista (o sin listas) NO es «dio permiso»: es «no se pudo revisar».
for (const escribir of ['sinWorkouts', 'sinListas']) {
  const r = await revisaPermisoCon(pluginFalso({ escribir, trae: { steps: 3 } }));
  assert.equal(r.ok, false, `${escribir} → no conectado`);
  assert.equal(r.noSePudoRevisar, true, `${escribir} → no se pudo revisar`);
  assert.deepEqual(r.errores, ['checkAuthorization: respuesta sin workouts']);
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
  assert.deepEqual({ ...f, detalle: null }, { usuario_id: 'u1', donde: 'inicio', ios: '18.1', app: null, reloj_emparejado: true, escribe: 'dado', primero: 'pulso', errores: 'steps: steps roto', detalle: null });
  assert.equal(filaDeDiagnostico(r, { usuarioId: 'u1', app: '1.0 (115)' }).app, '1.0 (115)');
  assert.deepEqual(filaDeDiagnostico({ ...r, estado: { mucho: 'x'.repeat(5000) } }, { usuarioId: 'u1' }).detalle, { recortado: true }, 'detalle enorme → recortado (tope de la tabla)');
  const g = filaDeDiagnostico(await revisaPermisoCon(pluginFalso({ escribir: 'falla' })), { usuarioId: 'u1', reloj: { emparejado: false, sinRespuesta: true } });
  assert.equal(g.escribe, 'no_se_pudo_revisar');
  assert.equal(g.primero, 'ninguno');
  assert.equal(g.reloj_emparejado, null, 'si el reloj no contestó, no se sabe');
}

// Se cayó a medio camino (`pideSalud` o `conectaEnLaCuenta` lanzaron error): también deja fila.
{
  // Sin resultado de la revisión (falló la hoja del iPhone): «no se pudo revisar», sin datos, y el error con su etapa.
  const f = filaDeDiagnostico(conFallo(null, 'pideSalud', new Error('Authorization not determined')), { usuarioId: 'u1' });
  assert.equal(f.escribe, 'no_se_pudo_revisar');
  assert.equal(f.primero, 'ninguno');
  assert.equal(f.errores, 'pideSalud: Authorization not determined');
  // Ya se tenía la revisión (dio permiso, leyó pulso) y falló guardar: se conserva y solo se agrega el error.
  const r = await revisaPermisoCon(pluginFalso({ trae: { heartRate: 1 }, fallan: ['steps'] }));
  const g = filaDeDiagnostico(conFallo(r, 'conectaEnLaCuenta', new Error('Failed to fetch')), { usuarioId: 'u1' });
  assert.equal(g.escribe, 'dado');
  assert.equal(g.primero, 'pulso');
  assert.equal(g.errores, 'steps: steps roto\nconectaEnLaCuenta: Failed to fetch');
  assert.equal(r.errores.length, 1, 'conFallo no cambia el resultado original');
}

console.log('prueba-salud-permiso: todo bien');
