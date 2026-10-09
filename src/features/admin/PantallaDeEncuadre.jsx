import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Loader2, RotateCcw, RectangleHorizontal } from 'lucide-react';
import { FONT } from '@/lib/theme';
import { useRecorte, CapaRecorte, BotonesFormato } from '@/features/admin/recorte';

/**
 * La pantalla de ENCUADRE: una pantalla completa y oscura solo para recortar, como la de WhatsApp.
 *
 * Andrés, 9 oct 2026, comparando con WhatsApp: «el de WhatsApp es mucho más práctico y claro… quiero que hagas algo muy
 * similar a eso, si no es que casi casi igualito, pero con nuestras herramientas». Antes el recorte era un paso más dentro
 * del editor, con el video chiquito y las proporciones apiñadas debajo. Ahora es su propia pantalla:
 *
 *   · el marco con sus esquinas en «L» arriba, lo más grande que quepa;
 *   · abajo a la izquierda «restablecer» (todo el cuadro) y a la derecha el icono de proporciones, que abre la fila de
 *     formas (Original, Cuadrado, Vertical, Pantalla, Apaisado);
 *   · y al fondo, ✕ para salir sin cambios y ✓ para quedarse con lo que se ve.
 *
 * LA MISMA PANTALLA SIRVE A LA FOTO Y AL VIDEO. `medio` es `{ tipo: 'foto' | 'video', src }`. Con un video se enseña un
 * fotograma quieto (el de `posicion`, en segundos): encuadrar no necesita moverse. El recorte se guarda como siempre,
 * en fracciones de 0 a 1 del original (ver `recorte.jsx`), así que este componente no sabe qué se hará con él.
 *
 * `onListo(recorte)` recibe `null` cuando el marco cubre todo el original: eso no es un recorte.
 * `ocupado` y `avance` son para la foto, donde ✓ también sube el archivo y no se cierra hasta que termina.
 */

const FONDO = 'radial-gradient(ellipse at 50% 42%, #2c2c2e 0%, #161617 62%, #0d0d0e 100%)';
const GRIS = 'rgba(58,58,60,.85)';

// Cuánto cabe un recuadro con esa proporción dentro de una caja, sin pasarse por ningún lado.
function cabeEn(caja, aspecto) {
  if (!caja || !aspecto) return null;
  const { w, h } = caja;
  const ancho = Math.min(w, h * aspecto);
  return { w: Math.floor(ancho), h: Math.floor(ancho / aspecto) };
}

export default function PantallaDeEncuadre({
  medio, medidas, inicial = null, posicion = 0, onCancelar, onListo, ocupado = false, avance = null, zIndex = 7000, mensaje = '',
}) {
  const marcoRef = useRef(null);
  const cajaRef = useRef(null);
  const videoRef = useRef(null);
  const [caja, setCaja] = useState(null);
  const [formas, setFormas] = useState(false);
  const { crop, setCrop, agarrado, setAgarrado, rectanguloDe, recorteReal } = useRecorte({
    marcoRef, medidas, inicial: inicial ?? { x: 0, y: 0, w: 1, h: 1 },
  });

  // El espacio libre para el cuadro: se mide, no se adivina, para que el marco tenga EXACTAMENTE la proporción del original.
  useEffect(() => {
    const el = cajaRef.current;
    if (!el) return undefined;
    const mide = () => { const r = el.getBoundingClientRect(); setCaja({ w: r.width, h: r.height }); };
    mide();
    const o = new ResizeObserver(mide);
    o.observe(el);
    return () => o.disconnect();
  }, []);

  const tamano = medidas ? cabeEn(caja, medidas.w / medidas.h) : null;
  const completo = !recorteReal;

  const boton = (activo = false) => ({
    width: 46, height: 46, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
    background: activo ? 'rgba(255,255,255,.22)' : 'transparent', color: '#fff',
    display: 'grid', placeItems: 'center', touchAction: 'manipulation',
  });

  return createPortal((
    <div style={{
      position: 'fixed', inset: 0, zIndex, background: FONDO, color: '#fff', fontFamily: FONT,
      display: 'flex', flexDirection: 'column', userSelect: 'none', WebkitUserSelect: 'none',
    }}>
      {/* ---------- El cuadro ---------- */}
      <div
        ref={cajaRef}
        style={{
          flex: 1, minHeight: 0, display: 'grid', placeItems: 'center',
          /* Aire alrededor para poder agarrar las esquinas: las manijas sobresalen del marco y pegadas al borde no hay
             dónde poner el dedo. */
          margin: 'calc(34px + env(safe-area-inset-top)) 34px 18px',
        }}
      >
        {!(tamano && medio?.src) && (
          <div style={{ color: 'rgba(255,255,255,.7)', fontSize: 13.5, fontWeight: 600, textAlign: 'center', padding: 20 }}>
            {mensaje}
          </div>
        )}
        {tamano && medio?.src && (
          <div
            ref={marcoRef}
            style={{ position: 'relative', width: tamano.w, height: tamano.h, background: '#000', overflow: 'hidden', touchAction: 'none' }}
          >
            {medio.tipo === 'video' ? (
              <video
                ref={videoRef} src={medio.src} muted playsInline preload="auto"
                /* En iPhone un video con `preload` no pinta ningún fotograma hasta que se le pide un tiempo. */
                onLoadedMetadata={(e) => { e.currentTarget.currentTime = (posicion || 0) + 0.05; }}
                style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', pointerEvents: 'none' }}
              />
            ) : (
              <img src={medio.src} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block', pointerEvents: 'none' }} />
            )}
            <CapaRecorte crop={crop} onAgarrar={setAgarrado} agarrado={agarrado} />
          </div>
        )}
      </div>

      {/* ---------- Las proporciones, si se abrieron ---------- */}
      {formas && (
        <div style={{ display: 'flex', justifyContent: 'center', padding: '0 16px 10px' }}>
          <div style={{ padding: '4px 10px', borderRadius: 14, background: GRIS, backdropFilter: 'blur(8px)' }}>
            <BotonesFormato crop={crop} medidas={medidas} rectanguloDe={rectanguloDe} onElegir={setCrop} />
          </div>
        </div>
      )}

      {/* ---------- Restablecer y proporciones ---------- */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 22px 6px' }}>
        <button
          type="button" onClick={() => setCrop({ x: 0, y: 0, w: 1, h: 1 })} disabled={completo} aria-label="Restablecer el encuadre"
          style={{ ...boton(), opacity: completo ? 0.35 : 1, cursor: completo ? 'default' : 'pointer' }}
        >
          <RotateCcw size={25} />
        </button>
        <button
          type="button" onClick={() => setFormas((a) => !a)} aria-pressed={formas} aria-label="Proporciones"
          style={boton(formas)}
        >
          <RectangleHorizontal size={27} strokeWidth={2} />
        </button>
      </div>

      {/* ---------- Salir y quedarse con esto ---------- */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '8px 20px calc(16px + env(safe-area-inset-bottom))',
      }}>
        <button
          type="button" onClick={onCancelar} disabled={ocupado} aria-label="Cancelar"
          style={{
            width: 52, height: 52, borderRadius: '50%', cursor: 'pointer', color: '#fff',
            border: '1.5px solid rgba(255,255,255,.28)', background: 'rgba(20,20,20,.7)',
            display: 'grid', placeItems: 'center', opacity: ocupado ? 0.4 : 1,
          }}
        >
          <X size={26} strokeWidth={2.2} />
        </button>
        <button
          type="button" disabled={ocupado || !tamano} aria-label="Usar este encuadre"
          onClick={() => onListo(recorteReal)}
          style={{
            width: 54, height: 54, borderRadius: '50%', border: 'none', color: '#fff',
            background: ocupado || !tamano ? 'rgba(255,255,255,.2)' : '#1E40E0',
            cursor: ocupado || !tamano ? 'default' : 'pointer',
            display: 'grid', placeItems: 'center', fontFamily: FONT, fontWeight: 800, fontSize: 14,
          }}
        >
          {ocupado
            ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><Loader2 size={18} className="spin" />{avance != null ? `${avance}%` : ''}</span>
            : <Check size={29} strokeWidth={3} />}
        </button>
      </div>
    </div>
  ), document.body);
}
