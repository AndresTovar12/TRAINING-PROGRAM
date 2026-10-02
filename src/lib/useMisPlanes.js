import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { listarMisPlanes } from '@/lib/misPlanes';

/**
 * Las carpetas y lo guardado de quien tiene la sesión abierta.
 *
 * `recargar()` vuelve a leerlo todo; las pantallas lo llaman después de cada cambio (la lista es
 * chica: carpetas y resúmenes, no el contenido de cada cosa). `cargando` solo es verdad la primera
 * vez: al recargar se sigue enseñando lo que había, sin parpadear.
 */
export function useMisPlanes() {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [estado, setEstado] = useState({ cargando: true, error: '', carpetas: [], items: [] });
  // Para no pisar una lectura nueva con una vieja que llega tarde.
  const vuelta = useRef(0);

  const recargar = useCallback(async () => {
    if (!userId) return;
    const esta = ++vuelta.current;
    try {
      const { carpetas, items } = await listarMisPlanes(userId);
      if (esta === vuelta.current) setEstado({ cargando: false, error: '', carpetas, items });
    } catch (e) {
      if (esta === vuelta.current) setEstado((prev) => ({ ...prev, cargando: false, error: e.message || 'No se pudo cargar Mis planes' }));
    }
  }, [userId]);

  useEffect(() => {
    // La carga va en una función aparte: llamarla aquí no pone estado de golpe dentro del efecto.
    recargar();
  }, [recargar]);

  return { ...estado, userId, recargar };
}
