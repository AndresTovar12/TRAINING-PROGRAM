import { useState } from 'react';
import { T, KP, FONT } from '@/lib/theme';

/* Las piezas chicas que comparten las pantallas de mensajes: el avatar y el número rojo. (Las horas y la vista previa: `formato.js`.) */

const iniciales = (nombre) => {
  const p = String(nombre ?? '').trim().split(/\s+/).filter(Boolean);
  return ((p[0]?.[0] ?? '?') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase();
};

/** La foto de la persona, o sus iniciales sobre el azul suave de la app. */
export function Avatar({ nombre, url, tam = 44 }) {
  const [falla, setFalla] = useState(false);
  return (
    <span
      aria-hidden="true"
      style={{
        width: tam, height: tam, borderRadius: tam * 0.34, flexShrink: 0, overflow: 'hidden', display: 'grid', placeItems: 'center',
        background: T.accentBg, color: T.accent, fontFamily: FONT, fontWeight: 800, fontSize: tam * 0.36,
      }}
    >
      {url && !falla ? <img src={url} alt="" onError={() => setFalla(true)} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : iniciales(nombre)}
    </span>
  );
}

/** El número rojo de lo que falta por leer. Sin nada, no se dibuja. */
export function NumeroRojo({ n, tam = 20, style }) {
  if (!(n > 0)) return null;
  return (
    <span
      role="status" aria-label={`${n} sin leer`}
      style={{
        minWidth: tam, height: tam, padding: '0 6px', boxSizing: 'border-box', borderRadius: tam, background: KP.danger, color: '#fff', display: 'inline-grid', placeItems: 'center',
        fontFamily: FONT, fontSize: tam <= 18 ? 11 : 12, fontWeight: 800, lineHeight: 1, fontVariantNumeric: 'tabular-nums', ...style,
      }}
    >
      {n > 99 ? '99+' : n}
    </span>
  );
}
