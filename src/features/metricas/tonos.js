import {
  Activity, Bike, Dumbbell, Flame, Flower2, Footprints, Goal, Mountain, Waves, Zap,
} from 'lucide-react';
import { LT, KP } from '@/lib/theme';

/* Colores e íconos de las pantallas de métricas (aparte de los componentes, para que la recarga en caliente funcione). */

/** Los tonos de un estado: color fuerte y su fondo suave. */
export const TONOS = {
  verde: { c: KP.mint, soft: KP.mintSoft },
  azul: { c: KP.blue, soft: KP.blueSoft },
  ambar: { c: KP.amber, soft: KP.amberSoft },
  rojo: { c: KP.danger, soft: KP.dangerSoft },
  neutro: { c: LT.text2, soft: LT.surface2 },
};

/** Cuánto pesa un ícono por deporte: el de cada uno de los de `lib/metricas/deportes.js`. */
export const ICONOS = {
  correr: Footprints, caminar: Footprints, senderismo: Mountain, bici: Bike, natacion: Waves, remo: Waves, eliptica: Activity, fuerza: Dumbbell, hiit: Zap,
  funcional: Flame, yoga: Flower2, movilidad: Flower2, futbol: Goal, raqueta: Activity, otro: Activity,
};

/** El color con que se distingue cada deporte en las listas (los mismos del resto de la app cuando existen). */
export const COLOR_DE_DEPORTE = {
  correr: '#F2555A', caminar: '#F2555A', senderismo: '#22C08A', bici: '#00B3C7', natacion: '#3AA0F5', remo: '#3AA0F5', eliptica: '#9090A0', fuerza: '#A480FF',
  hiit: '#FFA047', funcional: '#FFA047', yoga: '#C084FC', movilidad: '#22C08A', futbol: '#FF7A52', raqueta: '#F0A81F', otro: '#7A8191',
};

