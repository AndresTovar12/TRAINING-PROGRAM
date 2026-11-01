import { Check, Heart, Loader2, Minus } from 'lucide-react';
import { FONT, KP } from '@/lib/theme';

/* «CONECTANDO APPLE SALUD…» DEL INICIO (1 nov 2026, maqueta LLmh1vBB4MNjVHYvzVA3ym): el corazón, una barra y cuatro renglones. Es solo el dibujo: lo que dice cada
   renglón y cuándo cambia lo decide `ConectaReloj`, y SOLO cuando termina la llamada real que el renglón representa. Nada de aquí avanza por tiempo.

   Cada renglón: `{ t, estado, der }`. `estado`: 'espera' (gris, apagado), 'va' (girando), 'hecho' (palomita verde) o 'despues' (no se pudo; se intenta otro día).
   `der` es el resultado, a la derecha, en números de ancho fijo para que no baile («12 de 48», «48 entrenos», «Dado»).
   `avance` va de 0 a 100 (la suma real, que calcula quien lo usa). `verde`: terminó todo, así que el cuadro, la barra y el título cambian a «conectada». */

/** El cuadro del corazón de Salud (rosa) que sale en «Conecta Apple Salud»; en verde y con palomita cuando ya quedó conectada. */
export function CuadroDeSalud({ verde = false }) {
  return (
    <div
      role="img" aria-label={verde ? 'Apple Salud conectada' : 'Apple Salud'}
      style={{
        width: 76, height: 76, borderRadius: 22, display: 'grid', placeItems: 'center', flex: 'none',
        background: verde ? KP.mintSoft : '#FDECEF', color: verde ? KP.mint : '#E5364F', // estilo-ok: el rosa de Apple Salud
        transform: verde ? 'scale(1.06)' : 'none', transition: 'background .35s, color .35s, transform .35s',
      }}
    >
      {verde ? <Check size={36} strokeWidth={3} /> : <Heart size={40} fill="currentColor" />}
    </div>
  );
}

function Renglon({ t, estado, der }) {
  const hecho = estado === 'hecho';
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '28px 1fr auto', gap: 10, alignItems: 'center', padding: '10px 4px', opacity: estado === 'espera' ? 0.4 : 1, transition: 'opacity .25s' }}>
      <span aria-hidden="true" style={{ width: 24, height: 24, borderRadius: '50%', display: 'grid', placeItems: 'center', background: hecho ? KP.mint : estado === 'va' ? 'none' : '#F4F5F8', color: '#fff' }}>
        {hecho && <Check size={14} strokeWidth={3.2} />}
        {estado === 'va' && <Loader2 size={20} className="spin" color={KP.blue} />}
        {estado === 'despues' && <Minus size={14} strokeWidth={3} color={KP.ink3} />}
      </span>
      <b style={{ fontSize: 14.5, fontWeight: 700, color: KP.ink, lineHeight: 1.3 }}>{t}</b>
      <small style={{ fontSize: 13, fontWeight: 600, color: KP.ink2, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{der}</small>
    </div>
  );
}

export default function ConectandoSalud({ titulo, sub, filas, avance, verde = false, nota = '' }) {
  return (
    <div role="status" aria-live="polite" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '0 2px 24px' }}>
      <CuadroDeSalud verde={verde} />
      <h2 style={{ margin: '22px 0 6px', font: `800 24px/1.15 ${FONT}`, letterSpacing: -0.4, color: KP.ink, textWrap: 'balance' }}>{titulo}</h2>
      <p style={{ margin: 0, fontSize: 15, color: KP.ink2, fontWeight: 500, lineHeight: 1.45, textWrap: 'pretty', minHeight: 22 }}>{sub}</p>
      <div
        role="progressbar" aria-label="Avance" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(avance)}
        style={{ width: '100%', height: 6, borderRadius: 9, background: '#EBEDF1', overflow: 'hidden', marginTop: 18 }}
      >
        <i style={{ display: 'block', height: '100%', width: `${avance}%`, borderRadius: 9, background: verde ? KP.mint : KP.blue, transition: 'width .3s ease, background .35s' }} />
      </div>
      <div style={{ width: '100%', marginTop: 20, display: 'grid', gap: 2, textAlign: 'left' }}>
        {filas.map((f) => <Renglon key={f.t} {...f} />)}
      </div>
      <p style={{ margin: '12px 0 0', fontSize: 12.5, color: KP.ink3, lineHeight: 1.4, minHeight: 18 }}>{nota}</p>
    </div>
  );
}
