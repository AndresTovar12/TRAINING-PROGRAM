import {
  createContext, useContext, useEffect, useState, useCallback, useMemo,
} from 'react';
import { supabase } from '@/lib/supabase';
import { updateProfile as apiUpdateProfile } from '@/lib/api';

const AuthContext = createContext(null);

const SIGNUP_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signup`;
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
  const signIn = useCallback(async (identifier, password) => {
    const id = (identifier ?? '').trim();
    if (!id) return { error: { message: 'Ingresa tu usuario o correo' } };

    // Resolve username/email → canonical email via SECURITY DEFINER RPC
    let email = id;
    const { data: resolved } = await supabase.rpc('email_for_login', { identifier: id });
    if (resolved) email = resolved;
    else if (!id.includes('@')) {
      return { error: { message: 'Usuario o contraseña incorrectos' } };
    }

    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      const msg = /invalid login credentials/i.test(error.message)
        ? 'Usuario o contraseña incorrectos'
        : error.message;
      return { error: { message: msg } };
    }
    return { error: null };
  }, []);

  // Register via Edge Function (creates a confirmed user), then auto sign-in
  const signUp = useCallback(async ({ username, email, password, fullName, accountType, coachUsername }) => {
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
        }),
      });
    } catch {
      return { error: { message: 'No se pudo conectar con el servidor' } };
    }

    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      return { error: { message: body?.error || 'Error al registrar' } };
    }

    const loginEmail = body?.email || email;
    const { error } = await supabase.auth.signInWithPassword({
      email: loginEmail,
      password,
    });
    return { error: error ? { message: error.message } : null };
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
      updateProfile,
      refreshProfile,
    }),
    [session, profile, loading, signIn, signUp, signOut, updateProfile, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de <AuthProvider>');
  return ctx;
}
