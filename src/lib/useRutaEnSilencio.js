import { useEffect, useRef } from 'react';
import { fuenteDeUbicacion } from '@/lib/ubicacion';
import { decidePrecision, silencioNuevo } from '@/lib/rutaSilenciosa';

/* SEGUIR LA UBICACIÓN EN SILENCIO mientras `activo` (sección 8b, ver `lib/rutaSilenciosa.js`): arranca en precisión baja y la sube cuando hay movimiento de verdad
   (la vuelve a bajar tras 3 min quieto). `alPunto(p)` recibe cada punto; quien lo usa los junta con `agregaPunto`, que solo deja entrar los precisos.
   Sin GPS (o sin permiso) no pasa nada: el entreno sigue igual y simplemente no hay línea. */
export function useRutaEnSilencio(activo, alPunto) {
  const recibe = useRef(alPunto);
  useEffect(() => { recibe.current = alPunto; });
  useEffect(() => {
    if (!activo) return undefined;
    const fuente = fuenteDeUbicacion();
    if (!fuente.disponible()) return undefined;
    let estado = silencioNuevo();
    let parar = null;
    parar = fuente.sigue((p) => {
      const nuevo = decidePrecision(estado, p, Date.now());
      if (nuevo.nivel !== estado.nivel) parar?.precision?.(nuevo.nivel);
      estado = nuevo;
      recibe.current?.(p);
    }, () => {}, { precision: 'baja' });
    return () => parar?.();
  }, [activo]);
}
