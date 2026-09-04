import { supabase } from '@/lib/supabase';

const MEDIA_BUCKET = 'exercise-media';
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

/* ------------------------------- Media -------------------------------- */
/**
 * Tope real de subida. Verificado el 3 sep 2026 contra el proyecto:
 *
 * Manda el limite GLOBAL del proyecto (Settings -> Storage -> Global file size
 * limit), no el del bucket. En el plan gratis de Supabase ese global esta
 * FIJO en 50 MB y no se puede cambiar; el bucket puede decir 500 MB y da igual,
 * el servidor responde 413 de todas formas.
 *
 * Se descubrio de la peor manera: una prueba de 120 MB subio completa —75
 * segundos— y el servidor la rechazo al final. Por eso este numero tiene que
 * coincidir con el limite REAL, para avisar antes y no despues.
 *
 * Si algun dia se pasa al plan Pro, el limite sube a 500 GB configurable y hay
 * que cambiar este numero Y el del bucket.
 */
export const LIMITE_MEDIA_MB = 50;

const mb = (bytes) => Math.round((bytes / 1048576) * 10) / 10;

/**
 * Sube un archivo al repertorio y devuelve su URL publica.
 *
 * Usa XMLHttpRequest en vez del cliente de Supabase por una sola razon: el
 * cliente no informa el avance de la subida, y sin avance un video de 80 MB
 * por datos moviles se ve identico a que la app no hizo nada. Esa fue
 * exactamente la queja: "selecciono el video, le doy a la palomita y no
 * sucede nada". Con XHR se puede escuchar `upload.onprogress`.
 *
 * `onAvance` recibe un numero de 0 a 100.
 */
export async function uploadExerciseMedia(file, kind = 'media', onAvance) {
  // 1. Revisar el peso ANTES de gastar datos. Los videos de iPhone son enormes:
  //    en 4K, medio minuto ya pasa de 100 MB.
  if (file.size > LIMITE_MEDIA_MB * 1048576) {
    throw new Error(
      `Este archivo pesa ${mb(file.size)} MB y el máximo son ${LIMITE_MEDIA_MB} MB. ` +
      'Graba un clip más corto, o baja la calidad en Ajustes → Cámara → Grabar video.',
    );
  }

  const { data: sesion } = await supabase.auth.getSession();
  const token = sesion?.session?.access_token;
  if (!token) throw new Error('Tu sesión expiró. Vuelve a entrar e inténtalo otra vez.');

  const safeExt = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const id = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const path = `${kind}/${id}.${safeExt}`;
  const url = `${import.meta.env.VITE_SUPABASE_URL}/storage/v1/object/${MEDIA_BUCKET}/${path}`;

  await new Promise((listo, falla) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url, true);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.setRequestHeader('x-upsert', 'false');
    // Sin esto el archivo se sirve como "no-cache" y el telefono del atleta lo
    // vuelve a pedir cada vez que abre el ejercicio. Una hora de cache basta:
    // el nombre del archivo lleva un id unico, asi que un video nuevo nunca
    // reusa la copia guardada de otro.
    xhr.setRequestHeader('Cache-Control', 'max-age=3600');
    if (file.type) xhr.setRequestHeader('Content-Type', file.type);

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onAvance) onAvance(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) return listo();
      // El servidor contesta JSON con el motivo; si no, se usa el codigo.
      let motivo = `Error ${xhr.status}`;
      try { motivo = JSON.parse(xhr.responseText)?.message || motivo; } catch { /* respuesta no-JSON */ }
      if (xhr.status === 413) motivo = `El archivo pesa demasiado (máximo ${LIMITE_MEDIA_MB} MB).`;
      falla(new Error(motivo));
    };
    xhr.onerror = () => falla(new Error('Se cortó la conexión durante la subida. Inténtalo de nuevo.'));
    xhr.ontimeout = () => falla(new Error('La subida tardó demasiado. Prueba con wifi o con un clip más corto.'));
    xhr.send(file);
  });

  const { data } = supabase.storage.from(MEDIA_BUCKET).getPublicUrl(path);
  return data.publicUrl;
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
