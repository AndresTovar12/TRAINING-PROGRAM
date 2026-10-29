import { Watch } from 'lucide-react';
import { FONT, KP, LT } from '@/lib/theme';
import { abrePerfil } from '@/lib/abrePerfil';

/* «CONECTA TU APPLE WATCH» (28 oct 2026). Dentro de la app del iPhone el reloj entra directo por HealthKit: lo que antes decía «importa el export de
   Apple Salud» ahora lleva a Mi perfil → Dispositivos. En la web (sin HealthKit) sigue el texto de siempre: `saludDisponible()` dice cuál toca. */

/** El botón que lleva a Mi perfil → Dispositivos. */
export default function ConectaTuReloj({ estilo }) {
  return (
    <button
      type="button" onClick={() => abrePerfil('dispositivos')} className="kp-press"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 16px', borderRadius: 14, border: 'none', cursor: 'pointer',
        background: KP.blueSoft, color: LT.blue, fontFamily: FONT, fontSize: 15, fontWeight: 800, touchAction: 'manipulation', ...estilo,
      }}
    >
      <Watch size={18} /> Conectar Apple Watch
    </button>
  );
}
