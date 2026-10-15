import { useState } from 'react';
import { Mail, KeyRound, Loader2, Check } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { esCorreoInventado, correoValido } from '@/lib/correos';
import { confirmaCodigoDeCorreo, pideCodigoDeCorreo } from '@/lib/correoDeLaCuentaApi';
import { T, FONT, KP } from '@/lib/theme';

/* EL CORREO DE LA CUENTA en Mi perfil (15 oct 2026). Andrés: que cada quien pueda poner o cambiar su correo.

   Quien se creó sin correo tiene uno inventado que nadie recibe: aquí se ve «Sin correo» y el botón «Agregar correo». Se escribe el correo y la contraseña
   actual, llega un código de 6 números a ese correo, se escribe aquí, y queda puesto. Desde ahí sirve «¿Olvidaste tu contraseña?».
   Quien entró solo con Google ve su correo de Google y no lo cambia aquí. */

const label = { fontSize: 11, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6 };
const caja = { display: 'flex', alignItems: 'center', gap: 10, background: T.bg2, borderRadius: 12, padding: '0 13px', border: `1.5px solid ${T.border}` };
const campo = { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: 16, fontWeight: 500, color: T.text, padding: '13px 0', minWidth: 0 };
const botonAzul = (apagado) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, padding: '0 18px', borderRadius: 12, border: 'none',
  background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, color: '#fff', fontFamily: FONT, fontSize: 14.5, fontWeight: 800,
  cursor: apagado ? 'default' : 'pointer', opacity: apagado ? 0.6 : 1, boxShadow: KP.shBtn,
});
const botonBlanco = { minHeight: 40, padding: '0 14px', borderRadius: 11, border: `1.5px solid ${KP.blue}`, background: T.bg2, color: KP.blue, fontFamily: FONT, fontSize: 13.5, fontWeight: 800, cursor: 'pointer', flexShrink: 0 };
const enlace = { border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: T.text2, padding: '6px 2px' };

export default function CorreoDeLaCuenta() {
  const { user, refreshProfile } = useAuth();
  const proveedores = user?.app_metadata?.providers ?? ['email'];
  const soloGoogle = !proveedores.includes('email');
  const actual = user?.email ?? '';
  const sinCorreo = !actual || esCorreoInventado(actual);

  const [paso, setPaso] = useState(null); // null | 'pedir' | 'codigo'
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [codigo, setCodigo] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [listo, setListo] = useState('');

  const cierra = () => { setPaso(null); setError(''); setCodigo(''); setContrasena(''); };

  async function pide(e) {
    e?.preventDefault();
    if (busy) return;
    setError('');
    if (!correoValido(correo)) { setError('Escribe tu correo completo, por ejemplo nombre@gmail.com.'); return; }
    if (!contrasena) { setError('Escribe tu contraseña actual.'); return; }
    setBusy(true);
    try {
      await pideCodigoDeCorreo(correo.trim(), contrasena);
      setPaso('codigo');
      setCodigo('');
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  async function confirma(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!/^\d{6}$/.test(codigo)) { setError('El código tiene 6 números.'); return; }
    setBusy(true);
    try {
      const r = await confirmaCodigoDeCorreo(codigo);
      // La sesión guarda el correo viejo: se renueva para que toda la app vea el nuevo.
      await supabase.auth.refreshSession().catch(() => {});
      await refreshProfile?.();
      setListo(r.correo);
      cierra();
    } catch (err) {
      setError(err.message);
      if (err.codigo === 'VENCIDO') setPaso('pedir');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <div style={{ ...label, marginBottom: 7 }}>Correo</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ ...caja, flex: 1, background: T.bg3, opacity: 0.9 }}>
          <Mail size={18} color={T.text3} style={{ flexShrink: 0 }} />
          <span style={{ ...campo, color: sinCorreo ? T.text3 : T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {sinCorreo ? 'Sin correo' : actual}
          </span>
        </div>
        {!soloGoogle && !paso && (
          <button type="button" style={botonBlanco} onClick={() => { setPaso('pedir'); setListo(''); setError(''); }}>
            {sinCorreo ? 'Agregar' : 'Cambiar'}
          </button>
        )}
      </div>

      {sinCorreo && !paso && !listo && (
        <div style={{ fontSize: 12.5, color: T.text2, fontWeight: 600, marginTop: 7, lineHeight: 1.45 }}>
          Agrégalo para poder recuperar tu contraseña si la olvidas.
        </div>
      )}
      {soloGoogle && (
        <div style={{ fontSize: 12.5, color: T.text3, fontWeight: 600, marginTop: 7 }}>Es el de tu cuenta de Google.</div>
      )}
      {listo && (
        <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 7, marginTop: 9, fontSize: 13.5, fontWeight: 700, color: KP.mint }}>
          <Check size={16} strokeWidth={3} /> Listo: tu correo es {listo}
        </div>
      )}

      {paso === 'pedir' && (
        <form onSubmit={pide} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, padding: 14, borderRadius: 14, border: `1.5px solid ${T.border}`, background: T.bg }}>
          <label style={{ display: 'block' }}>
            <div style={{ ...label, marginBottom: 7 }}>{sinCorreo ? 'Tu correo' : 'Correo nuevo'}</div>
            <div style={caja}>
              <Mail size={18} color={T.text3} style={{ flexShrink: 0 }} />
              <input type="email" inputMode="email" autoComplete="email" autoCapitalize="none" spellCheck={false} placeholder="nombre@gmail.com"
                value={correo} onChange={(e) => setCorreo(e.target.value)} autoFocus style={campo} />
            </div>
          </label>
          <label style={{ display: 'block' }}>
            <div style={{ ...label, marginBottom: 7 }}>Tu contraseña actual</div>
            <div style={caja}>
              <KeyRound size={18} color={T.text3} style={{ flexShrink: 0 }} />
              <input type="password" autoComplete="current-password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} style={campo} />
            </div>
          </label>
          {error && <div role="alert" style={{ background: KP.dangerSoft, color: KP.danger, borderRadius: 11, padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>{error}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" disabled={busy} style={botonAzul(busy)}>{busy ? <Loader2 size={16} className="spin" /> : null} Mandarme el código</button>
            <button type="button" onClick={cierra} style={enlace}>Cancelar</button>
          </div>
        </form>
      )}

      {paso === 'codigo' && (
        <form onSubmit={confirma} noValidate style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, padding: 14, borderRadius: 14, border: `1.5px solid ${T.border}`, background: T.bg }}>
          <div style={{ fontSize: 14, fontWeight: 600, color: T.text, lineHeight: 1.45 }}>
            Te mandamos un código de 6 números a <b>{correo.trim()}</b>. Revisa también spam.
          </div>
          <div style={caja}>
            <input
              aria-label="Código de 6 números" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="000000" autoFocus
              value={codigo} onChange={(e) => setCodigo(e.target.value.replace(/\D/g, '').slice(0, 6))}
              style={{ ...campo, fontSize: 24, fontWeight: 800, letterSpacing: 8, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}
            />
          </div>
          {error && <div role="alert" style={{ background: KP.dangerSoft, color: KP.danger, borderRadius: 11, padding: '10px 12px', fontSize: 13, fontWeight: 600 }}>{error}</div>}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button type="submit" disabled={busy || codigo.length !== 6} style={botonAzul(busy || codigo.length !== 6)}>{busy ? <Loader2 size={16} className="spin" /> : null} Confirmar</button>
            <button type="button" onClick={() => { setPaso('pedir'); setError(''); }} style={enlace}>Mandar otro</button>
            <button type="button" onClick={cierra} style={enlace}>Cancelar</button>
          </div>
        </form>
      )}
    </div>
  );
}
