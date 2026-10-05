import { useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft, Check, Loader2, Plus, Trash2, X } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { useConfirmacion } from '@/components/Confirmacion';
import { useRepertorioDelEditor } from '@/features/admin/useRepertorioDelEditor';
import { useIsWide } from '@/lib/useViewport';
import { SessionEditor, Pill } from '@/features/admin/PlanBuilder';
import { actualizarItem, borrarItem, guardarItem } from '@/lib/misPlanes';
import { sesionesDeWorkout, workoutDeSesiones } from '@/lib/misPlanesDatos';
import DialogoGuardar from '@/features/misplanes/DialogoGuardar';
import { campo, etiquetaChica } from '@/features/misplanes/estilos';
import { T, FONT, KP } from '@/lib/theme';

const clone = (o) => structuredClone(o);
const sesionNueva = () => ({ day: 'Lun', name: 'Sesión', cat: 'gym', exercises: [] });

/**
 * El editor de un WORKOUT de Mis planes: el mismo panel del día que se usa dentro del plan de un atleta
 * (nombre y tipo de la sesión, sets, ejercicios, vista de tarjetas o lista), sin atleta ni plan alrededor
 * (Andrés, 2 oct 2026: «el editor quiero que se vea como el que ya uso normalmente»). Un workout puede traer
 * más de una sesión —mañana y tarde— con «Añadir otra sesión», igual que un día del plan.
 *
 * `catalogo`: { item, data } para uno que ya existe, o { carpetaId } para uno nuevo. Guardar un workout
 * nuevo pregunta primero nombre, descripción y carpeta; después solo actualiza.
 */
export default function EditorDeWorkout({ catalogo, onClose, onSaved, onDeleted }) {
  const { user } = useAuth();
  const { t } = usePalabras();
  const esAncha = useIsWide();
  const pregunta = useConfirmacion();
  const {
    repertoire, setRepertoire, setCategorias, masterIdCat, categoriasVisibles,
  } = useRepertorioDelEditor();
  const [fila, setFila] = useState(catalogo.item ?? null);
  const [titulo, setTitulo] = useState(catalogo.item?.nombre ?? '');
  // El día de la semana no se guarda en un workout: aquí es solo un relleno que el editor del día pide.
  const [sesiones, setSesiones] = useState(() => (catalogo.data
    ? sesionesDeWorkout(catalogo.data).map((s) => ({ ...clone(s), day: 'Lun' }))
    : [sesionNueva()]));
  const [dirty, setDirty] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [haGuardado, setHaGuardado] = useState(false);
  const [error, setError] = useState('');
  const [dialogo, setDialogo] = useState(false);

  const cambia = (fn) => { setDirty(true); setSesiones(fn); };
  const parchea = (i, patch) => cambia((prev) => prev.map((s, k) => (k === i ? { ...s, ...patch } : s)));

  async function guardar() {
    if (!titulo.trim()) { setError('Ponle un nombre al workout'); return; }
    // Algo nuevo pregunta primero dónde guardarlo.
    if (!fila) { setDialogo(true); return; }
    setError('');
    setGuardando(true);
    try {
      const actualizada = await actualizarItem(fila, { nombre: titulo.trim(), data: workoutDeSesiones(sesiones) });
      setFila(actualizada);
      setDirty(false);
      setHaGuardado(true);
      onSaved?.(actualizada);
    } catch (e) {
      setError(e.message || 'Error al guardar');
    } finally {
      setGuardando(false);
    }
  }

  async function cerrar() {
    if (dirty) {
      const va = await pregunta({
        titulo: 'Tienes cambios sin guardar', detalle: 'Si sales ahora se pierden.',
        confirmar: 'Salir sin guardar', cancelar: 'Seguir aquí', peligro: true,
      });
      if (!va) return;
    }
    onClose();
  }

  async function eliminar() {
    if (!fila) return;
    const va = await pregunta({
      titulo: `¿Eliminar «${fila.nombre}» de Mis planes?`,
      detalle: t('No se puede recuperar. Los atletas que ya lo recibieron lo conservan: lo que se les dio es una copia.'),
      confirmar: 'Sí, eliminarlo', peligro: true,
    });
    if (!va) return;
    try {
      await borrarItem(fila);
      setDirty(false);
      onDeleted?.();
    } catch (e) {
      setError(e.message || 'No se pudo eliminar');
    }
  }

  const quitarSesion = async (i) => {
    const va = await pregunta({ titulo: `¿Quitar la sesión «${sesiones[i].name || i + 1}»?`, detalle: 'Se va con todos sus ejercicios.', confirmar: 'Sí, quitarla', peligro: true });
    if (va) cambia((prev) => prev.filter((_, k) => k !== i));
  };

  return createPortal(
    <div style={{ position: 'fixed', inset: 0, zIndex: 2400, background: T.bg, fontFamily: FONT, display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          background: 'rgba(255,255,255,0.86)', backdropFilter: 'saturate(180%) blur(16px)', borderBottom: `1px solid ${T.border}`,
          padding: esAncha ? '13px 18px' : '13px 12px', display: 'flex', alignItems: 'center', gap: esAncha ? 12 : 8, flexShrink: 0,
        }}
      >
        <button
          type="button" onClick={cerrar} aria-label="Volver"
          style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${T.border}`, cursor: 'pointer', background: T.bg2, color: T.text, display: 'grid', placeItems: 'center', flexShrink: 0 }}
        >
          <ArrowLeft size={17} />
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Arriba va el nombre del workout (o «Workout nuevo» mientras no tiene); abajo, qué es y dónde vive. */}
          <div style={{ fontSize: 15, fontWeight: 800, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {titulo.trim() || 'Workout nuevo'}
          </div>
          <div style={{ fontSize: 12, color: T.text2, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            Workout · Mis planes{dirty ? ' · sin guardar' : (haGuardado ? ' · guardado' : '')}
          </div>
        </div>
        <button
          type="button" onClick={guardar} disabled={guardando || (!dirty && !!fila)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: esAncha ? '11px 18px' : '11px 13px', borderRadius: 12, border: 'none',
            cursor: guardando || (!dirty && fila) ? 'default' : 'pointer',
            background: dirty || !fila ? `linear-gradient(135deg, ${T.accent}, ${T.accentDk})` : T.bg3,
            color: dirty || !fila ? '#fff' : (haGuardado ? KP.mint : T.text3), fontFamily: FONT, fontSize: 14, fontWeight: 800,
            boxShadow: dirty || !fila ? KP.shBtn : 'none', opacity: guardando ? 0.75 : 1, flexShrink: 0,
          }}
        >
          {guardando ? <Loader2 size={15} className="spin" /> : <Check size={15} />}
          {!dirty && haGuardado ? 'Guardado' : 'Guardar'}
        </button>
        <button
          type="button" onClick={cerrar} aria-label="Cerrar"
          style={{ width: 36, height: 36, borderRadius: 11, border: `1px solid ${T.border}`, cursor: 'pointer', background: T.bg2, color: T.text2, display: 'grid', placeItems: 'center', flexShrink: 0 }}
        >
          <X size={17} />
        </button>
      </header>

      {error && (
        <div style={{ maxWidth: 760, margin: '14px auto 0', width: 'calc(100% - 36px)', background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 12, padding: '11px 15px', fontWeight: 700, fontSize: 13.5 }}>
          {error}
        </div>
      )}

      <main style={{ flex: 1, overflowY: 'auto', padding: '20px 18px 60px' }}>
        <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            <span style={etiquetaChica}>Nombre del workout</span>
            <input
              value={titulo} onChange={(e) => { setTitulo(e.target.value); setDirty(true); }}
              style={campo}
            />
          </label>

          {sesiones.map((s, i) => (
            <SessionEditor
              key={i}
              day={s}
              repertoire={repertoire}
              categorias={categoriasVisibles}
              duenoId={user?.id}
              masterId={masterIdCat}
              onCategoriaCreada={(f) => setCategorias((prev) => [...prev, f])}
              onCategoriaBorrada={(id) => setCategorias((prev) => prev.filter((c) => c.id !== id))}
              onEjercicioCreado={(f) => setRepertoire((prev) => [...prev, { ...f, isMine: true, isBase: false }])}
              onPatch={(patch) => parchea(i, patch)}
              onDelete={sesiones.length > 1 ? () => quitarSesion(i) : undefined}
            />
          ))}

          {/* Sin contorno punteado (Andrés, 28 sep 2026): blanco, borde sólido y azul. */}
          <button
            type="button" onClick={() => cambia((prev) => [...prev, sesionNueva()])} className="kp-press"
            style={{
              minHeight: 46, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14,
              border: `1.5px solid ${T.border}`, background: T.bg2, cursor: 'pointer', boxShadow: KP.shCard,
              fontFamily: FONT, fontSize: 14, fontWeight: 800, color: T.accent,
            }}
          >
            <Plus size={16} /> Añadir otra sesión
          </button>

          {fila && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <Pill icon={Trash2} danger onClick={eliminar}>Eliminar de Mis planes</Pill>
            </div>
          )}
        </div>
      </main>

      {dialogo && (
        <DialogoGuardar
          tipo="workout" nombreInicial={titulo} carpetaInicial={catalogo.carpetaId ?? null}
          onGuardar={async ({ nombre, descripcion, carpetaId }) => {
            const creada = await guardarItem({
              tipo: 'workout', nombre, descripcion, origen: 'Creado desde cero', carpetaId,
              data: workoutDeSesiones(sesiones), userId: user?.id,
            });
            setFila(creada);
            setTitulo(creada.nombre);
            setDirty(false);
            setHaGuardado(true);
            onSaved?.(creada);
          }}
          onCerrar={() => setDialogo(false)}
        />
      )}

      <style>{`
        .spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}
        .kp-pill,.kp-ico{transition:background .12s}
        .kp-pill:hover:not(:disabled),.kp-ico:hover:not(:disabled){background:${T.bg3} !important}
      `}</style>
    </div>,
    document.body,
  );
}
