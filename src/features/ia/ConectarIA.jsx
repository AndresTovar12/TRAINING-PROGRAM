import { useEffect, useState } from 'react';
import { Check, ChevronDown, Copy, Loader2, Unplug } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmacion } from '@/components/Confirmacion';
import { useIsDesktop } from '@/lib/useViewport';
import { FONT, KP } from '@/lib/theme';
import { LIGA_MCP, queHaceLaIA } from '@/features/ia/queHaceLaIA';

/**
 * Conectar Training Lab con la IA de cada quien.
 *
 * Andrés, 25 sep 2026: los conectores le importan para ChatGPT y Claude, y el
 * MCP para Claude Code, Codex y Hermes. Los cinco usan la MISMA liga y el
 * mismo permiso; lo único que cambia es dónde se pega. Por eso aquí hay una
 * sola liga y cinco recetas cortas.
 *
 * Dónde vive (decidido antes, en su lista de pendientes): en la compu, en el
 * menú lateral; en el teléfono NO va en la navegación, va en "Mi perfil", con
 * el botón de copiar y el aviso de que se termina desde una compu.
 */

const RECETAS = [
  {
    id: 'claude',
    nombre: 'Claude',
    donde: 'claude.ai o la app de escritorio',
    pasos: [
      'En Claude, abre Configuración → Conectores.',
      'Toca "Agregar conector personalizado".',
      'Nombre: Training Lab. URL: pega tu liga. Agrégalo.',
      'Toca "Conectar": se abre Training Lab. Entra y toca Permitir.',
      'En un chat, actívalo en el menú "+" → Conectores.',
    ],
    nota: 'En Claude gratis cabe un solo conector personalizado.',
  },
  {
    id: 'chatgpt',
    nombre: 'ChatGPT',
    donde: 'chatgpt.com, en la computadora',
    pasos: [
      'Configuración → Apps y conectores → Configuración avanzada → activa "Modo de desarrollador".',
      'Vuelve a Apps y conectores y toca "Crear".',
      'Nombre: Training Lab. URL del servidor MCP: pega tu liga. Autenticación: OAuth. Créalo.',
      'Se abre Training Lab: entra y toca Permitir.',
      'En un chat, elige Training Lab en el menú "+".',
    ],
    nota: 'Hace falta un plan de paga y solo funciona en la web. En algunos planes solo deja consultar, no anotar ni cambiar.',
  },
  {
    id: 'claude-code',
    nombre: 'Claude Code',
    donde: 'en la terminal',
    comandos: [`claude mcp add --transport http training-lab ${LIGA_MCP}`],
    pasos: ['Dentro de Claude Code escribe /mcp, elige training-lab y "Authenticate". Se abre Training Lab: entra y toca Permitir.'],
  },
  {
    id: 'codex',
    nombre: 'Codex',
    donde: 'en la terminal',
    comandos: [`codex mcp add training-lab --url ${LIGA_MCP}`, 'codex mcp login training-lab'],
    pasos: ['El segundo comando abre Training Lab: entra y toca Permitir.'],
  },
  {
    id: 'hermes',
    nombre: 'Hermes',
    donde: 'en la terminal',
    comandos: [`hermes mcp add --url ${LIGA_MCP} --auth oauth training-lab`],
    pasos: ['La primera vez se abre Training Lab: entra y toca Permitir.'],
  },
];

function Copiable({ texto, grande }) {
  const [listo, setListo] = useState(false);
  const copia = async () => {
    try {
      await navigator.clipboard.writeText(texto);
      setListo(true);
      setTimeout(() => setListo(false), 1800);
    } catch { /* sin portapapeles: el texto se puede seleccionar a mano */ }
  };
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8, background: grande ? KP.blueSoft : KP.surfaceMuted,
      border: `1px solid ${grande ? '#D7DEFB' : KP.line}`, borderRadius: 14, padding: grande ? '10px 10px 10px 14px' : '8px 8px 8px 12px',
    }}>
      <code style={{
        flex: 1, minWidth: 0, fontSize: grande ? 14.5 : 12.5, fontWeight: grande ? 700 : 600,
        color: grande ? KP.blueDk : KP.ink, overflowWrap: 'anywhere', fontFamily: grande ? FONT : 'ui-monospace, Menlo, monospace',
      }}>
        {texto}
      </code>
      <button
        type="button" onClick={copia} aria-label="Copiar"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0, minHeight: 36, padding: '0 12px',
          borderRadius: 10, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 800,
          background: grande ? KP.blue : KP.surface, color: grande ? '#fff' : KP.ink,
        }}
      >
        {listo ? <Check size={15} /> : <Copy size={15} />}
        {listo ? 'Copiada' : 'Copiar'}
      </button>
    </div>
  );
}

export default function ConectarIA({ enPerfil = false }) {
  const { profile } = useAuth();
  const esCompu = useIsDesktop();
  const pregunta = useConfirmacion();
  const { puede, noPuede } = queHaceLaIA(profile);
  const [abierta, setAbierta] = useState(null);
  // null = cargando · [] = ninguna · 'no' = todavía no se puede conectar nada
  const [conexiones, setConexiones] = useState(null);

  useEffect(() => {
    let vivo = true;
    supabase.auth.oauth.listGrants().then(({ data, error }) => {
      if (!vivo) return;
      setConexiones(error ? 'no' : (data ?? []));
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
    if (error) return;
    setConexiones((xs) => (Array.isArray(xs) ? xs.filter((x) => x.client?.id !== c.client?.id) : xs));
  }

  const tarjeta = {
    background: KP.surface, border: `1px solid ${KP.line}`, borderRadius: 20, padding: 18, boxShadow: KP.shCard,
  };
  const rotulo = { fontSize: 11.5, fontWeight: 800, color: KP.ink3, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 10 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT, maxWidth: enPerfil ? undefined : 720 }}>
      <div>
        <h2 style={{ fontSize: enPerfil ? 18 : 24, fontWeight: 800, color: KP.ink, margin: 0, letterSpacing: -0.4 }}>
          Conectar con tu IA
        </h2>
        <p style={{ fontSize: 14.5, color: KP.ink2, fontWeight: 500, lineHeight: 1.5, margin: '6px 0 0' }}>
          Usa Training Lab desde Claude, ChatGPT y otras IAs. Tu IA ve y hace lo mismo que tú en la app, nada más.
        </p>
      </div>

      <div style={tarjeta}>
        <div style={rotulo}>Tu IA podrá</div>
        {puede.map((p) => (
          <div key={p} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 7, fontSize: 14.5, color: KP.ink, fontWeight: 600, lineHeight: 1.4 }}>
            <Check size={16} color={KP.mint} strokeWidth={3} style={{ flexShrink: 0, marginTop: 2 }} />
            {p}
          </div>
        ))}
        {noPuede && <div style={{ fontSize: 13.5, color: KP.ink2, fontWeight: 600, marginTop: 4 }}>{noPuede}</div>}
      </div>

      <div style={tarjeta}>
        <div style={rotulo}>Tu liga</div>
        <Copiable texto={LIGA_MCP} grande />
        {!esCompu && (
          <p style={{ fontSize: 13.5, color: KP.ink2, fontWeight: 600, lineHeight: 1.5, margin: '12px 0 0' }}>
            Conectarla se termina desde una computadora: copia la liga y mándatela, o abre esta pantalla en la compu.
          </p>
        )}
      </div>

      <div style={tarjeta}>
        <div style={rotulo}>Cómo conectarla</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {RECETAS.map((r) => {
            const abiertaEsta = abierta === r.id;
            return (
              <div key={r.id} style={{ border: `1px solid ${abiertaEsta ? KP.lineHi : KP.line}`, borderRadius: 14, overflow: 'hidden' }}>
                <button
                  type="button" onClick={() => setAbierta(abiertaEsta ? null : r.id)} aria-expanded={abiertaEsta}
                  style={{
                    width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', textAlign: 'left',
                    border: 'none', background: abiertaEsta ? KP.surfaceMuted : KP.surface, cursor: 'pointer', fontFamily: FONT,
                  }}
                >
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: KP.ink }}>{r.nombre}</span>
                    <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: KP.ink3, marginTop: 1 }}>{r.donde}</span>
                  </span>
                  <ChevronDown size={17} color={KP.ink3} style={{ transform: abiertaEsta ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />
                </button>
                {abiertaEsta && (
                  <div style={{ padding: '4px 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(r.comandos ?? []).map((c) => <Copiable key={c} texto={c} />)}
                    <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {r.pasos.map((p) => (
                        <li key={p} style={{ fontSize: 14, color: KP.ink, fontWeight: 500, lineHeight: 1.45 }}>{p}</li>
                      ))}
                    </ol>
                    {r.nota && <div style={{ fontSize: 12.5, color: KP.ink2, fontWeight: 600, lineHeight: 1.45 }}>{r.nota}</div>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {conexiones !== 'no' && (
        <div style={tarjeta}>
          <div style={rotulo}>IAs conectadas</div>
          {conexiones === null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: KP.ink3, fontSize: 14 }}>
              <Loader2 size={15} className="spin" /> Revisando…
            </div>
          )}
          {Array.isArray(conexiones) && conexiones.length === 0 && (
            <div style={{ fontSize: 14, color: KP.ink2, fontWeight: 500 }}>Todavía no has conectado ninguna.</div>
          )}
          {Array.isArray(conexiones) && conexiones.map((c) => (
            <div key={c.client?.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: `1px solid ${KP.line}` }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14.5, fontWeight: 700, color: KP.ink }}>{c.client?.name || 'IA sin nombre'}</div>
                <div style={{ fontSize: 12.5, fontWeight: 600, color: KP.ink3 }}>
                  Desde el {new Date(c.granted_at).toLocaleDateString('es-MX', { day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
              <button
                type="button" onClick={() => desconectar(c)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 36, padding: '0 12px', borderRadius: 10,
                  border: `1.5px solid ${KP.line}`, background: KP.surface, cursor: 'pointer',
                  fontFamily: FONT, fontSize: 13, fontWeight: 700, color: KP.danger,
                }}
              >
                <Unplug size={14} /> Desconectar
              </button>
            </div>
          ))}
        </div>
      )}
      <style>{'.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );
}
