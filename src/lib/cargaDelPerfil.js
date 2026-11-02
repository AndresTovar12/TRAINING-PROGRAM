/* CARGAR EL PERFIL AL ENTRAR (2 nov 2026). La pieza pura de lo que hace `AuthContext` cada vez que cambia quien entró: se le pasan la copia del teléfono, el
   servidor y el reloj, y se prueba en Node con un reloj falso (`scripts/prueba-arranque.mjs`).

   EL CAMINO (el mismo de antes, 17 oct y 1 nov 2026):
     1. En la app de iPhone, la copia del perfil que dejó la última entrada (`leeCopia`). Su lectura tiene su propio tope de 3 s (`lib/almacenDelTelefono.js`):
        si el teléfono no contesta, se sigue sin copia.
     2. Sin señal y con copia: la copia, de una vez.
     3. Si no, el servidor, hasta 3 veces (esperando 2 y 4 s). Si un intento falla por señal y hay copia, la copia.
     4. Si no se logra, `alFalla`: «Cargando tu perfil…» deja de girar y ofrece «Reintentar» y «Salir» (auditoría p43).

   EL TOPE DE 15 S. Pase lo que pase en medio (el teléfono, el servidor o cualquier otra espera que no conteste), a los 15 s sin perfil también `alFalla`.
   El build 74 se quedaba en «Cargando tu perfil…» para siempre porque una espera nunca contestaba y el aviso solo llegaba al acabar los intentos. Es una
   salida de emergencia, no un avance por tiempo: la carga sigue y, si el perfil llega después, entra igual. */
import { esFaltaDeSenal } from './senal.js';

export const TOPE_DE_LA_CARGA_MS = 15000;
export const INTENTOS_DEL_PERFIL = 3;

const RELOJ = { pon: (f, ms) => setTimeout(f, ms), quita: (t) => clearTimeout(t) };

/**
 * Carga el perfil de `uid`. Devuelve cómo cancelarla (cambió quien entró, o «Reintentar»): después de cancelar no avisa nada.
 *   · `leeCopia()`: la copia del teléfono, o `null` (sin argumento: en la web no hay copia).
 *   · `pide()`: `{ data, error, status }` del servidor (lo de supabase-js).
 *   · `haySenal()`, `alSinSenal()`: el estado de la señal (`lib/senal.js`).
 *   · `alPerfil(perfil, { deLaCopia })`: ya hay perfil. `alFalla()`: no se logró, o pasaron 15 s sin perfil (puede llegar después: entonces `alPerfil`).
 *   · `temporizador`: `{ pon(fn, ms), quita(t) }` (las pruebas ponen uno falso).
 */
export function cargaElPerfil({ uid, leeCopia = null, pide, haySenal = () => true, alSinSenal = () => {}, alPerfil, alFalla, temporizador = RELOJ }) {
  let cancelada = false;
  const tope = temporizador.pon(() => { if (!cancelada) alFalla(); }, TOPE_DE_LA_CARGA_MS);
  const espera = (ms) => new Promise((listo) => { temporizador.pon(listo, ms); });
  const entrega = (perfil, deLaCopia) => {
    temporizador.quita(tope);
    alPerfil(perfil, { deLaCopia });
  };

  (async () => {
    let copia;
    try { copia = leeCopia ? await leeCopia() : null; } catch { copia = null; }
    if (cancelada) return;
    const sirve = copia?.id === uid;
    if (sirve && !haySenal()) { entrega(copia, true); return; }
    for (let intento = 0; intento < INTENTOS_DEL_PERFIL && !cancelada; intento += 1) {
      if (intento > 0) await espera(intento * 2000);
      if (cancelada) return;
      try {
        const { data, error, status } = await pide();
        if (cancelada) return;
        if (!error && data) { entrega(data, false); return; }
        if (error && esFaltaDeSenal(error, status)) {
          alSinSenal();
          if (sirve) { entrega(copia, true); return; }
        }
      } catch {
        /* sin señal: se reintenta (o, con copia, se usa la copia) */
        if (cancelada) return;
        if (sirve) { alSinSenal(); entrega(copia, true); return; }
      }
    }
    if (cancelada) return;
    temporizador.quita(tope);
    alFalla();
  })();

  return () => {
    cancelada = true;
    temporizador.quita(tope);
  };
}
