import IconoDeTipo from '@/components/IconoDeTipo';
import { KP } from '@/lib/theme';

/** El azul de la marca sobre las pantallas oscuras (el #1E40E0 de siempre casi no se lee sobre negro). */
export const AZUL_SOBRE_OSCURO = '#5B7BFF';

/* El símbolo de una actividad (`lib/actividades.js`), SIN cuadro (6 nov 2026, «Registrar: hoja clara», maquetas aprobadas): solo el dibujo del catálogo de íconos de la app,
   siempre en el azul de la marca (`KP.blue`; sobre fondo oscuro, `AZUL_SOBRE_OSCURO`) con trazo 1.6 en los de línea. El `color` de la actividad ya no se pinta aquí.
   `size`: la caja (las listas no se mueven); el dibujo ocupa `glifo` de ella (74 % por omisión). Sin emojis (Andrés, 23 oct 2026: «no tienen personalidad»). */
export default function IconoDeActividad({ actividad, size = 38, oscuro = false, glifo = 0.74 }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, flexShrink: 0, display: 'grid', placeItems: 'center', color: oscuro ? AZUL_SOBRE_OSCURO : KP.blue }}>
      <IconoDeTipo id={actividad?.icono ?? null} nombre={actividad?.nombre ?? ''} size={Math.round(size * glifo)} strokeWidth={1.6} />
    </span>
  );
}
