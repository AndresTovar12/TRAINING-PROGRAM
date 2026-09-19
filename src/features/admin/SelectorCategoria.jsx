/**
 * El selector de categoría de un ejercicio, con la opción de crear una propia.
 *
 * POR QUÉ EXISTE. Solo había 4 categorías fijas: Hipertrofia, Atlético /
 * Fuerza, Potencia y Pliometría. Un coach que quería meter "Sprint 30 yd" o un
 * drill de cancha tenía que forzarlo en una que no era. Andrés: "tenemos pocas
 * opciones de tipos de ejercicio para los coaches, tenemos que quitar esta
 * limitante y que los coaches puedan crear sus propias categorías… no te digo
 * que quitemos las que hay, esas sí dejémoslas".
 *
 * POR QUÉ UN SOLO COMPONENTE. La categoría se elige en dos sitios: el editor
 * del repertorio y el "Ejercicio nuevo" del editor de planes. Con dos copias,
 * el arreglo llegaría a una sola — ya pasó con el botón de subir archivos.
 *
 * A LA VISTA, NO DENTRO DE LA LISTA. Al principio "+ Crear categoría nueva…" era
 * la última opción del desplegable. En el iPhone el desplegable es una rueda:
 * hay que abrirla y bajar hasta el final para descubrir que existe. Andrés no
 * la encontró y creyó que se había quitado. Ahora es un botón debajo.
 *
 * QUÉ VE CADA QUIÉN lo decide la base (reglas de acceso), no esta pantalla:
 * las de siempre, las del master y las propias. Aquí además se esconden las de
 * otros coaches que el master sí puede leer, para que su lista no se llene con
 * las de todos.
 */
import { useState } from 'react';
import { Plus, Loader2, X } from 'lucide-react';
import { contarEjerciciosDeCategoria, createCategory, deleteCategory } from '@/lib/api';
import { useConfirmacion } from '@/components/Confirmacion';
import ListaDesplegable from '@/components/ListaDesplegable';
import { plural } from '@/lib/plural';
import { T, FONT } from '@/lib/theme';

// "Velocidad", "velocidad" y "Velocidád" son la misma categoría para una persona.
const igual = (a = '', b = '') => a.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
  === b.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export default function SelectorCategoria({
  categorias = [], value, onChange, onCreada, onBorrada,
  duenoId, masterId, sinCategoria = false, puedeCrear = true, estilo,
}) {
  const pregunta = useConfirmacion();
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');

  const mias = categorias.filter((c) => c.created_by && c.created_by === duenoId);
  const deLaApp = categorias.filter((c) => !c.created_by || (c.created_by === masterId && c.created_by !== duenoId));

  /* BORRAR UNA CATEGORÍA PROPIA.
     Andrés, 19 sep 2026: "¿qué pasa si creo una categoría sin querer y la
     quiero borrar? Creo que no se puede". No se podía, y no era la base: la
     regla de acceso lo permitía desde siempre. Faltaba el botón.

     Solo las TUYAS: las de la app no llevan bote de basura. Y antes de
     preguntar se cuenta cuántos ejercicios se quedarían sin categoría, porque
     un "¿seguro?" que no dice qué se lleva por delante no sirve de nada. */
  async function borrar(cat) {
    let cuantos = 0;
    try { cuantos = await contarEjerciciosDeCategoria(cat.id); } catch { /* se pregunta igual */ }
    const va = await pregunta({
      titulo: `¿Borrar la categoría «${cat.name}»?`,
      detalle: cuantos
        ? `${plural(cuantos, 'ejercicio se queda', 'ejercicios se quedan')} sin categoría. No se borra ninguno.`
        : 'No la está usando ningún ejercicio.',
      confirmar: 'Sí, borrarla',
      peligro: true,
    });
    if (!va) return;
    try {
      await deleteCategory(cat.id);
      // Si era la que estaba puesta, el campo se queda sin nada en vez de
      // apuntando a algo que ya no existe.
      if (value === cat.id) onChange('');
      onBorrada?.(cat.id);
    } catch (e) {
      setErr(e.message || 'No se pudo borrar la categoría.');
    }
  }

  async function crear() {
    const n = nombre.trim();
    if (!n) { setErr('Ponle un nombre.'); return; }
    if ([...mias, ...deLaApp].some((c) => igual(c.name, n))) {
      setErr('Ya existe una categoría con ese nombre.');
      return;
    }
    setGuardando(true);
    setErr('');
    try {
      const fila = await createCategory({ name: n, createdBy: duenoId, cuantas: mias.length });
      onCreada?.(fila);
      onChange(fila.id);
      setCreando(false);
      setNombre('');
    } catch (e) {
      setErr(e.message || 'No se pudo crear la categoría.');
    } finally {
      setGuardando(false);
    }
  }

  const campo = {
    border: `1.5px solid ${T.border}`, borderRadius: 11, padding: '11px 13px', width: '100%',
    fontFamily: FONT, fontSize: 15, fontWeight: 600, color: T.text, background: T.bg2,
    outline: 'none', boxSizing: 'border-box', ...estilo,
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {/* Agrupadas: se ve de un vistazo cuáles son de la app y cuáles hizo uno.
          Las tuyas llevan bote de basura; las de la app no. */}
      <ListaDesplegable
        etiqueta="Categoría"
        valor={value || ''}
        onCambio={onChange}
        marcador={sinCategoria ? 'Sin categoría' : 'Selecciona…'}
        estilo={estilo}
        grupos={[
          ...(sinCategoria ? [{ titulo: '', opciones: [{ valor: '', etiqueta: 'Sin categoría' }] }] : []),
          { titulo: 'TUYAS', opciones: mias.map((c) => ({
            valor: c.id, etiqueta: c.name, color: c.color, alBorrar: () => borrar(c),
          })) },
          { titulo: 'DE LA APP', opciones: deLaApp.map((c) => ({
            valor: c.id, etiqueta: c.name, color: c.color,
          })) },
        ]}
      />

      {!creando && puedeCrear && (
        <button
          type="button"
          onClick={() => { setCreando(true); setErr(''); }}
          style={{
            alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 6,
            minHeight: 36, padding: '0 2px', border: 'none', background: 'transparent', cursor: 'pointer',
            fontFamily: FONT, fontSize: 14, fontWeight: 800, color: T.accent,
          }}
        >
          <Plus size={16} /> Crear categoría nueva
        </button>
      )}
      {!puedeCrear && (
        /* Viendo como otro coach: la categoría quedaría a nombre de quien está
           mirando, no del coach. Se dice por qué no está el botón. */
        <div style={{ fontSize: 12.5, color: T.text3, fontWeight: 600, lineHeight: 1.4 }}>
          Para crear categorías, sal de «Ver como».
        </div>
      )}

      {creando && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 8, padding: 10,
          border: `1px solid ${T.border}`, borderRadius: 12, background: T.bg,
        }}>
          <input
            value={nombre}
            onChange={(e) => { setNombre(e.target.value); setErr(''); }}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); crear(); } }}
            placeholder="Ej. Velocidad, Movilidad, Drills de cancha…"
            autoFocus
            maxLength={40}
            // 16 px: por debajo, el iPhone acerca la pantalla al escribir.
            style={{ ...campo, fontSize: 16 }}
          />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button" onClick={crear} disabled={guardando}
              style={{
                flex: 1, minHeight: 42, borderRadius: 11, border: 'none',
                background: T.accent, color: '#fff', cursor: guardando ? 'default' : 'pointer',
                fontFamily: FONT, fontSize: 14, fontWeight: 800,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}
            >
              {guardando ? <Loader2 size={15} className="spin" /> : <Plus size={15} />} Crear
            </button>
            <button
              type="button" onClick={() => { setCreando(false); setNombre(''); setErr(''); }}
              style={{
                minHeight: 42, padding: '0 14px', borderRadius: 11, border: `1.5px solid ${T.border}`,
                background: T.bg2, color: T.text2, cursor: 'pointer',
                fontFamily: FONT, fontSize: 14, fontWeight: 700,
                display: 'inline-flex', alignItems: 'center', gap: 5,
              }}
            >
              <X size={14} /> Cancelar
            </button>
          </div>
          {err && <div style={{ fontSize: 12.5, fontWeight: 700, color: T.danger }}>{err}</div>}
        </div>
      )}
    </div>
  );
}
