import {
  createContext, useContext, useEffect, useRef, useState, useCallback, useMemo,
} from 'react';
import { supabase } from '@/lib/supabase';
import { usePerfilDeLaVista } from '@/contexts/VistaContext';
import { diferencia, aplicarParche } from '@/lib/estadoPorPartes';

/**
 * Loads the per-user `user_app_state.data` jsonb blob once, holds it in memory,
 * and persists it (debounced) on change. `useStorage(key, def)` reads/writes
 * individual keys through this store, preserving the exact interface of the
 * original window.storage-based hook so UI code is unchanged.
 *
 * Es el estado de la persona cuya app se dibuja. Si un coach está viendo la app
 * de su atleta (`soloLectura`), se lee el de ese atleta y no se guarda NUNCA:
 * lo que toque el coach vive en memoria y se pierde al salir.
 *
 * SE GUARDA POR PARTES (25 sep 2026). Antes se mandaba el bloque entero en
 * cada cambio. Desde que la IA del atleta también anota entrenamientos, eso
 * borraba lo que la IA anotó mientras la app estaba abierta: la app mandaba
 * encima su copia vieja. Ahora se manda solo lo que cambió y la base lo mezcla
 * (`mezclar_mi_estado`). Ver `lib/estadoPorPartes.js`.
 *
 * Y al volver a la app se relee de la base: si mientras tanto la IA anotó
 * algo, se ve sin recargar la página.
 */
const AppStateContext = createContext(null);

const SAVE_DEBOUNCE_MS = 600;

export function AppStateProvider({ children }) {
  const { userId, soloLectura } = usePerfilDeLaVista();
  const [store, setStore] = useState({});
  const [loaded, setLoaded] = useState(false);

  /* Lo último que se sabe que tiene la base, y de quién es. Los parches se
     calculan contra esto. Los tres cambian juntos al cargar a una persona:
     un guardado que se arme con ellos siempre habla de la misma cuenta. */
  const enLaBase = useRef({});
  const deQuien = useRef(null);
  const ultimoStore = useRef(store);
  // Los guardados van en fila, uno detrás del otro: dos a la vez podrían
  // llegar desordenados y el viejo quedar encima del nuevo.
  const cola = useRef(Promise.resolve());

  const guardarAhora = useCallback(() => {
    cola.current = cola.current.then(async () => {
      const usuario = deQuien.current;
      const parche = diferencia(enLaBase.current, ultimoStore.current);
      if (!usuario || parche === undefined) return;
      const { error } = await supabase.rpc('mezclar_mi_estado', { p_usuario: usuario, p_cambios: parche });
      if (error) {
        console.error('user_app_state save error', error.message);
        return;
      }
      // Sobre lo que se sabía, no un reemplazo: si mientras tanto se releyó
      // la base, esto sigue siendo cierto.
      if (deQuien.current === usuario) enLaBase.current = aplicarParche(enLaBase.current, parche);
    });
    return cola.current;
  }, []);

  // Load the blob whenever the user changes
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);

    if (!userId) {
      enLaBase.current = {};
      deQuien.current = null;
      setStore({});
      setLoaded(true);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from('user_app_state')
        .select('data')
        .eq('user_id', userId)
        .maybeSingle();
      if (cancelled) return;
      const fresco = data?.data && typeof data.data === 'object' ? data.data : {};
      enLaBase.current = fresco;
      deQuien.current = userId;
      setStore(fresco);
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Debounced persistence: solo lo que cambió
  useEffect(() => {
    ultimoStore.current = store;
    if (!loaded || !userId || soloLectura) return undefined;
    const t = setTimeout(guardarAhora, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [store, loaded, userId, soloLectura, guardarAhora]);

  /* Al irse de la app se guarda YA, sin esperar: el atleta puede estar
     pasándose a su IA justo después de anotar. Al volver se relee la base, y
     lo que aún no se guardaba se vuelve a poner encima. */
  useEffect(() => {
    if (!userId || !loaded) return undefined;
    const alCambiar = async () => {
      if (document.visibilityState !== 'visible') {
        if (!soloLectura) guardarAhora();
        return;
      }
      await cola.current;
      const { data, error } = await supabase
        .from('user_app_state')
        .select('data')
        .eq('user_id', userId)
        .maybeSingle();
      if (error || deQuien.current !== userId) return;
      const fresco = data?.data && typeof data.data === 'object' ? data.data : {};
      const pendiente = diferencia(enLaBase.current, ultimoStore.current);
      enLaBase.current = fresco;
      setStore(pendiente === undefined ? fresco : aplicarParche(fresco, pendiente));
    };
    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, [userId, loaded, soloLectura, guardarAhora]);

  const value = useMemo(() => ({ store, setStore, loaded }), [store, loaded]);

  return <AppStateContext.Provider value={value}>{children}</AppStateContext.Provider>;
}

export function useAppState() {
  const ctx = useContext(AppStateContext);
  if (!ctx) throw new Error('useAppState debe usarse dentro de <AppStateProvider>');
  return ctx;
}

/**
 * Drop-in replacement for the original useStorage(key, def) → [value, setValue].
 * Supports both functional and direct-value setters. Before the blob loads,
 * returns `def` (mirroring the original async behavior).
 */
export function useStorage(key, def) {
  const { store, setStore, loaded } = useAppState();
  // El valor por defecto se congela en el primer render. Si no, quien lo pase
  // como objeto o array recién creado tendría uno distinto cada vez y lo que
  // dependa de él se recalcularía sin parar. Va en estado y no en un ref
  // porque leer un ref mientras se dibuja no está permitido.
  const [defInicial] = useState(def);

  const value = loaded && key in store ? store[key] : defInicial;

  const setValue = useCallback(
    (nv) => {
      setStore((prev) => {
        const prevVal = prev && key in prev ? prev[key] : defInicial;
        const next = typeof nv === 'function' ? nv(prevVal) : nv;
        if (next === prevVal) return prev;
        return { ...prev, [key]: next };
      });
    },
    [key, setStore, defInicial],
  );

  return [value, setValue];
}
