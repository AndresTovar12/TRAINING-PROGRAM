import { useCallback } from 'react';
import { useStorage } from '@/contexts/AppStateContext';

/**
 * Los máximos (1RM) y CUÁNDO se guardó cada uno.
 *
 * Andrés, 7 oct 2026: la tarjeta de 1RM de Home enseñaba el máximo más pesado (si el peso muerto pesa más que la
 * sentadilla, siempre salía el peso muerto aunque hubiera actualizado otra cosa). Ahora enseña el que se guardó más
 * recientemente. `wr:onerm` (los kilos de cada levantamiento) no lleva fechas y muchas cosas lo leen tal cual, así que
 * las fechas viajan en otra llave, `wr:onerm-fechas` ({ levantamiento: fecha ISO }). Los máximos de antes no tienen
 * fecha: mientras ninguno la tenga, se enseña el más pesado, como hasta ahora.
 *
 * Los dos sitios que guardan un 1RM (la hoja de 1RM y la ficha del ejercicio) pasan por `useUnRM().ponRM`, para que
 * ninguno se olvide de la fecha.
 */

/** Los máximos guardados (> 0), cada uno con su fecha ('' si no la tiene). */
function guardados(oneRMs, fechas, levantamientos) {
  return levantamientos
    .map((l) => ({ l, kg: Number(oneRMs?.[l.key]), cuando: typeof fechas?.[l.key] === 'string' ? fechas[l.key] : '' }))
    .filter((x) => x.kg > 0);
}

/**
 * El máximo que se enseña en Home: el guardado más recientemente; si ninguno tiene fecha (los de antes), el más pesado.
 * Devuelve `{ nombre, kg }` o null si no hay ninguno.
 */
export function maximoParaHome(oneRMs, fechas, levantamientos) {
  const lista = guardados(oneRMs, fechas, levantamientos);
  if (!lista.length) return null;
  const conFecha = lista.filter((x) => x.cuando);
  const elegido = conFecha.length
    ? conFecha.reduce((a, b) => (b.cuando > a.cuando ? b : a))
    : lista.reduce((a, b) => (b.kg > a.kg ? b : a));
  return { nombre: elegido.l.nombre, kg: elegido.kg };
}

/** Los máximos, sus fechas y `ponRM(llave, kilos)`: guarda el máximo y la fecha de ahora (o los quita si `kilos` viene vacío). */
export function useUnRM() {
  const [oneRMs, setOneRMs] = useStorage('wr:onerm', {});
  const [fechas, setFechas] = useStorage('wr:onerm-fechas', {});
  const ponRM = useCallback((llave, kilos) => {
    setOneRMs((prev) => ({ ...prev, [llave]: kilos }));
    setFechas((prev) => {
      const { [llave]: _antes, ...resto } = prev ?? {};
      return kilos ? { ...resto, [llave]: new Date().toISOString() } : resto;
    });
  }, [setOneRMs, setFechas]);
  return { oneRMs, fechas, ponRM };
}
