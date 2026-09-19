import { useCallback, useEffect, useRef } from 'react';
import { Play } from 'lucide-react';
import { FONT } from '@/lib/theme';
import Portada from '@/components/Portada';

/**
 * Los videos de un ejercicio, uno al lado de otro, deslizando.
 *
 * POR QUÉ DESLIZANDO Y NO CON PASTILLAS.
 * Antes los ángulos eran una fila de pastillas DEBAJO del video. Andrés, 18 sep
 * 2026: "no veo cómo es que un coach agrega varias versiones de videos para un
 * mismo ejercicio... creo que la configuración ahorita solamente permite ver
 * uno". Las pastillas estaban ahí, pero abajo, chiquitas, y no se leían como
 * "hay más". Deslizar sí: es el gesto que ya conoce cualquiera que use un
 * teléfono, y los puntos de abajo dicen cuántos hay sin explicar nada.
 *
 * QUÉ SE DESLIZA Y QUÉ NO. Se deslizan las PORTADAS, no los videos
 * reproduciéndose. Al darle al play, el que está elegido ocupa el lugar entero
 * y los puntos siguen abajo para cambiar sin dejar de ver. Reproducir dentro de
 * un carrusel horizontal es pelear con el gesto: deslizar para cambiar de video
 * y deslizar para adelantarlo son el mismo movimiento.
 *
 * CON UN SOLO VIDEO no hay carrusel ni puntos: es exactamente lo de siempre.
 */
export default function CarruselDeVideos({
  videos, portada, nombre, activo, onActivo, onReproducir, vacio, puntosArriba = null,
}) {
  const pista = useRef(null);
  // Mientras la app misma mueve la pista (al tocar un punto), el evento de
  // scroll no debe reinterpretar la posición: daría tumbos entre dos índices.
  const moviendoSolo = useRef(false);

  const video = videos[activo] ?? videos[0] ?? null;
  const varios = videos.length > 1;

  const vasA = useCallback((i) => {
    const caja = pista.current;
    if (!caja) { onActivo(i); return; }
    moviendoSolo.current = true;
    caja.scrollTo({ left: caja.clientWidth * i, behavior: 'smooth' });
    onActivo(i);
    window.setTimeout(() => { moviendoSolo.current = false; }, 420);
  }, [onActivo]);

  /* Al cambiar de ejercicio la pista se queda donde estaba: el componente se
     reusa y el navegador conserva el scroll. Sin esto, el segundo ejercicio
     abría en el ángulo 2 con el punto 1 encendido. */
  useEffect(() => {
    const caja = pista.current;
    if (caja && activo === 0) caja.scrollLeft = 0;
  }, [nombre, activo]);

  const alDeslizar = () => {
    const caja = pista.current;
    if (!caja || moviendoSolo.current || !caja.clientWidth) return;
    const i = Math.round(caja.scrollLeft / caja.clientWidth);
    if (i !== activo && i >= 0 && i < videos.length) onActivo(i);
  };

  const tapa = (v, key) => (
    <div key={key} style={{ position: 'relative', flex: '0 0 100%', height: '100%', scrollSnapAlign: 'center' }}>
      <Portada foto={portada} video={v?.url} style={{ width: '100%', height: '100%' }}>
        {vacio}
      </Portada>

      {/* Sin `onReproducir` no hay play: en la ficha del repertorio el video se
          reproduce más abajo, y un play aquí prometería algo que no pasa. */}
      {v && onReproducir && (
        <button
          type="button"
          onClick={onReproducir}
          aria-label={`Ver el video de ${nombre}`}
          style={{
            position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
            border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
          }}
        >
          <span style={{
            width: 74, height: 74, borderRadius: '50%', display: 'grid', placeItems: 'center',
            background: 'rgba(255,255,255,0.22)', backdropFilter: 'blur(3px)',
            border: '2px solid rgba(255,255,255,0.55)',
          }}>
            <Play size={30} color="#fff" fill="#fff" style={{ marginLeft: 4 }} />
          </span>
        </button>
      )}

      {/* La etiqueta solo cuando hay con qué comparar: "De frente" a secas, en
          un ejercicio con un único video, no informa nada. */}
      {varios && v?.etiqueta && (
        <span style={{
          position: 'absolute', top: 12, right: 12, padding: '5px 11px', borderRadius: 999,
          background: 'rgba(8,10,14,0.55)', backdropFilter: 'blur(4px)',
          fontFamily: FONT, fontSize: 11.5, fontWeight: 800, color: '#fff', pointerEvents: 'none',
        }}>
          {v.etiqueta}
        </span>
      )}
    </div>
  );

  if (!varios) return tapa(video, 'sola');

  return (
    <>
      <div
        ref={pista}
        className="sin-barra"
        onScroll={alDeslizar}
        style={{
          display: 'flex', height: '100%', overflowX: 'auto', overflowY: 'hidden',
          scrollSnapType: 'x mandatory', WebkitOverflowScrolling: 'touch',
        }}
      >
        {videos.map((v, i) => tapa(v, v.id ?? i))}
      </div>
      <Puntos videos={videos} activo={activo} onIr={vasA} arriba={puntosArriba} />
    </>
  );
}

/**
 * Los puntitos. Dicen cuántos videos hay y en cuál vas.
 *
 * Son botones de verdad, no adornos: en una computadora no hay gesto de
 * deslizar, así que tocarlos tiene que llevar al video. Cada uno tiene 30 px de
 * zona tocable aunque el punto se dibuje de 7.
 */
export function Puntos({ videos, activo, onIr, abajo = 12, arriba = null, claro = false }) {
  if (videos.length < 2) return null;
  const sitio = arriba === null ? { bottom: abajo } : { top: arriba };
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, ...sitio,
      display: 'flex', justifyContent: 'center', gap: 2, pointerEvents: 'none', zIndex: 2,
    }}>
      <span style={{
        display: 'flex', alignItems: 'center', gap: 2, padding: '0 6px', borderRadius: 999,
        background: claro ? 'rgba(17,19,24,0.10)' : 'rgba(8,10,14,0.42)',
        backdropFilter: 'blur(4px)', pointerEvents: 'auto',
      }}>
        {videos.map((v, i) => (
          <button
            key={v.id ?? i}
            type="button"
            onClick={() => onIr(i)}
            aria-label={`Ver ${v.etiqueta || `el video ${i + 1}`}`}
            aria-current={i === activo ? 'true' : undefined}
            style={{
              // 30 px era demasiado chico para un pulgar. La zona tocable es de
              // 40 aunque el punto se dibuje de 7.
              width: 40, height: 40, border: 'none', background: 'transparent',
              cursor: 'pointer', display: 'grid', placeItems: 'center', padding: 0,
            }}
          >
            <span style={{
              width: i === activo ? 18 : 7, height: 7, borderRadius: 999,
              background: i === activo
                ? (claro ? '#111318' : '#fff')
                : (claro ? 'rgba(17,19,24,0.28)' : 'rgba(255,255,255,0.45)'),
              transition: 'width .2s, background .2s',
            }} />
          </button>
        ))}
      </span>
    </div>
  );
}
