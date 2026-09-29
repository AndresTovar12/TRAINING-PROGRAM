import { useMemo } from 'react';
import { X } from 'lucide-react';
import { renderSVG } from 'uqr';
import { T, FONT, KP } from '@/lib/theme';

/* El QR de la liga de invitación, en grande, para enseñarlo en la consulta y
   que el paciente lo escanee con la cámara de su teléfono.

   Se genera AQUÍ, en el teléfono de quien lo muestra: la liga lleva un token
   secreto y no se manda a ningún servicio de QR externo. El SVG lo produce la
   librería a partir de la liga; no lleva texto de nadie.

   Fondo blanco y un margen de 2 módulos: es lo que pide el lector de QR. */
export default function MostrarQR({ liga, nombre, onCerrar }) {
  const svg = useMemo(() => renderSVG(liga, { ecc: 'M', border: 2 }), [liga]);
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Código QR de la invitación"
      onMouseDown={onCerrar}
      style={{
        position: 'fixed', inset: 0, zIndex: 2800, background: '#fff', fontFamily: FONT,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24, gap: 18,
      }}
    >
      <button
        type="button"
        onClick={onCerrar}
        aria-label="Cerrar"
        style={{ position: 'absolute', top: 16, right: 16, border: 'none', background: 'transparent', cursor: 'pointer', color: T.text2, padding: 8 }}
      >
        <X size={26} />
      </button>
      <div style={{ fontSize: 20, fontWeight: 800, color: T.text, textAlign: 'center', overflowWrap: 'anywhere' }}>{nombre}</div>
      <div
        data-qr
        onMouseDown={(e) => e.stopPropagation()}
        style={{
          width: 'min(78vw, 340px)', height: 'min(78vw, 340px)', background: '#fff', borderRadius: 12,
          border: `1px solid ${T.border}`, padding: 8, boxShadow: KP.shCard, boxSizing: 'content-box',
        }}
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <div style={{ fontSize: 15, fontWeight: 600, color: T.text2, textAlign: 'center' }}>
        Escanéalo con la cámara de tu teléfono
      </div>
      <style>{'[data-qr] svg{display:block;width:100%;height:100%}'}</style>
    </div>
  );
}
