/* LA SEÑAL (1 nov 2026, encargo «sin conexión», parte 2). Dos cosas que necesitan la copia del teléfono y la cola (`lib/colaDelTelefono.js`):

   1. DISTINGUIR una falta de señal de un rechazo del servidor (`esFaltaDeSenal`). No es lo mismo:
        · falta de señal → lo que se iba a guardar se queda en el teléfono y se reintenta solo (4, 10, 30 y luego cada 60 s);
        · rechazo → el servidor SÍ contestó y dijo que no (datos que no acepta, cuenta desactivada…). Reintentar solo no lo arregla: se avisa
          «No se guardó. Reintentar» y se deja de intentar solo. Nada se tira: queda guardado hasta que la persona reintente o lo descarte.
      Cuenta como falta de señal todo lo que se arregla esperando: la petición no salió (status 0), el servidor no pudo en ese momento (5xx, 408, 429) y
      la sesión que no se pudo renovar por no tener internet (401, «JWT expired», «Sin sesión»: al volver la señal Supabase la renueva sola).

   2. SABER SI HAY SEÑAL para el aviso fijo «Sin conexión…» y para que quien esperaba la señal (releer la base, vaciar la cola, refrescar el plan)
      se entere en cuanto vuelve. `navigator.onLine` solo dice si el teléfono tiene red, no si llega al servidor (un wifi sin internet dice que sí):
      por eso también cuenta lo que pasa con cada petición (`marcaSinSenal` / `marcaConSenal`).

   Puro salvo el estado de la señal; se prueba en Node (`scripts/prueba-cola-de-subida.mjs`). */
import { useSyncExternalStore } from 'react';

// Lo que dicen los navegadores (Safari, Chrome, Firefox) y Supabase cuando la petición no llegó a salir o se cortó.
const PATRON_DE_RED = /failed to fetch|load failed|networkerror|network request failed|network connection was lost|internet connection appears to be offline|not connected to the internet|fetcherror|err_internet_disconnected|err_network|err_connection|timed out|could not connect|retryablefetch/i;

/** Un error que no es un rechazo: «todavía no se puede» (p. ej. la pantalla que recibe lo del reloj aún no está abierta). La cola lo reintenta después, sin avisar. */
export class TodaviaNo extends Error {
  constructor(mensaje = 'Todavía no se puede subir') {
    super(mensaje);
    this.name = 'TodaviaNo';
    this.todaviaNo = true;
  }
}

/**
 * ¿Este error se arregla esperando (se reintenta) o es un rechazo del servidor?
 * `error`: lo que devolvió o lanzó Supabase (o cualquier `Error`). `status`: el código HTTP si se sabe (los `{ error, status }` de supabase-js; 0 = no salió).
 */
export function esFaltaDeSenal(error, status = error?.status) {
  if (!error) return false;
  if (error.todaviaNo) return true;
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  const s = Number(status);
  if (status === 0 || s === 0) return true;
  if (s >= 500 || s === 408 || s === 429 || s === 401) return true;
  const codigo = String(error.code ?? '');
  if (codigo === 'PGRST301' || codigo === 'PGRST303') return true; // JWT vencido / inválido: se renueva al volver la señal
  // Un `TypeError` cualquiera NO: también lo lanza un error de programación, y ese no se arregla esperando. Solo cuenta el de `fetch`, que se reconoce por su texto (abajo).
  const nombre = String(error.name ?? '');
  if (/AuthRetryableFetchError|AuthSessionMissingError|AbortError|TimeoutError/.test(nombre) && !(s >= 400 && s < 500)) return true;
  const texto = `${error.message ?? ''} ${error.details ?? ''}`;
  if (PATRON_DE_RED.test(texto)) return true;
  // `mezclar_mi_estado` sin sesión: la petición salió con la llave pública porque la sesión no se pudo renovar (sin señal). Con señal se renueva.
  if (/sin sesi[oó]n|jwt expired|invalid jwt|session.*missing/i.test(texto)) return true;
  return false;
}

/** El texto corto de un error para guardarlo junto a lo que se rechazó (nunca datos de la persona: solo lo que dijo el servidor). */
export const textoDelError = (error) => String(error?.message ?? error ?? 'Error').slice(0, 200);

/* ---- El estado de la señal ---- */

let sinSenal = typeof navigator !== 'undefined' && navigator.onLine === false;
const escuchas = new Set();
const alVolver = new Set();
const avisa = () => { for (const f of [...escuchas]) { try { f(); } catch { /* una pantalla que falla no apaga a las demás */ } } };
const llamaAlVolver = () => { for (const f of [...alVolver]) { try { f(); } catch { /* igual */ } } };

/** Una petición no llegó por falta de señal. */
export function marcaSinSenal() {
  if (sinSenal) return;
  sinSenal = true;
  avisa();
}

/** Una petición sí llegó: hay señal. Si antes no había, avisa a quien esperaba la señal (`alVolverLaSenal`). */
export function marcaConSenal() {
  if (!sinSenal) return;
  sinSenal = false;
  avisa();
  llamaAlVolver();
}

/** ¿Vale la pena intentar ahora? No, si el teléfono no tiene red o si lo último que se intentó no llegó. */
export const haySenalAhora = () => !sinSenal && !(typeof navigator !== 'undefined' && navigator.onLine === false);

/**
 * El teléfono dice que NO tiene red (modo avión, sin datos ni wifi). Entonces ni se intenta: cada intento sin red le cuesta a Supabase hasta 30 s de reintentos
 * para renovar la sesión, y mientras tanto las demás peticiones esperan. Se espera al evento `online`. (Con red pero sin internet sí se intenta, con las esperas.)
 */
export const sinRedEnElTelefono = () => typeof navigator !== 'undefined' && navigator.onLine === false;

/** `fn` corre cada vez que vuelve la señal (el evento `online` del teléfono, o una petición que llega después de una que no). Devuelve cómo quitarla. */
export function alVolverLaSenal(fn) {
  alVolver.add(fn);
  return () => alVolver.delete(fn);
}

const suscribe = (fn) => { escuchas.add(fn); return () => escuchas.delete(fn); };
const foto = () => sinSenal;

/** `true` mientras no hay señal (para el aviso fijo de arriba). */
export function useSinSenal() {
  return useSyncExternalStore(suscribe, foto, () => false);
}

if (typeof window !== 'undefined') {
  // `online` solo dice que el teléfono volvió a tener red: se avisa para que todos intenten de una vez; si no llega, cada uno lo vuelve a marcar.
  window.addEventListener('online', () => { if (sinSenal) marcaConSenal(); else llamaAlVolver(); });
  window.addEventListener('offline', marcaSinSenal);
}
