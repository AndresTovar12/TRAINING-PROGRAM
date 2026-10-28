/* Pruebas de lo puro del entreno libre: `node scripts/prueba-entreno-libre.mjs`. Sin red ni base de datos. */
import assert from 'node:assert/strict';
import {
  DEPORTES_EXTRA, DEPORTES_RAPIDOS, cronometroNuevo, cronometroVigente, distanciaEnMetros, entrenoLibre, esDeporteLibre, estaPausado, pausa, reanuda,
  relojDeCronometro, segundosDe, unidadDeDistancia,
} from '../src/lib/entrenoLibre.js';
import { DEPORTES } from '../src/lib/metricas/deportes.js';
import { datosDelResumen, lineaDeEntreno, recordDe } from '../src/lib/resumenLibre.js';
import { deporteDelCartel, haceCuanto, resumenDeLaSemana, textoDeLaSemana } from '../src/lib/semanaLibre.js';

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
  assert.equal(cronometroVigente({ deporte: 'fuerza', inicio: ahora }, ahora), true, 'desde el 23 oct se registra cualquier actividad (gimnasio = fuerza)');
  assert.equal(cronometroVigente({ deporte: 'ajedrez', inicio: ahora }, ahora), false, 'un deporte que no existe no');
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
prueba('una actividad con nombre propio: se guarda su nombre y, si se mueve de un lugar a otro, su distancia', () => {
  const p = entrenoLibre({ deporte: 'raqueta', inicioMs: 0, duracionS: 3600, titulo: 'Pádel' });
  assert.equal(p.deporte, 'raqueta');
  assert.equal(p.titulo, 'Pádel');
  const pat = entrenoLibre({ deporte: 'otro', inicioMs: 0, duracionS: 1200, distanciaM: 6000, titulo: 'Patines', llevaDistancia: true });
  assert.equal(pat.distancia_m, 6000, 'una propia con mapa guarda su distancia aunque sea «otro»');
  assert.equal(entrenoLibre({ deporte: 'otro', inicioMs: 0, duracionS: 1200, distanciaM: 6000 }).distancia_m, null, 'sin decir que se mueve, «otro» no lleva distancia');
});

console.log('Récords');
prueba('la primera vez, la distancia más larga, el ritmo más rápido y el entreno más largo', () => {
  const vieja = { id: 'a', deporte: 'correr', titulo: 'Correr', distancia_m: 5000, duracion_s: 1800, metricas: { ritmo_medio_s_km: 360 } };
  assert.equal(recordDe({ id: 'b', deporte: 'raqueta', titulo: 'Pádel', duracion_s: 3600 }, [vieja]).tipo, 'primera');
  assert.equal(recordDe({ id: 'b', deporte: 'correr', titulo: 'Correr', distancia_m: 6000, duracion_s: 1700, metricas: {} }, [vieja]).tipo, 'distancia');
  assert.equal(recordDe({ id: 'b', deporte: 'correr', titulo: 'Correr', distancia_m: 4000, duracion_s: 1300, metricas: { ritmo_medio_s_km: 325 } }, [vieja]).tipo, 'ritmo');
  assert.equal(recordDe({ id: 'b', deporte: 'correr', titulo: 'Correr', distancia_m: 4000, duracion_s: 2000, metricas: { ritmo_medio_s_km: 500 } }, [vieja]).tipo, 'tiempo');
  assert.equal(recordDe({ id: 'b', deporte: 'correr', titulo: 'Correr', distancia_m: 3000, duracion_s: 1000, metricas: { ritmo_medio_s_km: 400 } }, [vieja]), null, 'sin récord no se dice nada');
  assert.equal(recordDe({ id: 'a', deporte: 'correr', titulo: 'Correr', distancia_m: 9000 }, [vieja]).tipo, 'primera', 'no se compara consigo mismo');
});
prueba('el récord dice su valor, la diferencia contra el mejor anterior y la fecha de ese mejor', () => {
  const vieja = { id: 'a', deporte: 'correr', titulo: 'Correr', inicio: '2026-10-09T13:00:00Z', desfase_min: -360, distancia_m: 5000, duracion_s: 1800, metricas: { ritmo_medio_s_km: 360 } };
  const lejos = recordDe({ id: 'b', deporte: 'correr', titulo: 'Correr', distancia_m: 6100, duracion_s: 1700, metricas: {} }, [vieja]);
  assert.deepEqual([lejos.valor, lejos.diferencia, lejos.fecha], ['6.1 km', '1.1 km más', 'vie 9 oct']);
  assert.equal(lejos.detalle, '6.1 km · 1.1 km más que el vie 9 oct');
  const rapido = recordDe({ id: 'b', deporte: 'correr', titulo: 'Correr', distancia_m: 4000, duracion_s: 1300, metricas: { ritmo_medio_s_km: 325 } }, [vieja]);
  assert.equal(rapido.detalle, '5:25 /km · 35 s/km más rápido que el vie 9 oct');
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

console.log('El cartel «Entrenar»: la semana');
// 12 oct 2026 es lunes; se prueba con esa semana (lunes 12 a domingo 18) y con el día de hoy fijo.
const HOY = '2026-10-14'; // miércoles
const en = (dia, extra = {}) => ({ inicio: `${dia}T15:00:00Z`, desfase_min: -360, duracion_s: 1800, distancia_m: 5000, deporte: 'correr', ...extra });
prueba('siete días de lunes a domingo, con hoy marcado', () => {
  const r = resumenDeLaSemana([], HOY);
  assert.deepEqual(r.dias.map((d) => d.dia), ['2026-10-12', '2026-10-13', '2026-10-14', '2026-10-15', '2026-10-16', '2026-10-17', '2026-10-18']);
  assert.deepEqual(r.dias.map((d) => d.esHoy), [false, false, true, false, false, false, false]);
  assert.equal(r.entrenos, 0);
});
prueba('cuenta entrenos, tiempo y distancia de ESTA semana y marca los días con entreno', () => {
  const r = resumenDeLaSemana([en('2026-10-12'), en('2026-10-14', { duracion_s: 3600, distancia_m: 10000 }), en('2026-10-05')], HOY);
  assert.equal(r.entrenos, 2, 'el de la semana pasada no cuenta');
  assert.equal(r.duracion_s, 5400);
  assert.equal(r.distancia_m, 15000);
  assert.deepEqual(r.dias.map((d) => d.entreno), [true, false, true, false, false, false, false]);
});
prueba('un entreno de la noche cuenta en SU día local, no en el de UTC', () => {
  // 22:30 del martes en México (UTC-6) = 04:30 UTC del miércoles
  const r = resumenDeLaSemana([{ inicio: '2026-10-14T04:30:00Z', desfase_min: -360, duracion_s: 600 }], HOY);
  assert.deepEqual(r.dias.map((d) => d.entreno), [false, true, false, false, false, false, false]);
});
prueba('el texto de la semana', () => {
  assert.equal(textoDeLaSemana(resumenDeLaSemana([], HOY)), 'Sin entrenos esta semana');
  assert.equal(textoDeLaSemana(resumenDeLaSemana([en('2026-10-12')], HOY)), '1 entreno · 30 min');
  assert.equal(textoDeLaSemana(resumenDeLaSemana([en('2026-10-12'), en('2026-10-13', { duracion_s: 4200 })], HOY)), '2 entrenos · 1 h 40 min');
});
prueba('con qué deporte arranca el cartel', () => {
  assert.equal(deporteDelCartel([{ deporte: 'natacion' }, { deporte: 'correr' }]), 'natacion');
  assert.equal(deporteDelCartel([{ deporte: 'fuerza' }]), 'correr', 'un deporte que no se hace aquí no cuenta');
  assert.equal(deporteDelCartel([]), 'correr');
  assert.equal(deporteDelCartel(null), 'correr');
});
prueba('«hoy», «ayer», «hace 3 días», «hace 2 semanas»', () => {
  assert.equal(haceCuanto(en('2026-10-14'), HOY), 'hoy');
  assert.equal(haceCuanto(en('2026-10-13'), HOY), 'ayer');
  assert.equal(haceCuanto(en('2026-10-11'), HOY), 'hace 3 días');
  assert.equal(haceCuanto(en('2026-09-30'), HOY), 'hace 2 semanas');
  assert.equal(haceCuanto(en('2026-07-01'), HOY), 'hace más de un mes');
  assert.equal(haceCuanto(null, HOY), '');
});

console.log(`\n${n} pruebas, todas bien.`);
