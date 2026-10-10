/* Las reglas de una contraseña, en un solo lugar: el registro, la invitación, el alta de un coach y «Cambiar contraseña» de Mi perfil.

   Seguridad (10 oct 2026): antes bastaban 6 caracteres. Ahora son 8, sin las más usadas ni solo números. Las funciones del servidor (`signup`, `activar-invitacion`)
   repiten el MÍNIMO (8): el navegador no es un candado, solo avisa antes. Supabase Auth además puede rechazar las contraseñas filtradas (interruptor del panel).

   Puro: sin importar nada de la app. */

export const MIN_CONTRASENA = 8;

// Las que aparecen primero en cualquier lista de claves filtradas, ya con el largo mínimo.
const COMUNES = new Set([
  '12345678', '123456789', '1234567890', '11111111', '00000000', '87654321', '12341234', '123123123', '1q2w3e4r', 'qwertyui', 'qwertyuiop', 'asdfghjk', 'zxcvbnm1',
  'password', 'password1', 'password123', 'passw0rd', 'contrasena', 'contraseña', 'contrasena1', 'abc12345', 'abcd1234', 'iloveyou', 'entrenar', 'entrenar1',
  'entrenamiento', 'traininglab', 'training1', 'training123', 'gimnasio', 'gimnasio1', 'mexico123', 'bienvenido', 'admin1234', 'administrador',
]);

/**
 * El problema de una contraseña nueva dicho en una frase, o `null` si sirve.
 *   actual   la que tiene hoy (no se puede repetir)
 *   usuario  su nombre de usuario (no puede ir adentro)
 *   correo   su correo (no puede ser la contraseña)
 */
export function problemaDeContrasena(nueva, { actual = '', usuario = '', correo = '' } = {}) {
  const c = String(nueva ?? '');
  if (c.length < MIN_CONTRASENA) return `Usa al menos ${MIN_CONTRASENA} caracteres.`;
  if (c.length > 72) return 'Usa un máximo de 72 caracteres.'; // el límite de bcrypt, que es con lo que se guarda
  if (/^\d+$/.test(c)) return 'No puede ser solo números.';
  if (/^(.)\1+$/.test(c)) return 'No puede ser el mismo carácter repetido.';
  const baja = c.toLowerCase();
  if (COMUNES.has(baja)) return 'Esa contraseña es de las más usadas. Elige otra.';
  const u = String(usuario ?? '').trim().toLowerCase();
  if (u.length >= 4 && baja.includes(u)) return 'No uses tu nombre de usuario dentro de la contraseña.';
  const mail = String(correo ?? '').trim().toLowerCase();
  if (mail && baja === mail) return 'No uses tu correo como contraseña.';
  if (actual && c === actual) return 'Elige una distinta a la actual.';
  return null;
}
