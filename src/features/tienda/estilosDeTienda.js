import { FONT, KP } from '@/lib/theme';

/* El botón azul grande de las páginas de la tienda (va aparte de las piezas para que ese archivo solo exporte componentes).
   Reestructura visual (15 oct 2026): el principal de `components/ui/Boton` (azul lleno). */

export const botonAzul = (apagado) => ({
  width: '100%', minHeight: 56, borderRadius: 16, border: 'none', cursor: apagado ? 'default' : 'pointer', fontFamily: FONT, fontSize: 17, fontWeight: 700, color: '#fff',
  background: KP.blue, boxShadow: '0 8px 20px rgba(30,64,224,0.22)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
  opacity: apagado ? 0.55 : 1, touchAction: 'manipulation',
});
