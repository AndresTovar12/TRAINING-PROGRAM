import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, RotateCcw, Send, Video, X } from 'lucide-react';
import { T, KP, FONT } from '@/lib/theme';
import GrabadoraDeVideo from '@/features/admin/GrabadoraDeVideo';
import { conIndice } from '@/lib/indiceDeVideo';
import { pesoTexto } from '@/lib/imagen';
import { mandaTecnica } from '@/lib/mensajesApi';
import { LIMITES, leeVideo } from '@/features/mensajes/adjuntos';

/* GRABAR LA TÉCNICA DE UNA SERIE y mandársela a quien puso el ejercicio en el plan.

   Andrés, 10 oct 2026: durante el entreno, al terminar una serie, el atleta (opcional) graba SU técnica, hasta 60 segundos, también en la web; le llega a su coach (o al
   profesional que puso ese ejercicio) como una tarjeta con «Técnica correcta» y «Corregir». Aquí va el camino del atleta:
     1. la cámara de la app (la misma que usa el coach para grabar ejemplos; corta sola a los 60 s y graba a ≤ 4 Mbps para que quepa en los 50 MB del bucket),
        o, si la cámara no abre, la del teléfono;
     2. «¿La mandamos?»: se ve lo grabado y se elige entre mandarla o grabar otra vez;
     3. se sube (con índice, sin recodificar) y la función `mandar_tecnica` crea la tarjeta;
     4. «Listo, se la mandaste a …»: el entreno sigue. El id de la técnica lo guarda el motor en `hechos[clave].tecnica`.

   `destino`: `{ id, nombre }` del profesional. `ejercicio` y `detalle` («Serie 2 de 4») son lo que verá en la tarjeta. `intentoDe`: la técnica anterior de esta serie (otro intento).
   `alEnviar(tecnicaId)`: ya se mandó. `alCerrar()`: se salió sin mandar o después de mandar. */

const TOPE_DE_RITMO = 4_000_000;

function Capa({ children }) {
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 5200, background: '#0B0E14', color: '#fff', fontFamily: FONT, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {children}
    </div>,
    document.body,
  );
}

function Boton({ children, onClick, principal = false, disabled = false, ancho = true }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} className="kp-press"
      style={{
        width: ancho ? '100%' : undefined, minHeight: 54, padding: '0 20px', borderRadius: 18, cursor: disabled ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
        fontFamily: FONT, fontSize: 16.5, fontWeight: 800, touchAction: 'manipulation', opacity: disabled ? 0.6 : 1,
        border: principal ? 'none' : '1.5px solid rgba(255,255,255,0.28)', background: principal ? T.accent : 'transparent', color: '#fff',
      }}
    >
      {children}
    </button>
  );
}

export default function GrabaTecnica({ atletaId, destino, ejercicio, detalle = null, sesionId = null, clave = null, intentoDe = null, alEnviar, alCerrar }) {
  const [etapa, setEtapa] = useState('camara'); // 'camara' | 'telefono' | 'revisar' | 'subiendo' | 'listo'
  const [archivo, setArchivo] = useState(null);
  const [error, setError] = useState(null);
  const [intentos, setIntentos] = useState(0); // para reabrir la cámara desde cero al repetir
  const selector = useRef(null);
  const nombre = destino?.nombre ?? 'tu coach';
  const url = useMemo(() => (archivo ? URL.createObjectURL(archivo) : null), [archivo]);
  useEffect(() => () => { if (url) URL.revokeObjectURL(url); }, [url]);

  const grabado = (file) => { setArchivo(file); setError(null); setEtapa('revisar'); };
  const otraVez = () => { setArchivo(null); setError(null); setIntentos((n) => n + 1); setEtapa('camara'); };

  async function manda() {
    if (!archivo) return;
    setError(null);
    setEtapa('subiendo');
    try {
      if (archivo.size > LIMITES.videoMB * 1048576) {
        throw new Error(`El video pesa ${pesoTexto(archivo.size)} y el máximo es ${LIMITES.videoMB} MB. Graba uno más corto.`);
      }
      const medidas = await leeVideo(archivo);
      if (medidas && medidas.segundos > LIMITES.videoSegundos + 0.5) {
        throw new Error(`El video dura ${Math.round(medidas.segundos)} segundos y el máximo es ${LIMITES.videoSegundos}. Graba uno más corto.`);
      }
      const { archivo: conIndiceListo } = await conIndice(archivo);
      const id = await mandaTecnica({
        atletaId, profesionalId: destino.id, ejercicio, detalle, sesionId, clave, archivo: conIndiceListo, mime: conIndiceListo.type || archivo.type || 'video/mp4',
        segundos: medidas?.segundos ?? null, intentoDe,
      });
      alEnviar?.(id);
      setEtapa('listo');
    } catch (e) {
      setError(e?.message ?? 'No se pudo mandar el video. Inténtalo otra vez.');
      setEtapa('revisar');
    }
  }

  if (etapa === 'camara') {
    return (
      <GrabadoraDeVideo
        key={intentos} proposito="tecnica" maxSegundos={LIMITES.videoSegundos} ritmoMaximo={TOPE_DE_RITMO}
        onListo={(file) => grabado(file)} onCancelar={alCerrar} onSinCamara={() => setEtapa('telefono')}
      />
    );
  }

  if (etapa === 'telefono') {
    return (
      <Capa>
        <div style={{ width: '100%', maxWidth: 480, flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 16, padding: '24px 22px' }}>
          <div style={{ textAlign: 'center' }}>
            <Video size={42} />
            <div style={{ fontSize: 22, fontWeight: 800, marginTop: 12 }}>Graba con la cámara del teléfono</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.72)', marginTop: 8, lineHeight: 1.5 }}>La cámara de la app no se pudo abrir. Graba tu serie (hasta {LIMITES.videoSegundos} segundos) y la mandamos a {nombre}.</div>
          </div>
          <input
            ref={selector} type="file" accept="video/*" capture="environment" hidden
            onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) grabado(f); }}
          />
          <Boton principal onClick={() => selector.current?.click()}><Video size={20} /> Abrir la cámara</Boton>
          <Boton onClick={alCerrar}>Cancelar</Boton>
        </div>
      </Capa>
    );
  }

  return (
    <Capa>
      <div style={{ width: '100%', maxWidth: 520, flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', padding: 'calc(14px + env(safe-area-inset-top)) 18px calc(16px + env(safe-area-inset-bottom))' }}>
        {etapa !== 'listo' && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 19, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ejercicio}</div>
              {detalle && <div style={{ fontSize: 14, color: 'rgba(255,255,255,0.7)', fontWeight: 600 }}>{detalle}</div>}
            </div>
            <button type="button" onClick={alCerrar} aria-label="Cerrar sin mandar" disabled={etapa === 'subiendo'} style={{ width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.14)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
              <X size={22} />
            </button>
          </div>
        )}

        {etapa === 'listo' ? (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center' }}>
            <div style={{ width: 84, height: 84, borderRadius: '50%', background: KP.mint, display: 'grid', placeItems: 'center' }}><Check size={46} strokeWidth={3.2} /></div>
            <div style={{ fontSize: 24, fontWeight: 800 }}>Se la mandaste a {nombre}</div>
            <div style={{ fontSize: 15, color: 'rgba(255,255,255,0.72)', lineHeight: 1.5, maxWidth: 320 }}>Te contesta en Mensajes. Sigue con tu entreno.</div>
            <div style={{ width: '100%', marginTop: 10 }}><Boton principal onClick={alCerrar}>Seguir con el entreno</Boton></div>
          </div>
        ) : (
          <>
            <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', padding: '14px 0' }}>
              {url && <video src={url} controls playsInline autoPlay muted loop style={{ maxWidth: '100%', maxHeight: '100%', borderRadius: 18, background: '#000' }} />}
            </div>
            {error && <div role="alert" style={{ margin: '0 0 12px', padding: '10px 14px', borderRadius: 14, background: 'rgba(220,38,38,0.2)', color: '#FFB4B4', fontSize: 14, fontWeight: 700 }}>{error}</div>}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <Boton principal onClick={manda} disabled={etapa === 'subiendo'}>
                {etapa === 'subiendo' ? <><Loader2 size={20} className="spin" /> Mandando…</> : <><Send size={20} /> Mandar a {nombre}</>}
              </Boton>
              <Boton onClick={otraVez} disabled={etapa === 'subiendo'}><RotateCcw size={19} /> Grabar otra vez</Boton>
            </div>
          </>
        )}
      </div>
    </Capa>
  );
}
