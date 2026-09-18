import { useEffect, useRef, useState } from 'react';
import {
  Dumbbell, User, Lock, Mail, AtSign, Loader2, ArrowRight, UserCheck, Eye, EyeOff,
  Briefcase, ChevronDown, Check,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { FONT, KP } from '@/lib/theme';

const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;

function Field({ icon: Icon, label, hint, ...props }) {
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
            // entrar, asi que la app se abria zoomeada. Aqui cabe de sobra
            // porque es una tarjeta centrada y espaciosa; en los formularios de
            // adentro no se toca, ahi la densidad importa mas.
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
 * A qué se dedica quien crea planes.
 *
 * Andrés, 18 sep 2026: "en la parte de coach me hubiera gustado que se pudiera
 * desplegar un menú con opciones como de instructor, fisio, otro". No es un
 * permiso —el rol lo decide el botón de arriba— sino cómo se presenta: un
 * fisioterapeuta no se llama coach ni a sí mismo ni a sus pacientes.
 *
 * "Otro…" abre un campo de texto de verdad. Una lista cerrada con un "Otro"
 * que no deja escribir es peor que no preguntar: obliga a mentir.
 */
const OFICIOS = [
  'Entrenador personal',
  'Coach deportivo',
  'Instructor (yoga, pilates, spinning…)',
  'Fisioterapeuta',
  'Preparador físico',
];

function SelectorOficio({ value, onChange }) {
  const [abierto, setAbierto] = useState(false);
  const [otro, setOtro] = useState(false);
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
        label="¿A qué te dedicas?"
        placeholder="Escríbelo"
        autoComplete="off"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    );
  }

  return (
    <div ref={caja} style={{ position: 'relative' }}>
      <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: KP.ink3, marginBottom: 8 }}>
        ¿A qué te dedicas?
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

export default function AuthScreen({ modoInicial = 'login', onVolver }) {
  const { signIn, signUp, entrarConGoogle, googleDisponible } = useAuth();
  const [mode, setMode] = useState(modoInicial); // 'login' | 'register'
  const [identifier, setIdentifier] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [accountType, setAccountType] = useState('athlete'); // 'athlete' | 'coach'
  const [coachUsername, setCoachUsername] = useState('');
  const [genero, setGenero] = useState(''); // '' | 'h' | 'm'
  const [profesion, setProfesion] = useState('');
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
    const { error: err } = await signUp({
      username, email, password, fullName,
      accountType,
      coachUsername: accountType === 'athlete' ? coachUsername.trim() : '',
      genero,
      profesion: accountType === 'coach' ? profesion : '',
    });
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
      <div
        className="animate-fade-in"
        style={{
          width: '100%', background: KP.surface, borderRadius: 28,
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

        {/* Entrar con Google.

            Solo se dibuja cuando `VITE_GOOGLE_LOGIN` vale "1". Mientras las
            llaves no estén puestas, un botón que no funciona es peor que no
            tenerlo: la persona lo toca, falla, y ya no confía en el resto.
            Los pasos para encenderlo: `docs/entrar-con-google.md`. */}
        {googleDisponible && (
          <>
            <button
              type="button"
              onClick={entrarConGoogle}
              className="kp-press"
              style={{
                width: '100%', minHeight: 50, marginBottom: 14, borderRadius: KP.rBtn,
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
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
              <span style={{ flex: 1, height: 1, background: KP.line }} />
              <span style={{ fontSize: 11.5, fontWeight: 700, color: KP.ink3 }}>o con tu usuario</span>
              <span style={{ flex: 1, height: 1, background: KP.line }} />
            </div>
          </>
        )}

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
              {/* Tipo de cuenta */}
              <div>
                <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: KP.ink3, marginBottom: 8 }}>
                  ¿Qué vas a hacer aquí?
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {/* POR QUÉ ESTAS PALABRAS Y NO OTRAS.

                      El rol técnico es el mismo de siempre; lo que cambia es que
                      la palabra deje de excluir a quien no se llama "coach"
                      (Andrés, 17 sep 2026: "qué tal que es un instructor de yoga,
                      un fisioterapeuta").

                      Se probaron varias parejas con él. Cayeron todas las que
                      usaban el verbo ENTRENAR en los dos lados ("me entrenan /
                      yo entreno"): un atleta también diría "yo entreno", así que
                      la mitad de la gente elige mal. Y cayó "Sigo MI plan",
                      porque el posesivo se lee como que el plan te lo haces tú.

                      Quedó seguir/crear: dos verbos distintos, y el subtítulo
                      dice quién escribe el plan, que es lo único que de verdad
                      separa a los dos. */}
                  {[
                    { v: 'athlete', label: 'Seguir un plan', sub: 'Alguien me lo hace' },
                    { v: 'coach', label: 'Crear planes', sub: 'Se los hago a otros' },
                  ].map((o) => {
                    const active = accountType === o.v;
                    return (
                      <button
                        key={o.v}
                        type="button"
                        onClick={() => setAccountType(o.v)}
                        className="kp-press"
                        style={{
                          flex: 1, textAlign: 'left', padding: '11px 13px', borderRadius: 13, cursor: 'pointer',
                          border: `1.5px solid ${active ? KP.blue : KP.line}`,
                          background: active ? KP.blueSoft : KP.bg,
                          boxShadow: active ? '0 0 0 4px rgba(30,64,224,0.08)' : 'none',
                          transition: 'all .15s', fontFamily: FONT,
                        }}
                      >
                        <div style={{ fontSize: 14, fontWeight: 800, color: active ? KP.blue : KP.ink }}>{o.label}</div>
                        <div style={{ fontSize: 11.5, fontWeight: 600, color: KP.ink3, marginTop: 2 }}>{o.sub}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Solo para quien crea planes. Es una etiqueta suya, no un
                  permiso: el rol sigue decidiéndolo el botón de arriba. */}
              {accountType === 'coach' && (
                <SelectorOficio value={profesion} onChange={setProfesion} />
              )}

              {/* ORDEN DEL FORMULARIO. Andrés, 18 sep 2026: "el orden en el que
                  pusiste las cosas no es el mejor, no se ve muy práctico".
                  Tenía razón y el síntoma era claro: la CONTRASEÑA quedaba
                  hasta abajo, después de tres campos opcionales y de una
                  pregunta sobre videos. Ahora lo obligatorio va junto y
                  primero, y lo opcional después de una raya que lo dice. */}
              <Field
                icon={User}
                label="Nombre"
                hint="Opcional"
                placeholder="Tu nombre"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
              <Field
                icon={AtSign}
                label="Usuario"
                placeholder="tu_usuario"
                autoComplete="username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
              <Field
                icon={Lock}
                label="Contraseña"
                placeholder="••••••••"
                type="password"
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />

              <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '2px 0' }}>
                <span style={{ flex: 1, height: 1, background: KP.line }} />
                <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: KP.ink3 }}>
                  Opcional
                </span>
                <span style={{ flex: 1, height: 1, background: KP.line }} />
              </div>

              <Field
                icon={Mail}
                label="Correo"
                placeholder="tu@correo.com"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
              {accountType === 'athlete' && (
                <Field
                  icon={UserCheck}
                  label="Usuario de quien te entrena"
                  placeholder="su_usuario"
                  autoComplete="off"
                  value={coachUsername}
                  onChange={(e) => setCoachUsername(e.target.value.replace(/\s/g, ''))}
                />
              )}

              {/* Se pregunta AQUI, y no solo en "Mi perfil", por un dato medido:
                  estando escondido en el perfil, 11 de 11 personas lo tenian
                  vacio. Un coach podia grabar la version de hombre y la de
                  mujer de un ejercicio y no se las iba a ver nadie, porque la
                  app no sabia a quien le tocaba cual.

                  Es opcional de verdad: "Prefiero no decir" es una opcion real,
                  no un descuido. Quien no conteste ve el video general. */}
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
                  color: KP.ink3, marginBottom: 8,
                }}>
                  Videos de técnica
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {[
                    { v: 'h', label: 'Hombre' },
                    { v: 'm', label: 'Mujer' },
                    { v: '', label: 'Prefiero no decir' },
                  ].map((o) => {
                    const active = genero === o.v;
                    return (
                      <button
                        key={o.v || 'sin'}
                        type="button"
                        onClick={() => setGenero(o.v)}
                        className="kp-press"
                        style={{
                          flex: 1, minHeight: 44, padding: '10px 8px', borderRadius: 13, cursor: 'pointer',
                          border: `1.5px solid ${active ? KP.blue : KP.line}`,
                          background: active ? KP.blueSoft : KP.bg,
                          color: active ? KP.blue : KP.ink2,
                          boxShadow: active ? '0 0 0 4px rgba(30,64,224,0.08)' : 'none',
                          transition: 'all .15s', fontFamily: FONT,
                          fontSize: 13, fontWeight: 700, lineHeight: 1.2,
                        }}
                      >
                        {o.label}
                      </button>
                    );
                  })}
                </div>
                <div style={{ fontSize: 11.5, fontWeight: 600, color: KP.ink3, marginTop: 7, lineHeight: 1.45 }}>
                  Opcional. Si un ejercicio está grabado en dos versiones, te muestra la tuya.
                  Puedes cambiarlo después en tu perfil.
                </div>
              </div>
            </>
          )}
          {/* Al registrarse la contraseña va arriba, junto al usuario: ver el
              comentario del orden. Aquí solo queda la de entrar. */}
          {isLogin && (
            <Field
              icon={Lock}
              label="Contraseña"
              placeholder="••••••••"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          )}

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
      </div>

      <style>{`
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: ${KP.ink3}; opacity: 0.7; }
      `}</style>
    </div>
  );
}
