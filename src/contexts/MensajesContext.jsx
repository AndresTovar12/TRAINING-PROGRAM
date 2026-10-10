import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { cuentaSinLeer, leeBandeja, suscribeMensajes } from '@/lib/mensajesApi';

/* LOS MENSAJES DE QUIEN ENTRÓ: la bandeja (una fila por conversación), el número rojo y un aviso cuando algo cambia.

   Es de la CUENTA que entró, no de la persona cuya app se está mirando: un coach que abre la app de su atleta («Ver como») no lee los mensajes de ese atleta.
   La base manda por una conexión en vivo lo que cambia (un mensaje nuevo, un «visto», uno borrado); además se vuelve a preguntar al volver a la pestaña y cada minuto,
   por si la conexión se cayó. `version` sube con cada cambio: una conversación abierta lo usa para volver a leer sus mensajes. */

const Contexto = createContext(null);

function Interno({ children }) {
  const { user, profile } = useAuth();
  const uid = user?.id ?? null;
  const listo = !!uid && !!profile;
  const [estado, setEstado] = useState({ cargando: true, error: null, filas: [], sinLeer: 0 });
  const [version, setVersion] = useState(0);
  const pedido = useRef(0);

  const recarga = useCallback(async () => {
    if (!uid) return;
    const mio = ++pedido.current;
    try {
      const [filas, sinLeer] = await Promise.all([leeBandeja(), cuentaSinLeer(uid)]);
      if (mio === pedido.current) setEstado({ cargando: false, error: null, filas, sinLeer });
    } catch (e) {
      if (mio === pedido.current) setEstado((s) => ({ ...s, cargando: false, error: e?.message ?? 'No se pudieron cargar los mensajes' }));
    }
  }, [uid]);

  useEffect(() => {
    if (!listo) return undefined;
    recarga();
    let espera = null;
    const alCambio = () => {
      setVersion((v) => v + 1);
      clearTimeout(espera);
      espera = setTimeout(recarga, 250);
    };
    const baja = suscribeMensajes(uid, alCambio);
    const alVolver = () => { if (document.visibilityState === 'visible') recarga(); };
    document.addEventListener('visibilitychange', alVolver);
    const minuto = setInterval(alVolver, 60000);
    return () => { baja(); clearTimeout(espera); clearInterval(minuto); document.removeEventListener('visibilitychange', alVolver); };
  }, [listo, uid, recarga]);

  const valor = useMemo(() => ({ uid, ...estado, version, recarga }), [uid, estado, version, recarga]);
  return <Contexto.Provider value={valor}>{children}</Contexto.Provider>;
}

/** Con `key` por cuenta: al cambiar de persona, todo empieza de cero y no se mezcla lo de una con lo de otra. */
export function MensajesProvider({ children }) {
  const { user } = useAuth();
  return <Interno key={user?.id ?? 'sin-sesion'}>{children}</Interno>;
}

/** `{ uid, cargando, error, filas, sinLeer, version, recarga }`. Sin proveedor (una prueba suelta) todo viene vacío. */
export function useMensajes() {
  return useContext(Contexto) ?? { uid: null, cargando: false, error: null, filas: [], sinLeer: 0, version: 0, recarga: () => {} };
}
