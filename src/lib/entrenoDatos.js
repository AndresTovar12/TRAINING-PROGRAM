import { medida as infoMedida } from './medidas.js';
import { anotadoEnVuelta, conVueltaAnotada } from './porVuelta.js';

/**
 * Lo que las pantallas del modo entreno dicen de un paso, sin pantalla: textos, cifras, la barra de avance y qué anotar en el
 * registro de siempre al darle «Listo». Vive aparte de `entreno.js` (que solo sabe de pasos y de avance) porque esto ya es
 * lenguaje de pantalla; y aparte de los componentes para poder probarse con `scripts/prueba-entreno-datos.mjs`.
 *
 * REGLA: se dice SOLO lo que el coach escribió. Un paso sin reps ni carga no tiene cifras; un día sin Sets ni vueltas dice
 * «Ejercicio 2 de 4» y no «Serie 2 de 4 · Vuelta 1 de 1».
 */

const dos = (n) => String(n).padStart(2, '0');
const sinCeros = (n) => String(Math.round(n * 100) / 100);
const rango = (min, max, f = sinCeros) => (min === max ? f(min) : `${f(min)}–${f(max)}`);

/** Segundos en un reloj: «2:30», «0:05», «1:05:00». */
export function relojDe(segundos) {
  const s = Math.max(0, Math.round(Number(segundos) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${dos(m)}:${dos(s % 60)}` : `${m}:${dos(s % 60)}`;
}

/** Un ritmo guardado en segundos, como se lee: 274 → «4:34». */
const ritmoDe = (seg) => relojDe(seg);

/**
 * Dónde va el atleta, en una línea: «Serie 1 de 4 · Vuelta 2 de 5 · Lapso 1 de 2». Con Sets de un solo ejercicio y sin vueltas:
 * «Ejercicio 2 de 4». Las vueltas de un rango dicen «Vuelta 2 de 5-6».
 */
export function lineaDeAvance(plan, paso) {
  if (!paso) return '';
  if (paso.tipo === 'nota' || plan.simple) return `${paso.tipo === 'nota' ? 'Paso' : 'Ejercicio'} ${paso.n} de ${plan.total}`;
  const partes = [`Serie ${paso.serie} de ${plan.series}`];
  if (paso.vueltas > 1) partes.push(`Vuelta ${paso.vuelta} de ${paso.vueltasMin === paso.vueltas ? paso.vueltas : `${paso.vueltasMin}-${paso.vueltas}`}`);
  if (paso.lapsos > 1) partes.push(`Lapso ${paso.lapso} de ${paso.lapsos}`);
  return partes.join(' · ');
}

/* ------------------------------------------------------------------ */
/* Las cifras grandes                                                  */
/* ------------------------------------------------------------------ */

// Lo que hay que hacer: «5 reps», «30 seg por lado», «800 m», «2+2+2 reps». Un texto libre del coach va como texto.
function cifraDeLoQueHacer(paso) {
  const t = paso.termina;
  if (!t || t.por === 'boton') return t?.texto ? { valor: t.texto, etiqueta: 'meta', texto: true } : null;
  const lado = paso.porLado ? ' por lado' : '';
  const etiqueta = t.unidad === 'cluster' || t.unidad === 'reps' ? 'reps' : infoMedida(t.unidad).corta;
  return { valor: t.cantidad.replace('-', '–'), etiqueta: `${etiqueta}${lado}` };
}

const ETIQUETA_DE_CARGA = { pct: 'carga', int: 'intensidad', rpe: 'RPE', rir: 'RIR', ritmo: 'min/km', zona: 'zona', w: 'W', nado: '/100 m' };

// La carga o el objetivo: «78%», «RIR 2», «4:34», «Z2». El peso fijo («20 kg») no va aquí: va en la casilla de kilos.
function cifraDeCarga(paso) {
  const m = paso.meta;
  if (!m || m.tipo === 'kg') return null;
  if (m.tipo === 'texto' || m.min === undefined) return { valor: m.texto, etiqueta: 'carga', texto: true };
  let valor = rango(m.min, m.max);
  if (m.tipo === 'pct' || m.tipo === 'int') valor = `${valor}%`;
  else if (m.tipo === 'zona') valor = `Z${valor}`;
  else if (m.tipo === 'ritmo' || m.tipo === 'nado') valor = rango(m.min, m.max, ritmoDe);
  return { valor, etiqueta: ETIQUETA_DE_CARGA[m.tipo] ?? 'carga' };
}

/**
 * Las cifras de un paso, hasta tres, en tarjetas: lo que hay que hacer, la carga y los kilos. `kilos` es lo que el glue calculó
 * de su 1RM o de un peso fijo, ya en SU unidad: `{ valor, unidad, aprox }` (`aprox` si salió de un porcentaje), o `null`.
 * Cada una: `{ valor, etiqueta, destacado?, texto? }` (`texto`: es una palabra, no un número: se dibuja más chica).
 */
export function cifrasDelPaso(paso, kilos = null) {
  if (!paso || paso.tipo !== 'ejercicio') return [];
  return [
    cifraDeLoQueHacer(paso),
    cifraDeCarga(paso),
    kilos ? { valor: `${kilos.aprox ? '≈' : ''}${kilos.valor}`, etiqueta: kilos.unidad, destacado: true } : null,
  ].filter(Boolean);
}

/** Lo planeado en una línea: «5 reps · 78% carga · ≈105 kg». Para «Sigue:», «Planeado:» y la lista. */
export function textoDeLoPlaneado(paso, kilos = null) {
  if (!paso) return '';
  const carga = cifraDeCarga(paso);
  const cargaTexto = carga ? (carga.texto ? carga.valor : (paso.meta.tipo === 'pct' ? `${carga.valor} carga` : paso.meta.texto)) : null;
  return [
    paso.tipo === 'ejercicio' ? paso.texto : '',
    cargaTexto,
    kilos ? `${kilos.aprox ? '≈' : ''}${kilos.valor} ${kilos.unidad}` : (paso.meta?.tipo === 'kg' ? paso.meta.texto : null),
  ].filter(Boolean).join(' · ');
}

/* ------------------------------------------------------------------ */
/* La barra de avance, la lista y el final                             */
/* ------------------------------------------------------------------ */

/** Cuánto va de cada Set (0 a 1), para la barra de arriba: una pieza por Set. Lo saltado cuenta como pasado; lo opcional no cuenta. */
export function segmentosDeAvance(plan, estados) {
  const piezas = Array.from({ length: Math.max(1, plan.series) }, () => ({ hechos: 0, total: 0 }));
  plan.pasos.forEach((p, i) => {
    if (p.tipo === 'descanso' || p.opcional) return;
    const pieza = piezas[(p.serie ?? 1) - 1] ?? piezas[0];
    pieza.total += 1;
    if (estados[i] !== 'pendiente') pieza.hechos += 1;
  });
  return piezas.map((p) => (p.total ? p.hechos / p.total : 0));
}

/** Los pasos de la lista «Tu entreno», agrupados por Set y sin los descansos: `[{ titulo, pasos: [{ paso, i }] }]`. */
export function gruposDeLaLista(plan) {
  const grupos = [];
  plan.pasos.forEach((paso, i) => {
    if (paso.tipo === 'descanso') return;
    const titulo = paso.serie ? `Serie ${paso.serie}` : null;
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.titulo === titulo) ultimo.pasos.push({ paso, i });
    else grupos.push({ titulo, pasos: [{ paso, i }] });
  });
  return grupos;
}

/** Qué se dice de un paso en la lista: «Vuelta 2 · Lapso 1 · 5 reps · 78% carga · ≈105 kg». */
export function subtituloDeLaLista(paso, kilos = null) {
  if (paso.tipo === 'reloj') return paso.resumen;
  return [
    paso.vueltas > 1 ? `Vuelta ${paso.vuelta}` : null,
    paso.lapsos > 1 ? `Lapso ${paso.lapso}` : null,
    textoDeLoPlaneado(paso, kilos),
    paso.opcional ? 'Opcional' : null,
  ].filter(Boolean).join(' · ');
}

/* ------------------------------------------------------------------ */
/* «Cambiar»: lo que el atleta hizo distinto de lo planeado            */
/* ------------------------------------------------------------------ */

// Cuánto sube y baja la flecha de cada medida: igual que la ficha del ejercicio (los metros de diez en diez, los segundos de cinco en cinco…).
const PASO_DE_LA_CANTIDAD = { reps: 1, seg: 5, min: 1, m: 10, km: 0.5, yd: 5, cal: 1, cluster: 1 };

/** Lo que pide el plan para anotar de vuelta: la cantidad sola. De un rango («8-10») vale el primero; un cluster, todas sus reps. */
export function cantidadPlaneada(paso) {
  const t = paso?.termina;
  if (!t || t.por === 'boton' || !t.cantidad) return null;
  if (t.unidad === 'cluster') return String(t.valor);
  const n = parseFloat(String(t.cantidad).replace(',', '.'));
  return Number.isFinite(n) ? sinCeros(n) : null;
}

/**
 * Los campos de «Cambiar» de un paso: la cantidad (reps, segundos, metros…) y los kilos si el ejercicio lleva peso. Un ejercicio
 * siempre tiene qué anotar: con el plan escrito la cantidad arranca en lo planeado («Cambiar»); si el coach solo puso el nombre, los
 * campos arrancan vacíos y la hoja es para ANOTAR lo que se hizo (la ficha del ejercicio también deja anotar reps y peso aunque el plan
 * no diga nada, y aquí tampoco se pierde eso). `planeado` vacío = el plan no dice nada de esa cantidad.
 */
export function camposDeCambiar(paso, { conPeso = false } = {}) {
  if (!paso || paso.tipo !== 'ejercicio') return [];
  const planeada = cantidadPlaneada(paso);
  const u = planeada !== null ? paso.termina.unidad : 'reps';
  const campos = [{
    clave: 'reps',
    rotulo: u === 'reps' || u === 'cluster' ? 'Reps' : infoMedida(u).rotulo,
    unidad: u,
    paso: PASO_DE_LA_CANTIDAD[u] ?? 1,
    planeado: planeada ?? '',
  }];
  if (conPeso) campos.push({ clave: 'kg', rotulo: 'Kilos' });
  return campos;
}

/* ------------------------------------------------------------------ */
/* El registro de siempre                                              */
/* ------------------------------------------------------------------ */

const vacio = (x) => x === undefined || x === null || String(x).trim() === '';

/**
 * Lo que queda anotado en el registro del ejercicio (`sesión.exercises[idx]`: `repsHechas` y `weight`, que es lo que leen el
 * progreso, los récords y la IA) al darle «Listo»: «Listo» da por hecho lo planeado, y `real` trae lo que el atleta CAMBIÓ.
 *
 *   · Lo que el atleta cambió se escribe siempre. Lo planeado solo llena lo que está vacío: si ya había anotado 100 kg en la ficha,
 *     un «Listo» no se lo pisa con los 105 planeados.
 *   · Una vuelta de un ejercicio con varias va a su lugar (`vueltas[i]`) y el resumen se mantiene al día (ver `conVueltaAnotada`).
 *   · Un lapso de cardio NO anota aquí (un ejercicio con dos lapsos no tiene un solo «reps hechas»): lo suyo queda en el avance.
 *   · Sin nada que anotar (un ejercicio solo con su nombre), devuelve `null`: no se escribe un registro vacío.
 *
 * `kgPlaneados`: los kilos del plan (de su 1RM o fijos), en kilos y como texto, o `null`. `conPeso`: el ejercicio lleva peso.
 * `real`: `{ reps, kg }` con `kg` en kilos, o `undefined`.
 */
export function exDataTrasListo({ paso, exData, kgPlaneados = null, conPeso = false, real }) {
  if (!paso || paso.tipo !== 'ejercicio' || paso.lapsos > 1) return null;
  const variasVueltas = paso.vueltas > 1;
  const i = paso.vuelta - 1;
  const hay = variasVueltas ? anotadoEnVuelta(exData, i) : (exData ?? {});
  const reps = !vacio(real?.reps) ? String(real.reps) : (vacio(hay.repsHechas) ? cantidadPlaneada(paso) : null);
  const peso = !conPeso ? null : (!vacio(real?.kg) ? String(real.kg) : (vacio(hay.weight) ? kgPlaneados : null));
  const dato = {};
  if (!vacio(reps)) dato.repsHechas = String(reps);
  if (!vacio(peso)) dato.weight = String(peso);
  if (!Object.keys(dato).length) return null;
  return variasVueltas ? conVueltaAnotada(exData, i, dato) : { ...exData, ...dato };
}
