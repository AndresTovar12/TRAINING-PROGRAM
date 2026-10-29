import { useCallback, useRef } from 'react';
import { usePlanOpcional } from '@/contexts/PlanContext';
import { useStorage } from '@/contexts/AppStateContext';
import { historialDePeso } from '@/lib/training-utils';
import { cargaEntrenoDeSesion, cargaHistorial, coachDe } from '@/lib/stickers/carga';
import { tituloDeLaHoja } from '@/lib/stickers/catalogo';
import { recordDelPlan, seriesProgramadas } from '@/lib/stickers/plan';
import HojaDeStickers from './HojaDeStickers';
import { useTipoDeSesion } from './useTipoDeSesion';

/** Lo PROGRAMADO de una sesión (sin `dia`, nada): `{ programadas, record }`, con los kilos más altos que había levantado en cada ejercicio ANTES de esta sesión,
 *  en el programa que se está viendo (`ComoPrograma`, si va envuelta). Lo usan esta hoja y la página del workout (`ResumenDeSesion`). */
export function useProgramadoDeLaSesion({ dia, registro, sesionId }) {
  const plan = usePlanOpcional();
  const [sesiones] = useStorage(plan?.claveDe ? plan.claveDe('wr:sessions') : 'wr:sessions', {});
  if (!dia) return {};
  const llave = String(sesionId ?? '').split('#')[0];
  // Lo de ANTES de esta sesión, en el orden del plan (fase 7: al abrir un workout viejo, lo que levantó después no le quita su récord).
  const mejorAntes = (ejercicio) => {
    const todo = historialDePeso(plan?.phases ?? [], sesiones, ejercicio, plan?.kind);
    const aqui = todo.findIndex((r) => r.id === llave);
    const antes = (aqui >= 0 ? todo.slice(0, aqui) : todo.filter((r) => r.id !== llave)).map((r) => r.kilos);
    return antes.length ? Math.max(...antes) : null;
  };
  return { programadas: seriesProgramadas(dia), record: recordDelPlan({ day: dia, registro, mejorAntes }) };
}

/* LA HOJA DE STICKERS de una sesión guiada del plan: la que se abre desde el final del entreno y desde el día en el plan (28 oct 2026; sustituye a HojaDelSello).
   Busca los datos (con reloj o sin él, ver `lib/stickers/carga.js`), el @usuario del coach y el historial del año, y abre la hoja. El nombre es el de la sesión
   del plan: aquí no se renombra (el plan no se toca).
   `tipo`: `{ nombre, icono }` del tipo de la sesión (`tipoParaStickers(day)`): la familia Tipo dibuja ese ícono. `coachId`: quien programó (para «Programmed by»).
   `dia`: el día con los ejercicios que se hicieron (los del día que repite, si dice «repite el martes»): de ahí salen las series PROGRAMADAS («12/16 sets») y el
   récord «Justo lo programado» (`lib/stickers/plan.js`), comparado contra los kilos que había levantado antes en cada ejercicio.

   Lo que llega se lee UNA vez al abrir: mientras la hoja está abierta, el registro del entreno puede seguir cambiando y no hay que volver a buscar el reloj cada vez. */
export default function HojaDeSesion({ atletaId, registro, sesionId, nombre, dia = null, tipo = null, coachId = null, unidadPeso = 'kg', onCerrar, capa }) {
  const tipoDeSesion = useTipoDeSesion();
  const programado = useProgramadoDeLaSesion({ dia, registro, sesionId });
  const inicial = useRef({ atletaId, registro, sesionId, nombre, tipo, coachId, unidadPeso, tipoDeSesion, ...programado });
  const cargar = useCallback(async () => {
    const { coachId: id, tipoDeSesion: tipoDe, ...resto } = inicial.current;
    const coach = await coachDe(id);
    const entreno = await cargaEntrenoDeSesion({ ...resto, coach });
    if (!entreno) return null;
    const historial = await cargaHistorial({ atletaId: resto.atletaId, inicioMs: entreno.inicioMs, tipoDeSesion: tipoDe });
    return { ...entreno, historial };
  }, []);
  return <HojaDeStickers cargar={cargar} titulo={tituloDeLaHoja({ plan: true })} nombre={nombre} onCerrar={onCerrar} {...(capa ? { capa } : null)} />;
}
