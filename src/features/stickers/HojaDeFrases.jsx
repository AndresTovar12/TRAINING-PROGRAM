import { useEffect, useState } from 'react';
import { FONT } from '@/lib/theme';
import { FRASE_MAX, FRASES } from '@/lib/stickers/catalogo';

/* «ELIGE UNA FRASE» (5 nov 2026; ver docs/stickers.md y la maqueta aprobada). Se abre con «✎ Personalizar» de un sticker personalizable, sobre la hoja de stickers.
   Dos pestañas de idioma (English primero, Español segundo), un campo para escribir la tuya (hasta 40 letras) y las frases como burbujas azules en dos columnas.
   Elegir una (o «Usar» la tuya) la pone en TODOS los personalizables y cierra; «Listo» o tocar fuera cierra sin cambiarla. */

const CAJA = '#1C2234';
const TINTA_2 = '#9AA3B8';
const CURVA = 'cubic-bezier(.32,.72,0,1)';

export default function HojaDeFrases({ frase, alElegir, alCerrar, rm = false }) {
  const [abierta, setAbierta] = useState(false);
  const [idioma, setIdioma] = useState('en');
  const [tuya, setTuya] = useState('');
  useEffect(() => {
    const r = requestAnimationFrame(() => requestAnimationFrame(() => setAbierta(true)));
    return () => cancelAnimationFrame(r);
  }, []);
  const cierra = (nueva) => {
    setAbierta(false);
    setTimeout(() => alCerrar(nueva), rm ? 0 : 260);
  };
  const usaTuya = () => { const v = tuya.trim().slice(0, FRASE_MAX); if (v) { alElegir(v); cierra(v); } };

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 8, borderRadius: 'inherit', overflow: 'hidden' }}>
      <div onClick={() => cierra(null)} aria-hidden="true" style={{ position: 'absolute', inset: 0, background: 'rgba(5,8,18,.55)', opacity: abierta ? 1 : 0, transition: `opacity ${rm ? 0 : 0.25}s` }} />
      <div
        role="dialog" aria-modal="true" aria-label="Elige una frase"
        style={{
          position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '78%', display: 'flex', flexDirection: 'column', background: '#151A2A', borderRadius: '24px 24px 0 0',
          padding: '12px 14px calc(18px + env(safe-area-inset-bottom))', transform: abierta ? 'none' : 'translateY(105%)', transition: `transform ${rm ? 0 : 0.28}s ${CURVA}`, fontFamily: FONT, color: '#fff',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '2px 2px 10px' }}>
          <b style={{ fontSize: 16 }}>Elige una frase</b>
          <button type="button" onClick={() => cierra(null)} style={{ background: CAJA, color: '#fff', border: 'none', borderRadius: 999, padding: '8px 14px', fontFamily: FONT, fontSize: 13.5, fontWeight: 700, minHeight: 36, cursor: 'pointer' }}>Listo</button>
        </div>
        <div role="group" aria-label="Idioma" style={{ display: 'flex', background: CAJA, borderRadius: 12, padding: 3, marginBottom: 10 }}>
          {[['en', 'English'], ['es', 'Español']].map(([id, t]) => (
            <button
              key={id} type="button" aria-pressed={idioma === id} onClick={() => setIdioma(id)}
              style={{ flex: 1, border: 'none', borderRadius: 10, padding: '9px 0', minHeight: 36, fontFamily: FONT, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', background: idioma === id ? '#fff' : 'transparent', color: idioma === id ? '#0E1220' : TINTA_2 }}
            >
              {t}
            </button>
          ))}
        </div>
        <div style={{ overflowY: 'auto', overscrollBehavior: 'contain', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, paddingBottom: 4 }}>
          <form onSubmit={(e) => { e.preventDefault(); usaTuya(); }} style={{ gridColumn: '1 / -1', display: 'flex', gap: 8 }}>
            <input
              type="text" value={tuya} maxLength={FRASE_MAX} onChange={(e) => setTuya(e.target.value)} enterKeyHint="done"
              placeholder={idioma === 'es' ? 'Escribe la tuya' : 'Write your own'} aria-label="Escribe la tuya"
              style={{ flex: 1, minWidth: 0, background: CAJA, border: 'none', color: '#fff', borderRadius: 12, padding: '11px 12px', fontFamily: FONT, fontSize: 16, fontWeight: 600 }}
            />
            <button type="submit" disabled={!tuya.trim()} style={{ background: '#fff', color: '#0E1220', border: 'none', borderRadius: 12, padding: '0 16px', minHeight: 44, fontFamily: FONT, fontSize: 14, fontWeight: 800, cursor: 'pointer', opacity: tuya.trim() ? 1 : 0.5 }}>Usar</button>
          </form>
          {FRASES[idioma].map((t) => (
            <button
              key={t} type="button" aria-pressed={t === frase} onClick={() => { alElegir(t); cierra(t); }}
              style={{ background: CAJA, border: 'none', boxShadow: t === frase ? 'inset 0 0 0 1.5px #fff' : 'none', /* estilo-ok: la frase elegida se marca con su orilla blanca (maqueta) */ borderRadius: 14, minHeight: 62, display: 'grid', placeItems: 'center', padding: 8, cursor: 'pointer', fontFamily: FONT }}
            >
              <span style={{ background: '#2F7BFF', color: '#fff', fontSize: 13, fontWeight: 600, padding: '6px 10px', borderRadius: 14, textAlign: 'center', lineHeight: 1.25 }}>{t}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
