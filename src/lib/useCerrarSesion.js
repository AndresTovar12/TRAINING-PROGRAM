import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useConfirmacion } from '@/components/Confirmacion';
import { pendientesAhora } from '@/lib/colaDelTelefono';
import { plural } from '@/lib/plural';

/**
 * «Cerrar sesión» con cosas por subir (1 nov 2026, encargo «sin conexión», parte 2). Antes de salir se le dice: no se pierden (se quedan en este teléfono, solo para
 * esta cuenta, y se suben cuando vuelva a entrar con ella), pero mientras tanto su coach no las ve. Sin pendientes sale directo, como siempre.
 */
export function useCerrarSesion() {
  const { signOut } = useAuth();
  const pregunta = useConfirmacion();
  return useCallback(async () => {
    const n = pendientesAhora().porSubir;
    if (n > 0) {
      const si = await pregunta({
        titulo: `Tienes ${plural(n, 'cosa', 'cosas')} sin subir`,
        detalle: n === 1
          ? 'No se pierde: se queda en este teléfono y se sube sola la próxima vez que entres con esta cuenta. Mientras tanto, tu coach no la ve.'
          : 'No se pierden: se quedan en este teléfono y se suben solas la próxima vez que entres con esta cuenta. Mientras tanto, tu coach no las ve.',
        confirmar: 'Cerrar sesión',
        cancelar: 'Quedarme',
      });
      if (!si) return;
    }
    await signOut();
  }, [signOut, pregunta]);
}
