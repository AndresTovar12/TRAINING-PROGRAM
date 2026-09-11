/**
 * TODAS las fotos y videos de un ejercicio, en UNA lista.
 *
 * POR QUE UNA SOLA LISTA:
 * Antes había tres sitios. Arriba "Foto de portada". Debajo el video principal.
 * Más abajo "otros ángulos y versiones". Para quien usa la app son todos
 * archivos del mismo ejercicio; que unos vivan en una columna de `exercises` y
 * otros en la tabla `exercise_media` es un detalle de cómo está guardado, no
 * algo que le importe a nadie.
 *
 * DONDE SE DECIDE PARA QUIEN ES CADA ARCHIVO, y por qué aquí y no al subirlo:
 * lo tuve un rato como un paso dentro del editor, justo después de elegir el
 * archivo. Andrés: "¿te parece que ese es el momento para decidir si es para
 * hombre, para mujer o para todos? tampoco me pareció muy inteligente".
 *
 * Tiene razón por dos motivos. Uno, estás mirando un video para recortarlo y de
 * golpe te preguntan una regla de reparto: son dos tareas distintas pegadas.
 * Dos, la respuesta es "para todos" casi siempre, así que ese paso frenaba el
 * caso normal por culpa del raro.
 *
 * Aquí significa algo: estás viendo QUÉ tiene el ejercicio, y decides a quién
 * va cada cosa mirando el conjunto. Se cambia cuando quieras, no solo al subir.
 *
 * LA REGLA, en una frase: la primera foto y el primer video son para todos; los
 * que agregues después pueden ir dirigidos a hombres o a mujeres.
 *
 * No es una regla de pantalla, es dónde cabe el dato. Los primeros viven en una
 * columna de `exercises` (`cover_image_url`, `video_url`) que no tiene campo de
 * género — y son, por definición, el archivo por defecto de todo el mundo. Los
 * siguientes viven en `exercise_media`, que sí lo tiene.
 *
 * CUAL VE CADA ATLETA lo decide `lib/videos.js`, no esta pantalla: el suyo
 * primero, luego el de su género, luego el general.
 */
import { useEffect, useState } from 'react';
import {
  Video, Image as ImageIcon, Trash2, Loader2, Scissors, Users, Check,
} from 'lucide-react';
import {
  listExerciseMedia, addExerciseMedia, deleteExerciseMedia, updateExerciseMedia, getMasterId,
} from '@/lib/api';
import EditorVideo from '@/features/admin/EditorVideo';
import { useAuth } from '@/contexts/AuthContext';
import MediaUpload from '@/features/admin/MediaUpload';
import { ANGULOS_SUGERIDOS, MOMENTOS_SUGERIDOS } from '@/lib/videos';
import { T, FONT } from '@/lib/theme';

const PUBLICOS = [['', 'Todos'], ['h', 'Hombres'], ['m', 'Mujeres']];
const nombrePublico = (g) => (PUBLICOS.find(([v]) => v === (g || ''))?.[1] ?? 'Todos');

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
  );
}

export default function MediaDelEjercicio({
  exerciseId,
  portada, onPortada,
  principal, recortePrincipal, onPrincipal, onRecortePrincipal,
}) {
  const { user } = useAuth();
  const [recortando, setRecortando] = useState(null); // video abierto en el editor
  const [abierta, setAbierta] = useState(null);       // fila con el "para quién" desplegado
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    let vivo = true;
    if (!exerciseId) { setCargando(false); return undefined; }
    // Solo los MIOS y los del master. Un ejercicio base lo comparten todos los
    // coaches: sin este filtro aparecerían aquí los ángulos que subió otro
    // entrenador —que además no se pueden borrar, así que el botón daría error
    // sin explicación.
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

  async function agregarFoto({ url: subida }) {
    if (!subida) { setErr('No se pudo subir la foto.'); return; }
    setErr('');
    if (!portada) { onPortada?.(subida); return; }
    try {
      const fila = await addExerciseMedia({ exerciseId, url: subida, tipo: 'foto' });
      setLista((prev) => [...prev, fila]);
    } catch (e) {
      setErr(e.message || 'No se pudo guardar la foto.');
    }
  }

  async function agregarVideo({ url: subida, inicio, fin, sinAudio, encuadre }) {
    if (!subida) { setErr('No se pudo subir el video.'); return; }
    setErr('');
    if (!principal) {
      onPrincipal?.(subida);
      onRecortePrincipal?.({ inicio, fin, sinAudio, encuadre });
      return;
    }
    try {
      const fila = await addExerciseMedia({
        exerciseId, url: subida, tipo: 'video', inicio, fin, sinAudio, encuadre,
      });
      setLista((prev) => [...prev, fila]);
    } catch (e) {
      setErr(e.message || 'No se pudo guardar el video.');
    }
  }

  /* Cambia a quién va dirigido un archivo, o cómo se llama.
     Se guarda de una vez y la lista se refresca en el momento: si no, sigue
     enseñando lo viejo hasta recargar la pantalla. */
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

  const filaBase = {
    display: 'flex', alignItems: 'center', gap: 10,
    background: T.bg, border: `1px solid ${T.border}`,
    borderRadius: 11, padding: 8,
  };
  const icono = { border: 'none', background: 'transparent', cursor: 'pointer', padding: 6, flexShrink: 0 };
  const título = {
    fontSize: 13, fontWeight: 700, color: T.text,
    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
  };
  const sub = { fontSize: 11.5, color: T.text3, fontWeight: 600, marginTop: 1 };

  /* Solo hay versiones por género y nadie más las cubre.
     Quien no haya puesto el suyo en el perfil no recibe ninguna: la app no
     adivina, y hace bien — enseñarle la versión equivocada es peor que la
     genérica. Pero el coach no tiene por qué deducirlo solo, así que se le dice
     aquí, cuando pasa, y no cuando un atleta se queje. */
  const soloPorGenero = (tipo, hueco) => {
    const míos = lista.filter((m) => m.tipo === tipo);
    return !hueco && míos.length > 0 && míos.every((m) => m.genero);
  };
  const faltaGenerica = [
    soloPorGenero('video', principal) && 'video',
    soloPorGenero('foto', portada) && 'foto',
  ].filter(Boolean);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>Fotos y videos</div>

      {cargando ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text3, fontSize: 12.5, fontWeight: 600 }}>
          <Loader2 size={14} className="spin" /> Cargando…
        </div>
      ) : (portada || principal || lista.length > 0) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {portada && (
            <div style={filaBase}>
              <Miniatura url={portada} esVideo={false} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={título}>Foto de portada</div>
                <div style={sub}>Para todos</div>
              </div>
              <button type="button" onClick={() => onPortada?.('')} title="Quitar"
                style={{ ...icono, color: T.danger }}>
                <Trash2 size={15} />
              </button>
            </div>
          )}

          {principal && (
            <div style={filaBase}>
              <Miniatura url={principal} esVideo />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={título}>Video</div>
                <div style={sub}>
                  {[etiquetaAjustes(recortePrincipal), 'Para todos'].filter(Boolean).join(' · ')}
                </div>
              </div>
              <button
                type="button" title="Recortar, encuadrar o silenciar"
                onClick={() => setRecortando({ tipo: 'principal', url: principal, ajustes: recortePrincipal })}
                style={{ ...icono, color: T.text2 }}
              >
                <Scissors size={15} />
              </button>
              <button type="button" onClick={() => onPrincipal?.('')} title="Quitar"
                style={{ ...icono, color: T.danger }}>
                <Trash2 size={15} />
              </button>
            </div>
          )}

          {lista.map((m) => {
            const esVideo = m.tipo === 'video';
            const desplegada = abierta === m.id;
            return (
              <div key={m.id} style={{ ...filaBase, flexDirection: 'column', alignItems: 'stretch', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Miniatura url={m.url} esVideo={esVideo} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={título}>
                      {m.etiqueta || (esVideo ? 'Otro video' : 'Otra foto')}
                    </div>
                    {/* La pastilla es el control, no una etiqueta: se toca y se
                        elige. Es lo que hace visible que la opción existe sin
                        interrumpir a nadie al subir. */}
                    <button
                      type="button"
                      onClick={() => setAbierta(desplegada ? null : m.id)}
                      aria-expanded={desplegada}
                      style={{
                        marginTop: 3, minHeight: 26, padding: '0 9px', borderRadius: 999,
                        border: `1px solid ${m.genero ? T.accent : T.borderHi}`,
                        background: m.genero ? T.accentBg : 'transparent',
                        color: m.genero ? T.accent : T.text2,
                        cursor: 'pointer', fontFamily: FONT, fontSize: 11.5, fontWeight: 700,
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                      }}
                    >
                      <Users size={11} /> {nombrePublico(m.genero)}
                    </button>
                  </div>
                  {esVideo && (
                    <button
                      type="button" title="Recortar, encuadrar o silenciar"
                      onClick={() => setRecortando({ tipo: 'extra', url: m.url, id: m.id, ajustes: m })}
                      style={{ ...icono, color: T.text2 }}
                    >
                      <Scissors size={15} />
                    </button>
                  )}
                  <button type="button" onClick={() => quitar(m.id)} title="Quitar"
                    style={{ ...icono, color: T.danger }}>
                    <Trash2 size={15} />
                  </button>
                </div>

                {desplegada && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 2 }}>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {PUBLICOS.map(([v, t]) => {
                        const activo = (m.genero || '') === v;
                        return (
                          <button
                            key={v || 'todos'} type="button"
                            onClick={() => cambiar(m.id, { genero: v || null })}
                            style={{
                              flex: 1, minHeight: 36, borderRadius: 9, cursor: 'pointer',
                              border: `1.5px solid ${activo ? T.accent : T.border}`,
                              background: activo ? T.accent : T.bg2,
                              color: activo ? '#fff' : T.text2,
                              fontFamily: FONT, fontSize: 12.5, fontWeight: 700,
                              display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                            }}
                          >
                            {activo && <Check size={12} />} {t}
                          </button>
                        );
                      })}
                    </div>
                    <input
                      defaultValue={m.etiqueta || ''}
                      onBlur={(e) => {
                        const v = e.target.value.trim();
                        if (v !== (m.etiqueta || '')) cambiar(m.id, { etiqueta: v || null });
                      }}
                      placeholder={esVideo ? 'Desde dónde: Frontal, Lateral…' : 'Qué muestra: Posición inicial…'}
                      list={esVideo ? 'angulos-media' : 'momentos-media'}
                      style={{
                        width: '100%', boxSizing: 'border-box', borderRadius: 9,
                        border: `1.5px solid ${T.border}`, background: T.bg2,
                        padding: '9px 11px', color: T.text, fontFamily: FONT,
                        // 16 px o menos hace que iPhone acerque la pantalla al escribir.
                        fontSize: 16, fontWeight: 600, outline: 'none',
                      }}
                    />
                  </div>
                )}
              </div>
            );
          })}
          <datalist id="angulos-media">
            {ANGULOS_SUGERIDOS.map((a) => <option key={a} value={a} />)}
          </datalist>
          <datalist id="momentos-media">
            {MOMENTOS_SUGERIDOS.map((a) => <option key={a} value={a} />)}
          </datalist>
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
          </div>
        </div>
      )}

      {recortando && (
        <EditorVideo
          url={recortando.url}
          ajustes={recortando.ajustes}
          onCancelar={() => setRecortando(null)}
          onListo={async (ajustes) => {
            if (recortando.tipo === 'principal') {
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

      <MediaUpload
        label="" icon={ImageIcon} value="" onChange={() => {}}
        onAjustes={agregarFoto} accept="image/*" kind="covers"
      />
      <MediaUpload
        label="" icon={Video} value="" onChange={() => {}}
        onAjustes={agregarVideo} accept="video/*" kind="videos"
      />

      <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 600, lineHeight: 1.45 }}>
        La primera foto y el primer video son para todos. Los que agregues después
        puedes dirigirlos a hombres o a mujeres.
      </div>

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
