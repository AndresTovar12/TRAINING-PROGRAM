import { useAuth } from '@/contexts/AuthContext';
import { useAviso } from '@/components/AvisoPasajero';
import { FONT, KP } from '@/lib/theme';

/**
 * «Continuar con Apple» (24 oct 2026). Solo se dibuja dentro de la app de iPhone: es el sistema de Apple y no existe en la web. Apple lo exige cuando la app ofrece otra
 * entrada con una cuenta externa (Google); Andrés prefiere ofrecerlo en vez de quitar Google. Sigue las reglas de Apple para su botón: negro, texto blanco, su logo.
 *
 * Va junto a `BotonGoogle` y acepta las mismas propiedades. El «o» de arriba lo dibuja Google si está encendido; si no, lo dibuja este botón.
 */
export default function BotonApple({ antes, conO = false, style }) {
  const { entrarConApple, appleDisponible, googleDisponible } = useAuth();
  const { avisa } = useAviso();
  if (!appleDisponible) return null;
  return (
    <>
      {conO && !googleDisponible && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0' }}>
          <span style={{ flex: 1, height: 1, background: KP.line }} />
          <span style={{ fontSize: 11.5, fontWeight: 700, color: KP.ink3 }}>o</span>
          <span style={{ flex: 1, height: 1, background: KP.line }} />
        </div>
      )}
      <button
        type="button"
        onClick={async () => {
          antes?.();
          const { error } = await entrarConApple();
          if (error) avisa(error.message);
        }}
        className="kp-press"
        style={{
          width: '100%', minHeight: 50, borderRadius: KP.rBtn, border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9, fontFamily: FONT, fontSize: 15.5, fontWeight: 600, touchAction: 'manipulation',
          marginTop: googleDisponible ? 10 : 0,
          ...style,
          // Las reglas de Apple para su botón: negro con texto blanco, pase lo que pase con el estilo que le pasen.
          background: '#000', color: '#fff',
        }}
      >
        <svg width="17" height="20" viewBox="0 0 17 20" aria-hidden="true" fill="#fff">
          <path d="M14.1 10.6c0-2.4 2-3.5 2.1-3.6-1.1-1.7-2.9-1.9-3.5-1.9-1.5-.2-2.9.9-3.7.9-.8 0-1.9-.9-3.1-.8-1.6 0-3.1.9-3.9 2.4-1.7 2.9-.4 7.2 1.2 9.5.8 1.2 1.8 2.5 3 2.4 1.2 0 1.7-.8 3.1-.8s1.9.8 3.1.8c1.3 0 2.1-1.2 2.9-2.3.9-1.3 1.3-2.6 1.3-2.7 0 0-2.5-1-2.5-4zM11.8 3.5c.7-.8 1.1-1.9 1-3-.9 0-2.1.6-2.8 1.4-.6.7-1.1 1.8-1 2.9 1.1.1 2.1-.5 2.8-1.3z" />
        </svg>
        Continuar con Apple
      </button>
    </>
  );
}
