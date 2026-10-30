import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { usePalabras } from '@/contexts/PalabrasContext';
import { isUsernameAvailable } from '@/lib/api';
import { KP, T } from '@/lib/theme';
import HojaFlotante from '@/components/HojaFlotante';
import { Boton, Campo } from '@/components/ui';

export const USERNAME_RE = /^[a-zA-Z0-9_.]{3,30}$/;

/* LA HOJA «NOMBRE DE USUARIO» de Mi perfil, sola (30 oct 2026): con él se inicia sesión; se comprueba que esté libre antes de guardarlo. Vive aparte porque
   también la abre la bienvenida del inicio («Entras con Google como @mariana.ruiz · Cambiar»): es la misma hoja, no una copia.
   `alGuardar(usuario)`: después de guardar (quien la abre dice el aviso). `onCerrar`. */
export default function HojaDeUsuario({ alGuardar, onCerrar }) {
  const { profile, user, updateProfile } = useAuth();
  const { t: tr } = usePalabras();
  const original = profile?.username || '';
  const [usuario, setUsuario] = useState(original);
  const [estado, setEstado] = useState('self'); // idle|checking|free|taken|invalid|self
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState('');

  // ¿Está libre? Con una pausa, para no preguntar letra por letra.
  useEffect(() => {
    const u = usuario.trim();
    if (u.toLowerCase() === original.toLowerCase()) { setEstado('self'); return undefined; }
    if (!USERNAME_RE.test(u)) { setEstado('invalid'); return undefined; }
    setEstado('checking');
    let vivo = true;
    const t = setTimeout(async () => {
      const libre = await isUsernameAvailable(u, user?.id);
      if (vivo) setEstado(libre ? 'free' : 'taken');
    }, 400);
    return () => { vivo = false; clearTimeout(t); };
  }, [usuario, original, user?.id]);

  async function guarda() {
    const u = usuario.trim();
    if (!USERNAME_RE.test(u) || estado !== 'free') return;
    setGuardando(true);
    setError('');
    const { error: e } = await updateProfile({ username: u });
    setGuardando(false);
    if (e) { setError(e.message || 'No se pudo guardar'); return; }
    alGuardar?.(u);
  }

  const pista = {
    checking: { text: 'Comprobando…', color: T.text3 },
    free: { text: 'Disponible', color: '#00A372' },
    taken: { text: 'Ya está en uso', color: T.danger },
    invalid: { text: '3-30 caracteres: letras, números, _ o .', color: T.text3 },
  }[estado];

  return (
    <HojaFlotante titulo="Nombre de usuario" onCerrar={onCerrar} ancho={460}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <Campo
          etiqueta="Usuario" valor={usuario} onCambio={(v) => setUsuario(v.replace(/\s/g, ''))} marcador="tu_usuario"
          autoCapitalize="none" spellCheck={false} autoFocus
        />
        <div style={{ minHeight: 20, margin: '0 6px', fontSize: 13.5, fontWeight: 600, color: error ? T.danger : pista?.color ?? KP.ink2 }}>
          {error || pista?.text || tr('Con este nombre inicias sesión. Cambiarlo no afecta tu plan ni tu progreso.')}
        </div>
        <Boton ancho deshabilitado={estado !== 'free'} cargando={guardando} onClick={guarda}>Guardar</Boton>
      </div>
    </HojaFlotante>
  );
}
