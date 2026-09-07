import { useEffect, useMemo, useState } from 'react';
import {
  Plus, Search, X, Trash2, Loader2, Image as ImageIcon, Video, Dumbbell,
  Copy, RotateCcw, Pencil, ChevronRight,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { useIsWide } from '@/lib/useViewport';
import {
  listCategories, listExercises, createExercise, updateExercise, deleteExercise,
  getMasterId, tagRepertoire, duplicateExercise,
  listExerciseOverrides, saveExerciseOverride, deleteExerciseOverride, aplicarOverrides,
} from '@/lib/api';
import MediaUpload from '@/features/admin/MediaUpload';
import VideosDelEjercicio from '@/features/admin/VideosDelEjercicio';
import RecortarVideo from '@/features/admin/RecortarVideo';
import { MUSCLE_GROUPS, FINE_MUSCLES, exerciseMatchesGroup } from '@/lib/muscles';
import { T, FONT, KP } from '@/lib/theme';

const CAT_FALLBACK = {
  hipertrofia: '#1E40E0', atletico: '#00A372', potencia: '#FF7A52', pliometria: '#A480FF',
};
const catColor = (cat) => cat?.color || CAT_FALLBACK[cat?.slug] || T.text3;

function Chip({ children, color }) {
  return (
    <span
      style={{
        display: 'inline-flex', alignItems: 'center', fontSize: 11, fontWeight: 700,
        padding: '3px 8px', borderRadius: 7, background: `${color}18`, color,
      }}
    >
      {children}
    </span>
  );
}

function detectVideoKind(url) {
  if (!url) return null;
  if (/youtube\.com|youtu\.be/i.test(url)) return 'YouTube';
  if (/tiktok\.com/i.test(url)) return 'TikTok';
  if (/instagram\.com/i.test(url)) return 'Instagram';
  return 'Enlace';
}

function ExerciseCard({ ex, onClick, base }) {
  const color = catColor(ex.category);
  const hasVideo = ex.video_url || ex.video_link;
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        textAlign: 'left', border: `1px solid ${T.border}`, background: T.bg2, borderRadius: 20,
        overflow: 'hidden', cursor: 'pointer', fontFamily: FONT, padding: 0,
        boxShadow: KP.shCard, transition: 'box-shadow .18s, transform .12s cubic-bezier(0.22,1,0.36,1)',
        display: 'flex', flexDirection: 'column', alignItems: 'stretch', width: '100%',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = KP.shRaise; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = KP.shCard; e.currentTarget.style.transform = 'none'; }}
    >
      <div
        style={{
          height: 116, width: '100%', alignSelf: 'stretch',
          background: ex.cover_image_url ? `center/cover no-repeat url(${ex.cover_image_url})` : `${color}12`,
          display: 'grid', placeItems: 'center', position: 'relative',
        }}
      >
        {!ex.cover_image_url && <Dumbbell size={30} color={`${color}88`} />}
        {/* Ya no dice "cerrado con llave": el coach SÍ puede editarlo. Lo que
            importa ahora es distinguir el que él ya hizo suyo del que sigue
            como vino de fábrica. */}
        {(ex.esMiVersion || base) && (
          <span
            style={{
              position: 'absolute', top: 8, left: 8,
              background: ex.esMiVersion ? T.accent : 'rgba(17,19,24,0.72)', color: '#fff',
              borderRadius: 7, padding: '3px 8px', fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3,
              display: 'inline-flex', alignItems: 'center', gap: 4, backdropFilter: 'blur(4px)',
            }}
          >
            {ex.esMiVersion ? <><Pencil size={10} /> MI VERSIÓN</> : 'BASE'}
          </span>
        )}
        {hasVideo && (
          <span
            style={{
              position: 'absolute', top: 8, right: 8, background: 'rgba(17,19,24,0.75)', color: '#fff',
              borderRadius: 7, padding: '3px 7px', fontSize: 10.5, fontWeight: 700,
              display: 'inline-flex', alignItems: 'center', gap: 4,
            }}
          >
            <Video size={11} /> {ex.video_url ? 'Video' : detectVideoKind(ex.video_link)}
          </span>
        )}
      </div>
      <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: T.text, lineHeight: 1.25 }}>{ex.name}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Chip color={color}>{ex.category?.name || '—'}</Chip>
          {ex.equipment && <Chip color={T.text2}>{ex.equipment}</Chip>}
        </div>
        {ex.muscle_primary?.length > 0 && (
          <div style={{ fontSize: 12, color: T.text2, fontWeight: 500 }}>
            {ex.muscle_primary.join(' · ')}
          </div>
        )}
      </div>
    </button>
  );
}

function Input({ label, ...props }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>{label}</span>
      <input
        {...props}
        style={{
          border: `1.5px solid ${T.border}`, borderRadius: 11, padding: '11px 13px',
          fontFamily: FONT, fontSize: 14, fontWeight: 500, color: T.text, outline: 'none', background: T.bg2,
          ...props.style,
        }}
        onFocus={(e) => { e.target.style.borderColor = T.accent; }}
        onBlur={(e) => { e.target.style.borderColor = T.border; }}
      />
    </label>
  );
}


const empty = {
  name: '', category_id: '', equipment: '', description: '',
  muscle_primary: '', cover_image_url: '', video_url: '', video_link: '',
  // Tramo del video que ve el atleta. null = completo. No corta el archivo.
  recorte_inicio: null, recorte_fin: null,
};

// Lista desplegable de grupo muscular: primero los grupos (recomendado), luego
// el detalle fino ya usado en el repertorio; "➕ Otro…" permite escribir uno nuevo.
function MuscleSelect({ value, onChange, options }) {
  const groupLabels = useMemo(() => MUSCLE_GROUPS.map((g) => g.label), []);
  const fineOpts = useMemo(() => {
    const s = new Set([...(options || []), ...FINE_MUSCLES].filter(Boolean));
    if (value && value.trim()) s.add(value.trim());
    groupLabels.forEach((l) => s.delete(l)); // los grupos van en su propio bloque
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [options, value, groupLabels]);
  const [other, setOther] = useState(false);
  const selectStyle = {
    border: `1.5px solid ${T.border}`, borderRadius: 11, padding: '11px 13px',
    fontFamily: FONT, fontSize: 14, fontWeight: 600, color: T.text, background: T.bg2, outline: 'none', cursor: 'pointer',
  };
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>Grupo muscular</span>
      <select
        value={other ? '__other__' : (value || '')}
        onChange={(e) => {
          if (e.target.value === '__other__') { setOther(true); onChange(''); }
          else { setOther(false); onChange(e.target.value); }
        }}
        style={selectStyle}
      >
        <option value="">Selecciona…</option>
        <optgroup label="Grupos">
          {MUSCLE_GROUPS.map((g) => <option key={g.id} value={g.label}>{g.label}</option>)}
        </optgroup>
        {fineOpts.length > 0 && (
          <optgroup label="Detalle">
            {fineOpts.map((m) => <option key={m} value={m}>{m}</option>)}
          </optgroup>
        )}
        <option value="__other__">➕ Otro…</option>
      </select>
      {other && (
        <Input label="" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Escribe el grupo muscular" autoFocus />
      )}
    </label>
  );
}

/**
 * `esAjeno` = este ejercicio no es mío (es de la base del master) y yo no soy
 * el master. Entonces guardar NO modifica el original: crea mi versión, que
 * solo ven mis atletas. El original queda intacto y siempre se puede volver.
 */
/**
 * Un ejercicio en la lista del teléfono.
 *
 * POR QUE NO ES LA TARJETA GRANDE. Medido: la tarjeta con foto ocupa 221 px de
 * alto, y 116 de esos —el 53%— son el hueco de la imagen. Como 80 de 81
 * ejercicios no tienen foto, ese hueco casi siempre muestra un icono de
 * mancuerna sobre color plano. La lista entera medía 19.000 px: 24 pantallazos
 * para recorrerla.
 *
 * Con la fila caben 9 ejercicios por pantalla en vez de 2,5. La foto no se
 * pierde: se ve en 42 px, y en grande al abrir el ejercicio.
 *
 * En computadora se sigue usando la tarjeta: ahí caben cuatro por fila y el
 * espacio sobra, así que la foto grande sí se gana su lugar.
 */
function ExerciseRow({ ex, base, onAbrir, onMedia }) {
  const color = catColor(ex.category);
  const tieneVideo = !!(ex.video_url || ex.video_link);
  const tieneFoto = !!ex.cover_image_url;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 13,
      padding: '8px 9px', boxShadow: KP.shCard,
    }}>
      <button
        type="button"
        onClick={onAbrir}
        style={{
          flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10,
          background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
          fontFamily: FONT, textAlign: 'left', minHeight: 44,
        }}
      >
        <span style={{
          width: 44, height: 44, borderRadius: 10, flexShrink: 0,
          display: 'grid', placeItems: 'center',
          background: tieneFoto
            ? `center/cover no-repeat url(${ex.cover_image_url})`
            : `${color}14`,
        }}>
          {!tieneFoto && <Dumbbell size={19} color={`${color}AA`} />}
        </span>

        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{
            display: 'flex', alignItems: 'center', gap: 6,
            fontSize: 13.5, fontWeight: 700, color: T.text,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {ex.name}
            </span>
            {ex.esMiVersion && (
              <Pencil size={11} color={T.accent} style={{ flexShrink: 0 }} />
            )}
          </span>
          <span style={{
            display: 'block', fontSize: 11.5, color: T.text3, fontWeight: 600,
            marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {[ex.category?.name, ex.equipment, (ex.muscle_primary || []).join(' · ')]
              .filter(Boolean).join(' · ') || (base ? 'Base' : '—')}
          </span>
        </span>
      </button>

      {/* El que le falta video se marca en ámbar. Es la única forma de ver de un
          vistazo cuáles faltan sin abrirlos uno por uno. */}
      <button
        type="button"
        onClick={onMedia}
        aria-label={tieneVideo ? `Ver o cambiar el video de ${ex.name}` : `Falta video en ${ex.name}: grabarlo`}
        style={{
          width: 38, height: 38, borderRadius: 10, flexShrink: 0,
          display: 'grid', placeItems: 'center', cursor: 'pointer',
          border: `1px solid ${tieneVideo ? T.border : T.warning}`,
          background: tieneVideo ? T.bg2 : 'rgba(224,123,0,0.10)',
          color: tieneVideo ? T.text2 : T.warning,
        }}
      >
        <Video size={16} />
      </button>
    </div>
  );
}

/**
 * Al tocar un ejercicio en el teléfono no se abre la ficha completa: primero se
 * pregunta qué se va a hacer.
 *
 * Idea de Andrés. La razón por la que gana: los datos de los 81 ejercicios ya
 * están escritos y nadie los va a volver a tocar; lo que falta es la media, en
 * 80 de 81. Mandar la ficha completa por delante pone lo que nunca se hace
 * encima de lo único que se hace.
 */
function QueVasAHacer({ ejercicio, onMedia, onEditar, onCerrar }) {
  const opciones = [
    {
      icono: Video, principal: true, et: 'Grabar o subir',
      sub: 'Video, foto de portada, ángulos', al: onMedia,
    },
    {
      icono: Pencil, principal: false, et: 'Editar el ejercicio',
      sub: 'Nombre, categoría, equipo, notas', al: onEditar,
    },
  ];

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 2100, background: 'rgba(17,19,24,0.45)',
        display: 'flex', alignItems: 'flex-end', fontFamily: FONT,
      }}
    >
      <div className="animate-fade-in" style={{
        width: '100%', background: T.bg2, borderRadius: '20px 20px 0 0',
        padding: '16px 16px calc(16px + env(safe-area-inset-bottom))',
        boxShadow: KP.shPop,
      }}>
        <div style={{
          fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 3,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {ejercicio.name}
        </div>
        <div style={{ fontSize: 12, color: T.text3, fontWeight: 600, marginBottom: 14 }}>
          ¿Qué vas a hacer?
        </div>

        {opciones.map((o) => (
          <button
            key={o.et}
            type="button"
            onClick={o.al}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, width: '100%',
              minHeight: 60, padding: '12px 14px', borderRadius: 14, marginBottom: 9,
              cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
              border: o.principal ? 'none' : `1.5px solid ${T.border}`,
              background: o.principal ? T.accent : T.bg2,
              color: o.principal ? '#fff' : T.text,
            }}
          >
            <o.icono size={20} style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14.5, fontWeight: 800 }}>{o.et}</span>
              <span style={{
                display: 'block', fontSize: 11.5, fontWeight: 600, marginTop: 1,
                color: o.principal ? 'rgba(255,255,255,.78)' : T.text3,
              }}>
                {o.sub}
              </span>
            </span>
            <ChevronRight size={17} style={{ flexShrink: 0, opacity: .6 }} />
          </button>
        ))}

        <button
          type="button" onClick={onCerrar}
          style={{
            width: '100%', minHeight: 46, marginTop: 4, borderRadius: 13,
            border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: FONT, fontSize: 14, fontWeight: 700, color: T.text2,
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function ExerciseEditor({
  exercise, categories, muscleOptions = [], onClose, onSaved, onDeleted,
  esAjeno, onDuplicate, onGuardadaMiVersion, onRestaurada, foco = 'todo',
}) {
  // `foco='media'` abre la ficha directo en foto y video, sin los campos de
  // texto. Los datos de los 81 ejercicios ya están escritos; lo que falta es
  // la media. Guardar sigue guardando la ficha completa: los campos siguen
  // ahí en el estado, solo no se pintan.
  const [soloMedia, setSoloMedia] = useState(foco === 'media');
  const { user } = useAuth();
  const [dupBusy, setDupBusy] = useState(false);
  const [restaurando, setRestaurando] = useState(false);
  const [form, setForm] = useState(() =>
    exercise
      ? {
          name: exercise.name || '',
          category_id: exercise.category_id || '',
          equipment: exercise.equipment || '',
          description: exercise.description || '',
          muscle_primary: (exercise.muscle_primary || []).join(', '),
          cover_image_url: exercise.cover_image_url || '',
          video_url: exercise.video_url || '',
          video_link: exercise.video_link || '',
          recorte_inicio: exercise.recorte_inicio ?? null,
          recorte_fin: exercise.recorte_fin ?? null,
        }
      : { ...empty, category_id: categories[0]?.id || '' },
  );
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  async function onSave() {
    if (!form.name.trim()) { setErr('El nombre es obligatorio'); return; }
    if (!form.category_id) { setErr('Selecciona una categoría'); return; }
    setErr('');
    setBusy(true);
    const toArr = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
    const payload = {
      name: form.name.trim(),
      category_id: form.category_id,
      equipment: form.equipment.trim() || null,
      description: form.description.trim() || null,
      muscle_primary: toArr(form.muscle_primary),
      cover_image_url: form.cover_image_url || null,
      video_url: form.video_url || null,
      video_link: form.video_link.trim() || null,
      recorte_inicio: form.video_url ? form.recorte_inicio : null,
      recorte_fin: form.video_url ? form.recorte_fin : null,
    };
    try {
      // Ejercicio de otro (la base del master): se guarda MI versión aparte.
      // El id no cambia, así que los planes que ya lo usan la recogen solos.
      if (exercise && esAjeno) {
        await saveExerciseOverride(exercise.id, payload);
        onGuardadaMiVersion(exercise.id, payload);
        return;
      }
      const saved = exercise
        ? await updateExercise(exercise.id, payload)
        : await createExercise({ ...payload, created_by: user?.id ?? null });
      onSaved(saved);
    } catch (e) {
      setErr(e.message || 'Error al guardar');
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!exercise) return;
    if (!window.confirm(`¿Eliminar "${exercise.name}"? Esta acción no se puede deshacer.`)) return;
    setBusy(true);
    try {
      await deleteExercise(exercise.id);
      onDeleted(exercise.id);
    } catch (e) {
      setErr(e.message || 'Error al eliminar');
      setBusy(false);
    }
  }

  return (
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2000, background: 'rgba(17,19,24,0.45)',
        backdropFilter: 'blur(4px)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
        padding: '40px 16px', overflowY: 'auto',
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className="animate-fade-in"
        style={{
          width: '100%', maxWidth: 560, background: T.bg, borderRadius: 24, fontFamily: FONT,
          boxShadow: KP.shPop, overflow: 'hidden',
        }}
      >
        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '18px 22px', background: T.bg2, borderBottom: `1px solid ${T.border}`,
          }}
        >
          <div style={{ fontSize: 17, fontWeight: 800, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
            {!exercise ? 'Nuevo ejercicio'
              : esAjeno ? <><Pencil size={16} color={T.accent} /> Mi versión</>
              : 'Editar ejercicio'}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text2, padding: 4 }}
          >
            <X size={22} />
          </button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16 }}>
          {esAjeno && (
            <div style={{ background: T.accentBg, color: T.accent, borderRadius: 11, padding: '11px 14px', fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
              {exercise?.esMiVersion
                ? 'Esta es TU versión de un ejercicio base. Tus atletas ven esta. El original del sistema sigue guardado y puedes volver a él cuando quieras.'
                : 'Es un ejercicio base del sistema. Al guardar no lo cambias: creas TU versión, que solo ven tus atletas. El original queda intacto y puedes volver a él cuando quieras.'}
            </div>
          )}
          {!soloMedia && (
          <>
          <Input label="Nombre" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Ej. Back Squat" />

          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>Categoría</span>
            <select
              value={form.category_id}
              onChange={(e) => set('category_id', e.target.value)}
              style={{
                border: `1.5px solid ${T.border}`, borderRadius: 11, padding: '11px 13px',
                fontFamily: FONT, fontSize: 14, fontWeight: 600, color: T.text, background: T.bg2, outline: 'none',
              }}
            >
              {categories.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </label>

          <Input label="Equipo" value={form.equipment} onChange={(e) => set('equipment', e.target.value)} placeholder="Barra, Mancuerna, Peso corporal…" />

          <MuscleSelect value={form.muscle_primary} onChange={(v) => set('muscle_primary', v)} options={muscleOptions} />


          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>Notas / descripción</span>
            <textarea
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              rows={3}
              placeholder="Cues técnicos, tempo, observaciones…"
              style={{
                border: `1.5px solid ${T.border}`, borderRadius: 11, padding: '11px 13px',
                fontFamily: FONT, fontSize: 14, fontWeight: 500, color: T.text, outline: 'none',
                resize: 'vertical', background: T.bg2,
              }}
            />
          </label>
          </>
          )}

          {soloMedia && (
            <button
              type="button"
              onClick={() => setSoloMedia(false)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
                minHeight: 40, padding: '0 13px', borderRadius: 11, cursor: 'pointer',
                border: `1.5px solid ${T.border}`, background: T.bg2,
                fontFamily: FONT, fontSize: 13, fontWeight: 700, color: T.text2,
              }}
            >
              <Pencil size={14} /> Editar también los datos
            </button>
          )}

          {!soloMedia && <div style={{ height: 1, background: T.border }} />}

          <MediaUpload
            label="Foto de portada"
            icon={ImageIcon}
            value={form.cover_image_url}
            onChange={(v) => set('cover_image_url', v)}
            accept="image/*"
            kind="covers"
            hint="JPG o PNG. Se muestra como portada del ejercicio."
          />

          <MediaUpload
            label="Video (archivo)"
            icon={Video}
            value={form.video_url}
            onChange={(v) => set('video_url', v)}
            accept="video/*"
            kind="videos"
            hint="Sube un MP4, o usa el enlace de abajo si está en redes."
          />

          {form.video_url && (
            <RecortarVideo
              url={form.video_url}
              inicio={form.recorte_inicio}
              fin={form.recorte_fin}
              onCambio={({ inicio, fin }) => setForm((f) => ({
                ...f, recorte_inicio: inicio, recorte_fin: fin,
              }))}
            />
          )}

          <Input
            label="Enlace de video (TikTok / Instagram / YouTube)"
            value={form.video_link}
            onChange={(e) => set('video_link', e.target.value)}
            placeholder="https://…"
          />

          <div style={{ height: 1, background: T.border }} />

          <VideosDelEjercicio exerciseId={exercise?.id} />

          {err && (
            <div style={{ background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 11, padding: '11px 14px', fontSize: 13.5, fontWeight: 600 }}>
              {err}
            </div>
          )}
        </div>

        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: '16px 22px', background: T.bg2, borderTop: `1px solid ${T.border}`,
          }}
        >
          {esAjeno ? (
            /* Ejercicio de la base: a la izquierda se vuelve al original (solo
               si ya hay una versión propia que deshacer), a la derecha se
               guarda la mía. Duplicar sigue existiendo para quien quiera DOS
               variantes del mismo ejercicio en vez de reemplazar una. */
            <>
              {exercise?.esMiVersion ? (
                <button
                  type="button"
                  disabled={restaurando || busy}
                  onClick={async () => {
                    if (!window.confirm(`¿Volver al original de "${exercise.name}"? Se pierden los cambios que hiciste sobre él.`)) return;
                    setRestaurando(true);
                    try { await deleteExerciseOverride(exercise.id); onRestaurada(exercise.id); }
                    catch (e) { setErr(e.message || 'No se pudo restaurar'); setRestaurando(false); }
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 12,
                    border: `1.5px solid ${T.border}`, background: T.bg2, color: T.text2,
                    cursor: restaurando ? 'default' : 'pointer',
                    fontFamily: FONT, fontSize: 14, fontWeight: 700,
                  }}
                >
                  {restaurando ? <Loader2 size={16} className="spin" /> : <RotateCcw size={16} />} Restaurar original
                </button>
              ) : (
                <button
                  type="button"
                  disabled={dupBusy}
                  onClick={async () => {
                    setDupBusy(true);
                    try { const copy = await duplicateExercise(exercise); onDuplicate(copy); }
                    catch (e) { setErr(e.message || 'Error al duplicar'); setDupBusy(false); }
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 12,
                    border: `1.5px solid ${T.border}`, background: T.bg2, color: T.text2,
                    cursor: dupBusy ? 'default' : 'pointer',
                    fontFamily: FONT, fontSize: 14, fontWeight: 700,
                  }}
                >
                  {dupBusy ? <Loader2 size={16} className="spin" /> : <Copy size={16} />} Duplicar aparte
                </button>
              )}
              <button
                type="button"
                onClick={onSave}
                disabled={busy}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 12,
                  border: 'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
                  background: `linear-gradient(135deg, ${T.accent}, ${T.accentDk})`, color: '#fff',
                  fontFamily: FONT, fontSize: 14.5, fontWeight: 700, boxShadow: KP.shBtn,
                }}
              >
                {busy && <Loader2 size={16} className="spin" />}
                Guardar mi versión
              </button>
            </>
          ) : (
            <>
              {exercise ? (
                <button
                  type="button"
                  onClick={onDelete}
                  disabled={busy}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7, padding: '11px 16px', borderRadius: 12,
                    border: 'none', background: 'rgba(220,38,38,0.08)', color: T.danger, cursor: 'pointer',
                    fontFamily: FONT, fontSize: 14, fontWeight: 700,
                  }}
                >
                  <Trash2 size={16} /> Eliminar
                </button>
              ) : <span />}
              <button
                type="button"
                onClick={onSave}
                disabled={busy}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 12,
                  border: 'none', cursor: busy ? 'default' : 'pointer', opacity: busy ? 0.7 : 1,
                  background: `linear-gradient(135deg, ${T.accent}, ${T.accentDk})`, color: '#fff',
                  fontFamily: FONT, fontSize: 14.5, fontWeight: 700, boxShadow: KP.shBtn,
                }}
              >
                {busy && <Loader2 size={16} className="spin" />}
                {exercise ? 'Guardar cambios' : 'Crear ejercicio'}
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ExercisesPanel() {
  const { user, profile } = useAuth();
  const isMaster = !!profile?.is_owner;
  const [categories, setCategories] = useState([]);
  const [exercises, setExercises] = useState([]); // crudo (todos los visibles)
  const [masterId, setMasterId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [filter, setFilter] = useState('all');
  const [muscle, setMuscle] = useState('all');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // { exercise, esAjeno } | { new: true } | null
  // Mis versiones de los ejercicios base. Se aplican encima del repertorio.
  const [overrides, setOverrides] = useState([]);
  // En el teléfono, tocar un ejercicio pregunta primero qué se va a hacer.
  const [preguntando, setPreguntando] = useState(null);
  const esAncho = useIsWide();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cats, exs, mId, mias] = await Promise.all([
          listCategories(), listExercises(), getMasterId(), listExerciseOverrides(user?.id),
        ]);
        if (cancelled) return;
        setCategories(cats);
        setExercises(exs);
        setMasterId(mId);
        setOverrides(mias);
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Error al cargar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // Depende del usuario: mis versiones se piden POR coach, y en el primer
    // render la sesión todavía puede no estar lista. Sin esta dependencia el
    // repertorio cargaría sin mis versiones y nadie vería un error: se
    // mostrarían los ejercicios del master como si nunca los hubiera editado.
  }, [user?.id]);

  // Etiqueta base/propio y, para coaches, oculta el repertorio de otros coaches.
  // Encima van MIS versiones: si personalicé un ejercicio base, en mi lista
  // aparece como yo lo dejé, no como lo tiene el master.
  const visible = useMemo(() => {
    const conMisVersiones = aplicarOverrides(exercises, overrides, categories);
    const tagged = tagRepertoire(conMisVersiones, masterId, user?.id);
    if (isMaster) return tagged; // el master ve todo
    return tagged.filter((e) => e.isBase || e.isMine);
  }, [exercises, overrides, categories, masterId, user?.id, isMaster]);

  // Músculos finos presentes en el repertorio (para el detalle del editor)
  const muscles = useMemo(() => {
    const s = new Set();
    visible.forEach((e) => (e.muscle_primary || []).forEach((m) => m && s.add(m)));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [visible]);

  // Conteo por grupo muscular para el desplegable de filtro
  const groupCounts = useMemo(() => {
    const m = {};
    MUSCLE_GROUPS.forEach((g) => {
      m[g.id] = visible.filter((e) => exerciseMatchesGroup(e, g.id)).length;
    });
    return m;
  }, [visible]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visible.filter((e) => {
      if (filter !== 'all' && e.category?.slug !== filter) return false;
      if (muscle !== 'all' && !exerciseMatchesGroup(e, muscle)) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [visible, filter, muscle, search]);

  const counts = useMemo(() => {
    const m = { all: visible.length };
    for (const e of visible) {
      const s = e.category?.slug;
      if (s) m[s] = (m[s] || 0) + 1;
    }
    return m;
  }, [visible]);

  function handleDuplicate(copy) {
    setExercises((prev) => [...prev, copy]);
    setEditing({ exercise: copy, esAjeno: false }); // abre la copia para personalizar
  }

  function openExercise(ex, foco = 'todo') {
    // Un coach SÍ puede editar los ejercicios base, pero editarlos no cambia el
    // original: crea su propia versión. `esAjeno` es lo que dispara ese camino.
    setPreguntando(null);
    setEditing({ exercise: ex, esAjeno: !isMaster && ex.isBase, foco });
  }

  // Guardé mi versión de un ejercicio base: entra al mapa de versiones y la
  // lista se recalcula sola. El ejercicio original no se tocó.
  function handleMiVersion(exerciseId, data) {
    setOverrides((prev) => [
      ...prev.filter((o) => o.exercise_id !== exerciseId),
      { exercise_id: exerciseId, data },
    ]);
    setEditing(null);
  }

  // Volví al original: se quita mi versión y reaparece la del master.
  function handleRestaurada(exerciseId) {
    setOverrides((prev) => prev.filter((o) => o.exercise_id !== exerciseId));
    setEditing(null);
  }

  function handleSaved(saved) {
    setExercises((prev) => {
      const i = prev.findIndex((e) => e.id === saved.id);
      if (i === -1) return [...prev, saved].sort((a, b) => a.name.localeCompare(b.name));
      const copy = [...prev];
      copy[i] = saved;
      return copy;
    });
    setEditing(null);
  }

  function handleDeleted(id) {
    setExercises((prev) => prev.filter((e) => e.id !== id));
    setEditing(null);
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.text2, fontWeight: 600, padding: 40 }}>
        <Loader2 size={18} className="spin" /> Cargando repertorio…
      </div>
    );
  }

  return (
    <div>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div
          style={{
            flex: '1 1 240px', display: 'flex', alignItems: 'center', gap: 10, background: T.bg2,
            border: `1px solid ${T.border}`, borderRadius: 12, padding: '0 14px',
          }}
        >
          <Search size={17} color={T.text3} />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar ejercicio…"
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: 16, fontWeight: 500, color: T.text, padding: '12px 0' }}
          />
        </div>
        <button
          type="button"
          onClick={() => setEditing({ new: true })}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 18px', borderRadius: 12,
            border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${T.accent}, ${T.accentDk})`,
            color: '#fff', fontFamily: FONT, fontSize: 14.5, fontWeight: 700, boxShadow: KP.shBtn,
          }}
        >
          <Plus size={18} /> Añadir ejercicio
        </button>
      </div>

      {/* Filtros: categoría y grupo muscular (listas desplegables) */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 200px', minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6 }}>Categoría</span>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{ border: `1.5px solid ${T.border}`, borderRadius: 11, padding: '11px 13px', fontFamily: FONT, fontSize: 14, fontWeight: 600, color: T.text, background: T.bg2, outline: 'none', cursor: 'pointer' }}
          >
            <option value="all">Todas las categorías ({counts.all ?? 0})</option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug}>{c.name} ({counts[c.slug] ?? 0})</option>
            ))}
          </select>
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 200px', minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6 }}>Grupo muscular</span>
          <select
            value={muscle}
            onChange={(e) => setMuscle(e.target.value)}
            style={{ border: `1.5px solid ${T.border}`, borderRadius: 11, padding: '11px 13px', fontFamily: FONT, fontSize: 14, fontWeight: 600, color: T.text, background: T.bg2, outline: 'none', cursor: 'pointer' }}
          >
            <option value="all">Todos los grupos</option>
            {MUSCLE_GROUPS.filter((g) => groupCounts[g.id] > 0).map((g) => (
              <option key={g.id} value={g.id}>{g.label} ({groupCounts[g.id]})</option>
            ))}
          </select>
        </label>
      </div>

      {err && (
        <div style={{ background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 12, padding: '12px 16px', fontWeight: 600, marginBottom: 16 }}>
          {err}
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: T.text3 }}>
          <Dumbbell size={40} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 12, fontWeight: 600, color: T.text2 }}>Sin ejercicios para este filtro.</div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: esAncho ? 14 : 8,
            // En el teléfono la tarjeta con foto gastaba 116 px por ejercicio en
            // un hueco que 80 de 81 veces está vacío. En computadora caben
            // cuatro por fila y la foto grande sí se gana el espacio.
            // minmax(0, 1fr) y no '1fr' a secas: '1fr' equivale a minmax(auto, 1fr),
            // y ese `auto` deja que un nombre largo empuje la columna más allá de
            // la pantalla. Se desbordaba y el botón de grabar quedaba fuera.
            gridTemplateColumns: esAncho ? 'repeat(auto-fill, minmax(220px, 1fr))' : 'minmax(0, 1fr)',
          }}
        >
          {filtered.map((ex) => (esAncho ? (
            <ExerciseCard
              key={ex.id} ex={ex} base={!isMaster && ex.isBase}
              onClick={() => openExercise(ex)}
            />
          ) : (
            <ExerciseRow
              key={ex.id} ex={ex} base={!isMaster && ex.isBase}
              onAbrir={() => setPreguntando(ex)}
              onMedia={() => openExercise(ex, 'media')}
            />
          )))}
        </div>
      )}

      {preguntando && (
        <QueVasAHacer
          ejercicio={preguntando}
          onMedia={() => openExercise(preguntando, 'media')}
          onEditar={() => openExercise(preguntando, 'todo')}
          onCerrar={() => setPreguntando(null)}
        />
      )}

      {editing && (
        <ExerciseEditor
          /* `key` obliga a rearmar el formulario al cambiar de ejercicio. Sin
             esto, el estado inicial se calcula una sola vez y el formulario se
             quedaría con los datos del ejercicio anterior: se guardarían los
             campos de uno encima de otro sin que nada avisara. */
          key={editing.exercise?.id ?? 'nuevo'}
          exercise={editing.exercise || null}
          categories={categories}
          muscleOptions={muscles}
          esAjeno={!!editing.esAjeno}
          foco={editing.foco || 'todo'}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onDuplicate={handleDuplicate}
          onGuardadaMiVersion={handleMiVersion}
          onRestaurada={handleRestaurada}
        />
      )}

      <style>{`.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
