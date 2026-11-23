import { FONT, LT, NUM_STYLE } from '@/lib/theme';

/**
 * «Serie 1 de 3» con sus rayitas: UNA sola pieza para todas las pantallas del entreno (ver `lib/enQueVas.js`). Es la misma letra que la tarjeta de la
 * serie de Gym («Serie» chico, el número grande, «de 3»). Solo cambian el tamaño (`grande`, para leerla de lejos) y el fondo (`oscura`, la negra).
 * `parte`: cuánto lleva de la que va (0 a 1); sin él, la que va se pinta llena.
 */
export function EnQueVas({ rotulo, n, de, extra = '', color = null, oscura = false, grande = false, parte = null, centrada = false }) {
  if (!(de > 1)) return null;
  const c = color || LT.blue;
  const tenue = oscura ? '#9AA0AE' : LT.text2;
  const fuerte = oscura ? '#fff' : LT.text;
  const vacia = oscura ? '#2C2E35' : 'rgba(17,19,24,.12)';
  return (
    <div data-en-que-vas="" style={{ fontFamily: FONT, display: 'flex', flexDirection: 'column', alignItems: centrada ? 'center' : 'stretch', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, flexWrap: 'wrap', justifyContent: centrada ? 'center' : 'flex-start', ...NUM_STYLE }}>
        <span style={{ fontSize: grande ? 17 : 15, fontWeight: 700, color: tenue }}>{rotulo}</span>
        <span style={{ fontSize: grande ? 34 : 26, fontWeight: 800, letterSpacing: -0.8, lineHeight: 1, color: fuerte }}>{n}</span>
        <span style={{ fontSize: grande ? 17 : 15, fontWeight: 700, color: tenue }}>de {de}</span>
        {extra && <span style={{ fontSize: grande ? 15 : 13.5, fontWeight: 700, color: tenue, marginLeft: 4 }}>· {extra}</span>}
      </div>
      <div aria-hidden="true" style={{ display: 'flex', gap: 5, width: centrada ? 'min(100%, 260px)' : '100%' }}>
        {Array.from({ length: Math.min(de, 30) }, (_, i) => {
          const lleno = i < n - 1 ? 1 : i === n - 1 ? (parte === null ? 1 : Math.max(0, Math.min(1, parte))) : 0;
          return (
            <span key={i} style={{ flex: 1, height: 6, borderRadius: 3, background: vacia, overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', width: `${Math.round(lleno * 100)}%`, background: c }} />
            </span>
          );
        })}
      </div>
    </div>
  );
}
