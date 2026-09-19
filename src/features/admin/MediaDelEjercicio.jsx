/**
 * Las fotos y videos de un ejercicio: una sola lista, y arriba tres botones
 * para elegir a quién va lo que subas.
 *
 * DE DÓNDE SALE ESTE DISEÑO. Se lo pregunté a Andrés y contestó cuatro cosas:
 *
 *   1. "Son versiones sueltas, sin jerarquía". No hay un video principal con
 *      extras colgando.
 *   2. "Casi siempre que pueda" va a querer las dos versiones.
 *   3. El atleta ve solo la suya, automático.
 *   4. La regla de que el primer archivo fuera siempre "para todos": "sí me
 *      estorba, quítala". Quiere poder subir SOLO la de mujer.
 *
 * El punto 2 tumbó lo que tenía antes. Yo había sacado la pregunta "¿para quién
 * es?" del momento de subir con el argumento de que casi siempre se contesta
 * "para todos" y por tanto estorbaba. Ese argumento me lo inventé: él quiere
 * las dos versiones casi siempre.
 *
 * Pero la salida no es devolver la pregunta, es que no haga falta: **el botón
 * que tocas ES la respuesta**. Tocas "Mujeres" y lo que subas queda dirigido a
 * mujeres, sin que nadie te pregunte nada.
 *
 * POR QUÉ UNA FILA DE BOTONES Y NO TRES SECCIONES. Primero partí la pantalla en
 * tres bloques, cada uno con sus archivos dentro. Andrés: "no me gusta que lo
 * dividiste como en tres secciones horizontales", y al preguntarle qué fallaba
 * eligió "no quiero ver los grupos". Dos de los tres bloques decían "Nada
 * todavía" casi siempre: ocupaban un tercio de la pantalla para no enseñar
 * nada, y repetían tres veces el mismo borde y el mismo botón. Los tres caben
 * en una fila.
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
  Trash2, Loader2, Scissors, Users, Mars, Venus, Link as LinkIcon, RefreshCw,
} from 'lucide-react';
import {
  listExerciseMedia, addExerciseMedia, deleteExerciseMedia, updateExerciseMedia,
  updateExercise, getMasterId, uploadExerciseMedia,
} from '@/lib/api';
import EditorVideo from '@/features/admin/EditorVideo';
import EditorFoto from '@/features/admin/EditorFoto';
import { recortaImagen } from '@/features/admin/recorte';
import { useAuth } from '@/contexts/AuthContext';
import MediaUpload from '@/features/admin/MediaUpload';
import MediaAlCrear from '@/features/admin/MediaAlCrear';
import { T, FONT } from '@/lib/theme';
import { ligaExterna } from '@/lib/videos';

const GRUPOS = [
  { g: '', et: 'Para todos', corto: 'Todos', Icono: Users,
    pista: 'Lo verá quien no tenga una versión propia' },
  { g: 'h', et: 'Hombres', corto: 'Hombres', Icono: Mars,
    pista: 'Solo lo verán los hombres' },
  { g: 'm', et: 'Mujeres', corto: 'Mujeres', Icono: Venus,
    pista: 'Solo lo verán las mujeres' },
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
      {/* Una liga de TikTok o YouTube no da fotograma: el <video> no la puede
          leer y el recuadro se queda negro. Se pone el icono de liga. */}
      {ligaExterna(url) ? (
        <LinkIcon size={18} color="#8A93A3" />
      ) : esVideo ? (
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
  // Solo mientras el ejercicio no existe: la lista de lo que se grabó antes de
  // crearlo. La guarda el formulario, no este componente, porque quien la
  // reparte al guardar es `ExercisesPanel`.
  nuevos, onNuevos,
}) {
  const { user } = useAuth();
  const [recortando, setRecortando] = useState(null); // video abierto en el editor
  /* SIEMPRE hay un grupo elegido, y arranca en "Para todos".
     Antes se podía no tener ninguno, y entonces el botón de agregar no sabía a
     dónde mandar el archivo. Con uno siempre puesto, la pantalla contesta sola
     las dos preguntas: qué estás viendo y a dónde va lo que subas. */
  const [grupo, setGrupo] = useState('');
  const [moviendo, setMoviendo] = useState(null);       // archivo al que se le cambia de grupo
  const [reemplazando, setReemplazando] = useState(null); // archivo que se está cambiando por otro
  const [recortandoFoto, setRecortandoFoto] = useState(null); // foto abierta en el editor
  const [ocupado, setOcupado] = useState(false);
  const [lista, setLista] = useState([]);
  const [cargando, setCargando] = useState(true);
  const [err, setErr] = useState('');
  const [ligaAbierta, setLigaAbierta] = useState(false);
  const [ligaTexto, setLigaTexto] = useState('');

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
  /* Una liga no se sube: se guarda tal cual. Tampoco lleva recorte, ni audio
     apagado, ni encuadre — eso solo se puede hacer con un archivo nuestro. */
  async function guardaLiga() {
    const texto = ligaTexto.trim();
    const liga = ligaExterna(texto);
    if (!liga) {
      setErr('Eso no parece una dirección de video. Copia la liga completa desde la app.');
      return;
    }
    try {
      const fila = await addExerciseMedia({
        exerciseId, url: texto, tipo: 'video', genero: grupo || null,
        inicio: null, fin: null, sinAudio: false, encuadre: null,
      });
      setLista((prev) => [...prev, fila]);
      setLigaAbierta(false);
      setLigaTexto('');
      setErr('');
    } catch (e) {
      setErr(e.message || 'No se pudo guardar la liga.');
    }
  }

  async function agregar(destino, { url: subida, tipo, inicio, fin, sinAudio, encuadre }) {
    if (!subida) { setErr('No se pudo subir el archivo.'); return; }
    setErr('');

    if (destino === '' && tipo === 'foto' && !portada) { onPortada?.(subida); return; }
    if (destino === '' && tipo === 'video' && !principal) {
      onPrincipal?.(subida);
      onRecortePrincipal?.({ inicio, fin, sinAudio, encuadre });
      return;
    }
    try {
      const fila = await addExerciseMedia({
        exerciseId, url: subida, tipo, genero: destino || null, inicio, fin, sinAudio, encuadre,
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

  /* Vuelve a recortar una foto que ya está subida.
     No se puede "deshacer" el recorte anterior —esos píxeles ya no existen— así
     que lo que se corta aquí se corta sobre lo que hay. Se sube como archivo
     nuevo y se cambia la dirección: el viejo se queda en el bucket, que es lo
     mismo que pasa al reemplazar una portada. */
  async function recortarFoto(item, { encuadre, archivo }) {
    setRecortandoFoto(null);
    if (!encuadre || !archivo) return;
    setOcupado(true);
    setErr('');
    try {
      const file = await recortaImagen(archivo, encuadre);
      const nueva = await uploadExerciseMedia(file, 'covers');
      if (item.columna) onPortada?.(nueva);
      else await cambiar(item.id, { url: nueva });
    } catch (e) {
      setErr(e.message || 'No se pudo recortar la foto.');
    } finally {
      setOcupado(false);
    }
  }

  /* CAMBIAR UNA FOTO O UN VIDEO POR OTRO, EN SU SITIO.
     Andrés, 18 sep 2026: "si trato de intercambiar la foto de portada por otra
     como que no hay una opción que me deje hacerlo". Se podía —borrar y volver
     a subir— pero eso son dos pasos, y el de borrar da miedo. Aquí el archivo
     nuevo cae sobre el viejo: mismo grupo, misma posición, sin pasar por el
     hueco intermedio en el que el ejercicio se queda sin portada.

     Los recortes del archivo anterior NO se heredan: un recorte se calculó
     sobre otro video, y aplicarlo a este cortaría por donde no toca. */
  async function reemplaza(item, { url: subida, tipo, inicio, fin, sinAudio, encuadre }) {
    if (!subida) { setErr('No se pudo subir el archivo.'); return; }
    setErr('');
    setReemplazando(null);
    if (item.columna) {
      if (item.tipo === 'foto') onPortada?.(subida);
      else { onPrincipal?.(subida); onRecortePrincipal?.({ inicio, fin, sinAudio, encuadre }); }
      return;
    }
    await cambiar(item.id, {
      url: subida,
      tipo,
      recorte_inicio: inicio ?? null,
      recorte_fin: fin ?? null,
      sin_audio: !!sinAudio,
      encuadre: encuadre ?? null,
    });
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

  const icono = { border: 'none', background: 'transparent', cursor: 'pointer', padding: 6, flexShrink: 0 };

  /* EL EJERCICIO TODAVÍA NO EXISTE.
     Se puede grabar igual: la pantalla de crear tiene la suya, que apunta los
     archivos en una lista y los reparte cuando el ejercicio nace. Ver
     `MediaAlCrear`, que explica por qué hace falta. */
  if (!exerciseId) {
    return <MediaAlCrear nuevos={nuevos ?? []} onNuevos={onNuevos ?? (() => {})} />;
  }


  /* Todo en UNA lista, ordenada por grupo pero sin partir la pantalla.
     Los archivos que viven en una columna del ejercicio entran como uno más,
     marcados para saber cómo borrarlos y moverlos. */
  const deColumna = [
    portada && {
      id: 'col-foto', columna: true, tipo: 'foto', url: portada, genero: null,
    },
    principal && {
      id: 'col-video', columna: true, tipo: 'video', url: principal, genero: null,
      ...(recortePrincipal ?? {}),
    },
  ].filter(Boolean);
  const orden = { '': 0, h: 1, m: 2 };
  const todos = [...deColumna, ...lista]
    .sort((a, b) => orden[a.genero || ''] - orden[b.genero || '']);

  /* LA CARD ELEGIDA FILTRA LA LISTA.
     Sin esto, tocar "Hombres" dejaba abajo la lista entera, y como la card
     quedaba resaltada parecía que esos archivos estaban dentro de Hombres.
     Andrés: "subí un video en para todos pero le pico a hombre y a mujer, y el
     mismo video y la misma foto aparece en esos también".

     Tenía razón en que engaña, aunque el dato estuviera bien. La card es a la
     vez dónde miras y dónde agregas; si resalta una y abajo sigue todo, está
     diciendo dos cosas a la vez. Con nada elegido se ve todo lo que tiene el
     ejercicio, que es la vista de entrada. */
  const visibles = todos.filter((m) => (m.genero || '') === grupo);
  const grupoElegido = GRUPOS.find((x) => x.g === grupo);


  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>Fotos y videos</span>
        {/* Decir QUÉ se está mirando cuando no es todo. Una lista filtrada que
            no avisa de que está filtrada hace pensar que faltan cosas. */}
        <span style={{ fontSize: 11.5, color: T.text3, fontWeight: 600 }}>
          viendo {grupoElegido?.corto.toLowerCase()}
        </span>
      </div>

      {/* TRES CARDS ARRIBA, y cada una abre UN SOLO par de botones.
          Antes cada grupo desplegaba cuatro —tomar foto, de mis fotos, grabar,
          del carrete—, o sea los mismos cuatro repetidos tres veces. Andrés:
          "el video y la portada se repite en los tres botones, eso no me
          gusta". Tenía razón: el tipo de archivo no es una decisión que haya
          que tomar tres veces, y de hecho no hay que tomarla nunca — lo dice el
          propio archivo cuando lo eliges. Quedan dos botones: cámara o carrete,
          y cada uno acepta foto o video indistintamente. */}
      <div style={{ display: 'flex', gap: 8 }}>
        {GRUPOS.map(({ g, corto, Icono }) => {
          const activo = grupo === g;
          const cuantos = todos.filter((m) => (m.genero || '') === g).length;
          return (
            <button
              key={g || 'todos'} type="button"
              onClick={() => { setGrupo(g); setMoviendo(null); }}
              aria-pressed={activo}
              aria-label={`Ver ${corto.toLowerCase()}`}
              style={{
                flex: 1, borderRadius: 14, cursor: 'pointer', padding: '12px 6px 11px',
                border: `1.5px solid ${activo ? T.accent : T.border}`,
                background: activo ? T.accentBg : T.bg2,
                fontFamily: FONT, display: 'flex', flexDirection: 'column',
                alignItems: 'center', gap: 7,
              }}
            >
              <span style={{
                width: 34, height: 34, borderRadius: '50%', display: 'grid', placeItems: 'center',
                background: activo ? T.accent : T.bg3, color: activo ? '#fff' : T.text2,
              }}>
                <Icono size={18} />
              </span>
              <span style={{ fontSize: 12, fontWeight: 800, color: activo ? T.accent : T.text }}>
                {corto}
              </span>
              {/* Cuántos tiene ya. Contesta de un vistazo qué le falta al
                  ejercicio, y no cambia al moverse entre grupos. */}
              <span style={{ fontSize: 11, fontWeight: 700, color: cuantos ? T.text3 : 'transparent' }}>
                {cuantos || '0'}
              </span>
            </button>
          );
        })}
      </div>

      <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 600 }}>
        {grupoElegido?.pista}
      </div>

      {cargando ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text3, fontSize: 12.5, fontWeight: 600 }}>
          <Loader2 size={14} className="spin" /> Cargando…
        </div>
      ) : visibles.length === 0 ? (
        <div style={{ fontSize: 12, color: T.text3, fontWeight: 600 }}>
          Nada para {grupoElegido?.corto.toLowerCase()} todavía.
        </div>
      ) : visibles.map((m) => {
        const esVideo = m.tipo === 'video';
        const detalle = etiquetaAjustes(m);
        const suyo = m.genero || '';
        const et = GRUPOS.find((x) => x.g === suyo)?.et ?? 'Para todos';
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
                  {esVideo ? 'Video' : 'Foto'}
                  {detalle && (
                    <span style={{ color: T.text3, fontWeight: 600 }}> · {detalle}</span>
                  )}
                </div>
                {/* La marca ES el control de mover: se toca y se cambia. Un
                    icono aparte para lo mismo era un botón de más por fila. */}
                <button
                  type="button"
                  onClick={() => setMoviendo(moviendo === m.id ? null : m.id)}
                  aria-expanded={moviendo === m.id}
                  style={{
                    marginTop: 3, minHeight: 25, padding: '0 9px', borderRadius: 999,
                    border: `1px solid ${grupo ? T.accent : T.borderHi}`,
                    background: grupo ? T.accentBg : 'transparent',
                    color: grupo ? T.accent : T.text3,
                    cursor: 'pointer', fontFamily: FONT, fontSize: 11.5, fontWeight: 700,
                  }}
                >
                  {et}
                </button>
              </div>
              {/* La tijera va en los dos, no solo en el video. Andrés: "aún no
                  das opción de poder editar la foto de portada como para
                  recortarla y así". Se podía al subirla y ya no después, que es
                  justo cuando te das cuenta de que quedó torcida. */}
              <button
                type="button"
                title={esVideo ? 'Recortar, encuadrar o silenciar' : 'Recortar'}
                onClick={() => (esVideo ? setRecortando(m) : setRecortandoFoto(m))}
                disabled={ocupado}
                style={{ ...icono, color: T.text2 }}
              >
                <Scissors size={15} />
              </button>
              {/* Cambiarlo por otro sin borrarlo primero. */}
              <button
                type="button"
                title={esVideo ? 'Cambiar este video por otro' : 'Cambiar esta foto por otra'}
                aria-expanded={reemplazando === m.id}
                onClick={() => setReemplazando(reemplazando === m.id ? null : m.id)}
                disabled={ocupado}
                style={{ ...icono, color: reemplazando === m.id ? T.accent : T.text2 }}
              >
                <RefreshCw size={15} />
              </button>
              <button type="button" onClick={() => quitar(m)} title="Quitar"
                style={{ ...icono, color: T.danger }}>
                <Trash2 size={15} />
              </button>
            </div>

            {reemplazando === m.id && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
                <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 700 }}>
                  {esVideo ? 'El video nuevo cae sobre este' : 'La foto nueva cae sobre esta'}
                </div>
                <MediaUpload
                  label="" value="" onChange={() => {}}
                  onAjustes={(a) => reemplaza(m, a)}
                  accept={esVideo ? 'video/*' : 'image/*'}
                  kind={esVideo ? 'videos' : 'covers'}
                />
              </div>
            )}

            {moviendo === m.id && (
              <div style={{ display: 'flex', gap: 6 }}>
                {GRUPOS.map((o) => {
                  const aqui = o.g === suyo;
                  return (
                    <button
                      key={o.g || 'todos'} type="button"
                      onClick={() => (aqui ? setMoviendo(null) : mover(m, o.g))}
                      style={{
                        flex: 1, minHeight: 36, borderRadius: 9, cursor: 'pointer',
                        border: `1.5px solid ${aqui ? T.accent : T.border}`,
                        background: aqui ? T.accent : T.bg2,
                        color: aqui ? '#fff' : T.text2,
                        fontFamily: FONT, fontSize: 12.5, fontWeight: 700,
                      }}
                    >
                      {o.et === 'Para todos' ? 'Todos' : o.et}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}

      {/* LOS CUATRO BOTONES, SIEMPRE A LA VISTA, debajo de la lista.
          Los tuve un rato escondidos detrás de un "+". Andrés mandó un
          screenshot: "vi que ya habías puesto los botones que te dije y luego
          los quitaste de nuevo". No los había quitado — estaban a un toque de
          distancia. Da igual: si hay que tocar algo para descubrir que siguen
          ahí, para quien mira están quitados.

          Y el "+" que había pedido no era un botón más: era que se viera dónde
          agregar cuando el grupo ya tenía cosas. Eso lo resuelven los propios
          botones estando siempre puestos, justo debajo de lo que hay.

          El renglón de arriba dice a qué grupo van, que es lo único que no se
          adivina mirándolos. */}
      <div style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        border: `1px solid ${T.border}`, borderRadius: 12, padding: 10,
      }}>
        <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 700 }}>
          {visibles.length ? 'Agregar otro' : 'Agregar'} para {grupoElegido?.corto.toLowerCase()}
        </div>
        <MediaUpload
          label="" value="" onChange={() => {}}
          onAjustes={(a) => agregar(grupo, a)}
          accept="image/*" kind="covers"
        />
        <MediaUpload
          label="" value="" onChange={() => {}}
          onAjustes={(a) => agregar(grupo, a)}
          accept="video/*" kind="videos"
        />

        {/* Pegar una liga en vez de subir un archivo.

            Andrés, 17 sep 2026: "¿cómo le hace si el coach sube varios videos y
            aparte un TikTok?". Antes: descargarlo y volverlo a subir, perdiendo
            calidad por el camino. Ahora se pega y ya. El atleta lo ve dentro de
            la app, y si la plataforma bloquea el reproductor, con un botón para
            abrirlo en su app. */}
        {ligaAbierta ? (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            <input
              autoFocus
              value={ligaTexto}
              onChange={(e) => { setLigaTexto(e.target.value); setErr(''); }}
              onKeyDown={(e) => { if (e.key === 'Enter') guardaLiga(); }}
              placeholder="Pega aquí la dirección del TikTok, YouTube o reel"
              style={{
                flex: '1 1 200px', minWidth: 0, padding: '11px 12px', borderRadius: 10,
                border: `1.5px solid ${T.border}`, background: T.bg, fontFamily: FONT,
                fontSize: 16, fontWeight: 600, color: T.text, outline: 'none',
              }}
            />
            <button
              type="button" onClick={guardaLiga}
              style={{
                padding: '11px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: T.accent, color: '#fff', fontFamily: FONT, fontSize: 14, fontWeight: 800,
              }}
            >
              Guardar
            </button>
            <button
              type="button" onClick={() => { setLigaAbierta(false); setLigaTexto(''); setErr(''); }}
              style={{
                padding: '11px 14px', borderRadius: 10, cursor: 'pointer',
                border: `1.5px solid ${T.border}`, background: T.bg2, color: T.text2,
                fontFamily: FONT, fontSize: 14, fontWeight: 700,
              }}
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button" onClick={() => setLigaAbierta(true)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, alignSelf: 'flex-start',
              padding: '10px 13px', borderRadius: 10, cursor: 'pointer',
              border: `1.5px dashed ${T.borderHi}`, background: 'transparent', color: T.text2,
              fontFamily: FONT, fontSize: 13.5, fontWeight: 700,
            }}
          >
            <LinkIcon size={15} /> Pegar una liga (TikTok, YouTube, reel)
          </button>
        )}
      </div>

      {recortandoFoto && (
        <EditorFoto
          url={recortandoFoto.url}
          subiendo={ocupado}
          onCancelar={() => setRecortandoFoto(null)}
          onListo={(r) => recortarFoto(recortandoFoto, r)}
        />
      )}

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
