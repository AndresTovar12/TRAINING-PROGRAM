import { T } from '@/lib/theme';

/**
 * El cuadrito de un tipo de sesión: su color al 20 % de fondo y su ícono encima, más oscuro para que se lea. Es el mismo cuadro que lleva la tarjeta
 * del día (`aspectoDelTipo` ya trae `mosaico` y `tinta` calculados), así que el coach reconoce el tipo en el selector igual que lo verá su atleta.
 *
 * `aspecto` es lo que devuelve `aspectoDelTipo(día)`; `tam`, el lado en px.
 */
export default function MosaicoDeTipo({ aspecto, tam = 30 }) {
  const { Icono, mosaico, tinta } = aspecto;
  return (
    <span
      aria-hidden="true"
      style={{
        width: tam, height: tam, borderRadius: Math.round(tam * 0.33), flexShrink: 0, display: 'grid', placeItems: 'center',
        background: mosaico ?? T.bg3, color: tinta ?? T.text2,
      }}
    >
      <Icono size={Math.round(tam * 0.57)} strokeWidth={2.1} />
    </span>
  );
}
