import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { Check, ImagePlus, Pencil } from 'lucide-react';
import { FONT } from '@/lib/theme';
import { ficha as fichaDe } from '@/lib/stickers/ficha';
import { catalogo, COLORES, LIENZOS } from '@/lib/stickers/catalogo';
import { entregaArchivo } from '@/lib/entregaArchivo';
import { aImagenWeb } from '@/lib/imagen';
import { vibra } from '@/lib/avisosNativos';
import CambiarNombre from './CambiarNombre';
import Sticker from './Sticker';
import RutaVideo from './RutaVideo';
import { nombreDeArchivo, pngDeSticker, puedeGrabarVideo, videoDeSticker } from './exporta';

/* LA HOJA DE STICKERS (Andrés, 28 oct 2026; ver docs/stickers.md y el prototipo). Sustituye a la hoja y al editor del sello.

   Se abre desde el aviso de la página del entreno, el ⇪ de cada fila de «Tus entrenos», «Compartir» de la página del entreno, Mis métricas y, en el plan, el final
   del entreno y el día. NUNCA se abre sola al terminar.

   Arriba: «Comparte tu carrera / tu workout / tu entreno», el nombre con lápiz (si se puede renombrar) y «Cerrar»; los cuatro colores y «Toca para copiar · Mantén
   para guardar». Abajo, la galería: dos columnas de mosaicos 3:2, una sola lista en el orden del catálogo, sin nombres. Cada sticker se ve achicado en su mosaico,
   pero se copia y se guarda a su tamaño real (`exporta.js`).

   Tocar = copiar (aviso «Copiado. Pégalo en tu historia.» con «Abrir Instagram» y «Guardar», 3.5 s). Mantener 0.6 s = guardar, con un anillo que se llena; si se
   suelta antes, regresa. Mover el dedo más de 10 px = desplazar la lista. Se cierra con «Cerrar» o arrastrando la cabecera hacia abajo (120 px, o rápido).
   Pestañas (fase 2): «Stickers» (todos, sobre damero), «Con foto» (solo los de identidad sobre una foto 9:16: tres de ejemplo o una del carrete, que nunca sale
   del teléfono; se copia y se guarda la imagen entera, 900 × 1599) y «Video» (el Eco que cae y, si hubo ruta, la ruta que se dibuja: tocar o mantener guarda
   un video de 3 s). Con «reducir movimiento» la hoja no se desliza y los videos se ven quietos en la hoja.

   `entreno`: lo que pide `ficha()` (o `cargar`, una función que lo trae; mientras, se ven mosaicos vacíos). `titulo`: el de la cabecera. `nombre`: el del
   entreno. `alRenombrar(nombre)`: guarda el nombre nuevo (sin ella no hay lápiz). */

const FONDO = '#0E1220';
const TINTA_2 = '#9AA3B8';
const CAJA_2 = '#1E2436';
// El video no puede ser transparente: va sobre el fondo de la hoja (el mismo de `exporta.js`).
const FONDO_VIDEO = '#0E1220';
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

/**
 * Un mosaico: lo que se va a sacar (`children`, a su tamaño real: 300 × `lienzoH`) achicado para caber centrado, el anillo de «mantener» y la palomita de guardado.
 * `proporcion`: alto ÷ ancho del mosaico (2/3, o 16/9 en «Con foto»). `fondo`: el damero (transparente) o el color liso del video.
 */
function Mosaico({ etiqueta, ancho, proporcion, lienzoH, fondo, alTocar, alMantener, children }) {
  const [presion, setPresion] = useState(0); // 0..1 del anillo
  const [guardado, setGuardado] = useState(false);
  const t = useRef(null);
  const alto = Math.round(ancho * proporcion);
  const k = ancho > 0 ? Math.min(ancho / 300, alto / lienzoH) : 0;

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
        alMantener();
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
    alTocar();
  };
  const cancela = (ev) => { const x = t.current; if (x && ev.pointerId === x.id) { cancelAnimationFrame(x.raf); t.current = null; suelta(); } };

  return (
    <button
      type="button" aria-label={etiqueta}
      onPointerDown={empieza} onPointerMove={mueve} onPointerUp={termina} onPointerCancel={cancela}
      onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); alTocar(); } }}
      onContextMenu={(ev) => ev.preventDefault()}
      style={{ position: 'relative', border: 'none', padding: 0, background: 'none', cursor: 'pointer', touchAction: 'pan-y', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', display: 'block', width: '100%' }}
    >
      <span
        style={{
          position: 'relative', display: 'block', width: '100%', height: alto, borderRadius: 16, overflow: 'hidden', ...fondo,
          transform: presion > 0 ? 'scale(.96)' : 'none', transition: `transform .2s ${CURVA}`,
        }}
      >
        {k > 0 && (
          <span style={{ position: 'absolute', left: (ancho - 300 * k) / 2, top: (alto - lienzoH * k) / 2, transform: `scale(${k.toFixed(4)})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
            {children}
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
  const [pestana, setPestana] = useState('stickers'); // 'stickers' | 'foto' | 'video'
  const [foto, setFoto] = useState({ ejemplo: 'atardecer' }); // la de ejemplo, o { url } del carrete
  const [vuelta, setVuelta] = useState(0); // para repetir la animación de la pestaña Video
  const ocupado = useRef(false);
  const carrete = useRef(null);
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
  const eco = items.find((x) => x.id === 'eco') ?? null;
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
  // La foto del carrete vive solo en memoria (un enlace `blob:` local): se suelta al cambiarla o al cerrar.
  useEffect(() => () => { if (foto.url) URL.revokeObjectURL(foto.url); }, [foto]);
  // En la pestaña Video la animación se repite cada 3.2 s (con «reducir movimiento», quieta).
  useEffect(() => {
    if (pestana !== 'video' || rm) return undefined;
    const id = setInterval(() => setVuelta((v) => v + 1), 3200);
    return () => clearInterval(id);
  }, [pestana, rm]);

  const avisa = (a) => {
    clearTimeout(reloj.current);
    setAviso(a);
    reloj.current = setTimeout(() => setAviso(null), a.dura ?? 3500);
  };

  // En «Con foto» se saca la imagen entera (la historia, con la foto debajo); en «Stickers», el sticker solo.
  const comoSale = (item) => (pestana === 'foto' ? { item, f, color, forma: 'historia', foto } : { item, f, color });
  const guarda = async (item) => {
    vibra('listo');
    try {
      await entregaArchivo(await pngDeSticker(comoSale(item)), nombreDeArchivo(item));
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
      navigator.clipboard.write([new window.ClipboardItem({ 'image/png': pngDeSticker(comoSale(item)) })])
        .then(() => avisa({
          texto: 'Copiado. Pégalo en tu historia.',
          acciones: [...(enApp ? [{ t: 'Abrir Instagram', fn: () => { window.location.href = 'instagram://story-camera'; } }] : []), { t: 'Guardar', fn: () => guarda(item) }],
        }))
        .catch(falla);
    } catch { falla(); }
  };

  // Un video no se puede copiar: tocar o mantener lo arma (unos segundos) y lo guarda.
  const guardaVideo = async (clase, item) => {
    if (ocupado.current) return;
    if (!puedeGrabarVideo()) { avisa({ texto: 'Este teléfono no pudo armar el video.', error: true }); return; }
    ocupado.current = true;
    vibra('listo');
    avisa({ texto: 'Armando tu video…', dura: 120000 }); // se queda hasta que termine (lo cambia el siguiente aviso)
    try {
      const { blob, ext } = await videoDeSticker({ clase, item, f, color });
      await entregaArchivo(blob, nombreDeArchivo({ id: clase === 'eco' ? 'eco' : 'ruta' }, ext));
      avisa({ texto: enApp ? 'Video listo.' : 'Video guardado.' });
    } catch {
      avisa({ texto: 'No se pudo armar el video. Inténtalo otra vez.', error: true });
    } finally {
      ocupado.current = false;
    }
  };
  const eligeDelCarrete = async (ev) => {
    const archivo = ev.target.files?.[0];
    ev.target.value = '';
    if (!archivo) return;
    try {
      // HEIC del iPhone incluida: se convierte en el teléfono (`aImagenWeb`). Nada se sube.
      setFoto({ url: URL.createObjectURL(await aImagenWeb(archivo)) });
    } catch {
      avisa({ texto: 'No se pudo abrir esa foto. Prueba con otra.', error: true });
    }
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
    <div role="presentation" style={{ position: 'fixed', inset: 0, zIndex: capa, fontFamily: FONT, overflow: 'hidden' }}>
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
          <div role="tablist" aria-label="Formato" style={{ display: 'flex', background: CAJA_2, borderRadius: 12, padding: 3, gap: 2, marginTop: 12 }}>
            {[['stickers', 'Stickers'], ['foto', 'Con foto'], ['video', 'Video']].map(([id, txt]) => (
              <button
                key={id} type="button" role="tab" aria-selected={pestana === id} onClick={() => setPestana(id)}
                style={{ flex: 1, border: 'none', borderRadius: 10, minHeight: 38, fontFamily: FONT, fontSize: 14, fontWeight: 600, cursor: 'pointer', background: pestana === id ? '#EEF0F6' : 'transparent', color: pestana === id ? '#07090F' : TINTA_2 }}
              >
                {txt}
              </button>
            ))}
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
            <span style={{ marginLeft: 'auto', fontSize: 12.5, color: TINTA_2, textAlign: 'right', lineHeight: 1.3 }}>
              {pestana === 'video' ? <>Toca para guardar<br />el video</> : <>Toca para copiar<br />Mantén para guardar</>}
            </span>
          </div>
        </div>
        <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '10px 18px calc(24px + env(safe-area-inset-bottom))' }}>
          <div ref={galeriaRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap, alignContent: 'start' }}>
            {f && pestana === 'stickers' && items.map((item) => (
              <Mosaico
                key={item.id} etiqueta={`Sticker ${item.nombre}. Toca para copiar; mantén presionado para guardar`} ancho={anchoMosaico} proporcion={2 / 3}
                lienzoH={LIENZOS[item.forma].h} fondo={color.clara ? DAMERO.claro : DAMERO.oscuro} alTocar={() => copia(item)} alMantener={() => guarda(item)}
              >
                <Sticker item={item} f={f} color={color} />
              </Mosaico>
            ))}
            {f && pestana === 'foto' && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 4 }}>
                {['atardecer', 'pista', 'gym'].map((ej) => (
                  <button
                    key={ej} type="button" onClick={() => setFoto({ ejemplo: ej })} aria-pressed={foto.ejemplo === ej} aria-label={`Foto de ejemplo: ${ej}`}
                    style={{ position: 'relative', border: 'none', width: 46, height: 46, borderRadius: 12, padding: 0, overflow: 'hidden', flex: 'none', cursor: 'pointer', boxShadow: foto.ejemplo === ej ? `0 0 0 2px ${FONDO}, 0 0 0 4px #EEF0F6` : 'none' }}
                  >
                    <span className={`stk-foto ${ej}`} />
                  </button>
                ))}
                <button
                  type="button" onClick={() => carrete.current?.click()} aria-pressed={!!foto.url} aria-label="Elegir una foto del carrete"
                  style={{ border: 'none', width: 46, height: 46, borderRadius: 12, padding: 0, flex: 'none', cursor: 'pointer', background: CAJA_2, color: '#EEF0F6', display: 'grid', placeItems: 'center', boxShadow: foto.url ? `0 0 0 2px ${FONDO}, 0 0 0 4px #EEF0F6` : 'none' }}
                >
                  <ImagePlus size={22} />
                </button>
                <input ref={carrete} type="file" accept="image/*" onChange={eligeDelCarrete} style={{ display: 'none' }} />
                <small style={{ fontSize: 12, color: TINTA_2, marginLeft: 6, lineHeight: 1.3 }}>La foto no sale<br />de tu teléfono</small>
              </div>
            )}
            {f && pestana === 'foto' && items.filter((x) => x.identidad).map((item) => (
              <Mosaico
                key={item.id} etiqueta={`Sticker ${item.nombre} con foto. Toca para copiar; mantén presionado para guardar`} ancho={anchoMosaico} proporcion={16 / 9}
                lienzoH={LIENZOS.historia.h} fondo={{ background: '#1B2030' }} alTocar={() => copia(item)} alMantener={() => guarda(item)}
              >
                <Sticker item={item} f={f} color={color} forma="historia" foto={foto} />
              </Mosaico>
            ))}
            {f && pestana === 'video' && eco && (
              <Mosaico
                etiqueta="Video del Eco. Toca para guardarlo" ancho={anchoMosaico} proporcion={2 / 3} lienzoH={LIENZOS.alto.h}
                fondo={{ background: color.clara ? '#FFFFFF' : FONDO_VIDEO }} alTocar={() => guardaVideo('eco', eco)} alMantener={() => guardaVideo('eco', eco)}
              >
                <Sticker key={vuelta} item={eco} f={f} color={color} forma="alto" anima={!rm} />
              </Mosaico>
            )}
            {f && pestana === 'video' && f.ruta && (
              <Mosaico
                etiqueta="Video de la ruta dibujándose. Toca para guardarlo" ancho={anchoMosaico} proporcion={2 / 3} lienzoH={LIENZOS.alto.h}
                fondo={{ background: color.clara ? '#FFFFFF' : FONDO_VIDEO }} alTocar={() => guardaVideo('ruta')} alMantener={() => guardaVideo('ruta')}
              >
                <RutaVideo f={f} color={color} anima={!rm} />
              </Mosaico>
            )}
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
