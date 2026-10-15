import { FONT, KP, UI } from '@/lib/theme';

/* Piezas que comparten las pestañas de Mi perfil (15 oct 2026). Desde la reestructura visual del mismo día son las de `components/ui`:
   título de grupo en negro, tarjetas blancas sin borde, botones azul lleno o gris claro, pastillas de estado. Lo que se queda aquí es
   el `Aviso` (un recuadro de color con un mensaje) y `pesos`. */

export const titulo = { fontSize: 16, fontWeight: 700, color: KP.ink, margin: '0 4px 8px' };
export const tarjeta = { background: UI.tarjeta, borderRadius: UI.rGrupo, boxShadow: UI.sombraGrupo, padding: '14px 16px' };
export const boton = (azul = false, apagado = false) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 44, padding: '0 16px', borderRadius: 13, cursor: apagado ? 'default' : 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 700,
  border: 'none', background: azul ? KP.blue : UI.relleno, color: azul ? '#fff' : KP.ink, boxShadow: azul ? '0 8px 20px rgba(30,64,224,0.22)' : 'none', opacity: apagado ? 0.5 : 1, touchAction: 'manipulation',
});
export const botonPeligro = (apagado = false) => ({ ...boton(false, apagado), background: KP.dangerSoft, color: KP.danger });

const TONOS = {
  ok: { fondo: KP.mintSoft, color: '#00875F' },
  aviso: { fondo: KP.amberSoft, color: '#B86400' },
  malo: { fondo: KP.dangerSoft, color: KP.danger },
  neutro: { fondo: UI.relleno, color: KP.ink2 },
  azul: { fondo: KP.blueSoft, color: KP.blueDk },
};

export { Pastilla as Chip, Interruptor } from '@/components/ui/Controles';

export function Aviso({ tono = 'azul', children, ...resto }) {
  const t = TONOS[tono] ?? TONOS.azul;
  return <div {...resto} style={{ borderRadius: 14, padding: '12px 14px', fontSize: 14, fontWeight: 600, lineHeight: 1.45, background: t.fondo, color: t.color }}>{children}</div>;
}

export const pesos = (n) => {
  const v = Number(n ?? 0);
  return `$${v.toLocaleString('es-MX', { minimumFractionDigits: Number.isInteger(v) ? 0 : 2, maximumFractionDigits: 2 })}`;
};
