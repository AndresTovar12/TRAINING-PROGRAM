/**
 * Botón de "Subir archivo" para foto o video de un ejercicio.
 *
 * Vive aparte porque lo usan dos pantallas: el repertorio (crear/editar un
 * ejercicio) y el editor de sesión (crear un ejercicio al vuelo). Tenerlo
 * duplicado significaba que un arreglo —el aviso de foto chica, la barra de
 * avance— solo llegaba a una de las dos.
 */
import { useRef, useState } from 'react';
import { Upload, Loader2, X, Video, Camera, Images } from 'lucide-react';
import { uploadExerciseMedia } from '@/lib/api';
import { optimizaImagen, pesoTexto as pesoLegible } from '@/lib/imagen';
import EditorVideo from '@/features/admin/EditorVideo';
import EditorFoto from '@/features/admin/EditorFoto';
import { recortaImagen } from '@/features/admin/recorte';
import { useCoarsePointer } from '@/lib/useViewport';
import { T, FONT } from '@/lib/theme';

export default function MediaUpload({
  // `icon` lo siguen pasando los llamadores. Ya no se pinta —lo reemplazo la
  // miniatura— pero se acepta para no tener que tocar cada sitio que lo usa.
  label, icon: _icon, value, onChange, accept, kind, hint,
  onAjustes,
}) {
  // En el telefono se ofrecen DOS acciones distintas, y grabar va primero.
  //
  // Por que: un solo boton que dice "Subir archivo" con una flecha hacia arriba
  // se lee como "busca un archivo que ya tienes". El coach esta parado en el
  // gimnasio con el atleta enfrente; lo que quiere es grabar ahi mismo. El
  // atributo `capture` abre la camara directo, sin pasar por el carrete.
  //
  // En computadora no se muestra: `capture` no hace nada y un boton "Grabar"
  // que no graba es peor que no tenerlo.
  const enTelefono = useCoarsePointer();
  const esVideo = (accept || '').startsWith('video');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [avance, setAvance] = useState(0);
  const [archivo, setArchivo] = useState(null); // { nombre, mb }
  const [aviso, setAviso] = useState(null);     // { texto, detalle }
  const [ahorro, setAhorro] = useState(null);   // { antes, despues }
  const inputRef = useRef(null);      // elegir de la galeria
  const camaraRef = useRef(null);     // grabar / tomar en el momento
  // Elegidos y todavia SIN subir, esperando a que pasen por su editor.
  const [porRevisar, setPorRevisar] = useState(null);
  const [fotoPorRevisar, setFotoPorRevisar] = useState(null);

  async function onPick(e) {
    const elegido = e.target.files?.[0];
    if (!elegido) return;
    setErr('');
    setAviso(null);
    setAhorro(null);
    setAvance(0);

    /* UN VIDEO NO SE SUBE DE GOLPE: primero se abre el editor, como en
       WhatsApp. Andrés: "tengo que seleccionar el video, luego que aparezca en
       el editor, y ya subirlo".

       Además de que es el orden que espera, ahorra trabajo de verdad: decides
       el recorte mirando el video entero, y si te arrepientes no gastaste la
       subida. Las miniaturas salen al instante porque el archivo está aquí, no
       en Cloudflare. */
    if ((accept || '').startsWith('video')) {
      setPorRevisar(elegido);
      if (inputRef.current) inputRef.current.value = '';
      if (camaraRef.current) camaraRef.current.value = '';
      return;
    }

    /* UNA FOTO TAMPOCO SE SUBE DE GOLPE: también pasa por su editor.
       Andrés: "también para las fotos de portada se debería poder hacer algún
       recorte o algo así". Y le hace más falta que al video: una foto del
       carrete sale apaisada y la portada es un recuadro, así que sin recortar
       decide el navegador qué mitad tira — y suele tirar a la persona. */
    setFotoPorRevisar(elegido);
    if (inputRef.current) inputRef.current.value = '';
    if (camaraRef.current) camaraRef.current.value = '';
  }

  /* Sube la foto que ya pasó por el editor, cortada de verdad.
     Recortar primero y encoger después no es el mismo resultado que al revés:
     así el límite de tamaño se aplica a lo que queda, no a lo que se tiró. */
  async function subeLaFoto({ encuadre }) {
    setBusy(true);
    setErr('');
    setAvance(0);
    try {
      const cortada = await recortaImagen(fotoPorRevisar, encuadre);
      // Se encoge y reencoda ANTES de salir del teléfono: una foto de 12
      // megapíxeles para un recuadro de 116 px es gastar datos de todos.
      const { archivo: file, aviso: texto, detalle } = await optimizaImagen(cortada);
      if (texto) setAviso({ texto, detalle });
      if (file.size < fotoPorRevisar.size) setAhorro({ antes: fotoPorRevisar.size, despues: file.size });
      setArchivo({ nombre: file.name, mb: Math.round((file.size / 1048576) * 10) / 10 });

      const url = await uploadExerciseMedia(file, kind, setAvance);
      onChange(url);
      // Quien lleva una lista necesita la url en el momento, no esperar a que
      // el estado se actualice para leerla por separado: eso es una carrera
      // perdida.
      onAjustes?.({ url });
      setFotoPorRevisar(null);
      setArchivo(null);
    } catch (e2) {
      setErr(e2.message || 'Error al subir');
    } finally {
      setBusy(false);
    }
  }

  /* Sube el video que ya pasó por el editor, con todo lo que se decidió ahí:
     el tramo, el encuadre, si va con audio, y —cuando aplica— para quién es y
     desde qué ángulo. Nada de eso toca el archivo: se guarda al lado. */
  async function subeElVideo(ajustes) {
    setBusy(true);
    setErr('');
    setAvance(0);
    setArchivo({ nombre: porRevisar.name, mb: Math.round((porRevisar.size / 1048576) * 10) / 10 });
    try {
      const url = await uploadExerciseMedia(porRevisar, kind, setAvance);
      onChange(url);
      // La url va junto a los ajustes: quien guarda una fila entera los
      // necesita a la vez, y esperar a que el estado se actualice para
      // leerla por separado es una carrera perdida.
      onAjustes?.({ ...ajustes, url });
      setPorRevisar(null);
      setArchivo(null);
    } catch (e2) {
      setErr(e2.message || 'Error al subir');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {porRevisar && (
        <EditorVideo
          archivo={porRevisar}
          tamaño={porRevisar.size}
          subiendo={busy}
          avance={avance}
          onCancelar={() => { if (!busy) setPorRevisar(null); }}
          onListo={subeElVideo}
        />
      )}
      {fotoPorRevisar && (
        <EditorFoto
          archivo={fotoPorRevisar}
          subiendo={busy}
          avance={avance}
          onCancelar={() => { if (!busy) setFotoPorRevisar(null); }}
          onListo={subeLaFoto}
        />
      )}
      <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>{label}</span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {enTelefono ? (
          <>
            <button
              type="button"
              onClick={() => camaraRef.current?.click()}
              disabled={busy}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7, minHeight: 44,
                padding: '0 16px', borderRadius: 11, border: 'none',
                background: busy ? T.bg3 : T.accent, color: busy ? T.text3 : '#fff',
                cursor: busy ? 'default' : 'pointer',
                fontFamily: FONT, fontSize: 13.5, fontWeight: 800, whiteSpace: 'nowrap',
              }}
            >
              {busy ? <Loader2 size={15} className="spin" />
                : esVideo ? <Video size={16} /> : <Camera size={16} />}
              {busy ? 'Subiendo…' : esVideo ? 'Grabar ahora' : 'Tomar foto'}
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 44,
                padding: '0 14px', borderRadius: 11, border: `1.5px solid ${T.border}`,
                background: T.bg2, cursor: busy ? 'default' : 'pointer',
                fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: T.text2, whiteSpace: 'nowrap',
              }}
            >
              <Images size={15} /> {esVideo ? 'Del carrete' : 'De mis fotos'}
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={busy}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 14px',
              borderRadius: 11, border: `1.5px solid ${T.border}`, background: T.bg2, cursor: 'pointer',
              fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: T.text, whiteSpace: 'nowrap',
            }}
          >
            {busy ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
            {busy ? 'Subiendo…' : 'Subir archivo'}
          </button>
        )}
        {value && (
          <button
            type="button"
            onClick={() => onChange('')}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5, padding: '10px 12px',
              borderRadius: 11, border: 'none', background: 'rgba(220,38,38,0.08)', cursor: 'pointer',
              fontFamily: FONT, fontSize: 13, fontWeight: 700, color: T.danger,
            }}
          >
            <X size={14} /> Quitar
          </button>
        )}
      </div>
      <input ref={inputRef} type="file" accept={accept} onChange={onPick} style={{ display: 'none' }} />
      {/* `capture` es lo que hace que el telefono abra la camara en vez del
          carrete. Va en un input APARTE y no como atributo condicional del de
          arriba: cambiarlo por estado no alcanzaria a aplicarse antes del clic. */}
      <input ref={camaraRef} type="file" accept={accept} capture="environment" onChange={onPick} style={{ display: 'none' }} />
      {hint && <div style={{ fontSize: 11.5, color: T.text3 }}>{hint}</div>}

      {/* Mientras sube: nombre, peso y avance real. Antes solo giraba una
          ruedita de 15px dentro del boton, y un video de 80 MB por datos
          moviles se veia igual que si la app no hubiera hecho nada. */}
      {busy && archivo && (
        <div style={{ background: T.bg, border: `1px solid ${T.border}`, borderRadius: 11, padding: '10px 12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12.5, fontWeight: 700, color: T.text }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{archivo.nombre}</span>
            <span style={{ flexShrink: 0, color: T.accent }}>{avance}%</span>
          </div>
          <div style={{ height: 6, borderRadius: 999, background: T.bg3, marginTop: 8, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${avance}%`, background: T.accent, borderRadius: 999, transition: 'width .2s' }} />
          </div>
          <div style={{ fontSize: 11.5, color: T.text3, marginTop: 6, fontWeight: 600 }}>
            {archivo.mb} MB · no cierres esta pantalla
          </div>
        </div>
      )}

      {/* Foto demasiado chica. No es un error —se sube igual— pero hay que
          decirlo ANTES de que la vea borrosa en el telefono y no sepa por que. */}
      {aviso && !busy && (
        <div style={{
          background: 'rgba(224,123,0,0.10)', color: '#8A4B00', borderRadius: 11,
          padding: '10px 12px', fontSize: 12.5, fontWeight: 600, lineHeight: 1.45,
        }}>
          <div style={{ fontWeight: 800 }}>{aviso.texto}</div>
          {aviso.detalle && <div style={{ marginTop: 3 }}>{aviso.detalle}</div>}
        </div>
      )}

      {ahorro && !busy && !err && (
        <div style={{ fontSize: 11.5, color: T.text3, fontWeight: 600 }}>
          Optimizada: {pesoLegible(ahorro.antes)} → {pesoLegible(ahorro.despues)}
        </div>
      )}

      {/* El error va en caja roja, no en una linea de 12px que se pierde. */}
      {err && (
        <div style={{
          background: 'rgba(220,38,38,0.08)', color: T.danger, borderRadius: 11,
          padding: '10px 12px', fontSize: 12.5, fontWeight: 600, lineHeight: 1.45,
        }}>
          {err}
        </div>
      )}
      {/* Una miniatura de lo que hay, no la dirección.
          Andrés: "eso se ve muy feo, no es necesario que lo pongas, mejor una
          foto chiquita del video seleccionado". Tiene razón: una URL de
          Cloudflare de cuatro renglones no le dice nada a nadie —no se puede
          leer ni comprobar de un vistazo— y una miniatura contesta de golpe la
          única pregunta que importa: ¿es este el archivo correcto? */}
      {value && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 54, height: 54, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
            background: '#0E1015', display: 'grid', placeItems: 'center',
          }}>
            {esVideo ? (
              <video
                src={value} muted playsInline preload="metadata" tabIndex={-1} aria-hidden="true"
                onLoadedMetadata={(e) => { e.currentTarget.currentTime = 0.1; }}
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <img src={value} alt=""
                style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
            )}
          </span>
          <span style={{ fontSize: 12.5, color: T.text2, fontWeight: 600, minWidth: 0 }}>
            {esVideo ? 'Video guardado' : 'Foto guardada'}
          </span>
        </div>
      )}
    </div>
  );
}
