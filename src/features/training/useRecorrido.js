import { useCallback, useEffect, useRef, useState } from 'react';
import { agregaPunto, enVivo, fuenteDeUbicacion } from '@/lib/ubicacion';
import { muestrasDeRuta, rutaParaGuardar } from '@/lib/recorrido';

/* EL RECORRIDO DEL ENTRENO, EN SILENCIO (23 oct 2026, ver `lib/recorrido.js`). Si la persona dijo que sí (se pregunta una vez, por teléfono: `tl:recorrido`),
   mientras el entreno guiado está abierto se guarda por dónde se mueve, para la línea de su activity card. Nada en pantalla lo anuncia (Andrés lo decidió).
   Los puntos se van guardando en este teléfono (por sesión) para no perderlos si se cierra la app; a la sesión (`registro.ruta`) se pasan al salir o al terminar,
   ya adelgazados: escribir cada punto en la base sería una escritura por segundo.
   `permiso`: 'si' | 'no' | null (aún no se pregunta). `disponible`: el teléfono tiene GPS. `ruta()`: la línea lista para guardarse, o `null`. */

const LLAVE_DEL_PERMISO = 'tl:recorrido';
const llaveDeSesion = (sesionId) => `tl:recorrido:${sesionId}`;
const lee = (k) => { try { return window.localStorage.getItem(k); } catch { return null; } };
const escribe = (k, v) => { try { if (v === null) window.localStorage.removeItem(k); else window.localStorage.setItem(k, v); } catch { /* sin almacenamiento: vale mientras dure la pantalla */ } };

// Menos de esto de recorrido no es un recorrido: es la deriva del GPS en un gimnasio (la línea sería un garabato). No se guarda.
const METROS_MINIMOS = 150;

/** Borra la copia de este teléfono (la sesión se terminó o se deshizo). Se puede llamar sin que el entreno esté abierto. */
export const borraRecorrido = (sesionId) => escribe(llaveDeSesion(sesionId), null);

export function useRecorrido({ sesionId, rutaGuardada }) {
  const fuente = fuenteDeUbicacion();
  const disponible = fuente.disponible();
  const [permiso, setPermiso] = useState(() => { const v = lee(LLAVE_DEL_PERMISO); return v === 'si' || v === 'no' ? v : null; });
  const muestras = useRef(null);
  const terminado = useRef(false);
  if (muestras.current === null) {
    let previas;
    try { previas = JSON.parse(lee(llaveDeSesion(sesionId)) ?? '[]'); } catch { previas = []; }
    muestras.current = Array.isArray(previas) && previas.length ? previas : muestrasDeRuta(rutaGuardada);
  }

  useEffect(() => {
    if (permiso !== 'si' || !disponible) return undefined;
    // El reloj de las muestras sigue desde donde se quedó (una sesión retomada no empieza en cero).
    const base = Date.now() - ((muestras.current.at(-1)?.t ?? -2) + 2) * 1000;
    return fuente.sigue((p) => {
      const nuevas = agregaPunto(muestras.current, p, (Date.now() - base) / 1000);
      if (terminado.current || nuevas === muestras.current) return;
      muestras.current = nuevas;
      escribe(llaveDeSesion(sesionId), JSON.stringify(nuevas));
    }, () => {});
  }, [permiso, disponible, fuente, sesionId]);

  const decide = useCallback((v) => { escribe(LLAVE_DEL_PERMISO, v); setPermiso(v); }, []);
  const ruta = useCallback(() => (enVivo(muestras.current).distanciaM >= METROS_MINIMOS ? rutaParaGuardar(muestras.current) : null), []);
  // Al TERMINAR la sesión la línea ya vive en ella (`registro.ruta`): se borra la copia de este teléfono. Si no, al «Deshacer» y volver a hacer la sesión
  // (misma llave) la línea de la vez anterior reaparecía y se mezclaba con la nueva.
  const limpia = useCallback(() => { terminado.current = true; muestras.current = []; borraRecorrido(sesionId); }, [sesionId]);
  return { permiso, disponible, decide, ruta, limpia };
}
