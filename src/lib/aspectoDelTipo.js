/* El ASPECTO de una sesión según su TIPO: color, tinte de la tarjeta e ícono.

   Andrés, 9 oct 2026 (EXPERIENCIA DE WORKOUTS.pdf): «las cards deberían tomar el color del tipo de workout, como en
   el editor, y quitar el AM/PM»; «le estoy dando demasiada importancia al horario». Antes la tarjeta del atleta se
   pintaba por turno (naranja la mañana, azul la tarde, cada una con su sol); ahora, igual que el editor del coach,
   por el TIPO de la sesión: Gym morado con pesa, Neural naranja con rayo, Correr rojo…

   Vive aparte de `theme.js` porque ese archivo se copia al conector de IA (`scripts/compartir-con-mcp.mjs`) y esto es
   solo de pantalla. Los porcentajes (9 % de fondo, 34 % de borde, 20 % el cuadro del ícono) son los de la maqueta
   «Modo entreno» que Andrés aprobó. */
import {
  Activity, Bike, ClipboardCheck, Dumbbell, Flower2, Goal, HeartPulse, Moon, PersonStanding, Presentation,
  Stethoscope, Users, Waves, Zap,
} from 'lucide-react';
import { tipoDeSesion } from '@/lib/theme';

// Un ícono por tipo de base. Un tipo propio del coach (`cat: 'otro'`) y cualquiera desconocido llevan la pesa.
const ICONO_DEL_TIPO = {
  gym: Dumbbell, speed: Zap, recovery: HeartPulse, football: Goal, tests: ClipboardCheck, team: Users,
  correr: Activity, bici: Bike, natacion: Waves, yoga: Flower2, movilidad: PersonStanding, terapia: Stethoscope,
  clase: Presentation, off: Moon,
};

const ES_HEX = /^#[0-9a-f]{6}$/i;

/**
 * Cómo se pinta la tarjeta de UNA sesión: { Icono, color, fondo, borde, mosaico, tinta }.
 *  - `fondo`: un velo del color que va ENCIMA del blanco de la tarjeta (`background: ${fondo}, ${LT.surface}`).
 *  - `borde`: el contorno; `mosaico`: el cuadro donde va el ícono; `tinta`: el ícono, más oscuro para que se lea.
 * Un color propio que no sea #RRGGBB no se puede aclarar: `fondo`, `borde`, `mosaico` y `tinta` salen `null` y la
 * tarjeta se queda blanca de siempre.
 */
export function aspectoDelTipo(day) {
  const { c } = tipoDeSesion(day);
  const Icono = ICONO_DEL_TIPO[day?.cat] ?? Dumbbell;
  if (!ES_HEX.test(c || '')) return { Icono, color: c || null, fondo: null, borde: null, mosaico: null, tinta: null };
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16));
  const velo = (a) => `rgba(${r},${g},${b},${a})`;
  return {
    Icono,
    color: c,
    fondo: `linear-gradient(${velo(0.09)}, ${velo(0.09)})`,
    borde: velo(0.34),
    mosaico: velo(0.2),
    tinta: `rgb(${Math.round(r * 0.62)},${Math.round(g * 0.62)},${Math.round(b * 0.62)})`,
  };
}
