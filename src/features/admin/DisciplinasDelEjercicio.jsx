import { Check } from 'lucide-react';
import { T, FONT, UI } from '@/lib/theme';
import { FAMILIAS } from '@/lib/fichaDelEjercicio';
import { ICONO_DE_DISCIPLINA, ORDEN_DISCIPLINAS as ORDEN, CORTO } from '@/lib/disciplinas';

/* LAS DISCIPLINAS DE UN EJERCICIO (acordado con Andrés en imágenes, 19 nov 2026).
   · Son las mismas Disciplinas fijas de la app que tiene cada sesión, con sus mismos íconos. No son las categorías: las categorías son del
     coach (las crea y las borra) y sirven para navegar su repertorio; el editor no puede depender de ellas. Las Disciplinas no se borran.
   · Un ejercicio puede tener varias (Andrés: «un ejercicio que sirva para diferentes»). Se marcan solas según en qué sesiones se usa;
     el coach las puede marcar o desmarcar.
   · Sirven para que el repertorio enseñe primero los ejercicios de la Disciplina de la sesión. Solo cambian el orden: no esconden nada.
   · «Libre» va igual que las demás (Andrés: «no me gusta que libre sea diferente»). Clase y Deporte van separadas. */
export default function DisciplinasDelEjercicio({ valor = [], onCambio }) {
  const marcadas = new Set(valor);
  const cambia = (f) => {
    const siguiente = new Set(marcadas);
    if (siguiente.has(f)) siguiente.delete(f); else siguiente.add(f);
    onCambio(ORDEN.filter((x) => siguiente.has(x)));
  };
  return (
    <div style={{ background: UI.tarjeta, borderRadius: UI.rGrupo, boxShadow: UI.sombraGrupo, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 10 }}>
        <span id="disciplinas-titulo" style={{ fontSize: 16, fontWeight: 800, color: T.text, fontFamily: FONT }}>Disciplinas</span>
        {marcadas.size > 0 && <span style={{ fontSize: 12.5, fontWeight: 700, color: T.accent }}>{marcadas.size === 1 ? '1 marcada' : `${marcadas.size} marcadas`}</span>}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text2, lineHeight: 1.4, margin: '3px 0 12px' }}>
        Se marcan solas según en qué sesiones lo usas. Puedes marcar varias.
      </div>
      <div role="group" aria-labelledby="disciplinas-titulo" className="tl-disc-rejilla">
        {ORDEN.map((f) => {
          const on = marcadas.has(f);
          const Icono = ICONO_DE_DISCIPLINA[f];
          const nombre = CORTO[f] ?? FAMILIAS[f]?.nombre ?? f;
          return (
            <button key={f} type="button" aria-pressed={on} onClick={() => cambia(f)} className="kp-press" data-disciplina={f}
              style={{
                position: 'relative', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 6,
                height: 68, padding: '0 2px', borderRadius: 13, border: 'none', cursor: 'pointer', fontFamily: FONT,
                background: on ? T.accentBg : UI.relleno, color: on ? T.accent : T.text,
              }}>
              <Icono size={21} strokeWidth={2} color={on ? T.accent : '#4B505C'} aria-hidden="true" />
              <span style={{ fontSize: 11.5, fontWeight: on ? 800 : 700, whiteSpace: 'nowrap' }}>{nombre}</span>
              {on && (
                <i aria-hidden="true" style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: '50%', background: T.accent, display: 'grid', placeItems: 'center' }}>
                  <Check size={10} strokeWidth={3.6} color="#fff" />
                </i>
              )}
            </button>
          );
        })}
      </div>
      <style>{'.tl-disc-rejilla{display:grid;grid-template-columns:repeat(4,1fr);gap:7px}@media (min-width:720px){.tl-disc-rejilla{grid-template-columns:repeat(6,1fr)}}'}</style>
    </div>
  );
}
