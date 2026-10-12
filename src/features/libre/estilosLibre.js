import { LT, FONT } from '@/lib/theme';

/* Los estilos que comparten las pantallas del entreno libre. */

export const botonGrande = (apagado = false) => ({
  width: '100%', minHeight: 58, borderRadius: 18, border: 'none', cursor: apagado ? 'default' : 'pointer', fontFamily: FONT, fontSize: 17, fontWeight: 800, color: '#fff',
  background: `linear-gradient(135deg, ${LT.blue}, ${LT.blueDk})`, boxShadow: '0 6px 16px rgba(30,64,224,0.28)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  opacity: apagado ? 0.6 : 1, touchAction: 'manipulation',
});

export const botonBlancoGrande = (apagado = false) => ({
  width: '100%', minHeight: 54, borderRadius: 16, border: `1.5px solid ${LT.blue}`, cursor: apagado ? 'default' : 'pointer', fontFamily: FONT, fontSize: 16, fontWeight: 800, color: LT.blue,
  background: LT.surface, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, opacity: apagado ? 0.6 : 1, touchAction: 'manipulation',
});

export const tarjetaBlanca = { background: LT.surface, borderRadius: 20, padding: 16, boxShadow: '0 1px 4px rgba(17,19,24,0.06)' };
