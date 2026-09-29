import { FONT, KP } from '@/lib/theme';

/* Un «sticker» por sesión.

   Andrés, 29 sep 2026: «preferiría que los días con doble sesión tuvieran más
   como un sticker separado por cada sesión». Antes el título juntaba los nombres
   con un «+» y se leía como una sola sesión. Ahora cada una lleva su etiqueta,
   con el turno (AM naranja, PM azul: los mismos colores que las tarjetas de la
   sesión) y su nombre.

   `sobreAzul`: para la tarjeta azul de Home, donde va en blanco translúcido.
   `envolver`: que un nombre largo pase al renglón de abajo en vez de cortarse;
   en los renglones de una lista se prefiere cortar con «…» para no crecerlos. */

const COLOR_DE_TURNO = {
  AM: { c: KP.amber, soft: KP.amberSoft },
  PM: { c: KP.blue, soft: KP.blueSoft },
};

export default function EtiquetasDeSesion({ sesiones, sobreAzul = false, envolver = false, tamano = 12.5, style }) {
  return (
    <span style={{
      display: 'flex', gap: 6, minWidth: 0,
      // En la tarjeta de Home van una debajo de otra y del mismo ancho; en un
      // renglón de lista, una junto a otra y pasan abajo solo si no caben.
      ...(envolver ? { flexDirection: 'column', alignItems: 'stretch' } : { flexWrap: 'wrap' }),
      ...style,
    }}>
      {sesiones.map((s, i) => {
        const color = s.turno ? COLOR_DE_TURNO[s.turno] : null;
        return (
          <span
            key={i}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%',
              padding: s.turno ? '3px 11px 3px 4px' : '3px 11px',
              borderRadius: envolver ? 14 : KP.rPill,
              background: sobreAzul ? 'rgba(255,255,255,0.16)' : (color ? color.soft : KP.surfaceMuted),
              border: `1px solid ${sobreAzul ? 'rgba(255,255,255,0.3)' : (color ? `${color.c}33` : KP.lineHi)}`,
              color: sobreAzul ? '#fff' : KP.ink,
              fontFamily: FONT, fontSize: tamano, fontWeight: 700, lineHeight: 1.25,
            }}
          >
            {s.turno && (
              <span
                style={{
                  flexShrink: 0, alignSelf: envolver ? 'flex-start' : 'center',
                  fontSize: tamano - 2.5, fontWeight: 800, letterSpacing: 0.5, lineHeight: 1,
                  color: sobreAzul ? KP.blueDk : '#fff', background: sobreAzul ? '#fff' : color.c,
                  borderRadius: KP.rPill, padding: '3px 7px',
                }}
              >
                {s.turno}
              </span>
            )}
            <span
              style={{
                minWidth: 0,
                ...(envolver
                  ? { overflowWrap: 'anywhere' }
                  : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
              }}
            >
              {s.nombre}
            </span>
          </span>
        );
      })}
    </span>
  );
}
