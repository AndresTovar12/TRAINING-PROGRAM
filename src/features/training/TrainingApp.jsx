import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, ChevronUp, Calendar,
  Check, X, Calculator, BookOpen, TrendingUp, Edit3, Target,
  Zap, Trophy, Clock, FileText, Sparkles, Info, Dumbbell, Heart, Play,
  ChevronLeft, Activity, Home as HomeIcon,
  Repeat, Eye, Layers, List, Scale, LineChart as LineChartIcon,
  Minus, Plus,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { useIsDesktop } from '@/lib/useViewport';
import { T, FONT, NUM_STYLE, LT, CAT_COLORS, KP, eyebrow } from '@/lib/theme';
import { PHASE_IMG } from '@/data/training-data';
import { usePlan } from '@/contexts/PlanContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  sessionId, calc1RM, today, greeting, isLoadedExercise,
  resolveCursor, defaultCursor, isValidCursor, findPreviousWeight, historialDePeso,
  formatIntensity,
  sessionForToday, weekOverview, weekdayToday, weekdayLabel
} from '@/lib/training-utils';
import { aKilos, desdeKilos, pesoTexto, etiquetaUnidad } from '@/lib/unidades';
import { portadaParaAtleta, videosParaAtleta } from '@/lib/videos';
import { useStorage } from '@/contexts/AppStateContext';
import ExerciseMediaModal from '@/features/training/ExerciseMediaModal';

// Nombres completos SOLO para mostrar en compu. Lo que guarda el plan sigue
// siendo 'Lun', 'Mar'… igual que en el editor del entrenador.
const NOMBRE_DIA = {
  Lun: 'Lunes', Mar: 'Martes', Mié: 'Miércoles', Jue: 'Jueves',
  Vie: 'Viernes', Sáb: 'Sábado', Dom: 'Domingo',
};

const Caption = ({ children, color = T.text3, style }) => (
  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4, color, ...style }}>{children}</div>
);
const Card = ({ children, style, onClick, active }) => {
  const [hover, setHover] = useState(false);
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: T.bg2,
        border: `1px solid ${active ? T.accent + '55' : KP.line}`,
        borderRadius: KP.rCard, padding: 18, cursor: onClick ? 'pointer' : 'default',
        boxShadow: (hover && onClick) ? KP.shRaise : KP.shCard,
        transition: 'box-shadow 0.18s, border-color 0.15s, transform 0.12s cubic-bezier(0.22,1,0.36,1)',
        transform: (hover && onClick) ? 'translateY(-2px)' : 'none',
        ...style,
      }}>{children}</div>
  );
};
const Collapsible = ({ title, icon: Icon, children, defaultOpen = false, subtle = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: subtle ? 'transparent' : T.bg2,
      border: subtle ? 'none' : `1px solid ${KP.line}`, borderRadius: 20, overflow: 'hidden',
      boxShadow: subtle ? 'none' : KP.shCard,
    }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', padding: '15px 18px', background: 'transparent', border: 'none', color: T.text,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700, textAlign: 'left',
      }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {Icon && <Icon size={14} style={{ color: T.accent }} />}
          {title}
        </span>
        {open ? <ChevronUp size={16} style={{ color: T.text3 }} /> : <ChevronDown size={16} style={{ color: T.text3 }} />}
      </button>
      {open && <div style={{ padding: '0 18px 18px' }}>{children}</div>}
    </div>
  );
};
const Input = ({ value, onChange, placeholder, type = 'text', style, suffix }) => (
  <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
    <input type={type} value={value ?? ''} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{
        background: T.bg, border: `1.5px solid ${KP.line}`, borderRadius: KP.rBtn,
        padding: '11px 14px', paddingRight: suffix ? 42 : 14, color: T.text, fontSize: 15,
        fontFamily: FONT, width: '100%', outline: 'none', transition: 'border-color 0.15s, box-shadow 0.15s',
        boxSizing: 'border-box', ...NUM_STYLE, ...style,
      }}
      onFocus={e => { e.target.style.borderColor = T.accent; e.target.style.boxShadow = '0 0 0 4px rgba(30,64,224,0.10)'; }}
      onBlur={e => { e.target.style.borderColor = KP.line; e.target.style.boxShadow = 'none'; }}
    />
    {suffix && <span style={{ position: 'absolute', right: 14, color: T.text3, fontSize: 12, fontWeight: 600, pointerEvents: 'none' }}>{suffix}</span>}
  </div>
);

// Global timeline shown across all internal views
const PhaseTimeline = ({ activePhaseId, sessionsData, onJumpToPhase }) => {
  const { phases: PLAN } = usePlan();
  return (
    <div style={{
      padding: '10px 20px 12px',
      borderBottom: `1px solid ${T.border}`,
      background: T.bg,
      position: 'sticky', top: 0, zIndex: 40,
    }}>
      <div style={{ display: 'flex', gap: 3, height: 8, marginBottom: 6 }}>
        {PLAN.map(phase => {
          const isActive = phase.id === activePhaseId;
          let completed = 0, total = 0;
          phase.weekData.forEach(w => w.days.forEach((_, i) => {
            total++;
            if (sessionsData[sessionId(phase.id, w.num, i)]?.completed) completed++;
          }));
          const pct = total > 0 ? completed / total : 0;
          return (
            <button key={phase.id} onClick={() => onJumpToPhase(phase)}
              style={{
                flex: phase.weeks, minWidth: 8,
                background: T.bg3,
                borderRadius: 4,
                border: 'none',
                padding: 0,
                position: 'relative',
                cursor: 'pointer',
                overflow: 'hidden',
                outline: isActive ? `1.5px solid ${T.accent}` : 'none',
                outlineOffset: isActive ? 2 : 0,
                boxShadow: isActive ? `0 0 12px rgba(30, 64, 224, 0.35)` : 'none',
              }}>
              <div style={{
                position: 'absolute', top: 0, left: 0, bottom: 0,
                width: `${pct * 100}%`,
                background: phase.color,
                opacity: isActive ? 1 : 0.55,
                transition: 'width 0.3s',
              }} />
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', gap: 3 }}>
        {PLAN.map(phase => {
          const isActive = phase.id === activePhaseId;
          return (
            <div key={phase.id} style={{
              flex: phase.weeks, minWidth: 8, textAlign: 'center',
              fontSize: 9, fontWeight: 800, letterSpacing: 0.5,
              color: isActive ? T.text : T.text3,
              ...NUM_STYLE,
            }}>
              {phase.num}
            </div>
          );
        })}
      </div>
    </div>
  );
};




// Etiquetas legibles de músculos en español





/**
 * Card flotante con el historial de peso de UN ejercicio.
 *
 * Lo pidió Andrés así: "un botocito que les despliegue una card flotante donde
 * pongan con cuánto peso lo están haciendo, para no olvidar el de la vez pasada
 * y saber su progreso".
 *
 * El campo de peso de la fila ya cubría la mitad —anotar y ver el anterior—
 * pero era una cajita de 54px con un texto gris de 11px debajo, o sea que se
 * pasaba por alto. Y la otra mitad no existía: "saber su progreso" pide una
 * historia, no el último dato suelto.
 */
function TarjetaProgreso({ nombre, historial, unidad, onCerrar }) {
  const u = etiquetaUnidad(unidad);
  const valores = historial.map((h) => desdeKilos(h.kilos, unidad));
  const max = valores.length ? Math.max(...valores) : 0;
  const min = valores.length ? Math.min(...valores) : 0;
  const primero = valores[0];
  const ultimo = valores[valores.length - 1];
  const cambio = valores.length > 1 ? Math.round((ultimo - primero) * 10) / 10 : null;

  return (
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 4500, background: 'rgba(9,11,16,.5)',
        display: 'grid', placeItems: 'end center', fontFamily: FONT,
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: '100%', maxWidth: 460, background: LT.surface,
          borderRadius: '22px 22px 0 0', padding: '18px 18px calc(20px + env(safe-area-inset-bottom))',
          maxHeight: '78svh', overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.7, textTransform: 'uppercase', color: LT.text3 }}>
              Tu progreso
            </div>
            <div style={{ fontSize: 17, fontWeight: 800, color: LT.text, lineHeight: 1.25, marginTop: 3, overflowWrap: 'anywhere' }}>
              {nombre}
            </div>
          </div>
          <button
            type="button" onClick={onCerrar} aria-label="Cerrar"
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: LT.text3, padding: 4, flexShrink: 0 }}
          >
            <X size={20} />
          </button>
        </div>

        {historial.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '26px 12px' }}>
            <Scale size={30} color={LT.text3} style={{ opacity: 0.45 }} />
            <div style={{ marginTop: 10, fontSize: 13.5, color: LT.text2, fontWeight: 600, lineHeight: 1.5 }}>
              Todavía no has anotado ningún peso aquí.<br />
              En cuanto anotes el primero, empiezas a ver tu progreso.
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 9, marginBottom: 15 }}>
              <div style={{ flex: 1, background: LT.bg, borderRadius: 13, padding: '11px 13px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: LT.text3 }}>Último</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: LT.text, marginTop: 3, ...NUM_STYLE }}>{ultimo} <span style={{ fontSize: 12, color: LT.text3 }}>{u}</span></div>
              </div>
              <div style={{ flex: 1, background: LT.bg, borderRadius: 13, padding: '11px 13px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, textTransform: 'uppercase', color: LT.text3 }}>Tu máximo</div>
                <div style={{ fontSize: 19, fontWeight: 800, color: LT.text, marginTop: 3, ...NUM_STYLE }}>{max} <span style={{ fontSize: 12, color: LT.text3 }}>{u}</span></div>
              </div>
            </div>

            {cambio !== null && (
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, marginBottom: 15,
                background: cambio > 0 ? LT.mint + '14' : LT.bg, borderRadius: 12, padding: '10px 13px',
                fontSize: 13, fontWeight: 700, color: cambio > 0 ? LT.mint : LT.text2,
              }}>
                <TrendingUp size={15} />
                {cambio > 0
                  ? `Has subido ${cambio} ${u} desde la primera vez`
                  : cambio < 0
                    ? `${Math.abs(cambio)} ${u} menos que la primera vez`
                    : 'Mismo peso que la primera vez'}
              </div>
            )}

            {valores.length > 1 && (
              <div style={{ height: 120, marginBottom: 14 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={historial.map((h, i) => ({ i: i + 1, peso: valores[i] }))}>
                    <XAxis dataKey="i" hide />
                    <YAxis domain={[Math.floor(min * 0.92), Math.ceil(max * 1.08)]} hide />
                    <Tooltip
                      formatter={(v) => [`${v} ${u}`, 'Peso']}
                      labelFormatter={(i) => `Vez ${i}`}
                      contentStyle={{ borderRadius: 10, border: `1px solid ${LT.border}`, fontSize: 12, fontFamily: FONT }}
                    />
                    <Line type="monotone" dataKey="peso" stroke={LT.blue} strokeWidth={2.5} dot={{ r: 3, fill: LT.blue }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 0.6, textTransform: 'uppercase', color: LT.text3, marginBottom: 7 }}>
              Cada vez que lo hiciste
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {[...historial].reverse().map((h, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '9px 2px',
                  borderTop: i === 0 ? 'none' : `1px solid ${LT.border}`,
                }}>
                  <span style={{ flex: 1, minWidth: 0, fontSize: 12.5, color: LT.text2, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {h.donde}
                  </span>
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: LT.text, flexShrink: 0, ...NUM_STYLE }}>
                    {desdeKilos(h.kilos, unidad)} <span style={{ fontSize: 11, color: LT.text3, fontWeight: 700 }}>{u}</span>
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Control de − y + para anotar en el gimnasio.
 *
 * Por qué no un campo de texto: entre serie y serie, con las manos ocupadas y
 * el teléfono a medio metro, abrir el teclado numérico para subir de 70 a 75
 * son cuatro acciones. Aquí es un toque. El campo del centro sigue siendo
 * escribible para el que quiera poner un número raro de un jalón.
 *
 * `paso` va en la unidad que ve el atleta, no en kilos: 2,5 kg o 5 lb, que es
 * como suben de verdad los discos.
 */
function PasoNumero({ valor, onCambio, paso = 1, min = 0, sufijo, ancho = 118 }) {
  const num = valor === '' || valor == null ? null : parseFloat(valor);
  const mueve = (dir) => {
    const base = Number.isFinite(num) ? num : 0;
    const siguiente = Math.max(min, Math.round((base + dir * paso) * 100) / 100);
    onCambio(String(siguiente));
  };
  const boton = (dir) => ({
    width: 34, height: 34, borderRadius: '50%', flexShrink: 0, cursor: 'pointer',
    display: 'grid', placeItems: 'center', fontFamily: FONT,
    border: dir > 0 ? 'none' : `1.5px solid ${LT.borderHi}`,
    background: dir > 0 ? LT.blue : 'transparent',
    color: dir > 0 ? '#fff' : LT.text2,
  });
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <button type="button" onClick={() => mueve(-1)} aria-label="Bajar" style={boton(-1)}>
        <Minus size={16} strokeWidth={3} />
      </button>
      <div style={{ width: ancho - 80, textAlign: 'center', minWidth: 38 }}>
        <input
          type="number" inputMode="decimal" value={valor} placeholder="—"
          onChange={(e) => onCambio(e.target.value)}
          style={{
            width: '100%', border: 'none', background: 'transparent', textAlign: 'center',
            fontSize: 19, fontWeight: 800, outline: 'none', fontFamily: FONT, padding: 0,
            color: Number.isFinite(num) ? LT.text : LT.text3, ...NUM_STYLE,
          }}
        />
        {sufijo && (
          <div style={{
            fontSize: 9, color: LT.text3, textTransform: 'uppercase',
            letterSpacing: 0.5, marginTop: -2, fontWeight: 700,
          }}>{sufijo}</div>
        )}
      </div>
      <button type="button" onClick={() => mueve(1)} aria-label="Subir" style={boton(1)}>
        <Plus size={16} strokeWidth={3} />
      </button>
    </div>
  );
}

/** Dato suelto del ejercicio. Solo se pinta si el coach lo puso. */
function Chip({ children, fuerte }) {
  return (
    <span style={{
      fontSize: 11.5, fontWeight: 700, padding: '3px 9px', borderRadius: 7,
      background: fuerte ? LT.blueSoft : LT.surface2,
      color: fuerte ? LT.blue : LT.text2, whiteSpace: 'nowrap', ...NUM_STYLE,
    }}>{children}</span>
  );
}

const ExerciseRow = ({ ex, idx, num, sessionData, onUpdate, oneRMs, sessionsData, phaseColor }) => {
  const { phases: PLAN, resolveExercise, medias } = usePlan();
  const { profile } = useAuth();
  const unidad = profile?.unidad_peso || 'kg';
  const u = etiquetaUnidad(unidad);
  const [mediaOpen, setMediaOpen] = useState(false);
  const [progresoAbierto, setProgresoAbierto] = useState(false);
  const exData = sessionData?.exercises?.[idx] || {};
  const pc = phaseColor || LT.blue;
  const repertoire = resolveExercise(ex);
  // La foto y el video que le tocan a ESTA persona: puede haber una puesta solo
  // para ella, una de su género, o la general. Nunca se lee el campo del
  // ejercicio a pelo, porque entonces el trabajo del coach no se vería.
  const portada = portadaParaAtleta(repertoire, medias, profile);
  const misVideos = videosParaAtleta(repertoire, medias, profile);

  const recommended = useMemo(() => {
    if (ex.isNote || !ex.intensity) return null;
    const m = ex.intensity.match(/(\d+)%/);
    if (!m) return null;
    const pct = parseInt(m[1]);
    const exName = (ex.name || '').toLowerCase();
    let key = null;
    if (exName.includes('squat') && exName.includes('front')) key = 'front_squat';
    else if (exName.includes('squat')) key = 'back_squat';
    else if (exName.includes('bench') && exName.includes('incline')) key = 'incline_bench';
    else if (exName.includes('bench')) key = 'bench_press';
    else if (exName.includes('trap bar')) key = 'trap_bar_dl';
    else if (exName.includes('deadlift') || exName.includes('rdl') || exName.includes('romanian')) key = 'deadlift';
    else if (exName.includes('overhead') || (exName.includes('press') && !exName.includes('bench'))) key = 'overhead_press';
    else if (exName.includes('row')) key = 'row';
    else if (exName.includes('clean')) key = 'hang_clean';
    if (!key || !oneRMs[key]) return null;
    return Math.round(oneRMs[key] * pct / 100 * 2) / 2;
  }, [ex.intensity, ex.name, ex.isNote, oneRMs]);

  const previous = useMemo(() => {
    if (ex.isNote || !ex.name) return null;
    return findPreviousWeight(PLAN, sessionsData, ex.name);
  }, [PLAN, ex.name, ex.isNote, sessionsData]);

  const historial = useMemo(() => {
    if (ex.isNote || !ex.name) return [];
    return historialDePeso(PLAN, sessionsData, ex.name);
  }, [PLAN, ex.name, ex.isNote, sessionsData]);

  /* El peso se GUARDA en kilos y se ESCRIBE en la unidad del atleta, así que
     el campo necesita su propio borrador. Sin él, cada tecla iría a kilos y
     volvería redondeada: escribir "185" en libras haría bailar el número
     debajo del dedo. El borrador guarda lo tecleado tal cual. */
  const pesoMostrado = pesoTexto(exData.weight, unidad);
  const [pesoEscrito, setPesoEscrito] = useState(pesoMostrado);
  useEffect(() => {
    // Solo se re-sincroniza cuando lo guardado ya NO es lo que hay escrito
    // (cambio de ejercicio, o de unidad). Comparando números y no textos,
    // para que un "8." a medio teclear sobreviva.
    const a = pesoEscrito.trim() === '' ? null : parseFloat(pesoEscrito);
    const b = pesoMostrado === '' ? null : parseFloat(pesoMostrado);
    if (a !== b) setPesoEscrito(pesoMostrado);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pesoMostrado]);

  if (ex.isNote) {
    return (
      <div style={{
        margin: '8px 0', padding: '10px 14px',
        background: LT.blueSoft, borderRadius: 10,
        fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
        color: LT.blue,
      }}>{ex.text}</div>
    );
  }

  const showWeightInput = isLoadedExercise(ex);
  const formattedIntensity = formatIntensity(ex.intensity);
  // El descanso lo escribe el coach en el editor de sesión. Antes lo adivinaba
  // `inferRest` leyendo el nombre del ejercicio, y el atleta lo leía como si
  // fuera una indicación de su entrenador. Si el coach no lo puso, no se
  // muestra nada: inventarle un descanso es peor que no darle ninguno.
  const rest = (ex.descanso || '').trim() || null;

  /* Los datos se pintan SOLO si el coach los puso. Nada de "—" ni de campos
     vacíos esperando: si no configuró la intensidad o el descanso, esa línea
     no existe. Petición de Andrés, y es lo correcto — un hueco vacío se lee
     como un fallo de la app. */
  const chips = [
    ex.reps ? `${ex.reps} reps` : null,
    formattedIntensity || null,
    rest || null,
  ].filter(Boolean);

  const pesoAnterior = showWeightInput && previous
    ? `${desdeKilos(previous.weight, unidad)} ${u}` : null;

  // Los discos suben de 2,5 en 2,5 kilos, o de 5 en 5 libras. Un paso de 1
  // obligaría a picarle veinte veces para subir un disco.
  const pasoPeso = unidad === 'lb' ? 5 : 2.5;

  return (
    <div style={{ padding: '11px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
        {/* La miniatura y el nombre abren la ficha con el video en grande. */}
        <button
          type="button"
          onClick={() => setMediaOpen(true)}
          style={{
            flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 11,
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
            fontFamily: FONT, textAlign: 'left',
          }}
        >
          <span style={{
            width: 52, height: 52, borderRadius: 11, flexShrink: 0, position: 'relative',
            overflow: 'hidden', display: 'grid', placeItems: 'center',
            background: portada ? '#0E1015' : pc + '14',
          }}>
            {portada ? (
              <>
                <img src={portada} alt=""
                  style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                {misVideos.length > 0 && (
                  <span style={{
                    position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                    background: 'rgba(0,0,0,0.25)', color: '#fff',
                  }}>
                    <Play size={16} fill="#fff" />
                  </span>
                )}
              </>
            ) : (
              <span style={{ fontSize: 15, fontWeight: 800, color: pc, ...NUM_STYLE }}>{num}</span>
            )}
          </span>

          <span style={{ flex: 1, minWidth: 0, paddingTop: 1 }}>
            <span style={{
              display: 'block', fontSize: 15.5, fontWeight: 700, color: LT.text,
              lineHeight: 1.25, overflowWrap: 'anywhere',
            }}>
              {ex.name}
            </span>
            {chips.length > 0 && (
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                {chips.map((c) => <Chip key={c}>{c}</Chip>)}
              </span>
            )}
          </span>

          <ChevronRight size={18} color={LT.text3} style={{ flexShrink: 0, marginTop: 17 }} />
        </button>
      </div>

      {/* Anotar sin salir de la lista. Solo aparece si el ejercicio lleva carga. */}
      {showWeightInput && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          gap: 10, marginTop: 10, paddingTop: 10, borderTop: `1px solid ${LT.border}`,
        }}>
          <button
            type="button"
            onClick={() => setProgresoAbierto(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0,
              border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
              fontFamily: FONT, fontSize: 12, fontWeight: 700, color: LT.blue, ...NUM_STYLE,
            }}
          >
            <LineChartIcon size={13} style={{ flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {pesoAnterior ? `Antes: ${pesoAnterior}` : 'Ver mi progreso'}
            </span>
          </button>

          <PasoNumero
            valor={pesoEscrito}
            paso={pasoPeso}
            sufijo={u}
            onCambio={(v) => {
              setPesoEscrito(v);
              onUpdate(idx, { ...exData, weight: v === '' ? '' : String(aKilos(v, unidad)) });
            }}
          />
        </div>
      )}

      {progresoAbierto && (
        <TarjetaProgreso
          nombre={ex.name}
          historial={historial}
          unidad={unidad}
          onCerrar={() => setProgresoAbierto(false)}
        />
      )}

      {mediaOpen && (
        <ExerciseMediaModal
          exercise={repertoire || { name: ex.name }}
          planEx={ex}
          medias={medias}
          perfil={profile}
          onClose={() => setMediaOpen(false)}
          registro={{
            notas: ex.notes || null,
            cue: ex.cue || null,
            descanso: rest,
            conPeso: showWeightInput,
            unidad: u,
            anterior: pesoAnterior,
            recomendado: recommended !== null ? `${desdeKilos(recommended, unidad)} ${u}` : null,
            control: (
              <PasoNumero
                valor={pesoEscrito}
                paso={pasoPeso}
                onCambio={(v) => {
                  setPesoEscrito(v);
                  onUpdate(idx, { ...exData, weight: v === '' ? '' : String(aKilos(v, unidad)) });
                }}
              />
            ),
          }}
        />
      )}
    </div>
  );
};

// Helper: agrupa ejercicios en sets segun la propiedad `set`. Ejercicios con el mismo
// numero de set se muestran juntos (bi-serie / tri-serie). Sin `set`, cada uno es su set.
const groupIntoSets = (exercises) => {
  const groups = [];
  let current = null;
  exercises.forEach((ex, idx) => {
    if (ex.isNote) {
      groups.push({ isNote: true, ex, idx });
      current = null;
      return;
    }
    const key = ex.set != null ? `set-${ex.set}` : `solo-${idx}`;
    if (!current || current.key !== key) {
      current = { key, exercises: [] };
      groups.push(current);
    }
    current.exercises.push({ ex, idx });
  });
  return groups;
};

const SetGroup = ({ group, setNum, phaseColor, sessionData, onUpdate, oneRMs, sessionsData }) => {
  if (group.isNote) {
    return (
      <div style={{
        margin: '4px 0 12px', padding: '10px 14px', background: LT.blueSoft, borderRadius: 10,
        fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: LT.blue,
      }}>{group.ex.text}</div>
    );
  }
  const count = group.exercises.length;
  const typeLabel = count >= 3 ? 'Tri-serie' : count === 2 ? 'Bi-serie' : null;
  const rondas = group.exercises[0].ex.sets;

  /* Una sola tarjeta por SERIE, con los ejercicios dentro separados por una
     línea. Antes era una tarjeta por ejercicio, y una bi-serie —dos ejercicios
     que se alternan— se veía igual que dos ejercicios sueltos: la tarjeta
     decía "van juntos" y el corte entre tarjetas decía lo contrario. */
  return (
    <div style={{ marginBottom: 20 }}>
      <div style={{
        display: 'flex', alignItems: 'baseline', justifyContent: 'space-between',
        gap: 10, marginBottom: 8, padding: '0 3px',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: LT.text }}>Serie {setNum}</span>
          {typeLabel && (
            <span style={{
              fontSize: 10, fontWeight: 800, color: LT.blue, background: LT.blueSoft,
              padding: '2px 8px', borderRadius: 6, letterSpacing: 0.3, flexShrink: 0,
            }}>
              {typeLabel}
            </span>
          )}
        </div>
        {rondas && (
          <span style={{ fontSize: 12.5, color: LT.text2, fontWeight: 600, flexShrink: 0, ...NUM_STYLE }}>
            Se repite {rondas} {parseInt(rondas, 10) === 1 ? 'vez' : 'veces'}
          </span>
        )}
      </div>

      {typeLabel && (
        <div style={{ fontSize: 11.5, color: LT.text3, marginBottom: 8, padding: '0 3px', fontWeight: 600 }}>
          Alterna los ejercicios sin descanso completo entre ellos
        </div>
      )}

      <div style={{
        background: LT.surface, border: `1px solid ${LT.border}`,
        borderRadius: 16, overflow: 'hidden',
      }}>
        {group.exercises.map(({ ex, idx }, i) => (
          <div key={idx} style={{ borderTop: i > 0 ? `1px solid ${LT.border}` : 'none' }}>
            <ExerciseRow
              ex={ex} idx={idx} num={i + 1} phaseColor={phaseColor}
              sessionData={sessionData} onUpdate={onUpdate} oneRMs={oneRMs} sessionsData={sessionsData}
            />
          </div>
        ))}
      </div>
    </div>
  );
};


// Helper: get summary info for a day (count of exercises, intensity, etc.)
const getDaySummary = (day) => {
  let exCount = 0;
  let mainIntensity = null;
  let previews = [];
  if (day.exercises) {
    exCount = day.exercises.filter(e => !e.isNote).length;
    const first = day.exercises.find(e => !e.isNote && e.intensity);
    if (first) mainIntensity = first.intensity;
    previews = day.exercises.filter(e => !e.isNote).slice(0, 4);
  } else if (day.blocks) {
    day.blocks.forEach(blk => {
      if (blk.type === 'lift' && blk.exercises) {
        const real = blk.exercises.filter(e => !e.isNote);
        exCount += real.length;
        if (!mainIntensity) {
          const first = real.find(e => e.intensity);
          if (first) mainIntensity = first.intensity;
        }
        previews.push(...real.slice(0, 2));
      }
    });
    previews = previews.slice(0, 4);
  }
  return { exCount, mainIntensity, previews };
};


// Colapsable claro
const LightCollapsible = ({ title, icon: Icon, color, children, defaultOpen = false }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: LT.surface, border: 'none', borderRadius: 18, marginBottom: 14, overflow: 'hidden', boxShadow: '0 1px 3px rgba(17,19,24,0.05)' }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT,
        display: 'flex', alignItems: 'center', gap: 8, padding: '15px 18px', textAlign: 'left',
      }}>
        {Icon && <Icon size={14} style={{ color: color || LT.blue }} />}
        <span style={{ flex: 1, fontSize: 14, fontWeight: 700, color: LT.text }}>{title}</span>
        {open ? <ChevronUp size={16} style={{ color: LT.text3 }} /> : <ChevronDown size={16} style={{ color: LT.text3 }} />}
      </button>
      {open && <div style={{ padding: '0 18px 18px' }}>{children}</div>}
    </div>
  );
};

const LightScienceList = ({ sections }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
    {sections.map(s => (
      <div key={s.key}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          {s.icon && <s.icon size={13} style={{ color: s.color }} />}
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: s.color }}>{s.label}</span>
        </div>
        <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
          {(Array.isArray(s.content) ? s.content : [s.content]).map((item, i) => {
            const isObj = item && typeof item === 'object';
            return (
              <li key={i} style={{ fontSize: 13, color: LT.text2, lineHeight: 1.6, padding: '5px 0 5px 16px', position: 'relative' }}>
                <span style={{ position: 'absolute', left: 0, top: isObj ? 11 : 12, width: 5, height: 5, borderRadius: '50%', background: s.color, opacity: 0.7 }} />
                {isObj ? (
                  <>
                    <span style={{ display: 'block', fontWeight: 700, color: LT.text, marginBottom: 2 }}>{item.t}</span>
                    <span style={{ display: 'block' }}>{item.d}</span>
                  </>
                ) : item}
              </li>
            );
          })}
        </ul>
      </div>
    ))}
  </div>
);

const LightWorkoutScience = ({ science }) => {
  if (!science) return null;
  const sections = [
    { key: 'estructura', label: 'Estructura', icon: Layers, color: '#7C5CFF' },
    { key: 'seleccion', label: 'Selección de ejercicios', icon: Target, color: LT.blue },
    { key: 'orden', label: 'Orden del workout', icon: List, color: LT.mint },
    { key: 'frecuencia', label: 'Frecuencia y recuperación', icon: Clock, color: LT.warning },
    { key: 'tradeoffs', label: 'Trade-offs considerados', icon: Scale, color: LT.blueDk },
  ].filter(s => science[s.key]).map(s => ({ ...s, content: science[s.key] }));
  return <LightScienceList sections={sections} />;
};

const LightWeekScience = ({ science }) => {
  if (!science) return null;
  if (typeof science === 'string') return <div style={{ fontSize: 13, color: LT.text2, lineHeight: 1.7 }}>{science}</div>;
  const sections = [
    { key: 'changes', label: 'Cambios', icon: Repeat, color: '#7C5CFF' },
    { key: 'why', label: 'Por qué', icon: Sparkles, color: LT.mint },
    { key: 'observe', label: 'Qué observar', icon: Eye, color: LT.warning },
  ].filter(b => science[b.key]).map(b => ({ ...b, content: science[b.key] }));
  return <LightScienceList sections={sections} />;
};

const WeekDetail = ({ phase, week, onBack, sessionsData, updateSession, oneRMs, activeSessionId }) => {
  const esCompu = useIsDesktop();
  const phaseColor = phase.color || LT.blue;
  const completedCount = week.days.filter((_, idx) => sessionsData[sessionId(phase.id, week.num, idx)]?.completed).length;

  // Abre en el día de hoy; si hoy no entrena, en el primero de la semana.
  const initialIdx = useMemo(() => {
    const wd = weekdayToday();
    const idx = week.days.findIndex((d) => d.day === wd);
    return idx === -1 ? 0 : idx;
  }, [week]);
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);
  const [openBlocks, setOpenBlocks] = useState({ 0: true });
  useEffect(() => { setOpenBlocks({ 0: true }); }, [selectedIdx]);

  const selectedDay = week.days[selectedIdx];
  const selectedId = sessionId(phase.id, week.num, selectedIdx);
  const sessionData = sessionsData[selectedId] || {};
  const selectedCompleted = !!sessionData.completed;
  const selectedDayName = selectedDay.name || (selectedDay.blocks ? selectedDay.blocks.map(b => b.tag.replace(/^Sesi[óo]n \d+ \([AP]M\): /, '')).join(' + ') : selectedDay.day);
  const cat = CAT_COLORS[selectedDay.cat] || CAT_COLORS.gym;
  const summary = useMemo(() => getDaySummary(selectedDay), [selectedDay]);

  const setExerciseData = (blockIdx, exIdx, data) => {
    updateSession(selectedId, prev => {
      const ex = prev?.exercises || {};
      const key = blockIdx !== null ? `${blockIdx}-${exIdx}` : `${exIdx}`;
      return { ...prev, exercises: { ...ex, [key]: data } };
    });
  };
  const updateNotes = (notes) => updateSession(selectedId, prev => ({ ...prev, notes }));
  const toggleComplete = () => updateSession(selectedId, prev => ({
    ...prev, completed: !prev?.completed,
    completedAt: !prev?.completed ? new Date().toISOString() : null
  }));

  const flatSessionData = { exercises: sessionData.exercises ? Object.fromEntries(Object.entries(sessionData.exercises).filter(([k]) => !k.includes('-')).map(([k, v]) => [parseInt(k), v])) : {} };

  return (
    <div style={{ padding: '14px 18px 110px', background: LT.bg, minHeight: '100svh', fontFamily: FONT }}>
      <button onClick={onBack} style={{
        background: 'transparent', border: 'none', color: LT.text2, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 4, marginBottom: 14, fontFamily: FONT, fontSize: 13, padding: 0,
      }}>
        <ChevronLeft size={16} /> {phase.fullName}
      </button>

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: phaseColor, marginBottom: 6 }}>
        <span style={{ color: LT.text3 }}>{phase.fullName} · </span>
        {phase.mode === 'microcycle' ? 'Microciclo' : `Semana ${week.num} de ${phase.weeks}`}
      </div>

      <h1 style={{ fontSize: 27, fontWeight: 800, color: LT.text, margin: 0, marginBottom: 8, lineHeight: 1.05, letterSpacing: -0.6 }}>
        {week.label}
      </h1>

      <div style={{ fontSize: 13.5, color: LT.text2, marginBottom: 4, lineHeight: 1.55 }}>{week.load}</div>

      {week.emph && (
        <div style={{ marginTop: 10, borderLeft: `3px solid ${LT.warning}`, paddingLeft: 14, fontSize: 13, color: LT.text, lineHeight: 1.6, fontStyle: 'italic', padding: '8px 14px', background: LT.warning + '0D', borderRadius: '0 8px 8px 0' }}>
          {week.emph}
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginTop: 16, marginBottom: 18 }}>
        <div style={{ flex: 1, height: 5, background: LT.surface2, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${(completedCount / week.days.length) * 100}%`, background: phaseColor, transition: 'width 0.3s' }} />
        </div>
        <span style={{ fontSize: 12, color: LT.text2, fontWeight: 600, ...NUM_STYLE }}>{completedCount}/{week.days.length}</span>
      </div>

      {/* Días de la semana: pestañas planas con subrayado, mismo lenguaje que
          la app del entrenador. Antes cada día era una caja con borde y, al
          elegirlo, se pintaba entera de color.

          El problema no era feo, era de lectura: cada pestaña carga CUATRO
          señales a la vez (qué día ves, si ya lo hiciste, de qué tipo es, y
          cuál sigue). Metidas todas en una caja de color, compiten entre
          ellas. Sin caja, el subrayado dice "estás aquí" y las demás señales
          quedan abajo, en voz baja, sin pelearse por el mismo espacio. */}
      <div style={{
        display: 'flex', gap: 2, marginBottom: 18, overflowX: 'auto',
        borderBottom: `1px solid ${LT.border}`,
      }}>
        {week.days.map((day, idx) => {
          const id = sessionId(phase.id, week.num, idx);
          const sd = sessionsData[id];
          const isCompleted = !!sd?.completed;
          const isActive = activeSessionId === id;
          const isSelected = selectedIdx === idx;
          const dcat = CAT_COLORS[day.cat] || CAT_COLORS.gym;
          return (
            <button key={idx} onClick={() => setSelectedIdx(idx)}
              style={{
                padding: esCompu ? '11px 17px 12px' : '11px 12px 12px',
                border: 'none', background: 'transparent', cursor: 'pointer',
                fontFamily: FONT, fontSize: 14.5, fontWeight: isSelected ? 800 : 600,
                color: isSelected ? phaseColor : LT.text2, whiteSpace: 'nowrap', flexShrink: 0,
                borderBottom: `2.5px solid ${isSelected ? phaseColor : 'transparent'}`,
                marginBottom: -1, transition: 'color .12s, border-color .12s',
              }}>
              {esCompu ? (NOMBRE_DIA[day.day] || day.day) : day.day}

              {/* Una sola marca por dia, siempre del mismo ancho.
                  Antes eran DOS puntos pegados en el dia que estaba a medias:
                  uno de la categoria y otro de "en curso". Se veia como un
                  error de dibujo —lo era, en la practica— porque nadie deduce
                  que el segundo punto significa "esta empezada".

                  Ahora el estado va en la FORMA, no en la cantidad:
                    hecha     -> palomita verde
                    a medias  -> el punto con un anillo alrededor
                    pendiente -> el punto solo
                  El color sigue siendo el de la categoria del dia. */}
              <span style={{
                display: 'inline-grid', placeItems: 'center', verticalAlign: 'middle',
                width: 13, height: 13, marginLeft: 6,
              }}>
                {isCompleted ? (
                  <Check size={12} strokeWidth={3} style={{ color: LT.mint }} />
                ) : (
                  <span
                    title={isActive ? 'La dejaste empezada' : undefined}
                    style={{
                      width: 5, height: 5, borderRadius: '50%', background: dcat.c,
                      boxShadow: isActive ? `0 0 0 2.5px ${phaseColor}55` : 'none',
                    }}
                  />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Card del día seleccionado claro */}
      <div style={{ background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 18, padding: 18, marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
          <button onClick={toggleComplete} style={{
            width: 28, height: 28, borderRadius: '50%',
            border: `2px solid ${selectedCompleted ? LT.mint : LT.borderHi}`,
            background: selectedCompleted ? LT.mint : 'transparent',
            cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 0, marginTop: 2,
          }}>
            {selectedCompleted && <Check size={14} style={{ color: '#fff' }} strokeWidth={3.5} />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: cat.c }}>{selectedDay.day} · {cat.label}</span>
              {selectedDay.dual && <span style={{ fontSize: 10, color: LT.warning, fontWeight: 700 }}>· DOBLE</span>}
              {activeSessionId === selectedId && !selectedCompleted && <span style={{ fontSize: 10, color: LT.blue, fontWeight: 700 }}>· SIGUIENTE</span>}
            </div>
            {selectedDay.dual ? (
              <div style={{ fontSize: 22, fontWeight: 800, color: selectedCompleted ? LT.text2 : LT.text, marginBottom: 4, lineHeight: 1.15, letterSpacing: -0.5 }}>
                Doble sesión
                <span style={{ display: 'block', fontSize: 12, fontWeight: 600, color: LT.text3, marginTop: 4, letterSpacing: 0 }}>AM y PM separadas, abre cada una abajo</span>
              </div>
            ) : (
              <>
                <div style={{ fontSize: 22, fontWeight: 800, color: selectedCompleted ? LT.text2 : LT.text, marginBottom: 14, lineHeight: 1.15, letterSpacing: -0.5 }}>
                  {selectedDayName}
                </div>
                {(summary.exCount > 0 || summary.mainIntensity) && (
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                    {summary.exCount > 0 && (
                      <div>
                        <div style={{ fontSize: 10, color: LT.text3, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 2 }}>Ejercicios</div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: LT.text, ...NUM_STYLE }}>{summary.exCount}</div>
                      </div>
                    )}
                    {summary.mainIntensity && (
                      <div>
                        <div style={{ fontSize: 10, color: LT.text3, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: 700, marginBottom: 2 }}>Intensidad</div>
                        <div style={{ fontSize: 17, fontWeight: 800, color: LT.text, ...NUM_STYLE }}>{summary.mainIntensity}</div>
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Ejercicios agrupados en sets */}
      {selectedDay.exercises && (() => {
        const groups = groupIntoSets(selectedDay.exercises);
        let setNum = 0;
        return groups.map((g, gi) => {
          if (!g.isNote) setNum += 1;
          return (
            <SetGroup key={`${selectedIdx}-${gi}`} group={g} setNum={setNum} phaseColor={phaseColor}
              sessionData={flatSessionData}
              onUpdate={(idx, data) => setExerciseData(null, idx, data)}
              oneRMs={oneRMs} sessionsData={sessionsData} />
          );
        });
      })()}

      {selectedDay.blocks && selectedDay.blocks.map((blk, bi) => {
        const blkSessionData = { exercises: sessionData.exercises ? Object.fromEntries(Object.entries(sessionData.exercises).filter(([k]) => k.startsWith(`${bi}-`)).map(([k, v]) => [parseInt(k.split('-')[1]), v])) : {} };
        const hasPeriod = /\([AP]M\)/.test(blk.tag);
        const isPM = /\(PM\)/.test(blk.tag);
        const cleanName = blk.tag.replace(/^Sesi[óo]n \d+ \([AP]M\):\s*/, '');
        const accent = hasPeriod ? (isPM ? phaseColor : LT.warning) : phaseColor;
        const exN = blk.type === 'lift' && blk.exercises ? blk.exercises.filter(e => !e.isNote).length : null;
        const isOpen = !!openBlocks[bi];
        return (
          <div key={`${selectedIdx}-blk-${bi}`} style={{ marginBottom: 12, background: LT.surface, border: `1px solid ${isOpen ? accent + '55' : LT.border}`, borderRadius: 16, overflow: 'hidden' }}>
            <button onClick={() => setOpenBlocks(p => ({ ...p, [bi]: !p[bi] }))} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10, padding: '14px 16px',
              background: 'transparent', border: 'none', borderLeft: `4px solid ${accent}`, cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
            }}>
              {hasPeriod && <span style={{ fontSize: 10, fontWeight: 800, color: '#fff', background: accent, borderRadius: 6, padding: '3px 8px', letterSpacing: 0.5, flexShrink: 0 }}>{isPM ? 'PM' : 'AM'}</span>}
              <span style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700, color: LT.text }}>{cleanName}</span>
              {exN != null && <span style={{ fontSize: 12, fontWeight: 600, color: LT.text3, flexShrink: 0, ...NUM_STYLE }}>{exN} ej</span>}
              {isOpen ? <ChevronUp size={18} style={{ color: LT.text3, flexShrink: 0 }} /> : <ChevronDown size={18} style={{ color: LT.text3, flexShrink: 0 }} />}
            </button>
            {isOpen && (
              <div style={{ padding: '2px 16px 16px' }}>
                {blk.type === 'lift' && (() => {
                  const groups = groupIntoSets(blk.exercises);
                  let setNum = 0;
                  return groups.map((g, gi) => {
                    if (!g.isNote) setNum += 1;
                    return (
                      <SetGroup key={gi} group={g} setNum={setNum} phaseColor={phaseColor}
                        sessionData={blkSessionData}
                        onUpdate={(idx, data) => setExerciseData(bi, idx, data)}
                        oneRMs={oneRMs} sessionsData={sessionsData} />
                    );
                  });
                })()}
                {blk.type === 'speed' && (
                  <ul style={{ margin: '4px 0 0', paddingLeft: 16, color: LT.text2, fontSize: 14, lineHeight: 1.7 }}>
                    {blk.bullets.map((b, i) => (
                      <li key={i} style={typeof b === 'object' && b.bold ? { color: LT.text, fontWeight: 600 } : {}}>
                        {typeof b === 'object' ? b.text : b}
                      </li>
                    ))}
                  </ul>
                )}
                {blk.type === 'note' && (
                  <div style={{ padding: 12, background: LT.bg, border: `1px solid ${LT.border}`, borderRadius: 10, fontSize: 13, color: LT.text2, lineHeight: 1.6 }}>
                    {blk.text}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {selectedDay.notes && !selectedDay.exercises && !selectedDay.blocks && (
        <div style={{ background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
          <ul style={{ margin: 0, paddingLeft: 18, color: LT.text2, fontSize: 14, lineHeight: 1.7 }}>
            {selectedDay.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}

      {selectedDay.notes && (selectedDay.exercises || selectedDay.blocks) && (
        <div style={{ background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: LT.text3, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Notas del día</div>
          <ul style={{ margin: 0, paddingLeft: 18, color: LT.text2, fontSize: 13, lineHeight: 1.7 }}>
            {selectedDay.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}

      {/* Notas del usuario */}
      <div style={{ background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
          <Edit3 size={12} style={{ color: LT.text3 }} />
          <span style={{ fontSize: 11, color: LT.text3, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>Tus notas</span>
        </div>
        <textarea
          value={sessionData.notes || ''}
          onChange={e => updateNotes(e.target.value)}
          placeholder="Cómo te sentiste, ajustes, observaciones..."
          rows={3}
          style={{
            width: '100%', background: LT.bg, border: `1px solid ${LT.border}`,
            borderRadius: 10, padding: 12, color: LT.text, fontFamily: FONT, fontSize: 13,
            outline: 'none', resize: 'vertical', boxSizing: 'border-box',
          }}
          onFocus={e => e.target.style.borderColor = LT.blue}
          onBlur={e => e.target.style.borderColor = LT.border}
        />
      </div>

      {selectedDay.dayScience && (
        <LightCollapsible title="Por qué este día" icon={Info} color={LT.blue}>
          <div style={{ fontSize: 13.5, color: LT.text2, lineHeight: 1.7 }}>{selectedDay.dayScience}</div>
        </LightCollapsible>
      )}

      {selectedDay.workoutScience && (
        <LightCollapsible title="Por qué este workout" icon={Sparkles} color={LT.mint}>
          <LightWorkoutScience science={selectedDay.workoutScience} />
        </LightCollapsible>
      )}

      {week.weekScience && (
        <LightCollapsible title="Por qué esta semana" icon={BookOpen} color={LT.text2}>
          <LightWeekScience science={week.weekScience} />
        </LightCollapsible>
      )}
    </div>
  );
};

const WeekCard = ({ week, phase, isActiveWeek, isFullyDone, completed, total, loadPct, sessionsData, onClick }) => {
  const [hover, setHover] = useState(false);
  const pc = phase.color || T.accent;
  return (
    <div onClick={onClick}
      onMouseEnter={() => setHover(true)} onMouseLeave={() => setHover(false)}
      style={{
        background: T.bg2, borderRadius: 18, padding: 16, cursor: 'pointer',
        border: `1px solid ${isActiveWeek ? pc + '55' : 'transparent'}`,
        boxShadow: hover ? '0 6px 20px rgba(17,19,24,0.10)' : '0 1px 3px rgba(17,19,24,0.05)',
        transition: 'box-shadow 0.15s, border-color 0.15s, transform 0.1s',
        transform: hover ? 'translateY(-1px)' : 'none',
      }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <div style={{
          width: 34, height: 34, borderRadius: 9, flexShrink: 0,
          background: isFullyDone ? T.accent : isActiveWeek ? pc : T.bg3,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {isFullyDone
            ? <Check size={16} style={{ color: '#fff' }} strokeWidth={3} />
            : <span style={{ fontSize: 14, fontWeight: 800, color: isActiveWeek ? '#fff' : T.text2, ...NUM_STYLE }}>{week.num}</span>}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>
              {phase.mode === 'microcycle' ? 'Microciclo' : `Semana ${week.num}`}
            </span>
            {isActiveWeek && (
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: T.accent, background: T.accentBg, padding: '2px 7px', borderRadius: 5 }}>AHORA</span>
            )}
            {isFullyDone && !isActiveWeek && (
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: T.mint || '#00A372', background: 'rgba(0,163,114,0.12)', padding: '2px 7px', borderRadius: 5 }}>HECHA</span>
            )}
          </div>
          <div style={{ fontSize: 12.5, color: T.text2, marginTop: 2, lineHeight: 1.3, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{week.label}</div>
        </div>
        <ChevronRight size={18} style={{ color: T.text3, flexShrink: 0 }} />
      </div>

      {/* Carga relativa */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 5 }}>
          <span style={{ fontSize: 10, color: T.text3, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase' }}>Carga de la semana</span>
          <span style={{ fontSize: 11, color: T.text2, fontWeight: 600 }}>{week.load}</span>
        </div>
        <div style={{ height: 6, background: T.bg3, borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${loadPct}%`, background: pc, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
      </div>

      {/* Progreso de días */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <div style={{ display: 'flex', gap: 4 }}>
          {week.days.map((day, idx) => {
            const id = sessionId(phase.id, week.num, idx);
            const sd = sessionsData[id];
            const done = !!sd?.completed;
            const cat = CAT_COLORS[day.cat] || CAT_COLORS.gym;
            return (
              <div key={idx} style={{
                width: 26, height: 26, borderRadius: 7,
                background: done ? 'rgba(0,163,114,0.12)' : T.bg3,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, position: 'relative',
              }}>
                {done
                  ? <Check size={11} style={{ color: '#00A372' }} strokeWidth={3} />
                  : <>
                      <span style={{ fontSize: 9, fontWeight: 800, color: T.text3 }}>{day.day.slice(0, 1).toUpperCase()}</span>
                      <span style={{ position: 'absolute', bottom: 3, width: 3.5, height: 3.5, borderRadius: '50%', background: cat.c }} />
                    </>}
                {day.dual && !done && (
                  <span style={{ position: 'absolute', top: -3, right: -3, fontSize: 7, fontWeight: 800, color: T.warning, background: T.bg2, border: `1px solid ${T.warning}`, padding: '0 2px', borderRadius: 3 }}>2X</span>
                )}
              </div>
            );
          })}
        </div>
        <span style={{ fontSize: 11, color: T.text3, marginLeft: 'auto', fontWeight: 600, ...NUM_STYLE }}>{completed}/{total}</span>
      </div>
    </div>
  );
};

const PhaseDetail = ({ phase, onBack, onSelectWeek, sessionsData, activeWeekKey }) => {
  // Extract a "load value" 0-100 per week for the arc visualization
  const getWeekLoad = (week) => {
    if (week.load) {
      const m = week.load.match(/(\d+)\s*%/);
      if (m) return parseInt(m[1]);
    }
    if (phase.id === 'f1') return 25;
    if (phase.id === 'f2') return 55;
    if (phase.id === 'deload') return 55;
    if (phase.id === 'f6') return 75;
    if (phase.id === 'f7') return 78;
    if (phase.id === 'f8') return 82;
    return 60;
  };

  const arcItems = phase.weekData.map(week => {
    const load = getWeekLoad(week);
    let completed = 0, total = 0;
    week.days.forEach((_, i) => {
      total++;
      if (sessionsData[sessionId(phase.id, week.num, i)]?.completed) completed++;
    });
    const isActive = activeWeekKey === `${phase.id}-w${week.num}`;
    return { week, load, completed, total, pct: total > 0 ? completed / total : 0, isActive };
  });
  const maxLoad = Math.max(...arcItems.map(i => i.load), 1);

  const weekProgress = (week) => {
    const completed = week.days.filter((_, idx) => sessionsData[sessionId(phase.id, week.num, idx)]?.completed).length;
    return { completed, total: week.days.length };
  };

  return (
    <div style={{ padding: '16px 20px 100px' }}>
      <button onClick={onBack} style={{
        background: 'transparent', border: 'none', color: T.text3, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 4, marginBottom: 18, fontFamily: FONT, fontSize: 13, padding: 0,
      }}>
        <ChevronLeft size={16} /> Plan
      </button>

      <Caption color={phase.color} style={{ marginBottom: 10 }}>Fase {phase.num} · {phase.duration}</Caption>
      <h1 style={{ fontSize: 'clamp(25px, 8vw, 34px)', fontWeight: 800, color: T.text, margin: 0, lineHeight: 1.08, letterSpacing: -1, overflowWrap: 'anywhere' }}>{phase.fullName}</h1>

      <div style={{ fontSize: 14.5, color: T.text2, lineHeight: 1.55, marginTop: 20, marginBottom: 24 }}>{phase.objective}</div>

      <div style={{ fontSize: 12, color: T.text3, fontWeight: 700, letterSpacing: 0.8, textTransform: 'uppercase', marginBottom: 14 }}>
        {phase.mode === 'microcycle' ? 'Microciclo tipo' : `${phase.weekData.length} semanas`}
      </div>

      {/* Cards de semana */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
        {phase.weekData.map((week) => {
          const { completed, total } = weekProgress(week);
          const weekKey = `${phase.id}-w${week.num}`;
          const isActiveWeek = activeWeekKey === weekKey;
          const isFullyDone = completed === total && total > 0;
          const loadPct = Math.round((getWeekLoad(week) / maxLoad) * 100);
          return (
            <WeekCard key={week.num} week={week} phase={phase} isActiveWeek={isActiveWeek}
              isFullyDone={isFullyDone} completed={completed} total={total} loadPct={loadPct}
              sessionsData={sessionsData} onClick={() => onSelectWeek(week)} />
          );
        })}
      </div>

      {(phase.science || phase.advance?.length || phase.references?.length) ? (
        <Collapsible title="Por qué esta fase" icon={Info}>
          <div style={{ paddingTop: 4 }}>
            {phase.science && (
              <div style={{ fontSize: 13.5, color: T.text2, lineHeight: 1.7, marginBottom: 14 }}>{phase.science}</div>
            )}
            {phase.advance?.length > 0 && (
              <>
                <Caption style={{ marginBottom: 6 }}>Marcadores para avanzar</Caption>
                <ul style={{ margin: 0, paddingLeft: 16, color: T.text2, fontSize: 12, lineHeight: 1.7, marginBottom: 14 }}>
                  {phase.advance.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              </>
            )}
            {phase.references?.length > 0 && (
              <>
                <Caption style={{ marginBottom: 6 }}>Referencias</Caption>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                  {phase.references.map((r, i) => (
                    <span key={i} style={{ fontSize: 11, padding: '3px 8px', background: T.bg3, borderRadius: 4, color: T.text2 }}>{r}</span>
                  ))}
                </div>
              </>
            )}
          </div>
        </Collapsible>
      ) : null}
    </div>
  );
};

const PlanOverview = ({ onSelectPhase, sessionsData, activePhaseId }) => {
  const { phases: PLAN, planMeta } = usePlan();
  const phaseProgress = (phase) => {
    let total = 0, completed = 0;
    phase.weekData.forEach(week => {
      week.days.forEach((_, idx) => { total++; if (sessionsData[sessionId(phase.id, week.num, idx)]?.completed) completed++; });
    });
    return { total, completed, pct: total > 0 ? (completed / total) * 100 : 0 };
  };

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: '20px 20px 20px' }}>
        <Caption color={T.text3} style={{ marginBottom: 6 }}>{planMeta?.title || 'Plan de entrenamiento'}</Caption>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: T.text, margin: 0, lineHeight: 1.05, letterSpacing: -1 }}>
          {PLAN.length === 1 ? 'Tu programa' : `Las ${PLAN.length} fases`}
        </h1>
        <div style={{ marginTop: 6, fontSize: 14, color: T.text2 }}>
          {PLAN.reduce((s, p) => s + (p.weekData?.length || 0), 0)} semanas · periodización por bloques
        </div>
      </div>

      <div style={{ padding: '0 20px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {PLAN.map(phase => {
            const { total, completed, pct } = phaseProgress(phase);
            const isCurrent = activePhaseId === phase.id;
            const isDone = total > 0 && completed === total;
            return (
              <Card key={phase.id} onClick={() => onSelectPhase(phase)} active={isCurrent}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: isCurrent ? phase.color : T.bg3,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0, color: isCurrent ? '#06060A' : phase.color,
                    fontWeight: 800, fontSize: 13, ...NUM_STYLE,
                  }}>{phase.num}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: T.text }}>{phase.fullName}</span>
                      {isCurrent && <span style={{ fontSize: 10, color: T.accent, fontWeight: 700, letterSpacing: 0.5 }}>· AHORA</span>}
                      {isDone && !isCurrent && <Check size={12} style={{ color: T.accent }} strokeWidth={3} />}
                    </div>
                    <div style={{ fontSize: 12, color: T.text3 }}>{phase.duration} · {phase.focus}</div>
                    {total > 0 && (
                      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
                        <div style={{ flex: 1, height: 2, background: T.bg3, borderRadius: 1, overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${pct}%`, background: isDone ? T.accent : phase.color, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 10, color: T.text3, ...NUM_STYLE, minWidth: 28, textAlign: 'right' }}>{Math.round(pct)}%</span>
                      </div>
                    )}
                  </div>
                  <ChevronRight size={16} style={{ color: T.text3, flexShrink: 0 }} />
                </div>
              </Card>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const ReadinessRing = ({ score, size = 110 }) => {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - (score || 0) / 10);
  const color = score >= 7 ? T.accent : score >= 5 ? T.warning : T.danger;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={radius} stroke={T.bg3} strokeWidth={stroke} fill="none" />
        <circle cx={size/2} cy={size/2} r={radius} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.6s, stroke 0.3s' }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontSize: 28, fontWeight: 800, color, lineHeight: 1, ...NUM_STYLE }}>{score?.toFixed(1) || '—'}</div>
        <div style={{ fontSize: 10, color: T.text3, marginTop: 2, fontWeight: 600 }}>/ 10</div>
      </div>
    </div>
  );
};

// Modal selector de cursor: tap fase → semanas, tap semana → días, tap día → selecciona y cierra
const CursorSelector = ({ current, sessionsData, onSelect, onClose }) => {
  const { phases: PLAN } = usePlan();
  const [expandedPhase, setExpandedPhase] = useState(current?.phaseId || null);
  const [expandedWeek, setExpandedWeek] = useState(current ? `${current.phaseId}-w${current.weekNum}` : null);

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      zIndex: 200, display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: T.bg, width: '100%', maxWidth: 600, maxHeight: '85vh',
        borderRadius: '24px 24px 0 0', display: 'flex', flexDirection: 'column',
        border: `1px solid ${T.border}`, borderBottom: 'none',
      }}>
        {/* Handle */}
        <div style={{ display: 'flex', justifyContent: 'center', padding: '10px 0 6px' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: T.text4 }} />
        </div>
        {/* Header */}
        <div style={{
          padding: '8px 20px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          borderBottom: `1px solid ${T.border}`,
        }}>
          <div>
            <Caption color={T.accent} style={{ marginBottom: 4 }}>Cambiar sesión actual</Caption>
            <div style={{ fontSize: 13, color: T.text2 }}>Elige fase, semana y día</div>
          </div>
          <button onClick={onClose} style={{
            background: T.bg3, border: 'none', width: 32, height: 32, borderRadius: '50%',
            display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
          }}>
            <X size={16} style={{ color: T.text2 }} />
          </button>
        </div>
        {/* Lista */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '12px 12px 24px' }}>
          {PLAN.map(phase => {
            const phaseExpanded = expandedPhase === phase.id;
            return (
              <div key={phase.id} style={{ marginBottom: 6 }}>
                <button
                  onClick={() => setExpandedPhase(p => p === phase.id ? null : phase.id)}
                  style={{
                    width: '100%', background: phaseExpanded ? T.bg2 : 'transparent',
                    border: `1px solid ${phaseExpanded ? phase.color + '40' : T.border}`,
                    borderRadius: 12, padding: '14px 16px',
                    display: 'flex', alignItems: 'center', gap: 12,
                    cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
                    borderLeft: `4px solid ${phase.color}`,
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                      <Caption color={phase.color}>Fase {phase.num}</Caption>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: T.text, lineHeight: 1.2 }}>{phase.fullName}</div>
                    <div style={{ fontSize: 11, color: T.text3, marginTop: 2 }}>{phase.duration}</div>
                  </div>
                  {phaseExpanded ? <ChevronUp size={16} style={{ color: T.text3 }} /> : <ChevronDown size={16} style={{ color: T.text3 }} />}
                </button>

                {phaseExpanded && (
                  <div style={{ paddingLeft: 14, paddingTop: 8, paddingBottom: 4 }}>
                    {phase.weekData.map(week => {
                      const weekKey = `${phase.id}-w${week.num}`;
                      const weekExpanded = expandedWeek === weekKey;
                      const completedCount = week.days.filter((_, i) => sessionsData[sessionId(phase.id, week.num, i)]?.completed).length;
                      return (
                        <div key={week.num} style={{ marginBottom: 4 }}>
                          <button
                            onClick={() => setExpandedWeek(w => w === weekKey ? null : weekKey)}
                            style={{
                              width: '100%', background: weekExpanded ? T.bg3 : T.bg2,
                              border: `1px solid ${T.border}`,
                              borderRadius: 10, padding: '10px 14px',
                              display: 'flex', alignItems: 'center', gap: 10,
                              cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
                            }}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: 13, fontWeight: 700, color: T.text, marginBottom: 2 }}>
                                {phase.mode === 'microcycle' ? 'Microciclo' : `Sem ${week.num}`}
                              </div>
                              <div style={{ fontSize: 11, color: T.text3, ...NUM_STYLE }}>
                                {completedCount}/{week.days.length} completadas · {week.label || ''}
                              </div>
                            </div>
                            {weekExpanded ? <ChevronUp size={14} style={{ color: T.text3 }} /> : <ChevronDown size={14} style={{ color: T.text3 }} />}
                          </button>
                          {weekExpanded && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0 4px 12px' }}>
                              {week.days.map((day, idx) => {
                                const id = sessionId(phase.id, week.num, idx);
                                const isDone = !!sessionsData[id]?.completed;
                                const isCurrent = current && current.phaseId === phase.id && current.weekNum === week.num && current.dayIdx === idx;
                                const cat = CAT_COLORS[day.cat] || CAT_COLORS.gym;
                                const dayName = day.name || (day.blocks ? day.blocks.map(b => b.tag.replace(/^Sesi[óo]n \d+ \([AP]M\): /, '')).join(' + ') : day.day);
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => onSelect(phase.id, week.num, idx)}
                                    style={{
                                      background: isCurrent ? T.accentBg : T.bg2,
                                      border: `1px solid ${isCurrent ? T.accent : T.border}`,
                                      borderRadius: 8, padding: '10px 12px',
                                      display: 'flex', alignItems: 'center', gap: 10,
                                      cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
                                      width: '100%',
                                    }}
                                  >
                                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.c, flexShrink: 0 }} />
                                    <span style={{ fontSize: 12, fontWeight: 700, color: T.text2, minWidth: 28 }}>{day.day}</span>
                                    <span style={{
                                      flex: 1, minWidth: 0, fontSize: 13,
                                      color: isCurrent ? T.text : T.text2,
                                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                                    }}>{dayName}</span>
                                    {isDone && <Check size={13} style={{ color: T.accent }} strokeWidth={3} />}
                                    {isCurrent && <span style={{ fontSize: 9, fontWeight: 800, color: T.accent, letterSpacing: 0.5 }}>ACTUAL</span>}
                                    {day.dual && <span style={{ fontSize: 9, fontWeight: 800, color: T.warning }}>2X</span>}
                                  </button>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

const initialsFrom = (name) => {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

const HomeView = ({ sessionsData, wellness, onStartSession, onGoTab, onGoPhase, cursor, onChangeCursor }) => {
  const { phases: PLAN, planMeta, kind } = usePlan();
  const { profile } = useAuth();
  const displayName = profile?.full_name || profile?.username || 'Atleta';
  // Lo que toca HOY según el calendario del dispositivo (no según lo marcado).
  const next = useMemo(() => sessionForToday(PLAN, kind, cursor), [PLAN, kind, cursor]);
  const week = useMemo(() => weekOverview(PLAN, kind, cursor), [PLAN, kind, cursor]);
  const cursorCompleted = next ? !!sessionsData[next.id]?.completed : false;
  const todayScore = useMemo(() => {
    const d = wellness[today()];
    if (!d || !d.sleep || d.fatigue == null || d.soreness == null || !d.motivation) return null;
    return Math.round((d.sleep + (10 - d.fatigue) + (10 - d.soreness) + d.motivation) / 4 * 10) / 10;
  }, [wellness]);

  // Tiempo estimado y conteo de ejercicios del workout
  const sessionMeta = useMemo(() => {
    if (!next) return { exercises: 0, duration: '~55 min' };
    const d = next.day;
    if (d.blocks) {
      const liftBlocks = d.blocks.filter(b => b.type === 'lift');
      const exCount = liftBlocks.reduce((s, b) => s + (b.exercises?.length || 0), 0);
      return { exercises: exCount, duration: d.dual ? '~2 h' : '~75 min', dual: d.dual };
    }
    if (d.exercises) return { exercises: d.exercises.length, duration: '~55 min' };
    return { exercises: 0, duration: '~60 min' };
  }, [next]);

  const { text: greetText } = greeting();

  const sessionTitle = next ? (next.day.name || (next.day.blocks ? next.day.blocks.map(b => b.tag.replace(/^Sesi[óo]n \d+ \([AP]M\): /, '')).join(' + ') : next.day.day)) : '';

  return (
    <div style={{ paddingBottom: 100, background: LT.bg, minHeight: '100svh', fontFamily: FONT }}>
      {/* Header de perfil — paddingRight reserva espacio para el botón de cuenta fijo */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '24px 68px 14px 18px' }}>
        <div style={{
          width: 56, height: 56, borderRadius: '50%', overflow: 'hidden',
          background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`,
          display: 'flex', alignItems: 'center',
          justifyContent: 'center', fontWeight: 800, color: '#fff', fontSize: 18, flexShrink: 0,
          boxShadow: KP.shBtn,
        }}>
          {profile?.avatar_url
            ? <img src={profile.avatar_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : initialsFrom(displayName)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={eyebrow(KP.blue)}>{greetText}</div>
          <div style={{ fontSize: 'clamp(20px, 5.6vw, 24px)', fontWeight: 800, color: LT.text, lineHeight: 1.12, letterSpacing: -0.4, marginTop: 6, overflowWrap: 'anywhere' }}>{displayName}</div>
          {next && kind !== 'weekly' && (
            <div style={{ fontSize: 12.5, color: LT.text2, fontWeight: 600, marginTop: 5 }}>
              Fase {next.phase.num} · {next.phase.mode === 'microcycle' ? 'Microciclo' : `Semana ${next.week.num} de ${next.phase.weeks}`}
            </div>
          )}
        </div>
      </div>

      {next ? (
        <>
          {/* Row: CTA sesión + foto de fase */}
          <div style={{ display: 'flex', gap: 12, padding: '0 18px 12px' }}>
            {/* Card CTA azul */}
            <div onClick={() => onStartSession(next.phase, next.week, next.dayIdx)}
              className="kp-press"
              style={{
                flex: 1, background: `linear-gradient(150deg, ${LT.blue}, ${LT.blueDk})`,
                borderRadius: KP.rCard, padding: '20px 18px',
                display: 'flex', flexDirection: 'column', minHeight: 232, cursor: 'pointer',
                minWidth: 0, boxShadow: KP.shBtn,
              }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)' }}>
                  {cursorCompleted ? 'Completada' : 'Hoy te toca'}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.05, marginTop: 3, letterSpacing: -0.5 }}>
                  {sessionTitle}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.82)', marginTop: 8, lineHeight: 1.4 }}>
                  {kind === 'weekly' ? weekdayLabel(next.day.day) : next.phase.name}<br />
                  {sessionMeta.exercises ? `${sessionMeta.exercises} ejercicios · ` : ''}{sessionMeta.duration}
                  {sessionMeta.dual ? ' · 2 sesiones' : ''}
                </div>
              </div>
              <div style={{
                background: '#fff', borderRadius: 14, padding: '13px',
                fontSize: 14, fontWeight: 600, color: LT.blue, textAlign: 'center', marginTop: 10,
              }}>
                {cursorCompleted ? 'Ver detalle' : 'Empezar sesión'}
              </div>
              <div onClick={(e) => { e.stopPropagation(); onChangeCursor(); }}
                style={{
                  background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '13px',
                  fontSize: 14, fontWeight: 600, color: '#fff', textAlign: 'center', marginTop: 8,
                }}>
                Cambiar día
              </div>
            </div>

            {/* Card foto de fase */}
            <div onClick={() => onGoPhase(next.phase)}
              style={{
                flex: 1, borderRadius: 22, overflow: 'hidden', position: 'relative',
                background: '#000', minHeight: 232, cursor: 'pointer', minWidth: 0,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              }}>
              {(typeof PHASE_IMG !== 'undefined' && PHASE_IMG[next.phase.id]) && (
                <img src={PHASE_IMG[next.phase.id]} alt={next.phase.name}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.92 }} />
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.78) 100%)' }} />
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '16px 16px 0' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                  {kind === 'weekly' ? 'Tu rutina' : `Fase ${next.phase.num}`}
                </span>
              </div>
              <div style={{ position: 'relative', padding: '0 16px 16px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.05, marginBottom: 12 }}>
                  {kind === 'weekly' ? (planMeta?.title || 'Rutina semanal') : next.phase.name}
                </div>
                <div style={{ background: '#fff', borderRadius: 14, padding: '12px', fontSize: 13, fontWeight: 600, color: '#111', textAlign: 'center' }}>
                  {kind === 'weekly' ? 'Ver la semana' : 'Ver fase'}
                </div>
              </div>
            </div>
          </div>

          {/* Row: estado + progreso */}
          <div style={{ display: 'flex', gap: 12, padding: '0 18px 12px' }}>
            {/* Estado hoy */}
            <div onClick={() => onGoTab('wellness')}
              style={{ flex: 1, background: LT.surface, borderRadius: 22, padding: 20, cursor: 'pointer', minWidth: 0 }}>
              <div style={{ fontSize: 14, color: LT.text2 }}>Estado hoy</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: LT.text, marginTop: 2 }}>
                {todayScore === null ? 'Sin medir'
                  : todayScore >= 7 ? 'Listo'
                  : todayScore >= 5 ? 'Carga media'
                  : 'Recuperación'}
              </div>
              <div style={{ fontSize: 12, color: LT.text2, marginTop: 6, lineHeight: 1.4 }}>
                {todayScore === null ? 'Registra cómo te sientes' : 'Energía, sueño y fatiga'}
              </div>
              <div style={{ background: LT.surface2, borderRadius: 14, padding: '12px', fontSize: 13, fontWeight: 600, color: LT.text2, textAlign: 'center', marginTop: 14 }}>
                {todayScore === null ? 'Registrar bienestar' : 'Ver detalle'}
              </div>
            </div>

            {/* Tu semana: qué días entrenas, cuál es hoy y qué sigue */}
            <div style={{ flex: 1, background: LT.surface, borderRadius: 22, padding: 20, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: LT.text2 }}>Tu semana</div>
              <div style={{ fontSize: 13, color: LT.text, marginTop: 6 }}>
                {week.trainingDays} {week.trainingDays === 1 ? 'día' : 'días'} de entrenamiento
              </div>
              <div style={{ display: 'flex', gap: 4, marginTop: 14, flexWrap: 'wrap' }}>
                {week.days.map((d) => (
                  <div
                    key={d.key}
                    title={d.name || 'Descanso'}
                    style={{
                      flex: '1 1 0', minWidth: 26, textAlign: 'center', borderRadius: 8,
                      padding: '7px 2px', fontSize: 10.5, fontWeight: 800,
                      background: d.isToday ? LT.blue : d.hasSession ? LT.blueSoft : LT.surface2,
                      color: d.isToday ? '#fff' : d.hasSession ? LT.blue : LT.text3,
                      border: d.isToday ? 'none' : `1px solid ${d.hasSession ? 'transparent' : LT.border}`,
                    }}
                  >
                    {d.key[0]}
                  </div>
                ))}
              </div>
              <div style={{ fontSize: 11, color: LT.text3, marginTop: 10, lineHeight: 1.4 }}>
                {week.next
                  ? `Siguiente: ${weekdayLabel(week.next.key)}${week.next.name ? ` · ${week.next.name}` : ''}`
                  : 'Sin entrenamientos esta semana'}
              </div>
            </div>
          </div>

          {/* Info del plan */}
          <div style={{ padding: '0 18px 20px' }}>
            <div onClick={() => onGoTab('plan')}
              style={{ background: LT.surface, borderRadius: 22, padding: 18, display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer' }}>
              <div style={{
                width: 52, height: 52, borderRadius: '50%', background: LT.blueSoft,
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                fontSize: 11, fontWeight: 800, color: LT.blue, textAlign: 'center', lineHeight: 1.1,
              }}><Dumbbell size={22} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 700, color: LT.text }}>{planMeta?.title || 'Mi plan'}</div>
                <div style={{ fontSize: 12, color: LT.text2, marginTop: 1 }}>
                  {kind === 'weekly'
                    ? `Rutina semanal · ${week.trainingDays} ${week.trainingDays === 1 ? 'día' : 'días'}`
                    : `${PLAN.length} ${PLAN.length === 1 ? 'fase' : 'fases'} · ${PLAN.reduce((s, p) => s + (p.weekData?.length || 0), 0)} semanas`}
                </div>
              </div>
              <ChevronRight size={18} style={{ color: LT.text3, flexShrink: 0 }} />
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: '0 18px' }}>
          <div style={{ background: LT.surface, borderRadius: 22, padding: 24 }}>
            <div style={{ fontSize: 22, fontWeight: 700, color: LT.text, lineHeight: 1.2 }}>
              No tienes rutina asignada para este día
            </div>
            <div style={{ marginTop: 8, fontSize: 14, color: LT.text2, lineHeight: 1.5 }}>
              {week.next
                ? `Tu siguiente entrenamiento es el ${weekdayLabel(week.next.key)}${week.next.name ? ` · ${week.next.name}` : ''}.`
                : 'Aún no hay entrenamientos en tu semana.'}
            </div>

            {/* Vista de la semana, para ubicarse */}
            <div style={{ display: 'flex', gap: 4, marginTop: 18, flexWrap: 'wrap' }}>
              {week.days.map((d) => (
                <div
                  key={d.key}
                  title={d.name || 'Descanso'}
                  style={{
                    flex: '1 1 0', minWidth: 30, textAlign: 'center', borderRadius: 8,
                    padding: '9px 2px', fontSize: 11, fontWeight: 800,
                    background: d.isToday ? LT.blue : d.hasSession ? LT.blueSoft : LT.surface2,
                    color: d.isToday ? '#fff' : d.hasSession ? LT.blue : LT.text3,
                    border: d.isToday ? 'none' : `1px solid ${d.hasSession ? 'transparent' : LT.border}`,
                  }}
                >
                  {d.key}
                </div>
              ))}
            </div>

            <div
              onClick={() => onGoTab('plan')}
              className="kp-press"
              style={{
                background: LT.blue, borderRadius: 14, padding: '13px', marginTop: 18,
                fontSize: 14, fontWeight: 600, color: '#fff', textAlign: 'center', cursor: 'pointer',
              }}
            >
              Ver mi plan
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const Slider = ({ label, hint, value, onChange, max = 10, color = T.accent }) => (
  <div style={{ marginBottom: 16 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 6 }}>
      <div>
        <div style={{ fontSize: 14, color: T.text, fontWeight: 500 }}>{label}</div>
        {hint && <div style={{ fontSize: 11, color: T.text3, marginTop: 1 }}>{hint}</div>}
      </div>
      <span style={{ fontSize: 18, fontWeight: 800, color, ...NUM_STYLE }}>{value || 0}</span>
    </div>
    <input type="range" min="0" max={max} value={value || 0}
      onChange={e => onChange(parseInt(e.target.value))}
      style={{ width: '100%', accentColor: color, cursor: 'pointer' }}
    />
  </div>
);

const WellnessView = ({ wellness, setWellness }) => {
  const [date, setDate] = useState(today());
  const dayData = wellness[date] || {};
  const updateDay = (field, value) => setWellness(prev => ({ ...prev, [date]: { ...prev[date], [field]: value } }));

  const chartData = useMemo(() => {
    const dates = Object.keys(wellness).sort().slice(-14);
    return dates.map(d => ({
      date: d.slice(5),
      hrv: wellness[d].hrv || null,
      bienestar: wellness[d].sleep && wellness[d].fatigue != null && wellness[d].soreness != null && wellness[d].motivation
        ? Math.round((wellness[d].sleep + (10 - wellness[d].fatigue) + (10 - wellness[d].soreness) + wellness[d].motivation) / 4 * 10) / 10
        : null,
    }));
  }, [wellness]);

  const todayScore = useMemo(() => {
    const d = wellness[today()];
    if (!d || !d.sleep || d.fatigue == null || d.soreness == null || !d.motivation) return null;
    return Math.round((d.sleep + (10 - d.fatigue) + (10 - d.soreness) + d.motivation) / 4 * 10) / 10;
  }, [wellness]);

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: '20px 20px 24px' }}>
        <Caption color={T.text3} style={{ marginBottom: 6 }}>Bienestar diario</Caption>
        {todayScore !== null ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <ReadinessRing score={todayScore} size={110} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 17, fontWeight: 700, color: T.text, marginBottom: 4, lineHeight: 1.25 }}>
                {todayScore >= 7 ? 'Listo para entrenar' : todayScore >= 5 ? 'Considera reducir carga' : 'Recuperación prioridad'}
              </div>
              <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.5 }}>Puntaje compuesto de tus 4 indicadores diarios.</div>
            </div>
          </div>
        ) : (
          <>
            <h1 style={{ fontSize: 32, fontWeight: 800, color: T.text, margin: 0, lineHeight: 1.05, letterSpacing: -0.8 }}>¿Cómo estás hoy?</h1>
            <div style={{ marginTop: 8, fontSize: 14, color: T.text2 }}>Completa los 4 indicadores abajo para ver tu puntaje.</div>
          </>
        )}
      </div>

      <div style={{ padding: '0 20px' }}>
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <Calendar size={14} style={{ color: T.text3 }} />
            <input type="date" value={date} onChange={e => setDate(e.target.value)}
              style={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, color: T.text, padding: '6px 10px', fontFamily: FONT, fontSize: 13, outline: 'none' }} />
          </div>

          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: 14, color: T.text, marginBottom: 4, fontWeight: 500 }}>Variabilidad cardiaca</div>
            <div style={{ fontSize: 11, color: T.text3, marginBottom: 8 }}>Medida con app (HRV4Training, Elite HRV, Whoop, Oura). En milisegundos.</div>
            <Input value={dayData.hrv ?? ''} onChange={v => updateDay('hrv', v ? parseFloat(v) : null)} placeholder="—" type="number" suffix="ms" />
          </div>

          <div>
            <div style={{ fontSize: 14, color: T.text, marginBottom: 4, fontWeight: 500 }}>Pulso en reposo</div>
            <div style={{ fontSize: 11, color: T.text3, marginBottom: 8 }}>Medido en ayunas al despertar. En pulsaciones por minuto.</div>
            <Input value={dayData.rhr ?? ''} onChange={v => updateDay('rhr', v ? parseFloat(v) : null)} placeholder="—" type="number" suffix="bpm" />
          </div>
        </Card>

        <Card style={{ marginBottom: 14 }}>
          <Caption style={{ marginBottom: 14 }}>4 indicadores · escala 0 a 10</Caption>
          <Slider label="Sueño" hint="¿Qué tan bien dormiste anoche? 0 mal · 10 excelente"
            value={dayData.sleep} onChange={v => updateDay('sleep', v)} color={T.info} />
          <Slider label="Fatiga" hint="0 sin fatiga · 10 exhausto"
            value={dayData.fatigue} onChange={v => updateDay('fatigue', v)} color={T.warning} />
          <Slider label="Dolor o molestias" hint="0 sin nada · 10 dolor importante"
            value={dayData.soreness} onChange={v => updateDay('soreness', v)} color={T.danger} />
          <Slider label="Motivación" hint="0 ninguna · 10 listo para todo"
            value={dayData.motivation} onChange={v => updateDay('motivation', v)} color={T.accent} />
        </Card>

        {chartData.length >= 2 && (
          <Card style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <TrendingUp size={14} style={{ color: T.text3 }} />
              <Caption>Tendencia · últimos 14 días</Caption>
            </div>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData}>
                <XAxis dataKey="date" tick={{ fill: T.text3, fontSize: 10 }} axisLine={{ stroke: T.border }} tickLine={{ stroke: T.border }} />
                <YAxis tick={{ fill: T.text3, fontSize: 10 }} axisLine={{ stroke: T.border }} tickLine={{ stroke: T.border }} />
                <Tooltip contentStyle={{ background: T.bg3, border: `1px solid ${T.border}`, borderRadius: 8, fontSize: 12 }} />
                <ReferenceLine y={7} stroke={T.accent} strokeDasharray="3 3" strokeOpacity={0.3} />
                <Line type="monotone" dataKey="bienestar" stroke={T.accent} strokeWidth={2.5} dot={{ fill: T.accent, r: 3 }} name="Bienestar" />
                <Line type="monotone" dataKey="hrv" stroke={T.info} strokeWidth={2} dot={{ fill: T.info, r: 3 }} name="Variabilidad cardiaca" />
              </LineChart>
            </ResponsiveContainer>
          </Card>
        )}

        <Collapsible title="Cómo usar estos datos" icon={Info}>
          <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.7, paddingTop: 4 }}>
            <p style={{ marginTop: 0 }}><strong style={{ color: T.text }}>Avance entre fases:</strong> puntaje mayor a 7 sostenido 3-5 días, variabilidad cardiaca en línea base, pulso en reposo estable, sin molestia residual.</p>
            <p><strong style={{ color: T.text }}>Variabilidad cardiaca:</strong> Plews et al. 2013, 2014. La métrica más sensible al estado del sistema nervioso.</p>
            <p><strong style={{ color: T.text }}>Los 4 indicadores:</strong> McLean et al. 2010. Validado para monitoreo de atletas.</p>
            <p style={{ marginBottom: 0 }}><strong style={{ color: T.text }}>Bajada sostenida:</strong> si tu puntaje cae 2-3 días seguidos, reduce carga o salta la sesión.</p>
          </div>
        </Collapsible>
      </div>
    </div>
  );
};

const ONE_RM_LIFTS = [
  { key: 'back_squat', name: 'Back Squat' },
  { key: 'front_squat', name: 'Front Squat' },
  { key: 'bench_press', name: 'Bench Press' },
  { key: 'incline_bench', name: 'Incline Bench Press' },
  { key: 'trap_bar_dl', name: 'Trap Bar Deadlift' },
  { key: 'deadlift', name: 'Deadlift / RDL' },
  { key: 'overhead_press', name: 'Overhead Press' },
  { key: 'row', name: 'Barbell Row' },
  { key: 'hang_clean', name: 'Hang Clean' },
];

const OneRMView = ({ oneRMs, setOneRMs }) => {
  const { profile } = useAuth();
  const unidad = profile?.unidad_peso || 'kg';
  const u = etiquetaUnidad(unidad);
  const [calc, setCalc] = useState({ weight: '', reps: '' });
  // La calculadora no necesita convertir: entra un peso y sale un 1RM en esa
  // misma unidad. Solo cambia la etiqueta. Los 1RM GUARDADOS sí se convierten,
  // porque de ellos salen los pesos recomendados de todo el plan.
  const result = useMemo(() => calc1RM(calc.weight, calc.reps), [calc]);

  return (
    <div style={{ paddingBottom: 100 }}>
      <div style={{ padding: '20px 20px 24px' }}>
        <Caption color={T.text3} style={{ marginBottom: 6 }}>Tus máximos</Caption>
        <h1 style={{ fontSize: 36, fontWeight: 800, color: T.text, margin: 0, lineHeight: 1.05, letterSpacing: -1 }}>1RM</h1>
        <div style={{ marginTop: 8, fontSize: 14, color: T.text2 }}>El plan usa estos para calcular las cargas. Recalibra al inicio de cada fase.</div>
      </div>

      <div style={{ padding: '0 20px' }}>
        <Card style={{ marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <Calculator size={14} style={{ color: T.accent }} />
            <Caption color={T.text2}>Calculadora</Caption>
          </div>
          <div style={{ fontSize: 12, color: T.text3, marginBottom: 14, lineHeight: 1.5 }}>
            Peso usado y repeticiones cerca del fallo. Te da el 1RM estimado.
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 14 }}>
            <Input value={calc.weight} onChange={v => setCalc(c => ({ ...c, weight: v }))} placeholder="Peso" type="number" suffix={u} />
            <Input value={calc.reps} onChange={v => setCalc(c => ({ ...c, reps: v }))} placeholder="Reps" type="number" suffix="reps" />
          </div>
          {result && (
            <div style={{ padding: 18, background: T.accentBg, borderRadius: 14, border: `1px solid rgba(30, 64, 224, 0.15)` }}>
              <Caption color={T.accentDk} style={{ marginBottom: 4 }}>1RM estimado</Caption>
              <div style={{ fontSize: 44, fontWeight: 800, color: T.accent, lineHeight: 1, letterSpacing: -1, ...NUM_STYLE }}>
                {result.avg}<span style={{ fontSize: 16, color: T.accentDk, fontWeight: 500 }}> {u}</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: T.text3, ...NUM_STYLE }}>
                Brzycki {result.brzycki} {u} · Epley {result.epley} {u}
              </div>
            </div>
          )}
        </Card>

        <Caption style={{ marginBottom: 12, marginTop: 24 }}>Tus 1RM guardados</Caption>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ONE_RM_LIFTS.map(lift => (
            <div key={lift.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: T.bg2, borderRadius: 10, border: `1px solid ${T.border}` }}>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.text }}>{lift.name}</div>
              <Input value={oneRMs[lift.key] == null ? '' : desdeKilos(oneRMs[lift.key], unidad)}
                onChange={v => setOneRMs(prev => ({ ...prev, [lift.key]: v ? aKilos(v, unidad) : null }))}
                placeholder="—" type="number" suffix={u}
                style={{ width: 110, textAlign: 'right', padding: '8px 14px', fontSize: 14 }} />
            </div>
          ))}
        </div>

        <div style={{ marginTop: 20, padding: 14, background: T.bg2, borderRadius: 10, border: `1px solid ${T.border}`, fontSize: 12, color: T.text2, lineHeight: 1.6 }}>
          <strong style={{ color: T.text }}>Recalibra al inicio de cada fase.</strong> Si tu fuerza subió en F3, reevalúa antes de F4. Para tests, usa submáximo (3-5 reps cerca del fallo) y deja que la fórmula lo estime.
        </div>
      </div>
    </div>
  );
};

const ScienceView = () => (
  <div style={{ paddingBottom: 100 }}>
    <div style={{ padding: '20px 20px 24px' }}>
      <Caption color={T.text3} style={{ marginBottom: 6 }}>El porqué del plan</Caption>
      <h1 style={{ fontSize: 36, fontWeight: 800, color: T.text, margin: 0, lineHeight: 1.05, letterSpacing: -1 }}>Marco científico</h1>
    </div>

    <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <Collapsible title="Periodización por bloques" icon={Sparkles} defaultOpen>
        <div style={{ paddingTop: 4, fontSize: 13.5, color: T.text2, lineHeight: 1.7 }}>
          <p style={{ marginTop: 0 }}>Modelo de Vladimir Issurin (2008, 2010). Cada bloque concentra el estímulo en una capacidad dominante.</p>
          <p style={{ marginBottom: 0 }}>Adaptaciones distintas se activan por vías moleculares distintas (mTOR para hipertrofia, AMPK para aeróbicas). Cuando intentas activar varias vías con alto volumen simultáneo, se inhiben mutuamente (Atherton et al. 2005).</p>
        </div>
      </Collapsible>

      <Collapsible title="Residuales entrenables" icon={Clock}>
        <div style={{ paddingTop: 4 }}>
          <div style={{ fontSize: 13.5, color: T.text2, lineHeight: 1.7, marginBottom: 14 }}>
            Cada capacidad tiene un tiempo antes de degradarse sin estímulo.
          </div>
          {[
            ['Velocidad y potencia', '~5 días', 'Exposición frecuente todo el año.'],
            ['Fuerza máxima', '~30 días', '1 sesión semanal alta intensidad.'],
            ['Aeróbica', '~30 días', '1 tempo por semana.'],
            ['Movilidad', '~15 días', 'Diaria es el estándar.'],
            ['Hipertrofia', '~30-60 días', '~1/3 del volumen del bloque.'],
          ].map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 12, padding: '10px 0', borderTop: i > 0 ? `1px solid ${T.border}` : 'none' }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.text, marginBottom: 2 }}>{r[0]}</div>
                <div style={{ fontSize: 12, color: T.text3 }}>{r[2]}</div>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: T.accent, alignSelf: 'flex-start', ...NUM_STYLE }}>{r[1]}</div>
            </div>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Dobles sesiones" icon={Zap}>
        <div style={{ paddingTop: 4, fontSize: 13.5, color: T.text2, lineHeight: 1.7 }}>
          <p style={{ marginTop: 0 }}>Separación AM/PM mínima de 6 horas reduce la interferencia molecular entre fuerza y resistencia (Wilson et al. 2012).</p>
          <p style={{ marginBottom: 0 }}>En este plan se usan 3 dobles fijas (L/J/V) en F4 y F5 en lugar de 4 por consistencia operativa.</p>
        </div>
      </Collapsible>

      <Collapsible title="Orden de las fases" icon={Trophy}>
        <div style={{ paddingTop: 4, fontSize: 13.5, color: T.text2, lineHeight: 1.7 }}>
          <p style={{ marginTop: 0 }}>La secuencia hipertrofia → fuerza → potencia → velocidad sigue una cadena de causalidad:</p>
          <ul style={{ paddingLeft: 16 }}>
            <li>Más músculo da más potencial de fuerza.</li>
            <li>Más fuerza da más techo de potencia (Cormie et al. 2010).</li>
            <li>Más potencia da más techo de velocidad (Suchomel et al. 2016).</li>
            <li>La velocidad expresa todo lo anterior en patrones específicos del deporte.</li>
          </ul>
        </div>
      </Collapsible>

      <Collapsible title="Nutrición por fase" icon={Target}>
        <div style={{ paddingTop: 4 }}>
          {[
            ['F1-F2', 'Mantenimiento', '1.8-2.0 g/kg', '4-5 g/kg CHO'],
            ['F3', '+300-500 kcal', '2.0-2.2 g/kg', '5-6 g/kg CHO'],
            ['F4', 'Mant. o +100-200', '1.8-2.0 g/kg', '5-6 g/kg CHO'],
            ['F5', 'Mant. o +100', '2.0-2.2 g/kg', '6-7 g/kg CHO'],
            ['F6', 'Mantenimiento', '1.8-2.0 g/kg', '5-6 g/kg CHO'],
            ['F7-F8', 'Mant. + game day', '1.8-2.0 g/kg', '6-8 g/kg juego'],
          ].map((r, i) => (
            <div key={i} style={{ padding: '10px 0', borderTop: i > 0 ? `1px solid ${T.border}` : 'none' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: T.text, ...NUM_STYLE }}>{r[0]}</span>
                <span style={{ fontSize: 12, color: T.text2 }}>{r[1]}</span>
              </div>
              <div style={{ fontSize: 11, color: T.text3 }}>Proteína: {r[2]} · CHO: {r[3]}</div>
            </div>
          ))}
        </div>
      </Collapsible>

      <Collapsible title="Protocolo de tobillo derecho" icon={Activity}>
        <div style={{ paddingTop: 4, fontSize: 13.5, color: T.text2, lineHeight: 1.7 }}>
          <p style={{ marginTop: 0 }}>Trabajo diario todo el año, no solo en F1.</p>
          <Caption style={{ marginTop: 14, marginBottom: 6 }}>Evaluación · cada 4-6 sem con fisio</Caption>
          <ul style={{ paddingLeft: 16, marginTop: 0 }}>
            <li>Y-Balance Test bilateral</li>
            <li>Fuerza eversión/inversión/dorsiflexión con dinamómetro</li>
            <li>Knee-to-wall test</li>
          </ul>
          <Caption style={{ marginTop: 14, marginBottom: 6 }}>Trabajo diario · 15-20 min</Caption>
          <ul style={{ paddingLeft: 16, marginTop: 0 }}>
            <li>Movilidad: knee-to-wall progresivo 3x10, círculos activos</li>
            <li>Fuerza: peroneales, tibial anterior, gemelos con bandas 3x15</li>
            <li>Propiocepción: balance unilateral 3x30 seg ojos cerrados</li>
            <li>Calf raises: 3x15 de pie + 3x15 sentado</li>
          </ul>
        </div>
      </Collapsible>

      <Collapsible title="Referencias completas" icon={FileText}>
        <div style={{ paddingTop: 4, fontSize: 12, color: T.text2, lineHeight: 1.7 }}>
          {[
            'Atherton, P. J., et al. (2005). FASEB Journal.',
            'Bickel, C. S., Cross, J. M., & Bamman, M. M. (2011). MSSE.',
            'Bohm, S., Mersmann, F., & Arampatzis, A. (2015). Frontiers in Physiology.',
            'Bosquet, L., et al. (2007). MSSE.',
            'Cometti, G. (French Contrast Method).',
            'Cormie, P., McGuigan, M. R., & Newton, R. U. (2010). Sports Medicine.',
            'Dupuy, O., et al. (2018). Frontiers in Physiology.',
            'Faude, O., Kellmann, M., et al. (2014). J Sports Sci Med.',
            'Halson, S. L. (2014). Sports Medicine.',
            'Hertel, J., & Corbett, R. O. (2019). J Athletic Training.',
            'Issurin, V. B. (2008, 2010). Block Periodization.',
            'McLean, B. D., et al. (2010). IJSPP.',
            'Meeusen, R., et al. (2013). MSSE.',
            'Morton, R. W., et al. (2018). BJSM.',
            'Mujika, I., & Padilla, S. (2003). MSSE.',
            'Plews, D. J., et al. (2013, 2014). Eur J Appl Physiol.',
            'Rhea, M. R., et al. (2003). MSSE.',
            'Schoenfeld, B. J., et al. (2016). Sports Medicine.',
            'Suchomel, T. J., et al. (2016). Sports Medicine.',
            'Wilson, J. M., et al. (2012). JSCR.',
          ].map((ref, i) => <div key={i} style={{ padding: '4px 0' }}>{ref}</div>)}
        </div>
      </Collapsible>
    </div>
  </div>
);

/**
 * Navegacion del atleta.
 *
 * En el telefono va pegada abajo de pared a pared: es donde llega el pulgar.
 *
 * En la computadora esa misma franja se estiraba a 1430px con cinco botoncitos
 * perdidos en el centro, y el cursor no tiene el problema del pulgar. Ahi se
 * convierte en una barra flotante centrada, del ancho de su contenido.
 */
const BottomNav = ({ active, onChange }) => {
  const esCompu = useIsDesktop();
  const items = [
    { id: 'home', label: 'Hoy', icon: HomeIcon },
    { id: 'plan', label: 'Plan', icon: Layers },
    { id: 'wellness', label: 'Bienestar', icon: Heart },
    { id: 'oneRM', label: '1RM', icon: Calculator },
    { id: 'science', label: 'Ciencia', icon: BookOpen },
  ];
  return (
    <div style={{
      position: 'fixed', zIndex: 100,
      background: 'rgba(255, 255, 255, 0.92)', backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      display: 'flex',
      ...(esCompu ? {
        bottom: 22, left: '50%', transform: 'translateX(-50%)',
        border: `1px solid ${KP.line}`, borderRadius: 999,
        padding: '8px 10px', gap: 4, boxShadow: KP.shPop,
      } : {
        bottom: 0, left: 0, right: 0,
        borderTop: `1px solid ${KP.line}`,
        padding: '8px 4px max(10px, env(safe-area-inset-bottom))',
        justifyContent: 'space-around',
      }),
    }}>
      {items.map(item => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button key={item.id} onClick={() => onChange(item.id)} className="kp-press" style={{
            background: 'transparent', border: 'none', cursor: 'pointer',
            padding: '4px 8px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
            color: isActive ? T.accent : T.text3, fontFamily: FONT,
            transition: 'color 0.15s', minWidth: 56,
          }}>
            <span style={{
              display: 'grid', placeItems: 'center', width: 44, height: 30, borderRadius: 999,
              background: isActive ? KP.blueSoft : 'transparent', transition: 'background 0.18s',
            }}>
              <Icon size={20} strokeWidth={isActive ? 2.5 : 1.9} />
            </span>
            <span style={{ fontSize: 10.5, fontWeight: isActive ? 700 : 600, letterSpacing: 0.3 }}>{item.label}</span>
          </button>
        );
      })}
    </div>
  );
};

// Cargando el plan: skeleton dentro del mismo shell
const PlanLoadingState = () => (
  <div style={{ padding: '28px 20px 120px', maxWidth: 560, margin: '0 auto' }}>
    {[0, 1, 2].map((i) => (
      <div key={i} style={{
        background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 18,
        padding: 18, marginBottom: 14,
      }}>
        <div className="kp-skeleton" style={{ width: '45%', height: 16, marginBottom: 12, borderRadius: 6 }} />
        <div className="kp-skeleton" style={{ width: '80%', height: 12, marginBottom: 8, borderRadius: 6 }} />
        <div className="kp-skeleton" style={{ width: '60%', height: 12, borderRadius: 6 }} />
      </div>
    ))}
  </div>
);

// Sin plan asignado: misma interfaz, mensaje claro; wellness y 1RM siguen disponibles
const NoPlanState = ({ onGoTab }) => (
  <div style={{ padding: '48px 20px 120px', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
    <div style={{
      width: 76, height: 76, borderRadius: 24, background: T.accentBg, color: T.accent,
      display: 'grid', placeItems: 'center', margin: '0 auto 20px',
    }}>
      <Calendar size={34} />
    </div>
    <div style={{ fontSize: 21, fontWeight: 800, color: T.text, letterSpacing: -0.3 }}>
      Tu plan está en camino
    </div>
    <div style={{ fontSize: 14.5, color: T.text2, marginTop: 10, lineHeight: 1.6, maxWidth: 340, marginInline: 'auto' }}>
      Tu entrenador está preparando tu programa. En cuanto te lo asigne aparecerá aquí,
      con tus fases, semanas y sesiones listas para entrenar.
    </div>
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 26, flexWrap: 'wrap' }}>
      <button type="button" onClick={() => onGoTab('wellness')} className="kp-press"
        style={{
          padding: '12px 18px', borderRadius: 13, border: `1.5px solid ${T.border}`, cursor: 'pointer',
          background: T.bg2, fontFamily: FONT, fontSize: 14, fontWeight: 700, color: T.text,
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
        <Heart size={16} color={T.accent} /> Registrar bienestar
      </button>
      <button type="button" onClick={() => onGoTab('oneRM')} className="kp-press"
        style={{
          padding: '12px 18px', borderRadius: 13, border: `1.5px solid ${T.border}`, cursor: 'pointer',
          background: T.bg2, fontFamily: FONT, fontSize: 14, fontWeight: 700, color: T.text,
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
        <Calculator size={16} color={T.accent} /> Calcular 1RM
      </button>
    </div>
  </div>
);

export default function TrainingApp() {
  const { phases: PLAN, hasPlan, planLoading } = usePlan();
  const esCompu = useIsDesktop();
  const [tab, setTab] = useState('home');
  const [view, setView] = useState({ level: 'plan' });
  const [sessionsData, setSessionsData] = useStorage('wr:sessions', {});
  const [oneRMs, setOneRMs] = useStorage('wr:onerm', {});
  const [wellness, setWellness] = useStorage('wr:wellness', {});
  const [storedCursor, setCursor] = useStorage('wr:cursor', null);
  const [cursorPickerOpen, setCursorPickerOpen] = useState(false);

  // Cursor efectivo: el guardado si sigue siendo válido para este plan; si no, el primer día
  const cursor = useMemo(
    () => (isValidCursor(PLAN, storedCursor) ? storedCursor : defaultCursor(PLAN)),
    [PLAN, storedCursor],
  );

  const cursorSession = useMemo(() => resolveCursor(PLAN, cursor), [PLAN, cursor]);
  const activeSessionId = cursorSession?.id;
  const activeWeekKey = cursorSession ? `${cursorSession.phase.id}-w${cursorSession.week.num}` : null;
  const activePhaseId = cursorSession?.phase.id;

  // El marcado es opcional y NO mueve el puntero: qué se muestra lo decide el
  // calendario. (Antes, reabrir una sesión completada y editar un peso saltaba
  // de día, porque esta misma función se usa para guardar pesos.)
  const updateSession = useCallback((id, updater) => {
    setSessionsData(prev => ({
      ...prev,
      [id]: typeof updater === 'function' ? updater(prev[id] || {}) : updater,
    }));
  }, [setSessionsData]);

  // Cambiar cursor manualmente desde el selector
  const handleSelectCursor = useCallback((phaseId, weekNum, dayIdx) => {
    setCursor({ phaseId, weekNum, dayIdx });
    setCursorPickerOpen(false);
  }, [setCursor]);

  const goToPlan = () => { setView({ level: 'plan' }); setTab('plan'); };
  // From Home or anywhere: jump directly to the week view (selected day handled internally)
  // No recibe el día a propósito: la vista de semana ya resalta el que toca.
  const startSession = (phase, week) => {
    setTab('plan');
    setView({ level: 'week', phase, week });
  };
  const goToPhase = (phase) => { setTab('plan'); setView({ level: 'phase', phase }); };
  const jumpToPhase = (phase) => { setTab('plan'); setView({ level: 'phase', phase }); };

  // Timeline visible on Plan tab, internal views
  const showTimeline = tab === 'plan' && (view.level === 'phase' || view.level === 'week');

  let content;
  if (planLoading && (tab === 'home' || tab === 'plan')) {
    content = <PlanLoadingState />;
  } else if (!hasPlan && (tab === 'home' || tab === 'plan')) {
    content = <NoPlanState onGoTab={t => setTab(t)} />;
  } else if (tab === 'home') {
    content = <HomeView sessionsData={sessionsData} wellness={wellness}
      onStartSession={startSession}
      onGoTab={t => setTab(t)}
      onGoPhase={goToPhase}
      cursor={cursor}
      onChangeCursor={() => setCursorPickerOpen(true)} />;
  } else if (tab === 'plan') {
    if (view.level === 'plan') {
      content = <PlanOverview onSelectPhase={p => setView({ level: 'phase', phase: p })}
        sessionsData={sessionsData} activePhaseId={activePhaseId} />;
    } else if (view.level === 'phase') {
      content = <PhaseDetail phase={view.phase} onBack={goToPlan}
        onSelectWeek={w => setView({ level: 'week', phase: view.phase, week: w })}
        sessionsData={sessionsData} activeWeekKey={activeWeekKey} />;
    } else if (view.level === 'week') {
      content = <WeekDetail phase={view.phase} week={view.week}
        onBack={() => setView({ level: 'phase', phase: view.phase })}
        sessionsData={sessionsData} updateSession={updateSession} oneRMs={oneRMs}
        activeSessionId={activeSessionId} />;
    }
  } else if (tab === 'wellness') {
    content = <WellnessView wellness={wellness} setWellness={setWellness} />;
  } else if (tab === 'oneRM') {
    content = <OneRMView oneRMs={oneRMs} setOneRMs={setOneRMs} />;
  } else if (tab === 'science') {
    content = <ScienceView />;
  }

  return (
    <div style={{
      minHeight: '100svh', background: T.bg, color: T.text,
      fontFamily: FONT,
      WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale',
    }}>
      {showTimeline && <PhaseTimeline activePhaseId={view.phase?.id || activePhaseId}
        sessionsData={sessionsData} onJumpToPhase={jumpToPhase} />}
      {/* En compu el contenido se centra y deja de estirarse hasta 1272px. Una
          tarjeta de ese ancho obliga a barrer la pantalla con los ojos de una
          orilla a la otra para leer una linea. 980 es ancho de lectura. */}
      <div style={esCompu ? { maxWidth: 980, margin: '0 auto', width: '100%' } : undefined}>
        {content}
      </div>
      <BottomNav active={tab} onChange={t => { setTab(t); if (t === 'plan') setView({ level: 'plan' }); }} />
      {cursorPickerOpen && (
        <CursorSelector current={cursor} sessionsData={sessionsData}
          onSelect={handleSelectCursor} onClose={() => setCursorPickerOpen(false)} />
      )}
    </div>
  );
}
