/* CÓMO SE LEEN LOS NÚMEROS DE UN ENTRENO (fase 7 de los stickers, 29 oct 2026; prototipo de caminos https://claude.ai/artifact/EFSp16EiF1rVYb5U7emtNE).

   La regla, en toda pantalla que enseña los datos de un entreno (la página, la celebración, las filas y «Ver todos»):
   1. UN número protagonista, grande, con su unidad chica pegada: «5.00 km», «16 de 16», «1 h 10 min», «1,500 m».
   2. Debajo, una frase que dice qué significa: «Tu tercera carrera de la semana, y la más rápida». Si no hay nada que decir, una neutra con el dato.
   3. Dos o tres secundarios en una fila: carrera Tiempo y Ritmo; bici Tiempo, Velocidad y Subida; plan Tiempo y Volumen; con reloj, Pulso medio (en rojo).
   4. El tiempo sin ceros de más: «48:05», «1:02:13», «0:07».

   Aquí está lo puro (sin pantalla ni red), para probarlo con Node: `scripts/prueba-pagina-del-entreno.mjs`. Sin `@/`. */
import { partesLocales } from './metricas/formato.js';
import { actividadDeEntreno } from './actividades.js';
import { pasosDeLaSesion } from './entreno.js';
import { filasPorSerie } from './metricas/porSerie.js';

const dos = (n) => String(n).padStart(2, '0');
const num = (v) => { const n = typeof v === 'number' ? v : parseFloat(String(v ?? '').replace(',', '.')); return Number.isFinite(n) ? n : null; };
/** «3,880»: los miles con coma, como en el resto de la app. */
export const miles = (n) => Math.round(n).toLocaleString('en-US');
const kilosTexto = (kg) => (Number.isInteger(kg) ? String(kg) : (Math.round(kg * 10) / 10).toFixed(1));

/* ------------------------------------------------------------------ */
/* El tiempo                                                           */
/* ------------------------------------------------------------------ */

/** «48:05», «1:02:13», «0:07»: cuánto duró, sin ceros de más. */
export function tiempoCorto(seg) {
  const s = Math.max(0, Math.round(Number(seg) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}:${dos(m)}:${dos(s % 60)}` : `${m}:${dos(s % 60)}`;
}

/** «5 h 9 min», «42 min», «2 h»: un total (el de un mes en «Ver todos»). */
export function tiempoTotal(seg) {
  const min = Math.round((Number(seg) || 0) / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
}

/** El tiempo como número protagonista: `['1 h 10', 'min']`, `['38', 'min']`, `['2', 'h']`, `['45', 's']`. */
export function tiempoGrande(seg) {
  const s = Math.max(0, Math.round(Number(seg) || 0));
  if (s < 60) return [String(s), 's'];
  const min = Math.round(s / 60);
  if (min < 60) return [String(min), 'min'];
  const h = Math.floor(min / 60);
  return min % 60 ? [`${h} h ${min % 60}`, 'min'] : [String(h), 'h'];
}

/* ------------------------------------------------------------------ */
/* Cuándo fue                                                          */
/* ------------------------------------------------------------------ */

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
const MESES = ['ene.', 'feb.', 'mar.', 'abr.', 'may.', 'jun.', 'jul.', 'ago.', 'sep.', 'oct.', 'nov.', 'dic.'];
const MESES_CORTOS = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const MESES_LARGOS = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

/** El día (número de días desde 1970) de una hora, en la hora local del entreno. */
const diaNumero = (ms, desfase) => Math.floor((ms + (Number(desfase) || 0) * 60000) / 86400000);

/** «9:39 a. m.». */
export function horaDelDia(inicio, desfase = 0) {
  const p = partesLocales(inicio, desfase);
  return p ? `${p.h % 12 || 12}:${dos(p.m)} ${p.h < 12 ? 'a. m.' : 'p. m.'}` : '';
}

/**
 * La línea gris de arriba de la página: «Hoy, 9:39 a. m.», «Ayer, 6:40 p. m.», «Lunes 26, 6:05 p. m.» (de este mes) o «Lunes 28 de sep., 8:00 a. m.».
 * `inicio`: ISO o milisegundos; `desfase`: los minutos de su zona horaria (`desfase_min`). `ahora`: milisegundos.
 */
export function cuandoFue(inicio, desfase = 0, ahora = Date.now()) {
  const ms = typeof inicio === 'number' ? inicio : Date.parse(inicio);
  const p = partesLocales(ms, desfase);
  if (!p) return '';
  const hoy = partesLocales(ahora, desfase);
  const dif = diaNumero(ahora, desfase) - diaNumero(ms, desfase);
  const hora = horaDelDia(ms, desfase);
  if (dif === 0) return `Hoy, ${hora}`;
  if (dif === 1) return `Ayer, ${hora}`;
  if (p.mes === hoy.mes && p.año === hoy.año) return `${DIAS[p.diaSemana]} ${p.dia}, ${hora}`;
  return `${DIAS[p.diaSemana]} ${p.dia} de ${MESES[p.mes]}${p.año !== hoy.año ? ` de ${p.año}` : ''}, ${hora}`;
}

/** La de cada fila: «hoy», «ayer», «hace 3 días» (esta semana) o «19 oct» («19 oct 2025» si fue otro año). */
export function cuandoCorto(inicio, desfase = 0, ahora = Date.now()) {
  const ms = typeof inicio === 'number' ? inicio : Date.parse(inicio);
  const p = partesLocales(ms, desfase);
  if (!p) return '';
  const dif = diaNumero(ahora, desfase) - diaNumero(ms, desfase);
  if (dif <= 0) return 'hoy';
  if (dif === 1) return 'ayer';
  if (dif < 7) return `hace ${dif} días`;
  return `${p.dia} ${MESES_CORTOS[p.mes]}${p.año !== partesLocales(ahora, desfase).año ? ` ${p.año}` : ''}`;
}

/** «7 de octubre»: la fecha de un mejor de antes, en la frase del récord. */
export function diaYMes(inicio, desfase = 0) {
  const p = partesLocales(inicio, desfase);
  return p ? `${p.dia} de ${MESES_LARGOS[p.mes]}` : '';
}

/* ------------------------------------------------------------------ */
/* Un entreno libre o del reloj                                        */
/* ------------------------------------------------------------------ */

// Cómo se llama un entreno de cada actividad en las frases, y si es «la» o «el».
const NOMBRES = {
  correr: ['carrera', 'f'], trail: ['carrera', 'f'], caminar: ['caminata', 'f'], senderismo: ['caminata', 'f'],
  bici: ['rodada', 'f'], spinning: ['rodada', 'f'], natacion: ['nado', 'm'],
};
const ORDINALES = ['primer', 'segund', 'tercer', 'cuart', 'quint', 'sext', 'séptim', 'octav', 'noven', 'décim'];
const ordinal = (n, g) => (n === 1 || n === 3 ? `${ORDINALES[n - 1]}${g === 'f' ? 'a' : ''}` : `${ORDINALES[n - 1]}${g === 'f' ? 'a' : 'o'}`);

/** «una carrera» / «un nado» / «un entreno de pádel». */
function comoSeDice(act) {
  const n = NOMBRES[act?.id];
  if (n) return { palabra: n[0], g: n[1] };
  return { palabra: `entreno de ${String(act?.nombre ?? 'actividad').toLowerCase()}`, g: 'm', generico: true };
}

/** «38 minutos» o «1 h 10 min». */
const minutosTexto = (seg) => { const min = Math.round((Number(seg) || 0) / 60); return min < 60 ? `${min} ${min === 1 ? 'minuto' : 'minutos'}` : tiempoTotal(seg); };

const segundosPorMetro = (f) => (num(f.distancia_m) > 0 && num(f.duracion_s) > 0 ? f.duracion_s / f.distancia_m : null);

/**
 * La frase de un entreno libre: lo que significa, contra sus otros entrenos DE LA MISMA ACTIVIDAD. En este orden:
 * su primera vez («Tu primera carrera en Training Lab»), la más larga del mes (si hubo al menos dos en ese mes), la que va en la semana («Tu tercera
 * carrera de la semana, y la más rápida»), o una neutra con el dato («Una caminata de 38 minutos»).
 * `otras`: sus entrenos (filas de `actividades`). `desde`: si la lista no llega más atrás (se leyeron solo los recientes), la hora del más viejo leído:
 * antes de esa hora no se sabe qué hizo, así que no se dice «primera» ni «más larga del mes» de algo que no se puede comparar entero.
 */
export function fraseDeActividad(fila, { otras = [], propias = [], desde = null } = {}) {
  const act = actividadDeEntreno(fila, propias);
  const { palabra, g, generico } = comoSeDice(act);
  const ms = Date.parse(fila.inicio);
  const desf = fila.desfase_min;
  const misma = (otras ?? []).filter((f) => f && f.id !== fila.id && actividadDeEntreno(f, propias)?.id === act?.id && Number.isFinite(Date.parse(f.inicio)));
  const todas = [...misma, fila];
  const conocido = (inicioMs) => desde === null || inicioMs >= desde;
  const neutra = `${g === 'f' ? 'Una' : 'Un'} ${palabra} de ${minutosTexto(fila.duracion_s)}.`;
  if (!Number.isFinite(ms)) return neutra;

  // Su primera vez.
  if (conocido(ms) && !misma.some((f) => Date.parse(f.inicio) < ms)) {
    return generico ? `Tu primer ${palabra} en Training Lab.` : `Tu ${ordinal(1, g)} ${palabra} en Training Lab.`;
  }
  const largo = (f) => (num(f.distancia_m) >= 100 ? num(f.distancia_m) : num(f.duracion_s) ?? 0);
  const p = partesLocales(ms, desf);
  // La más larga del mes.
  const inicioDelMes = Date.UTC(p.año, p.mes, 1) - (Number(desf) || 0) * 60000;
  const delMes = todas.filter((f) => { const q = partesLocales(f.inicio, f.desfase_min); return q && q.mes === p.mes && q.año === p.año; });
  if (conocido(inicioDelMes) && delMes.length >= 2 && delMes.every((f) => f === fila || largo(f) < largo(fila))) {
    return `Tu ${palabra} más ${g === 'f' ? 'larga' : 'largo'} de ${MESES_LARGOS[p.mes]}.`;
  }
  // La que va en la semana (de lunes a domingo).
  const lunes = diaNumero(ms, desf) - ((p.diaSemana + 6) % 7);
  const deLaSemana = todas.filter((f) => { const d = diaNumero(Date.parse(f.inicio), f.desfase_min); return d >= lunes && d < lunes + 7; });
  const antes = deLaSemana.filter((f) => Date.parse(f.inicio) <= ms).length;
  if (conocido(lunes * 86400000 - (Number(desf) || 0) * 60000) && antes >= 2 && antes <= 10) {
    const ritmos = deLaSemana.map(segundosPorMetro);
    const mio = segundosPorMetro(fila);
    const masRapida = mio !== null && ritmos.every((r) => r !== null) && deLaSemana.every((f) => f === fila || segundosPorMetro(f) > mio);
    return `Tu ${ordinal(antes, g)} ${palabra} de la semana${masRapida ? `, y ${g === 'f' ? 'la más rápida' : 'el más rápido'}` : ''}.`;
  }
  return neutra;
}

/** El número protagonista de un entreno libre: la distancia si la hubo («5.00 km», «1,500 m» en el agua); si no, el tiempo («1 h 10 min»). */
export function heroeDeActividad(fila) {
  const m = num(fila.distancia_m);
  if (m >= 100) {
    if (fila.deporte === 'natacion' || m < 1000) return { valor: miles(m), unidad: 'm', etiqueta: 'Distancia' };
    return { valor: (m / 1000).toFixed(2), unidad: 'km', etiqueta: 'Distancia' };
  }
  const [valor, unidad] = tiempoGrande(fila.duracion_s);
  return { valor, unidad, etiqueta: 'Tiempo' };
}

/** Pulso medio, en rojo, si el entreno lo trae. */
const pulsoMedio = (fc) => (num(fc) > 0 ? { valor: String(Math.round(fc)), unidad: 'lpm', etiqueta: 'Pulso medio', pulso: true } : null);

/** Los secundarios de un entreno libre (dos o tres): carrera Tiempo y Ritmo; bici Tiempo, Velocidad y Subida; sin distancia, Calorías; con pulso, Pulso medio. */
export function secundariosDeActividad(fila) {
  const s = [];
  const conDistancia = num(fila.distancia_m) >= 100;
  if (conDistancia) {
    s.push({ valor: tiempoCorto(fila.duracion_s), unidad: '', etiqueta: 'Tiempo' });
    if (fila.deporte === 'bici') {
      const kmh = num(fila.metricas?.velocidad_media_kmh) ?? (num(fila.duracion_s) > 0 ? (fila.distancia_m / fila.duracion_s) * 3.6 : null);
      if (kmh > 0) s.push({ valor: kmh.toFixed(1), unidad: 'km/h', etiqueta: 'Velocidad' });
      if (num(fila.desnivel_pos_m) > 0) s.push({ valor: miles(fila.desnivel_pos_m), unidad: 'm', etiqueta: 'Subida' });
    } else if (fila.deporte === 'natacion') {
      const por100 = num(fila.duracion_s) > 0 ? (fila.duracion_s / fila.distancia_m) * 100 : null;
      if (por100 > 0) s.push({ valor: tiempoCorto(por100), unidad: '/100 m', etiqueta: 'Ritmo' });
    } else {
      const ritmo = num(fila.metricas?.ritmo_medio_s_km) ?? (num(fila.duracion_s) > 0 ? (fila.duracion_s / fila.distancia_m) * 1000 : null);
      if (ritmo >= 90 && ritmo <= 3600) s.push({ valor: tiempoCorto(ritmo), unidad: '/km', etiqueta: 'Ritmo' });
    }
  } else {
    const kcal = num(fila.kcal_activas) > 0 ? fila.kcal_activas : num(fila.kcal_totales);
    if (kcal > 0) s.push({ valor: miles(kcal), unidad: 'kcal', etiqueta: 'Calorías' });
  }
  const pulso = pulsoMedio(fila.fc_media);
  // Tres como mucho: con la fila llena (bici: Tiempo, Velocidad y Subida), el pulso queda en «Tu pulso», como en el prototipo.
  if (pulso && s.length < 3) s.push(pulso);
  return s;
}

/** La línea de su fila en «Tus entrenos» (sin el cuándo): el número protagonista y el secundario que lo explica. «5.00 km · 5:27 /km», «22.40 km · 21.6 km/h»,
 *  «1,500 m · 2:03 /100 m», «1 h 10 min · 610 kcal». */
export function lineaDeActividad(fila) {
  const h = heroeDeActividad(fila);
  const otro = secundariosDeActividad(fila).find((x) => x.etiqueta !== 'Tiempo' && !x.pulso);
  return [`${h.valor} ${h.unidad}`, otro ? `${otro.valor} ${otro.unidad}`.trim() : null].filter(Boolean).join(' · ');
}

/**
 * El récord de un entreno libre (`recordDe` de `lib/resumenLibre.js`) como fila de la página: `{ titulo, sub }`, o `null`.
 * «Tu ritmo más rápido: 5:27 /km» y debajo «12 s/km más rápido que tu mejor, del 7 de octubre». La primera vez no va aquí: ya la dice la frase.
 */
export function filaDelRecord(record) {
  if (!record || record.tipo === 'primera') return null;
  const titulo = record.valor ? `${record.texto}: ${record.valor}` : record.texto;
  const cuando = record.antesInicio ? diaYMes(record.antesInicio, record.antesDesfase) : '';
  const sub = record.diferencia ? `${record.diferencia} que tu mejor${cuando ? `, del ${cuando}` : ''}.` : null;
  return { titulo, sub };
}

/* ------------------------------------------------------------------ */
/* Un workout del plan                                                 */
/* ------------------------------------------------------------------ */

/** Cómo terminan las series de un ejercicio, dicho corto: «4 × 5», «3 × 45 s», «3 × 400 m»; si cambian de una a otra, «4 series». */
function cuantoDe(suyos) {
  const n = suyos.length;
  const t0 = suyos[0]?.termina ?? {};
  const iguales = suyos.every((p) => p.termina?.por === t0.por && p.termina?.min === t0.min && p.termina?.max === t0.max);
  const lado = suyos[0]?.porLado ? ' por lado' : '';
  if (iguales && t0.por === 'reps' && t0.min > 0) return `${n} × ${t0.min === t0.max ? t0.min : `${t0.min}-${t0.max}`}${lado}`;
  if (iguales && t0.por === 'tiempo' && t0.min > 0) return `${n} × ${t0.min < 60 || t0.min % 60 ? `${t0.min} s` : `${t0.min / 60} min`}${lado}`;
  if (iguales && t0.por === 'distancia' && t0.min > 0) return `${n} × ${t0.min >= 1000 ? `${t0.min / 1000} km` : `${t0.min} m`}`;
  return `${n} ${n === 1 ? 'serie' : 'series'}`;
}

/**
 * «Lo que hiciste»: cada ejercicio del día con lo programado («4 × 5 · 100 kg») y cuántas series hizo de cuántas («4/4»).
 * `dia`: el día del plan (con los ejercicios del día que repite). `registro`: lo guardado de la sesión. `kilos(kg)`: cómo se dicen los kilos en su unidad.
 * `[{ nombre, programado, hechas, programadas }]`. Los Sets con reloj (AMRAP, EMOM…) no van: ahí las series las decide quien entrena.
 */
export function ejerciciosDeLaSesion(dia, registro, { kilos = (kg) => `${kilosTexto(kg)} kg` } = {}) {
  let pasos;
  try { pasos = pasosDeLaSesion(dia).pasos.filter((p) => p.tipo === 'ejercicio' && !p.opcional); } catch { pasos = []; }
  const hechas = filasPorSerie({ registro }).filas.filter((f) => f.tipo === 'serie' || f.tipo === 'lapso');
  const porEjercicio = new Map();
  pasos.forEach((p) => { if (!porEjercicio.has(p.idx)) porEjercicio.set(p.idx, []); porEjercicio.get(p.idx).push(p); });
  return [...porEjercicio.entries()].map(([idx, suyos]) => {
    const kg = suyos.every((p) => p.meta?.tipo === 'kg' && num(p.meta.min) !== null && num(p.meta.min) === num(p.meta.max) && num(p.meta.min) === num(suyos[0].meta.min)) ? num(suyos[0].meta.min) : null;
    return {
      nombre: suyos[0].nombre,
      programado: `${cuantoDe(suyos)}${kg > 0 ? ` · ${kilos(kg)}` : ''}`,
      hechas: hechas.filter((f) => String(f.clave).startsWith(`${idx}.`)).length,
      programadas: suyos.length,
    };
  });
}

/**
 * Los números de un workout del plan. `hechas`/`programadas`: series (lo de `seriesHechas` y `seriesProgramadas`). `segundos`: lo que duró.
 * `volumen`: kilos × reps, ya en su unidad (`unidad`: «kg» o «lb»). `fc`: el pulso medio, si el reloj lo trajo. `coach`: su nombre («Andrés»).
 * `ejercicios`: lo de `ejerciciosDeLaSesion` (para decir cuál le faltó). `manual`: la marcó como hecha a mano, sin el entreno guiado.
 * `{ heroe, frase, secundarios }`.
 */
export function numerosDeSesion({ hechas = 0, programadas = null, segundos = 0, volumen = 0, unidad = 'kg', fc = null, coach = null, ejercicios = [], manual = false }) {
  const secundarios = [];
  if (segundos > 0) secundarios.push({ valor: tiempoCorto(segundos), unidad: '', etiqueta: 'Tiempo' });
  if (volumen > 0) secundarios.push({ valor: miles(volumen), unidad, etiqueta: 'Volumen' });
  const pulso = pulsoMedio(fc);
  if (pulso) secundarios.push(pulso);
  if (manual || !(hechas > 0)) {
    const n = ejercicios.length;
    return {
      heroe: n > 0 ? { valor: String(n), unidad: n === 1 ? 'ejercicio' : 'ejercicios', etiqueta: 'Del plan' } : null,
      frase: 'Lo marcaste como hecho, sin el entreno guiado.',
      secundarios,
    };
  }
  let frase;
  if (programadas > 0 && hechas >= programadas) frase = coach ? `Todas las series que programó ${coach}.` : 'Todas las series de tu plan.';
  else if (programadas > 0) {
    const faltan = programadas - hechas;
    const cortos = ejercicios.filter((e) => e.hechas < e.programadas);
    if (faltan === 1 && cortos.length === 1) frase = `Series hechas: te faltó una de ${cortos[0].nombre.toLowerCase()}.`;
    else frase = faltan === 1 ? 'Series hechas: te faltó una.' : `Series hechas: te faltaron ${faltan}.`;
  } else frase = segundos > 0 ? `${hechas} ${hechas === 1 ? 'serie' : 'series'} en ${minutosTexto(segundos)}.` : `${hechas} ${hechas === 1 ? 'serie' : 'series'} de tu plan.`;
  return {
    heroe: programadas > 0
      ? { valor: String(hechas), unidad: `de ${programadas}`, etiqueta: 'Series del plan' }
      : { valor: String(hechas), unidad: hechas === 1 ? 'serie' : 'series', etiqueta: 'Series del plan' },
    frase,
    secundarios,
  };
}

/**
 * El récord del plan (`recordDelPlan` de `lib/stickers/plan.js`) como fila de la página: «Récord en Back Squat: 100 kg × 5» y debajo
 * «Justo lo programado: 4 × 5 con 100 kg. Antes levantabas 95 kg.». `kilos(kg)`: cómo se dicen en su unidad.
 */
export function filaDelRecordDelPlan(record, { kilos = (kg) => `${kilosTexto(kg)} kg` } = {}) {
  if (!record?.ejercicio || !(record.kg > 0)) return null;
  const antes = record.difNum > 0 ? record.kg - record.difNum : null;
  const sub = `${record.texto.replace(/con ([\d.]+) kg/, (_, k) => `con ${kilos(Number(k))}`)}.${antes > 0 ? ` Antes levantabas ${kilos(antes)}.` : ''}`;
  return { titulo: `Récord en ${record.ejercicio}: ${kilos(record.kg)}${record.reps ? ` × ${record.reps}` : ''}`, sub };
}

/* ------------------------------------------------------------------ */
/* El pulso                                                            */
/* ------------------------------------------------------------------ */

/** Las cinco zonas del pulso (segundos en cada una, `zonas_s`) en tres: fácil (1 y 2), medio (3) y duro (4 y 5), en por ciento. `null` si no hay. */
export function zonasSimples(zonas) {
  if (!Array.isArray(zonas) || zonas.length < 3) return null;
  const z = zonas.map((x) => Math.max(0, num(x) ?? 0));
  const tres = zonas.length >= 5 ? [z[0] + z[1], z[2], z[3] + z[4]] : [z[0], z[1], z.slice(2).reduce((a, b) => a + b, 0)];
  const total = tres.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return null;
  // Que sumen 100: hacia abajo, y lo que falta a las que más perdieron al redondear.
  const crudos = tres.map((x) => (x / total) * 100);
  const pct = crudos.map(Math.floor);
  const orden = crudos.map((c, i) => [c - Math.floor(c), i]).sort((a, b) => b[0] - a[0]);
  const faltan = 100 - pct.reduce((a, b) => a + b, 0);
  for (let k = 0; k < faltan; k += 1) pct[orden[k][1]] += 1;
  return pct;
}

/* ------------------------------------------------------------------ */
/* «Ver todos»                                                         */
/* ------------------------------------------------------------------ */

// El orden de los filtros; las demás actividades van después, en el orden en que aparecen.
const ORDEN_DE_FILTROS = ['correr', 'bici', 'fuerza', 'padel', 'caminar', 'natacion'];
const NOMBRE_DEL_FILTRO = { correr: 'Correr', bici: 'Bici', fuerza: 'Fuerza', padel: 'Pádel', caminar: 'Caminar', natacion: 'Nadar' };

/** A qué filtro va un entreno de la lista (`e` de `mezclaEntrenos`): su actividad; un workout del plan cuenta como Fuerza. `{ id, nombre }`. */
export function filtroDe(e, propias = []) {
  if (e?.plan) return { id: 'fuerza', nombre: 'Fuerza' };
  const a = actividadDeEntreno(e?.actividad, propias);
  return a ? { id: a.id, nombre: NOMBRE_DEL_FILTRO[a.id] ?? a.nombre } : { id: 'otro', nombre: 'Otro' };
}

/** Los filtros de una lista: las actividades que tiene, en orden (Correr, Bici, Fuerza, Pádel, Caminar, Nadar y luego las demás). Sin «Todas». */
export function filtrosDe(entrenos = [], propias = []) {
  const vistos = new Map();
  entrenos.forEach((e) => { const f = filtroDe(e, propias); if (!vistos.has(f.id)) vistos.set(f.id, f); });
  const conocidos = ORDEN_DE_FILTROS.filter((id) => vistos.has(id)).map((id) => vistos.get(id));
  return [...conocidos, ...[...vistos.values()].filter((f) => !ORDEN_DE_FILTROS.includes(f.id))];
}

/** Lo que duró un entreno de la lista, en segundos (un workout marcado a mano: 0). */
export function segundosDe(e) {
  if (e?.actividad) return num(e.actividad.duracion_s) ?? 0;
  if (e?.plan?.s && !e.plan.s.manual) return Math.max(0, Math.round((e.plan.s.fin - e.plan.s.inicio) / 1000));
  return 0;
}

/** El total de un mes en «Ver todos»: «7 entrenos · 5 h 9 min». */
export function totalDelMes(entrenos = []) {
  const n = entrenos.length;
  const seg = entrenos.reduce((t, e) => t + segundosDe(e), 0);
  return `${n} ${n === 1 ? 'entreno' : 'entrenos'}${seg >= 60 ? ` · ${tiempoTotal(seg)}` : ''}`;
}

/** «Octubre» si es de este año; «Octubre 2025» si no (`mes`: «Octubre 2025», lo de `porMes`). */
export const tituloDelMes = (mes, ahora = Date.now()) => (String(mes).endsWith(` ${new Date(ahora).getFullYear()}`) ? String(mes).split(' ')[0] : String(mes));

/** «11 entrenos · desde septiembre» («desde septiembre de 2025» si fue otro año). `primero`: milisegundos del más viejo. */
export function subtituloDelHistorial(total, primero, ahora = Date.now()) {
  if (!(total > 0)) return '';
  const d = Number.isFinite(primero) ? new Date(primero) : null;
  const desde = d ? ` · desde ${MESES_LARGOS[d.getMonth()]}${d.getFullYear() !== new Date(ahora).getFullYear() ? ` de ${d.getFullYear()}` : ''}` : '';
  return `${total} ${total === 1 ? 'entreno' : 'entrenos'}${desde}`;
}
