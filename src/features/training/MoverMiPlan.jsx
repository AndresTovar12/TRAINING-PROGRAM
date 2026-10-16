import { useMemo } from 'react';
import { CornerUpLeft, Pause, Pin, Play } from 'lucide-react';
import { Boton, Pastilla } from '@/components/ui';
import BotonEntendido from '@/components/BotonEntendido';
import { useConfirmacion } from '@/components/Confirmacion';
import { textoDeSemana } from '@/lib/vaEn';
import { FONT, KP, LT, UI, tipoDeSesion } from '@/lib/theme';
import {
  estaEnPausa, moverPlanA, pausarPlan, reanudarPlan, semanaDeAtras, esDescanso, sinDuracion, weekdayToday, weekdayLabel,
} from '@/lib/training-utils';

/* MOVER MI PLAN, PAUSARLO Y SUMAR UNA SESIÓN A HOY (simulación v3 aprobada por Andrés, 16 oct 2026).

   Antes había «Cambiar día» (con una hoja «¿Qué sesión haces hoy?») y «Hacer este día»: las dos mezclaban «hoy hago otra cosa» con «me
   muevo de semana», y nadie sabía que una movía el plan y la otra no. Ahora cada cosa tiene su botón y se dice qué hace:
     · «Agregar a hoy»          → suma una sesión a lo de hoy. No mueve nada; caduca esta noche.
     · «Mover mi plan aquí»     → cambia DÓNDE VAS (fase y semana). Te dice qué te toca hoy antes de moverte.
     · «Una semana atrás»       → el mismo mover, a la semana anterior.
     · «Pausar plan»            → deja de avanzar hasta que lo reanudes; no se salta ninguna semana.
   Todo vive en el puntero (`wr:cursor`, ver `training-utils`). Si el coach lo movió o pausó, el atleta lo ve en un aviso con «Entendido». */

/** Lo que te toca HOY en una semana: «Upper A + Core», o null si hoy descansas. */
function queTocaHoy(fases, faseId, semana) {
  const week = fases.find((f) => f.id === faseId)?.weekData?.find((w) => w.num === semana);
  const hoy = weekdayToday();
  const k = (d) => ({ Mie: 'Mié', Sab: 'Sáb' }[d] ?? d);
  const deHoy = (week?.days ?? []).filter((d) => k(d.day) === hoy && !esDescanso(d));
  return deHoy.length ? deHoy.map((d) => sinDuracion(d.name || '') || tipoDeSesion(d).label).join(' + ') : null;
}

/**
 * Los controles del plan del atleta. `plan`: `{ phases, kind, estructura }`; `cursor`: el puntero ya al día; `setCursor`: lo guarda.
 * Devuelve `null` en una rutina que se repite (no hay dónde moverse), sin plan, o si quien mira es un coach (no mueve el plan por él).
 */
export function useMoverMiPlan({ plan, cursor, setCursor, soloLectura }) {
  const pregunta = useConfirmacion();
  const fases = plan?.phases;
  return useMemo(() => {
    if (soloLectura || !fases?.length || plan.kind === 'weekly' || !cursor) return null;
    const textoActual = textoDeSemana(plan, cursor.phaseId, cursor.weekNum);
    const atras = semanaDeAtras(fases, cursor);

    async function mover(faseId, semana) {
      const destino = textoDeSemana(plan, faseId, semana);
      const hoy = queTocaHoy(fases, faseId, semana);
      const si = await pregunta({
        titulo: '¿Mover tu plan?',
        detalle: `Ahora vas en ${textoActual}. Pasarás a ${destino}. Hoy ${weekdayLabel(weekdayToday())} te tocará: ${hoy ?? 'descanso'}. `
          + 'Cada semana sigue su día del calendario, así que nada se desfasa. Desde ahí tu plan avanza solo.',
        confirmar: 'Mover mi plan',
      });
      if (si) setCursor(moverPlanA(fases, cursor, faseId, semana));
    }
    async function pausar() {
      const si = await pregunta({
        titulo: '¿Pausar tu plan?',
        detalle: `Se queda en ${textoActual} hasta que lo reanudes. No se salta ninguna semana.`,
        confirmar: 'Pausar plan',
      });
      if (si) setCursor(pausarPlan(cursor));
    }
    return {
      textoActual, enPausa: estaEnPausa(cursor), pausa: cursor.pausa ?? null, aqui: { faseId: cursor.phaseId, semana: cursor.weekNum },
      atras: atras ? { ...atras, texto: textoDeSemana(plan, atras.faseId, atras.semana) } : null,
      mover, pausar, reanudar: () => setCursor(reanudarPlan(cursor)),
      unaSemanaAtras: atras ? () => mover(atras.faseId, atras.semana) : null,
    };
  }, [fases, plan, cursor, setCursor, soloLectura, pregunta]);
}

/** Las tres reglas, una sola vez («Entendido» y no vuelven). `aceptada` / `onEntendido` los pone quien lo usa (se guardan con `ui:avisos-vistos`). */
export function ReglasDeMiPlan({ aceptada, onEntendido }) {
  if (aceptada) return null;
  // Cada regla: una frase corta en negritas (lo que hay que cachar) y debajo una línea que dice qué hacer.
  const regla = (n, titulo, texto) => (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <span style={{ width: 22, height: 22, borderRadius: 11, background: KP.blue, color: '#fff', display: 'grid', placeItems: 'center', fontSize: 12.5, fontWeight: 800, flexShrink: 0, marginTop: 1 }}>{n}</span>
      <span style={{ fontSize: 14.5, fontWeight: 500, color: KP.ink2, lineHeight: 1.4 }}>
        <b style={{ display: 'block', fontSize: 15.5, fontWeight: 800, color: KP.ink }}>{titulo}</b>
        {texto}
      </span>
    </div>
  );
  return (
    <div style={{ background: KP.blueSoft, borderRadius: UI.rGrupo, padding: 14, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: FONT }}>
      {regla(1, 'Avanzas solo', 'Cada semana pasas a la siguiente, sin que hagas nada.')}
      {regla(2, 'Hoy haz la sesión que quieras', 'Entrenar otra sesión no cambia dónde vas.')}
      {regla(3, '¿Te atrasaste o te lesionaste?', 'Toca «Mover mi plan» y sigues desde la semana que elijas.')}
      <BotonEntendido color={KP.blue} onClick={onEntendido} style={{ alignSelf: 'flex-end' }} />
    </div>
  );
}

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (clave) => {
  const [, m, d] = String(clave).split('-').map(Number);
  return m && d ? `${d} ${MESES[m - 1]}` : '';
};

/** «Vas en Fase 2 · Sem 3», con «Una semana atrás» y «Pausar plan» / «Reanudar plan». */
export function ControlesDeMiPlan({ mp }) {
  if (!mp) return null;
  return (
    <div style={{ background: LT.surface, borderRadius: UI.rGrupo, boxShadow: UI.sombraGrupo, padding: 14, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: KP.ink2 }}>Vas en</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: KP.ink }}>{mp.textoActual}</span>
        {mp.enPausa && <Pastilla tono="aviso">{mp.pausa ? `En pausa desde el ${fechaCorta(mp.pausa)}` : 'En pausa'}</Pastilla>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {mp.unaSemanaAtras && <Boton tipo="secundario" chico icono={CornerUpLeft} onClick={mp.unaSemanaAtras}>Una semana atrás</Boton>}
        {mp.enPausa
          ? <Boton tipo="principal" chico icono={Play} onClick={mp.reanudar}>Reanudar plan</Boton>
          : <Boton tipo="secundario" chico icono={Pause} onClick={mp.pausar}>Pausar plan</Boton>}
      </div>
    </div>
  );
}

/** Al pie de una semana que no es donde vas: «Mover mi plan a la semana N». */
export function MoverAquiAtleta({ mp, faseId, semana, numero }) {
  if (!mp || (mp.aqui.faseId === faseId && mp.aqui.semana === semana)) return null;
  return (
    <Boton tipo="principal" ancho icono={Pin} onClick={() => mp.mover(faseId, semana)}>
      Mover mi plan a la semana {numero ?? semana}
    </Boton>
  );
}

/** «Tu coach movió tu plan», con el detalle y su «Entendido». Lo escribió el coach dentro del puntero (`aviso`). */
export function AvisoDelCoach({ aviso, onEntendido, etiqueta }) {
  if (!aviso?.texto) return null;
  return (
    <div style={{ margin: '12px 18px 0', background: KP.blueSoft, borderRadius: 16, padding: '13px 15px', display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontFamily: FONT }}>
      <div style={{ flex: '1 1 180px', minWidth: 0 }}>
        {etiqueta && <div style={{ fontSize: 12.5, fontWeight: 700, color: KP.ink2 }}>{etiqueta}</div>}
        <div style={{ fontSize: 14.5, fontWeight: 800, color: KP.ink, lineHeight: 1.3 }}>{aviso.texto}</div>
        {aviso.detalle && <div style={{ fontSize: 13.5, fontWeight: 600, color: KP.ink2, marginTop: 2 }}>{aviso.detalle}</div>}
      </div>
      {onEntendido && <BotonEntendido color={KP.blue} style={{ marginLeft: 'auto' }} onClick={onEntendido} />}
    </div>
  );
}
