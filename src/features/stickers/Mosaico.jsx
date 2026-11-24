import { useEffect, useRef, useState } from 'react';
import { Check } from 'lucide-react';
import { FONT } from '@/lib/theme';

/* EL MOSAICO DE UN STICKER: lo usan la hoja («Stickers») y el editor de Carrete (Andrés, 24 nov 2026: que en el editor «no pierdan capacidades»: deslizar
   entre variantes, «✎ Personalizar», la foto del Polaroid). Salió de `HojaDeStickers.jsx` sin cambios, más dos cosas para el editor: `alCambiarCara(cara)`
   avisa cada vez que se desliza a otra variante, y `caraInicial` arranca en esa variante. */

const CURVA = 'cubic-bezier(.32,.72,0,1)';
const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif';
const ANILLO = 138.23; // 2π · 22
const MANTENER_MS = 600;
const ESPERA_ANILLO_MS = 120;

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
export default function Mosaico({ id, etiqueta, ancho, proporcion, lienzoH, fondo, alTocar, alMantener, holgura = 1, nuevo = false, raiz = null, caras = 1, dibuja, boton = null, asoma = false, marcado = false, clara = false, alCambiarCara = null, caraInicial = 0 }) {
  const [presion, setPresion] = useState(0); // 0..1 del anillo
  const [guardado, setGuardado] = useState(false);
  const [visto, setVisto] = useState(!raiz);
  const [cara, setCara] = useState(caraInicial);
  const fuePuesta = useRef(false);
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
  const alDesplazar = () => {
    const c = carr.current;
    if (!c || !c.clientWidth) return;
    const i = Math.max(0, Math.min(caras - 1, Math.round(c.scrollLeft / c.clientWidth)));
    if (i !== cara) { setCara(i); alCambiarCara?.(i); }
  };
  // El editor abre la variante que ya tiene el sticker (una vez, en cuanto el carrusel tiene su ancho).
  useEffect(() => {
    if (fuePuesta.current || !caraInicial || caras < 2 || !ancho || !carr.current) return;
    fuePuesta.current = true;
    carr.current.scrollLeft = caraInicial * carr.current.clientWidth;
  }, [caraInicial, caras, ancho]);

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
            position: 'relative', display: 'block', width: '100%', height: alto, borderRadius: 22, overflow: 'hidden', ...fondo,
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
      {nuevo && (
        <span style={{ position: 'absolute', right: 8, top: -7, zIndex: 5, background: '#2448E8', color: '#fff', fontFamily: SF, fontSize: 11.5, fontWeight: 600, padding: '3px 8px', borderRadius: 10, letterSpacing: -0.1, pointerEvents: 'none' }}>Nuevo</span>
      )}
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
