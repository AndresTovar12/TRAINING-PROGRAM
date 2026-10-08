import { Check } from 'lucide-react';
import { DISCIPLINAS } from '@/lib/oficios';
import { T, FONT } from '@/lib/theme';

/**
 * Qué entrena el coach, como pastillas que se prenden y apagan (en el inicio son renglones grandes; en Mi perfil, que es un
 * formulario, van compactas). Se guardan en el orden de la lista, no en el que se marcaron, igual que en el inicio.
 */
export default function SelectorDisciplinas({ value = [], onChange }) {
  const puestas = new Set(value);
  const marca = (id) => {
    const n = new Set(puestas);
    if (n.has(id)) n.delete(id); else n.add(id);
    onChange(DISCIPLINAS.filter((d) => n.has(d.id)).map((d) => d.id));
  };
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {DISCIPLINAS.map((d) => {
        const p = puestas.has(d.id);
        return (
          <button
            key={d.id}
            type="button"
            aria-pressed={p}
            onClick={() => marca(d.id)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 38, padding: '0 13px', borderRadius: 999,
              cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 700, touchAction: 'manipulation',
              border: `1.5px solid ${p ? T.accent : T.border}`, background: p ? T.accentBg : T.bg2, color: p ? T.accent : T.text2,
            }}
          >
            {p && <Check size={14} strokeWidth={3} />}{d.nombre}
          </button>
        );
      })}
    </div>
  );
}
