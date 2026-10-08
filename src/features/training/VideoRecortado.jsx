import { useRef, useState, useEffect } from 'react';
import { ExternalLink, Loader2, Maximize2, Pause, Play } from 'lucide-react';
import { ligaExterna, estiloDelEncuadre } from '@/lib/videos';
import { usePoster } from '@/lib/posters';
import { T, FONT } from '@/lib/theme';

const RELLENO = { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' };
const mmss = (s) => {
  const n = Math.max(0, Math.floor(s || 0));
  return `${Math.floor(n / 60)}:${String(n % 60).padStart(2, '0')}`;
};

/**
 * Reproduce un video de ejercicio respetando el tramo que eligió el coach.
 *
 * El archivo está completo: lo que se recorta es la reproducción. Arranca en
 * el segundo marcado y se detiene en el final marcado. Se hace con eventos y
 * no con `#t=inicio,fin` en la dirección porque Safari ignora el final, que
 * es justamente la mitad que importa.
 *
 * UN VIDEO PROPIO LLENA SU CAJA. No trae marco, forma ni bordes: se coloca con
 * `position: absolute` dentro de la tarjeta que lo contiene (ver
 * `TarjetaDeVideo`), que ya tiene la forma exacta del recorte. Así no hay
 * barras negras y la pantalla no cambia de tamaño al darle play. Los controles
 * son propios (tocar para pausar, barra de avance del tramo, pantalla completa)
 * y no los del navegador, que en cada aparato se ven distintos y baratos.
 *
 * POR QUÉ TIENE ARCHIVO PROPIO. Vivía dentro de `ExerciseMediaModal`, una
 * pantalla que `FichaEjercicio` reemplazó y que terminó sin que nadie la
 * abriera. Al borrarla, esto —que sí se usa— se quedó sin casa.
 *
 * @param reproduce      false = montado y preparándose, sin arrancar (ver abajo)
 * @param reproducirRef  ref donde deja un `play()` para llamarlo dentro del toque
 * @param onMedidas      avisa del ancho y alto reales del archivo (para la forma de la tarjeta)
 * @param estilo         solo para videos de fuera (TikTok, YouTube): el marco del iframe
 * @param onRechazado    el navegador no dejó que el video arrancara solo (iPhone, sin un toque que lo pida). Si lo pasan, se
 *                       llama en vez de sacar los controles del navegador; tiene que ser estable (el efecto lo usa).
 * @param onDeslizar     con más de un video: se llama con 1 (siguiente) o -1 (anterior) al deslizar el dedo de lado sobre el
 *                       video que se reproduce. Andrés, 7 oct 2026: «con más de un video no se puede deslizar para ver el
 *                       segundo». Solo con el dedo (un ratón arrastrando no cambia de video) y no con la barra de avance,
 *                       que ya usa el gesto de lado para adelantar.
 *
 * UN SOLO <video> PARA TODOS LOS ÁNGULOS. Al cambiar de video lo que cambia es su `src`, no el elemento. No es un detalle:
 * Safari de iPhone solo deja arrancar un video CON SONIDO si el toque lo pide, y deslizar no cuenta como toque. Pero un
 * elemento al que ya se le dio play con un toque conserva ese permiso: si se creara otro para cada ángulo, el siguiente se
 * quedaría parado con los controles del navegador. (Por eso no lleva `key={url}`.)
 */
export function VideoRecortado({ video, estilo, reproduce = true, reproducirRef, onMedidas, onDeslizar, onRechazado }) {
  const ref = useRef(null);
  const pista = useRef(null);
  const arrastra = useRef(false);
  // El dedo que está deslizando de lado sobre el video: dónde empezó y si ya cambió de video (ver `onDeslizar`).
  const gesto = useRef(null);
  const { url, inicio, fin, sinAudio, encuadre } = video;
  const liga = ligaExterna(url);
  /* La foto del video, que se ve MIENTRAS carga en vez de un cuadro negro con
     el icono de pausa. Andrés, 1 oct 2026: "le pica al video y el video tarda
     muchísimo en cargar" y lo que ve es un rectángulo negro.
     `arrancadoDe` guarda de QUÉ video ya arrancó: así cambiar de ángulo no
     arrastra el «ya arrancó» del anterior. `noArranca` cubre el caso en que
     Safari rechaza el play() automático: sin él la foto taparía los controles
     para siempre y no habría forma de darle play (y entonces salen los
     controles del navegador). `listoDe`: de qué video ya hay datos para
     arrancar; si ya está listo cuando le dan play, la foto ni se asoma. */
  const poster = usePoster(liga ? null : url);
  const [arrancadoDe, setArrancadoDe] = useState(null);
  const [noArranca, setNoArranca] = useState(null);
  const [listoDe, setListoDe] = useState(null);
  const [tiempo, setTiempo] = useState(inicio ?? 0);
  const [largo, setLargo] = useState(0);
  const [enPausa, setEnPausa] = useState(true);
  const [visibles, setVisibles] = useState(true);
  const [toque, setToque] = useState(0);
  const sinFoto = arrancadoDe === url || noArranca === url || (reproduce && listoDe === url);

  /* ARRANCA SOLO, NO A LA ESPERA DE OTRO TOQUE. Sin esto, este componente
     aparecía con el reproductor nativo ya visible pero PAUSADO en 0:00 —
     Andrés lo encontró probándolo: tocaba el play grande, el video se mostraba
     quieto, y hacía falta un QUINTO toque en el botón nativo.

     Se llama con `play()` y no con el atributo `autoPlay`: los navegadores
     exigen que el video empiece muted si no hay un gesto del usuario detrás.
     `.catch()` traga el rechazo que dan Safari/iOS cuando el gesto ya se perdió;
     si pasa, salen los controles del navegador.

     CUÁNDO. Con `reproduce` en true desde el principio arranca al montarse. Con
     `reproduce` en false el video se monta DETRÁS de la portada y solo se
     prepara —baja el índice y salta al inicio del recorte—, para que cuando el
     atleta le dé play ya esté listo (ver `FichaEjercicio`). Medido en Safari y
     Chrome: con 1 s de ventaja el toque pasa de 1-3 s a menos de 0.02 s.

     El toque llama a `reproducirRef.current()` DENTRO del propio gesto: un
     play() con sonido solo se acepta ahí, y esperar a que React vuelva a pintar
     arriesga perderlo en iPhone. El efecto de abajo es la red de seguridad para
     cuando `reproduce` ya viene en true al montarse. */
  useEffect(() => {
    if (!reproducirRef) return undefined;
    reproducirRef.current = () => ref.current?.play()?.catch(() => setNoArranca(url));
    return () => { reproducirRef.current = null; };
  }, [reproducirRef, url]);

  useEffect(() => {
    if (!reproduce) return;
    const v = ref.current;
    if (v?.paused) {
      v.play()?.catch((e) => {
        // «Interrumpido» no es un rechazo: pasa al cambiar de video a media carga, y el de ahora ya viene en camino.
        if (e?.name === 'AbortError') return;
        if (onRechazado) onRechazado();
        else setNoArranca(url);
      });
    }
  }, [url, reproduce, onRechazado]);

  // Los controles se esconden solos a los 2.5 s de ir reproduciendo, y vuelven con cualquier toque o al pausar.
  useEffect(() => {
    if (!reproduce || enPausa || !visibles) return undefined;
    const t = setTimeout(() => setVisibles(false), 2500);
    return () => clearTimeout(t);
  }, [reproduce, enPausa, visibles, toque]);

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
        {/* Con fondo propio: este bloque puede caer sobre un fondo oscuro, y un
            enlace azul sobre negro no se lee. */}
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

  const ini = inicio ?? 0;
  const duracion = Math.max(0.1, (fin ?? largo) - ini);
  const progreso = Math.min(1, Math.max(0, (tiempo - ini) / duracion));
  const controlesPropios = reproduce && noArranca !== url;

  const mostrar = () => { setVisibles(true); setToque((n) => n + 1); };

  // Tocar el video pausa o sigue. Si ya llegó al final del tramo, vuelve a empezar desde el inicio.
  const alternar = () => {
    const v = ref.current;
    if (!v) return;
    mostrar();
    if (v.paused) {
      if (v.ended || (fin != null && v.currentTime >= fin - 0.15)) v.currentTime = ini;
      v.play()?.catch(() => setNoArranca(url));
    } else {
      v.pause();
    }
  };

  /* DESLIZAR DE LADO CAMBIA DE VIDEO. Con `touch-action: pan-y` el navegador se queda con el movimiento vertical (la página
     sigue bajando y subiendo) y nos entrega el horizontal. 44 px y más de lado que de alto: un toque torcido no cambia nada.
     El `click` que algunos navegadores disparan al soltar se descarta (`gesto.hecho`), o el video se pausaría al cambiar. */
  const alBajar = (e) => {
    if (!onDeslizar || e.pointerType === 'mouse') return;
    gesto.current = { x: e.clientX, y: e.clientY, hecho: false };
  };
  const alMover = (e) => {
    const g = gesto.current;
    if (!g || g.hecho) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy) * 1.5) return;
    g.hecho = true;
    onDeslizar(dx < 0 ? 1 : -1);
  };
  const alSoltar = () => { window.setTimeout(() => { gesto.current = null; }, 0); };
  const alTocar = () => { if (!gesto.current?.hecho) alternar(); };

  // La barra mide el TRAMO que ve el atleta, no el archivo entero.
  const salta = (e) => {
    const r = pista.current?.getBoundingClientRect();
    const v = ref.current;
    if (!r || !v || !r.width) return;
    const p = Math.min(1, Math.max(0, (e.clientX - r.left) / r.width));
    v.currentTime = ini + p * duracion;
    setTiempo(v.currentTime);
  };

  // Pantalla completa del propio video: en iPhone abre el reproductor de Apple, en lo demás el del navegador.
  const pantallaCompleta = () => {
    const v = ref.current;
    if (!v) return;
    if (v.requestFullscreen) v.requestFullscreen()?.catch(() => v.webkitEnterFullscreen?.());
    else v.webkitEnterFullscreen?.();
  };

  const estiloDelVideo = encuadre
    ? { ...estiloDelEncuadre(encuadre), background: '#000' }
    : { ...RELLENO, background: '#000' };

  /* LA FOTO, ENCIMA DEL VIDEO HASTA QUE ARRANCA. No recibe toques y se apaga con
     un fundido. Con encuadre la foto se coloca EXACTAMENTE como el video, así
     que cae justo donde va a caer la imagen. */
  const capa = poster && (
    <div
      aria-hidden="true"
      style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', background: '#000', zIndex: 1,
        opacity: sinFoto ? 0 : 1, transition: 'opacity .25s ease',
      }}
    >
      {poster.lqip && (
        <img
          src={poster.lqip} alt=""
          style={{ ...(encuadre ? estiloDelEncuadre(encuadre) : RELLENO), filter: 'blur(8px)' }}
        />
      )}
      <img src={poster.poster_url} alt="" style={encuadre ? estiloDelEncuadre(encuadre) : RELLENO} />
      <span style={{
        position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
        width: 54, height: 54, borderRadius: '50%', background: 'rgba(0,0,0,.45)',
        display: 'grid', placeItems: 'center',
      }}>
        <Loader2 size={26} color="#fff" className="tl-gira" />
      </span>
      <style>{'.tl-gira{animation:tl-gira .8s linear infinite}@keyframes tl-gira{to{transform:rotate(360deg)}}'}</style>
    </div>
  );

  const boton = {
    width: 32, height: 32, flexShrink: 0, border: 'none', background: 'transparent', color: '#fff',
    display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0,
  };

  return (
    <>
      <video
        ref={ref}
        src={url}
        controls={noArranca === url}
        playsInline
        muted={!!sinAudio}
        preload="metadata"
        // Empieza a cargar OTRO video en el mismo elemento (otro ángulo): el reloj y la duración del anterior ya no valen.
        onLoadStart={() => { setTiempo(inicio ?? 0); setLargo(0); setEnPausa(true); }}
        onCanPlay={() => setListoDe(url)}
        onPlaying={() => setArrancadoDe(url)}
        onPlay={() => setEnPausa(false)}
        onPause={() => { setEnPausa(true); setVisibles(true); }}
        onError={() => setNoArranca(url)}
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          setLargo(v.duration || 0);
          if (v.videoWidth && v.videoHeight) onMedidas?.(v.videoWidth, v.videoHeight);
          /* Se salta SIEMPRE, aunque no haya recorte. Sin salto, Safari de iPhone
             deja el video en negro hasta darle play: con `preload="metadata"` iOS
             carga la duración pero no dibuja ningún fotograma. El +0,05 es para
             que el salto ocurra de verdad cuando el recorte empieza en 0. */
          v.currentTime = ini + 0.05;
        }}
        onTimeUpdate={() => {
          const v = ref.current;
          if (!v) return;
          if (!arrastra.current) setTiempo(v.currentTime);
          if (fin != null && v.currentTime >= fin) v.pause();
          // Si el atleta rebobina antes del inicio, se le devuelve al inicio:
          // lo de antes es material que el coach decidió no enseñarle.
          if (inicio != null && v.currentTime < inicio - 0.4) v.currentTime = inicio;
        }}
        style={estiloDelVideo}
      />
      {capa}

      {controlesPropios && (
        <div
          role="button"
          tabIndex={-1}
          aria-label={enPausa ? 'Reproducir' : 'Pausar'}
          onClick={alTocar}
          onPointerDown={alBajar}
          onPointerMove={alMover}
          onPointerUp={alSoltar}
          onPointerCancel={alSoltar}
          style={{ position: 'absolute', inset: 0, zIndex: 3, cursor: 'pointer', touchAction: onDeslizar ? 'pan-y' : undefined }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            // La barra y los botones son suyos: arrastrar la barra no cambia de video.
            onPointerDown={(e) => e.stopPropagation()}
            onPointerMove={(e) => e.stopPropagation()}
            onPointerUp={(e) => e.stopPropagation()}
            style={{
              position: 'absolute', left: 10, right: 10, bottom: 10, height: 40, borderRadius: 20,
              background: 'rgba(8,10,14,0.66)', display: 'flex', alignItems: 'center', gap: 6,
              padding: '0 6px 0 4px', fontFamily: FONT,
              opacity: visibles || enPausa ? 1 : 0, transition: 'opacity .25s ease',
              pointerEvents: visibles || enPausa ? 'auto' : 'none',
            }}
          >
            <button type="button" onClick={alternar} aria-label={enPausa ? 'Reproducir' : 'Pausar'} style={boton}>
              {enPausa ? <Play size={17} fill="#fff" /> : <Pause size={17} fill="#fff" />}
            </button>
            <div
              ref={pista}
              onPointerDown={(e) => {
                arrastra.current = true;
                e.currentTarget.setPointerCapture?.(e.pointerId);
                salta(e);
                mostrar();
              }}
              onPointerMove={(e) => { if (arrastra.current) salta(e); }}
              onPointerUp={() => { arrastra.current = false; }}
              onPointerCancel={() => { arrastra.current = false; }}
              style={{ flex: 1, height: 32, display: 'flex', alignItems: 'center', touchAction: 'none', cursor: 'pointer' }}
            >
              <div style={{ position: 'relative', width: '100%', height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.35)' }}>
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${progreso * 100}%`, borderRadius: 2, background: '#fff' }} />
                <div style={{
                  position: 'absolute', top: -3.5, width: 10, height: 10, borderRadius: '50%', background: '#fff',
                  left: `calc(${progreso * 100}% - 5px)`,
                }} />
              </div>
            </div>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#fff', minWidth: 30, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
              {mmss(tiempo - ini)}
            </span>
            <button type="button" onClick={pantallaCompleta} aria-label="Pantalla completa" style={boton}>
              <Maximize2 size={16} />
            </button>
          </div>
        </div>
      )}
    </>
  );
}
