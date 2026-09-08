import { supabase } from '@/lib/supabase';

const AVATAR_BUCKET = 'avatars';

/* ------------------------------- Profile ------------------------------ */
// Sube la foto de perfil al bucket `avatars` (carpeta por usuario, exigido por
// RLS: el primer segmento del path debe ser el uid). Devuelve la URL pública.
export async function uploadAvatar(file, userId) {
  const safeExt = (file.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '');
  const id = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const path = `${userId}/avatar-${id}.${safeExt}`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: true, contentType: file.type || undefined });
  if (error) throw error;
  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

// Actualiza el perfil propio (full_name / username / avatar_url). No toca email
// ni rol. Traduce la violación de unicidad de username a un mensaje claro.
export async function updateProfile(id, patch) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*')
    .single();
  if (error) {
    if (error.code === '23505' || /duplicate|unique/i.test(error.message)) {
      throw new Error('Ese nombre de usuario ya está en uso');
    }
    throw error;
  }
  return data;
}

// ¿Está libre este username? (excluye el propio id). Best-effort para feedback.
export async function isUsernameAvailable(username, excludeId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('id')
    .ilike('username', username)
    .neq('id', excludeId)
    .maybeSingle();
  if (error) return true; // ante duda, deja que el guardado valide
  return !data;
}

/* ----------------------------- Categories ----------------------------- */
export async function listCategories() {
  const { data, error } = await supabase
    .from('exercise_categories')
    .select('*')
    .order('sort_order');
  if (error) throw error;
  return data ?? [];
}

/* ----------------------------- Exercises ------------------------------ */
export async function listExercises() {
  const { data, error } = await supabase
    .from('exercises')
    .select('*, category:exercise_categories(id,slug,name,color)')
    .order('name');
  if (error) throw error;
  return data ?? [];
}

// Id del master (dueño de los ejercicios base). Cacheado en memoria.
let _masterId; // undefined = sin cargar
export async function getMasterId() {
  if (_masterId !== undefined) return _masterId;
  const { data, error } = await supabase.rpc('master_id');
  _masterId = error ? null : (data ?? null);
  return _masterId;
}

// Etiqueta cada ejercicio con su origen relativo al usuario actual.
// { ...ex, isBase: creado por el master, isMine: creado por mí }
export function tagRepertoire(exercises, masterId, myId) {
  return (exercises ?? []).map((e) => ({
    ...e,
    isBase: !!masterId && e.created_by === masterId,
    isMine: !!myId && e.created_by === myId,
  }));
}

export async function createExercise(payload) {
  // El dueño es quien lo crea (aislamiento entre coaches por created_by + RLS).
  const { data: auth } = await supabase.auth.getUser();
  const created_by = payload.created_by ?? auth?.user?.id ?? null;
  const { data, error } = await supabase
    .from('exercises')
    .insert({ ...payload, created_by })
    .select('*, category:exercise_categories(id,slug,name,color)')
    .single();
  if (error) throw error;
  return data;
}

// Duplica un ejercicio (p. ej. uno base) al repertorio propio del coach para
// personalizarlo sin tocar el original.
export async function duplicateExercise(ex) {
  const { data: auth } = await supabase.auth.getUser();
  const created_by = auth?.user?.id ?? null;
  const payload = {
    name: ex.name,
    category_id: ex.category_id ?? ex.category?.id ?? null,
    description: ex.description ?? null,
    cover_image_url: ex.cover_image_url ?? null,
    video_url: ex.video_url ?? null,
    video_link: ex.video_link ?? null,
    muscle_primary: ex.muscle_primary ?? null,
    muscle_secondary: ex.muscle_secondary ?? null,
    equipment: ex.equipment ?? null,
    created_by,
  };
  const { data, error } = await supabase
    .from('exercises')
    .insert(payload)
    .select('*, category:exercise_categories(id,slug,name,color)')
    .single();
  if (error) throw error;
  return data;
}

export async function updateExercise(id, patch) {
  const { data, error } = await supabase
    .from('exercises')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select('*, category:exercise_categories(id,slug,name,color)')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteExercise(id) {
  const { error } = await supabase.from('exercises').delete().eq('id', id);
  if (error) throw error;
}

/* ---------------------- Mi versión de un ejercicio --------------------- *
 * Un coach puede editar a su gusto los ejercicios base (los del master) sin
 * tocar el original y sin afectar a los demás coaches. Su versión se guarda
 * aparte y la app la pone encima al leer.
 *
 * Lo importante: el id del ejercicio NO cambia. Por eso los planes que ya
 * estaban asignados recogen la versión del coach solos, sin reescribir nada.
 *
 * "Restaurar original" es borrar esa fila. El ejercicio del master nunca se
 * modificó, así que siempre está intacto esperando.
 * ----------------------------------------------------------------------- */

// Los campos que un coach puede hacer suyos. Deliberadamente NO incluye `id`,
// `created_by` ni las fechas: eso identifica al ejercicio, no lo describe.
export const CAMPOS_EDITABLES = [
  'name', 'description', 'category_id', 'cover_image_url',
  'video_url', 'video_link', 'recorte_inicio', 'recorte_fin', 'sin_audio', 'encuadre',
  'muscle_primary', 'muscle_secondary', 'equipment',
];

// Las versiones propias del coach indicado. Un atleta pide las de SU coach:
// así ve exactamente lo que su entrenador preparó, no lo que puso el master.
export async function listExerciseOverrides(coachId) {
  if (!coachId) return [];
  const { data, error } = await supabase
    .from('exercise_overrides')
    .select('exercise_id, data')
    .eq('coach_id', coachId);
  if (error) return []; // best-effort: sin esto la app sigue con el original
  return data ?? [];
}

// Guarda mi versión de un ejercicio ajeno. Se manda la ficha COMPLETA, no solo
// lo que cambió: así una mejora posterior del master no se cuela encima de lo
// que el coach ya había dejado listo.
export async function saveExerciseOverride(exerciseId, ficha) {
  const { data: auth } = await supabase.auth.getUser();
  const coachId = auth?.user?.id;
  if (!coachId) throw new Error('Tu sesión expiró. Vuelve a entrar.');

  const limpia = {};
  CAMPOS_EDITABLES.forEach((k) => { if (ficha[k] !== undefined) limpia[k] = ficha[k]; });

  const { data, error } = await supabase
    .from('exercise_overrides')
    .upsert(
      { coach_id: coachId, exercise_id: exerciseId, data: limpia, updated_at: new Date().toISOString() },
      { onConflict: 'coach_id,exercise_id' },
    )
    .select('exercise_id, data')
    .single();
  if (error) throw error;
  return data;
}

// Volver al original: se borra mi versión y reaparece la del master.
export async function deleteExerciseOverride(exerciseId) {
  const { data: auth } = await supabase.auth.getUser();
  const coachId = auth?.user?.id;
  if (!coachId) throw new Error('Tu sesión expiró. Vuelve a entrar.');
  const { error } = await supabase
    .from('exercise_overrides')
    .delete()
    .eq('coach_id', coachId)
    .eq('exercise_id', exerciseId);
  if (error) throw error;
}

/**
 * Pone las versiones del coach encima del repertorio.
 *
 * Marca cada ejercicio tocado con `esMiVersion: true`, que es lo que la
 * pantalla usa para mostrar el aviso y el botón de restaurar.
 *
 * `categorias` es opcional y sirve para un detalle fino: si el coach le cambió
 * la categoría, el objeto `category` que venía pegado del servidor quedó viejo
 * y pintaría el color equivocado. Con la lista a mano se vuelve a resolver.
 */
export function aplicarOverrides(exercises, overrides, categorias) {
  if (!overrides?.length) return exercises ?? [];
  const porId = new Map(overrides.map((o) => [o.exercise_id, o.data ?? {}]));
  const catPorId = new Map((categorias ?? []).map((c) => [c.id, c]));

  return (exercises ?? []).map((e) => {
    const mia = porId.get(e.id);
    if (!mia) return e;
    const fusionado = { ...e, ...mia, esMiVersion: true };
    if (mia.category_id !== undefined && mia.category_id !== e.category_id) {
      fusionado.category = catPorId.get(mia.category_id) ?? null;
    }
    return fusionado;
  });
}

/* ------------------------------- Media -------------------------------- */
/**
 * Tope de subida. Con Cloudflare R2 no hay un limite practico: un solo archivo
 * puede llegar a 5 GB. Se deja un tope alto solo para atajar equivocaciones
 * (arrastrar una carpeta entera, un archivo corrupto de 4 GB).
 *
 * Historia, para que no se repita: antes esto valia 100, luego 50, y ninguno
 * era correcto. El limite real lo imponia el plan gratis de Supabase Storage
 * —50 MB fijos, imposibles de subir sin pagar— y se descubrio de la peor
 * forma: un archivo de 120 MB se transfirio COMPLETO durante 75 segundos y el
 * servidor lo rechazo al final. Por eso se migro a R2.
 */
export const LIMITE_MEDIA_MB = 2048;

const mb = (bytes) => Math.round((bytes / 1048576) * 10) / 10;

/**
 * Sube un archivo al repertorio y devuelve su URL publica.
 *
 * COMO FUNCIONA, en tres pasos:
 *   1. Se le pide permiso al servidor (funcion `r2-upload`). El servidor
 *      verifica que quien pide sea coach o master, y devuelve una direccion
 *      firmada que sirve unos minutos.
 *   2. El navegador manda el archivo DIRECTO a Cloudflare. No pasa por
 *      Supabase, asi que ningun limite suyo aplica.
 *   3. Se devuelve la direccion publica, que es la que se guarda en la base.
 *
 * Se usa XMLHttpRequest y no fetch por una sola razon: fetch no informa el
 * avance de subida, y sin avance un video de 80 MB por datos moviles se ve
 * identico a que la app no hizo nada. Esa fue la queja original: "selecciono
 * el video, le doy a la palomita y no sucede nada".
 *
 * `onAvance` recibe un numero de 0 a 100.
 */
export async function uploadExerciseMedia(file, kind = 'media', onAvance) {
  if (file.size > LIMITE_MEDIA_MB * 1048576) {
    throw new Error(
      `Este archivo pesa ${mb(file.size)} MB, demasiado incluso para un video largo. ` +
      'Revisa que sea el archivo correcto.',
    );
  }

  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error('Tu sesión expiró. Vuelve a entrar e inténtalo otra vez.');

  const extension = (file.name.split('.').pop() || 'bin');
  const carpeta = kind === 'covers' || kind === 'videos' ? kind : 'media';

  // Paso 1: pedir permiso
  const permiso = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/r2-upload`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ tipo: file.type, extension, carpeta }),
  }).then((r) => r.json().then((b) => ({ ok: r.ok, b })))
    .catch(() => ({ ok: false, b: { error: 'No se pudo contactar al servidor.' } }));

  if (!permiso.ok) throw new Error(permiso.b?.error || 'No se pudo autorizar la subida.');

  // Paso 2: mandar el archivo directo a Cloudflare
  await new Promise((listo, falla) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', permiso.b.subir_a, true);
    xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onAvance) onAvance(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return listo();
      falla(new Error(`El almacenamiento rechazó el archivo (error ${xhr.status}).`));
    };
    xhr.onerror = () => falla(new Error('Se cortó la conexión durante la subida. Inténtalo de nuevo.'));
    xhr.ontimeout = () => falla(new Error('La subida tardó demasiado. Prueba con wifi.'));
    xhr.send(file);
  });

  // Paso 3: la direccion que se guarda en la base
  return permiso.b.url_publica;
}

/* --------------------- Videos por ángulo / género / atleta -------------- *
 * Un ejercicio puede tener varios videos. Cada uno lleva etiquetas que dicen
 * cuándo toca usarlo: el ángulo desde el que se grabó, para qué género es, y
 * si es un video puesto solo para un atleta concreto.
 *
 * El `video_url` de siempre NO desaparece: sigue siendo el video por defecto.
 * Esto se consulta encima, así que los ejercicios que ya existen no cambian.
 * ----------------------------------------------------------------------- */

// Todos los videos extra de un conjunto de ejercicios, en una sola consulta.
// Se pide en lote y no uno por ejercicio: una sesión tiene 8-12 ejercicios y
// doce viajes de ida y vuelta en el gimnasio, con datos móviles, se sienten.
export async function listExerciseMedia(exerciseIds) {
  const ids = (exerciseIds ?? []).filter(Boolean);
  if (ids.length === 0) return [];
  const { data, error } = await supabase
    .from('exercise_media')
    .select('*')
    .in('exercise_id', ids)
    .order('orden');
  if (error) throw error;
  return data ?? [];
}

export async function addExerciseMedia({
  exerciseId, url, tipo = 'video', etiqueta, genero, paraAtleta, inicio, fin,
  sinAudio = false, encuadre = null,
}) {
  const { data: auth } = await supabase.auth.getUser();
  const { data, error } = await supabase
    .from('exercise_media')
    .insert({
      exercise_id: exerciseId,
      url,
      tipo,
      etiqueta: etiqueta || null,
      genero: genero || null,
      para_atleta: paraAtleta || null,
      recorte_inicio: inicio ?? null,
      recorte_fin: fin ?? null,
      sin_audio: !!sinAudio,
      encuadre: encuadre ?? null,
      created_by: auth?.user?.id ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updateExerciseMedia(id, patch) {
  const { data, error } = await supabase
    .from('exercise_media').update(patch).eq('id', id).select('*').single();
  if (error) throw error;
  return data;
}

export async function deleteExerciseMedia(id) {
  const { error } = await supabase.from('exercise_media').delete().eq('id', id);
  if (error) throw error;
}

/* ------------------------------ Athletes ------------------------------ */
export async function listAthletes() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .order('created_at');
  if (error) throw error;
  return data ?? [];
}

// Lista para la tabla del panel: cada atleta con su plan activo y su última
// actividad. Tres consultas en lote (no una por atleta) que RLS ya acota a lo
// que el coach puede ver.
export async function listAthletesOverview() {
  const [profilesRes, plansRes, stateRes] = await Promise.all([
    supabase.from('profiles').select('*').order('created_at'),
    supabase.from('plans').select('user_id, title, data, updated_at').eq('status', 'active'),
    supabase.from('user_app_state').select('user_id, updated_at'),
  ]);
  if (profilesRes.error) throw profilesRes.error;

  const planByUser = new Map();
  (plansRes.data ?? []).forEach((p) => planByUser.set(p.user_id, p));
  const seenByUser = new Map();
  (stateRes.data ?? []).forEach((s) => seenByUser.set(s.user_id, s.updated_at));

  return (profilesRes.data ?? []).map((p) => {
    const plan = planByUser.get(p.id) ?? null;
    const phases = plan?.data?.phases ?? [];
    return {
      ...p,
      plan: plan
        ? {
            title: plan.title,
            kind: plan.data?.kind === 'weekly' ? 'weekly' : 'periodized',
            phases: phases.length,
            weeks: phases.reduce((s, ph) => s + (ph.weekData?.length || 0), 0),
          }
        : null,
      lastSeen: seenByUser.get(p.id) ?? null,
    };
  });
}

// Reasigna un atleta a un coach (o lo deja libre con coachId = null). Master.
export async function setAthleteCoach(athleteId, coachId) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ coach_id: coachId })
    .eq('id', athleteId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

/* --------------------- Quitar / desactivar / eliminar ------------------- *
 * Son TRES cosas distintas a propósito, de menor a mayor daño. Un solo botón
 * de "borrar" sería un error: los admins se equivocan de clic, la gente
 * regresa, y el historial es en parte del atleta — si entrenó dos años, esos
 * registros son suyos también, no solo de la lista del coach.
 * ----------------------------------------------------------------------- */

// 1. QUITAR DE MI LISTA. La usa el coach. Solo rompe la relación: la persona,
//    su plan y su historial quedan intactos, y el master la sigue viendo.
//    Un coach NO puede borrar cuentas: ese atleta puede ser también del master
//    o pasar mañana con otro coach, y un clic suyo destruiría trabajo ajeno.
export async function quitarAtletaDeMiLista(athleteId) {
  return setAthleteCoach(athleteId, null);
}

// 2. DESACTIVAR / REACTIVAR. Solo el master. No puede entrar y desaparece de
//    las listas, pero conserva todo. Es el botón normal del día a día.
//    El candado real está en la base (trigger `guardar_campos_de_poder`): sin
//    él, cualquiera podía reactivarse solo editando su propio perfil.
export async function setAtletaActivo(athleteId, activo) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ is_active: activo })
    .eq('id', athleteId)
    .select('*')
    .single();
  if (error) {
    if (/administrador/i.test(error.message)) {
      throw new Error('Solo el administrador puede activar o desactivar cuentas.');
    }
    throw error;
  }
  return data;
}

// Cuenta lo que se perdería si se borrara a alguien, para poder enseñárselo
// antes de preguntar. Un "¿seguro?" sin números no informa nada.
export async function resumenDatosAtleta(athleteId) {
  const { data, error } = await supabase.rpc('resumen_datos_atleta', { atleta: athleteId });
  if (error) throw error;
  return data ?? null;
}

// 3. ELIMINAR DEFINITIVO. Solo el master, y sin vuelta atrás.
//    Va por una función de servidor porque hay que borrar también la cuenta de
//    acceso (`auth.users`), y esa llave nunca puede estar en el navegador.
//    Ese borrado arrastra en cascada el perfil, el plan, las sesiones marcadas,
//    los pesos y el bienestar. NO borra los ejercicios que haya creado.
export async function eliminarAtletaDefinitivo(athleteId) {
  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error('Tu sesión expiró. Vuelve a entrar e inténtalo otra vez.');

  const res = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/admin-delete-user`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ id: athleteId }),
  }).catch(() => null);

  if (!res) throw new Error('No se pudo contactar al servidor. Revisa tu conexión.');
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'No se pudo eliminar la cuenta.');
  return body;
}

/* ------------------------------- Coaches ------------------------------ */
export async function listCoaches() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'admin')
    .eq('is_owner', false)
    .order('full_name');
  if (error) throw error;
  return data ?? [];
}

// El master crea una cuenta de coach vía la Edge Function (service role). NO
// cambia la sesión actual del master (a diferencia del signUp del registro).
export async function createCoachAccount({ username, fullName, email, password }) {
  const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/signup`;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: key, Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      username, full_name: fullName || undefined, email: email || undefined,
      password, account_type: 'coach',
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.error || 'No se pudo crear el coach');
  return body;
}

// Promueve un atleta existente a coach (y lo desasigna de su coach previo). Master.
export async function promoteToCoach(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ role: 'admin', coach_id: null })
    .eq('id', userId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function getAthleteState(userId) {
  const { data, error } = await supabase
    .from('user_app_state')
    .select('data, updated_at')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

/* -------------------------------- Plans -------------------------------- */
// Plan activo de un usuario (jsonb con { phases: [...] } — misma estructura
// que el plan original: fases → semanas → días → ejercicios).
export async function getActivePlan(userId) {
  const { data, error } = await supabase
    .from('plans')
    .select('*')
    .eq('user_id', userId)
    .eq('status', 'active')
    .maybeSingle();
  if (error) throw error;
  return data ?? null;
}

// `kind`: 'weekly' = rutina semanal que se repite | 'periodized' = fases que
// avanzan (default para los planes creados antes de existir este campo).
export async function createPlan({ userId, title, phases, kind, createdBy }) {
  const { data, error } = await supabase
    .from('plans')
    .insert({
      user_id: userId,
      title: title || 'Plan de entrenamiento',
      status: 'active',
      data: { kind: kind || 'periodized', phases: phases ?? [] },
      created_by: createdBy ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updatePlan(planId, { title, phases, kind }) {
  const patch = { updated_at: new Date().toISOString() };
  if (title !== undefined) patch.title = title;
  // `data` se reescribe entero, así que el kind viaja siempre junto a las fases
  if (phases !== undefined) patch.data = { kind: kind || 'periodized', phases };
  const { data, error } = await supabase
    .from('plans')
    .update(patch)
    .eq('id', planId)
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deletePlan(planId) {
  const { error } = await supabase.from('plans').delete().eq('id', planId);
  if (error) throw error;
}

/* ----------------------------- Templates ------------------------------ */
// Plantillas de rutina: kind 'day' (una sesión) o 'week' (7 días)
export async function listTemplates(kind) {
  let q = supabase.from('routine_templates').select('*').order('updated_at', { ascending: false });
  if (kind) q = q.eq('kind', kind);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
}

export async function saveTemplate({ name, kind, data, createdBy }) {
  const { data: row, error } = await supabase
    .from('routine_templates')
    .insert({ name, kind, data, created_by: createdBy ?? null })
    .select('*')
    .single();
  if (error) throw error;
  return row;
}

export async function deleteTemplate(id) {
  const { error } = await supabase.from('routine_templates').delete().eq('id', id);
  if (error) throw error;
}

/* ------------------------------ Routines ------------------------------ */
export async function listRoutines(userId) {
  const { data, error } = await supabase
    .from('user_routines')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function assignRoutine({ userId, name, description, routineData, assignedBy }) {
  const { data, error } = await supabase
    .from('user_routines')
    .insert({
      user_id: userId,
      name,
      description: description || null,
      routine_data: routineData ?? {},
      assigned_by: assignedBy ?? null,
      is_active: true,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function deleteRoutine(id) {
  const { error } = await supabase.from('user_routines').delete().eq('id', id);
  if (error) throw error;
}
