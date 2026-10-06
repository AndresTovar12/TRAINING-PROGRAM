import { Save, Trash2 } from 'lucide-react';
import { T, FONT } from '@/lib/theme';

/**
 * Lo del programa entero, arriba de la guía en el CELULAR (en la compu esto vive en la barra de arriba: ver
 * `EditorBarra`). Andrés, 5 oct 2026, con la maqueta aprobada: «así estaba y está bien».
 *
 *   «TÍTULO DEL PLAN» + su casilla · «Programa por fases · Cambiar» · «Guardar plan» y «Eliminar programa»
 *
 * Los dos botones son de texto, sin caja: con el dedo no hace falta marcarlos, y el rojo de «Eliminar» sale al
 * tocarlo. Lo recibe de `PlanBuilder` ya resuelto en `programa` (la misma forma que usa la barra de la compu).
 */
const ESTILOS = `
.tl-quieto:hover{background:${T.bg3}}
.tl-quieto.tl-azul:hover{background:${T.accentBg}}
.tl-quieto.tl-rojo:hover{background:rgba(220,38,38,0.08);color:${T.danger}}
`;

function BotonDeTexto({ icono: Icono, children, onClick, clase = '', color = T.text2 }) {
  return (
    <button
      type="button" onClick={onClick} className={`tl-quieto ${clase}`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0, cursor: 'pointer', border: 'none',
        background: 'transparent', color, fontFamily: FONT, fontSize: 12.5, fontWeight: 700, padding: '6px 9px',
        borderRadius: 999, minWidth: 0, touchAction: 'manipulation',
      }}
    >
      <Icono size={14} />
      {children}
    </button>
  );
}

export default function BloqueDelPrograma({ titulo, rotuloTitulo, onTitulo, programa }) {
  const Forma = programa.forma.icon;
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6, fontFamily: FONT }}>
      <style>{ESTILOS}</style>
      <label style={{ display: 'block' }}>
        <span style={{
          display: 'block', fontSize: 10.5, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6,
          marginBottom: 4, whiteSpace: 'nowrap',
        }}>
          {rotuloTitulo}
        </span>
        <input
          value={titulo} onChange={(e) => onTitulo(e.target.value)} aria-label={rotuloTitulo}
          style={{
            border: `1.5px solid ${T.border}`, borderRadius: 11, padding: '10px 12px', width: '100%', boxSizing: 'border-box',
            fontFamily: FONT, fontSize: 15, fontWeight: 800, color: T.text, outline: 'none', background: T.bg2,
          }}
          onFocus={(e) => { e.target.style.borderColor = T.accent; }}
          onBlur={(e) => { e.target.style.borderColor = T.border; }}
        />
      </label>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, fontSize: 13, fontWeight: 700, color: T.text2, padding: '4px 2px 0' }}>
        <Forma size={14} color={T.accent} />
        <span>{programa.forma.corto}</span>
        {programa.puedeCambiar && (
          <button
            type="button" onClick={programa.onCambiar}
            style={{
              border: 'none', background: 'transparent', color: T.accent, fontFamily: FONT, fontWeight: 800, fontSize: 13,
              padding: '4px 7px', borderRadius: 8, cursor: 'pointer',
            }}
          >
            Cambiar
          </button>
        )}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0 2px', marginLeft: -6 }}>
        {programa.onUsar && (
          <BotonDeTexto icono={programa.iconoUsar} onClick={programa.onUsar}>{programa.textoUsar}</BotonDeTexto>
        )}
        {programa.puedeGuardar && (
          <BotonDeTexto icono={Save} clase="tl-azul" color={T.accent} onClick={programa.onGuardar}>{programa.textoGuardar}</BotonDeTexto>
        )}
        {programa.onEliminar && (
          <BotonDeTexto icono={Trash2} clase="tl-rojo" onClick={programa.onEliminar}>{programa.textoEliminar}</BotonDeTexto>
        )}
      </div>
    </div>
  );
}
