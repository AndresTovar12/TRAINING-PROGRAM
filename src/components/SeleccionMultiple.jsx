import { Check } from 'lucide-react';
import { T, FONT } from '@/lib/theme';

/**
 * Varias opciones a la vista, cada una se prende o se apaga con un toque.
 *
 * Para lo secundario de un ejercicio: las categorías y los grupos musculares
 * que también le tocan. Andrés, 28 sep 2026: un "jumping lunge" es
 * principalmente Potencia, pero también Pliometría. Son pastillas y no una
 * lista desplegable porque se eligen varias y conviene verlas todas de una
 * vez, sin abrir nada.
 *
 * `opciones`: [{ valor, etiqueta, color? }]. `elegidas`: los valores prendidos.
 */
export default function SeleccionMultiple({ opciones, elegidas = [], onCambio, vacio }) {
  if (!opciones.length) {
    return vacio ? <div style={{ fontSize: 12.5, color: T.text3, fontWeight: 600 }}>{vacio}</div> : null;
  }
  const prendidas = new Set(elegidas);
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
      {opciones.map((o) => {
        const si = prendidas.has(o.valor);
        return (
          <button
            key={o.valor}
            type="button"
            aria-pressed={si}
            onClick={() => onCambio(si ? elegidas.filter((v) => v !== o.valor) : [...elegidas, o.valor])}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 12px',
              borderRadius: 999, cursor: 'pointer', touchAction: 'manipulation',
              border: `1.5px solid ${si ? T.accent : T.border}`,
              background: si ? T.accentBg : T.bg2, color: si ? T.accent : T.text2,
              fontFamily: FONT, fontSize: 13.5, fontWeight: si ? 800 : 600,
            }}
          >
            {si
              ? <Check size={14} strokeWidth={2.8} style={{ flexShrink: 0 }} />
              : o.color && <span style={{ width: 9, height: 9, borderRadius: 5, background: o.color, flexShrink: 0 }} />}
            {o.etiqueta}
          </button>
        );
      })}
    </div>
  );
}
