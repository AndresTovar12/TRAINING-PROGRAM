import { Suspense, lazy, useMemo, useState } from 'react';
import { ChevronLeft, Share2 } from 'lucide-react';
import HojaFlotante from '@/components/HojaFlotante';
import { LT, FONT, NUM_STYLE } from '@/lib/theme';
import { datosDelResumen } from '@/lib/resumenLibre';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { fechaLarga, horaTexto } from '@/lib/metricas/formato';
import { sellosDeActividad } from '@/lib/sello/datos';
import { MosaicoDeDeporte } from '@/features/metricas/Piezas';
import { ICONOS } from '@/features/metricas/tonos';
import { botonBlancoGrande, botonGrande } from './estilosLibre';

const EditorDelSello = lazy(() => import('@/features/sello/EditorDelSello'));

/* EL RESUMEN de un entreno libre (al terminar, y al abrir uno del historial): sus números y el botón de la «activity card». La tarjeta no se abre sola: se ve el resumen y quien quiere,
   la saca (Andrés, 12 oct 2026). `fila`: la fila de `actividades`. */

const Dato = ({ valor, etiqueta }) => (
  <div style={{ flex: '1 1 120px', background: LT.surface, borderRadius: 18, padding: '14px 12px', textAlign: 'center', boxShadow: '0 1px 4px rgba(17,19,24,0.06)' }}>
    <div style={{ fontSize: 26, fontWeight: 800, color: LT.text, letterSpacing: -0.5, ...NUM_STYLE }}>{valor}</div>
    <div style={{ fontSize: 12.5, fontWeight: 700, color: LT.text2, marginTop: 3 }}>{etiqueta}</div>
  </div>
);

export default function ResumenLibre({ fila, unidadPeso = 'kg', alCerrar, alCerrarTarjeta, empiezaEnTarjeta = false }) {
  const [verTarjeta, setVerTarjeta] = useState(empiezaEnTarjeta); // desde el widget «Activity card» de Home se abre directo en la tarjeta
  const sellos = useMemo(() => sellosDeActividad({ fila, series: null, sesion: null, unidadPeso }).sellos, [fila, unidadPeso]);
  const nombre = fila.titulo || nombreDelDeporte(fila.deporte);

  return (
    <HojaFlotante titulo={verTarjeta ? 'Activity card' : nombre} onCerrar={verTarjeta ? () => { setVerTarjeta(false); alCerrarTarjeta?.(); } : alCerrar}>
      {verTarjeta ? (
        <div>
          <button
            type="button" onClick={() => { setVerTarjeta(false); alCerrarTarjeta?.(); }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '6px 10px 6px 4px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 800, color: LT.blue }}
          >
            <ChevronLeft size={18} /> Resumen
          </button>
          <Suspense fallback={null}><EditorDelSello sellos={sellos} Icono={ICONOS[fila.deporte]} /></Suspense>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, fontFamily: FONT }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <MosaicoDeDeporte deporte={fila.deporte} size={56} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.4, color: LT.text }}>{nombre}</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: LT.text2, marginTop: 2, ...NUM_STYLE }}>{fechaLarga(fila.inicio, fila.desfase_min)} · {horaTexto(fila.inicio, fila.desfase_min)}</div>
            </div>
          </div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {datosDelResumen(fila).map((d) => <Dato key={d.etiqueta} {...d} />)}
          </div>
          {sellos.length > 0 && (
            <button type="button" onClick={() => setVerTarjeta(true)} className="kp-press" style={botonGrande()}><Share2 size={20} /> Activity card</button>
          )}
          <button type="button" onClick={alCerrar} className="kp-press" style={botonBlancoGrande()}>Listo</button>
        </div>
      )}
    </HojaFlotante>
  );
}
