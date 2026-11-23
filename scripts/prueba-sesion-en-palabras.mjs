/**
 * LA SESIÓN EN PALABRAS (conector de IA v2, 23 nov 2026). Andrés: lo que puede escribir el conector tiene que estar «directamente
 * correlacionado con cada pieza que tiene el código en los modos de edición». Esta prueba recorre LOS CATÁLOGOS DE LOS EDITORES (no una lista
 * hecha a mano) y, para cada opción:
 *   1. se puede escribir en palabras;
 *   2. sale con la forma del editor (las mismas llaves que su constructor del «Agregar»);
 *   3. le llega al atleta (`pasosDeSesion`) y al Apple Watch (`pasosParaElReloj`) sin quedar vacía;
 *   4. se lee de vuelta en palabras y, reescrita, queda igual (sin contar los ids).
 * Si el editor gana una pieza, una intensidad, un formato o un campo, esta prueba la recorre sola; si su tipo de dato no tiene lector, falla.
 */
import { DEPORTES, NOMBRE_MODO } from '../src/lib/catalogoDeLaLista.js';
import { FORMATOS, INT } from '../src/lib/hibrido.js';
import { CAMPOS_DE_DEPORTE, UNIDADES_DE_DEPORTE } from '../src/lib/catalogoDeDeporte.js';
import { llaveDePieza } from '../src/lib/pasosDeLaLista.js';
import { pasosDeLaSesion } from '../src/lib/entreno.js';
import { pasosParaElReloj } from '../src/lib/relojSinTelefono.js';
import { sesionDesdePalabras, palabrasDeSesion, DISCIPLINAS, guiaDeEscritura, leeCuanto, leeIntensidad, textoIntensidad } from '../src/lib/sesionEnPalabras.js';

let fallas = 0;
let bienes = 0;
const mal = (t) => { fallas += 1; console.log(`✗ ${t}`); };
const bien = () => { bienes += 1; };
const sinIds = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === 'id' ? undefined : v)));
const igual = (a, b) => JSON.stringify(sinIds(a)) === JSON.stringify(sinIds(b));

// Un ejemplo escrito por TIPO DE DATO (los lectores). Un modo del catálogo sin ejemplo aquí = un tipo de dato sin lector: falla.
const EJEMPLO_DE_MODO = { zona: 'zona 3', ritmo: '4:20-4:30', ritmo100: '1:45-1:50 /100 m', pulso: '140-150 pulsaciones', rpe: 'RPE 7', tiempo: 'en 0:45', tope: 'al máximo', libre: 'libre', w: '250-280 W' };
const EJEMPLO_DE_INT = { rpe: 'RPE 8', rir: 'RIR 2', pace: '4:30-4:45', zona: 'zona 2', pulso: '150-160 pulsaciones', w: '200-220 W', r500: '1:55 /500 m', tope: 'al máximo', tiempo: 'en 1:30' };
const EJEMPLO_DE_UNIDAD = { m: '200 m', km: '1 km', min: '3 min', s: '30 seg', seg: '30 seg', cal: '20 cal', yd: '100 yd', reps: '10 reps' };

const repertorio = [
  { id: 'e1', name: 'Skip A', disciplinas: ['correr'] }, { id: 'e2', name: 'Sprint', disciplinas: ['correr'] }, { id: 'e3', name: 'Sentadilla', equipment: 'Barra', carga_tipo: 'kg', medida: 'reps' },
  { id: 'e4', name: 'Remo ergómetro', equipment: 'Remo' }, { id: 'e5', name: 'Calentamiento guiado 10', guiado: true, video_url: 'https://videos.traininglabapp.com/media/cal.mp4', duracion_s: 600 },
  { id: 'e6', name: 'Pase de pecho', disciplinas: ['deporte'] }, { id: 'e7', name: 'Patada con tabla', disciplinas: ['nadar'] },
];
const busca = (n) => repertorio.find((e) => e.name.toLowerCase() === String(n).toLowerCase()) ?? null;

/** Escribe, comprueba la forma, que llegue al atleta y al reloj, y que se lea de vuelta igual. */
function revisa(nombre, s, { forma } = {}) {
  let dia;
  try { dia = { day: 'Lun', name: nombre, exercises: [], ...sesionDesdePalabras(s, { busca }).dia }; } catch (e) { mal(`${nombre}: no se pudo escribir (${e.message})`); return null; }
  if (forma) {
    const faltan = Object.keys(forma.molde).filter((k) => !(k in forma.pieza(dia)));
    if (faltan.length) mal(`${nombre}: no tiene la forma del editor (le faltan ${faltan.join(', ')})`); else bien();
  }
  const atleta = pasosDeLaSesion(dia);
  if (!atleta.pasos.length) mal(`${nombre}: el atleta no ve ningún paso`); else bien();
  const reloj = pasosParaElReloj(dia);
  if (!reloj.length) mal(`${nombre}: el reloj no recibe pasos`); else bien();
  const palabras = palabrasDeSesion(dia);
  let otra;
  try { otra = { ...dia, ...sesionDesdePalabras(palabras, { busca }).dia }; } catch (e) { mal(`${nombre}: no se pudo reescribir lo leído (${e.message}) ${JSON.stringify(palabras).slice(0, 300)}`); return dia; }
  const quita = ({ day: _d, name: _n, exercises: _e, ...r }) => r;
  if (!igual(quita(dia), quita(otra))) mal(`${nombre}: leer y reescribir cambió algo\n   antes: ${JSON.stringify(sinIds(quita(dia))).slice(0, 400)}\n   luego: ${JSON.stringify(sinIds(quita(otra))).slice(0, 400)}`); else bien();
  return dia;
}

/* 1. LA LISTA: cada pieza de cada deporte, con lo mínimo que la hace real. */
const DISC = { correr: 'correr', bici: 'bici', nado: 'nadar', tri: 'triatlon' };
for (const [dep, cat] of Object.entries(DEPORTES)) {
  for (const op of cat.opciones) {
    const molde = op.crea();
    const d = molde.dxp ? (molde.dxp === 'bici' ? { ...DEPORTES.bici, unidades: [['min', 'min'], ['km', 'km'], ['m', 'm']] } : DEPORTES[molde.dxp]) : cat;
    const cuanto = EJEMPLO_DE_UNIDAD[d.unidades[0][0]];
    const fuerza = EJEMPLO_DE_MODO[d.modos[0]];
    let p = { pieza: op.id };
    if (molde.k === 'desc') p = { ...p, cuanto: '2 min' };
    else if (molde.k === 'trans') p = { ...p, limite: '90 seg' };
    else if (molde.k === 'tec') p = { ...p, sets: [{ veces: '2', ejercicios: [{ nombre: dep === 'nado' ? 'Patada con tabla' : 'Skip A', cuanto: EJEMPLO_DE_UNIDAD[d.unidadesTec[0][0]] }] }] };
    else if (molde.k === 'int') p = { ...p, sprints: [{ cuanto, veces: 4, descanso: '2 min' }], intensidad: EJEMPLO_DE_MODO[d.modosSprint[0]] };
    else if (molde.rol === 'cal' || molde.rol === 'calma') p = { ...p, cuanto: EJEMPLO_DE_UNIDAD[(molde.u === 'm' ? 'm' : 'min')], intensidad: EJEMPLO_DE_MODO[d.modos[0]], ...(molde.forma === 'video' ? { forma: 'trote' } : null) };
    else if (molde.rol === 'int') p = { ...p, tramos: [{ cuanto, intensidad: fuerza }, { cuanto, intensidad: EJEMPLO_DE_MODO[d.modos[0]] }], veces: 3 };
    else p = { ...p, cuanto, intensidad: fuerza };
    revisa(`${dep} · ${op.titulo}`, { disciplina: DISC[dep], piezas: [p] }, { forma: { molde, pieza: (dia) => dia.tramos[0] } });
  }
}

/* 2. Cada intensidad de cada deporte (la forma «Para toda la carrera»), y que su lector la lea de vuelta igual. */
for (const [dep, cat] of Object.entries(DEPORTES)) {
  if (dep === 'tri') continue;
  for (const modo of cat.todos) {
    const ej = EJEMPLO_DE_MODO[modo];
    if (!ej) { mal(`${dep}: la intensidad «${NOMBRE_MODO[modo]}» (${modo}) no tiene lector`); continue; }
    const x = leeIntensidad(ej, cat.todos);
    if (x.modo !== modo) mal(`${dep}: «${ej}» se leyó como ${x.modo}, no ${modo}`);
    else if (!igual(leeIntensidad(textoIntensidad(x), cat.todos), x)) mal(`${dep}: la intensidad ${modo} no se lee de vuelta igual («${textoIntensidad(x)}»)`);
    else bien();
    revisa(`${dep} · continua en ${NOMBRE_MODO[modo]}`, { disciplina: DISC[dep], piezas: [{ pieza: 'continua', cuanto: EJEMPLO_DE_UNIDAD[cat.unidades[0][0]], intensidad: ej }] });
  }
  for (const [u] of cat.unidades) if (!EJEMPLO_DE_UNIDAD[u]) mal(`${dep}: la unidad «${u}» no tiene lector`); else if (leeCuanto(EJEMPLO_DE_UNIDAD[u], cat.unidades).u !== u) mal(`${dep}: «${EJEMPLO_DE_UNIDAD[u]}» no se leyó como ${u}`); else bien();
}

/* 3. Lo que pide la spec, como lo escribiría la IA. */
revisa('Spec · Running de series', { disciplina: 'correr', piezas: [
  { pieza: 'cal', cuanto: '15 min', intensidad: 'zona 2' },
  { pieza: 'int', tramos: [{ cuanto: '1 km', intensidad: '4:20-4:30' }, { cuanto: '2 min', intensidad: '6:00-6:30' }], veces: 8 },
  { pieza: 'calma', cuanto: '10 min', intensidad: 'zona 1' },
] });
revisa('Progresiva con empieza/termina/cada', { disciplina: 'correr', piezas: [{ pieza: 'continua', cuanto: '10 km', como: 'progresiva', empieza: '5:30', termina: '4:30', cada: '2 km' }] });
revisa('Sprints en series con trineo y límite', { disciplina: 'correr', piezas: [{ pieza: 'sprint', ejercicio: 'Sprint', sprints: [{ cuanto: '30 m', veces: 4, descanso: 'hasta recuperarse' }], intensidad: 'al máximo', material: 'trineo', peso: '20 kg', limite: '6 seg', series: { veces: 3, descanso: '4 min' } }] });
revisa('Cycling en ruta con terreno', { disciplina: 'bici', lugar: 'ruta', piezas: [{ pieza: 'continua', cuanto: '40 km', intensidad: 'zona 2', terreno: 'subida', cadencia: '90' }] });
revisa('Calentamiento guiado (video del repertorio)', { disciplina: 'correr', piezas: [{ pieza: 'cal', forma: 'guiado', video: 'Calentamiento guiado 10' }, { pieza: 'continua', cuanto: '5 km', intensidad: 'zona 2' }] });
revisa('Triatlón brick', { disciplina: 'triatlon', piezas: [{ pieza: 'bici-continua', cuanto: '20 km', intensidad: 'zona 3' }, { pieza: 'trans' }, { pieza: 'continua', deporte: 'correr', cuanto: '5 km', intensidad: '4:45' }] });

/* 4. HÍBRIDO: cada formato de Set y cada intensidad de renglón. */
for (const [fmt, etiqueta] of FORMATOS) {
  revisa(`Híbrido · ${etiqueta}`, { disciplina: 'hyrox', sets: [{ formato: fmt, ...(fmt === 'rep' ? { veces: 3 } : fmt === 'tiempo' ? null : { minutos: 12 }), ejercicios: [{ nombre: 'Sentadilla', cuanto: '10 reps', peso: '60 kg' }, { nombre: 'Remo ergómetro', cuanto: '500 m', intensidad: 'zona 3' }] }] });
}
for (const tipo of Object.keys(INT)) {
  const ej = EJEMPLO_DE_INT[tipo];
  if (!ej) { mal(`Híbrido: la intensidad «${INT[tipo]}» (${tipo}) no tiene lector`); continue; }
  revisa(`Híbrido · intensidad ${INT[tipo]}`, { disciplina: 'hyrox', sets: [{ formato: 'rep', veces: 2, ejercicios: [{ nombre: 'Remo ergómetro', cuanto: '500 m', intensidad: ej }] }] });
}
revisa('Híbrido · sprints, intervalos y límite', { disciplina: 'hyrox', sets: [{ formato: 'rep', veces: 2, ejercicios: [
  { nombre: 'Sprint', sprints: [{ cuanto: '50 m', veces: 3, descanso: '1 min' }], intensidad: 'al máximo' },
  { nombre: 'Sentadilla', cuanto: '20 reps', limite: 'en menos de 60 seg', por_lado: false },
] }] });

/* 5. DEPORTE: cada campo del editor. */
const valorDe = { reps: '8', dist: '10 m', tiempo: '30 seg', desc: '1 min', peso: '5 kg', nota: 'sin balón' };
const PALABRA = { reps: 'reps', dist: 'distancia', tiempo: 'tiempo', desc: 'descanso', peso: 'peso', nota: 'nota' };
for (const c of CAMPOS_DE_DEPORTE) {
  if (!valorDe[c.k] || !PALABRA[c.k]) { mal(`Deporte: el campo «${c.label}» no tiene lector`); continue; }
  if (UNIDADES_DE_DEPORTE[c.k]) for (const [u] of UNIDADES_DE_DEPORTE[c.k]) if (!EJEMPLO_DE_UNIDAD[u] && u !== 'kg' && u !== 'lb') mal(`Deporte: la unidad ${u} de ${c.label} no tiene lector`);
  revisa(`Deporte · ${c.label}`, { disciplina: 'deporte', ejercicios: [{ nombre: 'Pase de pecho', veces: 5, por_lado: true, [PALABRA[c.k]]: valorDe[c.k] }] });
}

/* 6. Lo que no se puede: un error claro, sin guardar a medias. */
for (const [que, s] of [
  ['pieza que no existe', { disciplina: 'correr', piezas: [{ pieza: 'saltos' }] }],
  ['intensidad de otro deporte', { disciplina: 'nadar', piezas: [{ pieza: 'continua', cuanto: '400 m', intensidad: '250 W' }] }],
  ['unidad que no va', { disciplina: 'nadar', piezas: [{ pieza: 'continua', cuanto: '20 cal' }] }],
  ['intervalos con dos formas', { disciplina: 'correr', piezas: [{ pieza: 'int', tramos: [{ cuanto: '1 km', intensidad: '4:20' }, { cuanto: '2 min', intensidad: 'zona 1' }], veces: 4 }] }],
]) {
  try { sesionDesdePalabras(s, { busca }); mal(`Debía rechazar: ${que}`); } catch (e) { if (e.message.length > 20) bien(); else mal(`${que}: el error no explica nada («${e.message}»)`); }
}

// Las Disciplinas y la guía salen de los catálogos.
if (DISCIPLINAS.length < 10 || !guiaDeEscritura().piezas.includes('Intervalos')) mal('La guía de escritura no salió de los catálogos'); else bien();

console.log(fallas ? `\nprueba-sesion-en-palabras: ${fallas} falla(s), ${bienes} bien` : `prueba-sesion-en-palabras: ${bienes} comprobaciones, todo bien.`);
process.exit(fallas ? 1 : 0);
