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
 *
 * LO DEL 7 OCT 2026 (PDF «Detalles que arreglar»).
 *   · Las tres cards de «Todos / Hombres / Mujeres» eran GIGANTES, más grandes que lo importante (grabar). Andrés: «no quiero
 *     que los quites porque sí son muy importantes pero los pusiste demasiado grandes»: ahora son una fila delgada, y los
 *     botones de grabar van abajo, grandes.
 *   · Se fueron las letritas grises («viendo todos», «Lo verá quien…», «Nada para todos todavía», «Agregar para todos»).
 *   · Cada video es un EJEMPLO o una EXPLICACIÓN (`lib/proposito.js`): lo dice el botón de grabar que se tocó, y la pastilla del
 *     video en la lista lo corrige. El video «de siempre» del ejercicio (las columnas) solo guarda ejemplos; una explicación
 *     es siempre su propia fila, y al cambiar uno de tipo se mueve de un lado al otro.
 *   · `compacto`: solo la lista (la pantalla «Editar ejercicio» enseña lo que ya tiene al final y manda a «Grabar o subir»).
 */
import { useEffect, useState } from 'react';
import {
  Trash2, Loader2, Scissors, Users, Mars, Venus, Link as LinkIcon, RefreshCw, ChevronDown,
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
import { DosBotonesDeGrabar, FilaDeTres, PanelDeLiga, PastillaDeProposito, SelectorDeProposito } from '@/features/admin/AgregarMedia';
import IconoExplicacion from '@/components/IconoExplicacion';
import { T, FONT } from '@/lib/theme';
import { avisoDeLiga, ligaExterna } from '@/lib/videos';
import { EJEMPLO, EXPLICACION, esExplicacion } from '@/lib/proposito';
import Portada from '@/components/Portada';

const GRUPOS = [
  { g: '', et: 'Para todos', corto: 'Todos', Icono: Users },
  { g: 'h', et: 'Hombres', corto: 'Hombres', Icono: Mars },
  { g: 'm', et: 'Mujeres', corto: 'Mujeres', Icono: Venus },
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
function Miniatura({ url, esVideo, desde, hasta, explicacion = false }) {
  return (
    <span style={{
      position: 'relative', width: 44, height: 44, borderRadius: 9, overflow: 'hidden', flexShrink: 0,
      background: '#0E1015', display: 'grid', placeItems: 'center',
    }}>
      {explicacion && (
        <span aria-hidden="true" style={{
          position: 'absolute', right: 3, bottom: 3, zIndex: 1, width: 18, height: 18, borderRadius: 6, background: '#fff',
          color: T.accent, display: 'grid', placeItems: 'center',
        }}>
          <IconoExplicacion size={12} />
        </span>
      )}
      {/* Una liga de TikTok o YouTube no da fotograma: el <video> no la puede
          leer y el recuadro se queda negro. Se pone el icono de liga. */}
      {ligaExterna(url) ? (
        <LinkIcon size={18} color="#8A93A3" />
      ) : esVideo ? (
        /* El fotograma de la MITAD, igual que la portada del ejercicio (ver
           `Portada`): con recorte, la mitad de lo que ve el atleta. */
        <Portada video={url} desde={desde} hasta={hasta} style={{ width: '100%', height: '100%' }} />
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
  // Solo la lista de lo que ya tiene, sin botones de grabar (ver arriba).
  compacto = false,
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
  const [cambiandoTipo, setCambiandoTipo] = useState(null);   // video al que se le cambia de «ejemplo» a «explicación»

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
  async function guardaLiga(texto, proposito) {
    const aviso = avisoDeLiga(texto);
    if (aviso) { setErr(aviso); return; }
    try {
      const fila = await addExerciseMedia({
        exerciseId, url: texto, tipo: 'video', genero: grupo || null, proposito,
        inicio: null, fin: null, sinAudio: false, encuadre: null,
      });
      setLista((prev) => [...prev, fila]);
      setLigaAbierta(false);
      setErr('');
    } catch (e) {
      setErr(e.message || 'No se pudo guardar la liga.');
    }
  }

  async function agregar(destino, { url: subida, tipo, inicio, fin, sinAudio, encuadre, proposito }) {
    if (!subida) { setErr('No se pudo subir el archivo.'); return; }
    setErr('');

    // Una explicación nunca vive en las columnas del ejercicio (solo guardan ejemplos): es siempre su propia fila.
    const explicacion = tipo === 'video' && proposito === EXPLICACION;
    if (destino === '' && tipo === 'foto' && !portada) { onPortada?.(subida); return; }
    if (destino === '' && tipo === 'video' && !explicacion && !principal) {
      onPrincipal?.(subida);
      onRecortePrincipal?.({ inicio, fin, sinAudio, encuadre });
      return;
    }
    try {
      const fila = await addExerciseMedia({
        exerciseId, url: subida, tipo, genero: destino || null, inicio, fin, sinAudio, encuadre,
        proposito: explicacion ? EXPLICACION : EJEMPLO,
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

  /* CAMBIAR UN VIDEO DE «EJEMPLO» A «EXPLICACIÓN» Y AL REVÉS.
     Andrés, 7 oct 2026: «si el coach se confundió de botón y ya lo grabó debe tener alguna forma de cambiar». Las columnas del
     ejercicio solo guardan ejemplos (media app las lee directo: portada, insignia de «tiene video»), así que:
       · un ejemplo que vive en las columnas y pasa a explicación se MUEVE a su propia fila (y la columna se vacía);
       · una explicación «para todos» que pasa a ejemplo, si la columna está libre, VUELVE a ella;
       · lo demás (por género, de una liga, o con la columna ocupada) solo cambia su fila.
     Las dos mitades de un movimiento se guardan EN EL MOMENTO, igual que en `mover`: si solo se guardara una, cancelar el
     formulario dejaría el video duplicado o perdido. */
  async function cambiarProposito(item, nuevo) {
    setCambiandoTipo(null);
    if ((item.proposito || EJEMPLO) === nuevo) return;
    setErr('');
    try {
      if (item.columna && nuevo === EXPLICACION) {
        const fila = await addExerciseMedia({
          exerciseId, url: item.url, tipo: 'video', genero: null, proposito: EXPLICACION,
          inicio: item.recorte_inicio, fin: item.recorte_fin, sinAudio: item.sin_audio, encuadre: item.encuadre,
        });
        await updateExercise(exerciseId, { video_url: null, recorte_inicio: null, recorte_fin: null, sin_audio: false, encuadre: null });
        setLista((prev) => [...prev, fila]);
        onPrincipal?.('');
        return;
      }
      if (!item.columna && nuevo === EJEMPLO && item.tipo === 'video' && !item.genero && !principal && !ligaExterna(item.url)) {
        await updateExercise(exerciseId, {
          video_url: item.url, recorte_inicio: item.recorte_inicio ?? null, recorte_fin: item.recorte_fin ?? null,
          sin_audio: !!item.sin_audio, encuadre: item.encuadre ?? null,
        });
        await deleteExerciseMedia(item.id);
        setLista((prev) => prev.filter((m) => m.id !== item.id));
        onPrincipal?.(item.url);
        onRecortePrincipal?.({ inicio: item.recorte_inicio, fin: item.recorte_fin, sinAudio: item.sin_audio, encuadre: item.encuadre });
        return;
      }
      await cambiar(item.id, { proposito: nuevo });
    } catch (e) {
      setErr(e.message || 'No se pudo cambiar el tipo de video.');
    }
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
     marcados para saber cómo borrarlos y moverlos. El video de la columna es
     SIEMPRE un ejemplo. Dentro de cada grupo, las explicaciones primero (es el
     orden en que las ve el atleta). */
  const deColumna = [
    portada && {
      id: 'col-foto', columna: true, tipo: 'foto', url: portada, genero: null, proposito: EJEMPLO,
    },
    principal && {
      id: 'col-video', columna: true, tipo: 'video', url: principal, genero: null, proposito: EJEMPLO,
      ...(recortePrincipal ?? {}),
    },
  ].filter(Boolean);
  const orden = { '': 0, h: 1, m: 2 };
  const todos = [...deColumna, ...lista]
    .sort((a, b) => (orden[a.genero || ''] - orden[b.genero || '']) || (Number(esExplicacion(b)) - Number(esExplicacion(a))));

  /* EL GRUPO ELEGIDO FILTRA LA LISTA.
     Sin esto, tocar "Hombres" dejaba abajo la lista entera, y como el botón
     quedaba resaltado parecía que esos archivos estaban dentro de Hombres.
     Andrés: "subí un video en para todos pero le pico a hombre y a mujer, y el
     mismo video y la misma foto aparece en esos también".

     Tenía razón en que engaña, aunque el dato estuviera bien. El botón es a la
     vez dónde miras y dónde agregas; si resalta uno y abajo sigue todo, está
     diciendo dos cosas a la vez. En modo `compacto` (la pantalla de datos) se ve
     TODO lo que tiene el ejercicio, cada archivo con su pastilla de grupo. */
  const visibles = compacto ? todos : todos.filter((m) => (m.genero || '') === grupo);

  const pastillaDeGrupo = (suyo) => ({
    display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 26, padding: '0 9px 0 10px', borderRadius: 999, cursor: 'pointer',
    fontFamily: FONT, fontSize: 11.5, fontWeight: 700,
    border: `1px solid ${suyo ? T.accent : T.borderHi}`, background: suyo ? T.accentBg : T.bg2, color: suyo ? T.accent : T.text2,
  });

  const lista_ = visibles.map((m) => {
    const esVideo = m.tipo === 'video';
    const explicacion = esVideo && esExplicacion(m);
    const detalle = etiquetaAjustes(m);
    const suyo = m.genero || '';
    const grupoDelArchivo = GRUPOS.find((x) => x.g === suyo) ?? GRUPOS[0];
    return (
      <div key={m.id} style={{
        display: 'flex', flexDirection: 'column', gap: 8,
        background: T.bg2, border: `1px solid ${T.border}`, borderRadius: 12, padding: 8,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Miniatura url={m.url} esVideo={esVideo} desde={m.recorte_inicio} hasta={m.recorte_fin} explicacion={explicacion} />
          <div style={{ flex: 1, minWidth: 0 }}>
            {/* LAS TRES ACCIONES VAN EN LA LÍNEA DEL NOMBRE, no a un lado de todo. Al lado le quitaban ~110 px al renglón de las
                pastillas y en el celular «Todos ▾» y «Ejemplo ▾» no cabían juntas: cada archivo se partía en tres pisos. Arriba el
                nombre y las acciones, abajo las dos pastillas, que ya caben en una sola línea. */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <div style={{
                flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, fontWeight: 700, color: T.text,
                overflow: 'hidden', whiteSpace: 'nowrap',
              }}>
                {explicacion && <IconoExplicacion size={14} color={T.accent} />}
                {esVideo ? 'Video' : 'Foto'}
                {detalle && (
                  <span style={{ color: T.text3, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}> · {detalle}</span>
                )}
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
            {/* LAS PASTILLAS SON EL CONTROL de cambiar: se toca y se cambia. Un
                icono aparte para lo mismo era un botón de más por fila. */}
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 2 }}>
              <button
                type="button"
                onClick={() => { setMoviendo(moviendo === m.id ? null : m.id); setCambiandoTipo(null); }}
                aria-expanded={moviendo === m.id}
                style={pastillaDeGrupo(suyo)}
              >
                <grupoDelArchivo.Icono size={12} /> {grupoDelArchivo.corto} <ChevronDown size={11} />
              </button>
              {esVideo && (
                <PastillaDeProposito
                  valor={m.proposito} abierta={cambiandoTipo === m.id}
                  onToggle={() => { setCambiandoTipo(cambiandoTipo === m.id ? null : m.id); setMoviendo(null); }}
                />
              )}
            </div>
          </div>
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
                  {o.corto}
                </button>
              );
            })}
          </div>
        )}

        {cambiandoTipo === m.id && <SelectorDeProposito valor={m.proposito || EJEMPLO} onCambia={(p) => cambiarProposito(m, p)} />}
      </div>
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
      {/* Las tres opciones de siempre —Todos, Hombres, Mujeres—, ahora en UNA fila delgada: son importantes, pero no más
          que grabar. A quién va lo que subas lo dice el botón marcado, sin preguntar nada. */}
      {!compacto && (
        <>
          <div style={{ display: 'flex', gap: 6 }} role="group" aria-label="Para quién">
            {GRUPOS.map(({ g, corto, Icono }) => {
              const activo = grupo === g;
              return (
                <button
                  key={g || 'todos'} type="button"
                  onClick={() => { setGrupo(g); setMoviendo(null); setCambiandoTipo(null); }}
                  aria-pressed={activo}
                  style={{
                    flex: 1, minWidth: 0, minHeight: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                    borderRadius: 11, cursor: 'pointer', fontFamily: FONT, fontSize: 13, fontWeight: 700, touchAction: 'manipulation',
                    border: `1.5px solid ${activo ? T.accent : T.border}`, background: activo ? T.accentBg : T.bg2, color: activo ? T.accent : T.text2,
                  }}
                >
                  <Icono size={15} /> {corto}
                </button>
              );
            })}
          </div>

          <DosBotonesDeGrabar onAjustes={(a) => agregar(grupo, a)} />
          <FilaDeTres onAjustes={(a) => agregar(grupo, a)} onLiga={() => { setLigaAbierta(true); setErr(''); }} />
          {ligaAbierta && <PanelDeLiga onGuarda={guardaLiga} onCancela={() => { setLigaAbierta(false); setErr(''); }} error={err} />}
        </>
      )}

      {cargando ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, color: T.text3, fontSize: 12.5, fontWeight: 600 }}>
          <Loader2 size={14} className="spin" /> Cargando…
        </div>
      ) : visibles.length > 0 && (
        <>
          <span style={{ fontSize: 13, fontWeight: 700, color: T.text }}>{compacto ? 'Fotos y videos' : 'Lo que ya tiene'}</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{lista_}</div>
        </>
      )}

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

      {err && !ligaAbierta && (
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
