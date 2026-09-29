import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, X, Plus, Trash2, Copy, ChevronRight, ChevronUp, ChevronDown,
  ChevronLeft, Loader2, Check, Layers, Dumbbell, StickyNote, Zap,
  Save, FolderOpen, Clipboard, Eraser, CalendarDays, Settings2, Pencil, Repeat, Scale, Video,
  Image as ImageIcon, MoreHorizontal,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { useConfirmacion } from '@/components/Confirmacion';
import { useIsDesktop } from '@/lib/useViewport';
import {
  listExercises, createPlan, updatePlan, listTemplates, saveTemplate, deleteTemplate,
  getMasterId, tagRepertoire, createExercise, listCategories,
  listExerciseMedia, addExerciseMedia, deleteExerciseMedia,
  listExerciseOverrides, aplicarOverrides, getAthleteState,
} from '@/lib/api';
import {
  isLoadedExercise, dondeVa, estructuraDelPlan, kindDeEstructura, semanaGlobal, semanasDelPlan,
} from '@/lib/training-utils';
import NavegadorDelPlan from '@/components/NavegadorDelPlan';
import { T, FONT, KP } from '@/lib/theme';
import CampoCantidad from '@/components/CampoCantidad';
import { ligaExterna } from '@/lib/videos';
import RepertoirePicker from '@/features/admin/RepertoirePicker';
import MediaUpload from '@/features/admin/MediaUpload';
import SelectorCategoria from '@/features/admin/SelectorCategoria';
import SelectorTipoSesion from '@/features/admin/SelectorTipoSesion';
import Portada from '@/components/Portada';
import { pluralS } from '@/lib/plural';
import { sesionesDelTitulo, textoDeSesiones } from '@/lib/sesiones';
import { esArranque, guardaLugar, leeLugar } from '@/lib/lugar';
import { useScrollLugar } from '@/lib/useLugar';
import InterruptorVista from '@/components/InterruptorVista';
import { useVistaEjercicios } from '@/lib/useVistaEjercicios';

/* ------------------------------------------------------------------ */
/* Constantes y helpers de datos                                       */
/* ------------------------------------------------------------------ */

const WEEKDAYS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
// Solo para mostrar. Lo que se GUARDA en el plan sigue siendo 'Lun', 'Mar'…
// Cambiar esos valores rompería los planes que ya existen.
const NOMBRE_DIA = {
  Lun: 'Lunes', Mar: 'Martes', Mié: 'Miércoles', Jue: 'Jueves',
  Vie: 'Viernes', Sáb: 'Sábado', Dom: 'Domingo',
};
const PALETTE = ['#1E40E0', '#3DD9A0', '#FFA047', '#FF7A52', '#A480FF', '#5DA0FF', '#E052A0', '#9090A0'];

const rid = () => (crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8);
const clone = (o) => structuredClone(o);

const newExercise = (ex) => (ex
  ? { exercise_id: ex.id, name: ex.name, sets: '3', reps: '8-10', intensity: '', notes: '' }
  : { name: '', sets: '3', reps: '10', intensity: '', notes: '' });
const newDay = (day = 'Lun') => ({ day, name: 'Sesión', cat: 'gym', exercises: [] });
const DAY_FULL_LOWER = { Lun: 'lunes', Mar: 'martes', 'Mié': 'miércoles', Jue: 'jueves', Vie: 'viernes', 'Sáb': 'sábado', Dom: 'domingo' };
const newWeek = (num) => ({ num, label: '', load: '', days: [] });

// Qué día enseñar al cambiar de fase o de semana: el mismo si en la nueva
// también tiene sesión; si no, el primero que sí tenga. Así no aterrizas en un
// día vacío mientras la semana tiene otros llenos.
const diaParaSemana = (wk, actual) => {
  const dias = wk?.days ?? [];
  if (dias.some((d) => d.day === actual)) return actual;
  return WEEKDAYS.find((k) => dias.some((d) => d.day === k)) ?? actual;
};

/* El lugar del coach en el plan, leído de lo que se guardó antes de refrescar
   (ver `lugar.js`), o `null` si no sirve. Se desconfía de todo: la fase o la
   semana pudieron borrarse desde entonces, y un índice que ya no existe
   dejaría el editor en blanco. Guarda `{ pi, wi, dia, tel }`: fase, semana,
   día y si estaba abierto el editor del día del teléfono. */
function lugarDelPlan(guardado, fases) {
  if (!guardado || typeof guardado !== 'object') return null;
  const fase = Number.isInteger(guardado.pi) ? fases[guardado.pi] : null;
  if (!fase) return null;
  const wi = Number.isInteger(guardado.wi) && fase.weekData?.[guardado.wi] ? guardado.wi : 0;
  const semana = fase.weekData?.[wi];
  const dia = diaParaSemana(semana, typeof guardado.dia === 'string' ? guardado.dia : 'Lun');
  // El editor del día solo se reabre si ese día todavía existe.
  const hayDia = (semana?.days ?? []).some((d) => d.day === dia);
  return { pi: guardado.pi, wi, dia, editandoDiaTel: guardado.tel === true && hayDia };
}

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

/* Las tres formas de un plan (ver `estructuraDelPlan`), dichas igual al
   crearlo que al cambiarlo. */
const FORMAS = [
  { id: 'rutina', icon: Repeat, title: 'Una rutina que se repite', corto: 'Se repite todas las semanas', desc: 'Misma rutina cada semana, sin fin. Lo más común.' },
  { id: 'semanas', icon: Zap, title: 'Varias semanas que avanzan', corto: 'Varias semanas que avanzan', desc: 'Arrancas con la misma base y vas subiendo cargas semana a semana.' },
  { id: 'fases', icon: Layers, title: 'Programa por fases', corto: 'Programa por fases', desc: 'Bloques con objetivos distintos, como un plan de temporada.' },
];
const nextPhaseNum = (phases) => Math.max(0, ...phases.map((p) => p.num || 0)) + 1;

/* Las semanas de cada fase se cuentan de nuevo al guardar. Menos en un
   MICROCICLO: ahí `weekData` trae UNA semana modelo que se repite, y `weeks`
   dice cuántas veces. Contarla daría "1 semana". En el plan de Andrés, Camp
   son 4 semanas y Temporada 11; el primer guardado desde el editor las dejaba
   en 1, y la hoja del programa lo habría enseñado así. */
const normalize = (phases) => phases.map((p) => (p.mode === 'microcycle' ? p : {
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

/**
 * Boton de icono. Por defecto va SIN caja: ni borde ni fondo.
 *
 * Antes cada icono venia en su cuadrito gris. Con cinco juntos, la fila se
 * convierte en cinco cajas identicas y ninguna dice "yo soy la importante".
 * Sin caja, lo que se ve es el icono; el fondo aparece al pasar el mouse,
 * que es cuando hace falta saber que si se puede tocar.
 *
 * `sobreFoto` recupera la caja clara: encima de la imagen oscura de un
 * ejercicio, un icono transparente no se veria.
 */
function IconBtn({ icon: Icon, onClick, danger, disabled, title, sobreFoto }) {
  return (
    <button
      type="button" onClick={onClick} disabled={disabled} title={title}
      className={sobreFoto ? undefined : 'kp-ico'}
      style={{
        width: 30, height: 30, borderRadius: 999, cursor: disabled ? 'default' : 'pointer',
        border: sobreFoto ? `1px solid ${T.border}` : 'none',
        background: sobreFoto ? T.bg2 : 'transparent',
        color: danger ? T.danger : T.text3, display: 'grid', placeItems: 'center',
        opacity: disabled ? 0.3 : 1, flexShrink: 0,
      }}
    >
      <Icon size={15} />
    </button>
  );
}

/**
 * Pastilla de accion, con TRES pesos. El peso es la jerarquia: dice de un
 * vistazo cual es la accion principal y cuales son de apoyo.
 *
 *   solido   → la accion principal de la pantalla. Azul lleno. Una sola.
 *   primary  → accion destacada de apoyo. Azul suave, sin borde.
 *   (nada)   → fantasma: sin fondo ni borde. Todo lo demas.
 *   danger   → fantasma en rojo, para lo que borra.
 *
 * Antes todo lo que no era `primary` era la misma caja blanca con borde
 * gris. Cinco de esas en fila pesan igual, asi que el ojo tiene que leerlas
 * una por una en vez de saltar directo a la que importa.
 */
function Pill({ icon: Icon, children, onClick, primary, solido, danger, disabled }) {
  const fondo = solido ? T.accent : primary ? T.accentBg : 'transparent';
  const tinta = solido ? '#fff' : danger ? T.danger : primary ? T.accent : T.text2;
  return (
    <button
      type="button" onClick={onClick} disabled={disabled}
      className={solido || primary ? undefined : 'kp-pill'}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 15px', borderRadius: 999,
        border: 'none', cursor: disabled ? 'default' : 'pointer',
        background: fondo, color: tinta,
        fontFamily: FONT, fontSize: 13, fontWeight: 700, opacity: disabled ? 0.4 : 1, flexShrink: 0,
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
function WeekMetaModal({ week, numero = week.num, canDelete, onPatch, onDuplicate, onCopyToRest, onDelete, onClose }) {
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
              {numero}
            </span>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 14.5, fontWeight: 800, color: T.text }}>Semana {numero}</div>
              <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 600 }}>Número fijo — cambia con el orden</div>
            </div>
          </div>
          <Field label="Título de la semana (opcional)">
            <input value={weekSubtitle(week)} onChange={(e) => onPatch({ label: e.target.value })} placeholder="Ej. Adaptación, Acumulación, Deload…" style={inputStyle} />
            <span style={{ fontSize: 11.5, color: T.text3, marginTop: 4 }}>
              Se mostrará como <b style={{ color: T.text2 }}>«{weekName({ ...week, num: numero })}»</b>.
            </span>
          </Field>
          <Field label="Carga de la semana (opcional)">
            <input value={week.load || ''} onChange={(e) => onPatch({ load: e.target.value })} placeholder="Ej. 4×8 al 70% · RIR 3" style={inputStyle} />
          </Field>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
            <Pill icon={Copy} onClick={onDuplicate}>Duplicar semana</Pill>
            <Pill icon={Copy} onClick={onCopyToRest}>Copiar esta semana a las demás</Pill>
            <Pill icon={Trash2} danger onClick={onDelete} disabled={!canDelete}>Eliminar semana</Pill>
          </div>
        </div>
      </div>
    </div>
  );
}

/* Selector de plantillas (día o semana) */
function TemplatePicker({ kind, onApply, onClose }) {
  const { user } = useAuth();
  const pregunta = useConfirmacion();
  const [rows, setRows] = useState(null);
  useEffect(() => {
    listTemplates(kind, user?.id).then(setRows).catch(() => setRows([]));
  }, [kind, user?.id]);

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
                if (!await pregunta({ titulo: `¿Eliminar la plantilla "${t.name}"?`, confirmar: 'Sí, eliminarla', peligro: true })) return;
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

/* El ejercicio del repertorio que le toca a uno del plan: por su id, o si no,
   por su nombre. Es LA MISMA regla que usa la app del atleta para su foto y
   su video (`resolveExercise` en PlanContext), así que un video puesto desde
   aquí es el que él ve.

   Hace falta el nombre porque los planes viejos no guardan el id: el de
   Andrés tiene 328 ejercicios y ninguno lo trae. Por eso "Su video" no salía
   en su plan (Andrés, 27 sep 2026). Con nombres repetidos gana el último,
   igual que allá. */
const normNombre = (s) => (s || '').toLowerCase().trim();
const delRepertorio = (ex, repertoire) => {
  if (!ex || ex.isNote) return null;
  const porId = ex.exercise_id && repertoire.find((r) => r.id === ex.exercise_id);
  if (porId) return porId;
  const n = normNombre(ex.name);
  if (!n) return null;
  let ultimo = null;
  repertoire.forEach((r) => { if (normNombre(r.name) === n) ultimo = r; });
  return ultimo;
};

/* ------------------------------------------------------------------ */
/* Card de ejercicio dentro de un set                                   */
/* ------------------------------------------------------------------ */

function ExerciseCard({ ex, repertoire, atleta, onVideoAtleta, onPatch, onRemove, onMove, canLeft, canRight, conSeries = false }) {
  const rep = delRepertorio(ex, repertoire);
  /* El descanso lo escribe el COACH. Antes la app lo adivinaba leyendo el
     nombre del ejercicio y se lo enseñaba al atleta como si fuera una
     indicación suya. Si aquí se deja vacío, al atleta no le aparece nada:
     mejor callar que inventarle un dato de entrenamiento.
     Con «Series» (días de dos sesiones) va a media columna, junto a la carga;
     si no, en su propia línea. */
  const campoDescanso = (
    <Field label="Descanso">
      <input value={ex.descanso || ''} onChange={(e) => onPatch({ descanso: e.target.value })}
        placeholder={conSeries ? '2 min' : '2 min / 90 s — opcional'}
        style={{ ...inputStyle, padding: '8px 10px', fontSize: 13, marginTop: conSeries ? 0 : 2 }} />
    </Field>
  );
  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', minWidth: 0 }}>
      <div style={{ position: 'relative', height: 110, width: '100%', background: '#0E1015' }}>
        <Portada
          foto={rep?.cover_image_url}
          video={rep?.video_url}
          desde={rep?.recorte_inicio}
          hasta={rep?.recorte_fin}
          style={{ position: 'absolute', inset: 0, color: '#3A3F4C' }}
        >
          <Dumbbell size={26} />
        </Portada>
        <div style={{ position: 'absolute', top: 8, right: 8, display: 'flex', gap: 6 }}>
          <IconBtn sobreFoto icon={ChevronLeft} onClick={() => onMove(-1)} disabled={!canLeft} title="Mover a la izquierda" />
          <IconBtn sobreFoto icon={ChevronRight} onClick={() => onMove(1)} disabled={!canRight} title="Mover a la derecha" />
          <IconBtn sobreFoto icon={Trash2} danger onClick={onRemove} title="Quitar del set" />
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
          {/* Ver `ExerciseRow`: solo en los días de dos sesiones. */}
          {conSeries && (
            <Field label="Series">
              <input value={ex.sets ?? ''} onChange={(e) => onPatch({ sets: e.target.value })}
                placeholder="3" style={{ ...inputStyle, padding: '8px 10px', fontSize: 13 }} />
            </Field>
          )}
          {/* El rótulo de este campo es la lista de unidades: reps, segundos,
              metros, yardas… Ver `CampoCantidad`. */}
          <CampoCantidad
            ex={ex}
            onPatch={onPatch}
            estiloInput={{ ...inputStyle, padding: '8px 10px', fontSize: 13 }}
          />
          <Field label="Carga / Int.">
            <input value={ex.intensity || ''} onChange={(e) => onPatch({ intensity: e.target.value })}
              placeholder="70% / RPE 8" style={{ ...inputStyle, padding: '8px 10px', fontSize: 13 }} />
          </Field>
          {conSeries && campoDescanso}
        </div>
        {!conSeries && campoDescanso}
        <Field label="Descripción">
          <input value={ex.notes || ''} onChange={(e) => onPatch({ notes: e.target.value })}
            placeholder="Ej. 8 repeticiones cada pierna…" style={{ ...inputStyle, padding: '8px 10px', fontSize: 13, marginTop: 2 }} />
        </Field>
        <input
          value={ex.cue || ''} onChange={(e) => onPatch({ cue: e.target.value })}
          placeholder="Cue técnico (opcional)…"
          style={{ ...inputStyle, marginTop: 8, padding: '7px 10px', fontSize: 12, color: T.text2 }}
        />
        <div style={{ marginTop: 9, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
          <BotonCarga ex={ex} onPatch={onPatch} />
          <BotonVideoAtleta idEjercicio={rep?.id} atleta={atleta} onAbrir={() => onVideoAtleta?.({ ...ex, exercise_id: rep.id })} />
        </div>
      </div>
    </div>
  );
}

/**
 * Abre el video propio de este atleta para este ejercicio.
 * Solo aparece si el ejercicio viene del repertorio: un ejercicio sin id no
 * tiene a qué colgarle un video.
 */
function BotonVideoAtleta({ idEjercicio, atleta, onAbrir }) {
  if (!idEjercicio || !atleta?.id) return null;
  return (
    <button
      type="button"
      onClick={onAbrir}
      title={`Poner un video solo para ${atleta.full_name || atleta.username}`}
      /* CON COLOR PROPIO, no un fantasma gris. Andrés, 18 sep 2026: "lo de
         peso y video está visualmente muy escondido, y en general le falta un
         poquito de vida y color a esta parte". Eran dos pastillas
         transparentes con letra #9CA3AF sobre blanco: se leen mal y no
         parecen tocables. El violeta lo separa además del azul del peso, que
         es la otra pastilla de la misma fila. */
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 10px',
        borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
        border: 'none', background: 'rgba(124,92,255,0.12)', color: T.violet,
        fontFamily: FONT, fontSize: 12, fontWeight: 700,
      }}
    >
      <Video size={12} /> Su video
    </button>
  );
}

/**
 * "¿Este ejercicio lleva peso?" — lo decide el coach, no el nombre.
 *
 * Antes lo adivinaba una lista fija de palabras (sprint, salto, movilidad…).
 * Eso choca con que la app sirva para cualquier actividad física: un drill
 * nuevo con un nombre que la lista no contempla se quedaba sin campo de peso
 * —o lo mostraba cuando no tocaba— y no había forma de corregirlo.
 *
 * El botón enseña el estado EFECTIVO. Mientras el coach no lo toque, sigue
 * valiendo la sugerencia automática; en cuanto lo toca, manda su decisión.
 */
function BotonCarga({ ex, onPatch }) {
  const { t } = usePalabras();
  const efectivo = isLoadedExercise(ex);
  const explicito = ex.carga !== undefined;
  return (
    <button
      type="button"
      onClick={() => onPatch({ carga: !efectivo })}
      title={
        explicito
          ? (efectivo ? t('El atleta anota el peso. Toca para quitarlo.') : 'Sin campo de peso. Toca para ponerlo.')
          : `Sugerido automáticamente: ${efectivo ? 'lleva peso' : 'sin peso'}. Toca para cambiarlo.`
      }
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5, padding: '6px 10px',
        borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
        background: efectivo ? T.accentBg : T.bg3,
        color: efectivo ? T.accent : T.text2,
        fontFamily: FONT, fontSize: 12, fontWeight: 700,
        /* "Sugerido por la app" se dice con el borde punteado, no bajándole la
           opacidad: un gris claro al 75% sobre blanco no lo lee nadie, y
           encima parecía desactivado cuando sí se puede tocar. */
        border: explicito ? '1px solid transparent' : `1px dashed ${efectivo ? T.accent : T.borderHi}`,
      }}
    >
      <Scale size={12} />
      {efectivo ? 'Con peso' : 'Sin peso'}
    </button>
  );
}

/* ------------------------------------------------------------------ */
/* Ejercicio como FILA de tabla (solo compu)                            */
/*                                                                      */
/* La tarjeta y la fila muestran lo mismo. Cambia como se lee:          */
/* la tarjeta apila los campos con su etiqueta encima, y en el telefono */
/* eso esta bien porque solo cabe una a la vez. En la compu, apilar     */
/* obliga a rastrear cada tarjeta para comparar las reps de un set.     */
/* En la tabla los encabezados salen una sola vez y cada campo queda    */
/* alineado con el de arriba: se compara de un vistazo, en columna.     */
/* ------------------------------------------------------------------ */

/* `celda` y `encabezado` se fueron con la tabla: los ejercicios pasaron a ser
   tarjetas con sus propios rótulos, y el rótulo vive ahora en `RotuloCampo`. */
const inputFila = {
  ...inputStyle, padding: '7px 9px', fontSize: 13, borderRadius: 9, background: T.bg,
};

/** El rótulo de un campo de la tarjeta. Mismo tamaño y color que tenían los
 *  encabezados de la tabla, para que no cambie el aire de la pantalla. */
function RotuloCampo({ children }) {
  return (
    <span style={{
      display: 'block', fontSize: 10.5, fontWeight: 800, color: T.text3,
      textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4, whiteSpace: 'nowrap',
    }}>
      {children}
    </span>
  );
}

/**
 * Un ejercicio del set, con sus propios rótulos.
 *
 * ERA UNA FILA DE TABLA, con una sola barra de encabezados arriba para todos.
 * Andrés, 24 sep 2026: "creo que es mejor que hagamos la forma 2, porque luego
 * también podremos hacer listas desplegables de las demás cosas como carga,
 * tipo RIR o cosas así".
 *
 * Ese es el motivo de fondo y es bueno: en cuanto un campo deja de significar
 * siempre lo mismo —la cantidad ya son reps o segundos o metros, y la carga va
 * a ser porcentaje o RPE o RIR—, su rótulo tiene que pertenecer al ejercicio,
 * no a la columna. Con una barra compartida arriba habría que ir cambiándola
 * de sitio campo por campo cada vez que se añada uno; así ya está resuelto.
 *
 * Cuesta alto: la barra se repite por ejercicio. A cambio, cada uno se lee
 * completo sin tener que subir la vista hasta los encabezados.
 */
function ExerciseRow({ ex, repertoire, atleta, onVideoAtleta, onPatch, onRemove, onMove, canUp, canDown, conSeries = false }) {
  const rep = delRepertorio(ex, repertoire);
  /* EN EL TELÉFONO, LA FILA SE ACOMODA A DOS COLUMNAS. Andrés, 28 sep 2026:
     eligió "lista" también desde el teléfono. Con los anchos de la compu,
     "Descripción" y "Cue técnico" quedaban de ~90 px, demasiado para escribir.
     Aquí las medidas son fluidas: dos por renglón (cantidad y carga; descanso y
     las pastillas), y descripción y cue a todo el ancho. */
  const angosta = !useIsDesktop();
  /* `order` reparte los renglones: primero cantidad y carga; luego descanso con
     las pastillas de peso y video (van pegadas, no al final); y al último,
     descripción y cue, cada uno a todo el ancho. En la compu no se usa: ahí
     todo va en un renglón y el orden es el del código. */
  const fluido = (orden) => (angosta ? { flex: '1 1 90px', minWidth: 0, order: orden } : null);
  const completo = (orden) => (angosta ? { flex: '1 1 100%', minWidth: 0, order: orden } : null);
  return (
    <div style={{
      background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12,
      padding: '11px 12px', fontFamily: FONT,
    }}>
      {/* El nombre manda: ocupa su propia línea, con lo de mover y quitar al
          otro extremo para que no se toquen sin querer. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <Portada
          foto={rep?.cover_image_url}
          video={rep?.video_url}
          desde={rep?.recorte_inicio}
          hasta={rep?.recorte_fin}
          style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, background: '#0E1015' }}
        >
          <Dumbbell size={15} color="#3A3F4C" />
        </Portada>
        {ex.exercise_id ? (
          <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 14, color: T.text }}>{ex.name}</span>
        ) : (
          <input value={ex.name} onChange={(e) => onPatch({ name: e.target.value })}
            placeholder="Nombre del ejercicio…" style={{ ...inputFila, flex: 1, fontWeight: 700 }} />
        )}
        <div style={{ display: 'flex', gap: 5, flexShrink: 0 }}>
          <IconBtn icon={ChevronUp} onClick={() => onMove(-1)} disabled={!canUp} title="Subir" />
          <IconBtn icon={ChevronDown} onClick={() => onMove(1)} disabled={!canDown} title="Bajar" />
          <IconBtn icon={Trash2} danger onClick={onRemove} title="Quitar del set" />
        </div>
      </div>

      {/* Medidas para que todo quepa en UNA línea desde una laptop de 1180 px
          (la fila mide 656), también con «Series»: el mínimo es 644. Si la
          pantalla es aún más chica, se parte. */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {/* Solo en los días de dos sesiones, donde cada ejercicio trae sus
            propias series y en texto libre ("—", "3-4"). En una sesión normal
            las series son del set entero ("Se repite 3 veces"). */}
        {conSeries && (
          <div style={{ width: 52 }}>
            <RotuloCampo>Series</RotuloCampo>
            <input value={ex.sets ?? ''} onChange={(e) => onPatch({ sets: e.target.value })}
              placeholder="3" style={inputFila} />
          </div>
        )}
        {/* El rótulo de la cantidad es la lista de unidades. Ver `CampoCantidad`. */}
        {angosta ? (
          <div style={fluido(0)}>
            <CampoCantidad ex={ex} onPatch={onPatch} compacto estiloInput={inputFila} />
          </div>
        ) : (
          <CampoCantidad ex={ex} onPatch={onPatch} compacto estiloInput={inputFila} ancho={96} />
        )}

        <div style={fluido(0) ?? { width: 100 }}>
          <RotuloCampo>Carga / Int.</RotuloCampo>
          <input value={ex.intensity || ''} onChange={(e) => onPatch({ intensity: e.target.value })}
            placeholder="70% / RPE 8" style={inputFila} />
        </div>
        <div style={fluido(1) ?? { width: 84 }}>
          <RotuloCampo>Descanso</RotuloCampo>
          <input value={ex.descanso || ''} onChange={(e) => onPatch({ descanso: e.target.value })}
            placeholder="2 min" style={inputFila} />
        </div>
        {/* La base decide si se parte la línea (no el mínimo): va chica, y el
            campo crece para llenar lo que sobre. */}
        <div style={completo(3) ?? { flex: '1 1 90px', minWidth: 90 }}>
          <RotuloCampo>Descripción</RotuloCampo>
          <input value={ex.notes || ''} onChange={(e) => onPatch({ notes: e.target.value })}
            placeholder="Ej. 8 cada pierna…" style={inputFila} />
        </div>
        <div style={completo(4) ?? { flex: '1 1 80px', minWidth: 80 }}>
          <RotuloCampo>Cue técnico</RotuloCampo>
          <input value={ex.cue || ''} onChange={(e) => onPatch({ cue: e.target.value })}
            placeholder="Opcional…" style={{ ...inputFila, color: T.text2 }} />
        </div>
        {/* PESO Y VIDEO, uno encima del otro y sin rótulo: las pastillas se
            leen solas ("Con peso", "Su video"). Lado a lado y con rótulo no
            cabían en la fila y el video se bajaba a otra línea. Andrés, 27 sep
            2026: "no cabe y se tiene que poner abajo, eso no me gusta". Las
            dos juntas miden lo mismo que un rótulo con su campo.
            El de video solo existe con un ejercicio del repertorio y un
            atleta delante. */}
        <div style={{ ...(fluido(2) ?? { flexShrink: 0 }), display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 4 }}>
          <BotonCarga ex={ex} onPatch={onPatch} />
          {rep && atleta?.id && (
            <BotonVideoAtleta idEjercicio={rep.id} atleta={atleta} onAbrir={() => onVideoAtleta?.({ ...ex, exercise_id: rep.id })} />
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Crear un ejercicio nuevo sin salir del editor de sesión.
 *
 * ANTES: "Ejercicio personalizado" metía `{ name, sets, reps, intensity, notes }`
 * al set y ya. Sin `exercise_id`. Y como la foto y el video de un ejercicio se
 * resuelven contra el repertorio a través de ese id, ese ejercicio no podía
 * tener media: no era que faltara el botón de subir, es que no había a qué
 * colgarle el archivo. Además vivía solo dentro de ese plan, así que para
 * usarlo con otro atleta había que volver a escribirlo.
 *
 * AHORA: crea una entrada REAL del repertorio —con su foto, su video y si
 * lleva peso— y la mete al set ya enlazada. Queda disponible para todos tus
 * planes desde el momento en que la guardas.
 */
function CrearEjercicioRapido({ categorias, onCancelar, onCreado, duenoId, masterId, onCategoriaCreada, onCategoriaBorrada }) {
  const { t } = usePalabras();
  const [nombre, setNombre] = useState('');
  const [categoria, setCategoria] = useState('');
  const [foto, setFoto] = useState('');
  const [video, setVideo] = useState('');
  const [llevaPeso, setLlevaPeso] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');

  async function guardar() {
    const n = nombre.trim();
    if (!n) { setErr('Ponle un nombre al ejercicio.'); return; }
    setGuardando(true); setErr('');
    try {
      const fila = await createExercise({
        name: n,
        category_id: categoria || null,
        cover_image_url: foto || null,
        video_url: video || null,
      });
      onCreado(fila, llevaPeso);
    } catch (e) {
      setErr(e.message || 'No se pudo crear el ejercicio.');
      setGuardando(false);
    }
  }

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !guardando) onCancelar(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 5200, background: 'rgba(9,11,16,.55)',
        display: 'grid', placeItems: 'center', padding: 16, fontFamily: FONT,
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: '100%', maxWidth: 440, background: T.bg2, borderRadius: 20,
          border: `1px solid ${T.border}`, padding: 20, boxShadow: KP.shPop,
          maxHeight: '88svh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <span style={{ width: 38, height: 38, borderRadius: 12, flexShrink: 0, background: T.accentBg, color: T.accent, display: 'grid', placeItems: 'center' }}>
            <Dumbbell size={19} />
          </span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16.5, fontWeight: 800, color: T.text, lineHeight: 1.2 }}>Ejercicio nuevo</div>
            <div style={{ fontSize: 12.5, color: T.text3, fontWeight: 600 }}>Se guarda en tu repertorio</div>
          </div>
          <button type="button" onClick={onCancelar} disabled={guardando}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text3, padding: 4 }}>
            <X size={19} />
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text2, marginBottom: 6 }}>Nombre</div>
            <input
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej. Salida en 3 puntos"
              autoFocus
              style={{ ...inputStyle, fontSize: 16, fontWeight: 700 }}
            />
          </label>

          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text2, marginBottom: 6 }}>Categoría</div>
            <SelectorCategoria
              categorias={categorias}
              value={categoria}
              onChange={setCategoria}
              onCreada={onCategoriaCreada}
              onBorrada={onCategoriaBorrada}
              duenoId={duenoId}
              masterId={masterId}
              sinCategoria
            />
          </div>

          <MediaUpload
            label="Foto" icon={Dumbbell} value={foto} onChange={setFoto}
            accept="image/*" kind="covers"
            hint="Se optimiza sola antes de subirla."
          />
          <MediaUpload
            label="Video" icon={Dumbbell} value={video} onChange={setVideo}
            accept="video/*" kind="videos"
            hint="Desde el teléfono puedes grabarlo aquí mismo."
          />

          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text2, marginBottom: 6 }}>{t('¿El atleta anota el peso?')}</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {[[true, 'Sí, lleva peso'], [false, 'No lleva peso']].map(([v, texto]) => (
                <button
                  key={String(v)} type="button" onClick={() => setLlevaPeso(v)}
                  style={{
                    flex: 1, padding: '11px 10px', borderRadius: 12, cursor: 'pointer',
                    border: `1.5px solid ${llevaPeso === v ? T.accent : T.border}`,
                    background: llevaPeso === v ? T.accentBg : T.bg2,
                    color: llevaPeso === v ? T.accent : T.text2,
                    fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
                  }}
                >
                  {texto}
                </button>
              ))}
            </div>
          </div>

          {err && (
            <div style={{ background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 11, padding: '10px 12px', fontSize: 13, fontWeight: 700 }}>
              {err}
            </div>
          )}

          <div style={{ display: 'flex', gap: 9, marginTop: 2 }}>
            <button
              type="button" onClick={onCancelar} disabled={guardando}
              style={{
                flex: 1, padding: '13px 16px', borderRadius: 12, border: `1.5px solid ${T.border}`,
                background: T.bg2, color: T.text, cursor: 'pointer', fontFamily: FONT,
                fontSize: 14.5, fontWeight: 700,
              }}
            >
              Cancelar
            </button>
            <button
              type="button" onClick={guardar} disabled={guardando || !nombre.trim()}
              style={{
                flex: 1, padding: '13px 16px', borderRadius: 12, border: 'none',
                background: nombre.trim() && !guardando ? `linear-gradient(135deg, ${T.accent}, ${T.accentDk})` : T.bg3,
                color: nombre.trim() && !guardando ? '#fff' : T.text3,
                cursor: nombre.trim() && !guardando ? 'pointer' : 'default',
                fontFamily: FONT, fontSize: 14.5, fontWeight: 800,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              }}
            >
              {guardando ? <><Loader2 size={15} className="spin" /> Creando…</> : 'Crear y agregar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Foto y video puestos SOLO para este atleta.
 *
 * Para qué sirve: el ejercicio del repertorio tiene su foto y su video
 * generales, pero a veces hay que enseñarle a UNA persona una corrección suya
 * —su rodilla, su agarre, su ritmo— o una variante que solo ella hace, sin
 * cambiarle el ejercicio a todos los demás.
 *
 * Lo que se pone aquí le gana a todo lo demás: si existe, es lo que ve. Se
 * guarda enlazado al ejercicio y a esa persona, así que se puede quitar
 * después sin tocar nada del repertorio.
 *
 * Aplica en TODO el plan de esa persona, no solo en la sesión desde la que se
 * abrió: si el ejercicio sale en doce sesiones, en las doce ve lo mismo.
 */
function MediaParaEsteAtleta({ ejercicio, atleta, onCerrar }) {
  const { t } = usePalabras();
  const [existentes, setExistentes] = useState({ video: null, foto: null });
  const [cargando, setCargando] = useState(true);
  const [nuevo, setNuevo] = useState({ video: '', foto: '' });
  const [guardando, setGuardando] = useState('');
  const [err, setErr] = useState('');
  const nombreAtleta = atleta?.full_name || atleta?.username || t('este atleta');

  useEffect(() => {
    let vivo = true;
    listExerciseMedia([ejercicio.exercise_id])
      .then((r) => {
        if (!vivo) return;
        const mios = r.filter((m) => m.para_atleta === atleta?.id);
        setExistentes({
          video: mios.find((m) => m.tipo === 'video') ?? null,
          foto: mios.find((m) => m.tipo === 'foto') ?? null,
        });
      })
      .catch(() => {})
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [ejercicio.exercise_id, atleta?.id]);

  async function guardar(tipo) {
    const url = nuevo[tipo];
    if (!url) return;
    setGuardando(tipo); setErr('');
    try {
      // Solo puede haber uno de cada tipo por atleta: el nuevo reemplaza al anterior.
      if (existentes[tipo]) await deleteExerciseMedia(existentes[tipo].id);
      const fila = await addExerciseMedia({
        exerciseId: ejercicio.exercise_id,
        url, tipo,
        etiqueta: `Para ${nombreAtleta}`,
        paraAtleta: atleta.id,
      });
      setExistentes((e) => ({ ...e, [tipo]: fila }));
      setNuevo((n) => ({ ...n, [tipo]: '' }));
    } catch (e) {
      setErr(e.message || 'No se pudo guardar.');
    } finally {
      setGuardando('');
    }
  }

  async function quitar(tipo) {
    if (!existentes[tipo]) return;
    setGuardando(tipo); setErr('');
    try {
      await deleteExerciseMedia(existentes[tipo].id);
      setExistentes((e) => ({ ...e, [tipo]: null }));
    } catch (e) {
      setErr(e.message || 'No se pudo quitar.');
    } finally {
      setGuardando('');
    }
  }

  const ocupado = !!guardando;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget && !ocupado) onCerrar(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 5300, background: 'rgba(9,11,16,.55)',
        display: 'grid', placeItems: 'center', padding: 16, fontFamily: FONT,
      }}
    >
      <div className="animate-fade-in" style={{
        width: '100%', maxWidth: 420, background: T.bg2, borderRadius: 20,
        border: `1px solid ${T.border}`, padding: 20, boxShadow: KP.shPop,
        maxHeight: '88svh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11, marginBottom: 15 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16.5, fontWeight: 800, color: T.text, lineHeight: 1.2 }}>
              Solo para {nombreAtleta}
            </div>
            <div style={{ fontSize: 12.5, color: T.text3, fontWeight: 600, marginTop: 3 }}>
              {ejercicio.name}
            </div>
          </div>
          <button type="button" onClick={onCerrar} disabled={ocupado}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text3, padding: 4, flexShrink: 0 }}>
            <X size={19} />
          </button>
        </div>

        {cargando ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text3, fontSize: 13, fontWeight: 600 }}>
            <Loader2 size={14} className="spin" /> Cargando…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Una línea, no tres. Andrés, 18 sep 2026: "creo que está bastante
                saturado de información, hay que limpiar y mejorar visualmente
                para más rápido entendimiento, pero los botones y el acomodo me
                gustan". Así que se quitó texto, no estructura. */}
            <div style={{ fontSize: 12.5, color: T.text2, fontWeight: 600, lineHeight: 1.5 }}>
              Lo verá <b>solo {nombreAtleta.split(' ')[0]}</b>. El repertorio no se toca.
            </div>

            <RanuraMedia
              titulo="Video" tipo="video" icono={Video}
              existente={existentes.video}
              valor={nuevo.video}
              onValor={(v) => setNuevo((n) => ({ ...n, video: v }))}
              onGuardar={() => guardar('video')}
              onQuitar={() => quitar('video')}
              ocupado={guardando === 'video'}
              deshabilitado={ocupado}
              vacio="hoy ve el general"
            />

            <RanuraMedia
              titulo="Foto de portada" tipo="foto" icono={ImageIcon}
              existente={existentes.foto}
              valor={nuevo.foto}
              onValor={(v) => setNuevo((n) => ({ ...n, foto: v }))}
              onGuardar={() => guardar('foto')}
              onQuitar={() => quitar('foto')}
              ocupado={guardando === 'foto'}
              deshabilitado={ocupado}
              vacio="hoy ve la general"
            />

            {err && (
              <div style={{ background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 11, padding: '10px 12px', fontSize: 12.5, fontWeight: 700 }}>
                {err}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

/** Una de las dos ranuras (video o foto) del cuadro de arriba. */
function RanuraMedia({
  titulo, tipo, icono, existente, valor, onValor,
  onGuardar, onQuitar, ocupado, deshabilitado, vacio,
}) {
  const puedeGuardar = !!valor && !deshabilitado;
  return (
    <div>
      {/* El título y el estado, en el MISMO renglón. Antes el título salía dos
          veces —aquí arriba en mayúsculas y otra vez como etiqueta del
          subidor— y el estado se comía un renglón entero él solo. */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 9 }}>
        <span style={{
          fontSize: 11, fontWeight: 800, color: T.text3, letterSpacing: 0.6,
          textTransform: 'uppercase', flexShrink: 0,
        }}>
          {titulo}
        </span>
        {!existente && (
          <span style={{ fontSize: 11.5, fontWeight: 600, color: T.text4, minWidth: 0 }}>
            {vacio}
          </span>
        )}
      </div>

      {existente ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {/* Una liga vive fuera: no se puede reproducir aquí, pero sí abrir. */}
          {tipo === 'video' && ligaExterna(existente.url) ? (
            <a
              href={existente.url} target="_blank" rel="noopener noreferrer"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                padding: '26px 14px', borderRadius: 13, background: T.bg3,
                fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: T.accent, textDecoration: 'none',
              }}
            >
              Abrir en {ligaExterna(existente.url).de}
            </a>
          ) : tipo === 'video' ? (
            <video
              src={existente.url} controls playsInline preload="metadata"
              /* El salto obliga a Safari de iPhone a dibujar un fotograma: con
                 `preload="metadata"` iOS carga la duración y deja el video en
                 negro hasta que se le da play. */
              onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.05; }}
              style={{ width: '100%', borderRadius: 13, background: '#000' }}
            />
          ) : (
            <img src={existente.url} alt=""
              style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 13, background: '#000', display: 'block' }} />
          )}
          <button type="button" onClick={onQuitar} disabled={deshabilitado}
            style={{
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
              padding: '11px 16px', borderRadius: 12, border: 'none',
              background: 'rgba(220,38,38,0.08)', color: T.danger,
              cursor: deshabilitado ? 'default' : 'pointer',
              fontFamily: FONT, fontSize: 13.5, fontWeight: 800,
            }}>
            {ocupado ? <Loader2 size={15} className="spin" /> : <Trash2 size={15} />} Quitar
          </button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
          <MediaUpload
            label="" icon={icono} value={valor} onChange={onValor}
            accept={tipo === 'video' ? 'video/*' : 'image/*'}
            kind={tipo === 'video' ? 'videos' : 'covers'}
          />
          <button type="button" onClick={onGuardar} disabled={!puedeGuardar}
            style={{
              padding: '11px 16px', borderRadius: 12, border: 'none',
              background: puedeGuardar ? T.accent : T.bg3,
              color: puedeGuardar ? '#fff' : T.text3,
              cursor: puedeGuardar ? 'pointer' : 'default',
              fontFamily: FONT, fontSize: 13.5, fontWeight: 800,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}>
            {ocupado ? <><Loader2 size={15} className="spin" /> Guardando…</> : 'Guardar'}
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Editor de sesión (un día) por sets                                   */
/* ------------------------------------------------------------------ */

/**
 * ¿Los ejercicios del editor se dibujan como filas o como tarjetas?
 *
 * Andrés, 28 sep 2026, desde el teléfono: "aquí también pueda escoger vista de
 * cards o de lista". Es la MISMA preferencia del repertorio y del selector de
 * ejercicios (`useVistaEjercicios`): él pidió poder verlo como quiera "en
 * cualquier pantalla donde salga la lista de ejercicios". Mientras no haya
 * elegido, el editor se queda con lo de siempre: filas en la compu y tarjetas
 * en el teléfono.
 */
function useEnFilas() {
  const esCompu = useIsDesktop();
  const [vista, eligeVista] = useVistaEjercicios();
  return [vista ? vista === 'lista' : esCompu, eligeVista];
}

/* ---- días con dos sesiones (AM / PM) ---- */
const turnoDe =(tag = '') => (tag.match(/\(([AP]M)\)/) || [])[1] || null;
const limpiaTag = (tag = '') => tag.replace(/^Sesi[óo]n \d+ \([AP]M\):\s*/, '');

/**
 * Los días de DOS SESIONES, ahora editables.
 *
 * QUÉ SON. 68 de los 175 días del plan de Andrés tienen dos sesiones el mismo
 * día —mañana y tarde— y se guardan distinto: `day.blocks[]` en vez de
 * `day.exercises[]`. Cada bloque es una sesión: `{ type, tag, exercises[] }`
 * para las de ejercicios, `{ type:'note', text }` para las de solo texto.
 *
 * CADA EJERCICIO SE DIBUJA CON LA MISMA FILA QUE EN UNA SESIÓN NORMAL
 * (`ExerciseRow` en la compu, `ExerciseCard` en el teléfono): foto, carga,
 * descanso, descripción, cue, «Con peso» y «Su video». Antes este editor tenía
 * su propia fila, más vieja, con solo ejercicio, series y reps. Andrés, 28 sep
 * 2026, viendo su lunes: "me sigue apareciendo así, diferente". Y esos campos
 * sí existen en sus datos —220 ejercicios traen «Con peso», 38 un cue— y la
 * app del atleta los enseña: solo el editor no los dejaba ver ni cambiar.
 *
 * LO QUE NO CAMBIA: aquí nada se interpreta. Estas sesiones NO son series
 * simples. Comprobado leyendo los datos reales:
 *
 *   · `sets: "—"` — un guion largo, que quiere decir "va dentro del cluster de
 *     arriba". El editor normal lo leería como un número vacío y lo borraría.
 *   · una fila `"Total clusters"` con `reps: "—"` y `sets: "3-4"`, que no es un
 *     ejercicio sino el total de la ronda.
 *   · reps que no son números: "15 min", "10 yd", "5/lado", "3-5".
 *   · filas de nota sueltas entre ejercicios: "CLUSTER (sin pausa entre los 4)".
 *
 * El editor normal agrupa por sets y los vuelve a escribir al guardar ("se
 * repite 3 veces"). Pasarle esto lo reescribiría y se perdería la forma. Por
 * eso la fila lleva aquí un campo más, «Series», en texto libre y por
 * ejercicio; las filas no se reagrupan ni se reordenan solas; y cada ejercicio
 * se guarda con `{...original, campo}` para no perder los campos que ninguna
 * fila dibuja (`focus`, `role`).
 */
function EditorSesionesDelDia({
  day, onPatch, repertoire, atleta, categorias, duenoId, masterId,
  onEjercicioCreado, onCategoriaCreada, onCategoriaBorrada,
}) {
  const bloques = day.blocks || [];
  const pregunta = useConfirmacion();
  const [enFilas] = useEnFilas();
  // El número de la sesión (0 = la primera del día) a la que va lo que se
  // elija del repertorio o se cree nuevo. `null` = nada abierto.
  const [eligiendoPara, setEligiendoPara] = useState(null);
  const [creandoPara, setCreandoPara] = useState(null);
  const [mediaDe, setMediaDe] = useState(null);

  const escribe = (fn) => onPatch({ blocks: fn(bloques.map((b) => ({ ...b }))) });

  const parcheaBloque = (bi, parche) => escribe((bs) => bs.map((b, i) => (i === bi ? { ...b, ...parche } : b)));

  const parcheaFila = (bi, fi, parche) => escribe((bs) => bs.map((b, i) => (i === bi ? {
    ...b,
    // `{...fila, ...parche}` y no un objeto nuevo: así sobreviven los campos
    // que ninguna fila dibuja (focus, role).
    exercises: (b.exercises || []).map((e, k) => (k === fi ? { ...e, ...parche } : e)),
  } : b)));

  const mueveFila = (bi, fi, dir) => escribe((bs) => bs.map((b, i) => {
    if (i !== bi) return b;
    const filas = [...(b.exercises || [])];
    const j = fi + dir;
    if (j < 0 || j >= filas.length) return b;
    [filas[fi], filas[j]] = [filas[j], filas[fi]];
    return { ...b, exercises: filas };
  }));

  const quitaFila = (bi, fi) => escribe((bs) => bs.map((b, i) => (i === bi
    ? { ...b, exercises: (b.exercises || []).filter((_, k) => k !== fi) }
    : b)));

  const agregaFilas = (bi, nuevas) => escribe((bs) => bs.map((b, i) => (i === bi
    ? { ...b, exercises: [...(b.exercises || []), ...nuevas] }
    : b)));

  const mueveBloque = (bi, dir) => escribe((bs) => {
    const j = bi + dir;
    if (j < 0 || j >= bs.length) return bs;
    const copia = [...bs];
    [copia[bi], copia[j]] = [copia[j], copia[bi]];
    return copia;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12 }}>
      {bloques.map((b, bi) => {
        const turno = turnoDe(b.tag);
        const filas = b.exercises || [];

        return (
          <div key={bi} style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '10px 11px',
              borderBottom: `1px solid ${T.border}`, background: T.bg2, flexWrap: 'wrap',
            }}>
              {turno && (
                <span style={{
                  fontSize: 10.5, fontWeight: 800, color: '#fff', borderRadius: 6, padding: '3px 7px',
                  background: turno === 'PM' ? T.accent : '#D97706', letterSpacing: 0.4, flexShrink: 0,
                }}>
                  {turno}
                </span>
              )}
              <input
                value={b.tag || ''}
                onChange={(e) => parcheaBloque(bi, { tag: e.target.value })}
                placeholder={`Sesión ${bi + 1}`}
                style={{
                  flex: 1, minWidth: 120, padding: '7px 9px', borderRadius: 8,
                  border: `1.5px solid transparent`, background: 'transparent', fontFamily: FONT,
                  fontSize: 16, fontWeight: 800, color: T.text, outline: 'none',
                }}
                onFocus={(e) => { e.target.style.borderColor = T.border; e.target.style.background = T.bg; }}
                onBlur={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'transparent'; }}
              />
              <IconBtn icon={ChevronUp} title="Subir esta sesión" onClick={() => mueveBloque(bi, -1)} disabled={bi === 0} />
              <IconBtn icon={ChevronDown} title="Bajar esta sesión" onClick={() => mueveBloque(bi, 1)} disabled={bi === bloques.length - 1} />
              <IconBtn icon={Trash2} danger title="Eliminar esta sesión" onClick={async () => {
                if (await pregunta({
                  titulo: `¿Eliminar «${limpiaTag(b.tag) || `Sesión ${bi + 1}`}»?`,
                  detalle: 'Se va con todos sus ejercicios. El otro turno del día se queda.',
                  confirmar: 'Sí, eliminarla',
                  peligro: true,
                })) escribe((bs) => bs.filter((_, i) => i !== bi));
              }} />
            </div>

            <div style={{ padding: '11px 11px 12px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {b.type === 'note' ? (
                <textarea
                  value={b.text || ''}
                  onChange={(e) => parcheaBloque(bi, { text: e.target.value })}
                  rows={3}
                  placeholder="Lo que tiene que hacer ese turno"
                  style={{
                    width: '100%', boxSizing: 'border-box', padding: '10px 11px', borderRadius: 10,
                    border: `1.5px solid ${T.border}`, background: T.bg2, fontFamily: FONT,
                    fontSize: 16, fontWeight: 500, color: T.text, outline: 'none', resize: 'vertical', lineHeight: 1.5,
                  }}
                />
              ) : (
                <>
                  {/* Igual que en una sesión normal: en la compu, una fila bajo
                      otra; en el teléfono, tarjetas. Las notas ocupan todo el
                      ancho para que el orden de la sesión se lea tal cual. */}
                  {filas.length > 0 && (
                    <div style={enFilas
                      ? { display: 'flex', flexDirection: 'column', gap: 8 }
                      : { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}
                    >
                      {filas.map((e, fi) => {
                        if (e.isNote) {
                          return (
                            <div key={fi} style={{
                              gridColumn: '1 / -1', display: 'flex', alignItems: 'flex-start', gap: 8,
                              background: T.accentBg, borderRadius: 12, padding: '9px 12px',
                            }}>
                              <StickyNote size={15} color={T.accent} style={{ flexShrink: 0, marginTop: 6 }} />
                              <textarea
                                value={e.text || ''}
                                onChange={(ev) => parcheaFila(bi, fi, { text: ev.target.value })}
                                rows={enFilas ? 1 : 2}
                                placeholder="Nota dentro de la sesión…"
                                style={{
                                  flex: 1, minWidth: 0, boxSizing: 'border-box', padding: '4px 0',
                                  border: 'none', background: 'transparent', fontFamily: FONT,
                                  fontSize: 13, fontWeight: 700, color: T.accent, outline: 'none',
                                  resize: 'none', lineHeight: 1.45,
                                }}
                              />
                              <IconBtn icon={ChevronUp} title="Subir" onClick={() => mueveFila(bi, fi, -1)} disabled={fi === 0} />
                              <IconBtn icon={ChevronDown} title="Bajar" onClick={() => mueveFila(bi, fi, 1)} disabled={fi === filas.length - 1} />
                              <IconBtn icon={Trash2} danger title="Quitar" onClick={() => quitaFila(bi, fi)} />
                            </div>
                          );
                        }
                        const props = {
                          ex: e,
                          repertoire,
                          atleta,
                          conSeries: true,
                          onVideoAtleta: setMediaDe,
                          onPatch: (parche) => parcheaFila(bi, fi, parche),
                          onMove: (dir) => mueveFila(bi, fi, dir),
                          onRemove: () => quitaFila(bi, fi),
                        };
                        return enFilas
                          ? <ExerciseRow key={fi} {...props} canUp={fi > 0} canDown={fi < filas.length - 1} />
                          : <ExerciseCard key={fi} {...props} canLeft={fi > 0} canRight={fi < filas.length - 1} />;
                      })}
                    </div>
                  )}

                  <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                    <Pill icon={Plus} primary onClick={() => setEligiendoPara(bi)}>Agregar ejercicio</Pill>
                    <Pill icon={StickyNote} onClick={() => agregaFilas(bi, [{ isNote: true, text: '' }])}>Nota</Pill>
                    <Pill icon={Dumbbell} onClick={() => setCreandoPara(bi)}>Ejercicio nuevo</Pill>
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })}

      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        <Pill icon={Plus} onClick={() => escribe((bs) => [...bs, { type: 'lift', tag: `Sesión ${bs.length + 1}`, exercises: [] }])}>
          Otra sesión el mismo día
        </Pill>
        <Pill icon={StickyNote} onClick={() => escribe((bs) => [...bs, { type: 'note', tag: `Sesión ${bs.length + 1}`, text: '' }])}>
          Sesión de solo texto
        </Pill>
      </div>

      <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 600, lineHeight: 1.5 }}>
        Aquí nada se corrige solo: «—» en las series y reps como «30 yd» o «5/lado»
        se guardan tal cual los escribas.
      </div>

      {mediaDe && (
        <MediaParaEsteAtleta
          ejercicio={mediaDe}
          atleta={atleta}
          onCerrar={() => setMediaDe(null)}
        />
      )}

      {creandoPara != null && (
        <CrearEjercicioRapido
          categorias={categorias}
          duenoId={duenoId}
          masterId={masterId}
          onCategoriaCreada={onCategoriaCreada}
          onCategoriaBorrada={onCategoriaBorrada}
          onCancelar={() => setCreandoPara(null)}
          onCreado={(fila, llevaPeso) => {
            onEjercicioCreado?.(fila);
            agregaFilas(creandoPara, [{ ...newExercise(fila), carga: llevaPeso }]);
            setCreandoPara(null);
          }}
        />
      )}

      {eligiendoPara != null && (
        <RepertoirePicker
          exercises={repertoire}
          title={`Agregar a «${limpiaTag(bloques[eligiendoPara]?.tag) || `Sesión ${eligiendoPara + 1}`}»`}
          onClose={() => setEligiendoPara(null)}
          onConfirm={(exs) => {
            agregaFilas(eligiendoPara, exs.map((e) => newExercise(e)));
            setEligiendoPara(null);
          }}
        />
      )}
    </div>
  );
}

function SessionEditor({ day, repertoire, categorias = [], atleta, onEjercicioCreado, onPatch, onDelete, onCopy, onSaveToCatalog, onApplyCatalog, onClear, duenoId, masterId, onCategoriaCreada, onCategoriaBorrada }) {
  const { t } = usePalabras();
  const [creandoEjercicio, setCreandoEjercicio] = useState(false);
  const [mediaDe, setMediaDe] = useState(null);
  const pregunta = useConfirmacion();
  const esCompu = useIsDesktop();
  const [enFilas] = useEnFilas();
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
        <DayHeader day={day} onPatch={onPatch} onDelete={onDelete} onCopy={onCopy} onSaveToCatalog={onSaveToCatalog} onApplyCatalog={onApplyCatalog} onClear={onClear} dual conVista />
        <EditorSesionesDelDia
          day={day}
          onPatch={onPatch}
          repertoire={repertoire}
          atleta={atleta}
          categorias={categorias}
          duenoId={duenoId}
          masterId={masterId}
          onEjercicioCreado={onEjercicioCreado}
          onCategoriaCreada={onCategoriaCreada}
          onCategoriaBorrada={onCategoriaBorrada}
        />
      </div>
    );
  }

  const nSets = blocks.filter((b) => b.type === 'set').length;
  /* Un día OFF vacío es un día de descanso, no una sesión a medio armar.
     Antes enseñaba "0 sets" y "Agregar set" como botón azul grande: la
     pantalla empujaba justo a lo contrario de lo que el coach acababa de
     decidir. Si el día OFF ya tiene sets —porque le cambiaron el tipo después—
     se enseñan igual: esconderlos haría que existieran sin que nadie los viera. */
  const descanso = (day.cat || 'gym') === 'off' && nSets === 0;

  return (
    <div style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 18, padding: 16, boxShadow: KP.shCard }}>
      <DayHeader day={day} onPatch={onPatch} onDelete={onDelete} onCopy={onCopy} onSaveToCatalog={onSaveToCatalog} onApplyCatalog={onApplyCatalog} onClear={onClear} nSets={descanso ? null : nSets} conVista={!descanso} />

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14 }}>
        {blocks.map((b, bi) => {
          if (b.type === 'note') {
            return (
              <div key={bi} style={{ display: 'flex', gap: 8, alignItems: 'center', background: T.accentBg, borderRadius: 12, padding: '9px 12px' }}>
                <StickyNote size={15} color={T.accent} style={{ flexShrink: 0 }} />
                <input
                  value={b.ex.text || ''}
                  onChange={(e) => writeBlocks((bs) => bs.map((x, k) => (k === bi ? { ...x, ex: { ...x.ex, text: e.target.value } } : x)))}
                  placeholder={t('Nota para el atleta…')}
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
                <IconBtn icon={Trash2} danger onClick={async () => {
                  if (await pregunta({ titulo: `¿Eliminar el Set ${setIdx} completo?`, confirmar: 'Sí, eliminarlo', peligro: true })) writeBlocks((bs) => bs.filter((_, k) => k !== bi));
                }} />
              </div>
              {(() => {
                // Un solo juego de handlers. La tarjeta y la fila reciben
                // exactamente lo mismo; lo unico que cambia es como se dibuja.
                const props = (m, mi) => ({
                  ex: m,
                  repertoire,
                  atleta,
                  onVideoAtleta: setMediaDe,
                  onPatch: (patch) => writeBlocks((bs) => bs.map((x, k) => (k === bi
                    ? { ...x, members: x.members.map((mm, kk) => (kk === mi ? { ...mm, ...patch } : mm)) }
                    : x))),
                  onMove: (dir) => writeBlocks((bs) => bs.map((x, k) => {
                    if (k !== bi) return x;
                    const j = mi + dir;
                    if (j < 0 || j >= x.members.length) return x;
                    const members = [...x.members];
                    [members[mi], members[j]] = [members[j], members[mi]];
                    return { ...x, members };
                  })),
                  onRemove: () => writeBlocks((bs) => bs
                    .map((x, k) => (k === bi ? { ...x, members: x.members.filter((_, kk) => kk !== mi) } : x))
                    .filter((x) => x.type !== 'set' || x.members.length > 0)),
                });

                if (!enFilas) {
                  return (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(230px, 1fr))', gap: 10 }}>
                      {b.members.map((m, mi) => (
                        <ExerciseCard key={mi} {...props(m, mi)}
                          canLeft={mi > 0} canRight={mi < b.members.length - 1} />
                      ))}
                    </div>
                  );
                }
                /* Ya no es una tabla: cada ejercicio es una tarjeta con sus
                   propios rótulos. Ver `ExerciseRow` para el motivo. Y al irse
                   la tabla se va también el `overflow-x` que la envolvía, que
                   era lo que recortaba las listas desplegables. */
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {b.members.map((m, mi) => (
                      <ExerciseRow key={mi} {...props(m, mi)}
                        canUp={mi > 0} canDown={mi < b.members.length - 1} />
                    ))}
                  </div>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Agregar contenido. En la compu los tres caben en una fila y da igual.
          En el telefono NO da igual: "Agregar set" es a lo que vienes, y los
          otros dos son casos sueltos. Si los tres pesan lo mismo, cada vez hay
          que leer los tres para encontrar el de siempre. Aqui el principal
          ocupa todo el ancho —imposible de fallar con el pulgar— y los otros
          dos van abajo, mas chicos, repartidos a la mitad. */}
      {descanso ? (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.5 }}>
            <b style={{ color: T.text }}>Día de descanso.</b> {t('El atleta no tiene nada que hacer. Si quieres, déjale una nota.')}
          </div>
          <Pill icon={StickyNote} onClick={() => writeBlocks((bs) => [...bs, { type: 'note', ex: { isNote: true, text: '' } }])}>Nota</Pill>
        </div>
      ) : esCompu ? (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
          <Pill icon={Plus} primary onClick={() => setPickerCtx({ mode: 'new-set' })}>Agregar set</Pill>
          <Pill icon={StickyNote} onClick={() => writeBlocks((bs) => [...bs, { type: 'note', ex: { isNote: true, text: '' } }])}>Nota</Pill>
          <Pill icon={Dumbbell} onClick={() => setCreandoEjercicio(true)}>Ejercicio nuevo</Pill>
        </div>
      ) : (
        <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <button
            type="button" onClick={() => setPickerCtx({ mode: 'new-set' })}
            style={{
              width: '100%', minHeight: 52, display: 'flex', alignItems: 'center',
              justifyContent: 'center', gap: 9, borderRadius: 16, border: 'none', cursor: 'pointer',
              background: `linear-gradient(135deg, ${T.accent}, ${T.accentDk})`, color: '#fff',
              fontFamily: FONT, fontSize: 16, fontWeight: 800, boxShadow: KP.shBtn,
            }}
          >
            <Plus size={20} /> Agregar set
          </button>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            <button
              type="button"
              onClick={() => writeBlocks((bs) => [...bs, { type: 'note', ex: { isNote: true, text: '' } }])}
              style={{
                minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                borderRadius: 14, border: `1.5px solid ${T.border}`, background: T.bg2, cursor: 'pointer',
                fontFamily: FONT, fontSize: 14, fontWeight: 700, color: T.text2,
              }}
            >
              <StickyNote size={16} /> Nota
            </button>
            <button
              type="button"
              onClick={() => setCreandoEjercicio(true)}
              style={{
                minHeight: 46, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                borderRadius: 14, border: `1.5px solid ${T.border}`, background: T.bg2, cursor: 'pointer',
                fontFamily: FONT, fontSize: 14, fontWeight: 700, color: T.text2,
              }}
            >
              <Dumbbell size={16} /> Ejercicio nuevo
            </button>
          </div>
        </div>
      )}

      {mediaDe && (
        <MediaParaEsteAtleta
          ejercicio={mediaDe}
          atleta={atleta}
          onCerrar={() => setMediaDe(null)}
        />
      )}

      {creandoEjercicio && (
        <CrearEjercicioRapido
          categorias={categorias}
          duenoId={duenoId}
          masterId={masterId}
          onCategoriaCreada={onCategoriaCreada}
          onCategoriaBorrada={onCategoriaBorrada}
          onCancelar={() => setCreandoEjercicio(false)}
          onCreado={(fila, llevaPeso) => {
            onEjercicioCreado?.(fila);
            writeBlocks((bs) => [
              ...bs,
              { type: 'set', members: [{ ...newExercise(fila), carga: llevaPeso }], rounds: '3' },
            ]);
            setCreandoEjercicio(false);
          }}
        />
      )}

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

/**
 * Hoja de acciones para telefono.
 *
 * En la compu las acciones de la sesion caben en una fila y se leen de un
 * vistazo. En el telefono no caben: se acomodan en filas desiguales y las
 * ocho terminan pesando lo mismo, asi que "Agregar set" —que es a lo que
 * vienes— compite con "Eliminar sesion", que tocas una vez al mes.
 *
 * Aqui se guardan las que casi nunca usas. Cada una ocupa una fila completa
 * de 52px, que es lo que necesita un dedo para no equivocarse, y la de
 * borrar va hasta abajo y separada del resto.
 *
 * En la compu sale como card al centro, no pegada abajo. Andrés, 24 sep 2026,
 * sobre la hoja del programa: "lo único que no me gusta es que la card está
 * como que saliendo de la parte de abajo". Con los tres puntos del editor esta
 * hoja se abre a cada rato, así que le aplica lo mismo.
 */
function HojaAcciones({ acciones, onClose }) {
  const esCompu = useIsDesktop();
  return (
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2700, background: 'rgba(17,19,24,0.45)',
        display: 'flex', alignItems: esCompu ? 'center' : 'flex-end', justifyContent: 'center',
        padding: esCompu ? 24 : 0,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={esCompu ? 'animate-fade-in' : 'animate-sheet'}
        style={{
          width: '100%', maxWidth: esCompu ? 400 : undefined, background: T.bg,
          borderRadius: esCompu ? 20 : '22px 22px 0 0',
          padding: esCompu ? 10 : '10px 10px calc(14px + env(safe-area-inset-bottom))',
          fontFamily: FONT, boxShadow: KP.shPop,
        }}
      >
        {!esCompu && (
          <div style={{
            width: 38, height: 4, borderRadius: 999, background: T.borderHi,
            margin: '4px auto 10px',
          }} />
        )}
        {acciones.map((a, i) => (
          <button
            key={a.texto}
            type="button"
            onClick={() => { onClose(); a.onClick(); }}
            style={{
              width: '100%', minHeight: 52, display: 'flex', alignItems: 'center', gap: 13,
              padding: '0 14px', borderRadius: 14, border: 'none', cursor: 'pointer',
              background: 'transparent', fontFamily: FONT, fontSize: 15.5, fontWeight: 700,
              color: a.peligro ? T.danger : T.text, textAlign: 'left',
              marginTop: a.peligro && i > 0 ? 6 : 0,
              borderTop: a.peligro && i > 0 ? `1px solid ${T.border}` : 'none',
            }}
          >
            <a.icon size={19} color={a.peligro ? T.danger : T.text3} />
            {a.texto}
          </button>
        ))}
        <button
          type="button" onClick={onClose}
          style={{
            width: '100%', minHeight: 50, marginTop: 8, borderRadius: 14,
            border: `1.5px solid ${T.border}`, background: T.bg2, cursor: 'pointer',
            fontFamily: FONT, fontSize: 15, fontWeight: 700, color: T.text2,
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

/** Cambiar la forma de un plan que ya existe: las tres, con la de ahora
    marcada. Misma caja que `HojaAcciones`. */
function HojaFormas({ actual, onElegir, onClose }) {
  const { t } = usePalabras();
  const esCompu = useIsDesktop();
  return (
    <div
      onMouseDown={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 2700, background: 'rgba(17,19,24,0.45)',
        display: 'flex', alignItems: esCompu ? 'center' : 'flex-end', justifyContent: 'center',
        padding: esCompu ? 24 : 0,
      }}
    >
      <div
        onMouseDown={(e) => e.stopPropagation()}
        className={esCompu ? 'animate-fade-in' : 'animate-sheet'}
        style={{
          width: '100%', maxWidth: esCompu ? 460 : undefined, background: T.bg,
          borderRadius: esCompu ? 20 : '22px 22px 0 0',
          padding: esCompu ? 12 : '10px 12px calc(14px + env(safe-area-inset-bottom))',
          fontFamily: FONT, boxShadow: KP.shPop,
        }}
      >
        {!esCompu && (
          <div style={{
            width: 38, height: 4, borderRadius: 999, background: T.borderHi,
            margin: '4px auto 10px',
          }} />
        )}
        <div style={{ fontSize: 16, fontWeight: 800, color: T.text, padding: '4px 6px 10px' }}>
          {t('La forma del plan')}
        </div>
        {FORMAS.map((f) => {
          const es = f.id === actual;
          return (
            <button
              key={f.id} type="button" disabled={es}
              onClick={() => { onClose(); onElegir(f.id); }}
              aria-current={es || undefined}
              style={{
                display: 'flex', gap: 12, alignItems: 'center', width: '100%', textAlign: 'left',
                padding: 12, borderRadius: 14, marginBottom: 7, fontFamily: FONT,
                border: `1.5px solid ${es ? T.accent : T.border}`,
                background: es ? T.accentBg : T.bg2, cursor: es ? 'default' : 'pointer',
              }}
            >
              <span style={{
                width: 40, height: 40, borderRadius: 12, flexShrink: 0, display: 'grid', placeItems: 'center',
                background: es ? T.accent : T.accentBg, color: es ? '#fff' : T.accent,
              }}>
                <f.icon size={20} />
              </span>
              <span style={{ flex: 1, minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 15, fontWeight: 800, color: T.text }}>{f.title}</span>
                <span style={{ display: 'block', fontSize: 12.5, color: T.text2, marginTop: 2, lineHeight: 1.4 }}>{f.desc}</span>
              </span>
              {es && (
                <span style={{
                  flexShrink: 0, fontSize: 11, fontWeight: 800, color: T.accent, background: T.bg,
                  borderRadius: 999, padding: '4px 9px',
                }}>
                  Así está
                </span>
              )}
            </button>
          );
        })}
        <button
          type="button" onClick={onClose}
          style={{
            width: '100%', minHeight: 50, marginTop: 4, borderRadius: 14,
            border: `1.5px solid ${T.border}`, background: T.bg2, cursor: 'pointer',
            fontFamily: FONT, fontSize: 15, fontWeight: 700, color: T.text2,
          }}
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}

function DayHeader({ day, onPatch, onDelete, onCopy, onSaveToCatalog, onApplyCatalog, onClear, nSets, dual, conVista = false }) {
  const { user } = useAuth();
  const esCompu = useIsDesktop();
  const [enFilas, eligeVista] = useEnFilas();
  const [menu, setMenu] = useState(false);
  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
        {/* 220 px de base y no `flex: 1` pelado. Con `flex: 1` la base es 0, así
            que el nombre nunca bajaba de renglón: se encogía para dejarle sitio al
            tipo y al contador. Medido a 375 px: el campo quedaba en ~70 px, la
            etiqueta en tres renglones, y "Descanso" se leía "Desca". Con base
            real, en el teléfono el nombre ocupa su renglón y en la compu siguen
            los tres juntos. */}
        <div style={{ flex: '1 1 220px', minWidth: 0 }}>
        <Field label="Nombre de la sesión">
          {/* En un día de dos sesiones el nombre casi nunca está guardado: la
              app del atleta arma el título con las dos ("AM Velocidad máxima ·
              PM French Contrast"). Aquí salía "Ej. Tren inferior" y parecía que
              al día le faltaba nombre. Se enseña lo mismo que ve el atleta,
              como sugerencia gris — no se escribe nada en el plan. Con el turno
              delante y sin «+», que se leía como una sola sesión. */}
          <input
            value={day.name || ''}
            onChange={(e) => onPatch({ name: e.target.value })}
            placeholder={dual && day.blocks?.length
              ? textoDeSesiones(sesionesDelTitulo({ blocks: day.blocks }))
              : 'Ej. Tren inferior — fuerza'}
            style={inputStyle}
          />
        </Field>
        </div>
        <div style={{ flex: '0 1 190px', minWidth: 150 }}>
          <Field label="Tipo de sesión">
            {/* Era un <select>: en el iPhone, la rueda gris del sistema. Ahora
                es la lista de la app, con los colores a la vista y con los
                tipos que el propio coach se haya creado. */}
            <SelectorTipoSesion day={day} onPatch={onPatch} coachId={user?.id} />
          </Field>
        </div>
        {nSets != null && (
          <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text3, paddingBottom: 12 }}>
            {nSets} set{nSets !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 12, paddingTop: 12, borderTop: `1px solid ${T.border}`, alignItems: 'center' }}>
        {esCompu ? (
          <>
            {!dual && <Pill icon={FolderOpen} onClick={onApplyCatalog}>Desde catálogo</Pill>}
            {!dual && <Pill icon={Save} onClick={onSaveToCatalog}>Guardar en catálogo</Pill>}
            <Pill icon={Copy} onClick={onCopy}>Copiar</Pill>
            {!dual && <Pill icon={Eraser} onClick={onClear}>Limpiar</Pill>}
            <Pill icon={Trash2} danger onClick={onDelete}>Eliminar sesión</Pill>
          </>
        ) : (
          <button
            type="button" onClick={() => setMenu(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44,
              padding: '0 16px', borderRadius: 999, border: `1.5px solid ${T.border}`,
              background: T.bg2, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700,
              color: T.text2,
            }}
          >
            <Settings2 size={16} /> Opciones de la sesión
          </button>
        )}
        {/* Cómo se ven los ejercicios de abajo: filas o tarjetas. Al final y
            pegado a la derecha, como en el repertorio: se usa menos que las
            acciones de la sesión. Sin ejercicios que ver (un día de descanso)
            no se ofrece. */}
        {conVista && (
          <>
            <span style={{ flex: 1 }} />
            <InterruptorVista vista={enFilas ? 'lista' : 'tarjetas'} onCambio={eligeVista} />
          </>
        )}
      </div>

      {menu && (
        <HojaAcciones
          onClose={() => setMenu(false)}
          acciones={[
            ...(dual ? [] : [{ icon: FolderOpen, texto: 'Desde catálogo', onClick: onApplyCatalog }]),
            ...(dual ? [] : [{ icon: Save, texto: 'Guardar en catálogo', onClick: onSaveToCatalog }]),
            { icon: Copy, texto: 'Copiar sesión', onClick: onCopy },
            ...(dual ? [] : [{ icon: Eraser, texto: 'Limpiar sesión', onClick: onClear }]),
            { icon: Trash2, texto: 'Eliminar sesión', onClick: onDelete, peligro: true },
          ]}
        />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Builder principal                                                    */
/* ------------------------------------------------------------------ */

export default function PlanBuilder({ athlete, planRow, onClose, onSaved }) {
  const esCompu = useIsDesktop();
  const pregunta = useConfirmacion();
  const { user, profile } = useAuth();
  const { t } = usePalabras();
  const isMaster = !!profile?.is_owner;
  const isNew = !planRow;
  const [title, setTitle] = useState(planRow?.title || t('Plan de entrenamiento'));
  const [phases, setPhases] = useState(() => (planRow?.data?.phases ? clone(planRow.data.phases) : []));
  // La forma del plan: 'rutina' | 'semanas' | 'fases' (ver `estructuraDelPlan`).
  // De ella sale `kind`: 'weekly' para la rutina, 'periodized' para las otras.
  const [estructura, setEstructura] = useState(() => (planRow ? estructuraDelPlan(planRow.data) : 'fases'));
  const kind = kindDeEstructura(estructura);
  const isWeekly = kind === 'weekly';
  const [formasAbiertas, setFormasAbiertas] = useState(false);
  /* DÓNDE ESTABA EL COACH, al refrescar la app (ver `lugar.js`): fase, semana,
     día y, en el teléfono, si tenía abierto el editor del día. Solo con un plan
     que ya existe —uno nuevo sin guardar se pierde al refrescar— y solo al
     arrancar: al abrir el editor con la app ya en uso, el coach cae donde va el
     atleta, como siempre. Lo guardado se comprueba contra el plan de ahora: si
     se borró la fase o la semana, no se usa. */
  const [restaurado] = useState(() => {
    if (isNew || !athlete?.id || !esArranque()) return null;
    return lugarDelPlan(leeLugar(user?.id, `plan.${athlete.id}`), planRow?.data?.phases ?? []);
  });
  /* Un plan que ya existe abre SIEMPRE en la hoja, con una fase abierta. La
     lista de fases como pantalla aparte se fue el 24 sep 2026: la hoja ya las
     enseña todas. Ver `NavegadorDelPlan`. */
  const [nav, setNav] = useState(() => (isNew ? { level: 'start' } : { level: 'phase', pi: restaurado?.pi ?? 0 }));
  const [weekIdx, setWeekIdx] = useState(restaurado?.wi ?? 0);
  const [activeWeekday, setActiveWeekday] = useState(
    () => restaurado?.dia ?? diaParaSemana(planRow?.data?.phases?.[0]?.weekData?.[0], 'Lun'),
  );
  const [detailsOpen, setDetailsOpen] = useState(false);
  // En el teléfono la hoja y el editor del día no caben juntos: tocar un día
  // abre su editor a pantalla completa, con flecha para volver a la hoja.
  const [editandoDiaTel, setEditandoDiaTel] = useState(restaurado?.editandoDiaTel ?? false);
  // Qué menú de tres puntos está abierto: { tipo: 'plan' | 'fase' | 'semana', pi }.
  const [menu, setMenu] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  // Ya se guardó en esta sesión del editor: el botón dice "Guardado" hasta
  // que se vuelva a cambiar algo.
  const [haGuardado, setHaGuardado] = useState(false);
  const [err, setErr] = useState('');
  const [repertoire, setRepertoire] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [masterIdCat, setMasterIdCat] = useState(null);
  // Se ofrecen las de la app y las propias, no las de otros coaches (que el
  // master sí puede leer). Ver SelectorCategoria.
  const categoriasVisibles = useMemo(
    () => categorias.filter((c) => !c.created_by || c.created_by === masterIdCat || c.created_by === user?.id),
    [categorias, masterIdCat, user?.id],
  );
  const [clipboard, setClipboard] = useState(null);
  const [modal, setModal] = useState(null);

  const [wizWeeks, setWizWeeks] = useState(4);
  const [wizDays, setWizDays] = useState(['Lun', 'Mié', 'Vie']);

  // Repertorio para el picker: cada coach ve la base del master + los suyos
  // (no los de otros coaches). El master ve todo.
  //
  // Encima se aplican SUS versiones de los ejercicios base: si personalizó el
  // video de la sentadilla, al armar el plan tiene que ver el suyo, no el del
  // master. Si no, estaría asignando a ciegas.
  useEffect(() => {
    Promise.all([listExercises(), getMasterId(), listCategories(), listExerciseOverrides(user?.id)])
      .then(([exs, mId, cats, mias]) => {
        const tagged = tagRepertoire(aplicarOverrides(exs, mias, cats), mId, user?.id);
        setRepertoire(isMaster ? tagged : tagged.filter((e) => e.isBase || e.isMine));
        setCategorias(cats);
        setMasterIdCat(mId);
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

  /* DÓNDE VA EL ATLETA, marcado en la hoja del editor igual que en "Ver el
     plan": se lee su posición guardada y se calcula con `dondeVa`, la misma
     cuenta que hace su teléfono. La primera vez, además, la hoja se abre ahí:
     es lo más probable que el coach venga a tocar.

     `undefined` = todavía no llega. Distinto de `null` = llegó y no hay: sin
     esa diferencia se marcaría el primer día del plan mientras carga. */
  const [cursorAtleta, setCursorAtleta] = useState(undefined);
  // Si el coach ya se movió por la hoja, lo que llegue tarde no lo mueve. Y si
  // el editor se abrió en el lugar donde estaba antes de refrescar, tampoco:
  // ese lugar manda sobre "donde va el atleta".
  const yaNavego = useRef(!!restaurado);
  useEffect(() => {
    if (!athlete?.id || isNew) return undefined;
    let vivo = true;
    getAthleteState(athlete.id)
      .then((st) => st?.data?.['wr:cursor'] ?? null, () => null)
      .then((cursor) => {
        if (!vivo) return;
        setCursorAtleta(cursor);
        if (yaNavego.current) return;
        const fs = planRow?.data?.phases ?? [];
        const aqui = dondeVa(fs, planRow?.data?.kind, cursor);
        const i = fs.findIndex((f) => f.id === aqui?.faseId);
        if (i < 0) return;
        const wi = Math.max(0, fs[i].weekData.findIndex((w) => w.num === aqui.semana));
        const semana = fs[i].weekData[wi];
        yaNavego.current = true;
        setNav({ level: 'phase', pi: i });
        setWeekIdx(wi);
        setActiveWeekday(aqui.dia != null && semana?.days?.[aqui.dia]
          ? semana.days[aqui.dia].day
          : diaParaSemana(semana, 'Lun'));
      });
    return () => { vivo = false; };
  }, [athlete?.id, isNew, planRow]);
  const aquiAtleta = useMemo(
    () => (cursorAtleta === undefined ? null : dondeVa(phases, kind, cursorAtleta)),
    [phases, kind, cursorAtleta],
  );

  /* El desplazamiento. `main` es el que se desplaza, y no se desmonta al
     cambiar de la hoja al editor del día: sin esto, en el teléfono el editor
     abría a media altura, donde estaba el dedo en la hoja; y al volver, la
     hoja no regresaba al día que tocaste. */
  const mainRef = useRef(null);
  const scrollHoja = useRef(0);
  const scrollPendiente = useRef(null);
  useLayoutEffect(() => {
    if (scrollPendiente.current == null || !mainRef.current) return;
    mainRef.current.scrollTop = scrollPendiente.current;
    scrollPendiente.current = null;
  });
  const abreEditorTel = () => {
    if (!esCompu && !editandoDiaTel) scrollHoja.current = mainRef.current?.scrollTop ?? 0;
    scrollPendiente.current = 0;
    setEditandoDiaTel(true);
  };
  const vuelveALaHoja = () => {
    scrollPendiente.current = scrollHoja.current;
    setEditandoDiaTel(false);
    setDetailsOpen(false);
  };

  // Dónde está el coach en este plan, para volver ahí al refrescar (ver
  // `lugar.js`). Solo con un plan que ya existe y con una fase abierta.
  useEffect(() => {
    if (isNew || !athlete?.id || nav.level !== 'phase') return;
    guardaLugar(user?.id, `plan.${athlete.id}`, {
      pi: nav.pi, wi: weekIdx, dia: activeWeekday, tel: editandoDiaTel,
    });
  }, [isNew, athlete?.id, user?.id, nav, weekIdx, activeWeekday, editandoDiaTel]);

  // Y cuánto había bajado, en esta hoja o en este día (`main` es lo que se
  // desplaza, no la ventana).
  useScrollLugar(
    !isNew && athlete?.id && nav.level === 'phase'
      ? `plan.${athlete.id}.${nav.pi}.${weekIdx}.${activeWeekday}.${editandoDiaTel ? 'dia' : 'hoja'}`
      : null,
    true,
    mainRef,
  );

  /* Recordar DÓNDE estabas no es recordar lo que escribías: refrescar con
     cambios sin guardar los pierde. Como ahora el editor se vuelve a abrir en
     el mismo sitio, sería fácil creer que también volvieron. El navegador
     pregunta antes de dejarte ir. (En el iPhone, Safari ignora el aviso.) */
  useEffect(() => {
    if (!dirty) return undefined;
    const avisa = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', avisa);
    return () => window.removeEventListener('beforeunload', avisa);
  }, [dirty]);

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
    if (!title.trim()) { setErr(t('Ponle un título al plan')); return; }
    if (phases.length === 0) { setErr(t('El plan necesita al menos una fase')); return; }
    setErr('');
    setSaving(true);
    try {
      const data = normalize(phases);
      const row = planRow
        ? await updatePlan(planRow.id, { title: title.trim(), phases: data, kind, estructura })
        : await createPlan({ userId: athlete.id, title: title.trim(), phases: data, kind, estructura, createdBy: user?.id });
      setDirty(false);
      setHaGuardado(true);
      /* Guardar NO cierra el editor: el coach se queda donde estaba para ver
         cómo quedó (Andrés, 27 sep 2026). Quien lo abrió recibe el plan
         guardado, y con él `planRow` cambia; eso vuelve a leer dónde va el
         atleta, y sin esta marca movería la hoja a su día. */
      yaNavego.current = true;
      onSaved(row);
    } catch (e) {
      setErr(e.message || 'Error al guardar');
    } finally {
      setSaving(false);
    }
  }

  /* Lo que hacen los tres puntos. Son las operaciones que antes vivían en la
     lista de fases y en el modal de la semana, sacadas a funciones para que
     las usen los dos sitios sin copiarse. */
  const moverFase = (pi, dir) => {
    touch((ps) => moveItem(ps, pi, dir));
    // La fase abierta sigue a su contenido, no a su posición.
    if (nav.pi === pi) setNav({ level: 'phase', pi: pi + dir });
    else if (nav.pi === pi + dir) setNav({ level: 'phase', pi });
  };
  const duplicarFase = (pi) => {
    touch((ps) => {
      const c = clone(ps[pi]);
      c.id = `p-${rid()}`; c.num = nextPhaseNum(ps); c.name = `${c.name} (copia)`;
      return [...ps.slice(0, pi + 1), c, ...ps.slice(pi + 1)];
    });
    // Se abre la copia: agregar algo y quedarte donde estabas se lee como que
    // no pasó nada.
    setDetailsOpen(false);
    setNav({ level: 'phase', pi: pi + 1 });
    setWeekIdx(0);
  };
  const eliminarFase = async (pi) => {
    const ph = phases[pi];
    if (!ph || phases.length <= 1) return;
    if (!await pregunta({ titulo: `¿Eliminar la fase "${ph.name}"?`, detalle: 'Se va con todas sus semanas y sesiones.', confirmar: 'Sí, eliminarla', peligro: true })) return;
    touch((ps) => ps.filter((_, i) => i !== pi));
    const abierta = nav.pi > pi ? nav.pi - 1 : nav.pi;
    setNav({ level: 'phase', pi: Math.max(0, Math.min(abierta, phases.length - 2)) });
    if (nav.pi === pi) { setWeekIdx(0); setDetailsOpen(false); }
  };
  const agregarFase = () => {
    touch((ps) => [...ps, newPhase(nextPhaseNum(ps))]);
    setDetailsOpen(false);
    setWeekIdx(0);
    setNav({ level: 'phase', pi: phases.length });
  };
  const agregarSemana = (pi) => {
    const nueva = phases[pi]?.weekData?.length ?? 0;
    patchPhase(pi, (ph) => ({ weekData: [...ph.weekData, newWeek(nextWeekNum(ph))] }));
    setNav({ level: 'phase', pi });
    setWeekIdx(nueva);
  };
  const semanaAbierta = () => Math.max(0, Math.min(weekIdx, (phases[nav.pi]?.weekData?.length ?? 1) - 1));
  /* En "varias semanas" la semana se nombra de corrido (la 4, aunque por
     dentro sea la 1 de otra fase), y "todas las semanas" son las del plan
     entero, no las de una fase que el coach no ve. */
  const deCorrido = estructura === 'semanas';
  const numeroDeSemana = (ph, wk, fallback) => (deCorrido ? (semanaGlobal(phases, ph?.id, wk?.num) ?? fallback) : (wk?.num ?? fallback));
  const nombreSemana = (ph, wk, fallback) => weekName({ ...wk, num: numeroDeSemana(ph, wk, fallback) }, fallback);
  const duplicarSemana = () => {
    const wi = semanaAbierta();
    patchPhase(nav.pi, (ph) => {
      const c = clone(ph.weekData[wi]);
      c.num = nextWeekNum(ph); // conserva el título; solo cambia el número
      return { weekData: [...ph.weekData.slice(0, wi + 1), c, ...ph.weekData.slice(wi + 1)] };
    });
    setWeekIdx(wi + 1);
  };
  const copiarSemanaATodas = async () => {
    const wi = semanaAbierta();
    if (!await pregunta({
      titulo: '¿Copiar esta semana a todas las demás?',
      detalle: `Las otras semanas ${deCorrido ? t('del plan') : 'de la fase'} pierden lo que tengan y quedan igual que esta.`,
      confirmar: 'Sí, copiarla',
    })) return false;
    if (deCorrido) {
      const dias = phases[nav.pi].weekData[wi].days;
      touch((ps) => ps.map((ph, pi) => ({
        ...ph,
        weekData: ph.weekData.map((wk, j) => (pi === nav.pi && j === wi ? wk : { ...wk, days: clone(dias) })),
      })));
      return true;
    }
    patchPhase(nav.pi, (ph) => ({
      weekData: ph.weekData.map((wk, j) => (j === wi ? wk : { ...wk, days: clone(ph.weekData[wi].days) })),
    }));
    return true;
  };
  const eliminarSemana = async () => {
    const ph = phases[nav.pi];
    const wi = semanaAbierta();
    const wk = ph?.weekData?.[wi];
    // En "varias semanas" se puede borrar mientras quede alguna en el plan: si
    // era la única de su fase escondida, se va la fase entera.
    const quedaOtra = deCorrido ? semanasDelPlan(phases) > 1 : ph?.weekData?.length > 1;
    if (!wk || !quedaOtra) return false;
    if (!await pregunta({ titulo: `¿Eliminar «${nombreSemana(ph, wk)}»?`, detalle: 'Se va con todas sus sesiones.', confirmar: 'Sí, eliminarla', peligro: true })) return false;
    if (ph.weekData.length <= 1) {
      const anterior = Math.max(0, nav.pi - 1);
      touch((ps) => ps.filter((_, i) => i !== nav.pi));
      setNav({ level: 'phase', pi: anterior });
      setWeekIdx(nav.pi > 0 ? (phases[anterior]?.weekData?.length ?? 1) - 1 : 0);
      return true;
    }
    patchPhase(nav.pi, (p2) => ({ weekData: p2.weekData.filter((_, j) => j !== wi) }));
    setWeekIdx(Math.max(0, wi - 1));
    return true;
  };

  async function handleClose() {
    if (dirty) {
      const va = await pregunta({
        titulo: 'Tienes cambios sin guardar',
        detalle: 'Si sales ahora se pierden.',
        confirmar: 'Salir sin guardar',
        cancelar: 'Seguir aquí',
        peligro: true,
      });
      if (!va) return;
    }
    onClose();
  }

  // Rutina semanal: una sola "semana" que se repite; el coach agrega los días
  // que entrena desde los tabs Lun–Dom.
  function startWeeklyPlan() {
    const base = newPhase(1);
    base.name = 'Rutina semanal';
    base.weekData = [newWeek(1)];
    touch(() => [base]);
    setWeekIdx(0);
    setActiveWeekday('Lun');
    setDetailsOpen(false);
    setNav({ level: 'phase', pi: 0 });
  }

  /* CAMBIAR LA FORMA DE UN PLAN QUE YA EXISTE. Las tres, en cualquier
     sentido. Andrés, PDF 2.0 (18 sep 2026): "acuérdate que son 3 vertientes…
     siempre debes de poder cambiarla al que quieras". Antes solo había dos
     caminos, rutina ↔ fases.

     - A rutina: una rutina es UNA semana, así que solo sobrevive la primera.
       Se pregunta con el número de semanas que se van.
     - De rutina a semanas o fases: lo escrito queda como la semana 1.
     - Entre semanas y fases NO se tocan los datos: cambia cómo se ven. Lo que
       anota el atleta y dónde va se guardan por fase y semana; juntar las
       fases se lo perdería. Si vuelves a fases, regresan como estaban.

     Como el plan no se guarda hasta tocar "Guardar", todavía se puede salir
     sin guardar. */
  async function cambiarForma(destino) {
    if (destino === estructura) return;
    if (destino === 'rutina') { await cambiaARutina(); return; }
    const desdeRutina = estructura === 'rutina';
    const semanas = semanasDelPlan(phases);
    let detalle;
    if (desdeRutina) {
      detalle = destino === 'semanas'
        ? 'Lo que ya escribiste se queda como la semana 1. Después agregas las demás con el +.'
        : 'Lo que ya escribiste se queda como la semana 1 de la fase 1. Después podrás agregar semanas y fases.';
    } else if (destino === 'semanas') {
      detalle = phases.length > 1
        ? `Las ${phases.length} fases se ven como ${semanas} semanas seguidas. No se borra nada: si vuelves a fases, regresan como estaban.`
        : 'Se ve como semanas seguidas, sin fase. No se borra nada.';
    } else {
      detalle = 'Tus semanas quedan como la fase 1. Después puedes agregar más fases. No se borra nada.';
    }
    const va = await pregunta({
      titulo: destino === 'semanas' ? '¿Pasar a varias semanas que avanzan?' : '¿Pasar a un programa por fases?',
      detalle,
      confirmar: 'Sí, cambiar',
    });
    if (!va) return;
    // Solo cambia el nombre de la fase cuando era el de la forma anterior.
    const nombreNuevo = destino === 'semanas' ? 'Mi programa' : 'Fase 1';
    const eraNombreDeForma = (n) => n === 'Rutina semanal' || n === 'Mi programa';
    touch((ps) => ps.map((ph, i) => (
      i === 0 && phases.length === 1 && eraNombreDeForma(ph.name) ? { ...ph, name: nombreNuevo } : ph
    )));
    setEstructura(destino);
    setNav({ level: 'phase', pi: 0 });
    setWeekIdx(0);
  }

  async function cambiaARutina() {
    const semanas = phases.reduce((s, ph) => s + (ph.weekData?.length || 0), 0);
    const seVan = Math.max(0, semanas - 1);
    const va = await pregunta({
      titulo: '¿Pasar a una rutina que se repite?',
      detalle: seVan > 0
        ? `Una rutina es una sola semana que vuelve cada lunes. Se queda la primera y se van las otras ${seVan}.`
        : 'Una rutina es una sola semana que vuelve cada lunes.',
      confirmar: 'Sí, cambiar',
      peligro: seVan > 0,
    });
    if (!va) return;
    const primera = phases[0]?.weekData?.[0];
    if (!primera) return;
    setEstructura('rutina');
    touch(() => [{ ...phases[0], num: 1, name: 'Rutina semanal', weekData: [{ ...primera, num: 1 }] }]);
    setWeekIdx(0);
    setNav({ level: 'phase', pi: 0 });
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
      if (isWeekly) return 'Rutina semanal';
      const wi = Math.min(weekIdx, Math.max(0, (p?.weekData?.length ?? 1) - 1));
      // En "varias semanas" no hay fase que nombrar: la semana va de corrido.
      if (estructura === 'semanas') {
        const wk = p?.weekData?.[wi];
        const sub = weekSubtitle(wk);
        const n = semanaGlobal(phases, p?.id, wk?.num) ?? wi + 1;
        return `Semana ${n} de ${semanasDelPlan(phases)}${sub ? ` · ${sub}` : ''}`;
      }
      return `${p?.name || 'Fase'} · ${weekName(p?.weekData?.[wi], wi + 1)}`;
    }
    return t('Estructura del plan');
  }, [nav, phases, weekIdx, isWeekly, estructura]);

  /* Volver. En el teléfono, desde el editor de un día se vuelve a la hoja; y
     desde la hoja, se sale. Ya no hay pantalla de fases a la que subir: la
     hoja las enseña todas. */
  const goBack = () => {
    if (!esCompu && nav.level === 'phase' && editandoDiaTel) { vuelveALaHoja(); return; }
    handleClose();
  };

  /* ---------------- render por nivel ---------------- */
  let body = null;

  if (nav.level === 'start') {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560, margin: '24px auto 0' }}>
        <div style={{ fontSize: 15, color: T.text2, lineHeight: 1.55, textAlign: 'center', marginBottom: 6 }}>
          ¿Cómo quieres armar el plan de <b style={{ color: T.text }}>{athlete.full_name || athlete.username}</b>?
        </div>
        {FORMAS.map((forma) => ({
          ...forma,
          onClick: {
            rutina: () => { setEstructura('rutina'); startWeeklyPlan(); },
            semanas: () => { setEstructura('semanas'); setNav({ level: 'wizard' }); },
            fases: () => { setEstructura('fases'); touch(() => [newPhase(1)]); openPhase(0); },
          }[forma.id],
        })).map((opt) => (
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
                    minWidth: 52, padding: esCompu ? '11px 15px' : '11px 12px', borderRadius: 11, cursor: 'pointer',
                    border: `1.5px solid ${active ? T.accent : T.border}`,
                    background: active ? T.accentBg : T.bg2, color: active ? T.accent : T.text2,
                    fontFamily: FONT, fontSize: 13, fontWeight: 800,
                  }}>
                  {esCompu ? NOMBRE_DIA[d] : d}
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
          Crear estructura ({pluralS(wizWeeks, 'semana')} · {pluralS(wizDays.length, 'día')}/sem)
        </button>
        <div style={{ fontSize: 12.5, color: T.text3, textAlign: 'center', lineHeight: 1.5 }}>
          Después llenas los ejercicios de la semana 1 y los copias al resto con un botón.
        </div>
      </div>
    );
  } else if (nav.level === 'phase') {
    /* LA HOJA + EL EDITOR DEL DÍA.

       Andrés, 24 sep 2026: la hoja del programa es "mi forma favorita de ver
       cualquier plan", y "al navegar el plan de cualquier forma tendría que
       ser igual". Aquí había dos pantallas —una lista de tarjetas de fases con
       flechas, y dentro de cada fase fichas de semana y pestañas de días— y
       ninguna se parecía a la hoja.

       Ahora la hoja ES el índice del editor. Las flechas, copiar y borrar
       viven en los tres puntos de cada fase y de cada semana (aprobado con
       maqueta: "sí, hazlo así"). En la compu el día se edita a la derecha y la
       hoja no se va; en el teléfono, tocar un día abre su editor a pantalla
       completa. El editor del día no cambia. */
    const p = phases[nav.pi];
    const wIdx = p ? Math.max(0, Math.min(weekIdx, p.weekData.length - 1)) : 0;
    const w = p?.weekData?.[wIdx];
    const daysOfWeekday = (w?.days || []).map((d, di) => ({ d, di })).filter((x) => x.d.day === activeWeekday);
    const conDetalles = detailsOpen && !isWeekly && !!p;

    const hoja = (
      <div>
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, marginBottom: isWeekly ? 8 : 14 }}>
          <Field label={isWeekly ? 'Título de la rutina' : t('Título del plan')} grow>
            <input value={title} onChange={(e) => { setTitle(e.target.value); setDirty(true); }} style={inputStyle} />
          </Field>
          {/* Fuera del <label> del campo, a propósito: un <label> le pasa el
              toque a su campo, y el menú no se abriría. */}
          <button
            type="button" onClick={() => setMenu({ tipo: 'plan' })}
            aria-label={t('Opciones del plan')} title={t('Opciones del plan')} className="kp-ico"
            style={{
              width: 42, height: 42, borderRadius: 12, border: 'none', cursor: 'pointer', flexShrink: 0,
              background: 'transparent', color: T.text2, display: 'grid', placeItems: 'center',
            }}
          >
            <MoreHorizontal size={19} />
          </button>
        </div>
        {/* La forma del plan, a la vista. Andrés, 17 sep 2026: "si un atleta
            tiene entrenamiento semanal no se puede cambiar a fases, al menos no
            veo cómo desde el teléfono". Ahora sale en las tres formas y
            "Cambiar" ofrece las tres. También está en los tres puntos. */}
        {(() => {
          const forma = FORMAS.find((f) => f.id === estructura) ?? FORMAS[2];
          return (
            <button
              type="button" onClick={() => setFormasAbiertas(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, border: 'none', background: 'transparent',
                cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700, color: T.text2,
                padding: '2px 2px 12px',
              }}
            >
              <forma.icon size={14} color={T.accent} />
              {forma.corto}
              <span style={{ fontWeight: 800, color: T.accent }}>Cambiar</span>
            </button>
          );
        })()}
        <NavegadorDelPlan
          fases={phases}
          kind={kind}
          estructura={estructura}
          quien="atleta"
          aqui={aquiAtleta}
          editor={{
            faseAbierta: nav.pi,
            semanaAbierta: w?.num,
            onAbrirFase: (i, semanaNum) => {
              yaNavego.current = true;
              const wi = Math.max(0, (phases[i]?.weekData ?? []).findIndex((x) => x.num === semanaNum));
              const semana = phases[i]?.weekData?.[wi];
              // "Ir a donde va" y la fase del atleta abren en SU día.
              const suDia = aquiAtleta && aquiAtleta.faseId === phases[i]?.id
                && aquiAtleta.semana === semana?.num && aquiAtleta.dia != null
                ? semana.days[aquiAtleta.dia]?.day : null;
              setDetailsOpen(false);
              setNav({ level: 'phase', pi: i });
              setWeekIdx(wi);
              setActiveWeekday((d) => suDia || diaParaSemana(semana, d));
            },
            onElegirSemana: (num) => {
              yaNavego.current = true;
              const wi = Math.max(0, (p?.weekData ?? []).findIndex((x) => x.num === num));
              setWeekIdx(wi);
              setActiveWeekday((d) => diaParaSemana(p?.weekData?.[wi], d));
            },
            diaElegido: activeWeekday,
            onElegirDia: (f, i, semana, clave) => {
              yaNavego.current = true;
              setActiveWeekday(clave);
              abreEditorTel();
            },
            onMenuFase: (f, i) => { yaNavego.current = true; setMenu({ tipo: 'fase', pi: i }); },
            onMenuSemana: () => { yaNavego.current = true; setMenu({ tipo: 'semana' }); },
            onAgregarSemana: (f, i) => { yaNavego.current = true; agregarSemana(i); },
            onAgregarFase: () => { yaNavego.current = true; agregarFase(); },
          }}
        />
      </div>
    );

    /* Nombre, color y objetivo de la fase. Se abre desde los tres puntos de
       la fase. "Color" no va en un `Field`: ese es un <label>, y un <label>
       con varios botones dentro le pasa el toque al primero. */
    const panelFase = conDetalles && (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 16, padding: 16, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ flex: 1, fontSize: 11, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6 }}>
            Nombre, color y objetivo
          </span>
          <Pill primary icon={Check} onClick={() => (esCompu ? setDetailsOpen(false) : vuelveALaHoja())}>Listo</Pill>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Field label="Nombre de la fase" grow>
            <input value={p.name || ''} onChange={(e) => patchPhase(nav.pi, { name: e.target.value })} placeholder="Ej. Hipertrofia, Bloque de fuerza…" style={inputStyle} />
          </Field>
          <Field label="Subtítulo (opcional)" grow>
            <input value={p.fullName || ''} onChange={(e) => patchPhase(nav.pi, { fullName: e.target.value })} placeholder="Ej. Recuperación y Evaluación" style={inputStyle} />
          </Field>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6 }}>Color</span>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {PALETTE.map((c) => (
              <button key={c} type="button" onClick={() => patchPhase(nav.pi, { color: c })} aria-label={`Color ${c}`}
                style={{ width: 32, height: 32, borderRadius: 10, cursor: 'pointer', background: c, border: p.color === c ? `3px solid ${T.text}` : '3px solid transparent' }} />
            ))}
          </div>
        </div>
        <Field label="Enfoque en una línea (opcional)">
          <input value={p.focus || ''} onChange={(e) => patchPhase(nav.pi, { focus: e.target.value })} placeholder="Ej. Masa magra y base estructural" style={inputStyle} />
        </Field>
        <Field label="Objetivo (opcional)">
          <textarea value={p.objective || ''} onChange={(e) => patchPhase(nav.pi, { objective: e.target.value })} rows={3}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }} />
        </Field>
      </div>
    );

    const editorDelDia = p && (
      <div>
        {/* Dónde estás, en una línea. En el teléfono la vuelta a la hoja es la
            flecha de arriba: una segunda flecha aquí, justo debajo, era dos
            botones para lo mismo. */}
        <div style={{ marginBottom: 14, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: T.text3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {isWeekly ? 'Rutina que se repite' : `${deCorrido ? nombreSemana(p, w, wIdx + 1) : `${p.name || 'Fase'} · ${weekName(w, wIdx + 1)}`}${w?.load ? ` · ${w.load}` : ''}`}
          </div>
          <div style={{ fontSize: 19, fontWeight: 800, color: T.text, letterSpacing: -0.3 }}>
            {conDetalles && !esCompu ? 'Opciones de la fase' : (NOMBRE_DIA[activeWeekday] || activeWeekday)}
          </div>
        </div>

        {panelFase}

        {/* En el teléfono, con las opciones de la fase abiertas no va el día
            debajo: vino a eso, y abajo parecería parte de lo mismo. */}
        {!w ? (
          <div style={{ background: T.bg2, border: `1.5px dashed ${T.borderHi}`, borderRadius: 20, padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>Esta fase todavía no tiene semanas</div>
            <div style={{ marginTop: 14 }}>
              <Pill primary icon={Plus} onClick={() => agregarSemana(nav.pi)}>Agregar semana</Pill>
            </div>
          </div>
        ) : (esCompu || !conDetalles) && (
          <>
            {/* Sesiones del día activo */}
            {daysOfWeekday.length === 0 ? (
              <div style={{ background: T.bg2, border: `1.5px dashed ${T.borderHi}`, borderRadius: 20, padding: '52px 24px', textAlign: 'center' }}>
                <div style={{ width: 70, height: 70, borderRadius: 22, background: T.accentBg, color: T.accent, display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                  <CalendarDays size={30} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: T.text }}>No hay sesión para el {DAY_FULL_LOWER[activeWeekday] || activeWeekday.toLowerCase()}</div>
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
                    categorias={categoriasVisibles}
                    duenoId={user?.id}
                    masterId={masterIdCat}
                    onCategoriaCreada={(fila) => setCategorias((prev) => [...prev, fila])}
                    onCategoriaBorrada={(id) => setCategorias((prev) => prev.filter((c) => c.id !== id))}
                    atleta={athlete}
                    onEjercicioCreado={(fila) => setRepertoire((prev) => [
                      ...prev, { ...fila, isMine: true, isBase: false },
                    ])}
                    onPatch={(patch) => patchDay(nav.pi, wIdx, di, patch)}
                    onDelete={async () => {
                      if (await pregunta({ titulo: `¿Eliminar la sesión "${d.name || d.day}"?`, confirmar: 'Sí, eliminarla', peligro: true })) {
                        patchWeek(nav.pi, wIdx, (wk) => ({ days: wk.days.filter((_, k) => k !== di) }));
                      }
                    }}
                    onCopy={() => setClipboard(clone(d))}
                    onClear={async () => {
                      if (await pregunta({ titulo: '¿Vaciar esta sesión?', detalle: 'Se quitan todos sus sets. El nombre y el tipo se quedan.', confirmar: 'Sí, vaciarla', peligro: true })) patchDay(nav.pi, wIdx, di, { exercises: [] });
                    }}
                    onSaveToCatalog={() => setModal({ type: 'name-day', payload: d })}
                    onApplyCatalog={() => setModal({ type: 'tpl-day', payload: { di } })}
                  />
                ))}

                {/* OTRA SESIÓN EL MISMO DÍA. El plan ya lo admitía —cada sesión es
                    una entrada con su día de la semana, y puede haber dos con
                    "Lun"— pero el botón de añadir solo aparecía con el día VACÍO.
                    En cuanto el lunes tenía una sesión, no había forma de ponerle
                    la de la tarde. Probado como coach: el menú de la sesión solo
                    ofrecía copiar, y "Pegar" también vivía solo en el día vacío. */}
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {/* Sin contorno punteado: "haces mucho ese estilo de
                      botones, no me gusta" (Andrés, 28 sep 2026). */}
                  <button type="button"
                    onClick={() => patchWeek(nav.pi, wIdx, (wk) => ({ days: [...(wk.days || []), newDay(activeWeekday)] }))}
                    className="kp-press"
                    style={{
                      flex: '1 1 220px', minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                      borderRadius: 14, border: `1.5px solid ${T.border}`, background: T.bg2, cursor: 'pointer',
                      boxShadow: KP.shCard, fontFamily: FONT, fontSize: 14, fontWeight: 800, color: T.accent,
                    }}>
                    <Plus size={16} /> Añadir otra sesión el {DAY_FULL_LOWER[activeWeekday] || activeWeekday.toLowerCase()}
                  </button>
                  {clipboard && (
                    <Pill icon={Clipboard} onClick={() => patchWeek(nav.pi, wIdx, (wk) => ({ days: [...(wk.days || []), { ...clone(clipboard), day: activeWeekday }] }))}>
                      Pegar rutina
                    </Pill>
                  )}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );

    body = esCompu ? (
      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(300px, 380px) minmax(0, 1fr)', gap: 24,
        maxWidth: 1240, margin: '0 auto', alignItems: 'start',
      }}>
        {/* La hoja se queda quieta mientras el día de al lado se desplaza. */}
        <aside style={{ position: 'sticky', top: 0, maxHeight: 'calc(100svh - 110px)', overflowY: 'auto', padding: '2px 4px 8px 2px' }}>
          {hoja}
        </aside>
        <section style={{ minWidth: 0 }}>{editorDelDia}</section>
      </div>
    ) : (
      <div style={{ maxWidth: 640, margin: '0 auto' }}>
        {editandoDiaTel && editorDelDia ? editorDelDia : hoja}
      </div>
    );
  }

  const curPhase = nav.level === 'phase' ? phases[nav.pi] : null;
  const curWeekIdx = curPhase ? Math.min(weekIdx, curPhase.weekData.length - 1) : 0;

  /* Colgado del documento, no de la ficha que lo abre. En la compu la ficha
     es una card flotante con capa 900, y todo lo que va dentro queda
     encerrado en esa capa aunque pida 2400: el botón de tu cuenta (capa 1000,
     arriba a la derecha) quedaba ENCIMA de la X del editor, y tocar la X
     abría el menú de la cuenta. Visto en la prueba del 25 sep 2026. */
  return createPortal(
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
            {athlete.full_name || athlete.username}{dirty ? ' · sin guardar' : (haGuardado ? ' · guardado' : '')}
          </div>
        </div>
        {nav.level !== 'start' && nav.level !== 'wizard' && (
          <button type="button" onClick={onSave} disabled={saving || !dirty}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 12,
              border: 'none', cursor: saving || !dirty ? 'default' : 'pointer',
              background: dirty ? `linear-gradient(135deg, ${T.accent}, ${T.accentDk})` : T.bg3,
              // Recién guardado, en verde: se lee como "listo", no como botón apagado.
              color: dirty ? '#fff' : (haGuardado ? KP.mint : T.text3), fontFamily: FONT, fontSize: 14, fontWeight: 800,
              boxShadow: dirty ? KP.shBtn : 'none', opacity: saving ? 0.75 : 1, flexShrink: 0,
            }}>
            {saving ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
            {!dirty && haGuardado ? 'Guardado' : 'Guardar'}
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

      <main ref={mainRef} style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 60px' }}>{body}</main>

      {/* Modales */}
      {modal?.type === 'week-meta' && curPhase && (
        <WeekMetaModal
          week={curPhase.weekData[curWeekIdx]}
          numero={numeroDeSemana(curPhase, curPhase.weekData[curWeekIdx], curWeekIdx + 1)}
          canDelete={(deCorrido ? semanasDelPlan(phases) : curPhase.weekData.length) > 1}
          onPatch={(patch) => patchWeek(nav.pi, curWeekIdx, patch)}
          onDuplicate={() => { duplicarSemana(); setModal(null); }}
          onCopyToRest={async () => { if (await copiarSemanaATodas()) setModal(null); }}
          onDelete={async () => { if (await eliminarSemana()) setModal(null); }}
          onClose={() => setModal(null)}
        />
      )}
      {/* LOS TRES PUNTOS. Antes eran flechas y botones sueltos en la lista de
          fases, más una hoja de "Opciones de la fase" que mezclaba cosas de
          la fase, de la semana y del plan. Ahora cada menú habla de UNA cosa:
          el plan, una fase, o la semana abierta.

          "Agregar fase" sigue siempre a mano (Andrés, 18 sep 2026: "aquí no
          veo cómo se pueden agregar fases"): abajo de la hoja y en el menú del
          plan. */}
      {formasAbiertas && (
        <HojaFormas actual={estructura} onElegir={cambiarForma} onClose={() => setFormasAbiertas(false)} />
      )}
      {menu?.tipo === 'plan' && (
        <HojaAcciones
          onClose={() => setMenu(null)}
          acciones={[
            ...(isWeekly ? [
              { icon: FolderOpen, texto: 'Usar una plantilla de semana', onClick: () => setModal({ type: 'tpl-week' }) },
              { icon: Save, texto: 'Guardar la semana como plantilla', onClick: () => setModal({ type: 'name-week' }) },
            ] : []),
            ...(estructura === 'fases' ? [{ icon: Plus, texto: 'Agregar fase', onClick: agregarFase }] : []),
            { icon: Settings2, texto: t('Cambiar la forma del plan'), onClick: () => setFormasAbiertas(true) },
          ]}
        />
      )}
      {menu?.tipo === 'fase' && phases[menu.pi] && (
        <HojaAcciones
          onClose={() => setMenu(null)}
          acciones={[
            {
              icon: Settings2, texto: 'Nombre, color y objetivo',
              onClick: () => {
                if (menu.pi !== nav.pi) { setNav({ level: 'phase', pi: menu.pi }); setWeekIdx(0); }
                setDetailsOpen(true);
                abreEditorTel();
              },
            },
            ...(menu.pi > 0 ? [{ icon: ChevronUp, texto: 'Subir', onClick: () => moverFase(menu.pi, -1) }] : []),
            ...(menu.pi < phases.length - 1 ? [{ icon: ChevronDown, texto: 'Bajar', onClick: () => moverFase(menu.pi, 1) }] : []),
            { icon: Copy, texto: 'Duplicar fase', onClick: () => duplicarFase(menu.pi) },
            ...(phases.length > 1 ? [{ icon: Trash2, texto: 'Eliminar fase', onClick: () => eliminarFase(menu.pi), peligro: true }] : []),
          ]}
        />
      )}
      {menu?.tipo === 'semana' && curPhase && (
        <HojaAcciones
          onClose={() => setMenu(null)}
          acciones={[
            { icon: Pencil, texto: 'Nombre y carga de la semana', onClick: () => setModal({ type: 'week-meta' }) },
            { icon: Copy, texto: 'Duplicar semana', onClick: duplicarSemana },
            ...((deCorrido ? semanasDelPlan(phases) : curPhase.weekData.length) > 1 ? [{ icon: Layers, texto: 'Copiarla a todas las semanas', onClick: copiarSemanaATodas }] : []),
            { icon: FolderOpen, texto: 'Usar una plantilla de semana', onClick: () => setModal({ type: 'tpl-week' }) },
            { icon: Save, texto: 'Guardarla como plantilla', onClick: () => setModal({ type: 'name-week' }) },
            ...((deCorrido ? semanasDelPlan(phases) : curPhase.weekData.length) > 1 ? [{ icon: Trash2, texto: 'Eliminar semana', onClick: eliminarSemana, peligro: true }] : []),
          ]}
        />
      )}

      {modal?.type === 'name-day' && (
        <NameModal
          title="Guardar rutina en el catálogo"
          placeholder="Ej. Pierna — fuerza básica"
          onClose={() => setModal(null)}
          onSave={async (name) => {
            const d = modal.payload;
            // `catNombre`/`catColor` van con el día: si el tipo es uno propio
            // del coach, la plantilla tiene que traerlo puesto, no el gris de
            // "Gym" que saldría al no encontrar la llave.
            await saveTemplate({ name, kind: 'day', data: { name: d.name, cat: d.cat, catNombre: d.catNombre ?? null, catColor: d.catColor ?? null, exercises: d.exercises || [] }, createdBy: user?.id });
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
          onApply={async (t) => {
            const n = (t.data?.days || []).length;
            if (!await pregunta({
              titulo: `¿Aplicar "${t.name}"?`,
              detalle: `Esta semana pierde lo que tenga y queda con ${n} día${n !== 1 ? 's' : ''}.`,
              confirmar: 'Sí, aplicarla',
            })) return;
            patchWeek(nav.pi, curWeekIdx, { days: clone(t.data?.days || []) });
            setModal(null);
          }}
        />
      )}
      {modal?.type === 'tpl-day' && curPhase && (
        <TemplatePicker
          kind="day"
          onClose={() => setModal(null)}
          onApply={async (t) => {
            const { di } = modal.payload;
            const tplDay = {
              day: activeWeekday, name: t.data?.name || t.name, cat: t.data?.cat || 'gym',
              catNombre: t.data?.catNombre ?? null, catColor: t.data?.catColor ?? null,
              exercises: clone(t.data?.exercises || []),
            };
            if (di == null) {
              patchWeek(nav.pi, curWeekIdx, (wk) => ({ days: [...(wk.days || []), tplDay] }));
            } else {
              if (!await pregunta({
                titulo: `¿Aplicar "${t.name}"?`,
                detalle: 'Esta sesión pierde lo que tenga y queda con la rutina del catálogo.',
                confirmar: 'Sí, aplicarla',
              })) return;
              patchDay(nav.pi, curWeekIdx, di, {
                name: tplDay.name, cat: tplDay.cat,
                catNombre: tplDay.catNombre, catColor: tplDay.catColor,
                exercises: tplDay.exercises,
              });
            }
            setModal(null);
          }}
        />
      )}

      <style>{`
        .spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
        /* !important porque los estilos van en linea y esos le ganan al CSS.
           Solo se toca el fondo: cambiar tambien el color le quitaria el rojo
           a los botones de borrar justo cuando el mouse esta encima. */
        .kp-pill,.kp-ico{transition:background .12s}
        .kp-pill:hover:not(:disabled),.kp-ico:hover:not(:disabled){background:${T.bg3} !important}
      `}</style>
    </div>,
    document.body,
  );
}
