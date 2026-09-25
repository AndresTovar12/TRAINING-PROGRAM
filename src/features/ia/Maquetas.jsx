import { createContext, useContext } from 'react';
import { Aperture, Asterisk, Check, Dumbbell, Lock, MousePointerClick, Plus, SquareTerminal } from 'lucide-react';
import { FONT, KP } from '@/lib/theme';

/**
 * Las pantallas que la persona va a ver al conectar su IA, dibujadas en
 * pequeño, con lo que tiene que tocar marcado.
 *
 * Andrés prefiere guías visuales, clic por clic y con poco texto: una lista de
 * pasos escrita "se ve fea". Estas maquetas no son fotos: son dibujos hechos
 * con la app, así se ven nítidos en cualquier pantalla y no se quedan viejos
 * con cada cambio de Claude o ChatGPT (dicen lo esencial, no cada pixel).
 */

const MONO = 'ui-monospace, SFMono-Regular, Menlo, monospace';

export function MarcaIA({ app, size = 28 }) {
  const color = { claude: '#D97757', chatgpt: '#111318', 'claude-code': '#C4623F', codex: '#111318', hermes: '#7C5CFF' }[app] ?? KP.blue;
  const Icono = app === 'claude' ? Asterisk : app === 'chatgpt' ? Aperture : SquareTerminal;
  return (
    <span style={{
      width: size, height: size, borderRadius: size * 0.3, background: color, flexShrink: 0,
      display: 'inline-grid', placeItems: 'center',
    }}>
      <Icono size={size * 0.58} color="#fff" strokeWidth={2.4} />
    </span>
  );
}

// En la compu se hace clic, en el celular se toca: las etiquetas lo dicen así.
const EnCompu = createContext(false);

/** Lo que hay que tocar: un anillo que late y la etiqueta "Toca aquí" ("Clic aquí" en la compu). */
export function Toca({ activo, children, etiqueta, lado = 'derecha' }) {
  const enCompu = useContext(EnCompu);
  if (!activo) return children;
  const texto = etiqueta ?? (enCompu ? 'Clic aquí' : 'Toca aquí');
  return (
    <span className="tl-toca" style={{ position: 'relative', display: 'block' }}>
      {children}
      <span style={{
        position: 'absolute', top: -11, [lado === 'derecha' ? 'right' : 'left']: -4, zIndex: 2,
        display: 'inline-flex', alignItems: 'center', gap: 3, padding: '2px 7px 2px 5px', borderRadius: 99,
        background: KP.blue, color: '#fff', fontSize: 9.5, fontWeight: 800, fontFamily: FONT,
        boxShadow: '0 4px 10px rgba(30,64,224,.35)', whiteSpace: 'nowrap',
      }}>
        <MousePointerClick size={11} strokeWidth={2.6} /> {texto}
      </span>
    </span>
  );
}

/* ------------------------------------------------------------------ */
/* Marcos                                                              */
/* ------------------------------------------------------------------ */

function BarraDireccion({ direccion, resaltada }) {
  // En el celular la trampa es buscarlo en la app; en la compu no hay confusión.
  const enCompu = useContext(EnCompu);
  return (
    <Toca activo={resaltada} etiqueta={enCompu ? 'Esta página' : 'Es la página, no la app'}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4,
        background: '#EEF0F3', borderRadius: 8, padding: '5px 8px', fontSize: 10, fontWeight: 600, color: KP.ink2,
      }}>
        <Lock size={9} strokeWidth={2.6} /> {direccion}
      </div>
    </Toca>
  );
}

export function Marco({ tipo, direccion, resaltaDireccion, children }) {
  if (tipo === 'terminal') {
    return (
      <div style={{
        width: '100%', maxWidth: 440, borderRadius: 12, overflow: 'hidden', background: '#0F1115',
        boxShadow: '0 14px 34px rgba(17,19,24,.22)', border: '1px solid #1F232B',
      }}>
        <div style={{ display: 'flex', gap: 5, padding: '9px 11px', borderBottom: '1px solid #1F232B' }}>
          {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <span key={c} style={{ width: 8, height: 8, borderRadius: 4, background: c, opacity: 0.85 }} />)}
        </div>
        <div style={{ padding: '12px 14px 14px', fontFamily: MONO, fontSize: 11.5, lineHeight: 1.6, color: '#D7DBE2' }}>
          {children}
        </div>
      </div>
    );
  }
  if (tipo === 'navegador') {
    return (
      <div style={{
        width: '100%', maxWidth: 420, borderRadius: 14, overflow: 'visible', background: KP.surface,
        border: `1px solid ${KP.lineHi}`, boxShadow: '0 14px 34px rgba(17,19,24,.10)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', borderBottom: `1px solid ${KP.line}`, background: '#F7F8FA', borderRadius: '14px 14px 0 0' }}>
          <span style={{ display: 'flex', gap: 4 }}>
            {['#FF5F57', '#FEBC2E', '#28C840'].map((c) => <span key={c} style={{ width: 7, height: 7, borderRadius: 4, background: c, opacity: 0.8 }} />)}
          </span>
          <div style={{ flex: 1 }}>{direccion && <BarraDireccion direccion={direccion} resaltada={resaltaDireccion} />}</div>
        </div>
        <div style={{ padding: 14 }}>{children}</div>
      </div>
    );
  }
  // Teléfono
  return (
    <div style={{
      width: 236, flexShrink: 0, borderRadius: 32, padding: 7, background: '#15181D',
      boxShadow: '0 18px 40px rgba(17,19,24,.25)',
    }}>
      <div style={{ borderRadius: 26, background: KP.surface, overflow: 'visible', minHeight: 300, display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 16px 4px', fontSize: 9.5, fontWeight: 800, color: KP.ink }}>
          <span>9:41</span>
          <span style={{ width: 54, height: 14, borderRadius: 8, background: '#15181D' }} />
          <span style={{ letterSpacing: 1 }}>●●</span>
        </div>
        {direccion && <div style={{ padding: '2px 10px 6px' }}><BarraDireccion direccion={direccion} resaltada={resaltaDireccion} /></div>}
        <div style={{ flex: 1, padding: '6px 12px 14px', display: 'flex', flexDirection: 'column' }}>{children}</div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Pantallas                                                           */
/* ------------------------------------------------------------------ */

const campo = (resaltado) => ({
  border: `1.5px solid ${resaltado ? KP.blue : KP.lineHi}`, borderRadius: 8, padding: '6px 8px',
  fontSize: 10.5, fontWeight: 600, color: KP.ink, background: KP.surface, overflow: 'hidden',
  textOverflow: 'ellipsis', whiteSpace: 'nowrap',
});
const etiqueta = { fontSize: 9.5, fontWeight: 700, color: KP.ink3, margin: '0 0 3px' };

function Interruptor({ encendido = true }) {
  return (
    <span style={{
      width: 26, height: 15, borderRadius: 8, background: encendido ? KP.blue : '#D5D9E0', flexShrink: 0,
      display: 'inline-flex', alignItems: 'center', justifyContent: encendido ? 'flex-end' : 'flex-start', padding: 2,
    }}>
      <span style={{ width: 11, height: 11, borderRadius: 6, background: '#fff' }} />
    </span>
  );
}

function ClaudeConectores({ resalta }) {
  const fila = (letra, nombre, color) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '7px 0', borderBottom: `1px solid ${KP.line}` }}>
      <span style={{ width: 18, height: 18, borderRadius: 5, background: color, color: '#fff', fontSize: 9, fontWeight: 800, display: 'grid', placeItems: 'center' }}>{letra}</span>
      <span style={{ flex: 1, fontSize: 11, fontWeight: 600, color: KP.ink }}>{nombre}</span>
      <span style={{ fontSize: 9, fontWeight: 700, color: KP.ink3 }}>Conectado</span>
    </div>
  );
  return (
    <div>
      <div style={{ fontSize: 9.5, fontWeight: 700, color: KP.ink3 }}>‹ Configuración</div>
      <div style={{ fontSize: 15, fontWeight: 800, color: KP.ink, margin: '2px 0 8px' }}>Conectores</div>
      {fila('G', 'Google Drive', '#1FA463')}
      {fila('M', 'Gmail', '#EA4335')}
      <div style={{ marginTop: 14 }}>
        <Toca activo={resalta === 'agregar'}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, borderRadius: 9,
            border: `1.5px solid ${resalta === 'agregar' ? KP.blue : KP.lineHi}`, padding: '7px 6px',
            fontSize: 10.5, fontWeight: 700, color: KP.ink,
          }}>
            <Plus size={11} strokeWidth={2.8} /> Agregar conector personalizado
          </div>
        </Toca>
      </div>
    </div>
  );
}

function Formulario() {
  return (
    <div style={{ background: KP.surface, borderRadius: 12, border: `1px solid ${KP.line}`, padding: 11, boxShadow: '0 8px 20px rgba(17,19,24,.08)' }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: KP.ink, marginBottom: 9 }}>Agregar conector personalizado</div>
      <p style={etiqueta}>Nombre</p>
      <div style={{ ...campo(false), marginBottom: 12 }}>Training Lab</div>
      <p style={etiqueta}>URL del servidor</p>
      <Toca activo etiqueta="Pega tu liga">
        <div style={campo(true)}>training-program-kappa.vercel.app/mcp</div>
      </Toca>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 6, marginTop: 12 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: KP.ink2, padding: '5px 8px' }}>Cancelar</span>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: KP.ink, borderRadius: 7, padding: '5px 10px' }}>Agregar</span>
      </div>
    </div>
  );
}

function ChatGPTAjustes({ resalta }) {
  const item = (texto, activo) => (
    <div style={{
      fontSize: 10, fontWeight: activo ? 800 : 600, color: activo ? KP.ink : KP.ink2, padding: '5px 7px',
      borderRadius: 6, background: activo ? '#EEF0F3' : 'transparent',
    }}>{texto}</div>
  );
  return (
    <div>
      <div style={{ fontSize: 13, fontWeight: 800, color: KP.ink, marginBottom: 8 }}>Configuración</div>
      <div style={{ display: 'grid', gridTemplateColumns: '84px 1fr', gap: 8 }}>
        <div>
          {item('General')}
          {item('Notificaciones')}
          <Toca activo={resalta === 'apps'} lado="izquierda">{item('Apps', true)}</Toca>
          {item('Seguridad')}
        </div>
        <div style={{ borderLeft: `1px solid ${KP.line}`, paddingLeft: 9 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: KP.ink }}>Apps</div>
          <div style={{ fontSize: 9, fontWeight: 700, color: KP.ink3, margin: '6px 0 4px' }}>CONFIGURACIÓN AVANZADA</div>
          <Toca activo={resalta === 'interruptor'}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6, padding: '6px 7px', borderRadius: 8,
              border: `1.5px solid ${resalta === 'interruptor' ? KP.blue : KP.line}`,
            }}>
              <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: KP.ink }}>Modo de desarrollador</span>
              <Interruptor encendido={resalta === 'interruptor'} />
            </div>
          </Toca>
        </div>
      </div>
    </div>
  );
}

function ChatGPTCrear() {
  return (
    <div>
      <div style={{ fontSize: 12.5, fontWeight: 800, color: KP.ink, marginBottom: 9 }}>Nueva app</div>
      <p style={etiqueta}>Nombre</p>
      <div style={{ ...campo(false), marginBottom: 10 }}>Training Lab</div>
      <p style={etiqueta}>URL del servidor MCP</p>
      <Toca activo etiqueta="Pega tu liga">
        <div style={campo(true)}>training-program-kappa.vercel.app/mcp</div>
      </Toca>
      <p style={{ ...etiqueta, marginTop: 10 }}>Autenticación</p>
      <div style={{ ...campo(false), display: 'flex', justifyContent: 'space-between' }}><span>OAuth</span><span style={{ color: KP.ink3 }}>▾</span></div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: KP.ink, borderRadius: 7, padding: '5px 12px' }}>Crear</span>
      </div>
    </div>
  );
}

/** Nuestra pantalla de permiso, en pequeño: la van a reconocer al verla. */
function Permiso({ app }) {
  const enCompu = useContext(EnCompu);
  const nombre = app === 'chatgpt' ? 'ChatGPT' : 'Claude';
  return (
    <div style={{ background: KP.surface, borderRadius: 14, border: `1px solid ${KP.line}`, padding: 12, boxShadow: '0 8px 22px rgba(17,19,24,.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 9 }}>
        <span style={{ width: 20, height: 20, borderRadius: 6, background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, display: 'grid', placeItems: 'center' }}>
          <Dumbbell size={11} color="#fff" strokeWidth={2.6} />
        </span>
        <span style={{ fontSize: 10.5, fontWeight: 800, color: KP.ink }}>Training Lab</span>
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: KP.ink, lineHeight: 1.2, marginBottom: 8 }}>{nombre} quiere usar tu cuenta</div>
      {['Ver tu plan y tu día', 'Anotar lo que entrenaste'].map((t) => (
        <div key={t} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 9.5, fontWeight: 600, color: KP.ink2, marginBottom: 3 }}>
          <Check size={10} color={KP.mint} strokeWidth={3} /> {t}
        </div>
      ))}
      <div style={{ marginTop: 11 }}>
        <Toca activo etiqueta={enCompu ? 'Clic en Permitir' : 'Toca Permitir'}>
          <div style={{ textAlign: 'center', borderRadius: 99, padding: '7px 0', fontSize: 11, fontWeight: 800, color: '#fff', background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})` }}>Permitir</div>
        </Toca>
        <div style={{ textAlign: 'center', borderRadius: 99, padding: '6px 0', marginTop: 5, fontSize: 10.5, fontWeight: 700, color: KP.ink, border: `1px solid ${KP.line}` }}>No permitir</div>
      </div>
    </div>
  );
}

function Chat({ app, resalta, rol }) {
  const esCoach = rol !== 'atleta';
  const pregunta = esCoach ? '¿Cómo van mis atletas esta semana?' : '¿Qué me toca hoy?';
  const respuesta = esCoach
    ? 'Ana hizo 4 de 4 sesiones. Juan va 2 de 4 y anotó dolor de rodilla.'
    : 'Pierna: sentadilla 4×8, zancada 3×10 y plancha. La vez pasada hiciste 60 kg.';
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 7, flex: 1 }}>
      <div style={{ alignSelf: 'flex-end', maxWidth: '80%', background: '#EEF0F3', borderRadius: '12px 12px 3px 12px', padding: '6px 9px', fontSize: 10.5, fontWeight: 600, color: KP.ink }}>{pregunta}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 8.5, fontWeight: 800, color: KP.ink3, letterSpacing: 0.3 }}>
        <MarcaIA app={app} size={13} /> USÓ TRAINING LAB
      </div>
      <div style={{ maxWidth: '88%', fontSize: 10.5, fontWeight: 500, color: KP.ink, lineHeight: 1.45 }}>{respuesta}</div>
      <div style={{ flex: 1 }} />
      {/* El menú "+" abierto, con Training Lab. */}
      <div style={{ background: KP.surface, border: `1px solid ${KP.line}`, borderRadius: 10, padding: 7, boxShadow: '0 8px 18px rgba(17,19,24,.10)', width: '78%' }}>
        <div style={{ fontSize: 8.5, fontWeight: 800, color: KP.ink3, marginBottom: 4 }}>{app === 'chatgpt' ? 'APPS' : 'CONECTORES'}</div>
        <Toca activo={resalta === 'interruptor' || resalta === 'app'} etiqueta={app === 'chatgpt' ? 'Elígela' : 'Actívalo'}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 5px', borderRadius: 7, border: `1.5px solid ${KP.blue}` }}>
            <span style={{ width: 15, height: 15, borderRadius: 4, background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, display: 'grid', placeItems: 'center' }}>
              <Dumbbell size={8} color="#fff" strokeWidth={2.8} />
            </span>
            <span style={{ flex: 1, fontSize: 10, fontWeight: 700, color: KP.ink }}>Training Lab</span>
            {app !== 'chatgpt' && <Interruptor />}
          </div>
        </Toca>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, border: `1px solid ${KP.lineHi}`, borderRadius: 99, padding: '4px 5px 4px 4px' }}>
        <span style={{ width: 18, height: 18, borderRadius: 9, border: `1px solid ${KP.lineHi}`, display: 'grid', placeItems: 'center' }}><Plus size={10} strokeWidth={2.8} color={KP.ink} /></span>
        <span style={{ fontSize: 9.5, color: KP.ink3, fontWeight: 600 }}>Escribe…</span>
      </div>
    </div>
  );
}

function Terminal({ lineas }) {
  return lineas.map(([tipo, texto]) => {
    if (tipo === 'cmd') return <div key={texto} style={{ overflowWrap: 'anywhere' }}><span style={{ color: '#6EE7A8' }}>$ </span>{texto}</div>;
    if (tipo === 'ask') return <div key={texto} style={{ color: '#fff', fontWeight: 700 }}><span style={{ color: '#FDBA74' }}>› </span>{texto}</div>;
    if (tipo === 'ok') return <div key={texto} style={{ color: '#6EE7A8' }}>✓ {texto}</div>;
    if (tipo === 'ans') return <div key={texto} style={{ color: '#E8EAEE' }}><span style={{ color: '#FDBA74' }}>● </span>{texto}</div>;
    if (tipo === 'sel') {
      return (
        <div key={texto} style={{ marginTop: 6 }}>
          <Toca activo etiqueta="Elígelo">
            <div style={{ background: '#233047', borderRadius: 5, padding: '3px 7px', color: '#fff', fontWeight: 700 }}>❯ {texto}</div>
          </Toca>
        </div>
      );
    }
    return <div key={texto} style={{ color: '#8A93A3' }}>{texto}</div>;
  });
}

/** La pantalla de un paso, en el marco que le toca según el aparato. */
export function Pantalla({ paso, app, esCompu, rol }) {
  return <EnCompu.Provider value={esCompu}><PantallaDelPaso paso={paso} app={app} esCompu={esCompu} rol={rol} /></EnCompu.Provider>;
}

function PantallaDelPaso({ paso, app, esCompu, rol }) {
  const marcoWeb = esCompu ? 'navegador' : 'telefono';
  switch (paso.pantalla) {
    case 'claude-conectores':
      return (
        <Marco tipo={marcoWeb} direccion="claude.ai/settings/connectors" resaltaDireccion={paso.resalta === 'direccion'}>
          <ClaudeConectores resalta={paso.resalta} />
        </Marco>
      );
    case 'formulario':
      return <Marco tipo={marcoWeb} direccion="claude.ai/settings/connectors"><Formulario /></Marco>;
    case 'chatgpt-ajustes':
      return <Marco tipo="navegador" direccion="chatgpt.com"><ChatGPTAjustes resalta={paso.resalta} /></Marco>;
    case 'chatgpt-crear':
      return <Marco tipo="navegador" direccion="chatgpt.com"><ChatGPTCrear /></Marco>;
    case 'permiso':
      return <Marco tipo={app === 'chatgpt' ? 'navegador' : marcoWeb} direccion="training-program-kappa.vercel.app"><Permiso app={app} /></Marco>;
    case 'chat':
      return <Marco tipo={app === 'chatgpt' ? 'navegador' : marcoWeb}><Chat app={app} resalta={paso.resalta} rol={rol} /></Marco>;
    case 'terminal':
      return <Marco tipo="terminal"><Terminal lineas={paso.lineas} /></Marco>;
    case 'terminal-pregunta':
      return (
        <Marco tipo="terminal">
          <Terminal lineas={[
            ['ask', '¿Cómo van mis atletas esta semana?'],
            ['out', 'training-lab · listar_atletas'],
            ['ans', 'Ana hizo 4 de 4 sesiones.'],
            ['ans', 'Juan va 2 de 4 y anotó dolor de rodilla.'],
          ]} />
        </Marco>
      );
    default:
      return null;
  }
}
