import ListaDesplegable from '@/components/ListaDesplegable';
import { PLURAL_DE_TIPO } from '@/lib/misPlanesDatos';
import { COLOR_DE_TIPO, FONDO_DE_TIPO } from '@/features/misplanes/estilos';
import { T, FONT } from '@/lib/theme';

// En el botón, el nombre corto; en la lista, el entero.
const CORTO = { workout: 'Workouts', rutina: 'Rutinas', programa: 'Programas' };

/**
 * «Ver  Todo ▾»: qué clase de cosas se enseñan (workouts, rutinas o programas). Es la misma lista
 * desplegable chiquita del filtro por persona del programa, y no una fila de pastillas: en el celular
 * la cuarta pastilla se salía de la pantalla (Andrés, 2 oct 2026). Con una clase elegida, el botón
 * lleva su color, para que se note que hay un filtro puesto.
 *
 * `valor`: `null` (todo) o una clase. `onCambio(valor)` recibe lo mismo. Con menos de dos clases no sale.
 */
export default function FiltroDeTipo({ tipos, valor, onCambio }) {
  if (tipos.length < 2) return null;
  const color = valor ? COLOR_DE_TIPO[valor] : null;
  const opciones = [
    { valor: 'todo', etiqueta: 'Todo' },
    ...tipos.map((t) => ({ valor: t, etiqueta: PLURAL_DE_TIPO[t], corta: CORTO[t], color: COLOR_DE_TIPO[t] })),
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
      <span style={{ fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: T.text3 }}>Ver</span>
      <ListaDesplegable
        valor={valor ?? 'todo'}
        onCambio={(v) => onCambio(v === 'todo' ? null : v)}
        opciones={opciones}
        etiqueta="Ver qué clase de cosas"
        estilo={{
          width: 'auto', minHeight: 42, padding: '0 11px 0 13px', borderRadius: 11, gap: 8, fontSize: 13.5, fontWeight: 800,
          color: T.text, background: color ? FONDO_DE_TIPO[valor] : T.bg2, border: `1.5px solid ${color ? `${color}66` : T.border}`,
        }}
      />
    </div>
  );
}
