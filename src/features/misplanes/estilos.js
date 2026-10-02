import { Dumbbell, Layers, Repeat } from 'lucide-react';
import { T, FONT, KP } from '@/lib/theme';

/* Estilos de «Mis planes». Mismas medidas y colores que el editor de planes, para que no se
   sienta otra app: campos de 11 px de radio, botones con degradado azul, nada de contornos
   punteados (Andrés, 28 sep 2026: «haces mucho ese estilo de botones, no me gusta»). */

export const campo = {
  border: `1.5px solid ${T.border}`, borderRadius: 11, padding: '10px 12px', width: '100%',
  fontFamily: FONT, fontSize: 14, fontWeight: 500, color: T.text, outline: 'none',
  background: T.bg2, boxSizing: 'border-box',
};

export const botonPrincipal = (deshabilitado) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 42, padding: '0 18px',
  borderRadius: 11, border: 'none', cursor: deshabilitado ? 'default' : 'pointer',
  background: `linear-gradient(135deg, ${T.accent}, ${T.accentDk})`, color: '#fff',
  fontFamily: FONT, fontSize: 14, fontWeight: 800, boxShadow: KP.shBtn, opacity: deshabilitado ? 0.5 : 1, flexShrink: 0,
});

// Blanco con borde sólido: lo secundario, y lo de «agregar» (azul).
export const botonBlanco = (azul = false, deshabilitado = false) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 42, padding: '0 16px',
  borderRadius: 11, border: `1.5px solid ${azul ? T.accent : T.border}`, background: T.bg2, cursor: deshabilitado ? 'default' : 'pointer',
  fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: azul ? T.accent : T.text2, opacity: deshabilitado ? 0.5 : 1, flexShrink: 0,
});

export const etiquetaChica = {
  fontSize: 11, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6,
};

// Cada tipo, con su color: el que se ve en la lista y en los selectores.
export const COLOR_DE_TIPO = { workout: KP.amber, rutina: KP.violet, programa: T.accent };
export const FONDO_DE_TIPO = { workout: KP.amberSoft, rutina: KP.violetSoft, programa: T.accentBg };

// Y su ícono.
export const ICONO_DE_TIPO = { workout: Dumbbell, rutina: Repeat, programa: Layers };
