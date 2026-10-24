import { useCallback, useEffect, useRef, useState } from 'react';
import { agregaPunto, fuenteDeUbicacion } from '@/lib/ubicacion';
import {
  cronometroNuevo, cronometroVigente, pausa as pausar, reanuda as reanudar, segundosDe,
} from '@/lib/entrenoLibre';
import { entrenosRecientes } from '@/lib/entrenoLibreApi';

/* El estado del entreno libre. El cronómetro vive en `localStorage` (por persona): así sobrevive a cerrar la hoja, a cambiar de pestaña y a recargar la página; se cuenta con fechas
   (no con «ticks»), así que con la pantalla bloqueada el tiempo sigue corriendo bien. Lo guardado en la base lo piden `entrenosRecientes` y el resumen. */

const llave = (userId) => `tl:entreno-libre:${userId}`;
const llaveDeRuta = (userId) => `tl:entreno-libre-ruta:${userId}`;

function lee(userId) {
  try {
    const c = JSON.parse(localStorage.getItem(llave(userId)) ?? 'null');
    return cronometroVigente(c) ? c : null;
  } catch { return null; }
}
function escribe(userId, c) {
  try { if (c) localStorage.setItem(llave(userId), JSON.stringify(c)); else localStorage.removeItem(llave(userId)); } catch { /* sin almacenamiento: el cronómetro vive solo mientras la pantalla esté abierta */ }
}
function leeRuta(userId) {
  try { const r = JSON.parse(localStorage.getItem(llaveDeRuta(userId)) ?? '[]'); return Array.isArray(r) ? r : []; } catch { return []; }
}
function escribeRuta(userId, r) {
  try { if (r?.length) localStorage.setItem(llaveDeRuta(userId), JSON.stringify(r)); else localStorage.removeItem(llaveDeRuta(userId)); } catch { /* sin almacenamiento: la ruta vive mientras la pantalla esté abierta */ }
}

/**
 * La señal del GPS ANTES de salir («Buscando señal…» → «GPS listo»): escucha la fuente mientras `activo` y dice cómo va.
 * Devuelve 'no_hay' | 'buscando' | 'lista' | 'negado' | 'sin_senal'.
 */
export function useSenalGps(activo) {
  const fuente = fuenteDeUbicacion();
  const hay = fuente.disponible();
  const [estado, setEstado] = useState('buscando');
  useEffect(() => {
    if (!activo || !hay) return undefined;
    return fuente.sigue((p) => setEstado(p.precision <= 30 ? 'lista' : 'buscando'), (e) => setEstado(e));
  }, [activo, hay, fuente]);
  return hay ? estado : 'no_hay';
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

  /* LA RUTA (solo si se empezó con GPS): cada punto de la fuente se vuelve una muestra en el segundo del entreno (sin pausas). En pausa no se escucha.
     Se guarda en `localStorage` como el cronómetro, para que sobreviva a cerrar la hoja o recargar. Con la pantalla bloqueada el navegador deja de medir;
     la app instalable trae su fuente con segundo plano (ver `lib/ubicacion.js`). */
  const [muestras, setMuestras] = useState(() => (userId ? leeRuta(userId) : []));
  const vivo = useRef(cronometro);
  useEffect(() => { vivo.current = cronometro; });
  const conGps = corre && !!cronometro?.gps;
  useEffect(() => {
    if (!conGps) return undefined;
    const fuente = fuenteDeUbicacion();
    if (!fuente.disponible()) return undefined;
    // La pantalla encendida: sin ella el navegador deja de dar puntos. Si el navegador no sabe, sigue igual.
    let candado = null;
    navigator.wakeLock?.request?.('screen').then((c) => { candado = c; }, () => {});
    const parar = fuente.sigue((p) => {
      setMuestras((m) => {
        const nuevas = agregaPunto(m, p, segundosDe(vivo.current));
        if (nuevas !== m && userId) escribeRuta(userId, nuevas);
        return nuevas;
      });
    }, () => {});
    return () => { parar(); candado?.release?.().catch(() => {}); };
  }, [conGps, userId]);
  const cambiaRuta = useCallback((r) => { setMuestras(r); if (userId) escribeRuta(userId, r); }, [userId]);

  return {
    cronometro,
    segundos: segundosDe(cronometro, ahora),
    muestras,
    // `actividad`: la que eligió (`lib/actividades.js`): su nombre y emoji se ven mientras corre y se guardan como título del entreno.
    inicia: (deporte, { gps = false, actividad = null } = {}) => {
      cambiaRuta([]);
      cambia({ ...cronometroNuevo(deporte), ...(gps ? { gps: true } : {}), ...(actividad ? { actividad: { id: actividad.id, nombre: actividad.nombre, emoji: actividad.emoji, gps: !!actividad.gps } } : {}) });
    },
    pausa: () => cambia(pausar(cronometro)),
    reanuda: () => cambia(reanudar(cronometro)),
    termina: () => (cronometro ? { deporte: cronometro.deporte, actividad: cronometro.actividad ?? null, inicioMs: cronometro.inicio, duracionS: segundosDe(cronometro), muestras: cronometro.gps ? muestras : null } : null),
    descarta: () => { cambiaRuta([]); cambia(null); },
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
