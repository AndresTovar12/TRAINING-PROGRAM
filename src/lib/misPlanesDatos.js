/* MIS PLANES, lo puro: qué se guarda, cómo se arma lo que se le da a un atleta y cómo se
   ordenan las carpetas. Sin leer la base ni el reloj: la pantalla y las pruebas
   (`scripts/prueba-mis-planes.mjs`) usan las mismas funciones.

   Andrés, 2 oct 2026 («OPTIMIZACIONES DE CREACION DE PLANES»): cada profesional tiene un
   catálogo con tres tipos de cosas, y todas se pueden dar a un atleta:

     workout   — un día de entrenamiento (una o más sesiones el mismo día)
                 → `routine_templates`, kind 'day'
     rutina    — una semana de siete días que se repite
                 → `routine_templates`, kind 'week'
     programa  — un plan por fases o de varias semanas
                 → `programas_guardados`

   Las dos primeras ya existían como «plantilla de día» y «de semana», y así las ve el
   conector de IA, que no conoce 'programa': por eso los programas viven en otra tabla y
   no se mezclan con ellas.

   Lo que se guarda es una COPIA. Al darlo a un atleta también: cambiar el catálogo después
   no mueve lo que el atleta ya recibió, ni al revés. */

export const TIPOS = ['workout', 'rutina', 'programa'];
export const ETIQUETA_DE_TIPO = { workout: 'Workout', rutina: 'Rutina semanal', programa: 'Programa' };
export const PLURAL_DE_TIPO = { workout: 'Workouts', rutina: 'Rutinas semanales', programa: 'Programas' };
// Carpetas dentro de carpetas, hasta aquí: más abajo ya nadie encuentra nada.
export const NIVELES_DE_CARPETA = 5;

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom'];
const COLOR_DE_FASE = '#1E40E0';

const clone = (o) => structuredClone(o);
const rid = () => (globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2)).slice(0, 8);
const esDescanso = (d) => (d?.cat || '') === 'off';
const reales = (lista) => (Array.isArray(lista) ? lista : []).filter((e) => e && !e.isNote);
const plural = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;

/* ---------------------------- Workouts ---------------------------- */

/** Las sesiones de un workout guardado: la primera va en la raíz y las demás en `otras`. */
export function sesionesDeWorkout(data) {
  const { otras = [], ...primera } = data ?? {};
  return [primera, ...(Array.isArray(otras) ? otras : [])];
}

const ejerciciosDeSesion = (s) => reales(s?.exercises).length;

const sinDia = (d) => { const c = clone(d); delete c.day; return c; };

/**
 * De las sesiones de UN día de la semana (una entrada del plan, o dos: mañana y tarde) a lo
 * que se guarda como workout. La primera va en la raíz con la forma de siempre —nombre, tipo,
 * ejercicios—, así quien solo conoce esa forma (el conector de IA) la sigue leyendo; las
 * demás van en `otras`.
 */
export function workoutDeSesiones(sesiones) {
  const [primera, ...otras] = (sesiones ?? []).filter(Boolean).map(sinDia);
  if (!primera) return null;
  return otras.length ? { ...primera, otras } : primera;
}

/** De un workout guardado a las entradas que se ponen en un día de la semana (`dia`: 'Lun'…). */
export function diasDeWorkout(data, dia, nombreDelItem = '') {
  return sesionesDeWorkout(data).map((s) => {
    const d = { ...clone(s), day: dia, name: s.name || nombreDelItem || 'Sesión', cat: s.cat || 'gym' };
    if (!Array.isArray(d.exercises)) d.exercises = [];
    return d;
  });
}

/* ----------------------------- Rutinas ---------------------------- */

/* La foto y la ciencia son del PLAN (ver `datosDelPlan` en api.js): viajan con él a Mis planes y de vuelta. */
const delPlan = ({ foto, ciencia } = {}) => ({
  ...(foto ? { foto } : {}),
  ...(Array.isArray(ciencia) && ciencia.length ? { ciencia: clone(ciencia) } : {}),
});

/** Lo que se guarda de una rutina semanal: los días de su única semana (y la foto y la ciencia del plan). */
export function rutinaDePlan(plan) {
  return { days: clone(plan?.phases?.[0]?.weekData?.[0]?.days ?? []), ...delPlan(plan) };
}

/** Lo que se guarda de UNA semana de un programa (el menú de la semana). */
export function rutinaDeSemana(semana) {
  return { days: clone(semana?.days ?? []) };
}

/** Una rutina guardada, vuelta el plan de un atleta: una rutina semanal que se repite. */
export function planDeRutina(data) {
  return {
    kind: 'weekly',
    estructura: 'rutina',
    ...delPlan(data),
    phases: [{
      id: `p-${rid()}`, num: 1, name: 'Rutina semanal', fullName: '', duration: '1 semana', weeks: 1,
      color: COLOR_DE_FASE, focus: '', objective: '',
      weekData: [{ num: 1, label: '', load: '', days: clone(data?.days ?? []) }],
    }],
  };
}

/* ---------------------------- Programas --------------------------- */

/** Las fases con ids nuevos: lo que el atleta anota se guarda por id de fase, y dos entregas
    del mismo programa con los mismos ids le mezclarían lo anotado de una con la otra. */
export const fasesConIdsNuevos = (fases) => clone(fases ?? []).map((f) => ({ ...f, id: `p-${rid()}` }));

/** Lo que se guarda de un programa (`estructura`: 'semanas' | 'fases'). */
export function programaDePlan({ kind, estructura, phases, foto, ciencia }) {
  return { kind: kind || 'periodized', estructura: estructura || 'fases', phases: clone(phases ?? []), ...delPlan({ foto, ciencia }) };
}

/** Un programa guardado, listo para dárselo a un atleta: sus fases llevan ids nuevos. */
export function planDePrograma(data) {
  return {
    kind: data?.kind || 'periodized',
    estructura: data?.estructura || 'fases',
    phases: fasesConIdsNuevos(data?.phases),
    ...delPlan(data),
  };
}

/* ---------------------- ¿Hay algo que guardar? --------------------- */

/**
 * ¿Esta sesión tiene algo que guardar? Ejercicios o notas sueltas. Una sesión vacía no ofrece «Guardar»
 * (Andrés, 2 oct 2026: «Guardar solo sale si hay algo que guardar»): se guardaría un workout sin nada.
 */
export const sesionTieneContenido = (d) => Array.isArray(d?.exercises) && d.exercises.length > 0;
/** ¿Alguna sesión de esta semana tiene algo? */
export const semanaTieneContenido = (semana) => (semana?.days ?? []).some(sesionTieneContenido);
/** ¿Algo del plan tiene contenido? (`phases`: las fases del plan) */
export const planTieneContenido = (phases) => (phases ?? []).some((f) => (f?.weekData ?? []).some(semanaTieneContenido));

/* ------------------------- Notas y resumen ------------------------ */

const sinNotasLaSesion = (d) => {
  const c = clone(d);
  delete c.notes;
  if (Array.isArray(c.exercises)) c.exercises = c.exercises.filter((e) => !e?.isNote);
  return c;
};

/**
 * Lo guardado SIN las notas del coach: las «Notas del día» y las notas sueltas dentro de una
 * sesión. «¿Incluir mis notas?» se pregunta cada vez que se guarda (Andrés, 2 oct 2026). Las
 * indicaciones de cada ejercicio (descripción, cue, descanso) se quedan: son del ejercicio.
 */
export function sinNotas(tipo, data) {
  if (tipo === 'workout') {
    const [primera, ...otras] = sesionesDeWorkout(data).map(sinNotasLaSesion);
    return otras.length ? { ...primera, otras } : primera;
  }
  if (tipo === 'rutina') return { ...clone(data), days: (data?.days ?? []).map(sinNotasLaSesion) };
  return {
    ...clone(data),
    phases: (data?.phases ?? []).map((f) => ({
      ...clone(f),
      weekData: (f.weekData ?? []).map((w) => ({ ...clone(w), days: (w.days ?? []).map(sinNotasLaSesion) })),
    })),
  };
}

/** ¿Hay notas que quitar? Para no preguntar «¿incluir tus notas?» cuando no hay ninguna. */
export function tieneNotas(tipo, data) {
  const dias = tipo === 'workout' ? sesionesDeWorkout(data)
    : tipo === 'rutina' ? (data?.days ?? [])
      : (data?.phases ?? []).flatMap((f) => (f.weekData ?? []).flatMap((w) => w.days ?? []));
  return dias.some((d) => (
    (Array.isArray(d?.notes) && d.notes.length > 0)
    || (Array.isArray(d?.exercises) && d.exercises.some((e) => e?.isNote))
  ));
}

/** Lo que se enseña en la lista sin leer cada cosa entera: se calcula al guardar. */
export function resumenDe(tipo, data) {
  if (tipo === 'workout') {
    const sesiones = sesionesDeWorkout(data);
    return { sesiones: sesiones.length, ejercicios: sesiones.reduce((n, s) => n + ejerciciosDeSesion(s), 0) };
  }
  if (tipo === 'rutina') {
    const dias = (Array.isArray(data?.days) ? data.days : []).filter((d) => !esDescanso(d));
    return { dias: new Set(dias.map((d) => d.day)).size, sesiones: dias.length };
  }
  const fases = Array.isArray(data?.phases) ? data.phases : [];
  // Un microciclo trae UNA semana modelo y `weeks` dice cuántas veces se repite.
  const semanasDe = (f) => (f.mode === 'microcycle' ? (f.weeks || f.weekData?.length || 0) : (f.weekData?.length || 0));
  return {
    forma: data?.estructura === 'semanas' ? 'semanas' : 'fases',
    fases: fases.length,
    semanas: fases.reduce((n, f) => n + semanasDe(f), 0),
    sesiones: fases.reduce((n, f) => n + (f.weekData ?? []).reduce((m, w) => m + (w.days ?? []).filter((d) => !esDescanso(d)).length, 0), 0),
  };
}

/** El resumen en palabras: «3 fases · 12 semanas · 36 sesiones». */
export function textoDeResumen(tipo, resumen) {
  if (!resumen) return '';
  if (tipo === 'workout') {
    return [plural(resumen.sesiones ?? 1, 'sesión', 'sesiones'), plural(resumen.ejercicios ?? 0, 'ejercicio', 'ejercicios')].join(' · ');
  }
  if (tipo === 'rutina') {
    return [plural(resumen.dias ?? 0, 'día', 'días'), plural(resumen.sesiones ?? 0, 'sesión', 'sesiones')].join(' · ');
  }
  return [
    ...(resumen.forma === 'semanas' ? [] : [plural(resumen.fases ?? 0, 'fase', 'fases')]),
    plural(resumen.semanas ?? 0, 'semana', 'semanas'),
    plural(resumen.sesiones ?? 0, 'sesión', 'sesiones'),
  ].join(' · ');
}

/* --------------------------- Carpetas ----------------------------- */

const enMinusculas = (s) => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
export const porNombre = (a, b) => String(a.nombre ?? a.name ?? '').localeCompare(String(b.nombre ?? b.name ?? ''), 'es', { sensitivity: 'base' });

/** Las carpetas que cuelgan de `padreId` (`null` = las de arriba), por nombre. */
export const hijasDe = (carpetas, padreId = null) => (carpetas ?? [])
  .filter((c) => (c.parent_id ?? null) === (padreId ?? null))
  .sort(porNombre);

/** De la carpeta de arriba hasta `id`: [Football, Fuerza, Fase 1]. Aguanta una vuelta rara. */
export function rutaDeCarpeta(carpetas, id) {
  const ruta = [];
  const vistas = new Set();
  let actual = (carpetas ?? []).find((c) => c.id === id);
  while (actual && !vistas.has(actual.id)) {
    ruta.unshift(actual);
    vistas.add(actual.id);
    const padre = actual.parent_id;
    actual = padre ? carpetas.find((c) => c.id === padre) : null;
  }
  return ruta;
}

/** Todas las carpetas que cuelgan de `id`, a cualquier profundidad (sin contarla a ella). */
export function descendientesDe(carpetas, id) {
  const fuera = new Set();
  const pila = [id];
  while (pila.length) {
    const actual = pila.pop();
    (carpetas ?? []).forEach((c) => {
      if (c.parent_id === actual && !fuera.has(c.id)) { fuera.add(c.id); pila.push(c.id); }
    });
  }
  return fuera;
}

/** Cuántos niveles tiene la carpeta contando hacia abajo (una sola = 1). */
export function alturaDeCarpeta(carpetas, id, vistas = new Set()) {
  if (vistas.has(id)) return 0;
  vistas.add(id);
  const hijas = (carpetas ?? []).filter((c) => c.parent_id === id);
  return 1 + hijas.reduce((m, h) => Math.max(m, alturaDeCarpeta(carpetas, h.id, vistas)), 0);
}

/**
 * ¿Se puede poner la carpeta `id` dentro de `destinoId` (`null` = arriba de todo)? No dentro
 * de sí misma ni de lo que cuelga de ella, y sin pasar de `NIVELES_DE_CARPETA`.
 */
export function puedeMoverCarpeta(carpetas, id, destinoId) {
  if (destinoId == null) return true;
  if (id === destinoId) return false;
  if (descendientesDe(carpetas, id).has(destinoId)) return false;
  return rutaDeCarpeta(carpetas, destinoId).length + alturaDeCarpeta(carpetas, id) <= NIVELES_DE_CARPETA;
}

/** ¿Cabe una carpeta NUEVA dentro de `padreId`? */
export const cabeCarpetaEn = (carpetas, padreId) => (
  padreId == null || rutaDeCarpeta(carpetas, padreId).length < NIVELES_DE_CARPETA
);

/** «Football › Fuerza › Fase 1» (o «Sin carpeta»). */
export const textoDeRuta = (carpetas, id) => {
  const ruta = rutaDeCarpeta(carpetas, id);
  return ruta.length ? ruta.map((c) => c.nombre).join(' › ') : 'Sin carpeta';
};

/**
 * Todas las carpetas como un árbol puesto en fila: cada una seguida de lo que cuelga de ella, con su nivel
 * (0 = arriba de todo) para dibujarlas con sangría. Aguanta una vuelta rara en los datos.
 */
export function arbolDeCarpetas(carpetas, desde = null, nivel = 0, vistas = new Set()) {
  return hijasDe(carpetas, desde).flatMap((c) => {
    if (vistas.has(c.id)) return [];
    vistas.add(c.id);
    return [{ carpeta: c, nivel }, ...arbolDeCarpetas(carpetas, c.id, nivel + 1, vistas)];
  });
}

/* ------------------------------ Mover ------------------------------ */

/** La llave con que se marca una cosa o una carpeta para moverla o borrarla: «tabla:id». */
export const claveDeItem = (item) => `${item.tabla}:${item.id}`;
export const claveDeCarpeta = (carpeta) => `carpetas_planes:${carpeta.id}`;

/**
 * Lo que hay que escribir en la base para llevar cosas (`items`) y carpetas a `destinoId` (`null` = arriba de
 * todo), y lo que hay que escribir para DESHACERLO. Lo que ya está en ese lugar no se toca. Cada paso es
 * `{ tabla, id, a }`: la fila `id` de `tabla` pasa a estar en la carpeta `a`.
 */
export function planDeMovimiento({ items = [], carpetas = [] }, destinoId) {
  const a = destinoId ?? null;
  const ir = [];
  const volver = [];
  items.forEach((i) => {
    if ((i.carpetaId ?? null) === a) return;
    ir.push({ tabla: i.tabla, id: i.id, a });
    volver.push({ tabla: i.tabla, id: i.id, a: i.carpetaId ?? null });
  });
  carpetas.forEach((c) => {
    if ((c.parent_id ?? null) === a) return;
    ir.push({ tabla: 'carpetas_planes', id: c.id, a });
    volver.push({ tabla: 'carpetas_planes', id: c.id, a: c.parent_id ?? null });
  });
  return { ir, volver };
}

/** ¿Pueden TODAS estas carpetas ir a `destinoId`? (ninguna dentro de sí misma ni pasando del límite de niveles) */
export const puedenMoverseCarpetas = (todas, aMover, destinoId) => (
  (aMover ?? []).every((c) => puedeMoverCarpeta(todas, c.id, destinoId))
);

/**
 * Las carpetas que se pueden TRAER a `carpetaId`: las que no son ella, ni ya viven en ella, ni cuelgan de ella
 * (no caben dentro de sí mismas) y no pasan del límite de niveles.
 */
export const carpetasQueSePuedenTraer = (todas, carpetaId) => (todas ?? []).filter((c) => (
  c.id !== carpetaId && (c.parent_id ?? null) !== (carpetaId ?? null) && puedeMoverCarpeta(todas, c.id, carpetaId)
));

/**
 * Para borrar varias carpetas a la vez: las de más abajo primero. Así lo que tiene cada una sube a su carpeta
 * de arriba ANTES de que esa también se borre, y nada se queda colgando de una carpeta que ya no existe.
 */
export const carpetasDeAbajoPrimero = (todas, aBorrar) => [...(aBorrar ?? [])]
  .sort((a, b) => rutaDeCarpeta(todas, b.id).length - rutaDeCarpeta(todas, a.id).length);

/* ----------------------------- Buscar ----------------------------- */

/** Sin acentos ni mayúsculas, sobre el nombre, la descripción y de dónde salió. */
export function coincide(item, texto) {
  const q = enMinusculas(texto);
  if (!q) return true;
  return [item.nombre, item.descripcion, item.origen].some((x) => enMinusculas(x).includes(q));
}

/** «Pierna (copia)», «Pierna (copia 2)»… el primer nombre que no esté ya. */
export function nombreDeCopia(nombre, existentes) {
  const usados = new Set((existentes ?? []).map(enMinusculas));
  const base = String(nombre ?? '').replace(/\s*\(copia(?: \d+)?\)\s*$/i, '').trim() || 'Sin nombre';
  let n = 1;
  let candidato = `${base} (copia)`;
  while (usados.has(enMinusculas(candidato))) { n += 1; candidato = `${base} (copia ${n})`; }
  return candidato;
}

/** Los siete días, empezando en lunes, como los guarda el plan. */
export const DIAS_DE_LA_SEMANA = DIAS;
