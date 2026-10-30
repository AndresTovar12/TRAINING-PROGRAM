/* LO QUE EL INICIO RECUERDA ENTRE UNA PANTALLA Y OTRA (inicio nuevo, 30 oct 2026), solo en esta pestaña (`sessionStorage`), como `tipoPendiente.js`.

   Hace falta porque al nacer la cuenta la app se vuelve a armar: sin sesión el inicio va en modo `nuevo` y con sesión en `retomar` (ver `App.jsx`, la `key`).
   Lo que estaba en pantalla se pierde, y estas tres cosas tienen que llegar al otro lado:
     · CÓDIGO: el correo al que se acaba de mandar el código. «¿Tu correo?» y «Escribe el código» son UNA pantalla en dos momentos; el segundo ya va con la
       cuenta creada. Se olvida al confirmar o con «Lo confirmo después» (Mi perfil sigue recordando el correo pendiente, con `lib/correos`).
     · INVITADO: entró por el link de su entrenador. Su camino no pregunta el tipo, el nombre ni el entrenador, y la barra de arriba lo cuenta así.
     · INVITACIÓN: el link (token) mientras va a Apple o Google y regresa. Al volver con sesión, `App.jsx` la reclama (`activar-invitacion`, modo `reclamar`).
   Todo en try/catch: sin almacenamiento no pasa nada grave (se salta el código, la barra cuenta el camino de siempre, la invitación se vuelve a abrir). */

const CODIGO = 'tl:inicio-codigo';
const INVITADO = 'tl:inicio-invitado';
const INVITACION = 'tl:inicio-invitacion';
const VIGENCIA_MS = 30 * 60 * 1000;

const lee = (llave) => { try { return sessionStorage.getItem(llave) || ''; } catch { return ''; } };
const pon = (llave, valor) => { try { sessionStorage.setItem(llave, valor); } catch { /* sin almacenamiento */ } };
const quita = (llave) => { try { sessionStorage.removeItem(llave); } catch { /* nada que borrar */ } };

export const guardaCodigoPendiente = (correo) => pon(CODIGO, String(correo ?? '').trim().toLowerCase());
export const codigoPendiente = () => lee(CODIGO);
export const olvidaCodigoPendiente = () => quita(CODIGO);

export const marcaInvitado = () => pon(INVITADO, '1');
export const esInvitado = () => lee(INVITADO) === '1';

/** El link de la invitación, mientras va a Apple o Google. Vale 30 minutos: si nunca volvió, se ignora. */
export const guardaInvitacionPendiente = (token) => pon(INVITACION, JSON.stringify({ token, en: Date.now() }));
export function invitacionPendiente() {
  try {
    const { token, en } = JSON.parse(lee(INVITACION) || 'null') || {};
    return token && Date.now() - en < VIGENCIA_MS ? token : null;
  } catch {
    return null;
  }
}
export const olvidaInvitacionPendiente = () => quita(INVITACION);
