import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import { mueveEn } from '@/lib/arrastrar';

/**
 * QUÉ WORKOUTS ESTÁN PLEGADOS.
 *
 * Andrés, 5 oct 2026, con la maqueta aprobada: cada workout se pliega con su botón y deja solo su encabezado y su
 * resumen. Y el 6 oct: «que incluso los días que solo tienen un workout se puedan plegar y desplegar con botoncito,
 * y que por default vengan plegados». Ahora se pliegan TODOS (los de un día con uno solo también) y una sesión doble
 * (`blocks`) pliega cada una de las suyas.
 *
 * Plegar es cosa de la pantalla: NO es un cambio del plan (no entra al historial ni lo enciende «Guardar»). Pero al
 * deshacer vuelve como estaba (va dentro de `lugar` de la foto, ver `useHistorial`) y al reordenar sigue a su workout.
 *
 * Cada workout tiene una llave de texto (`fase:semana:día`, y `:bN` si es una sesión de `blocks`); lo plegado es
 * `{ [llave]: true }` y lo abierto `{ [llave]: false }`. Quien pinta recibe el contexto y mira solo su llave.
 *
 * El editor del programa DECIDE cómo viene cada llave la primera vez que se ve (`decide`): con algo adentro, plegado; vacío,
 * abierto. Una vez decidido ya no cambia solo —agregarle el primer ejercicio a un workout vacío no lo pliega en medio de lo
 * que se está haciendo—; sin decisión (los editores que no la toman, como el de «Mis planes») un workout viene abierto.
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
  // Se quitó el workout `indice` de una lista (`prefijo`: `fase:semana:` o `fase:semana:día:b`): los de después suben un lugar y se llevan lo suyo.
  const quitaLugar = useCallback((prefijo, indice) => setPl((p) => {
    const n = {};
    Object.entries(p).forEach(([c, v]) => {
      if (!c.startsWith(prefijo)) { n[c] = v; return; }
      const [num, ...cola] = c.slice(prefijo.length).split(':');
      const i = Number(num);
      if (i === indice) return;
      n[prefijo + (i > indice ? i - 1 : i) + (cola.length ? `:${cola.join(':')}` : '')] = v;
    });
    return n;
  }), []);
  // Estos workouts se ven abiertos (`claves`): los que el coach acaba de agregar. Pisa lo que hubiera en esa llave.
  const abre = useCallback((claves) => setPl((p) => {
    const n = { ...p };
    claves.forEach((c) => { n[c] = false; });
    return n;
  }), []);
  // Cómo viene cada llave que todavía no tiene decisión (`{ llave: plegada }`). Las que ya la tienen no se tocan.
  const decide = useCallback((porDefecto) => setPl((p) => {
    const nuevas = Object.entries(porDefecto).filter(([c]) => !(c in p));
    return nuevas.length ? { ...p, ...Object.fromEntries(nuevas) } : p;
  }), []);
  const restaura = useCallback((obj) => setPl(obj ?? {}), []);
  const valor = useMemo(() => ({ pl, alterna, reordena, quitaLugar }), [pl, alterna, reordena, quitaLugar]);
  return { pl, alterna, reordena, quitaLugar, abre, decide, restaura, valor };
}
