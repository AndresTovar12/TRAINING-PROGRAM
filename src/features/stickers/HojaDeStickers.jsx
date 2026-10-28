import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { Check, Pencil } from 'lucide-react';
import { FONT } from '@/lib/theme';
import { ficha as fichaDe } from '@/lib/stickers/ficha';
import { catalogo, COLORES, LIENZOS } from '@/lib/stickers/catalogo';
import { entregaArchivo } from '@/lib/entregaArchivo';
import { vibra } from '@/lib/avisosNativos';
import CambiarNombre from './CambiarNombre';
import Sticker from './Sticker';
import { nombreDeArchivo, pngDeSticker } from './exporta';

/* LA HOJA DE STICKERS (Andrés, 28 oct 2026; ver docs/stickers.md y el prototipo). Sustituye a la hoja y al editor del sello.

   Se abre desde el aviso de la página del entreno, el ⇪ de cada fila de «Tus entrenos», «Compartir» de la página del entreno, Mis métricas y, en el plan, el final
   del entreno y el día. NUNCA se abre sola al terminar.

   Arriba: «Comparte tu carrera / tu workout / tu entreno», el nombre con lápiz (si se puede renombrar) y «Cerrar»; los cuatro colores y «Toca para copiar · Mantén
   para guardar». Abajo, la galería: dos columnas de mosaicos 3:2, una sola lista en el orden del catálogo, sin nombres. Cada sticker se ve achicado en su mosaico,
   pero se copia y se guarda a su tamaño real (`exporta.js`).

   Tocar = copiar (aviso «Copiado. Pégalo en tu historia.» con «Abrir Instagram» y «Guardar», 3.5 s). Mantener 0.6 s = guardar, con un anillo que se llena; si se
   suelta antes, regresa. Mover el dedo más de 10 px = desplazar la lista. Se cierra con «Cerrar» o arrastrando la cabecera hacia abajo (120 px, o rápido).
   Fase 1: solo la pestaña «Stickers»; «Con foto» y «Video» llegan en la fase 2.

   `entreno`: lo que pide `ficha()` (o `cargar`, una función que lo trae; mientras, se ven mosaicos vacíos). `titulo`: el de la cabecera. `nombre`: el del
   entreno. `alRenombrar(nombre)`: guarda el nombre nuevo (sin ella no hay lápiz). */

const FONDO = '#0E1220';
const TINTA_2 = '#9AA3B8';
const CAJA_2 = '#1E2436';
const CURVA = 'cubic-bezier(.32,.72,0,1)';
const ANILLO = 138.23; // 2π · 22
const MANTENER_MS = 600;
const ESPERA_ANILLO_MS = 120;
const DAMERO = {
  oscuro: { backgroundColor: '#3A3F4C', backgroundImage: 'conic-gradient(#474C59 25%, #3A3F4C 0 50%, #474C59 0 75%, #3A3F4C 0)', backgroundSize: '18px 18px' },
  claro: { backgroundColor: '#C9CCD4', backgroundImage: 'conic-gradient(#DCDEE4 25%, #C9CCD4 0 50%, #DCDEE4 0 75%, #C9CCD4 0)', backgroundSize: '18px 18px' },
};

const reduceMovimiento = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const puedeCopiar = () => !!(navigator.clipboard?.write && typeof window.ClipboardItem === 'function');

/** Un mosaico: el sticker achicado para caber centrado, el anillo de «mantener» y la palomita de guardado. */
function Mosaico({ item, f, color, ancho, alCopiar, alGuardar }) {
  const [presion, setPresion] = useState(0); // 0..1 del anillo
  const [guardado, setGuardado] = useState(false);
  const t = useRef(null);
  const alto = Math.round((ancho * 2) / 3);
  const { h } = LIENZOS[item.forma];
  const k = ancho > 0 ? Math.min(ancho / 300, alto / h) : 0;

  const suelta = () => { setPresion(0); };
  const empieza = (ev) => {
    if (ev.button > 0) return;
    const t0 = performance.now();
    const x = { x0: ev.clientX, y0: ev.clientY, t0, movido: false, hecho: false, raf: 0, id: ev.pointerId };
    t.current = x;
    const paso = (ahora) => {
      if (t.current !== x || x.movido) return;
      const p = Math.min(1, (ahora - t0 - ESPERA_ANILLO_MS) / MANTENER_MS);
      if (p > 0) setPresion(p);
      if (p >= 1) {
        x.hecho = true;
        setPresion(0);
        setGuardado(true);
        setTimeout(() => setGuardado(false), 1100);
        alGuardar(item);
        return;
      }
      x.raf = requestAnimationFrame(paso);
    };
    x.raf = requestAnimationFrame(paso);
  };
  const mueve = (ev) => {
    const x = t.current;
    if (!x || ev.pointerId !== x.id || x.movido) return;
    if (Math.hypot(ev.clientX - x.x0, ev.clientY - x.y0) > 10) { x.movido = true; cancelAnimationFrame(x.raf); suelta(); }
  };
  const termina = (ev) => {
    const x = t.current;
    if (!x || ev.pointerId !== x.id) return;
    t.current = null;
    cancelAnimationFrame(x.raf);
    if (x.hecho || x.movido) return;
    suelta();
    if (performance.now() - x.t0 < ESPERA_ANILLO_MS + MANTENER_MS + 120) alCopiar(item);
  };
  const cancela = (ev) => { const x = t.current; if (x && ev.pointerId === x.id) { cancelAnimationFrame(x.raf); t.current = null; suelta(); } };

  return (
    <button
      type="button" aria-label={`Sticker ${item.nombre}. Toca para copiar; mantén presionado para guardar`}
      onPointerDown={empieza} onPointerMove={mueve} onPointerUp={termina} onPointerCancel={cancela}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); alCopiar(item); } }}
      onContextMenu={(ev) => ev.preventDefault()}
      style={{ position: 'relative', border: 'none', padding: 0, background: 'none', cursor: 'pointer', touchAction: 'pan-y', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', display: 'block', width: '100%' }}
    >
      <span
        style={{
          position: 'relative', display: 'block', width: '100%', height: alto, borderRadius: 16, overflow: 'hidden',
          ...(color.clara ? DAMERO.claro : DAMERO.oscuro),
          transform: presion > 0 ? 'scale(.96)' : 'none', transition: `transform .2s ${CURVA}`,
        }}
      >
        {k > 0 && (
          <span style={{ position: 'absolute', left: (ancho - 300 * k) / 2, top: (alto - h * k) / 2, transform: `scale(${k.toFixed(4)})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
            <Sticker item={item} f={f} color={color} />
          </span>
        )}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute', left: '50%', top: '50%', width: 64, height: 64, margin: '-32px 0 0 -32px', borderRadius: '50%', display: 'grid', placeItems: 'center',
            background: guardado ? 'rgba(4,120,87,.85)' : 'rgba(7,9,15,.55)', opacity: presion > 0 || guardado ? 1 : 0, transition: 'opacity .15s',
          }}
        >
          {guardado ? <Check size={26} color="#fff" strokeWidth={3} /> : (
            <svg viewBox="0 0 52 52" width="52" height="52" style={{ transform: 'rotate(-90deg)' }}>
              <circle cx="26" cy="26" r="22" fill="none" strokeWidth="4" stroke="rgba(255,255,255,.25)" />
              <circle cx="26" cy="26" r="22" fill="none" strokeWidth="4" stroke="#fff" strokeLinecap="round" strokeDasharray={ANILLO} strokeDashoffset={(ANILLO * (1 - presion)).toFixed(2)} />
            </svg>
          )}
        </span>
      </span>
    </button>
  );
}

/** Lo ancho de un elemento, al cambiar (para el tamaño de los mosaicos). */
function useAncho() {
  const ref = useRef(null);
  const [ancho, setAncho] = useState(0);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const mide = () => setAncho(el.clientWidth);
    mide();
    if (typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(mide);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, ancho];
}

export default function HojaDeStickers({ entreno = null, cargar = null, titulo = 'Comparte tu entreno', nombre = '', alRenombrar = null, onCerrar, capa = 3300 }) {
  const [cargado, setCargado] = useState(cargar ? undefined : null); // undefined: cargando
  const [abierta, setAbierta] = useState(false);
  const [cerrando, setCerrando] = useState(false);
  const [colorI, setColorI] = useState(0);
  const [aviso, setAviso] = useState(null); // { texto, error?, acciones? }
  const [renombrando, setRenombrando] = useState(false);
  const [nombreVisto, setNombreVisto] = useState(nombre);
  const [galeriaRef, anchoGaleria] = useAncho();
  const hojaRef = useRef(null);
  const veloRef = useRef(null);
  const arrastre = useRef(null);
  const reloj = useRef(0);
  const rm = useMemo(() => reduceMovimiento(), []);
  const enApp = Capacitor.isNativePlatform();

  useEffect(() => {
    if (!cargar) return undefined;
    let vivo = true;
    Promise.resolve().then(cargar).then((e) => { if (vivo) setCargado(e ?? null); }).catch(() => { if (vivo) setCargado(null); });
    return () => { vivo = false; };
  }, [cargar]);

  const base = cargar ? cargado : entreno;
  const f = useMemo(() => (base ? fichaDe({ ...base, nombre: nombreVisto || base.nombre }) : null), [base, nombreVisto]);
  const items = useMemo(() => (f ? catalogo(f) : []), [f]);
  const color = COLORES[colorI];

  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setAbierta(true)));
    return () => cancelAnimationFrame(r);
  }, []);
  const cierra = useCallback(() => {
    if (cerrando) return;
    setCerrando(true);
    setAbierta(false);
    setTimeout(onCerrar, rm ? 0 : 260);
  }, [cerrando, onCerrar, rm]);
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape' && !renombrando) cierra(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [cierra, renombrando]);
  useEffect(() => () => clearTimeout(reloj.current), []);

  const avisa = (a) => {
    clearTimeout(reloj.current);
    setAviso(a);
    reloj.current = setTimeout(() => setAviso(null), a.dura ?? 3500);
  };

  const guarda = async (item) => {
    vibra('listo');
    try {
      await entregaArchivo(await pngDeSticker({ item, f, color }), nombreDeArchivo(item));
      if (!enApp) avisa({ texto: 'Imagen guardada.' });
    } catch {
      avisa({ texto: 'No se pudo guardar. Inténtalo otra vez.', error: true });
    }
  };
  const copia = (item) => {
    vibra('toque');
    const falla = () => avisa({ texto: 'No se pudo copiar. Mantén presionado el sticker para guardarlo.', error: true, acciones: [{ t: 'Guardar', fn: () => guarda(item) }] });
    if (!puedeCopiar()) { falla(); return; }
    try {
      // La promesa va adentro del ClipboardItem: Safari solo deja copiar si `write` se llama en el mismo toque.
      navigator.clipboard.write([new window.ClipboardItem({ 'image/png': pngDeSticker({ item, f, color }) })])
        .then(() => avisa({
          texto: 'Copiado. Pégalo en tu historia.',
          acciones: [...(enApp ? [{ t: 'Abrir Instagram', fn: () => { window.location.href = 'instagram://story-camera'; } }] : []), { t: 'Guardar', fn: () => guarda(item) }],
        }))
        .catch(falla);
    } catch { falla(); }
  };

  // Arrastrar la cabecera hacia abajo cierra; hacia arriba resiste.
  const bajaInicia = (ev) => {
    if (ev.target.closest('button')) return;
    arrastre.current = { y0: ev.clientY, t: performance.now(), dy: 0, v: 0, id: ev.pointerId };
    if (hojaRef.current) hojaRef.current.style.transition = 'none';
    ev.currentTarget.setPointerCapture?.(ev.pointerId);
  };
  const bajaMueve = (ev) => {
    const d = arrastre.current;
    if (!d || ev.pointerId !== d.id) return;
    let dy = ev.clientY - d.y0;
    const ahora = performance.now();
    d.v = (dy - d.dy) / Math.max(1, ahora - d.t);
    d.t = ahora;
    if (dy < 0) dy = -(Math.abs(dy) * 60) / (60 + Math.abs(dy));
    d.dy = dy;
    if (hojaRef.current) hojaRef.current.style.transform = `translateY(${dy.toFixed(1)}px)`;
    if (veloRef.current) veloRef.current.style.opacity = String(Math.max(0, 1 - Math.max(0, dy) / ((hojaRef.current?.offsetHeight ?? 600) * 0.9)));
  };
  const bajaTermina = (ev) => {
    const d = arrastre.current;
    if (!d || ev.pointerId !== d.id) return;
    arrastre.current = null;
    const h = hojaRef.current;
    if (veloRef.current) veloRef.current.style.opacity = '';
    if (d.dy > 120 || d.v > 0.11) {
      if (h) { h.style.transition = `transform .25s ${CURVA}`; h.style.transform = 'translateY(105%)'; }
      cierra();
      return;
    }
    if (h) {
      h.style.transition = `transform .4s ${CURVA}`;
      h.style.transform = '';
    }
  };

  const guardaNombre = async (nuevo) => {
    try {
      await alRenombrar(nuevo);
      setNombreVisto(nuevo);
      setRenombrando(false);
      avisa({ texto: 'Nombre guardado.' });
    } catch {
      avisa({ texto: 'No se pudo guardar el nombre.', error: true });
    }
  };

  const gap = 12;
  const anchoMosaico = anchoGaleria > 0 ? Math.floor((anchoGaleria - gap) / 2) : 0;
  const dur = rm ? '0s' : (cerrando ? '.25s' : '.5s');

  return createPortal(
    <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: capa, fontFamily: FONT }}>
      <div ref={veloRef} onClick={cierra} style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,.42)', opacity: abierta ? 1 : 0, transition: `opacity .3s ease-out` }} />
      <section
        ref={hojaRef} role="dialog" aria-modal="true" aria-labelledby="stk-titulo"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, height: 'calc(100% - env(safe-area-inset-top) - 14px)', maxWidth: 620, margin: '0 auto',
          background: FONDO, color: '#EEF0F6', borderRadius: '28px 28px 0 0', display: 'flex', flexDirection: 'column',
          transform: abierta ? 'translateY(0)' : 'translateY(105%)', transition: `transform ${dur} ${CURVA}`, willChange: 'transform',
        }}
      >
        <div onPointerDown={bajaInicia} onPointerMove={bajaMueve} onPointerUp={bajaTermina} onPointerCancel={bajaTermina} style={{ padding: '8px 18px 0', touchAction: 'none', cursor: 'grab' }}>
          <div aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 3, background: '#3A4157', margin: '0 auto 10px' }} />
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ minWidth: 0 }}>
              <h2 id="stk-titulo" style={{ margin: 0, fontSize: 23, lineHeight: 1.1, color: '#fff', fontWeight: 800, letterSpacing: -0.4 }}>{titulo}</h2>
              {alRenombrar ? (
                <button
                  type="button" onClick={() => setRenombrando(true)} aria-label={`Cambiar el nombre: ${nombreVisto}`}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, maxWidth: '100%', border: 'none', background: 'none', padding: '6px 0', marginTop: 2, color: TINTA_2, fontFamily: FONT, fontSize: 14, fontWeight: 600, minHeight: 36, cursor: 'pointer', textAlign: 'left' }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{nombreVisto}</span>
                  <Pencil size={15} color="#C9CFDD" style={{ flex: 'none' }} />
                </button>
              ) : (
                nombreVisto ? <div style={{ padding: '6px 0', marginTop: 2, color: TINTA_2, fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minHeight: 24 }}>{nombreVisto}</div> : null
              )}
            </div>
            <button type="button" onClick={cierra} className="kp-press" style={{ flex: 'none', border: 'none', background: CAJA_2, color: '#fff', borderRadius: 999, padding: '9px 15px', fontFamily: FONT, fontSize: 14.5, fontWeight: 700, minHeight: 40, cursor: 'pointer' }}>Cerrar</button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '14px 0 6px' }}>
            {COLORES.map((c, i) => (
              <button
                key={c.id} type="button" onClick={() => setColorI(i)} aria-pressed={colorI === i} aria-label={`Tinta ${c.nombre.toLowerCase()}`}
                style={{
                  width: 30, height: 30, borderRadius: '50%', border: c.id === 'negro' ? '1px solid #3A4157' : 'none', /* estilo-ok: el negro sobre la hoja oscura no se vería sin su orilla */ padding: 0, flex: 'none', background: c.tinta, cursor: 'pointer',
                  boxShadow: colorI === i ? `0 0 0 2px ${FONDO}, 0 0 0 4px #EEF0F6` : 'none',
                }}
              />
            ))}
            <span style={{ marginLeft: 'auto', fontSize: 12.5, color: TINTA_2, textAlign: 'right', lineHeight: 1.3 }}>Toca para copiar<br />Mantén para guardar</span>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '10px 18px calc(24px + env(safe-area-inset-bottom))' }}>
          <div ref={galeriaRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap, alignContent: 'start' }}>
            {f && items.map((item) => (
              <Mosaico key={item.id} item={item} f={f} color={color} ancho={anchoMosaico} alCopiar={copia} alGuardar={guarda} />
            ))}
            {!f && cargado === undefined && Array.from({ length: 4 }, (_, i) => (
              <span key={i} aria-hidden="true" style={{ display: 'block', height: Math.round((anchoMosaico * 2) / 3) || 110, borderRadius: 16, background: '#1B2030' }} />
            ))}
            {!f && cargado === null && (
              <p style={{ gridColumn: '1 / -1', margin: '18px 4px', fontSize: 15, lineHeight: 1.45, color: TINTA_2 }}>
                Todavía no hay nada que contar. Haz algún ejercicio con el entreno guiado y aquí aparecerán los stickers de tu sesión.
              </p>
            )}
          </div>
        </div>
        <div aria-live="polite" style={{ position: 'absolute', left: 10, right: 10, bottom: 'calc(10px + env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
          {aviso && (
            <div role={aviso.error ? 'alert' : 'status'} style={{ pointerEvents: 'auto', width: '100%', maxWidth: 520, background: 'rgba(24,28,40,.97)', color: '#fff', borderRadius: 20, padding: '12px 14px', boxShadow: '0 16px 40px rgba(0,0,0,.35)', display: 'grid', gap: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14.5, fontWeight: 600, lineHeight: 1.35 }}>
                <span aria-hidden="true" style={{ width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center', flexShrink: 0, background: aviso.error ? '#C2410C' : '#1F8F63' }}>
                  {aviso.error ? <span style={{ fontWeight: 800 }}>!</span> : <Check size={16} strokeWidth={3} />}
                </span>
                {aviso.texto}
              </div>
              {aviso.acciones?.length > 0 && (
                <div style={{ display: 'flex', gap: 8 }}>
                  {aviso.acciones.map((a, i) => (
                    <button
                      key={a.t} type="button" onClick={() => { setAviso(null); a.fn(); }}
                      style={{ flex: 1, border: 'none', borderRadius: 12, minHeight: 40, background: i === 0 ? '#fff' : 'rgba(255,255,255,.12)', color: i === 0 ? '#07090F' : '#fff', fontFamily: FONT, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
                    >
                      {a.t}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>
      {renombrando && <CambiarNombre nombre={nombreVisto} capa={capa + 10} alGuardar={guardaNombre} alCancelar={() => setRenombrando(false)} />}
    </div>,
    document.body,
  );
}
