import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Plus, X } from 'lucide-react';
import { useIsDesktop } from '@/lib/useViewport';
import { FONT, KP, UI } from '@/lib/theme';
import Boton from '@/components/ui/Boton';
import { Fila } from '@/components/ui/Grupo';

/**
 * Escoger de una lista (reestructura visual, 15 oct 2026): «Categoría → Fuerza ✓ / Velocidad / Core…».
 *
 * En el teléfono sube desde abajo, donde está el dedo; en la computadora sale al centro (Andrés, 24 sep:
 * en computadora la hoja pegada abajo «está como que saliendo de la parte de abajo»).
 *
 * UNA opción (`multiple` falso): tocarla la elige y cierra. Las capturas traen un «Listo» también aquí,
 * pero sería un toque que no decide nada (regla «clics con criterio», 7 oct): ya contestó al tocar.
 * VARIAS (`multiple`): cada toque marca o desmarca y «Listo» cierra; ahí sí hace falta.
 *
 * `opciones`: [{ valor, texto, detalle? }]. `acciones`: filas azules con «+» al final
 * («Agregar categoría»): no se eligen, se ejecutan.
 */
export default function HojaDeOpciones({ abierta, titulo, opciones = [], valor, multiple = false, onCambio, onCerrar, acciones = [] }) {
  const compu = useIsDesktop();
  const caja = useRef(null);
  const elegidos = multiple ? (Array.isArray(valor) ? valor : []) : [valor];
  // Quien la abre suele pasar `onCerrar` nuevo en cada dibujo; si el efecto dependiera de él, cada
  // marca (con `multiple`) lo reiniciaría y el foco saltaría al primero.
  const cerrar = useRef(onCerrar);
  useEffect(() => { cerrar.current = onCerrar; });

  useEffect(() => {
    if (!abierta) return undefined;
    const tecla = (e) => { if (e.key === 'Escape') cerrar.current?.(); };
    document.addEventListener('keydown', tecla);
    const antes = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // El foco entra a la hoja (al elegido, o al primero): con teclado o lector de pantalla se sigue ahí.
    requestAnimationFrame(() => (caja.current?.querySelector('[aria-checked="true"]') ?? caja.current?.querySelector('button'))?.focus());
    return () => { document.removeEventListener('keydown', tecla); document.body.style.overflow = antes; };
  }, [abierta]);

  if (!abierta) return null;

  const toca = (v) => {
    if (!multiple) { onCambio?.(v); onCerrar?.(); return; }
    onCambio?.(elegidos.includes(v) ? elegidos.filter((x) => x !== v) : [...elegidos, v]);
  };

  return createPortal(
    <div
      onMouseDown={onCerrar}
      style={{ position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(17,19,24,0.42)', display: 'flex', alignItems: compu ? 'center' : 'flex-end', justifyContent: 'center', padding: compu ? 24 : 0, fontFamily: FONT }}
    >
      <div
        ref={caja}
        role="dialog" aria-modal="true" aria-label={titulo}
        onMouseDown={(e) => e.stopPropagation()}
        className={compu ? 'animate-fade-in' : 'animate-sheet'}
        style={{
          width: '100%', maxWidth: compu ? 440 : undefined, maxHeight: compu ? '80vh' : '86svh', display: 'flex', flexDirection: 'column',
          background: UI.fondo, borderRadius: compu ? 22 : '24px 24px 0 0', boxShadow: KP.shPop,
          paddingBottom: compu ? 16 : 'max(16px, env(safe-area-inset-bottom))',
        }}
      >
        {!compu && <div aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 99, background: '#D4D7DE', margin: '8px auto 0' }} />}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 20px 10px' }}>
          <h2 style={{ margin: 0, fontSize: 21, fontWeight: 800, color: KP.ink }}>{titulo}</h2>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" style={{ width: 34, height: 34, borderRadius: 11, border: 'none', background: UI.relleno, display: 'grid', placeItems: 'center', cursor: 'pointer', color: KP.ink2 }}>
            <X size={18} />
          </button>
        </div>
        <div role={multiple ? 'group' : 'radiogroup'} aria-label={titulo} style={{ overflowY: 'auto', padding: '4px 16px 0' }}>
          <div style={{ background: UI.tarjeta, borderRadius: UI.rGrupo, overflow: 'hidden' }}>
            {opciones.map((o) => {
              const puesto = elegidos.includes(o.valor);
              return (
                <button
                  key={String(o.valor)} type="button" role={multiple ? 'checkbox' : 'radio'} aria-checked={puesto} onClick={() => toca(o.valor)}
                  className="ui-fila"
                  style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: UI.altoFila, padding: '10px 16px', border: 'none', background: 'transparent', textAlign: 'left', fontFamily: FONT, cursor: 'pointer' }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 16, fontWeight: puesto ? 700 : 500, color: KP.ink }}>{o.texto}</span>
                    {o.detalle && <span style={{ display: 'block', fontSize: 13, color: KP.ink2, marginTop: 2 }}>{o.detalle}</span>}
                  </span>
                  <Marca puesta={puesto} cuadrada={multiple} />
                </button>
              );
            })}
            {acciones.map((a) => (
              <Fila key={a.texto} texto={<span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plus size={17} strokeWidth={2.4} />{a.texto}</span>} tono="enlace" onClick={() => { onCerrar?.(); a.onClick?.(); }} derecha={<span />} />
            ))}
          </div>
        </div>
        {multiple && (
          <div style={{ padding: '14px 16px 0' }}>
            <Boton ancho onClick={onCerrar}>Listo</Boton>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

/** El círculo (o cuadro, si son varias) que se llena de azul con la palomita. */
function Marca({ puesta, cuadrada }) {
  return (
    <span aria-hidden="true" style={{
      width: 26, height: 26, borderRadius: cuadrada ? 8 : '50%', flexShrink: 0, display: 'grid', placeItems: 'center',
      background: puesta ? KP.blue : 'transparent', border: puesta ? 'none' : '2px solid #CDD1D9', color: '#fff',
    }}
    >
      {puesta && <Check size={16} strokeWidth={3} />}
    </span>
  );
}

/**
 * Una Fila que, al tocarla, abre la HojaDeOpciones: «Categoría ........ Fuerza ›».
 * Es el reemplazo de los chips/casillas para escoger un dato de una lista (la queja de Andrés).
 * Con `multiple`, el valor que se ve es la lista unida («Football, Atletismo»).
 */
export function FilaElegir({ texto, titulo, opciones, valor, multiple = false, onCambio, marcador = 'Elegir', acciones, izquierda, detalle }) {
  const [abierta, setAbierta] = useState(false);
  const nombres = (multiple ? (Array.isArray(valor) ? valor : []) : [valor])
    .map((v) => opciones.find((o) => o.valor === v)?.texto)
    .filter(Boolean);
  return (
    <>
      <Fila
        texto={texto} detalle={detalle} izquierda={izquierda}
        valor={nombres.length ? nombres.join(', ') : marcador} valorTono={nombres.length ? 'azul' : 'neutro'}
        onClick={() => setAbierta(true)}
      />
      <HojaDeOpciones
        abierta={abierta} titulo={titulo ?? texto} opciones={opciones} valor={valor} multiple={multiple}
        onCambio={onCambio} onCerrar={() => setAbierta(false)} acciones={acciones}
      />
    </>
  );
}
