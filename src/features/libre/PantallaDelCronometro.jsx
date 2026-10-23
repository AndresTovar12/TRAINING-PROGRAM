import { useMemo, useState } from 'react';
import { useConfirmacion } from '@/components/Confirmacion';
import { Loader2, MapPin, Pause, Play, Square } from 'lucide-react';
import HojaFlotante from '@/components/HojaFlotante';
import { LT, FONT, KP, NUM_STYLE, UI } from '@/lib/theme';
import { MINIMO_DE_SEGUNDOS, distanciaEnMetros, relojDeCronometro, unidadDeDistancia } from '@/lib/entrenoLibre';
import { guardaEntrenoLibre } from '@/lib/entrenoLibreApi';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { enVivo, textoDeRitmo, trazoDeRuta } from '@/lib/ubicacion';
import { MosaicoDeDeporte } from '@/features/metricas/Piezas';
import { Fila, Grupo, Pastilla, Segmentado } from '@/components/ui';
import { useSenalGps } from './useEntrenoLibre';
import { botonBlancoGrande, botonGrande } from './estilosLibre';

/* LA PANTALLA DEL CRONÓMETRO (entreno libre): el tiempo grande, «Pausar» y «Terminar». Al terminar pregunta la distancia (se puede dejar vacía) y guarda. Cerrar la hoja NO termina el
   entreno: el cronómetro sigue (vive en `useCronometroLibre`) y Home lo muestra como «Entreno en curso». Ver `lib/entrenoLibre.js`.
   CON GPS (reestructura visual, 15 oct 2026; Andrés: «dejarlo listo para cuando la app descargable esté»): correr, caminar y bici pasan antes por «Antes de salir»
   (la señal del GPS y «Empezar»); corriendo se ven distancia y ritmo, o la ruta dibujada («Datos | Ruta»), y los kilómetros que van. Al terminar, la distancia ya la midió
   el GPS: no se pregunta. La fuente de los puntos es intercambiable (`lib/ubicacion.js`): hoy el navegador, mañana el teléfono o el reloj. */

export default function PantallaDelCronometro({ userId, crono, pendiente = null, alEmpezar, alMinimizar, alGuardado }) {
  const { cronometro, segundos, muestras } = crono;
  const [fase, setFase] = useState('corre'); // corre | distancia | muy_corto | guardando
  const [distancia, setDistancia] = useState('');
  const [error, setError] = useState(null);
  const [vista, setVista] = useState('datos');
  const deporte = pendiente ?? cronometro?.deporte ?? 'correr';
  const unidad = unidadDeDistancia(deporte);
  const pausado = cronometro?.pausadoEn != null;
  const conGps = !pendiente && !!cronometro?.gps;
  const vivo = useMemo(() => (conGps ? enVivo(muestras) : null), [conGps, muestras]);
  const senal = useSenalGps(!!pendiente);
  const pregunta = useConfirmacion();

  const terminar = () => {
    const t = crono.termina();
    if (!t) return;
    if (t.duracionS < MINIMO_DE_SEGUNDOS) { setFase('muy_corto'); return; }
    // Con lo que midió el GPS ya no se pregunta la distancia; si casi no midió (sin señal), se pregunta como siempre.
    if (conGps && (vivo?.distanciaM ?? 0) >= 100) { guardar(null); return; }
    if (unidad) setFase('distancia'); else guardar(null);
  };

  // Descartar un entreno que ya pasó del mínimo: se pregunta, porque ya no se recupera.
  const descartar = async () => {
    const si = await pregunta({ titulo: '¿Descartar este entreno?', detalle: 'No se guardará y no se puede recuperar.', confirmar: 'Descartar', peligro: true });
    if (!si) return;
    crono.descarta();
    alMinimizar();
  };

  async function guardar(texto) {
    const t = crono.termina();
    if (!t) return;
    setFase('guardando');
    setError(null);
    try {
      const fila = await guardaEntrenoLibre({
        atletaId: userId, deporte: t.deporte, inicioMs: t.inicioMs, duracionS: t.duracionS, distanciaM: distanciaEnMetros(texto, t.deporte), muestras: t.muestras,
      });
      crono.descarta();
      alGuardado(fila);
    } catch (e) {
      setError(e?.message ?? 'No se pudo guardar. Revisa tu conexión e inténtalo otra vez.');
      setFase(unidad ? 'distancia' : 'corre');
    }
  }

  if (pendiente) {
    const lista = senal === 'lista';
    const textoSenal = { lista: 'GPS listo', buscando: 'Buscando señal…', negado: 'Sin permiso de ubicación', sin_senal: 'Sin señal de GPS', no_hay: 'Este navegador no tiene GPS' }[senal];
    return (
      <HojaFlotante titulo="Antes de salir" onCerrar={alMinimizar}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, padding: '18px 0 8px', fontFamily: FONT }}>
          <MosaicoDeDeporte deporte={deporte} size={64} />
          <div style={{ fontSize: 26, fontWeight: 800, color: LT.text, letterSpacing: -0.4 }}>{nombreDelDeporte(deporte)}</div>
          <div role="status" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 14px', borderRadius: 99, background: lista ? KP.mintSoft : UI.relleno, color: lista ? LT.mint : LT.text2, fontSize: 15, fontWeight: 700 }}>
            {senal === 'buscando' ? <Loader2 size={16} className="spin" /> : <MapPin size={16} />} {textoSenal}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%' }}>
            {/* Se puede salir sin esperar la señal: los puntos imprecisos del principio no cuentan (ver `agregaPunto`), así que no ensucian la distancia. */}
            <button type="button" onClick={() => alEmpezar({ gps: senal !== 'no_hay' && senal !== 'negado' })} className="kp-press" style={botonGrande()}>
              <Play size={20} fill="#fff" /> Empezar
            </button>
            {senal !== 'no_hay' && senal !== 'negado' && (
              <button type="button" onClick={() => alEmpezar({ gps: false })} className="kp-press" style={botonBlancoGrande()}>Sin GPS</button>
            )}
          </div>
        </div>
      </HojaFlotante>
    );
  }

  return (
    <HojaFlotante titulo={nombreDelDeporte(deporte)} onCerrar={alMinimizar}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22, padding: '18px 0 8px', fontFamily: FONT }}>
        {!conGps && <MosaicoDeDeporte deporte={deporte} size={64} />}

        {(fase === 'corre' || fase === 'guardando') && (
          <>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: 76, fontWeight: 800, letterSpacing: -2, color: pausado ? LT.text3 : LT.text, lineHeight: 1, ...NUM_STYLE }} role="timer" aria-label="Tiempo del entreno">{relojDeCronometro(segundos)}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: LT.warning, marginTop: 8, minHeight: 18 }}>{pausado ? 'En pausa' : ''}</div>
            </div>
            {conGps && <EnVivo deporte={deporte} vivo={vivo} muestras={muestras} vista={vista} setVista={setVista} />}
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
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, background: UI.relleno, border: 'none', borderRadius: 18, padding: '0 18px' }}>
              <input
                value={distancia} onChange={(e) => setDistancia(e.target.value)} inputMode="decimal" autoFocus placeholder="0" aria-label={`Distancia en ${unidad === 'm' ? 'metros' : 'kilómetros'}`}
                style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: 34, fontWeight: 800, color: LT.text, padding: '14px 0', ...NUM_STYLE }}
              />
              <span style={{ fontSize: 20, fontWeight: 800, color: LT.text2 }}>{unidad}</span>
            </label>
            {error && <div role="alert" style={{ padding: '9px 12px', borderRadius: 12, background: '#FDECEC', color: LT.danger, fontSize: 14, fontWeight: 700 }}>{error}</div>}
            <button type="submit" className="kp-press" style={botonGrande()}>Guardar</button>
            <button type="button" onClick={() => guardar(null)} className="kp-press" style={botonBlancoGrande()}>Sin distancia</button>
            <button type="button" onClick={descartar} className="kp-press" style={botonBlancoGrande()}>Descartar entreno</button>
          </form>
        )}

        {fase === 'muy_corto' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 19, fontWeight: 800, color: LT.text }}>Fue muy corto para guardarlo</div>
            <button type="button" onClick={() => { if (pausado) crono.reanuda(); setFase('corre'); }} className="kp-press" style={botonGrande()}>Seguir entrenando</button>
            <button type="button" onClick={() => { crono.descarta(); alMinimizar(); }} className="kp-press" style={botonBlancoGrande()}>Descartar</button>
          </div>
        )}
      </div>
    </HojaFlotante>
  );
}

/** Lo que mide el GPS mientras corre: «Datos» (distancia y ritmo; en bici, velocidad) o «Ruta» (la ruta dibujada), y los kilómetros que van. */
function EnVivo({ deporte, vivo, muestras, vista, setVista }) {
  const km = (vivo?.distanciaM ?? 0) / 1000;
  const enBici = deporte === 'bici';
  const segundos = muestras.length ? muestras[muestras.length - 1].t : 0;
  const velocidad = segundos > 0 && km > 0 ? (km / (segundos / 3600)).toFixed(1) : '—';
  const trazo = vista === 'ruta' ? trazoDeRuta(muestras, { ancho: 320, alto: 220, margen: 22 }) : null;
  return (
    <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <Segmentado etiqueta="Ver" valor={vista} onCambio={setVista} opciones={[{ valor: 'datos', texto: 'Datos' }, { valor: 'ruta', texto: 'Ruta' }]} />
      {vista === 'datos' ? (
        <div style={{ display: 'flex', gap: 10 }}>
          <Dato valor={km.toFixed(2)} unidad="km" />
          {enBici ? <Dato valor={velocidad} unidad="km/h" /> : <Dato valor={textoDeRitmo(vivo?.ritmoSKm)} unidad="/km" />}
        </div>
      ) : (
        <div style={{ position: 'relative', background: '#15171E', borderRadius: UI.rTarjeta, height: 220, overflow: 'hidden' }}>
          {trazo ? (
            <svg viewBox="0 0 320 220" width="100%" height="100%" preserveAspectRatio="xMidYMid meet" role="img" aria-label="Tu ruta">
              <path d={trazo.d} fill="none" stroke="#5B8CFF" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx={trazo.inicio[0]} cy={trazo.inicio[1]} r="6" fill="#fff" />
              <circle cx={trazo.fin[0]} cy={trazo.fin[1]} r="7" fill={KP.blue} stroke="#fff" strokeWidth="3" />
            </svg>
          ) : (
            <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: 'rgba(255,255,255,0.7)', fontSize: 15, fontWeight: 700 }}>Aún sin ruta</div>
          )}
          <div style={{ position: 'absolute', left: 14, bottom: 12 }}><Pastilla>{km.toFixed(2)} km</Pastilla></div>
        </div>
      )}
      {vivo?.kms?.length > 0 && (
        <Grupo titulo="Kilómetros">
          {vivo.kms.map((k) => <Fila key={k.n} texto={`Km ${k.n}`} valor={textoDeRitmo(k.dur)} valorTono="neutro" />)}
        </Grupo>
      )}
    </div>
  );
}

function Dato({ valor, unidad }) {
  return (
    <div style={{ flex: 1, minWidth: 0, background: LT.surface, borderRadius: UI.rGrupo, padding: '14px 10px', textAlign: 'center', boxShadow: UI.sombraGrupo }}>
      <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, color: LT.text, lineHeight: 1.05, ...NUM_STYLE }}>{valor}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: LT.text2, marginTop: 4 }}>{unidad}</div>
    </div>
  );
}
