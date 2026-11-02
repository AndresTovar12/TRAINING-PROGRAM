import { useEffect, useMemo, useRef } from 'react';
import { useAviso } from '@/components/AvisoPasajero';
import { useAppState, useStorage } from '@/contexts/AppStateContext';
import { cursorAlDia, reparaCursor, selloDelPlan, tieneSelloDe } from '@/lib/training-utils';
import { textoDeSemana } from '@/lib/vaEn';

/**
 * El marcador del plan (`wr:cursor`, o `wr:cursor@<profesional>` en un programa de equipo): dónde va la persona, puesto al día con el calendario, y
 * guardado cuando la app lo mueve sola. Devuelve `{ cursor, setCursor }`: `cursor` es el que se ve (ya al día); `setCursor` lo guarda (moverlo a mano).
 * Vive aparte de `TrainingApp` para poder probarlo con el estado de verdad (`scripts/prueba-marcador-al-abrir.mjs`).
 */
export function useMarcadorAlDia({ PLAN, planLoading, kind, estructura, clave, base = null, hoy, soloLectura }) {
  // `confirmado`: el estado ya se comparó con la base (no es solo la copia del teléfono, ver `AppStateContext`).
  const { confirmado } = useAppState();
  const [storedCursor, setCursor] = useStorage(clave, null);

  /* Cursor efectivo: el guardado si sigue siendo válido para este plan; si no,
     el primer día. Y encima, puesto al día con el calendario.

     `cursorAlDia` es lo que arregla el bicho más viejo de la app: el puntero se
     escribía una vez y no lo movía NADIE. `advanceCursor` existía pero no se
     llamaba desde ningún sitio, así que Andrés llevaba semanas viendo "Semana 6
     de 8" y creía que era por no marcar las sesiones. Marcar tampoco lo movía.

     Ahora avanza una semana del plan por cada semana de calendario que pasa. */
  /* Si el marcador guardado no cabe en el plan (29 oct 2026, ver `reparaCursor`): mismo plan editado → la semana más cercana; plan nuevo → el
     principio (un plan comprado, donde lo dejó la compra). Antes los dos casos, y cualquier lectura a medias, terminaban en «Fase 1 · Semana 1». */
  const reparo = useMemo(() => reparaCursor(PLAN, storedCursor, { base }), [PLAN, storedCursor, base]);
  const cursorBase = reparo.cursor;
  const cursor = useMemo(() => cursorAlDia(PLAN, cursorBase, hoy), [PLAN, cursorBase, hoy]);

  /* Lo que el calendario adelanta se guarda, para que la próxima vez se cuente
     desde aquí y no desde el sello viejo. Va en un efecto y no en el useMemo
     porque un useMemo que escribe estado se ejecuta dos veces en desarrollo. */
  /* Además se guarda con el SELLO de su plan (las fases y su posición, ver `selloDelPlan`) y con el `motivo` del cambio, que queda en el historial de
     la base (`historial_del_marcador`). Nunca con el plan a medio cargar. Y si la app tuvo que moverlo por su cuenta (plan editado o plan nuevo),
     lo dice con «Deshacer»: deshacer regresa el marcador de antes y, mientras la app siga abierta, no se vuelve a mover solo. */
  const { avisa } = useAviso();
  const sinRepararOtraVez = useRef(null);
  useEffect(() => {
    if (!cursor || planLoading || !PLAN?.length) return;
    /* SIN CONEXIÓN (1 nov 2026): con la copia del teléfono (abrió sin señal) el marcador NO se guarda solo. Saldría de una copia que puede tener días y, al
       volver la señal, pisaría el que su coach movió mientras tanto (el marcador va entero). Lo que se ve sí está al día: `cursor` ya cuenta el calendario.
       En cuanto se relee la base, esto corre con el marcador de verdad. Moverlo a mano (`MoverMiPlan`) sí se guarda: es lo que la persona quiso.
       Y (2 nov 2026) tampoco antes de cargar el estado: ahí `useStorage` da null y esto sacaría «no hay marcador → Fase 1 · Semana 1». `confirmado` ya lo
       exige (ver `AppStateContext`). */
    if (!confirmado) return;
    const a = storedCursor;
    if (a && sinRepararOtraVez.current === `${clave}|${JSON.stringify(a)}`) return;
    const nuevo = selloDelPlan(PLAN, cursor);
    const semanaDistinta = !a || a.phaseId !== nuevo.phaseId || a.weekNum !== nuevo.weekNum;
    const cambio = semanaDistinta || a.dayIdx !== nuevo.dayIdx || a.fijadoEn !== nuevo.fijadoEn || !tieneSelloDe(PLAN, a);
    if (!cambio) return;
    const motivo = reparo.motivo ?? (a && semanaDistinta ? 'calendario' : a?.motivo);
    /* SOLO SI EL MARCADOR SIGUE SIENDO EL QUE SE VIO (2 nov 2026). Este efecto corre DESPUÉS de dibujar; en medio el estado puede cambiar (llegó la base,
       se releyó al volver a la app). Si el marcador de ahora ya no es el del dibujo (`a`), lo de aquí salió de uno viejo y no se escribe: el siguiente
       dibujo lo vuelve a calcular con el de verdad. (El almacén del estado cambia en el acto: `setCursor` corre esta función antes de seguir.) */
    let puesto = false;
    setCursor((vivo) => {
      if (vivo !== a) return vivo;
      puesto = true;
      return motivo ? { ...nuevo, motivo } : nuevo;
    });
    if (!puesto) return;
    if (a && !soloLectura && (reparo.motivo === 'reparado' || reparo.motivo === 'plan-nuevo')) {
      const donde = textoDeSemana({ phases: PLAN, kind, estructura }, nuevo.phaseId, nuevo.weekNum);
      avisa(reparo.motivo === 'plan-nuevo' ? `Tienes un plan nuevo: empiezas en ${donde}.` : `Tu plan cambió y tu semana ya no estaba: ahora vas en ${donde}.`, {
        accion: { texto: 'Deshacer', alTocar: () => { sinRepararOtraVez.current = `${clave}|${JSON.stringify(a)}`; setCursor(a); } },
      });
    }
  }, [cursor, storedCursor, setCursor, planLoading, PLAN, reparo.motivo, clave, avisa, kind, estructura, soloLectura, confirmado]);

  return { cursor, setCursor };
}
