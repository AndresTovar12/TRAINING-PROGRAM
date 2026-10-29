import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { Heart } from 'lucide-react';
import { FONT, KP } from '@/lib/theme';
import { botonPrimario } from '@/features/inicio/estilos';

/* LAS PIEZAS DE LAS PANTALLAS DEL APPLE WATCH (fase 5, 29 oct 2026), copiadas del prototipo aprobado (artifact 1kttQGTS8apYoeDH2JVcoo): el reloj dibujado,
   los renglones de beneficios, la pista con la hoja de Salud en miniatura, los pasos numerados, el consejo gris y la hoja de ayuda. */

const FUENTE_RELOJ = '"SF Pro Rounded", ui-rounded, -apple-system, system-ui, sans-serif';
const FUENTE_IOS = '-apple-system, "SF Pro Text", system-ui, sans-serif';

// Una sola vez para toda la app: el giro del reloj sincronizando y el latido del corazón (con «reducir movimiento», más lentos).
const CSS = `
@keyframes tlr-giro{to{transform:rotate(360deg)}}
@keyframes tlr-late{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}
@keyframes tlr-entra{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:none}}
.tlr-giro{animation:tlr-giro .9s linear infinite}
.tlr-late{animation:tlr-late 1s ease-in-out infinite}
.tlr-entra{animation:tlr-entra .45s cubic-bezier(.2,.8,.2,1) both}
@media (prefers-reduced-motion: reduce){.tlr-giro{animation-duration:2.4s}.tlr-late{animation:none}.tlr-entra{animation:none}}
`;
export const EstilosDelReloj = () => <style>{CSS}</style>;

/**
 * El Apple Watch dibujado. `modo`: 'entreno' (el tiempo en azul), 'descanso' (en verde, con «Listo» y «Siguiente» que no se tocan) o 'sync' (girando).
 * Mide 176 × 288 y se pinta a `escala` (0.62 en las pantallas).
 */
export function RelojDibujado({ modo = 'entreno', titulo, tiempo, detalle, pulso, texto = 'Training Lab', escala = 0.62 }) {
  const desc = modo === 'descanso';
  const ancho = 176 * escala;
  const alto = 288 * escala;
  let pantalla;
  if (modo === 'sync') {
    pantalla = (
      <div style={{ flex: 1, display: 'grid', placeItems: 'center', alignContent: 'center', gap: 6, textAlign: 'center' }}>
        <div className="tlr-giro" style={{ width: 46, height: 46, borderRadius: '50%', border: '3px solid #23262E', borderTopColor: '#4F73FF' }} /> {/* estilo-ok: el dibujo del Apple Watch (metal, correa y su anillo de carga) */}
        <div style={{ font: `600 11.5px/1.3 ${FUENTE_IOS}`, color: '#C7C7CC', maxWidth: 110 }}>{texto}</div>
      </div>
    );
  } else {
    pantalla = (
      <>
        <div style={{ font: `700 13.5px/1.15 ${FUENTE_IOS}`, marginTop: 8, paddingRight: 22, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{titulo}</div>
        <div style={{ font: `800 30px/1 ${FUENTE_RELOJ}`, letterSpacing: -0.5, fontVariantNumeric: 'tabular-nums', color: desc ? '#33C78C' : '#4F73FF' }}>{tiempo}</div>
        {detalle && <div style={{ font: `500 10.5px/1.25 ${FUENTE_IOS}`, color: '#9A9AA2', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{detalle}</div>}
        {pulso && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 4, font: `800 15px ${FUENTE_RELOJ}`, color: '#FF595E', fontVariantNumeric: 'tabular-nums' }}>
            <Heart size={13} fill="currentColor" className="tlr-late" />{pulso}
          </div>
        )}
        {desc && (
          <>
            <span style={{ display: 'block', borderRadius: 999, minHeight: 24, lineHeight: '24px', textAlign: 'center', font: `700 12px ${FUENTE_IOS}`, background: '#33C78C', color: '#00140C', marginTop: 4 }}>Listo</span>
            <span style={{ display: 'block', borderRadius: 999, minHeight: 24, lineHeight: '24px', textAlign: 'center', font: `700 12px ${FUENTE_IOS}`, background: '#2A2A2E', color: '#fff', marginTop: 4 }}>Siguiente</span>
          </>
        )}
      </>
    );
  }
  return (
    <div role="img" aria-label="Apple Watch" style={{ width: ancho, height: alto, flex: 'none', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 176, height: 288, transform: `scale(${escala})`, transformOrigin: 'top left' }}>
        <div style={{ position: 'absolute', left: 34, right: 34, top: 0, height: 62, borderRadius: '16px 16px 6px 6px', background: 'linear-gradient(90deg,#2B3040,#3C4356 50%,#2B3040)' }} /> {/* estilo-ok: el dibujo del Apple Watch (metal, correa y su anillo de carga) */}
        <div style={{ position: 'absolute', left: 34, right: 34, bottom: 0, height: 62, borderRadius: '6px 6px 16px 16px', background: 'linear-gradient(90deg,#2B3040,#3C4356 50%,#2B3040)' }} /> {/* estilo-ok: el dibujo del Apple Watch (metal, correa y su anillo de carga) */}
        <div style={{ position: 'absolute', left: 8, right: 8, top: 42, bottom: 42, borderRadius: 46, background: 'linear-gradient(150deg,#4A4E57,#1A1C21 55%,#0E0F12)', boxShadow: 'inset 0 0 0 1.5px rgba(255,255,255,.12),0 18px 34px -8px rgba(10,12,20,.45)' }} /> {/* estilo-ok: el dibujo del Apple Watch (metal, correa y su anillo de carga) */}
        <div style={{ position: 'absolute', right: 0, top: 98, width: 9, height: 30, borderRadius: 4, background: 'linear-gradient(90deg,#24262C,#4A4E57)' }} /> {/* estilo-ok: el dibujo del Apple Watch (metal, correa y su anillo de carga) */}
        <div style={{ position: 'absolute', right: 2, top: 142, width: 5, height: 26, borderRadius: 3, background: '#2A2D34' }} />
        <div style={{ position: 'absolute', left: 17, right: 17, top: 51, bottom: 51, borderRadius: 38, background: '#000', overflow: 'hidden', color: '#fff', padding: '14px 13px 10px', display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span style={{ position: 'absolute', top: 9, right: 16, font: `600 10px ${FUENTE_IOS}`, color: '#fff' }}>9:41</span>
          {pantalla}
        </div>
      </div>
    </div>
  );
}

/** Un renglón de beneficio: ícono azul centrado, título en negro y su línea gris. */
export function Beneficio({ Icono, titulo, texto }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '40px 1fr', gap: 12, alignItems: 'start' }}>
      <span style={{ width: 40, height: 40, borderRadius: 12, background: KP.blueSoft, color: KP.blue, display: 'grid', placeItems: 'center' }}><Icono size={20} /></span>
      <span>
        <b style={{ display: 'block', fontSize: 15.5, fontWeight: 800, lineHeight: 1.3, color: KP.ink }}>{titulo}</b>
        <span style={{ display: 'block', fontSize: 13.5, color: KP.ink2, lineHeight: 1.4, marginTop: 2 }}>{texto}</span>
      </span>
    </div>
  );
}

export const Beneficios = ({ children }) => <div style={{ display: 'grid', gap: 12, margin: '2px 0 16px' }}>{children}</div>;

/** La hoja «Acceso a Salud» en miniatura, con «Activar todas» y «Permitir» marcados. */
function MiniHoja() {
  const marca = `0 0 0 2px #fff,0 0 0 3.5px ${KP.blue}`;
  return (
    <div aria-hidden="true" style={{ width: 96, borderRadius: 14, background: '#F2F2F7', padding: '8px 7px 7px', display: 'grid', gap: 5, boxShadow: '0 0 0 1px rgba(17,19,24,.06)', fontFamily: FUENTE_IOS }}>
      <div style={{ fontSize: 7, fontWeight: 600, textAlign: 'center', color: '#000' }}>Acceso a Salud</div>
      <div style={{ borderRadius: 7, background: '#E5E5EA', color: '#007AFF', fontSize: 7.5, fontWeight: 600, padding: '4px 6px', boxShadow: marca }}>Activar todas</div>
      <div style={{ display: 'grid', gap: 3, background: '#fff', borderRadius: 7, padding: '5px 6px' }}>
        {[0, 1, 2].map((k) => (
          <i key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ width: 34, height: 3, borderRadius: 2, background: '#D9DAE0' }} /><span style={{ width: 13, height: 7, borderRadius: 9, background: '#34C759' }} />
          </i>
        ))}
      </div>
      <div style={{ borderRadius: 9, background: '#007AFF', color: '#fff', fontSize: 7.5, fontWeight: 600, textAlign: 'center', padding: 4, boxShadow: marca }}>Permitir</div>
    </div>
  );
}

/** El recuadro gris de la pista: a la izquierda la hoja de Salud en miniatura (o un ícono), a la derecha el texto. */
export function Pista({ izquierda = <MiniHoja />, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 14, alignItems: 'center', borderRadius: 20, background: '#F4F5F8', padding: 14 }}>
      {izquierda}
      <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.45, color: KP.ink2 }}>{children}</p>
    </div>
  );
}

/** Los pasos numerados (abrir Salud, tocar tu foto…). `pasos`: `[texto, nota?]`. */
export function PasosApp({ pasos }) {
  return (
    <ol style={{ listStyle: 'none', margin: '0 0 16px', padding: 0, display: 'grid', gap: 12 }}>
      {pasos.map(([t, nota], i) => (
        <li key={t} style={{ display: 'grid', gridTemplateColumns: '30px 1fr', gap: 10, alignItems: 'start', fontSize: 15, fontWeight: 600, lineHeight: 1.4, color: KP.ink }}>
          <span aria-hidden="true" style={{ width: 28, height: 28, borderRadius: '50%', background: KP.blueSoft, color: KP.blue, font: `800 13.5px/28px ${FONT}`, textAlign: 'center' }}>{i + 1}</span>
          <span>{t}{nota && <small style={{ display: 'block', fontSize: 13, fontWeight: 500, color: KP.ink2, marginTop: 1 }}>{nota}</small>}</span>
        </li>
      ))}
    </ol>
  );
}

export const Consejo = ({ children }) => (
  <div style={{ borderRadius: 16, background: '#F4F5F8', padding: '12px 14px', fontSize: 13.5, color: KP.ink2, lineHeight: 1.45, marginBottom: 12 }}>{children}</div>
);

const TONO = { ok: [KP.mintSoft, KP.mint], azul: [KP.blueSoft, KP.blue], ambar: [KP.amberSoft, '#9A5B00'] };
/** El cuadro grande de color de arriba del resultado (palomita, corazón, alerta). */
export function IconoGrande({ tono = 'ok', Icono }) {
  const [fondo, color] = TONO[tono];
  return <div style={{ width: 72, height: 72, borderRadius: 24, display: 'grid', placeItems: 'center', margin: '8px 0 4px', background: fondo, color }}><Icono size={34} strokeWidth={2.6} /></div>;
}

/** Los pasos para cambiar los permisos en Salud (la misma lista en «No pudimos leer nada» y en «Cómo cambiar los permisos»). */
export const PASOS_DE_SALUD = (ultimo) => [['Abre Salud'], ['Toca tu foto', 'Arriba a la derecha.'], ['Entra a Apps y elige Training Lab'], [ultimo]];
export const PASOS_DE_LA_APP_WATCH = [['Abre la app Watch'], ['En «Mi reloj», baja hasta «Apps disponibles»'], ['Toca «Instalar» junto a Training Lab']];

/** Una hoja de abajo que solo explica (sin decidir nada): título, texto, pasos opcionales y «Entendido». */
export function HojaDeAyuda({ titulo, texto, pasos = null, onCerrar }) {
  useEffect(() => {
    const tecla = (e) => { if (e.key === 'Escape') onCerrar(); };
    document.addEventListener('keydown', tecla);
    return () => document.removeEventListener('keydown', tecla);
  }, [onCerrar]);
  return createPortal(
    <div role="presentation" onClick={(e) => { if (e.target === e.currentTarget) onCerrar(); }} style={{ position: 'fixed', inset: 0, zIndex: 3600, background: 'rgba(17,19,24,.38)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', fontFamily: FONT }}>
      <div role="dialog" aria-modal="true" aria-label={titulo} className="tlr-entra" style={{ width: '100%', maxWidth: 520, background: '#fff', borderRadius: '26px 26px 0 0', padding: '10px 20px calc(20px + env(safe-area-inset-bottom))' }}>
        <div aria-hidden="true" style={{ width: 38, height: 5, borderRadius: 3, background: '#DADDE4', margin: '0 auto 14px' }} />
        <h3 style={{ margin: '0 0 6px', fontSize: 20, fontWeight: 800, letterSpacing: -0.3, color: KP.ink }}>{titulo}</h3>
        <p style={{ margin: '0 0 16px', fontSize: 15, lineHeight: 1.45, color: KP.ink2 }}>{texto}</p>
        {pasos && <PasosApp pasos={pasos} />}
        <button type="button" className="kp-press" onClick={onCerrar} style={botonPrimario()}>Entendido</button>
      </div>
    </div>,
    document.body,
  );
}
