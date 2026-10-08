import { useAuth } from '@/contexts/AuthContext';
import { FONT, KP } from '@/lib/theme';

/**
 * «Continuar con Google», con su «o» de arriba si se pide (`conO`).
 *
 * Lo usan la pantalla de Entrar y las del inicio nuevo (`features/inicio`): Andrés, 8 oct 2026, «si el usuario le pica a
 * crear cuenta ya no puede continuar con google». Entrar y crear cuenta son lo mismo para Google (si la cuenta no existe,
 * se crea), así que el botón tiene que estar en los dos sitios.
 *
 * `antes` corre justo antes de salir a Google: ahí se guarda lo que ya se había contestado, porque al volver la pantalla
 * se arma de cero. Solo se dibuja cuando `VITE_GOOGLE_LOGIN` vale "1": un botón que no funciona es peor que no tenerlo
 * (los pasos para encenderlo están en `docs/entrar-con-google.md`).
 */
export default function BotonGoogle({ antes, conO = false, style }) {
  const { entrarConGoogle, googleDisponible } = useAuth();
  if (!googleDisponible) return null;
  return (
    <>
      {conO && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
          <span style={{ flex: 1, height: 1, background: KP.line }} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: KP.ink3 }}>o</span>
          <span style={{ flex: 1, height: 1, background: KP.line }} />
        </div>
      )}
      <button
        type="button"
        onClick={() => { antes?.(); entrarConGoogle(); }}
        className="kp-press"
        style={{
          width: '100%', minHeight: 50, borderRadius: KP.rBtn,
          border: `1.5px solid ${KP.line}`, background: KP.surface, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
          fontFamily: FONT, fontSize: 15, fontWeight: 700, color: KP.ink, touchAction: 'manipulation',
          ...style,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
          <path fill="#4285F4" d="M45.1 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1c4.2-3.8 6.6-9.5 6.6-16.1z" />
          <path fill="#34A853" d="M24 46c6 0 11-2 14.6-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.5 2.1-5.8 0-10.6-3.9-12.4-9.1H4.3v5.7C7.9 41 15.4 46 24 46z" />
          <path fill="#FBBC05" d="M11.6 28.1c-.5-1.3-.7-2.7-.7-4.1s.3-2.8.7-4.1v-5.7H4.3C2.8 17.1 2 20.4 2 24s.8 6.9 2.3 9.8l7.3-5.7z" />
          <path fill="#EA4335" d="M24 10.8c3.3 0 6.2 1.1 8.5 3.3l6.3-6.3C35 4.3 30 2 24 2 15.4 2 7.9 7 4.3 14.2l7.3 5.7c1.8-5.2 6.6-9.1 12.4-9.1z" />
        </svg>
        Continuar con Google
      </button>
    </>
  );
}
