import {
  createContext, useContext, useEffect, useRef, useState, useCallback, useMemo, useSyncExternalStore,
} from 'react';
import { supabase } from '@/lib/supabase';
import { usePerfilDeLaVista } from '@/contexts/VistaContext';
import { diferencia, aplicarParche } from '@/lib/estadoPorPartes';
import { abreCopia, armaCopia, claveDelEstado, cuantasCosas, ponEncima, rebasa } from '@/lib/copiaDelEstado';
import { conCopiaEnElTelefono, guardaEnElTelefono, leeDelTelefono } from '@/lib/almacenDelTelefono';
import { ponCosasDelEstado, registraPuertaDelEstado } from '@/lib/colaDelTelefono';
import { esperaDeReintento } from '@/lib/colaDeSubida';
import { alVolverLaSenal, esFaltaDeSenal, haySenalAhora, marcaConSenal, marcaSinSenal, sinRedEnElTelefono } from '@/lib/senal';
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
 *   · un guardado que falla se reintenta solo (a los 4, 10, 30 y luego cada 60 segundos, y en cuanto vuelve el internet).
 *   · si NO se pudo leer lo que ya había en la base (y no hay copia en el teléfono, ver abajo), se avisa y NO se guarda nada hasta lograr leerlo:
 *     guardar encima de un estado vacío borraría lo que la persona tenía.
 *
 * SIN CONEXIÓN EN EL IPHONE (1 nov 2026, encargo «sin conexión», parte 2; ver `docs/sin-conexion.md`). En la app (no en la web) el estado vive también
 * en el teléfono (`lib/copiaDelEstado.js`): lo último que se sabe de la base y lo pendiente encima, en un solo guardado.
 *   · ABRIR SIN SEÑAL: se dibuja con la copia y la app funciona normal (`confirmado` es falso). Lo que la persona hace se guarda en la copia.
 *   · VOLVER LA SEÑAL: primero se relee la base (lo de la base manda) y luego se sube lo pendiente con `mezclar_mi_estado`, como siempre.
 *   · MIENTRAS SE USA LA COPIA, lo que la app adelanta SOLA (el marcador que el calendario mueve, ver `TrainingApp`) no se guarda: saldría de una
 *     copia que puede tener días y pisaría, p. ej., el plan que su coach movió mientras tanto. Lo que la persona hace a mano sí se guarda.
 *   · Un guardado que falla por falta de señal ya no enseña «No se guardó»: lo pendiente está en el teléfono y el aviso de arriba dice que se sube solo.
 *     Un RECHAZO del servidor sí lo enseña, y ya no se reintenta solo para siempre: con «Reintentar», con el siguiente cambio o al abrir la app.
 *   · En la web todo sigue como antes (sin copia): un fallo por señal enseña «No se guardó. Reintentar», porque ahí lo pendiente solo vive en memoria.
 *
 * EL ESTADO Y SU BASE, SIEMPRE JUNTOS (1 nov 2026). El parche se saca de dos cosas: lo que hay en pantalla y lo último que se sabe de la base. Si un
 * día se sacara de una pantalla vieja con una base nueva, el parche «desharía» lo que otro aparato escribió. Antes el estado vivía en `useState` y su
 * espejo (`ultimoStore`) se ponía al día un instante DESPUÉS de dibujar: en ese hueco un reintento podía armar justo ese parche. Ahora el estado vive
 * en un almacén propio que cambia en el acto (`useSyncExternalStore`): la base y el estado cambian juntos, sin `await` en medio.
 */
const AppStateContext = createContext(null);

const SAVE_DEBOUNCE_MS = 600;
// La copia del teléfono se escribe casi de una vez después de cada cambio (y en el acto al irse de la app): lo que se anotó no espera a la base.
const COPIA_DEBOUNCE_MS = 250;
const espera = (ms) => new Promise((listo) => { setTimeout(listo, ms); });
const deLaFila = (respuesta) => (respuesta?.data?.data && typeof respuesta.data.data === 'object' ? respuesta.data.data : {});

export function AppStateProvider({ children }) {
  const { userId, soloLectura } = usePerfilDeLaVista();
  // La copia del teléfono: solo en la app de iPhone y solo en la app propia (nunca la del atleta que su coach está viendo).
  const conCopia = conCopiaEnElTelefono() && !soloLectura;

  // El estado, en un almacén propio que cambia en el acto (ver «SIEMPRE JUNTOS»).
  const actual = useRef({});
  const escuchas = useRef(new Set());
  const suscribe = useCallback((f) => { escuchas.current.add(f); return () => escuchas.current.delete(f); }, []);
  const leeActual = useCallback(() => actual.current, []);
  const store = useSyncExternalStore(suscribe, leeActual, leeActual);
  const setStore = useCallback((nuevo) => {
    const antes = actual.current;
    const despues = typeof nuevo === 'function' ? nuevo(antes) : nuevo;
    if (despues === antes) return;
    actual.current = despues;
    for (const f of [...escuchas.current]) f();
  }, []);

  const [loaded, setLoaded] = useState(false);
  // Se dibuja con la copia del teléfono: todavía no se logra leer la base desde que se abrió.
  const [deLaCopia, setDeLaCopia] = useState(false);
  const { falla, quitaFalla } = useAviso();
  // Sube cada vez que hay que volver a intentar leer la base tras un fallo de lectura.
  const [intentoDeLectura, setIntentoDeLectura] = useState(0);

  /* Lo último que se sabe que tiene la base, y de quién es. Los parches se
     calculan contra esto. Los tres cambian juntos al cargar a una persona:
     un guardado que se arme con ellos siempre habla de la misma cuenta. */
  const enLaBase = useRef({});
  const deQuien = useRef(null);
  // Las lecturas y los guardados van en fila, uno detrás del otro: dos a la vez podrían
  // llegar desordenados y el viejo quedar encima del nuevo.
  const cola = useRef(Promise.resolve());
  // No se pudo leer la base y no hay copia: mientras sea así, no se guarda nada (ver arriba).
  const lecturaFallida = useRef(false);
  const desdeLaCopia = useRef(false);
  const fallos = useRef(0);
  const relojDeReintento = useRef(null);
  const relojDeCopia = useRef(null);
  // `guardarAhora` se usa dentro de sí mismo (para reintentar): por eso se llega a ella por un ref.
  const guardarRef = useRef(() => {});

  const encola = useCallback((tarea) => {
    const hecha = cola.current.then(tarea, tarea);
    cola.current = hecha.then(() => {}, () => {});
    return hecha;
  }, []);

  /** Escribe la copia del teléfono (la base conocida y lo pendiente, juntos). Nunca sin base: si no se pudo leer y no había copia, no hay nada que guardar. */
  const persisteCopia = useCallback(() => {
    clearTimeout(relojDeCopia.current);
    const usuario = deQuien.current;
    if (!conCopia || !usuario || lecturaFallida.current) return Promise.resolve(false);
    const copia = armaCopia(enLaBase.current, actual.current);
    ponCosasDelEstado(usuario, cuantasCosas(copia.pendiente));
    return guardaEnElTelefono(claveDelEstado(usuario), copia);
  }, [conCopia]);

  const quitaAvisoDeFalla = useCallback(() => {
    fallos.current = 0;
    clearTimeout(relojDeReintento.current);
    quitaFalla('estado');
  }, [quitaFalla]);

  const programaReintento = useCallback(() => {
    clearTimeout(relojDeReintento.current);
    relojDeReintento.current = setTimeout(() => guardarRef.current(), esperaDeReintento(fallos.current));
  }, []);

  /** Lee la base y pone encima lo pendiente (`rebasa`). Va DENTRO de la fila (`encola`). `true` si se pudo leer. */
  const releer = useCallback(async () => {
    const usuario = deQuien.current;
    // Sin base conocida (no se pudo leer y no hay copia) no se junta nada: lo hecho sobre una pantalla vacía no se pone encima de la base.
    if (!usuario || lecturaFallida.current) return false;
    // El teléfono dice que no tiene red: ni se intenta (ver `sinRedEnElTelefono`); en cuanto vuelva, `alVolverLaSenal` lo pide.
    if (conCopia && sinRedEnElTelefono()) { marcaSinSenal(); return false; }
    let respuesta;
    try {
      respuesta = await supabase.from('user_app_state').select('data').eq('user_id', usuario).maybeSingle();
    } catch (e) {
      respuesta = { data: null, error: e instanceof Error ? e : new Error(String(e)), status: 0 };
    }
    if (deQuien.current !== usuario) return false;
    if (respuesta.error) {
      if (esFaltaDeSenal(respuesta.error, respuesta.status)) marcaSinSenal();
      return false;
    }
    marcaConSenal();
    const fresco = deLaFila(respuesta);
    // SIEMPRE JUNTOS: la diferencia se saca y la base se cambia en el mismo paso, sin `await` en medio.
    const nuevo = rebasa(fresco, enLaBase.current, actual.current);
    enLaBase.current = fresco;
    if (desdeLaCopia.current) { desdeLaCopia.current = false; setDeLaCopia(false); }
    setStore(nuevo);
    await persisteCopia();
    return true;
  }, [conCopia, persisteCopia, setStore]);

  /** Sube lo pendiente (o, con la copia del teléfono, primero relee la base). Va DENTRO de la fila. */
  const guardar = useCallback(async () => {
    const usuario = deQuien.current;
    if (!usuario || lecturaFallida.current) return;
    await persisteCopia(); // lo pendiente, primero en el teléfono
    if (deQuien.current !== usuario) return;
    if (desdeLaCopia.current) {
      const leida = await releer();
      if (!leida) {
        if (deQuien.current === usuario) { fallos.current += 1; programaReintento(); }
        return;
      }
    }
    const parche = diferencia(enLaBase.current, actual.current);
    if (parche === undefined) {
      // No hay nada pendiente: si había un aviso de falla, ya no aplica.
      quitaAvisoDeFalla();
      return;
    }
    if (conCopia && sinRedEnElTelefono()) {
      // Sin red ni se intenta: lo pendiente ya está en el teléfono y se sube en cuanto vuelva (`alVolverLaSenal`) o en el siguiente reintento.
      marcaSinSenal();
      fallos.current += 1;
      programaReintento();
      return;
    }
    let error;
    let status;
    try {
      ({ error, status } = await supabase.rpc('mezclar_mi_estado', { p_usuario: usuario, p_cambios: parche }));
    } catch (e) {
      error = e instanceof Error ? e : new Error(String(e));
      status = 0;
    }
    if (deQuien.current !== usuario) return;
    if (error) {
      console.error('user_app_state save error', error.message);
      const otraVez = { texto: 'Reintentar', alTocar: () => guardarRef.current() };
      if (esFaltaDeSenal(error, status)) {
        marcaSinSenal();
        fallos.current += 1;
        programaReintento();
        if (!conCopia) falla('No se guardó. Reintentar', { clave: 'estado', accion: otraVez });
      } else {
        // Rechazo: reintentar solo no lo arregla. Se avisa y lo pendiente se queda (en el teléfono, en la app) hasta que la persona reintente.
        clearTimeout(relojDeReintento.current);
        fallos.current = 0;
        falla('No se guardó. Reintentar', { clave: 'estado', accion: otraVez });
      }
      return;
    }
    marcaConSenal();
    quitaAvisoDeFalla();
    // Sobre lo que se sabía, no un reemplazo: si mientras tanto se releyó la base, esto sigue siendo cierto.
    enLaBase.current = aplicarParche(enLaBase.current, parche);
    await persisteCopia();
  }, [persisteCopia, releer, programaReintento, quitaAvisoDeFalla, falla, conCopia]);

  const guardarAhora = useCallback(() => encola(guardar), [encola, guardar]);
  useEffect(() => { guardarRef.current = guardarAhora; }, [guardarAhora]);

  // Al volver el internet se intenta de una vez, sin esperar el siguiente reintento (y si nunca se pudo leer la base, se vuelve a intentar leerla).
  useEffect(() => {
    const quita = alVolverLaSenal(() => {
      if (!deQuien.current) return;
      if (lecturaFallida.current) { setIntentoDeLectura((n) => n + 1); return; }
      if (fallos.current > 0 || desdeLaCopia.current) guardarRef.current();
    });
    return () => { quita(); clearTimeout(relojDeReintento.current); };
  }, []);

  // Load the blob whenever the user changes
  useEffect(() => {
    let cancelled = false;
    setLoaded(false);
    // Otra persona (o la misma, otra vez): se olvida lo que había pendiente de la anterior (lo suyo ya está en SU copia del teléfono).
    fallos.current = 0;
    clearTimeout(relojDeReintento.current);
    quitaFalla('estado');
    desdeLaCopia.current = false;
    setDeLaCopia(false);

    if (!userId) {
      enLaBase.current = {};
      deQuien.current = null;
      lecturaFallida.current = false;
      setStore({});
      setLoaded(true);
      return undefined;
    }

    (async () => {
      // Con su tope de 3 s: si el teléfono no contesta, se sigue sin copia y esa copia no se pisa (`lib/almacenDelTelefono.js`).
      const copia = conCopia ? abreCopia(await leeDelTelefono(claveDelEstado(userId))) : null;
      if (cancelled) return;
      const conBase = !!copia?.enLaBase;
      const entraConLaCopia = () => {
        enLaBase.current = copia.enLaBase;
        deQuien.current = userId;
        lecturaFallida.current = false;
        desdeLaCopia.current = true;
        setDeLaCopia(true);
        setStore(copia.store);
        setLoaded(true);
        quitaFalla('lectura');
        ponCosasDelEstado(userId, cuantasCosas(copia.pendiente));
        // Se vuelve a intentar leer la base con las esperas de siempre (y de una vez en cuanto vuelva la señal).
        fallos.current = 1;
        programaReintento();
      };
      // Sin señal y con copia: de una vez con la copia, sin hacer esperar a nadie.
      if (conBase && !haySenalAhora()) { entraConLaCopia(); return; }

      // Se intenta 3 veces antes de rendirse: una señal mala suele volver en unos segundos. Con copia, una sola: si no contesta, se sigue con ella.
      const intentos = conBase ? 1 : 3;
      let respuesta = null;
      for (let intento = 1; intento <= intentos; intento += 1) {
        try {
          respuesta = await supabase.from('user_app_state').select('data').eq('user_id', userId).maybeSingle();
        } catch (e) {
          respuesta = { data: null, error: e instanceof Error ? e : new Error(String(e)), status: 0 };
        }
        if (!respuesta.error || cancelled) break;
        if (intento < intentos) {
          await espera(1500 * intento);
          if (cancelled) return;
        }
      }
      if (cancelled) return;
      if (respuesta?.error) {
        console.error('user_app_state load error', respuesta.error.message);
        if (esFaltaDeSenal(respuesta.error, respuesta.status)) marcaSinSenal();
        if (conBase) { entraConLaCopia(); return; }
        // No se sabe qué hay en la base: se deja la app abierta (vacía) pero SIN guardar nada hasta lograr leer, para no pisar lo que la persona ya tenía.
        lecturaFallida.current = true;
        enLaBase.current = {};
        deQuien.current = userId;
        setStore({});
        setLoaded(true);
        falla('No se pudieron cargar tus datos. Reintentar', { clave: 'lectura', accion: { texto: 'Reintentar', alTocar: () => setIntentoDeLectura((n) => n + 1) } });
        return;
      }
      marcaConSenal();
      lecturaFallida.current = false;
      quitaFalla('lectura');
      const fresco = deLaFila(respuesta);
      enLaBase.current = fresco;
      deQuien.current = userId;
      // Lo que quedó pendiente la última vez (se cerró la app sin señal, o se salió de la cuenta con cosas por subir) va encima y se sube ya.
      const pendiente = copia?.pendiente;
      setStore(pendiente ? ponEncima(fresco, pendiente) : fresco);
      setLoaded(true);
      if (conCopia) {
        persisteCopia();
        if (pendiente) guardarRef.current();
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId, intentoDeLectura, conCopia, falla, quitaFalla, setStore, persisteCopia, programaReintento]);

  // Debounced persistence: solo lo que cambió (y la copia del teléfono, casi de una vez)
  useEffect(() => {
    if (!loaded || !userId || soloLectura) return undefined;
    if (conCopia) {
      clearTimeout(relojDeCopia.current);
      relojDeCopia.current = setTimeout(() => { persisteCopia(); }, COPIA_DEBOUNCE_MS);
    }
    const t = setTimeout(guardarAhora, SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [store, loaded, userId, soloLectura, guardarAhora, conCopia, persisteCopia]);

  /* Al irse de la app se guarda YA, sin esperar: el atleta puede estar
     pasándose a su IA justo después de anotar (y en el iPhone, cerrándola). Al volver se relee la base, y
     lo que aún no se guardaba se vuelve a poner encima. */
  useEffect(() => {
    if (!userId || !loaded) return undefined;
    const alCambiar = () => {
      if (document.visibilityState !== 'visible') {
        if (!soloLectura) { persisteCopia(); guardarAhora(); }
        return;
      }
      if (lecturaFallida.current) { setIntentoDeLectura((n) => n + 1); return; }
      encola(async () => {
        const leida = await releer();
        if (!soloLectura && (leida || desdeLaCopia.current)) await guardar();
      });
    };
    document.addEventListener('visibilitychange', alCambiar);
    return () => document.removeEventListener('visibilitychange', alCambiar);
  }, [userId, loaded, soloLectura, guardarAhora, persisteCopia, encola, releer, guardar]);

  /* LA PUERTA DEL ESTADO (para la parte 3, ver `lib/colaDelTelefono.js`): lo que llega del reloj entra al estado como si se hubiera hecho aquí, y la
     cola sabe cuándo ya quedó guardado en el teléfono. `persiste` deja la copia al día antes de salir de la cuenta. */
  useEffect(() => {
    if (!conCopia || !userId || !loaded) return undefined;
    return registraPuertaDelEstado(userId, {
      aplica: async (cambio) => {
        if (deQuien.current !== userId || lecturaFallida.current) return false;
        setStore((prev) => cambio(prev));
        return persisteCopia();
      },
      persiste: () => persisteCopia(),
    });
  }, [conCopia, userId, loaded, setStore, persisteCopia]);

  // Al desmontar (salir de la cuenta): la copia queda al día y ya no se escribe nada a nombre de nadie.
  useEffect(() => () => {
    persisteCopia();
    deQuien.current = null;
    clearTimeout(relojDeReintento.current);
    clearTimeout(relojDeCopia.current);
  }, [persisteCopia]);

  // `confirmado`: el estado ya se comparó con la base desde que se abrió (no es solo la copia del teléfono). Lo que la app hace SOLA espera a esto.
  const value = useMemo(() => ({ store, setStore, loaded, confirmado: !deLaCopia }), [store, setStore, loaded, deLaCopia]);

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

/** Todo lo guardado de la cuenta (`user_app_state.data`), o `null` fuera de `<AppStateProvider>` o mientras no ha cargado. Solo para leer. */
export function useEstadoOpcional() {
  const ctx = useContext(AppStateContext);
  return ctx?.loaded ? ctx.store : null;
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
