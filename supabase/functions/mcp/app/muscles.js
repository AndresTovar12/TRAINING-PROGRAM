/**
 * Taxonomía de grupos musculares.
 *
 * Los ejercicios guardan en `muscle_primary` y `muscle_secondary` valores finos
 * ("Cuádriceps", "Cadena posterior"…) y así se siguen mostrando en la tarjeta.
 * Los menús de filtro y el editor trabajan con GRUPOS gruesos; este módulo es
 * el único lugar donde vive esa correspondencia.
 *
 * Los grupos de siempre están aquí. Los que agrega cada coach viven en la tabla
 * `grupos_musculares` y se suman con `gruposConPropios`.
 */

export const MUSCLE_GROUPS = [
  { id: 'piernas', label: 'Piernas', members: ['Cuádriceps', 'Isquios', 'Flexores de cadera'] },
  { id: 'gluteo', label: 'Glúteo', members: ['Glúteo', 'Cadena posterior'] },
  { id: 'pecho', label: 'Pecho', members: ['Pecho'] },
  // "Espalda alta" y "Espalda baja" ya venían en el repertorio y no caían en
  // ningún grupo: filtrando por Espalda no salían.
  { id: 'espalda', label: 'Espalda', members: ['Espalda', 'Trapecio', 'Espalda alta', 'Espalda baja'] },
  { id: 'brazos', label: 'Brazos', members: ['Bíceps', 'Tríceps', 'Antebrazo'] },
  { id: 'core', label: 'Core', members: ['Core', 'Oblicuos'] },
  { id: 'hombros', label: 'Hombros', members: ['Hombro', 'Deltoide posterior'] },
  { id: 'pantorrilla', label: 'Pantorrilla', members: ['Pantorrilla'] },
  { id: 'cuerpo-completo', label: 'Cuerpo completo', members: ['Cuerpo completo'] },
];

const norm = (s) => (s || '').toString().trim().toLowerCase();

// Músculos finos conocidos (para ofrecerlos como detalle en el editor).
export const FINE_MUSCLES = [...new Set(MUSCLE_GROUPS.flatMap((g) => g.members))]
  .sort((a, b) => a.localeCompare(b));

/**
 * Los grupos que se ofrecen: los de siempre y, detrás, los que agregó cada
 * coach. Uno propio que se llame igual que uno de siempre no se repite.
 * `propio` lleva la fila de la base, para poder borrarlo.
 */
export function gruposConPropios(propios = []) {
  const vistos = new Set(MUSCLE_GROUPS.map((g) => norm(g.label)));
  const extra = [];
  propios.forEach((fila) => {
    const n = norm(fila.name);
    if (!n || vistos.has(n)) return;
    vistos.add(n);
    extra.push({ id: `propio-${fila.id}`, label: fila.name.trim(), members: [], propio: fila });
  });
  return [...MUSCLE_GROUPS, ...extra];
}

// ¿Alguno de estos músculos es de este grupo? Vale el nombre del grupo
// ("Piernas", en ejercicios nuevos) o uno de sus músculos finos ("Cuádriceps").
const tocaGrupo = (musculos, g) => {
  const valores = new Set([norm(g.label), ...g.members.map(norm)]);
  return (musculos ?? []).some((m) => valores.has(norm(m)));
};

/**
 * Cómo trabaja un ejercicio a un grupo: 'principal', 'secundario' o null.
 * Los filtros enseñan los dos —así un ejercicio sale también en su grupo
 * secundario— y ordenan primero los principales.
 */
export function comoEnGrupo(ex, g) {
  if (!g) return null;
  if (tocaGrupo(ex?.muscle_primary, g)) return 'principal';
  if (tocaGrupo(ex?.muscle_secondary, g)) return 'secundario';
  return null;
}

// Grupo al que pertenece un músculo fino (o el propio grupo si ya viene agrupado).
export function groupForMuscle(muscle, grupos = MUSCLE_GROUPS) {
  const m = norm(muscle);
  if (!m) return null;
  return grupos.find(
    (g) => norm(g.label) === m || g.members.some((x) => norm(x) === m),
  ) ?? null;
}
