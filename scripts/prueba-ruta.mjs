/* Pruebas de la ruta con GPS del entreno libre (lo puro): `node scripts/prueba-ruta.mjs`. */
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { agregaPunto, enVivo, trazoDeRuta, textoDeRitmo, usaGps, VENTANA_RITMO_S, MINIMO_RITMO_M } from '../src/lib/ubicacion.js';
import { analizaTraza, reproduceTraza } from '../src/lib/trazaGps.js';
import { calle, caminar, correr, pararDeGolpe, tunel } from './trazas-sinteticas.mjs';
import { preparaEntreno, construyeActividad } from '../src/lib/metricas/construye.js';
import { entrenoLibre, cronometroNuevo, pausa, reanuda, segundosDe } from '../src/lib/entrenoLibre.js';
import { carreraNueva, pasoDeCarrera } from '../src/lib/pasoDeCarrera.js';
import { actividadPorId, desplazamientoDe } from '../src/lib/actividades.js';
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

/* EL RITMO EN VIVO SALE DE LOS PUNTOS, COMO LA DISTANCIA (6 nov 2026, `docs/superpowers/specs/2026-11-06-ritmo-en-vivo.md`). Antes salía de la mediana de la
   velocidad que da el iPhone (`vel`), que en la carrera de ese día salió baja: marcaba 5:58, 6:17 y 6:25 /km a quien iba a 5:00. Ahora es la distancia de la ruta
   de los últimos 20 s entre esos segundos (null si avanzó menos de 15 m), suavizada con la mediana de los últimos 3 cálculos. Las trazas se reproducen con las
   mismas funciones que la carrera (`reproduceTraza` con `conRitmo`: el ritmo tal como se vería después de cada punto). */
{
  assert.equal(VENTANA_RITMO_S, 20);
  assert.equal(MINIMO_RITMO_M, 15);
  const rango = (ritmos, filas, desde, hasta = Infinity) => ritmos.filter((_, i) => filas[i].t > desde && filas[i].t <= hasta);
  const dentro = (xs, lo, hi, texto) => { assert.ok(xs.length > 0, `${texto}: sin puntos`); assert.ok(xs.every((x) => x != null && x >= lo && x <= hi), `${texto}: ${xs.join(',')} (se pedía ${lo}-${hi})`); };
  const minmax = (xs) => `${Math.min(...xs)}-${Math.max(...xs)}`;

  // 1. Correr parejo a 3.3 m/s (303 s/km = 5:03): entre 4:58 y 5:08 en todos los puntos después del segundo 25. A 1000/300 m/s (5:00), igual.
  const parejo = correr({ vel: 3.3 });
  const rParejo = reproduceTraza(parejo, { conRitmo: true });
  const ritmosParejo = rango(rParejo.ritmos, parejo.filas, 25);
  dentro(ritmosParejo, 298, 308, 'correr a 3.3 m/s');
  const parejo300 = correr();
  dentro(rango(reproduceTraza(parejo300, { conRitmo: true }).ritmos, parejo300.filas, 25), 298, 308, 'correr a 5:00');
  // Antes de tener 20 s de ruta no hay ritmo: nada se inventa.
  assert.ok(rango(rParejo.ritmos, parejo.filas, -1, 19).every((x) => x == null), 'con menos de 20 s de ruta no hay ritmo');

  // 2. HOY: la velocidad del iPhone 15 % más baja que el avance real. El ritmo sigue en 5:03 (con la velocidad habría salido 5:56).
  const lenta = { ...parejo, filas: parejo.filas.map((f) => ({ ...f, vel: Math.round(f.vel * 0.85 * 100) / 100 })) };
  const ritmosLenta = rango(reproduceTraza(lenta, { conRitmo: true }).ritmos, lenta.filas, 25);
  dentro(ritmosLenta, 298, 308, 'vel 15 % más baja');
  console.log(`  ritmo en vivo, correr a 3.3 m/s: ${minmax(ritmosParejo)} s/km · con vel 15 % más baja: ${minmax(ritmosLenta)} s/km`);

  // 3a. Parar de golpe (detenerse-de-golpe; sin pausa automática, para ver el ritmo solo): para a los 30 s y el ritmo pasa a null en menos de 25 s.
  const alto = pararDeGolpe();
  const rAlto = reproduceTraza(alto, { conRitmo: true, pausaAutomatica: false });
  const iNull = alto.filas.findIndex((f, i) => f.t >= 30 && rAlto.ritmos[i] == null);
  assert.ok(iNull >= 0 && alto.filas[iNull].t - 30 < 25, `parar de golpe: el ritmo pasa a null a los ${iNull >= 0 ? alto.filas[iNull].t - 30 : '—'} s`);
  dentro(rango(rAlto.ritmos, alto.filas, 25, 30), 298, 308, 'antes de parar');
  console.log(`  ritmo en vivo al parar de golpe: null a los ${Math.round(alto.filas[iNull].t - 30)} s (el GPS con error de 25 m ya no mete puntos)`);

  // 3b. Parar con buen GPS (los puntos siguen llegando, parados) 40 s y volver a correr: null en menos de 25 s de parar, y al reanudar vuelve.
  {
    let mm = [];
    const ritmos = [];
    let y = 0;
    for (let s = 0; s < 130; s += 1) {
      const corre = s < 40 || s >= 80;
      if (corre) y += 3.3;
      mm = agregaPunto(mm, { lat: 19.4 + y / metrosPorGradoLat, lon: -99.1 + (seed(s) * 0.4) / metrosPorGradoLat, precision: 6, vel: corre ? 3.3 : 0.1 }, s);
      ritmos.push(enVivo(mm, s).ritmoSKm);
    }
    const nulo = ritmos.findIndex((r, s) => s >= 40 && r == null);
    assert.ok(nulo >= 0 && nulo - 40 < 25, `parado con buen GPS: null a los ${nulo - 40} s`);
    assert.ok(ritmos.slice(nulo, 80).every((r) => r == null), 'parado: sigue en null hasta que se mueve');
    const vuelve = ritmos.findIndex((r, s) => s >= 80 && r != null);
    assert.ok(vuelve >= 80, 'al reanudar el ritmo vuelve');
    // Lo primero que sale al reanudar incluye el rato parado dentro de la ventana de 20 s (más lento), no el ritmo de antes de parar; a los 25 s de correr ya es el de verdad.
    assert.ok(ritmos[vuelve] > 400, `al reanudar lo primero que sale incluye el rato parado (${ritmos[vuelve]})`);
    dentro(ritmos.slice(105), 298, 308, 'a los 25 s de reanudar');
    console.log(`  ritmo en vivo, parar con buen GPS: null a los ${nulo - 40} s de parar; al reanudar sale a los ${vuelve - 80} s (${ritmos[vuelve]} s/km, el rato parado cuenta dentro de la ventana) y a los 25 s ya es ${ritmos[105]}`);
  }

  // 4. PAUSAS: la ventana no cruza una pausa. Corre 40 s a 3.3 m/s, pausa a mano, durante la pausa camina 80 m (en pausa no llegan puntos ni corre el tiempo),
  // reanuda y sigue corriendo. Sin marcar la pausa, el salto de 80 m en un segundo daba un ritmo falso de 3:30 /km; marcada, no hay ritmo hasta tener 20 s después.
  {
    const inicioMs = Date.parse('2026-11-06T15:00:00Z');
    const opciones = { sensor: null, pausaAutomatica: false };
    let e = carreraNueva({ ...cronometroNuevo('correr', inicioMs), gps: true, desplazamiento: 'pie' });
    let y = 0;
    const alSegundo = (s) => {
      const ms = inicioMs + s * 1000;
      e = pasoDeCarrera(e, { lat: 19.4 + y / metrosPorGradoLat, lon: -99.1, precision: 6, vel: 3.3 }, ms, opciones);
      return enVivo(e.muestras, segundosDe(e.cronometro, ms)).ritmoSKm;
    };
    for (let s = 0; s < 40; s += 1) { y += 3.3; alSegundo(s); }
    e = { ...e, cronometro: pausa(e.cronometro, inicioMs + 40000) };
    for (let s = 40; s < 70; s += 1) { y += 80 / 30; alSegundo(s); } // camina durante la pausa; los puntos no entran
    assert.equal(e.muestras.length, 40, 'en pausa no entra ningún punto');
    e = { ...e, cronometro: reanuda(e.cronometro, inicioMs + 70000), arranque: inicioMs + 70000 };
    const despues = [];
    for (let s = 70; s < 115; s += 1) { y += 3.3; despues.push(alSegundo(s)); }
    assert.equal(e.muestras.filter((x) => x.sp).length, 1, 'solo el primer punto tras la pausa queda marcado');
    assert.equal(e.muestras[40].sp, 1, 'el primer punto tras la pausa queda marcado');
    // Lo mismo sin la marca (como era): el salto de la pausa cae dentro de la ventana y el ritmo sale falso.
    const sinMarca = e.muestras.slice(0, 55).map(({ sp, ...x }) => x);
    const falso = enVivo(sinMarca).ritmoSKm;
    assert.ok(falso < 250, `sin marcar la pausa el ritmo saldría falso (${falso})`);
    assert.ok(despues.slice(0, 19).every((r) => r == null), `tras reanudar no hay ritmo hasta tener 20 s: ${despues.slice(0, 22).join(',')}`);
    dentro(despues.slice(23), 298, 308, 'pasados 20 s de reanudar');
    console.log(`  ritmo en vivo tras una pausa con 80 m caminados: sin ritmo ${despues.findIndex((r) => r != null)} s, luego ${despues[30]} s/km (sin marcar la pausa saldría ${falso})`);
  }

  // 5. HUECO DEL GPS (un túnel): sin ningún punto entre 20 y 30 s atrás no se inventa un ritmo; y sin puntos nuevos por más de 10 s tampoco se queda el último pegado.
  {
    const t = tunel(); // corriendo a 3.3 m/s; de los 40 a los 55 s ningún punto entra (error de 40-50 m)
    const r = reproduceTraza(t, { conRitmo: true });
    const dentroDelTunel = rango(r.ritmos, t.filas, 50, 54);
    assert.ok(dentroDelTunel.length > 0 && dentroDelTunel.every((x) => x == null), 'dentro del túnel no hay ritmo (el último ya no es de ahora)');
    dentro(rango(r.ritmos, t.filas, 76), 298, 308, 'pasado el túnel');
    assert.ok(r.ritmos.every((x) => x == null || (x >= 298 && x <= 308)), 'el túnel no inventa ritmos fuera de 4:58-5:08');
    // Sin punto entre 20 y 30 s atrás (hueco de 40 s en medio): null, aunque el último tramo ya tenga más de 15 m.
    let h = [];
    const punto = (s) => ({ lat: 19.4 + (s * 3.3) / metrosPorGradoLat, lon: -99.1, precision: 6, vel: 3.3 });
    for (let s = 0; s <= 60; s += 1) h = agregaPunto(h, punto(s), s);
    for (let s = 100; s <= 106; s += 1) h = agregaPunto(h, punto(s), s);
    assert.equal(enVivo(h).ritmoSKm, null, 'con un hueco de 40 s no hay ritmo');
    for (let s = 107; s <= 130; s += 1) h = agregaPunto(h, punto(s), s);
    dentro([enVivo(h).ritmoSKm], 298, 308, 'pasado el hueco');
    console.log(`  hueco del GPS (túnel de 15 s): ${r.ritmos.filter((x, i) => t.filas[i].t > 40 && t.filas[i].t < 80 && x == null).length} s sin ritmo en total, y nunca uno inventado`);
  }

  // 6. Quien más lee `ritmoSKm`: bici (velocidad = 3600 / ritmo) y nadar (ritmo por 100 m = ritmo / 10), con la `vel` del iPhone falsa: todo sale de los puntos.
  {
    const aMarcha = (v, velFalsa) => {
      let mm = [];
      for (let s = 0; s <= 60; s += 1) mm = agregaPunto(mm, { lat: 19.4 + (s * v) / metrosPorGradoLat, lon: -99.1, precision: 6, vel: velFalsa }, s);
      return enVivo(mm, 60).ritmoSKm;
    };
    assert.ok(Math.abs(aMarcha(8, 6.8) - 125) <= 1, 'bici a 8 m/s (28.8 km/h)');
    assert.ok(Math.abs(aMarcha(1, 0.85) - 1000) <= 5, 'nadar a 1 m/s: 1:40 por 100 m');
    assert.equal(aMarcha(0.5, 0.5), null, 'a menos de 15 m en 20 s (0.75 m/s) se dice parado');
  }
}

const t = trazoDeRuta(m, { ancho: 300, alto: 200, margen: 16 });
assert.ok(t.d.startsWith('M'));
assert.ok(t.inicio[1] > t.fin[1], 'hacia el norte = hacia arriba');
assert.equal(trazoDeRuta(m.slice(0, 1)), null);

assert.equal(textoDeRitmo(332), '5:32');
assert.equal(textoDeRitmo(null), '—');
assert.ok(usaGps('correr') && usaGps('natacion') && !usaGps('fuerza'));

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

// PAUSA AUTOMÁTICA SIN ACELERÓMETRO (la web; reglas del 3 nov 2026): el desplazamiento de 5 s. A pie pausa con < 0.6 m/s 3 s seguidos y reanuda con
// > 1.0 m/s 2 s; en bici, < 1.0 y > 2.0. Un punto por segundo con la velocidad dada (y la posición que le toca).
const soloGps = (velocidades, deporte = 'correr', { sinSenal = [] } = {}) => {
  let y = 0;
  const filas = [];
  velocidades.forEach((vel, t) => { y += vel; if (!sinSenal.includes(t)) filas.push({ t, lat: 19.4 + y / metrosPorGradoLat, lon: -99.1, pre: 6, vel }); });
  const r = reproduceTraza({ formato: 'traza-gps/3', deporte, inicioMs: 0, filas, eventos: [] }, { sinSensor: true });
  return [...r.pausas.map((en) => ({ accion: 'pausa', en })), ...r.reanudas.map((en) => ({ accion: 'reanuda', en }))].sort((p, q) => p.en - q.en);
};
// Un semáforo de 20 s: corre 30 s, se para 20 s, vuelve a correr. Más lento que con el rebote, pero sin falsos.
const semaforo = soloGps([...Array(30).fill(3.3), ...Array(20).fill(0), ...Array(15).fill(3.3)]);
assert.equal(semaforo.length, 2, `semáforo: ${JSON.stringify(semaforo)}`);
assert.ok(semaforo[0].accion === 'pausa' && semaforo[0].en - 30 <= 9, `semáforo sin acelerómetro: pausa a los ${semaforo[0].en - 30} s de parar`);
assert.ok(semaforo[1].accion === 'reanuda' && semaforo[1].en - 50 <= 5, `semáforo sin acelerómetro: reanuda a los ${semaforo[1].en - 50} s de arrancar`);
// Una lectura lenta suelta a media carrera: no pausa (cuenta lo que avanzó, no la velocidad del iPhone).
assert.equal(soloGps([...Array(20).fill(3.3), 0.2, ...Array(20).fill(3.3)]).length, 0, 'un segundo lento no pausa');
// Trote lento constante a 1.8 m/s: nunca pausa.
assert.equal(soloGps(Array(120).fill(1.8)).length, 0, 'trote lento no pausa');
// Bici a 1.5 m/s no pausa (su barra para pausar es 1.0); bici parada sí.
assert.equal(soloGps(Array(30).fill(1.5), 'bici').length, 0, 'bici lenta no pausa');
assert.equal(soloGps([...Array(10).fill(6), ...Array(15).fill(0)], 'bici')[0]?.accion, 'pausa', 'bici parada pausa');
// Se corta la señal 10 s corriendo: no pausa (sin señal no es estar parado).
assert.equal(soloGps(Array(40).fill(3), 'correr', { sinSenal: Array.from({ length: 10 }, (_, i) => 15 + i) }).length, 0, 'corte de señal no pausa');
// La marca de automática: se pone al pausar así y se quita al reanudar.
const c0 = cronometroNuevo('correr', 0);
const cp = pausa(c0, 1000, { automatica: true });
assert.equal(cp.automatica, true);
assert.equal(reanuda(cp, 3000).automatica, undefined);
assert.equal(reanuda(cp, 3000).pausas, 2000);

/* EL REBOTE Y EL GPS (3 nov 2026, `docs/superpowers/specs/2026-11-03-pausa-automatica-rebote.md`). Las situaciones de la calle se arman como TRAZAS
   (`scripts/trazas-sinteticas.mjs`, formato `traza-gps/3` de `lib/trazaGps.js`: los puntos y los avisos del sensor tal como llegan) y se reproducen con
   `reproduceTraza`, que pasa todo por las mismas funciones que la carrera (`pasoDeCarrera`). Las 8 de B6 están en `scripts/trazas/` y se revisan abajo,
   con las demás. */
{
  // 3 minutos quieto en la calle entre edificios, cinco sorteos. Con el rebote (parado no rebota): menos de 5 m y la pausa en menos de 10 s, sin reanudar sola.
  // Sin acelerómetro (la web) NO se exige: la pausa espera < 0.6 m/s de desplazamiento y el GPS «camina» a ~0.9 m/s; solo se dice cuánto sumó.
  const enLaWeb = [];
  for (let semilla = 1; semilla <= 5; semilla += 1) {
    const t = calle(semilla * 104729);
    const r = reproduceTraza(t);
    assert.ok(r.distanciaM < 5, `calle con rebote (sorteo ${semilla}) suma ${r.distanciaM} m`);
    assert.ok(r.pausas.length >= 1 && r.pausas[0] < 10, `calle con rebote (sorteo ${semilla}): pausa a los ${r.pausas[0]} s`);
    assert.equal(r.reanudas.length, 0, `calle con rebote (sorteo ${semilla}): se reanudó sola ${r.reanudas.length} veces`);
    const sin = reproduceTraza(t, { sinSensor: true });
    enLaWeb.push(`${sin.distanciaM} m${sin.pausas.length ? ` (pausa a los ${sin.pausas[0]} s)` : ' (sin pausa)'}`);
  }
  console.log(`  calle sin acelerómetro (la web), cinco sorteos: ${enLaWeb.join(', ')}`);

  // Caminar 200 m después de 20 s quieto: la distancia arranca en menos de 5 s de echar a andar y marca bien.
  {
    const t = caminar();
    const r = reproduceTraza(t);
    const arranca = t.filas.find((f, i) => r.metros[i] > 0).t - 20;
    assert.ok(r.pausas[0] < 10, `quieto antes de caminar: pausa a los ${r.pausas[0]} s`);
    assert.ok(arranca < 5, `caminando, la distancia arranca a los ${arranca} s`);
    assert.ok(Math.abs(r.distanciaM - 200) <= 6, `caminando 200 m da ${r.distanciaM} m`);
  }

  // Correr parejo con el rebote: lo mismo que sin sensor, sin pausas.
  {
    const t = correr();
    const con = reproduceTraza(t);
    const sin = reproduceTraza(t, { sinSensor: true });
    assert.equal(con.distanciaM, sin.distanciaM, `correr con rebote ${con.distanciaM} m, sin sensor ${sin.distanciaM} m`);
    assert.ok(Math.abs(con.distanciaM - 1250) < 15, `correr con rebote da ${con.distanciaM} m`);
    assert.equal(con.pausas.length, 0, 'correr con rebote no pausa');
  }

  // Las trazas de `scripts/trazas/`: las sintéticas (las 8 de B6 y la de la calle) y las que se graben en el iPhone con «Guardar traza del GPS» → «Exportar».
  // Por cada una se dice, PARADA POR PARADA, cuántos segundos tardó en pausar y en reanudar, y las pausas en falso (`analizaTraza`; las paradas de verdad, las
  // escritas en la traza o, sin ellas, las que se ven con el GPS mirando hacia adelante), y el rebote parado y en marcha (para ajustar `REBOTE_MINIMO`).
  // Lo que se les exige: «quieto-…»: menos de 5 m y la pausa en menos de 10 s · «corriendo-…»: ninguna pausa · y lo que diga su `esperado` (las sintéticas
  // lo traen). Las demás solo se reproducen.
  const carpeta = new URL('./trazas/', import.meta.url);
  for (const nombre of (existsSync(carpeta) ? readdirSync(carpeta) : []).filter((n) => n.endsWith('.json')).sort()) {
    const t = JSON.parse(readFileSync(new URL(nombre, carpeta), 'utf8'));
    const r = reproduceTraza(t);
    const a = analizaTraza(t, r);
    const e = t.esperado ?? {};
    const paradas = a.paradas.map((p) => `${p.desde}-${p.hasta} s: pausa ${p.pausaS ?? '—'} s, reanuda ${p.reanudaS ?? '—'} s`).join(' · ') || 'sin paradas';
    console.log(`  traza ${nombre}: ${r.distanciaM} m · ${paradas} · en falso: ${a.enFalso.length ? a.enFalso.join(', ') : 'ninguna'}${a.rebote.parado || a.rebote.enMarcha ? ` · rebote parado ${a.rebote.parado?.join('/') ?? '—'} g, en marcha ${a.rebote.enMarcha?.join('/') ?? '—'} g (p10/p50/p90)` : ''}`);
    if (nombre.startsWith('quieto-')) {
      assert.ok(r.distanciaM < 5, `${nombre}: quieto suma ${r.distanciaM} m`);
      assert.ok(r.pausas.length >= 1 && r.pausas[0] < 10, `${nombre}: la pausa entra a los ${r.pausas[0]} s`);
    }
    if (nombre.startsWith('corriendo-') || e.sinPausas) assert.equal(r.pausas.length, 0, `${nombre}: pausó a los ${r.pausas.join(', ')} s`);
    if (e.maxMetros != null) assert.ok(r.distanciaM <= e.maxMetros, `${nombre}: suma ${r.distanciaM} m (tope ${e.maxMetros})`);
    // Lo que la traza marca `pendiente` (el contrato lo pide y con sus reglas no se puede; lo decide el dueño) se dice, sin fallar.
    const exige = (llave, ok, texto) => { if ((e.pendiente ?? []).includes(llave)) { if (!ok) console.log(`  PENDIENTE (no cumple el contrato): ${texto}`); } else assert.ok(ok, texto); };
    if (e.pausaAntesDe != null) exige('pausaAntesDe', r.pausas.length >= 1 && r.pausas[0] <= e.pausaAntesDe, `${nombre}: la pausa entra a los ${r.pausas[0]} s (tope ${e.pausaAntesDe})`);
    if (e.sinReanudarAntesDe != null) assert.ok(!r.reanudas.some((x) => x < e.sinReanudarAntesDe), `${nombre}: se reanudó a los ${r.reanudas.join(', ')} s`);
    if (e.reanudaAntesDe != null) assert.ok(r.reanudas.some((x) => x >= (e.sinReanudarAntesDe ?? 0) && x <= e.reanudaAntesDe), `${nombre}: reanuda a los ${r.reanudas.join(', ') || '—'} s (tope ${e.reanudaAntesDe})`);
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

// NADAR EN EL IPHONE (6 nov 2026): lleva mapa, pero nadando a 1 m/s no se pausa solo. Con el mismo ritmo, una bici sí se pausa: su regla no cambió.
{
  const inicioMs = Date.parse('2026-11-06T15:00:00Z');
  const nada = (actividadId, deporte, velocidad) => {
    const act = actividadPorId(actividadId);
    let e = carreraNueva({ ...cronometroNuevo(deporte, inicioMs), gps: true, desplazamiento: desplazamientoDe(act), actividad: { id: act.id, gps: act.gps } });
    let pausas = 0;
    for (let s = 0; s <= 600; s += 1) {
      const punto = { lat: 21.1 + (s * velocidad) / metrosPorGradoLat, lon: -86.7, precision: 8, vel: velocidad };
      e = pasoDeCarrera(e, punto, inicioMs + s * 1000, { sensor: null, pausaAutomatica: true });
      if (e.accion === 'pausa') pausas += 1;
    }
    return { pausas, pausado: e.cronometro.pausadoEn != null, metros: e.metros };
  };
  assert.equal(desplazamientoDe(actividadPorId('natacion')), 'ruedas');
  const nado = nada('natacion', 'natacion', 1);
  assert.equal(nado.pausas, 0, 'nadar a 1 m/s no se pausa nunca');
  assert.equal(nado.pausado, false);
  assert.ok(nado.metros > 550 && nado.metros < 650, `10 min a 1 m/s son ~600 m (${nado.metros})`);
  assert.equal(nada('natacion', 'natacion', 0.1).pausas, 0, 'ni flotando: en el agua solo se pausa a mano');
  assert.equal(nada('bici', 'bici', 1).pausado, true, 'la bici a 1 m/s sí se pausa (su regla no cambió)');
  assert.equal(nada('remo', 'remo', 0.5).pausado, true, 'el remo tampoco cambió');
  // La pausa a mano de nadar sigue igual, y no se quita sola.
  let e = carreraNueva(pausa({ ...cronometroNuevo('natacion', inicioMs), gps: true, desplazamiento: 'ruedas' }, inicioMs + 1000));
  e = pasoDeCarrera(e, { lat: 21.1, lon: -86.7, precision: 8, vel: 3 }, inicioMs + 5000, { sensor: null, pausaAutomatica: true });
  assert.notEqual(e.cronometro.pausadoEn, null);
}

console.log('prueba-ruta: todo bien');
