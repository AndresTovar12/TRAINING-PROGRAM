import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { verInvitacion } from '@/lib/api';
import { FONT, KP } from '@/lib/theme';
import { useIsWide } from '@/lib/useViewport';
import Puerta from '@/features/auth/Puerta';
import Inicio from '@/features/inicio/Inicio';
import { guardaInvitacionPendiente } from '@/features/inicio/marcas';

/**
 * Lo que ve el atleta cuando abre el link que le mandó su entrenador.
 *
 * Andrés, 24 sep 2026: "cuando lo abra ya no tiene que llenar ni su nombre ni su apellido ni su coach, porque es información que ya tiene". De ahí el saludo
 * por su nombre antes de pedirle nada: un link que abre un formulario en blanco no se distingue de uno falso.
 *
 * Inicio nuevo (30 oct 2026): es LA PUERTA (`Puerta`), con quién la invitó arriba. Antes era un formulario de cinco campos y luego siete pantallas más.
 *   · Con Apple o Google: «Entra con Apple o Google y ya quedas con Carlos. Nada que llenar.» El link se guarda antes de salir (`marcas.js`) y, al volver
 *     con sesión, App.jsx lo reclama (`activar-invitacion`, modo `reclamar`): la cuenta nueva queda con su coach y lo que ya le preparó.
 *   · Con «Crear cuenta con usuario y contraseña»: el inicio en modo `invitacion` (usuario y contraseña, y el correo); la cuenta nace con `activar`.
 * Después, los dos siguen igual: «Sobre ti», el paso de Salud y la bienvenida.
 */
export default function ActivarInvitacion({ token, onSalir }) {
  const compu = useIsWide();
  const [cargando, setCargando] = useState(true);
  const [datos, setDatos] = useState(null);
  const [error, setError] = useState('');
  const [conUsuario, setConUsuario] = useState(false);

  useEffect(() => {
    let vivo = true;
    verInvitacion(token)
      .then((d) => { if (vivo) setDatos(d); })
      .catch((e) => { if (vivo) setError(e.message); })
      .finally(() => { if (vivo) setCargando(false); });
    return () => { vivo = false; };
  }, [token]);

  if (conUsuario && datos) {
    return <Inicio key="invitacion" modo="invitacion" invitacion={{ token, datos }} onVolver={() => setConUsuario(false)} />;
  }

  const marco = (hijos) => (
    <div style={{
      minHeight: '100svh', display: 'flex', alignItems: compu ? 'center' : 'stretch', justifyContent: 'center', fontFamily: FONT,
      padding: compu ? '28px 20px' : 0, background: compu ? '#F4F5F8' : '#fff',
    }}>
      <div className="animate-fade-in" style={compu
        ? { width: '100%', maxWidth: 440, background: '#fff', borderRadius: 26, boxShadow: '0 24px 60px rgba(17,19,24,0.10)', overflow: 'hidden' }
        : { width: '100%' }}
      >
        {hijos}
      </div>
    </div>
  );

  if (cargando) {
    return marco(
      <div role="status" style={{ minHeight: compu ? 400 : '100svh', display: 'grid', placeItems: 'center' }}>
        <Loader2 size={26} className="spin" color={KP.blue} />
        <style>{'.spin{animation:spin .8s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}'}</style>
      </div>,
    );
  }

  if (error || !datos) {
    // El link ya se usó, o el coach desactivó o eliminó al atleta: se dice qué pasó y se ofrece la entrada de siempre.
    return marco(
      <div style={{ minHeight: compu ? 400 : '100svh', display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 14, padding: '0 26px', textAlign: 'center' }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 800, color: KP.ink, letterSpacing: -0.4 }}>Este link ya no sirve</h1>
        <p style={{ margin: 0, fontSize: 15, color: KP.ink2, lineHeight: 1.5, fontWeight: 500 }}>{error || 'Pídele uno nuevo a tu entrenador.'}</p>
        <button
          type="button" onClick={onSalir} className="kp-press"
          style={{ alignSelf: 'center', marginTop: 6, minHeight: 50, padding: '0 22px', borderRadius: 16, border: 'none', background: KP.blue, color: '#fff', fontFamily: FONT, fontSize: 15.5, fontWeight: 700, cursor: 'pointer' }}
        >
          Ir a entrar
        </button>
      </div>,
    );
  }

  return marco(
    <Puerta
      compu={compu}
      invitacion={datos}
      antes={() => guardaInvitacionPendiente(token)}
      onUsuario={() => setConUsuario(true)}
    />,
  );
}
