import IconoDeTipo from '@/components/IconoDeTipo';
import { KP } from '@/lib/theme';

/** El azul de la marca sobre las pantallas oscuras (el #1E40E0 de siempre casi no se lee sobre negro). */
export const AZUL_SOBRE_OSCURO = '#5B7BFF';

/* La caja vacía que ocupa el lugar del dibujo mientras baja el catálogo de íconos: del mismo tamaño, sin nada adentro (así no sale una etiqueta que no es y los renglones no se mueven). */
const CajaVacia = ({ size }) => <span aria-hidden="true" style={{ display: 'block', width: size, height: size }} />;

/* El símbolo de una actividad (`lib/actividades.js`), SIN cuadro (6 nov 2026, «Registrar: hoja clara», maquetas aprobadas): solo el dibujo del catálogo de íconos de la app,
   siempre en el azul de la marca (`KP.blue`; sobre fondo oscuro, `AZUL_SOBRE_OSCURO`) con trazo 1.6 en los de línea. El `color` de la actividad ya no se pinta aquí.
   `size`: la caja (las listas no se mueven); el dibujo ocupa `glifo` de ella (74 % por omisión). Sin emojis (Andrés, 23 oct 2026: «no tienen personalidad»).
   Mientras el catálogo baja sale una caja vacía del tamaño del dibujo (`CajaVacia`), no la etiqueta genérica. */
export default function IconoDeActividad({ actividad, size = 38, oscuro = false, glifo = 0.74 }) {
  return (
    <span aria-hidden="true" style={{ width: size, height: size, flexShrink: 0, display: 'grid', placeItems: 'center', color: oscuro ? AZUL_SOBRE_OSCURO : KP.blue }}>
      <IconoDeTipo id={actividad?.icono ?? null} nombre={actividad?.nombre ?? ''} size={Math.round(size * glifo)} strokeWidth={1.6} alternativo={CajaVacia} />
    </span>
  );
}
