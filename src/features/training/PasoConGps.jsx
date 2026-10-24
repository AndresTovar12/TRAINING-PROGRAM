import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, Map as MapaIcono, X } from 'lucide-react';
import { FONT, NUM_STYLE } from '@/lib/theme';
import { agregaPunto, enVivo, fuenteDeUbicacion, textoDeRitmo } from '@/lib/ubicacion';
import { avanceDelPaso, sinSenal } from '@/lib/recorrido';
import { relojDeCronometro } from '@/lib/entrenoLibre';
import MapaDeCarrera from '@/features/libre/MapaDeCarrera';
import { useSenalGps } from '@/features/libre/useEntrenoLibre';

/* EL PASO CON GPS DEL ENTRENO GUIADO (23 oct 2026, maqueta aprobada: https://claude.ai/artifact/XKxchXFgxojtxHj8yk7RHY). Un paso de 200 m o más (ver
   `lib/recorrido.js`) se hace como la carrera del registro libre: MISMA pantalla oscura, mismo mapa, mismo «Iniciar» coral y los mismos números; lo único nuevo
   es la capa del coach (la serie, la meta y cuánto falta). Andrés: «que se parezcan… es la misma acción».
     1. Antes de salir: el mapa, la señal del GPS, la meta del coach, «Iniciar» y «Sin GPS».
     2. Corriendo: tiempo en rojo, «188 m para llegar», el ritmo y la barra. SIN pausa (un sprint no se pausa): «Mantén para parar» lo termina con lo recorrido.
     3. Al llegar a la meta termina SOLO y enseña el resultado; «Seguir» lo marca hecho y pasa al descanso. Si el GPS midió mal, «Cambiar el resultado».
     4. Sin señal 5 segundos: aviso en ámbar y que elija la persona (esperar, terminar con lo que lleva o anotarlo a mano). No se borra nada.
   `paso`: el del entreno (nombre, serie; `serieTexto` si quien lo usa tiene su propio «Lapso 2 de 3»). `meta`: los metros. `carga`: lo que pide además («100%»).
   Lo que se manda al terminar: `onTermina({ metros, seg })`. Sin `onAnotar` no se ofrece «Cambiar el resultado» ni «Anotar a mano» (en un lapso no hay a dónde anotarlo).

   QUE LA APP GUÍE (23 oct 2026, Andrés: «pareciera que el humano está guiando el workout en lugar de que la app»). La regla: la app avanza sola cuando PUEDE saber que
   algo terminó (se llegó a la meta, se acabó el descanso); la persona solo toca cuando únicamente ella lo sabe. Por eso:
     · `arrancaSolo`: se llegó AVANZANDO (acabó el descanso o el paso anterior): en cuanto el GPS está listo corre el 3, 2, 1 y sale, sin otro «Iniciar».
       Si el GPS tarda, el botón «Iniciar» sigue ahí; nunca se espera una señal que no llega.
     · `sinCuenta`: quien lo usa ya dio su propio aviso (el reloj de lapsos cuenta 3, 2, 1 al terminar el descanso): sale corriendo en el instante en que se abre.
     · `sigueSolo`: al llegar a la meta se enseña el resultado `segResultado` segundos y pasa solo a lo que sigue. «Seguir» lo adelanta; «Cambiar el resultado» lo detiene.
       Con `segResultado={0}` no se enseña nada y pasa al instante: así en los kilómetros seguidos de unos lapsos, donde la persona sigue corriendo y el siguiente ya
       tiene que estar midiendo. */

const SEGUNDOS_DEL_RESULTADO = 4; // lo que se ve el resultado de un sprint antes de pasar solo al descanso

const C = { fondo: '#0F1220', texto: '#FFFFFF', texto2: 'rgba(255,255,255,0.62)', rojo: '#FF5A5F', verde: '#22C38E', ambar: '#FFB547' };
const CORAL = 'linear-gradient(135deg, #FF8A5B 0%, #F0506E 100%)'; /* estilo-ok: la misma carrera oscura del registro libre (PantallaDeCarrera) */
const AZUL = 'linear-gradient(135deg, #2448E8 0%, #1733B8 60%, #0D1A66 100%)'; /* estilo-ok: la misma carrera oscura del registro libre (PantallaDeCarrera) */
const MANTENER_MS = 800;

const redondo = { width: 44, height: 44, borderRadius: 14, border: 'none', background: 'rgba(255,255,255,0.12)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', backdropFilter: 'blur(10px)' };
const botonGrande = (fondo, extra) => ({
  width: '100%', minHeight: 58, borderRadius: 20, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 18, fontWeight: 700, color: '#fff',
  background: fondo, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10, touchAction: 'manipulation', ...extra,
});
const tarjeta = { position: 'relative', margin: '0 12px', borderRadius: 24, padding: '14px 18px 16px', background: 'rgba(28,32,48,0.9)', backdropFilter: 'blur(16px)' };

// «Mantén para parar»: se llena mientras se sostiene; soltar antes no hace nada (un toque sin querer no termina el sprint).
function BotonMantener({ texto, sub, alCompletar }) {
  const [lleno, setLleno] = useState(false);
  const t = useRef(null);
  const empieza = () => { setLleno(true); t.current = setTimeout(() => { setLleno(false); alCompletar(); }, MANTENER_MS); };
  const suelta = () => { clearTimeout(t.current); setLleno(false); };
  useEffect(() => () => clearTimeout(t.current), []);
  return (
    <button
      type="button" onPointerDown={empieza} onPointerUp={suelta} onPointerLeave={suelta} onPointerCancel={suelta}
      onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alCompletar(); } }}
      style={{ position: 'relative', overflow: 'hidden', ...botonGrande('rgba(255,90,95,0.16)', { color: C.rojo, flexDirection: 'column', gap: 1 }) }}
    >
      <span aria-hidden="true" style={{ position: 'absolute', inset: 0, width: lleno ? '100%' : '0%', background: C.rojo, transition: lleno ? `width ${MANTENER_MS}ms linear` : 'width 120ms ease-out' }} />
      <span style={{ position: 'relative', color: lleno ? '#fff' : C.rojo }}>{texto}</span>
      {sub && <span style={{ position: 'relative', fontSize: 11.5, fontWeight: 600, opacity: 0.8, color: lleno ? '#fff' : C.rojo }}>{sub}</span>}
    </button>
  );
}

export default function PasoConGps({ paso, meta, carga = '', arrancaSolo = false, sigueSolo = true, segResultado = SEGUNDOS_DEL_RESULTADO, sinCuenta = false, onTermina, onSinGps, onAnotar, onCerrar }) {
  const [fase, setFase] = useState(sinCuenta ? 'corriendo' : 'antes'); // antes | cuenta | corriendo | llego
  const [cuenta, setCuenta] = useState(3);
  const [desde, setDesde] = useState(() => (sinCuenta ? Date.now() : null));
  const [ahora, setAhora] = useState(() => Date.now());
  const [muestras, setMuestras] = useState([]);
  const [final, setFinal] = useState(null); // { metros, seg }
  const [esperando, setEsperando] = useState(false); // eligió «seguir esperando» la señal
  const [ultimoPunto, setUltimoPunto] = useState(() => (sinCuenta ? Date.now() : NaN)); // la hora del último punto bueno del GPS
  // Con `sinCuenta` (los lapsos) no hay pantalla de «antes», pero igual se oye la señal mientras no llega el primer punto: si no hay permiso, no se espera nada.
  const senal = useSenalGps(fase === 'antes' || (sinCuenta && fase === 'corriendo' && muestras.length === 0));
  useEffect(() => {
    if (sinCuenta && (senal === 'negado' || senal === 'no_hay')) onCerrar();
  }, [sinCuenta, senal, onCerrar]);
  const vivo = useMemo(() => enVivo(muestras), [muestras]);
  const seg = desde ? Math.max(0, (((final ? desde + final.seg * 1000 : ahora)) - desde) / 1000) : 0;
  const avance = avanceDelPaso(vivo.distanciaM, meta);
  const perdido = fase === 'corriendo' && !esperando && sinSenal(ultimoPunto, ahora);
  const serie = paso.serieTexto ?? (paso.vueltas > 1 ? `Serie ${paso.vuelta} de ${paso.vueltas}` : null);

  // Se llegó avanzando: en cuanto el GPS está listo, empieza solo la cuenta. Con otra señal (buscando, negado…) no hace nada: se queda el botón.
  useEffect(() => {
    if (fase === 'antes' && arrancaSolo && senal === 'lista') { setCuenta(3); setFase('cuenta'); }
  }, [fase, arrancaSolo, senal]);

  // Llegó a la meta: se ve el resultado unos segundos y sigue solo. Se guarda la función de hoy para que el temporizador no se reinicie en cada dibujo.
  const alTerminar = useRef(onTermina);
  useEffect(() => { alTerminar.current = onTermina; });
  useEffect(() => {
    if (fase !== 'llego' || !final || !sigueSolo) return undefined;
    const t = setTimeout(() => alTerminar.current(final), segResultado * 1000);
    return () => clearTimeout(t);
  }, [fase, final, sigueSolo, segResultado]);

  // La cuenta 3, 2, 1 antes de salir: nadie arranca en el mismo instante en que toca el botón.
  useEffect(() => {
    if (fase !== 'cuenta') return undefined;
    const t = setTimeout(() => {
      if (cuenta > 1) { setCuenta((c) => c - 1); return; }
      const t0 = Date.now();
      setDesde(t0); setUltimoPunto(t0); setAhora(t0); setFase('corriendo');
    }, 1000);
    return () => clearTimeout(t);
  }, [fase, cuenta]);

  // El reloj de la pantalla: solo avisa que se vuelva a dibujar (todo se cuenta con la hora).
  useEffect(() => {
    if (fase !== 'corriendo') return undefined;
    const id = setInterval(() => setAhora(Date.now()), 250);
    return () => clearInterval(id);
  }, [fase]);

  // Los puntos del GPS mientras corre (la misma fuente que el registro libre; en la app de la tienda, la del teléfono o el reloj).
  useEffect(() => {
    if (fase !== 'corriendo' || !desde) return undefined;
    const fuente = fuenteDeUbicacion();
    if (!fuente.disponible()) return undefined;
    return fuente.sigue((p) => {
      if (p.precision <= 30) { setUltimoPunto(Date.now()); setEsperando(false); }
      setMuestras((m) => agregaPunto(m, p, (Date.now() - desde) / 1000));
    }, () => {});
  }, [fase, desde]);

  // Llegó a la meta: termina solo.
  const termina = (metros) => { setFinal({ metros: Math.round(metros), seg: Math.max(1, Math.round((Date.now() - desde) / 1000)) }); setFase('llego'); };
  useEffect(() => {
    if (fase === 'corriendo' && avance.llego) termina(vivo.distanciaM);
  });

  const pantalla = (hijos) => createPortal(
    <div role="dialog" aria-modal="true" aria-label={paso.nombre} style={{ position: 'fixed', inset: 0, zIndex: 3050, background: C.fondo, color: C.texto, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      {hijos}
    </div>,
    document.body,
  );
  const arriba = (derecha) => (
    <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: 'calc(14px + env(safe-area-inset-top)) 16px 0' }}>
      <button type="button" onClick={onCerrar} aria-label="Cerrar el mapa" style={redondo}><X size={20} /></button>
      {derecha}
    </div>
  );
  const metaTexto = [`${meta} m`, carga].filter(Boolean).join(' · ');

  /* 4 · LLEGÓ */
  if (fase === 'llego' && final && sigueSolo && segResultado === 0) return null; // pasa al instante (ver arriba)
  if (fase === 'llego' && final) {
    const ritmo = final.metros > 0 ? (final.seg / final.metros) * 1000 : null;
    return pantalla(
      <>
        <div style={{ position: 'absolute', inset: 0, opacity: 0.12 }}><MapaDeCarrera muestras={muestras} sigue={false} alto="100%" redondo={false} /></div>
        <div style={{ position: 'relative', flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 20px', textAlign: 'center' }}>
          <div style={{ width: 84, height: 84, borderRadius: 42, background: C.verde, display: 'grid', placeItems: 'center', marginBottom: 14 }}><Check size={42} strokeWidth={3} /></div>
          <div style={{ fontSize: 15, fontWeight: 700, color: C.texto2 }}>{[paso.nombre, serie].filter(Boolean).join(' · ')}</div>
          <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05, ...NUM_STYLE }}>{relojDeCronometro(final.seg)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, width: '100%', maxWidth: 360, marginTop: 18 }}>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 18, padding: '12px 8px' }}><div style={{ fontSize: 28, fontWeight: 800, ...NUM_STYLE }}>{final.metros}</div><div style={{ fontSize: 13, color: C.texto2 }}>metros</div></div>
            <div style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 18, padding: '12px 8px' }}><div style={{ fontSize: 28, fontWeight: 800, ...NUM_STYLE }}>{textoDeRitmo(ritmo)}</div><div style={{ fontSize: 13, color: C.texto2 }}>ritmo /km</div></div>
          </div>
        </div>
        <div style={{ position: 'relative', display: 'flex', flexDirection: 'column', gap: 10, padding: '12px 16px calc(14px + env(safe-area-inset-bottom))' }}>
          <button type="button" onClick={() => onTermina(final)} style={{ position: 'relative', overflow: 'hidden', ...botonGrande(AZUL) }}>
            {sigueSolo && <span aria-hidden="true" className="gps-sigue" style={{ position: 'absolute', left: 0, bottom: 0, height: 4, background: 'rgba(255,255,255,0.55)', animation: `gps-sigue ${segResultado}s linear forwards` }} />}
            Seguir
          </button>
          {onAnotar && <button type="button" onClick={() => onAnotar(final)} style={botonGrande('rgba(255,255,255,0.1)', { minHeight: 48, fontSize: 15 })}>Cambiar el resultado</button>}
        </div>
      </>,
    );
  }

  /* 2 y 3 · CUENTA Y CORRIENDO */
  if (fase === 'cuenta' || fase === 'corriendo') {
    return pantalla(
      <>
        <div style={{ position: 'absolute', inset: 0 }}><MapaDeCarrera muestras={muestras} alto="100%" redondo={false} puntoAzul /></div>
        {arriba(
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 99, background: 'rgba(15,18,32,0.75)', fontSize: 13.5, fontWeight: 700, backdropFilter: 'blur(10px)' }}>
            {serie ?? paso.nombre} · meta {meta} m
          </span>,
        )}
        <div style={{ flex: 1 }} />
        {fase === 'cuenta' ? (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(15,18,32,0.55)' }} aria-live="assertive">
            <div style={{ width: 200, height: 200, borderRadius: 100, background: CORAL, display: 'grid', placeItems: 'center', fontSize: 110, fontWeight: 900, ...NUM_STYLE }}>{cuenta}</div>
          </div>
        ) : (
          <>
            <div style={tarjeta}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13.5, fontWeight: 600, color: C.texto2 }}>
                <span>{paso.nombre}</span>
                <span style={{ fontSize: 26, fontWeight: 800, color: C.rojo, ...NUM_STYLE }}>{relojDeCronometro(Math.floor(seg))}</span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', marginTop: 6, alignItems: 'end' }}>
                <div><div style={{ fontSize: 44, fontWeight: 800, letterSpacing: -1.5, lineHeight: 1, ...NUM_STYLE }}>{avance.faltan}</div><div style={{ fontSize: 12.5, color: C.texto2, marginTop: 4 }}>m para llegar</div></div>
                <div style={{ borderLeft: '1px solid rgba(255,255,255,0.12)', paddingLeft: 14 }}><div style={{ fontSize: 30, fontWeight: 800, ...NUM_STYLE }}>{textoDeRitmo(vivo.ritmoSKm)}</div><div style={{ fontSize: 12.5, color: C.texto2, marginTop: 4 }}>ritmo /km</div></div>
              </div>
              <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.12)', marginTop: 12, overflow: 'hidden' }}><div style={{ height: '100%', width: `${Math.round(avance.parte * 100)}%`, background: '#2F6BFF', transition: 'width .4s' }} /></div>
              {perdido && (
                <div role="alert" style={{ marginTop: 12, padding: '10px 12px', borderRadius: 14, background: 'rgba(255,181,71,0.14)', color: C.ambar, fontSize: 14, fontWeight: 600, lineHeight: 1.35 }}>
                  Perdimos la señal. Llevas unos {vivo.distanciaM} m de {meta}. Lo recorrido se guardó.
                </div>
              )}
            </div>
            <div style={{ position: 'relative', padding: '12px 12px calc(12px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 8 }}>
              {perdido ? (
                <>
                  <button type="button" onClick={() => setEsperando(true)} style={botonGrande(AZUL, { minHeight: 52, fontSize: 16 })}>Seguir esperando la señal</button>
                  <button type="button" onClick={() => termina(vivo.distanciaM)} style={botonGrande('rgba(255,255,255,0.1)', { minHeight: 48, fontSize: 15 })}>Terminar con lo que llevo</button>
                  {onAnotar
                    ? <button type="button" onClick={() => onAnotar({ metros: vivo.distanciaM, seg: Math.round(seg) })} style={botonGrande('rgba(255,255,255,0.1)', { minHeight: 48, fontSize: 15 })}>Anotar a mano</button>
                    : <button type="button" onClick={onCerrar} style={botonGrande('rgba(255,255,255,0.1)', { minHeight: 48, fontSize: 15 })}>Seguir sin mapa</button>}
                </>
              ) : (
                <BotonMantener texto="Mantén para parar" sub={`termina solo a los ${meta} m`} alCompletar={() => termina(vivo.distanciaM)} />
              )}
            </div>
          </>
        )}
      </>,
    );
  }

  /* 1 · ANTES DE SALIR */
  const lista = senal === 'lista';
  const textoSenal = { lista: 'GPS listo', buscando: 'Buscando GPS…', negado: 'Sin permiso de ubicación', sin_senal: 'Sin señal de GPS', no_hay: 'Sin GPS' }[senal];
  const sinGps = senal === 'no_hay' || senal === 'negado';
  return pantalla(
    <>
      <div style={{ position: 'absolute', inset: 0 }}><MapaDeCarrera muestras={[]} alto="100%" redondo={false} puntoAzul /></div>
      {arriba(
        <span role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 99, background: lista ? 'rgba(34,195,142,0.18)' : 'rgba(255,255,255,0.12)', color: lista ? C.verde : '#fff', fontSize: 14, fontWeight: 700, backdropFilter: 'blur(10px)' }}>
          {senal === 'buscando' ? <Loader2 size={15} className="spin" /> : <span style={{ width: 8, height: 8, borderRadius: 4, background: lista ? C.verde : '#fff' }} />} {textoSenal}
        </span>,
      )}
      <div style={{ flex: 1 }} />
      <div style={{ position: 'relative', margin: '0 12px calc(12px + env(safe-area-inset-bottom))', borderRadius: 28, padding: '14px 18px 20px', background: 'rgba(28,32,48,0.9)', backdropFilter: 'blur(16px)' }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: C.rojo }}>{serie ?? 'Lo pidió tu coach'}</div>
        <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.4 }}>{paso.nombre}</div>
        <div style={{ fontSize: 15, fontWeight: 600, color: C.texto2, marginTop: 2, ...NUM_STYLE }}>{metaTexto}</div>
        {arrancaSolo && !sinGps && <div style={{ fontSize: 13, fontWeight: 600, color: C.texto2, marginTop: 6 }}>Sales solo en cuanto el GPS esté listo.</div>}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 10, marginTop: 16 }}>
          <span />
          <button
            type="button" disabled={sinGps} onClick={() => { setCuenta(3); setFase('cuenta'); }} aria-label="Iniciar"
            style={{ width: 112, height: 112, borderRadius: 56, border: 'none', background: sinGps ? 'rgba(255,255,255,0.12)' : CORAL, color: '#fff', cursor: sinGps ? 'default' : 'pointer', fontFamily: FONT, fontSize: 21, fontWeight: 800, boxShadow: sinGps ? 'none' : '0 14px 34px rgba(240,80,110,0.45)', touchAction: 'manipulation' }}
          >
            Iniciar
          </button>
          <button type="button" onClick={onSinGps} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, border: 'none', background: 'transparent', color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 600 }}>
            <span style={{ ...redondo, width: 52, height: 52, borderRadius: 26 }}><MapaIcono size={20} /></span> Sin GPS
          </button>
        </div>
      </div>
    </>,
  );
}
