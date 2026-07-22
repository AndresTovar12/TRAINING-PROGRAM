import { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft, X, Plus, Trash2, Copy, ChevronRight, ChevronUp, ChevronDown,
  ChevronLeft, Loader2, Check, Layers, Dumbbell, StickyNote, Zap, AlertCircle,
  Save, FolderOpen, Clipboard, Eraser, CalendarDays, Settings2, Pencil,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  listExercises, createPlan, updatePlan, listTemplates, saveTemplate, deleteTemplate,
  getMasterId, tagRepertoire,
} from '@/lib/api';
import { T, FONT, KP, CAT_COLORS } from '@/lib/theme';
import RepertoirePicker from '@/features/admin/RepertoirePicker';

/* ------------------------------------------------------------------ */
/* Constantes y helpers de datos                                       */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const PALETTE = ['#1E40E0', '#3DD9A0', '#FFA047', '#FF7A52', '#A480FF', '#5DA0FF', '#E052A0', '#9090A0'];
const DAY_CATS = Object.entries(CAT_COLORS).map(([slug, v]) => ({ slug, color: v.c, label: v.label }));

const rid = () => (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8);
const clone = (o) => structuredClone(o);

const newExercise = (ex) => (ex
  ? { exercise_id: ex.id, name: ex.name, sets: '3', reps: '8-10', intensity: '', notes: '' }
  : { name: '', sets: '3', reps: '10', intensity: '', notes: '' });
const newDay = (day = 'Lun') => ({ day, name: 'Sesión', cat: 'gym', exercises: [] });
const newWeek = (num) => ({ num, label: '', load: '', days: [] });

// El número de semana es fijo (num); `label` es solo el título opcional.
// Ignora labels heredados que sean literalmente "Semana N" para no duplicar.
const weekSubtitle = (w) => {
  const l = (w?.label || '').trim();
  if (!l || l === `Semana ${w?.num}`) return '';
  return l;
};
const weekName = (w, fallbackNum) => {
  const num = w?.num ?? fallbackNum;
  const sub = weekSubtitle(w);
  return `Semana ${num}${sub ? ` · ${sub}` : ''}`;
};
const newPhase = (num, color) => ({
  id: `p-${rid()}`, num, name: `Fase ${num}`, fullName: '', duration: '1 semana',
  weeks: 1, color: color || PALETTE[(num - 1) % PALETTE.length], focus: '', objective: '',
  weekData: [newWeek(1)],
});

const nextWeekNum = (phase) => Math.max(0, ...phase.weekData.map((w) => w.num || 0)) + 1;
const nextPhaseNum = (phases) => Math.max(0, ...phases.map((p) => p.num || 0)) + 1;
const phaseSessions = (p) => p.weekData.reduce((s, w) => s + (w.days?.length || 0), 0);

const normalize = (phases) => phases.map((p) => ({
  ...p,
  weeks: p.weekData.length,
  duration: `${p.weekData.length} semana${p.weekData.length !== 1 ? 's' : ''}`,
}));

const isDualDay = (d) => !!(d?.dual || d?.blocks);

/* ---- bloques de sets: misma semántica que groupIntoSets del atleta ---- */
const parseBlocks = (exercises = []) => {
  const blocks = [];
  let cur = null;
  exercises.forEach((ex) => {
    if (ex.isNote) { blocks.push({ type: 'note', ex }); cur = null; return; }
    const key = ex.set != null ? `s-${ex.set}` : null;
    if (key && cur && cur.key === key) { cur.members.push(ex); return; }
    cur = { type: 'set', key, members: [ex] };
    blocks.push(cur);
  });
  blocks.forEach((b) => { if (b.type === 'set') b.rounds = b.members[0]?.sets ?? '3'; });
  return blocks;
};

const serializeBlocks = (blocks) => {
  const out = [];
  let n = 0;
  blocks.forEach((b) => {
    if (b.type === 'note') { out.push(b.ex); return; }
    n += 1;
    b.members.forEach((m) => {
      const e = { ...m, sets: String(b.rounds ?? m.sets ?? '3') };
      if (b.members.length > 1) e.set = n; else delete e.set;
      out.push(e);
    });
  });
  return out;
};

const setTag = (count) => (count >= 4 ? 'Circuito' : count === 3 ? 'Tri-serie' : count === 2 ? 'Bi-serie' : null);

/* ------------------------------------------------------------------ */
/* Piezas de UI compartidas                                            */
/* ------------------------------------------------------------------ */

const inputStyle = {
  border: `1.5px solid ${T.border}`, borderRadius: 11, padding: '10px 12px', width: '100%',
  fontFamily: FONT, fontSize: 14, fontWeight: 500, color: T.text, outline: 'none',
  background: T.bg2, boxSizing: 'border-box',
};

function Field({ label, children, grow }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: grow ? 1 : undefined, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</span>
      {children}
    </label>
  );
}

function IconBtn({ icon: Icon, onClick, danger, disabled, title }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} title={title}
      style={{
        width: 30, height: 30, borderRadius: 9, border: `1px solid ${T.border}`, cursor: disabled ? 'default' : 'pointer',
        background: T.bg2, color: danger ? T.danger : T.text2, display: 'grid', placeItems: 'center',
        opacity: disabled ? 0.35 : 1, flexShrink: 0,
      }}
    >
      <Icon size={14} />
    </button>
  );
}

function Pill({ icon: Icon, children, onClick, primary, disabled }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 20,
        border: primary ? 'none' : `1.5px solid ${T.border}`, cursor: disabled ? 'default' : 'pointer',
        background: primary ? T.accentBg : T.bg2, color: primary ? T.accent : T.text2,
        fontFamily: FONT, fontSize: 13, fontWeight: 700, opacity: disabled ? 0.45 : 1, flexShrink: 0,
      }}
    >
      {Icon && <Icon size={14} />} {children}
    </button>
  );
}

function Stepper({ value, onChange, min = 1 }) {
  const n = parseInt(value) || min;
  const btn = {
    width: 28, height: 28, borderRadius: 8, border: `1px solid ${T.border}`, cursor: 'pointer',
    background: T.bg2, color: T.text, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 15,
    fontFamily: FONT,
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
      <button type="button" style={btn} onClick={() => onChange(String(Math.max(min, n - 1)))}>−</button>
      <span style={{ minWidth: 26, textAlign: 'center', fontWeight: 800, fontSize: 15, color: T.text }}>{value}</span>
      <button type="button" style={btn} onClick={() => onChange(String(n + 1))}>+</button>
    </span>
  );
}

/* Modal chico para pedir nombre (plantillas) */
function NameModal({ title, placeholder, onSave, onClose }) {
  const [name, setName] = useState('');
  return (
    <div
      onMouseDown={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 2800, background: 'rgba(17,19,24,0.5)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 16 }}
    >
      <div onMouseDown={(e) => e.stopPropagation()} className="animate-fade-in"
        style={{ width: '100%', maxWidth: 400, background: T.bg, borderRadius: 20, padding: 20, fontFamily: FONT, boxShadow: KP.shPop }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: T.text, marginBottom: 14 }}>{title}</div>
        <input
          autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={placeholder}
          onKeyDown={(e) => { if (e.key === 'Enter' && name.trim()) onSave(name.trim()); }}
          style={inputStyle}
        />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 16 }}>
          <button type="button" onClick={onClose}
            style={{ padding: '11px 16px', borderRadius: 11, border: `1.5px solid ${T.border}`, background: T.bg2, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: T.text2 }}>
            Cancelar
          </button>
          <button type="button" disabled={!name.trim()} onClick={() => onSave(name.trim())}
            style={{
              padding: '11px 18px', borderRadius: 11, border: 'none', cursor: name.trim() ? 'pointer' : 'default',
              background: `linear-gradient(135deg, ${T.accent}, ${T.accentDk})`, color: '#fff',
              fontFamily: FONT, fontSize: 13.5, fontWeight: 800, opacity: name.trim() ? 1 : 0.5, boxShadow: KP.shBtn,
            }}>
            Guardar
          </button>
        </div>
      </div>
    </div>
  );
}

/* Modal de la semana: nombre, carga y acciones */
function WeekMetaModal({ week, canDelete, onPatch, onDuplicate, onCopyToRest, onDelete, onClose }) {
  return (
    <div
      onMouseDown={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 2800, background: 'rgba(17,19,24,0.5)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 16 }}
    >
      <div onMouseDown={(e) => e.stopPropagation()} className="animate-fade-in"
        style={{ width: '100%', maxWidth: 420, background: T.bg, borderRadius: 20, padding: 20, fontFamily: FONT, boxShadow: KP.shPop }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>Ajustes de la semana</div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text2, padding: 4 }}>
            <X size={18} />
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {/* Número de semana: fijo, no editable */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 11, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, padding: '11px 14px' }}>
            <span style={{ width: 34, height: 34, borderRadius: 10, background: T.accentBg, color: T.accent, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 15, flexShrink: 0 }}>
              {week.num}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: T.text }}>Semana {week.num}</div>
              <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 600 }}>Número fijo — cambia con el orden</div>
            </div>
          </div>
          <Field label="Título de la semana (opcional)">
            <input value={weekSubtitle(week)} onChange={(e) => onPatch({ label: e.target.value })} placeholder="Ej. Adaptación, Acumulación, Deload…" style={inputStyle} />
            <span style={{ fontSize: 11.5, color: T.text3, marginTop: 4 }}>
              Se mostrará como <b style={{ color: T.text2 }}>«{weekName(week)}»</b>.
            </span>
          </Field>
          <Field label="Carga de la semana (opcional)">
            <input value={week.load || ''} onChange={(e) => onPatch({ load: e.target.value })} placeholder="Ej. 4×8 al 70% · RIR 3" style={inputStyle} />
          </Field>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <Pill icon={Copy} onClick={onDuplicate}>Duplicar semana</Pill>
            <Pill icon={Copy} onClick={onCopyToRest}>Copiar esta semana a las demás</Pill>
            <Pill icon={Trash2} onClick={onDelete} disabled={!canDelete}>Eliminar semana</Pill>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Selector de plantillas (día o semana) */
function TemplatePicker({ kind, onApply, onClose }) {
  const [rows, setRows] = useState(null);
  useEffect(() => {
    listTemplates(kind).then(setRows).catch(() => setRows([]));
  }, [kind]);

  const meta = (t) => {
    if (kind === 'week') {
      const days = t.data?.days?.length || 0;
      return `${days} día${days !== 1 ? 's' : ''}`;
    }
    const n = (t.data?.exercises || []).filter((e) => !e.isNote).length;
    return `${n} ejercicio${n !== 1 ? 's' : ''}`;
  };

  return (
    <div
      onMouseDown={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 2800, background: 'rgba(17,19,24,0.5)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', padding: 16 }}
    >
      <div onMouseDown={(e) => e.stopPropagation()} className="animate-fade-in"
        style={{ width: '100%', maxWidth: 460, maxHeight: '80svh', display: 'flex', flexDirection: 'column', background: T.bg, borderRadius: 20, fontFamily: FONT, boxShadow: KP.shPop, overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 18px 12px' }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>
            {kind === 'week' ? 'Plantillas de semana' : 'Catálogo de rutinas (día)'}
          </div>
          <button type="button" onClick={onClose} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text2, padding: 4 }}>
            <X size={19} />
          </button>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '0 12px 16px' }}>
          {rows === null ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.text2, padding: 16, fontWeight: 600 }}>
              <Loader2 size={15} className="spin" /> Cargando…
            </div>
          ) : rows.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '34px 16px', color: T.text3 }}>
              <FolderOpen size={30} style={{ opacity: 0.4 }} />
              <div style={{ marginTop: 10, fontWeight: 600, color: T.text2, fontSize: 13.5 }}>
                Aún no guardas {kind === 'week' ? 'plantillas de semana' : 'rutinas en el catálogo'}.
              </div>
            </div>
          ) : rows.map((t) => (
            <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 8px', borderBottom: `1px solid ${T.border}` }}>
              <button type="button" onClick={() => onApply(t)}
                style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, padding: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: T.text }}>{t.name}</div>
                <div style={{ fontSize: 12, color: T.text3, marginTop: 2, fontWeight: 600 }}>{meta(t)}</div>
              </button>
              <IconBtn icon={Trash2} danger title="Eliminar plantilla" onClick={async () => {
                if (!window.confirm(`¿Eliminar la plantilla "${t.name}"?`)) return;
                await deleteTemplate(t.id);
                setRows((prev) => prev.filter((r) => r.id !== t.id));
              }} />
              <ChevronRight size={15} color={T.text3} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Card de ejercicio dentro de un set                                   */
/* ------------------------------------------------------------------ */

function ExerciseCard({ ex, repertoire, onPatch, onRemove, onMove, canLeft, canRight }) {
  const rep = ex.exercise_id ? repertoire.find((r) => r.id === ex.exercise_id) : null;
  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', minWidth: 0 }}>
      <div style={{ position: 'relative', height: 110, background: '#0E1015' }}>
        {rep?.cover_image_url ? (
          <img src={rep.cover_image_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.95 }} />
        ) : (
          <div style={{ height: '100%', display: 'grid', placeItems: 'center', color: '#3A3F4C' }}>
            <Dumbbell size={26} />
          </div>
        )}
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
          <IconBtn icon={ChevronLeft} onClick={() => onMove(-1)} disabled={!canLeft} title="Mover a la izquierda" />
          <IconBtn icon={ChevronRight} onClick={() => onMove(1)} disabled={!canRight} title="Mover a la derecha" />
          <IconBtn icon={Trash2} danger onClick={onRemove} title="Quitar del set" />
        </div>
      </div>
      <div style={{ padding: 12 }}>
        {ex.exercise_id ? (
          <div style={{ fontWeight: 800, fontSize: 14, color: T.text, marginBottom: 10 }}>{ex.name}</div>
        ) : (
          <input
            value={ex.name}
            onChange={(e) => onPatch({ name: e.target.value })}
            placeholder="Nombre del ejercicio…"
            style={{ ...inputStyle, padding: '8px 10px', fontWeight: 800, marginBottom: 10 }}
          />
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          <Field label="Reps">
            <input value={ex.reps || ''} onChange={(e) => onPatch({ reps: e.target.value })}
              style={{ ...inputStyle, padding: '8px 10px', fontSize: 13 }} />
          </Field>
          <Field label="Carga / Int.">
            <input value={ex.intensity || ''} onChange={(e) => onPatch({ intensity: e.target.value })}
              placeholder="70% / RPE 8" style={{ ...inputStyle, padding: '8px 10px', fontSize: 13 }} />
          </Field>
        </div>
        <Field label="Descripción">
          <input value={ex.notes || ''} onChange={(e) => onPatch({ notes: e.target.value })}
            placeholder="Ej. 8 repeticiones cada pierna…" style={{ ...inputStyle, padding: '8px 10px', fontSize: 13, marginTop: 2 }} />
        </Field>
        <input
          value={ex.cue || ''} onChange={(e) => onPatch({ cue: e.target.value })}
          placeholder="Cue técnico (opcional)…"
          style={{ ...inputStyle, marginTop: 8, padding: '7px 10px', fontSize: 12, color: T.text2 }}
        />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor de sesión (un día) por sets                                   */
/* ------------------------------------------------------------------ */

function SessionEditor({ day, repertoire, onPatch, onDelete, onCopy, onSaveToCatalog, onApplyCatalog, onClear }) {
  const [pickerCtx, setPickerCtx] = useState(null);
  const blocks = useMemo(() => parseBlocks(day.exercises), [day.exercises]);

  const writeBlocks = (fn) => onPatch({ exercises: serializeBlocks(fn(parseBlocks(day.exercises))) });

  const moveBlock = (i, dir) => writeBlocks((bs) => {
    const j = i + dir;
    if (j < 0 || j >= bs.length) return bs;
    const next = [...bs];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  });

  if (isDualDay(day)) {
    return (
      <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 18, padding: 16, boxShadow: KP.shCard }}>
        <DayHeader day={day} onPatch={onPatch} onDelete={onDelete} onCopy={onCopy} onSaveToCatalog={onSaveToCatalog} onApplyCatalog={onApplyCatalog} onClear={onClear} dual />
        <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: T.bg, borderRadius: 14, padding: 14, marginTop: 12 }}>
          <AlertCircle size={17} color={T.accent} style={{ flexShrink: 0, marginTop: 1 }} />
          <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.55 }}>
            <b>Día dual con bloques</b> (estructura avanzada del plan original). Puedes cambiar nombre y
            categoría; el contenido de sus bloques se conserva intacto.
            <div style={{ marginTop: 7, fontWeight: 700, color: T.text }}>
              {(day.blocks || []).filter((b) => b.exercises).reduce((s, b) => s + b.exercises.length, 0)} ejercicios en {(day.blocks || []).length} bloques
            </div>
          </div>
        </div>
      </div>
    );
  }

  const nSets = blocks.filter((b) => b.type === 'set').length;

  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 18, padding: 16, boxShadow: KP.shCard }}>
      <DayHeader day={day} onPatch={onPatch} onDelete={onDelete} onCopy={onCopy} onSaveToCatalog={onSaveToCatalog} onApplyCatalog={onApplyCatalog} onClear={onClear} nSets={nSets} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
        {blocks.map((b, bi) => {
          if (b.type === 'note') {
            return (
              <div key={bi} style={{ display: 'flex', gap: 8, alignItems: 'center', background: T.accentBg, borderRadius: 12, padding: '9px 12px' }}>
                <StickyNote size={15} color={T.accent} style={{ flexShrink: 0 }} />
                <input
                  value={b.ex.text || ''}
                  onChange={(e) => writeBlocks((bs) => bs.map((x, k) => (k === bi ? { ...x, ex: { ...x.ex, text: e.target.value } } : x)))}
                  placeholder="Nota para el atleta…"
                  style={{ ...inputStyle, background: 'transparent', border: 'none', padding: '4px 0', color: T.accent, fontWeight: 700, fontSize: 13 }}
                />
                <IconBtn icon={ChevronUp} onClick={() => moveBlock(bi, -1)} disabled={bi === 0} />
                <IconBtn icon={ChevronDown} onClick={() => moveBlock(bi, 1)} disabled={bi === blocks.length - 1} />
                <IconBtn icon={Trash2} danger onClick={() => writeBlocks((bs) => bs.filter((_, k) => k !== bi))} />
              </div>
            );
          }
          const setIdx = blocks.slice(0, bi + 1).filter((x) => x.type === 'set').length;
          const tag = setTag(b.members.length);
          return (
            <div key={bi} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ fontSize: 14.5, fontWeight: 800, color: T.text }}>Set {setIdx}</span>
                {tag && (
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: T.accent, background: T.accentBg, padding: '3px 9px', borderRadius: 8, letterSpacing: 0.4 }}>
                    {tag.toUpperCase()}
                  </span>
                )}
                <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text2, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  Se repite
                  <Stepper value={b.rounds} onChange={(v) => writeBlocks((bs) => bs.map((x, k) => (k === bi ? { ...x, rounds: v } : x)))} />
                  {parseInt(b.rounds) === 1 ? 'vez' : 'veces'}
                </span>
                <span style={{ flex: 1 }} />
                <Pill icon={Plus} primary onClick={() => setPickerCtx({ mode: 'add', blockIdx: bi })}>Agregar ejercicio</Pill>
                <IconBtn icon={ChevronUp} onClick={() => moveBlock(bi, -1)} disabled={bi === 0} />
                <IconBtn icon={ChevronDown} onClick={() => moveBlock(bi, 1)} disabled={bi === blocks.length - 1} />
                <IconBtn icon={Trash2} danger onClick={() => {
                  if (window.confirm(`¿Eliminar el Set ${setIdx} completo?`)) writeBlocks((bs) => bs.filter((_, k) => k !== bi));
                }} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
                {b.members.map((m, mi) => (
                  <ExerciseCard
                    key={mi}
                    ex={m}
                    repertoire={repertoire}
                    canLeft={mi > 0}
                    canRight={mi < b.members.length - 1}
                    onPatch={(patch) => writeBlocks((bs) => bs.map((x, k) => (k === bi
                      ? { ...x, members: x.members.map((mm, kk) => (kk === mi ? { ...mm, ...patch } : mm)) }
                      : x)))}
                    onMove={(dir) => writeBlocks((bs) => bs.map((x, k) => {
                      if (k !== bi) return x;
                      const j = mi + dir;
                      if (j < 0 || j >= x.members.length) return x;
                      const members = [...x.members];
                      [members[mi], members[j]] = [members[j], members[mi]];
                      return { ...x, members };
                    }))}
                    onRemove={() => writeBlocks((bs) => bs
                      .map((x, k) => (k === bi ? { ...x, members: x.members.filter((_, kk) => kk !== mi) } : x))
                      .filter((x) => x.type !== 'set' || x.members.length > 0))}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
        <Pill icon={Plus} primary onClick={() => setPickerCtx({ mode: 'new-set' })}>Agregar set</Pill>
        <Pill icon={StickyNote} onClick={() => writeBlocks((bs) => [...bs, { type: 'note', ex: { isNote: true, text: '' } }])}>Nota</Pill>
        <Pill icon={Dumbbell} onClick={() => writeBlocks((bs) => [...bs, { type: 'set', members: [newExercise(null)], rounds: '3' }])}>Ejercicio personalizado</Pill>
      </div>

      {pickerCtx && (
        <RepertoirePicker
          exercises={repertoire}
          title={pickerCtx.mode === 'new-set' ? 'Nuevo set — elige ejercicios' : 'Agregar al set'}
          onClose={() => setPickerCtx(null)}
          onConfirm={(exs) => {
            writeBlocks((bs) => {
              const members = exs.map((e) => newExercise(e));
              if (pickerCtx.mode === 'new-set') return [...bs, { type: 'set', members, rounds: '3' }];
              return bs.map((x, k) => (k === pickerCtx.blockIdx ? { ...x, members: [...x.members, ...members] } : x));
            });
            setPickerCtx(null);
          }}
        />
      )}
    </div>
  );
}

function DayHeader({ day, onPatch, onDelete, onCopy, onSaveToCatalog, onApplyCatalog, onClear, nSets, dual }) {
  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        <Field label="Nombre de la sesión" grow>
          <input value={day.name || ''} onChange={(e) => onPatch({ name: e.target.value })} placeholder="Ej. Tren inferior — fuerza" style={inputStyle} />
        </Field>
        {nSets != null && (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text3, paddingBottom: 12 }}>
            {nSets} set{nSets !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
        {DAY_CATS.map((c) => {
          const active = day.cat === c.slug;
          return (
            <button
              key={c.slug} type="button" onClick={() => onPatch({ cat: c.slug })}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 11px', borderRadius: 10,
                border: `1.5px solid ${active ? c.color : T.border}`, cursor: 'pointer',
                background: active ? `${c.color}14` : T.bg2, color: active ? c.color : T.text2,
                fontFamily: FONT, fontSize: 11.5, fontWeight: 700,
              }}
            >
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: c.color }} />
              {c.label}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}` }}>
        {!dual && <Pill icon={FolderOpen} onClick={onApplyCatalog}>Desde catálogo</Pill>}
        {!dual && <Pill icon={Save} onClick={onSaveToCatalog}>Guardar en catálogo</Pill>}
        <Pill icon={Copy} onClick={onCopy}>Copiar</Pill>
        {!dual && <Pill icon={Eraser} onClick={onClear}>Limpiar</Pill>}
        <Pill icon={Trash2} onClick={onDelete}>Eliminar sesión</Pill>
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Builder principal                                                    */
/* ------------------------------------------------------------------ */

export default function PlanBuilder({ athlete, planRow, onClose, onSaved }) {
  const { user, profile } = useAuth();
  const isMaster = !!profile?.is_owner;
  const isNew = !planRow;
  const [title, setTitle] = useState(planRow?.title || 'Plan de entrenamiento');
  const [phases, setPhases] = useState(() => (planRow?.data?.phases ? clone(planRow.data.phases) : []));
  // Plan existente de una sola fase → directo al editor (sin pantalla de fases)
  const [nav, setNav] = useState(() => {
    if (isNew) return { level: 'start' };
    const n = planRow?.data?.phases?.length || 0;
    return n === 1 ? { level: 'phase', pi: 0 } : { level: 'phases' };
  });
  const [weekIdx, setWeekIdx] = useState(0);
  const [activeWeekday, setActiveWeekday] = useState('Lun');
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');
  const [repertoire, setRepertoire] = useState([]);
  const [clipboard, setClipboard] = useState(null);
  const [modal, setModal] = useState(null);

  const [wizWeeks, setWizWeeks] = useState(4);
  const [wizDays, setWizDays] = useState(['Lun', 'Mié', 'Vie']);

  // Repertorio para el picker: cada coach ve la base del master + los suyos
  // (no los de otros coaches). El master ve todo.
  useEffect(() => {
    Promise.all([listExercises(), getMasterId()])
      .then(([exs, mId]) => {
        const tagged = tagRepertoire(exs, mId, user?.id);
        setRepertoire(isMaster ? tagged : tagged.filter((e) => e.isBase || e.isMine));
      })
      .catch(() => {});
  }, [user?.id, isMaster]);

  // Al entrar al editor de una fase, arrancar en su primera semana / primer día con sesión
  const openPhase = (pi, wi = 0) => {
    const p = phases[pi];
    const w = p?.weekData[wi];
    setWeekIdx(wi);
    setActiveWeekday(w?.days?.[0]?.day || 'Lun');
    setDetailsOpen(false);
    setNav({ level: 'phase', pi });
  };

  const touch = (fn) => { setDirty(true); setPhases(fn); };
  const patchPhase = (pi, patch) => touch((ps) => ps.map((p, i) => (i === pi ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p)));
  const patchWeek = (pi, wi, patch) => patchPhase(pi, (p) => ({
    weekData: p.weekData.map((w, j) => (j === wi ? { ...w, ...(typeof patch === 'function' ? patch(w) : patch) } : w)),
  }));
  const patchDay = (pi, wi, di, patch) => patchWeek(pi, wi, (w) => ({
    days: w.days.map((d, k) => (k === di ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d)),
  }));

  const moveItem = (arr, i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= arr.length) return arr;
    const next = [...arr];
    [next[i], next[j]] = [next[j], next[i]];
    return next;
  };

  async function onSave() {
    if (!title.trim()) { setErr('Ponle un título al plan'); return; }
    if (phases.length === 0) { setErr('El plan necesita al menos una fase'); return; }
    setErr('');
    setSaving(true);
    try {
      const data = normalize(phases);
      const row = planRow
        ? await updatePlan(planRow.id, { title: title.trim(), phases: data })
        : await createPlan({ userId: athlete.id, title: title.trim(), phases: data, createdBy: user?.id });
      setDirty(false);
      onSaved(row);
    } catch (e) {
      setErr(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  function handleClose() {
    if (dirty && !window.confirm('Tienes cambios sin guardar. ¿Salir de todas formas?')) return;
    onClose();
  }

  function generateQuickPlan() {
    const base = newPhase(1);
    base.name = 'Mi programa';
    const days = WEEKDAYS.filter((d) => wizDays.includes(d)).map((d) => newDay(d));
    base.weekData = Array.from({ length: wizWeeks }, (_, i) => ({ ...newWeek(i + 1), days: clone(days) }));
    touch(() => [base]);
    setWeekIdx(0);
    setActiveWeekday(days[0]?.day || 'Lun');
    setDetailsOpen(false);
    setNav({ level: 'phase', pi: 0 });
  }

  const crumb = useMemo(() => {
    if (nav.level === 'phase') {
      const p = phases[nav.pi];
      const w = p?.weekData[weekIdx];
      return `${p?.name || 'Fase'} · ${weekName(w, weekIdx + 1)}`;
    }
    return 'Estructura del plan';
  }, [nav, phases, weekIdx]);

  const goBack = () => {
    if (nav.level === 'phase') {
      // Con una sola fase el nivel "fases" no aporta: cerrar directo
      if (phases.length <= 1 && !isNew) { handleClose(); return; }
      setNav({ level: 'phases' });
    } else handleClose();
  };

  /* ---------------- render por nivel ---------------- */
  let body = null;

  if (nav.level === 'start') {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560, margin: '24px auto 0' }}>
        <div style={{ fontSize: 15, color: T.text2, lineHeight: 1.55, textAlign: 'center', marginBottom: 6 }}>
          ¿Cómo quieres armar el plan de <b style={{ color: T.text }}>{athlete.full_name || athlete.username}</b>?
        </div>
        {[
          { icon: Zap, title: 'Semana tipo (rápido)', desc: 'Eliges los días de entrenamiento, armas una semana y se repite N semanas. Ideal para empezar.', onClick: () => setNav({ level: 'wizard' }) },
          { icon: Layers, title: 'Programa por fases (completo)', desc: 'Fases → semanas → días, con periodización — la misma estructura del plan original.', onClick: () => { touch(() => [newPhase(1)]); openPhase(0); } },
        ].map((opt) => (
          <button
            key={opt.title} type="button" onClick={opt.onClick}
            style={{
              display: 'flex', gap: 14, alignItems: 'center', textAlign: 'left', cursor: 'pointer',
              background: T.bg2, border: `1.5px solid ${T.border}`, borderRadius: 18, padding: 18,
              fontFamily: FONT, boxShadow: KP.shCard,
            }}
          >
            <span style={{ width: 46, height: 46, borderRadius: 14, background: T.accentBg, color: T.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
              <opt.icon size={22} />
            </span>
            <span>
              <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800, color: T.text }}>{opt.title}</span>
              <span style={{ display: 'block', fontSize: 13, color: T.text2, marginTop: 3, lineHeight: 1.45 }}>{opt.desc}</span>
            </span>
            <ChevronRight size={18} color={T.text3} style={{ marginLeft: 'auto', flexShrink: 0 }} />
          </button>
        ))}
      </div>
    );
  } else if (nav.level === 'wizard') {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18, maxWidth: 560, margin: '8px auto 0' }}>
        <Field label="¿Cuántas semanas dura el programa?">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[2, 3, 4, 6, 8, 12].map((n) => (
              <button key={n} type="button" onClick={() => setWizWeeks(n)}
                style={{
                  width: 52, padding: '11px 0', borderRadius: 11, cursor: 'pointer',
                  border: `1.5px solid ${wizWeeks === n ? T.accent : T.border}`,
                  background: wizWeeks === n ? T.accentBg : T.bg2, color: wizWeeks === n ? T.accent : T.text2,
                  fontFamily: FONT, fontSize: 14, fontWeight: 800,
                }}>
                {n}
              </button>
            ))}
          </div>
        </Field>
        <Field label="¿Qué días entrena?">
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {WEEKDAYS.map((d) => {
              const active = wizDays.includes(d);
              return (
                <button key={d} type="button"
                  onClick={() => setWizDays((prev) => (active ? prev.filter((x) => x !== d) : [...prev, d]))}
                  style={{
                    width: 52, padding: '11px 0', borderRadius: 11, cursor: 'pointer',
                    border: `1.5px solid ${active ? T.accent : T.border}`,
                    background: active ? T.accentBg : T.bg2, color: active ? T.accent : T.text2,
                    fontFamily: FONT, fontSize: 13, fontWeight: 800,
                  }}>
                  {d}
                </button>
              );
            })}
          </div>
        </Field>
        <button
          type="button" onClick={generateQuickPlan} disabled={wizDays.length === 0}
          style={{
            padding: '14px 20px', borderRadius: 13, border: 'none', cursor: wizDays.length ? 'pointer' : 'default',
            background: `linear-gradient(135deg, ${T.accent}, ${T.accentDk})`, color: '#fff',
            fontFamily: FONT, fontSize: 15, fontWeight: 800, boxShadow: KP.shBtn, opacity: wizDays.length ? 1 : 0.5,
          }}
        >
          Crear estructura ({wizWeeks} semanas · {wizDays.length} días/sem)
        </button>
        <div style={{ fontSize: 12.5, color: T.text3, textAlign: 'center', lineHeight: 1.5 }}>
          Después llenas los ejercicios de la semana 1 y los copias al resto con un botón.
        </div>
      </div>
    );
  } else if (nav.level === 'phases') {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 640, margin: '0 auto' }}>
        <Field label="Título del plan">
          <input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} style={inputStyle} />
        </Field>
        <div style={{ fontSize: 11, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: 6 }}>
          Fases del programa ({phases.length})
        </div>
        {phases.map((p, pi) => (
          <div key={p.id}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, background: T.bg2,
              border: `1px solid ${T.border}`, borderLeft: `4px solid ${p.color || T.accent}`,
              borderRadius: 14, padding: '13px 14px', boxShadow: KP.shCard,
            }}>
            <button type="button" onClick={() => openPhase(pi)}
              style={{ flex: 1, minWidth: 0, textAlign: 'left', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, padding: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: T.text }}>{p.name}</div>
              <div style={{ fontSize: 12, color: T.text2, marginTop: 2, fontWeight: 600 }}>
                {p.weekData.length} semana{p.weekData.length !== 1 ? 's' : ''} · {phaseSessions(p)} sesiones
              </div>
            </button>
            <IconBtn icon={ChevronUp} onClick={() => touch((ps) => moveItem(ps, pi, -1))} disabled={pi === 0} />
            <IconBtn icon={ChevronDown} onClick={() => touch((ps) => moveItem(ps, pi, 1))} disabled={pi === phases.length - 1} />
            <IconBtn icon={Copy} title="Duplicar fase" onClick={() => touch((ps) => {
              const c = clone(ps[pi]);
              c.id = `p-${rid()}`; c.num = nextPhaseNum(ps); c.name = `${c.name} (copia)`;
              return [...ps.slice(0, pi + 1), c, ...ps.slice(pi + 1)];
            })} />
            <IconBtn icon={Trash2} danger onClick={() => {
              if (window.confirm(`¿Eliminar la fase "${p.name}"?`)) touch((ps) => ps.filter((_, i) => i !== pi));
            }} />
            <ChevronRight size={16} color={T.text3} />
          </div>
        ))}
        <Pill icon={Plus} onClick={() => touch((ps) => [...ps, newPhase(nextPhaseNum(ps))])}>Agregar fase</Pill>
      </div>
    );
  } else if (nav.level === 'phase') {
    const p = phases[nav.pi];
    if (!p) { setNav({ level: 'phases' }); return null; }
    const wIdx = Math.min(weekIdx, p.weekData.length - 1);
    const w = p.weekData[wIdx];
    const daysOfWeekday = (w?.days || []).map((d, di) => ({ d, di })).filter((x) => x.d.day === activeWeekday);
    const sessionCount = (wd) => (w?.days || []).filter((d) => d.day === wd).length;

    body = (
      <div style={{ maxWidth: 980, margin: '0 auto' }}>
        {/* Detalles de la fase (colapsados) */}
        <div style={{ marginBottom: 14 }}>
          <button
            type="button"
            onClick={() => setDetailsOpen((v) => !v)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, border: 'none', cursor: 'pointer',
              background: 'transparent', color: T.text2, fontFamily: FONT, fontSize: 12.5, fontWeight: 700, padding: '4px 0',
            }}
          >
            <span style={{ width: 10, height: 10, borderRadius: 3, background: p.color || T.accent }} />
            <Settings2 size={14} />
            {detailsOpen ? 'Ocultar detalles de la fase' : 'Nombre, color y objetivo de la fase'}
            {detailsOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {detailsOpen && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginTop: 8 }}>
              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                <Field label="Nombre de la fase" grow>
                  <input value={p.name || ''} onChange={(e) => patchPhase(nav.pi, { name: e.target.value })} placeholder="Ej. Hipertrofia, Bloque de fuerza…" style={inputStyle} />
                </Field>
                <Field label="Subtítulo (opcional)" grow>
                  <input value={p.fullName || ''} onChange={(e) => patchPhase(nav.pi, { fullName: e.target.value })} placeholder="Ej. Recuperación y Evaluación" style={inputStyle} />
                </Field>
              </div>
              <Field label="Color">
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {PALETTE.map((c) => (
                    <button key={c} type="button" onClick={() => patchPhase(nav.pi, { color: c })} aria-label={`Color ${c}`}
                      style={{ width: 32, height: 32, borderRadius: 10, cursor: 'pointer', background: c, border: p.color === c ? `3px solid ${T.text}` : '3px solid transparent' }} />
                  ))}
                </div>
              </Field>
              <Field label="Enfoque en una línea (opcional)">
                <input value={p.focus || ''} onChange={(e) => patchPhase(nav.pi, { focus: e.target.value })} placeholder="Ej. Masa magra y base estructural" style={inputStyle} />
              </Field>
              <Field label="Objetivo (opcional)">
                <textarea value={p.objective || ''} onChange={(e) => patchPhase(nav.pi, { objective: e.target.value })} rows={3}
                  style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
              </Field>
            </div>
          )}
        </div>

        {/* Selector de semanas */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap', marginBottom: 10 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6, marginRight: 3 }}>
            Semana
          </span>
          {p.weekData.map((wk, wi) => {
            const active = wi === wIdx;
            return (
              <button
                key={wi} type="button"
                onClick={() => { setWeekIdx(wi); setActiveWeekday(p.weekData[wi]?.days?.[0]?.day || activeWeekday); }}
                style={{
                  padding: '8px 15px', borderRadius: 20, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 800,
                  border: active ? 'none' : `1.5px solid ${T.border}`,
                  background: active ? `linear-gradient(135deg, ${T.accent}, ${T.accentDk})` : T.bg2,
                  color: active ? '#fff' : T.text2,
                  boxShadow: active ? KP.shBtn : 'none',
                }}
              >
                {wi + 1}
              </button>
            );
          })}
          <IconBtn icon={Plus} title="Agregar semana" onClick={() => {
            patchPhase(nav.pi, (ph) => ({ weekData: [...ph.weekData, newWeek(nextWeekNum(ph))] }));
            setWeekIdx(p.weekData.length);
          }} />
          <IconBtn icon={Pencil} title="Ajustes de la semana" onClick={() => setModal({ type: 'week-meta' })} />
          <span style={{ flex: 1 }} />
          <Pill icon={FolderOpen} onClick={() => setModal({ type: 'tpl-week' })}>Usar plantilla</Pill>
          <Pill icon={Save} onClick={() => setModal({ type: 'name-week' })}>Guardar como plantilla</Pill>
        </div>

        {/* Nombre + carga de la semana (un tap abre ajustes) */}
        <button
          type="button" onClick={() => setModal({ type: 'week-meta' })}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 800, color: T.text, padding: '0 0 10px 2px' }}
        >
          {weekName(w, wIdx + 1)}{w?.load ? ` · ${w.load}` : ''} <Pencil size={12} color={T.text3} />
        </button>

        {/* Tabs de días */}
        <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', marginBottom: 16 }}>
          {WEEKDAYS.map((wd) => {
            const active = activeWeekday === wd;
            const has = sessionCount(wd) > 0;
            return (
              <button
                key={wd} type="button" onClick={() => setActiveWeekday(wd)}
                style={{
                  padding: '10px 18px', borderRadius: 22, cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 800,
                  border: active ? 'none' : `1.5px solid ${has ? T.accent + '55' : T.border}`,
                  background: active ? `linear-gradient(135deg, ${T.accent}, ${T.accentDk})` : has ? T.accentBg : T.bg2,
                  color: active ? '#fff' : has ? T.accent : T.text2,
                  boxShadow: active ? KP.shBtn : 'none',
                }}
              >
                {wd}
              </button>
            );
          })}
        </div>

        {/* Sesiones del día activo */}
        {daysOfWeekday.length === 0 ? (
          <div style={{ background: T.bg2, border: `1.5px dashed ${T.borderHi}`, borderRadius: 20, padding: '52px 24px', textAlign: 'center' }}>
            <div style={{ width: 70, height: 70, borderRadius: 22, background: T.accentBg, color: T.accent, display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
              <CalendarDays size={30} />
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.text }}>No hay sesión para el {activeWeekday.toLowerCase()}</div>
            <div style={{ fontSize: 13.5, color: T.text2, marginTop: 8, lineHeight: 1.5 }}>
              Crea una desde cero, tráela del catálogo o pega una copiada.
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
              <button type="button"
                onClick={() => patchWeek(nav.pi, wIdx, (wk) => ({ days: [...(wk.days || []), newDay(activeWeekday)] }))}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${T.accent}, ${T.accentDk})`, color: '#fff', fontFamily: FONT, fontSize: 14, fontWeight: 800, boxShadow: KP.shBtn }}>
                <Plus size={16} /> Añadir sesión
              </button>
              <Pill icon={FolderOpen} onClick={() => setModal({ type: 'tpl-day', payload: { di: null } })}>Desde catálogo</Pill>
              {clipboard && (
                <Pill icon={Clipboard} onClick={() => patchWeek(nav.pi, wIdx, (wk) => ({ days: [...(wk.days || []), { ...clone(clipboard), day: activeWeekday }] }))}>
                  Pegar rutina
                </Pill>
              )}
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {daysOfWeekday.map(({ d, di }) => (
              <SessionEditor
                key={di}
                day={d}
                repertoire={repertoire}
                onPatch={(patch) => patchDay(nav.pi, wIdx, di, patch)}
                onDelete={() => {
                  if (window.confirm(`¿Eliminar la sesión "${d.name || d.day}"?`)) {
                    patchWeek(nav.pi, wIdx, (wk) => ({ days: wk.days.filter((_, k) => k !== di) }));
                  }
                }}
                onCopy={() => setClipboard(clone(d))}
                onClear={() => {
                  if (window.confirm('¿Vaciar todos los sets de esta sesión?')) patchDay(nav.pi, wIdx, di, { exercises: [] });
                }}
                onSaveToCatalog={() => setModal({ type: 'name-day', payload: d })}
                onApplyCatalog={() => setModal({ type: 'tpl-day', payload: { di } })}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  const curPhase = nav.level === 'phase' ? phases[nav.pi] : null;
  const curWeekIdx = curPhase ? Math.min(weekIdx, curPhase.weekData.length - 1) : 0;

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 2400, background: T.bg, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          background: 'rgba(255,255,255,0.86)', backdropFilter: 'saturate(180%) blur(16px)',
          borderBottom: `1px solid ${T.border}`, padding: '13px 18px',
          display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0,
        }}
      >
        <button type="button" onClick={goBack}
          style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${T.border}`, cursor: 'pointer', background: T.bg2, color: T.text, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <ArrowLeft size={17} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{crumb}</div>
          <div style={{ fontSize: 12, color: T.text2, fontWeight: 600 }}>
            {athlete.full_name || athlete.username}{dirty ? ' · sin guardar' : ''}
          </div>
        </div>
        {nav.level !== 'start' && nav.level !== 'wizard' && (
          <button type="button" onClick={onSave} disabled={saving || !dirty}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 12,
              border: 'none', cursor: saving || !dirty ? 'default' : 'pointer',
              background: dirty ? `linear-gradient(135deg, ${T.accent}, ${T.accentDk})` : T.bg3,
              color: dirty ? '#fff' : T.text3, fontFamily: FONT, fontSize: 14, fontWeight: 800,
              boxShadow: dirty ? KP.shBtn : 'none', opacity: saving ? 0.75 : 1, flexShrink: 0,
            }}>
            {saving ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
            Guardar
          </button>
        )}
        <button type="button" onClick={handleClose} aria-label="Cerrar"
          style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${T.border}`, cursor: 'pointer', background: T.bg2, color: T.text2, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <X size={17} />
        </button>
      </header>

      {err && (
        <div style={{ maxWidth: 980, margin: '14px auto 0', width: 'calc(100% - 36px)', background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 12, padding: '11px 15px', fontWeight: 700, fontSize: 13.5 }}>
          {err}
        </div>
      )}

      <main style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 60px' }}>{body}</main>

      {/* Modales */}
      {modal?.type === 'week-meta' && curPhase && (
        <WeekMetaModal
          week={curPhase.weekData[curWeekIdx]}
          canDelete={curPhase.weekData.length > 1}
          onPatch={(patch) => patchWeek(nav.pi, curWeekIdx, patch)}
          onDuplicate={() => {
            patchPhase(nav.pi, (ph) => {
              const c = clone(ph.weekData[curWeekIdx]);
              c.num = nextWeekNum(ph); // conserva el título; solo cambia el número
              return { weekData: [...ph.weekData.slice(0, curWeekIdx + 1), c, ...ph.weekData.slice(curWeekIdx + 1)] };
            });
            setModal(null);
          }}
          onCopyToRest={() => {
            if (!window.confirm('¿Copiar los días de esta semana a todas las demás semanas de la fase (reemplaza su contenido)?')) return;
            patchPhase(nav.pi, (ph) => ({
              weekData: ph.weekData.map((wk, j) => (j === curWeekIdx ? wk : { ...wk, days: clone(ph.weekData[curWeekIdx].days) })),
            }));
            setModal(null);
          }}
          onDelete={() => {
            const wk = curPhase.weekData[curWeekIdx];
            if (!window.confirm(`¿Eliminar «${weekName(wk)}»?`)) return;
            patchPhase(nav.pi, (ph) => ({ weekData: ph.weekData.filter((_, j) => j !== curWeekIdx) }));
            setWeekIdx((v) => Math.max(0, v - 1));
            setModal(null);
          }}
          onClose={() => setModal(null)}
        />
      )}
      {modal?.type === 'name-day' && (
        <NameModal
          title="Guardar rutina en el catálogo"
          placeholder="Ej. Pierna — fuerza básica"
          onClose={() => setModal(null)}
          onSave={async (name) => {
            const d = modal.payload;
            await saveTemplate({ name, kind: 'day', data: { name: d.name, cat: d.cat, exercises: d.exercises || [] }, createdBy: user?.id });
            setModal(null);
          }}
        />
      )}
      {modal?.type === 'name-week' && curPhase && (
        <NameModal
          title="Guardar semana como plantilla"
          placeholder="Ej. Semana hipertrofia 3 días"
          onClose={() => setModal(null)}
          onSave={async (name) => {
            const w = curPhase.weekData[curWeekIdx];
            await saveTemplate({ name, kind: 'week', data: { days: w?.days || [] }, createdBy: user?.id });
            setModal(null);
          }}
        />
      )}
      {modal?.type === 'tpl-week' && curPhase && (
        <TemplatePicker
          kind="week"
          onClose={() => setModal(null)}
          onApply={(t) => {
            const n = (t.data?.days || []).length;
            if (!window.confirm(`Aplicar "${t.name}" reemplaza los días de esta semana por ${n} día${n !== 1 ? 's' : ''}. ¿Continuar?`)) return;
            patchWeek(nav.pi, curWeekIdx, { days: clone(t.data?.days || []) });
            setModal(null);
          }}
        />
      )}
      {modal?.type === 'tpl-day' && curPhase && (
        <TemplatePicker
          kind="day"
          onClose={() => setModal(null)}
          onApply={(t) => {
            const { di } = modal.payload;
            const tplDay = { day: activeWeekday, name: t.data?.name || t.name, cat: t.data?.cat || 'gym', exercises: clone(t.data?.exercises || []) };
            if (di == null) {
              patchWeek(nav.pi, curWeekIdx, (wk) => ({ days: [...(wk.days || []), tplDay] }));
            } else {
              if (!window.confirm(`Aplicar "${t.name}" reemplaza el contenido de esta sesión. ¿Continuar?`)) return;
              patchDay(nav.pi, curWeekIdx, di, { name: tplDay.name, cat: tplDay.cat, exercises: tplDay.exercises });
            }
            setModal(null);
          }}
        />
      )}

      <style>{`.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
