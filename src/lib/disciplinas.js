import { Dumbbell, Timer, Footprints, Bike, Waves, Medal, PersonStanding, Flower2, Trophy, Shapes } from 'lucide-react';
import { ORDEN_DE_FAMILIAS, familiaDelDia } from '@/lib/fichaDelEjercicio';

/* Las Disciplinas fijas de la app: sus íconos (los mismos en la sesión y en la ficha del ejercicio) y de dónde se marcan solas. */
export const ICONO_DE_DISCIPLINA = {
  libre: Shapes, pesas: Dumbbell, hyrox: Timer, correr: Footprints, bici: Bike, nadar: Waves,
  triatlon: Medal, movilidad: PersonStanding, clase: Flower2, deporte: Trophy,
};
// Nombre corto para el cuadro: «Movilidad y rehab» no cabe en un cuadro de 4 por fila en el teléfono.
// «hyrox» por dentro se sigue llamando así (los planes guardados lo usan); en pantalla dice «Híbrido» (Andrés, 19 nov 2026).
export const CORTO = { movilidad: 'Movilidad' };
// Libre va al final: es «ninguna en particular».
export const ORDEN_DISCIPLINAS = [...ORDEN_DE_FAMILIAS.filter((f) => f !== 'libre'), 'libre'];

/* De dónde salen solas: las sesiones (de todos los planes que el coach puede ver) donde aparece el ejercicio, por su id o por su nombre.
   Cada sesión dice su Disciplina (`day.disciplina`). En la app real esto debe guardarse al guardar un plan, no calcularse al abrir. */
export function disciplinasPorUso(planes, ejercicio) {
  if (!ejercicio) return [];
  const nombre = String(ejercicio.name ?? '').trim().toLowerCase();
  const es = (x) => x && (x.exercise_id === ejercicio.id || (nombre && String(x.name ?? '').trim().toLowerCase() === nombre));
  const usa = (day) => (day.exercises ?? []).some(es)
    || (day.hibrido?.sets ?? []).some((s) => (s.items ?? []).some(es))
    || (day.deporte?.items ?? []).some(es)
    || (day.tramos ?? []).some((t) => es(t.ej) || (t.items ?? []).some(es) || (t.pasos ?? []).some((p) => es(p.ej)) || es(t.video));
  const hallo = new Set();
  const visto = new Set();
  const camina = (o) => {
    if (!o || typeof o !== 'object' || visto.has(o)) return;
    visto.add(o);
    // `familiaDelDia` ya lee lo viejo (una sesión que decía Speed cuenta como Running).
    if ((Array.isArray(o.exercises) || Array.isArray(o.tramos) || Array.isArray(o.hibrido?.sets) || Array.isArray(o.deporte?.items)) && o.disciplina && familiaDelDia(o) !== 'libre' && usa(o)) hallo.add(familiaDelDia(o));
    (Array.isArray(o) ? o : Object.values(o)).forEach(camina);
  };
  camina(planes);
  return ORDEN_DISCIPLINAS.filter((f) => hallo.has(f));
}

