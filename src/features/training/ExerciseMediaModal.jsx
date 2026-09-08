import { useRef, useState, useEffect } from 'react';
import { X, ExternalLink, Dumbbell, Timer } from 'lucide-react';
import { videosParaAtleta, portadaParaAtleta } from '@/lib/videos';
import { T, FONT, KP } from '@/lib/theme';

/**
 * Ficha de un ejercicio del repertorio: foto de portada, video (archivo o
 * link externo), músculos y equipo. `exercise` es la fila de `exercises`;
 * `planEx` (opcional) es el ejercicio del plan para mostrar la dosis.
 *
 * Un ejercicio puede tener VARIOS videos —de frente, de lado, la versión de su
 * género, o uno grabado solo para él— y aquí se eligen y se cambian. Cuál sale
 * primero lo decide `videosParaAtleta`; esta pantalla solo los pinta.
 */
/**
 * Reproduce un video respetando el tramo que eligió el coach.
 *
 * El archivo está completo: lo que se recorta es la reproducción. Arranca en
 * el segundo marcado y se detiene en el final marcado. Se hace con eventos y
 * no con `#t=inicio,fin` en la dirección porque Safari ignora el final, que
 * es justamente la mitad que importa.
 */
export function VideoRecortado({ video, estilo }) {
  const ref = useRef(null);
  const { url, inicio, fin, sinAudio, encuadre } = video;

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

  const video_ = (
    <video
      key={url}
      ref={ref}
      src={url}
      controls
      playsInline
      muted={!!sinAudio}
      preload="metadata"
      onLoadedMetadata={() => {
        if (ref.current && inicio != null) ref.current.currentTime = inicio;
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
      width: '100%', aspectRatio: `${encuadre.w} / ${encuadre.h}`,
      borderRadius: estilo ? 0 : 14, marginTop: estilo ? 0 : 12,
    }}>
      {video_}
    </div>
  );
}

export default function ExerciseMediaModal({ exercise, planEx, medias = [], perfil, onClose, registro }) {
  const videos = videosParaAtleta(exercise, medias, perfil);
  // La portada también puede estar personalizada para esta persona.
  const portada = portadaParaAtleta(exercise, medias, perfil);
  const [activo, setActivo] = useState(0);
  if (!exercise) return null;
  const muscles = [...(exercise.muscle_primary ?? []), ...(exercise.muscle_secondary ?? [])];
  const video = videos[activo] ?? videos[0] ?? null;

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 3000, background: 'rgba(17,19,24,0.55)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'center',
        justifyContent: 'center', padding: 16,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-fade-in"
        style={{
          width: '100%', maxWidth: 440, maxHeight: '90svh', overflowY: 'auto',
          background: T.bg, borderRadius: 22, fontFamily: FONT, boxShadow: KP.shPop,
          overflow: 'hidden auto',
        }}
      >
        {/* Portada */}
        <div style={{ position: 'relative', background: '#0E1015' }}>
          {portada ? (
            <img
              src={portada}
              alt={exercise.name}
              style={{ width: '100%', height: 230, objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <div style={{ height: 140, display: 'grid', placeItems: 'center', color: '#3A3F4C' }}>
              <Dumbbell size={44} />
            </div>
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            style={{
              position: 'absolute', top: 12, right: 12, width: 34, height: 34,
              borderRadius: 12, border: 'none', cursor: 'pointer',
              background: 'rgba(0,0,0,0.45)', color: '#fff',
              display: 'grid', placeItems: 'center', backdropFilter: 'blur(6px)',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div style={{ padding: 20 }}>
          <div style={{ fontSize: 19, fontWeight: 800, color: T.text, letterSpacing: -0.2 }}>
            {exercise.name}
          </div>
          {planEx && (planEx.sets || planEx.reps) && (
            <div style={{ fontSize: 13.5, color: T.text2, marginTop: 5, fontWeight: 600 }}>
              {[planEx.sets && `${planEx.sets} series`, planEx.reps && `${planEx.reps} reps`, planEx.intensity]
                .filter(Boolean).join(' · ')}
            </div>
          )}
          {exercise.description && (
            <div style={{ fontSize: 14, color: T.text2, marginTop: 12, lineHeight: 1.55 }}>
              {exercise.description}
            </div>
          )}

          {(muscles.length > 0 || exercise.equipment) && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
              {muscles.map((m) => (
                <span
                  key={m}
                  style={{
                    fontSize: 11.5, fontWeight: 700, color: T.accent, background: T.accentBg,
                    borderRadius: 8, padding: '4px 9px',
                  }}
                >
                  {m}
                </span>
              ))}
              {exercise.equipment && (
                <span
                  style={{
                    fontSize: 11.5, fontWeight: 700, color: T.text2, background: T.bg3,
                    borderRadius: 8, padding: '4px 9px',
                  }}
                >
                  {exercise.equipment}
                </span>
              )}
            </div>
          )}

          {/* Video. Si hay más de uno, arriba salen los ángulos disponibles. */}
          {video && (
            <>
              {videos.length > 1 && (
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginTop: 16 }}>
                  {videos.map((v, i) => (
                    <button
                      key={v.id}
                      type="button"
                      onClick={() => setActivo(i)}
                      style={{
                        padding: '7px 13px', borderRadius: 999, cursor: 'pointer',
                        border: `1.5px solid ${i === activo ? T.accent : T.border}`,
                        background: i === activo ? T.accentBg : T.bg2,
                        color: i === activo ? T.accent : T.text2,
                        fontFamily: FONT, fontSize: 12.5, fontWeight: 700,
                      }}
                    >
                      {v.etiqueta}
                    </button>
                  ))}
                </div>
              )}
              <VideoRecortado video={video} />
            </>
          )}

          {/* Lo que escribió el COACH sobre este ejercicio. Cada línea aparece
              solo si la puso: un bloque vacío con guiones se lee como un fallo
              de la app, no como "no hay nada que decir aquí". */}
          {registro?.notas && (
            <div style={{ fontSize: 14, color: T.text2, marginTop: 12, lineHeight: 1.55 }}>
              {registro.notas}
            </div>
          )}

          {registro?.cue && (
            <div style={{
              marginTop: 12, padding: '10px 13px', borderRadius: '0 9px 9px 0',
              background: `${T.warning}0D`, borderLeft: `2.5px solid ${T.warning}`,
              fontSize: 13, color: T.text2, lineHeight: 1.5,
            }}>
              <span style={{
                fontSize: 9.5, fontWeight: 800, letterSpacing: 0.6, color: T.warning,
                textTransform: 'uppercase', marginRight: 7,
              }}>Técnica</span>
              {registro.cue}
            </div>
          )}

          {registro?.descanso && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, marginTop: 12,
              fontSize: 13.5, color: T.text2, fontWeight: 600,
            }}>
              <Timer size={15} color={T.text3} style={{ flexShrink: 0 }} />
              Descansa {registro.descanso} entre series
            </div>
          )}

          {/* Registrar lo hecho, sin salir de aquí. Se guarda al instante: no
              hay botón de guardar porque no hay nada que confirmar. */}
          {registro?.conPeso && (
            <div style={{
              marginTop: 18, paddingTop: 16, borderTop: `1px solid ${T.border}`,
            }}>
              <div style={{
                fontSize: 11, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase',
                color: T.text3, marginBottom: 11,
              }}>
                Registra lo que hiciste
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                gap: 12, padding: '12px 14px', border: `1.5px solid ${T.border}`, borderRadius: 14,
              }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 800, color: T.text }}>
                    Peso <span style={{ color: T.text3, fontWeight: 600 }}>{registro.unidad}</span>
                  </div>
                  <div style={{ fontSize: 12, color: T.text3, fontWeight: 600, marginTop: 2 }}>
                    {registro.anterior
                      ? `La vez pasada: ${registro.anterior}`
                      : 'Primera vez que lo registras'}
                  </div>
                </div>
                {registro.control}
              </div>

              {registro.recomendado && (
                <div style={{
                  fontSize: 12.5, color: T.text3, fontWeight: 600, marginTop: 9, textAlign: 'center',
                }}>
                  Según tu 1RM te tocaría ≈ {registro.recomendado}
                </div>
              )}
            </div>
          )}

          {/* Link externo (YouTube, etc.) */}
          {exercise.video_link && video?.url !== exercise.video_link && (
            <a
              href={exercise.video_link}
              target="_blank"
              rel="noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                marginTop: 14, padding: '13px 16px', borderRadius: 13, textDecoration: 'none',
                background: `linear-gradient(135deg, ${T.accent}, ${T.accentDk})`,
                color: '#fff', fontWeight: 700, fontSize: 14.5, boxShadow: KP.shBtn,
              }}
            >
              <ExternalLink size={16} /> Ver video de técnica
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
