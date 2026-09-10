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
import { Video, Trash2, Loader2, Scissors } from 'lucide-react';
import {
  listExerciseMedia, addExerciseMedia, deleteExerciseMedia, updateExerciseMedia, getMasterId,
} from '@/lib/api';
import EditorVideo from '@/features/admin/EditorVideo';
import { useAuth } from '@/contexts/AuthContext';
import MediaUpload from '@/features/admin/MediaUpload';
import { T } from '@/lib/theme';


function etiquetaGenero(g) {
  if (g === 'h') return 'Hombres';
  if (g === 'm') return 'Mujeres';
  return 'Para todos';
}

/** Un video de la lista: miniatura, qué es, y qué se le puede hacer. */
function FilaVideo({ url, titulo, detalle, destacado, onRecortar, onQuitar }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: destacado ? T.accentBg : T.bg,
      border: `1px solid ${destacado ? T.accent + '55' : T.border}`,
      borderRadius: 11, padding: 8,
    }}>
      {/* Miniatura del propio video, congelada en el primer fotograma. No se
          usa canvas: leer píxeles exigiría cabeceras de CORS que Cloudflare no
          manda en las lecturas. */}
      <span style={{
        width: 46, height: 46, borderRadius: 9, overflow: 'hidden', flexShrink: 0,
        background: '#0E1015', display: 'grid', placeItems: 'center',
      }}>
        <video
          src={url} muted playsInline preload="metadata" tabIndex={-1} aria-hidden="true"
          onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.1; }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: destacado ? T.accent : T.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {titulo}
        </div>
        {detalle && (
          <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 600 }}>{detalle}</div>
        )}
      </div>

      <button
        type="button" onClick={onRecortar} title="Recortar, encuadrar o silenciar"
        style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          color: T.text2, padding: 6, flexShrink: 0,
        }}
      >
        <Scissors size={15} />
      </button>
      <button
        type="button" onClick={onQuitar} title="Quitar este video"
        style={{
          border: 'none', background: 'transparent', cursor: 'pointer',
          color: T.danger, padding: 6, flexShrink: 0,
        }}
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

/** Resume en una línea qué se le hizo al video, o nada si está tal cual. */
function etiquetaAjustes(a) {
  if (!a) return null;
  const partes = [];
  if (a.recorte_inicio != null || a.recorte_fin != null) partes.push('recortado');
  if (a.encuadre) partes.push('encuadrado');
  if (a.sin_audio) partes.push('sin audio');
  return partes.length ? partes.join(' · ') : null;
}

/**
 * TODOS los videos del ejercicio, en UNA sola lista.
 *
 * POR QUÉ SE FUSIONÓ. Antes había dos bloques separados: arriba "Video
 * (archivo)" —el principal, que vive en la columna `video_url` del ejercicio— y
 * más abajo "Otros ángulos y versiones", que viven en la tabla `exercise_media`.
 * Andrés dijo que lo que no le cuadraba era justamente "que esté separada del
 * video principal", y tiene razón: para quien usa la app son todos videos del
 * mismo ejercicio, y que estén en dos sitios distintos es un detalle de cómo
 * está guardado, no algo que le importe a nadie.
 *
 * Siguen guardándose en dos sitios —cambiar eso sería una migración y los
 * planes ya existentes leen `video_url`— pero se ven y se manejan como una
 * lista. El primero es el que se abre por defecto; el resto son ángulos o
 * versiones.
 */
export default function VideosDelEjercicio({
  exerciseId, principal, recortePrincipal, onPrincipal, onRecortePrincipal,
}) {
  const { user } = useAuth();
  const [editando, setEditando] = useState(null); // qué video se está recortando
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

  /* Guarda el video que sale del editor. Llega todo junto —la dirección y los
     ajustes— porque el editor los resuelve de una vez.

     Si el ejercicio todavía no tiene video, este pasa a ser el principal: el
     que se abre por defecto. Los siguientes van como ángulos o versiones. Así
     no hay que explicarle a nadie la diferencia entre dos sitios de guardado
     que solo existe por dentro. */
  async function agregarVideo({ url: subida, inicio, fin, sinAudio, encuadre, genero, etiqueta }) {
    if (!subida) { setErr('No se pudo subir el video.'); return; }
    setErr('');

    if (!principal) {
      onPrincipal?.(subida);
      onRecortePrincipal?.({ inicio, fin, sinAudio, encuadre });
      return;
    }

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
        Guarda el ejercicio y podrás agregarle videos: otros ángulos, o una versión para hombres y otra para mujeres.
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>Videos del ejercicio</div>
        <div style={{ fontSize: 11.5, color: T.text3, marginTop: 3, fontWeight: 600, lineHeight: 1.45 }}>
          El primero es el que se abre. Agrega más para tener otros ángulos, o una versión para hombres y otra para mujeres.
        </div>
      </div>

      {cargando ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text3, fontSize: 12.5, fontWeight: 600 }}>
          <Loader2 size={14} className="spin" /> Cargando…
        </div>
      ) : (principal || lista.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {/* El principal encabeza la lista: es el que se abre por defecto. */}
          {principal && (
            <FilaVideo
              url={principal}
              titulo="Se abre por defecto"
              detalle={etiquetaAjustes(recortePrincipal)}
              destacado
              onRecortar={() => setEditando({ tipo: 'principal', url: principal, ajustes: recortePrincipal })}
              onQuitar={() => onPrincipal?.('')}
            />
          )}

          {lista.map((m) => (
            <FilaVideo
              key={m.id}
              url={m.url}
              titulo={m.etiqueta || 'Sin etiqueta'}
              detalle={etiquetaGenero(m.genero)}
              onRecortar={() => setEditando({ tipo: 'extra', url: m.url, id: m.id, ajustes: m })}
              onQuitar={() => quitar(m.id)}
            />
          ))}
        </div>
      )}

      {editando && (
        <EditorVideo
          url={editando.url}
          ajustes={editando.ajustes}
          onCancelar={() => setEditando(null)}
          onListo={async (ajustes) => {
            if (editando.tipo === 'principal') {
              onRecortePrincipal?.(ajustes);
            } else {
              try {
                await updateExerciseMedia(editando.id, {
                  recorte_inicio: ajustes.inicio ?? null,
                  recorte_fin: ajustes.fin ?? null,
                  sin_audio: !!ajustes.sinAudio,
                  encuadre: ajustes.encuadre ?? null,
                });
              } catch (e) { setErr(e.message || 'No se pudo guardar el recorte.'); }
            }
            setEditando(null);
          }}
        />
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
        onAjustes={agregarVideo}
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
