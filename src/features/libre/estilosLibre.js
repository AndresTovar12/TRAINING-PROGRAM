import { LT, FONT, KP, UI } from '@/lib/theme';

/* Los estilos que comparten las pantallas del entreno libre. Desde el 15 oct 2026 (reestructura visual) son los mismos botones
   que `components/ui/Boton`: azul lleno para LA acción y gris claro para la otra. */

export const botonGrande = (apagado = false) => ({
  width: '100%', minHeight: 56, borderRadius: UI.rBoton, border: 'none', cursor: apagado ? 'default' : 'pointer', fontFamily: FONT, fontSize: 17, fontWeight: 700, color: '#fff',
  background: KP.blue, boxShadow: '0 8px 20px rgba(30,64,224,0.22)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 10,
  opacity: apagado ? 0.6 : 1, touchAction: 'manipulation',
});

export const botonBlancoGrande = (apagado = false) => ({
  width: '100%', minHeight: 54, borderRadius: UI.rBoton, border: 'none', cursor: apagado ? 'default' : 'pointer', fontFamily: FONT, fontSize: 16, fontWeight: 700, color: KP.ink,
  background: UI.relleno, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, opacity: apagado ? 0.6 : 1, touchAction: 'manipulation',
});

export const tarjetaBlanca = { background: LT.surface, borderRadius: UI.rGrupo, padding: 16, boxShadow: UI.sombraGrupo };
