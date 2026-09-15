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

/**
 * Las repeticiones de un ejercicio, dichas como se dicen.
 *
 * La app ponía " reps" detrás de todo. Con series de gimnasio no se notaba,
 * pero ya salía "12/lado reps", y al convertir las sesiones de velocidad en
 * ejercicios iban a salir "30 yd reps" y "10 min reps". Ahora "reps" va solo
 * detrás de un número o un rango; lo demás ya dice su propia unidad.
 */
export function textoReps(reps) {
  const r = String(reps ?? '').trim();
  if (!r || r === '—') return null;
  if (/^\d+(\s*-\s*\d+)?$/.test(r)) return r === '1' ? '1 rep' : `${r} reps`;
  return r;
}

/**
 * ¿Vale la pena decir cuántas veces se repite una serie?
 * Solo con un número o un rango mayor que uno. "Se repite — veces" salía en el
 * French Contrast (los ejercicios del cluster traen "—") y "Se repite 1 vez" no
 * dice nada.
 */
export function rondasQueDecir(rondas) {
  const r = String(rondas ?? '').trim();
  return /^\d+(\s*-\s*\d+)?$/.test(r) && r !== '1' ? r : null;
}
