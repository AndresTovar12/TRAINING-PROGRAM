import { useState, useRef, useEffect } from 'react';
import { Dumbbell, Loader2, LogOut, Shield, User as UserIcon, UserCog, RefreshCw } from 'lucide-react';
import { useNewVersion } from '@/lib/useNewVersion';
import { useAuth } from '@/contexts/AuthContext';
import { useIsDesktop } from '@/lib/useViewport';
import { AppStateProvider } from '@/contexts/AppStateContext';
import { PlanProvider } from '@/contexts/PlanContext';
import AuthScreen from '@/features/auth/AuthScreen';
import LandingPage from '@/features/landing/LandingPage';
import TrainingApp from '@/features/training/TrainingApp';
import AdminApp from '@/features/admin/AdminApp';
import ProfileScreen from '@/features/profile/ProfileScreen';
import { FONT, KP } from '@/lib/theme';

function Splash({ label = 'Cargando…' }) {
  return (
    <div
      style={{
        minHeight: '100svh', display: 'flex', flexDirection: 'column', gap: 20,
        alignItems: 'center', justifyContent: 'center', fontFamily: FONT,
        background:
          'radial-gradient(1100px 620px at 50% -8%, #e7ecfe 0%, rgba(244,245,248,0) 60%), #f4f5f8',
      }}
    >
      <div
        className="kp-pulse"
        style={{
          width: 60, height: 60, borderRadius: 18, display: 'grid', placeItems: 'center',
          background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`,
          boxShadow: KP.shBtn,
        }}
      >
        <Dumbbell size={28} color="#fff" strokeWidth={2.4} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: KP.ink2, fontWeight: 600, fontSize: 14 }}>
        <Loader2 size={16} className="spin" /> {label}
      </div>
      <style>{`
        .spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
        .kp-pulse{animation:kp-pulse 1.8s ease-in-out infinite}
        @keyframes kp-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
        @media (prefers-reduced-motion: reduce){.kp-pulse{animation:none}}
      `}</style>
    </div>
  );
}

function AccountMenu() {
  const { profile, user, isAdmin, signOut } = useAuth();
  const [open, setOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const name = profile?.full_name || profile?.username || user?.email || 'Cuenta';
  const initial = (name[0] || 'U').toUpperCase();
  const avatar = profile?.avatar_url;

  return (
    <>
    <div ref={ref} style={{ position: 'fixed', top: 16, right: 16, zIndex: 1000, fontFamily: FONT }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Cuenta"
        className="kp-press"
        style={{
          width: 42, height: 42, borderRadius: 13, overflow: 'hidden', border: `1px solid ${KP.line}`,
          background: KP.surface, cursor: 'pointer', display: 'grid', placeItems: 'center',
          fontWeight: 800, color: KP.blue, fontSize: 15, padding: 0,
          boxShadow: KP.shCard,
        }}
      >
        {avatar ? (
          <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          initial
        )}
      </button>
      {open && (
        <div
          className="animate-fade-in"
          style={{
            position: 'absolute', top: 50, right: 0, minWidth: 236, background: KP.surface,
            borderRadius: 18, border: `1px solid ${KP.line}`, padding: 8,
            boxShadow: KP.shPop,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '8px 10px 12px' }}>
            <div
              style={{
                width: 40, height: 40, borderRadius: 12, overflow: 'hidden', flexShrink: 0,
                background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`,
                display: 'grid', placeItems: 'center', color: '#fff', fontWeight: 800, fontSize: 15,
              }}
            >
              {avatar ? <img src={avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 700, color: KP.ink, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
              <div
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 5,
                  fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8,
                  color: isAdmin ? KP.blue : KP.ink2,
                  background: isAdmin ? KP.blueSoft : KP.bg, borderRadius: 8,
                  padding: '3px 8px',
                }}
              >
                {isAdmin ? <Shield size={11} /> : <UserIcon size={11} />}
                {isAdmin ? 'Admin' : 'Atleta'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => { setProfileOpen(true); setOpen(false); }}
            className="kp-press"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px',
              borderRadius: 12, border: 'none', background: KP.bg, cursor: 'pointer',
              fontFamily: FONT, fontSize: 14, fontWeight: 600, color: KP.ink, textAlign: 'left',
              marginBottom: 4,
            }}
          >
            <UserCog size={16} color={KP.blue} /> Mi perfil
          </button>
          <button
            type="button"
            onClick={signOut}
            className="kp-press"
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 12px',
              borderRadius: 12, border: 'none', background: KP.dangerSoft, cursor: 'pointer',
              fontFamily: FONT, fontSize: 14, fontWeight: 600, color: KP.danger, textAlign: 'left',
            }}
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>
      )}
    </div>
    {profileOpen && <ProfileScreen onClose={() => setProfileOpen(false)} />}
    </>
  );
}

/** Aviso de versión nueva: aparece al detectar un deploy más reciente. */
function UpdateBanner() {
  const stale = useNewVersion();
  if (!stale) return null;
  return (
    <div
      className="animate-fade-in"
      style={{
        position: 'fixed', left: 12, right: 12, bottom: 'calc(12px + env(safe-area-inset-bottom))',
        zIndex: 4000, display: 'flex', alignItems: 'center', gap: 12,
        background: KP.surface, border: `1px solid ${KP.line}`, borderRadius: 16,
        padding: '12px 14px', boxShadow: KP.shPop, fontFamily: FONT,
        maxWidth: 520, marginInline: 'auto',
      }}
    >
      <span style={{ width: 34, height: 34, borderRadius: 11, flexShrink: 0, background: KP.blueSoft, color: KP.blue, display: 'grid', placeItems: 'center' }}>
        <RefreshCw size={17} />
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 14, fontWeight: 800, color: KP.ink, lineHeight: 1.2 }}>Hay una versión nueva</div>
        <div style={{ fontSize: 12.5, color: KP.ink2, marginTop: 2 }}>Actualiza para verla.</div>
      </div>
      <button
        type="button"
        onClick={() => window.location.reload()}
        className="kp-press"
        style={{
          flexShrink: 0, border: 'none', cursor: 'pointer', borderRadius: 12, padding: '11px 16px',
          background: `linear-gradient(135deg, ${KP.blue}, ${KP.blueDk})`, color: '#fff',
          fontFamily: FONT, fontSize: 14, fontWeight: 800, boxShadow: KP.shBtn,
        }}
      >
        Actualizar
      </button>
    </div>
  );
}

/**
 * Puerta de entrada para quien NO tiene sesion.
 *
 * En computadora se muestra primero la pagina de presentacion, porque ahi
 * suele llegar gente que todavia no conoce la app y una pantalla de
 * contraseña sola no le dice nada. En telefono NO: ahi entran los atletas,
 * que ya tienen cuenta y solo quieren su rutina del dia, asi que la pagina
 * de presentacion seria un estorbo entre ellos y su entrenamiento.
 */
function Entrada() {
  const esCompu = useIsDesktop();
  const [pantalla, setPantalla] = useState(null); // null | 'login' | 'register'

  if (esCompu && pantalla === null) {
    return (
      <LandingPage
        onEntrar={() => setPantalla('login')}
        onRegistrarse={() => setPantalla('register')}
      />
    );
  }
  return (
    <AuthScreen
      modoInicial={pantalla || 'login'}
      onVolver={esCompu ? () => setPantalla(null) : undefined}
    />
  );
}

export default function App() {
  const { loading, user, profile } = useAuth();

  if (loading) return <Splash />;
  if (!user) return <><Entrada /><UpdateBanner /></>;
  if (!profile) return <Splash label="Cargando tu perfil…" />;

  if (profile.role === 'admin') {
    return (
      <>
        <AdminApp />
        <AccountMenu />
        <UpdateBanner />
      </>
    );
  }

  // Todos los atletas usan la misma app completa; su plan viene de la
  // tabla `plans` (el de Andres migrado verbatim, el resto asignado por admin).
  return (
    <AppStateProvider>
      <PlanProvider>
        <TrainingApp />
        <AccountMenu />
        <UpdateBanner />
      </PlanProvider>
    </AppStateProvider>
  );
}
