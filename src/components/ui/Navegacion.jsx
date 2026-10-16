import { createContext, useContext } from 'react';
import { FONT, KP, UI } from '@/lib/theme';

/* Las piezas para moverse por la app (reestructura visual, 15 oct 2026).
   Teléfono: barra de abajo (blanca para el atleta; azul flotante para el coach) y pestañas subrayadas arriba.
   Computadora: barra lateral azul y, dentro de una pantalla con secciones (Mi perfil), un menú vertical. */

/**
 * Pestañas subrayadas que se deslizan de lado si no caben (Mi perfil en el teléfono: Perfil · Cuenta · Compras…).
 * `pestanas`: [{ id, texto }].
 */
export function Pestanas({ pestanas, activa, onCambio, etiqueta = 'Secciones' }) {
  return (
    <div role="tablist" aria-label={etiqueta} className="sin-barra" style={{ display: 'flex', gap: 22, overflowX: 'auto', borderBottom: `1px solid ${UI.hilo}`, padding: '0 20px', fontFamily: FONT }}>
      {pestanas.map((p) => {
        const puesta = p.id === activa;
        return (
          <button
            key={p.id} type="button" role="tab" aria-selected={puesta} onClick={() => onCambio?.(p.id)}
            ref={puesta ? (el) => el?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }) : undefined}
            style={{
              flex: '0 0 auto', padding: '12px 0 11px', border: 'none', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap',
              fontFamily: FONT, fontSize: 15.5, fontWeight: puesta ? 700 : 600, color: puesta ? KP.blue : KP.ink2,
              boxShadow: puesta ? `inset 0 -3px 0 ${KP.blue}` : 'none', touchAction: 'manipulation',
            }}
          >
            {p.texto}
          </button>
        );
      })}
    </div>
  );
}

/** Lo mismo en computadora: un menú vertical a la izquierda del contenido; la elegida en una pastilla blanca. */
export function PestanasLaterales({ pestanas, activa, onCambio, etiqueta = 'Secciones' }) {
  return (
    <div role="tablist" aria-label={etiqueta} aria-orientation="vertical" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontFamily: FONT }}>
      {pestanas.map((p) => {
        const puesta = p.id === activa;
        return (
          <button
            key={p.id} type="button" role="tab" aria-selected={puesta} onClick={() => onCambio?.(p.id)}
            style={{
              textAlign: 'left', padding: '11px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
              fontFamily: FONT, fontSize: 15.5, fontWeight: puesta ? 700 : 600, color: puesta ? KP.blue : KP.ink2,
              background: puesta ? '#fff' : 'transparent', boxShadow: puesta ? UI.sombraGrupo : 'none',
            }}
          >
            {p.texto}
          </button>
        );
      })}
    </div>
  );
}

/**
 * La barra de abajo del teléfono. `variante`:
 *   'atleta'  blanca, ícono y nombre; la elegida en azul (Home · Entrenar · Mensajes · Explorar).
 *   'coach'   azul y flotante; la elegida en un cuadro blanco (Atletas · Mensajes · Ejercicios · Planes · Vitrina).
 * `secciones`: [{ id, texto, Icono, aviso? }] (`aviso` = el número rojo, p. ej. mensajes sin leer).
 */
export function BarraInferior({ secciones, activa, onCambio, variante = 'atleta' }) {
  const coach = variante === 'coach';
  return (
    <nav
      aria-label="Secciones"
      style={coach ? {
        margin: '0 12px', marginBottom: 'max(10px, env(safe-area-inset-bottom))', padding: 6, borderRadius: 26,
        background: UI.azul, boxShadow: '0 12px 28px rgba(13,26,102,0.35)', display: 'flex', fontFamily: FONT,
      } : {
        background: '#fff', borderTop: `1px solid ${UI.hilo}`, display: 'flex', fontFamily: FONT,
        paddingBottom: 'max(6px, env(safe-area-inset-bottom))', paddingTop: 6,
      }}
    >
      {secciones.map(({ id, texto, Icono, aviso }) => {
        const puesta = id === activa;
        const color = coach ? (puesta ? KP.ink : 'rgba(255,255,255,0.88)') : (puesta ? KP.blue : KP.ink3);
        return (
          <button
            key={id} type="button" onClick={() => onCambio?.(id)} aria-current={puesta ? 'page' : undefined}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: coach ? '9px 2px 8px' : '6px 2px',
              border: 'none', borderRadius: 20, cursor: 'pointer', fontFamily: FONT, color, touchAction: 'manipulation',
              background: coach && puesta ? '#fff' : 'transparent', position: 'relative', minWidth: 0,
            }}
          >
            <span style={{ position: 'relative', display: 'grid' }}>
              <Icono size={22} strokeWidth={puesta ? 2.3 : 1.9} />
              {aviso > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -10, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 99, background: KP.danger, color: '#fff', fontSize: 11, fontWeight: 800, display: 'grid', placeItems: 'center', border: `2px solid ${coach ? '#1733B8' : '#fff'}` }}>
                  {aviso > 99 ? '99+' : aviso}
                </span>
              )}
            </span>
            <span style={{ fontSize: 11.5, fontWeight: puesta ? 700 : 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '100%' }}>{texto}</span>
          </button>
        );
      })}
    </nav>
  );
}

/**
 * La barra lateral azul de la computadora. Arriba la marca (o la persona), en medio las secciones y,
 * abajo, `pie` (el código de coach, «Tu coach · Mariana Ruiz»).
 */
export function BarraLateral({ marca = 'Training Lab', subtitulo, secciones, activa, onCambio, pie, ancho = 248 }) {
  return (
    <nav aria-label="Secciones" style={{ width: ancho, flexShrink: 0, background: UI.azulVertical, color: '#fff', display: 'flex', flexDirection: 'column', padding: '22px 14px 16px', fontFamily: FONT, minHeight: '100%' }}>
      <div style={{ padding: '0 8px 18px' }}>
        {subtitulo && <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.72 }}>{subtitulo}</div>}
        <div style={{ fontSize: 18, fontWeight: 800 }}>{marca}</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {secciones.map(({ id, texto, Icono, aviso }) => {
          const puesta = id === activa;
          return (
            <button
              key={id} type="button" onClick={() => onCambio?.(id)} aria-current={puesta ? 'page' : undefined}
              style={{
                display: 'flex', alignItems: 'center', gap: 11, padding: '11px 12px', borderRadius: 13, border: 'none', cursor: 'pointer',
                fontFamily: FONT, fontSize: 15, fontWeight: puesta ? 700 : 600, textAlign: 'left',
                background: puesta ? '#fff' : 'transparent', color: puesta ? KP.blue : 'rgba(255,255,255,0.88)',
              }}
            >
              {Icono && <Icono size={19} strokeWidth={2} />}
              <span style={{ flex: 1 }}>{texto}</span>
              {aviso > 0 && <span style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 99, background: KP.danger, color: '#fff', fontSize: 11.5, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{aviso}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ flex: 1 }} />
      {pie && <div style={{ background: 'rgba(255,255,255,0.12)', borderRadius: 16, padding: '13px 14px' }}>{pie}</div>}
    </nav>
  );
}

/**
 * La cabecera del coach en el teléfono: banda azul con el saludo y, montada encima, la tarjeta blanca
 * con el nombre de la sección («Mis atletas · 7 atletas · 5 entrenan hoy»).
 */
export function CabeceraConBanda({ saludo, fecha, avatar, titulo, detalle, accion }) {
  return (
    <header style={{ fontFamily: FONT }}>
      <div style={{ background: UI.azul, color: '#fff', padding: 'calc(18px + env(safe-area-inset-top)) 20px 52px', borderRadius: '0 0 28px 28px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            {fecha && <div style={{ fontSize: 12.5, fontWeight: 800, letterSpacing: 1.2, textTransform: 'uppercase', opacity: 0.8 }}>{fecha}</div>}
            <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: -0.4 }}>{saludo}</div>
          </div>
          {avatar}
        </div>
      </div>
      <div style={{ margin: '-38px 14px 0', background: '#fff', borderRadius: 22, padding: '16px 18px', boxShadow: '0 10px 28px rgba(17,19,24,0.08)', display: 'flex', alignItems: 'center', gap: 12 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 800, letterSpacing: -0.5, color: KP.ink }}>{titulo}</h1>
          {detalle && <div style={{ fontSize: 14.5, fontWeight: 500, color: KP.ink2, marginTop: 2 }}>{detalle}</div>}
        </div>
        {accion}
      </div>
    </header>
  );
}

/**
 * Si la pantalla va debajo de una `CabeceraConBanda` (coach en el teléfono), el título ya está en la tarjeta blanca de la banda:
 * cada panel lo lee con `useEnBanda()` y no repite el suyo (sí deja sus botones: «Poner algo en venta», «+ Crear»…).
 */
export const EnBanda = createContext(false);
export const useEnBanda = () => useContext(EnBanda);
