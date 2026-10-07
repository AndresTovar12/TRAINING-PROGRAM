import { useRef, useState } from 'react';
import { Crop, ImagePlus, Loader2 } from 'lucide-react';
import { LT, FONT } from '@/lib/theme';
import { esImagen, optimizaImagen } from '@/lib/imagen';
import { uploadExerciseMedia } from '@/lib/api';
import { posicionDeFoto, separaFoto } from '@/lib/fotoConFoco';
import EncuadreDeFoto from '@/features/admin/EncuadreDeFoto';

/**
 * La foto de una fase o de un plan: la que sale en la tarjeta de Home del atleta (Andrés, 7 oct 2026: «el coach
 * debe poder agregar fotos»). Antes eran 8 fotos fijas dentro del código, solo de su programa.
 *
 * Sin foto, un botón «Agregar foto»; con foto, se ve y se puede cambiar o quitar. La foto se achica y se pasa a
 * WebP en el navegador (`optimizaImagen`) y se sube al mismo almacén que las portadas de los ejercicios: la dirección
 * que devuelve es la que se guarda en el plan. Un nombre único por archivo, así que cambiarla no deja una vieja pegada.
 * Acepta el formato que sea (HEIC del iPhone incluido): `optimizaImagen` lo pasa a uno que el servidor recibe.
 *
 * `valor`: la dirección de la foto ('' si no hay). `onCambia(url)`: llega con la nueva, o con '' al quitarla.
 *
 * «Encuadrar» (sobre la foto) abre la hoja donde se elige qué parte no debe cortarse: ese punto va pegado a la dirección
 * (`lib/fotoConFoco.js`), así que `onCambia` también recibe la misma foto con otro punto.
 */
const boton = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, cursor: 'pointer', fontFamily: FONT,
  border: `1.5px solid ${LT.border}`, background: LT.surface, borderRadius: 12, padding: '10px 13px',
  fontSize: 13.5, fontWeight: 800, touchAction: 'manipulation',
};

export default function CampoDeFoto({ valor, onCambia, alto = 130 }) {
  const input = useRef(null);
  const [subiendo, setSubiendo] = useState(false);
  // Antes de subir: leer la foto, pasarla a un formato que se pueda subir y achicarla (un HEIC tarda unos segundos).
  const [preparando, setPreparando] = useState(false);
  const [avance, setAvance] = useState(0);
  const [error, setError] = useState('');
  const [aviso, setAviso] = useState('');
  const [encuadrando, setEncuadrando] = useState(false);

  async function elegir(e) {
    const archivo = e.target.files?.[0];
    e.target.value = '';
    if (!archivo) return;
    setError('');
    setAviso('');
    if (!esImagen(archivo)) { setError('Elige una foto (JPG, HEIC, PNG, WebP…).'); return; }
    setSubiendo(true);
    setPreparando(true);
    setAvance(0);
    try {
      const { archivo: listo, aviso: poca } = await optimizaImagen(archivo);
      setPreparando(false);
      const url = await uploadExerciseMedia(listo, 'covers', setAvance);
      onCambia(url);
      if (poca) setAviso(poca);
    } catch (err) {
      setError(err?.message || 'No se pudo subir la foto.');
    } finally {
      setSubiendo(false);
      setPreparando(false);
    }
  }

  const abrir = () => input.current?.click();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontFamily: FONT }}>
      <input ref={input} type="file" accept="image/*" onChange={elegir} hidden />

      {valor ? (
        <>
          <div style={{ position: 'relative', borderRadius: 12, overflow: 'hidden', background: LT.surface2, height: alto }}>
            <img
              src={separaFoto(valor).url} alt="Foto"
              style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: posicionDeFoto(valor), display: 'block' }}
            />
            <button
              type="button" onClick={() => setEncuadrando(true)} disabled={subiendo}
              style={{
                position: 'absolute', left: 8, bottom: 8, display: 'inline-flex', alignItems: 'center', gap: 6, cursor: 'pointer',
                border: 'none', borderRadius: 999, padding: '6px 11px 6px 9px', background: 'rgba(255,255,255,0.94)', color: LT.text,
                fontFamily: FONT, fontSize: 12, fontWeight: 800, boxShadow: '0 2px 10px rgba(0,0,0,0.25)', touchAction: 'manipulation',
              }}
            >
              <Crop size={14} /> Encuadrar
            </button>
            {subiendo && (
              <div style={{
                position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.78)', display: 'flex', alignItems: 'center',
                justifyContent: 'center', gap: 8, fontSize: 13, fontWeight: 800, color: LT.text,
              }}>
                <Loader2 size={16} className="spin" /> {preparando ? 'Preparando foto…' : `Subiendo… ${avance}%`}
              </div>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button type="button" onClick={abrir} disabled={subiendo} style={{ ...boton, flex: 1, color: LT.blue }}>
              Cambiar
            </button>
            <button type="button" onClick={() => { setAviso(''); onCambia(''); }} disabled={subiendo} style={{ ...boton, flex: 1, color: LT.danger }}>
              Quitar
            </button>
          </div>
        </>
      ) : (
        <button type="button" onClick={abrir} disabled={subiendo} style={{ ...boton, width: '100%', color: LT.blue }}>
          {subiendo
            ? <><Loader2 size={16} className="spin" /> {preparando ? 'Preparando foto…' : `Subiendo… ${avance}%`}</>
            : <><ImagePlus size={16} /> Agregar foto</>}
        </button>
      )}

      {encuadrando && valor && <EncuadreDeFoto valor={valor} onCambia={onCambia} onCerrar={() => setEncuadrando(false)} />}
      {error && <div role="alert" style={{ fontSize: 12.5, fontWeight: 600, color: LT.danger, lineHeight: 1.4 }}>{error}</div>}
      {aviso && <div style={{ fontSize: 12.5, fontWeight: 600, color: LT.text2, lineHeight: 1.4 }}>{aviso}</div>}
    </div>
  );
}
