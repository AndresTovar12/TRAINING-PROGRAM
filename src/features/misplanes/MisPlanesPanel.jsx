import { useState } from 'react';
import {
  Check, Copy, FolderInput, FolderPlus, Loader2, MoreHorizontal, Pencil, Plus, Search, Send, Trash2,
} from 'lucide-react';
import { useConfirmacion } from '@/components/Confirmacion';
import PlanBuilder, { HojaAcciones } from '@/features/admin/PlanBuilder';
import {
  abrirItem, actualizarItem, borrarCarpeta, borrarItem, crearCarpeta, duplicarItem, moverCarpeta, renombrarCarpeta,
} from '@/lib/misPlanes';
import { useMisPlanes } from '@/lib/useMisPlanes';
import {
  PLURAL_DE_TIPO, TIPOS, cabeCarpetaEn, hijasDe, nombreDeCopia, planDeRutina, puedeMoverCarpeta, textoDeRuta,
} from '@/lib/misPlanesDatos';
import Ventana from '@/features/misplanes/Ventana';
import ListaDeMisPlanes from '@/features/misplanes/ListaDeMisPlanes';
import SelectorDeCarpeta from '@/features/misplanes/SelectorDeCarpeta';
import DialogoGuardar from '@/features/misplanes/DialogoGuardar';
import CentroDeCreacion from '@/features/misplanes/CentroDeCreacion';
import EditorDeWorkout from '@/features/misplanes/EditorDeWorkout';
import AsignarDialog from '@/features/misplanes/AsignarDialog';
import { botonBlanco, botonPrincipal, campo } from '@/features/misplanes/estilos';
import { T, FONT } from '@/lib/theme';

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

  async function duplicar(item) {
    setAviso('');
    try {
      await duplicarItem(item, nombreDeCopia(item.nombre, items.map((i) => i.nombre)), userId);
      await recargar();
    } catch (e) {
      setAviso(e.message || 'No se pudo duplicar');
    }
  }

  async function eliminarItem(item) {
    const va = await pregunta({
      titulo: `¿Eliminar «${item.nombre}»?`,
      detalle: 'No se puede recuperar. Los atletas que ya lo recibieron lo conservan: lo que se les dio es una copia.',
      confirmar: 'Sí, eliminarlo', peligro: true,
    });
    if (!va) return;
    try {
      await borrarItem(item);
      await recargar();
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
      await borrarCarpeta(carpeta);
      if (nivel === carpeta.id) setNivel(carpeta.parent_id ?? null);
      await recargar();
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

  const chip = (valor, texto) => {
    const activa = filtro === valor;
    return (
      <button
        key={texto} type="button" onClick={() => setFiltro(valor)}
        style={{
          padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
          border: `1.5px solid ${activa ? T.accent : T.border}`, background: activa ? T.accent : T.bg2, color: activa ? '#fff' : T.text2,
        }}
      >
        {texto}
      </button>
    );
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820, margin: '0 auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px', minWidth: 0 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: -0.4 }}>Mis planes</div>
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text2, marginTop: 2 }}>
            Todo lo que guardas: workouts, rutinas semanales y programas.
          </div>
        </div>
        <button
          type="button" onClick={() => setDialogo({ tipo: 'carpeta-nueva' })}
          disabled={!cabeCarpetaEn(carpetas, nivel)} style={botonBlanco(true, !cabeCarpetaEn(carpetas, nivel))}
        >
          <FolderPlus size={16} /> Nueva carpeta
        </button>
        <button type="button" onClick={() => setCreando(true)} style={botonPrincipal(false)}>
          <Plus size={17} /> Crear
        </button>
      </div>

      <div style={{ position: 'relative' }}>
        <Search size={16} color={T.text3} style={{ position: 'absolute', left: 12, top: 13 }} />
        <input value={buscar} onChange={(e) => setBuscar(e.target.value)} placeholder="Buscar por nombre, descripción u origen" style={{ ...campo, paddingLeft: 36 }} />
      </div>

      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 2 }}>
        {chip(null, 'Todo')}
        {TIPOS.map((t) => chip(t, PLURAL_DE_TIPO[t]))}
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
            <div style={{ textAlign: 'center', padding: '44px 20px', color: T.text2, fontWeight: 600, fontSize: 14, lineHeight: 1.6 }}>
              <div style={{ fontSize: 17, fontWeight: 800, color: T.text, marginBottom: 6 }}>Aquí vivirá todo lo que guardes</div>
              Crea algo con «Crear», o guarda un plan que ya armaste con «Guardar todo el plan en Mis planes» desde el plan de cualquier atleta.
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
            { icon: Send, texto: 'Asignar a atletas', onClick: () => setDialogo({ tipo: 'asignar', item: menu.item }) },
            { icon: Pencil, texto: 'Nombre y descripción', onClick: () => setDialogo({ tipo: 'item-renombrar', item: menu.item }) },
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
            { icon: Pencil, texto: 'Cambiar el nombre', onClick: () => setDialogo({ tipo: 'carpeta-renombrar', carpeta: menu.carpeta }) },
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
