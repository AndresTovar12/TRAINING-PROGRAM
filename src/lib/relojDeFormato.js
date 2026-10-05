/**
 * El reloj de un Set con formato, sin pantalla.
 *
 * Es una máquina de estados pura: cada función recibe la hora (`ahora`, en milisegundos) y
 * devuelve un estado nuevo. Aquí dentro no hay `setInterval` ni `Date.now()`; por eso se
 * prueba con horas inventadas (`scripts/prueba-formatos.mjs`) y por eso se puede reanudar
 * después de cerrar la pantalla.
 *
 * POR QUÉ POR MARCAS DE HORA Y NO CONTANDO TICS. Un reloj que suma «un segundo» cada vez que
 * suena un temporizador se atrasa en cuanto el teléfono duerme la pestaña (apagar la pantalla
 * a media serie es lo normal) y se pierde si la app se recarga. Aquí lo único que se guarda
 * es CUÁNDO empezó cada cosa; lo que se ve se calcula de ahí. Si la pantalla estuvo dormida
 * tres minutos, al despertar `avanza` salta los tramos que se hayan acabado sin perder el
 * ritmo: cada tramo empieza donde terminó el anterior, no donde llegó el aviso.
 *
 * LOS TRAMOS vienen de `expande` (lib/formatos.js): una lista plana, ya sin repeticiones.
 * Esta función no sabe qué es un AMRAP ni un Tabata: corre tramos. Un tramo con `seg` cuenta
 * hacia atrás y termina solo; con `seg: null` cuenta hacia adelante y termina cuando el
 * atleta toca «Listo».
 *
 * El estado:
 *   fase     — 'listo' (sin empezar) · 'corriendo' · 'pausa' · 'fin'
 *   i        — el tramo en el que va
 *   corrido  — milisegundos de ESTE tramo hasta la última pausa
 *   desde    — la hora a la que arrancó o reanudó (solo si corre)
 *   antes    — milisegundos de los tramos ya terminados (al final, el total)
 *   hechos   — lo que duró cada tramo terminado, en segundos (los parciales)
 *   motivo   — por qué terminó: 'completo' · 'tope' · 'manual'
 *   rondas   — el contador de rondas que lleva el atleta (AMRAP)
 */

export function nuevoReloj() {
  return { fase: 'listo', i: 0, corrido: 0, desde: null, antes: 0, hechos: [], motivo: null, rondas: 0 };
}

// Milisegundos del tramo actual, ahora mismo.
const enTramo = (est, ahora) => est.corrido + (est.fase === 'corriendo' ? Math.max(0, ahora - est.desde) : 0);

const terminado = (est, motivo, antes) => ({ ...est, fase: 'fin', motivo, antes, corrido: 0, desde: null });

export function inicia(est, ahora) {
  if (est.fase !== 'listo' && est.fase !== 'pausa') return est;
  return { ...est, fase: 'corriendo', desde: ahora };
}

export function pausa(est, ahora) {
  if (est.fase !== 'corriendo') return est;
  return { ...est, fase: 'pausa', corrido: enTramo(est, ahora), desde: null };
}

/**
 * Pone el estado al día con la hora: un tramo con tiempo que ya se acabó pasa al siguiente
 * (y al siguiente, si la pantalla estuvo dormida), y el `tope` corta todo cuando se cumple.
 */
export function avanza(est, plan, ahora, tope = null) {
  if (est.fase !== 'corriendo') return est;
  let e = est;
  // El tope de vueltas es el largo del plan más uno por si el último tramo cierra justo.
  for (let guardia = 0; guardia <= plan.length + 1; guardia += 1) {
    const t = plan[e.i];
    if (!t) return terminado(e, 'completo', e.antes);
    const trans = e.corrido + Math.max(0, ahora - e.desde);
    const finDelTramo = t.seg === null ? Infinity : t.seg * 1000;
    const hastaElTope = tope == null ? Infinity : tope * 1000 - e.antes;
    // Lo que llegue primero: el tope corta en medio del tramo; el fin del tramo lo pasa al siguiente.
    if (hastaElTope <= finDelTramo && trans >= hastaElTope) return terminado(e, 'tope', tope * 1000);
    if (trans < finDelTramo) return e;
    const sobra = trans - finDelTramo;
    e = { ...e, antes: e.antes + finDelTramo, hechos: [...e.hechos, t.seg], i: e.i + 1, corrido: 0, desde: ahora - sobra };
    if (e.i >= plan.length) return terminado(e, 'completo', e.antes);
  }
  return e;
}

/** «Listo»: el atleta termina el tramo en el que va (el que no tiene tiempo, o uno con tiempo si quiere saltarlo). */
export function listo(est, plan, ahora, tope = null) {
  const e = avanza(est, plan, ahora, tope);
  if (e.fase !== 'corriendo' || !plan[e.i]) return e;
  const trans = e.corrido + Math.max(0, ahora - e.desde);
  const sig = { ...e, antes: e.antes + trans, hechos: [...e.hechos, Math.round(trans / 1000)], i: e.i + 1, corrido: 0, desde: ahora };
  return sig.i >= plan.length ? terminado(sig, 'completo', sig.antes) : sig;
}

/** «Terminar»: parar antes de tiempo. Lo que corrió del tramo en curso cuenta para el total. */
export function termina(est, plan, ahora, tope = null) {
  const e = avanza(est, plan, ahora, tope);
  if (e.fase === 'fin') return e;
  return terminado(e, 'manual', e.antes + enTramo(e, ahora));
}

/** Suma o resta una ronda al contador del atleta. Nunca baja de cero. */
export function sumaRonda(est, d) {
  return { ...est, rondas: Math.max(0, est.rondas + d) };
}

/**
 * Lo que la pantalla necesita saber, ya calculado. Se llama con un estado puesto al día
 * (`avanza`) a la misma hora.
 *
 * `restanteSeg` redondea hacia ARRIBA: así la cuenta regresiva dice 3, 2, 1 y no 2, 1, 0 en el
 * último segundo. `transcurridoSeg` redondea hacia abajo.
 */
export function vista(est, plan, ahora, tope = null) {
  const tramo = plan[est.i] ?? null;
  const ms = enTramo(est, ahora);
  const total = est.antes + ms;
  return {
    fase: est.fase,
    motivo: est.motivo,
    i: est.i,
    n: plan.length,
    tramo,
    proximo: plan[est.i + 1] ?? null,
    restanteSeg: tramo && tramo.seg !== null ? Math.max(0, Math.ceil((tramo.seg * 1000 - ms) / 1000)) : null,
    transcurridoSeg: Math.floor(ms / 1000),
    totalSeg: Math.floor(total / 1000),
    topeRestanteSeg: tope == null ? null : Math.max(0, Math.ceil((tope * 1000 - total) / 1000)),
    progreso: tramo && tramo.seg ? Math.min(1, ms / (tramo.seg * 1000)) : null,
    hechos: est.hechos,
    rondas: est.rondas,
  };
}

/** Lo que el reloj ya sabe del resultado, para llenar de antemano lo que el atleta anota. */
export function sugerido(est, plan) {
  const trabajo = plan.filter((t) => t.tipo === 'trabajo');
  const hechosDeTrabajo = plan.slice(0, est.hechos.length).filter((t) => t.tipo === 'trabajo').length;
  return {
    seg: Math.floor(est.antes / 1000),
    rondas: est.rondas,
    tramos: est.hechos,
    completados: hechosDeTrabajo,
    de: trabajo.length,
  };
}

/* ------------------------------------------------------------------ */
/* Guardar el reloj a medias (por si la app se recarga)                */
/* ------------------------------------------------------------------ */

const NUMEROS = ['i', 'corrido', 'antes', 'rondas'];

/**
 * Un estado guardado antes, o uno nuevo si no sirve. Se comprueba la forma entera: lo que
 * viene de un almacenamiento viejo o de otra versión no debe poder romper la pantalla.
 */
export function reanuda(guardado, plan) {
  const g = guardado;
  const valido = g && typeof g === 'object'
    && ['listo', 'corriendo', 'pausa', 'fin'].includes(g.fase)
    && NUMEROS.every((k) => Number.isFinite(g[k]) && g[k] >= 0)
    && g.i <= plan.length
    && Array.isArray(g.hechos) && g.hechos.every((x) => Number.isFinite(x))
    && (g.fase !== 'corriendo' || Number.isFinite(g.desde));
  return valido ? { ...nuevoReloj(), ...g, desde: g.fase === 'corriendo' ? g.desde : null } : nuevoReloj();
}
