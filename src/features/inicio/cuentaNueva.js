/* LA CUENTA QUE ACABA DE NACER, mientras escribe el código (inicio nuevo, 31 oct 2026). Solo en MEMORIA: nunca en el almacenamiento del navegador.

   Al nacer la sesión la app se vuelve a armar (el inicio pasa de modo `nuevo` a `retomar`, ver `App.jsx`) y lo que estaba en pantalla se pierde. Dos cosas
   tienen que cruzar ese cambio y no pueden ir en `sessionStorage` como `marcas.js`:
     · ENVÍO: el código se pide justo después de crear la cuenta. «Escribe el código» espera esa respuesta para decir «Mandando…», «Te lo mandamos» o el
       error de verdad (antes se mandaba a ciegas y la pantalla decía «Te mandamos el código» aunque hubiera fallado).
     · CONTRASEÑA: para borrar la cuenta a medias si la persona se va con Apple o Google. Vive solo en memoria y se olvida al confirmar el correo.
   Si la app se recarga se pierde todo esto, y no pasa nada grave: `correo-de-la-cuenta` deja pedir otro código sin contraseña a la cuenta recién nacida
   (primeras 24 h, mientras siga con su correo inventado), y sin contraseña Apple/Google solo sale sin borrarla (nunca tuvo un correo confirmado). */

import { correoSinConfirmar } from '../../lib/correos.js';

let contrasena = '';
let confirmadoId = '';
let envio = null;
const oyentes = new Set();

export const recuerdaContrasena = (c) => { contrasena = String(c ?? ''); };
export const contrasenaNueva = () => contrasena;

/** Arranca (o cambia) el envío del código. `promesa` resuelve si salió y falla con el error del servidor. */
export function anotaEnvio(promesa) {
  const este = { estado: 'mandando', error: '' };
  envio = este;
  oyentes.forEach((f) => f(envio));
  promesa.then(
    () => { if (envio === este) { envio = { estado: 'mandado', error: '' }; oyentes.forEach((f) => f(envio)); } },
    (e) => { if (envio === este) { envio = { estado: 'fallo', error: e?.message || 'No se pudo mandar el código.', ...(e?.codigo ? { codigo: e.codigo } : {}) }; oyentes.forEach((f) => f(envio)); } },
  );
}

export const envioDelCodigo = () => envio;

/** Avisa cada vez que cambia el envío. Regresa la función para dejar de oír. */
export function oyeEnvio(f) {
  oyentes.add(f);
  return () => oyentes.delete(f);
}

export function olvidaCuentaNueva() {
  contrasena = '';
  envio = null;
  oyentes.forEach((f) => f(envio));
}

/* «¿Esta cuenta ya confirmó su correo aquí?» Respaldo de `correoSinConfirmar` (que lee la sesión): si la sesión tardara en traer el correo nuevo, quien acaba de
   escribir el código bueno no se queda atrapado en «Escribe el código». Va por id de cuenta: otra cuenta que entre en esta pestaña no hereda el permiso. */
export const marcaCorreoConfirmado = (id) => { confirmadoId = String(id ?? ''); };

/** El correo que la cuenta todavía no confirma, o '' (nunca para quien lo acaba de confirmar en esta pestaña). Lo usan la puerta de `App.jsx` y el inicio. */
export const correoPorConfirmarDe = (usuario) => (usuario?.id && usuario.id === confirmadoId ? '' : correoSinConfirmar(usuario));
