import { Fragment } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import ListaDesplegable from '@/components/ListaDesplegable';
import { estiloDeRotulo } from '@/components/estiloDeRotulo';
import { MEDIDAS, CARGAS, medida as uni } from '@/lib/medidas';
import { T, FONT } from '@/lib/theme';

/**
 * Las casillas de reps y de carga de un ejercicio en el editor, con sus vueltas y su «Por lado».
 * La lógica está en `lib/useRepsYCarga.js`; aquí solo se dibuja. Son tres piezas sueltas y no una sola
 * caja porque cada vista del editor las acomoda distinto (una fila en la compu, dos columnas en el
 * teléfono, una rejilla en las tarjetas) y las dos primeras tienen que alinearse con los demás campos:
 *
 *   <CeldaDeReps/>  <CeldaDeCarga/>   …los demás campos…
 *   <DebajoDeRepsYCarga/>             (las vueltas 2, 3, 4… y la línea de «Por lado · Por vuelta»)
 *
 * LA LISTA ESTÁ EN EL RÓTULO, SIEMPRE. Idea de Andrés, 24 sep 2026: «en donde dice reps que ese sea un
 * botón con lista desplegable, y al lado ya solo aparece la unidad de medida necesaria». Lo mismo la
 * carga («% 1RM ▾», «RPE ▾»…, 5 oct 2026). El rótulo baja a cada ejercicio porque su significado cambia
 * de uno a otro: «Back squat 5» junto a «Plancha 30 seg».
 *
 * EL NÚMERO Y LA UNIDAD NUNCA SE SUPERPONEN, por construcción: son hermanos en una caja flex, no uno
 * encima del otro. Y el `<input>` lleva `size=1` y `width: 0`: de fábrica mide veinte caracteres y ese
 * ancho es el que ensanchaba la columna («no había necesidad de que volvieras el recuadro tan grande»).
 *
 * CERRADO, LO QUE CAMBIA DE UNA VUELTA A OTRA DICE «Varía», SIN NÚMEROS. Un resumen «10-8-6-4» dentro
 * de la casilla se lee como un drop set (Andrés, 5 oct 2026). Los números van uno por fila, al desplegar.
 */

// El borde va en la caja y el espaciado en el input de dentro: si se quedara fuera, el borde se dibujaría separado del número.
function partes(estiloInput) {
  const {
    padding, width: _ancho,
    paddingLeft: _pl, paddingRight: _pr, paddingTop: _pt, paddingBottom: _pb,
    ...caja
  } = estiloInput ?? {};
  return { padding: padding ?? '7px 9px', caja };
}

// Una casilla. Con `numero`, lleva delante el de su vuelta.
function Caja({ valor, onCambio, onSalir, estiloInput, sufijo, modo = 'decimal', etiqueta, numero = null }) {
  const { padding, caja } = partes(estiloInput);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 5, minWidth: 0 }}>
      {numero !== null && (
        <span aria-hidden="true" style={{ width: 12, flexShrink: 0, textAlign: 'center', fontSize: 11.5, fontWeight: 800, color: T.text3 }}>
          {numero}
        </span>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: 1, minWidth: 0, boxSizing: 'border-box', ...caja }}>
        <input
          value={valor}
          onChange={(e) => onCambio(e.target.value)}
          onBlur={onSalir}
          inputMode={modo}
          aria-label={etiqueta}
          size={1}
          style={{
            flex: 1, width: 0, minWidth: 0, border: 'none', background: 'transparent',
            outline: 'none', padding, font: 'inherit', color: 'inherit',
          }}
        />
        {sufijo && (
          <span style={{ flexShrink: 0, paddingRight: 10, fontSize: 12, fontWeight: 700, color: T.text3 }}>{sufijo}</span>
        )}
      </div>
    </div>
  );
}

// Lo que ocupa el sitio de la casilla cuando el valor cambia de una vuelta a otra. Tocarlo despliega las vueltas.
function Varia({ estiloInput, onAbrir }) {
  const { padding, caja } = partes(estiloInput);
  return (
    <button
      type="button" onClick={onAbrir} title="Cambia de una vuelta a otra. Toca para ver cada una."
      style={{
        ...caja, display: 'block', width: '100%', boxSizing: 'border-box', padding, textAlign: 'left',
        cursor: 'pointer', color: T.accent, fontWeight: 800, touchAction: 'manipulation',
      }}
    >
      Varía
    </button>
  );
}

const repsDeFila = (rc, j, { estiloInput, compacto, conNumero }) => {
  const { valor, libre } = rc.repsDe(j);
  return (
    <Caja
      valor={valor} onCambio={(t) => rc.escribeReps(j, t)} estiloInput={estiloInput}
      modo={libre ? 'text' : 'decimal'} numero={conNumero ? j + 1 : null}
      etiqueta={j === null ? 'Cantidad' : `Cantidad de la vuelta ${j + 1}`}
      // En la lista de ejercicios el recuadro lleva solo el número: el rótulo de arriba ya dice de qué es.
      sufijo={!compacto && !libre ? uni(rc.unidad).corta : null}
    />
  );
};

const cargaDeFila = (rc, j, { estiloInput, compacto }) => (
  <Caja
    valor={rc.cargaDe(j)} onCambio={(t) => rc.escribeCarga(j, t)} onSalir={() => rc.alSalirDeCarga(j)}
    estiloInput={estiloInput} modo={rc.tipo ? 'decimal' : 'text'}
    etiqueta={j === null ? 'Carga' : `Carga de la vuelta ${j + 1}`}
    sufijo={!compacto ? rc.info?.sufijo : null}
  />
);

/** El rótulo-lista de las unidades y la casilla de reps (la única, o la de la primera vuelta). */
export function CeldaDeReps({ rc, estiloInput, compacto = false, ancho }) {
  /* EL RÓTULO SE ABREVIA SEGÚN EL SITIO, Y LA LISTA NUNCA: en la lista de ejercicios va la forma corta
     —REPS, SEG, MIN, M, KM, YD, CAL—; abierta, la lista siempre dice «Repeticiones», «Segundos»… */
  const opciones = MEDIDAS.map((o) => ({ valor: o.id, etiqueta: o.etiqueta, corta: compacto ? o.corta : o.rotulo }));
  return (
    <div style={{ minWidth: 0, width: ancho }}>
      <ListaDesplegable
        etiqueta="Qué se mide" valor={rc.unidad} onCambio={rc.cambiaUnidad} opciones={opciones}
        alto={230} estilo={estiloDeRotulo(compacto)}
      />
      {rc.desplegado
        ? repsDeFila(rc, 0, { estiloInput, compacto, conNumero: true })
        : rc.cambia.reps
          ? <Varia estiloInput={estiloInput} onAbrir={rc.alternar} />
          : repsDeFila(rc, null, { estiloInput, compacto, conNumero: false })}
    </div>
  );
}

/** El rótulo-lista del tipo de carga (% 1RM, RPE, RIR, kilos, texto libre) y su casilla. */
export function CeldaDeCarga({ rc, estiloInput, compacto = false, ancho }) {
  const opciones = [
    ...CARGAS.map((c) => ({ valor: c.id, etiqueta: c.etiqueta, corta: c.corta, detalle: c.detalle })),
    { valor: 'libre', etiqueta: 'Texto libre', corta: 'Carga', detalle: 'Escribe lo que quieras: «70% / RPE 8»' },
  ];
  return (
    <div style={{ minWidth: 0, width: ancho }}>
      <ListaDesplegable
        etiqueta="De qué es la carga" valor={rc.tipo ?? 'libre'} onCambio={rc.elegirTipo} opciones={opciones}
        alto={300} anchoMinimo={250} estilo={estiloDeRotulo(compacto)}
      />
      {rc.desplegado
        ? cargaDeFila(rc, 0, { estiloInput, compacto })
        : rc.cambia.intensity
          ? <Varia estiloInput={estiloInput} onAbrir={rc.alternar} />
          : cargaDeFila(rc, null, { estiloInput, compacto })}
    </div>
  );
}

const botonChico = {
  display: 'inline-flex', alignItems: 'center', gap: 4, minHeight: 24, padding: '0 9px', borderRadius: 999,
  cursor: 'pointer', fontFamily: FONT, fontSize: 12, fontWeight: 800, touchAction: 'manipulation', flexShrink: 0,
};

/**
 * Lo que va debajo de las dos celdas: las vueltas 2, 3, 4… cuando el ejercicio está desplegado, y la línea
 * con «Por lado» y «Por vuelta». `columnas` es la misma rejilla de las celdas de arriba, para que cada
 * casilla caiga justo debajo de la de la primera vuelta.
 *
 * Con `kp-accion`, en solo lectura se esconde lo que cambia algo: los dos botones, y la casilla «Por lado»
 * cuando no está marcada (marcada se queda: es un dato del ejercicio).
 */
export function DebajoDeRepsYCarga({ rc, estiloInput, compacto = false, columnas = '1fr 1fr' }) {
  return (
    <div style={{ minWidth: 0 }}>
      {rc.desplegado && rc.filas.length > 1 && (
        <div style={{ display: 'grid', gridTemplateColumns: columnas, gap: '6px 8px', marginTop: 6 }}>
          {rc.filas.slice(1).map((_, k) => (
            <Fragment key={k + 1}>
              {repsDeFila(rc, k + 1, { estiloInput, compacto, conNumero: true })}
              {cargaDeFila(rc, k + 1, { estiloInput, compacto })}
            </Fragment>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px 12px', marginTop: 7 }}>
        <label
          className={rc.porLado ? undefined : 'kp-accion'}
          title="Las reps son por cada lado: cada pierna, cada brazo."
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: T.text2 }}
        >
          <input
            type="checkbox" checked={rc.porLado} onChange={(e) => rc.ponLado(e.target.checked)}
            style={{ width: 16, height: 16, margin: 0, accentColor: T.accent, cursor: 'pointer' }}
          />
          Por lado
        </label>
        {rc.puedeVariar && (
          <button
            type="button" className="kp-accion" onClick={rc.alternar} aria-expanded={rc.desplegado}
            title="Reps y carga distintas en cada vuelta"
            style={{
              ...botonChico,
              // Blanco con borde azul: un botón de los suyos. Relleno cuando este ejercicio ya cambia por vuelta.
              border: `1.5px solid ${rc.hayVueltas ? 'transparent' : T.accent}`,
              background: rc.hayVueltas ? T.accentBg : '#fff', color: T.accent,
            }}
          >
            Por vuelta {rc.desplegado ? <ChevronUp size={13} strokeWidth={2.6} /> : <ChevronDown size={13} strokeWidth={2.6} />}
          </button>
        )}
        {rc.desplegado && rc.hayVueltas && (
          <button
            type="button" className="kp-accion" onClick={rc.dejarIguales}
            style={{ ...botonChico, border: `1.5px solid ${T.borderHi}`, background: '#fff', color: T.text2 }}
          >
            Dejar todas iguales
          </button>
        )}
      </div>
    </div>
  );
}
