import { ChevronLeft } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import BotonApple from '@/components/BotonApple';
import BotonGoogle from '@/components/BotonGoogle';
import { FONT, KP } from '@/lib/theme';
import { letraChica } from '@/features/inicio/estilos';
import fotoFuerza from '@/assets/landing/fuerza.webp';
import fotoPista from '@/assets/landing/pista.webp';
import fotoYoga from '@/assets/landing/yoga.webp';
import fotoAgilidad from '@/assets/landing/agilidad.webp';
import fotoBosu from '@/assets/landing/bosu.webp';

/* LA PUERTA (inicio nuevo, 30 oct 2026; prototipo HUZVXJGnGrGaZeBq4e3wrv). La primera pantalla de quien no tiene sesión, en el teléfono.

   Antes la primera pantalla era el formulario de usuario y contraseña, con Google y Apple abajo como segunda opción. Ahora Apple y Google van primero: con el
   mismo botón se entra o se crea la cuenta, y no se teclea nada. Usuario y contraseña siguen a dos toques («Usar usuario y contraseña» → «Entrar»), para las
   atletas de hoy que entran así.

   Arriba, un mosaico de las fotos de la página de presentación que se mueve despacio y se desvanece hacia abajo; luego la marca y para qué es la app.

   `invitacion`: `{ nombre, coach, coach_oficio }` cuando se abrió el link de un entrenador (`ActivarInvitacion`): en vez de la marca, quién la invitó y su
   nombre. `onUsuario`: «Usar usuario y contraseña» (o «Crear cuenta con usuario y contraseña» con invitación). `antes`: corre antes de salir a Apple o Google
   (la invitación guarda su link). `onVolver`: la flecha de arriba (la tienda, la compu). `aviso`: por qué se pide entrar (conectar la IA, la tienda). */

const COLUMNAS = [[fotoFuerza, fotoYoga, fotoPista], [fotoPista, fotoBosu, fotoFuerza], [fotoAgilidad, fotoFuerza, fotoYoga]];

const iniciales = (nombre = '') => nombre.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || '·';

export function Marca({ tamano = 22, color = KP.ink, acento = KP.blue }) {
  return (
    <span role="img" aria-label="Training Lab" style={{ fontFamily: "'Bricolage Grotesque', 'Inter', system-ui, sans-serif", fontWeight: 800, fontVariationSettings: "'opsz' 96", letterSpacing: '-0.03em', fontSize: tamano, lineHeight: 1, color, whiteSpace: 'nowrap' }}>
      Training <span style={{ color: acento }}>Lab</span>
    </span>
  );
}

function Mosaico() {
  return (
    <div aria-hidden="true" style={{ position: 'relative', flex: 1, minHeight: 0, overflow: 'hidden' }}>
      <div style={{ position: 'absolute', left: -18, right: -18, top: 'calc(env(safe-area-inset-top, 0px) - 30px)', display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 10 }}>
        {COLUMNAS.map((fotos, c) => (
          <div key={c} className={`puerta-col puerta-col-${c}`} style={{ display: 'grid', gap: 10, marginTop: [0, -70, -22][c] }}>
            {fotos.map((f, k) => (
              <div key={k} style={{ aspectRatio: '3 / 4', borderRadius: 22, background: `#E9EBF0 url(${f}) center / cover no-repeat` }} />
            ))}
          </div>
        ))}
      </div>
      {/* estilo-ok: arriba el blanco tapa la barra del iPhone y abajo las fotos se desvanecen hacia el texto */}
      <div style={{ position: 'absolute', inset: '0 0 auto 0', height: 'calc(env(safe-area-inset-top, 0px) + 40px)', background: 'linear-gradient(180deg, #fff 0, #fff calc(env(safe-area-inset-top, 0px) - 6px), rgba(255,255,255,0))' }} />
      {/* estilo-ok: el mosaico se desvanece hacia el texto */}
      <div style={{ position: 'absolute', inset: 'auto 0 0 0', height: '46%', background: 'linear-gradient(180deg, rgba(255,255,255,0), #fff 92%)' }} />
    </div>
  );
}

export default function Puerta({ invitacion = null, onUsuario, antes, onVolver, aviso, compu = false }) {
  const { googleDisponible } = useAuth();
  const nombreCoach = (invitacion?.coach || '').trim();
  const primerNombreCoach = nombreCoach.split(/\s+/)[0] || 'tu entrenador';

  return (
    <div style={{
      position: 'relative', display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#fff', fontFamily: FONT,
      ...(compu ? { height: 'min(820px, calc(100svh - 56px))', borderRadius: 26 } : { minHeight: '100svh', height: '100svh' }),
    }}>
      <style>{`
        @keyframes puerta-deriva { from { transform: translateY(0); } to { transform: translateY(-46px); } }
        .puerta-col { animation: puerta-deriva 26s ease-in-out infinite alternate; }
        .puerta-col-1 { animation-duration: 30s; animation-direction: alternate-reverse; }
        .puerta-col-2 { animation-duration: 34s; }
        @media (prefers-reduced-motion: reduce) { .puerta-col { animation: none; } }
      `}</style>
      <Mosaico />
      {onVolver && (
        <button
          type="button" onClick={onVolver} aria-label="Volver" className="kp-press"
          style={{ position: 'absolute', zIndex: 2, top: 'calc(10px + env(safe-area-inset-top, 0px))', left: 16, width: 40, height: 40, borderRadius: '50%', border: 'none', background: 'rgba(255,255,255,0.92)', color: KP.ink, display: 'grid', placeItems: 'center', cursor: 'pointer', boxShadow: '0 4px 14px rgba(17,19,24,0.12)' }}
        >
          <ChevronLeft size={20} />
        </button>
      )}

      <div style={{ flex: 'none', padding: '0 24px', marginTop: -58, position: 'relative', zIndex: 1 }}>
        {aviso && (
          <div style={{ marginBottom: 12, padding: '10px 14px', borderRadius: 14, background: KP.blueSoft, color: KP.blueDk, fontSize: 13.5, fontWeight: 700, lineHeight: 1.4 }}>{aviso}</div>
        )}
        {invitacion ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: KP.blueSoft, borderRadius: 16, padding: '10px 12px', marginBottom: 14 }}>
              <span style={{ width: 38, height: 38, borderRadius: '50%', background: KP.blue, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 14, fontWeight: 800, flex: 'none' }}>{iniciales(nombreCoach)}</span>
              <span style={{ minWidth: 0 }}>
                <b style={{ display: 'block', fontSize: 14.5, lineHeight: 1.25, color: KP.ink }}>{nombreCoach || 'Tu entrenador'} te invitó</b>
                <span style={{ display: 'block', fontSize: 12.5, color: KP.ink2 }}>{[invitacion.coach_oficio, 'ya te tiene en su lista'].filter(Boolean).join(' · ')}</span>
              </span>
            </div>
            <h1 style={{ margin: '0 0 6px', fontSize: 31, fontWeight: 800, lineHeight: 1.06, letterSpacing: -0.9, color: KP.ink, textWrap: 'balance' }}>
              Hola{invitacion.nombre ? `, ${invitacion.nombre}` : ''}
            </h1>
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.45, color: KP.ink2, fontWeight: 500, textWrap: 'pretty' }}>
              Entra con Apple o Google y ya quedas con {primerNombreCoach}. Nada que llenar.
            </p>
          </>
        ) : (
          <>
            <Marca />
            <h1 style={{ margin: '12px 0 6px', fontSize: 31, fontWeight: 800, lineHeight: 1.06, letterSpacing: -0.9, color: KP.ink, textWrap: 'balance' }}>Entrena con propósito.</h1>
            <p style={{ margin: 0, fontSize: 15.5, lineHeight: 1.45, color: KP.ink2, fontWeight: 500, textWrap: 'pretty' }}>Tu plan, tus entrenos y tu Apple Watch, en un solo lugar.</p>
          </>
        )}
      </div>

      <div style={{ flex: 'none', display: 'grid', gap: 10, padding: '20px 24px calc(16px + env(safe-area-inset-bottom, 0px))' }}>
        <BotonApple antes={antes} style={{ minHeight: 54, borderRadius: 17, fontSize: 16, fontWeight: 700, marginTop: 0 }} />
        {/* estilo-ok: el botón blanco de Google lleva su orilla fina (reglas de marca de Google) */}
        <BotonGoogle antes={antes} style={{ minHeight: 54, borderRadius: 17, fontSize: 16, background: '#fff', boxShadow: 'inset 0 0 0 1px #DADDE3' }} />
        <button
          type="button" onClick={onUsuario}
          style={{ border: 'none', background: 'none', color: KP.ink, fontFamily: FONT, fontSize: 15, fontWeight: 700, minHeight: 44, padding: 8, cursor: 'pointer', touchAction: 'manipulation' }}
        >
          {invitacion ? 'Crear cuenta con ' : 'Usar '}<span style={{ color: KP.blue }}>usuario y contraseña</span>
        </button>
        <p style={letraChica}>
          {invitacion ? 'Tu nombre y tu entrenador ya vienen puestos.' : googleDisponible ? 'Con Apple o Google entras o creas tu cuenta con el mismo botón.' : 'Con Apple entras o creas tu cuenta con el mismo botón.'}
        </p>
      </div>
    </div>
  );
}
