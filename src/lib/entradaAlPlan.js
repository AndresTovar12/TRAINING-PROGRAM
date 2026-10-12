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

export function semanasHastaFecha(fecha, hoy = new Date()) {
  const t = new Date(`${String(fecha).slice(0, 10)}T00:00:00Z`).getTime();
  if (!Number.isFinite(t)) return 0;
  const base = Date.UTC(hoy.getUTCFullYear(), hoy.getUTCMonth(), hoy.getUTCDate());
  const dias = Math.round((t - base) / 86400000);
  return dias > 0 ? Math.ceil(dias / 7) : 0;
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
