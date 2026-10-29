import { useMemo } from 'react';
import { ChevronRight } from 'lucide-react';
import { FONT, LT } from '@/lib/theme';
import { ficha as fichaDe } from '@/lib/stickers/ficha';
import { catalogo } from '@/lib/stickers/catalogo';
import './stickers.css';

/* EL AVISO EN LA PÁGINA DEL ENTRENO (stickers, sección 6; 28 oct 2026). Solo al venir de terminar: una tarjeta blanca con dos stickers en abanico a la izquierda
   (el negro con el número del entreno y el azul con la marca), «Tus stickers están listos» y «21 diseños con tus números, para tus historias». Tocarla abre la hoja.
   Fase 7 (29 oct 2026, prototipo de caminos): el abanico sustituye a las dos miniaturas anchas.
   `entreno`: lo que pide `ficha()` (de ahí sale cuántos diseños hay). `numero`: `{ valor, unidad }`, el número protagonista de la página («5.00 km», «16 sets»). */

const MARCA = { fontFamily: "'Bricolage Grotesque', 'Inter', system-ui, sans-serif", fontVariationSettings: "'opsz' 96", fontWeight: 800, letterSpacing: '-0.04em' };
const tarjeta = (estilo) => ({
  position: 'absolute', top: 4, width: 44, height: 66, borderRadius: 9, display: 'grid', placeItems: 'center', textAlign: 'center', color: '#fff', overflow: 'hidden',
  boxShadow: '0 6px 14px -5px rgba(17,19,24,0.45)', ...estilo,
});

export default function AvisoDeStickers({ entreno, numero = null, alAbrir }) {
  const total = useMemo(() => { try { return entreno ? catalogo(fichaDe(entreno)).length : 0; } catch { return 0; } }, [entreno]);
  if (!total) return null;
  const valor = String(numero?.valor ?? '');
  return (
    <button
      type="button" onClick={alAbrir} className="kp-press"
      style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', border: 'none', textAlign: 'left', background: '#fff', color: LT.text, borderRadius: 22, padding: '14px 12px 14px 12px', cursor: 'pointer', fontFamily: FONT }}
    >
      <span aria-hidden="true" style={{ position: 'relative', width: 82, height: 74, flex: 'none' }}>
        <style>{'@keyframes abanico-1{from{transform:rotate(0) translateX(14px)}}@keyframes abanico-2{from{transform:rotate(0) translateX(-14px)}}@media (prefers-reduced-motion:reduce){.abanico-stk{animation:none!important}}'}</style>
        <span className="abanico-stk" style={tarjeta({ left: 2, zIndex: 2, background: '#111318', transform: 'rotate(-8deg)', animation: 'abanico-1 .55s cubic-bezier(.23,1,.32,1) .15s both' })}>
          <span style={{ ...MARCA, fontSize: valor.length > 4 ? 10 : 12, lineHeight: 0.9 }}>{valor}<small style={{ display: 'block', marginTop: 2, fontSize: 7, color: '#9DB4FF' }}>{numero?.unidad}</small></span>
        </span>
        <span className="abanico-stk" style={tarjeta({ left: 36, background: '#1E40E0', transform: 'rotate(7deg)', placeItems: 'center start', animation: 'abanico-2 .55s cubic-bezier(.23,1,.32,1) .15s both' })}>
          <span style={{ ...MARCA, fontSize: 7.5, lineHeight: 1.05, textAlign: 'left', marginLeft: 13 }}>Training<br /><span style={{ color: '#9DB4FF' }}>Lab</span></span>
        </span>
      </span>
      <span style={{ flex: 1, minWidth: 0 }}>
        <b style={{ display: 'block', fontSize: 16, fontWeight: 800, lineHeight: 1.3, letterSpacing: -0.2, textWrap: 'balance' }}>Tus stickers están listos</b>
        <span style={{ display: 'block', fontSize: 13.5, color: LT.text2, marginTop: 3, lineHeight: 1.4 }}>{total} diseños con tus números, para tus historias.</span>
      </span>
      <ChevronRight size={18} color={LT.text3} style={{ flex: 'none' }} />
    </button>
  );
}
