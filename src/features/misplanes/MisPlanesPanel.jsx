import { useState } from 'react';
import {
  ChevronLeft, Copy, FolderInput, FolderOutput, FolderPlus, Loader2, MoreHorizontal, Pencil, Plus, Search, Send, SquareCheck,
  TextCursorInput, Trash2,
} from 'lucide-react';
import { useAviso } from '@/components/AvisoPasajero';
import { useConfirmacion } from '@/components/Confirmacion';
import { usePalabras } from '@/contexts/PalabrasContext';
import PlanBuilder, { HojaAcciones } from '@/features/admin/PlanBuilder';
import {
  abrirItem, actualizarItem, borrarCarpeta, borrarItem, crearCarpeta, duplicarItem, renombrarCarpeta,
} from '@/lib/misPlanes';
import { useMisPlanes } from '@/lib/useMisPlanes';
import { useIsWide } from '@/lib/useViewport';
import {
  TIPOS, cabeCarpetaEn, carpetasDeAbajoPrimero, carpetasQueSePuedenTraer, claveDeCarpeta, claveDeItem, coincide, hijasDe,
  nombreDeCopia, planDeRutina, rutaDeCarpeta, textoDeRuta,
} from '@/lib/misPlanesDatos';
import ListaDeMisPlanes from '@/features/misplanes/ListaDeMisPlanes';
import DialogoGuardar from '@/features/misplanes/DialogoGuardar';
import CentroDeCreacion from '@/features/misplanes/CentroDeCreacion';
import EditorDeWorkout from '@/features/misplanes/EditorDeWorkout';
import AsignarDialog from '@/features/misplanes/AsignarDialog';
import DestinoDeMover from '@/features/misplanes/DestinoDeMover';
import TraerAqui from '@/features/misplanes/TraerAqui';
import BarraDeSeleccion from '@/features/misplanes/BarraDeSeleccion';
import { VacioDeCarpeta, VacioDeMisPlanes } from '@/features/misplanes/EstadosVacios';
import FiltroDeTipo from '@/features/misplanes/FiltroDeTipo';
import { useMoverCosas } from '@/features/misplanes/useMoverCosas';
import { botonBlanco, botonPrincipal, campo } from '@/features/misplanes/estilos';
import { T, FONT } from '@/lib/theme';

const textoVacio = (texto) => (
  <div style={{ textAlign: 'center', padding: '30px 16px', color: T.text3, fontWeight: 600, fontSize: 13.5, lineHeight: 1.5 }}>{texto}</div>
);

/**
 * La pestaña «Mis planes»: todo lo que un profesional guarda —workouts, rutinas semanales y programas— en sus
 * carpetas (Andrés, 2 oct 2026). Aquí se crea («+ Crear» abre el Centro de creación), se ordena (carpetas con
 * subcarpetas, mover, renombrar, duplicar, borrar) y se le da a los atletas (uno o varios a la vez).
 *
 * Mover es fácil: «Mover a…» enseña tus carpetas en árbol y un toque mueve (con «Deshacer»); «Seleccionar» marca
 * varias cosas y carpetas para moverlas o borrarlas juntas; y dentro de una carpeta, «+ Agregar» crea algo nuevo
 * o TRAE lo que ya existe. Una carpeta puede tener carpetas adentro: se nota en «Nueva subcarpeta» y en el árbol.
 */
export default function MisPlanesPanel() {
  const pregunta = useConfirmacion();
  const { t } = usePalabras();
  const { trabajando } = useAviso();
  const esAncha = useIsWide();
  const { cargando, error, carpetas, items, userId, recargar } = useMisPlanes();
  const llevar = useMoverCosas({ carpetas, recargar });
  const [nivelElegido, setNivel] = useState(null);
  const [buscar, setBuscar] = useState('');
  const [filtro, setFiltro] = useState(null);
  const [creando, setCreando] = useState(false); // el Centro de creación
  const [agregando, setAgregando] = useState(false); // «+ Agregar», dentro de una carpeta
  const [editor, setEditor] = useState(null);
  const [menu, setMenu] = useState(null);
  const [dialogo, setDialogo] = useState(null);
  const [aviso, setAviso] = useState('');
  const [seleccionando, setSeleccionando] = useState(false);
  const [seleccion, setSeleccion] = useState(() => new Set());

  // Si la carpeta donde estás ya no existe (se borró desde otro lado), se vuelve a la raíz en vez de quedarse en una carpeta fantasma.
  const nivel = nivelElegido != null && carpetas.some((c) => c.id === nivelElegido) ? nivelElegido : null;
  const tiposVistos = filtro ? [filtro] : TIPOS;
  const buscando = buscar.trim().length > 0;
  const hayAlgo = carpetas.length > 0 || items.length > 0;
  const carpetaActual = nivel != null ? carpetas.find((c) => c.id === nivel) ?? null : null;
  const enCarpeta = !!carpetaActual;
  const carpetaOk = cabeCarpetaEn(carpetas, nivel);
  const nombreDeCarpeta = (id) => carpetas.find((c) => c.id === id)?.nombre ?? 'la carpeta';

  // Lo que se ve ahora en la lista (para «Seleccionar todo» y para saber si hay algo que marcar).
  const visiblesAqui = {
    items: items.filter((i) => tiposVistos.includes(i.tipo)
      && (buscando ? coincide(i, buscar) : (i.carpetaId ?? null) === (nivel ?? null))),
    carpetas: buscando ? [] : hijasDe(carpetas, nivel),
  };
  const clavesVisibles = [...visiblesAqui.items.map(claveDeItem), ...visiblesAqui.carpetas.map(claveDeCarpeta)];
  const cuantasVisibles = clavesVisibles.length;
  // Con algo adentro (de cualquier clase) la carpeta no está vacía, aunque un filtro lo esconda.
  const tieneAlgoAqui = carpetas.some((c) => (c.parent_id ?? null) === nivel) || items.some((i) => (i.carpetaId ?? null) === nivel);
  const hayQueTraer = enCarpeta && (items.some((i) => (i.carpetaId ?? null) !== nivel) || carpetasQueSePuedenTraer(carpetas, nivel).length > 0);

  // Lo marcado, ya como filas (lo que se borró o cambió de lugar desde que se marcó no cuenta).
  const marcadas = {
    items: items.filter((i) => seleccion.has(claveDeItem(i))),
    carpetas: carpetas.filter((c) => seleccion.has(claveDeCarpeta(c))),
  };
  const cuantasMarcadas = marcadas.items.length + marcadas.carpetas.length;
  const todoMarcado = cuantasVisibles > 0 && clavesVisibles.every((k) => seleccion.has(k));

  const salirDeSeleccion = () => { setSeleccionando(false); setSeleccion(new Set()); };
  const alternar = (clave) => setSeleccion((prev) => {
    const n = new Set(prev);
    if (n.has(clave)) n.delete(clave); else n.add(clave);
    return n;
  });
  const alternarTodo = () => setSeleccion((prev) => {
    const n = new Set(prev);
    clavesVisibles.forEach((k) => { if (todoMarcado) n.delete(k); else n.add(k); });
    return n;
  });

  // Una carpeta nueva desde un selector: se crea, se vuelve a leer la lista y se devuelve la fila.
  const crearDesdeSelector = async (nombre, padreId) => {
    const fila = await crearCarpeta({ nombre, parentId: padreId, userId });
    await recargar();
    return fila;
  };

  async function moverA(cosas, destinoId) {
    setAviso('');
    try {
      await llevar(cosas, destinoId);
    } catch (e) {
      setAviso(e.message || 'No se pudo mover');
      recargar();
    }
  }

  async function abrir(item) {
    setAviso('');
    try {
      const data = await abrirItem(item);
      if (item.tipo === 'workout') {
        setEditor({ tipo: 'workout', item, data });
      } else if (item.tipo === 'rutina') {
        setEditor({ tipo: 'plan', catalogo: { item, phases: planDeRutina(data).phases, estructura: 'rutina', foto: data.foto, ciencia: data.ciencia } });
      } else {
        setEditor({
          tipo: 'plan',
          catalogo: { item, phases: data.phases ?? [], estructura: data.estructura || 'fases', foto: data.foto, ciencia: data.ciencia },
        });
      }
    } catch (e) {
      setAviso(e.message || 'No se pudo abrir');
    }
  }

  function crear(forma) {
    setCreando(false);
    setAgregando(false);
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

  // Borrar lo marcado: primero las cosas y luego las carpetas, las de más abajo antes (lo de adentro sube un nivel).
  async function eliminarMarcadas() {
    const { items: cosas, carpetas: cajas } = marcadas;
    const n = cosas.length + cajas.length;
    if (!n) return;
    const detalle = [
      cosas.length ? t('No se puede recuperar. Los atletas que ya lo recibieron lo conservan: lo que se les dio es una copia.') : null,
      cajas.length ? 'Lo que tengan adentro las carpetas sube un nivel: no se borra nada.' : null,
    ].filter(Boolean).join(' ');
    const va = await pregunta({
      titulo: n === 1 ? `¿Eliminar «${(cosas[0] ?? cajas[0]).nombre}»?` : `¿Eliminar ${n} cosas?`,
      detalle, confirmar: 'Sí, eliminar', peligro: true,
    });
    if (!va) return;
    setAviso('');
    try {
      await trabajando('Eliminando…', async () => {
        await Promise.all(cosas.map((i) => borrarItem(i)));
        for (const c of carpetasDeAbajoPrimero(carpetas, cajas)) await borrarCarpeta(c);
        // Si se borró la carpeta donde estás (o una de arriba), se sube a la primera que sigue existiendo.
        const caen = new Set(cajas.map((c) => c.id));
        if (nivel != null && rutaDeCarpeta(carpetas, nivel).some((c) => caen.has(c.id))) {
          setNivel(rutaDeCarpeta(carpetas, nivel).filter((c) => !caen.has(c.id)).pop()?.id ?? null);
        }
        await recargar();
      }, n === 1 ? 'Eliminado' : `${n} eliminados`);
      salirDeSeleccion();
    } catch (e) {
      setAviso(e.message || 'No se pudo eliminar');
      recargar();
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

  const botonSeleccionar = !seleccionando && !cargando && cuantasVisibles > 0 ? (
    <button
      type="button" onClick={() => setSeleccionando(true)}
      style={{
        border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 800, color: T.accent,
        display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 2px', flexShrink: 0,
      }}
    >
      <SquareCheck size={15} /> Seleccionar
    </button>
  ) : null;

  const textoDelBoton = { border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 800, color: T.accent, padding: '8px 2px' };

  let vacio;
  if (!hayAlgo) {
    vacio = <VacioDeMisPlanes onCrear={() => setCreando(true)} />;
  } else if (enCarpeta && !tieneAlgoAqui && !buscando) {
    vacio = (
      <VacioDeCarpeta
        onCrear={() => setCreando(true)}
        onTraer={hayQueTraer ? () => setDialogo({ tipo: 'traer' }) : undefined}
        onSubcarpeta={carpetaOk ? () => setDialogo({ tipo: 'carpeta-nueva' }) : undefined}
      />
    );
  } else if (filtro && !buscando) {
    vacio = textoVacio('Nada con este filtro.');
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 820, margin: '0 auto', paddingBottom: seleccionando && cuantasMarcadas > 0 ? 88 : 0 }}>
      {seleccionando ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 42 }}>
          <button type="button" onClick={salirDeSeleccion} style={textoDelBoton}>Cancelar</button>
          <div style={{ flex: 1, minWidth: 0, textAlign: 'center', fontSize: 15, fontWeight: 800, color: T.text }}>
            {cuantasMarcadas === 0 ? 'Elige lo que quieras' : `${cuantasMarcadas} ${cuantasMarcadas === 1 ? 'seleccionada' : 'seleccionadas'}`}
          </div>
          <button type="button" onClick={alternarTodo} disabled={cuantasVisibles === 0} style={{ ...textoDelBoton, opacity: cuantasVisibles === 0 ? 0.5 : 1 }}>
            {todoMarcado ? 'Quitar todo' : 'Seleccionar todo'}
          </button>
        </div>
      ) : (
        /* Sin frase gris abajo del título: repetía lo que dicen el filtro y la lista (Andrés: letras grises que repiten).
           Dentro de una carpeta el título es SU nombre, hay una flecha para subir y los botones son «Nueva subcarpeta» y
           «+ Agregar». En el celular «Nueva carpeta» es solo el ícono, para que quepa todo en una fila. */
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {enCarpeta && (
            <button
              type="button" onClick={() => setNivel(carpetaActual.parent_id ?? null)} aria-label="Subir un nivel" title="Subir un nivel"
              style={{ width: 38, height: 38, borderRadius: 11, border: `1.5px solid ${T.border}`, background: T.bg2, color: T.text, cursor: 'pointer', display: 'grid', placeItems: 'center', flexShrink: 0 }}
            >
              <ChevronLeft size={19} />
            </button>
          )}
          <div style={{ flex: 1, minWidth: 0, fontSize: 22, fontWeight: 800, color: T.text, letterSpacing: -0.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {enCarpeta ? carpetaActual.nombre : 'Mis planes'}
          </div>
          <button
            type="button" onClick={() => setDialogo({ tipo: 'carpeta-nueva' })} disabled={!carpetaOk}
            aria-label={enCarpeta ? 'Nueva subcarpeta' : 'Nueva carpeta'} title={enCarpeta ? 'Nueva subcarpeta' : 'Nueva carpeta'}
            style={{ ...botonBlanco(true, !carpetaOk), ...(esAncha ? null : { width: 42, padding: 0 }) }}
          >
            <FolderPlus size={17} />{esAncha && <span>{enCarpeta ? 'Nueva subcarpeta' : 'Nueva carpeta'}</span>}
          </button>
          {enCarpeta ? (
            <button type="button" onClick={() => setAgregando(true)} style={botonPrincipal(false)}>
              <Plus size={17} /> Agregar
            </button>
          ) : (
            <button type="button" onClick={() => setCreando(true)} style={botonPrincipal(false)}>
              <Plus size={17} /> Crear
            </button>
          )}
        </div>
      )}

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
          seleccion={seleccionando ? seleccion : null} onAlternar={seleccionando ? alternar : null}
          derechaDeRuta={botonSeleccionar}
          vacio={vacio}
        />
      )}

      {seleccionando && cuantasMarcadas > 0 && (
        <BarraDeSeleccion onMover={() => setDialogo({ tipo: 'mover', cosas: marcadas, alTerminar: salirDeSeleccion })} onEliminar={eliminarMarcadas} />
      )}

      {(creando || agregando) && (
        <CentroDeCreacion
          carpetaTexto={nivel ? `«${textoDeRuta(carpetas, nivel)}»` : null}
          agregar={agregando}
          onTraer={agregando && hayQueTraer ? () => { setAgregando(false); setDialogo({ tipo: 'traer' }); } : undefined}
          onElegir={crear} onCerrar={() => { setCreando(false); setAgregando(false); }}
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
            ...(menu.item.carpetaId ? [{
              icon: FolderOutput, texto: `Sacar de «${nombreDeCarpeta(menu.item.carpetaId)}»`,
              onClick: () => moverA({ items: [menu.item], carpetas: [] }, carpetas.find((c) => c.id === menu.item.carpetaId)?.parent_id ?? null),
            }] : []),
            { icon: FolderInput, texto: 'Mover a…', onClick: () => setDialogo({ tipo: 'mover', cosas: { items: [menu.item], carpetas: [] } }) },
            { icon: Trash2, texto: 'Eliminar', onClick: () => eliminarItem(menu.item), peligro: true },
          ]}
        />
      )}
      {menu?.tipo === 'carpeta' && (
        <HojaAcciones
          onClose={() => setMenu(null)}
          acciones={[
            { icon: TextCursorInput, texto: 'Cambiar el nombre', onClick: () => setDialogo({ tipo: 'carpeta-renombrar', carpeta: menu.carpeta }) },
            ...(menu.carpeta.parent_id ? [{
              icon: FolderOutput, texto: `Sacar de «${nombreDeCarpeta(menu.carpeta.parent_id)}»`,
              onClick: () => moverA({ items: [], carpetas: [menu.carpeta] }, carpetas.find((c) => c.id === menu.carpeta.parent_id)?.parent_id ?? null),
            }] : []),
            { icon: FolderInput, texto: 'Mover a…', onClick: () => setDialogo({ tipo: 'mover', cosas: { items: [], carpetas: [menu.carpeta] } }) },
            { icon: Trash2, texto: 'Eliminar la carpeta', onClick: () => eliminarCarpeta(menu.carpeta), peligro: true },
          ]}
        />
      )}

      {dialogo?.tipo === 'carpeta-nueva' && (
        <DialogoGuardar
          titulo={enCarpeta ? `Nueva carpeta dentro de «${carpetaActual.nombre}»` : 'Nueva carpeta'}
          soloNombre textoBoton="Crear"
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
      {dialogo?.tipo === 'mover' && (
        <DestinoDeMover
          titulo={(() => {
            const { items: cosas, carpetas: cajas } = dialogo.cosas;
            const n = cosas.length + cajas.length;
            if (n > 1) return `Mover ${n} cosas`;
            return cajas.length ? `Mover la carpeta «${cajas[0].nombre}»` : `Mover «${cosas[0].nombre}»`;
          })()}
          cosas={dialogo.cosas} carpetas={carpetas} crearCarpeta={crearDesdeSelector}
          alElegir={(destino) => {
            const { cosas, alTerminar } = dialogo;
            setDialogo(null);
            alTerminar?.();
            moverA(cosas, destino);
          }}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'traer' && enCarpeta && (
        <TraerAqui
          carpetaId={nivel} carpetas={carpetas} items={items}
          alTraer={(cosas) => { setDialogo(null); moverA(cosas, nivel); }}
          onCerrar={() => setDialogo(null)}
        />
      )}
      {dialogo?.tipo === 'asignar' && <AsignarDialog item={dialogo.item} onCerrar={() => setDialogo(null)} />}
    </div>
  );
}
