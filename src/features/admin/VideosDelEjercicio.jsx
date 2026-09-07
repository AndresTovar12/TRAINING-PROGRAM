/**
 * Los videos EXTRA de un ejercicio: otros ángulos y la versión por género.
 *
 * POR QUE HACE FALTA:
 * Un ejercicio tenía un solo video. Con eso no se puede grabar de frente y de
 * lado —un drill de campo se entiende mucho mejor desde dos ángulos— ni tener
 * la versión de hombre y la de mujer.
 *
 * COMO SE ELIGE CUAL VE EL ATLETA, y por qué el orden es ese:
 *   1. Un video puesto solo para él (se pone desde su plan, no aquí).
 *   2. La versión de su género.
 *   3. La versión para todos.
 * Si no puso género en su perfil, salta el paso 2. No se le adivina: enseñarle
 * la versión equivocada es peor que enseñarle la genérica.
 *
 * El video principal del ejercicio (el de arriba en esta misma pantalla) sigue
 * funcionando igual. Esto se suma; no lo reemplaza.
 */
import { useEffect, useState } from 'react';
import { Video, Trash2, Plus, Loader2, X } from 'lucide-react';
import { listExerciseMedia, addExerciseMedia, deleteExerciseMedia, getMasterId } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { ANGULOS_SUGERIDOS } from '@/lib/videos';
import MediaUpload from '@/features/admin/MediaUpload';
import RecortarVideo from '@/features/admin/RecortarVideo';
import { T, FONT } from '@/lib/theme';

const GENEROS = [
  { valor: '', texto: 'Para todos' },
  { valor: 'h', texto: 'Hombres' },
  { valor: 'm', texto: 'Mujeres' },
];

function etiquetaGenero(g) {
  if (g === 'h') return 'Hombres';
  if (g === 'm') return 'Mujeres';
  return 'Para todos';
}

export default function VideosDelEjercicio({ exerciseId }) {
  const { user } = useAuth();
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [agregando, setAgregando] = useState(false);
  const [url, setUrl] = useState('');
  const [etiqueta, setEtiqueta] = useState('');
  const [genero, setGenero] = useState('');
  const [recorte, setRecorte] = useState({ inicio: null, fin: null });
  const [guardando, setGuardando] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    let vivo = true;
    if (!exerciseId) { setCargando(false); return undefined; }
    // Se muestran solo los MIOS y los del master. Un ejercicio base lo comparten
    // todos los coaches: sin este filtro, aquí aparecerían los ángulos que subió
    // otro entrenador —que además no se pueden borrar, así que el botón daría
    // error sin explicación.
    Promise.all([listExerciseMedia([exerciseId]), getMasterId()])
      .then(([r, mId]) => {
        if (!vivo) return;
        setLista(r.filter((m) => !m.para_atleta
          && (m.created_by === user?.id || m.created_by === mId)));
      })
      .catch(() => {})
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [exerciseId, user?.id]);

  async function guardar() {
    if (!url) { setErr('Primero sube el video.'); return; }
    setGuardando(true); setErr('');
    try {
      const fila = await addExerciseMedia({
        exerciseId, url, tipo: 'video',
        etiqueta: etiqueta.trim() || null,
        genero: genero || null,
        inicio: recorte.inicio,
        fin: recorte.fin,
      });
      setLista((prev) => [...prev, fila]);
      setUrl(''); setEtiqueta(''); setGenero('');
      setRecorte({ inicio: null, fin: null });
      setAgregando(false);
    } catch (e) {
      setErr(e.message || 'No se pudo guardar el video.');
    } finally {
      setGuardando(false);
    }
  }

  async function quitar(id) {
    const antes = lista;
    setLista((prev) => prev.filter((m) => m.id !== id));
    try {
      await deleteExerciseMedia(id);
    } catch {
      setLista(antes); // no se borró: se devuelve a como estaba
    }
  }

  // Un ejercicio que todavía no existe no puede tener videos colgados: primero
  // hay que guardarlo para que tenga id.
  if (!exerciseId) {
    return (
      <div style={{ fontSize: 12.5, color: T.text3, fontWeight: 600, lineHeight: 1.5 }}>
        Guarda el ejercicio y podrás agregarle más ángulos y versiones por género.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>Otros ángulos y versiones</div>
        <div style={{ fontSize: 11.5, color: T.text3, marginTop: 3, fontWeight: 600, lineHeight: 1.45 }}>
          Grábalo de frente y de lado, o sube una versión para hombres y otra para mujeres.
        </div>
      </div>

      {cargando ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text3, fontSize: 12.5, fontWeight: 600 }}>
          <Loader2 size={14} className="spin" /> Cargando…
        </div>
      ) : lista.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {lista.map((m) => (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, background: T.bg,
              border: `1px solid ${T.border}`, borderRadius: 11, padding: '9px 11px',
            }}>
              <Video size={15} color={T.accent} style={{ flexShrink: 0 }} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: T.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {m.etiqueta || 'Sin etiqueta'}
                </div>
                <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 600 }}>{etiquetaGenero(m.genero)}</div>
              </div>
              {(
                <button
                  type="button" onClick={() => quitar(m.id)} title="Quitar este video"
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.danger, padding: 4, flexShrink: 0 }}
                >
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {!agregando && (
        <button
          type="button" onClick={() => setAgregando(true)}
          style={{
            alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '9px 14px', borderRadius: 11, border: `1.5px dashed ${T.border}`,
            background: 'transparent', cursor: 'pointer', fontFamily: FONT,
            fontSize: 13, fontWeight: 700, color: T.text2,
          }}
        >
          <Plus size={15} /> Agregar otro video
        </button>
      )}

      {agregando && (
        <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 13, padding: 13, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>Video nuevo</span>
            <button type="button" onClick={() => { setAgregando(false); setErr(''); }}
              style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: T.text3, padding: 2 }}>
              <X size={17} />
            </button>
          </div>

          <MediaUpload
            label="Archivo" icon={Video} value={url} onChange={setUrl}
            accept="video/*" kind="videos"
            hint="Desde el teléfono puedes grabarlo aquí mismo."
          />

          {url && (
            <RecortarVideo
              url={url}
              inicio={recorte.inicio}
              fin={recorte.fin}
              onCambio={setRecorte}
            />
          )}

          <label style={{ display: 'block' }}>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text2, marginBottom: 6 }}>¿Desde dónde está grabado?</div>
            <input
              value={etiqueta}
              onChange={(e) => setEtiqueta(e.target.value)}
              placeholder="Frontal, Lateral, Desde atrás…"
              list="angulos-sugeridos"
              style={{
                width: '100%', boxSizing: 'border-box', border: `1.5px solid ${T.border}`,
                borderRadius: 11, padding: '11px 13px', fontFamily: FONT, fontSize: 16,
                fontWeight: 600, color: T.text, background: T.bg2, outline: 'none',
              }}
            />
            <datalist id="angulos-sugeridos">
              {ANGULOS_SUGERIDOS.map((a) => <option key={a} value={a} />)}
            </datalist>
          </label>

          <div>
            <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text2, marginBottom: 6 }}>¿Para quién es?</div>
            <div style={{ display: 'flex', gap: 7 }}>
              {GENEROS.map((g) => (
                <button
                  key={g.valor} type="button" onClick={() => setGenero(g.valor)}
                  style={{
                    flex: 1, padding: '10px 8px', borderRadius: 11, cursor: 'pointer',
                    border: `1.5px solid ${genero === g.valor ? T.accent : T.border}`,
                    background: genero === g.valor ? T.accentBg : T.bg2,
                    color: genero === g.valor ? T.accent : T.text2,
                    fontFamily: FONT, fontSize: 12.5, fontWeight: 700,
                  }}
                >
                  {g.texto}
                </button>
              ))}
            </div>
          </div>

          {err && (
            <div style={{ background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 11, padding: '10px 12px', fontSize: 12.5, fontWeight: 700 }}>
              {err}
            </div>
          )}

          <button
            type="button" onClick={guardar} disabled={!url || guardando}
            style={{
              padding: '12px 16px', borderRadius: 12, border: 'none',
              background: url && !guardando ? T.accent : T.bg3,
              color: url && !guardando ? '#fff' : T.text3,
              cursor: url && !guardando ? 'pointer' : 'default',
              fontFamily: FONT, fontSize: 14, fontWeight: 800,
              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7,
            }}
          >
            {guardando ? <><Loader2 size={15} className="spin" /> Guardando…</> : 'Guardar video'}
          </button>
        </div>
      )}
    </div>
  );
}
