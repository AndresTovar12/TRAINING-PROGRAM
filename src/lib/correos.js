/* CORREOS (puro: sin imports, para poder probarlo en node).

   A quien se registra sin correo, o llega por la liga de un coach, se le inventa uno para que la cuenta exista. Esos correos terminan en un dominio que NADIE puede recibir:
     · `sin-correo.traininglabapp.com`: subdominio nuestro, sin buzón (el de ahora; 15 oct 2026).
     · `traininglab.app`: el de antes. Es de OTRA persona; las cuentas viejas se pasaron al de arriba, pero se sigue reconociendo por si algún dato viejo reaparece.
   «Recuperar contraseña» NUNCA se manda a uno de esos: no llegaría a nadie, o peor, llegaría a un desconocido. */

export const DOMINIOS_SIN_BUZON = ['sin-correo.traininglabapp.com', 'traininglab.app'];

/** ¿Este correo es de los inventados (sin buzón)? */
export function esCorreoInventado(correo) {
  const c = String(correo ?? '').trim().toLowerCase();
  const arroba = c.lastIndexOf('@');
  if (arroba < 0) return false;
  const dominio = c.slice(arroba + 1);
  return DOMINIOS_SIN_BUZON.some((d) => dominio === d || dominio.endsWith(`.${d}`));
}

/** ¿Parece un correo de verdad? (solo la forma; que exista lo dice el envío) */
export const correoValido = (correo) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(correo ?? '').trim());

/** Lo que se le dice a quien pide recuperar la contraseña de una cuenta que se creó sin correo. */
export const AVISO_SIN_CORREO = 'Esa cuenta se creó sin correo, así que no hay a dónde mandarle el enlace. Pídele a tu entrenador o al administrador que te ponga una contraseña nueva.';

/** Lo que se dice SIEMPRE tras pedir el enlace, exista o no la cuenta (así nadie averigua qué correos están registrados). */
export const AVISO_ENLACE_ENVIADO = 'Si ese correo tiene una cuenta, en unos minutos te llega un enlace para poner una contraseña nueva. Revisa también la carpeta de spam.';

/* EL CORREO QUE FALTA CONFIRMAR (lote 1 de seguridad, 25 oct 2026).
   Quien se registra con un correo no lo tiene como correo de la cuenta hasta teclear el código de 6 números que le llega (ver `supabase/functions/signup`).
   Mientras tanto se recuerda aquí, solo en este aparato, para que Mi perfil → Correo retome en el paso del código. Todo va en try/catch: sin almacenamiento no pasa nada, solo se vuelve a escribir. */
const LLAVE_CORREO_POR_CONFIRMAR = 'tl:correo-por-confirmar';
export function guardaCorreoPorConfirmar(correo) {
  try { localStorage.setItem(LLAVE_CORREO_POR_CONFIRMAR, String(correo ?? '').trim().toLowerCase()); } catch { /* sin almacenamiento */ }
}
export function correoPorConfirmar() {
  try { return localStorage.getItem(LLAVE_CORREO_POR_CONFIRMAR) || ''; } catch { return ''; }
}
export function olvidaCorreoPorConfirmar() {
  try { localStorage.removeItem(LLAVE_CORREO_POR_CONFIRMAR); } catch { /* sin almacenamiento */ }
}
