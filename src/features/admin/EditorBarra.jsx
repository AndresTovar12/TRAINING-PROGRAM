import { useLayoutEffect, useRef, useState } from 'react';
import { ArrowLeft, X, PanelLeftClose, PanelLeft, Save, Ellipsis, ChevronDown, Undo2, Redo2 } from 'lucide-react';
import { T, FONT } from '@/lib/theme';

/**
 * La barra de arriba del editor en la compu (en el celular el editor trae la suya).
 *
 * Andrés, 5 oct 2026, con la maqueta: la barra se parte como la pantalla.
 *   · Sobre la guía (mide lo mismo que la guía): `←` (volver), el campo «TÍTULO DEL PLAN» y el botón
 *     azul de la guía, pegado al borde de la guía. Con la guía oculta el título se esconde con ella y
 *     el botón azul se recorre junto a la flecha.
 *   · Sobre el día: las opciones de TODO el programa, juntas y desplegadas (la forma con «Cambiar»,
 *     guardar y eliminar) y, a la derecha, lo global: deshacer/rehacer, Guardar y cerrar.
 *
 * Los botones del programa son de VERDAD (con su borde), de un solo tamaño y siempre en el mismo
 * lugar, con la guía oculta o a la vista («no me gustó que cambien de lugar»). Si ni así caben junto al
 * título (una ventana muy angosta) bajan a una segunda fila de esta misma barra, con los mismos
 * botones: nunca se juntan en un «Opciones».
 *
 * El último es «Más ▾» (7 oct 2026): lo que no se usa a cada rato —la foto del plan, la ciencia, eliminar el
 * programa— en un solo menú. Antes era un botón rojo de «Eliminar programa», que ocupaba el sitio de lo más
 * peligroso a la vista de todos.
 */
const cuadrado = {
  width: 36, height: 36, borderRadius: 11, flexShrink: 0, cursor: 'pointer', display: 'grid', placeItems: 'center',
  border: `1px solid ${T.border}`, background: T.bg2, color: T.text, fontFamily: FONT,
};

/**
 * Deshacer y rehacer (↶ ↷), pegados a «Guardar». Sin borde, grises, y apagados cuando no hay nada que deshacer o rehacer.
 * En el celular solo sale ↶, y ↷ cuando hay algo que rehacer (el espacio es poco). Los atajos dicen el de esta computadora.
 */
export function BotonesDeHistorial({ puedeDeshacer, puedeRehacer, onDeshacer, onRehacer, celular = false }) {
  const mac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent || '');
  const boton = (Icono, etiqueta, atajo, activo, onClick) => (
    <button
      type="button" onClick={onClick} disabled={!activo} aria-label={etiqueta} title={`${etiqueta} (${atajo})`}
      style={{
        ...cuadrado, border: '1px solid transparent', background: 'transparent', color: activo ? T.text2 : T.borderHi,
        cursor: activo ? 'pointer' : 'default',
      }}
    >
      <Icono size={18} />
    </button>
  );
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', marginRight: 2 }}>
      {boton(Undo2, 'Deshacer', mac ? '⌘Z' : 'Ctrl+Z', puedeDeshacer, onDeshacer)}
      {(!celular || puedeRehacer) && boton(Redo2, 'Rehacer', mac ? '⇧⌘Z' : 'Ctrl+Y', puedeRehacer, onRehacer)}
    </span>
  );
}

function BotonDelPrograma({ icono: Icono, children, color = T.text2, colorIcono = T.text3, rojo = false, onClick, titulo, refEl }) {
  const [encima, setEncima] = useState(false);
  const c = rojo ? T.danger : color;
  const activo = !!onClick;
  return (
    <button
      ref={refEl} type="button" onClick={onClick} title={titulo} disabled={!activo}
      onMouseEnter={() => setEncima(true)} onMouseLeave={() => setEncima(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 4, flexShrink: 0, whiteSpace: 'nowrap', cursor: activo ? 'pointer' : 'default',
        padding: '5px 6px', borderRadius: 9, fontFamily: FONT, fontSize: 11.5, fontWeight: 700, color: c,
        border: `1px solid ${rojo ? (encima ? 'rgba(220,38,38,0.45)' : 'rgba(220,38,38,0.28)') : (encima && activo ? T.borderHi : T.border)}`,
        background: encima && activo ? (rojo ? 'rgba(220,38,38,0.08)' : (color === T.accent ? T.accentBg : T.bg)) : T.bg2,
      }}
    >
      <Icono size={12} color={rojo ? T.danger : colorIcono} />
      {children}
    </button>
  );
}

/**
 * La barra de arriba del editor en el CELULAR (Andrés, 5 oct 2026, con la maqueta aprobada).
 *
 * La guía y el día son dos pantallas, y la barra dice en cuál estás: en la guía, `✕` (cierra el editor) y nada de
 * título; en un día, `←` (vuelve a la guía) y «Sem N · Fase». A la derecha, lo global (Guardar). Sin el nombre del
 * atleta ni «sin guardar»: el propio botón ya dice si hay algo por guardar.
 */
export function BarraDelCelular({ enDia, titulo, onVolver, onCerrar, derecha }) {
  return (
    <header
      style={{
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'saturate(180%) blur(16px)', borderBottom: `1px solid ${T.border}`,
        padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, fontFamily: FONT,
      }}
    >
      <button
        type="button" onClick={enDia ? onVolver : onCerrar} style={cuadrado}
        aria-label={enDia ? 'Volver a la guía' : 'Cerrar el editor'} title={enDia ? 'Volver a la guía' : 'Cerrar el editor'}
      >
        {enDia ? <ArrowLeft size={17} /> : <X size={17} />}
      </button>
      <div style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {enDia ? titulo : ''}
      </div>
      {derecha}
    </header>
  );
}

export default function EditorBarra({
  titulo, rotuloTitulo = 'Título del plan', onTitulo, anchoGuia, guiaOculta, onAlternarGuia,
  onVolver, onCerrar, programa, derecha,
}) {
  const barra = useRef(null);
  const grupo = useRef(null);
  const der = useRef(null);
  const [dosFilas, setDosFilas] = useState(false);

  /* ¿Caben los botones del programa junto a lo de la derecha? Se mide lo que ocupan los botones (no su caja,
     que en la segunda fila se estira) y se compara con lo que queda: ancho de la barra, menos su relleno,
     menos la zona de la guía y los huecos. */
  useLayoutEffect(() => {
    const medir = () => {
      const b = barra.current; const g = grupo.current; const d = der.current;
      if (!b || !g || !d) return;
      const hijos = [...g.children];
      const grupoAncho = hijos.reduce((a, e) => a + e.getBoundingClientRect().width, 0) + 5 * Math.max(0, hijos.length - 1);
      const resto = [...d.children].filter((e) => e !== g && !e.hasAttribute('data-hueco'))
        .reduce((a, e) => a + e.getBoundingClientRect().width, 0);
      const necesita = grupoAncho + resto + 8 * (d.children.length - 2);
      const disponible = b.clientWidth - 32 - anchoGuia - 16;
      setDosFilas(necesita > disponible + 1);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(barra.current);
    if (document.fonts?.ready) document.fonts.ready.then(medir);
    return () => ro.disconnect();
  });

  const rotulo = {
    fontSize: 10.5, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 3,
    whiteSpace: 'nowrap',
  };

  return (
    <header
      ref={barra}
      style={{
        background: 'rgba(255,255,255,0.92)', backdropFilter: 'saturate(180%) blur(16px)', borderBottom: `1px solid ${T.border}`,
        padding: '8px 16px', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, fontFamily: FONT,
        flexWrap: dosFilas ? 'wrap' : 'nowrap', rowGap: 4,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, width: anchoGuia, flexShrink: 0, minWidth: 0 }}>
        <button type="button" onClick={onVolver} aria-label="Volver" title="Volver" style={cuadrado}>
          <ArrowLeft size={17} />
        </button>
        {!guiaOculta && (
          <label style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
            <span style={rotulo}>{rotuloTitulo}</span>
            <input
              value={titulo} onChange={(e) => onTitulo(e.target.value)} aria-label={rotuloTitulo}
              style={{
                width: '100%', boxSizing: 'border-box', margin: 0, padding: '6px 11px', borderRadius: 11, outline: 'none',
                border: `1px solid ${T.border}`, background: T.bg2, color: T.text, fontFamily: FONT, fontSize: 14, fontWeight: 600,
                textOverflow: 'ellipsis',
              }}
              onFocus={(e) => { e.target.style.borderColor = T.accent; }}
              onBlur={(e) => { e.target.style.borderColor = T.border; }}
            />
          </label>
        )}
        <button
          type="button" onClick={onAlternarGuia} aria-label={guiaOculta ? 'Mostrar la guía' : 'Ocultar la guía'}
          title={`${guiaOculta ? 'Mostrar la guía' : 'Ocultar la guía'} (Ctrl+B)`}
          style={{
            ...cuadrado, border: '1px solid transparent', background: guiaOculta ? T.accentBg : 'transparent', color: T.accent,
          }}
        >
          {guiaOculta ? <PanelLeft size={18} /> : <PanelLeftClose size={18} />}
        </button>
      </div>

      <div
        ref={der}
        style={dosFilas
          ? { display: 'contents' }
          : { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}
      >
        <div
          ref={grupo} role="group" aria-label="Opciones del programa"
          style={{
            display: 'flex', alignItems: 'center', gap: 5, minWidth: 0, flexShrink: 0,
            ...(dosFilas ? { order: 10, flex: '1 1 100%' } : null),
          }}
        >
          <BotonDelPrograma
            icono={programa.forma.icon} onClick={programa.puedeCambiar ? programa.onCambiar : undefined}
            titulo={programa.puedeCambiar ? 'Cambiar la forma del programa' : undefined}
          >
            <span>{programa.forma.corto}</span>
            {programa.puedeCambiar && <b style={{ color: T.accent, fontWeight: 800 }}>Cambiar</b>}
          </BotonDelPrograma>
          {programa.onUsar && (
            <BotonDelPrograma icono={programa.iconoUsar} onClick={programa.onUsar} titulo={programa.tituloUsar}>
              <span>{programa.textoUsar}</span>
            </BotonDelPrograma>
          )}
          {programa.puedeGuardar && (
            <BotonDelPrograma
              icono={Save} color={T.accent} colorIcono={T.accent} onClick={programa.onGuardar}
              titulo="Guarda este plan en Mis planes, para usarlo con otros atletas" refEl={programa.guardarRef}
            >
              <span>{programa.textoGuardar}</span>
            </BotonDelPrograma>
          )}
          {programa.onMas && (
            <BotonDelPrograma
              icono={Ellipsis} onClick={(e) => programa.onMas(e.currentTarget)} titulo="Foto, ciencia y más del programa"
            >
              <span>Más</span>
              <ChevronDown size={12} color={T.text3} />
            </BotonDelPrograma>
          )}
        </div>
        <span data-hueco style={{ flex: dosFilas ? '1 1 0' : 1 }} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>{derecha}</div>
        <button
          type="button" onClick={onCerrar} aria-label="Cerrar el editor" title="Cerrar el editor"
          style={{ ...cuadrado, color: T.text2 }}
        >
          <X size={17} />
        </button>
      </div>
    </header>
  );
}
