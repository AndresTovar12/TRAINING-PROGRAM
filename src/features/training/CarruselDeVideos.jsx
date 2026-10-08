import { useCallback, useEffect, useRef } from 'react';
import { ChevronsRight, Play } from 'lucide-react';
import { FONT, LT } from '@/lib/theme';
import Portada from '@/components/Portada';
import IconoExplicacion from '@/components/IconoExplicacion';

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
 * QUÉ SE DESLIZA AQUÍ Y QUÉ NO. Aquí se deslizan las PORTADAS, antes del play. Al darle al play, el que está elegido ocupa el
 * lugar entero y el deslizar pasa a ser un gesto del propio reproductor (ver `VideoRecortado`, `onDeslizar`): adelantar el video
 * se hace en su barra, no arrastrando la imagen, así que los dos gestos no se estorban. Andrés, 7 oct 2026: «con más de un video
 * no se puede deslizar para ver el segundo».
 *
 * LA EXPLICACIÓN VA PRIMERO (ver `videosParaAtleta`) y se distingue a la vista: etiqueta blanca con el ícono de la persona
 * hablando, y su puntito es un anillo azul en vez de un punto gris. En el primero, la primera vez, una pista «Desliza ›».
 *
 * CON UN SOLO VIDEO no hay carrusel ni puntos: es exactamente lo de siempre.
 */
export default function CarruselDeVideos({
  videos, portada, nombre, activo, onActivo, onReproducir, vacio, puntosArriba = null, sinPuntos = false, pista: conPista = false,
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

  /* Los puntitos pueden estar FUERA del carrusel (debajo de la tarjeta, ver
     `TarjetaDeVideo`) y cambiar `activo` desde ahí: la pista tiene que
     acompañarlos. Si el cambio vino de deslizar, ya está en su sitio y no hace nada. */
  useEffect(() => {
    const caja = pista.current;
    if (!caja || !caja.clientWidth) return;
    const destino = caja.clientWidth * activo;
    if (Math.abs(caja.scrollLeft - destino) <= 2) return;
    moviendoSolo.current = true;
    caja.scrollTo({ left: destino, behavior: 'smooth' });
    window.setTimeout(() => { moviendoSolo.current = false; }, 420);
  }, [activo]);

  const alDeslizar = () => {
    const caja = pista.current;
    if (!caja || moviendoSolo.current || !caja.clientWidth) return;
    const i = Math.round(caja.scrollLeft / caja.clientWidth);
    if (i !== activo && i >= 0 && i < videos.length) onActivo(i);
  };

  const tapa = (v, key, i = 0) => (
    <div key={key} style={{ position: 'relative', flex: '0 0 100%', height: '100%', scrollSnapAlign: 'center' }}>
      <Portada grande foto={portada} video={v?.url} desde={v?.inicio} hasta={v?.fin} encuadre={v?.encuadre} style={{ width: '100%', height: '100%' }}>
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
          {/* Blanco sólido con el triángulo azul: se lee igual sobre cualquier foto, claro u oscuro. */}
          <span style={{
            width: 64, height: 64, borderRadius: '50%', display: 'grid', placeItems: 'center',
            background: '#FFFFFF', boxShadow: '0 4px 16px rgba(8,10,14,0.28)',
          }}>
            <Play size={26} color={LT.blue} fill={LT.blue} style={{ marginLeft: 3 }} />
          </span>
        </button>
      )}

      {/* La etiqueta solo cuando hay con qué comparar: "De frente" a secas, en
          un ejercicio con un único video, no informa nada. */}
      {varios && v?.etiqueta && <EtiquetaDeVideo video={v} />}

      {/* La pista, solo en el primero y hasta que la persona deslice una vez (lo decide `TarjetaDeVideo`). */}
      {varios && conPista && i === 0 && (
        <span style={{
          position: 'absolute', right: 10, bottom: 12, display: 'inline-flex', alignItems: 'center', gap: 4, padding: '5px 10px',
          borderRadius: 999, background: 'rgba(8,10,14,0.45)', fontFamily: FONT, fontSize: 11, fontWeight: 700, color: '#fff',
          pointerEvents: 'none',
        }}>
          Desliza <ChevronsRight size={12} />
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
        {videos.map((v, i) => tapa(v, v.id ?? i, i))}
      </div>
      {!sinPuntos && <Puntos videos={videos} activo={activo} onIr={vasA} arriba={puntosArriba} />}
    </>
  );
}

/**
 * El nombre del video, en una pastilla sobre su esquina de arriba a la derecha. La EXPLICACIÓN va en blanco con el ícono de la
 * persona hablando (Andrés: «el primer video lleva la etiqueta "Explicación"»); los ejemplos, oscuros y con su ángulo. La usan
 * las portadas (aquí) y el video reproduciéndose (ver `TarjetaDeVideo`, donde se apaga sola).
 */
export function EtiquetaDeVideo({ video, style }) {
  const explicacion = !!video?.explicacion;
  return (
    <span style={{
      position: 'absolute', top: 12, right: 12, display: 'inline-flex', alignItems: 'center', gap: 5, padding: '5px 11px',
      borderRadius: 999, fontFamily: FONT, fontSize: 11.5, fontWeight: 800, pointerEvents: 'none',
      background: explicacion ? '#FFFFFF' : 'rgba(8,10,14,0.55)', color: explicacion ? LT.blue : '#fff',
      backdropFilter: explicacion ? undefined : 'blur(4px)', boxShadow: explicacion ? '0 2px 8px rgba(8,10,14,0.22)' : undefined,
      ...style,
    }}>
      {explicacion && <IconoExplicacion size={13} color={LT.blue} />}
      {video?.etiqueta}
    </span>
  );
}

/**
 * Los puntitos. Dicen cuántos videos hay y en cuál vas.
 *
 * Son botones de verdad, no adornos: en una computadora no hay gesto de
 * deslizar, así que tocarlos tiene que llevar al video. Cada uno tiene 30 px de
 * zona tocable aunque el punto se dibuje de 7.
 */
export function Puntos({ videos, activo, onIr, abajo = 12, arriba = null, claro = false, enFlujo = false }) {
  if (videos.length < 2) return null;
  const sitio = arriba === null ? { bottom: abajo } : { top: arriba };
  return (
    <div style={enFlujo
      // Debajo de la tarjeta, en el flujo normal de la pantalla.
      ? { display: 'flex', justifyContent: 'center', gap: 2, marginTop: 6 }
      : {
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
            {v.explicacion ? (
              /* La EXPLICACIÓN es un anillo azul (relleno cuando es la que se ve): se distingue de los ejemplos sin leer nada. */
              <span style={{
                width: i === activo ? 18 : 9, height: 9, borderRadius: 999, boxSizing: 'border-box',
                border: `2px solid ${claro ? LT.blue : '#fff'}`,
                background: i === activo ? (claro ? LT.blue : '#fff') : 'transparent',
                transition: 'width .2s, background .2s',
              }} />
            ) : (
              <span style={{
                width: i === activo ? 18 : 7, height: 7, borderRadius: 999,
                background: i === activo
                  ? (claro ? '#111318' : '#fff')
                  : (claro ? 'rgba(17,19,24,0.28)' : 'rgba(255,255,255,0.45)'),
                transition: 'width .2s, background .2s',
              }} />
            )}
          </button>
        ))}
      </span>
    </div>
  );
}
