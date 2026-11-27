import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { cuadrosDeVideo } from '@/lib/carreteNativo';

/* «RECORTAR» (27 nov 2026). Andrés mandó una grabación de Aura: al tocar un video, ANTES del editor sale esta pantalla. El video se ve grande y repitiéndose;
   arriba «Atrás» y «Listo»; abajo una tira con cuadros del video dentro de un marco blanco con una agarradera en cada orilla, para elegir qué pedazo usar, y una
   rayita blanca que va marcando por dónde va. Lo de afuera del marco se oscurece. El pedazo dura 60 s como mucho (una historia) y 1 s como poco.
   Las agarraderas llevan el azul de la marca (dirección «A · Marca»).

   `video`: `{ src, ruta, duracion, poster }` de `videoDelCarrete`. `alListo({ inicio, fin })` (segundos). `alAtras()`: regresa a la rejilla. */

const SF = '-apple-system, BlinkMacSystemFont, "SF Pro Text", Inter, system-ui, sans-serif';
const AZUL = '#2448E8';
const MAX_S = 60;
const MIN_S = 1;
const AGARRE = 16; // ancho de cada agarradera (px)
const ALTO_TIRA = 56;

export default function RecortarVideo({ video, alListo, alAtras, capa = 3400 }) {
  const dura = Math.max(MIN_S, video.duracion || 0);
  const [inicio, setInicio] = useState(0);
  const [fin, setFin] = useState(Math.min(dura, MAX_S));
  const [cuadros, setCuadros] = useState([]);
  const [abierto, setAbierto] = useState(false);
  const videoRef = useRef(null);
  const tiraRef = useRef(null);
  const rayaRef = useRef(null);
  const rango = useRef({ inicio: 0, fin: Math.min(dura, MAX_S) });
  const arrastre = useRef(null);

  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setAbierto(true)));
    return () => cancelAnimationFrame(r);
  }, []);
  // La tira: cuadros parejos de todo el video (los saca el iPhone; mientras, gris).
  useEffect(() => {
    let vivo = true;
    cuadrosDeVideo(video.ruta, { cuantos: 10, alto: 120 }).then((l) => { if (vivo) setCuadros(l); }).catch(() => { /* sin cuadros: la tira se queda gris */ });
    return () => { vivo = false; };
  }, [video.ruta]);
  // El video se repite dentro del pedazo y la rayita sigue por dónde va (directo al elemento: sin dibujar de nuevo la pantalla).
  useEffect(() => {
    let r = 0;
    const paso = () => {
      const v = videoRef.current;
      const tira = tiraRef.current;
      if (v && !arrastre.current) {
        const { inicio: a, fin: b } = rango.current;
        if (v.currentTime >= b - 0.04 || v.currentTime < a - 0.25) v.currentTime = a;
        if (rayaRef.current && tira) rayaRef.current.style.transform = `translateX(${((v.currentTime / dura) * tira.clientWidth).toFixed(1)}px)`;
      }
      r = requestAnimationFrame(paso);
    };
    r = requestAnimationFrame(paso);
    return () => cancelAnimationFrame(r);
  }, [dura]);

  const tiempoDe = (clientX) => {
    const caja = tiraRef.current.getBoundingClientRect();
    return Math.max(0, Math.min(dura, ((clientX - caja.left) / caja.width) * dura));
  };
  const empieza = (lado) => (ev) => {
    ev.preventDefault();
    arrastre.current = { lado, id: ev.pointerId };
    try { ev.currentTarget.setPointerCapture?.(ev.pointerId); } catch { /* un dedo que ya se fue: sigue sin capturar */ }
    videoRef.current?.pause();
  };
  const mueve = (ev) => {
    const d = arrastre.current;
    if (!d || ev.pointerId !== d.id) return;
    const t = tiempoDe(ev.clientX);
    const { inicio: a, fin: b } = rango.current;
    let na = a;
    let nb = b;
    if (d.lado === 'inicio') na = Math.min(Math.max(t, b - MAX_S, 0), b - MIN_S);
    else nb = Math.max(Math.min(t, a + MAX_S, dura), a + MIN_S);
    rango.current = { inicio: na, fin: nb };
    setInicio(na);
    setFin(nb);
    // Mientras se arrastra, el video enseña el cuadro de la orilla que se mueve.
    if (videoRef.current) videoRef.current.currentTime = d.lado === 'inicio' ? na : nb;
  };
  const suelta = (ev) => {
    const d = arrastre.current;
    if (!d || ev.pointerId !== d.id) return;
    arrastre.current = null;
    const v = videoRef.current;
    if (v) { v.currentTime = rango.current.inicio; v.play().catch(() => {}); }
  };

  const izq = `${(inicio / dura) * 100}%`;
  const der = `${(1 - fin / dura) * 100}%`;
  const texto = { border: 'none', background: 'none', padding: '10px 14px', fontFamily: SF, fontSize: 17, letterSpacing: -0.3, color: '#fff', cursor: 'pointer', textShadow: '0 1px 6px rgba(0,0,0,.45)' };

  return createPortal(
    <div
      role="dialog" aria-modal="true" aria-label="Recortar el video"
      style={{ position: 'fixed', inset: 0, zIndex: capa, background: '#000', color: '#fff', display: 'flex', flexDirection: 'column', opacity: abierto ? 1 : 0, transition: 'opacity .22s cubic-bezier(.23,1,.32,1)' }}
    >
      <div style={{ flex: 1, minHeight: 0, display: 'grid', placeItems: 'center', padding: 'env(safe-area-inset-top) 0 0' }}>
        <div style={{ position: 'relative', height: '100%', maxWidth: '100%', aspectRatio: '9 / 16', borderRadius: 26, overflow: 'hidden', background: '#111' }}>
          <video
            ref={videoRef} src={video.src} poster={video.poster ?? undefined} autoPlay muted loop playsInline disablePictureInPicture
            style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
          />
          <div style={{ /* estilo-ok: velo para leer «Atrás» y «Listo» sobre el video (grabación de Aura, 27 nov 2026) */ position: 'absolute', left: 0, right: 0, top: 0, display: 'flex', justifyContent: 'space-between', padding: '4px 4px 0', background: 'linear-gradient(rgba(0,0,0,.28), transparent)' }}>
            <button type="button" onClick={alAtras} style={{ ...texto, fontWeight: 500 }}>Atrás</button>
            <button type="button" onClick={() => alListo({ inicio, fin })} style={{ ...texto, fontWeight: 600 }}>Listo</button>
          </div>
        </div>
      </div>
      {/* La tira: los cuadros, lo de afuera oscuro, el marco blanco con sus agarraderas y la rayita. */}
      <div style={{ flex: 'none', padding: '14px 16px calc(18px + env(safe-area-inset-bottom))' }}>
        <div ref={tiraRef} onPointerMove={mueve} onPointerUp={suelta} onPointerCancel={suelta} style={{ position: 'relative', height: ALTO_TIRA, touchAction: 'none' }}>
          <div style={{ position: 'absolute', inset: 0, display: 'flex', borderRadius: 10, overflow: 'hidden', background: '#2A2A2E' }}>
            {cuadros.map((c) => <img key={c} src={c} alt="" draggable={false} style={{ flex: 1, minWidth: 0, height: '100%', objectFit: 'cover' }} />)}
          </div>
          <div aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: izq, background: 'rgba(0,0,0,.6)', borderRadius: '10px 0 0 10px' }} />
          <div aria-hidden="true" style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: der, background: 'rgba(0,0,0,.6)', borderRadius: '0 10px 10px 0' }} />
          <div style={{ /* estilo-ok: el marco blanco del recorte es el control (grabación de Aura, 27 nov 2026) */ position: 'absolute', top: -3, bottom: -3, left: `calc(${izq} - ${AGARRE}px)`, right: `calc(${der} - ${AGARRE}px)`, border: '3px solid #fff', borderLeftWidth: AGARRE, borderRightWidth: AGARRE, borderRadius: 12, pointerEvents: 'none', boxShadow: '0 2px 10px rgba(0,0,0,.3)' }} />
          {[['inicio', izq, 'left'], ['fin', der, 'right']].map(([lado, pos, borde]) => (
            <div
              key={lado} role="slider" aria-label={lado === 'inicio' ? 'Desde dónde' : 'Hasta dónde'} aria-valuemin={0} aria-valuemax={Math.round(dura)} aria-valuenow={Math.round(lado === 'inicio' ? inicio : fin)} tabIndex={0}
              onPointerDown={empieza(lado)}
              style={{ position: 'absolute', top: -3, bottom: -3, [borde]: `calc(${pos} - ${AGARRE + 8}px)`, width: AGARRE + 16, display: 'grid', placeItems: 'center', cursor: 'ew-resize', touchAction: 'none' }}
            >
              <i style={{ display: 'block', width: 3, height: 20, borderRadius: 2, background: AZUL }} />
            </div>
          ))}
          <div ref={rayaRef} aria-hidden="true" style={{ position: 'absolute', top: -2, bottom: -2, left: -1.5, width: 3, borderRadius: 2, background: '#fff', boxShadow: '0 0 4px rgba(0,0,0,.5)', pointerEvents: 'none' }} />
        </div>
      </div>
    </div>,
    document.body,
  );
}
