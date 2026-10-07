import { useState } from 'react';
import { ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { T, FONT, KP, NUM_STYLE } from '@/lib/theme';
import { usePlan } from '@/contexts/PlanContext';
import { bloquesDeTexto, normalizaCiencia, programasConCiencia } from '@/lib/ciencia';
import { etiquetaDePrograma } from '@/lib/programas';

/**
 * La CIENCIA del plan, como la ve el atleta (se abre desde la tarjeta «Ciencia» de Home).
 *
 * Antes era texto fijo del programa de Andrés para todos. Ahora son los recuadros que el coach (o su IA) escribió
 * en ESE plan: primero los de todo el plan, luego los de cada fase bajo su nombre. Ver `lib/ciencia.js`.
 *
 * CON EQUIPO (un atleta con el programa de su coach y el de su fisio, por ejemplo) cada programa trae la suya: se
 * juntan aquí, cada una bajo el nombre de quien la escribió. Con un solo programa no se dice de quién es.
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

function DeUnPrograma({ ciencia, phases, estructura }) {
  const delPlan = normalizaCiencia(ciencia);
  const porFase = (phases ?? [])
    .map((f) => ({ fase: f, recuadros: normalizaCiencia(f?.ciencia) }))
    .filter((x) => x.recuadros.length > 0);
  // Los nombres de fase solo se dicen en un programa POR FASES: en «varias semanas» y en una rutina las fases son un detalle de adentro.
  const conFases = estructura === 'fases';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
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

export default function CienciaDelPlan() {
  const { programas, ciencia, phases, estructura } = usePlan();
  const lista = programasConCiencia(programas);

  // Un solo programa (o ninguno a la vista): sin decir de quién es.
  if (lista.length <= 1) {
    const unico = lista[0] ?? { ciencia, phases, estructura };
    return (
      <div style={{ fontFamily: FONT }}>
        <DeUnPrograma ciencia={unico.ciencia} phases={unico.phases} estructura={unico.estructura} />
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22, fontFamily: FONT }}>
      {lista.map((p) => (
        <section key={p.id}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '0 2px 10px', fontSize: 14, fontWeight: 800, color: T.text }}>
            <i style={{ width: 9, height: 9, borderRadius: 5, background: p.color || T.accent, display: 'block', flexShrink: 0 }} />
            {etiquetaDePrograma(p)}
          </div>
          <DeUnPrograma ciencia={p.ciencia} phases={p.phases} estructura={p.estructura} />
        </section>
      ))}
    </div>
  );
}
