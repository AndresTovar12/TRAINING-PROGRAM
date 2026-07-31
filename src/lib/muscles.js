/**
 * Taxonomía de grupos musculares.
 *
 * Los ejercicios guardan en `muscle_primary` valores finos ("Cuádriceps",
 * "Cadena posterior"…) y así se siguen mostrando en la tarjeta. Los menús de
 * filtro y el editor trabajan con GRUPOS gruesos; este módulo es el único lugar
 * donde vive esa correspondencia.
 */

export const MUSCLE_GROUPS = [
  { id: 'piernas', label: 'Piernas', members: ['Cuádriceps', 'Isquios', 'Flexores de cadera'] },
  { id: 'gluteo', label: 'Glúteo', members: ['Glúteo', 'Cadena posterior'] },
  { id: 'pecho', label: 'Pecho', members: ['Pecho'] },
  { id: 'espalda', label: 'Espalda', members: ['Espalda', 'Trapecio'] },
  { id: 'brazos', label: 'Brazos', members: ['Bíceps', 'Tríceps'] },
  { id: 'core', label: 'Core', members: ['Core', 'Oblicuos'] },
  { id: 'hombros', label: 'Hombros', members: ['Hombro', 'Deltoide posterior'] },
  { id: 'pantorrilla', label: 'Pantorrilla', members: ['Pantorrilla'] },
  { id: 'cuerpo-completo', label: 'Cuerpo completo', members: ['Cuerpo completo'] },
];

const norm = (s) => (s || '').toString().trim().toLowerCase();

// Músculos finos conocidos (para ofrecerlos como detalle en el editor).
export const FINE_MUSCLES = [...new Set(MUSCLE_GROUPS.flatMap((g) => g.members))]
  .sort((a, b) => a.localeCompare(b));

export const groupById = (id) => MUSCLE_GROUPS.find((g) => g.id === id) ?? null;

// Grupo al que pertenece un músculo fino (o el propio grupo si ya viene agrupado).
export function groupForMuscle(muscle) {
  const m = norm(muscle);
  if (!m) return null;
  return MUSCLE_GROUPS.find(
    (g) => norm(g.label) === m || g.members.some((x) => norm(x) === m),
  ) ?? null;
}

// ¿El ejercicio pertenece al grupo? Acepta tanto valores finos ("Cuádriceps")
// como el label del grupo ya guardado ("Piernas", en ejercicios nuevos).
export function exerciseMatchesGroup(ex, groupId) {
  if (!groupId || groupId === 'all') return true;
  const g = groupById(groupId);
  if (!g) return false;
  const values = ex?.muscle_primary ?? [];
  return values.some((v) => {
    const n = norm(v);
    return n === norm(g.label) || g.members.some((x) => norm(x) === n);
  });
}
