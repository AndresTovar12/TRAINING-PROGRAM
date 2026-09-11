/**
 * El recorte a mano: arrastrar las esquinas para quedarte con un trozo.
 *
 * POR QUE VIVE APARTE: lo usan el editor de video y el de foto. Cuando estaba
 * metido dentro del de video y hubo que arreglarle algo —las esquinas no se
 * podían agarrar, el marco se calculaba sobre las franjas negras— el arreglo
 * llegaba a una sola de las dos pantallas. Ya pasó antes con el botón de subir.
 *
 * COMO SE GUARDA EL RECORTE: en fracciones de 0 a 1 del original, no en píxeles.
 * `{x:.1, y:0, w:.8, h:1}` = "quítale el 10% de cada lado". Así el mismo dato
 * sirve para una miniatura de 44 px y para la pantalla completa.
 *
 * DONDE SE APLICA, y por qué distinto en cada caso:
 *   · Foto: se recorta de verdad antes de subir. La foto viaja ya cortada, pesa
 *     menos y no hay que hacer cuentas al enseñarla.
 *   · Video: se guarda al lado y se aplica al REPRODUCIR. Recortar el archivo
 *     exigiría reencodarlo en el teléfono, que es lento y le baja la calidad —
 *     justo lo que Andrés dijo que más le importa.
 */
import { useCallback, useEffect, useState } from 'react';

/** Nunca tan chico que ya no se vea de qué es la foto. */
const MIN = 0.12;

/** Las proporciones de siempre. `r` nulo = el original entero. */
export const FORMATOS = [
  { id: 'libre', et: 'Original', r: null },
  { id: '1', et: 'Cuadrado', r: 1 },
  { id: '45', et: 'Vertical', r: 4 / 5 },
  { id: '916', et: 'Pantalla', r: 9 / 16 },
  { id: '169', et: 'Apaisado', r: 16 / 9 },
];

/**
 * Toda la maquinaria de arrastrar.
 *
 * `marcoRef` tiene que apuntar a una caja con EXACTAMENTE la proporción del
 * original. Si apunta a un contenedor más ancho, el dedo se mide sobre las
 * franjas vacías y el recorte sale corrido.
 */
export function useRecorte({ marcoRef, medidas, inicial = null }) {
  const [crop, setCrop] = useState(inicial);
  const [agarrado, setAgarrado] = useState(null); // 'marco' | 'esq:nw' | …

  /* Un rectángulo con la proporción pedida, lo más grande que quepa y centrado.
     Es solo el punto de partida: después se arrastra a mano. */
  const rectanguloDe = useCallback((r) => {
    if (!r || !medidas) return null;
    const rOrig = medidas.w / medidas.h;
    let w = 1;
    let h = 1;
    if (r > rOrig) h = rOrig / r;   // más ancho de lo que hay: se recorta arriba y abajo
    else w = r / rOrig;             // más alto: se recorta a los lados
    return { x: (1 - w) / 2, y: (1 - h) / 2, w, h };
  }, [medidas]);

  /** Dónde cayó el dedo, en fracciones del original. */
  const punto = useCallback((e) => {
    const caja = marcoRef.current?.getBoundingClientRect();
    if (!caja) return null;
    return {
      x: Math.min(1, Math.max(0, (e.clientX - caja.left) / caja.width)),
      y: Math.min(1, Math.max(0, (e.clientY - caja.top) / caja.height)),
    };
  }, [marcoRef]);

  const mover = useCallback((e) => {
    if (!agarrado || !crop) return;
    const p = punto(e);
    if (!p) return;

    if (agarrado === 'marco') {
      setCrop({
        ...crop,
        x: Math.min(1 - crop.w, Math.max(0, p.x - crop.w / 2)),
        y: Math.min(1 - crop.h, Math.max(0, p.y - crop.h / 2)),
      });
      return;
    }

    const esquina = agarrado.slice(4);
    let { x, y, w, h } = crop;
    if (esquina.includes('w')) { const nx = Math.min(p.x, x + w - MIN); w += x - nx; x = nx; }
    if (esquina.includes('e')) { w = Math.max(MIN, Math.min(p.x - x, 1 - x)); }
    if (esquina.includes('n')) { const ny = Math.min(p.y, y + h - MIN); h += y - ny; y = ny; }
    if (esquina.includes('s')) { h = Math.max(MIN, Math.min(p.y - y, 1 - y)); }
    setCrop({ x: Math.max(0, x), y: Math.max(0, y), w, h });
  }, [agarrado, crop, punto]);

  useEffect(() => {
    if (!agarrado) return undefined;
    const suelta = () => setAgarrado(null);
    window.addEventListener('pointermove', mover);
    window.addEventListener('pointerup', suelta);
    window.addEventListener('pointercancel', suelta);
    return () => {
      window.removeEventListener('pointermove', mover);
      window.removeEventListener('pointerup', suelta);
      window.removeEventListener('pointercancel', suelta);
    };
  }, [agarrado, mover]);

  /** Un marco que cubre el original entero no es un recorte: vale como nada. */
  const recorteReal = crop && (crop.w < 0.995 || crop.h < 0.995) ? crop : null;

  return { crop, setCrop, agarrado, setAgarrado, rectanguloDe, recorteReal };
}

/** Lo que se va a perder se oscurece, en vez de desaparecer: se ve qué queda
    fuera ANTES de decidir. Va dentro de la caja con la proporción del original. */
export function CapaRecorte({ crop, onAgarrar }) {
  if (!crop) return null;
  const sombra = { background: 'rgba(0,0,0,.6)', pointerEvents: 'none', position: 'absolute' };
  return (
    <>
      <div style={{ ...sombra, left: 0, right: 0, top: 0, height: `${crop.y * 100}%` }} />
      <div style={{ ...sombra, left: 0, right: 0, bottom: 0, height: `${(1 - crop.y - crop.h) * 100}%` }} />
      <div style={{
        ...sombra, left: 0, top: `${crop.y * 100}%`,
        width: `${crop.x * 100}%`, height: `${crop.h * 100}%`,
      }} />
      <div style={{
        ...sombra, right: 0, top: `${crop.y * 100}%`,
        width: `${(1 - crop.x - crop.w) * 100}%`, height: `${crop.h * 100}%`,
      }} />

      {/* El marco se arrastra entero desde el centro… */}
      <div
        onPointerDown={(e) => { e.preventDefault(); onAgarrar('marco'); }}
        style={{
          position: 'absolute',
          left: `${crop.x * 100}%`, top: `${crop.y * 100}%`,
          width: `${crop.w * 100}%`, height: `${crop.h * 100}%`,
          border: '2px solid #fff', cursor: 'move', touchAction: 'none',
        }}
      />

      {/* …y se estira desde cualquiera de las cuatro esquinas. La zona que
          responde al dedo es de 34 px aunque el dibujo sea de 18: una esquina
          de 18 px no se acierta con el pulgar. */}
      {[
        ['nw', crop.x, crop.y, 'nwse-resize'],
        ['ne', crop.x + crop.w, crop.y, 'nesw-resize'],
        ['sw', crop.x, crop.y + crop.h, 'nesw-resize'],
        ['se', crop.x + crop.w, crop.y + crop.h, 'nwse-resize'],
      ].map(([id, cx, cy, cursor]) => (
        <div
          key={id}
          role="button"
          tabIndex={0}
          aria-label={`Estirar la esquina ${id}`}
          onPointerDown={(e) => { e.preventDefault(); onAgarrar(`esq:${id}`); }}
          style={{
            position: 'absolute', left: `${cx * 100}%`, top: `${cy * 100}%`,
            width: 34, height: 34, marginLeft: -17, marginTop: -17,
            cursor, touchAction: 'none', display: 'grid', placeItems: 'center',
          }}
        >
          <span style={{
            width: 18, height: 18, border: '3px solid #fff', borderRadius: 2,
            boxShadow: '0 0 0 1px rgba(0,0,0,.35)',
          }} />
        </div>
      ))}
    </>
  );
}

/** Botoncitos con la forma dibujada, no píldoras de texto.
    Andrés: "no veo la necesidad de poner botones tan grandes en lugar de
    botoncitos de diferentes encuadres como todas las apps de fotos". La forma
    del rectángulo dice la proporción mejor que la palabra. */
export function BotonesFormato({ crop, medidas, rectanguloDe, onElegir }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
      {FORMATOS.map((f) => {
        const activo = f.r
          ? !!crop && Math.abs((crop.w * (medidas?.w ?? 1)) / (crop.h * (medidas?.h ?? 1)) - f.r) < 0.02
          : !crop || (crop.w >= 0.995 && crop.h >= 0.995);
        // El dibujito mantiene la proporción real dentro de una caja de 22 px.
        const cajaW = f.r ? Math.min(22, 22 * f.r) : 17;
        const cajaH = f.r ? Math.min(22, 22 / f.r) : 22;
        return (
          <button
            key={f.id}
            type="button"
            title={f.et}
            aria-label={f.et}
            aria-pressed={activo}
            onClick={() => onElegir(f.r ? rectanguloDe(f.r) : { x: 0, y: 0, w: 1, h: 1 })}
            style={{
              width: 44, height: 44, borderRadius: 11, flexShrink: 0, cursor: 'pointer',
              border: 'none', background: activo ? 'rgba(255,255,255,.16)' : 'transparent',
              display: 'grid', placeItems: 'center', padding: 0,
            }}
          >
            <span style={{
              width: cajaW, height: cajaH, borderRadius: 2.5,
              border: `2px solid ${activo ? '#fff' : 'rgba(255,255,255,.5)'}`,
            }} />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Trae una foto YA SUBIDA como si acabaras de elegirla del teléfono.
 *
 * EL `cache: 'reload'` NO ES UNA PRECAUCIÓN, ES EL ARREGLO. Sin él esto falla
 * siempre, y de una forma que despista mucho:
 *
 * La lista del repertorio enseña las portadas con un `<img>` normal, sin pedir
 * permiso de otro dominio. El navegador se guarda esa respuesta —vive un año,
 * se lo decimos nosotros— y esa copia guardada NO trae las cabeceras de
 * permiso. Cuando después se pide la MISMA dirección con permiso, el navegador
 * reusa la copia vieja, no encuentra las cabeceras y la rechaza.
 *
 * Comprobado en el navegador, con la foto ya vista en la lista:
 *   · `<img crossOrigin="anonymous">`      -> falla
 *   · `fetch(url, { mode: 'cors' })`        -> falla
 *   · `fetch(url, { mode: 'cors', cache: 'reload' })` -> 4420 bytes, bien
 *
 * Con el archivo en la mano se acabó el problema de raíz: lo que se enseña y
 * lo que se recorta es una dirección temporal del propio navegador, que no
 * tiene restricciones de dominio.
 */
export async function archivoDesdeUrl(url) {
  const r = await fetch(url, { mode: 'cors', cache: 'reload' });
  if (!r.ok) throw new Error('No se pudo leer la foto.');
  const blob = await r.blob();
  const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
  return new File([blob], `portada.${ext}`, { type: blob.type || 'image/jpeg' });
}

/**
 * Corta la foto de verdad y devuelve un archivo nuevo.
 *
 * Aquí sí se tocan los píxeles, al revés que en el video: una foto recortada
 * pesa menos, se ve igual, y evita rehacer la cuenta cada vez que se enseña. Se
 * usa JPEG a 0.9 porque estas son fotos de gimnasio, no capturas de texto: a
 * ese nivel no se distingue del original y pesa un tercio.
 */
export function recortaImagen(archivo, crop) {
  return new Promise((listo, falla) => {
    if (!crop) { listo(archivo); return; }
    const url = URL.createObjectURL(archivo);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const w = Math.max(1, Math.round(img.naturalWidth * crop.w));
      const h = Math.max(1, Math.round(img.naturalHeight * crop.h));
      const lienzo = document.createElement('canvas');
      lienzo.width = w;
      lienzo.height = h;
      const ctx = lienzo.getContext('2d');
      ctx.drawImage(
        img,
        Math.round(img.naturalWidth * crop.x), Math.round(img.naturalHeight * crop.y), w, h,
        0, 0, w, h,
      );
      lienzo.toBlob((blob) => {
        if (!blob) { falla(new Error('No se pudo recortar la foto.')); return; }
        const nombre = `${(archivo.name || 'foto').replace(/\.[^.]+$/, '')}.jpg`;
        listo(new File([blob], nombre, { type: 'image/jpeg' }));
      }, 'image/jpeg', 0.9);
    };
    img.onerror = () => { URL.revokeObjectURL(url); falla(new Error('No se pudo leer la foto.')); };
    img.src = url;
  });
}
