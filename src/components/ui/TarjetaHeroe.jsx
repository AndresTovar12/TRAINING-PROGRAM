import { FONT, NUM_STYLE, UI } from '@/lib/theme';

/**
 * La tarjeta azul que resume una pantalla (reestructura visual, 15 oct 2026).
 *
 * En las capturas de Andrés casi cada pantalla abre con una: «Lo que tienes activo · 2 planes»,
 * «Vendido este mes · $13,400», «Esta semana · 3 h 12 min», «Tu coach · Mariana Ruiz». Es lo
 * primero que se lee, así que lleva UN número o nombre grande y nada más.
 *
 *   etiqueta  la línea chica de arriba («Vendido este mes»).
 *   titulo    lo grande.
 *   detalle   una línea de contexto debajo («41 ventas · siguiente depósito: viernes 18»).
 *   progreso  0–1: una barra blanca abajo (avance de la semana, de la fase…).
 *   accion    algo a la derecha, normalmente un botón chico translúcido («Copiar», «Mi equipo»).
 */
export default function TarjetaHeroe({ etiqueta, titulo, detalle, progreso, accion, onClick, estilo, children }) {
  const Caja = onClick ? 'button' : 'div';
  return (
    <Caja
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={onClick ? 'kp-press' : undefined}
      style={{
        display: 'block', width: '100%', textAlign: 'left', border: 'none', cursor: onClick ? 'pointer' : 'default',
        background: UI.azul, color: '#fff', borderRadius: UI.rTarjeta, padding: '18px 20px', boxShadow: UI.azulSombra,
        fontFamily: FONT, position: 'relative', overflow: 'hidden', ...estilo,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {etiqueta && <div style={{ fontSize: 13, fontWeight: 600, opacity: 0.78 }}>{etiqueta}</div>}
          {titulo && <div style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.15, marginTop: etiqueta ? 3 : 0, overflowWrap: 'anywhere', ...NUM_STYLE }}>{titulo}</div>}
          {detalle && <div style={{ fontSize: 13.5, fontWeight: 600, opacity: 0.8, marginTop: 4 }}>{detalle}</div>}
        </div>
        {accion && <div style={{ flexShrink: 0 }}>{accion}</div>}
      </div>
      {typeof progreso === 'number' && (
        <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.22)', marginTop: 14, overflow: 'hidden' }}>
          <div style={{ width: `${Math.max(0, Math.min(1, progreso)) * 100}%`, height: '100%', borderRadius: 99, background: '#fff' }} />
        </div>
      )}
      {children}
    </Caja>
  );
}

/** El botón chico translúcido que va DENTRO de la tarjeta azul («Copiar», «Mi equipo»). */
export function BotonEnAzul({ children, onClick }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onClick?.(e); }}
      className="kp-press"
      style={{
        border: 'none', borderRadius: 12, padding: '9px 14px', background: 'rgba(255,255,255,0.16)', color: '#fff',
        fontFamily: FONT, fontSize: 14, fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)', whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  );
}
