import { useCallback, useMemo, useSyncExternalStore } from 'react';
import { CAT_COLORS } from '@/lib/theme';
import {
  createSessionType, deleteSessionType, listSessionTypes, listTiposQuitados, saveTiposQuitados,
} from '@/lib/api';

/**
 * Los tipos de sesión que ofrece el selector de un coach: los de la APP (menos los que él quitó) y los SUYOS.
 *
 * Andrés, 9 oct 2026: cada coach tiene que poder «agregar tipos de sesión pero también eliminar los que no les gusten», también los de la app.
 *
 * LOS DE LA APP viven en el código (`CAT_COLORS`) y no se borran de ningún lado: «quitar» uno es apuntarlo en la lista de quitados de ESE coach
 * (llave `ui:tipos-quitados` de su estado de usuario: lo acompaña a cualquier dispositivo). «OFF» no se puede quitar: la app lo usa para los días libres.
 *
 * LOS SUYOS están en la base (`session_types`). Los dos se piden UNA vez por coach y se comparten entre todos los selectores de la pantalla (un editor
 * con veinte sesiones tiene veinte selectores): lo que uno crea o quita se ve en los demás sin recargar.
 *
 * NO USA `useStorage`. El editor del coach está FUERA de `AppStateProvider` (solo la app del atleta lo tiene; ver `App.jsx` y `useAvisosVistos`), y un
 * `useStorage` aquí hacía reventar todo el editor (9 oct 2026: «no puedo editar workouts, se bugea»). Lo quitado se lee y se guarda directo en el estado
 * del usuario, como los avisos aceptados.
 *
 * Quitar un tipo NUNCA toca las sesiones que ya lo usan: el tipo viaja copiado dentro de cada día (`cat`, `catNombre`, `catColor`, `catIcono`).
 */

// De dónde salen y adónde van los tipos. Las pruebas de pantalla lo cambian por listas falsas para no tocar la base.
export const fuenteDeTipos = {
  lista: listSessionTypes, crea: createSessionType, quita: deleteSessionType, quitados: listTiposQuitados, guardaQuitados: saveTiposQuitados,
};

/* El orden de la lista, a mano y no el del objeto (Andrés, 18 sep 2026: «neural, recovery, equipo y test son las menos importantes, no las pongas
   primero»): primero lo que un coach usa casi a diario, al final lo suelto. Cambia solo lo que se ve; lo que se guarda sigue siendo el mismo slug. */
const ORDEN = ['gym', 'correr', 'bici', 'natacion', 'yoga', 'movilidad', 'clase', 'football', 'terapia', 'off', 'speed', 'recovery', 'tests', 'team'];
// Un tipo nuevo que alguien agregue a CAT_COLORS y olvide poner arriba cae al final, no en medio y al azar.
const puesto = (slug) => { const i = ORDEN.indexOf(slug); return i === -1 ? ORDEN.length : i; };

/** Los tipos de la app, en orden: `[{ slug, c, label }]`. */
export const TIPOS_DE_BASE = Object.entries(CAT_COLORS).map(([slug, v]) => ({ slug, ...v })).sort((a, b) => puesto(a.slug) - puesto(b.slug));

/** El único que no se puede quitar. */
export const TIPO_FIJO = 'off';

const SIN_LISTA = Object.freeze([]);
const porNombre = (a, b) => a.nombre.localeCompare(b.nombre);

/* ---------- Un almacén por coach, compartido entre selectores ---------- */
/** `pide(coachId)` trae la lista de la base. `valor` es `null` hasta que llega; sin red queda vacía (los de la app siguen ahí). */
function crearAlmacen(pide) {
  const porCoach = new Map(); // coachId → { valor, pidiendo, oyentes }
  const de = (id) => {
    let a = porCoach.get(id);
    if (!a) { a = { valor: null, pidiendo: false, oyentes: new Set() }; porCoach.set(id, a); }
    return a;
  };
  const pone = (id, valor) => { const a = de(id); a.valor = valor; a.oyentes.forEach((avisa) => avisa()); };
  const refresca = (id) => {
    const a = de(id);
    if (!id || a.pidiendo) return;
    a.pidiendo = true;
    pide(id).then((v) => pone(id, v ?? [])).catch(() => pone(id, a.valor ?? [])).finally(() => { a.pidiendo = false; });
  };
  const suscribe = (id, avisa) => {
    const a = de(id);
    a.oyentes.add(avisa);
    if (a.valor === null) refresca(id);
    return () => { a.oyentes.delete(avisa); };
  };
  return { pone, refresca, suscribe, lee: (id) => de(id).valor };
}

const propiosDe = crearAlmacen((id) => fuenteDeTipos.lista(id).then((filas) => [...(filas ?? [])].sort(porNombre)));
const quitadosDe = crearAlmacen((id) => fuenteDeTipos.quitados(id));

// Los guardados de «quitados» van en fila, uno detrás del otro: dos a la vez podrían llegar desordenados y el viejo quedar encima del nuevo.
let colaDeQuitados = Promise.resolve();

/** Cambia la lista de quitados al instante (la pantalla no espera a la red) y la guarda; si falla, regresa lo que había y avisa con el error. */
function cambiaQuitados(coachId, cambio) {
  const antes = quitadosDe.lee(coachId) ?? [];
  const despues = cambio(antes);
  if (despues === antes) return Promise.resolve();
  quitadosDe.pone(coachId, despues);
  const guardado = colaDeQuitados.then(() => fuenteDeTipos.guardaQuitados(coachId, despues));
  colaDeQuitados = guardado.catch(() => {});
  return guardado.catch((error) => {
    // Solo se regresa si nadie lo cambió mientras tanto.
    if (quitadosDe.lee(coachId) === despues) quitadosDe.pone(coachId, antes);
    throw error;
  });
}

export function useTiposDeSesion(coachId) {
  const alSuscribirPropios = useCallback((avisa) => (coachId ? propiosDe.suscribe(coachId, avisa) : () => {}), [coachId]);
  const alLeerPropios = useCallback(() => (coachId ? propiosDe.lee(coachId) : SIN_LISTA), [coachId]);
  const propios = useSyncExternalStore(alSuscribirPropios, alLeerPropios, alLeerPropios);
  const alSuscribirQuitados = useCallback((avisa) => (coachId ? quitadosDe.suscribe(coachId, avisa) : () => {}), [coachId]);
  const alLeerQuitados = useCallback(() => (coachId ? quitadosDe.lee(coachId) : SIN_LISTA), [coachId]);
  const quitados = useSyncExternalStore(alSuscribirQuitados, alLeerQuitados, alLeerQuitados) ?? SIN_LISTA;

  const base = useMemo(() => TIPOS_DE_BASE.filter((b) => b.slug === TIPO_FIJO || !quitados.includes(b.slug)), [quitados]);
  const baseQuitada = useMemo(() => TIPOS_DE_BASE.filter((b) => b.slug !== TIPO_FIJO && quitados.includes(b.slug)), [quitados]);

  const quitaBase = useCallback((slug) => {
    if (slug === TIPO_FIJO) return Promise.resolve();
    return cambiaQuitados(coachId, (prev) => (prev.includes(slug) ? prev : [...prev, slug]));
  }, [coachId]);
  const ponBase = useCallback((slug) => cambiaQuitados(coachId, (prev) => (prev.includes(slug) ? prev.filter((s) => s !== slug) : prev)), [coachId]);

  const crea = useCallback(async ({ nombre, color, icono }) => {
    const fila = await fuenteDeTipos.crea({ nombre, color, icono, coachId });
    propiosDe.pone(coachId, [...(propiosDe.lee(coachId) ?? []), fila].sort(porNombre));
    return fila;
  }, [coachId]);
  const quitaPropio = useCallback(async (tipo) => {
    await fuenteDeTipos.quita(tipo.id);
    propiosDe.pone(coachId, (propiosDe.lee(coachId) ?? []).filter((t) => t.id !== tipo.id));
  }, [coachId]);
  // Al abrir «Administrar» se piden otra vez: pueden haber cambiado desde otro dispositivo.
  const refresca = useCallback(() => { propiosDe.refresca(coachId); quitadosDe.refresca(coachId); }, [coachId]);

  return { propios: propios ?? SIN_LISTA, cargando: propios === null && !!coachId, base, baseQuitada, quitaBase, ponBase, crea, quitaPropio, refresca };
}
