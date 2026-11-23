/**
 * EN QUÉ VAS: el mismo dato en todas las pantallas del entreno (Andrés, 23 nov 2026: «hay una incongruencia… en Back Squat tienes un componente
 * que te indica serie 1 de 3… no entiendo por qué existe esa diferencia»). Antes salía de 4 formas distintas; ahora todas lo piden aquí y lo pinta
 * `EnQueVas.jsx`.
 *
 * `{ rotulo, n, de, extra }` o `null` si el paso no se repite:
 *   · un sprint (de la lista o del Híbrido): «Sprint 2 de 4», y de extra la serie («serie 1 de 3»);
 *   · un tramo de unos intervalos: «Tramo 3 de 8»;
 *   · lo que se repite (Gym, Técnica, Híbrido): «Serie 1 de 3».
 * Palabras: «Serie» es SIEMPRE la vuelta; el bloque del coach es el «Set» (como en el editor).
 */
export function cuentaDelPaso(p) {
  if (!p) return null;
  if (p.sprints > 1) {
    const extra = p.bloques > 1 ? `serie ${p.bloque} de ${p.bloques}` : (p.vueltas > 1 && p.vueltas !== p.sprints ? `serie ${p.vuelta} de ${p.vueltas}` : '');
    return { rotulo: p.pieza === 'int:series' ? 'Serie' : 'Sprint', n: p.sprint, de: p.sprints, extra };
  }
  if (p.tramos > 1 && p.tramo) return { rotulo: 'Tramo', n: p.tramo, de: p.tramos, extra: '' };
  if (p.vueltas > 1) return { rotulo: 'Serie', n: p.vuelta, de: p.vueltas, extra: '' };
  return null;
}
