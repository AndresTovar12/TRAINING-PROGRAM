import { Dumbbell, Layers, PlayCircle, Repeat } from 'lucide-react';
import { T, FONT, KP, UI } from '@/lib/theme';

/* Estilos de «Mis planes», que también usan Mi vitrina, Monetización, Cuentas de prueba y otros paneles del profesional.
   Reestructura visual (15 oct 2026): las mismas piezas que `components/ui` — campos grises rellenos sin borde, el botón principal
   azul lleno y el secundario blanco con un hilo fino (nada de contornos gruesos ni punteados; Andrés, 28 sep: «no me gusta»). */

export const campo = {
  border: 'none', borderRadius: UI.rCampo, padding: '12px 14px', width: '100%',
  fontFamily: FONT, fontSize: 16, fontWeight: 500, color: T.text, outline: 'none',
  background: UI.relleno, boxSizing: 'border-box',
};

export const botonPrincipal = (deshabilitado) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, padding: '0 18px',
  borderRadius: UI.rCampo, border: 'none', cursor: deshabilitado ? 'default' : 'pointer',
  background: KP.blue, color: '#fff',
  fontFamily: FONT, fontSize: 14.5, fontWeight: 700, boxShadow: deshabilitado ? 'none' : '0 6px 16px rgba(30,64,224,0.22)', opacity: deshabilitado ? 0.5 : 1, flexShrink: 0,
});

// Lo secundario: gris claro lleno (como `Boton tipo="secundario"`); en azul suave lo de «agregar». Sin contorno (16 oct 2026).
export const botonBlanco = (azul = false, deshabilitado = false) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, padding: '0 16px',
  borderRadius: UI.rCampo, border: 'none', background: azul ? KP.blueSoft : UI.relleno, cursor: deshabilitado ? 'default' : 'pointer',
  fontFamily: FONT, fontSize: 14, fontWeight: 700, color: azul ? KP.blue : KP.ink, opacity: deshabilitado ? 0.5 : 1, flexShrink: 0,
});

export const etiquetaChica = {
  fontSize: 13, fontWeight: 700, color: KP.ink2,
};

/** La tarjeta blanca de los paneles (sin borde; la separa del fondo gris una sombra suave). */
export const tarjetaDePanel = { background: UI.tarjeta, borderRadius: UI.rTarjeta, boxShadow: UI.sombraGrupo };

// Cada tipo, con su color: el que se ve en la lista y en los selectores.
export const COLOR_DE_TIPO = { workout: KP.amber, rutina: KP.violet, programa: T.accent, clase: KP.mint };
export const FONDO_DE_TIPO = { workout: KP.amberSoft, rutina: KP.violetSoft, programa: T.accentBg, clase: KP.mintSoft };

// Y su ícono.
export const ICONO_DE_TIPO = { workout: Dumbbell, rutina: Repeat, programa: Layers, clase: PlayCircle };
