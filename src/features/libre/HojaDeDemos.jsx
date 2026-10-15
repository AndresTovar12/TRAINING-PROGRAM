import { Dumbbell } from 'lucide-react';
import HojaFlotante from '@/components/HojaFlotante';
import { KP } from '@/lib/theme';
import { sesionesDeWorkout } from '@/lib/misPlanesDatos';
import { Grupo, Fila, IconoDeFila } from '@/components/ui';

/* LOS DEMO WORKOUTS: la lista de workouts de demostración. Tocar uno lo abre como un workout de hoy (ver `armarDemo` en `PlanContext`): se hace igual que cualquier otro.
   Reestructura visual (15 oct 2026): una lista agrupada. */

const ejerciciosDe = (demo) => sesionesDeWorkout(demo.data).reduce((n, s) => n + (Array.isArray(s?.exercises) ? s.exercises.filter((e) => e && !e.isNote).length : 0), 0);

export default function HojaDeDemos({ demos, alElegir, alCerrar }) {
  return (
    <HojaFlotante titulo="Demo workout" onCerrar={alCerrar}>
      <Grupo>
        {demos.map((d) => {
          const n = ejerciciosDe(d);
          return (
            <Fila
              key={d.id} izquierda={<IconoDeFila color={KP.violet} fondo={KP.violetSoft}><Dumbbell size={19} /></IconoDeFila>}
              texto={d.name} detalle={n > 0 ? `${n} ${n === 1 ? 'ejercicio' : 'ejercicios'}` : null} onClick={() => alElegir(d)}
            />
          );
        })}
      </Grupo>
    </HojaFlotante>
  );
}
