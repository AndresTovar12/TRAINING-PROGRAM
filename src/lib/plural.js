/**
 * "1 ejercicios" no lo escribe nadie, pero lo escribe la app en cuanto se
 * concatena un número con una palabra fija. Salió probando un plan nuevo de
 * punta a punta: el coach veía "1 fase · 1 semana · 1 sesiones" y la atleta
 * "1 ejercicios · ~55 min".
 *
 * Se arregla aquí y no en cada sitio porque son diez sitios, y el que se
 * escriba mañana también lo va a necesitar.
 */

/** `plural(1, 'sesión', 'sesiones')` → "1 sesión". */
export function plural(n, uno, varios) {
  return `${n} ${n === 1 ? uno : varios}`;
}

/** Para las palabras que solo añaden "s": `pluralS(1, 'semana')` → "1 semana". */
export function pluralS(n, uno) {
  return `${n} ${uno}${n === 1 ? '' : 's'}`;
}
