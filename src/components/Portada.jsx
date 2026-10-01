/**
 * La imagen de un ejercicio.
 *
 * POR QUE EXISTE:
 * Un ejercicio puede tener foto de portada, o no tenerla. Cuando no la tiene se
 * veía un cuadro gris con una mancuerna dibujada — igual para los ochenta y uno,
 * así que la lista entera se volvía indistinguible. Andrés: "si un ejercicio no
 * tiene portada, pues que mientras utilice foto del video como foto de portada".
 *
 * Y tiene razón doble: además de llenar el hueco, un fotograma del video es
 * EXACTAMENTE lo que va a ver al abrirlo. No es un relleno bonito; es una
 * vista previa de verdad.
 *
 * QUÉ FOTOGRAMA: EL DE LA MITAD. Andrés, 28 sep 2026: "que la foto de portada
 * que aparece siempre sea exactamente de cuando el video va justo a la
 * mitad". Antes era el del arranque (0.1 s), que casi siempre es la persona
 * acomodándose antes de empezar. Si el video está recortado, es la mitad del
 * tramo que ve el atleta (`desde`/`hasta`), no la del archivo entero.
 *
 * ORDEN: foto del coach → foto sacada del video → el video congelado → la
 * mancuerna de siempre.
 *
 * LA FOTO SACADA DEL VIDEO ES LO QUE HACE QUE SALGA AL INSTANTE.
 * Andrés, 1 oct 2026: "casi siempre sale un recuadrito negro en lugar de la foto
 * de portada... ya tendría que estar ahí la foto inmediatamente". Tenía razón: la
 * portada era el propio video abierto en chiquito, y eso obliga a pedirle a
 * Cloudflare su índice, saltar a la mitad y bajar varios MB POR CADA ejercicio de
 * la lista. La app ahora le saca la foto sola al video (ver `fotogramas` y
 * `posters`) y aquí solo se pinta: primero una vista previa borrosa que viaja
 * dentro de los datos del ejercicio —ya está ahí cuando se dibuja la pantalla—
 * y encima, en cuanto llega, la foto nítida.
 *
 * TRES ESTADOS de esa foto (ver `usePoster`): hay → se pinta; todavía no se
 * sabe (primera vez, mientras llega la tabla) → un fondo claro y quieto, NUNCA
 * se arranca el video «por si acaso»; no hay → el video congelado de siempre.
 */
import { useEffect, useRef, useState } from 'react';
import { ligaExterna, estiloDelEncuadre } from '@/lib/videos';
import { mitadDe, segundos } from '@/lib/fotogramas';
import { usePoster } from '@/lib/posters';

const RELLENO = {
  position: 'absolute', inset: 0, width: '100%', height: '100%',
  objectFit: 'cover', display: 'block',
};

/**
 * La foto sacada del video: una vista previa borrosa y, encima, la nítida cuando llega.
 * Con `encuadre` se coloca igual que el video (la caja ya tiene la forma del recorte),
 * para que al darle play la imagen no «salte».
 */
function FotoDeVideo({ fila, grande, encuadre }) {
  const [lista, setLista] = useState(false);
  const src = grande ? fila.poster_url : (fila.mini_url || fila.poster_url);
  const base = encuadre ? estiloDelEncuadre(encuadre) : RELLENO;
  return (
    <>
      {fila.lqip && (
        <img
          src={fila.lqip} alt="" aria-hidden="true"
          style={{ ...base, filter: 'blur(8px)', ...(encuadre ? {} : { transform: 'scale(1.12)' }) }}
        />
      )}
      <img
        // Una imagen que ya estaba en la memoria del teléfono puede terminar de cargar antes de que React escuche su `load`.
        ref={(el) => { if (el?.complete && el.naturalWidth && !lista) setLista(true); }}
        key={src} src={src} alt="" decoding="async" loading={grande ? 'eager' : 'lazy'}
        onLoad={() => setLista(true)}
        style={{ ...base, opacity: lista ? 1 : 0, transition: 'opacity .2s ease' }}
      />
    </>
  );
}

// El fondo claro y quieto de «todavía no sé si hay foto». Claro a propósito: el recuadro de la lista es oscuro y un cuadro negro es lo que se quiere evitar.
const Espera = () => <span aria-hidden="true" style={{ ...RELLENO, background: '#E6E9EF' }} />;

/**
 * Un video haciendo de foto: sin sonido, sin controles, quieto a la mitad.
 * Es lo de siempre y solo se usa cuando ese video no tiene foto sacada.
 *
 * DOS DETALLES QUE PARECEN DE MÁS Y NO LO SON:
 *
 * 1. El salto. Safari en iPhone no dibuja NINGÚN fotograma mientras el video
 *    no se haya movido: carga la duración y deja el recuadro en negro. Pedirle
 *    que salte lo obliga a pintar. Ya nos pasó tres veces en pantallas
 *    distintas. Ahora el salto es a la mitad, que además es el fotograma que
 *    se quiere; si la duración no se sabe, vuelve a 0.1 s.
 *
 * 2. Solo se empieza a cargar cuando el recuadro se acerca a la pantalla. En
 *    el repertorio hay ochenta y un ejercicios; si todos pidieran su video a la
 *    vez, abrir la lista con datos móviles costaría más que ver el video.
 */
function VideoComoFoto({ src, desde, hasta }) {
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
      <Espera />
      {visible && (
        <video
          src={src}
          muted
          playsInline
          preload="metadata"
          tabIndex={-1}
          aria-hidden="true"
          onLoadedMetadata={(e) => {
            e.currentTarget.currentTime = mitadDe(e.currentTarget.duration, segundos(desde), segundos(hasta));
          }}
          style={RELLENO}
        />
      )}
    </span>
  );
}

/**
 * @param foto    dirección de la foto de portada, si tiene
 * @param video   dirección del video, para sacarle el fotograma de la mitad
 * @param desde   inicio del recorte del video, en segundos (si lo tiene)
 * @param hasta   fin del recorte del video, en segundos (si lo tiene)
 * @param encuadre  el encuadre del video ({ x, y, w, h }): solo para cuando la caja ya
 *                  tiene la forma del recorte (la tarjeta de la ficha)
 * @param grande  true en pantallas donde la foto ocupa buena parte de la pantalla
 *                (la ficha del ejercicio): usa la foto grande y no la chica
 * @param style   se aplica al recuadro de fuera (tamaño, borde, color de fondo)
 * @param children  lo que se pinta cuando no hay ni foto ni video
 */
export default function Portada({ foto, video, desde, hasta, encuadre, grande = false, style, children }) {
  // Un video que vive fuera (TikTok, YouTube) no da un primer fotograma: el
  // <video> no puede leerlo y el recuadro se quedaría en negro sin que nada lo
  // explique. En ese caso se pinta lo de siempre.
  const propio = !!video && !ligaExterna(video);
  // El gancho se llama siempre; con `null` no busca nada.
  const poster = usePoster(!foto && propio ? video : null);

  let contenido = children;
  if (foto) {
    contenido = <img src={foto} alt="" loading="lazy" style={RELLENO} />;
  } else if (propio) {
    if (poster) contenido = <FotoDeVideo fila={poster} grande={grande} encuadre={encuadre} />;
    else if (poster === undefined) contenido = <Espera />;
    else contenido = <VideoComoFoto src={video} desde={desde} hasta={hasta} />;
  }

  return (
    <span
      style={{
        position: 'relative', overflow: 'hidden',
        display: 'grid', placeItems: 'center',
        ...style,
      }}
    >
      {contenido}
    </span>
  );
}
