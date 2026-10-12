/* LA PÁGINA «LISTO» DESPUÉS DE PAGAR: qué mostrar según lo que contesta la función `compra-lista`.

   Quien paga vuelve de Stripe a `/compra/lista?c=<llave del pago>`. Su compra puede estar:
     esperando   Stripe ya cobró pero el aviso (webhook) todavía no llega: se pregunta cada pocos segundos, sin mover la pantalla.
     contrasena  la compra ya es suya y su cuenta se creó con ella: falta que ponga SU contraseña (una sola vez).
     listo       todo en orden: abrir la app (o entrar, si no tiene la sesión abierta en este navegador).
     cancelada / cerrada / desconocida  los casos tristes, con su aviso.
   Puro: sin red ni React, para probarlo con `scripts/prueba-compra-sin-cuenta.mjs`. */

export const SEGUNDOS_ENTRE_INTENTOS = 3;
export const MAX_INTENTOS_DE_ESPERA = 40; // 40 × 3 s = 2 minutos; después se le dice que no pague otra vez y que su plan aparecerá solo

/** La etapa que toca mostrar. `r` es la respuesta de `compra-lista` (`{ estado: 'sin_conexion' }` si no hubo respuesta; null o `desconocida` si la llave no existe). */
export function etapaDeCompra(r) {
  if (!r || r.estado === 'desconocida') return 'desconocida';
  switch (r.estado) {
    case 'pendiente':
    case 'sin_conexion': return 'esperando'; // sin internet un momento: se vuelve a preguntar, no se le dice que la compra no existe
    case 'activa':
    case 'gracia':
    case 'por_armar': return r.puede_poner_contrasena ? 'contrasena' : 'listo';
    case 'cancelada': return 'cancelada';
    default: return 'cerrada'; // vencida o reembolsada
  }
}

/** ¿Hay que volver a preguntar? Solo mientras se espera el aviso de Stripe y no se pasó del tope. */
export const hayQueSeguirEsperando = (etapa, intentos) => etapa === 'esperando' && intentos < MAX_INTENTOS_DE_ESPERA;

/** La llave del pago que viene en la liga (`?c=cs_…`), o null si no hay o no tiene forma de llave de Stripe. */
export function llaveDeLaLiga(search) {
  const c = new URLSearchParams(String(search ?? '')).get('c');
  return c && /^cs_(test|live)_[A-Za-z0-9]{8,200}$/.test(c) ? c : null;
}

/** Un correo con forma de correo (lo mismo que revisa el servidor; el servidor manda). */
export const correoValido = (c) => {
  const t = String(c ?? '').trim();
  return t.length <= 254 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(t);
};
