import { ChevronRight, Dumbbell } from 'lucide-react';
import HojaFlotante from '@/components/HojaFlotante';
import { LT, FONT } from '@/lib/theme';
import { sesionesDeWorkout } from '@/lib/misPlanesDatos';

/* LOS DEMO WORKOUTS: la lista de workouts de demostración. Tocar uno lo abre como un workout de hoy (ver `armarDemo` en `PlanContext`): se hace igual que cualquier otro. */

const ejerciciosDe = (demo) => sesionesDeWorkout(demo.data).reduce((n, s) => n + (Array.isArray(s?.exercises) ? s.exercises.filter((e) => e && !e.isNote).length : 0), 0);

export default function HojaDeDemos({ demos, alElegir, alCerrar }) {
  return (
    <HojaFlotante titulo="Demo workout" onCerrar={alCerrar}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, fontFamily: FONT }}>
        {demos.map((d) => {
          const n = ejerciciosDe(d);
          return (
            <button
              key={d.id} type="button" onClick={() => alElegir(d)} className="kp-press"
              style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', minHeight: 64, padding: '10px 14px', textAlign: 'left', cursor: 'pointer', fontFamily: FONT, background: LT.surface, border: `1.5px solid ${LT.border}`, borderRadius: 18 }}
            >
              <span aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center', background: LT.blueSoft, color: LT.blue, flexShrink: 0 }}><Dumbbell size={21} /></span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 17, fontWeight: 800, color: LT.text, overflowWrap: 'anywhere' }}>{d.name}</span>
                {n > 0 && <span style={{ display: 'block', fontSize: 13.5, fontWeight: 600, color: LT.text2, marginTop: 2 }}>{n} {n === 1 ? 'ejercicio' : 'ejercicios'}</span>}
              </span>
              <ChevronRight size={20} color={LT.text3} />
            </button>
          );
        })}
      </div>
    </HojaFlotante>
  );
}
