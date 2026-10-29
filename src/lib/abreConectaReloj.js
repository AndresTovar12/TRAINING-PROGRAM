/* ABRIR «CONECTA TU APPLE WATCH» desde cualquier pantalla (fase 5, 29 oct 2026): Home, la página del entreno, Mis métricas, Dispositivos y el mensaje del
   coach. Es un aviso de la ventana que escucha `ConectaRelojGlobal` (montado una vez en la app). `origen`: de dónde vino (cambia el aviso final);
   `reconectar`: la conexión ya está en la cuenta y solo falta el permiso de este iPhone. */
export const AVISO_CONECTA_RELOJ = 'tl:conecta-reloj';

export const abreConectaReloj = (origen, { reconectar = false } = {}) => window.dispatchEvent(new CustomEvent(AVISO_CONECTA_RELOJ, { detail: { origen, reconectar } }));
