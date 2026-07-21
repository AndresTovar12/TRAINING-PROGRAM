import { useState, useRef, useEffect } from 'react';
import { Dumbbell, Loader2, LogOut, Shield, User as UserIcon, UserCog } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { AppStateProvider } from '@/contexts/AppStateContext';
import { PlanProvider } from '@/contexts/PlanContext';
import AuthScreen from '@/features/auth/AuthScreen';
import TrainingApp from '@/features/training/TrainingApp';
import AdminApp from '@/features/admin/AdminApp';
import ProfileScreen from '@/features/profile/ProfileScreen';
import { T, FONT, KP } from '@/lib/theme';

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

export default function App() {
  const { loading, user, profile } = useAuth();

  if (loading) return <Splash />;
  if (!user) return <AuthScreen />;
  if (!profile) return <Splash label="Cargando tu perfil…" />;

  if (profile.role === 'admin') {
    return (
      <>
        <AdminApp />
        <AccountMenu />
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
      </PlanProvider>
    </AppStateProvider>
  );
}
