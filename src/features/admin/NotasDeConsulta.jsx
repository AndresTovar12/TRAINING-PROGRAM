import { useEffect, useState } from 'react';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { T, FONT } from '@/lib/theme';
import { useConfirmacion } from '@/components/Confirmacion';
import { listNotasConsulta, crearNotaConsulta, editarNotaConsulta, borrarNotaConsulta } from '@/lib/api';

/* Notas de consulta: lo que el fisio anota de cada paciente. Solo las ve él
   (ver la migración `fisio_etapa_1`): ni el paciente, ni el coach, ni el
   master. Van con fecha, la más nueva arriba. */

const hoyLocal = () => {
  const d = new Date();
  const dos = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${dos(d.getMonth() + 1)}-${dos(d.getDate())}`;
};

// La fecha se guarda como AAAA-MM-DD; a mediodía para que ninguna zona horaria
// la corra de día. El año solo sale si no es el de hoy: «29 sep» y «12 mar 2025».
const cortaLa = (f) => {
  const d = new Date(`${f}T12:00:00`);
  const otroAnio = d.getFullYear() !== new Date().getFullYear();
  return d.toLocaleDateString('es-MX', { day: 'numeric', month: 'short', ...(otroAnio ? { year: 'numeric' } : {}) });
};

const masNuevaPrimero = (a, b) => {
  if (a.fecha !== b.fecha) return a.fecha < b.fecha ? 1 : -1;
  return a.creada_en < b.creada_en ? 1 : -1;
};

export default function NotasDeConsulta({ atleta, Seccion, abierta, onToggle }) {
  const pregunta = useConfirmacion();
  const [notas, setNotas] = useState(null); // null = cargando
  const [error, setError] = useState('');
  const [redactando, setRedactando] = useState(null); // { id?, fecha, texto } | null
  const [guardando, setGuardando] = useState(false);

  // Se piden al abrir la sección, no antes: la mayoría de las veces no se abre.
  useEffect(() => {
    if (!abierta || notas !== null) return undefined;
    let cancelado = false;
    listNotasConsulta(atleta.id)
      .then((n) => { if (!cancelado) setNotas(n); })
      .catch((e) => { if (!cancelado) { setNotas([]); setError(e.message); } });
    return () => { cancelado = true; };
  }, [abierta, notas, atleta.id]);

  async function guardar() {
    if (!redactando?.texto.trim()) return;
    setGuardando(true);
    setError('');
    try {
      const fila = redactando.id
        ? await editarNotaConsulta(redactando.id, redactando)
        : await crearNotaConsulta({ atletaId: atleta.id, ...redactando });
      setNotas((prev) => [fila, ...(prev ?? []).filter((n) => n.id !== fila.id)].sort(masNuevaPrimero));
      setRedactando(null);
    } catch (e) {
      setError(e.message || 'No se pudo guardar la nota.');
    } finally {
      setGuardando(false);
    }
  }

  async function borrar(n) {
    const va = await pregunta({
      titulo: '¿Borrar esta nota?',
      detalle: 'Solo tú la ves. No se puede deshacer.',
      confirmar: 'Sí, borrarla',
      peligro: true,
    });
    if (!va) return;
    try {
      await borrarNotaConsulta(n.id);
      setNotas((prev) => prev.filter((x) => x.id !== n.id));
    } catch (e) {
      setError(e.message || 'No se pudo borrar.');
    }
  }

  return (
    <Seccion titulo="Notas de consulta · solo tú" abierta={abierta} onToggle={onToggle}>
      {/* Botón blanco, borde azul sólido: el estilo de «agregar» de la app. */}
      {!redactando && (
        <button
          type="button"
          onClick={() => setRedactando({ fecha: hoyLocal(), texto: '' })}
          className="kp-press"
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 8, padding: '10px 15px', borderRadius: 12,
            border: `1.5px solid ${T.accent}`, background: T.bg2, color: T.accent, cursor: 'pointer',
            fontFamily: FONT, fontSize: 13.5, fontWeight: 800, marginBottom: 12,
          }}
        >
          <Plus size={16} /> Nueva nota
        </button>
      )}

      {redactando && (
        <div style={{ background: T.bg, borderRadius: 12, padding: 12, marginBottom: 12 }}>
          <input
            type="date"
            aria-label="Fecha de la consulta"
            value={redactando.fecha}
            onChange={(e) => setRedactando({ ...redactando, fecha: e.target.value })}
            style={{ border: `1.5px solid ${T.border}`, borderRadius: 10, padding: '8px 10px', fontFamily: FONT, fontSize: 16, marginBottom: 8, background: T.bg2 }}
          />
          <textarea
            aria-label="Nota de consulta"
            value={redactando.texto}
            onChange={(e) => setRedactando({ ...redactando, texto: e.target.value })}
            placeholder="Lo que quieras recordar de esta consulta…"
            rows={4}
            maxLength={5000}
            autoFocus
            style={{ width: '100%', boxSizing: 'border-box', border: `1.5px solid ${T.border}`, borderRadius: 10, padding: 10, fontFamily: FONT, fontSize: 16, background: T.bg2, resize: 'vertical' }}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button
              type="button"
              onClick={guardar}
              disabled={guardando || !redactando.texto.trim()}
              style={{
                flex: 1, minHeight: 42, borderRadius: 11, border: 'none', cursor: 'pointer', color: '#fff',
                background: T.accent, fontFamily: FONT, fontSize: 14, fontWeight: 800,
                opacity: guardando || !redactando.texto.trim() ? 0.55 : 1,
              }}
            >
              {guardando ? 'Guardando…' : 'Guardar nota'}
            </button>
            <button
              type="button"
              onClick={() => { setRedactando(null); setError(''); }}
              style={{ minHeight: 42, padding: '0 14px', borderRadius: 11, border: `1.5px solid ${T.border}`, background: T.bg2, color: T.text2, cursor: 'pointer', fontFamily: FONT, fontSize: 14, fontWeight: 700 }}
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {error && <div role="alert" style={{ color: T.danger, fontSize: 13, fontWeight: 600, marginBottom: 8 }}>{error}</div>}

      {notas === null ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: T.text2, fontWeight: 600 }}>
          <Loader2 size={15} className="spin" /> Cargando…
        </div>
      ) : (
        notas.map((n) => (
          <div key={n.id} style={{ borderTop: `1px solid ${T.border}`, padding: '10px 0', display: 'flex', gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 800, color: T.text2 }}>
                {cortaLa(n.fecha)}{n.editada_en ? ' · editada' : ''}
              </div>
              <div style={{ fontSize: 14, color: T.text, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{n.texto}</div>
            </div>
            <button type="button" aria-label="Editar nota" onClick={() => setRedactando({ id: n.id, fecha: n.fecha, texto: n.texto })} style={{ border: 'none', background: 'transparent', color: T.text3, cursor: 'pointer', padding: 4 }}>
              <Pencil size={15} />
            </button>
            <button type="button" aria-label="Borrar nota" onClick={() => borrar(n)} style={{ border: 'none', background: 'transparent', color: T.text3, cursor: 'pointer', padding: 4 }}>
              <Trash2 size={15} />
            </button>
          </div>
        ))
      )}
    </Seccion>
  );
}
