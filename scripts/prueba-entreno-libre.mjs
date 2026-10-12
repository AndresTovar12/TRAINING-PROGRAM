/* Pruebas de lo puro del entreno libre: `node scripts/prueba-entreno-libre.mjs`. Sin red ni base de datos. */
import assert from 'node:assert/strict';
import {
  DEPORTES_EXTRA, DEPORTES_RAPIDOS, cronometroNuevo, cronometroVigente, distanciaEnMetros, entrenoLibre, esDeporteLibre, estaPausado, pausa, reanuda,
  relojDeCronometro, segundosDe, unidadDeDistancia,
} from '../src/lib/entrenoLibre.js';
import { DEPORTES } from '../src/lib/metricas/deportes.js';
import { datosDelResumen, lineaDeEntreno } from '../src/lib/resumenLibre.js';

let n = 0;
const prueba = (nombre, f) => { f(); n += 1; console.log(`  ✓ ${nombre}`); };

console.log('Deportes');
prueba('todos los deportes de la hoja existen en la lista de métricas', () => {
  for (const d of [...DEPORTES_RAPIDOS, ...DEPORTES_EXTRA]) assert.ok(DEPORTES[d], d);
  assert.deepEqual(DEPORTES_RAPIDOS, ['correr', 'bici', 'natacion', 'caminar']);
});
prueba('esDeporteLibre solo acepta los de la hoja', () => {
  assert.equal(esDeporteLibre('correr'), true);
  assert.equal(esDeporteLibre('otro'), true);
  assert.equal(esDeporteLibre('fuerza'), false);
  assert.equal(esDeporteLibre(undefined), false);
});
prueba('la natación va en metros; el resto con distancia, en kilómetros; el «otro» sin distancia', () => {
  assert.equal(unidadDeDistancia('natacion'), 'm');
  assert.equal(unidadDeDistancia('correr'), 'km');
  assert.equal(unidadDeDistancia('bici'), 'km');
  assert.equal(unidadDeDistancia('otro'), null);
});

console.log('Distancia que escribe la persona');
prueba('kilómetros con punto, coma o unidad pegada', () => {
  assert.equal(distanciaEnMetros('5', 'correr'), 5000);
  assert.equal(distanciaEnMetros('5.2', 'correr'), 5200);
  assert.equal(distanciaEnMetros('5,25', 'bici'), 5250);
  assert.equal(distanciaEnMetros(' 10 km', 'correr'), 10000);
});
prueba('natación en metros', () => {
  assert.equal(distanciaEnMetros('800', 'natacion'), 800);
  assert.equal(distanciaEnMetros('1500 m', 'natacion'), 1500);
});
prueba('vacío, cero, letras, negativos y exageraciones no cuentan', () => {
  for (const mal of ['', ' ', '0', 'hola', '-3', null, undefined, '5000000']) assert.equal(distanciaEnMetros(mal, 'correr'), null, String(mal));
  assert.equal(distanciaEnMetros('5', 'otro'), null, 'un deporte sin distancia no la lleva');
});

console.log('Cronómetro');
prueba('cuenta segundos desde el inicio', () => {
  const c = cronometroNuevo('correr', 1_000_000);
  assert.equal(segundosDe(c, 1_000_000), 0);
  assert.equal(segundosDe(c, 1_065_000), 65);
});
prueba('la pausa no cuenta y al seguir se retoma', () => {
  let c = cronometroNuevo('bici', 0);
  c = pausa(c, 60_000);
  assert.equal(estaPausado(c), true);
  assert.equal(segundosDe(c, 600_000), 60, 'pausado, el tiempo se queda quieto');
  c = reanuda(c, 360_000);
  assert.equal(estaPausado(c), false);
  assert.equal(segundosDe(c, 420_000), 120, '60 s antes de la pausa + 60 s después; los 300 s de pausa no cuentan');
});
prueba('pausar dos veces o seguir sin pausa no rompe nada', () => {
  const c = cronometroNuevo('correr', 0);
  assert.equal(reanuda(c, 5000), c);
  const p = pausa(c, 10_000);
  assert.equal(pausa(p, 20_000), p);
});
prueba('el reloj grande: mm:ss y h:mm:ss', () => {
  assert.equal(relojDeCronometro(0), '00:00');
  assert.equal(relojDeCronometro(65), '01:05');
  assert.equal(relojDeCronometro(3600), '1:00:00');
  assert.equal(relojDeCronometro(3729), '1:02:09');
  assert.equal(relojDeCronometro(-4), '00:00');
  assert.equal(relojDeCronometro(NaN), '00:00');
});
prueba('un cronómetro guardado de hace más de un día se da por olvidado', () => {
  const ahora = 10 * 24 * 3600 * 1000;
  assert.equal(cronometroVigente(cronometroNuevo('correr', ahora - 3600 * 1000), ahora), true);
  assert.equal(cronometroVigente(cronometroNuevo('correr', ahora - 25 * 3600 * 1000), ahora), false);
  assert.equal(cronometroVigente({ deporte: 'fuerza', inicio: ahora }, ahora), false);
  assert.equal(cronometroVigente(null, ahora), false);
});

console.log('Armar el entreno');
prueba('una carrera con distancia', () => {
  const e = entrenoLibre({ deporte: 'correr', inicioMs: 1_700_000_000_000, duracionS: 1800, distanciaM: 5000 });
  assert.equal(e.deporte, 'correr');
  assert.equal(e.duracion_s, 1800);
  assert.equal(e.distancia_m, 5000);
  assert.equal(e.movimiento_s, 1800);
  assert.equal(e.fin, 1_700_000_000_000 + 1800 * 1000);
  assert.equal(e.titulo, 'Correr');
});
prueba('sin distancia no se inventa ninguna', () => {
  const e = entrenoLibre({ deporte: 'bici', inicioMs: 0, duracionS: 600, distanciaM: null });
  assert.equal(e.distancia_m, null);
  assert.equal(e.movimiento_s, null);
});
prueba('un deporte que no es de la hoja se guarda como «otro»', () => {
  assert.equal(entrenoLibre({ deporte: 'ajedrez', inicioMs: 0, duracionS: 100 }).deporte, 'otro');
});

console.log('Textos del resumen');
prueba('una carrera con distancia: tiempo, distancia y ritmo', () => {
  const d = datosDelResumen({ duracion_s: 1800, distancia_m: 5000, metricas: { ritmo_medio_s_km: 360 } });
  assert.deepEqual(d.map((x) => x.etiqueta), ['tiempo', 'distancia', 'ritmo']);
  assert.equal(d[0].valor, '30:00');
  assert.equal(d[1].valor, '5.0 km');
  assert.equal(d[2].valor, '6:00 /km');
});
prueba('una bici: velocidad en lugar de ritmo', () => {
  const d = datosDelResumen({ duracion_s: 3600, distancia_m: 25000, metricas: { velocidad_media_kmh: 25 } });
  assert.equal(d[2].valor, '25 km/h');
});
prueba('sin distancia solo sale el tiempo; con pulso, también el pulso', () => {
  assert.deepEqual(datosDelResumen({ duracion_s: 600 }).map((x) => x.etiqueta), ['tiempo']);
  assert.ok(datosDelResumen({ duracion_s: 600, fc_media: 140 }).some((x) => x.etiqueta === 'pulso medio'));
});
prueba('la línea de cada fila de «Tus entrenos»', () => {
  assert.equal(lineaDeEntreno({ duracion_s: 2520, distancia_m: 8200 }), '42 min · 8.2 km');
  assert.equal(lineaDeEntreno({ duracion_s: 2520 }), '42 min');
  assert.equal(lineaDeEntreno({}), '');
});

console.log(`\n${n} pruebas, todas bien.`);
