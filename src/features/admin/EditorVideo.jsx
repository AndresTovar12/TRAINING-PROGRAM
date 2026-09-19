import { useEffect, useRef, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import {
  X, Play, Check, Loader2, Volume2, VolumeX, Crop, Scissors,
} from 'lucide-react';
import { FONT, NUM_STYLE } from '@/lib/theme';
import { useRecorte, CapaRecorte, BotonesFormato } from '@/features/admin/recorte';

/**
 * El editor que aparece JUSTO DESPUÉS de elegir o grabar un video, antes de
 * subirlo. Como el de WhatsApp.
 *
 * POR QUÉ ESTE ORDEN, y no el que teníamos. Antes el video se subía primero y
 * el recorte aparecía después, como un control más dentro del formulario del
 * ejercicio. Andrés: "tengo que seleccionar el video, luego que aparezca en el
 * editor, y ya subirlo".
 *
 * Y no es solo estética. Recortando antes de subir:
 *   · decides mirando el video entero, no un campo de un formulario
 *   · si te arrepientes, no gastaste la subida
 *   · las miniaturas salen al instante, porque el archivo está en el teléfono
 *
 * QUÉ TOCA DEL ARCHIVO: nada. El tiempo, el encuadre y el audio se aplican al
 * REPRODUCIR. Cortar o reencodar el video en el navegador le bajaría la
 * calidad, que es lo que Andrés dijo que más le importa. Se guarda cómo
 * enseñarlo, no una copia peor.
 *
 * AQUÍ NO SE DECIDE PARA QUIÉN ES. Eso lo contesta el grupo desde el que se
 * tocó "Agregar" en la pantalla del ejercicio: Para todos, Hombres o Mujeres.
 * Ver `MediaDelEjercicio` para por qué acabó así.
 */

const MINIATURAS = 8;

const PASOS = [
  { id: 'tiempo', et: 'Recortar', icono: Scissors },
  { id: 'imagen', et: 'Encuadre', icono: Crop },
];

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

export default function EditorVideo({
  archivo, url, tamaño, onCancelar, onListo, subiendo, avance,
  // Lo que este video YA tenía guardado. Sin esto, reabrir el editor sobre
  // un video ya recortado arrancaba en cero, y confirmar borraba el recorte
  // anterior sin decir nada.
  ajustes,
}) {
  const videoRef = useRef(null);
  const barraRef = useRef(null);
  const marcoRef = useRef(null);

  const [duracion, setDuracion] = useState(null);
  const [medidas, setMedidas] = useState(null);   // { w, h } del video original
  const [inicio, setInicio] = useState(ajustes?.recorte_inicio ?? null);
  const [fin, setFin] = useState(ajustes?.recorte_fin ?? null);
  const [sinAudio, setSinAudio] = useState(!!ajustes?.sin_audio);
  const [paso, setPaso] = useState('tiempo');
  /* El encuadre es un rectángulo en fracciones de 0 a 1 del video; null = se ve
     entero. Las proporciones solo lo PRECARGAN: después se arrastra libre, que
     es lo que pidió Andrés. Vive en el módulo compartido porque el editor de
     foto usa exactamente el mismo, y teniéndolo aquí dentro los arreglos
     llegaban a una sola de las dos pantallas. */
  const { crop, setCrop, setAgarrado, rectanguloDe, recorteReal } = useRecorte({
    marcoRef, medidas, inicial: ajustes?.encuadre ?? null,
  });
  const [arrastrando, setArrastrando] = useState(null); // solo las manijas de tiempo
  const [reproduciendo, setReproduciendo] = useState(false);

  /* La dirección temporal del archivo del teléfono.
     SE CREA Y SE LIBERA DENTRO DEL MISMO EFECTO, a propósito. Antes se
     calculaba al vuelo y se liberaba en un efecto aparte, que parece
     equivalente y no lo es: React monta, desmonta y vuelve a montar cada
     pantalla para cazar errores, y en ese ida y vuelta la dirección se liberaba
     pero no se volvía a crear. El video quedaba sin cargar. Se vio primero en
     el editor de foto —un cuadro de 20 px, `naturalWidth` en 0— y este tenía el
     mismo fallo esperando: no salía porque lo estaba probando abriéndolo sobre
     un video ya subido, que usa `url` y no crea ninguna dirección temporal.
     Elegir un video del carrete sí pasa por aquí. */
  const [local, setLocal] = useState(url ?? null);
  useEffect(() => {
    if (!archivo) { setLocal(url ?? null); return undefined; }
    const u = URL.createObjectURL(archivo);
    setLocal(u);
    return () => URL.revokeObjectURL(u);
  }, [archivo, url]);

  const desde = inicio ?? 0;
  const hasta = fin ?? duracion ?? 0;
  const recortado = inicio != null || fin != null;

  const tiempoEnX = useCallback((clientX) => {
    const caja = barraRef.current?.getBoundingClientRect();
    if (!caja || !duracion) return 0;
    const p = Math.min(1, Math.max(0, (clientX - caja.left) / caja.width));
    return Math.round(p * duracion * 10) / 10;
  }, [duracion]);

  const mover = useCallback((e) => {
    if (!arrastrando || !duracion) return;
    const t = tiempoEnX(e.clientX);
    // Las manijas nunca se cruzan: siempre queda al menos medio segundo.
    if (arrastrando === 'inicio') setInicio(Math.min(t, hasta - 0.5));
    else setFin(Math.max(t, desde + 0.5));
    if (videoRef.current) videoRef.current.currentTime = t;
  }, [arrastrando, duracion, tiempoEnX, desde, hasta]);

  useEffect(() => {
    if (!arrastrando) return undefined;
    const suelta = () => setArrastrando(null);
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', suelta);
    window.addEventListener('pointercancel', suelta);
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', suelta);
      window.removeEventListener('pointercancel', suelta);
    };
  }, [arrastrando, mover]);

  if (!local) return null;

  const pct = (t) => (duracion ? `${(t / duracion) * 100}%` : '0%');
  const dura = Math.max(0, hasta - desde);

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
        position: 'absolute', top: -2, bottom: -2, zIndex: 2,
        left: cual === 'inicio' ? pct(desde) : undefined,
        right: cual === 'fin' ? `calc(100% - ${pct(hasta)})` : undefined,
        width: 20, marginLeft: cual === 'inicio' ? -10 : 0, marginRight: cual === 'fin' ? -10 : 0,
        background: '#F5C518', borderRadius: 5, cursor: 'ew-resize', touchAction: 'none',
        display: 'grid', placeItems: 'center',
      }}
    >
      <span style={{ width: 2, height: 13, background: 'rgba(0,0,0,.55)', borderRadius: 2 }} />
    </div>
  );

  const píldora = (activo) => ({
    minHeight: 40, padding: '0 15px', borderRadius: 999, cursor: 'pointer', flexShrink: 0,
    border: `1.5px solid ${activo ? '#fff' : 'rgba(255,255,255,.25)'}`,
    background: activo ? '#fff' : 'transparent',
    color: activo ? '#111318' : 'rgba(255,255,255,.85)',
    fontFamily: FONT, fontSize: 13.5, fontWeight: 700, whiteSpace: 'nowrap',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
  });


  return createPortal((
    <div style={{
      position: 'fixed', inset: 0, zIndex: 6000, background: '#000',
      display: 'flex', flexDirection: 'column', fontFamily: FONT,
    }}>
      {/* ---------- Salir, silenciar y confirmar ----------

           EL BOTÓN DE CONFIRMAR VIVE AQUÍ ARRIBA, no en una franja abajo.
           Medido a 375x812 cuando estaba abajo: el video ocupaba el 59% del
           alto y el 72% del ancho, y los adornos se comían 303 px de 812.
           Andrés: "¿te parece que las proporciones están bien?". No lo
           estaban. La franja de abajo costaba 88 px solo para un botón; subirlo
           aquí los devuelve enteros al video, que es lo único que hay que
           mirar. Es además lo que hace iOS: cancelar a la izquierda, listo a la
           derecha. */}
      <div style={{
        padding: 'calc(10px + env(safe-area-inset-top)) 14px 10px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button
          type="button" onClick={onCancelar} disabled={subiendo} aria-label="Cancelar"
          style={{
            width: 42, height: 42, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,.14)', color: '#fff', cursor: 'pointer',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}
        >
          <X size={22} />
        </button>

        {/* El audio va arriba y siempre visible: casi todos estos videos se
            graban en un gimnasio, con música del local y gente hablando. Nada
            de eso enseña nada, y al atleta le suena de golpe en los audífonos
            mientras entrena. */}
        <button
          type="button"
          onClick={() => setSinAudio((v) => !v)}
          aria-pressed={sinAudio}
          style={{
            minHeight: 42, padding: '0 15px', borderRadius: 999, border: 'none',
            background: sinAudio ? '#F5C518' : 'rgba(255,255,255,.14)',
            color: sinAudio ? '#111318' : '#fff', cursor: 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8, flexShrink: 0,
            fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
          }}
        >
          {sinAudio ? <VolumeX size={18} /> : <Volume2 size={18} />}
          {sinAudio ? 'Sin audio' : 'Con audio'}
        </button>

        <span style={{ flex: 1 }} />

        <button
          type="button"
          disabled={subiendo || !duracion}
          onClick={() => onListo({
            inicio, fin, sinAudio, encuadre: recorteReal,
          })}
          aria-label="Usar este video"
          style={{
            minHeight: 42, padding: '0 18px', borderRadius: 999, border: 'none', flexShrink: 0,
            background: subiendo || !duracion ? 'rgba(255,255,255,.2)' : '#1E40E0',
            color: '#fff', cursor: subiendo || !duracion ? 'default' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontFamily: FONT, fontSize: 14, fontWeight: 800,
          }}
        >
          {subiendo
            ? <><Loader2 size={17} className="spin" />{avance ?? 0}%</>
            : <><Check size={18} strokeWidth={3} />Listo</>}
        </button>
      </div>

      {/* ---------- El video ---------- */}
      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        display: 'grid', placeItems: 'center',
        /* Aire alrededor del video para poder agarrar las esquinas.
           Andrés: "la separación de los botones y la imagen es poquita". Las
           manijas sobresalen del marco, así que pegado al borde no hay dónde
           poner el dedo sin tocar el botón de abajo. */
        padding: '10px 18px 22px',
      }}>
        {/* El marco tiene EXACTAMENTE la proporción del video, así que el
            video lo llena sin franjas negras y las coordenadas del marco son
            las del video. Sin esto, recortar un video vertical dentro de una
            caja ancha calcularía el recorte sobre las franjas. */}
        <div
          ref={marcoRef}
          style={{
            position: 'relative', overflow: 'hidden', background: '#000',
            aspectRatio: medidas ? `${medidas.w} / ${medidas.h}` : '9 / 16',
            maxWidth: '100%', maxHeight: '100%',
          }}
        >
          <video
            ref={videoRef}
            src={local}
            playsInline
            muted={sinAudio}
            preload="metadata"
            onLoadedMetadata={(e) => {
              const v = e.currentTarget;
              setDuracion(v.duration);
              setMedidas({ w: v.videoWidth || 16, h: v.videoHeight || 9 });
            /* El salto de tiempo NO es un detalle: sin él, en Safari de
               iPhone el video se ve NEGRO hasta que se reproduce. iOS no pinta
               ningún fotograma con `preload="metadata"` — carga la duración y
               deja el lienzo vacío. Pedirle un `currentTime` lo obliga a
               dibujar ese fotograma. Andrés lo vio en su teléfono: las
               miniaturas de abajo salían (a esas ya se les hacía el salto) y
               el video de arriba era un rectángulo negro con el botón de play.
               En el navegador de escritorio no se reproduce el fallo. */
              v.currentTime = (ajustes?.recorte_inicio ?? 0) + 0.05;
            }}
            onPlay={() => setReproduciendo(true)}
            onPause={() => setReproduciendo(false)}
            onTimeUpdate={(e) => {
              // La vista previa respeta el recorte: ves justo lo que verá el atleta.
              const v = e.currentTarget;
              if (fin != null && v.currentTime >= fin) v.pause();
            }}
            style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
          />

          {paso === 'imagen' && <CapaRecorte crop={crop} onAgarrar={setAgarrado} />}

          {!reproduciendo && paso !== 'imagen' && (
            <button
              type="button"
              aria-label="Ver el video"
              onClick={() => {
                const v = videoRef.current;
                if (v) { v.currentTime = desde; v.play(); }
              }}
              style={{
                position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                border: 'none', background: 'transparent', cursor: 'pointer', padding: 0,
              }}
            >
              <span style={{
                width: 78, height: 78, borderRadius: '50%', display: 'grid', placeItems: 'center',
                background: 'rgba(220,220,220,.88)',
              }}>
                <Play size={32} color="#111318" fill="#111318" style={{ marginLeft: 4 }} />
              </span>
            </button>
          )}
        </div>
      </div>

      {/* ---------- Herramientas ---------- */}
      <div style={{ flexShrink: 0, padding: '0 16px' }}>
        {PASOS.length > 1 && (
          <div className="sin-barra" style={{ display: 'flex', gap: 8, marginBottom: 10, overflowX: 'auto' }}>
            {PASOS.map((p) => (
              <button
                key={p.id} type="button"
                onClick={() => {
                  setPaso(p.id);
                  /* Al entrar a "Encuadre" el marco aparece sobre el video
                     ENTERO, listo para agarrarlo por las esquinas. Antes solo
                     existía si primero elegías una proporción, así que "cortar
                     a mano" era imposible sin pasar por Vertical o Cuadrado —
                     justo lo contrario de lo que pidió Andrés.

                     Empezar cubriéndolo todo no significa recortar: al
                     confirmar, un marco que sigue cubriendo el video entero se
                     guarda como "sin encuadre". */
                  if (p.id === 'imagen' && !crop) setCrop({ x: 0, y: 0, w: 1, h: 1 });
                }}
                style={píldora(paso === p.id)}
              >
                <p.icono size={15} /> {p.et}
              </button>
            ))}
          </div>
        )}

        {paso === 'tiempo' && (duracion ? (
          <>
            <div
              ref={barraRef}
              style={{
                position: 'relative', height: 52, borderRadius: 6, background: '#15171C',
                display: 'flex', overflow: 'hidden', touchAction: 'none', userSelect: 'none',
              }}
            >
              {/* Miniaturas: el propio video congelado en varios puntos. No se
                  usa canvas a propósito — leer píxeles exige cabeceras de CORS
                  y los videos ya subidos vienen de Cloudflare, que no las
                  manda. Pedirle un `currentTime` a un <video> no lee píxeles. */}
              {Array.from({ length: MINIATURAS }, (_, i) => (
                <video
                  key={i} src={local} muted playsInline preload="metadata"
                  tabIndex={-1} aria-hidden="true"
                  onLoadedMetadata={(e) => {
                    const v = e.currentTarget;
                    v.currentTime = (v.duration / MINIATURAS) * i + v.duration / (MINIATURAS * 2);
                  }}
                  style={{
                    flex: 1, minWidth: 0, height: '100%', objectFit: 'cover',
                    display: 'block', pointerEvents: 'none',
                  }}
                />
              ))}
              <div style={{
                position: 'absolute', top: 0, bottom: 0, left: 0, width: pct(desde),
                background: 'rgba(0,0,0,.66)', pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', top: 0, bottom: 0, right: 0, width: `calc(100% - ${pct(hasta)})`,
                background: 'rgba(0,0,0,.66)', pointerEvents: 'none',
              }} />
              <div style={{
                position: 'absolute', top: 0, bottom: 0,
                left: pct(desde), right: `calc(100% - ${pct(hasta)})`,
                border: '2.5px solid #F5C518', borderRadius: 3, pointerEvents: 'none',
              }} />
              {manija('inicio')}
              {manija('fin')}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 11 }}>
              <span style={{
                background: 'rgba(255,255,255,.14)', color: '#fff', borderRadius: 8,
                padding: '6px 11px', fontSize: 13.5, fontWeight: 700, ...NUM_STYLE,
              }}>
                {seg(dura)}{tamaño ? ` · ${peso(tamaño)}` : ''}
              </span>
              {recortado && (
                <button
                  type="button"
                  onClick={() => { setInicio(null); setFin(null); }}
                  style={{
                    border: 'none', background: 'transparent', cursor: 'pointer',
                    color: 'rgba(255,255,255,.7)', fontFamily: FONT, fontSize: 13, fontWeight: 700,
                  }}
                >
                  Usar completo
                </button>
              )}
            </div>
          </>
        ) : (
          <div style={{ color: 'rgba(255,255,255,.6)', fontSize: 13, fontWeight: 600 }}>
            Leyendo el video…
          </div>
        ))}

        {paso === 'imagen' && (
          <BotonesFormato
            crop={crop} medidas={medidas} rectanguloDe={rectanguloDe} onElegir={setCrop}
          />
        )}

      </div>

      {/* El hueco de abajo es solo el de la barra del teléfono. Antes aquí
          había una franja de 88 px con un botón; ese botón subió arriba. */}
      <div style={{ flexShrink: 0, height: 'env(safe-area-inset-bottom)' }} />
    </div>
  ), document.body);
}
