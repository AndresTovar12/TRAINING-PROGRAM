import {
  createContext, useContext, useEffect, useState, useCallback, useMemo,
} from 'react';
import { supabase } from '@/lib/supabase';
import { updateProfile as apiUpdateProfile } from '@/lib/api';
import { olvidaLugar } from '@/lib/lugar';

const AuthContext = createContext(null);

const SIGNUP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signup`;
const LOGIN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/login`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/* EL ENLACE DE «OLVIDÉ MI CONTRASEÑA» (15 oct 2026). Supabase manda a la persona de vuelta a la app con `#…type=recovery` (enlace bueno) o `#error=…&error_code=otp_expired`
   (vencido o ya usado). Se lee AQUÍ, al cargar el archivo: el cliente de Supabase borra esa parte de la dirección en cuanto la procesa. */
const HASH = typeof window !== 'undefined' ? window.location.hash : '';
const ENLACE_DE_RECUPERACION = /[#&]type=recovery\b/.test(HASH);
const ENLACE_VENCIDO = /[#&]error_code=otp_expired\b/.test(HASH);

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  // Entró por el enlace de recuperar contraseña: lo único que se le enseña es «Pon una contraseña nueva» (ver `features/auth/NuevaContrasena.jsx`).
  const [recuperando, setRecuperando] = useState(ENLACE_DE_RECUPERACION);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  // El perfil no pudo cargarse tras varios intentos (señal mala, o la cuenta no tiene perfil): la pantalla de carga deja de girar sola y ofrece reintentar o salir (auditoría p43).
  const [perfilFalla, setPerfilFalla] = useState(false);
  const [intentoPerfil, setIntentoPerfil] = useState(0);

  // Bootstrap session + subscribe to auth changes
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((evento, sess) => {
      if (evento === 'PASSWORD_RECOVERY') setRecuperando(true);
      setSession(sess ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  /* Carga el perfil cada vez que cambia quien entró. Con mala señal ANTES se quedaba en «Cargando tu perfil…» para siempre, sin reintentar ni dar salida (auditoría p43, 17 oct
     2026). Ahora reintenta solo (3 veces, esperando 2 y 4 s) y, si no se logra, avisa (`perfilFalla`) para que la pantalla deje reintentar o salir. */
  useEffect(() => {
    let cancelled = false;
    const uid = session?.user?.id;
    if (!uid) {
      setProfile(null);
      setPerfilFalla(false);
      return undefined;
    }
    setPerfilFalla(false);
    (async () => {
      for (let intento = 0; intento < 3 && !cancelled; intento += 1) {
        if (intento > 0) await new Promise((r) => { setTimeout(r, intento * 2000); });
        if (cancelled) return;
        try {
          const { data, error } = await supabase.from('profiles').select('*').eq('id', uid).maybeSingle();
          if (cancelled) return;
          if (!error && data) { setProfile(data); return; }
        } catch { /* sin señal: se reintenta */ }
      }
      if (!cancelled) setPerfilFalla(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id, intentoPerfil]);

  /** «Reintentar» de la pantalla de carga del perfil. */
  const reintentaPerfil = useCallback(() => setIntentoPerfil((n) => n + 1), []);

  // Login with username OR email + password
  /**
   * Entrar con correo o con nombre de usuario.
   *
   * Con CORREO se entra directo contra Supabase Auth, como siempre.
   *
   * Con NOMBRE DE USUARIO hay que traducirlo a correo, y eso lo hace ahora una
   * función del servidor (`login`). Antes lo preguntaba el navegador con
   * `rpc/email_for_login`, que no pide sesión: cualquiera que supiera un nombre
   * de usuario obtenía el correo de esa persona. El de un coach se comparte
   * para registrarse, así que bastaba con eso.
   */
  const signIn = useCallback(async (identifier, password) => {
    const id = (identifier ?? '').trim();
    if (!id) return { error: { message: 'Ingresa tu usuario o correo' } };

    if (id.includes('@')) {
      const { error } = await supabase.auth.signInWithPassword({ email: id, password });
      if (error) {
        const msg = /invalid login credentials/i.test(error.message)
          ? 'Usuario o contraseña incorrectos'
          : error.message;
        return { error: { message: msg } };
      }
      return { error: null };
    }

    const res = await fetch(LOGIN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: ANON_KEY,
        Authorization: `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ identificador: id, password }),
    }).catch(() => null);
    if (!res) return { error: { message: 'No se pudo contactar al servidor. Revisa tu conexión.' } };

    const body = await res.json().catch(() => ({}));
    if (!res.ok) return { error: { message: body?.error || 'Usuario o contraseña incorrectos' } };

    // La función devuelve la sesión ya abierta; aquí solo se guarda.
    const { error } = await supabase.auth.setSession({
      access_token: body.access_token,
      refresh_token: body.refresh_token,
    });
    return { error: error ? { message: error.message } : null };
  }, []);

  // Register via Edge Function (creates a confirmed user), then auto sign-in
  const signUp = useCallback(async ({ username, email, password, fullName, accountType, coachUsername, genero, profesion, inicioPaso }) => {
    let res;
    try {
      res = await fetch(SIGNUP_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: ANON_KEY,
          Authorization: `Bearer ${ANON_KEY}`,
        },
        body: JSON.stringify({
          username,
          email: email || undefined,
          password,
          full_name: fullName || undefined,
          account_type: accountType || 'athlete',
          coach_username: coachUsername || undefined,
          genero: genero || undefined,
          profesion: profesion || undefined,
          // El inicio nuevo pregunta lo demás DESPUÉS, pantalla por pantalla (ver `features/inicio`).
          inicio_paso: inicioPaso || undefined,
        }),
      });
    } catch {
      return { error: { message: 'No se pudo conectar con el servidor' } };
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Red de seguridad: si el servidor manda un error vacio o un objeto, no
      // se le enseña "{}" a la persona (paso de verdad). Se prefiere un texto
      // que al menos diga que hacer.
      const crudo = body?.error;
      const texto = typeof crudo === 'string' && crudo.trim() && crudo.trim() !== '{}'
        ? crudo
        : `No se pudo crear la cuenta (error ${res.status}). Inténtalo de nuevo, y si sigue igual avísale al administrador.`;
      return { error: { message: texto } };
    }

    const loginEmail = body?.email || email;
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });
    return { error: error ? { message: error.message } : null };
  }, []);

  /* Entrar con Google.
     APAGADO hasta que existan las llaves: el botón solo se dibuja si
     `VITE_GOOGLE_LOGIN` vale "1", y Supabase además tiene que tener el
     proveedor encendido. Ver `docs/entrar-con-google.md`.

     No hace falta nada más en la app: Supabase crea la cuenta y el disparador
     `handle_new_user` le arma el perfil con un usuario sacado del correo (ya
     sin choques ni caracteres raros, migración `usuario_automatico_sin_choques`).
     Quien entre así puede cambiarse el usuario en "Mi perfil". */
  const entrarConGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
    if (error) return { error: { message: 'No se pudo abrir la entrada con Google.' } };
    return { error: null };
  }, []);

  // Cierra SOLO esta sesión. Sin `scope`, Supabase cierra TODAS las del usuario
  // ("global"), y eso incluye los permisos que dio a su IA (ChatGPT, Claude,
  // Codex, Hermes): el 26 sep 2026 Andrés cerró sesión en la compu y a su
  // ChatGPT se le murió la conexión ("refresh token not found"). Para quitarle
  // el acceso a una IA está "Desconectar" en Conectar con IA.
  const signOut = useCallback(async () => {
    // Quien entre después no hereda el lugar donde estaba esta persona.
    olvidaLugar();
    await supabase.auth.signOut({ scope: 'local' });
    setProfile(null);
  }, []);

  // Actualiza el perfil propio y refleja el cambio en memoria al instante.
  const updateProfile = useCallback(async (patch) => {
    const uid = session?.user?.id;
    if (!uid) return { error: { message: 'Sesión no válida' } };
    try {
      const row = await apiUpdateProfile(uid, patch);
      setProfile(row);
      return { error: null, profile: row };
    } catch (e) {
      return { error: { message: e.message || 'No se pudo guardar' } };
    }
  }, [session?.user?.id]);

  const refreshProfile = useCallback(async () => {
    const uid = session?.user?.id;
    if (!uid) return;
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle();
    setProfile(data ?? null);
  }, [session?.user?.id]);

  /** Pide el enlace para poner una contraseña nueva. NO dice si el correo existe (`AVISO_ENLACE_ENVIADO` es el mismo siempre). Regresa `{ error }`. */
  const pedirRecuperacion = useCallback(async (correo) => {
    const { error } = await supabase.auth.resetPasswordForEmail(String(correo ?? '').trim(), { redirectTo: `${window.location.origin}/` });
    return { error };
  }, []);

  /** Ya con el enlace abierto: pone la contraseña nueva y deja entrar. Regresa `{ error }`. */
  const ponerContrasenaNueva = useCallback(async (nueva) => {
    const { error } = await supabase.auth.updateUser({ password: nueva });
    if (!error) setRecuperando(false);
    return { error };
  }, []);

  /** «Mejor no»: se sale de la pantalla de contraseña nueva y se cierra esa sesión de recuperación. */
  const cancelarRecuperacion = useCallback(async () => {
    setRecuperando(false);
    await supabase.auth.signOut();
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      isAdmin: profile?.role === 'admin',
      loading,
      perfilFalla,
      reintentaPerfil,
      signIn,
      signUp,
      signOut,
      entrarConGoogle,
      googleDisponible: import.meta.env.VITE_GOOGLE_LOGIN === '1',
      updateProfile,
      refreshProfile,
      recuperando,
      enlaceVencido: ENLACE_VENCIDO,
      pedirRecuperacion,
      ponerContrasenaNueva,
      cancelarRecuperacion,
    }),
    [session, profile, loading, perfilFalla, reintentaPerfil, signIn, signUp, signOut, entrarConGoogle, updateProfile, refreshProfile, recuperando, pedirRecuperacion, ponerContrasenaNueva, cancelarRecuperacion],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
