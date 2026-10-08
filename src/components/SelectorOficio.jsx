import { useEffect, useRef, useState } from 'react';
import { Briefcase, ChevronDown, Check } from 'lucide-react';
import { Field } from '@/features/auth/AuthScreen';
import { OFICIOS } from '@/lib/oficios';
import { FONT, KP } from '@/lib/theme';

/**
 * A qué se dedica quien crea planes: la lista de siempre más «Otro…», que abre un campo de texto de verdad. Una lista
 * cerrada con un «Otro» que no deja escribir es peor que no preguntar: obliga a mentir.
 *
 * Vivía en la pantalla de registro. Desde el inicio nuevo (8 oct 2026) ahí se pregunta de otra forma (una opción por
 * renglón, ver `features/inicio`), y esto se quedó para cambiarlo después en Mi perfil.
 */
export default function SelectorOficio({ value, onChange, etiqueta = '¿A qué te dedicas?' }) {
  const [abierto, setAbierto] = useState(false);
  const [otro, setOtro] = useState(() => !!value && !OFICIOS.includes(value));
  const caja = useRef(null);

  useEffect(() => {
    if (!abierto) return undefined;
    const fuera = (e) => { if (caja.current && !caja.current.contains(e.target)) setAbierto(false); };
    document.addEventListener('mousedown', fuera);
    return () => document.removeEventListener('mousedown', fuera);
  }, [abierto]);

  if (otro) {
    return (
      <Field
        icon={Briefcase}
        label={etiqueta}
        placeholder="Escríbelo"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, 40))}
      />
    );
  }

  return (
    <div ref={caja} style={{ position: 'relative' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: KP.ink3, marginBottom: 8 }}>
        {etiqueta}
      </div>
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', gap: 10, textAlign: 'left',
          minHeight: 52, padding: '0 14px', borderRadius: KP.rField, cursor: 'pointer',
          border: `1.5px solid ${KP.line}`, background: KP.bg, fontFamily: FONT,
          fontSize: 15, fontWeight: 600, color: value ? KP.ink : KP.ink3,
        }}
      >
        <Briefcase size={17} color={KP.ink3} style={{ flexShrink: 0 }} />
        <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {value || 'Elige una'}
        </span>
        <ChevronDown size={17} color={KP.ink3} style={{ flexShrink: 0 }} />
      </button>

      {abierto && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 40,
            background: KP.surface, border: `1px solid ${KP.line}`, borderRadius: 16,
            boxShadow: KP.shPop, padding: 7,
          }}
        >
          {OFICIOS.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => { onChange(o); setAbierto(false); }}
              style={{
                width: '100%', minHeight: 46, display: 'flex', alignItems: 'center', gap: 9,
                padding: '0 11px', borderRadius: 11, border: 'none', cursor: 'pointer',
                background: value === o ? KP.blueSoft : 'transparent', textAlign: 'left',
                fontFamily: FONT, fontSize: 14.5, fontWeight: 600, color: value === o ? KP.blue : KP.ink,
              }}
            >
              <span style={{ flex: 1, minWidth: 0 }}>{o}</span>
              {value === o && <Check size={16} color={KP.blue} />}
            </button>
          ))}
          <button
            type="button"
            onClick={() => { setOtro(true); onChange(''); setAbierto(false); }}
            style={{
              width: '100%', minHeight: 46, display: 'flex', alignItems: 'center', gap: 9,
              padding: '0 11px', borderRadius: 11, border: 'none', cursor: 'pointer',
              background: 'transparent', textAlign: 'left', marginTop: 4,
              borderTop: `1px solid ${KP.line}`,
              fontFamily: FONT, fontSize: 14.5, fontWeight: 700, color: KP.blue,
            }}
          >
            Otro…
          </button>
        </div>
      )}
    </div>
  );
}
