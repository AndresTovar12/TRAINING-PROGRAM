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

export async function createExercise(payload) {
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
// Uploads a File to the public exercise-media bucket and returns its public URL.
export async function uploadExerciseMedia(file, kind = 'media') {
  const safeExt = (file.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
  const id = (crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const path = `${kind}/${id}.${safeExt}`;
  const { error } = await supabase.storage
    .from(MEDIA_BUCKET)
    .upload(path, file, { cacheControl: '3600', upsert: false, contentType: file.type || undefined });
  if (error) throw error;
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

export async function createPlan({ userId, title, phases, createdBy }) {
  const { data, error } = await supabase
    .from('plans')
    .insert({
      user_id: userId,
      title: title || 'Plan de entrenamiento',
      status: 'active',
      data: { phases: phases ?? [] },
      created_by: createdBy ?? null,
    })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function updatePlan(planId, { title, phases }) {
  const patch = { updated_at: new Date().toISOString() };
  if (title !== undefined) patch.title = title;
  if (phases !== undefined) patch.data = { phases };
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
