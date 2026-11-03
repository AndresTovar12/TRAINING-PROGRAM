import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { agregaPunto, fuenteDeUbicacion } from '@/lib/ubicacion';
import { LLAVE_ULTIMA_UBICACION, leeUbicacionGuardada } from '@/lib/mapaNativo';
import { pideQueNoSeApague } from '@/lib/pantallaEncendida';
import {
  cronometroNuevo, cronometroVigente, pausa as pausar, reanuda as reanudar, segundosDe,
} from '@/lib/entrenoLibre';
import { pasoDeCarrera } from '@/lib/pasoDeCarrera';
import { sigueMovimiento } from '@/lib/movimientoNativo';
import { anotaEnTraza, anotaSensorEnTraza, cierraTraza, empiezaTraza, grabaTraza, trazaEncendida } from '@/lib/trazaGps';
import { enLaApp } from '@/lib/nativo';
import { useEstadoOpcional, useStorageOpcional } from '@/contexts/AppStateContext';
import { usePlanOpcional } from '@/contexts/PlanContext';
import { vibra } from '@/lib/avisosNativos';
import { TIPO_ENTRENO_LIBRE, conPendientes, cuentaDeEntrenos, entrenosRecientes, paginaDeEntrenos } from '@/lib/entrenoLibreApi';
import { useCola } from '@/lib/colaDelTelefono';
import { guardaEnElTelefono, leeDelTelefono } from '@/lib/almacenDelTelefono';
import { alVolverLaSenal, haySenalAhora } from '@/lib/senal';
import { mezclaEntrenos, sesionesDelPlan } from '@/lib/entrenosDelPlan';
import { useRutaEnSilencio } from '@/lib/useRutaEnSilencio';
import { permisoDelRecorrido } from '@/features/training/useRecorrido';

/* El estado del entreno libre. El cronómetro vive en `localStorage` (por persona): así sobrevive a cerrar la hoja, a cambiar de pestaña y a recargar la página; se cuenta con fechas
   (no con «ticks»), así que con la pantalla bloqueada el tiempo sigue corriendo bien. Lo guardado en la base lo piden `entrenosRecientes` y el resumen. */

const llave = (userId) => `tl:entreno-libre:${userId}`;
/** El ajuste «Pausa automática» (Mi perfil → Dispositivos). Encendido si nunca se tocó. */
export const LLAVE_PAUSA_AUTOMATICA = 'ajustes:pausa-automatica';
/** Una pausa de más de esto apaga el GPS (indicador azul y batería); al reanudar vuelve a encenderse y tarda unos segundos en encontrar señal. */
const PAUSA_LARGA_MS = 5 * 60 * 1000;
const llaveDeRuta = (userId) => `tl:entreno-libre-ruta:${userId}`;
// La ruta EN SILENCIO de un entreno sin mapa (pádel, gimnasio, fútbol): aparte de la del GPS, porque nunca se vuelve distancia ni ritmo (sección 8b).
const llaveDeSilencio = (userId) => `tl:entreno-libre-silencio:${userId}`;

function lee(userId) {
  try {
    const c = JSON.parse(localStorage.getItem(llave(userId)) ?? 'null');
    return cronometroVigente(c) ? c : null;
  } catch { return null; }
}
function escribe(userId, c) {
  try { if (c) localStorage.setItem(llave(userId), JSON.stringify(c)); else localStorage.removeItem(llave(userId)); } catch { /* sin almacenamiento: el cronómetro vive solo mientras la pantalla esté abierta */ }
}
function leeRuta(userId, cual = llaveDeRuta) {
  try { const r = JSON.parse(localStorage.getItem(cual(userId)) ?? '[]'); return Array.isArray(r) ? r : []; } catch { return []; }
}
function escribeRuta(userId, r, cual = llaveDeRuta) {
  try { if (r?.length) localStorage.setItem(cual(userId), JSON.stringify(r)); else localStorage.removeItem(cual(userId)); } catch { /* sin almacenamiento: la ruta vive mientras la pantalla esté abierta */ }
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

/**
 * DÓNDE ESTÁS ahora, para centrar el mapa ANTES de salir (y no en el Zócalo). Arranca con la última ubicación conocida (guardada) y la va afinando con el GPS.
 * Devuelve `{ lat, lon }` o `null` si nunca se supo.
 */
export function useUbicacionActual(activo) {
  const [punto, setPunto] = useState(() => { const g = leeUbicacionGuardada(); return g ? { lat: g.lat, lon: g.lng } : null; });
  const fuente = fuenteDeUbicacion();
  const hay = fuente.disponible();
  useEffect(() => {
    if (!activo || !hay) return undefined;
    return fuente.sigue((p) => {
      if (!(p.precision <= 100)) return;
      const nuevo = { lat: p.lat, lon: p.lon };
      // `pre`, `vel` y `rumbo` solo viajan al mapa (el círculo de precisión y el cono del punto); al teléfono se guarda solo el lugar.
      setPunto({
        ...nuevo, ...(typeof p.precision === 'number' ? { pre: Math.round(p.precision) } : {}),
        ...(typeof p.vel === 'number' ? { vel: p.vel } : {}), ...(typeof p.rumbo === 'number' ? { rumbo: p.rumbo } : {}),
      });
      try { localStorage.setItem(LLAVE_ULTIMA_UBICACION, JSON.stringify(nuevo)); } catch { /* sin almacenamiento: solo se pierde el «último lugar» */ }
    }, () => {});
  }, [activo, hay, fuente]);
  return punto;
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

  /* LA RUTA (solo si se empezó con GPS): cada punto de la fuente se vuelve una muestra en el segundo del entreno (sin pausas).
     En pausa se SIGUE escuchando y los puntos se ignoran (auditoría del GPS, 27 oct 2026): antes se soltaba el GPS, el teléfono lo apagaba y al reanudar se
     perdían los primeros segundos mientras volvía a encontrar la señal. Pasados 5 min de pausa sí se suelta (ver arriba).
     PAUSA AUTOMÁTICA (como Strava, `decidePausaAutomatica`): con cada punto se decide si se detuvo o volvió a moverse. La pausa cuenta desde que se detuvo
     y la vuelta desde que arrancó; vibra en los dos casos. Una pausa manual nunca se quita sola. Se guarda en `localStorage` como el cronómetro, para que sobreviva a cerrar la hoja o
     recargar. Con la pantalla bloqueada el navegador deja de medir; la app instalable trae su fuente con segundo plano (ver `lib/ubicacion.js`). */
  const [muestras, setMuestras] = useState(() => (userId ? leeRuta(userId) : []));
  const vivo = useRef(cronometro);
  useEffect(() => { vivo.current = cronometro; });
  const [pausaAutomatica] = useStorageOpcional(LLAVE_PAUSA_AUTOMATICA, true);
  const conPausaAutomatica = useRef(pausaAutomatica);
  useEffect(() => { conPausaAutomatica.current = pausaAutomatica; });
  // Lo que la pausa automática y la ruta van llevando entre punto y punto (`pasoDeCarrera`): las lecturas del GPS, los metros contados y cuándo arrancó o se reanudó.
  const enCurso = useRef({ lecturas: [], metros: 0, arranque: cronometro?.inicio ?? 0 });
  const ruta = useRef(muestras);
  const cambiaYa = useRef(cambia);
  useEffect(() => { cambiaYa.current = cambia; });

  /* UNA PAUSA LARGA APAGA EL GPS. A los 5 min de pausa se suelta el GPS; una pausa automática que dura tanto pasa a ser manual (ya no se reanuda sola:
     sin GPS no habría cómo saber que volvió a moverse). `dormidoEn` guarda de QUÉ pausa se apagó: al reanudar, el GPS vuelve solo. */
  const pausadoEn = cronometro?.pausadoEn ?? null;
  const [dormidoEn, setDormidoEn] = useState(null);
  useEffect(() => {
    if (pausadoEn == null) return undefined;
    const t = setTimeout(() => {
      const c = vivo.current;
      if (c?.pausadoEn !== pausadoEn) return;
      if (c.automatica) { const { automatica: _a, ...manual } = c; vivo.current = manual; cambiaYa.current(manual); }
      setDormidoEn(pausadoEn);
    }, Math.max(0, pausadoEn + PAUSA_LARGA_MS - Date.now()));
    return () => clearTimeout(t);
  }, [pausadoEn]);
  const conGps = !!cronometro?.gps && !(pausadoEn != null && dormidoEn === pausadoEn);
  /* EL SENSOR DE MOVIMIENTO (2 nov 2026, `lib/movimientoNativo.js`): mientras el GPS de la carrera está encendido, también el sensor (solo en el iPhone). Con
     cada punto se juntan sus señales con el GPS (`decideMarcha`, 3 nov 2026: ningún sensor solo decide): «quieto» hace parado el punto y pausa; «mueve»
     reanuda (2 s) y deja salir de parado. Sin él (la web, sin permiso), las reglas del GPS. La primera vez, iOS pregunta el permiso aquí: en la primera carrera. */
  const sensor = useRef(null);
  // Se recargó la página a media carrera grabando su traza: se sigue grabando la misma.
  const inicioConGps = cronometro?.gps ? cronometro.inicio : null;
  useEffect(() => {
    if (inicioConGps != null && trazaEncendida() && !grabaTraza(inicioConGps)) empiezaTraza({ deporte: vivo.current?.deporte, inicioMs: inicioConGps, app: enLaApp() ? 'iphone' : 'web' });
  }, [inicioConGps]);
  useEffect(() => {
    if (!conGps) return undefined;
    const parar = sigueMovimiento((s, aviso) => {
      sensor.current = s;
      // La traza guarda cada aviso tal como llegó: la prueba lo vuelve a pasar por las mismas funciones.
      if (vivo.current && grabaTraza(vivo.current.inicio)) anotaSensorEnTraza(aviso, Date.now());
    });
    return () => { parar(); sensor.current = null; };
  }, [conGps]);
  useEffect(() => {
    if (!conGps) return undefined;
    const fuente = fuenteDeUbicacion();
    if (!fuente.disponible()) return undefined;
    // La pantalla encendida: sin ella el navegador deja de dar puntos. Si el navegador no sabe, sigue igual.
    let candado = null;
    let vigente = true;
    pideQueNoSeApague().then((c) => { if (vigente) candado = c; else c?.suelta(); });
    const parar = fuente.sigue((p) => {
      const c = vivo.current;
      if (!c) return;
      // Lo mismo que reproduce la prueba de una traza (`pasoDeCarrera`): la pausa automática y, si no está en pausa, el punto a la ruta.
      const ahora = Date.now();
      const e = pasoDeCarrera({ cronometro: c, muestras: ruta.current, ...enCurso.current }, p, ahora, { sensor: sensor.current, pausaAutomatica: conPausaAutomatica.current });
      enCurso.current = { lecturas: e.lecturas, metros: e.metros, arranque: e.arranque };
      if (grabaTraza(c.inicio)) anotaEnTraza(p, e.v, ahora);
      if (e.cronometro !== c) { vivo.current = e.cronometro; cambiaYa.current(e.cronometro); }
      if (e.muestras !== ruta.current) {
        ruta.current = e.muestras;
        setMuestras(e.muestras);
        if (userId) escribeRuta(userId, e.muestras);
      }
      if (e.accion) vibra('listo');
    }, () => {});
    return () => { vigente = false; parar(); candado?.suelta(); };
  }, [conGps, userId]);
  const cambiaRuta = useCallback((r) => { ruta.current = r; setMuestras(r); if (userId) escribeRuta(userId, r); }, [userId]);

  /* LA RUTA EN SILENCIO (sección 8b, 28 oct 2026): un entreno SIN mapa (`silencio`: pádel, gimnasio, fútbol) también guarda por dónde se movió, si la persona
     dijo que sí a su recorrido (se pregunta una vez, ver `HojaDelRecorrido`). Precisión baja hasta que se mueve de verdad (`useRutaEnSilencio`). En pausa no se mide.
     Al guardar, la línea va a los stickers de ruta, pero nunca a la distancia ni al ritmo (`rutaSilenciosa` en `guardaEntrenoLibre`). */
  const [silenciosas, setSilenciosas] = useState(() => (userId ? leeRuta(userId, llaveDeSilencio) : []));
  const conSilencio = !!cronometro?.silencio && pausadoEn == null && permisoDelRecorrido() === 'si';
  useRutaEnSilencio(conSilencio, (p) => {
    const c = vivo.current;
    if (!c || c.pausadoEn != null) return;
    setSilenciosas((m) => {
      const nuevas = agregaPunto(m, p, segundosDe(c));
      if (nuevas !== m && userId) escribeRuta(userId, nuevas, llaveDeSilencio);
      return nuevas;
    });
  });
  const cambiaSilencio = useCallback((r) => { setSilenciosas(r); if (userId) escribeRuta(userId, r, llaveDeSilencio); }, [userId]);

  return {
    cronometro,
    segundos: segundosDe(cronometro, ahora),
    muestras,
    // `actividad`: la que eligió (`lib/actividades.js`): su nombre e ícono se ven mientras corre y se guardan como título del entreno.
    // `silencio`: una actividad sin mapa: se sigue en silencio para los stickers de ruta (si dijo que sí a su recorrido).
    inicia: (deporte, { gps = false, silencio = false, actividad = null } = {}) => {
      cambiaRuta([]);
      cambiaSilencio([]);
      const nuevo = {
        ...cronometroNuevo(deporte), ...(gps ? { gps: true } : {}), ...(!gps && silencio ? { silencio: true } : {}),
        ...(actividad ? { actividad: { id: actividad.id, nombre: actividad.nombre, icono: actividad.icono, color: actividad.color, gps: !!actividad.gps } } : {}),
      };
      enCurso.current = { lecturas: [], metros: 0, arranque: nuevo.inicio };
      // «Guardar traza del GPS» (cuentas de prueba, Ajustes de la carrera): esta carrera se graba punto por punto.
      if (gps && trazaEncendida()) empiezaTraza({ deporte, inicioMs: nuevo.inicio, app: enLaApp() ? 'iphone' : 'web' });
      cambia(nuevo);
    },
    pausa: () => cambia(pausar(cronometro)),
    reanuda: () => { enCurso.current = { ...enCurso.current, arranque: Date.now() }; cambia(reanudar(cronometro)); },
    termina: () => {
      if (!cronometro) return null;
      const enSilencio = !cronometro.gps && silenciosas.length >= 2;
      return {
        deporte: cronometro.deporte, actividad: cronometro.actividad ?? null, inicioMs: cronometro.inicio, duracionS: segundosDe(cronometro),
        muestras: cronometro.gps ? muestras : (enSilencio ? silenciosas : null), rutaSilenciosa: enSilencio,
      };
    },
    descarta: () => { cierraTraza(); cambiaRuta([]); cambiaSilencio([]); cambia(null); },
  };
}

/** Las sesiones del plan que terminó quien entró (fase 6): se leen de lo guardado en la cuenta, no de la base. Fuera de la app del atleta, ninguna. */
export function useSesionesDelPlan() {
  const estado = useEstadoOpcional();
  const programas = usePlanOpcional()?.programas;
  return useMemo(() => (estado ? sesionesDelPlan(estado, programas ?? []) : []), [estado, programas]);
}

/**
 * Los últimos entrenos de quien entró, con `recarga()` para después de guardar uno. `filas`: solo los de `actividades` (lo que usan la semana, el récord y
 * la última actividad). `entrenos`: TODO junto para «Tus entrenos», también los workouts del plan (ver `lib/entrenosDelPlan.js`), lo más nuevo primero.
 */
export function useEntrenosRecientes(userId, n = 6) {
  const [deLaBase, setDeLaBase] = useState(null); // null = cargando
  const [vuelta, setVuelta] = useState(0);
  /* SIN CONEXIÓN (1 nov 2026, ver `docs/sin-conexion.md`). En la app y para quien entró (no en «Ver como»): sin señal se enseña la última lista que se vio, y encima
     los entrenos que todavía están en la cola del teléfono (`conPendientes`), para que lo que hizo sin señal salga en «Tus entrenos» como cualquier otro. */
  const { cosas, usuario: deLaCola } = useCola();
  const propio = !!userId && userId === deLaCola;
  useEffect(() => {
    if (!userId) return undefined;
    let vivo = true;
    const clave = `tl:entrenos:${userId}`;
    const deLaCopia = async () => {
      const copia = propio ? await leeDelTelefono(clave) : null;
      if (vivo) setDeLaBase((f) => f ?? (Array.isArray(copia?.valor) ? copia.valor.slice(0, n) : []));
    };
    // Sin señal ni se pregunta (Supabase tardaría hasta 30 s en rendirse): la última lista que se vio, de una vez. Al volver la señal se pide (abajo).
    if (propio && !haySenalAhora()) {
      deLaCopia();
      return () => { vivo = false; };
    }
    entrenosRecientes(userId, n)
      .then((f) => {
        if (!vivo) return;
        setDeLaBase(f);
        if (propio) guardaEnElTelefono(clave, { valor: f, en: Date.now() });
      })
      .catch(deLaCopia);
    return () => { vivo = false; };
  }, [userId, n, vuelta, propio]);
  const recarga = useCallback(() => setVuelta((v) => v + 1), []);
  useEffect(() => (propio ? alVolverLaSenal(recarga) : undefined), [propio, recarga]);
  // Uno que estaba en la cola ya subió: se vuelve a pedir la lista (sale el del servidor en su lugar, con el mismo id).
  const enLaCola = propio ? cosas.filter((c) => c.tipo === TIPO_ENTRENO_LIBRE).map((c) => c.id).join(',') : '';
  const antes = useRef(enLaCola);
  useEffect(() => {
    const habia = antes.current.split(',').filter(Boolean);
    antes.current = enLaCola;
    const hay = new Set(enLaCola.split(',').filter(Boolean));
    if (habia.some((id) => !hay.has(id))) recarga();
  }, [enLaCola, recarga]);
  const filas = useMemo(() => (deLaBase && propio ? conPendientes(deLaBase, cosas, userId, n) : deLaBase), [deLaBase, propio, cosas, userId, n]);
  const delPlan = useSesionesDelPlan();
  // Con la lista llena (`n` leídos), las sesiones más viejas que la última leída podrían ir después de entrenos que no se leyeron: esas no van.
  const entrenos = useMemo(() => (filas ? mezclaEntrenos(filas, delPlan, { hasta: filas.length >= n ? Date.parse(filas[filas.length - 1].inicio) : null }) : null), [filas, delPlan, n]);
  return { filas, entrenos, recarga };
}

const POR_PAGINA = 50;

/** EL HISTORIAL COMPLETO («Ver todos»): por páginas de 50 entrenos de `actividades`, con los workouts del plan metidos en su lugar. `sigue()` lee la siguiente. */
export function useHistorialCompleto(userId) {
  const [paginas, setPaginas] = useState({ filas: [], hayMas: true, leyendo: false, error: false });
  const actual = useRef(paginas);
  useEffect(() => { actual.current = paginas; });
  const pidiendo = useRef(false);
  const sigue = useCallback(() => {
    const p = actual.current;
    if (!userId || pidiendo.current || !p.hayMas) return;
    pidiendo.current = true;
    setPaginas((q) => ({ ...q, leyendo: true, error: false }));
    paginaDeEntrenos(userId, p.filas.length, POR_PAGINA)
      .then((nuevas) => {
        // Se anota ya (no hasta el siguiente dibujo): si el final de la lista pide otra página antes, ya sabe desde dónde.
        const siguiente = { filas: [...p.filas, ...nuevas], hayMas: nuevas.length === POR_PAGINA, leyendo: false, error: false };
        actual.current = siguiente;
        setPaginas(siguiente);
      })
      .catch(() => setPaginas((q) => ({ ...q, leyendo: false, error: true })))
      .finally(() => { pidiendo.current = false; });
  }, [userId]);
  useEffect(() => { sigue(); }, [sigue]);
  const delPlan = useSesionesDelPlan();
  const { filas, hayMas } = paginas;
  const entrenos = useMemo(() => mezclaEntrenos(filas, delPlan, { hasta: hayMas && filas.length ? Date.parse(filas[filas.length - 1].inicio) : (hayMas ? Infinity : null) }), [filas, delPlan, hayMas]);
  /* Cuántos son y desde cuándo («11 entrenos · desde septiembre»). Con todo leído, se cuentan de la lista. Mientras falten páginas: los de la base, más los
     workouts del plan que no van unidos a un entreno del reloj de los ya leídos (uno muy viejo que el reloj también trajo podría contarse dos veces). */
  const [cuenta, setCuenta] = useState(null);
  useEffect(() => {
    if (!userId) return undefined;
    let vivo = true;
    cuentaDeEntrenos(userId).then((c) => { if (vivo) setCuenta(c); }).catch(() => {});
    return () => { vivo = false; };
  }, [userId]);
  const resumen = useMemo(() => {
    const viejoDelPlan = delPlan.reduce((m, x) => Math.min(m, x.s.inicio), Infinity);
    if (!hayMas) return { total: entrenos.length, primero: entrenos.length ? entrenos[entrenos.length - 1].ms : null };
    if (!cuenta) return null;
    const unidos = mezclaEntrenos(filas, delPlan).filter((e) => e.actividad && e.plan).length;
    return { total: cuenta.total + delPlan.length - unidos, primero: Math.min(cuenta.primero ?? Infinity, viejoDelPlan) };
  }, [hayMas, entrenos, cuenta, filas, delPlan]);
  return { entrenos, hayMas, leyendo: paginas.leyendo, error: paginas.error, sigue, resumen };
}
