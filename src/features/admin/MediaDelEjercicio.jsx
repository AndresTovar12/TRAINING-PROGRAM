/**
 * TODAS las fotos y videos de un ejercicio, en UNA lista.
 *
 * POR QUE UNA SOLA LISTA:
 * Antes había tres sitios. Arriba "Foto de portada". Debajo el video principal.
 * Más abajo "otros ángulos y versiones". Para quien usa la app son todos
 * imágenes del mismo ejercicio; que unas vivan en una columna de `exercises` y
 * otras en la tabla `exercise_media` es un detalle de cómo está guardado, no
 * algo que le importe a nadie. Andrés ya lo dijo del video principal: lo que no
 * le cuadraba era "que esté separada". Vale igual para la foto.
 *
 * POR QUE AHORA SIEMPRE PREGUNTA PARA QUIÉN ES:
 * La pregunta existía, pero solo aparecía a partir del SEGUNDO video. La foto
 * no la tenía nunca. Como casi todos los ejercicios tienen un video y ninguna
 * versión extra, en la práctica no salía jamás — Andrés: "no veo lo de hombre,
 * mujer, ni lo de agregar otro ángulo, en ninguna parte". No estaba escondida
 * por diseño: estaba detrás de un camino al que casi nunca se llega.
 *
 * Ahora sale desde la primera, ya contestada con "Para todos". Se ve que la
 * opción existe y no cuesta ni un toque de más si no se usa.
 *
 * DONDE SE GUARDA CADA COSA, y por qué no es arbitrario:
 *   · "Para todos" y sin etiqueta → a la columna de siempre (`cover_image_url`
 *     o `video_url`), si esa columna está libre. Es lo que ya leen los ochenta
 *     y un ejercicios y los planes que hay hechos; cambiarlo obligaría a migrar
 *     sin ganar nada.
 *   · Con género o con etiqueta → a `exercise_media`, que es la única tabla que
 *     tiene esos dos campos. Preguntar algo y no poder guardarlo sería peor que
 *     no preguntarlo.
 *
 * CUAL VE CADA ATLETA: lo decide `lib/videos.js`, no esta pantalla. El orden es
 * suyo primero, luego el de su género, luego el general.
 */
import { useEffect, useState } from 'react';
import {
  Video, Image as ImageIcon, Trash2, Loader2, Scissors, Users,
} from 'lucide-react';
import {
  listExerciseMedia, addExerciseMedia, deleteExerciseMedia, updateExerciseMedia, getMasterId,
} from '@/lib/api';
import EditorVideo from '@/features/admin/EditorVideo';
import EditorFoto from '@/features/admin/EditorFoto';
import { useAuth } from '@/contexts/AuthContext';
import MediaUpload from '@/features/admin/MediaUpload';
import { T } from '@/lib/theme';

function etiquetaGenero(g) {
  if (g === 'h') return 'Hombres';
  if (g === 'm') return 'Mujeres';
  return 'Para todos';
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

/** Una fila: miniatura, qué es, para quién es, y qué se le puede hacer. */
function Fila({ url, esVideo, titulo, detalle, destacado, onEditar, onQuitar }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      background: destacado ? T.accentBg : T.bg,
      border: `1px solid ${destacado ? `${T.accent}55` : T.border}`,
      borderRadius: 11, padding: 8,
    }}>
      {/* La miniatura sale del propio archivo. No se usa canvas: leer los
          píxeles de un video de otro dominio lo "mancha" y el navegador
          prohíbe exportarlo. Cloudflare no manda las cabeceras que lo
          permitirían. Comprobado en consola. */}
      <span style={{
        width: 46, height: 46, borderRadius: 9, overflow: 'hidden', flexShrink: 0,
        background: '#0E1015', display: 'grid', placeItems: 'center',
      }}>
        {esVideo ? (
          <video
            src={url} muted playsInline preload="metadata" tabIndex={-1} aria-hidden="true"
            // Safari en iPhone deja el recuadro en negro mientras el video no se
            // haya movido. Pedirle que salte un pelín lo obliga a pintar.
            onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.1; }}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
          />
        ) : (
          <img src={url} alt="" loading="lazy"
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
        )}
      </span>

      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontSize: 13, fontWeight: 700, color: destacado ? T.accent : T.text,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          {esVideo ? <Video size={12} /> : <ImageIcon size={12} />}
          {titulo}
        </div>
        {detalle && (
          <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 600 }}>{detalle}</div>
        )}
      </div>

      {onEditar && (
        <button
          type="button" onClick={onEditar}
          title={esVideo ? 'Recortar, encuadrar, silenciar o cambiar para quién es' : 'Cambiar para quién es'}
          style={{
            border: 'none', background: 'transparent', cursor: 'pointer',
            color: T.text2, padding: 6, flexShrink: 0,
          }}
        >
          {esVideo ? <Scissors size={15} /> : <Users size={15} />}
        </button>
      )}
      <button
        type="button" onClick={onQuitar} title="Quitar"
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

export default function MediaDelEjercicio({
  exerciseId,
  portada, onPortada,
  principal, recortePrincipal, onPrincipal, onRecortePrincipal,
}) {
  const { user } = useAuth();
  const [editando, setEditando] = useState(null); // qué archivo se está tocando
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let vivo = true;
    if (!exerciseId) { setCargando(false); return undefined; }
    // Se muestran solo los MIOS y los del master. Un ejercicio base lo comparten
    // todos los coaches: sin este filtro aparecerían aquí los ángulos que subió
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

  /* ¿Esto va a la columna de siempre, o a la tabla de versiones?
     Va a la columna solo si no hay nada que no quepa ahí —ni género ni
     etiqueta— y esa columna está libre. */
  const vaAlHueco = (ocupado, genero, etiqueta) => !ocupado && !genero && !(etiqueta || '').trim();

  async function agregarFoto({ url: subida, genero, etiqueta }) {
    if (!subida) { setErr('No se pudo subir la foto.'); return; }
    setErr('');

    if (vaAlHueco(portada, genero, etiqueta)) { onPortada?.(subida); return; }

    try {
      const fila = await addExerciseMedia({
        exerciseId, url: subida, tipo: 'foto',
        etiqueta: (etiqueta || '').trim() || null,
        genero: genero || null,
      });
      setLista((prev) => [...prev, fila]);
    } catch (e) {
      setErr(e.message || 'No se pudo guardar la foto.');
    }
  }

  async function agregarVideo({ url: subida, inicio, fin, sinAudio, encuadre, genero, etiqueta }) {
    if (!subida) { setErr('No se pudo subir el video.'); return; }
    setErr('');

    if (vaAlHueco(principal, genero, etiqueta)) {
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

  // Un ejercicio que todavía no existe no puede tener archivos colgados:
  // primero hay que guardarlo para que tenga id.
  if (!exerciseId) {
    return (
      <div style={{ fontSize: 12.5, color: T.text3, fontWeight: 600, lineHeight: 1.5 }}>
        Guarda el ejercicio y podrás agregarle fotos y videos: otros ángulos, o una versión para hombres y otra para mujeres.
      </div>
    );
  }

  const hayAlgo = portada || principal || lista.length > 0;

  /* ¿Alguien se queda sin ver nada?
     Si el ejercicio SOLO tiene versiones por género, quien no haya puesto el
     suyo en su perfil no recibe ninguna: la app no adivina, y hace bien —
     enseñarle la versión equivocada es peor que la genérica. Pero el coach no
     tiene por qué deducir eso solo, así que se le dice aquí, en el momento en
     que pasa y no cuando un atleta se queje.

     Hoy importa el doble: las cuentas que ya existen se crearon antes de que
     el registro preguntara el género, así que lo tienen vacío. */
  const soloPorGenero = (tipo, hueco) => {
    const míos = lista.filter((m) => m.tipo === tipo);
    return !hueco && míos.length > 0
      && míos.some((m) => m.genero) && !míos.some((m) => !m.genero);
  };
  const faltaGenerica = [
    soloPorGenero('video', principal) && 'video',
    soloPorGenero('foto', portada) && 'foto',
  ].filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>Fotos y videos del ejercicio</div>
        <div style={{ fontSize: 11.5, color: T.text3, marginTop: 3, fontWeight: 600, lineHeight: 1.45 }}>
          Al agregar cualquiera se elige para quién es: para todos, o una versión para hombres y otra para mujeres.
        </div>
      </div>

      {cargando ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text3, fontSize: 12.5, fontWeight: 600 }}>
          <Loader2 size={14} className="spin" /> Cargando…
        </div>
      ) : hayAlgo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {portada && (
            <Fila
              url={portada}
              esVideo={false}
              titulo="Portada"
              detalle="Para todos"
              onQuitar={() => onPortada?.('')}
            />
          )}

          {/* El video principal encabeza los videos: es el que se abre. */}
          {principal && (
            <Fila
              url={principal}
              esVideo
              titulo="Se abre por defecto"
              detalle={[etiquetaAjustes(recortePrincipal), 'Para todos'].filter(Boolean).join(' · ')}
              destacado
              onEditar={() => setEditando({ tipo: 'principal', url: principal, ajustes: recortePrincipal })}
              onQuitar={() => onPrincipal?.('')}
            />
          )}

          {lista.map((m) => (
            <Fila
              key={m.id}
              url={m.url}
              esVideo={m.tipo === 'video'}
              titulo={m.etiqueta || (m.tipo === 'video' ? 'Otro ángulo' : 'Otra foto')}
              detalle={etiquetaGenero(m.genero)}
              onEditar={() => setEditando({ tipo: m.tipo, url: m.url, id: m.id, ajustes: m })}
              onQuitar={() => quitar(m.id)}
            />
          ))}
        </div>
      )}

      {faltaGenerica.length > 0 && (
        <div style={{
          background: 'rgba(224,123,0,0.10)', color: '#8A4B00', borderRadius: 11,
          padding: '10px 12px', fontSize: 12.5, fontWeight: 600, lineHeight: 1.45,
        }}>
          <div style={{ fontWeight: 800 }}>
            {faltaGenerica.length === 2
              ? 'Solo hay versiones por género'
              : `El ${faltaGenerica[0]} solo existe por género`}
          </div>
          <div style={{ marginTop: 3 }}>
            Quien no haya puesto si es hombre o mujer en su perfil no verá ninguna.
            Agrega una versión &ldquo;Para todos&rdquo; para cubrirlos.
          </div>
        </div>
      )}

      {/* --- Reabrir algo que ya está subido --- */}
      {editando && (editando.tipo === 'foto' ? (
        <EditorFoto
          url={editando.url}
          generoInicial={editando.ajustes?.genero || ''}
          etiquetaInicial={editando.ajustes?.etiqueta || ''}
          onCancelar={() => setEditando(null)}
          onListo={async ({ genero, etiqueta }) => {
            const patch = {
              genero: genero || null,
              etiqueta: (etiqueta || '').trim() || null,
            };
            try {
              await updateExerciseMedia(editando.id, patch);
              // La lista se refresca en el momento: si no, sigue enseñando la
              // etiqueta vieja hasta recargar la pantalla.
              setLista((prev) => prev.map((x) => (x.id === editando.id ? { ...x, ...patch } : x)));
            } catch (e) { setErr(e.message || 'No se pudo guardar el cambio.'); }
            setEditando(null);
          }}
        />
      ) : (
        <EditorVideo
          url={editando.url}
          ajustes={editando.ajustes}
          /* El video principal vive en una columna del ejercicio, que no tiene
             género ni etiqueta. Preguntar algo que no se puede guardar es peor
             que no preguntarlo; por eso ahí no sale la pestaña. Para llegar a
             una versión por género se agrega otro video, que sí la trae. */
          conDestino={editando.tipo !== 'principal'}
          generoInicial={editando.ajustes?.genero || ''}
          etiquetaInicial={editando.ajustes?.etiqueta || ''}
          onCancelar={() => setEditando(null)}
          onListo={async (ajustes) => {
            if (editando.tipo === 'principal') {
              onRecortePrincipal?.(ajustes);
            } else {
              const patch = {
                recorte_inicio: ajustes.inicio ?? null,
                recorte_fin: ajustes.fin ?? null,
                sin_audio: !!ajustes.sinAudio,
                encuadre: ajustes.encuadre ?? null,
                genero: ajustes.genero || null,
                etiqueta: (ajustes.etiqueta || '').trim() || null,
              };
              try {
                await updateExerciseMedia(editando.id, patch);
                setLista((prev) => prev.map((x) => (x.id === editando.id ? { ...x, ...patch } : x)));
              } catch (e) { setErr(e.message || 'No se pudo guardar el recorte.'); }
            }
            setEditando(null);
          }}
        />
      ))}

      {/* --- Agregar --- */}
      <MediaUpload
        label=""
        icon={ImageIcon}
        value=""
        onChange={() => {}}
        onAjustes={agregarFoto}
        conDestino
        accept="image/*"
        kind="covers"
        hint="Foto: se elige para quién es antes de subirla."
      />

      <MediaUpload
        label=""
        icon={Video}
        value=""
        onChange={() => {}}
        onAjustes={agregarVideo}
        conDestino
        accept="video/*"
        kind="videos"
        hint="Video: se abre el editor para recortar, encuadrar, quitar el audio y elegir para quién es."
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
