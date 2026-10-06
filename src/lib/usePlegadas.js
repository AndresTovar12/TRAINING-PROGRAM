import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { mueveEn } from '@/lib/arrastrar';

/**
 * QUÉ WORKOUTS ESTÁN PLEGADOS.
 *
 * Andrés, 5 oct 2026, con la maqueta aprobada: en un día con DOS workouts (o una sesión doble de las de `blocks`) cada
 * uno se pliega con su botón y deja solo su encabezado y «N sets · M ejercicios». Con uno solo no hay nada que plegar.
 *
 * Plegar es cosa de la pantalla: NO es un cambio del plan (no entra al historial ni lo enciende «Guardar»). Pero al
 * deshacer vuelve como estaba (va dentro de `lugar` de la foto, ver `useHistorial`) y al reordenar sigue a su workout.
 *
 * Cada workout tiene una llave de texto (`fase:semana:día`, y `:bN` si es una sesión de `blocks`); lo plegado es
 * `{ [llave]: true }`. Quien pinta recibe el contexto y mira solo su llave.
 */
export const PlegadasContext = createContext(null);
export const usePlegadasDelEditor = () => useContext(PlegadasContext);

export function usePlegadas() {
  const [pl, setPl] = useState({});
  const alterna = useCallback((clave) => setPl((p) => ({ ...p, [clave]: !p[clave] })), []);
  // Un workout cambió de lugar: lo plegado lo sigue. `claves`: las llaves de la lista, en el orden de ANTES; `de` y `a`, el movimiento.
  const reordena = useCallback((claves, de, a) => setPl((p) => {
    const nuevos = mueveEn(claves.map((c) => !!p[c]), de, a);
    const n = { ...p };
    claves.forEach((c, i) => { n[c] = nuevos[i]; });
    return n;
  }), []);
  const restaura = useCallback((obj) => setPl(obj ?? {}), []);
  const valor = useMemo(() => ({ pl, alterna, reordena }), [pl, alterna, reordena]);
  return { pl, alterna, reordena, restaura, valor };
}
