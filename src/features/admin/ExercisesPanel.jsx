import { useEffect, useMemo, useState, useRef } from 'react';
import {
  Plus, Search, X, Trash2, Upload, Loader2, Image as ImageIcon, Video, Link2, Dumbbell,
  Copy, Lock,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  listCategories, listExercises, createExercise, updateExercise, deleteExercise,
  uploadExerciseMedia, getMasterId, tagRepertoire, duplicateExercise,
} from '@/lib/api';
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
        display: 'flex', flexDirection: 'column',
      }}
      onMouseEnter={(e) => { e.currentTarget.style.boxShadow = KP.shRaise; e.currentTarget.style.transform = 'translateY(-2px)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.boxShadow = KP.shCard; e.currentTarget.style.transform = 'none'; }}
    >
      <div
        style={{
          height: 116, background: ex.cover_image_url ? `center/cover no-repeat url(${ex.cover_image_url})` : `${color}12`,
          display: 'grid', placeItems: 'center', position: 'relative',
        }}
      >
        {!ex.cover_image_url && <Dumbbell size={30} color={`${color}88`} />}
        {base && (
          <span
            style={{
              position: 'absolute', top: 8, left: 8, background: 'rgba(17,19,24,0.72)', color: '#fff',
              borderRadius: 7, padding: '3px 8px', fontSize: 10.5, fontWeight: 800, letterSpacing: 0.3,
              display: 'inline-flex', alignItems: 'center', gap: 4, backdropFilter: 'blur(4px)',
            }}
          >
            <Lock size={10} /> BASE
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

function MediaUpload({ label, icon: Icon, value, onChange, accept, kind, hint }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const inputRef = useRef(null);

  async function onPick(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      const url = await uploadExerciseMedia(file, kind);
      onChange(url);
    } catch (e2) {
      setErr(e2.message || 'Error al subir');
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>{label}</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 14px',
            borderRadius: 11, border: `1.5px solid ${T.border}`, background: T.bg2, cursor: 'pointer',
            fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: T.text, whiteSpace: 'nowrap',
          }}
        >
          {busy ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
          Subir archivo
        </button>
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '10px 12px',
              borderRadius: 11, border: 'none', background: 'rgba(220,38,38,0.08)', cursor: 'pointer',
              fontFamily: FONT, fontSize: 13, fontWeight: 700, color: T.danger,
            }}
          >
            <X size={14} /> Quitar
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} onChange={onPick} style={{ display: 'none' }} />
      {hint && <div style={{ fontSize: 11.5, color: T.text3 }}>{hint}</div>}
      {err && <div style={{ fontSize: 12, color: T.danger, fontWeight: 600 }}>{err}</div>}
      {value && (
        <div
          style={{
            display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, color: T.text2,
            background: T.bg, borderRadius: 9, padding: '8px 10px', wordBreak: 'break-all',
          }}
        >
          <Icon size={14} style={{ flexShrink: 0 }} /> {value}
        </div>
      )}
    </div>
  );
}

const empty = {
  name: '', category_id: '', equipment: '', description: '',
  muscle_primary: '', muscle_secondary: '', cover_image_url: '', video_url: '', video_link: '',
};

function ExerciseEditor({ exercise, categories, onClose, onSaved, onDeleted, readOnly, onDuplicate }) {
  const { user } = useAuth();
  const [dupBusy, setDupBusy] = useState(false);
  const [form, setForm] = useState(() =>
    exercise
      ? {
          name: exercise.name || '',
          category_id: exercise.category_id || '',
          equipment: exercise.equipment || '',
          description: exercise.description || '',
          muscle_primary: (exercise.muscle_primary || []).join(', '),
          muscle_secondary: (exercise.muscle_secondary || []).join(', '),
          cover_image_url: exercise.cover_image_url || '',
          video_url: exercise.video_url || '',
          video_link: exercise.video_link || '',
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
      muscle_secondary: toArr(form.muscle_secondary),
      cover_image_url: form.cover_image_url || null,
      video_url: form.video_url || null,
      video_link: form.video_link.trim() || null,
    };
    try {
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
            {readOnly ? <><Lock size={16} color={T.text2} /> Ejercicio base</> : exercise ? 'Editar ejercicio' : 'Nuevo ejercicio'}
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text2, padding: 4 }}
          >
            <X size={22} />
          </button>
        </div>

        <div style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 16, pointerEvents: readOnly ? 'none' : 'auto', opacity: readOnly ? 0.75 : 1 }}>
          {readOnly && (
            <div style={{ background: T.accentBg, color: T.accent, borderRadius: 11, padding: '11px 14px', fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
              Este es un ejercicio base (del sistema). No puedes editarlo, pero puedes duplicarlo a tu repertorio para personalizar foto, video y datos a tu manera.
            </div>
          )}
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

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Input label="Músculos primarios" value={form.muscle_primary} onChange={(e) => set('muscle_primary', e.target.value)} placeholder="Cuádriceps, Glúteo" />
            <Input label="Músculos secundarios" value={form.muscle_secondary} onChange={(e) => set('muscle_secondary', e.target.value)} placeholder="Core" />
          </div>

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

          <div style={{ height: 1, background: T.border }} />

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

          <Input
            label="Enlace de video (TikTok / Instagram / YouTube)"
            value={form.video_link}
            onChange={(e) => set('video_link', e.target.value)}
            placeholder="https://…"
          />

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
          {readOnly ? (
            <>
              <button
                type="button" onClick={onClose}
                style={{ padding: '11px 16px', borderRadius: 12, border: `1.5px solid ${T.border}`, background: T.bg2, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, color: T.text2 }}
              >
                Cerrar
              </button>
              <button
                type="button"
                disabled={dupBusy}
                onClick={async () => {
                  setDupBusy(true);
                  try { const copy = await duplicateExercise(exercise); onDuplicate(copy); }
                  catch (e) { setErr(e.message || 'Error al duplicar'); setDupBusy(false); }
                }}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 22px', borderRadius: 12,
                  border: 'none', cursor: dupBusy ? 'default' : 'pointer', opacity: dupBusy ? 0.7 : 1,
                  background: `linear-gradient(135deg, ${T.accent}, ${T.accentDk})`, color: '#fff',
                  fontFamily: FONT, fontSize: 14.5, fontWeight: 700, boxShadow: KP.shBtn,
                }}
              >
                {dupBusy ? <Loader2 size={16} className="spin" /> : <Copy size={16} />} Duplicar a mi repertorio
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
  const [origin, setOrigin] = useState('all'); // all | mine | base (solo coaches)
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState(null); // { exercise, readOnly } | { new: true } | null

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cats, exs, mId] = await Promise.all([listCategories(), listExercises(), getMasterId()]);
        if (cancelled) return;
        setCategories(cats);
        setExercises(exs);
        setMasterId(mId);
      } catch (e) {
        if (!cancelled) setErr(e.message || 'Error al cargar');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Etiqueta base/propio y, para coaches, oculta el repertorio de otros coaches.
  const visible = useMemo(() => {
    const tagged = tagRepertoire(exercises, masterId, user?.id);
    if (isMaster) return tagged; // el master ve todo
    return tagged.filter((e) => e.isBase || e.isMine);
  }, [exercises, masterId, user?.id, isMaster]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return visible.filter((e) => {
      if (filter !== 'all' && e.category?.slug !== filter) return false;
      if (!isMaster && origin === 'mine' && !e.isMine) return false;
      if (!isMaster && origin === 'base' && !e.isBase) return false;
      if (q && !e.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [visible, filter, origin, search, isMaster]);

  const counts = useMemo(() => {
    const m = { all: visible.length };
    for (const e of visible) {
      const s = e.category?.slug;
      if (s) m[s] = (m[s] || 0) + 1;
    }
    return m;
  }, [visible]);

  const originCounts = useMemo(() => ({
    mine: visible.filter((e) => e.isMine).length,
    base: visible.filter((e) => e.isBase).length,
  }), [visible]);

  function handleDuplicate(copy) {
    setExercises((prev) => [...prev, copy]);
    setEditing({ exercise: copy, readOnly: false }); // abre la copia para personalizar
  }

  function openExercise(ex) {
    const ro = !isMaster && ex.isBase; // coach no puede editar el base
    setEditing({ exercise: ex, readOnly: ro });
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
            style={{ flex: 1, border: 'none', outline: 'none', background: 'transparent', fontFamily: FONT, fontSize: 14.5, fontWeight: 500, color: T.text, padding: '12px 0' }}
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

      {/* Origen (solo coaches): Míos / Base */}
      {!isMaster && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {[
            { k: 'all', label: 'Todos', n: visible.length },
            { k: 'mine', label: 'Míos', n: originCounts.mine },
            { k: 'base', label: 'Base', n: originCounts.base },
          ].map((o) => {
            const active = origin === o.k;
            return (
              <button
                key={o.k} type="button" onClick={() => setOrigin(o.k)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 15px', borderRadius: 20,
                  border: active ? 'none' : `1.5px solid ${T.border}`, cursor: 'pointer', fontFamily: FONT,
                  fontSize: 13.5, fontWeight: 700,
                  background: active ? `linear-gradient(135deg, ${T.accent}, ${T.accentDk})` : T.bg2,
                  color: active ? '#fff' : T.text2, boxShadow: active ? KP.shBtn : 'none',
                }}
              >
                {o.k === 'base' && <Lock size={12} />} {o.label}
                <span style={{ fontSize: 11.5, opacity: 0.85, fontWeight: 700 }}>{o.n}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Category filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 22, flexWrap: 'wrap' }}>
        {[{ slug: 'all', name: 'Todos' }, ...categories].map((c) => {
          const active = filter === c.slug;
          const color = c.slug === 'all' ? T.accent : catColor(c);
          return (
            <button
              key={c.slug}
              type="button"
              onClick={() => setFilter(c.slug)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 14px', borderRadius: 10,
                border: `1.5px solid ${active ? color : T.border}`, cursor: 'pointer', fontFamily: FONT,
                fontSize: 13.5, fontWeight: 700, color: active ? '#fff' : T.text2,
                background: active ? color : T.bg2, transition: 'all .15s',
              }}
            >
              {c.name}
              <span style={{ fontSize: 11.5, opacity: 0.85, fontWeight: 700 }}>{counts[c.slug] ?? 0}</span>
            </button>
          );
        })}
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
            display: 'grid', gap: 14,
            gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          }}
        >
          {filtered.map((ex) => (
            <ExerciseCard key={ex.id} ex={ex} base={!isMaster && ex.isBase} onClick={() => openExercise(ex)} />
          ))}
        </div>
      )}

      {editing && (
        <ExerciseEditor
          exercise={editing.exercise || null}
          categories={categories}
          readOnly={!!editing.readOnly}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
          onDeleted={handleDeleted}
          onDuplicate={handleDuplicate}
        />
      )}

      <style>{`.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
