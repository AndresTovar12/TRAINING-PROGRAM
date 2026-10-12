import { useState } from 'react';
import { Play, Timer } from 'lucide-react';
import HojaFlotante from '@/components/HojaFlotante';
import { LT, FONT, NUM_STYLE } from '@/lib/theme';
import { usePlan } from '@/contexts/PlanContext';
import { relojDeCronometro } from '@/lib/entrenoLibre';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import HojaDeDemos from './HojaDeDemos';
import OpcionesDeEntrenar from './OpcionesDeEntrenar';
import PantallaDelCronometro from './PantallaDelCronometro';
import ResumenLibre from './ResumenLibre';
import TusEntrenos from './TusEntrenos';
import { useDemos } from './useDemos';
import { useCronometroLibre, useEntrenosRecientes } from './useEntrenoLibre';
import { botonGrande } from './estilosLibre';

/* EL ENTRENO LIBRE, armado (12 oct 2026): lo que ve alguien en Home o en la pestaña Entrenar para entrenar por su cuenta, tenga o no un plan.
     · un botón grande «Entrenar» que abre la hoja con los deportes (o, con `enLinea`, las opciones puestas directo: pestaña Entrenar)
     · si hay un cronómetro corriendo, una tarjeta «Entreno en curso» que lo reabre (el cronómetro sigue aunque se cierre la hoja)
     · «Tus entrenos»: lo que ya hizo, y de ahí se vuelve a sacar la activity card
   «Demo workout»: sale solo si hay workouts de demostración; al elegir uno se abre como el workout de hoy (`abreDemo`) y `alIrAHome` (si se da) lleva a Home, donde está su botón de empezar.
   Ver `lib/entrenoLibre.js`. */

export default function EntrenoLibre({ userId, unidadPeso = 'kg', enLinea = false, alIrAHome = null }) {
  const crono = useCronometroLibre(userId);
  const { filas, recarga } = useEntrenosRecientes(userId);
  const { abreDemo } = usePlan();
  const demos = useDemos(userId);
  const [hoja, setHoja] = useState(null); // null | 'elegir' | 'demos' | 'cronometro' | { resumen: fila }
  const alDemo = demos?.length ? () => setHoja('demos') : null;

  const elige = (deporte) => { crono.inicia(deporte); setHoja('cronometro'); };
  const enCurso = !!crono.cronometro;

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, fontFamily: FONT }}>
        {enCurso ? (
          <button
            type="button" onClick={() => setHoja('cronometro')} className="kp-press"
            style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: FONT, background: LT.surface, border: `2px solid ${LT.blue}`, borderRadius: 20, padding: '14px 16px' }}
          >
            <span style={{ width: 46, height: 46, borderRadius: 15, background: LT.blueSoft, color: LT.blue, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Timer size={23} /></span>
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 800, color: LT.blue, textTransform: 'uppercase', letterSpacing: 0.6 }}>Entreno en curso</span>
              <span style={{ display: 'block', fontSize: 19, fontWeight: 800, color: LT.text, marginTop: 2 }}>{nombreDelDeporte(crono.cronometro.deporte)} · <span style={NUM_STYLE}>{relojDeCronometro(crono.segundos)}</span></span>
            </span>
            <span style={{ fontSize: 15, fontWeight: 800, color: LT.blue }}>Seguir</span>
          </button>
        ) : enLinea ? (
          <OpcionesDeEntrenar alElegir={elige} alDemo={alDemo} />
        ) : (
          <button type="button" onClick={() => setHoja('elegir')} className="kp-press" style={botonGrande()}><Play size={21} fill="currentColor" /> Entrenar</button>
        )}
        <TusEntrenos filas={filas} alAbrir={(fila) => setHoja({ resumen: fila })} />
      </div>

      {hoja === 'elegir' && (
        <HojaFlotante titulo="Entrenar" onCerrar={() => setHoja(null)}>
          <OpcionesDeEntrenar alElegir={elige} alDemo={alDemo} />
        </HojaFlotante>
      )}
      {hoja === 'demos' && demos?.length > 0 && (
        <HojaDeDemos demos={demos} alCerrar={() => setHoja(null)} alElegir={(d) => { abreDemo(d); setHoja(null); alIrAHome?.(); }} />
      )}
      {hoja === 'cronometro' && enCurso && (
        <PantallaDelCronometro
          userId={userId} crono={crono} alMinimizar={() => setHoja(null)}
          alGuardado={(fila) => { recarga(); setHoja({ resumen: fila }); }}
        />
      )}
      {hoja?.resumen && <ResumenLibre fila={hoja.resumen} unidadPeso={unidadPeso} alCerrar={() => setHoja(null)} />}
    </>
  );
}
