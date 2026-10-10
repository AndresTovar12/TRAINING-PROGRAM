import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Copy, Download, ImagePlus, Share2 } from 'lucide-react';
import { LT, KP, FONT } from '@/lib/theme';
import { aImagenWeb } from '@/lib/imagen';
import { cargaFuentes, dibujaEnPantalla, exportaSello, limitaCorrimiento, MARCO, piezaEn, piezasDelSello } from '@/lib/sello/dibuja';
import { imagenDeIcono } from '@/lib/sello/icono';
import { Boton } from '@/features/metricas/Piezas';

/* EL EDITOR DEL SELLO: la vista previa del sello encima de una foto o de un fondo transparente, y los botones para sacarlo de la app.

   Andrés, 10 oct 2026 (competir con el «sello» de Strava): el atleta ve su sello, lo acomoda con el dedo (cada pieza se arrastra por separado: la ruta o el ícono, los
   datos y el logo T•LAB) y lo manda a Instagram o CapCut. Dos versiones: SIN FONDO (un PNG transparente para pegarlo encima de un video) y CON FOTO (la historia entera,
   con una foto de la galería de fondo). Si el entreno fue mixto (cardio y fuerza) hay dos sellos y el atleta toca el que se ve mejor.

   En la web no hay un botón directo a Instagram (solo una app instalada puede abrirla con la imagen), así que salen tres: «Compartir» (la hoja de compartir del teléfono,
   donde está Instagram; solo si el navegador la ofrece), «Guardar imagen» y «Copiar». La foto de fondo NUNCA se sube a ningún lado: se queda en el teléfono.

   `sellos`: de `lib/sello/datos.js`. `Icono`: el componente del ícono del tipo de sesión (para el sello sin ruta). */

const ARCHIVO = { nada: 'tlab-sello.png', foto: 'tlab-sello-foto.png' };
const DAMERO = 'repeating-conic-gradient(#232948 0% 25%, #171B30 0% 50%) 50% / 22px 22px';

const puedeCompartir = () => {
  try {
    return typeof navigator.canShare === 'function' && typeof navigator.share === 'function'
      && navigator.canShare({ files: [new File([''], 'a.png', { type: 'image/png' })] });
  } catch { return false; }
};
const puedeCopiar = () => !!(navigator.clipboard && typeof navigator.clipboard.write === 'function' && typeof window.ClipboardItem === 'function');

function descarga(archivo) {
  const url = URL.createObjectURL(archivo);
  const a = document.createElement('a');
  a.href = url;
  a.download = archivo.name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

async function leeLaFoto(archivo) {
  const lista = await aImagenWeb(archivo);
  try { return await createImageBitmap(lista, { imageOrientation: 'from-image' }); } catch { return createImageBitmap(lista); }
}

/** La miniatura de un sello para escoger entre dos (mixto). */
function Miniatura({ sello, icono, activa, alElegir }) {
  const lienzo = useRef(null);
  useEffect(() => {
    if (lienzo.current) dibujaEnPantalla(lienzo.current, { sello, icono });
  }, [sello, icono]);
  return (
    <button
      type="button" onClick={alElegir} aria-pressed={activa} aria-label={`Sello de ${sello.titulo.toLowerCase()}`} className="kp-press"
      style={{
        flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '10px 8px 12px', borderRadius: 18, cursor: 'pointer', fontFamily: FONT,
        border: `2px solid ${activa ? LT.blue : LT.border}`, background: LT.surface, touchAction: 'manipulation',
      }}
    >
      <span style={{ width: 84, aspectRatio: '9 / 16', borderRadius: 12, overflow: 'hidden', background: DAMERO, position: 'relative' }}>
        <canvas ref={lienzo} aria-hidden="true" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }} />
      </span>
      <span style={{ fontSize: 14, fontWeight: 800, color: activa ? LT.blue : LT.text }}>{sello.titulo}</span>
    </button>
  );
}

export default function EditorDelSello({ sellos, Icono }) {
  const [indice, setIndice] = useState(0);
  const [fondo, setFondo] = useState('nada'); // 'nada' | 'foto'
  const [foto, setFoto] = useState(null); // ImageBitmap de la galería (solo en memoria)
  const [fotoVersion, setFotoVersion] = useState(0);
  const [acomodos, setAcomodos] = useState({}); // por sello: { pieza: [dx, dy] }
  const [icono, setIcono] = useState(null); // null: cargando · false: no se pudo · <img>
  const [fuentes, setFuentes] = useState(false);
  const [ancho, setAncho] = useState(0);
  const [aviso, setAviso] = useState(null); // { tipo: 'ok' | 'error', texto }
  const [ocupado, setOcupado] = useState(false);
  const lienzo = useRef(null);
  const cuadro = useRef(null);
  const selector = useRef(null);
  const arrastre = useRef(null);
  const preparado = useRef({ clave: '', archivo: null });

  const sello = sellos[Math.min(indice, sellos.length - 1)];
  const acomodo = acomodos[sello.id];
  const necesitaIcono = !sello.ruta;
  const iconoListo = !necesitaIcono || icono !== null;
  const conFoto = fondo === 'foto';
  const faltaFoto = conFoto && !foto;
  const nombreArchivo = ARCHIVO[fondo];
  const compartible = useMemo(() => puedeCompartir(), []);
  const copiable = useMemo(() => puedeCopiar(), []);

  useEffect(() => {
    let vivo = true;
    cargaFuentes().then(() => { if (vivo) setFuentes(true); });
    return () => { vivo = false; };
  }, []);
  useEffect(() => {
    let vivo = true;
    imagenDeIcono(Icono).then((img) => { if (vivo) setIcono(img); }).catch(() => { if (vivo) setIcono(false); });
    return () => { vivo = false; };
  }, [Icono]);
  // El `ImageBitmap` ocupa memoria de verdad (una foto de 12 Mpx): se suelta al cambiar de foto y al salir.
  useEffect(() => () => foto?.close?.(), [foto]);
  useEffect(() => {
    const el = cuadro.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(() => setAncho(Math.round(el.getBoundingClientRect().width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // La vista previa se vuelve a pintar con cada cambio (arrastrar, foto, fondo, ancho de la pantalla).
  useEffect(() => {
    if (!fuentes || !iconoListo || !lienzo.current) return;
    dibujaEnPantalla(lienzo.current, { sello, icono: icono || null, acomodo, foto: conFoto ? foto : null });
  }, [fuentes, iconoListo, sello, icono, acomodo, conFoto, foto, ancho]);

  // La imagen se va preparando mientras se acomoda: así «Compartir» responde al toque (iOS exige que la hoja de compartir se abra enseguida).
  const clave = JSON.stringify([sello.id, fondo, fotoVersion, acomodo ?? null]);
  useEffect(() => {
    if (!fuentes || !iconoListo || faltaFoto) return undefined;
    let vivo = true;
    const espera = setTimeout(async () => {
      try {
        const blob = await exportaSello({ sello, icono: icono || null, acomodo, foto: conFoto ? foto : null });
        if (vivo) preparado.current = { clave, archivo: new File([blob], nombreArchivo, { type: 'image/png' }) };
      } catch { /* al tocar un botón se vuelve a intentar y ahí sí se avisa */ }
    }, 250);
    return () => { vivo = false; clearTimeout(espera); };
  }, [fuentes, iconoListo, faltaFoto, sello, icono, acomodo, conFoto, foto, clave, nombreArchivo]);

  const obtenArchivo = useCallback(async () => {
    if (preparado.current.clave === clave && preparado.current.archivo) return preparado.current.archivo;
    const blob = await exportaSello({ sello, icono: icono || null, acomodo, foto: conFoto ? foto : null });
    return new File([blob], nombreArchivo, { type: 'image/png' });
  }, [clave, sello, icono, acomodo, conFoto, foto, nombreArchivo]);

  async function haz(nombre, tarea) {
    setOcupado(true);
    setAviso(null);
    try {
      const texto = await tarea();
      if (texto) setAviso({ tipo: 'ok', texto });
    } catch (e) {
      if (e?.name !== 'AbortError') setAviso({ tipo: 'error', texto: e?.message || `No se pudo ${nombre}.` });
    } finally {
      setOcupado(false);
    }
  }
  const compartir = () => haz('compartir la imagen', async () => { await navigator.share({ files: [await obtenArchivo()] }); return null; });
  const guardar = () => haz('guardar la imagen', async () => { descarga(await obtenArchivo()); return 'Imagen guardada.'; });
  const copiar = () => haz('copiar la imagen', async () => {
    await navigator.clipboard.write([new window.ClipboardItem({ 'image/png': obtenArchivo() })]);
    return 'Copiada. Pégala en tu historia.';
  });

  async function eligeFoto(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    try {
      const bmp = await leeLaFoto(archivo);
      setFoto(bmp);
      setFotoVersion((v) => v + 1);
      setFondo('foto');
      setAviso(null);
    } catch (err) {
      setAviso({ tipo: 'error', texto: err?.message || 'No se pudo leer la foto.' });
    }
  }
  const pideFoto = () => selector.current?.click();
  const alFondo = (v) => {
    if (v === 'foto' && !foto) { pideFoto(); return; }
    setFondo(v);
    setAviso(null);
  };

  /* ---------- arrastrar piezas ---------- */
  const unidades = (e) => {
    const r = lienzo.current.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * MARCO.w, y: ((e.clientY - r.top) / r.height) * MARCO.h };
  };
  const alBajar = (e) => {
    if (!fuentes || !iconoListo) return;
    const p = unidades(e);
    const pieza = piezaEn(piezasDelSello(sello, !!icono), acomodo, p.x, p.y);
    if (!pieza) return;
    const [ox, oy] = acomodo?.[pieza.id] ?? [0, 0];
    arrastre.current = { pieza, sx: p.x, sy: p.y, ox, oy };
    try { lienzo.current.setPointerCapture(e.pointerId); } catch { /* sin captura también funciona */ }
    lienzo.current.style.cursor = 'grabbing';
    e.preventDefault();
  };
  const alMover = (e) => {
    const a = arrastre.current;
    if (!a) return;
    const p = unidades(e);
    const nuevo = limitaCorrimiento(a.pieza, a.ox + (p.x - a.sx), a.oy + (p.y - a.sy));
    setAcomodos((prev) => ({ ...prev, [sello.id]: { ...prev[sello.id], [a.pieza.id]: nuevo } }));
  };
  const alSoltar = () => {
    arrastre.current = null;
    if (lienzo.current) lienzo.current.style.cursor = 'grab';
  };

  const segmento = (valor, texto) => (
    <button
      key={valor} type="button" aria-pressed={fondo === valor} onClick={() => alFondo(valor)} className="kp-press"
      style={{
        flex: 1, minHeight: 44, borderRadius: 12, cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 800, touchAction: 'manipulation',
        border: `1.5px solid ${fondo === valor ? LT.blue : LT.borderHi}`, background: fondo === valor ? LT.blue : LT.surface, color: fondo === valor ? '#fff' : LT.text,
      }}
    >
      {texto}
    </button>
  );
  const sinImagen = faltaFoto || !fuentes || !iconoListo;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'stretch' }}>
      {sellos.length > 1 && (
        <div role="group" aria-label="Elige tu sello" style={{ display: 'flex', gap: 10 }}>
          {sellos.map((s, i) => <Miniatura key={s.id} sello={s} icono={icono || null} activa={i === indice} alElegir={() => setIndice(i)} />)}
        </div>
      )}

      <div
        ref={cuadro}
        style={{ position: 'relative', width: 'min(100%, 300px, calc(56vh * 9 / 16))', aspectRatio: '9 / 16', margin: '0 auto', borderRadius: 22, overflow: 'hidden', background: DAMERO, boxShadow: KP.shCard }}
      >
        <canvas
          ref={lienzo} role="img" aria-label="Vista previa del sello"
          onPointerDown={alBajar} onPointerMove={alMover} onPointerUp={alSoltar} onPointerCancel={alSoltar}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', touchAction: 'none', cursor: 'grab' }}
        />
        {faltaFoto && (
          <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'rgba(15,21,48,0.72)' }}>
            <Boton principal icono={ImagePlus} onClick={pideFoto}>Elegir foto</Boton>
          </div>
        )}
      </div>
      <input ref={selector} type="file" accept="image/*" onChange={eligeFoto} hidden />

      <div style={{ display: 'flex', gap: 8, width: 'min(100%, 420px)', margin: '0 auto' }}>
        {segmento('nada', 'Sin fondo')}
        {segmento('foto', 'Con foto')}
        {foto && <Boton icono={ImagePlus} onClick={pideFoto}>Cambiar</Boton>}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, width: 'min(100%, 520px)', margin: '0 auto' }}>
        {compartible && <Boton principal icono={Share2} onClick={compartir} disabled={ocupado || sinImagen} ancho>Compartir</Boton>}
        <Boton principal={!compartible} icono={Download} onClick={guardar} disabled={ocupado || sinImagen} ancho>Guardar imagen</Boton>
        {copiable && <Boton icono={Copy} onClick={copiar} disabled={ocupado || sinImagen} ancho>Copiar</Boton>}
      </div>

      <div role="status" aria-live="polite" style={{ minHeight: 20, textAlign: 'center', fontSize: 14, fontWeight: 700, color: aviso?.tipo === 'error' ? KP.danger : KP.mint }}>
        {aviso?.texto ?? ''}
      </div>
    </div>
  );
}
