import { useState } from 'react';
import { ArrowDown, ArrowUp, ChevronDown, ChevronUp, Plus, Trash2 } from 'lucide-react';
import { LT, FONT } from '@/lib/theme';

/**
 * Los recuadros de «Ciencia» de un plan, escritos por quien lo arma (Andrés, 7 oct 2026: «lo que dice en Ciencia es
 * únicamente para mi plan: cada plan debe traer la suya»; y «no quiero que sea muy relevante en el editor»: por eso
 * vive en una ventana aparte, detrás de «Más ▾», y no en la pantalla del plan).
 *
 * Un recuadro es un título y un texto. Cada uno va en «Todo el plan» o en una fase (el atleta los lee en la tarjeta
 * «Ciencia» de Home, agrupados así). Los recuadros salen CERRADOS —solo el título— para que una lista larga no
 * se coma la pantalla; el recién agregado sale abierto.
 *
 * El texto lleva un formato mínimo (ver `lib/ciencia.js`): una línea en blanco separa párrafos, «- » hace viñetas,
 * «## » un subtítulo y «nombre | valor | nota» una fila de tabla. Se dice en el propio campo vacío y desaparece al escribir.
 *
 * `grupos`: [{ clave: 'plan' | idDeFase, nombre: string | null, recuadros: [{ id, titulo, texto }] }]
 * `fases`: las fases a las que se puede agregar un recuadro nuevo (solo en un programa por fases), o null.
 * Los avisos reciben la `clave` del grupo; `onAgregar` devuelve el id del recuadro nuevo.
 */
const AYUDA = 'Escribe el texto.\nUna línea en blanco separa párrafos.\n- Una viñeta\n## Un subtítulo\nNombre | valor | nota   (una fila de tabla)';

// Los iconos son grises; el de quitar se pone rojo solo al pasar el mouse (como en el resto del editor).
const ESTILOS = `
.ci-ic:hover:not(:disabled){background:${LT.surface2}}
.ci-ic.ci-borra:hover:not(:disabled){background:rgba(220,38,38,0.08);color:${LT.danger} !important}
`;

const rotulo = {
  fontSize: 11, fontWeight: 800, color: LT.text3, textTransform: 'uppercase', letterSpacing: 0.9, margin: '0 2px 8px',
};
const campo = {
  width: '100%', boxSizing: 'border-box', border: `1.5px solid ${LT.border}`, borderRadius: 11, background: LT.surface,
  fontFamily: FONT, color: LT.text, outline: 'none',
};

function BotonIcono({ icono: Icono, etiqueta, onClick, desactivado = false, peligro = false }) {
  return (
    <button
      type="button" className={`ci-ic${peligro ? ' ci-borra' : ''}`} onClick={onClick} disabled={desactivado}
      aria-label={etiqueta} title={etiqueta}
      style={{
        width: 32, height: 32, borderRadius: 999, border: 'none', background: 'transparent', flexShrink: 0, padding: 0,
        display: 'grid', placeItems: 'center', cursor: desactivado ? 'default' : 'pointer', touchAction: 'manipulation',
        color: desactivado ? LT.borderHi : LT.text3,
      }}
    >
      <Icono size={16} />
    </button>
  );
}

function Tarjeta({ r, i, total, abierto, onAbrir, onCambiar, onMover, onQuitar }) {
  return (
    <div style={{ background: LT.surface, border: `1px solid ${LT.border}`, borderRadius: 14, overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 2, padding: '2px 6px 2px 4px' }}>
        <button
          type="button" onClick={onAbrir} aria-expanded={abierto}
          style={{
            flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8, padding: '10px 8px', border: 'none',
            background: 'transparent', cursor: 'pointer', fontFamily: FONT, textAlign: 'left',
          }}
        >
          {abierto ? <ChevronUp size={16} color={LT.text3} style={{ flexShrink: 0 }} /> : <ChevronDown size={16} color={LT.text3} style={{ flexShrink: 0 }} />}
          <span style={{
            flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: r.titulo.trim() ? LT.text : LT.text3,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {r.titulo.trim() || 'Sin título'}
          </span>
        </button>
        <BotonIcono icono={ArrowUp} etiqueta="Subir" desactivado={i === 0} onClick={() => onMover(-1)} />
        <BotonIcono icono={ArrowDown} etiqueta="Bajar" desactivado={i === total - 1} onClick={() => onMover(1)} />
        <BotonIcono icono={Trash2} etiqueta="Quitar el recuadro" peligro onClick={onQuitar} />
      </div>
      {abierto && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: '0 12px 12px' }}>
          <input
            value={r.titulo} onChange={(e) => onCambiar({ titulo: e.target.value })} placeholder="Título del recuadro"
            aria-label="Título del recuadro" maxLength={120}
            style={{ ...campo, padding: '10px 12px', fontSize: 14, fontWeight: 700 }}
          />
          <textarea
            value={r.texto} onChange={(e) => onCambiar({ texto: e.target.value })} placeholder={AYUDA} aria-label="Texto del recuadro"
            rows={9} maxLength={8000}
            style={{ ...campo, padding: '10px 12px', fontSize: 14, lineHeight: 1.55, resize: 'vertical', minHeight: 140 }}
          />
        </div>
      )}
    </div>
  );
}

export default function EditorDeCiencia({ grupos, fases, onAgregar, onCambiar, onMover, onQuitar }) {
  // Los recuadros abiertos, por id. Los que ya estaban salen cerrados; el que se agrega, abierto.
  const [abiertos, setAbiertos] = useState({});
  const alternar = (id) => setAbiertos((a) => ({ ...a, [id]: !a[id] }));
  const agrega = (clave) => {
    const id = onAgregar(clave);
    if (id) setAbiertos((a) => ({ ...a, [id]: true }));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20, fontFamily: FONT }}>
      <style>{ESTILOS}</style>
      {grupos.map((g) => (
        <section key={g.clave}>
          {g.nombre && <div style={rotulo}>{g.nombre}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {g.recuadros.map((r, i) => (
              <Tarjeta
                key={r.id} r={r} i={i} total={g.recuadros.length} abierto={!!abiertos[r.id]}
                onAbrir={() => alternar(r.id)}
                onCambiar={(patch) => onCambiar(g.clave, r.id, patch)}
                onMover={(delta) => onMover(g.clave, r.id, delta)}
                onQuitar={() => onQuitar(g.clave, r.id)}
              />
            ))}
            <button
              type="button" onClick={() => agrega(g.clave)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, width: '100%', padding: '11px 13px',
                borderRadius: 13, cursor: 'pointer', fontFamily: FONT, border: `1.5px solid ${LT.border}`, background: LT.surface,
                fontSize: 13.5, fontWeight: 800, color: LT.blue, touchAction: 'manipulation',
              }}
            >
              <Plus size={16} /> Agregar recuadro
            </button>
          </div>
        </section>
      ))}

      {fases && fases.length > 0 && (
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={rotulo}>En una fase</span>
          <select
            value="" onChange={(e) => { if (e.target.value) agrega(e.target.value); }} aria-label="Agregar un recuadro a una fase"
            style={{ ...campo, padding: '11px 12px', fontSize: 14, fontWeight: 700, cursor: 'pointer' }}
          >
            <option value="">Agregar a una fase…</option>
            {fases.map((f) => <option key={f.id} value={f.id}>{f.name || 'Fase'}</option>)}
          </select>
        </label>
      )}
    </div>
  );
}
