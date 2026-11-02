/* Pruebas del APPLE WATCH SIN EL IPHONE (1 nov 2026, encargo «inicio, sin conexión y reloj», parte 3; ver `src/lib/relojSinTelefono.js` y
   `docs/entreno-y-reloj.md`, sección 10): `node scripts/prueba-reloj-sin-iphone.mjs`.
   Sin reloj, sin iPhone, sin red: lo que viaja en el contexto de WatchConnectivity (el plan), lo que el reloj devuelve (el resultado), cómo entra a la cola y
   al estado, y que nada llegue dos veces (lo de Salud que ya llegó del reloj se salta). */
import assert from 'node:assert/strict';
import {
  BUNDLE_DEL_RELOJ, MARCA_DEL_RELOJ, MAX_BYTES_DEL_PLAN, TIPO_PULSO_DEL_RELOJ, TIPO_SESION_DEL_RELOJ, aplicaSesionDelReloj, catalogoParaElReloj, conLlegado,
  cosaDelReloj, crudoDelReloj, enCursoDelReloj, esDelRelojDeTrainingLab, fechasDelReloj, firmaDelPlan, kilosDelPaso, leeResultado, llegoDelReloj, pasosParaElReloj,
  planParaElReloj, preparaLibreDelReloj, saltaLosDelReloj, sesionParaElReloj,
} from '../src/lib/relojSinTelefono.js';
import { pasosDeLaSesion, vistaDelEntreno } from '../src/lib/entreno.js';
import { construyeActividad, preparaEntreno, separaRepetidos } from '../src/lib/metricas/construye.js';
import { estimaUmbrales } from '../src/lib/metricas/calculos.js';
import { claveDeLaCola, creaCola } from '../src/lib/colaDeSubida.js';
import { CATALOGO } from '../src/lib/actividades.js';

let n = 0;
const prueba = (nombre, f) => { f(); n += 1; console.log(`  ✓ ${nombre}`); };
const vuelta = () => new Promise((r) => { setImmediate(r); });
const ex = (name, o = {}) => ({ name, ...o });

const USUARIO = '11111111-2222-3333-4444-555555555555';
const UUID_1 = 'A1B2C3D4-0000-4000-8000-000000000001';
const UUID_2 = 'A1B2C3D4-0000-4000-8000-000000000002';

// Un día del plan como lo escribe el coach: un peso fijo, uno por % del 1RM, «por lado», descansos en seg y en min, y una plancha por tiempo.
const fuerza = {
  day: 'Sáb', name: 'Fuerza · tren inferior · ~50 min', cat: 'gym',
  exercises: [
    ex('Back Squat', { sets: '4', reps: '8', intensity: '75%', descanso: '90 seg', descansoSet: '2 min' }),
    ex('Peso muerto rumano', { sets: '3', reps: '10', intensity: '50 kg', descanso: '75 seg', descansoSet: '2 min' }),
    ex('Zancada búlgara', { sets: '3', reps: '8', porLado: true, intensity: '16 kg', descanso: '60 seg' }),
    ex('Plancha', { sets: '2', reps: '30', unidad: 'seg', descanso: '45 seg' }),
  ],
};
const ONE_RMS = { back_squat: 100 };

console.log('1. Del iPhone al reloj: el plan');
const pasos = pasosParaElReloj(fuerza, { oneRMs: ONE_RMS, unidad: 'kg' });
const delPlan = pasosDeLaSesion(fuerza);
prueba('los pasos del reloj son los MISMOS del iPhone (mismas claves, mismo orden): lo que marca el reloj es el mismo avance', () => {
  assert.deepEqual(pasos.map((p) => p.c), delPlan.pasos.map((p) => p.clave));
  assert.equal(pasos[0].c, '0.1.0');
  assert.equal(pasos[1].c, 'd.0.1.0');
  assert.equal(pasos[0].t, 'e');
  assert.equal(pasos[1].t, 'd');
});
prueba('cada serie trae su ejercicio, su vuelta, sus reps, sus kilos (del 1RM o fijos), si lleva peso y si va «por lado»', () => {
  const squat = pasos[0];
  assert.equal(squat.n, 'Back Squat');
  assert.equal(squat.v, 1);
  assert.equal(squat.vs, 4);
  assert.equal(squat.reps, '8');
  assert.equal(squat.rv, 8);
  assert.equal(squat.u, 'reps');
  assert.equal(squat.kg, '75', '75 % de 100 kg');
  assert.equal(squat.pv, 75);
  assert.equal(squat.aprox, true, 'sale del 1RM: es aproximado');
  assert.equal(squat.peso, true);
  const rdl = pasos.find((p) => p.n === 'Peso muerto rumano');
  assert.equal(rdl.kg, '50');
  assert.equal(rdl.aprox, undefined);
  const bulgara = pasos.find((p) => p.n === 'Zancada búlgara');
  assert.equal(bulgara.lado, true);
  const plancha = pasos.find((p) => p.n === 'Plancha');
  assert.equal(plancha.u, 'seg');
  assert.equal(plancha.seg, 30, 'un paso por tiempo dice sus segundos');
  assert.equal(plancha.kg, undefined);
});
prueba('el nombre de cada paso viaja tal cual lo corta el iPhone (con sus espacios): la marca que vuelve del reloj cuenta', () => {
  const raro = { cat: 'gym', exercises: [ex('Press  de banca con agarre cerrado y pausa larga abajo', { sets: '2', reps: '5' })] };
  const [p] = pasosParaElReloj(raro);
  const delIphone = pasosDeLaSesion(raro).pasos[0];
  assert.equal(p.n, delIphone.nombre.slice(0, 40), 'el mismo texto que `nombreCorto`');
  const entreno = { v: 1, inicio: 1, hechos: { [p.c]: { t: 2, n: p.n } }, saltados: {} };
  assert.equal(vistaDelEntreno(pasosDeLaSesion(raro), entreno, 3).hechos, 1, 'el iPhone la cuenta como hecha');
});
prueba('los descansos llevan sus segundos (entre series y entre Sets)', () => {
  assert.equal(pasos[1].seg, 90);
  const entreSets = pasos.find((p) => p.c === 'd.0.4.0');
  assert.equal(entreSets.seg, 120, '«2 min» entre Sets');
});
prueba('en libras: el peso se ve en libras (redondeado a 5) y se guarda en kilos', () => {
  const lb = pasosParaElReloj(fuerza, { oneRMs: ONE_RMS, unidad: 'lb' });
  const rdl = lb.find((p) => p.n === 'Peso muerto rumano');
  assert.equal(rdl.pv, 110, '50 kg = 110.2 lb → 110');
  assert.equal(rdl.kg, '50', 'lo planeado se guarda en kilos');
  const squat = lb[0];
  assert.equal(squat.pv, 165, '75 kg ≈ 165 lb (de su 1RM, redondeado como en el iPhone)');
});
prueba('un paciente (salud) no tiene 1RM: el % no se vuelve kilos', () => {
  const paso = delPlan.pasos[0];
  assert.equal(kilosDelPaso(paso, fuerza.exercises[0], { oneRMs: ONE_RMS, salud: true }), null);
  assert.deepEqual(kilosDelPaso(paso, fuerza.exercises[0], { oneRMs: ONE_RMS }), { valor: 75, numero: 75, aprox: true, kg: '75' });
});

const sesion = (o = {}) => sesionParaElReloj({
  almacen: 'wr:sessions', llave: 'f1-w2-d5', nombre: fuerza.name, de: 'Carlos', rol: 'coach', color: '#1E40E0', minutos: '50 min', deporte: 'fuerza', dia: fuerza, hecha: false, ...o,
}, { oneRMs: ONE_RMS });
prueba('una sesión: su nombre (sin «· ~50 min»), de quién, su color, sus minutos y si ya se hizo', () => {
  const s = sesion();
  assert.equal(s.id, 'wr:sessions|f1-w2-d5');
  assert.equal(s.nombre, 'Fuerza · tren inferior');
  assert.equal(s.de, 'Carlos');
  assert.equal(s.rol, 'coach');
  assert.equal(s.color, '#1E40E0');
  assert.equal(s.min, 50);
  assert.equal(s.hecha, false);
  assert.equal(s.ejercicios, 4);
  assert.equal(sesion({ hecha: true }).hecha, true);
  assert.equal(sesion({ minutos: null }).min, undefined, 'sin minutos escritos no se inventan');
});
prueba('un día sin nada que entrenar o con demasiados pasos viaja sin pasos (el reloj lo corre como cronómetro)', () => {
  assert.deepEqual(pasosParaElReloj({ cat: 'off', exercises: [] }), []);
  const enorme = { cat: 'gym', exercises: Array.from({ length: 40 }, (_, i) => ex(`E${i}`, { sets: '5', reps: '5', descanso: '60 seg' })) };
  assert.deepEqual(pasosParaElReloj(enorme), []);
});

const hoy = new Date(2026, 10, 1, 9);
const fechas = fechasDelReloj(hoy);
prueba('hoy y los 2 días siguientes, en la fecha de este teléfono', () => {
  assert.deepEqual(fechas.map((f) => f.clave), ['2026-11-01', '2026-11-02', '2026-11-03']);
});
const propias = [{ id: 'p-escalada', nombre: 'Escalada', icono: 'montana', color: '#A480FF', gps: false }];
const planBase = () => planParaElReloj({
  usuario: USUARIO, ahora: 1000, unidad: 'kg', recorrido: true,
  dias: [{ fecha: fechas[0].clave, sesiones: [sesion(), sesion({ llave: 'f1-w2-d6', nombre: 'Movilidad de cadera', de: 'Laura', rol: 'fisio', color: '#EC7FB0', hecha: true })] }, { fecha: fechas[1].clave, sesiones: [] }, { fecha: fechas[2].clave, sesiones: [] }],
  actividades: [...CATALOGO.slice(0, 7)],
  catalogo: catalogoParaElReloj(propias),
});
prueba('el plan: de quién es, su unidad, los 3 días, «Tus actividades» (máximo 6) y el catálogo con las suyas primero', () => {
  const plan = planBase();
  assert.equal(plan.v, 1);
  assert.equal(plan.usuario, USUARIO);
  assert.equal(plan.unidad, 'kg');
  assert.equal(plan.recorrido, true);
  assert.equal(plan.dias.length, 3);
  assert.equal(plan.dias[0].sesiones.length, 2);
  assert.equal(plan.dias[0].sesiones[1].hecha, true, 'cuáles ya se hicieron hoy');
  assert.equal(plan.actividades.length, 6);
  assert.equal(plan.actividades[0].id, 'correr');
  assert.equal(plan.actividades[0].gps, true, 'las que llevan mapa');
  assert.equal(plan.catalogo[0].grupo, 'Tuyas');
  assert.equal(plan.catalogo[0].actividades[0].propia, true, 'las creadas por la persona dicen «tuya»');
  assert.ok(plan.catalogo.some((g) => g.grupo === 'Raqueta'));
});
prueba('el plan cabe en el contexto de WatchConnectivity: si no, los días de después pierden sus pasos', () => {
  const muchas = Array.from({ length: 6 }, (_, i) => sesion({ llave: `f1-w2-d${i}`, nombre: `Sesión ${i}` }));
  const grande = planParaElReloj({ usuario: USUARIO, dias: fechas.map((f) => ({ fecha: f.clave, sesiones: muchas })), actividades: CATALOGO, catalogo: catalogoParaElReloj([]) });
  assert.ok(new TextEncoder().encode(JSON.stringify(grande)).length <= MAX_BYTES_DEL_PLAN);
  assert.ok(grande.dias[0].sesiones[0].pasos.length > 0, 'hoy conserva sus pasos');
});
prueba('el plan solo se vuelve a mandar si algo cambió (la hora en que se mandó no cuenta)', () => {
  const a = planBase();
  const b = { ...planBase(), enviadoEn: 99999 };
  assert.equal(firmaDelPlan(a), firmaDelPlan(b));
  const c = planBase();
  c.dias[0].sesiones[0].hecha = true;
  assert.notEqual(firmaDelPlan(a), firmaDelPlan(c), 'una sesión que se hizo en el iPhone sí cambia el plan (sale con ✓ en el reloj)');
});

console.log('2. Del reloj al iPhone: lo que llega');
const inicio = Date.UTC(2026, 10, 1, 13, 0, 0);
// Lo que manda el reloj al terminar una sesión del plan (ver `ResultadoDelReloj` en `EntrenoDelReloj.swift`): cambió el peso de la segunda serie, usó
// «Deshacer» (la serie deshecha no aparece) y terminó antes (faltan series).
const delReloj = (o = {}) => ({
  v: 1, id: UUID_1, hk: UUID_1, usuario: USUARIO, modo: 'sesion', deporte: 'fuerza', inicio, fin: inicio + 30 * 60000, duracion: 1740, kcal: 210.4, fcMedia: 126, fcMax: 151,
  pulso: [[0, 95], [60, 120], [120, 131], [180, 140], [240, 128], [300, 126], [360, 133], [420, 129], [480, 136], [540, 124], [600, 131]],
  ruta: [], bateria: { inicio: 0.82, fin: 0.79, ubicacion: 'no' },
  sesion: {
    almacen: 'wr:sessions', llave: 'f1-w2-d5', nombre: 'Fuerza · tren inferior', de: 'Carlos', otraVez: false,
    entreno: {
      v: 1, nombre: 'Fuerza · tren inferior', inicio, fin: inicio + 30 * 60000,
      hechos: {
        '0.1.0': { t: inicio + 60000, n: 'Back Squat' },
        'd.0.1.0': { t: inicio + 150000, p: 90 },
        '0.2.0': { t: inicio + 240000, n: 'Back Squat', kg: '77.5' },
        'd.0.2.0': { t: inicio + 330000, p: 90 },
        '0.3.0': { t: inicio + 420000, n: 'Back Squat', reps: '6' },
      },
      saltados: {},
      extra: { 'd.0.1.0': 15 },
    },
    pasos,
  },
  ...o,
});
prueba('lo que llega se revisa: lo que no se entiende no entra (y no se tira: se queda en el iPhone)', () => {
  assert.equal(leeResultado('no es json'), null);
  assert.equal(leeResultado({ v: 2, id: UUID_1 }), null, 'otra versión');
  assert.equal(leeResultado({ ...delReloj(), id: 'sin-uuid' }), null);
  assert.equal(leeResultado({ ...delReloj(), sesion: { ...delReloj().sesion, almacen: 'otra:cosa' } }), null, 'solo se escribe en un almacén de sesiones');
  const r = leeResultado(JSON.stringify(delReloj()));
  assert.ok(r);
  assert.equal(r.id, UUID_1);
  assert.equal(r.kcal, 210);
  assert.equal(r.pulso.length, 11);
  assert.equal(r.sesion.entreno.hechos['0.2.0'].kg, '77.5');
});
prueba('una sesión del plan entra a la cola con el id de su HKWorkout, para su cuenta, con su nombre para Mi perfil', () => {
  const r = leeResultado(delReloj());
  const cosa = cosaDelReloj(r, 'otra-cuenta-que-entro');
  assert.equal(cosa.id, UUID_1);
  assert.equal(cosa.tipo, TIPO_SESION_DEL_RELOJ);
  assert.equal(cosa.usuario, USUARIO, 'es de quien tenía el plan en el reloj, no de quien entró después');
  assert.equal(cosa.datos.titulo, 'Fuerza · tren inferior');
  const sinDueño = leeResultado({ ...delReloj(), usuario: null });
  assert.equal(cosaDelReloj(sinDueño, null), null, 'sin plan en el reloj y nadie en el iPhone: espera en el plugin');
  assert.equal(cosaDelReloj(sinDueño, 'la-de-aqui').usuario, 'la-de-aqui');
});

prueba('las series marcadas en el reloj quedan en SU sesión del plan, como si se hubieran hecho en el iPhone', () => {
  const r = leeResultado(delReloj());
  const store = { 'wr:sessions': { 'f1-w1-d1': { completed: true } } };
  const nuevo = aplicaSesionDelReloj(store, r);
  const reg = nuevo['wr:sessions']['f1-w2-d5'];
  assert.equal(reg.completed, true);
  assert.equal(reg.completedAt, new Date(inicio + 30 * 60000).toISOString());
  assert.deepEqual(reg.delReloj, { id: UUID_1, en: inicio + 30 * 60000, hk: UUID_1 });
  assert.equal(reg.entreno.inicio, inicio);
  assert.equal(reg.entreno.hechos['0.2.0'].kg, '77.5');
  assert.equal(reg.entreno.extra['d.0.1.0'], 15, 'el «+15 s» del descanso');
  assert.ok(nuevo['wr:sessions']['f1-w1-d1'], 'las demás sesiones no se tocan');
  // Lo de siempre (`exercises[idx]`): lo planeado y lo que cambió, vuelta por vuelta.
  const squat = reg.exercises[0];
  assert.equal(squat.vueltas[0].repsHechas, '8');
  assert.equal(squat.vueltas[0].weight, '75');
  assert.equal(squat.vueltas[1].weight, '77.5', 'el peso que cambió');
  assert.equal(squat.vueltas[2].repsHechas, '6', 'las reps que cambió');
  // El iPhone lo lee igual que uno suyo: 3 hechas de 19, terminado antes.
  const vista = vistaDelEntreno(delPlan, reg.entreno, inicio + 31 * 60000);
  assert.equal(vista.estado, 'fin');
  assert.equal(vista.hechos, 3);
  assert.equal(vista.total, delPlan.total);
});
prueba('repetirla (la cola reintenta) no cambia nada: llega una sola vez', () => {
  const r = leeResultado(delReloj());
  const una = aplicaSesionDelReloj({}, r);
  const dos = aplicaSesionDelReloj(una, r);
  assert.equal(dos, una, 'el mismo objeto: nada que guardar');
});
prueba('si ya estaba hecha (en el iPhone), lo de antes pasa a «anteriores» y lo del reloj es la vez nueva', () => {
  const hecha = { completed: true, completedAt: '2026-11-01T08:00:00.000Z', entreno: { v: 1, inicio: 1, fin: 2, hechos: { '0.1.0': { t: 1, n: 'Back Squat' } }, saltados: {} }, exercises: { 0: { weight: '70' } }, notes: 'Bien' };
  const r = leeResultado(delReloj());
  const reg = aplicaSesionDelReloj({ 'wr:sessions': { 'f1-w2-d5': hecha } }, r)['wr:sessions']['f1-w2-d5'];
  assert.equal(reg.anteriores.length, 1);
  assert.equal(reg.anteriores[0].completedAt, '2026-11-01T08:00:00.000Z');
  assert.equal(reg.anteriores[0].exercises[0].weight, '70');
  assert.equal(reg.notes, 'Bien', 'la nota se queda');
  assert.equal(reg.entreno.inicio, inicio);
  assert.equal(reg.exercises[0].vueltas[1].weight, '77.5');
  // Y repetir esa misma vez tampoco la duplica (ya está, aunque lo de antes esté en `anteriores`).
  const otra = aplicaSesionDelReloj({ 'wr:sessions': { 'f1-w2-d5': reg } }, r);
  assert.equal(otra['wr:sessions']['f1-w2-d5'], reg);
});
prueba('una sesión a medias en el iPhone se junta con lo del reloj: cada paso con su marca', () => {
  const aMedias = { entreno: { v: 1, inicio: inicio - 600000, hechos: { '3.1.0': { t: inicio - 300000, n: 'Plancha' } }, saltados: {} } };
  const r = leeResultado(delReloj());
  const reg = aplicaSesionDelReloj({ 'wr:sessions': { 'f1-w2-d5': aMedias } }, r)['wr:sessions']['f1-w2-d5'];
  assert.ok(reg.entreno.hechos['3.1.0'], 'lo del iPhone se queda');
  assert.ok(reg.entreno.hechos['0.1.0'], 'lo del reloj llega');
  assert.equal(reg.entreno.inicio, inicio - 600000, 'empezó cuando empezó el primero');
});
prueba('lo pegado de un fisio o un programa de equipo se escribe en SU almacén', () => {
  const r = leeResultado({ ...delReloj(), sesion: { ...delReloj().sesion, almacen: 'wr:sessions@fisio-1', llave: 'p:abc:2026-W44:Sáb' } });
  const nuevo = aplicaSesionDelReloj({ 'wr:sessions': {} }, r);
  assert.ok(nuevo['wr:sessions@fisio-1']['p:abc:2026-W44:Sáb'].completed);
  assert.deepEqual(nuevo['wr:sessions'], {});
});

prueba('su pulso va a `actividades` como el entreno que Salud habría traído: con el id del reloj y «Lo midió tu Apple Watch»', () => {
  const r = leeResultado(delReloj());
  const crudo = crudoDelReloj(r, { deporte: 'fuerza', llego: true });
  assert.equal(crudo.idDeLaBase, UUID_1);
  assert.equal(crudo.formato, 'healthkit');
  const { fila, series } = construyeActividad(preparaEntreno(crudo), { umbrales: estimaUmbrales({}), origen: 'healthkit' });
  assert.equal(fila.fc_media, 126);
  assert.equal(fila.fc_max, 151);
  assert.equal(fila.kcal_activas, 210);
  assert.equal(fila.deporte, 'fuerza');
  assert.equal(fila.metricas.pulso_de, 'apple_watch');
  assert.equal(fila.metricas.llego_del_reloj, true);
  assert.deepEqual(fila.metricas.bateria_reloj, { inicio: 0.82, fin: 0.79, minutos: 29, ubicacion: 'no' }, 'cuánta batería gastó (para medir la ubicación en silencio)');
  assert.ok(series?.fc?.length > 0, 'las series del pulso, para «Por serie» del coach');
});
prueba('si ya está en la base (se reintentó), guardarla otra vez no hace otra: es «repetido»', () => {
  const r = leeResultado(delReloj());
  const prep = preparaEntreno(crudoDelReloj(r));
  const yaEsta = { id: UUID_1, inicio: new Date(inicio).toISOString(), duracion_s: 1740, fc_media: 126, origen: 'healthkit' };
  const { nuevos, repetidos } = separaRepetidos([prep], [yaEsta]);
  assert.equal(nuevos.length, 0);
  assert.equal(repetidos.length, 1);
});

const carrera = (o = {}) => ({
  v: 1, id: UUID_2, hk: UUID_2, usuario: USUARIO, modo: 'libre', inicio, fin: inicio + 27 * 60000, duracion: 1601, kcal: 330, distancia: 5020,
  pulso: Array.from({ length: 30 }, (_, i) => [i * 50, 140 + (i % 10)]),
  ruta: Array.from({ length: 60 }, (_, i) => [i * 26, 19.43 + i * 0.0007, -99.13 + i * 0.0003, 2240, 6]),
  actividad: { id: 'correr', nombre: 'Correr', deporte: 'correr', gps: true },
  ...o,
});
prueba('una carrera libre del reloj es un entreno libre más: la ruta, la distancia del GPS del reloj, su pulso y «Llegó de tu Apple Watch»', () => {
  const cosa = cosaDelReloj(leeResultado(carrera()), null);
  assert.equal(cosa.tipo, 'entreno-libre');
  assert.equal(cosa.id, UUID_2, 'con el id del reloj: subir dos veces no hace otro');
  assert.equal(cosa.datos.conRuta, true);
  const { fila, series } = construyeActividad(cosa.datos.prep, { umbrales: estimaUmbrales({}), desfaseMin: cosa.datos.desfaseMin, conSeries: true, origen: 'manual' });
  assert.equal(fila.titulo, 'Correr');
  assert.equal(fila.distancia_m, 5020, 'la distancia que midió el reloj manda');
  assert.equal(fila.duracion_s, 1601, 'el tiempo sin pausas');
  assert.ok(fila.fc_media >= 140);
  assert.equal(fila.metricas.pulso_de, 'apple_watch');
  assert.equal(fila.metricas.llego_del_reloj, true);
  assert.equal(fila.dispositivo, 'Apple Watch');
  assert.ok(series?.ruta?.lat?.length >= 2, 'la ruta para el mapa y los stickers');
  assert.ok(series?.fc?.length > 0, 'y su pulso');
});
prueba('un pádel (sin mapa): tiempo y pulso; la ruta en silencio solo deja la línea, nunca distancia ni ritmo', () => {
  const padel = carrera({ actividad: { id: 'padel', nombre: 'Pádel', deporte: 'raqueta', gps: false }, distancia: 900, rutaSilenciosa: true });
  const { prep } = preparaLibreDelReloj(leeResultado(padel));
  const { fila } = construyeActividad(prep, { umbrales: estimaUmbrales({}), conSeries: true, origen: 'manual' });
  assert.equal(fila.titulo, 'Pádel');
  assert.equal(fila.deporte, 'raqueta');
  assert.equal(fila.distancia_m, null, 'sin distancia');
  assert.equal(fila.metricas.ritmo_medio_s_km, undefined, 'sin ritmo');
  assert.ok(fila.fc_media > 0);
});
prueba('un entreno libre de menos de 30 s no se guarda (como en el iPhone)', () => {
  assert.deepEqual(cosaDelReloj(leeResultado(carrera({ duracion: 12, fin: inicio + 12000 })), USUARIO), { descarta: true });
});
prueba('el pulso de un entreno que guio el iPhone (el reloj acompañó) va aparte: le llega al entreno del iPhone', () => {
  const acompana = leeResultado({ ...carrera(), modo: 'acompana', actividad: undefined, ruta: [] });
  const cosa = cosaDelReloj(acompana, null);
  assert.equal(cosa.tipo, TIPO_PULSO_DEL_RELOJ);
  // El del iPhone ya estaba (sin pulso): `guardaImportacion` no hace otro, le pone el pulso.
  const delIphone = { id: 'x', inicio: new Date(inicio + 3000).toISOString(), duracion_s: 1595, fc_media: null, origen: 'manual' };
  const { nuevos, repetidos } = separaRepetidos([preparaEntreno(crudoDelReloj(acompana))], [delIphone]);
  assert.equal(nuevos.length, 0);
  assert.equal(repetidos.length, 1);
  assert.equal(repetidos[0].formato, 'healthkit', 'y como es de Salud con pulso, `guardaImportacion` se lo pone al del iPhone');
});

console.log('3. Que nada llegue dos veces');
const deSalud = (o) => ({ startDate: new Date(inicio).toISOString(), endDate: new Date(inicio + 1800000).toISOString(), duration: 1800, ...o });
prueba('al traer de Salud se salta lo que ya llegó del reloj (por su UUID) y lo que la app del reloj guardó con su marca', () => {
  const lista = [
    deSalud({ platformId: UUID_1.toLowerCase(), sourceId: 'com.apple.health' }),
    deSalud({ platformId: 'B0000000-0000-4000-8000-000000000003', sourceId: BUNDLE_DEL_RELOJ, metadata: { [MARCA_DEL_RELOJ]: 'reloj' } }),
    deSalud({ platformId: 'B0000000-0000-4000-8000-000000000004', sourceId: 'com.strava.stravaride' }),
    deSalud({ platformId: 'B0000000-0000-4000-8000-000000000005', sourceId: BUNDLE_DEL_RELOJ }),
  ];
  const quedan = saltaLosDelReloj(lista, new Set([UUID_1]));
  assert.deepEqual(quedan.map((w) => w.platformId), ['B0000000-0000-4000-8000-000000000004', 'B0000000-0000-4000-8000-000000000005'],
    'Strava entra; uno del reloj de antes de esta versión (sin marca) también: ese no llegó por el camino del reloj');
  assert.equal(esDelRelojDeTrainingLab(lista[1]), true);
  assert.equal(esDelRelojDeTrainingLab({ ...lista[1], sourceId: 'com.otra.app' }), false, 'la marca sola no basta: también la fuente');
});
prueba('los UUID que ya llegaron se guardan sin repetir y con tope', () => {
  let l = conLlegado([], UUID_1);
  l = conLlegado(l, UUID_1.toLowerCase());
  assert.deepEqual(l, [UUID_1]);
  assert.deepEqual(conLlegado(l, 'no-es-uuid'), l);
  const muchos = Array.from({ length: 305 }, (_, i) => `A1B2C3D4-0000-4000-8000-${String(i).padStart(12, '0')}`).reduce((x, u) => conLlegado(x, u), []);
  assert.equal(muchos.length, 300);
});
prueba('«Llegó de tu Apple Watch» sale en lo que se entrenó en el reloj (libre o del plan) y en nada más', () => {
  assert.equal(llegoDelReloj({ actividad: { metricas: { llego_del_reloj: true } } }), true);
  assert.equal(llegoDelReloj({ plan: { s: { registro: { delReloj: { id: UUID_1 } } } } }), true);
  assert.equal(llegoDelReloj({ actividad: { metricas: { pulso_de: 'apple_watch' } } }), false, 'el pulso de un entreno del iPhone no es «llegó del reloj»');
});
prueba('«Entreno en curso en tu reloj»: lo que publica el reloj, y nada si es de hace más de 8 horas', () => {
  const ahora = inicio + 600000;
  assert.deepEqual(enCursoDelReloj({ enCurso: { id: UUID_1, titulo: 'Fuerza', modo: 'sesion', sesion: 'wr:sessions|f1-w2-d5', desde: inicio } }, ahora),
    { id: UUID_1, titulo: 'Fuerza', modo: 'sesion', sesion: 'wr:sessions|f1-w2-d5', desde: inicio });
  assert.equal(enCursoDelReloj({ enCurso: null }, ahora), null);
  assert.equal(enCursoDelReloj({ enCurso: { titulo: 'Fuerza', desde: inicio - 9 * 3600000 } }, ahora), null);
});

console.log('4. La cola: lo del reloj no se pierde ni se duplica');
{
  // Un almacén que sobrevive a «cerrar la app» y un servidor que guarda por id (el upsert de la base).
  const datos = new Map();
  const almacen = { lee: async (k) => (datos.has(k) ? JSON.parse(datos.get(k)) : null), guarda: async (k, v) => { datos.set(k, JSON.stringify(v)); return true; } };
  const servidor = new Map();
  let senal = false;
  const arma = () => {
    const cola = creaCola({ almacen, sesion: async () => ({ usuario: USUARIO }), temporizador: { pon: () => 0, quita: () => {} } });
    const sube = async (cosa) => {
      await vuelta();
      if (!senal) throw Object.assign(new TypeError('Load failed'), { status: 0 });
      servidor.set(cosa.id, (servidor.get(cosa.id) ?? 0) + 1);
      return { id: cosa.id };
    };
    cola.registraTipo('entreno-libre', { sube });
    cola.registraTipo(TIPO_SESION_DEL_RELOJ, { sube });
    return cola;
  };
  // Lo que el plugin tenía guardado (llegó con la app cerrada), dos veces la misma (el reloj lo reenvió).
  const plugin = [{ id: UUID_2, resultado: JSON.stringify(carrera()) }, { id: UUID_1, resultado: JSON.stringify(delReloj()) }, { id: UUID_2, resultado: JSON.stringify(carrera()) }];
  const confirmados = [];
  const recibe = async (cola) => {
    for (const { id, resultado } of plugin) {
      const r = leeResultado(resultado);
      const cosa = cosaDelReloj(r, null);
      if (await cola.agrega(cosa)) confirmados.push(id);
    }
  };
  const una = arma();
  await una.usa(USUARIO);
  await recibe(una);
  prueba('sin señal: las dos quedan guardadas en el teléfono, una sola vez cada una, en el orden en que llegaron', () => {
    const guardadas = JSON.parse(datos.get(claveDeLaCola(USUARIO))).cosas.map((c) => c.id);
    assert.deepEqual(guardadas, [UUID_2, UUID_1]);
    assert.deepEqual(confirmados, [UUID_2, UUID_1, UUID_2], 'el plugin borra solo lo que ya quedó en la cola');
    assert.equal(servidor.size, 0);
  });
  // Se cierra la app (otra cola, el mismo almacén) y vuelve la señal.
  senal = true;
  const dos = arma();
  await dos.usa(USUARIO);
  await dos.vacia();
  await vuelta();
  prueba('al volver la señal se suben, una vez cada una, aunque se cerró la app en medio', () => {
    assert.deepEqual([...servidor.entries()], [[UUID_2, 1], [UUID_1, 1]]);
    assert.deepEqual(JSON.parse(datos.get(claveDeLaCola(USUARIO))).cosas, []);
  });
}

console.log(`\nprueba-reloj-sin-iphone: ${n} pruebas, todo bien.`);
