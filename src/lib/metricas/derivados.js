/* Lo que las pantallas de métricas muestran, calculado de las filas de la base: un solo lugar para que el resumen, la carga y la recuperación digan lo mismo.

   Recibe lo que devuelven `listActividades`, `listRecuperacion` y `umbralesDe`, y el día de hoy (`AAAA-MM-DD`, local de quien mira). Todo puro: se prueba con Node.

   Este archivo no importa nada de la app (ni `@/`). */
import {
  cambioEnPorCiento, cargaPorDia, curvaDeForma, diaLocal, diasEntre, estadoDeForma, lunesDe, porSemana, rampaDeCondicion, resumenDeRecuperacion, sumaDias, totalesHasta,
} from './forma.js';

/** Los entrenos de la semana (lunes a domingo) que contiene `hoy`, y los de la anterior. */
function deLaSemana(actividades, lunes) {
  const fin = sumaDias(lunes, 6);
  return actividades.filter((a) => {
    const d = diaLocal(a.inicio, a.desfase_min);
    return d >= lunes && d <= fin;
  });
}

const suma = (xs, f) => xs.reduce((s, x) => s + (f(x) ?? 0), 0);

/**
 * Todo lo que necesitan el resumen, la carga y la recuperación:
 *   curva        día por día `{ dia, carga, ctl, atl, tsb }` desde el primer entreno hasta hoy (vacía si no hay entrenos)
 *   forma        el último punto de la curva (hoy): `{ ctl, atl, tsb }`, y `estado` (ver `estadoDeForma`)
 *   rampa        cuánto subió la condición en la última semana
 *   semanas      las últimas 12 semanas (ver `porSemana`)
 *   estaSemana / semanaPasada   sus totales, y `cambios` (por ciento contra la pasada A ESTA ALTURA y sin contar hoy: de lunes a ayer contra de lunes al mismo día de la pasada)
 *   semanaEnCurso  `true` si la semana de hoy todavía no termina (hoy no es domingo)
 *   diasDeLaSemana  los 7 días de esta semana: `{ dia, carga, sesiones, esHoy, futuro }`
 *   zonas4       segundos por zona de las últimas 4 semanas (28 días)
 *   recuperacion lo de `resumenDeRecuperacion`
 *   ultimos      los 5 entrenos más recientes
 *   conPulso     cuántos de los entrenos de las últimas 4 semanas traen pulso (si son pocos, las zonas y la carga valen menos)
 */
export function derivaDelAtleta({ actividades, recuperacion, hoy }) {
  const lista = [...(actividades ?? [])].sort((a, b) => (a.inicio < b.inicio ? 1 : -1));
  const porDia = cargaPorDia(lista);
  const primerDia = lista.length ? diaLocal(lista[lista.length - 1].inicio, lista[lista.length - 1].desfase_min) : null;
  const curva = primerDia ? curvaDeForma(porDia, { desde: primerDia, hasta: hoy }) : [];
  const ultimo = curva[curva.length - 1] ?? null;
  // La forma «de hoy» es la de hoy ANTES de entrenar (condición y fatiga de ayer); si hoy ya entrenó, igual cuenta lo de ayer.
  const estado = ultimo ? estadoDeForma(ultimo.tsb, curva[curva.length - 2]?.ctl ?? ultimo.ctl) : null;

  const lunes = lunesDe(hoy);
  const semanas = porSemana(lista, { semanas: 12, hoy });
  const estaSemana = semanas[semanas.length - 1];
  const semanaPasada = semanas[semanas.length - 2];
  const desde28 = sumaDias(hoy, -27);
  const ultimas4 = lista.filter((a) => diaLocal(a.inicio, a.desfase_min) >= desde28);
  const zonas4 = [0, 0, 0, 0, 0];
  ultimas4.forEach((a) => (a.zonas_s ?? []).forEach((s, i) => { zonas4[i] += s ?? 0; }));
  const datosDeRecuperacion = resumenDeRecuperacion(recuperacion ?? [], { hoy });
  const deHoy = deLaSemana(lista, lunes);
  const transcurridos = diasEntre(lunes, hoy);                                   // 0 el lunes … 6 el domingo
  // La comparación con la semana pasada es «a esta altura» y SIN contar hoy (hoy puede no haber entrenado todavía y siempre saldría «bajó»): de lunes a ayer
  // de esta semana contra de lunes al mismo día de la pasada. El lunes todavía no hay con qué comparar.
  const estaHastaAyer = transcurridos >= 1 ? totalesHasta(lista, { lunes, hasta: sumaDias(hoy, -1) }) : null;
  const pasadaHastaAyer = transcurridos >= 1 ? totalesHasta(lista, { lunes: sumaDias(lunes, -7), hasta: sumaDias(lunes, -7 + transcurridos - 1) }) : null;
  const sesionesPorDia = new Map();
  deHoy.forEach((a) => { const d = diaLocal(a.inicio, a.desfase_min); sesionesPorDia.set(d, (sesionesPorDia.get(d) ?? 0) + 1); });

  return {
    hoy, lista, curva, forma: ultimo, estado, rampa: rampaDeCondicion(curva),
    semanas, estaSemana, semanaPasada,
    semanaEnCurso: transcurridos < 6,
    cambios: {
      carga: estaHastaAyer ? cambioEnPorCiento(estaHastaAyer.carga, pasadaHastaAyer.carga) : null,
      tiempo: estaHastaAyer ? cambioEnPorCiento(estaHastaAyer.duracion_s, pasadaHastaAyer.duracion_s) : null,
    },
    diasDeLaSemana: Array.from({ length: 7 }, (_, i) => {
      const dia = sumaDias(lunes, i);
      return { dia, carga: Math.round(porDia.get(dia) ?? 0), sesiones: sesionesPorDia.get(dia) ?? 0, esHoy: dia === hoy, futuro: dia > hoy };
    }),
    entrenosDeHoy: deHoy.filter((a) => diaLocal(a.inicio, a.desfase_min) === hoy),
    cargaDeLaSemana: Math.round(suma(deHoy, (a) => a.carga)),
    zonas4, conPulso: ultimas4.filter((a) => a.fc_media > 0).length, deLas4: ultimas4.length,
    recuperacion: datosDeRecuperacion,
    ultimos: lista.slice(0, 5),
    primerDia,
    diasDeHistorial: primerDia ? Math.round((Date.parse(`${hoy}T00:00:00Z`) - Date.parse(`${primerDia}T00:00:00Z`)) / 86400000) : 0,
  };
}

/** Las zonas agrupadas en tres palabras: fácil (Z1–Z2), medio (Z3) y duro (Z4–Z5), con su por ciento. `null` si no hay pulso. */
export function facilMedioDuro(zonas) {
  const total = zonas.reduce((s, v) => s + v, 0);
  if (!(total > 0)) return null;
  const p = (a) => Math.round((a / total) * 100);
  const facil = p(zonas[0] + zonas[1]);
  const duro = p(zonas[3] + zonas[4]);
  return { facil, medio: 100 - facil - duro, duro };
}
