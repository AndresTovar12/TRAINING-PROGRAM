import { useCallback, useEffect, useRef, useState } from 'react';
import { agregaPunto, fuenteDeUbicacion } from '@/lib/ubicacion';
import { LLAVE_ULTIMA_UBICACION, leeUbicacionGuardada } from '@/lib/mapaNativo';
import { pideQueNoSeApague } from '@/lib/pantallaEncendida';
import {
  cronometroNuevo, cronometroVigente, decidePausaAutomatica, pausa as pausar, reanuda as reanudar, segundosDe,
} from '@/lib/entrenoLibre';
import { useStorageOpcional } from '@/contexts/AppStateContext';
import { vibra } from '@/lib/avisosNativos';
import { entrenosRecientes } from '@/lib/entrenoLibreApi';

/* El estado del entreno libre. El cronómetro vive en `localStorage` (por persona): así sobrevive a cerrar la hoja, a cambiar de pestaña y a recargar la página; se cuenta con fechas
   (no con «ticks»), así que con la pantalla bloqueada el tiempo sigue corriendo bien. Lo guardado en la base lo piden `entrenosRecientes` y el resumen. */

const llave = (userId) => `tl:entreno-libre:${userId}`;
/** El ajuste «Pausa automática» (Mi perfil → Dispositivos). Encendido si nunca se tocó. */
export const LLAVE_PAUSA_AUTOMATICA = 'ajustes:pausa-automatica';
/** Una pausa de más de esto apaga el GPS (indicador azul y batería); al reanudar vuelve a encenderse y tarda unos segundos en encontrar señal. */
const PAUSA_LARGA_MS = 5 * 60 * 1000;
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
  const lecturas = useRef([]); // lo último que dijo el GPS ({ t, vel, pre }), para decidir la pausa automática
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
      if (conPausaAutomatica.current && typeof p.vel === 'number') {
        const ahoraS = Date.now() / 1000;
        lecturas.current = [...lecturas.current.filter((x) => ahoraS - x.t <= 15), { t: ahoraS, vel: p.vel, pre: p.precision }];
        const estado = c.pausadoEn == null ? 'corriendo' : (c.automatica ? 'pausa' : null);
        const d = estado ? decidePausaAutomatica(lecturas.current, estado, c.deporte, ahoraS) : null;
        if (d?.accion === 'pausa') {
          const nuevo = pausar(c, Math.round(d.desde * 1000), { automatica: true });
          vivo.current = nuevo;
          cambiaYa.current(nuevo);
          // La pausa cuenta desde que se detuvo: lo anotado en esos segundos (parado, sin metros) se quita para que el tiempo de la ruta no vaya hacia atrás.
          const tope = segundosDe(nuevo);
          setMuestras((m) => { const r = m.filter((x) => x.t <= tope); if (r.length !== m.length && userId) escribeRuta(userId, r); return r; });
          vibra('listo');
          return;
        }
        if (d?.accion === 'reanuda') {
          const nuevo = reanudar(c, Math.round(d.desde * 1000));
          vivo.current = nuevo;
          cambiaYa.current(nuevo);
          vibra('listo');
        }
      }
      if (vivo.current?.pausadoEn != null) return; // en pausa no se mide
      setMuestras((m) => {
        const nuevas = agregaPunto(m, p, segundosDe(vivo.current));
        if (nuevas !== m && userId) escribeRuta(userId, nuevas);
        return nuevas;
      });
    }, () => {});
    return () => { vigente = false; parar(); candado?.suelta(); };
  }, [conGps, userId]);
  const cambiaRuta = useCallback((r) => { setMuestras(r); if (userId) escribeRuta(userId, r); }, [userId]);

  return {
    cronometro,
    segundos: segundosDe(cronometro, ahora),
    muestras,
    // `actividad`: la que eligió (`lib/actividades.js`): su nombre e ícono se ven mientras corre y se guardan como título del entreno.
    inicia: (deporte, { gps = false, actividad = null } = {}) => {
      cambiaRuta([]);
      cambia({ ...cronometroNuevo(deporte), ...(gps ? { gps: true } : {}), ...(actividad ? { actividad: { id: actividad.id, nombre: actividad.nombre, icono: actividad.icono, color: actividad.color, gps: !!actividad.gps } } : {}) });
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
