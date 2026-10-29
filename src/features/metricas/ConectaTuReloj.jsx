import { Watch } from 'lucide-react';
import { FONT, KP, LT } from '@/lib/theme';
import { saludDisponible } from '@/lib/saludDelTelefono';
import { abreConectaReloj } from '@/lib/abreConectaReloj';
import { useReloj } from '@/lib/relojConectado';

/* «CONECTA TU APPLE WATCH» (28 oct 2026; fase 5, 29 oct 2026). Dentro de la app del iPhone el reloj entra directo por HealthKit: el botón abre la pantalla de
   conectar. Con reloj emparejado, «Conectar Apple Watch»; sin reloj, «Conectar Apple Salud» (no se le ofrece un reloj que no tiene). Ya conectado, no sale.
   En la web (sin HealthKit) sigue el texto de siempre: `saludDisponible()` dice cuál toca. */

/** Qué decir donde faltan datos del reloj: `{ conecta, conectado, emparejado, texto }`. `texto` sigue a «Sin pulso en reposo, HRV ni sueño…». */
export function useConectaReloj() {
  const { listo, conexion, reloj } = useReloj();
  const enLaApp = saludDisponible();
  const conectado = !!conexion;
  const emparejado = !!reloj.emparejado;
  return {
    conecta: enLaApp && listo && !conectado,
    conectado,
    emparejado,
    texto: conectado ? 'Llegan solos de tu Apple Watch: tu recuperación, desde esta noche.' : emparejado ? 'Conecta tu Apple Watch y llegan solos.' : 'Conecta Apple Salud y llegan solos.',
  };
}

/** El botón que abre «Conecta tu Apple Watch» (o «Conecta Apple Salud»). */
export default function ConectaTuReloj({ estilo, origen = 'metricas' }) {
  const { conecta, emparejado } = useConectaReloj();
  if (!conecta) return null;
  return (
    <button
      type="button" onClick={() => abreConectaReloj(origen)} className="kp-press"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 14, border: 'none', cursor: 'pointer',
        background: KP.blueSoft, color: LT.blue, fontFamily: FONT, fontSize: 15, fontWeight: 800, touchAction: 'manipulation', ...estilo,
      }}
    >
      <Watch size={18} /> {emparejado ? 'Conectar Apple Watch' : 'Conectar Apple Salud'}
    </button>
  );
}
