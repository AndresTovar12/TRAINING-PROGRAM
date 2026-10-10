import { useState } from 'react';
import { Activity, ChevronDown, Loader2 } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE, eyebrow } from '@/lib/theme';
import { COLOR_DE_DEPORTE, ICONOS, TONOS } from './tonos';

/* Las piezas chicas que comparten todas las pantallas de métricas: tarjeta, dato grande, insignia de estado, pestañas, sección con ayuda, vacío. */

/** El cuadrito con el ícono de un deporte, en su color. */
export function MosaicoDeDeporte({ deporte, size = 40 }) {
  const Icono = ICONOS[deporte] ?? Activity;
  const color = COLOR_DE_DEPORTE[deporte] ?? COLOR_DE_DEPORTE.otro;
  return (
    <span aria-hidden="true" style={{ width: size, height: size, borderRadius: size * 0.3, flexShrink: 0, display: 'grid', placeItems: 'center', background: `${color}1F`, color }}>
      <Icono size={size * 0.5} />
    </span>
  );
}

/** Una tarjeta blanca (la de siempre del sistema Kinetic). */
export function Tarjeta({ children, style, relleno = 16, ...resto }) {
  return (
    <div {...resto} style={{ background: KP.surface, border: `1px solid ${KP.line}`, borderRadius: 20, boxShadow: KP.shCard, padding: relleno, ...style }}>
      {children}
    </div>
  );
}

/** Una cifra grande con su unidad y su rótulo: «142 lpm · FC media». */
export function Dato({ valor, unidad, etiqueta, color = LT.text, grande = false }) {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, color, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.05, ...NUM_STYLE }}>
        <span style={{ fontSize: grande ? 30 : 22 }}>{valor}</span>
        {unidad && <span style={{ fontSize: grande ? 14 : 12.5, fontWeight: 700, color: LT.text2, letterSpacing: 0 }}>{unidad}</span>}
      </div>
      <div style={{ fontSize: 12.5, fontWeight: 600, color: LT.text2, marginTop: 4 }}>{etiqueta}</div>
    </div>
  );
}

/** Un tiempo con las unidades chicas pegadas al número: «4 h 33 min». Nunca se parte en dos renglones, por angosta que sea la tarjeta. */
export function TiempoGrande({ seg, tamano = 30 }) {
  const s = Math.round(seg);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const unidad = (t) => <span style={{ fontSize: tamano * 0.45, fontWeight: 700, color: LT.text2, letterSpacing: 0, margin: '0 4px 0 2px' }}>{t}</span>;
  if (s < 60) return <span style={{ whiteSpace: 'nowrap' }}>{s}{unidad('s')}</span>;
  return (
    <span style={{ whiteSpace: 'nowrap' }}>
      {h > 0 && <>{h}{unidad('h')}</>}
      {(h === 0 || m > 0) && <>{h > 0 ? String(m).padStart(2, '0') : m}{unidad('min')}</>}
    </span>
  );
}

/** Una insignia de estado: «Atención», «Entrenando fuerte»… con su tono. */
export function Insignia({ tono = 'neutro', children, icono: Icono }) {
  const t = TONOS[tono] ?? TONOS.neutro;
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 999, background: t.soft, color: t.c, fontSize: 12.5, fontWeight: 800, whiteSpace: 'nowrap' }}>
      {Icono && <Icono size={13} strokeWidth={2.6} />}{children}
    </span>
  );
}

/** Las pestañas de arriba (Resumen · Entrenos · Carga · Recuperación). Una sola fila que se desplaza si no cabe. */
export function Pestanas({ items, valor, onChange, etiqueta }) {
  return (
    <div role="tablist" aria-label={etiqueta} style={{ display: 'flex', gap: 4, padding: 4, background: LT.surface2, borderRadius: 14, overflowX: 'auto', scrollbarWidth: 'none' }}>
      {items.map((it) => {
        const activa = it.id === valor;
        return (
          <button
            key={it.id} type="button" role="tab" aria-selected={activa} onClick={() => onChange(it.id)}
            style={{
              flex: '1 0 auto', minHeight: 40, padding: '0 clamp(8px, 2.6vw, 14px)', borderRadius: 11, border: 'none', cursor: 'pointer', fontFamily: FONT, fontSize: 'clamp(12.5px, 3.5vw, 14px)', fontWeight: 800, whiteSpace: 'nowrap',
              background: activa ? LT.surface : 'transparent', color: activa ? LT.text : LT.text2, boxShadow: activa ? '0 1px 3px rgba(17,19,24,0.12)' : 'none', touchAction: 'manipulation',
            }}
          >
            {it.titulo}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Una sección con título y, si hace falta, su ayuda en una frase («¿Qué significa?»), plegada: no estorba a quien ya lo sabe y está a un toque de quien no.
 */
export function Seccion({ titulo, ayuda, derecha, children, style }) {
  const [abierta, setAbierta] = useState(false);
  return (
    <section style={{ marginTop: 22, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
        <h3 style={{ margin: 0, flex: 1, minWidth: 0, ...eyebrow(LT.text2), fontSize: 12 }}>{titulo}</h3>
        {derecha}
        {ayuda && (
          <button
            type="button" onClick={() => setAbierta((a) => !a)} aria-expanded={abierta}
            style={{ border: 'none', background: 'transparent', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3, fontFamily: FONT, fontSize: 12.5, fontWeight: 700, color: LT.blue, padding: '4px 0', touchAction: 'manipulation' }}
          >
            ¿Qué significa? <ChevronDown size={14} style={{ transform: abierta ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }} />
          </button>
        )}
      </div>
      {ayuda && abierta && (
        <div style={{ marginBottom: 12, padding: '12px 14px', borderRadius: 14, background: KP.blueSoft, color: LT.text, fontSize: 14, lineHeight: 1.5, fontWeight: 500 }}>{ayuda}</div>
      )}
      {children}
    </section>
  );
}

/** Lo que se ve cuando todavía no hay nada que mostrar: un ícono, qué pasa y qué hacer. */
export function EstadoVacio({ icono: Icono, titulo, texto, children }) {
  return (
    <div style={{ textAlign: 'center', padding: '36px 18px', color: LT.text2 }}>
      <span style={{ width: 56, height: 56, borderRadius: 18, display: 'inline-grid', placeItems: 'center', background: KP.blueSoft, color: LT.blue, marginBottom: 14 }}>
        <Icono size={26} />
      </span>
      <div style={{ fontSize: 17, fontWeight: 800, color: LT.text, marginBottom: 6 }}>{titulo}</div>
      {texto && <div style={{ fontSize: 14.5, lineHeight: 1.5, fontWeight: 500, maxWidth: 420, margin: '0 auto 16px' }}>{texto}</div>}
      {children}
    </div>
  );
}

/** El indicador de «cargando» con su texto. */
export function Cargando({ texto = 'Cargando…' }) {
  return (
    <div role="status" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: 40, color: LT.text2, fontWeight: 600, fontSize: 14 }}>
      <Loader2 size={18} className="spin" /> {texto}
    </div>
  );
}

/** Un botón de la hoja: `principal` (azul), o de borde. */
export function Boton({ children, onClick, principal = false, icono: Icono, disabled = false, pequeno = false, ancho = false, type = 'button' }) {
  return (
    <button
      type={type} onClick={onClick} disabled={disabled} className="kp-press"
      style={{
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, minHeight: pequeno ? 40 : 48, padding: pequeno ? '0 14px' : '0 18px', borderRadius: 14, cursor: disabled ? 'default' : 'pointer',
        fontFamily: FONT, fontSize: pequeno ? 14 : 15.5, fontWeight: 800, width: ancho ? '100%' : undefined, touchAction: 'manipulation', opacity: disabled ? 0.55 : 1,
        border: principal ? 'none' : `1.5px solid ${LT.borderHi}`, color: principal ? '#fff' : LT.text,
        background: principal ? `linear-gradient(140deg, ${KP.blue}, ${KP.blueDk})` : LT.surface, boxShadow: principal ? KP.shBtn : 'none',
      }}
    >
      {Icono && <Icono size={pequeno ? 16 : 18} />}{children}
    </button>
  );
}

/** Una barra que se queda pegada al borde de abajo de la hoja mientras se desplaza (los botones de «Guardar»), de borde a borde. */
export function BarraFija({ children }) {
  return (
    <div
      style={{
        position: 'sticky', bottom: 'calc(var(--hoja-pb, 20px) * -1)', zIndex: 2, display: 'flex', gap: 10, flexWrap: 'wrap',
        margin: '16px calc(var(--hoja-px, 18px) * -1) calc(var(--hoja-pb, 20px) * -1)', padding: '12px var(--hoja-px, 18px) calc(14px + env(safe-area-inset-bottom, 0px))',
        background: LT.bg, borderTop: `1px solid ${KP.line}`,
      }}
    >
      {children}
    </div>
  );
}
