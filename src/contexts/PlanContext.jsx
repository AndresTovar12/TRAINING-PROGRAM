import {
  createContext, useContext, useEffect, useRef, useState, useMemo, useCallback,
} from 'react';
import { usePerfilDeLaVista } from '@/contexts/VistaContext';
import {
  getProgramas, getSesionesPegadas, nombresDelEquipo, versionesDelEquipo, listExercises, listExerciseMedia,
  getMasterId, listExerciseOverrides, aplicarOverrides,
} from '@/lib/api';
import { leeMisCompras } from '@/lib/comprasApi';
import { conCopiaEnElTelefono, guardaEnElTelefono, leeDelTelefono } from '@/lib/almacenDelTelefono';
import { alVolverLaSenal, esFaltaDeSenal, haySenalAhora, marcaSinSenal } from '@/lib/senal';
import { estructuraDelPlan, expandeMicrociclos } from '@/lib/training-utils';
import { adaptadorDeRegistros, fasesConPegadas, reglasDe } from '@/lib/pegadas';
import { colorDePrograma, tieneSesiones } from '@/lib/programas';
import { conNombreDeSuFicha } from '@/lib/nombreDeLaFicha';
import { normalizaCiencia } from '@/lib/ciencia';
import { diasDeWorkout, planDeRutina } from '@/lib/misPlanesDatos';

/**
 * Carga el plan activo de la persona cuya app se dibuja —quien entró, o el
 * atleta que su coach está viendo— (tabla `plans`, jsonb con la
 * misma estructura del plan original: fases → semanas → días → ejercicios) y
 * el repertorio de ejercicios para resolver media (foto/video/link) en vivo.
 */
const PlanContext = createContext(null);

const norm = (s) => (s || '').toLowerCase().trim();

const arr = (x) => (Array.isArray(x) ? x : []);

/* LA COPIA DEL PLAN EN EL TELÉFONO (1 nov 2026, encargo «sin conexión», parte 2.1; ver `docs/sin-conexion.md`).
   Cada pieza que se baja para armar el plan (los programas, lo pegado, el equipo, las compras, el repertorio, las versiones, los medios, el master) se guarda en el teléfono al
   llegar (`tl:plan:<id>:<pieza>`). SOLO SE USA SIN SEÑAL: si se sabe que no hay, de una vez; si no, cuando la pieza no llega por falta de señal. Con señal siempre se pide
   al servidor (como antes) y en cuanto vuelve la señal se vuelve a pedir todo. La copia del plan NUNCA se escribe en la base: aquí solo se lee para dibujar, y la app del
   atleta no guarda planes (eso lo hace el editor del coach, que lee el plan del servidor, no de aquí). Solo en la app de iPhone y solo en la app propia (no en «Ver como»). */
async function deLaBaseOLaCopia({ conCopia, clave, pide, alUsarCopia, vacioNoSirve = false }) {
  if (!conCopia) return pide();
  const deLaCopia = async () => {
    const copia = await leeDelTelefono(clave);
    return copia && typeof copia === 'object' && 'valor' in copia ? copia : null;
  };
  if (!haySenalAhora()) {
    const copia = await deLaCopia();
    if (copia) { alUsarCopia(); return copia.valor; }
  }
  try {
    const valor = await pide();
    // Una pieza que dice «nada» (null) sin señal no se cree: es la que se traga su error (el master, p. ej.).
    if (vacioNoSirve && valor == null) throw new Error('Sin respuesta');
    guardaEnElTelefono(clave, { valor, en: Date.now() });
    return valor;
  } catch (e) {
    const copia = await deLaCopia();
    if (copia) {
      if (esFaltaDeSenal(e)) marcaSinSenal();
      alUsarCopia();
      return copia.valor;
    }
    throw e;
  }
}

/**
 * Rellena con defaults seguros los campos opcionales que solo trae el plan
 * ORIGINAL (migrado) y que el builder admin no produce, para que la vista del
 * atleta nunca crashee sin importar el origen del plan. No sobreescribe valores
 * existentes: solo agrega los ausentes. Los planes ricos pasan intactos.
 */
function normalizePlan(phases) {
  if (!Array.isArray(phases)) return null;
  return expandeMicrociclos(phases.map((p, pi) => {
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
      // La foto de la fase (Home) y los recuadros de ciencia de esta fase (ver `lib/ciencia.js`).
      image: typeof p?.image === 'string' ? p.image : '',
      ciencia: normalizaCiencia(p?.ciencia),
      references: arr(p?.references),
      advance: arr(p?.advance),
      weekData,
    };
  }));
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
  const { userId, perfil, soloLectura } = usePerfilDeLaVista();
  const [filas, setFilas] = useState([]);              // planes activos: principal + equipo
  const [filasPegadas, setFilasPegadas] = useState([]); // sesiones pegadas: una fila por autor
  const [miembros, setMiembros] = useState(null);      // equipo (nombres); null = no se pidió
  const [comprados, setComprados] = useState([]);       // los planes que COMPRÓ (ya recortados por el servidor); solo de quien entró
  const [comprasFallo, setComprasFallo] = useState(false); // la lista de compras no pudo bajar (sin señal, servidor caído, sesión cerrada en otro aparato): se avisa en vez de callar (p9)
  const [demo, setDemo] = useState(null);               // un workout de DEMOSTRACIÓN que se está haciendo (mientras dura, es el único «programa»); null = ninguno
  const [planLoading, setPlanLoading] = useState(true);
  const [exercisesBase, setExercisesBase] = useState([]);
  const [overridesTodas, setOverridesTodas] = useState([]);
  const [mediasTodas, setMediasTodas] = useState([]);
  const [masterId, setMasterId] = useState(null);
  const [activoId, setActivoId] = useState(null);      // id del plan activo; null = el de por defecto

  // El coach principal de la persona cuya app se dibuja (o ella misma si es
  // profesional y abre su propia app de entrenamiento).
  const principalId = perfil?.role === 'admin' ? (perfil?.id ?? null) : (perfil?.coach_id ?? null);

  // La copia del teléfono (ver `deLaBaseOLaCopia`): solo en la app y solo en la app propia.
  const conCopia = conCopiaEnElTelefono() && !soloLectura && !!userId;
  const llaveDeCopia = useCallback((pieza) => `tl:plan:${userId}:${pieza}`, [userId]);
  // Sube cada vez que vuelve la señal después de dibujar con la copia: se vuelve a pedir todo al servidor.
  const [vuelta, setVuelta] = useState(0);
  const conPiezasDeLaCopia = useRef(false);
  const marcaCopia = useCallback(() => { conPiezasDeLaCopia.current = true; }, []);
  useEffect(() => alVolverLaSenal(() => {
    if (!conPiezasDeLaCopia.current) return;
    conPiezasDeLaCopia.current = false;
    setVuelta((n) => n + 1);
  }), []);

  // Otra persona: el programa elegido vuelve al de por defecto (al volver la señal NO: se queda en el que estaba).
  useEffect(() => { setActivoId(null); }, [userId]);
  // Ya se dibujó un plan para esta persona: al refrescarlo (volvió la señal) no se pone «cargando» (la copia se queda a la vista hasta que llega lo nuevo).
  const yaDibujado = useRef(null);

  useEffect(() => {
    let cancelled = false;
    if (!userId) {
      setFilas([]);
      setFilasPegadas([]);
      setMiembros(null);
      setPlanLoading(false);
      yaDibujado.current = null;
      return undefined;
    }
    if (yaDibujado.current !== userId) setPlanLoading(true);
    (async () => {
      try {
        const { rows, pegadas, nombres } = await deLaBaseOLaCopia({
          conCopia, clave: llaveDeCopia('programas'), alUsarCopia: marcaCopia,
          pide: async () => {
            // Las pegadas van aparte y sin tumbar nada: si fallan, el atleta ve sus programas (salvo por falta de señal: entonces mejor la copia, que sí las trae).
            const [r, p] = await Promise.all([getProgramas(userId), getSesionesPegadas(userId).catch((e) => { if (esFaltaDeSenal(e)) throw e; return []; })]);
            // Los nombres solo hacen falta si hay más de un programa.
            const conEquipo = r.some((x) => x.profesional_id) || p.length > 0;
            const n = conEquipo ? await nombresDelEquipo(userId).catch((e) => { if (esFaltaDeSenal(e)) throw e; return null; }) : null;
            return { rows: r, pegadas: p, nombres: n };
          },
        });
        if (cancelled) return;
        setFilas(rows ?? []);
        setFilasPegadas(pegadas ?? []);
        setMiembros(nombres ?? null);
        yaDibujado.current = userId;
      } catch {
        if (!cancelled && yaDibujado.current !== userId) { setFilas([]); setFilasPegadas([]); setMiembros(null); }
      } finally {
        if (!cancelled) setPlanLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [userId, conCopia, llaveDeCopia, marcaCopia, vuelta]);

  /* Los planes que COMPRÓ, aparte y sin hacer esperar al resto: llegan cuando llegan y la app ya está pintada con lo demás. Quien ve la app de otro persona («Ver como»)
     no trae las compras de esa persona: la función solo contesta por quien entró. */
  useEffect(() => {
    let cancelled = false;
    if (!userId || soloLectura) { setComprados([]); return undefined; }
    deLaBaseOLaCopia({ conCopia, clave: llaveDeCopia('compras'), alUsarCopia: marcaCopia, pide: leeMisCompras })
      .then((c) => { if (!cancelled) { setComprados(c ?? []); setComprasFallo(false); } })
      .catch(() => { if (!cancelled) setComprasFallo(true); });
    return () => { cancelled = true; };
  }, [userId, soloLectura, conCopia, llaveDeCopia, marcaCopia, vuelta]);
  const reintentaCompras = useCallback(async () => {
    try { setComprados(await leeMisCompras()); setComprasFallo(false); } catch { setComprasFallo(true); }
  }, []);

  // Repertorio para media viva (best-effort: si falla, la app sigue sin media)
  useEffect(() => {
    let cancelled = false;
    deLaBaseOLaCopia({ conCopia, clave: llaveDeCopia('ejercicios'), alUsarCopia: marcaCopia, pide: listExercises })
      .then((rows) => { if (!cancelled) setExercisesBase(rows ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [conCopia, llaveDeCopia, marcaCopia, vuelta]);

  // Las versiones que hicieron suyas el coach principal y el equipo de esta
  // persona. Se aplican encima del repertorio, así que el atleta ve el video y
  // la foto que preparó CADA profesional en su programa, no los del master.
  useEffect(() => {
    let cancelled = false;
    if (!principalId && !userId) { setOverridesTodas([]); return undefined; }
    const propia = perfil?.role === 'admin';
    const pide = () => (propia
      ? listExerciseOverrides(perfil.id)
      : versionesDelEquipo(userId).catch((e) => {
        if (esFaltaDeSenal(e)) throw e; // sin señal, mejor la copia que la lista vacía de abajo
        return principalId ? listExerciseOverrides(principalId) : [];
      }));
    deLaBaseOLaCopia({ conCopia, clave: llaveDeCopia('versiones'), alUsarCopia: marcaCopia, pide })
      .then((rows) => { if (!cancelled) setOverridesTodas(rows ?? []); }).catch(() => {});
    return () => { cancelled = true; };
  }, [userId, principalId, perfil?.role, perfil?.id, conCopia, llaveDeCopia, marcaCopia, vuelta]);

  // Videos extra: ángulos, versiones por género y videos puestos a mano para
  // un atleta. Se piden todos de una vez porque son pocas filas y así el
  // reproductor no tiene que ir a la red cada vez que se abre un ejercicio.
  useEffect(() => {
    let cancelled = false;
    if (exercisesBase.length === 0) return undefined;
    // Se depende del repertorio SIN versiones aplicadas a propósito: los ids
    // son los mismos con o sin ellas, y colgarse de la lista ya fusionada haría
    // que cada carga de versiones dispare otra consulta de medios sin motivo.
    deLaBaseOLaCopia({ conCopia, clave: llaveDeCopia('medios'), alUsarCopia: marcaCopia, pide: () => listExerciseMedia(exercisesBase.map((e) => e.id)) })
      .then((rows) => { if (!cancelled) setMediasTodas(rows ?? []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [exercisesBase, conCopia, llaveDeCopia, marcaCopia]);

  useEffect(() => {
    let cancelled = false;
    deLaBaseOLaCopia({ conCopia, clave: llaveDeCopia('master'), alUsarCopia: marcaCopia, pide: getMasterId, vacioNoSirve: true })
      .then((id) => { if (!cancelled) setMasterId(id); }).catch(() => {});
    return () => { cancelled = true; };
  }, [conCopia, llaveDeCopia, marcaCopia, vuelta]);

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
        // La foto del plan (la que sale en Home) y su ciencia: son datos de CADA plan.
        foto: typeof row.data?.foto === 'string' ? row.data.foto : '',
        ciencia: normalizaCiencia(row.data?.ciencia),
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
        foto: '',
        ciencia: [],
        hasPlan: phases.some((f) => (f.weekData ?? []).some((w) => (w.days ?? []).length > 0)),
        conSesiones: tieneSesiones(phases),
        // Lo que anota el atleta se guarda con llaves estables y aquí se ve por posición.
        vistaDeRegistros: vista,
        llaveEstable,
        ...herramientas,
      };
    };
    /* UN PLAN COMPRADO, visto como un programa más. El servidor ya lo recortó (`lib/ventana.js`): las semanas que no se ven llegan cerradas (`bloqueada`), sin ejercicios.
       Va en su propia clave de registros (`compra:<id>`): se puede tener varios planes del mismo coach. `cursorBase` es dónde empieza el puntero (la fase de entrada y
       la semana de la compra); sin él, el calendario contaría desde el día en que abra la app. Cerrado (vencido o por armar) no trae sesiones: no sale en «Hoy». */
    const armarComprada = (c) => {
      const v = c.vendedor ?? null;
      const duenoId = v?.id ?? null;
      const herramientas = herramientasDe(duenoId);
      const data = c.programa?.data ?? {};
      const phases = conNombreDeSuFicha(normalizePlan(data.phases) ?? [], herramientas.fichaDe);
      const cerrada = !c.programa || c.programa.resumen?.cerrado || c.estado === 'vencida' || c.estado === 'por_armar';
      return {
        id: `compra:${c.compra_id}`,
        clave: `compra:${c.compra_id}`,
        esPrincipal: false,
        comprado: true,
        compra: {
          id: c.compra_id, estado: c.estado, tipo: c.tipo, inicio: c.inicio, periodoHasta: c.periodo_hasta, graciaHasta: c.gracia_hasta, entregaLimite: c.entrega_limite,
          chat: !!c.chat, tecnica: !!c.tecnica, ventanaSemanas: c.ventana_semanas ?? null, resumen: c.programa?.resumen ?? null,
        },
        profesionalId: duenoId,
        profesional: v ? { id: v.id, full_name: v.nombre, username: v.usuario, profesion: v.profesion, avatar_url: v.foto } : null,
        altaEn: null,
        title: c.titulo,
        phases,
        kind: data.kind === 'weekly' ? 'weekly' : 'periodized',
        estructura: estructuraDelPlan(data),
        foto: typeof data.foto === 'string' ? data.foto : '',
        ciencia: normalizaCiencia(data.ciencia),
        cursorBase: c.programa?.cursorInicial ?? null,
        hasPlan: !cerrada && phases.some((f) => (f.weekData ?? []).some((w) => (w.days ?? []).length > 0)),
        conSesiones: !cerrada && tieneSesiones(phases),
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
    // Una biblioteca de clases no es un programa (no tiene fases ni sesiones por semana): va aparte, en `bibliotecas`.
    /* UN WORKOUT DE DEMOSTRACIÓN, visto como un programa de un solo día (12 oct 2026): para quien quiere ver cómo se inicia un workout, tenga o no un plan. Cae EN EL DÍA DE HOY
       (así sale en «Hoy te toca»), va en su propia clave de registros (`demo:<id>`) y no lleva cámara de técnica (no tiene a quién mandársela). Mientras dura, es el único programa:
       la app se ve como la de alguien con ese workout y nada más, sin mezclarse con el resto; `cierraDemo` la deja como estaba. */
    const armarDemo = (d) => {
      const herramientas = herramientasDe(d.autor_id);
      const hoy = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][new Date().getDay()];
      const plan = planDeRutina({ days: diasDeWorkout(d.data, hoy, d.name) });
      const phases = conNombreDeSuFicha(normalizePlan(plan.phases) ?? [], herramientas.fichaDe);
      return {
        id: `demo:${d.id}`, clave: `demo:${d.id}`, esPrincipal: false, esDemo: true,
        comprado: true, compra: { id: null, estado: 'activa', tipo: 'pago_unico', chat: false, tecnica: false },
        profesionalId: d.autor_id ?? null, profesional: null, altaEn: null,
        title: d.name, phases, kind: 'weekly', estructura: 'rutina', foto: '', ciencia: [],
        hasPlan: true, conSesiones: tieneSesiones(phases),
        ...herramientas,
      };
    };
    const compradas = comprados.filter((c) => !c.biblioteca).map(armarComprada);
    const todos = demo ? [armarDemo(demo)] : [...propios, ...pegadas, ...compradas];
    // Un color por PERSONA, no por programa: sus sesiones pegadas y su programa aparte van del mismo color.
    const autores = [];
    todos.forEach((p) => { if (!autores.includes(p.profesionalId)) autores.push(p.profesionalId); });
    return todos.map((p) => ({ ...p, color: colorDePrograma(autores.indexOf(p.profesionalId)) }));
  }, [filas, filasPegadas, comprados, demo, miembros, exercisesBase, overridesTodas, mediasTodas, masterId, userId, principalId]);

  /* Las BIBLIOTECAS de clases que compró («todas mis clases»): una por compra, con las clases que trae la función en este momento. `estado` decide si se ven (vencida = lista vacía y «Renovar»). */
  const bibliotecas = useMemo(() => comprados.filter((c) => c.biblioteca).map((c) => ({
    id: c.compra_id, titulo: c.titulo, estado: c.estado, clases: c.biblioteca.clases ?? [], vendedor: c.vendedor ?? null,
  })), [comprados]);

  /* Los planes comprados que NO están al día (p10): vencidos y en gracia, para decirlo en vez de que desaparezcan. */
  const comprasPorAtender = useMemo(() => comprados.filter((c) => !c.biblioteca && (c.estado === 'vencida' || c.estado === 'gracia')).map((c) => ({
    id: c.compra_id, titulo: c.titulo, estado: c.estado, vendedor: c.vendedor ?? null, slug: c.slug ?? null,
  })), [comprados]);

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
      planMeta: activo ? { id: activo.id, title: activo.title, foto: activo.foto ?? '' } : null,
      // La ciencia del plan (los recuadros de todo el plan; los de cada fase van dentro de la fase).
      ciencia: activo?.ciencia ?? [],
      planLoading,
      exercises: activo?.exercises ?? aplicarOverrides(exercisesBase, []),
      medias: activo?.medias ?? [],
      resolveExercise: activo?.resolveExercise ?? (() => null),
      // Varios programas
      programas,
      bibliotecas,
      comprasPorAtender,
      comprasFallo,
      reintentaCompras,
      demoActiva: demo,
      abreDemo: setDemo,
      cierraDemo: () => setDemo(null),
      programaActivo: activo,
      elegirPrograma,
      claveDe,
    }),
    [activo, programas, bibliotecas, comprasPorAtender, comprasFallo, reintentaCompras, demo, planLoading, exercisesBase, elegirPrograma, claveDe],
  );

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error('usePlan debe usarse dentro de <PlanProvider>');
  return ctx;
}

/** El plan si hay un `<PlanProvider>` arriba, o `null` (para piezas que también se usan fuera de la app de entrenamiento, como los stickers en Métricas). */
export const usePlanOpcional = () => useContext(PlanContext);

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
    planMeta: { id: programa.id, title: programa.title, foto: programa.foto ?? '' },
    ciencia: programa.ciencia ?? [],
    exercises: programa.exercises,
    medias: programa.medias,
    resolveExercise: programa.resolveExercise,
    programaActivo: programa,
    claveDe: (base0) => (programa.clave ? `${base0}@${programa.clave}` : base0),
  }), [base, programa]);
  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}
