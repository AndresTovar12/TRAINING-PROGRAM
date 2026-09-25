/**
 * Guardar el estado del atleta por partes.
 *
 * `user_app_state.data` es un bloque con todo lo que el atleta anota: sesiones,
 * bienestar, 1RM y en qué día va. Antes la app lo mandaba ENTERO en cada
 * cambio. Desde que una IA también puede anotar (25 sep 2026), eso borraría lo
 * que la IA anotó mientras la app estaba abierta: la app mandaría encima su
 * copia vieja.
 *
 * Ahora se manda solo lo que cambió —un "parche"— y la base lo mezcla con lo
 * que ya hay (`mezclar_mi_estado`, que usa `jsonb_mezcla`). Este archivo es la
 * mitad de la app de ese trato, y tiene que decir lo mismo que la base:
 *   - Un objeto se mezcla llave por llave, a cualquier profundidad.
 *   - Todo lo demás (números, textos, listas, null) se reemplaza entero.
 *   - Borrar una llave se dice con BORRAR, no con null: null también es un
 *     valor que la app guarda a propósito.
 */

export const BORRAR = Object.freeze({ __borrar: true });

const esObjeto = (x) => x !== null && typeof x === 'object' && !Array.isArray(x);
const esBorrar = (x) => esObjeto(x) && x.__borrar === true && Object.keys(x).length === 1;

/**
 * Lo que hay que mandar para que `antes` quede como `despues`, o `undefined`
 * si no cambió nada. Solo toca las llaves que cambiaron: lo que otro haya
 * escrito en llaves que aquí no se tocaron se queda como está.
 */
export function diferencia(antes, despues) {
  if (antes === despues) return undefined;
  if (esObjeto(antes) && esObjeto(despues)) {
    const parche = {};
    let hay = false;
    for (const k of new Set([...Object.keys(antes), ...Object.keys(despues)])) {
      // Una llave en `undefined` cuenta como que no está: al guardarse como
      // JSON desaparece, igual que antes cuando se mandaba el bloque entero.
      const enAntes = antes[k] !== undefined;
      const enDespues = despues[k] !== undefined;
      if (!enDespues) {
        if (enAntes) {
          parche[k] = BORRAR;
          hay = true;
        }
      } else if (!enAntes) {
        parche[k] = despues[k];
        hay = true;
      } else {
        const d = diferencia(antes[k], despues[k]);
        if (d !== undefined) {
          parche[k] = d;
          hay = true;
        }
      }
    }
    return hay ? parche : undefined;
  }
  return JSON.stringify(antes) === JSON.stringify(despues) ? undefined : despues;
}

/**
 * Lo mismo que hace `jsonb_mezcla` en la base: aplica un parche sobre `base`
 * sin mutarla. Se usa para rehacer en la app los cambios que todavía no se
 * guardaban cuando llega el estado fresco de la base.
 */
export function aplicarParche(base, parche) {
  if (!esObjeto(parche)) return parche;
  const origen = esObjeto(base) ? base : {};
  const resultado = { ...origen };
  for (const [k, v] of Object.entries(parche)) {
    if (esBorrar(v)) delete resultado[k];
    else resultado[k] = aplicarParche(origen[k], v);
  }
  return resultado;
}
