/**
 * LA REVISIÓN DE CADA OPCIÓN (23 nov 2026). `revisa-caras.mjs` cuida que cada PIEZA del editor tenga su pantalla del atleta; esta cuida cada
 * OPCIÓN dentro de la pieza. Andrés pidió una doble revisión y salieron 13 opciones que el coach escribía y al atleta no le llegaban (las series,
 * la nota, el terreno, el calentamiento de Gym…). Cada caso de abajo arma lo que guarda el editor y comprueba que llega al paso del atleta y que
 * la pantalla lo pinta. Si alguien agrega una opción al editor, se agrega aquí su renglón.
 *
 * Además, para la lista, lee las opciones de «Para toda la…» que ofrece `EditorDeCorrer.jsx` (`id: '…'`) y falla si aparece una que esta
 * revisión no conoce: así una opción nueva no se puede quedar sin revisar.
 */
import { readFileSync } from 'node:fs';
import { ejerciciosDelHibrido } from '../src/lib/hibridoAlAtleta.js';
import { cuentaDelLimite, empiezaPaso, marcaListo, pasosDeLaSesion } from '../src/lib/entreno.js';
import { cifrasDelPaso, textoDeCifra } from '../src/lib/entrenoDatos.js';

let fallas = 0;
const ve = (ok, t) => { if (!ok) fallas += 1; console.log(`${ok ? '✓' : '✗'} ${t}`); };
const lista = (tramos, extra = {}) => pasosDeLaSesion({ name: 'x', exercises: [], disciplina: 'correr', ...extra, tramos }).pasos;
const trabajo = (ps) => ps.filter((p) => p.tipo === 'ejercicio');
const gym = (exercises, extra = {}) => pasosDeLaSesion({ name: 'x', ...extra, exercises }).pasos;
const ex = (o) => ({ name: 'Burpees', sets: '1', reps: '20', unidad: 'reps', descanso: '', ...o });
const fuente = (f) => readFileSync(new URL(`../src/${f}`, import.meta.url), 'utf8');

/* ---------- 1. Lista: cada opción de «Para toda la…» y de los sprints ---------- */
const sprint = (extra) => ({ id: 'c', k: 'int', rol: 'sprint', ej: { name: 'Sprint' }, filas: [1, 2, 3, 4].map((n) => ({ id: `c${n}`, q: '100', u: 'm', dq: '1', du: 'min' })), ...extra });
const continua = (extra) => ({ id: 'a', k: 'tr', rol: 'continua', q: '5', u: 'km', modo: 'zona', z: 2, vals: {}, ...extra });
const texto1 = (ps) => trabajo(ps)[0]?.texto ?? '';

const LISTA = {
  limite: () => ve(trabajo(lista([sprint({ limS: 15 })]))[0]?.limiteSeg === 15, 'Lista · Tiempo límite: llega al paso (`limiteSeg`)'),
  cad: () => ve(/cadencia 170/.test(texto1(lista([continua({ cad: '170' })]))), 'Lista · Cadencia: «cadencia 170»'),
  cam: () => ve(/en caminadora a 12 km\/h inclinación 1 %/.test(texto1(lista([continua({ cam: { kmh: '12', inc: '1' } })]))), 'Lista · Caminadora: con velocidad e inclinación'),
  res: () => ve(/resistencia 8/.test(texto1(lista([continua({ res: '8' })], { disciplina: 'bici', lugar: 'estatica' }))), 'Lista · Resistencia: «resistencia 8»'),
  pos: () => ve(/de pie/.test(texto1(lista([continua({ pos: 'pie' })], { disciplina: 'bici', lugar: 'estatica' }))), 'Lista · Sentado o de pie: «de pie»'),
  ter: () => ve(/en subida/.test(texto1(lista([continua({ ter: 'subida' })], { disciplina: 'bici', lugar: 'ruta' }))), 'Lista · Terreno: «en subida»'),
  nota: () => {
    ve(trabajo(lista([continua({ nota: 'Respira' })]))[0]?.nota === 'Respira', 'Lista · Nota en una carrera: llega');
    ve(trabajo(lista([sprint({ nota: 'Sal explosivo' })]))[0]?.nota === 'Sal explosivo', 'Lista · Nota en un sprint: llega');
    ve(trabajo(lista([{ id: 'e', k: 'tr', rol: 'cal', forma: 'trote', q: '10', u: 'min', nota: 'Muy suave' }]))[0]?.nota === 'Muy suave', 'Lista · Nota en el calentamiento de trote: llega');
  },
  nom: () => ve(trabajo(lista([continua({ nom: 'Rodaje del martes' })]))[0]?.nombre === 'Rodaje del martes', 'Lista · Nombre propio: llega'),
  ej: () => ve(trabajo(lista([continua({ ej: { exercise_id: 'e-nadar', name: 'Mariposa' } })], { disciplina: 'nadar' })).length > 0, 'Lista · Ejercicio (el estilo, en Swimming): no se rompe'),
  series: () => {
    const ps = lista([sprint({ series: { n: '3', q: '3', u: 'min' } })]);
    ve(trabajo(ps).length === 12, `Lista · En series: 4 sprints en 3 series son 12 (salen ${trabajo(ps).length})`);
    ve(ps.filter((p) => p.entre === 'series').length === 2, 'Lista · En series: el descanso entre series se cuenta');
    ve(new Set(ps.map((p) => p.clave)).size === ps.length, 'Lista · En series: cada paso tiene su clave');
  },
  mat: () => ve(/con trineo 20 kg/.test(texto1(lista([sprint({ con: { tipo: 'trineo', kg: '20' } })]))), 'Lista · Material o terreno: «con trineo 20 kg»'),
  peso: () => ve(lista([{ id: 'd', k: 'tec', nom: 'Técnica', sets: [{ id: 's', veces: 1, items: [{ id: 'i', name: 'Skip A', q: '30', u: 'm', peso: { q: '5', u: 'kg' } }] }] }]).some((p) => /5 kg/.test(p.texto ?? '')), 'Lista · Peso en técnica: «5 kg»'),
  terreno: () => {}, // la misma opción que `ter` (el editor usa los dos nombres para el mismo campo)
};
for (const [k, f] of Object.entries(LISTA)) f(k);

// Intervalos guardados como pasos (una pieza vieja que el coach tocó): antes no llegaba nada.
const enPasos = lista([{ id: 'p', k: 'int', rol: 'sprint', veces: '2', pasos: [{ id: 'a', tipo: 'correr', q: '400', u: 'm', modo: 'zona', z: 4, vals: {} }, { id: 'b', tipo: 'caminar', q: '100', u: 'm' }, { id: 'c', tipo: 'descanso', q: '1', u: 'min' }] }]);
ve(trabajo(enPasos).length === 4 && enPasos.some((p) => p.nombre === 'Caminar'), 'Lista · Intervalos guardados como pasos (Correr, Caminar, «Repetir todo»): llegan');

// Que ninguna opción del editor se quede sin revisar.
const editor = fuente('features/admin/EditorDeCorrer.jsx');
const ofrecidas = new Set([...editor.matchAll(/\{ id: '(\w+)', label:/g)].map((m) => m[1]));
const sinRevisar = [...ofrecidas].filter((k) => !(k in LISTA));
ve(sinRevisar.length === 0, `Lista · Toda opción del editor tiene su revisión${sinRevisar.length ? ` (faltan: ${sinRevisar.join(', ')})` : ''}`);

// Y que la pantalla negra pinte lo que llega.
const cardio = fuente('features/training/PantallaDeCardio.jsx');
const gps = fuente('features/training/PasoConGps.jsx');
ve(/NotaOscura texto=\{paso\.nota\}/.test(cardio) && /NotaOscura texto=\{paso\.nota\}/.test(gps), 'Pantalla negra · pinta la nota (con y sin GPS)');
ve(/paso\.limiteSeg \?/.test(cardio), 'Pantalla negra · pinta el límite de un sprint sin GPS');
ve(/paso\.bloques > 1|p\.bloques > 1/.test(fuente('features/training/EntrenoDelDia.jsx')), 'Pantalla negra · dice en qué serie va («serie 1 de 3»)');

/* ---------- 2. Gym ---------- */
const amrap = gym([ex({ notes: 'Pecho al piso', formato: { id: 'amrap', pasos: [{ tipo: 'trabajo', seg: 600 }], vueltas: 1 } })])[0];
ve(amrap?.tipo === 'reloj' && amrap.miembros[0].nota === 'Pecho al piso', 'Gym · Nota dentro de un Set con reloj: llega');
ve(/m\.nota &&/.test(fuente('features/training/PantallasDelEntreno.jsx')) && /ex\.notes, ex\.cue/.test(fuente('features/training/RelojDelBloque.jsx')), 'Gym · Nota dentro de un Set con reloj: se pinta (antes y durante)');
ve(/String\(ex\.intensity/.test(fuente('features/training/RelojDelBloque.jsx')), 'Gym · La carga con el reloj corriendo: se pinta');
const lim = gym([ex({ enMenosDe: '60' })])[0];
ve(lim?.limiteSeg === 60 && cifrasDelPaso(lim).map(textoDeCifra).includes('en menos de 1:00'), 'Gym · «En menos de 60 seg»: llega y es una cifra de la pantalla');
const lim400 = gym([ex({ name: 'Correr', reps: '400', unidad: 'm', enMenosDe: '80' })])[0];
ve(lim400?.limiteSeg === 80, 'Gym · «En menos de» en 400 m: el GPS lo cuenta (`limiteSeg`)');
// Regla 19: el límite cuenta en vivo y, al ✓, guarda cuánto tardó (para decir «✓ lo lograste»).
{
  const planLim = pasosDeLaSesion({ name: 'x', exercises: [ex({ enMenosDe: '60' })] });
  const e1 = empiezaPaso(planLim, null, 1000);
  const c = cuentaDelLimite(planLim.pasos[0], e1, 31000);
  const e2 = marcaListo(planLim, e1, 48000);
  ve(c?.restan === 30 && e2.hechos?.[planLim.pasos[0].clave]?.seg === 47, 'Gym · «En menos de 60 seg»: cuenta en vivo y guarda cuánto tardó (regla 19)');
}
const cluster = gym([ex({ name: 'Sentadilla', reps: '2+2+2', unidad: 'cluster', entreBloques: '15' })])[0];
ve(cifrasDelPaso(cluster).map(textoDeCifra).includes('15 s entre bloques'), 'Gym · Cluster: la pausa entre bloques es una cifra de la pantalla');
const fin = gym([ex({}), { isNote: true, text: 'Estira al terminar' }]);
ve(fin[fin.length - 1]?.tipo === 'nota' && fin[fin.length - 1].nombre === 'Estira al terminar', 'Gym · Una nota después del último Set: es el último paso');
const conCal = gym([ex({})], { calentamiento: { forma: 'video', video: { url: '/v.mp4', duracion: 300 } } });
ve(conCal[0]?.encabezado === 'Calentamiento' && conCal[0].cara === 'guiado' && conCal[1]?.nombre === 'Burpees', 'Gym · Calentamiento guiado: va antes del Set 1, en la pantalla del video');
const conCalEj = gym([ex({})], { calentamiento: { forma: 'ejercicios', sets: [{ id: 's', veces: 2, items: [{ id: 'i', name: 'Jumping jacks', q: '20', u: 'reps' }] }] } });
ve(trabajo(conCalEj).filter((p) => p.nombre === 'Jumping jacks').length === 2 && conCalEj[0].cara === 'lejos', 'Gym · Calentamiento con ejercicios: uno por uno, «de lejos»');
ve(gym([ex({})], { calentamiento: { forma: 'video' } }).length === 1, 'Gym · Un calentamiento sin video elegido no agrega pasos vacíos');
ve(trabajo(conCal).filter((p) => p.serie >= 1).every((p) => p.serie === 1), 'Gym · El calentamiento no cambia los números de los Sets');

/* ---------- 3. Híbrido (23 nov 2026): cada opción del editor llega como ejercicio de Gym ---------- */
{
  const R = (o) => ({ id: 'r', exercise_id: 'e', name: 'Back squat', q: '5', u: 'reps', peso: null, int: null, desc: null, pv: false, vueltas: [], lado: false, limite: null, nota: null, como: 'uno', maq: null, cad: null, mat: null, spr: [], pg: null, iv: null, ...o });
  const H = (sets) => ejerciciosDelHibrido({ sets });
  const pasosH = (sets) => pasosDeLaSesion({ name: 'x', exercises: [], hibrido: { sets } }).pasos;
  const rep = (items, o = {}) => ({ id: 's', fmt: 'rep', veces: 3, min: '10', descV: { q: '2', u: 'min' }, descS: null, items, ...o });
  const a = H([rep([R({ peso: { q: '80', u: '% 1RM' }, desc: { q: '30', u: 'seg' } }), R({ name: 'Remo', q: '250', u: 'm', int: { tipo: 'zona', a: '4' } })])]);
  ve(a[0].sets === '3' && a[0].intensity === '80% 1RM' && a[0].descanso === '30 seg' && a[1].descanso === '2 min', 'Híbrido · Se repite: vueltas, peso, descanso del ejercicio y entre vueltas');
  ve(a[1]._sinGps === true, 'Híbrido · Una máquina (remo) va sin GPS');
  const b2 = pasosH([rep([R({})], { descS: { q: '3', u: 'min' } }), rep([R({ name: 'Wall balls' })], { fmt: 'amrap', min: '12' })]);
  ve(b2.some((p) => p.entre === 'sets' && p.seg === 180) && b2.some((p) => p.tipo === 'reloj' && p.formato.id === 'amrap' && p.formato.pasos[0].seg === 720), 'Híbrido · Descanso entre Sets y AMRAP de 12 min');
  const e = H([rep([R({ name: 'A' }), R({ name: 'B' })], { fmt: 'emom', min: '10' })]);
  ve(e[0].formato.id === 'emom' && e[0].formato.turnan && e[0].formato.vueltas === 5, 'Híbrido · EMOM: cada minuto un ejercicio, 10 min');
  ve(H([rep([R({})], { fmt: 'tiempo' })])[0].formato.id === 'portiempo', 'Híbrido · Por tiempo: el reloj «lo más rápido posible»');
  const f = H([rep([R({ lado: true, limite: { q: '1', u: 'min' }, nota: 'Espalda recta', int: { tipo: 'rpe', a: '8' } })])])[0];
  ve(f.porLado && f.enMenosDe === '60' && f.notes === 'Espalda recta' && /RPE 8/.test(f.intensity), 'Híbrido · Por lado, límite, nota y RPE');
  const g = H([rep([R({ pv: true, vueltas: [{ q: '5', p: '80' }, { q: '3', p: '85' }, { q: '1', p: '90' }], peso: { q: '80', u: 'kg' } })])])[0];
  ve(g.porVuelta?.length === 3 && g.porVuelta[2].reps === '1' && /90/.test(g.porVuelta[2].intensity), 'Híbrido · Cambia en cada vuelta');
  const sp = H([rep([R({ name: 'Sprint', como: 'sprint', u: 'm', int: { tipo: 'tope' }, peso: { q: '20', u: 'kg' }, mat: 'trineo', spr: [1, 2].map((k) => ({ id: `${k}`, q: '30', u: 'm', dq: '1', du: 'min' })) })])]);
  ve(sp.length === 2 && sp[0]._cara === 'lejos' && sp[0].descanso === '1 min' && /con trineo/.test(sp[0].intensity) && /con 20 kg/.test(sp[0].intensity), 'Híbrido · Sprints: uno por fila, «de lejos», material y carga extra');
  const pg = H([rep([R({ name: 'Correr', como: 'prog', q: '2', u: 'km', int: { tipo: 'pace' }, pg: { lista: [{ q: '1', u: 'km', a: '6:00' }, { q: '1', u: 'km', a: '5:30' }] } })])]);
  ve(pg.length === 2 && /6:00/.test(pg[0].intensity) && /5:30/.test(pg[1].intensity), 'Híbrido · Progresiva: un tramo por fila con su ritmo');
  const iv = H([rep([R({ name: 'Correr', como: 'int', q: '1', u: 'km', int: { tipo: 'zona' }, iv: { repite: true, lista: [{ q: '200', u: 'm', a: '4' }, { q: '300', u: 'm', a: '2' }] } })])]);
  ve(iv.length === 4, `Híbrido · Intervalos que se repiten hasta el total (salen ${iv.length})`);
  const c = H([rep([R({ name: 'Bici', q: '10', u: 'min', int: { tipo: 'w', a: '200' }, cad: '90', maq: '6' })])])[0];
  ve(/200 W/.test(c.intensity) && /cadencia 90/.test(c.intensity) && /resistencia 6/.test(c.intensity) && c._sinGps, 'Híbrido · Vatios, cadencia, resistencia (sin GPS)');
}

/* ---------- 4. Deporte (23 nov 2026): cada opción del editor llega al atleta ---------- */
{
  const D = (items, extra = {}) => pasosDeLaSesion({ name: 'x', exercises: [], deporte: { items, ...extra } }).pasos;
  const it = (o) => ({ id: 'i', exercise_id: 'e', name: 'Jab release', veces: '3', ...o });
  const a = D([it({ lado: true, dist: { q: '10', u: 'm' }, tiempo: { q: '4', u: 'seg' }, peso: { q: '5', u: 'kg' }, nota: 'Manos rápidas', desc: { q: '30', u: 'seg' } }), it({ name: 'Otro', veces: '1', reps: '8' })]);
  const t = a.filter((p) => p.tipo === 'ejercicio');
  ve(t.length === 4 && t[0].vueltas === 3 && t[0].cara === 'lejos', 'Deporte · Veces: uno por uno, «de lejos»');
  ve(t[0].termina.texto === '10 m' && /en 4 seg/.test(t[0].texto) && /por lado/.test(t[0].texto) && /5 kg/.test(t[0].texto), 'Deporte · Distancia, tiempo, por lado y peso');
  ve(t[0].nota === 'Manos rápidas', 'Deporte · Nota del ejercicio');
  ve(a.filter((p) => p.tipo === 'descanso').length === 3, 'Deporte · Descanso entre veces y antes del siguiente');
  ve(t[3].termina.texto === '8 reps', 'Deporte · Reps');
  const c = D([it({})], { cal: { forma: 'video', video: { url: '/v.mp4', duracion: 300 } }, calma: { forma: 'ejercicios', sets: [{ id: 's', veces: 1, items: [{ id: 'q', name: 'Estirar', q: '30', u: 'seg' }] }] } });
  ve(c[0].encabezado === 'Calentamiento' && c[c.length - 1].nombre === 'Estirar', 'Deporte · Calentamiento y enfriamiento');
  ve(/dia\.deporte\?\.necesita/.test(fuente('features/training/EntrenoDelDia.jsx')) && /dia\.deporte\?\.nota/.test(fuente('features/training/EntrenoDelDia.jsx')), 'Deporte · Lo que necesita y la nota: en «Antes de empezar»');
}

/* ---------- 5. Clase (23 nov 2026): la clase de un video es un paso del entreno ---------- */
{
  const C = (extra = {}, exercises = []) => pasosDeLaSesion({ name: 'Yoga', exercises, clase: { url: '/v.webm', duracion: 1200 }, claseModo: 'video', ...extra }).pasos;
  const a = C();
  ve(a.length === 1 && a[0].cara === 'guiado' && a[0].deClase && a[0].video?.url === '/v.webm', 'Clase · Un video completo: un paso con la pantalla del video guiado');
  const b = C({ claseExtra: { cal: { forma: 'video', video: { url: '/c.mp4', duracion: 300 } }, calma: { forma: 'ejercicios', sets: [{ id: 's', veces: 1, items: [{ id: 'q', name: 'Estirar', q: '30', u: 'seg' }] }] } } });
  ve(b[0].encabezado === 'Calentamiento' && b[1].deClase && b[b.length - 1].nombre === 'Estirar', 'Clase · Calentamiento aparte, la clase y el enfriamiento, en orden');
  const c = C({}, [{ name: 'Plancha', sets: '2', reps: '30', unidad: 'seg' }]);
  ve(c[0].deClase && c.filter((p) => p.nombre === 'Plancha').length === 2, 'Clase · Con Sets debajo: la clase y luego los Sets');
  const e = fuente('features/training/EntrenoDelDia.jsx');
  ve(/claseExtra\?\.necesita/.test(e) && /claseExtra\?\.nota/.test(e) && /claseExtra\?\.portada/.test(e), 'Clase · Lo que necesita, la nota y la portada: en «Antes de empezar»');
  ve(/Video terminado/.test(fuente('features/training/PantallaDeCardio.jsx')), 'Clase · Al acabar dice «✓ Video terminado» (regla 17)');
  ve(pasosDeLaSesion({ name: 'x', claseModo: 'ejercicios', exercises: [{ name: 'Puente', sets: '1', reps: '10' }] }).pasos.length === 1, 'Clase · Ejercicio por ejercicio: los Sets de siempre');
}

console.log(fallas ? `\n${fallas} ✗` : '\nTodo bien: cada opción del coach le llega al atleta.');
process.exit(fallas ? 1 : 0);
