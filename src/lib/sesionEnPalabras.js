/**
 * LA SESIÓN EN PALABRAS (conector de IA, versión 2, 23 nov 2026; spec `docs/superpowers/specs/2026-11-23-conector-v2.md`).
 *
 * La IA escribe una sesión como se le diría al coach («calentamiento 15 min zona 2; 8 × 1 km a 4:20–4:30 con 2 min de trote») y aquí se
 * traduce a la forma EXACTA que guardan los editores de la app. También al revés: una sesión guardada se lee en esas mismas palabras, para que
 * la IA la vea, la cambie y la vuelva a mandar sin perder nada.
 *
 * Regla de Andrés: lo que se puede escribir sale DEL MISMO CÓDIGO que los editores, no de una lista aparte:
 *   · las piezas, sus nombres, unidades e intensidades salen de `catalogoDeLaLista.js` (Running, Cycling, Swimming, Triatlón),
 *     `hibrido.js` (Híbrido) y `catalogoDeDeporte.js` (Deporte); cada pieza nace con el MISMO constructor que usa el «Agregar» del editor;
 *   · las Disciplinas son las de `fichaDelEjercicio.js` (`FAMILIAS`) y el editor de cada una, el de `editorDeLaSesion.js`.
 * Lo único escrito aquí son los LECTORES por tipo de dato (cuánto, intensidad, tiempo, descanso, peso, veces), con su inverso. Sirven para
 * todas las piezas: una pieza nueva en el editor se puede escribir sin tocar este archivo. `scripts/prueba-sesion-en-palabras.mjs` falla si
 * una opción de un catálogo no se puede escribir, no llega al atleta o al reloj, o no se lee de vuelta igual.
 *
 * Puro: sin React. El conector lo usa copiado en `supabase/functions/mcp/app/` (`scripts/compartir-con-mcp.mjs`).
 */
import { DEPORTES, FORMAS_CAL, FORMAS_CAL_TRI, MATERIAL as MATERIAL_LISTA, NOMBRE_MODO, filaSprint, filaInt, itemTec, setTec, generaTramos, num, dosDigitos } from './catalogoDeLaLista.js';
import { FORMATOS, UN_TRAMO, MATERIAL as MATERIAL_HIBRIDO, INT, PESOS, UNIDADES as UNIDADES_HIBRIDO, setNuevo, renglonNuevo, filaSprint as filaSprintHibrido, nuevoId as nuevoIdHibrido } from './hibrido.js';
import { CAMPOS_DE_DEPORTE, UNIDADES_DE_DEPORTE, itemDeDeporte } from './catalogoDeDeporte.js';
import { FAMILIAS, ORDEN_DE_FAMILIAS } from './fichaDelEjercicio.js';
import { editorDeFamilia, DEPORTE_DEL_EDITOR } from './editorDeLaSesion.js';
import { metaDeIntensidad } from './pasosDeLaLista.js';
import { claseNueva } from './clases.js';

/* ------------------------------------------------------------------ */
/* Lo que se puede elegir, sacado de los catálogos                     */
/* ------------------------------------------------------------------ */

/** Las Disciplinas, como las ve el coach: `{ id, nombre, detalle, editor }`. */
export const DISCIPLINAS = ORDEN_DE_FAMILIAS.map((id) => ({ id, nombre: FAMILIAS[id].nombre, detalle: FAMILIAS[id].detalle, editor: editorDeFamilia(id) }));

/** El catálogo de la lista de una Disciplina (correr, bici, nadar, triatlon) o `null`. */
export function catalogoDe(disciplina) {
  const dep = DEPORTE_DEL_EDITOR[editorDeFamilia(disciplina)];
  return dep ? DEPORTES[dep] : null;
}

/** Las piezas que ofrece «Agregar» en una Disciplina de la lista: `{ id, titulo, ej }`. */
export const piezasDe = (disciplina) => (catalogoDe(disciplina)?.opciones ?? []).map((op) => ({ id: op.id, titulo: op.titulo, ej: op.ej, ...(op.grupo ? { grupo: op.grupo } : null) }));

/* ------------------------------------------------------------------ */
/* Los lectores, por tipo de dato (y su inverso)                       */
/* ------------------------------------------------------------------ */

const limpia = (t) => String(t ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ');
const numero = (t) => String(t).replace(',', '.');
const etiquetaDe = (lista, id) => (lista.find(([k]) => k === id)?.[1] ?? id);

// Cómo se escribe cada unidad. La canónica de segundos es 's'; si el catálogo de esa casilla usa 'seg', se guarda 'seg'.
const UNIDAD_ESCRITA = [
  [/^(km|kms|kilometros?|k)$/, 'km'], [/^(m|mts?|metros?)$/, 'm'], [/^(yd|yds|yardas?)$/, 'yd'],
  [/^(min|mins|minutos?|')$/, 'min'], [/^(s|seg|segs|segundos?|sec|")$/, 's'], [/^(cal|cals|calorias?|kcal)$/, 'cal'],
  [/^(reps?|repeticiones?|veces)$/, 'reps'], [/^(h|hr|hrs|horas?)$/, 'h'],
];
const unidadCanonica = (u) => UNIDAD_ESCRITA.find(([re]) => re.test(limpia(u)))?.[1] ?? null;
const enLista = (canonica, unidades) => {
  const ids = unidades.map(([k]) => k);
  if (canonica === 's') return ids.includes('s') ? 's' : ids.includes('seg') ? 'seg' : null;
  return ids.includes(canonica) ? canonica : null;
};

/**
 * CUÁNTO: «15 min», «1.5 km», «400 m», «30 seg», «20 cal», «1 h». `unidades` es la lista del catálogo de esa casilla (`[['m','m'], …]`).
 * → `{ q, u }` con la unidad como la guarda el editor. Error claro si la unidad no está en esa lista.
 */
export function leeCuanto(texto, unidades) {
  const t = limpia(texto);
  if (!t) return { q: '', u: unidades[0]?.[0] ?? '' };
  const m = t.match(/^(\d+(?:[.,]\d+)?)\s*([a-z'"]*)$/);
  if (!m) throw new Error(`No entendí «${texto}». Escríbelo como número y unidad: ${unidades.map(([, l]) => `«10 ${l}»`).join(', ')}.`);
  let q = numero(m[1]);
  let canonica = m[2] ? unidadCanonica(m[2]) : null;
  if (canonica === 'h') { canonica = 'min'; q = String(Math.round(Number(q) * 60)); }
  if (!m[2]) throw new Error(`A «${texto}» le falta la unidad: ${unidades.map(([, l]) => l).join(', ')}.`);
  const u = canonica && enLista(canonica, unidades);
  if (!u) throw new Error(`«${texto}»: aquí la unidad puede ser ${unidades.map(([, l]) => l).join(', ')}.`);
  return { q, u };
}
/** El inverso de `leeCuanto`: «15 min». Vacío si no hay cantidad. */
export const textoCuanto = (q, u, unidades = []) => (num(q) ? `${q} ${etiquetaDe(unidades, u) === 's' ? 'seg' : etiquetaDe(unidades, u)}` : '');

/** TIEMPO de reloj «4:20» (o «45 seg») → `{ min, seg }`, como `CajaTiempo` del editor. */
export function leeTiempo(texto) {
  const t = limpia(texto).replace(/\s*(min\/km|\/km|\/100 ?m|por 100 ?m|min)$/, '');
  let m = t.match(/^(\d{1,2}):(\d{1,2})$/);
  if (m) return { min: String(Number(m[1])), seg: dosDigitos(Number(m[2])) };
  m = t.match(/^(\d{1,2})\s*(s|seg|segundos?)$/);
  if (m) return { min: '0', seg: dosDigitos(Number(m[1])) };
  throw new Error(`No entendí el tiempo «${texto}». Escríbelo como minutos:segundos, por ejemplo «4:20».`);
}
export const textoTiempo = (v) => (v && (num(v.min) || num(v.seg)) ? `${num(v.min)}:${dosDigitos(Math.round(num(v.seg)))}` : '');

const RANGO = /^(.+?)\s*(?:-|–|a)\s*(.+)$/;
const dosTiempos = (t) => { const r = t.match(RANGO); return r && /\d:\d/.test(r[1]) && /\d:\d/.test(r[2]) ? [leeTiempo(r[1]), leeTiempo(r[2])] : [leeTiempo(t)]; };
const dosNumeros = (t) => { const r = t.match(/^(\d+)\s*(?:-|–|a)\s*(\d+)$/); return r ? [r[1], r[2]] : [t.match(/^(\d+)$/)?.[1] ?? null, '']; };

/**
 * INTENSIDAD de una pieza de la lista: «zona 2», «4:20-4:30» (pace), «1:45/100 m», «250 W», «250-280 W», «140-150 pulsaciones», «RPE 7»,
 * «al máximo», «libre», «en 0:45» (tiempo objetivo). `modos` son los que permite esa pieza en su deporte (el catálogo: `DEPORTES[x].todos`).
 * → `{ modo, z?, vals }` como la guarda el editor.
 */
export function leeIntensidad(texto, modos) {
  const t = limpia(texto);
  const nombres = () => modos.map((m) => NOMBRE_MODO[m] ?? m).join(', ');
  let x = null;
  let m;
  if ((m = t.match(/^zona\s*([1-5])$/))) x = { modo: 'zona', z: Number(m[1]), vals: {} };
  else if ((m = t.match(/^(?:rpe|esfuerzo)\s*(\d{1,2})$/) || t.match(/^(\d{1,2})\s*de\s*10$/))) x = { modo: 'rpe', vals: { rpe: Number(m[1]) } };
  else if (/^(al )?maximo$|^tope$|^a tope$/.test(t)) x = { modo: 'tope', vals: {} };
  else if (/^(ritmo )?libre$/.test(t)) x = { modo: 'libre', vals: {} };
  else if ((m = t.match(/^(.+?)\s*(w|vatios|watts)$/))) { const [de, a] = dosNumeros(m[1].trim()); if (de) x = { modo: 'w', vals: { w: { de, a } } }; }
  else if ((m = t.match(/^(.+?)\s*(pulsaciones|ppm|lpm|bpm)$/))) { const [de, a] = dosNumeros(m[1].trim()); if (de) x = { modo: 'pulso', vals: { pulso: { de, a } } }; }
  else if ((m = t.match(/^en\s+(.+)$/))) { const [a, b] = dosTiempos(m[1]); x = { modo: 'tiempo', vals: { tiempo: a, ...(b ? { tiempo2: b } : null) } }; }
  else if (/\d:\d/.test(t)) {
    const por100 = /(\/\s*100|por 100)/.test(t);
    const [a, b] = dosTiempos(t.replace(/\s*(min\/km|\/km|\/\s*100 ?m|por 100 ?m)\s*/g, ' ').trim());
    const modo = por100 || (!modos.includes('ritmo') && modos.includes('ritmo100')) ? 'ritmo100' : 'ritmo';
    x = { modo, vals: { ritmo: a, ...(b ? { ritmo2: b } : null) } };
  }
  if (!x) throw new Error(`No entendí la intensidad «${texto}». Aquí puede ser: ${nombres()} (por ejemplo «zona 2», «4:20-4:30», «RPE 7»).`);
  if (!modos.includes(x.modo)) throw new Error(`«${texto}» es ${NOMBRE_MODO[x.modo]}, y aquí la intensidad puede ser: ${nombres()}.`);
  return x;
}
/** El inverso de `leeIntensidad`: las mismas palabras que ve el atleta (`metaDeIntensidad`). */
export const textoIntensidad = (x) => metaDeIntensidad(x)?.texto?.replace(' min/km', '') ?? '';

/** DESCANSO de un sprint o una serie: «2 min», «30 seg», «hasta recuperarse», «sin descanso» → `{ dq, du }`. */
export function leeDescanso(texto, opciones = [['s', 'seg'], ['min', 'min'], ['rec', 'hasta recuperarse']]) {
  const t = limpia(texto);
  const ids = opciones.map(([k]) => k);
  const pide = (du) => { if (!ids.includes(du)) throw new Error(`«${texto}»: aquí el descanso puede ser ${opciones.map(([, l]) => l).join(', ')}.`); return du; };
  if (!t || /^sin descanso$|^nada$|^0$/.test(t)) return { dq: '', du: pide(ids.includes('nada') ? 'nada' : ids[0]) };
  if (/recuper|completo|libre/.test(t)) return { dq: '', du: pide('rec') };
  if (/^(regreso )?caminando$|^caminar$|^camina$/.test(t)) return { dq: '', du: pide('camina') };
  if (/^(regreso )?trotando$|^trote$|^trota$/.test(t)) return { dq: '', du: pide('trota') };
  const c = leeCuanto(t, opciones.filter(([k]) => k === 's' || k === 'seg' || k === 'min'));
  return { dq: c.q, du: pide(c.u) };
}
export function textoDescanso(dq, du, opciones = []) {
  if (du === 'rec') return 'hasta recuperarse';
  if (du === 'nada') return 'sin descanso';
  if (du === 'camina' || du === 'trota') return etiquetaDe(opciones, du).toLowerCase();
  return num(dq) ? `${dq} ${du === 's' || du === 'seg' ? 'seg' : 'min'}` : '';
}

/** PESO: «20 kg», «70% 1RM», «45 lb» → `{ q, u }` con `u` de `PESOS` (Híbrido) o del catálogo de esa casilla. */
export function leePeso(texto, unidades = PESOS.map((p) => [p, p])) {
  const t = limpia(texto).replace(/\s+/g, '');
  const m = t.match(/^(\d+(?:[.,]\d+)?)(kg|kgs|kilos?|lb|lbs|libras?|%|%1rm)$/);
  if (!m) throw new Error(`No entendí el peso «${texto}». Escríbelo como «20 kg», «45 lb» o «70% 1RM».`);
  const u = m[2].startsWith('%') ? '% 1RM' : m[2].startsWith('l') ? 'lb' : 'kg';
  if (!unidades.some(([k]) => k === u)) throw new Error(`«${texto}»: aquí el peso puede ser ${unidades.map(([, l]) => l).join(', ')}.`);
  return { q: numero(m[1]), u };
}
export const textoPeso = (p) => (p && num(p.q) ? (p.u === '% 1RM' ? `${p.q}% 1RM` : `${p.q} ${p.u ?? 'kg'}`) : '');

/** LÍMITE de tiempo («en menos de 60 seg», «60 seg», «1:30») → segundos. */
export function leeLimite(texto) {
  const t = limpia(texto).replace(/^(en )?menos de /, '');
  if (/\d:\d/.test(t)) { const v = leeTiempo(t); return Number(v.min) * 60 + Number(v.seg); }
  const c = leeCuanto(t, [['s', 'seg'], ['min', 'min']]);
  return Math.round(Number(c.q) * (c.u === 'min' ? 60 : 1));
}
export const textoLimite = (s) => (num(s) ? (s >= 60 && s % 60 === 0 ? `${s / 60} min` : s > 60 ? `${Math.floor(s / 60)}:${dosDigitos(s % 60)}` : `${s} seg`) : '');

/** VECES: «8», «8 veces» → '8' (texto, como lo guardan los editores). */
export function leeVeces(texto, tope = 30) {
  const m = limpia(texto).match(/^(\d{1,3})( veces| vueltas)?$/);
  if (!m || Number(m[1]) < 1 || Number(m[1]) > tope) throw new Error(`«${texto}»: las veces van de 1 a ${tope}.`);
  return m[1];
}

/** Una opción de una lista del catálogo, por su id o por su palabra («Con trineo» o «trineo»). */
export function leeOpcion(texto, lista, que = 'la opción') {
  const t = limpia(texto);
  const hit = lista.find(([id, l]) => limpia(id) === t || limpia(l) === t || limpia(l).replace(/^(con|en) /, '') === t);
  if (!hit) throw new Error(`«${texto}» no es ${que}. Puede ser: ${lista.map(([, l]) => l).join(', ')}.`);
  return hit[0];
}

/* ------------------------------------------------------------------ */
/* La LISTA: Running, Cycling, Swimming y Triatlón (`day.tramos`)      */
/* ------------------------------------------------------------------ */

const DE_TRI = { nado: 'nado', bici: 'bici', correr: 'correr', carrera: 'correr', natacion: 'nado', ciclismo: 'bici' };
const COMO = { constante: 'uno', progresiva: 'prog', progresivo: 'prog', intervalos: 'int', 'con intervalos': 'int' };
const COMO_TEXTO = { uno: 'constante', prog: 'progresiva', int: 'intervalos' };

/** El catálogo con que se arma una pieza: el de su parte en Triatlón (la bici del triatlón, en ruta). */
function depDePieza(cat, opcion, dxp) {
  if (cat.id !== 'tri') return cat;
  const d = dxp ?? opcion.id.split('-')[0];
  return d === 'bici' ? { ...DEPORTES.bici, unidades: [['min', 'min'], ['km', 'km'], ['m', 'm']], lugar: 'ruta' } : DEPORTES[d] ?? cat;
}

/** Una pieza de la lista escrita en palabras → la pieza que guarda el editor. `busca(nombre)` encuentra un ejercicio del repertorio. */
function piezaDesdePalabras(p, cat, { busca, lugar, supuestos, i }) {
  const donde = `Pieza ${i + 1}`;
  const ids = cat.opciones.map((o) => o.id);
  let id = String(p.pieza ?? '').trim();
  // En Triatlón, «continua» con su deporte es «nado-continua»; también se acepta el nombre de la pieza tal como lo ve el coach.
  if (cat.id === 'tri' && !ids.includes(id) && p.deporte) id = `${DE_TRI[limpia(p.deporte)] ?? limpia(p.deporte)}-${id}`;
  const op = cat.opciones.find((o) => o.id === id) ?? cat.opciones.find((o) => limpia(o.titulo) === limpia(p.pieza));
  if (!op) throw new Error(`${donde}: «${p.pieza}» no es una pieza de ${cat.id === 'tri' ? 'Triatlón' : cat.id}. Puede ser: ${cat.opciones.map((o) => `${o.id} (${o.titulo})`).join(', ')}.`);
  const x = op.crea();
  const dep = depDePieza(cat, op, x.dxp);
  const unidades = dep.id === 'bici' && !x.dxp ? (lugar === 'ruta' ? [['min', 'min'], ['km', 'km'], ['m', 'm']] : dep.unidades) : dep.unidades;
  const intensidad = (texto, modos = dep.todos) => leeIntensidad(texto, modos);
  if (p.nota) x.nota = String(p.nota);
  if (x.k === 'desc') {
    if (p.cuanto) Object.assign(x, leeCuanto(p.cuanto, [['s', 'seg'], ['min', 'min']]));
    if (p.activo || limpia(p.tipo) === 'caminando') x.tipo = 'camina';
    return x;
  }
  if (x.k === 'trans') {
    if (p.limite || p.cuanto) { const s = leeLimite(p.limite ?? p.cuanto); Object.assign(x, s >= 60 && s % 60 === 0 ? { q: String(s / 60), u: 'min' } : { q: String(s), u: 's' }); }
    return x;
  }
  if (x.k === 'tec') {
    x.sets = setsDesdePalabras(p, dep, busca, donde);
    return x;
  }
  if (x.k === 'int') {
    // Sprints y Series: un renglón por sprint (el editor no tiene casilla de cantidad).
    const filas = [];
    const sprints = p.sprints ?? (p.cuanto ? [{ cuanto: p.cuanto, veces: p.veces ?? 1, descanso: p.descanso }] : []);
    for (const s of sprints) {
      const c = leeCuanto(s.cuanto, dep.unidades);
      const d = s.descanso ? leeDescanso(s.descanso) : { dq: '', du: x.filas[0].du };
      const n = Number(leeVeces(String(s.veces ?? 1)));
      for (let k = 0; k < n; k += 1) filas.push({ ...filaSprint(), ...c, ...d });
    }
    if (filas.length) x.filas = filas;
    if (p.intensidad) Object.assign(x, intensidad(p.intensidad, [...new Set([...dep.modosSprint, ...dep.todos])]));
    if (p.ejercicio) { const e = busca(p.ejercicio); x.ej = e ? { exercise_id: e.id, name: e.name } : { name: String(p.ejercicio) }; }
    if (p.material || p.peso) x.con = { tipo: p.material ? leeOpcion(p.material, MATERIAL_LISTA, 'un material') : 'nada', ...(p.peso ? { kg: leePeso(p.peso, [['kg', 'kg']]).q } : null), ...(p.material_otro ? { txt: String(p.material_otro) } : null) };
    if (p.limite) x.limS = leeLimite(p.limite);
    if (p.series) {
      const d = p.series.descanso ? leeCuanto(p.series.descanso, [['s', 'seg'], ['min', 'min']]) : { q: '', u: 'min' };
      x.series = { n: leeVeces(String(p.series.veces), 20), q: d.q, u: d.u };
    }
    return x;
  }
  // k: 'tr' — Calentamiento, Enfriamiento, Carrera/Rodada/Nado continuo e Intervalos.
  if (p.cuanto) Object.assign(x, leeCuanto(p.cuanto, unidades));
  if (x.rol === 'cal' || x.rol === 'calma') {
    const formas = cat.id === 'tri' ? FORMAS_CAL_TRI : FORMAS_CAL;
    if (p.forma) x.forma = leeOpcion(p.forma, formas, 'una forma de calentar');
    else if (p.video) x.forma = 'video';
    else if (p.ejercicios || p.sets) x.forma = 'ejercicios';
    if (x.forma === 'video') {
      if (p.video) x.video = videoGuiado(p.video, busca, donde);
      else supuestos.push(`${donde}: el calentamiento guiado quedó sin video (el coach lo elige en la app)`);
    } else if (x.forma === 'ejercicios') x.sets = setsDesdePalabras(p, dep, busca, donde);
    if (p.intensidad) Object.assign(x, intensidad(p.intensidad));
    return extrasDesdePalabras(x, p, dep, lugar);
  }
  const como = x.rol === 'int' ? 'int' : p.como ? COMO[limpia(p.como)] : (p.tramos?.length ? (p.tramos.length > 1 && !p.repite ? 'prog' : 'int') : 'uno');
  if (!como) throw new Error(`${donde}: «${p.como}» no es cómo se corre. Puede ser: constante, progresiva o intervalos.`);
  if (x.rol !== 'int') x.como = como;
  if (como === 'uno') { if (p.intensidad) Object.assign(x, intensidad(p.intensidad)); if (p.limite) x.limS = leeLimite(p.limite); }
  else if (como === 'prog') {
    // «Empieza en → termina en, cada N»: los tramos los arma la misma cuenta del editor (`generaTramos`).
    if (p.empieza && p.termina && p.cada) {
      const ini = intensidad(p.empieza, dep.modosProg); const fin = intensidad(p.termina, dep.modosProg);
      if (ini.modo !== fin.modo) throw new Error(`${donde}: la progresiva empieza y termina con la misma forma de intensidad (las dos en ${NOMBRE_MODO[ini.modo]}).`);
      const g = { modo: ini.modo, ini: { z: ini.z, vals: ini.vals }, fin: { z: fin.z, vals: fin.vals }, cada: leeCuanto(p.cada, unidades) };
      x.prog = { ...g, lista: generaTramos(x, g) ?? [] };
      if (!x.prog.lista.length) throw new Error(`${donde}: para la progresiva hace falta el total («cuanto») y «cada» en la misma clase de unidad (los dos distancia o los dos tiempo).`);
    } else {
      const filas = (p.tramos ?? []).map((f) => ({ ...filaInt(), ...leeCuanto(f.cuanto, unidades), ...(f.intensidad ? intensidad(f.intensidad, dep.modosProg) : null) }));
      if (!filas.length) throw new Error(`${donde}: la progresiva necesita «tramos» (cada uno con cuánto e intensidad) o «empieza», «termina» y «cada».`);
      const modo = filas.find((f) => f.modo)?.modo;
      if (filas.some((f) => f.modo && f.modo !== modo)) throw new Error(`${donde}: en una progresiva todos los tramos usan la misma forma de intensidad.`);
      x.prog = { modo, ini: {}, fin: {}, cada: { q: '', u: unidades[0][0] }, lista: filas.map((f) => ({ ...f, modo })) };
    }
  } else {
    const filas = (p.tramos ?? []).map((f) => ({ ...filaInt(), ...leeCuanto(f.cuanto, unidades), ...(f.intensidad ? intensidad(f.intensidad, dep.modosTabla) : null) }));
    if (!filas.length) throw new Error(`${donde}: los intervalos necesitan «tramos», por ejemplo [{ cuanto: "1 km", intensidad: "4:20-4:30" }, { cuanto: "2 min", intensidad: "zona 1" }].`);
    const modo = filas.find((f) => f.modo)?.modo;
    if (filas.some((f) => f.modo && f.modo !== modo)) throw new Error(`${donde}: en una tabla de intervalos todos los renglones usan la misma forma de intensidad (${NOMBRE_MODO[modo]}); el trote suave también va en esa forma, por ejemplo con su ${NOMBRE_MODO[modo]}.`);
    const veces = p.veces ? Number(leeVeces(String(p.veces), 60)) : null;
    const base = { km: 1, m: 0.001, min: 1, s: 1 / 60 };
    const tipo = (u) => (u === 'km' || u === 'm' ? 'd' : u === 'min' || u === 's' ? 't' : null);
    const parejo = filas.every((f) => tipo(f.u) && tipo(f.u) === tipo(filas[0].u));
    if (veces && parejo && !p.cuanto) {
      // «8 veces» con la lista en una sola clase de unidad: el total es la suma, y «Repetir hasta completar» (como lo arma el coach).
      const suma = filas.reduce((a, f) => a + num(f.q) * base[f.u], 0) * veces;
      const u = tipo(filas[0].u) === 'd' ? 'km' : 'min';
      x.q = String(Math.round(suma * 100) / 100); x.u = enLista(u, unidades) ?? u;
      x.ints = { repite: true, modo, lista: filas.map((f) => ({ ...f, modo })) };
    } else if (veces) {
      // Distancia y tiempo mezclados («1 km rápido + 2 min suave»): el editor no puede repetirlos hasta un total; van escritos tal cual.
      x.ints = { repite: false, modo, lista: Array.from({ length: veces }, () => filas.map((f) => ({ ...f, id: filaInt().id, modo }))).flat() };
      if (!p.cuanto) { x.q = ''; supuestos.push(`${donde}: los intervalos mezclan distancia y tiempo; quedaron escritos ${veces} veces, sin total`); }
    } else x.ints = { repite: p.repite !== false, modo, lista: filas.map((f) => ({ ...f, modo })) };
    if (p.final) x.ints.fin = intensidad(p.final, dep.modosTabla);
  }
  return extrasDesdePalabras(x, p, dep, lugar);
}

/** Lo de «Para toda la carrera / rodada»: cadencia, caminadora, resistencia, postura y terreno. */
function extrasDesdePalabras(x, p, dep, lugar) {
  if (p.cadencia) x.cad = String(num(p.cadencia) || p.cadencia);
  if (p.caminadora) x.cam = { ...(p.caminadora.kmh ? { kmh: String(p.caminadora.kmh) } : null), ...(p.caminadora.inclinacion ? { inc: String(p.caminadora.inclinacion) } : null) };
  if (dep.id === 'bici' && lugar !== 'ruta' && p.resistencia) x.res = String(p.resistencia);
  if (dep.id === 'bici' && lugar !== 'ruta' && p.postura) x.pos = leeOpcion(p.postura, [['sentado', 'Sentado'], ['pie', 'De pie'], ['alterna', 'Alternando']], 'una postura');
  if (dep.id === 'bici' && (lugar === 'ruta' || x.dxp) && p.terreno) x.ter = leeOpcion(p.terreno, [['plano', 'Plano'], ['subida', 'Subida'], ['mixto', 'Mixto']], 'un terreno');
  return x;
}

/** El video de un calentamiento guiado: un ejercicio guiado del repertorio (por nombre) o una liga. */
function videoGuiado(v, busca, donde) {
  const texto = typeof v === 'string' ? v : v?.url ?? v?.nombre;
  if (/^https?:\/\//i.test(String(texto))) return claseNueva({ url: String(texto), duracion: v?.duracion });
  const e = busca(texto);
  if (!e) throw new Error(`${donde}: no encontré el calentamiento guiado «${texto}» en el repertorio.`);
  return { ...claseNueva({ url: e.video_url || e.video_link || '', duracion: e.duracion_s }), nombre: e.name, exercise_id: e.id };
}

/** Los Sets de ejercicios de una Técnica o de un calentamiento «Ejercicios». */
function setsDesdePalabras(p, dep, busca, donde) {
  const sets = p.sets ?? (p.ejercicios ? [{ veces: p.veces ?? 1, ejercicios: p.ejercicios, descanso: p.descanso_entre_sets }] : []);
  return sets.map((s, si) => {
    const set = setTec([], dep.descansoTec?.[0]?.[0] ?? 'camina');
    set.veces = Number(leeVeces(String(s.veces ?? 1), 20));
    set.items = (s.ejercicios ?? []).map((ej) => {
      const e = busca(ej.nombre);
      const it = itemTec(e ?? { name: String(ej.nombre) }, dep.unidadesTec?.[0]?.[0] ?? 'm', set.du);
      if (!e) it.exercise_id = undefined;
      if (ej.cuanto) Object.assign(it, leeCuanto(ej.cuanto, dep.unidadesTec ?? [['m', 'm'], ['reps', 'reps'], ['s', 'seg']]));
      if (ej.descanso) Object.assign(it, leeDescanso(ej.descanso, dep.descansoTec));
      if (ej.por_lado) it.lado = true;
      if (ej.peso) it.peso = leePeso(ej.peso, [['kg', 'kg']]);
      if (ej.material) it.mat = (Array.isArray(ej.material) ? ej.material : [ej.material]).map(String);
      if (ej.nota) it.nota = String(ej.nota);
      return it;
    });
    if (!set.items.length) throw new Error(`${donde}, set ${si + 1}: le faltan los ejercicios.`);
    if (s.descanso) { const d = leeDescanso(s.descanso, dep.descansoTec); set.dq = d.dq; set.du = d.du; }
    return set;
  });
}

/** Una pieza guardada → en palabras (lo que se manda de vuelta para reescribirla igual). */
function piezaEnPalabras(x, cat) {
  const op = cat.opciones.find((o) => { const c = o.crea(); return c.k === x.k && (c.rol ?? null) === (x.rol ?? null) && (c.dxp ?? null) === (x.dxp ?? null); });
  const dep = depDePieza(cat, op ?? { id: '' }, x.dxp);
  const out = { pieza: op?.id ?? x.rol ?? x.k, ...(x.dxp ? { deporte: x.dxp } : null) };
  const cuanto = textoCuanto(x.q, x.u, dep.unidades ?? []);
  const fuerza = textoIntensidad(x);
  if (x.k === 'desc') return { ...out, ...(cuanto ? { cuanto } : null), ...(x.tipo === 'camina' ? { activo: true } : null) };
  if (x.k === 'trans') return { ...out, ...(num(x.q) ? { limite: textoCuanto(x.q, x.u, [['s', 'seg'], ['min', 'min']]) } : null) };
  if (x.k === 'tec') return { ...out, sets: setsEnPalabras(x.sets ?? [], dep), ...(x.nota ? { nota: x.nota } : null) };
  if (x.k === 'int') {
    return {
      ...out, sprints: (x.filas ?? []).filter((f) => num(f.q)).map((f) => ({ cuanto: textoCuanto(f.q, f.u, dep.unidades), ...(textoDescanso(f.dq, f.du) ? { descanso: textoDescanso(f.dq, f.du) } : null) })),
      ...(fuerza ? { intensidad: fuerza } : null), ...(x.ej?.name ? { ejercicio: x.ej.name } : null),
      ...(x.con?.tipo && x.con.tipo !== 'nada' ? { material: x.con.tipo } : null), ...(num(x.con?.kg) ? { peso: `${x.con.kg} kg` } : null),
      ...(x.limS ? { limite: textoLimite(x.limS) } : null), ...(num(x.series?.n) ? { series: { veces: x.series.n, ...(num(x.series.q) ? { descanso: `${x.series.q} ${x.series.u === 's' ? 'seg' : 'min'}` } : null) } } : null),
      ...(x.nota ? { nota: x.nota } : null),
    };
  }
  const extras = {
    ...(x.cad ? { cadencia: x.cad } : null), ...(x.cam ? { caminadora: { ...(x.cam.kmh ? { kmh: x.cam.kmh } : null), ...(x.cam.inc ? { inclinacion: x.cam.inc } : null) } } : null),
    ...(x.res ? { resistencia: x.res } : null), ...(x.pos ? { postura: x.pos } : null), ...(x.ter ? { terreno: x.ter } : null), ...(x.nota ? { nota: x.nota } : null),
  };
  if (x.rol === 'cal' || x.rol === 'calma') {
    return {
      ...out, ...(cuanto ? { cuanto } : null), forma: x.forma ?? 'trote', ...(fuerza && x.forma !== 'video' && x.forma !== 'ejercicios' ? { intensidad: fuerza } : null),
      ...(x.forma === 'video' && x.video ? { video: x.video.nombre || x.video.url } : null), ...(x.forma === 'ejercicios' ? { sets: setsEnPalabras(x.sets ?? [], dep) } : null), ...extras,
    };
  }
  const como = x.rol === 'int' ? 'int' : x.como ?? (x.ints?.lista?.length ? 'int' : x.prog ? 'prog' : 'uno');
  const tramos = (lista, modo) => lista.map((f) => ({ cuanto: textoCuanto(f.q, f.u, dep.unidades), ...(textoIntensidad({ ...f, modo }) ? { intensidad: textoIntensidad({ ...f, modo }) } : null) }));
  if (como === 'prog' && x.prog) {
    const g = x.prog;
    const conIni = g.cada?.q && (g.ini?.z || Object.keys(g.ini?.vals ?? {}).length);
    return { ...out, ...(cuanto ? { cuanto } : null), como: COMO_TEXTO.prog, ...(conIni
      ? { empieza: textoIntensidad({ modo: g.modo, ...g.ini }), termina: textoIntensidad({ modo: g.modo, ...g.fin }), cada: textoCuanto(g.cada.q, g.cada.u, dep.unidades) }
      : { tramos: tramos(g.lista ?? [], g.modo) }), ...extras };
  }
  if (como === 'int' && x.ints) {
    // Escritos tal cual (sin repetir hasta un total): si la lista es el mismo patrón N veces, se lee «tramos + veces» (como se escribió).
    const todos = tramos(x.ints.lista ?? [], x.ints.modo);
    // Solo si mezcla distancia y tiempo: con una sola clase de unidad, «veces» se reescribiría como «repetir hasta completar» (otra forma).
    const clases = new Set((x.ints.lista ?? []).map((f) => (f.u === 'km' || f.u === 'm' ? 'd' : 't')));
    const patron = x.ints.repite === false && !cuanto && clases.size > 1 ? patronQueSeRepite(todos) : null;
    if (patron) return { ...out, ...(x.rol === 'int' ? null : { como: COMO_TEXTO.int }), tramos: patron.tramos, veces: String(patron.veces), ...extras };
    return { ...out, ...(cuanto ? { cuanto } : null), ...(x.rol === 'int' ? null : { como: COMO_TEXTO.int }), tramos: todos, ...(x.ints.repite === false ? { repite: false } : null),
      ...(x.ints.fin && textoIntensidad({ modo: x.ints.modo, ...x.ints.fin }) ? { final: textoIntensidad({ modo: x.ints.modo, ...x.ints.fin }) } : null), ...extras };
  }
  return { ...out, ...(cuanto ? { cuanto } : null), ...(x.rol === 'continua' ? { como: COMO_TEXTO.uno } : null), ...(fuerza ? { intensidad: fuerza } : null), ...(x.limS ? { limite: textoLimite(x.limS) } : null), ...extras };
}

/** `[a, b, a, b, a, b]` → `{ tramos: [a, b], veces: 3 }`; `null` si no es un patrón repetido al menos 2 veces. */
function patronQueSeRepite(lista) {
  for (let n = 1; n <= lista.length / 2; n += 1) {
    if (lista.length % n) continue;
    const base = JSON.stringify(lista.slice(0, n));
    let ok = true;
    for (let k = n; k < lista.length && ok; k += n) ok = JSON.stringify(lista.slice(k, k + n)) === base;
    if (ok) return { tramos: lista.slice(0, n), veces: lista.length / n };
  }
  return null;
}

function setsEnPalabras(sets, dep) {
  return sets.map((s) => ({
    veces: String(s.veces ?? 1),
    ejercicios: (s.items ?? []).map((it) => ({
      nombre: it.name, ...(textoCuanto(it.q, it.u, dep.unidadesTec ?? []) ? { cuanto: textoCuanto(it.q, it.u, dep.unidadesTec ?? []) } : null),
      ...(textoDescanso(it.dq, it.du, dep.descansoTec ?? []) ? { descanso: textoDescanso(it.dq, it.du, dep.descansoTec ?? []) } : null),
      ...(it.lado ? { por_lado: true } : null), ...(textoPeso(it.peso) ? { peso: textoPeso(it.peso) } : null), ...((it.mat ?? []).length ? { material: it.mat } : null), ...(it.nota ? { nota: it.nota } : null),
    })),
    ...(textoDescanso(s.dq, s.du, dep.descansoTec ?? []) ? { descanso: textoDescanso(s.dq, s.du, dep.descansoTec ?? []) } : null),
  }));
}

/* ------------------------------------------------------------------ */
/* HÍBRIDO (`day.hibrido.sets`)                                        */
/* ------------------------------------------------------------------ */

const COMO_HIBRIDO = { normal: 'uno', uno: 'uno', sprints: 'sprint', sprint: 'sprint', progresiva: 'prog', intervalos: 'int' };

/** La intensidad de un renglón del Híbrido: las mismas palabras que la lista, con las llaves de `INT` (pace, zona, pulso, w, r500…). */
export function leeIntensidadHibrido(texto) {
  const t = limpia(texto);
  let m;
  if ((m = t.match(/^rir\s*(\d)$/))) return { tipo: 'rir', a: m[1], b: '' };
  if ((m = t.match(/^(.+?)\s*\/\s*500 ?m$/))) { const [a, b] = m[1].split(/\s*(?:-|–|a)\s*/); leeTiempo(a); return { tipo: 'r500', a, b: b ?? '' }; }
  const x = leeIntensidad(texto, ['zona', 'rpe', 'tope', 'ritmo', 'pulso', 'w', 'tiempo']);
  if (x.modo === 'zona') return { tipo: 'zona', a: String(x.z), b: '' };
  if (x.modo === 'rpe') return { tipo: 'rpe', a: String(x.vals.rpe), b: '' };
  if (x.modo === 'tope') return { tipo: 'tope', a: '', b: '' };
  if (x.modo === 'ritmo') return { tipo: 'pace', a: textoTiempo(x.vals.ritmo), b: textoTiempo(x.vals.ritmo2) };
  if (x.modo === 'tiempo') return { tipo: 'tiempo', a: textoTiempo(x.vals.tiempo), b: textoTiempo(x.vals.tiempo2) };
  return { tipo: x.modo, a: x.vals[x.modo].de, b: x.vals[x.modo].a ?? '' };
}
export function textoIntensidadHibrido(int) {
  if (!int?.tipo) return '';
  const r = (s) => (int.a ? `${int.a}${int.b ? `-${int.b}` : ''}${s}` : '');
  return { rpe: int.a ? `RPE ${int.a}` : '', rir: int.a ? `RIR ${int.a}` : '', zona: int.a ? `zona ${int.a}` : '', pace: r(''), pulso: r(' pulsaciones'), w: r(' W'), r500: r(' /500 m'), tope: 'al máximo', tiempo: int.a ? `en ${int.a}` : '' }[int.tipo] ?? '';
}

function hibridoDesdePalabras(s, { busca, supuestos }) {
  const sets = (s.sets ?? []).map((st, si) => {
    const donde = `Set ${si + 1}`;
    const set = setNuevo();
    if (st.formato) set.fmt = leeOpcion(st.formato, FORMATOS, 'un formato de Set');
    if (st.veces) set.veces = Number(leeVeces(String(st.veces), 30));
    if (st.minutos) set.min = String(num(st.minutos) || st.minutos);
    if (st.descanso_entre_vueltas) { const c = leeCuanto(st.descanso_entre_vueltas, [['seg', 'seg'], ['min', 'min']]); set.descV = { q: c.q, u: c.u }; }
    if (st.descanso_despues) { const c = leeCuanto(st.descanso_despues, [['seg', 'seg'], ['min', 'min']]); set.descS = { q: c.q, u: c.u }; }
    set.items = (st.ejercicios ?? []).map((ej, ii) => {
      const e = busca(ej.nombre);
      if (!e) supuestos.push(`${donde}: «${ej.nombre}» se guardó sin ficha del repertorio`);
      const it = renglonNuevo(e ?? { name: String(ej.nombre) }, Array.isArray(e?.disciplinas) ? e.disciplinas : []);
      if (!e) it.name = String(ej.nombre);
      if (ej.cuanto) Object.assign(it, leeCuanto(ej.cuanto, UNIDADES_HIBRIDO));
      if (ej.peso) it.peso = leePeso(ej.peso);
      if (ej.intensidad) it.int = leeIntensidadHibrido(ej.intensidad);
      if (ej.descanso) { const c = leeCuanto(ej.descanso, [['seg', 'seg'], ['min', 'min']]); it.desc = { q: c.q, u: c.u }; }
      if (ej.por_lado) it.lado = true;
      if (ej.limite) { const sg = leeLimite(ej.limite); it.limite = sg % 60 === 0 && sg >= 60 ? { q: String(sg / 60), u: 'min' } : { q: String(sg), u: 'seg' }; }
      if (ej.nota) it.nota = String(ej.nota);
      if (ej.como) { const c = COMO_HIBRIDO[limpia(ej.como)]; if (!c) throw new Error(`${donde}, ejercicio ${ii + 1}: «${ej.como}» puede ser normal, sprints, progresiva o intervalos.`); it.como = c; }
      if (ej.sprints) { it.como = 'sprint'; it.spr = ej.sprints.flatMap((f) => Array.from({ length: Number(leeVeces(String(f.veces ?? 1))) }, () => ({ ...filaSprintHibrido(), ...leeCuanto(f.cuanto, UN_TRAMO), ...(f.descanso ? (() => { const c = leeCuanto(f.descanso, [['seg', 'seg'], ['min', 'min']]); return { dq: c.q, du: c.u }; })() : null) }))); }
      if (ej.tramos) {
        const lista = ej.tramos.map((f) => { const c = leeCuanto(f.cuanto, UN_TRAMO); const i = f.intensidad ? leeIntensidadHibrido(f.intensidad) : null; return { id: nuevoIdHibrido(), ...c, a: i?.a ?? '', b: i?.b ?? '', ...(i ? { _t: i.tipo } : null) }; });
        if (!it.int && lista[0]?._t) it.int = { tipo: lista[0]._t, a: '', b: '' };
        const limpio = lista.map(({ _t, ...f }) => f);
        if ((it.como ?? (ej.repite === undefined ? 'prog' : 'int')) === 'int' || ej.repite !== undefined) { it.como = 'int'; it.iv = { repite: ej.repite !== false, lista: limpio }; } else { it.como = 'prog'; it.pg = { lista: limpio }; }
      }
      if (ej.material) it.mat = leeOpcion(ej.material, MATERIAL_HIBRIDO, 'un material');
      if (ej.cadencia) it.cad = String(ej.cadencia);
      if (ej.maquina !== undefined) it.maq = String(ej.maquina ?? '');
      if (ej.por_vuelta) { it.pv = true; it.vueltas = ej.por_vuelta.map((v) => ({ id: nuevoIdHibrido(), a: v.intensidad ? leeIntensidadHibrido(v.intensidad).a : '', p: v.peso ? leePeso(v.peso).q : '' })); }
      return it;
    });
    if (!set.items.length) throw new Error(`${donde}: le faltan los ejercicios.`);
    return set;
  });
  if (!sets.length) throw new Error('El Híbrido necesita «sets», cada uno con sus ejercicios.');
  return { sets };
}

function hibridoEnPalabras(h) {
  return {
    sets: (h?.sets ?? []).map((st) => ({
      formato: st.fmt, ...(st.fmt === 'rep' ? { veces: String(st.veces) } : null), ...(st.fmt === 'amrap' || st.fmt === 'emom' ? { minutos: String(st.min) } : null),
      ...(st.descV?.q ? { descanso_entre_vueltas: `${st.descV.q} ${st.descV.u}` } : null), ...(st.descS?.q ? { descanso_despues: `${st.descS.q} ${st.descS.u}` } : null),
      ejercicios: (st.items ?? []).map((it) => ({
        nombre: it.name, ...(num(it.q) ? { cuanto: `${it.q} ${it.u}` } : null), ...(textoPeso(it.peso) ? { peso: textoPeso(it.peso) } : null),
        ...(textoIntensidadHibrido(it.int) ? { intensidad: textoIntensidadHibrido(it.int) } : null), ...(it.desc?.q ? { descanso: `${it.desc.q} ${it.desc.u}` } : null),
        ...(it.lado ? { por_lado: true } : null), ...(it.limite?.q ? { limite: `${it.limite.q} ${it.limite.u}` } : null), ...(it.nota ? { nota: it.nota } : null),
        ...(it.como && it.como !== 'uno' ? { como: { sprint: 'sprints', prog: 'progresiva', int: 'intervalos' }[it.como] } : null),
        ...(it.como === 'sprint' ? { sprints: (it.spr ?? []).filter((f) => num(f.q)).map((f) => ({ cuanto: `${f.q} ${f.u}`, ...(f.dq ? { descanso: `${f.dq} ${f.du}` } : null) })) } : null),
        ...(it.como === 'prog' ? { tramos: (it.pg?.lista ?? []).map((f) => ({ cuanto: `${f.q} ${f.u}`, ...(f.a ? { intensidad: textoIntensidadHibrido({ ...it.int, a: f.a, b: f.b }) } : null) })) } : null),
        ...(it.como === 'int' ? { tramos: (it.iv?.lista ?? []).map((f) => ({ cuanto: `${f.q} ${f.u}`, ...(f.a ? { intensidad: textoIntensidadHibrido({ ...it.int, a: f.a, b: f.b }) } : null) })), repite: it.iv?.repite !== false } : null),
        ...(it.mat ? { material: it.mat } : null), ...(it.cad ? { cadencia: it.cad } : null), ...(it.maq !== null && it.maq !== undefined ? { maquina: it.maq } : null),
        ...(it.pv ? { por_vuelta: (it.vueltas ?? []).map((v) => ({ ...(v.a ? { intensidad: textoIntensidadHibrido({ ...it.int, a: v.a }) } : null), ...(v.p ? { peso: `${v.p} ${it.peso?.u ?? 'kg'}` } : null) })) } : null),
      })),
    })),
  };
}

/* ------------------------------------------------------------------ */
/* DEPORTE (`day.deporte`)                                             */
/* ------------------------------------------------------------------ */

function deporteDesdePalabras(s, { busca, supuestos }) {
  const items = (s.ejercicios ?? []).map((ej) => {
    const e = busca(ej.nombre);
    if (!e) supuestos.push(`«${ej.nombre}» se guardó sin ficha del repertorio (sin Ejemplo ni Explicación)`);
    const it = itemDeDeporte(e ?? { id: undefined, name: String(ej.nombre) });
    if (ej.veces) it.veces = leeVeces(String(ej.veces), 99);
    if (ej.por_lado) it.lado = true;
    for (const c of CAMPOS_DE_DEPORTE) {
      const v = ej[{ reps: 'reps', dist: 'distancia', tiempo: 'tiempo', desc: 'descanso', peso: 'peso', nota: 'nota' }[c.k]];
      if (v === undefined || v === null || v === '') continue;
      if (c.k === 'reps') it.reps = String(num(v) || v);
      else if (c.k === 'nota') it.nota = String(v);
      else if (c.k === 'peso') it.peso = leePeso(v, UNIDADES_DE_DEPORTE.peso);
      else it[c.k] = leeCuanto(v, UNIDADES_DE_DEPORTE[c.k]);
    }
    return it;
  });
  if (!items.length) throw new Error('El Deporte necesita «ejercicios».');
  return { items, ...(s.nota ? { nota: String(s.nota) } : null) };
}

function deporteEnPalabras(d) {
  return {
    ejercicios: (d?.items ?? []).map((it) => ({
      nombre: it.name, ...(it.veces ? { veces: String(it.veces) } : null), ...(it.lado ? { por_lado: true } : null), ...(it.reps ? { reps: String(it.reps) } : null),
      ...(it.dist?.q ? { distancia: `${it.dist.q} ${it.dist.u}` } : null), ...(it.tiempo?.q ? { tiempo: `${it.tiempo.q} ${it.tiempo.u}` } : null),
      ...(it.desc?.q ? { descanso: `${it.desc.q} ${it.desc.u}` } : null), ...(textoPeso(it.peso) ? { peso: textoPeso(it.peso) } : null), ...(it.nota ? { nota: it.nota } : null),
    })),
    ...(d?.nota ? { nota: d.nota } : null),
  };
}

/* ------------------------------------------------------------------ */
/* La sesión entera                                                    */
/* ------------------------------------------------------------------ */

/** Un calentamiento de una sesión de Sets o de Deporte (misma forma que el de la lista, ver `pasosDelCalentamiento`). */
function calentamientoDesdePalabras(c, { busca, supuestos }, rol = 'cal') {
  const x = { rol, forma: c.video ? 'video' : 'ejercicios' };
  if (c.forma) x.forma = leeOpcion(c.forma, FORMAS_CAL.filter(([k]) => k !== 'trote'), 'una forma de calentar');
  if (x.forma === 'video') { if (c.video) x.video = videoGuiado(c.video, busca, 'Calentamiento'); else supuestos.push('El calentamiento guiado quedó sin video'); if (c.cuanto) Object.assign(x, leeCuanto(c.cuanto, [['min', 'min']])); }
  else x.sets = setsDesdePalabras(c, DEPORTES.correr, busca, 'Calentamiento');
  return x;
}
const calentamientoEnPalabras = (c) => (c ? { forma: c.forma ?? 'video', ...(c.forma !== 'ejercicios' && c.video ? { video: c.video.nombre || c.video.url } : null), ...(num(c.q) ? { cuanto: `${c.q} min` } : null), ...(c.forma === 'ejercicios' ? { sets: setsEnPalabras(c.sets ?? [], DEPORTES.correr) } : null) } : null);

/**
 * La sesión en palabras → lo que guarda el editor en el día (solo lo de su editor; el nombre, el tipo y los ejercicios de Gym los pone el
 * conector como siempre). `s = { disciplina, lugar?, piezas? | sets? | ejercicios? (Deporte), calentamiento?, enfriamiento?, clase? }`.
 * → `{ dia, supuestos }`. Lanza `Error` con lo que falta, para que la IA lo corrija.
 */
export function sesionDesdePalabras(s, { busca = () => null } = {}) {
  const disciplina = s.disciplina ? (DISCIPLINAS.find((d) => d.id === s.disciplina || limpia(d.nombre) === limpia(s.disciplina))?.id) : null;
  if (s.disciplina && !disciplina) throw new Error(`«${s.disciplina}» no es una Disciplina. Puede ser: ${DISCIPLINAS.map((d) => `${d.id} (${d.nombre})`).join(', ')}.`);
  const editor = editorDeFamilia(disciplina);
  const supuestos = [];
  const ctx = { busca, supuestos };
  const dia = { disciplina: disciplina ?? undefined };
  const cat = catalogoDe(disciplina);
  if (cat) {
    const lugar = cat.id === 'bici' ? (s.lugar ? leeOpcion(s.lugar, [['ruta', 'En ruta'], ['estatica', 'Estática']], 'dónde se rueda') : undefined) : undefined;
    if (lugar) dia.lugar = lugar;
    if (cat.id === 'bici' && !lugar) supuestos.push('Cycling en bici estática (lo de siempre); si es en ruta, dilo');
    const piezas = s.piezas ?? [];
    if (!piezas.length) throw new Error(`Una sesión de ${FAMILIAS[disciplina].nombre} necesita «piezas»: ${piezasDe(disciplina).map((p) => p.id).join(', ')}.`);
    dia.tramos = piezas.map((p, i) => piezaDesdePalabras(p, cat, { ...ctx, lugar, i }));
  } else if (editor === 'cadena') dia.hibrido = hibridoDesdePalabras(s, ctx);
  else if (editor === 'deporte') {
    dia.deporte = deporteDesdePalabras(s, ctx);
    if (s.calentamiento) dia.deporte.cal = calentamientoDesdePalabras(s.calentamiento, ctx);
    if (s.enfriamiento) dia.deporte.calma = calentamientoDesdePalabras(s.enfriamiento, ctx, 'calma');
  } else if (s.calentamiento) dia.calentamiento = calentamientoDesdePalabras(s.calentamiento, ctx);
  if (s.clase) {
    const url = typeof s.clase === 'string' ? s.clase : s.clase.url;
    if (!/^https?:\/\//i.test(String(url ?? ''))) throw new Error('La clase en video necesita la liga del video (de una subida o de YouTube, Vimeo…).');
    dia.clase = claseNueva({ url, duracion: s.clase.duracion, inicio: s.clase.inicio, fin: s.clase.fin });
  }
  return { dia, supuestos };
}

/** Un día guardado → la sesión en palabras (lo de su editor). Lo que no es de los editores nuevos (ejercicios de Gym) lo lee el conector como siempre. */
export function palabrasDeSesion(day = {}) {
  const out = {};
  if (day.disciplina) out.disciplina = day.disciplina;
  const cat = catalogoDe(day.disciplina) ?? (Array.isArray(day.tramos) && day.tramos.length ? DEPORTES.correr : null);
  if (Array.isArray(day.tramos) && day.tramos.length && cat) {
    if (day.lugar) out.lugar = day.lugar;
    out.piezas = day.tramos.map((x) => piezaEnPalabras(x, cat));
  }
  if (day.hibrido?.sets?.length) Object.assign(out, hibridoEnPalabras(day.hibrido));
  if (day.deporte?.items?.length) {
    Object.assign(out, deporteEnPalabras(day.deporte));
    if (day.deporte.cal) out.calentamiento = calentamientoEnPalabras(day.deporte.cal);
    if (day.deporte.calma) out.enfriamiento = calentamientoEnPalabras(day.deporte.calma);
  }
  if (day.calentamiento) out.calentamiento = calentamientoEnPalabras(day.calentamiento);
  if (day.clase?.url) out.clase = { url: day.clase.url, ...(day.clase.duracion ? { duracion: day.clase.duracion } : null), ...(day.clase.inicio ? { inicio: day.clase.inicio } : null), ...(day.clase.fin ? { fin: day.clase.fin } : null) };
  return out;
}

/** Lo que el catálogo deja escribir, para las descripciones de las herramientas (se genera; no se escribe a mano). */
export function guiaDeEscritura() {
  const lista = ['correr', 'bici', 'nadar', 'triatlon'].map((d) => `${FAMILIAS[d].nombre}: ${piezasDe(d).map((p) => `${p.id} (${p.titulo})`).join(', ')}`).join('. ');
  const modos = [...new Set(Object.values(DEPORTES).flatMap((d) => d.todos))].map((m) => NOMBRE_MODO[m]).join(', ');
  return {
    disciplinas: DISCIPLINAS.map((d) => `${d.id} (${d.nombre})`).join(', '),
    piezas: lista,
    intensidades: modos,
    formatos_hibrido: FORMATOS.map(([k, l]) => `${k} (${l})`).join(', '),
    intensidades_hibrido: Object.entries(INT).map(([k, l]) => `${k} (${l})`).join(', '),
    campos_deporte: CAMPOS_DE_DEPORTE.map((c) => c.label).join(', '),
  };
}
