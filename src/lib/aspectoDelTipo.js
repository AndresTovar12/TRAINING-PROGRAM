/* El ASPECTO de una sesión según su TIPO: color, tinte de la tarjeta e ícono.

   Andrés, 9 oct 2026 (EXPERIENCIA DE WORKOUTS.pdf): «las cards deberían tomar el color del tipo de workout, como en
   el editor, y quitar el AM/PM»; «le estoy dando demasiada importancia al horario». Antes la tarjeta del atleta se
   pintaba por turno (naranja la mañana, azul la tarde, cada una con su sol); ahora, igual que el editor del coach,
   por el TIPO de la sesión: Gym morado con pesa, Neural naranja con rayo, Correr rojo…

   Los tipos PROPIOS de cada coach llevan el ícono que eligió en un catálogo de ~250 (`catIcono`, ver `lib/iconosDeTipo.js`); sin él, el que le va a su
   nombre, o una etiqueta. Antes todos caían a la pesa: Andrés (9 oct 2026) «no entiendo» los íconos «ligados a formas geométricas que tú le asignaste».

   Vive aparte de `theme.js` porque ese archivo se copia al conector de IA (`scripts/compartir-con-mcp.mjs`) y esto es
   solo de pantalla. Los porcentajes (9 % de fondo, 34 % de borde, 20 % el cuadro del ícono) son los de la maqueta
   «Modo entreno» que Andrés aprobó. */
import { createElement } from 'react';
import {
  Activity, Bike, ClipboardCheck, Dumbbell, Flower2, Goal, HeartPulse, Moon, PersonStanding, Presentation,
  Stethoscope, Users, Waves, Zap,
} from 'lucide-react';
import IconoDeTipo from '@/components/IconoDeTipo';
import { normaliza } from '@/lib/iconosDeTipo';
import { tipoDeSesion } from '@/lib/theme';

// Un ícono por tipo de base. Cualquier slug desconocido lleva la pesa, igual que `tipoDeSesion` lo trata como Gym.
const ICONO_DEL_TIPO = {
  gym: Dumbbell, speed: Zap, recovery: HeartPulse, football: Goal, tests: ClipboardCheck, team: Users,
  correr: Activity, bici: Bike, natacion: Waves, yoga: Flower2, movilidad: PersonStanding, terapia: Stethoscope,
  clase: Presentation, off: Moon,
};

/* El ícono de un tipo PROPIO del coach (`cat: 'otro'`): el que eligió en el catálogo (`catIcono`) o, si no eligió ninguno, el que le va a su nombre.
   Es un componente, y tiene que ser EL MISMO cada vez que se pregunta por el mismo ícono: si `aspectoDelTipo` devolviera uno nuevo en cada dibujo,
   React lo desmontaría y lo volvería a montar en cada tic del reloj. */
const PROPIOS = new Map();
function iconoPropio(id, nombre) {
  const clave = `${id ?? ''}|${normaliza(nombre)}`;
  let Icono = PROPIOS.get(clave);
  if (!Icono) {
    Icono = (props) => createElement(IconoDeTipo, { id, nombre, ...props });
    Icono.displayName = `IconoDeTipo(${id ?? nombre})`;
    PROPIOS.set(clave, Icono);
  }
  return Icono;
}

const ES_HEX = /^#[0-9a-f]{6}$/i;

/**
 * Cómo se pinta la tarjeta de UNA sesión: { Icono, color, fondo, borde, mosaico, tinta }.
 *  - `fondo`: un velo del color que va ENCIMA del blanco de la tarjeta (`background: ${fondo}, ${LT.surface}`).
 *  - `borde`: el contorno; `mosaico`: el cuadro donde va el ícono; `tinta`: el ícono, más oscuro para que se lea.
 * Un color propio que no sea #RRGGBB no se puede aclarar: `fondo`, `borde`, `mosaico` y `tinta` salen `null` y la
 * tarjeta se queda blanca de siempre.
 */
export function aspectoDelTipo(day) {
  const { c, label } = tipoDeSesion(day);
  // Un tipo propio solo cuenta como tal con nombre (así lo resuelve `tipoDeSesion`): sin él es Gym y lleva su pesa.
  const propio = day?.cat === 'otro' && !!(day?.catNombre || '').trim();
  const Icono = propio ? iconoPropio(day.catIcono ?? null, label) : (ICONO_DEL_TIPO[day?.cat] ?? Dumbbell);
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
