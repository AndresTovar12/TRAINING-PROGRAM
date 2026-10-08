import { useAuth } from '@/contexts/AuthContext';
import { useIsWide } from '@/lib/useViewport';
import { FONT, KP } from '@/lib/theme';
import Recorrido from '@/features/inicio/Recorrido';

/**
 * «Ver el recorrido otra vez», desde Mi perfil. Es la misma pantalla del inicio, encima de todo (Mi perfil va en 3000).
 * Al terminar o saltar solo se cierra: aquí no hay nada que guardar.
 */
export default function RecorridoOtraVez({ onCerrar }) {
  const { profile, isAdmin } = useAuth();
  const compu = useIsWide();
  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 3200, overflowY: 'auto', fontFamily: FONT,
        display: 'flex', alignItems: compu ? 'flex-start' : 'stretch', justifyContent: 'center',
        padding: compu ? '28px 20px 40px' : 0,
        background: 'radial-gradient(1100px 620px at 50% -8%, #e7ecfe 0%, rgba(244,245,248,0) 60%), #f4f5f8',
      }}
    >
      <div
        className="animate-fade-in"
        style={compu
          ? {
            width: '100%', maxWidth: 560, background: KP.surface, borderRadius: 26, border: `1px solid ${KP.line}`,
            boxShadow: '0 24px 60px rgba(17,19,24,0.10)', padding: '22px 30px 26px', display: 'flex', flexDirection: 'column',
            minHeight: 540, position: 'relative',
          }
          : {
            width: '100%', display: 'flex', flexDirection: 'column', minHeight: '100svh', background: KP.surface, position: 'relative',
            padding: 'calc(14px + env(safe-area-inset-top, 0px)) 20px calc(22px + env(safe-area-inset-bottom, 0px))',
          }}
      >
        <Recorrido rol={isAdmin ? 'coach' : 'atleta'} conEquipo={!!profile?.trabaja_en_equipo} onTerminar={onCerrar} compu={compu} />
      </div>
    </div>
  );
}
