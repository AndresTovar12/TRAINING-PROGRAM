import {
  createContext, useContext, useEffect, useRef, useState, useCallback, useMemo,
} from 'react';
import { supabase } from '@/lib/supabase';
import { usePerfilDeLaVista } from '@/contexts/VistaContext';
import { diferencia, aplicarParche } from '@/lib/estadoPorPartes';
import { useAviso } from '@/components/AvisoPasajero';

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
 *
 * NUNCA EN SILENCIO (lote 1 de seguridad, 25 oct 2026). Antes, si el guardado fallaba (sin señal, servidor caído) solo quedaba una línea en la
 * consola y la persona seguía creyendo que su entreno estaba guardado. Ahora:
 *   · un guardado que falla avisa «No se guardó. Reintentar» (aviso fijo, ver `AvisoPasajero`), y se reintenta solo (a los 4, 10, 30 y luego cada
 *     60 segundos, y en cuanto vuelve el internet). Lo que no se guardó sigue en memoria: no se pierde mientras la app esté abierta.
 *   · si NO se pudo leer lo que ya había en la base, se avisa y NO se guarda nada hasta lograr leerlo: guardar encima de un estado vacío
 *     borraría lo que la persona tenía.
 */
const AppStateContext = createContext(null);

const SAVE_DEBOUNCE_MS = 600;
// Esperas antes de reintentar un guardado que falló; la última se repite.
const ESPERAS_DE_REINTENTO_MS = [4000, 10000, 30000, 60000];

export function AppStateProvider({ children }) {
  const { userId, soloLectura } = usePerfilDeLaVista();
  const [store, setStore] = useState({});
  const [loaded, setLoaded] = useState(false);
  const { falla, quitaFalla } = useAviso();
  // Sube cada vez que hay que volver a intentar leer la base tras un fallo de lectura.
  const [intentoDeLectura, setIntentoDeLectura] = useState(0);

  /* Lo último que se sabe que tiene la base, y de quién es. Los parches se
     calculan contra esto. Los tres cambian juntos al cargar a una persona:
     un guardado que se arme con ellos siempre habla de la misma cuenta. */
  const enLaBase = useRef({});
  const deQuien = useRef(null);
  const ultimoStore = useRef(store);
  // Los guardados van en fila, uno detrás del otro: dos a la vez podrían
  // llegar desordenados y el viejo quedar encima del nuevo.
  const cola = useRef(Promise.resolve());
  // No se pudo leer la base: mientras sea así, no se guarda nada (ver arriba).
  const lecturaFallida = useRef(false);
  const fallos = useRef(0);
  const relojDeReintento = useRef(null);
  // `guardarAhora` se usa dentro de sí mismo (para reintentar): por eso se llega a ella por un ref.
  const guardarRef = useRef(() => {});

  const guardarAhora = useCallback(() => {
    cola.current = cola.current.then(async () => {
      const usuario = deQuien.current;
      if (!usuario || lecturaFallida.current) return;
      const parche = diferencia(enLaBase.current, ultimoStore.current);
      if (parche === undefined) {
        // No hay nada pendiente: si había un aviso de falla, ya no aplica.
        if (fallos.current > 0) { fallos.current = 0; clearTimeout(relojDeReintento.current); quitaFalla(); }
        return;
      }
      let error;
      try {
        ({ error } = await supabase.rpc('mezclar_mi_estado', { p_usuario: usuario, p_cambios: parche }));
      } catch (e) {
        error = e instanceof Error ? e : new Error(String(e));
      }
      if (error) {
        console.error('user_app_state save error', error.message);
        if (deQuien.current !== usuario) return;
        fallos.current += 1;
        falla('No se guardó. Reintentar', { accion: { texto: 'Reintentar', alTocar: () => guardarRef.current() } });
        clearTimeout(relojDeReintento.current);
        relojDeReintento.current = setTimeout(() => guardarRef.current(), ESPERAS_DE_REINTENTO_MS[Math.min(fallos.current - 1, ESPERAS_DE_REINTENTO_MS.length - 1)]);
        return;
      }
      if (fallos.current > 0) { fallos.current = 0; clearTimeout(relojDeReintento.current); quitaFalla(); }
      // Sobre lo que se sabía, no un reemplazo: si mientras tanto se releyó
      // la base, esto sigue siendo cierto.
      if (deQuien.current === usuario) enLaBase.current = aplicarParche(enLaBase.current, parche);
    });
    return cola.current;
  }, [falla, quitaFalla]);

  useEffect(() => { guardarRef.current = guardarAhora; }, [guardarAhora]);

  // Al volver el internet se intenta de una vez, sin esperar el siguiente reintento.
  useEffect(() => {
    const alVolver = () => { if (fallos.current > 0) guardarRef.current(); };
    window.addEventListener('online', alVolver);
    return () => { window.removeEventListener('online', alVolver); clearTimeout(relojDeReintento.current); };
  }, []);

  // Load the blob whenever the user changes
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    // Otra persona (o la misma, otra vez): se olvida lo que había pendiente de la anterior.
    fallos.current = 0;
    clearTimeout(relojDeReintento.current);
    quitaFalla();

    if (!userId) {
      enLaBase.current = {};
      deQuien.current = null;
      lecturaFallida.current = false;
      setStore({});
      setLoaded(true);
      return;
    }

    (async () => {
      // Se intenta 3 veces antes de rendirse: una señal mala suele volver en unos segundos.
      let respuesta = null;
      for (let intento = 1; intento <= 3; intento += 1) {
        try {
          respuesta = await supabase.from('user_app_state').select('data').eq('user_id', userId).maybeSingle();
        } catch (e) {
          respuesta = { data: null, error: e instanceof Error ? e : new Error(String(e)) };
        }
        if (!respuesta.error || cancelled) break;
        await new Promise((listo) => { setTimeout(listo, 1500 * intento); });
        if (cancelled) return;
      }
      if (cancelled) return;
      if (respuesta?.error) {
        // No se sabe qué hay en la base: se deja la app abierta (vacía) pero SIN guardar nada hasta lograr leer, para no pisar lo que la persona ya tenía.
        console.error('user_app_state load error', respuesta.error.message);
        lecturaFallida.current = true;
        enLaBase.current = {};
        deQuien.current = userId;
        setStore({});
        setLoaded(true);
        falla('No se pudieron cargar tus datos. Reintentar', { accion: { texto: 'Reintentar', alTocar: () => setIntentoDeLectura((n) => n + 1) } });
        return;
      }
      lecturaFallida.current = false;
      quitaFalla();
      const data = respuesta?.data;
      const fresco = data?.data && typeof data.data === 'object' ? data.data : {};
      enLaBase.current = fresco;
      deQuien.current = userId;
      setStore(fresco);
      setLoaded(true);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, intentoDeLectura, falla, quitaFalla]);

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

/**
 * Como `useStorage`, pero también fuera de `<AppStateProvider>` (la cuenta de un coach no lo tiene): ahí devuelve `[def, () => {}, false]` en vez de fallar.
 * El tercer valor dice si de verdad se guarda.
 */
export function useStorageOpcional(key, def) {
  const ctx = useContext(AppStateContext);
  const [defInicial] = useState(def);
  const store = ctx?.store;
  const setStore = ctx?.setStore;
  const value = ctx?.loaded && store && key in store ? store[key] : defInicial;
  const setValue = useCallback(
    (nv) => {
      if (!setStore) return;
      setStore((prev) => {
        const prevVal = prev && key in prev ? prev[key] : defInicial;
        const next = typeof nv === 'function' ? nv(prevVal) : nv;
        if (next === prevVal) return prev;
        return { ...prev, [key]: next };
      });
    },
    [key, setStore, defInicial],
  );
  return [value, setValue, !!ctx];
}
