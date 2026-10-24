import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, X } from 'lucide-react';
import { useIsDesktop } from '@/lib/useViewport';
import { LT, FONT, KP, NUM_STYLE, UI } from '@/lib/theme';

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
 * `pie` (opcional): un pie fijo abajo, fuera del desplazamiento.
 * `ancho` (opcional, 580 px por defecto): lo ancho que es la card en computadora; las métricas, con sus gráficas, piden más.
 *
 * Se dibuja colgada del documento y no dentro de la pantalla que la abre: un
 * `transform` o un `overflow` de cualquier antepasado la encerraría o la
 * recortaría. Ya pasó con la cámara y con las listas desplegables.
 */
// `capa`: la altura (zIndex) por si se abre encima de otra pantalla completa que ya va más arriba (la página de una actividad).
export default function HojaFlotante({ titulo, subtitulo, onCerrar, pie = null, ancho = 580, capa = 3000, children }) {
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
      // Reestructura visual (15 oct 2026): sin raya abajo, flecha en un cuadro gris y título grande, como «Mi perfil» en las capturas de Andrés.
      padding: esCompu ? '20px 20px 12px' : 'calc(12px + env(safe-area-inset-top)) 16px 10px',
      background: esCompu ? 'transparent' : UI.fondo,
    }}>
      {!esCompu && (
        <button
          type="button" onClick={onCerrar} aria-label="Volver"
          style={{
            width: 42, height: 42, borderRadius: 13, flexShrink: 0, border: 'none',
            background: UI.relleno, color: LT.text, cursor: 'pointer', display: 'grid', placeItems: 'center',
          }}
        >
          <ChevronLeft size={20} />
        </button>
      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: esCompu ? 23 : 22, fontWeight: 800, color: LT.text, letterSpacing: -0.4, lineHeight: 1.15 }}>
          {titulo}
        </div>
        {subtitulo && (
          <div style={{ fontSize: 13.5, fontWeight: 600, color: LT.text2, marginTop: 2, ...NUM_STYLE }}>
            {subtitulo}
          </div>
        )}
      </div>
      {esCompu && (
        <button
          type="button" onClick={onCerrar} aria-label="Cerrar"
          style={{
            width: 36, height: 36, borderRadius: 12, flexShrink: 0, border: 'none', cursor: 'pointer',
            background: UI.relleno, color: LT.text2, display: 'grid', placeItems: 'center',
          }}
        >
          <X size={17} />
        </button>
      )}
    </div>
  );

  const cuerpo = (
    <div data-hoja-cuerpo style={{
      flex: 1, minHeight: 0, overflowY: 'auto',
      // Con un pie fijo abajo, el margen de seguridad del iPhone lo pone el pie; el cuerpo no lo repite.
      padding: esCompu ? (pie ? '4px 20px 14px' : '4px 20px 22px') : (pie ? '10px 16px 14px' : '10px 16px calc(24px + env(safe-area-inset-bottom))'),
      // El relleno del cuerpo, a la mano de lo que va adentro: una barra pegada arriba o abajo (`position: sticky`) lo estira con margen negativo para llegar hasta el borde de la hoja.
      '--hoja-px': esCompu ? '20px' : '16px',
      '--hoja-pt': esCompu ? '4px' : '10px',
      '--hoja-pb': esCompu ? (pie ? '14px' : '20px') : (pie ? '14px' : 'calc(24px + env(safe-area-inset-bottom))'),
    }}>
      {children}
    </div>
  );

  // `pie`: lo que se queda fijo abajo mientras el cuerpo se desplaza (el botón de «Guardar» de un formulario largo).
  const pieFijo = pie && (
    <div style={{
      flexShrink: 0, borderTop: `1px solid ${UI.hilo}`, background: UI.fondo,
      padding: esCompu ? '12px 18px 16px' : '12px 14px calc(12px + env(safe-area-inset-bottom))',
    }}>
      {pie}
    </div>
  );

  if (!esCompu) {
    return createPortal(
      <div
        role="dialog" aria-modal="true" aria-label={titulo}
        className="animate-fade-in"
        style={{
          position: 'fixed', top: 0, left: 0, right: 0, height: '100dvh', zIndex: capa,
          background: UI.fondo, display: 'flex', flexDirection: 'column', fontFamily: FONT,
        }}
      >
        {cabecera}
        {cuerpo}
        {pieFijo}
      </div>,
      document.body,
    );
  }

  return createPortal(
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: capa, display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 24,
        background: 'rgba(17,19,24,0.45)', fontFamily: FONT,
      }}
    >
      <div
        role="dialog" aria-modal="true" aria-label={titulo}
        className="animate-fade-in"
        style={{
          width: '100%', maxWidth: ancho, maxHeight: 'min(86vh, 900px)',
          background: UI.fondo, borderRadius: 24, boxShadow: KP.shPop,
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        {cabecera}
        {cuerpo}
        {pieFijo}
      </div>
    </div>,
    document.body,
  );
}
