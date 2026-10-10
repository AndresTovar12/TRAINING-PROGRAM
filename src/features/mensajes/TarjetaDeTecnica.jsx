import { useState } from 'react';
import { Check, Loader2, Pencil, RotateCcw, Video } from 'lucide-react';
import { T, KP, FONT } from '@/lib/theme';
import { horaTexto } from '@/features/mensajes/formato';

/* LA TARJETA DE TÉCNICA: el video de una serie que mandó el atleta, con qué ejercicio es, de qué serie y cómo va.

   Andrés, 10 oct 2026: a quien puso el ejercicio le llega como una tarjeta con DOS botones, «Técnica correcta» (un toque) y «Corregir» (abre la hoja para escribir, grabar una nota
   de voz o su propio video, y marcar el segundo donde está el detalle). El atleta ve cómo va (en revisión, correcta, corregida) y, ya revisada, puede «Mandar otro intento».
   El video vive 30 días; después la tarjeta dice que venció. `url`: la dirección firmada del video (o `null` mientras se pide). */

const ESTADOS = {
  por_revisar: { texto: 'Por revisar', textoAtleta: 'En revisión', fondo: KP.amberSoft, tinta: KP.amber },
  correcta: { texto: 'Técnica correcta', textoAtleta: 'Técnica correcta', fondo: KP.mintSoft, tinta: KP.mint },
  corregida: { texto: 'Corregida', textoAtleta: 'Tiene correcciones', fondo: KP.blueSoft, tinta: T.accent },
};

export default function TarjetaDeTecnica({ m, t, soyAtleta, url, alFallar, alCorrecta, alCorregir, alOtroIntento }) {
  const [ocupado, setOcupado] = useState(false);
  if (!t) {
    return <div style={{ padding: '10px 14px', fontSize: 14, fontStyle: 'italic', color: T.text2 }}>Cargando la técnica…</div>;
  }
  const estado = ESTADOS[t.estado] ?? ESTADOS.por_revisar;
  const vencida = t.video_borrado || m.adjunto_borrado;
  const porRevisar = t.estado === 'por_revisar' && !vencida;

  async function correcta() {
    setOcupado(true);
    try { await alCorrecta(t); } finally { setOcupado(false); }
  }

  return (
    <div style={{ width: '100%', fontFamily: FONT, color: T.text }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 12px 8px' }}>
        <span style={{ width: 30, height: 30, borderRadius: 10, background: T.accentBg, color: T.accent, display: 'grid', placeItems: 'center', flexShrink: 0 }}><Video size={17} /></span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span style={{ display: 'block', fontSize: 15, fontWeight: 800, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{t.ejercicio}</span>
          <span style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: T.text2, marginTop: 2 }}>
            {[t.detalle, t.intento_de ? 'Otro intento' : null].filter(Boolean).join(' · ') || 'Técnica'}
          </span>
        </span>
        <span style={{ flexShrink: 0, padding: '3px 9px', borderRadius: 999, fontSize: 11.5, fontWeight: 800, background: estado.fondo, color: estado.tinta, whiteSpace: 'nowrap' }}>
          {soyAtleta ? estado.textoAtleta : estado.texto}
        </span>
      </div>

      {vencida ? (
        <div style={{ margin: '0 12px 10px', padding: '22px 14px', borderRadius: 14, background: T.bg3, textAlign: 'center', fontSize: 14, fontStyle: 'italic', color: T.text2 }}>Este video ya venció.</div>
      ) : url ? (
        <video
          src={`${url}#t=0.1`} controls playsInline preload="metadata" data-tecnica={t.id} onError={() => alFallar?.(m.adjunto?.ruta ?? t.ruta)}
          style={{ display: 'block', width: 'calc(100% - 24px)', margin: '0 12px', maxHeight: 380, borderRadius: 14, background: '#000' }}
        />
      ) : (
        <div style={{ margin: '0 12px', height: 160, borderRadius: 14, background: T.bg3 }} />
      )}

      <div style={{ padding: '8px 12px 6px', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {!soyAtleta && porRevisar && alCorrecta && alCorregir && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              type="button" onClick={correcta} disabled={ocupado} className="kp-press"
              style={{ flex: '1 1 132px', minHeight: 46, padding: '0 8px', whiteSpace: 'nowrap', borderRadius: 14, border: 'none', background: KP.mint, color: '#fff', cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, touchAction: 'manipulation' }}
            >
              {ocupado ? <Loader2 size={17} className="spin" /> : <Check size={17} strokeWidth={3} />} Técnica correcta
            </button>
            <button
              type="button" onClick={() => alCorregir(t)} disabled={ocupado} className="kp-press"
              style={{ flex: '1 1 132px', minHeight: 46, padding: '0 8px', whiteSpace: 'nowrap', borderRadius: 14, border: `1.5px solid ${T.accent}`, background: KP.surface, color: T.accent, cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6, touchAction: 'manipulation' }}
            >
              <Pencil size={16} /> Corregir
            </button>
          </div>
        )}
        {soyAtleta && !porRevisar && alOtroIntento && (
          <button
            type="button" onClick={() => alOtroIntento(t)} className="kp-press"
            style={{ minHeight: 44, borderRadius: 14, border: `1.5px solid ${T.accent}`, background: KP.surface, color: T.accent, cursor: 'pointer', fontFamily: FONT, fontSize: 14.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, touchAction: 'manipulation' }}
          >
            <RotateCcw size={16} /> Mandar otro intento
          </button>
        )}
        <span style={{ alignSelf: 'flex-end', fontSize: 11, fontWeight: 600, color: T.text3, fontVariantNumeric: 'tabular-nums' }}>{horaTexto(m.creado_en)}</span>
      </div>
    </div>
  );
}
