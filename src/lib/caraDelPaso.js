/**
 * QUÉ PANTALLA LE TOCA A CADA PASO (23 nov 2026).
 *
 * Antes la app lo ADIVINABA: «si la sesión trae algo de la lista, todo va en negro», más unas excepciones puestas a mano (`comoGym`, `guiado`).
 * Servía mientras ninguna sesión mezclaba cosas. El Híbrido mezcla fuerza y carrera, y un calentamiento puede ir antes de unos Sets de Gym: con
 * la regla vieja, una sentadilla dentro de un Híbrido habría salido en la pantalla negra de correr, sin dónde anotar los kilos.
 *
 * Ahora CADA PASO LO DICE, en `paso.cara`, y lo pone quien arma el paso (el traductor de cada editor), que es quien sabe qué es:
 *
 *   'numeros'  la pantalla NEGRA: va avanzando (corre, rueda, nada) y necesita sus números. Regla 18: «negra solo cuando se necesita».
 *   'lejos'    la clara con el teléfono en el piso: video que se repite solo, cifra enorme, «Listo» grande (Técnica, calentamiento con ejercicios).
 *   'guiado'   un video que se sigue completo y pasa solo al terminar (calentamiento guiado; después, la clase).
 *   'gym'      la de siempre de Gym: video, cifras, kilos, anotar, grabar técnica. Es la de un paso que no dice nada: Gym no cambia.
 *   'reloj'    un Set con reloj (AMRAP, EMOM, Tabata, Por tiempo, lapsos). No se escribe: lo es todo paso de `tipo: 'reloj'`.
 *
 * Un DESCANSO no tiene cara propia: toma el color de lo que sigue (ahí se enseña lo que viene); si no sigue nada, el de lo que acaba de hacer.
 *
 * Todo es puro (sin pantalla, sin `@/`): se prueba en Node (`scripts/prueba-cara-del-paso.mjs`).
 */

export const CARAS_DE_PASO = ['numeros', 'lejos', 'guiado', 'gym'];

/** La cara de un paso de trabajo: la que dice, o la de Gym. `null` para un descanso o si no hay paso. */
export function caraDelPaso(paso) {
  if (!paso || paso.tipo === 'descanso') return null;
  if (paso.tipo === 'reloj') return 'reloj';
  return CARAS_DE_PASO.includes(paso.cara) ? paso.cara : 'gym';
}

/** ¿Este paso va en la pantalla negra de los números? */
export const esDeNumeros = (paso) => caraDelPaso(paso) === 'numeros';

/**
 * Lo que se dibuja ahora: `{ pantalla, negra }`.
 *   pantalla  'antes' · 'descanso' · 'descansoNegro' · 'numeros' · 'lejos' · 'guiado' · 'gym' · 'reloj'
 *   negra     si el fondo es el negro (para la barra de arriba, el fondo y las hojas que salen encima)
 * `siguiente` y `anterior` son los pasos de trabajo de un lado y otro de un descanso.
 */
export function pantallaDelPaso({ antes = false, paso, siguiente = null, anterior = null }) {
  if (!paso) return { pantalla: null, negra: false };
  if (antes) return { pantalla: 'antes', negra: false };
  if (paso.tipo === 'descanso') {
    const negra = esDeNumeros(siguiente ?? anterior);
    return { pantalla: negra ? 'descansoNegro' : 'descanso', negra };
  }
  const cara = caraDelPaso(paso);
  return { pantalla: cara, negra: cara === 'numeros' };
}
