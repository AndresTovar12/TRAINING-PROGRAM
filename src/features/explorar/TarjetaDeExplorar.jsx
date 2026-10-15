import { FONT, KP } from '@/lib/theme';
import Boton from '@/components/ui/Boton';

/* La tarjeta que lleva a Explorar (12 oct 2026; forma nueva el 15 oct, reestructura visual): «Encuentra un plan hecho por un coach» y «Ver planes».
   Va en Home de quien no tiene plan ni entrenador, y se repite como aviso al cerrar su activity card (una vez por visita). Toda la tarjeta lleva a Explorar. */
export default function TarjetaDeExplorar({ alTocar }) {
  return (
    <div
      role="button" tabIndex={0} onClick={alTocar} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); alTocar(); } }}
      className="kp-press"
      style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', boxSizing: 'border-box', cursor: 'pointer', fontFamily: FONT, background: '#fff', borderRadius: 24, padding: '16px 16px 16px 18px', boxShadow: '0 1px 3px rgba(17,19,24,0.06)' }}
    >
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 13.5, fontWeight: 700, color: KP.blue }}>Explorar</span>
        <span style={{ display: 'block', fontSize: 18, fontWeight: 800, color: KP.ink, lineHeight: 1.22, marginTop: 2 }}>Encuentra un plan hecho por un coach</span>
      </span>
      <Boton chico onClick={(e) => { e.stopPropagation(); alTocar(); }}>Ver planes</Boton>
    </div>
  );
}
