import { formatoDeMiembros, ponFormato } from './formatos.js';
import { normalizaVueltas } from './porVuelta.js';
import { conLapsosSegun, hayLapsos } from './lapsos.js';

/**
 * Los Sets de una sesión: la lista de ejercicios de una sesión, agrupada como la ve el editor (y el atleta).
 *
 * Una sesión guarda sus ejercicios en una lista plana. Los que comparten `set` (un número) son UN Set con varios
 * ejercicios (bi-serie, tri-serie…); el que no lo trae es un Set de un solo ejercicio. Las notas sueltas no son Sets.
 * La misma lista sirve a una sesión suelta (`day.exercises`) y a cada sesión de un día doble (`day.blocks[i].exercises`):
 * lo que cambia es dónde vive, no cómo se edita.
 *
 * LOS LAPSOS (Andrés, 8 oct 2026): un Set puede estar en «Lapsos personalizados» (`b.lapsos`): cada ejercicio trae varios
 * lapsos seguidos (cuánto · carga · descanso). Como el formato y las series, es del Set y vive repetido en cada ejercicio
 * (`ex.lapsos`); ver `lib/lapsos.js`.
 *
 * LAS SERIES de un Set (`rounds`) son lo que traen sus ejercicios en `sets`, y pueden ser tres cosas:
 *   · un número («5»): «Se repite 5 veces»;
 *   · texto libre, casi siempre un rango («4-6», «8-10»): el coach lo escribió así y así se queda;
 *   · nada (`null`): un calentamiento, unos drills, un «15 min» que no se repite. Ningún ejercicio trae `sets`.
 * Andrés, 6 oct 2026: su plan trae las tres, y el editor de las sesiones dobles tenía una casilla «Series» aparte, escrita
 * como texto libre para no inventarles un «3». Ahora todas pasan por el mismo editor de Sets sin tocar lo que no se toca.
 */

/** Los Sets de la lista de ejercicios: misma semántica que `groupIntoSets` del atleta. */
export const parseBlocks = (exercises = []) => {
  const blocks = [];
  let cur = null;
  exercises.forEach((ex) => {
    if (ex.isNote) { blocks.push({ type: 'note', ex }); cur = null; return; }
    const key = ex.set != null ? `s-${ex.set}` : null;
    if (key && cur && cur.key === key) { cur.members.push(ex); return; }
    cur = { type: 'set', key, members: [ex] };
    blocks.push(cur);
  });
  blocks.forEach((b) => {
    if (b.type !== 'set') return;
    // Sin `sets` en el primer ejercicio: sin series (`null`), no un «3» inventado.
    b.rounds = b.members[0]?.sets ?? null;
    // El formato (AMRAP, EMOM…) es del Set entero y vive repetido en cada ejercicio, como `sets`.
    b.formato = formatoDeMiembros(b.members);
    // «Lapsos personalizados»: sus ejercicios traen `lapsos` (y nunca va junto a un formato de reloj).
    b.lapsos = !b.formato && hayLapsos(b.members);
    // El descanso que sigue al Set (la raya entre dos Sets): vive en su ÚLTIMO ejercicio (`descansoSet`), como texto («2 min»).
    b.descansoDespues = String(b.members[b.members.length - 1]?.descansoSet ?? '').trim();
  });
  return blocks;
};

/**
 * El ejercicio con las series de su Set. Sin series (`null`) ninguno trae `sets`; con ellas, todos traen lo mismo.
 * Un `sets` que ya dice lo mismo se deja tal cual (ni siquiera cambia de tipo). `undefined` = el Set no dijo nada:
 * se queda lo que el ejercicio ya traía, o «3» si no traía nada (un Set nuevo).
 */
const conSeries = (m, rounds) => {
  const r = rounds === undefined ? (m.sets ?? '3') : rounds;
  if (r === null) {
    if (!('sets' in m)) return m;
    const { sets: _sin, ...resto } = m;
    return resto;
  }
  return m.sets !== undefined && String(m.sets) === String(r) ? m : { ...m, sets: String(r) };
};

/**
 * La lista de ejercicios que se guarda a partir de los Sets que se ven. Lo que no se tocó, queda idéntico: hasta el número de
 * grupo (`set`) de una bi-serie o un circuito se respeta mientras no se repita; solo los Sets nuevos o repetidos reciben uno.
 */
export const serializeBlocks = (blocks) => {
  const out = [];
  const usados = new Set();
  const propios = blocks.map((b) => {
    if (b.type !== 'set' || b.members.length < 2) return null;
    const num = Number((/^s-(\d+)$/.exec(b.key ?? '') || [])[1]);
    if (!Number.isInteger(num) || num < 1 || usados.has(num)) return null;
    usados.add(num);
    return num;
  });
  let ultimo = 0;
  const nuevoNumero = () => {
    do { ultimo += 1; } while (usados.has(ultimo));
    usados.add(ultimo);
    return ultimo;
  };
  blocks.forEach((b, i) => {
    if (b.type === 'note') { out.push(b.ex); return; }
    // Con formato, las «series» pasan a ser sus vueltas; sin él, se quita de todos los ejercicios.
    // Y las vueltas distintas de cada ejercicio se recortan o completan a las veces que se repite el Set.
    const miembros = ponFormato(
      conLapsosSegun(b.members.map((m) => normalizaVueltas(conSeries(m, b.rounds))), !!b.lapsos && !b.formato, { deCardio: true }),
      b.formato ?? null,
    );
    const grupo = b.members.length > 1 ? (propios[i] ?? nuevoNumero()) : null;
    // El descanso entre Sets va solo en el último ejercicio: si se agregó o quitó uno, se muda con el Set. Un Set que no
    // trae `descansoDespues` (armado fuera del editor) conserva el que ya tenían sus ejercicios.
    const ultimo = miembros[miembros.length - 1];
    const raya = b.descansoDespues === undefined ? String(ultimo?.descansoSet ?? '').trim() : String(b.descansoDespues ?? '').trim();
    miembros.forEach((m0, k) => {
      let m = m0;
      if (k === miembros.length - 1 && raya) { if (m.descansoSet !== raya) m = { ...m, descansoSet: raya }; }
      else if ('descansoSet' in m) { const { descansoSet: _quitado, ...resto } = m; m = resto; }
      const e = { ...m };
      if (grupo !== null) e.set = grupo; else delete e.set;
      out.push(e);
    });
  });
  return out;
};

export const setTag = (count) => (count >= 4 ? 'Circuito' : count === 3 ? 'Tri-serie' : count === 2 ? 'Bi-serie' : null);
