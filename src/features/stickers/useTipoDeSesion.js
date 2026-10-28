import { useMemo } from 'react';
import { usePlanOpcional } from '@/contexts/PlanContext';
import { tipoParaStickers } from '@/lib/aspectoDelTipo';
import { expandeMicrociclos, sessionId } from '@/lib/training-utils';

/* El TIPO de una sesión guiada del plan por su llave (`f1-w2-d3`, o `wk-2026-W44-d1` en una rutina semanal): para que el historial de los stickers (Racha del
   tipo, Semana con íconos, Mes por tipo) cuente cada sesión con el tipo que eligió el coach. Devuelve una función `(id) => { nombre, icono } | null`.
   Fuera de la app de entrenamiento (sin plan) siempre `null`. */
export function useTipoDeSesion() {
  const plan = usePlanOpcional();
  const phases = plan?.phases;
  const kind = plan?.kind;
  return useMemo(() => {
    const mapa = new Map();
    const fases = expandeMicrociclos(phases ?? []);
    fases.forEach((ph) => (ph.weekData ?? []).forEach((w) => (w.days ?? []).forEach((d, i) => mapa.set(sessionId(ph.id, w.num, i), tipoParaStickers(d)))));
    const semana = kind === 'weekly' ? (fases[0]?.weekData?.[0]?.days ?? []) : [];
    return (id) => {
      const llave = String(id ?? '').split('#')[0];
      if (mapa.has(llave)) return mapa.get(llave);
      const m = /^wk-.*-d(\d+)$/.exec(llave);
      return m && semana[Number(m[1])] ? tipoParaStickers(semana[Number(m[1])]) : null;
    };
  }, [phases, kind]);
}
