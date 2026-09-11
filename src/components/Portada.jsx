/**
 * La imagen de un ejercicio.
 *
 * POR QUE EXISTE:
 * Un ejercicio puede tener foto de portada, o no tenerla. Cuando no la tiene se
 * veía un cuadro gris con una mancuerna dibujada — igual para los ochenta y uno,
 * así que la lista entera se volvía indistinguible. Andrés: "si un ejercicio no
 * tiene portada, pues que mientras utilice foto del video como foto de portada".
 *
 * Y tiene razón doble: además de llenar el hueco, el primer fotograma del video
 * es EXACTAMENTE lo que va a ver al abrirlo. No es un relleno bonito; es una
 * vista previa de verdad.
 *
 * ORDEN: foto → primer fotograma del video → la mancuerna de siempre.
 *
 * POR QUE NO SE GENERA UNA MINIATURA DE VERDAD:
 * Lo natural sería dibujar el fotograma en un canvas y guardarlo como imagen.
 * No se puede: leer los píxeles de un video que vive en otro dominio "mancha"
 * el canvas y el navegador prohíbe exportarlo. Cloudflare no manda las
 * cabeceras que harían falta para permitirlo. Así que se usa el propio
 * elemento de video, congelado en su primer fotograma. Comprobado en consola.
 */
import { useEffect, useRef, useState } from 'react';

/**
 * Un video haciendo de foto: sin sonido, sin controles, quieto en el arranque.
 *
 * DOS DETALLES QUE PARECEN DE MÁS Y NO LO SON:
 *
 * 1. El salto a 0.1 s. Safari en iPhone no dibuja NINGÚN fotograma mientras el
 *    video no se haya movido: carga la duración y deja el recuadro en negro.
 *    Pedirle que salte un pelín lo obliga a pintar. Ya nos pasó tres veces en
 *    pantallas distintas.
 *
 * 2. Solo se empieza a cargar cuando el recuadro se acerca a la pantalla. En
 *    el repertorio hay ochenta y un ejercicios; si todos pidieran su video a la
 *    vez, abrir la lista con datos móviles costaría más que ver el video.
 */
function VideoComoFoto({ src, estilo }) {
  const caja = useRef(null);
  // Sin IntersectionObserver (navegadores viejos) se carga de una: es peor
  // quedarse sin portada que gastar de más. Se decide al crear el estado y no
  // dentro del efecto, que provocaría un render extra por cada recuadro.
  const [visible, setVisible] = useState(() => typeof IntersectionObserver === 'undefined');

  useEffect(() => {
    const nodo = caja.current;
    if (!nodo || typeof IntersectionObserver === 'undefined') return undefined;
    const observador = new IntersectionObserver((entradas) => {
      if (entradas.some((e) => e.isIntersecting)) {
        setVisible(true);
        observador.disconnect();
      }
    }, { rootMargin: '200px' });
    observador.observe(nodo);
    return () => observador.disconnect();
  }, []);

  return (
    <span ref={caja} style={{ position: 'absolute', inset: 0 }}>
      {visible && (
        <video
          src={src}
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
          aria-hidden="true"
          onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.1; }}
          style={estilo}
        />
      )}
    </span>
  );
}

/**
 * @param foto   dirección de la foto de portada, si tiene
 * @param video  dirección del video, para sacarle el primer fotograma
 * @param style  se aplica al recuadro de fuera (tamaño, borde, color de fondo)
 * @param children  lo que se pinta cuando no hay ni foto ni video
 */
export default function Portada({ foto, video, style, children }) {
  const relleno = {
    position: 'absolute', inset: 0, width: '100%', height: '100%',
    objectFit: 'cover', display: 'block',
  };

  return (
    <span
      style={{
        position: 'relative', overflow: 'hidden',
        display: 'grid', placeItems: 'center',
        ...style,
      }}
    >
      {foto
        ? <img src={foto} alt="" loading="lazy" style={relleno} />
        : video
          ? <VideoComoFoto src={video} estilo={relleno} />
          : children}
    </span>
  );
}
