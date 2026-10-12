import { useState } from 'react';
import { ChevronDown, ChevronRight, Dumbbell, MoreHorizontal } from 'lucide-react';
import { LT, FONT } from '@/lib/theme';
import { DEPORTES_EXTRA, DEPORTES_RAPIDOS } from '@/lib/entrenoLibre';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { MosaicoDeDeporte } from '@/features/metricas/Piezas';

/* LAS OPCIONES DE «ENTRENAR» (12 oct 2026): qué va a hacer quien no tiene (o no quiere usar) un plan. Prioridad: correr, bici, nadar y caminar, que es para lo que muchos entran (sacar su activity card);
   «Demo workout» (los workouts de demostración, solo si hay) y «Más deportes». Es la MISMA lista en la hoja que abre el botón «Entrenar» de Home y puesta directo en la pestaña Entrenar. */

const fila = (extra = {}) => ({
  display: 'flex', alignItems: 'center', gap: 14, width: '100%', minHeight: 64, padding: '10px 14px', textAlign: 'left', cursor: 'pointer', fontFamily: FONT,
  background: LT.surface, border: `1.5px solid ${LT.border}`, borderRadius: 18, touchAction: 'manipulation', ...extra,
});

function Fila({ icono, nombre, alTocar, derecha }) {
  return (
    <button type="button" onClick={alTocar} className="kp-press" style={fila()}>
      {icono}
      <span style={{ flex: 1, minWidth: 0, fontSize: 17, fontWeight: 800, color: LT.text }}>{nombre}</span>
      {derecha ?? <ChevronRight size={20} color={LT.text3} />}
    </button>
  );
}

/** `alElegir(deporte)`: arranca ese deporte. `alDemo`: abre los workouts de demostración (si no se da, la fila no sale). */
export default function OpcionesDeEntrenar({ alElegir, alDemo = null }) {
  const [mas, setMas] = useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {DEPORTES_RAPIDOS.map((d) => (
        <Fila key={d} icono={<MosaicoDeDeporte deporte={d} size={42} />} nombre={nombreDelDeporte(d)} alTocar={() => alElegir(d)} />
      ))}
      {alDemo && (
        <Fila
          icono={<span aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center', background: `${LT.blue}1F`, color: LT.blue, flexShrink: 0 }}><Dumbbell size={21} /></span>}
          nombre="Demo workout" alTocar={alDemo}
        />
      )}
      <Fila
        icono={<span aria-hidden="true" style={{ width: 42, height: 42, borderRadius: 13, display: 'grid', placeItems: 'center', background: LT.surface2 ?? '#EEF0F4', color: LT.text2, flexShrink: 0 }}><MoreHorizontal size={21} /></span>}
        nombre="Más deportes" alTocar={() => setMas((v) => !v)} derecha={<ChevronDown size={20} color={LT.text3} style={{ transform: mas ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }} />}
      />
      {mas && DEPORTES_EXTRA.map((d) => (
        <Fila key={d} icono={<MosaicoDeDeporte deporte={d} size={42} />} nombre={nombreDelDeporte(d)} alTocar={() => alElegir(d)} />
      ))}
    </div>
  );
}
