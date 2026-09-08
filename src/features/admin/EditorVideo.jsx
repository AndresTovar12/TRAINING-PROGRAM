import { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Play, Check, Loader2 } from 'lucide-react';
import { FONT, NUM_STYLE } from '@/lib/theme';

/**
 * El editor que aparece JUSTO DESPUÉS de elegir o grabar un video, antes de
 * subirlo. Como el de WhatsApp.
 *
 * POR QUÉ ESTE ORDEN, y no el que teníamos. Antes el video se subía primero y
 * el recorte aparecía después, como un control más dentro del formulario del
 * ejercicio. Andrés lo dijo claro: "me refería a que tengo que seleccionar el
 * video, luego que aparezca en el editor, y ya subirlo".
 *
 * Y no es solo estética. Recortando antes de subir:
 *   · decides sobre el video mirándolo entero, no sobre un campo de un formulario
 *   · si te arrepientes, no gastaste la subida
 *   · las miniaturas salen al instante, porque el archivo está en el teléfono
 *     y no hay que ir a buscarlo a Cloudflare
 *
 * QUÉ RECORTA Y QUÉ NO: el atleta ve solo el tramo marcado, pero el archivo se
 * sube entero. Cortarlo de verdad obligaría a recomprimir el video en el
 * navegador, y eso le baja la calidad — que es justo lo que Andrés dijo que
 * más le importa. Se ahorra atención, no espacio.
 */

const MINIATURAS = 8;

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

export default function EditorVideo({ archivo, url, tamaño, onCancelar, onListo, subiendo, avance }) {
  const videoRef = useRef(null);
  const barraRef = useRef(null);
  const [duracion, setDuracion] = useState(null);
  const [inicio, setInicio] = useState(null);
  const [fin, setFin] = useState(null);
  const [arrastrando, setArrastrando] = useState(null);
  const [reproduciendo, setReproduciendo] = useState(false);

  /* La dirección temporal del archivo del teléfono.
     Se calcula al vuelo y no con estado: guardarla en estado obligaba a
     escribir dentro de un efecto, que dispara un render de más por cada
     apertura del editor. El efecto de abajo solo la libera — si no, el
     navegador se queda con el video entero en memoria hasta recargar. */
  const local = useMemo(
    () => (archivo ? URL.createObjectURL(archivo) : (url ?? null)),
    [archivo, url],
  );
  useEffect(() => () => {
    if (archivo && local) URL.revokeObjectURL(local);
  }, [archivo, local]);

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

  /* Se dibuja colgado del <body> y no donde se le llama.
     MOTIVO, medido: el editor se abre desde dentro del modal del ejercicio, y
     ese modal lleva una animación de entrada que le deja un `transform`. Un
     ancestro con `transform` se convierte en el marco de referencia de
     cualquier `position: fixed` que tenga dentro — así que "pegado a la
     ventana" pasaba a ser "pegado al modal". El editor salía midiendo 1021 px
     en una pantalla de 812 y arrancando en top: -208, con la línea de tiempo y
     el botón de confirmar fuera de la vista.

     Colgándolo del body no hay ancestro que lo pueda secuestrar. */
  return createPortal((
    <div style={{
      position: 'fixed', inset: 0, zIndex: 6000, background: '#000',
      display: 'flex', flexDirection: 'column', fontFamily: FONT,
    }}>
      {/* ---------- Barra de arriba: salir y la línea de tiempo ---------- */}
      <div style={{ padding: 'calc(12px + env(safe-area-inset-top)) 16px 0', flexShrink: 0 }}>
        <button
          type="button" onClick={onCancelar} disabled={subiendo} aria-label="Cancelar"
          style={{
            width: 42, height: 42, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,.14)', color: '#fff', cursor: 'pointer',
            display: 'grid', placeItems: 'center', marginBottom: 16,
          }}
        >
          <X size={22} />
        </button>

        {duracion ? (
          <>
            {/* La línea de tiempo va ARRIBA, como en WhatsApp: es lo primero
                que tocas al abrir el editor, no un pie de página. */}
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

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
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
        )}
      </div>

      {/* ---------- El video ---------- */}
      <div style={{ flex: 1, position: 'relative', minHeight: 0, overflow: 'hidden' }}>
        <video
          ref={videoRef}
          src={local}
          playsInline
          preload="metadata"
          onLoadedMetadata={(e) => setDuracion(e.currentTarget.duration)}
          onPlay={() => setReproduciendo(true)}
          onPause={() => setReproduciendo(false)}
          onTimeUpdate={(e) => {
            // La vista previa respeta el recorte: ves justo lo que verá el atleta.
            const v = e.currentTarget;
            if (fin != null && v.currentTime >= fin) v.pause();
          }}
          /* Anclado a la caja en vez de centrado con `maxHeight: 100%`: dentro
             de un flex, ese porcentaje se mide contra un track que puede
             crecer, así que el video empujaba el botón de confirmar fuera de
             la pantalla. Con inset:0 + contain siempre cabe entero. */
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            objectFit: 'contain', display: 'block',
          }}
        />
        {!reproduciendo && (
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

      {/* ---------- Confirmar ---------- */}
      <div style={{
        flexShrink: 0, padding: '14px 16px calc(16px + env(safe-area-inset-bottom))',
        display: 'flex', alignItems: 'center', gap: 14,
      }}>
        <div style={{ flex: 1, minWidth: 0, color: 'rgba(255,255,255,.62)', fontSize: 12.5, fontWeight: 600 }}>
          {subiendo
            ? `Subiendo… ${avance ?? 0}%`
            : recortado
              ? `El atleta verá del ${seg(desde)} al ${seg(hasta)}`
              : 'Arrastra los bordes amarillos para quedarte solo con lo bueno'}
        </div>
        <button
          type="button"
          disabled={subiendo || !duracion}
          onClick={() => onListo({ inicio, fin })}
          aria-label="Usar este video"
          style={{
            width: 58, height: 58, borderRadius: '50%', border: 'none', flexShrink: 0,
            background: subiendo || !duracion ? 'rgba(255,255,255,.2)' : '#1E40E0',
            color: '#fff', cursor: subiendo || !duracion ? 'default' : 'pointer',
            display: 'grid', placeItems: 'center',
          }}
        >
          {subiendo ? <Loader2 size={26} className="spin" /> : <Check size={28} strokeWidth={2.6} />}
        </button>
      </div>
    </div>
  ), document.body);
}
