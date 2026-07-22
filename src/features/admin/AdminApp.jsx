import { useState } from 'react';
import { Dumbbell, Users, Library, Shield } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { T, FONT, KP } from '@/lib/theme';
import AthletesPanel from '@/features/admin/AthletesPanel';
import ExercisesPanel from '@/features/admin/ExercisesPanel';
import CoachesPanel from '@/features/admin/CoachesPanel';

export default function AdminApp() {
  const { profile } = useAuth();
  const isMaster = !!profile?.is_owner;
  const TABS = [
    { id: 'athletes', label: isMaster ? 'Atletas' : 'Mis atletas', icon: Users },
    { id: 'exercises', label: 'Ejercicios', icon: Library },
    ...(isMaster ? [{ id: 'coaches', label: 'Coaches', icon: Shield }] : []),
  ];
  const [tab, setTab] = useState('athletes');

  return (
    <div style={{ minHeight: '100svh', background: T.bg, fontFamily: FONT }}>
      {/* Header */}
      <header
        style={{
          position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.82)',
          backdropFilter: 'saturate(180%) blur(16px)', borderBottom: `1px solid ${T.border}`,
        }}
      >
        <div
          style={{
            maxWidth: 1100, margin: '0 auto', padding: '14px 20px',
            display: 'flex', alignItems: 'center', gap: 14,
          }}
        >
          <div
            style={{
              width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center',
              background: `linear-gradient(140deg, ${T.accent}, ${T.accentDk})`,
              boxShadow: KP.shBtn,
            }}
          >
            <Dumbbell size={20} color="#fff" strokeWidth={2.4} />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.3, color: T.text }}>
              Training Lab · {isMaster ? 'Master' : 'Coach'}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 500, color: T.text2 }}>
              {profile?.full_name || (isMaster ? 'Administrador' : 'Entrenador')}
            </div>
          </div>
        </div>

        {/* Tab nav */}
        <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 20px' }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {TABS.map(({ id, label, icon: Icon }) => {
              const active = tab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setTab(id)}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px',
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    fontFamily: FONT, fontSize: 14.5, fontWeight: 700,
                    color: active ? T.accent : T.text2,
                    borderBottom: `2.5px solid ${active ? T.accent : 'transparent'}`,
                    transition: 'color .15s, border-color .15s',
                  }}
                >
                  <Icon size={17} /> {label}
                </button>
              );
            })}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 20px 80px' }}>
        {tab === 'athletes' && <AthletesPanel />}
        {tab === 'exercises' && <ExercisesPanel />}
        {tab === 'coaches' && isMaster && <CoachesPanel />}
      </main>
    </div>
  );
}
