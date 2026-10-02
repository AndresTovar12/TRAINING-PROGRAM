import { FolderInput, FolderOpen, FolderPlus, Plus } from 'lucide-react';
import { usePalabras } from '@/contexts/PalabrasContext';
import { botonBlanco, botonPrincipal } from '@/features/misplanes/estilos';
import { T } from '@/lib/theme';

const icono = (
  <span style={{ width: 56, height: 56, borderRadius: 18, background: T.accentBg, color: T.accent, display: 'inline-grid', placeItems: 'center' }}>
    <FolderOpen size={26} />
  </span>
);

/** La primera vez: todavía no hay nada guardado, ni cosas ni carpetas. */
export function VacioDeMisPlanes({ onCrear }) {
  const { t } = usePalabras();
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px 32px' }}>
      {icono}
      <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginTop: 14 }}>Aquí vivirá todo lo que guardes</div>
      <div style={{ fontSize: 14, fontWeight: 600, color: T.text2, lineHeight: 1.5, margin: '6px auto 0', maxWidth: 360 }}>
        {t('Crea un workout, una rutina o un programa, o guarda el plan de un atleta desde su ficha.')}
      </div>
      <button type="button" onClick={onCrear} style={{ ...botonPrincipal(false), marginTop: 18 }}>
        <Plus size={17} /> Crear
      </button>
    </div>
  );
}

/**
 * Una carpeta sin nada adentro: los tres caminos salen como botones grandes (Andrés, 2 oct 2026: que al entrar a
 * una carpeta haya cómo agregar lo que existe y lo que no, y que se note que también caben carpetas adentro).
 * `onTraer` / `onSubcarpeta` no vienen cuando no tienen sentido (nada que traer; ya no caben más niveles).
 */
export function VacioDeCarpeta({ onCrear, onTraer, onSubcarpeta }) {
  return (
    <div style={{ textAlign: 'center', padding: '34px 20px 28px' }}>
      {icono}
      <div style={{ fontSize: 17, fontWeight: 800, color: T.text, margin: '14px 0 18px' }}>Esta carpeta está vacía</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 320, margin: '0 auto' }}>
        <button type="button" onClick={onCrear} style={botonPrincipal(false)}>
          <Plus size={17} /> Crear algo nuevo
        </button>
        {onTraer && (
          <button type="button" onClick={onTraer} style={botonBlanco(true)}>
            <FolderInput size={17} /> Traer algo que ya tengo
          </button>
        )}
        {onSubcarpeta && (
          <button type="button" onClick={onSubcarpeta} style={botonBlanco(true)}>
            <FolderPlus size={17} /> Nueva subcarpeta
          </button>
        )}
      </div>
    </div>
  );
}
