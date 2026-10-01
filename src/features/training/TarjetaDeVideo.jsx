import { useRef, useState } from 'react';
import { Dumbbell } from 'lucide-react';
import { ligaExterna, redPermiteAdelantar } from '@/lib/videos';
import { usePoster } from '@/lib/posters';
import CarruselDeVideos, { Puntos } from '@/features/training/CarruselDeVideos';
import { VideoRecortado } from '@/features/training/VideoRecortado';

// Lo más alto que puede ser la tarjeta: deja sitio abajo para anotar reps y peso sin tener que bajar
// (con más, en un teléfono normal la segunda caja de anotar ya se queda detrás del botón de seguir).
const ALTO_MAXIMO = '38vh';

/**
 * El video de un ejercicio, en una tarjeta con las esquinas redondeadas.
 *
 * POR QUÉ ES UNA TARJETA Y NO UNA FRANJA A TODO LO ANCHO. Andrés, 1 oct 2026:
 * la reproducción «cumple su función pero se ve como una página barata hecha
 * sin esfuerzo», y le enseñó una app que ya existe: el video en una tarjeta
 * redondeada con márgenes, un botón de play blanco grande y controles
 * sencillos. Antes la foto llenaba el ancho y, al darle play, saltaba a una
 * caja negra con barras a los lados y los controles del navegador.
 *
 * LA TARJETA TIENE LA FORMA DEL RECORTE. El coach recorta cada video como
 * quiere (el «encuadre»): la tarjeta toma exactamente esa forma, así no hay
 * barras negras y la pantalla NO cambia de tamaño al darle play. Si el recorte
 * es muy alto, la tarjeta se angosta (centrada) en vez de crecer hacia abajo.
 *
 * TRES CAPAS, DE ABAJO ARRIBA: el video (montado desde que se abre el ejercicio,
 * ver abajo), su foto con el indicador de carga, y la portada con el botón de
 * play, que desaparece al darle play. Los controles propios los pone el video.
 *
 * EL VIDEO EMPIEZA A BAJAR AL ABRIR EL EJERCICIO, no al tocar play. Andrés,
 * 1 oct 2026: «le pica al video y el video tarda muchísimo en cargar». Medido en
 * Safari y Chrome: si el video lleva 1 s preparándose cuando le dan play,
 * arranca en menos de 0.02 s (antes, 1-3 s); más ventaja no mejora nada.
 * Tiene que ser el MISMO <video> que luego se reproduce, porque preparar uno y
 * crear otro después no sirve (en Safari se baja entero otra vez).
 * Solo el del ejercicio abierto, no todos los del día: cada video preparado baja
 * entre 4 y 25 MB aunque nadie lo vea. Los que viven fuera (TikTok, YouTube) no
 * se preparan: se incrustarían escondidos.
 *
 * Se monta con `key` del ejercicio: al pasar al siguiente, todo vuelve a su
 * estado inicial (sin video «ya reproduciendo» que no ha cargado).
 */
export default function TarjetaDeVideo({ videos, portada, nombre }) {
  const [reproduciendo, setReproduciendo] = useState(false);
  const [angulo, setAngulo] = useState(0);
  // El play() del reproductor, para llamarlo dentro del propio toque (ver `VideoRecortado`).
  const jugador = useRef(null);
  // Se decide una vez por pantalla: si el teléfono pide ahorrar datos, no se baja nada por adelantado.
  const [adelanta] = useState(redPermiteAdelantar);
  // Las medidas que dio el propio archivo, por si ese video aún no tiene foto guardada (ahí vienen las medidas).
  const [medidasDe, setMedidasDe] = useState(null);

  const video = videos[angulo] ?? videos[0] ?? null;
  const externo = !!video && !!ligaExterna(video.url);
  const propio = !!video && !externo;
  const poster = usePoster(propio ? video.url : null);

  const dims = poster?.ancho && poster?.alto
    ? { w: poster.ancho, h: poster.alto }
    : (propio && medidasDe?.url === video.url ? medidasDe : null);
  const e = propio ? video.encuadre : null;
  let aspecto = 4 / 3; // una foto suelta, o un video de fuera
  if (propio) {
    if (!dims) aspecto = 0.8;
    else aspecto = e ? (e.w * dims.w) / (e.h * dims.h) : dims.w / dims.h;
  }
  aspecto = Math.round(aspecto * 1000) / 1000;

  // Un video de fuera se incrusta tal cual (ver `VideoRecortado`): no cabe en la tarjeta.
  if (reproduciendo && externo) {
    return (
      <div style={{ marginTop: 14 }}>
        <VideoRecortado video={video} estilo={{ width: '100%', borderRadius: 20 }} />
        <Puntos videos={videos} activo={angulo} onIr={setAngulo} enFlujo claro />
      </div>
    );
  }

  return (
    <div style={{ marginTop: 14 }}>
      <div style={{
        position: 'relative', overflow: 'hidden', margin: '0 auto', borderRadius: 20, background: '#0E1015',
        boxShadow: '0 8px 24px rgba(17,19,24,0.14)',
        aspectRatio: `${aspecto}`, width: `min(100%, calc(${ALTO_MAXIMO} * ${aspecto}))`, maxWidth: 480,
      }}>
        {propio && (reproduciendo || adelanta) && (
          <VideoRecortado
            video={video}
            reproduce={reproduciendo}
            reproducirRef={jugador}
            onMedidas={(w, h) => setMedidasDe({ url: video.url, w, h })}
          />
        )}

        {!reproduciendo && (
          <div style={{ position: 'absolute', inset: 0, zIndex: 2 }}>
            <CarruselDeVideos
              videos={videos}
              portada={portada}
              nombre={nombre}
              activo={angulo}
              onActivo={setAngulo}
              onReproducir={() => { jugador.current?.(); setReproduciendo(true); }}
              vacio={<Dumbbell size={54} color="#2A3040" />}
              sinPuntos
            />
          </div>
        )}
      </div>
      <Puntos videos={videos} activo={angulo} onIr={setAngulo} enFlujo claro />
    </div>
  );
}
