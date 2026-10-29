import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Trophy } from 'lucide-react';
import { FONT, NUM_STYLE } from '@/lib/theme';
import { trazoDeRuta } from '@/lib/ubicacion';
import { datosDelResumen } from '@/lib/resumenLibre';
import { rutaDe } from '@/lib/stickers/ficha';
import IconoDeActividad from './IconoDeActividad';

/* LA CELEBRACIÓN AL TERMINAR (23 oct 2026, Activity Tracker; maqueta v4, pantalla «Celebración»). Corta: unos 3 segundos (la de Strava dura 9.5 y termina vendiendo la
   suscripción; aquí NO se vende nada). El punto azul de T•LAB llena la pantalla y la ruta se dibuja; sin mapa, salta el ícono de la actividad. Si rompió un récord, se lo
   dice aquí sin que lo busque (con su valor y la diferencia: `record.detalle`). Luego, la página del entreno (nunca la hoja de stickers sola). Un toque la salta.
   `fila`: el entreno recién guardado. `muestras`: la ruta (si llevó GPS). `actividad`: la que eligió (para el ícono). `record`: lo de `recordDe`. `alTerminar`. */

const DURA_MS = 3200;
const AZUL = '#2F6BFF';

export default function CelebracionLibre({ fila, muestras = null, actividad = null, record = null, alTerminar }) {
  const terminar = useRef(alTerminar);
  useEffect(() => { terminar.current = alTerminar; });
  useEffect(() => {
    const t = setTimeout(() => terminar.current(), DURA_MS);
    return () => clearTimeout(t);
  }, []);
  // La línea, solo si de verdad hubo recorrido (el umbral de los stickers, `rutaDe`): un pádel en su cancha salta su ícono.
  const ruta = Array.isArray(muestras) && rutaDe(muestras) ? trazoDeRuta(muestras, { ancho: 280, alto: 280, margen: 20 }) : null;
  const principal = datosDelResumen(fila).find((d) => d.etiqueta === 'distancia') ?? datosDelResumen(fila)[0];
  const nombre = fila.titulo || actividad?.nombre || 'Tu entreno';

  return createPortal(
    <div
      role="dialog" aria-modal="true" aria-label={`Terminaste: ${nombre}`} onClick={() => terminar.current()}
      style={{ position: 'fixed', inset: 0, zIndex: 3400, background: '#0F1220', color: '#fff', fontFamily: FONT, overflow: 'hidden', cursor: 'pointer' }}
    >
      <style>{`
        @keyframes cele-llena { from { transform: translate(-50%, -50%) scale(0.06); } to { transform: translate(-50%, -50%) scale(1); } }
        @keyframes cele-trazo { to { stroke-dashoffset: 0; } }
        @keyframes cele-salta { 0% { transform: scale(0.4); opacity: 0; } 60% { transform: scale(1.12); opacity: 1; } 100% { transform: scale(1); } }
        @keyframes cele-sube { from { transform: translateY(14px); opacity: 0; } to { transform: none; opacity: 1; } }
        @media (prefers-reduced-motion: reduce) { .cele * { animation-duration: 1ms !important; animation-delay: 0ms !important; } }
      `}</style>
      <div className="cele" style={{ position: 'absolute', inset: 0 }}>
        {/* El punto azul que llena la pantalla. */}
        <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', width: '260vmax', height: '260vmax', borderRadius: '50%', background: AZUL, transform: 'translate(-50%, -50%) scale(0.06)', animation: 'cele-llena 650ms cubic-bezier(.2,.8,.2,1) forwards' }} />
        <div style={{ position: 'relative', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, padding: '0 24px', textAlign: 'center' }}>
          {ruta ? (
            <svg viewBox="0 0 280 280" width="220" height="220" aria-hidden="true">
              <path d={ruta.d} pathLength="1" fill="none" stroke="#fff" strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: 'cele-trazo 1.4s 0.5s ease-in-out forwards' }} />
            </svg>
          ) : (
            <span style={{ animation: 'cele-salta 700ms 0.45s both', display: 'inline-flex', padding: 10, borderRadius: 34, background: 'rgba(255,255,255,0.95)' }}>
              <IconoDeActividad actividad={actividad ?? { nombre, color: AZUL }} size={96} />
            </span>
          )}
          <div style={{ animation: 'cele-sube 450ms 0.9s both' }}>
            <div style={{ fontSize: 17, fontWeight: 700, opacity: 0.85 }}>{nombre}</div>
            <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -2, lineHeight: 1.05, ...NUM_STYLE }}>{principal?.valor}</div>
          </div>
          {record && (
            <div style={{ animation: 'cele-sube 450ms 1.3s both', display: 'inline-flex', alignItems: 'center', gap: 8, padding: '9px 16px', borderRadius: 99, background: 'rgba(255,255,255,0.18)', fontSize: 15.5, fontWeight: 800 }}>
              <Trophy size={18} /> {record.texto}
            </div>
          )}
          {record?.detalle && <div style={{ animation: 'cele-sube 450ms 1.4s both', fontSize: 14.5, fontWeight: 600, opacity: 0.9, ...NUM_STYLE }}>{record.detalle}</div>}
        </div>
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 'calc(28px + env(safe-area-inset-bottom))', textAlign: 'center', fontSize: 14.5, fontWeight: 700, opacity: 0.85, animation: 'cele-sube 450ms 1.6s both' }}>
          Veamos cómo te fue →
        </div>
      </div>
    </div>,
    document.body,
  );
}
