// Prueba de la lógica pura de los formatos de un Set (src/lib/formatos.js) y de su reloj
// (src/lib/relojDeFormato.js): los formatos con nombre, limpiar lo que llega de fuera, los tramos
// que corre el reloj y el reloj mismo con horas inventadas.
//
//   node scripts/prueba-formatos.mjs
import assert from 'node:assert/strict';
import {
  FORMATOS, IDS_DE_FORMATOS, formatoNuevo, comoPersonalizado, limpiaFormato, vistaDe, nombreDeFormato, expande,
  segundosTotales, tramosDeTrabajo, etiquetaDeTramo, resumenDeFormato, formatoDeMiembros, ponFormato, textoDeTiempo,
  relojTexto, pasoDeEscala, textoDeResultado, limpiaResultado, MAX_TRAMOS,
} from '../src/lib/formatos.js';
import {
  nuevoReloj, inicia, pausa, avanza, listo, termina, sumaRonda, vista, sugerido, reanuda,
} from '../src/lib/relojDeFormato.js';

const SEG = 1000;

/* ---- Cada formato con nombre nace limpio y se reconoce a sí mismo ---- */
for (const id of IDS_DE_FORMATOS) {
  const f = formatoNuevo(id);
  assert.deepEqual(limpiaFormato(f), f, `${id}: lo que crea el formato ya viene limpio`);
  assert.equal(vistaDe(f), id, `${id}: se enseña como él mismo`);
  assert.ok(expande(f, 2).length > 0, `${id}: trae tramos`);
}
assert.equal(formatoNuevo('no-existe').id, 'custom', 'un id desconocido cae en Personalizado');

/* ---- Los números del editor salen de los tramos y vuelven a ellos ---- */
const tab = formatoNuevo('tabata');
const { trab, desc, rondas } = FORMATOS.tabata.campos;
assert.deepEqual([trab.lee(tab), desc.lee(tab), rondas.lee(tab)], [20, 10, 8]);
const tab2 = rondas.pon(desc.pon(trab.pon(tab, 30), 15), 6);
assert.deepEqual(tab2.pasos.map((p) => p.seg), [30, 15]);
assert.equal(tab2.vueltas, 6);
assert.equal(tab.pasos[0].seg, 20, 'poner un número no toca el formato de antes');
assert.equal(resumenDeFormato(tab2), 'Tabata · 30 s + 15 s × 6', 'un Tabata de otros números sigue siendo Tabata');
const am = formatoNuevo('amrap');
assert.equal(FORMATOS.amrap.campos.min.lee(am), 720);
assert.equal(FORMATOS.amrap.campos.min.pon(am, 900).pasos[0].seg, 900);
const pt = formatoNuevo('portiempo');
assert.equal(FORMATOS.portiempo.campos.tope.lee(pt), 0, 'sin tope se lee como 0');
assert.equal(FORMATOS.portiempo.campos.tope.pon(pt, 900).tope, 900);
assert.equal(FORMATOS.portiempo.campos.tope.pon(FORMATOS.portiempo.campos.tope.pon(pt, 900), 0).tope, null, '0 quita el tope');

/* ---- Si los tramos ya no tienen la forma del formato, se enseña como Personalizado ---- */
const tresPasos = { ...tab, pasos: [...tab.pasos, { tipo: 'trabajo', seg: 5 }] };
assert.equal(vistaDe(tresPasos), 'custom', 'un Tabata con un tramo de más ya no es un Tabata');
assert.equal(vistaDe({ ...am, vueltas: 3 }), 'custom', 'un AMRAP que se repite tampoco');
assert.equal(vistaDe(comoPersonalizado(tab)), 'custom');
assert.deepEqual(comoPersonalizado(tab).pasos, tab.pasos, 'pasar a Personalizado conserva los tramos para retocarlos');
// El trabajo «hasta Listo» sí cabe en Intervalos (series de pista) y no en Tabata.
const pista = { ...formatoNuevo('intervalos'), pasos: [{ tipo: 'trabajo', seg: null }, { tipo: 'descanso', seg: 90 }], vueltas: 8 };
assert.equal(vistaDe(pista), 'intervalos');
assert.equal(vistaDe({ ...pista, id: 'tabata' }), 'custom');
assert.equal(resumenDeFormato(pista), 'Intervalos · «Listo» + 1:30 × 8');

/* ---- Limpiar lo que llega de fuera ---- */
assert.equal(limpiaFormato(null), null);
assert.equal(limpiaFormato({}), null);
assert.equal(limpiaFormato({ pasos: 'x' }), null);
assert.equal(limpiaFormato({ pasos: [] }), null);
assert.equal(limpiaFormato({ pasos: [{ tipo: 'trabajo', seg: 'abc' }] }), null, 'un tramo sin tiempo ni «Listo» no se adivina');
const raro = limpiaFormato({
  id: 'inventado', nombre: 'Pirámide', vueltas: '3.7', tope: '90', turnan: 'si', anota: 'dolor',
  pasos: [{ tipo: 'raro', seg: '45.4', etiqueta: 'Fuerte' }, null, { seg: 'x' }, { tipo: 'descanso', seg: null }],
});
assert.deepEqual(raro, {
  id: 'custom', nombre: 'Pirámide', pasos: [{ tipo: 'trabajo', seg: 45, etiqueta: 'Fuerte' }, { tipo: 'descanso', seg: null }],
  vueltas: 4, tope: 90, turnan: false, anota: 'nada',
});
assert.equal(limpiaFormato({ id: 'amrap', nombre: 'Otro', pasos: [{ tipo: 'trabajo', seg: 60 }] }).nombre, undefined, 'solo Personalizado lleva nombre propio');
assert.equal(limpiaFormato({ pasos: [{ tipo: 'trabajo', seg: -5 }] }).pasos[0].seg, 0, 'un tiempo negativo se queda en 0');
assert.equal(limpiaFormato({ pasos: [{ tipo: 'trabajo', seg: 99999999 }] }).pasos[0].seg, 6 * 3600, 'los tiempos tienen techo');
const enorme = limpiaFormato({ pasos: Array.from({ length: 200 }, () => ({ tipo: 'trabajo', seg: 5 })), vueltas: 9999 });
assert.equal(enorme.pasos.length, 60, 'no más de 60 tramos por vuelta');
assert.ok(expande(enorme).length <= MAX_TRAMOS, 'ni un reloj de miles de tramos');
assert.ok(expande({ ...formatoNuevo('emom'), vueltas: 99, turnan: true }, 40).length <= MAX_TRAMOS, 'los ejercicios que se turnan tampoco rompen el tope');
assert.equal(nombreDeFormato(raro), 'Pirámide');
assert.equal(nombreDeFormato(tresPasos), 'Personalizado', 'unos tramos que ya no son un Tabata no se llaman Tabata');
// Los espacios de lo que se está tecleando se respetan («Muy fuerte»); un nombre en blanco no cuenta.
assert.equal(limpiaFormato({ id: 'custom', nombre: 'Muy ', pasos: [{ tipo: 'trabajo', seg: 5, etiqueta: 'Muy ' }] }).pasos[0].etiqueta, 'Muy ');
assert.equal(limpiaFormato({ id: 'custom', nombre: '   ', pasos: [{ tipo: 'trabajo', seg: 5, etiqueta: '  ' }] }).nombre, undefined);
assert.equal(limpiaFormato({ id: 'custom', nombre: '   ', pasos: [{ tipo: 'trabajo', seg: 5, etiqueta: '  ' }] }).pasos[0].etiqueta, undefined);
assert.equal(nombreDeFormato(am), 'AMRAP');
assert.equal(nombreDeFormato(null), 'Formato');

/* ---- Los tramos ---- */
const plan = expande(tab);
assert.equal(plan.length, 16);
assert.deepEqual(plan.slice(0, 3).map((t) => [t.tipo, t.seg, t.vuelta, t.ejercicio]), [['trabajo', 20, 1, null], ['descanso', 10, 1, null], ['trabajo', 20, 2, null]]);
assert.equal(segundosTotales(tab), 240, 'un Tabata dura 4 minutos');
assert.equal(segundosTotales(am), 720);
assert.equal(segundosTotales(formatoNuevo('emom')), 600);
assert.equal(segundosTotales(pt), null, 'con un tramo «hasta Listo» no hay total');
assert.equal(tramosDeTrabajo(tab), 8);
// Un EMOM de 1 min, 5 vueltas, dos ejercicios que se turnan: 10 minutos, A y B por turnos.
const alterna = { ...formatoNuevo('emom'), vueltas: 5, turnan: true };
const tramosAlterna = expande(alterna, 2);
assert.equal(tramosAlterna.length, 10);
assert.deepEqual(tramosAlterna.map((t) => t.ejercicio), [0, 1, 0, 1, 0, 1, 0, 1, 0, 1]);
assert.equal(segundosTotales(alterna, 2), 600);
assert.equal(expande(alterna, 1).length, 5, 'con un solo ejercicio no hay a quién turnar');
assert.ok(expande(alterna, 1).every((t) => t.ejercicio === null));
// Tabata de 4 ejercicios, 2 vueltas: cada ejercicio hace su 20 + 10, dos veces.
const circuito = { ...formatoNuevo('tabata'), vueltas: 2, turnan: true };
assert.equal(expande(circuito, 4).length, 16);
assert.equal(segundosTotales(circuito, 4), 240);
// Hyrox: una pasada, un tramo «hasta Listo» por estación.
const hyrox = { ...formatoNuevo('portiempo'), vueltas: 1, turnan: true };
assert.deepEqual(expande(hyrox, 8).map((t) => t.ejercicio), [0, 1, 2, 3, 4, 5, 6, 7]);
// Los tramos de 0 segundos no existen (un Tabata sin descanso).
assert.equal(expande({ ...tab, pasos: [tab.pasos[0], { tipo: 'descanso', seg: 0 }] }).length, 8);
assert.equal(etiquetaDeTramo({ tipo: 'trabajo', etiqueta: '' }), 'Trabajo');
assert.equal(etiquetaDeTramo({ tipo: 'descanso', etiqueta: '' }), 'Descanso');
assert.equal(etiquetaDeTramo({ tipo: 'descanso', etiqueta: 'Suave' }), 'Suave');

/* ---- Resúmenes ---- */
assert.equal(resumenDeFormato(am), 'AMRAP · 12 min');
assert.equal(resumenDeFormato(formatoNuevo('emom')), 'EMOM · 10 min');
assert.equal(resumenDeFormato({ ...formatoNuevo('emom'), pasos: [{ tipo: 'trabajo', seg: 120 }], vueltas: 5 }), 'EMOM · cada 2 min × 5');
assert.equal(resumenDeFormato(tab), 'Tabata · 20 s + 10 s × 8');
assert.equal(resumenDeFormato(formatoNuevo('fartlek')), 'Fartlek · 2 min + 3 min × 6');
assert.equal(resumenDeFormato(pt), 'Por tiempo · 3 rondas');
assert.equal(resumenDeFormato({ ...pt, vueltas: 1, tope: 900 }), 'Por tiempo · 1 ronda · tope 15 min');
assert.equal(resumenDeFormato(formatoNuevo('custom')), 'Personalizado · 10 tramos · 7:30');
assert.equal(resumenDeFormato({ ...formatoNuevo('custom'), nombre: 'Pirámide' }), 'Pirámide · 10 tramos · 7:30');
assert.equal(resumenDeFormato(null), '');

/* ---- El formato dentro de los ejercicios del Set ---- */
const miembros = [{ name: 'Sentadilla', sets: '3' }, { name: 'Flexiones', sets: '3', set: 1 }];
const con = ponFormato(miembros, tab);
assert.deepEqual(con.map((m) => m.sets), ['8', '8'], 'las series pasan a ser las vueltas');
assert.deepEqual(con[0].formato, tab);
assert.notEqual(con[0].formato, con[1].formato, 'cada ejercicio guarda su copia');
assert.equal(miembros[0].formato, undefined, 'no toca los ejercicios de antes');
assert.deepEqual(formatoDeMiembros(con), tab);
assert.deepEqual(formatoDeMiembros([{ name: 'A' }, { name: 'B', formato: tab }]), tab, 'basta con que uno lo traiga');
assert.equal(formatoDeMiembros([{ isNote: true, formato: tab }]), null);
assert.equal(formatoDeMiembros([]), null);
const sin = ponFormato(con, null);
assert.ok(sin.every((m) => !('formato' in m)), 'quitar el formato lo borra de todos');
assert.equal(sin[0].sets, '8', 'y las series se quedan como estaban');
assert.equal(ponFormato([{ name: 'A' }], null)[0].formato, undefined);
assert.equal(ponFormato([{ name: 'A' }], { pasos: 'basura' })[0].formato, undefined, 'un formato inservible tampoco se pone');

/* ---- Tiempos ---- */
assert.deepEqual([20, 60, 90, 720, 0].map(textoDeTiempo), ['20 s', '1 min', '1:30', '12 min', '0 s']);
assert.deepEqual([0, 20, 754, 3665].map(relojTexto), ['00:00', '00:20', '12:34', '1:01:05']);
assert.equal(pasoDeEscala(20, 1), 25);
assert.equal(pasoDeEscala(30, 1), 40);
assert.equal(pasoDeEscala(60, 1), 75);
assert.equal(pasoDeEscala(120, 1), 150);
assert.equal(pasoDeEscala(20, -1), 15);
assert.equal(pasoDeEscala(5, -1, 5), 5, 'no baja del mínimo');
assert.equal(pasoDeEscala(5400, 1, 0, 5400), 5400, 'ni sube del máximo');
assert.equal(pasoDeEscala(47, 1), 50, 'un valor fuera de la escala va al más cercano en esa dirección');
assert.equal(pasoDeEscala(47, -1), 45);

/* ---- Lo que anota el atleta ---- */
assert.equal(textoDeResultado(null), '');
assert.equal(textoDeResultado({ anota: 'rondas', valor: 7, extra: 3 }), '7 rondas + 3 reps');
assert.equal(textoDeResultado({ anota: 'rondas', valor: 1, extra: 1 }), '1 ronda + 1 rep');
assert.equal(textoDeResultado({ anota: 'rondas', valor: 5, extra: 0 }), '5 rondas');
assert.equal(textoDeResultado({ anota: 'tiempo', valor: 754 }), '12:34');
assert.equal(textoDeResultado({ anota: 'reps', valor: 45 }), '45 reps');
assert.equal(textoDeResultado({ anota: 'km', valor: 3.2 }), '3.2 km');
assert.equal(textoDeResultado({ anota: 'm', valor: 800 }), '800 m');
assert.equal(textoDeResultado({ anota: 'cal', valor: 120 }), '120 cal');
assert.equal(textoDeResultado({ anota: 'cumplido', valor: 8, de: 10 }), '8 de 10 tramos');
assert.equal(textoDeResultado({ anota: 'cumplido', valor: 1, de: 1 }), '1 de 1 tramo');
assert.equal(textoDeResultado({ anota: 'km', valor: null }), 'Hecho', 'sin número, solo «Hecho»');
assert.equal(textoDeResultado({ anota: 'nada' }), 'Hecho');
assert.deepEqual(limpiaResultado({ anota: 'rondas', valor: '7', extra: '', seg: '720.4', tramos: [20, 'x', 10], de: 8, basura: 1 }), {
  anota: 'rondas', valor: 7, extra: null, seg: 720, tramos: [20, 10], de: 8,
});
assert.equal(limpiaResultado({ anota: 'dolor', valor: 3 }).anota, 'nada');
assert.equal(limpiaResultado({ anota: 'reps', valor: -4 }).valor, 0, 'no hay repeticiones negativas');
assert.equal(limpiaResultado(null), null);
{
  // La huella de cada tramo (ventanas y lapsos) se limpia: lo que no es número o no tiene la forma se descarta, y nada queda vacío.
  const r = limpiaResultado({
    anota: 'cumplido', valor: 2, tramos: [30, 40], de: 2,
    ventanas: [[1000.4, 31000], ['x', 5], [31000, 71000], [1]],
    lapsos: [{ tipo: 'trabajo', plan: 30, etiqueta: 'Sprint', texto: '400 m', vuelta: 1 }, null, { tipo: 'raro', plan: null, vuelta: 'x' }],
  });
  assert.deepEqual(r.ventanas, [[1000, 31000], [31000, 71000]]);
  assert.deepEqual(r.lapsos, [{ tipo: 'trabajo', plan: 30, etiqueta: 'Sprint', texto: '400 m', vuelta: 1 }, { tipo: 'trabajo', plan: null, etiqueta: '', texto: '', vuelta: 1 }]);
  assert.equal('ventanas' in limpiaResultado({ anota: 'nada', ventanas: [] }), false, 'sin ventanas no se guarda un arreglo vacío');
  assert.equal(limpiaResultado({ anota: 'nada', ventanas: Array.from({ length: MAX_TRAMOS + 50 }, (_, i) => [i, i + 1]) }).ventanas.length, MAX_TRAMOS);
}

/* ---- El reloj ---- */
const T0 = 1_000_000;
const corre = (f, nEj = 1) => ({ f, plan: expande(f, nEj), tope: f.tope });
const arranca = (c) => inicia(nuevoReloj(), T0);
const al = (c, est, seg) => avanza(est, c.plan, T0 + seg * SEG, c.tope);
const ve = (c, est, seg) => vista(est, c.plan, T0 + seg * SEG, c.tope);

// AMRAP de 12 min: un tramo hacia atrás; al llegar a cero termina solo.
{
  const c = corre(am);
  let e = arranca(c);
  assert.equal(ve(c, e, 0).restanteSeg, 720);
  e = al(c, e, 719);
  assert.equal(ve(c, e, 719).restanteSeg, 1, 'la cuenta regresiva redondea hacia arriba: 1, no 0');
  assert.equal(e.fase, 'corriendo');
  e = al(c, e, 720);
  assert.equal(e.fase, 'fin');
  assert.equal(e.motivo, 'completo');
  assert.equal(ve(c, e, 720).totalSeg, 720);
  e = sumaRonda(sumaRonda(sumaRonda(e, 1), 1), 1);
  assert.equal(e.rondas, 3);
  assert.equal(sumaRonda(e, -10).rondas, 0, 'las rondas no bajan de cero');
}

// EMOM de 3 minutos: cada minuto cambia de tramo.
{
  const c = corre({ ...formatoNuevo('emom'), vueltas: 3 });
  let e = arranca(c);
  e = al(c, e, 61);
  assert.equal(e.i, 1);
  assert.equal(ve(c, e, 61).restanteSeg, 59);
  assert.equal(ve(c, e, 61).totalSeg, 61);
  e = al(c, e, 185);
  assert.equal(e.fase, 'fin');
  assert.deepEqual(e.hechos, [60, 60, 60]);
}

// Pausa y reanudar: el tiempo parado no cuenta.
{
  const c = corre({ ...formatoNuevo('emom'), vueltas: 3 });
  let e = arranca(c);
  e = pausa(al(c, e, 30), T0 + 30 * SEG);
  assert.equal(e.fase, 'pausa');
  assert.equal(avanza(e, c.plan, T0 + 500 * SEG), e, 'en pausa el reloj no avanza');
  e = inicia(e, T0 + 100 * SEG);
  e = avanza(e, c.plan, T0 + 140 * SEG);
  assert.equal(e.i, 1, '30 s + 40 s = 70 s corridos: ya va en el segundo minuto');
  assert.equal(ve(c, e, 140).transcurridoSeg, 10);
  assert.equal(inicia(e, T0 + 150 * SEG), e, 'darle inicia a uno que corre no hace nada');
}

// La pantalla durmió: al despertar salta los tramos que se acabaron, sin perder el ritmo.
{
  const c = corre(tab);
  let e = arranca(c);
  e = al(c, e, 95);
  assert.equal(e.i, 6, '95 s = tres Tabata de 30 s y 5 s más: va en el trabajo de la cuarta vuelta');
  assert.equal(ve(c, e, 95).transcurridoSeg, 5);
  assert.equal(ve(c, e, 95).restanteSeg, 15);
  assert.equal(e.hechos.length, 6);
  assert.equal(ve(c, e, 95).tramo.vuelta, 4);
  e = al(c, e, 10_000);
  assert.equal(e.fase, 'fin');
  assert.equal(ve(c, e, 10_000).totalSeg, 240, 'el total es el del formato, no el de la hora en que se despertó');
}

// Por tiempo: cada «Listo» cierra un tramo; el último termina todo.
{
  const c = corre({ ...pt, vueltas: 3 });
  let e = arranca(c);
  assert.equal(ve(c, e, 50).restanteSeg, null, 'un tramo sin tiempo cuenta hacia adelante');
  assert.equal(ve(c, e, 50).transcurridoSeg, 50);
  e = listo(e, c.plan, T0 + 100 * SEG, c.tope);
  assert.deepEqual([e.i, e.hechos], [1, [100]]);
  e = listo(e, c.plan, T0 + 230 * SEG, c.tope);
  assert.deepEqual(e.hechos, [100, 130]);
  e = listo(e, c.plan, T0 + 400 * SEG, c.tope);
  assert.equal(e.fase, 'fin');
  assert.equal(e.motivo, 'completo');
  assert.deepEqual(e.hechos, [100, 130, 170], 'los parciales de cada ronda');
  assert.equal(ve(c, e, 400).totalSeg, 400);
  const { ventanas, lapsos, ...resto } = sugerido(e, c.plan);
  assert.deepEqual(resto, { seg: 400, rondas: 0, tramos: [100, 130, 170], completados: 3, de: 3 });
  assert.deepEqual(ventanas, [[T0, T0 + 100 * SEG], [T0 + 100 * SEG, T0 + 230 * SEG], [T0 + 230 * SEG, T0 + 400 * SEG]], 'cada «Listo» cierra una ventana y abre la siguiente');
  assert.deepEqual(lapsos.map((l) => [l.tipo, l.vuelta]), [['trabajo', 1], ['trabajo', 2], ['trabajo', 3]], 'la huella de cada tramo hecho');
}

// Con tope: corta en medio de un tramo y el total es el tope.
{
  const c = corre({ ...pt, vueltas: 3, tope: 150 });
  let e = arranca(c);
  e = listo(e, c.plan, T0 + 100 * SEG, c.tope);
  assert.equal(ve(c, e, 120).topeRestanteSeg, 30);
  e = avanza(e, c.plan, T0 + 149 * SEG, c.tope);
  assert.equal(e.fase, 'corriendo');
  e = avanza(e, c.plan, T0 + 151 * SEG, c.tope);
  assert.equal(e.fase, 'fin');
  assert.equal(e.motivo, 'tope');
  assert.equal(ve(c, e, 151).totalSeg, 150);
  const { ventanas, lapsos, ...resto } = sugerido(e, c.plan);
  assert.deepEqual(resto, { seg: 150, rondas: 0, tramos: [100], completados: 1, de: 3 });
  assert.deepEqual(ventanas, [[T0, T0 + 100 * SEG]], 'el tramo que cortó el tope no tiene ventana: no se completó');
  assert.equal(lapsos.length, 1);
}

// El tope también corta cuando la pantalla durmió pasado el tope en un tramo con tiempo.
{
  const c = corre({ ...formatoNuevo('tabata'), tope: 100 });
  let e = arranca(c);
  e = avanza(e, c.plan, T0 + 1000 * SEG, c.tope);
  assert.equal(e.motivo, 'tope');
  assert.equal(ve(c, e, 1000).totalSeg, 100);
}

// Terminar antes de tiempo: lo corrido cuenta; «Listo» en un tramo con tiempo lo salta.
{
  const c = corre(am);
  let e = arranca(c);
  e = termina(e, c.plan, T0 + 45 * SEG, c.tope);
  assert.equal(e.motivo, 'manual');
  assert.equal(ve(c, e, 45).totalSeg, 45);
  assert.equal(termina(e, c.plan, T0 + 99 * SEG), e, 'terminar dos veces no cambia nada');
  assert.equal(termina(nuevoReloj(), c.plan, T0).motivo, 'manual', 'terminar sin haber empezado también es terminar');
  const d = corre(tab);
  let x = arranca(d);
  x = listo(x, d.plan, T0 + 8 * SEG);
  assert.deepEqual([x.i, x.hechos], [1, [8]], '«Listo» salta el resto de un tramo con tiempo');
}

// Un plan vacío no se queda colgado.
{
  const x = avanza(inicia(nuevoReloj(), T0), [], T0 + SEG);
  assert.equal(x.fase, 'fin');
}

/* ---- Las ventanas de cada tramo (para cortar el pulso y el ritmo del reloj de pulsera) ---- */
{
  // Tabata: 20 s de trabajo + 10 s de descanso. Con la pantalla dormida 100 s, `avanza` salta varios tramos y cada ventana termina donde empieza la siguiente.
  const c = corre(tab);
  let e = arranca(c);
  e = avanza(e, c.plan, T0 + 100 * SEG, c.tope);
  assert.deepEqual(e.ventanas.slice(0, 4), [[T0, T0 + 20 * SEG], [T0 + 20 * SEG, T0 + 30 * SEG], [T0 + 30 * SEG, T0 + 50 * SEG], [T0 + 50 * SEG, T0 + 60 * SEG]]);
  assert.equal(e.ventanas.length, e.hechos.length, 'una ventana por cada tramo terminado');
  assert.equal(e.tramoDesde, T0 + 90 * SEG, 'el tramo en curso arrancó donde terminó el anterior, no donde llegó el aviso');
  // Una pausa dentro de un tramo no mueve su hora de arranque: la ventana lo incluye completo.
  const d = corre(tab);
  let x = arranca(d);
  x = pausa(x, T0 + 5 * SEG);
  x = inicia(x, T0 + 40 * SEG);
  assert.equal(x.tramoDesde, T0, 'reanudar conserva la hora en que empezó el tramo');
  x = avanza(x, d.plan, T0 + 56 * SEG, d.tope); // le faltaban 15 s de los 20: termina en T0 + 55 s
  assert.deepEqual(x.ventanas[0], [T0, T0 + 55 * SEG]);
  // Un reloj guardado antes de que existieran las ventanas se sigue aceptando, sin inventarlas.
  const { ventanas: _v, tramoDesde: _t, ...viejo } = { ...x, hechos: [20, 10], i: 2 };
  const r = reanuda(JSON.parse(JSON.stringify(viejo)), d.plan);
  assert.deepEqual(r.ventanas, []);
  assert.deepEqual(sugerido(r, d.plan).ventanas, [], 'sin ventanas completas no se ofrecen');
  assert.deepEqual(reanuda({ ...x, ventanas: [[1, 'x']] }, d.plan), nuevoReloj(), 'una ventana malformada no sirve');
}

/* ---- Guardar el reloj a medias ---- */
{
  const c = corre(tab);
  const e = al(c, arranca(c), 50);
  assert.deepEqual(reanuda(JSON.parse(JSON.stringify(e)), c.plan), e, 'ida y vuelta por JSON');
  assert.deepEqual(reanuda(null, c.plan), nuevoReloj());
  assert.deepEqual(reanuda({ ...e, i: 99 }, c.plan), nuevoReloj(), 'un tramo que no existe: empieza de cero');
  assert.deepEqual(reanuda({ ...e, fase: 'volando' }, c.plan), nuevoReloj());
  assert.deepEqual(reanuda({ ...e, corrido: 'x' }, c.plan), nuevoReloj());
  assert.deepEqual(reanuda({ ...e, hechos: 'x' }, c.plan), nuevoReloj());
  assert.deepEqual(reanuda({ ...e, desde: null }, c.plan), nuevoReloj(), 'corriendo sin hora de arranque no sirve');
  const enPausa = pausa(e, T0 + 60 * SEG);
  assert.equal(reanuda(enPausa, c.plan).desde, null);
}

console.log('prueba-formatos: todo bien');
