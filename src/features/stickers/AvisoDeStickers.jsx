import { useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import { FONT, LT } from '@/lib/theme';
import { ficha as fichaDe } from '@/lib/stickers/ficha';
import { catalogo, COLORES } from '@/lib/stickers/catalogo';
import Sticker from './Sticker';

/* EL AVISO EN LA PÁGINA DEL ENTRENO (stickers, sección 6; 28 oct 2026). Solo al venir de terminar: una tarjeta blanca con «Tus stickers están listos»,
   «N para compartir · toca uno», el chevron y, debajo, dos stickers reales en miniatura (Firma y Grande, en la tinta blanca sobre el fondo de la hoja).
   Tocarla abre la hoja. Sustituye al cuadro negro con el teléfono en miniatura. `entreno`: lo que pide `ficha()`. */

const PREFERIDOS = ['firma', 'grande', 'titular', 'fila', 'eco'];
// Cada mini mide 166 × 111 (el sticker ancho a 0.5533) si cabe; en un teléfono angosto se achican parejo para que entren los dos.
const ANCHO_MINI = 166;
const GAP = 8;

export default function AvisoDeStickers({ entreno, alAbrir }) {
  const f = useMemo(() => (entreno ? fichaDe(entreno) : null), [entreno]);
  const lista = useMemo(() => (f ? catalogo(f) : []), [f]);
  const tira = useRef(null);
  const [anchoTira, setAnchoTira] = useState(0);
  useLayoutEffect(() => {
    const el = tira.current;
    if (!el) return undefined;
    const mide = () => setAnchoTira(el.clientWidth);
    mide();
    if (typeof ResizeObserver !== 'function') return undefined;
    const ro = new ResizeObserver(mide);
    ro.observe(el);
    return () => ro.disconnect();
  }, [f]);
  if (!f || !lista.length) return null;
  const w = anchoTira > 0 ? Math.min(ANCHO_MINI, (anchoTira - GAP) / 2) : ANCHO_MINI;
  const alto = (w * 2) / 3;
  const minis = PREFERIDOS.map((id) => lista.find((x) => x.id === id)).filter(Boolean).slice(0, 2);
  return (
    <button
      type="button" onClick={alAbrir} className="kp-press"
      style={{ display: 'block', width: '100%', border: 'none', textAlign: 'left', background: '#fff', color: LT.text, borderRadius: 22, padding: '14px 16px 16px', cursor: 'pointer', fontFamily: FONT, boxShadow: '0 1px 2px rgba(15,18,32,.06)' }}
    >
      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <span>
          <b style={{ display: 'block', fontSize: 16, fontWeight: 800, letterSpacing: -0.15 }}>Tus stickers están listos</b>
          <span style={{ display: 'block', fontSize: 13, color: LT.text2, fontWeight: 600, marginTop: 2 }}>{lista.length} para compartir · toca uno</span>
        </span>
        <ChevronRight size={20} color={LT.text3} style={{ flex: 'none' }} />
      </span>
      <span ref={tira} aria-hidden="true" style={{ display: 'flex', gap: GAP, marginTop: 12, overflow: 'hidden' }}>
        {minis.map((item) => {
          // Un sticker alto va a la altura del mosaico; uno ancho, a lo ancho.
          const k = item.forma === 'alto' ? alto / 330 : w / 300;
          return (
            <span key={item.id} style={{ position: 'relative', flex: 'none', width: item.forma === 'alto' ? 300 * k : w, height: alto, borderRadius: 12, overflow: 'hidden', background: '#0E1220' }}>
              <span style={{ position: 'absolute', left: 0, top: 0, transform: `scale(${k.toFixed(4)})`, transformOrigin: 'top left', pointerEvents: 'none' }}>
                <Sticker item={item} f={f} color={COLORES[0]} />
              </span>
            </span>
          );
        })}
      </span>
    </button>
  );
}
