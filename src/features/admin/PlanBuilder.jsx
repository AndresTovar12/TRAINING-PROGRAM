import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft, X, Plus, Trash2, Copy, ChevronRight, ChevronUp, ChevronDown,
  ChevronLeft, Loader2, Check, Layers, Dumbbell, StickyNote, Zap,
  Save, FolderOpen, Clipboard, Eraser, CalendarDays, Repeat, Scale, Video,
  Image as ImageIcon, CopyPlus, Sun, Moon, RefreshCw,
} from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { IconBtn, Pill } from '@/features/admin/piezas';
import { AvisoDeFormatos, EncabezadoDelSet } from '@/features/admin/FormatoDelSet';
import { formatoDeMiembros, ponFormato } from '@/lib/formatos';
import { esProgramaFantasma } from '@/lib/programas';
import { useAviso } from '@/components/AvisoPasajero';
import { useConfirmacion } from '@/components/Confirmacion';
import { useIsDesktop } from '@/lib/useViewport';
import {
  createPlan, updatePlan, deletePlan, createExercise,
  listExerciseMedia, addExerciseMedia, deleteExerciseMedia, getAthleteState,
} from '@/lib/api';
import {
  isLoadedExercise, dondeVa, estructuraDelPlan, kindDeEstructura, semanaGlobal, semanasDelPlan,
} from '@/lib/training-utils';
import GuiaDelEditor from '@/features/admin/GuiaDelEditor';
import BloqueDelPrograma from '@/features/admin/BloqueDelPrograma';
import MenuDeAcciones from '@/features/admin/MenuDeAcciones';
import { useFasesAbiertas } from '@/features/admin/useFasesAbiertas';
import EditorBarra, { BarraDelCelular, BotonesDeHistorial } from '@/features/admin/EditorBarra';
import { HistorialContext, enVentanaFlotante, useHistorial, useHistorialDelEditor } from '@/lib/useHistorial';
import { mueveEn, propsDeArrastre } from '@/lib/arrastrar';
import { PlegadasContext, usePlegadas, usePlegadasDelEditor } from '@/lib/usePlegadas';
import { useGuiaAncha } from '@/lib/useGuiaAncha';
import { T, FONT, KP, tipoDeSesion } from '@/lib/theme';
import { CeldaDeReps, CeldaDeCarga, DebajoDeRepsYCarga } from '@/components/RepsYCarga';
import CampoDescanso from '@/components/CampoDescanso';
import { useRepsYCarga } from '@/lib/useRepsYCarga';
import { normalizaVueltas, rondasDe } from '@/lib/porVuelta';
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
import { useRepertorioDelEditor } from '@/features/admin/useRepertorioDelEditor';
import DialogoGuardar from '@/features/misplanes/DialogoGuardar';
import SelectorDeMisPlanes from '@/features/misplanes/SelectorDeMisPlanes';
import { abrirItem, guardarItem, actualizarItem, borrarItem } from '@/lib/misPlanes';
import {
  workoutDeSesiones, diasDeWorkout, rutinaDePlan, rutinaDeSemana, planDeRutina, programaDePlan, planDePrograma,
  sinNotas, tieneNotas, sesionTieneContenido, semanaTieneContenido, planTieneContenido,
} from '@/lib/misPlanesDatos';

// `Pill` se sigue importando desde aquí (Mis planes); vive en `piezas.jsx`.
export { Pill };

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

/* Las fases con que arranca un plan NUEVO de Mis planes, según la forma que se eligió en el Centro de
   creación. «Varias semanas» arranca sin fases: primero se pregunta cuántas semanas y qué días. */
const fasesDeLaForma = (forma) => {
  if (forma === 'rutina') {
    const base = newPhase(1);
    base.name = 'Rutina semanal';
    base.weekData = [newWeek(1)];
    return [base];
  }
  return forma === 'fases' ? [newPhase(1)] : [];
};

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
  blocks.forEach((b) => {
    if (b.type !== 'set') return;
    b.rounds = b.members[0]?.sets ?? '3';
    // El formato (AMRAP, EMOM…) es del Set entero y vive repetido en cada ejercicio, como `sets`.
    b.formato = formatoDeMiembros(b.members);
  });
  return blocks;
};

const serializeBlocks = (blocks) => {
  const out = [];
  let n = 0;
  blocks.forEach((b) => {
    if (b.type === 'note') { out.push(b.ex); return; }
    n += 1;
    // Con formato, las «series» pasan a ser sus vueltas; sin él, se quita de todos los ejercicios.
    // Y las vueltas distintas de cada ejercicio se recortan o completan a las veces que se repite el Set.
    const miembros = ponFormato(
      b.members.map((m) => normalizaVueltas({ ...m, sets: String(b.rounds ?? m.sets ?? '3') })),
      b.formato ?? null,
    );
    miembros.forEach((m) => {
      const e = { ...m };
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

export function Field({ label, children, grow }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: grow ? 1 : undefined, minWidth: 0 }}>
      <span style={{ fontSize: 11, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6 }}>{label}</span>
      {children}
    </label>
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

/* UNA SOLA «DESCRIPCIÓN». Un ejercicio traía dos casillas, «Descripción» (`notes`) y «Cue técnico» (`cue`), y el atleta las
   lee igual, una tras otra (Andrés, 5 oct 2026, maqueta aprobada: una sola). La casilla enseña los dos textos juntos con « · »
   y, en cuanto se escribe en ella, todo pasa a `notes` y `cue` queda vacío: no se pierde nada y a quien no se toca no se le
   reescribe nada. */
const textoDeDescripcion = (ex) => [ex?.notes, ex?.cue].map((x) => String(x ?? '').trim()).filter(Boolean).join(' · ');
const alEscribirDescripcion = (onPatch) => (e) => onPatch({ notes: e.target.value, cue: '' });

/* ------------------------------------------------------------------ */
/* Card de ejercicio dentro de un set                                   */
/* ------------------------------------------------------------------ */

function ExerciseCard({
  ex, repertoire, atleta, onVideoAtleta, onPatch, onRemove, onMove, canLeft, canRight, conSeries = false,
  rondas = null, soloLectura = false, arrastre = null,
}) {
  const rep = delRepertorio(ex, repertoire);
  // Reps, carga, «Por lado» y «Por vuelta»: ver `useRepsYCarga`. En los días de dos sesiones no hay vueltas del Set.
  const rc = useRepsYCarga({ ex, onPatch, rondas: conSeries ? null : rondas, abiertoDeEntrada: soloLectura });
  const estiloCampo = { ...inputStyle, padding: '8px 10px', fontSize: 13 };
  /* El descanso lo escribe el COACH. Antes la app lo adivinaba leyendo el
     nombre del ejercicio y se lo enseñaba al atleta como si fuera una
     indicación suya. Si aquí se deja vacío, al atleta no le aparece nada:
     mejor callar que inventarle un dato de entrenamiento.
     Con «Series» (días de dos sesiones) va a media columna, junto a la carga;
     si no, en su propia línea. */
  const campoDescanso = <CampoDescanso ex={ex} onPatch={onPatch} estiloInput={estiloCampo} />;
  return (
    <div {...arrastre} style={{ background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden', minWidth: 0 }}>
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
          {/* Mover a la izquierda o a la derecha: solo donde no se deja arrastrar la tarjeta. */}
          {!arrastre && <IconBtn sobreFoto icon={ChevronLeft} onClick={() => onMove(-1)} disabled={!canLeft} title="Mover a la izquierda" />}
          {!arrastre && <IconBtn sobreFoto icon={ChevronRight} onClick={() => onMove(1)} disabled={!canRight} title="Mover a la derecha" />}
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
              <input value={ex.sets ?? ''} onChange={(e) => onPatch({ sets: e.target.value })} style={estiloCampo} />
            </Field>
          )}
          {/* El rótulo de cada campo es su lista: reps, segundos, metros… y % 1RM, RPE, RIR, kilos. Ver `RepsYCarga`. */}
          <CeldaDeReps rc={rc} estiloInput={estiloCampo} />
          <CeldaDeCarga rc={rc} estiloInput={estiloCampo} />
          {conSeries && campoDescanso}
          <div style={{ gridColumn: '1 / -1' }}>
            <DebajoDeRepsYCarga rc={rc} estiloInput={estiloCampo} />
          </div>
        </div>
        {/* LAS CASILLAS VACÍAS SE QUEDAN VACÍAS. Andrés, 5 oct 2026: «dentro de las casillas, cuando están
            vacías, normalmente pones en gris un ejemplo; quita eso». El rótulo ya dice qué va en cada una;
            por eso el cue, que solo tenía su texto gris, ahora lleva rótulo. */}
        {!conSeries && <div style={{ marginTop: 8 }}>{campoDescanso}</div>}
        <div style={{ marginTop: 8 }}>
          <Field label="Descripción">
            <input value={textoDeDescripcion(ex)} onChange={alEscribirDescripcion(onPatch)} style={estiloCampo} />
          </Field>
        </div>
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
      className="kp-accion"
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
// Lo que miden las casillas de reps y de carga en la fila de la compu. Las vueltas de debajo usan los mismos.
const ANCHO_REPS = 96;
const ANCHO_CARGA = 100;

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
function ExerciseRow({
  ex, repertoire, atleta, onVideoAtleta, onPatch, onRemove, onMove, canUp, canDown, conSeries = false,
  rondas = null, soloLectura = false, arrastre = null,
}) {
  const rep = delRepertorio(ex, repertoire);
  const rc = useRepsYCarga({ ex, onPatch, rondas: conSeries ? null : rondas, abiertoDeEntrada: soloLectura });
  // En el celular la «Descripción» vacía no ocupa un renglón: sale con «+ Descripción». En cuanto se toca o se escribe, se queda.
  const [descripcionAbierta, setDescripcionAbierta] = useState(false);
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
    <div {...arrastre} style={{
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
          {/* Subir y bajar: solo donde no se deja arrastrar el ejercicio. */}
          {!arrastre && <IconBtn icon={ChevronUp} onClick={() => onMove(-1)} disabled={!canUp} title="Subir" />}
          {!arrastre && <IconBtn icon={ChevronDown} onClick={() => onMove(1)} disabled={!canDown} title="Bajar" />}
          <IconBtn icon={Trash2} danger onClick={onRemove} title="Quitar del set" />
        </div>
      </div>

      {/* Medidas para que todo quepa en UNA línea desde una laptop de 1180 px
          (la fila mide 656), también con «Series»: el mínimo es 642. Si la
          pantalla es aún más chica, se parte. Las casillas vacías van vacías,
          sin ejemplo en gris (Andrés, 5 oct 2026). */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        {/* Solo en los días de dos sesiones, donde cada ejercicio trae sus
            propias series y en texto libre ("—", "3-4"). En una sesión normal
            las series son del set entero ("Se repite 3 veces"). */}
        {conSeries && (
          <div style={{ width: 52 }}>
            <RotuloCampo>Series</RotuloCampo>
            <input value={ex.sets ?? ''} onChange={(e) => onPatch({ sets: e.target.value })} style={inputFila} />
          </div>
        )}
        {/* El rótulo de cada campo es su lista: unidades y tipo de carga. Ver `RepsYCarga`. */}
        <div style={fluido(0) ?? { width: ANCHO_REPS }}>
          <CeldaDeReps rc={rc} compacto estiloInput={inputFila} />
        </div>
        <div style={fluido(0) ?? { width: ANCHO_CARGA }}>
          <CeldaDeCarga rc={rc} compacto estiloInput={inputFila} />
        </div>
        {/* En el teléfono, las vueltas y «Por lado» van pegadas a sus dos casillas, antes del descanso. */}
        {angosta && (
          <div style={completo(0)}>
            <DebajoDeRepsYCarga rc={rc} compacto estiloInput={inputFila} />
          </div>
        )}
        <div style={fluido(1) ?? { width: 112 }}>
          <CampoDescanso ex={ex} onPatch={onPatch} compacto estiloInput={inputFila} />
        </div>
        {/* La base decide si se parte la línea (no el mínimo): va chica, y el
            campo crece para llenar lo que sobre. */}
        {(!angosta || descripcionAbierta || !!textoDeDescripcion(ex)) && (
          <div style={completo(3) ?? { flex: '1 1 140px', minWidth: 110 }}>
            <RotuloCampo>Descripción</RotuloCampo>
            <input
              value={textoDeDescripcion(ex)} autoFocus={descripcionAbierta}
              onChange={(e) => { setDescripcionAbierta(true); onPatch({ notes: e.target.value, cue: '' }); }}
              style={inputFila}
            />
          </div>
        )}
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
      {angosta && !soloLectura && !descripcionAbierta && !textoDeDescripcion(ex) && (
        <button
          type="button" className="kp-accion" onClick={() => setDescripcionAbierta(true)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, marginLeft: -6, padding: '6px 9px', borderRadius: 999,
            border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: T.text2,
          }}
        >
          <Plus size={13} /> Descripción
        </button>
      )}
      {/* En la compu, las vueltas 2, 3, 4… caen justo debajo de las casillas de reps y carga (mismos anchos),
          y la fila de arriba no se mueve: los demás campos siguen alineados con la primera vuelta. */}
      {!angosta && (
        <div style={{ marginLeft: conSeries ? 60 : 0 }}>
          <DebajoDeRepsYCarga rc={rc} compacto estiloInput={inputFila} columnas={`${ANCHO_REPS}px ${ANCHO_CARGA}px`} />
        </div>
      )}
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

/* QUITAR ALGO. Con historial (el editor del plan, con Ctrl+Z) se quita de inmediato y sale el aviso «Se quitó…
   Deshacer»: preguntar antes es una vuelta de más cuando equivocarse se arregla con un toque (Andrés, 5 oct 2026, maqueta
   aprobada). Sin historial (los editores que todavía no lo tienen) se pregunta como siempre.
   `opciones.aviso`: lo que dice el aviso. `opciones.pregunta`: la pregunta sin historial; sin ella, se quita directo. */
function useQuitar() {
  const pregunta = useConfirmacion();
  const { avisa } = useAviso();
  const hist = useHistorialDelEditor();
  return async (opciones, quitar) => {
    if (hist) {
      quitar();
      avisa(opciones.aviso, { accion: { texto: 'Deshacer', alTocar: hist.deshacer } });
      return;
    }
    if (opciones.pregunta && !await pregunta(opciones.pregunta)) return;
    quitar();
  };
}

/* Lo que solo se lee en `SessionEditor soloLectura`: no se toca ni se enfoca
   (`inert`) y se ve un poco apagado. */
const enLectura = (activo) => (activo ? { inert: true, 'aria-readonly': true } : null);
const APAGADO = { opacity: 0.86, pointerEvents: 'none' };

/* ---- días con dos sesiones (AM / PM) ---- */
const turnoDe =(tag = '') => (tag.match(/\(([AP]M)\)/) || [])[1] || null;
const limpiaTag = (tag = '') => tag.replace(/^Sesi[óo]n \d+ \([AP]M\):\s*/, '');
/* El turno de una sesión de `blocks` vive DENTRO de su nombre («Sesión 2 (PM): Lower · ~65 min»): así lo lee el atleta. Poner
   o cambiar el turno reescribe solo ese pedazo y respeta lo demás; quitarlo deja el nombre sin el «Sesión N (PM): » de adelante. */
// El «Sesión N (AM): » de adelante, o '' si no lo trae.
const prefijoDelTag = (tag = '') => (tag.match(/^Sesi[óo]n \d+ \([AP]M\):\s*/) || [''])[0];
const conTurnoEnTag = (tag = '', turno, n) => {
  const nombre = limpiaTag(tag);
  return turno ? `Sesión ${n} (${turno}): ${nombre}` : nombre;
};

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
  onEjercicioCreado, onCategoriaCreada, onCategoriaBorrada, soloLectura = false, clavePlegado = null,
}) {
  const bloques = day.blocks || [];
  const quita = useQuitar();
  const [enFilas] = useEnFilas();
  // Cada lista de ejercicios (una por sesión del día) se identifica con el id de este editor.
  const uid = useId();
  const arrastrable = (cfg) => (soloLectura ? undefined : propsDeArrastre(cfg));
  /* Cada sesión se pliega con su botón (solo si el día trae 2 o más). Lo plegado vive en el editor del plan
     (`usePlegadas`); aquí solo se mira la llave de cada sesión: `<llave del día>:b<N>`. */
  const plegadas = usePlegadasDelEditor();
  const puedePlegar = !!plegadas && !!clavePlegado && (day.blocks?.length ?? 0) > 1;
  const claveDe = (bi) => `${clavePlegado}:b${bi}`;
  // Abierto: { bi, ancla } (la sesión y el botón al que se pega el menú «Opciones»).
  const [menuBloque, setMenuBloque] = useState(null);
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

  const mueveFilaA = (bi, de, a) => escribe((bs) => bs.map((b, i) => (i === bi ? { ...b, exercises: mueveEn(b.exercises || [], de, a) } : b)));
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

  return (
    <div {...enLectura(soloLectura)} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 12, ...(soloLectura ? APAGADO : null) }}>
      {bloques.map((b, bi) => {
        const turno = turnoDe(b.tag);
        const filas = b.exercises || [];
        const plegado = puedePlegar && !!plegadas.pl[claveDe(bi)];
        const nombreDelBloque = limpiaTag(b.tag) || `Sesión ${bi + 1}`;

        return (
          <div
            key={bi}
            {...arrastrable({
              lista: `${uid}:bloques`, etiqueta: nombreDelBloque, agarraDeBotonesEn: '[data-cab-arrastre]',
              // Lo plegado sigue a su sesión.
              alMover: (de, a) => { plegadas?.reordena(bloques.map((_, k) => claveDe(k)), de, a); escribe((bs) => mueveEn(bs, de, a)); },
            })}
            style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 14, overflow: 'hidden' }}
          >
            <div
              data-cab-arrastre=""
              style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '10px 11px',
                borderBottom: plegado ? 'none' : `1px solid ${T.border}`, background: T.bg2, flexWrap: 'wrap',
              }}
            >
              {puedePlegar && <BotonDePlegar plegada={plegado} onClick={() => plegadas.alterna(claveDe(bi))} />}
              {turno && <InsigniaDeTurno turno={turno} />}
              {/* El nombre se escribe SIN el «Sesión N (AM): » de adelante (el turno ya es la insignia): al escribir, ese
                  pedazo se conserva tal cual, que es como el atleta lee el turno. */}
              <input
                value={limpiaTag(b.tag)}
                onChange={(e) => parcheaBloque(bi, { tag: prefijoDelTag(b.tag) + e.target.value })}
                placeholder={`Sesión ${bi + 1}`}
                aria-label={`Nombre de la sesión ${bi + 1}`}
                style={{
                  flex: 1, minWidth: 120, padding: '7px 9px', borderRadius: 8,
                  border: `1.5px solid transparent`, background: 'transparent', fontFamily: FONT,
                  fontSize: 16, fontWeight: 800, color: T.text, outline: 'none',
                }}
                onFocus={(e) => { e.target.style.borderColor = T.border; e.target.style.background = T.bg; }}
                onBlur={(e) => { e.target.style.borderColor = 'transparent'; e.target.style.background = 'transparent'; }}
              />
              {/* Un solo «Opciones»: el turno (AM/PM, si el coach quiere) y eliminar esta sesión. */}
              {!soloLectura && (
                <button
                  type="button" className="kp-pill" aria-haspopup="menu" aria-label={`Opciones de la sesión ${bi + 1}`}
                  onClick={(e) => setMenuBloque({ bi, ancla: e.currentTarget })}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0, cursor: 'pointer',
                    border: `1.5px solid ${T.border}`, background: T.bg2, color: T.text, fontFamily: FONT, fontWeight: 700,
                    fontSize: 13.5, padding: '8px 12px', borderRadius: 11,
                  }}
                >
                  Opciones <ChevronDown size={14} color={T.text3} />
                </button>
              )}
            </div>

            {/* Plegada: solo la cabecera y cuánto trae. */}
            {plegado ? (
              <div style={{ padding: '0 12px 11px 54px', fontSize: 12.5, fontWeight: 600, color: T.text2, background: T.bg2 }}>
                {b.type === 'note' ? 'Solo texto' : pluralS(filas.filter((e) => !e.isNote).length, 'ejercicio')}
              </div>
            ) : (
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
                            <div
                              key={fi} {...arrastrable({ lista: `${uid}:b${bi}`, etiqueta: 'Nota', alMover: (de, a) => mueveFilaA(bi, de, a) })}
                              style={{
                                gridColumn: '1 / -1', display: 'flex', alignItems: 'flex-start', gap: 8,
                                background: T.accentBg, borderRadius: 12, padding: '9px 12px',
                              }}
                            >
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
                              {soloLectura && <IconBtn icon={ChevronUp} title="Subir" onClick={() => mueveFila(bi, fi, -1)} disabled={fi === 0} />}
                              {soloLectura && <IconBtn icon={ChevronDown} title="Bajar" onClick={() => mueveFila(bi, fi, 1)} disabled={fi === filas.length - 1} />}
                              <IconBtn icon={Trash2} danger title="Quitar" onClick={() => quita({ aviso: 'Se quitó la nota' }, () => quitaFila(bi, fi))} />
                            </div>
                          );
                        }
                        const props = {
                          ex: e,
                          repertoire,
                          atleta,
                          soloLectura,
                          conSeries: true,
                          onVideoAtleta: setMediaDe,
                          arrastre: arrastrable({ lista: `${uid}:b${bi}`, etiqueta: e.name || 'Ejercicio', alMover: (de, a) => mueveFilaA(bi, de, a) }),
                          onPatch: (parche) => parcheaFila(bi, fi, parche),
                          onMove: (dir) => mueveFila(bi, fi, dir),
                          onRemove: () => quita({ aviso: `Se quitó ${e.name || 'el ejercicio'}` }, () => quitaFila(bi, fi)),
                        };
                        return enFilas
                          ? <ExerciseRow key={fi} {...props} canUp={fi > 0} canDown={fi < filas.length - 1} />
                          : <ExerciseCard key={fi} {...props} canLeft={fi > 0} canRight={fi < filas.length - 1} />;
                      })}
                    </div>
                  )}

                  {!soloLectura && (
                    <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
                      <Pill icon={Plus} primary onClick={() => setEligiendoPara(bi)}>Agregar ejercicio</Pill>
                      <Pill icon={StickyNote} onClick={() => agregaFilas(bi, [{ isNote: true, text: '' }])}>Nota</Pill>
                      <Pill icon={Dumbbell} onClick={() => setCreandoPara(bi)}>Ejercicio nuevo</Pill>
                    </div>
                  )}
                </>
              )}
            </div>
            )}
          </div>
        );
      })}

      {/* El menú «Opciones» de una sesión del día: su turno y eliminarla. */}
      {menuBloque && bloques[menuBloque.bi] && (() => {
        const bi = menuBloque.bi;
        const b = bloques[bi];
        const turnoActual = turnoDe(b.tag);
        const nombre = limpiaTag(b.tag) || `Sesión ${bi + 1}`;
        return (
          <MenuDeAcciones
            titulo={nombre} ancla={menuBloque.ancla} onClose={() => setMenuBloque(null)}
            acciones={[
              ...opcionesDeTurno(turnoActual, (t) => parcheaBloque(bi, { tag: conTurnoEnTag(b.tag, t, bi + 1) })),
              {
                icon: Trash2, texto: 'Eliminar sesión', peligro: true,
                onClick: () => quita({
                  pregunta: { titulo: `¿Eliminar «${nombre}»?`, detalle: 'Se va con todos sus ejercicios. El otro turno del día se queda.', confirmar: 'Sí, eliminarla', peligro: true },
                  aviso: `Se eliminó «${nombre}»`,
                }, () => escribe((bs) => bs.filter((_, i) => i !== bi))),
              },
            ]}
          />
        );
      })()}

      {!soloLectura && (
        <>
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <Pill icon={Plus} onClick={() => escribe((bs) => [...bs, { type: 'lift', tag: `Sesión ${bs.length + 1}`, exercises: [] }])}>
              Otra sesión el mismo día
            </Pill>
            <Pill icon={StickyNote} onClick={() => escribe((bs) => [...bs, { type: 'note', tag: `Sesión ${bs.length + 1}`, text: '' }])}>
              Sesión de solo texto
            </Pill>
          </div>

        </>
      )}

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

/**
 * El editor de UNA sesión. Con `soloLectura` es el mismo, pero para ver la sesión de
 * otra persona: se ve igual y no se puede tocar nada de lo que la cambia (`inert`) ni
 * sale lo de agregar. Lo usa quien le agrega sesiones al programa de otro: ve las del
 * coach, no las cambia.
 *
 * El interruptor «tarjetas o lista» SÍ responde: solo cambia cómo se ve, no la sesión
 * (Andrés, 2 oct 2026: «no está modificando nada, solo es la visualización»). Por eso
 * el bloqueo va en cada parte que escribe y no en todo el editor de un golpe.
 */
export function SessionEditor(props) {
  if (!props.soloLectura) return <SessionEditorInterno {...props} />;
  return (
    <div aria-readonly="true" className="tl-lectura">
      {/* Se ve igual, pero sin lo que cambia algo: agregar, mover, quitar, «su video». */}
      <style>{'.tl-lectura .kp-accion{display:none !important}'}</style>
      <SessionEditorInterno {...props} />
    </div>
  );
}

function SessionEditorInterno({
  day, repertoire, categorias = [], atleta, onEjercicioCreado, onPatch, onDelete, onCopy, onSaveToCatalog, onApplyCatalog, onClear,
  duenoId, masterId, onCategoriaCreada, onCategoriaBorrada, soloLectura = false, vistaFuera = false,
  plegable = false, plegada = false, onPlegar, turno = null, onTurno, arrastre, clavePlegado,
}) {
  const { t } = usePalabras();
  const [creandoEjercicio, setCreandoEjercicio] = useState(false);
  const [mediaDe, setMediaDe] = useState(null);
  const quita = useQuitar();
  const esCompu = useIsDesktop();
  const [enFilas] = useEnFilas();
  const [pickerCtx, setPickerCtx] = useState(null);
  const blocks = useMemo(() => parseBlocks(day.exercises), [day.exercises]);
  // Cada lista de esta sesión (los Sets, los ejercicios de cada Set) se identifica con el id de la sesión.
  const uid = useId();
  const arrastrable = (cfg) => (soloLectura ? undefined : propsDeArrastre(cfg));

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
      <div {...arrastre} style={tarjetaDeSesion(day)}>
        <DayHeader day={day} onPatch={onPatch} onDelete={onDelete} onCopy={onCopy} onSaveToCatalog={onSaveToCatalog} onApplyCatalog={onApplyCatalog} onClear={onClear} dual conVista vistaFuera={vistaFuera} soloLectura={soloLectura} />
        <EditorSesionesDelDia
          day={day}
          clavePlegado={clavePlegado}
          onPatch={onPatch}
          repertoire={repertoire}
          atleta={atleta}
          categorias={categorias}
          duenoId={duenoId}
          masterId={masterId}
          onEjercicioCreado={onEjercicioCreado}
          onCategoriaCreada={onCategoriaCreada}
          onCategoriaBorrada={onCategoriaBorrada}
          soloLectura={soloLectura}
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
    <div {...arrastre} style={tarjetaDeSesion(day)}>
      <DayHeader
        day={day} onPatch={onPatch} onDelete={onDelete} onCopy={onCopy} onSaveToCatalog={onSaveToCatalog} onApplyCatalog={onApplyCatalog}
        onClear={onClear} conVista={!descanso} vistaFuera={vistaFuera} soloLectura={soloLectura}
        plegable={plegable} plegada={plegada} onPlegar={onPlegar} turno={turno} onTurno={onTurno}
      />

      {/* Plegado: solo la cabecera y cuánto trae. */}
      {plegada && (
        <div style={{ margin: '8px 0 0 42px', fontSize: 12.5, fontWeight: 600, color: T.text2 }}>
          {pluralS(nSets, 'set')} · {pluralS(blocks.reduce((n, b) => n + (b.type === 'set' ? b.members.length : 0), 0), 'ejercicio')}
        </div>
      )}

      {!plegada && (
      <div {...enLectura(soloLectura)} style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 14, ...(soloLectura ? APAGADO : null) }}>
        {!soloLectura && nSets > 0 && <AvisoDeFormatos />}
        {blocks.map((b, bi) => {
          if (b.type === 'note') {
            return (
              <div
                key={bi} {...arrastrable({ lista: `${uid}:sets`, etiqueta: 'Nota', alMover: (de, a) => writeBlocks((bs) => mueveEn(bs, de, a)) })}
                style={{ display: 'flex', gap: 8, alignItems: 'center', background: T.accentBg, borderRadius: 12, padding: '9px 12px' }}
              >
                <StickyNote size={15} color={T.accent} style={{ flexShrink: 0 }} />
                <input
                  value={b.ex.text || ''}
                  onChange={(e) => writeBlocks((bs) => bs.map((x, k) => (k === bi ? { ...x, ex: { ...x.ex, text: e.target.value } } : x)))}
                  placeholder={t('Nota para el atleta…')}
                  style={{ ...inputStyle, background: 'transparent', border: 'none', padding: '4px 0', color: T.accent, fontWeight: 700, fontSize: 13 }}
                />
                {soloLectura && <IconBtn icon={ChevronUp} onClick={() => moveBlock(bi, -1)} disabled={bi === 0} />}
                {soloLectura && <IconBtn icon={ChevronDown} onClick={() => moveBlock(bi, 1)} disabled={bi === blocks.length - 1} />}
                <IconBtn icon={Trash2} danger onClick={() => quita({ aviso: 'Se quitó la nota' }, () => writeBlocks((bs) => bs.filter((_, k) => k !== bi)))} />
              </div>
            );
          }
          const setIdx = blocks.slice(0, bi + 1).filter((x) => x.type === 'set').length;
          const tag = setTag(b.members.length);
          return (
            <div
              key={bi} {...arrastrable({ lista: `${uid}:sets`, etiqueta: `Set ${setIdx}`, alMover: (de, a) => writeBlocks((bs) => mueveEn(bs, de, a)) })}
              style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 16, padding: 14 }}
            >
              <EncabezadoDelSet
                numero={setIdx} bloque={b} etiquetaDeTipo={tag}
                onCambio={(parche) => writeBlocks((bs) => bs.map((x, k) => (k === bi ? { ...x, ...parche } : x)))}
                onAgregar={() => setPickerCtx({ mode: 'add', blockIdx: bi })}
                {...(soloLectura ? { onSubir: () => moveBlock(bi, -1), onBajar: () => moveBlock(bi, 1), puedeSubir: bi > 0, puedeBajar: bi < blocks.length - 1 } : null)}
                onEliminar={() => quita({
                  pregunta: { titulo: `¿Eliminar el Set ${setIdx} completo?`, confirmar: 'Sí, eliminarlo', peligro: true },
                  aviso: `Se eliminó el Set ${setIdx}`,
                }, () => writeBlocks((bs) => bs.filter((_, k) => k !== bi)))}
              />
              {(() => {
                // Un solo juego de handlers. La tarjeta y la fila reciben
                // exactamente lo mismo; lo unico que cambia es como se dibuja.
                const props = (m, mi) => ({
                  ex: m,
                  repertoire,
                  atleta,
                  soloLectura,
                  arrastre: arrastrable({
                    lista: `${uid}:ej:${bi}`, etiqueta: m.name || 'Ejercicio',
                    alMover: (de, a) => writeBlocks((bs) => bs.map((x, k) => (k === bi ? { ...x, members: mueveEn(x.members, de, a) } : x))),
                  }),
                  // «Por vuelta» solo tiene sentido si el Set se repite, y sin reloj (ahí las vueltas son del formato).
                  rondas: b.formato ? null : rondasDe(b.rounds),
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
                  onRemove: () => quita({ aviso: `Se quitó ${m.name || 'el ejercicio'}` }, () => writeBlocks((bs) => bs
                    .map((x, k) => (k === bi ? { ...x, members: x.members.filter((_, kk) => kk !== mi) } : x))
                    .filter((x) => x.type !== 'set' || x.members.length > 0))),
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
      )}

      {/* Agregar contenido. En la compu los tres caben en una fila y da igual.
          En el telefono NO da igual: "Agregar set" es a lo que vienes, y los
          otros dos son casos sueltos. Si los tres pesan lo mismo, cada vez hay
          que leer los tres para encontrar el de siempre. Aqui el principal
          ocupa todo el ancho —imposible de fallar con el pulgar— y los otros
          dos van abajo, mas chicos, repartidos a la mitad. */}
      {soloLectura || plegada ? null : descanso ? (
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
export function HojaAcciones({ acciones, onClose }) {
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
                <span style={{ display: 'block', fontSize: 12.5, color: T.text2, marginTop: 2, lineHeight: 1.4 }}>{t(f.desc)}</span>
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

/* El color del tipo de la sesión, muy clarito, de fondo de toda la tarjeta (Andrés, 5 oct 2026: «que la card tuviera
   en un tono muy clarito el color de ese tipo de entrenamiento»; fondo al 9 % y borde al 32 %). Un color propio que
   no sea #RRGGBB se queda con la tarjeta blanca de siempre. */
const rgbDe = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)).join(',');
function tarjetaDeSesion(day) {
  const c = tipoDeSesion(day).c;
  const base = { borderRadius: 18, padding: 16, boxShadow: KP.shCard };
  if (!/^#[0-9a-f]{6}$/i.test(c || '')) return { ...base, background: T.bg2, border: `1px solid ${T.border}` };
  const rgb = rgbDe(c);
  return { ...base, background: `linear-gradient(rgba(${rgb},0.09), rgba(${rgb},0.09)), ${T.bg2}`, border: `1px solid rgba(${rgb},0.32)` };
}

/* PLEGAR un workout (solo con 2 o más en el día): botón blanco con borde y la flechita azul, para que se vea (Andrés, 5 oct
   2026: «el botoncito para desplegar casi no se ve»). Plegado deja solo la cabecera y su resumen. */
function BotonDePlegar({ plegada, onClick }) {
  return (
    <button
      type="button" onClick={onClick} aria-expanded={!plegada}
      aria-label={plegada ? 'Desplegar el workout' : 'Plegar el workout'} title={plegada ? 'Desplegar' : 'Plegar'}
      style={{
        width: 34, height: 34, borderRadius: 10, flexShrink: 0, cursor: 'pointer', display: 'grid', placeItems: 'center',
        border: `1px solid ${T.borderHi}`, background: T.bg2, color: T.accent, touchAction: 'manipulation',
      }}
    >
      {plegada ? <ChevronRight size={17} /> : <ChevronDown size={17} />}
    </button>
  );
}

// El turno de un workout: AM naranja, PM azul (los mismos colores que ve el atleta en sus tarjetas).
function InsigniaDeTurno({ turno }) {
  return (
    <span style={{
      fontSize: 10.5, fontWeight: 800, color: '#fff', borderRadius: 6, padding: '3px 7px', letterSpacing: 0.4, flexShrink: 0,
      background: turno === 'PM' ? T.accent : '#D97706',
    }}>
      {turno}
    </span>
  );
}

/* AM o PM es OPCIONAL: no sale solo, el coach lo pone si quiere (Andrés, 5 oct 2026: «nunca he entendido cómo funciona lo de
   AM y PM… que el coach pueda ponerlo si se le antoja»). Sin turno: «Poner AM» y «Poner PM»; con turno: cambiarlo o quitarlo. */
const opcionesDeTurno = (turno, onTurno) => (turno
  ? [
    { icon: turno === 'AM' ? Moon : Sun, texto: `Cambiar a ${turno === 'AM' ? 'PM' : 'AM'}`, onClick: () => onTurno(turno === 'AM' ? 'PM' : 'AM') },
    { icon: X, texto: 'Quitar turno', onClick: () => onTurno(null) },
  ]
  : [
    { icon: Sun, texto: 'Poner AM', onClick: () => onTurno('AM') },
    { icon: Moon, texto: 'Poner PM', onClick: () => onTurno('PM') },
  ]);

/**
 * La cabecera de un workout: [plegar] [AM/PM] [tipo ▾] [nombre] [Opciones ▾] [lista | tarjetas].
 *
 * Andrés, 5 oct 2026, con la maqueta aprobada: las herramientas del workout van en UN solo botón con nombre
 * («Opciones ▾», con su menú: Usar workout · Guardar workout · Copiar · Vaciar · Eliminar sesión) y el
 * interruptor de vista al final y a la derecha, en TODOS los workouts del día para que los botones queden en el mismo
 * lugar. Sin rótulos grises sobre las casillas ni contador de sets. En el celular el nombre ocupa su renglón y la
 * vista vive en el título del día (`vistaFuera`).
 *
 * Una acción que no se pasa no sale: así una sesión pegada al programa de otro (sin catálogo, sin copiar) reusa esta
 * misma cabecera. Con `soloLectura` el nombre y el tipo no se tocan; lo de abajo queda vivo, porque el interruptor solo
 * cambia cómo se ve.
 */
function DayHeader({
  day, onPatch, onDelete, onCopy, onSaveToCatalog, onApplyCatalog, onClear, dual, conVista = false, vistaFuera = false, soloLectura = false,
  plegable = false, plegada = false, onPlegar, turno = null, onTurno,
}) {
  const { user } = useAuth();
  const esCompu = useIsDesktop();
  const [enFilas, eligeVista] = useEnFilas();
  // Abierto: { ancla } (el botón al que se pega el menú).
  const [menu, setMenu] = useState(null);
  const acciones = [
    // Un día doble no recibe un workout; una sesión vacía no ofrece guardarse.
    ...(!dual && onApplyCatalog ? [{ icon: FolderOpen, texto: 'Usar workout', onClick: onApplyCatalog }] : []),
    ...(onSaveToCatalog ? [{ icon: Save, texto: 'Guardar workout', onClick: onSaveToCatalog }] : []),
    ...(onCopy ? [{ icon: Copy, texto: 'Copiar', onClick: onCopy }] : []),
    ...(!dual && onClear ? [{ icon: Eraser, texto: 'Vaciar', onClick: onClear }] : []),
    ...(onTurno ? opcionesDeTurno(turno, onTurno) : []),
    ...(onDelete ? [{ icon: Trash2, texto: 'Eliminar sesión', onClick: onDelete, peligro: true }] : []),
  ];
  return (
    <>
      {/* `data-cab-arrastre`: desde los botones de esta cabecera también se agarra el workout para cambiarlo de lugar. */}
      <div data-cab-arrastre="" style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {plegable && <BotonDePlegar plegada={plegada} onClick={onPlegar} />}
        {turno && <InsigniaDeTurno turno={turno} />}
        {/* Una base de 140 px (200 en el celular) y no `flex: 1` pelado: con `flex: 1` la base es 0, así que el nombre nunca
            bajaba de renglón y se encogía para dejarle sitio al tipo. En el celular va primero y ocupa su renglón; en una
            ventana de 1024 px todo cabe en una fila. */}
        <div
          {...enLectura(soloLectura)}
          style={{ flex: esCompu ? '1 1 140px' : '1 1 200px', minWidth: 0, order: esCompu ? undefined : -1, ...(esCompu ? null : { flexBasis: '100%' }), ...(soloLectura ? APAGADO : null) }}
        >
          {/* En un día de dos sesiones el nombre casi nunca está guardado: la app del atleta arma el título con las dos
              ("AM Velocidad máxima · PM French Contrast"). Aquí se enseña lo mismo como sugerencia gris —no se
              escribe nada en el plan—, con el turno delante y sin «+», que se leía como una sola sesión. */}
          <input
            value={day.name || ''}
            onChange={(e) => onPatch({ name: e.target.value })}
            placeholder={dual && day.blocks?.length ? textoDeSesiones(sesionesDelTitulo({ blocks: day.blocks })) : undefined}
            aria-label="Nombre del workout"
            style={{ ...inputStyle, fontSize: 16, fontWeight: 800, padding: '9px 12px' }}
          />
        </div>
        {/* Era un <select>: en el iPhone, la rueda gris del sistema. Ahora es la lista de la app, con los colores a la
            vista y con los tipos que el propio coach se haya creado. */}
        <div
          {...enLectura(soloLectura)}
          style={{ ...(esCompu ? { flex: '0 1 170px', minWidth: 140 } : { flex: '1 1 100px', minWidth: 100 }), ...(soloLectura ? APAGADO : null) }}
        >
          <SelectorTipoSesion day={day} onPatch={onPatch} coachId={user?.id} />
        </div>
        {acciones.length > 0 && (
          <button
            type="button" className="kp-pill" aria-haspopup="menu" aria-label="Opciones del workout"
            onClick={(e) => setMenu({ ancla: e.currentTarget })}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, flexShrink: 0, marginLeft: 'auto', cursor: 'pointer',
              border: `1.5px solid ${T.border}`, background: T.bg2, color: T.text, fontFamily: FONT, fontWeight: 700,
              ...(esCompu ? { fontSize: 14, padding: '10px 13px', borderRadius: 11 } : { fontSize: 13, padding: '8px 12px', borderRadius: 999 }),
            }}
          >
            Opciones <ChevronDown size={14} color={T.text3} />
          </button>
        )}
        {/* Cómo se ven los ejercicios de abajo: filas o tarjetas. Sin ejercicios que ver (un día de descanso) no se ofrece. */}
        {conVista && !vistaFuera && (
          <span style={{ marginLeft: acciones.length ? 4 : 'auto', display: 'inline-flex' }}>
            <InterruptorVista vista={enFilas ? 'lista' : 'tarjetas'} onCambio={eligeVista} />
          </span>
        )}
      </div>

      {menu && (
        <MenuDeAcciones titulo="Sesión" ancla={menu.ancla} onClose={() => setMenu(null)} acciones={acciones} />
      )}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Builder principal                                                    */
/* ------------------------------------------------------------------ */

/** El borde de la guía: se arrastra para ensanchar (ver `useGuiaAncha`). Una raya azul al pasar el mouse. */
function DivisorDeLaGuia({ ancho, min, max, borde }) {
  const [encima, setEncima] = useState(false);
  return (
    <div
      role="separator" aria-orientation="vertical" aria-label="Ancho de la guía" aria-valuemin={min} aria-valuemax={max} aria-valuenow={ancho}
      tabIndex={0} title="Arrastra para cambiar el ancho. Doble clic: tamaño original"
      onMouseEnter={() => setEncima(true)} onMouseLeave={() => setEncima(false)}
      {...borde}
      style={{ position: 'absolute', top: 0, bottom: 0, right: -14, width: 12, cursor: 'col-resize', touchAction: 'none', zIndex: 6, outline: 'none' }}
    >
      <i style={{ position: 'absolute', left: 4.5, top: 0, bottom: 0, width: 3, borderRadius: 2, background: encima ? T.accent : 'transparent', transition: 'background-color .12s' }} />
      <i style={{ position: 'absolute', left: 4, top: '50%', width: 4, height: 40, marginTop: -20, borderRadius: 3, background: encima ? T.accent : T.borderHi, transition: 'background-color .12s' }} />
    </div>
  );
}

/** Con la guía oculta: una tira Lun–Dom arriba del día para cambiar de día sin abrirla. */
function TiraDeDias({ dias, elegido, onElegir }) {
  return (
    <div role="group" aria-label="Días de la semana" style={{
      display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 4, background: T.bg2, border: `1px solid ${T.border}`,
      borderRadius: 13, padding: 4, marginBottom: 14,
    }}>
      {WEEKDAYS.map((clave) => {
        const primera = dias.find((d) => d.day === clave);
        const on = clave === elegido;
        return (
          <button
            key={clave} type="button" onClick={() => onElegir(clave)} aria-label={NOMBRE_DIA[clave]} aria-pressed={on}
            style={{
              border: 'none', cursor: 'pointer', borderRadius: 9, padding: '7px 0 6px', fontFamily: FONT, fontSize: 12, fontWeight: 800,
              background: on ? T.accent : 'transparent', color: on ? '#fff' : T.text2,
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            }}
          >
            {clave}
            <i style={{ width: 5, height: 5, borderRadius: 3, display: 'block', background: primera ? (on ? '#fff' : tipoDeSesion(primera).c) : 'transparent' }} />
          </button>
        );
      })}
    </div>
  );
}

export default function PlanBuilder({ athlete, planRow, onClose, onSaved, onDeleted, profesionalId = null, catalogo = null }) {
  const esCompu = useIsDesktop();
  const pregunta = useConfirmacion();
  const { avisa, trabajando } = useAviso();
  const { user } = useAuth();
  const { t } = usePalabras();
  // «Lista o tarjetas»: en el celular el interruptor vive en el título del día.
  const [enFilas, eligeVista] = useEnFilas();
  // La guía de la compu: su ancho (se arrastra), si está oculta y Ctrl+B. Ver `useGuiaAncha`.
  const { medir: medirGuia, ...guia } = useGuiaAncha();
  /* MODO MIS PLANES (`catalogo`). El MISMO editor, sin atleta: arma o edita un programa o una rutina que
     vive en «Mis planes» (Andrés, 2 oct 2026: «el editor quiero que se vea como el que ya uso
     normalmente»). Cambia solo lo que depende del atleta: arriba va el nombre del plan, no hay «Su
     video» ni «Aquí va», la forma se elige al crear y no se cambia después (cada forma se guarda en un
     sitio distinto) y guardar va a Mis planes. `catalogo`: { item, phases, estructura } para algo que ya
     existe, o { forma, carpetaId } para algo nuevo. */
  const enCatalogo = !!catalogo;
  const [filaCatalogo, setFilaCatalogo] = useState(catalogo?.item ?? null);
  // Una rutina semanal sin ninguna sesión es un programa fantasma: se abre como nuevo (se escoge la forma).
  const isNew = enCatalogo ? !catalogo.item : (!planRow || esProgramaFantasma(planRow.data));
  /* De quién es este programa: null = el del coach principal; con id = el de un
     profesional del EQUIPO del atleta. Del profesional salen los registros del
     atleta que se miran aquí (`wr:cursor@<profesional>`) y el lugar guardado. */
  const claveProfesional = planRow?.profesional_id ?? profesionalId ?? null;
  const sufijo = claveProfesional ? `@${claveProfesional}` : '';
  const [title, setTitle] = useState(() => (enCatalogo ? (catalogo.item?.nombre || '') : (planRow?.title || t('Plan de entrenamiento'))));
  const [phases, setPhases] = useState(() => {
    if (enCatalogo) return catalogo.phases ? clone(catalogo.phases) : fasesDeLaForma(catalogo.forma);
    return planRow?.data?.phases ? clone(planRow.data.phases) : [];
  });
  // La forma del plan: 'rutina' | 'semanas' | 'fases' (ver `estructuraDelPlan`).
  // De ella sale `kind`: 'weekly' para la rutina, 'periodized' para las otras.
  const [estructura, setEstructura] = useState(() => {
    if (enCatalogo) return catalogo.estructura || catalogo.forma || 'fases';
    return planRow ? estructuraDelPlan(planRow.data) : 'fases';
  });
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
    return lugarDelPlan(leeLugar(user?.id, `plan.${athlete.id}${sufijo}`), planRow?.data?.phases ?? []);
  });
  /* Un plan que ya existe abre SIEMPRE en la hoja, con una fase abierta. La
     lista de fases como pantalla aparte se fue el 24 sep 2026: la hoja ya las
     enseña todas. Ver `NavegadorDelPlan`. */
  const [nav, setNav] = useState(() => {
    // En Mis planes la forma ya se eligió en el Centro de creación: no hay pantalla de inicio.
    if (enCatalogo) return isNew && catalogo.forma === 'semanas' ? { level: 'wizard' } : { level: 'phase', pi: 0 };
    return isNew ? { level: 'start' } : { level: 'phase', pi: restaurado?.pi ?? 0 };
  });
  const [weekIdx, setWeekIdx] = useState(restaurado?.wi ?? 0);
  const [activeWeekday, setActiveWeekday] = useState(
    () => restaurado?.dia ?? diaParaSemana(phases[0]?.weekData?.[0], 'Lun'),
  );
  // En el teléfono la hoja y el editor del día no caben juntos: tocar un día
  // abre su editor a pantalla completa, con flecha para volver a la hoja.
  const [editandoDiaTel, setEditandoDiaTel] = useState(restaurado?.editandoDiaTel ?? false);
  // Qué menú de tres puntos está abierto: { tipo: 'plan' | 'fase' | 'semana', pi }.
  const [menu, setMenu] = useState(null);
  /* EL HISTORIAL (Ctrl/⌘+Z) y «¿hay algo sin guardar?» (ver `useHistorial`). Lo que se deshace: el título, las fases y la
     forma; y con cada foto, dónde estaba quien edita (fase, semana, día) para volver ahí. */
  const raizRef = useRef(null);
  // Qué workouts están plegados (cosa de la pantalla, no del plan): al deshacer vuelven como estaban.
  const plegadas = usePlegadas();
  const hist = useHistorial({
    raiz: raizRef,
    leer: () => ({ title, phases, estructura, lugar: { nav, wi: weekIdx, dia: activeWeekday, pl: plegadas.pl } }),
    aplicar: (foto) => {
      setTitle(foto.title);
      setPhases(foto.phases);
      setEstructura(foto.estructura);
      plegadas.restaura(foto.lugar.pl);
      const { nav: n, wi, dia } = foto.lugar;
      if (n.level === 'phase' && foto.phases.length) {
        const pi = Math.max(0, Math.min(n.pi, foto.phases.length - 1));
        const semanas = foto.phases[pi].weekData ?? [];
        const w = Math.max(0, Math.min(wi, semanas.length - 1));
        setNav({ level: 'phase', pi });
        setWeekIdx(w);
        setActiveWeekday(diaParaSemana(semanas[w], dia));
      } else {
        setNav(n.level === 'phase' ? { level: 'start' } : n);
      }
    },
    alCambiar: (que) => avisa(que === 'deshacer' ? 'Cambio deshecho' : 'Cambio rehecho'),
  });
  const dirty = hist.sucio;
  const avisaConDeshacer = (texto) => avisa(texto, { accion: { texto: 'Deshacer', alTocar: hist.deshacer } });
  /* LA PREGUNTA DE GUARDAR (Andrés, 5 oct 2026: «para todos los botones de guardar, cuando estás trabajando sobre algo que
     tiene un avance, que la app pregunte si es guardar una nueva versión o actualizar la que ya tenías»; en producción, sin
     título: solo las dos opciones). Sale pegada al botón (o como hoja de abajo en el celular):
       · «Actualizar avance» guarda encima de lo que ya estaba guardado;
       · «Guardar nuevo» abre la ventana de siempre (nombre y carpeta) y crea otra copia.
     `guardados`: lo que ya se guardó en Mis planes desde esta pantalla (el plan, una semana, un workout), para no hacer otra
     copia igual cada vez. `preguntaGuardar`: { ancla, alActualizar, alNuevo }. */
  const guardados = useRef({});
  const [preguntaGuardar, setPreguntaGuardar] = useState(null);
  const botonGuardarRef = useRef(null);
  const ctxHistorial = useMemo(() => ({ deshacer: hist.deshacer }), [hist.deshacer]);
  const [saving, setSaving] = useState(false);
  // Ya se guardó en esta sesión del editor: el botón dice "Guardado" hasta
  // que se vuelva a cambiar algo.
  const [haGuardado, setHaGuardado] = useState(false);
  const [err, setErr] = useState('');
  // El repertorio y las categorías que ve esta persona (lo comparte el editor de workouts de Mis planes).
  const {
    repertoire, setRepertoire, setCategorias, masterIdCat, categoriasVisibles,
  } = useRepertorioDelEditor();
  const [clipboard, setClipboard] = useState(null);
  const [modal, setModal] = useState(null);

  const [wizWeeks, setWizWeeks] = useState(4);
  const [wizDays, setWizDays] = useState(['Lun', 'Mié', 'Vie']);

  // Al entrar al editor de una fase, arrancar en su primera semana / primer día con sesión
  const openPhase = (pi, wi = 0) => {
    const p = phases[pi];
    const w = p?.weekData[wi];
    setWeekIdx(wi);
    setActiveWeekday(w?.days?.[0]?.day || 'Lun');
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
      .then((st) => st?.data?.[`wr:cursor${sufijo}`] ?? null, () => null)
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
  }, [athlete?.id, isNew, planRow, sufijo]);
  const aquiAtleta = useMemo(
    () => (cursorAtleta === undefined ? null : dondeVa(phases, kind, cursorAtleta)),
    [phases, kind, cursorAtleta],
  );
  /* Las fases abiertas de la guía y la semana que se ve en cada una (ver `useFasesAbiertas`). Lo que se edita
     ahora es la fase `nav.pi` y su semana `weekIdx`. */
  const faseEditada = nav.level === 'phase' ? phases[nav.pi] : null;
  const semanaEditada = faseEditada?.weekData?.[Math.max(0, Math.min(weekIdx, (faseEditada?.weekData?.length ?? 1) - 1))];
  const { abiertas, vistas, abre: abreFaseEnGuia, cierra: cierraFaseEnGuia } = useFasesAbiertas(faseEditada?.id ?? null, semanaEditada?.num);

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
  };

  // Dónde está el coach en este plan, para volver ahí al refrescar (ver
  // `lugar.js`). Solo con un plan que ya existe y con una fase abierta.
  useEffect(() => {
    if (isNew || !athlete?.id || nav.level !== 'phase') return;
    guardaLugar(user?.id, `plan.${athlete.id}${sufijo}`, {
      pi: nav.pi, wi: weekIdx, dia: activeWeekday, tel: editandoDiaTel,
    });
  }, [isNew, athlete?.id, user?.id, nav, weekIdx, activeWeekday, editandoDiaTel, sufijo]);

  // Y cuánto había bajado, en esta hoja o en este día (`main` es lo que se
  // desplaza, no la ventana).
  useScrollLugar(
    !isNew && athlete?.id && nav.level === 'phase'
      ? `plan.${athlete.id}${sufijo}.${nav.pi}.${weekIdx}.${activeWeekday}.${editandoDiaTel ? 'dia' : 'hoja'}`
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

  // Ctrl/⌘+B oculta o muestra la guía (solo en la compu).
  const alternarGuia = guia.alternar;
  useEffect(() => {
    if (!esCompu) return undefined;
    const alTeclear = (e) => {
      if ((e.metaKey || e.ctrlKey) && !e.altKey && !e.shiftKey && e.key.toLowerCase() === 'b') { e.preventDefault(); alternarGuia(); }
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, [esCompu, alternarGuia]);
  // Lo que mide la zona que se desplaza: la guía se queda quieta a esa altura mientras el día se mueve.
  const [altoMain, setAltoMain] = useState(700);
  useEffect(() => {
    const el = mainRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const medir = () => setAltoMain(el.clientHeight);
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    return () => ro.disconnect();
  }, [esCompu, nav.level]);

  const touch = (fn) => { hist.registra(); setPhases(fn); };
  const cambiaTitulo = (v) => { hist.registra(); setTitle(v); };
  const patchPhase = (pi, patch) => touch((ps) => ps.map((p, i) => (i === pi ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p)));
  const patchWeek = (pi, wi, patch) => patchPhase(pi, (p) => ({
    weekData: p.weekData.map((w, j) => (j === wi ? { ...w, ...(typeof patch === 'function' ? patch(w) : patch) } : w)),
  }));
  const patchDay = (pi, wi, di, patch) => patchWeek(pi, wi, (w) => ({
    days: w.days.map((d, k) => (k === di ? { ...d, ...(typeof patch === 'function' ? patch(d) : patch) } : d)),
  }));

  /* Lo que va a Mis planes de lo que hay en pantalla: una rutina semanal es una «rutina» (los días de su
     semana) y lo demás un «programa». */
  const datosDelCatalogo = () => {
    const lista = normalize(phases);
    return estructura === 'rutina'
      ? { tipo: 'rutina', data: rutinaDePlan({ phases: lista }) }
      : { tipo: 'programa', data: programaDePlan({ kind, estructura, phases: lista }) };
  };
  /* Lo que se manda a Mis planes, igual que lo arman las ventanas de guardar; `notas` y `todo` son lo que se contestó la
     última vez (sin contestar, todo se incluye). */
  const datosDelPlanParaMisPlanes = (notas) => {
    const { tipo, data } = datosDelCatalogo();
    return notas === false ? sinNotas(tipo, data) : data;
  };
  const datosDeLaSemanaParaMisPlanes = (semana, notas) => {
    const data = rutinaDeSemana(semana);
    return notas === false ? sinNotas('rutina', data) : data;
  };
  const datosDelDiaParaMisPlanes = (sesion, delDia, { todo, notas } = {}) => {
    const data = workoutDeSesiones(delDia.length > 1 && todo !== false ? delDia : [sesion]);
    return notas === false ? sinNotas('workout', data) : data;
  };
  /* Guardar en Mis planes lo de esta pantalla. Si ya se guardó desde aquí, pregunta; si no, la ventana de siempre.
     `datos(previo)`: lo que se escribe al actualizar, con lo que se contestó la primera vez. */
  const guardaEnMisPlanes = (clave, ancla, { dialogo, datos }) => {
    const previo = guardados.current[clave];
    if (!previo) { setModal(dialogo); return; }
    setPreguntaGuardar({
      ancla,
      alActualizar: async () => {
        try {
          const fila = await trabajando('Actualizando…', () => actualizarItem(previo.fila, { nombre: previo.fila.nombre, data: datos(previo) }), 'Avance actualizado');
          guardados.current[clave] = { ...previo, fila };
        } catch (e) {
          setErr(e.message || 'No se pudo actualizar');
        }
      },
      alNuevo: () => setModal(dialogo),
    });
  };
  // De dónde sale lo que se guarda: «Del plan de Juan» o «Creado desde cero».
  const origenDelPlan = athlete ? `Del plan de ${athlete.full_name || athlete.username}` : 'Creado desde cero';
  // La casilla de «¿incluir mis notas?»: solo sale si hay notas que dejar fuera.
  const casillaDeNotas = (tipo, data) => (tieneNotas(tipo, data) ? [{
    clave: 'notas', etiqueta: '¿Incluir mis notas?', inicial: true,
    ayuda: 'Las notas del día y las notas sueltas dentro de las sesiones. Las indicaciones de cada ejercicio se quedan.',
  }] : []);

  async function onSave({ nuevo = false } = {}) {
    if (!title.trim()) { setErr(t('Ponle un título al plan')); return; }
    if (phases.length === 0) { setErr(t('El plan necesita al menos una fase')); return; }
    /* UNA RUTINA SIN NINGUNA SESIÓN. Borrar la única sesión de una rutina suele querer decir «ya
       no quiero esta rutina» (Andrés, 1 oct 2026, el fisio): guardarla vacía dejaba un programa
       fantasma. Si ya existía, se pregunta si quitarla; si era nueva, no tiene caso guardarla. */
    if (esProgramaFantasma({ kind, phases })) {
      if (!planRow) { setErr('Agrega al menos una sesión antes de guardar.'); return; }
      const va = await pregunta({
        titulo: 'La rutina se quedó sin sesiones',
        detalle: `Guardada así no hay nada que ${t('el atleta')} pueda hacer. ¿La quito?`,
        confirmar: 'Sí, quitarla',
        cancelar: 'Seguir editando',
        peligro: true,
      });
      if (va) await eliminarPrograma({ sinPreguntar: true });
      return;
    }
    // Lo que se está guardando es ESTE estado: si se sigue escribiendo mientras tarda, eso queda sin guardar.
    const idAlGuardar = hist.idActual();
    if (enCatalogo) {
      // Algo NUEVO (o «Guardar nuevo») pregunta primero dónde guardarlo; algo que ya existe se actualiza.
      if (!filaCatalogo || nuevo) { setModal({ type: 'guardar-catalogo' }); return; }
      setErr('');
      setSaving(true);
      try {
        const fila = await actualizarItem(filaCatalogo, { nombre: title.trim(), data: datosDelCatalogo().data });
        setFilaCatalogo(fila);
        hist.marcaGuardado(idAlGuardar);
        setHaGuardado(true);
        onSaved?.(fila);
      } catch (e) {
        setErr(e.message || 'Error al guardar');
      } finally {
        setSaving(false);
      }
      return;
    }
    setErr('');
    setSaving(true);
    try {
      const data = normalize(phases);
      const row = planRow
        ? await updatePlan(planRow.id, { title: title.trim(), phases: data, kind, estructura })
        : await createPlan({ userId: athlete.id, title: title.trim(), phases: data, kind, estructura, createdBy: user?.id, profesionalId });
      hist.marcaGuardado(idAlGuardar);
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
  // Las fases se mueven arrastrándolas (de un lugar al lugar `a`). La fase que se edita sigue a su contenido, no a su posición.
  const moverFaseA = (de, a) => {
    const idEditada = phases[nav.pi]?.id;
    touch((ps) => mueveEn(ps, de, a));
    const ni = mueveEn(phases, de, a).findIndex((f) => f.id === idEditada);
    if (ni >= 0) setNav({ level: 'phase', pi: ni });
  };
  const duplicarFase = (pi) => {
    touch((ps) => {
      const c = clone(ps[pi]);
      c.id = `p-${rid()}`; c.num = nextPhaseNum(ps); c.name = `${c.name} (copia)`;
      return [...ps.slice(0, pi + 1), c, ...ps.slice(pi + 1)];
    });
    // Se abre la copia: agregar algo y quedarte donde estabas se lee como que
    // no pasó nada.
    setNav({ level: 'phase', pi: pi + 1 });
    setWeekIdx(0);
  };
  const eliminarFase = async (pi) => {
    const ph = phases[pi];
    if (!ph || phases.length <= 1) return;
    // De inmediato y con «Deshacer»: equivocarse se arregla con un toque (y con Ctrl+Z).
    touch((ps) => ps.filter((_, i) => i !== pi));
    const abierta = nav.pi > pi ? nav.pi - 1 : nav.pi;
    setNav({ level: 'phase', pi: Math.max(0, Math.min(abierta, phases.length - 2)) });
    if (nav.pi === pi) setWeekIdx(0);
    avisaConDeshacer(`Se eliminó la fase «${ph.name}»`);
  };
  const agregarFase = () => {
    touch((ps) => [...ps, newPhase(nextPhaseNum(ps))]);
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
  // Las otras semanas pierden lo que tengan y quedan igual que esta: se hace de inmediato y se avisa con «Deshacer».
  const copiarSemanaATodas = () => {
    const wi = semanaAbierta();
    if (deCorrido) {
      const dias = phases[nav.pi].weekData[wi].days;
      touch((ps) => ps.map((ph, pi) => ({
        ...ph,
        weekData: ph.weekData.map((wk, j) => (pi === nav.pi && j === wi ? wk : { ...wk, days: clone(dias) })),
      })));
    } else {
      patchPhase(nav.pi, (ph) => ({
        weekData: ph.weekData.map((wk, j) => (j === wi ? wk : { ...wk, days: clone(ph.weekData[wi].days) })),
      }));
    }
    avisaConDeshacer(deCorrido ? 'Copiada a las demás semanas del plan' : 'Copiada a las demás semanas de la fase');
  };
  const eliminarSemana = async () => {
    const ph = phases[nav.pi];
    const wi = semanaAbierta();
    const wk = ph?.weekData?.[wi];
    // En "varias semanas" se puede borrar mientras quede alguna en el plan: si
    // era la única de su fase escondida, se va la fase entera.
    const quedaOtra = deCorrido ? semanasDelPlan(phases) > 1 : ph?.weekData?.length > 1;
    if (!wk || !quedaOtra) return;
    const nombre = nombreSemana(ph, wk);
    if (ph.weekData.length <= 1) {
      const anterior = Math.max(0, nav.pi - 1);
      touch((ps) => ps.filter((_, i) => i !== nav.pi));
      setNav({ level: 'phase', pi: anterior });
      setWeekIdx(nav.pi > 0 ? (phases[anterior]?.weekData?.length ?? 1) - 1 : 0);
    } else {
      patchPhase(nav.pi, (p2) => ({ weekData: p2.weekData.filter((_, j) => j !== wi) }));
      setWeekIdx(Math.max(0, wi - 1));
    }
    avisaConDeshacer(`Se eliminó «${nombre}»`);
  };

  /* LO QUE HACE LA GUÍA (`GuiaDelEditor`). Tocar algo DENTRO de una fase —una semana, un día, sus opciones— la vuelve
     la fase que se edita; abrirla o cerrarla no cambia lo que se edita (Andrés, 5 oct 2026, maqueta aprobada). */
  const editaEn = (pi, num) => {
    yaNavego.current = true;
    const ph = phases[pi];
    const wi = Math.max(0, (ph?.weekData ?? []).findIndex((x) => x.num === num));
    const semana = ph?.weekData?.[wi];
    setNav({ level: 'phase', pi });
    setWeekIdx(wi);
    setActiveWeekday((d) => diaParaSemana(semana, d));
  };
  const volverAquiDelAtleta = () => {
    const i = aquiAtleta ? phases.findIndex((f) => f.id === aquiAtleta.faseId) : -1;
    if (i < 0) return;
    abreFaseEnGuia(phases[i].id);
    editaEn(i, aquiAtleta.semana);
    // «Ir a donde va» abre en SU día.
    const suDia = aquiAtleta.dia != null
      ? phases[i].weekData.find((x) => x.num === aquiAtleta.semana)?.days?.[aquiAtleta.dia]?.day : null;
    if (suDia) setActiveWeekday(suDia);
  };
  const accionesDeLaGuia = {
    abrir: (i) => { yaNavego.current = true; abreFaseEnGuia(phases[i].id); },
    cerrar: (i) => cierraFaseEnGuia(phases[i].id),
    elegirSemana: (i, num) => editaEn(i, num),
    elegirDia: (i, num, clave) => { editaEn(i, num); setActiveWeekday(clave); abreEditorTel(); },
    nombreFase: (i, nombre) => patchPhase(i, { name: nombre }),
    colorFase: (i, color) => patchPhase(i, { color }),
    duplicarFase: (i) => { yaNavego.current = true; duplicarFase(i); },
    eliminarFase: (i) => { yaNavego.current = true; eliminarFase(i); },
    moverFaseA: (de, a) => { yaNavego.current = true; moverFaseA(de, a); },
    tituloSemana: (i, num, titulo) => {
      const wi = (phases[i]?.weekData ?? []).findIndex((x) => x.num === num);
      if (wi >= 0) patchWeek(i, wi, { label: titulo });
    },
    agregarSemana: (i) => { yaNavego.current = true; agregarSemana(i); },
    opcionesSemana: (i, num, ancla) => { editaEn(i, num); setMenu({ tipo: 'semana', ancla }); },
    agregarFase: () => { yaNavego.current = true; agregarFase(); },
    volverAqui: volverAquiDelAtleta,
  };

  /* ELIMINAR EL PROGRAMA ENTERO. Andrés, 1 oct 2026 (el fisio): «si quiere borrar la rutina
     que le puso, no hay una opción de eliminar». Había «Eliminar sesión», pero borrar
     la única sesión dejaba un programa vacío vivo: «editar mi programa», «ver el programa»
     en blanco. Aquí está la salida: desde los tres puntos del plan. Se puede recuperar en
     «Cambios del plan» (la base guarda la versión). */
  const eliminarPrograma = async ({ sinPreguntar = false } = {}) => {
    if (enCatalogo) {
      if (!filaCatalogo) return;
      const va = await pregunta({
        titulo: `¿Eliminar «${filaCatalogo.nombre}» de Mis planes?`,
        detalle: 'No se puede recuperar. Los atletas que ya lo recibieron lo conservan: lo que se les dio es una copia.',
        confirmar: 'Sí, eliminarlo',
        peligro: true,
      });
      if (!va) return;
      try {
        await borrarItem(filaCatalogo);
        hist.marcaGuardado();
        onDeleted?.();
      } catch (e) {
        setErr(e.message || 'No se pudo eliminar');
      }
      return;
    }
    if (!planRow) return;
    const va = sinPreguntar || await pregunta({
      titulo: `${t('¿Eliminar el plan')} "${planRow.title || ''}"?`,
      detalle: `${t('Es el plan de')} ${athlete.full_name || athlete.username}. ${t('Si te equivocas, lo recuperas en "Cambios del plan".')}`,
      confirmar: 'Sí, eliminarlo',
      peligro: true,
    });
    if (!va) return;
    try {
      await deletePlan(planRow.id);
      hist.marcaGuardado();
      onDeleted?.();
    } catch (e) {
      setErr(e.message || 'No se pudo eliminar');
    }
  };

  /* El botón «Guardar» de arriba. Un programa o una rutina de Mis planes que YA existe pregunta (actualizar o guardar otro). El
     plan de un atleta guarda directo: la base ya guarda cada versión anterior en «Cambios del plan», y un atleta solo puede
     tener un plan activo por profesional, así que «Guardar nuevo» no tendría dónde caer. */
  const pideGuardarPrincipal = (ancla) => {
    if (enCatalogo && filaCatalogo) {
      setPreguntaGuardar({ ancla, alActualizar: () => onSave(), alNuevo: () => onSave({ nuevo: true }) });
      return;
    }
    onSave();
  };
  // Ctrl/⌘+S = el botón «Guardar». Siempre le gana al «guardar página» del navegador; solo guarda si hay algo sin guardar.
  const guardarConAtajo = useRef(null);
  useLayoutEffect(() => {
    guardarConAtajo.current = () => {
      if (dirty && !saving && nav.level !== 'start' && nav.level !== 'wizard') pideGuardarPrincipal(botonGuardarRef.current);
    };
  });
  useEffect(() => {
    const alTeclear = (e) => {
      if (!(e.metaKey || e.ctrlKey) || e.altKey || e.shiftKey || e.isComposing || e.key.toLowerCase() !== 's') return;
      if (enVentanaFlotante(e.target, raizRef.current)) return;
      e.preventDefault();
      guardarConAtajo.current?.();
    };
    document.addEventListener('keydown', alTeclear);
    return () => document.removeEventListener('keydown', alTeclear);
  }, []);
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
    setNav({ level: 'phase', pi: 0 });
  }

  /* Volver. En el teléfono, desde el editor de un día se vuelve a la hoja; y
     desde la hoja, se sale. Ya no hay pantalla de fases a la que subir: la
     hoja las enseña todas. */
  const goBack = () => {
    if (!esCompu && nav.level === 'phase' && editandoDiaTel) { vuelveALaHoja(); return; }
    handleClose();
  };

  /* LO DEL PROGRAMA ENTERO. La barra de arriba (compu) y el bloque de arriba de la guía (celular) —`EditorBarra` y
     `BloqueDelPrograma`— reciben lo mismo, ya resuelto aquí. */
  const botonGuardar = nav.level !== 'start' && nav.level !== 'wizard' && (
    <button
      ref={botonGuardarRef} type="button" onClick={(ev) => pideGuardarPrincipal(ev.currentTarget)} disabled={saving || !dirty}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 18px', borderRadius: 12,
        border: 'none', cursor: saving || !dirty ? 'default' : 'pointer',
        background: dirty ? `linear-gradient(135deg, ${T.accent}, ${T.accentDk})` : T.bg3,
        // Recién guardado, en verde: se lee como "listo", no como botón apagado.
        color: dirty ? '#fff' : (haGuardado ? KP.mint : T.text3), fontFamily: FONT, fontSize: 14, fontWeight: 800,
        boxShadow: dirty ? KP.shBtn : 'none', opacity: saving ? 0.75 : 1, flexShrink: 0,
      }}
    >
      {saving ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
      {!dirty && haGuardado ? 'Guardado' : 'Guardar'}
    </button>
  );
  const barraNueva = esCompu && nav.level === 'phase';
  // En el celular, dentro de un día, la barra dice dónde estás: «Sem 2 · Fuerza base».
  const tituloDelCelular = isWeekly ? 'Rutina'
    : deCorrido ? `Sem ${numeroDeSemana(faseEditada, semanaEditada, weekIdx + 1)} de ${semanasDelPlan(phases)}`
      : `Sem ${semanaEditada?.num ?? weekIdx + 1} · ${faseEditada?.name || 'Fase'}`;
  const programa = {
    forma: FORMAS.find((f) => f.id === estructura) ?? FORMAS[2], puedeCambiar: !enCatalogo, onCambiar: () => setFormasAbiertas(true),
    puedeGuardar: !enCatalogo && planTieneContenido(phases), textoGuardar: isWeekly ? 'Guardar rutina' : t('Guardar plan'),
    onGuardar: (ev) => guardaEnMisPlanes('plan', ev?.currentTarget, {
      dialogo: { type: 'guardar-plan' }, datos: (previo) => datosDelPlanParaMisPlanes(previo.notas),
    }),
    onUsar: isWeekly ? () => setModal({ type: 'tpl-week' }) : undefined, textoUsar: 'Usar rutina', iconoUsar: FolderOpen,
    tituloUsar: 'Usar una rutina de Mis planes',
    onEliminar: (enCatalogo ? !!filaCatalogo : !!(planRow && onDeleted)) ? () => eliminarPrograma() : undefined,
    textoEliminar: enCatalogo ? 'Eliminar de Mis planes' : 'Eliminar programa',
  };

  /* ---------------- render por nivel ---------------- */
  let body = null;

  if (nav.level === 'start') {
    body = (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 560, margin: '24px auto 0' }}>
        <div style={{ fontSize: 15, color: T.text2, lineHeight: 1.55, textAlign: 'center', marginBottom: 6 }}>
          {t('¿Cómo quieres armar el plan de')} <b style={{ color: T.text }}>{athlete.full_name || athlete.username}</b>?
        </div>
        {FORMAS.map((forma) => ({
          ...forma,
          onClick: {
            rutina: () => { setEstructura('rutina'); startWeeklyPlan(); },
            semanas: () => { hist.registra(); setEstructura('semanas'); setNav({ level: 'wizard' }); },
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
              <span style={{ display: 'block', fontSize: 13, color: T.text2, marginTop: 3, lineHeight: 1.45 }}>{t(opt.desc)}</span>
            </span>
            <ChevronRight size={18} color={T.text3} style={{ marginLeft: 'auto', flexShrink: 0 }} />
          </button>
        ))}
        <button
          type="button" onClick={() => setModal({ type: 'desde-plan' })}
          style={{
            display: 'flex', gap: 14, alignItems: 'center', textAlign: 'left', cursor: 'pointer',
            background: T.bg2, border: `1.5px solid ${T.border}`, borderRadius: 18, padding: 18,
            fontFamily: FONT, boxShadow: KP.shCard,
          }}
        >
          <span style={{ width: 46, height: 46, borderRadius: 14, background: T.accentBg, color: T.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
            <FolderOpen size={22} />
          </span>
          <span>
            <span style={{ display: 'block', fontSize: 15.5, fontWeight: 800, color: T.text }}>Usar uno guardado</span>
            <span style={{ display: 'block', fontSize: 13, color: T.text2, marginTop: 3, lineHeight: 1.45 }}>
              Parte de un programa o una rutina de Mis planes y ajústalo.
            </span>
          </span>
          <ChevronRight size={18} color={T.text3} style={{ marginLeft: 'auto', flexShrink: 0 }} />
        </button>
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

    /* VARIOS WORKOUTS EL MISMO DÍA (varias entradas del plan con el mismo día de la semana). Cada uno se pliega, puede llevar
       AM o PM si el coach quiere (campo `turno`), y se reordenan arrastrándolos: el de la mañana sube, el de la tarde baja. Con
       uno solo no hay nada de eso. Al reordenar, las entradas de este día se cambian entre SUS lugares de la semana: los demás
       días no se mueven. */
    const variosWorkouts = daysOfWeekday.length > 1;
    const llavesDelDia = daysOfWeekday.map(({ di }) => `${p?.id}:${w?.num}:${di}`);
    const moverEntrada = (de, a) => {
      plegadas.reordena(llavesDelDia, de, a);
      patchWeek(nav.pi, wIdx, (wk) => {
        const lugares = daysOfWeekday.map((x) => x.di);
        const nuevas = mueveEn(lugares.map((i) => wk.days[i]), de, a);
        const days = [...wk.days];
        lugares.forEach((i, n) => { days[i] = nuevas[n]; });
        return { days };
      });
    };
    const propiedadesDeVariosWorkouts = (d, di, k) => ({
      clavePlegado: `${p?.id}:${w?.num}:${di}`,
      ...(variosWorkouts ? {
        plegable: true,
        plegada: !!plegadas.pl[llavesDelDia[k]],
        onPlegar: () => plegadas.alterna(llavesDelDia[k]),
        // Un día que ya trae sus sesiones adentro (`blocks`) lleva el turno en el nombre de cada una.
        turno: isDualDay(d) ? null : (d.turno ?? null),
        onTurno: isDualDay(d) ? undefined : (t) => patchDay(nav.pi, wIdx, di, { turno: t ?? undefined }),
        arrastre: propsDeArrastre({
          lista: `ses:${llavesDelDia[0]}`, etiqueta: d.name || 'Sesión', agarraDeBotonesEn: '[data-cab-arrastre]', alMover: moverEntrada,
        }),
      } : null),
    });

    const hoja = (
      <div>
        {!esCompu && (
          <BloqueDelPrograma
            titulo={title} rotuloTitulo={isWeekly ? 'Título de la rutina' : t('Título del plan')}
            onTitulo={cambiaTitulo} programa={programa}
          />
        )}
        <GuiaDelEditor
          fases={phases} estructura={estructura} aqui={aquiAtleta}
          faseEditada={nav.pi} semanaEditada={w?.num} diaElegido={activeWeekday}
          abiertas={abiertas} vistas={vistas} colores={PALETTE} tituloDeSemana={weekSubtitle}
          acciones={accionesDeLaGuia}
        />
      </div>
    );

    const editorDelDia = p && (
      <div>
        {/* En la compu el día no lleva título aparte («Fase 1 · Semana 1», «Lunes»): la guía —o la tira de días, con la
            guía oculta— ya dice cuál es (Andrés, 5 oct 2026). En el teléfono sí: la guía y el día son dos pantallas;
            el día se llama arriba y la barra dice «Sem N · Fase». */}
        {!esCompu && (
          <div style={{ marginBottom: 14, minWidth: 0, display: 'flex', alignItems: 'flex-end', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0, fontSize: 19, fontWeight: 800, color: T.text, letterSpacing: -0.3 }}>
              {NOMBRE_DIA[activeWeekday] || activeWeekday}
            </div>
            {daysOfWeekday.length > 0 && <InterruptorVista vista={enFilas ? 'lista' : 'tarjetas'} onCambio={eligeVista} />}
          </div>
        )}

        {!w ? (
          <div style={{ background: T.bg2, border: `1.5px dashed ${T.borderHi}`, borderRadius: 20, padding: '40px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: 16, fontWeight: 800, color: T.text }}>Esta fase todavía no tiene semanas</div>
            <div style={{ marginTop: 14 }}>
              <Pill primary icon={Plus} onClick={() => agregarSemana(nav.pi)}>Agregar semana</Pill>
            </div>
          </div>
        ) : (
          <>
            {/* Sesiones del día activo */}
            {daysOfWeekday.length === 0 ? (
              <div style={{ background: T.bg2, border: `1.5px dashed ${T.borderHi}`, borderRadius: 20, padding: '52px 24px', textAlign: 'center' }}>
                <div style={{ width: 70, height: 70, borderRadius: 22, background: T.accentBg, color: T.accent, display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
                  <CalendarDays size={30} />
                </div>
                <div style={{ fontSize: 17, fontWeight: 800, color: T.text }}>Sin sesión el {DAY_FULL_LOWER[activeWeekday] || activeWeekday.toLowerCase()}</div>
                <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 20, flexWrap: 'wrap' }}>
                  <button type="button"
                    onClick={() => patchWeek(nav.pi, wIdx, (wk) => ({ days: [...(wk.days || []), newDay(activeWeekday)] }))}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '12px 20px', borderRadius: 12, border: 'none', cursor: 'pointer', background: `linear-gradient(135deg, ${T.accent}, ${T.accentDk})`, color: '#fff', fontFamily: FONT, fontSize: 14, fontWeight: 800, boxShadow: KP.shBtn }}>
                    <Plus size={16} /> Agregar sesión
                  </button>
                  <Pill icon={FolderOpen} onClick={() => setModal({ type: 'tpl-day', payload: { di: null } })}>Usar workout</Pill>
                  {clipboard && (
                    <Pill icon={Clipboard} onClick={() => patchWeek(nav.pi, wIdx, (wk) => ({ days: [...(wk.days || []), { ...clone(clipboard), day: activeWeekday }] }))}>
                      Pegar rutina
                    </Pill>
                  )}
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {daysOfWeekday.map(({ d, di }, k) => (
                  <SessionEditor
                    key={di}
                    day={d}
                    vistaFuera={!esCompu}
                    {...propiedadesDeVariosWorkouts(d, di, k)}
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
                    onDelete={() => {
                      patchWeek(nav.pi, wIdx, (wk) => ({ days: wk.days.filter((_, k) => k !== di) }));
                      avisaConDeshacer(`Se eliminó «${d.name || d.day}»`);
                    }}
                    onCopy={() => setClipboard(clone(d))}
                    onClear={() => {
                      patchDay(nav.pi, wIdx, di, { exercises: [] });
                      avisaConDeshacer('Sesión vaciada');
                    }}
                    onSaveToCatalog={sesionTieneContenido(d)
                      ? (ancla) => {
                        const delDia = daysOfWeekday.map((x) => x.d);
                        guardaEnMisPlanes(`workout:${p.id}:${w.num}:${di}`, ancla, {
                          dialogo: { type: 'guardar-dia', payload: { sesion: d, delDia, di } },
                          datos: (previo) => datosDelDiaParaMisPlanes(d, delDia, previo),
                        });
                      }
                      : undefined}
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
                    <Plus size={16} /> Agregar otra sesión
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
      <div
        ref={medirGuia}
        style={{
          display: 'grid', gridTemplateColumns: guia.oculta ? 'minmax(0, 1fr)' : `${guia.ancho}px minmax(0, 1fr)`, columnGap: 16,
          maxWidth: 1776, margin: '0 auto', alignItems: 'start',
        }}
      >
        {/* La guía se queda quieta mientras el día de al lado se desplaza; su borde se arrastra para ensancharla. */}
        {!guia.oculta && (
          <div style={{ position: 'sticky', top: 12, height: Math.max(200, altoMain - 24), minWidth: 0 }}>
            <aside aria-label="Guía del programa" style={{ height: '100%', overflowY: 'auto', opacity: guia.porCerrar ? 0.4 : 1, transition: 'opacity .12s' }}>{hoja}</aside>
            <DivisorDeLaGuia ancho={guia.ancho} min={280} max={guia.tope} borde={guia.borde} />
          </div>
        )}
        <section style={{ minWidth: 0 }}>
          <div style={{ maxWidth: 1240, margin: '0 auto' }}>
            {guia.oculta && p && (
              <TiraDeDias
                dias={w?.days || []} elegido={activeWeekday}
                onElegir={(clave) => { yaNavego.current = true; setActiveWeekday(clave); }}
              />
            )}
            {editorDelDia}
          </div>
        </section>
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
    <HistorialContext.Provider value={ctxHistorial}>
    <PlegadasContext.Provider value={plegadas.valor}>
    <div ref={raizRef} style={{ position: 'fixed', inset: 0, zIndex: 2400, background: T.bg, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      {barraNueva ? (
        <EditorBarra
          titulo={title} rotuloTitulo={isWeekly ? 'Título de la rutina' : t('Título del plan')}
          onTitulo={cambiaTitulo}
          anchoGuia={guia.ancho} guiaOculta={guia.oculta} onAlternarGuia={guia.alternar}
          onVolver={goBack} onCerrar={handleClose} programa={programa}
          derecha={(
            <>
              <BotonesDeHistorial puedeDeshacer={hist.puedeDeshacer} puedeRehacer={hist.puedeRehacer} onDeshacer={hist.deshacer} onRehacer={hist.rehacer} />
              {botonGuardar}
            </>
          )}
        />
      ) : !esCompu && nav.level === 'phase' ? (
        <BarraDelCelular
          enDia={editandoDiaTel} titulo={tituloDelCelular} onVolver={goBack} onCerrar={handleClose}
          derecha={(
            <>
              <BotonesDeHistorial celular puedeDeshacer={hist.puedeDeshacer} puedeRehacer={hist.puedeRehacer} onDeshacer={hist.deshacer} onRehacer={hist.rehacer} />
              {botonGuardar}
            </>
          )}
        />
      ) : (
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
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('Estructura del plan')}</div>
          <div style={{ fontSize: 12, color: T.text2, fontWeight: 600 }}>
            {enCatalogo ? 'Mis planes' : (athlete.full_name || athlete.username)}{dirty ? ' · sin guardar' : (haGuardado ? ' · guardado' : '')}
          </div>
        </div>
        {botonGuardar}
        <button type="button" onClick={handleClose} aria-label="Cerrar"
          style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${T.border}`, cursor: 'pointer', background: T.bg2, color: T.text2, display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <X size={17} />
        </button>
      </header>
      )}

      {err && (
        <div style={{ maxWidth: 980, margin: '14px auto 0', width: 'calc(100% - 36px)', background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 12, padding: '11px 15px', fontWeight: 700, fontSize: 13.5 }}>
          {err}
        </div>
      )}

      <main ref={mainRef} style={{ flex: 1, overflowY: 'auto', padding: esCompu && nav.level === 'phase' ? '12px 16px 60px' : '20px 18px 60px' }}>{body}</main>

      {/* Modales */}
      {/* LOS MENÚS. Ya no hay «⋯»: cada objeto tiene su botón con nombre y su menú (Andrés, 5 oct 2026). El del
          programa vive en la barra de arriba (compu) o arriba de la guía (celular); el de la fase, en su
          encabezado; el de la semana, en su «Opciones ▾», y el de la sesión, en la sesión. */}
      {formasAbiertas && (
        <HojaFormas actual={estructura} onElegir={cambiarForma} onClose={() => setFormasAbiertas(false)} />
      )}
      {preguntaGuardar && (
        <MenuDeAcciones
          etiqueta="Guardar" ancla={preguntaGuardar.ancla} onClose={() => setPreguntaGuardar(null)}
          acciones={[
            { icon: RefreshCw, texto: 'Actualizar avance', onClick: preguntaGuardar.alActualizar },
            { icon: CopyPlus, texto: 'Guardar nuevo', onClick: preguntaGuardar.alNuevo },
          ]}
        />
      )}
      {menu?.tipo === 'semana' && curPhase && (() => {
        const semana = curPhase.weekData[curWeekIdx];
        const hayOtra = (deCorrido ? semanasDelPlan(phases) : curPhase.weekData.length) > 1;
        return (
          <MenuDeAcciones
            titulo={`Semana ${numeroDeSemana(curPhase, semana, curWeekIdx + 1)}`} ancla={menu.ancla} onClose={() => setMenu(null)}
            acciones={[
              { icon: CopyPlus, texto: 'Duplicar semana', onClick: duplicarSemana },
              ...(hayOtra ? [{ icon: Layers, texto: 'Copiar a todas', onClick: copiarSemanaATodas }] : []),
              { icon: FolderOpen, texto: 'Usar semana', onClick: () => setModal({ type: 'tpl-week' }) },
              ...(semanaTieneContenido(semana) ? [{
                icon: Save, texto: 'Guardar semana',
                onClick: (ancla) => guardaEnMisPlanes(`semana:${curPhase.id}:${semana.num}`, ancla, {
                  dialogo: { type: 'guardar-semana' }, datos: (previo) => datosDeLaSemanaParaMisPlanes(semana, previo.notas),
                }),
              }] : []),
              ...(hayOtra ? [{ icon: Trash2, texto: 'Eliminar semana', onClick: eliminarSemana, peligro: true }] : []),
            ]}
          />
        );
      })()}

      {/* GUARDAR EN MIS PLANES. Todo sale de la misma ventana: nombre, descripción, carpeta y, cuando hay
          notas, «¿incluir mis notas?» (se pregunta cada vez: Andrés, 2 oct 2026). */}
      {modal?.type === 'guardar-catalogo' && (() => {
        const { tipo, data } = datosDelCatalogo();
        return (
          <DialogoGuardar
            tipo={tipo} nombreInicial={title} carpetaInicial={catalogo?.carpetaId ?? null}
            onGuardar={async ({ nombre, descripcion, carpetaId }) => {
              const fila = await guardarItem({ tipo, nombre, descripcion, origen: 'Creado desde cero', carpetaId, data, userId: user?.id });
              setFilaCatalogo(fila);
              setTitle(fila.nombre);
              hist.marcaGuardado();
              setHaGuardado(true);
              onSaved?.(fila);
            }}
            onCerrar={() => setModal(null)}
          />
        );
      })()}
      {modal?.type === 'guardar-plan' && (() => {
        const { tipo, data } = datosDelCatalogo();
        return (
          <DialogoGuardar
            titulo={isWeekly ? 'Guardar rutina' : t('Guardar plan')}
            tipo={tipo} nombreInicial={title} interruptores={casillaDeNotas(tipo, data)} recordarCarpeta
            onGuardar={async ({ nombre, descripcion, carpetaId, interruptores }) => {
              const fila = await guardarItem({
                tipo, nombre, descripcion, origen: origenDelPlan, carpetaId, userId: user?.id,
                data: interruptores.notas === false ? sinNotas(tipo, data) : data,
              });
              guardados.current.plan = { fila, notas: interruptores.notas };
              avisa('Guardado en Mis planes');
            }}
            onCerrar={() => setModal(null)}
          />
        );
      })()}
      {modal?.type === 'guardar-semana' && curPhase && (() => {
        const semana = curPhase.weekData[curWeekIdx];
        const data = rutinaDeSemana(semana);
        return (
          <DialogoGuardar
            titulo="Guardar semana" tipo="rutina" recordarCarpeta
            nombreInicial={nombreSemana(curPhase, semana, curWeekIdx + 1)} interruptores={casillaDeNotas('rutina', data)}
            onGuardar={async ({ nombre, descripcion, carpetaId, interruptores }) => {
              const fila = await guardarItem({
                tipo: 'rutina', nombre, descripcion, origen: origenDelPlan, carpetaId, userId: user?.id,
                data: interruptores.notas === false ? sinNotas('rutina', data) : data,
              });
              guardados.current[`semana:${curPhase.id}:${semana.num}`] = { fila, notas: interruptores.notas };
              avisa('Guardado en Mis planes');
            }}
            onCerrar={() => setModal(null)}
          />
        );
      })()}
      {modal?.type === 'guardar-dia' && (() => {
        const { sesion, delDia } = modal.payload;
        const varias = delDia.length > 1;
        return (
          <DialogoGuardar
            titulo="Guardar workout" tipo="workout" nombreInicial={sesion.name || ''} recordarCarpeta
            interruptores={[
              ...(varias ? [{
                clave: 'todo', inicial: true,
                etiqueta: `Guardar también las otras ${delDia.length - 1} ${delDia.length === 2 ? 'sesión' : 'sesiones'} de este día`,
                ayuda: 'Se guardan juntas y se asignan juntas, como un día de doble sesión.',
              }] : []),
              ...casillaDeNotas('workout', workoutDeSesiones(varias ? delDia : [sesion])),
            ]}
            onGuardar={async ({ nombre, descripcion, carpetaId, interruptores }) => {
              const data = workoutDeSesiones(varias && interruptores.todo !== false ? delDia : [sesion]);
              const fila = await guardarItem({
                tipo: 'workout', nombre, descripcion, origen: origenDelPlan, carpetaId, userId: user?.id,
                data: interruptores.notas === false ? sinNotas('workout', data) : data,
              });
              guardados.current[`workout:${curPhase.id}:${curPhase.weekData[curWeekIdx].num}:${modal.payload.di}`] = {
                fila, notas: interruptores.notas, todo: interruptores.todo,
              };
              avisa('Guardado en Mis planes');
            }}
            onCerrar={() => setModal(null)}
          />
        );
      })()}
      {modal?.type === 'tpl-week' && curPhase && (
        <SelectorDeMisPlanes
          tipos={['rutina']} titulo={isWeekly ? 'Usar rutina' : 'Usar semana'} onCerrar={() => setModal(null)}
          onElegir={async (item) => {
            let datos;
            try { datos = await abrirItem(item); } catch (e) { setErr(e.message || 'No se pudo abrir'); setModal(null); return; }
            const n = (datos?.days || []).length;
            if (!await pregunta({
              titulo: `¿Aplicar "${item.nombre}"?`,
              detalle: `Esta semana pierde lo que tenga y queda con ${n} día${n !== 1 ? 's' : ''}.`,
              confirmar: 'Sí, aplicarla',
            })) return;
            patchWeek(nav.pi, curWeekIdx, { days: clone(datos?.days || []) });
            setModal(null);
          }}
        />
      )}
      {modal?.type === 'tpl-day' && curPhase && (
        <SelectorDeMisPlanes
          tipos={['workout']} titulo="Usar workout" onCerrar={() => setModal(null)}
          onElegir={async (item) => {
            const { di } = modal.payload;
            let datos;
            try { datos = await abrirItem(item); } catch (e) { setErr(e.message || 'No se pudo abrir'); setModal(null); return; }
            const nuevas = diasDeWorkout(datos, activeWeekday, item.nombre);
            if (di == null) {
              patchWeek(nav.pi, curWeekIdx, (wk) => ({ days: [...(wk.days || []), ...nuevas] }));
            } else {
              if (!await pregunta({
                titulo: `¿Aplicar "${item.nombre}"?`,
                detalle: 'Esta sesión pierde lo que tenga y queda con el workout guardado.',
                confirmar: 'Sí, aplicarla',
              })) return;
              // En el lugar de la sesión, sin moverla (lo que anota el atleta cuelga de su posición); si el workout
              // trae más sesiones, van al final del día.
              const lugar = { ...nuevas[0] };
              delete lugar.day;
              patchDay(nav.pi, curWeekIdx, di, { blocks: undefined, dual: undefined, notes: undefined, ...lugar });
              if (nuevas.length > 1) patchWeek(nav.pi, curWeekIdx, (wk) => ({ days: [...(wk.days || []), ...nuevas.slice(1)] }));
            }
            setModal(null);
          }}
        />
      )}
      {modal?.type === 'desde-plan' && (
        <SelectorDeMisPlanes
          tipos={['programa', 'rutina']} titulo="Usar uno guardado"
          subtitulo="Parte de algo que ya guardaste y ajústalo antes de guardarlo." onCerrar={() => setModal(null)}
          onElegir={async (item) => {
            let datos;
            try { datos = await abrirItem(item); } catch (e) { setErr(e.message || 'No se pudo abrir'); setModal(null); return; }
            // Es una copia con fases de ids nuevos: lo que el atleta anote no se mezcla con nada anterior.
            const plan = item.tipo === 'programa' ? planDePrograma(datos) : planDeRutina(datos);
            setEstructura(plan.estructura);
            touch(() => plan.phases);
            setTitle(item.nombre);
            setWeekIdx(0);
            setActiveWeekday(diaParaSemana(plan.phases[0]?.weekData?.[0], 'Lun'));
            setNav({ level: 'phase', pi: 0 });
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
    </div>
    </PlegadasContext.Provider>
    </HistorialContext.Provider>,
    document.body,
  );
}
