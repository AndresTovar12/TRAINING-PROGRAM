/* ABRIR «MI PERFIL» EN UNA SECCIÓN desde cualquier pantalla (28 oct 2026): «Conecta tu Apple Watch en Mi perfil → Dispositivos» lleva ahí.
   Es un aviso de la ventana: el menú de la cuenta abre Mi perfil (si estaba cerrado), Mi perfil entra a la sección (si ya estaba abierto) y lo que
   esté encima (Mis métricas) se cierra. `seccion`: el id de una sección de Mi perfil ('dispositivos', 'ia'…). */
export const AVISO_ABRE_PERFIL = 'tl:abre-perfil';

export const abrePerfil = (seccion) => window.dispatchEvent(new CustomEvent(AVISO_ABRE_PERFIL, { detail: { seccion } }));
