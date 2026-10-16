import { Suspense, lazy, useMemo, useState } from 'react';
import { ChevronLeft, Share2 } from 'lucide-react';
import HojaFlotante from '@/components/HojaFlotante';
import { LT, FONT, NUM_STYLE, KP } from '@/lib/theme';
import { datosDelResumen } from '@/lib/resumenLibre';
import { nombreDelDeporte } from '@/lib/metricas/deportes';
import { fechaLarga, horaTexto } from '@/lib/metricas/formato';
import { sellosDeActividad } from '@/lib/sello/datos';
import { MosaicoDeDeporte } from '@/features/metricas/Piezas';
import { ICONOS } from '@/features/metricas/tonos';
import { botonBlancoGrande, botonGrande, tarjetaBlanca } from './estilosLibre';

const EditorDelSello = lazy(() => import('@/features/sello/EditorDelSello'));

/* EL RESUMEN de un entreno libre (al terminar, y al abrir uno del historial): sus números y el botón de la «activity card». La tarjeta no se abre sola: se ve el resumen y quien quiere,
   la saca (Andrés, 12 oct 2026). `fila`: la fila de `actividades`. */

/* Reestructura visual (15 oct 2026): como «Carrera · resumen» de las capturas de Andrés. Una tarjeta blanca con la fecha arriba en chico, el
   nombre grande y los números en una fila (grande el número, chico qué es). El mapa y «por kilómetro» llegan con el GPS de la app de la tienda. */
const Dato = ({ valor, etiqueta }) => (
  <div style={{ minWidth: 0 }}>
    <div style={{ fontSize: 26, fontWeight: 800, color: LT.text, letterSpacing: -0.5, lineHeight: 1.1, ...NUM_STYLE }}>{valor}</div>
    <div style={{ fontSize: 12.5, fontWeight: 600, color: LT.text2, marginTop: 3 }}>{etiqueta}</div>
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
          <div style={{ ...tarjetaBlanca, padding: '18px 18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <MosaicoDeDeporte deporte={fila.deporte} size={44} />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: KP.blue, ...NUM_STYLE }}>{fechaLarga(fila.inicio, fila.desfase_min)} · {horaTexto(fila.inicio, fila.desfase_min)}</div>
                <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: -0.5, color: LT.text, marginTop: 2, overflowWrap: 'break-word' }}>{nombre}</div>
              </div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(90px, 1fr))', gap: 14, marginTop: 18 }}>
              {datosDelResumen(fila).map((d) => <Dato key={d.etiqueta} {...d} />)}
            </div>
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
