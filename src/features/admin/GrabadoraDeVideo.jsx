import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, SwitchCamera, Loader2, Mic, MicOff } from 'lucide-react';
import BotonEntendido from '@/components/BotonEntendido';
import { useAvisosVistos } from '@/lib/useAvisosVistos';
import { FONT, NUM_STYLE } from '@/lib/theme';
import { useCuerpoQuieto } from '@/lib/useCuerpoQuieto';

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

/* UN SOLO PERMISO, Y NADA QUE SE PIDA A MEDIO GRABAR.

   Andrés, 9 oct 2026 (segunda vuelta): «ahora me pidió DOS permisos… y cada vez que cierro y abro la app me vuelve a pedir
   los permisos de la cámara… y después de darle permiso como que glitchea».

   Lo que se aprendió:
   · Pedir la cámara al abrir y el micrófono al grabar son DOS preguntas. Pedidos juntos, iOS hace UNA («cámara y
     micrófono»). Así que si se va a grabar con sonido, se piden juntos al abrir.
   · Activar el micrófono con la vista previa ya corriendo es lo que «glitchea»: al prender el audio, iOS cambia la sesión de
     sonido del teléfono y Safari pausa los videos de la página, incluida la vista previa. Por eso el micrófono se decide ANTES
     de que arranque la vista previa, y durante la grabación no se pide nada más.
   · Un video de EJEMPLO (el ejercicio en el gimnasio, con música) arranca con el micrófono APAGADO: no se pide, y la música
     sigue (el micrófono es lo que la corta; la cámara sola no). Una EXPLICACIÓN (el coach hablando) arranca con el
     micrófono prendido. El botón de arriba lo cambia y se acuerda, por tipo de video.
   · CUÁNTAS VECES PREGUNTA SAFARI no depende de la app: pregunta una vez por cada carga de la página, salvo que la
     persona ponga «Permitir» en los ajustes del sitio. Por eso, la vez que pregunta, sale un aviso con el camino exacto.

   Y la cámara obtenida se GUARDA aquí, fuera del componente, un rato después de cerrar la pantalla: grabar otra vez enseguida
   (repetir, o el ejemplo y luego la explicación) es instantáneo y no vuelve a preguntar. */
const GRACIA_MS = 45_000;
let guardada = null;   // { stream, lado, reloj }
let pendiente = null;  // { lado, promesa }: una cámara que se está pidiendo ahora mismo
// Cuántas pantallas tienen la cámara reservada. Solo cuando ninguna la tiene empieza la cuenta para apagarla.
let usos = 0;
// Si en ESTA carga de la página el navegador ya preguntó por la cámara (y entonces va a preguntar en cada carga).
let pregunto = null;

const viva = (t) => t.readyState === 'live';
const estaViva = (stream) => !!stream && stream.getVideoTracks().some(viva);
const conMicro = (stream) => !!stream && stream.getAudioTracks().some(viva);

function apagaLaCamara() {
  if (!guardada) return;
  window.clearTimeout(guardada.reloj);
  guardada.stream.getTracks().forEach((t) => t.stop());
  guardada = null;
}

// Quita el micrófono de la cámara guardada: el teléfono le devuelve el sonido a quien lo tenía.
function sueltaElMicrofono() {
  if (!guardada) return;
  guardada.stream.getAudioTracks().forEach((t) => { t.stop(); guardada.stream.removeTrack(t); });
}

function reservaLaCamara() {
  usos += 1;
  if (guardada) { window.clearTimeout(guardada.reloj); guardada.reloj = null; }
}

// Una pantalla deja de usar la cámara: si ya nadie la usa, aguanta un rato por si se vuelve a grabar.
function sueltaLaCamara() {
  usos = Math.max(0, usos - 1);
  if (usos > 0 || !guardada) return;
  window.clearTimeout(guardada.reloj);
  guardada.reloj = window.setTimeout(apagaLaCamara, GRACIA_MS);
}

/* ¿Va a preguntar el navegador? Se mira antes de pedir (donde el navegador lo dice) y, si no lo dice, se deduce de lo que
   tardó la respuesta: un permiso ya dado contesta al instante; una pregunta en pantalla tarda lo que tarde el dedo. */
async function elNavegadorPregunta() {
  try {
    const r = await navigator.permissions?.query?.({ name: 'camera' });
    if (r?.state === 'granted') return false;
    if (r?.state === 'prompt') return true;
  } catch { /* este navegador no lo dice: se deduce del tiempo */ }
  return null;
}

const PEDIDO_DE_VIDEO = {
  /* `ideal` y no `exact`: si el teléfono no tiene 1080p, se queda con lo más cercano en vez de fallar y dejar al coach
     sin grabar. */
  facingMode: null, width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 30 },
};

async function pideAlNavegador(pedido) {
  const antes = performance.now();
  const sabe = pregunto === null ? await elNavegadorPregunta() : null;
  const stream = await navigator.mediaDevices.getUserMedia(pedido);
  if (pregunto === null) pregunto = sabe ?? (performance.now() - antes > 350);
  return stream;
}

/**
 * La cámara (y el micrófono, si `conAudio`), guardada o nueva. Si la guardada sirve pero le falta el micrófono, se le
 * agrega; si le sobra, se le quita. Dos pantallas que la piden a la vez comparten la misma petición.
 */
async function tomaLaCamara(lado, conAudio) {
  if (guardada && guardada.lado === lado && estaViva(guardada.stream)) {
    if (conAudio && !conMicro(guardada.stream)) {
      const micro = await navigator.mediaDevices.getUserMedia({ audio: true });
      micro.getAudioTracks().forEach((t) => guardada.stream.addTrack(t));
    } else if (!conAudio && conMicro(guardada.stream)) {
      sueltaElMicrofono();
    }
    return guardada.stream;
  }
  if (pendiente && pendiente.lado === lado) { await pendiente.promesa; return tomaLaCamara(lado, conAudio); }
  apagaLaCamara();
  const promesa = pideAlNavegador({ video: { ...PEDIDO_DE_VIDEO, facingMode: { ideal: lado } }, audio: conAudio })
    .then((nueva) => { guardada = { stream: nueva, lado, reloj: null }; return nueva; })
    .finally(() => { if (pendiente?.promesa === promesa) pendiente = null; });
  pendiente = { lado, promesa };
  return promesa;
}

// Con la app en el fondo no hay motivo para tener la cámara prendida: si estaba solo esperando, se apaga.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => { if (document.hidden && guardada?.reloj) apagaLaCamara(); });
}

const LLAVE_SONIDO = 'tl:grabar:sonido';
const CLAVE_DEL_AVISO = 'aviso:permiso-de-camara';
// Lo que se eligió para este tipo de video; sin elección, un ejemplo va sin micrófono y lo demás con él.
function leeSonido(proposito) {
  try {
    const v = window.localStorage.getItem(`${LLAVE_SONIDO}:${proposito ?? ''}`);
    if (v === 'si' || v === 'no') return v === 'si';
  } catch { /* sin almacenamiento */ }
  return proposito !== 'ejemplo';
}
const esAppDeInicio = () => typeof navigator !== 'undefined' && navigator.standalone === true;

/** `proposito`: 'ejemplo' o 'explicacion' (ver `lib/proposito.js`); decide si el micrófono arranca prendido. */
export default function GrabadoraDeVideo({ onListo, onCancelar, onSinCamara, proposito }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const recRef = useRef(null);
  const trozosRef = useRef([]);
  const { listo: avisosListos, visto, marcar } = useAvisosVistos();

  /* Los avisos al de fuera viven en una ref, NO en las dependencias del efecto que abre la cámara. Llegan como funciones
     escritas al vuelo, así que cada render del formulario trae unas nuevas: en las dependencias, eso reabría la cámara una y
     otra vez, y cada reapertura parpadea y pide permiso. */
  const avisos = useRef({ onListo, onSinCamara });
  useEffect(() => { avisos.current = { onListo, onSinCamara }; });

  const [lado, setLado] = useState('environment'); // 'environment' = la de atrás
  const [medidas, setMedidas] = useState(null);    // lo que el teléfono concedió
  const [grabando, setGrabando] = useState(false);
  const [segundos, setSegundos] = useState(0);
  const [preparando, setPreparando] = useState(true);
  /* LA VISTA PREVIA SE MUESTRA RECIÉN CUANDO YA ESTÁ A PANTALLA COMPLETA. Andrés, 9 oct 2026, con un video de su pantalla: al
     abrir la cámara, iOS enseña primero la imagen en una cajita chica en el centro (≈0,4 s) y de golpe la abre a pantalla
     completa. Eso se leía como un salto. El navegador ya dice «reproduciendo» mientras todavía está en la cajita, así que ese
     aviso no basta: se espera un respiro más y se entra con un fundido. Mientras tanto, negro liso y el giro. */
  const [reproduce, setReproduce] = useState(false); // el navegador ya dice que reproduce
  const [revelado, setRevelado] = useState(false);   // ya se ve a pantalla completa
  // Entre parar de grabar y que se abra el editor: un fondo liso y a propósito, no un negro con los botones de antes.
  const [procesando, setProcesando] = useState(false);
  const [err, setErr] = useState('');
  const [conSonido, setConSonido] = useState(() => leeSonido(proposito));
  const [aviso, setAviso] = useState('');
  const [preguntaCadaVez, setPreguntaCadaVez] = useState(false);

  // Esta pantalla tiene la cámara reservada mientras esté abierta; al cerrarla, queda guardada un rato.
  useEffect(() => { reservaLaCamara(); return sueltaLaCamara; }, []);

  const cambiaDeLado = () => {
    setPreparando(true);
    setReproduce(false);
    setRevelado(false);
    setErr('');
    setLado((l) => (l === 'environment' ? 'user' : 'environment'));
  };

  const cambiaSonido = () => {
    const nuevo = !conSonido;
    setConSonido(nuevo);
    setAviso('');
    try { window.localStorage.setItem(`${LLAVE_SONIDO}:${proposito ?? ''}`, nuevo ? 'si' : 'no'); } catch { /* sin almacenamiento */ }
  };

  // Si al prender el micrófono Safari pausó la vista previa, se vuelve a echar a andar.
  const reanudaVista = () => { videoRef.current?.play?.().catch(() => {}); };

  useEffect(() => {
    let vivo = true;
    (async () => {
      if (!navigator.mediaDevices?.getUserMedia || !mejorFormato()) {
        if (vivo) avisos.current.onSinCamara?.('Este navegador no sabe grabar por su cuenta.');
        return;
      }
      let stream;
      try {
        stream = await tomaLaCamara(lado, conSonido);
      } catch (e) {
        if (!vivo) return;
        const negado = /NotAllowed|Permission/i.test(String(e?.name || e));
        /* Sin permiso para el micrófono no se pierde la cámara: se vuelve a pedir sin él y se graba mudo. */
        if (negado && conSonido) {
          try {
            stream = await tomaLaCamara(lado, false);
            setConSonido(false);
            setAviso('Sin permiso para el micrófono: se graba sin sonido.');
          } catch { stream = null; }
        }
        if (!stream) {
          if (negado) {
            setErr('No diste permiso para usar la cámara. Puedes darlo en los ajustes del navegador.');
            setPreparando(false);
          } else {
            avisos.current.onSinCamara?.('No se pudo abrir la cámara de la app.');
          }
          return;
        }
      }
      if (!vivo) return;
      streamRef.current = stream;
      const v = videoRef.current;
      if (v && v.srcObject !== stream) v.srcObject = stream;
      reanudaVista();
      const ajustes = stream.getVideoTracks()[0]?.getSettings() ?? {};
      if (ajustes.width && ajustes.height) setMedidas({ w: ajustes.width, h: ajustes.height });
      setPreparando(false);
      if (pregunto) setPreguntaCadaVez(true);
    })();
    return () => { vivo = false; };
  }, [lado, conSonido]);

  // Se revela medio segundo después de que el navegador diga que reproduce (la cajita chica dura ≈0,4 s). Si nunca lo dice,
  // a los dos segundos y medio se revela de todos modos, para no dejar al coach mirando un giro.
  useEffect(() => {
    if (preparando || revelado) return undefined;
    const t = window.setTimeout(() => setRevelado(true), reproduce ? 520 : 2500);
    return () => window.clearTimeout(t);
  }, [preparando, reproduce, revelado]);

  // La página de atrás se queda quieta mientras la cámara está abierta (ver `useCuerpoQuieto`).
  useCuerpoQuieto();

  useEffect(() => {
    if (!grabando) return undefined;
    const t = window.setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => window.clearInterval(t);
  }, [grabando]);

  function arranca() {
    const stream = streamRef.current;
    if (!stream) return;
    setAviso('');
    // Nada se pide aquí: la cámara y el micrófono (si va) ya están desde que se abrió la pantalla.
    const formato = mejorFormato(conMicro(stream));
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
    // Sin esto, un fallo a mitad de la grabación no se ve por ningún lado y el coach se queda mirando el cronómetro.
    rec.onerror = () => { setGrabando(false); setProcesando(false); setErr('Se cortó la grabación. Inténtalo otra vez.'); };
    rec.onstop = async () => {
      /* El tipo va SIN `;codecs=…`: el servidor compara contra una lista cerrada ('video/mp4', 'video/webm') y con la
         coletilla no coincide. */
      const blob = new Blob(trozosRef.current, { type: formato.base });
      /* NUNCA entregar un archivo vacío: un video de 0 bytes sube sin protestar y luego no se reproduce. */
      if (!blob.size) {
        setGrabando(false);
        setProcesando(false);
        setErr('No se grabó nada. Inténtalo otra vez, o usa la cámara del teléfono.');
        return;
      }
      /* Y NUNCA entregar un video que no se puede ver (pesaba, sonaba, y medía 0 × 0: pasó). Si no tiene imagen se
         devuelve al coach a la cámara del teléfono: peor calidad, pero un video que existe. */
      const sirve = await tieneImagen(blob);
      if (!sirve) {
        setGrabando(false);
        setErr('La grabación salió sin imagen. Se abrirá la cámara del teléfono.');
        streamRef.current = null;
        apagaLaCamara();
        window.setTimeout(() => avisos.current.onSinCamara?.(''), 1800);
        return;
      }
      // Grabado: el micrófono se suelta ya (la música vuelve); la cámara queda guardada por si se repite.
      sueltaElMicrofono();
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
    setProcesando(true);
    recRef.current?.stop();
    recRef.current = null;
  }

  const cierra = () => {
    sueltaElMicrofono();
    streamRef.current = null;
    onCancelar();
  };

  const velo = preparando || !revelado || !!err;
  // Mientras se abre, solo la ✕ (para poder salir); el resto entra con un fundido junto con la imagen.
  const aparece = { opacity: revelado && !procesando ? 1 : 0, pointerEvents: revelado && !procesando ? 'auto' : 'none', transition: 'opacity .2s ease' };
  const avisoDePermiso = preguntaCadaVez && !grabando && avisosListos && !visto(CLAVE_DEL_AVISO);

  /* LA CÁMARA SE DIBUJA EN EL CUERPO DE LA PÁGINA (portal): así ningún antepasado con `transform` la encierra. Y mide
     `100dvh`, no `inset: 0`: en iOS un `fixed` con `inset: 0` se mide contra el viewport de maqueta y el botón de grabar
     quedaba debajo de la barra de Safari (Andrés, 24 sep 2026). */
  return createPortal(
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, height: '100dvh',
      zIndex: 5000, background: '#000',
      display: 'flex', flexDirection: 'column', fontFamily: FONT,
    }}>
      <video
        ref={videoRef}
        autoPlay
        playsInline
        /* Muteado a propósito: el micrófono SÍ se graba, pero sacarlo por la bocina mientras grabas es un acople. */
        muted
        onPlaying={() => setReproduce(true)}
        /* El respaldo de la medida: `getSettings()` no siempre trae ancho y alto, y el elemento sí los sabe. */
        onLoadedMetadata={(e) => {
          const v = e.currentTarget;
          if (v.videoWidth && v.videoHeight) setMedidas({ w: v.videoWidth, h: v.videoHeight });
        }}
        // Oculto hasta estar a pantalla completa, y entra con un fundido (ver `revelado`).
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: revelado ? 1 : 0, transition: 'opacity .2s ease' }}
      />

      <div style={{
        position: 'absolute', top: 'calc(12px + env(safe-area-inset-top))', left: 12, right: 12,
        display: 'flex', alignItems: 'center', gap: 10, zIndex: 2,
      }}>
        <button
          type="button" onClick={cierra} aria-label="Cerrar la cámara"
          style={{ ...redondo, opacity: procesando ? 0 : 1, pointerEvents: procesando ? 'none' : 'auto', transition: 'opacity .2s ease' }}
        >
          <X size={20} color="#fff" />
        </button>

        {medidas?.h && (
          <span style={{
            padding: '6px 11px', borderRadius: 999, background: 'rgba(0,0,0,0.5)',
            color: '#fff', fontSize: 12.5, fontWeight: 800, ...NUM_STYLE, ...aparece,
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
          <>
            {/* El micrófono. Apagado, el teléfono no toca el sonido y la música sigue. Se acuerda por tipo de video. */}
            <button
              type="button" onClick={cambiaSonido} aria-pressed={!conSonido}
              aria-label={conSonido ? 'Grabar sin sonido' : 'Grabar con sonido'}
              style={{ ...redondo, background: conSonido ? 'rgba(0,0,0,0.5)' : '#F5C518', ...aparece }}
            >
              {conSonido ? <Mic size={19} color="#fff" /> : <MicOff size={19} color="#111318" />}
            </button>
            <button type="button" onClick={cambiaDeLado} aria-label="Cambiar de cámara" style={{ ...redondo, ...aparece }}>
              <SwitchCamera size={19} color="#fff" />
            </button>
          </>
        )}
      </div>

      {velo && (
        <div style={{
          position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
          // Abriéndose: negro liso (nada de controles medio apagados debajo). Con un error la cámara sigue viva y se ve atrás.
          background: err ? 'rgba(0,0,0,0.6)' : '#000', padding: 24, textAlign: 'center',
          /* Si la cámara sigue viva, el aviso no debe robarle los toques al botón de grabar. */
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

      {/* Safari pregunta por la cámara en cada carga de la página, salvo que se le diga «Permitir» para este sitio. Es cosa
          del navegador, no de la app: lo único que puede hacer la app es decir dónde está ese ajuste, la vez que pasa. */}
      {avisoDePermiso && (
        <div style={{
          position: 'absolute', left: 14, right: 14, bottom: 'calc(132px + env(safe-area-inset-bottom))',
          background: 'rgba(30,64,224,0.94)', color: '#fff', borderRadius: 14,
          padding: '11px 12px 10px', fontSize: 13, fontWeight: 600, lineHeight: 1.4,
        }}>
          <b style={{ display: 'block', fontSize: 14, fontWeight: 800, marginBottom: 3 }}>¿Te pregunta cada vez?</b>
          {esAppDeInicio()
            ? 'Es iOS, no la app. Para que deje de preguntar: Ajustes del iPhone → Safari → Cámara y Micrófono → Permitir.'
            : 'Es Safari, no la app. Para que deje de preguntar: toca «AA» junto a la dirección → Ajustes del sitio web → Cámara y Micrófono → Permitir.'}
          <div style={{ marginTop: 8 }}>
            <BotonEntendido color="#1E40E0" onClick={() => marcar(CLAVE_DEL_AVISO)} style={{ minHeight: 0, padding: '5px 10px', borderRadius: 9, fontSize: 12.5 }} />
          </div>
        </div>
      )}

      <div style={{
        position: 'absolute', left: 0, right: 0,
        bottom: 'calc(26px + env(safe-area-inset-bottom))',
        display: 'grid', placeItems: 'center', gap: 10, zIndex: 2,
        // Con un error el botón sigue donde estaba (la cámara está viva); si no, entra junto con la imagen.
        ...(err ? null : aparece),
      }}>
        <button
          type="button"
          onClick={grabando ? para : arranca}
          disabled={velo}
          aria-label={grabando ? 'Parar de grabar' : 'Grabar'}
          style={{
            width: 78, height: 78, borderRadius: '50%', cursor: 'pointer',
            border: '5px solid rgba(255,255,255,0.85)', background: 'transparent',
            display: 'grid', placeItems: 'center', opacity: velo ? 0.4 : 1,
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
          {aviso || (grabando ? 'Tócalo otra vez para terminar' : (conSonido ? 'Tócalo para grabar' : 'Tócalo para grabar · sin sonido'))}
        </span>
      </div>

      {/* Recién parada la grabación, iOS apaga la vista previa un momento y reaparecían los botones de grabar. Se tapa con un
          fondo liso y un giro, a propósito, hasta que se abre el editor. */}
      {procesando && (
        <div style={{ position: 'absolute', inset: 0, zIndex: 3, background: '#000', display: 'grid', placeItems: 'center' }}>
          <Loader2 size={30} color="#fff" className="spin" />
        </div>
      )}
    </div>,
    document.body,
  );
}

/* Sin `backdrop-filter`: en iPhone, un desenfoque encima de un video en vivo parpadea y cuesta cuadros. */
const redondo = {
  width: 38, height: 38, borderRadius: '50%', border: 'none', cursor: 'pointer',
  background: 'rgba(0,0,0,0.5)',
  display: 'grid', placeItems: 'center', flexShrink: 0,
};
