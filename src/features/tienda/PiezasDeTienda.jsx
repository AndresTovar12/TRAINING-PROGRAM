import { ChevronLeft, Dumbbell } from 'lucide-react';
import { LT, FONT, UI } from '@/lib/theme';
import { botonAzul } from './estilosDeTienda';

/* Las piezas que comparten las páginas de la tienda (la del coach, la del plan y la de «Listo» después de pagar): el marco con la barra de arriba, el aviso de una sola cosa
   y el botón azul grande. Viven aparte para que ninguna página importe a otra.
   Reestructura visual (15 oct 2026): fondo gris claro, flecha en cuadro gris y `ancho` para que la del coach y la del plan aprovechen la compu. */

export function Marco({ children, alVolver, ancho = 640 }) {
  return (
    <div style={{ minHeight: '100svh', background: UI.fondo, fontFamily: FONT, color: LT.text }}>
      <div style={{ maxWidth: ancho, margin: '0 auto', padding: 'calc(14px + env(safe-area-inset-top)) 16px calc(28px + env(safe-area-inset-bottom))' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minHeight: 42, marginBottom: 16 }}>
          {alVolver && (
            <button
              type="button" onClick={alVolver} aria-label="Volver"
              style={{ width: 42, height: 42, borderRadius: 13, border: 'none', background: UI.relleno, color: LT.text, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
            >
              <ChevronLeft size={21} />
            </button>
          )}
          <a href="/" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, textDecoration: 'none', color: LT.text, fontWeight: 800, fontSize: 16 }}>
            <span style={{ width: 30, height: 30, borderRadius: 10, background: UI.azul, color: '#fff', display: 'grid', placeItems: 'center' }}><Dumbbell size={16} /></span>
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
    <div style={{ background: UI.tarjeta, borderRadius: 22, padding: '36px 22px', textAlign: 'center', boxShadow: '0 2px 10px rgba(17,19,24,0.06)' }}>
      <div style={{ fontSize: 21, fontWeight: 800 }}>{titulo}</div>
      {texto && <div style={{ fontSize: 15.5, fontWeight: 500, color: LT.text2, lineHeight: 1.5, margin: '8px auto 0', maxWidth: 360 }}>{texto}</div>}
      {boton && (
        <button type="button" onClick={alTocar} style={{ ...botonAzul(false), marginTop: 20, width: 'auto', padding: '0 24px' }}>{boton}</button>
      )}
    </div>
  </Marco>
);
