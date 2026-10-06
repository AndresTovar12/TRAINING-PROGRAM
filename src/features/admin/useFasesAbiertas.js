import { useCallback, useState } from 'react';

/**
 * Qué fases están abiertas en la guía del editor, y qué semana se ve en cada una.
 *
 * Andrés, 5 oct 2026, con la maqueta aprobada: «las fases se abren y se cierran cada una por su cuenta»: abrir
 * una no cierra las otras. Y abrir NO es editar: lo que se edita (lo que muestra el editor del día) cambia
 * cuando el coach toca algo DENTRO de una fase —una semana, un día—, no al abrirla.
 *
 * `faseId` y `semanaNum` son lo que se está editando ahora. Cada vez que cambian:
 *   · esa fase se abre, si el coach no la había cerrado a propósito (la fase que se edita no se queda escondida);
 *   · se recuerda su semana, para que al editar otra fase esta siga mostrando la que se estaba viendo.
 *
 * Se hace al pintar (no en un efecto), que es como React pide guardar «lo que se vio la última vez»: sin
 * un segundo pintado de por medio, y sin que cada sitio de PlanBuilder que cambia de fase tenga que acordarse.
 *
 * `abiertas[id]`: true (abierta), false (cerrada a propósito) o ausente (todavía no se tocó).
 */
export function useFasesAbiertas(faseId, semanaNum) {
  const [abiertas, setAbiertas] = useState({});
  const [vistas, setVistas] = useState({});
  const [marca, setMarca] = useState(null);

  const clave = faseId == null ? null : `${faseId}|${semanaNum}`;
  if (clave !== marca) {
    setMarca(clave);
    if (faseId != null) {
      setAbiertas((a) => (a[faseId] === undefined ? { ...a, [faseId]: true } : a));
      setVistas((v) => (v[faseId] === semanaNum ? v : { ...v, [faseId]: semanaNum }));
    }
  }

  const abre = useCallback((id) => setAbiertas((a) => (a[id] === true ? a : { ...a, [id]: true })), []);
  const cierra = useCallback((id) => setAbiertas((a) => (a[id] === false ? a : { ...a, [id]: false })), []);
  const recuerda = useCallback((id, num) => setVistas((v) => (v[id] === num ? v : { ...v, [id]: num })), []);
  return { abiertas, vistas, abre, cierra, recuerda };
}
