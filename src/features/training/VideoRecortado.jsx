import { useRef, useState, useEffect } from 'react';
import { ExternalLink } from 'lucide-react';
import { ligaExterna } from '@/lib/videos';
import { T, FONT } from '@/lib/theme';

/**
 * Reproduce un video de ejercicio respetando el tramo que eligió el coach.
 *
 * El archivo está completo: lo que se recorta es la reproducción. Arranca en
 * el segundo marcado y se detiene en el final marcado. Se hace con eventos y
 * no con `#t=inicio,fin` en la dirección porque Safari ignora el final, que
 * es justamente la mitad que importa.
 *
 * POR QUÉ TIENE ARCHIVO PROPIO. Vivía dentro de `ExerciseMediaModal`, una
 * pantalla que `FichaEjercicio` reemplazó y que terminó sin que nadie la
 * abriera. Al borrarla, esto —que sí se usa— se quedó sin casa.
 */
export function VideoRecortado({ video, estilo }) {
  const ref = useRef(null);
  // Medidas reales del archivo. Hacen falta para saber qué forma tiene el
  // trozo recortado: el encuadre viene en fracciones, y una fracción no dice
  // nada de la proporción hasta multiplicarla por los píxeles del video.
  const [medidas, setMedidas] = useState(null);
  const { url, inicio, fin, sinAudio, encuadre } = video;
  const liga = ligaExterna(url);

  /* Arranca solo al montarse, que es justo cuando el atleta acaba de tocar
     "reproducir". Sin esto, este componente aparecía con el reproductor
     nativo ya visible pero PAUSADO en 0:00 — Andrés lo encontró probándolo:
     tocaba el play grande, el video se mostraba quieto, y hacía falta un
     QUINTO toque en el botón nativo para que arrancara de verdad.

     Se llama aquí, en un efecto atado al montaje, y no con el atributo
     `autoPlay`: los navegadores exigen que el video empiece muted si no hay
     un gesto del usuario detrás. Un efecto que corre justo después del toque
     sigue contando como gesto del usuario, así que el video arranca CON
     sonido. `.catch()` traga el rechazo que dan Safari/iOS cuando el gesto ya
     se perdió por algún reflow lento; si pasa, el botón nativo sigue ahí. */
  useEffect(() => {
    ref.current?.play().catch(() => {});
  }, [url]);

  /* Un video que vive fuera (TikTok, YouTube, un reel) no es un archivo
     nuestro: no se puede recortar, ni quitarle el audio, ni encuadrarlo. Se
     incrusta tal cual, y debajo queda SIEMPRE el botón de abrirlo en su app:
     TikTok e Instagram bloquean el reproductor incrustado cuando les parece, y
     lo hacen dentro del marco, donde esta app no se entera. Sin el botón, eso
     es una pantalla en blanco sin explicación. */
  if (liga) {
    const marco = estilo ?? { width: '100%', borderRadius: 14, marginTop: 12 };
    return (
      <div style={marco}>
        {liga.embed ? (
          <iframe
            key={liga.embed}
            src={liga.embed}
            title={`Video en ${liga.de}`}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            style={{
              width: '100%', aspectRatio: liga.de === 'YouTube' || liga.de === 'Vimeo' ? '16 / 9' : '9 / 16',
              border: 'none', borderRadius: 14, background: '#000', display: 'block',
            }}
          />
        ) : (
          <div style={{
            display: 'grid', placeItems: 'center', gap: 8, padding: '34px 18px',
            background: T.bg3, borderRadius: 14, textAlign: 'center',
          }}>
            <ExternalLink size={22} color={T.text2} />
            <span style={{ fontSize: 13.5, fontWeight: 700, color: T.text2 }}>
              Este video se ve en {liga.de}
            </span>
          </div>
        )}
        {/* Con fondo propio: este bloque puede caer sobre la cabecera negra del
            ejercicio, y un enlace azul sobre negro no se lee. */}
        <a
          href={liga.abrir}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, margin: '9px 0 0 12px',
            padding: '7px 12px', borderRadius: 999, background: '#FFFFFF',
            border: `1px solid ${T.border}`,
            fontFamily: FONT, fontSize: 13, fontWeight: 800, color: T.accent, textDecoration: 'none',
          }}
        >
          <ExternalLink size={14} /> Abrir en {liga.de}
        </a>
      </div>
    );
  }

  const video_ = (
    <video
      key={url}
      ref={ref}
      src={url}
      controls
      playsInline
      muted={!!sinAudio}
      preload="metadata"
      onLoadedMetadata={(e) => {
        const v = e.currentTarget;
        setMedidas({ w: v.videoWidth || 16, h: v.videoHeight || 9 });
        /* Se salta SIEMPRE, aunque no haya recorte. Sin salto, Safari de iPhone
           deja el video en negro hasta darle play: con `preload="metadata"` iOS
           carga la duración pero no dibuja ningún fotograma. El +0,05 es para
           que el salto ocurra de verdad cuando el recorte empieza en 0. */
        v.currentTime = (inicio ?? 0) + 0.05;
      }}
      onTimeUpdate={() => {
        const v = ref.current;
        if (!v) return;
        if (fin != null && v.currentTime >= fin) v.pause();
        // Si el atleta rebobina antes del inicio, se le devuelve al inicio:
        // lo de antes es material que el coach decidió no enseñarle.
        if (inicio != null && v.currentTime < inicio - 0.4) v.currentTime = inicio;
      }}
      style={
        encuadre
          /* Con encuadre el video se agranda y se desplaza dentro de un marco
             que lo recorta. Es la única forma de recortar la imagen sin
             reencodar el archivo — reencodar en el navegador le bajaría la
             calidad, que es lo que Andrés dijo que más le importa. */
          ? {
              position: 'absolute',
              width: `${100 / encuadre.w}%`,
              height: `${100 / encuadre.h}%`,
              left: `${-(encuadre.x / encuadre.w) * 100}%`,
              top: `${-(encuadre.y / encuadre.h) * 100}%`,
              // `fill` y no `contain`: el marco ya tiene la forma exacta del
              // trozo, así que el video debe llenarlo sin dejar franjas.
              objectFit: 'fill',
              /* Sin esto el encuadre NO funciona y no se nota por qué: la app
                 tiene un `max-width: 100%` global para que las imágenes no se
                 desborden, y aquí el video TIENE que desbordarse —se agranda
                 al 166% y se desplaza para que el marco enseñe solo el trozo
                 elegido. El alto sí se aplicaba y el ancho se quedaba corto,
                 así que quedaba una franja negra al lado. */
              maxWidth: 'none', maxHeight: 'none',
              display: 'block', background: '#000',
            }
          : (estilo ?? { width: '100%', borderRadius: 14, marginTop: 12, background: '#000' })
      }
    />
  );

  /* El marco solo existe cuando hay encuadre: si no, sobra un div y el video
     se coloca solo como siempre. */
  if (!encuadre) return video_;

  return (
    <div style={{
      position: 'relative', overflow: 'hidden', background: '#000',
      width: '100%',
      /* La proporción del TROZO, en píxeles reales — no la de sus fracciones.
         Antes se usaba `encuadre.w / encuadre.h` a secas, y eso da la forma
         equivocada: recortar 0,6 de ancho por 0,7 de alto de un video vertical
         no da un marco de 0,857, da uno de 0,48. El marco salía más ancho que
         el trozo y quedaba una franja negra al lado. */
      aspectRatio: medidas
        ? `${encuadre.w * medidas.w} / ${encuadre.h * medidas.h}`
        : `${encuadre.w} / ${encuadre.h}`,
      borderRadius: estilo ? 0 : 14, marginTop: estilo ? 0 : 12,
    }}>
      {video_}
    </div>
  );
}
