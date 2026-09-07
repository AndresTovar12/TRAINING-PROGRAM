import { useRef, useState } from 'react';
import { X, ExternalLink, Dumbbell } from 'lucide-react';
import { videosParaAtleta } from '@/lib/videos';
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
function VideoRecortado({ video }) {
  const ref = useRef(null);
  const { url, inicio, fin } = video;
  return (
    <video
      key={url}
      ref={ref}
      src={url}
      controls
      playsInline
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
      style={{ width: '100%', borderRadius: 14, marginTop: 12, background: '#000' }}
    />
  );
}

export default function ExerciseMediaModal({ exercise, planEx, medias = [], perfil, onClose }) {
  const videos = videosParaAtleta(exercise, medias, perfil);
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
          {exercise.cover_image_url ? (
            <img
              src={exercise.cover_image_url}
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
