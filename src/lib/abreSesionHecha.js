/* ABRIR LA PÁGINA DE UN WORKOUT DEL PLAN desde cualquier pantalla (fase 6, 29 oct 2026): «Tus entrenos» en Home y en Entrenar, «Ver todos» y el final del entreno guiado.
   Es un aviso de la ventana que escucha `PaginaDeSesionGlobal` (montada una vez en la app del atleta). `almacen`: dónde vive la sesión (`wr:sessions` o
   `wr:sessions@<clave>`); `id`: su llave (con `#n`, una vez anterior). `recien`: viene de terminarla (sale «Tus stickers están listos»). `stickers`: abre ya
   con la hoja de stickers encima (el ⇪ de una fila). */
export const AVISO_ABRE_SESION = 'tl:abre-sesion';

export const abreSesionHecha = ({ almacen = 'wr:sessions', id, recien = false, stickers = false }) => (
  window.dispatchEvent(new CustomEvent(AVISO_ABRE_SESION, { detail: { almacen, id, recien, stickers } }))
);
