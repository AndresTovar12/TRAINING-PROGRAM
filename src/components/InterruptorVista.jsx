import { LayoutGrid, List } from 'lucide-react';
import { T, FONT } from '@/lib/theme';

/**
 * El interruptor de "lista o tarjetas" para el repertorio.
 *
 * Dos botones pegados, con el elegido en relieve. Se entiende sin leer nada:
 * un icono son renglones y el otro son cuadros, que es justo lo que hacen.
 *
 * Va con `aria-pressed` y no con `role="radiogroup"`: son dos maneras de ver
 * lo mismo, no dos datos distintos, y un lector de pantalla lo anuncia mejor
 * como un botón encendido o apagado.
 */
export default function InterruptorVista({ vista, onCambio, estilo }) {
  const boton = (valor, Icono, titulo) => {
    const puesto = vista === valor;
    return (
      <button
        type="button"
        /* Igual que en ListaDesplegable: cancelar la acción por defecto evita
           que un `<label>` alrededor reenvíe el clic a otro botón. */
        onClick={(e) => { e.preventDefault(); onCambio(valor); }}
        aria-pressed={puesto}
        aria-label={titulo}
        title={titulo}
        style={{
          display: 'grid', placeItems: 'center', width: 38, minHeight: 34,
          border: 'none', borderRadius: 9, cursor: 'pointer', padding: 0,
          background: puesto ? T.bg2 : 'transparent',
          boxShadow: puesto ? '0 1px 3px rgba(17,19,24,0.14)' : 'none',
          color: puesto ? T.accent : T.text3,
          fontFamily: FONT, touchAction: 'manipulation',
          transition: 'background .15s, color .15s',
        }}
      >
        <Icono size={17} />
      </button>
    );
  };

  return (
    <div
      style={{
        display: 'inline-flex', gap: 2, padding: 3, borderRadius: 12,
        background: T.bgInteract, border: `1px solid ${T.border}`,
        flexShrink: 0, ...estilo,
      }}
    >
      {boton('lista', List, 'Ver como lista')}
      {boton('tarjetas', LayoutGrid, 'Ver como tarjetas')}
    </div>
  );
}
