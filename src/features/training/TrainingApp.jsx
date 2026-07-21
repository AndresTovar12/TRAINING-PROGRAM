import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, ChevronUp, ArrowLeft, Calendar,
  Check, X, Calculator, BookOpen, AlertCircle, TrendingUp, Edit3, Target,
  Zap, Trophy, Clock, FileText, Sparkles, Info, Dumbbell, Heart, Play,
  CheckCircle2, ChevronLeft, Activity, Sunrise, Sun, Moon, Home as HomeIcon,
  Repeat, Eye, Layers, List, Scale
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine, PieChart, Pie, Cell } from 'recharts';
import { T, FONT, NUM_STYLE, LT, CAT_COLORS, KP, eyebrow } from '@/lib/theme';
import { PHASE_IMG } from '@/data/training-data';
import { usePlan } from '@/contexts/PlanContext';
import { useAuth } from '@/contexts/AuthContext';
import {
  sessionId, calc1RM, today, greeting, isLoadedExercise,
  resolveCursor, advanceCursor, defaultCursor, isValidCursor, findPreviousWeight,
  totalProgress, getWeekLoad, formatIntensity, inferRest, getPattern, getMuscles
} from '@/lib/training-utils';
import { useStorage } from '@/contexts/AppStateContext';
import ExerciseMediaModal from '@/features/training/ExerciseMediaModal';

const Caption = ({ children, color = T.text3, style }) => (
  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 1.4, color, ...style }}>{children}</div>
);
const CatDot = ({ cat, size = 6 }) => {
  const c = CAT_COLORS[cat] || CAT_COLORS.gym;
  return <span style={{ display: 'inline-block', width: size, height: size, borderRadius: '50%', background: c.c, flexShrink: 0 }} />;
};
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
const Button = ({ children, onClick, variant = 'primary', size = 'md', icon: Icon, disabled, style }) => {
  const sizes = {
    sm: { fontSize: 12, padding: '7px 12px' },
    md: { fontSize: 14, padding: '11px 18px' },
    lg: { fontSize: 15, padding: '15px 22px' },
  };
  const variants = {
    primary: { background: T.accent, color: '#FFFFFF', border: 'none', boxShadow: disabled ? 'none' : KP.shBtn },
    secondary: { background: T.bg3, color: T.text, border: `1px solid ${KP.line}` },
    ghost: { background: 'transparent', color: T.text2, border: 'none' },
  };
  return (
    <button onClick={disabled ? undefined : onClick} disabled={disabled}
      className={disabled ? undefined : 'kp-press'}
      style={{
        borderRadius: KP.rBtn, cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: FONT, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        transition: 'opacity 0.15s, box-shadow 0.18s', opacity: disabled ? 0.4 : 1,
        ...sizes[size], ...variants[variant], ...style,
      }}>
      {Icon && <Icon size={size === 'sm' ? 12 : size === 'lg' ? 18 : 16} strokeWidth={2.5} />}
      {children}
    </button>
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
const StickyCTA = ({ children }) => (
  <div style={{
    position: 'fixed', bottom: 'calc(72px + env(safe-area-inset-bottom, 0px))', left: 0, right: 0,
    padding: '12px 16px', background: `linear-gradient(180deg, transparent 0%, ${T.bg} 35%)`,
    zIndex: 50, pointerEvents: 'none',
  }}>
    <div style={{ pointerEvents: 'auto' }}>{children}</div>
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

const WeekScience = ({ science }) => {
  if (!science) return null;
  if (typeof science === 'string') {
    return <div style={{ fontSize: 13, color: T.text2, lineHeight: 1.7 }}>{science}</div>;
  }
  const blocks = [
    { key: 'changes', label: 'Cambios', icon: Repeat, color: T.violet, content: science.changes },
    { key: 'why', label: 'Por qué', icon: Sparkles, color: T.accent, content: science.why },
    { key: 'observe', label: 'Qué observar', icon: Eye, color: T.warning, content: science.observe },
  ].filter(b => b.content);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {blocks.map((b, bIdx) => {
        const Icon = b.icon;
        const isArray = Array.isArray(b.content);
        return (
          <div key={b.key} style={{
            paddingTop: bIdx > 0 ? 16 : 0,
            borderTop: bIdx > 0 ? `1px solid ${T.border}` : 'none',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                background: `${b.color}20`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icon size={13} style={{ color: b.color }} strokeWidth={2.5} />
              </div>
              <Caption color={b.color}>{b.label}</Caption>
            </div>
            {isArray ? (
              <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
                {b.content.map((item, i) => (
                  <li key={i} style={{
                    display: 'flex', gap: 10,
                    padding: '5px 0',
                    fontSize: 13.5, color: T.text2, lineHeight: 1.6,
                  }}>
                    <span style={{ color: b.color, fontWeight: 700, flexShrink: 0 }}>·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : (
              <div style={{ fontSize: 13.5, color: T.text2, lineHeight: 1.65 }}>{b.content}</div>
            )}
          </div>
        );
      })}
    </div>
  );
};

// Icono SVG estilizado por patrón de movimiento
const MovementIcon = ({ pattern, size = 22, color = T.text2 }) => {
  const stroke = { stroke: color, strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', fill: 'none' };
  const v = `0 0 24 24`;
  switch (pattern) {
    case 'squat':
      return (
        <svg viewBox={v} width={size} height={size}>
          <circle cx="12" cy="4" r="1.8" {...stroke} />
          <path d="M12 6 V11 L9 16 V20 M12 11 L15 16 V20" {...stroke} />
          <path d="M7 9 H17" {...stroke} />
        </svg>
      );
    case 'squat_uni':
      return (
        <svg viewBox={v} width={size} height={size}>
          <circle cx="11" cy="4" r="1.8" {...stroke} />
          <path d="M11 6 V11 L8 16 V20 M11 11 L17 17 L19 21" {...stroke} />
        </svg>
      );
    case 'hinge':
      return (
        <svg viewBox={v} width={size} height={size}>
          <circle cx="5" cy="6" r="1.8" {...stroke} />
          <path d="M7 7 L18 11 M18 11 V20 M14 11 V17" {...stroke} />
        </svg>
      );
    case 'push_h':
      return (
        <svg viewBox={v} width={size} height={size}>
          <circle cx="7" cy="8" r="1.8" {...stroke} />
          <path d="M7 10 V20 M9 10 H20" {...stroke} />
          <rect x="19" y="8" width="3" height="4" {...stroke} />
        </svg>
      );
    case 'push_v':
      return (
        <svg viewBox={v} width={size} height={size}>
          <circle cx="12" cy="11" r="1.8" {...stroke} />
          <path d="M12 13 V22 M11 11 L7 4 M13 11 L17 4" {...stroke} />
          <path d="M5 3 H9 M15 3 H19" {...stroke} />
        </svg>
      );
    case 'pull_h':
      return (
        <svg viewBox={v} width={size} height={size}>
          <circle cx="17" cy="8" r="1.8" {...stroke} />
          <path d="M17 10 V20 M15 10 H4" {...stroke} />
          <rect x="2" y="8" width="3" height="4" {...stroke} />
        </svg>
      );
    case 'pull_v':
      return (
        <svg viewBox={v} width={size} height={size}>
          <path d="M5 4 H19" {...stroke} />
          <circle cx="12" cy="10" r="1.8" {...stroke} />
          <path d="M12 12 V22 M10 4 L12 10 M14 4 L12 10" {...stroke} />
        </svg>
      );
    case 'olympic':
      return (
        <svg viewBox={v} width={size} height={size}>
          <circle cx="12" cy="5" r="1.8" {...stroke} />
          <path d="M12 7 V13 L9 18 V21 M12 13 L15 18 V21" {...stroke} />
          <path d="M9 11 H15" {...stroke} />
          <path d="M5 11 H9 M15 11 H19" {...stroke} />
        </svg>
      );
    case 'jump':
      return (
        <svg viewBox={v} width={size} height={size}>
          <circle cx="12" cy="6" r="1.8" {...stroke} />
          <path d="M12 8 V14 L9 18 M12 14 L15 18 M14 10 L19 6 M10 10 L5 6" {...stroke} />
          <path d="M6 22 H18" strokeDasharray="2 2" {...stroke} />
        </svg>
      );
    case 'sprint':
      return (
        <svg viewBox={v} width={size} height={size}>
          <circle cx="8" cy="5" r="1.8" {...stroke} />
          <path d="M9 7 L17 12 M17 12 L19 21 M11 11 L5 16 M13 8 L21 5 M13 10 L7 12" {...stroke} />
        </svg>
      );
    case 'cod':
      return (
        <svg viewBox={v} width={size} height={size}>
          <path d="M4 12 L10 7 L10 10 L18 10 L18 7 L22 12 L18 17 L18 14 L10 14 L10 17 Z" {...stroke} />
        </svg>
      );
    case 'core':
      return (
        <svg viewBox={v} width={size} height={size}>
          <rect x="6" y="6" width="12" height="12" rx="2" {...stroke} />
          <path d="M6 12 H18 M12 6 V18" {...stroke} />
        </svg>
      );
    case 'rotation':
      return (
        <svg viewBox={v} width={size} height={size}>
          <circle cx="12" cy="12" r="6" {...stroke} />
          <path d="M12 6 L15 9 M18 12 L15 15 M12 18 L9 15" {...stroke} />
        </svg>
      );
    case 'calf':
      return (
        <svg viewBox={v} width={size} height={size}>
          <path d="M10 4 V14 M14 4 V14" {...stroke} />
          <path d="M9 14 L11 20 L13 20 L15 14" {...stroke} />
        </svg>
      );
    case 'isolation':
      return (
        <svg viewBox={v} width={size} height={size}>
          <path d="M8 4 V12 L6 18 M16 4 V12 L18 18" {...stroke} />
          <circle cx="12" cy="14" r="3" {...stroke} />
        </svg>
      );
    case 'mobility':
      return (
        <svg viewBox={v} width={size} height={size}>
          <path d="M4 12 Q8 6 12 12 T20 12" {...stroke} />
          <circle cx="4" cy="12" r="1" fill={color} stroke="none" />
          <circle cx="20" cy="12" r="1" fill={color} stroke="none" />
        </svg>
      );
    case 'balance':
      return (
        <svg viewBox={v} width={size} height={size}>
          <circle cx="12" cy="4" r="1.8" {...stroke} />
          <path d="M12 6 V16 L9 20 V22" {...stroke} />
          <path d="M5 22 H19" {...stroke} />
        </svg>
      );
    default:
      return (
        <svg viewBox={v} width={size} height={size}>
          <circle cx="12" cy="12" r="6" {...stroke} />
        </svg>
      );
  }
};

// Silueta humana frontal + posterior con regiones musculares coloreables
const MuscleSilhouette = ({ primary = [], secondary = [], width = 64, accent = T.accent }) => {
  const fillFor = (m) => {
    if (primary.includes(m)) return accent;
    if (secondary.includes(m)) return `${accent}55`;
    return T.bg3;
  };
  const baseStroke = T.border;
  return (
    <svg viewBox="0 0 110 100" width={width} height={width * 100 / 110} style={{ flexShrink: 0 }}>
      <g stroke={baseStroke} strokeWidth="0.4">
        {/* === VISTA FRONTAL === */}
        {/* Cabeza */}
        <circle cx="24" cy="9" r="5" fill={T.bg3} />
        {/* Cuello */}
        <rect x="22" y="14" width="4" height="3" fill={T.bg3} />
        {/* Hombros frontales (deltoides anterior) */}
        <ellipse cx="14" cy="20" rx="4" ry="3.5" fill={fillFor('hombros_f')} />
        <ellipse cx="34" cy="20" rx="4" ry="3.5" fill={fillFor('hombros_f')} />
        {/* Pecho (pectoral) */}
        <path d="M16 19 Q24 17 32 19 L32 30 Q24 32 16 30 Z" fill={fillFor('pecho')} />
        {/* Bíceps */}
        <rect x="10" y="22" width="3.5" height="11" rx="1.5" fill={fillFor('biceps')} />
        <rect x="34.5" y="22" width="3.5" height="11" rx="1.5" fill={fillFor('biceps')} />
        {/* Antebrazos */}
        <rect x="10" y="33" width="3.5" height="10" rx="1.5" fill={T.bg3} />
        <rect x="34.5" y="33" width="3.5" height="10" rx="1.5" fill={T.bg3} />
        {/* Abs (core frontal) */}
        <rect x="18" y="30" width="12" height="13" rx="1.5" fill={fillFor('core')} />
        {/* Cintura */}
        <rect x="18" y="43" width="12" height="3" fill={T.bg3} />
        {/* Cuádriceps */}
        <path d="M17 46 L23 46 L22 68 L17 68 Z" fill={fillFor('cuadriceps')} />
        <path d="M25 46 L31 46 L31 68 L26 68 Z" fill={fillFor('cuadriceps')} />
        {/* Rodillas */}
        <rect x="17" y="68" width="5" height="3" fill={T.bg3} />
        <rect x="26" y="68" width="5" height="3" fill={T.bg3} />
        {/* Tibial (gemelo frontal) */}
        <rect x="17" y="71" width="5" height="18" rx="1.5" fill={T.bg3} />
        <rect x="26" y="71" width="5" height="18" rx="1.5" fill={T.bg3} />

        {/* === VISTA POSTERIOR === */}
        {/* Cabeza */}
        <circle cx="80" cy="9" r="5" fill={T.bg3} />
        {/* Cuello */}
        <rect x="78" y="14" width="4" height="3" fill={T.bg3} />
        {/* Trapecio */}
        <path d="M70 17 L80 15 L90 17 L90 26 L70 26 Z" fill={fillFor('trapecio')} />
        {/* Hombros posteriores (deltoides posterior) */}
        <ellipse cx="68" cy="22" rx="4" ry="3.5" fill={fillFor('hombros_b')} />
        <ellipse cx="92" cy="22" rx="4" ry="3.5" fill={fillFor('hombros_b')} />
        {/* Tríceps */}
        <rect x="64" y="22" width="3.5" height="11" rx="1.5" fill={fillFor('triceps')} />
        <rect x="92.5" y="22" width="3.5" height="11" rx="1.5" fill={fillFor('triceps')} />
        {/* Antebrazos */}
        <rect x="64" y="33" width="3.5" height="10" rx="1.5" fill={T.bg3} />
        <rect x="92.5" y="33" width="3.5" height="10" rx="1.5" fill={T.bg3} />
        {/* Dorsal */}
        <path d="M70 26 L90 26 L88 40 L72 40 Z" fill={fillFor('dorsal')} />
        {/* Espalda baja (lumbares) */}
        <rect x="72" y="40" width="16" height="6" rx="1.5" fill={fillFor('espalda_baja')} />
        {/* Glúteos */}
        <ellipse cx="76" cy="50" rx="6" ry="4" fill={fillFor('gluteos')} />
        <ellipse cx="84" cy="50" rx="6" ry="4" fill={fillFor('gluteos')} />
        {/* Isquiotibiales */}
        <path d="M71 54 L77 54 L76 70 L72 70 Z" fill={fillFor('isquios')} />
        <path d="M83 54 L89 54 L88 70 L84 70 Z" fill={fillFor('isquios')} />
        {/* Pantorrillas posteriores */}
        <path d="M71 70 L77 70 L77 88 L72 88 Z" fill={fillFor('pantorrillas')} />
        <path d="M83 70 L89 70 L88 88 L84 88 Z" fill={fillFor('pantorrillas')} />
      </g>
    </svg>
  );
};

// Etiquetas legibles de músculos en español
const MUSCLE_LABELS = {
  pecho: 'Pecho',
  hombros_f: 'Hombros frontales',
  hombros_b: 'Hombros posteriores',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  trapecio: 'Trapecio',
  dorsal: 'Dorsal',
  espalda_baja: 'Lumbar',
  core: 'Core',
  cuadriceps: 'Cuádriceps',
  isquios: 'Isquiotibiales',
  gluteos: 'Glúteos',
  pantorrillas: 'Gemelos',
};

// Card colapsable con título destacado (estilo prominente, no sutil)
const ScienceSection = ({ title, icon: Icon, accentColor = T.accent, defaultOpen = false, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Card style={{ padding: 0, marginBottom: 14 }}>
      <button onClick={() => setOpen(!open)} style={{
        width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
        padding: '16px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        fontFamily: FONT, textAlign: 'left',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {Icon && <Icon size={14} style={{ color: accentColor }} />}
          <Caption color={accentColor}>{title}</Caption>
        </div>
        {open
          ? <ChevronUp size={16} style={{ color: T.text3 }} />
          : <ChevronDown size={16} style={{ color: T.text3 }} />}
      </button>
      {open && <div style={{ padding: '4px 18px 18px' }}>{children}</div>}
    </Card>
  );
};

// Por qué este workout: estructura pedagógica con secciones
const WorkoutScience = ({ science }) => {
  if (!science) return null;
  const sections = [
    { key: 'estructura', label: 'Estructura', icon: Layers, color: T.violet },
    { key: 'seleccion', label: 'Selección de ejercicios', icon: Target, color: T.info },
    { key: 'orden', label: 'Orden del workout', icon: List, color: T.accent },
    { key: 'frecuencia', label: 'Frecuencia y recuperación', icon: Clock, color: T.warning },
    { key: 'tradeoffs', label: 'Trade-offs considerados', icon: Scale, color: T.accentDk },
  ].filter(s => science[s.key]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {sections.map(s => {
        const Icon = s.icon;
        const content = science[s.key];
        const items = Array.isArray(content) ? content : [content];
        return (
          <div key={s.key}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <Icon size={13} style={{ color: s.color }} />
              <Caption color={s.color}>{s.label}</Caption>
            </div>
            <ul style={{ margin: 0, paddingLeft: 0, listStyle: 'none' }}>
              {items.map((item, i) => (
                <li key={i} style={{
                  fontSize: 13, color: T.text2, lineHeight: 1.6,
                  padding: '5px 0 5px 18px', position: 'relative',
                }}>
                  <span style={{
                    position: 'absolute', left: 0, top: 13,
                    width: 5, height: 5, borderRadius: '50%',
                    background: s.color, opacity: 0.7,
                  }} />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
};

const ExerciseStat = ({ label, value, color }) => (
  <div style={{ flex: 1, minWidth: 0 }}>
    <div style={{
      fontSize: 9, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase',
      color: T.text3, marginBottom: 3,
    }}>{label}</div>
    <div style={{
      fontSize: 14, fontWeight: 700, color: color || T.text,
      lineHeight: 1.2, wordBreak: 'break-word',
      ...NUM_STYLE,
    }}>{value || '—'}</div>
  </div>
);

// Combina icono de patrón + silueta para un ejercicio
const ExerciseVisuals = ({ exName, accent = T.accent, iconSize = 22, silhouetteWidth = 56, focus }) => {
  const pattern = useMemo(() => getPattern(exName), [exName]);
  const muscles = useMemo(() => getMuscles(exName, focus), [exName, focus]);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
      <MovementIcon pattern={pattern} size={iconSize} color={accent} />
      <MuscleSilhouette primary={muscles.primary} secondary={muscles.secondary} width={silhouetteWidth} accent={accent} />
    </div>
  );
};

const ExerciseRow = ({ ex, idx, num, sessionData, onUpdate, oneRMs, sessionsData, phaseId, phaseColor }) => {
  const { phases: PLAN, resolveExercise } = usePlan();
  const [expanded, setExpanded] = useState(false);
  const [mediaOpen, setMediaOpen] = useState(false);
  const exData = sessionData?.exercises?.[idx] || {};
  const pc = phaseColor || LT.blue;
  const repertoire = resolveExercise(ex);
  const hasMedia = !!(repertoire && (repertoire.cover_image_url || repertoire.video_url || repertoire.video_link));

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
  const rest = inferRest(ex, phaseId);
  const muscles = getMuscles(ex.name, ex.focus);
  const primaryLabels = muscles.primary.map(m => MUSCLE_LABELS[m]).filter(Boolean);
  const spec = [ex.reps ? `${ex.reps} reps` : null, formattedIntensity].filter(Boolean).join(' · ');
  const hasDetails = ex.cue || primaryLabels.length > 0 || recommended !== null || ex.notes;

  return (
    <div style={{
      background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 14,
      padding: '12px 13px', marginBottom: 8,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {/* Miniatura del repertorio (media viva) o número en el set */}
        {repertoire?.cover_image_url ? (
          <button
            type="button"
            onClick={() => setMediaOpen(true)}
            aria-label={`Ver técnica de ${ex.name}`}
            style={{
              width: 40, height: 40, borderRadius: 10, padding: 0, border: `1px solid ${LT.border}`,
              cursor: 'pointer', overflow: 'hidden', flexShrink: 0, position: 'relative', background: '#0E1015',
            }}
          >
            <img src={repertoire.cover_image_url} alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            {(repertoire.video_url || repertoire.video_link) && (
              <span style={{
                position: 'absolute', inset: 0, display: 'grid', placeItems: 'center',
                background: 'rgba(0,0,0,0.22)', color: '#fff',
              }}>
                <Play size={14} fill="#fff" />
              </span>
            )}
          </button>
        ) : (
          <div style={{
            width: 28, height: 28, borderRadius: 8, background: pc + '14',
            color: pc, display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 13, fontWeight: 700, flexShrink: 0, ...NUM_STYLE,
          }}>{num}</div>
        )}

        {/* Nombre + spec + anterior */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            onClick={hasMedia ? () => setMediaOpen(true) : undefined}
            style={{ fontSize: 15, fontWeight: 700, color: LT.text, lineHeight: 1.2, cursor: hasMedia ? 'pointer' : 'default' }}
          >{ex.name}</div>
          {spec && <div style={{ fontSize: 12, color: LT.text2, marginTop: 3 }}>{spec}</div>}
          {showWeightInput && previous && (
            <div style={{ fontSize: 11, color: LT.text3, marginTop: 2, ...NUM_STYLE }}>Anterior: {previous.weight} kg</div>
          )}
        </div>

        {/* Peso o estado */}
        {showWeightInput ? (
          <div style={{
            border: `1px solid ${exData.weight ? LT.mint : LT.border}`, borderRadius: 10,
            padding: '6px 8px', textAlign: 'center', minWidth: 62, flexShrink: 0,
            background: exData.weight ? LT.mint + '0D' : LT.surface,
          }}>
            <input type="number" inputMode="decimal" value={exData.weight || ''}
              onChange={e => onUpdate(idx, { ...exData, weight: e.target.value })}
              placeholder="—"
              style={{
                width: '100%', border: 'none', background: 'transparent', textAlign: 'center',
                fontSize: 17, fontWeight: 700, color: exData.weight ? LT.mint : LT.text3,
                outline: 'none', fontFamily: FONT, padding: 0, ...NUM_STYLE,
              }} />
            <div style={{ fontSize: 8, color: LT.text3, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 1 }}>kg</div>
          </div>
        ) : (
          <div style={{ fontSize: 11, color: LT.text3, flexShrink: 0, textAlign: 'right', maxWidth: 80 }}>
            {ex.sets && ex.reps ? `${ex.sets}×${ex.reps}` : 'Sin carga'}
          </div>
        )}
      </div>

      {/* Toggle detalles */}
      {hasDetails && (
        <button onClick={() => setExpanded(!expanded)}
          style={{
            background: 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT,
            display: 'flex', alignItems: 'center', gap: 4, marginTop: 8, padding: 0,
            fontSize: 11, color: LT.blue, fontWeight: 600,
          }}>
          {expanded ? 'Ocultar' : 'Ver detalle'}
          {expanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
        </button>
      )}

      {expanded && (
        <div style={{ marginTop: 10, paddingTop: 10, borderTop: `1px solid ${LT.border}` }}>
          <div style={{ display: 'flex', gap: 16, marginBottom: ex.cue || recommended !== null ? 10 : 0, flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: 9, color: LT.text3, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>Series</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: LT.text, ...NUM_STYLE }}>{ex.sets || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: LT.text3, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>Reps</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: LT.text }}>{ex.reps || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: 9, color: LT.text3, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>Carga</div>
              <div style={{ fontSize: 15, fontWeight: 700, color: LT.text }}>{formattedIntensity || '—'}</div>
            </div>
            {rest && (
              <div>
                <div style={{ fontSize: 9, color: LT.text3, fontWeight: 700, letterSpacing: 0.4, textTransform: 'uppercase' }}>Descanso</div>
                <div style={{ fontSize: 15, fontWeight: 700, color: LT.text }}>{rest}</div>
              </div>
            )}
          </div>
          {primaryLabels.length > 0 && (
            <div style={{ fontSize: 11, color: LT.text2, marginBottom: ex.cue || recommended !== null ? 10 : 0 }}>
              Músculos: {primaryLabels.join(' · ')}
            </div>
          )}
          {ex.cue && (
            <div style={{
              padding: '8px 12px', background: LT.warning + '0D', borderLeft: `2px solid ${LT.warning}`,
              borderRadius: '0 6px 6px 0', fontSize: 12, color: LT.text2, lineHeight: 1.45, marginBottom: recommended !== null ? 10 : 0,
            }}>
              <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 0.5, color: LT.warning, textTransform: 'uppercase', marginRight: 6 }}>Técnica</span>
              {ex.cue}
            </div>
          )}
          {recommended !== null && (
            <div style={{ fontSize: 12, color: LT.mint, fontWeight: 600, ...NUM_STYLE }}>
              Peso recomendado ≈ {recommended} kg
            </div>
          )}
          {ex.notes && <div style={{ fontSize: 12, color: LT.text3, marginTop: 6, fontStyle: 'italic' }}>{ex.notes}</div>}
        </div>
      )}

      {mediaOpen && (
        <ExerciseMediaModal exercise={repertoire} planEx={ex} onClose={() => setMediaOpen(false)} />
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

const SetGroup = ({ group, setNum, phaseColor, sessionData, onUpdate, oneRMs, sessionsData, phaseId }) => {
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
  const series = group.exercises[0].ex.sets;
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, paddingLeft: 2 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: LT.text }}>Set {setNum}</span>
        {typeLabel && (
          <span style={{ fontSize: 10, fontWeight: 700, color: LT.blue, background: LT.blueSoft, padding: '2px 8px', borderRadius: 6, letterSpacing: 0.3 }}>
            {typeLabel}
          </span>
        )}
        {series && (
          <span style={{ fontSize: 11, color: LT.text2 }}>
            {typeLabel ? `${series} rondas` : `${series} series`}
          </span>
        )}
      </div>
      {typeLabel && (
        <div style={{ fontSize: 11, color: LT.text3, marginBottom: 8, paddingLeft: 2 }}>
          Alterna los ejercicios sin descanso completo entre ellos
        </div>
      )}
      {group.exercises.map(({ ex, idx }, i) => (
        <ExerciseRow key={idx} ex={ex} idx={idx} num={i + 1} phaseColor={phaseColor} phaseId={phaseId}
          sessionData={sessionData} onUpdate={onUpdate} oneRMs={oneRMs} sessionsData={sessionsData} />
      ))}
    </div>
  );
};

const SessionDetail = ({ phase, week, dayIdx, onBack, sessionsData, updateSession, oneRMs }) => {
  const day = week.days[dayIdx];
  const id = sessionId(phase.id, week.num, dayIdx);
  const sessionData = sessionsData[id] || {};
  const completed = sessionData.completed || false;
  const phaseColor = phase.color || LT.blue;

  const setExerciseData = (blockIdx, exIdx, data) => {
    updateSession(id, prev => {
      const ex = prev?.exercises || {};
      const key = blockIdx !== null ? `${blockIdx}-${exIdx}` : `${exIdx}`;
      return { ...prev, exercises: { ...ex, [key]: data } };
    });
  };
  const updateNotes = (notes) => updateSession(id, prev => ({ ...prev, notes }));
  const toggleComplete = () => updateSession(id, prev => ({ ...prev, completed: !prev?.completed, completedAt: !prev?.completed ? new Date().toISOString() : null }));

  const dayName = day.name || (day.blocks ? day.blocks.map(b => b.tag.replace(/^Sesi[óo]n \d+ \([AP]M\): /, '')).join(' + ') : day.day);

  // sessionData filtrado para day.exercises (keys sin guion)
  const flatSessionData = { exercises: sessionData.exercises ? Object.fromEntries(Object.entries(sessionData.exercises).filter(([k]) => !k.includes('-')).map(([k, v]) => [parseInt(k), v])) : {} };

  return (
    <div style={{ paddingBottom: 140, background: LT.bg, minHeight: '100vh', fontFamily: FONT }}>
      <div style={{ padding: '16px 18px 20px' }}>
        <button onClick={onBack} style={{
          background: 'transparent', border: 'none', color: LT.text2, cursor: 'pointer',
          display: 'flex', alignItems: 'center', gap: 4, marginBottom: 16, fontFamily: FONT, fontSize: 13, padding: 0,
        }}>
          <ChevronLeft size={16} /> Semana {week.num}
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: phaseColor }} />
          <span style={{ fontSize: 12, color: LT.text2, fontWeight: 600 }}>{day.day} · {CAT_COLORS[day.cat]?.label}</span>
          {day.dual && <span style={{ fontSize: 12, color: LT.warning, fontWeight: 600 }}>· Doble</span>}
        </div>

        <h1 style={{ fontSize: 30, fontWeight: 800, color: LT.text, margin: 0, lineHeight: 1.05, letterSpacing: -0.8 }}>{dayName}</h1>

        {completed && (
          <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6, padding: '5px 12px', background: LT.mint + '14', borderRadius: 20, color: LT.mint, fontSize: 12, fontWeight: 700 }}>
            <CheckCircle2 size={12} /> Completada
          </div>
        )}
      </div>

      <div style={{ padding: '0 18px' }}>
        {day.exercises && (
          <div style={{ marginBottom: 6 }}>
            {(() => {
              const groups = groupIntoSets(day.exercises);
              let setNum = 0;
              return groups.map((g, gi) => {
                if (!g.isNote) setNum += 1;
                return (
                  <SetGroup key={gi} group={g} setNum={setNum} phaseColor={phaseColor} phaseId={phase.id}
                    sessionData={flatSessionData}
                    onUpdate={(idx, data) => setExerciseData(null, idx, data)}
                    oneRMs={oneRMs} sessionsData={sessionsData} />
                );
              });
            })()}
          </div>
        )}

        {day.blocks && day.blocks.map((blk, bi) => {
          const blkSessionData = { exercises: sessionData.exercises ? Object.fromEntries(Object.entries(sessionData.exercises).filter(([k]) => k.startsWith(`${bi}-`)).map(([k, v]) => [parseInt(k.split('-')[1]), v])) : {} };
          return (
            <div key={bi} style={{ marginBottom: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: phaseColor }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: LT.text }}>{blk.tag}</span>
              </div>
              {blk.type === 'lift' && (() => {
                const groups = groupIntoSets(blk.exercises);
                let setNum = 0;
                return groups.map((g, gi) => {
                  if (!g.isNote) setNum += 1;
                  return (
                    <SetGroup key={gi} group={g} setNum={setNum} phaseColor={phaseColor} phaseId={phase.id}
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
                <div style={{ padding: 12, background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 10, fontSize: 13, color: LT.text2, lineHeight: 1.6 }}>
                  {blk.text}
                </div>
              )}
            </div>
          );
        })}

        {day.notes && !day.exercises && !day.blocks && (
          <div style={{ background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <ul style={{ margin: 0, paddingLeft: 18, color: LT.text2, fontSize: 14, lineHeight: 1.7 }}>
              {day.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        )}

        {day.notes && (day.exercises || day.blocks) && (
          <div style={{ background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <div style={{ fontSize: 11, color: LT.text3, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Notas del día</div>
            <ul style={{ margin: 0, paddingLeft: 18, color: LT.text2, fontSize: 13, lineHeight: 1.7 }}>
              {day.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          </div>
        )}

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

        {day.dayScience && (
          <div style={{ background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <Info size={13} style={{ color: LT.blue }} />
              <span style={{ fontSize: 13, fontWeight: 700, color: LT.text }}>Por qué este día</span>
            </div>
            <div style={{ fontSize: 13.5, color: LT.text2, lineHeight: 1.7 }}>{day.dayScience}</div>
          </div>
        )}
      </div>

      {/* CTA fijo abajo */}
      <div style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 18px 22px',
        background: `linear-gradient(180deg, transparent, ${LT.bg} 30%)`, maxWidth: 600, margin: '0 auto',
      }}>
        <button onClick={toggleComplete}
          style={{
            width: '100%', padding: '15px', borderRadius: 16, border: 'none', cursor: 'pointer',
            fontFamily: FONT, fontSize: 15, fontWeight: 700,
            background: completed ? LT.surface : LT.blue,
            color: completed ? LT.text2 : '#fff',
            boxShadow: completed ? 'none' : '0 8px 24px rgba(30,64,224,0.32)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}>
          {completed ? <X size={18} /> : <Check size={18} />}
          {completed ? 'Marcar como pendiente' : 'Marcar completada'}
        </button>
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

const DayChip = ({ day, isSelected, isCompleted, isActive, isSkipped, onClick }) => {
  const cat = CAT_COLORS[day.cat] || CAT_COLORS.gym;
  const borderColor = isSelected ? T.accent : isCompleted ? 'rgba(0, 163, 114, 0.4)' : isSkipped ? T.border : T.border;
  const bgColor = isSelected ? T.bg3 : T.bg2;
  return (
    <button onClick={onClick}
      style={{
        flex: 1, minWidth: 0,
        padding: '12px 4px',
        background: bgColor,
        border: `1.5px solid ${borderColor}`,
        borderRadius: 14,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8,
        cursor: 'pointer', fontFamily: FONT,
        position: 'relative',
        opacity: isSkipped && !isSelected ? 0.5 : 1,
        transition: 'border-color 0.15s, background 0.15s, opacity 0.15s',
      }}>
      <span style={{
        fontSize: 11, fontWeight: 800, letterSpacing: 0.8,
        color: isSelected ? T.text : isCompleted ? T.accent : isSkipped ? T.text3 : T.text2,
        textDecoration: isSkipped ? 'line-through' : 'none',
      }}>
        {day.day.toUpperCase()}
      </span>
      {isCompleted ? (
        <div style={{
          width: 18, height: 18, borderRadius: '50%', background: T.accentBg,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <Check size={11} style={{ color: T.accent }} strokeWidth={3.5} />
        </div>
      ) : isSkipped ? (
        <div style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <X size={12} style={{ color: T.text3 }} strokeWidth={2.5} />
        </div>
      ) : (
        <div style={{ width: 18, height: 18, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: cat.c, display: 'inline-block' }} />
        </div>
      )}
      {day.dual && !isSkipped && (
        <span style={{
          position: 'absolute', top: 6, right: 6,
          fontSize: 8, fontWeight: 800, letterSpacing: 0.4,
          color: T.warning, background: 'rgba(255, 160, 71, 0.15)',
          padding: '1px 4px', borderRadius: 4,
        }}>2X</span>
      )}
      {isActive && !isCompleted && !isSkipped && (
        <span style={{
          position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)',
          width: 6, height: 6, borderRadius: '50%', background: T.accent,
          boxShadow: `0 0 8px ${T.accent}`,
        }} />
      )}
    </button>
  );
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
  const phaseColor = phase.color || LT.blue;
  const completedCount = week.days.filter((_, idx) => sessionsData[sessionId(phase.id, week.num, idx)]?.completed).length;

  const initialIdx = useMemo(() => {
    const idx = week.days.findIndex((_, i) => !sessionsData[sessionId(phase.id, week.num, i)]?.completed);
    return idx === -1 ? 0 : idx;
  }, [week, phase.id, sessionsData]);
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
    <div style={{ padding: '14px 18px 110px', background: LT.bg, minHeight: '100vh', fontFamily: FONT }}>
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

      {/* Calendario horizontal claro */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
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
                flex: 1, minWidth: 0, padding: '12px 4px', borderRadius: 12, cursor: 'pointer', fontFamily: FONT,
                background: isSelected ? phaseColor : LT.surface,
                border: `1.5px solid ${isSelected ? phaseColor : isCompleted ? LT.mint + '60' : LT.border}`,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
              }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: isSelected ? '#fff' : LT.text2 }}>{day.day}</span>
              {isCompleted
                ? <Check size={14} style={{ color: isSelected ? '#fff' : LT.mint }} strokeWidth={3} />
                : <span style={{ width: 7, height: 7, borderRadius: '50%', background: isSelected ? '#fff' : dcat.c }} />}
              {isActive && !isCompleted && <span style={{ width: 4, height: 4, borderRadius: '50%', background: isSelected ? '#fff' : phaseColor }} />}
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
            <SetGroup key={`${selectedIdx}-${gi}`} group={g} setNum={setNum} phaseColor={phaseColor} phaseId={phase.id}
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
                      <SetGroup key={gi} group={g} setNum={setNum} phaseColor={phaseColor} phaseId={phase.id}
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
      <h1 style={{ fontSize: 34, fontWeight: 800, color: T.text, margin: 0, lineHeight: 1.02, letterSpacing: -1 }}>{phase.fullName}</h1>

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

const HomeView = ({ sessionsData, wellness, onStartSession, onGoTab, onGoPhase, onGoWeek, cursor, onChangeCursor }) => {
  const { phases: PLAN, planMeta } = usePlan();
  const { profile } = useAuth();
  const displayName = profile?.full_name || profile?.username || 'Atleta';
  const next = useMemo(() => resolveCursor(PLAN, cursor), [PLAN, cursor]);
  const cursorCompleted = next ? !!sessionsData[next.id]?.completed : false;
  const total = useMemo(() => totalProgress(PLAN, sessionsData), [PLAN, sessionsData]);
  const todayScore = useMemo(() => {
    const d = wellness[today()];
    if (!d || !d.sleep || d.fatigue == null || d.soreness == null || !d.motivation) return null;
    return Math.round((d.sleep + (10 - d.fatigue) + (10 - d.soreness) + d.motivation) / 4 * 10) / 10;
  }, [wellness]);

  // Progreso de la semana actual: completadas / total
  const weekProgress = useMemo(() => {
    if (!next) return { done: 0, total: 0 };
    let done = 0;
    next.week.days.forEach((_, i) => {
      const id = sessionId(next.phase.id, next.week.num, i);
      if (sessionsData[id]?.completed) done++;
    });
    return { done, total: next.week.days.length };
  }, [next, sessionsData]);

  // Días estimados hasta el próximo deload
  const daysToDeload = useMemo(() => {
    if (!next) return null;
    let passed = false;
    let weeksAhead = 0;
    for (const phase of PLAN) {
      for (const week of phase.weekData) {
        if (passed) {
          if (phase.id === 'deload') {
            return { days: weeksAhead * 7, label: `${phase.fullName || 'Deload'} sem ${week.num}` };
          }
          weeksAhead++;
        }
        if (phase.id === next.phase.id && week.num === next.week.num) {
          passed = true;
        }
      }
    }
    return null;
  }, [next, PLAN]);

  // Próximas 3 sesiones después del cursor (no completadas)
  const upcomingSessions = useMemo(() => {
    if (!next) return [];
    const result = [];
    let passed = false;
    outer: for (const phase of PLAN) {
      for (const week of phase.weekData) {
        for (let di = 0; di < week.days.length; di++) {
          if (passed) {
            const id = sessionId(phase.id, week.num, di);
            if (!sessionsData[id]?.completed) {
              result.push({ phase, week, day: week.days[di], dayIdx: di, id });
              if (result.length >= 3) break outer;
            }
          }
          if (phase.id === next.phase.id && week.num === next.week.num && di === next.dayIdx) {
            passed = true;
          }
        }
      }
    }
    return result;
  }, [next, sessionsData, PLAN]);

  // Tendencia de bienestar últimos 7 días
  const readinessTrend = useMemo(() => {
    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      const w = wellness[key];
      let score = null;
      if (w && w.sleep && w.fatigue != null && w.soreness != null && w.motivation) {
        score = Math.round((w.sleep + (10 - w.fatigue) + (10 - w.soreness) + w.motivation) / 4 * 10) / 10;
      }
      days.push({ d: key.slice(8), score });
    }
    return days;
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

  const { text: greetText, icon: GreetIcon } = greeting();
  const phaseColor = next ? next.phase.color : T.accent;

  // Icono por categoría
  const catIcon = (cat) => {
    if (cat === 'gym') return Dumbbell;
    if (cat === 'speed') return Zap;
    if (cat === 'recovery') return Activity;
    if (cat === 'football') return Trophy;
    if (cat === 'team') return Trophy;
    if (cat === 'tests') return AlertCircle;
    if (cat === 'off') return Moon;
    return Activity;
  };

  // Silueta del atleta para hero card (compacta)
  const AthleteSilhouette = ({ color }) => (
    <svg viewBox="0 0 100 100" width="140" height="140" style={{ display: 'block' }}>
      <circle cx="50" cy="22" r="9" fill={color} />
      <rect x="44" y="32" width="12" height="28" rx="4" fill={color} />
      <rect x="34" y="36" width="10" height="22" rx="3" fill={color} />
      <rect x="56" y="36" width="10" height="22" rx="3" fill={color} />
      <rect x="40" y="60" width="8" height="28" rx="3" fill={color} />
      <rect x="52" y="60" width="8" height="28" rx="3" fill={color} />
    </svg>
  );

  const sessionTitle = next ? (next.day.name || (next.day.blocks ? next.day.blocks.map(b => b.tag.replace(/^Sesi[óo]n \d+ \([AP]M\): /, '')).join(' + ') : next.day.day)) : '';

  return (
    <div style={{ paddingBottom: 100, background: LT.bg, minHeight: '100vh', fontFamily: FONT }}>
      {/* Header de perfil */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '24px 18px 14px' }}>
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
          <div style={{ fontSize: 24, fontWeight: 800, color: LT.text, lineHeight: 1.1, letterSpacing: -0.4, marginTop: 6 }}>{displayName}</div>
          {next && (
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
                  {cursorCompleted ? 'Completada' : 'Tu siguiente'}
                </div>
                <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.05, marginTop: 3, letterSpacing: -0.5 }}>
                  {sessionTitle}
                </div>
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.82)', marginTop: 8, lineHeight: 1.4 }}>
                  {next.phase.name}<br />
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
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>Fase {next.phase.num}</span>
              </div>
              <div style={{ position: 'relative', padding: '0 16px 16px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.05, marginBottom: 12 }}>
                  {next.phase.name}
                </div>
                <div style={{ background: '#fff', borderRadius: 14, padding: '12px', fontSize: 13, fontWeight: 600, color: '#111', textAlign: 'center' }}>
                  Ver fase
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

            {/* Mi progreso */}
            <div style={{ flex: 1, background: LT.surface, borderRadius: 22, padding: 20, minWidth: 0 }}>
              <div style={{ fontSize: 14, color: LT.text2 }}>Mi progreso</div>
              <div style={{ fontSize: 13, color: LT.text, marginTop: 6 }}>
                Semana {weekProgress.done}/{weekProgress.total} de la fase
              </div>
              <div style={{ display: 'flex', gap: 5, marginTop: 14, alignItems: 'flex-end', height: 40 }}>
                {Array.from({ length: Math.max(weekProgress.total, 1) }).map((_, i) => (
                  <div key={i} style={{
                    width: 8, height: i < weekProgress.done ? '100%' : '45%',
                    background: i < weekProgress.done ? LT.blue : LT.blueSoft, borderRadius: 3,
                  }} />
                ))}
              </div>
              <div style={{ fontSize: 11, color: LT.text3, marginTop: 10 }}>
                {Math.round(total.pct)}% del plan anual
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
                  {PLAN.length} {PLAN.length === 1 ? 'fase' : 'fases'} · {PLAN.reduce((s, p) => s + (p.weekData?.length || 0), 0)} semanas
                </div>
                <div style={{ fontSize: 12, color: LT.blue, fontWeight: 600, marginTop: 4 }}>
                  {total.completed} de {total.total} sesiones completadas
                </div>
              </div>
              <ChevronRight size={18} style={{ color: LT.text3, flexShrink: 0 }} />
            </div>
          </div>
        </>
      ) : (
        <div style={{ padding: '0 18px' }}>
          <div style={{ background: LT.surface, borderRadius: 22, padding: 24 }}>
            <div style={{ fontSize: 24, fontWeight: 700, color: LT.text }}>Plan completado</div>
            <div style={{ marginTop: 8, fontSize: 14, color: LT.text2 }}>Todas las sesiones marcadas. Buen trabajo.</div>
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
  const [calc, setCalc] = useState({ weight: '', reps: '' });
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
            <Input value={calc.weight} onChange={v => setCalc(c => ({ ...c, weight: v }))} placeholder="Peso" type="number" suffix="kg" />
            <Input value={calc.reps} onChange={v => setCalc(c => ({ ...c, reps: v }))} placeholder="Reps" type="number" suffix="reps" />
          </div>
          {result && (
            <div style={{ padding: 18, background: T.accentBg, borderRadius: 14, border: `1px solid rgba(30, 64, 224, 0.15)` }}>
              <Caption color={T.accentDk} style={{ marginBottom: 4 }}>1RM estimado</Caption>
              <div style={{ fontSize: 44, fontWeight: 800, color: T.accent, lineHeight: 1, letterSpacing: -1, ...NUM_STYLE }}>
                {result.avg}<span style={{ fontSize: 16, color: T.accentDk, fontWeight: 500 }}> kg</span>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: T.text3, ...NUM_STYLE }}>
                Brzycki {result.brzycki} kg · Epley {result.epley} kg
              </div>
            </div>
          )}
        </Card>

        <Caption style={{ marginBottom: 12, marginTop: 24 }}>Tus 1RM guardados</Caption>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {ONE_RM_LIFTS.map(lift => (
            <div key={lift.key} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: T.bg2, borderRadius: 10, border: `1px solid ${T.border}` }}>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.text }}>{lift.name}</div>
              <Input value={oneRMs[lift.key] ?? ''}
                onChange={v => setOneRMs(prev => ({ ...prev, [lift.key]: v ? parseFloat(v) : null }))}
                placeholder="—" type="number" suffix="kg"
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

const BottomNav = ({ active, onChange }) => {
  const items = [
    { id: 'home', label: 'Hoy', icon: HomeIcon },
    { id: 'plan', label: 'Plan', icon: Layers },
    { id: 'wellness', label: 'Bienestar', icon: Heart },
    { id: 'oneRM', label: '1RM', icon: Calculator },
    { id: 'science', label: 'Ciencia', icon: BookOpen },
  ];
  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'rgba(255, 255, 255, 0.92)', backdropFilter: 'blur(20px)',
      WebkitBackdropFilter: 'blur(20px)',
      borderTop: `1px solid ${KP.line}`,
      padding: '8px 4px max(10px, env(safe-area-inset-bottom))',
      display: 'flex', justifyContent: 'space-around', zIndex: 100,
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

  const updateSession = useCallback((id, updater) => {
    setSessionsData(prev => {
      const newSd = { ...prev, [id]: typeof updater === 'function' ? updater(prev[id] || {}) : updater };
      // Si la sesión completada es la del cursor, avanzar cursor al siguiente no completado
      const updated = newSd[id];
      if (updated?.completed && id === activeSessionId) {
        const nextCursor = advanceCursor(PLAN, cursor, newSd);
        if (nextCursor) setCursor(nextCursor);
      }
      return newSd;
    });
  }, [setSessionsData, PLAN, cursor, setCursor, activeSessionId]);

  // Cambiar cursor manualmente desde el selector
  const handleSelectCursor = useCallback((phaseId, weekNum, dayIdx) => {
    setCursor({ phaseId, weekNum, dayIdx });
    setCursorPickerOpen(false);
  }, [setCursor]);

  const goToPlan = () => { setView({ level: 'plan' }); setTab('plan'); };
  // From Home or anywhere: jump directly to the week view (selected day handled internally)
  const startSession = (phase, week, dayIdx) => {
    setTab('plan');
    setView({ level: 'week', phase, week });
  };
  const goToPhase = (phase) => { setTab('plan'); setView({ level: 'phase', phase }); };
  const goToWeek = (phase, week) => { setTab('plan'); setView({ level: 'week', phase, week }); };
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
      onGoWeek={goToWeek}
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
      minHeight: '100vh', background: T.bg, color: T.text,
      fontFamily: FONT,
      WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale',
    }}>
      {showTimeline && <PhaseTimeline activePhaseId={view.phase?.id || activePhaseId}
        sessionsData={sessionsData} onJumpToPhase={jumpToPhase} />}
      {content}
      <BottomNav active={tab} onChange={t => { setTab(t); if (t === 'plan') setView({ level: 'plan' }); }} />
      {cursorPickerOpen && (
        <CursorSelector current={cursor} sessionsData={sessionsData}
          onSelect={handleSelectCursor} onClose={() => setCursorPickerOpen(false)} />
      )}
    </div>
  );
}
