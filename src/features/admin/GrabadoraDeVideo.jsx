import { useCallback, useEffect, useRef, useState } from 'react';
import { X, SwitchCamera, Loader2 } from 'lucide-react';
import { FONT, NUM_STYLE } from '@/lib/theme';

/**
 * Grabar el ejercicio DENTRO de la app, no con el atajo del navegador.
 *
 * POR QUÉ EXISTE. Andrés, 19 sep 2026: "la cámara que aparece cuando le pico a
 * grabar está como de pésima calidad, no es igual que la de mi teléfono
 * normal". Tenía razón, y no era cosa de esta app: el archivo se sube tal cual,
 * sin reencodar.
 *
 * La culpa era del camino. Un `<input type="file" accept="video/*" capture>`
 * le pide al teléfono que grabe, y iOS lo atiende con una calidad recortada
 * —está documentado desde iOS 9 y depende del ajuste "Grabar video" del propio
 * teléfono—. El navegador nunca dice a qué resolución va a grabar y la página
 * no puede pedirle otra: el atributo no acepta nada más.
 *
 * `getUserMedia` sí. Ahí la página PIDE la resolución, y Safari de iPhone
 * ofrece 720p, 1080p y 4K. Así que la grabación se hace aquí dentro, con la
 * resolución pedida a propósito y el ritmo de datos puesto a mano, y lo que
 * sale va al mismo editor de siempre.
 *
 * SI ALGO FALLA —no hay permiso, el navegador es viejo, la página no va por
 * https— NO se deja al coach sin grabar: `onSinCamara` devuelve el control a
 * quien lo abrió para que use el atajo de antes. Peor calidad, pero graba.
 */

/**
 * El mejor formato que sepa grabar este navegador, y su extensión.
 *
 * `conAudio` importa: un formato que DECLARA códec de audio y recibe un stream
 * sin micrófono puede grabar cero bytes sin quejarse. Pasó en la prueba, con
 * una cámara falsa que no traía audio, y en la vida real pasa igual si el
 * teléfono da la cámara pero no el micrófono.
 */
function mejorFormato(conAudio = true) {
  const candidatos = conAudio
    ? [
        { mime: 'video/mp4;codecs=avc1.4d002a,mp4a.40.2', base: 'video/mp4', ext: 'mp4' },
        { mime: 'video/mp4', base: 'video/mp4', ext: 'mp4' },
        { mime: 'video/webm;codecs=vp9,opus', base: 'video/webm', ext: 'webm' },
        { mime: 'video/webm;codecs=vp8,opus', base: 'video/webm', ext: 'webm' },
        { mime: 'video/webm', base: 'video/webm', ext: 'webm' },
      ]
    : [
        { mime: 'video/mp4;codecs=avc1.4d002a', base: 'video/mp4', ext: 'mp4' },
        { mime: 'video/mp4', base: 'video/mp4', ext: 'mp4' },
        { mime: 'video/webm;codecs=vp9', base: 'video/webm', ext: 'webm' },
        { mime: 'video/webm;codecs=vp8', base: 'video/webm', ext: 'webm' },
        { mime: 'video/webm', base: 'video/webm', ext: 'webm' },
      ];
  for (const c of candidatos) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.(c.mime)) return c;
  }
  return null;
}

/* Cuántos datos por segundo. Sin esto cada navegador pone lo suyo: Safari es
   generoso (≈10 Mbps en 1080p) y Chrome de Android tacaño (≈2,5), que se ve
   como un video pastoso aunque la resolución sea alta. */
function ritmo(alto) {
  if (alto >= 2000) return 20_000_000; // 4K
  if (alto >= 1000) return 8_000_000;  // 1080p
  if (alto >= 700) return 5_000_000;   // 720p
  return 2_500_000;
}

const reloj = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/**
 * ¿Este archivo tiene imagen de verdad? Se le pregunta al decodificador.
 *
 * SOLO SE RECHAZA CON PRUEBA EN CONTRA: que el decodificador se queje, o que
 * lea el archivo y diga que mide 0 × 0. Si no contesta a tiempo, se ACEPTA.
 *
 * El sentido de esa asimetría: el daño de los dos errores no es igual. Colar
 * un video roto se arregla borrándolo; rechazar los buenos deja al coach sin
 * poder grabar nunca y sin entender por qué. Y Safari de iPhone es conocido
 * por tardar en leer los metadatos de un blob sin que nadie haya tocado la
 * pantalla, que es exactamente esta situación.
 */
function tieneImagen(blob) {
  return new Promise((listo) => {
    const url = URL.createObjectURL(blob);
    const v = document.createElement('video');
    let contestado = false;
    const responde = (vale) => {
      if (contestado) return;
      contestado = true;
      URL.revokeObjectURL(url);
      listo(vale);
    };
    v.preload = 'metadata';
    v.muted = true;
    v.onloadedmetadata = () => responde(v.videoWidth > 0 && v.videoHeight > 0);
    v.onerror = () => responde(false);
    // Sin respuesta a tiempo NO es un fallo: es un no sé. Ante la duda, pasa.
    window.setTimeout(() => responde(true), 4000);
    v.src = url;
  });
}

export default function GrabadoraDeVideo({ onListo, onCancelar, onSinCamara }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const trozosRef = useRef([]);

  /* Los avisos al de fuera viven en una ref, NO en las dependencias del efecto
     que abre la cámara. Llegan como funciones escritas al vuelo, así que cada
     render del formulario trae unas nuevas: en las dependencias, eso reabría
     la cámara una y otra vez —y cada reapertura parpadea y pide permiso. */
  const avisos = useRef({ onListo, onSinCamara });
  useEffect(() => { avisos.current = { onListo, onSinCamara }; });

  const [lado, setLado] = useState('environment'); // 'environment' = la de atrás
  const [medidas, setMedidas] = useState(null);    // lo que el teléfono concedió
  const [grabando, setGrabando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [preparando, setPreparando] = useState(true);
  const [err, setErr] = useState('');

  /* Apagar la cámara de verdad. Si no se paran las pistas, el punto verde del
     teléfono se queda encendido aunque esta pantalla ya no esté. */
  const apaga = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  /* Cambiar de cámara reinicia la espera AQUÍ y no dentro del efecto: poner el
     estado nada más entrar al efecto dispara un render de más, y además el
     único momento en que hay que volver a esperar es justo este. */
  const cambiaDeLado = () => {
    setPreparando(true);
    setErr('');
    setLado((l) => (l === 'environment' ? 'user' : 'environment'));
  };

  useEffect(() => {
    let vivo = true;

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia || !mejorFormato()) {
        if (vivo) avisos.current.onSinCamara?.('Este navegador no sabe grabar por su cuenta.');
        return;
      }
      try {
        apaga();
        const stream = await navigator.mediaDevices.getUserMedia({
          /* `ideal` y no `exact`: si el teléfono no tiene 1080p, se queda con lo
             más cercano en vez de fallar y dejar al coach sin grabar. */
          video: {
            facingMode: { ideal: lado },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30 },
          },
          audio: true,
        });
        if (!vivo) { stream.getTracks().forEach((t) => t.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        const ajustes = stream.getVideoTracks()[0]?.getSettings() ?? {};
        if (ajustes.width && ajustes.height) setMedidas({ w: ajustes.width, h: ajustes.height });
        setPreparando(false);
      } catch (e) {
        if (!vivo) return;
        const negado = /NotAllowed|Permission/i.test(String(e?.name || e));
        if (negado) {
          setErr('No diste permiso para usar la cámara. Puedes darlo en los ajustes del navegador.');
          setPreparando(false);
        } else {
          avisos.current.onSinCamara?.('No se pudo abrir la cámara de la app.');
        }
      }
    })();

    return () => { vivo = false; };
  }, [lado, apaga]);

  useEffect(() => apaga, [apaga]);

  useEffect(() => {
    if (!grabando) return undefined;
    const t = window.setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [grabando]);

  function arranca() {
    const stream = streamRef.current;
    if (!stream) return;
    const formato = mejorFormato(stream.getAudioTracks().length > 0);
    if (!formato) { setErr('Este navegador no sabe grabar video.'); return; }

    trozosRef.current = [];
    const alto = medidas?.h ?? 1080;
    let rec;
    try {
      rec = new MediaRecorder(stream, { mimeType: formato.mime, videoBitsPerSecond: ritmo(alto) });
    } catch {
      setErr('Este navegador rechazó grabar en ese formato.');
      return;
    }

    rec.ondataavailable = (e) => { if (e.data?.size) trozosRef.current.push(e.data); };
    // Sin esto, un fallo a mitad de la grabación no se ve por ningún lado y el
    // coach se queda mirando el cronómetro correr sobre nada.
    rec.onerror = () => { setGrabando(false); setErr('Se cortó la grabación. Inténtalo otra vez.'); };
    rec.onstop = async () => {
      /* El tipo va SIN `;codecs=…`: el servidor compara contra una lista
         cerrada ('video/mp4', 'video/webm') y con la coletilla no coincide,
         así que la subida se rechazaría con "tipo no permitido". */
      const blob = new Blob(trozosRef.current, { type: formato.base });
      /* NUNCA entregar un archivo vacío. Si algo falló, lo que sale es un
         video de 0 bytes que sube sin protestar y luego no se reproduce: un
         ejercicio con su video roto es peor que uno sin video. */
      if (!blob.size) {
        setGrabando(false);
        setErr('No se grabó nada. Inténtalo otra vez, o usa la cámara del teléfono.');
        return;
      }
      /* Y NUNCA entregar un video que no se puede ver.
         Un archivo puede pesar, traer sus dos pistas y aun así no tener imagen
         decodificable: probando esto en el navegador de escritorio salió justo
         eso —pesaba 18 KB, duraba 4,2 s, sonaba, y medía 0 × 0—. Subirlo
         habría dejado un ejercicio con el video roto y sin forma de saberlo.
         Así que se comprueba aquí, y si no tiene imagen se devuelve al coach a
         la cámara del teléfono: peor calidad, pero un video que existe. */
      const sirve = await tieneImagen(blob);
      if (!sirve) {
        setGrabando(false);
        setErr('La grabación salió sin imagen. Se abrirá la cámara del teléfono.');
        apaga();
        window.setTimeout(() => avisos.current.onSinCamara?.(''), 1800);
        return;
      }
      apaga();
      avisos.current.onListo(new File([blob], `grabacion.${formato.ext}`, { type: formato.base }));
    };

    recRef.current = rec;
    setSegundos(0);
    try {
      rec.start(1000);
    } catch {
      setErr('No se pudo empezar a grabar.');
      return;
    }
    setGrabando(true);
  }

  function para() {
    setGrabando(false);
    recRef.current?.stop();
    recRef.current = null;
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 5000, background: '#000',
      display: 'flex', flexDirection: 'column', fontFamily: FONT,
    }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        /* Muteado a propósito: el micrófono SÍ se graba, pero sacarlo por la
           bocina mientras grabas es un acople instantáneo. */
        muted
        /* El respaldo de la medida. `getSettings()` de la pista no siempre trae
           ancho y alto —depende del navegador y de la fuente—, y el elemento de
           video sí los sabe en cuanto lee los metadatos. Sin esto, la etiqueta
           de "1080p" se quedaba en blanco justo cuando más sirve. */
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.videoWidth && v.videoHeight) setMedidas({ w: v.videoWidth, h: v.videoHeight });
        }}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />

      <div style={{
        position: 'absolute', top: 'calc(12px + env(safe-area-inset-top))', left: 12, right: 12,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button
          type="button"
          onClick={() => { apaga(); onCancelar(); }}
          aria-label="Cerrar la cámara"
          style={redondo}
        >
          <X size={20} color="#fff" />
        </button>

        {medidas?.h && (
          <span style={{
            padding: '6px 11px', borderRadius: 999, background: 'rgba(0,0,0,0.45)',
            backdropFilter: 'blur(6px)', color: '#fff', fontSize: 12.5, fontWeight: 800, ...NUM_STYLE,
          }}>
            {medidas.h >= 2000 ? '4K' : `${medidas.h}p`}
          </span>
        )}

        <span style={{ flex: 1 }} />

        {grabando ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '6px 12px',
            borderRadius: 999, background: 'rgba(242,85,90,0.92)', color: '#fff',
            fontSize: 13, fontWeight: 800, ...NUM_STYLE,
          }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#fff' }} />
            {reloj(segundos)}
          </span>
        ) : (
          <button
            type="button"
            onClick={cambiaDeLado}
            aria-label="Cambiar de cámara"
            style={redondo}
          >
            <SwitchCamera size={19} color="#fff" />
          </button>
        )}
      </div>

      {(preparando || err) && (
        <div style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          background: 'rgba(0,0,0,0.6)', padding: 24, textAlign: 'center',
          /* Si la cámara sigue viva, el aviso no debe robarle los toques al
             botón de grabar: se lee y se vuelve a intentar sin salir. */
          pointerEvents: err && !preparando ? 'none' : 'auto',
        }}>
          {err ? (
            <div style={{ maxWidth: 300, color: '#fff', pointerEvents: 'auto' }}>
              <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.5 }}>{err}</div>
              <button
                type="button"
                onClick={() => avisos.current.onSinCamara?.('')}
                style={{
                  marginTop: 16, minHeight: 46, padding: '0 18px', borderRadius: 13, border: 'none',
                  background: '#fff', color: '#111318', cursor: 'pointer',
                  fontFamily: FONT, fontSize: 14, fontWeight: 800,
                }}
              >
                Usar la cámara del teléfono
              </button>
            </div>
          ) : (
            <Loader2 size={30} color="#fff" className="spin" />
          )}
        </div>
      )}

      <div style={{
        position: 'absolute', left: 0, right: 0,
        bottom: 'calc(26px + env(safe-area-inset-bottom))',
        display: 'grid', placeItems: 'center', gap: 10,
      }}>
        <button
          type="button"
          onClick={grabando ? para : arranca}
          disabled={preparando || !!err}
          aria-label={grabando ? 'Parar de grabar' : 'Grabar'}
          style={{
            width: 78, height: 78, borderRadius: '50%', cursor: 'pointer',
            border: '5px solid rgba(255,255,255,0.85)', background: 'transparent',
            display: 'grid', placeItems: 'center', opacity: preparando || err ? 0.4 : 1,
          }}
        >
          <span style={{
            background: '#F2555A',
            width: grabando ? 28 : 58,
            height: grabando ? 28 : 58,
            borderRadius: grabando ? 7 : '50%',
            transition: 'all .18s',
          }} />
        </button>
        <span style={{ fontSize: 12.5, fontWeight: 600, color: 'rgba(255,255,255,0.75)' }}>
          {grabando ? 'Tócalo otra vez para terminar' : 'Tócalo para grabar'}
        </span>
      </div>
    </div>
  );
}

const redondo = {
  width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
  background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)',
  display: 'grid', placeItems: 'center', flexShrink: 0,
};
