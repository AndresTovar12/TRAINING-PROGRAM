import { Check } from 'lucide-react';
import { FONT, KP } from '@/lib/theme';

/* Un «sticker» por sesión.

   Andrés, 29 sep 2026: «preferiría que los días con doble sesión tuvieran más
   como un sticker separado por cada sesión». Antes el título juntaba los nombres
   con un «+» y se leía como una sola sesión. Ahora cada una lleva su etiqueta con
   su nombre.

   Andrés, 9 oct 2026: sin AM ni PM («le estoy dando demasiada importancia al
   horario»). La etiqueta ya no lleva el turno ni sus colores; las sesiones se
   distinguen por su nombre y por el orden en que vienen. El turno que el coach
   le pone a un workout sigue en SU editor.

   `envolver`: que un nombre largo pase al renglón de abajo en vez de cortarse;
   en los renglones de una lista se prefiere cortar con «…» para no crecerlos.

   Una sesión puede venir de OTRA persona (lo que le pegó el fisio al programa del
   coach): lleva `color` (su punto y su tinte), `autor` (quién es) y `hecha`. Así
   queda en el mismo renglón que las demás, solo con su etiqueta (Andrés, 2 oct
   2026: «el programa es un todo»). */

export default function EtiquetasDeSesion({ sesiones, envolver = false, tamano = 12.5, style }) {
  return (
    <span style={{
      display: 'flex', gap: 6, minWidth: 0,
      // En la tarjeta de Home van una debajo de otra y del mismo ancho; en un
      // renglón de lista, una junto a otra y pasan abajo solo si no caben.
      ...(envolver ? { flexDirection: 'column', alignItems: 'stretch' } : { flexWrap: 'wrap' }),
      ...style,
    }}>
      {sesiones.map((s, i) => {
        const tinte = s.color ?? null;
        const nombre = (
          <span
            style={{
              minWidth: 0,
              // Con el nombre de otra persona debajo el título baja de línea en vez de cortarse en «…».
              ...(envolver || s.autor
                ? { overflowWrap: 'anywhere' }
                : { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }),
            }}
          >
            {s.nombre}
          </span>
        );
        return (
          <span
            key={i}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6, minWidth: 0, maxWidth: '100%',
              padding: '3px 11px',
              borderRadius: envolver || s.autor ? 14 : KP.rPill,
              background: tinte ? `${tinte}14` : KP.surfaceMuted,
              border: `1px solid ${tinte ? `${tinte}55` : KP.lineHi}`,
              color: KP.ink,
              fontFamily: FONT, fontSize: tamano, fontWeight: 700, lineHeight: 1.25,
            }}
          >
            {tinte && (
              <span aria-hidden="true" style={{ width: 7, height: 7, borderRadius: '50%', background: tinte, flexShrink: 0 }} />
            )}
            {s.autor ? (
              <span style={{ display: 'flex', flexDirection: 'column', gap: 1, minWidth: 0 }}>
                {nombre}
                <span style={{ fontSize: tamano - 2.5, fontWeight: 800, color: tinte ?? KP.ink, lineHeight: 1.2 }}>
                  {s.autor}
                </span>
              </span>
            ) : nombre}
            {s.hecha && <Check size={tamano} strokeWidth={3} style={{ flexShrink: 0, color: KP.mint }} />}
          </span>
        );
      })}
    </span>
  );
}
