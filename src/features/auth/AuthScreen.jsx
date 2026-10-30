import { useState } from 'react';
import { ChevronLeft, Eye, EyeOff, Loader2, Lock, Mail, User } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { FONT, KP } from '@/lib/theme';
import { useIsWide } from '@/lib/useViewport';
import Puerta from '@/features/auth/Puerta';
import { botonPrimario, cajaDeCampo, entrada, enlace, rotulo, subtitulo, titulo } from '@/features/inicio/estilos';
import { AVISO_ENLACE_ENVIADO, AVISO_SIN_CORREO, correoValido, esCorreoInventado } from '@/lib/correos';

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

/* Un campo de «Entra con tu usuario», con el estilo del inicio nuevo: gris, sin borde, y el anillo azul al escribir. (`Field`, arriba, lo siguen usando
   otras pantallas que este cambio no toca: la tienda, la contraseña nueva, el selector de oficio.) */
function Campo({ id, etiqueta, Icono, tipo = 'text', value, onChange, ...extra }) {
  const [foco, setFoco] = useState(false);
  const [ver, setVer] = useState(false);
  const esClave = tipo === 'password';
  return (
    <label htmlFor={id} style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 14 }}>
      <span style={rotulo}>{etiqueta}</span>
      <span style={cajaDeCampo(foco)}>
        <Icono size={18} color={foco ? KP.blue : KP.ink3} style={{ flexShrink: 0 }} />
        <input
          id={id} type={esClave && ver ? 'text' : tipo} value={value} onChange={(e) => onChange(e.target.value)}
          onFocus={() => setFoco(true)} onBlur={() => setFoco(false)} style={entrada} {...extra}
        />
        {esClave && (
          <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar contraseña' : 'Ver contraseña'}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: KP.ink3, padding: 4, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            {ver ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </span>
    </label>
  );
}

const cajaDeAviso = (tono) => ({
  background: tono === 'malo' ? KP.dangerSoft : KP.blueSoft, color: tono === 'malo' ? KP.danger : KP.blueDk, borderRadius: 12,
  padding: '11px 14px', fontSize: 13.5, fontWeight: 600, lineHeight: 1.45, marginBottom: 12,
});

/**
 * Entrar. Primero la puerta; con usuario y contraseña, a dos toques.
 *
 * Andrés, 8 oct 2026: «lo primero es que sea fácil que la gente que ya tiene cuenta entre, no que cada vez les aparezca el proceso de crear una cuenta».
 * Inicio nuevo (30 oct 2026, prototipo HUZVXJGnGrGaZeBq4e3wrv): la primera pantalla es LA PUERTA (`Puerta`): Apple y Google, que entran o crean la cuenta
 * con el mismo botón, y «Usar usuario y contraseña», que abre «Entra con tu usuario» (este formulario, con el estilo nuevo). Desde ahí, «¿Nueva aquí? Crea
 * tu cuenta» abre el inicio (`features/inicio`) en modo `nuevo`.
 *
 * `empezar`: 'puerta' o 'usuario' (al volver del inicio se regresa al formulario, que es de donde se salió). En la compu va en una tarjeta centrada.
 */
export default function AuthScreen({ onVolver, onCrearCuenta, aviso, empezar = 'puerta' }) {
  const compu = useIsWide();
  const [vista, setVista] = useState(empezar);

  const marco = (hijos) => (
    <div style={{
      minHeight: '100svh', display: 'flex', alignItems: compu ? 'center' : 'stretch', justifyContent: 'center', fontFamily: FONT,
      padding: compu ? '28px 20px' : 0, background: compu ? '#F4F5F8' : '#fff',
    }}>
      <div className="animate-fade-in" style={compu
        ? { width: '100%', maxWidth: 440, background: '#fff', borderRadius: 26, boxShadow: '0 24px 60px rgba(17,19,24,0.10)', overflow: 'hidden' }
        : { width: '100%' }}
      >
        {hijos}
      </div>
    </div>
  );

  if (vista === 'puerta') {
    return marco(<Puerta compu={compu} aviso={aviso} onVolver={onVolver} onUsuario={() => setVista('usuario')} />);
  }
  return marco(<EntraConUsuario compu={compu} aviso={aviso} onVolver={() => setVista('puerta')} onCrearCuenta={onCrearCuenta} />);
}

function EntraConUsuario({ compu, aviso, onVolver, onCrearCuenta }) {
  const { signIn, pedirRecuperacion, enlaceVencido } = useAuth();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // «¿Olvidaste tu contraseña?»: en vez de entrar, se pide el correo para mandarle el enlace.
  const [olvide, setOlvide] = useState(false);
  const [correo, setCorreo] = useState('');
  const [enviado, setEnviado] = useState('');

  async function pideEnlace(e) {
    e.preventDefault();
    if (busy) return;
    setError('');
    setEnviado('');
    if (!correoValido(correo)) { setError('Escribe tu correo completo, por ejemplo nombre@gmail.com.'); return; }
    // Las cuentas creadas sin correo tienen uno inventado que nadie recibe: ahí no se manda nada.
    if (esCorreoInventado(correo)) { setError(AVISO_SIN_CORREO); return; }
    setBusy(true);
    const { error: err } = await pedirRecuperacion(correo);
    setBusy(false);
    // Un fallo de verdad (sin red, demasiados intentos) se dice; que el correo no exista NO se dice nunca.
    if (err && /rate|limit|seconds|many/i.test(err.message)) { setError('Ya pediste un enlace hace poco. Espera un minuto y vuelve a intentarlo.'); return; }
    if (err && /fetch|network/i.test(err.message)) { setError('No se pudo conectar. Revisa tu internet e inténtalo de nuevo.'); return; }
    setEnviado(AVISO_ENLACE_ENVIADO);
  }

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

  const atras = olvide ? () => { setOlvide(false); setError(''); setEnviado(''); } : onVolver;

  return (
    <form
      onSubmit={olvide ? pideEnlace : onSubmit} noValidate
      style={{
        display: 'flex', flexDirection: 'column', minHeight: compu ? 600 : '100svh', fontFamily: FONT,
        padding: compu ? '22px 30px 26px' : 'calc(14px + env(safe-area-inset-top, 0px)) 22px calc(14px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div style={{ minHeight: 40, display: 'flex', alignItems: 'center' }}>
        <button type="button" onClick={atras} aria-label="Atrás" className="kp-press"
          style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: '#EBEDF1', display: 'grid', placeItems: 'center', color: KP.ink, padding: 0, cursor: 'pointer' }}>
          <ChevronLeft size={18} />
        </button>
      </div>
      <div style={{ flex: 1 }}>
        <h1 style={titulo(compu)}>{olvide ? '¿Olvidaste tu contraseña?' : 'Entra con tu usuario'}</h1>
        <p style={subtitulo}>{olvide ? 'Te mandamos un enlace para entrar.' : 'O con tu correo, si le pusiste uno.'}</p>
        {aviso && !olvide && <div style={cajaDeAviso('azul')}>{aviso}</div>}
        {enlaceVencido && !olvide && (
          <div role="alert" style={cajaDeAviso('azul')}>Ese enlace ya venció o ya se usó. Toca «¿Olvidaste tu contraseña?» para pedir uno nuevo.</div>
        )}
        {olvide ? (
          <Campo id="ent-correo" etiqueta="Tu correo" Icono={Mail} tipo="email" value={correo} onChange={setCorreo}
            placeholder="nombre@gmail.com" autoComplete="email" inputMode="email" autoCapitalize="none" autoFocus />
        ) : (
          <>
            {/* `tu_usuario`: con este marcador lo encuentra la prueba de humo (`scripts/smoke.mjs`). */}
            <Campo id="ent-usuario" etiqueta="Usuario o correo" Icono={User} value={identifier} onChange={setIdentifier}
              placeholder="tu_usuario" autoComplete="username" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            <Campo id="ent-clave" etiqueta="Contraseña" Icono={Lock} tipo="password" value={password} onChange={setPassword}
              placeholder="••••••••" autoComplete="current-password" />
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: -6 }}>
              <button
                type="button" onClick={() => { setOlvide(true); setError(''); setCorreo(identifier.includes('@') ? identifier : ''); }}
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: KP.blue, padding: 2, minHeight: 32 }}
              >
                ¿Olvidaste tu contraseña?
              </button>
            </div>
          </>
        )}
        {error && <div role="alert" style={{ ...cajaDeAviso('malo'), marginTop: 12 }}>{error}</div>}
        {enviado && <div role="status" style={{ ...cajaDeAviso('azul'), marginTop: 12 }}>{enviado}</div>}
      </div>
      <div style={{ display: 'grid', gap: 4, paddingTop: 18 }}>
        <button type="submit" disabled={busy} className="kp-press" style={botonPrimario(busy)}>
          {busy ? <Loader2 size={18} className="spin" /> : olvide ? 'Mandarme el enlace' : 'Entrar'}
        </button>
        {!olvide && onCrearCuenta && (
          <button type="button" onClick={onCrearCuenta} style={{ ...enlace, color: KP.ink }}>
            ¿Nueva aquí? <span style={{ color: KP.blue }}>Crea tu cuenta</span>
          </button>
        )}
      </div>
      <style>{`
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        input::placeholder { color: ${KP.ink3}; opacity: 0.7; }
      `}</style>
    </form>
  );
}
