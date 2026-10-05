import { useState } from 'react';
import ListaDesplegable from '@/components/ListaDesplegable';
import { useConfirmacion } from '@/components/Confirmacion';
import { CARGAS, leeCarga, componeCarga, cantidadDeCarga } from '@/lib/medidas';
import { T, FONT } from '@/lib/theme';

/**
 * La carga de un ejercicio, y de qué es: % del 1RM, RPE, RIR o kilos.
 *
 * LA LISTA ESTÁ EN EL RÓTULO, igual que el «REPS ▾» de al lado (ver `CampoCantidad`): Andrés, pendiente
 * #7 (5 oct 2026), «lista desplegable para la carga: kg, RIR, RPE, % 1RM». Con un tipo elegido, la cajita
 * es solo un número; el «%» o el «RPE» los pone la app al guardar. Sin tipo, el campo es el de siempre,
 * texto libre («70% / RPE 8»), y el rótulo dice «CARGA ▾».
 *
 * NO HAY UN CAMPO NUEVO NI SE TOCA UN PLAN YA ESCRITO. Lo guardado sigue siendo un texto (`ex.intensity`)
 * y el tipo se deduce de él (ver `leeCarga`). Lo que no encaja se queda libre y se enseña tal cual.
 *
 * LO ELEGIDO EN LA LISTA SE RECUERDA AQUÍ (`elegido`), no en el plan: con la cajita vacía no hay texto del
 * que deducir el tipo, y sin esa memoria el rótulo volvería a «CARGA» en cuanto se eligiera «RPE». Un
 * campo vacío no tiene nada que guardar; al escribir el primer número, el tipo ya queda en el texto.
 *
 * QUÉ PASA AL CAMBIAR DE TIPO. Un 75 de porcentaje no es un 75 de RPE: el número no se traspasa. Con
 * un número de otro tipo se borra (se vuelve a teclear en dos segundos); con TEXTO LIBRE se pregunta
 * antes, porque ese texto puede ser lo más elaborado que escribió el coach.
 */
export default function CampoCarga({ ex, onPatch, estiloInput, ancho, compacto = false }) {
  const pregunta = useConfirmacion();
  const [elegido, setElegido] = useState(null);
  const leida = leeCarga(ex);
  const crudo = String(ex?.intensity ?? '').trim();

  // Lo que el texto dice manda; lo elegido en la lista decide cuando el texto no dice nada (o se pidió texto libre).
  const tipo = elegido === 'libre' ? null : (leida.tipo ?? elegido);
  const info = CARGAS.find((c) => c.id === tipo) ?? null;

  const alElegir = async (nuevo) => {
    if (nuevo === 'libre') { setElegido('libre'); return; }
    if (nuevo === tipo) return;
    if (crudo && leida.tipo === null) {
      const ok = await pregunta({
        titulo: '¿Cambiar la carga?',
        detalle: `Lo que dice ahora, «${crudo}», se borra: ya no sería un solo número.`,
        confirmar: 'Sí, cambiarla',
        peligro: true,
      });
      if (!ok) return;
    }
    if (crudo) onPatch({ intensity: '' });
    setElegido(nuevo);
  };

  const opciones = [
    ...CARGAS.map((c) => ({ valor: c.id, etiqueta: c.etiqueta, corta: c.corta, detalle: c.detalle })),
    { valor: 'libre', etiqueta: 'Texto libre', corta: 'Carga', detalle: 'Escribe lo que quieras: «70% / RPE 8»' },
  ];

  const valor = tipo ? cantidadDeCarga(tipo, crudo) : (ex?.intensity ?? '');
  const escribe = (texto) => {
    if (!tipo) { onPatch({ intensity: texto }); return; }
    // Solo cifras, coma o punto y la raya de un rango: lo demás no es un número y se descarta al teclear.
    onPatch({ intensity: componeCarga(tipo, texto.replace(/[^\d.,\-–]/g, '')) });
  };
  /* Al salir del campo se limpia un rango que se quedó a medias («7-»): mientras se teclea tiene que
     poder existir, o no se podría escribir «7-8». */
  const alSalir = () => {
    if (!tipo || !crudo) return;
    const limpio = valor.replace(/^[-–.,]+|[-–.,]+$/g, '');
    if (limpio !== valor) onPatch({ intensity: componeCarga(tipo, limpio) });
  };

  // Mismo reparto de estilos que `CampoCantidad`: el espaciado va al input de dentro, el borde a la caja.
  const {
    padding, width: _ancho,
    paddingLeft: _pl, paddingRight: _pr, paddingTop: _pt, paddingBottom: _pb,
    ...caja
  } = estiloInput ?? {};

  return (
    <div style={{ minWidth: 0, width: ancho }}>
      <ListaDesplegable
        etiqueta="De qué es la carga"
        valor={tipo ?? 'libre'}
        onCambio={alElegir}
        opciones={opciones}
        alto={300}
        anchoMinimo={250}
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
          value={valor}
          onChange={(e) => escribe(e.target.value)}
          onBlur={alSalir}
          placeholder={info ? info.ejemplo : '70% / RPE 8'}
          inputMode={tipo ? 'decimal' : 'text'}
          aria-label={info ? `Carga: ${info.etiqueta}` : 'Carga'}
          size={1}
          style={{
            flex: 1, width: 0, minWidth: 0, border: 'none', background: 'transparent',
            outline: 'none', padding: padding ?? '7px 9px',
            font: 'inherit', color: 'inherit',
          }}
        />
        {!compacto && info?.sufijo && (
          <span style={{ flexShrink: 0, paddingRight: 10, fontSize: 12, fontWeight: 700, color: T.text3 }}>
            {info.sufijo}
          </span>
        )}
      </div>
    </div>
  );
}
