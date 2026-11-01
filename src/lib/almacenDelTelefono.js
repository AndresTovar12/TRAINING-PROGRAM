/* EL ALMACÉN DEL TELÉFONO (1 nov 2026, encargo «sin conexión», parte 2).

   Donde viven la copia (el estado del atleta, su perfil, su plan) y la cola de lo que falta subir. En la app de iPhone es Capacitor Preferences
   (`UserDefaults` de iOS): sobrevive a cerrar la app y el sistema no lo borra para hacer espacio, a diferencia del `localStorage` de la vista web,
   que iOS sí puede vaciar. Cada llave se escribe entera o no se escribe: nunca queda a medias.

   SOLO EN LA APP. En la web no hay copia ni cola (`conCopiaEnElTelefono()` es falso) y todo funciona como antes del 1 nov 2026. Razones: el texto
   que se enseña («se guarda en tu teléfono») no sería cierto en una compu, y con varias pestañas abiertas dos copias se pisarían entre sí. Ver
   `docs/sin-conexion.md`.

   PARA PROBAR SIN IPHONE (solo con `npm run dev`, nunca en lo publicado): si la página trae `window.__tlPruebaSinConexion = true` antes de cargar, se usa
   el `localStorage` del navegador en lugar de Preferences. Así una prueba de WebKit puede cerrar la «app» (contexto nuevo con el mismo almacenamiento)
   y ver que nada se perdió. `import.meta.env.DEV` es falso al compilar: en producción esa puerta no existe.

   REGLAS:
     · Lo de una llave se escribe en fila: dos guardados seguidos llegan en ese orden y una lectura espera a los guardados que iban antes.
     · Al salir de una cuenta (`cierraCuenta`) ya no se escriben sus copias (una escritura que iba tarde no la revive); su cola sí, porque es lo que
       falta subir. Al volver a entrar, `abreCuenta`. */
import { Capacitor } from '@capacitor/core';

const enPrueba = () => import.meta.env.DEV && typeof window !== 'undefined' && window.__tlPruebaSinConexion === true;

/** ¿Hay copia y cola en el teléfono? Solo en la app de iPhone (y en las pruebas de desarrollo). */
export function conCopiaEnElTelefono() {
  try {
    return Capacitor.isNativePlatform() || enPrueba();
  } catch {
    return false;
  }
}

const PREFIJO_DE_PRUEBA = 'tl-prueba:';
let preferencias = null;
const nativo = () => {
  preferencias ??= import('@capacitor/preferences').then((m) => m.Preferences);
  return preferencias;
};

const crudo = {
  async lee(clave) {
    if (enPrueba()) return window.localStorage.getItem(PREFIJO_DE_PRUEBA + clave);
    const { value } = await (await nativo()).get({ key: clave });
    return value ?? null;
  },
  async guarda(clave, texto) {
    if (enPrueba()) { window.localStorage.setItem(PREFIJO_DE_PRUEBA + clave, texto); return; }
    await (await nativo()).set({ key: clave, value: texto });
  },
  async borra(clave) {
    if (enPrueba()) { window.localStorage.removeItem(PREFIJO_DE_PRUEBA + clave); return; }
    await (await nativo()).remove({ key: clave });
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
    const { keys } = await (await nativo()).keys();
    return (keys ?? []).filter((k) => k.startsWith('tl:'));
  },
};

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

/** Lee y abre (JSON) lo guardado en una llave. `null` si no hay nada; `{ noSeEntiende: texto }` si hay algo que no es JSON (para guardarlo aparte, no pisarlo). */
export function leeDelTelefono(clave) {
  if (!conCopiaEnElTelefono()) return Promise.resolve(null);
  return enFila(clave, async () => {
    const texto = await crudo.lee(clave);
    if (texto == null) return null;
    try { return JSON.parse(texto); } catch { return { noSeEntiende: String(texto).slice(0, 200000) }; }
  }).catch((e) => {
    console.error('almacén del teléfono: no se pudo leer', clave, e?.message ?? e);
    return null;
  });
}

/** Guarda `valor` (como JSON) en una llave. `true` cuando ya quedó escrito; `false` si no se pudo (o si es una copia de una cuenta de la que ya se salió). */
export function guardaEnElTelefono(clave, valor, { aunqueEsteCerrada = false } = {}) {
  if (!conCopiaEnElTelefono()) return Promise.resolve(false);
  let texto;
  try { texto = JSON.stringify(valor); } catch { return Promise.resolve(false); }
  return enFila(clave, async () => {
    if (!aunqueEsteCerrada && esDeCuentaCerrada(clave)) return false;
    await crudo.guarda(clave, texto);
    return true;
  }).catch((e) => {
    console.error('almacén del teléfono: no se pudo guardar', clave, e?.message ?? e);
    return false;
  });
}

/** Borra una llave (después de lo que iba antes en su fila). */
export function borraDelTelefono(clave) {
  if (!conCopiaEnElTelefono()) return Promise.resolve(false);
  return enFila(clave, async () => { await crudo.borra(clave); return true; }).catch(() => false);
}

/** Todas las llaves de Training Lab en el almacén (`tl:…`). */
export async function clavesDelTelefono() {
  if (!conCopiaEnElTelefono()) return [];
  try { return await crudo.claves(); } catch { return []; }
}
