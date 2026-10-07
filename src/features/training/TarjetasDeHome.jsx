import { ChevronRight, HeartPulse, Sparkles } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE } from '@/lib/theme';

/**
 * Las tarjetas de Home con más vida: «Salud» y la cinta de «Ciencia».
 *
 * Andrés, 7 oct 2026: «los botones están muy equis… el de salud sí importa mucho» (ahí se va a conectar el Apple
 * Watch) y «el de ciencia puede ser discreto pero coqueto». Se enseñaron tres ideas para cada una en una maqueta
 * (`docs/maquetas/2026-10-07-home-tarjetas.html`) y eligió Salud «B · Latido» y Ciencia en «cinta».
 *
 *   · SALUD: coral con un latido que viaja por abajo. Sin datos, un corazón que late; con los cuatro indicadores del
 *     día, el puntaje en su lugar y cada indicador en un chip, con las mismas palabras de la hoja de Salud.
 *   · CIENCIA: una cinta lavanda de una línea. Es lo que menos se usa: no pide más atención que esa.
 *
 * Las animaciones se apagan con `prefers-reduced-motion`.
 */
const ESTILOS = `
@keyframes tl-late{0%,100%{transform:scale(1)}12%{transform:scale(1.10)}24%{transform:scale(1)}36%{transform:scale(1.06)}48%{transform:scale(1)}}
@keyframes tl-viaja{from{stroke-dashoffset:140}to{stroke-dashoffset:0}}
@keyframes tl-brilla{0%,70%,100%{transform:scale(1) rotate(0)}80%{transform:scale(1.18) rotate(8deg)}90%{transform:scale(1) rotate(0)}}
.tl-late{animation:tl-late 1.4s ease-in-out infinite}
.tl-ecg path{stroke-dasharray:28 112;animation:tl-viaja 2.6s linear infinite}
.tl-brilla{animation:tl-brilla 3.6s ease-in-out infinite}
@media (prefers-reduced-motion: reduce){.tl-late,.tl-ecg path,.tl-brilla{animation:none}}
`;

const CORAL = 'linear-gradient(140deg, #FF8A5C 0%, #F2555A 52%, #DD4A92 100%)';
const BRILLO = 'radial-gradient(circle at 92% 6%, rgba(255,255,255,0.30), transparent 44%)';
const BORDE_LAVANDA = '#E2DAFF';
const LAVANDA_OSCURO = '#5B3FD6';

/** Los cuatro indicadores del día, como los llama la hoja de Salud. */
const INDICADORES = [['Sueño', 'sleep'], ['Fatiga', 'fatigue'], ['Dolor', 'soreness'], ['Motivación', 'motivation']];

/**
 * `puntaje`: el del día (0 a 10) o null si falta algo. `dia`: lo anotado hoy (`sleep`, `fatigue`, `soreness`,
 * `motivation`). `tope`: el ancho máximo del botón en compu.
 */
export function TarjetaDeSalud({ puntaje, dia, onAbrir, tope }) {
  const medido = puntaje !== null;
  const estado = !medido ? 'Sin medir' : puntaje >= 7 ? 'Listo' : puntaje >= 5 ? 'Carga media' : 'Recuperación';
  const chips = medido ? INDICADORES.filter(([, k]) => dia?.[k] != null) : [];

  return (
    <div
      onClick={onAbrir}
      style={{
        flex: '1 1 0', minWidth: 200, position: 'relative', overflow: 'hidden', borderRadius: KP.rCard, cursor: 'pointer',
        padding: '20px 20px 54px', color: '#fff', background: `${BRILLO}, ${CORAL}`, boxShadow: '0 8px 22px rgba(242,85,90,0.28)',
      }}
    >
      <style>{ESTILOS}</style>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, fontWeight: 600 }}>
        <span style={{
          width: 34, height: 34, borderRadius: 11, background: 'rgba(255,255,255,0.22)', display: 'grid', placeItems: 'center', flexShrink: 0,
        }}><HeartPulse size={19} /></span>
        Salud
      </div>

      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginTop: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: -0.5, lineHeight: 1.1 }}>{estado}</div>
          {/* Un botón de verdad (con el teclado se alcanza); la tarjeta entera también abre. */}
          <button
            type="button" className="kp-press" onClick={(e) => { e.stopPropagation(); onAbrir(); }}
            style={{
              display: 'block', marginTop: 14, border: 'none', borderRadius: KP.rBtn, padding: '12px 20px', cursor: 'pointer', fontFamily: FONT,
              background: '#fff', color: '#C0314F', fontSize: 13.5, fontWeight: 700, ...tope,
            }}
          >
            {medido ? 'Ver detalle' : 'Registrar'}
          </button>
        </div>
        <div
          className="tl-late" aria-label={medido ? `Puntaje ${puntaje}` : undefined}
          style={{
            width: 64, height: 64, flexShrink: 0, borderRadius: 20, background: 'rgba(255,255,255,0.20)', display: 'grid', placeItems: 'center',
          }}
        >
          {medido
            ? <span style={{ fontSize: 34, fontWeight: 800, letterSpacing: -1, ...NUM_STYLE }}>{puntaje.toFixed(1)}</span>
            : <HeartPulse size={34} strokeWidth={2} fill="rgba(255,255,255,0.22)" />}
        </div>
      </div>

      {chips.length > 0 && (
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
          {chips.map(([nombre, k]) => (
            <span key={k} style={{
              background: 'rgba(255,255,255,0.20)', borderRadius: 999, padding: '6px 10px', fontSize: 12, fontWeight: 700, ...NUM_STYLE,
            }}>
              {nombre} {Number(dia[k])}
            </span>
          ))}
        </div>
      )}

      {/* El latido viaja por su propia franja de abajo: nunca pasa por encima del texto. */}
      <svg
        className="tl-ecg" viewBox="0 0 300 54" preserveAspectRatio="none" aria-hidden="true"
        style={{ position: 'absolute', left: 0, right: 0, bottom: 8, width: '100%', height: 40, opacity: 0.55, pointerEvents: 'none' }}
      >
        <path
          d="M0 30 H70 L82 30 L90 8 L102 50 L112 20 L120 30 H190 L202 30 L210 12 L220 44 L228 26 L234 30 H300" pathLength="100"
          fill="none" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

/** Ciencia: una cinta lavanda de una línea (la tarjeta que menos se usa). */
export function CintaDeCiencia({ onAbrir }) {
  return (
    <button
      type="button" onClick={onAbrir} className="kp-press"
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%', textAlign: 'left', cursor: 'pointer', fontFamily: FONT,
        background: KP.violetSoft, border: `1px solid ${BORDE_LAVANDA}`, borderRadius: 18, padding: '11px 14px',
      }}
    >
      <style>{ESTILOS}</style>
      <span style={{
        width: 36, height: 36, borderRadius: '50%', background: '#fff', display: 'grid', placeItems: 'center', flexShrink: 0,
        boxShadow: '0 2px 8px rgba(124,92,255,0.18)',
      }}>
        <Sparkles size={18} color={KP.violet} className="tl-brilla" />
      </span>
      <span style={{ flex: 1, minWidth: 0, lineHeight: 1.25 }}>
        <span style={{ display: 'block', fontSize: 11.5, fontWeight: 700, color: LAVANDA_OSCURO, opacity: 0.8 }}>Ciencia</span>
        <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: LT.text }}>El porqué de tu plan</span>
      </span>
      <ChevronRight size={16} color={KP.violet} style={{ flexShrink: 0 }} />
    </button>
  );
}
