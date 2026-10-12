import { useState } from 'react';
import { Loader2, Pause, Play, Square } from 'lucide-react';
import HojaFlotante from '@/components/HojaFlotante';
import { LT, FONT, NUM_STYLE } from '@/lib/theme';
import { MINIMO_DE_SEGUNDOS, distanciaEnMetros, relojDeCronometro, unidadDeDistancia } from '@/lib/entrenoLibre';
import { guardaEntrenoLibre } from '@/lib/entrenoLibreApi';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { MosaicoDeDeporte } from '@/features/metricas/Piezas';
import { botonBlancoGrande, botonGrande } from './estilosLibre';

/* LA PANTALLA DEL CRONÓMETRO (entreno libre): el tiempo grande, «Pausar» y «Terminar». Al terminar pregunta la distancia (se puede dejar vacía) y guarda. Cerrar la hoja NO termina el
   entreno: el cronómetro sigue (vive en `useCronometroLibre`) y Home lo muestra como «Entreno en curso». Ver `lib/entrenoLibre.js`. */

export default function PantallaDelCronometro({ userId, crono, alMinimizar, alGuardado }) {
  const { cronometro, segundos } = crono;
  const [fase, setFase] = useState('corre'); // corre | distancia | muy_corto | guardando
  const [distancia, setDistancia] = useState('');
  const [error, setError] = useState(null);
  const deporte = cronometro?.deporte ?? 'correr';
  const unidad = unidadDeDistancia(deporte);
  const pausado = cronometro?.pausadoEn != null;

  const terminar = () => {
    const t = crono.termina();
    if (!t) return;
    if (t.duracionS < MINIMO_DE_SEGUNDOS) { setFase('muy_corto'); return; }
    if (unidad) setFase('distancia'); else guardar(null);
  };

  async function guardar(texto) {
    const t = crono.termina();
    if (!t) return;
    setFase('guardando');
    setError(null);
    try {
      const fila = await guardaEntrenoLibre({ atletaId: userId, deporte: t.deporte, inicioMs: t.inicioMs, duracionS: t.duracionS, distanciaM: distanciaEnMetros(texto, t.deporte) });
      crono.descarta();
      alGuardado(fila);
    } catch (e) {
      setError(e?.message ?? 'No se pudo guardar. Revisa tu conexión e inténtalo otra vez.');
      setFase(unidad ? 'distancia' : 'corre');
    }
  }

  return (
    <HojaFlotante titulo={nombreDelDeporte(deporte)} onCerrar={alMinimizar}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, padding: '18px 0 8px', fontFamily: FONT }}>
        <MosaicoDeDeporte deporte={deporte} size={64} />

        {(fase === 'corre' || fase === 'guardando') && (
          <>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2, color: pausado ? LT.text3 : LT.text, lineHeight: 1, ...NUM_STYLE }} role="timer" aria-label="Tiempo del entreno">{relojDeCronometro(segundos)}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: LT.warning, marginTop: 8, minHeight: 18 }}>{pausado ? 'En pausa' : ''}</div>
            </div>
            {error && <div role="alert" style={{ padding: '9px 12px', borderRadius: 12, background: '#FDECEC', color: LT.danger, fontSize: 14, fontWeight: 700, width: '100%' }}>{error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
              <button type="button" onClick={pausado ? crono.reanuda : crono.pausa} disabled={fase === 'guardando'} className="kp-press" style={botonBlancoGrande(fase === 'guardando')}>
                {pausado ? <><Play size={20} /> Seguir</> : <><Pause size={20} /> Pausar</>}
              </button>
              <button type="button" onClick={terminar} disabled={fase === 'guardando'} className="kp-press" style={botonGrande(fase === 'guardando')}>
                {fase === 'guardando' ? <Loader2 size={20} className="spin" /> : <Square size={18} fill="currentColor" />} Terminar
              </button>
            </div>
          </>
        )}

        {fase === 'distancia' && (
          <form
            onSubmit={(e) => { e.preventDefault(); guardar(distancia); }}
            style={{ display: 'flex', flexDirection: 'column', gap: 16, width: '100%' }}
          >
            <div style={{ textAlign: 'center', fontSize: 22, fontWeight: 800, color: LT.text }}>¿Cuánto fue?</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: LT.surface, border: `1.5px solid ${LT.border}`, borderRadius: 18, padding: '0 18px' }}>
              <input
                value={distancia} onChange={(e) => setDistancia(e.target.value)} inputMode="decimal" autoFocus placeholder="0" aria-label={`Distancia en ${unidad === 'm' ? 'metros' : 'kilómetros'}`}
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: 34, fontWeight: 800, color: LT.text, padding: '14px 0', ...NUM_STYLE }}
              />
              <span style={{ fontSize: 20, fontWeight: 800, color: LT.text2 }}>{unidad}</span>
            </label>
            {error && <div role="alert" style={{ padding: '9px 12px', borderRadius: 12, background: '#FDECEC', color: LT.danger, fontSize: 14, fontWeight: 700 }}>{error}</div>}
            <button type="submit" className="kp-press" style={botonGrande()}>Guardar</button>
            <button type="button" onClick={() => guardar(null)} className="kp-press" style={botonBlancoGrande()}>Sin distancia</button>
          </form>
        )}

        {fase === 'muy_corto' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: LT.text }}>Fue muy corto para guardarlo</div>
            <button type="button" onClick={() => setFase('corre')} className="kp-press" style={botonGrande()}>Seguir entrenando</button>
            <button type="button" onClick={() => { crono.descarta(); alMinimizar(); }} className="kp-press" style={botonBlancoGrande()}>Descartar</button>
          </div>
        )}
      </div>
    </HojaFlotante>
  );
}
