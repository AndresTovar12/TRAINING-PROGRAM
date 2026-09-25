import { useEffect, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Copy, ExternalLink, Loader2, MessagesSquare, RotateCcw, SquareTerminal, Unplug } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmacion } from '@/components/Confirmacion';
import { useIsDesktop } from '@/lib/useViewport';
import { FONT, KP } from '@/lib/theme';
import { queHaceLaIA } from '@/features/ia/queHaceLaIA';
import { CONECTORES, TERMINALES, pasosDe, sePuedeAqui } from '@/features/ia/guiasIA';
import { MarcaIA, Pantalla } from '@/features/ia/Maquetas';

/**
 * Conectar Training Lab con la IA de cada quien.
 *
 * Andrés, 25 sep 2026, sobre la primera versión:
 *   1. "Las instrucciones se ven feas, tienen que ser súper amigables
 *      visualmente." → cada paso es una tarjeta con la pantalla que va a ver,
 *      dibujada, y lo que hay que tocar marcado. Uno a la vez.
 *   2. "Se tiene que dividir en 2 vertientes: los conectores (Claude y
 *      ChatGPT) y los MCP (Claude Code, Codex, Hermes)." → dos puertas.
 *   3. "A los atletas no les pusiste cómo conectarse; ellos casi no usarán la
 *      computadora." → el atleta ve solo los conectores, y en el celular los
 *      pasos son los del celular. Las terminales son cosa de compu y de coach.
 *
 * Dónde vive (decidido antes): en la compu del coach, en el menú lateral; en
 * el teléfono NO va en la navegación, va en "Mi perfil" (y el menú de la
 * cuenta tiene un atajo que abre Mi perfil justo aquí).
 */

const GUARDADO = 'tl:conectar-ia';

function leeGuardado() {
  try { return JSON.parse(localStorage.getItem(GUARDADO) ?? '{}') ?? {}; } catch { return {}; }
}

function Accion({ accion, principal }) {
  const [listo, setListo] = useState(false);
  const estilo = {
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 46,
    padding: '0 18px', borderRadius: 14, cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 800,
    textDecoration: 'none', border: principal ? 'none' : `1.5px solid ${KP.lineHi}`,
    background: principal ? `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})` : KP.surface,
    color: principal ? '#fff' : KP.ink, boxShadow: principal ? KP.shBtn : 'none',
  };
  if (accion.tipo === 'abrir') {
    return (
      <a href={accion.href} target="_blank" rel="noopener noreferrer" className="kp-press" style={estilo}>
        {accion.texto} <ExternalLink size={16} strokeWidth={2.4} />
      </a>
    );
  }
  const copia = async () => {
    try {
      await navigator.clipboard.writeText(accion.valor);
      setListo(true);
      setTimeout(() => setListo(false), 1800);
    } catch { /* sin portapapeles: el texto va escrito en la maqueta */ }
  };
  return (
    <button type="button" onClick={copia} className="kp-press" style={{ ...estilo, ...(listo ? { background: KP.mint, boxShadow: 'none' } : {}) }}>
      {listo ? <Check size={17} strokeWidth={3} /> : <Copy size={16} strokeWidth={2.4} />}
      {listo ? '¡Copiado!' : accion.texto}
    </button>
  );
}

function Guia({ app, esCompu, rol }) {
  const pasos = pasosDe(app, esCompu);
  const [paso, setPaso] = useState(() => {
    const g = leeGuardado();
    return g.app === app && Number.isInteger(g.paso) && g.paso < pasos.length ? g.paso : 0;
  });
  useEffect(() => {
    try { localStorage.setItem(GUARDADO, JSON.stringify({ ...leeGuardado(), app, paso })); } catch { /* sin almacenamiento */ }
  }, [app, paso]);

  const p = pasos[Math.min(paso, pasos.length - 1)];
  const ultimo = paso === pasos.length - 1;

  const texto = (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <span style={{
          width: 34, height: 34, borderRadius: 17, flexShrink: 0, display: 'grid', placeItems: 'center',
          background: ultimo ? KP.mint : KP.blue, color: '#fff', fontSize: 15, fontWeight: 800,
        }}>
          {ultimo ? <Check size={18} strokeWidth={3} /> : paso + 1}
        </span>
        <div style={{ minWidth: 0 }}>
          <h3 style={{ fontSize: 19, fontWeight: 800, color: KP.ink, margin: '4px 0 0', letterSpacing: -0.3, lineHeight: 1.25, textWrap: 'balance' }}>{p.titulo}</h3>
          {p.texto && <p style={{ fontSize: 14.5, color: KP.ink2, fontWeight: 500, lineHeight: 1.5, margin: '6px 0 0' }}>{p.texto}</p>}
        </div>
      </div>
      {!!p.acciones?.length && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {p.acciones.map((a, i) => <Accion key={a.texto} accion={a} principal={i === 0} />)}
        </div>
      )}
    </div>
  );

  return (
    <div style={{ background: KP.surface, border: `1px solid ${KP.line}`, borderRadius: 22, padding: esCompu ? 22 : 16, boxShadow: KP.shCard }}>
      {/* Cuánto falta: en el celular se sale a Claude y se vuelve, y hay que saber dónde se iba. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <span style={{ fontSize: 12, fontWeight: 800, color: KP.ink3, whiteSpace: 'nowrap' }}>Paso {paso + 1} de {pasos.length}</span>
        <div style={{ flex: 1, display: 'flex', gap: 4 }}>
          {pasos.map((x, i) => (
            <button
              key={x.titulo} type="button" onClick={() => setPaso(i)} aria-label={`Ir al paso ${i + 1}`}
              style={{ flex: 1, height: 6, borderRadius: 3, border: 'none', padding: 0, cursor: 'pointer', background: i <= paso ? KP.blue : KP.line }}
            />
          ))}
        </div>
      </div>

      <div style={esCompu
        ? { display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)', gap: 26, alignItems: 'center' }
        : { display: 'flex', flexDirection: 'column', gap: 18 }}
      >
        {texto}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 4px' }}>
          <Pantalla paso={p} app={app} esCompu={esCompu} rol={rol} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
        {paso > 0 && (
          <button type="button" onClick={() => setPaso(paso - 1)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 46, padding: '0 16px', borderRadius: 14,
            border: `1.5px solid ${KP.line}`, background: KP.surface, cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 700, color: KP.ink2,
          }}>
            <ArrowLeft size={16} /> Atrás
          </button>
        )}
        <button
          type="button" onClick={() => setPaso(ultimo ? 0 : paso + 1)} className="kp-press"
          style={{
            flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, minHeight: 46, borderRadius: 14,
            border: ultimo ? `1.5px solid ${KP.line}` : 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 800,
            background: ultimo ? KP.surface : KP.ink, color: ultimo ? KP.ink2 : '#fff',
          }}
        >
          {ultimo ? <><RotateCcw size={15} /> Ver desde el principio</> : <>Siguiente <ArrowRight size={16} /></>}
        </button>
      </div>
    </div>
  );
}

function SelectorDeApp({ opciones, elegida, onElegir }) {
  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {opciones.map((o) => {
        const activa = o.id === elegida;
        return (
          <button
            key={o.id} type="button" onClick={() => onElegir(o.id)} aria-pressed={activa} className="kp-press"
            style={{
              flex: '1 1 0', minWidth: 118, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              minHeight: 54, padding: '0 14px', borderRadius: 16, cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 800,
              border: `2px solid ${activa ? KP.blue : KP.line}`, background: activa ? KP.blueSoft : KP.surface, color: KP.ink,
            }}
          >
            <MarcaIA app={o.id} size={28} /> {o.nombre}
          </button>
        );
      })}
    </div>
  );
}

/** ChatGPT desde el celular: todavía no se puede, y se dice claro, con salida. */
function ChatGPTEnCelular({ onUsarClaude }) {
  return (
    <div style={{ background: KP.surface, border: `1px solid ${KP.line}`, borderRadius: 22, padding: 20, boxShadow: KP.shCard, textAlign: 'center' }}>
      <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 12 }}><MarcaIA app="chatgpt" size={46} /></div>
      <h3 style={{ fontSize: 19, fontWeight: 800, color: KP.ink, margin: '0 0 6px', letterSpacing: -0.3 }}>Desde el celular, todavía no</h3>
      <p style={{ fontSize: 14.5, color: KP.ink2, fontWeight: 500, lineHeight: 1.5, margin: '0 auto 16px', maxWidth: 330 }}>
        ChatGPT solo deja conectar apps desde la computadora. Cuando aprueben Training Lab en su tienda, será de un toque.
        Claude sí se puede desde el celular.
      </p>
      <button type="button" onClick={onUsarClaude} className="kp-press" style={{
        display: 'inline-flex', alignItems: 'center', gap: 9, minHeight: 48, padding: '0 20px', borderRadius: 14, border: 'none', cursor: 'pointer',
        background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, color: '#fff', fontFamily: FONT, fontSize: 15, fontWeight: 800, boxShadow: KP.shBtn,
      }}>
        <MarcaIA app="claude" size={24} /> Conectar Claude
      </button>
      <p style={{ fontSize: 12.5, color: KP.ink3, fontWeight: 600, margin: '12px 0 0' }}>¿Tienes compu? Abre Training Lab ahí: está esta misma guía.</p>
    </div>
  );
}

function IAsConectadas() {
  const pregunta = useConfirmacion();
  // null = cargando · [] = ninguna · 'no' = el servidor de permisos no responde
  const [conexiones, setConexiones] = useState(null);

  useEffect(() => {
    let vivo = true;
    supabase.auth.oauth.listGrants().then(({ data, error }) => {
      if (vivo) setConexiones(error ? 'no' : (data ?? []));
    });
    return () => { vivo = false; };
  }, []);

  async function desconectar(c) {
    const nombre = c.client?.name || 'esta IA';
    const va = await pregunta({
      titulo: `¿Desconectar ${nombre}?`,
      detalle: 'Deja de poder entrar a tu cuenta en ese momento. La puedes volver a conectar cuando quieras.',
      confirmar: 'Desconectar',
      peligro: true,
    });
    if (!va) return;
    const { error } = await supabase.auth.oauth.revokeGrant({ clientId: c.client?.id });
    if (!error) setConexiones((xs) => (Array.isArray(xs) ? xs.filter((x) => x.client?.id !== c.client?.id) : xs));
  }

  if (conexiones === 'no') return null;
  const marcaDe = (nombre = '') => {
    const n = nombre.toLowerCase();
    if (n.includes('code')) return 'claude-code';
    if (n.includes('claude')) return 'claude';
    if (n.includes('codex')) return 'codex';
    if (n.includes('hermes')) return 'hermes';
    return 'chatgpt';
  };

  return (
    <div style={{ background: KP.surface, border: `1px solid ${KP.line}`, borderRadius: 22, padding: 18, boxShadow: KP.shCard }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: KP.ink3, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 }}>Tus IAs conectadas</div>
      {conexiones === null && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: KP.ink3, fontSize: 14 }}><Loader2 size={15} className="spin" /> Revisando…</div>
      )}
      {Array.isArray(conexiones) && conexiones.length === 0 && (
        <div style={{ fontSize: 14.5, color: KP.ink2, fontWeight: 500 }}>Todavía no has conectado ninguna.</div>
      )}
      {Array.isArray(conexiones) && conexiones.map((c) => (
        <div key={c.client?.id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '10px 0', borderTop: `1px solid ${KP.line}` }}>
          <MarcaIA app={marcaDe(c.client?.name)} size={34} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: KP.ink }}>{c.client?.name || 'IA sin nombre'}</div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: KP.ink3 }}>
              Conectada desde el {new Date(c.granted_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
            </div>
          </div>
          <button type="button" onClick={() => desconectar(c)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 38, padding: '0 12px', borderRadius: 11,
            border: `1.5px solid ${KP.line}`, background: KP.surface, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700, color: KP.danger,
          }}>
            <Unplug size={14} /> Desconectar
          </button>
        </div>
      ))}
    </div>
  );
}

export default function ConectarIA({ enPerfil = false }) {
  const { profile } = useAuth();
  const esCompu = useIsDesktop();
  const esAtleta = profile?.role !== 'admin';
  const rol = esAtleta ? 'atleta' : 'coach';
  const { puede } = queHaceLaIA(profile);

  const [rama, setRama] = useState(() => (esAtleta ? 'conectores' : (leeGuardado().rama === 'mcp' ? 'mcp' : 'conectores')));
  const opciones = rama === 'mcp' ? TERMINALES : CONECTORES;
  const [app, setApp] = useState(() => {
    const g = leeGuardado().app;
    return opciones.some((o) => o.id === g) ? g : opciones[0].id;
  });
  const elegirRama = (r) => {
    setRama(r);
    setApp((r === 'mcp' ? TERMINALES : CONECTORES)[0].id);
    try { localStorage.setItem(GUARDADO, JSON.stringify({ rama: r })); } catch { /* sin almacenamiento */ }
  };
  const appValida = opciones.some((o) => o.id === app) ? app : opciones[0].id;

  const conversacion = esAtleta
    ? ['¿Qué me toca hoy?', 'Pierna: sentadilla 4×8, zancada 3×10 y plancha. La vez pasada hiciste 60 kg.']
    : ['¿Cómo van mis atletas esta semana?', 'Ana hizo 4 de 4 sesiones. Juan va 2 de 4 y anotó dolor de rodilla.'];

  return (
    <div id="conectar-ia" style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, maxWidth: enPerfil ? undefined : 820, scrollMarginTop: 16 }}>
      {/* LO QUE SE GANA, antes que los pasos: sin esto, es una lista de clics sin porqué. */}
      <div style={{
        borderRadius: 24, padding: esCompu && !enPerfil ? 26 : 20, color: '#fff', position: 'relative', overflow: 'hidden',
        background: `linear-gradient(145deg, ${KP.blue} 0%, ${KP.blueDk} 100%)`,
        display: esCompu && !enPerfil ? 'grid' : 'flex', gridTemplateColumns: '1fr 1fr', flexDirection: 'column', gap: 18, alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 11.5, fontWeight: 800, letterSpacing: 0.8, textTransform: 'uppercase', opacity: 0.75 }}>Conectar con tu IA</div>
          <h2 style={{ fontSize: esCompu && !enPerfil ? 28 : 23, fontWeight: 800, margin: '6px 0 6px', letterSpacing: -0.5, lineHeight: 1.12, textWrap: 'balance' }}>
            {esAtleta ? 'Tu entrenamiento, en tu IA' : 'Tu equipo, en tu IA'}
          </h2>
          <p style={{ fontSize: 14.5, fontWeight: 500, lineHeight: 1.5, margin: 0, opacity: 0.88 }}>
            Pregúntale a Claude o ChatGPT y te contesta con tus datos de Training Lab.
          </p>
        </div>
        <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ alignSelf: 'flex-end', maxWidth: '85%', background: 'rgba(255,255,255,0.18)', borderRadius: '16px 16px 4px 16px', padding: '9px 13px', fontSize: 14, fontWeight: 600 }}>
            {conversacion[0]}
          </div>
          <div style={{ alignSelf: 'flex-start', maxWidth: '92%', background: '#fff', color: KP.ink, borderRadius: '16px 16px 16px 4px', padding: '10px 13px', fontSize: 14, fontWeight: 500, lineHeight: 1.45, boxShadow: '0 8px 20px rgba(10,20,80,0.25)' }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, color: KP.blue, letterSpacing: 0.4, marginBottom: 3 }}>CON TRAINING LAB</div>
            {conversacion[1]}
          </div>
        </div>
      </div>

      {/* Lo que puede hacer, en fichas: se lee de un vistazo. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 7 }}>
        {puede.map((x) => (
          <span key={x} style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 11px', borderRadius: 99,
            background: KP.surface, border: `1px solid ${KP.line}`, fontSize: 13, fontWeight: 700, color: KP.ink,
          }}>
            <Check size={14} color={KP.mint} strokeWidth={3} /> {x}
          </span>
        ))}
      </div>

      {/* LAS DOS VERTIENTES. Solo para quien arma planes: las terminales no son para el atleta. */}
      {!esAtleta && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { id: 'conectores', titulo: 'Conectores', apps: 'Claude y ChatGPT', donde: 'En el chat, como una app más', Icono: MessagesSquare },
            { id: 'mcp', titulo: 'MCP', apps: 'Claude Code, Codex y Hermes', donde: 'En la terminal de tu compu', Icono: SquareTerminal },
          ].map(({ id, titulo, apps, donde, Icono }) => {
            const activa = rama === id;
            return (
              <button
                key={id} type="button" onClick={() => elegirRama(id)} aria-pressed={activa} className="kp-press"
                style={{
                  textAlign: 'left', padding: 16, borderRadius: 20, cursor: 'pointer', fontFamily: FONT,
                  border: `2px solid ${activa ? KP.blue : KP.line}`, background: activa ? KP.blueSoft : KP.surface,
                  display: 'flex', flexDirection: 'column', gap: 8,
                }}
              >
                <span style={{ width: 38, height: 38, borderRadius: 12, display: 'grid', placeItems: 'center', background: activa ? KP.blue : KP.bg, color: activa ? '#fff' : KP.ink2 }}>
                  <Icono size={20} strokeWidth={2.2} />
                </span>
                <span style={{ fontSize: 17, fontWeight: 800, color: KP.ink }}>{titulo}</span>
                <span style={{ fontSize: 13, fontWeight: 700, color: KP.ink2, lineHeight: 1.35 }}>{apps}</span>
                <span style={{ fontSize: 12.5, fontWeight: 600, color: KP.ink3, lineHeight: 1.35 }}>{donde}</span>
              </button>
            );
          })}
        </div>
      )}

      <div>
        <div style={{ fontSize: 12, fontWeight: 800, color: KP.ink3, textTransform: 'uppercase', letterSpacing: 0.6, margin: '4px 0 10px' }}>
          {rama === 'mcp' ? 'Elige tu herramienta' : 'Elige tu IA'}
        </div>
        <SelectorDeApp opciones={opciones} elegida={appValida} onElegir={setApp} />
      </div>

      {rama === 'mcp' && !esCompu && (
        <div style={{ fontSize: 13.5, fontWeight: 700, color: KP.amber, background: KP.amberSoft, borderRadius: 14, padding: '10px 14px' }}>
          Esto se hace en la terminal de tu compu.
        </div>
      )}

      {sePuedeAqui(appValida, esCompu)
        ? <Guia key={`${appValida}-${esCompu}`} app={appValida} esCompu={esCompu} rol={rol} />
        : <ChatGPTEnCelular onUsarClaude={() => setApp('claude')} />}

      <IAsConectadas />

      <style>{`
        .spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
        .tl-toca::after{content:"";position:absolute;inset:-4px;border-radius:12px;border:2px solid ${KP.blue};animation:tl-late 1.6s ease-out infinite;pointer-events:none}
        @keyframes tl-late{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(1.08)}}
        @media (prefers-reduced-motion: reduce){.tl-toca::after{animation:none;opacity:.6}}
      `}</style>
    </div>
  );
}
