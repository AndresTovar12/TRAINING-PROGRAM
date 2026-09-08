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
import { Video, Trash2, Loader2 } from 'lucide-react';
import { listExerciseMedia, addExerciseMedia, deleteExerciseMedia, getMasterId } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import MediaUpload from '@/features/admin/MediaUpload';
import { T } from '@/lib/theme';


function etiquetaGenero(g) {
  if (g === 'h') return 'Hombres';
  if (g === 'm') return 'Mujeres';
  return 'Para todos';
}

export default function VideosDelEjercicio({ exerciseId }) {
  const { user } = useAuth();
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
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

  /* Guarda el video con todo lo que se decidió en el editor. Llega junto —la
     dirección y los ajustes— porque el editor los resuelve de una sola vez. */
  async function guardar({ url: subida, inicio, fin, sinAudio, encuadre, genero, etiqueta }) {
    if (!subida) { setErr('No se pudo subir el video.'); return; }
    setErr('');
    try {
      const fila = await addExerciseMedia({
        exerciseId, url: subida, tipo: 'video',
        etiqueta: (etiqueta || '').trim() || null,
        genero: genero || null,
        inicio, fin, sinAudio, encuadre,
      });
      setLista((prev) => [...prev, fila]);
    } catch (e) {
      setErr(e.message || 'No se pudo guardar el video.');
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

      {/* Ya no hay formulario de "Video nuevo".
          Antes, después de subir, había que contestar abajo "¿quién debe ver
          este video?" y "¿desde dónde está grabado?". Andrés: "no me hace
          sentido que esté como última opción hasta abajo, debería ser parte
          integrada del proceso". Tenía razón: son decisiones sobre ESE video y
          se toman mirándolo, no en un formulario aparte cuando ya se subió.

          Ahora las dos preguntas viven dentro del editor, junto al recorte, el
          encuadre y el audio. Se elige el archivo, se decide todo con el video
          delante, y al confirmar se sube y se guarda de una vez. */}
      <MediaUpload
        label=""
        icon={Video}
        value=""
        onChange={() => {}}
        onAjustes={guardar}
        conDestino
        accept="video/*"
        kind="videos"
        hint="Se abre el editor: recortas, encuadras, quitas el audio y eliges para quién es."
      />

      {err && (
        <div style={{
          background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 11,
          padding: '10px 12px', fontSize: 12.5, fontWeight: 700,
        }}>
          {err}
        </div>
      )}

    </div>
  );
}
