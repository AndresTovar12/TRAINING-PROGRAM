import { useState } from 'react';
import { Check, FolderOpen, Link2, Loader2, PlayCircle, Trash2, Upload } from 'lucide-react';
import MediaUpload from '@/features/admin/MediaUpload';
import Ventana from '@/features/misplanes/Ventana';
import SelectorDeMisPlanes from '@/features/misplanes/SelectorDeMisPlanes';
import { botonBlanco, botonPrincipal, campo } from '@/features/misplanes/estilos';
import { abrirItem } from '@/lib/misPlanes';
import { sesionesDeWorkout } from '@/lib/misPlanesDatos';
import { claseDe, claseNueva, duracionTexto } from '@/lib/clases';
import { avisoDeLiga, ligaExterna } from '@/lib/videos';
import { usePoster } from '@/lib/posters';
import { T, FONT, KP } from '@/lib/theme';

/**
 * LA CLASE DE UNA SESIÓN, del lado de quien arma el plan (ver `lib/clases.js`).
 *
 * Una clase es un video largo que una instructora (yoga, pilates, spinning, functional) sube UNA vez. Aquí vive en tres formas:
 *   · `AccionesDeClase`: los tres modos de ponerla —subir un video, pegar una liga o traer una que ya guardó en Mis planes—.
 *   · `ClaseDeLaSesion`: lo que sale arriba de los Sets de la sesión (la tarjeta de la clase, o, al crear una clase en Mis planes y mientras
 *     no tiene video, las mismas acciones a la vista: es lo ÚNICO que hay que hacer ahí).
 *   · `HojaDeClase`: las acciones en una ventana, para el botón «Clase» de la sesión y para «Cambiar».
 *
 * Subir pasa por el MISMO camino que el video de un ejercicio (`MediaUpload`: editor con recorte → subida con barra → foto automática), así que el
 * espacio de videos de la coach, el tope por archivo y los avisos de «no cabe» funcionan igual.
 */

/** Subir video · Pegar liga · De mis clases. `alElegir(clase)` recibe lo que se guarda en `sesion.clase`. */
export function AccionesDeClase({ alElegir, conMias = true }) {
  const [pegando, setPegando] = useState(false);
  const [liga, setLiga] = useState('');
  const [error, setError] = useState('');
  const [eligiendoMia, setEligiendoMia] = useState(false);

  const usaLaLiga = () => {
    const aviso = avisoDeLiga(liga);
    if (aviso) { setError(aviso); return; }
    setError('');
    alElegir(claseNueva({ url: liga }));
  };

  async function usaUnaMia(item) {
    setEligiendoMia(false);
    try {
      const guardada = sesionesDeWorkout(await abrirItem(item)).map(claseDe).find(Boolean);
      if (!guardada) { setError('Esa clase no tiene video.'); return; }
      setError('');
      alElegir(claseNueva(guardada));
    } catch (e) {
      setError(e.message || 'No se pudo abrir esa clase');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <MediaUpload
        accept="video/*" kind="videos" value="" onChange={() => {}}
        alSubir={(subida) => alElegir(claseNueva(subida))}
        botones={({ carrete, busy }) => (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={carrete} disabled={busy} style={{ ...botonPrincipal(busy), flex: '1 1 150px' }}>
              {busy ? <Loader2 size={16} className="spin" /> : <Upload size={16} />} Subir video
            </button>
            <button type="button" onClick={() => setPegando((v) => !v)} style={{ ...botonBlanco(pegando), flex: '1 1 130px' }}>
              <Link2 size={16} /> Pegar liga
            </button>
            {conMias && (
              <button type="button" onClick={() => setEligiendoMia(true)} style={{ ...botonBlanco(), flex: '1 1 150px' }}>
                <FolderOpen size={16} /> De mis clases
              </button>
            )}
          </div>
        )}
      />
      {pegando && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={liga} onChange={(e) => { setLiga(e.target.value); setError(''); }} autoFocus inputMode="url"
            onKeyDown={(e) => { if (e.key === 'Enter') usaLaLiga(); }}
            placeholder="Liga de YouTube o Vimeo" aria-label="Liga del video de la clase" style={{ ...campo, flex: 1, minWidth: 0 }}
          />
          <button type="button" onClick={usaLaLiga} disabled={!liga.trim()} style={botonPrincipal(!liga.trim())}>
            <Check size={16} /> Usar
          </button>
        </div>
      )}
      {error && <div role="alert" style={{ color: T.danger, fontSize: 13, fontWeight: 700, lineHeight: 1.4 }}>{error}</div>}
      {eligiendoMia && <SelectorDeMisPlanes tipos={['clase']} titulo="Mis clases" onElegir={usaUnaMia} onCerrar={() => setEligiendoMia(false)} />}
    </div>
  );
}

/** Las acciones en una ventana: «Agregar clase» (el botón de la sesión) o «Cambiar la clase». */
export function HojaDeClase({ titulo = 'Agregar clase', onElige, onCerrar, conMias = true }) {
  return (
    <Ventana titulo={titulo} onCerrar={onCerrar} ancho={460}>
      <AccionesDeClase conMias={conMias} alElegir={onElige} />
    </Ventana>
  );
}

/** La foto del video (si es un archivo nuestro y ya tiene), o un recuadro oscuro con el play. */
function MiniaturaDeClase({ url }) {
  const externo = ligaExterna(url);
  const foto = usePoster(externo ? null : url);
  const src = foto?.mini_url || foto?.poster_url || null;
  return (
    <span
      aria-hidden="true"
      style={{
        position: 'relative', width: 124, aspectRatio: '16 / 9', flexShrink: 0, borderRadius: 12, overflow: 'hidden', background: '#0E1015',
        display: 'grid', placeItems: 'center',
      }}
    >
      {src && <img src={src} alt="" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />}
      <PlayCircle size={30} color="#fff" strokeWidth={1.8} style={{ position: 'relative', filter: 'drop-shadow(0 1px 4px rgba(0,0,0,.45))' }} />
    </span>
  );
}

/** La clase ya puesta: su foto, cuánto dura, y «Cambiar» / quitar. */
function TarjetaDeClase({ clase, onCambiar, onQuitar }) {
  const externo = ligaExterna(clase.url);
  const dura = duracionTexto(clase.duracion);
  return (
    <div
      style={{
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: 10, borderRadius: 16, background: T.bg2,
        border: `1.5px solid ${T.border}`, boxShadow: KP.shCard,
      }}
    >
      <MiniaturaDeClase url={clase.url} />
      <div style={{ flex: '1 1 120px', minWidth: 0, fontFamily: FONT }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: T.text }}>Clase</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: KP.mint, marginTop: 2 }}>{[dura, externo?.de].filter(Boolean).join(' · ') || 'Video'}</div>
      </div>
      <div className="kp-accion" style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button type="button" onClick={onCambiar} style={{ ...botonBlanco(), minHeight: 38, padding: '0 14px', fontSize: 13 }}>Cambiar</button>
        <button
          type="button" onClick={onQuitar} aria-label="Quitar la clase" title="Quitar la clase"
          style={{ width: 38, height: 38, borderRadius: 11, border: 'none', cursor: 'pointer', background: 'rgba(220,38,38,0.08)', color: T.danger, display: 'grid', placeItems: 'center' }}
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}

/**
 * Lo que va arriba de los Sets de una sesión. `clase`: la que trae (o `undefined`). `pedir`: la sesión es una CLASE de Mis planes y aún no tiene video:
 * se enseñan las acciones a la vista. `onClase(clase)` la pone o la cambia; `onQuitar()` la quita (con su «Deshacer», lo decide quien lo pasa).
 * Sin clase y sin `pedir` no se dibuja nada: quien no da clases no ve nada nuevo.
 */
export default function ClaseDeLaSesion({ clase, pedir = false, onClase, onQuitar, conMias = true }) {
  const [cambiando, setCambiando] = useState(false);
  const traida = claseDe({ clase });
  if (traida) {
    return (
      <div style={{ marginTop: 12 }}>
        <TarjetaDeClase clase={traida} onCambiar={() => setCambiando(true)} onQuitar={onQuitar} />
        {cambiando && (
          <HojaDeClase titulo="Cambiar la clase" conMias={conMias} onCerrar={() => setCambiando(false)} onElige={(nueva) => { setCambiando(false); onClase(nueva); }} />
        )}
      </div>
    );
  }
  if (!pedir) return null;
  return (
    <div style={{ marginTop: 12, padding: 14, borderRadius: 16, background: T.bg2, border: `1.5px solid ${T.border}`, boxShadow: KP.shCard, fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 800, color: T.text, marginBottom: 10 }}>
        <PlayCircle size={18} color={KP.mint} /> Video de la clase
      </div>
      <AccionesDeClase conMias={conMias} alElegir={onClase} />
    </div>
  );
}
