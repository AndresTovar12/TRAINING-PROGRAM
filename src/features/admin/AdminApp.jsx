import { useState } from 'react';
import {
  Dumbbell, Users, Library, Shield, PanelLeftClose, PanelLeft,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsDesktop } from '@/lib/useViewport';
import { T, FONT, KP } from '@/lib/theme';
import AthletesPanel from '@/features/admin/AthletesPanel';
import ExercisesPanel from '@/features/admin/ExercisesPanel';
import CoachesPanel from '@/features/admin/CoachesPanel';

const SIDEBAR_W = 232;

export default function AdminApp() {
  const { profile } = useAuth();
  const isMaster = !!profile?.is_owner;
  const isDesktop = useIsDesktop();
  const [tab, setTab] = useState('athletes');
  const [menuOpen, setMenuOpen] = useState(true);

  const TABS = [
    { id: 'athletes', label: isMaster ? 'Atletas' : 'Mis atletas', icon: Users },
    { id: 'exercises', label: 'Ejercicios', icon: Library },
    ...(isMaster ? [{ id: 'coaches', label: 'Coaches', icon: Shield }] : []),
  ];

  const content = (
    <>
      {tab === 'athletes' && <AthletesPanel />}
      {tab === 'exercises' && <ExercisesPanel />}
      {tab === 'coaches' && isMaster && <CoachesPanel />}
    </>
  );

  /* ------------------------- Teléfono: pestañas arriba ------------------------ */
  if (!isDesktop) {
    return (
      <div style={{ minHeight: '100svh', background: T.bg, fontFamily: FONT }}>
        <header
          style={{
            position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.82)',
            backdropFilter: 'saturate(180%) blur(16px)', borderBottom: `1px solid ${T.border}`,
          }}
        >
          <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <Brand />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.3, color: T.text }}>
                Training Lab · {isMaster ? 'Master' : 'Coach'}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.full_name || (isMaster ? 'Administrador' : 'Entrenador')}
              </div>
            </div>
          </div>
          <div style={{ padding: '0 20px', overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {TABS.map(({ id, label, icon: Icon }) => {
                const active = tab === id;
                return (
                  <button
                    key={id} type="button" onClick={() => setTab(id)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
                      border: 'none', background: 'transparent', cursor: 'pointer', whiteSpace: 'nowrap',
                      fontFamily: FONT, fontSize: 14.5, fontWeight: 700,
                      color: active ? T.accent : T.text2,
                      borderBottom: `2.5px solid ${active ? T.accent : 'transparent'}`,
                    }}
                  >
                    <Icon size={17} /> {label}
                  </button>
                );
              })}
            </div>
          </div>
        </header>
        <main style={{ padding: '20px 16px 80px' }}>{content}</main>
      </div>
    );
  }

  /* ---------------------- Computadora: menú lateral fijo --------------------- */
  return (
    <div style={{ minHeight: '100svh', background: T.bg, fontFamily: FONT, display: 'flex' }}>
      {/* Menú lateral */}
      {menuOpen && (
        <aside
          style={{
            width: SIDEBAR_W, flexShrink: 0, background: T.bg2, borderRight: `1px solid ${T.border}`,
            position: 'sticky', top: 0, height: '100svh', display: 'flex', flexDirection: 'column',
            padding: '16px 12px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '0 6px 18px' }}>
            <Brand />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, letterSpacing: -0.2, color: T.text }}>Training Lab</div>
              <div style={{ fontSize: 11.5, fontWeight: 600, color: T.text3 }}>{isMaster ? 'Master' : 'Coach'}</div>
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id} type="button" onClick={() => setTab(id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                    borderRadius: 10, cursor: 'pointer', textAlign: 'left', width: '100%',
                    border: 'none', borderLeft: `3px solid ${active ? T.accent : 'transparent'}`,
                    background: active ? T.accentBg : 'transparent',
                    color: active ? T.accent : T.text2,
                    fontFamily: FONT, fontSize: 14, fontWeight: active ? 800 : 600,
                  }}
                >
                  <Icon size={17} /> {label}
                </button>
              );
            })}
          </nav>

          <div style={{ flex: 1 }} />

          <div style={{ borderTop: `1px solid ${T.border}`, paddingTop: 12, display: 'flex', alignItems: 'center', gap: 10 }}>
            <div
              style={{
                width: 32, height: 32, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
                background: T.accentBg, color: T.accent, display: 'grid', placeItems: 'center',
                fontWeight: 800, fontSize: 13,
              }}
            >
              {profile?.avatar_url
                ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (profile?.full_name?.[0] || 'A').toUpperCase()}
            </div>
            <div style={{ minWidth: 0, fontSize: 12.5, fontWeight: 700, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {profile?.full_name || 'Cuenta'}
            </div>
          </div>
        </aside>
      )}

      {/* Zona de trabajo */}
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            position: 'sticky', top: 0, zIndex: 40, background: 'rgba(255,255,255,0.86)',
            backdropFilter: 'saturate(180%) blur(16px)', borderBottom: `1px solid ${T.border}`,
            padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 12,
          }}
        >
          <button
            type="button"
            onClick={() => setMenuOpen((v) => !v)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer',
              background: 'transparent', color: T.accent, fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
              padding: '6px 4px',
            }}
          >
            {menuOpen ? <PanelLeftClose size={17} /> : <PanelLeft size={17} />}
            {menuOpen ? 'Ocultar menú' : 'Mostrar menú'}
          </button>
          <span style={{ flex: 1 }} />
        </header>

        <main style={{ flex: 1, padding: '24px 24px 60px', minWidth: 0 }}>{content}</main>
      </div>
    </div>
  );
}

function Brand() {
  return (
    <div
      style={{
        width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', flexShrink: 0,
        background: `linear-gradient(140deg, ${T.accent}, ${T.accentDk})`, boxShadow: KP.shBtn,
      }}
    >
      <Dumbbell size={20} color="#fff" strokeWidth={2.4} />
    </div>
  );
}
