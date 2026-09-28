/**
 * Dónde estaba la persona, para volver ahí al refrescar la app.
 *
 * Andrés, 28 sep 2026: "cuando refresco la app pierdo el lugar en donde
 * estaba… estaría excelente que no". La app no tiene rutas: cada pantalla
 * guarda dónde está solo en memoria, y un refresco (o que el teléfono saque la
 * app de la memoria) la deja en la pantalla de inicio.
 *
 * CÓMO FUNCIONA. Cada pantalla apunta su lugar aquí —qué pestaña, qué atleta,
 * qué fase, semana y día, cuánto se había bajado— y al arrancar lo lee. Todo va
 * en UNA sola entrada del `localStorage`, con la hora de la última anotación.
 *
 * CUÁNDO SE VUELVE A UN LUGAR, y cuándo no:
 *
 *   · SOLO AL ARRANCAR (`esArranque`). Desde que carga la página hasta el
 *     primer toque o tecla. Después, navegar es navegar: abrir el editor de
 *     un plan te lleva a donde va el atleta —eso lo pidió Andrés y no se toca—,
 *     no al último lugar donde estuviste.
 *
 *   · SI ES DE ESTA PERSONA. Va con el id de quien entró: en un aparato
 *     compartido, otra cuenta no hereda el lugar de la anterior. Y al cerrar
 *     sesión se borra.
 *
 *   · SI ES RECIENTE. Pasadas 6 horas sin tocar nada, se olvida: volver al día
 *     siguiente a la mitad de un plan sería raro. Es tiempo de sobra para un
 *     refresco, para cambiar de app un rato y para una comida.
 *
 * QUÉ NO SE GUARDA: lo que se está escribiendo. Recordar el lugar no es
 * recordar los cambios; un plan con cambios sin guardar avisa antes de
 * refrescar (ver `PlanBuilder`).
 *
 * Si el navegador no deja guardar (Safari en navegación privada tira al
 * escribir), se pierde el recuerdo, no la app.
 */
const CLAVE = 'tl:lugar';
const VIGENCIA_MS = 6 * 60 * 60 * 1000;

/* El arranque termina con el primer gesto de la persona. Se escucha en fase de
   captura para enterarse antes que cualquier botón, y una sola vez por tipo. */
let arranque = true;
if (typeof window !== 'undefined') {
  const termina = () => { arranque = false; };
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach((tipo) => {
    window.addEventListener(tipo, termina, { once: true, capture: true, passive: true });
  });
}

/** ¿Todavía no hay ningún gesto desde que cargó la página? */
export const esArranque = () => arranque;

function lee() {
  try {
    const crudo = localStorage.getItem(CLAVE);
    if (!crudo) return null;
    const v = JSON.parse(crudo);
    const sano = v && typeof v === 'object' && typeof v.uid === 'string'
      && typeof v.t === 'number' && v.datos && typeof v.datos === 'object';
    return sano ? v : null;
  } catch {
    return null;
  }
}

// El lugar que vale ahora: de esta persona y de hace poco.
function vigente(uid) {
  const v = lee();
  if (!v || !uid || v.uid !== uid) return null;
  return Date.now() - v.t > VIGENCIA_MS ? null : v;
}

/** Lo guardado bajo `clave`, o `undefined` si no hay nada que valga. */
export function leeLugar(uid, clave) {
  return vigente(uid)?.datos?.[clave];
}

/** Anota `valor` bajo `clave`. `null` o `undefined` la borra. */
export function guardaLugar(uid, clave, valor) {
  if (!uid) return;
  try {
    const datos = { ...(vigente(uid)?.datos ?? {}) };
    if (valor === null || valor === undefined) delete datos[clave];
    else datos[clave] = valor;
    localStorage.setItem(CLAVE, JSON.stringify({ uid, t: Date.now(), datos }));
  } catch {
    // Sin sitio donde guardar: se pierde el recuerdo, no la app.
  }
}

/** Se llama al cerrar sesión: el siguiente en entrar no hereda nada. */
export function olvidaLugar() {
  try {
    localStorage.removeItem(CLAVE);
  } catch {
    // Igual que arriba.
  }
}
