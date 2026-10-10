import { useEffect, useMemo, useRef, useState } from 'react';
import { Flag, Loader2, Mic, Send, Video, X } from 'lucide-react';
import HojaFlotante from '@/components/HojaFlotante';
import { T, KP, FONT } from '@/lib/theme';
import { respondeTecnica, subeArchivo, mimeBase } from '@/lib/mensajesApi';
import { preparaArchivo } from '@/features/mensajes/adjuntos';
import { puedeGrabarVoz, useGrabadoraDeVoz } from '@/features/mensajes/useGrabadoraDeVoz';
import { reloj } from '@/features/mensajes/formato';

/* LA HOJA DE «CORREGIR»: el video del atleta, el segundo donde está el detalle, y qué decirle.

   Andrés, 10 oct 2026: la corrección puede ser un texto, una nota de voz o su PROPIO video (cómo se hace bien), y poder «marcar el segundo» del video del atleta donde está
   el problema. Se ve el video, se toca «Marcar este segundo» justo en el cuadro del detalle, y la marca viaja con la corrección: al atleta le sale «En el segundo 0:12» y, al
   tocarlo, el video de su tarjeta salta ahí.

   Una corrección lleva texto y/o UN archivo (nota de voz o video). `t`: la técnica. `url`: la dirección firmada de su video. `alListo()`: ya se mandó. */

export default function CorregirTecnica({ t, url, alListo, alCerrar }) {
  const video = useRef(null);
  const selector = useRef(null);
  const [texto, setTexto] = useState('');
  const [marca, setMarca] = useState(null);
  const [archivo, setArchivo] = useState(null); // { archivo, tipo: 'voz' | 'video', segundos?, meta? }
  const [preparando, setPreparando] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(null);
  const voz = useGrabadoraDeVoz({
    alTerminar: (a, segundos) => { setArchivo({ archivo: a, tipo: 'voz', segundos }); setError(null); },
    alFallar: setError,
  });
  const conVoz = puedeGrabarVoz();

  // La vista previa de lo adjuntado (para oír la nota o ver el video antes de mandarlo).
  const vistaPrevia = useMemo(() => (archivo ? URL.createObjectURL(archivo.archivo) : null), [archivo]);
  useEffect(() => () => { if (vistaPrevia) URL.revokeObjectURL(vistaPrevia); }, [vistaPrevia]);

  const marcaEsteSegundo = () => { if (video.current) setMarca(Math.floor(video.current.currentTime)); };

  async function eligeVideo(e) {
    const elegido = e.target.files?.[0];
    e.target.value = '';
    if (!elegido) return;
    setPreparando(true);
    setError(null);
    try {
      const listo = await preparaArchivo(elegido);
      if (listo.tipo !== 'video') throw new Error('Elige un video.');
      setArchivo({ archivo: listo.archivo, tipo: 'video', segundos: listo.meta?.segundos ?? null, meta: listo.meta });
    } catch (err) {
      setError(err?.message ?? 'No se pudo leer el video.');
    } finally {
      setPreparando(false);
    }
  }

  const hayAlgo = texto.trim().length > 0 || !!archivo;
  async function manda() {
    if (!hayAlgo || enviando) return;
    setEnviando(true);
    setError(null);
    try {
      let adjunto = null;
      if (archivo) {
        const ruta = await subeArchivo({ atletaId: t.atleta_id, profesionalId: t.profesional_id, archivo: archivo.archivo });
        adjunto = { ruta, mime: mimeBase(archivo.archivo.type), bytes: archivo.archivo.size, ...(archivo.segundos ? { segundos: Math.round(archivo.segundos) } : null) };
      }
      await respondeTecnica({ tecnicaId: t.id, veredicto: 'corregir', texto: texto.trim() || null, adjunto, marca });
      alListo?.();
    } catch (e) {
      setError(e?.message ?? 'No se pudo mandar la corrección.');
      setEnviando(false);
    }
  }

  const boton = (activo) => ({
    minHeight: 46, padding: '0 14px', borderRadius: 14, cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', gap: 7, touchAction: 'manipulation',
    border: `1.5px solid ${activo ? T.accent : T.borderHi}`, background: activo ? T.accentBg : KP.surface, color: activo ? T.accent : T.text,
  });

  return (
    <HojaFlotante titulo="Corregir" subtitulo={[t.ejercicio, t.detalle].filter(Boolean).join(' · ')} onCerrar={alCerrar} ancho={560}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14, fontFamily: FONT }}>
        {url ? (
          <video ref={video} src={`${url}#t=0.1`} controls playsInline preload="metadata" style={{ width: '100%', maxHeight: '42vh', borderRadius: 16, background: '#000' }} />
        ) : (
          <div style={{ height: 160, borderRadius: 16, background: T.bg3 }} />
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" onClick={marcaEsteSegundo} disabled={!url} style={boton(marca !== null)}><Flag size={17} /> Marcar este segundo</button>
          {marca !== null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 6px 6px 12px', borderRadius: 999, background: T.accentBg, color: T.accent, fontSize: 13.5, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
              En el segundo {reloj(marca)}
              <button type="button" onClick={() => setMarca(null)} aria-label="Quitar la marca" style={{ width: 24, height: 24, borderRadius: '50%', border: 'none', background: 'rgba(30,64,224,0.14)', color: T.accent, display: 'grid', placeItems: 'center', cursor: 'pointer' }}><X size={14} /></button>
            </span>
          )}
        </div>

        <textarea
          value={texto} onChange={(e) => setTexto(e.target.value)} rows={4} maxLength={4000} placeholder="Qué corregir" aria-label="Qué corregir"
          style={{ width: '100%', boxSizing: 'border-box', resize: 'vertical', border: `1.5px solid ${T.border}`, borderRadius: 16, background: KP.surface, padding: '13px 15px', fontFamily: FONT, fontSize: 16, lineHeight: 1.4, color: T.text, outline: 'none' }}
        />

        {archivo ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 16, background: T.bg3 }}>
            {archivo.tipo === 'voz'
              ? <audio src={vistaPrevia ?? undefined} controls style={{ flex: 1, minWidth: 0 }} />
              : <video src={vistaPrevia ?? undefined} controls playsInline style={{ flex: 1, minWidth: 0, maxHeight: 180, borderRadius: 12, background: '#000' }} />}
            <button type="button" onClick={() => setArchivo(null)} aria-label="Quitar el archivo" style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: KP.surface, color: T.text2, display: 'grid', placeItems: 'center', cursor: 'pointer', flexShrink: 0 }}><X size={18} /></button>
          </div>
        ) : voz.grabando ? (
          <div role="status" style={{ display: 'flex', alignItems: 'center', gap: 10, minHeight: 46, padding: '0 6px 0 14px', borderRadius: 14, background: T.bg3, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            <span aria-hidden="true" style={{ width: 11, height: 11, borderRadius: '50%', background: KP.danger }} />
            Grabando {reloj(voz.segundos)}
            <span style={{ flex: 1 }} />
            <button type="button" onClick={voz.cancela} style={{ ...boton(false), minHeight: 38 }}>Tirar</button>
            <button type="button" onClick={voz.termina} style={{ ...boton(true), minHeight: 38 }}><Send size={15} /> Listo</button>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            {conVoz && <button type="button" onClick={voz.inicia} style={boton(false)}><Mic size={17} /> Nota de voz</button>}
            <button type="button" onClick={() => selector.current?.click()} disabled={preparando} style={boton(false)}>
              {preparando ? <Loader2 size={17} className="spin" /> : <Video size={17} />} Mi video
            </button>
            <input ref={selector} type="file" accept="video/*" onChange={eligeVideo} hidden />
          </div>
        )}

        {error && <div role="alert" style={{ padding: '10px 14px', borderRadius: 14, background: KP.dangerSoft, color: KP.danger, fontSize: 14, fontWeight: 700 }}>{error}</div>}

        <button
          type="button" onClick={manda} disabled={!hayAlgo || enviando} className="kp-press"
          style={{ minHeight: 54, borderRadius: 18, border: 'none', cursor: hayAlgo && !enviando ? 'pointer' : 'default', fontFamily: FONT, fontSize: 16.5, fontWeight: 800, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 9, background: hayAlgo ? `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})` : T.borderHi, boxShadow: hayAlgo ? KP.shBtn : 'none', touchAction: 'manipulation' }}
        >
          {enviando ? <><Loader2 size={19} className="spin" /> Mandando…</> : <><Send size={19} /> Mandar corrección</>}
        </button>
      </div>
    </HojaFlotante>
  );
}
