/* LO QUE CRUZA EN MEMORIA AL NACER LA CUENTA (inicio nuevo, 31 oct 2026). Solo en MEMORIA: nunca en el almacenamiento del navegador.

   LA CUENTA NACE DESPUÉS DEL CÓDIGO: «Escribe el código» se comprueba SIN cuenta (`correo-previo`) y recién con el código bueno se crea la cuenta, ya con el
   correo confirmado. Al nacer la sesión la app se vuelve a armar (el inicio pasa de modo `nuevo` a `retomar`, ver `App.jsx`) y lo que estaba en pantalla se pierde.
   Mientras llega el perfil se ve «Creando tu cuenta…» (`CuentaEnCamino`) en vez de la carga con el logo («se ve bastante fea»): la marca `cuentaNaciendo` lo dice.

   Lo demás de este archivo es del CAMINO DE ANTES, que sigue para las cuentas que nacieron con el correo pendiente (clientes viejos de TestFlight y las de prueba):
     · ENVÍO: «Escribe el código» de esa cuenta espera la respuesta del envío para decir «Mandando…», «Te lo mandamos» o el error de verdad.
     · CONFIRMADO: respaldo de `correoSinConfirmar` si la sesión tardara en traer el correo nuevo.
   Retirar con ese camino cuando los builds nuevos estén instalados. */

import { correoSinConfirmar } from '../../lib/correos.js';

let confirmadoId = '';
let envio = null;
let naciendo = false;
const oyentes = new Set();

/** La cuenta se está creando (el código ya salió bueno): mientras llega su perfil, la app enseña «Creando tu cuenta…». */
export const marcaCuentaNaciendo = () => { naciendo = true; };
export const cuentaNaciendo = () => naciendo;
export const olvidaCuentaNaciendo = () => { naciendo = false; };

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
  envio = null;
  naciendo = false;
  oyentes.forEach((f) => f(envio));
}

/* «¿Esta cuenta ya confirmó su correo aquí?» Respaldo de `correoSinConfirmar` (que lee la sesión): si la sesión tardara en traer el correo nuevo, quien acaba de
   escribir el código bueno no se queda atrapado en «Escribe el código». Va por id de cuenta: otra cuenta que entre en esta pestaña no hereda el permiso. */
export const marcaCorreoConfirmado = (id) => { confirmadoId = String(id ?? ''); };

/** El correo que la cuenta todavía no confirma, o '' (nunca para quien lo acaba de confirmar en esta pestaña). Lo usan la puerta de `App.jsx` y el inicio. */
export const correoPorConfirmarDe = (usuario) => (usuario?.id && usuario.id === confirmadoId ? '' : correoSinConfirmar(usuario));
