import { useState } from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { problemaDeContrasena, MIN_CONTRASENA } from '@/lib/contrasena';
import { FONT, KP } from '@/lib/theme';
import HojaFlotante from '@/components/HojaFlotante';
import { Boton, Campo, Fila } from '@/components/ui';
import { Aviso } from '@/features/profile/piezas';

/* «Cambiar contraseña» en Mi perfil (pedido 30 sep 2026; urgente el 10 oct 2026 por las contraseñas que estuvieron en el repositorio público).

   Antes la app NO dejaba cambiarla: solo por SQL. Aquí se escribe la actual (si la cuenta tiene una), la nueva dos veces y se guarda con Supabase Auth.
   La actual se comprueba con la función `login` (la misma que usa «Entrar»): así NO se abre otra sesión en este aparato ni se cierra la que está abierta.
   Una cuenta que entró solo con Google no tiene contraseña: ahí es «Crear contraseña» y no pide la actual. */

const LOGIN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/login`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Lo que contesta Supabase Auth en inglés, dicho como se entiende.
function textoDeError(e) {
  const m = String(e?.message ?? e ?? '');
  if (/different from the old password|same_password/i.test(m)) return 'Elige una contraseña distinta a la actual.';
  if (/weak|pwned|compromised|easy to guess/i.test(m)) return 'Esa contraseña es muy fácil de adivinar o ya apareció en filtraciones. Elige otra.';
  if (/at least|should be/i.test(m)) return `Usa al menos ${MIN_CONTRASENA} caracteres.`;
  if (/rate limit|too many/i.test(m)) return 'Demasiados intentos. Espera un momento y vuelve a intentarlo.';
  return m || 'No se pudo cambiar la contraseña. Inténtalo de nuevo.';
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
        /* Comprobarla abrió una sesión de verdad que nadie cerraba (p134). Se cierra SOLO esa (`scope=local`), no la de esta persona. */
        const sesionDeLaPrueba = await r.json().catch(() => null);
        if (sesionDeLaPrueba?.access_token) {
          fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/logout?scope=local`, {
            method: 'POST', headers: { apikey: ANON_KEY, Authorization: `Bearer ${sesionDeLaPrueba.access_token}` },
          }).catch(() => {});
        }
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

  /* Reestructura visual (15 oct 2026): un renglón «Cambiar contraseña ›» que abre una hoja con los campos. */
  return (
    <>
      <Fila texto={titulo} detalle={hecho ? 'Listo: tu contraseña se cambió.' : null} onClick={() => setAbierto(true)} />
      {abierto && (
        <HojaFlotante titulo={titulo} onCerrar={cierra} ancho={460}>
          <form onSubmit={guardar} style={{ display: 'flex', flexDirection: 'column', gap: 12, fontFamily: FONT }}>
            {tieneContrasena && <Campo etiqueta="Contraseña actual" tipo={ver ? 'text' : 'password'} grande={false} valor={actual} onCambio={setActual} autoComplete="current-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus />}
            <Campo etiqueta="Contraseña nueva" tipo={ver ? 'text' : 'password'} grande={false} valor={nueva} onCambio={setNueva} autoComplete="new-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoFocus={!tieneContrasena} />
            <Campo etiqueta="Repite la nueva" tipo={ver ? 'text' : 'password'} grande={false} valor={repetida} onCambio={setRepetida} autoComplete="new-password" autoCapitalize="none" autoCorrect="off" spellCheck={false} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, margin: '0 4px' }}>
              <span style={{ fontSize: 13, fontWeight: 500, color: KP.ink2, lineHeight: 1.4 }}>Al menos {MIN_CONTRASENA} caracteres.</span>
              <Boton tipo="texto" chico icono={ver ? EyeOff : Eye} onClick={() => setVer((v) => !v)}>{ver ? 'Ocultar' : 'Ver'}</Boton>
            </div>
            {error && <Aviso tono="malo" role="alert">{error}</Aviso>}
            <Boton ancho type="submit" cargando={guardando}>Guardar contraseña</Boton>
          </form>
        </HojaFlotante>
      )}
    </>
  );
}
