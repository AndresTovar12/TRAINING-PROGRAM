import { useState } from 'react';
import { Dumbbell, User, Lock, Mail, AtSign, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { FONT, KP } from '@/lib/theme';

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;

function Field({ icon: Icon, label, hint, ...props }) {
  const [focus, setFocus] = useState(false);
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
          onFocus={(e) => { setFocus(true); props.onFocus?.(e); }}
          onBlur={(e) => { setFocus(false); props.onBlur?.(e); }}
          style={{
            flex: 1, border: 'none', outline: 'none', background: 'transparent',
            fontFamily: FONT, fontSize: 15, fontWeight: 500, color: KP.ink,
            padding: '13px 0', minWidth: 0,
          }}
        />
      </div>
    </label>
  );
}

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const reset = () => { setError(''); };

  async function onSubmit(e) {
    e.preventDefault();
    if (busy) return;
    setError('');

    if (mode === 'login') {
      if (!identifier.trim() || !password) {
        setError('Completa usuario y contraseña');
        return;
      }
      setBusy(true);
      const { error: err } = await signIn(identifier, password);
      setBusy(false);
      if (err) setError(err.message);
      return;
    }

    // register
    if (!USERNAME_RE.test(username.trim())) {
      setError('El usuario debe tener 3-30 caracteres (letras, números, _ o .)');
      return;
    }
    if (password.length < 6) {
      setError('La contraseña debe tener al menos 6 caracteres');
      return;
    }
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      setError('Correo inválido');
      return;
    }
    setBusy(true);
    const { error: err } = await signUp({ username, email, password, fullName });
    setBusy(false);
    if (err) setError(err.message);
  }

  const isLogin = mode === 'login';

  return (
    <div
      style={{
        minHeight: '100svh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 20, fontFamily: FONT,
        background:
          'radial-gradient(1100px 620px at 50% -8%, #e7ecfe 0%, rgba(244,245,248,0) 60%), #f4f5f8',
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: '100%', maxWidth: 412, background: KP.surface, borderRadius: 28,
          padding: '36px 30px 30px',
          border: `1px solid ${KP.line}`,
          boxShadow: '0 24px 60px rgba(17,19,24,0.10), 0 4px 14px rgba(17,19,24,0.05)',
        }}
      >
        {/* Brand */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 26 }}>
          <div
            style={{
              width: 60, height: 60, borderRadius: 18, display: 'grid', placeItems: 'center',
              background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`,
              boxShadow: KP.shBtn, marginBottom: 16,
            }}
          >
            <Dumbbell size={28} color="#fff" strokeWidth={2.4} />
          </div>
          <div style={{ fontSize: 25, fontWeight: 800, letterSpacing: -0.6, color: KP.ink }}>
            Training<span style={{ color: KP.blue }}> Lab</span>
          </div>
          <div style={{ fontSize: 14, fontWeight: 500, color: KP.ink2, marginTop: 5 }}>
            {isLogin ? 'Inicia sesión para entrenar' : 'Crea tu cuenta'}
          </div>
        </div>

        {/* Tabs */}
        <div
          style={{
            display: 'flex', gap: 4, background: KP.bg, borderRadius: 14, padding: 4, marginBottom: 22,
            border: `1px solid ${KP.line}`,
          }}
        >
          {['login', 'register'].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => { setMode(m); reset(); }}
              className="kp-press"
              style={{
                flex: 1, padding: '10px 0', borderRadius: 10, border: 'none', cursor: 'pointer',
                fontFamily: FONT, fontSize: 14, fontWeight: 700,
                background: mode === m ? KP.surface : 'transparent',
                color: mode === m ? KP.blue : KP.ink2,
                boxShadow: mode === m ? '0 2px 8px rgba(17,19,24,0.08)' : 'none',
                transition: 'all .15s',
              }}
            >
              {m === 'login' ? 'Entrar' : 'Registrarse'}
            </button>
          ))}
        </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isLogin ? (
            <Field
              icon={User}
              label="Usuario o correo"
              placeholder="tu_usuario"
              autoComplete="username"
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
          ) : (
            <>
              <Field
                icon={AtSign}
                label="Usuario"
                placeholder="tu_usuario"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <Field
                icon={User}
                label="Nombre completo"
                hint="Opcional"
                placeholder="Tu nombre"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <Field
                icon={Mail}
                label="Correo"
                hint="Opcional"
                placeholder="tu@correo.com"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </>
          )}
          <Field
            icon={Lock}
            label="Contraseña"
            placeholder="••••••••"
            type="password"
            autoComplete={isLogin ? 'current-password' : 'new-password'}
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
            {busy ? (
              <Loader2 size={18} className="spin" />
            ) : (
              <>
                {isLogin ? 'Entrar' : 'Crear cuenta'}
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </form>
      </div>

      <style>{`
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: ${KP.ink3}; opacity: 0.7; }
      `}</style>
    </div>
  );
}
