import { ChevronRight } from 'lucide-react';
import { FONT, KP, NUM_STYLE, UI } from '@/lib/theme';

/**
 * La lista agrupada (reestructura visual, 15 oct 2026): la pieza que más se repite en las capturas.
 *
 * Una caja blanca con renglones separados por un hilo. Cada renglón es una `Fila`:
 *   «Usuario ........ @andrestovar ›»   dato con su valor en azul y flecha: tocarlo lo cambia.
 *   «Apple Watch / Conectado · pulso»   nombre con una línea debajo y un interruptor a la derecha.
 *   «Eliminar mi cuenta»                en rojo, para lo peligroso.
 *
 * POR QUÉ. Andrés: donde iba una lista para elegir yo ponía chips o casillas («stickers»). La regla
 * de ahora: si es un DATO con un valor, va como Fila con su valor a la derecha; al tocarla se elige
 * (ver `FilaElegir`). Así cualquier ajuste se lee igual en toda la app: nombre a la izquierda, lo que
 * vale a la derecha.
 *
 * `titulo` del Grupo: en negro y en minúsculas («Seguridad», «Pagos»), ya no la etiqueta gris en
 * mayúsculas. `pie`: una sola línea gris debajo, solo si dice algo que la pantalla no dice ya.
 */
export function Grupo({ titulo, accion, pie, children, estilo }) {
  return (
    <section style={{ fontFamily: FONT, ...estilo }}>
      {(titulo || accion) && (
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10, margin: '0 4px 8px' }}>
          {titulo && <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: KP.ink }}>{titulo}</h3>}
          {accion}
        </div>
      )}
      <div style={{ background: UI.tarjeta, borderRadius: UI.rGrupo, boxShadow: UI.sombraGrupo, overflow: 'hidden' }}>
        {children}
      </div>
      {pie && <p style={{ margin: '8px 6px 0', fontSize: 13, fontWeight: 500, color: KP.ink2, lineHeight: 1.45 }}>{pie}</p>}
    </section>
  );
}

/**
 * Un renglón del Grupo.
 *
 *   texto      el nombre («Correo», «Apple Watch»).
 *   detalle    la línea chica debajo del nombre («Conectado · pulso, ritmo y sueño»).
 *   valor      lo que vale, a la derecha y en azul («andres@correo.com»). `valorTono`: 'azul' | 'ok' | 'neutro'.
 *   izquierda  un ícono o avatar antes del nombre.
 *   derecha    algo propio a la derecha (un `Interruptor`, una pastilla); quita la flecha.
 *   tono       'peligro' pinta el nombre de rojo; 'enlace' lo pinta de azul («Conectar con Claude»).
 *   onClick    la vuelve tocable y le pone la flecha ›.
 *
 * Los hilos entre renglones los pone el CSS de hermanos (`+`): la primera no lleva y no hay que pasarle nada.
 */
export function Fila({ texto, detalle, valor, valorTono = 'azul', izquierda, derecha, tono, onClick, deshabilitada = false, etiquetaAccesible }) {
  const tocable = !!onClick && !deshabilitada;
  const Caja = tocable ? 'button' : 'div';
  const colorTexto = tono === 'peligro' ? KP.danger : tono === 'enlace' ? KP.blue : KP.ink;
  const colorValor = valorTono === 'ok' ? KP.mint : valorTono === 'neutro' ? KP.ink2 : KP.blue;
  return (
    <Caja
      type={tocable ? 'button' : undefined}
      onClick={tocable ? onClick : undefined}
      aria-label={etiquetaAccesible}
      className="ui-fila"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: UI.altoFila, padding: '10px 16px',
        background: 'transparent', border: 'none', textAlign: 'left', fontFamily: FONT, cursor: tocable ? 'pointer' : 'default',
        opacity: deshabilitada ? 0.5 : 1, touchAction: 'manipulation',
      }}
    >
      {izquierda && <span style={{ flexShrink: 0, display: 'grid', placeItems: 'center' }}>{izquierda}</span>}
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{ display: 'block', fontSize: 15.5, fontWeight: 600, color: colorTexto, overflowWrap: 'anywhere' }}>{texto}</span>
        {detalle && <span style={{ display: 'block', fontSize: 13, fontWeight: 500, color: KP.ink2, marginTop: 2, lineHeight: 1.35 }}>{detalle}</span>}
      </span>
      {valor !== undefined && valor !== null && valor !== '' && (
        <span style={{ fontSize: 15.5, fontWeight: 600, color: colorValor, textAlign: 'right', maxWidth: '55%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', ...NUM_STYLE }}>{valor}</span>
      )}
      {derecha ? <span style={{ flexShrink: 0 }}>{derecha}</span> : tocable ? <ChevronRight size={18} color={KP.ink3} style={{ flexShrink: 0 }} /> : null}
    </Caja>
  );
}

/** El cuadrito redondeado de color con una letra o ícono que va a la izquierda de una Fila (Garmin «G», Stripe «S»). */
export function IconoDeFila({ children, color = KP.blue, fondo = KP.blueSoft }) {
  return (
    <span style={{ width: 36, height: 36, borderRadius: 11, background: fondo, color, display: 'grid', placeItems: 'center', fontSize: 15, fontWeight: 800 }}>
      {children}
    </span>
  );
}
