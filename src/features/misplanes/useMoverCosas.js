import { useCallback } from 'react';
import { useAviso } from '@/components/AvisoPasajero';
import { moverCosas } from '@/lib/misPlanes';
import { planDeMovimiento } from '@/lib/misPlanesDatos';

/**
 * Llevar cosas y carpetas a otra carpeta, con su aviso: «Moviendo…» mientras tarda y «Movido a «Fuerza» ·
 * Deshacer» al terminar (Andrés, 2 oct 2026: mover tiene que ser fácil, y poder arrepentirse). Deshacer las
 * deja donde estaban.
 *
 * Devuelve `llevar(cosas, destinoId)`: `cosas` = `{ items, carpetas }` (las filas ya leídas), `destinoId` = la
 * carpeta de destino (`null` = arriba de todo). Si algo falla, lanza el error para que quien llama lo escriba
 * en pantalla. `carpetas` solo sirve para decir el nombre del destino; `recargar` vuelve a leer la lista.
 */
export function useMoverCosas({ carpetas, recargar }) {
  const { avisa, trabajando } = useAviso();

  return useCallback(async (cosas, destinoId) => {
    const { ir, volver } = planDeMovimiento(cosas, destinoId);
    if (!ir.length) { avisa('Ya está ahí'); return; }
    await trabajando('Moviendo…', async () => {
      await moverCosas(ir);
      await recargar();
    });
    const donde = destinoId ? `«${carpetas.find((c) => c.id === destinoId)?.nombre ?? 'la carpeta'}»` : 'Mis planes';
    avisa(ir.length === 1 ? `Movido a ${donde}` : `${ir.length} movidos a ${donde}`, {
      accion: {
        texto: 'Deshacer',
        alTocar: () => trabajando('Deshaciendo…', async () => {
          await moverCosas(volver);
          await recargar();
        }, 'Deshecho').catch(() => recargar()),
      },
    });
  }, [carpetas, recargar, avisa, trabajando]);
}
