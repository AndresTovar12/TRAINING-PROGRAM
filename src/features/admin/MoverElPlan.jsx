import { useState } from 'react';
import { CornerUpLeft, Pause, Pencil, Play, Pin } from 'lucide-react';
import { Boton, Pastilla } from '@/components/ui';
import BotonEntendido from '@/components/BotonEntendido';
import { useConfirmacion } from '@/components/Confirmacion';
import { useAviso } from '@/components/AvisoPasajero';
import { useAuth } from '@/contexts/AuthContext';
import { useAvisosVistos } from '@/lib/useAvisosVistos';
import { moverPlanDeAtleta } from '@/lib/api';
import { nombreCorto, rolDeProfesion } from '@/lib/programas';
import { textoDeSemana } from '@/lib/vaEn';
import { FONT, KP, UI, tipoDeSesion } from '@/lib/theme';
import {
  cursorAlDia, reparaCursor, selloDelPlan, estaEnPausa, moverPlanA, pausarPlan, reanudarPlan, semanaDeAtras,
  esDescanso, sinDuracion, weekdayToday, weekdayLabel,
} from '@/lib/training-utils';

/* MOVER Y PAUSAR EL PLAN DE UN ATLETA, desde su coach (simulación v3 aprobada por Andrés, 16 oct 2026).

   Tres cosas distintas, cada una con su botón, para que nadie las confunda:
     · «Mover a X a esta semana» → cambia DÓNDE VA. Se hace en la semana que se está mirando. El día sale siempre del calendario.
     · «Editar este día»         → cambia QUÉ HACE ese día (abre el editor ahí). No mueve a nadie.
     · «Pausar» / «Reanudar»      → el plan deja de avanzar; reanudar sigue desde la misma semana, sin saltarse ninguna.
   «Una semana atrás» es el caso de «se lastimó, regresa una semana»: mover a la semana anterior, en un solo toque.

   Todo escribe el puntero del atleta (`wr:cursor`) con `mover_plan_de_atleta`, y deja dentro un `aviso` que el atleta acepta con «Entendido». */

const MESES = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
const fechaCorta = (clave) => {
  const [, m, d] = String(clave).split('-').map(Number);
  return m && d ? `${d} ${MESES[m - 1]}` : '';
};

/** Lo que le toca HOY en una semana: «Upper A + Core», o null si hoy descansa. */
function queToca(fases, faseId, semana) {
  const week = fases.find((f) => f.id === faseId)?.weekData?.find((w) => w.num === semana);
  const hoy = weekdayToday();
  const k = (d) => ({ Mie: 'Mié', Sab: 'Sáb' }[d] ?? d);
  const deHoy = (week?.days ?? []).filter((d) => k(d.day) === hoy && !esDescanso(d));
  return deHoy.length ? deHoy.map((d) => sinDuracion(d.name || '') || tipoDeSesion(d).label).join(' + ') : null;
}

/**
 * El control de un plan de atleta para su coach. `plan`: la fila del plan (`data.phases`); `clave`: la llave del puntero (`wr:cursor` o
 * `wr:cursor@<profesional>`); `state`: el estado del atleta (de `getAthleteState`); `alCambiar(clave, puntero)`: avisa para que la pantalla se
 * ponga al día sin volver a pedir nada. Devuelve `null` en una rutina que se repite (no hay dónde mover).
 */
export function useMoverPlan({ athlete, plan, clave, state, alCambiar }) {
  const pregunta = useConfirmacion();
  const { avisa } = useAviso();
  const { profile } = useAuth();
  const [ocupado, setOcupado] = useState(false);

  const fases = plan?.data?.phases ?? [];
  const kind = plan?.data?.kind === 'weekly' ? 'weekly' : 'periodized';
  if (!plan || kind === 'weekly' || fases.length === 0) return null;

  const guardado = state?.data?.[clave];
  const base = reparaCursor(fases, guardado).cursor;
  // Lo que el atleta vería hoy (el calendario ya contado), aunque su teléfono todavía no lo haya guardado.
  const actual = cursorAlDia(fases, base);
  const nombre = nombreCorto(athlete.full_name || athlete.username) || 'este atleta';
  // «Tu coach» o «Tu fisio», según el oficio de quien mueve el plan.
  const rol = rolDeProfesion(profile?.profesion);
  const textoActual = textoDeSemana(plan.data, actual.phaseId, actual.weekNum);
  const enPausa = estaEnPausa(actual);
  const atras = semanaDeAtras(fases, actual);

  async function aplica(nuevo, aviso) {
    setOcupado(true);
    try {
      const el = new Date().toISOString();
      // Con el sello de su plan y el motivo, para el historial de la base (ver `selloDelPlan`).
      const conAviso = { ...selloDelPlan(fases, nuevo), motivo: 'coach', aviso: { id: el, texto: aviso.texto, detalle: aviso.detalle, de: profile?.full_name || null, el } };
      await moverPlanDeAtleta(athlete.id, clave, conAviso);
      alCambiar(clave, conAviso);
      avisa(aviso.listo);
    } catch {
      avisa('No se pudo guardar. Intenta otra vez.');
    } finally {
      setOcupado(false);
    }
  }

  async function mover(faseId, semana) {
    const destino = textoDeSemana(plan.data, faseId, semana);
    const hoy = queToca(fases, faseId, semana);
    const si = await pregunta({
      titulo: `¿Mover a ${nombre} a ${destino}?`,
      detalle: `Ahora va en ${textoActual}. Hoy ${weekdayLabel(weekdayToday())} le tocará: ${hoy ?? 'descanso'}. Cada semana sigue su día del calendario, así que nada se desfasa. `
        + `Al abrir la app verá «Tu ${rol} movió tu plan» con un botón Entendido.`,
      confirmar: `Mover a ${nombre}`,
    });
    if (!si) return;
    await aplica(moverPlanA(fases, actual, faseId, semana), {
      texto: `Tu ${rol} movió tu plan`, detalle: `Ahora vas en ${destino}.`, listo: `Moviste a ${nombre} a ${destino}.`,
    });
  }

  async function pausar() {
    const si = await pregunta({
      titulo: `¿Pausar el plan de ${nombre}?`,
      detalle: `Se queda en ${textoActual} hasta que lo reanudes. No se salta ninguna semana. Al abrir la app verá «Tu ${rol} pausó tu plan» con un botón Entendido.`,
      confirmar: 'Pausar plan',
    });
    if (!si) return;
    await aplica(pausarPlan(actual), {
      texto: `Tu ${rol} pausó tu plan`, detalle: `Se queda en ${textoActual} hasta que lo reanude.`, listo: `Plan de ${nombre} en pausa.`,
    });
  }

  async function reanudar() {
    await aplica(reanudarPlan(actual), {
      texto: `Tu ${rol} reanudó tu plan`, detalle: `Sigues en ${textoActual}.`, listo: `Plan de ${nombre} reanudado.`,
    });
  }

  return {
    nombre, ocupado, enPausa, textoActual, pausa: actual.pausa ?? null, aqui: { faseId: actual.phaseId, semana: actual.weekNum },
    atras: atras ? { ...atras, texto: textoDeSemana(plan.data, atras.faseId, atras.semana) } : null,
    mover, pausar, reanudar,
    unaSemanaAtras: atras ? () => mover(atras.faseId, atras.semana) : null,
  };
}

/** Las dos reglas, una sola vez («Entendido» y no vuelven). */
export function ReglasDelPlan({ nombre }) {
  const { listo, visto, marcar } = useAvisosVistos();
  if (!listo || visto('plan:reglas-del-coach')) return null;
  // Cada regla: una frase corta en negritas y debajo qué hacer (mismo molde que las del atleta).
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
      {regla(1, `${nombre} avanza solo`, 'Cada semana pasa a la siguiente, sin que hagas nada.')}
      {regla(2, 'Mover y editar son distintos', <>«Mover» cambia en qué semana va {nombre}. «Editar este día» cambia lo que hace ese día.</>)}
      <BotonEntendido color={KP.blue} onClick={() => marcar('plan:reglas-del-coach')} style={{ alignSelf: 'flex-end' }} />
    </div>
  );
}

/** «Va en Fase 2 · Sem 3», con «Una semana atrás» y «Pausar» / «Reanudar». */
export function ControlesDelPlan({ mp }) {
  if (!mp) return null;
  return (
    <div style={{ background: UI.tarjeta, borderRadius: UI.rGrupo, boxShadow: UI.sombraGrupo, padding: 14, marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 10, fontFamily: FONT }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13.5, fontWeight: 600, color: KP.ink2 }}>Va en</span>
        <span style={{ fontSize: 17, fontWeight: 800, color: KP.ink }}>{mp.textoActual}</span>
        {mp.enPausa && <Pastilla tono="aviso">{mp.pausa ? `En pausa desde el ${fechaCorta(mp.pausa)}` : 'En pausa'}</Pastilla>}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {mp.unaSemanaAtras && (
          <Boton tipo="secundario" chico icono={CornerUpLeft} deshabilitado={mp.ocupado} onClick={mp.unaSemanaAtras}>
            Una semana atrás
          </Boton>
        )}
        {mp.enPausa
          ? <Boton tipo="principal" chico icono={Play} deshabilitado={mp.ocupado} onClick={mp.reanudar}>Reanudar</Boton>
          : <Boton tipo="secundario" chico icono={Pause} deshabilitado={mp.ocupado} onClick={mp.pausar}>Pausar</Boton>}
      </div>
    </div>
  );
}

/** Lo que va debajo de los días de una semana: «Mover a X a esta semana», si no es donde va. */
export function MoverAquiBoton({ mp, faseId, semana }) {
  if (!mp || (mp.aqui.faseId === faseId && mp.aqui.semana === semana)) return null;
  return (
    <Boton tipo="principal" ancho icono={Pin} deshabilitado={mp.ocupado} onClick={() => mp.mover(faseId, semana)}>
      Mover a {mp.nombre} a esta semana
    </Boton>
  );
}

/** «Editar este día»: abre el editor justo ahí. No mueve a nadie. */
export function EditarEsteDiaBoton({ onClick }) {
  return (
    <Boton tipo="secundario" chico icono={Pencil} onClick={onClick}>Editar este día</Boton>
  );
}
