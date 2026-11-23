/**
 * QUIÉN MANDA EN UNA LÍNEA DEL EDITOR: la ficha del ejercicio, luego la DISCIPLINA de la sesión, y al final el coach (que siempre puede
 * cambiar la línea).
 *
 * LA DISCIPLINA NO ES LA ETIQUETA (Andrés, 8–9 nov 2026). Las Etiquetas (antes «tipos de sesión»: Gym, Correr, Híbrido…) son del coach: las
 * crea y las borra cuando quiere, y el editor no les pide nada. La Disciplina es fija de la app (Gym, Híbrido, Running…; los nombres en inglés los pidió Andrés el 19 nov 2026, por dentro siguen siendo pesas, correr, bici y nadar), vive en cada sesión
 * (`day.disciplina`) y arranca en Libre. Por dentro el código les dice «familias»; en pantalla solo dice «Disciplina». Todo en un solo lugar para que el formulario del ejercicio, el editor y el conector usen las mismas reglas.
 *
 * Decidido con Andrés (inventario del editor, 6–8 nov 2026):
 *   · La ficha trae dos datos nuevos: «Unidad» (`medida`) y «Peso o intensidad» (`carga_tipo`). Vacíos = se eligen en cada plan.
 *   · El EQUIPO decide si el atleta anota kilos (barra, mancuerna, kettlebell… sí; peso corporal, liga, bici… no). Se quitó el botón
 *     «Con peso / Sin peso» de la línea: una dominada con lastre es otro ejercicio del repertorio.
 *   · Lo raro no se prohíbe: se guarda detrás de «Más opciones», en el mismo menú.
 *   · Topes: RPE 1 a 10, RIR 0 a 5, Zona 1 a 5, % del 1RM hasta 120.
 */
import { esDistancia, esTiempo, esConteo } from './medidas.js';

/* ---------------- El equipo ---------------- */
export const EQUIPOS = [
  'Peso corporal', 'Barra', 'Mancuerna', 'Kettlebell', 'Máquina', 'Liga', 'Polea',
  'Balón medicinal', 'Trineo', 'Chaleco o lastre', 'Bici', 'Remo',
];
// Los que pesan: con ellos el atleta anota los kilos que usó.
const QUE_PESAN = ['barra', 'mancuerna', 'kettlebell', 'máquina', 'maquina', 'polea', 'balón medicinal', 'balon medicinal', 'trineo', 'chaleco o lastre', 'disco', 'pesa rusa', 'chaleco', 'lastre'];
const norm = (s) => String(s ?? '').trim().toLowerCase();
/** `true` si el equipo pesa, `false` si es uno de la lista que no pesa, `null` si no hay equipo o es «Otro» (no se sabe). */
export function equipoPesa(equipo) {
  const e = norm(equipo);
  if (!e) return null;
  if (QUE_PESAN.includes(e)) return true;
  if (EQUIPOS.some((x) => norm(x) === e)) return false;
  return null;
}

/* ---------------- Las dos filas nuevas de la ficha ---------------- */
export const MEDIDAS_DE_FICHA = [
  { valor: 'reps', etiqueta: 'Repeticiones' }, { valor: 'seg', etiqueta: 'Segundos' }, { valor: 'min', etiqueta: 'Minutos' },
  { valor: 'm', etiqueta: 'Metros' }, { valor: 'km', etiqueta: 'Kilómetros' }, { valor: 'yd', etiqueta: 'Yardas' },
  { valor: 'cal', etiqueta: 'Calorías' }, { valor: 'cluster', etiqueta: 'Cluster' }, { valor: 'nada', etiqueta: 'Nada, solo hacerlo' },
];
export const CARGAS_DE_FICHA = {
  kg: 'Kilos', pct: '% del 1RM', int: 'Intensidad', rpe: 'RPE', rir: 'RIR', ritmo: 'Ritmo', zona: 'Zona de FC', w: 'Vatios', nado: 'Ritmo de nado', nada: 'Nada',
};
// Lo que dice una fila vacía de la ficha (como «Equipo» o «Músculo» en el formulario de siempre), y la opción para dejarla así.
export const VACIA = 'Selecciona…';
export const DEJAR_VACIA = 'Dejar vacía';
export const AYUDA_VACIA = 'Lo que dejes vacío se elige en cada plan.';
const PESO = (c) => c === 'kg' || c === 'pct';
const TODAS = ['kg', 'pct', 'int', 'rpe', 'rir', 'ritmo', 'zona', 'w', 'nado'];

/** ¿El atleta anota kilos? `true`/`false` cuando la ficha lo dice (por su equipo o por su carga); `null` si no dice nada. */
export function llevaPesoDeFicha(ficha) {
  if (!ficha) return null;
  const porEquipo = equipoPesa(ficha.equipment);
  if (porEquipo === true || PESO(ficha.carga_tipo)) return true;
  return porEquipo;
}

/* ---------------- La DISCIPLINA de la sesión (por dentro, «familias») ----------------
   Decidido el 9 nov 2026 (Andrés: «cada una debe traer su propia configuración… cosas significativas que cambian el editor»; si dos se
   comportan igual, sobra una). Nueve: cada una cambia el Set nuevo, la línea nueva, el orden y lo que se guarda en «Más opciones», las
   casillas a la vista, el orden de los formatos y el descanso del primer toque. «Fisioterapia» se juntó con Movilidad y «Deporte» con Clase:
   hacían lo mismo. Fisioterapia vuelve sola cuando exista el dolor del 0 al 10.
     u, c        con qué arranca una línea si la ficha no dice (u: null = la que traiga la ficha, o reps)
     orden       qué cargas van primero
     mas         qué cargas se guardan en «Más opciones» (no se prohíben)
     todo        no guarda nada (Híbrido)          soloCardio  solo cargas de cardio (Triatlón)
     agua        deja ver el ritmo de nado
     set         con qué formato nace un Set: normal, portiempo, cardio (Intervalos de cardio) o sin (Sin series); veces = cuántas
     formatos    el orden de la lista «Se repite ▾» (lo que falte va después, en el orden de siempre)
     campos      Por lado, Por vuelta y Límite de tiempo: 'ver' (a la vista) o 'mas' (detrás de «+ Más» en la línea)
     descanso    lo que pone el primer toque de «+ Descanso entre vueltas» */
const CARDIO_C = ['ritmo', 'zona', 'w', 'nado', 'rpe'];
export const FAMILIAS = {
  libre: { nombre: 'Libre', detalle: 'Todo a la vista, nada sugerido', u: null, c: null, orden: [], agua: true,
    set: 'normal', veces: 3, formatos: [], campos: {}, descanso: '1 min' },
  pesas: { nombre: 'Gym', detalle: 'Reps y kilos; Sets de 3 vueltas', u: 'reps', c: 'kg', orden: ['kg', 'pct', 'rpe', 'rir'], mas: ['ritmo', 'zona', 'w', 'nado'],
    set: 'normal', veces: 3, formatos: ['normal', 'sin', 'emom', 'amrap', 'tabata', 'portiempo', 'intervalos', 'fartlek', 'cardio', 'lapsos'],
    campos: { limite: 'mas' }, descanso: '2 min' },
  hyrox: { nombre: 'Híbrido', detalle: 'Hyrox, CrossFit y entrenamiento mixto: fuerza y cardio en cadena', u: 'reps', c: 'kg', orden: ['kg', 'ritmo', 'rpe'], todo: true, agua: false,
    set: 'portiempo', veces: 1, formatos: ['portiempo', 'amrap', 'emom', 'normal', 'cardio', 'sin'], campos: {}, descanso: '1 min' },
  correr: { nombre: 'Running', detalle: 'Carrera continua, intervalos, sprints y técnica de carrera', u: 'km', c: 'ritmo', orden: ['ritmo', 'zona', 'rpe'], mas: ['kg', 'pct', 'rir', 'w', 'nado'],
    set: 'cardio', veces: 1, formatos: ['cardio', 'fartlek', 'intervalos', 'sin', 'normal'], campos: { lado: 'mas', vuelta: 'mas' }, descanso: '90 seg' },
  /* Speed (velocidad) se quitó el 19 nov 2026 (Andrés: «quita speed»). Usaba el mismo editor que Running y solo cambiaba el orden de las
     opciones; sprints, técnica y arrastres ya viven en Running. Lo que decía «velocidad» se lee como Running (ver `ANTES`). */
  bici: { nombre: 'Cycling', detalle: 'Sets en intervalos de cardio, minutos y vatios', u: 'min', c: 'w', orden: ['w', 'zona', 'rpe'], mas: ['kg', 'pct', 'rir', 'ritmo', 'nado'],
    set: 'cardio', veces: 1, formatos: ['cardio', 'intervalos', 'tabata', 'sin'], campos: { lado: 'mas', vuelta: 'mas', limite: 'mas' }, descanso: '1 min' },
  nadar: { nombre: 'Swimming', detalle: 'Sets en intervalos de cardio, metros y ritmo de nado', u: 'm', c: 'nado', orden: ['nado', 'zona', 'rpe'], mas: ['kg', 'pct', 'rir', 'w', 'ritmo'], agua: true,
    set: 'cardio', veces: 1, formatos: ['cardio', 'sin', 'normal', 'intervalos'], campos: { lado: 'mas' }, descanso: '20 seg' },
  triatlon: { nombre: 'Triatlón', detalle: 'Correr, bici y nadar; cada ejercicio trae lo suyo', u: null, c: null, orden: ['ritmo', 'w', 'nado', 'zona'], mas: ['kg', 'pct', 'rir'], soloCardio: true, agua: true,
    set: 'sin', veces: null, formatos: ['sin', 'cardio', 'normal'], campos: { lado: 'mas', vuelta: 'mas' }, descanso: '1 min' },
  movilidad: { nombre: 'Movilidad y rehab', detalle: 'Por lado y sin series; segundos y RPE', u: 'seg', c: 'rpe', orden: ['rpe', 'kg', 'rir'], mas: ['pct', 'ritmo', 'zona', 'w', 'nado'],
    set: 'sin', veces: null, formatos: ['sin', 'normal', 'emom'], campos: { vuelta: 'mas', limite: 'mas' }, descanso: '30 seg' },
  // Clase y Deporte van separadas (Andrés, 19 nov 2026: «son diferentes y deben ir separados»). Por ahora el editor las arma igual; lo que
  // cambie entre una y otra está por decidir.
  clase: { nombre: 'Clase', detalle: 'Pilates, yoga, spinning; la clase en video primero', u: 'min', c: 'rpe', orden: ['rpe', 'zona'], mas: ['kg', 'pct', 'rir', 'ritmo', 'w', 'nado'],
    set: 'sin', veces: null, formatos: ['sin', 'portiempo', 'intervalos', 'normal'], campos: { lado: 'mas', limite: 'mas' }, descanso: '1 min' },
  deporte: { nombre: 'Deporte', detalle: 'Drills de cancha y juego; minutos y esfuerzo', u: 'min', c: 'rpe', orden: ['rpe', 'zona'], mas: ['kg', 'pct', 'rir', 'ritmo', 'w', 'nado'],
    set: 'sin', veces: null, formatos: ['sin', 'portiempo', 'intervalos', 'normal'], campos: { lado: 'mas', limite: 'mas' }, descanso: '1 min' },
};
export const ORDEN_DE_FAMILIAS = ['libre', 'pesas', 'hyrox', 'correr', 'bici', 'nadar', 'triatlon', 'movilidad', 'clase', 'deporte'];
// Las que se juntaron (9 nov 2026): una sesión que ya decía «fisio» sigue funcionando. «deporte» volvió a ser suya el 19 nov.
// Speed se juntó con Running el 19 nov 2026.
const ANTES = { fisio: 'movilidad', velocidad: 'correr' };
/** La Disciplina de una sesión. Sin elegir (o una que ya no existe), «Libre»: todo el editor, sin valores de arranque. */
export function familiaDelDia(day) {
  const id = ANTES[day?.disciplina] ?? day?.disciplina;
  return FAMILIAS[id] ? id : 'libre';
}
/** Las Disciplinas guardadas en una ficha, con las que se juntaron ya cambiadas y sin repetir (una ficha con «velocidad» y «correr» queda en Running). */
export function disciplinasVigentes(lista) {
  if (!Array.isArray(lista)) return lista;
  return [...new Set(lista.map((d) => ANTES[d] ?? d).filter((d) => FAMILIAS[d]))];
}

/* ---------------- La cadena (9 nov 2026) ----------------
   Toda decisión recorre 4 preguntas, en este orden, y cada cosa NACE UNA VEZ (después solo cambia si el coach la toca):
     1. FICHA       lo que dice es la base. Vacía no dice nada y cabe en todo.
     2. BLOQUEOS    la unidad y el formato del Set quitan lo imposible y ponen topes. Lo raro pero posible va a «Más opciones».
     3. DISCIPLINA  llena lo vacío y ordena. Guarda a un toque, nunca quita.
     4. COACH       lo que elige se guarda en la línea y nada lo cambia después.
   Nada escrito se borra ni se reetiqueta solo: si algo no cabe en un Set de intervalos de cardio, el Set se afloja a «Lapsos personalizados». */

// Lo que cada unidad admite (pregunta 2). Lo que no está aquí no va con esa unidad: ni la ficha lo pone primero.
const ADMITE = {
  distancia: ['ritmo', 'zona', 'w', 'nado', 'rpe', 'kg'],
  conteo: ['kg', 'pct', 'rpe', 'rir', 'int'],
  tiempo: ['rpe', 'rir', 'int', 'zona', 'w', 'ritmo', 'kg', 'nado'],
  energia: ['w', 'zona', 'rpe', 'rir', 'int'],
};
const grupoDe = (unidad) => (unidad === 'nada' ? null : esDistancia(unidad) ? 'distancia' : esConteo(unidad) ? 'conteo' : esTiempo(unidad) ? 'tiempo' : 'energia');
/** ¿Esa carga va con esa unidad? «5 km» con «80 %» no; se queda si ya estaba escrita, pero se señala. */
export const admite = (unidad, carga) => { const g = grupoDe(unidad); return !!g && ADMITE[g].includes(carga); };

/** ¿El ejercicio cabe en un Set de «Intervalos de cardio» (solo distancia o tiempo)? Cabe si su ficha lo dice o si no dice nada.
    No cabe solo si dice reps, calorías, cluster o nada: ahí no se adivina, se lee la ficha. */
export function cabeEnIntervalos(ficha) {
  const u = ficha?.medida;
  return !u || esDistancia(u) || esTiempo(u);
}
/** Lo que una Disciplina dice de una casilla de la línea: 'ver' o 'mas'. */
export const campoDe = (familia, campo) => (FAMILIAS[familia]?.campos?.[campo]) ?? 'ver';

/* ---------------- Qué cargas se ofrecen y en qué orden ---------------- */
/**
 * `{ vis, mas }`: las que van a la vista (en orden) y las que se guardan en «Más opciones».
 * Reglas 1–8 del inventario: la medida decide el grupo; sin peso no se ofrecen kilos; el ritmo de nado solo donde hay agua; la familia ordena.
 */
export function cargasParaLinea({ unidad, ficha = null, familia = 'libre', llevaPeso = null }) {
  const F = FAMILIAS[familia] ?? FAMILIAS.libre;
  const fc = ficha?.carga_tipo && ficha.carga_tipo !== 'nada' ? ficha.carga_tipo : null;
  const peso = llevaPeso !== false; // sin dato, se ofrece (como hoy)
  let vis;
  if (unidad === 'nada') vis = [];
  else if (esDistancia(unidad)) vis = ['ritmo', 'zona', 'w', 'nado', 'rpe', ...(peso ? ['kg'] : [])];
  else if (esConteo(unidad)) vis = ['kg', 'pct', 'rpe', 'rir', 'int'];
  else if (esTiempo(unidad)) vis = ['kg', 'rpe', 'rir', 'int', 'zona', 'w', 'ritmo', 'nado'];
  else vis = ['w', 'zona', 'rpe', 'rir', 'int'];
  if (!peso) vis = vis.filter((c) => !PESO(c));
  if (!(F.agua || fc === 'nado')) vis = vis.filter((c) => c !== 'nado');
  // Lo que la Disciplina guarda en «Más opciones» (no se prohíbe: sigue en la lista, abajo).
  if (F.mas) vis = vis.filter((c) => !F.mas.includes(c));
  if (F.soloCardio) vis = vis.filter((c) => CARDIO_C.includes(c));
  // Lo de la ficha siempre queda a la vista: si su equipo pesa, Kilos no se guarda aunque la Disciplina lo guarde (un squat en Correr).
  if (llevaPeso === true && admite(unidad, 'kg') && !vis.includes('kg')) vis.push('kg');
  // Lo propio de la Disciplina que la medida no trae: en Correr, unos segundos también ofrecen Ritmo (está en `orden`).
  if (familia !== 'libre' && unidad !== 'nada' && !esConteo(unidad)) F.orden.forEach((c) => { if (CARDIO_C.includes(c) && !vis.includes(c) && !(F.mas ?? []).includes(c)) vis.push(c); });
  if (F.todo && unidad !== 'nada') vis = TODAS.filter((c) => (peso || !PESO(c)) && (c !== 'nado' || F.agua || fc === 'nado'));
  // La ficha le gana a la Disciplina, nunca a la unidad: su carga va primero solo si va con lo que mide la línea.
  if (fc && !vis.includes(fc) && admite(unidad, fc)) vis.unshift(fc);
  /* EL ORDEN: primero lo de la ficha; luego lo que la familia prefiere, pero solo si es propio de la medida (en Pesas, unos metros sin ficha
     arrancan en Ritmo, no en Kilos; unos segundos sí siguen a la familia, porque el tiempo es la medida más ambigua); luego lo de la medida. */
  const base = unidad === 'nada' ? [] : esDistancia(unidad) ? ['ritmo', 'zona', 'w', 'nado', 'rpe', 'kg']
    : esConteo(unidad) ? ['kg', 'pct', 'rpe', 'rir', 'int'] : esTiempo(unidad) ? ['rpe', 'rir', 'int', 'zona', 'w', 'ritmo', 'kg', 'nado'] : ['w', 'zona', 'rpe', 'rir', 'int'];
  // En Libre la medida manda (unos metros: Ritmo primero); con Disciplina, su orden manda completo (en Pesas, un farmer: Kilos primero).
  const propias = familia !== 'libre' ? TODAS : esDistancia(unidad) ? ['ritmo', 'zona', 'w', 'nado'] : esTiempo(unidad) ? TODAS : base;
  const orden = [...new Set([...(fc && admite(unidad, fc) ? [fc] : []), ...F.orden.filter((c) => propias.includes(c)), ...base, ...TODAS])];
  const v = orden.filter((c) => vis.includes(c));
  return { vis: v, mas: TODAS.filter((c) => !v.includes(c)) };
}

/** Las cargas de la ficha, ordenadas por lo que ya se eligió en «Cuánto hace» y por el equipo. */
export function cargasParaFicha({ medida, equipo }) {
  if (!medida) return { vis: TODAS, mas: [] };
  const pesa = equipoPesa(equipo);
  const r = cargasParaLinea({ unidad: medida, familia: 'libre', llevaPeso: pesa === null ? true : pesa });
  if (pesa && medida !== 'nada' && !r.vis.includes('kg')) return { vis: ['kg', ...r.vis], mas: r.mas.filter((c) => c !== 'kg') };
  return r;
}

/** Con qué arranca una línea nueva: la ficha manda; si no dice, la familia; si tampoco, lo de siempre (reps, sin carga). */
export function arranqueDeLinea(ficha, familia, unidadActual = null) {
  const F = FAMILIAS[familia] ?? FAMILIAS.libre;
  // `unidadActual`: la que ya tiene la línea (el coach pudo cambiarla); si no, la de la ficha, la de la familia o reps.
  const unidad = unidadActual || ficha?.medida || F.u || 'reps';
  const llevaPeso = llevaPesoDeFicha(ficha);
  // La carga de la ficha, si va con la unidad; si no, la de la Disciplina; si no, la primera de la unidad.
  let tipo = ficha?.carga_tipo && (ficha.carga_tipo === 'nada' || admite(unidad, ficha.carga_tipo)) ? ficha.carga_tipo : null;
  if (!tipo && unidad !== 'nada') {
    const { vis } = cargasParaLinea({ unidad, ficha, familia, llevaPeso });
    // La de la familia si va con la medida; si no, la primera de la lista. En «Libre» no hay valores de arranque: la casilla queda libre,
    // salvo una distancia, que arranca en Ritmo como siempre lo hicieron los lapsos.
    // Con distancia, la de la familia solo si es de cardio: unos metros en Pesas arrancan en Ritmo, no en Kilos.
    if (F.c && vis.includes(F.c)) tipo = F.c;
    else if (familia !== 'libre' || esDistancia(unidad)) tipo = vis[0] ?? null;
  }
  if (unidad === 'nada') tipo = 'nada';
  return { unidad, tipo, llevaPeso };
}

/* ---------------- Topes ---------------- */
export const TOPES = { rpe: [1, 10, 'El RPE'], rir: [0, 5, 'El RIR'], zona: [1, 5, 'La zona'], pct: [1, 120, 'El % del 1RM'] };
/**
 * Pone el número dentro de su tope. Respeta los rangos («7-9»): cada número se topa por separado.
 * Devuelve `{ texto, aviso }`; `aviso` es `null` si no hubo que cambiar nada.
 */
export function topaCarga(tipo, texto) {
  const t = TOPES[tipo];
  const crudo = String(texto ?? '');
  if (!t || !crudo.trim()) return { texto: crudo, aviso: null };
  const [min, max, nombre] = t;
  let cambio = null;
  const out = crudo.replace(/\d+(?:[.,]\d+)?/g, (n) => {
    const v = parseFloat(n.replace(',', '.'));
    if (v > max) { cambio = `${nombre} va de ${min} a ${max}. Lo dejé en ${max}.`; return String(max); }
    if (v < min) { cambio = `${nombre} va de ${min} a ${max}. Lo dejé en ${min}.`; return String(min); }
    return n;
  });
  return { texto: out, aviso: cambio };
}
