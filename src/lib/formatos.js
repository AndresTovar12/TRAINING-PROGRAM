/**
 * Los formatos de un Set: AMRAP, EMOM, Tabata, Fartlek…
 *
 * POR QUÉ NO ES UNA LISTA CERRADA. Andrés, 5 oct 2026: «AMRAP y EMOM solo fueron algunos
 * ejemplos, ¿qué tal que me faltan? ¿o cosas como fartlek?». Un formato no es un tipo de
 * bloque programado aparte: es una combinación de tres piezas, y lo que no esté en la lista
 * se arma con «Personalizado» sin tocar el código.
 *
 *   1. EL RELOJ. Una lista de tramos («trabaja 2 min», «descansa 3 min») que se repite
 *      `vueltas` veces. Cada tramo dura un tiempo fijo (`seg`) o hasta que el atleta toca
 *      «Listo» (`seg: null`). `tope` corta todo cuando pasa ese tiempo.
 *   2. LOS EJERCICIOS. En cada tramo se hacen todos juntos, o uno distinto por tramo
 *      (`turnan`): circuitos, un EMOM que alterna, estaciones.
 *   3. LO QUE ANOTA el atleta al terminar (`anota`): rondas, tiempo, repeticiones…
 *
 * Los formatos con nombre (AMRAP, EMOM, Tabata…) son solo puntos de partida ya llenos:
 * guardan esas tres piezas y además su `id`, que decide cómo se ENSEÑAN en el editor (con
 * qué números) y cómo se NOMBRAN. El reloj del atleta no mira el `id`: corre lo que dicen
 * los tramos. Por eso un formato nuevo es una fila más en `FORMATOS`, no una pantalla más.
 *
 * Y por eso los números del editor no se guardan aparte: «20 s de trabajo» es
 * `pasos[0].seg`. Con una copia propia habría dos versiones de lo mismo, y se
 * desincronizarían (el mismo error que ya tuvo el cronómetro).
 *
 * DÓNDE SE GUARDA. En cada ejercicio del Set (`ex.formato`), igual que `sets`: un Set no es
 * un objeto aparte, se arma juntando los ejercicios que comparten `set`, así que lo que es
 * del Set entero se repite en todos sus miembros (ver `ponFormato` y `formatoDeMiembros`).
 *
 * Todo lo que llega de fuera —un plan copiado, la IA, la base— pasa por `limpiaFormato`
 * antes de usarse: un número raro o un tramo sin sentido no debe poder colgar el reloj.
 */

/* Topes de sensatez. No son reglas de entrenamiento: son lo que impide que un dato
   malformado (o un atajo de la IA) pida un reloj de 12 000 tramos. */
const MAX_PASOS = 60;
const MAX_VUELTAS = 200;
const MAX_SEG = 6 * 3600;
export const MAX_TRAMOS = 2000;

/** Lo que el atleta anota al terminar un Set con formato. */
export const ANOTA = [
  { id: 'rondas', etiqueta: 'Rondas y reps sueltas' },
  { id: 'tiempo', etiqueta: 'Tiempo' },
  { id: 'reps', etiqueta: 'Repeticiones' },
  { id: 'km', etiqueta: 'Distancia (km)' },
  { id: 'm', etiqueta: 'Distancia (m)' },
  { id: 'cal', etiqueta: 'Calorías' },
  { id: 'cumplido', etiqueta: 'Tramos completados' },
  { id: 'nada', etiqueta: 'Nada' },
];
const ANOTA_IDS = new Set(ANOTA.map((a) => a.id));

/* ------------------------------------------------------------------ */
/* Tiempos                                                             */
/* ------------------------------------------------------------------ */

/** Para leer: «20 s», «12 min», «1:30». */
export function textoDeTiempo(seg) {
  const s = Math.max(0, Math.round(Number(seg) || 0));
  if (s < 60) return `${s} s`;
  if (s % 60 === 0) return `${s / 60} min`;
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** Para el reloj: «00:20», «12:00», «1:05:00». */
export function relojTexto(seg) {
  const s = Math.max(0, Math.round(Number(seg) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  const dos = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${dos(m)}:${dos(r)}` : `${dos(m)}:${dos(r)}`;
}

/**
 * Los valores que de verdad se usan al poner un tiempo: 20, 30, 45 s, 1, 2, 3 min… Con el
 * + y el − de uno en uno, llegar de 30 s a 90 s eran 12 toques; por esta escala son tres.
 * No es un límite: lo que ya está guardado fuera de la escala se respeta, y el siguiente
 * toque lo lleva al valor de la escala más cercano en esa dirección.
 */
const ESCALA = [
  0, 5, 10, 15, 20, 25, 30, 40, 45, 50, 60, 75, 90, 105, 120, 150, 180, 210, 240, 270, 300,
  360, 420, 480, 540, 600, 720, 840, 900, 1080, 1200, 1500, 1800, 2400, 3000, 3600, 4500, 5400,
];

/** El tiempo siguiente (`dir` = 1) o anterior (`dir` = -1) de la escala, sin salirse de min/max. */
export function pasoDeEscala(valor, dir, min = 0, max = MAX_SEG) {
  const v = Number.isFinite(valor) ? valor : 0;
  const siguiente = dir > 0
    ? (ESCALA.find((x) => x > v) ?? max)
    : ([...ESCALA].reverse().find((x) => x < v) ?? min);
  return Math.min(max, Math.max(min, siguiente));
}

/* ------------------------------------------------------------------ */
/* Los formatos con nombre                                             */
/* ------------------------------------------------------------------ */

const paso = (tipo, seg, etiqueta) => ({ tipo, seg, ...(etiqueta ? { etiqueta } : {}) });
const conPaso = (f, i, cambios) => ({ ...f, pasos: f.pasos.map((p, k) => (k === i ? { ...p, ...cambios } : p)) });
const forma = (f, ...tipos) => f.pasos.length === tipos.length && tipos.every((t, i) => f.pasos[i].tipo === t);
const fijo = (p) => Number.isFinite(p?.seg) && p.seg > 0;

/**
 * Cada campo es un número que el editor enseña con su − y su +, y que sale de los tramos
 * (`lee`) y vuelve a ellos (`pon`). `escala: true` → sube por la escala de tiempos; con
 * `paso`, de ese tamaño. `frase` es la oración de la franja del editor, en orden.
 *
 * `encaja` dice si los tramos guardados todavía tienen la forma de este formato. Si no
 * (alguien los armó distinto, o los cambió la IA), el editor lo enseña como «Personalizado»
 * en vez de mentir con unos números que ya no son los de los tramos.
 */
export const FORMATOS = {
  amrap: {
    nombre: 'AMRAP',
    detalle: 'Máximas rondas en un tiempo',
    crea: () => ({ id: 'amrap', pasos: [paso('trabajo', 720)], vueltas: 1, tope: null, turnan: false, anota: 'rondas' }),
    encaja: (f) => forma(f, 'trabajo') && fijo(f.pasos[0]) && f.vueltas === 1,
    campos: {
      min: { tipo: 'tiempo', paso: 60, min: 60, max: 5400, lee: (f) => f.pasos[0].seg, pon: (f, v) => conPaso(f, 0, { seg: v }) },
    },
    frase: ['máximas rondas en', { campo: 'min' }],
  },
  emom: {
    nombre: 'EMOM',
    detalle: 'Cada X minutos, varias veces',
    crea: () => ({ id: 'emom', pasos: [paso('trabajo', 60)], vueltas: 10, tope: null, turnan: false, anota: 'cumplido' }),
    encaja: (f) => forma(f, 'trabajo') && fijo(f.pasos[0]),
    campos: {
      cada: { tipo: 'tiempo', paso: 30, min: 30, max: 600, lee: (f) => f.pasos[0].seg, pon: (f, v) => conPaso(f, 0, { seg: v }) },
      veces: { tipo: 'numero', min: 1, max: 99, lee: (f) => f.vueltas, pon: (f, v) => ({ ...f, vueltas: v }) },
    },
    frase: ['cada', { campo: 'cada' }, '·', { campo: 'veces' }, 'veces'],
  },
  tabata: {
    nombre: 'Tabata',
    detalle: 'Trabajo y descanso cortos',
    crea: () => ({ id: 'tabata', pasos: [paso('trabajo', 20), paso('descanso', 10)], vueltas: 8, tope: null, turnan: false, anota: 'reps' }),
    encaja: (f) => forma(f, 'trabajo', 'descanso') && fijo(f.pasos[0]) && Number.isFinite(f.pasos[1].seg),
    campos: {
      trab: { tipo: 'tiempo', min: 5, max: 300, lee: (f) => f.pasos[0].seg, pon: (f, v) => conPaso(f, 0, { seg: v }) },
      desc: { tipo: 'tiempo', min: 0, max: 300, lee: (f) => f.pasos[1].seg, pon: (f, v) => conPaso(f, 1, { seg: v }) },
      rondas: { tipo: 'numero', min: 1, max: 99, lee: (f) => f.vueltas, pon: (f, v) => ({ ...f, vueltas: v }) },
    },
    frase: [{ campo: 'trab' }, 'trabajo', { campo: 'desc' }, 'descanso', { campo: 'rondas' }, 'rondas'],
  },
  intervalos: {
    nombre: 'Intervalos',
    detalle: 'Trabajo y descanso a tu medida',
    crea: () => ({ id: 'intervalos', pasos: [paso('trabajo', 30), paso('descanso', 30)], vueltas: 10, tope: null, turnan: false, anota: 'nada' }),
    // El trabajo puede ser «hasta que toque Listo» (series de pista: 8 × 400 m).
    encaja: (f) => forma(f, 'trabajo', 'descanso') && (f.pasos[0].seg === null || fijo(f.pasos[0])) && Number.isFinite(f.pasos[1].seg),
    campos: {
      trab: { tipo: 'tiempo', min: 5, max: 600, lee: (f) => f.pasos[0].seg, pon: (f, v) => conPaso(f, 0, { seg: v }) },
      desc: { tipo: 'tiempo', min: 0, max: 600, lee: (f) => f.pasos[1].seg, pon: (f, v) => conPaso(f, 1, { seg: v }) },
      veces: { tipo: 'numero', min: 1, max: 99, lee: (f) => f.vueltas, pon: (f, v) => ({ ...f, vueltas: v }) },
    },
    frase: [{ campo: 'trab' }, 'trabajo', { campo: 'desc' }, 'descanso', { campo: 'veces' }, 'veces'],
  },
  fartlek: {
    nombre: 'Fartlek',
    detalle: 'Tramos fuertes y suaves',
    crea: () => ({
      id: 'fartlek', pasos: [paso('trabajo', 120, 'Fuerte'), paso('descanso', 180, 'Suave')], vueltas: 6, tope: null, turnan: false, anota: 'km',
    }),
    encaja: (f) => forma(f, 'trabajo', 'descanso') && fijo(f.pasos[0]) && fijo(f.pasos[1]),
    campos: {
      fuerte: { tipo: 'tiempo', min: 15, max: 1800, lee: (f) => f.pasos[0].seg, pon: (f, v) => conPaso(f, 0, { seg: v }) },
      suave: { tipo: 'tiempo', min: 15, max: 1800, lee: (f) => f.pasos[1].seg, pon: (f, v) => conPaso(f, 1, { seg: v }) },
      veces: { tipo: 'numero', min: 1, max: 99, lee: (f) => f.vueltas, pon: (f, v) => ({ ...f, vueltas: v }) },
    },
    frase: [{ campo: 'fuerte' }, 'fuerte', { campo: 'suave' }, 'suave', { campo: 'veces' }, 'veces'],
  },
  portiempo: {
    nombre: 'Por tiempo',
    detalle: 'Lo más rápido posible',
    crea: () => ({ id: 'portiempo', pasos: [paso('trabajo', null)], vueltas: 3, tope: null, turnan: false, anota: 'tiempo' }),
    encaja: (f) => forma(f, 'trabajo') && f.pasos[0].seg === null,
    campos: {
      rondas: { tipo: 'numero', min: 1, max: 99, lee: (f) => f.vueltas, pon: (f, v) => ({ ...f, vueltas: v }) },
      tope: { tipo: 'tiempo', paso: 60, min: 0, max: 3600, lee: (f) => f.tope ?? 0, pon: (f, v) => ({ ...f, tope: v > 0 ? v : null }) },
    },
    frase: [{ campo: 'rondas' }, 'rondas, tope', { campo: 'tope' }],
  },
  custom: {
    nombre: 'Personalizado',
    detalle: 'Tú armas los tramos',
    crea: () => ({ id: 'custom', pasos: [paso('trabajo', 60), paso('descanso', 30)], vueltas: 5, tope: null, turnan: false, anota: 'nada' }),
    encaja: () => true,
    campos: {},
    frase: [],
  },
};

/** Los ids en el orden en que salen en la lista del editor. */
export const IDS_DE_FORMATOS = ['amrap', 'emom', 'tabata', 'intervalos', 'fartlek', 'portiempo', 'custom'];

/** Un formato nuevo, ya lleno con lo típico de ese nombre. */
export function formatoNuevo(id) {
  return (FORMATOS[id] ?? FORMATOS.custom).crea();
}

/** El mismo formato pasado a «Personalizado»: los tramos se quedan para retocarlos. */
export function comoPersonalizado(f) {
  return { ...f, id: 'custom' };
}

/* ------------------------------------------------------------------ */
/* Limpiar lo que llega de fuera                                       */
/* ------------------------------------------------------------------ */

const entero = (v, min, max, def) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : def;
};

/**
 * Un formato seguro de usar, o `null` si no hay nada que salvar. Un tramo con un tiempo
 * que no es número ni «hasta Listo» se descarta (no se adivina); los números se redondean y
 * se acotan; lo que sobra se ignora. Lo que ya viene limpio vuelve igual.
 */
export function limpiaFormato(f) {
  if (!f || typeof f !== 'object' || !Array.isArray(f.pasos)) return null;
  const pasos = [];
  for (const p of f.pasos.slice(0, MAX_PASOS)) {
    if (!p || typeof p !== 'object') continue;
    const tipo = p.tipo === 'descanso' ? 'descanso' : 'trabajo';
    const abierto = p.seg === null;
    const seg = abierto ? null : entero(p.seg, 0, MAX_SEG, undefined);
    if (!abierto && seg === undefined) continue;
    // Los espacios no se recortan: este dato vuelve al campo donde se está tecleando, y quitar el
    // espacio final impediría escribir «Muy fuerte». Solo cuenta como vacío si es todo espacios.
    const etiqueta = typeof p.etiqueta === 'string' && p.etiqueta.trim() ? p.etiqueta.slice(0, 30) : '';
    pasos.push({ tipo, seg, ...(etiqueta ? { etiqueta } : {}) });
  }
  if (!pasos.length) return null;
  const id = typeof f.id === 'string' && FORMATOS[f.id] ? f.id : 'custom';
  const nombre = id === 'custom' && typeof f.nombre === 'string' && f.nombre.trim() ? f.nombre.slice(0, 40) : '';
  const limpio = {
    id,
    ...(nombre ? { nombre } : {}),
    pasos,
    vueltas: entero(f.vueltas, 1, MAX_VUELTAS, 1),
    tope: f.tope == null ? null : entero(f.tope, 1, MAX_SEG, null),
    turnan: f.turnan === true,
    anota: ANOTA_IDS.has(f.anota) ? f.anota : 'nada',
  };
  // Un formato que pidiera más de MAX_TRAMOS tramos no es un reloj, es un error de dedo (o de
  // la IA): se recorta a lo que cabe en vez de dejar la pantalla colgada. `expande` vigila lo
  // mismo con los ejercicios que se turnan, que aquí no se conocen.
  limpio.vueltas = Math.min(limpio.vueltas, Math.max(1, Math.floor(MAX_TRAMOS / pasos.length)));
  return limpio;
}

/** El id con el que se puede ENSEÑAR este formato en el editor: el suyo si los tramos todavía encajan, si no «custom». */
export function vistaDe(f) {
  const g = limpiaFormato(f);
  if (!g) return 'custom';
  return FORMATOS[g.id].encaja(g) ? g.id : 'custom';
}

/** Cómo se llama: el nombre que le puso el coach (solo en Personalizado) o el del formato. */
export function nombreDeFormato(f) {
  const g = limpiaFormato(f);
  if (!g) return 'Formato';
  // Tramos que ya no tienen la forma de su formato (ver `vistaDe`) no se llaman como él.
  if (vistaDe(g) === 'custom') return g.nombre || FORMATOS.custom.nombre;
  return FORMATOS[g.id].nombre;
}

/* ------------------------------------------------------------------ */
/* Los tramos, uno por uno                                             */
/* ------------------------------------------------------------------ */

/**
 * Todos los tramos que va a correr el reloj, en orden y ya sin repeticiones:
 * `{ n, tipo, seg, etiqueta, vuelta, ejercicio }`. Con `turnan` y más de un ejercicio, cada
 * vuelta recorre a todos —una pasada de los tramos por ejercicio— y `ejercicio` dice cuál
 * toca; si no, `ejercicio` es `null` (todos a la vez). Los tramos de 0 segundos no existen.
 *
 * EJEMPLO. EMOM de 1 min, 5 vueltas, dos ejercicios que se turnan: 10 tramos de 1 min, el
 * primero con el ejercicio 0, el segundo con el 1, y así. Tabata con cuatro ejercicios y
 * 2 vueltas: 8 × (20 s + 10 s), dos veces cada ejercicio.
 */
export function expande(f, nEjercicios = 1) {
  const g = limpiaFormato(f);
  if (!g) return [];
  const turnos = g.turnan && nEjercicios > 1 ? nEjercicios : 1;
  const pasos = g.pasos.filter((p) => p.seg === null || p.seg > 0);
  const salida = [];
  for (let v = 1; v <= g.vueltas; v += 1) {
    for (let e = 0; e < turnos; e += 1) {
      for (const p of pasos) {
        if (salida.length >= MAX_TRAMOS) return salida;
        salida.push({
          n: salida.length, tipo: p.tipo, seg: p.seg, etiqueta: p.etiqueta ?? '', vuelta: v, ejercicio: turnos > 1 ? e : null,
        });
      }
    }
  }
  return salida;
}

/** Cuánto dura todo, en segundos; `null` si algún tramo es «hasta Listo». */
export function segundosTotales(f, nEjercicios = 1) {
  const plan = expande(f, nEjercicios);
  if (!plan.length || plan.some((t) => t.seg === null)) return null;
  return plan.reduce((a, t) => a + t.seg, 0);
}

/** Cuántos tramos de trabajo hay (los que cuentan al anotar «tramos completados»). */
export function tramosDeTrabajo(f, nEjercicios = 1) {
  return expande(f, nEjercicios).filter((t) => t.tipo === 'trabajo').length;
}

/** El nombre que ve el atleta en un tramo: el que le puso el coach, o «Trabajo» / «Descanso». */
export function etiquetaDeTramo(t) {
  return t?.etiqueta || (t?.tipo === 'descanso' ? 'Descanso' : 'Trabajo');
}

/* ------------------------------------------------------------------ */
/* Resumen                                                             */
/* ------------------------------------------------------------------ */

/** El formato en una línea, para la tarjeta del atleta: «Tabata · 20 s + 10 s × 8». */
export function resumenDeFormato(f, nEjercicios = 1) {
  const g = limpiaFormato(f);
  if (!g) return '';
  const id = vistaDe(g);
  const p = g.pasos;
  const t = (i) => (p[i].seg === null ? '«Listo»' : textoDeTiempo(p[i].seg));
  if (id === 'amrap') return `AMRAP · ${t(0)}`;
  if (id === 'emom') return p[0].seg === 60 ? `EMOM · ${g.vueltas} min` : `EMOM · cada ${t(0)} × ${g.vueltas}`;
  if (id === 'tabata') return `Tabata · ${t(0)} + ${t(1)} × ${g.vueltas}`;
  if (id === 'intervalos') return `Intervalos · ${t(0)} + ${t(1)} × ${g.vueltas}`;
  if (id === 'fartlek') return `Fartlek · ${t(0)} + ${t(1)} × ${g.vueltas}`;
  if (id === 'portiempo') {
    return `Por tiempo · ${g.vueltas} ${g.vueltas === 1 ? 'ronda' : 'rondas'}${g.tope ? ` · tope ${textoDeTiempo(g.tope)}` : ''}`;
  }
  const total = segundosTotales(g, nEjercicios);
  const n = expande(g, nEjercicios).length;
  return `${nombreDeFormato(g)} · ${n} ${n === 1 ? 'tramo' : 'tramos'}${total ? ` · ${textoDeTiempo(total)}` : ''}`;
}

/* ------------------------------------------------------------------ */
/* El formato dentro de los ejercicios de un Set                       */
/* ------------------------------------------------------------------ */

/** El formato de un Set a partir de sus ejercicios: el del primero que lo traiga. */
export function formatoDeMiembros(miembros) {
  const con = (miembros ?? []).find((m) => m && !m.isNote && m.formato);
  return con ? limpiaFormato(con.formato) : null;
}

/**
 * Los ejercicios del Set con el formato puesto (o quitado, con `null`). Cada uno guarda su
 * propia copia y las «series» pasan a ser las vueltas, para que lo que solo conoce `sets`
 * —la IA, las listas— lea algo con sentido.
 */
export function ponFormato(miembros, f) {
  const g = f ? limpiaFormato(f) : null;
  return miembros.map((m) => {
    if (!g) {
      if (!('formato' in m)) return m;
      const { formato: _quitado, ...resto } = m;
      return resto;
    }
    // Con reloj, las vueltas son del formato: las reps y cargas distintas por vuelta del ejercicio ya no aplican.
    const { porVuelta: _sinVueltas, ...resto } = m;
    return { ...resto, formato: JSON.parse(JSON.stringify(g)), sets: String(g.vueltas) };
  });
}

/* ------------------------------------------------------------------ */
/* Lo que anota el atleta                                              */
/* ------------------------------------------------------------------ */

const numero = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/**
 * El resultado de un Set con formato, listo para guardar en el registro del día
 * (`sesión.formatos[<clave del Set>]`): `anota` dice qué es el `valor`; `extra` son las reps
 * sueltas de un AMRAP; `seg` lo que duró todo; `tramos` los parciales; `ventanas` y `lapsos` la
 * hora y la descripción de cada parcial; `de` cuántos tramos de trabajo había. Lo que no es número queda en `null`: un campo vacío no es un cero.
 */
export function limpiaResultado(r) {
  if (!r || typeof r !== 'object') return null;
  const n = (v) => {
    const x = numero(v);
    return x === null ? null : Math.min(1e6, Math.max(0, x));
  };
  const seg = n(r.seg);
  const salida = {
    anota: ANOTA_IDS.has(r.anota) ? r.anota : 'nada',
    valor: n(r.valor),
    extra: n(r.extra),
    seg: seg === null ? null : Math.round(seg),
  };
  if (Array.isArray(r.tramos)) salida.tramos = r.tramos.map(n).filter((x) => x !== null).map(Math.round);
  // La huella de cada tramo hecho (ver `sugerido` en `relojDeFormato.js`): cuándo corrió y qué era. Se guardan juntas y en el mismo orden que `tramos`.
  if (Array.isArray(r.ventanas)) {
    const v = r.ventanas
      .filter((w) => Array.isArray(w) && w.length === 2 && w.every((x) => Number.isFinite(x)))
      .slice(0, MAX_TRAMOS).map((w) => [Math.round(w[0]), Math.round(w[1])]);
    if (v.length) salida.ventanas = v;
  }
  if (Array.isArray(r.lapsos)) {
    const l = r.lapsos.slice(0, MAX_TRAMOS).filter((x) => x && typeof x === 'object').map((x) => ({
      tipo: x.tipo === 'descanso' ? 'descanso' : 'trabajo',
      plan: n(x.plan) === null ? null : Math.round(n(x.plan)),
      etiqueta: String(x.etiqueta ?? '').slice(0, 60),
      texto: String(x.texto ?? '').slice(0, 40),
      vuelta: n(x.vuelta) === null ? 1 : Math.round(n(x.vuelta)),
    }));
    if (l.length) salida.lapsos = l;
  }
  if (n(r.de) !== null) salida.de = Math.round(n(r.de));
  if (typeof r.en === 'string') salida.en = r.en.slice(0, 40);
  return salida;
}

/**
 * Lo anotado, como se lee: «7 rondas + 3 reps», «12:34», «8 de 10 tramos». Sin número, «Hecho».
 * `palabra`: cómo se llama cada pieza de lo «cumplido»: un formato dice «tramo» (AMRAP por tramos, fartlek…) y unos lapsos personalizados dicen
 * «lapso» (Andrés: «la palabra es lapsos, nunca tramos»).
 */
export function textoDeResultado(r, palabra = 'tramo') {
  if (!r) return '';
  const v = numero(r.valor);
  if (v === null) return 'Hecho';
  const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
  switch (r.anota) {
    case 'rondas': {
      const extra = numero(r.extra);
      return `${plural(v, 'ronda', 'rondas')}${extra ? ` + ${plural(extra, 'rep', 'reps')}` : ''}`;
    }
    case 'tiempo': return relojTexto(v);
    case 'reps': return plural(v, 'rep', 'reps');
    case 'km': return `${v} km`;
    case 'm': return `${v} m`;
    case 'cal': return `${v} cal`;
    case 'cumplido': {
      const de = numero(r.de);
      return `${v}${de ? ` de ${de}` : ''} ${(de ?? v) === 1 ? palabra : `${palabra}s`}`;
    }
    default: return 'Hecho';
  }
}
