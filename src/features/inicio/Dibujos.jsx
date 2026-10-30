import { Play } from 'lucide-react';
import { FONT, KP } from '@/lib/theme';
import fotoFuerza from '@/assets/landing/fuerza.webp';
import fotoBosu from '@/assets/landing/bosu.webp';
import fotoAgilidad from '@/assets/landing/agilidad.webp';

/* LOS DIBUJOS DE LAS PREGUNTAS DE DOS RESPUESTAS (estilo C del inicio nuevo, 30 oct 2026). Son piezas de la app, no ilustraciones: el código con su QR que
   te da tu entrenador, el punto de «Registrar» de la barra de abajo, las caras de un equipo y los videos de los ejercicios. Así la persona ve lo que va a
   tener antes de contestar. */

const FILAS_DEL_QR = ['1110111', '1010101', '1110111', '0001000', '1101011', '0110110', '1011101'];

function Qr({ lado }) {
  return (
    <svg viewBox="0 0 7 7" width={lado} height={lado} aria-hidden="true" style={{ fill: KP.ink, background: '#fff', borderRadius: 6, padding: 3, flex: 'none' }}>
      {FILAS_DEL_QR.flatMap((fila, y) => [...fila].map((c, x) => (c === '1' ? <rect key={`${x}-${y}`} x={x} y={y} width="1" height="1" /> : null)))}
    </svg>
  );
}

/** El código de un entrenador en su tarjeta blanca, con su QR. `codigo`: lo que se ve (sin código, unos puntos). */
export function DibujoCodigo({ codigo = '', chico = false }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: chico ? 10 : 12, background: '#fff', borderRadius: 18, padding: chico ? '8px 12px 8px 8px' : '10px 16px 10px 10px', boxShadow: '0 6px 18px -8px rgba(17,19,24,0.25)' }}>
      <Qr lado={chico ? 32 : 44} />
      <span style={{ fontFamily: FONT, fontWeight: 800, fontSize: chico ? 16 : 20, letterSpacing: chico ? 2 : 3, color: KP.ink, fontVariantNumeric: 'tabular-nums', maxWidth: 170, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {codigo || '······'}
      </span>
    </div>
  );
}

/** El punto azul de «Registrar», el de la barra de abajo. */
export function Punto({ lado = 54, sombra = true }) {
  return (
    <span aria-hidden="true" style={{ width: lado, height: lado, borderRadius: '50%', background: KP.blue, display: 'grid', placeItems: 'center', flex: 'none', boxShadow: sombra ? '0 0 0 4px #fff, 0 8px 20px rgba(30,64,224,0.35)' : 'none' }}>
      <i style={{ width: Math.round(lado * 0.3), height: Math.round(lado * 0.3), borderRadius: '50%', background: '#fff' }} />
    </span>
  );
}

export function DibujoPunto() {
  return (
    <div style={{ display: 'grid', justifyItems: 'center', gap: 8 }}>
      <Punto />
      <span style={{ fontFamily: FONT, fontSize: 12, fontWeight: 700, color: KP.ink2 }}>Registrar</span>
    </div>
  );
}

function Cara({ texto, color, grande = false }) {
  return (
    <span style={{
      width: grande ? 62 : 48, height: grande ? 62 : 48, borderRadius: '50%', display: 'grid', placeItems: 'center', color: '#fff', background: color,
      fontFamily: FONT, fontSize: grande ? 19 : 15, fontWeight: 800, boxShadow: '0 0 0 3px #fff', flex: 'none', position: 'relative', zIndex: grande ? 1 : 0,
    }}>
      {texto}
    </span>
  );
}

/** Tres caras: tú al centro y dos colegas a los lados. `iniciales`: las tuyas. */
export function DibujoEquipo({ iniciales = 'TÚ' }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 0 }}>
      <Cara texto="FI" color={KP.blue} />
      <span style={{ marginLeft: -2 }}><Cara texto={iniciales} color={KP.ink} grande /></span>
      <span style={{ marginLeft: -2 }}><Cara texto="NU" color="#EC7FB0" /></span>
    </div>
  );
}

/** Tres videos de ejercicios y cuántos trae Training Lab. */
export function DibujoEjercicios({ cuantos = 118 }) {
  return (
    <div aria-hidden="true" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {[fotoFuerza, fotoBosu, fotoAgilidad].map((f) => (
        <span key={f} style={{ width: 56, height: 72, borderRadius: 14, background: `#E9EBF0 url(${f}) center / cover no-repeat`, display: 'grid', placeItems: 'center', color: '#fff', boxShadow: '0 6px 16px -8px rgba(17,19,24,0.4)' }}>
          <Play size={18} fill="currentColor" style={{ filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.4))' }} />
        </span>
      ))}
      <b style={{ fontFamily: FONT, fontSize: 22, fontWeight: 800, marginLeft: 6, color: KP.ink }}>{cuantos}</b>
    </div>
  );
}
