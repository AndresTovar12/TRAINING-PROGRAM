/**
 * El editor que aparece JUSTO DESPUÉS de elegir o tomar una foto, antes de
 * subirla. El hermano del de video, con lo que aplica a una foto: recortar.
 *
 * POR QUÉ EXISTE. Andrés: "me parece que está bien el tema de la edición de
 * videos y todo eso, pero también para las fotos de portada se debería poder
 * hacer algún recorte o algo así". Y es peor en las fotos que en los videos:
 * una foto del carrete sale apaisada del teléfono y la portada del ejercicio es
 * un recuadro. Sin recorte, el navegador decide qué mitad tira — y suele tirar
 * justo la persona.
 *
 * QUÉ LE HACE AL ARCHIVO: lo corta de verdad. Al revés que en el video, aquí sí
 * se tocan los píxeles, porque cortar una foto no le quita calidad a lo que
 * queda y además la hace pesar menos. En el video, reencodar sí costaría
 * calidad, así que el recorte se guarda al lado y se aplica al reproducir.
 */
import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X, Check, Loader2 } from 'lucide-react';
import { FONT } from '@/lib/theme';
import { useRecorte, CapaRecorte, BotonesFormato } from '@/features/admin/recorte';

export default function EditorFoto({ archivo, onCancelar, onListo, subiendo, avance }) {
  const marcoRef = useRef(null);
  const [medidas, setMedidas] = useState(null); // tamaño real, en píxeles
  const { crop, setCrop, setAgarrado, rectanguloDe, recorteReal } = useRecorte({ marcoRef, medidas });

  /* La dirección temporal del archivo del teléfono.
     SE CREA Y SE LIBERA DENTRO DEL MISMO EFECTO, a propósito. Tenerla en un
     useMemo y liberarla en un efecto aparte parece equivalente y no lo es:
     React monta, desmonta y vuelve a montar cada pantalla para cazar errores,
     y en ese ida y vuelta la dirección se liberaba pero no se volvía a crear.
     Resultado: la foto no cargaba y salía un cuadro de 20 px sin esquinas que
     agarrar. Medido, no deducido: `naturalWidth` valía 0. */
  const [local, setLocal] = useState(null);
  useEffect(() => {
    if (!archivo) { setLocal(null); return undefined; }
    const u = URL.createObjectURL(archivo);
    setLocal(u);
    return () => URL.revokeObjectURL(u);
  }, [archivo]);

  if (!local) return null;

  return createPortal((
    <div style={{
      position: 'fixed', inset: 0, zIndex: 6000, background: '#000',
      display: 'flex', flexDirection: 'column', fontFamily: FONT,
    }}>
      {/* Cancelar a la izquierda, listo a la derecha, como iOS. Abajo no va
          nada: la franja de abajo costaba 88 px de pantalla para sostener un
          botón, y lo único que hay que mirar aquí es la foto. */}
      <div style={{
        padding: 'calc(10px + env(safe-area-inset-top)) 14px 10px', flexShrink: 0,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button
          type="button" onClick={onCancelar} disabled={subiendo} aria-label="Cancelar"
          style={{
            width: 42, height: 42, borderRadius: '50%', border: 'none',
            background: 'rgba(255,255,255,.14)', color: '#fff', cursor: 'pointer',
            display: 'grid', placeItems: 'center', flexShrink: 0,
          }}
        >
          <X size={22} />
        </button>

        <span style={{ flex: 1 }} />

        <button
          type="button"
          disabled={subiendo || !medidas}
          onClick={() => onListo({ encuadre: recorteReal })}
          aria-label="Usar esta foto"
          style={{
            minHeight: 42, padding: '0 18px', borderRadius: 999, border: 'none', flexShrink: 0,
            background: subiendo || !medidas ? 'rgba(255,255,255,.2)' : '#1E40E0',
            color: '#fff', cursor: subiendo || !medidas ? 'default' : 'pointer',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            fontFamily: FONT, fontSize: 14, fontWeight: 800,
          }}
        >
          {subiendo
            ? <><Loader2 size={17} className="spin" />{avance ?? 0}%</>
            : <><Check size={18} strokeWidth={3} />Listo</>}
        </button>
      </div>

      {/* ---------- La foto ---------- */}
      <div style={{
        flex: 1, minHeight: 0, overflow: 'hidden',
        display: 'grid', placeItems: 'center',
        // Aire para poder agarrar las esquinas: las manijas sobresalen del
        // marco, y pegadas al borde no hay dónde poner el dedo.
        padding: '10px 18px 18px',
      }}>
        {/* El marco tiene EXACTAMENTE la proporción de la foto, así que sus
            coordenadas y las de la foto son las mismas. Sin esto, una foto
            vertical dentro de una caja ancha calcularía el recorte sobre los
            márgenes vacíos. */}
        <div
          ref={marcoRef}
          style={{
            position: 'relative', overflow: 'hidden', background: '#000',
            aspectRatio: medidas ? `${medidas.w} / ${medidas.h}` : '1 / 1',
            maxWidth: '100%', maxHeight: '100%',
          }}
        >
          <img
            src={local}
            alt=""
            onLoad={(e) => {
              const i = e.currentTarget;
              setMedidas({ w: i.naturalWidth || 1, h: i.naturalHeight || 1 });
              // El marco arranca cubriendo la foto entera, listo para agarrarlo
              // por las esquinas. Si arrancara vacío habría que elegir primero
              // una proporción para poder cortar a mano, que es justo lo
              // contrario de lo que pidió Andrés.
              setCrop({ x: 0, y: 0, w: 1, h: 1 });
            }}
            style={{ width: '100%', height: '100%', objectFit: 'fill', display: 'block' }}
          />
          <CapaRecorte crop={crop} onAgarrar={setAgarrado} />
        </div>
      </div>

      {/* ---------- Proporciones ---------- */}
      <div style={{ flexShrink: 0, padding: '0 16px' }}>
        <BotonesFormato
          crop={crop} medidas={medidas} rectanguloDe={rectanguloDe} onElegir={setCrop}
        />
      </div>

      <div style={{ flexShrink: 0, height: 'calc(12px + env(safe-area-inset-bottom))' }} />
    </div>
  ), document.body);
}
