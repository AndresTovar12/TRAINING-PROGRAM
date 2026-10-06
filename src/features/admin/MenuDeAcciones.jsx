import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { T, FONT, KP } from '@/lib/theme';
import { useIsDesktop } from '@/lib/useViewport';

/**
 * Los menús del editor.
 *
 * Andrés, 5 oct 2026, con la maqueta aprobada: UN botón con nombre abre UN menú, y el menú lleva por título el
 * nombre de lo que toca («Semana 2», «Sesión»). Lo destructivo va hasta abajo, separado y en rojo, con el
 * nombre del objeto («Eliminar semana»).
 *
 *   · En la compu sale PEGADO al botón que lo abrió (`ancla`), con Esc para cerrarlo y las flechas ↑ ↓ para
 *     moverse. Sin `ancla` sale arriba al centro.
 *   · En el celular es una hoja de abajo con «Cancelar»: un dedo necesita 50 px por fila.
 *
 * `MenuEmergente` es la caja (sirve también para el selector de color de la fase); `MenuDeAcciones` la llena con
 * una lista de acciones `{ icon, texto, onClick, peligro }`. Un `null` en la lista es una raya que separa.
 */
export function MenuEmergente({ ancla, titulo, tituloSoloEnCelular = false, onClose, children }) {
  const esCompu = useIsDesktop();
  const caja = useRef(null);

  /* Pegado al botón, antes de pintar: debajo de él y alineado con su lado que queda hacia el borde de la
     ventana; si no cabe abajo, arriba. Se escribe directo en el elemento (no en estado) para que el menú no
     parpadee en una esquina antes de acomodarse. */
  useLayoutEffect(() => {
    const el = caja.current;
    if (!esCompu || !el) return;
    const m = el.getBoundingClientRect();
    const ancho = window.innerWidth;
    const alto = window.innerHeight;
    let left;
    let top;
    if (ancla?.isConnected) {
      const r = ancla.getBoundingClientRect();
      const aLaDerecha = r.left + r.width / 2 > ancho / 2;
      left = aLaDerecha ? r.right - m.width : r.left;
      top = r.bottom + 6;
      if (top + m.height > alto - 8) top = r.top - m.height - 6;
    } else {
      left = (ancho - m.width) / 2;
      top = alto * 0.18;
    }
    el.style.left = `${Math.round(Math.min(Math.max(8, left), ancho - m.width - 8))}px`;
    el.style.top = `${Math.round(Math.max(8, top))}px`;
    el.style.visibility = 'visible';
  });

  /* Cerrar con Esc, o al cambiar el tamaño de la ventana (el botón ya no estaría donde se pegó). Al cerrar sin
     elegir nada el foco vuelve al botón; al elegir algo no, porque lo que se abra después (una pregunta, una
     ventana) se queda con él. */
  const cierra = () => { if (ancla?.isConnected) ancla.focus?.(); onClose(); };
  const cierraRef = useRef(cierra);
  useEffect(() => { cierraRef.current = cierra; });
  useEffect(() => {
    const alTeclear = (e) => { if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); cierraRef.current(); } };
    const alCambiar = () => onClose();
    document.addEventListener('keydown', alTeclear, true);
    window.addEventListener('resize', alCambiar);
    caja.current?.querySelector('[role="menuitem"], [data-enfoque]')?.focus({ preventScroll: true });
    return () => {
      document.removeEventListener('keydown', alTeclear, true);
      window.removeEventListener('resize', alCambiar);
    };
  // Solo al abrir: el foco inicial y los oyentes no deben rehacerse con cada pintada.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alTeclearEnMenu = (e) => {
    const items = [...caja.current.querySelectorAll('[role="menuitem"]')];
    if (!items.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(e.key)) return;
    e.preventDefault();
    const i = items.indexOf(document.activeElement);
    const sig = e.key === 'Home' ? 0
      : e.key === 'End' ? items.length - 1
        : (i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length;
    items[sig].focus();
  };

  const conTitulo = !!titulo && (!esCompu || !tituloSoloEnCelular);

  return (
    <div
      onMouseDown={cierra}
      style={esCompu
        ? { position: 'fixed', inset: 0, zIndex: 2700 }
        : {
          position: 'fixed', inset: 0, zIndex: 2700, background: 'rgba(17,19,24,0.45)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}
    >
      <div
        ref={caja} role="menu" aria-label={titulo} onMouseDown={(e) => e.stopPropagation()} onKeyDown={alTeclearEnMenu}
        className={esCompu ? undefined : 'animate-sheet'}
        style={esCompu
          ? {
            position: 'fixed', top: 0, left: 0, visibility: 'hidden', minWidth: 232, maxWidth: 'calc(100% - 16px)',
            background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, boxShadow: KP.shPop, padding: 6,
            fontFamily: FONT, boxSizing: 'border-box',
          }
          : {
            width: '100%', background: T.bg, borderRadius: '22px 22px 0 0', boxShadow: KP.shPop, fontFamily: FONT,
            padding: '10px 10px calc(14px + env(safe-area-inset-bottom))', boxSizing: 'border-box',
          }}
      >
        {!esCompu && <div style={{ width: 38, height: 4, borderRadius: 999, background: T.borderHi, margin: '4px auto 8px' }} />}
        {conTitulo && (
          <div
            style={esCompu
              ? {
                fontSize: 12.5, fontWeight: 800, color: T.text, padding: '8px 10px 7px', borderBottom: `1px solid ${T.border}`,
                marginBottom: 5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }
              : { fontSize: 14, fontWeight: 800, color: T.text, padding: '4px 14px 10px', textAlign: 'center' }}
          >
            {titulo}
          </div>
        )}
        {children}
        {!esCompu && (
          <button
            type="button" onClick={cierra}
            style={{
              width: '100%', minHeight: 50, marginTop: 8, borderRadius: 14, border: `1.5px solid ${T.border}`,
              background: T.bg2, cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 700, color: T.text2,
            }}
          >
            Cancelar
          </button>
        )}
      </div>
    </div>
  );
}

function ItemDelMenu({ icon: Icono, texto, peligro, onClick, grande }) {
  const [encima, setEncima] = useState(false);
  return (
    <button
      type="button" role="menuitem" onClick={onClick}
      onMouseEnter={() => setEncima(true)} onMouseLeave={() => setEncima(false)}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', textAlign: 'left', border: 'none', cursor: 'pointer',
        fontFamily: FONT, color: peligro ? T.danger : T.text,
        gap: grande ? 13 : 11, padding: grande ? '0 14px' : '9px 10px', minHeight: grande ? 50 : undefined,
        borderRadius: grande ? 14 : 9, fontSize: grande ? 15.5 : 14, fontWeight: grande ? 700 : 600,
        background: encima && !grande ? (peligro ? 'rgba(220,38,38,0.08)' : T.bg) : 'transparent',
      }}
    >
      {Icono && <Icono size={grande ? 19 : 16} color={peligro ? T.danger : T.text3} style={{ flexShrink: 0 }} />}
      {texto}
    </button>
  );
}

export default function MenuDeAcciones({ titulo, acciones, ancla, onClose }) {
  const esCompu = useIsDesktop();
  return (
    <MenuEmergente titulo={titulo} ancla={ancla} onClose={onClose}>
      {acciones.map((a, i) => {
        if (!a) return <i key={`raya-${i}`} style={{ display: 'block', height: 1, background: T.border, margin: esCompu ? '5px 4px' : '6px 8px' }} />;
        // Lo destructivo siempre va separado de lo de arriba.
        const raya = a.peligro && i > 0 && acciones[i - 1];
        return (
          <div key={a.texto}>
            {raya && <i style={{ display: 'block', height: 1, background: T.border, margin: esCompu ? '5px 4px' : '6px 8px' }} />}
            <ItemDelMenu {...a} grande={!esCompu} onClick={() => { onClose(); a.onClick(); }} />
          </div>
        );
      })}
    </MenuEmergente>
  );
}
