import { Check } from 'lucide-react';
import { FONT } from '@/lib/theme';

/**
 * El «✓ Entendido» de los avisos: se acepta y el aviso ya no vuelve a salir.
 *
 * Andrés, 2 oct 2026, sobre los avisos de cambios y de la IA: «están super bien… pero
 * deben tener algún botoncito como un check, de que acepto y que ya no me aparezca; si
 * no, se me acumulan». Va blanco, con borde sólido del color del aviso (ni punteado ni
 * gris), al lado de la acción principal del aviso, que sigue siendo el botón relleno.
 * Quien lo usa decide DÓNDE se guarda lo aceptado (ver `lib/useAvisosVistos.js`).
 */
export default function BotonEntendido({ onClick, color, style }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 13px', borderRadius: 10,
        cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 800, flexShrink: 0,
        border: `1.5px solid ${color}`, background: '#fff', color, touchAction: 'manipulation', ...style,
      }}
    >
      <Check size={15} strokeWidth={3} /> Entendido
    </button>
  );
}
