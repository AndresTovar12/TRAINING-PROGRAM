import { useState } from 'react';
import {
  Check, Copy, FolderInput, FolderOpen, FolderPlus, Loader2, MoreHorizontal, Pencil, Plus, Search, Send, TextCursorInput, Trash2,
} from 'lucide-react';
import { useAviso } from '@/components/AvisoPasajero';
import { useConfirmacion } from '@/components/Confirmacion';
import { usePalabras } from '@/contexts/PalabrasContext';
import PlanBuilder, { HojaAcciones } from '@/features/admin/PlanBuilder';
import {
  abrirItem, actualizarItem, borrarCarpeta, borrarItem, crearCarpeta, duplicarItem, moverCarpeta, renombrarCarpeta,
} from '@/lib/misPlanes';
import { useMisPlanes } from '@/lib/useMisPlanes';
import { useIsWide } from '@/lib/useViewport';
import {
  TIPOS, cabeCarpetaEn, hijasDe, nombreDeCopia, planDeRutina, puedeMoverCarpeta, textoDeRuta,
} from '@/lib/misPlanesDatos';
import Ventana from '@/features/misplanes/Ventana';
import ListaDeMisPlanes from '@/features/misplanes/ListaDeMisPlanes';
import SelectorDeCarpeta from '@/features/misplanes/SelectorDeCarpeta';
import DialogoGuardar from '@/features/misplanes/DialogoGuardar';
import CentroDeCreacion from '@/features/misplanes/CentroDeCreacion';
import EditorDeWorkout from '@/features/misplanes/EditorDeWorkout';
import AsignarDialog from '@/features/misplanes/AsignarDialog';
import FiltroDeTipo from '@/features/misplanes/FiltroDeTipo';
import { botonBlanco, botonPrincipal, campo } from '@/features/misplanes/estilos';
import { T } from '@/lib/theme';

/* Mover algo (o una carpeta) a otra carpeta: se entra de carpeta en carpeta y se elige. */
function DialogoMover({ titulo, carpetas, inicial, excluirId, alMover, onCerrar, crear }) {
  const [destino, setDestino] = useState(inicial ?? null);
  const [moviendo, setMoviendo] = useState(false);
  const [error, setError] = useState('');
  const valido = excluirId ? puedeMoverCarpeta(carpetas, excluirId, destino) : true;
  async function mover() {
    setMoviendo(true);
    setError('');
    try {
      await alMover(destino);
      onCerrar();
    } catch (e) {
      setError(e.message || 'No se pudo mover');
      setMoviendo(false);
    }
  }
  return (
    <Ventana
      titulo={titulo} onCerrar={onCerrar}
      pie={(
        <>
          <button type="button" onClick={onCerrar} style={botonBlanco()}>Cancelar</button>
          <button type="button" onClick={mover} disabled={!valido || moviendo} style={botonPrincipal(!valido || moviendo)}>
            {moviendo ? <Loader2 size={16} className="spin" /> : <Check size={16} />} Mover aquí
          </button>
        </>
      )}
    >
      <SelectorDeCarpeta carpetas={carpetas} valor={destino} onCambio={setDestino} excluirId={excluirId} crearCarpeta={crear} />
      {error && <div style={{ fontSize: 13, fontWeight: 700, color: T.danger, marginTop: 10 }}>{error}</div>}
    </Ventana>
  );
}

/**
 * La pestaña «Mis planes»: todo lo que un profesional guarda —workouts, rutinas semanales y programas— en sus
 * carpetas (Andrés, 2 oct 2026). Aquí se crea («+ Crear» abre el Centro de creación), se ordena (carpetas con
 * subcarpetas, mover, renombrar, duplicar, borrar) y se le da a los atletas (uno o varios a la vez).
 */
export default function MisPlanesPanel() {
  const pregunta = useConfirmacion();
  const { t } = usePalabras();
  const { trabajando } = useAviso();
  const esAncha = useIsWide();
  const { cargando, error, carpetas, items, userId, recargar } = useMisPlanes();
  const [nivel, setNivel] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState(null);
  const [creando, setCreando] = useState(false);
  const [editor, setEditor] = useState(null);
  const [menu, setMenu] = useState(null);
  const [dialogo, setDialogo] = useState(null);
  const [aviso, setAviso] = useState('');

  const tiposVistos = filtro ? [filtro] : TIPOS;
  const hayAlgo = carpetas.length > 0 || items.length > 0;

  // Una carpeta nueva desde un selector: se crea, se vuelve a leer la lista y se devuelve la fila.
  const crearDesdeSelector = async (nombre, padreId) => {
    const fila = await crearCarpeta({ nombre, parentId: padreId, userId });
    await recargar();
    return fila;
  };

  async function abrir(item) {
    setAviso('');
    try {
      const data = await abrirItem(item);
      if (item.tipo === 'workout') {
        setEditor({ tipo: 'workout', item, data });
      } else if (item.tipo === 'rutina') {
        setEditor({ tipo: 'plan', catalogo: { item, phases: planDeRutina(data).phases, estructura: 'rutina' } });
      } else {
        setEditor({ tipo: 'plan', catalogo: { item, phases: data.phases ?? [], estructura: data.estructura || 'fases' } });
      }
    } catch (e) {
      setAviso(e.message || 'No se pudo abrir');
    }
  }

  function crear(forma) {
    setCreando(false);
    setEditor(forma === 'workout'
      ? { tipo: 'workout', carpetaId: nivel }
      : { tipo: 'plan', catalogo: { forma, carpetaId: nivel } });
  }

  // Lo que tarda un par de segundos (la base y volver a leer la lista) avisa que está trabajando y, al terminar, que ya.
  async function duplicar(item) {
    setAviso('');
    try {
      await trabajando('Duplicando…', async () => {
        await duplicarItem(item, nombreDeCopia(item.nombre, items.map((i) => i.nombre)), userId);
        await recargar();
      }, 'Duplicado');
    } catch (e) {
      setAviso(e.message || 'No se pudo duplicar');
    }
  }

  async function eliminarItem(item) {
    const va = await pregunta({
      titulo: `¿Eliminar «${item.nombre}»?`,
      detalle: t('No se puede recuperar. Los atletas que ya lo recibieron lo conservan: lo que se les dio es una copia.'),
      confirmar: 'Sí, eliminarlo', peligro: true,
    });
    if (!va) return;
    try {
      await trabajando('Eliminando…', async () => {
        await borrarItem(item);
        await recargar();
      }, 'Eliminado');
    } catch (e) {
      setAviso(e.message || 'No se pudo eliminar');
    }
  }

  async function eliminarCarpeta(carpeta) {
    const dentro = items.filter((i) => i.carpetaId === carpeta.id).length + hijasDe(carpetas, carpeta.id).length;
    const va = await pregunta({
      titulo: `¿Eliminar la carpeta «${carpeta.nombre}»?`,
      detalle: dentro ? 'Lo que tiene adentro sube un nivel: no se borra nada.' : 'Está vacía.',
      confirmar: 'Sí, eliminarla', peligro: true,
    });
    if (!va) return;
    try {
      await trabajando('Eliminando la carpeta…', async () => {
        await borrarCarpeta(carpeta);
        if (nivel === carpeta.id) setNivel(carpeta.parent_id ?? null);
        await recargar();
      }, 'Carpeta eliminada');
    } catch (e) {
      setAviso(e.message || 'No se pudo eliminar la carpeta');
    }
  }

  const botonDeMenu = (etiqueta, alTocar) => (
    <button
      type="button" onClick={alTocar} aria-label={etiqueta} title={etiqueta} className="kp-ico"
      style={{ width: 38, height: 38, borderRadius: 11, border: 'none', cursor: 'pointer', flexShrink: 0, background: 'transparent', color: T.text2, display: 'grid', placeItems: 'center' }}
    >
      <MoreHorizontal size={19} />
    </button>
  );

  const accionesItem = (item) => (
    <>
      <button
        type="button" onClick={() => setDialogo({ tipo: 'asignar', item })}
        style={{ ...botonBlanco(true), minHeight: 38, padding: '0 13px', fontSize: 13 }}
      >
        <Send size={15} /> Asignar
      </button>
      {botonDeMenu(`Opciones de ${item.nombre}`, () => setMenu({ tipo: 'item', item }))}
    </>
  );
  const accionesCarpeta = (carpeta) => botonDeMenu(`Opciones de ${carpeta.nombre}`, () => setMenu({ tipo: 'carpeta', carpeta }));

  const carpetaOk = cabeCarpetaEn(carpetas, nivel);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820, margin: '0 auto' }}>
      {/* Sin frase gris abajo del título: repetía lo que dicen el filtro y la lista (Andrés: letras grises que repiten).
          En el celular «Nueva carpeta» es solo el ícono, para que quepa todo en una fila. */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ flex: 1, minWidth: 0, fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: -0.4 }}>Mis planes</div>
        <button
          type="button" onClick={() => setDialogo({ tipo: 'carpeta-nueva' })} disabled={!carpetaOk}
          aria-label="Nueva carpeta" title="Nueva carpeta"
          style={{ ...botonBlanco(true, !carpetaOk), ...(esAncha ? null : { width: 42, padding: 0 }) }}
        >
          <FolderPlus size={17} />{esAncha && <span>Nueva carpeta</span>}
        </button>
        <button type="button" onClick={() => setCreando(true)} style={botonPrincipal(false)}>
          <Plus size={17} /> Crear
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 0 }}>
          <Search size={16} color={T.text3} style={{ position: 'absolute', left: 12, top: 13 }} />
          <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar en Mis planes" style={{ ...campo, paddingLeft: 36 }} />
        </div>
        <FiltroDeTipo tipos={TIPOS} valor={filtro} onCambio={setFiltro} />
      </div>

      {(error || aviso) && (
        <div style={{ background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 12, padding: '11px 15px', fontWeight: 700, fontSize: 13.5 }}>{aviso || error}</div>
      )}

      {cargando ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: T.text2, fontWeight: 600, padding: 30 }}>
          <Loader2 size={18} className="spin" /> Cargando Mis planes…
        </div>
      ) : (
        <ListaDeMisPlanes
          carpetas={carpetas} items={items} tipos={tiposVistos} nivel={nivel} onNivel={setNivel} buscar={buscar}
          onItem={abrir} accionesItem={accionesItem} accionesCarpeta={accionesCarpeta}
          vacio={!hayAlgo ? (
            <div style={{ textAlign: 'center', padding: '40px 20px 32px' }}>
              <span style={{ width: 56, height: 56, borderRadius: 18, background: T.accentBg, color: T.accent, display: 'inline-grid', placeItems: 'center' }}>
                <FolderOpen size={26} />
              </span>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginTop: 14 }}>Aquí vivirá todo lo que guardes</div>
              <div style={{ fontSize: 14, fontWeight: 600, color: T.text2, lineHeight: 1.5, margin: '6px auto 0', maxWidth: 360 }}>
                {t('Crea un workout, una rutina o un programa, o guarda el plan de un atleta desde su ficha.')}
              </div>
              <button type="button" onClick={() => setCreando(true)} style={{ ...botonPrincipal(false), marginTop: 18 }}>
                <Plus size={17} /> Crear
              </button>
            </div>
          ) : undefined}
        />
      )}

      {creando && (
        <CentroDeCreacion
          carpetaTexto={nivel ? `«${textoDeRuta(carpetas, nivel)}»` : null}
          onElegir={crear} onCerrar={() => setCreando(false)}
        />
      )}

      {editor?.tipo === 'workout' && (
        <EditorDeWorkout
          catalogo={{ item: editor.item, data: editor.data, carpetaId: editor.carpetaId }}
          onClose={() => { setEditor(null); recargar(); }}
          onSaved={() => recargar()}
          onDeleted={() => { setEditor(null); recargar(); }}
        />
      )}
      {editor?.tipo === 'plan' && (
        <PlanBuilder
          catalogo={editor.catalogo}
          onClose={() => { setEditor(null); recargar(); }}
          onSaved={() => recargar()}
          onDeleted={() => { setEditor(null); recargar(); }}
        />
      )}

      {menu?.tipo === 'item' && (
        <HojaAcciones
          onClose={() => setMenu(null)}
          acciones={[
            { icon: Pencil, texto: 'Abrir y editar', onClick: () => abrir(menu.item) },
            { icon: TextCursorInput, texto: 'Nombre y descripción', onClick: () => setDialogo({ tipo: 'item-renombrar', item: menu.item }) },
            { icon: Copy, texto: 'Duplicar', onClick: () => duplicar(menu.item) },
            { icon: FolderInput, texto: 'Mover a otra carpeta', onClick: () => setDialogo({ tipo: 'mover-item', item: menu.item }) },
            { icon: Trash2, texto: 'Eliminar', onClick: () => eliminarItem(menu.item), peligro: true },
          ]}
        />
      )}
      {menu?.tipo === 'carpeta' && (
        <HojaAcciones
          onClose={() => setMenu(null)}
          acciones={[
            { icon: TextCursorInput, texto: 'Cambiar el nombre', onClick: () => setDialogo({ tipo: 'carpeta-renombrar', carpeta: menu.carpeta }) },
            { icon: FolderInput, texto: 'Mover a otra carpeta', onClick: () => setDialogo({ tipo: 'mover-carpeta', carpeta: menu.carpeta }) },
            { icon: Trash2, texto: 'Eliminar la carpeta', onClick: () => eliminarCarpeta(menu.carpeta), peligro: true },
          ]}
        />
      )}

      {dialogo?.tipo === 'carpeta-nueva' && (
        <DialogoGuardar
          titulo="Nueva carpeta" soloNombre textoBoton="Crear" placeholder="Ej. Football americano"
          onGuardar={async ({ nombre }) => { await crearCarpeta({ nombre, parentId: nivel, userId }); await recargar(); }}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'carpeta-renombrar' && (
        <DialogoGuardar
          titulo="Cambiar el nombre de la carpeta" soloNombre nombreInicial={dialogo.carpeta.nombre}
          onGuardar={async ({ nombre }) => { await renombrarCarpeta(dialogo.carpeta.id, nombre); await recargar(); }}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'item-renombrar' && (
        <DialogoGuardar
          titulo="Nombre y descripción" sinCarpeta tipo={dialogo.item.tipo}
          nombreInicial={dialogo.item.nombre} descripcionInicial={dialogo.item.descripcion}
          onGuardar={async ({ nombre, descripcion }) => { await actualizarItem(dialogo.item, { nombre, descripcion }); await recargar(); }}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'mover-item' && (
        <DialogoMover
          titulo={`Mover «${dialogo.item.nombre}»`} carpetas={carpetas} inicial={dialogo.item.carpetaId} crear={crearDesdeSelector}
          alMover={async (destino) => { await actualizarItem(dialogo.item, { carpetaId: destino }); await recargar(); }}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'mover-carpeta' && (
        <DialogoMover
          titulo={`Mover la carpeta «${dialogo.carpeta.nombre}»`} carpetas={carpetas} inicial={dialogo.carpeta.parent_id ?? null}
          excluirId={dialogo.carpeta.id} crear={crearDesdeSelector}
          alMover={async (destino) => { await moverCarpeta(dialogo.carpeta.id, destino); await recargar(); }}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'asignar' && <AsignarDialog item={dialogo.item} onCerrar={() => setDialogo(null)} />}
    </div>
  );
}
