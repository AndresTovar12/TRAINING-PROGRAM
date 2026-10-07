import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  ChevronRight, ChevronLeft, ChevronDown, ChevronUp, Calendar,
  Check, X, Calculator, BookOpen, TrendingUp, Edit3, Target,
  Clock, Sparkles, Info, Dumbbell, Heart, Play,
  Home as HomeIcon,
  Repeat, Eye, Layers, List, Scale, LineChart as LineChartIcon,
  Sunrise, Sunset, MessageCircle,
} from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip, ReferenceLine } from 'recharts';
import { useIsDesktop } from '@/lib/useViewport';
import { T, FONT, NUM_STYLE, LT, tipoDeSesion, KP, eyebrow } from '@/lib/theme';
import { usePlan, ComoPrograma } from '@/contexts/PlanContext';
import { usePerfilDeLaVista } from '@/contexts/VistaContext';
import {
  sessionIdFor, calc1RM, today, greeting, isLoadedExercise,
  resolveCursor, defaultCursor, isValidCursor, findPreviousWeight, historialDePeso,
  formatIntensity,
  sessionForToday, weekOverview, weekdayToday, weekdayLabel,
  cursorAlDia, isoWeekKey, esDescanso, enOrdenDeSemana,
  diasDeEstaSemana, claveDeDia, dondeVa,
  semanaGlobal, semanasDelPlan,
} from '@/lib/training-utils';
import HojaFlotante from '@/components/HojaFlotante';
import CienciaDelPlan from '@/features/training/CienciaDelPlan';
import { TarjetaDeSalud, CintaDeCiencia } from '@/features/training/TarjetasDeHome';
import { programasConCiencia } from '@/lib/ciencia';
import NavegadorDelPlan from '@/components/NavegadorDelPlan';
import { aKilos, desdeKilos, etiquetaUnidad } from '@/lib/unidades';
import { portadaParaAtleta, videosParaAtleta } from '@/lib/videos';
import { useAppState, useStorage } from '@/contexts/AppStateContext';
import { altaReciente } from '@/lib/comoVa';
import { FiltroDeAutor, EtiquetaDeAutor, TarjetaDeHoyDeTodos } from '@/features/training/EquipoDelAtleta';
import AvisoDeInvitacion from '@/features/training/AvisoDeInvitacion';
import {
  autorDe, autoresDe, entradasDeHoy, escribeRegistro, etiquetaDePrograma, nombreCorto, registrosDe,
  normalizaDia, resumenDeLaSemana, semanaUnificada,
} from '@/lib/programas';
import FichaEjercicio from '@/features/training/FichaEjercicio';
import Portada from '@/components/Portada';
import EtiquetasDeSesion from '@/components/EtiquetasDeSesion';
import BotonEntendido from '@/components/BotonEntendido';
import {
  minutosDelNombre, sinDuracion, sesionesDelTitulo, textoDeSesiones,
  hermanasDelDia, juntaPorDia, sesionQueRepite,
} from '@/lib/sesiones';
import { setTag } from '@/lib/setsDeUnaSesion';
import { plural, pluralS, rondasQueDecir } from '@/lib/plural';
import { textoMeta, cargaEnSuUnidad } from '@/lib/medidas';
import {
  formatoDeMiembros, expande, resumenDeFormato, textoDeResultado, tramosDeTrabajo,
} from '@/lib/formatos';
import { LEVANTAMIENTOS, cargaPorPorcentaje } from '@/lib/cargaPorcentaje';
import { vueltasDe, ejercicioDeVuelta, vueltasAnotadas } from '@/lib/porVuelta';
import RelojDelBloque from '@/features/training/RelojDelBloque';
import ResultadoDelBloque from '@/features/training/ResultadoDelBloque';
import { useAuth } from '@/contexts/AuthContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { esArranque, guardaLugar, leeLugar } from '@/lib/lugar';
import { useLugar, useScrollLugar } from '@/lib/useLugar';

/* Las pestañas de la app del atleta. Sirve para desconfiar de la que se guardó al refrescar: una pestaña que
   ya no existe (antes había también 'wellness', 'oneRM' y 'science') dejaría la pantalla en blanco.

   Andrés, 7 oct 2026: la barra de abajo pasa de cinco botones a tres (Home · Entrenar · Mensajes). Bienestar,
   1RM y Ciencia ya no son pestañas: son tarjetas de Home que se abren como hoja encima (`hoja`). Los pacientes
   de un fisio no calculan 1RM: eso es de quien levanta pesas (Andrés, 29 sep 2026); sus datos de 1RM, si los
   hubiera, no se borran. */
const PESTANAS = ['home', 'plan', 'messages'];

// Texto fijo que cambia con el oficio de quien atiende (ver `lib/palabras.js`),
// para los componentes que se escriben sin cuerpo y no tienen dónde llamar al hook.
const Palabra = ({ children }) => {
  const { t } = usePalabras();
  return t(children);
};
// Lo que solo tiene sentido si NO atiende un fisio (el 1RM).
const Sin1RM = ({ children }) => {
  const { salud } = usePalabras();
  return salud ? null : children;
};

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

const ExerciseRow = ({ ex, idx, num, sessionData, sessionKey, sessionsData, phaseColor, onAbrirFicha, oneRMs }) => {
  const { phases: PLAN, resolveExercise, medias, kind } = usePlan();
  const { perfil: profile } = usePerfilDeLaVista();
  const { salud } = usePalabras();
  const unidad = profile?.unidad_peso || 'kg';
  const u = etiquetaUnidad(unidad);
  // Cuando el plan dice «75%», los kilos que son (de SU 1RM). Los pacientes de un fisio no tienen 1RM.
  const kilosDe = (e) => { const c = salud ? null : cargaPorPorcentaje(e, oneRMs, unidad); return c && !c.falta ? c.texto : null; };
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
  // Un peso fijo («20 kg») se ve en la unidad de quien entrena; lo demás, como lo escribió el coach.
  const cargaQueDecir = (e) => cargaEnSuUnidad(e, unidad) ?? formatIntensity(e.intensity);
  /* CUANDO CAMBIA DE UNA VUELTA A OTRA (10 al 60 %, 8 al 70 %…), cada vuelta va en SU renglón, con su
     número delante. Nunca en una sola línea «10-8-6-4»: así se escribe un drop set (Andrés, 5 oct 2026). */
  const vueltas = vueltasDe(ex);
  // El descanso lo escribe el coach en el editor de sesión. Antes lo adivinaba
  // `inferRest` leyendo el nombre del ejercicio, y el atleta lo leía como si
  // fuera una indicación de su entrenador. Si el coach no lo puso, no se
  // muestra nada: inventarle un descanso es peor que no darle ninguno.
  const rest = (ex.descanso || '').trim() || null;

  /* Los datos se pintan SOLO si el coach los puso. Nada de "—" ni de campos
     vacíos esperando: si no configuró la intensidad o el descanso, esa línea
     no existe. Petición de Andrés, y es lo correcto — un hueco vacío se lee
     como un fallo de la app. */
  const chips = (vueltas ? [rest] : [textoMeta(ex), cargaQueDecir(ex) || null, rest || null]).filter(Boolean);
  const kilos = vueltas ? null : kilosDe(ex);

  const pesoAnterior = showWeightInput && previous
    ? `${desdeKilos(previous.weight, unidad)} ${u}` : null;

  // Lo que ya quedó anotado hoy, en una línea. Vacío = todavía no hay nada. Con vueltas distintas: cuántas
  // lleva y la más pesada (que es el resumen que guarda el ejercicio).
  const hechas = vueltas ? vueltasAnotadas(exData, vueltas.length) : 0;
  const anotado = (vueltas
    ? [hechas ? `${hechas} de ${vueltas.length} vueltas` : null, exData.weight ? `${desdeKilos(exData.weight, unidad)} ${u}` : null]
    : [
      exData.repsHechas ? `${exData.repsHechas} ${exData.repsHechas === '1' ? 'rep' : 'reps'}` : null,
      exData.weight ? `${desdeKilos(exData.weight, unidad)} ${u}` : null,
    ]).filter(Boolean).join(' · ');

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
                  desde={misVideos[0]?.inicio}
                  hasta={misVideos[0]?.fin}
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
            {vueltas && (
              <span style={{ display: 'block', marginTop: 5 }}>
                {vueltas.map((f, j) => {
                  const deLaVuelta = ejercicioDeVuelta(ex, f);
                  const queHacer = [textoMeta(deLaVuelta), cargaQueDecir(deLaVuelta)].filter(Boolean).join(' · ');
                  const susKilos = kilosDe(deLaVuelta);
                  return (
                    <span key={j} style={{ display: 'flex', alignItems: 'baseline', gap: 8, padding: '2.5px 0', fontSize: 13, lineHeight: 1.35, ...NUM_STYLE }}>
                      <span style={{ width: 12, flexShrink: 0, textAlign: 'center', fontSize: 11.5, fontWeight: 800, color: LT.text3 }}>{j + 1}</span>
                      <span style={{ fontWeight: 600, color: LT.text2 }}>
                        {queHacer || (susKilos ? '' : '—')}
                        {susKilos && queHacer ? ' · ' : ''}
                        {/* Sin partirse: «≈ 105» en un renglón y «kg» en el siguiente no se lee. */}
                        {susKilos && <b style={{ fontWeight: 800, color: LT.blue, whiteSpace: 'nowrap' }}>{susKilos}</b>}
                      </span>
                    </span>
                  );
                })}
              </span>
            )}
            {(chips.length > 0 || kilos) && (
              <span style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 6 }}>
                {chips.map((c) => <Chip key={c}>{c}</Chip>)}
                {kilos && <Chip fuerte>{kilos}</Chip>}
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
      {/* Sin «Sin anotar» en gris (Andrés, 29 sep 2026, sobre otras letras grises
          que no servían de nada): se repetía en CADA ejercicio, entre 4 y 10
          veces por pantalla, para decir lo que ya dice la ausencia de la pastilla
          azul de «Hoy: …». Sin nada anotado, el pie solo lleva el enlace. */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: anotado ? 'space-between' : 'flex-end',
        // Con vueltas la pastilla es más larga («Hoy: 2 de 2 vueltas · 120 kg»): en un teléfono angosto
        // baja el enlace a su propio renglón en vez de partirse la pastilla en dos.
        flexWrap: 'wrap', gap: '6px 10px', marginTop: 9, paddingTop: 9, borderTop: `1px solid ${LT.border}`,
      }}>
        {anotado && (
          <span style={{
            fontSize: 12, fontWeight: 800, color: LT.blue, background: LT.blueSoft,
            padding: '4px 9px', borderRadius: 7, whiteSpace: 'nowrap', ...NUM_STYLE,
          }}>
            Hoy: {anotado}
          </span>
        )}

        <button
          type="button"
          onClick={() => setProgresoAbierto(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 5, minWidth: 0, flexShrink: 0, marginLeft: 'auto',
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

const SetGroup = ({
  group, setNum, phaseColor, sessionData, sessionKey, onUpdate, oneRMs, sessionsData,
  // Solo la sesión normal de un día los pasa: es donde el coach puede ponerle formato a un Set.
  formatos = null, onFormato = null,
}) => {
  /* La ficha del ejercicio vive AQUI y no en cada fila, porque para decir
     "Guardar y siguiente" hay que saber cual es el siguiente — y una fila solo
     se conoce a si misma. La serie si conoce a todos sus miembros. */
  const [fichaEn, setFichaEn] = useState(null);
  const [reloj, setReloj] = useState(false);
  const [anotando, setAnotando] = useState(false);
  const { phases: planCompleto, resolveExercise, medias, kind } = usePlan();
  const { perfil: profile, soloLectura, userId } = usePerfilDeLaVista();
  if (group.isNote) {
    return (
      <div style={{
        margin: '4px 0 12px', padding: '10px 14px', background: LT.blueSoft, borderRadius: 10,
        fontSize: 11, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: LT.blue,
      }}>{group.ex.text}</div>
    );
  }
  const count = group.exercises.length;
  // La misma palabra que el editor: Bi-serie (2), Tri-serie (3), Circuito (4 o más).
  const typeLabel = setTag(count);
  const rondas = group.exercises[0].ex.sets;

  /* UN SET CON FORMATO (AMRAP, EMOM, Tabata…): el formato reemplaza el «Se repite N veces». Lo que
     anota el atleta de todo el Set va en `formatos[<llave del Set>]`, y la llave es la del primer
     ejercicio, que es como ya se anota cada ejercicio. */
  const formato = onFormato ? formatoDeMiembros(group.exercises.map(({ ex }) => ex)) : null;
  const claveFormato = String(group.exercises[0].idx);
  const resultado = formato ? (formatos?.[claveFormato] ?? null) : null;
  const resumen = formato ? resumenDeFormato(formato, count) : '';
  const hayReloj = !!formato && expande(formato, count).length > 0;

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
          {formato && (
            <span style={{
              fontSize: 11.5, fontWeight: 800, color: LT.blue, background: LT.blueSoft,
              padding: '3px 9px', borderRadius: 7, letterSpacing: 0.2, minWidth: 0, ...NUM_STYLE,
            }}>
              {resumen}
            </span>
          )}
          {!formato && typeLabel && (
            <span style={{
              fontSize: 10, fontWeight: 800, color: LT.blue, background: LT.blueSoft,
              padding: '2px 8px', borderRadius: 6, letterSpacing: 0.3, flexShrink: 0,
            }}>
              {typeLabel}
            </span>
          )}
        </div>
        {!formato && rondasQueDecir(rondas) && (
          <span style={{ fontSize: 12.5, color: LT.text2, fontWeight: 600, flexShrink: 0, ...NUM_STYLE }}>
            Se repite {rondasQueDecir(rondas)} veces
          </span>
        )}
      </div>

      {formato && (hayReloj || resultado || !soloLectura) && (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px 12px', margin: '0 3px 10px' }}>
          {hayReloj && !soloLectura && (
            <button
              type="button" onClick={() => setReloj(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 42, padding: '0 17px', borderRadius: 13, border: 'none',
                cursor: 'pointer', background: LT.blue, color: '#fff', fontFamily: FONT, fontSize: 14.5, fontWeight: 800, touchAction: 'manipulation',
              }}
            >
              <Play size={16} fill="#fff" /> Iniciar reloj
            </button>
          )}
          {resultado ? (
            <button
              type="button" onClick={soloLectura ? undefined : () => setAnotando(true)} disabled={soloLectura}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', cursor: soloLectura ? 'default' : 'pointer',
                fontFamily: FONT, fontSize: 12.5, fontWeight: 800, color: LT.blue, background: LT.blueSoft,
                padding: '6px 11px', borderRadius: 8, ...NUM_STYLE,
              }}
            >
              <Check size={13} strokeWidth={3} /> {textoDeResultado(resultado)}
            </button>
          ) : !soloLectura && (
            /* Un botón de los suyos —blanco, borde sólido, azul— junto al «Iniciar reloj». Antes era solo texto
               azul y (Andrés, 5 oct 2026) «el botón casi no se ve». */
            <button
              type="button" onClick={() => setAnotando(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 42, padding: '0 15px', borderRadius: 13,
                cursor: 'pointer', background: '#fff', border: `1.5px solid ${LT.blue}`, color: LT.blue, fontFamily: FONT,
                fontSize: 14.5, fontWeight: 800, touchAction: 'manipulation',
              }}
            >
              {formato.anota === 'nada' ? <Check size={15} strokeWidth={3} /> : <Edit3 size={15} />}
              {formato.anota === 'nada' ? 'Marcar como hecho' : 'Anotar resultado'}
            </button>
          )}
        </div>
      )}

      {!formato && typeLabel && (
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
              onAbrirFicha={() => setFichaEn(i)} oneRMs={oneRMs}
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

      {reloj && formato && (
        <RelojDelBloque
          formato={formato} ejercicios={group.exercises} serie={setNum} resumen={resumen}
          clave={`${userId}:${sessionKey}:${claveFormato}`}
          onGuardar={(r) => onFormato(claveFormato, r)} onCerrar={() => setReloj(false)}
        />
      )}
      {anotando && formato && (
        <ResultadoDelBloque
          formato={formato} resumen={resumen} inicial={resultado}
          sugerido={{ seg: null, rondas: 0, tramos: [], completados: tramosDeTrabajo(formato, count), de: tramosDeTrabajo(formato, count) }}
          onGuardar={(r) => { onFormato(claveFormato, r); setAnotando(false); }}
          onBorrar={resultado ? () => { onFormato(claveFormato, null); setAnotando(false); } : undefined}
          onCerrar={() => setAnotando(false)}
        />
      )}
    </div>
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
const HojaDelPrograma = ({
  sessionsData, aqui, viendo, onIr, onCerrar, pegadasDe, alTocarPegada, aparte = [], onAbrirAparte,
}) => {
  const { phases: PLAN, planMeta, kind, estructura } = usePlan();
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
        // En "varias semanas" no se cuentan fases: no se ven.
        : [estructura === 'semanas' ? null : pluralS(PLAN.length, 'fase'), pluralS(semanasTotales, 'semana'),
          semanasHasta ? `vas en la ${semanasHasta}` : null]
          .filter(Boolean).join(' · ')}
      onCerrar={onCerrar}
    >
      <NavegadorDelPlan
        fases={PLAN}
        kind={kind}
        estructura={estructura}
        aqui={aqui}
        viendo={viendo}
        // Se abre en lo que se está mirando, con las dos marcas a la vista:
        // "AQUÍ VAS" en tu día y "VIENDO" en el otro.
        abrirEn={viendo ?? aqui}
        hecha={(faseId, semana, dia) => !!sessionsData[idDeSesion(faseId, semana, dia)]?.completed}
        alTocarDia={onIr}
        // Lo que otros le pegaron al programa, dentro de su día y con su etiqueta.
        pegadasDe={pegadasDe}
        alTocarPegada={alTocarPegada}
      />

      {/* PROGRAMAS APARTE: los que un profesional armó por su cuenta (otro deporte,
          un tratamiento). No son parte de este programa: tienen sus propias fases
          y semanas, así que se abren por separado. */}
      {aparte.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ ...eyebrow(LT.text3), marginBottom: 9 }}>Programas aparte</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {aparte.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => onAbrirAparte?.(p)}
                className="kp-press"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer',
                  fontFamily: FONT, background: LT.surface, borderRadius: 14, padding: '12px 14px',
                  border: `1.5px solid ${(p.color ?? LT.blue)}44`,
                }}
              >
                <span aria-hidden="true" style={{ width: 5, alignSelf: 'stretch', borderRadius: 5, background: p.color ?? LT.blue, flexShrink: 0 }} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <EtiquetaDeAutor programa={p} tamano={11.5} />
                  <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800, color: LT.text, marginTop: 2, overflowWrap: 'anywhere' }}>
                    {p.title}
                  </span>
                  <span style={{ display: 'block', fontSize: 12, color: LT.text2, marginTop: 2 }}>
                    {p.kind === 'weekly'
                      ? 'Rutina semanal'
                      : [p.estructura === 'semanas' ? null : pluralS(p.phases.length, 'fase'), pluralS(semanasDelPlan(p.phases), 'semana')]
                        .filter(Boolean).join(' · ')}
                    {p.altaEn ? ' · te dio de alta' : ''}
                  </span>
                </span>
                <ChevronRight size={17} color={LT.text3} style={{ flexShrink: 0 }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </HojaFlotante>
  );
};

/* AM y PM con colores FIJOS y opuestos: naranja de mañana, azul de tarde. Antes la tarde tomaba el
   color de la fase, y en Potencia la fase es naranja: las dos sesiones del día salían del mismo
   color. Andrés lo vio en su jueves y no se distinguía cuál era cuál. Sin turno, el de la fase. */
const aspectoDeTurno = (turno, colorDeFase) => (turno
  ? { accent: turno === 'PM' ? LT.blue : LT.warning, Icono: turno === 'PM' ? Sunset : Sunrise }
  : { accent: colorDeFase, Icono: Dumbbell });

/**
 * La TARJETA de una sesión: un encabezado que se abre y se cierra (ícono, nombre,
 * cuántos ejercicios y cuánto dura) y, abierta, su contenido.
 *
 * LA TARJETA DE CADA SESIÓN ES UN BOTÓN Y TIENE QUE PARECERLO.
 * Andrés, 29 sep 2026: «me gustaría que estos 2 botones fueran más bonitos». Eran
 * una fila plana con una rayita de color, y con la primera abierta la segunda ni se
 * veía. Ahora cada una es una tarjeta con su ícono (amanecer / atardecer), su nombre,
 * cuántos ejercicios y cuánto dura, y un botón redondo que dice que se abre.
 * Terminada, su encabezado se pinta de verde, igual que el botón de cerrar.
 *
 * La usan las sesiones de un día doble (dos entradas el mismo día de la semana) y, en
 * «Plan» con equipo, TODAS las sesiones del día: la del fisio es una
 * tarjeta más al lado de las del coach, y `autor` (el programa de quien la puso) le
 * agrega su etiqueta chica.
 */
const TarjetaDeSesion = ({ accent, hecha, abierta, onAlternar, Icono, nombre, turno, detalle, autor, children }) => (
  <div style={{
    marginBottom: 12, borderRadius: 18, overflow: 'hidden', boxShadow: KP.shCard,
    background: LT.surface,
    border: `1.5px solid ${hecha ? `${LT.mint}55` : (abierta ? `${accent}66` : LT.border)}`,
  }}>
    {/* Solo el ENCABEZADO se pinta de verde al terminar: si se pintara toda
        la tarjeta, la lista de ejercicios de adentro quedaría sobre verde. */}
    <button
      type="button"
      aria-expanded={abierta}
      className="kp-press"
      onClick={onAlternar}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px',
        background: hecha ? KP.mintSoft : 'transparent', border: 'none', cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
      }}
    >
      <span style={{
        width: 46, height: 46, borderRadius: 14, flexShrink: 0, display: 'grid', placeItems: 'center',
        background: hecha ? LT.mint : `${accent}1F`, color: hecha ? '#fff' : accent,
      }}>
        {hecha ? <Check size={22} strokeWidth={3} /> : <Icono size={22} />}
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        {autor && (
          <span style={{ display: 'block', marginBottom: 4 }}>
            <EtiquetaDeAutor programa={autor} tamano={11.5} />
          </span>
        )}
        <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800, color: LT.text, lineHeight: 1.2, overflowWrap: 'anywhere' }}>
          {nombre}
        </span>
        <span style={{
          display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '3px 8px', marginTop: 5,
          fontSize: 12.5, fontWeight: 600, color: LT.text2, ...NUM_STYLE,
        }}>
          {turno && (
            <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 0.5, color: '#fff', background: accent, borderRadius: 6, padding: '2px 7px' }}>
              {turno}
            </span>
          )}
          {/* Terminada, «Terminada» ocupa el lugar de los datos: el ícono
              verde ya dice que va hecha y así el encabezado no crece. */}
          {hecha ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, color: LT.mint, fontWeight: 800 }}>
              <Check size={13} strokeWidth={3} /> Terminada
            </span>
          ) : (detalle && <span>{detalle}</span>)}
        </span>
      </span>
      <span aria-hidden="true" style={{
        width: 32, height: 32, borderRadius: 16, flexShrink: 0, display: 'grid', placeItems: 'center',
        background: hecha ? '#fff' : LT.surface2, color: LT.text2,
        transform: abierta ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s',
      }}>
        <ChevronDown size={18} />
      </span>
    </button>
    {abierta && (
      <div style={{ padding: '12px 16px 16px' }}>
        {children}
      </div>
    )}
  </div>
);

/**
 * CADA SESIÓN SE TERMINA POR SU LADO (Andrés, 29 sep 2026: «cada sesión debería
 * tener su botón de marcar como terminada»). Va al final de la lista, que es donde
 * se está cuando se acaba, y con la misma cara que el botón del día: azul para
 * marcar, verde cuando ya está. `laSesion`: «sesión AM», «sesión 2», «sesión».
 */
const TerminarSesion = ({ hecha, laSesion, onAlternar }) => (hecha ? (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14 }}>
    <div style={{
      flex: 1, minHeight: 50, borderRadius: 14, background: LT.mint, color: '#fff',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      fontFamily: FONT, fontSize: 14.5, fontWeight: 800,
    }}>
      <Check size={18} strokeWidth={3} /> {laSesion.charAt(0).toUpperCase() + laSesion.slice(1)} terminada
    </div>
    <button
      type="button"
      onClick={onAlternar}
      style={{
        minHeight: 50, padding: '0 14px', borderRadius: 14, cursor: 'pointer',
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
    onClick={onAlternar}
    className="kp-press"
    style={{
      width: '100%', minHeight: 50, marginTop: 14, borderRadius: 14, border: 'none',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9,
      cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 800, color: '#fff',
      background: `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})`, boxShadow: KP.shBtn,
    }}
  >
    <Check size={18} strokeWidth={3} /> Marcar {laSesion} como terminada
  </button>
));

/**
 * Cuántas tarjetas de sesión dibuja una entrada en «Plan» con equipo: una si trae ejercicios
 * o notas de sesión, ninguna si es un descanso.
 */
const tarjetasDelDia = (day) => {
  const filas = day.exercises || [];
  return filas.length > 0 && !(esDescanso(day) && !filas.some((e) => !e.isNote)) ? 1 : 0;
};

/**
 * El CUERPO de un día: las sesiones que trae (ejercicios agrupados en sets, los
 * pesos que anota el atleta, el botón de terminar cada una), sus notas y el
 * porqué de cada cosa. Es la parte de «Plan» que no depende de en qué programa
 * se esté: recibe la semana y el día y los registros de SU programa.
 *
 * Existe aparte para poder armar, en el mismo día, lo de varios profesionales
 * (cada uno dentro de su `ComoPrograma`) sin copiar nada.
 *
 * `partes` (solo «Plan» con equipo, y un día con dos entradas) dice cuáles piezas se dibujan:
 * 'sesiones', 'notasDelDia', 'tusNotas' y 'ciencia' (que también se puede pedir en dos pedazos:
 * 'cienciaDelDia' —el porqué del día y del workout— y 'cienciaDeLaSemana'). Sin ella salen todas, como siempre. Con
 * equipo las sesiones de todos van juntas arriba, cada una como una tarjeta
 * (`entarjetas`), y lo demás —las notas y el porqué científico— sale UNA sola vez,
 * hasta abajo, que es lo menos importante (Andrés, 2 oct 2026). `autor`: el
 * programa de quien puso las sesiones, para su etiqueta en cada tarjeta.
 */
const CuerpoDelDia = ({
  phase, week, dayIdx: selectedIdx, sessionsData, updateSession, oneRMs,
  partes, entarjetas = false, abiertasPorDefecto, autor = null,
}) => {
  const { t } = usePalabras();
  const idDeSesion = useIdDeSesion();
  const phaseColor = phase.color || LT.blue;
  const quiere = (parte) => !partes || partes.includes(parte);
  /* Qué sesiones del día están desplegadas. Solo se guarda lo que la persona
     toca; lo demás lo decide `abiertaSola`: un día de UNA sesión la trae
     abierta, y uno de DOS (mañana y tarde) las trae CERRADAS. Antes la primera
     salía siempre abierta y empujaba a la segunda fuera de la pantalla: quien
     abría un doble no se enteraba de que había otra sesión más abajo
     (Andrés, 29 sep 2026). */
  const [openBlocks, setOpenBlocks] = useState({});
  useEffect(() => { setOpenBlocks({}); }, [selectedIdx]);

  const selectedDay = week.days[selectedIdx];
  const selectedId = idDeSesion(phase.id, week.num, selectedIdx);
  const sessionData = sessionsData[selectedId] || {};
  const selectedCompleted = !!sessionData.completed;
  /* Con `entarjetas` la sesión es una tarjeta, aunque este programa traiga una sola: se termina cada una por su lado y
     salen cerradas si hay más de una en el día (lo decide quien arma la pantalla con `abiertasPorDefecto`). Sin
     `entarjetas`, un día de una sola sesión sigue como siempre, con su botón de terminar al final. */
  const porTarjeta = entarjetas;
  const abiertaSola = abiertasPorDefecto ?? true;
  /* Sesiones que no son de gimnasio. Probado armando una semana como coach:
     una sesión de velocidad, de recovery o de cancha se escribe con NOTAS
     ("Sprint 6 x 30 yd", "Foam roller 10 min"), porque no son ejercicios del
     repertorio. Esas notas se pintaban como separadores de serie —en
     mayúsculas, azules, 11 px—, así que la sesión entera se leía como una pila
     de títulos sin contenido. Y un día OFF enseñaba "Marcar sesión como
     terminada" sobre una pantalla vacía. */
  const notasDelDia = (selectedDay.exercises || []).filter((e) => e.isNote && e.text);
  const soloNotas = (selectedDay.exercises || []).length > 0 && (selectedDay.exercises || []).every((e) => e.isNote);
  const descansoPuro = esDescanso(selectedDay) && !(selectedDay.exercises || []).some((e) => !e.isNote);

  const setExerciseData = (exIdx, data) => {
    updateSession(selectedId, prev => ({ ...prev, exercises: { ...(prev?.exercises || {}), [`${exIdx}`]: data } }));
  };
  // Lo que anotó el atleta de un Set entero con formato (rondas, tiempo…); `null` lo borra.
  const setFormato = (clave, resultado) => updateSession(selectedId, (prev) => {
    const resto = { ...(prev?.formatos || {}) };
    if (resultado) resto[clave] = resultado; else delete resto[clave];
    return { ...prev, formatos: resto };
  });
  const updateNotes = (notes) => updateSession(selectedId, prev => ({ ...prev, notes }));
  const toggleComplete = () => updateSession(selectedId, prev => ({
    ...prev, completed: !prev?.completed,
    completedAt: !prev?.completed ? new Date().toISOString() : null
  }));
  /* Con equipo, la sesión de un día de UNA sola sesión también es una tarjeta, igual
     a las de un doble: así la del fisio no queda como un bloque distinto al lado de
     las del coach. Sus datos se guardan igual que siempre (por ejercicio y un solo
     «terminada» para la sesión). */
  const tarjetaDelDia = (cuerpo) => {
    const nombre = sinDuracion(selectedDay.name || '') || textoDeSesiones(sesionesDelTitulo(selectedDay)) || selectedDay.day;
    const n = ((sesionQueRepite(week, selectedIdx)?.day ?? selectedDay).exercises || []).filter((e) => !e.isNote).length;
    const detalle = [n ? plural(n, 'ejercicio', 'ejercicios') : null, minutosDelNombre(selectedDay.name || '')].filter(Boolean).join(' · ');
    // El turno de una sesión suelta (mañana o tarde) lo pone el coach desde «Opciones»: aquí se ve, igual que en un doble.
    const turno = selectedDay.turno === 'AM' || selectedDay.turno === 'PM' ? selectedDay.turno : null;
    const { accent, Icono } = aspectoDeTurno(turno, phaseColor);
    return (
      <TarjetaDeSesion
        accent={accent} hecha={selectedCompleted} abierta={openBlocks.dia ?? abiertaSola}
        onAlternar={() => setOpenBlocks((p) => ({ ...p, dia: !(p.dia ?? abiertaSola) }))}
        Icono={Icono} nombre={nombre} turno={turno} detalle={detalle} autor={autor}
      >
        {cuerpo}
        <TerminarSesion hecha={selectedCompleted} laSesion={turno ? `sesión ${turno}` : 'sesión'} onAlternar={toggleComplete} />
      </TarjetaDeSesion>
    );
  };

  // Lo que el atleta anotó de cada ejercicio de la sesión, por su lugar en la lista.
  const ejerciciosAnotados = { exercises: Object.fromEntries(Object.entries(sessionData.exercises || {}).map(([k, v]) => [parseInt(k, 10), v])) };

  return (
    <>
      {/* SIN LÍNEA GRIS DE DATOS bajo la tira de días.
          Aquí iba «Gym · 7 ejercicios · 70 min · 75%» (y en un doble, «AM y PM
          abajo»). Andrés, 29 sep 2026: «solo saturan la página, no sirven de
          nada y no se ven bien». Y tenía razón: cuántos ejercicios y cuánto dura
          ya lo dice la tarjeta de la sesión justo debajo, la intensidad va en
          cada ejercicio, y el tipo lo dice el color de la tira. Ya se había
          encogido una vez, de un bloque de 150 px a una línea (18 sep); ahora
          desaparece. Solo queda la palomita verde cuando el día está hecho; en
          un doble no hace falta: cada tarjeta dice si va terminada. */}
      {quiere('sesiones') && selectedCompleted && !porTarjeta && (
        <div style={{ padding: '0 3px', marginBottom: 12 }}>
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 4,
            fontSize: 11.5, color: LT.mint, fontWeight: 800,
          }}>
            <Check size={13} strokeWidth={3} /> Terminada
          </span>
        </div>
      )}

      {/* Las notas de un descanso pueden venir de dos sitios: renglones de nota
          dentro de `exercises` (lo que escribe el editor de hoy) o la lista
          `notes` del plan original. El plan de Andrés tiene dos días OFF y los
          dos usan la segunda: "Descanso activo" con "Caminata Z1 30 min".

          Si el coach escribió algo, SE ENSEÑA LO SUYO y no el texto genérico.
          "Hoy no toca entrenar" encima de "Caminata Z1 30 min" se contradice. */}
      {quiere('sesiones') && descansoPuro && (() => {
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
                {t('Hoy no toca entrenar. Recuperar también es parte del plan.')}
              </div>
            )}
          </div>
        );
      })()}

      {/* Una sesión hecha solo de notas se lee como lista de instrucciones, igual
          que las sesiones de velocidad del plan original. */}
      {quiere('sesiones') && !descansoPuro && soloNotas && (() => {
        /* «Repite la sesión del lunes»: se enseñan AQUÍ los ejercicios de esa sesión, para verlos y anotar
           los pesos de hoy. Se guardan con la llave de este día, así que no pisan lo que anotó el lunes. */
        const repite = sesionQueRepite(week, selectedIdx);
        if (repite) {
          const groups = groupIntoSets(repite.day.exercises);
          let setNum = 0;
          const repetida = (
            <>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, margin: '2px 0 14px', fontSize: 13, color: LT.text2, lineHeight: 1.5 }}>
                <Repeat size={15} style={{ color: phaseColor, flexShrink: 0, marginTop: 2 }} />
                <span>
                  <b style={{ color: LT.text }}>Igual que el {weekdayLabel(repite.day.day).toLowerCase()}.</b>{' '}
                  {notasDelDia.map((n) => n.text).join(' ')}
                </span>
              </div>
              {groups.map((g, gi) => {
                if (!g.isNote) setNum += 1;
                return (
                  <SetGroup key={`${selectedIdx}-${gi}`} group={g} setNum={setNum} phaseColor={phaseColor}
                    sessionData={ejerciciosAnotados} sessionKey={selectedId}
                    onUpdate={(idx, data) => setExerciseData(idx, data)}
                    oneRMs={oneRMs} sessionsData={sessionsData}
                    formatos={sessionData.formatos} onFormato={setFormato} />
                );
              })}
            </>
          );
          return entarjetas ? tarjetaDelDia(repetida) : repetida;
        }
        const lista = (
          <ul style={{ listStyleType: 'disc', margin: 0, paddingLeft: 18, color: LT.text, fontSize: 14.5, lineHeight: 1.7 }}>
            {notasDelDia.map((n, i) => <li key={i}>{n.text}</li>)}
          </ul>
        );
        return entarjetas ? tarjetaDelDia(lista) : (
          <div style={{ background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 16, padding: '14px 16px', marginBottom: 14 }}>
            {lista}
          </div>
        );
      })()}

      {/* Ejercicios agrupados en sets */}
      {quiere('sesiones') && selectedDay.exercises && !soloNotas && !descansoPuro && (() => {
        const groups = groupIntoSets(selectedDay.exercises);
        let setNum = 0;
        const sets = groups.map((g, gi) => {
          if (!g.isNote) setNum += 1;
          return (
            <SetGroup key={`${selectedIdx}-${gi}`} group={g} setNum={setNum} phaseColor={phaseColor}
              sessionData={ejerciciosAnotados} sessionKey={selectedId}
              onUpdate={(idx, data) => setExerciseData(idx, data)}
              oneRMs={oneRMs} sessionsData={sessionsData}
              formatos={sessionData.formatos} onFormato={setFormato} />
          );
        });
        return entarjetas ? tarjetaDelDia(sets) : sets;
      })()}

      {quiere('sesiones') && selectedDay.notes && !selectedDay.exercises && !descansoPuro && (
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
      {quiere('sesiones') && selectedDay.exercises && !descansoPuro && !porTarjeta && (
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
      {quiere('notasDelDia') && selectedDay.notes && selectedDay.exercises && !descansoPuro && (
        <div style={{ background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 16, padding: 16, marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: LT.text3, fontWeight: 700, letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 8 }}>Notas del día</div>
          <ul style={{ listStyleType: 'disc', margin: 0, paddingLeft: 18, color: LT.text2, fontSize: 13, lineHeight: 1.7 }}>
            {selectedDay.notes.map((n, i) => <li key={i}>{n}</li>)}
          </ul>
        </div>
      )}

      {/* Notas del usuario */}
      {quiere('tusNotas') && (
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
      )}

      {(quiere('ciencia') || quiere('cienciaDelDia')) && selectedDay.dayScience && (
        <LightCollapsible title="Por qué este día" icon={Info} color={LT.blue}>
          <div style={{ fontSize: 13.5, color: LT.text2, lineHeight: 1.7 }}>{selectedDay.dayScience}</div>
        </LightCollapsible>
      )}

      {(quiere('ciencia') || quiere('cienciaDelDia')) && selectedDay.workoutScience && (
        <LightCollapsible title="Por qué este workout" icon={Sparkles} color={LT.mint}>
          <LightWorkoutScience science={selectedDay.workoutScience} />
        </LightCollapsible>
      )}

      {(quiere('ciencia') || quiere('cienciaDeLaSemana')) && week.weekScience && (
        <LightCollapsible title="Por qué esta semana" icon={BookOpen} color={LT.text2}>
          <LightWeekScience science={week.weekScience} />
        </LightCollapsible>
      )}

    </>
  );
};

const WeekDetail = ({
  phase, week, dayIdx, onVerPrograma, sessionsData, updateSession, oneRMs, activeSessionId,
  miDia, onVolverAMiDia, onHacerEsteDia, onDiaVisto,
}) => {
  const idDeSesion = useIdDeSesion();
  const { kind, estructura, phases: PLAN } = usePlan();
  const esRutina = kind === 'weekly';
  // "Varias semanas": se dice la semana de corrido y no la fase.
  const deCorrido = estructura === 'semanas';
  const semanaDeCorrido = deCorrido ? (semanaGlobal(PLAN, phase.id, week.num) ?? week.num) : null;
  /* Los días OFF no cuentan: no se "completa" un descanso. Un día con dos entradas (mañana y tarde)
     cuenta UNA vez, y va hecho cuando lo están las dos. */
  const entrenables = juntaPorDia(enOrdenDeSemana(week.days)).filter(({ day }) => !esDescanso(day));
  const completedCount = entrenables
    .filter(({ hermanas }) => hermanas.every(({ idx }) => sessionsData[idDeSesion(phase.id, week.num, idx)]?.completed)).length;

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
  const selectedDay = week.days[selectedIdx];
  // El título nunca junta las sesiones con «+» ni arrastra «· ~70 min»: ver `lib/sesiones.js`.
  const selectedDayName = sinDuracion(selectedDay.name || '')
    || textoDeSesiones(sesionesDelTitulo(selectedDay))
    || selectedDay.day;
  /* Dos entradas el mismo día de la semana (mañana y tarde) son UN día con dos tarjetas, igual que
     un doble de antes: una por sesión, cada una con su turno y su botón de terminar. */
  const hermanas = hermanasDelDia(week, selectedIdx);
  const agrupadas = hermanas.length > 1;

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
        {hermanas.length > 2 ? `${hermanas.length} sesiones` : (agrupadas ? 'Doble sesión' : selectedDayName)}
      </h1>

      <div style={{
        fontSize: 11.5, fontWeight: 700, color: LT.text3, marginBottom: 12,
        letterSpacing: 0.2, paddingRight: 52, ...NUM_STYLE,
      }}>
        {esRutina
          ? `Esta semana · ${completedCount}/${pluralS(entrenables.length, 'día')}`
          : deCorrido
            ? `Semana ${semanaDeCorrido} de ${semanasDelPlan(PLAN)} · ${completedCount}/${pluralS(entrenables.length, 'día')}`
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
        && miDia.week.num === week.num && hermanas.some((h) => h.idx === miDia.dayIdx)) && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
          background: LT.surface, border: `1.5px solid ${LT.borderHi}`, borderRadius: 14,
          padding: '11px 13px', marginBottom: 14,
        }}>
          <div style={{ flex: '1 1 180px', minWidth: 0 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: LT.text }}>
              Estás viendo {weekdayLabel(selectedDay.day)}
              {deCorrido && miDia && (miDia.week.num !== week.num || miDia.phase.id !== phase.id)
                ? ` · Semana ${semanaDeCorrido}` : ''}
              {!deCorrido && miDia && miDia.week.num !== week.num ? ` · Semana ${week.num}` : ''}
              {!deCorrido && miDia && miDia.phase.id !== phase.id ? ` de ${phase.name}` : ''}
            </div>
            <div style={{ fontSize: 12.5, fontWeight: 600, color: LT.text3, marginTop: 2 }}>
              {miDia
                ? `Hoy te toca: ${(() => {
                  // Un día con dos entradas (mañana y tarde) dice sus dos sesiones.
                  const deHoy = hermanasDelDia(miDia.week, miDia.dayIdx).map((h) => h.day);
                  return (deHoy.length > 1 ? textoDeSesiones(sesionesDelTitulo(deHoy)) : '')
                    || sinDuracion(miDia.day?.name || '')
                    || textoDeSesiones(sesionesDelTitulo(miDia.day))
                    || tipoDeSesion(miDia.day).label;
                })()}`
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

      {agrupadas ? (
        <>
          {/* Una tarjeta por sesión, cerradas (se ve de un vistazo todo lo que toca), y lo demás —notas del
              día, «Tus notas» y el porqué científico— UNA sola vez y hasta abajo: igual que `PlanUnificado`. */}
          {hermanas.map(({ idx }) => (
            <CuerpoDelDia
              key={`s-${idx}`} phase={phase} week={week} dayIdx={idx}
              sessionsData={sessionsData} updateSession={updateSession} oneRMs={oneRMs}
              partes={['sesiones']} entarjetas abiertasPorDefecto={false}
            />
          ))}
          {hermanas.map(({ idx }) => (
            <CuerpoDelDia
              key={`n-${idx}`} phase={phase} week={week} dayIdx={idx}
              sessionsData={sessionsData} updateSession={updateSession} oneRMs={oneRMs}
              partes={['notasDelDia']}
            />
          ))}
          {/* Lo que anota el atleta del día es UNO solo: va con la primera sesión. */}
          <CuerpoDelDia
            phase={phase} week={week} dayIdx={hermanas[0].idx}
            sessionsData={sessionsData} updateSession={updateSession} oneRMs={oneRMs}
            partes={['tusNotas']}
          />
          {hermanas.map(({ idx }) => (
            <CuerpoDelDia
              key={`c-${idx}`} phase={phase} week={week} dayIdx={idx}
              sessionsData={sessionsData} updateSession={updateSession} oneRMs={oneRMs}
              partes={['cienciaDelDia']}
            />
          ))}
          <CuerpoDelDia
            phase={phase} week={week} dayIdx={hermanas[0].idx}
            sessionsData={sessionsData} updateSession={updateSession} oneRMs={oneRMs}
            partes={['cienciaDeLaSemana']}
          />
        </>
      ) : (
        <CuerpoDelDia
          phase={phase} week={week} dayIdx={selectedIdx}
          sessionsData={sessionsData} updateSession={updateSession} oneRMs={oneRMs}
        />
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

/**
 * Una pieza del día dentro de «Plan» con equipo, de UN programa. Va envuelta en SU
 * programa (`ComoPrograma`): el ejercicio que puso el fisio se ve con el video del fisio
 * y lo que anota el atleta se guarda en el lugar de esa sesión, no en el del coach.
 *
 * `partes` dice cuál pieza dibuja (ver `CuerpoDelDia`). No hay un bloque por persona: las
 * sesiones de todos van juntas, y lo demás sale una sola vez, hasta abajo.
 */
const FuenteDelDia = ({ fuente, store, setStore, oneRMs, partes, autor, abiertas }) => {
  const { programa, phase, week, idx } = fuente;
  const sessionsData = useMemo(() => registrosDe(programa, store), [programa, store]);
  const updateSession = useCallback(
    (id, cambio) => escribeRegistro(setStore, programa, id, cambio),
    [setStore, programa],
  );
  const cuerpo = (
    <CuerpoDelDia
      phase={phase} week={week} dayIdx={idx}
      sessionsData={sessionsData} updateSession={updateSession} oneRMs={oneRMs}
      partes={partes} entarjetas abiertasPorDefecto={abiertas} autor={autor}
    />
  );
  return (
    <ComoPrograma programa={programa}>
      {partes.includes('sesiones')
        ? <div id={`fuente-${programa.id}-${idx}`} style={{ scrollMarginTop: 12 }}>{cuerpo}</div>
        : cuerpo}
    </ComoPrograma>
  );
};

/**
 * «Plan» de un atleta con EQUIPO: UN solo día con las sesiones de todos.
 *
 * Andrés, 1 oct 2026: «dia a dia al atleta le aparezca todas las sesiones de
 * todos, y en el plan también, pero que si lo quiere filtrar o separar, igual
 * puede». Antes había una pestaña por profesional; ahora hay una sola semana
 * (la del coach, con lo que otros le pegaron, y los programas aparte que van
 * por su cuenta), y el filtro «Ver» de arriba solo ESCONDE lo de los demás.
 *
 * Cada sesión es una TARJETA y dice de quién viene con una etiqueta chica. Se abren,
 * se anotan y se terminan como siempre (`CuerpoDelDia`), cada una en su programa.
 *
 * El día es UN todo (Andrés, 2 oct 2026: «el programa es un "todo"… no que la app se
 * la pase separándolo»): las tarjetas de todos van seguidas, sin un bloque por
 * persona, y después, UNA sola vez y hasta abajo —es lo menos importante—, las notas
 * y el porqué científico.
 */
const PlanUnificado = ({
  programas, store, setStore, oneRMs, vista, semanaActual, filtro, onFiltro, autores, onVerPrograma, onClaveVista, foco,
}) => {
  const { kind, estructura, phases: PLAN } = usePlan();
  const dias = useMemo(() => semanaUnificada(programas, store, { vista }), [programas, store, vista]);
  const visibles = useCallback(
    (d) => d.fuentes.filter((f) => !filtro || autorDe(f.programa) === filtro),
    [filtro],
  );
  // Abre en el día que se pidió, o en hoy; si ese día no tiene nada, en el primero que sí.
  const [clave, setClave] = useState(() => {
    const quiere = vista?.dia ?? weekdayToday();
    const conSesion = (c) => { const d = dias.find((x) => x.clave === c); return !!d && visibles(d).length > 0; };
    return conSesion(quiere) ? quiere : (dias.find((d) => visibles(d).length > 0)?.clave ?? quiere);
  });
  useEffect(() => { onClaveVista?.(clave); }, [clave, onClaveVista]);

  const dia = dias.find((d) => d.clave === clave) ?? dias[0];
  const fuentes = visibles(dia);
  const conAutor = autores.length > 1;
  /* Cuántas tarjetas trae el día: un doble trae una por turno; un descanso, ninguna.
     Con UNA sola se abre sola; con varias salen cerradas, como en un doble, para que
     se vea de un vistazo todo lo que toca. */
  const totalTarjetas = fuentes.reduce((n, f) => n + tarjetasDelDia(f.day), 0);
  /* Si se llegó tocando UNA sesión de «Hoy» (`foco`), la pantalla baja hasta ella: la
     del fisio puede quedar debajo de una sesión larga del coach, y sin esto parecería
     que el toque no abrió lo que se tocó. La primera ya queda arriba. */
  const primera = fuentes[0] ? `${fuentes[0].programa.id}-${fuentes[0].idx}` : null;
  useEffect(() => {
    if (!foco || foco === primera) return undefined;
    const cuadro = requestAnimationFrame(() => {
      document.getElementById(`fuente-${foco}`)?.scrollIntoView({ block: 'start' });
    });
    return () => cancelAnimationFrame(cuadro);
  }, [foco, primera]);
  const reales = dias.flatMap((d) => visibles(d)).filter((f) => !f.descanso);
  const hechas = reales.filter((f) => f.hecha).length;
  const fase = PLAN.find((f) => f.id === vista?.faseId);
  const semana = fase?.weekData?.find((w) => w.num === vista?.semana);
  const ubicacion = !fase || !semana ? null
    : kind === 'weekly' ? 'Esta semana'
      : estructura === 'semanas'
        ? `Semana ${semanaGlobal(PLAN, fase.id, semana.num) ?? semana.num} de ${semanasDelPlan(PLAN)}`
        : `${fase.name || fase.fullName} · ${fase.mode === 'microcycle' ? 'Microciclo' : `Semana ${semana.num} de ${fase.weeks}`}`;
  const nombreDia = weekdayLabel(dia.clave);
  const titulo = semanaActual && dia.esHoy
    ? `Hoy · ${nombreDia}`
    : nombreDia.charAt(0).toUpperCase() + nombreDia.slice(1);

  return (
    <div style={{ padding: '14px 18px 110px', background: LT.bg, minHeight: '100svh', fontFamily: FONT }}>
      <h1 style={{
        fontSize: 21, fontWeight: 800, color: LT.text, margin: '0 0 3px',
        lineHeight: 1.15, letterSpacing: -0.4, paddingRight: 52,
      }}>
        {titulo}
      </h1>
      <div style={{
        fontSize: 11.5, fontWeight: 700, color: LT.text3, marginBottom: 12,
        letterSpacing: 0.2, paddingRight: 52, ...NUM_STYLE,
      }}>
        {[ubicacion, reales.length ? `${hechas}/${reales.length} ${reales.length === 1 ? 'sesión' : 'sesiones'}` : null].filter(Boolean).join(' · ')}
      </div>

      <FiltroDeAutor autores={autores} filtro={filtro} onFiltro={onFiltro} style={{ marginBottom: 12 }} />

      {/* La tira de la semana: cada punto es de un color, el de quien puso esa sesión. */}
      <div style={{ display: 'flex', marginBottom: 16, borderBottom: `1px solid ${LT.border}`, paddingBottom: 2 }}>
        {dias.map((d) => {
          const fs = visibles(d);
          const hay = fs.length > 0;
          const seleccionado = d.clave === clave;
          const hecho = hay && fs.every((f) => f.hecha);
          const descanso = hay && fs.every((f) => f.descanso);
          const colores = [...new Set(fs.filter((f) => !f.descanso).map((f) => f.programa.color ?? LT.blue))].slice(0, 3);
          return (
            <button
              key={d.clave}
              type="button"
              disabled={!hay}
              onClick={() => hay && setClave(d.clave)}
              style={{
                flex: 1, minWidth: 0, border: 'none', background: 'transparent',
                cursor: hay ? 'pointer' : 'default', fontFamily: FONT,
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
                padding: '2px 0 9px',
              }}
            >
              <span style={{
                fontSize: 11, fontWeight: seleccionado ? 800 : 600,
                color: seleccionado ? LT.blue : (d.esHoy ? LT.text2 : LT.text3),
              }}>
                {d.clave}
              </span>
              <span style={{
                width: 27, height: 27, borderRadius: 14, display: 'grid', placeItems: 'center',
                background: seleccionado ? LT.blue : 'transparent',
                fontSize: 13.5, fontWeight: seleccionado || d.esHoy ? 800 : 600,
                color: seleccionado ? '#fff' : (hay ? LT.text : LT.text4),
                border: !seleccionado && d.esHoy ? `1.5px solid ${LT.borderHi}` : '1.5px solid transparent',
                ...NUM_STYLE,
              }}>
                {d.numero}
              </span>
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3, height: 10, minWidth: 12 }}>
                {hecho ? (
                  <Check size={11} strokeWidth={3.5} style={{ color: LT.mint }} />
                ) : hay && !descanso ? colores.map((c) => (
                  <span key={c} style={{ width: 5, height: 5, borderRadius: 3, background: c }} />
                )) : null}
              </span>
            </button>
          );
        })}
      </div>

      {fuentes.length === 0 ? (
        <div style={{ background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 16, padding: 18, marginBottom: 14 }}>
          <div style={{ fontSize: 16, fontWeight: 800, color: LT.text }}>
            {filtro ? 'Ese día no hay nada de esta persona' : 'Sin sesión este día'}
          </div>
        </div>
      ) : (
        <>
          {fuentes.map((f) => (
            <FuenteDelDia
              key={`s-${f.programa.id}-${f.phase.id}-${f.week.num}-${f.idx}`}
              fuente={f} store={store} setStore={setStore} oneRMs={oneRMs}
              partes={['sesiones']} autor={conAutor ? f.programa : null}
              abiertas={totalTarjetas <= 1 || foco === `${f.programa.id}-${f.idx}`}
            />
          ))}
          {fuentes.map((f) => (
            <FuenteDelDia
              key={`n-${f.programa.id}-${f.phase.id}-${f.week.num}-${f.idx}`}
              fuente={f} store={store} setStore={setStore} oneRMs={oneRMs} partes={['notasDelDia']}
            />
          ))}
          {/* Lo que anota el atleta del día es UNO solo, no uno por persona: va con el
              primer programa del día (el del coach), aunque el filtro lo deje fuera. */}
          <FuenteDelDia
            key={`t-${clave}`}
            fuente={dia.fuentes[0]} store={store} setStore={setStore} oneRMs={oneRMs} partes={['tusNotas']}
          />
          {fuentes.map((f) => (
            <FuenteDelDia
              key={`c-${f.programa.id}-${f.phase.id}-${f.week.num}-${f.idx}`}
              fuente={f} store={store} setStore={setStore} oneRMs={oneRMs} partes={['ciencia']}
            />
          ))}
        </>
      )}

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
                      // Un día con dos entradas (mañana y tarde) cuenta UNA vez y va hecho cuando lo están las dos.
                      const entrenables = juntaPorDia(enOrdenDeSemana(week.days)).filter(({ day }) => !esDescanso(day));
                      const completedCount = entrenables
                        .filter(({ hermanas }) => hermanas.every(({ idx }) => sessionsData[idDeSesion(phase.id, week.num, idx)]?.completed)).length;
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
                              {juntaPorDia(enOrdenDeSemana(week.days)).map(({ day, idx, hermanas }) => {
                                const isDone = hermanas.every((h) => !!sessionsData[idDeSesion(phase.id, week.num, h.idx)]?.completed);
                                const isCurrent = current && current.phaseId === phase.id && current.weekNum === week.num
                                  && hermanas.some((h) => current.dayIdx === h.idx);
                                const cat = tipoDeSesion(day);
                                // Dos entradas el mismo día (mañana y tarde) dicen sus dos sesiones, con su turno.
                                const dayName = hermanas.length > 1
                                  ? textoDeSesiones(sesionesDelTitulo(hermanas.map((h) => h.day)))
                                  : (sinDuracion(day.name || '') || textoDeSesiones(sesionesDelTitulo(day)) || day.day);
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
                                    {hermanas.length > 1 && <span style={{ fontSize: 9, fontWeight: 800, color: T.warning }}>2X</span>}
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

/**
 * La fila de 1RM en Home: el molde de «Mi plan · Ver» (ícono redondo, título, lo que dice y «Ver ›»).
 * Andrés, 7 oct 2026: «el de 1RM está bien como está, porque es una calculadora». Salud y Ciencia tienen lo suyo
 * en `TarjetasDeHome`.
 */
const FilaDeUnRM = ({ valor, boton, onClick }) => (
  <button
    type="button" onClick={onClick} className="kp-press"
    style={{
      width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: FONT, background: LT.surface, borderRadius: 22,
      padding: 16, border: `1.5px solid ${LT.blueSoft}`, display: 'flex', alignItems: 'center', gap: 14,
    }}
  >
    <span style={{
      width: 52, height: 52, borderRadius: '50%', background: LT.blueSoft, color: LT.blue,
      display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    }}><Calculator size={22} /></span>
    <span style={{ flex: 1, minWidth: 0 }}>
      <span style={{ display: 'block', fontSize: 17, fontWeight: 700, color: LT.text }}>1RM</span>
      <span style={{ display: 'block', fontSize: 12, color: LT.text2, marginTop: 1, overflowWrap: 'anywhere', ...NUM_STYLE }}>{valor}</span>
    </span>
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0,
      background: LT.blueSoft, color: LT.blue, borderRadius: 999,
      padding: '8px 11px 8px 13px', fontSize: 13, fontWeight: 800,
    }}>
      {boton} <ChevronRight size={15} />
    </span>
  </button>
);

const HomeView = ({
  sessionsData, wellness, oneRMs = {}, onStartSession, onGoTab, onAbrirHoja, onVerPrograma, cursor, onChangeCursor,
  hayEquipo = false, conAutor = false, entradas = [], autores = [], filtro = null, onFiltro, onAbrirEntrada, resumenDeEquipo = null,
  altasDeEquipo = [],
}) => {
  /* LAS PROPORCIONES EN COMPU. Andrés, 18 sep 2026: "en teléfono no hay ningún
     problema con HOME, pero en computadora las proporciones están un poco
     raras para los atletas nada más". El diagnóstico, medido en 1440 px: los
     botones son de ancho completo porque en un teléfono eso es lo correcto, y
     aquí "Ver mi plan" acababa midiendo 980 px de ancho por 44 de alto. Una
     banda, no un botón. En compu se les pone tope y se dejan a la izquierda,
     que es donde empieza el texto de su tarjeta. */
  const esCompu = useIsDesktop();
  const { t, coach, salud } = usePalabras();
  const tope = esCompu ? { maxWidth: 260 } : null;
  const { phases: PLAN, planMeta, kind, estructura, programas } = usePlan();
  // "Varias semanas": las tarjetas dicen la semana de corrido, no la fase.
  const deCorrido = estructura === 'semanas';
  const semanaDe = (n) => `Semana ${semanaGlobal(PLAN, n.phase.id, n.week.num) ?? n.week.num} de ${semanasDelPlan(PLAN)}`;
  const { perfil: profile, soloLectura } = usePerfilDeLaVista();
  /* Los avisos que ya aceptó con su «Entendido» (uno por aviso; se guardan con el resto de
     lo suyo). Hasta que cargue lo guardado no se enseña ninguno: uno ya aceptado saldría
     un instante y se iría. Un coach que mira la app del atleta no acepta nada por él. */
  const { loaded: estadoListo } = useAppState();
  const [avisosVistos, setAvisosVistos] = useStorage('ui:avisos-vistos', {});
  const aceptaAviso = (clave) => setAvisosVistos((prev) => ({ ...prev, [clave]: new Date().toISOString() }));
  const displayName = profile?.full_name || profile?.username || 'Atleta';
  // Lo que toca HOY según el calendario del dispositivo (no según lo marcado).
  const next = useMemo(() => sessionForToday(PLAN, kind, cursor), [PLAN, kind, cursor]);
  const semanaPropia = useMemo(() => weekOverview(PLAN, kind, cursor), [PLAN, kind, cursor]);
  // Con equipo, «Tu semana» cuenta lo de todos (y respeta el filtro).
  const week = hayEquipo && resumenDeEquipo ? resumenDeEquipo : semanaPropia;
  // Un día con dos entradas se dice «2 sesiones», no «Fuerza + Movilidad»: así no
  // se lee como una sola (Andrés, 29 sep 2026).
  const nombreDeSemana = (d) => (d.sesiones > 1 ? `${d.sesiones} sesiones` : sinDuracion(d.name || ''));
  /* Un día con dos entradas (mañana y tarde) es UN día: «Completada» solo cuando lo están las dos, y la
     tarjeta dice sus dos sesiones, igual que un doble de antes. */
  const entradasDelDia = useMemo(() => (next ? hermanasDelDia(next.week, next.dayIdx) : []), [next]);
  const cursorCompleted = next
    ? entradasDelDia.every((h) => !!sessionsData[sessionIdFor(kind, next.phase.id, next.week.num, h.idx)]?.completed)
    : false;
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
    // Dos entradas el mismo día: sus ejercicios se suman y no se inventa una duración (cada tarjeta trae la suya).
    if (entradasDelDia.length > 1) {
      return { exercises: entradasDelDia.reduce((n, h) => n + reales(h.day.exercises), 0), duration: null, agrupadas: true };
    }
    const n = reales((sesionQueRepite(next.week, next.dayIdx)?.day ?? d).exercises);
    // La duración que trae escrita el propio plan en el nombre («· ~70 min»), si la trae.
    return { exercises: n, duration: n ? (minutosDelNombre(d.name || '') || '~55 min') : tipo };
  }, [next, entradasDelDia]);

  const { text: greetText } = greeting();
  // La foto de la tarjeta: la de la fase de hoy; si no tiene, la del plan; si tampoco, la tarjeta oscura.
  const fotoDeHome = next ? (next.phase.image || planMeta?.foto || '') : '';
  // Lo de 1RM: el máximo más pesado que ha guardado, en su unidad.
  const unidadPeso = profile?.unidad_peso || 'kg';
  const mejorRM = useMemo(() => {
    const guardados = LEVANTAMIENTOS.map((l) => ({ l, kg: Number(oneRMs?.[l.key]) })).filter((x) => x.kg > 0);
    if (!guardados.length) return null;
    const top = guardados.sort((a, b) => b.kg - a.kg)[0];
    return { nombre: top.l.nombre, kg: top.kg };
  }, [oneRMs]);
  // Con equipo cada programa trae su ciencia: la tarjeta sale si CUALQUIERA la tiene, no solo el que está activo.
  const conCiencia = programasConCiencia(programas).length > 0;
  const con1RM = !salud;

  /* El título de hoy. Una sesión: su nombre, sin «· ~70 min» pegado. Dos
     (mañana y tarde): una etiqueta por cada una, no «Velocidad + Lower
     Strength» (Andrés, 29 sep 2026). Ver `lib/sesiones.js`. */
  const sesionesDeHoy = next ? sesionesDelTitulo(entradasDelDia.length > 1 ? entradasDelDia.map((h) => h.day) : next.day) : [];
  const sessionTitle = next ? (sinDuracion(next.day.name || '') || textoDeSesiones(sesionesDeHoy) || next.day.day) : '';

  const sinSesionHoy = (
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
                ? `${t('Tu siguiente entrenamiento es el')} ${weekdayLabel(week.next.key)}${nombreDeSemana(week.next) ? ` · ${nombreDeSemana(week.next)}` : ''}.`
                : t('Aún no hay entrenamientos en tu semana.')}
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
              {t('Ver mi plan')}
            </button>
          </div>
        </div>
  );

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

      {/* Alguien quiere atenderlo: se lo pregunta la portada (solo si hay una pendiente). */}
      <AvisoDeInvitacion />

      {/* Un profesional de su equipo le dio de alta: se lo dice la portada durante 7 días. */}
      {estadoListo && altasDeEquipo.filter((p) => !avisosVistos[`alta:${p.id}`]).map((p) => (
        <div key={p.id} style={{
          margin: '0 18px 12px', background: KP.mintSoft, borderRadius: 16, padding: '13px 15px',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <Check size={18} color={KP.mint} strokeWidth={3} style={{ flexShrink: 0 }} />
          <div style={{ flex: '1 1 160px', fontSize: 14, fontWeight: 700, color: LT.text, lineHeight: 1.35 }}>
            {nombreCorto(p.profesional?.full_name) || 'Tu fisio'} te dio de alta el {new Date(p.altaEn).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
          </div>
          {!soloLectura && <BotonEntendido color="#00805A" style={{ marginLeft: 'auto' }} onClick={() => aceptaAviso(`alta:${p.id}`)} />}
        </div>
      ))}

      {/* Su fisio le dio de alta: se lo dice la portada durante 7 días. El programa
          sigue en «Programa», solo para consultar: no se bloquea nada. */}
      {estadoListo && altaReciente(profile?.alta_en) && !avisosVistos[`alta:perfil:${profile.alta_en}`] && (
        <div style={{
          margin: '0 18px 12px', background: KP.mintSoft, borderRadius: 16, padding: '13px 15px',
          display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
        }}>
          <Check size={18} color={KP.mint} strokeWidth={3} style={{ flexShrink: 0 }} />
          <div style={{ flex: '1 1 160px', fontSize: 14, fontWeight: 700, color: LT.text, lineHeight: 1.35 }}>
            {coach?.full_name || 'Tu fisio'} te dio de alta el {new Date(profile.alta_en).toLocaleDateString('es-MX', { day: 'numeric', month: 'long' })}
          </div>
          {!soloLectura && <BotonEntendido color="#00805A" style={{ marginLeft: 'auto' }} onClick={() => aceptaAviso(`alta:perfil:${profile.alta_en}`)} />}
        </div>
      )}

      {/* CON EQUIPO la sesión de hoy es UNA tarjeta con lo de todos, cada cosa con el
          nombre de quien la puso (Andrés, 1 oct 2026). Sin equipo, la de siempre. */}
      {hayEquipo ? (
        <>
          <FiltroDeAutor autores={autores} filtro={filtro} onFiltro={onFiltro} style={{ padding: '0 18px 12px' }} />
          {entradas.length > 0 ? (
            <TarjetaDeHoyDeTodos
              entradas={entradas}
              onAbrir={onAbrirEntrada}
              onCambiarDia={kind !== 'weekly' && !filtro ? onChangeCursor : undefined}
              esCompu={esCompu}
              conAutor={conAutor}
            />
          ) : sinSesionHoy}
        </>
      ) : next ? (
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
                {sesionesDeHoy.length > 1 ? (
                  <EtiquetasDeSesion sesiones={sesionesDeHoy} sobreAzul envolver tamano={14} style={{ marginTop: 10 }} />
                ) : (
                  <div style={{ fontSize: 24, fontWeight: 700, color: '#fff', lineHeight: 1.05, marginTop: 3, letterSpacing: -0.5 }}>
                    {sessionTitle}
                  </div>
                )}
                <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.82)', marginTop: 8, lineHeight: 1.4 }}>
                  {/* Aquí iba «Fuerza» (la fase, o la semana de corrido), y la tarjeta de
                      foto de AL LADO dice lo mismo en grande. Se quitó el 29 sep 2026
                      con el visto bueno de Andrés (es su Home y se lo preguntamos). Solo
                      una rutina que se repite dice aquí el día de la semana, que en
                      ninguna otra parte se menciona. */}
                  {kind === 'weekly' && <>{weekdayLabel(next.day.day)}<br /></>}
                  {[
                    sessionMeta.exercises ? plural(sessionMeta.exercises, 'ejercicio', 'ejercicios') : null,
                    sessionMeta.duration,
                    // Otra sesión hoy además de esta (mañana y tarde como dos entradas).
                    !sessionMeta.agrupadas && next.sesionesHoy > 1 ? `${next.sesionesHoy} sesiones hoy` : null,
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

            {/* Card foto. Desde el 7 oct 2026 ya NO abre la sesión de hoy (eso lo hace la tarjeta azul de al lado y
                la pestaña «Entrenar»): abre el programa completo, y por eso el botón «Mi plan · Ver» de más abajo
                ya no sale cuando esta tarjeta está. */}
            <div onClick={onVerPrograma}
              style={{
                flex: 1, borderRadius: 22, overflow: 'hidden', position: 'relative',
                background: '#000', minHeight: 232, cursor: 'pointer', minWidth: 0,
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              }}>
              {fotoDeHome && (
                <img src={fotoDeHome} alt={next.phase.name}
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', opacity: 0.92 }} />
              )}
              <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.78) 100%)' }} />
              <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '16px 16px 0' }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>
                  {kind === 'weekly' ? 'Tu rutina' : (deCorrido ? semanaDe(next) : `Fase ${next.phase.num}`)}
                </span>
              </div>
              <div style={{ position: 'relative', padding: '0 16px 16px' }}>
                <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.05, marginBottom: 12 }}>
                  {kind === 'weekly' ? (planMeta?.title || 'Rutina semanal') : (deCorrido ? (planMeta?.title || 'Tu programa') : next.phase.name)}
                </div>
                <div style={{ background: '#fff', borderRadius: 14, padding: '12px', fontSize: 13, fontWeight: 600, color: '#111', textAlign: 'center' }}>
                  {kind === 'weekly' ? 'Ver rutina' : 'Ver programa'}
                </div>
              </div>
            </div>
          </div>

        </>
      ) : sinSesionHoy}

      {/* Row: salud + progreso. En compu van lado a lado; en un celular «Tu semana» baja a su propia línea: sus siete
          días necesitan ~290 px y la mitad de un celular da ~130 (Andrés, 7 oct 2026: «el viernes no alcanza a estar en
          la misma línea»). `flex: 1 1 0` con `minWidth` hace las dos cosas: parten iguales cuando caben, y se acomodan
          en filas cuando no. */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, padding: '0 18px 12px' }}>
        {/* Salud (antes «Estado hoy»: ahí también se va a conectar el Apple Watch). Ver `TarjetasDeHome`. */}
        <TarjetaDeSalud
          puntaje={todayScore} dia={wellness[today()]} onAbrir={() => onAbrirHoja('wellness')} tope={tope}
        />

        {/* Tu semana: qué días entrenas, cuál es hoy y qué sigue */}
        <div style={{ flex: '1 1 0', minWidth: 290, background: LT.surface, borderRadius: 22, padding: 20 }}>
          <div style={{ fontSize: 14, color: LT.text2 }}>Tu semana</div>
          <div style={{ fontSize: 13, color: LT.text, marginTop: 6 }}>
            {week.trainingDays} {t(`${week.trainingDays === 1 ? 'día' : 'días'} de entrenamiento`)}
          </div>
          <div style={{ display: 'flex', gap: 4, marginTop: 14, flexWrap: 'wrap' }}>
            {week.days.map((d) => (
              <div
                key={d.key}
                title={nombreDeSemana(d) || 'Descanso'}
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
              ? `Siguiente: ${weekdayLabel(week.next.key)}${nombreDeSemana(week.next) ? ` · ${nombreDeSemana(week.next)}` : ''}`
              : t('Sin entrenamientos esta semana')}
          </div>
        </div>
      </div>

      {/* 1RM (una fila) y Ciencia (una cinta de una línea): se abren como hoja encima. 1RM no sale a un paciente de fisio,
          y Ciencia no sale si el plan no tiene (cada plan trae la suya; ver `lib/ciencia.js`). */}
      {con1RM && (
        <div style={{ padding: '0 18px 12px' }}>
          <FilaDeUnRM
            onClick={() => onAbrirHoja('oneRM')}
            valor={mejorRM ? `${mejorRM.nombre} ${desdeKilos(mejorRM.kg, unidadPeso)} ${etiquetaUnidad(unidadPeso)}` : 'Sin datos'}
            boton={mejorRM ? 'Ver' : 'Anotar'}
          />
        </div>
      )}
      {conCiencia && (
        <div style={{ padding: '0 18px 12px' }}>
          <CintaDeCiencia onAbrir={() => onAbrirHoja('science')} />
        </div>
      )}

      {/* Info del plan. Con la tarjeta de foto de arriba, esa ya es la puerta al programa; este botón solo sale
          cuando no está (con equipo, o un día sin sesión). */}
      {!(next && !hayEquipo) && (
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
              {planMeta?.title || t('Mi plan')}
            </span>
            <span style={{ display: 'block', fontSize: 12, color: LT.text2, marginTop: 1 }}>
              {kind === 'weekly'
                ? `Rutina semanal · ${week.trainingDays} ${week.trainingDays === 1 ? 'día' : 'días'}`
                : deCorrido
                  ? pluralS(semanasDelPlan(PLAN), 'semana')
                  : `${pluralS(PLAN.length, 'fase')} · ${pluralS(semanasDelPlan(PLAN), 'semana')}`}
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

const WellnessView = ({ wellness, setWellness, enHoja = false }) => {
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
    <div style={{ paddingBottom: enHoja ? 0 : 100, margin: enHoja ? '0 -20px' : 0 }}>
      <div style={{ padding: enHoja ? '6px 20px 20px' : '20px 20px 24px' }}>
        <Caption color={T.text3} style={{ marginBottom: 6 }}>Salud diaria</Caption>
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
                <Line type="monotone" dataKey="bienestar" stroke={T.accent} strokeWidth={2.5} dot={{ fill: T.accent, r: 3 }} name="Puntaje" />
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

// Los mismos 9 levantamientos que usa el cálculo de kilos por porcentaje (ver `lib/cargaPorcentaje.js`).
const ONE_RM_LIFTS = LEVANTAMIENTOS;

const OneRMView = ({ oneRMs, setOneRMs, enHoja = false }) => {
  const { perfil: profile } = usePerfilDeLaVista();
  const unidad = profile?.unidad_peso || 'kg';
  const u = etiquetaUnidad(unidad);
  const [calc, setCalc] = useState({ weight: '', reps: '' });
  // La calculadora no necesita convertir: entra un peso y sale un 1RM en esa
  // misma unidad. Solo cambia la etiqueta. Los 1RM GUARDADOS sí se convierten,
  // porque de ellos salen los pesos recomendados de todo el plan.
  const result = useMemo(() => calc1RM(calc.weight, calc.reps), [calc]);

  return (
    <div style={{ paddingBottom: enHoja ? 0 : 100, margin: enHoja ? '0 -20px' : 0 }}>
      <div style={{ padding: enHoja ? '6px 20px 20px' : '20px 20px 24px' }}>
        {/* En la hoja, el título «1RM» ya lo dice la cabecera: no se repite. */}
        {!enHoja && <Caption color={T.text3} style={{ marginBottom: 6 }}>Tus máximos</Caption>}
        {!enHoja && <h1 style={{ fontSize: 36, fontWeight: 800, color: T.text, margin: 0, lineHeight: 1.05, letterSpacing: -1 }}>1RM</h1>}
        <div style={{ marginTop: enHoja ? 0 : 8, fontSize: 14, color: T.text2 }}>El plan usa estos para calcular las cargas. Recalibra al inicio de cada fase.</div>
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
              <div style={{ flex: 1, fontSize: 14, fontWeight: 600, color: T.text }}>{lift.nombre}</div>
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
  const { salud } = usePalabras();
  /* Tres botones (Andrés, 7 oct 2026). «Home» es lo que antes se llamaba «Hoy». «Entrenar» es lo que antes se
     llamaba «Plan»: abre la sesión de hoy (lo que tocaba ya lo decía la tarjeta azul de Home, y «Plan» sonaba a
     otra cosa); a un paciente de un fisio le dice «Sesión». Bienestar, 1RM y Ciencia viven dentro de Home. */
  const items = [
    { id: 'home', label: 'Home', icon: HomeIcon },
    { id: 'plan', label: salud ? 'Sesión' : 'Entrenar', icon: Dumbbell },
    { id: 'messages', label: 'Mensajes', icon: MessageCircle },
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

/* «Mensajes»: el botón ya está y la pantalla todavía no. Más adelante los atletas, sus coaches y su equipo se
   escribirán aquí (Andrés, 7 oct 2026: «quiero tener listo el botón aunque esté vacío»). */
const MessagesView = () => (
  <div style={{ padding: '72px 24px 120px', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
    <div style={{
      width: 76, height: 76, borderRadius: 24, background: T.accentBg, color: T.accent,
      display: 'grid', placeItems: 'center', margin: '0 auto 20px',
    }}>
      <MessageCircle size={34} />
    </div>
    <div style={{ fontSize: 21, fontWeight: 800, color: T.text, letterSpacing: -0.3 }}>Mensajes</div>
    <div style={{ fontSize: 14.5, color: T.text2, marginTop: 10, lineHeight: 1.6 }}>
      Pronto: mensajes con tu equipo.
    </div>
  </div>
);

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
const NoPlanState = ({ onAbrirHoja }) => (
  <div style={{ padding: '48px 20px 120px', maxWidth: 560, margin: '0 auto', textAlign: 'center' }}>
    <div style={{
      width: 76, height: 76, borderRadius: 24, background: T.accentBg, color: T.accent,
      display: 'grid', placeItems: 'center', margin: '0 auto 20px',
    }}>
      <Calendar size={34} />
    </div>
    <div style={{ fontSize: 21, fontWeight: 800, color: T.text, letterSpacing: -0.3 }}>
      <Palabra>Tu plan está en camino</Palabra>
    </div>
    <div style={{ fontSize: 14.5, color: T.text2, marginTop: 10, lineHeight: 1.6, maxWidth: 340, marginInline: 'auto' }}>
      <Palabra>
        Tu entrenador está preparando tu programa. En cuanto te lo asigne aparecerá aquí,
        con tus fases, semanas y sesiones listas para entrenar.
      </Palabra>
    </div>
    <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 26, flexWrap: 'wrap' }}>
      <button type="button" onClick={() => onAbrirHoja('wellness')} className="kp-press"
        style={{
          padding: '12px 18px', borderRadius: 13, border: `1.5px solid ${T.border}`, cursor: 'pointer',
          background: T.bg2, fontFamily: FONT, fontSize: 14, fontWeight: 700, color: T.text,
          display: 'inline-flex', alignItems: 'center', gap: 8,
        }}>
        <Heart size={16} color={T.accent} /> Registrar salud
      </button>
      <Sin1RM>
        <button type="button" onClick={() => onAbrirHoja('oneRM')} className="kp-press"
          style={{
            padding: '12px 18px', borderRadius: 13, border: `1.5px solid ${T.border}`, cursor: 'pointer',
            background: T.bg2, fontFamily: FONT, fontSize: 14, fontWeight: 700, color: T.text,
            display: 'inline-flex', alignItems: 'center', gap: 8,
          }}>
          <Calculator size={16} color={T.accent} /> Calcular 1RM
        </button>
      </Sin1RM>
    </div>
  </div>
);

export default function TrainingApp() {
  const {
    phases: PLAN, hasPlan, planLoading, kind, programas, programaActivo, elegirPrograma, claveDe,
  } = usePlan();
  const { store, setStore } = useAppState();
  /* EQUIPO = hay más de un programa con sesiones (el del coach y, además, lo que
     otra persona le pegó o armó aparte). Quien ya dio de alta no cuenta. Sin
     equipo, todo es la app de siempre. El filtro «Ver» y las etiquetas de «quién
     lo puso» salen solo si son al menos dos PERSONAS: si es la misma, no dicen nada. */
  const autores = useMemo(() => autoresDe(programas), [programas]);
  /* Programas con sesiones (uno aparte vacío no cuenta). Con dos o más hay equipo; con uno solo
     también si NO es el del coach (el coach no puso nada todavía, pero otra persona sí): si no, esa
     sesión no se vería en ninguna parte. */
  const hayEquipo = useMemo(() => {
    const con = programas.filter((p) => p.conSesiones && !p.altaEn);
    return con.length > 1 || (con.length === 1 && !con[0].esPrincipal && programas.some((p) => p.esPrincipal));
  }, [programas]);
  // El filtro «Ver: Todo · Andrés · Ana». Solo esconde; vale mientras esa persona tenga algo.
  const [filtro, setFiltro] = useState(null);
  const filtroVigente = filtro && autores.some((a) => a.id === filtro) ? filtro : null;
  const esCompu = useIsDesktop();
  const { user } = useAuth();
  // De quién es esta app: de quien entró, o del atleta que su coach está viendo.
  // Cada uno tiene su propio lugar guardado (ver `lugar.js`).
  const { userId: quien } = usePerfilDeLaVista();
  const { salud } = usePalabras();
  const [tab, setTab] = useLugar(`app.${quien}.tab`, 'home', (t) => PESTANAS.includes(t));
  // La hoja que está abierta encima de Home: 'wellness' | 'oneRM' | 'science' | null.
  const [hoja, setHoja] = useState(null);
  const [view, setView] = useState({ level: 'week' });
  // Los registros de un programa de EQUIPO van en claves aparte (`wr:sessions@<profesional>`);
  // los del coach principal siguen donde estaban. El bienestar y el 1RM son del atleta.
  const [sessionsData, setSessionsData] = useStorage(claveDe('wr:sessions'), {});
  const [oneRMs, setOneRMs] = useStorage('wr:onerm', {});
  const [wellness, setWellness] = useStorage('wr:wellness', {});
  const [storedCursor, setCursor] = useStorage(claveDe('wr:cursor'), null);
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

  // Dónde va el atleta, para marcarlo en la hoja. La misma función que usa su
  // coach al ver su plan: una sola cuenta, dos pantallas que no se contradicen.
  const aqui = useMemo(() => dondeVa(PLAN, kind, cursor), [PLAN, kind, cursor]);
  const [diaVisto, setDiaVisto] = useState(null);
  /* Cambiar de programa: se elige el activo y la vista se pone de una vez (con
     la semana y el día a abrir, o en blanco para que caiga en la semana donde
     va). Se hace aquí y no en un efecto: un efecto le pisaría el día elegido. */
  const cambiarPrograma = useCallback((planId, vista) => {
    elegirPrograma(planId);
    setView(vista ?? { level: 'week' });
    setDiaVisto(null);
  }, [elegirPrograma]);
  // La semana y el día que tenía abiertos antes de refrescar. Se lee una sola
  // vez, al arrancar; ver el efecto de abajo.
  const [lugarPlan] = useState(() => (esArranque() ? leeLugar(user?.id, `app.${quien}.plan`) : undefined));

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
  const vasA = (t) => {
    setTab(t);
    // «Hoy» y «Plan» son del programa del coach, con lo de todos adentro. Si se andaba
    // viendo un programa aparte, se vuelve; la vista queda en blanco para que caiga
    // en la semana del coach (ver el efecto de abajo).
    if (t === 'home') elegirPrograma(null);
    if (t === 'plan') {
      if (programaActivo?.esPrincipal) setView(vistaDelPlan());
      else { elegirPrograma(null); setView({ level: 'week' }); }
    }
  };

  // Lo que toca HOY, de todos juntos (el programa del coach, lo que otros le pegaron
  // y los programas aparte), ya con el filtro puesto.
  const entradasHoy = useMemo(() => (hayEquipo
    ? entradasDeHoy(programas, store).filter((e) => !filtroVigente || autorDe(e.programa) === filtroVigente)
    : []), [hayEquipo, programas, store, filtroVigente]);
  // «Tu semana» de la portada, con lo de todos.
  const resumenDeEquipo = useMemo(() => (hayEquipo
    ? resumenDeLaSemana(semanaUnificada(programas, store), filtroVigente)
    : null), [hayEquipo, programas, store, filtroVigente]);
  const altasDeEquipo = useMemo(() => programas.filter((p) => altaReciente(p.altaEn)), [programas]);

  // Programas armados por su cuenta por un profesional (no pegados al del coach): se abren aparte.
  const aparte = useMemo(
    () => (programaActivo?.esPrincipal ? programas.filter((p) => !p.esPrincipal && !p.sobre && p.conSesiones) : []),
    [programas, programaActivo?.esPrincipal],
  );
  // Lo que otros le pegaron a una semana del programa, para enseñarlo dentro de su día en la hoja.
  const pegadasDe = useCallback((fase, semana) => programas
    .filter((p) => p.sobre && !p.altaEn)
    .flatMap((p) => {
      const f = p.phases.find((x) => x.id === fase.id);
      const w = f?.weekData?.find((x) => x.num === semana.num);
      if (!w) return [];
      const registros = registrosDe(p, store);
      return (w.days ?? []).map((day, idx) => ({
        dia: day.day,
        day,
        etiqueta: etiquetaDePrograma(p),
        color: p.color,
        hecha: !!registros[sessionIdFor(p.kind, f.id, w.num, idx)]?.completed,
      }));
    }), [programas, store]);

  /* La semana que se mira en «Plan» con equipo, en el idioma de `semanaUnificada`:
     la fase y la semana del coach, y el día de la semana (por nombre, no por
     posición: lo pegado no tiene la posición de los días del coach). */
  const vistaUnificada = useMemo(() => (view.week ? {
    faseId: view.phase?.id,
    semana: view.week.num,
    dia: normalizaDia(view.dia ?? (view.dayIdx != null ? view.week.days?.[view.dayIdx]?.day : undefined)),
  } : null), [view]);
  const esSemanaActual = !!view.week && (kind === 'weekly'
    || (!!cursorSession && cursorSession.phase.id === view.phase?.id && cursorSession.week.num === view.week.num));
  // La hoja marca «VIENDO» el día que se está mirando: se le dice cuál (la posición del primero que coincide).
  const alVerClave = useCallback((clave) => {
    const idx = (view.week?.days ?? []).findIndex((d) => normalizaDia(d.day) === clave);
    setDiaVisto(idx >= 0 ? idx : null);
  }, [view.week]);

  /* AL REFRESCAR, VUELVE A DONDE ESTABAS (ver `lugar.js`). La pestaña ya vuelve
     sola; la de "Plan" además necesita una semana, y `view` arranca sin ella:
     sin esto, la pantalla se quedaría cargando para siempre. Si se guardó una
     semana y sigue en el plan, se abre esa, en el día que se estaba viendo; si
     no, la de siempre: la semana donde va el atleta. */
  useEffect(() => {
    if (tab !== 'plan' || view.week || !hasPlan) return;
    const fase = PLAN.find((f) => f.id === lugarPlan?.faseId);
    const semana = fase?.weekData?.find((w) => w.num === lugarPlan?.semana);
    setView(fase && semana
      ? { level: 'week', phase: fase, week: semana, dayIdx: Number.isInteger(lugarPlan.dia) ? lugarPlan.dia : undefined }
      : vistaDelPlan());
  }, [tab, view.week, hasPlan, PLAN, lugarPlan, vistaDelPlan]);

  // Y se anota la semana y el día que se están viendo.
  useEffect(() => {
    if (tab !== 'plan' || !view.week) return;
    guardaLugar(user?.id, claveDe(`app.${quien}.plan`), {
      faseId: view.phase?.id, semana: view.week.num, dia: diaVisto,
    });
  }, [tab, view.phase, view.week, diaVisto, user?.id, quien, claveDe]);

  // La altura de la pantalla, para volver a donde estaba. En "Plan" cada día
  // tiene la suya; se espera a saber cuál es antes de intentar bajar.
  useScrollLugar(
    tab === 'plan' ? `app.${quien}.plan.${view.phase?.id}.${view.week?.num}.${diaVisto}` : `app.${quien}.${tab}`,
    !planLoading && (tab !== 'plan' || (!!view.week && diaVisto != null)),
  );

  let content;
  if (planLoading && (tab === 'home' || tab === 'plan')) {
    content = <PlanLoadingState />;
  } else if (!hasPlan && !hayEquipo && (tab === 'home' || tab === 'plan')) {
    content = <NoPlanState onAbrirHoja={setHoja} />;
  } else if (tab === 'home') {
    content = <HomeView sessionsData={sessionsData} wellness={wellness}
      oneRMs={oneRMs}
      onStartSession={startSession}
      onGoTab={vasA}
      onAbrirHoja={setHoja}
      onVerPrograma={() => setProgramaAbierto(true)}
      cursor={cursor}
      onChangeCursor={() => setCursorPickerOpen(true)}
      hayEquipo={hayEquipo}
      conAutor={autores.length > 1}
      entradas={entradasHoy}
      autores={autores}
      filtro={filtroVigente}
      onFiltro={setFiltro}
      resumenDeEquipo={resumenDeEquipo}
      altasDeEquipo={altasDeEquipo}
      // Tocar una sesión de hoy abre «Plan» en ese día, con lo de todos.
      onAbrirEntrada={(e) => {
        setTab('plan');
        setView((v) => ({
          ...vistaDelPlan(), dia: normalizaDia(e.day.day), foco: `${e.programa.id}-${e.dayIdx}`, salto: (v.salto ?? 0) + 1,
        }));
      }} />;
  } else if (tab === 'plan') {
    /* Una sola pantalla: el DÍA. Las fases y las semanas ya no son pantallas
       por las que se navega, son una hoja que se abre encima (maqueta A, la
       que eligió Andrés el 18 sep 2026).

       CON EQUIPO, ese día trae las sesiones de todos (`PlanUnificado`). Sin
       equipo, o al abrir un programa aparte desde la hoja, es la pantalla de
       siempre, de un solo programa. */
    if (!view.week) {
      content = <PlanLoadingState />;
    } else if (hayEquipo && programaActivo?.esPrincipal) {
      content = (
        <PlanUnificado
          key={`${view.phase?.id}-${view.week.num}-${view.dia ?? view.dayIdx ?? ''}-${view.salto ?? 0}`}
          programas={programas} store={store} setStore={setStore} oneRMs={oneRMs}
          vista={vistaUnificada} semanaActual={esSemanaActual} foco={view.foco}
          filtro={filtroVigente} onFiltro={setFiltro} autores={autores}
          onVerPrograma={() => setProgramaAbierto(true)}
          onClaveVista={alVerClave}
        />
      );
    } else {
      const dia = (
        <WeekDetail
          key={`${programaActivo?.id}-${view.phase?.id}-${view.week?.num}-${view.salto ?? 0}`}
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
      );
      // Un programa aparte (de otro profesional) se abre solo: arriba, de quién es y cómo volver.
      // (Solo si hay un programa del coach al que volver: un atleta cuyo único programa es el
      // de un profesional no tiene a dónde «volver».)
      content = programaActivo && !programaActivo.esPrincipal && programas.some((p) => p.esPrincipal) ? (
        <>
          <div style={{ padding: '18px 68px 0 18px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => cambiarPrograma(null)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', fontFamily: FONT,
                background: LT.surface, border: `1.5px solid ${LT.border}`, borderRadius: 999,
                padding: '8px 13px 8px 9px', fontSize: 13.5, fontWeight: 800, color: LT.blue, touchAction: 'manipulation',
              }}
            >
              <ChevronLeft size={16} /> Volver a todo
            </button>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: LT.text3 }}>Programa aparte</span>
            <EtiquetaDeAutor programa={programaActivo} tamano={13} />
          </div>
          {dia}
        </>
      ) : dia;
    }
  } else if (tab === 'messages') {
    content = <MessagesView />;
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
      {/* Bienestar, 1RM y Ciencia ya no son pestañas: se abren como hoja encima, con su flecha para volver. */}
      {hoja === 'wellness' && (
        <HojaFlotante titulo="Salud" onCerrar={() => setHoja(null)}>
          <WellnessView wellness={wellness} setWellness={setWellness} enHoja />
        </HojaFlotante>
      )}
      {hoja === 'oneRM' && !salud && (
        <HojaFlotante titulo="1RM" onCerrar={() => setHoja(null)}>
          <OneRMView oneRMs={oneRMs} setOneRMs={setOneRMs} enHoja />
        </HojaFlotante>
      )}
      {hoja === 'science' && (
        // Con un solo programa con ciencia, su nombre; con varios (equipo), cada uno lleva el suyo dentro y aquí no se dice ninguno.
        <HojaFlotante titulo="Ciencia" subtitulo={programasConCiencia(programas).length === 1 ? programasConCiencia(programas)[0].title : undefined} onCerrar={() => setHoja(null)}>
          <CienciaDelPlan />
        </HojaFlotante>
      )}
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
            setFiltro(null);   // un día del coach no se vería si el filtro dejara solo a otra persona
            setView((v) => ({ level: 'week', phase: fase, week: semana, dayIdx, salto: (v.salto ?? 0) + 1 }));
            setProgramaAbierto(false);
          }}
          onCerrar={() => setProgramaAbierto(false)}
          pegadasDe={programaActivo?.esPrincipal ? pegadasDe : undefined}
          alTocarPegada={(fase, semana, pegada) => {
            setTab('plan');
            setFiltro(null);
            setView((v) => ({ level: 'week', phase: fase, week: semana, dia: pegada.dia, salto: (v.salto ?? 0) + 1 }));
            setProgramaAbierto(false);
          }}
          aparte={aparte}
          onAbrirAparte={(p) => {
            setProgramaAbierto(false);
            setTab('plan');
            cambiarPrograma(p.id);
          }}
        />
      )}
    </div>
  );
}
