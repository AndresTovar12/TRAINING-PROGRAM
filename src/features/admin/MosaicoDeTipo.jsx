import { T } from '@/lib/theme';

/**
 * El símbolo de un tipo de sesión, SIN cuadro (6 nov 2026, «Registrar: hoja clara»): solo el dibujo, al 74 % de la caja, con trazo 1.6 y en el color del tipo (ahí el
 * color dice qué tipo es). Es el mismo dibujo que lleva la tarjeta del día (`aspectoDelTipo` ya trae `tinta`: el color del tipo, más oscuro para que se lea sin cuadro
 * de fondo), así que el coach reconoce el tipo en el selector igual que lo verá su atleta.
 *
 * `aspecto` es lo que devuelve `aspectoDelTipo(día)`; `tam`, el lado de la caja en px (las listas no se mueven).
 */
export default function MosaicoDeTipo({ aspecto, tam = 30 }) {
  const { Icono, color, tinta } = aspecto;
  return (
    <span aria-hidden="true" style={{ width: tam, height: tam, flexShrink: 0, display: 'grid', placeItems: 'center', color: tinta ?? color ?? T.text2 }}>
      <Icono size={Math.round(tam * 0.74)} strokeWidth={1.6} />
    </span>
  );
}
