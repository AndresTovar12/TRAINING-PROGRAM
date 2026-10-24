import { cursorAlDia, defaultCursor, isValidCursor, estructuraDelPlan, semanaGlobal } from '@/lib/training-utils';

/* «DÓNDE VA» un atleta, dicho en corto: «Fase 2 · Sem 3», «Semana 5», «Se repite». Lo usan la lista del coach (columna «Va en»), la ficha y la
   hoja del programa. Una sola función para que nadie cuente por su lado (Andrés, 16 oct 2026: «ni yo sé dónde va mi atleta»). */

/** Una semana cualquiera del plan, dicha en corto. */
export function textoDeSemana(data, faseId, semana) {
  const fases = data?.phases ?? [];
  const estructura = estructuraDelPlan(data);
  if (estructura === 'rutina') return 'Se repite';
  if (estructura === 'semanas') return `Semana ${semanaGlobal(fases, faseId, semana) ?? semana}`;
  const i = fases.findIndex((f) => f.id === faseId);
  /* El nombre que el coach le puso a la fase (recortado para que quepa en la columna «Va en»); sin nombre, su posición (auditoría p66). */
  const nombre = (fases[i]?.name ?? '').trim();
  const corto = nombre.length > 22 ? `${nombre.slice(0, 21).trimEnd()}…` : nombre;
  return `${corto || `Fase ${i + 1}`} · Sem ${semana}`;
}

/** La semana donde va ahora, con el calendario ya contado; `null` si el plan no tiene fases. */
export function dondeVaEnTexto(data, puntero, hoy = new Date()) {
  const fases = data?.phases ?? [];
  if (!fases.length) return null;
  const base = isValidCursor(fases, puntero) ? puntero : defaultCursor(fases);
  const c = cursorAlDia(fases, base, hoy);
  return textoDeSemana(data, c.phaseId, c.weekNum);
}
