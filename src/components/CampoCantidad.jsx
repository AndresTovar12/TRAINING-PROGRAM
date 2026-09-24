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

  /* EL NÚMERO Y LA UNIDAD NO SE SUPERPONEN NUNCA, POR CONSTRUCCIÓN.
     Andrés, 24 sep 2026, dos veces con captura: "de nuevo mal en la compu".

     Antes la unidad iba flotando encima del campo (`position: absolute`) y el
     hueco para ella se reservaba con un `paddingRight` en el input. Eso falló
     por dos sitios a la vez: el `estiloInput` de quien usa el componente trae
     un `padding` corto que BORRA ese `paddingRight`, y aunque no lo borrara,
     el hueco era de 46 px y el botón "reps" mide 64.

     Ahora son hermanos dentro de una caja flex: el número se queda con el
     espacio que sobra (`flex: 1, minWidth: 0`) y la unidad ocupa el suyo. No
     hay número que reservar ni orden de estilos que respetar — encimarse deja
     de ser posible.

     El borde y el fondo pasan del input a la caja, para que se siga viendo
     como un campo y no como dos cosas sueltas. */
  /* Los espaciados salen del estilo de la caja y se le dan al input de dentro:
     si se quedaran fuera, el borde se dibujaría separado del número. El `_`
     delante marca lo que se descarta a propósito. */
  const {
    padding, width: _ancho,
    paddingLeft: _pl, paddingRight: _pr, paddingTop: _pt, paddingBottom: _pb,
    ...caja
  } = estiloInput ?? {};

  const campo = (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 2, width: '100%',
      boxSizing: 'border-box', ...caja,
    }}>
      <input
        value={libre ? (ex?.reps ?? '') : cantidad}
        onChange={(e) => escribe(e.target.value)}
        placeholder={placeholder ?? (id === 'reps' ? '10' : '30')}
        inputMode={libre ? 'text' : 'decimal'}
        style={{
          flex: 1, minWidth: 0, border: 'none', background: 'transparent',
          outline: 'none', padding: padding ?? '7px 9px',
          font: 'inherit', color: 'inherit',
        }}
      />
      {conRotulo ? (
        <span style={{
          flexShrink: 0, paddingRight: 10,
          fontSize: 12, fontWeight: 700, color: T.text3,
        }}>
          {libre ? '' : u.corta}
        </span>
      ) : (
        // Sin rótulo arriba, la unidad ES el botón que abre la lista.
        <div style={{ flexShrink: 0, paddingRight: 3 }}>
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
