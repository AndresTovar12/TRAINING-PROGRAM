// Prueba de la forma del atleta (src/lib/metricas/forma.js): días locales, condición/fatiga/forma, semanas, pulso máximo visto y recuperación.
//
//   node scripts/prueba-metricas-forma.mjs
import assert from 'node:assert/strict';
import {
  diaLocal, sumaDias, diasEntre, lunesDe, cargaPorDia, curvaDeForma, estadoDeForma, rampaDeCondicion, porSemana, cambioEnPorCiento, pulsoMaximoVisto,
  pulsoEnReposoMediano, resumenDeRecuperacion,
} from '../src/lib/metricas/forma.js';

const casi = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg ?? ''} esperaba ${b} ± ${tol}, salió ${a}`);

/* ---- Los días ---- */
{
  // 5:30 de la mañana en UTC es la noche del día anterior en México (UTC−6).
  assert.equal(diaLocal('2026-10-10T05:30:00Z', -360), '2026-10-09');
  assert.equal(diaLocal('2026-10-10T05:30:00Z', 0), '2026-10-10');
  assert.equal(diaLocal('2026-10-10T23:30:00Z', 120), '2026-10-11', 'con desfase positivo cruza al día siguiente');
  assert.equal(diaLocal(Date.parse('2026-10-10T12:00:00Z')), '2026-10-10', 'también acepta milisegundos');
  assert.equal(diaLocal('no es una fecha'), null);
  assert.equal(sumaDias('2026-10-31', 1), '2026-11-01');
  assert.equal(sumaDias('2026-03-01', -1), '2026-02-28');
  assert.equal(diasEntre('2026-10-01', '2026-10-10'), 9);
  assert.equal(diasEntre('2026-10-10', '2026-10-01'), -9);
  assert.equal(lunesDe('2026-10-10'), '2026-10-05', 'un sábado: su lunes');
  assert.equal(lunesDe('2026-10-05'), '2026-10-05', 'un lunes es su propio lunes');
  assert.equal(lunesDe('2026-10-11'), '2026-10-05', 'el domingo cierra la semana');
  assert.equal(lunesDe('2026-10-12'), '2026-10-12');
}

/* ---- La carga de cada día ---- */
{
  const m = cargaPorDia([
    { inicio: '2026-10-09T12:00:00Z', desfase_min: -360, carga: 60 },
    { inicio: '2026-10-09T23:00:00Z', desfase_min: -360, carga: 40 },
    { inicio: '2026-10-10T05:30:00Z', desfase_min: -360, carga: 20 }, // la noche del 9 en México
    { inicio: '2026-10-08T12:00:00Z', carga: 0 },
    { inicio: '2026-10-07T12:00:00Z' },
  ]);
  assert.equal(m.get('2026-10-09'), 120, 'tres entrenos del mismo día local se suman');
  assert.equal(m.has('2026-10-08'), false, 'sin carga no cuenta');
  assert.equal(m.size, 1);
  assert.equal(cargaPorDia(null).size, 0);
}

/* ---- Condición, fatiga y forma ---- */
{
  // Un día de 42 puntos: la condición sube 1 y la fatiga 6; la forma de ese día todavía no lo sabe (llegó en cero).
  const uno = curvaDeForma(new Map([['2026-01-01', 42]]), { desde: '2026-01-01', hasta: '2026-01-03' });
  assert.deepEqual(uno.map((d) => d.dia), ['2026-01-01', '2026-01-02', '2026-01-03']);
  assert.equal(uno[0].tsb, 0);
  assert.equal(uno[0].ctl, 1);
  assert.equal(uno[0].atl, 6);
  assert.equal(uno[1].tsb, -5, 'al día siguiente llega con la fatiga de ayer: 1 − 6');
  // 100 puntos todos los días: con el tiempo la condición y la fatiga se igualan en 100 y la forma en 0.
  const mapa = new Map(Array.from({ length: 250 }, (_, i) => [sumaDias('2026-01-01', i), 100]));
  const constante = curvaDeForma(mapa, { desde: '2026-01-01', hasta: sumaDias('2026-01-01', 249) });
  const fin = constante[constante.length - 1];
  casi(fin.ctl, 100, 1);
  casi(fin.atl, 100, 0.1);
  casi(fin.tsb, 0, 1);
  // Una semana de descanso: la fatiga cae rápido, la condición poco, y la forma se vuelve positiva.
  const reposo = curvaDeForma(mapa, { desde: '2026-01-01', hasta: sumaDias('2026-01-01', 256) });
  const despues = reposo[reposo.length - 1];
  assert.ok(despues.atl < 40 && despues.ctl > 75, `fatiga ${despues.atl}, condición ${despues.ctl}`);
  assert.ok(despues.tsb > 25, `descansado: ${despues.tsb}`);
  // Una semana de más: cargado.
  const subida = new Map(mapa);
  for (let i = 250; i < 257; i += 1) subida.set(sumaDias('2026-01-01', i), 220);
  const cargado = curvaDeForma(subida, { desde: '2026-01-01', hasta: sumaDias('2026-01-01', 256) });
  assert.ok(cargado[cargado.length - 1].tsb < -30, `muy cargado: ${cargado[cargado.length - 1].tsb}`);
  // Los estados.
  assert.equal(estadoDeForma(0, 3).clave, 'sin-base');
  assert.equal(estadoDeForma(30, 60).clave, 'descansado');
  assert.equal(estadoDeForma(10, 60).clave, 'fresco');
  assert.equal(estadoDeForma(0, 60).clave, 'equilibrio');
  assert.equal(estadoDeForma(-10, 60).clave, 'equilibrio', '−10 todavía es equilibrio');
  assert.equal(estadoDeForma(-11, 60).clave, 'productivo');
  assert.equal(estadoDeForma(-30, 60).clave, 'productivo');
  assert.equal(estadoDeForma(-31, 60).clave, 'riesgo');
  assert.deepEqual([30, 10, 0, -20, -40].map((t) => estadoDeForma(t, 60).tono), ['azul', 'verde', 'neutro', 'ambar', 'rojo']);
  // La rampa de la condición.
  assert.equal(rampaDeCondicion(uno), null, 'con menos de una semana de curva no hay rampa');
  const sube = constante.slice(0, 30);
  assert.ok(rampaDeCondicion(sube) > 7, 'al principio la condición sube rápido (unos 9 puntos por semana)');
  casi(rampaDeCondicion(constante), 0, 1, 'estable');
}

/* ---- Las semanas ---- */
{
  const hoy = '2026-10-10'; // sábado; su lunes es el 5
  const acts = [
    { inicio: '2026-10-05T14:00:00Z', desfase_min: -360, duracion_s: 3600, distancia_m: 10000, carga: 80, fc_media: 150, zonas_s: [600, 1800, 900, 300, 0], kcal_activas: 600 },
    { inicio: '2026-10-07T14:00:00Z', desfase_min: -360, duracion_s: 1800, distancia_m: 0, carga: 30, fc_media: 120, zonas_s: [900, 900, 0, 0, 0], kcal_activas: 200 },
    { inicio: '2026-09-30T14:00:00Z', desfase_min: -360, duracion_s: 2700, distancia_m: 7000, carga: 50, fc_media: 140, kcal_activas: 400 },
    { inicio: '2026-10-12T14:00:00Z', duracion_s: 600 }, // el futuro: no entra
    { inicio: '2020-01-01T14:00:00Z', duracion_s: 600 }, // muy viejo: no entra
  ];
  const s = porSemana(acts, { semanas: 4, hoy });
  assert.equal(s.length, 4);
  assert.deepEqual(s.map((x) => x.lunes), ['2026-09-14', '2026-09-21', '2026-09-28', '2026-10-05']);
  const esta = s[3];
  assert.equal(esta.sesiones, 2);
  assert.equal(esta.duracion_s, 5400);
  assert.equal(esta.distancia_m, 10000);
  assert.equal(esta.carga, 110);
  assert.equal(esta.kcal, 800);
  assert.equal(esta.fc_media, 140, 'pesa por duración: (150×3600 + 120×1800) / 5400 = 140');
  assert.deepEqual(esta.zonas_s, [1500, 2700, 900, 300, 0]);
  assert.equal(s[2].sesiones, 1);
  assert.equal(s[2].zonas_s.join(), '0,0,0,0,0', 'sin zonas guardadas, ceros');
  assert.equal(s[0].sesiones, 0);
  assert.equal(s[0].fc_media, null);
  assert.equal(cambioEnPorCiento(110, 50), 120);
  assert.equal(cambioEnPorCiento(40, 50), -20);
  assert.equal(cambioEnPorCiento(10, 0), null);
}

/* ---- El pulso más alto visto ---- */
{
  const hoy = '2026-10-10';
  const a = (fc, dia = '2026-10-01') => ({ inicio: `${dia}T12:00:00Z`, fc_max: fc });
  assert.equal(pulsoMaximoVisto([], { hoy }), null);
  assert.equal(pulsoMaximoVisto([a(185)], { hoy }), 185);
  assert.equal(pulsoMaximoVisto([a(238)], { hoy }), 210, 'con pocos entrenos un pico se topa en 210');
  assert.equal(pulsoMaximoVisto([a(90), a(60)], { hoy }), null, 'por debajo de 100 no es un máximo');
  // Con 10 entrenos, un pico de sensor (240) no manda: se toma el que deja a un 10 % por arriba.
  const muchos = [240, 186, 185, 184, 183, 182, 181, 180, 178, 175].map((v) => a(v));
  assert.equal(pulsoMaximoVisto(muchos, { hoy }), 186);
  // Lo viejo no cuenta.
  assert.equal(pulsoMaximoVisto([a(199, '2025-01-01'), a(180)], { hoy }), 180);
}

/* ---- La recuperación ---- */
{
  const hoy = '2026-10-10';
  const dias = (desde, hasta, campos) => {
    const filas = [];
    for (let d = desde; d <= hasta; d = sumaDias(d, 1)) filas.push({ dia: d, ...campos(d) });
    return filas;
  };
  // 45 días en lo normal (reposo 52, HRV 60, sueño 7.5 h): todo bien.
  const normal = dias('2026-08-27', hoy, () => ({ fc_reposo: 52, hrv_ms: 60, sueno_s: 7.5 * 3600 }));
  const bien = resumenDeRecuperacion(normal, { hoy });
  assert.equal(bien.veredicto.clave, 'bien');
  assert.equal(bien.reposo.estado, 'bien');
  assert.equal(bien.reposo.base, 52);
  assert.equal(bien.sueno.siete, 7.5);
  assert.equal(bien.sueno.unidad, 'h');
  // La última semana: el reposo sube 6 latidos y la HRV baja a 48 (−20 %): dos señales a la vez.
  const cargado = dias('2026-08-27', hoy, (d) => (d >= '2026-10-04' ? { fc_reposo: 58, hrv_ms: 48, sueno_s: 7 * 3600 } : { fc_reposo: 52, hrv_ms: 60, sueno_s: 7.5 * 3600 }));
  const c = resumenDeRecuperacion(cargado, { hoy });
  assert.equal(c.reposo.estado, 'atencion');
  assert.equal(c.hrv.estado, 'atencion');
  assert.equal(c.sueno.estado, 'bien');
  assert.equal(c.veredicto.clave, 'cargado');
  assert.equal(c.veredicto.tono, 'rojo');
  casi(c.hrv.diferencia, -0.2, 0.005);
  assert.equal(c.reposo.diferencia, 6);
  assert.equal(c.reposo.ultimo.valor, 58);
  // Una sola señal (poco sueño) = atención.
  const duerme = dias('2026-08-27', hoy, (d) => ({ fc_reposo: 52, hrv_ms: 60, sueno_s: d >= '2026-10-04' ? 5.5 * 3600 : 7.5 * 3600 }));
  const u = resumenDeRecuperacion(duerme, { hoy });
  assert.equal(u.veredicto.clave, 'atencion');
  assert.match(u.veredicto.detalle, /sueño/);
  // Sin datos.
  assert.equal(resumenDeRecuperacion([], { hoy }).veredicto.clave, 'sin-datos');
  // Con datos de la semana pero sin base (solo 3 días): el reposo y la HRV no opinan; el sueño sí (se juzga por horas).
  const pocos = dias('2026-10-08', hoy, () => ({ fc_reposo: 55, hrv_ms: 40, sueno_s: 8 * 3600 }));
  const p = resumenDeRecuperacion(pocos, { hoy });
  assert.equal(p.reposo.estado, 'sin-base');
  assert.equal(p.hrv.estado, 'sin-base');
  assert.equal(p.sueno.estado, 'bien');
  assert.equal(p.veredicto.clave, 'bien', 'el sueño solo sí puede decir algo');
  // La mediana del reposo, para las zonas y la carga.
  assert.equal(pulsoEnReposoMediano(normal, { hoy }), 52);
  assert.equal(pulsoEnReposoMediano([], { hoy }), null);
  assert.equal(pulsoEnReposoMediano(dias('2026-09-21', hoy, (d) => ({ fc_reposo: d < '2026-10-01' ? 60 : 50 })), { hoy }), 55, '10 días a 60 y 10 a 50: la mediana es 55');
}

console.log('prueba-metricas-forma: todo bien');
