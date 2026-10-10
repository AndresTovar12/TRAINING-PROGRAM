import { useRef, useState } from 'react';
import {
  Dumbbell, Users, Library, Shield, PanelLeftClose, PanelLeft, Eye, X, Sparkles, FolderOpen, MessageCircle,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMensajes } from '@/contexts/MensajesContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { useIsDesktop } from '@/lib/useViewport';
import { useLugar } from '@/lib/useLugar';
import { T, FONT, KP, oficioCorto } from '@/lib/theme';
import AthletesPanel from '@/features/admin/AthletesPanel';
import ExercisesPanel from '@/features/admin/ExercisesPanel';
import CoachesPanel from '@/features/admin/CoachesPanel';
import MisPlanesPanel from '@/features/misplanes/MisPlanesPanel';
import VistaComoAtleta from '@/features/admin/VistaComoAtleta';
import ConectarIA from '@/features/ia/ConectarIA';
import MensajesDelCoach from '@/features/mensajes/MensajesDelCoach';
import { NumeroRojo } from '@/features/mensajes/piezas';

const SIDEBAR_W = 232;

export default function AdminApp({ onAbrirPerfil }) {
  const { profile } = useAuth();
  const { t } = usePalabras();
  const { sinLeer } = useMensajes();
  const isMaster = !!profile?.is_owner;
  const isDesktop = useIsDesktop();
  // La pestaña se recuerda al refrescar (ver `lugar.js`). Puede venir de una
  // sesión con otros permisos —una pestaña de coaches que ya no te toca, o la
  // de IA que en el teléfono no existe—, así que se comprueba abajo contra
  // las que de verdad hay.
  const [tabGuardada, setTab] = useLugar('admin.tab', 'athletes', (t) => typeof t === 'string');
  const [menuOpen, setMenuOpen] = useState(true);

  /* "Ver como" un coach: el master mira SUS atletas y SU repertorio, sin salir
     de su propia sesión.

     Andrés lo pidió así —"un botón en cada coach para meterme a visualizar el
     perfil como si yo fuera ese coach"— y va junto con el cambio de que su
     repertorio deje de incluir el de todos: para revisar el de un coach se
     entra aquí, no se le mezcla en la lista propia.

     NO es entrar con su cuenta. No se toca la sesión ni la contraseña de
     nadie: es un filtro sobre datos que el master ya puede leer. La diferencia
     importa el día que algo salga mal — en los registros del servidor las
     acciones siguen apareciendo a nombre del master, que es quien las hizo. */
  const [viendoComo, setViendoComo] = useLugar(
    'admin.viendoComo', null,
    (v) => isMaster && !!v && typeof v.id === 'string' && typeof v.nombre === 'string',
  ); // { id, nombre } | null

  /* "Ver como" un ATLETA: su app de entrenamiento, tal cual la ve él. Lo puede
     hacer su coach, y el master con cualquiera. Andrés: "así no tengo que
     estar saltando entre cuentas".

     El panel NO se desmonta mientras tanto: se esconde. Así al salir vuelves a
     la misma ficha, con el mismo filtro y a la misma altura, en vez de empezar
     de cero desde la lista. */
  const [viendoAtleta, setViendoAtleta] = useState(null); // perfil del atleta | null
  const alturaDelPanel = useRef(0);
  const entrarComoAtleta = (atleta) => {
    alturaDelPanel.current = window.scrollY;
    setViendoAtleta(atleta);
    window.scrollTo(0, 0);
  };
  const salirDeAtleta = () => {
    setViendoAtleta(null);
    requestAnimationFrame(() => window.scrollTo(0, alturaDelPanel.current));
  };

  const TABS = [
    { id: 'athletes', label: t(isMaster ? 'Atletas' : 'Mis atletas'), icon: Users },
    // Los mensajes son de CADA cuenta: mientras el master mira como otro coach no se enseñan los suyos.
    ...(!viendoComo ? [{ id: 'messages', label: 'Mensajes', icon: MessageCircle, numero: sinLeer }] : []),
    { id: 'exercises', label: 'Ejercicios', icon: Library },
    /* Mis planes: lo que cada profesional guarda (workouts, rutinas semanales y programas), en carpetas, con
       su «+ Crear» y su «Asignar» (Andrés, 2 oct 2026). Es de CADA quien, así que desaparece mientras el
       master mira como otro coach: no tiene caso enseñarle lo suyo en lugar de lo del coach. */
    ...(!viendoComo ? [{ id: 'misplanes', label: 'Mis planes', icon: FolderOpen }] : []),
    /* La pestaña de coaches desaparece mientras el master mira como uno de
       ellos. Andrés, 18 sep 2026: "sigue apareciendo la columna de coaches, lo
       cual no es congruente porque eso solo le aparece al admin; no se
       distingue la diferencia entre la cuenta del admin y la del coach".
       El contenido ya estaba protegido (`tab === 'coaches' && isMaster &&
       !viendoComo`), pero la pestaña seguía ahí y eso basta para que la
       simulación deje de parecerse a lo que ve el coach de verdad. */
    ...(isMaster && !viendoComo ? [{ id: 'coaches', label: 'Profesionales', icon: Shield }] : []),
    /* Conectar con la IA: en la compu vive aquí, en el menú lateral. En el
       teléfono NO va en la navegación (decisión de Andrés): va en "Mi perfil". */
    ...(isDesktop && !viendoComo ? [{ id: 'ia', label: 'Conectar con IA', icon: Sparkles }] : []),
  ];
  const tab = TABS.some((t) => t.id === tabGuardada) ? tabGuardada : 'athletes';

  const entrarComo = (coach) => {
    setViendoComo({ id: coach.id, nombre: coach.full_name || coach.username });
    setTab('athletes');
  };

  const content = (
    <>
      {viendoComo && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16,
          background: T.accentBg, border: `1.5px solid ${T.accent}44`,
          borderRadius: 13, padding: '11px 14px',
        }}>
          <Eye size={17} color={T.accent} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* Una línea con puntos suspensivos: un nombre largo partido en seis
                renglones convierte el aviso en el elemento más grande de la
                pantalla, justo encima de lo que se venía a ver. */}
            <div style={{
              fontSize: 13.5, fontWeight: 700, color: T.accent,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              Viendo como {viendoComo.nombre}
            </div>
            <div style={{
              fontSize: 11.5, fontWeight: 600, color: T.text2, marginTop: 2,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              Sus atletas y su repertorio. No estás en su cuenta.
            </div>
          </div>
          <button
            type="button" onClick={() => setViendoComo(null)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0,
              minHeight: 38, padding: '0 13px', borderRadius: 10, cursor: 'pointer',
              border: 'none', background: T.bg2, color: T.text2,
              fontFamily: FONT, fontSize: 13, fontWeight: 700,
            }}
          >
            <X size={15} /> Salir
          </button>
        </div>
      )}

      {tab === 'messages' && !viendoComo && <MensajesDelCoach />}
      {tab === 'athletes' && <AthletesPanel viendoComo={viendoComo} onVerComoAtleta={entrarComoAtleta} onIrA={setTab} onAbrirPerfil={onAbrirPerfil} />}
      {tab === 'exercises' && <ExercisesPanel viendoComo={viendoComo} />}
      {tab === 'misplanes' && !viendoComo && <MisPlanesPanel />}
      {tab === 'coaches' && isMaster && !viendoComo && <CoachesPanel onVerComo={entrarComo} />}
      {tab === 'ia' && isDesktop && !viendoComo && <ConectarIA />}
    </>
  );

  const vistaDeAtleta = viendoAtleta && (
    <VistaComoAtleta key={viendoAtleta.id} atleta={viendoAtleta} onSalir={salirDeAtleta} />
  );

  /* ------------------------- Teléfono: pestañas arriba ------------------------ */
  if (!isDesktop) {
    return (
      <>
      {vistaDeAtleta}
      <div style={{ minHeight: '100svh', background: T.bg, fontFamily: FONT, ...(viendoAtleta ? { display: 'none' } : {}) }}>
        <header
          style={{
            position: 'sticky', top: 0, zIndex: 50, background: 'rgba(255,255,255,0.82)',
            backdropFilter: 'saturate(180%) blur(16px)', borderBottom: `1px solid ${T.border}`,
          }}
        >
          {/* El botón de cuenta va fijo arriba a la derecha: se le deja su hueco (68) y un
              oficio largo («Fisioterapeuta deportivo») baja a un segundo renglón en vez de
              quedar escondido debajo de él. */}
          <div style={{ padding: '14px 68px 14px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
            <Brand />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: -0.3, color: T.text, lineHeight: 1.2 }}>
                Training Lab · {isMaster ? 'Master' : (oficioCorto(profile?.profesion) || 'Coach')}
              </div>
              <div style={{ fontSize: 12.5, fontWeight: 500, color: T.text2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {profile?.full_name || (isMaster ? 'Administrador' : 'Entrenador')}
              </div>
            </div>
          </div>
          <div style={{ padding: '0 20px', overflowX: 'auto' }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {TABS.map(({ id, label, icon: Icon, numero }) => {
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
                    <Icon size={17} /> {label}<NumeroRojo n={numero} tam={18} />
                  </button>
                );
              })}
            </div>
          </div>
        </header>
        <main style={{ padding: '20px 16px 80px' }}>{content}</main>
      </div>
      </>
    );
  }

  /* ---------------------- Computadora: menú lateral fijo --------------------- */
  return (
    <>
    {vistaDeAtleta}
    <div style={{ minHeight: '100svh', background: T.bg, fontFamily: FONT, display: viendoAtleta ? 'none' : 'flex' }}>
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
              <div style={{ fontSize: 11.5, fontWeight: 600, color: T.text3 }}>{isMaster ? 'Master' : (oficioCorto(profile?.profesion) || 'Coach')}</div>
            </div>
          </div>

          <nav style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {TABS.map(({ id, label, icon: Icon, numero }) => {
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
                  <Icon size={17} /> {label}<NumeroRojo n={numero} tam={18} style={{ marginLeft: 'auto' }} />
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
    </>
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
