import { useState } from 'react';
import { Check, Copy, QrCode } from 'lucide-react';
import { T, FONT } from '@/lib/theme';
import { ligaParaUnirse } from '@/lib/api';
import MostrarQR from '@/features/admin/MostrarQR';

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
 *
 * Y un botón de QR: la liga `…/?unirse=CODIGO` en grande, para que quien está
 * enfrente la escanee con la cámara (un atleta que ya tiene coach y quiere
 * sumarte a su equipo, o alguien que aún no tiene cuenta). Ver `UnirseAlEquipo`.
 */
export default function CodigoDeCoach({ codigo, estilo, nombre }) {
  const [copiado, setCopiado] = useState(false);
  const [verQR, setVerQR] = useState(false);
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

  /* DOS RECUADROS, NO UNO. Andrés, 1 oct 2026: «el botón de código y el de crear
     QR están en el mismo recuadro, tendrían que ir separados». El código (con su
     botón de copiar) es uno; «Mostrar QR» es otro, con su propio borde. */
  return (
    <>
    <div style={{ display: 'inline-flex', alignItems: 'stretch', flexWrap: 'wrap', gap: 10, fontFamily: FONT, ...estilo }}>
    <div
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 10,
        background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12,
        padding: '8px 9px 8px 13px',
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
    <button
      type="button"
      onClick={(e) => { e.preventDefault(); setVerQR(true); }}
      aria-label="Mostrar QR de mi código"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 14px',
        background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, cursor: 'pointer',
        touchAction: 'manipulation', fontFamily: FONT, fontSize: 13.5, fontWeight: 800, color: T.text,
      }}
    >
      <QrCode size={18} color={T.accent} /> Mostrar QR
    </button>
    </div>
    {verQR &&<MostrarQR liga={ligaParaUnirse(codigo)} nombre={nombre || 'Mi código'} onCerrar={() => setVerQR(false)} />}
    </>
  );
}
