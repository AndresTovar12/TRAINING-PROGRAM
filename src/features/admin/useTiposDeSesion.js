import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { CAT_COLORS } from '@/lib/theme';
import { createSessionType, deleteSessionType, listSessionTypes } from '@/lib/api';
import { useStorage } from '@/contexts/AppStateContext';

/**
 * Los tipos de sesión que ofrece el selector de un coach: los de la APP (menos los que él quitó) y los SUYOS.
 *
 * Andrés, 9 oct 2026: cada coach tiene que poder «agregar tipos de sesión pero también eliminar los que no les gusten», también los de la app.
 *
 * LOS DE LA APP viven en el código (`CAT_COLORS`) y no se borran de ningún lado: «quitar» uno es apuntarlo en la lista de quitados de ESE coach
 * (`ui:tipos-quitados`, en su estado de usuario: lo acompaña a cualquier dispositivo). «OFF» no se puede quitar: la app lo usa para los días libres.
 *
 * LOS SUYOS están en la base (`session_types`). Se piden UNA vez por coach y se comparten entre todos los selectores de la pantalla (un editor con
 * veinte sesiones tiene veinte selectores): lo que uno crea o quita se ve en los demás sin recargar.
 *
 * Quitar un tipo NUNCA toca las sesiones que ya lo usan: el tipo viaja copiado dentro de cada día (`cat`, `catNombre`, `catColor`, `catIcono`).
 */

// De dónde salen y adónde van los tipos propios. Las pruebas de pantalla lo cambian por una lista falsa para no tocar la base.
export const fuenteDeTipos = { lista: listSessionTypes, crea: createSessionType, quita: deleteSessionType };

/* El orden de la lista, a mano y no el del objeto (Andrés, 18 sep 2026: «neural, recovery, equipo y test son las menos importantes, no las pongas
   primero»): primero lo que un coach usa casi a diario, al final lo suelto. Cambia solo lo que se ve; lo que se guarda sigue siendo el mismo slug. */
const ORDEN = ['gym', 'correr', 'bici', 'natacion', 'yoga', 'movilidad', 'clase', 'football', 'terapia', 'off', 'speed', 'recovery', 'tests', 'team'];
// Un tipo nuevo que alguien agregue a CAT_COLORS y olvide poner arriba cae al final, no en medio y al azar.
const puesto = (slug) => { const i = ORDEN.indexOf(slug); return i === -1 ? ORDEN.length : i; };

/** Los tipos de la app, en orden: `[{ slug, c, label }]`. */
export const TIPOS_DE_BASE = Object.entries(CAT_COLORS).map(([slug, v]) => ({ slug, ...v })).sort((a, b) => puesto(a.slug) - puesto(b.slug));

/** El único que no se puede quitar. */
export const TIPO_FIJO = 'off';

const SIN_TIPOS = Object.freeze([]);
const SIN_QUITADOS = Object.freeze([]);
const porNombre = (a, b) => a.nombre.localeCompare(b.nombre);

/* ---------- Los tipos propios, compartidos entre selectores ---------- */
const almacenes = new Map(); // coachId → { lista: null (aún no llega) | [...], pidiendo, oyentes }

function almacen(coachId) {
  let a = almacenes.get(coachId);
  if (!a) { a = { lista: null, pidiendo: false, oyentes: new Set() }; almacenes.set(coachId, a); }
  return a;
}

function ponLista(coachId, lista) {
  const a = almacen(coachId);
  a.lista = [...lista].sort(porNombre);
  a.oyentes.forEach((avisa) => avisa());
}

/** Los vuelve a pedir a la base (al abrir «Administrar»: pueden haber cambiado desde otro dispositivo). */
export function refrescaTipos(coachId) {
  const a = almacen(coachId);
  if (!coachId || a.pidiendo) return;
  a.pidiendo = true;
  // Sin red, la lista queda como estaba (o vacía la primera vez): los de la app siguen ahí.
  fuenteDeTipos.lista(coachId)
    .then((filas) => ponLista(coachId, filas ?? []))
    .catch(() => ponLista(coachId, a.lista ?? []))
    .finally(() => { a.pidiendo = false; });
}

function suscribe(coachId, avisa) {
  const a = almacen(coachId);
  a.oyentes.add(avisa);
  if (a.lista === null) refrescaTipos(coachId);
  return () => { a.oyentes.delete(avisa); };
}

export function useTiposDeSesion(coachId) {
  const alSuscribir = useCallback((avisa) => (coachId ? suscribe(coachId, avisa) : () => {}), [coachId]);
  const alLeer = useCallback(() => (coachId ? almacen(coachId).lista : SIN_TIPOS), [coachId]);
  const lista = useSyncExternalStore(alSuscribir, alLeer, alLeer);
  const [quitados, setQuitados] = useStorage('ui:tipos-quitados', SIN_QUITADOS);

  const base = useMemo(() => TIPOS_DE_BASE.filter((b) => b.slug === TIPO_FIJO || !quitados.includes(b.slug)), [quitados]);
  const baseQuitada = useMemo(() => TIPOS_DE_BASE.filter((b) => b.slug !== TIPO_FIJO && quitados.includes(b.slug)), [quitados]);

  const quitaBase = useCallback((slug) => {
    if (slug === TIPO_FIJO) return;
    setQuitados((prev) => (prev.includes(slug) ? prev : [...prev, slug]));
  }, [setQuitados]);
  const ponBase = useCallback((slug) => setQuitados((prev) => prev.filter((s) => s !== slug)), [setQuitados]);

  const crea = useCallback(async ({ nombre, color, icono }) => {
    const fila = await fuenteDeTipos.crea({ nombre, color, icono, coachId });
    ponLista(coachId, [...(almacen(coachId).lista ?? []), fila]);
    return fila;
  }, [coachId]);
  const quitaPropio = useCallback(async (tipo) => {
    await fuenteDeTipos.quita(tipo.id);
    ponLista(coachId, (almacen(coachId).lista ?? []).filter((t) => t.id !== tipo.id));
  }, [coachId]);
  const refresca = useCallback(() => refrescaTipos(coachId), [coachId]);

  return { propios: lista ?? SIN_TIPOS, cargando: lista === null && !!coachId, base, baseQuitada, quitaBase, ponBase, crea, quitaPropio, refresca };
}
