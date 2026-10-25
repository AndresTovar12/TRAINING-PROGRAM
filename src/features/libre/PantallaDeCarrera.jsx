import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader2, Map as MapaIcono, Pause, Play, Square, Watch, X } from 'lucide-react';
import { FONT, NUM_STYLE } from '@/lib/theme';
import { MINIMO_DE_SEGUNDOS, relojDeCronometro } from '@/lib/entrenoLibre';
import { guardaEntrenoLibre } from '@/lib/entrenoLibreApi';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { enVivo, textoDeRitmo } from '@/lib/ubicacion';
import { muestraEnPantallaBloqueada, quitaDePantallaBloqueada } from '@/lib/pantallaBloqueada';
import { enviaAlReloj, terminaEnReloj } from '@/lib/relojApple';
import { useConfirmacion } from '@/components/Confirmacion';
import { useAviso } from '@/components/AvisoPasajero';
import MapaDeCarrera from './MapaDeCarrera';
import IconoDeActividad from './IconoDeActividad';
import { actividadDeDeporte } from '@/lib/actividades';
import { useSenalGps, useUbicacionActual } from './useEntrenoLibre';
import { usaMapaNativo } from '@/lib/mapaNativo';
import { limpiaPantallaDeMapa } from './MapaNativo';
import { useBarraDeEstadoClara } from '@/lib/barraDeEstado';

/* LA CARRERA CON GPS A PANTALLA COMPLETA (reestructura visual, 16 oct 2026), como «Workout · Carrera» de las capturas de Andrés:
     1. Antes de salir: el mapa, «GPS listo» y el botón redondo «Iniciar».
     2. Corriendo: el tiempo en rojo, los kilómetros enormes, el ritmo actual y el promedio; abajo el mapa chico. «Ver mapa» cambia a
        la vista de mapa grande con los números en una tarjeta. «Pausar».
     3. En pausa: «Seguir» y «Terminar».
     4. Resumen: el mapa con la ruta, el nombre («Carrera de la mañana»), distancia, tiempo y ritmo, y «Por kilómetro» con barras (el
        más rápido en azul). «Descartar» o «Guardar carrera»; al guardar sigue el resumen de siempre (con la activity card).
   Correr, caminar, bici y senderismo; los demás deportes siguen con el cronómetro de antes (`PantallaDelCronometro`).
   La fuente de los puntos es intercambiable (`lib/ubicacion.js`): hoy el navegador, en la app de la tienda el teléfono o el reloj. */

const C = { fondo: '#0F1220', tarjeta: '#1A1E2E', tarjeta2: '#232838', texto: '#FFFFFF', texto2: 'rgba(255,255,255,0.62)', rojo: '#FF5A5F', azul: '#2F6BFF', verde: '#22C38E' };
const CORAL = 'linear-gradient(135deg, #FF8A5B 0%, #F0506E 100%)'; /* estilo-ok: pantallas oscuras de la carrera (capturas aprobadas) */
const SOBRE_EL_MAPA = 'linear-gradient(to top, rgba(15,18,32,0.85) 0%, rgba(15,18,32,0.85) 52%, rgba(15,18,32,0) 100%)'; /* estilo-ok: degradado transparente que sube desde abajo para ver el mapa entero (ampliación del 25 oct 2026, como Aura) */
const AZUL = 'linear-gradient(135deg, #2448E8 0%, #1733B8 60%, #0D1A66 100%)'; /* estilo-ok: pantallas oscuras de la carrera (capturas aprobadas) */

const nombreDeLaSalida = (deporte, inicioMs, actividad = null) => {
  const h = new Date(inicioMs).getHours();
  const momento = h < 12 ? 'de la mañana' : h < 19 ? 'de la tarde' : 'de la noche';
  // Una actividad con nombre propio (trail, patines, una que creó) se llama por su nombre; las de siempre, como antes («Carrera de la mañana»).
  const propio = actividad && actividad.id !== deporte ? actividad.nombre : null;
  const que = propio ?? { correr: 'Carrera', caminar: 'Caminata', bici: 'Rodada', senderismo: 'Caminata' }[deporte] ?? nombreDelDeporte(deporte);
  return `${que} ${momento}`;
};

// La hora de ahora, en grande, para «listo para empezar» sin mapa (gimnasio, pádel…), como el «Entreno» de Aura.
const horaDeAhora = () => {
  const [hora, ...resto] = new Date().toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' }).split(/\s+/);
  return { hora, sufijo: resto.join(' ') }; // «10:49» en grande y «p.m.» chico (junto no cabe en un teléfono)
};

/* `actividad`: la que eligió (`lib/actividades.js`; desde el 23 oct 2026, Activity Tracker): su nombre y su ícono se ven aquí, y si NO lleva mapa (gimnasio, pádel) «listo
   para empezar» enseña la hora en grande en vez del mapa y arranca el cronómetro sin GPS. Con mapa, «Iniciar» espera a que el GPS esté listo (en Aura los primeros
   segundos daban ritmos absurdos); «Sin GPS» sigue ahí por si la señal no llega. */
export default function PantallaDeCarrera({ userId, crono, pendiente = null, actividad = null, ultimo = null, alEmpezar, alMinimizar, alCambiarDeporte, alGuardado }) {
  const { cronometro, segundos, muestras } = crono;
  const pregunta = useConfirmacion();
  const { avisa } = useAviso();
  const deporte = pendiente ?? cronometro?.deporte ?? 'correr';
  const act = actividad ?? cronometro?.actividad ?? null;
  const nombre = act?.nombre ?? nombreDelDeporte(deporte);
  const conMapa = act ? !!act.gps : true;
  const enBici = deporte === 'bici';
  const pausado = cronometro?.pausadoEn != null;
  const [vista, setVista] = useState('numeros'); // numeros | mapa
  const [resumen, setResumen] = useState(null); // lo que dio `crono.termina()` al tocar Terminar
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  useBarraDeEstadoClara(!resumen); // todas las pantallas de la carrera son oscuras menos el resumen: la hora y la batería en letras claras
  // En el resumen no hay mapa grande: la app de abajo (donde viven los avisos como «¿Descartar esta salida?») tiene que verse sí o sí.
  useEffect(() => { if (resumen) limpiaPantallaDeMapa(); }, [resumen]);
  const senal = useSenalGps(!!pendiente && conMapa);
  const aqui = useUbicacionActual(!!pendiente && conMapa);
  // Sin mapa, «listo para empezar» enseña la hora: que avance sola.
  const [, setTic] = useState(0);
  useEffect(() => {
    if (!pendiente || conMapa) return undefined;
    const id = setInterval(() => setTic((t) => t + 1), 15000);
    return () => clearInterval(id);
  }, [pendiente, conMapa]);
  const vivo = useMemo(() => enVivo(muestras), [muestras]);
  const km = vivo.distanciaM / 1000;
  const promedio = km > 0.05 ? segundos / km : null;
  const ultimoKm = vivo.kms.at(-1) ?? null;
  const velocidad = (s) => (s > 0 ? (3600 / s).toFixed(1) : '—');

  /* La pantalla bloqueada, la isla dinámica y el Apple Watch: tiempo, distancia y ritmo. Con el GPS del teléfono corriendo, la app sigue despierta aunque se bloquee la pantalla, así que se
     actualiza cada 10 s (el cronómetro avanza solo, con la hora de inicio). Pausa y reanudar se mandan al instante. */
  const vivos = useRef({});
  useEffect(() => { vivos.current = { km, ritmo: vivo.ritmoSKm, segundos, nombre, deporte, enBici }; });
  const corriendoLibre = !!cronometro && !resumen;
  useEffect(() => {
    if (!corriendoLibre) { quitaDePantallaBloqueada(); terminaEnReloj(); return undefined; }
    const publica = () => {
      const v = vivos.current;
      const ritmoTxt = v.enBici ? `${v.ritmo > 0 ? (3600 / v.ritmo).toFixed(1) : '—'} km/h` : `${textoDeRitmo(v.ritmo)} /km`;
      const datos = {
        nombre: v.nombre, titulo: v.nombre, tipo: pausado ? 'pausa' : 'cardio',
        detalle: pausado ? 'En pausa' : `${v.km.toFixed(2)} km · ${ritmoTxt}`,
        distancia: `${v.km.toFixed(2)} km`, ritmo: ritmoTxt,
        ...(pausado ? {} : { inicioMs: Math.round(Date.now() - v.segundos * 1000) }),
      };
      muestraEnPantallaBloqueada(datos);
      enviaAlReloj({ ...datos, deporte: v.deporte });
    };
    publica();
    const id = setInterval(publica, 10000);
    return () => clearInterval(id);
  }, [corriendoLibre, pausado]);
  useEffect(() => () => { quitaDePantallaBloqueada(); terminaEnReloj(); }, []);

  const terminar = () => {
    const t = crono.termina();
    if (!t) return;
    crono.pausa();
    setResumen(t);
  };
  const guardar = async () => {
    setGuardando(true); setError(null);
    try {
      const fila = await guardaEntrenoLibre({
        atletaId: userId, deporte: resumen.deporte, inicioMs: resumen.inicioMs, duracionS: resumen.duracionS, distanciaM: null, muestras: resumen.muestras,
        titulo: resumen.actividad?.nombre ?? null, llevaDistancia: resumen.actividad ? !!resumen.actividad.gps : null,
      });
      crono.descarta();
      alGuardado(fila, { muestras: resumen.muestras, actividad: resumen.actividad });
    } catch (e) {
      setError(e?.message ?? 'No se pudo guardar. Revisa tu conexión e inténtalo otra vez.');
      setGuardando(false);
    }
  };
  const descartar = async () => {
    const va = await pregunta({ titulo: '¿Descartar esta salida?', detalle: 'No se guarda nada.', confirmar: 'Sí, descartar', peligro: true });
    if (va) { crono.descarta(); alMinimizar(); }
  };

  const pantalla = (hijos) => createPortal(
    <div role="dialog" aria-modal="true" aria-label={nombre} data-mapa-portal style={{ position: 'fixed', inset: 0, zIndex: 3200, background: C.fondo, color: C.texto, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      {hijos}
    </div>,
    document.body,
  );
  const botonGrande = (fondo, extra) => ({
    width: '100%', minHeight: 58, borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 18, fontWeight: 700, color: '#fff',
    background: fondo, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, touchAction: 'manipulation', ...extra,
  });
  const redondo = { width: 44, height: 44, borderRadius: 14, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', backdropFilter: 'blur(10px)' };

  /* 1 · ANTES DE SALIR («listo para empezar»: lo que abre el punto ● de la barra) */
  if (pendiente) {
    const lista = senal === 'lista';
    const sinGps = senal === 'no_hay' || senal === 'negado';
    const esperandoGps = conMapa && senal === 'buscando';
    const textoSenal = { lista: 'GPS listo', buscando: 'Buscando GPS…', negado: 'Sin permiso de ubicación', sin_senal: 'Sin señal de GPS', no_hay: 'Sin GPS' }[senal];
    const lado = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600, minWidth: 0 };
    return pantalla(
      <>
        {conMapa
          ? <div style={{ position: 'absolute', inset: 0 }}><MapaDeCarrera muestras={aqui ? [aqui] : []} alto="100%" redondo={false} puntoAzul pantallaCompleta interactivo /></div>
          : (
            <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: 160 }}>
              <span style={{ fontSize: 13.5, fontWeight: 700, color: C.texto2 }}>Hora actual</span>
              <span style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ fontSize: 88, fontWeight: 800, letterSpacing: -3, lineHeight: 1, ...NUM_STYLE }}>{horaDeAhora().hora}</span>
                <span style={{ fontSize: 22, fontWeight: 700, color: C.texto2 }}>{horaDeAhora().sufijo}</span>
              </span>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: C.texto2 }}>Sin reloj: la app lleva tu tiempo</span>
            </div>
          )}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'calc(14px + env(safe-area-inset-top)) 16px 0' }}>
          <button type="button" onClick={alMinimizar} aria-label="Cerrar" style={redondo}><ChevronDown size={22} /></button>
          {conMapa && (
            <span role="status" data-map-overlay style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 99, background: lista ? 'rgba(34,195,142,0.18)' : 'rgba(255,255,255,0.12)', color: lista ? C.verde : '#fff', fontSize: 14, fontWeight: 700, backdropFilter: 'blur(10px)' }}>
              {senal === 'buscando' ? <Loader2 size={15} className="spin" /> : <span style={{ width: 8, height: 8, borderRadius: 4, background: lista ? C.verde : '#fff' }} />} {textoSenal}
            </span>
          )}
        </div>
        <div style={{ flex: 1 }} />
        {/* Abajo no hay tarjeta sólida: un degradado que sube desde el fondo (transparente arriba, ~85 % del color oscuro abajo) deja ver el mapa entero, estilo Aura.
            `data-mapa-panel` va en el contenido (no en el degradado) para que el mapa descuente solo lo que de verdad tapan los botones. */}
        <div style={{ position: 'relative', padding: '56px 12px calc(14px + env(safe-area-inset-bottom))', background: SOBRE_EL_MAPA }}>
          <div data-map-overlay data-mapa-panel style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, textAlign: 'center', maxWidth: '100%' }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.rojo }}>Entreno libre</div>
              <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.2, overflowWrap: 'anywhere' }}>{nombre}</div>
              {ultimo && <div style={{ fontSize: 13, fontWeight: 500, color: C.texto2 }}>Último: {ultimo}</div>}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10, marginTop: 14, width: '100%', maxWidth: 420 }}>
              {/* Cambiar de actividad: el ícono de la que va (detalle de la maqueta v4, estilo Aura). */}
              <button type="button" onClick={alCambiarDeporte} aria-label={`Cambiar de actividad (ahora: ${nombre})`} style={lado}>
                <IconoDeActividad actividad={act ?? actividadDeDeporte(deporte)} size={52} oscuro /> Cambiar
              </button>
              <button
                type="button" onClick={() => alEmpezar({ gps: conMapa && !sinGps })} disabled={esperandoGps} aria-label="Iniciar"
                style={{ width: 112, height: 112, borderRadius: 56, border: 'none', background: esperandoGps ? 'rgba(255,255,255,0.14)' : CORAL, color: '#fff', cursor: esperandoGps ? 'default' : 'pointer', fontFamily: FONT, fontSize: esperandoGps ? 17 : 21, fontWeight: 800, boxShadow: esperandoGps ? '0 0 0 6px rgba(255,255,255,0.08)' : '0 0 0 6px rgba(255,138,91,0.28), 0 14px 34px rgba(240,80,110,0.45)', touchAction: 'manipulation' }}
              >
                {esperandoGps ? 'GPS…' : 'Iniciar'}
              </button>
              {conMapa && !sinGps ? (
                <button type="button" onClick={() => alEmpezar({ gps: false })} style={lado}>
                  <span style={{ ...redondo, width: 52, height: 52, borderRadius: 26 }}><MapaIcono size={20} /></span> Sin GPS
                </button>
              ) : !conMapa ? (
                // Conectar el reloj es de la app de la tienda (capa nativa): aquí solo lo dice.
                <button type="button" onClick={() => avisa('Con la app descargable, tu Apple Watch manda el pulso y las calorías mientras entrenas')} style={lado}>
                  <span style={{ ...redondo, width: 52, height: 52, borderRadius: 26 }}><Watch size={20} /></span> Conectar reloj
                </button>
              ) : <span />}
            </div>
          </div>
        </div>
      </>,
    );
  }

  /* 4 · RESUMEN (todavía sin guardar) */
  if (resumen) {
    const kmR = vivo.distanciaM / 1000;
    const ritmo = kmR > 0 ? resumen.duracionS / kmR : null;
    const corto = resumen.duracionS < MINIMO_DE_SEGUNDOS;
    const kms = vivo.kms;
    const rapido = kms.length ? Math.min(...kms.map((k) => k.dur)) : null;
    const lento = kms.length ? Math.max(...kms.map((k) => k.dur)) : null;
    const fecha = new Date(resumen.inicioMs);
    return pantalla(
      <>
        <div style={{ flex: 1, overflowY: 'auto', background: '#F2F3F7', color: '#111318' }}>
          <MapaDeCarrera muestras={resumen.muestras ?? muestras} sigue={false} alto={300} redondo={false} />
          <div style={{ margin: usaMapaNativo() ? '14px 16px 0' : '-48px 16px 0', position: 'relative', background: '#fff', borderRadius: 24, padding: '16px 18px 18px', boxShadow: '0 14px 34px rgba(17,19,24,0.12)' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: C.rojo, }}>
              Hoy · {fecha.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}
            </div>
            <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: -0.5, marginTop: 2 }}>{nombreDeLaSalida(resumen.deporte, resumen.inicioMs, resumen.actividad)}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10, marginTop: 14 }}>
              {[[kmR.toFixed(2), 'km'], [relojDeCronometro(resumen.duracionS), 'tiempo'], [enBici ? velocidad(ritmo) : textoDeRitmo(ritmo), enBici ? 'km/h' : 'min/km']].map(([v, t]) => (
                <div key={t}><div style={{ fontSize: 26, fontWeight: 800, ...NUM_STYLE }}>{v}</div><div style={{ fontSize: 12.5, fontWeight: 600, color: '#5B616E' }}>{t}</div></div>
              ))}
            </div>
          </div>
          {kms.length > 0 && (
            <div style={{ margin: '18px 16px 0' }}>
              <div style={{ fontSize: 17, fontWeight: 800, marginBottom: 8 }}>Por kilómetro</div>
              <div style={{ background: '#fff', borderRadius: 20, padding: '4px 16px', boxShadow: '0 1px 2px rgba(17,19,24,0.04)' }}>
                {kms.map((k) => {
                  const ancho = lento === rapido ? 70 : 35 + ((lento - k.dur) / (lento - rapido)) * 55;
                  return (
                    <div key={k.n} style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 46, borderTop: k.n > 1 ? '1px solid #ECEEF2' : 'none' }}>
                      <span style={{ width: 20, fontSize: 14, fontWeight: 600, color: '#5B616E', ...NUM_STYLE }}>{k.n}</span>
                      <span style={{ flex: 1, height: 7, borderRadius: 4, background: '#EEF0F4', overflow: 'hidden' }}>
                        <span style={{ display: 'block', height: '100%', width: `${ancho}%`, borderRadius: 4, background: k.dur === rapido ? '#1E40E0' : '#FF8A8E' }} />
                      </span>
                      <span style={{ width: 48, textAlign: 'right', fontSize: 15, fontWeight: 800, ...NUM_STYLE }}>{enBici ? velocidad(k.dur) : textoDeRitmo(k.dur)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {corto && <div role="status" style={{ margin: '16px 16px 0', padding: '12px 14px', borderRadius: 14, background: '#FCF1E1', color: '#B86400', fontSize: 14.5, fontWeight: 600 }}>Fue muy corta para guardarla. Puedes seguir o descartarla.</div>}
          {error && <div role="alert" style={{ margin: '16px 16px 0', padding: '12px 14px', borderRadius: 14, background: '#FCEBEB', color: '#DC2626', fontSize: 14.5, fontWeight: 600 }}>{error}</div>}
          <div style={{ height: 20 }} />
        </div>
        <div style={{ display: 'flex', gap: 10, padding: '12px 16px calc(14px + env(safe-area-inset-bottom))', background: '#F2F3F7' }}>
          {corto ? (
            <button type="button" onClick={() => { setResumen(null); crono.reanuda(); }} style={botonGrande(AZUL, { flex: 1.6 })}><Play size={18} fill="#fff" /> Seguir</button>
          ) : (
            <button type="button" onClick={descartar} disabled={guardando} style={botonGrande('#E6E8EE', { flex: 1, color: '#111318' })}>Descartar</button>
          )}
          {corto ? (
            <button type="button" onClick={descartar} style={botonGrande('#E6E8EE', { flex: 1, color: '#111318' })}>Descartar</button>
          ) : (
            <button type="button" onClick={guardar} disabled={guardando} style={botonGrande(CORAL, { flex: 1.6, opacity: guardando ? 0.7 : 1 })}>
              {guardando && <Loader2 size={18} className="spin" />} Guardar {resumen.deporte === 'correr' ? 'carrera' : 'salida'}
            </button>
          )}
        </div>
      </>,
    );
  }

  /* 2 y 3 · CORRIENDO (números o mapa) y EN PAUSA */
  const botones = pausado ? (
    <div style={{ display: 'flex', gap: 10 }}>
      <button type="button" onClick={crono.reanuda} style={botonGrande(AZUL, { flex: 1 })}><Play size={18} fill="#fff" /> Seguir</button>
      <button type="button" onClick={terminar} style={botonGrande('#D63A4A', { flex: 1 })}><Square size={16} fill="#fff" /> Terminar</button>
    </div>
  ) : (
    <button type="button" onClick={crono.pausa} style={botonGrande(AZUL)}><Pause size={20} fill="#fff" /> Pausar</button>
  );
  const ritmoActual = enBici ? velocidad(vivo.ritmoSKm) : textoDeRitmo(vivo.ritmoSKm);
  const ritmoPromedio = enBici ? velocidad(promedio) : textoDeRitmo(promedio);
  const unidadRitmo = enBici ? 'km/h' : '/km';

  if (vista === 'mapa') {
    return pantalla(
      <>
        <div style={{ position: 'absolute', inset: 0 }}><MapaDeCarrera muestras={muestras} alto="100%" redondo={false} interactivo pantallaCompleta /></div>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: 'calc(14px + env(safe-area-inset-top)) 16px 0' }}>
          <button type="button" onClick={alMinimizar} aria-label="Minimizar" style={redondo}><ChevronDown size={22} /></button>
          <button type="button" onClick={() => setVista('numeros')} style={{ ...redondo, width: 'auto', padding: '0 14px', fontFamily: FONT, fontSize: 14, fontWeight: 700 }}>Números</button>
        </div>
        <div style={{ flex: 1 }} />
        <div data-map-overlay data-mapa-panel style={{ position: 'relative', margin: '0 12px', borderRadius: 24, padding: '14px 18px 16px', background: 'rgba(28,32,48,0.88)', backdropFilter: 'blur(16px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 600, color: C.texto2 }}>
            <span>{pausado ? 'En pausa' : nombre}</span>
            {ultimoKm && <span style={{ color: '#8FA9FF' }}>Km {ultimoKm.n} · {enBici ? velocidad(ultimoKm.dur) : textoDeRitmo(ultimoKm.dur)}</span>}
          </div>
          <div style={{ textAlign: 'center', fontSize: 52, fontWeight: 800, letterSpacing: -1.5, color: pausado ? C.texto2 : C.rojo, ...NUM_STYLE }}>{relojDeCronometro(segundos)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', textAlign: 'center' }}>
            <div><div style={{ fontSize: 30, fontWeight: 800, ...NUM_STYLE }}>{ritmoActual}</div><div style={{ fontSize: 12.5, color: C.texto2 }}>Ritmo {unidadRitmo}</div></div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.12)' }}><div style={{ fontSize: 30, fontWeight: 800, ...NUM_STYLE }}>{km.toFixed(2)}</div><div style={{ fontSize: 12.5, color: C.texto2 }}>Distancia km</div></div>
          </div>
        </div>
        <div style={{ position: 'relative', padding: '12px 12px calc(12px + env(safe-area-inset-bottom))' }}>{botones}</div>
      </>,
    );
  }

  return pantalla(
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', padding: 'calc(14px + env(safe-area-inset-top)) 16px 0' }}>
        <button type="button" onClick={alMinimizar} aria-label="Minimizar" style={redondo}><ChevronDown size={22} /></button>
        {pausado && <span style={{ alignSelf: 'center', fontSize: 14, fontWeight: 800, color: '#FFB547' }}>En pausa</span>}
        <button type="button" onClick={alMinimizar} aria-label="Cerrar" style={{ ...redondo, visibility: 'hidden' }}><X size={20} /></button>
      </div>
      <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '8px 18px 0', gap: 6 }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: C.rojo }}>Tiempo</div>
        <div role="timer" aria-label="Tiempo" style={{ fontSize: 66, fontWeight: 800, letterSpacing: -2, lineHeight: 1, color: pausado ? C.texto2 : C.rojo, ...NUM_STYLE }}>{relojDeCronometro(segundos)}</div>
        <div style={{ fontSize: 112, fontWeight: 800, letterSpacing: -4, lineHeight: 1, marginTop: 28, ...NUM_STYLE }}>{km.toFixed(2)}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.texto2 }}>Kilómetros</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '100%', maxWidth: 420, marginTop: 24, textAlign: 'center' }}>
          <div><div style={{ fontSize: 38, fontWeight: 800, ...NUM_STYLE }}>{ritmoActual}</div><div style={{ fontSize: 13, color: C.texto2 }}>{enBici ? 'Velocidad km/h' : 'Ritmo actual /km'}</div></div>
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.12)' }}><div style={{ fontSize: 38, fontWeight: 800, ...NUM_STYLE }}>{ritmoPromedio}</div><div style={{ fontSize: 13, color: C.texto2 }}>Promedio {unidadRitmo}</div></div>
        </div>
        <div style={{ width: '100%', maxWidth: 520, marginTop: 24 }}>
          <MapaDeCarrera muestras={muestras} alto={170} />
          {/* «Ver mapa» va DEBAJO del mapa, no encima: el mapa nativo se pinta sobre la página y taparía cualquier botón que esté en su rectángulo. */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={() => setVista('mapa')} style={{ border: 'none', borderRadius: 10, padding: '8px 14px', background: 'rgba(255,255,255,0.12)', color: '#fff', fontFamily: FONT, fontSize: 13.5, fontWeight: 700, cursor: 'pointer' }}>Ver mapa</button>
          </div>
        </div>
      </div>
      <div style={{ padding: '14px 16px calc(14px + env(safe-area-inset-bottom))' }}>{botones}</div>
    </>,
  );
}
