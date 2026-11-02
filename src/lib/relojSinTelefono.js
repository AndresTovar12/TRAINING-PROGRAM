/* EL APPLE WATCH SIN EL IPHONE (1 nov 2026, encargo «inicio, sin conexión y reloj», parte 3). Lo puro: sin red, sin pantalla, sin `@/`, para probarse en Node
   (`scripts/prueba-reloj-sin-iphone.mjs`). La parte con Supabase y el puente nativo es `lib/relojSinTelefonoApi.js`; la app del reloj, `ios/App/TrainingLabWatch`.

   LA META: la persona deja el iPhone en el carro, entrena con el reloj y nada se pierde ni llega dos veces.

   1. DEL IPHONE AL RELOJ (`planParaElReloj`, parte 3.1). Las sesiones de hoy y de los 2 días siguientes (nombre, de quién, su color, sus pasos con series, reps,
      kilos o libras, descansos y «por lado»), cuáles ya se hicieron, «Tus actividades» y el catálogo para «Ver todas». Va por `updateApplicationContext`, que
      llega aunque el reloj esté dormido, y el reloj lo guarda en disco: como trae 3 días, si el iPhone no se abrió esta mañana, el plan de hoy llegó ayer.
      Los pasos son los MISMOS de `pasosDeLaSesion` (`lib/entreno.js`), con sus claves (`0.1.0`, `d.0.1.0`…): lo que el reloj marca es el mismo avance que
      marca el iPhone (`sesión.entreno`), y se junta igual.

   2. DEL RELOJ AL IPHONE (`leeResultado`, `cosaDelReloj`, parte 3.4). Cada entreno terminado en el reloj llega con `transferUserInfo` (Apple lo guarda y lo
      entrega aunque el iPhone esté lejos, apagado o con la app cerrada). Trae su id (el UUID de su `HKWorkout` en Salud) y pasa a la cola del teléfono
      (`lib/colaDelTelefono.js`) con ese id: repetirlo no lo duplica. Tres modos:
        · 'sesion'    una sesión del plan hecha en el reloj: sus marcas entran a SU sesión (`aplicaSesionDelReloj`), y su pulso y su ruta se guardan como el
                      entreno que Salud habría traído (`crudoDelReloj`, `origen = 'healthkit'`): así la página del workout, los stickers y el coach lo ven igual.
        · 'libre'     un entreno libre hecho en el reloj: es un entreno libre más (`preparaLibreDelReloj`, el mismo tipo de la cola que el del iPhone).
        · 'acompana'  el iPhone guiaba y el reloj acompañó (como antes): solo su pulso, que llega al entreno del iPhone (`guardaImportacion` lo junta).

   3. QUE NADA LLEGUE DOS VECES (`saltaLosDelReloj`, parte 3.5). El reloj también guarda su entreno en Apple Salud, y el iPhone trae entrenos de Salud
      (`traeDelReloj`). Al traer de Salud se salta todo entreno cuyo UUID ya llegó del reloj, y todo el que la app del reloj guardó con su marca
      (`MARCA_DEL_RELOJ` en sus metadatos): ese llega SIEMPRE por el camino del reloj. Los de antes de esta versión no traen la marca y entran como antes. */
import { pasosDeLaSesion } from './entreno.js';
import { exDataTrasListo } from './entrenoDatos.js';
import { entrenoLibre, MINIMO_DE_SEGUNDOS } from './entrenoLibre.js';
import { preparaEntreno } from './metricas/construye.js';
import { DEPORTES } from './metricas/deportes.js';
import { sinNumerosDeLaRuta } from './rutaSilenciosa.js';
import { rutaParaGuardar } from './recorrido.js';
import { cargaPorPorcentaje } from './cargaPorcentaje.js';
import { aKilos, desdeKilos, normalizaUnidad } from './unidades.js';
import { GRUPOS_DE_ACTIVIDADES, propiasDe } from './actividades.js';
import { isLoadedExercise, sesionQueRepite, sinDuracion } from './training-utils.js';

export const VERSION_DEL_RELOJ = 1;
/** El id de la app del reloj (`ios/ci/agrega_extensiones.rb`): la «fuente» de lo que guarda en Salud. */
export const BUNDLE_DEL_RELOJ = 'com.traininglabapp.app.watchkitapp';
/** La llave de metadatos que la app del reloj le pone a cada entreno que guarda en Salud (su valor: el modo, 'reloj' o 'acompana'). */
export const MARCA_DEL_RELOJ = 'TrainingLab';
/** Los tipos de la cola del teléfono (ver `lib/tiposDeLaCola.js`). El entreno libre usa el de siempre (`TIPO_ENTRENO_LIBRE` de `lib/entrenoLibreApi.js`). */
export const TIPO_SESION_DEL_RELOJ = 'reloj-sesion';
export const TIPO_PULSO_DEL_RELOJ = 'reloj-pulso';
export const TIPO_LIBRE = 'entreno-libre';

/** Hoy y los 2 días siguientes. */
export const DIAS_EN_EL_RELOJ = 3;
/** Topes de sensatez: un día con 30 sesiones o una sesión con 2,000 pasos no cabe en la muñeca (ni en el contexto de WatchConnectivity). */
export const MAX_SESIONES_POR_DIA = 6;
export const MAX_PASOS_EN_EL_RELOJ = 150;
/** El contexto de WatchConnectivity no promete más de ~64 KB: el plan se queda bajo esto (si no, se aligeran los días de después). */
export const MAX_BYTES_DEL_PLAN = 48000;
/** Cuántos de «Tus actividades» viajan (`tusActividades`, máximo 6). */
export const MAX_ACTIVIDADES = 6;

const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const texto = (x, max = 60) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, max);
const numero = (x) => (typeof x === 'number' && Number.isFinite(x) ? x : null);
const entero = (x) => (numero(x) !== null ? Math.round(x) : null);

/* ------------------------------------------------------------------ */
/* 1. Del iPhone al reloj                                              */
/* ------------------------------------------------------------------ */

/**
 * Los kilos del plan para un paso, en la unidad del atleta: de su 1RM (si el plan dice «78 %») o un peso fijo. Igual que `kilosDe` de `EntrenoDelDia` (la
 * misma regla en el teléfono y en la muñeca). `{ valor, numero, aprox, kg }` (`kg` en kilos, como se guarda) o `null`. Los pacientes (`salud`) no tienen 1RM.
 */
export function kilosDelPaso(paso, ex, { oneRMs = {}, unidad = 'kg', salud = false } = {}) {
  if (!paso || paso.tipo !== 'ejercicio' || !paso.meta) return null;
  const u = normalizaUnidad(unidad);
  if (paso.meta.tipo === 'kg' && paso.meta.min > 0) {
    const valor = u === 'lb' ? Math.round(desdeKilos(paso.meta.min, 'lb') / 5) * 5 : paso.meta.min;
    return { valor, numero: valor, aprox: false, kg: String(paso.meta.min) };
  }
  if (paso.meta.tipo === 'pct' && !salud) {
    const c = cargaPorPorcentaje({ ...(ex ?? {}), intensity: paso.meta.texto }, oneRMs, u);
    if (c && !c.falta) return { valor: c.desde === c.hasta ? c.desde : `${c.desde}–${c.hasta}`, numero: c.desde, aprox: true, kg: String(aKilos(c.desde, u)) };
  }
  return null;
}

// Lo que el reloj necesita para anotar como el iPhone (`exDataTrasListo`): cómo termina el paso, sin el resto de `termina`.
const terminaCorto = (t) => (esObjeto(t) ? {
  por: t.por ?? 'boton', ...(t.cantidad != null ? { cantidad: String(t.cantidad) } : null), ...(t.unidad ? { unidad: t.unidad } : null),
  ...(numero(t.valor) !== null ? { valor: t.valor } : null), ...(numero(t.min) !== null ? { min: t.min } : null),
} : { por: 'boton' });

/**
 * Un paso de `pasosDeLaSesion`, como lo lee el reloj (`PasoDelReloj` en `PlanDelReloj.swift`). Llaves cortas: viaja en el contexto de WatchConnectivity.
 *   c clave · t 'e' ejercicio | 'd' descanso | 'r' Set con reloj | 'n' nota · n nombre · i idx del ejercicio · v/vs vuelta de vueltas · op opcional
 *   lp lapsos · s serie (el Set) · tm cómo termina · reps la cantidad planeada como la escribió el coach («8», «8-10») · u su unidad · rv su número
 *   kg los kilos del plan (texto, como se guardan) · pv el peso en la unidad del atleta (lo que se ve y se cambia) · aprox sale de su 1RM · peso lleva peso
 *   lado «por lado» · seg segundos (de un descanso, o de un paso con tiempo) · texto lo que dice un descanso sin cuenta o el resumen de un Set con reloj
 *   m metros que pide un paso por distancia
 */
export function pasoParaElReloj(p, { kilos = null, conPeso = false } = {}) {
  const base = { c: p.clave, n: texto(p.nombre, 40) || 'Paso' };
  if (p.tipo === 'descanso') {
    return { ...base, t: 'd', n: 'Descanso', ...(p.seg ? { seg: Math.round(p.seg) } : { texto: texto(p.texto, 60) }) };
  }
  if (p.tipo === 'nota') return { ...base, t: 'n', ...(p.idx !== undefined ? { i: p.idx } : null) };
  if (p.tipo === 'reloj') {
    const seg = p.termina?.por === 'tiempo' ? entero(p.termina.valor ?? p.termina.min) : null;
    return { ...base, t: 'r', i: Number(p.claveFormato ?? 0), texto: texto(p.resumen, 60), ...(seg ? { seg } : null) };
  }
  const tm = terminaCorto(p.termina);
  const rv = tm.unidad === 'cluster' ? numero(tm.valor) : numero(parseFloat(String(tm.cantidad ?? '').replace(',', '.')));
  return {
    ...base,
    t: 'e',
    i: p.idx,
    v: p.vuelta ?? 1,
    vs: p.vueltas ?? 1,
    ...(p.opcional ? { op: true } : null),
    ...(p.lapsos > 1 ? { lp: p.lapsos } : null),
    s: p.serie ?? 1,
    tm,
    ...(tm.cantidad ? { reps: texto(tm.cantidad, 12), u: tm.unidad ?? 'reps' } : null),
    ...(rv !== null ? { rv } : null),
    ...(kilos ? { kg: kilos.kg, pv: Number(kilos.numero), ...(kilos.aprox ? { aprox: true } : null) } : null),
    ...(conPeso ? { peso: true } : null),
    ...(p.porLado ? { lado: true } : null),
    ...(tm.por === 'tiempo' && rv !== null ? { seg: Math.round(tm.unidad === 'min' ? rv * 60 : rv) } : null),
    ...(tm.por === 'distancia' && numero(tm.min) !== null ? { m: tm.min } : null),
  };
}

/**
 * El día que se entrena de verdad: si la sesión dice «repite el martes», los ejercicios del martes (igual que la pantalla del día y `diaDeLaSesion`).
 * `entrada`: lo de `entradasDeHoy` (`{ day, week, dayIdx }`).
 */
export function diaParaEntrenar(entrada) {
  const repite = entrada?.week ? sesionQueRepite(entrada.week, entrada.dayIdx) : null;
  return repite ? { ...entrada.day, exercises: repite.day.exercises } : entrada?.day ?? null;
}

/** Los pasos de una sesión para el reloj (con sus kilos y si llevan peso). `[]` si no hay nada que entrenar o son demasiados (el reloj la corre como cronómetro). */
export function pasosParaElReloj(dia, { oneRMs = {}, unidad = 'kg', salud = false } = {}) {
  let plan;
  try { plan = pasosDeLaSesion(dia); } catch { return []; }
  if (!plan?.pasos?.length || plan.truncado || plan.pasos.length > MAX_PASOS_EN_EL_RELOJ) return [];
  const ejercicios = Array.isArray(dia?.exercises) ? dia.exercises : [];
  return plan.pasos.map((p) => {
    const ex = p.idx !== undefined ? ejercicios[p.idx] : null;
    return pasoParaElReloj(p, { kilos: kilosDelPaso(p, ex, { oneRMs, unidad, salud }), conPeso: p.tipo === 'ejercicio' && !!ex && isLoadedExercise(ex) });
  });
}

/** «70 min» (de `minutosDelNombre`) → 70; lo que no es un número, `null`. */
const minutosDe = (x) => {
  const n = parseInt(String(x ?? ''), 10);
  return Number.isFinite(n) && n > 0 && n < 600 ? n : null;
};

/**
 * Una sesión del día, como la lee el reloj (`SesionDelReloj`). `s`: `{ almacen, llave, nombre, de, rol, color, minutos, dia, hecha, deporte }`:
 *   almacen  dónde vive (`wr:sessions`, o `wr:sessions@<profesional>`) · llave  su llave en ese almacén (la estable, en lo pegado)
 *   de       el nombre corto de quien la puso («Carlos») · rol 'coach' | 'fisio' · color el de su programa · dia  el día que se entrena (`diaParaEntrenar`)
 */
export function sesionParaElReloj(s, opciones = {}) {
  const pasos = pasosParaElReloj(s.dia, opciones);
  return {
    id: `${s.almacen}|${s.llave}`,
    almacen: s.almacen,
    llave: s.llave,
    nombre: texto(sinDuracion(s.nombre ?? ''), 60) || texto(s.dia?.day, 20) || 'Sesión',
    ...(s.de ? { de: texto(s.de, 24) } : null),
    ...(s.rol ? { rol: s.rol } : null),
    ...(s.color ? { color: s.color } : null),
    ...(minutosDe(s.minutos) ? { min: minutosDe(s.minutos) } : null),
    ...(s.deporte ? { deporte: s.deporte } : null),
    hecha: !!s.hecha,
    ejercicios: new Set(pasos.filter((p) => p.t === 'e').map((p) => p.i)).size,
    pasos,
  };
}

/** Una actividad (del catálogo o propia) como la lee el reloj. */
export const actividadParaElReloj = (a) => ({
  id: a.id, nombre: texto(a.nombre, 20), icono: a.icono ?? 'etiqueta', color: a.color ?? '#7A8191', gps: !!a.gps, deporte: DEPORTES[a.deporte] ? a.deporte : 'otro',
  ...(a.propia ? { propia: true } : null),
});

/** «Ver todas» en el reloj: las propias primero (si hay) y luego el catálogo por grupos, el mismo del iPhone. Las actividades se crean solo en el iPhone. */
export function catalogoParaElReloj(propias = []) {
  const suyas = propiasDe(propias);
  return [
    ...(suyas.length ? [{ grupo: 'Tuyas', actividades: suyas.map(actividadParaElReloj) }] : []),
    ...GRUPOS_DE_ACTIVIDADES.map((g) => ({ grupo: g.grupo, actividades: g.actividades.map(actividadParaElReloj) })),
  ];
}

const bytes = (x) => new TextEncoder().encode(JSON.stringify(x)).length;

/**
 * EL PLAN QUE VIAJA AL RELOJ. `dias`: `[{ fecha: 'AAAA-MM-DD', sesiones: [lo de `sesionParaElReloj`] }]` (hoy primero). `actividades`: «Tus actividades».
 * `recorrido`: dijo que sí a «¿Guardamos tu recorrido?» (sin eso el reloj no sigue la ubicación en silencio). `sinPlan`: no tiene plan (el reloj ofrece
 * «Entreno libre» como lo principal, no «Tu plan de hoy no está en el reloj»).
 * Si no cabe (`MAX_BYTES_DEL_PLAN`), los días de después pierden sus pasos (se ven, pero se empiezan como cronómetro) y al final se quitan.
 */
export function planParaElReloj({ usuario = null, ahora = Date.now(), unidad = 'kg', sinPlan = false, recorrido = false, dias = [], actividades = [], catalogo = [] }) {
  const plan = {
    v: VERSION_DEL_RELOJ,
    ...(usuario ? { usuario } : null),
    enviadoEn: ahora,
    unidad: normalizaUnidad(unidad),
    ...(sinPlan ? { sinPlan: true } : null),
    recorrido: !!recorrido,
    dias: (dias ?? []).slice(0, DIAS_EN_EL_RELOJ).map((d) => ({ fecha: d.fecha, sesiones: (d.sesiones ?? []).slice(0, MAX_SESIONES_POR_DIA) })),
    actividades: (actividades ?? []).slice(0, MAX_ACTIVIDADES).map(actividadParaElReloj),
    catalogo,
  };
  for (let i = plan.dias.length - 1; i >= 1 && bytes(plan) > MAX_BYTES_DEL_PLAN; i -= 1) {
    plan.dias[i] = { ...plan.dias[i], sesiones: plan.dias[i].sesiones.map((s) => ({ ...s, pasos: [] })) };
  }
  while (plan.dias.length > 1 && bytes(plan) > MAX_BYTES_DEL_PLAN) plan.dias.pop();
  if (bytes(plan) > MAX_BYTES_DEL_PLAN) plan.catalogo = [];
  return plan;
}

/** Lo que dice si el plan cambió: todo menos la hora en que se mandó (al abrir la app se manda igual; mientras está abierta, solo si algo cambió). */
export const firmaDelPlan = (plan) => JSON.stringify({ ...plan, enviadoEn: 0 });

/** Las fechas (AAAA-MM-DD, en la hora de este teléfono) de hoy y de los días siguientes. */
export function fechasDelReloj(hoy = new Date(), n = DIAS_EN_EL_RELOJ) {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(hoy.getFullYear(), hoy.getMonth(), hoy.getDate() + i, 12);
    return { fecha: d, clave: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` };
  });
}

/* ------------------------------------------------------------------ */
/* 2. Del reloj al iPhone                                              */
/* ------------------------------------------------------------------ */

const MODOS = ['sesion', 'libre', 'acompana'];
const UUID = /^[0-9A-Fa-f]{8}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{4}-[0-9A-Fa-f]{12}$/;

// Las marcas que trae el reloj, limpias (la misma forma que `sesión.entreno.hechos`): lo que llega de otro aparato nunca debe poder romper la pantalla.
function marcasDe(x) {
  const salida = {};
  if (!esObjeto(x)) return salida;
  Object.entries(x).forEach(([k, m]) => {
    if (!esObjeto(m) || numero(m.t) === null || k.length > 40) return;
    const limpia = { t: m.t };
    if (typeof m.n === 'string') limpia.n = m.n.slice(0, 40);
    ['reps', 'kg'].forEach((c) => { if (m[c] != null && String(m[c]).trim()) limpia[c] = String(m[c]).trim().slice(0, 12); });
    if (entero(m.seg) !== null && m.seg >= 0) limpia.seg = entero(m.seg);
    if (entero(m.p) !== null && m.p > 0) limpia.p = entero(m.p);
    salida[k] = limpia;
  });
  return salida;
}

const pareja = (fila) => Array.isArray(fila) && fila.length >= 2 && fila.every((v) => v === null || numero(v) !== null);

/**
 * Lo que llegó del reloj (el texto de `transferUserInfo`, o ya abierto), revisado, o `null` si no se entiende (se queda guardado en el iPhone, no se tira).
 * Las horas en milisegundos; `pulso`: `[[segundo, latidos]]` y `ruta`: `[[segundo, lat, lon, alt, precisión]]`, contados desde `inicio`.
 */
export function leeResultado(crudo) {
  let r = crudo;
  if (typeof crudo === 'string') { try { r = JSON.parse(crudo); } catch { return null; } }
  if (!esObjeto(r) || r.v !== VERSION_DEL_RELOJ || typeof r.id !== 'string' || !UUID.test(r.id) || !MODOS.includes(r.modo)) return null;
  const inicio = numero(r.inicio);
  const fin = numero(r.fin);
  if (inicio === null || fin === null || fin < inicio) return null;
  const pulso = (Array.isArray(r.pulso) ? r.pulso : []).filter((f) => pareja(f) && f[0] >= 0 && f[1] > 30 && f[1] < 240).slice(0, 4000);
  const ruta = (Array.isArray(r.ruta) ? r.ruta : []).filter((f) => pareja(f) && f.length >= 3 && Math.abs(f[1]) <= 90 && Math.abs(f[2]) <= 180).slice(0, 4000);
  const salida = {
    v: VERSION_DEL_RELOJ,
    id: r.id.toUpperCase(),
    hk: typeof r.hk === 'string' && UUID.test(r.hk) ? r.hk.toUpperCase() : null,
    usuario: typeof r.usuario === 'string' && r.usuario.length > 10 ? r.usuario : null,
    modo: r.modo,
    deporte: typeof r.deporte === 'string' ? r.deporte.slice(0, 20) : null,
    inicio,
    fin,
    duracion: Math.max(1, Math.round(numero(r.duracion) ?? (fin - inicio) / 1000)),
    kcal: numero(r.kcal) > 0 ? Math.round(r.kcal) : null,
    fcMedia: entero(r.fcMedia) > 0 ? entero(r.fcMedia) : null,
    fcMax: entero(r.fcMax) > 0 ? entero(r.fcMax) : null,
    distancia: numero(r.distancia) > 0 ? Math.round(r.distancia) : null,
    pulso,
    ruta,
    rutaSilenciosa: r.rutaSilenciosa === true,
    bateria: esObjeto(r.bateria) ? {
      inicio: numero(r.bateria.inicio), fin: numero(r.bateria.fin), ubicacion: ['silencio', 'gps', 'no'].includes(r.bateria.ubicacion) ? r.bateria.ubicacion : 'no',
    } : null,
  };
  if (r.modo === 'sesion') {
    const s = r.sesion;
    if (!esObjeto(s) || typeof s.almacen !== 'string' || !/^wr:sessions(@[\w-]+)?$/.test(s.almacen) || typeof s.llave !== 'string' || !s.llave) return null;
    const e = esObjeto(s.entreno) ? s.entreno : {};
    salida.sesion = {
      almacen: s.almacen,
      llave: s.llave.slice(0, 80),
      nombre: texto(s.nombre, 60),
      de: s.de ? texto(s.de, 24) : null,
      otraVez: s.otraVez === true,
      entreno: {
        v: 1, nombre: texto(e.nombre ?? s.nombre, 60) || null, inicio: numero(e.inicio) ?? inicio, fin: numero(e.fin) ?? fin,
        hechos: marcasDe(e.hechos), saltados: marcasDe(e.saltados),
        extra: Object.fromEntries(Object.entries(esObjeto(e.extra) ? e.extra : {}).filter(([, v]) => entero(v) > 0).map(([k, v]) => [k, entero(v)])),
      },
      pasos: (Array.isArray(s.pasos) ? s.pasos : []).filter((p) => esObjeto(p) && typeof p.c === 'string' && typeof p.t === 'string').slice(0, MAX_PASOS_EN_EL_RELOJ),
    };
  }
  if (r.modo === 'libre') {
    const a = esObjeto(r.actividad) ? r.actividad : {};
    salida.actividad = {
      id: typeof a.id === 'string' ? a.id.slice(0, 40) : 'otro', nombre: texto(a.nombre, 40) || 'Entreno', deporte: DEPORTES[a.deporte] ? a.deporte : 'otro', gps: a.gps === true,
    };
  }
  return salida;
}

const segundosDe = (r) => r.duracion;

// Las muestras del reloj como las de un archivo (`{ t, fc }` y `{ t, lat, lon, alt }`), juntas en el tiempo. La ruta en silencio solo si se pide. Un punto con
// más de 50 m de error no se usa (dibuja picos que no corriste) y la altitud que el reloj no supo viene como -1000.
function muestrasDe(r, { conRuta = true } = {}) {
  const pulso = r.pulso.map(([t, fc]) => ({ t, fc: Math.round(fc) }));
  const ruta = conRuta ? r.ruta.filter((f) => !(f[4] > 50)).map(([t, lat, lon, alt]) => ({ t, lat, lon, ...(numero(alt) !== null && alt > -500 ? { alt } : null) })) : [];
  return [...pulso, ...ruta].sort((a, b) => a.t - b.t);
}

const resumenDelPulso = (r) => {
  const fcs = r.pulso.map((f) => f[1]);
  return {
    fc_media: r.fcMedia ?? (fcs.length ? Math.round(fcs.reduce((a, b) => a + b, 0) / fcs.length) : null),
    fc_max: r.fcMax ?? (fcs.length ? Math.round(Math.max(...fcs)) : null),
    fc_min: fcs.length ? Math.round(Math.min(...fcs)) : null,
  };
};

// La batería del reloj en ese entreno (para medir cuánto gasta la ubicación en silencio, parte 3.3): se guarda con el entreno.
const bateriaDe = (r) => (r.bateria && r.bateria.inicio !== null && r.bateria.fin !== null
  ? { bateria_reloj: { inicio: r.bateria.inicio, fin: r.bateria.fin, minutos: Math.round(r.duracion / 60), ubicacion: r.bateria.ubicacion } }
  : null);

/**
 * EL ENTRENO DEL RELOJ COMO LO HABRÍA TRAÍDO SALUD (lo mismo que `entrenoDelReloj` de `lib/metricas/leeHealthKit.js` con su `HKWorkout`), para `guardaImportacion`:
 * la fila se guarda con el id del reloj (`idDeLaBase`), `origen = 'healthkit'` y `pulso_de = 'apple_watch'`. Si el iPhone tenía ya ese entreno (el que guió con
 * el reloj puesto), `guardaImportacion` no hace otro: le pone el pulso. `deporte`: el de la sesión del plan, si se sabe.
 */
export function crudoDelReloj(r, { deporte = null, llego = false } = {}) {
  const d = DEPORTES[deporte] ? deporte : DEPORTES[r.deporte] ? r.deporte : 'otro';
  return {
    idDeLaBase: r.id,
    formato: 'healthkit', deporte: d, deporte_original: null, titulo: null, dispositivo: 'Apple Watch',
    inicio: r.inicio, fin: r.fin, desfase_min: -new Date(r.inicio).getTimezoneOffset(), duracion_s: segundosDe(r), movimiento_s: null,
    distancia_m: r.distancia, kcal_activas: r.kcal,
    resumen: { ...resumenDelPulso(r), potencia_media: null, desnivel_pos_m: null },
    ruta_ref: null,
    muestras: muestrasDe(r, { conRuta: !r.rutaSilenciosa }),
    archivo: 'Apple Watch',
    metricas: { pulso_de: 'apple_watch', ...(llego ? { llego_del_reloj: true } : null), ...bateriaDe(r) },
  };
}

/**
 * UN ENTRENO LIBRE HECHO EN EL RELOJ, listo para la cola como cualquier entreno libre (`{ prep, conRuta, desfaseMin }`, lo mismo que `preparaEntrenoLibre`):
 * la actividad que eligió, el tiempo sin pausas, la distancia del GPS del reloj (solo si la actividad lleva mapa), su pulso y sus calorías. La ruta en silencio
 * (una actividad sin mapa) solo deja la línea: nunca distancia ni ritmo (`sinNumerosDeLaRuta`).
 */
export function preparaLibreDelReloj(r) {
  const a = r.actividad ?? { id: 'otro', nombre: 'Entreno', deporte: 'otro', gps: false };
  const base = entrenoLibre({ deporte: a.deporte, inicioMs: r.inicio, duracionS: segundosDe(r), distanciaM: a.gps ? r.distancia : null, titulo: a.nombre, llevaDistancia: a.gps });
  const muestras = muestrasDe(r);
  const conRuta = muestras.length >= 2;
  let prep = conRuta ? preparaEntreno({ ...base, muestras }) : base;
  if (conRuta && (r.rutaSilenciosa || !a.gps)) prep = sinNumerosDeLaRuta(prep);
  const pulso = resumenDelPulso(r);
  prep = {
    ...prep,
    fin: r.fin,
    formato: 'apple_watch',
    dispositivo: 'Apple Watch',
    kcal_activas: r.kcal,
    ...(pulso.fc_media ? { resumen: { ...(prep.resumen ?? {}), ...pulso } } : null),
    metricas: { ...(prep.metricas ?? {}), ...(pulso.fc_media ? { pulso_de: 'apple_watch' } : null), llego_del_reloj: true, ...bateriaDe(r) },
  };
  return { prep, conRuta, desfaseMin: -new Date(r.inicio).getTimezoneOffset(), titulo: base.titulo };
}

/** ¿Trae algo que vaya a `actividades` (pulso, ruta, calorías)? Una sesión hecha sin permiso de Salud en el reloj solo trae sus series. */
export const traeMedidas = (r) => r.pulso.length > 0 || r.ruta.length >= 2 || r.kcal > 0;

/**
 * Lo que entra a la cola del teléfono: `{ id, tipo, usuario, creadoEn, datos }`. `null` si no se sabe de quién es (nadie ha entrado en este iPhone: espera
 * guardado en el plugin). `{ descarta: true }` si es un entreno libre de menos de 30 s (en el iPhone tampoco se guarda: se tocó «Terminar» sin querer).
 * `usuario`: de quién es el plan que tenía el reloj; si no lo sabía, la cuenta que entró en este iPhone. `datos.titulo` lo nombra en Mi perfil.
 */
export function cosaDelReloj(r, usuarioDeAqui = null, { tipoLibre = TIPO_LIBRE } = {}) {
  if (r.modo === 'libre' && r.duracion < MINIMO_DE_SEGUNDOS) return { descarta: true };
  const usuario = r.usuario ?? usuarioDeAqui;
  if (!usuario) return null;
  const comun = { id: r.id, usuario, creadoEn: r.fin };
  if (r.modo === 'libre') return { ...comun, tipo: tipoLibre, datos: { ...preparaLibreDelReloj(r), delReloj: true } };
  if (r.modo === 'sesion') return { ...comun, tipo: TIPO_SESION_DEL_RELOJ, datos: { ...r, titulo: r.sesion.nombre || 'Sesión del reloj' } };
  return { ...comun, tipo: TIPO_PULSO_DEL_RELOJ, datos: { ...r, titulo: 'Tu pulso del Apple Watch' } };
}

// El paso del reloj, otra vez como un paso de `pasosDeLaSesion` (lo que necesita `exDataTrasListo`).
const comoPasoDelPlan = (p) => ({
  tipo: 'ejercicio', clave: p.c, idx: p.i, vuelta: p.v ?? 1, vueltas: p.vs ?? 1, lapsos: p.lp ?? 1, termina: esObjeto(p.tm) ? p.tm : { por: 'boton' },
});

/**
 * UNA SESIÓN DEL PLAN HECHA EN EL RELOJ, puesta en el estado del atleta como si se hubiera hecho en el iPhone: su avance (`entreno`, con las mismas claves y
 * marcas), lo anotado de cada ejercicio (`exercises[idx]`, con `exDataTrasListo`: el progreso, los récords y la IA leen lo mismo), la ruta si la hubo,
 * `completed` y `completedAt`, y `delReloj` (de dónde vino: la marca «Llegó de tu Apple Watch» de Home).
 *   · Se aplica UNA vez: si ya está (`delReloj.id`, aquí o en `anteriores`), no cambia nada (la cola puede reintentarlo).
 *   · Si la sesión ya estaba hecha (en el iPhone, o en el reloj otra vez: «Otra vez»), lo de antes pasa a `anteriores` y lo del reloj es la vez nueva.
 *   · Si estaba a medias en el iPhone, se juntan: cada paso con su marca (la del reloj gana en el mismo paso).
 *   · Lo anotado sale de los pasos que tenía el reloj (la versión del plan con que se entrenó, parte 3.6).
 */
export function aplicaSesionDelReloj(store, r) {
  const s = r?.sesion;
  if (!s?.almacen || !s?.llave) return store;
  const registros = esObjeto(store?.[s.almacen]) ? store[s.almacen] : {};
  const antes = esObjeto(registros[s.llave]) ? registros[s.llave] : {};
  const yaEsta = antes.delReloj?.id === r.id || (Array.isArray(antes.anteriores) && antes.anteriores.some((a) => a?.delReloj?.id === r.id));
  if (yaEsta) return store;
  const hechaAntes = !!(antes.completed || antes.completedAt);
  // Hecha antes: lo de esa vez se archiva (con su `delReloj`, si vino del reloj) y la sesión queda en blanco para la vez nueva.
  const base = hechaAntes ? archivaYLimpia(antes) : antes;
  const previo = esObjeto(base.entreno) ? base.entreno : {};
  const hechos = { ...(esObjeto(previo.hechos) ? previo.hechos : {}), ...s.entreno.hechos };
  const saltados = Object.fromEntries(Object.entries({ ...(esObjeto(previo.saltados) ? previo.saltados : {}), ...s.entreno.saltados }).filter(([k]) => !hechos[k]));
  const inicio = Math.min(...[previo.inicio, s.entreno.inicio, r.inicio].filter((x) => numero(x) !== null));
  const entreno = {
    v: 1,
    ...(previo.nombre || s.entreno.nombre ? { nombre: previo.nombre || s.entreno.nombre } : null),
    inicio,
    fin: s.entreno.fin ?? r.fin,
    hechos,
    saltados,
    extra: { ...(esObjeto(previo.extra) ? previo.extra : {}), ...s.entreno.extra },
    empezados: esObjeto(previo.empezados) ? previo.empezados : {},
  };
  let exercises = esObjeto(base.exercises) ? { ...base.exercises } : {};
  s.pasos.forEach((p) => {
    if (p.t !== 'e' || !Number.isInteger(p.i)) return;
    const marca = s.entreno.hechos[p.c];
    if (!marca) return;
    const real = { ...(marca.reps ? { reps: marca.reps } : null), ...(marca.kg ? { kg: marca.kg } : null) };
    const dato = exDataTrasListo({ paso: comoPasoDelPlan(p), exData: exercises[p.i], kgPlaneados: p.kg ?? null, conPeso: !!p.peso, real: Object.keys(real).length ? real : undefined });
    if (dato) exercises = { ...exercises, [p.i]: dato };
  });
  // La línea del recorrido (la del GPS o la de la ubicación en silencio), en la forma de siempre (`registro.ruta`): la usan los stickers de la sesión.
  const ruta = rutaParaGuardar(r.ruta.filter((f) => !(f[4] > 50)).map(([t, lat, lon]) => ({ t, lat, lon })));
  const registro = {
    ...base,
    entreno,
    exercises,
    ...(ruta ? { ruta } : null),
    completed: true,
    completedAt: new Date(r.fin).toISOString(),
    delReloj: { id: r.id, en: r.fin, ...(r.hk ? { hk: r.hk } : null) },
  };
  return { ...store, [s.almacen]: { ...registros, [s.llave]: registro } };
}

// `sesionEnBlanco` + `archivaLoHecho` de `lib/entreno.js`, pero el archivo de esa vez también lleva su `delReloj`: así repetirla desde la cola nunca la aplica dos veces.
function archivaYLimpia(registro) {
  const { exercises: _e, formatos: _f, ruta: _r, entreno: _en, delReloj: _d, ...resto } = registro;
  void _e; void _f; void _r; void _en; void _d;
  const huella = { completedAt: registro.completedAt ?? null };
  ['entreno', 'exercises', 'formatos', 'ruta', 'delReloj'].forEach((k) => { if (registro[k]) huella[k] = registro[k]; });
  return { ...resto, completed: false, completedAt: null, anteriores: [...(Array.isArray(registro.anteriores) ? registro.anteriores : []), huella].slice(-20) };
}

/* ------------------------------------------------------------------ */
/* 3. Que nada llegue dos veces                                        */
/* ------------------------------------------------------------------ */

/** ¿Este entreno de Salud (lo de `queryWorkouts`) lo guardó la app del reloj con su marca? Ese llega por el camino del reloj, no por Salud. */
export const esDelRelojDeTrainingLab = (w) => !!w && String(w.sourceId ?? '').startsWith('com.traininglabapp.app') && !!w.metadata?.[MARCA_DEL_RELOJ];

/**
 * LO QUE SE TRAE DE SALUD, SIN LO QUE YA LLEGÓ DEL RELOJ (parte 3.5): fuera todo entreno cuyo UUID (`platformId`) ya llegó del reloj (`llegados`) y todo el
 * que la app del reloj guardó con su marca. Lo de otras apps (Strava, Garmin, la app Entreno de Apple) y lo de antes de esta versión entra como siempre.
 */
export function saltaLosDelReloj(workouts, llegados = new Set()) {
  const ya = llegados instanceof Set ? llegados : new Set(llegados ?? []);
  return (workouts ?? []).filter((w) => !(w?.platformId && ya.has(String(w.platformId).toUpperCase())) && !esDelRelojDeTrainingLab(w));
}

/** Los UUID que ya llegaron del reloj, con el nuevo al final (sin repetir), hasta `max`: lo que se guarda en el teléfono. */
export const conLlegado = (lista, uuid, max = 300) => {
  const u = String(uuid ?? '').toUpperCase();
  if (!UUID.test(u)) return lista ?? [];
  return [...(lista ?? []).filter((x) => x !== u), u].slice(-max);
};

/** ¿Este entreno de «Tus entrenos» llegó del reloj sin el iPhone? (la marca «Llegó de tu Apple Watch»). `e`: lo de `mezclaEntrenos`. */
export const llegoDelReloj = (e) => !!(e?.actividad?.metricas?.llego_del_reloj || e?.plan?.s?.registro?.delReloj);

/** El entreno que hay en curso en el reloj (lo que el reloj publica en su contexto), o `null` si no hay o si es de hace más de 8 horas (el reloj se apagó a media sesión). */
export function enCursoDelReloj(estado, ahora = Date.now()) {
  const e = esObjeto(estado) ? estado.enCurso : null;
  if (!esObjeto(e) || numero(e.desde) === null || ahora - e.desde > 8 * 3600 * 1000 || e.desde - ahora > 10 * 60 * 1000) return null;
  return { id: typeof e.id === 'string' ? e.id : null, titulo: texto(e.titulo, 60) || 'Entreno', modo: e.modo === 'libre' ? 'libre' : 'sesion', sesion: typeof e.sesion === 'string' ? e.sesion : null, desde: e.desde };
}
