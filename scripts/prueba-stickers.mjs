/* Pruebas de los stickers (lo puro): la ficha de datos, las ranuras con suplentes y el catálogo de la fase 1. `node scripts/prueba-stickers.mjs`.
   Siguen las pruebas de aceptación de la especificación (docs/stickers.md). */
import assert from 'node:assert/strict';
import { ficha, entrenoDeActividad, rutaDe } from '../src/lib/stickers/ficha.js';
import { catalogo, fraseCorta, fraseLarga, tituloDeLaHoja } from '../src/lib/stickers/catalogo.js';
import { ajustaRuta } from '../src/lib/stickers/ruta.js';

const ids = (f) => catalogo(f).map((s) => s.id);
const base = { inicio: '2026-10-28T13:02:00Z', desfase_min: -360 };

// Una ruta recta de `m` metros hacia el norte, un punto cada 10 m.
const rutaRecta = (m) => Array.from({ length: Math.round(m / 10) + 1 }, (_, i) => ({ lat: 19.4 + (i * 10) / 111195, lon: -99.1 }));

// 1) Un pádel sin distancia: Grande con el tiempo, Fila con tiempo · calorías · pulso, ningún sticker de ruta.
{
  const f = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'otro', titulo: 'Pádel', duracion_s: 4200, kcal_activas: 610, fc_media: 141 } }));
  const cat = catalogo(f);
  assert.equal(cat.find((s) => s.id === 'grande').r.g.l, 'Time');
  assert.deepEqual(cat.find((s) => s.id === 'fila').r.map((d) => d.l), ['Time', 'Calories', 'Heart rate']);
  ['ruta-dato', 'mejor-km', 'esquinas', 'ruta-escrita', 'parciales', 'regla'].forEach((id) => assert.ok(!ids(f).includes(id), id));
  assert.ok(!Object.values(f.datos).some((d) => /N\/A|undefined|NaN/.test(d.v)), 'nunca N/A');
}

// 2) Un workout del plan: «16 sets» en Firma y Eco; el volumen no es el número principal de ninguno de la fase 1.
{
  const registro = { entreno: { hechos: {} }, exercises: {} };
  const lista = [{ n: 'Back squat', s: 4, r: 5, kg: 100 }, { n: 'Plank', s: 3, r: null, seg: 45 }];
  const f = ficha({ deporte: 'fuerza', inicioMs: Date.parse('2026-10-28T14:00:00Z'), duracionS: 2885, guiado: { series: 16, ejercicios: 5, volumen: 8450, lista }, nombre: 'Lower A', plan: true, coach: '@beto', registro, tipo: { nombre: 'Gimnasio', icono: 'pesa' } });
  const cat = catalogo(f);
  const conVolumen = cat.filter((s) => [s.r].flat().concat(Object.values(s.r ?? {})).flat().some((d) => d?.k === 'volumen')).map((s) => s.id);
  assert.deepEqual(conVolumen.sort(), ['columna', 'lista'], 'el volumen solo en Lista y Columna');
  assert.equal(cat.find((s) => s.id === 'lista').r.g.k, 'volumen', 'en Lista es el número principal');
  assert.ok(cat.some((s) => s.id === 'hoy-toco'), 'Lo que tocó hoy: solo con plan');
  assert.deepEqual(f.tipo, { nombre: 'Gimnasio', icono: 'pesa' }, 'el tipo del coach llega a la ficha');
  assert.equal(cat.find((s) => s.id === 'firma').r.g.v, '16');
  assert.equal(cat.find((s) => s.id === 'firma').r.g.u, 'sets');
  assert.equal(cat.find((s) => s.id === 'eco').r.g.k, 'series');
  assert.equal(f.coach, '@beto');
}

// 3) Un yoga sin reloj (solo tiempo): Firma, Eco, Grande, Frase, Hora, Partido, Semana, Mes y los de ícono, y nada más.
{
  const f = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'otro', titulo: 'Yoga', duracion_s: 3600 } }));
  assert.deepEqual(ids(f), ['firma', 'eco', 'grande', 'frase', 'hora', 'partido', 'semana', 'mes', 'icono-numero', 'icono-gigante', 'sello', 'semana-iconos', 'mes-por-tipo']);
  assert.equal(f.datos.min.v, '1h 00');
}

// Un mismo dato no se repite dentro de un sticker: en Titular, «min» y «tiempo» se llaman igual (Time) y no salen juntos.
{
  const f = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'otro', titulo: 'Pádel', duracion_s: 4200, kcal_activas: 610, fc_media: 141 } }));
  const t = catalogo(f).find((s) => s.id === 'titular').r;
  assert.deepEqual([t.a.l, t.b.l, t.c.l], ['Time', 'Calories', 'Heart rate']);
}

// Una carrera de 5 km con GPS: Distance, Pace, Time; Ruta y dato aparece; las frases dicen «27:14 at 5:27/km».
{
  const f = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'correr', titulo: 'Correr', duracion_s: 1634, distancia_m: 5000, fc_media: 158 }, muestras: rutaRecta(5000) }));
  assert.deepEqual([f.datos.dist.v, f.datos.dist.u, f.datos.ritmo.v, f.datos.tiempo.v], ['5.00', 'km', '5:27', '27:14']);
  ['titular', 'firma', 'eco', 'grande', 'fila', 'ruta-dato', 'esquinas', 'ruta-escrita', 'cada-km'].forEach((id) => assert.ok(ids(f).includes(id), id));
  assert.ok(!ids(f).includes('mejor-km') && !ids(f).includes('parciales'), 'sin parciales (la lista no trae las vueltas)');
  assert.equal(fraseCorta(f, f.datos.dist), '27:14 at 5:27/km');
  assert.deepEqual(f.titulo, ['Morning', 'Run']);
  assert.equal(f.hora.v, '7:02');
  assert.equal(f.fecha, 'Oct 28, 2026');
  const rd = catalogo(f).find((s) => s.id === 'ruta-dato').r;
  assert.equal(rd.g.l, 'Distance');
  assert.deepEqual(rd.lista.map((d) => d.l), ['Time', 'Pace']);
}

// Bici: velocidad en km/h, sin ritmo. Natación: metros, ritmo por 100 m y largos.
{
  const bici = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'bici', duracion_s: 3600, distancia_m: 30000 } }));
  assert.deepEqual([bici.datos.vel.v, bici.datos.vel.u, bici.datos.ritmo], ['30.0', 'km/h', undefined]);
  const nado = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'natacion', duracion_s: 1800, distancia_m: 1500 } }));
  assert.deepEqual([nado.datos.dist.v, nado.datos.dist.u, nado.datos.ritmo.v, nado.datos.ritmo.u, nado.datos.largos.v], ['1,500', 'm', '2:00', '/100m', '60']);
}

// La ruta: solo si recorrió más de 300 m o se alejó más de 150 m del inicio. Un pádel en una cancha no dibuja nada.
{
  assert.equal(rutaDe(rutaRecta(120)), null, 'menos de 300 m y cerca del inicio: sin ruta');
  assert.ok(rutaDe(rutaRecta(400)), 'más de 300 m: con ruta');
  // Ir y volver muchas veces dentro de una cancha (suma > 300 m pero nunca a más de 20 m) cuenta como recorrido: la regla dice «o».
  const cancha = Array.from({ length: 60 }, (_, i) => ({ lat: 19.4 + ((i % 2) * 18) / 111195, lon: -99.1 }));
  assert.ok(rutaDe(cancha), 'suma más de 300 m');
  const quieto = Array.from({ length: 60 }, (_, i) => ({ lat: 19.4 + ((i % 2) * 2) / 111195, lon: -99.1 }));
  assert.equal(rutaDe(quieto), null, '118 m en total y a 2 m del inicio: sin ruta');
  const f = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'otro', titulo: 'Fútbol', duracion_s: 5400, kcal_activas: 820, fc_media: 152 }, muestras: rutaRecta(2000) }));
  assert.equal(f.datos.dist, undefined, 'la ruta no se vuelve «Distance»');
  assert.ok(ids(f).includes('ruta-dato'), 'pero sí sale la línea');
}

// Maratón: 42.20 km y 3:58:41 se escriben completos.
{
  const f = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'correr', duracion_s: 14321, distancia_m: 42200 } }));
  assert.deepEqual([f.datos.dist.v, f.datos.tiempo.v, f.datos.min.v], ['42.20', '3:58:41', '3h 59']);
}

// La ruta cabe en su cuadro sin deformarse; un entreno que no se movió no tiene forma.
{
  const pts = ajustaRuta([19.4, 19.41, 19.42], [-99.1, -99.1, -99.09], 248, 150, 10);
  assert.ok(pts.every(([x, y]) => x >= 10 - 1e-6 && x <= 238 + 1e-6 && y >= 10 - 1e-6 && y <= 140 + 1e-6));
  assert.equal(ajustaRuta([19.4, 19.4], [-99.1, -99.1], 248, 150), null);
}

// El título de la hoja: carrera, workout (del plan) o entreno.
assert.equal(tituloDeLaHoja({ deporte: 'correr' }), 'Comparte tu carrera');
assert.equal(tituloDeLaHoja({ deporte: 'correr', plan: true }), 'Comparte tu workout');
assert.equal(tituloDeLaHoja({ deporte: 'raqueta' }), 'Comparte tu entreno');

// Con las vueltas del entreno completo (getActividad): Parciales, Regla y Tu mejor kilómetro.
{
  const vueltas = [300, 290, 310, 280, 305].map((dur, i) => ({ tipo: 'km', n: i + 1, dur, dist: 1000 }));
  const f = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'correr', duracion_s: 1485, distancia_m: 5000, vueltas }, muestras: rutaRecta(5000) }));
  assert.deepEqual(f.splits, [300, 290, 310, 280, 305]);
  ['parciales', 'regla', 'mejor-km'].forEach((id) => assert.ok(ids(f).includes(id), id));
}

// Récord (sin plan): Titular · récord y Récord, en inglés, con la diferencia y la fecha del mejor anterior. «La primera vez» no es récord.
{
  const record = { tipo: 'distancia', texto: 'Tu distancia más larga', difNum: 1100, antesInicio: '2026-10-09T13:00:00Z', antesDesfase: -360 };
  const f = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'correr', duracion_s: 1900, distancia_m: 6100 }, record }));
  assert.deepEqual(f.record, { titulo: ['Run', 'PR'], en: 'Longest distance', grande: f.datos.dist, det: '1.10 km more than your best on Oct 9' });
  assert.ok(ids(f).includes('titular-pr') && ids(f).includes('record'));
  const primera = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'correr', duracion_s: 1900, distancia_m: 6100 }, record: { tipo: 'primera', texto: 'x' } }));
  assert.equal(primera.record, null);
}

// La semana, el mes y la racha salen del historial (lunes a domingo; el mismo tipo este año, contando este).
{
  const correr = { nombre: 'Correr', icono: 'correr' };
  const historial = [
    { id: 'h1', inicioMs: Date.parse('2026-10-26T13:00:00Z'), desfaseMin: -360, duracionS: 1800, distanciaM: 5000, tipo: correr }, // lunes
    { id: 'h2', inicioMs: Date.parse('2026-10-27T13:00:00Z'), desfaseMin: -360, duracionS: 3600, distanciaM: 0, tipo: { nombre: 'Gimnasio', icono: 'pesa' } },
    { id: 'h3', inicioMs: Date.parse('2026-10-02T13:00:00Z'), desfaseMin: -360, duracionS: 1500, distanciaM: 4000, tipo: correr },
    { id: 'h4', inicioMs: Date.parse('2025-12-30T13:00:00Z'), desfaseMin: -360, duracionS: 1500, distanciaM: 4000, tipo: correr }, // otro año
  ];
  const f = ficha(entrenoDeActividad({ fila: { ...base, id: 'yo', deporte: 'correr', duracion_s: 1634, distancia_m: 5000 }, tipo: correr, historial }));
  assert.equal(f.semana.total, 3);
  assert.equal(f.semana.hoy, 2, 'miércoles');
  assert.deepEqual(f.semana.dias.map((d) => d.length), [1, 1, 1, 0, 0, 0, 0]);
  assert.equal(f.mes.nombre, 'October');
  assert.equal(f.mes.total, 4);
  assert.deepEqual(f.mes.porTipo.map((x) => [x.tipo.nombre, x.n]), [['Correr', 3], ['Gimnasio', 1]]);
  assert.equal(f.racha, 3, 'tres de Correr este año, contando este');
  assert.ok(ids(f).includes('racha'));
}

// La frase larga: con distancia, fuerza y sin distancia.
{
  const carrera = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'correr', duracion_s: 1634, distancia_m: 5000 } }));
  assert.deepEqual(fraseLarga(carrera).map((r) => r.map((x) => x.t + (x.u ?? '')).join(' ')), ['5.00km', 'in 27:14', 'at 5:27/km']);
  const padel = ficha(entrenoDeActividad({ fila: { ...base, deporte: 'otro', titulo: 'Pádel', duracion_s: 4200, kcal_activas: 610 }, nombre: 'Pádel' }));
  assert.deepEqual(fraseLarga(padel).map((r) => r.map((x) => x.t + (x.u ?? '')).join(' ')), ['1h 10', 'of pádel', '· 610kcal']);
}

console.log('prueba-stickers: todo bien');
