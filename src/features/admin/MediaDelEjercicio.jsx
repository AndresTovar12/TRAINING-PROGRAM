/**
 * Las fotos y videos de un ejercicio, partidos por a quién van dirigidos.
 *
 * POR QUÉ TRES GRUPOS, y no una lista con etiquetas. Se lo pregunté a Andrés y
 * contestó tres cosas que juntas obligan a este diseño:
 *
 *   1. "Son versiones sueltas, sin jerarquía". No hay un video principal y
 *      unos extras colgando: los tres grupos valen igual.
 *   2. "Casi siempre que pueda" va a querer las dos versiones. O sea que la
 *      respuesta NO es "para todos" la mayoría de las veces.
 *   3. Quiere poder subir SOLO la de mujer, sin obligarse a subir antes una
 *      general.
 *
 * El punto 2 es el que tumba lo que tenía antes. Yo había sacado la pregunta
 * "¿para quién es?" del momento de subir con el argumento de que casi siempre
 * se contesta "para todos" y por tanto estorbaba. Ese argumento era falso: él
 * quiere las dos versiones casi siempre.
 *
 * Pero la conclusión no es devolver la pregunta. Es que no haga falta
 * preguntar: **el botón que tocas ES la respuesta**. Tocas "Agregar" dentro de
 * Mujeres y lo que subas queda dirigido a mujeres. Cero preguntas, y de un
 * vistazo ves qué le falta al ejercicio — que con una lista plana no se ve.
 *
 * DÓNDE SE GUARDA CADA COSA. "Para todos" usa las columnas de siempre
 * (`cover_image_url`, `video_url`) mientras estén libres, porque media app las
 * lee directo: el buscador de repertorio, las tarjetas del plan, la insignia de
 * "tiene video". Lo demás va a `exercise_media`, que sí tiene campo de género.
 * Es un detalle de guardado, invisible en pantalla.
 *
 * CUÁL VE CADA ATLETA lo decide `lib/videos.js`: el suyo propio primero, luego
 * el de su género, luego el general. Si no puso género, no se le adivina.
 */
import { useEffect, useState } from 'react';
import {
  Video, Image as ImageIcon, Trash2, Loader2, Scissors, Plus, X, ArrowRightLeft,
} from 'lucide-react';
import {
  listExerciseMedia, addExerciseMedia, deleteExerciseMedia, updateExerciseMedia,
  updateExercise, getMasterId,
} from '@/lib/api';
import EditorVideo from '@/features/admin/EditorVideo';
import { useAuth } from '@/contexts/AuthContext';
import MediaUpload from '@/features/admin/MediaUpload';
import { T, FONT } from '@/lib/theme';

const GRUPOS = [
  { g: '', et: 'Para todos', pista: 'Lo ve quien no tenga una versión propia' },
  { g: 'h', et: 'Hombres', pista: null },
  { g: 'm', et: 'Mujeres', pista: null },
];

/** Resume en una línea qué se le hizo al video, o nada si está tal cual. */
function etiquetaAjustes(a) {
  if (!a) return null;
  const partes = [];
  if (a.recorte_inicio != null || a.recorte_fin != null) partes.push('recortado');
  if (a.encuadre) partes.push('encuadrado');
  if (a.sin_audio) partes.push('sin audio');
  return partes.length ? partes.join(' · ') : null;
}

/** Miniatura del propio archivo.
    No se usa canvas a propósito: leer los píxeles de un video de otro dominio
    lo "mancha" y el navegador prohíbe exportarlo. Cloudflare no manda las
    cabeceras que lo permitirían. Comprobado en consola. */
function Miniatura({ url, esVideo }) {
  return (
    <span style={{
      width: 44, height: 44, borderRadius: 9, overflow: 'hidden', flexShrink: 0,
      background: '#0E1015', display: 'grid', placeItems: 'center',
    }}>
      {esVideo ? (
        <video
          src={url} muted playsInline preload="metadata" tabIndex={-1} aria-hidden="true"
          // Safari en iPhone deja el recuadro negro mientras el video no se
          // haya movido. Pedirle que salte un pelín lo obliga a pintar.
          onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.1; }}
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <img src={url} alt="" loading="lazy"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
      )}
    </span>
  );
}

export default function MediaDelEjercicio({
  exerciseId,
  portada, onPortada,
  principal, recortePrincipal, onPrincipal, onRecortePrincipal,
}) {
  const { user } = useAuth();
  const [recortando, setRecortando] = useState(null); // video abierto en el editor
  const [agregandoEn, setAgregandoEn] = useState(null); // grupo con los botones desplegados
  const [moviendo, setMoviendo] = useState(null);       // archivo al que se le cambia de grupo
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let vivo = true;
    if (!exerciseId) { setCargando(false); return undefined; }
    // Solo los MIOS y los del master. Un ejercicio base lo comparten todos los
    // coaches: sin este filtro aparecerían aquí los archivos que subió otro
    // entrenador —que además no puede borrar, así que el botón daría error sin
    // explicación.
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

  /* Guarda lo que sale del editor, en el grupo desde el que se tocó "Agregar".
     Las columnas de siempre se usan solo para "Para todos" y solo si están
     libres: media app las lee directo y dejarlas vacías rompería la portada en
     el buscador de repertorio y en las tarjetas del plan. */
  async function agregar(grupo, tipo, { url: subida, inicio, fin, sinAudio, encuadre }) {
    if (!subida) { setErr('No se pudo subir el archivo.'); return; }
    setErr('');
    setAgregandoEn(null);

    if (grupo === '' && tipo === 'foto' && !portada) { onPortada?.(subida); return; }
    if (grupo === '' && tipo === 'video' && !principal) {
      onPrincipal?.(subida);
      onRecortePrincipal?.({ inicio, fin, sinAudio, encuadre });
      return;
    }
    try {
      const fila = await addExerciseMedia({
        exerciseId, url: subida, tipo, genero: grupo || null, inicio, fin, sinAudio, encuadre,
      });
      setLista((prev) => [...prev, fila]);
    } catch (e) {
      setErr(e.message || 'No se pudo guardar el archivo.');
    }
  }

  async function cambiar(id, patch) {
    const antes = lista;
    setLista((prev) => prev.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    try {
      await updateExerciseMedia(id, patch);
    } catch (e) {
      setLista(antes);
      setErr(e.message || 'No se pudo guardar el cambio.');
    }
  }

  /* Mueve un archivo de un grupo a otro.
     El caso difícil es sacar algo de "Para todos" cuando vive en una columna
     del ejercicio: hay que crear la fila nueva Y vaciar la columna. Las dos
     mitades se guardan EN EL MOMENTO, no al darle a "Guardar cambios": si solo
     se guardara una, cancelar el formulario dejaría el archivo duplicado. */
  async function mover(item, destino) {
    setMoviendo(null);
    setErr('');
    if (item.columna) {
      try {
        const fila = await addExerciseMedia({
          exerciseId, url: item.url, tipo: item.tipo, genero: destino || null,
          inicio: item.recorte_inicio, fin: item.recorte_fin,
          sinAudio: item.sin_audio, encuadre: item.encuadre,
        });
        const vacia = item.tipo === 'foto' ? { cover_image_url: null } : {
          video_url: null, recorte_inicio: null, recorte_fin: null,
          sin_audio: false, encuadre: null,
        };
        await updateExercise(exerciseId, vacia);
        setLista((prev) => [...prev, fila]);
        if (item.tipo === 'foto') onPortada?.(''); else onPrincipal?.('');
      } catch (e) {
        setErr(e.message || 'No se pudo mover el archivo.');
      }
      return;
    }
    await cambiar(item.id, { genero: destino || null });
  }

  async function quitar(item) {
    if (item.columna) {
      if (item.tipo === 'foto') onPortada?.(''); else onPrincipal?.('');
      return;
    }
    const antes = lista;
    setLista((prev) => prev.filter((m) => m.id !== item.id));
    try {
      await deleteExerciseMedia(item.id);
    } catch {
      setLista(antes); // no se borró: se devuelve a como estaba
    }
  }

  if (!exerciseId) {
    return (
      <div style={{ fontSize: 12.5, color: T.text3, fontWeight: 600, lineHeight: 1.5 }}>
        Guarda el ejercicio y podrás agregarle fotos y videos, con una versión para hombres y otra para mujeres si quieres.
      </div>
    );
  }

  /* Todo junto y ordenado por grupo. Los que viven en una columna del ejercicio
     entran como uno más, marcados para saber cómo borrarlos y moverlos. */
  const deColumna = [
    portada && {
      id: 'col-foto', columna: true, tipo: 'foto', url: portada, genero: null,
    },
    principal && {
      id: 'col-video', columna: true, tipo: 'video', url: principal, genero: null,
      ...(recortePrincipal ?? {}),
    },
  ].filter(Boolean);
  const todos = [...deColumna, ...lista];
  const delGrupo = (g) => todos.filter((m) => (m.genero || '') === g);

  const icono = { border: 'none', background: 'transparent', cursor: 'pointer', padding: 6, flexShrink: 0 };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>Fotos y videos</div>
        <div style={{ fontSize: 11.5, color: T.text3, marginTop: 3, fontWeight: 600, lineHeight: 1.45 }}>
          Lo que agregues dentro de un grupo queda dirigido a ese grupo. No hace falta elegir nada más.
        </div>
      </div>

      {cargando ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text3, fontSize: 12.5, fontWeight: 600 }}>
          <Loader2 size={14} className="spin" /> Cargando…
        </div>
      ) : GRUPOS.map(({ g, et, pista }) => {
        const items = delGrupo(g);
        const abierto = agregandoEn === g;
        return (
          <div key={g || 'todos'} style={{
            border: `1px solid ${T.border}`, borderRadius: 13, padding: 10,
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 800, color: T.text }}>{et}</span>
              {pista && (
                <span style={{ fontSize: 11, color: T.text3, fontWeight: 600 }}>{pista}</span>
              )}
            </div>

            {items.length === 0 && (
              <div style={{ fontSize: 12, color: T.text3, fontWeight: 600 }}>Nada todavía</div>
            )}

            {items.map((m) => {
              const esVideo = m.tipo === 'video';
              const detalle = etiquetaAjustes(m);
              return (
                <div key={m.id} style={{
                  display: 'flex', flexDirection: 'column', gap: 8,
                  background: T.bg, border: `1px solid ${T.border}`, borderRadius: 11, padding: 8,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Miniatura url={m.url} esVideo={esVideo} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 13, fontWeight: 700, color: T.text,
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {m.etiqueta || (esVideo ? 'Video' : 'Foto')}
                      </div>
                      {detalle && (
                        <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 600, marginTop: 1 }}>
                          {detalle}
                        </div>
                      )}
                    </div>
                    <button
                      type="button" title="Mover a otro grupo"
                      onClick={() => setMoviendo(moviendo === m.id ? null : m.id)}
                      style={{ ...icono, color: T.text2 }}
                    >
                      <ArrowRightLeft size={15} />
                    </button>
                    {esVideo && (
                      <button
                        type="button" title="Recortar, encuadrar o silenciar"
                        onClick={() => setRecortando(m)}
                        style={{ ...icono, color: T.text2 }}
                      >
                        <Scissors size={15} />
                      </button>
                    )}
                    <button type="button" onClick={() => quitar(m)} title="Quitar"
                      style={{ ...icono, color: T.danger }}>
                      <Trash2 size={15} />
                    </button>
                  </div>

                  {moviendo === m.id && (
                    <div style={{ display: 'flex', gap: 6 }}>
                      {GRUPOS.filter((o) => o.g !== g).map((o) => (
                        <button
                          key={o.g || 'todos'} type="button"
                          onClick={() => mover(m, o.g)}
                          style={{
                            flex: 1, minHeight: 36, borderRadius: 9, cursor: 'pointer',
                            border: `1.5px solid ${T.border}`, background: T.bg2, color: T.text2,
                            fontFamily: FONT, fontSize: 12.5, fontWeight: 700,
                          }}
                        >
                          Mover a {o.et.toLowerCase()}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Un solo botón por grupo, y las cuatro formas de agregar se
                despliegan al tocarlo. Con tres grupos en pantalla, enseñar las
                cuatro siempre serían doce botones a la vez. */}
            {abierto ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <MediaUpload
                  label="" icon={ImageIcon} value="" onChange={() => {}}
                  onAjustes={(a) => agregar(g, 'foto', a)}
                  accept="image/*" kind="covers"
                />
                <MediaUpload
                  label="" icon={Video} value="" onChange={() => {}}
                  onAjustes={(a) => agregar(g, 'video', a)}
                  accept="video/*" kind="videos"
                />
                <button
                  type="button" onClick={() => setAgregandoEn(null)}
                  style={{
                    alignSelf: 'flex-start', minHeight: 34, padding: '0 12px', borderRadius: 9,
                    border: 'none', background: 'transparent', color: T.text3, cursor: 'pointer',
                    fontFamily: FONT, fontSize: 12.5, fontWeight: 700,
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <X size={13} /> Cancelar
                </button>
              </div>
            ) : (
              <button
                type="button" onClick={() => setAgregandoEn(g)}
                style={{
                  alignSelf: 'flex-start', minHeight: 38, padding: '0 14px', borderRadius: 10,
                  border: `1.5px dashed ${T.borderHi}`, background: 'transparent', color: T.text2,
                  cursor: 'pointer', fontFamily: FONT, fontSize: 12.5, fontWeight: 700,
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                }}
              >
                <Plus size={14} /> Agregar {items.length ? 'otro' : ''}
              </button>
            )}
          </div>
        );
      })}

      {recortando && (
        <EditorVideo
          url={recortando.url}
          ajustes={recortando}
          onCancelar={() => setRecortando(null)}
          onListo={async (ajustes) => {
            if (recortando.columna) {
              onRecortePrincipal?.(ajustes);
            } else {
              await cambiar(recortando.id, {
                recorte_inicio: ajustes.inicio ?? null,
                recorte_fin: ajustes.fin ?? null,
                sin_audio: !!ajustes.sinAudio,
                encuadre: ajustes.encuadre ?? null,
              });
            }
            setRecortando(null);
          }}
        />
      )}

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
