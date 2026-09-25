import ListaDesplegable from '@/components/ListaDesplegable';
import { MEDIDAS, leeCantidad, medida as uni } from '@/lib/medidas';
import { T, FONT } from '@/lib/theme';

/**
 * Cuánto hace el atleta, y de qué.
 *
 * LA LISTA ESTÁ EN EL RÓTULO, SIEMPRE. Idea de Andrés, 24 sep 2026: "en donde
 * dice reps que ese sea un botón con lista desplegable, y al lado ya solo
 * aparece la unidad de medida necesaria".
 *
 * Hubo un intento de meterla DENTRO del recuadro para la tabla de computadora
 * —donde el rótulo lo pone el encabezado de la columna, uno para todas las
 * filas—. No valió: "la lista desplegable se suponía que debía de ser el valor
 * que estaba arriba del recuadro. no el recuadro mismo, y no había necesidad de
 * que volvieras el recuadro tan grande".
 *
 * Así que en la tabla el rótulo baja a cada fila (modo `compacto`) y el
 * encabezado de esa columna se queda vacío. Baja solo ese, no todos: es la
 * única columna cuyo significado cambia de un ejercicio a otro. En los planes
 * de Andrés, 106 de 220 sets mezclan unidades —"Back squat 5" junto a "Plancha
 * 30 seg"—, así que una sola lista para toda la columna habría cambiado los dos
 * a la vez.
 *
 * EL NÚMERO Y LA UNIDAD NUNCA SE SUPERPONEN, por construcción: son hermanos en
 * una caja flex, no uno encima del otro. Un intento anterior reservaba hueco
 * con `paddingRight` y el `estiloInput` de fuera lo borraba con su `padding`
 * corto; con flex no hay hueco que reservar ni orden de estilos que respetar.
 */
export default function CampoCantidad({
  ex, onPatch, estiloInput, placeholder, ancho, compacto = false,
}) {
  const { cantidad, unidad: id, libre } = leeCantidad(ex);
  const u = uni(id);

  /* EL RÓTULO SE ABREVIA SEGÚN EL SITIO, Y LA LISTA NUNCA.
     Andrés: "no había necesidad de que volvieras el recuadro tan grande".

     El ancho de una columna lo fija su contenido más ancho, y el rótulo cuenta.
     Medido: con "REPETICIONES" la columna se iba a 229 px y con "SEGUNDOS" a
     192, cuando antes de todo esto eran 105. En la tabla va la forma corta
     —REPS, SEG, MIN, M, KM, YD, CAL— que cabe de sobra. En un formulario, donde
     el rótulo tiene su propia línea, va el nombre entero.

     La lista abierta siempre dice "Repeticiones", "Segundos", "Kilómetros":
     ahí hay sitio y es donde hace falta entenderlo. */
  const opciones = MEDIDAS.map((o) => ({
    valor: o.id,
    etiqueta: o.etiqueta,
    corta: compacto ? o.corta : o.rotulo,
  }));

  /* Al cambiar de unidad se guarda la cantidad LIMPIA. Si venía "30 yd" y se
     pasa a metros, queda "30" con unidad metros: dejar el "yd" dentro del
     texto haría que se leyera "30 yd m". Un valor que no se entiende —"5/lado"—
     se respeta tal cual: el atleta necesita ese "/lado". */
  const cambiaUnidad = (nueva) => {
    onPatch({ reps: libre ? (ex?.reps ?? '') : cantidad, unidad: nueva });
  };

  /* Se guarda lo tecleado y la unidad que está puesta. Así, en cuanto el coach
     toca este campo, el ejercicio deja de depender de que alguien adivine su
     unidad más tarde. */
  const escribe = (texto) => onPatch({ reps: texto, unidad: id });

  /* Los espaciados salen del estilo de la caja y se le dan al input de dentro:
     si se quedaran fuera, el borde se dibujaría separado del número. El `_`
     delante marca lo que se descarta a propósito. */
  const {
    padding, width: _ancho,
    paddingLeft: _pl, paddingRight: _pr, paddingTop: _pt, paddingBottom: _pb,
    ...caja
  } = estiloInput ?? {};

  return (
    <div style={{ minWidth: 0, width: ancho }}>
      <ListaDesplegable
        etiqueta="Qué se mide"
        valor={id}
        onCambio={cambiaUnidad}
        opciones={opciones}
        alto={230}
        /* En la tabla se queda del tamaño y el color de los encabezados de las
           otras columnas, para que la fila no se descuadre; en un formulario,
           del tamaño de los rótulos de al lado. */
        estilo={{
          width: 'auto', border: 'none', background: 'transparent',
          minHeight: 0, gap: 4, borderRadius: 6,
          padding: compacto ? '0 0 3px' : '0 0 5px',
          fontFamily: FONT, fontSize: compacto ? 10 : 11, fontWeight: 800,
          letterSpacing: compacto ? 0.5 : 0.6, textTransform: 'uppercase',
          color: T.accent,
        }}
      />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 2, width: '100%',
        boxSizing: 'border-box', ...caja,
      }}>
        <input
          value={libre ? (ex?.reps ?? '') : cantidad}
          onChange={(e) => escribe(e.target.value)}
          placeholder={placeholder ?? (id === 'reps' ? '10' : '30')}
          inputMode={libre ? 'text' : 'decimal'}
          /* `size=1` y `width: 0` no son adorno: un <input> trae de fábrica un
             ancho de veinte caracteres, y ese ancho es el que una tabla usa
             para decidir cuánto mide la columna. Medido: sin esto la columna
             pasaba de 105 px a 192, que es lo que Andrés vio como "el recuadro
             tan grande". Con `flex: 1` el campo se queda igualmente con todo el
             espacio que haya. */
          size={1}
          style={{
            flex: 1, width: 0, minWidth: 0, border: 'none', background: 'transparent',
            outline: 'none', padding: padding ?? '7px 9px',
            font: 'inherit', color: 'inherit',
          }}
        />
        {/* En la tabla el recuadro lleva solo el número: el rótulo de arriba ya
            dice de qué es, y repetirlo dentro era lo que lo ensanchaba. */}
        {!compacto && (
          <span style={{
            flexShrink: 0, paddingRight: 10,
            fontSize: 12, fontWeight: 700, color: T.text3,
          }}>
            {libre ? '' : u.corta}
          </span>
        )}
      </div>
    </div>
  );
}
