import {
  createContext, useContext, useEffect, useState, useMemo, useCallback,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getActivePlan, listExercises } from '@/lib/api';

/**
 * Carga el plan activo del usuario autenticado (tabla `plans`, jsonb con la
 * misma estructura del plan original: fases → semanas → días → ejercicios) y
 * el repertorio de ejercicios para resolver media (foto/video/link) en vivo.
 */
const PlanContext = createContext(null);

const norm = (s) => (s || '').toLowerCase().trim();

const arr = (x) => (Array.isArray(x) ? x : []);

/**
 * Rellena con defaults seguros los campos opcionales que solo trae el plan
 * ORIGINAL (migrado) y que el builder admin no produce, para que la vista del
 * atleta nunca crashee sin importar el origen del plan. No sobreescribe valores
 * existentes: solo agrega los ausentes. Los planes ricos pasan intactos.
 */
function normalizePlan(phases) {
  if (!Array.isArray(phases)) return null;
  return phases.map((p, pi) => {
    const weekData = arr(p?.weekData).map((w, wi) => {
      const days = arr(w?.days).map((d) => {
        if (d?.blocks) {
          // Día dual (heredado): asegura arrays internos de cada bloque
          return {
            ...d,
            blocks: arr(d.blocks).map((b) => ({ ...b, exercises: b?.exercises ? arr(b.exercises) : b?.exercises })),
            notes: d.notes == null ? d.notes : arr(d.notes),
          };
        }
        return {
          ...d,
          exercises: arr(d?.exercises),
          notes: d?.notes == null ? d?.notes : arr(d.notes),
        };
      });
      return {
        ...w,
        num: w?.num ?? wi + 1,
        label: w?.label ?? '',
        load: w?.load ?? '',
        days,
      };
    });
    return {
      ...p,
      id: p?.id ?? `p-${pi + 1}`,
      num: p?.num ?? pi + 1,
      name: p?.name ?? `Fase ${pi + 1}`,
      fullName: p?.fullName ?? p?.name ?? '',
      duration: p?.duration ?? `${weekData.length} semana${weekData.length !== 1 ? 's' : ''}`,
      weeks: p?.weeks ?? weekData.length,
      color: p?.color ?? '#1E40E0',
      focus: p?.focus ?? '',
      objective: p?.objective ?? '',
      science: p?.science ?? '',
      references: arr(p?.references),
      advance: arr(p?.advance),
      weekData,
    };
  });
}

export function PlanProvider({ children }) {
  const { user } = useAuth();
  const [planRow, setPlanRow] = useState(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [exercises, setExercises] = useState([]);

  useEffect(() => {
    let cancelled = false;
    if (!user?.id) {
      setPlanRow(null);
      setPlanLoading(false);
      return;
    }
    setPlanLoading(true);
    getActivePlan(user.id)
      .then((row) => { if (!cancelled) setPlanRow(row); })
      .catch(() => { if (!cancelled) setPlanRow(null); })
      .finally(() => { if (!cancelled) setPlanLoading(false); });
    return () => { cancelled = true; };
  }, [user?.id]);

  // Repertorio para media viva (best-effort: si falla, la app sigue sin media)
  useEffect(() => {
    let cancelled = false;
    listExercises()
      .then((rows) => { if (!cancelled) setExercises(rows ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const phases = useMemo(
    () => normalizePlan(planRow?.data?.phases),
    [planRow],
  );

  const exercisesById = useMemo(() => {
    const m = new Map();
    exercises.forEach((e) => m.set(e.id, e));
    return m;
  }, [exercises]);

  const exercisesByName = useMemo(() => {
    const m = new Map();
    exercises.forEach((e) => m.set(norm(e.name), e));
    return m;
  }, [exercises]);

  // Resuelve un ejercicio del plan contra el repertorio: por id o por nombre.
  const resolveExercise = useCallback(
    (ex) => {
      if (!ex || ex.isNote) return null;
      if (ex.exercise_id && exercisesById.has(ex.exercise_id)) {
        return exercisesById.get(ex.exercise_id);
      }
      return exercisesByName.get(norm(ex.name)) ?? null;
    },
    [exercisesById, exercisesByName],
  );

  const value = useMemo(
    () => ({
      phases: phases ?? [],
      hasPlan: !!phases && phases.length > 0,
      planMeta: planRow ? { id: planRow.id, title: planRow.title } : null,
      planLoading,
      exercises,
      resolveExercise,
    }),
    [phases, planRow, planLoading, exercises, resolveExercise],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan debe usarse dentro de <PlanProvider>');
  return ctx;
}
