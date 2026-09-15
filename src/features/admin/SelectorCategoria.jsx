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
 * QUÉ VE CADA QUIÉN lo decide la base (reglas de acceso), no esta pantalla:
 * las de siempre, las del master y las propias. Aquí además se esconden las de
 * otros coaches que el master sí puede leer, para que su lista no se llene con
 * las de todos.
 */
import { useState } from 'react';
import { Plus, Loader2, X } from 'lucide-react';
import { createCategory } from '@/lib/api';
import { T, FONT } from '@/lib/theme';

const NUEVA = '__nueva__';

// "Velocidad", "velocidad" y "Velocidád" son la misma categoría para una persona.
const igual = (a = '', b = '') => a.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
  === b.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

export default function SelectorCategoria({
  categorias = [], value, onChange, onCreada,
  duenoId, masterId, sinCategoria = false, puedeCrear = true, estilo,
}) {
  const [creando, setCreando] = useState(false);
  const [nombre, setNombre] = useState('');
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');

  const mias = categorias.filter((c) => c.created_by && c.created_by === duenoId);
  const deLaApp = categorias.filter((c) => !c.created_by || (c.created_by === masterId && c.created_by !== duenoId));

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
      <select
        value={creando ? NUEVA : (value || '')}
        onChange={(e) => {
          if (e.target.value === NUEVA) { setCreando(true); setErr(''); return; }
          setCreando(false);
          onChange(e.target.value);
        }}
        style={{ ...campo, cursor: 'pointer' }}
      >
        {sinCategoria && <option value="">Sin categoría</option>}
        {/* Agrupadas: se ve de un vistazo cuáles son de la app y cuáles hizo uno. */}
        <optgroup label="De la app">
          {deLaApp.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </optgroup>
        {mias.length > 0 && (
          <optgroup label="Tuyas">
            {mias.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </optgroup>
        )}
        {puedeCrear && <option value={NUEVA}>+ Crear categoría nueva…</option>}
      </select>

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
