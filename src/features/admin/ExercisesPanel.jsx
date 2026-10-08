import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Plus, Minus, Search, X, Trash2, Loader2, Video, Dumbbell,
  Copy, RotateCcw, Pencil, ChevronDown, } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { useIsWide } from '@/lib/useViewport';
import {
  listCategories, listExercises, createExercise, updateExercise, deleteExercise,
  getMasterId, tagRepertoire, duplicateExercise,
  listExerciseOverrides, saveExerciseOverride, deleteExerciseOverride, aplicarOverrides,
  addExerciseMedia, listMuscleGroups, createMuscleGroup, deleteMuscleGroup, listIdsConVideoExtra,
} from '@/lib/api';
import MediaDelEjercicio from '@/features/admin/MediaDelEjercicio';
import { completaPortadas } from '@/lib/posters';
import SelectorCategoria, { CrearCategoria } from '@/features/admin/SelectorCategoria';
import ListaDesplegable from '@/components/ListaDesplegable';
import InterruptorVista from '@/components/InterruptorVista';
import { useVistaEjercicios } from '@/lib/useVistaEjercicios';
import {
  MUSCLE_GROUPS, FINE_MUSCLES, gruposConPropios, groupForMuscle,
} from '@/lib/muscles';
import { crearCategoriaPropia, mismoNombre, conLasMiasPrimero } from '@/lib/categorias';
import { coincidencia, pasaFiltros } from '@/lib/buscarEjercicio';
import { useLugar, useScrollLugar } from '@/lib/useLugar';
import ModoDeFiltro, { MODOS, MODO_POR_DEFECTO, NombresUnidos } from '@/components/ModoDeFiltro';
import DialogoNombre from '@/components/DialogoNombre';
import { esExplicacion } from '@/lib/proposito';
import { T, FONT, KP } from '@/lib/theme';
import Portada from '@/components/Portada';
import { useConfirmacion } from '@/components/Confirmacion';

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

function ExerciseCard({ ex, onClick, base, conVideoExtra }) {
  const color = catColor(ex.category);
  const hasVideo = ex.video_url || ex.video_link || conVideoExtra;
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
          background: `${color}12`,
          display: 'grid', placeItems: 'center', position: 'relative',
        }}
      >
        {/* Sin foto de portada se usa el primer fotograma de su video, si tiene.
            Antes los ochenta y un ejercicios sin foto se veían idénticos entre
            sí: el mismo cuadro gris con la misma mancuerna. */}
        <Portada
          foto={ex.cover_image_url}
          video={ex.video_url}
          desde={ex.recorte_inicio}
          hasta={ex.recorte_fin}
          style={{ position: 'absolute', inset: 0 }}
        >
          <Dumbbell size={30} color={`${color}88`} />
        </Portada>
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
            <Video size={11} /> {ex.video_url || !ex.video_link ? 'Video' : detectVideoKind(ex.video_link)}
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

/* Los rótulos de los campos se LEEN (Andrés, 7 oct 2026: «el formato de recuadro con letritas grises que casi no se ven, en el
   nombre y la categoría que es de lo más importante, no me gusta»): negros, un poco más grandes, sin la aclaración gris debajo. */
const ROTULO = { fontSize: 13.5, fontWeight: 700, color: T.text };

// Los equipos más comunes, en lista. Lo que no esté aquí se escribe en «Otro» (el valor sigue siendo texto: el buscador, el
// selector de ejercicios y el conector lo leen así). Andrés pidió la lista; «Polea» la agregué porque la usan 12 de sus ejercicios.
const EQUIPOS = ['Peso corporal', 'Barra', 'Mancuerna', 'Kettlebell', 'Máquina', 'Liga', 'Polea'];

function Input({ label, grande = false, ...props }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={ROTULO}>{label}</span>
      <input
        {...props}
        style={{
          border: `1.5px solid ${T.border}`, borderRadius: grande ? 12 : 11, padding: grande ? '12px 13px' : '11px 13px',
          fontFamily: FONT, fontSize: grande ? 17 : 14, fontWeight: grande ? 700 : 500, color: T.text, outline: 'none', background: T.bg2,
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
  // Lo secundario: también cuenta como… / también trabaja…
  categorias_secundarias: [], muscle_secondary: [],
  // Tramo del video que ve el atleta. null = completo. No corta el archivo.
  recorte_inicio: null, recorte_fin: null,
  // Se aplican al reproducir, no al archivo: el video sube intacto.
  sin_audio: false, encuadre: null,
};

// Lista desplegable del grupo muscular PRINCIPAL: primero los grupos
// (recomendado), luego el detalle fino ya usado en el repertorio.
// "Agregar grupo" crea uno que sale también en los filtros; reemplaza al
// "Otro…" de antes, que escribía un músculo suelto que ningún filtro veía.
function MuscleSelect({ value, onChange, options, grupos, onAgregarGrupo, alBorrarGrupo }) {
  const groupLabels = useMemo(() => grupos.map((g) => g.label), [grupos]);
  const fineOpts = useMemo(() => {
    const s = new Set([...(options || []), ...FINE_MUSCLES].filter(Boolean));
    if (value && value.trim()) s.add(value.trim());
    groupLabels.forEach((l) => s.delete(l)); // los grupos van en su propio bloque
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [options, value, groupLabels]);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={ROTULO}>Grupo muscular</span>
      <ListaDesplegable
        etiqueta="Grupo muscular"
        valor={value || ''}
        onCambio={onChange}
        marcador="Selecciona…"
        grupos={[
          { titulo: '', opciones: [
            { valor: '', etiqueta: 'Selecciona…' },
            ...(onAgregarGrupo ? [{ accion: onAgregarGrupo, etiqueta: 'Agregar grupo' }] : []),
          ] },
          // Los tuyos llevan bote de basura, como las categorías.
          { titulo: 'GRUPOS', opciones: grupos.map((g) => ({
            valor: g.label,
            etiqueta: g.label,
            ...(g.mio && alBorrarGrupo ? { alBorrar: () => alBorrarGrupo(g) } : {}),
          })) },
          { titulo: 'DETALLE', opciones: fineOpts.map((m) => ({ valor: m, etiqueta: m })) },
        ]}
      />
    </div>
  );
}

/**
 * Crea un grupo muscular a nombre de `duenoId`. Lanza un error con un mensaje
 * para la persona si ya existe, o si el nombre es un músculo que ya vive
 * dentro de otro grupo: "Cuádriceps" es de Piernas, y un grupo "Cuádriceps"
 * nunca atraparía nada, porque Piernas lo reclama primero.
 */
async function crearGrupoPropio({ nombre, grupos, duenoId }) {
  const n = (nombre || '').trim();
  if (!n) throw new Error('Ponle un nombre.');
  if (grupos.some((g) => mismoNombre(g.label, n))) throw new Error('Ya existe un grupo con ese nombre.');
  const dentro = grupos.find((g) => g.members.some((m) => mismoNombre(m, n)));
  if (dentro) throw new Error(`«${n}» ya está dentro de ${dentro.label}.`);
  return createMuscleGroup({ name: n, createdBy: duenoId });
}

// La línea de abajo de las listas de filtro que dice que se pueden marcar
// varias, y qué pasa entonces.
function AyudaVarias({ texto }) {
  return (
    <div style={{ fontSize: 12, fontWeight: 600, color: T.text3, padding: '3px 6px', lineHeight: 1.4 }}>
      {texto}
    </div>
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
function ExerciseRow({ ex, base, abierto, onAbrir, onMedia, onEditar, conVideoExtra }) {
  const color = catColor(ex.category);
  // «Tiene video» es el de siempre (columnas del ejercicio) O cualquiera de `exercise_media`: una explicación sola también cuenta.
  const tieneVideo = !!(ex.video_url || ex.video_link || conVideoExtra);

  /* AL TOCAR UN EJERCICIO SE ABRE AHÍ MISMO, debajo de su nombre: «Grabar o subir» (lo que se hace en el gimnasio) y «Editar el
     ejercicio». Andrés, 7 oct 2026: la hoja «¿Qué vas a hacer?» subía desde el borde de abajo («el botón aparece hasta abajo,
     eso no ayuda mucho al momento de estar en el campo de batalla») y rechazó dejarla igual o quitarla; de tres opciones eligió
     esta: el dedo no se mueve y el nombre queda a la vista. Son dos pantallas DISTINTAS (cada una abre con lo que viniste a hacer
     y se llama como el botón), no la misma con otro título. La camarita de la derecha sigue yendo directo a «Grabar o subir». */
  return (
    <div>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: T.bg2, border: `1px solid ${abierto ? T.accent : T.border}`, borderRadius: abierto ? '13px 13px 0 0' : 13,
        padding: '8px 9px', boxShadow: abierto ? '0 0 0 3px rgba(30,64,224,0.12)' : KP.shCard,
        position: 'relative', zIndex: abierto ? 1 : 0,
      }}>
        <button
          type="button"
          onClick={onAbrir}
          aria-expanded={abierto}
          style={{
            flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 10,
            background: 'transparent', border: 'none', padding: 0, cursor: 'pointer',
            fontFamily: FONT, textAlign: 'left', minHeight: 44,
          }}
        >
          <Portada
            foto={ex.cover_image_url}
            video={ex.video_url}
            desde={ex.recorte_inicio}
            hasta={ex.recorte_fin}
            style={{
              width: 44, height: 44, borderRadius: 10, flexShrink: 0,
              background: `${color}14`,
            }}
          >
            <Dumbbell size={19} color={`${color}AA`} />
          </Portada>

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

      {abierto && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 6, background: T.bg2, border: `1.5px solid ${T.accent}`, borderTop: 'none',
          borderRadius: '0 0 14px 14px', padding: '8px 8px 9px', marginTop: -1,
        }}>
          <button
            type="button" onClick={onMedia} className="kp-press"
            style={{
              minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', borderRadius: 11,
              background: T.accent, color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 800, touchAction: 'manipulation',
            }}
          >
            <Video size={17} /> Grabar o subir
          </button>
          <button
            type="button" onClick={onEditar} className="kp-press"
            style={{
              minHeight: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, border: `1.5px solid ${T.border}`,
              borderRadius: 11, background: T.bg2, color: T.text2, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700,
              touchAction: 'manipulation',
            }}
          >
            <Pencil size={14} /> Editar el ejercicio
          </button>
        </div>
      )}
    </div>
  );
}

function ExerciseEditor({
  exercise, categories, muscleOptions = [], onClose, onSaved, onDeleted,
  esAjeno, onDuplicate, onGuardadaMiVersion, onRestaurada, foco = 'todo',
  duenoId, masterId, onCategoriaCreada, onCategoriaBorrada, puedeCrearCategoria = true,
  grupos = MUSCLE_GROUPS, onGrupoCreado, onGrupoBorrado, puedeCrearGrupo = true,
}) {
  const { t } = usePalabras();
  // `foco='media'` abre la ficha directo en foto y video, sin los campos de
  // texto. Los datos de los 81 ejercicios ya están escritos; lo que falta es
  // la media. Guardar sigue guardando la ficha completa: los campos siguen
  // ahí en el estado, solo no se pintan.
  /* DOS PANTALLAS, no una con otro título. Andrés, 7 oct 2026: «da la impresión de que ya no importa si el usuario le pica a
     "grabar" o a "editar ejercicio"; debe existir una razón de que sea diferente». «Grabar o subir» abre con lo de grabar (y el
     título lo dice): los datos quedan al final, plegados, en «Editar también los datos». «Editar el ejercicio» abre con los datos y
     lo que ya tiene de fotos y videos va al final, con un botón que lleva a «Grabar o subir». Cada una tiene un camino a la otra. */
  const [modo, setModo] = useState(foco === 'media' ? 'media' : 'datos');
  const [conDatos, setConDatos] = useState(false);   // en «Grabar o subir»: los datos desplegados
  const raiz = useRef(null);
  const [enfocaOtro, setEnfocaOtro] = useState(false);   // el campo de «Otro» toma el cursor solo si se acaba de elegir
  useEffect(() => { raiz.current?.scrollTo?.({ top: 0 }); }, [modo]);
  const { user } = useAuth();
  const pregunta = useConfirmacion();
  const [creandoGrupo, setCreandoGrupo] = useState(false);

  /* Borrar un grupo propio. Los ejercicios no cambian: el músculo va escrito
     en cada uno y ahí se queda. Solo deja de salir en el filtro de grupos. */
  async function borrarGrupo(g) {
    const va = await pregunta({
      titulo: `¿Borrar el grupo «${g.label}»?`,
      detalle: 'Ningún ejercicio cambia: el que lo tenga lo sigue diciendo. Solo deja de salir en el filtro de grupos.',
      confirmar: 'Sí, borrarlo',
      peligro: true,
    });
    if (!va) return;
    try {
      await deleteMuscleGroup(g.propio.id);
      onGrupoBorrado?.(g.propio.id);
    } catch (e) {
      setErr(e.message || 'No se pudo borrar el grupo.');
    }
  }
  /* Lo que se grabó ANTES de crear el ejercicio. Vive aquí y no dentro de
     `MediaDelEjercicio` porque quien lo reparte es `onSave`, que está aquí. */
  const [nuevos, setNuevos] = useState([]);
  /* Los campos que no son el nombre, al crear. Empiezan plegados: lo que el
     coach viene a hacer es grabar. Se abren solos si al guardar falta algo de
     ahí dentro — pedir un dato que no se ve es una trampa. */
  const [detalles, setDetalles] = useState(false);
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
          categorias_secundarias: exercise.categorias_secundarias || [],
          muscle_secondary: exercise.muscle_secondary || [],
          cover_image_url: exercise.cover_image_url || '',
          video_url: exercise.video_url || '',
          video_link: exercise.video_link || '',
          sin_audio: exercise.sin_audio ?? false,
          encuadre: exercise.encuadre ?? null,
          recorte_inicio: exercise.recorte_inicio ?? null,
          recorte_fin: exercise.recorte_fin ?? null,
        }
      : { ...empty, category_id: categories[0]?.id || '' },
  );
  // El equipo es una lista; lo que no esté en ella (un «Conos» de siempre) sale como «Otro» con su texto.
  const [equipoOtro, setEquipoOtro] = useState(() => {
    const e = (exercise?.equipment || '').trim();
    return !!e && !EQUIPOS.some((x) => x.toLowerCase() === e.toLowerCase());
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const eligeEquipo = (v) => {
    if (v === 'Otro') {
      setEquipoOtro(true);
      // Si venía de uno de la lista, el campo empieza vacío para escribir el otro.
      setForm((f) => ({ ...f, equipment: EQUIPOS.some((x) => x.toLowerCase() === (f.equipment || '').trim().toLowerCase()) ? '' : f.equipment }));
      return;
    }
    setEquipoOtro(false);
    set('equipment', v);
  };
  const categoriaElegida = categories.find((c) => c.id === form.category_id)?.name || null;

  async function onSave() {
    if (!form.name.trim()) { setErr('El nombre es obligatorio'); return; }
    if (!form.category_id) {
      setDetalles(true);
      setErr('Falta la categoría. Está en "Agregar detalles", que acabo de abrirte.');
      return;
    }
    setErr('');
    setBusy(true);
    const toArr = (s) => s.split(',').map((x) => x.trim()).filter(Boolean);
    const payload = {
      name: form.name.trim(),
      category_id: form.category_id,
      equipment: form.equipment.trim() || null,
      description: form.description.trim() || null,
      muscle_primary: toArr(form.muscle_primary),
      // Solo las que existen: si se borró una con el editor abierto, su id no
      // vuelve a guardarse.
      categorias_secundarias: (form.categorias_secundarias || []).filter((id) => categories.some((c) => c.id === id)),
      muscle_secondary: form.muscle_secondary || [],
      cover_image_url: form.cover_image_url || null,
      video_url: form.video_url || null,
      video_link: form.video_link.trim() || null,
      sin_audio: form.video_url ? !!form.sin_audio : false,
      encuadre: form.video_url ? (form.encuadre ?? null) : null,
      recorte_inicio: form.video_url ? form.recorte_inicio : null,
      recorte_fin: form.video_url ? form.recorte_fin : null,
    };

    /* LO QUE SE GRABÓ ANTES DE QUE EL EJERCICIO EXISTIERA.
       Se reparte en dos: el primer video y la primera foto "para todos" caben
       en las columnas del propio ejercicio —que es donde media app los busca:
       el buscador del repertorio, las tarjetas del plan, la insignia de "tiene
       video"— y viajan dentro de este mismo guardado. El resto (otros ángulos,
       y las versiones de hombres y de mujeres) son filas de `exercise_media`,
       y esa tabla pide un `exercise_id`: hasta abajo, cuando ya hay uno. */
    const primeraFoto = nuevos.find((m) => m.tipo === 'foto' && !m.genero);
    // Las columnas del ejercicio solo guardan EJEMPLOS: una explicación es siempre su propia fila (ver `lib/proposito.js`).
    const primerVideo = nuevos.find((m) => m.tipo === 'video' && !m.genero && !esExplicacion(m));
    if (!exercise) {
      if (primeraFoto) payload.cover_image_url = primeraFoto.url;
      if (primerVideo) {
        payload.video_url = primerVideo.url;
        payload.recorte_inicio = primerVideo.inicio ?? null;
        payload.recorte_fin = primerVideo.fin ?? null;
        payload.sin_audio = !!primerVideo.sinAudio;
        payload.encuadre = primerVideo.encuadre ?? null;
      }
    }

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

      /* Ya hay id: ahora sí caben los demás archivos.
         Si alguno falla NO se tira el ejercicio —ya está creado, y borrarlo
         para "dejar limpio" sería perder también lo que sí entró—. Se avisa
         cuáles faltaron y se cierra: desde su ficha se agregan en dos toques. */
      const resto = nuevos.filter((m) => m !== primeraFoto && m !== primerVideo);
      if (!exercise && resto.length) {
        let fallaron = 0;
        for (const m of resto) {
          try {
            await addExerciseMedia({
              exerciseId: saved.id, url: m.url, tipo: m.tipo, genero: m.genero || null,
              inicio: m.inicio ?? null, fin: m.fin ?? null,
              sinAudio: !!m.sinAudio, encuadre: m.encuadre ?? null, proposito: m.proposito,
            });
          } catch { fallaron += 1; }
        }
        if (fallaron) {
          await pregunta({
            titulo: 'El ejercicio se creó, pero faltó guardar archivos',
            detalle: `${fallaron} de ${resto.length} no se pudieron subir. Ábrelo desde el repertorio y agrégaselos otra vez.`,
            confirmar: 'Entendido',
            cancelar: 'Cerrar',
          });
        }
      }
      setNuevos([]);
      onSaved(saved);
    } catch (e) {
      setErr(e.message || 'Error al guardar');
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!exercise) return;
    const va = await pregunta({
      titulo: `¿Eliminar "${exercise.name}"?`,
      detalle: 'Esto no se puede deshacer.',
      confirmar: 'Sí, eliminarlo',
      peligro: true,
    });
    if (!va) return;
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
      ref={raiz}
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
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: T.text, display: 'flex', alignItems: 'center', gap: 8 }}>
              {!exercise ? 'Nuevo ejercicio'
                : modo === 'media' ? 'Grabar o subir'
                : esAjeno ? <><Pencil size={16} color={T.accent} /> Mi versión</>
                : 'Editar ejercicio'}
            </div>
            {/* De qué ejercicio es: el título dice QUÉ se hace aquí, y el nombre CUÁL. */}
            {exercise && (
              <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text2, marginTop: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {exercise.name}
              </div>
            )}
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
          {/* Andrés, 17 sep 2026: "ese mensaje está algo de más; sería más fácil
              poner algo que ayude a volver a la versión original, porque no vi
              de qué manera le ofrecemos esa opción al coach".

              Tenía razón en las dos cosas. El texto explicaba en cuatro renglones
              lo que se entiende en uno, y PROMETÍA poder volver al original
              cuando el botón de volver solo existía DESPUÉS de haber guardado
              una versión. Ahora: una línea, y cuando hay versión propia el
              camino de vuelta está aquí mismo, no al final del formulario. */}
          {esAjeno && (
            <div style={{
              background: T.accentBg, borderRadius: 11, padding: '11px 14px',
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
            }}>
              <span style={{ flex: 1, minWidth: 180, color: T.accent, fontSize: 13, fontWeight: 600, lineHeight: 1.45 }}>
                {exercise?.esMiVersion
                  ? t('Tus atletas ven esta versión. El original del sistema sigue guardado.')
                  : 'Lo que guardes será TU versión. El ejercicio del sistema no se toca.'}
              </span>
              {exercise?.esMiVersion && (
                <button
                  type="button"
                  disabled={restaurando || busy}
                  onClick={async () => {
                    const va = await pregunta({
                      titulo: `¿Volver al original de "${exercise.name}"?`,
                      detalle: 'Se pierden los cambios que hiciste sobre él. El ejercicio del sistema no se toca.',
                      confirmar: 'Sí, volver al original',
                    });
                    if (!va) return;
                    setRestaurando(true);
                    try { await deleteExerciseOverride(exercise.id); onRestaurada(exercise.id); }
                    catch (e) { setErr(e.message || 'No se pudo restaurar'); setRestaurando(false); }
                  }}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 13px', borderRadius: 10,
                    border: 'none', background: T.bg2, color: T.accent, flexShrink: 0,
                    cursor: (restaurando || busy) ? 'default' : 'pointer',
                    fontFamily: FONT, fontSize: 13, fontWeight: 800,
                  }}
                >
                  {restaurando ? <Loader2 size={14} className="spin" /> : <RotateCcw size={14} />}
                  Volver al original
                </button>
              )}
            </div>
          )}
          {/* LOS CAMPOS, SUELTOS. Se declaran aquí y se ordenan abajo, porque el
              orden NO es el mismo al crear que al editar y moverlos como
              bloques de JSX es la forma de equivocarse. */}
          {(() => {
            const campoNombre = (
              <Input key="nombre" grande label="Nombre" value={form.name} onChange={(e) => set('name', e.target.value)} />
            );
            /* PRINCIPAL Y SECUNDARIAS. Andrés, 28 sep 2026: un "jumping lunge"
               es principalmente Potencia, pero también Pliometría; saltar la
               cuerda es Cardio y también Pliometría. La principal es la que
               pinta el color y manda; las secundarias hacen que el ejercicio
               salga también al filtrar por ellas. Una categoría no puede ser
               las dos cosas: al volverla principal se quita de secundarias. */
            const opcionesCatSec = categories
              .filter((c) => c.id !== form.category_id)
              .map((c) => ({ valor: c.id, etiqueta: c.name, color: catColor(c) }));
            // Elegir una categoría como principal la quita de las secundarias: no puede ser las dos cosas.
            const poneCategoria = (id) => setForm((f) => ({
              ...f,
              category_id: id,
              categorias_secundarias: (f.categorias_secundarias || []).filter((x) => x !== id),
            }));
            /* LISTAS Y NO PASTILLAS. Andrés, 7 oct 2026: «el formato de seleccionar categorías secundarias como stickers está
               horrible», y «antes de escoger una secundaria me ofrece agregar una nueva, el orden está mal». Las secundarias son
               una lista desplegable con casillas (la misma de los filtros de arriba) y «Crear categoría nueva» va DESPUÉS. */
            const campoCategoria = (
              <div key="cat" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={ROTULO}>Categoría</span>
                  <SelectorCategoria
                    categorias={categories}
                    value={form.category_id}
                    onChange={poneCategoria}
                    onCreada={onCategoriaCreada}
                    onBorrada={onCategoriaBorrada}
                    duenoId={duenoId}
                    masterId={masterId}
                    puedeCrear={puedeCrearCategoria}
                    sinCrear
                  />
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={ROTULO}>Categorías secundarias</span>
                  <ListaDesplegable
                    multiple
                    etiqueta="Categorías secundarias"
                    marcador="Seleccionar…"
                    valor={(form.categorias_secundarias || []).filter((id) => opcionesCatSec.some((o) => o.valor === id))}
                    onCambio={(v) => set('categorias_secundarias', v)}
                    opciones={opcionesCatSec}
                  />
                  <CrearCategoria
                    categorias={categories}
                    onChange={poneCategoria}
                    onCreada={onCategoriaCreada}
                    duenoId={duenoId}
                    masterId={masterId}
                    puedeCrear={puedeCrearCategoria}
                  />
                </div>
              </div>
            );
            /* EL EQUIPO, EN LISTA. Andrés, 7 oct 2026: «para "equipo" quiero que sea una lista desplegable» con Peso corporal,
               Barra, Mancuerna, Kettlebell, Máquina, Liga y «Otro (y aquí te dé la opción de escribir)». */
            const equipoDeLista = EQUIPOS.find((x) => x.toLowerCase() === (form.equipment || '').trim().toLowerCase()) ?? '';
            const campoEquipo = (
              <div key="equipo" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={ROTULO}>Equipo</span>
                <ListaDesplegable
                  etiqueta="Equipo"
                  marcador="Selecciona…"
                  valor={equipoOtro ? 'Otro' : equipoDeLista}
                  onCambio={(v) => { if (v === 'Otro') setEnfocaOtro(true); eligeEquipo(v); }}
                  opciones={[...EQUIPOS.map((e) => ({ valor: e, etiqueta: e })), { valor: 'Otro', etiqueta: 'Otro…' }]}
                />
                {equipoOtro && (
                  <input
                    value={form.equipment}
                    onChange={(e) => set('equipment', e.target.value)}
                    aria-label="Escribe cuál equipo"
                    autoFocus={enfocaOtro}
                    // 16 px: por debajo, el iPhone acerca la pantalla al escribir.
                    style={{
                      border: `1.5px solid ${T.border}`, borderRadius: 11, padding: '11px 13px', fontFamily: FONT, fontSize: 16,
                      fontWeight: 600, color: T.text, outline: 'none', background: T.bg2, width: '100%', boxSizing: 'border-box',
                    }}
                  />
                )}
              </div>
            );
            /* LOS SECUNDARIOS, POR GRUPO. En el repertorio ya venían músculos
               secundarios finos ("Isquios", "Core"…) que ninguna pantalla
               enseñaba. Cada uno cae en la pastilla de su grupo, que lo dice
               entre paréntesis: así se ve lo que hay guardado. Apagar un grupo
               quita todos sus músculos; prenderlo guarda el nombre del grupo.
               Un músculo que no es de ningún grupo sale como pastilla suelta. */
            const sec = form.muscle_secondary || [];
            const claveMusculo = (m) => groupForMuscle(m, grupos)?.id ?? `suelto:${m}`;
            const elegidasMus = new Set(sec.map(claveMusculo));
            // El grupo principal no se ofrece otra vez como secundario, salvo
            // que ya tenga algo: "Cuádriceps" principal con "Isquios"
            // secundario son los dos de Piernas, y ese dato no se esconde.
            const gruposPrincipales = new Set((form.muscle_primary || '').split(',')
              .map((m) => groupForMuscle(m.trim(), grupos)?.id).filter(Boolean));
            const opcionesMusSec = [
              ...grupos.filter((g) => !gruposPrincipales.has(g.id) || elegidasMus.has(g.id)).map((g) => {
                const finos = sec.filter((m) => claveMusculo(m) === g.id && !mismoNombre(m, g.label));
                return { valor: g.id, etiqueta: finos.length ? `${g.label} (${finos.join(', ')})` : g.label };
              }),
              ...sec.filter((m) => !groupForMuscle(m, grupos)).map((m) => ({ valor: `suelto:${m}`, etiqueta: m })),
            ];
            const cambiaMusSec = (nuevas) => {
              const siguiente = sec.filter((m) => nuevas.includes(claveMusculo(m)));
              nuevas.forEach((k) => {
                if (k.startsWith('suelto:') || siguiente.some((m) => claveMusculo(m) === k)) return;
                const g = grupos.find((x) => x.id === k);
                if (g) siguiente.push(g.label);
              });
              set('muscle_secondary', siguiente);
            };
            const campoMusculo = (
              <div key="musc" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <MuscleSelect
                  value={form.muscle_primary}
                  // Lo que se vuelve principal sale de secundarios: no puede
                  // ser las dos cosas.
                  onChange={(v) => setForm((f) => ({
                    ...f,
                    muscle_primary: v,
                    muscle_secondary: (f.muscle_secondary || []).filter((m) => !mismoNombre(m, v)),
                  }))}
                  options={muscleOptions}
                  grupos={grupos}
                  onAgregarGrupo={puedeCrearGrupo ? () => setCreandoGrupo(true) : undefined}
                  alBorrarGrupo={borrarGrupo}
                />
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <span style={ROTULO}>Grupos secundarios</span>
                  <ListaDesplegable
                    multiple
                    etiqueta="Grupos secundarios"
                    marcador="Seleccionar…"
                    valor={[...elegidasMus]}
                    onCambio={cambiaMusSec}
                    opciones={opcionesMusSec}
                  />
                </div>
              </div>
            );
            const campoNotas = (
              <label key="notas" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <span style={ROTULO}>Notas</span>
                <textarea
                  value={form.description}
                  onChange={(e) => set('description', e.target.value)}
                  rows={3}
                  style={{
                    border: `1.5px solid ${T.border}`, borderRadius: 11, padding: '11px 13px',
                    fontFamily: FONT, fontSize: 14, fontWeight: 500, color: T.text, outline: 'none',
                    resize: 'vertical', background: T.bg2,
                  }}
                />
              </label>
            );
            /* EL ENLACE VIEJO solo sale si ya trae algo: «Pegar liga» (en la lista de fotos y videos) hace lo mismo, y un campo
               vacío con una aclaración gris debajo era ruido. */
            const campoLiga = form.video_link ? (
              <Input
                key="liga"
                label="Enlace de video (TikTok / Instagram / YouTube)"
                value={form.video_link}
                onChange={(e) => set('video_link', e.target.value)}
              />
            ) : null;
            /* Ni la foto de portada ni el video principal tienen ya su propio
               bloque: los dos viven dentro de la lista, encabezándola. Andrés
               dijo del video que lo que no le cuadraba era "que esté separada
               del video principal", y vale igual para la foto: para quien usa
               la app son todos archivos del mismo ejercicio. */
            const bloqueMedia = (
              <MediaDelEjercicio
                key="media"
                exerciseId={exercise?.id}
                portada={form.cover_image_url}
                onPortada={(v) => set('cover_image_url', v)}
                principal={form.video_url}
                recortePrincipal={{
                  recorte_inicio: form.recorte_inicio,
                  recorte_fin: form.recorte_fin,
                  sin_audio: form.sin_audio,
                  encuadre: form.encuadre,
                }}
                onPrincipal={(v) => set('video_url', v)}
                onRecortePrincipal={({ inicio, fin, sinAudio, encuadre }) => setForm((f) => ({
                  ...f,
                  recorte_inicio: inicio, recorte_fin: fin,
                  sin_audio: !!sinAudio, encuadre: encuadre ?? null,
                }))}
                nuevos={nuevos}
                onNuevos={setNuevos}
                compacto={!!exercise && modo === 'datos'}
              />
            );

            // «Editar también los datos»: lo MENOS importante de «Grabar o subir», al final, y con cara de botón (no gris y escondido).
            const tarjetaDeDatos = (
              <button
                key="det" type="button" onClick={() => setConDatos(true)} className="kp-press"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12, minHeight: 60, padding: '10px 14px 10px 12px', width: '100%',
                  border: `1.5px solid ${T.borderHi}`, background: T.bg2, borderRadius: 14, boxShadow: KP.shCard, cursor: 'pointer',
                  fontFamily: FONT, textAlign: 'left',
                }}
              >
                <span style={{ width: 36, height: 36, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center', background: T.accentBg, color: T.accent }}>
                  <Pencil size={18} />
                </span>
                <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                  <span style={{ fontSize: 14.5, fontWeight: 800, color: T.text }}>Editar también los datos</span>
                  <span style={{ fontSize: 12, fontWeight: 600, color: T.text2 }}>Nombre, categoría, equipo, notas</span>
                </span>
                <ChevronDown size={19} color={T.accent} style={{ flexShrink: 0 }} />
              </button>
            );

            // GRABAR O SUBIR: lo de grabar primero; los datos, al final y plegados.
            if (exercise && modo === 'media') {
              return (
                <>
                  {bloqueMedia}
                  {campoLiga}
                  {conDatos ? (
                    <>
                      <div style={{ height: 1, background: T.border }} />
                      {campoNombre}
                      {campoCategoria}
                      {campoMusculo}
                      {campoEquipo}
                      {campoNotas}
                    </>
                  ) : tarjetaDeDatos}
                </>
              );
            }

            if (!exercise) {
              return (
                <>
                  {bloqueMedia}
                  {campoNombre}
                  {/* QUE SE VEA. Andrés, 28 sep 2026: "el botón de agregar
                      detalles casi no se ve y es importante… está perfecto en
                      donde está y como funciona, pero visualmente agrégale
                      detallitos para que se note, tampoco muy exagerado". Era
                      un contorno punteado, gris sobre gris, sin fondo. Ahora es
                      una tarjeta blanca de borde sólido, con el "+" en su
                      cuadrito azul, el título en negro y una flecha que dice
                      que se despliega. */}
                  <button
                    type="button"
                    onClick={() => setDetalles((v) => !v)}
                    aria-expanded={detalles}
                    className="kp-press"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, minHeight: 64, padding: '10px 14px 10px 12px',
                      border: `1.5px solid ${detalles ? T.accent : T.borderHi}`, background: T.bg2, borderRadius: 14,
                      boxShadow: KP.shCard, cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
                    }}
                  >
                    <span style={{
                      width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: 'grid', placeItems: 'center',
                      background: T.accentBg, color: T.accent,
                    }}>
                      {detalles ? <Minus size={19} strokeWidth={2.6} /> : <Plus size={19} strokeWidth={2.6} />}
                    </span>
                    <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: T.text }}>
                        {detalles ? 'Ocultar los detalles' : 'Agregar detalles'}
                      </span>
                      {/* LA CATEGORÍA, A LA VISTA AUNQUE ESTÉ PLEGADA.
                          Viene preseleccionada con la primera de la lista. Antes
                          se veía y se podía cambiar; al plegarla, los ejercicios
                          se irían apilando en silencio dentro de la que tocara.
                          Decir dónde va cuesta una palabra, y con su color. */}
                      {/* Se parte en dos líneas en vez de cortarse: en el
                          teléfono no cabe y "notas" se perdía detrás de "…". */}
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: T.text2, lineHeight: 1.4 }}>
                        {categoriaElegida && (
                          <span style={{
                            display: 'inline-block', width: 8, height: 8, borderRadius: 4, marginRight: 6,
                            verticalAlign: 'middle', background: catColor(categories.find((c) => c.id === form.category_id)),
                          }} />
                        )}
                        {categoriaElegida
                          ? `${categoriaElegida} · equipo, músculo, notas`
                          : 'Categoría, equipo, músculo, notas'}
                      </span>
                    </span>
                    <ChevronDown
                      size={19}
                      color={T.accent}
                      style={{ flexShrink: 0, transform: detalles ? 'rotate(180deg)' : 'none', transition: 'transform .15s' }}
                    />
                  </button>
                  {detalles && (
                    <>
                      {campoCategoria}
                      {campoMusculo}
                      {campoEquipo}
                      {campoNotas}
                      {campoLiga}
                    </>
                  )}
                </>
              );
            }

            // EDITAR EL EJERCICIO: los datos primero; lo que ya tiene de fotos y videos, al final, con un camino a «Grabar o subir».
            return (
              <>
                {campoNombre}
                {campoCategoria}
                {campoMusculo}
                {campoEquipo}
                {campoNotas}
                {campoLiga}
                <div style={{ height: 1, background: T.border }} />
                {bloqueMedia}
                <button
                  type="button" onClick={() => setModo('media')} className="kp-press"
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: 44, border: `1.5px solid ${T.border}`,
                    background: T.bg2, borderRadius: 12, boxShadow: KP.shCard, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 800, color: T.accent,
                  }}
                >
                  <Video size={17} /> Grabar o subir
                </button>
              </>
            );
          })()}

          {err && (
            <div style={{ background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 11, padding: '11px 14px', fontSize: 13.5, fontWeight: 600 }}>
              {err}
            </div>
          )}

          {/* Dentro de la tarjeta y no al lado: el fondo del editor se cierra
              con cualquier clic que le llegue, y los de este diálogo suben
              por aquí, donde la tarjeta los detiene. */}
          {creandoGrupo && (
            <DialogoNombre
              titulo="Nuevo grupo muscular"
              detalle="Sale también en el filtro de grupos del repertorio."
              onCancelar={() => setCreandoGrupo(false)}
              onCrear={async (nombre) => {
                const fila = await crearGrupoPropio({ nombre, grupos, duenoId });
                onGrupoCreado?.(fila);
                set('muscle_primary', fila.name);
                setCreandoGrupo(false);
              }}
            />
          )}
        </div>

        <div
          style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
            padding: '16px 22px', background: T.bg2, borderTop: `1px solid ${T.border}`,
          }}
        >
          {/* LA IZQUIERDA depende de la pantalla. En «Grabar o subir» no hay nada: ahí solo se graba y se guarda (Andrés, 7 oct 2026:
              «Grabar o subir» y «Editar ejercicio» tienen que ser dos cosas distintas, y eliminar es de la segunda). En la de
              datos: un ejercicio de la base se duplica (para quien quiera DOS variantes en vez de reemplazar una) y uno propio se
              elimina. «Volver al original» NO está aquí: vive en el aviso de arriba, que es donde se lee que esto es una versión propia. */}
          {exercise && modo === 'media' ? <span /> : esAjeno ? (
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
          ) : exercise ? (
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
            {esAjeno ? 'Guardar mi versión' : exercise ? 'Guardar cambios' : 'Crear ejercicio'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ExercisesPanel({ viendoComo }) {
  const { user, profile } = useAuth();
  const isMaster = !!profile?.is_owner;
  /* De quién es el repertorio que se está mirando. Con "Ver como" el master
     ve el del coach visitado; el resto del tiempo, el suyo. */
  const dueño = viendoComo?.id || user?.id;
  const [categories, setCategories] = useState([]);
  // Los grupos musculares que agregó cada coach (los de siempre están en el código).
  const [gruposPropios, setGruposPropios] = useState([]);
  // "Agregar categoría" / "Agregar grupo" desde los filtros: 'categoria' | 'grupo' | null.
  const [creando, setCreando] = useState(null);
  const [exercises, setExercises] = useState([]); // crudo (todos los visibles)
  const [masterId, setMasterId] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  // Lo marcado en las listas de filtro. Pueden ser varias a la vez: salen los
  // que tienen cualquiera de ellas o solo los que las tienen todas, según el
  // modo de cada lista (ver `pasaFiltros`).
  // Y se recuerdan al refrescar, igual que lo escrito en el buscador (ver
  // `lugar.js`). Un id que ya no existe —una categoría borrada— se descarta
  // más abajo, así que no hace falta comprobarlo aquí.
  const [catsElegidas, setCatsElegidas] = useLugar('ejercicios.cats', [], Array.isArray); // ids de categoría
  const [gruposElegidos, setGruposElegidos] = useLugar('ejercicios.grupos', [], Array.isArray); // ids de grupo
  // Cómo se combinan las varias marcadas de cada lista: 'cualquiera' de ellas
  // (por defecto) o 'todas' a la vez. Ver `ModoDeFiltro`.
  const [modoCats, setModoCats] = useLugar('ejercicios.modoCats', MODO_POR_DEFECTO, (v) => MODOS.includes(v));
  const [modoGrupos, setModoGrupos] = useLugar('ejercicios.modoGrupos', MODO_POR_DEFECTO, (v) => MODOS.includes(v));
  const [search, setSearch] = useLugar('ejercicios.busca', '', (v) => typeof v === 'string');
  const [editing, setEditing] = useState(null); // { exercise, esAjeno } | { new: true } | null
  // Mis versiones de los ejercicios base. Se aplican encima del repertorio.
  const [overrides, setOverrides] = useState([]);
  // En el teléfono, tocar un ejercicio pregunta primero qué se va a hacer.
  const [preguntando, setPreguntando] = useState(null);
  const esAncho = useIsWide();

  /* QUÉ EJERCICIOS TIENEN VIDEO EN `exercise_media` (ver `listIdsConVideoExtra`). Se vuelve a leer cada vez que se CIERRA el editor,
     que es cuando pudo cambiar: grabar o quitar un video escribe esas filas directo, sin pasar por «Guardar». Si falla, la lista
     se queda como estaba: lo peor es una marca de «falta video» de más. */
  const [conVideoExtra, setConVideoExtra] = useState(() => new Set());
  useEffect(() => {
    if (editing) return undefined;
    let vivo = true;
    listIdsConVideoExtra().then((ids) => { if (vivo) setConVideoExtra(ids); }).catch(() => {});
    return () => { vivo = false; };
  }, [editing, dueño]);

  /* LAS FOTOS DE LOS VIDEOS SE COMPLETAN SOLAS. Los videos nuevos sacan su foto
     al subirse; los que ya estaban sin foto, o con una que quedó vieja porque
     se volvió a recortar el video, se la sacan aquí, en segundo plano y sin que
     nadie haga nada ni espere (ver `completaPortadas`). Corre al abrir el panel
     y cada vez que la lista cambia (guardar, duplicar, borrar), siempre unos
     segundos después para no competir con lo que se está pintando. */
  useEffect(() => {
    let parar = false;
    const t = setTimeout(() => { completaPortadas({ parar: () => parar }).catch(() => {}); }, 2500);
    return () => { parar = true; clearTimeout(t); };
  }, [exercises]);

  /* Manda lo que haya elegido Andrés. Mientras no elija nada, se queda lo de
     siempre: tarjetas en pantalla ancha, lista en el teléfono. */
  const [vista, eligeVista] = useVistaEjercicios();
  const enTarjetas = vista ? vista === 'tarjetas' : esAncho;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [cats, exs, mId, mias, grupos] = await Promise.all([
          listCategories(), listExercises(), getMasterId(), listExerciseOverrides(dueño),
          // Si esto falla, el repertorio carga igual, con los grupos de siempre.
          listMuscleGroups().catch(() => []),
        ]);
        if (cancelled) return;
        setCategories(cats);
        setGruposPropios(grupos);
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
  }, [dueño]);

  // La altura de la lista, para volver a donde estaba al refrescar.
  useScrollLugar('ejercicios', !loading);

  /* Las categorías que se OFRECEN: las de la app y las del dueño de esta vista.
     La base deja al master leer las de todos los coaches; sin este filtro su
     lista de categorías crecería con las de cada coach, igual que pasaba con
     los ejercicios. Para resolver la categoría de un ejercicio se sigue usando
     la lista completa. */
  const { salud } = usePalabras();
  /* «EJERCICIOS DE TRAINING LAB» APAGADOS (Mi perfil, `repertorio_base`; Andrés, 7 oct 2026: «que puedan iniciar desde cero
     el suyo propio… absolutamente todo, categorías, músculos»). Ni los ejercicios, ni las categorías, ni los grupos de la
     app: solo lo suyo. Nada se borra: se vuelven a prender cuando quiera. Solo en la vista propia (mirando como otro coach,
     el perfil que manda es el de él, no el de quien mira). */
  const sinBase = !isMaster && !viendoComo && profile?.repertorio_base === false;
  const categoriasVisibles = useMemo(() => {
    const lista = categories.filter((c) => (sinBase ? c.created_by === dueño : (!c.created_by || c.created_by === masterId || c.created_by === dueño)));
    return salud ? conLasMiasPrimero(lista, dueño) : lista;
  }, [categories, masterId, dueño, salud, sinBase]);

  // Los grupos, con la misma regla: los de siempre, los del master y los del
  // dueño de esta vista. `mio` marca los que se pueden borrar desde aquí.
  const grupos = useMemo(
    () => gruposConPropios(
      gruposPropios.filter((g) => (sinBase ? g.created_by === dueño : (g.created_by === masterId || g.created_by === dueño))),
      { sinLosDeSiempre: sinBase },
    ).map((g) => (g.propio ? { ...g, mio: g.propio.created_by === dueño } : g)),
    [gruposPropios, masterId, dueño, sinBase],
  );

  // Etiqueta base/propio y, para coaches, oculta el repertorio de otros coaches.
  // Encima van MIS versiones: si personalicé un ejercicio base, en mi lista
  // aparece como yo lo dejé, no como lo tiene el master.
  const visible = useMemo(() => {
    const conMisVersiones = aplicarOverrides(exercises, overrides, categories);
    const tagged = tagRepertoire(conMisVersiones, masterId, dueño);
    /* TODOS ven lo mismo: la base más lo suyo. Incluido el master.

       Antes el master veía TODO, también lo que creaba cada coach. Andrés:
       "los ejercicios que agreguen los coaches no se pueden agregar a mi lista
       de admin, si no imagínate, se vuelve infinita". Con diez coaches
       subiendo variantes, su repertorio dejaría de ser suyo.

       Para mirar el de un coach concreto está el botón "Ver como" de la
       pantalla de coaches, que es donde esa pregunta tiene sentido: dentro de
       un coach, no revuelto con los propios. */
    return tagged.filter((e) => (e.isBase && !sinBase) || e.isMine);
  }, [exercises, overrides, categories, masterId, dueño, sinBase]);

  // Músculos finos presentes en el repertorio (para el detalle del editor)
  const muscles = useMemo(() => {
    const s = new Set();
    visible.forEach((e) => (e.muscle_primary || []).forEach((m) => m && s.add(m)));
    return [...s].sort((a, b) => a.localeCompare(b));
  }, [visible]);

  const categoriasPorId = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  // Lo marcado que todavía existe: una categoría o un grupo borrado con la
  // lista puesta no deja la pantalla vacía para siempre.
  const catsMarcadas = useMemo(
    () => catsElegidas.filter((id) => categoriasPorId.has(id)),
    [catsElegidas, categoriasPorId],
  );
  const gruposMarcados = useMemo(
    () => gruposElegidos.map((id) => grupos.find((g) => g.id === id)).filter(Boolean),
    [gruposElegidos, grupos],
  );

  /* EL BUSCADOR mira nombre, equipo, categoría y músculos, principales y
     secundarios (`coincidencia`). Cada ejercicio que pasa lleva su rango:
     0 si coincide por el nombre, 1 por lo principal, 2 por lo secundario. */
  const conTexto = useMemo(() => {
    const pasan = [];
    visible.forEach((e) => {
      const r = coincidencia(e, search, { categoriasPorId, grupos });
      if (r >= 0) pasan.push([e, r]);
    });
    return pasan;
  }, [visible, search, categoriasPorId, grupos]);

  /* LAS LISTAS DE FILTRO, CON VARIAS A LA VEZ. Andrés, 28 sep 2026: "¿qué tal
     si quiero hacer una búsqueda específica de puros ejercicios con dos
     categorías y dos grupos musculares?". Con varias marcadas salen solo los
     que las tienen TODAS, cada una como principal o como secundaria
     (`pasaFiltros`). Orden: primero los que lo tienen todo como principal,
     después los que entran por algo secundario; dentro, primero lo que se
     llama así, y el orden alfabético (el `sort` es estable). */
  const filtered = useMemo(() => {
    const pasan = [];
    conTexto.forEach(([e, rTexto]) => {
      const r = pasaFiltros(e, {
        categoriaIds: catsMarcadas, grupos: gruposMarcados, modoCategorias: modoCats, modoGrupos,
      });
      if (r >= 0) pasan.push([r * 3 + rTexto, e]);
    });
    return pasan.sort((a, b) => a[0] - b[0]).map(([, e]) => e);
  }, [conTexto, catsMarcadas, gruposMarcados, modoCats, modoGrupos]);

  /* LOS NÚMEROS DE LAS LISTAS dicen cuántos quedarían al marcar esa opción,
     con lo que ya está marcado y lo escrito en el buscador. Así se ve antes de
     tocarla si una combinación deja algo o se queda vacía. En una opción ya
     marcada, es lo que se ve ahora. Cada ejercicio cuenta en su principal y
     en sus secundarias. */
  const cuantos = (categoriaIds, gruposF) => conTexto
    .filter(([e]) => pasaFiltros(e, {
      categoriaIds, grupos: gruposF, modoCategorias: modoCats, modoGrupos,
    }) >= 0).length;
  const counts = useMemo(() => {
    const m = { all: cuantos([], gruposMarcados) };
    categoriasVisibles.forEach((c) => {
      m[c.id] = cuantos(catsMarcadas.includes(c.id) ? catsMarcadas : [...catsMarcadas, c.id], gruposMarcados);
    });
    return m;
    // `cuantos` solo lee `conTexto`, que ya está en la lista.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conTexto, catsMarcadas, gruposMarcados, categoriasVisibles, modoCats, modoGrupos]);
  const groupCounts = useMemo(() => {
    const m = { all: cuantos(catsMarcadas, []) };
    grupos.forEach((g) => {
      m[g.id] = cuantos(catsMarcadas, gruposMarcados.includes(g) ? gruposMarcados : [...gruposMarcados, g]);
    });
    return m;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conTexto, catsMarcadas, gruposMarcados, grupos, modoCats, modoGrupos]);

  // Para el aviso de lista vacía: una sola categoría o un solo grupo, sin
  // nada más encima, es el caso de "recién creada".
  const sinTexto = !search.trim();
  const categoriaSola = catsMarcadas.length === 1 && gruposMarcados.length === 0 && sinTexto
    ? categoriasPorId.get(catsMarcadas[0]) : null;
  const grupoSolo = gruposMarcados.length === 1 && catsMarcadas.length === 0 && sinTexto
    ? gruposMarcados[0] : null;
  const marcadasVarias = catsMarcadas.length + gruposMarcados.length > 1;
  // Los nombres de lo marcado, para decir en palabras qué se está viendo.
  const nombresCats = catsMarcadas.map((id) => categoriasPorId.get(id)?.name).filter(Boolean);
  const nombresGrupos = gruposMarcados.map((g) => g.label);

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
            placeholder="Nombre, categoría o músculo…"
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
          <Plus size={18} /> Agregar ejercicio
        </button>
      </div>

      {/* Filtros: categoría y grupo muscular (listas desplegables) */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 22, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 200px', minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6 }}>Categoría</span>
          <ListaDesplegable
            etiqueta="Filtrar por categoría"
            multiple
            valor={catsMarcadas}
            onCambio={setCatsElegidas}
            /* Con dos o más marcadas sale arriba el interruptor "Todas a la
               vez / Cualquiera" con la frase de lo que va a salir; antes de eso,
               un aviso de que va a aparecer. Ver `ModoDeFiltro`. */
            separador={modoCats === 'todas' ? ' + ' : ' o '}
            cabecera={catsMarcadas.length >= 2
              ? <ModoDeFiltro modo={modoCats} onCambio={setModoCats} nombres={nombresCats} verbo="son" />
              : undefined}
            pie={catsMarcadas.length < 2
              ? <AyudaVarias texto="Puedes marcar varias. Con dos o más eliges si deben tenerlas todas o cualquiera." />
              : undefined}
            opciones={[
              { limpia: true, valor: 'all', etiqueta: 'Todas las categorías', nota: String(counts.all ?? 0) },
              /* Andrés, 28 sep 2026: "abajo de 'todas las categorías' un botón
                 de 'agregar categoría'". Mirando la cuenta de un coach no se
                 ofrece: quedaría a nombre del master, visible para todos. */
              ...(viendoComo ? [] : [{ accion: () => setCreando('categoria'), etiqueta: 'Agregar categoría' }]),
              ...categoriasVisibles.map((c) => ({
                valor: c.id, etiqueta: c.name, color: c.color, nota: String(counts[c.id] ?? 0),
              })),
            ]}
          />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: '1 1 200px', minWidth: 0 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: T.text3, textTransform: 'uppercase', letterSpacing: 0.6 }}>Grupo muscular</span>
          <ListaDesplegable
            etiqueta="Filtrar por grupo muscular"
            multiple
            valor={gruposMarcados.map((g) => g.id)}
            onCambio={setGruposElegidos}
            separador={modoGrupos === 'todas' ? ' + ' : ' o '}
            cabecera={gruposMarcados.length >= 2
              ? <ModoDeFiltro modo={modoGrupos} onCambio={setModoGrupos} nombres={nombresGrupos} verbo="trabajan" />
              : undefined}
            pie={gruposMarcados.length < 2
              ? <AyudaVarias texto="Puedes marcar varios. Con dos o más eliges si deben trabajarlos todos o cualquiera." />
              : undefined}
            opciones={[
              { limpia: true, valor: 'all', etiqueta: 'Todos los grupos', nota: String(groupCounts.all ?? 0) },
              ...(viendoComo ? [] : [{ accion: () => setCreando('grupo'), etiqueta: 'Agregar grupo' }]),
              // Todos, también los que van en 0: antes se escondían, y un grupo
              // recién agregado no aparecía por ningún lado.
              ...grupos.map((g) => ({
                valor: g.id, etiqueta: g.label, nota: String(groupCounts[g.id] ?? 0),
              })),
            ]}
          />
        </label>
        {/* Alineado abajo para que quede a la altura de las dos listas, no de
            sus rótulos. */}
        <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 1 }}>
          <InterruptorVista vista={enTarjetas ? 'tarjetas' : 'lista'} onCambio={eligeVista} />
        </div>
      </div>

      {err && (
        <div style={{ background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 12, padding: '12px 16px', fontWeight: 600, marginBottom: 16 }}>
          {err}
        </div>
      )}

      {/* LO QUE SE ESTÁ VIENDO, en palabras y donde se miran los resultados.
          Andrés, 28 sep 2026: con "Fuerza" y "Pliometría" marcadas, alguien
          espera todos los de Fuerza y todos los de Pliometría, no los que son
          las dos cosas. El "y también" y el "o" van en azul: son lo que cambia
          el significado. Solo sale con varias marcadas en una lista. */}
      {(catsMarcadas.length >= 2 || gruposMarcados.length >= 2) && (
        <div style={{ fontSize: 13, fontWeight: 600, color: T.text2, lineHeight: 1.5, margin: '-10px 0 16px' }}>
          <b style={{ color: T.text, fontWeight: 800 }}>{filtered.length}</b>{' '}
          {filtered.length === 1 ? 'ejercicio' : 'ejercicios'}
          {nombresCats.length > 0 && (
            <> · Categoría: <NombresUnidos nombres={nombresCats} modo={modoCats} /></>
          )}
          {nombresGrupos.length > 0 && (
            <> · Grupo: <NombresUnidos nombres={nombresGrupos} modo={modoGrupos} /></>
          )}
        </div>
      )}

      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 20px', color: T.text3 }}>
          <Dumbbell size={40} style={{ opacity: 0.4 }} />
          <div style={{ marginTop: 12, fontWeight: 600, color: T.text2, lineHeight: 1.5 }}>
            {/* Una categoría o un grupo recién creados llegan aquí vacíos: se
                dice cómo llenarlos en vez de un "sin ejercicios" a secas. */}
            {visible.length === 0 && sinBase
              /* Empezó desde cero (Mi perfil → Mis ejercicios): la lista vacía es lo esperado, no un filtro sin resultados. */
              ? 'Tu lista empieza vacía. Agrega tu primer ejercicio, o prende los de Training Lab en Mi perfil → Mis ejercicios.'
              : categoriaSola
              ? `«${categoriaSola.name}» todavía no tiene ejercicios. Abre uno y ponla como categoría principal o secundaria.`
              : grupoSolo
                ? `«${grupoSolo.label}» todavía no tiene ejercicios. Abre uno y elige este grupo como principal o secundario.`
                : marcadasVarias
                  ? 'Ningún ejercicio cumple todo lo que marcaste. Quita alguna opción, o elige «Cualquiera» en la lista.'
                  : 'Sin ejercicios para este filtro.'}
          </div>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gap: enTarjetas ? 14 : 8,
            // En el teléfono la tarjeta con foto gastaba 116 px por ejercicio en
            // un hueco que 80 de 81 veces está vacío. En computadora caben
            // cuatro por fila y la foto grande sí se gana el espacio.
            // minmax(0, 1fr) y no '1fr' a secas: '1fr' equivale a minmax(auto, 1fr),
            // y ese `auto` deja que un nombre largo empuje la columna más allá de
            // la pantalla. Se desbordaba y el botón de grabar quedaba fuera.
            gridTemplateColumns: enTarjetas ? 'repeat(auto-fill, minmax(220px, 1fr))' : 'minmax(0, 1fr)',
          }}
        >
          {filtered.map((ex) => (enTarjetas ? (
            <ExerciseCard
              key={ex.id} ex={ex} base={!isMaster && ex.isBase} conVideoExtra={conVideoExtra.has(ex.id)}
              onClick={() => openExercise(ex)}
            />
          ) : (
            <ExerciseRow
              key={ex.id} ex={ex} base={!isMaster && ex.isBase} conVideoExtra={conVideoExtra.has(ex.id)}
              abierto={preguntando?.id === ex.id}
              onAbrir={() => setPreguntando(preguntando?.id === ex.id ? null : ex)}
              onMedia={() => openExercise(ex, 'media')}
              onEditar={() => openExercise(ex, 'todo')}
            />
          )))}
        </div>
      )}


      {editing && (
        <ExerciseEditor
          /* `key` obliga a rearmar el formulario al cambiar de ejercicio. Sin
             esto, el estado inicial se calcula una sola vez y el formulario se
             quedaría con los datos del ejercicio anterior: se guardarían los
             campos de uno encima de otro sin que nada avisara. */
          key={editing.exercise?.id ?? 'nuevo'}
          exercise={editing.exercise || null}
          categories={categoriasVisibles}
          duenoId={dueño}
          masterId={masterId}
          // Mirando la cuenta de un coach, una categoría nueva quedaría a nombre
          // del master —o sea visible para TODOS—, así que ahí no se ofrece.
          puedeCrearCategoria={!viendoComo}
          onCategoriaCreada={(fila) => setCategories((prev) => [...prev, fila])}
          onCategoriaBorrada={(id) => {
            setCategories((prev) => prev.filter((c) => c.id !== id));
            setCatsElegidas((prev) => prev.filter((x) => x !== id));
          }}
          grupos={grupos}
          puedeCrearGrupo={!viendoComo}
          onGrupoCreado={(fila) => setGruposPropios((prev) => [...prev, fila])}
          onGrupoBorrado={(id) => {
            setGruposPropios((prev) => prev.filter((g) => g.id !== id));
            setGruposElegidos((prev) => prev.filter((x) => x !== `propio-${id}`));
          }}
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

      {creando === 'categoria' && (
        <DialogoNombre
          titulo="Nueva categoría"
          detalle="Después, al editar un ejercicio, la eliges como principal o secundaria."
          onCancelar={() => setCreando(null)}
          onCrear={async (nombre) => {
            const fila = await crearCategoriaPropia({ nombre, categorias: categoriasVisibles, duenoId: dueño, masterId });
            setCategories((prev) => [...prev, fila]);
            // Queda puesta en el filtro, sola: así se ve que existe y el aviso
            // de lista vacía dice qué sigue. Con otro filtro encima saldría un
            // "sin ejercicios" que no explica nada.
            setCatsElegidas([fila.id]);
            setGruposElegidos([]);
            setSearch('');
            setCreando(null);
          }}
        />
      )}
      {creando === 'grupo' && (
        <DialogoNombre
          titulo="Nuevo grupo muscular"
          detalle="Después, al editar un ejercicio, lo eliges como principal o secundario."
          onCancelar={() => setCreando(null)}
          onCrear={async (nombre) => {
            const fila = await crearGrupoPropio({ nombre, grupos, duenoId: dueño });
            setGruposPropios((prev) => [...prev, fila]);
            setGruposElegidos([`propio-${fila.id}`]);
            setCatsElegidas([]);
            setSearch('');
            setCreando(null);
          }}
        />
      )}

      <style>{`.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
