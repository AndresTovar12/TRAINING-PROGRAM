import { useEffect, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2, MessagesSquare, Monitor, SquareTerminal, Unplug } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { useConfirmacion } from '@/components/Confirmacion';
import { useIsDesktop } from '@/lib/useViewport';
import { FONT, KP, UI } from '@/lib/theme';
import { Boton, Fila, Grupo } from '@/components/ui';
import { CONECTORES, TERMINALES, pasosDe } from '@/features/ia/guiasIA';
import { MarcaIA, Pantalla } from '@/features/ia/Maquetas';
import { agrupaConexiones } from '@/features/ia/conexiones';

/**
 * Conectar Training Lab con la IA de cada quien.
 *
 * Andrés, 25 sep 2026, sobre la primera versión:
 *   1. "Las instrucciones se ven feas, tienen que ser súper amigables
 *      visualmente." → cada paso es una tarjeta con la pantalla que va a ver,
 *      dibujada, y lo que hay que tocar marcado. (Hasta el 6 oct eran uno a la
 *      vez con «Siguiente»; ahora van todos de corrido, un paso por clic: ver
 *      `Guia`.)
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
    // Reestructura visual (15 oct 2026): los botones de `components/ui` (azul lleno o gris claro).
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 48,
    padding: '0 18px', borderRadius: 16, cursor: 'pointer', fontFamily: FONT, fontSize: 15.5, fontWeight: 700,
    textDecoration: 'none', border: 'none',
    background: principal ? KP.blue : UI.relleno,
    color: principal ? '#fff' : KP.ink, boxShadow: principal ? '0 8px 20px rgba(30,64,224,0.22)' : 'none',
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

/* La guía entera, de corrido: un paso por clic, cada uno con su dibujo y una sola cosa marcada.
   Andrés, 6 oct 2026: el cliente sale de la app para hacer los pasos en ChatGPT y, al volver, con el
   paso a paso de «Siguiente» ya no sabía en cuál iba; y un dibujo que juntaba dos clics («Agregar» y
   luego la opción del menú) escondía el primero. «No saltarnos, pero visualmente simplificarlo muchísimo». */
function Guia({ app, esCompu, rol }) {
  const pasos = pasosDe(app);
  useEffect(() => {
    try { localStorage.setItem(GUARDADO, JSON.stringify({ ...leeGuardado(), app })); } catch { /* sin almacenamiento */ }
  }, [app]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {pasos.map((p, i) => {
        const ultimo = i === pasos.length - 1;
        // «Abrir ChatGPT / Claude» no sirve desde el celular: los pasos se hacen en la compu.
        const acciones = (p.acciones ?? []).filter((a) => esCompu || a.tipo !== 'abrir');
        return (
          <div key={p.titulo} style={{ background: KP.surface, borderRadius: 22, padding: esCompu ? 22 : 16, boxShadow: '0 2px 10px rgba(17,19,24,0.06)' }}>
            {/* Texto y dibujo lado a lado si caben (cada uno de 300 px o más); si no, uno sobre otro. */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 290px), 1fr))', gap: esCompu ? 26 : 16, alignItems: 'center' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                  <span style={{
                    width: 34, height: 34, borderRadius: 17, flexShrink: 0, display: 'grid', placeItems: 'center',
                    background: ultimo ? KP.mint : KP.blue, color: '#fff', fontSize: 15, fontWeight: 800,
                  }}>
                    {ultimo ? <Check size={18} strokeWidth={3} /> : i + 1}
                  </span>
                  <div style={{ minWidth: 0 }}>
                    <h3 style={{ fontSize: 19, fontWeight: 800, color: KP.ink, margin: '4px 0 0', letterSpacing: -0.3, lineHeight: 1.25, textWrap: 'balance' }}>{p.titulo}</h3>
                    {p.texto && <p style={{ fontSize: 14.5, color: KP.ink2, fontWeight: 500, lineHeight: 1.5, margin: '6px 0 0' }}>{p.texto}</p>}
                  </div>
                </div>
                {acciones.length > 0 && (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {acciones.map((a, j) => <Accion key={a.texto} accion={a} principal={j === 0} />)}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0 2px' }}>
                <Pantalla paso={p} app={app} esCompu rol={rol} />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* Elegir la IA: una de dos o tres, todas a la vista, como el segmentado de `components/ui` pero con su logo. */
function SelectorDeApp({ opciones, elegida, onElegir }) {
  return (
    <div role="radiogroup" aria-label="Tu IA" style={{ display: 'flex', gap: 3, padding: 4, borderRadius: 16, background: UI.relleno }}>
      {opciones.map((o) => {
        const activa = o.id === elegida;
        return (
          <button
            key={o.id} type="button" role="radio" aria-checked={activa} onClick={() => onElegir(o.id)}
            style={{
              flex: '1 1 0', minWidth: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              minHeight: 50, padding: '0 10px', borderRadius: 12, cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: activa ? 800 : 600,
              border: 'none', background: activa ? '#fff' : 'transparent', color: activa ? KP.ink : KP.ink2, boxShadow: activa ? '0 1px 4px rgba(17,19,24,0.12)' : 'none',
            }}
          >
            <MarcaIA app={o.id} size={26} /> {o.nombre}
          </button>
        );
      })}
    </div>
  );
}

/* En el celular los pasos se LEEN, pero se hacen en una computadora (Andrés, 6 oct 2026: «que la persona
   quiere las instrucciones en el teléfono pero las acciones las hace en su compu: un mensaje y ya»). */
function AvisoCompu() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10, background: KP.blueSoft, color: KP.ink, borderRadius: 16,
      padding: '12px 14px', fontSize: 14.5, fontWeight: 700, lineHeight: 1.35,
    }}>
      <Monitor size={20} color={KP.blue} strokeWidth={2.4} style={{ flexShrink: 0 }} />
      Estos pasos se hacen en una computadora.
    </div>
  );
}

/* Las IAs que están conectadas DE VERDAD, una por IA (ver `conexiones.js`): antes se listaban los permisos dados
   alguna vez y a Andrés le salían 9 «conectadas» cuando eran 3. */
function IAsConectadas() {
  const pregunta = useConfirmacion();
  // null = cargando · [] = ninguna · 'no' = el servidor de permisos no responde
  const [conexiones, setConexiones] = useState(null);

  useEffect(() => {
    let vivo = true;
    Promise.all([supabase.auth.oauth.listGrants(), supabase.rpc('mis_conexiones_ia')]).then(([permisos, sesiones]) => {
      if (!vivo) return;
      if (permisos.error) { setConexiones('no'); return; }
      // Si no se pudo preguntar por las sesiones, se muestran los permisos (sin repetir cada IA).
      setConexiones(agrupaConexiones(permisos.data ?? [], sesiones.error ? null : (sesiones.data ?? [])));
    });
    return () => { vivo = false; };
  }, []);

  async function desconectar(c) {
    const va = await pregunta({
      titulo: `¿Desconectar ${c.nombre}?`,
      detalle: 'Deja de poder entrar a tu cuenta en ese momento. La puedes volver a conectar cuando quieras.',
      confirmar: 'Desconectar',
      peligro: true,
    });
    if (!va) return;
    // Todos los clientes de esa IA (ChatGPT, Codex y Hermes registran uno nuevo en cada intento): así se van también
    // los permisos viejos. Solo importa que los VIVOS se hayan desconectado.
    const resultados = await Promise.all(c.clientes.map(async (clientId) => ({
      clientId, ...(await supabase.auth.oauth.revokeGrant({ clientId })),
    })));
    const fallo = resultados.some((r) => r.error && c.vivos.includes(r.clientId));
    if (!fallo) setConexiones((xs) => (Array.isArray(xs) ? xs.filter((x) => x.familia !== c.familia) : xs));
  }

  if (conexiones === 'no') return null;

  return (
    <Grupo titulo="Tus IAs conectadas">
      {conexiones === null && <Fila texto="Revisando…" derecha={<Loader2 size={17} className="spin" color={KP.ink3} />} />}
      {Array.isArray(conexiones) && conexiones.length === 0 && <Fila texto="Todavía no has conectado ninguna" valorTono="neutro" />}
      {Array.isArray(conexiones) && conexiones.map((c) => (
        <Fila
          key={c.familia} izquierda={<MarcaIA app={c.familia} size={36} />} texto={c.nombre}
          detalle={c.desde ? `Conectada desde el ${new Date(c.desde).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}` : 'Conectada'}
          derecha={<Boton tipo="peligro" chico icono={Unplug} onClick={() => desconectar(c)}>Desconectar</Boton>}
        />
      ))}
    </Grupo>
  );
}

export default function ConectarIA({ enPerfil = false }) {
  const { profile } = useAuth();
  const { t } = usePalabras();
  const esCompu = useIsDesktop();
  const esAtleta = profile?.role !== 'admin';
  const rol = esAtleta ? 'atleta' : 'coach';

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
    : [t('¿Cómo van mis atletas esta semana?'), 'Ana hizo 4 de 4 sesiones. Juan va 2 de 4 y anotó dolor de rodilla.'];

  return (
    <div id="conectar-ia" style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, maxWidth: enPerfil ? undefined : 820, scrollMarginTop: 16 }}>
      {/* LO QUE SE GANA, antes que los pasos: sin esto, es una lista de clics sin porqué. Solo el título y un ejemplo: más texto saturaba (Andrés, 6 oct 2026). */}
      <div style={{
        borderRadius: 24, padding: esCompu ? 26 : 20, color: '#fff', position: 'relative', overflow: 'hidden',
        background: UI.azul, boxShadow: UI.azulSombra,
        display: esCompu ? 'grid' : 'flex', gridTemplateColumns: '1fr 1fr', flexDirection: 'column', gap: 18, alignItems: 'center',
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, opacity: 0.75 }}>Conectar con tu IA</div>
          <h2 style={{ fontSize: esCompu ? 28 : 23, fontWeight: 800, margin: '6px 0 6px', letterSpacing: -0.5, lineHeight: 1.12, textWrap: 'balance' }}>
            {esAtleta ? 'Tu entrenamiento, en tu IA' : 'Tu equipo, en tu IA'}
          </h2>
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

      {/* Lo que ya está conectado va arriba de los pasos (reestructura visual, 15 oct 2026): primero cómo está, luego cómo conectar otra. */}
      <IAsConectadas />

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
                  border: 'none', boxShadow: '0 1px 2px rgba(17,19,24,0.04)', background: activa ? KP.blueSoft : KP.surface,
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
        <div style={{ fontSize: 16, fontWeight: 700, color: KP.ink, margin: '4px 4px 8px' }}>
          {rama === 'mcp' ? 'Elige tu herramienta' : 'Elige tu IA'}
        </div>
        <SelectorDeApp opciones={opciones} elegida={appValida} onElegir={setApp} />
      </div>

      {rama === 'mcp' && !esCompu && (
        <div style={{ fontSize: 13.5, fontWeight: 700, color: KP.amber, background: KP.amberSoft, borderRadius: 14, padding: '10px 14px' }}>
          Esto se hace en la terminal de tu compu.
        </div>
      )}

      {!esCompu && rama === 'conectores' && <AvisoCompu />}
      <Guia key={`${appValida}-${esCompu}`} app={appValida} esCompu={esCompu} rol={rol} />

      <style>{`
        .spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
        /* estilo-ok: pulso que señala dónde tocar */ .tl-toca::after{content:"";position:absolute;inset:-4px;border-radius:12px;border:2px solid ${KP.blue};animation:tl-late 1.6s ease-out infinite;pointer-events:none}
        @keyframes tl-late{0%{opacity:.9;transform:scale(1)}100%{opacity:0;transform:scale(1.08)}}
        @media (prefers-reduced-motion: reduce){.tl-toca::after{animation:none;opacity:.6}}
      `}</style>
    </div>
  );
}
