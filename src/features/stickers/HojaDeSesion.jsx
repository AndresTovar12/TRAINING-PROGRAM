import { useCallback, useRef } from 'react';
import { cargaEntrenoDeSesion, cargaHistorial, coachDe } from '@/lib/stickers/carga';
import { tituloDeLaHoja } from '@/lib/stickers/catalogo';
import HojaDeStickers from './HojaDeStickers';
import { useTipoDeSesion } from './useTipoDeSesion';

/* LA HOJA DE STICKERS de una sesión guiada del plan: la que se abre desde el final del entreno y desde el día en el plan (28 oct 2026; sustituye a HojaDelSello).
   Busca los datos (con reloj o sin él, ver `lib/stickers/carga.js`), el @usuario del coach y el historial del año, y abre la hoja. El nombre es el de la sesión
   del plan: aquí no se renombra (el plan no se toca).
   `tipo`: `{ nombre, icono }` del tipo de la sesión (`tipoParaStickers(day)`): la familia Tipo dibuja ese ícono. `coachId`: quien programó (para «Programmed by»).

   Lo que llega se lee UNA vez al abrir: mientras la hoja está abierta, el registro del entreno puede seguir cambiando y no hay que volver a buscar el reloj cada vez. */
export default function HojaDeSesion({ atletaId, registro, sesionId, nombre, tipo = null, coachId = null, unidadPeso = 'kg', onCerrar }) {
  const tipoDeSesion = useTipoDeSesion();
  const inicial = useRef({ atletaId, registro, sesionId, nombre, tipo, coachId, unidadPeso, tipoDeSesion });
  const cargar = useCallback(async () => {
    const { coachId: id, tipoDeSesion: tipoDe, ...resto } = inicial.current;
    const coach = await coachDe(id);
    const entreno = await cargaEntrenoDeSesion({ ...resto, coach });
    if (!entreno) return null;
    const historial = await cargaHistorial({ atletaId: resto.atletaId, inicioMs: entreno.inicioMs, tipoDeSesion: tipoDe });
    return { ...entreno, historial };
  }, []);
  return <HojaDeStickers cargar={cargar} titulo={tituloDeLaHoja({ plan: true })} nombre={nombre} onCerrar={onCerrar} />;
}
