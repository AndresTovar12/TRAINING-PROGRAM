import { useMemo, useState } from 'react';
import { useConfirmacion } from '@/components/Confirmacion';
import { ImageIcon, Package, PlayCircle, StickyNote, Trash2, Upload, X } from 'lucide-react';
import MediaUpload from '@/features/admin/MediaUpload';
import { AccionesDeClase, HojaDeClase } from '@/features/admin/ClaseDeLaSesion';
import { CamposDeVideo, Extra, SetsDeEjercicios, Seccion, Segmentos } from '@/features/admin/EditorDeCorrer';
import { claseDe, duracionTexto, modoDeClase } from '@/lib/clases';
import { ligaExterna } from '@/lib/videos';
import { usePoster } from '@/lib/posters';
import { T, FONT, KP, UI } from '@/lib/theme';

/**
 * EL EDITOR DE CLASE (acordado con Andrés en imágenes, 20 nov 2026: «en Clase, lo primero es el video»).
 *
 * Quien más lo usa son coaches de pilates, cycling o yoga que suben una clase completa en video (Andrés, notas del 8 nov: «una coach de
 * pilates sube una clase de 45 minutos… que entienda enseguida que el formato es diferente»). Antes la sesión de Clase abría igual que Gym,
 * con «Agregar set», y el video se escondía en un botón chico. Ahora:
 *   · Sin video, la sesión abre pidiéndolo: Subir video · Pegar liga · De mis clases (las mismas tres de siempre).
 *   · Con video: su miniatura (o la portada que elija), lo que dura, «Cambiar video» y «Quitar».
 *   · «La clase, en orden»: Calentamiento · La clase · Enfriamiento, en una línea numerada (ver abajo). Calentamiento y enfriamiento son
 *     opcionales y discretos: muchas clases ya los traen en el video.
 *   · «Detalles de la clase», con el lenguaje de «Para toda la carrera» (Andrés pidió que se viera más bonito que dos casillas sueltas):
 *     Portada, Lo que necesita y Nota para el alumno.
 *   · Dos modalidades, elegidas arriba («Cómo es tu clase»): Un video completo, o Ejercicio por ejercicio (los Sets de siempre, debajo, en
 *     PlanBuilder). Andrés: «ejercicios es otra modalidad», no una opción más de la lista.
 *
 * Datos: el video en `day.clase` (ver `lib/clases.js`); lo demás en `day.claseExtra = { portada, necesita, nota, cal, calma }`, donde `cal` y
 * `calma` tienen la forma de un calentamiento de Running (`{ forma: 'video'|'ejercicios', video, items, q, u }`).
 */
/* OCULTAR «CALENTAMIENTO APARTE» Y «ENFRIAMIENTO APARTE» (Andrés, 20 nov 2026: «que se pueda borrar por si ya de plano el usuario no las
   quiere ver»). Es una preferencia del coach, no de una sesión: en la maqueta se guarda en este navegador; en la app real, en su perfil. */
const LLAVE_SIN_APARTE = 'tl-clase-sin-aparte';
const leeSinAparte = () => { try { return JSON.parse(localStorage.getItem(LLAVE_SIN_APARTE) ?? '{}') || {}; } catch { return {}; } };

export default function EditorDeClase({ day, onPatch, repertoire = [], categorias = [], onEjercicioCreado, atleta, soloLectura = false }) {
  const pregunta = useConfirmacion();
  const clase = claseDe(day);
  const extra = day.claseExtra ?? {};
  const modo = modoDeClase(day);
  const nEjercicios = (day.exercises ?? []).filter((e) => !e?.isNote).length;
  const [sinAparte, setSinAparte] = useState(leeSinAparte);
  const ocultaAparte = (k, oculto) => {
    const n = { ...sinAparte, [k]: oculto };
    setSinAparte(n);
    try { localStorage.setItem(LLAVE_SIN_APARTE, JSON.stringify(n)); } catch { /* sin espacio: solo por ahora */ }
  };
  /* LAS DOS MODALIDADES (Andrés, 20 nov 2026: «ejercicios es otra modalidad y tú lo haces parecer como que es una opción en conjunto»).
     Se elige arriba, una u otra. Cambiar con algo armado en la otra pregunta antes y lo quita, como al cambiar de Disciplina: nada queda
     guardado y escondido. */
  const cambiaModo = async (nuevo) => {
    if (nuevo === modo) return;
    if (nuevo === 'ejercicios' && clase) {
      if (!await pregunta({ titulo: '¿Armarla ejercicio por ejercicio?', detalle: 'Se quita el video de la clase y su calentamiento y enfriamiento aparte.', confirmar: 'Cambiar', peligro: true })) return;
      onPatch({ claseModo: nuevo, clase: undefined, claseExtra: { ...extra, cal: undefined, calma: undefined } });
      return;
    }
    if (nuevo === 'video' && nEjercicios) {
      if (!await pregunta({ titulo: '¿Cambiar a un video?', detalle: `${nEjercicios === 1 ? 'El ejercicio' : `Los ${nEjercicios} ejercicios`} de esta clase se ${nEjercicios === 1 ? 'borra' : 'borran'}.`, confirmar: 'Cambiar', peligro: true })) return;
      onPatch({ claseModo: nuevo, exercises: [] });
      return;
    }
    onPatch({ claseModo: nuevo });
  };
  const [cambiando, setCambiando] = useState(false);
  const [abiertos, setAbiertos] = useState({});
  const ver = (k, hay) => hay || abiertos[k];
  const abre = (k) => setAbiertos((a) => ({ ...a, [k]: true }));
  const ponExtra = (c) => onPatch({ claseExtra: { ...extra, ...c } });
  const cierra = (k, c) => { setAbiertos((a) => ({ ...a, [k]: false })); ponExtra(c); };
  const calentamientos = useMemo(() => (repertoire ?? []).filter((e) => !!e?.guiado), [repertoire]);
  const nombreAtleta = (atleta?.full_name || atleta?.username || '').split(' ')[0];

  const parte = (k) => {
    const t = extra[k] ?? { forma: 'video' };
    const pon = (c) => ponExtra({ [k]: { ...t, ...c } });
    return (
      <>
        <div style={{ display: 'flex', maxWidth: 300, marginBottom: 12 }}>
          <Segmentos opciones={[['video', 'Guiado'], ['ejercicios', 'Ejercicios']]} valor={t.forma ?? 'video'} etiqueta={k === 'cal' ? 'Cómo calienta' : 'Cómo enfría'} onCambio={(forma) => pon({ forma, items: t.items ?? [] })} />
        </div>
        {(t.forma ?? 'video') === 'video'
          ? <CamposDeVideo t={{ q: '', u: 'min', ...t }} calentamientos={calentamientos} categorias={categorias} nombreAtleta={nombreAtleta} onEjercicioCreado={onEjercicioCreado} onCambio={pon} />
          : <SetsDeEjercicios t={{ id: k, ...t }} de={k === 'cal' ? 'el calentamiento' : 'el enfriamiento'} repertoire={repertoire} onEjercicioCreado={onEjercicioCreado} onCambio={(c) => pon(c)} />}
      </>
    );
  };

  /* LA CLASE, EN ORDEN (Andrés, 20 nov 2026: «no me encanta que el calentamiento lo agregas después»; revisado con usability-psychologist).
     La pantalla sigue el orden en que el alumno la hace: Calentamiento · La clase · Enfriamiento, en la línea numerada de «El entreno, en
     orden» de Running. Muchas clases ya traen el calentamiento dentro del video (Andrés: «solo es por si no»), así que su lugar es discreto:
     «+ Calentamiento aparte · Solo si tu video no lo trae». Lo que es información (portada, lo que necesita, nota) va aparte, en «Detalles». */
  const conCal = ver('cal', !!extra.cal);
  const conCalma = ver('calma', !!extra.calma);
  const numeros = { cal: conCal ? 1 : null, clase: conCal ? 2 : 1 };
  numeros.calma = conCalma ? numeros.clase + 1 : null;
  const hueco = (k, texto) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <button type="button" onClick={() => { abre(k); ponExtra({ [k]: extra[k] ?? { forma: 'video' } }); }} data-agregar-parte={k} className="kp-press"
        style={{ flex: 1, display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap', minHeight: 44, padding: '10px 2px', border: 'none', background: 'transparent', cursor: 'pointer', fontFamily: FONT, textAlign: 'left' }}>
        <span style={{ fontSize: 14.5, fontWeight: 800, color: T.accent }}>+ {texto} aparte</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: T.text3 }}>Solo si tu video no lo trae</span>
      </button>
      <button type="button" onClick={() => ocultaAparte(k, true)} data-ocultar-parte={k} aria-label={`No mostrar «${texto} aparte»`} title="No mostrar" className="kp-press"
        style={{ width: 36, height: 36, borderRadius: 10, border: 'none', background: 'transparent', color: T.text3, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}>
        <X size={16} strokeWidth={2.2} aria-hidden="true" />
      </button>
    </div>
  );
  const parteLlena = (k, titulo) => (
    <div data-parte-clase={k} style={{ background: '#F4F5F9', borderRadius: 16, padding: '12px 14px 14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 32, marginBottom: 10 }}>
        <span style={{ flex: 1, fontSize: 16, fontWeight: 800, color: T.text }}>{titulo}</span>
        {!soloLectura && (
          <button type="button" onClick={() => cierra(k, { [k]: undefined })} aria-label={`Quitar ${titulo}`} className="kp-press"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: 'none', background: 'transparent', color: T.text2, fontFamily: FONT, fontWeight: 700, fontSize: 13, minHeight: 32, padding: '0 6px', cursor: 'pointer' }}>
            <X size={14} strokeWidth={2.4} aria-hidden="true" /> Quitar
          </button>
        )}
      </div>
      {parte(k)}
    </div>
  );
  const sinVideo = (
    <div style={{ background: '#F4F5F9', borderRadius: 18, padding: '26px 22px', textAlign: 'center' }}>
      <span aria-hidden="true" style={{ width: 56, height: 56, borderRadius: '50%', background: KP.blueSoft, color: T.accent, display: 'grid', placeItems: 'center', margin: '0 auto 12px' }}>
        <PlayCircle size={28} strokeWidth={2} />
      </span>
      <div style={{ fontSize: 18.5, fontWeight: 800, color: T.text }}>Agrega el video de tu clase</div>
      <div style={{ fontSize: 14.5, fontWeight: 600, color: T.text2, marginTop: 5 }}>Tu alumno la sigue completa, de principio a fin.</div>
      {!soloLectura && (
        <div style={{ maxWidth: 520, margin: '18px auto 0' }}>
          <AccionesDeClase alElegir={(nueva) => onPatch({ clase: nueva })} />
        </div>
      )}
    </div>
  );
  /* AGREGA A TU CLASE (Andrés, 20 nov 2026: «esto no me encanta» de los botones sueltos y la fila de ejercicios). Mosaicos con ícono, los
     mismos del Híbrido que le gustaron («Caminadora», «Cadencia», «Tiempo límite», «Nota»). Lo que ya está puesto se abre arriba y su
     mosaico se va. «Ejercicios» es uno más: abre los Sets de siempre. */
  const mosaicos = [
    { id: 'portada', label: 'Portada', icono: ImageIcon, activo: ver('portada', !!extra.portada), activar: () => abre('portada') },
    { id: 'necesita', label: 'Lo que necesita', icono: Package, activo: ver('necesita', !!extra.necesita), activar: () => abre('necesita') },
    { id: 'nota', label: 'Nota para el alumno', icono: StickyNote, activo: ver('nota', !!extra.nota), activar: () => abre('nota') },
  ].filter((m) => !m.activo);

  return (
    <div data-editor-clase={modo === 'ejercicios' ? 'ejercicios' : clase ? 'con-video' : 'vacio'} style={{ marginTop: 14, fontFamily: FONT }}>
      {!soloLectura && (
        <div data-modo-clase={modo} style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', margin: '0 0 18px' }}>
          <span style={{ fontSize: 14.5, fontWeight: 800, color: T.text }}>Cómo es tu clase</span>
          <div style={{ display: 'flex', width: 380, maxWidth: '100%' }}>
            <Segmentos opciones={[['video', 'Un video completo'], ['ejercicios', 'Ejercicio por ejercicio']]} valor={modo} etiqueta="Cómo es tu clase" onCambio={cambiaModo} />
          </div>
        </div>
      )}
      {modo === 'video' && (
      <div data-orden-clase="1">
        <Seccion color={T.accent}>La clase, en orden</Seccion>
        {(conCal || (!soloLectura && !sinAparte.cal)) && (
          <Paso n={numeros.cal}>{conCal ? parteLlena('cal', 'Calentamiento') : hueco('cal', 'Calentamiento')}</Paso>
        )}
        <Paso n={numeros.clase} activo ultimo={!conCalma}>
          {clase ? (
            <VideoDeLaClase clase={clase} portada={extra.portada} titulo={day.name} soloLectura={soloLectura}
              onCambiar={() => setCambiando(true)} onQuitar={() => onPatch({ clase: undefined })} />
          ) : sinVideo}
        </Paso>
        {/* Sin «+ Enfriamiento aparte» (Andrés, 21 nov 2026: lo había agregado sin que lo pidiera; «sí, quítala»). Una clase que ya traía
            enfriamiento lo sigue enseñando, para no esconder nada. */}
        {conCalma && <Paso n={numeros.calma} ultimo>{parteLlena('calma', 'Enfriamiento')}</Paso>}
        {!soloLectura && sinAparte.cal && !conCal && (
          <button type="button" onClick={() => { ocultaAparte('cal', false); setSinAparte({}); try { localStorage.removeItem(LLAVE_SIN_APARTE); } catch { /* nada */ } }}
            data-mostrar-aparte="1" style={{ border: 'none', background: 'transparent', padding: '6px 0 0 42px', minHeight: 36, color: T.text3, fontFamily: FONT, fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
            Mostrar calentamiento aparte
          </button>
        )}
      </div>
      )}
      {cambiando && <HojaDeClase titulo="Cambiar la clase" onCerrar={() => setCambiando(false)} onElige={(nueva) => { setCambiando(false); onPatch({ clase: { ...nueva } }); }} />}

      {(clase || modo === 'ejercicios') && !soloLectura && (
        <div data-detalles-clase="1" style={{ marginTop: modo === 'ejercicios' ? 0 : 22 }}>
          <Seccion color={T.accent}>Agrega a tu clase</Seccion>
          {ver('portada', !!extra.portada) && (
            <Extra rotulo="Portada" onQuitar={() => cierra('portada', { portada: undefined })}>
              <Portada valor={extra.portada} onCambio={(portada) => ponExtra({ portada })} />
            </Extra>
          )}
          {ver('necesita', !!extra.necesita) && (
            <Extra rotulo="Lo que necesita" onQuitar={() => cierra('necesita', { necesita: undefined })}>
              <input value={extra.necesita ?? ''} onChange={(e) => ponExtra({ necesita: e.target.value })} placeholder="Tapete, liga ligera" aria-label="Lo que necesita para la clase" style={CAMPO} />
            </Extra>
          )}
          {ver('nota', !!extra.nota) && (
            <Extra rotulo="Nota para el alumno" onQuitar={() => cierra('nota', { nota: undefined })}>
              <textarea value={extra.nota ?? ''} onChange={(e) => ponExtra({ nota: e.target.value })} rows={2} placeholder="Si es tu primera clase, haz las variantes fáciles." aria-label="Nota para el alumno" style={{ ...CAMPO, minHeight: 72, padding: '12px', resize: 'vertical', lineHeight: 1.4 }} />
            </Extra>
          )}
          {mosaicos.length > 0 && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 8 }}>
              {mosaicos.map((m) => (
                <button key={m.id} type="button" onClick={m.activar} data-mosaico={m.id} className="kp-press"
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 7, height: 78, padding: '0 6px', borderRadius: 13, border: 'none', background: UI.relleno, color: T.text, fontFamily: FONT, fontWeight: 700, fontSize: 13.5, cursor: 'pointer', textAlign: 'center' }}>
                  <m.icono size={22} strokeWidth={2} color="#4B505C" aria-hidden="true" />
                  {m.label}
                </button>
              ))}
            </div>
          )}
          <div style={{ fontSize: 13, fontWeight: 600, color: T.text2, marginTop: 10 }}>Todo es opcional.</div>
        </div>
      )}
      {modo === 'ejercicios' && <div style={{ marginTop: 22 }}><Seccion color={T.accent}>Los ejercicios de la clase</Seccion></div>}
    </div>
  );
}

/** Un paso de «La clase, en orden»: su número en el riel (un punto si es un lugar vacío) y la línea que lo une con el siguiente. */
function Paso({ n, activo = false, ultimo = false, children }) {
  return (
    <div data-paso={n ?? 'vacio'} style={{ display: 'grid', gridTemplateColumns: '30px minmax(0, 1fr)', columnGap: 12, paddingBottom: ultimo ? 0 : 10 }}>
      <span aria-hidden="true" style={{ position: 'relative', display: 'flex', justifyContent: 'center' }}>
        {!ultimo && <i style={{ position: 'absolute', top: n ? 30 : 26, bottom: -10, width: 2, background: '#D5D8DF' }} />}
        {n
          ? <b style={{ position: 'relative', width: 30, height: 30, borderRadius: '50%', display: 'grid', placeItems: 'center', fontSize: 13.5, fontWeight: 800, background: activo ? T.accent : UI.relleno, color: activo ? '#fff' : T.text }}>{n}</b>
          : <i style={{ position: 'relative', width: 10, height: 10, borderRadius: '50%', background: '#D5D8DF', marginTop: 16 }} />}
      </span>
      <div style={{ minWidth: 0 }}>{children}</div>
    </div>
  );
}

/** El video de la clase, grande: su portada (o la foto del video), lo que dura, y «Cambiar video» / «Quitar». */
function VideoDeLaClase({ clase, portada, titulo, onCambiar, onQuitar, soloLectura }) {
  const externo = ligaExterna(clase.url);
  const foto = usePoster(externo ? null : clase.url);
  const src = portada || foto?.mini_url || foto?.poster_url || null;
  const dura = duracionTexto(clase.duracion);
  return (
    <div data-video-clase style={{ display: 'grid', gridTemplateColumns: 'minmax(150px, 220px) minmax(0, 1fr)', gap: 16, alignItems: 'center', background: '#F4F5F9', borderRadius: 18, padding: 14 }}>
      <span aria-hidden="true" style={{ position: 'relative', aspectRatio: '16 / 9', borderRadius: 13, overflow: 'hidden', background: '#0E1015', display: 'grid', placeItems: 'center' }}>
        {src && <img src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
        <PlayCircle size={34} color="#fff" strokeWidth={1.8} style={{ position: 'relative', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,.45))' }} />
        {dura && <small style={{ position: 'absolute', right: 8, bottom: 7, fontSize: 12, fontWeight: 800, color: '#fff', background: 'rgba(0,0,0,.45)', borderRadius: 6, padding: '2px 6px' }}>{dura}</small>}
      </span>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: T.text }}>{titulo?.trim() || 'Video de la clase'}</div>
        <div style={{ fontSize: 14, fontWeight: 600, color: T.text2, marginTop: 3 }}>
          {[dura || null, externo?.de ?? null, dura ? 'la duración sale del video' : null].filter(Boolean).join(' · ') || 'Video'}
        </div>
        {!soloLectura && (
          <div style={{ display: 'flex', gap: 16, marginTop: 10 }}>
            <button type="button" onClick={onCambiar} style={ENLACE}>Cambiar video</button>
            <button type="button" onClick={onQuitar} style={{ ...ENLACE, color: T.danger }} aria-label="Quitar el video de la clase"><Trash2 size={15} aria-hidden="true" /> Quitar</button>
          </div>
        )}
      </div>
    </div>
  );
}

/** La portada: la foto que ve el alumno antes de dar play. Se sube por el mismo camino que la foto de un ejercicio. */
function Portada({ valor, onCambio }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
      <span aria-hidden="true" style={{ width: 132, aspectRatio: '16 / 9', borderRadius: 11, overflow: 'hidden', background: UI.relleno, display: 'grid', placeItems: 'center', color: T.text3, flexShrink: 0 }}>
        {valor ? <img src={valor} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <ImageIcon size={24} strokeWidth={1.8} />}
      </span>
      <MediaUpload
        accept="image/*" kind="covers" value={valor ?? ''} onChange={(url) => onCambio(url || undefined)}
        botones={({ carrete, busy }) => (
          <button type="button" onClick={carrete} disabled={busy} className="kp-press"
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, minHeight: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: UI.relleno, color: T.text, fontFamily: FONT, fontWeight: 800, fontSize: 14, cursor: 'pointer' }}>
            <Upload size={16} aria-hidden="true" /> {valor ? 'Cambiar foto' : 'Elegir foto'}
          </button>
        )}
      />
      <span style={{ flexBasis: '100%', fontSize: 13, fontWeight: 600, color: T.text2 }}>Sin portada, el alumno ve una foto del video.</span>
    </div>
  );
}

const CAMPO = { border: 'none', borderRadius: 12, background: UI.relleno, minHeight: 46, padding: '0 12px', fontFamily: FONT, fontWeight: 700, fontSize: 15.5, color: T.text, width: '100%', boxSizing: 'border-box' };
const ENLACE = { display: 'inline-flex', alignItems: 'center', gap: 5, border: 'none', background: 'transparent', padding: 0, minHeight: 36, color: T.accent, fontFamily: FONT, fontWeight: 800, fontSize: 14.5, cursor: 'pointer' };
