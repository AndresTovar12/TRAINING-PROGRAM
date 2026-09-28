import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Loader2 } from 'lucide-react';
import { FONT, KP } from '@/lib/theme';

/**
 * Pide un nombre y crea algo con él: una categoría, un grupo muscular.
 *
 * Se abre desde las listas del repertorio ("Agregar categoría", "Agregar
 * grupo") y desde el editor de un ejercicio. Tiene el mismo aire que el
 * "¿seguro?" de la app (`Confirmacion`) para que se lea como parte de ella.
 *
 * `onCrear(nombre)` hace el trabajo. Si lanza un error, su mensaje se enseña
 * aquí y el diálogo sigue abierto con lo escrito, para corregirlo.
 *
 * Se dibuja colgado del documento: un `transform` o un `overflow` de cualquier
 * antepasado lo encerraría. Ya pasó con las listas y con la cámara.
 */
export default function DialogoNombre({
  titulo, detalle, placeholder, boton = 'Crear', onCrear, onCancelar,
}) {
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const alTeclear = (e) => { if (e.key === 'Escape' && !guardando) onCancelar(); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [guardando, onCancelar]);

  async function crear() {
    const n = nombre.trim();
    if (!n) { setErr('Ponle un nombre.'); return; }
    setGuardando(true);
    setErr('');
    try {
      await onCrear(n);
    } catch (e) {
      setErr(e.message || 'No se pudo crear.');
      setGuardando(false);
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={titulo}
      onClick={(e) => { if (e.target === e.currentTarget && !guardando) onCancelar(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 5000, display: 'grid', placeItems: 'center',
        padding: 20, background: 'rgba(17, 19, 24, 0.45)', fontFamily: FONT,
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: '100%', maxWidth: 380, background: KP.surface, borderRadius: 20,
          border: `1px solid ${KP.line}`, boxShadow: KP.shPop, padding: 22,
          display: 'flex', flexDirection: 'column', gap: 14,
        }}
      >
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: KP.ink, lineHeight: 1.3 }}>{titulo}</div>
          {detalle && (
            <div style={{ fontSize: 13.5, color: KP.ink2, lineHeight: 1.5, marginTop: 6, fontWeight: 500 }}>
              {detalle}
            </div>
          )}
        </div>

        <input
          value={nombre}
          onChange={(e) => { setNombre(e.target.value); setErr(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); crear(); } }}
          placeholder={placeholder}
          aria-label={titulo}
          autoFocus
          maxLength={40}
          style={{
            width: '100%', boxSizing: 'border-box', padding: '12px 14px', borderRadius: 12,
            border: `1.5px solid ${err ? KP.danger : KP.line}`, background: KP.bg, outline: 'none',
            // 16 px: por debajo, el iPhone acerca la pantalla al escribir.
            fontFamily: FONT, fontSize: 16, fontWeight: 600, color: KP.ink,
          }}
        />
        {err && <div style={{ fontSize: 13, fontWeight: 700, color: KP.danger, marginTop: -6 }}>{err}</div>}

        <div style={{ display: 'flex', gap: 9 }}>
          <button
            type="button"
            onClick={onCancelar}
            disabled={guardando}
            className="kp-press"
            style={{
              flex: 1, padding: '13px 14px', borderRadius: 13, cursor: guardando ? 'default' : 'pointer',
              border: `1.5px solid ${KP.line}`, background: KP.surface, color: KP.ink,
              fontFamily: FONT, fontSize: 14.5, fontWeight: 700,
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={crear}
            disabled={guardando}
            className="kp-press"
            style={{
              flex: 1, padding: '13px 14px', borderRadius: 13, cursor: guardando ? 'default' : 'pointer',
              border: 'none', background: KP.blue, color: '#fff',
              fontFamily: FONT, fontSize: 14.5, fontWeight: 800,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            {guardando && <Loader2 size={15} className="spin" />}
            {boton}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
