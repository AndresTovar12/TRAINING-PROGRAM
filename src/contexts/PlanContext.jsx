import {
  createContext, useContext, useEffect, useState, useMemo, useCallback,
} from 'react';
import { usePerfilDeLaVista } from '@/contexts/VistaContext';
import {
  getProgramas, getSesionesPegadas, nombresDelEquipo, versionesDelEquipo, listExercises, listExerciseMedia,
  getMasterId, listExerciseOverrides, aplicarOverrides,
} from '@/lib/api';
import { estructuraDelPlan } from '@/lib/training-utils';
import { adaptadorDeRegistros, fasesConPegadas, reglasDe } from '@/lib/pegadas';
import { colorDePrograma, tieneSesiones } from '@/lib/programas';
import { conNombreDeSuFicha } from '@/lib/nombreDeLaFicha';

/**
 * Carga el plan activo de la persona cuya app se dibuja —quien entró, o el
 * atleta que su coach está viendo— (tabla `plans`, jsonb con la
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
      const days = arr(w?.days).map((d) => ({
        ...d,
        exercises: arr(d?.exercises),
        notes: d?.notes == null ? d?.notes : arr(d.notes),
      }));
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

/**
 * PROGRAMAS. Un atleta tiene el plan de su coach principal y, si tiene equipo,
 * uno por cada profesional que ya armó el suyo (`plans.profesional_id`). Cada
 * programa trae SU profesional, sus fases, sus ejercicios con las versiones de
 * ESE profesional y sus medios.
 *
 * `usePlan()` sigue devolviendo UN programa —el activo, por defecto el
 * principal— para que ninguna pantalla se entere: sin equipo hay uno solo y
 * todo funciona exactamente como antes. `useProgramas()` da la lista.
 *
 * Los registros del atleta (`wr:sessions`, `wr:cursor`) de un programa de
 * equipo van en claves aparte: `wr:sessions@<profesional>`. Ver `claveDe`.
 *
 * SESIONES PEGADAS (`lib/pegadas.js`). Lo que un profesional le pega al
 * programa del coach no es un programa aparte con sus fases: es lo suyo repartido
 * en los días del programa del coach. Aquí se arma como un programa MÁS de la
 * lista (`sobre: true`), con las mismas fases y semanas que el del coach y solo
 * las sesiones de ese profesional. Así todo lo que ya sabe pintar, marcar y
 * anotar un programa sirve también para esto. Su puntero es el del coach
 * (`sigueA`) y lo que se anota va en `wr:sessions@<profesional>:sobre`.
 */
export function PlanProvider({ children }) {
  const { userId, perfil } = usePerfilDeLaVista();
  const [filas, setFilas] = useState([]);              // planes activos: principal + equipo
  const [filasPegadas, setFilasPegadas] = useState([]); // sesiones pegadas: una fila por autor
  const [miembros, setMiembros] = useState(null);      // equipo (nombres); null = no se pidió
  const [planLoading, setPlanLoading] = useState(true);
  const [exercisesBase, setExercisesBase] = useState([]);
  const [overridesTodas, setOverridesTodas] = useState([]);
  const [mediasTodas, setMediasTodas] = useState([]);
  const [masterId, setMasterId] = useState(null);
  const [activoId, setActivoId] = useState(null);      // id del plan activo; null = el de por defecto

  // El coach principal de la persona cuya app se dibuja (o ella misma si es
  // profesional y abre su propia app de entrenamiento).
  const principalId = perfil?.role === 'admin' ? (perfil?.id ?? null) : (perfil?.coach_id ?? null);

  useEffect(() => {
    let cancelled = false;
    setActivoId(null);
    if (!userId) {
      setFilas([]);
      setFilasPegadas([]);
      setMiembros(null);
      setPlanLoading(false);
      return undefined;
    }
    setPlanLoading(true);
    (async () => {
      try {
        // Las pegadas van aparte y sin tumbar nada: si fallan, el atleta ve sus programas.
        const [rows, pegadas] = await Promise.all([getProgramas(userId), getSesionesPegadas(userId).catch(() => [])]);
        // Los nombres solo hacen falta si hay más de un programa.
        const conEquipo = rows.some((r) => r.profesional_id) || pegadas.length > 0;
        const nombres = conEquipo ? await nombresDelEquipo(userId).catch(() => null) : null;
        if (cancelled) return;
        setFilas(rows);
        setFilasPegadas(pegadas);
        setMiembros(nombres);
      } catch {
        if (!cancelled) { setFilas([]); setFilasPegadas([]); setMiembros(null); }
      } finally {
        if (!cancelled) setPlanLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId]);

  // Repertorio para media viva (best-effort: si falla, la app sigue sin media)
  useEffect(() => {
    let cancelled = false;
    listExercises()
      .then((rows) => { if (!cancelled) setExercisesBase(rows ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  // Las versiones que hicieron suyas el coach principal y el equipo de esta
  // persona. Se aplican encima del repertorio, así que el atleta ve el video y
  // la foto que preparó CADA profesional en su programa, no los del master.
  useEffect(() => {
    let cancelled = false;
    if (!principalId && !userId) { setOverridesTodas([]); return undefined; }
    const propia = perfil?.role === 'admin';
    const pide = propia
      ? listExerciseOverrides(perfil.id)
      : versionesDelEquipo(userId).catch(() => (principalId ? listExerciseOverrides(principalId) : []));
    pide.then((rows) => { if (!cancelled) setOverridesTodas(rows ?? []); }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId, principalId, perfil?.role, perfil?.id]);

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

  /* Un programa por plan activo. Los de equipo solo cuentan mientras esa persona
     siga en el equipo (si el atleta la quita, su programa se esconde; la base no
     borra nada y al volver a agregarla regresa todo). */
  const programas = useMemo(() => {
    const activos = miembros ? new Set(miembros.filter((m) => m.estado === 'activo').map((m) => m.profesional_id)) : null;
    // Lo que hace falta para pintar los ejercicios de UN profesional: el
    // repertorio con SUS versiones, sus medios y cómo resolver un ejercicio.
    const herramientasDe = (duenoId) => {
      const exercises = aplicarOverrides(exercisesBase, overridesTodas.filter((o) => o.coach_id === duenoId));
      const porId = new Map(); const porNombre = new Map();
      exercises.forEach((e) => { porId.set(e.id, e); porNombre.set(norm(e.name), e); });
      const medias = (mediasTodas ?? []).filter((m) => (
        m.para_atleta ? m.para_atleta === userId : (m.created_by === duenoId || m.created_by === masterId)
      ));
      return {
        exercises,
        medias,
        // La ficha de una línea por su `exercise_id` (nunca por nombre): de ahí sale el nombre que se enseña.
        fichaDe: (ex) => (ex?.exercise_id ? porId.get(ex.exercise_id) ?? null : null),
        resolveExercise: (ex) => {
          if (!ex || ex.isNote) return null;
          if (ex.exercise_id && porId.has(ex.exercise_id)) return porId.get(ex.exercise_id);
          return porNombre.get(norm(ex.name)) ?? null;
        },
      };
    };
    const profesionalDe = (miembro) => (miembro
      ? { id: miembro.profesional_id, full_name: miembro.full_name, username: miembro.username, profesion: miembro.profesion, avatar_url: miembro.avatar_url }
      : null);
    const armar = (row) => {
      const esPrincipal = !row.profesional_id;
      const duenoId = row.profesional_id ?? principalId;
      const miembro = miembros?.find((m) => m.profesional_id === duenoId) ?? null;
      const herramientas = herramientasDe(duenoId);
      // Cada línea ligada a una ficha se llama como ella (ver `lib/nombreDeLaFicha.js`).
      const phases = conNombreDeSuFicha(normalizePlan(row.data?.phases) ?? [], herramientas.fichaDe);
      return {
        id: row.id,
        clave: row.profesional_id ?? null,        // sufijo de los registros; null = el principal
        esPrincipal,
        profesionalId: duenoId ?? null,
        profesional: profesionalDe(miembro),
        altaEn: miembro?.alta_en ?? null,
        title: row.title,
        phases,
        kind: row.data?.kind === 'weekly' ? 'weekly' : 'periodized',
        estructura: estructuraDelPlan(row.data),
        hasPlan: phases.length > 0,
        conSesiones: tieneSesiones(phases),
        ...herramientas,
      };
    };
    /* Las sesiones de un profesional pegadas al programa del coach, vistas como
       un programa más. Mismas fases y semanas que el del coach; cada semana trae
       solo lo del autor. */
    const armarPegadas = (fila, principal) => {
      const reglas = reglasDe(fila);
      const miembro = miembros?.find((m) => m.profesional_id === fila.profesional_id) ?? null;
      const kind = principal.kind === 'weekly' ? 'weekly' : 'periodized';
      const herramientas = herramientasDe(fila.profesional_id);
      const phases = conNombreDeSuFicha(normalizePlan(fasesConPegadas(reglas, principal.phases, {
        autorId: fila.profesional_id, semanal: kind === 'weekly',
      })) ?? [], herramientas.fichaDe);
      const { vista, llaveEstable } = adaptadorDeRegistros(phases, kind);
      return {
        id: `${fila.id}:sobre`,
        clave: `${fila.profesional_id}:sobre`,
        esPrincipal: false,
        sobre: true,                               // pegada al programa del coach
        sigueA: principal,                         // su puntero es el del coach
        profesionalId: fila.profesional_id,
        profesional: profesionalDe(miembro),
        altaEn: miembro?.alta_en ?? null,
        title: 'Sesiones sobre el programa',
        phases,
        kind,
        estructura: principal.estructura,
        hasPlan: phases.some((f) => (f.weekData ?? []).some((w) => (w.days ?? []).length > 0)),
        conSesiones: tieneSesiones(phases),
        // Lo que anota el atleta se guarda con llaves estables y aquí se ve por posición.
        vistaDeRegistros: vista,
        llaveEstable,
        ...herramientas,
      };
    };
    const propios = filas
      .filter((r) => !r.profesional_id || !activos || activos.has(r.profesional_id))
      .sort((a, b) => (a.profesional_id ? 1 : 0) - (b.profesional_id ? 1 : 0))   // el principal primero
      .map(armar);
    const principal = propios.find((p) => p.esPrincipal) ?? null;
    const pegadas = principal
      ? filasPegadas
        .filter((f) => reglasDe(f).length > 0 && (!activos || activos.has(f.profesional_id)))
        .map((f) => armarPegadas(f, principal))
      : [];
    const todos = [...propios, ...pegadas];
    // Un color por PERSONA, no por programa: sus sesiones pegadas y su programa aparte van del mismo color.
    const autores = [];
    todos.forEach((p) => { if (!autores.includes(p.profesionalId)) autores.push(p.profesionalId); });
    return todos.map((p) => ({ ...p, color: colorDePrograma(autores.indexOf(p.profesionalId)) }));
  }, [filas, filasPegadas, miembros, exercisesBase, overridesTodas, mediasTodas, masterId, userId, principalId]);

  const activo = programas.find((p) => p.id === activoId) ?? programas[0] ?? null;
  const elegirPrograma = useCallback((planId) => setActivoId(planId), []);

  // Clave de un registro del atleta para el programa activo: `wr:sessions` o
  // `wr:sessions@<profesional>`.
  const claveActiva = activo?.clave ?? null;
  const claveDe = useCallback(
    (base) => (claveActiva ? `${base}@${claveActiva}` : base),
    [claveActiva],
  );

  const value = useMemo(
    () => ({
      phases: activo?.phases ?? [],
      kind: activo?.kind ?? 'periodized',
      estructura: activo?.estructura ?? estructuraDelPlan(null),
      hasPlan: !!activo?.hasPlan,
      planMeta: activo ? { id: activo.id, title: activo.title } : null,
      planLoading,
      exercises: activo?.exercises ?? aplicarOverrides(exercisesBase, []),
      medias: activo?.medias ?? [],
      resolveExercise: activo?.resolveExercise ?? (() => null),
      // Varios programas
      programas,
      programaActivo: activo,
      elegirPrograma,
      claveDe,
    }),
    [activo, programas, planLoading, exercisesBase, elegirPrograma, claveDe],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan debe usarse dentro de <PlanProvider>');
  return ctx;
}

/**
 * Pinta a sus hijos como si ESTE programa fuera el activo: sus fases, su manera
 * de resolver un ejercicio (con las versiones y el video de SU profesional) y
 * sus medios. Es lo que permite juntar en una sola pantalla las sesiones de
 * varios profesionales —el día de «Plan» las apila— sin que cada una pierda su
 * contexto: el ejercicio que puso el fisio se ve con el video del fisio.
 *
 * Solo cambia lo que ven los hijos; el programa activo de la app sigue siendo
 * el mismo.
 */
export function ComoPrograma({ programa, children }) {
  const base = useContext(PlanContext);
  const value = useMemo(() => ({
    ...base,
    phases: programa.phases,
    kind: programa.kind,
    estructura: programa.estructura,
    hasPlan: programa.hasPlan,
    planMeta: { id: programa.id, title: programa.title },
    exercises: programa.exercises,
    medias: programa.medias,
    resolveExercise: programa.resolveExercise,
    programaActivo: programa,
    claveDe: (base0) => (programa.clave ? `${base0}@${programa.clave}` : base0),
  }), [base, programa]);
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}
