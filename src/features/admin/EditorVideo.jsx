import { useEffect, useLayoutEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Play, Check, Loader2, Volume2, VolumeX, Crop, RotateCcw, ChevronLeft, ChevronRight, Video,
} from 'lucide-react';
import IconoExplicacion from '@/components/IconoExplicacion';
import { FONT, NUM_STYLE } from '@/lib/theme';
import { capturaDeLaMitad } from '@/lib/fotogramas';
import PantallaDeEncuadre from '@/features/admin/PantallaDeEncuadre';
import { useCuerpoQuieto } from '@/lib/useCuerpoQuieto';
import { miniaturasDeVideo } from '@/lib/miniaturasDeVideo';

/**
 * El editor que aparece JUSTO DESPUÉS de elegir o grabar un video, antes de subirlo. Hecho a imagen del de WhatsApp.
 *
 * POR QUÉ ESTE ORDEN: primero se edita y luego se sube. Andrés: "tengo que seleccionar el video, luego que aparezca en el
 * editor, y ya subirlo". Recortando antes de subir decides mirando el video entero, si te arrepientes no gastaste la
 * subida y las miniaturas salen al instante, porque el archivo ya está en el teléfono.
 *
 * LA DISPOSICIÓN (Andrés, 9 oct 2026: «mira la diferencia de calidad entre el editor de WhatsApp y el nuestro… es mucho más
 * práctico y claro… quiero algo casi casi igualito, pero con nuestras herramientas»):
 *
 *   · ARRIBA, botones redondos translúcidos sobre el video: ✕ a la izquierda; a la derecha, «encuadre» (que abre su propia
 *     pantalla, ver `PantallaDeEncuadre`) y «restablecer» cuando hay algo cambiado.
 *   · LA TIRA DEL TIEMPO justo debajo: miniaturas con un marco negro y dos manijas con su flechita, una por extremo. Se
 *     arrastran para quedarte con un trozo.
 *   · Debajo de la tira: el sonido (altavoz), el chip «0:02 · 328 KB» y, a la derecha, el selector Ejemplo | Explicación
 *     (donde WhatsApp tiene Video | GIF).
 *   · EL VIDEO ocupa lo que queda, con su botón de reproducir grande en el centro. Se ve ya encuadrado, como lo verá el atleta.
 *   · ABAJO una franja negra: a la izquierda para qué ejercicio es, a la derecha el botón redondo de «listo».
 *
 * QUÉ TOCA DEL ARCHIVO: nada. El tiempo, el encuadre y el audio se aplican al REPRODUCIR. Cortar o reencodar el video en el
 * navegador le bajaría la calidad, que es lo que Andrés dijo que más le importa. Se guarda cómo enseñarlo, no una copia peor.
 *
 * AQUÍ NO SE DECIDE PARA QUIÉN ES. Eso lo contesta el grupo desde el que se tocó «Agregar» en la pantalla del ejercicio:
 * Para todos, Hombres o Mujeres. Ver `MediaDelEjercicio` para por qué acabó así.
 */

const MINIATURAS = 10;
// Lo que miden las manijas de la tira. El tiempo se mide sobre la tira SIN ellas, que van a los lados.
const MANIJA = 17;

/* Sin `backdrop-filter`: en iPhone, un desenfoque encima de un video que se reproduce parpadea y cuesta cuadros. */
const GRIS = 'rgba(58,58,60,.92)';

const seg = (s) => {
  if (s == null || Number.isNaN(s)) return '0:00';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${String(r).padStart(2, '0')}`;
};

const peso = (bytes) => {
  if (!bytes) return null;
  const mb = bytes / 1048576;
  return mb < 1 ? `${Math.round(bytes / 1024)} KB` : `${Math.round(mb * 10) / 10} MB`;
};

// El recuadro más grande con esa proporción que cabe en la caja.
function cabeEn(caja, aspecto) {
  if (!caja || !aspecto) return null;
  const ancho = Math.min(caja.w, caja.h * aspecto);
  return { w: Math.floor(ancho), h: Math.floor(ancho / aspecto) };
}

const redondo = (extra) => ({
  width: 40, height: 40, borderRadius: '50%', border: 'none', cursor: 'pointer', flexShrink: 0,
  background: GRIS, color: '#fff',
  display: 'grid', placeItems: 'center', touchAction: 'manipulation', ...extra,
});

export default function EditorVideo({
  archivo, url, tamaño, onCancelar, onListo, subiendo, avance,
  // Lo que este video YA tenía guardado. Sin esto, reabrir el editor sobre
  // un video ya recortado arrancaba en cero, y confirmar borraba el recorte
  // anterior sin decir nada.
  ajustes,
  // Qué es el video: 'ejemplo' o 'explicacion' (ver `lib/proposito.js`). Sin esta prop (reabrir un video ya guardado, donde
  // se cambia con la pastilla de su lista) no sale el selector ni se devuelve nada.
  proposito: propositoInicial,
  // Para quién o para qué ejercicio es: el «Yo» de WhatsApp, en la franja de abajo. Opcional.
  destino,
}) {
  const videoRef = useRef(null);
  const pistaRef = useRef(null);
  const escenaRef = useRef(null);

  const [duracion, setDuracion] = useState(null);
  const [medidas, setMedidas] = useState(null);   // { w, h } del video original
  const [inicio, setInicio] = useState(ajustes?.recorte_inicio ?? null);
  const [fin, setFin] = useState(ajustes?.recorte_fin ?? null);
  const [sinAudio, setSinAudio] = useState(!!ajustes?.sin_audio);
  // Lo decidió el botón que se tocó (o la pregunta); aquí solo se CORRIGE si el coach se equivocó de botón.
  const [queEs, setQueEs] = useState(propositoInicial === 'explicacion' ? 'explicacion' : 'ejemplo');
  /* El encuadre es un rectángulo en fracciones de 0 a 1 del video; null = se ve entero. Se arma en su propia pantalla. */
  const [encuadre, setEncuadre] = useState(ajustes?.encuadre ?? null);
  const [encuadrando, setEncuadrando] = useState(false);
  const [arrastrando, setArrastrando] = useState(null); // solo las manijas de tiempo
  const [reproduciendo, setReproduciendo] = useState(false);
  const [tiempo, setTiempo] = useState(0);
  const [caja, setCaja] = useState(null);
  /* El video se muestra cuando YA tiene su primer fotograma pintado. Antes se veía un cuadro negro con el botón de reproducir
     unos instantes antes de la imagen (Andrés, 9 oct 2026, con un video de su pantalla). Hasta entonces, el giro. */
  const [pintado, setPintado] = useState(false);

  /* La dirección temporal del archivo del teléfono.
     SE CREA Y SE LIBERA DENTRO DEL MISMO EFECTO, a propósito. Antes se
     calculaba al vuelo y se liberaba en un efecto aparte, que parece
     equivalente y no lo es: React monta, desmonta y vuelve a montar cada
     pantalla para cazar errores, y en ese ida y vuelta la dirección se liberaba
     pero no se volvía a crear. El video quedaba sin cargar. */
  const [local, setLocal] = useState(url ?? null);
  useEffect(() => {
    if (!archivo) { setLocal(url ?? null); return undefined; }
    const u = URL.createObjectURL(archivo);
    setLocal(u);
    return () => URL.revokeObjectURL(u);
  }, [archivo, url]);

  // El espacio que queda para el video: se mide ANTES de pintar (así el video no aparece un cuadro después), y se vuelve a
  // medir si la pantalla cambia. Su marco tiene EXACTAMENTE la proporción de lo que se va a ver.
  useLayoutEffect(() => {
    const el = escenaRef.current;
    if (!el) return undefined;
    const mide = () => { const r = el.getBoundingClientRect(); setCaja({ w: r.width, h: r.height }); };
    mide();
    const o = new ResizeObserver(mide);
    o.observe(el);
    return () => o.disconnect();
  }, []);

  /* LAS MINIATURAS DE LA TIRA, con un solo decodificador (ver `lib/miniaturasDeVideo.js`). `null` mientras se hacen (la
     tira va oscura), la lista de imágenes al terminar, o 'videos' si no se pudieron: entonces la tira de videos de antes. */
  const [minis, setMinis] = useState({ lista: [], fallo: false });
  useEffect(() => {
    if (!local) return undefined;
    let vivo = true;
    setMinis({ lista: [], fallo: false });
    miniaturasDeVideo(local, MINIATURAS, {
      remoto: !archivo,
      // Cada miniatura entra apenas está lista: la tira se llena de izquierda a derecha, sin esperar a las diez.
      alCadaUna: (i, src) => { if (vivo) setMinis((m) => { const lista = [...m.lista]; lista[i] = src; return { ...m, lista }; }); },
    }).catch(() => { if (vivo) setMinis((m) => ({ ...m, fallo: true })); });
    return () => { vivo = false; };
  }, [local, archivo]);
  // Mientras llegan, cada hueco se queda oscuro y se llena de izquierda a derecha: no se repite la primera en todos (así la
  // tira cambiaba de aspecto diez veces mientras se llenaba, y eso se leía como un parpadeo).

  // Por si el navegador nunca avisa que pintó: a los dos segundos de tener las medidas, se muestra de todos modos.
  useEffect(() => {
    if (pintado || !duracion) return undefined;
    const t = window.setTimeout(() => setPintado(true), 2000);
    return () => window.clearTimeout(t);
  }, [pintado, duracion]);

  // La página de atrás se queda quieta: un dedo que resbala sobre la tira no debe mover nada (ver `useCuerpoQuieto`).
  useCuerpoQuieto();

  const desde = inicio ?? 0;
  const hasta = fin ?? duracion ?? 0;
  const recortado = inicio != null || fin != null;
  const cambiado = recortado || !!encuadre || sinAudio;

  // Lo que el atleta va a ver: el video con su encuadre. Sin encuadre, el video entero.
  const aspecto = medidas
    ? (medidas.w * (encuadre?.w ?? 1)) / (medidas.h * (encuadre?.h ?? 1))
    : 9 / 16;
  const tamano = cabeEn(caja, aspecto);

  /* El tiempo que dice un dedo sobre la tira. La tira útil NO incluye las manijas (van a los lados), así que se mide
     contra la pista sin ellas. `ajuste` compensa que el dedo agarra la manija por su centro y no por el borde que marca. */
  /* El tiempo que dice un dedo sobre la tira. La tira útil NO incluye las manijas (van a los lados), así que se mide
     contra la pista sin ellas. `ajuste` compensa que el dedo agarra la manija por su centro y no por el borde que marca.
     SIN REDONDEAR A DÉCIMAS: con un video de 3 s eran 30 posiciones posibles, y la manija avanzaba a saltos de 10 px
     (Andrés, 9 oct 2026, con un video de su pantalla: «la barrita de arriba no es nada fluida»). Centésimas bastan. */
  const tiempoEnX = useCallback((clientX, ajuste = 0) => {
    const c = pistaRef.current?.getBoundingClientRect();
    if (!c || !duracion) return 0;
    const ancho = c.width - MANIJA * 2;
    const p = Math.min(1, Math.max(0, (clientX + ajuste - (c.left + MANIJA)) / ancho));
    return Math.round(p * duracion * 100) / 100;
  }, [duracion]);

  /* EL ARRASTRE VA A LA VELOCIDAD DE LA PANTALLA, Y EL VIDEO LO SIGUE COMO PUEDE. Cada movimiento del dedo guarda dónde va y
     se aplica una vez por cuadro de pantalla (no una vez por evento). Y el salto del video de la vista previa, que en un
     iPhone es lo caro (es decodificar 1080p en otro punto), no se pide mientras el anterior no termine: la manija nunca
     espera al video. Mientras se arrastra se usa `fastSeek` (al fotograma clave más cercano, casi gratis) y al soltar, el
     salto exacto. */
  const dedo = useRef(null);      // el último clientX del dedo
  const cuadro = useRef(null);    // el rAF pendiente
  const limites = useRef({ desde, hasta });
  limites.current = { desde, hasta };
  const buscado = useRef(null);   // un tiempo que se pidió mientras el video todavía saltaba

  const muestra = useCallback((t, exacto = false) => {
    const v = videoRef.current;
    if (!v || !Number.isFinite(t)) return;
    if (v.seeking && !exacto) { buscado.current = t; return; }
    buscado.current = null;
    if (!exacto && typeof v.fastSeek === 'function') v.fastSeek(t);
    else v.currentTime = t;
  }, []);

  const aplica = useCallback((cual, clientX, exacto = false) => {
    if (!duracion) return;
    const { desde: d, hasta: h } = limites.current;
    // Las manijas nunca se cruzan: siempre queda al menos medio segundo.
    if (cual === 'inicio') {
      const t = Math.max(0, Math.min(tiempoEnX(clientX, MANIJA / 2), h - 0.5));
      // Llevada al principio es «sin recorte», no «recorte desde 0»: así el botón de restablecer se apaga solo.
      setInicio(t <= 0.02 ? null : t);
      muestra(t, exacto);
    } else {
      const t = Math.min(duracion, Math.max(tiempoEnX(clientX, -MANIJA / 2), d + 0.5));
      setFin(t >= duracion - 0.02 ? null : t);
      muestra(t, exacto);
    }
  }, [duracion, tiempoEnX, muestra]);

  const mover = useCallback((e) => {
    if (!arrastrando) return;
    dedo.current = e.clientX;
    if (cuadro.current) return;
    cuadro.current = requestAnimationFrame(() => {
      cuadro.current = null;
      aplica(arrastrando, dedo.current);
    });
  }, [arrastrando, aplica]);

  const suelta = useCallback(() => {
    if (cuadro.current) { cancelAnimationFrame(cuadro.current); cuadro.current = null; }
    if (arrastrando && dedo.current !== null) aplica(arrastrando, dedo.current, true);
    dedo.current = null;
    setArrastrando(null);
  }, [arrastrando, aplica]);

  useEffect(() => {
    if (!arrastrando) return undefined;
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', suelta);
    window.addEventListener('pointercancel', suelta);
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', suelta);
      window.removeEventListener('pointercancel', suelta);
    };
  }, [arrastrando, mover, suelta]);

  // Un porcentaje del tiempo, dentro de la pista útil (la que queda entre las dos manijas de los extremos).
  const x = (t) => `calc((100% - ${MANIJA * 2}px) * ${duracion ? t / duracion : 0})`;
  const dura = Math.max(0, hasta - desde);

  const alternar = () => {
    const v = videoRef.current;
    if (!v) return;
    if (!v.paused) { v.pause(); return; }
    if (v.currentTime < desde || v.currentTime >= hasta - 0.05) v.currentTime = desde;
    v.play();
  };

  const restablecer = () => { setInicio(null); setFin(null); setEncuadre(null); setSinAudio(false); };

  const manija = (cual) => (
    <div
      role="slider"
      tabIndex={0}
      aria-label={cual === 'inicio' ? 'Dónde empieza' : 'Dónde termina'}
      aria-valuemin={0}
      aria-valuemax={duracion ?? 0}
      aria-valuenow={cual === 'inicio' ? desde : hasta}
      onPointerDown={(e) => { e.preventDefault(); setArrastrando(cual); }}
      onKeyDown={(e) => {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        e.preventDefault();
        const d = (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 1 : 0.2);
        if (cual === 'inicio') setInicio(Math.max(0, Math.min(desde + d, hasta - 0.5)));
        else setFin(Math.min(duracion, Math.max(hasta + d, desde + 0.5)));
      }}
      style={{
        position: 'absolute', top: 0, bottom: 0, width: MANIJA, zIndex: 3, cursor: 'ew-resize', touchAction: 'none',
        // La del inicio queda a la izquierda de su tiempo; la del final, a la derecha del suyo.
        left: cual === 'inicio' ? x(desde) : `calc(${MANIJA}px + ${x(hasta)})`,
        background: '#050505', color: '#fff', display: 'grid', placeItems: 'center',
        borderRadius: cual === 'inicio' ? '7px 0 0 7px' : '0 7px 7px 0',
      }}
    >
      {cual === 'inicio' ? <ChevronLeft size={15} strokeWidth={3.2} /> : <ChevronRight size={15} strokeWidth={3.2} />}
    </div>
  );

  return createPortal((
    <div style={{
      /* `100dvh` y no `inset: 0`: en iOS un `fixed` con `inset: 0` se mide contra el viewport de maqueta y la franja de abajo
         (con el botón de listo) quedaba debajo de la barra de Safari. Con el cuerpo quieto, `dvh` no se mueve. */
      position: 'fixed', top: 0, left: 0, right: 0, height: '100dvh', zIndex: 6000, background: '#000',
      display: 'flex', flexDirection: 'column', fontFamily: FONT, color: '#fff',
    }}>
      {/* El hueco de arriba es solo el de la barra de estado del teléfono, como en WhatsApp. */}
      <div style={{ flexShrink: 0, height: 'env(safe-area-inset-top)' }} />

      {/* ---------- El video, con todos los controles encima ---------- */}
      <div ref={escenaRef} style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden', background: '#0d0d0e' }}>
        <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center' }}>
          {tamano && local && (
            <div style={{ position: 'relative', width: tamano.w, height: tamano.h, overflow: 'hidden', background: '#000' }}>
              <video
                ref={videoRef}
                src={local}
                playsInline
                muted={sinAudio}
                // El archivo recién grabado está aquí mismo: se carga entero y la reproducción no se traba.
                preload={archivo ? 'auto' : 'metadata'}
                onLoadedMetadata={(e) => {
                  const v = e.currentTarget;
                  setDuracion(v.duration);
                  setMedidas({ w: v.videoWidth || 16, h: v.videoHeight || 9 });
                  /* El salto de tiempo NO es un detalle: sin él, en Safari de iPhone el video se ve NEGRO hasta que se
                     reproduce. iOS no pinta ningún fotograma con `preload="metadata"`: carga la duración y deja el lienzo
                     vacío. Pedirle un `currentTime` lo obliga a dibujar ese fotograma. */
                  v.currentTime = (ajustes?.recorte_inicio ?? 0) + 0.05;
                }}
                // Al llegar al punto pedido, el cuadro ya está listo; dos cuadros de pantalla de respiro y la tapa se desvanece.
                // (Se probó `requestVideoFrameCallback`: en un video quieto, después de un salto, ya pasó y no vuelve a avisar.)
                onSeeked={() => {
                  requestAnimationFrame(() => requestAnimationFrame(() => setPintado(true)));
                  // Si el dedo siguió moviéndose mientras el video saltaba, ahora se va a donde quedó.
                  if (buscado.current !== null) { const t = buscado.current; buscado.current = null; muestra(t); }
                }}
                onPlay={() => setReproduciendo(true)}
                onPause={() => setReproduciendo(false)}
                onTimeUpdate={(e) => {
                  // La vista previa respeta el recorte: ves justo lo que verá el atleta.
                  const v = e.currentTarget;
                  setTiempo(v.currentTime);
                  if (fin != null && v.currentTime >= fin) v.pause();
                }}
                // Con encuadre, el video se agranda y se corre para que solo se vea lo que queda dentro del marco.
                style={encuadre ? {
                  position: 'absolute', display: 'block', objectFit: 'fill',
                  width: `${100 / encuadre.w}%`, height: `${100 / encuadre.h}%`,
                  left: `${(-encuadre.x / encuadre.w) * 100}%`, top: `${(-encuadre.y / encuadre.h) * 100}%`,
                } : { width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
              />

              {/* Una tapa negra que se desvanece cuando el primer fotograma ya está pintado. Es una tapa y NO `opacity: 0` en el
                  video: un video sin opacidad no presenta cuadros en Safari, y el aviso de «pinté» no llegaba nunca. */}
              <div aria-hidden="true" style={{ position: 'absolute', inset: 0, background: '#000', opacity: pintado ? 0 : 1, transition: 'opacity .18s ease', pointerEvents: 'none' }} />

              {/* Tocar el video lo reproduce o lo pausa; el botón grande solo se ve con el video quieto. */}
              <button
                type="button" aria-label={reproduciendo ? 'Pausar el video' : 'Ver el video'} onClick={alternar}
                style={{
                  position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                  border: 'none', background: 'transparent', cursor: 'pointer', padding: 0, WebkitTapHighlightColor: 'transparent',
                }}
              >
                {!reproduciendo && pintado && (
                  <span style={{
                    width: 70, height: 70, borderRadius: '50%', display: 'grid', placeItems: 'center',
                    background: 'rgba(232,228,228,.9)', boxShadow: '0 4px 18px rgba(0,0,0,.25)',
                  }}>
                    <Play size={31} color="#3a3a3c" fill="#3a3a3c" style={{ marginLeft: 4 }} />
                  </span>
                )}
              </button>
            </div>
          )}
        </div>

        {!pintado && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
            <Loader2 size={30} color="rgba(255,255,255,.75)" className="spin" />
          </div>
        )}

        {/* ---------- Arriba: salir y las herramientas ---------- */}
        <div style={{
          position: 'absolute', top: 12, left: 14, right: 14, display: 'flex', alignItems: 'center', gap: 10, pointerEvents: 'none',
        }}>
          <button
            type="button" onClick={onCancelar} disabled={subiendo} aria-label="Cancelar"
            style={{ ...redondo(), pointerEvents: 'auto', opacity: subiendo ? 0.45 : 1 }}
          >
            <X size={23} />
          </button>
          <span style={{ flex: 1 }} />
          {cambiado && (
            <button
              type="button" onClick={restablecer} disabled={subiendo} aria-label="Quitar todos los cambios"
              style={{ ...redondo(), pointerEvents: 'auto' }}
            >
              <RotateCcw size={21} />
            </button>
          )}
          <button
            type="button" onClick={() => { videoRef.current?.pause(); setEncuadrando(true); }} disabled={subiendo || !medidas}
            aria-label="Encuadre"
            style={{ ...redondo(encuadre ? { background: '#fff', color: '#111318' } : null), pointerEvents: 'auto' }}
          >
            <Crop size={22} />
          </button>
        </div>

        {/* ---------- La tira del tiempo ---------- */}
        {/* En una pantalla ancha (la compu) la tira no se estira de lado a lado: se queda del ancho de un teléfono. */}
        <div style={{ position: 'absolute', top: 62, left: 16, right: 16, maxWidth: 560, margin: '0 auto', pointerEvents: 'none' }}>
          {duracion ? (
            <div
              ref={pistaRef}
              style={{
                position: 'relative', height: 40, borderRadius: 8, background: '#050505', pointerEvents: 'auto',
                padding: '3px 0', boxSizing: 'border-box', touchAction: 'none', userSelect: 'none',
              }}
            >
              {/* Miniaturas: el propio video congelado en varios puntos. No se usa canvas a propósito: leer píxeles exige
                  cabeceras de CORS y los videos ya subidos vienen de Cloudflare, que no las manda. Pedirle un
                  `currentTime` a un <video> no lee píxeles. */}
              <div style={{ position: 'absolute', top: 3, bottom: 3, left: MANIJA, right: MANIJA, display: 'flex', overflow: 'hidden', background: '#1a1a1c' }}>
                {!minis.fallo && Array.from({ length: MINIATURAS }, (_, i) => (minis.lista[i]
                  ? <img key={i} src={minis.lista[i]} alt="" draggable={false} style={{ flex: 1, minWidth: 0, height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }} />
                  : <span key={i} aria-hidden="true" style={{ flex: 1, minWidth: 0, height: '100%', background: '#1a1a1c', display: 'block' }} />))}
                {minis.fallo && Array.from({ length: MINIATURAS }, (_, i) => (
                  <video
                    key={i} src={local} muted playsInline preload="metadata"
                    tabIndex={-1} aria-hidden="true"
                    onLoadedMetadata={(e) => {
                      const v = e.currentTarget;
                      v.currentTime = (v.duration / MINIATURAS) * i + v.duration / (MINIATURAS * 2);
                    }}
                    style={{ flex: 1, minWidth: 0, height: '100%', objectFit: 'cover', display: 'block', pointerEvents: 'none' }}
                  />
                ))}
                {/* Lo que queda fuera del recorte se oscurece, no desaparece. */}
                <div style={{ position: 'absolute', top: 0, bottom: 0, left: 0, width: duracion ? `${(desde / duracion) * 100}%` : 0, background: 'rgba(0,0,0,.68)', pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: 0, bottom: 0, right: 0, width: duracion ? `${100 - (hasta / duracion) * 100}%` : 0, background: 'rgba(0,0,0,.68)', pointerEvents: 'none' }} />
                {/* Dónde va la reproducción. */}
                {(reproduciendo || tiempo > desde + 0.2) && tiempo <= hasta && (
                  <div style={{ position: 'absolute', top: 0, bottom: 0, left: `${(tiempo / duracion) * 100}%`, width: 2.5, marginLeft: -1, background: '#fff', borderRadius: 2, pointerEvents: 'none' }} />
                )}
              </div>
              {manija('inicio')}
              {manija('fin')}
            </div>
          ) : (
            <div style={{ height: 40 }} />
          )}

          {/* ---------- Sonido, duración y qué es ---------- */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 11, pointerEvents: 'none' }}>
            <button
              type="button" onClick={() => setSinAudio((v) => !v)} aria-pressed={sinAudio}
              aria-label={sinAudio ? 'Ponerle el sonido' : 'Quitarle el sonido'}
              /* Casi todos estos videos se graban en un gimnasio, con música del local y gente hablando. Nada de eso enseña
                 nada, y al atleta le suena de golpe en los audífonos mientras entrena: por eso está a la vista. */
              style={{
                height: 34, minWidth: 46, padding: '0 12px', borderRadius: 9, border: 'none', cursor: 'pointer', pointerEvents: 'auto',
                background: sinAudio ? '#F5C518' : GRIS, color: sinAudio ? '#111318' : '#fff',
                display: 'grid', placeItems: 'center',
              }}
            >
              {sinAudio ? <VolumeX size={21} /> : <Volume2 size={21} />}
            </button>
            <span style={{
              height: 34, padding: '0 13px', borderRadius: 9, background: GRIS, display: 'inline-flex', alignItems: 'center',
              fontSize: 15, fontWeight: 600, whiteSpace: 'nowrap', ...NUM_STYLE,
            }}>
              {duracion ? seg(dura) : '–:––'}{tamaño ? ` · ${peso(tamaño)}` : ''}
            </span>
            <span style={{ flex: 1 }} />
            {/* Dónde WhatsApp tiene «Video | GIF»: qué es este video. Una sola caja con las dos opciones a la vista; la
                activa lleva su nombre y la otra, solo su icono. */}
            {propositoInicial !== undefined && (
              <div role="group" aria-label="Qué es este video" style={{
                display: 'flex', height: 34, padding: 2, borderRadius: 17, background: GRIS, pointerEvents: 'auto',
              }}>
                {[['ejemplo', 'Ejemplo', Video], ['explicacion', 'Explicación', IconoExplicacion]].map(([id, texto, Icono]) => {
                  const activo = queEs === id;
                  return (
                    <button
                      key={id} type="button" onClick={() => setQueEs(id)} aria-pressed={activo} aria-label={texto} disabled={subiendo}
                      style={{
                        height: 30, minWidth: 38, padding: activo ? '0 12px 0 10px' : '0 9px', borderRadius: 15, border: 'none', cursor: 'pointer',
                        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontFamily: FONT,
                        fontSize: 13.5, fontWeight: 700,
                        background: activo ? '#e8e4e4' : 'transparent', color: activo ? '#1c1c1e' : 'rgba(255,255,255,.85)',
                      }}
                    >
                      <Icono size={19} />{activo ? texto : null}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ---------- Abajo: para qué es y listo ---------- */}
      <div style={{
        flexShrink: 0, background: '#000', display: 'flex', alignItems: 'center', gap: 12,
        padding: '9px 16px calc(11px + env(safe-area-inset-bottom))',
      }}>
        {destino ? (
          <span style={{
            maxWidth: '70%', padding: '8px 15px', borderRadius: 10, background: 'rgba(58,58,60,.7)',
            fontSize: 15, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {destino}
          </span>
        ) : null}
        <span style={{ flex: 1 }} />
        <button
          type="button"
          disabled={subiendo || !duracion}
          onClick={() => onListo({
            inicio, fin, sinAudio, encuadre,
            ...(propositoInicial !== undefined ? { proposito: queEs } : null),
            /* La FOTO del video, sacada ya mismo del video que se está viendo (solo cuando es un archivo recién elegido:
               uno ya subido viene de Cloudflare y esta pantalla no puede leer sus píxeles). Es una promesa que NUNCA
               falla —o trae la foto o trae null— y quien sube el video la espera al final, mientras sube. */
            fotogramas: archivo
              ? capturaDeLaMitad(videoRef.current, { duracion, inicio, fin })
              : undefined,
          })}
          aria-label="Usar este video"
          style={{
            width: 50, height: 50, borderRadius: '50%', border: 'none', flexShrink: 0, color: '#fff',
            background: subiendo || !duracion ? 'rgba(255,255,255,.2)' : '#1E40E0',
            cursor: subiendo || !duracion ? 'default' : 'pointer',
            display: 'grid', placeItems: 'center', fontFamily: FONT, fontSize: 13, fontWeight: 800,
          }}
        >
          {subiendo
            ? <span style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 1 }}><Loader2 size={18} className="spin" />{avance ?? 0}%</span>
            : <Check size={27} strokeWidth={3} />}
        </button>
      </div>

      {/* ---------- Encuadre: su propia pantalla ---------- */}
      {encuadrando && local && (
        <PantallaDeEncuadre
          medio={{ tipo: 'video', src: local }} medidas={medidas} inicial={encuadre} posicion={desde}
          onCancelar={() => setEncuadrando(false)}
          onListo={(recorte) => { setEncuadre(recorte); setEncuadrando(false); }}
        />
      )}
    </div>
  ), document.body);
}
