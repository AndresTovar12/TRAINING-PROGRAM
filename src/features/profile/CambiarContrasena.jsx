import { useState } from 'react';
import { KeyRound, Eye, EyeOff, Loader2, Check, ChevronRight, ChevronDown } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { problemaDeContrasena, MIN_CONTRASENA } from '@/lib/contrasena';
import { T, FONT, KP } from '@/lib/theme';

/* «Cambiar contraseña» en Mi perfil (pedido 30 sep 2026; urgente el 10 oct 2026 por las contraseñas que estuvieron en el repositorio público).

   Antes la app NO dejaba cambiarla: solo por SQL. Aquí se escribe la actual (si la cuenta tiene una), la nueva dos veces y se guarda con Supabase Auth.
   La actual se comprueba con la función `login` (la misma que usa «Entrar»): así NO se abre otra sesión en este aparato ni se cierra la que está abierta.
   Una cuenta que entró solo con Google no tiene contraseña: ahí es «Crear contraseña» y no pide la actual. */

const LOGIN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/login`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

const label = { fontSize: 11, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6 };
const caja = { display: 'flex', alignItems: 'center', gap: 10, background: T.bg2, borderRadius: 12, padding: '0 13px', border: `1.5px solid ${T.border}` };
const campo = { flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: 15, fontWeight: 500, color: T.text, padding: '13px 0', minWidth: 0 };

// Lo que contesta Supabase Auth en inglés, dicho como se entiende.
function textoDeError(e) {
  const m = String(e?.message ?? e ?? '');
  if (/different from the old password|same_password/i.test(m)) return 'Elige una contraseña distinta a la actual.';
  if (/weak|pwned|compromised|easy to guess/i.test(m)) return 'Esa contraseña es muy fácil de adivinar o ya apareció en filtraciones. Elige otra.';
  if (/at least|should be/i.test(m)) return `Usa al menos ${MIN_CONTRASENA} caracteres.`;
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera un momento y vuelve a intentarlo.';
  return m || 'No se pudo cambiar la contraseña. Inténtalo de nuevo.';
}

function CampoDeClave({ id, texto, valor, onCambio, autoComplete, ver, onVer, autoFocus }) {
  return (
    <label htmlFor={id} style={{ display: 'block' }}>
      <div style={{ ...label, marginBottom: 7 }}>{texto}</div>
      <div style={caja}>
        <KeyRound size={18} color={T.text3} style={{ flexShrink: 0 }} />
        <input
          id={id} type={ver ? 'text' : 'password'} value={valor} onChange={(e) => onCambio(e.target.value)} autoComplete={autoComplete} autoFocus={autoFocus}
          autoCapitalize="none" autoCorrect="off" spellCheck={false} style={campo}
        />
        {onVer && (
          <button type="button" onClick={onVer} aria-label={ver ? 'Ocultar contraseña' : 'Ver contraseña'} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text3, padding: 4, display: 'grid', placeItems: 'center' }}>
            {ver ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        )}
      </div>
    </label>
  );
}

export default function CambiarContrasena() {
  const { user, profile } = useAuth();
  // Una cuenta que solo entra con Google no tiene contraseña que comprobar.
  const tieneContrasena = (user?.app_metadata?.providers ?? ['email']).includes('email') && user?.app_metadata?.provider !== 'google';
  const [abierto, setAbierto] = useState(false);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [ver, setVer] = useState(false);
  const [error, setError] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [hecho, setHecho] = useState(false);

  const titulo = tieneContrasena ? 'Cambiar contraseña' : 'Crear contraseña';
  const cierra = () => { setAbierto(false); setActual(''); setNueva(''); setRepetida(''); setError(''); setVer(false); };

  async function guardar(e) {
    e.preventDefault();
    setError('');
    setHecho(false);
    if (tieneContrasena && !actual) { setError('Escribe tu contraseña actual.'); return; }
    const problema = problemaDeContrasena(nueva, { actual, usuario: profile?.username, correo: user?.email });
    if (problema) { setError(problema); return; }
    if (nueva !== repetida) { setError('Las dos contraseñas nuevas no son iguales.'); return; }
    setGuardando(true);
    try {
      if (tieneContrasena) {
        const r = await fetch(LOGIN_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', apikey: ANON_KEY, Authorization: `Bearer ${ANON_KEY}` },
          body: JSON.stringify({ identificador: user.email, password: actual }),
        }).catch(() => null);
        if (!r) throw new Error('No se pudo comprobar tu contraseña actual. Revisa tu conexión.');
        if (r.status === 429) throw new Error('Demasiados intentos. Espera un momento y vuelve a intentarlo.');
        if (!r.ok) throw new Error('Tu contraseña actual no es correcta.');
      }
      const { error: err } = await supabase.auth.updateUser({ password: nueva });
      if (err) throw err;
      cierra();
      setHecho(true);
    } catch (err) {
      setError(textoDeError(err));
    } finally {
      setGuardando(false);
    }
  }

  return (
    <div style={{ border: `1.5px solid ${KP.lineHi}`, borderRadius: 14, background: T.bg2, overflow: 'hidden' }}>
      <button
        type="button" onClick={() => (abierto ? cierra() : setAbierto(true))} aria-expanded={abierto} className="kp-press"
        style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', minHeight: 56, padding: '0 14px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, textAlign: 'left', touchAction: 'manipulation' }}
      >
        <span style={{ width: 34, height: 34, borderRadius: 10, display: 'grid', placeItems: 'center', background: KP.blueSoft, color: KP.blue, flexShrink: 0 }}>
          <KeyRound size={18} />
        </span>
        <span style={{ flex: 1, fontSize: 14.5, fontWeight: 800, color: T.text }}>{titulo}</span>
        {hecho && !abierto && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12.5, fontWeight: 800, color: KP.mint }}><Check size={14} />Cambiada</span>}
        {abierto ? <ChevronDown size={17} color={T.text3} /> : <ChevronRight size={17} color={T.text3} />}
      </button>

      {abierto && (
        <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 14, padding: '4px 14px 16px' }}>
          {tieneContrasena && <CampoDeClave id="clave-actual" texto="Contraseña actual" valor={actual} onCambio={setActual} autoComplete="current-password" ver={ver} onVer={() => setVer((v) => !v)} autoFocus />}
          <CampoDeClave id="clave-nueva" texto="Contraseña nueva" valor={nueva} onCambio={setNueva} autoComplete="new-password" ver={ver} onVer={tieneContrasena ? undefined : () => setVer((v) => !v)} autoFocus={!tieneContrasena} />
          <CampoDeClave id="clave-repetida" texto="Repite la nueva" valor={repetida} onCambio={setRepetida} autoComplete="new-password" ver={ver} />
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text3, lineHeight: 1.4 }}>Al menos {MIN_CONTRASENA} caracteres, que no sea solo números ni de las más usadas.</div>
          {error && <div role="alert" style={{ background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 12, padding: '11px 15px', fontWeight: 700, fontSize: 13.5 }}>{error}</div>}
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              type="submit" disabled={guardando} className="kp-press"
              style={{ flex: 1, minHeight: 48, borderRadius: 14, border: 'none', background: KP.blue, color: '#fff', fontFamily: FONT, fontSize: 14.5, fontWeight: 800, cursor: guardando ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: guardando ? 0.8 : 1 }}
            >
              {guardando && <Loader2 size={17} className="spin" />}Guardar contraseña
            </button>
            <button type="button" onClick={cierra} className="kp-press" style={{ minHeight: 48, padding: '0 18px', borderRadius: 14, border: `1.5px solid ${KP.lineHi}`, background: T.bg2, color: T.text2, fontFamily: FONT, fontSize: 14.5, fontWeight: 800, cursor: 'pointer' }}>
              Cancelar
            </button>
          </div>
        </form>
      )}
      {hecho && !abierto && (
        <div role="status" style={{ padding: '0 14px 14px', fontSize: 13, fontWeight: 700, color: KP.mint }}>Tu contraseña se cambió. Úsala la próxima vez que entres.</div>
      )}
    </div>
  );
}
