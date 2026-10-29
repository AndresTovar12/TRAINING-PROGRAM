import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { LT, FONT, KP } from '@/lib/theme';
import { porMes } from '@/lib/entrenosDelPlan';
import { filtroDe, filtrosDe, subtituloDelHistorial, tituloDelMes, totalDelMes } from '@/lib/paginaDelEntreno';
import { Grupo } from '@/components/ui';
import { FilaDeTusEntrenos } from './TusEntrenos';
import { useHistorialCompleto } from './useEntrenoLibre';

/* «VER TODOS» (fase 6, 29 oct 2026; fase 7: como el prototipo de caminos). El historial completo, la misma lista de «Tus entrenos» (libres, del reloj y workouts
   del plan), agrupada por mes, cada fila con su ⇪. Sin buscador.
   · Arriba «‹ Home» (o «‹ Atrás» desde Entrenar: `volverA`), el título grande «Tus entrenos» y debajo «11 entrenos · desde septiembre».
   · Filtros en fila: «Todas» y las actividades que tenga (Correr, Bici, Fuerza, Pádel, Caminar, Nadar, y luego las demás). Los workouts del plan cuentan como Fuerza.
   · Cada mes con su total a la derecha («7 entrenos · 5 h 9 min»): el del filtro elegido.
   · Al final, solo para quien no tiene plan (`alQuererPlan`): «¿Quieres un plan para tu siguiente meta?», que lleva a Explorar.
   Se lee por páginas de 50 al llegar abajo (`useHistorialCompleto`). Va debajo de las páginas de cada entreno (capa 3100; las páginas van en 3200), así que
   abrir uno y volver deja la lista donde estaba. */
export default function HistorialCompleto({ userId, propias = [], unidadPeso = 'kg', volverA = 'Home', alAbrir, alCompartir, alCerrar, alQuererPlan = null }) {
  const { entrenos, hayMas, leyendo, error, sigue, resumen } = useHistorialCompleto(userId);
  const [filtro, setFiltro] = useState('todas');
  const filtros = useMemo(() => filtrosDe(entrenos, propias), [entrenos, propias]);
  const elegido = filtro === 'todas' || filtros.some((f) => f.id === filtro) ? filtro : 'todas';
  const grupos = useMemo(() => porMes(elegido === 'todas' ? entrenos : entrenos.filter((e) => filtroDe(e, propias).id === elegido)), [entrenos, elegido, propias]);
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
  }, [hayMas, sigue, entrenos.length, elegido]);
  const chip = (activo) => ({
    flex: 'none', border: 'none', borderRadius: 999, minHeight: 38, padding: '9px 15px', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700,
    background: activo ? LT.text : '#fff', color: activo ? '#fff' : LT.text, touchAction: 'manipulation',
  });
  const subtitulo = resumen ? subtituloDelHistorial(resumen.total, resumen.primero) : '';

  return createPortal(
    <div role="dialog" aria-modal="true" aria-label="Tus entrenos" style={{ position: 'fixed', inset: 0, zIndex: 3100, background: LT.bg, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      <div style={{ padding: 'calc(10px + env(safe-area-inset-top)) 12px 0', maxWidth: 560, width: '100%', margin: '0 auto', boxSizing: 'border-box' }}>
        <button type="button" onClick={alCerrar} className="kp-press" style={{ display: 'inline-flex', alignItems: 'center', gap: 2, padding: '8px 10px 8px 4px', border: 'none', background: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 15.5, fontWeight: 800, color: KP.blue }}>
          <ChevronLeft size={20} /> {volverA}
        </button>
      </div>
      <div ref={caja} style={{ flex: 1, overflowY: 'auto' }}>
        <div style={{ maxWidth: 560, margin: '0 auto', padding: '0 0 calc(28px + env(safe-area-inset-bottom))' }}>
          <h1 style={{ margin: '2px 16px 0', fontSize: 28, fontWeight: 800, lineHeight: 1.1, letterSpacing: -0.6, color: LT.text }}>Tus entrenos</h1>
          <p style={{ margin: '2px 16px 12px', minHeight: 21, fontSize: 14, fontWeight: 500, color: LT.text2 }}>{subtitulo}</p>
          {filtros.length > 1 && (
            <div role="group" aria-label="Filtrar por actividad" style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 16px 4px', scrollbarWidth: 'none' }}>
              {[{ id: 'todas', nombre: 'Todas' }, ...filtros].map((f) => (
                <button key={f.id} type="button" aria-pressed={elegido === f.id} onClick={() => setFiltro(f.id)} className="kp-press" style={chip(elegido === f.id)}>{f.nombre}</button>
              ))}
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 22, padding: '16px 16px 0' }}>
            {grupos.map((g) => (
              <Grupo key={g.mes} titulo={tituloDelMes(g.mes)} accion={<span style={{ fontSize: 13, fontWeight: 600, color: LT.text2, fontVariantNumeric: 'tabular-nums' }}>{totalDelMes(g.entrenos)}</span>}>
                {g.entrenos.map((e) => <FilaDeTusEntrenos key={e.clave} e={e} alAbrir={alAbrir} alCompartir={alCompartir} propias={propias} unidadPeso={unidadPeso} />)}
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
            {alQuererPlan && !hayMas && (
              <button type="button" onClick={alQuererPlan} className="kp-press" style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 'none', textAlign: 'left', background: '#fff', borderRadius: 18, padding: '14px 16px', cursor: 'pointer', fontFamily: FONT, color: LT.text }}>
                <span style={{ flex: 1, minWidth: 0 }}>
                  <b style={{ display: 'block', fontSize: 15 }}>¿Quieres un plan para tu siguiente meta?</b>
                  <span style={{ display: 'block', fontSize: 13, color: LT.text2, marginTop: 2 }}>Coaches con planes para correr, bici y fuerza</span>
                </span>
                <ChevronRight size={18} color={LT.text3} style={{ flex: 'none' }} />
              </button>
            )}
          </div>
          <div ref={final} aria-hidden="true" style={{ height: 1 }} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
