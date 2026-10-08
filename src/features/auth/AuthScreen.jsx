import { useState } from 'react';
import { Dumbbell, User, Lock, Loader2, ArrowRight, Eye, EyeOff, UserPlus } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { FONT, KP } from '@/lib/theme';

export function Field({ icon: Icon, label, hint, ...props }) {
  const [focus, setFocus] = useState(false);
  const [show, setShow] = useState(false);
  const isPassword = props.type === 'password';
  const inputType = isPassword && show ? 'text' : props.type;
  return (
    <label style={{ display: 'block' }}>
      <div
        style={{
          display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
          marginBottom: 7,
        }}
      >
        <span
          style={{
            fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
            color: KP.ink3,
          }}
        >
          {label}
        </span>
        {hint && (
          <span style={{ fontSize: 11, fontWeight: 600, color: KP.ink3 }}>{hint}</span>
        )}
      </div>
      <div
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          background: focus ? KP.surface : KP.bg, borderRadius: KP.rField, padding: '0 14px',
          border: `1.5px solid ${focus ? KP.blue : KP.line}`,
          boxShadow: focus ? '0 0 0 4px rgba(30,64,224,0.10)' : 'none',
          transition: 'border-color .15s, box-shadow .15s, background .15s',
        }}
      >
        <Icon size={18} color={focus ? KP.blue : KP.ink3} style={{ flexShrink: 0 }} />
        <input
          {...props}
          type={inputType}
          onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            // 16px NO es capricho de diseño: es el minimo que pide iOS para no
            // hacer zoom solo al enfocar un campo. Con 15px, Safari acercaba la
            // pantalla mientras escribias la contraseña y NO lo deshacia al
            // entrar, asi que la app se abria zoomeada.
            fontFamily: FONT, fontSize: 16, fontWeight: 500, color: KP.ink,
            padding: '13px 0', minWidth: 0,
          }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-label={show ? 'Ocultar contraseña' : 'Ver contraseña'}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: KP.ink3, padding: 4, display: 'grid', placeItems: 'center', flexShrink: 0 }}
          >
            {show ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </label>
  );
}

/**
 * Entrar. Solo entrar.
 *
 * Andrés, 8 oct 2026: «lo primero es que sea fácil que la gente que ya tiene cuenta entre, no que cada vez les aparezca
 * el proceso de crear una cuenta». Quien ya tiene cuenta escribe su usuario (o su correo) y su contraseña, o toca Google,
 * y ya. «Crear cuenta» es un botón aquí abajo y abre el inicio nuevo (`features/inicio`), que pregunta una cosa por
 * pantalla. Aquí ya no vive ningún formulario de registro.
 */
export default function AuthScreen({ onVolver, onCrearCuenta, aviso }) {
  const { signIn, entrarConGoogle, googleDisponible } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    if (!identifier.trim() || !password) {
      setError('Completa usuario y contraseña');
      return;
    }
    setBusy(true);
    const { error: err } = await signIn(identifier, password);
    setBusy(false);
    if (err) setError(err.message);
  }

  return (
    <div
      style={{
        minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, fontFamily: FONT,
        background:
          'radial-gradient(1100px 620px at 50% -8%, #e7ecfe 0%, rgba(244,245,248,0) 60%), #f4f5f8',
      }}
    >
      <div style={{ width: '100%', maxWidth: 412 }}>
        {onVolver && (
          <button
            type="button" onClick={onVolver}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 14,
              border: 'none', background: 'transparent', cursor: 'pointer',
              fontFamily: FONT, fontSize: 14, fontWeight: 700, color: KP.ink2, padding: '6px 4px',
            }}
          >
            ← Volver
          </button>
        )}
        {/* Por qué se está pidiendo entrar, cuando no es obvio: al conectar la IA la persona venía de Claude o de
            ChatGPT; con un link de equipo, el código ya va puesto. */}
        {aviso && (
          <div style={{
            marginBottom: 14, padding: '12px 16px', borderRadius: 16, textAlign: 'center',
            background: KP.blueSoft, color: KP.blueDk, fontSize: 14, fontWeight: 700, lineHeight: 1.45,
          }}>
            {aviso}
          </div>
        )}
        <div
          className="animate-fade-in"
          style={{
            width: '100%', background: KP.surface, borderRadius: 28, padding: '36px 30px 30px',
            border: `1px solid ${KP.line}`,
            boxShadow: '0 24px 60px rgba(17,19,24,0.10), 0 4px 14px rgba(17,19,24,0.05)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', marginBottom: 26 }}>
            <div
              style={{
                width: 60, height: 60, borderRadius: 16, display: 'grid', placeItems: 'center', flexShrink: 0,
                background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, boxShadow: KP.shBtn, marginBottom: 16,
              }}
            >
              <Dumbbell size={28} color="#fff" strokeWidth={2.4} />
            </div>
            <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: -0.6, color: KP.ink }}>
              Training<span style={{ color: KP.blue }}> Lab</span>
            </div>
            <div style={{ fontSize: 14, fontWeight: 500, color: KP.ink2, marginTop: 5 }}>Inicia sesión para entrenar</div>
          </div>

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <Field
              icon={User}
              label="Usuario o correo"
              placeholder="tu_usuario"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
            <Field
              icon={Lock}
              label="Contraseña"
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />

            {error && (
              <div
                role="alert"
                style={{
                  display: 'flex', gap: 8, alignItems: 'flex-start',
                  background: KP.dangerSoft, color: KP.danger, borderRadius: 12,
                  padding: '11px 14px', fontSize: 13.5, fontWeight: 600,
                }}
              >
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={busy}
              className="kp-press"
              style={{
                marginTop: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '15px 0', borderRadius: KP.rBtn, border: 'none',
                cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
                background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`,
                color: '#fff', fontFamily: FONT, fontSize: 15.5, fontWeight: 700,
                boxShadow: KP.shBtn,
              }}
            >
              {busy ? <Loader2 size={18} className="spin" /> : <>Entrar <ArrowRight size={18} /></>}
            </button>
          </form>

          {/* Entrar con Google. Solo se dibuja cuando `VITE_GOOGLE_LOGIN` vale "1": un botón que no funciona es peor que
              no tenerlo. Los pasos para encenderlo: `docs/entrar-con-google.md`. */}
          {googleDisponible && (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
                <span style={{ flex: 1, height: 1, background: KP.line }} />
                <span style={{ fontSize: 11.5, fontWeight: 700, color: KP.ink3 }}>o</span>
                <span style={{ flex: 1, height: 1, background: KP.line }} />
              </div>
              <button
                type="button"
                onClick={entrarConGoogle}
                className="kp-press"
                style={{
                  width: '100%', minHeight: 50, borderRadius: KP.rBtn,
                  border: `1.5px solid ${KP.line}`, background: KP.surface, cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
                  fontFamily: FONT, fontSize: 15, fontWeight: 700, color: KP.ink,
                }}
              >
                <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
                  <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.1z" />
                  <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C7.9 41 15.4 46 24 46z" />
                  <path fill="#FBBC05" d="M11.6 28.1c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.8l7.3-5.7z" />
                  <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.3 30 2 24 2 15.4 2 7.9 7 4.3 14.2l7.3 5.7c1.8-5.2 6.6-9.1 12.4-9.1z" />
                </svg>
                Continuar con Google
              </button>
            </>
          )}

          {/* La puerta a crear la cuenta. Blanca y con borde, no gris: es un botón de verdad, aunque sea el segundo. */}
          {onCrearCuenta && (
            <div style={{ marginTop: 20, paddingTop: 18, borderTop: `1px solid ${KP.line}`, textAlign: 'center' }}>
              <div style={{ fontSize: 14, fontWeight: 600, color: KP.ink2, marginBottom: 10 }}>¿Primera vez aquí?</div>
              <button
                type="button"
                onClick={onCrearCuenta}
                className="kp-press"
                style={{
                  width: '100%', minHeight: 50, borderRadius: KP.rBtn, border: `1.5px solid ${KP.lineHi}`,
                  background: KP.surface, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
                  fontFamily: FONT, fontSize: 15, fontWeight: 800, color: KP.blue,
                }}
              >
                <UserPlus size={17} /> Crear cuenta
              </button>
            </div>
          )}
        </div>
      </div>

      <style>{`
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: ${KP.ink3}; opacity: 0.7; }
      `}</style>
    </div>
  );
}
