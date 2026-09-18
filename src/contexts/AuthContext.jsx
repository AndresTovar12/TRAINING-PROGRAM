import {
  createContext, useContext, useEffect, useState, useCallback, useMemo,
} from 'react';
import { supabase } from '@/lib/supabase';
import { updateProfile as apiUpdateProfile } from '@/lib/api';

const AuthContext = createContext(null);

const SIGNUP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signup`;
const LOGIN_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/login`;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Bootstrap session + subscribe to auth changes
  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session ?? null);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess ?? null);
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  // Load profile whenever the authenticated user changes
  useEffect(() => {
    let cancelled = false;
    const uid = session?.user?.id;
    if (!uid) {
      setProfile(null);
      return;
    }
    (async () => {
      const { data } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', uid)
        .maybeSingle();
      if (!cancelled) setProfile(data ?? null);
    })();
    return () => {
      cancelled = true;
    };
  }, [session?.user?.id]);

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
  const signUp = useCallback(async ({ username, email, password, fullName, accountType, coachUsername, genero, profesion }) => {
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

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
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

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      isAdmin: profile?.role === 'admin',
      loading,
      signIn,
      signUp,
      signOut,
      entrarConGoogle,
      googleDisponible: import.meta.env.VITE_GOOGLE_LOGIN === '1',
      updateProfile,
      refreshProfile,
    }),
    [session, profile, loading, signIn, signUp, signOut, entrarConGoogle, updateProfile, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
