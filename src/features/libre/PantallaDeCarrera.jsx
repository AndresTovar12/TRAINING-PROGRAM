import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Loader2, Map as MapaIcono, Pause, Play, Repeat, Square, X } from 'lucide-react';
import { FONT, NUM_STYLE } from '@/lib/theme';
import { MINIMO_DE_SEGUNDOS, relojDeCronometro } from '@/lib/entrenoLibre';
import { guardaEntrenoLibre } from '@/lib/entrenoLibreApi';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { enVivo, textoDeRitmo } from '@/lib/ubicacion';
import { useConfirmacion } from '@/components/Confirmacion';
import MapaDeCarrera from './MapaDeCarrera';
import { useSenalGps } from './useEntrenoLibre';

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
const CORAL = 'linear-gradient(135deg, #FF8A5B 0%, #F0506E 100%)';
const AZUL = 'linear-gradient(135deg, #2448E8 0%, #1733B8 60%, #0D1A66 100%)';

const nombreDeLaSalida = (deporte, inicioMs) => {
  const h = new Date(inicioMs).getHours();
  const momento = h < 12 ? 'de la mañana' : h < 19 ? 'de la tarde' : 'de la noche';
  const que = { correr: 'Carrera', caminar: 'Caminata', bici: 'Rodada', senderismo: 'Caminata' }[deporte] ?? nombreDelDeporte(deporte);
  return `${que} ${momento}`;
};

export default function PantallaDeCarrera({ userId, crono, pendiente = null, ultimo = null, alEmpezar, alMinimizar, alCambiarDeporte, alGuardado }) {
  const { cronometro, segundos, muestras } = crono;
  const pregunta = useConfirmacion();
  const deporte = pendiente ?? cronometro?.deporte ?? 'correr';
  const enBici = deporte === 'bici';
  const pausado = cronometro?.pausadoEn != null;
  const [vista, setVista] = useState('numeros'); // numeros | mapa
  const [resumen, setResumen] = useState(null); // lo que dio `crono.termina()` al tocar Terminar
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState(null);
  const senal = useSenalGps(!!pendiente);
  const vivo = useMemo(() => enVivo(muestras), [muestras]);
  const km = vivo.distanciaM / 1000;
  const promedio = km > 0.05 ? segundos / km : null;
  const ultimoKm = vivo.kms.at(-1) ?? null;
  const velocidad = (s) => (s > 0 ? (3600 / s).toFixed(1) : '—');

  const terminar = () => {
    const t = crono.termina();
    if (!t) return;
    crono.pausa();
    setResumen(t);
  };
  const guardar = async () => {
    setGuardando(true); setError(null);
    try {
      const fila = await guardaEntrenoLibre({ atletaId: userId, deporte: resumen.deporte, inicioMs: resumen.inicioMs, duracionS: resumen.duracionS, distanciaM: null, muestras: resumen.muestras });
      crono.descarta();
      alGuardado(fila);
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
    <div role="dialog" aria-modal="true" aria-label={nombreDelDeporte(deporte)} style={{ position: 'fixed', inset: 0, zIndex: 3200, background: C.fondo, color: C.texto, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      {hijos}
    </div>,
    document.body,
  );
  const botonGrande = (fondo, extra) => ({
    width: '100%', minHeight: 58, borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 18, fontWeight: 700, color: '#fff',
    background: fondo, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, touchAction: 'manipulation', ...extra,
  });
  const redondo = { width: 44, height: 44, borderRadius: 14, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', backdropFilter: 'blur(10px)' };

  /* 1 · ANTES DE SALIR */
  if (pendiente) {
    const lista = senal === 'lista';
    const sinGps = senal === 'no_hay' || senal === 'negado';
    const textoSenal = { lista: 'GPS listo', buscando: 'Buscando GPS…', negado: 'Sin permiso de ubicación', sin_senal: 'Sin señal de GPS', no_hay: 'Sin GPS' }[senal];
    return pantalla(
      <>
        <div style={{ position: 'absolute', inset: 0 }}><MapaDeCarrera muestras={[]} alto="100%" redondo={false} puntoAzul /></div>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'calc(14px + env(safe-area-inset-top)) 16px 0' }}>
          <button type="button" onClick={alMinimizar} aria-label="Cerrar" style={redondo}><ChevronDown size={22} /></button>
          <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 99, background: lista ? 'rgba(34,195,142,0.18)' : 'rgba(255,255,255,0.12)', color: lista ? C.verde : '#fff', fontSize: 14, fontWeight: 700, backdropFilter: 'blur(10px)' }}>
            {senal === 'buscando' ? <Loader2 size={15} className="spin" /> : <span style={{ width: 8, height: 8, borderRadius: 4, background: lista ? C.verde : '#fff' }} />} {textoSenal}
          </span>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', margin: '0 12px calc(12px + env(safe-area-inset-bottom))', borderRadius: 28, padding: '10px 18px 20px', background: 'rgba(28,32,48,0.88)', backdropFilter: 'blur(16px)' }}>
          <div aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.25)', margin: '0 auto 12px' }} />
          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
            <div>
              <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 1.2, color: C.rojo }}>ENTRENO LIBRE</div>
              <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.4 }}>{nombreDelDeporte(deporte)}</div>
            </div>
            {ultimo && <div style={{ fontSize: 13.5, fontWeight: 500, color: C.texto2, textAlign: 'right' }}>Último: {ultimo}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10, marginTop: 16 }}>
            <button type="button" onClick={alCambiarDeporte} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600 }}>
              <span style={{ ...redondo, width: 52, height: 52, borderRadius: 26, color: C.rojo }}><Repeat size={20} /></span> Deporte
            </button>
            <button
              type="button" onClick={() => alEmpezar({ gps: !sinGps })} aria-label="Iniciar"
              style={{ width: 112, height: 112, borderRadius: 56, border: 'none', background: CORAL, color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 21, fontWeight: 800, boxShadow: '0 14px 34px rgba(240,80,110,0.45)', touchAction: 'manipulation' }}
            >
              Iniciar
            </button>
            {!sinGps ? (
              <button type="button" onClick={() => alEmpezar({ gps: false })} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600 }}>
                <span style={{ ...redondo, width: 52, height: 52, borderRadius: 26 }}><MapaIcono size={20} /></span> Sin GPS
              </button>
            ) : <span />}
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
          <div style={{ margin: '-48px 16px 0', position: 'relative', background: '#fff', borderRadius: 24, padding: '16px 18px 18px', boxShadow: '0 14px 34px rgba(17,19,24,0.12)' }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 1, color: C.rojo, textTransform: 'uppercase' }}>
              Hoy · {fecha.toLocaleTimeString('es-MX', { hour: 'numeric', minute: '2-digit' })}
            </div>
            <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: -0.5, marginTop: 2 }}>{nombreDeLaSalida(resumen.deporte, resumen.inicioMs)}</div>
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
        <div style={{ position: 'absolute', inset: 0 }}><MapaDeCarrera muestras={muestras} alto="100%" redondo={false} interactivo /></div>
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: 'calc(14px + env(safe-area-inset-top)) 16px 0' }}>
          <button type="button" onClick={alMinimizar} aria-label="Minimizar" style={redondo}><ChevronDown size={22} /></button>
          <button type="button" onClick={() => setVista('numeros')} style={{ ...redondo, width: 'auto', padding: '0 14px', fontFamily: FONT, fontSize: 14, fontWeight: 700 }}>Números</button>
        </div>
        <div style={{ flex: 1 }} />
        <div style={{ position: 'relative', margin: '0 12px', borderRadius: 24, padding: '14px 18px 16px', background: 'rgba(28,32,48,0.88)', backdropFilter: 'blur(16px)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13.5, fontWeight: 600, color: C.texto2 }}>
            <span>{pausado ? 'En pausa' : nombreDelDeporte(deporte)}</span>
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
        <div style={{ fontSize: 13, fontWeight: 800, letterSpacing: 1.5, color: C.rojo }}>TIEMPO</div>
        <div role="timer" aria-label="Tiempo" style={{ fontSize: 66, fontWeight: 800, letterSpacing: -2, lineHeight: 1, color: pausado ? C.texto2 : C.rojo, ...NUM_STYLE }}>{relojDeCronometro(segundos)}</div>
        <div style={{ fontSize: 112, fontWeight: 800, letterSpacing: -4, lineHeight: 1, marginTop: 28, ...NUM_STYLE }}>{km.toFixed(2)}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.texto2 }}>Kilómetros</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', width: '100%', maxWidth: 420, marginTop: 24, textAlign: 'center' }}>
          <div><div style={{ fontSize: 38, fontWeight: 800, ...NUM_STYLE }}>{ritmoActual}</div><div style={{ fontSize: 13, color: C.texto2 }}>{enBici ? 'Velocidad km/h' : 'Ritmo actual /km'}</div></div>
          <div style={{ borderLeft: '1px solid rgba(255,255,255,0.12)' }}><div style={{ fontSize: 38, fontWeight: 800, ...NUM_STYLE }}>{ritmoPromedio}</div><div style={{ fontSize: 13, color: C.texto2 }}>Promedio {unidadRitmo}</div></div>
        </div>
        <div style={{ position: 'relative', width: '100%', maxWidth: 520, marginTop: 24 }}>
          <MapaDeCarrera muestras={muestras} alto={170} />
          <button type="button" onClick={() => setVista('mapa')} style={{ position: 'absolute', top: 10, right: 10, border: 'none', borderRadius: 10, padding: '6px 10px', background: 'rgba(15,18,32,0.75)', color: '#fff', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Ver mapa</button>
        </div>
      </div>
      <div style={{ padding: '14px 16px calc(14px + env(safe-area-inset-bottom))' }}>{botones}</div>
    </>,
  );
}
