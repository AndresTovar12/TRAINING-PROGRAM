import { createCategory } from '@/lib/api';

/**
 * Las reglas para crear una categoría propia, en un solo sitio.
 *
 * Se crean desde dos lugares: el selector del editor de un ejercicio
 * (`SelectorCategoria`) y la lista de filtros del repertorio ("Agregar
 * categoría", Andrés 28 sep 2026). Con dos copias, un arreglo llegaría solo a
 * una.
 */

// "Velocidad", "velocidad" y "Velocidád" son la misma categoría para una persona.
export const mismoNombre = (a = '', b = '') => a.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()
  === b.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase();

// Las que hizo el dueño de la vista.
export const categoriasMias = (categorias, duenoId) => (
  categorias.filter((c) => c.created_by && c.created_by === duenoId)
);

// Las de la app: las de siempre (sin dueño) y las del master.
export const categoriasDeLaApp = (categorias, duenoId, masterId) => (
  categorias.filter((c) => !c.created_by || (c.created_by === masterId && c.created_by !== duenoId))
);

/**
 * Crea una categoría a nombre de `duenoId`. Lanza un error con un mensaje para
 * la persona si falta el nombre o si ya tiene una igual (suya o de la app).
 */
export async function crearCategoriaPropia({ nombre, categorias, duenoId, masterId }) {
  const n = (nombre || '').trim();
  if (!n) throw new Error('Ponle un nombre.');
  const mias = categoriasMias(categorias, duenoId);
  if ([...mias, ...categoriasDeLaApp(categorias, duenoId, masterId)].some((c) => mismoNombre(c.name, n))) {
    throw new Error('Ya existe una categoría con ese nombre.');
  }
  return createCategory({ name: n, createdBy: duenoId, cuantas: mias.length });
}
