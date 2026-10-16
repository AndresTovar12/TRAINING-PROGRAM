import { useMemo, useRef, useState } from 'react';
import {
  Users, Library, Shield, PanelLeftClose, PanelLeft, Eye, X, Sparkles, FolderOpen, MessageCircle, Store, FlaskConical, Coins, Menu,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useMensajes } from '@/contexts/MensajesContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { useIsDesktop } from '@/lib/useViewport';
import { useLugar } from '@/lib/useLugar';
import { T, FONT, KP, UI, oficioCorto } from '@/lib/theme';
import AthletesPanel from '@/features/admin/AthletesPanel';
import ExercisesPanel from '@/features/admin/ExercisesPanel';
import CoachesPanel from '@/features/admin/CoachesPanel';
import CuentasDePrueba from '@/features/admin/CuentasDePrueba';
import Monetizacion from '@/features/admin/Monetizacion';
import MisPlanesPanel from '@/features/misplanes/MisPlanesPanel';
import MiVitrina from '@/features/vitrina/MiVitrina';
import VistaComoAtleta from '@/features/admin/VistaComoAtleta';
import ConectarIA from '@/features/ia/ConectarIA';
import MensajesDelCoach from '@/features/mensajes/MensajesDelCoach';
import { BarraInferior, BarraLateral, CabeceraConBanda, EnBanda, Fila, Grupo, IconoDeFila } from '@/components/ui';

const SIDEBAR_W = 248;

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
  // Lo que cada sección manda a su cabecera: el detalle bajo el título y su botón (ver `useCabeceraDeSeccion`).
  const [cabecera, ponCabecera] = useState(null);
  const banda = useMemo(() => ({ ponCabecera }), []);

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
    /* Mi vitrina: los planes que se ponen a la venta (monetización). Es de CADA profesional (Andrés, 12 oct 2026; el 11 oct era solo del dueño), así que, como Mis planes,
       desaparece mientras el master mira como otro coach. */
    ...(!viendoComo ? [{ id: 'vitrina', label: 'Mi vitrina', icon: Store }] : []),
    /* La pestaña de coaches desaparece mientras el master mira como uno de
       ellos. Andrés, 18 sep 2026: "sigue apareciendo la columna de coaches, lo
       cual no es congruente porque eso solo le aparece al admin; no se
       distingue la diferencia entre la cuenta del admin y la del coach".
       El contenido ya estaba protegido (`tab === 'coaches' && isMaster &&
       !viendoComo`), pero la pestaña seguía ahí y eso basta para que la
       simulación deje de parecerse a lo que ve el coach de verdad. */
    ...(isMaster && !viendoComo ? [{ id: 'coaches', label: 'Profesionales', icon: Shield }] : []),
    // Cuentas de prueba (14 oct 2026): solo el dueño; crea, enseña la contraseña y borra cuentas zz_… para probar.
    ...(isMaster && !viendoComo ? [{ id: 'pruebas', label: 'Cuentas de prueba', icon: FlaskConical }] : []),
    // Monetización (14 oct 2026): atletas gratis, paquetes de lugares y ventas. Solo el dueño.
    ...(isMaster && !viendoComo ? [{ id: 'monetizacion', label: 'Monetización', icon: Coins }] : []),
    /* Conectar con la IA: en la compu vive aquí, en el menú lateral. En el
       teléfono NO va en la navegación (decisión de Andrés): va en "Mi perfil". */
    ...(isDesktop && !viendoComo ? [{ id: 'ia', label: 'Conectar con IA', icon: Sparkles }] : []),
  ];
  const tab = TABS.some((t) => t.id === tabGuardada) ? tabGuardada : (tabGuardada === 'mas' && !isDesktop ? 'mas' : 'athletes');

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
      {tab === 'vitrina' && !viendoComo && <MiVitrina />}
      {tab === 'coaches' && isMaster && !viendoComo && <CoachesPanel onVerComo={entrarComo} />}
      {tab === 'monetizacion' && isMaster && !viendoComo && <Monetizacion />}
      {tab === 'pruebas' && isMaster && !viendoComo && <CuentasDePrueba onVerComoCoach={entrarComo} onVerComoAtleta={entrarComoAtleta} />}
      {tab === 'ia' && isDesktop && !viendoComo && <ConectarIA />}
    </>
  );

  const vistaDeAtleta = viendoAtleta && (
    <VistaComoAtleta key={viendoAtleta.id} atleta={viendoAtleta} onSalir={salirDeAtleta} />
  );

  /* ------------------------- Teléfono: banda azul y barra de abajo ------------------------
     Reestructura visual (15 oct 2026), como «Coach · Teléfono» de las capturas de Andrés: arriba la banda azul con el saludo y la
     tarjeta blanca con el nombre de la sección; abajo la barra azul. Ya no hay pestañas que se deslizan de lado (Andrés: «medio confuso»).
     La barra lleva cinco como mucho: el coach ve Atletas · Mensajes · Ejercicios · Planes · Vitrina. El dueño tiene además lo de
     administrar, así que su quinta es «Más» (Mi vitrina, Profesionales, Cuentas de prueba, Monetización), como la de Ajustes del iPhone. */
  if (!isDesktop) {
    const CORTOS = { athletes: t('Atletas'), messages: 'Mensajes', exercises: 'Ejercicios', misplanes: 'Planes', vitrina: 'Vitrina' };
    const EN_BARRA = ['athletes', 'messages', 'exercises', 'misplanes', 'vitrina'];
    const deMas = isMaster ? TABS.filter((x) => !EN_BARRA.slice(0, 4).includes(x.id)) : [];
    const enBarra = TABS.filter((x) => (isMaster ? EN_BARRA.slice(0, 4) : EN_BARRA).includes(x.id));
    const secciones = [
      ...enBarra.map((x) => ({ id: x.id, texto: CORTOS[x.id] ?? x.label, Icono: x.icon, aviso: x.numero })),
      ...(deMas.length ? [{ id: 'mas', texto: 'Más', Icono: Menu }] : []),
    ];
    const enMas = deMas.some((x) => x.id === tab) || (tabGuardada === 'mas' && deMas.length > 0);
    const activa = enMas ? 'mas' : tab;
    const mirandoMas = tabGuardada === 'mas' && deMas.length > 0;
    const titulo = mirandoMas ? 'Más' : (TABS.find((x) => x.id === tab)?.label ?? '');
    const detalle = mirandoMas ? null : (cabecera?.detalle ?? (tab === 'messages' && sinLeer > 0 ? `${sinLeer} sin leer` : null));
    const hoy = new Date().toLocaleDateString('es-MX', { weekday: 'short', day: 'numeric' }).replace('.', '');
    const nombre = (profile?.full_name || profile?.username || '').trim().split(/\s+/)[0];
    return (
      <>
      {vistaDeAtleta}
      <div style={{ minHeight: '100svh', background: UI.fondo, fontFamily: FONT, ...(viendoAtleta ? { display: 'none' } : {}) }}>
        {/* El botón de la cuenta (fijo arriba a la derecha, ver App) cae sobre la banda: se le deja su hueco. */}
        <CabeceraConBanda
          fecha={`Hoy, ${hoy}`} saludo={nombre ? `¡Hola, ${nombre}!` : '¡Hola!'} titulo={titulo} detalle={detalle} accion={mirandoMas ? null : cabecera?.accion}
          avatar={<span aria-hidden="true" style={{ width: 52, height: 52, flexShrink: 0 }} />}
        />
        <main style={{ padding: '18px 16px calc(116px + env(safe-area-inset-bottom))' }}>
          {mirandoMas ? (
            <Grupo>
              {deMas.map((x) => (
                <Fila key={x.id} izquierda={<IconoDeFila><x.icon size={18} /></IconoDeFila>} texto={x.label} onClick={() => setTab(x.id)} />
              ))}
            </Grupo>
          ) : (
            <EnBanda.Provider value={banda}>{content}</EnBanda.Provider>
          )}
        </main>
        <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 60 }}>
          <BarraInferior variante="coach" secciones={secciones} activa={activa} onCambio={(id) => { setTab(id); window.scrollTo(0, 0); }} />
        </div>
      </div>
      </>
    );
  }

  /* ---------------------- Computadora: barra lateral azul --------------------------
     Reestructura visual (15 oct 2026), como «Coach · Computadora» de las capturas: la barra lateral azul con la persona arriba,
     las secciones y, abajo, su código de coach. Arriba del contenido, el encabezado blanco con el nombre de la sección.
     Se puede seguir ocultando la barra (el botón de la izquierda del encabezado) para trabajar a lo ancho, como antes. */
  const tituloCompu = TABS.find((x) => x.id === tab)?.label ?? '';
  const codigo = profile?.codigo_coach;
  return (
    <>
    {vistaDeAtleta}
    <div style={{ minHeight: '100svh', background: UI.fondo, fontFamily: FONT, display: viendoAtleta ? 'none' : 'flex' }}>
      {menuOpen && (
        <div style={{ position: 'sticky', top: 0, height: '100svh', flexShrink: 0, display: 'flex' }}>
          <BarraLateral
            subtitulo={`Training Lab · ${isMaster ? 'Dueño' : (oficioCorto(profile?.profesion) || 'Coach')}`}
            marca={profile?.full_name || profile?.username || 'Training Lab'}
            secciones={TABS.map((x) => ({ id: x.id, texto: x.label, Icono: x.icon, aviso: x.numero }))}
            activa={tab} onCambio={setTab} ancho={SIDEBAR_W}
            pie={codigo && !viendoComo ? (
              <>
                <div style={{ fontSize: 12.5, fontWeight: 600, opacity: 0.8 }}>Tu código de coach</div>
                <div style={{ fontSize: 21, fontWeight: 800, letterSpacing: 1.5, marginTop: 2 }}>{codigo}</div>
              </>
            ) : null}
          />
        </div>
      )}

      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
        <header
          style={{
            position: 'sticky', top: 0, zIndex: 40, background: 'rgba(255,255,255,0.92)',
            backdropFilter: 'saturate(180%) blur(16px)', borderBottom: `1px solid ${UI.hilo}`,
            padding: '14px 96px 14px 20px', display: 'flex', alignItems: 'center', gap: 14, minHeight: 76, boxSizing: 'border-box',
          }}
        >
          <button
            type="button" onClick={() => setMenuOpen((v) => !v)} aria-label={menuOpen ? 'Ocultar menú' : 'Mostrar menú'} title={menuOpen ? 'Ocultar menú' : 'Mostrar menú'}
            style={{ width: 40, height: 40, borderRadius: 12, border: 'none', cursor: 'pointer', background: UI.relleno, color: KP.ink2, display: 'grid', placeItems: 'center', flexShrink: 0 }}
          >
            {menuOpen ? <PanelLeftClose size={18} /> : <PanelLeft size={18} />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: -0.5, color: KP.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tituloCompu}</h1>
            {cabecera?.detalle && <div style={{ fontSize: 14, fontWeight: 500, color: KP.ink2, marginTop: 1 }}>{cabecera.detalle}</div>}
          </div>
          {cabecera?.accion}
        </header>

        <main style={{ flex: 1, padding: '24px 24px 60px', minWidth: 0 }}><EnBanda.Provider value={banda}>{content}</EnBanda.Provider></main>
      </div>
    </div>
    </>
  );
}
