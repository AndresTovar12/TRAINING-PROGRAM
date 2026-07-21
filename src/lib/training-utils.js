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
const isLoadedExercise = (ex) => {
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

// Cursor por defecto: primer día del plan
const defaultCursor = (plan) => {
  const phase = plan?.[0];
  const week = phase?.weekData?.[0];
  if (!phase || !week) return null;
  return { phaseId: phase.id, weekNum: week.num, dayIdx: 0 };
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
      if (blk.type === 'lift') blk.exercises.forEach((e, i) => allEx.push({ ex: e, key: `${bi}-${i}` }));
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
  resolveCursor, advanceCursor, defaultCursor, findPreviousWeight,
  totalProgress, getWeekLoad, formatIntensity, inferRest, getPattern, getMuscles,
};
