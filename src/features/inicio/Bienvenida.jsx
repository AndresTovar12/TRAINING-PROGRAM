import { Check, ChevronLeft, ChevronRight, Dumbbell, Loader2 } from 'lucide-react';
import { FONT, KP } from '@/lib/theme';
import { MOVIMIENTOS_DE_CELEBRACION } from '@/lib/celebracion';
import { useBarraDeEstadoClara } from '@/lib/barraDeEstado';
import { Punto } from '@/features/inicio/Dibujos';

/* LA BIENVENIDA (inicio nuevo, 30 oct 2026; antes «Listo»). Andrés: «esta pantalla es la que visualmente no me convence»: la de antes repetía en una tabla lo
   que la persona acababa de contestar. Ahora celebra y enseña LO QUE SIGUE: a quien tiene entrenador, su entrenador; a quien va por su cuenta, su primer
   entreno; al coach, nada (sus primeros pasos lo esperan en su panel). Lo contestado se cambia en Mi perfil.

   Entra igual que la celebración al terminar un entreno (`CelebracionLibre`, los mismos movimientos de `lib/celebracion`): el punto azul llena la pantalla.
   Luego, uno tras otro: una línea blanca que se dibuja de derecha a izquierda y llega al logo (como la ruta de una carrera), el logo que salta con su
   palomita verde y un anillo que se queda latiendo, el título, la línea, la tarjeta de lo que sigue, las pastillas y el botón.

   El título lleva el género SOLO si la persona lo dijo en «Sobre ti» (Andrés: «Bienvenido a Training Lab, ___»); si no lo dijo, o es coach, una forma que no
   lo supone. Con «reducir movimiento» todo aparece ya puesto. La barra del iPhone va en blanco sobre lo azul.

   `genero`: 'm' | 'h' | null. `coach`: `{ nombre, oficio, avatar }` (con entrenador) o null. `pastillas`: textos de lo que ya quedó. `via`: 'apple' | 'google' |
   'usuario'. `onCambiar`: abre la hoja del usuario de Mi perfil. */

const AZUL = '#1E40E0';
const MARCA = "'Bricolage Grotesque', 'Inter', system-ui, sans-serif";
const sube = (s) => ({ animation: `cele-sube 450ms ${s}s both` });

const iniciales = (nombre = '') => nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '·';

function Titulo({ nombre, genero, esCoach }) {
  const marca = <span style={{ whiteSpace: 'nowrap' }}>Training <span style={{ color: '#9FB2FF' }}>Lab</span></span>;
  const n = nombre ? `, ${nombre}` : '';
  const g = esCoach ? null : genero;
  if (g === 'm') return <>Bienvenida a {marca}{n}.</>;
  if (g === 'h') return <>Bienvenido a {marca}{n}.</>;
  return <>Te damos la bienvenida a {marca}{n}.</>;
}

export default function Bienvenida({ nombre, genero = null, esCoach = false, coach = null, pastillas = [], via = 'usuario', usuario = '', ocupado = false, onIr, onCambiar, onAtras, compu = false }) {
  useBarraDeEstadoClara(true);
  const conGenero = !esCoach && (genero === 'm' || genero === 'h');
  const linea = esCoach ? 'Tu app está lista. Tus primeros pasos te esperan en tu panel.' : coach ? `${coach.nombre.split(' ')[0]} ya te ve en su lista.` : 'Tu app está lista para tus entrenos.';
  const como = via === 'apple' ? 'con Apple' : via === 'google' ? 'con Google' : 'con tu usuario';

  return (
    <div className="cele" style={{ position: 'relative', overflow: 'hidden', background: '#0F1220', color: '#fff', fontFamily: FONT, minHeight: compu ? 680 : '100svh', display: 'flex', flexDirection: 'column', borderRadius: compu ? 26 : 0 }}>
      <style>{`${MOVIMIENTOS_DE_CELEBRACION}
        @keyframes bienv-respira { 0% { transform: scale(.92); opacity: 0; } 25% { opacity: .9; } 100% { transform: scale(1.35); opacity: 0; } }`}</style>
      {/* El punto azul que llena la pantalla, como en la celebración. */}
      <span aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', width: '260vmax', height: '260vmax', borderRadius: '50%', background: AZUL, transform: 'translate(-50%, -50%) scale(0.06)', animation: 'cele-llena 750ms cubic-bezier(.65,0,.35,1) 50ms forwards' }} />

      <div style={{ position: 'relative', zIndex: 1, flex: 1, display: 'flex', flexDirection: 'column', padding: compu ? '22px 30px 26px' : 'calc(14px + env(safe-area-inset-top, 0px)) 22px calc(14px + env(safe-area-inset-bottom, 0px))' }}>
        <div style={{ minHeight: 40, display: 'flex', alignItems: 'center' }}>
          {onAtras && (
            <button type="button" onClick={onAtras} aria-label="Atrás" disabled={ocupado} className="kp-press"
              style={{ width: 36, height: 36, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.14)', color: '#fff', display: 'grid', placeItems: 'center', cursor: 'pointer', padding: 0, ...sube(1.9) }}>
              <ChevronLeft size={18} />
            </button>
          )}
        </div>

        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', paddingBottom: 20 }}>
          {/* La línea que cruza la pantalla y llega al logo. */}
          <svg viewBox="0 0 358 120" aria-hidden="true" style={{ display: 'block', width: 'calc(100% + 22px)', height: 120, margin: '0 -22px -4px 0', overflow: 'visible' }}>
            <path
              d="M 392 16 C 330 -6, 286 60, 228 46 S 150 2, 112 40 S 58 96, 36 118" pathLength="1" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="5" strokeLinecap="round"
              style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: 'cele-trazo 750ms cubic-bezier(.45,0,.25,1) 0.7s forwards' }}
            />
          </svg>
          {/* El logo: la pesa en su cuadro blanco, con su palomita y un anillo que late. */}
          <div style={{ position: 'relative', width: 72, height: 72, borderRadius: 24, background: '#fff', color: AZUL, display: 'grid', placeItems: 'center', animation: 'cele-salta 600ms 1.35s both' }}>
            <Dumbbell size={34} strokeWidth={2.2} />
            <span aria-hidden="true" style={{ position: 'absolute', right: -9, top: -9, width: 30, height: 30, borderRadius: '50%', background: KP.mint, color: '#fff', display: 'grid', placeItems: 'center', boxShadow: '0 0 0 3px #1D3FD8', animation: 'cele-salta 500ms 1.75s both' }}>
              <Check size={14} strokeWidth={3.4} />
            </span>
            {/* estilo-ok: el anillo que late alrededor del logo */}
            <span aria-hidden="true" style={{ position: 'absolute', inset: -6, borderRadius: 30, border: '2px solid rgba(255,255,255,0.5)', opacity: 0, pointerEvents: 'none', animation: 'bienv-respira 2.6s ease-out 2.3s infinite' }} />
          </div>

          <h1 style={{ margin: '20px 0 10px', fontFamily: MARCA, fontWeight: 800, fontVariationSettings: "'opsz' 96", fontSize: conGenero ? 42 : 36, lineHeight: 0.98, letterSpacing: '-0.03em', textWrap: 'balance', ...sube(1.55) }}>
            <Titulo nombre={nombre} genero={genero} esCoach={esCoach} />
          </h1>
          <p style={{ margin: '0 0 22px', fontSize: 17, fontWeight: 600, lineHeight: 1.4, opacity: 0.88, ...sube(1.65) }}>{linea}</p>

          {!esCoach && (
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', background: '#fff', color: KP.ink, borderRadius: 24, padding: 16, boxShadow: '0 20px 40px -20px rgba(5,12,60,0.55)', ...sube(1.75) }}>
              {coach ? (
                <span style={{ width: 54, height: 54, borderRadius: '50%', background: AZUL, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 800, flex: 'none', overflow: 'hidden' }}>
                  {coach.avatar ? <img src={coach.avatar} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : iniciales(coach.nombre)}
                </span>
              ) : <Punto sombra={false} />}
              <div style={{ minWidth: 0, display: 'grid', gap: 2 }}>
                <b style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>{coach ? coach.nombre : 'Tu primer entreno'}</b>
                {coach?.oficio && <small style={{ fontSize: 13, fontWeight: 700, color: KP.ink2 }}>{coach.oficio}</small>}
                <span style={{ fontSize: 14.5, lineHeight: 1.4, color: KP.ink2, marginTop: 4 }}>
                  {coach ? 'Te está armando tu plan. Te avisamos cuando esté listo.' : 'Toca el punto de abajo y registra lo que hagas: correr, caminar, pesas.'}
                </span>
              </div>
            </div>
          )}

          {pastillas.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 14, ...sube(1.85) }}>
              {pastillas.map((t) => (
                <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, borderRadius: 999, padding: '7px 11px', fontSize: 13, fontWeight: 700, background: 'rgba(255,255,255,0.16)' }}>
                  <Check size={13} strokeWidth={3} color="#7CF0C5" />{t}
                </span>
              ))}
            </div>
          )}
        </div>

        <div style={{ ...sube(1.95) }}>
          <button
            type="button" onClick={onIr} disabled={ocupado} className="kp-press"
            style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', minHeight: 56, border: 'none', borderRadius: 17, background: '#fff', color: AZUL, fontFamily: FONT, fontSize: 16.5, fontWeight: 800, cursor: 'pointer', boxShadow: '0 12px 26px -12px rgba(0,0,0,0.4)', touchAction: 'manipulation' }}
          >
            {ocupado ? <Loader2 size={18} className="spin" /> : <>Ir a mi app <ChevronRight size={18} /></>}
          </button>
          {usuario && (
            <p style={{ margin: '10px 0 0', textAlign: 'center', fontSize: 13.5, opacity: 0.85 }}>
              Entras {como} como <b style={{ fontWeight: 800 }}>@{usuario}</b>{' '}
              <button type="button" onClick={onCambiar} style={{ border: 'none', background: 'none', color: 'inherit', fontFamily: FONT, fontSize: 13.5, fontWeight: 800, textDecoration: 'underline', textUnderlineOffset: 3, padding: 4, cursor: 'pointer' }}>Cambiar</button>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
