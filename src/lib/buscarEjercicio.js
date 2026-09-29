import { comoEnGrupo, groupForMuscle } from '@/lib/muscles';

// Cómo se junta lo marcado en una lista. 'todas': el ejercicio tiene que tener
// TODAS; 'cualquiera': basta UNA. Cada una cuenta igual si es la principal o
// una secundaria. Devuelve -1 si no pasa, o cuántas entraron por lo secundario
// (todas) / 0 si alguna es la principal y 1 si solo hay secundarias (cualquiera),
// que es lo que se usa para ordenar: primero lo que es de verdad.
function combina(como, modo) {
  if (modo === 'cualquiera') {
    if (como.every((c) => !c)) return -1;
    return como.includes('principal') ? 0 : 1;
  }
  if (como.some((c) => !c)) return -1;
  return como.filter((c) => c === 'secundario').length;
}

/**
 * ¿Pasa el ejercicio los filtros marcados en las listas?
 *
 * Andrés, 28 sep 2026: "¿qué tal si quiero hacer una búsqueda específica de
 * puros ejercicios con dos categorías y dos grupos musculares?". Y luego:
 * "alguien puede pensar que si selecciono «fuerza» y aparte «pliométricos» me
 * van a aparecer todos los de fuerza y también todos los pliométricos". Por eso
 * cada lista tiene su modo (`ModoDeFiltro`): 'cualquiera' (por defecto: lo que
 * la mayoría espera de una lista de varias) o 'todas' (la búsqueda específica).
 * Entre las dos listas manda siempre "y": una categoría Y un grupo.
 *
 * Devuelve -1 si no pasa; si pasa, un número para ordenar (0 = todo lo que
 * marcó es de verdad, más = entra por algo secundario). Sin nada marcado, 0.
 *
 * `categoriaIds`: ids de categoría. `grupos`: los grupos marcados (objetos de
 * `gruposConPropios`).
 */
export function pasaFiltros(ex, {
  categoriaIds = [], grupos = [], modoCategorias = 'cualquiera', modoGrupos = 'cualquiera',
}) {
  let rango = 0;
  if (categoriaIds.length) {
    const principal = ex.category_id ?? ex.category?.id;
    const como = categoriaIds.map((id) => {
      if (principal === id) return 'principal';
      return (ex.categorias_secundarias ?? []).includes(id) ? 'secundario' : null;
    });
    const r = combina(como, modoCategorias);
    if (r < 0) return -1;
    rango += r;
  }
  if (grupos.length) {
    const r = combina(grupos.map((g) => comoEnGrupo(ex, g)), modoGrupos);
    if (r < 0) return -1;
    rango += r;
  }
  return rango;
}

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
