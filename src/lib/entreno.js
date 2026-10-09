import { leeCantidad, leeCarga, leeDescanso, textoMeta } from './medidas.js';
import { formatoDeMiembros, nombreDeFormato, resumenDeFormato, segundosTotales } from './formatos.js';
import { comoEjercicio, hayLapsos, lapsoDeLinea, lapsosDe } from './lapsos.js';
import { ejercicioDeVuelta, vueltasDe } from './porVuelta.js';
import { groupIntoSets, setTag } from './setsDeUnaSesion.js';

/**
 * El MODO ENTRENO, sin pantalla: la sesión del día convertida en PASOS, y el avance del atleta sobre ellos.
 *
 * POR QUÉ EXISTE. Andrés, 9 oct 2026 (EXPERIENCIA DE WORKOUTS): hoy el atleta solo hace scroll por una lista; no hay un
 * «Iniciar», ni un «ahora toca esto», ni un descanso que avise. Y su prioridad real de dispositivos es reloj inteligente >
 * teléfono > computadora: «dejar todo listo para cuando la app sea descargable y para el Apple Watch». Por eso las pantallas
 * (la del teléfono, la de la computadora y algún día la del reloj) no calculan nada: LEEN esto. Aquí no hay React, ni
 * `Date.now()`, ni nada de pantalla; cada función recibe la hora (`ahora`, en milisegundos) igual que `relojDeFormato.js`.
 *
 * LOS PASOS. Una sesión se vuelve una lista plana y ordenada. Cada paso es de un tipo:
 *   · 'ejercicio' — hacer algo, una vez (una vuelta de un ejercicio, un lapso de cardio);
 *   · 'reloj'     — un Set con formato (AMRAP, EMOM, Tabata…) entero: lo corre el reloj de siempre (`RelojDelBloque`);
 *   · 'nota'      — un día que el coach escribió solo con notas («Sprint 6 x 30 yd»): cada nota es un paso;
 *   · 'descanso'  — esperar, SOLO si el coach lo escribió (`descanso` entre vueltas, `descansoSet` entre Sets).
 *
 * LA REGLA DE ORO (Andrés: «LO MÁS IMPORTANTE es que funcione igual de bien con mucha o con poca información»): se
 * crea SOLO lo que el coach escribió. Un ejercicio sin reps ni carga es un paso con su nombre y nada más; sin descanso no hay
 * paso de descanso; sin Sets con `sets` no hay vueltas. Nada de huecos ni valores inventados.
 *
 * LO CANÓNICO. Todos los relojes del mundo guían con la MISMA estructura (ver la nota de relojes inteligentes): pasos con
 * cómo terminan + una meta opcional + cuántas veces se repiten + el deporte. Cada paso lo trae ya:
 *   termina   { por: 'reps' | 'tiempo' | 'distancia' | 'calorias' | 'boton', min, max, valor }
 *             tiempo en SEGUNDOS, distancia en METROS (km y yardas ya convertidos), `valor` solo si es un número fijo.
 *             'boton' = termina cuando el atleta lo dice (`texto` trae lo que escribió el coach, si algo).
 *   meta      null, o { tipo, texto, min, max }, con los ids de `CARGAS` (pct, kg, int, rpe, rir, ritmo, zona, w, nado, o
 *             'texto' si no encaja en ninguno). Ritmo en SEGUNDOS por km y ritmo de nado en segundos por 100 m.
 *   intensidad 'trabajo' o 'recuperar'. Reservadas para cuando el editor las pida: 'calentar' y 'enfriar'.
 *   deporte   (del plan) el deporte que mide un reloj: 'fuerza', 'correr', 'bici'… o `null` en un tipo propio del coach.
 * Las vueltas (`vuelta` de `vueltas`, `opcional`) y la serie (`serie`, `serieTag`) dicen qué pasos son un bloque que se repite:
 * con eso un exportador de Apple WorkoutKit o de Garmin arma sus `IntervalBlock` / pasos de repetición. Hoy no se exporta nada
 * (no hay app nativa); lo que falta es el adaptador, no los datos. `lib/wearables.js` es la puerta para LEER datos de un reloj
 * (pulso, pasos); esto es la estructura del entreno que se le MANDARÍA.
 *
 * EL AVANCE (`sesión.entreno`, dentro del registro del atleta, junto a `exercises` y `formatos`):
 *   { v, inicio, fin, hechos: { [clave]: { t, n, reps?, kg?, seg? } }, saltados: { [clave]: { t, n } }, extra: { [clave]: seg } }
 * Son OBJETOS con el paso por llave, nunca listas: la base mezcla los objetos llave por llave a cualquier profundidad y
 * REEMPLAZA las listas enteras (ver `estadoPorPartes.js`); así el teléfono y un reloj pueden marcar pasos distintos sin
 * pisarse.
 *
 * EL PASO ACTUAL NO SE GUARDA: es el PRIMER paso sin marca. Lo que se guarda es lo hecho. Así aguanta que el coach edite el plan a
 * medio entreno (un ejercicio nuevo aparece como pendiente donde le toca), que otro dispositivo marque pasos, y que el teléfono
 * se duerma o iOS mate la pestaña: al volver, todo se calcula de nuevo. Cada marca guarda también `n` (el nombre del ejercicio):
 * si el coach cambió ese ejercicio por otro, la marca vieja ya no cuenta.
 *
 * EL DESCANSO TAMPOCO ES UN CONTADOR: empieza cuando se marcó el paso anterior (`t`), y lo que queda se calcula de ahí. «Sirve y
 * nunca manda»: pasada la hora no se avanza solo; el atleta sigue contando hacia arriba (`pasado`) hasta que toca «Seguir».
 *
 * LA CLAVE DE UN PASO es estable aunque el plan se retoque alrededor: `<idx>.<vuelta>.<lapso>` (idx = posición del ejercicio en
 * la lista, la misma con la que ya se guarda lo que el atleta anota en `exercises[idx]`), `r.<idx>` en un reloj, `n.<idx>` en una
 * nota y `d.<clave del paso anterior>` en un descanso.
 */

const VERSION = 1;
// Topes de sensatez, los mismos que ya tienen el reloj de formatos y el de lapsos: un dato malformado no debe armar 12 000 pasos.
export const MAX_PASOS = 2000;
const MAX_RONDAS = 60;

/* ------------------------------------------------------------------ */
/* Leer lo que escribió el coach                                       */
/* ------------------------------------------------------------------ */

const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const texto = (x) => (Array.isArray(x) ? x.join(' ') : String(x ?? '')).trim();
const redondea = (n) => Math.round(n * 100) / 100;

const NUM = '\\d+(?:[.,]\\d+)?';
const RANGO = new RegExp(`^(${NUM})(?:\\s*[-–]\\s*(${NUM}))?$`);
const aNumero = (t) => parseFloat(String(t).replace(',', '.'));
const TIEMPO = /^(\d{1,2}):(\d{2})$/;
const deTiempo = (t) => {
  const m = TIEMPO.exec(String(t ?? '').trim());
  return m ? parseInt(m[1], 10) * 60 + parseInt(m[2], 10) : null;
};

/** «8-10» → { min: 8, max: 10 }; «10» → { min: 10, max: 10 }; lo que no es un número o un rango, `null`. */
function rangoDe(t) {
  const m = RANGO.exec(String(t ?? '').trim());
  if (!m) return null;
  const a = aNumero(m[1]);
  const b = m[2] ? aNumero(m[2]) : a;
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

/** «4:34-5:00» → { min: 274, max: 300 } (segundos). */
function rangoDeTiempo(t) {
  const [a, b = a] = String(t ?? '').split(/\s*[-–]\s*/);
  const x = deTiempo(a);
  const y = deTiempo(b);
  return x === null || y === null ? null : { min: Math.min(x, y), max: Math.max(x, y) };
}

/** Las veces que se repite un Set: «5» → 5; «4-6» → de 4 a 6 (las de más son OPCIONALES); texto, vacío o «—» → una vez. */
export function rondasDelSet(sets) {
  const m = /^(\d+)(?:\s*[-–]\s*(\d+))?$/.exec(String(sets ?? '').trim());
  if (!m) return { min: 1, max: 1 };
  const a = Math.min(MAX_RONDAS, Math.max(1, parseInt(m[1], 10)));
  const b = m[2] ? Math.min(MAX_RONDAS, Math.max(1, parseInt(m[2], 10))) : a;
  return { min: Math.min(a, b), max: Math.max(a, b) };
}

const A_METROS = { m: 1, km: 1000, yd: 0.9144 };

/** Cómo termina lo que dice la línea de un ejercicio (o de un lapso): ver «LO CANÓNICO». */
function terminaDe(e) {
  const { cantidad, unidad, libre } = leeCantidad(e);
  if (!cantidad) return { por: 'boton' };
  if (libre) return { por: 'boton', texto: cantidad };
  if (unidad === 'cluster') {
    const bloques = cantidad.split('+').map((n) => parseInt(n, 10));
    const total = bloques.reduce((a, n) => a + n, 0);
    const entre = rangoDe(e?.entreBloques)?.min;
    return { por: 'reps', min: total, max: total, valor: total, bloques, ...(entre ? { entreBloques: entre } : null) };
  }
  const r = rangoDe(cantidad);
  if (!r) return { por: 'boton', texto: cantidad };
  const k = unidad === 'min' ? 60 : (A_METROS[unidad] ?? 1);
  let por = 'distancia';
  if (unidad === 'reps') por = 'reps';
  else if (unidad === 'seg' || unidad === 'min') por = 'tiempo';
  else if (unidad === 'cal') por = 'calorias';
  const min = redondea(r.min * k);
  const max = redondea(r.max * k);
  return { por, min, max, valor: min === max ? min : null };
}

/** La carga o el objetivo de un ejercicio (o lapso): ver «LO CANÓNICO». `null` si el coach no puso ninguna. */
function metaDe(e) {
  const crudo = texto(e?.intensity);
  if (!crudo) return null;
  const { tipo, cantidad } = leeCarga(e);
  if (!tipo) return { tipo: 'texto', texto: crudo };
  const r = tipo === 'ritmo' || tipo === 'nado' ? rangoDeTiempo(cantidad) : rangoDe(cantidad);
  return { tipo, texto: crudo, ...(r ?? null) };
}

/**
 * Lo que dice un descanso escrito: «90 seg», «2 min», «3-4 min», «1:30». Con segundos hay cuenta; con texto libre
 * («Recuperación total») no: se enseña tal cual y espera «Seguir». `null` si está vacío o dice cero.
 */
function lecturaDeDescanso(escrito) {
  const crudo = texto(escrito);
  if (!crudo) return null;
  const d = leeDescanso({ descanso: crudo });
  let r = null;
  if (d.unidad) {
    const x = rangoDe(d.cantidad);
    if (x) r = { min: Math.round(x.min * (d.unidad === 'min' ? 60 : 1)), max: Math.round(x.max * (d.unidad === 'min' ? 60 : 1)) };
  } else {
    const s = deTiempo(crudo);
    if (s !== null) r = { min: s, max: s };
  }
  if (r && r.max <= 0) return null;
  const seg = r && r.min > 0 ? r.min : null;
  return { texto: crudo, seg, segMax: seg && r.max !== r.min ? r.max : null };
}

/* ------------------------------------------------------------------ */
/* La sesión, en pasos                                                 */
/* ------------------------------------------------------------------ */

// Qué deporte mide un reloj en cada tipo de sesión de base (los tipos propios del coach no dicen: `null`).
const DEPORTE_DEL_TIPO = {
  gym: 'fuerza', speed: 'velocidad', recovery: 'recuperacion', football: 'futbol', tests: 'pruebas', team: 'equipo',
  correr: 'correr', bici: 'bici', natacion: 'natacion', yoga: 'yoga', movilidad: 'movilidad', terapia: 'terapia', clase: 'clase',
};

/** El deporte de un día según su tipo; un tipo desconocido se trata como gym, igual que `tipoDeSesion`. */
export function deporteDelTipo(day) {
  const cat = day?.cat;
  if (cat === 'otro' || cat === 'off') return null;
  return DEPORTE_DEL_TIPO[cat] ?? 'fuerza';
}

const nombreDe = (ex) => texto(ex?.name) || 'Ejercicio';

const pasoDeDescanso = (lectura, entre, despuesDe) => ({
  clave: `d.${despuesDe}`,
  tipo: 'descanso',
  entre,
  intensidad: 'recuperar',
  texto: lectura.texto,
  seg: lectura.seg,
  segMax: lectura.segMax,
  termina: lectura.seg
    ? { por: 'tiempo', min: lectura.seg, max: lectura.segMax ?? lectura.seg, valor: lectura.segMax ? null : lectura.seg }
    : { por: 'boton' },
});

/**
 * La sesión de un día, en pasos: `{ deporte, pasos, total, series, simple, soloNotas, truncado }`.
 *
 *   total     cuántos pasos hay que hacer (sin contar descansos ni lo opcional): el «3 de 12».
 *   series    cuántos Sets trae.
 *   simple    todos los Sets son de un ejercicio, sin vueltas, sin reloj ni lapsos: se dice «Ejercicio 2 de 4» y no «Serie 2 de 4».
 *   soloNotas el día son solo notas (cada una es un paso).
 *   truncado  el día pedía más de `MAX_PASOS` pasos y se cortó (dato malformado).
 *
 * Un descanso de verdad (tipo OFF sin ejercicios) o un día sin nada no tiene pasos. `day` es el día cuyos ejercicios se hacen:
 * quien arma la pantalla le pasa los del día que se repite cuando la sesión dice «repite el martes».
 */
export function pasosDeLaSesion(day, { deporte } = {}) {
  const filas = Array.isArray(day?.exercises) ? day.exercises.filter((e) => e && typeof e === 'object') : [];
  const hayEjercicios = filas.some((e) => !e.isNote);
  const salida = {
    deporte: deporte !== undefined ? deporte : deporteDelTipo(day), pasos: [], total: 0, series: 0, simple: true, soloNotas: false, truncado: false,
  };
  if (!hayEjercicios && (day?.cat === 'off' || !filas.some((e) => texto(e.text)))) return salida;

  const mete = (paso) => {
    if (salida.pasos.length >= MAX_PASOS) { salida.truncado = true; return false; }
    salida.pasos.push(paso);
    return true;
  };

  if (!hayEjercicios) {
    // Un día de puros renglones de nota: cada uno es un paso.
    salida.soloNotas = true;
    filas.forEach((ex, idx) => {
      if (!texto(ex.text)) return;
      mete({ clave: `n.${idx}`, tipo: 'nota', idx, nombre: texto(ex.text), intensidad: 'trabajo', termina: { por: 'boton' } });
    });
    return acaba(salida);
  }

  const grupos = groupIntoSets(filas);
  const sets = grupos.filter((g) => !g.isNote);
  salida.series = sets.length;
  let encabezado = [];
  let si = 0;

  grupos.forEach((g) => {
    if (g.isNote) {
      // Las notas entre ejercicios («CALENTAMIENTO») no son pasos: van de encabezado del paso que sigue.
      if (texto(g.ex.text)) encabezado.push(texto(g.ex.text));
      return;
    }
    si += 1;
    const miembros = g.exercises;
    const exs = miembros.map((m) => m.ex);
    const hayOtroSet = si < sets.length;
    const descansoSet = hayOtroSet ? lecturaDeDescanso(exs[exs.length - 1]?.descansoSet) : null;
    const enLaSerie = { serie: si, serieTag: setTag(exs.length), ejerciciosEnSerie: exs.length, encabezado: encabezado.join(' · ') };
    encabezado = [];

    const formato = formatoDeMiembros(exs);
    if (formato) {
      salida.simple = false;
      const total = segundosTotales(formato, exs.length);
      const clave = `r.${miembros[0].idx}`;
      mete({
        clave,
        tipo: 'reloj',
        ...enLaSerie,
        ejercicioEnSerie: 1,
        vuelta: 1,
        vueltas: 1,
        vueltasMin: 1,
        opcional: false,
        nombre: nombreDeFormato(formato),
        resumen: resumenDeFormato(formato, exs.length),
        formato,
        claveFormato: String(miembros[0].idx),
        miembros: miembros.map(({ ex, idx }) => ({ idx, nombre: nombreDe(ex), texto: textoMeta(ex) ?? '', carga: texto(ex.intensity) })),
        intensidad: 'trabajo',
        termina: total ? { por: 'tiempo', min: total, max: total, valor: total } : { por: 'boton' },
      });
      if (descansoSet) mete(pasoDeDescanso(descansoSet, 'sets', clave));
      return;
    }

    const rondas = rondasDelSet(exs[0]?.sets);
    const enLapsos = hayLapsos(exs);
    if (exs.length > 1 || rondas.max > 1 || enLapsos) salida.simple = false;

    for (let r = 1; r <= rondas.max; r += 1) {
      miembros.forEach(({ ex, idx }, e) => {
        const cadaVuelta = enLapsos ? null : vueltasDe(ex);
        const delaVuelta = cadaVuelta ? ejercicioDeVuelta(ex, cadaVuelta[r - 1] ?? cadaVuelta[cadaVuelta.length - 1]) : ex;
        const lapsos = enLapsos ? (lapsosDe(ex) ?? [lapsoDeLinea(ex)]) : [null];
        lapsos.forEach((lapso, k) => {
          const ef = lapso ? comoEjercicio(ex, lapso) : delaVuelta;
          const clave = `${idx}.${r}.${k}`;
          const ultimoDelSet = r === rondas.max && e === exs.length - 1 && k === lapsos.length - 1;
          const nota = texto(ex.notes);
          const cue = texto(ex.cue);
          mete({
            clave,
            tipo: 'ejercicio',
            ...enLaSerie,
            ejercicioEnSerie: e + 1,
            vuelta: r,
            vueltas: rondas.max,
            vueltasMin: rondas.min,
            opcional: r > rondas.min,
            lapso: k + 1,
            lapsos: lapsos.length,
            idx,
            nombre: nombreDe(ex),
            ...(nota ? { nota } : null),
            ...(cue ? { cue } : null),
            porLado: leeCantidad(ef).porLado,
            texto: textoMeta(ef) ?? '',
            termina: terminaDe(ef),
            meta: metaDe(ef),
            intensidad: 'trabajo',
          });
          // Qué descanso viene después: el del Set entero al acabarlo; si no, el del lapso o el del ejercicio.
          let descanso = null;
          if (ultimoDelSet) {
            if (descansoSet) descanso = { lectura: descansoSet, entre: 'sets' };
          } else {
            const lectura = lecturaDeDescanso(lapso ? lapso.descanso : ex.descanso);
            if (lectura) {
              const finDeVuelta = e === exs.length - 1 && k === lapsos.length - 1;
              descanso = { lectura, entre: finDeVuelta ? 'rondas' : (k === lapsos.length - 1 ? 'ejercicios' : 'lapsos') };
            }
          }
          if (descanso) mete(pasoDeDescanso(descanso.lectura, descanso.entre, clave));
        });
      });
    }
  });

  return acaba(salida);
}

// Les pone su lugar en la lista (`i`), su número entre los que no son descanso (`n`) y cuenta los que hay que hacer.
function acaba(plan) {
  let n = 0;
  plan.pasos.forEach((p, i) => {
    p.i = i;
    if (p.tipo !== 'descanso') {
      n += 1;
      p.n = n;
      if (!p.opcional) plan.total += 1;
    }
  });
  return plan;
}

/* ------------------------------------------------------------------ */
/* El avance                                                           */
/* ------------------------------------------------------------------ */

const hora = (x) => (Number.isFinite(x) && x >= 0 ? x : null);

/** El avance guardado, limpio: lo que llega de la base (o de otro dispositivo, o de nada) nunca debe poder romper la pantalla. */
export function leeAvance(entreno) {
  const e = esObjeto(entreno) ? entreno : {};
  const marcas = (x) => {
    const salida = {};
    if (!esObjeto(x)) return salida;
    Object.entries(x).forEach(([k, v]) => { if (esObjeto(v) && hora(v.t) !== null) salida[k] = v; });
    return salida;
  };
  const extra = {};
  if (esObjeto(e.extra)) Object.entries(e.extra).forEach(([k, v]) => { if (Number.isFinite(v) && v > 0) extra[k] = v; });
  return { inicio: hora(e.inicio), fin: hora(e.fin), hechos: marcas(e.hechos), saltados: marcas(e.saltados), extra };
}

// Lo que se guarda en `sesión.entreno`: sin llaves vacías en `null`, que es lo que la base espera.
const aGuardar = (av) => ({
  v: VERSION,
  ...(av.inicio !== null ? { inicio: av.inicio } : null),
  ...(av.fin !== null ? { fin: av.fin } : null),
  hechos: av.hechos,
  saltados: av.saltados,
  extra: av.extra,
});

const nombreCorto = (p) => String(p.nombre ?? '').slice(0, 40);

// La marca de un paso, o `null` si no tiene (o es de otro ejercicio que estuvo en ese lugar: el nombre no coincide).
function marcaDe(av, paso) {
  const hecho = av.hechos[paso.clave];
  const marca = hecho ?? av.saltados[paso.clave];
  if (!marca) return null;
  if (paso.tipo !== 'descanso' && marca.n !== undefined && marca.n !== nombreCorto(paso)) return null;
  return { ...marca, estado: hecho ? 'hecho' : 'saltado' };
}

// El primer paso sin marca: `i` es -1 y `actual` null cuando ya no queda ninguno.
function posicionDe(plan, av) {
  const pasos = plan?.pasos ?? [];
  const i = pasos.findIndex((p) => !marcaDe(av, p));
  return { i, actual: i === -1 ? null : pasos[i] };
}

// Solo estos datos pueden acompañar a un «Listo» cuando el atleta cambió lo planeado: un texto corto o un número.
function limpiaReal(real) {
  if (!esObjeto(real)) return {};
  const salida = {};
  ['reps', 'kg'].forEach((k) => {
    const v = texto(real[k]);
    if (v) salida[k] = v.slice(0, 12);
  });
  const seg = Number(real.seg);
  if (real.seg !== undefined && real.seg !== null && Number.isFinite(seg) && seg >= 0) salida.seg = Math.round(seg);
  return salida;
}

/** El entreno arrancó: guarda la hora de inicio (una sola vez). */
export function iniciaEntreno(entreno, ahora) {
  const av = leeAvance(entreno);
  return aGuardar({ ...av, inicio: av.inicio ?? ahora });
}

/**
 * «Listo» en el paso actual (o «Seguir», si es un descanso). Da por hecho lo planeado; `real` solo viaja si el atleta lo
 * CAMBIÓ: `{ reps, kg, seg }`. Si todavía no se había iniciado, esto también inicia.
 */
export function marcaListo(plan, entreno, ahora, real) {
  const av = leeAvance(entreno);
  const inicio = av.inicio ?? ahora;
  const { actual } = posicionDe(plan, av);
  if (!actual) return aGuardar({ ...av, inicio });
  const dato = { t: ahora, ...(actual.tipo === 'descanso' ? null : { n: nombreCorto(actual) }), ...limpiaReal(real) };
  return aGuardar({ ...av, inicio, hechos: { ...av.hechos, [actual.clave]: dato } });
}

/** «Saltar» el paso actual: queda marcado como saltado (un descanso que se salta cuenta como terminado). */
export function saltaPaso(plan, entreno, ahora) {
  const av = leeAvance(entreno);
  const inicio = av.inicio ?? ahora;
  const { actual } = posicionDe(plan, av);
  if (!actual) return aGuardar({ ...av, inicio });
  if (actual.tipo === 'descanso') return aGuardar({ ...av, inicio, hechos: { ...av.hechos, [actual.clave]: { t: ahora } } });
  return aGuardar({ ...av, inicio, saltados: { ...av.saltados, [actual.clave]: { t: ahora, n: nombreCorto(actual) } } });
}

/**
 * «Anterior»: regresa al ejercicio de antes. Le quita la marca a ese paso y a los descansos que le siguieron. Reabre también un
 * entreno que ya estaba terminado.
 */
export function vuelveAtras(plan, entreno) {
  const av = leeAvance(entreno);
  const pasos = plan?.pasos ?? [];
  const { i } = posicionDe(plan, av);
  const tope = i === -1 ? pasos.length : i;
  let j = tope - 1;
  while (j >= 0 && pasos[j].tipo === 'descanso') j -= 1;
  if (j < 0) return aGuardar(av);
  const hechos = { ...av.hechos };
  const saltados = { ...av.saltados };
  const extra = { ...av.extra };
  for (let k = j; k < tope; k += 1) {
    delete hechos[pasos[k].clave];
    delete saltados[pasos[k].clave];
    delete extra[pasos[k].clave];
  }
  return aGuardar({ ...av, fin: null, hechos, saltados, extra });
}

/** «+30 s» en el descanso actual. Un descanso que solo dice texto no tiene cuenta, así que no se alarga. */
export function masDescanso(plan, entreno, seg = 30) {
  const av = leeAvance(entreno);
  const { actual } = posicionDe(plan, av);
  if (!actual || actual.tipo !== 'descanso' || actual.seg === null || !(seg > 0)) return aGuardar(av);
  return aGuardar({ ...av, extra: { ...av.extra, [actual.clave]: (av.extra[actual.clave] ?? 0) + Math.round(seg) } });
}

/** El atleta dio por terminado el entreno (aunque falten pasos). */
export function terminaEntreno(entreno, ahora) {
  const av = leeAvance(entreno);
  return aGuardar({ ...av, inicio: av.inicio ?? ahora, fin: av.fin ?? ahora });
}

/** Deshace el «terminado»: el entreno sigue donde iba. */
export function reabreEntreno(entreno) {
  return aGuardar({ ...leeAvance(entreno), fin: null });
}

/**
 * Lo que una pantalla (o un reloj) necesita saber AHORA, calculado del plan, el avance guardado y la hora:
 *
 *   estado        'sin' (no ha empezado) · 'curso' · 'fin' (el atleta lo dio por terminado)
 *   actual        el paso que toca, o `null` si ya no queda ninguno
 *   indice        su lugar en `plan.pasos` (-1 si no hay)
 *   siguiente     el próximo paso que NO es descanso (para «Sigue: …»), o `null`
 *   descansoDespues  si el paso actual va seguido de un descanso, ese paso
 *   descanso      si el paso actual ES un descanso: { paso, desde, extra, seg, fin, restan, vencido, pasado }
 *                 (`seg`, `fin` y `restan` son `null` si solo dice texto; `restan` baja de 0 al pasarse y `pasado` cuenta cuánto)
 *   hechos, saltados, total   cuántos pasos de los que hay que hacer van hechos o saltados, y cuántos son
 *   completo      no queda ningún paso (ni opcional)
 *   soloLoOpcional  ya se hizo todo lo que había que hacer y lo que queda es opcional («5-6 veces»)
 *   transcurrido  milisegundos desde que inició hasta ahora (o hasta que terminó); `null` si no ha iniciado
 *   puedeAnterior hay un ejercicio al cual regresar
 */
export function vistaDelEntreno(plan, entreno, ahora) {
  const av = leeAvance(entreno);
  const pasos = plan?.pasos ?? [];
  const marcas = pasos.map((p) => marcaDe(av, p));
  const i = marcas.findIndex((m) => !m);
  const actual = i === -1 ? null : pasos[i];

  let hechos = 0;
  let saltados = 0;
  let faltaAlgoRequerido = false;
  pasos.forEach((p, k) => {
    if (p.tipo === 'descanso' || p.opcional) return;
    if (marcas[k]?.estado === 'hecho') hechos += 1;
    else if (marcas[k]?.estado === 'saltado') saltados += 1;
    else faltaAlgoRequerido = true;
  });

  const despues = i === -1 ? [] : pasos.slice(i + 1);
  let descanso = null;
  if (actual?.tipo === 'descanso') {
    const desde = marcas[i - 1]?.t ?? av.inicio ?? ahora;
    const extra = av.extra[actual.clave] ?? 0;
    const seg = actual.seg === null ? null : actual.seg + extra;
    const fin = seg === null ? null : desde + seg * 1000;
    const restan = fin === null ? null : Math.ceil((fin - ahora) / 1000);
    descanso = { paso: actual, desde, extra, seg, fin, restan, vencido: restan !== null && restan <= 0, pasado: restan !== null && restan < 0 ? -restan : 0 };
  }

  let estado = 'sin';
  if (av.fin !== null) estado = 'fin';
  else if (av.inicio !== null || hechos + saltados > 0) estado = 'curso';

  return {
    estado,
    actual,
    indice: i,
    siguiente: despues.find((p) => p.tipo !== 'descanso') ?? null,
    descansoDespues: actual && actual.tipo !== 'descanso' && despues[0]?.tipo === 'descanso' ? despues[0] : null,
    descanso,
    hechos,
    saltados,
    total: plan?.total ?? 0,
    completo: actual === null && pasos.length > 0,
    soloLoOpcional: actual !== null && !faltaAlgoRequerido && pasos.length > 0,
    transcurrido: av.inicio === null ? null : Math.max(0, (av.fin ?? ahora) - av.inicio),
    puedeAnterior: pasos.slice(0, i === -1 ? pasos.length : i).some((p) => p.tipo !== 'descanso'),
  };
}
