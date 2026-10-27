/* Pruebas de lo puro del mapa nativo de Apple: `node scripts/prueba-mapa-nativo.mjs`. Sin teléfono, sin red. */
import assert from 'node:assert/strict';
import {
  ANGULO_3D, CENTRO_SIN_DATOS, MAX_PUNTOS_RUTA, MINIMO_ENCUADRE_GRADOS, ZOOM_INICIAL, ZOOM_SIGUE, ZOOM_SIN_DATOS,
  adelgazaRuta, metrosEntre, rumboDeRuta, diferenciaDeRumbo, suavizaRumbo, claveDeRuta, conTiempoLimite, creaFila, encuadre, inicioDelMapa, planDeEnvio, puntosDeMuestras, ubicacionGuardada, usaMapaNativo,
} from '../src/lib/mapaNativo.js';

let n = 0;
const prueba = async (nombre, f) => { await f(); n += 1; console.log(`  ✓ ${nombre}`); };

console.log('Muestras → puntos');
await prueba('convierte lon en lng y descarta lo que no es coordenada', () => {
  const p = puntosDeMuestras([{ lat: 21.1, lon: -86.8, t: 1 }, { lat: null, lon: 3 }, { lat: 95, lon: 0 }, { lat: 1, lon: 181 }, null, { lat: NaN, lon: 1 }, { lat: 21.2, lon: -86.9 }]);
  assert.deepEqual(p, [{ lat: 21.1, lng: -86.8 }, { lat: 21.2, lng: -86.9 }]);
  assert.deepEqual(puntosDeMuestras(undefined), []);
});
await prueba('adelgazar: pocas se quedan igual; muchas se reducen y conservan el primero y el último', () => {
  const pocas = Array.from({ length: 50 }, (_, i) => ({ lat: i, lng: i }));
  assert.equal(adelgazaRuta(pocas), pocas);
  const muchas = Array.from({ length: 5000 }, (_, i) => ({ lat: i / 1000, lng: i / 1000 }));
  const a = adelgazaRuta(muchas);
  assert.equal(a.length, MAX_PUNTOS_RUTA);
  assert.deepEqual(a[0], muchas[0]);
  assert.deepEqual(a.at(-1), muchas.at(-1));
  for (let i = 1; i < a.length; i += 1) assert.ok(a[i].lat >= a[i - 1].lat, 'el orden de la ruta se conserva');
});

console.log('Dónde abre el mapa');
await prueba('ubicación guardada: lee el texto de localStorage o regresa null', () => {
  assert.deepEqual(ubicacionGuardada('{"lat":21.16,"lon":-86.85,"t":5}'), { lat: 21.16, lng: -86.85 });
  assert.equal(ubicacionGuardada(null), null);
  assert.equal(ubicacionGuardada('basura{'), null);
  assert.equal(ubicacionGuardada('{"lat":"x","lon":1}'), null);
});
await prueba('primero la ruta, luego lo guardado, y solo sin nada todo México (nunca el Zócalo)', () => {
  const ruta = [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }];
  assert.deepEqual(inicioDelMapa(ruta, { lat: 9, lng: 9 }), { centro: { lat: 3, lng: 4 }, zoom: ZOOM_INICIAL, conocido: true });
  assert.deepEqual(inicioDelMapa([], { lat: 9, lng: 8 }), { centro: { lat: 9, lng: 8 }, zoom: ZOOM_INICIAL, conocido: true });
  assert.equal(inicioDelMapa(ruta, null, ZOOM_SIGUE).zoom, ZOOM_SIGUE, 'siguiendo al corredor abre más cerca');
  assert.ok(ZOOM_SIGUE >= 18 && ZOOM_SIGUE <= 19.5 && ANGULO_3D === 45);
  const nada = inicioDelMapa([], null);
  assert.deepEqual(nada, { centro: CENTRO_SIN_DATOS, zoom: ZOOM_SIN_DATOS, conocido: false });
  assert.notDeepEqual(nada.centro, { lat: 19.43, lng: -99.13 });
});

console.log('Encuadre del resumen');
await prueba('sin puntos nada; un punto se centra; varios dan una caja con margen mínimo', () => {
  assert.equal(encuadre([]), null);
  assert.deepEqual(encuadre([{ lat: 5, lng: 6 }]), { tipo: 'punto', centro: { lat: 5, lng: 6 } });
  const corta = encuadre([{ lat: 21.1600, lng: -86.8500 }, { lat: 21.1601, lng: -86.8501 }]);
  assert.equal(corta.tipo, 'caja');
  assert.ok(corta.northeast.lat - corta.southwest.lat >= MINIMO_ENCUADRE_GRADOS - 1e-12, 'una ruta cortita no se acerca de más');
  assert.ok(corta.northeast.lng - corta.southwest.lng >= MINIMO_ENCUADRE_GRADOS - 1e-12);
  const larga = encuadre([{ lat: 21.0, lng: -86.9 }, { lat: 21.2, lng: -86.7 }, { lat: 21.1, lng: -86.8 }]);
  assert.deepEqual(larga.southwest, { lat: 21.0, lng: -86.9 });
  assert.ok(Math.abs(larga.northeast.lat - 21.2) < 1e-9 && Math.abs(larga.northeast.lng + 86.7) < 1e-9);
  assert.ok(Math.abs(larga.centro.lat - 21.1) < 1e-9);
});

console.log('Cuándo mandar la ruta');
await prueba('si nada cambió no se manda; si cambió y pasó un segundo, ahora; si no, se espera lo que falta', () => {
  const k1 = claveDeRuta([{ lat: 1, lng: 1 }], true);
  const k2 = claveDeRuta([{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }], true);
  assert.notEqual(k1, k2);
  assert.notEqual(claveDeRuta([{ lat: 1, lng: 1 }], true), claveDeRuta([{ lat: 1, lng: 1 }], false), 'cambiar de seguir a encuadrar también cuenta');
  assert.notEqual(claveDeRuta([{ lat: 1, lng: 1 }], true), claveDeRuta([{ lat: 1, lng: 2 }], true), 'el mismo número de puntos pero otro lugar también cuenta');
  assert.equal(planDeEnvio({ ahora: 5000, ultimoEnvioMs: 0, claveActual: k1, claveEnviada: k1 }).accion, 'nada');
  assert.equal(planDeEnvio({ ahora: 5000, ultimoEnvioMs: 0, claveActual: k2, claveEnviada: k1 }).accion, 'ahora');
  assert.equal(planDeEnvio({ ahora: 5000, ultimoEnvioMs: 4000, claveActual: k2, claveEnviada: k1 }).accion, 'ahora');
  const espera = planDeEnvio({ ahora: 5000, ultimoEnvioMs: 4600, claveActual: k2, claveEnviada: k1 });
  assert.deepEqual(espera, { accion: 'esperar', esperaMs: 600 });
});
await prueba('simulación de 10 segundos con un punto cada 200 ms: a lo más un envío por segundo, y el último punto siempre llega', () => {
  const puntos = []; let enviados = null; let ultimo = 0; let envios = 0; let pendiente = null;
  const manda = (t) => { enviados = claveDeRuta(puntos, true); ultimo = t; envios += 1; pendiente = null; };
  for (let t = 0; t <= 10000; t += 200) {
    if (pendiente != null && t >= pendiente) manda(t);
    puntos.push({ lat: t, lng: t });
    const plan = planDeEnvio({ ahora: t, ultimoEnvioMs: ultimo, claveActual: claveDeRuta(puntos, true), claveEnviada: enviados });
    if (plan.accion === 'ahora') manda(t);
    else if (plan.accion === 'esperar' && pendiente == null) pendiente = t + plan.esperaMs;
  }
  if (pendiente != null) manda(10000);
  assert.ok(envios <= 12, `envíos: ${envios}`);
  assert.equal(enviados, claveDeRuta(puntos, true), 'al final lo último que se mandó es la ruta completa');
});

console.log('Tiempo límite, fila y plataforma');
await prueba('conTiempoLimite: responde a tiempo, o falla', async () => {
  assert.equal(await conTiempoLimite(Promise.resolve(7), 50), 7);
  await assert.rejects(conTiempoLimite(new Promise(() => {}), 20, 'no llegó'), /no llegó/);
});
await prueba('la fila no junta dos operaciones y una que falla no la detiene', async () => {
  const fila = creaFila();
  const log = [];
  const tarea = (nombre, ms, falla = false) => () => new Promise((res, rej) => {
    log.push(`${nombre}:inicio`);
    setTimeout(() => { log.push(`${nombre}:fin`); falla ? rej(new Error(nombre)) : res(nombre); }, ms);
  });
  const a = fila(tarea('crear1', 30)); const b = fila(tarea('destruir1', 10, true)); const c = fila(tarea('crear2', 5));
  assert.equal(await a, 'crear1');
  await assert.rejects(b, /destruir1/);
  assert.equal(await c, 'crear2');
  assert.deepEqual(log, ['crear1:inicio', 'crear1:fin', 'destruir1:inicio', 'destruir1:fin', 'crear2:inicio', 'crear2:fin']);
});
await prueba('fuera de la app (aquí, node) no se usa el mapa nativo', () => { assert.equal(usaMapaNativo(), false); });

await prueba('el rumbo sale de la dirección de la carrera y se ignora el temblor de estar parado', () => {
  const base = { lat: 21.16, lng: -86.85 };
  const norte = { lat: base.lat + 0.0005, lng: base.lng }; // ~55 m al norte
  const este = { lat: base.lat, lng: base.lng + 0.0005 };
  assert.ok(Math.abs(metrosEntre(base, norte) - 55.6) < 1.5);
  assert.ok(Math.abs(rumboDeRuta([base, norte]) - 0) < 1, 'hacia el norte = 0°');
  assert.ok(Math.abs(rumboDeRuta([base, este]) - 90) < 1, 'hacia el este = 90°');
  assert.equal(rumboDeRuta([base, { lat: base.lat + 0.00002, lng: base.lng }]), null, '2 m no es moverse');
  assert.equal(rumboDeRuta([]), null);
  assert.equal(rumboDeRuta([base]), null);
});

await prueba('la brújula se suaviza por el camino corto', () => {
  assert.equal(diferenciaDeRumbo(350, 10), 20);
  assert.equal(diferenciaDeRumbo(10, 350), -20);
  assert.equal(diferenciaDeRumbo(90, 90), 0);
  assert.equal(suavizaRumbo(null, 123), 123);
  assert.ok(Math.abs(suavizaRumbo(350, 10, 0.5) - 0) < 1e-9, '350→10 pasa por 0, no por 180');
  assert.ok(Math.abs(suavizaRumbo(10, 350, 0.5) - 0) < 1e-9);
  assert.ok(suavizaRumbo(0, 90, 0.35) > 0 && suavizaRumbo(0, 90, 0.35) < 90);
});

console.log(`\n${n} pruebas del mapa nativo: bien`);
