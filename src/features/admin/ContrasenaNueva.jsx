import { useState } from 'react';
import { Check, Copy, KeyRound, Loader2 } from 'lucide-react';
import { T, KP, FONT } from '@/lib/theme';
import { useConfirmacion } from '@/components/Confirmacion';
import { restableceContrasena } from '@/lib/cuentasDePruebaApi';

/* «CONTRASEÑA NUEVA» de una cuenta, solo para el dueño (14 oct 2026).

   La contraseña de una persona NO se puede leer (la base la guarda cifrada en un solo sentido, y así debe ser). Lo que sí se puede es ponerle una nueva a quien se olvidó:
   se enseña UNA vez para pasársela, y la vieja deja de servir. Si la cuenta es de prueba (`zz_…`), además queda guardada en «Cuentas de prueba». */
export default function ContrasenaNueva({ cuenta, estilo }) {
  const pregunta = useConfirmacion();
  const [ocupado, setOcupado] = useState(false);
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');
  const [copiada, setCopiada] = useState(false);
  const nombre = cuenta.full_name || cuenta.username;

  const pon = async () => {
    const va = await pregunta({
      titulo: `¿Ponerle una contraseña nueva a ${nombre}?`,
      detalle: 'La que tiene ahora deja de servir. La nueva se te enseña una sola vez: cópiala y pásasela.',
      confirmar: 'Sí, ponerla',
    });
    if (!va) return;
    setOcupado(true);
    setError('');
    try { setResultado(await restableceContrasena(cuenta.id)); } catch (e) { setError(e?.message ?? 'No se pudo poner la contraseña.'); } finally { setOcupado(false); }
  };
  const copia = async () => {
    try { await navigator.clipboard.writeText(resultado.contrasena); setCopiada(true); setTimeout(() => setCopiada(false), 1500); } catch { /* sin permiso */ }
  };

  return (
    <>
      <button type="button" onClick={pon} disabled={ocupado} style={estilo}>
        {ocupado ? <Loader2 size={16} className="spin" /> : <KeyRound size={16} />}
        <span style={{ flex: 1, minWidth: 0 }}>Contraseña nueva</span>
      </button>
      {resultado && (
        <div role="status" style={{ background: KP.mintSoft, borderRadius: 13, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>{resultado.guardada ? 'Contraseña nueva (queda en Cuentas de prueba)' : 'Contraseña nueva: se muestra una sola vez'}</div>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.text, fontFamily: 'ui-monospace, Menlo, monospace', letterSpacing: 0.3, marginTop: 3, userSelect: 'all', overflowWrap: 'anywhere' }}>{resultado.contrasena}</div>
          </div>
          <button type="button" onClick={copia} aria-label="Copiar la contraseña" style={{ width: 42, height: 42, borderRadius: 11, border: 'none', background: T.bg2, color: copiada ? KP.mint : T.text2, cursor: 'pointer', display: 'grid', placeItems: 'center', fontFamily: FONT }}>
            {copiada ? <Check size={17} strokeWidth={3} /> : <Copy size={17} />}
          </button>
        </div>
      )}
      {error && <div role="alert" style={{ background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 11, padding: '10px 12px', fontSize: 12.5, fontWeight: 700 }}>{error}</div>}
    </>
  );
}
