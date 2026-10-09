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

// Un entreno que se retoma al día siguiente no «dura» 26 horas: pasadas seis, el tiempo total ya no se dice (mejor nada que un número absurdo).
const LIMITE_DEL_TIEMPO = 6 * 3600 * 1000;

/** El tiempo total para la barra de arriba: «12:30», o `null` si no ha iniciado o pasó de seis horas. */
export function tiempoTotal(ms) {
  return ms === null || ms === undefined || !(ms >= 0) || ms > LIMITE_DEL_TIEMPO ? null : relojDe(ms / 1000);
}

/** Un ritmo guardado en segundos, como se lee: 274 → «4:34». */
const ritmoDe = (seg) => relojDe(seg);

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

/**
 * Una cifra como se lee en una pastillita: «5 reps», «78%», «RIR 2», «Z2», «≈105 kg». El nombre de la carga («carga», «intensidad», «zona») sobra,
 * el «%» y la «Z» ya lo dicen; RIR y RPE sí van, porque son lo único que explica el número.
 */
export function textoDeCifra(c) {
  if (!c) return '';
  if (c.texto || c.etiqueta === 'carga' || c.etiqueta === 'intensidad' || c.etiqueta === 'zona') return String(c.valor);
  if (c.etiqueta === 'RIR' || c.etiqueta === 'RPE') return `${c.etiqueta} ${c.valor}`;
  return `${c.valor} ${c.etiqueta}`;
}

/** Las pastillitas de un paso, de las listas y de «Sigue»: `[{ texto, fuerte }]` (`fuerte`: los kilos, en azul). */
export function pastillasDelPaso(paso, kilos = null) {
  return cifrasDelPaso(paso, kilos).map((c) => ({ texto: textoDeCifra(c), fuerte: !!c.destacado }));
}

/** Lo planeado en una línea: «5 reps · 78% · ≈105 kg». Para «Sigue» y «Planeado». */
export function textoDeLoPlaneado(paso, kilos = null) {
  if (!paso) return '';
  const partes = pastillasDelPaso(paso, kilos).map((p) => p.texto);
  // Un peso fijo («20 kg») sin kilos calculados se dice como lo escribió el coach.
  if (!kilos && paso.tipo === 'ejercicio' && paso.meta?.tipo === 'kg') partes.push(paso.meta.texto);
  return partes.join(' · ');
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

/**
 * Las vueltas de un Set, en puntos: `[{ estado: 'hecha' | 'actual' | 'pendiente', opcional }]`, uno por vuelta; `[]` si el Set no se repite.
 * Una vuelta está hecha cuando todos sus pasos están hechos o saltados; la que va es la del paso que se mira (`claveActual`).
 */
export function puntosDeVueltas(plan, estados, serie, claveActual) {
  const delSet = plan.pasos.filter((p) => p.tipo === 'ejercicio' && p.serie === serie);
  const total = delSet.reduce((m, p) => Math.max(m, p.vueltas), 0);
  if (total <= 1) return [];
  const puntos = [];
  for (let v = 1; v <= total; v += 1) {
    const pasos = delSet.filter((p) => p.vuelta === v);
    const hecha = pasos.length > 0 && pasos.every((p) => estados[p.i] !== 'pendiente');
    const actual = !hecha && pasos.some((p) => p.clave === claveActual);
    puntos.push({ estado: hecha ? 'hecha' : (actual ? 'actual' : 'pendiente'), opcional: pasos.some((p) => p.opcional) });
  }
  return puntos;
}

/**
 * La serie a la vista, en un Set de dos ejercicios o más (bi-serie, tri-serie, circuito): cuál es cada uno y cuál toca.
 * `{ nombre: 'Bi-serie', letras: [{ letra: 'A', nombre: 'Lunges', estado: 'hecho' | 'actual' | 'pendiente' }] }`, o `null` si no aplica.
 */
export function serieALaVista(plan, estados, paso) {
  if (!paso || paso.tipo !== 'ejercicio' || !(paso.ejerciciosEnSerie > 1)) return null;
  const letras = [];
  for (let e = 1; e <= paso.ejerciciosEnSerie; e += 1) {
    const q = plan.pasos.find((x) => x.tipo === 'ejercicio' && x.serie === paso.serie && x.vuelta === paso.vuelta && x.ejercicioEnSerie === e);
    if (q) {
      letras.push({
        letra: String.fromCharCode(64 + e),
        nombre: q.nombre,
        estado: q.clave === paso.clave ? 'actual' : (estados[q.i] !== 'pendiente' ? 'hecho' : 'pendiente'),
      });
    }
  }
  return { nombre: paso.serieTag, letras };
}

/**
 * «Ver todo»: el entreno como lo escribió el coach, UNA TARJETA POR SET y una fila por ejercicio (las vueltas no se repiten en filas: van en
 * puntos). La fila lleva a su primer paso pendiente; lo ya hecho no lleva a ningún lado.
 *
 *   [{ serie, titulo, etiqueta, puntos, reloj, resultado, esActual, filas: [{ idx, nombre, estado, clave, pastillas }] }]
 *   estado  'hecho' · 'actual' (el paso que se mira) · 'saltado' (no queda nada por hacer pero se saltó algo) · 'pendiente'
 *   etiqueta  lo que es el Set: «Bi-serie», «AMRAP · 12 min», «5 rondas» (en lapsos); `null` si es un Set de un ejercicio
 *   puntos  las vueltas (ver `puntosDeVueltas`); `reloj` el Set lo corre un reloj; `resultado` lo que quedó anotado de ese reloj (o `null`)
 *
 * `kilosDe(paso)` dice los kilos de ese paso (de su 1RM) o `null`; `resultadoDe(paso)` el resultado de un reloj, ya escrito, o `null`.
 */
export function tarjetasDeLaLista(plan, estados, claveActual, { kilosDe = () => null, resultadoDe = () => null } = {}) {
  const tarjetas = [];
  plan.pasos.forEach((paso) => {
    if (paso.tipo === 'descanso') return;
    const serie = paso.serie ?? null;
    let t = tarjetas[tarjetas.length - 1];
    if (!t || t.serie !== serie) {
      t = { serie, titulo: serie ? `Serie ${serie}` : null, etiqueta: null, puntos: [], reloj: false, resultado: null, esActual: false, filas: [], _pasos: [] };
      tarjetas.push(t);
    }
    t._pasos.push(paso);
  });
  tarjetas.forEach((t) => {
    const [primero] = t._pasos;
    if (primero.tipo === 'reloj') {
      t.reloj = true;
      t.etiqueta = primero.deLapsos ? (primero.rondas > 1 ? `${primero.rondas} rondas` : null) : primero.resumen;
      t.resultado = resultadoDe(primero);
      const estado = primero.clave === claveActual ? 'actual' : (estados[primero.i] === 'pendiente' ? 'pendiente' : (estados[primero.i] === 'hecho' ? 'hecho' : 'saltado'));
      const irA = estado === 'hecho' ? null : primero.clave;
      t.filas = primero.miembros.map((m) => ({
        idx: m.idx,
        nombre: m.nombre,
        estado,
        clave: irA,
        pastillas: primero.deLapsos
          ? [{ texto: m.lapsos.map((l) => l.texto).filter(Boolean).join(' → '), fuerte: false }].filter((x) => x.texto)
          : [m.texto, m.carga].filter(Boolean).map((texto) => ({ texto, fuerte: false })),
      }));
    } else if (primero.tipo === 'nota') {
      t.filas = t._pasos.map((p) => ({
        idx: p.idx,
        nombre: p.nombre,
        estado: p.clave === claveActual ? 'actual' : (estados[p.i] === 'pendiente' ? 'pendiente' : (estados[p.i] === 'hecho' ? 'hecho' : 'saltado')),
        clave: estados[p.i] === 'hecho' ? null : p.clave,
        pastillas: [],
      }));
    } else {
      const porEjercicio = new Map();
      t._pasos.forEach((p) => { if (!porEjercicio.has(p.idx)) porEjercicio.set(p.idx, []); porEjercicio.get(p.idx).push(p); });
      t.filas = [...porEjercicio.values()].map((pasos) => {
        const faltan = pasos.filter((p) => estados[p.i] !== 'hecho');
        const requeridos = pasos.filter((p) => !p.opcional && estados[p.i] === 'pendiente');
        const salto = pasos.some((p) => estados[p.i] === 'saltado');
        const proximo = faltan[0] ?? pasos[0];
        let estado = 'hecho';
        if (pasos.some((p) => p.clave === claveActual)) estado = 'actual';
        else if (requeridos.length) estado = 'pendiente';
        else if (salto) estado = 'saltado';
        return { idx: pasos[0].idx, nombre: pasos[0].nombre, estado, clave: estado === 'hecho' ? null : (faltan[0]?.clave ?? null), pastillas: pastillasDelPaso(proximo, kilosDe(proximo)) };
      });
      if (primero.ejerciciosEnSerie > 1) t.etiqueta = primero.serieTag;
      t.puntos = puntosDeVueltas(plan, estados, t.serie, claveActual);
    }
    t.esActual = t.filas.some((f) => f.estado === 'actual');
    delete t._pasos;
  });
  return tarjetas;
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
