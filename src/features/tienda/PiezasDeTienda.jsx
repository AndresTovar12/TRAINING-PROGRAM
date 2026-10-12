import { ArrowLeft, Dumbbell } from 'lucide-react';
import { LT, FONT } from '@/lib/theme';
import { botonAzul } from './estilosDeTienda';

/* Las piezas que comparten las páginas de la tienda (la del coach, la del plan y la de «Listo» después de pagar): el marco con la barra de arriba, el aviso de una sola cosa
   y el botón azul grande. Viven aparte para que ninguna página importe a otra. */

export function Marco({ children, alVolver }) {
  return (
    <div style={{ minHeight: '100svh', background: LT.bg, fontFamily: FONT, color: LT.text }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: 'calc(14px + env(safe-area-inset-top)) 16px calc(28px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 40, marginBottom: 14 }}>
          {alVolver && (
            <button
              type="button" onClick={alVolver} aria-label="Volver"
              style={{ width: 40, height: 40, borderRadius: 13, border: 'none', background: LT.surface, color: LT.text, display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 1px 3px rgba(17,19,24,0.08)' }}
            >
              <ArrowLeft size={20} />
            </button>
          )}
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: LT.text, fontWeight: 800, fontSize: 15 }}>
            <span style={{ width: 28, height: 28, borderRadius: 9, background: LT.blue, color: '#fff', display: 'grid', placeItems: 'center' }}><Dumbbell size={16} /></span>
            Training Lab
          </a>
        </div>
        {children}
      </div>
    </div>
  );
}

export const Aviso = ({ titulo, texto, boton, alTocar }) => (
  <Marco>
    <div style={{ background: LT.surface, borderRadius: 20, padding: '36px 22px', textAlign: 'center', boxShadow: '0 1px 4px rgba(17,19,24,0.06)' }}>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{titulo}</div>
      {texto && <div style={{ fontSize: 15, fontWeight: 600, color: LT.text2, lineHeight: 1.5, margin: '8px auto 0', maxWidth: 360 }}>{texto}</div>}
      {boton && (
        <button type="button" onClick={alTocar} style={{ ...botonAzul(false), marginTop: 20, width: 'auto', padding: '0 24px' }}>{boton}</button>
      )}
    </div>
  </Marco>
);
