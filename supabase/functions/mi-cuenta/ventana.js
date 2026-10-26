/* LA VENTANA DE UN PLAN COMPRADO: qué ve de verdad quien lo compró.

   Andrés, 10-11 oct 2026: quien compra un plan ve lo que ya entrenó, lo de hoy y UN MES hacia adelante (el coach puede cambiarlo por plan). Del resto, solo los nombres de
   las fases y las semanas, y los entrenamientos borrosos. No es un efecto de pantalla sobre datos escondidos: este archivo QUITA los ejercicios de lo que no se ve, y se corre
   en el SERVIDOR (Edge Function `programa-comprado`) antes de mandar nada. Lo que no viaja no se puede copiar.

   · La semana en que va se cuenta con el calendario desde el día de la compra (`inicio`), igual que la app (`cursorAlDia` de training-utils: una semana ISO = una semana del plan).
     Se cuenta con la fecha del SERVIDOR, nunca con la del teléfono (una fecha falsa abriría semanas de más). Va 12 horas atrás para no adelantarse a nadie en ningún huso horario:
     en México la semana siguiente se abre a las 7 de la mañana del lunes, y como la ventana siempre trae al menos una semana de sobra, nadie lo nota.
   · El comprador entra por la fase y la semana que ELIGIÓ al comprar (cualquiera, incluso a la mitad de una fase; Andrés, 12 oct 2026): lo anterior no existe para él (no se le manda).
   · Un plan semanal (una sola semana que se repite) no se recorta; solo se cierra si la compra ya no está al día.
   · Con la compra vencida, cancelada o reembolsada todo queda cerrado (nombres y nada más): conserva su historial de lo que anotó, no el plan.

   Este archivo no importa nada: lo usan la app (para probarlo) y la Edge Function (copia exacta, ver `scripts/compartir-con-mcp.mjs`). */

const DIA_MS = 24 * 3600 * 1000;
const ESTADOS_CERRADOS = new Set(['pendiente', 'por_armar', 'vencida', 'cancelada', 'reembolsada']);

/** Un día como fecha a medianoche UTC. Acepta 'AAAA-MM-DD' o una Date (se toman sus partes UTC). */
const comoFecha = (t) => {
  if (t instanceof Date) return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
  const [a, m, d] = String(t).slice(0, 10).split('-').map(Number);
  return new Date(Date.UTC(a, m - 1, d));
};
const lunesDe = (f) => { const d = new Date(f); d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() || 7) - 1)); return d; };

/** La semana ISO de un día, como la guarda la app en `fijadoEn`: '2026-W42'. */
export function claveSemanaIso(t) {
  const d = comoFecha(t);
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); // el jueves de esa semana
  const inicioDeAnio = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const semana = Math.ceil(((d - inicioDeAnio) / DIA_MS + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(semana).padStart(2, '0')}`;
}

/** Cuántas semanas de calendario (lunes a domingo) van del día de la compra a hoy. Nunca negativo. */
export const semanasTranscurridas = (inicio, hoy) => Math.max(0, Math.round((lunesDe(comoFecha(hoy)) - lunesDe(comoFecha(inicio))) / (7 * DIA_MS)));

/** «Hoy» del servidor: 12 horas atrás, para no adelantarse a ningún huso horario. Devuelve 'AAAA-MM-DD'. */
export function hoyDelServidor(ahora = new Date()) {
  const d = new Date(ahora.getTime() - 12 * 3600 * 1000);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
}

const copia = (x) => JSON.parse(JSON.stringify(x ?? null));

/** Una semana cerrada: solo su número y los nombres de sus días. Nada de lo que hay que hacer. */
const semanaCerrada = (semana) => ({
  num: semana?.num,
  bloqueada: true,
  days: (semana?.days ?? []).map((d) => ({ day: d?.day, bloqueada: true })),
});

/**
 * Recorta el programa de una compra.
 *   data: lo publicado (`{ kind, estructura, phases, foto, ciencia }`) · inicio: el día de la compra · faseDeEntrada: id de la fase por donde entró
 *   semanaDeEntrada: el número de la semana de esa fase donde empieza (null = la primera; las anteriores de esa fase tampoco se le mandan)
 *   ventanaSemanas: semanas visibles hacia adelante (null = todas) · estado: el de la compra · hoy: 'AAAA-MM-DD' (por defecto, el del servidor)
 * Devuelve `{ data, cursorInicial, resumen }`: el programa ya recortado, dónde empieza el puntero del atleta y unos números para la pantalla.
 */
export function recortaPrograma({ data, inicio, faseDeEntrada = null, semanaDeEntrada = null, ventanaSemanas = 4, estado = 'activa', hoy = hoyDelServidor() }) {
  const base = copia(data) ?? {};
  const semanal = base.kind === 'weekly';
  const todas = Array.isArray(base.phases) ? base.phases : [];
  const entrada = semanal ? 0 : Math.max(0, todas.findIndex((f) => f?.id === faseDeEntrada));
  let fases = semanal ? todas : todas.slice(entrada);
  // A la mitad de una fase: las semanas de esa fase que quedan antes de la que eligió no existen para él.
  if (!semanal && semanaDeEntrada != null && fases[0]) {
    const semanas = Array.isArray(fases[0].weekData) ? fases[0].weekData : [];
    const desde = semanas.findIndex((w) => w?.num === Number(semanaDeEntrada));
    if (desde > 0) fases = [{ ...fases[0], weekData: semanas.slice(desde) }, ...fases.slice(1)];
  }

  const secuencia = [];
  fases.forEach((f, i) => (f?.weekData ?? []).forEach((_, j) => secuencia.push([i, j])));
  const total = secuencia.length;
  const cerrado = ESTADOS_CERRADOS.has(estado);
  const pasadas = semanal ? 0 : semanasTranscurridas(inicio, hoy);
  const actual = total ? Math.min(pasadas, total - 1) : 0;
  const hasta = semanal || ventanaSemanas == null ? total - 1 : Math.min(total - 1, actual + Math.max(1, ventanaSemanas));

  const lugar = new Map(secuencia.map(([i, j], idx) => [`${i}:${j}`, idx]));
  const recortadas = fases.map((fase, i) => ({
    ...fase,
    weekData: (fase.weekData ?? []).map((semana, j) => (cerrado || lugar.get(`${i}:${j}`) > hasta ? semanaCerrada(semana) : semana)),
  }));

  const primera = recortadas[0];
  return {
    data: { ...base, phases: recortadas },
    cursorInicial: primera
      ? { phaseId: primera.id, weekNum: primera.weekData?.[0]?.num ?? 1, dayIdx: 0, fijadoEn: claveSemanaIso(inicio) }
      : null,
    resumen: {
      kind: semanal ? 'weekly' : 'periodized',
      estado,
      cerrado,
      fases: fases.length,
      semanasTotales: total,
      semanaActual: total ? actual + 1 : 0,
      visiblesHasta: cerrado ? 0 : hasta + 1,
    },
  };
}

/**
 * Cuándo termina el plan de una compra, en segundos desde 1970 (como los pide Stripe), o `null` si no tiene fin.
 * Es el lunes de la semana en que la compra empezó + las semanas que le tocan (las de la fase por donde entró en adelante) = el final de su última semana.
 * Lo usa `mi-cuenta` al borrarse la cuenta de un coach: a cada comprador se le cobra hasta aquí y ya (Andrés, 26 oct 2026). Un plan semanal (se repite) o sin datos no tiene fin.
 */
export function finDelPlan({ data, inicio, faseDeEntrada = null, semanaDeEntrada = null, hoy = hoyDelServidor() }) {
  if (!data) return null;
  const r = recortaPrograma({ data, inicio: inicio ?? hoy, faseDeEntrada, semanaDeEntrada, ventanaSemanas: null, estado: 'activa', hoy });
  const semanas = r.resumen.semanasTotales;
  if (r.resumen.kind === 'weekly' || !semanas) return null;
  const fin = lunesDe(comoFecha(inicio ?? hoy));
  fin.setUTCDate(fin.getUTCDate() + semanas * 7);
  fin.setUTCHours(12, 0, 0, 0);
  return Math.floor(fin.getTime() / 1000);
}
