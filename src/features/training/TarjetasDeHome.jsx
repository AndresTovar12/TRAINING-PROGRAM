import { ChevronRight, Sparkles } from 'lucide-react';
import { LT, KP, FONT } from '@/lib/theme';

/**
 * La cinta de «Ciencia» de Home: una línea lavanda (Andrés, 7 oct 2026: «el de ciencia puede ser discreto pero coqueto»; maqueta
 * `docs/maquetas/2026-10-07-home-tarjetas.html`). Es lo que menos se usa: no pide más atención que esa. La estrellita brilla de
 * vez en cuando; con `prefers-reduced-motion`, quieta.
 *
 * Salud y la foto de la fase, que vivían aquí, son desde el 15 oct 2026 cuadros de Home (`home/Cuadros.jsx`, reestructura visual).
 */
const ESTILOS = `
@keyframes tl-brilla{0%,70%,100%{transform:scale(1) rotate(0)}80%{transform:scale(1.18) rotate(8deg)}90%{transform:scale(1) rotate(0)}}
.tl-brilla{animation:tl-brilla 3.6s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.tl-brilla{animation:none}}
`;
const BORDE_LAVANDA = '#E2DAFF';
const LAVANDA_OSCURO = '#5B3FD6';

export function CintaDeCiencia({ onAbrir }) {
  return (
    <button
      type="button" onClick={onAbrir} className="kp-press"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: FONT,
        background: KP.violetSoft, border: 'none', borderRadius: 18, padding: '11px 14px',
      }}
    >
      <style>{ESTILOS}</style>
      <span style={{
        width: 36, height: 36, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0,
        boxShadow: '0 2px 8px rgba(124,92,255,0.18)',
      }}>
        <Sparkles size={18} color={KP.violet} className="tl-brilla" />
      </span>
      <span style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
        <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: LAVANDA_OSCURO, opacity: 0.8 }}>Ciencia</span>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: LT.text }}>El porqué de tu plan</span>
      </span>
      <ChevronRight size={16} color={KP.violet} style={{ flexShrink: 0 }} />
    </button>
  );
}
