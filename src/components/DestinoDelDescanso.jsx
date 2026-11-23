import { ArrowRight, RotateCcw } from 'lucide-react';
import { T } from '@/lib/theme';

/**
 * CADA DESCANSO APUNTA A LO QUE SIGUE (Andrés, 21 nov 2026, después de varias maquetas: «se tiene que pensar
 * demasiado»). Hoy había tres nombres de categoría: «entre ejercicios», «entre vueltas» y «después del Set», y en la
 * última vuelta no se sabía si se sumaban. Ahora el rótulo dice a dónde vas al terminar el descanso:
 *   · «Descanso → ②»: descansas y sigues con el ejercicio 2 del Set;
 *   · «Descanso ↻ ①»: descansas y vuelves a empezar el Set (en un Set de un ejercicio, solo «↻»);
 *   · en la raya, «2 min → Set 3»: descansas y pasas al Set 3.
 * En la última vuelta no se vuelve a empezar, así que la única flecha que sale del Set es la de la raya.
 * NO CAMBIA NINGÚN DATO: el de «↻» es el `descanso` del último ejercicio, el mismo que antes iba en la cabecera.
 */

/** El número de un ejercicio dentro de su Set: el mismo círculo en la tarjeta y en el rótulo que apunta a él. */
export function NumeroEnElSet({ n, grande = false }) {
  const lado = grande ? 24 : 20;
  return (
    <span
      aria-hidden="true"
      style={{
        display: 'inline-grid', placeItems: 'center', width: lado, height: lado, borderRadius: '50%', flexShrink: 0,
        background: '#E8EDFB', color: T.accent, fontWeight: 800, fontSize: grande ? 13 : 12, lineHeight: 1,
      }}
    >
      {n}
    </span>
  );
}

const oculto = { position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)', whiteSpace: 'nowrap' };

/** Lo que dice el rótulo, para lectores de pantalla y para las pruebas. */
const textoDelDestino = (destino) => {
  if (!destino) return 'Descanso';
  if (destino.tipo === 'sigue') return `Descanso antes del ejercicio ${destino.n}`;
  return destino.n ? `Descanso antes de volver al ejercicio ${destino.n}` : 'Descanso antes de repetir';
};

/** «Descanso → ②» o «Descanso ↻ ①». `destino`: { tipo: 'sigue' | 'vuelve', n }. */
export default function DestinoDelDescanso({ destino }) {
  const Icono = destino?.tipo === 'sigue' ? ArrowRight : RotateCcw;
  return (
    <span data-destino={destino ? `${destino.tipo}${destino.n ?? ''}` : ''} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, whiteSpace: 'nowrap' }}>
      <span aria-hidden="true">Descanso</span>
      {destino && <Icono aria-hidden="true" size={14} strokeWidth={2.6} style={{ flexShrink: 0 }} />}
      {destino?.n ? <NumeroEnElSet n={destino.n} /> : null}
      <span style={oculto}>{textoDelDestino(destino)}</span>
    </span>
  );
}
