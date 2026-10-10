import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Pause, Play, X } from 'lucide-react';
import { T, FONT } from '@/lib/theme';

/* LO QUE SE VE DENTRO DE UNA BURBUJA con archivo: la foto (se abre grande), el video (con sus controles) y la nota de voz (con su reproductor).

   Los archivos viven en un bucket PRIVADO y se ven con direcciones firmadas de una hora: las pide quien dibuja la conversación (`urls`) y, si una deja de servir, `alFallar(ruta)`
   pide otra. Las fotos, los videos y las notas de voz se borran a los 90 días (la técnica, a los 30): entonces el mensaje queda con «venció». */

const reloj = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const NOMBRE = { foto: 'La foto', video: 'El video', voz: 'La nota de voz', tecnica: 'El video', correccion: 'El archivo' };

export function Vencido({ tipo, mio }) {
  return (
    <span style={{ display: 'block', fontStyle: 'italic', fontSize: 14, color: mio ? 'rgba(255,255,255,0.85)' : T.text2, padding: '4px 6px' }}>
      {NOMBRE[tipo] ?? 'El archivo'} ya venció.
    </span>
  );
}

function Visor({ url, alCerrar }) {
  useEffect(() => {
    const alTeclear = (e) => { if (e.key === 'Escape') alCerrar(); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [alCerrar]);
  return createPortal(
    <div
      role="dialog" aria-label="Foto" onClick={alCerrar}
      style={{ position: 'fixed', inset: 0, zIndex: 3300, background: 'rgba(0,0,0,0.92)', display: 'grid', placeItems: 'center', padding: 16 }}
    >
      <img src={url} alt="Foto" style={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', borderRadius: 8 }} />
      <button
        type="button" onClick={alCerrar} aria-label="Cerrar"
        style={{ position: 'absolute', top: 'calc(14px + env(safe-area-inset-top))', right: 14, width: 44, height: 44, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.16)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer' }}
      >
        <X size={22} />
      </button>
    </div>,
    document.body,
  );
}

/** El reproductor de una nota de voz: botón, barra y lo que falta. La duración sale de lo que se guardó al grabar (el archivo no la trae). */
function NotaDeVoz({ url, segundos, mio, alFallar }) {
  const audio = useRef(null);
  const [suena, setSuena] = useState(false);
  const [avance, setAvance] = useState(0);
  const total = segundos || 0;
  const tinta = mio ? '#fff' : T.accent;
  return (
    <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 210, padding: '2px 4px' }}>
      <audio
        ref={audio} src={url ?? undefined} preload="metadata"
        onTimeUpdate={() => setAvance(audio.current?.currentTime ?? 0)}
        onEnded={() => { setSuena(false); setAvance(0); }}
        onPause={() => setSuena(false)} onPlay={() => setSuena(true)} onError={alFallar}
      />
      <button
        type="button" disabled={!url} aria-label={suena ? 'Pausar la nota de voz' : 'Escuchar la nota de voz'}
        onClick={() => { const a = audio.current; if (!a) return; if (a.paused) a.play().catch(alFallar); else a.pause(); }}
        style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', flexShrink: 0, display: 'grid', placeItems: 'center', cursor: url ? 'pointer' : 'default', background: mio ? 'rgba(255,255,255,0.22)' : T.accentBg, color: tinta, touchAction: 'manipulation' }}
      >
        {suena ? <Pause size={18} fill="currentColor" /> : <Play size={18} fill="currentColor" style={{ marginLeft: 2 }} />}
      </button>
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', height: 5, borderRadius: 3, background: mio ? 'rgba(255,255,255,0.3)' : T.bg3, overflow: 'hidden' }}>
          <span style={{ display: 'block', height: '100%', width: `${total ? Math.min(100, (avance / total) * 100) : 0}%`, background: tinta, borderRadius: 3 }} />
        </span>
        <span style={{ display: 'block', marginTop: 4, fontFamily: FONT, fontSize: 12, fontWeight: 700, color: mio ? 'rgba(255,255,255,0.85)' : T.text2, fontVariantNumeric: 'tabular-nums' }}>
          {suena || avance > 0 ? `${reloj(avance)} / ` : ''}{reloj(total)}
        </span>
      </span>
    </span>
  );
}

/** `m`: el mensaje (con `adjunto`). `url`: su dirección firmada (o `null` mientras se pide). `mio`: lo escribió quien mira. */
export default function Adjunto({ m, mio, url, alFallar }) {
  const [grande, setGrande] = useState(false);
  const a = m.adjunto;
  if (m.adjunto_borrado || !a) return <Vencido tipo={m.tipo} mio={mio} />;
  const falla = () => alFallar?.(a.ruta);
  if (m.tipo === 'foto') {
    const proporcion = a.ancho && a.alto ? `${a.ancho} / ${a.alto}` : '4 / 3';
    return (
      <>
        <button
          type="button" onClick={() => url && setGrande(true)} aria-label="Ver la foto en grande"
          style={{ display: 'block', padding: 0, border: 'none', background: 'transparent', cursor: url ? 'zoom-in' : 'default', borderRadius: 14, overflow: 'hidden', touchAction: 'manipulation' }}
        >
          {url ? (
            <img src={url} alt="Foto" onError={falla} style={{ display: 'block', width: 'min(240px, 62vw)', maxHeight: 340, aspectRatio: proporcion, objectFit: 'cover', background: T.bg3 }} />
          ) : (
            <span style={{ display: 'block', width: 'min(240px, 62vw)', aspectRatio: proporcion, maxHeight: 340, background: T.bg3 }} />
          )}
        </button>
        {grande && url && <Visor url={url} alCerrar={() => setGrande(false)} />}
      </>
    );
  }
  if (m.tipo === 'video') {
    return url ? (
      <video
        src={`${url}#t=0.1`} controls playsInline preload="metadata" onError={falla}
        style={{ display: 'block', width: 'min(260px, 66vw)', maxHeight: 360, borderRadius: 14, background: '#000' }}
      />
    ) : (
      <span style={{ display: 'block', width: 'min(260px, 66vw)', aspectRatio: a.ancho && a.alto ? `${a.ancho} / ${a.alto}` : '16 / 9', maxHeight: 360, borderRadius: 14, background: T.bg3 }} />
    );
  }
  if (m.tipo === 'voz') return <NotaDeVoz url={url} segundos={a.segundos} mio={mio} alFallar={falla} />;
  return null;
}
