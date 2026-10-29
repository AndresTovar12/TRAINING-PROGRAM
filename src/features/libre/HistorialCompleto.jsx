import { useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, Loader2 } from 'lucide-react';
import { LT, FONT, KP } from '@/lib/theme';
import { porMes } from '@/lib/entrenosDelPlan';
import { Grupo } from '@/components/ui';
import { FilaDeTusEntrenos } from './TusEntrenos';
import { useHistorialCompleto } from './useEntrenoLibre';

/* «VER TODOS» (fase 6, 29 oct 2026): el historial completo, la misma lista de «Tus entrenos» (libres, del reloj y workouts del plan) agrupada por mes
   («Octubre 2026»), cada fila con su ⇪. Sin buscador. Se lee por páginas de 50 al llegar abajo (`useHistorialCompleto`).
   Va debajo de las páginas de cada entreno (capa 3100; las páginas van en 3200), así que abrir uno y volver deja la lista donde estaba. */
export default function HistorialCompleto({ userId, propias = [], alAbrir, alCompartir, alCerrar }) {
  const { entrenos, hayMas, leyendo, error, sigue } = useHistorialCompleto(userId);
  const grupos = useMemo(() => porMes(entrenos), [entrenos]);
  // El final de la lista: al asomarse (con 600 px de anticipación), la siguiente página.
  // (Se mide contra la caja que se desliza, no contra la ventana: si no, los 600 px no cuentan.)
  const final = useRef(null);
  const caja = useRef(null);
  useEffect(() => {
    const el = final.current;
    if (!el || !hayMas || typeof IntersectionObserver !== 'function') return undefined;
    const io = new IntersectionObserver((v) => { if (v.some((x) => x.isIntersecting)) sigue(); }, { root: caja.current, rootMargin: '0px 0px 600px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [hayMas, sigue, entrenos.length]);

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Tus entrenos" style={{ position: 'fixed', inset: 0, zIndex: 3100, background: LT.bg, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: 'calc(10px + env(safe-area-inset-top)) 12px 4px', maxWidth: 560, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <button type="button" onClick={alCerrar} aria-label="Volver" className="kp-press" style={{ width: 44, height: 44, borderRadius: 14, border: 'none', background: 'transparent', color: LT.blue, display: 'grid', placeItems: 'center', cursor: 'pointer' }}>
          <ChevronLeft size={24} />
        </button>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: -0.4, color: LT.text }}>Tus entrenos</h2>
      </div>
      <div ref={caja} style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '8px 16px calc(28px + env(safe-area-inset-bottom))', display: 'flex', flexDirection: 'column', gap: 18 }}>
          {grupos.map((g) => (
            <Grupo key={g.mes} titulo={g.mes}>
              {g.entrenos.map((e) => <FilaDeTusEntrenos key={e.clave} e={e} alAbrir={alAbrir} alCompartir={alCompartir} propias={propias} />)}
            </Grupo>
          ))}
          {!leyendo && !hayMas && !grupos.length && (
            <p style={{ margin: '24px 8px', fontSize: 15, fontWeight: 600, color: LT.text2, textAlign: 'center' }}>Aquí van a aparecer tus entrenos.</p>
          )}
          {error && (
            <button type="button" onClick={sigue} className="kp-press" style={{ border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 700, color: KP.blue, padding: 12 }}>
              No se pudieron leer más entrenos. Toca para intentar otra vez.
            </button>
          )}
          {leyendo && (
            <div role="status" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 10, padding: 14, fontSize: 14, fontWeight: 600, color: LT.text2 }}>
              <Loader2 size={18} className="spin" color={KP.blue} /> Leyendo tus entrenos…
            </div>
          )}
          <div ref={final} aria-hidden="true" style={{ height: 1 }} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
