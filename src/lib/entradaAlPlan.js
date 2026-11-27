/* EN QUÉ SEMANA ENTRA QUIEN COMPRA UN PLAN.

   Andrés, 12 oct 2026: por defecto se empieza en la semana 1, pero un programa puede ser de 12 meses y quien lo compra no tener 12 meses: puede entrar a CUALQUIER semana, incluso a la mitad de una
   fase. La elige tocando una semana en la hoja del programa (la misma que ve el atleta) o dice cuánto tiempo tiene —en meses o con la fecha de su competencia— y la hoja le marca dónde entrar.

   Las semanas se cuentan de corrido por todo el programa («la semana 26 de 48») aunque por dentro estén repartidas en fases. Un mes son 4 semanas.
   `fases`: las de la hoja pública o las de un plan: `[{ id, weekData: [{ num }] }]`. Sin red ni React: se prueba en `scripts/prueba-entrada.mjs`. */

export const SEMANAS_POR_MES = 4;

const semanasDe = (fase) => (Array.isArray(fase?.weekData) ? fase.weekData : []);

/** Cuántas semanas tiene el programa entero. */
export const totalDeSemanas = (fases) => (fases ?? []).reduce((n, f) => n + semanasDe(f).length, 0);

/** Qué número de corrido (desde 1) es la semana `num` de la fase `faseId`; 0 si no existe. */
export function posicionDeCorrido(fases, faseId, num) {
  let antes = 0;
  for (const f of fases ?? []) {
    const semanas = semanasDe(f);
    if (f?.id === faseId) {
      const i = semanas.findIndex((w) => w?.num === num);
      return i < 0 ? 0 : antes + i + 1;
    }
    antes += semanas.length;
  }
  return 0;
}

/** De la semana de corrido `n` (desde 1) a `{ faseId, semana }`. Se acomoda a lo que exista: menos de 1 es la primera; más del total, la última. `null` si el programa no tiene semanas. */
export function entradaDeCorrido(fases, n) {
  const total = totalDeSemanas(fases);
  if (!total) return null;
  let resto = Math.min(total, Math.max(1, Math.round(Number(n) || 1)));
  for (const f of fases ?? []) {
    const semanas = semanasDe(f);
    if (resto <= semanas.length) return { faseId: f.id, semana: semanas[resto - 1]?.num ?? resto };
    resto -= semanas.length;
  }
  return null;
}

/** La entrada por defecto: la primera semana del programa. */
export const primeraEntrada = (fases) => entradaDeCorrido(fases, 1);

/** Con cuánto tiempo cuenta quien compra, en semanas, a partir de meses o de la fecha de su competencia. */
export const semanasDeMeses = (meses) => Math.max(0, Math.floor(Number(meses) || 0)) * SEMANAS_POR_MES;

/* ---------- FECHAS: todo en días de calendario «AAAA-MM-DD», sin hora ni huso (26 nov 2026). ---------- */
const DIA_MS = 86400000;
const aDia = (fecha) => {
  const t = new Date(`${String(fecha ?? '').slice(0, 10)}T00:00:00Z`).getTime();
  return Number.isFinite(t) ? t : NaN;
};
const deDia = (t) => new Date(t).toISOString().slice(0, 10);
/** El día de hoy de quien usa la app, en SU calendario (no en UTC). */
export const hoyLocal = (ahora = new Date()) => `${ahora.getFullYear()}-${String(ahora.getMonth() + 1).padStart(2, '0')}-${String(ahora.getDate()).padStart(2, '0')}`;
export const sumaDias = (fecha, n) => deDia(aDia(fecha) + n * DIA_MS);
/** 0 = lunes … 6 = domingo. */
const diaDeLaSemana = (fecha) => (new Date(aDia(fecha)).getUTCDay() + 6) % 7;
/** El lunes de la semana de esa fecha (la semana va de lunes a domingo). */
export const lunesDe = (fecha) => sumaDias(fecha, -diaDeLaSemana(fecha));

/**
 * Cuántas semanas COMPLETAS (de lunes a domingo) caben desde la semana en que empieza hasta `fecha` inclusive. Se cuenta desde el día de inicio ELEGIDO, no desde hoy
 * (26 nov 2026): quien empieza el lunes 30 tiene una semana menos que quien empieza hoy martes 24. La semana del inicio cuenta entera aunque empiece a media semana.
 */
export function semanasHastaFecha(fecha, inicio = hoyLocal()) {
  const fin = aDia(fecha);
  const desde = aDia(lunesDe(typeof inicio === 'string' ? inicio : hoyLocal(inicio)));
  if (!Number.isFinite(fin) || !Number.isFinite(desde)) return 0;
  const dias = Math.round((fin - desde) / DIA_MS) + 1;
  return dias > 0 ? Math.floor(dias / 7) : 0;
}

/**
 * Dónde le conviene entrar a quien cuenta con `semanasDisponibles` para un programa de `total` semanas: que el programa TERMINE cuando se le acaba el tiempo. Si le sobra tiempo, desde la 1.
 * Sin tiempo dicho (0 o nada), también la 1. Devuelve el número de corrido.
 */
export function semanaSugerida(total, semanasDisponibles) {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  const d = Math.floor(Number(semanasDisponibles) || 0);
  if (!t || d <= 0 || d >= t) return 1;
  return t - d + 1;
}

/** Los números de la entrada elegida, listos para decirlos: la semana, el mes, cuántas le quedan y si entra a la mitad. */
export function resumenDeEntrada(fases, faseId, num) {
  const total = totalDeSemanas(fases);
  const semana = posicionDeCorrido(fases, faseId, num);
  if (!total || !semana) return null;
  return {
    semana, total, restantes: total - semana + 1,
    mes: Math.floor((semana - 1) / SEMANAS_POR_MES) + 1, meses: Math.ceil(total / SEMANAS_POR_MES),
    desdeElPrincipio: semana === 1,
  };
}

/* ---------- DÓNDE PUEDE EMPEZAR EL ATLETA (ficha del plan, 26 nov 2026) ---------- */

export const MODOS_DE_ENTRADA = [
  { valor: 'semana_1', texto: 'Solo en la semana 1' },
  { valor: 'fases', texto: 'Al inicio de cada fase' },
  { valor: 'cualquiera', texto: 'En cualquier semana' },
  { valor: 'elegidas', texto: 'En las semanas que yo elija' },
];

/** El número de corrido de la primera semana de cada fase que tiene semanas: [1, 5, 9]. */
export function iniciosDeFase(fases) {
  const inicios = [];
  let n = 1;
  for (const f of fases ?? []) {
    const k = semanasDe(f).length;
    if (k) { inicios.push(n); n += k; }
  }
  return inicios;
}

/** Las semanas elegidas a mano, limpias: enteras, dentro del plan, sin repetir, en orden y SIEMPRE con la 1 (si el coach quitó semanas, las que ya no existen se van solas). */
export function limpiaSemanasElegidas(semanas, total) {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  if (!t) return [];
  const buenas = new Set([1]);
  for (const x of semanas ?? []) {
    const n = Math.floor(Number(x));
    if (Number.isFinite(n) && n >= 1 && n <= t) buenas.add(n);
  }
  return [...buenas].sort((a, b) => a - b);
}

/** Las semanas (de corrido) en que el atleta puede entrar, según lo que el coach eligió. «Al inicio de cada fase» con una sola fase es «solo la semana 1». */
export function semanasPermitidas(fases, { modo = 'semana_1', semanas = [1] } = {}) {
  const total = totalDeSemanas(fases);
  if (!total) return [];
  if (modo === 'cualquiera') return Array.from({ length: total }, (_, i) => i + 1);
  if (modo === 'fases') return iniciosDeFase(fases);
  if (modo === 'elegidas') return limpiaSemanasElegidas(semanas, total);
  return [1];
}

/** Los modos que tienen sentido para ESTE plan: «Al inicio de cada fase» solo con 2 fases o más. */
export const modosPosibles = (fases) => MODOS_DE_ENTRADA.filter((m) => m.valor !== 'fases' || iniciosDeFase(fases).length >= 2);

/**
 * ¿Este plan tiene «dónde empezar», «Tu atleta ve las próximas», «Terminas el…» y «Necesito terminar antes»? No en una clase, un workout suelto, una biblioteca,
 * una rutina semanal que se repite (membresía) ni un plan de 1 semana.
 */
export function tieneEntrada({ contenido = 'programa', kind = 'periodized', fases = [] } = {}) {
  if (['clase', 'workout', 'biblioteca', 'rutina'].includes(contenido)) return false;
  if (kind === 'weekly') return false;
  return totalDeSemanas(fases) > 1;
}

/* ---------- ¿CUÁNDO EMPIEZAS? (después de pagar) ---------- */

/** Las dos opciones: hoy y el lunes que viene (marcado por defecto). Si hoy es lunes, solo hoy. `aMitad`: hoy no es lunes (los días de antes ya pasaron). */
export function opcionesDeInicio(hoy = hoyLocal()) {
  if (diaDeLaSemana(hoy) === 0) return [{ tipo: 'hoy', fecha: hoy, aMitad: false, porDefecto: true }];
  return [
    { tipo: 'hoy', fecha: hoy, aMitad: true, porDefecto: false },
    { tipo: 'lunes', fecha: sumaDias(lunesDe(hoy), 7), aMitad: false, porDefecto: true },
  ];
}

/** El domingo en que termina quien empieza `inicio` en la semana `semana` (de corrido) de un plan de `total` semanas. */
export const finDelPlan = (inicio, total, semana = 1) => sumaDias(lunesDe(inicio), (Math.max(1, total - semana + 1)) * 7 - 1);

/** Las fechas que deja elegir «¿Para qué fecha?»: de una semana después del inicio al final normal del plan. */
export const rangoDeFechaMeta = (inicio, total) => ({ desde: sumaDias(inicio, 7), hasta: finDelPlan(inicio, total, 1) });

/**
 * Con su fecha («Necesito terminar antes»), en qué semana entra. Solo propone semanas que el coach permitió: la más temprana que le deja terminar a tiempo; si ninguna alcanza,
 * la permitida que termina más cerca de su fecha (la última). Devuelve `{ semana, saltadas, total, alcanza }`.
 */
export function entradaParaFecha({ total, permitidas = [1], inicio, fecha }) {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  const lista = (permitidas.length ? permitidas : [1]).filter((n) => n >= 1 && n <= t).sort((a, b) => a - b);
  if (!t || !lista.length) return null;
  const caben = semanasHastaFecha(fecha, inicio);
  const necesaria = Math.max(1, t - caben + 1);
  const alcanzan = lista.filter((n) => n >= necesaria);
  const semana = alcanzan.length ? alcanzan[0] : lista[lista.length - 1];
  return { semana, saltadas: semana - 1, total: t, alcanza: alcanzan.length > 0 };
}

/* ---------- Fechas en palabras («martes 24», «lunes 30 de noviembre») ---------- */
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'];
const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
export const diaCorto = (fecha) => `${DIAS[diaDeLaSemana(fecha)]} ${Number(String(fecha).slice(8, 10))}`;
export const diaLargo = (fecha) => `${diaCorto(fecha)} de ${MESES[Number(String(fecha).slice(5, 7)) - 1]}`;

/* ---------- Cómo va un plan comprado («Mis planes») ---------- */

/**
 * En qué va un plan comprado hoy. `semanaEntrada`: la de corrido en que entró. Una membresía o una rutina semanal no termina: siempre «en curso».
 * Devuelve `{ estado: 'por_empezar' | 'en_curso' | 'terminado', semana, total, fin, empieza }`.
 */
export function avanceDelPlan({ inicio, total, semanaEntrada = 1, tipo = 'pago_unico', kind = 'periodized' }, hoy = hoyLocal()) {
  const t = Math.max(0, Math.floor(Number(total) || 0));
  if (!inicio) return { estado: 'por_empezar', semana: semanaEntrada, total: t, fin: null, empieza: null };
  if (hoy < inicio) return { estado: 'por_empezar', semana: semanaEntrada, total: t, fin: null, empieza: inicio };
  const pasadas = Math.floor(Math.round((aDia(hoy) - aDia(lunesDe(inicio))) / DIA_MS) / 7);
  const sinFin = tipo === 'membresia' || kind === 'weekly' || t <= 1;
  if (sinFin) return { estado: 'en_curso', semana: t > 0 ? Math.min(t, semanaEntrada + pasadas) : 1, total: t, fin: null, empieza: inicio };
  const fin = finDelPlan(inicio, t, semanaEntrada);
  if (hoy > fin) return { estado: 'terminado', semana: t, total: t, fin, empieza: inicio };
  return { estado: 'en_curso', semana: semanaEntrada + pasadas, total: t, fin, empieza: inicio };
}
