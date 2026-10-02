import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { useIsDesktop } from '@/lib/useViewport';
import { T, FONT, KP } from '@/lib/theme';

/**
 * La ventana de «Mis planes»: una tarjeta al centro en la compu y casi a pantalla completa en el
 * teléfono, con su título, su X y, abajo, los botones. Se dibuja colgada del documento y por encima
 * del editor de planes (capa 2800, como el resto de sus diálogos): se abre igual desde la pestaña,
 * desde la ficha de un atleta y desde dentro del editor, y un `overflow` o un `transform` de lo que
 * la abre no la recorta. Los avisos de confirmar (capa 5000) quedan por encima.
 *
 * `ancho`: lo que mide en la compu. `pie`: los botones, fijos abajo mientras el contenido se desplaza.
 */
export default function Ventana({ titulo, subtitulo, onCerrar, ancho = 480, pie, children }) {
  const esCompu = useIsDesktop();

  useEffect(() => {
    const alTeclear = (e) => { if (e.key === 'Escape') onCerrar?.(); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  return createPortal(
    <div
      onMouseDown={onCerrar}
      style={{
        position: 'fixed', inset: 0, zIndex: 2800, background: 'rgba(17,19,24,0.5)', backdropFilter: 'blur(4px)',
        display: 'grid', placeItems: esCompu ? 'center' : 'end center', padding: esCompu ? 16 : 0,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-label={titulo}
        className={esCompu ? 'animate-fade-in' : 'animate-sheet'}
        style={{
          width: '100%', maxWidth: esCompu ? ancho : undefined, maxHeight: esCompu ? '86svh' : '94svh',
          display: 'flex', flexDirection: 'column', background: T.bg, fontFamily: FONT, boxShadow: KP.shPop,
          borderRadius: esCompu ? 20 : '22px 22px 0 0', overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '16px 18px 10px', flexShrink: 0 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.text, letterSpacing: -0.2, overflowWrap: 'anywhere' }}>{titulo}</div>
            {subtitulo && <div style={{ fontSize: 13, color: T.text2, fontWeight: 600, marginTop: 2, lineHeight: 1.4 }}>{subtitulo}</div>}
          </div>
          <button
            type="button" onClick={onCerrar} aria-label="Cerrar"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text2, padding: 4, flexShrink: 0 }}
          >
            <X size={20} />
          </button>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '4px 18px 16px' }}>{children}</div>
        {pie && (
          <div style={{
            flexShrink: 0, display: 'flex', justifyContent: 'flex-end', gap: 10, flexWrap: 'wrap',
            padding: '12px 18px calc(14px + env(safe-area-inset-bottom))', borderTop: `1px solid ${T.border}`, background: T.bg,
          }}>
            {pie}
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
