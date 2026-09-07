import {
  createContext, useContext, useEffect, useRef, useState, useCallback, useMemo,
} from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Loads the per-user `user_app_state.data` jsonb blob once, holds it in memory,
 * and persists the whole blob (debounced) on change. `useStorage(key, def)`
 * reads/writes individual keys through this store, preserving the exact
 * interface of the original window.storage-based hook so UI code is unchanged.
 */
const AppStateContext = createContext(null);

const SAVE_DEBOUNCE_MS = 600;

export function AppStateProvider({ children }) {
  const { user } = useAuth();
  const [store, setStore] = useState({});
  const [loaded, setLoaded] = useState(false);

  const saveTimer = useRef(null);
  const skipNextSave = useRef(true); // avoid echo-write right after initial load

  // Load the blob whenever the user changes
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    skipNextSave.current = true;

    if (!user) {
      setStore({});
      setLoaded(true);
      return;
    }

    (async () => {
      const { data } = await supabase
        .from('user_app_state')
        .select('data')
        .eq('user_id', user.id)
        .maybeSingle();
      if (cancelled) return;
      setStore(data?.data && typeof data.data === 'object' ? data.data : {});
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.id]);

  // Debounced persistence of the whole blob
  useEffect(() => {
    if (!loaded || !user) return;
    if (skipNextSave.current) {
      skipNextSave.current = false;
      return;
    }
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      supabase
        .from('user_app_state')
        .upsert({
          user_id: user.id,
          // `store` de este render, no una copia guardada aparte: el efecto
          // depende de `store`, y su limpieza cancela el temporizador anterior
          // en cada cambio. O sea que el que llega a guardarse es siempre el
          // último. La copia en un ref no hacía falta y solo podía desfasarse.
          data: store,
          updated_at: new Date().toISOString(),
        })
        .then(({ error }) => {
          if (error) console.error('user_app_state save error', error.message);
        });
    }, SAVE_DEBOUNCE_MS);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [store, loaded, user?.id, user]);

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
