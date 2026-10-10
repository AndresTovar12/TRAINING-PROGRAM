/* POR SERIE Y POR LAPSO: lo que el coach ve de cada parte de un entreno guiado.

   Andrés (10 oct 2026): «en las métricas de cada entrenamiento el coach pudiera ver, si hubo un set de lapsos, las métricas importantes de cada lapso; si hubo
   sprints de 400 m o de 13 segundos, o calorías, también; y en un set normal, igual». Esta pieza junta TRES fuentes sobre la misma línea de tiempo:

     1. el entreno guiado de la app (`sesión.entreno.hechos`): a qué hora se marcó cada serie y cada descanso, y lo que el atleta cambió de lo planeado;
     2. el resultado de cada Set con reloj (`sesión.formatos[...]`): lo que duró cada lapso y, desde el 10 oct, a qué hora corrió (`ventanas`) y qué era (`lapsos`);
     3. si hay reloj de pulsera para esa hora (una actividad de `actividades`), sus series de pulso reducidas (ver `reduceSeries`): se cortan en cada ventana.

   Y dice de DÓNDE sale cada número, con las palabras que Andrés aprobó (sin género: «a mano», no «él»):
     'app'     «Lo midió la app»      el cronómetro de la app (la duración de un lapso o de una serie)
     'reloj'   «Lo midió el reloj»    el pulso (y lo que se saca de él: lo que bajó en el descanso)
     'escrito' «Lo escribió a mano»   kilos o reps que el atleta cambió, o lo que anotó de un set (calorías de una máquina, rondas…)
     'plan'    «Dejó lo del plan»     tocó «Listo» sin cambiar nada: lo que se ve es lo que decía el plan, no algo que se haya comprobado

   Todo es puro: recibe datos ya leídos y no importa nada de la app (ni `@/`). Las horas son milisegundos (`Date.now()`), como en el avance del entreno. */
import { textoDeResultado } from '../formatos.js';

export const TEXTO_DE_FUENTE = {
  app: 'Lo midió la app',
  reloj: 'Lo midió el reloj',
  escrito: 'Lo escribió a mano',
  plan: 'Dejó lo del plan',
};

const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const finito = (x) => typeof x === 'number' && Number.isFinite(x);
const numero = (v) => {
  const n = parseFloat(String(v ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};
const hay = (v) => v !== undefined && v !== null && String(v).trim() !== '';

/* ------------------------------------------------------------------ */
/* Qué sesiones tienen un entreno guiado, y cuándo fue                 */
/* ------------------------------------------------------------------ */

/**
 * Cuándo empezó y terminó lo hecho en una sesión (`{ inicio, fin }` en milisegundos), o `null` si no hay nada hecho: un entreno que se abrió y se cerró sin
 * tocar un paso, o una sesión que solo tiene lo que el atleta escribió a mano en la pantalla de Entrenar. Cuenta lo que hizo el entreno guiado (`entreno`) y
 * lo que corrió un reloj de Set (`formatos[...].ventanas`).
 */
export function tramoDeLaSesion(registro) {
  if (!esObjeto(registro)) return null;
  const e = esObjeto(registro.entreno) ? registro.entreno : {};
  const horas = [];
  let marcas = 0;
  ['hechos', 'saltados'].forEach((k) => {
    if (!esObjeto(e[k])) return;
    Object.values(e[k]).forEach((m) => { if (esObjeto(m) && finito(m.t)) { horas.push(m.t); marcas += 1; } });
  });
  let relojes = 0;
  if (esObjeto(registro.formatos)) {
    Object.values(registro.formatos).forEach((f) => {
      if (!esObjeto(f) || !Array.isArray(f.ventanas)) return;
      f.ventanas.forEach((w) => { if (Array.isArray(w) && finito(w[0]) && finito(w[1])) { horas.push(w[0], w[1]); relojes += 1; } });
    });
  }
  if (marcas === 0 && relojes === 0) return null;
  const inicio = finito(e.inicio) ? Math.min(e.inicio, ...horas) : Math.min(...horas);
  const fin = Math.max(finito(e.fin) ? e.fin : inicio, ...horas);
  return { inicio, fin };
}

/**
 * Todas las sesiones con algo hecho en el entreno guiado, de la cuenta de un atleta (`user_app_state.data`): `[{ id, almacen, nombre, registro, inicio, fin }]`,
 * de la más vieja a la más nueva. Las sesiones de un programa de equipo viven en llaves aparte (`wr:sessions@<profesional>`): se leen todas.
 */
export function sesionesGuiadas(estado) {
  const salida = [];
  Object.entries(esObjeto(estado) ? estado : {}).forEach(([almacen, sesiones]) => {
    if (!/^wr:sessions(@|$)/.test(almacen) || !esObjeto(sesiones)) return;
    Object.entries(sesiones).forEach(([id, registro]) => {
      const tramo = tramoDeLaSesion(registro);
      if (!tramo) return;
      // Los nombres de las sesiones traen la duración estimada («Lower Strength · ~75 min»): aquí no sirve, el tiempo real está en la sesión.
      const nombre = typeof registro.entreno?.nombre === 'string' ? registro.entreno.nombre.replace(/\s*·\s*~.*$/, '').trim() : '';
      salida.push({ id, almacen, nombre: nombre || null, registro, ...tramo });
    });
  });
  return salida.sort((a, b) => a.inicio - b.inicio);
}

const tramoDeActividad = (a) => {
  const inicio = Date.parse(a.inicio);
  const fin = a.fin ? Date.parse(a.fin) : inicio + (a.duracion_s ?? 0) * 1000;
  return Number.isFinite(inicio) && Number.isFinite(fin) ? { inicio, fin: Math.max(fin, inicio) } : null;
};

/**
 * Une cada entreno del reloj con la sesión guiada que se hizo al mismo tiempo: la que más se traslape (al menos la mitad de lo más corto de los dos, y un
 * minuto). Una sesión solo une con un entreno y al revés. Devuelve `{ porActividad: Map<idDeActividad, sesión>, sueltas: [sesiones sin entreno de reloj] }`.
 */
export function uneConActividades(sesiones, actividades) {
  const candidatos = [];
  (actividades ?? []).forEach((a) => {
    const ta = tramoDeActividad(a);
    if (!ta) return;
    (sesiones ?? []).forEach((s) => {
      const traslape = Math.min(ta.fin, s.fin) - Math.max(ta.inicio, s.inicio);
      if (traslape < 60000) return;
      const corto = Math.max(60000, Math.min(ta.fin - ta.inicio, s.fin - s.inicio));
      if (traslape / corto < 0.5) return;
      // Para elegir entre varios se prefiere el que más se parece en largo y en hora (traslape sobre lo MÁS largo de los dos).
      candidatos.push({ a, s, razon: traslape / Math.max(ta.fin - ta.inicio, s.fin - s.inicio, 60000) });
    });
  });
  candidatos.sort((x, y) => y.razon - x.razon);
  const porActividad = new Map();
  const usadas = new Set();
  candidatos.forEach(({ a, s }) => {
    if (porActividad.has(a.id) || usadas.has(s)) return;
    porActividad.set(a.id, s);
    usadas.add(s);
  });
  return { porActividad, sueltas: (sesiones ?? []).filter((s) => !usadas.has(s)) };
}

/* ------------------------------------------------------------------ */
/* El pulso del reloj de pulsera, cortado por ventanas                 */
/* ------------------------------------------------------------------ */

/**
 * El pulso de las series reducidas entre dos momentos (segundos desde el inicio del entreno): `{ media, max, n }`, o `null` si ahí no hay pulso. Cada punto de
 * la serie es el promedio de unos segundos (de ~3 a ~25, según lo largo del entreno): el máximo es el de esos promedios, así que un pico de un instante sale
 * algo más bajo que el real. Con una ventana de menos de un punto se usa el punto que la toca.
 */
export function pulsoEnVentana(series, desdeS, hastaS) {
  const t = series?.t;
  const fc = series?.fc;
  if (!Array.isArray(t) || !Array.isArray(fc) || !(hastaS > desdeS)) return null;
  const ancho = t.length > 1 ? Math.max(1, t[t.length - 1] - t[t.length - 2]) : 1;
  const valores = [];
  for (let i = 0; i < t.length; i += 1) {
    const ini = t[i];
    const fin = i + 1 < t.length ? t[i + 1] : ini + ancho;
    if (ini < hastaS && fin > desdeS && typeof fc[i] === 'number' && fc[i] > 0) valores.push(fc[i]);
  }
  if (!valores.length) return null;
  return { media: Math.round(valores.reduce((s, v) => s + v, 0) / valores.length), max: Math.max(...valores), n: valores.length };
}

/* ------------------------------------------------------------------ */
/* Las filas                                                           */
/* ------------------------------------------------------------------ */

// Metros que pide un lapso («400 m», «1.5 km»); `null` si pide otra cosa (tiempo, reps, calorías).
function metrosDelTexto(texto) {
  const m = String(texto ?? '').replace(',', '.').trim().match(/^(\d+(?:\.\d+)?)\s*(km|m)\b/i);
  if (!m) return null;
  const metros = parseFloat(m[1]) * (m[2].toLowerCase() === 'km' ? 1000 : 1);
  return metros > 0 ? metros : null;
}

// De qué viene lo que anotó el atleta de un set con reloj: lo tecleado (calorías, rondas…) vs lo que ya sabía el reloj de la app.
const FUENTE_DEL_RESULTADO = { rondas: 'escrito', reps: 'escrito', km: 'escrito', m: 'escrito', cal: 'escrito', tiempo: 'app' };

const HASTA_UN_DESCANSO_LARGO_S = 15 * 60;

/**
 * Las filas de «Por serie» de una sesión guiada, en el orden en que pasaron.
 *
 *   sesion      un elemento de `sesionesGuiadas`
 *   actividad   (opcional) el entreno del reloj de pulsera que se hizo a la vez, y `series` sus series reducidas: con eso cada fila trae su pulso
 *
 * Cada fila: `{ clave, tipo: 'serie' | 'lapso' | 'set' | 'saltada', nombre, vuelta, texto, orden, durS, planS, kg, reps, fuente, valor, ritmoSKm, distM,
 * fc: { media, max } | null, descanso: { realS, planS, bajoFc } | null, tecnica }`. `durS` solo viene cuando se pudo medir limpio: una serie solo tiene
 * duración si antes hubo un descanso marcado (si no, el tiempo desde la anterior incluye todo lo que pasó en medio). `fuente` es la de los KILOS y REPS
 * (`'escrito'` o `'plan'`) en una serie, y la de lo anotado (`valor`) en un set; la duración siempre es «de la app» y el pulso «del reloj».
 *
 * `{ filas, hayPulso, resumen: { series, lapsos, saltadas, descansoMedioS } }`.
 */
export function filasPorSerie(sesion, { actividad = null, series = null } = {}) {
  const reg = sesion?.registro ?? {};
  const e = esObjeto(reg.entreno) ? reg.entreno : {};
  const ejercicios = esObjeto(reg.exercises) ? reg.exercises : {};
  const formatos = esObjeto(reg.formatos) ? reg.formatos : {};

  const inicioReloj = actividad && series ? Date.parse(actividad.inicio) : NaN;
  const conReloj = Number.isFinite(inicioReloj);
  const aS = (ms) => (ms - inicioReloj) / 1000;
  const pulso = (desde, hasta) => (conReloj && finito(desde) && finito(hasta) ? pulsoEnVentana(series, aS(desde), aS(hasta)) : null);
  // Lo que bajó el pulso en un descanso: el pico de lo que se acaba de hacer menos lo que había al terminar de descansar (los últimos 8 s).
  const bajoEnDescanso = (pico, finDelDescanso) => {
    const al = pulso(finDelDescanso - 8000, finDelDescanso);
    return pico && al && pico >= al.media ? pico - al.media : null;
  };

  // Todo lo marcado en el entreno, en el orden en que pasó.
  const marcas = [];
  [['hechos', 'hecho'], ['saltados', 'saltado']].forEach(([llave, estado]) => {
    if (!esObjeto(e[llave])) return;
    Object.entries(e[llave]).forEach(([clave, m]) => { if (esObjeto(m) && finito(m.t)) marcas.push({ ...m, clave, estado }); });
  });
  marcas.sort((a, b) => a.t - b.t);
  const marcaDe = new Map(marcas.map((m) => [m.clave, m]));

  const filas = [];
  const descansos = [];

  marcas.forEach((m, i) => {
    const previa = marcas[i - 1] ?? null;
    const dePrevia = (c) => previa?.clave.startsWith(c);

    // Un descanso no es fila: se cuelga de la serie que lo precede (ver abajo).
    if (m.clave.startsWith('d.') || m.clave.startsWith('n.')) return;

    // Un Set con reloj: sus filas salen de lo que anotó el reloj.
    const reloj = /^r\.(\d+)$/.exec(m.clave);
    if (reloj) {
      if (m.estado === 'saltado') { filas.push({ clave: m.clave, tipo: 'saltada', nombre: m.n || 'Set con reloj', orden: m.t }); return; }
      const f = formatos[reloj[1]];
      if (!esObjeto(f)) { filas.push({ clave: m.clave, tipo: 'set', nombre: m.n || 'Set con reloj', orden: m.t, valor: null, fuente: null }); return; }
      const nombreDelSet = m.n || 'Set con reloj';
      const trabajoDelSet = [];
      const lapsos = Array.isArray(f.lapsos) ? f.lapsos : [];
      const ventanas = Array.isArray(f.ventanas) ? f.ventanas : [];
      const tramos = Array.isArray(f.tramos) ? f.tramos : [];
      const ventanaDe = (k) => (Array.isArray(ventanas[k]) && finito(ventanas[k][0]) && finito(ventanas[k][1]) ? ventanas[k] : null);
      const empiezaEn = ventanaDe(0)?.[0] ?? (finito(f.seg) ? m.t - f.seg * 1000 : m.t);
      // Lo que anotó del set entero (calorías de la máquina, rondas…): una fila aparte arriba.
      if (f.anota && f.anota !== 'nada' && f.anota !== 'cumplido' && finito(f.valor)) {
        filas.push({
          clave: `${m.clave}#set`, tipo: 'set', nombre: nombreDelSet, orden: empiezaEn - 1, valor: textoDeResultado(f), durS: finito(f.seg) ? f.seg : null,
          fuente: FUENTE_DEL_RESULTADO[f.anota] ?? 'escrito',
        });
      }
      lapsos.forEach((l, k) => {
        if (!esObjeto(l)) return;
        const v = ventanaDe(k);
        const durS = finito(tramos[k]) ? tramos[k] : (v ? Math.round((v[1] - v[0]) / 1000) : null);
        if (l.tipo === 'descanso') {
          const ultima = trabajoDelSet[trabajoDelSet.length - 1];
          if (!ultima) return;
          ultima.descanso = { realS: durS, planS: finito(l.plan) ? l.plan : null, bajoFc: v ? bajoEnDescanso(ultima.fc?.max ?? null, v[1]) : null };
          return;
        }
        const distM = metrosDelTexto(l.texto);
        const fila = {
          clave: `${m.clave}#${k}`, tipo: 'lapso', nombre: l.etiqueta || nombreDelSet, vuelta: finito(l.vuelta) ? l.vuelta : 1, texto: l.texto || '',
          orden: v ? v[0] : empiezaEn + k, durS, planS: finito(l.plan) ? l.plan : null,
          distM, ritmoSKm: distM && durS > 0 ? Math.round((durS / distM) * 1000) : null,
          fc: v ? pulso(v[0], v[1]) : null, descanso: null,
        };
        trabajoDelSet.push(fila);
        filas.push(fila);
      });
      // Un Set sin la huella de sus tramos (resultado viejo): una sola fila con lo anotado.
      if (!lapsos.length && !(f.anota && f.anota !== 'nada' && finito(f.valor))) {
        filas.push({ clave: m.clave, tipo: 'set', nombre: nombreDelSet, orden: empiezaEn, valor: textoDeResultado(f), durS: finito(f.seg) ? f.seg : null, fuente: FUENTE_DEL_RESULTADO[f.anota] ?? null });
      }
      return;
    }

    // Una serie de un ejercicio: «<ejercicio>.<vuelta>.<lapso>».
    const paso = /^(\d+)\.(\d+)\.(\d+)$/.exec(m.clave);
    if (!paso) return;
    const [, idx, vuelta, lapso] = paso;
    if (m.estado === 'saltado') {
      filas.push({ clave: m.clave, tipo: 'saltada', nombre: m.n || `Ejercicio ${Number(idx) + 1}`, vuelta: Number(vuelta), orden: m.t });
      return;
    }
    // La ventana de la serie: del descanso anterior (o del paso anterior) a su «Listo». Solo es limpia si lo anterior fue un descanso.
    const limpia = !!previa && dePrevia('d.');
    const desde = previa ? previa.t : (finito(e.inicio) ? e.inicio : m.t);
    const duro = m.t - desde;
    const durS = limpia && duro > 0 && duro / 1000 <= HASTA_UN_DESCANSO_LARGO_S ? Math.round(duro / 1000) : null;
    // Los kilos y reps: lo que cambió el atleta (viaja en la marca) o, si no, lo que el «Listo» dejó anotado (que es lo del plan).
    const exData = ejercicios[idx];
    const dato = esObjeto(exData?.vueltas) ? (esObjeto(exData.vueltas[Number(vuelta) - 1]) ? exData.vueltas[Number(vuelta) - 1] : null) : exData;
    const reps = hay(m.reps) ? m.reps : (hay(dato?.repsHechas) ? dato.repsHechas : null);
    const kg = hay(m.kg) ? numero(m.kg) : numero(dato?.weight);
    const cambio = hay(m.reps) || hay(m.kg);
    const descanso = marcaDe.get(`d.${m.clave}`);
    const finDescanso = descanso?.estado === 'hecho' && descanso.t > m.t ? descanso.t : null;
    const fc = durS !== null ? pulso(desde, m.t) : null;
    const fila = {
      clave: m.clave, tipo: 'serie', nombre: m.n || `Ejercicio ${Number(idx) + 1}`, vuelta: Number(vuelta), lapso: Number(lapso), orden: m.t, durS,
      kg, reps: reps === null ? null : String(reps), fuente: cambio ? 'escrito' : (kg !== null || reps !== null ? 'plan' : null),
      segEscritos: hay(m.seg) ? numero(m.seg) : null,
      fc, descanso: null, tecnica: typeof m.tecnica === 'string' ? m.tecnica : null,
    };
    if (finDescanso !== null) {
      fila.descanso = { realS: Math.round((finDescanso - m.t) / 1000), planS: finito(descanso.p) ? descanso.p : null, bajoFc: bajoEnDescanso(fc?.max ?? null, finDescanso) };
    }
    filas.push(fila);
    if (fila.descanso) descansos.push(fila.descanso.realS);
  });

  // El descanso de los lapsos también cuenta para el promedio.
  filas.forEach((f) => { if (f.tipo === 'lapso' && f.descanso && finito(f.descanso.realS)) descansos.push(f.descanso.realS); });
  filas.sort((a, b) => a.orden - b.orden);

  const medio = descansos.length ? Math.round(descansos.reduce((s, x) => s + x, 0) / descansos.length) : null;
  return {
    filas,
    hayPulso: filas.some((f) => f.fc),
    resumen: {
      series: filas.filter((f) => f.tipo === 'serie').length,
      lapsos: filas.filter((f) => f.tipo === 'lapso').length,
      saltadas: filas.filter((f) => f.tipo === 'saltada').length,
      descansoMedioS: medio,
    },
  };
}
