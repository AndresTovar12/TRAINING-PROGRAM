/* Pruebas del sello (datos y ruta): `node scripts/prueba-sello.mjs`. Entrenos inventados, sin base de datos ni red.
   Lo que se pinta (lienzo, tipografía) se prueba a ojo en pantalla: ver docs/sello.md. */
import assert from 'node:assert/strict';
import { sellosDeActividad, sellosDeSesionGuiada, filasDeLoGuiado, tiempoDelSello, rutaDeSeries } from '../src/lib/sello/datos.js';
import { ajustaRuta } from '../src/lib/sello/ruta.js';

const texto = (s) => s.filas.map((f) => `${f.label}=${f.valor}${f.unidad ? ` ${f.unidad}` : ''}`).join(' | ');

/* ---- El tiempo ---- */
assert.deepEqual(tiempoDelSello(2628), { label: 'Time', valor: '43:48', unidad: 'min' });
assert.deepEqual(tiempoDelSello(4350), { label: 'Time', valor: '1:12:30', unidad: '' }, 'más de una hora: sin «min»');
assert.equal(tiempoDelSello(0), null);
assert.equal(tiempoDelSello(null), null);

/* ---- Correr con GPS: solo el sello de cardio, con su ruta ---- */
const ruta = { lat: [25.67, 25.671, 25.672], lon: [-100.3, -100.301, -100.302] };
const correr = sellosDeActividad({
  fila: { deporte: 'correr', distancia_m: 8420, duracion_s: 2628, movimiento_s: 2600, fc_media: 156, kcal_totales: 512, metricas: {} },
  series: { ruta },
});
assert.equal(correr.sellos.length, 1);
assert.equal(correr.sellos[0].id, 'cardio');
assert.equal(texto(correr.sellos[0]), 'Distance=8.42 km | Pace=5:09 /km | Time=43:48 min');
assert.deepEqual(correr.sellos[0].ruta, ruta);

/* ---- Correr en cinta: cardio, sin ruta (se dibuja el ícono) ---- */
const cinta = sellosDeActividad({ fila: { deporte: 'correr', distancia_m: 5000, duracion_s: 1800 }, series: { fc: [1, 2] } });
assert.equal(cinta.sellos.length, 1);
assert.equal(cinta.sellos[0].ruta, null);
assert.equal(texto(cinta.sellos[0]), 'Distance=5.00 km | Pace=6:00 /km | Time=30:00 min');

/* ---- Correr sin distancia (reloj sin GPS ni cinta): no hay cardio, cae al general ---- */
const sinDistancia = sellosDeActividad({ fila: { deporte: 'correr', distancia_m: 0, duracion_s: 1800, fc_media: 150, kcal_totales: 300 } });
assert.equal(sinDistancia.sellos.length, 1);
assert.equal(sinDistancia.sellos[0].id, 'general');

/* ---- Bici: velocidad en vez de ritmo; natación y remo con su ritmo ---- */
assert.equal(texto(sellosDeActividad({ fila: { deporte: 'bici', distancia_m: 25300, duracion_s: 3600 } }).sellos[0]), 'Distance=25.30 km | Speed=25.3 km/h | Time=1:00:00');
assert.equal(texto(sellosDeActividad({ fila: { deporte: 'natacion', distancia_m: 1500, duracion_s: 1800 } }).sellos[0]), 'Distance=1,500 m | Pace=2:00 /100 m | Time=30:00 min');
assert.equal(texto(sellosDeActividad({ fila: { deporte: 'remo', distancia_m: 2000, duracion_s: 480 } }).sellos[0]), 'Distance=2.00 km | Pace=2:00 /500 m | Time=8:00 min');

/* ---- Fuerza con reloj: Time, Avg heart rate, Calories (las activas ganan a las totales) ---- */
const fuerza = sellosDeActividad({ fila: { deporte: 'fuerza', duracion_s: 3130, fc_media: 131.4, kcal_activas: 318, kcal_totales: 420 } });
assert.equal(fuerza.sellos.length, 1);
assert.equal(texto(fuerza.sellos[0]), 'Time=52:10 min | Avg heart rate=131 bpm | Calories=318 kcal');
assert.equal(fuerza.sellos[0].ruta, null);

/* ---- Mixto (Hyrox): los dos sellos, el de cardio primero ---- */
const hyrox = sellosDeActividad({ fila: { deporte: 'funcional', distancia_m: 12600, duracion_s: 4350, fc_media: 148, kcal_totales: 780 }, series: { ruta } });
assert.deepEqual(hyrox.sellos.map((s) => s.id), ['cardio', 'general']);
assert.equal(texto(hyrox.sellos[0]), 'Distance=12.60 km | Speed=10.4 km/h | Time=1:12:30');
assert.equal(texto(hyrox.sellos[1]), 'Time=1:12:30 | Avg heart rate=148 bpm | Calories=780 kcal');
assert.equal(hyrox.sellos[1].ruta, null);
// Menos de 1 km no es mixto: un fútbol de 600 m es general.
assert.deepEqual(sellosDeActividad({ fila: { deporte: 'futbol', distancia_m: 600, duracion_s: 3000, fc_media: 140 } }).sellos.map((s) => s.id), ['general']);

/* ---- Lo guiado: series y kilos totales ---- */
const t0 = Date.parse('2026-10-10T15:00:00Z');
const registro = {
  entreno: {
    inicio: t0,
    hechos: {
      '0.1.0': { t: t0 + 60000, n: 'Sentadilla', kg: '100', reps: '5' },
      '0.2.0': { t: t0 + 180000, n: 'Sentadilla', kg: '100', reps: '5' },
      '1.1.0': { t: t0 + 300000, n: 'Press', kg: '60', reps: '8' },
    },
  },
};
const guiado = filasDeLoGuiado(registro, 'kg');
assert.deepEqual(guiado, [{ label: 'Sets', valor: '3', unidad: '' }, { label: 'Total volume', valor: '1,480', unidad: 'kg' }]);
assert.equal(filasDeLoGuiado(registro, 'lb')[1].unidad, 'lb');
assert.deepEqual(filasDeLoGuiado(null), []);

// Sin reloj: tiempo, series y kilos.
const sinReloj = sellosDeSesionGuiada({ registro, inicio: t0, fin: t0 + 3130000 });
assert.equal(sinReloj.sellos.length, 1);
assert.equal(texto(sinReloj.sellos[0]), 'Time=52:10 min | Sets=3 | Total volume=1,480 kg');
// Sin nada medido no hay sello.
assert.deepEqual(sellosDeSesionGuiada({ registro: {}, inicio: NaN, fin: NaN }).sellos, []);

// Con reloj pero sin pulso ni calorías, lo guiado completa hasta tres filas.
const completado = sellosDeActividad({ fila: { deporte: 'fuerza', duracion_s: 3130 }, sesion: { registro } });
assert.equal(texto(completado.sellos[0]), 'Time=52:10 min | Sets=3 | Total volume=1,480 kg');

/* ---- La ruta guardada ---- */
assert.equal(rutaDeSeries(null), null);
assert.equal(rutaDeSeries({ ruta: { lat: [1], lon: [1] } }), null, 'con un punto no hay ruta');
assert.deepEqual(rutaDeSeries({ ruta }), ruta);

/* ---- Ajustar la ruta al cuadro ---- */
// Un cuadrado de ~1 km cerca de Monterrey (lat 25.67): en x se estira menos que en y por el coseno de la latitud.
const cuadro = ajustaRuta([25.67, 25.67, 25.679, 25.679], [-100.3, -100.289, -100.289, -100.3], 176, 140, 4.6);
assert.equal(cuadro.length, 4);
cuadro.forEach(([x, y]) => { assert.ok(x >= 4.6 - 1e-6 && x <= 176 - 4.6 + 1e-6, `x dentro: ${x}`); assert.ok(y >= 4.6 - 1e-6 && y <= 140 - 4.6 + 1e-6, `y dentro: ${y}`); });
// El norte queda arriba: el punto de mayor latitud tiene la y menor.
assert.ok(cuadro[2][1] < cuadro[0][1]);
// Sin deformar: la forma conserva la proporción real (ancho × cos(lat) contra alto).
const ancho = Math.abs(cuadro[1][0] - cuadro[0][0]);
const alto = Math.abs(cuadro[2][1] - cuadro[1][1]);
const real = (0.011 * Math.cos((25.67 * Math.PI) / 180)) / 0.009;
assert.ok(Math.abs(ancho / alto - real) < 0.01, `proporción ${ancho / alto} contra ${real}`);
// Quieto, sin puntos o con coordenadas rotas: no hay forma.
assert.equal(ajustaRuta([25.67, 25.67], [-100.3, -100.3], 176, 140), null);
assert.equal(ajustaRuta([25.67], [-100.3], 176, 140), null);
assert.equal(ajustaRuta([NaN, NaN, 1], [1, 2, 3], 176, 140), null);
// Una ruta recta (una sola dimensión) se dibuja de lado a lado.
const recta = ajustaRuta([25.67, 25.67, 25.67], [-100.3, -100.29, -100.28], 176, 140, 0);
assert.ok(Math.abs(recta[2][0] - recta[0][0] - 176) < 1e-6);
// Con miles de puntos se reparten parejo y se conserva el último.
const largos = Array.from({ length: 3000 }, (_, i) => i);
const muestreada = ajustaRuta(largos.map((i) => 25 + i / 3000), largos.map((i) => -100 + i / 3000), 100, 100, 0, 400);
assert.ok(muestreada.length <= 401);

console.log('prueba-sello: todo bien');
