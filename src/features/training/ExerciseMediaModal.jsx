import { X, ExternalLink, Dumbbell } from 'lucide-react';
import { T, FONT, KP } from '@/lib/theme';

/**
 * Ficha de un ejercicio del repertorio: foto de portada, video (archivo o
 * link externo), músculos y equipo. `exercise` es la fila de `exercises`;
 * `planEx` (opcional) es el ejercicio del plan para mostrar la dosis.
 */
export default function ExerciseMediaModal({ exercise, planEx, onClose }) {
  if (!exercise) return null;
  const muscles = [...(exercise.muscle_primary ?? []), ...(exercise.muscle_secondary ?? [])];

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

          {/* Video subido */}
          {exercise.video_url && (
            <video
              src={exercise.video_url}
              controls
              playsInline
              preload="metadata"
              style={{ width: '100%', borderRadius: 14, marginTop: 16, background: '#000' }}
            />
          )}

          {/* Link externo (YouTube, etc.) */}
          {exercise.video_link && (
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
