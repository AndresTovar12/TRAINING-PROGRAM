/* Pruebas de la ruta con GPS del entreno libre (lo puro): `node scripts/prueba-ruta.mjs`. */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { agregaPunto, enVivo, trazoDeRuta, textoDeRitmo, usaGps } from '../src/lib/ubicacion.js';
import { reproduceTraza } from '../src/lib/trazaGps.js';
import { calle, caminar, correr, fantasma, vistazos } from './trazas-sinteticas.mjs';
import { preparaEntreno, construyeActividad } from '../src/lib/metricas/construye.js';
import { entrenoLibre, decidePausaAutomatica, cronometroNuevo, pausa, reanuda } from '../src/lib/entrenoLibre.js';
import { decidePrecision, silencioNuevo, sinNumerosDeLaRuta, SILENCIO } from '../src/lib/rutaSilenciosa.js';
import { ficha, entrenoDeActividad } from '../src/lib/stickers/ficha.js';
import { catalogo } from '../src/lib/stickers/catalogo.js';

// Una carrera inventada hacia el norte: 1.25 km a 5:00/km (3.333 m/s), un punto por segundo.
const metrosPorGradoLat = 111195;
const puntos = Array.from({ length: 376 }, (_, s) => ({ lat: 19.4 + (s * (1000 / 300)) / metrosPorGradoLat, lon: -99.1, precision: 8, vel: 1000 / 300 }));

let m = [];
puntos.forEach((p, s) => { m = agregaPunto(m, p, s); });
assert.equal(m.length, 376, 'un punto por segundo (la cámara del mapa avanza con cada uno)');

// Un punto impreciso no entra; uno muy pegado al anterior tampoco.
assert.equal(agregaPunto(m, { lat: 19.5, lon: -99.1, precision: 120 }, 400), m);
assert.equal(agregaPunto(m, { lat: 19.5, lon: -99.1, precision: 5 }, m[m.length - 1].t + 0.5), m);
// Ya con señal, un punto de 25 m de error no entra (el primero sí podía).
assert.equal(agregaPunto(m, { lat: 19.5, lon: -99.1, precision: 25 }, 400), m);
assert.equal(agregaPunto([], { lat: 19.5, lon: -99.1, precision: 25 }, 0).length, 1);

const v = enVivo(m);
assert.ok(Math.abs(v.distanciaM - 1243) < 15, `distancia ${v.distanciaM}`);
assert.ok(Math.abs(v.ritmoSKm - 300) <= 3, `ritmo ${v.ritmoSKm}`);
assert.equal(v.kms.length, 1);
assert.ok(Math.abs(v.kms[0].dur - 300) <= 3, `km 1 en ${v.kms[0].dur}`);
assert.deepEqual(enVivo([]), { distanciaM: 0, ritmoSKm: null, kms: [] });

// Una carrera que arranca a media segundo (t = s + 0.6): entran TODOS los puntos, uno por segundo (antes entraba uno de cada dos).
let fase = [];
for (let s = 0; s < 60; s += 1) fase = agregaPunto(fase, { lat: 19.4 + (s * 3) / metrosPorGradoLat, lon: -99.1, precision: 6, vel: 3 }, s + 0.6);
assert.equal(fase.length, 60, `a media segundo entran ${fase.length} de 60`);

// Parado con el temblor normal del GPS (±3 m, velocidad ~0): 0 metros, y el ritmo dice «parado».
const seed = (i) => Math.sin(i * 12.9898) * 43758.5453 % 1;
let quieto = [];
for (let s = 0; s < 120; s += 1) quieto = agregaPunto(quieto, { lat: 19.4 + (seed(s) * 3) / metrosPorGradoLat, lon: -99.1 + (seed(s + 7) * 3) / metrosPorGradoLat, precision: 8, vel: 0.1 }, s);
assert.ok(enVivo(quieto).distanciaM <= 1, `parado suma ${enVivo(quieto).distanciaM} m`);
assert.equal(enVivo(quieto).ritmoSKm, null, 'parado no tiene ritmo');
assert.equal(quieto.length, 120, 'parado el tiempo sigue contando');

// PARADO EN UN CUARTO 10 MINUTOS (30 oct 2026): bajo techo el GPS deriva despacio (~0.25 m/s) y salta hasta 10 m al cambiar de satélite (~cada 50 s), con un
// error de 8 a 18 m. Antes, cada salto que se alejaba más que su error sumaba entero (simulado: 200 m quieto). Tres variantes: sin velocidad del iPhone, con
// velocidad 0 y con velocidad con ruido de 0.3 a 1.4 m/s. Cinco sorteos de cada una; todas deben dar menos de 10 m.
{
  const azar = (semilla) => () => { semilla = (semilla + 0x6D2B79F5) | 0; let x = Math.imul(semilla ^ (semilla >>> 15), 1 | semilla); x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x; return ((x ^ (x >>> 14)) >>> 0) / 4294967296; };
  const enCuarto = (semilla, velocidad) => {
    const r = azar(semilla);
    let dx = 0; let dy = 0; let siguienteSalto = 40 + r() * 20;
    let muestras = [];
    for (let s = 0; s < 600; s += 1) {
      const ang = r() * 2 * Math.PI;
      dx += Math.cos(ang) * 0.25; dy += Math.sin(ang) * 0.25;
      if (s >= siguienteSalto) { const a2 = r() * 2 * Math.PI; const l = r() * 10; dx += Math.cos(a2) * l; dy += Math.sin(a2) * l; siguienteSalto = s + 40 + r() * 20; }
      const p = { lat: 19.4 + dy / metrosPorGradoLat, lon: -99.1 + dx / (metrosPorGradoLat * Math.cos(19.4 * Math.PI / 180)), precision: 8 + r() * 10 };
      if (velocidad === 'cero') p.vel = 0;
      if (velocidad === 'ruido') p.vel = 0.3 + r() * 1.1;
      muestras = agregaPunto(muestras, p, s);
    }
    return enVivo(muestras).distanciaM;
  };
  for (const velocidad of ['sin', 'cero', 'ruido']) {
    for (let semilla = 1; semilla <= 5; semilla += 1) {
      const d = enCuarto(semilla * 7919, velocidad);
      assert.ok(d < 10, `quieto en un cuarto 10 min (velocidad ${velocidad}, sorteo ${semilla}) suma ${d} m`);
    }
  }
}

// Caminando después de estar parado: con el iPhone la distancia arranca en 3 s o menos, sin perder el arranque, y 150 s a 1.4 m/s dan 210 m (con y sin velocidad del iPhone).
for (const conVel of [true, false]) {
  let w = [];
  for (let s = 0; s < 20; s += 1) w = agregaPunto(w, { lat: 19.4 + (seed(s) * 1) / metrosPorGradoLat, lon: -99.1, precision: 5, ...(conVel ? { vel: 0 } : {}) }, s);
  let arranca = null;
  for (let k = 1; k <= 150; k += 1) {
    w = agregaPunto(w, { lat: 19.4 + (k * 1.4) / metrosPorGradoLat, lon: -99.1 + (seed(k) * 0.5) / metrosPorGradoLat, precision: 5, ...(conVel ? { vel: 1.4 } : {}) }, 19 + k);
    if (arranca === null && enVivo(w).distanciaM > 0) arranca = k;
  }
  // Sin velocidad (la web) la ventana de 5 s tarda más en decir «se mueve»: se tolera hasta 8 s; el iPhone da velocidad y arranca en 3.
  assert.ok(arranca !== null && arranca <= (conVel ? 3 : 8), `caminando (${conVel ? 'con' : 'sin'} velocidad) la distancia arranca a los ${arranca} s`);
  assert.ok(Math.abs(enVivo(w).distanciaM - 210) <= 6, `caminando 150 s a 1.4 m/s da ${enVivo(w).distanciaM} m`);
}

// 200 m en línea recta a 4 m/s, con ±1 m de temblor de lado (el del iPhone ya filtrado): 200 ± 5 m, y el ritmo de ahora es el de la velocidad (250 s/km).
let recta = [];
for (let s = 0; s <= 50; s += 1) recta = agregaPunto(recta, { lat: 19.4 + (s * 4) / metrosPorGradoLat, lon: -99.1 + seed(s) / metrosPorGradoLat, precision: 6, vel: 4 + seed(s + 3) * 0.2 }, s);
assert.ok(Math.abs(enVivo(recta).distanciaM - 200) <= 5, `200 m rectos dan ${enVivo(recta).distanciaM}`);
assert.ok(Math.abs(enVivo(recta).ritmoSKm - 250) <= 10, `ritmo ${enVivo(recta).ritmoSKm}`);

// Sin velocidad del GPS (algunos navegadores), el ritmo sale de la distancia como antes.
const sinVel = m.map(({ vel, ...x }) => x);
assert.ok(Math.abs(enVivo(sinVel).ritmoSKm - 300) <= 3, `ritmo sin velocidad ${enVivo(sinVel).ritmoSKm}`);

const t = trazoDeRuta(m, { ancho: 300, alto: 200, margen: 16 });
assert.ok(t.d.startsWith('M'));
assert.ok(t.inicio[1] > t.fin[1], 'hacia el norte = hacia arriba');
assert.equal(trazoDeRuta(m.slice(0, 1)), null);

assert.equal(textoDeRitmo(332), '5:32');
assert.equal(textoDeRitmo(null), '—');
assert.ok(usaGps('correr') && !usaGps('natacion'));

// Guardada como cualquier entreno con ruta: la distancia del GPS, los kilómetros y la ruta en las series.
const prep = preparaEntreno({ ...entrenoLibre({ deporte: 'correr', inicioMs: Date.parse('2026-10-15T12:00:00Z'), duracionS: 376 }), muestras: m });
const { fila, series } = construyeActividad(prep, { umbrales: { fc_max: 190, fc_reposo: 60, fc_umbral: 170, metodo: 'x' }, conSeries: true, origen: 'manual' });
assert.ok(Math.abs(fila.distancia_m - 1243) < 15, `fila ${fila.distancia_m}`);
assert.ok(fila.vueltas?.length >= 1, 'kilómetros guardados');
assert.ok(fila.metricas?.ritmo_medio_s_km > 290 && fila.metricas.ritmo_medio_s_km < 310, `ritmo medio ${fila.metricas?.ritmo_medio_s_km}`);
assert.ok(series && JSON.stringify(series).includes('19.4'), 'la ruta va en las series');

// Lo que la persona escribió gana sobre el GPS.
const prep2 = preparaEntreno({ ...entrenoLibre({ deporte: 'correr', inicioMs: Date.parse('2026-10-15T12:00:00Z'), duracionS: 376, distanciaM: 1500 }), muestras: m });
assert.equal(construyeActividad(prep2, { umbrales: { fc_max: 190 }, conSeries: true }).fila.distancia_m, 1500);

// PAUSA AUTOMÁTICA: lo que leería la app segundo a segundo (t en segundos de reloj).
const simula = (velocidades, deporte = 'correr', { sinSenal = [] } = {}) => {
  let estado = 'corriendo';
  const lecturas = [];
  const eventos = [];
  velocidades.forEach((vel, t) => {
    if (sinSenal.includes(t)) return;
    lecturas.push({ t, vel, pre: 6 });
    const d = decidePausaAutomatica(lecturas.slice(-15), estado, deporte, t);
    if (d) { eventos.push({ ...d, en: t }); estado = d.accion === 'pausa' ? 'pausa' : 'corriendo'; }
  });
  return eventos;
};
// Un semáforo de 20 s: corre 30 s, se para 20 s, vuelve a correr.
const semaforo = simula([...Array(30).fill(3.3), ...Array(20).fill(0.1), ...Array(15).fill(3.3)]);
assert.equal(semaforo.length, 2, `semáforo: ${JSON.stringify(semaforo)}`);
assert.deepEqual([semaforo[0].accion, semaforo[0].en - 30], ['pausa', 2], 'pausa a los 2 s de parar');
assert.deepEqual([semaforo[1].accion, semaforo[1].en - 50], ['reanuda', 2], 'reanuda 2 s después de arrancar');
assert.equal(semaforo[0].desde, 30, 'la pausa cuenta desde que se paró');
// Una lectura lenta suelta (1 s) a media carrera: no pausa.
assert.equal(simula([...Array(20).fill(3.3), 0.2, ...Array(20).fill(3.3)]).length, 0, 'un segundo lento no pausa');
// Trote lento constante a 1.8 m/s: nunca pausa.
assert.equal(simula(Array(120).fill(1.8)).length, 0, 'trote lento no pausa');
// Bici a 1.5 m/s no pausa (su umbral para pausar es 1.0); bici parada sí.
assert.equal(simula(Array(30).fill(1.5), 'bici').length, 0, 'bici lenta no pausa');
assert.equal(simula([...Array(10).fill(6), ...Array(10).fill(0.3)], 'bici')[0]?.accion, 'pausa', 'bici parada pausa');
// Se corta la señal 10 s corriendo: no pausa (sin señal no es estar parado).
assert.equal(simula(Array(40).fill(3), 'correr', { sinSenal: Array.from({ length: 10 }, (_, i) => 15 + i) }).length, 0, 'corte de señal no pausa');
// Lecturas imprecisas (25 m) no cuentan.
assert.equal(decidePausaAutomatica([{ t: 0, vel: 0, pre: 25 }, { t: 1, vel: 0, pre: 25 }, { t: 2, vel: 0, pre: 25 }, { t: 3, vel: 0, pre: 25 }], 'corriendo', 'correr', 3), null);
// La marca de automática: se pone al pausar así y se quita al reanudar.
const c0 = cronometroNuevo('correr', 0);
const cp = pausa(c0, 1000, { automatica: true });
assert.equal(cp.automatica, true);
assert.equal(reanuda(cp, 3000).automatica, undefined);
assert.equal(reanuda(cp, 3000).pausas, 2000);

/* EL SENSOR DE MOVIMIENTO Y EL GPS JUNTOS (2 y 3 nov 2026). Las situaciones de la calle se arman como TRAZAS (`scripts/trazas-sinteticas.mjs`, formato
   `traza-gps/2` de `lib/trazaGps.js`: los puntos y los avisos del sensor tal como llegan) y se reproducen con `reproduceTraza`, que pasa todo por las mismas
   funciones que la carrera (`pasoDeCarrera`).
   · Parado en la calle entre edificios (bug del 2 nov: 50 m en 87 s, ritmo 18:13 /km, nunca pausó): error 15-20 m y el iPhone da ~0.9 m/s quieto, con la
     posición yéndose con esa velocidad. El ruido al azar de arriba no tenía relación con la posición: por eso no lo veía.
   · Girar el teléfono para ver la hora corriendo (bug del 3 nov): 6 s sin pasos con el sensor en «corriendo». Antes pausaba.
   · Detenerse con dos pasos fantasma y el sensor diciendo «quieto» 12 s tarde (bug del 3 nov). Antes tardaba 8 s o más en pausar. */
{
  // 3 minutos quieto en la calle, cinco sorteos. Con sensor y sin él (la web, o sin permiso): menos de 5 m, la pausa en menos de 10 s y no se reanuda sola.
  for (let semilla = 1; semilla <= 5; semilla += 1) {
    const t = calle(semilla * 104729);
    for (const sinSensor of [false, true]) {
      const r = reproduceTraza(t, { sinSensor });
      const cual = `calle ${sinSensor ? 'sin' : 'con'} sensor (sorteo ${semilla})`;
      assert.ok(r.distanciaM < 5, `${cual} suma ${r.distanciaM} m`);
      assert.ok(r.pausas.length >= 1 && r.pausas[0] < 10, `${cual}: pausa a los ${r.pausas[0]} s`);
      assert.equal(r.reanudas.length, 0, `${cual}: se reanudó sola ${r.reanudas.length} veces`);
    }
  }

  // Caminar 200 m con el sensor después de 20 s quieto: la distancia arranca en menos de 5 s de echar a andar y marca bien.
  {
    const t = caminar();
    const r = reproduceTraza(t);
    const arranca = t.filas.find((f, i) => r.metros[i] > 0).t - 20;
    assert.ok(r.pausas[0] < 10, `quieto antes de caminar: pausa a los ${r.pausas[0]} s`);
    assert.ok(arranca < 5, `caminando con sensor la distancia arranca a los ${arranca} s`);
    assert.ok(Math.abs(r.distanciaM - 200) <= 6, `caminando 200 m con sensor da ${r.distanciaM} m`);
  }

  // Correr parejo con el sensor (pasos todo el tiempo): lo mismo que sin sensor, sin pausas.
  {
    const t = correr();
    const con = reproduceTraza(t);
    const sin = reproduceTraza(t, { sinSensor: true });
    assert.equal(con.distanciaM, sin.distanciaM, `correr con sensor ${con.distanciaM} m, sin sensor ${sin.distanciaM} m`);
    assert.ok(Math.abs(con.distanciaM - 1250) < 15, `correr con sensor da ${con.distanciaM} m`);
    assert.equal(con.pausas.length, 0, 'correr con sensor no pausa');
  }

  // Las dos fallas del 3 nov, armadas aquí mismo (las mismas que están en `scripts/trazas/`).
  {
    const r = reproduceTraza(vistazos());
    assert.equal(r.pausas.length, 0, `girar el teléfono 5 veces corriendo pausa a los ${r.pausas.join(', ')} s`);
    const f = reproduceTraza(fantasma());
    assert.ok(f.pausas[0] > 30 && f.pausas[0] < 36, `detenerse con pasos fantasma: pausa a los ${f.pausas[0] - 30} s de parar`);
    assert.ok(f.reanudas[0] > 60 && f.reanudas[0] < 64, `volver a correr: reanuda a los ${f.reanudas[0] - 60} s`);
    assert.equal(f.pausas.length, 1, `detenerse con pasos fantasma: ${f.pausas.length} pausas`);
  }

  // Las trazas de `scripts/trazas/` (las sintéticas y las que se graben en el iPhone con «Guardar traza del GPS» → «Exportar»). Lo que se les exige:
  //   «quieto-…»: menos de 5 m y la pausa automática en menos de 10 s · «corriendo-…»: ninguna pausa · y lo que diga su `esperado` (las sintéticas lo traen).
  // Las demás solo se reproducen (y se dice cuánto dieron).
  const carpeta = new URL('./trazas/', import.meta.url);
  for (const nombre of (existsSync(carpeta) ? readdirSync(carpeta) : []).filter((n) => n.endsWith('.json')).sort()) {
    const t = JSON.parse(readFileSync(new URL(nombre, carpeta), 'utf8'));
    const r = reproduceTraza(t);
    const e = t.esperado ?? {};
    console.log(`  traza ${nombre}: ${t.filas.length} puntos, ${r.distanciaM} m, pausas a los ${r.pausas.join(', ') || '—'} s, reanuda a los ${r.reanudas.join(', ') || '—'} s`);
    if (nombre.startsWith('quieto-')) {
      assert.ok(r.distanciaM < 5, `${nombre}: quieto suma ${r.distanciaM} m`);
      assert.ok(r.pausas.length >= 1 && r.pausas[0] < 10, `${nombre}: la pausa entra a los ${r.pausas[0]} s`);
    }
    if (nombre.startsWith('corriendo-') || e.sinPausas) assert.equal(r.pausas.length, 0, `${nombre}: pausó a los ${r.pausas.join(', ')} s`);
    if (e.pausaAntesDe != null) assert.ok(r.pausas.length >= 1 && r.pausas[0] < e.pausaAntesDe, `${nombre}: la pausa entra a los ${r.pausas[0]} s`);
    if (e.sinReanudarAntesDe != null) assert.ok(!r.reanudas.some((x) => x < e.sinReanudarAntesDe), `${nombre}: se reanudó a los ${r.reanudas.join(', ')} s`);
    if (e.reanudaAntesDe != null) assert.ok(r.reanudas.some((x) => x >= (e.sinReanudarAntesDe ?? 0) && x < e.reanudaAntesDe), `${nombre}: reanuda a los ${r.reanudas.join(', ') || '—'} s`);
  }
}

// LA RUTA EN SILENCIO (sección 8b): precisión baja hasta que se mueve de verdad, alta mientras se mueve, baja tras 3 min quieto.
{
  const norte = (m) => 19.4 + m / 111195;
  let e = silencioNuevo();
  e = decidePrecision(e, { lat: norte(0), lon: -99.1, precision: 65 }, 0);
  assert.equal(e.nivel, 'baja');
  // El temblor de un punto de 65 m de error (a 60 m del primero) no es moverse.
  assert.equal(decidePrecision(e, { lat: norte(60), lon: -99.1, precision: 65 }, 5000).nivel, 'baja', 'el temblor no sube la precisión');
  // A 120 m del primero (más que 1.5 × 65) sí: sube a alta.
  e = decidePrecision(e, { lat: norte(120), lon: -99.1, precision: 65 }, 10000);
  assert.equal(e.nivel, 'alta');
  // Ir a paso de caminata también sube.
  assert.equal(decidePrecision(silencioNuevo(), { lat: 0, lon: 0, precision: 65 }, 0).ancla !== null, true);
  assert.equal(decidePrecision({ nivel: 'baja', ancla: { lat: 0, lon: 0 }, movidoEn: null }, { lat: 0, lon: 0, precision: 65, vel: 1.4 }, 1000).nivel, 'alta', 'caminando');
  // Quieto en alta: sigue alta hasta 3 minutos; después, baja.
  const quieto = { lat: norte(120), lon: -99.1, precision: 5, vel: 0 };
  assert.equal(decidePrecision(e, quieto, 10000 + SILENCIO.QUIETO_MS - 1000).nivel, 'alta');
  assert.equal(decidePrecision(e, quieto, 10000 + SILENCIO.QUIETO_MS).nivel, 'baja');
}

// Un fútbol con ruta en silencio (2 km dando vueltas por la cancha y el estacionamiento): la línea se guarda, pero NUNCA se vuelve distancia ni ritmo.
{
  const muestras = Array.from({ length: 600 }, (_, i) => ({ t: i * 5, lat: 19.4 + (Math.sin(i / 20) * 400) / 111195, lon: -99.1 + (i * 1.5) / 105000 }));
  const base = entrenoLibre({ deporte: 'futbol', inicioMs: Date.parse('2026-10-28T13:00:00Z'), duracionS: 3000, titulo: 'Fútbol' });
  const prep = sinNumerosDeLaRuta(preparaEntreno({ ...base, muestras }));
  const { fila, series } = construyeActividad(prep, { umbrales: { fc_max: 190, fc_reposo: 55, fc_umbral: 170, metodo: 'estimado' }, origen: 'manual' });
  assert.equal(fila.distancia_m, null, 'sin «Distance»');
  assert.equal(fila.metricas?.ritmo_medio_s_km ?? null, null, 'sin ritmo');
  assert.equal(fila.vueltas, null, 'sin kilómetros');
  assert.ok(series?.ruta?.lat?.length > 50, 'la línea sí se guarda');
  const f = ficha(entrenoDeActividad({ fila: { ...fila, id: 'fut', duracion_s: 3000, kcal_activas: 700 }, series }));
  assert.equal(f.datos.dist, undefined);
  assert.ok(catalogo(f).some((x) => x.id === 'ruta-dato'), 'pero sí sale la línea en Ruta y dato');
  // Un pádel en su cancha (menos de 300 m de recorrido y a menos de 150 m del inicio): ningún sticker de ruta (prueba de aceptación 11).
  const cancha = Array.from({ length: 30 }, (_, i) => ({ t: i * 10, lat: 19.4 + ((i % 2) * 8) / 111195, lon: -99.1 }));
  const padel = construyeActividad(sinNumerosDeLaRuta(preparaEntreno({ ...entrenoLibre({ deporte: 'raqueta', inicioMs: 0, duracionS: 3600, titulo: 'Pádel' }), muestras: cancha })), { umbrales: { fc_max: 190, fc_reposo: 55, fc_umbral: 170, metodo: 'estimado' }, origen: 'manual' });
  const fp = ficha(entrenoDeActividad({ fila: { ...padel.fila, id: 'pad', duracion_s: 3600 }, series: padel.series }));
  assert.equal(fp.ruta, null);
  assert.ok(!catalogo(fp).some((x) => ['ruta-dato', 'mejor-km', 'esquinas', 'ruta-escrita'].includes(x.id)), 'pádel en cancha: sin stickers de ruta');
  // Sin permiso (sin muestras): todo funciona igual y no hay ruta (prueba de aceptación 12).
  const sin = construyeActividad(entrenoLibre({ deporte: 'raqueta', inicioMs: 0, duracionS: 3600, titulo: 'Pádel' }), { umbrales: { fc_max: 190, fc_reposo: 55, fc_umbral: 170, metodo: 'estimado' }, origen: 'manual' });
  assert.equal(ficha(entrenoDeActividad({ fila: { ...sin.fila, id: 'p2' } })).ruta, null);
}

console.log('prueba-ruta: todo bien');
