import { comoEnGrupo, groupForMuscle } from '@/lib/muscles';

/**
 * ¿Tiene el ejercicio TODAS estas categorías y trabaja TODOS estos grupos?
 *
 * Andrés, 28 sep 2026: "¿qué tal si quiero hacer una búsqueda específica de
 * puros ejercicios con dos categorías y dos grupos musculares?". Con varias
 * marcadas en las listas, salen solo los que las tienen todas. Cada una cuenta
 * igual si es la principal o una secundaria.
 *
 * Devuelve cuántas entraron por lo secundario —para ordenar: primero los que
 * lo tienen todo como principal— o -1 si le falta alguna. Sin nada marcado
 * devuelve 0: pasan todos.
 *
 * `categoriaIds`: ids de categoría. `grupos`: los grupos marcados (objetos de
 * `gruposConPropios`).
 */
export function pasaFiltros(ex, { categoriaIds = [], grupos = [] }) {
  let secundarias = 0;
  const principal = ex.category_id ?? ex.category?.id;
  for (const id of categoriaIds) {
    if (principal === id) continue;
    if (!(ex.categorias_secundarias ?? []).includes(id)) return -1;
    secundarias += 1;
  }
  for (const g of grupos) {
    const como = comoEnGrupo(ex, g);
    if (!como) return -1;
    if (como === 'secundario') secundarias += 1;
  }
  return secundarias;
}

/**
 * Lo que se escribe en el buscador de ejercicios, contra qué se compara.
 *
 * Andrés, 28 sep 2026: "cuando un coach busque un ejercicio debe poder hacer
 * búsquedas con grupos secundarios y categorías secundarias también". Antes
 * el buscador solo miraba el nombre: escribir "pliometría" no encontraba nada
 * que no se llamara así.
 *
 * Se usa en los dos buscadores —el del repertorio y el del editor de planes—
 * para que respondan igual.
 */

// "Glúteo", "gluteo" y "GLÚTEO" son lo mismo al buscar.
export const sinAcentos = (s) => (s ?? '').toString()
  .normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();

// Cada músculo con el grupo al que pertenece: buscar "brazos" encuentra
// "Antebrazo", y buscar "cuádriceps" también.
const musculosConSuGrupo = (musculos, grupos) => (musculos ?? [])
  .flatMap((m) => [m, groupForMuscle(m, grupos)?.label]);

/**
 * Por dónde coincide un ejercicio con lo que se escribió:
 *   0  su nombre o su equipo
 *   1  lo principal: categoría, músculo o grupo muscular
 *   2  lo secundario: categorías secundarias, músculos o grupos secundarios
 *  -1  no coincide
 * Con el buscador vacío, todo coincide (0). El número sirve para ordenar:
 * primero lo que se llama así, después lo que lo es de verdad y al final lo
 * que lo es de refilón.
 */
export function coincidencia(ex, texto, { categoriasPorId, grupos }) {
  const q = sinAcentos(texto);
  if (!q) return 0;
  const tiene = (v) => !!v && sinAcentos(v).includes(q);

  if (tiene(ex.name) || tiene(ex.equipment)) return 0;

  if (tiene(ex.category?.name) || musculosConSuGrupo(ex.muscle_primary, grupos).some(tiene)) return 1;

  const secundarias = (ex.categorias_secundarias ?? []).map((id) => categoriasPorId?.get(id)?.name);
  if (secundarias.some(tiene) || musculosConSuGrupo(ex.muscle_secondary, grupos).some(tiene)) return 2;

  return -1;
}
