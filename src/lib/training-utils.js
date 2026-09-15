// Helpers de logica del plan (operan sobre los datos, no los modifican).
// El plan llega como parametro (array de fases desde la tabla `plans`).
import { Sunrise, Sun, Moon } from 'lucide-react';

const sessionId = (phaseId, weekNum, dayIdx) => `${phaseId}-w${weekNum}-d${dayIdx}`;
const calc1RM = (weight, reps) => {
  if (!weight || !reps || reps < 1) return null;
  const w = parseFloat(weight); const r = parseInt(reps);
  if (isNaN(w) || isNaN(r)) return null;
  if (r === 1) return { brzycki: w, epley: w, avg: w };
  const brzycki = w * (36 / (37 - r));
  const epley = w * (1 + r / 30);
  return { brzycki: Math.round(brzycki * 10) / 10, epley: Math.round(epley * 10) / 10, avg: Math.round((brzycki + epley) / 2 * 10) / 10 };
};
const today = () => new Date().toISOString().split('T')[0];
const greeting = () => {
  const h = new Date().getHours();
  if (h < 12) return { text: 'Buenos días', icon: Sunrise };
  if (h < 19) return { text: 'Buenas tardes', icon: Sun };
  return { text: 'Buenas noches', icon: Moon };
};
/**
 * ¿Este ejercicio lleva peso, o sea: hay que mostrarle al atleta el campo para
 * anotar con cuánto lo hizo?
 *
 * Manda el coach. Si marcó `carga` al armar la sesión, esa decisión gana y no
 * se discute. Solo cuando NO la marcó se recurre a adivinar por el nombre.
 *
 * Por qué el orden es ese: adivinar por el nombre choca de frente con que la
 * app sirva para cualquier actividad física. Un drill nuevo con un nombre que
 * la lista no contempla se quedaba sin campo de peso —o lo mostraba cuando no
 * tocaba— y el coach no tenía forma de corregirlo. Ahora la lista de palabras
 * es solo una sugerencia inicial.
 */
const isLoadedExercise = (ex) => {
  if (!ex || ex.isNote) return false;
  if (ex.carga === true || ex.carga === 'si') return true;
  if (ex.carga === false || ex.carga === 'no') return false;
  return adivinaSiLlevaCarga(ex);
};

/** La vieja lista de palabras. Ya no decide: solo propone un valor por defecto. */
const adivinaSiLlevaCarga = (ex) => {
  if (!ex || ex.isNote) return false;
  const name = (ex.name || '').toLowerCase();
  const intensity = (ex.intensity || '').toLowerCase();
  if (name.includes('sprint')) return false;
  if (name.includes('salto') || name.includes('jump') || name.includes('throw')) return false;
  if (name.includes('plio')) return false;
  if (name.includes('movilidad') || name.includes('mobility')) return false;
  if (name.includes('catch') || name.includes('routes') || name.includes('rutas')) return false;
  if (name.includes('pallof') || name.includes('plancha') || name.includes('hanging') || name.includes('balance')) return false;
  if (name.includes('tobillo')) return false;
  if (name.includes('caminata') || name.includes('walk')) return false;
  if (name.includes('core') || name.includes('mcgill')) return false;
  if (intensity === 'bw' || intensity.includes('bajo') || intensity === 'máximo' || intensity === 'maximo') return false;
  if (!ex.intensity) return false;
  return true;
};
// Validar que un cursor apunte a una sesión existente
const isValidCursor = (plan, cursor) => {
  if (!plan?.length || !cursor) return false;
  const phase = plan.find(p => p.id === cursor.phaseId);
  if (!phase) return false;
  const week = phase.weekData.find(w => w.num === cursor.weekNum);
  if (!week) return false;
  return !!week.days[cursor.dayIdx];
};

// Resolver cursor a la sesión completa
const resolveCursor = (plan, cursor) => {
  if (!isValidCursor(plan, cursor)) return null;
  const phase = plan.find(p => p.id === cursor.phaseId);
  const week = phase.weekData.find(w => w.num === cursor.weekNum);
  const day = week.days[cursor.dayIdx];
  return { phase, week, dayIdx: cursor.dayIdx, day, id: sessionId(phase.id, week.num, cursor.dayIdx) };
};

// Avanzar cursor: siguiente día no completado a partir de la posición actual (siguiente día del cursor)
const advanceCursor = (plan, cursor, sessionsData) => {
  if (!isValidCursor(plan, cursor)) return null;
  let passed = false;
  for (const phase of plan) {
    for (const week of phase.weekData) {
      for (let di = 0; di < week.days.length; di++) {
        if (passed) {
          const id = sessionId(phase.id, week.num, di);
          if (!sessionsData[id]?.completed) {
            return { phaseId: phase.id, weekNum: week.num, dayIdx: di };
          }
        }
        if (phase.id === cursor.phaseId && week.num === cursor.weekNum && di === cursor.dayIdx) {
          passed = true;
        }
      }
    }
  }
  return null; // plan terminado
};

/* ------------------------- Calendario (día real) -------------------------
   La app muestra lo que toca HOY según la fecha del dispositivo del atleta,
   no según lo que haya marcado como completado. Así nadie queda desubicado
   por faltar un día.
------------------------------------------------------------------------- */

const WEEKDAY_KEYS = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const WEEKDAY_LABELS = {
  Lun: 'lunes', Mar: 'martes', Mié: 'miércoles', Jue: 'jueves',
  Vie: 'viernes', Sáb: 'sábado', Dom: 'domingo',
};

// 'Lun' … 'Dom' según la fecha local del dispositivo
const weekdayToday = (date = new Date()) => WEEKDAY_KEYS[date.getDay()];

// Nombre largo en minúsculas ('miércoles') para textos tipo "Siguiente: …"
const weekdayLabel = (key) => WEEKDAY_LABELS[key] ?? key;

// Semana ISO del calendario: '2026-W31'. Da identidad temporal a las rutinas
// que se repiten (marcar el lunes de esta semana no marca el de la próxima).
const isoWeekKey = (date = new Date()) => {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7)); // jueves de esa semana
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
};

/**
 * El puntero, ya puesto al día con el calendario.
 *
 * EL PROBLEMA QUE RESUELVE. El puntero (`wr:cursor`) guarda en qué fase, qué
 * semana y qué día va el atleta. Se escribía una vez y no lo movía NADIE:
 * `advanceCursor` existía pero no se llamaba desde ningún sitio. Andrés llevaba
 * semanas viendo "Semana 6 de 8" y creía que era por no marcar las sesiones
 * como hechas. No era eso: marcar tampoco lo movía. Nada lo movía.
 *
 * CÓMO FUNCIONA AHORA. Junto al puntero se guarda la semana del calendario en
 * que se fijó (`fijadoEn`, tipo '2026-W37'). Cada semana real que pasa, el plan
 * avanza una semana. Sin marcar nada y sin fecha de inicio del plan, que no
 * existe.
 *
 * SE PUEDE REGRESAR. Decisión de Andrés: "avanza con el calendario pero si
 * quieres regrésalo, puedes". Cuando el atleta elige otra semana a mano, se
 * vuelve a sellar `fijadoEn` con la semana de hoy: se queda donde la puso, y a
 * partir de ahí vuelve a avanzar sola.
 *
 * Si el puntero guardado es viejo y no trae `fijadoEn`, se le pone la semana de
 * hoy en vez de avanzar de golpe: nadie debe abrir la app y encontrarse diez
 * semanas más adelante por un dato que faltaba.
 */
const cursorAlDia = (plan, cursor, hoy = new Date()) => {
  if (!isValidCursor(plan, cursor)) return cursor;
  const semanaHoy = isoWeekKey(hoy);
  if (!cursor.fijadoEn) return { ...cursor, fijadoEn: semanaHoy };
  if (cursor.fijadoEn === semanaHoy) return cursor;

  const pasadas = semanasEntre(cursor.fijadoEn, semanaHoy);
  if (pasadas <= 0) return cursor; // el reloj fue hacia atrás: no se toca

  // Se avanza semana a semana por el plan, saltando de fase cuando toca.
  let fase = plan.findIndex((f) => f.id === cursor.phaseId);
  let semana = plan[fase].weekData.findIndex((w) => w.num === cursor.weekNum);
  for (let i = 0; i < pasadas; i += 1) {
    semana += 1;
    if (semana >= plan[fase].weekData.length) {
      if (fase + 1 >= plan.length) {   // se acabó el plan: se queda al final
        fase = plan.length - 1;
        semana = plan[fase].weekData.length - 1;
        break;
      }
      fase += 1;
      semana = 0;
    }
  }

  const destino = plan[fase].weekData[semana];
  const dia = Math.min(cursor.dayIdx, Math.max(0, (destino.days?.length ?? 1) - 1));
  return { phaseId: plan[fase].id, weekNum: destino.num, dayIdx: dia, fijadoEn: semanaHoy };
};

/** Cuántas semanas de calendario van de una clave ISO a otra. */
const semanasEntre = (desde, hasta) => {
  const aLunes = (clave) => {
    const [anio, sem] = String(clave).split('-W').map(Number);
    if (!anio || !sem) return null;
    // El 4 de enero siempre cae en la semana ISO 1.
    const cuatroEne = new Date(Date.UTC(anio, 0, 4));
    const lunesUno = new Date(cuatroEne);
    lunesUno.setUTCDate(cuatroEne.getUTCDate() - ((cuatroEne.getUTCDay() || 7) - 1));
    lunesUno.setUTCDate(lunesUno.getUTCDate() + (sem - 1) * 7);
    return lunesUno;
  };
  const a = aLunes(desde);
  const b = aLunes(hasta);
  if (!a || !b) return 0;
  return Math.round((b - a) / (7 * 86400000));
};

// Id de sesión para planes 'weekly': incluye la semana del calendario.
const weeklySessionId = (dayIdx, date = new Date()) => `wk-${isoWeekKey(date)}-d${dayIdx}`;

// Id correcto según el tipo de plan (los periodizados conservan el de siempre).
const sessionIdFor = (kind, phaseId, weekNum, dayIdx, date = new Date()) => (
  kind === 'weekly' ? weeklySessionId(dayIdx, date) : sessionId(phaseId, weekNum, dayIdx)
);

// Todos los días de la semana en curso, con su índice real dentro de week.days
const daysOfCurrentWeek = (plan, kind, cursor) => {
  const phases = plan ?? [];
  if (phases.length === 0) return { phase: null, week: null, items: [] };
  let phase = phases[0];
  let week = phase?.weekData?.[0] ?? null;
  if (kind !== 'weekly' && cursor) {
    const p = phases.find((x) => x.id === cursor.phaseId);
    const w = p?.weekData?.find((x) => x.num === cursor.weekNum);
    if (p && w) { phase = p; week = w; }
  }
  const items = (week?.days ?? []).map((day, dayIdx) => ({ day, dayIdx }));
  return { phase, week, items };
};

// La sesión que toca hoy. null = "No tienes rutina asignada para este día".
/* Un día OFF es descanso decidido por el coach, no una sesión.
   Antes contaba como una más: "6 días de entrenamiento" con el domingo de
   descanso dentro, "0/6 días" en la cabecera, y en la portada "Hoy te toca:
   Descanso · Empezar sesión". */
const esDescanso = (day) => (day?.cat || '') === 'off';

/* Los días de una semana en orden de calendario, CONSERVANDO su posición.
   Una sesión nueva se guarda al final de la lista. Si un coach le añade la de
   la tarde al lunes, en los datos queda después del domingo, y las pestañas
   del atleta salían "Lun, Mar, Mié, Jue, Vie, Dom, Lun".

   Se ordena solo al ENSEÑAR, nunca en los datos: el progreso del atleta
   (sesiones terminadas, pesos) se guarda por la posición de cada sesión.
   Reordenar la lista movería ese progreso a otro día sin avisar. Por eso cada
   elemento lleva su `idx` original. */
const ORDEN_DIAS = { Lun: 0, Mar: 1, 'Mié': 2, Mie: 2, Jue: 3, Vie: 4, 'Sáb': 5, Sab: 5, Dom: 6 };
const enOrdenDeSemana = (days = []) => days
  .map((day, idx) => ({ day, idx }))
  .sort((a, b) => (ORDEN_DIAS[a.day?.day] ?? 9) - (ORDEN_DIAS[b.day?.day] ?? 9) || a.idx - b.idx);

const sessionForToday = (plan, kind, cursor, date = new Date()) => {
  const wd = weekdayToday(date);
  const { phase, week, items } = daysOfCurrentWeek(plan, kind, cursor);
  if (!phase || !week) return null;
  /* TODAS las de hoy, no la primera. Un día puede tener dos sesiones —mañana y
     tarde—, y con `find` la segunda no existía para la portada: el atleta veía
     solo la de la mañana y nada le avisaba de que quedaba otra. */
  const deHoy = items.filter(({ day }) => day.day === wd && !esDescanso(day));
  const hit = deHoy[0];
  if (!hit) return null;
  return {
    phase,
    week,
    dayIdx: hit.dayIdx,
    day: hit.day,
    id: sessionIdFor(kind, phase.id, week.num, hit.dayIdx, date),
    sesionesHoy: deHoy.length,
  };
};

// Resumen de la semana para la tarjeta "Tu semana": qué días entrenan, cuál es
// hoy y cuál es el siguiente. No depende de sesiones completadas.
const weekOverview = (plan, kind, cursor, date = new Date()) => {
  const todayKey = weekdayToday(date);
  const { items } = daysOfCurrentWeek(plan, kind, cursor);
  // Todas las sesiones de cada día, no solo la primera: ver sessionForToday.
  const byWeekday = new Map();
  items.forEach(({ day, dayIdx }) => {
    if (!byWeekday.has(day.day)) byWeekday.set(day.day, []);
    byWeekday.get(day.day).push({ day, dayIdx });
  });
  const order = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
  const days = order.map((key) => {
    const todas = byWeekday.get(key) || [];
    const reales = todas.filter(({ day }) => !esDescanso(day));
    return {
      key,
      isToday: key === todayKey,
      hasSession: reales.length > 0,
      // El coach puso descanso a propósito: no es lo mismo que un día sin nada.
      descanso: todas.length > 0 && reales.length === 0,
      sesiones: reales.length,
      name: reales.map(({ day }) => day.name).filter(Boolean).join(' + ') || null,
      dayIdx: reales[0]?.dayIdx ?? null,
    };
  });
  const todayPos = order.indexOf(todayKey);
  const next = days
    .map((d, i) => ({ ...d, pos: i }))
    .filter((d) => d.hasSession && d.pos > todayPos)[0]
    ?? days.map((d, i) => ({ ...d, pos: i })).filter((d) => d.hasSession)[0]
    ?? null;
  return { days, next, trainingDays: days.filter((d) => d.hasSession).length };
};

// Cursor por defecto: primer día del plan
const defaultCursor = (plan) => {
  const phase = plan?.[0];
  const week = phase?.weekData?.[0];
  if (!phase || !week) return null;
  return { phaseId: phase.id, weekNum: week.num, dayIdx: 0 };
};
/* ---- sesiones que en el plan son solo "Repite la sesión del lunes" ----

   En el plan de Andrés hay 7 sesiones de tarde —los jueves de las 7 semanas de
   Potencia— que no traen ejercicios: solo el texto "Repite la sesión de French
   Contrast del lunes con las mismas cargas de esta semana". El atleta tenía que
   ir al lunes a ver qué hacer, y el jueves no podía anotar sus pesos porque no
   había ejercicios donde anotarlos.

   Se resuelven al LEER, sin tocar el plan: se busca en la MISMA semana una
   sesión con ejercicios que se llame igual. Por el nombre de la sesión, no
   interpretando la frase. Comprobado por SQL en las 7: cada semana tiene
   exactamente una candidata, la del lunes.

   Si hubiera varias con ese nombre, se usa la del día que menciona el texto; y
   si aun así no queda una sola, no se adivina: se enseña el texto como estaba. */
const nombreDeSesion = (tag = '') => tag
  .replace(/^Sesi[óo]n \d+ \([AP]M\):\s*/, '')
  .replace(/\s*·\s*~.*$/, '')
  .trim();
const DIA_EN_TEXTO = [
  ['lunes', 'Lun'], ['martes', 'Mar'], ['miércoles', 'Mié'], ['miercoles', 'Mié'],
  ['jueves', 'Jue'], ['viernes', 'Vie'], ['sábado', 'Sáb'], ['sabado', 'Sáb'], ['domingo', 'Dom'],
];

const bloqueQueRepite = (week, dayIdx, blk) => {
  if (!blk || blk.type !== 'note' || !week?.days) return null;
  const nombre = nombreDeSesion(blk.tag);
  if (!nombre) return null;
  const candidatas = [];
  week.days.forEach((d, i) => {
    if (i === dayIdx) return;
    (d.blocks || []).forEach((b) => {
      if (b.type === 'lift' && (b.exercises || []).length && nombreDeSesion(b.tag) === nombre) {
        candidatas.push({ day: d, blk: b });
      }
    });
  });
  if (candidatas.length === 0) return null;
  const texto = (blk.text || '').toLowerCase();
  const mencionado = DIA_EN_TEXTO.find(([palabra]) => texto.includes(palabra))?.[1];
  return candidatas.find((c) => c.day.day === mencionado) || (candidatas.length === 1 ? candidatas[0] : null);
};

/* Los ejercicios que el atleta ve —y anota— en un bloque: los suyos, o los de
   la sesión que repite. Los pesos se guardan con la llave de ESTE día y ESTE
   bloque, así que el jueves y el lunes tienen cada uno los suyos. */
const ejerciciosDelBloque = (week, dayIdx, blk) => {
  if (blk?.type === 'lift') return blk.exercises || [];
  return bloqueQueRepite(week, dayIdx, blk)?.blk.exercises || [];
};

const findPreviousWeight = (plan, sessionsData, exName) => {
  const target = (exName || '').toLowerCase().trim();
  let latest = null;
  for (const phase of (plan ?? [])) for (const week of phase.weekData) for (let di = 0; di < week.days.length; di++) {
    const id = sessionId(phase.id, week.num, di);
    const sd = sessionsData[id]; if (!sd?.exercises) continue;
    const day = week.days[di]; const allEx = [];
    if (day.exercises) day.exercises.forEach((e, i) => allEx.push({ ex: e, key: `${i}` }));
    if (day.blocks) day.blocks.forEach((blk, bi) => {
      ejerciciosDelBloque(week, di, blk).forEach((e, i) => allEx.push({ ex: e, key: `${bi}-${i}` }));
    });
    for (const { ex, key } of allEx) {
      if (!ex.name || ex.isNote) continue;
      if (ex.name.toLowerCase().trim() !== target) continue;
      const data = sd.exercises[key];
      if (data?.weight) latest = { weight: data.weight };
    }
  }
  return latest;
};
/**
 * Todo lo que el atleta ha levantado en un ejercicio, en orden.
 *
 * `findPreviousWeight` (arriba) devuelve solo el último dato, que sirve para no
 * olvidar cuánto pusiste la vez pasada. Esto es lo otro que pidió Andrés:
 * "saber su progreso", que es una historia, no un dato suelto.
 *
 * Devuelve [{ kilos, cuando, donde }] de lo más viejo a lo más nuevo. `cuando`
 * puede venir vacío: las sesiones sin terminar no tienen fecha de cierre, y aun
 * así el peso anotado cuenta.
 */
const historialDePeso = (plan, sessionsData, exName) => {
  const objetivo = (exName || '').toLowerCase().trim();
  if (!objetivo) return [];
  const salida = [];
  for (const phase of (plan ?? [])) {
    for (const week of (phase.weekData ?? [])) {
      for (let di = 0; di < (week.days?.length ?? 0); di++) {
        const sd = sessionsData[sessionId(phase.id, week.num, di)];
        if (!sd?.exercises) continue;
        const day = week.days[di];
        const todos = [];
        if (day.exercises) day.exercises.forEach((e, i) => todos.push({ ex: e, key: `${i}` }));
        // Incluye las sesiones "repite la del lunes": lo anotado ahí también es progreso.
        if (day.blocks) day.blocks.forEach((blk, bi) => {
          ejerciciosDelBloque(week, di, blk).forEach((e, i) => todos.push({ ex: e, key: `${bi}-${i}` }));
        });
        for (const { ex, key } of todos) {
          if (!ex.name || ex.isNote) continue;
          if (ex.name.toLowerCase().trim() !== objetivo) continue;
          const dato = sd.exercises[key];
          const kilos = parseFloat(dato?.weight);
          if (!dato?.weight || Number.isNaN(kilos)) continue;
          salida.push({
            kilos,
            cuando: sd.completedAt || null,
            donde: `${phase.name || phase.id} · sem ${week.num}`,
          });
        }
      }
    }
  }
  return salida;
};

const totalProgress = (plan, sessionsData) => {
  let total = 0, completed = 0;
  (plan ?? []).forEach(p => p.weekData.forEach(w => w.days.forEach((_, i) => {
    total++;
    if (sessionsData[sessionId(p.id, w.num, i)]?.completed) completed++;
  })));
  return { total, completed, pct: total > 0 ? (completed / total) * 100 : 0 };
};

// Carga relativa estimada por semana (para visualizar arco de fase)
const getWeekLoad = (week, phaseId) => {
  if (!week.load) return 30;
  // sets x reps al X%
  let m = week.load.match(/(\d+)x(\d+)[^%]*(\d+)%/);
  if (m) return Math.min(100, parseInt(m[1]) * parseInt(m[2]) * parseInt(m[3]) / 100);
  // Solo porcentaje
  m = week.load.match(/(\d+)%/);
  if (m) return parseInt(m[1]);
  // Defaults por fase
  const def = { f1: 20, f2: 50, f3: 70, f4: 85, f5: 95, deload: 40, f6: 70, f7: 80, f8: 85 };
  return def[phaseId] || 50;
};

// Expandir abreviaturas para que sean legibles
const formatIntensity = (intensity) => {
  if (!intensity) return null;
  let i = String(intensity);
  i = i.replace(/\bBW\s*\+\s*DB\b/gi, 'Peso corporal + mancuernas');
  i = i.replace(/\bBW\s*\+\s*barra\b/gi, 'Peso corporal + barra');
  i = i.replace(/\bBW\b/gi, 'Peso corporal');
  i = i.replace(/\bDB\b/gi, 'mancuernas');
  return i;
};

// Inferir descanso recomendado por ejercicio/fase
const inferRest = (ex, phaseId) => {
  if (!ex || ex.isNote) return null;
  const name = (ex.name || '').toLowerCase();
  const intensity = (ex.intensity || '').toLowerCase();
  // Trabajo neural máximo (sprints, saltos, plios, throws, cluster)
  if (name.match(/sprint|salto|jump|plio|throw|hang clean|push press|broad jump|box jump|med ball/)) {
    return 'Completa · 2-3 min';
  }
  // Cluster del French Contrast (F5)
  if (name.includes('cluster') || intensity.includes('cluster')) {
    return '3-4 min entre clusters';
  }
  // Fuerza máxima (F4, F5 con compuestos pesados ≥80%)
  const pctMatch = intensity.match(/(\d+)\s*%/);
  const pct = pctMatch ? parseInt(pctMatch[1]) : null;
  if ((phaseId === 'f4' || phaseId === 'f5') && (ex.role === 'main' || (pct && pct >= 80))) {
    return '3-5 min';
  }
  // Compuestos en hipertrofia con RIR bajo
  if (phaseId === 'f3' && ex.role === 'main') {
    return '2-3 min';
  }
  // Hipertrofia accesorios
  if (phaseId === 'f3') return '60-90 s';
  // Adaptación (F2)
  if (phaseId === 'f2') {
    if (ex.role === 'main') return '90-120 s';
    return '60-90 s';
  }
  // Trabajo de tobillo, core, movilidad
  if (name.match(/tobillo|pallof|plancha|hanging|core|mcgill|movilidad/)) {
    return '45-60 s';
  }
  // Default
  if (ex.role === 'main') return '2 min';
  return '60-90 s';
};

// Mapear ejercicio a patrón de movimiento
const getPattern = (name) => {
  const n = (name || '').toLowerCase();
  if (n.match(/sprint|aceleraci|tempo run/)) return 'sprint';
  if (n.match(/box jump|broad jump|jump squat|salto vertical|salto horizontal/)) return 'jump';
  if (n.match(/clean|hang clean|power clean/)) return 'olympic';
  if (n.match(/split squat|bulgarian|pistol|step up|lunge/)) return 'squat_uni';
  if (n.match(/back squat|front squat|goblet squat|speed squat/)) return 'squat';
  if (n.match(/trap bar|deadlift|rdl|romanian|hip thrust|nordic curl|ghr/)) return 'hinge';
  if (n.match(/bench press|incline bench|db bench|fondos|push.?up/)) return 'push_h';
  if (n.match(/overhead|shoulder press|push press|military|landmine press/)) return 'push_v';
  if (n.match(/pull.?up|chin.?up|lat pulldown|pulldown/)) return 'pull_v';
  if (n.match(/\brow\b|barbell row|t.?bar|pendlay/)) return 'pull_h';
  if (n.match(/face pull/)) return 'pull_h';
  if (n.match(/curl|extension|raise|fly|press cover/)) return 'isolation';
  if (n.match(/plank|plancha|pallof|hanging|core|mcgill|leg raise|knee raise/)) return 'core';
  if (n.match(/throw|med ball/)) return 'rotation';
  if (n.match(/calf|gemelo|pantorrilla/)) return 'calf';
  if (n.match(/movilidad|stretch|foam|caminata|walk|cool/)) return 'mobility';
  if (n.match(/cuts|pro agility|l-drill|cod/)) return 'cod';
  if (n.match(/balance|propio/)) return 'balance';
  return 'generic';
};

// Mapear ejercicio a músculos primary/secondary
// Si se pasa `focus`, ese músculo pasa a ser primary y los demás del original se mueven a secondary
const getMuscles = (name, focus) => {
  const n = (name || '').toLowerCase();
  let result;
  // Squats bilaterales
  if (n.match(/back squat|speed squat/)) result = { primary: ['cuadriceps', 'gluteos'], secondary: ['core', 'isquios'] };
  else if (n.match(/front squat|goblet/)) result = { primary: ['cuadriceps', 'core'], secondary: ['gluteos'] };
  // Squats unilaterales
  else if (n.match(/bulgarian|pistol|split squat/)) result = { primary: ['cuadriceps', 'gluteos'], secondary: ['isquios', 'core'] };
  else if (n.match(/lunge/)) result = { primary: ['cuadriceps', 'gluteos'], secondary: ['isquios'] };
  else if (n.match(/step up/)) result = { primary: ['cuadriceps', 'gluteos'], secondary: ['pantorrillas'] };
  // Hinge
  else if (n.match(/trap bar/)) result = { primary: ['cuadriceps', 'gluteos', 'isquios'], secondary: ['espalda_baja', 'trapecio'] };
  else if (n.match(/hip thrust/)) result = { primary: ['gluteos'], secondary: ['isquios'] };
  else if (n.match(/nordic|ghr/)) result = { primary: ['isquios'], secondary: ['gluteos'] };
  else if (n.match(/rdl|romanian|deadlift/)) result = { primary: ['isquios', 'gluteos'], secondary: ['espalda_baja', 'trapecio'] };
  // Push horizontal
  else if (n.match(/incline bench|incline db/)) result = { primary: ['pecho', 'hombros_f'], secondary: ['triceps'] };
  else if (n.match(/bench press|db bench|fondos|chest/)) result = { primary: ['pecho', 'triceps'], secondary: ['hombros_f'] };
  else if (n.match(/push.?up/)) result = { primary: ['pecho', 'triceps'], secondary: ['core'] };
  // Push vertical
  else if (n.match(/overhead|shoulder press|push press|military|landmine press/)) result = { primary: ['hombros_f', 'triceps'], secondary: ['core'] };
  // Pull vertical
  else if (n.match(/pull.?up|chin.?up/)) result = { primary: ['dorsal', 'biceps'], secondary: ['trapecio'] };
  else if (n.match(/lat pulldown|pulldown/)) result = { primary: ['dorsal', 'biceps'], secondary: ['trapecio'] };
  // Pull horizontal
  else if (n.match(/face pull/)) result = { primary: ['hombros_b', 'trapecio'], secondary: [] };
  else if (n.match(/\brow\b|barbell row|t.?bar|pendlay|cable row/)) result = { primary: ['dorsal', 'biceps'], secondary: ['hombros_b', 'trapecio'] };
  // Olympic
  else if (n.match(/clean|jerk|snatch/)) result = { primary: ['cuadriceps', 'gluteos', 'trapecio'], secondary: ['hombros_f', 'core'] };
  // Isolation
  else if (n.match(/hamstring curl/)) result = { primary: ['isquios'], secondary: [] };
  else if (n.match(/leg extension/)) result = { primary: ['cuadriceps'], secondary: [] };
  else if (n.match(/hammer curl|bicep curl|biceps/)) result = { primary: ['biceps'], secondary: [] };
  else if (n.match(/triceps|tríceps|overhead tricep/)) result = { primary: ['triceps'], secondary: [] };
  else if (n.match(/lateral raise/)) result = { primary: ['hombros_f'], secondary: [] };
  else if (n.match(/rear delt/)) result = { primary: ['hombros_b'], secondary: [] };
  else if (n.match(/pec fly|cable fly/)) result = { primary: ['pecho'], secondary: ['hombros_f'] };
  else if (n.match(/shrug/)) result = { primary: ['trapecio'], secondary: [] };
  // Core
  else if (n.match(/pallof|plank|plancha|hanging|leg raise|knee raise|mcgill/)) result = { primary: ['core'], secondary: [] };
  // Calf
  else if (n.match(/calf|gemelo|pantorrilla/)) result = { primary: ['pantorrillas'], secondary: [] };
  // Sprint
  else if (n.match(/sprint|aceleraci|tempo run/)) result = { primary: ['cuadriceps', 'isquios', 'gluteos', 'pantorrillas'], secondary: ['core'] };
  // Jumps
  else if (n.match(/jump|salto/)) result = { primary: ['cuadriceps', 'gluteos', 'pantorrillas'], secondary: ['isquios', 'core'] };
  // Throws
  else if (n.match(/throw|med ball/)) result = { primary: ['core', 'hombros_f'], secondary: ['pecho'] };
  // COD
  else if (n.match(/cuts|pro agility|l-drill|cod/)) result = { primary: ['cuadriceps', 'gluteos', 'pantorrillas'], secondary: ['core'] };
  // Tobillo
  else if (n.match(/tobillo|peroneal|tibial/)) result = { primary: ['pantorrillas'], secondary: [] };
  else result = { primary: [], secondary: [] };

  // Override con focus específico
  if (focus && (result.primary.includes(focus) || result.secondary.includes(focus))) {
    const all = [...result.primary, ...result.secondary];
    result = { primary: [focus], secondary: all.filter(m => m !== focus) };
  }
  return result;
};


export {
  sessionId, calc1RM, today, greeting, isLoadedExercise, isValidCursor,
  resolveCursor, advanceCursor, defaultCursor, cursorAlDia, semanasEntre, findPreviousWeight, historialDePeso,
  adivinaSiLlevaCarga,
  totalProgress, getWeekLoad, formatIntensity, inferRest, getPattern, getMuscles,
  weekdayToday, weekdayLabel, isoWeekKey, weeklySessionId, sessionIdFor,
  sessionForToday, weekOverview, esDescanso, enOrdenDeSemana,
  bloqueQueRepite, ejerciciosDelBloque, nombreDeSesion,
};
