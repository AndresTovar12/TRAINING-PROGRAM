import { useCallback, useEffect, useState } from 'react';
import {
  cronometroNuevo, cronometroVigente, pausa as pausar, reanuda as reanudar, segundosDe,
} from '@/lib/entrenoLibre';
import { entrenosRecientes } from '@/lib/entrenoLibreApi';

/* El estado del entreno libre. El cronómetro vive en `localStorage` (por persona): así sobrevive a cerrar la hoja, a cambiar de pestaña y a recargar la página; se cuenta con fechas
   (no con «ticks»), así que con la pantalla bloqueada el tiempo sigue corriendo bien. Lo guardado en la base lo piden `entrenosRecientes` y el resumen. */

const llave = (userId) => `tl:entreno-libre:${userId}`;

function lee(userId) {
  try {
    const c = JSON.parse(localStorage.getItem(llave(userId)) ?? 'null');
    return cronometroVigente(c) ? c : null;
  } catch { return null; }
}
function escribe(userId, c) {
  try { if (c) localStorage.setItem(llave(userId), JSON.stringify(c)); else localStorage.removeItem(llave(userId)); } catch { /* sin almacenamiento: el cronómetro vive solo mientras la pantalla esté abierta */ }
}

/** El cronómetro de quien entró: `{ cronometro, segundos, inicia, pausa, reanuda, termina, descarta }`. `termina()` devuelve lo que hace falta para guardar y lo deja listo para borrarse con `descarta()`. */
export function useCronometroLibre(userId) {
  const [cronometro, setCronometro] = useState(() => (userId ? lee(userId) : null)); // (si cambia la persona, la app se vuelve a armar: no hace falta volver a leer)
  const [ahora, setAhora] = useState(() => Date.now());

  // Un tic por segundo solo mientras corre (en pausa o sin cronómetro no se mueve nada).
  const corre = !!cronometro && cronometro.pausadoEn == null;
  useEffect(() => {
    if (!corre) return undefined;
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, [corre]);

  const cambia = useCallback((c) => { setCronometro(c); if (userId) escribe(userId, c); setAhora(Date.now()); }, [userId]);
  return {
    cronometro,
    segundos: segundosDe(cronometro, ahora),
    inicia: (deporte) => cambia(cronometroNuevo(deporte)),
    pausa: () => cambia(pausar(cronometro)),
    reanuda: () => cambia(reanudar(cronometro)),
    termina: () => (cronometro ? { deporte: cronometro.deporte, inicioMs: cronometro.inicio, duracionS: segundosDe(cronometro) } : null),
    descarta: () => cambia(null),
  };
}

/** Los últimos entrenos de quien entró, con `recarga()` para después de guardar uno. */
export function useEntrenosRecientes(userId, n = 6) {
  const [filas, setFilas] = useState(null); // null = cargando
  const [vuelta, setVuelta] = useState(0);
  useEffect(() => {
    if (!userId) return undefined;
    let vivo = true;
    entrenosRecientes(userId, n).then((f) => { if (vivo) setFilas(f); }).catch(() => { if (vivo) setFilas((f) => f ?? []); });
    return () => { vivo = false; };
  }, [userId, n, vuelta]);
  const recarga = useCallback(() => setVuelta((v) => v + 1), []);
  return { filas, recarga };
}
