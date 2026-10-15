import { useEffect, useState } from 'react';
import { lugaresDe } from '@/lib/lugaresApi';

/** Los lugares para agregar atletas de quien está mirando (`{ limite, usados, libres, ilimitado }`), o `null` mientras carga o si no se pudo saber.
 *  Se vuelve a leer cuando cambia `recarga`. `null` NO bloquea nada: el servidor decide al agregar, esto solo avisa antes. */
export function useLugares(recarga = 0) {
  const [lugares, setLugares] = useState(null);
  useEffect(() => {
    let vivo = true;
    lugaresDe().then((l) => { if (vivo) setLugares(l); }).catch(() => { if (vivo) setLugares(null); });
    return () => { vivo = false; };
  }, [recarga]);
  return lugares;
}
