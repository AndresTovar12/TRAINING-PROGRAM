import { T } from '@/lib/theme';

/**
 * El símbolo de un tipo de sesión, SIN cuadro (6 nov 2026, «Registrar: hoja clara»): solo el dibujo, al 74 % de la caja, con trazo 1.6 y en el color del tipo (ahí el
 * color dice qué tipo es). Es el mismo dibujo que lleva la tarjeta del día (`aspectoDelTipo` ya trae `tinta`: el color del tipo, más oscuro para que se lea sin cuadro
 * de fondo), así que el coach reconoce el tipo en el selector igual que lo verá su atleta.
 *
 * `aspecto` es lo que devuelve `aspectoDelTipo(día)`; `tam`, el lado de la caja en px (las listas no se mueven).
 * `color` (6 nov 2026, «Tipos de sesión: un solo color en las listas»): si llega, el símbolo va de ese color en lugar del del tipo. Las listas de «Tipos de
 * sesión» y la lista que despliega el selector del editor pintan todos en el azul de la marca, como la lista del atleta al elegir su actividad; el botón
 * cerrado del selector y la tarjeta del día siguen con el color del tipo (ahí el color dice qué tipo es).
 */
export default function MosaicoDeTipo({ aspecto, tam = 30, color = null }) {
  const { Icono, tinta } = aspecto;
  return (
    <span aria-hidden="true" style={{ width: tam, height: tam, flexShrink: 0, display: 'grid', placeItems: 'center', color: color ?? tinta ?? aspecto.color ?? T.text2 }}>
      <Icono size={Math.round(tam * 0.74)} strokeWidth={1.6} />
    </span>
  );
}
