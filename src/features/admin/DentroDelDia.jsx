import { T, tipoDeSesion } from '@/lib/theme';
import { textoMeta } from '@/lib/medidas';
import { vueltasDe } from '@/lib/porVuelta';
import { parseBlocks, setTag } from '@/lib/setsDeUnaSesion';

/**
 * Lo que hay DENTRO de una sesión, en solo lectura: su lista de ejercicios («Ver el plan» de un atleta).
 *
 * Andrés, 7 oct 2026: «del lado izquierdo queda muy vacío, se podría poner algún elemento visual como bullets»,
 * y después: «solo ten cuidado porque también debes tomar en cuenta los espacios entre bi-series, tri-series…».
 * Por eso no es una viñeta por línea sin más: la lista se agrupa como la ven el editor y el atleta (`parseBlocks`),
 * así que lo que va junto se VE junto.
 *   · Cada ejercicio lleva su viñeta, del color de su sesión (la naranja de la mañana, la azul de la tarde…).
 *   · Un Set de dos o más ejercicios (bi-serie, tri-serie, circuito) lleva una línea al lado y su etiqueta
 *     («Set 2 · Bi-serie · 3 vueltas»): las vueltas se dicen ahí, no en cada renglón.
 *   · Dentro de un Set los ejercicios van pegados; entre Sets hay más aire.
 *   · Un Set de un solo ejercicio es solo su viñeta: no necesita etiqueta.
 *   · Las notas (un «CLUSTER», una indicación) van como texto chico entre los Sets.
 */
export default function DentroDelDia({ day }) {
  const color = tipoDeSesion(day).c;
  const bloques = parseBlocks(day.exercises || []);

  // «4 × 30 yd», no «4 × 30»: la unidad es parte de lo que el coach mandó. Si cambia de una vuelta a otra
  // se dice eso y no los números en fila («10-8-6-4» se lee como un drop set); el detalle está en el editor.
  // En un Set de varios ejercicios las vueltas ya las dice la etiqueta del Set: aquí solo lo de cada uno.
  const dosis = (e, enSet) => (vueltasDe(e)
    ? `${e.sets} vueltas distintas`
    : (enSet ? [textoMeta(e)] : [e.sets, textoMeta(e)]).filter(Boolean).join(' × ') + (e.intensity ? ` · ${e.intensity}` : ''));

  const fila = (e, i, enSet) => (
    <div key={i} style={{ position: 'relative', display: 'flex', alignItems: 'baseline', gap: 8, padding: '4px 0 4px 16px' }}>
      <i aria-hidden="true" style={{ position: 'absolute', left: 0, top: 10, width: 6, height: 6, borderRadius: '50%', background: color }} />
      {/* El nombre nunca se queda sin sitio: una dosis larga («3 × 5 reps por lado · Máxima velocidad») baja de renglón. */}
      <span style={{ flex: '1 1 45%', minWidth: 0, fontSize: 12, fontWeight: 600, color: T.text, overflowWrap: 'anywhere' }}>
        {e.name}
      </span>
      <span style={{ flex: '0 1 auto', maxWidth: '55%', textAlign: 'right', fontSize: 11.5, fontWeight: 700, color: T.text2 }}>
        {dosis(e, enSet)}
      </span>
    </div>
  );

  if (!bloques.length) {
    return (
      <div style={{ padding: '6px 4px 10px 14px', fontSize: 11.5, fontWeight: 600, color: T.text3 }}>
        Este día no tiene ejercicios.
      </div>
    );
  }

  // El aire extra va ALREDEDOR de los Sets de varios ejercicios y de las notas; varios Sets de un solo ejercicio
  // seguidos (una sesión de drills) quedan juntos, como una lista.
  const esVarios = (x) => x?.type === 'set' && x.members.length > 1;
  const aireDe = (bi) => (bi > 0 && (esVarios(bloques[bi]) || esVarios(bloques[bi - 1]) || bloques[bi].type === 'note') ? 12 : 0);

  return (
    <div style={{ padding: '4px 6px 10px 14px', display: 'flex', flexDirection: 'column' }}>
      {bloques.map((b, bi) => {
        if (b.type === 'note') {
          return (
            <div key={bi} style={{ marginTop: aireDe(bi), fontSize: 11.5, fontWeight: 600, color: T.text2, padding: '0 0 0 16px', lineHeight: 1.45 }}>
              {b.ex.text}
            </div>
          );
        }
        // «Set N»: cuenta los Sets hasta este (las notas no cuentan).
        const numero = bloques.slice(0, bi + 1).filter((x) => x.type === 'set').length;
        const varios = b.members.length > 1;
        const vueltas = b.rounds != null && String(b.rounds).trim() ? `${b.rounds} ${Number(b.rounds) === 1 ? 'vuelta' : 'vueltas'}` : null;
        const etiqueta = varios ? [`Set ${numero}`, setTag(b.members.length), vueltas].filter(Boolean).join(' · ') : null;
        return (
          <div
            key={bi}
            style={{ marginTop: aireDe(bi), ...(varios ? { borderLeft: `2px solid ${color}66`, paddingLeft: 12, marginLeft: -1 } : null) }}
          >
            {etiqueta && (
              <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color, padding: '0 0 3px 16px' }}>
                {etiqueta}
              </div>
            )}
            {b.members.map((e, i) => fila(e, i, varios))}
          </div>
        );
      })}
    </div>
  );
}
