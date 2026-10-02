import { supabase } from '@/lib/supabase';
import { resumenDe } from '@/lib/misPlanesDatos';

/* MIS PLANES, contra la base: carpetas con subcarpetas y las tres clases de cosas que se
   guardan (ver `lib/misPlanesDatos.js`). Cada profesional ve y toca solo lo suyo (lo impone
   la base: `carpetas_planes`, `programas_guardados` y `routine_templates`).

   Un «item» es una fila de cualquiera de las dos tablas, ya con la misma forma:
     { id, tabla, tipo, nombre, descripcion, origen, carpetaId, resumen, creado, actualizado }
   Lo guardado en sí (`data`) no viaja en la lista: se pide al abrirlo con `abrirItem`. */

const TABLA_DE = { workout: 'routine_templates', rutina: 'routine_templates', programa: 'programas_guardados' };
const KIND_DE = { workout: 'day', rutina: 'week' };
const COLUMNAS = 'id, name, descripcion, origen, carpeta_id, resumen, created_at, updated_at';
const COLUMNAS_PLANTILLA = `${COLUMNAS}, kind`;

const tipoDeFila = (fila, tabla) => (tabla === 'programas_guardados' ? 'programa' : (fila.kind === 'week' ? 'rutina' : 'workout'));

const comoItem = (fila, tabla) => ({
  id: fila.id,
  tabla,
  tipo: tipoDeFila(fila, tabla),
  nombre: fila.name,
  descripcion: fila.descripcion ?? '',
  origen: fila.origen ?? '',
  carpetaId: fila.carpeta_id ?? null,
  resumen: fila.resumen ?? null,
  creado: fila.created_at,
  actualizado: fila.updated_at,
});

const columnasDe = (tabla) => (tabla === 'routine_templates' ? COLUMNAS_PLANTILLA : COLUMNAS);

/* Lo guardado ANTES de «Mis planes» (los workouts y semanas que ya había) no trae su resumen. Se calcula aquí, una
   sola vez por cosa: se lee su contenido, se resume y se guarda para la próxima. Si no se puede guardar, no pasa
   nada: se enseña igual. */
async function completarResumenes(items) {
  await Promise.all(items.filter((i) => !i.resumen).map(async (i) => {
    try {
      const data = await abrirItem(i);
      i.resumen = resumenDe(i.tipo, data);
      await supabase.from(i.tabla).update({ resumen: i.resumen }).eq('id', i.id);
    } catch {
      /* se queda sin resumen */
    }
  }));
}

/** Todas las carpetas y todo lo guardado de `userId` (sin el contenido de cada cosa). */
export async function listarMisPlanes(userId) {
  const [carpetas, plantillas, programas] = await Promise.all([
    supabase.from('carpetas_planes').select('*').eq('owner_id', userId),
    supabase.from('routine_templates').select(COLUMNAS_PLANTILLA).eq('created_by', userId),
    supabase.from('programas_guardados').select(COLUMNAS).eq('created_by', userId),
  ]);
  [carpetas, plantillas, programas].forEach((r) => { if (r.error) throw r.error; });
  const items = [
    ...(plantillas.data ?? []).map((f) => comoItem(f, 'routine_templates')),
    ...(programas.data ?? []).map((f) => comoItem(f, 'programas_guardados')),
  ];
  await completarResumenes(items);
  return { carpetas: carpetas.data ?? [], items };
}

/** Lo guardado en sí: un workout, los días de una rutina o las fases de un programa. */
export async function abrirItem(item) {
  const { data, error } = await supabase.from(item.tabla).select('data').eq('id', item.id).single();
  if (error) throw error;
  return data.data;
}

/** Guarda algo NUEVO. `origen`: «Creado desde cero» o «Del plan de Juan». */
export async function guardarItem({ tipo, nombre, descripcion, origen, carpetaId, data, userId }) {
  const tabla = TABLA_DE[tipo];
  const fila = {
    name: nombre.trim(),
    descripcion: descripcion?.trim() || null,
    origen: origen || null,
    carpeta_id: carpetaId ?? null,
    resumen: resumenDe(tipo, data),
    data,
    created_by: userId,
    ...(tipo === 'programa' ? {} : { kind: KIND_DE[tipo] }),
  };
  const { data: creada, error } = await supabase.from(tabla).insert(fila).select(columnasDe(tabla)).single();
  if (error) throw error;
  return comoItem(creada, tabla);
}

/** Cambia el nombre, la descripción, la carpeta o el contenido de algo guardado. */
export async function actualizarItem(item, { nombre, descripcion, carpetaId, data }) {
  const cambios = { updated_at: new Date().toISOString() };
  if (nombre !== undefined) cambios.name = nombre.trim();
  if (descripcion !== undefined) cambios.descripcion = descripcion?.trim() || null;
  if (carpetaId !== undefined) cambios.carpeta_id = carpetaId;
  if (data !== undefined) {
    cambios.data = data;
    cambios.resumen = resumenDe(item.tipo, data);
  }
  const { data: fila, error } = await supabase.from(item.tabla).update(cambios).eq('id', item.id).select(columnasDe(item.tabla)).single();
  if (error) throw error;
  return comoItem(fila, item.tabla);
}

export async function borrarItem(item) {
  const { error } = await supabase.from(item.tabla).delete().eq('id', item.id);
  if (error) throw error;
}

/** Una copia con otro nombre, en la misma carpeta. */
export async function duplicarItem(item, nombre, userId) {
  const data = await abrirItem(item);
  return guardarItem({
    tipo: item.tipo, nombre, descripcion: item.descripcion, origen: item.origen, carpetaId: item.carpetaId, data, userId,
  });
}

/* ------------------------------ Carpetas ------------------------------ */

export async function crearCarpeta({ nombre, parentId = null, userId }) {
  const { data, error } = await supabase
    .from('carpetas_planes')
    .insert({ nombre: nombre.trim(), parent_id: parentId, owner_id: userId })
    .select('*')
    .single();
  if (error) throw error;
  return data;
}

export async function renombrarCarpeta(id, nombre) {
  const { error } = await supabase
    .from('carpetas_planes')
    .update({ nombre: nombre.trim(), updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

export async function moverCarpeta(id, parentId) {
  const { error } = await supabase
    .from('carpetas_planes')
    .update({ parent_id: parentId, updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Borra la carpeta; lo que tenía (subcarpetas y cosas) sube un nivel, a la carpeta de arriba de ella (o a
 * «Sin carpeta»). Primero se sube todo y al final se borra la carpeta: si algo falla a medias, no se pierde nada.
 */
export async function borrarCarpeta(carpeta) {
  const arriba = carpeta.parent_id ?? null;
  const subidas = await Promise.all([
    supabase.from('carpetas_planes').update({ parent_id: arriba, updated_at: new Date().toISOString() }).eq('parent_id', carpeta.id),
    supabase.from('routine_templates').update({ carpeta_id: arriba }).eq('carpeta_id', carpeta.id),
    supabase.from('programas_guardados').update({ carpeta_id: arriba }).eq('carpeta_id', carpeta.id),
  ]);
  subidas.forEach((r) => { if (r.error) throw r.error; });
  const { error } = await supabase.from('carpetas_planes').delete().eq('id', carpeta.id);
  if (error) throw error;
}
