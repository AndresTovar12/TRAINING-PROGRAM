import { createPortal } from 'react-dom';
import { FolderInput, Trash2 } from 'lucide-react';
import { T, KP } from '@/lib/theme';
import { botonBlanco, botonPrincipal } from '@/features/misplanes/estilos';

/**
 * La barra que sale abajo cuando hay cosas marcadas con «Seleccionar»: «Mover a…» y «Eliminar». Flota sobre
 * la pantalla (capa 2600: arriba de la lista, debajo de las ventanas) y queda centrada en compu y en celular.
 */
export default function BarraDeSeleccion({ onMover, onEliminar }) {
  return createPortal(
    <div
      style={{
        position: 'fixed', left: 0, right: 0, bottom: 'calc(16px + env(safe-area-inset-bottom))', zIndex: 2600,
        display: 'flex', justifyContent: 'center', padding: '0 12px', pointerEvents: 'none',
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          pointerEvents: 'auto', display: 'flex', gap: 8, width: 'min(460px, 100%)', background: T.bg2,
          border: `1px solid ${T.border}`, borderRadius: 18, padding: 8, boxShadow: KP.shPop,
        }}
      >
        <button type="button" onClick={onMover} style={{ ...botonPrincipal(false), flex: 1 }}>
          <FolderInput size={17} /> Mover a…
        </button>
        <button
          type="button" onClick={onEliminar}
          style={{ ...botonBlanco(), flex: 1, color: T.danger, borderColor: 'rgba(220,38,38,0.4)' }}
        >
          <Trash2 size={16} /> Eliminar
        </button>
      </div>
    </div>,
    document.body,
  );
}
