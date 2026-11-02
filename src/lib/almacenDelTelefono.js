/* EL ALMACÉN DEL TELÉFONO (1 nov 2026, encargo «sin conexión», parte 2).

   Donde viven la copia (el estado del atleta, su perfil, su plan) y la cola de lo que falta subir. En la app de iPhone es Capacitor Preferences
   (`UserDefaults` de iOS): sobrevive a cerrar la app y el sistema no lo borra para hacer espacio, a diferencia del `localStorage` de la vista web,
   que iOS sí puede vaciar. Cada llave se escribe entera o no se escribe: nunca queda a medias.

   SOLO EN LA APP. En la web no hay copia ni cola (`conCopiaEnElTelefono()` es falso) y todo funciona como antes del 1 nov 2026. Razones: el texto
   que se enseña («se guarda en tu teléfono») no sería cierto en una compu, y con varias pestañas abiertas dos copias se pisarían entre sí. Ver
   `docs/sin-conexion.md`.

   PARA PROBAR SIN IPHONE (solo con `npm run dev`, nunca en lo publicado): si la página trae `window.__tlPruebaSinConexion = true` antes de cargar, se usa
   el `localStorage` del navegador en lugar de Preferences. Así una prueba de WebKit puede cerrar la «app» (contexto nuevo con el mismo almacenamiento)
   y ver que nada se perdió. `import.meta.env.DEV` es falso al compilar: en producción esa puerta no existe. (`scripts/prueba-arranque.mjs` y
   `scripts/prueba-arranque-iphone.mjs` prueban el camino de Preferences de verdad, con un puente de iOS falso.)

   REGLAS:
     · Lo de una llave se escribe en fila: dos guardados seguidos llegan en ese orden y una lectura espera a los guardados que iban antes.
     · Al salir de una cuenta (`cierraCuenta`) ya no se escriben sus copias (una escritura que iba tarde no la revive); su cola sí, porque es lo que
       falta subir. Al volver a entrar, `abreCuenta`.
     · NADA ESPERA AL TELÉFONO MÁS DE 3 S (2 nov 2026, ver abajo).
     · UNA LLAVE QUE NO SE PUDO LEER NO SE PISA NI SE BORRA hasta que se vuelva a abrir la app (ver abajo). */
import { Capacitor } from '@capacitor/core';
import { conTiempoLimite } from './tiempoLimite.js';

// Con `try`: fuera de Vite (las pruebas de Node) `import.meta.env` no existe. Vite lo cambia por `false` al compilar.
const enDesarrollo = () => { try { return import.meta.env.DEV === true; } catch { return false; } };
const enPrueba = () => enDesarrollo() && typeof window !== 'undefined' && window.__tlPruebaSinConexion === true;

/** ¿Hay copia y cola en el teléfono? Solo en la app de iPhone (y en las pruebas de desarrollo). */
export function conCopiaEnElTelefono() {
  try {
    return Capacitor.isNativePlatform() || enPrueba();
  } catch {
    return false;
  }
}

/* OJO: EL PLUGIN NO SE DEVUELVE DESNUDO DE UNA PROMESA (2 nov 2026: el build 74 se quedaba en «Cargando tu perfil…» para siempre; venía del 72).
   Antes era `import(…).then((m) => m.Preferences)`. Al resolver una promesa con un objeto, JavaScript le pregunta por `.then`, y el «proxy» de Capacitor
   contesta a CUALQUIER nombre con un método nativo: llamaba a `Preferences.then()`, que no existe («"Preferences.then()" is not implemented on ios»), y
   la promesa no contestaba nunca. Así, la primera lectura del teléfono (la copia del perfil, al entrar) se quedaba esperando sin fin, sin llegar al
   iPhone. En la web no pasaba: ahí no se usa Preferences. Ya había mordido con Salud (`lib/saludDelTelefono.js`). El plugin va dentro de un objeto. */
const PREFIJO_DE_PRUEBA = 'tl-prueba:';
let preferencias = null;
const nativo = () => {
  preferencias ??= import('@capacitor/preferences').then(
    (m) => ({ Preferences: m.Preferences }),
    (e) => { preferencias = null; throw e; }, // si el archivo no carga, la siguiente vez se intenta otra vez
  );
  return preferencias;
};

const crudo = {
  async lee(clave) {
    if (enPrueba()) return window.localStorage.getItem(PREFIJO_DE_PRUEBA + clave);
    const { Preferences } = await nativo();
    const { value } = await Preferences.get({ key: clave });
    return value ?? null;
  },
  async guarda(clave, texto) {
    if (enPrueba()) { window.localStorage.setItem(PREFIJO_DE_PRUEBA + clave, texto); return; }
    const { Preferences } = await nativo();
    await Preferences.set({ key: clave, value: texto });
  },
  async borra(clave) {
    if (enPrueba()) { window.localStorage.removeItem(PREFIJO_DE_PRUEBA + clave); return; }
    const { Preferences } = await nativo();
    await Preferences.remove({ key: clave });
  },
  async claves() {
    if (enPrueba()) {
      const todas = [];
      for (let i = 0; i < window.localStorage.length; i += 1) {
        const k = window.localStorage.key(i);
        if (k?.startsWith(PREFIJO_DE_PRUEBA)) todas.push(k.slice(PREFIJO_DE_PRUEBA.length));
      }
      return todas;
    }
    const { Preferences } = await nativo();
    const { keys } = await Preferences.keys();
    return (keys ?? []).filter((k) => k.startsWith('tl:'));
  },
};

/* NADA ESPERA AL TELÉFONO MÁS DE 3 S (2 nov 2026). Preferences contesta en milisegundos. Si un día no contestara (un plugin que se atora, el puente nativo que
   no responde), quien espera sigue sin el teléfono: una lectura da `null` («se sigue sin copia»), un guardado o un borrado `false`, las llaves `[]`. Es una
   salida de emergencia, no un avance por tiempo. La operación sigue en su fila y, si contesta tarde, termina sola.
   UNA LLAVE QUE NO SE PUDO LEER (no contestó a tiempo, o falló) NO SE PISA NI SE BORRA hasta que se vuelva a abrir la app: puede guardar lo que falta subir (el
   estado, la cola, lo del reloj) y quien escribiría encima no lo vio. Se queda como estaba en el teléfono y se lee la próxima vez. Mientras tanto esa llave
   no guarda nada nuevo: lo de esa sesión sube directo al servidor, como en la web. */
export const TOPE_DEL_TELEFONO_MS = 3000;
const NO_CONTESTO = `el teléfono no contestó en ${TOPE_DEL_TELEFONO_MS / 1000} s`;
const sinLeer = new Set();

// Lo último que se pidió hacer con cada llave: lo siguiente espera a que termine.
const filas = new Map();
const enFila = (clave, hacer) => {
  const antes = filas.get(clave) ?? Promise.resolve();
  const hecho = antes.then(hacer, hacer);
  filas.set(clave, hecho.then(() => {}, () => {}));
  return hecho;
};

// Las cuentas de las que ya se salió: sus copias (no su cola) ya no se escriben.
const cerradas = new Set();
const COPIAS = /^tl:(estado|plan|perfil|entrenos):([^:]+)/;
const esDeCuentaCerrada = (clave) => {
  const m = COPIAS.exec(clave);
  return !!m && cerradas.has(m[2]);
};

/** Ya no se escriben las copias de esta cuenta (salió de ella). */
export const cierraCuenta = (usuario) => { if (usuario) cerradas.add(usuario); };
/** Volvió a entrar: sus copias se pueden escribir otra vez. */
export const abreCuenta = (usuario) => { if (usuario) cerradas.delete(usuario); };

/**
 * Lee y abre (JSON) lo guardado en una llave. `null` si no hay nada, o si el teléfono no contestó en 3 s o falló (se sigue sin copia, y esa llave ya no
 * se pisa: ver arriba); `{ noSeEntiende: texto }` si hay algo que no es JSON (para guardarlo aparte, no pisarlo).
 */
export function leeDelTelefono(clave) {
  if (!conCopiaEnElTelefono()) return Promise.resolve(null);
  const lectura = enFila(clave, async () => {
    const texto = await crudo.lee(clave);
    if (texto == null) return null;
    try { return JSON.parse(texto); } catch { return { noSeEntiende: String(texto).slice(0, 200000) }; }
  });
  return conTiempoLimite(lectura, TOPE_DEL_TELEFONO_MS, NO_CONTESTO).catch((e) => {
    sinLeer.add(clave);
    console.error('almacén del teléfono: no se pudo leer', clave, e?.message ?? e);
    return null;
  });
}

/**
 * Guarda `valor` (como JSON) en una llave. `true` cuando ya quedó escrito; `false` si no se pudo o no contestó en 3 s, si es una copia de una cuenta de la que
 * ya se salió, o si esa llave no se pudo leer en esta sesión.
 */
export function guardaEnElTelefono(clave, valor, { aunqueEsteCerrada = false } = {}) {
  if (!conCopiaEnElTelefono() || sinLeer.has(clave)) return Promise.resolve(false);
  let texto;
  try { texto = JSON.stringify(valor); } catch { return Promise.resolve(false); }
  const escritura = enFila(clave, async () => {
    if (sinLeer.has(clave)) return false;
    if (!aunqueEsteCerrada && esDeCuentaCerrada(clave)) return false;
    await crudo.guarda(clave, texto);
    return true;
  });
  return conTiempoLimite(escritura, TOPE_DEL_TELEFONO_MS, NO_CONTESTO).catch((e) => {
    console.error('almacén del teléfono: no se pudo guardar', clave, e?.message ?? e);
    return false;
  });
}

/** Borra una llave (después de lo que iba antes en su fila). `false` si no se pudo, si no contestó en 3 s o si esa llave no se pudo leer en esta sesión. */
export function borraDelTelefono(clave) {
  if (!conCopiaEnElTelefono() || sinLeer.has(clave)) return Promise.resolve(false);
  const borrado = enFila(clave, async () => {
    if (sinLeer.has(clave)) return false;
    await crudo.borra(clave);
    return true;
  });
  return conTiempoLimite(borrado, TOPE_DEL_TELEFONO_MS, NO_CONTESTO).catch(() => false);
}

/** Todas las llaves de Training Lab en el almacén (`tl:…`). `[]` si el teléfono no contestó en 3 s. */
export async function clavesDelTelefono() {
  if (!conCopiaEnElTelefono()) return [];
  try { return await conTiempoLimite(crudo.claves(), TOPE_DEL_TELEFONO_MS, NO_CONTESTO); } catch { return []; }
}
