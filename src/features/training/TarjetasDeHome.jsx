import { ChevronRight, HeartPulse, Sparkles } from 'lucide-react';
import { LT, KP, FONT, NUM_STYLE } from '@/lib/theme';
import { separaFoto } from '@/lib/fotoConFoco';

/**
 * Las tarjetas de Home con más vida: «Salud» y la cinta de «Ciencia».
 *
 * Andrés, 7 oct 2026: «los botones están muy equis… el de salud sí importa mucho» (ahí se va a conectar el Apple
 * Watch) y «el de ciencia puede ser discreto pero coqueto». Se enseñaron tres ideas para cada una en una maqueta
 * (`docs/maquetas/2026-10-07-home-tarjetas.html`) y eligió Salud «B · Latido» y Ciencia en «cinta».
 *
 *   · SALUD: coral con un latido que viaja por abajo. Sin datos, un corazón que late; con dolor anotado, ese número en su lugar;
 *     con reloj, su veredicto de recuperación como título y cada medida (reposo, HRV, sueño) en un chip.
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

/** Cómo se dice el dolor del día: «dolor» con un coach de entrenamiento; «molestia» con los pacientes de un fisio (el dolor puede venir de cualquier parte). */
const NIVELES_DE_DOLOR = ['Dolor leve', 'Dolor moderado', 'Dolor fuerte'];
const NIVELES_DE_MOLESTIA = ['Molestia leve', 'Molestia moderada', 'Molestia fuerte'];
const etiquetaDeDolor = (n, salud) => (n === 0
  ? (salud ? 'Sin molestia' : 'Sin dolor')
  : (salud ? NIVELES_DE_MOLESTIA : NIVELES_DE_DOLOR)[n <= 3 ? 0 : n <= 6 ? 1 : 2]);

const MEDIDAS_DEL_RELOJ = [['Reposo', 'reposo', 'lpm'], ['HRV', 'hrv', 'ms'], ['Sueño', 'sueno', 'h']];

/**
 * Andrés, 10 oct 2026: la salud diaria queda en lo que sirve. Con reloj, el pulso en reposo, la variabilidad cardiaca (HRV) y el sueño llegan solos; lo único
 * que el atleta anota es el dolor muscular. Sin reloj, la tarjeta no pide nada más que eso.
 *
 * `dolor`: el de hoy (0 a 10) o null si no lo ha anotado. `reloj`: `useRecuperacionReciente()`. `salud`: el coach es un fisio (se dice «molestia»).
 * `tope`: el ancho máximo del botón en compu.
 */
export function TarjetaDeSalud({ dolor, reloj, salud = false, onAbrir, tope }) {
  const hayDolor = dolor != null;
  const hayAlgo = hayDolor || reloj.hayReloj;
  const estado = reloj.lectura?.titulo ?? (hayDolor ? etiquetaDeDolor(dolor, salud) : reloj.hayReloj ? 'Datos del reloj' : 'Sin medir');
  const chips = MEDIDAS_DEL_RELOJ.filter(([, k]) => reloj.recientes[k]);

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
            {hayAlgo ? 'Ver detalle' : 'Registrar'}
          </button>
        </div>
        <div
          className="tl-late" aria-label={hayDolor ? `${salud ? 'Molestia' : 'Dolor'} ${dolor} de 10` : undefined}
          style={{
            width: 64, height: 64, flexShrink: 0, borderRadius: 20, background: 'rgba(255,255,255,0.20)', display: 'grid', placeItems: 'center',
          }}
        >
          {hayDolor
            ? (
              <span style={{ textAlign: 'center', lineHeight: 1 }}>
                <span style={{ display: 'block', fontSize: 30, fontWeight: 800, letterSpacing: -1, ...NUM_STYLE }}>{dolor}</span>
                <span style={{ display: 'block', fontSize: 10.5, fontWeight: 700, marginTop: 3, opacity: 0.85 }}>{salud ? 'molestia' : 'dolor'}</span>
              </span>
            )
            : <HeartPulse size={34} strokeWidth={2} fill="rgba(255,255,255,0.22)" />}
        </div>
      </div>

      {chips.length > 0 && (
        <div style={{ position: 'relative', zIndex: 1, display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14 }}>
          {chips.map(([nombre, k, unidad]) => (
            <span key={k} style={{
              background: 'rgba(255,255,255,0.20)', borderRadius: 999, padding: '6px 10px', fontSize: 12, fontWeight: 700, ...NUM_STYLE,
            }}>
              {nombre} {reloj.recientes[k].valor} {unidad}
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

/**
 * La tarjeta de foto de Home: la foto de la fase de hoy (o la del plan) con su etiqueta, su título y «Ver programa».
 * Abre el programa completo. Con un solo programa va junto a la tarjeta azul de «Hoy te toca»; con equipo (varios
 * profesionales), junto a la de todos (en celular, debajo). La foto se recorta alrededor del punto que eligió quien
 * la puso (`lib/fotoConFoco.js`); sin foto, queda la tarjeta oscura.
 *
 * `banda`: va DEBAJO de la tarjeta de hoy y a todo el ancho (un celular): el título a la izquierda y «Ver programa» a la
 * derecha, en una sola línea. Quien la usa le pone también un `minHeight` chico.
 */
export function TarjetaDeFoto({ foto, etiqueta, titulo, boton, onAbrir, style, banda = false }) {
  const { url, x, y } = separaFoto(foto);
  const abre = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onAbrir(); } };
  return (
    <div
      role="button" tabIndex={0} onClick={onAbrir} onKeyDown={abre}
      style={{
        flex: 1, minWidth: 0, minHeight: 232, position: 'relative', overflow: 'hidden', borderRadius: KP.rCard, cursor: 'pointer',
        background: '#000', display: 'flex', flexDirection: 'column', justifyContent: 'space-between', ...style,
      }}
    >
      {url && (
        <img
          src={url} alt={titulo}
          style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${x}% ${y}%`, opacity: 0.92 }}
        />
      )}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, rgba(0,0,0,0.05) 35%, rgba(0,0,0,0.78) 100%)' }} />
      <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between', padding: '16px 16px 0' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{etiqueta}</span>
      </div>
      <div style={{ position: 'relative', padding: '0 16px 16px', ...(banda ? { display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 } : null) }}>
        <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.05, marginBottom: banda ? 0 : 12, minWidth: 0, overflowWrap: 'anywhere' }}>{titulo}</div>
        <div style={{
          background: '#fff', borderRadius: KP.rBtn, padding: banda ? '11px 16px' : 12, fontSize: 13, fontWeight: 600, color: '#111', textAlign: 'center',
          ...(banda ? { whiteSpace: 'nowrap', flexShrink: 0 } : null),
        }}>{boton}</div>
      </div>
    </div>
  );
}
