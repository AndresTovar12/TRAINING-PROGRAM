import { useState } from 'react';
import { Dumbbell, Lock, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Field } from '@/features/auth/AuthScreen';
import { problemaDeContrasena } from '@/lib/contrasena';
import { FONT, KP } from '@/lib/theme';

/* «PON UNA CONTRASEÑA NUEVA» (15 oct 2026): lo único que ve quien abre el enlace que le llegó por correo al darle a «¿Olvidaste tu contraseña?».
   Ya trae una sesión de recuperación (el enlace la abre), así que solo falta escoger la contraseña; al guardarla, entra a su cuenta. */
export default function NuevaContrasena() {
  const { user, profile, ponerContrasenaNueva, cancelarRecuperacion } = useAuth();
  const [nueva, setNueva] = useState('');
  const [repite, setRepite] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function guarda(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    const problema = problemaDeContrasena(nueva, { usuario: profile?.username, correo: user?.email });
    if (problema) { setError(problema); return; }
    if (nueva !== repite) { setError('Las dos contraseñas no son iguales.'); return; }
    setBusy(true);
    const { error: err } = await ponerContrasenaNueva(nueva);
    setBusy(false);
    // Si salió bien, `recuperando` pasa a falso y la app entra sola a su cuenta.
    if (err) setError(/same password|different from the old/i.test(err.message) ? 'Elige una distinta a la que tenías.' : (err.message || 'No se pudo guardar. Inténtalo de nuevo.'));
  }

  return (
    <div
      style={{
        minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, fontFamily: FONT,
        background: 'radial-gradient(1100px 620px at 50% -8%, #e7ecfe 0%, rgba(244,245,248,0) 60%), #f4f5f8',
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: '100%', maxWidth: 412, background: KP.surface, borderRadius: 28, padding: '36px 30px 30px',
          border: `1px solid ${KP.line}`, boxShadow: '0 24px 60px rgba(17,19,24,0.10), 0 4px 14px rgba(17,19,24,0.05)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', marginBottom: 24 }}>
          <div style={{ width: 60, height: 60, borderRadius: 16, display: 'grid', placeItems: 'center', background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, boxShadow: KP.shBtn, marginBottom: 16 }}>
            <Dumbbell size={28} color="#fff" strokeWidth={2.4} />
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.5, color: KP.ink }}>Pon una contraseña nueva</div>
        </div>

        <form onSubmit={guarda} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Field icon={Lock} label="Contraseña nueva" type="password" autoComplete="new-password" placeholder="Mínimo 8 caracteres" value={nueva} onChange={(e) => setNueva(e.target.value)} autoFocus />
          <Field icon={Lock} label="Repítela" type="password" autoComplete="new-password" placeholder="••••••••" value={repite} onChange={(e) => setRepite(e.target.value)} />

          {error && (
            <div role="alert" style={{ background: KP.dangerSoft, color: KP.danger, borderRadius: 12, padding: '11px 14px', fontSize: 13.5, fontWeight: 600 }}>
              {error}
            </div>
          )}

          <button
            type="submit" disabled={busy} className="kp-press"
            style={{
              marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '15px 0', borderRadius: KP.rBtn, border: 'none',
              cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1, background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`,
              color: '#fff', fontFamily: FONT, fontSize: 15.5, fontWeight: 700, boxShadow: KP.shBtn,
            }}
          >
            {busy ? <Loader2 size={18} className="spin" /> : <>Guardar y entrar <ArrowRight size={18} /></>}
          </button>
          <button
            type="button" onClick={cancelarRecuperacion}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: KP.ink2, padding: '6px 0' }}
          >
            Mejor no
          </button>
        </form>
      </div>
    </div>
  );
}
