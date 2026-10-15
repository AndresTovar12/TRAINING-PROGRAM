import { T, FONT, KP } from '@/lib/theme';

/* Piezas que comparten las pestañas de Mi perfil: Compras, Cobros, Dispositivos y Avisos (15 oct 2026). Mismos colores y medidas que `ConfiguracionDeCuenta`. */

export const titulo = { fontSize: 11, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 };
export const tarjeta = { background: T.bg2, border: `1.5px solid ${T.border}`, borderRadius: 16, padding: '14px 15px' };
export const boton = (azul = false, apagado = false) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 42, padding: '0 16px', borderRadius: 12, cursor: apagado ? 'default' : 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 800,
  border: azul ? 'none' : `1.5px solid ${KP.lineHi}`, background: azul ? `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})` : T.bg2, color: azul ? '#fff' : T.text, boxShadow: azul ? KP.shBtn : 'none', opacity: apagado ? 0.55 : 1, touchAction: 'manipulation',
});
export const botonPeligro = (apagado = false) => ({ ...boton(false, apagado), border: `1.5px solid ${KP.danger}`, color: KP.danger, background: 'rgba(220,38,38,0.05)' });

const TONOS = {
  ok: { fondo: 'rgba(16,185,129,0.12)', color: KP.mint },
  aviso: { fondo: KP.amberSoft ?? 'rgba(245,158,11,0.14)', color: KP.amber ?? T.warning },
  malo: { fondo: KP.dangerSoft, color: KP.danger },
  neutro: { fondo: T.bg3, color: T.text2 },
  azul: { fondo: KP.blueSoft, color: KP.blueDk },
};

export function Chip({ tono = 'neutro', children }) {
  const t = TONOS[tono] ?? TONOS.neutro;
  return <span style={{ display: 'inline-flex', alignItems: 'center', padding: '3px 9px', borderRadius: 999, fontSize: 12, fontWeight: 800, background: t.fondo, color: t.color, whiteSpace: 'nowrap' }}>{children}</span>;
}

export function Aviso({ tono = 'azul', children, ...resto }) {
  const t = TONOS[tono] ?? TONOS.azul;
  return <div {...resto} style={{ borderRadius: 12, padding: '11px 13px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.45, background: t.fondo, color: t.color }}>{children}</div>;
}

/** Un interruptor de encendido/apagado accesible. */
export function Interruptor({ activo, onCambio, etiqueta, apagado = false }) {
  return (
    <button
      type="button" role="switch" aria-checked={activo} aria-label={etiqueta} disabled={apagado} onClick={() => onCambio(!activo)}
      style={{
        width: 50, height: 30, borderRadius: 999, border: 'none', padding: 3, cursor: apagado ? 'default' : 'pointer', flexShrink: 0, opacity: apagado ? 0.5 : 1,
        background: activo ? KP.blue : T.border, display: 'flex', justifyContent: activo ? 'flex-end' : 'flex-start', transition: 'background .15s', touchAction: 'manipulation',
      }}
    >
      <span style={{ width: 24, height: 24, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
    </button>
  );
}

export const pesos = (n) => {
  const v = Number(n ?? 0);
  return `$${v.toLocaleString('es-MX', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`;
};
