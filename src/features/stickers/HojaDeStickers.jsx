import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Capacitor } from '@capacitor/core';
import { Check, ImagePlus, Pencil } from 'lucide-react';
import { FONT } from '@/lib/theme';
import { ficha as fichaDe } from '@/lib/stickers/ficha';
import { catalogo, catalogoDeTotales, COLORES, esNuevo, FRASE_INICIAL, FRASE_MAX, LIENZOS, lienzoDe } from '@/lib/stickers/catalogo';
import { totalesDe } from '@/lib/stickers/totales';
import { entregaArchivo } from '@/lib/entregaArchivo';
import { vibra } from '@/lib/avisosNativos';
import CambiarNombre from './CambiarNombre';
import HojaDeFrases from './HojaDeFrases';
import Sticker from './Sticker';
import RutaVideo from './RutaVideo';
import { nombreDeArchivo, pngDeSticker, preparaFoto, puedeGrabarVideo, videoDeSticker } from './exporta';

/* LA HOJA DE STICKERS (Andrés, 28 oct 2026; ver docs/stickers.md y el prototipo). Sustituye a la hoja y al editor del sello.

   Se abre desde el aviso de la página del entreno, el ⇪ de cada fila de «Tus entrenos», «Compartir» de la página del entreno, Mis métricas y, en el plan, el final
   del entreno y el día. NUNCA se abre sola al terminar.

   Arriba: «Comparte tu carrera / tu workout / tu entreno», el nombre con lápiz (si se puede renombrar) y «Cerrar»; los cuatro colores y «Toca para copiar · Mantén
   para guardar». Abajo, la galería: dos columnas de mosaicos cuadrados, una sola lista en el orden del catálogo (los 19 nuevos primero, con su pastilla «Nuevo»), sin nombres. Cada sticker se ve achicado en su mosaico,
   pero se copia y se guarda a su tamaño real (`exporta.js`).

   Tocar = copiar (aviso «Copiado. Pégalo en tu historia.» con «Abrir Instagram» y «Guardar», 3.5 s). Mantener 0.6 s = guardar, con un anillo que se llena; si se
   suelta antes, regresa. Mover el dedo más de 10 px = desplazar la lista. Se cierra con «Cerrar» o arrastrando la cabecera hacia abajo (120 px, o rápido).
   Pestañas (fase 2): «Stickers» (todos, sobre damero), «Con foto» (solo los de identidad sobre una foto 9:16: tres de ejemplo o una del carrete, que nunca sale
   del teléfono; se copia y se guarda la imagen entera, 900 × 1599) y «Video» (el Eco que cae y, si hubo ruta, la ruta que se dibuja: tocar o mantener guarda
   un video de 3 s). Con «reducir movimiento» la hoja no se desliza y los videos se ven quietos en la hoja.

   5 NOV 2026 (parte 2): en «Stickers», dos pestañas de texto: «Actividad» (la lista de siempre) y «Totales» (la semana y el mes de hoy, `totales.js`). Los mosaicos
   con variantes son carruseles (ver `Mosaico`); el primero se asoma una vez al día. «✎ Personalizar» abre las frases (`HojaDeFrases`): la elegida va a todos los
   personalizables, se recuerda en el teléfono y, al cerrar, la galería regresa al sticker y lo marca 1.6 s. El Polaroid lleva tu foto: la misma del carrete que
   usa «Con foto», en memoria (`blob:`), que se suelta al cerrar la hoja.

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

// Lo que se recuerda en el teléfono: la frase elegida y el día en que el primer carrusel ya se asomó.
const LLAVE_FRASE = 'tl.stickers.frase';
const LLAVE_ASOMO = 'tl.stickers.asomo';
const lee = (k) => { try { return localStorage.getItem(k); } catch { return null; } };
const guardaLocal = (k, v) => { try { localStorage.setItem(k, v); } catch { /* sin espacio o en privado: no pasa nada */ } };
const hoyLocal = () => { const d = new Date(); return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`; };

const reduceMovimiento = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const puedeCopiar = () => !!(navigator.clipboard?.write && typeof window.ClipboardItem === 'function');

/**
 * Un mosaico: lo que se va a sacar (`dibuja(cara)`, a su tamaño real: 300 × `lienzoH`) achicado para caber centrado, el anillo de «mantener» y la palomita de guardado.
 * `proporcion`: alto ÷ ancho del mosaico (cuadrado en «Stickers», como la maqueta del 5 nov; 2/3 en Video; 16/9 en «Con foto»). `fondo`: el damero (transparente) o el color liso del video.
 * `holgura`: qué parte del mosaico ocupa el sticker (las tarjetas, con su brillo, dejan aire). `nuevo`: la pastilla «Nuevo» arriba a la derecha.
 * `raiz`: con ella el mosaico se dibuja CONFORME SE DESPLAZA (solo cuando está a menos de 250 px de la vista; ya dibujado, se queda): con los 54 stickers, dibujarlos todos
 * al abrir la hoja tardaba más de un segundo en WebKit. El hueco mide lo mismo antes y después, así que la lista no salta.
 *
 * VARIANTES (5 nov 2026): con `caras` > 1 el mosaico es un carrusel horizontal (`scroll-snap`) con puntitos abajo. Deslizar de lado o tocar un puntito cambia de
 * cara; mover el dedo más de 10 px no copia. Tocar copia LA CARA QUE SE VE (`alTocar(cara)`); mantener la guarda. `asoma`: se asoma una vez (35 % y regresa) para
 * enseñar que se desliza. `boton`: «✎ Personalizar» o «＋ Poner foto», arriba a la izquierda. `marcado`: el borde blanco al regresar de las frases. `clara`: puntitos negros.
 */
function Mosaico({ id, etiqueta, ancho, proporcion, lienzoH, fondo, alTocar, alMantener, holgura = 1, nuevo = false, raiz = null, caras = 1, dibuja, boton = null, asoma = false, marcado = false, clara = false }) {
  const [presion, setPresion] = useState(0); // 0..1 del anillo
  const [guardado, setGuardado] = useState(false);
  const [visto, setVisto] = useState(!raiz);
  const [cara, setCara] = useState(0);
  const caja = useRef(null);
  const carr = useRef(null);
  const pista = useRef(null);
  const t = useRef(null);
  useEffect(() => {
    if (visto) return undefined;
    const el = caja.current;
    if (!el || typeof IntersectionObserver !== 'function') { setVisto(true); return undefined; }
    const io = new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { setVisto(true); io.disconnect(); } }, { root: raiz.current ?? null, rootMargin: '250px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [visto, raiz]);
  // Se asoma una vez: 35 % hacia la siguiente cara y de regreso (con una animación, para que el `scroll-snap` no la corte).
  useEffect(() => {
    if (!asoma || !visto || caras < 2 || !ancho) return undefined;
    const r = setTimeout(() => {
      pista.current?.animate?.([{ transform: 'translateX(0)' }, { transform: `translateX(${(-0.35 * ancho).toFixed(1)}px)`, offset: 0.5 }, { transform: 'translateX(0)' }], { duration: 1000, easing: 'ease-in-out' });
    }, 900);
    return () => clearTimeout(r);
  }, [asoma, visto, caras, ancho]);
  const alto = Math.round(ancho * proporcion);
  const k = ancho > 0 ? Math.min(ancho / 300, alto / lienzoH) * holgura : 0;

  const vaA = (i, suave = true) => { const c = carr.current; if (c) c.scrollTo({ left: i * c.clientWidth, behavior: suave ? 'smooth' : 'auto' }); };
  const alDesplazar = () => { const c = carr.current; if (c && c.clientWidth) setCara(Math.max(0, Math.min(caras - 1, Math.round(c.scrollLeft / c.clientWidth)))); };

  const suelta = () => { setPresion(0); };
  const empieza = (ev) => {
    if (ev.button > 0) return;
    const t0 = performance.now();
    // Con el mouse, el carrusel se arrastra a mano (con el dedo ya se desliza solo).
    const arrastra = ev.pointerType === 'mouse' && caras > 1 && carr.current ? { s0: carr.current.scrollLeft } : null;
    const x = { x0: ev.clientX, y0: ev.clientY, t0, movido: false, hecho: false, raf: 0, id: ev.pointerId, arrastra };
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
        alMantener(cara);
        return;
      }
      x.raf = requestAnimationFrame(paso);
    };
    x.raf = requestAnimationFrame(paso);
  };
  const mueve = (ev) => {
    const x = t.current;
    if (!x || ev.pointerId !== x.id) return;
    const dx = ev.clientX - x.x0;
    if (!x.movido && Math.hypot(dx, ev.clientY - x.y0) > 10) {
      x.movido = true;
      cancelAnimationFrame(x.raf);
      suelta();
      if (x.arrastra) { carr.current.style.scrollSnapType = 'none'; ev.currentTarget.setPointerCapture?.(ev.pointerId); }
    }
    if (x.movido && x.arrastra) carr.current.scrollLeft = x.arrastra.s0 - dx;
  };
  const acabaArrastre = (x) => {
    if (!x.arrastra || !carr.current) return;
    const c = carr.current;
    const i = Math.max(0, Math.min(caras - 1, Math.round(c.scrollLeft / c.clientWidth)));
    c.style.scrollSnapType = '';
    vaA(i);
  };
  const termina = (ev) => {
    const x = t.current;
    if (!x || ev.pointerId !== x.id) return;
    t.current = null;
    cancelAnimationFrame(x.raf);
    acabaArrastre(x);
    if (x.hecho || x.movido) return;
    suelta();
    alTocar(cara);
  };
  const cancela = (ev) => { const x = t.current; if (x && ev.pointerId === x.id) { cancelAnimationFrame(x.raf); t.current = null; acabaArrastre(x); suelta(); } };

  // Cada cara: el sticker achicado y centrado en el mosaico.
  const unaCara = (i) => (k > 0 && visto ? (
    <span style={{ position: 'absolute', left: (ancho - 300 * k) / 2, top: (alto - lienzoH * k) / 2, transform: `scale(${k.toFixed(4)})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
      {dibuja(i)}
    </span>
  ) : null);

  return (
    <div ref={caja} data-mosaico={id} style={{ position: 'relative' }}>
      <div
        role="button" tabIndex={0} aria-label={caras > 1 ? `${etiqueta} Variante ${cara + 1} de ${caras}.` : etiqueta}
        onPointerDown={empieza} onPointerMove={mueve} onPointerUp={termina} onPointerCancel={cancela}
        onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); alTocar(cara); } }}
        onContextMenu={(ev) => ev.preventDefault()}
        style={{ position: 'relative', cursor: 'pointer', touchAction: caras > 1 ? 'pan-x pan-y' : 'pan-y', WebkitTouchCallout: 'none', WebkitUserSelect: 'none', userSelect: 'none', display: 'block', width: '100%', outline: 'none' }}
      >
        <span
          style={{
            position: 'relative', display: 'block', width: '100%', height: alto, borderRadius: 16, overflow: 'hidden', ...fondo,
            transform: presion > 0 ? 'scale(.96)' : 'none', transition: `transform .2s ${CURVA}, box-shadow .3s`, boxShadow: marcado ? '0 0 0 3px #fff' : '0 0 0 0 rgba(255,255,255,0)',
          }}
        >
          {/* El carrusel nace ya con su ancho: si naciera en 0, WebKit se quedaba en la última cara al medirse. */}
          {caras > 1 ? ancho > 0 && (
            <span ref={carr} onScroll={alDesplazar} className="stk-carrusel" style={{ position: 'absolute', inset: 0, display: 'flex', overflowX: 'auto', overflowY: 'hidden', scrollSnapType: 'x mandatory', overscrollBehaviorX: 'contain', scrollbarWidth: 'none' }}>
              <span ref={pista} style={{ display: 'flex', flex: 'none' }}>
                {Array.from({ length: caras }, (_, i) => (
                  <span key={i} style={{ position: 'relative', display: 'block', flex: 'none', width: ancho, height: alto, scrollSnapAlign: 'center', scrollSnapStop: 'always' }}>{unaCara(i)}</span>
                ))}
              </span>
            </span>
          ) : unaCara(0)}
          {nuevo && (
            <span style={{ position: 'absolute', right: 7, top: 7, zIndex: 2, background: '#2F6BFF', color: '#fff', fontSize: 10.5, fontWeight: 800, padding: '2px 7px', borderRadius: 999, pointerEvents: 'none', lineHeight: 1.3 }}>Nuevo</span>
          )}
          <span
            aria-hidden="true"
            style={{
              position: 'absolute', left: '50%', top: '50%', width: 64, height: 64, margin: '-32px 0 0 -32px', borderRadius: '50%', display: 'grid', placeItems: 'center', zIndex: 3, pointerEvents: 'none',
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
      </div>
      {boton && (
        <button
          type="button" onClick={boton.fn} aria-label={boton.etiqueta ?? boton.texto}
          style={{
            position: 'absolute', left: 7, top: 7, zIndex: 4, display: 'flex', alignItems: 'center', gap: 4, border: 'none', borderRadius: 999, padding: '6px 9px', minHeight: 28, cursor: 'pointer',
            fontFamily: FONT, fontSize: 11, fontWeight: 700, lineHeight: 1, WebkitBackdropFilter: 'blur(6px)', backdropFilter: 'blur(6px)',
            // Sobre el marco claro del Polaroid, el botón va oscuro para que se lea.
            background: boton.oscuro ? 'rgba(14,18,32,.72)' : clara ? 'rgba(0,0,0,.12)' : 'rgba(255,255,255,.14)', color: clara && !boton.oscuro ? '#0B0D12' : '#fff',
          }}
        >
          {boton.texto}
        </button>
      )}
      {caras > 1 && (
        <div style={{ position: 'absolute', left: 0, right: 0, bottom: 2, zIndex: 4, display: 'flex', justifyContent: 'center' }}>
          {Array.from({ length: caras }, (_, i) => (
            <button
              key={i} type="button" onClick={() => vaA(i)} aria-label={`Variante ${i + 1}`} aria-pressed={cara === i}
              style={{ width: 18, height: 20, border: 'none', background: 'none', padding: 0, display: 'grid', placeItems: 'center', cursor: 'pointer' }}
            >
              <i style={{ display: 'block', width: 6, height: 6, borderRadius: '50%', background: cara === i ? (clara ? '#0B0D12' : '#fff') : (clara ? 'rgba(0,0,0,.25)' : 'rgba(255,255,255,.35)') }} />
            </button>
          ))}
        </div>
      )}
    </div>
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
  const [fondoFoto, setFondoFoto] = useState('atardecer'); // «Con foto»: una de ejemplo, o 'propia' (la del carrete)
  const [propia, setPropia] = useState(null); // la foto del carrete (enlace `blob:`): «Con foto» y el Polaroid
  const [sub, setSub] = useState('actividad'); // en «Stickers»: 'actividad' | 'totales'
  const [frase, setFrase] = useState(() => { const g = lee(LLAVE_FRASE); return g && g.length <= FRASE_MAX ? g : FRASE_INICIAL; });
  const [frasesDe, setFrasesDe] = useState(null); // el sticker desde el que se abrió «Elige una frase»
  const [marcado, setMarcado] = useState(null);
  const [asoma] = useState(() => lee(LLAVE_ASOMO) !== hoyLocal());
  const [vuelta, setVuelta] = useState(0); // para repetir la animación de la pestaña Video
  const ocupado = useRef(false);
  const carrete = useRef(null);
  const [galeriaRef, anchoGaleria] = useAncho();
  const listaRef = useRef(null); // lo que se desplaza: la raíz de «dibujar conforme se desplaza»
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
  // Totales: la semana y el mes de hoy, del historial que ya trae el entreno (no cambia con el entreno ni con el nombre).
  const totales = useMemo(() => (base ? totalesDe(base) : null), [base]);
  const itemsTot = useMemo(() => catalogoDeTotales(totales), [totales]);
  const foto = fondoFoto === 'propia' && propia ? { url: propia } : { ejemplo: fondoFoto === 'propia' ? 'atardecer' : fondoFoto };
  const primeroConCaras = items.find((x) => x.caras > 1)?.id ?? null;
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
  useEffect(() => () => { if (propia) URL.revokeObjectURL(propia); }, [propia]);
  // El primer carrusel se asoma una vez al día: se anota al abrir la hoja.
  useEffect(() => { if (asoma) guardaLocal(LLAVE_ASOMO, hoyLocal()); }, [asoma]);
  useEffect(() => { if (!marcado) return undefined; const r = setTimeout(() => setMarcado(null), 1600); return () => clearTimeout(r); }, [marcado]);
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

  // En «Con foto» se saca la imagen entera (la historia, con la foto debajo); en «Stickers», el sticker solo, en la cara que se ve, con la frase y la foto del Polaroid.
  const comoSale = (item, cara = 0) => (pestana === 'foto'
    ? { item, f, color, forma: 'historia', foto }
    : { item, f: item.total ? totales : f, color, cara, frase, propia: item.conFoto ? propia : null });
  const guarda = async (item, cara = 0) => {
    vibra('listo');
    try {
      await entregaArchivo(await pngDeSticker(comoSale(item, cara)), nombreDeArchivo(item));
      if (!enApp) avisa({ texto: 'Imagen guardada.' });
    } catch {
      avisa({ texto: 'No se pudo guardar. Inténtalo otra vez.', error: true });
    }
  };
  const copia = (item, cara = 0) => {
    vibra('toque');
    const falla = () => avisa({ texto: 'No se pudo copiar. Mantén presionado el sticker para guardarlo.', error: true, acciones: [{ t: 'Guardar', fn: () => guarda(item, cara) }] });
    if (!puedeCopiar()) { falla(); return; }
    try {
      // La promesa va adentro del ClipboardItem: Safari solo deja copiar si `write` se llama en el mismo toque.
      navigator.clipboard.write([new window.ClipboardItem({ 'image/png': pngDeSticker(comoSale(item, cara)) })])
        .then(() => avisa({
          texto: 'Copiado. Pégalo en tu historia.',
          acciones: [...(enApp ? [{ t: 'Abrir Instagram', fn: () => { window.location.href = 'instagram://story-camera'; } }] : []), { t: 'Guardar', fn: () => guarda(item, cara) }],
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
    avisa({ texto: 'Preparando tu foto…', dura: 30000 }); // se queda hasta que esté (lo cambia el siguiente aviso)
    try {
      // HEIC del iPhone incluida: la lee el teléfono y la achica (`preparaFoto`). Nada se sube.
      setPropia(URL.createObjectURL(await preparaFoto(archivo)));
      setFondoFoto('propia');
      clearTimeout(reloj.current);
      setAviso(null);
    } catch {
      avisa({ texto: 'No se pudo abrir esa foto. Prueba con otra.', error: true });
    }
  };
  const abreCarrete = () => carrete.current?.click();

  // Al cerrar «Elige una frase», la galería regresa al sticker desde el que se abrió y lo marca.
  const eligeFrase = (nueva) => { setFrase(nueva); guardaLocal(LLAVE_FRASE, nueva); };
  const cierraFrases = () => {
    const id = frasesDe;
    setFrasesDe(null);
    const lista = listaRef.current;
    const el = id && lista?.querySelector(`[data-mosaico="${id}"]`);
    if (!el) return;
    const top = el.getBoundingClientRect().top - lista.getBoundingClientRect().top + lista.scrollTop - 90;
    lista.scrollTo({ top: Math.max(0, top), behavior: rm ? 'auto' : 'smooth' });
    setMarcado(id);
  };

  /** Un mosaico de «Stickers» (Actividad o Totales): con sus caras, su botón (frase o foto) y lo que hace al tocarlo. */
  const mosaicoDe = (item) => {
    const clara = color.clara && !item.fija;
    const sinFoto = item.conFoto && !propia;
    const boton = item.perso ? { texto: '✎ Personalizar', etiqueta: 'Personalizar la frase', fn: () => setFrasesDe(item.id) }
      : item.conFoto ? { texto: propia ? 'Cambiar foto' : '＋ Poner foto', fn: abreCarrete, oscuro: true } : null;
    return (
      <Mosaico
        key={item.id} id={item.id} ancho={anchoMosaico} proporcion={1} lienzoH={lienzoDe(item).h} holgura={item.familia === 'tarjeta' ? 0.94 : 1}
        etiqueta={sinFoto ? `Sticker ${item.nombre}. Toca para poner una foto` : `Sticker ${item.nombre}. Toca para copiar; mantén presionado para guardar.`}
        nuevo={esNuevo(item)} raiz={listaRef} fondo={clara ? DAMERO.claro : DAMERO.oscuro} clara={clara} caras={item.caras ?? 1} boton={boton}
        asoma={asoma && !rm && sub === 'actividad' && item.id === primeroConCaras} marcado={marcado === item.id}
        alTocar={(cara) => (sinFoto ? abreCarrete() : copia(item, cara))} alMantener={(cara) => (sinFoto ? abreCarrete() : guarda(item, cara))}
        dibuja={(cara) => <Sticker item={item} f={item.total ? totales : f} color={color} cara={cara} frase={frase} propia={item.conFoto ? propia : null} />}
      />
    );
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
          {pestana === 'stickers' && (
            <div role="tablist" aria-label="Qué stickers" style={{ display: 'flex', marginTop: 4, boxShadow: 'inset 0 -1px 0 #262C40' }}>
              {[['actividad', 'Actividad'], ['totales', 'Totales']].map(([id, txt]) => (
                <button
                  key={id} type="button" role="tab" aria-selected={sub === id} onClick={() => setSub(id)}
                  style={{ flex: 1, border: 'none', background: 'none', padding: '12px 0 11px', minHeight: 40, fontFamily: FONT, fontSize: 14.5, fontWeight: 700, cursor: 'pointer', color: sub === id ? '#fff' : TINTA_2, boxShadow: sub === id ? 'inset 0 -2.5px 0 #fff' : 'none' }}
                >
                  {txt}
                </button>
              ))}
            </div>
          )}
        </div>
        <div ref={listaRef} style={{ flex: 1, minHeight: 0, overflowY: 'auto', overscrollBehavior: 'contain', padding: '10px 18px calc(24px + env(safe-area-inset-bottom))' }}>
          <div ref={galeriaRef} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap, alignContent: 'start' }}>
            {f && pestana === 'stickers' && sub === 'actividad' && items.map(mosaicoDe)}
            {f && pestana === 'stickers' && sub === 'totales' && itemsTot.map(mosaicoDe)}
            {f && pestana === 'stickers' && sub === 'totales' && itemsTot.length === 0 && (
              <p style={{ gridColumn: '1 / -1', margin: '18px 4px', fontSize: 15, lineHeight: 1.45, color: TINTA_2 }}>Entrena esta semana y aquí aparecen tus totales.</p>
            )}
            {f && pestana === 'foto' && (
              <div style={{ gridColumn: '1 / -1', display: 'flex', gap: 8, alignItems: 'center', paddingBottom: 4 }}>
                {['atardecer', 'pista', 'gym'].map((ej) => (
                  <button
                    key={ej} type="button" onClick={() => setFondoFoto(ej)} aria-pressed={foto.ejemplo === ej} aria-label={`Foto de ejemplo: ${ej}`}
                    style={{ position: 'relative', border: 'none', width: 46, height: 46, borderRadius: 12, padding: 0, overflow: 'hidden', flex: 'none', cursor: 'pointer', boxShadow: foto.ejemplo === ej ? `0 0 0 2px ${FONDO}, 0 0 0 4px #EEF0F6` : 'none' }}
                  >
                    <span className={`stk-foto ${ej}`} />
                  </button>
                ))}
                <button
                  type="button" onClick={() => (propia && fondoFoto !== 'propia' ? setFondoFoto('propia') : abreCarrete())} aria-pressed={!!foto.url} aria-label={propia && fondoFoto !== 'propia' ? 'Usar tu foto' : 'Elegir una foto del carrete'}
                  style={{ border: 'none', width: 46, height: 46, borderRadius: 12, padding: 0, flex: 'none', cursor: 'pointer', background: CAJA_2, color: '#EEF0F6', display: 'grid', placeItems: 'center', boxShadow: foto.url ? `0 0 0 2px ${FONDO}, 0 0 0 4px #EEF0F6` : 'none' }}
                >
                  <ImagePlus size={22} />
                </button>
                <small style={{ fontSize: 12, color: TINTA_2, marginLeft: 6, lineHeight: 1.3 }}>La foto no sale<br />de tu teléfono</small>
              </div>
            )}
            {f && pestana === 'foto' && items.filter((x) => x.identidad).map((item) => (
              <Mosaico
                key={item.id} etiqueta={`Sticker ${item.nombre} con foto. Toca para copiar; mantén presionado para guardar`} ancho={anchoMosaico} proporcion={16 / 9}
                lienzoH={LIENZOS.historia.h} fondo={{ background: '#1B2030' }} alTocar={() => copia(item)} alMantener={() => guarda(item)}
                dibuja={() => <Sticker item={item} f={f} color={color} forma="historia" foto={foto} />}
              />
            ))}
            {f && pestana === 'video' && eco && (
              <Mosaico
                etiqueta="Video del Eco. Toca para guardarlo" ancho={anchoMosaico} proporcion={2 / 3} lienzoH={LIENZOS.alto.h}
                fondo={{ background: color.clara ? '#FFFFFF' : FONDO_VIDEO }} alTocar={() => guardaVideo('eco', eco)} alMantener={() => guardaVideo('eco', eco)}
                dibuja={() => <Sticker key={vuelta} item={eco} f={f} color={color} forma="alto" anima={!rm} />}
              />
            )}
            {f && pestana === 'video' && f.ruta && (
              <Mosaico
                etiqueta="Video de la ruta dibujándose. Toca para guardarlo" ancho={anchoMosaico} proporcion={2 / 3} lienzoH={LIENZOS.alto.h}
                fondo={{ background: color.clara ? '#FFFFFF' : FONDO_VIDEO }} alTocar={() => guardaVideo('ruta')} alMantener={() => guardaVideo('ruta')}
                dibuja={() => <RutaVideo f={f} color={color} anima={!rm} />}
              />
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
        <div aria-live="polite" style={{ position: 'absolute', zIndex: 9, left: 10, right: 10, bottom: 'calc(10px + env(safe-area-inset-bottom))', display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
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
        <input ref={carrete} type="file" accept="image/*" onChange={eligeDelCarrete} style={{ display: 'none' }} />
        {frasesDe && <HojaDeFrases frase={frase} alElegir={eligeFrase} alCerrar={cierraFrases} rm={rm} />}
      </section>
      {renombrando && <CambiarNombre nombre={nombreVisto} capa={capa + 10} alGuardar={guardaNombre} alCancelar={() => setRenombrando(false)} />}
    </div>,
    document.body,
  );
}
