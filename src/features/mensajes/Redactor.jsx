import { useCallback, useRef, useState } from 'react';
import { Loader2, Mic, Paperclip, Send, X } from 'lucide-react';
import { T, KP, FONT } from '@/lib/theme';
import { useIsDesktop } from '@/lib/useViewport';
import { puedeGrabarVoz, useGrabadoraDeVoz } from '@/features/mensajes/useGrabadoraDeVoz';

/* DONDE SE ESCRIBE: la caja de texto, el clip para una foto o un video (el teléfono ofrece la galería o la cámara) y, cuando no hay texto, el micrófono para una nota de voz.

   Al tocar el micrófono se graba: aparece el reloj con ✕ (tirar) y ✓ (mandar). Quien lo pone decide qué pasa con lo que se manda: `alTexto(texto)`, `alArchivo(archivo)` y
   `alVoz(archivo, segundos)` devuelven una promesa; mientras se resuelve, `ocupado` apaga los botones y `subiendo` dice qué se está subiendo. En la computadora Enter manda y
   Shift+Enter baja de renglón; en el teléfono Enter baja de renglón (el botón manda). */

function Redondo({ children, style, ...props }) {
  return (
    <button
      type="button" className="kp-press"
      style={{ width: 46, height: 46, borderRadius: '50%', border: 'none', flexShrink: 0, display: 'grid', placeItems: 'center', touchAction: 'manipulation', cursor: 'pointer', ...style }}
      {...props}
    >
      {children}
    </button>
  );
}

const reloj = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export default function Redactor({ alTexto, alArchivo, alVoz, alError, ocupado = false, subiendo = null }) {
  const esCompu = useIsDesktop();
  const [texto, setTexto] = useState('');
  const campo = useRef(null);
  const selector = useRef(null);
  const voz = useGrabadoraDeVoz({
    alTerminar: (archivo, segundos) => alVoz(archivo, segundos),
    alFallar: (mensaje) => alError?.(mensaje),
  });
  const conVoz = puedeGrabarVoz();
  const hayTexto = texto.trim().length > 0;

  const ajustaAlto = useCallback(() => {
    const t = campo.current;
    if (!t) return;
    t.style.height = 'auto';
    t.style.height = `${Math.min(t.scrollHeight, 132)}px`;
  }, []);

  async function envia() {
    const limpio = texto.trim();
    if (!limpio || ocupado) return;
    try {
      await alTexto(limpio);
      setTexto('');
      requestAnimationFrame(() => { if (campo.current) { campo.current.style.height = 'auto'; campo.current.focus(); } });
    } catch { /* quien lo pone ya avisó; el texto se queda para reintentar */ }
  }

  const alElegirArchivo = (e) => {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (archivo) alArchivo(archivo);
  };

  const caja = { flexShrink: 0, padding: '8px 12px calc(10px + env(safe-area-inset-bottom))', background: KP.surface, borderTop: `1px solid ${KP.line}` };

  if (voz.grabando) {
    return (
      <div style={{ ...caja, display: 'flex', alignItems: 'center', gap: 10 }}>
        <Redondo onClick={voz.cancela} aria-label="Tirar la nota de voz" style={{ background: T.bg3, color: T.text }}><X size={20} /></Redondo>
        <div role="status" style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 10, fontFamily: FONT, fontSize: 16, fontWeight: 800, color: T.text, fontVariantNumeric: 'tabular-nums' }}>
          <span aria-hidden="true" style={{ width: 11, height: 11, borderRadius: '50%', background: KP.danger, animation: 'kp-parpadeo 1s ease-in-out infinite' }} />
          Grabando {reloj(voz.segundos)}
        </div>
        <Redondo onClick={voz.termina} aria-label="Mandar la nota de voz" style={{ background: T.accent, color: '#fff' }}><Send size={20} /></Redondo>
        <style>{'@keyframes kp-parpadeo { 0%,100% { opacity: 1 } 50% { opacity: 0.25 } }'}</style>
      </div>
    );
  }

  return (
    <div style={caja}>
      {subiendo && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 4px 8px', fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: T.accent }}>
          <Loader2 size={16} className="spin" /> {subiendo}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8 }}>
        <Redondo onClick={() => selector.current?.click()} disabled={ocupado} aria-label="Mandar una foto o un video" style={{ background: T.bg3, color: T.text2 }}><Paperclip size={21} /></Redondo>
        <input ref={selector} type="file" accept="image/*,video/*" onChange={alElegirArchivo} hidden />
        <textarea
          ref={campo} value={texto} rows={1} placeholder="Escribe un mensaje" aria-label="Escribe un mensaje" maxLength={4000}
          onChange={(e) => { setTexto(e.target.value); ajustaAlto(); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey && esCompu) { e.preventDefault(); envia(); } }}
          style={{
            flex: 1, minWidth: 0, resize: 'none', border: `1.5px solid ${T.border}`, borderRadius: 20, background: T.bg, padding: '11px 15px', fontFamily: FONT, fontSize: 16, lineHeight: 1.35,
            color: T.text, outline: 'none', maxHeight: 132,
          }}
        />
        {hayTexto || !conVoz ? (
          <Redondo
            onClick={envia} disabled={!hayTexto || ocupado} aria-label="Enviar"
            style={{ background: hayTexto ? T.accent : T.bg3, color: hayTexto ? '#fff' : T.text3, cursor: hayTexto && !ocupado ? 'pointer' : 'default' }}
          >
            {ocupado ? <Loader2 size={20} className="spin" /> : <Send size={20} />}
          </Redondo>
        ) : (
          <Redondo onClick={voz.inicia} disabled={ocupado} aria-label="Grabar una nota de voz" style={{ background: T.accent, color: '#fff' }}><Mic size={21} /></Redondo>
        )}
      </div>
    </div>
  );
}
