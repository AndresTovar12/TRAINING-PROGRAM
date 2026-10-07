/**
 * Botón de "Subir archivo" para foto o video de un ejercicio.
 *
 * Vive aparte porque lo usan dos pantallas: el repertorio (crear/editar un
 * ejercicio) y el editor de sesión (crear un ejercicio al vuelo). Tenerlo
 * duplicado significaba que un arreglo —el aviso de foto chica, la barra de
 * avance— solo llegaba a una de las dos.
 */
import { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Upload, Loader2, X, Video, Camera, Images } from 'lucide-react';
import IconoExplicacion from '@/components/IconoExplicacion';
import { uploadExerciseMedia } from '@/lib/api';
import { subeFotos, guardaPoster } from '@/lib/posters';
import { segundos } from '@/lib/fotogramas';
import { aImagenWeb, optimizaImagen, pesoTexto as pesoLegible } from '@/lib/imagen';
import EditorVideo from '@/features/admin/EditorVideo';
import EditorFoto from '@/features/admin/EditorFoto';
import GrabadoraDeVideo from '@/features/admin/GrabadoraDeVideo';
import { recortaImagen } from '@/features/admin/recorte';
import { useCoarsePointer } from '@/lib/useViewport';
import Portada from '@/components/Portada';
import { T, FONT } from '@/lib/theme';

export default function MediaUpload({
  // `icon` lo siguen pasando los llamadores. Ya no se pinta —lo reemplazo la
  // miniatura— pero se acepta para no tener que tocar cada sitio que lo usa.
  label, icon: _icon, value, onChange, accept, kind, hint,
  onAjustes,
  /* QUÉ ES EL VIDEO (ver `lib/proposito.js`). `proposito` lo trae decidido el botón que se tocó («Grabar ejemplo» /
     «Grabar explicación»): el editor lo muestra y se puede corregir. `preguntaProposito` es para los caminos donde nadie
     lo ha dicho (un video del carrete, una liga): antes del editor sale «¿Qué es este video?». Sin ninguna de las dos
     (pantallas que no distinguen), el video no lleva propósito y queda como ejemplo. Una foto nunca pregunta. */
  proposito, preguntaProposito = false,
  /* Dibuja TÚ los botones y quédate con lo de aquí dentro.
     La pantalla de crear un ejercicio necesita un botón de grabar enorme —el
     coach está en el gimnasio, cansado, con el tripié puesto— y los dos
     botones de siempre no sirven para eso. Duplicar el componente sí que no:
     este archivo existe justamente porque estaba duplicado y los arreglos
     llegaban a una copia y no a la otra. Con esto, el que llama pone la forma
     y aquí se queda todo lo que cuesta: el editor, la barra de avance, la
     optimización de la foto y los avisos. */
  botones,
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
  /* Este botón puede aceptar foto, video, o las dos cosas.
     "Las dos" es lo que usa la pantalla del ejercicio, y no es un capricho:
     antes cada grupo (Todos / Hombres / Mujeres) desplegaba cuatro botones
     —tomar foto, del carrete, grabar, del carrete— o sea los mismos cuatro
     repetidos tres veces. Andrés: "el video y la portada se repite en los tres
     botones, eso no me gusta". Aceptando las dos cosas quedan dos botones, y
     de qué tipo es el archivo lo dice el archivo, no un botón. */
  const aceptaVideo = (accept || '').includes('video');
  const aceptaFoto = (accept || '').includes('image');
  const mixto = aceptaVideo && aceptaFoto;
  const esVideo = aceptaVideo && !aceptaFoto;
  const [busy, setBusy] = useState(false);
  /* `busy` también vale mientras se prepara la foto (un HEIC tarda unos segundos en pasar a JPG): los botones se
     apagan igual, y solo cambia lo que dicen. */
  const [preparando, setPreparando] = useState(false);
  const textoOcupado = preparando ? 'Preparando…' : 'Subiendo…';
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
  // Un video del carrete que espera a que se diga qué es, y lo que se contestó.
  const [preguntando, setPreguntando] = useState(null);
  const [queEs, setQueEs] = useState('ejemplo');
  const conProposito = proposito !== undefined || preguntaProposito;
  /* La cámara de la app. Solo para video: el atajo del navegador graba con
     calidad recortada y no hay forma de pedirle otra. Ver `GrabadoraDeVideo`. */
  const [grabadora, setGrabadora] = useState(false);

  /* "Grabar" abre la cámara de la app cuando se puede, y si no, el atajo de
     siempre. Para FOTO se queda el atajo: ahí la calidad no es el problema y
     una cámara propia solo añadiría formas de fallar. */
  const puedeGrabarAqui = aceptaVideo && !aceptaFoto
    && typeof navigator !== 'undefined' && !!navigator.mediaDevices?.getUserMedia;

  function abreLaCamara() {
    if (puedeGrabarAqui) setGrabadora(true);
    else camaraRef.current?.click();
  }

  function onPick(e) {
    tomaArchivo(e.target.files?.[0]);
  }

  /* El archivo, venga de donde venga: del carrete, de la cámara, o soltado
     encima. Antes esto vivía dentro de `onPick` y solo sabía leer un evento de
     <input>, así que arrastrar un video desde la compu no tenía por dónde
     entrar aunque la pantalla lo ofreciera. */
  async function tomaArchivo(elegido) {
    if (!elegido || preparando) return;
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
    if ((elegido.type || '').startsWith('video')) {
      if (preguntaProposito) {
        setPreguntando(elegido);
      } else {
        setQueEs(proposito === 'explicacion' ? 'explicacion' : 'ejemplo');
        setPorRevisar(elegido);
      }
      if (inputRef.current) inputRef.current.value = '';
      if (camaraRef.current) camaraRef.current.value = '';
      return;
    }

    /* UNA FOTO TAMPOCO SE SUBE DE GOLPE: también pasa por su editor.
       Andrés: "también para las fotos de portada se debería poder hacer algún
       recorte o algo así". Y le hace más falta que al video: una foto del
       carrete sale apaisada y la portada es un recuadro, así que sin recortar
       decide el navegador qué mitad tira — y suele tirar a la persona.

       Y el editor necesita una foto que el navegador sepa dibujar. Un HEIC (las
       fotos del iPhone sueltas) Chrome no lo abre: se pasa a JPG ANTES, aquí, y
       si no se puede leer el aviso sale ya, no después de abrir un editor vacío.
       Andrés: «me rechaza las HEIC». Una foto que ya viene en JPG, PNG o WebP
       pasa sin esperar. */
    setBusy(true);
    setPreparando(true);
    try {
      setFotoPorRevisar(await aImagenWeb(elegido));
    } catch (e2) {
      setErr(e2.message || 'No se pudo abrir esa foto.');
    } finally {
      setBusy(false);
      setPreparando(false);
    }
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

      const url = await uploadExerciseMedia(file, mixto ? 'covers' : kind, setAvance);
      onChange(url);
      // Quien lleva una lista necesita la url en el momento, no esperar a que
      // el estado se actualice para leerla por separado: eso es una carrera
      // perdida.
      onAjustes?.({ url, tipo: 'foto' });
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
  async function subeElVideo(todosLosAjustes) {
    // `fotogramas` es la promesa de la foto del video (ver `EditorVideo`); no
    // es un ajuste: no debe viajar a quien guarda la fila.
    const { fotogramas, ...ajustes } = todosLosAjustes;
    setBusy(true);
    setErr('');
    setAvance(0);
    setArchivo({ nombre: porRevisar.name, mb: Math.round((porRevisar.size / 1048576) * 10) / 10 });
    try {
      // Las fotos se preparan y suben A LA VEZ que el video, que tarda mucho más:
      // cuando el video termina, normalmente ya están. Nunca fallan (null si algo sale mal).
      const fotosListas = Promise.resolve(fotogramas).then(subeFotos);
      const url = await uploadExerciseMedia(porRevisar, mixto ? 'videos' : kind, setAvance);
      // La foto, ya con la dirección del video, ANTES de avisar que hay video:
      // así cuando aparece en la lista ya trae su foto y no pasa por el video
      // congelado. Hasta 5 s de gracia; sin ella el video se ve como siempre, y
      // no vale la pena hacer esperar más por una foto.
      const datos = await Promise.race([fotosListas, new Promise((ok) => { setTimeout(() => ok(null), 5000); })]);
      // Con el recorte que tenía al sacar la foto: si después lo recorta distinto, se sabe que la foto quedó vieja.
      if (datos) await guardaPoster(url, { ...datos, desde: segundos(ajustes.inicio), hasta: segundos(ajustes.fin) }).catch(() => {});
      onChange(url);
      // La url va junto a los ajustes: quien guarda una fila entera los
      // necesita a la vez, y esperar a que el estado se actualice para
      // leerla por separado es una carrera perdida.
      onAjustes?.({ ...ajustes, url, tipo: 'video' });
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
      {preguntando && (
        <PreguntaDeVideo
          nombre={preguntando.name}
          onElige={(que) => { setQueEs(que); setPorRevisar(preguntando); setPreguntando(null); }}
          onCancelar={() => setPreguntando(null)}
        />
      )}
      {porRevisar && (
        <EditorVideo
          archivo={porRevisar}
          tamaño={porRevisar.size}
          proposito={conProposito ? queEs : undefined}
          subiendo={busy}
          avance={avance}
          onCancelar={() => { if (!busy) setPorRevisar(null); }}
          onListo={subeElVideo}
        />
      )}
      {grabadora && (
        <GrabadoraDeVideo
          onListo={(file) => { setGrabadora(false); tomaArchivo(file); }}
          onCancelar={() => setGrabadora(false)}
          /* Sin cámara propia no se deja al coach sin grabar: se cae al atajo
             del navegador, que da peor calidad pero graba. */
          onSinCamara={(motivo) => {
            setGrabadora(false);
            if (motivo) setErr(`${motivo} Se abrirá la cámara del teléfono.`);
            camaraRef.current?.click();
          }}
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
      {label && !botones && (
        <span style={{ fontSize: 12.5, fontWeight: 700, color: T.text2 }}>{label}</span>
      )}
      {/* El linter marca aquí "no accedas a refs al dibujar". No se accede: lo
          que viaja son dos funciones, y la ref se lee cuando alguien las llama,
          que es siempre dentro de un onClick. Los botones de abajo hacen
          exactamente lo mismo y no se marcan solo porque están escritos en su
          sitio en vez de pasarse por una prop. */}
      {/* eslint-disable-next-line react-hooks/refs */}
      {botones ? botones({
        camara: abreLaCamara,
        carrete: () => inputRef.current?.click(),
        suelta: tomaArchivo,
        busy,
        preparando,
        enTelefono,
      }) : (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {enTelefono ? (
          <>
            <button
              type="button"
              onClick={abreLaCamara}
              disabled={busy}
              style={{
                /* `flex: 1` y no ancho automático: con el ancho natural,
                   "Tomar foto" + "De mis fotos" suman más que el ancho de un
                   teléfono y se apilaban de cuatro en cuatro, ocupando media
                   pantalla. Repartiéndose el renglón caben siempre. */
                flex: 1, minWidth: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                gap: 6, minHeight: 44, padding: '0 10px', borderRadius: 11, border: 'none',
                background: busy ? T.bg3 : T.accent, color: busy ? T.text3 : '#fff',
                cursor: busy ? 'default' : 'pointer',
                fontFamily: FONT, fontSize: 13, fontWeight: 800, whiteSpace: 'nowrap',
              }}
            >
              {busy ? <Loader2 size={15} className="spin" />
                : esVideo ? <Video size={16} /> : <Camera size={16} />}
              {busy ? textoOcupado : mixto ? 'Cámara' : esVideo ? 'Grabar ahora' : 'Tomar foto'}
            </button>
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
              style={{
                flex: 1, minWidth: 0,
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                gap: 6, minHeight: 44, padding: '0 10px', borderRadius: 11,
                border: `1.5px solid ${T.border}`,
                background: T.bg2, cursor: busy ? 'default' : 'pointer',
                fontFamily: FONT, fontSize: 13, fontWeight: 700, color: T.text2, whiteSpace: 'nowrap',
              }}
            >
              <Images size={15} /> {mixto ? 'Del carrete' : esVideo ? 'Del carrete' : 'De mis fotos'}
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
            {/* En computadora la flecha hacia arriba y "Subir archivo" están
                bien: ahí sí se busca un archivo que ya existe. Lo que fallaba
                era no decir QUÉ archivo — Andrés: "esto del screenshot no se
                entiende". El tipo iba en un renglón aparte, debajo. */}
            {busy ? <Loader2 size={15} className="spin" /> : <Upload size={15} />}
            {busy ? textoOcupado : mixto ? 'Elegir foto o video' : esVideo ? 'Elegir video' : 'Elegir foto'}
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
      )}
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
      {value && !botones && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{
            width: 54, height: 54, borderRadius: 10, overflow: 'hidden', flexShrink: 0,
            background: '#0E1015', display: 'grid', placeItems: 'center',
          }}>
            {esVideo ? (
              // El fotograma de la mitad, como la portada (ver `Portada`).
              <Portada video={value} style={{ width: '100%', height: '100%' }} />
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

/**
 * «¿Qué es este video?»: solo cuando el video viene del carrete o de una liga y nadie lo ha dicho (Andrés, 7 oct 2026: «me
 * gustaría que empezaras a tener más awareness de cuándo es mejor agregar clics»). Dos botones IGUALES: no hay una respuesta
 * «normal» a la que empujar. Al grabar NO sale: el botón que se tocó ya contestó.
 */
export function PreguntaDeVideo({ nombre, onElige, onCancelar }) {
  const opciones = [
    { id: 'ejemplo', texto: 'Ejemplo', Icono: Video },
    { id: 'explicacion', texto: 'Explicación', Icono: IconoExplicacion },
  ];
  return createPortal((
    <div
      onClick={(e) => { if (e.target === e.currentTarget) onCancelar(); }}
      style={{
        position: 'fixed', inset: 0, zIndex: 6000, background: 'rgba(17,19,24,0.55)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', padding: 16, fontFamily: FONT,
      }}
    >
      <div role="dialog" aria-label="¿Qué es este video?" style={{ width: '100%', maxWidth: 340, background: T.bg2, borderRadius: 22, padding: 16, boxShadow: '0 24px 60px rgba(17,19,24,0.35)' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: T.text }}>¿Qué es este video?</div>
        {nombre && (
          <div style={{ fontSize: 12.5, fontWeight: 600, color: T.text3, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {nombre}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
          {opciones.map(({ id, texto, Icono }) => (
            <button
              key={id} type="button" onClick={() => onElige(id)} className="kp-press"
              style={{
                minHeight: 84, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7,
                borderRadius: 16, border: `1.5px solid ${T.border}`, background: T.bg2, cursor: 'pointer', fontFamily: FONT,
                color: T.text, touchAction: 'manipulation',
              }}
            >
              <span style={{ width: 40, height: 40, borderRadius: 13, display: 'grid', placeItems: 'center', background: T.accentBg, color: T.accent }}>
                <Icono size={20} />
              </span>
              <span style={{ fontSize: 14.5, fontWeight: 800 }}>{texto}</span>
            </button>
          ))}
        </div>
        <button
          type="button" onClick={onCancelar}
          style={{ display: 'block', margin: '10px auto 0', border: 'none', background: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 13.5, fontWeight: 700, color: T.text2, padding: '6px 10px' }}
        >
          Cancelar
        </button>
      </div>
    </div>
  ), document.body);
}
