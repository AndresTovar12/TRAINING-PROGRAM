import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { T, FONT, KP, NUM_STYLE } from '@/lib/theme';
import { usePlan } from '@/contexts/PlanContext';
import { bloquesDeTexto, normalizaCiencia } from '@/lib/ciencia';

/**
 * La CIENCIA del plan, como la ve el atleta (se abre desde la tarjeta «Ciencia» de Home).
 *
 * Antes era texto fijo del programa de Andrés para todos. Ahora son los recuadros que el coach (o su IA) escribió
 * en ESE plan: primero los de todo el plan, luego los de cada fase bajo su nombre. Ver `lib/ciencia.js`.
 */

const estiloTexto = { fontSize: 13.5, color: T.text2, lineHeight: 1.7 };

const Subtitulo = ({ children }) => (
  <div style={{
    fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4, color: T.text3,
    margin: '14px 0 6px',
  }}>{children}</div>
);

/** El texto de un recuadro: párrafos, viñetas, subtítulos y tablas de «nombre | valor | nota». */
export function TextoDeCiencia({ texto }) {
  const bloques = bloquesDeTexto(texto);
  return (
    <div style={estiloTexto}>
      {bloques.map((b, i) => {
        if (b.tipo === 'subtitulo') return <Subtitulo key={i}>{b.texto}</Subtitulo>;
        if (b.tipo === 'lista') {
          return (
            <ul key={i} style={{ listStyleType: 'disc', paddingLeft: 18, margin: '0 0 10px' }}>
              {b.items.map((it, k) => <li key={k} style={{ marginBottom: 2 }}>{it}</li>)}
            </ul>
          );
        }
        if (b.tipo === 'tabla') {
          return (
            <div key={i} style={{ margin: '0 0 10px' }}>
              {b.filas.map((f, k) => (
                <div key={k} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: k > 0 ? `1px solid ${T.border}` : 'none' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: f.nota ? 2 : 0 }}>{f.nombre}</div>
                    {f.nota && <div style={{ fontSize: 12, color: T.text3 }}>{f.nota}</div>}
                  </div>
                  {f.valor && (
                    <div style={{ fontSize: 13, fontWeight: 700, color: T.accent, alignSelf: 'flex-start', textAlign: 'right', ...NUM_STYLE }}>{f.valor}</div>
                  )}
                </div>
              ))}
            </div>
          );
        }
        return <p key={i} style={{ margin: '0 0 10px', whiteSpace: 'pre-line' }}>{b.texto}</p>;
      })}
    </div>
  );
}

/** Un recuadro que se abre y se cierra. */
export function Recuadro({ titulo, texto, abierto = false }) {
  const [open, setOpen] = useState(abierto);
  return (
    <div style={{
      background: T.bg2, border: `1px solid ${KP.line}`, borderRadius: 20, overflow: 'hidden', boxShadow: KP.shCard,
    }}>
      <button
        type="button" onClick={() => setOpen(!open)} aria-expanded={open}
        style={{
          width: '100%', padding: '15px 18px', background: 'transparent', border: 'none', color: T.text,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
          cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, textAlign: 'left',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0 }}>
          <Sparkles size={14} style={{ color: T.accent, flexShrink: 0 }} />
          <span style={{ minWidth: 0 }}>{titulo || 'Sin título'}</span>
        </span>
        {open ? <ChevronUp size={16} style={{ color: T.text3, flexShrink: 0 }} /> : <ChevronDown size={16} style={{ color: T.text3, flexShrink: 0 }} />}
      </button>
      {open && <div style={{ padding: '0 18px 18px' }}><TextoDeCiencia texto={texto} /></div>}
    </div>
  );
}

export default function CienciaDelPlan() {
  const { ciencia, phases, estructura } = usePlan();
  const delPlan = normalizaCiencia(ciencia);
  const porFase = (phases ?? [])
    .map((f) => ({ fase: f, recuadros: normalizaCiencia(f?.ciencia) }))
    .filter((x) => x.recuadros.length > 0);
  const conFases = estructura !== 'rutina';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: FONT }}>
      {delPlan.map((r, i) => <Recuadro key={r.id} titulo={r.titulo} texto={r.texto} abierto={i === 0} />)}
      {porFase.map(({ fase, recuadros }) => (
        <div key={fase.id} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {conFases && (
            <div style={{
              fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4, color: T.text3,
              margin: delPlan.length || porFase[0]?.fase !== fase ? '12px 2px 0' : '0 2px',
            }}>
              {fase.name}
            </div>
          )}
          {recuadros.map((r) => <Recuadro key={r.id} titulo={r.titulo} texto={r.texto} />)}
        </div>
      ))}
    </div>
  );
}
