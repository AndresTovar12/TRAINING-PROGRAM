import { T, FONT } from '@/lib/theme';

/**
 * El aspecto del rótulo de un campo cuando el rótulo ES una lista desplegable («REPS ▾», «% 1RM ▾»,
 * «DESCANSO · SEG ▾»): sin caja, del tamaño y el color de los demás rótulos de la fila. En la lista de
 * ejercicios (`compacto`) va un punto más chico, para que la fila no se descuadre.
 */
export const estiloDeRotulo = (compacto) => ({
  width: 'auto', border: 'none', background: 'transparent',
  minHeight: 0, gap: 4, borderRadius: 6,
  padding: compacto ? '0 0 3px' : '0 0 5px',
  // Letra normal, no mayúsculas (reestructura visual, 16 oct 2026).
  fontFamily: FONT, fontSize: compacto ? 12 : 13, fontWeight: 700,
  color: T.accent,
});
