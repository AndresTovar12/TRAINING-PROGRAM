import { ChevronRight, Compass } from 'lucide-react';
import { LT, FONT } from '@/lib/theme';

/* La tarjeta que lleva a Explorar (12 oct 2026): «¿Quieres un plan hecho por un coach?». Va en Home de quien no tiene plan ni entrenador, y se repite como aviso al cerrar su activity card
   (una vez por visita). Las tres formas de llegar a Explorar son esta, ese aviso y la pestaña. */
export default function TarjetaDeExplorar({ alTocar }) {
  return (
    <button
      type="button" onClick={alTocar} className="kp-press"
      style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: FONT, background: LT.surface, border: `1.5px solid ${LT.blueSoft}`, borderRadius: 22, padding: 16 }}
    >
      <span style={{ width: 48, height: 48, borderRadius: '50%', background: LT.blueSoft, color: LT.blue, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Compass size={22} /></span>
      <span style={{ flex: 1, minWidth: 0, fontSize: 16.5, fontWeight: 800, color: LT.text, lineHeight: 1.3 }}>¿Quieres un plan hecho por un coach?</span>
      <ChevronRight size={20} color={LT.blue} />
    </button>
  );
}
