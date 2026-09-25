import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronRight, ChevronDown, ChevronUp, Calendar,
  Check, X, Calculator, BookOpen, TrendingUp, Edit3, Target,
  Zap, Trophy, Clock, FileText, Sparkles, Info, Dumbbell, Heart, Play,
  Activity, Home as HomeIcon,
  Repeat, Eye, Layers, List, Scale, LineChart as LineChartIcon,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { useIsDesktop } from '@/lib/useViewport';
import { T, FONT, NUM_STYLE, LT, tipoDeSesion, KP, eyebrow } from '@/lib/theme';
import { PHASE_IMG } from '@/data/training-data';
import { usePlan } from '@/contexts/PlanContext';
import { usePerfilDeLaVista } from '@/contexts/VistaContext';
import {
  sessionIdFor, calc1RM, today, greeting, isLoadedExercise,
  resolveCursor, defaultCursor, isValidCursor, findPreviousWeight, historialDePeso,
  formatIntensity,
  sessionForToday, weekOverview, weekdayToday, weekdayLabel,
  cursorAlDia, isoWeekKey, esDescanso, enOrdenDeSemana,
  bloqueQueRepite, ejerciciosDelBloque, nombreDeSesion, diasDeEstaSemana, claveDeDia,
} from '@/lib/training-utils';
import HojaFlotante from '@/components/HojaFlotante';
import NavegadorDelPlan from '@/components/NavegadorDelPlan';
import { aKilos, desdeKilos, etiquetaUnidad } from '@/lib/unidades';
import { portadaParaAtleta, videosParaAtleta } from '@/lib/videos';
import { useStorage } from '@/contexts/AppStateContext';
import FichaEjercicio from '@/features/training/FichaEjercicio';
import Portada from '@/components/Portada';
import { plural, pluralS, rondasQueDecir } from '@/lib/plural';
import { textoMeta } from '@/lib/medidas';

// Nombres completos SOLO para mostrar en compu. Lo que guarda el plan sigue
// siendo 'Lun', 'Mar'… igual que en el editor del entrenador.
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

/* La llave con la que se guarda un día del plan. En un plan por fases, cada día
   del plan tiene la suya. En una rutina que se repite, cada semana del
   CALENDARIO es un registro nuevo: si no, marcar el lunes lo dejaba marcado
   todos los lunes, y los pesos de una semana pisaban los de la anterior. */
const useIdDeSesion = () => {
  const { kind } = usePlan();
  return useCallback((phaseId, weekNum, dayIdx) => sessionIdFor(kind, phaseId, weekNum, dayIdx), [kind]);
};

// Global timeline shown across all internal views
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
      /* Tarjeta FLOTANTE, no hoja pegada abajo. Andrés, 18 sep 2026: "no me
         gusta cómo la ventanita de mi progreso sale así como de abajo, me
         gustaría más como card flotante". Subirla al centro también la separa
         de las hojas que sí son hojas (opciones, programa), que salen de abajo
         a propósito: ahí el gesto es "asomarse", aquí es "mira este dato". */
      style={{
        position: 'fixed', inset: 0, zIndex: 4500, background: 'rgba(9,11,16,.5)',
        display: 'grid', placeItems: 'center', padding: 18, fontFamily: FONT,
      }}
    >
      <div
        className="animate-fade-in"
        style={{
          width: '100%', maxWidth: 420, background: LT.surface,
          borderRadius: 24, padding: 18,
          maxHeight: 'min(78svh, 640px)', overflowY: 'auto',
          boxShadow: '0 24px 60px rgba(9,11,16,0.28), 0 2px 8px rgba(9,11,16,0.10)',
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

const ExerciseRow = ({ ex, idx, num, sessionData, sessionKey, sessionsData, phaseColor, onAbrirFicha }) => {
  const { phases: PLAN, resolveExercise, medias, kind } = usePlan();
  const { perfil: profile } = usePerfilDeLaVista();
  const unidad = profile?.unidad_peso || 'kg';
  const u = etiquetaUnidad(unidad);
  const [progresoAbierto, setProgresoAbierto] = useState(false);
  const exData = sessionData?.exercises?.[idx] || {};
  const pc = phaseColor || LT.blue;
  const repertoire = resolveExercise(ex);
  // La foto y el video que le tocan a ESTA persona: puede haber una puesta solo
  // para ella, una de su género, o la general. Nunca se lee el campo del
  // ejercicio a pelo, porque entonces el trabajo del coach no se vería.
  const portada = portadaParaAtleta(repertoire, medias, profile);
  const misVideos = videosParaAtleta(repertoire, medias, profile);


  const previous = useMemo(() => {
    if (ex.isNote || !ex.name) return null;
    // El de la vez pasada: el que acaba de anotar hoy no es "antes".
    return findPreviousWeight(PLAN, sessionsData, ex.name, { kind, actual: sessionKey });
  }, [PLAN, ex.name, ex.isNote, sessionsData, kind, sessionKey]);

  const historial = useMemo(() => {
    if (ex.isNote || !ex.name) return [];
    return historialDePeso(PLAN, sessionsData, ex.name, kind);
  }, [PLAN, ex.name, ex.isNote, sessionsData, kind]);

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
    textoMeta(ex),
    formattedIntensity || null,
    rest || null,
  ].filter(Boolean);

  const pesoAnterior = showWeightInput && previous
    ? `${desdeKilos(previous.weight, unidad)} ${u}` : null;

  // Lo que ya quedó anotado hoy, en una línea. Vacío = todavía no hay nada.
  const anotado = [
    exData.repsHechas ? `${exData.repsHechas} ${exData.repsHechas === '1' ? 'rep' : 'reps'}` : null,
    exData.weight ? `${desdeKilos(exData.weight, unidad)} ${u}` : null,
  ].filter(Boolean).join(' · ');

  return (
    <div style={{ padding: '11px 12px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 11 }}>
        {/* La miniatura y el nombre abren la ficha con el video en grande. */}
        <button
          type="button"
          onClick={onAbrirFicha}
          style={{
            flex: 1, minWidth: 0, display: 'flex', alignItems: 'flex-start', gap: 11,
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
            fontFamily: FONT, textAlign: 'left',
          }}
        >
          <span style={{
            width: 52, height: 52, borderRadius: 11, flexShrink: 0, position: 'relative',
            overflow: 'hidden', display: 'grid', placeItems: 'center',
            background: (portada || misVideos.length) ? '#0E1015' : pc + '14',
          }}>
            {(portada || misVideos.length > 0) ? (
              <>
                {/* Sin foto de portada vale el primer fotograma de su video: el
                    recuadro deja de estar vacío y enseña el ejercicio de verdad. */}
                <Portada
                  foto={portada}
                  video={misVideos[0]?.url}
                  style={{ position: 'absolute', inset: 0 }}
                />
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
              <span style={{ fontSize: 15, fontWeight: 800, color: LT.text3, ...NUM_STYLE }}>{num}</span>
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

      {/* Pie de la fila: lo anotado y la puerta al historial.

          ANTES iban aquí dos ruedas de + y − dentro de la lista. Andrés, 17 sep
          2026: "mira lo saturada que se ve" comparada con la app que usa de
          referencia, donde la fila es miniatura, nombre y dos etiquetas, y lo
          que se anota se anota al abrir el ejercicio. La fila vuelve a tener la
          altura de una fila; anotar es tocarla. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        gap: 10, marginTop: 9, paddingTop: 9, borderTop: `1px solid ${LT.border}`,
      }}>
        {anotado ? (
          <span style={{
            fontSize: 12, fontWeight: 800, color: LT.blue, background: LT.blueSoft,
            padding: '4px 9px', borderRadius: 7, ...NUM_STYLE,
          }}>
            Hoy: {anotado}
          </span>
        ) : (
          <span style={{ fontSize: 12, fontWeight: 600, color: LT.text3 }}>Sin anotar</span>
        )}

        <button
          type="button"
          onClick={() => setProgresoAbierto(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0, flexShrink: 0,
            border: 'none', background: 'transparent', padding: 0, cursor: 'pointer',
            fontFamily: FONT, fontSize: 12, fontWeight: 700, color: LT.blue, ...NUM_STYLE,
          }}
        >
          <LineChartIcon size={13} style={{ flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {pesoAnterior ? `Antes: ${pesoAnterior}` : 'Mi progreso'}
          </span>
        </button>
      </div>

      {progresoAbierto && (
        <TarjetaProgreso
          nombre={ex.name}
          historial={historial}
          unidad={unidad}
          onCerrar={() => setProgresoAbierto(false)}
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

const SetGroup = ({ group, setNum, phaseColor, sessionData, sessionKey, onUpdate, oneRMs, sessionsData }) => {
  /* La ficha del ejercicio vive AQUI y no en cada fila, porque para decir
     "Guardar y siguiente" hay que saber cual es el siguiente — y una fila solo
     se conoce a si misma. La serie si conoce a todos sus miembros. */
  const [fichaEn, setFichaEn] = useState(null);
  const { phases: planCompleto, resolveExercise, medias, kind } = usePlan();
  const { perfil: profile } = usePerfilDeLaVista();
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
        {rondasQueDecir(rondas) && (
          <span style={{ fontSize: 12.5, color: LT.text2, fontWeight: 600, flexShrink: 0, ...NUM_STYLE }}>
            Se repite {rondasQueDecir(rondas)} veces
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
              sessionData={sessionData} sessionKey={sessionKey} sessionsData={sessionsData}
              onAbrirFicha={() => setFichaEn(i)}
            />
          </div>
        ))}
      </div>

      {fichaEn !== null && group.exercises[fichaEn] && (() => {
        const { ex, idx } = group.exercises[fichaEn];
        const rep = resolveExercise(ex);
        return (
          <FichaEjercicio
            ex={ex}
            exData={sessionData?.exercises?.[idx] || {}}
            onUpdate={(d) => onUpdate(idx, d)}
            sessionsData={sessionsData}
            sessionKey={sessionKey}
            kind={kind}
            oneRMs={oneRMs}
            plan={planCompleto}
            repertoire={rep || { name: ex.name }}
            medias={medias}
            perfil={profile}
            serie={setNum}
            posicion={fichaEn + 1}
            total={group.exercises.length}
            onCerrar={() => setFichaEn(null)}
            onSiguiente={() => setFichaEn(fichaEn + 1)}
            onOmitir={() => setFichaEn(fichaEn + 1)}
          />
        );
      })()}
    </div>
  );
};


// Helper: get summary info for a day (count of exercises, intensity, etc.)
const getDaySummary = (day, week, dayIdx) => {
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
      // Con `week`, un bloque "repite la del lunes" cuenta los ejercicios que enseña.
      const propios = week ? ejerciciosDelBloque(week, dayIdx, blk) : (blk.type === 'lift' ? blk.exercises : null);
      if (propios && propios.length) {
        const real = propios.filter(e => !e.isNote);
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

/**
 * El programa completo, abierto encima de la pantalla.
 *
 * POR QUÉ REEMPLAZÓ A TRES PANTALLAS. Andrés, 17 sep 2026: "me disgusta
 * bastante este proceso de navegar entre las fases y entre las semanas". Eran
 * tres niveles para llegar a un sitio que la app ya sabe cuál es. Eligió la
 * maqueta A el 18 sep, y el 24 sep dijo que es "mi forma favorita de ver
 * cualquier plan".
 *
 * Desde el 24 sep esto es solo la caja (`HojaFlotante`: card en compu,
 * pantalla completa en el teléfono) con el navegador compartido dentro
 * (`NavegadorDelPlan`), que es la misma pieza que usa el coach. Así ver un
 * plan es igual en cualquier parte de la app.
 *
 * `aqui` es donde va el atleta DE VERDAD y `viendo` lo que tiene abierto.
 * Antes la hoja recibía la fase de lo que se miraba y la llamaba "aquí vas":
 * en cuanto uno abría otro día, la marca se iba detrás de él.
 */
const HojaDelPrograma = ({ sessionsData, aqui, viendo, onIr, onCerrar }) => {
  const { phases: PLAN, planMeta, kind } = usePlan();
  const idDeSesion = useIdDeSesion();

  const semanasTotales = PLAN.reduce((s, f) => s + (f.weekData?.length || 0), 0);
  const iAqui = PLAN.findIndex((f) => f.id === aqui?.faseId);
  const semanasHasta = iAqui < 0 ? null
    : PLAN.slice(0, iAqui).reduce((s, f) => s + (f.weekData?.length || 0), 0)
      + Math.max(1, (PLAN[iAqui].weekData ?? []).findIndex((w) => w.num === aqui.semana) + 1);

  return (
    <HojaFlotante
      titulo={planMeta?.title || 'Tu programa'}
      subtitulo={kind === 'weekly'
        ? 'Una rutina que se repite cada semana'
        : [pluralS(PLAN.length, 'fase'), pluralS(semanasTotales, 'semana'), semanasHasta ? `vas en la ${semanasHasta}` : null]
          .filter(Boolean).join(' · ')}
      onCerrar={onCerrar}
    >
      <NavegadorDelPlan
        fases={PLAN}
        kind={kind}
        aqui={aqui}
        viendo={viendo}
        // Se abre en lo que se está mirando, con las dos marcas a la vista:
        // "AQUÍ VAS" en tu día y "VIENDO" en el otro.
        abrirEn={viendo ?? aqui}
        hecha={(faseId, semana, dia) => !!sessionsData[idDeSesion(faseId, semana, dia)]?.completed}
        alTocarDia={onIr}
      />
    </HojaFlotante>
  );
};

const WeekDetail = ({
  phase, week, dayIdx, onVerPrograma, sessionsData, updateSession, oneRMs, activeSessionId,
  miDia, onVolverAMiDia, onHacerEsteDia, onDiaVisto,
}) => {
  const idDeSesion = useIdDeSesion();
  const { kind } = usePlan();
  const esRutina = kind === 'weekly';
  const phaseColor = phase.color || LT.blue;
  // Los días OFF no cuentan: no se "completa" un descanso.
  const entrenables = week.days.map((d, idx) => ({ d, idx })).filter(({ d }) => !esDescanso(d));
  const completedCount = entrenables.filter(({ idx }) => sessionsData[idDeSesion(phase.id, week.num, idx)]?.completed).length;

  /* Abre en el día de hoy; si hoy no entrena, en el primero de la semana.
     `dayIdx` gana cuando se llega desde la hoja del programa: ahí la persona
     dijo explícitamente qué día quiere ver. */
  const initialIdx = useMemo(() => {
    if (dayIdx != null && week.days[dayIdx]) return dayIdx;
    const wd = weekdayToday();
    const idx = week.days.findIndex((d) => d.day === wd);
    return idx === -1 ? 0 : idx;
  }, [week, dayIdx]);
  const [selectedIdx, setSelectedIdx] = useState(initialIdx);
  // Lo que se tiene abierto, para que la hoja del programa marque "VIENDO".
  useEffect(() => { onDiaVisto?.(selectedIdx); }, [selectedIdx, onDiaVisto]);
  const [openBlocks, setOpenBlocks] = useState({ 0: true });
  useEffect(() => { setOpenBlocks({ 0: true }); }, [selectedIdx]);

  const selectedDay = week.days[selectedIdx];
  const selectedId = idDeSesion(phase.id, week.num, selectedIdx);
  const sessionData = sessionsData[selectedId] || {};
  const selectedCompleted = !!sessionData.completed;
  const selectedDayName = selectedDay.name || (selectedDay.blocks ? selectedDay.blocks.map(b => b.tag.replace(/^Sesi[óo]n \d+ \([AP]M\): /, '')).join(' + ') : selectedDay.day);
  const cat = tipoDeSesion(selectedDay);
  const summary = useMemo(() => getDaySummary(selectedDay, week, selectedIdx), [selectedDay, week, selectedIdx]);
  /* Sesiones que no son de gimnasio. Probado armando una semana como coach:
     una sesión de velocidad, de recovery o de cancha se escribe con NOTAS
     ("Sprint 6 x 30 yd", "Foam roller 10 min"), porque no son ejercicios del
     repertorio. Esas notas se pintaban como separadores de serie —en
     mayúsculas, azules, 11 px—, así que la sesión entera se leía como una pila
     de títulos sin contenido. Y un día OFF enseñaba "Marcar sesión como
     terminada" sobre una pantalla vacía. */
  const notasDelDia = (selectedDay.exercises || []).filter((e) => e.isNote && e.text);
  const soloNotas = !selectedDay.blocks && (selectedDay.exercises || []).length > 0
    && (selectedDay.exercises || []).every((e) => e.isNote);
  const descansoPuro = esDescanso(selectedDay) && !selectedDay.blocks
    && !(selectedDay.exercises || []).some((e) => !e.isNote);

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
      {/* CABECERA, en cuatro escalones de tamaño.
          Andres: "es justo la cantidad de info, pero el como lo colocas se ve
          sucio, saturado, sin jerarquia, todo revuelto". Tenia razon y el
          motivo era medible: habia tres lineas seguidas de metadatos —volver,
          semana, dia— todas entre 11 y 15 px. Sin diferencia de tamaño no hay
          jerarquia, solo tres rayas de texto que se estorban.

          Ahora cada escalon tiene un tamaño distinto y un solo trabajo:
            11 px gris  -> donde estas (fase, semana, avance)
            21 px negro -> que semana es
            15 px       -> los dias, que es lo unico que se toca
            12 px gris  -> que sesion es la abierta

          UN SOLO ACENTO. Antes convivian el morado de la fase, el verde menta
          y el azul en 200 px de alto. El color de fase se queda arriba, en la
          barra de fases, que es donde identifica algo; aqui manda el azul de
          la app. Los puntos de categoria se quedan porque SI son informacion,
          pero pequeños y sin competir. */}
      {/* Una RUTINA QUE SE REPITE no tiene fases ni semanas que recorrer: su
          "fase" no tiene nombre y siempre es la semana 1 de 1. Antes salía
          "‹ · Semana 1 de 1 · 0/4 días" sin título, y la flecha llevaba a una
          ficha de fase vacía. Ahora dice lo que es: esta semana, y su nombre. */}
      {/* Sin la barra de fases arriba, el botón de la cuenta (fijo, 42 px a la
          derecha) queda a la altura de estas dos líneas: se les deja su hueco. */}
      {/* CABECERA, reordenada el 18 sep 2026 con la maqueta que eligió Andrés.

          ANTES lo primero y más arriba era "‹ Fuerza · Semana 7 de 8", y el
          nombre de la sesión venía después. Él: "lo pusiste hasta arriba como
          si fuera lo más importante". No lo es: lo importante es qué te toca
          hoy. Dónde estás dentro del programa es contexto.

          AHORA el título es la sesión, debajo va una línea gris que dice dónde
          estás y que ya NO se toca, y para moverte por el programa está la
          hoja que se abre desde el final de la pantalla. */}
      <h1 style={{
        fontSize: 21, fontWeight: 800, color: LT.text, margin: '0 0 3px',
        lineHeight: 1.15, letterSpacing: -0.4, paddingRight: 52,
      }}>
        {selectedDay.dual ? 'Doble sesión' : selectedDayName}
      </h1>

      <div style={{
        fontSize: 11.5, fontWeight: 700, color: LT.text3, marginBottom: 12,
        letterSpacing: 0.2, paddingRight: 52, ...NUM_STYLE,
      }}>
        {esRutina
          ? `Esta semana · ${completedCount}/${pluralS(entrenables.length, 'día')}`
          : `${phase.name || phase.fullName} · ${phase.mode === 'microcycle' ? 'Microciclo' : `Semana ${week.num} de ${phase.weeks}`} · ${completedCount}/${pluralS(entrenables.length, 'día')}`}
      </div>

      {week.emph && (
        <div style={{
          marginBottom: 12, borderLeft: `3px solid ${LT.warning}`, fontSize: 13,
          color: LT.text, lineHeight: 1.55, padding: '8px 13px',
          background: LT.warning + '0D', borderRadius: '0 8px 8px 0',
        }}>
          {week.emph}
        </div>
      )}

      {/* LA TIRA DE DÍAS, con la fecha de verdad.

          Antes eran pestañas con el nombre del día y un subrayado. Andrés pidió
          la de la app que usa de referencia: fina, sin tarjetas, el día arriba,
          el número abajo, y el de hoy con un círculo relleno. El número importa
          porque el atleta piensa en "el 17", no en "el miércoles".

          Salen los SIETE días, no solo los que entrena: así se ve de un vistazo
          cuántos descansos hay. Los días sin sesión no se pueden tocar. */}
      <div style={{ display: 'flex', marginBottom: 14, borderBottom: `1px solid ${LT.border}`, paddingBottom: 2 }}>
        {diasDeEstaSemana().map(({ clave, numero, esHoy }) => {
          const cuales = week.days.map((d, idx) => ({ d, idx })).filter((x) => x.d.day === clave);
          const primero = cuales[0];
          const hay = !!primero;
          const seleccionado = hay && cuales.some((x) => x.idx === selectedIdx);
          const hecho = hay && cuales.every((x) => sessionsData[idDeSesion(phase.id, week.num, x.idx)]?.completed);
          // La que dejó a medias: el punto lleva un anillo, como antes.
          const empezada = hay && cuales.some((x) => activeSessionId === idDeSesion(phase.id, week.num, x.idx));
          const dcat = hay ? tipoDeSesion(primero.d) : null;
          const descanso = hay && cuales.every((x) => esDescanso(x.d));

          return (
            <button
              key={clave}
              type="button"
              disabled={!hay}
              onClick={() => hay && setSelectedIdx(primero.idx)}
              style={{
                flex: 1, minWidth: 0, border: 'none', background: 'transparent',
                cursor: hay ? 'pointer' : 'default', fontFamily: FONT,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                padding: '2px 0 9px',
              }}
            >
              <span style={{
                fontSize: 11, fontWeight: seleccionado ? 800 : 600,
                color: seleccionado ? LT.blue : (esHoy ? LT.text2 : LT.text3),
              }}>
                {clave}
              </span>
              <span style={{
                width: 27, height: 27, borderRadius: 14, display: 'grid', placeItems: 'center',
                background: seleccionado ? LT.blue : 'transparent',
                fontSize: 13.5, fontWeight: seleccionado || esHoy ? 800 : 600,
                color: seleccionado ? '#fff' : (hay ? LT.text : LT.text4),
                border: !seleccionado && esHoy ? `1.5px solid ${LT.borderHi}` : '1.5px solid transparent',
                ...NUM_STYLE,
              }}>
                {numero}
              </span>
              {/* La marca de abajo: hecha, pendiente, o nada si no entrena. */}
              <span style={{ display: 'grid', placeItems: 'center', width: 12, height: 10 }}>
                {hecho ? (
                  <Check size={11} strokeWidth={3.5} style={{ color: LT.mint }} />
                ) : hay && !descanso ? (
                  <span
                    title={empezada ? 'La dejaste empezada' : undefined}
                    style={{
                      width: 5, height: 5, borderRadius: 3,
                      background: seleccionado ? LT.blue : dcat.c,
                      boxShadow: empezada && !seleccionado ? `0 0 0 2.5px ${LT.blue}44` : 'none',
                    }}
                  />
                ) : null}
                {cuales.length > 1 && (
                  <span style={{ position: 'absolute', marginTop: -18, marginLeft: 20, fontSize: 9, fontWeight: 800, color: LT.text3 }}>
                    {cuales.length}
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* ESTÁS VIENDO OTRO DÍA.
          Andrés, 24 sep 2026: "si te metes a ver algún otro día pierdes la
          noción de que si ese día que estás viendo es donde vas o es otro que
          seleccionaste, o qué pasa si quiere mover el día". Eligió que "mover
          el día" signifique "hoy hago este otro".

          Sale solo cuando lo abierto no es tu día de hoy, y ofrece las dos
          salidas: volver al tuyo, o quedarte con este. Quedarse lo cambia de
          verdad —la portada pasa a decir que hoy te toca este— y solo por hoy:
          mañana vuelve a mandar el calendario. */}
      {!esDescanso(selectedDay) && !(miDia && miDia.phase.id === phase.id
        && miDia.week.num === week.num && miDia.dayIdx === selectedIdx) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          background: LT.surface, border: `1.5px solid ${LT.borderHi}`, borderRadius: 14,
          padding: '11px 13px', marginBottom: 14,
        }}>
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: LT.text }}>
              Estás viendo {weekdayLabel(selectedDay.day)}
              {miDia && miDia.week.num !== week.num ? ` · Semana ${week.num}` : ''}
              {miDia && miDia.phase.id !== phase.id ? ` de ${phase.name}` : ''}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: LT.text3, marginTop: 2 }}>
              {miDia
                ? `Hoy te toca: ${miDia.day?.name
                  || (miDia.day?.blocks || []).map((b) => nombreDeSesion(b.tag)).filter(Boolean).join(' + ')
                  || tipoDeSesion(miDia.day).label}`
                : 'Hoy no tienes sesión.'}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 7, flexShrink: 0 }}>
            {miDia && (
              <button
                type="button"
                onClick={onVolverAMiDia}
                style={{
                  padding: '9px 13px', borderRadius: 11, cursor: 'pointer', touchAction: 'manipulation',
                  border: `1.5px solid ${LT.border}`, background: LT.bg, color: LT.text,
                  fontFamily: FONT, fontSize: 13, fontWeight: 800,
                }}
              >
                Volver a mi día
              </button>
            )}
            <button
              type="button"
              onClick={() => onHacerEsteDia?.(phase.id, week.num, selectedIdx)}
              style={{
                padding: '9px 13px', borderRadius: 11, cursor: 'pointer', touchAction: 'manipulation',
                border: 'none', background: LT.blue, color: '#fff',
                fontFamily: FONT, fontSize: 13, fontWeight: 800,
              }}
            >
              Hacer este día
            </button>
          </div>
        </div>
      )}

      {/* Qué sesión es. Una línea, no una tarjeta.
          Antes esto era un bloque de ~150 px con el nombre, un círculo para
          marcarla terminada, y dos cifras (ejercicios e intensidad) que ya
          están abajo, ejercicio por ejercicio. Ocupaba media pantalla para
          repetir lo que venía después. */}
      <div style={{
        display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '2px 8px',
        padding: '0 3px', marginBottom: 12,
      }}>
        {/* El NOMBRE ya no va aquí: desde el 18 sep es el título de arriba.
            Lo que queda es de qué tipo es y de qué tamaño. */}
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: cat.c, flexShrink: 0 }} />
        <span style={{ fontSize: 12.5, color: LT.text3, fontWeight: 600, ...NUM_STYLE }}>
          {[
            cat.label,
            summary.exCount > 0 && plural(summary.exCount, 'ejercicio', 'ejercicios'),
            summary.mainIntensity,
          ].filter(Boolean).join(' · ')}
        </span>
        {selectedDay.dual && (
          <span style={{ fontSize: 11, color: LT.warning, fontWeight: 800 }}>AM y PM abajo</span>
        )}
        {selectedCompleted && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11.5, color: LT.mint, fontWeight: 800,
          }}>
            <Check size={13} strokeWidth={3} /> Terminada
          </span>
        )}
      </div>

      {/* Las notas de un descanso pueden venir de dos sitios: renglones de nota
          dentro de `exercises` (lo que escribe el editor de hoy) o la lista
          `notes` del plan original. El plan de Andrés tiene dos días OFF y los
          dos usan la segunda: "Descanso activo" con "Caminata Z1 30 min".

          Si el coach escribió algo, SE ENSEÑA LO SUYO y no el texto genérico.
          "Hoy no toca entrenar" encima de "Caminata Z1 30 min" se contradice. */}
      {descansoPuro && (() => {
        const lineas = [...(selectedDay.notes || []), ...notasDelDia.map((n) => n.text)];
        return (
          <div style={{ background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 16, padding: 18, marginBottom: 14 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: LT.text }}>Día de descanso</div>
            {lineas.length > 0 ? (
              <ul style={{ listStyleType: 'disc', margin: '10px 0 0', paddingLeft: 18, color: LT.text, fontSize: 14, lineHeight: 1.65 }}>
                {lineas.map((n, i) => <li key={i}>{n}</li>)}
              </ul>
            ) : (
              <div style={{ fontSize: 13.5, color: LT.text2, marginTop: 4, lineHeight: 1.5 }}>
                Hoy no toca entrenar. Recuperar también es parte del plan.
              </div>
            )}
          </div>
        );
      })()}

      {/* Una sesión hecha solo de notas se lee como lista de instrucciones, igual
          que las sesiones de velocidad del plan original. */}
      {!descansoPuro && soloNotas && (
        <div style={{ background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 16, padding: '14px 16px', marginBottom: 14 }}>
          <ul style={{ listStyleType: 'disc', margin: 0, paddingLeft: 18, color: LT.text, fontSize: 14.5, lineHeight: 1.7 }}>
            {notasDelDia.map((n, i) => <li key={i}>{n.text}</li>)}
          </ul>
        </div>
      )}

      {/* Ejercicios agrupados en sets */}
      {selectedDay.exercises && !soloNotas && !descansoPuro && (() => {
        const groups = groupIntoSets(selectedDay.exercises);
        let setNum = 0;
        return groups.map((g, gi) => {
          if (!g.isNote) setNum += 1;
          return (
            <SetGroup key={`${selectedIdx}-${gi}`} group={g} setNum={setNum} phaseColor={phaseColor}
              sessionData={flatSessionData} sessionKey={selectedId}
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
        /* AM y PM con colores FIJOS y opuestos: naranja de mañana, azul de tarde.
           Antes la tarde tomaba el color de la fase, y en Potencia la fase es
           naranja: las dos sesiones del día salían del mismo color. Andrés lo
           vio en su jueves y no se distinguía cuál era cuál. */
        const accent = hasPeriod ? (isPM ? LT.blue : LT.warning) : phaseColor;
        const repite = blk.type === 'note' ? bloqueQueRepite(week, selectedIdx, blk) : null;
        const ejerciciosVistos = ejerciciosDelBloque(week, selectedIdx, blk);
        const exN = ejerciciosVistos.length ? ejerciciosVistos.filter(e => !e.isNote).length : null;
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
                        sessionData={blkSessionData} sessionKey={selectedId}
                        onUpdate={(idx, data) => setExerciseData(bi, idx, data)}
                        oneRMs={oneRMs} sessionsData={sessionsData} />
                    );
                  });
                })()}
                {blk.type === 'speed' && (
                  <ul style={{ listStyleType: 'disc', margin: '4px 0 0', paddingLeft: 16, color: LT.text2, fontSize: 14, lineHeight: 1.7 }}>
                    {blk.bullets.map((b, i) => (
                      <li key={i} style={typeof b === 'object' && b.bold ? { color: LT.text, fontWeight: 600 } : {}}>
                        {typeof b === 'object' ? b.text : b}
                      </li>
                    ))}
                  </ul>
                )}
                {blk.type === 'note' && repite && (
                  /* "Repite la sesión del lunes": se enseñan AQUÍ los ejercicios de
                     esa sesión, para verlos y anotar los pesos de hoy. Se guardan con
                     la llave de este día, así que no pisan lo que anotó el lunes. */
                  <>
                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '2px 0 14px', fontSize: 13, color: LT.text2, lineHeight: 1.5 }}>
                      <Repeat size={15} style={{ color: accent, flexShrink: 0, marginTop: 2 }} />
                      <span>
                        <b style={{ color: LT.text }}>Igual que el {weekdayLabel(repite.day.day).toLowerCase()}.</b>{' '}
                        {blk.text}
                      </span>
                    </div>
                    {(() => {
                      const groups = groupIntoSets(repite.blk.exercises);
                      let setNum = 0;
                      return groups.map((g, gi) => {
                        if (!g.isNote) setNum += 1;
                        return (
                          <SetGroup key={gi} group={g} setNum={setNum} phaseColor={phaseColor}
                            sessionData={blkSessionData} sessionKey={selectedId}
                            onUpdate={(idx, data) => setExerciseData(bi, idx, data)}
                            oneRMs={oneRMs} sessionsData={sessionsData} />
                        );
                      });
                    })()}
                  </>
                )}
                {blk.type === 'note' && !repite && (
                  <div style={{ padding: 12, background: LT.bg, border: `1px solid ${LT.border}`, borderRadius: 10, fontSize: 13, color: LT.text2, lineHeight: 1.6 }}>
                    {blk.text}
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}

      {selectedDay.notes && !selectedDay.exercises && !selectedDay.blocks && !descansoPuro && (
        <div style={{ background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
          <ul style={{ listStyleType: 'disc', margin: 0, paddingLeft: 18, color: LT.text2, fontSize: 14, lineHeight: 1.7 }}>
            {selectedDay.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}

      {/* Cerrar la sesión.
          Va justo DEBAJO DEL ÚLTIMO EJERCICIO, que es donde estás cuando
          acabaste. Antes había que subir hasta arriba del todo; luego quedó
          demasiado abajo, detrás de "Notas del día" y "Tus notas" — Andrés:
          "entiendo que te lo pedí escondido, pero no tanto". Escribir las
          notas es opcional y va después; terminar la sesión es el cierre
          natural de la lista.

          Y va discreto a propósito, decisión de Andrés: "mi plan es que ese
          botón no sea indispensable, para nada". No es el objetivo de la
          pantalla —entrenar lo es—, así que no compite con nada. Quien lo
          ignore no pierde nada; quien quiera cerrarla, lo tiene donde acaba. */}
      {/* EL BOTÓN DE TERMINAR TIENE QUE PARECER BOTÓN.
          Era blanco con letra gris y borde gris claro: lo mismo que usa la app
          para lo DESACTIVADO. Andrés: "está muy feo y gris, ni se ve ni parece
          botón". Tenía razón: aunque no sea indispensable —la semana avanza
          sola con el calendario—, quien SÍ quiere cerrar su sesión tiene que
          encontrarlo al primer vistazo.

          Por eso va relleno de azul, con su palomita. Sigue al FINAL de la lista
          y no arriba: no compite con entrenar, que es a lo que se viene.

          Hecha, se pinta de verde entero —se lee "listo" desde lejos— y
          "Deshacer" va aparte y chico. Antes estaba pegado al mismo texto
          ("Sesión terminada · deshacer") y no se distinguía qué parte se tocaba. */}
      {(selectedDay.exercises || selectedDay.blocks) && !descansoPuro && (
        selectedCompleted ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
            <div style={{
              flex: 1, minHeight: 52, borderRadius: 14, background: LT.mint, color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
              fontFamily: FONT, fontSize: 15, fontWeight: 800,
            }}>
              <Check size={18} strokeWidth={3} /> Sesión terminada
            </div>
            <button
              type="button"
              onClick={toggleComplete}
              style={{
                minHeight: 52, padding: '0 14px', borderRadius: 14, cursor: 'pointer',
                border: `1.5px solid ${LT.border}`, background: LT.surface, color: LT.text2,
                fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
              }}
            >
              Deshacer
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={toggleComplete}
            className="kp-press"
            style={{
              width: '100%', minHeight: 52, marginBottom: 14, borderRadius: 14, border: 'none',
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
              cursor: 'pointer', fontFamily: FONT, fontSize: 15, fontWeight: 800, color: '#fff',
              background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, boxShadow: KP.shBtn,
            }}
          >
            <Check size={18} strokeWidth={3} /> Marcar sesión como terminada
          </button>
        )
      )}

      {/* En un descanso las notas ya van dentro de su tarjeta: aquí se repetían.
          Pasaba en los dos días OFF del plan de Andrés, porque el plan llega con
          `exercises: []` y un arreglo vacío cuenta como "tiene ejercicios". */}
      {selectedDay.notes && (selectedDay.exercises || selectedDay.blocks) && !descansoPuro && (
        <div style={{ background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: LT.text3, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Notas del día</div>
          <ul style={{ listStyleType: 'disc', margin: 0, paddingLeft: 18, color: LT.text2, fontSize: 13, lineHeight: 1.7 }}>
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

      {/* La puerta al programa completo, al final y en voz baja. Antes era lo
          primero de la pantalla y encima era el camino de vuelta obligatorio;
          ahora abre una hoja encima y no se sale de aquí. */}
      {onVerPrograma && (
        <button
          type="button"
          onClick={onVerPrograma}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 4,
            border: 'none', background: 'transparent', cursor: 'pointer', padding: '6px 2px',
            fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: LT.blue,
          }}
        >
          Ver todo el programa
          <ChevronRight size={14} />
        </button>
      )}
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
  const idDeSesion = useIdDeSesion();
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
                      const entrenables = week.days.map((d, i) => ({ d, i })).filter(({ d }) => !esDescanso(d));
                      const completedCount = entrenables.filter(({ i }) => sessionsData[idDeSesion(phase.id, week.num, i)]?.completed).length;
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
                                {completedCount}/{entrenables.length} completadas · {week.label || ''}
                              </div>
                            </div>
                            {weekExpanded ? <ChevronUp size={14} style={{ color: T.text3 }} /> : <ChevronDown size={14} style={{ color: T.text3 }} />}
                          </button>
                          {weekExpanded && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 0 4px 12px' }}>
                              {enOrdenDeSemana(week.days).map(({ day, idx }) => {
                                const id = idDeSesion(phase.id, week.num, idx);
                                const isDone = !!sessionsData[id]?.completed;
                                const isCurrent = current && current.phaseId === phase.id && current.weekNum === week.num && current.dayIdx === idx;
                                const cat = tipoDeSesion(day);
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

const HomeView = ({ sessionsData, wellness, onStartSession, onGoTab, onVerPrograma, cursor, onChangeCursor }) => {
  /* LAS PROPORCIONES EN COMPU. Andrés, 18 sep 2026: "en teléfono no hay ningún
     problema con HOME, pero en computadora las proporciones están un poco
     raras para los atletas nada más". El diagnóstico, medido en 1440 px: los
     botones son de ancho completo porque en un teléfono eso es lo correcto, y
     aquí "Ver mi plan" acababa midiendo 980 px de ancho por 44 de alto. Una
     banda, no un botón. En compu se les pone tope y se dejan a la izquierda,
     que es donde empieza el texto de su tarjeta. */
  const esCompu = useIsDesktop();
  const tope = esCompu ? { maxWidth: 260 } : null;
  const { phases: PLAN, planMeta, kind } = usePlan();
  const { perfil: profile } = usePerfilDeLaVista();
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
  /* Las NOTAS no son ejercicios. Antes una sesión de velocidad hecha solo de
     tres renglones de nota decía "3 ejercicios · ~55 min": ni tenía ejercicios
     ni nadie había dicho que durara 55 minutos. Sin ejercicios reales no se
     inventa duración; se dice qué tipo de sesión es. */
  const sessionMeta = useMemo(() => {
    if (!next) return { exercises: 0, duration: null };
    const d = next.day;
    const reales = (lista) => (lista || []).filter((e) => !e.isNote).length;
    const tipo = tipoDeSesion(d).label;
    if (d.blocks) {
      const exCount = d.blocks.reduce((s, b) => s + reales(ejerciciosDelBloque(next.week, next.dayIdx, b)), 0);
      return { exercises: exCount, duration: d.dual ? '~2 h' : '~75 min', dual: d.dual };
    }
    const n = reales(d.exercises);
    return { exercises: n, duration: n ? '~55 min' : tipo };
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
                  {[
                    sessionMeta.exercises ? plural(sessionMeta.exercises, 'ejercicio', 'ejercicios') : null,
                    sessionMeta.duration,
                    sessionMeta.dual ? '2 sesiones' : null,
                    // Otra sesión hoy además de esta (mañana y tarde como dos entradas).
                    !sessionMeta.dual && next.sesionesHoy > 1 ? `${next.sesionesHoy} sesiones hoy` : null,
                  ].filter(Boolean).join(' · ')}
                </div>
              </div>
              <div style={{
                background: '#fff', borderRadius: 14, padding: '13px',
                fontSize: 14, fontWeight: 600, color: LT.blue, textAlign: 'center', marginTop: 10,
                ...tope,
              }}>
                {cursorCompleted ? 'Ver detalle' : 'Empezar sesión'}
              </div>
              {/* En una rutina que se repite el día lo decide el calendario, no un
                  puntero: el selector se abría, se elegía un día y no pasaba nada. */}
              {kind !== 'weekly' && (
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); onChangeCursor(); }}
                  style={{
                    display: 'block', width: '100%', border: 'none', cursor: 'pointer', fontFamily: FONT,
                    background: 'rgba(255,255,255,0.15)', borderRadius: 14, padding: '13px',
                    fontSize: 14, fontWeight: 600, color: '#fff', textAlign: 'center', marginTop: 8,
                    ...tope,
                  }}>
                  Cambiar día
                </button>
              )}
            </div>

            {/* Card foto de fase. Desde el 18 sep la ficha de fase ya no
                existe como pantalla: los dos caminos llevan a la semana, y el
                programa completo se consulta desde la hoja. */}
            <div onClick={() => onStartSession(next.phase, next.week, next.dayIdx)}
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

        </>
      ) : (
        /* Sin sesión hoy. Antes esta tarjeta REEMPLAZABA el tablero entero:
           quien descansaba perdía de vista su bienestar, su semana y su
           programa, y la app parecía otra. Ahora solo ocupa el lugar de la
           sesión; lo de abajo se queda. La tira de días tampoco se repite
           aquí: ya está en "Tu semana". */
        <div style={{ padding: '0 18px 12px' }}>
          <div style={{ background: LT.surface, borderRadius: KP.rCard, padding: 22 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: LT.text, lineHeight: 1.2 }}>
              {/* Si el coach puso descanso, se dice descanso: "no tienes rutina
                  asignada" suena a que algo falta, y no falta nada. */}
              {week.days.find((d) => d.isToday)?.descanso ? 'Hoy descansas' : 'Hoy no te toca entrenar'}
            </div>
            <div style={{ marginTop: 8, fontSize: 14, color: LT.text2, lineHeight: 1.5 }}>
              {week.next
                ? `Tu siguiente entrenamiento es el ${weekdayLabel(week.next.key)}${week.next.name ? ` · ${week.next.name}` : ''}.`
                : 'Aún no hay entrenamientos en tu semana.'}
            </div>
            <button
              type="button"
              onClick={() => onGoTab('plan')}
              className="kp-press"
              style={{
                display: 'block', width: '100%', border: 'none', fontFamily: FONT,
                background: LT.blue, borderRadius: 14, padding: '13px', marginTop: 16,
                fontSize: 14, fontWeight: 600, color: '#fff', textAlign: 'center', cursor: 'pointer',
                ...tope,
              }}
            >
              Ver mi plan
            </button>
          </div>
        </div>
      )}

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
          <div style={{ background: LT.surface2, borderRadius: 14, padding: '12px', fontSize: 13, fontWeight: 600, color: LT.text2, textAlign: 'center', marginTop: 14, ...tope }}>
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
        {/* Esta tarjeta es la puerta al programa completo, y tiene que
            fijar el nivel a mano. Antes solo cambiaba de pestaña, así que
            te dejaba en la última pantalla que hubieras visto de "Plan" —
            normalmente tu propio workout, que es justo lo contrario de lo
            que promete. Con la pestaña "Plan" apuntando ahora a tu semana,
            esta es la única forma de ver las fases sin pasar por ahí. */}
        {/* ES UN BOTÓN Y TIENE QUE PARECERLO. Andrés, 18 sep 2026: "acabo de ver
            que sí hay un botón para eso en home, pero creo que podrías
            visualmente mejorarlo un poco para que resalte un poquito más de
            que es un botón". Era una tarjeta blanca igual a las de alrededor,
            con una flechita gris: nada la distinguía de la información que
            solo se lee.

            Y era un `div` con onClick, que además de no parecer botón no lo
            era: con el teclado no se alcanzaba y un lector de pantalla no lo
            anunciaba. Ahora es un <button> de verdad, con borde y con la
            acción escrita en azul a la derecha. */}
        <button
          type="button"
          onClick={onVerPrograma}
          className="kp-press"
          style={{
            width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: FONT,
            background: LT.surface, borderRadius: 22, padding: 16,
            border: `1.5px solid ${LT.blueSoft}`,
            display: 'flex', alignItems: 'center', gap: 14,
          }}
        >
          <span style={{
            width: 52, height: 52, borderRadius: '50%', background: LT.blueSoft,
            display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            color: LT.blue,
          }}><Dumbbell size={22} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontSize: 17, fontWeight: 700, color: LT.text }}>
              {planMeta?.title || 'Mi plan'}
            </span>
            <span style={{ display: 'block', fontSize: 12, color: LT.text2, marginTop: 1 }}>
              {kind === 'weekly'
                ? `Rutina semanal · ${week.trainingDays} ${week.trainingDays === 1 ? 'día' : 'días'}`
                : `${pluralS(PLAN.length, 'fase')} · ${pluralS(PLAN.reduce((s, p) => s + (p.weekData?.length || 0), 0), 'semana')}`}
            </span>
          </span>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
            background: LT.blueSoft, color: LT.blue, borderRadius: 999,
            padding: '8px 11px 8px 13px', fontSize: 13, fontWeight: 800,
          }}>
            Ver <ChevronRight size={15} />
          </span>
        </button>
      </div>
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
  const { perfil: profile } = usePerfilDeLaVista();
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
          <ul style={{ listStyleType: 'disc', paddingLeft: 16 }}>
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
          <ul style={{ listStyleType: 'disc', paddingLeft: 16, marginTop: 0 }}>
            <li>Y-Balance Test bilateral</li>
            <li>Fuerza eversión/inversión/dorsiflexión con dinamómetro</li>
            <li>Knee-to-wall test</li>
          </ul>
          <Caption style={{ marginTop: 14, marginBottom: 6 }}>Trabajo diario · 15-20 min</Caption>
          <ul style={{ listStyleType: 'disc', paddingLeft: 16, marginTop: 0 }}>
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
  const { phases: PLAN, hasPlan, planLoading, kind } = usePlan();
  const esCompu = useIsDesktop();
  const [tab, setTab] = useState('home');
  const [view, setView] = useState({ level: 'week' });
  const [sessionsData, setSessionsData] = useStorage('wr:sessions', {});
  const [oneRMs, setOneRMs] = useStorage('wr:onerm', {});
  const [wellness, setWellness] = useStorage('wr:wellness', {});
  const [storedCursor, setCursor] = useStorage('wr:cursor', null);
  const [cursorPickerOpen, setCursorPickerOpen] = useState(false);
  const [programaAbierto, setProgramaAbierto] = useState(false);

  /* Cursor efectivo: el guardado si sigue siendo válido para este plan; si no,
     el primer día. Y encima, puesto al día con el calendario.

     `cursorAlDia` es lo que arregla el bicho más viejo de la app: el puntero se
     escribía una vez y no lo movía NADIE. `advanceCursor` existía pero no se
     llamaba desde ningún sitio, así que Andrés llevaba semanas viendo "Semana 6
     de 8" y creía que era por no marcar las sesiones. Marcar tampoco lo movía.

     Ahora avanza una semana del plan por cada semana de calendario que pasa. */
  const cursorBase = useMemo(
    () => (isValidCursor(PLAN, storedCursor) ? storedCursor : defaultCursor(PLAN)),
    [PLAN, storedCursor],
  );
  const cursor = useMemo(() => cursorAlDia(PLAN, cursorBase), [PLAN, cursorBase]);

  /* Lo que el calendario adelanta se guarda, para que la próxima vez se cuente
     desde aquí y no desde el sello viejo. Va en un efecto y no en el useMemo
     porque un useMemo que escribe estado se ejecuta dos veces en desarrollo. */
  useEffect(() => {
    if (!cursor) return;
    const a = storedCursor;
    const cambio = !a || a.phaseId !== cursor.phaseId || a.weekNum !== cursor.weekNum
      || a.dayIdx !== cursor.dayIdx || a.fijadoEn !== cursor.fijadoEn;
    if (cambio) setCursor(cursor);
  }, [cursor, storedCursor, setCursor]);

  const cursorSession = useMemo(() => resolveCursor(PLAN, cursor), [PLAN, cursor]);
  // En una rutina que se repite no hay puntero que avance: la sesión activa es la de hoy.
  /* TU DÍA, UNO SOLO PARA TODA LA APP.
     Antes había dos respuestas: la portada ("hoy te toca") miraba tu semana y
     el día del calendario; la pantalla del día miraba tu semana y un día
     guardado aparte que no se movía solo. Por eso "Cambiar día" parecía no
     hacer nada: se elegía el jueves y la portada seguía con el martes.

     Ahora las dos preguntan lo mismo: `sessionForToday`, que usa el calendario
     y, si hoy elegiste otro día, ese. */
  const miDia = useMemo(() => sessionForToday(PLAN, kind, cursor), [PLAN, kind, cursor]);
  const activeSessionId = miDia?.id;

  // Dónde va el atleta, para marcarlo en la hoja: su día de hoy si lo tiene;
  // si hoy descansa, al menos su semana.
  const aqui = miDia
    ? { faseId: miDia.phase.id, semana: miDia.week.num, dia: miDia.dayIdx }
    : cursorSession ? { faseId: cursorSession.phase.id, semana: cursorSession.week.num, dia: null } : null;
  const [diaVisto, setDiaVisto] = useState(null);

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
  /* Elegir día a mano vuelve a sellar el puntero con la semana de hoy.
     Decisión de Andrés: "avanza con el calendario pero si quieres regrésalo,
     puedes". Sin volver a sellar, el calendario le pisaría la elección al
     instante y parecería que el selector no hace nada. */
  const handleSelectCursor = useCallback((phaseId, weekNum, dayIdx) => {
    // `diaElegidoEl`: el día elegido manda solo HOY. Ver `sessionForToday`.
    setCursor({ phaseId, weekNum, dayIdx, fijadoEn: isoWeekKey(), diaElegidoEl: claveDeDia() });
    setCursorPickerOpen(false);
  }, [setCursor]);

  /* Tocar "Plan" te deja en TU semana, no en la lista de las 9 fases.
     Andrés: "cuando le pico a Plan todavía tengo que escoger la fase y luego
     la semana". Eran 3 toques para llegar a un sitio que la app ya sabe cuál
     es: el puntero dice exactamente en qué fase y semana vas.

     Explorar el programa sigue estando: la flecha de arriba sube a la fase, y
     de ahí a todas. Se invierte quién paga el precio — antes lo pagaba el que
     entrena todos los días, ahora el que quiere curiosear el plan entero. */
  /* La pestaña "Plan" SIEMPRE cae en una semana concreta.

     Desde el 18 sep las fases y las semanas dejaron de ser pantallas: son una
     hoja que se abre encima. Así que esta función ya no puede devolver "la
     lista de fases" — si lo hiciera, la pestaña se quedaría en blanco.

     El orden: la semana del puntero (donde vas), y si el puntero todavía no
     existe o apunta a un plan viejo, la primera semana del plan. */
  const vistaDelPlan = useCallback(() => {
    if (cursorSession && kind !== 'weekly') {
      return { level: 'week', phase: cursorSession.phase, week: cursorSession.week };
    }
    const fase = (PLAN ?? [])[0];
    const semana = fase?.weekData?.[0];
    if (semana) return { level: 'week', phase: fase, week: semana };
    return { level: 'week' };   // sin plan asignado no hay semana a la que ir
  }, [cursorSession, kind, PLAN]);

  // From Home or anywhere: jump directly to the week view (selected day handled internally)
  // No recibe el día a propósito: la vista de semana ya resalta el que toca.
  const startSession = (phase, week) => {
    setTab('plan');
    setView({ level: 'week', phase, week });
  };
  /* Cambiar de pestaña desde el tablero. La pestaña "Plan" además coloca la
     vista: sin esto, "Ver mi plan" te dejaba donde estuviera `view`, que recién
     abierta la app es la lista de fases. El atleta pedía su plan y le salía un
     índice. */
  const vasA = (t) => { setTab(t); if (t === 'plan') setView(vistaDelPlan()); };

  let content;
  if (planLoading && (tab === 'home' || tab === 'plan')) {
    content = <PlanLoadingState />;
  } else if (!hasPlan && (tab === 'home' || tab === 'plan')) {
    content = <NoPlanState onGoTab={vasA} />;
  } else if (tab === 'home') {
    content = <HomeView sessionsData={sessionsData} wellness={wellness}
      onStartSession={startSession}
      onGoTab={vasA}
      onVerPrograma={() => setProgramaAbierto(true)}
      cursor={cursor}
      onChangeCursor={() => setCursorPickerOpen(true)} />;
  } else if (tab === 'plan') {
    /* Una sola pantalla: el DÍA. Las fases y las semanas ya no son pantallas
       por las que se navega, son una hoja que se abre encima (maqueta A, la
       que eligió Andrés el 18 sep 2026). */
    content = view.week ? (
      <WeekDetail
        key={`${view.phase?.id}-${view.week?.num}-${view.salto ?? 0}`}
        phase={view.phase} week={view.week} dayIdx={view.dayIdx}
        onVerPrograma={() => setProgramaAbierto(true)}
        sessionsData={sessionsData} updateSession={updateSession} oneRMs={oneRMs}
        activeSessionId={activeSessionId}
        miDia={miDia}
        onDiaVisto={setDiaVisto}
        onHacerEsteDia={handleSelectCursor}
        onVolverAMiDia={() => miDia && setView((v) => ({
          level: 'week', phase: miDia.phase, week: miDia.week, dayIdx: miDia.dayIdx, salto: (v.salto ?? 0) + 1,
        }))} />
    ) : <PlanLoadingState />;
  } else if (tab === 'wellness') {
    content = <WellnessView wellness={wellness} setWellness={setWellness} />;
  } else if (tab === 'oneRM') {
    content = <OneRMView oneRMs={oneRMs} setOneRMs={setOneRMs} />;
  } else if (tab === 'science') {
    content = <ScienceView />;
  }

  return (
    <div style={{
      minHeight: 'calc(100svh - var(--aviso-vista, 0px))', background: T.bg, color: T.text,
      fontFamily: FONT,
      WebkitFontSmoothing: 'antialiased', MozOsxFontSmoothing: 'grayscale',
    }}>
      {/* En compu el contenido se centra y deja de estirarse hasta 1272px. Una
          tarjeta de ese ancho obliga a barrer la pantalla con los ojos de una
          orilla a la otra para leer una linea. 980 es ancho de lectura. */}
      <div style={esCompu ? { maxWidth: 980, margin: '0 auto', width: '100%' } : undefined}>
        {content}
      </div>
      <BottomNav active={tab} onChange={vasA} />
      {cursorPickerOpen && (
        <CursorSelector
          // Resalta tu día DE HOY, el mismo que dice la portada — no un día
          // guardado de hace semanas.
          current={aqui ? { phaseId: aqui.faseId, weekNum: aqui.semana, dayIdx: aqui.dia } : cursor}
          sessionsData={sessionsData}
          onSelect={handleSelectCursor} onClose={() => setCursorPickerOpen(false)} />
      )}
      {programaAbierto && hasPlan && (
        <HojaDelPrograma
          sessionsData={sessionsData}
          aqui={aqui}
          viendo={tab === 'plan' && view.week ? { faseId: view.phase?.id, semana: view.week.num, dia: diaVisto } : null}
          onIr={(fase, semana, dayIdx) => {
            setTab('plan');
            setView((v) => ({ level: 'week', phase: fase, week: semana, dayIdx, salto: (v.salto ?? 0) + 1 }));
            setProgramaAbierto(false);
          }}
          onCerrar={() => setProgramaAbierto(false)}
        />
      )}
    </div>
  );
}
