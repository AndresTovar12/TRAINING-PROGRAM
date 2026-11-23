/**
 * EL EDITOR HÍBRIDO Y LA FICHA DEL EJERCICIO (acordado con Andrés en el prototipo, 19 nov 2026).
 *
 * Una sesión Híbrida (Hyrox, CrossFit) es una CADENA de Sets, y en cada Set un renglón por ejercicio. Qué casillas trae cada renglón lo
 * decide la FICHA del ejercicio, sin preguntarle nada nuevo al coach:
 *
 *   · FUERZA   el peso ES la intensidad. Una sola casilla («Peso o intensidad»): kg, % 1RM, RPE o RIR. Nunca cambia de lugar.
 *   · CARRERA  no es lo mismo: la intensidad (Pace, Zona, Pulso…) va en la casilla y el chaleco o el trineo van aparte, en «Carga extra».
 *   · MÁQUINA  (Remo, Bici, Esquí) solo intensidad.
 *   · DUDA     la ficha no alcanza para saberlo: salen todas las opciones y la app APRENDE de lo que el coach elige (lo anota en la ficha).
 *
 * De dónde sale el tipo, en este orden:
 *   1. el EQUIPO de máquina (Remo, Bici, Esquí);
 *   2. lo que la ficha ya guarda de cómo se usa (`carga_tipo`: ritmo, nado, zona, vatios, kilos…). Son los dos datos que ya no se preguntan
 *      en el formulario (19 nov) pero se conservan, y que la app llena sola la primera vez que el coach usa el ejercicio;
 *   3. las DISCIPLINAS del ejercicio (las que marca el coach o las que se marcan solas por las sesiones donde lo usa);
 *   4. el EQUIPO que pesa (Barra, Mancuerna, Kettlebell, Trineo…).
 * «Peso corporal» solo no dice nada: lo tienen igual una plancha que un sprint.
 */
import { equipoPesa, disciplinasVigentes } from './fichaDelEjercicio.js';

export const UNIDADES = [['reps', 'reps'], ['m', 'm'], ['km', 'km'], ['seg', 'seg'], ['min', 'min'], ['cal', 'cal']];
export const INT = { rpe: 'RPE', rir: 'RIR', pace: 'Pace', zona: 'Zona', pulso: 'Pulso', w: 'Vatios', r500: 'Ritmo /500 m', tope: 'Al máximo', tiempo: 'Tiempo' };
export const PESOS = ['kg', '% 1RM', 'lb'];
export const DE_CARDIO = ['pace', 'zona', 'pulso', 'w', 'r500', 'tope', 'tiempo'];
export const RANGO = ['pace', 'pulso', 'r500'];   // se escriben «de … a …»
export const GRUPO = { rpe: 'Esfuerzo', rir: 'Esfuerzo', pace: 'Cardio', zona: 'Cardio', pulso: 'Cardio', w: 'Cardio', r500: 'Cardio', tope: 'Cardio', tiempo: 'Cardio' };
// Del editor (`EditorHibrido.jsx`), aquí desde el 23 nov 2026 para que el conector de IA arme con las mismas listas.
export const FORMATOS = [['rep', 'Se repite'], ['amrap', 'AMRAP'], ['emom', 'EMOM'], ['tiempo', 'Por tiempo']];
export const UN_TRAMO = [['m', 'm'], ['km', 'km'], ['min', 'min'], ['seg', 'seg']];
export const MATERIAL = [['trineo', 'Con trineo'], ['paracaidas', 'Con paracaídas'], ['vallas', 'Con vallas'], ['cuesta', 'En cuesta'], ['otro', 'Otro']];
export const CON_MATERIAL = { trineo: 'con trineo', paracaidas: 'con paracaídas', vallas: 'con vallas', cuesta: 'en cuesta', otro: 'otro material' };

const norm = (s) => String(s ?? '').trim().toLowerCase();
const DE_FUERZA = ['kg', 'pct', 'rpe', 'rir', 'int'];
const DISTANCIA_O_TIEMPO = ['m', 'km', 'yd', 'min', 'seg'];

/** Las Disciplinas de un ejercicio: las que marcó el coach en la ficha, o las que se marcan solas por uso. */
export const disciplinasDe = (ficha, porUso = []) => (Array.isArray(ficha?.disciplinas) ? disciplinasVigentes(ficha.disciplinas) : porUso);

/** 'fuerza' | 'correr' | 'remo' | 'ski' | 'bici' | 'cardio' | 'duda'. Ver la cabecera del archivo. */
export function tipoDe(ficha, disciplinas = []) {
  if (!ficha) return 'duda';
  const eq = norm(ficha.equipment), c = ficha.carga_tipo, u = ficha.medida;
  if (eq === 'remo') return 'remo';
  if (eq === 'bici') return 'bici';
  if (eq === 'esquí' || eq === 'esqui') return 'ski';
  if (c === 'ritmo') return 'correr';
  // Marcado de Running y medido en distancia o tiempo: es carrera aunque arrastre un trineo (ahí los kilos son la carga extra).
  if (disciplinas.includes('correr') && (!u || DISTANCIA_O_TIEMPO.includes(u))) return 'correr';
  if (c === 'nado' || c === 'zona' || c === 'w') return 'cardio';
  if (DE_FUERZA.includes(c) || equipoPesa(ficha.equipment) === true || disciplinas.includes('pesas')) return 'fuerza';
  return 'duda';
}

/* ¿NACE COMO SPRINT? No (Andrés, 20 nov 2026). Todo lo de carrera nace en «Constante» y el coach toca «Sprints»: un toque, y nada que adivinar. */

/** Lo que ese tipo de ejercicio puede llevar: `peso` (en su casilla, si es fuerza, o en «Carga extra», si es carrera) e `int`. */
export function permitidas(tipo, ficha, enSprints = false) {
  const veloz = ['tope', 'tiempo', 'rpe'];
  if (tipo === 'correr') return { peso: ['kg', 'lb'], int: enSprints ? veloz : ['pace', 'zona', 'pulso', 'rpe'] };
  if (tipo === 'remo' || tipo === 'ski') return { peso: [], int: enSprints ? veloz : ['w', 'r500', 'zona', 'pulso', 'rpe'] };
  if (tipo === 'bici') return { peso: [], int: enSprints ? veloz : ['w', 'zona', 'pulso', 'rpe'] };
  if (tipo === 'cardio') return { peso: [], int: enSprints ? veloz : ['zona', 'pulso', 'rpe'] };
  if (tipo === 'fuerza') {
    const eq = norm(ficha?.equipment);
    return { peso: ['barra', 'mancuerna', 'máquina', 'maquina', 'polea'].includes(eq) ? PESOS : ['kg', 'lb'], int: eq === 'trineo' ? ['rpe'] : ['rpe', 'rir'] };
  }
  return { peso: PESOS, int: enSprints ? veloz : ['rpe', 'rir', 'pace', 'zona', 'pulso', 'w', 'r500', 'tope'] };
}

/** ¿El renglón se abre con lo de cardio (Cómo se corre…) o con lo de fuerza? En la duda, manda la intensidad que el coach le puso. */
export const esCardio = (tipo, it) => ['correr', 'remo', 'ski', 'bici', 'cardio'].includes(tipo) || (tipo === 'duda' && !!it.int && DE_CARDIO.includes(it.int.tipo));
/** Peso e intensidad son la misma cosa: comparten casilla. */
export const comparteCasilla = (tipo, it) => tipo === 'fuerza' || (tipo === 'duda' && !(it.int && DE_CARDIO.includes(it.int.tipo)));
/** Lleva «Carga extra» aparte. */
export const llevaCargaExtra = (tipo, it) => tipo === 'correr' || (tipo === 'duda' && !!it.int && DE_CARDIO.includes(it.int.tipo));
/** La máquina o el lugar: 'correr' (Caminadora), 'maquina' (Resistencia) o null. */
export const lugarDe = (tipo) => (tipo === 'correr' ? 'correr' : ['remo', 'ski', 'bici'].includes(tipo) ? 'maquina' : null);
export const cadenciaDe = (tipo) => ({ correr: 'pasos/min', bici: 'rpm', remo: 'paladas/min', ski: 'paladas/min' }[tipo] ?? 'por min');
export const titulosDe = (tipo) => ({ correr: ['Cómo se corre', 'Para toda la carrera'], remo: ['Cómo se rema', 'Para todo el remo'], bici: ['Cómo se rueda', 'Para toda la rodada'] }[tipo] ?? ['Cómo se hace', 'Para todo el ejercicio']);

let n0 = 0;
export const nuevoId = () => `h${Date.now().toString(36)}${(n0++).toString(36)}${Math.random().toString(36).slice(2, 5)}`;
export const filaSprint = () => ({ id: nuevoId(), q: '', u: 'm', dq: '', du: 'min' });
export const setNuevo = () => ({ id: nuevoId(), fmt: 'rep', veces: 3, min: '10', descV: null, descS: null, items: [] });

const UNIDAD_DE_FICHA = { reps: 'reps', seg: 'seg', min: 'min', m: 'm', km: 'km', yd: 'm', cal: 'cal' };

/** Un renglón recién nacido, con lo que dice su ficha. La intensidad de un cardio nace vacía (Andrés: «que salga con el +»). */
export function renglonNuevo(ficha, disciplinas = []) {
  const tipo = tipoDe(ficha, disciplinas), c = ficha?.carga_tipo;
  const it = {
    id: nuevoId(), exercise_id: ficha?.id ?? null, name: ficha?.name ?? '', q: '', u: UNIDAD_DE_FICHA[ficha?.medida] ?? null, peso: null, int: null, desc: null,
    pv: false, vueltas: [], lado: false, limite: null, nota: null, como: 'uno', maq: null, cad: null, mat: null, spr: [filaSprint()], pg: null, iv: null,
  };
  if (tipo === 'correr') {
    if (c === 'kg') it.peso = { q: '', u: 'kg' };   // un sprint con trineo ya trae su carga extra
    it.u = it.u ?? 'km';
  } else if (tipo === 'remo' || tipo === 'ski') it.u = it.u ?? 'm';
  else if (tipo === 'bici') it.u = it.u ?? 'min';
  else if (tipo === 'fuerza') {
    if (c === 'rpe' || c === 'rir') it.int = { tipo: c, a: '', b: '' };
    else if (c === 'pct' && permitidas(tipo, ficha).peso.includes('% 1RM')) it.peso = { q: '', u: '% 1RM' };
    else if (c === 'kg' || c === 'pct' || equipoPesa(ficha?.equipment) === true) it.peso = { q: '', u: 'kg' };
  }
  it.u = it.u ?? 'reps';
  return it;
}

/** LO QUE LA APP APRENDE del uso: si la ficha no decía cómo se usa el ejercicio, se anota lo que el coach acaba de elegir. Devuelve el
    parche para la ficha (o null si no hay nada nuevo que anotar). Nunca pisa lo que la ficha ya decía. */
export function loQueAprende(ficha, disciplinas, it) {
  if (!ficha) return null;
  const parche = {};
  const sinCarga = ficha.carga_tipo == null || ficha.carga_tipo === 'nada';
  if (sinCarga) {
    const t = it.int?.tipo;
    const c = t === 'pace' ? 'ritmo' : t === 'zona' || t === 'pulso' ? 'zona' : t === 'w' || t === 'r500' ? 'w' : t === 'rpe' || t === 'rir' ? t
      : it.peso && !t ? (it.peso.u === '% 1RM' ? 'pct' : 'kg') : null;
    if (c) parche.carga_tipo = c;
    // Un sprint es carrera: la ficha queda marcada de Running, a la vista en sus Disciplinas.
    if ((t === 'tope' || t === 'tiempo' || it.como === 'sprint') && !disciplinas.includes('correr')) parche.disciplinas = [...disciplinas, 'correr'];
  }
  if (ficha.medida == null && it.u) parche.medida = it.u;
  return Object.keys(parche).length ? parche : null;
}

/* ---------------- Progresiva: tramos parejos que van de «Empieza en» a «Termina en» ---------------- */
const aSeg = (v) => { v = String(v || '').trim(); if (!v) return null; if (v.includes(':')) { const [m, x] = v.split(':'); return (+m || 0) * 60 + (+x || 0); } const d = v.replace(/\D/g, ''); if (d.length >= 3) return (+d.slice(0, -2)) * 60 + (+d.slice(-2)); return +d || null; };
const deSeg = (x) => `${Math.floor(x / 60)}:${String(Math.round(x % 60)).padStart(2, '0')}`;
const esRitmo = (t) => t === 'pace' || t === 'r500';
const num = (t, v) => (esRitmo(t) ? aSeg(v) : (v === '' || v == null ? null : +v));
const fmt = (t, x) => (esRitmo(t) ? deSeg(x) : String(Math.round(x)));
export const enBase = (q, u) => { q = +String(q).replace(',', '.'); if (!q) return null; return u === 'km' ? { g: 'd', v: q * 1000 } : u === 'm' ? { g: 'd', v: q } : u === 'min' ? { g: 't', v: q * 60 } : u === 'seg' ? { g: 't', v: q } : null; };
export const deBase = (v, u) => (u === 'km' ? +(v / 1000).toFixed(2) : u === 'min' ? +(v / 60).toFixed(1) : Math.round(v));

function reparte(it, n) {
  const q = +String(it.q).replace(',', '.');
  if (!q) return Array.from({ length: n }, () => ({ q: '', u: it.u === 'km' ? 'm' : it.u }));
  const l = q / n;
  if (it.u === 'km') return Array.from({ length: n }, () => (l < 1 ? { q: String(Math.round(l * 1000)), u: 'm' } : { q: String(+l.toFixed(2)), u: 'km' }));
  if (it.u === 'min') return Array.from({ length: n }, () => ({ q: String(+l.toFixed(1)), u: 'min' }));
  return Array.from({ length: n }, () => ({ q: String(Math.round(l)), u: it.u }));
}
export function ponValores(it) {
  const g = it.pg, t = it.int?.tipo, n = g.lista.length;
  if (!t) return;
  g.lista.forEach((x, i) => { for (const lado of ['a', 'b']) { const a = num(t, g.ini[lado]), b = num(t, g.fin[lado]); x[lado] = a == null || b == null ? '' : fmt(t, n === 1 ? a : a + (b - a) * i / (n - 1)); } });
}
/** Mientras el coach no escriba a mano en un tramo, las distancias se reparten parejo y las intensidades van de un extremo al otro. */
export function acomoda(it) {
  const g = it.pg;
  if (!g) return;
  if (!g.mq) { const q = reparte(it, g.lista.length); g.lista.forEach((x, i) => { x.q = q[i].q; x.u = q[i].u; }); }
  if (!g.mi) ponValores(it);
}
export function progresivaDe(it) {
  if (!it.pg) { it.pg = { ini: { a: '', b: '' }, fin: { a: '', b: '' }, tramos: false, mq: false, mi: false, lista: Array.from({ length: 4 }, () => ({ id: nuevoId(), q: '', u: 'm', a: '', b: '' })) }; acomoda(it); }
  return it.pg;
}
export function intervalosDe(it) {
  if (!it.iv) it.iv = { lista: [{ id: nuevoId(), q: '', u: 'm', a: '', b: '' }, { id: nuevoId(), q: '', u: 'm', a: '', b: '' }], repite: true };
  return it.iv;
}
export const resumenDeSprints = (it) => {
  const f = it.spr.filter((x) => x.q), n = it.spr.length;
  if (!f.length) return `${n} ${n === 1 ? 'sprint' : 'sprints'}`;
  return f.length === n && f.every((x) => x.q === f[0].q && x.u === f[0].u) ? `${n} × ${f[0].q} ${f[0].u}` : `${n} sprints`;
};
