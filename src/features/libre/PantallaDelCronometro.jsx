import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown } from 'lucide-react';
import { useConfirmacion } from '@/components/Confirmacion';
import { FONT, NUM_STYLE } from '@/lib/theme';
import { MINIMO_DE_SEGUNDOS, distanciaEnMetros, relojDeCronometro, unidadDeDistancia } from '@/lib/entrenoLibre';
import { guardaEntrenoLibre } from '@/lib/entrenoLibreApi';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { muestraEnPantallaBloqueada, quitaDePantallaBloqueada } from '@/lib/pantallaBloqueada';
import { enviaAlReloj, terminaEnReloj } from '@/lib/relojApple';
import { useBarraDeEstadoClara } from '@/lib/barraDeEstado';
import { AvisoDeCorta, HojaDeAbajo, NumeroGrande, Pulso, TituloDePausa } from './PiezasDeCarrera';
import { C, redondo, usePulsoDelReloj } from './carrera';

/* LA PANTALLA DEL CRONÓMETRO (entreno libre sin mapa: pádel, gimnasio, o una salida «sin GPS»). Desde el 2 nov 2026 es la misma pantalla de números de la carrera
   (`PantallaDeCarrera`), sin mapa: fondo negro, arriba el nombre de la actividad, al centro el tiempo enorme y, con Apple Watch, el pulso. Abajo «Pausar»; en pausa,
   «EN PAUSA», «Reanudar» y «Finalizar» (se mantiene), sobre el mismo negro (no hay mapa que teñir). Sin el ícono de cambiar de vista ni la línea.
   Al finalizar una salida de cardio sin GPS pregunta la distancia (se puede dejar vacía) y guarda; con menos de 30 s, «… demasiado corta». Cerrar NO termina el
   entreno: el cronómetro sigue (vive en `useCronometroLibre`) y Home lo muestra como «Entreno en curso». Ver `lib/entrenoLibre.js`. */

export default function PantallaDelCronometro({ userId, crono, alMinimizar, alGuardado }) {
  const { cronometro, segundos } = crono;
  const [fase, setFase] = useState('corre'); // corre | distancia | muy_corto
  const [guardando, setGuardando] = useState(false);
  const [distancia, setDistancia] = useState('');
  const [error, setError] = useState(null);
  const deporte = cronometro?.deporte ?? 'otro';
  // La actividad que eligió (`lib/actividades.js`): su nombre. Una propia sin mapa no pide distancia.
  const actividad = cronometro?.actividad ?? null;
  const nombre = actividad?.nombre ?? nombreDelDeporte(deporte);
  const unidad = actividad && actividad.id !== deporte && !actividad.gps ? null : unidadDeDistancia(deporte);
  const pausado = cronometro?.pausadoEn != null;
  const pregunta = useConfirmacion();
  const pulso = usePulsoDelReloj(!!cronometro);
  useBarraDeEstadoClara(true);

  /* El Apple Watch (mide el pulso con su sesión de entreno) y la pantalla bloqueada: el nombre y el tiempo. Se manda al empezar, al pausar y al reanudar; el
     tiempo lo cuenta el teléfono solo, desde la hora de inicio fija. */
  const vivos = useRef({});
  useEffect(() => { vivos.current = { segundos, cronometro }; });
  const hay = !!cronometro;
  useEffect(() => {
    if (!cronometro) return;
    const v = vivos.current;
    const datos = {
      nombre, titulo: nombre, tipo: pausado ? 'pausa' : 'cardio', detalle: pausado ? 'En pausa' : '',
      ...(pausado ? { transcurridoS: v.segundos } : { inicioMs: cronometro.inicio + (cronometro.pausas ?? 0) }),
    };
    muestraEnPantallaBloqueada(datos);
    enviaAlReloj({ ...datos, deporte });
    // Solo al empezar, pausar o reanudar (el resto cambia cada segundo).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hay, pausado]);
  useEffect(() => () => { quitaDePantallaBloqueada(); terminaEnReloj(); }, []);

  async function guardar(texto) {
    const t = crono.termina();
    if (!t) return;
    setGuardando(true);
    setError(null);
    try {
      const fila = await guardaEntrenoLibre({
        atletaId: userId, deporte: t.deporte, inicioMs: t.inicioMs, duracionS: t.duracionS, distanciaM: unidad ? distanciaEnMetros(texto, t.deporte) : null, muestras: t.muestras, rutaSilenciosa: !!t.rutaSilenciosa,
        titulo: t.actividad?.nombre ?? null, llevaDistancia: t.actividad ? (!!t.actividad.gps || !!unidad) : null,
      });
      crono.descarta();
      alGuardado(fila, { muestras: t.muestras, actividad: t.actividad });
    } catch (e) {
      setError(e?.message ?? 'No se pudo guardar. Revisa tu conexión e inténtalo otra vez.');
      setGuardando(false);
    }
  }

  const finaliza = () => {
    const t = crono.termina();
    if (!t) return;
    if (t.duracionS < MINIMO_DE_SEGUNDOS) { setFase('muy_corto'); return; }
    if (unidad) setFase('distancia'); else guardar(null);
  };

  // Descartar un entreno que ya pasó del mínimo: se pregunta, porque ya no se recupera.
  const descartar = async () => {
    const si = await pregunta({ titulo: '¿Descartar este entreno?', detalle: 'No se guardará y no se puede recuperar.', confirmar: 'Descartar', peligro: true });
    if (!si) return;
    crono.descarta();
    alMinimizar();
  };

  const botonDeLaForma = (fondo, color = '#fff') => ({ width: '100%', minHeight: 54, borderRadius: 99, border: 'none', background: fondo, color, fontFamily: FONT, fontSize: 16, fontWeight: 800, cursor: 'pointer', touchAction: 'manipulation' });

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label={nombre} style={{ position: 'fixed', inset: 0, zIndex: 3200, background: C.negro, color: C.texto, fontFamily: FONT, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <button type="button" onClick={alMinimizar} aria-label="Minimizar" style={{ ...redondo, position: 'absolute', zIndex: 3, top: 'calc(14px + env(safe-area-inset-top))', left: 16 }}><ChevronDown size={22} /></button>
      {/* Arriba: el nombre de la actividad; en pausa, «EN PAUSA». */}
      <div style={{ minHeight: 44, margin: 'calc(14px + env(safe-area-inset-top)) 64px 0', display: 'grid', placeItems: 'center', textAlign: 'center' }}>
        {pausado && fase === 'corre'
          ? <TituloDePausa automatica={!!cronometro?.automatica} />
          : <div style={{ fontSize: 19, fontWeight: 800, letterSpacing: -0.2, overflowWrap: 'anywhere' }}>{nombre}</div>}
      </div>

      {fase === 'distancia' ? (
        <form
          onSubmit={(e) => { e.preventDefault(); guardar(distancia); }}
          style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, padding: '16px 18px calc(18px + env(safe-area-inset-bottom))' }}
        >
          <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 800 }}>¿Cuánto fue?</div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: C.hoja, borderRadius: 18, padding: '0 18px' }}>
            <input
              value={distancia} onChange={(e) => setDistancia(e.target.value)} inputMode="decimal" autoFocus placeholder="0" aria-label={`Distancia en ${unidad === 'm' ? 'metros' : 'kilómetros'}`}
              style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: 34, fontWeight: 800, color: C.texto, padding: '14px 0', ...NUM_STYLE }}
            />
            <span style={{ fontSize: 20, fontWeight: 800, color: C.gris }}>{unidad}</span>
          </label>
          {error && <div role="alert" style={{ padding: '10px 12px', borderRadius: 14, background: 'rgba(255,77,106,0.16)', color: '#FFB3C0', fontSize: 14, fontWeight: 600 }}>{error}</div>}
          <button type="submit" disabled={guardando} style={botonDeLaForma(C.azul)}>{guardando ? 'Guardando…' : 'Guardar'}</button>
          <button type="button" disabled={guardando} onClick={() => guardar(null)} style={botonDeLaForma(C.hoja)}>Sin distancia</button>
          <button type="button" disabled={guardando} onClick={descartar} style={botonDeLaForma('transparent', C.gris)}>Descartar entreno</button>
        </form>
      ) : (
        <>
          {/* En medio, el tiempo enorme y, con Apple Watch, el pulso. */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: '12px 16px' }}>
            <NumeroGrande valor={relojDeCronometro(segundos)} color={pausado ? C.gris : C.acento} tamano={segundos >= 3600 ? 80 : 100} rol="timer" etiquetaAccesible="Tiempo del entreno" />
            <Pulso lpm={pulso} />
          </div>
          <HojaDeAbajo pausado={pausado} guardando={guardando} error={error} onPausa={crono.pausa} onReanuda={crono.reanuda} onFinaliza={finaliza} />
        </>
      )}

      {fase === 'muy_corto' && (
        <AvisoDeCorta
          deporte={deporte} actividad={actividad}
          onDescartar={() => { crono.descarta(); alMinimizar(); }}
          onSeguir={() => { if (pausado) crono.reanuda(); setFase('corre'); }}
        />
      )}
    </div>,
    document.body,
  );
}
