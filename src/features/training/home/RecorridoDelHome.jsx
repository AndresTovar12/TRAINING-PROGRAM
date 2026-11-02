import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FONT, KP } from '@/lib/theme';
import { PASOS, colocaElGlobo, desplazamientoParaVer, mascaraDelHueco, ponRecorridoAbierto } from '@/lib/recorridoDelHome';

/* EL RECORRIDO DE LA PRIMERA VEZ (2 nov 2026; spec `docs/superpowers/specs/2026-11-02-home-sin-plan-recorrido.md`, maqueta https://claude.ai/artifact/6uAsYxiGLPzfVdWNw5SSxC).
   Seis pasos sobre el Home sin plan: el fondo se oscurece y se desenfoca, queda un hueco con esquinas redondas sobre la pieza que se explica (con un borde blanco que late)
   y un globo la señala con su flechita. Cada pieza se marca con `data-recorrido="…"`; los textos y las medidas viven en `lib/recorridoDelHome.js`.
     · El hueco y el globo se recalculan al cambiar el tamaño de la pantalla y al moverse la página. Una pieza fuera de la pantalla se trae con la página.
     · Una pieza que no existe (la barra de abajo en la computadora) se salta, y el «N de M» se ajusta.
     · El velo ya no deja pasar nada: tocar el fondo, o el hueco, no hace nada. Solo los botones del globo (y Escape en la web).
     · El velo se dibuja recortado con `mask-image` y es de adorno (`pointer-events: none`); quien bloquea es la capa transparente de abajo.
   `alCerrar(visto)`: `true` si llegó al final o lo saltó (cuenta como visto); `false` si no había nada que enseñar. */

const existe = (id) => document.querySelector(`[data-recorrido="${id}"]`);
// El botón de la cuenta (fijo arriba a la derecha) mide 52 px + 6 de margen + 16 de aire: la franja libre de la página empieza debajo.
const BAJO_LA_CUENTA = 84;
// Lo que ocupa la barra de abajo (más el borde del iPhone, que se suma aparte).
const SOBRE_LA_BARRA = 76;

export default function RecorridoDelHome({ conCoach = false, nombreCoach = '', alCerrar }) {
  const [ids, setIds] = useState(null); // los pasos que existen, en orden
  const [i, setI] = useState(0);
  const [geom, setGeom] = useState(null); // { hueco, mascara, globo }
  const raiz = useRef(null);
  const seguro = useRef(null);
  const globo = useRef(null);
  const principal = useRef(null);
  const ajustado = useRef(null); // el paso al que ya se le acercó la página (una sola vez)
  const cierre = useRef(alCerrar);
  useEffect(() => { cierre.current = alCerrar; });

  // Al abrir: qué pasos existen. El botón de la cuenta se queda a la vista mientras dure.
  useLayoutEffect(() => {
    const vivos = PASOS.filter((p) => existe(p.id)).map((p) => p.id);
    if (!vivos.length) { cierre.current?.(false); return undefined; }
    setIds(vivos);
    ponRecorridoAbierto(true);
    return () => ponRecorridoAbierto(false);
  }, []);

  const id = ids?.[i];
  const paso = PASOS.find((p) => p.id === id);
  const ultimo = !!ids && i === ids.length - 1;
  const cierra = useCallback(() => cierre.current?.(true), []);
  const sigue = useCallback(() => setI((n) => n + 1), []);

  // Dónde cae el hueco y dónde el globo.
  const mide = useCallback(() => {
    const capa = raiz.current;
    const g = globo.current;
    if (!capa || !g || !paso) return;
    const pieza = existe(paso.id);
    if (!pieza) { // la pieza se fue a media vuelta: se salta
      setIds((l) => l.filter((x) => x !== paso.id));
      return;
    }
    const c = capa.getBoundingClientRect();
    const dentro = getComputedStyle(seguro.current);
    const pantalla = { w: c.width, h: c.height, arriba: parseFloat(dentro.paddingTop) || 0, abajo: parseFloat(dentro.paddingBottom) || 0 };
    let r = pieza.getBoundingClientRect();
    const alto = g.offsetHeight;
    // Una pieza que se sale de la pantalla (o que deja sin lugar al globo) se trae con la página, una sola vez por paso.
    if (!paso.fijo && ajustado.current !== paso.id) {
      ajustado.current = paso.id;
      const baja = desplazamientoParaVer({ rect: r, alto, pantalla, limites: { arriba: pantalla.arriba + BAJO_LA_CUENTA, abajo: pantalla.h - pantalla.abajo - SOBRE_LA_BARRA } });
      // Sin pasarse del final de la página (el rebote del iPhone la deja más allá y desplaza lo fijo).
      const tope = document.documentElement.scrollHeight - window.innerHeight;
      const sinPasarse = Math.max(-window.scrollY, Math.min(baja, tope - window.scrollY));
      if (sinPasarse) { window.scrollBy(0, sinPasarse); r = pieza.getBoundingClientRect(); }
    }
    const m = paso.margen;
    // Las medidas van desde la esquina de esta capa, que es donde se dibujan (si la pantalla rebota, la capa fija se corre un poco).
    const hueco = { x: r.left - c.left - m, y: r.top - c.top - m, w: r.width + m * 2, h: r.height + m * 2 };
    // Solo se vuelve a dibujar si algo cambió de verdad (en el rato en que se sigue a la pieza, casi todos los cuadros son iguales).
    const clave = [pantalla.w, pantalla.h, alto, hueco.x, hueco.y, hueco.w, hueco.h].map((n) => Math.round(n * 2)).join(',');
    setGeom((g) => (g?.clave === clave ? g : {
      clave, hueco, radio: paso.radio + m, mascara: mascaraDelHueco(pantalla.w, pantalla.h, hueco, paso.radio + m),
      globo: colocaElGlobo({ hueco, alto, pantalla }),
    }));
  }, [paso]);

  // Al cambiar de paso: medir antes de pintar, y el foco al botón de seguir.
  useLayoutEffect(() => { mide(); }, [mide, i, ids]);
  useEffect(() => { if (id) principal.current?.focus({ preventScroll: true }); }, [id]);

  // Se recalcula al girar el teléfono, al cambiar el tamaño y al moverse la página; y si la pieza cambia de tamaño (letra grande, fotos que cargan).
  useEffect(() => {
    if (!id) return undefined;
    window.addEventListener('resize', mide);
    window.addEventListener('scroll', mide, { passive: true });
    const ojo = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(mide);
    const pieza = existe(id);
    if (ojo && pieza) ojo.observe(pieza);
    /* Y un ratito después de llegar al paso se sigue a la pieza cuadro por cuadro: el botón de la cuenta regresa a su lugar con una transición, la página termina de
       moverse, las fotos acaban de cargar. Ninguno de esos cambios avisa con un evento. */
    let cuadro = 0;
    const desde = performance.now();
    const sigue = (ahora) => { mide(); if (ahora - desde < 800) cuadro = requestAnimationFrame(sigue); };
    cuadro = requestAnimationFrame(sigue);
    return () => { cancelAnimationFrame(cuadro); window.removeEventListener('resize', mide); window.removeEventListener('scroll', mide); ojo?.disconnect(); };
  }, [id, mide]);

  // Nada pasa por debajo: ni dedos que arrastran la página ni la rueda. Escape cierra; Tab no se sale del globo.
  useEffect(() => {
    const capa = raiz.current;
    if (!capa) return undefined;
    const quieto = (e) => e.preventDefault();
    capa.addEventListener('touchmove', quieto, { passive: false });
    capa.addEventListener('wheel', quieto, { passive: false });
    const teclas = (e) => {
      if (e.key === 'Escape') { e.preventDefault(); cierra(); return; }
      if (e.key !== 'Tab') return;
      const botones = [...(globo.current?.querySelectorAll('button') ?? [])];
      if (!botones.length) return;
      const k = botones.indexOf(document.activeElement);
      const siguiente = e.shiftKey ? botones[(k <= 0 ? botones.length : k) - 1] : botones[(k + 1) % botones.length];
      e.preventDefault();
      siguiente.focus({ preventScroll: true });
    };
    document.addEventListener('keydown', teclas);
    return () => { capa.removeEventListener('touchmove', quieto); capa.removeEventListener('wheel', quieto); document.removeEventListener('keydown', teclas); };
  }, [cierra]);

  // Si ya no queda ninguna pieza, no hay nada que enseñar. Y si se salta una, el paso en que va no se sale de la lista.
  useEffect(() => {
    if (!ids) return;
    if (!ids.length) cierre.current?.(false);
    else if (i >= ids.length) setI(ids.length - 1);
  }, [ids, i]);
  if (ids && !ids.length) return null;

  const salir = ultimo ? cierra : sigue;
  const total = ids?.length ?? 0;
  return createPortal(
    <div ref={raiz} style={{ position: 'fixed', inset: 0, zIndex: 2000, touchAction: 'none', fontFamily: FONT }}>
      <div ref={seguro} aria-hidden="true" style={{ position: 'absolute', left: 0, top: 0, width: 0, height: 0, paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)', visibility: 'hidden' }} />
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0, pointerEvents: 'none', background: 'rgba(9,12,28,0.58)', backdropFilter: 'blur(3px)', WebkitBackdropFilter: 'blur(3px)',
          opacity: geom ? 1 : 0, transition: 'opacity 0.22s ease',
          ...(geom ? { WebkitMaskImage: geom.mascara, maskImage: geom.mascara, WebkitMaskSize: '100% 100%', maskSize: '100% 100%', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat' } : null),
        }}
      />
      {geom && (
        <div
          aria-hidden="true" className="recorrido-late"
          style={{ position: 'absolute', pointerEvents: 'none', left: geom.hueco.x, top: geom.hueco.y, width: geom.hueco.w, height: geom.hueco.h, borderRadius: geom.radio }}
        />
      )}
      <div
        ref={globo} role="dialog" aria-modal="true" aria-labelledby="recorrido-titulo"
        style={{
          position: 'absolute', boxSizing: 'border-box', width: 'min(380px, calc(100% - 32px))', padding: '16px 16px 12px', borderRadius: 22, background: '#fff', color: KP.ink,
          boxShadow: '0 18px 40px rgba(9,12,28,0.35)', opacity: geom ? 1 : 0, transform: geom ? 'none' : 'translateY(6px)', transition: 'opacity 0.22s ease, transform 0.22s ease',
          left: geom?.globo.left ?? 16, top: geom?.globo.top ?? 0,
        }}
      >
        {geom && (
          <i
            aria-hidden="true"
            style={{ position: 'absolute', width: 16, height: 16, background: '#fff', borderRadius: 3, transform: 'rotate(45deg)', left: geom.globo.flecha - 8, ...(geom.globo.abajo ? { top: -7 } : { bottom: -7 }) }}
          />
        )}
        {paso && (
          <div key={paso.id} aria-live="polite">
            <div style={{ fontSize: 12.5, fontWeight: 700, color: KP.blue }}>{i + 1} de {total}</div>
            <h2 id="recorrido-titulo" style={{ margin: '3px 0 4px', fontSize: 18, fontWeight: 800, letterSpacing: -0.3, lineHeight: 1.2, color: KP.ink }}>{paso.titulo}</h2>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 500, lineHeight: 1.4, color: KP.ink2 }}>{paso.texto({ conCoach, nombreCoach })}</p>
          </div>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 10 }}>
          <span aria-hidden="true" style={{ display: 'flex', gap: 5, marginRight: 'auto' }}>
            {(ids ?? []).map((x, k) => (
              <i key={x} style={{ display: 'block', height: 7, width: k === i ? 18 : 7, borderRadius: 99, background: k === i ? KP.blue : '#D9DDE6' }} />
            ))}
          </span>
          {!ultimo && (
            <button
              type="button" onClick={cierra} className="kp-press"
              style={{ minHeight: 44, padding: '0 10px', border: 'none', background: 'transparent', color: KP.ink2, fontFamily: FONT, fontSize: 14, fontWeight: 700, cursor: 'pointer', touchAction: 'manipulation' }}
            >
              Saltar
            </button>
          )}
          <button
            ref={principal} type="button" onClick={salir} className="kp-press"
            style={{ minHeight: 44, padding: '0 18px', border: 'none', borderRadius: 14, background: KP.blue, color: '#fff', fontFamily: FONT, fontSize: 14.5, fontWeight: 800, cursor: 'pointer', touchAction: 'manipulation' }}
          >
            {ultimo ? 'Listo' : 'Siguiente'}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
