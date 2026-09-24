import ListaDesplegable from '@/components/ListaDesplegable';
import { MEDIDAS, leeCantidad, medida as uni } from '@/lib/medidas';
import { T, FONT } from '@/lib/theme';

/**
 * Cuánto hace el atleta, y de qué.
 *
 * LA LISTA ESTÁ EN EL RÓTULO, NO AL LADO. Idea de Andrés, 24 sep 2026: "en
 * lugar de poner el botón al lado, en donde dice reps que ese sea un botón con
 * lista desplegable, y al lado ya solo aparece la unidad de medida necesaria".
 *
 * Es mejor que un control aparte por dos motivos. En el teléfono la fila ya va
 * apretada —series, cantidad, carga— y un campo más la parte; y el rótulo
 * estaba ahí sin hacer nada, diciendo siempre "Reps" aunque debajo pusiera
 * "30 yd".
 *
 * En la tabla de computadora no hay rótulo por fila —lo dice el encabezado—,
 * así que ahí la lista se abre desde la unidad que va dentro del campo.
 */
export default function CampoCantidad({
  ex, onPatch, conRotulo = true, estiloInput, placeholder, ancho,
}) {
  const { cantidad, unidad: id, libre } = leeCantidad(ex);
  const u = uni(id);

  const opciones = MEDIDAS.map((o) => ({ valor: o.id, etiqueta: o.etiqueta }));

  /* En la celda de la tabla el botón lee "reps" y no "Repeticiones": el hueco
     es de 112 px y el nombre entero se salía por la izquierda, encima del
     nombre del ejercicio. La lista abierta sigue diciéndolo entero, que es
     donde hace falta entenderlo. En el rótulo NO se acorta: ahí tiene su
     propia línea y se lee mejor completo. */
  const opcionesCortas = MEDIDAS.map((o) => ({ valor: o.id, etiqueta: o.etiqueta, corta: o.corta }));

  /* Al cambiar de unidad se guarda la cantidad LIMPIA. Si venía "30 yd" y se
     pasa a metros, queda "30" con unidad metros: dejar el "yd" dentro del
     texto haría que se leyera "30 yd m". Un valor que no se entiende —"5/lado"—
     se respeta tal cual: el atleta necesita ese "/lado". */
  const cambiaUnidad = (nueva) => {
    onPatch({ reps: libre ? (ex?.reps ?? '') : cantidad, unidad: nueva });
  };

  const escribe = (texto) => {
    /* Se guarda lo tecleado y la unidad que está puesta. Así, en cuanto el
       coach toca este campo, el ejercicio deja de depender de que alguien
       adivine su unidad más tarde. */
    onPatch({ reps: texto, unidad: id });
  };

  const campo = (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input
        value={libre ? (ex?.reps ?? '') : cantidad}
        onChange={(e) => escribe(e.target.value)}
        placeholder={placeholder ?? (id === 'reps' ? '10' : '30')}
        inputMode={libre ? 'text' : 'decimal'}
        style={{
          width: '100%', boxSizing: 'border-box',
          // Hueco a la derecha para que la unidad no se encime con el número.
          paddingRight: conRotulo ? 40 : 46,
          ...estiloInput,
        }}
      />
      {conRotulo ? (
        <span style={{
          position: 'absolute', right: 10, pointerEvents: 'none',
          fontSize: 12, fontWeight: 700, color: T.text3,
        }}>
          {libre ? '' : u.corta}
        </span>
      ) : (
        // Sin rótulo arriba, la unidad ES el botón que abre la lista.
        <div style={{ position: 'absolute', right: 3 }}>
          <ListaDesplegable
            etiqueta="Unidad"
            valor={id}
            onCambio={cambiaUnidad}
            opciones={opcionesCortas}
            alto={230}
            estilo={{
              width: 'auto', border: 'none', background: 'transparent',
              padding: '4px 6px', fontSize: 12, fontWeight: 700, color: T.text3,
              borderRadius: 7,
            }}
          />
        </div>
      )}
    </div>
  );

  if (!conRotulo) return campo;

  return (
    <div style={{ minWidth: 0, width: ancho }}>
      {/* El rótulo hace de lista. Se queda con el tamaño y el color de los
          rótulos de al lado para que la fila no se descuadre. */}
      <ListaDesplegable
        etiqueta="Qué se mide"
        valor={id}
        onCambio={cambiaUnidad}
        opciones={opciones}
        alto={230}
        estilo={{
          width: 'auto', border: 'none', background: 'transparent',
          padding: '0 0 5px', minHeight: 0, gap: 4,
          fontFamily: FONT, fontSize: 11, fontWeight: 800,
          letterSpacing: 0.6, textTransform: 'uppercase', color: T.text3,
        }}
      />
      {campo}
    </div>
  );
}
