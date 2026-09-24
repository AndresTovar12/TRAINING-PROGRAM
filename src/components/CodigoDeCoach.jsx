import { useState } from 'react';
import { Check, Copy } from 'lucide-react';
import { T, FONT } from '@/lib/theme';

/**
 * El código del coach, para copiarlo de un toque.
 *
 * Andrés, 24 sep 2026: "lo que sí quiero es lo del código, únicamente porque
 * siento que a veces podría ser más fácil copiar y pegar un código en lugar
 * del nombre de usuario del coach". Y tenía razón en el motivo: un usuario se
 * teclea mal, se le olvida el guion bajo, o se autocorrige en el teléfono. Seis
 * caracteres se pegan y ya.
 *
 * Se enseña en monoespaciada y espaciado: así se distingue de un texto normal
 * y se lee carácter a carácter, que es como se dicta por teléfono. El código ya
 * viene sin letras confundibles —nada de O, 0, I, L ni 1—, cosa de la base.
 */
export default function CodigoDeCoach({ codigo, estilo }) {
  const [copiado, setCopiado] = useState(false);
  if (!codigo) return null;

  const copiar = async () => {
    try {
      await navigator.clipboard.writeText(codigo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Safari niega el portapapeles fuera de un toque directo, y en http a
      // secas no existe. El código está a la vista y se puede seleccionar.
      setCopiado(false);
    }
  };

  return (
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12,
        padding: '8px 9px 8px 13px', fontFamily: FONT, ...estilo,
      }}
    >
      <div style={{ minWidth: 0 }}>
        <div style={{
          fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6,
          textTransform: 'uppercase', color: T.text3, lineHeight: 1.2,
        }}>
          Tu código
        </div>
        <div style={{
          fontSize: 16, fontWeight: 800, color: T.text, letterSpacing: 2,
          fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
          userSelect: 'all', lineHeight: 1.25,
        }}>
          {codigo}
        </div>
      </div>
      <button
        type="button"
        onClick={(e) => { e.preventDefault(); copiar(); }}
        aria-label={copiado ? 'Código copiado' : 'Copiar mi código'}
        title="Copiar"
        style={{
          display: 'grid', placeItems: 'center', width: 36, minHeight: 36, flexShrink: 0,
          borderRadius: 9, cursor: 'pointer', touchAction: 'manipulation',
          border: `1.5px solid ${copiado ? T.accent : T.border}`,
          background: copiado ? T.accentBg : T.bg,
          color: copiado ? T.accent : T.text2,
        }}
      >
        {copiado ? <Check size={16} /> : <Copy size={15} />}
      </button>
    </div>
  );
}
