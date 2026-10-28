import { useState } from 'react';
import { createPortal } from 'react-dom';
import { FONT } from '@/lib/theme';

const MAX_NOMBRE = 40;

/** «Cambiar el nombre»: un campo de 40 letras con su contador. */
export default function CambiarNombre({ nombre, alGuardar, alCancelar, capa }) {
  const [valor, setValor] = useState(nombre ?? '');
  const [guardando, setGuardando] = useState(false);
  const limpio = valor.replace(/\s+/g, ' ').trim();
  const guarda = async (ev) => {
    ev.preventDefault();
    if (!limpio || guardando) return;
    setGuardando(true);
    try { await alGuardar(limpio); } finally { setGuardando(false); }
  };
  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: capa, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', fontFamily: FONT }}>
      <div onClick={alCancelar} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.42)' }} />
      <form onSubmit={guarda} style={{ position: 'relative', background: '#fff', borderRadius: '22px 22px 0 0', padding: '18px 16px calc(14px + env(safe-area-inset-bottom))', maxWidth: 560, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <label htmlFor="stk-nombre" style={{ display: 'block', fontSize: 14, fontWeight: 700, color: '#5A6274', marginBottom: 8 }}>Nombre del entreno</label>
        <input
          id="stk-nombre" autoFocus value={valor} maxLength={MAX_NOMBRE} autoComplete="off" enterKeyHint="done" onChange={(e) => setValor(e.target.value)}
          style={{ width: '100%', boxSizing: 'border-box', minHeight: 52, borderRadius: 14, border: 'none', background: '#F2F3F7', padding: '0 14px', fontSize: 17, fontFamily: FONT, color: '#0B0D12' }}
        />
        <div style={{ textAlign: 'right', fontSize: 12.5, color: '#8A93A6', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{valor.length}/{MAX_NOMBRE}</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 12 }}>
          <button type="button" onClick={alCancelar} className="kp-press" style={{ minHeight: 52, borderRadius: 16, border: 'none', background: '#EEF0F4', color: '#0B0D12', fontFamily: FONT, fontSize: 16, fontWeight: 800, cursor: 'pointer' }}>Cancelar</button>
          <button type="submit" disabled={!limpio || guardando} className="kp-press" style={{ minHeight: 52, borderRadius: 16, border: 'none', background: '#1E40E0', color: '#fff', fontFamily: FONT, fontSize: 16, fontWeight: 800, cursor: 'pointer', opacity: !limpio || guardando ? 0.5 : 1 }}>Guardar</button>
        </div>
      </form>
    </div>,
    document.body,
  );
}
