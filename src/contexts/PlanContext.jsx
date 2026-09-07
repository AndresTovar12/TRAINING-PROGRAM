import {
  createContext, useContext, useEffect, useState, useMemo, useCallback,
} from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  getActivePlan, listExercises, listExerciseMedia, getMasterId,
  listExerciseOverrides, aplicarOverrides,
} from '@/lib/api';

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
  const { user, profile } = useAuth();
  const [planRow, setPlanRow] = useState(null);
  const [planLoading, setPlanLoading] = useState(true);
  const [exercisesBase, setExercisesBase] = useState([]);
  const [overrides, setOverrides] = useState([]);
  const [mediasTodas, setMediasTodas] = useState([]);
  const [masterId, setMasterId] = useState(null);

  // De quién son las versiones que hay que aplicar. Un atleta ve las de SU
  // coach; un coach que abre su propia app de entrenamiento ve las suyas.
  const coachDeLaVista = profile?.role === 'admin' ? (profile?.id ?? null) : (profile?.coach_id ?? null);

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
      .then((rows) => { if (!cancelled) setExercisesBase(rows ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Las versiones que el coach de esta persona hizo suyas. Se aplican encima
  // del repertorio, así que el atleta ve el video y la foto que SU entrenador
  // preparó, no los del master.
  useEffect(() => {
    let cancelled = false;
    if (!coachDeLaVista) { setOverrides([]); return undefined; }
    listExerciseOverrides(coachDeLaVista)
      .then((rows) => { if (!cancelled) setOverrides(rows ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [coachDeLaVista]);

  const exercises = useMemo(
    () => aplicarOverrides(exercisesBase, overrides),
    [exercisesBase, overrides],
  );

  // Videos extra: ángulos, versiones por género y videos puestos a mano para
  // un atleta. Se piden todos de una vez porque son pocas filas y así el
  // reproductor no tiene que ir a la red cada vez que se abre un ejercicio.
  useEffect(() => {
    let cancelled = false;
    if (exercisesBase.length === 0) return undefined;
    // Se depende del repertorio SIN versiones aplicadas a propósito: los ids
    // son los mismos con o sin ellas, y colgarse de la lista ya fusionada haría
    // que cada carga de versiones dispare otra consulta de medios sin motivo.
    listExerciseMedia(exercisesBase.map((e) => e.id))
      .then((rows) => { if (!cancelled) setMediasTodas(rows ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [exercisesBase]);

  useEffect(() => {
    let cancelled = false;
    getMasterId().then((id) => { if (!cancelled) setMasterId(id); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  /**
   * Los medios que de verdad le tocan a esta persona.
   *
   * POR QUE HAY QUE FILTRAR: la tabla de medios se puede leer entera, y un
   * ejercicio base es compartido por todos los coaches. Sin este filtro, un
   * ángulo o una versión por género que subió el coach A sobre "Sentadilla"
   * aparecería también a los atletas del coach B. Nadie vería un error: la app
   * simplemente enseñaría el video equivocado, grabado por otro entrenador.
   *
   * Vale un medio si: me lo pusieron a mí, lo subió mi coach, o lo subió el
   * master (esos son los de fábrica y sirven para todos).
   */
  const medias = useMemo(() => {
    return (mediasTodas ?? []).filter((m) => {
      if (m.para_atleta) return m.para_atleta === user?.id;
      return m.created_by === coachDeLaVista || m.created_by === masterId;
    });
  }, [mediasTodas, coachDeLaVista, masterId, user?.id]);

  const phases = useMemo(
    () => normalizePlan(planRow?.data?.phases),
    [planRow],
  );

  // 'weekly' = rutina que se repite | 'periodized' = fases que avanzan.
  // Los planes creados antes de existir este campo son periodizados.
  const kind = planRow?.data?.kind === 'weekly' ? 'weekly' : 'periodized';

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
      kind,
      hasPlan: !!phases && phases.length > 0,
      planMeta: planRow ? { id: planRow.id, title: planRow.title } : null,
      planLoading,
      exercises,
      medias,
      resolveExercise,
    }),
    [phases, kind, planRow, planLoading, exercises, medias, resolveExercise],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan debe usarse dentro de <PlanProvider>');
  return ctx;
}
