import { useState } from 'react';
import { ChevronDown, Dumbbell, MoreHorizontal } from 'lucide-react';
import { KP } from '@/lib/theme';
import { DEPORTES_EXTRA, DEPORTES_RAPIDOS } from '@/lib/entrenoLibre';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { MosaicoDeDeporte } from '@/features/metricas/Piezas';
import { Grupo, Fila, IconoDeFila } from '@/components/ui';

/* LAS OPCIONES DE «ENTRENAR» (12 oct 2026): qué va a hacer quien no tiene (o no quiere usar) un plan. Prioridad: correr, bici, nadar y caminar, que es para lo que muchos entran (sacar su activity card);
   «Demo workout» (los workouts de demostración, solo si hay) y «Más deportes». Es la MISMA lista en la hoja que abre el botón «Entrenar» de Home y puesta directo en la pestaña Entrenar.
   Reestructura visual (15 oct 2026): una lista agrupada; «Más deportes» abre los demás en un segundo grupo. */

/** `alElegir(deporte)`: arranca ese deporte. `alDemo`: abre los workouts de demostración (si no se da, la fila no sale). `alTodas`: abre todas las actividades (con buscador y
 *  «Crear la mía», ver `ElegirActividad`); con él, «Más deportes» se vuelve «Todas las actividades». */
export default function OpcionesDeEntrenar({ alElegir, alDemo = null, alTodas = null }) {
  const [mas, setMas] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <Grupo>
        {DEPORTES_RAPIDOS.map((d) => (
          <Fila key={d} izquierda={<MosaicoDeDeporte deporte={d} size={38} />} texto={nombreDelDeporte(d)} onClick={() => alElegir(d)} />
        ))}
        {alDemo && <Fila izquierda={<IconoDeFila color={KP.violet} fondo={KP.violetSoft}><Dumbbell size={19} /></IconoDeFila>} texto="Demo workout" onClick={alDemo} />}
        {alTodas ? (
          <Fila izquierda={<IconoDeFila color={KP.ink2} fondo="#EBEDF1"><MoreHorizontal size={19} /></IconoDeFila>} texto="Todas las actividades" onClick={alTodas} />
        ) : (
          <Fila
            izquierda={<IconoDeFila color={KP.ink2} fondo="#EBEDF1"><MoreHorizontal size={19} /></IconoDeFila>} texto="Más deportes" onClick={() => setMas((v) => !v)}
            derecha={<ChevronDown size={18} color={KP.ink3} style={{ transform: mas ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />}
          />
        )}
      </Grupo>
      {mas && (
        <Grupo titulo="Más deportes">
          {DEPORTES_EXTRA.map((d) => (
            <Fila key={d} izquierda={<MosaicoDeDeporte deporte={d} size={38} />} texto={nombreDelDeporte(d)} onClick={() => alElegir(d)} />
          ))}
        </Grupo>
      )}
    </div>
  );
}
