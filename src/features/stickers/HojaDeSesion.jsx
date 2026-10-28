import { useCallback, useRef } from 'react';
import { cargaEntrenoDeSesion } from '@/lib/stickers/carga';
import HojaDeStickers from './HojaDeStickers';

/* LA HOJA DE STICKERS de una sesión guiada del plan: la que se abre desde el final del entreno y desde el día en el plan (28 oct 2026; sustituye a HojaDelSello).
   Busca los datos (con reloj o sin él, ver `lib/stickers/carga.js`) y abre la hoja. El nombre es el de la sesión del plan: aquí no se renombra (el plan no se toca).

   Lo que llega se lee UNA vez al abrir: mientras la hoja está abierta, el registro del entreno puede seguir cambiando y no hay que volver a buscar el reloj cada vez. */
export default function HojaDeSesion({ atletaId, registro, sesionId, nombre, unidadPeso = 'kg', onCerrar }) {
  const inicial = useRef({ atletaId, registro, sesionId, nombre, unidadPeso });
  const cargar = useCallback(() => cargaEntrenoDeSesion(inicial.current), []);
  return <HojaDeStickers cargar={cargar} titulo="Comparte tu workout" nombre={nombre} onCerrar={onCerrar} />;
}
