import { LT, FONT } from '@/lib/theme';

/* El botón azul grande de las páginas de la tienda (va aparte de las piezas para que ese archivo solo exporte componentes). */

export const botonAzul = (apagado) => ({
  width: '100%', minHeight: 54, borderRadius: 16, border: 'none', cursor: apagado ? 'default' : 'pointer', fontFamily: FONT, fontSize: 16.5, fontWeight: 800, color: '#fff',
  background: `linear-gradient(135deg, ${LT.blue}, ${LT.blueDk})`, boxShadow: '0 6px 16px rgba(30,64,224,0.28)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
  opacity: apagado ? 0.6 : 1, touchAction: 'manipulation',
});
