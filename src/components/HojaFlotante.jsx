import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, X } from 'lucide-react';
import { useIsDesktop } from '@/lib/useViewport';
import { LT, FONT, KP, NUM_STYLE } from '@/lib/theme';

/**
 * Lo que envuelve al programa cuando se abre encima de la pantalla.
 *
 * Andrés, 24 sep 2026, sobre la hoja del programa: "lo único que no me gusta
 * es que la card está como que saliendo de la parte de abajo". Era una hoja
 * de iPhone —pegada abajo, con el asa gris arriba— también en computadora,
 * donde no tiene sentido y además quedaba cortada por el borde inferior.
 *
 * Eligió:
 *   computadora → card flotante al centro, con aire alrededor
 *   teléfono    → pantalla completa, con flecha para volver
 *
 * Se dibuja colgada del documento y no dentro de la pantalla que la abre: un
 * `transform` o un `overflow` de cualquier antepasado la encerraría o la
 * recortaría. Ya pasó con la cámara y con las listas desplegables.
 */
export default function HojaFlotante({ titulo, subtitulo, onCerrar, children }) {
  const esCompu = useIsDesktop();

  useEffect(() => {
    const alTeclear = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [onCerrar]);

  /* Con la hoja abierta, lo de atrás no se mueve. `overflow: hidden` no basta
     en iPhone —Safari desplaza igual—; lo único que funciona es fijar el body
     y devolverlo a su sitio al cerrar. */
  useEffect(() => {
    const y = window.scrollY;
    const b = document.body;
    const antes = {
      position: b.style.position, top: b.style.top, left: b.style.left,
      right: b.style.right, width: b.style.width, overflow: b.style.overflow,
    };
    Object.assign(b.style, {
      position: 'fixed', top: `-${y}px`, left: '0', right: '0', width: '100%', overflow: 'hidden',
    });
    return () => { Object.assign(b.style, antes); window.scrollTo(0, y); };
  }, []);

  const cabecera = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0,
      padding: esCompu ? '18px 18px 12px' : 'calc(12px + env(safe-area-inset-top)) 14px 12px',
      borderBottom: esCompu ? 'none' : `1px solid ${LT.border}`,
      background: esCompu ? 'transparent' : LT.bg,
    }}>
      {!esCompu && (
        <button
          type="button" onClick={onCerrar} aria-label="Volver"
          style={{
            width: 38, height: 38, borderRadius: 12, flexShrink: 0, border: `1px solid ${LT.border}`,
            background: LT.surface, color: LT.text, cursor: 'pointer', display: 'grid', placeItems: 'center',
          }}
        >
          <ChevronLeft size={20} />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: esCompu ? 19 : 17, fontWeight: 800, color: LT.text, letterSpacing: -0.3 }}>
          {titulo}
        </div>
        {subtitulo && (
          <div style={{ fontSize: 12.5, fontWeight: 600, color: LT.text3, marginTop: 2, ...NUM_STYLE }}>
            {subtitulo}
          </div>
        )}
      </div>
      {esCompu && (
        <button
          type="button" onClick={onCerrar} aria-label="Cerrar"
          style={{
            width: 32, height: 32, borderRadius: 16, flexShrink: 0, border: 'none', cursor: 'pointer',
            background: LT.surface2, color: LT.text2, display: 'grid', placeItems: 'center',
          }}
        >
          <X size={17} />
        </button>
      )}
    </div>
  );

  const cuerpo = (
    <div style={{
      flex: 1, minHeight: 0, overflowY: 'auto',
      padding: esCompu ? '0 18px 20px' : '14px 14px calc(24px + env(safe-area-inset-bottom))',
    }}>
      {children}
    </div>
  );

  if (!esCompu) {
    return createPortal(
      <div
        role="dialog" aria-modal="true" aria-label={titulo}
        className="animate-fade-in"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: '100dvh', zIndex: 3000,
          background: LT.bg, display: 'flex', flexDirection: 'column', fontFamily: FONT,
        }}
      >
        {cabecera}
        {cuerpo}
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'rgba(17,19,24,0.45)', fontFamily: FONT,
      }}
    >
      <div
        role="dialog" aria-modal="true" aria-label={titulo}
        className="animate-fade-in"
        style={{
          width: '100%', maxWidth: 580, maxHeight: 'min(86vh, 900px)',
          background: LT.bg, borderRadius: 22, boxShadow: KP.shPop,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {cabecera}
        {cuerpo}
      </div>
    </div>,
    document.body,
  );
}
